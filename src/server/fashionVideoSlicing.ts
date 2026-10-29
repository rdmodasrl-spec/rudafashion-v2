import { execFile } from 'node:child_process';
import { mkdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
export const maximumFashionSourceDurationSeconds = 30 * 60;
export const maximumFashionSourceSizeBytes = 500 * 1024 * 1024;
export const maximumFashionClipDurationSeconds = 180;
export const maximumFashionClipSizeBytes = 100 * 1024 * 1024;
const maximumClipCount = 16;

export class FashionVideoProcessingError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = 'FashionVideoProcessingError';
  }
}

export type FashionVideoClipFile = {
  videoPath: string;
  posterPath: string;
  startSeconds: number;
  endSeconds: number;
  durationSeconds: number;
};

export function parseFashionClipCount(value: unknown): 4 | 8 | 12 | 16 | null {
  if (value === 4 || value === 8 || value === 12 || value === 16) return value;
  if (typeof value === 'string' && ['4', '8', '12', '16'].includes(value)) return Number(value) as 4 | 8 | 12 | 16;
  return null;
}

export function planFashionVideoCuts(
  durationSeconds: number,
  sceneTimes: number[],
  clipCount: 4 | 8 | 12 | 16
): number[] {
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0 || durationSeconds > maximumFashionSourceDurationSeconds) {
    throw new FashionVideoProcessingError('FASHION_SOURCE_VIDEO_DURATION_INVALID');
  }
  if (durationSeconds / clipCount > maximumFashionClipDurationSeconds) {
    throw new FashionVideoProcessingError('FASHION_SLICE_COUNT_TOO_LOW');
  }

  const uniformBoundaries = Array.from({ length: clipCount + 1 }, (_, index) => durationSeconds * index / clipCount);
  const boundaries = [0];
  for (let index = 1; index < clipCount; index += 1) {
    const target = durationSeconds * index / clipCount;
    const tolerance = Math.min(15, durationSeconds / clipCount * 0.2);
    const candidates = sceneTimes
      .filter(time => Number.isFinite(time) && Math.abs(time - target) <= tolerance)
      .sort((first, second) => Math.abs(first - target) - Math.abs(second - target));
    const selected = candidates.find(time => {
      const previous = boundaries.at(-1) || 0;
      const nextTarget = durationSeconds * (index + 1) / clipCount;
      return time > previous + 1 && time < durationSeconds - 1 && nextTarget - time <= maximumFashionClipDurationSeconds;
    });
    const boundary = selected ?? target;
    if (boundary <= (boundaries.at(-1) || 0) || boundary >= durationSeconds) {
      throw new FashionVideoProcessingError('FASHION_VIDEO_SCENE_PLAN_INVALID');
    }
    boundaries.push(boundary);
  }
  boundaries.push(durationSeconds);

  const durations = boundaries.slice(1).map((end, index) => end - boundaries[index]);
  if (durations.some(duration => duration <= 0 || duration > maximumFashionClipDurationSeconds)) return uniformBoundaries;
  return boundaries;
}

async function probeVideoDuration(videoPath: string, ffprobePath: string): Promise<number> {
  try {
    const { stdout } = await execFileAsync(ffprobePath, [
      '-v', 'error',
      '-show_entries', 'format=duration',
      '-of', 'default=noprint_wrappers=1:nokey=1',
      videoPath
    ], { timeout: 30_000, maxBuffer: 32 * 1024, windowsHide: true });
    const duration = Number(stdout.trim());
    if (!Number.isFinite(duration) || duration <= 0 || duration > maximumFashionSourceDurationSeconds) {
      throw new FashionVideoProcessingError('FASHION_SOURCE_VIDEO_DURATION_INVALID');
    }
    return duration;
  } catch (error) {
    if (error instanceof FashionVideoProcessingError) throw error;
    const processError = error as NodeJS.ErrnoException & { killed?: boolean };
    if (processError.code === 'ENOENT') throw new FashionVideoProcessingError('FASHION_VIDEO_PROCESSOR_UNAVAILABLE');
    throw new FashionVideoProcessingError(processError.killed
      ? 'FASHION_VIDEO_PROBE_TIMEOUT'
      : 'FASHION_SOURCE_VIDEO_INVALID');
  }
}

async function detectSceneChanges(videoPath: string, ffmpegPath: string): Promise<number[]> {
  try {
    const { stderr } = await execFileAsync(ffmpegPath, [
      '-hide_banner', '-nostats', '-i', videoPath,
      '-vf', "fps=2,scale=320:-2,select='gt(scene,0.3)',showinfo",
      '-an', '-f', 'null', '-'
    ], { timeout: 5 * 60_000, maxBuffer: 8 * 1024 * 1024, windowsHide: true });
    return [...stderr.matchAll(/pts_time:([0-9]+(?:\.[0-9]+)?)/g)]
      .map(match => Number(match[1]))
      .filter(Number.isFinite);
  } catch (error) {
    const processError = error as NodeJS.ErrnoException & { killed?: boolean; stderr?: string };
    if (processError.code === 'ENOENT') throw new FashionVideoProcessingError('FASHION_VIDEO_PROCESSOR_UNAVAILABLE');
    if (processError.killed || processError.code === 'ETIMEDOUT') {
      throw new FashionVideoProcessingError('FASHION_VIDEO_SCENE_DETECTION_TIMEOUT');
    }
    throw new FashionVideoProcessingError('FASHION_VIDEO_SCENE_DETECTION_FAILED');
  }
}

export async function splitFashionVideo(
  sourcePath: string,
  outputDirectory: string,
  clipCount: 4 | 8 | 12 | 16,
  tools: { ffmpegPath?: string; ffprobePath?: string } = {}
): Promise<FashionVideoClipFile[]> {
  const ffmpegPath = tools.ffmpegPath || process.env.FFMPEG_PATH || 'ffmpeg';
  const ffprobePath = tools.ffprobePath || process.env.FFPROBE_PATH || 'ffprobe';
  const sourceInfo = await stat(sourcePath);
  if (!sourceInfo.isFile() || sourceInfo.size <= 0 || sourceInfo.size > maximumFashionSourceSizeBytes) {
    throw new FashionVideoProcessingError('FASHION_SOURCE_VIDEO_TOO_LARGE');
  }
  const duration = await probeVideoDuration(sourcePath, ffprobePath);
  const scenes = await detectSceneChanges(sourcePath, ffmpegPath);
  const boundaries = planFashionVideoCuts(duration, scenes, clipCount);
  await mkdir(outputDirectory, { recursive: true });

  const clips: FashionVideoClipFile[] = [];
  for (let index = 0; index < clipCount; index += 1) {
    const clipDuration = boundaries[index + 1] - boundaries[index];
    const videoPath = path.join(outputDirectory, `clip-${index + 1}.mp4`);
    const posterPath = path.join(outputDirectory, `clip-${index + 1}.jpg`);
    try {
      await execFileAsync(ffmpegPath, [
        '-hide_banner', '-loglevel', 'error', '-y',
        '-ss', boundaries[index].toFixed(3), '-i', sourcePath,
        '-t', clipDuration.toFixed(3),
        '-map', '0:v:0', '-map', '0:a:0?',
        '-vf', "scale=w='min(1920,iw)':h='min(1920,ih)':force_original_aspect_ratio=decrease:force_divisible_by=2",
        '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '28',
        '-maxrate', '4M', '-bufsize', '8M',
        '-c:a', 'aac', '-b:a', '128k',
        '-movflags', '+faststart', '-threads', '2',
        videoPath
      ], { timeout: 10 * 60_000, maxBuffer: 256 * 1024, windowsHide: true });
      await execFileAsync(ffmpegPath, [
        '-hide_banner', '-loglevel', 'error', '-y',
        '-ss', (clipDuration / 2).toFixed(3), '-i', videoPath,
        '-frames:v', '1', '-vf', 'scale=w=1400:h=1400:force_original_aspect_ratio=decrease',
        '-q:v', '3', posterPath
      ], { timeout: 30_000, maxBuffer: 128 * 1024, windowsHide: true });
      const [videoInfo, posterInfo] = await Promise.all([stat(videoPath), stat(posterPath)]);
      if (!videoInfo.size || videoInfo.size > maximumFashionClipSizeBytes) {
        throw new FashionVideoProcessingError('FASHION_PROCESSED_CLIP_TOO_LARGE');
      }
      if (!posterInfo.size || posterInfo.size > 2_200_000) {
        throw new FashionVideoProcessingError('FASHION_POST_VIDEO_POSTER_TOO_LARGE');
      }
      clips.push({
        videoPath,
        posterPath,
        startSeconds: boundaries[index],
        endSeconds: boundaries[index + 1],
        durationSeconds: clipDuration
      });
    } catch (error) {
      if (error instanceof FashionVideoProcessingError) throw error;
      const processError = error as NodeJS.ErrnoException & { killed?: boolean };
      if (processError.code === 'ENOENT') throw new FashionVideoProcessingError('FASHION_VIDEO_PROCESSOR_UNAVAILABLE');
      throw new FashionVideoProcessingError(processError.killed
        ? 'FASHION_VIDEO_TRANSCODE_TIMEOUT'
        : 'FASHION_VIDEO_TRANSCODE_FAILED');
    }
  }
  return clips;
}
