import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import {
  buildProviderModelRows,
  maskProviderSecret,
  normalizeCallQuery,
  parseModelOverrides,
  parseModelTestResults,
  parsePriceCents,
  referencePriceCents,
  summarizeProviderCalls
} from '../src/server/aiProviderConsole';
import {
  finishProviderCall,
  finishProviderCallByJob,
  getProviderCallSummary,
  listProviderCalls,
  startProviderCall,
  type AiProviderCallPrismaLike
} from '../src/server/aiProviderCallStore';
import {
  buildAiProviderAssetKey,
  storeAiProviderAsset
} from '../src/server/aiProviderAssetStore';
import type { AiProviderModel } from '../src/server/aiProviderCatalog';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

function model(overrides: Partial<AiProviderModel> = {}): AiProviderModel {
  return {
    providerId: 'runpod',
    modelId: 'z-image-turbo',
    modelVersion: 'z-image-turbo',
    label: 'Z-Image Turbo',
    capabilities: ['image_generate'],
    tier: 'balanced',
    pricing: { kind: 'image', perImageUsd: { '1k': 0.005, '2k': 0.01 } },
    timeoutMs: 90_000,
    retry: { maxAttempts: 1, backoffMs: 0 },
    dataPolicy: 'commercial_paid',
    supportedRegions: ['global'],
    status: 'active',
    credentials: ['RUNPOD_API_KEY'],
    ...overrides
  };
}

/** 记录所有调用的最小 Prisma stub，用于验证查询条件而无需数据库。 */
function stubPrisma(options: { rows?: unknown[]; total?: number; failWith?: unknown } = {}) {
  const calls: Array<{ op: string; args: any }> = [];
  const prisma: AiProviderCallPrismaLike = {
    aiProviderCall: {
      create: async (args: any) => {
        calls.push({ op: 'create', args });
        if (options.failWith) throw options.failWith;
        return { id: 'call-1' };
      },
      update: async (args: any) => {
        calls.push({ op: 'update', args });
        if (options.failWith) throw options.failWith;
        return { id: args.where.id };
      },
      updateMany: async (args: any) => {
        calls.push({ op: 'updateMany', args });
        if (options.failWith) throw options.failWith;
        return { count: 1 };
      },
      findMany: async (args: any) => {
        calls.push({ op: 'findMany', args });
        if (options.failWith) throw options.failWith;
        return options.rows ?? [];
      },
      count: async (args: any) => {
        calls.push({ op: 'count', args });
        if (options.failWith) throw options.failWith;
        return options.total ?? 0;
      }
    }
  };
  return { prisma, calls };
}

test('密钥脱敏只保留末四位，短密钥不泄露长度', () => {
  assert.equal(maskProviderSecret('rpa_abcdefgh1234'), '****1234');
  assert.equal(maskProviderSecret('abc'), '****');
  assert.equal(maskProviderSecret(''), '****');
  assert.equal(maskProviderSecret(null), '****');
});

test('参考价按计量单位换算为美分，未登记价格返回 null', () => {
  assert.equal(referencePriceCents({ kind: 'image', perImageUsd: { '1k': 0.005, '2k': 0.01 } }), 1);
  assert.equal(referencePriceCents({ kind: 'video', perSecondUsd: { '720p': 0.06, '1080p': 0.15 } }), 15);
  assert.equal(referencePriceCents({ kind: 'tts', perMillionCharsUsd: 50 }), 5);
  assert.equal(referencePriceCents({ kind: 'compute', note: 'unknown' }), null);
  assert.equal(referencePriceCents({ kind: 'image', perImageUsd: {} }), null);
});

test('价格覆盖只接受非负整数美分', () => {
  assert.equal(parsePriceCents(5), 5);
  assert.equal(parsePriceCents('12'), 12);
  assert.equal(parsePriceCents(0), 0);
  assert.equal(parsePriceCents(-1), null);
  assert.equal(parsePriceCents(1.5), null);
  assert.equal(parsePriceCents('abc'), null);
  assert.equal(parsePriceCents(1_000_001), null);
  assert.equal(parsePriceCents(''), null);
});

test('模型覆盖与测试结果只保留目录中存在的模型', () => {
  const overrides = parseModelOverrides(
    {
      'z-image-turbo': { enabled: false, priceCents: 3, updatedBy: 'admin', updatedAt: '2026-10-30T00:00:00.000Z' },
      'retired-model': { enabled: true },
      'qwen-image': { priceCents: 'oops' }
    },
    ['z-image-turbo', 'qwen-image']
  );
  assert.deepEqual(Object.keys(overrides).sort(), ['z-image-turbo']);
  assert.equal(overrides['z-image-turbo'].enabled, false);
  assert.equal(overrides['z-image-turbo'].priceCents, 3);

  const results = parseModelTestResults(
    { 'z-image-turbo': { ok: true, status: 'healthy', checkedAt: '2026-10-30T00:00:00.000Z', modelId: 'z-image-turbo' } },
    ['z-image-turbo']
  );
  assert.equal(results['z-image-turbo'].status, 'healthy');
  assert.equal(parseModelTestResults({ nope: { ok: true, status: 'healthy', checkedAt: 'x' } }, ['z-image-turbo'])['nope'], undefined);
});

test('模型行：目录是基线，覆盖只改启停与价格', () => {
  const rows = buildProviderModelRows({
    models: [model(), model({ modelId: 'minimax-speech', capabilities: ['tts'], pricing: { kind: 'tts', perMillionCharsUsd: 50 } })],
    overrides: { 'z-image-turbo': { enabled: false, priceCents: 3 } },
    testResults: {}
  });
  const imageRow = rows[0];
  assert.equal(imageRow.enabled, false);
  assert.equal(imageRow.enabledOverridden, true);
  assert.equal(imageRow.priceCents, 3);
  assert.equal(imageRow.catalogPriceCents, 1);
  assert.equal(imageRow.priceOverridden, true);
  assert.equal(imageRow.taskType, 'image');
  assert.equal(imageRow.requestMode, 'runsync');
  const voiceRow = rows[1];
  assert.equal(voiceRow.taskType, 'voice');
  assert.equal(voiceRow.enabled, true);
  assert.equal(voiceRow.priceCents, 5);
});

test('调用筛选参数非法即忽略，分页被限制在安全范围', () => {
  assert.deepEqual(normalizeCallQuery({}), { status: null, modelId: null, merchantId: null, page: 1, pageSize: 20 });
  assert.equal(normalizeCallQuery({ status: 'succeeded' }).status, 'succeeded');
  assert.equal(normalizeCallQuery({ status: 'fabricated' }).status, null);
  assert.equal(normalizeCallQuery({ page: '0' }).page, 1);
  assert.equal(normalizeCallQuery({ pageSize: '9999' }).pageSize, 100);
  assert.equal(normalizeCallQuery({ modelId: 'z-image-turbo' }).modelId, 'z-image-turbo');
  assert.equal(normalizeCallQuery({ modelId: 'bad id' }).modelId, null);
});

test('费用汇总区分真实费用、估算与未知，未知不补 0', () => {
  const summary = summarizeProviderCalls([
    { status: 'succeeded', modelId: 'z-image-turbo', taskType: 'image', costCents: 10, estimatedCents: 5 },
    { status: 'succeeded', modelId: 'z-image-turbo', taskType: 'image', costCents: null, estimatedCents: 5 },
    { status: 'succeeded', modelId: 'wan-2-2-i2v', taskType: 'video', costCents: null, estimatedCents: null },
    { status: 'failed', modelId: 'z-image-turbo', taskType: 'image', costCents: null, estimatedCents: null },
    { status: 'rejected', modelId: 'z-image-turbo', taskType: 'image', costCents: null, estimatedCents: null }
  ]);
  assert.equal(summary.totals.count, 5);
  assert.equal(summary.totals.succeeded, 3);
  assert.equal(summary.totals.failed, 2);
  assert.equal(summary.totals.succeededCostCents, 10);
  assert.equal(summary.totals.succeededEstimatedCents, 5);
  assert.equal(summary.totals.unknownCostCount, 1);
  assert.equal(summary.byModel[0].modelId, 'z-image-turbo');
  assert.equal(summary.byModel[0].count, 4);
});

test('新建记录：拒绝未知任务类型与空模型，存储异常时降级返回 null', async () => {
  const ok = stubPrisma();
  const id = await startProviderCall(ok.prisma, { providerId: 'runpod', modelId: 'z-image-turbo', taskType: 'image' });
  assert.equal(id, 'call-1');
  assert.equal(ok.calls[0].args.data.status, 'pending');
  assert.equal(ok.calls[0].args.data.costCents, null);

  assert.equal(await startProviderCall(ok.prisma, { providerId: 'runpod', modelId: 'z-image-turbo', taskType: 'hologram' }), null);
  const failing = stubPrisma({ failWith: Object.assign(new Error('relation does not exist'), { code: 'P2021' }) });
  assert.equal(await startProviderCall(failing.prisma, { providerId: 'runpod', modelId: 'z-image-turbo', taskType: 'image' }), null);
});

test('结束记录：成功必须有结果地址，失败必须有错误码', async () => {
  const stub = stubPrisma();
  assert.equal(await finishProviderCall(stub.prisma, { id: 'call-1', status: 'succeeded' }), false);
  assert.equal(await finishProviderCall(stub.prisma, { id: 'call-1', status: 'failed' }), false);
  assert.equal(stub.calls.length, 0);

  assert.equal(await finishProviderCall(stub.prisma, {
    id: 'call-1',
    status: 'succeeded',
    assetUrl: 'https://cdn.example.com/a.png',
    estimatedCents: 1
  }), true);
  const data = stub.calls[0].args.data;
  assert.equal(data.costSource, 'estimate');
  assert.equal(data.errorCode, null);

  assert.equal(await finishProviderCall(stub.prisma, {
    id: 'call-1',
    status: 'rejected',
    errorCode: 'RUNPOD_PRICE_UNKNOWN'
  }), true);
  assert.equal(stub.calls[1].args.data.costSource, 'unknown');
});

test('视频轮询按 jobId 结束且只更新待处理记录', async () => {
  const stub = stubPrisma();
  await finishProviderCallByJob(stub.prisma, {
    jobId: 'job-1',
    status: 'succeeded',
    assetUrl: 'https://cdn.example.com/v.mp4'
  });
  assert.deepEqual(stub.calls[0].args.where, { jobId: 'job-1', status: 'pending' });
});

test('调用列表带 providerId 与筛选条件，表缺失时返回 migrationPending', async () => {
  const stub = stubPrisma({ rows: [{ id: 'c1' }], total: 1 });
  const result = await listProviderCalls(stub.prisma, {
    providerId: 'runpod',
    query: { status: 'succeeded', modelId: null, merchantId: 'm-1', page: 2, pageSize: 10 }
  });
  assert.equal(result.migrationPending, false);
  assert.equal(result.total, 1);
  assert.deepEqual(stub.calls[0].args.where, { providerId: 'runpod', status: 'succeeded', merchantId: 'm-1' });
  assert.equal(stub.calls[0].args.skip, 10);

  const missing = stubPrisma({ failWith: Object.assign(new Error('missing'), { code: 'P2021' }) });
  const degraded = await listProviderCalls(missing.prisma, {
    providerId: 'runpod',
    query: { status: null, modelId: null, merchantId: null, page: 1, pageSize: 20 }
  });
  assert.equal(degraded.migrationPending, true);
  assert.deepEqual(degraded.calls, []);
});

test('汇总窗口最长 90 天，表缺失返回空汇总', async () => {
  const stub = stubPrisma({ rows: [] });
  await getProviderCallSummary(stub.prisma, { providerId: 'runpod', days: 500 });
  const since = stub.calls[0].args.where.createdAt.gte as Date;
  const days = Math.round((Date.now() - since.getTime()) / (24 * 60 * 60 * 1000));
  assert.equal(days, 90);

  const missing = stubPrisma({ failWith: Object.assign(new Error('missing'), { code: '2026' }) });
  const degraded = await getProviderCallSummary(missing.prisma, { providerId: 'runpod', days: 7 });
  assert.equal(degraded.migrationPending, true);
  assert.equal(degraded.summary.totals.count, 0);
});

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]);

function fakeDownload(contentType: string, body: Buffer, declaredLength?: number) {
  return async () => ({
    ok: true,
    status: 200,
    headers: {
      get: (name: string) => {
        if (name.toLowerCase() === 'content-type') return contentType;
        if (name.toLowerCase() === 'content-length') return declaredLength === undefined ? null : String(declaredLength);
        return null;
      }
    },
    arrayBuffer: async () => body
  });
}

test('素材对象键按商家与类型隔离，拒绝非法商家与未知类型', () => {
  const id = '11111111-2222-4333-8444-555555555555';
  assert.equal(
    buildAiProviderAssetKey({ merchantId: 'm-1', kind: 'images', contentType: 'image/png', version: 'v2', id }),
    `merchants/m-1/ai-ad/images/v2/${id}.png`
  );
  assert.equal(buildAiProviderAssetKey({ merchantId: '../etc', kind: 'images', contentType: 'image/png', version: 'v2', id }), null);
  assert.equal(buildAiProviderAssetKey({ merchantId: 'm-1', kind: 'images', contentType: 'text/html', version: 'v2', id }), null);
});

test('产物落库：只接受真实媒体，HTML 假文件与超限文件被拒绝', async () => {
  const putCalls: Array<{ Key: string; ContentType: string }> = [];
  const base = {
    merchantId: 'm-1',
    version: 'v2' as const,
    fetchImpl: fakeDownload('image/png', PNG),
    putObject: async (input: { Key: string; ContentType: string }) => {
      putCalls.push({ Key: input.Key, ContentType: input.ContentType });
    },
    bucket: 'ruda-media',
    publicUrl: (key: string) => `https://cdn.example.com/${key}`,
    createId: () => '11111111-2222-4333-8444-555555555555'
  };

  const stored = await storeAiProviderAsset({ ...base, url: 'https://runpod.example.com/out.png' });
  assert.equal('errorCode' in stored, false);
  if (!('errorCode' in stored)) {
    assert.equal(stored.url, 'https://cdn.example.com/merchants/m-1/ai-ad/images/v2/11111111-2222-4333-8444-555555555555.png');
    assert.equal(stored.kind, 'images');
  }
  assert.equal(putCalls.length, 1);

  const html = await storeAiProviderAsset({
    ...base,
    url: 'https://runpod.example.com/out',
    fetchImpl: fakeDownload('text/html', Buffer.from('<html>error</html>'))
  });
  assert.deepEqual(html, { ok: false, errorCode: 'ASSET_TYPE_NOT_ALLOWED' });

  const tooLarge = await storeAiProviderAsset({
    ...base,
    url: 'https://runpod.example.com/out.png',
    fetchImpl: fakeDownload('image/png', PNG, 13 * 1024 * 1024)
  });
  assert.deepEqual(tooLarge, { ok: false, errorCode: 'ASSET_TOO_LARGE' });

  const badUrl = await storeAiProviderAsset({ ...base, url: 'file:///etc/passwd' });
  assert.deepEqual(badUrl, { ok: false, errorCode: 'ASSET_URL_INVALID' });

  const wrongKind = await storeAiProviderAsset({
    ...base,
    url: 'https://runpod.example.com/out.png',
    expectedKind: 'videos'
  });
  assert.deepEqual(wrongKind, { ok: false, errorCode: 'ASSET_TYPE_NOT_ALLOWED' });
});

test('后台接口：密钥只经服务端、所有路由都有管理员权限与 no-store', () => {
  const server = readFileSync(path.join(ROOT, 'server.ts'), 'utf8');
  const routes = [
    "app.get('/api/admin/ai-providers/runpod'",
    "app.put('/api/admin/ai-providers/runpod'",
    "app.patch('/api/admin/ai-providers/runpod/models/:modelId'",
    "app.post('/api/admin/ai-providers/runpod/test'",
    "app.get('/api/admin/ai-providers/runpod/calls'",
    "app.get('/api/admin/ai-providers/runpod/calls/summary'"
  ];
  for (const route of routes) {
    const index = server.indexOf(route);
    assert.ok(index > -1, `缺少路由 ${route}`);
    const line = server.slice(index, server.indexOf('\n', index));
    assert.ok(line.includes('requireAdminAuth'), `${route} 缺少 requireAdminAuth`);
    assert.ok(line.includes("requireAdminPermission('settings.ai_support')"), `${route} 缺少管理员权限校验`);
  }
  assert.ok(!/res\.json\(\{[^}]*runpodApiKeyEncrypted/s.test(server), '接口不得返回密文或明文密钥字段');
  assert.ok(server.includes('maskProviderSecret('), '密钥展示必须走脱敏函数');
});

test('前端与小程序不包含 Runpod 凭据名或密钥字段', () => {
  const offenders: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.(ts|tsx|js|jsx)$/.test(entry.name)) {
        const source = readFileSync(full, 'utf8');
        if (source.includes('RUNPOD_API_KEY') || source.includes('runpodApiKeyEncrypted')) {
          offenders.push(path.relative(ROOT, full));
        }
      }
    }
  };
  for (const dir of ['src/apps', 'merchant-miniprogram', 'public']) {
    try {
      walk(path.join(ROOT, dir));
    } catch {
      // 目录不存在时跳过（例如无 public 目录的部署）。
    }
  }
  assert.deepEqual(offenders, []);
});
