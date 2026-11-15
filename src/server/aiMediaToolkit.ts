import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import sharp from 'sharp';

/**
 * MODAUI AI Tools 的本地媒体处理引擎（Sharp + FFmpeg）。
 *
 * 定位（docs/engineering/architecture/MODaUI-AI-TOOLS-PLATFORM.md §6）：
 * 裁剪、缩放、压缩、转码、拼接、截帧、抽音轨、烧字幕这类操作**不调用付费大模型**，
 * 全部本地完成，成本类型为 `included`（套餐内包含）/ `compute`（记录算力）。
 *
 * 安全约束：
 * - 只接受 Buffer 或受控临时目录内的路径，不接收任意绝对路径，避免读服务器任意文件。
 * - 每次调用使用独立临时目录，结束即删除。
 * - 所有数值参数有上限校验；FFmpeg 有超时与输出体积上限，避免被单个请求拖死进程。
 * - 不拼 shell 字符串，一律 `execFile` + 参数数组，避免命令注入。
 */

export const AI_MEDIA_LIMITS = {
  maxImageBytes: 25 * 1024 * 1024,
  maxVideoBytes: 512 * 1024 * 1024,
  maxOutputBytes: 256 * 1024 * 1024,
  maxDurationSeconds: 300,
  maxDimension: 8192,
  ffmpegTimeoutMs: 120_000,
  probeTimeoutMs: 20_000
} as const;

export type AiMediaErrorCode =
  | 'AI_MEDIA_INPUT_TOO_LARGE'
  | 'AI_MEDIA_INPUT_INVALID'
  | 'AI_MEDIA_PARAMS_INVALID'
  | 'AI_MEDIA_TOOL_UNAVAILABLE'
  | 'AI_MEDIA_PROCESSING_FAILED'
  | 'AI_MEDIA_TIMEOUT'
  | 'AI_MEDIA_ABORTED'
  | 'AI_MEDIA_PROBE_FAILED'
  | 'AI_MEDIA_OUTPUT_TOO_LARGE';

export class AiMediaError extends Error {
  code: AiMediaErrorCode;
  constructor(code: AiMediaErrorCode, message?: string) {
    super(message ? `${code}: ${message}` : code);
    this.name = 'AiMediaError';
    this.code = code;
  }
}

export type AiImagePreset =
  | 'ig_square'
  | 'ig_portrait'
  | 'ig_story'
  | 'yt_16x9'
  | 'pin_2x3'
  | 'product_white_bg';

/** 社交平台与商品图预设：输出精确像素尺寸，避免平台二次裁切。 */
export const AI_IMAGE_PRESETS: Record<AiImagePreset, { width: number; height: number }> = {
  ig_square: { width: 1080, height: 1080 },
  ig_portrait: { width: 1080, height: 1350 },
  ig_story: { width: 1080, height: 1920 },
  yt_16x9: { width: 1920, height: 1080 },
  pin_2x3: { width: 1000, height: 1500 },
  product_white_bg: { width: 2000, height: 2000 }
};

export type AiImageOperation =
  | { op: 'resize'; width: number; height?: number; fit?: 'cover' | 'contain' | 'inside' }
  | { op: 'crop'; left: number; top: number; width: number; height: number }
  | { op: 'convert'; format: 'jpeg' | 'png' | 'webp'; quality?: number }
  | { op: 'compress'; quality: number }
  | { op: 'thumbnail'; size: number }
  | { op: 'preset'; preset: AiImagePreset; fit?: 'cover' | 'contain' };

export type AiImageResult = {
  buffer: Buffer;
  format: string;
  width: number;
  height: number;
  bytes: number;
};

function assertDimension(value: number, label: string): void {
  if (!Number.isInteger(value) || value < 1 || value > AI_MEDIA_LIMITS.maxDimension) {
    throw new AiMediaError('AI_MEDIA_PARAMS_INVALID', label);
  }
}

function assertQuality(value: number): void {
  if (!Number.isInteger(value) || value < 1 || value > 100) {
    throw new AiMediaError('AI_MEDIA_PARAMS_INVALID', 'quality');
  }
}

function assertInput(input: Buffer, maxBytes: number): void {
  if (!Buffer.isBuffer(input) || input.length === 0) throw new AiMediaError('AI_MEDIA_INPUT_INVALID');
  if (input.length > maxBytes) throw new AiMediaError('AI_MEDIA_INPUT_TOO_LARGE');
}

/** 读取图片真实尺寸与格式；不是图片或已损坏时抛错，不做静默兜底。 */
export async function inspectAiImage(input: Buffer): Promise<Omit<AiImageResult, 'buffer'>> {
  assertInput(input, AI_MEDIA_LIMITS.maxImageBytes);
  try {
    const meta = await sharp(input).metadata();
    if (!meta.format || !meta.width || !meta.height) throw new AiMediaError('AI_MEDIA_INPUT_INVALID');
    return { format: meta.format, width: meta.width, height: meta.height, bytes: input.length };
  } catch (error) {
    if (error instanceof AiMediaError) throw error;
    throw new AiMediaError('AI_MEDIA_INPUT_INVALID');
  }
}

/**
 * 本地图片处理：裁剪、缩放、压缩、格式转换、缩略图、平台预设。
 * 不做任何生成式修改，因此商品颜色、结构、纹理与 Logo 与输入图片保持一致。
 */
export async function processAiImage(input: Buffer, operation: AiImageOperation): Promise<AiImageResult> {
  assertInput(input, AI_MEDIA_LIMITS.maxImageBytes);
  let pipeline = sharp(input, { failOn: 'error' });
  let outputFormat: 'jpeg' | 'png' | 'webp' = 'jpeg';
  let quality = 82;

  try {
    const sourceMeta = await sharp(input).metadata();
    if (!sourceMeta.width || !sourceMeta.height) throw new AiMediaError('AI_MEDIA_INPUT_INVALID');

    switch (operation.op) {
      case 'resize': {
        assertDimension(operation.width, 'width');
        if (operation.height !== undefined) assertDimension(operation.height, 'height');
        pipeline = pipeline.resize({
          width: operation.width,
          height: operation.height,
          fit: operation.fit ?? 'inside'
        });
        break;
      }
      case 'crop': {
        assertDimension(operation.width, 'width');
        assertDimension(operation.height, 'height');
        if (
          !Number.isInteger(operation.left) || operation.left < 0
          || !Number.isInteger(operation.top) || operation.top < 0
        ) throw new AiMediaError('AI_MEDIA_PARAMS_INVALID', 'offset');
        if (
          operation.left + operation.width > sourceMeta.width
          || operation.top + operation.height > sourceMeta.height
        ) throw new AiMediaError('AI_MEDIA_PARAMS_INVALID', 'crop_out_of_bounds');
        pipeline = pipeline.extract({
          left: operation.left,
          top: operation.top,
          width: operation.width,
          height: operation.height
        });
        break;
      }
      case 'convert': {
        outputFormat = operation.format;
        if (operation.quality !== undefined) {
          assertQuality(operation.quality);
          quality = operation.quality;
        }
        break;
      }
      case 'compress': {
        assertQuality(operation.quality);
        quality = operation.quality;
        outputFormat = 'jpeg';
        break;
      }
      case 'thumbnail': {
        assertDimension(operation.size, 'size');
        pipeline = pipeline.resize({ width: operation.size, height: operation.size, fit: 'cover' });
        break;
      }
      case 'preset': {
        const target = AI_IMAGE_PRESETS[operation.preset];
        if (!target) throw new AiMediaError('AI_MEDIA_PARAMS_INVALID', 'preset');
        pipeline = pipeline.resize({
          width: target.width,
          height: target.height,
          fit: operation.fit ?? 'cover',
          position: 'centre',
          background: { r: 255, g: 255, b: 255, alpha: 1 }
        });
        break;
      }
      default:
        throw new AiMediaError('AI_MEDIA_PARAMS_INVALID', 'op');
    }

    if (outputFormat === 'jpeg') pipeline = pipeline.jpeg({ quality, mozjpeg: true });
    else if (outputFormat === 'webp') pipeline = pipeline.webp({ quality });
    else pipeline = pipeline.png({ compressionLevel: 9 });

    const { data, info } = await pipeline.toBuffer({ resolveWithObject: true });
    if (data.length > AI_MEDIA_LIMITS.maxOutputBytes) throw new AiMediaError('AI_MEDIA_OUTPUT_TOO_LARGE');
    return { buffer: data, format: info.format, width: info.width, height: info.height, bytes: data.length };
  } catch (error) {
    if (error instanceof AiMediaError) throw error;
    throw new AiMediaError('AI_MEDIA_PROCESSING_FAILED', error instanceof Error ? error.message : undefined);
  }
}

type SandboxJob<T> = (dir: string) => Promise<T>;

/** 每次调用独立临时目录，异常也保证清理。Image/Video Engine 复用同一沙箱实现。 */
export async function withSandbox<T>(job: SandboxJob<T>): Promise<T> {
  const dir = await mkdtemp(path.join(tmpdir(), 'modaui-media-'));
  try {
    return await job(dir);
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
}

export type MediaBinaryResult = { stdout: Buffer; stderr: string };

/**
 * 执行外部二进制并同时返回 stdout 与 stderr。
 * 需要 stderr 的能力（silencedetect / scdet / ebur128 的诊断输出）用它，
 * 避免为解析日志再写一套进程调用。
 */
export function runBinaryFull(
  binary: string,
  args: string[],
  timeoutMs: number,
  signal?: AbortSignal,
  cwd?: string
): Promise<MediaBinaryResult> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new AiMediaError('AI_MEDIA_ABORTED'));
      return;
    }
    execFile(
      binary,
      args,
      { timeout: timeoutMs, maxBuffer: 64 * 1024 * 1024, windowsHide: true, signal, cwd },
      (error, stdout, stderr) => {
        const text = Buffer.isBuffer(stderr) ? stderr.toString('utf8') : String(stderr ?? '');
        if (error) {
          const code = (error as NodeJS.ErrnoException).code;
          if (code === 'ENOENT') return reject(new AiMediaError('AI_MEDIA_TOOL_UNAVAILABLE', binary));
          if (code === 'ABORT_ERR' || signal?.aborted) return reject(new AiMediaError('AI_MEDIA_ABORTED'));
          const killed = (error as { killed?: boolean }).killed === true;
          if (killed || error.message.includes('TIMEOUT')) return reject(new AiMediaError('AI_MEDIA_TIMEOUT'));
          return reject(new AiMediaError('AI_MEDIA_PROCESSING_FAILED', (text || error.message).slice(-300)));
        }
        resolve({
          stdout: Buffer.isBuffer(stdout) ? stdout : Buffer.from(String(stdout)),
          stderr: text
        });
      }
    );
  });
}

function runBinary(
  binary: string,
  args: string[],
  timeoutMs: number,
  signal?: AbortSignal,
  cwd?: string
): Promise<Buffer> {
  return runBinaryFull(binary, args, timeoutMs, signal, cwd).then(result => result.stdout);
}

export type AiMediaProbe = {
  hasVideo: boolean;
  hasAudio: boolean;
  durationSeconds: number;
  width: number | null;
  height: number | null;
  fps: number | null;
  videoCodec: string | null;
  audioCodec: string | null;
  bitRate: number | null;
};

function parseRate(value: unknown): number | null {
  if (typeof value !== 'string' || !value.includes('/')) return null;
  const [num, den] = value.split('/').map(Number);
  if (!Number.isFinite(num) || !Number.isFinite(den) || den === 0) return null;
  return Math.round((num / den) * 1000) / 1000;
}

/** 读取真实媒体信息：时长、分辨率、编码、码率。失败即报错，不返回猜测值。 */
export async function probeAiMedia(input: Buffer): Promise<AiMediaProbe> {
  assertInput(input, AI_MEDIA_LIMITS.maxVideoBytes);
  return withSandbox(async dir => {
    const source = path.join(dir, 'source.bin');
    await writeFile(source, input);
    const stdout = await runBinary(
      'ffprobe',
      ['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', source],
      AI_MEDIA_LIMITS.probeTimeoutMs
    );
    let parsed: unknown;
    try {
      parsed = JSON.parse(stdout.toString('utf8'));
    } catch {
      throw new AiMediaError('AI_MEDIA_PROBE_FAILED');
    }
    const record = parsed as { format?: { duration?: string; bit_rate?: string }; streams?: unknown[] };
    const streams = Array.isArray(record.streams) ? record.streams as Record<string, unknown>[] : [];
    const video = streams.find(stream => stream.codec_type === 'video');
    const audio = streams.find(stream => stream.codec_type === 'audio');
    if (!video && !audio) throw new AiMediaError('AI_MEDIA_INPUT_INVALID');
    const duration = Number(record.format?.duration);
    return {
      hasVideo: Boolean(video),
      hasAudio: Boolean(audio),
      durationSeconds: Number.isFinite(duration) && duration > 0 ? Math.round(duration * 1000) / 1000 : 0,
      width: typeof video?.width === 'number' ? video.width : null,
      height: typeof video?.height === 'number' ? video.height : null,
      fps: video ? parseRate(video.avg_frame_rate) : null,
      videoCodec: typeof video?.codec_name === 'string' ? video.codec_name : null,
      audioCodec: typeof audio?.codec_name === 'string' ? audio.codec_name : null,
      bitRate: Number.isFinite(Number(record.format?.bit_rate)) ? Number(record.format?.bit_rate) : null
    };
  });
}


type VideoJobOptions = { signal?: AbortSignal; timeoutMs?: number };

function assertSeconds(value: number, label: string): void {
  if (!Number.isFinite(value) || value < 0 || value > AI_MEDIA_LIMITS.maxDurationSeconds) {
    throw new AiMediaError('AI_MEDIA_PARAMS_INVALID', label);
  }
}

async function runFfmpegToBuffer(
  dir: string,
  args: string[],
  outputName: string,
  options: VideoJobOptions
): Promise<Buffer> {
  await runBinary('ffmpeg', args, options.timeoutMs ?? AI_MEDIA_LIMITS.ffmpegTimeoutMs, options.signal, dir);
  const outputPath = path.join(dir, outputName);
  const info = await stat(outputPath).catch(() => null);
  if (!info || info.size === 0) throw new AiMediaError('AI_MEDIA_PROCESSING_FAILED', 'empty_output');
  if (info.size > AI_MEDIA_LIMITS.maxOutputBytes) throw new AiMediaError('AI_MEDIA_OUTPUT_TOO_LARGE');
  return readFile(outputPath);
}

/** 视频裁剪：重编码以保证时间轴精确（`-c copy` 只能切关键帧，会偏几秒）。 */
export async function trimAiVideo(
  input: Buffer,
  options: { startSeconds: number; durationSeconds: number } & VideoJobOptions
): Promise<Buffer> {
  assertInput(input, AI_MEDIA_LIMITS.maxVideoBytes);
  assertSeconds(options.startSeconds, 'startSeconds');
  if (!Number.isFinite(options.durationSeconds) || options.durationSeconds <= 0
    || options.durationSeconds > AI_MEDIA_LIMITS.maxDurationSeconds) {
    throw new AiMediaError('AI_MEDIA_PARAMS_INVALID', 'durationSeconds');
  }
  return withSandbox(async dir => {
    await writeFile(path.join(dir, 'in.mp4'), input);
    return runFfmpegToBuffer(dir, [
      '-hide_banner', '-loglevel', 'error', '-y',
      '-ss', String(options.startSeconds),
      '-i', 'in.mp4',
      '-t', String(options.durationSeconds),
      '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', '-pix_fmt', 'yuv420p',
      '-c:a', 'aac', '-b:a', '128k',
      '-movflags', '+faststart',
      'out.mp4'
    ], 'out.mp4', options);
  });
}

/** 多段拼接：要求各段编码参数一致（同一编辑器导出即满足），否则明确失败而不是产出坏文件。 */
export async function concatAiVideos(inputs: Buffer[], options: VideoJobOptions = {}): Promise<Buffer> {
  if (!Array.isArray(inputs) || inputs.length < 2) throw new AiMediaError('AI_MEDIA_PARAMS_INVALID', 'inputs');
  if (inputs.length > 50) throw new AiMediaError('AI_MEDIA_PARAMS_INVALID', 'too_many_inputs');
  for (const input of inputs) assertInput(input, AI_MEDIA_LIMITS.maxVideoBytes);
  return withSandbox(async dir => {
    const lines: string[] = [];
    for (const [index, input] of inputs.entries()) {
      const name = `clip${index}.mp4`;
      await writeFile(path.join(dir, name), input);
      lines.push(`file '${name}'`);
    }
    await writeFile(path.join(dir, 'list.txt'), `${lines.join('\n')}\n`);
    return runFfmpegToBuffer(dir, [
      '-hide_banner', '-loglevel', 'error', '-y',
      '-f', 'concat', '-safe', '0', '-i', 'list.txt',
      '-c', 'copy', '-movflags', '+faststart', 'out.mp4'
    ], 'out.mp4', options);
  });
}


/** 转码 / 改分辨率：用于平台比例适配与统一编码。 */
export async function transcodeAiVideo(
  input: Buffer,
  options: { width: number; height: number; videoBitrateKbps?: number } & VideoJobOptions
): Promise<Buffer> {
  assertInput(input, AI_MEDIA_LIMITS.maxVideoBytes);
  assertDimension(options.width, 'width');
  assertDimension(options.height, 'height');
  const bitrate = options.videoBitrateKbps;
  if (bitrate !== undefined && (!Number.isInteger(bitrate) || bitrate < 200 || bitrate > 20_000)) {
    throw new AiMediaError('AI_MEDIA_PARAMS_INVALID', 'videoBitrateKbps');
  }
  return withSandbox(async dir => {
    await writeFile(path.join(dir, 'in.mp4'), input);
    const args = [
      '-hide_banner', '-loglevel', 'error', '-y',
      '-i', 'in.mp4',
      '-vf', `scale=${options.width}:${options.height}:force_original_aspect_ratio=decrease,pad=${options.width}:${options.height}:(ow-iw)/2:(oh-ih)/2`,
      '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', '-pix_fmt', 'yuv420p'
    ];
    if (bitrate !== undefined) args.push('-b:v', `${bitrate}k`);
    args.push('-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', 'out.mp4');
    return runFfmpegToBuffer(dir, args, 'out.mp4', options);
  });
}

/** 抽取音轨（配音替换、字幕对齐、语音识别的前置步骤）。 */
export async function extractAiAudio(input: Buffer, options: VideoJobOptions = {}): Promise<Buffer> {
  assertInput(input, AI_MEDIA_LIMITS.maxVideoBytes);
  return withSandbox(async dir => {
    await writeFile(path.join(dir, 'in.mp4'), input);
    return runFfmpegToBuffer(dir, [
      '-hide_banner', '-loglevel', 'error', '-y',
      '-i', 'in.mp4', '-vn', '-c:a', 'libmp3lame', '-q:a', '4', 'out.mp3'
    ], 'out.mp3', options);
  });
}

/** 截取封面帧（发布中心封面、视频列表缩略图）。 */
export async function extractAiFrame(
  input: Buffer,
  options: { atSeconds: number } & VideoJobOptions
): Promise<Buffer> {
  assertInput(input, AI_MEDIA_LIMITS.maxVideoBytes);
  assertSeconds(options.atSeconds, 'atSeconds');
  return withSandbox(async dir => {
    await writeFile(path.join(dir, 'in.mp4'), input);
    return runFfmpegToBuffer(dir, [
      '-hide_banner', '-loglevel', 'error', '-y',
      '-ss', String(options.atSeconds), '-i', 'in.mp4',
      '-frames:v', '1', 'out.png'
    ], 'out.png', options);
  });
}

/**
 * 烧录硬字幕。
 * 需要 FFmpeg 编译时带 libass；缺失时明确返回 `AI_MEDIA_PROCESSING_FAILED`，
 * 不做「假装烧成功」的降级。
 */
export async function burnAiSubtitles(
  input: Buffer,
  options: { srt: string; fontSize?: number } & VideoJobOptions
): Promise<Buffer> {
  assertInput(input, AI_MEDIA_LIMITS.maxVideoBytes);
  const srt = options.srt;
  if (typeof srt !== 'string' || !srt.trim() || srt.length > 512 * 1024) {
    throw new AiMediaError('AI_MEDIA_PARAMS_INVALID', 'srt');
  }
  const fontSize = options.fontSize ?? 24;
  if (!Number.isInteger(fontSize) || fontSize < 8 || fontSize > 96) {
    throw new AiMediaError('AI_MEDIA_PARAMS_INVALID', 'fontSize');
  }
  return withSandbox(async dir => {
    await writeFile(path.join(dir, 'in.mp4'), input);
    await writeFile(path.join(dir, 'subs.srt'), srt);
    return runFfmpegToBuffer(dir, [
      '-hide_banner', '-loglevel', 'error', '-y',
      '-i', 'in.mp4',
      '-vf', `subtitles=subs.srt:force_style='FontSize=${fontSize}'`,
      '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', '-pix_fmt', 'yuv420p',
      '-c:a', 'copy', '-movflags', '+faststart', 'out.mp4'
    ], 'out.mp4', options);
  });
}
