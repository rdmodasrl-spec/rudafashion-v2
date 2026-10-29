import { execFile } from 'node:child_process';
import { mkdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import sharp from 'sharp';

const execFileAsync = promisify(execFile);
export const maximumFashionVideoSourceSizeBytes = 500 * 1024 * 1024;
export const maximumFashionVideoSourceDurationSeconds = 30 * 60;
export const maximumFashionVideoExportDurationSeconds = 180;
export const maximumFashionVideoExportSizeBytes = 100 * 1024 * 1024;
export const maximumFashionVideoTimelineClips = 12;
export const maximumFashionVideoTextOverlays = 24;
export const maximumFashionVideoImageOverlays = 8;
export const minimumFashionVideoTimelineClipDurationSeconds = 0.25;
export const maximumFashionVideoAudioVolume = 2;
export const maximumFashionVideoTextLength = 200;
export const maximumFashionStudioAudioSizeBytes = 100 * 1024 * 1024;
export const maximumFashionStudioAudioDurationSeconds = 30 * 60;
export const maximumFashionStudioImageSizeBytes = 12 * 1024 * 1024;
export const fashionVideoCanvasPresets = ['source', 'portrait', 'square', 'landscape'] as const;
export type FashionVideoCanvasPreset = typeof fashionVideoCanvasPresets[number];
const isFashionVideoCanvasPreset = (value: unknown): value is FashionVideoCanvasPreset =>
  typeof value === 'string' && fashionVideoCanvasPresets.some(preset => preset === value);

export const fashionStudioAudioExtensions = {
  'audio/mpeg': 'mp3',
  'audio/mp4': 'm4a',
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
  'audio/ogg': 'ogg',
  'audio/webm': 'webm',
  'audio/aac': 'aac',
  'audio/flac': 'flac'
} as const;

export type FashionStudioAudioContentType = keyof typeof fashionStudioAudioExtensions;
export type FashionVideoAudioTrack = {
  assetId: string;
  fileName: string;
  contentType: FashionStudioAudioContentType;
  durationSeconds: number;
  trimStartSeconds: number;
  trimEndSeconds: number;
  volume: number;
};

export type FashionVideoTrimInput = {
  sourcePostId: string;
  startSeconds: number;
  endSeconds: number;
};

export type FashionVideoTimelineClip = {
  id: string;
  startSeconds: number;
  endSeconds: number;
  sourcePostId?: string;
};

export type FashionVideoTextOverlay = {
  id: string;
  text: string;
  startSeconds: number;
  endSeconds: number;
  position: 'top' | 'center' | 'bottom';
  fontSize: number;
};

export type FashionVideoImageOverlay = {
  id: string;
  sourcePostId: string;
  startSeconds: number;
  endSeconds: number;
  position: 'top-left' | 'top-right' | 'center' | 'bottom-left' | 'bottom-right';
  sizePercent: number;
};

const isFashionVideoImageOverlayPosition = (value: unknown): value is FashionVideoImageOverlay['position'] =>
  value === 'top-left'
  || value === 'top-right'
  || value === 'center'
  || value === 'bottom-left'
  || value === 'bottom-right';

export type FashionVideoTimelineInput = {
  sourcePostId: string;
  clips: FashionVideoTimelineClip[];
  canvasPreset: FashionVideoCanvasPreset;
  audioVolume: number;
  audioTrack: FashionVideoAudioTrack | null;
  textOverlays: FashionVideoTextOverlay[];
  imageOverlays: FashionVideoImageOverlay[];
};

export type FashionVideoTrimTaskPayload =
  | (FashionVideoTrimInput & { version: 1 })
  | (FashionVideoTimelineInput & { version: 2 | 3 | 4 | 5 | 6 | 7 | 8 });

export class FashionVideoEditorError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = 'FashionVideoEditorError';
  }
}

export function isFashionStudioAudioContentType(contentType: string): contentType is FashionStudioAudioContentType {
  return Object.hasOwn(fashionStudioAudioExtensions, contentType);
}

export function fashionStudioAudioExtension(contentType: string): string | null {
  return isFashionStudioAudioContentType(contentType) ? fashionStudioAudioExtensions[contentType] : null;
}

export function getFashionStudioAudioAssetPath(directory: string, track: FashionVideoAudioTrack): string {
  const extension = fashionStudioAudioExtension(track.contentType);
  if (!extension || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(track.assetId)) {
    throw new FashionVideoEditorError('FASHION_STUDIO_AUDIO_REFERENCE_INVALID');
  }
  return path.join(directory, `${track.assetId}.${extension}`);
}

export function parseFashionVideoAudioTrack(value: unknown): FashionVideoAudioTrack | null {
  if (!isRecord(value)
    || Object.keys(value).length !== 7
    || typeof value.assetId !== 'string'
    || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value.assetId)
    || typeof value.fileName !== 'string'
    || !value.fileName.trim()
    || value.fileName.length > 180
    || /[\u0000-\u001f\u007f]/.test(value.fileName)
    || typeof value.contentType !== 'string'
    || !isFashionStudioAudioContentType(value.contentType)
    || typeof value.durationSeconds !== 'number'
    || !Number.isFinite(value.durationSeconds)
    || value.durationSeconds <= 0
    || value.durationSeconds > maximumFashionStudioAudioDurationSeconds
    || typeof value.trimStartSeconds !== 'number'
    || !Number.isFinite(value.trimStartSeconds)
    || value.trimStartSeconds < 0
    || typeof value.trimEndSeconds !== 'number'
    || !Number.isFinite(value.trimEndSeconds)
    || value.trimEndSeconds > maximumFashionStudioAudioDurationSeconds
    || value.trimEndSeconds <= value.trimStartSeconds
    || value.trimEndSeconds - value.trimStartSeconds < minimumFashionVideoTimelineClipDurationSeconds
    || value.trimEndSeconds > value.durationSeconds + 0.05
    || typeof value.volume !== 'number'
    || !Number.isFinite(value.volume)
    || value.volume < 0
    || value.volume > maximumFashionVideoAudioVolume) return null;
  return {
    assetId: value.assetId,
    fileName: value.fileName.trim(),
    contentType: value.contentType,
    durationSeconds: Number(value.durationSeconds.toFixed(3)),
    trimStartSeconds: Number(value.trimStartSeconds.toFixed(3)),
    trimEndSeconds: Number(value.trimEndSeconds.toFixed(3)),
    volume: Number(value.volume.toFixed(3))
  };
}

function parseFashionVideoTextOverlays(value: unknown, durationSeconds: number): FashionVideoTextOverlay[] | null {
  if (!Array.isArray(value) || value.length > maximumFashionVideoTextOverlays) return null;
  const ids = new Set<string>();
  const overlays: FashionVideoTextOverlay[] = [];
  for (const overlay of value) {
    if (!isRecord(overlay)
      || Object.keys(overlay).length !== 6
      || typeof overlay.id !== 'string'
      || !/^[A-Za-z0-9_-]{1,80}$/.test(overlay.id)
      || ids.has(overlay.id)
      || typeof overlay.text !== 'string'
      || !overlay.text.trim()
      || Array.from(overlay.text).length > maximumFashionVideoTextLength
      || /[\u0000-\u001f\u007f]/.test(overlay.text)
      || typeof overlay.startSeconds !== 'number'
      || !Number.isFinite(overlay.startSeconds)
      || overlay.startSeconds < 0
      || typeof overlay.endSeconds !== 'number'
      || !Number.isFinite(overlay.endSeconds)
      || overlay.endSeconds - overlay.startSeconds < minimumFashionVideoTimelineClipDurationSeconds
      || overlay.endSeconds > durationSeconds + 0.001
      || (overlay.position !== 'top' && overlay.position !== 'center' && overlay.position !== 'bottom')
      || typeof overlay.fontSize !== 'number'
      || !Number.isInteger(overlay.fontSize)
      || overlay.fontSize < 18
      || overlay.fontSize > 96) return null;
    ids.add(overlay.id);
    overlays.push({
      id: overlay.id,
      text: overlay.text.trim(),
      startSeconds: Number(overlay.startSeconds.toFixed(3)),
      endSeconds: Number(overlay.endSeconds.toFixed(3)),
      position: overlay.position,
      fontSize: overlay.fontSize
    });
  }
  return overlays;
}

function parseFashionVideoImageOverlays(value: unknown, durationSeconds: number): FashionVideoImageOverlay[] | null {
  if (!Array.isArray(value) || value.length > maximumFashionVideoImageOverlays) return null;
  const ids = new Set<string>();
  const overlays: FashionVideoImageOverlay[] = [];
  for (const overlay of value) {
    if (!isRecord(overlay)
      || Object.keys(overlay).length !== 6
      || typeof overlay.id !== 'string'
      || !/^[A-Za-z0-9_-]{1,80}$/.test(overlay.id)
      || ids.has(overlay.id)
      || typeof overlay.sourcePostId !== 'string'
      || !/^[A-Za-z0-9_-]{1,120}$/.test(overlay.sourcePostId)
      || typeof overlay.startSeconds !== 'number'
      || !Number.isFinite(overlay.startSeconds)
      || overlay.startSeconds < 0
      || typeof overlay.endSeconds !== 'number'
      || !Number.isFinite(overlay.endSeconds)
      || overlay.endSeconds - overlay.startSeconds < minimumFashionVideoTimelineClipDurationSeconds
      || overlay.endSeconds > durationSeconds + 0.001
      || !isFashionVideoImageOverlayPosition(overlay.position)
      || typeof overlay.sizePercent !== 'number'
      || !Number.isInteger(overlay.sizePercent)
      || overlay.sizePercent < 10
      || overlay.sizePercent > 70) return null;
    ids.add(overlay.id);
    overlays.push({
      id: overlay.id,
      sourcePostId: overlay.sourcePostId,
      startSeconds: Number(overlay.startSeconds.toFixed(3)),
      endSeconds: Number(overlay.endSeconds.toFixed(3)),
      position: overlay.position,
      sizePercent: overlay.sizePercent
    });
  }
  return overlays;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function parseTrimRange(input: Record<string, unknown>): Omit<FashionVideoTrimInput, 'sourcePostId'> | null {
  const startSeconds = input.startSeconds;
  const endSeconds = input.endSeconds;
  if (
    typeof startSeconds !== 'number'
    || !Number.isFinite(startSeconds)
    || typeof endSeconds !== 'number'
    || !Number.isFinite(endSeconds)
    || startSeconds < 0
    || endSeconds <= startSeconds
    || endSeconds > maximumFashionVideoSourceDurationSeconds
    || endSeconds - startSeconds > maximumFashionVideoExportDurationSeconds
  ) return null;
  return {
    startSeconds: Number(startSeconds.toFixed(3)),
    endSeconds: Number(endSeconds.toFixed(3))
  };
}

export function parseFashionVideoTrimInput(value: unknown): FashionVideoTrimInput | null {
  if (!isRecord(value)
    || Object.keys(value).length !== 3
    || typeof value.sourcePostId !== 'string'
    || !/^[A-Za-z0-9_-]{1,120}$/.test(value.sourcePostId)) return null;
  const range = parseTrimRange(value);
  return range ? { sourcePostId: value.sourcePostId, ...range } : null;
}

export function parseFashionVideoTimeline(value: unknown): FashionVideoTimelineInput | null {
  if (!isRecord(value)
    || Object.keys(value).some(key => !['sourcePostId', 'clips', 'canvasPreset', 'audioVolume', 'audioTrack', 'textOverlays', 'imageOverlays'].includes(key))
    || Object.keys(value).length < 2
    || Object.keys(value).length > 7
    || typeof value.sourcePostId !== 'string'
    || !/^[A-Za-z0-9_-]{1,120}$/.test(value.sourcePostId)
    || !Array.isArray(value.clips)
    || value.clips.length < 1
    || value.clips.length > maximumFashionVideoTimelineClips) return null;
  const canvasPreset = value.canvasPreset === undefined ? 'source' : value.canvasPreset;
  if (!isFashionVideoCanvasPreset(canvasPreset)) return null;
  const audioVolume = value.audioVolume === undefined ? 1 : value.audioVolume;
  if (typeof audioVolume !== 'number'
    || !Number.isFinite(audioVolume)
    || audioVolume < 0
    || audioVolume > maximumFashionVideoAudioVolume) return null;
  const audioTrack = value.audioTrack === undefined || value.audioTrack === null
    ? null
    : parseFashionVideoAudioTrack(value.audioTrack);
  if (value.audioTrack !== undefined && value.audioTrack !== null && !audioTrack) return null;
  const clipIds = new Set<string>();
  const clips: FashionVideoTimelineClip[] = [];
  let totalDurationSeconds = 0;
  for (const valueClip of value.clips) {
    if (!isRecord(valueClip)
      || Object.keys(valueClip).some(key => !['id', 'startSeconds', 'endSeconds', 'sourcePostId'].includes(key))
      || (Object.keys(valueClip).length !== 3 && Object.keys(valueClip).length !== 4)
      || typeof valueClip.id !== 'string'
      || !/^[A-Za-z0-9_-]{1,80}$/.test(valueClip.id)
      || clipIds.has(valueClip.id)
      || (valueClip.sourcePostId !== undefined
        && (typeof valueClip.sourcePostId !== 'string' || !/^[A-Za-z0-9_-]{1,120}$/.test(valueClip.sourcePostId)))) return null;
    const range = parseTrimRange(valueClip);
    if (!range) return null;
    const duration = Number((range.endSeconds - range.startSeconds).toFixed(3));
    if (duration < minimumFashionVideoTimelineClipDurationSeconds) return null;
    totalDurationSeconds = Number((totalDurationSeconds + duration).toFixed(3));
    if (totalDurationSeconds > maximumFashionVideoExportDurationSeconds) return null;
    clipIds.add(valueClip.id);
    clips.push({
      id: valueClip.id,
      ...range,
      ...(typeof valueClip.sourcePostId === 'string' ? { sourcePostId: valueClip.sourcePostId } : {})
    });
  }
  const textOverlays = value.textOverlays === undefined
    ? []
    : parseFashionVideoTextOverlays(value.textOverlays, totalDurationSeconds);
  if (!textOverlays) return null;
  const imageOverlays = value.imageOverlays === undefined
    ? []
    : parseFashionVideoImageOverlays(value.imageOverlays, totalDurationSeconds);
  if (!imageOverlays) return null;
  return { sourcePostId: value.sourcePostId, clips, canvasPreset, audioVolume, audioTrack, textOverlays, imageOverlays };
}

export function parseFashionVideoTrimTaskPayload(value: unknown): FashionVideoTrimTaskPayload | null {
  if (!isRecord(value) || typeof value.version !== 'number') return null;
  if (value.version === 1) {
    if (Object.keys(value).length !== 4) return null;
    const parsed = parseFashionVideoTrimInput({
      sourcePostId: value.sourcePostId,
      startSeconds: value.startSeconds,
      endSeconds: value.endSeconds
    });
    return parsed ? { version: 1, ...parsed } : null;
  }
  if ((value.version === 2 && Object.keys(value).length === 3)
    || (value.version === 3 && Object.keys(value).length === 4)
    || (value.version === 4 && Object.keys(value).length === 5)
    || (value.version === 5 && Object.keys(value).length === 6)
    || (value.version === 6 && Object.keys(value).length === 6)
    || (value.version === 7 && Object.keys(value).length === 7)
    || (value.version === 8 && Object.keys(value).length === 8)) {
    const parsed = parseFashionVideoTimeline({
      sourcePostId: value.sourcePostId,
      clips: value.clips,
      ...(value.canvasPreset === undefined ? {} : { canvasPreset: value.canvasPreset }),
      ...(value.audioVolume === undefined ? {} : { audioVolume: value.audioVolume }),
      ...(value.audioTrack === undefined ? {} : { audioTrack: value.audioTrack }),
      ...(value.textOverlays === undefined ? {} : { textOverlays: value.textOverlays }),
      ...(value.imageOverlays === undefined ? {} : { imageOverlays: value.imageOverlays })
    });
    return parsed ? { version: value.version, ...parsed } : null;
  }
  return null;
}

export function parseFashionVideoTrimRequest(value: unknown): FashionVideoTrimTaskPayload | null {
  if (!isRecord(value)) return null;
  const parsed = parseFashionVideoTimeline(value);
  if (parsed) return { version: 8, ...parsed };
  const trim = parseFashionVideoTrimInput(value);
  return trim ? { version: 1, ...trim } : null;
}

async function probeVideo(
  videoPath: string,
  ffprobePath: string
): Promise<{ durationSeconds: number; width: number; height: number; hasVideo: boolean; hasAudio: boolean }> {
  try {
    const { stdout } = await execFileAsync(ffprobePath, [
      '-v', 'error',
      '-show_entries', 'format=duration:stream=codec_type,width,height',
      '-of', 'json',
      videoPath
    ], { timeout: 30_000, maxBuffer: 64 * 1024, windowsHide: true });
    const parsed: unknown = JSON.parse(stdout);
    if (!isRecord(parsed) || !isRecord(parsed.format) || !Array.isArray(parsed.streams)) {
      throw new FashionVideoEditorError('FASHION_VIDEO_SOURCE_INVALID');
    }
    const durationSeconds = Number(parsed.format.duration);
    const videoStream = parsed.streams.find(stream => isRecord(stream) && stream.codec_type === 'video');
    const hasVideo = Boolean(videoStream);
    const hasAudio = parsed.streams.some(stream => isRecord(stream) && stream.codec_type === 'audio');
    const width = isRecord(videoStream) ? Number(videoStream.width) : 0;
    const height = isRecord(videoStream) ? Number(videoStream.height) : 0;
    if (!Number.isFinite(durationSeconds) || durationSeconds <= 0
      || !hasVideo || !Number.isSafeInteger(width) || !Number.isSafeInteger(height)
      || width < 2 || height < 2 || width > 8192 || height > 8192) {
      throw new FashionVideoEditorError('FASHION_VIDEO_SOURCE_INVALID');
    }
    return { durationSeconds, width, height, hasVideo, hasAudio };
  } catch (error) {
    if (error instanceof FashionVideoEditorError) throw error;
    const processError = error as NodeJS.ErrnoException & { killed?: boolean };
    if (processError.code === 'ENOENT') throw new FashionVideoEditorError('FASHION_VIDEO_PROCESSOR_UNAVAILABLE');
    throw new FashionVideoEditorError(processError.killed
      ? 'FASHION_VIDEO_PROBE_TIMEOUT'
      : 'FASHION_VIDEO_SOURCE_INVALID');
  }
}

async function inspectFashionStudioImage(imagePath: string): Promise<void> {
  let info;
  try {
    info = await stat(imagePath);
  } catch (error) {
    const fileError = error as NodeJS.ErrnoException;
    if (fileError.code === 'ENOENT') throw new FashionVideoEditorError('FASHION_STUDIO_IMAGE_NOT_FOUND');
    throw new FashionVideoEditorError('FASHION_STUDIO_IMAGE_INVALID');
  }
  if (!info.isFile() || info.size <= 0 || info.size > maximumFashionStudioImageSizeBytes) {
    throw new FashionVideoEditorError('FASHION_STUDIO_IMAGE_INVALID');
  }
  try {
    const metadata = await sharp(imagePath, { limitInputPixels: 40_000_000, animated: false }).metadata();
    if (!metadata.width || !metadata.height
      || metadata.width > 8192 || metadata.height > 8192
      || !['jpeg', 'png', 'webp'].includes(metadata.format || '')
      || (metadata.pages && metadata.pages > 1)) {
      throw new FashionVideoEditorError('FASHION_STUDIO_IMAGE_INVALID');
    }
  } catch (error) {
    if (error instanceof FashionVideoEditorError) throw error;
    throw new FashionVideoEditorError('FASHION_STUDIO_IMAGE_INVALID');
  }
}

export async function inspectFashionStudioAudio(
  audioPath: string,
  contentType: FashionStudioAudioContentType,
  ffprobePath = process.env.FFPROBE_PATH || 'ffprobe'
): Promise<{ durationSeconds: number; sizeBytes: number }> {
  if (!fashionStudioAudioExtension(contentType)) {
    throw new FashionVideoEditorError('FASHION_STUDIO_AUDIO_FORMAT_INVALID');
  }
  let audioInfo;
  try {
    audioInfo = await stat(audioPath);
  } catch (error) {
    const fileError = error as NodeJS.ErrnoException;
    if (fileError.code === 'ENOENT') throw new FashionVideoEditorError('FASHION_STUDIO_AUDIO_NOT_FOUND');
    throw new FashionVideoEditorError('FASHION_STUDIO_AUDIO_INVALID');
  }
  if (!audioInfo.isFile() || audioInfo.size <= 0 || audioInfo.size > maximumFashionStudioAudioSizeBytes) {
    throw new FashionVideoEditorError('FASHION_STUDIO_AUDIO_SIZE_INVALID');
  }
  try {
    const { stdout } = await execFileAsync(ffprobePath, [
      '-v', 'error',
      '-show_entries', 'format=duration,format_name:stream=codec_type:stream_disposition=attached_pic',
      '-of', 'json',
      audioPath
    ], { timeout: 30_000, maxBuffer: 64 * 1024, windowsHide: true });
    const parsed: unknown = JSON.parse(stdout);
    if (!isRecord(parsed) || !isRecord(parsed.format) || !Array.isArray(parsed.streams)) {
      throw new FashionVideoEditorError('FASHION_STUDIO_AUDIO_INVALID');
    }
    const durationSeconds = Number(parsed.format.duration);
    const streamRecords = parsed.streams.filter(isRecord);
    const hasAudio = streamRecords.some(stream => stream.codec_type === 'audio');
    const hasUnsupportedVideo = streamRecords.some(stream =>
      stream.codec_type === 'video'
      && (!isRecord(stream.disposition) || stream.disposition.attached_pic !== 1)
    );
    const formatName = typeof parsed.format.format_name === 'string' ? parsed.format.format_name.split(',') : [];
    const expectedFormats: Record<FashionStudioAudioContentType, string[]> = {
      'audio/mpeg': ['mp3', 'mp2'],
      'audio/mp4': ['mov', 'mp4', 'm4a', '3gp', '3g2', 'mj2'],
      'audio/wav': ['wav'],
      'audio/x-wav': ['wav'],
      'audio/ogg': ['ogg'],
      'audio/webm': ['matroska', 'webm'],
      'audio/aac': ['aac'],
      'audio/flac': ['flac']
    };
    if (!formatName.some(name => expectedFormats[contentType].includes(name))) {
      throw new FashionVideoEditorError('FASHION_STUDIO_AUDIO_FORMAT_MISMATCH');
    }
    if (!hasAudio || hasUnsupportedVideo || !Number.isFinite(durationSeconds) || durationSeconds <= 0) {
      throw new FashionVideoEditorError('FASHION_STUDIO_AUDIO_INVALID');
    }
    if (durationSeconds > maximumFashionStudioAudioDurationSeconds) {
      throw new FashionVideoEditorError('FASHION_STUDIO_AUDIO_DURATION_INVALID');
    }
    return { durationSeconds: Number(durationSeconds.toFixed(3)), sizeBytes: audioInfo.size };
  } catch (error) {
    if (error instanceof FashionVideoEditorError) throw error;
    const processError = error as NodeJS.ErrnoException & { killed?: boolean };
    if (processError.code === 'ENOENT') throw new FashionVideoEditorError('FASHION_VIDEO_PROCESSOR_UNAVAILABLE');
    throw new FashionVideoEditorError(processError.killed || processError.code === 'ETIMEDOUT'
      ? 'FASHION_STUDIO_AUDIO_PROBE_TIMEOUT'
      : 'FASHION_STUDIO_AUDIO_INVALID');
  }
}

export async function renderFashionVideoTrim(
  sourcePath: string,
  outputDirectory: string,
  trim: Pick<FashionVideoTrimInput, 'startSeconds' | 'endSeconds'>,
  options: {
    ffmpegPath?: string;
    ffprobePath?: string;
    signal?: AbortSignal;
    audioVolume?: number;
    onClip?: (index: number, count: number, clip: FashionVideoTimelineClip) => Promise<void> | void;
    onAssemble?: () => Promise<void> | void;
  } = {}
): Promise<{ videoPath: string; posterPath: string; durationSeconds: number; sizeBytes: number }> {
  const clips = parseFashionVideoTimeline({
    sourcePostId: 'trim-source',
    clips: [{ id: 'trim-1', ...trim }]
  })?.clips;
  if (!clips) throw new FashionVideoEditorError('FASHION_VIDEO_TRIM_RANGE_INVALID');
  return renderFashionVideoTimeline(sourcePath, outputDirectory, clips, options);
}

export async function renderFashionVideoTimeline(
  sourcePath: string,
  outputDirectory: string,
  inputClips: FashionVideoTimelineClip[],
  options: {
    ffmpegPath?: string;
    ffprobePath?: string;
    signal?: AbortSignal;
    audioVolume?: number;
    canvasPreset?: FashionVideoCanvasPreset;
    sourcePathsByPostId?: ReadonlyMap<string, string>;
    imageOverlayPathsByPostId?: ReadonlyMap<string, string>;
    audioTrack?: FashionVideoAudioTrack | null;
    audioTrackPath?: string;
    textOverlays?: FashionVideoTextOverlay[];
    imageOverlays?: FashionVideoImageOverlay[];
    onClip?: (index: number, count: number, clip: FashionVideoTimelineClip) => Promise<void> | void;
    onAssemble?: () => Promise<void> | void;
    onMixAudio?: () => Promise<void> | void;
    onRenderTextOverlays?: () => Promise<void> | void;
    onRenderImageOverlays?: () => Promise<void> | void;
  } = {}
): Promise<{ videoPath: string; posterPath: string; durationSeconds: number; sizeBytes: number }> {
  const textOverlays = options.textOverlays || [];
  const imageOverlays = options.imageOverlays || [];
  const parsedTimeline = parseFashionVideoTimeline({
    sourcePostId: 'timeline-source',
    clips: inputClips,
    textOverlays,
    imageOverlays
  });
  if (!parsedTimeline) throw new FashionVideoEditorError('FASHION_VIDEO_TRIM_RANGE_INVALID');
  const clips = parsedTimeline.clips;
  const parsedTextOverlays = parsedTimeline.textOverlays;
  const parsedImageOverlays = parsedTimeline.imageOverlays;
  const canvasPreset = options.canvasPreset ?? parsedTimeline.canvasPreset;
  if (!isFashionVideoCanvasPreset(canvasPreset)) {
    throw new FashionVideoEditorError('FASHION_VIDEO_CANVAS_PRESET_INVALID');
  }
  const audioVolume = options.audioVolume ?? 1;
  if (!Number.isFinite(audioVolume) || audioVolume < 0 || audioVolume > maximumFashionVideoAudioVolume) {
    throw new FashionVideoEditorError('FASHION_VIDEO_AUDIO_VOLUME_INVALID');
  }
  if (options.signal?.aborted) throw new FashionVideoEditorError('FASHION_VIDEO_TRIM_CANCELLED');
  const sourceInfo = await stat(sourcePath);
  if (!sourceInfo.isFile() || sourceInfo.size <= 0 || sourceInfo.size > maximumFashionVideoSourceSizeBytes) {
    throw new FashionVideoEditorError('FASHION_VIDEO_SOURCE_SIZE_INVALID');
  }
  const ffmpegPath = options.ffmpegPath || process.env.FFMPEG_PATH || 'ffmpeg';
  const ffprobePath = options.ffprobePath || process.env.FFPROBE_PATH || 'ffprobe';
  const sourcePaths = new Map<string, string>([['', sourcePath]]);
  for (const [sourcePostId, sourceFilePath] of options.sourcePathsByPostId || []) {
    if (!/^[A-Za-z0-9_-]{1,120}$/.test(sourcePostId) || typeof sourceFilePath !== 'string') {
      throw new FashionVideoEditorError('FASHION_STUDIO_SOURCE_REFERENCE_INVALID');
    }
    sourcePaths.set(sourcePostId, sourceFilePath);
  }
  const imageOverlayPaths = new Map<string, string>();
  for (const [sourcePostId, imageFilePath] of options.imageOverlayPathsByPostId || []) {
    if (!/^[A-Za-z0-9_-]{1,120}$/.test(sourcePostId) || typeof imageFilePath !== 'string') {
      throw new FashionVideoEditorError('FASHION_STUDIO_IMAGE_REFERENCE_INVALID');
    }
    imageOverlayPaths.set(sourcePostId, imageFilePath);
  }
  for (const overlay of parsedImageOverlays) {
    const imagePath = imageOverlayPaths.get(overlay.sourcePostId);
    if (!imagePath) throw new FashionVideoEditorError('FASHION_STUDIO_IMAGE_REFERENCE_INVALID');
    await inspectFashionStudioImage(imagePath);
  }
  const sourceMetadata = new Map<string, Awaited<ReturnType<typeof probeVideo>>>();
  for (const clip of clips) {
    const sourceKey = clip.sourcePostId || '';
    const clipSourcePath = sourcePaths.get(sourceKey);
    if (!clipSourcePath) throw new FashionVideoEditorError('FASHION_STUDIO_SOURCE_REFERENCE_INVALID');
    let metadata = sourceMetadata.get(sourceKey);
    if (!metadata) {
      const info = await stat(clipSourcePath);
      if (!info.isFile() || info.size <= 0 || info.size > maximumFashionVideoSourceSizeBytes) {
        throw new FashionVideoEditorError('FASHION_VIDEO_SOURCE_SIZE_INVALID');
      }
      metadata = await probeVideo(clipSourcePath, ffprobePath);
      sourceMetadata.set(sourceKey, metadata);
    }
    if (clip.endSeconds > metadata.durationSeconds + 0.05) {
      throw new FashionVideoEditorError('FASHION_VIDEO_TRIM_RANGE_EXCEEDS_SOURCE');
    }
  }
  const hasSourceAudio = [...sourceMetadata.values()].some(metadata => metadata.hasAudio);
  const canvasSource = sourceMetadata.get(clips[0].sourcePostId || '')!;
  const canvasDimensions = canvasPreset === 'portrait'
    ? { width: 1080, height: 1920 }
    : canvasPreset === 'square'
      ? { width: 1080, height: 1080 }
      : canvasPreset === 'landscape'
        ? { width: 1920, height: 1080 }
        : null;
  const canvasScale = canvasDimensions
    ? 1
    : Math.min(1, 1920 / canvasSource.width, 1920 / canvasSource.height);
  const canvasWidth = canvasDimensions?.width
    ?? Math.max(2, Math.floor(canvasSource.width * canvasScale / 2) * 2);
  const canvasHeight = canvasDimensions?.height
    ?? Math.max(2, Math.floor(canvasSource.height * canvasScale / 2) * 2);
  const audioTrack = options.audioTrack || null;
  if (audioTrack && !options.audioTrackPath) {
    throw new FashionVideoEditorError('FASHION_STUDIO_AUDIO_REFERENCE_INVALID');
  }
  if (audioTrack && options.audioTrackPath) {
    const actualAudio = await inspectFashionStudioAudio(options.audioTrackPath, audioTrack.contentType, ffprobePath);
    if (
      Math.abs(actualAudio.durationSeconds - audioTrack.durationSeconds) > Math.max(0.1, actualAudio.durationSeconds * 0.001)
      || audioTrack.trimEndSeconds > actualAudio.durationSeconds + 0.05
    ) throw new FashionVideoEditorError('FASHION_STUDIO_AUDIO_REFERENCE_INVALID');
  }

  await mkdir(outputDirectory, { recursive: true });
  const videoPath = path.join(outputDirectory, 'trimmed.mp4');
  const hasVisualOverlays = parsedTextOverlays.length > 0 || parsedImageOverlays.length > 0;
  const assembledVideoPath = audioTrack || hasVisualOverlays
    ? path.join(outputDirectory, 'timeline-video.mp4')
    : videoPath;
  const posterPath = path.join(outputDirectory, 'poster.jpg');
  const expectedDurationSeconds = Number(clips.reduce(
    (total, clip) => total + clip.endSeconds - clip.startSeconds,
    0
  ).toFixed(3));
  const segmentPaths = clips.map((_, index) => path.join(outputDirectory, `segment-${String(index).padStart(2, '0')}.mp4`));
  try {
    for (const [index, clip] of clips.entries()) {
      if (options.signal?.aborted) throw new FashionVideoEditorError('FASHION_VIDEO_TRIM_CANCELLED');
      const segmentDuration = clip.endSeconds - clip.startSeconds;
      await options.onClip?.(index, clips.length, clip);
      const sourceKey = clip.sourcePostId || '';
      const clipSourcePath = sourcePaths.get(sourceKey)!;
      const source = sourceMetadata.get(sourceKey)!;
      const segmentArgs = [
        '-hide_banner', '-loglevel', 'error', '-y',
        '-ss', clip.startSeconds.toFixed(3), '-i', clipSourcePath
      ];
      if (!source.hasAudio && (hasSourceAudio || audioTrack)) {
        segmentArgs.push('-f', 'lavfi', '-t', segmentDuration.toFixed(3), '-i', 'anullsrc=channel_layout=stereo:sample_rate=48000');
      }
      segmentArgs.push(
        '-t', segmentDuration.toFixed(3),
        '-map', '0:v:0',
        '-vf', `scale=${canvasWidth}:${canvasHeight}:force_original_aspect_ratio=decrease,pad=${canvasWidth}:${canvasHeight}:(ow-iw)/2:(oh-ih)/2:color=black,setsar=1,fps=30`,
        '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '24',
        '-maxrate', '6M', '-bufsize', '12M', '-pix_fmt', 'yuv420p'
      );
      if (source.hasAudio) {
        segmentArgs.push('-map', '0:a:0', '-af', `volume=${audioVolume.toFixed(3)}`, '-c:a', 'aac', '-b:a', '128k', '-ar', '48000', '-ac', '2');
      } else if (hasSourceAudio || audioTrack) {
        segmentArgs.push('-map', '1:a:0', '-c:a', 'aac', '-b:a', '128k', '-ar', '48000', '-ac', '2');
      }
      segmentArgs.push(
        '-movflags', '+faststart', '-threads', '2',
        segmentPaths[index]
      );
      await execFileAsync(ffmpegPath, segmentArgs, {
        timeout: 10 * 60_000,
        maxBuffer: 256 * 1024,
        windowsHide: true,
        ...(options.signal ? { signal: options.signal } : {})
      });
    }
    if (options.signal?.aborted) throw new FashionVideoEditorError('FASHION_VIDEO_TRIM_CANCELLED');
    await options.onAssemble?.();
    const concatPath = path.join(outputDirectory, 'timeline.concat');
    const concatManifest = segmentPaths.map((_, index) => `file 'segment-${String(index).padStart(2, '0')}.mp4'`).join('\n');
    await writeFile(concatPath, `${concatManifest}\n`, { flag: 'wx', mode: 0o600 });
    await execFileAsync(ffmpegPath, [
      '-hide_banner', '-loglevel', 'error', '-y',
      '-f', 'concat', '-safe', '0', '-i', concatPath,
      '-c', 'copy', '-movflags', '+faststart',
      assembledVideoPath
    ], {
      timeout: 3 * 60_000,
      maxBuffer: 256 * 1024,
      windowsHide: true,
      cwd: outputDirectory,
      ...(options.signal ? { signal: options.signal } : {})
    });
    let currentVideoPath = assembledVideoPath;
    if (audioTrack && options.audioTrackPath) {
      await options.onMixAudio?.();
      const musicDuration = Number((audioTrack.trimEndSeconds - audioTrack.trimStartSeconds).toFixed(3));
      const musicFilter = `[1:a]atrim=duration=${musicDuration.toFixed(3)},asetpts=PTS-STARTPTS,volume=${audioTrack.volume.toFixed(3)},apad=whole_dur=${expectedDurationSeconds.toFixed(3)}[studio_music]`;
      const filter = hasSourceAudio || audioTrack
        ? `[0:a]anull[original_audio];${musicFilter};[original_audio][studio_music]amix=inputs=2:duration=longest:dropout_transition=0:normalize=0,alimiter=limit=0.95[mixed_audio]`
        : `${musicFilter};[studio_music]anull[mixed_audio]`;
      await execFileAsync(ffmpegPath, [
        '-hide_banner', '-loglevel', 'error', '-y',
        '-i', assembledVideoPath,
        '-ss', audioTrack.trimStartSeconds.toFixed(3), '-i', options.audioTrackPath,
        '-filter_complex', filter,
        '-map', '0:v:0', '-map', '[mixed_audio]',
        '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k',
        '-t', expectedDurationSeconds.toFixed(3),
        '-movflags', '+faststart',
        hasVisualOverlays ? path.join(outputDirectory, 'timeline-audio.mp4') : videoPath
      ], {
        timeout: 3 * 60_000,
        maxBuffer: 256 * 1024,
        windowsHide: true,
        ...(options.signal ? { signal: options.signal } : {})
      });
      currentVideoPath = hasVisualOverlays ? path.join(outputDirectory, 'timeline-audio.mp4') : videoPath;
    }
    if (hasVisualOverlays) {
      if (parsedTextOverlays.length) await options.onRenderTextOverlays?.();
      if (parsedImageOverlays.length) await options.onRenderImageOverlays?.();
      const fontCandidates = [
        process.env.FASHION_STUDIO_FONT_FILE,
        '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc',
        '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
      ].filter((candidate): candidate is string => Boolean(candidate));
      let fontPath: string | null = null;
      if (parsedTextOverlays.length) {
        for (const candidate of fontCandidates) {
          try {
            if ((await stat(candidate)).isFile()) {
              fontPath = candidate;
              break;
            }
          } catch (error) {
            const fileError = error as NodeJS.ErrnoException;
            if (fileError.code !== 'ENOENT') throw error;
          }
        }
        if (!fontPath) throw new FashionVideoEditorError('FASHION_STUDIO_TEXT_FONT_UNAVAILABLE');
      }
      const drawtextPath = (filePath: string) =>
        `'${filePath.replace(/\\/g, '\\\\').replace(/:/g, '\\:').replace(/'/g, "'\\\\''").replace(/,/g, '\\,').replace(/\[/g, '\\[').replace(/\]/g, '\\]')}'`;
      const filters: string[] = [];
      const overlayInputArgs: string[] = ['-i', currentVideoPath];
      let currentVideoLabel = '[0:v]';
      for (const [index, overlay] of parsedImageOverlays.entries()) {
        const inputIndex = index + 1;
        const imagePath = imageOverlayPaths.get(overlay.sourcePostId)!;
        const scaledLabel = `[studio_image_${index}]`;
        const outputLabel = `[studio_composite_${index}]`;
        const imageWidth = Math.max(2, Math.floor(canvasWidth * overlay.sizePercent / 100 / 2) * 2);
        const imageHeight = Math.max(2, Math.floor(canvasHeight * overlay.sizePercent / 100 / 2) * 2);
        const margin = Math.max(8, Math.round(Math.min(canvasWidth, canvasHeight) * 0.025));
        const position = {
          'top-left': { x: String(margin), y: String(margin) },
          'top-right': { x: `main_w-overlay_w-${margin}`, y: String(margin) },
          center: { x: '(main_w-overlay_w)/2', y: '(main_h-overlay_h)/2' },
          'bottom-left': { x: String(margin), y: `main_h-overlay_h-${margin}` },
          'bottom-right': { x: `main_w-overlay_w-${margin}`, y: `main_h-overlay_h-${margin}` }
        }[overlay.position];
        overlayInputArgs.push('-loop', '1', '-framerate', '25', '-i', imagePath);
        filters.push(
          `[${inputIndex}:v]scale=${imageWidth}:${imageHeight}:force_original_aspect_ratio=decrease,format=rgba${scaledLabel}`,
          `${currentVideoLabel}${scaledLabel}overlay=x=${position.x}:y=${position.y}:enable='between(t,${overlay.startSeconds.toFixed(3)},${overlay.endSeconds.toFixed(3)})'${outputLabel}`
        );
        currentVideoLabel = outputLabel;
      }
      for (const [index, overlay] of parsedTextOverlays.entries()) {
        if (!fontPath) throw new FashionVideoEditorError('FASHION_STUDIO_TEXT_FONT_UNAVAILABLE');
        const textFilePath = path.join(outputDirectory, `text-overlay-${String(index).padStart(2, '0')}.txt`);
        await writeFile(textFilePath, overlay.text, { flag: 'wx', mode: 0o600 });
        const yPosition = overlay.position === 'top'
          ? 'h*0.12'
          : overlay.position === 'center'
            ? '(h-text_h)/2'
            : 'h-text_h-h*0.12';
        filters.push(
          `${currentVideoLabel}drawtext=fontfile=${drawtextPath(fontPath)}:textfile=${drawtextPath(textFilePath)}:expansion=none:fontsize=${overlay.fontSize}:fontcolor=white:box=1:boxcolor=black@0.58:boxborderw=14:x=(w-text_w)/2:y=${yPosition}:enable='between(t,${overlay.startSeconds.toFixed(3)},${overlay.endSeconds.toFixed(3)})'[studio_text_${index}]`
        );
        currentVideoLabel = `[studio_text_${index}]`;
      }
      const visualOutputLabel = '[studio_video]';
      filters.push(`${currentVideoLabel}null${visualOutputLabel}`);
      await execFileAsync(ffmpegPath, [
        '-hide_banner', '-loglevel', 'error', '-y',
        ...overlayInputArgs,
        '-filter_complex', filters.join(';'),
        '-map', visualOutputLabel, '-map', '0:a?',
        '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '24',
        '-maxrate', '6M', '-bufsize', '12M', '-pix_fmt', 'yuv420p',
        '-c:a', 'copy',
        '-t', expectedDurationSeconds.toFixed(3),
        '-movflags', '+faststart', '-threads', '2',
        videoPath
      ], {
        timeout: 5 * 60_000,
        maxBuffer: 256 * 1024,
        windowsHide: true,
        ...(options.signal ? { signal: options.signal } : {})
      });
    }
    if (options.signal?.aborted) throw new FashionVideoEditorError('FASHION_VIDEO_TRIM_CANCELLED');
    await execFileAsync(ffmpegPath, [
      '-hide_banner', '-loglevel', 'error', '-y',
      '-ss', (expectedDurationSeconds / 2).toFixed(3), '-i', videoPath,
      '-frames:v', '1', '-vf', 'scale=w=1400:h=1400:force_original_aspect_ratio=decrease',
      '-q:v', '3', posterPath
    ], {
      timeout: 30_000,
      maxBuffer: 128 * 1024,
      windowsHide: true,
      ...(options.signal ? { signal: options.signal } : {})
    });
  } catch (error) {
    if (error instanceof FashionVideoEditorError) throw error;
    if (options.signal?.aborted) throw new FashionVideoEditorError('FASHION_VIDEO_TRIM_CANCELLED');
    const processError = error as NodeJS.ErrnoException & { killed?: boolean };
    if (processError.code === 'ENOENT') throw new FashionVideoEditorError('FASHION_VIDEO_PROCESSOR_UNAVAILABLE');
    throw new FashionVideoEditorError(processError.killed || processError.code === 'ETIMEDOUT'
      ? 'FASHION_VIDEO_TRIM_TIMEOUT'
      : 'FASHION_VIDEO_TRIM_FAILED');
  }

  const [videoInfo, posterInfo, renderedVideo] = await Promise.all([
    stat(videoPath),
    stat(posterPath),
    probeVideo(videoPath, ffprobePath)
  ]);
  if (
    !videoInfo.isFile()
    || videoInfo.size <= 0
    || videoInfo.size > maximumFashionVideoExportSizeBytes
    || !posterInfo.isFile()
    || posterInfo.size <= 0
    || posterInfo.size > 2_200_000
    || Math.abs(renderedVideo.durationSeconds - expectedDurationSeconds) > Math.max(0.5, clips.length * 0.08)
  ) throw new FashionVideoEditorError('FASHION_VIDEO_EXPORT_INVALID');

  return { videoPath, posterPath, durationSeconds: renderedVideo.durationSeconds, sizeBytes: videoInfo.size };
}
