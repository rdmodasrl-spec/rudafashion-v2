import assert from 'node:assert/strict';
import test from 'node:test';
import {
  AI_TOOLS_TRIAL_DAYS,
  computeGrantExpiry,
  evaluateAiTool,
  parseAiToolManifest,
  planAppToolGrants,
  readManifestTrialDays,
  removeBlockedToolDefinitions,
  resolveAiToolAccess,
  type AiToolManifest
} from '../src/server/aiToolManifest';
import {
  grantAppTools,
  loadMerchantAiToolAccess,
  revokeAppToolGrants,
  saveAppManifest,
  setAppToolGrantState,
  setMerchantToolGrantStatus,
  type AiToolRegistryDb
} from '../src/server/aiToolRegistry';
import {
  describeAppStoreRuntime,
  getAppStoreInstallationError,
  pricingTypeAllowsTrial
} from '../src/server/appStoreValidation';
import { createModauiAiTools, createModauiAiToolsManifest } from '../src/server/modauiAiTools';

const appToolDefinition = (overrides: Record<string, unknown> = {}) => ({
  toolId: 'ai_tools_write_copy',
  version: '1.0.0',
  displayName: { zh: '商品文案创作' },
  description: '生成商品文案',
  inputSchema: { type: 'object', properties: { brief: { type: 'string' } }, required: ['brief'] },
  outputSchema: { type: 'object', properties: { body: { type: 'string' } } },
  permission: 'ai.tools.use',
  riskLevel: 'LOW',
  requiresApproval: false,
  timeoutMs: 30_000,
  retry: { maxAttempts: 1, idempotent: false },
  industries: [],
  employees: [],
  cost: { unit: 'call', credits: 0 },
  adapter: { kind: 'native' },
  credentials: [],
  dataScopes: [],
  enabled: true,
  status: 'published',
  ...overrides
});

const manifestOf = (tools: Record<string, unknown>[], extra: Record<string, unknown> = {}) => ({
  manifestVersion: '1',
  appId: 'modaui-ai-tools',
  ...extra,
  tools
});

function parseOrThrow(raw: unknown): AiToolManifest {
  const parsed = parseAiToolManifest(raw);
  if ('issues' in parsed) throw new Error(`TOOL_MANIFEST_INVALID: ${JSON.stringify(parsed.issues)}`);
  return parsed.manifest;
}

function issueCodesOf(raw: unknown, options: { expectedAppId?: string } = {}): string[] {
  const parsed = parseAiToolManifest(raw, options);
  if (!('issues' in parsed)) throw new Error('TOOL_MANIFEST_ACCEPTED_UNEXPECTEDLY');
  return parsed.issues.map(issue => issue.code);
}

test('manifest parsing rejects each concrete contract violation', () => {
  assert.deepEqual(issueCodesOf('{bad json'), ['TOOL_MANIFEST_INVALID_JSON']);
  assert.deepEqual(issueCodesOf([]), ['TOOL_MANIFEST_NOT_OBJECT']);
  assert.deepEqual(issueCodesOf({ manifestVersion: '2', appId: 'x', tools: [] }), [
    'TOOL_MANIFEST_VERSION_UNSUPPORTED',
    'TOOL_MANIFEST_TOOLS_INVALID'
  ]);
  assert.deepEqual(
    issueCodesOf(manifestOf([appToolDefinition({ toolId: 'BadId' })])),
    ['TOOL_ID_INVALID']
  );
  assert.deepEqual(
    issueCodesOf(manifestOf([appToolDefinition(), appToolDefinition()])),
    ['TOOL_ID_CONFLICT']
  );
  assert.deepEqual(
    issueCodesOf(manifestOf([appToolDefinition({ permission: 'unknown.permission' })])),
    ['TOOL_PERMISSION_INVALID']
  );
  assert.deepEqual(
    issueCodesOf(manifestOf([appToolDefinition({ adapter: { kind: 'http', endpoint: 'http://insecure' } })])),
    ['TOOL_ADAPTER_ENDPOINT_INVALID', 'TOOL_ADAPTER_AUTH_REQUIRED']
  );
  assert.deepEqual(
    issueCodesOf(manifestOf([appToolDefinition({ retry: { maxAttempts: 3, idempotent: false } })])),
    ['TOOL_RETRY_NOT_IDEMPOTENT']
  );
  assert.deepEqual(
    issueCodesOf(manifestOf([appToolDefinition({ riskLevel: 'HIGH', requiresApproval: false })])),
    ['TOOL_APPROVAL_REQUIRED']
  );
  assert.deepEqual(issueCodesOf(manifestOf([appToolDefinition()], { trialDays: 120 })), ['TOOL_MANIFEST_TRIAL_INVALID']);
  assert.deepEqual(
    issueCodesOf(manifestOf([appToolDefinition()]), { expectedAppId: 'other-app' }),
    ['TOOL_MANIFEST_APP_ID_MISMATCH']
  );
});

test('generated MODAUI manifest is valid and matches registered handlers', () => {
  const manifest = parseOrThrow(createModauiAiToolsManifest());
  const { handlers, definitions } = createModauiAiTools({});
  assert.deepEqual(manifest.tools.map(tool => tool.toolId).sort(), Object.keys(handlers).sort());
  assert.deepEqual(
    manifest.tools.map(tool => tool.toolId).sort(),
    definitions.map(item => item.name).sort()
  );
  for (const tool of manifest.tools) {
    assert.equal(tool.status, 'published');
    assert.equal(tool.adapter.kind, 'native');
    assert.equal(tool.permission, 'ai.tools.use');
  }
  assert.equal(readManifestTrialDays(manifest), 7);
  assert.equal(AI_TOOLS_TRIAL_DAYS, 7);
});
test('trial planning grants only published tools with a real expiry', () => {
  const manifest = parseOrThrow(manifestOf([
    appToolDefinition(),
    appToolDefinition({ toolId: 'ai_tools_translate' }),
    appToolDefinition({ toolId: 'ai_tools_draft_only', status: 'draft' })
  ]));
  const now = new Date('2026-10-30T08:00:00.000Z');
  const plan = planAppToolGrants({ appId: 'modaui-ai-tools', manifest, trialDays: 7, now });
  assert.deepEqual(plan.map(entry => entry.toolId), ['ai_tools_write_copy', 'ai_tools_translate']);
  assert.equal(plan[0].expiresAt?.toISOString(), '2026-11-06T08:00:00.000Z');
  assert.equal(computeGrantExpiry(now, 0), null);
  assert.equal(computeGrantExpiry(now, -1), null);
});

test('uninstalled, disabled, paused and expired grants block only the app tools', () => {
  const manifest = parseOrThrow(manifestOf([appToolDefinition()]));
  const permissions = ['ai.tools.use'];
  const now = new Date('2026-10-30T08:00:00.000Z');
  const baseApp = {
    appId: 'modaui-ai-tools',
    appStatus: 'published',
    manifest,
    grants: [{ toolId: 'ai_tools_write_copy', status: 'active', expiresAt: null }]
  };

  const notInstalled = resolveAiToolAccess({
    apps: [{ ...baseApp, installationStatus: null }],
    actorPermissions: permissions,
    now
  });
  assert.deepEqual(notInstalled.allowedToolIds, []);
  assert.deepEqual(notInstalled.blockedToolIds, ['ai_tools_write_copy']);
  assert.equal(notInstalled.denied[0].reason, 'app_not_installed');

  const active = resolveAiToolAccess({
    apps: [{ ...baseApp, installationStatus: 'active' }],
    actorPermissions: permissions,
    now
  });
  assert.deepEqual(active.allowedToolIds, ['ai_tools_write_copy']);
  assert.deepEqual(active.blockedToolIds, []);
  assert.deepEqual(active.appIds, ['modaui-ai-tools']);

  const paused = resolveAiToolAccess({
    apps: [{
      ...baseApp,
      installationStatus: 'active',
      grants: [{ toolId: 'ai_tools_write_copy', status: 'paused', expiresAt: null }]
    }],
    actorPermissions: permissions,
    now
  });
  assert.equal(paused.denied[0].reason, 'grant_paused');

  const expired = resolveAiToolAccess({
    apps: [{
      ...baseApp,
      installationStatus: 'active',
      grants: [{
        toolId: 'ai_tools_write_copy',
        status: 'active',
        expiresAt: new Date('2026-10-30T07:59:59.000Z')
      }]
    }],
    actorPermissions: permissions,
    now
  });
  assert.equal(expired.denied[0].reason, 'grant_expired');

  const revoked = resolveAiToolAccess({
    apps: [{
      ...baseApp,
      installationStatus: 'active',
      grants: [{ toolId: 'ai_tools_write_copy', status: 'revoked', expiresAt: null }]
    }],
    actorPermissions: permissions,
    now
  });
  assert.equal(revoked.denied[0].reason, 'grant_missing');

  const missingPermission = resolveAiToolAccess({
    apps: [{ ...baseApp, installationStatus: 'active' }],
    actorPermissions: [],
    now
  });
  assert.equal(missingPermission.denied[0].reason, 'permission_denied');

  const unpublishedApp = resolveAiToolAccess({
    apps: [{ ...baseApp, appStatus: 'draft', installationStatus: 'active' }],
    actorPermissions: permissions,
    now
  });
  assert.equal(unpublishedApp.denied[0].reason, 'app_disabled');

  const manifestDisabled = resolveAiToolAccess({
    apps: [{ ...baseApp, installationStatus: 'active' }],
    actorPermissions: permissions,
    manifestEnabled: false,
    now
  });
  assert.deepEqual(manifestDisabled.allowedToolIds, []);
  assert.deepEqual(manifestDisabled.blockedToolIds, []);
});

test('a granted tool for another merchant never unlocks the current merchant', () => {
  const manifest = parseOrThrow(manifestOf([appToolDefinition()]));
  const access = resolveAiToolAccess({
    apps: [{
      appId: 'modaui-ai-tools',
      appStatus: 'published',
      installationStatus: 'active',
      manifest,
      grants: []
    }],
    actorPermissions: ['ai.tools.use']
  });
  assert.deepEqual(access.allowedToolIds, []);
  assert.equal(access.denied[0].reason, 'grant_missing');
});

test('core MODAGPT tool definitions survive when only app tools are blocked', () => {
  const definitions = [
    { name: 'get_products' },
    { name: 'ai_tools_write_copy' }
  ] as unknown as Parameters<typeof removeBlockedToolDefinitions>[0];
  assert.deepEqual(
    removeBlockedToolDefinitions(definitions, ['ai_tools_write_copy']).map(definition => definition.name),
    ['get_products']
  );
  assert.deepEqual(
    removeBlockedToolDefinitions(definitions, []).map(definition => definition.name),
    ['get_products', 'ai_tools_write_copy']
  );
});

test('tools that declare credentials stay blocked until the key is active', () => {
  const manifest = parseOrThrow(manifestOf([appToolDefinition({ credentials: ['OPENAI_API_KEY'] })]));
  const tool = manifest.tools[0];
  const reason = evaluateAiTool({
    app: {
      appId: 'modaui-ai-tools',
      appStatus: 'published',
      installationStatus: 'active',
      manifest,
      grants: [{ toolId: tool.toolId, status: 'active', expiresAt: null }]
    },
    tool,
    actorPermissions: ['ai.tools.use'],
    agentId: null,
    industry: null,
    activeCredentialKeys: new Set<string>(),
    now: new Date()
  });
  assert.equal(reason, 'credential_missing');
});


type FakeGrantRow = {
  merchantId: string;
  toolId: string;
  appId: string;
  status: string;
  source: string;
  grantedBy: string | null;
  grantedAt: Date;
  expiresAt: Date | null;
  pausedAt: Date | null;
  revokedAt: Date | null;
  revokedReason: string | null;
};

/**
 * 内存版 prisma 代理：只实现 registry 用到的查询，用于在没有数据库时验证安装/卸载闭环。
 * 不替代真实数据库测试，但能锁定「授权写入、撤销、暂停、试用不延长」这条真实逻辑路径。
 */
function createRegistryFake(seed: {
  apps: Array<{ id: string; appId: string; status: string; manifest: unknown; installations?: Array<{ status: string }> }>;
}) {
  const grants = new Map<string, FakeGrantRow>();
  const apps = seed.apps.map(app => ({ installations: [] as Array<{ status: string }>, ...app }));
  const registryEntries = new Map<string, Record<string, unknown>>();

  const matchesStatus = (current: string, filter: unknown): boolean => {
    if (filter === undefined) return true;
    if (typeof filter === 'string') return current === filter;
    if (filter && typeof filter === 'object') {
      const rule = filter as { not?: string; in?: string[] };
      if (rule.not !== undefined && current === rule.not) return false;
      if (rule.in !== undefined && !rule.in.includes(current)) return false;
    }
    return true;
  };

  const db = {
    app: {
      async findMany({ where }: { where?: { appId?: string } } = {}) {
        return apps.filter(app =>
          app.manifest !== null
          && app.manifest !== undefined
          && (!where?.appId || app.appId === where.appId)
        );
      },
      async findUnique({ where }: { where: { id?: string; appId?: string } }) {
        return apps.find(app => (where.id ? app.id === where.id : app.appId === where.appId)) ?? null;
      },
      async update({ where, data }: { where: { appId: string }; data: { manifest: unknown } }) {
        const app = apps.find(candidate => candidate.appId === where.appId);
        if (!app) throw new Error('APP_NOT_FOUND');
        app.manifest = data.manifest;
        return app;
      }
    },
    merchantToolGrant: {
      async upsert({ where, create, update }: {
        where: { merchantId_toolId: { merchantId: string; toolId: string } };
        create: FakeGrantRow;
        update: Partial<FakeGrantRow>;
      }) {
        const { merchantId, toolId } = where.merchantId_toolId;
        const key = `${merchantId}:${toolId}`;
        const existing = grants.get(key);
        if (existing) {
          Object.assign(existing, update);
          return existing;
        }
        grants.set(key, { ...create });
        return grants.get(key);
      },
      async updateMany({ where, data }: {
        where: { merchantId: string; appId?: string; toolId?: string; status?: unknown };
        data: Partial<FakeGrantRow>;
      }) {
        let count = 0;
        for (const row of grants.values()) {
          if (row.merchantId !== where.merchantId) continue;
          if (where.appId && row.appId !== where.appId) continue;
          if (where.toolId && row.toolId !== where.toolId) continue;
          if (!matchesStatus(row.status, where.status)) continue;
          Object.assign(row, data);
          count += 1;
        }
        return { count };
      },
      async findMany({ where }: { where: { merchantId: string } }) {
        return [...grants.values()].filter(row => row.merchantId === where.merchantId);
      }
    },
    aiToolRegistryEntry: {
      async upsert({ where, create, update }: {
        where: { toolId: string };
        create: Record<string, unknown>;
        update: Record<string, unknown>;
      }) {
        const existing = registryEntries.get(where.toolId);
        registryEntries.set(where.toolId, existing ? { ...existing, ...update } : { ...create });
        return registryEntries.get(where.toolId);
      },
      async deleteMany({ where }: { where: { appId: string; toolId: { notIn: string[] } } }) {
        let count = 0;
        for (const [toolId, entry] of registryEntries) {
          if (entry.appId !== where.appId) continue;
          if (where.toolId.notIn.includes(toolId)) continue;
          registryEntries.delete(toolId);
          count += 1;
        }
        return { count };
      }
    },
    merchant: { async findUnique() { return null; } },
    appInstallationStatusEvent: {
      async create({ data }: { data: Record<string, unknown> }) {
        return data;
      }
    }
  };

  return { db: db as unknown as AiToolRegistryDb, grants, apps, registryEntries };
}


test('install grants a 7-day trial, disable pauses it, uninstall revokes it', async () => {
  const manifest = parseOrThrow(createModauiAiToolsManifest({ trialDays: 7 }));
  const fake = createRegistryFake({
    apps: [{
      id: 'app-1',
      appId: 'modaui-ai-tools',
      status: 'published',
      manifest,
      installations: [{ status: 'installed' }]
    }]
  });
  const now = new Date('2026-10-30T08:00:00.000Z');

  const granted = await grantAppTools(fake.db, {
    merchantId: 'merchant-a',
    appId: 'modaui-ai-tools',
    manifest,
    now
  });
  assert.equal(granted, manifest.tools.length);
  const firstGrant = fake.grants.get('merchant-a:ai_tools_write_copy');
  assert.equal(firstGrant?.status, 'active');
  assert.equal(firstGrant?.expiresAt?.toISOString(), '2026-11-06T08:00:00.000Z');
  assert.equal(firstGrant?.source, 'app-install');
  assert.equal(fake.grants.has('merchant-b:ai_tools_write_copy'), false);

  assert.equal(await setAppToolGrantState(fake.db, {
    merchantId: 'merchant-a',
    appId: 'modaui-ai-tools',
    status: 'paused',
    now
  }), manifest.tools.length);
  assert.equal(fake.grants.get('merchant-a:ai_tools_write_copy')?.status, 'paused');

  assert.equal(await setAppToolGrantState(fake.db, {
    merchantId: 'merchant-a',
    appId: 'modaui-ai-tools',
    status: 'active'
  }), manifest.tools.length);
  assert.equal(fake.grants.get('merchant-a:ai_tools_write_copy')?.status, 'active');

  assert.equal(await revokeAppToolGrants(fake.db, {
    merchantId: 'merchant-a',
    appId: 'modaui-ai-tools',
    reason: 'uninstall',
    now
  }), manifest.tools.length);
  assert.equal(fake.grants.get('merchant-a:ai_tools_write_copy')?.status, 'revoked');
  assert.equal(fake.grants.get('merchant-a:ai_tools_write_copy')?.revokedReason, 'uninstall');

  const access = await loadMerchantAiToolAccess(fake.db, {
    merchantId: 'merchant-a',
    actorPermissions: ['ai.tools.use'],
    now
  });
  assert.deepEqual(access.allowedToolIds, []);
});

test('merchant pause is scoped to one tool and one merchant', async () => {
  const manifest = parseOrThrow(createModauiAiToolsManifest({ trialDays: 7 }));
  const fake = createRegistryFake({
    apps: [{
      id: 'app-1',
      appId: 'modaui-ai-tools',
      status: 'published',
      manifest,
      installations: [{ status: 'active' }]
    }]
  });
  await grantAppTools(fake.db, { merchantId: 'merchant-a', appId: 'modaui-ai-tools', manifest });
  await grantAppTools(fake.db, { merchantId: 'merchant-b', appId: 'modaui-ai-tools', manifest });

  assert.equal(await setMerchantToolGrantStatus(fake.db, {
    merchantId: 'merchant-a',
    toolId: 'ai_tools_translate',
    status: 'paused'
  }), true);
  assert.equal(fake.grants.get('merchant-a:ai_tools_translate')?.status, 'paused');
  assert.equal(fake.grants.get('merchant-a:ai_tools_write_copy')?.status, 'active');
  assert.equal(fake.grants.get('merchant-b:ai_tools_translate')?.status, 'active');
  assert.equal(await setMerchantToolGrantStatus(fake.db, {
    merchantId: 'merchant-a',
    toolId: 'not_granted_tool',
    status: 'paused'
  }), false);
});

test('saving a manifest with a cross-app toolId conflict keeps the previous version', async () => {
  const duplicated = parseOrThrow(manifestOf([appToolDefinition()]));
  const conflicting = parseOrThrow(manifestOf([appToolDefinition()], { appId: 'other-app' }));
  const fake = createRegistryFake({
    apps: [
      { id: 'app-1', appId: 'modaui-ai-tools', status: 'published', manifest: duplicated },
      { id: 'app-2', appId: 'other-app', status: 'published', manifest: conflicting }
    ]
  });
  const result = await saveAppManifest(fake.db, { appId: 'modaui-ai-tools', manifest: duplicated });
  assert.equal(result.ok, false);
  assert.equal(result.ok === false ? result.error : '', 'TOOL_ID_CONFLICT');
  assert.deepEqual(fake.apps[0].manifest, duplicated);
  assert.equal(fake.registryEntries.size, 0);
});

test('saving a valid manifest rebuilds the registry projection', async () => {
  const manifest = createModauiAiToolsManifest({ trialDays: 7 });
  const fake = createRegistryFake({
    apps: [{ id: 'app-1', appId: 'modaui-ai-tools', status: 'published', manifest: null }]
  });
  const result = await saveAppManifest(fake.db, { appId: 'modaui-ai-tools', manifest });
  assert.equal(result.ok, true);
  assert.equal(result.ok === true ? result.toolCount : 0, manifest.tools.length);
  assert.equal(fake.registryEntries.size, manifest.tools.length);
  assert.equal(fake.registryEntries.get('ai_tools_write_copy')?.appId, 'modaui-ai-tools');
});

test('app store gates follow the generated manifest runtime', () => {
  const manifest = createModauiAiToolsManifest({ trialDays: 7 });
  assert.deepEqual(
    describeAppStoreRuntime({
      appId: 'modaui-ai-tools',
      status: 'published',
      pricingType: 'free',
      version: '1.0.0',
      manifest
    }),
    { kind: 'manifest', appId: 'modaui-ai-tools', manifestVersion: '1', publishedToolCount: manifest.tools.length }
  );
  assert.equal(describeAppStoreRuntime({
    appId: 'modaui-ai-tools',
    status: 'published',
    pricingType: 'free',
    version: '1.0.0'
  }), null);
  assert.equal(pricingTypeAllowsTrial('free', 0), true);
  assert.equal(pricingTypeAllowsTrial('subscription', 7), true);
  assert.equal(pricingTypeAllowsTrial('subscription', 0), false);
  assert.equal(
    getAppStoreInstallationError({
      appId: 'modaui-ai-tools',
      status: 'published',
      pricingType: 'subscription',
      version: '1.0.0',
      manifest
    }, { requireRuntime: true, entitled: pricingTypeAllowsTrial('subscription', 7) }),
    null
  );
  assert.equal(
    getAppStoreInstallationError({
      appId: 'modaui-ai-tools',
      status: 'published',
      pricingType: 'free',
      version: '1.0.0',
      manifest: { ...manifest, tools: [] }
    }, { requireRuntime: true, entitled: true }),
    'APP_STORE_MANIFEST_INVALID'
  );
});

test('reinstalling an app does not extend an expired trial', async () => {

  const manifest = parseOrThrow(createModauiAiToolsManifest({ trialDays: 7 }));
  const fake = createRegistryFake({
    apps: [{
      id: 'app-1',
      appId: 'modaui-ai-tools',
      status: 'published',
      manifest,
      installations: [{ status: 'active' }]
    }]
  });
  await grantAppTools(fake.db, {
    merchantId: 'merchant-a',
    appId: 'modaui-ai-tools',
    manifest,
    now: new Date('2026-10-01T00:00:00.000Z')
  });
  await grantAppTools(fake.db, {
    merchantId: 'merchant-a',
    appId: 'modaui-ai-tools',
    manifest,
    now: new Date('2026-10-30T00:00:00.000Z')
  });
  assert.equal(
    fake.grants.get('merchant-a:ai_tools_write_copy')?.expiresAt?.toISOString(),
    '2026-10-08T00:00:00.000Z'
  );
});
