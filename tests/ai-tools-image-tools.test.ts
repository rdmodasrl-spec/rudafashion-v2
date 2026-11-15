import assert from 'node:assert/strict';
import test from 'node:test';
import sharp from 'sharp';
import { createModauiAiTools, createModauiAiToolsManifest } from '../src/server/modauiAiTools';

const IMAGE_TOOL_IDS = [
  'ai_tools_image_quality',
  'ai_tools_image_product_shot',
  'ai_tools_image_reframe'
] as const;

function signal(): AbortSignal {
  return new AbortController().signal;
}

/** 白底 + 居中红色矩形：可被分割、可被重裁的真实像素样本。 */
async function productImageBase64(): Promise<string> {
  const subject = await sharp({
    create: { width: 160, height: 240, channels: 4, background: { r: 190, g: 40, b: 45, alpha: 1 } }
  })
    .png()
    .toBuffer();
  const image = await sharp({ create: { width: 400, height: 500, channels: 3, background: { r: 255, g: 255, b: 255 } } })
    .composite([{ input: subject, left: 120, top: 130 }])
    .png()
    .toBuffer();
  return image.toString('base64');
}

test('图片工具同时出现在 manifest 与 handler 中', () => {
  const manifest = createModauiAiToolsManifest();
  const manifestIds = manifest.tools.map(tool => tool.toolId);
  const { handlers, definitions } = createModauiAiTools({});
  for (const toolId of IMAGE_TOOL_IDS) {
    assert.ok(manifestIds.includes(toolId), `${toolId} 未登记 manifest`);
    assert.equal(typeof handlers[toolId], 'function', `${toolId} 缺少 handler`);
    const definition = definitions.find(item => item.name === toolId);
    assert.ok(definition, `${toolId} 缺少工具定义`);
    assert.equal(definition!.permission, 'ai.tools.use');
    assert.equal(definition!.auditPolicy, 'required');
    assert.equal(definition!.retryPolicy.idempotent, true);
  }
  assert.equal(manifest.tools.length, definitions.length);
});

test('白底主图工具输出可解析的 PNG，尺寸与声明一致', async () => {
  const { handlers } = createModauiAiTools({});
  const result = (await handlers.ai_tools_image_product_shot(
    'tenant-test',
    { imageBase64: await productImageBase64(), size: 800 },
    signal()
  )) as { ok: boolean; reason: string; width: number; height: number; mimeType: string; imageBase64: string };
  assert.equal(result.ok, true);
  assert.equal(result.reason, 'ok');
  assert.equal(result.mimeType, 'image/png');
  assert.equal(result.width, 800);
  assert.equal(result.height, 800);
  const decoded = Buffer.from(result.imageBase64, 'base64');
  const meta = await sharp(decoded).metadata();
  assert.equal(meta.width, 800);
  assert.equal(meta.height, 800);
  assert.equal(meta.format, 'png');
});

test('画幅工具返回目标比例，并如实标注主体是否被切到', async () => {
  const { handlers } = createModauiAiTools({});
  const { imageBase64 } = { imageBase64: await productImageBase64() };
  const vertical = (await handlers.ai_tools_image_reframe(
    'tenant-test',
    { imageBase64, aspect: '9:16', width: 720 },
    signal()
  )) as { ok: boolean; width: number; height: number; anchorUsed: string; subjectClipped: boolean; imageBase64?: string };
  assert.equal(vertical.ok, true);
  assert.equal(vertical.anchorUsed, 'subject');
  assert.equal(vertical.subjectClipped, false);
  assert.equal(vertical.width, 281);
  assert.equal(vertical.height, 500);
  const meta = await sharp(Buffer.from(vertical.imageBase64 as string, 'base64')).metadata();
  assert.equal(meta.width, 281);

  const wide = (await handlers.ai_tools_image_reframe(
    'tenant-test',
    { imageBase64, aspect: '16:9' },
    signal()
  )) as { ok: boolean; subjectClipped: boolean };
  assert.equal(wide.ok, true);
  assert.equal(wide.subjectClipped, true, '16:9 会切到主体，必须如实上报');
});

test('质检工具用真实像素给出结论，并拒绝非法输入', async () => {
  const { handlers } = createModauiAiTools({});
  const report = (await handlers.ai_tools_image_quality(
    'tenant-test',
    { imageBase64: await productImageBase64() },
    signal()
  )) as { ok: boolean; items: Array<{ key: string; status: string }>; overallStatus: string };
  assert.equal(report.ok, true);
  assert.ok(report.items.length >= 3);
  assert.ok(['pass', 'warn', 'fail', 'unknown'].includes(report.overallStatus));

  await assert.rejects(
    handlers.ai_tools_image_quality('tenant-test', { imageBase64: 'not-an-image' }, signal()),
    /AI_TOOLS_INPUT_INVALID/
  );
  await assert.rejects(
    handlers.ai_tools_image_reframe('tenant-test', { imageBase64: 'x'.repeat(80) }, signal()),
    /AI_TOOLS_INPUT_INVALID/
  );
  await assert.rejects(
    handlers.ai_tools_image_quality('tenant-test', { imageBase64: 'x'.repeat(80), extra: 1 }, signal()),
    /AI_TOOLS_INPUT_INVALID/
  );
});
