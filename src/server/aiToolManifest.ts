import type { ModaGptRiskLevel, ModaGptToolDefinition } from './modagptRuntime';

/**
 * MODAUI AI Tools 平台的 Tool Manifest v1。
 *
 * 设计文档：docs/engineering/architecture/MODaUI-AI-TOOLS-PLATFORM.md
 * 本文件只做纯逻辑（解析、校验、解析链），不依赖 Prisma，便于单元测试。
 * 数据库读写见 `aiToolRegistry.ts`。
 */

export const AI_TOOLS_APP_ID = 'modaui-ai-tools';
export const AI_TOOLS_MANIFEST_VERSION = '1';
export const AI_TOOLS_TRIAL_DAYS = 7;
export const AI_TOOLS_MAX_TOOLS = 50;
export const AI_TOOLS_MAX_MANIFEST_BYTES = 128 * 1024;

/** 容错开关：显式设置 false 时回退到「仅白名单原生应用」的旧行为。 */
export function isAiToolsManifestEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  const raw = env.AI_TOOLS_MANIFEST_ENABLED;
  if (typeof raw !== 'string') return true;
  const normalized = raw.trim().toLowerCase();
  return normalized !== 'false' && normalized !== '0' && normalized !== 'off';
}

/** 平台权限键白名单：Manifest 只能引用这里声明的权限。 */
export const aiToolPermissionKeys = [
  'ai.tools.use',
  'product.catalog.read',
  'product.import.draft',
  'product.publish',
  'product.publish.approve',
  'product.cost.view',
  'sales.order.create',
  'sales.quote.manage',
  'business.analytics.read',
  'purchase.manage',
  'return.manage',
  'employees.manage',
  'inventory.stock.read',
  'sales.summary.read',
  'warehouse.pick',
  'warehouse.review',
  'warehouse.pack',
  'warehouse.ship',
  'production.report',
  'production.view',
  'production.manage',
  'production.cost.view',
  'pricing.request',
  'pricing.approve',
  'brain.read',
  'brain.write'
] as const;

export type AiToolPermissionKey = (typeof aiToolPermissionKeys)[number];

export const aiToolCostUnits = ['call', 'image', 'second', 'token'] as const;
export type AiToolCostUnit = (typeof aiToolCostUnits)[number];

export const aiToolStatuses = ['draft', 'published', 'deprecated'] as const;
export type AiToolStatus = (typeof aiToolStatuses)[number];

export type AiToolAdapter =
  | { kind: 'native' }
  | { kind: 'http'; endpoint: string; authRef: string };

export type AiToolCost = { unit: AiToolCostUnit; credits: number };

export type AiToolManifestTool = {
  toolId: string;
  version: string;
  displayName: Record<string, string>;
  description: string;
  inputSchema: Record<string, unknown>;
  outputSchema: Record<string, unknown>;
  permission: string;
  riskLevel: ModaGptRiskLevel;
  requiresApproval: boolean;
  timeoutMs: number;
  retry: { maxAttempts: number; idempotent: boolean };
  industries: string[];
  employees: string[];
  cost: AiToolCost;
  adapter: AiToolAdapter;
  credentials: string[];
  dataScopes: string[];
  enabled: boolean;
  status: AiToolStatus;
  deprecation?: { sunsetAt: string; replacementToolId?: string };
};

export type AiToolManifest = {
  manifestVersion: typeof AI_TOOLS_MANIFEST_VERSION;
  appId: string;
  trialDays?: number;
  tools: AiToolManifestTool[];
};

export type AiToolManifestIssue = { path: string; code: string };

export type AiToolManifestParseResult =
  | { ok: true; manifest: AiToolManifest }
  | { ok: false; issues: AiToolManifestIssue[] };

const toolIdPattern = /^[a-z][a-z0-9_]{2,79}$/;
const versionPattern = /^\d+\.\d+\.\d+$/;
const permissionPattern = /^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)+$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readStringArray(value: unknown, path: string, issues: AiToolManifestIssue[]): string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.some(item => typeof item !== 'string')) {
    issues.push({ path, code: 'EXPECTED_STRING_ARRAY' });
    return [];
  }
  return value as string[];
}

function isObjectSchema(value: unknown): value is Record<string, unknown> {
  if (!isRecord(value)) return false;
  if (value.type !== 'object') return false;
  if (value.properties !== undefined && !isRecord(value.properties)) return false;
  if (value.required !== undefined
    && (!Array.isArray(value.required) || value.required.some(item => typeof item !== 'string'))) {
    return false;
  }
  return true;
}
export function parseAiToolManifest(
  raw: unknown,
  options: { expectedAppId?: string } = {}
): AiToolManifestParseResult {
  let value: unknown = raw;
  if (typeof raw === 'string') {
    try {
      value = JSON.parse(raw);
    } catch {
      return { ok: false, issues: [{ path: '', code: 'TOOL_MANIFEST_INVALID_JSON' }] };
    }
  }
  if (!isRecord(value)) {
    return { ok: false, issues: [{ path: '', code: 'TOOL_MANIFEST_NOT_OBJECT' }] };
  }
  let byteLength: number;
  try {
    byteLength = Buffer.byteLength(JSON.stringify(value) ?? '', 'utf8');
  } catch {
    byteLength = AI_TOOLS_MAX_MANIFEST_BYTES + 1;
  }
  if (byteLength > AI_TOOLS_MAX_MANIFEST_BYTES) {
    return { ok: false, issues: [{ path: '', code: 'TOOL_MANIFEST_TOO_LARGE' }] };
  }

  const issues: AiToolManifestIssue[] = [];
  if (value.manifestVersion !== AI_TOOLS_MANIFEST_VERSION) {
    issues.push({ path: 'manifestVersion', code: 'TOOL_MANIFEST_VERSION_UNSUPPORTED' });
  }
  const appId = value.appId;
  if (typeof appId !== 'string' || !appId.trim() || appId.length > 120) {
    issues.push({ path: 'appId', code: 'TOOL_MANIFEST_APP_ID_INVALID' });
  } else if (options.expectedAppId && appId !== options.expectedAppId) {
    issues.push({ path: 'appId', code: 'TOOL_MANIFEST_APP_ID_MISMATCH' });
  }
  if (value.trialDays !== undefined
    && (typeof value.trialDays !== 'number'
      || !Number.isInteger(value.trialDays)
      || value.trialDays < 0
      || value.trialDays > 90)) {
    issues.push({ path: 'trialDays', code: 'TOOL_MANIFEST_TRIAL_INVALID' });
  }

  const rawTools = value.tools;
  if (!Array.isArray(rawTools) || rawTools.length === 0) {
    issues.push({ path: 'tools', code: 'TOOL_MANIFEST_TOOLS_INVALID' });
    return { ok: false, issues };
  }
  if (rawTools.length > AI_TOOLS_MAX_TOOLS) {
    issues.push({ path: 'tools', code: 'TOOL_MANIFEST_TOO_MANY_TOOLS' });
  }

  const tools: AiToolManifestTool[] = [];
  const seenToolIds = new Set<string>();
  rawTools.forEach((rawTool, index) => {
    const path = `tools[${index}]`;
    if (!isRecord(rawTool)) {
      issues.push({ path, code: 'TOOL_NOT_OBJECT' });
      return;
    }
    const toolId = rawTool.toolId;
    if (typeof toolId !== 'string' || !toolIdPattern.test(toolId)) {
      issues.push({ path: `${path}.toolId`, code: 'TOOL_ID_INVALID' });
    } else if (seenToolIds.has(toolId)) {
      issues.push({ path: `${path}.toolId`, code: 'TOOL_ID_CONFLICT' });
    } else {
      seenToolIds.add(toolId);
    }

    const version = rawTool.version;
    if (typeof version !== 'string' || !versionPattern.test(version)) {
      issues.push({ path: `${path}.version`, code: 'TOOL_VERSION_INVALID' });
    }
    const displayName = rawTool.displayName;
    if (!isRecord(displayName) || Object.keys(displayName).length === 0
      || Object.values(displayName).some(item => typeof item !== 'string')) {
      issues.push({ path: `${path}.displayName`, code: 'TOOL_DISPLAY_NAME_INVALID' });
    }
    const description = rawTool.description;
    if (typeof description !== 'string' || !description.trim() || description.length > 400) {
      issues.push({ path: `${path}.description`, code: 'TOOL_DESCRIPTION_INVALID' });
    }

    if (!isObjectSchema(rawTool.inputSchema)) {
      issues.push({ path: `${path}.inputSchema`, code: 'TOOL_SCHEMA_INVALID' });
    }
    if (!isObjectSchema(rawTool.outputSchema)) {
      issues.push({ path: `${path}.outputSchema`, code: 'TOOL_SCHEMA_INVALID' });
    }

    const permission = rawTool.permission;
    if (typeof permission !== 'string'
      || !permissionPattern.test(permission)
      || !(aiToolPermissionKeys as readonly string[]).includes(permission)) {
      issues.push({ path: `${path}.permission`, code: 'TOOL_PERMISSION_INVALID' });
    }

    const riskLevel = rawTool.riskLevel;
    if (riskLevel !== 'LOW' && riskLevel !== 'MEDIUM' && riskLevel !== 'HIGH' && riskLevel !== 'CRITICAL') {
      issues.push({ path: `${path}.riskLevel`, code: 'TOOL_RISK_LEVEL_INVALID' });
    }
    const requiresApproval = rawTool.requiresApproval;
    if (typeof requiresApproval !== 'boolean') {
      issues.push({ path: `${path}.requiresApproval`, code: 'TOOL_APPROVAL_FLAG_INVALID' });
    } else if ((riskLevel === 'HIGH' || riskLevel === 'CRITICAL') && requiresApproval !== true) {
      issues.push({ path: `${path}.requiresApproval`, code: 'TOOL_APPROVAL_REQUIRED' });
    }

    const timeoutMs = rawTool.timeoutMs;
    if (typeof timeoutMs !== 'number' || !Number.isInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > 60_000) {
      issues.push({ path: `${path}.timeoutMs`, code: 'TOOL_TIMEOUT_INVALID' });
    }
    const retry = rawTool.retry;
    if (!isRecord(retry)
      || typeof retry.maxAttempts !== 'number'
      || !Number.isInteger(retry.maxAttempts)
      || retry.maxAttempts < 1
      || retry.maxAttempts > 3
      || typeof retry.idempotent !== 'boolean') {
      issues.push({ path: `${path}.retry`, code: 'TOOL_RETRY_INVALID' });
    } else if (retry.maxAttempts > 1 && retry.idempotent !== true) {
      issues.push({ path: `${path}.retry.idempotent`, code: 'TOOL_RETRY_NOT_IDEMPOTENT' });
    }

    const cost = rawTool.cost;
    if (!isRecord(cost)
      || typeof cost.credits !== 'number'
      || !Number.isInteger(cost.credits)
      || cost.credits < 0
      || typeof cost.unit !== 'string'
      || !(aiToolCostUnits as readonly string[]).includes(cost.unit)) {
      issues.push({ path: `${path}.cost`, code: 'TOOL_COST_INVALID' });
    }

    const adapter = rawTool.adapter;
    if (!isRecord(adapter) || (adapter.kind !== 'native' && adapter.kind !== 'http')) {
      issues.push({ path: `${path}.adapter`, code: 'TOOL_ADAPTER_INVALID' });
    } else if (adapter.kind === 'http') {
      if (typeof adapter.endpoint !== 'string' || !/^https:\/\//.test(adapter.endpoint)) {
        issues.push({ path: `${path}.adapter.endpoint`, code: 'TOOL_ADAPTER_ENDPOINT_INVALID' });
      }
      if (typeof adapter.authRef !== 'string' || !adapter.authRef.trim()) {
        issues.push({ path: `${path}.adapter.authRef`, code: 'TOOL_ADAPTER_AUTH_REQUIRED' });
      }
    }

    const status = rawTool.status;
    if (typeof status !== 'string' || !(aiToolStatuses as readonly string[]).includes(status)) {
      issues.push({ path: `${path}.status`, code: 'TOOL_STATUS_INVALID' });
    }
    if (rawTool.enabled !== undefined && typeof rawTool.enabled !== 'boolean') {
      issues.push({ path: `${path}.enabled`, code: 'TOOL_ENABLED_INVALID' });
    }
    if (status === 'deprecated') {
      const deprecation = rawTool.deprecation;
      if (!isRecord(deprecation)
        || typeof deprecation.sunsetAt !== 'string'
        || Number.isNaN(Date.parse(deprecation.sunsetAt))) {
        issues.push({ path: `${path}.deprecation`, code: 'TOOL_DEPRECATION_INVALID' });
      }
    }

    const industries = readStringArray(rawTool.industries, `${path}.industries`, issues);
    const employees = readStringArray(rawTool.employees, `${path}.employees`, issues);
    const credentials = readStringArray(rawTool.credentials, `${path}.credentials`, issues);
    const dataScopes = readStringArray(rawTool.dataScopes, `${path}.dataScopes`, issues);
    if (industries.length > 20 || employees.length > 20
      || credentials.length > 20 || dataScopes.length > 20) {
      issues.push({ path, code: 'TOOL_LIST_TOO_LONG' });
    }
    if (issues.length > 0) return;

    const deprecation = isRecord(rawTool.deprecation) ? rawTool.deprecation : null;
    const retryConfig = retry as { maxAttempts: number; idempotent: boolean };
    const costConfig = cost as { unit: AiToolCostUnit; credits: number };
    const adapterConfig = adapter as
      | { kind: 'native' }
      | { kind: 'http'; endpoint: string; authRef: string };
    tools.push({
      toolId: toolId as string,
      version: version as string,
      displayName: displayName as Record<string, string>,
      description: (description as string).trim(),
      inputSchema: rawTool.inputSchema as Record<string, unknown>,
      outputSchema: rawTool.outputSchema as Record<string, unknown>,
      permission: permission as string,
      riskLevel: riskLevel as ModaGptRiskLevel,
      requiresApproval: requiresApproval as boolean,
      timeoutMs: timeoutMs as number,
      retry: { maxAttempts: retryConfig.maxAttempts, idempotent: retryConfig.idempotent },
      industries,
      employees,
      cost: { unit: costConfig.unit, credits: costConfig.credits },
      adapter: adapterConfig.kind === 'native'
        ? { kind: 'native' }
        : { kind: 'http', endpoint: adapterConfig.endpoint, authRef: adapterConfig.authRef },
      credentials,
      dataScopes,
      enabled: rawTool.enabled !== false,
      status: status as AiToolStatus,
      ...(deprecation
        ? {
          deprecation: {
            sunsetAt: deprecation.sunsetAt as string,
            ...(typeof deprecation.replacementToolId === 'string'
              ? { replacementToolId: deprecation.replacementToolId }
              : {})
          }
        }
        : {})
    });
  });

  if (issues.length > 0) return { ok: false, issues };
  return {
    ok: true,
    manifest: {
      manifestVersion: AI_TOOLS_MANIFEST_VERSION,
      appId: appId as string,
      ...(typeof value.trialDays === 'number' ? { trialDays: value.trialDays as number } : {}),
      tools
    }
  };
}

export type AiToolDenialReason =
  | 'app_not_installed'
  | 'app_disabled'
  | 'tool_disabled'
  | 'tool_deprecated'
  | 'industry_mismatch'
  | 'employee_mismatch'
  | 'grant_missing'
  | 'grant_paused'
  | 'grant_expired'
  | 'permission_denied'
  | 'credential_missing';

export type AiToolGrantState = {
  toolId: string;
  status: string;
  expiresAt?: Date | null;
};

export type AiToolAppState = {
  appId: string;
  appStatus: string;
  installationStatus: string | null;
  manifest: AiToolManifest | null;
  grants: readonly AiToolGrantState[];
};

export type AiToolDenial = { toolId: string; appId: string; reason: AiToolDenialReason };

export type AiToolAccess = {
  manifestEnabled: boolean;
  /** 已通过安装 + 授权 + 权限 + 凭据校验的应用专属工具。 */
  allowedToolIds: string[];
  /** 由应用 Manifest 声明、但当前商家不可调用的工具；运行时必须剔除。 */
  blockedToolIds: string[];
  denied: AiToolDenial[];
  /** 当前商家已安装（installed/active）且发布中的应用。 */
  appIds: string[];
};

const usableInstallationStatuses = new Set(['installed', 'active']);

/**
 * 判定顺序（短路）：安装 → 应用发布 → 工具启用 → 行业 → 员工 → 商家授权 → 权限 → 凭据。
 * 只返回「应用 Manifest 声明过」的专属工具；核心工具（未在任何 Manifest 中声明）永不被拦截。
 */
export function resolveAiToolAccess(input: {
  apps: readonly AiToolAppState[];
  actorPermissions: readonly string[];
  agentId?: string | null;
  industry?: string | null;
  credentials?: readonly { credentialKey: string; status: string }[];
  now?: Date;
  manifestEnabled?: boolean;
}): AiToolAccess {
  const now = input.now ?? new Date();
  const manifestEnabled = input.manifestEnabled !== false;
  const allowedToolIds: string[] = [];
  const blockedToolIds: string[] = [];
  const denied: AiToolDenial[] = [];
  const appIds: string[] = [];
  if (!manifestEnabled) {
    return { manifestEnabled, allowedToolIds, blockedToolIds, denied, appIds };
  }
  const activeCredentialKeys = new Set(
    (input.credentials ?? [])
      .filter(credential => credential.status === 'active')
      .map(credential => credential.credentialKey)
  );

  for (const app of input.apps) {
    const manifest = app.manifest;
    if (!manifest || manifest.tools.length === 0) continue;
    if (usableInstallationStatuses.has(app.installationStatus ?? '')) appIds.push(app.appId);
    const denyAll = (reason: AiToolDenialReason) => {
      for (const tool of manifest.tools) {
        blockedToolIds.push(tool.toolId);
        denied.push({ toolId: tool.toolId, appId: app.appId, reason });
      }
    };
    if (app.appStatus !== 'published') {
      denyAll('app_disabled');
      continue;
    }
    if (!usableInstallationStatuses.has(app.installationStatus ?? '')) {
      // 有安装记录但状态为 disabled/paused 时属于「应用已停用」；完全没有安装记录才是「未安装」。
      denyAll(app.installationStatus ? 'app_disabled' : 'app_not_installed');
      continue;
    }
    for (const tool of manifest.tools) {
      const reason = evaluateAiTool({
        app,
        tool,
        actorPermissions: input.actorPermissions,
        agentId: input.agentId ?? null,
        industry: input.industry ?? null,
        activeCredentialKeys,
        now
      });
      if (reason) {
        blockedToolIds.push(tool.toolId);
        denied.push({ toolId: tool.toolId, appId: app.appId, reason });
      } else {
        allowedToolIds.push(tool.toolId);
      }
    }
  }
  return { manifestEnabled, allowedToolIds, blockedToolIds, denied, appIds };
}

/** 试用天数：Manifest 优先，缺省用平台默认 7 天；0 表示不发放试用。 */
export function readManifestTrialDays(
  manifest: AiToolManifest | null | undefined,
  fallback = AI_TOOLS_TRIAL_DAYS
): number {
  if (manifest && typeof manifest.trialDays === 'number') return manifest.trialDays;
  return fallback;
}

export function computeGrantExpiry(now: Date, trialDays: number): Date | null {
  if (!Number.isFinite(trialDays) || trialDays <= 0) return null;
  return new Date(now.getTime() + trialDays * 24 * 60 * 60 * 1000);
}

export type AiToolGrantPlanEntry = {
  toolId: string;
  appId: string;
  status: 'active';
  source: 'app-install';
  grantedAt: Date;
  expiresAt: Date | null;
};

/** 安装时生成的授权清单；只包含 published 工具，draft/deprecated 不发放。 */
export function planAppToolGrants(input: {
  appId: string;
  manifest: AiToolManifest;
  trialDays: number;
  now?: Date;
}): AiToolGrantPlanEntry[] {
  const now = input.now ?? new Date();
  const expiresAt = computeGrantExpiry(now, input.trialDays);
  return input.manifest.tools
    .filter(tool => tool.status === 'published')
    .map(tool => ({
      toolId: tool.toolId,
      appId: input.appId,
      status: 'active' as const,
      source: 'app-install' as const,
      grantedAt: now,
      expiresAt
    }));
}

/** 从工具定义里剔除被拒绝的应用专属工具；未在任何 Manifest 中声明的工具保持可用。 */
export function removeBlockedToolDefinitions<T extends ModaGptToolDefinition>(
  definitions: readonly T[],
  blockedToolIds: readonly string[]
): T[] {
  if (blockedToolIds.length === 0) return [...definitions];
  const blocked = new Set(blockedToolIds);
  return definitions.filter(definition => !blocked.has(definition.name));
}

/** 管理后台展示所需的工具摘要键，不含内部凭据与实现细节。 */
export function summarizeAiToolManifestTool(tool: AiToolManifestTool) {
  return {
    toolId: tool.toolId,
    version: tool.version,
    displayName: tool.displayName,
    description: tool.description,
    permission: tool.permission,
    riskLevel: tool.riskLevel,
    requiresApproval: tool.requiresApproval,
    cost: tool.cost,
    industries: tool.industries,
    employees: tool.employees,
    adapterKind: tool.adapter.kind,
    credentialKeys: tool.credentials,
    status: tool.status,
    enabled: tool.enabled
  };
}

/** 单个工具的门禁判定；返回 null 表示可调用。核心工具不经过本函数。 */
export function evaluateAiTool(input: {
  app: AiToolAppState;
  tool: AiToolManifestTool;
  actorPermissions: readonly string[];
  agentId: string | null;
  industry: string | null;
  activeCredentialKeys: ReadonlySet<string>;
  now: Date;
}): AiToolDenialReason | null {
  const { app, tool } = input;
  if (tool.status !== 'published') return 'tool_deprecated';
  if (!tool.enabled) return 'tool_disabled';
  if (tool.industries.length > 0 && (!input.industry || !tool.industries.includes(input.industry))) {
    return 'industry_mismatch';
  }
  if (tool.employees.length > 0 && (!input.agentId || !tool.employees.includes(input.agentId))) {
    return 'employee_mismatch';
  }
  const grant = app.grants.find(candidate => candidate.toolId === tool.toolId);
  if (!grant || grant.status === 'revoked') return 'grant_missing';
  if (grant.status === 'paused') return 'grant_paused';
  if (grant.status !== 'active') return 'grant_missing';
  if (grant.expiresAt && grant.expiresAt.getTime() <= input.now.getTime()) return 'grant_expired';
  if (!input.actorPermissions.includes(tool.permission)) return 'permission_denied';
  if (tool.credentials.some(key => !input.activeCredentialKeys.has(key))) return 'credential_missing';
  return null;
}
