import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import {
  RUNPOD_DEFAULT_BASE_URL,
  RunpodError,
  estimateRunpodRequestCost,
  extractRunpodMediaUrls,
  listRunpodModelIds,
  readRunpodConfig,
  runpodHealth,
  runpodRun,
  runpodRunsync,
  runpodStatus,
  runpodWaitForJob,
  type RunpodFetch
} from '../src/server/runpodGateway';

const CONFIG = { apiKey: 'test-key', baseUrl: RUNPOD_DEFAULT_BASE_URL, configured: true };

type RecordedCall = { url: string; method: string; headers: Record<string, string>; body?: string };

function fakeFetch(
  responder: (call: RecordedCall) => { status: number; body: unknown; headers?: Record<string, string> }
) {
  const calls: RecordedCall[] = [];
  const fetchImpl: RunpodFetch = async (url, init) => {
    const call: RecordedCall = { url, method: init.method, headers: init.headers, body: init.body };
    calls.push(call);
    const reply = responder(call);
    return {
      ok: reply.status >= 200 && reply.status < 300,
      status: reply.status,
      headers: { get: (name: string) => reply.headers?.[name.toLowerCase()] ?? null },
      text: async () => JSON.stringify(reply.body)
    };
  };
  return { fetchImpl, calls };
}

async function expectRunpodError(promise: Promise<unknown>, code: string): Promise<RunpodError> {
  try {
    await promise;
  } catch (error) {
    assert.ok(error instanceof RunpodError, `expected RunpodError, got ${String(error)}`);
    assert.equal(error.code, code);
    return error;
  }
  throw new Error(`expected ${code}, but the call resolved`);
}

test('runpod: 目录登记了第一批公共端点 slug', () => {
  const ids = listRunpodModelIds();
  for (const slug of ['z-image-turbo', 'qwen-image', 'wan-2-6-i2v', 'wan-2-2-i2v', 'wan-2-1-i2v', 'minimax-speech']) {
    assert.ok(ids.includes(slug), `missing slug ${slug}`);
  }
  assert.equal(ids.length, 6);
});

test('runpod: 环境变量读取只判断存在性，base 去掉尾斜杠', () => {
  assert.equal(readRunpodConfig({}).configured, false);
  assert.equal(readRunpodConfig({}).apiKey, null);
  assert.equal(readRunpodConfig({}).baseUrl, RUNPOD_DEFAULT_BASE_URL);
  const custom = readRunpodConfig({ RUNPOD_API_KEY: '  abc  ', RUNPOD_API_BASE_URL: 'http://local:9999///' });
  assert.equal(custom.configured, true);
  assert.equal(custom.apiKey, 'abc');
  assert.equal(custom.baseUrl, 'http://local:9999');
});

test('runpod: 缺密钥时不发请求，直接 RUNPOD_NOT_CONFIGURED', async () => {
  const { fetchImpl, calls } = fakeFetch(() => ({ status: 200, body: {} }));
  await expectRunpodError(
    runpodRunsync({
      modelId: 'z-image-turbo',
      input: { prompt: 'x' },
      context: { config: readRunpodConfig({}), fetchImpl }
    }),
    'RUNPOD_NOT_CONFIGURED'
  );
  assert.equal(calls.length, 0);
});

test('runpod: 白名单外 slug 在发请求前被拒绝', async () => {
  const { fetchImpl, calls } = fakeFetch(() => ({ status: 200, body: {} }));
  await expectRunpodError(
    runpodRunsync({ modelId: 'some-other-endpoint', input: {}, context: { config: CONFIG, fetchImpl } }),
    'RUNPOD_MODEL_NOT_ALLOWED'
  );
  await expectRunpodError(
    runpodRun({ modelId: 'gpt-transcribe', input: {}, context: { config: CONFIG, fetchImpl } }),
    'RUNPOD_MODEL_NOT_ALLOWED'
  );
  assert.equal(calls.length, 0);
});

test('runpod: 媒体链接提取去重且保持顺序', () => {
  const urls = extractRunpodMediaUrls({
    output: {
      video_url: 'https://cdn.example.com/v.mp4',
      nested: [{ audio: 'https://cdn.example.com/a.mp3' }, 'not-a-url']
    },
    echo: 'https://cdn.example.com/v.mp4'
  });
  assert.deepEqual(urls, ['https://cdn.example.com/v.mp4', 'https://cdn.example.com/a.mp3']);
  assert.deepEqual(extractRunpodMediaUrls(undefined), []);
});

test('runpod: runsync 成功时带上鉴权头、只发 input 包裹体，并提取媒体链接', async () => {
  const { fetchImpl, calls } = fakeFetch(() => ({
    status: 200,
    body: {
      id: 'job-1',
      status: 'COMPLETED',
      delayTime: 120,
      executionTime: 2300,
      output: {
        images: ['https://cdn.example.com/a.png', 'https://cdn.example.com/b.png', 'https://cdn.example.com/a.png']
      }
    }
  }));
  const result = await runpodRunsync({
    modelId: 'z-image-turbo',
    input: { prompt: '棚拍柔光商品背景', size: '1024*1024' },
    context: { config: CONFIG, fetchImpl }
  });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://api.runpod.ai/v2/z-image-turbo/runsync');
  assert.equal(calls[0].method, 'POST');
  assert.equal(calls[0].headers.Authorization, 'Bearer test-key');
  assert.deepEqual(JSON.parse(calls[0].body ?? '{}'), {
    input: { prompt: '棚拍柔光商品背景', size: '1024*1024' }
  });
  assert.deepEqual(result.mediaUrls, ['https://cdn.example.com/a.png', 'https://cdn.example.com/b.png']);
  assert.equal(result.delayTimeMs, 120);
  assert.equal(result.executionTimeMs, 2300);
});

test('runpod: HTTP 错误映射为稳定错误码', async () => {
  const cases: Array<[number, string, Record<string, string>?]> = [
    [400, 'RUNPOD_INVALID_INPUT'],
    [401, 'RUNPOD_UNAUTHORIZED'],
    [403, 'RUNPOD_UNAUTHORIZED'],
    [429, 'RUNPOD_RATE_LIMITED', { 'retry-after': '2' }],
    [500, 'RUNPOD_UPSTREAM_ERROR'],
    [503, 'RUNPOD_UPSTREAM_ERROR']
  ];
  for (const [status, code, headers] of cases) {
    const { fetchImpl } = fakeFetch(() => ({ status, body: { error: 'boom' }, headers }));
    const error = await expectRunpodError(
      runpodRunsync({ modelId: 'z-image-turbo', input: { prompt: 'x' }, context: { config: CONFIG, fetchImpl } }),
      code
    );
    assert.equal(error.httpStatus, status);
    if (status === 429) assert.equal(error.retryAfterMs, 2000);
    assert.ok(!String(error.message).includes('test-key'), '错误信息不得包含密钥');
  }
});

test('runpod: 完成但没有媒体链接时报 RUNPOD_OUTPUT_INVALID', async () => {
  const { fetchImpl } = fakeFetch(() => ({
    status: 200,
    body: { id: 'job-2', status: 'COMPLETED', output: { detail: 'no url here' } }
  }));
  await expectRunpodError(
    runpodRunsync({ modelId: 'z-image-turbo', input: { prompt: 'x' }, context: { config: CONFIG, fetchImpl } }),
    'RUNPOD_OUTPUT_INVALID'
  );
});

test('runpod: 内联 base64 输出被明确拒绝，不当成 URL 使用', async () => {
  const { fetchImpl } = fakeFetch(() => ({
    status: 200,
    body: { id: 'job-3', status: 'COMPLETED', output: { image: 'data:image/png;base64,AAAA' } }
  }));
  await expectRunpodError(
    runpodRunsync({ modelId: 'z-image-turbo', input: { prompt: 'x' }, context: { config: CONFIG, fetchImpl } }),
    'RUNPOD_OUTPUT_INVALID'
  );
});

test('runpod: runsync 被排队时自动转轮询并最终返回结果', async () => {
  let pollCount = 0;
  const { fetchImpl, calls } = fakeFetch(call => {
    if (call.url.endsWith('/runsync')) {
      return { status: 200, body: { id: 'job-4', status: 'IN_QUEUE' } };
    }
    pollCount += 1;
    return {
      status: 200,
      body: pollCount === 1
        ? { id: 'job-4', status: 'IN_PROGRESS' }
        : { id: 'job-4', status: 'COMPLETED', output: { image_url: 'https://cdn.example.com/out.png' } }
    };
  });
  const result = await runpodRunsync({
    modelId: 'z-image-turbo',
    input: { prompt: 'x' },
    context: { config: CONFIG, fetchImpl }
  });
  assert.deepEqual(result.mediaUrls, ['https://cdn.example.com/out.png']);
  assert.equal(calls[0].url, 'https://api.runpod.ai/v2/z-image-turbo/runsync');
  assert.equal(calls[1].url, 'https://api.runpod.ai/v2/z-image-turbo/status/job-4');
  assert.equal(calls[1].method, 'GET');
  assert.equal(pollCount, 2);
});

test('runpod: 视频走 run 提交 + status 轮询到完成', async () => {
  const { fetchImpl, calls } = fakeFetch(call => {
    if (call.url.endsWith('/run')) {
      return { status: 200, body: { id: 'job-5', status: 'IN_QUEUE' } };
    }
    return {
      status: 200,
      body: {
        id: 'job-5',
        status: 'COMPLETED',
        output: { video_url: 'https://cdn.example.com/clip.mp4' }
      }
    };
  });
  const handle = await runpodRun({
    modelId: 'wan-2-6-i2v',
    input: { prompt: '商品 5 秒动态广告镜头', image: 'https://cdn.example.com/p.jpg', duration: 5 },
    context: { config: CONFIG, fetchImpl }
  });
  assert.equal(handle.jobId, 'job-5');
  assert.equal(handle.status, 'IN_QUEUE');

  const status = await runpodStatus({ modelId: 'wan-2-6-i2v', jobId: 'job-5', context: { config: CONFIG, fetchImpl } });
  assert.equal(status.status, 'COMPLETED');
  assert.deepEqual(status.result?.mediaUrls, ['https://cdn.example.com/clip.mp4']);
  assert.equal(calls[0].url, 'https://api.runpod.ai/v2/wan-2-6-i2v/run');
  assert.equal(calls[1].url, 'https://api.runpod.ai/v2/wan-2-6-i2v/status/job-5');
});

test('runpod: 轮询在两次查询后完成', async () => {
  let clock = 0;
  let poll = 0;
  const { fetchImpl } = fakeFetch(() => {
    poll += 1;
    return {
      status: 200,
      body: poll < 2
        ? { id: 'job-6', status: 'IN_PROGRESS' }
        : { id: 'job-6', status: 'COMPLETED', output: ['https://cdn.example.com/ok.mp4'] }
    };
  });
  const result = await runpodWaitForJob({
    modelId: 'wan-2-2-i2v',
    jobId: 'job-6',
    context: { config: CONFIG, fetchImpl },
    pollIntervalMs: 1000,
    deadlineMs: 10_000,
    sleepImpl: async ms => { clock += ms; },
    nowImpl: () => clock
  });
  assert.deepEqual(result.mediaUrls, ['https://cdn.example.com/ok.mp4']);
  assert.equal(poll, 2);
});

test('runpod: 轮询超过截止时间报 RUNPOD_TIMEOUT 并带 jobId', async () => {
  let clock = 0;
  const { fetchImpl, calls } = fakeFetch(() => ({ status: 200, body: { id: 'job-7', status: 'IN_PROGRESS' } }));
  const error = await expectRunpodError(
    runpodWaitForJob({
      modelId: 'wan-2-2-i2v',
      jobId: 'job-7',
      context: { config: CONFIG, fetchImpl },
      pollIntervalMs: 1000,
      deadlineMs: 3000,
      sleepImpl: async ms => { clock += ms; },
      nowImpl: () => clock
    }),
    'RUNPOD_TIMEOUT'
  );
  assert.equal(error.jobId, 'job-7');
  assert.ok(calls.length >= 2);
});

test('runpod: 供应商返回 FAILED 时报 RUNPOD_JOB_FAILED', async () => {
  const { fetchImpl } = fakeFetch(() => ({
    status: 200,
    body: { id: 'job-8', status: 'FAILED', error: 'CUDA out of memory' }
  }));
  const error = await expectRunpodError(
    runpodStatus({ modelId: 'wan-2-6-i2v', jobId: 'job-8', context: { config: CONFIG, fetchImpl } }),
    'RUNPOD_JOB_FAILED'
  );
  assert.match(String(error.message), /CUDA/);
});

test('runpod: run 没返回 jobId 时报 RUNPOD_OUTPUT_INVALID', async () => {
  const { fetchImpl } = fakeFetch(() => ({ status: 200, body: { status: 'IN_QUEUE' } }));
  await expectRunpodError(
    runpodRun({ modelId: 'wan-2-6-i2v', input: {}, context: { config: CONFIG, fetchImpl } }),
    'RUNPOD_OUTPUT_INVALID'
  );
});

test('runpod: 费用守门按目录单价计算', () => {
  const image = estimateRunpodRequestCost({
    modelId: 'z-image-turbo',
    usage: { kind: 'image', count: 2, resolutionKey: '1k' }
  });
  assert.equal(image.ok, true);
  assert.equal(image.ok && Number(image.usd.toFixed(3)), 0.01);

  const video720 = estimateRunpodRequestCost({
    modelId: 'wan-2-6-i2v',
    usage: { kind: 'video', seconds: 5, resolutionKey: '720p' }
  });
  assert.equal(video720.ok && Number(video720.usd.toFixed(2)), 0.5);

  const video1080 = estimateRunpodRequestCost({
    modelId: 'wan-2-6-i2v',
    usage: { kind: 'video', seconds: 5, resolutionKey: '1080p' }
  });
  assert.equal(video1080.ok && Number(video1080.usd.toFixed(2)), 0.75);

  const tts = estimateRunpodRequestCost({ modelId: 'minimax-speech', usage: { kind: 'tts', characters: 1000 } });
  assert.equal(tts.ok && Number(tts.usd.toFixed(2)), 0.05);
});

test('runpod: 用量越界与无价分辨率都被拒绝', () => {
  assert.equal(estimateRunpodRequestCost({
    modelId: 'z-image-turbo',
    usage: { kind: 'image', count: 5, resolutionKey: '1k' }
  }).ok, false);

  assert.equal(estimateRunpodRequestCost({
    modelId: 'wan-2-6-i2v',
    usage: { kind: 'video', seconds: 11, resolutionKey: '720p' }
  }).ok, false);

  assert.equal(estimateRunpodRequestCost({
    modelId: 'minimax-speech',
    usage: { kind: 'tts', characters: 3001 }
  }).ok, false);

  const unpriced = estimateRunpodRequestCost({
    modelId: 'wan-2-6-i2v',
    usage: { kind: 'video', seconds: 5, resolutionKey: '480p' }
  });
  assert.equal(unpriced.ok, false);
  assert.equal(unpriced.ok === false && unpriced.reason, 'RUNPOD_PRICE_UNKNOWN');

  const unknown = estimateRunpodRequestCost({
    modelId: 'not-in-catalog',
    usage: { kind: 'image', count: 1 }
  });
  assert.equal(unknown.ok === false && unknown.reason, 'RUNPOD_PRICE_UNKNOWN');
});

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const serverSource = readFileSync(path.join(repoRoot, 'server.ts'), 'utf8');

function collectSources(dir: string, files: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === 'dist' || entry.startsWith('.')) continue;
    const full = path.join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      collectSources(full, files);
    } else if (/\.(ts|tsx|js|jsx|wxml|wxss)$/.test(entry)) {
      files.push(full);
    }
  }
  return files;
}

test('runpod: 4 条 render 接口都要求商家租户与 AI 工具权限', () => {
  const routes: Array<[string, string]> = [
    ['post', '/api/merchant/ai-ad/render/image'],
    ['post', '/api/merchant/ai-ad/render/video'],
    ['get', '/api/merchant/ai-ad/render/video/:jobId'],
    ['post', '/api/merchant/ai-ad/render/voice']
  ];
  for (const [method, route] of routes) {
    const lines = serverSource.split('\n').filter(line => line.includes(`app.${method}('${route}'`));
    assert.equal(lines.length, 1, `route ${method.toUpperCase()} ${route} 未登记或重复登记`);
    assert.match(lines[0], /requireMerchantTenant/);
    assert.match(lines[0], /AI_TOOLS_USE_PERMISSION/);
  }
  assert.match(serverSource, /RUNPOD_API_KEY/);
});

test('runpod: health 探测区分可达 / 未授权 / 不支持 / 未配置', async () => {
  const healthy = fakeFetch(() => ({ status: 200, body: { status: 'healthy' } }));
  assert.deepEqual(await runpodHealth({ context: { config: CONFIG, fetchImpl: healthy.fetchImpl } }), {
    ok: true,
    status: 'healthy',
    modelId: 'z-image-turbo'
  });
  assert.equal(healthy.calls[0].url, 'https://api.runpod.ai/v2/z-image-turbo/health');
  assert.equal(healthy.calls[0].headers.Authorization, 'Bearer test-key');

  const unauthorized = fakeFetch(() => ({ status: 401, body: {} }));
  assert.deepEqual(await runpodHealth({ context: { config: CONFIG, fetchImpl: unauthorized.fetchImpl } }), {
    ok: false,
    status: 'unauthorized',
    modelId: 'z-image-turbo'
  });

  const notSupported = fakeFetch(() => ({ status: 404, body: {} }));
  assert.deepEqual(await runpodHealth({ context: { config: CONFIG, fetchImpl: notSupported.fetchImpl } }), {
    ok: false,
    status: 'not_supported',
    modelId: 'z-image-turbo'
  });

  const missing = fakeFetch(() => ({ status: 200, body: {} }));
  assert.deepEqual(await runpodHealth({ context: { config: readRunpodConfig({}), fetchImpl: missing.fetchImpl } }), {
    ok: false,
    status: 'not_configured',
    modelId: 'z-image-turbo'
  });
  assert.equal(missing.calls.length, 0);
});

test('runpod: 平台后台密钥接口仅超级管理员可用，且只回传脱敏信息', () => {
  const routes: Array<['get' | 'put' | 'post', string]> = [
    ['get', '/api/admin/ai-providers/runpod'],
    ['put', '/api/admin/ai-providers/runpod'],
    ['post', '/api/admin/ai-providers/runpod/test']
  ];
  for (const [method, route] of routes) {
    const line = serverSource.split('\n').find(item => item.includes(`app.${method}('${route}'`));
    assert.ok(line, `缺少 ${method.toUpperCase()} ${route}`);
    assert.match(line!, /requireAdminAuth/);
    assert.match(line!, /requireAdminPermission\('settings\.ai_support'\)/);
  }
  assert.match(serverSource, /runpodApiKeyEncrypted: string/);
  assert.match(serverSource, /next\.runpodApiKeyEncrypted = encryptSecret\(apiKey\)/);
  const viewStart = serverSource.indexOf('const buildRunpodAdminView');
  const viewBlock = serverSource.slice(viewStart, serverSource.indexOf('\n  };', viewStart));
  assert.match(viewBlock, /maskedKey/);
  assert.ok(!/apiKey\s*:/.test(viewBlock), '平台后台视图不得返回明文密钥字段');
  assert.ok(!/maskedKey:\s*active\b(?!\s*\?)/.test(viewBlock), '脱敏密钥必须经过 maskSecret');
});

test('runpod: 前端与小程序源码里不出现任何 Runpod 凭据名', () => {
  const targets = ['src/apps', 'merchant-miniprogram', 'src/components', 'src/pages'];
  const offenders: string[] = [];
  for (const target of targets) {
    const abs = path.join(repoRoot, target);
    let files: string[] = [];
    try {
      files = collectSources(abs);
    } catch {
      continue;
    }
    for (const file of files) {
      if (readFileSync(file, 'utf8').includes('RUNPOD_API_KEY')) {
        offenders.push(path.relative(repoRoot, file));
      }
    }
  }
  assert.deepEqual(offenders, [], `Runpod 凭据名不得出现在前端：${offenders.join(', ')}`);
});
