import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { readFile, rm, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import test from 'node:test';
import sharp from 'sharp';
import {
  AI_IMAGE_PRESETS,
  AiMediaError,
  concatAiVideos,
  extractAiAudio,
  extractAiFrame,
  inspectAiImage,
  processAiImage,
  probeAiMedia,
  trimAiVideo
} from '../src/server/aiMediaToolkit';

const execFileAsync = promisify(execFile);

async function makeTestImage(): Promise<Buffer> {
  return sharp({ create: { width: 320, height: 240, channels: 3, background: { r: 18, g: 24, b: 32 } } })
    .png()
    .toBuffer();
}

/** 用 ffmpeg 生成真实短视频，避免测试依赖外部素材文件。 */
async function makeTestVideo(seconds: number): Promise<Buffer> {
  const dir = await mkdtemp(path.join(tmpdir(), 'modaui-fixture-'));
  try {
    const output = path.join(dir, 'clip.mp4');
    await execFileAsync('ffmpeg', [
      '-hide_banner', '-loglevel', 'error', '-y',
      '-f', 'lavfi', '-i', `testsrc=size=160x120:rate=15:duration=${seconds}`,
      '-f', 'lavfi', '-i', `sine=frequency=440:duration=${seconds}`,
      '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p',
      '-c:a', 'aac', '-shortest', output
    ]);
    return await readFile(output);
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
}

test('图片：读取真实尺寸，非图片输入明确报错', async () => {
  const image = await makeTestImage();
  const info = await inspectAiImage(image);
  assert.equal(info.width, 320);
  assert.equal(info.height, 240);
  assert.equal(info.format, 'png');

  await assert.rejects(
    () => inspectAiImage(Buffer.from('definitely not an image')),
    (error: unknown) => error instanceof AiMediaError && error.code === 'AI_MEDIA_INPUT_INVALID'
  );
});

test('图片：缩放、裁剪、格式转换、压缩、缩略图都产出真实文件', async () => {
  const image = await makeTestImage();

  const resized = await processAiImage(image, { op: 'resize', width: 160, height: 160, fit: 'cover' });
  assert.equal(resized.width, 160);
  assert.equal(resized.height, 160);
  assert.ok(resized.bytes > 0);

  const cropped = await processAiImage(image, { op: 'crop', left: 10, top: 10, width: 100, height: 80 });
  assert.equal(cropped.width, 100);
  assert.equal(cropped.height, 80);

  const webp = await processAiImage(image, { op: 'convert', format: 'webp', quality: 70 });
  assert.equal(webp.format, 'webp');
  assert.equal((await sharp(webp.buffer).metadata()).format, 'webp');

  const compressed = await processAiImage(image, { op: 'compress', quality: 40 });
  assert.equal(compressed.format, 'jpeg');

  const thumb = await processAiImage(image, { op: 'thumbnail', size: 64 });
  assert.equal(thumb.width, 64);
  assert.equal(thumb.height, 64);
});

test('图片：平台预设输出精确像素尺寸（9:16 / 1:1 / 16:9）', async () => {
  const image = await makeTestImage();
  for (const preset of ['ig_story', 'ig_square', 'yt_16x9'] as const) {
    const result = await processAiImage(image, { op: 'preset', preset });
    assert.equal(result.width, AI_IMAGE_PRESETS[preset].width, preset);
    assert.equal(result.height, AI_IMAGE_PRESETS[preset].height, preset);
  }
});

test('图片：参数越界或裁剪超出原图时拒绝，不产出错误图片', async () => {
  const image = await makeTestImage();
  await assert.rejects(
    () => processAiImage(image, { op: 'crop', left: 300, top: 200, width: 100, height: 100 }),
    (error: unknown) => error instanceof AiMediaError && error.code === 'AI_MEDIA_PARAMS_INVALID'
  );
  await assert.rejects(
    () => processAiImage(image, { op: 'resize', width: 0 }),
    (error: unknown) => error instanceof AiMediaError && error.code === 'AI_MEDIA_PARAMS_INVALID'
  );
  await assert.rejects(
    () => processAiImage(image, { op: 'compress', quality: 101 }),
    (error: unknown) => error instanceof AiMediaError && error.code === 'AI_MEDIA_PARAMS_INVALID'
  );
});

test('视频：ffprobe 读取真实时长、分辨率与音轨', async () => {
  const video = await makeTestVideo(2);
  const probe = await probeAiMedia(video);
  assert.equal(probe.hasVideo, true);
  assert.equal(probe.hasAudio, true);
  assert.equal(probe.width, 160);
  assert.equal(probe.height, 120);
  assert.ok(Math.abs(probe.durationSeconds - 2) < 0.5, `时长异常: ${probe.durationSeconds}`);
});

test('视频：FFmpeg 裁剪与拼接产出可再次解析的真实视频', async () => {
  const twoSeconds = await makeTestVideo(2);
  const trimmed = await trimAiVideo(twoSeconds, { startSeconds: 0.5, durationSeconds: 1 });
  const trimmedProbe = await probeAiMedia(trimmed);
  assert.equal(trimmedProbe.hasVideo, true);
  assert.ok(Math.abs(trimmedProbe.durationSeconds - 1) < 0.5, `裁剪后时长异常: ${trimmedProbe.durationSeconds}`);

  const another = await trimAiVideo(twoSeconds, { startSeconds: 0, durationSeconds: 1 });
  const merged = await concatAiVideos([trimmed, another]);
  const mergedProbe = await probeAiMedia(merged);
  assert.ok(Math.abs(mergedProbe.durationSeconds - 2) < 0.6, `拼接后时长异常: ${mergedProbe.durationSeconds}`);

  await assert.rejects(
    () => concatAiVideos([trimmed]),
    (error: unknown) => error instanceof AiMediaError && error.code === 'AI_MEDIA_PARAMS_INVALID'
  );
});

test('视频：抽取音轨与封面帧产出真实文件', async () => {
  const video = await makeTestVideo(2);
  const audio = await extractAiAudio(video);
  const audioProbe = await probeAiMedia(audio);
  assert.equal(audioProbe.hasAudio, true);
  assert.equal(audioProbe.hasVideo, false);

  const frame = await extractAiFrame(video, { atSeconds: 1 });
  // PNG magic：89 50 4E 47
  assert.deepEqual([...frame.subarray(0, 4)], [0x89, 0x50, 0x4e, 0x47]);
  const frameMeta = await sharp(frame).metadata();
  assert.equal(frameMeta.width, 160);
  assert.equal(frameMeta.height, 120);
});

test('视频：非法时长参数与非媒体输入被拒绝', async () => {
  const video = await makeTestVideo(1);
  await assert.rejects(
    () => trimAiVideo(video, { startSeconds: 0, durationSeconds: 0 }),
    (error: unknown) => error instanceof AiMediaError && error.code === 'AI_MEDIA_PARAMS_INVALID'
  );
  await assert.rejects(
    () => trimAiVideo(video, { startSeconds: -1, durationSeconds: 1 }),
    (error: unknown) => error instanceof AiMediaError && error.code === 'AI_MEDIA_PARAMS_INVALID'
  );
  await assert.rejects(
    () => probeAiMedia(Buffer.from('not a video')),
    (error: unknown) => error instanceof AiMediaError
  );
});
