import { execFile } from 'node:child_process';
import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { maximumFashionSourceDurationSeconds, maximumFashionSourceSizeBytes } from './fashionVideoSlicing';

const execFileAsync = promisify(execFile);
const allowedVideoExtensions = new Set(['mp4', 'webm', 'mov', 'm4v', 'mkv', 'avi', 'flv']);
const allowedSocialHosts = new Set([
  'tiktok.com',
  'www.tiktok.com',
  'm.tiktok.com',
  'vm.tiktok.com',
  'vt.tiktok.com',
  't.tiktok.com',
  'instagram.com',
  'www.instagram.com',
  'm.instagram.com',
  'instagr.am',
  'www.instagr.am',
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'music.youtube.com',
  'youtu.be',
  'facebook.com',
  'www.facebook.com',
  'm.facebook.com',
  'fb.watch',
  'www.fb.watch',
  'fb.com',
  'www.fb.com'
]);

export class FashionVideoImportError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = 'FashionVideoImportError';
  }
}

export type DownloadedSocialVideo = {
  videoPath: string;
  title: string;
};

const isDirectVideoUrl = (url: URL) => {
  const pathname = url.pathname.toLowerCase();
  if (!pathname || pathname === '/') return false;
  const extension = pathname.split('.').pop();
  return Boolean(extension && allowedVideoExtensions.has(extension.replace(/[^a-z0-9]/g, '')));
};

export function normalizeSocialVideoUrl(input: unknown): string {
  if (typeof input !== 'string' || input.length > 2048) {
    throw new FashionVideoImportError('FASHION_SOCIAL_VIDEO_URL_INVALID');
  }
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    throw new FashionVideoImportError('FASHION_SOCIAL_VIDEO_URL_INVALID');
  }
  const normalizedHostname = url.hostname.toLowerCase();
  const isSupportedSocialHost = allowedSocialHosts.has(normalizedHostname);
  if (url.protocol !== 'https:'
    || url.username
    || url.password
    || (url.port && url.port !== '443')
    || url.pathname === '/') {
    throw new FashionVideoImportError('FASHION_SOCIAL_VIDEO_URL_INVALID');
  }
  if (!isSupportedSocialHost && !isDirectVideoUrl(url)) {
    throw new FashionVideoImportError('FASHION_SOCIAL_VIDEO_URL_INVALID');
  }
  url.hash = '';
  return url.toString();
}

export async function downloadSocialVideo(input: unknown, workingDirectory: string): Promise<DownloadedSocialVideo> {
  const url = normalizeSocialVideoUrl(input);
  const outputTemplate = path.join(workingDirectory, 'source.%(ext)s');
  let result: { stdout: string };
  try {
    const downloaderArgs = [
      '--ignore-config',
      '--no-warnings',
      '--no-call-home',
      '--no-playlist',
      '--no-progress',
      '--max-downloads',
      '1',
      '--max-filesize',
      '500M',
      '--match-filter',
      `duration <= ${maximumFashionSourceDurationSeconds}`,
      '--format',
      'best[ext=mp4]/best[ext=webm]/best',
      '--write-thumbnail',
      '--output',
      outputTemplate,
      '--print',
      'after_move:%(title)s',
      '--',
      url
    ];
    const configuredDownloader = process.env.YT_DLP_PATH;
    result = await execFileAsync(
      configuredDownloader || process.env.PYTHON || 'python3',
      configuredDownloader ? downloaderArgs : ['-m', 'yt_dlp', ...downloaderArgs],
      {
        timeout: 20 * 60_000,
        maxBuffer: 1024 * 1024,
        windowsHide: true
      }
    );
  } catch (error) {
    const processError = error as NodeJS.ErrnoException & { killed?: boolean; stderr?: string };
    if (processError.code === 'ENOENT' || /No module named ['"]?yt_dlp['"]?/.test(processError.stderr || '')) {
      throw new FashionVideoImportError('FASHION_VIDEO_DOWNLOADER_UNAVAILABLE');
    }
    if (/max-filesize|file is larger than/i.test(processError.stderr || '')) {
      throw new FashionVideoImportError('FASHION_SOURCE_VIDEO_TOO_LARGE');
    }
    if (/duration|longer than/i.test(processError.stderr || '')) {
      throw new FashionVideoImportError('FASHION_SOURCE_VIDEO_DURATION_INVALID');
    }
    if (processError.killed || processError.code === 'ETIMEDOUT') {
      throw new FashionVideoImportError('FASHION_SOCIAL_VIDEO_DOWNLOAD_TIMEOUT');
    }
    throw new FashionVideoImportError('FASHION_SOCIAL_VIDEO_DOWNLOAD_FAILED');
  }

  const files = await readdir(workingDirectory);
  const videoFile = files.find(file => {
    const extension = path.extname(file).slice(1).toLowerCase();
    return file.startsWith('source.') && allowedVideoExtensions.has(extension);
  });
  if (!videoFile) throw new FashionVideoImportError('FASHION_SOCIAL_VIDEO_DOWNLOAD_FAILED');
  const videoPath = path.join(workingDirectory, videoFile);
  const videoInfo = await stat(videoPath);
  if (!videoInfo.size || videoInfo.size > maximumFashionSourceSizeBytes) {
    throw new FashionVideoImportError('FASHION_SOURCE_VIDEO_TOO_LARGE');
  }
  return { videoPath, title: result.stdout.trim().split(/\r?\n/, 1)[0].slice(0, 120) };
}
