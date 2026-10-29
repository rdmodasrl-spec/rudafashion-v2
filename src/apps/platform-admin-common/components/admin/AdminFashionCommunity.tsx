import { getIntlLocale } from '../../../../i18n/translations';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Check, Download, Edit3, Film, Heart, History, Image as ImageIcon, Link2, LoaderCircle, MessageCircle, Pause, Play, Plus, Redo2, RefreshCw, Scissors, Search, ShieldAlert, Sparkles, Trash2, Undo2, UploadCloud, X } from 'lucide-react';
import { apiDelete, apiGet, apiPost, apiPostWithUploadProgress, apiRequest, resolveApiUrl } from '../../../../api/client';
import { useB2B } from '../../../../context/B2BContext';
import { resolveFashionStudioTimelinePosition } from '../../../../shared/fashionStudioTimeline';
import { AdminFashionReports } from './AdminFashionReports';

type FashionModerationItem = {
  id: string;
  image: string;
  videoUrl: string | null;
  mediaType: 'image' | 'video';
  mediaItems?: Array<{
    sourceStartSeconds?: number;
    sourceEndSeconds?: number;
    sourceClips?: Array<{ startSeconds: number; endSeconds: number }>;
  }>;
  merchantName: string;
  title: string;
  caption: string;
  category?: string;
  createdAt: string;
  publicationStatus: 'draft' | 'pending' | 'approved' | 'unpublished';
  rightsStatus?: 'authorized' | 'pending' | 'restricted';
  stats: { likes: number; comments: number; saves: number; views: number };
  comments: Array<{ id: string; displayName: string; text: string; createdAt: string }>;
};

type FashionModerationSummary = {
  total: number;
  draft: number;
  pending: number;
  approved: number;
  unpublished: number;
};

type FilterStatus = 'all' | 'draft' | 'pending' | 'approved' | 'unpublished';
type FashionStudioMode = 'upload' | 'slice' | 'import' | 'generate';
type FashionStudioTask = {
  id: string;
  goal?: string;
  status: string;
  plan: unknown;
  result: unknown;
  lastErrorCode?: string | null;
  updatedAt?: string;
};
type FashionStudioProjectDocument = {
  version: 9;
  mode: 'video.timeline';
  sourcePostId: string;
  clips: Array<{ id: string; startSeconds: number; endSeconds: number; sourcePostId?: string }>;
  canvasPreset: FashionStudioCanvasPreset;
  audioVolume: number;
  audioTrack: FashionStudioAudioTrack | null;
  textOverlays: FashionStudioTextOverlay[];
  imageOverlays: FashionStudioImageOverlay[];
  history: FashionStudioProjectVersion[];
};
type FashionStudioCanvasPreset = 'source' | 'portrait' | 'square' | 'landscape';
type FashionStudioAudioTrack = {
  assetId: string;
  fileName: string;
  contentType: 'audio/mpeg' | 'audio/mp4' | 'audio/wav' | 'audio/x-wav' | 'audio/ogg' | 'audio/webm' | 'audio/aac' | 'audio/flac';
  durationSeconds: number;
  trimStartSeconds: number;
  trimEndSeconds: number;
  volume: number;
};
type FashionStudioTimelineClip = { id: string; startSeconds: string; endSeconds: string; sourcePostId?: string };
/** parseStudioTimelineClips 的规范化结果：时间已经换算为秒数值。 */
type FashionStudioParsedTimelineClip = { id: string; startSeconds: number; endSeconds: number; sourcePostId?: string };
type FashionStudioTextOverlay = {
  id: string;
  text: string;
  startSeconds: number;
  endSeconds: number;
  position: 'top' | 'center' | 'bottom';
  fontSize: number;
};
type FashionStudioTextOverlayDraft = Omit<FashionStudioTextOverlay, 'startSeconds' | 'endSeconds'> & {
  startSeconds: string;
  endSeconds: string;
};
type FashionStudioImageOverlay = {
  id: string;
  sourcePostId: string;
  startSeconds: number;
  endSeconds: number;
  position: 'top-left' | 'top-right' | 'center' | 'bottom-left' | 'bottom-right';
  sizePercent: number;
};
type FashionStudioImageOverlayDraft = Omit<FashionStudioImageOverlay, 'startSeconds' | 'endSeconds'> & {
  startSeconds: string;
  endSeconds: string;
};
type FashionStudioProjectVersion = {
  id: string;
  createdAt: string;
  title: string;
  document: {
    sourcePostId: string;
    clips: Array<{ id: string; startSeconds: number; endSeconds: number; sourcePostId?: string }>;
    canvasPreset: FashionStudioCanvasPreset;
    audioVolume: number;
    audioTrack: FashionStudioAudioTrack | null;
    textOverlays: FashionStudioTextOverlay[];
    imageOverlays: FashionStudioImageOverlay[];
  };
};
type FashionStudioEditorSnapshot = {
  title: string;
  sourcePostId: string;
  clips: Array<{ id: string; startSeconds: number; endSeconds: number; sourcePostId?: string }>;
  canvasPreset: FashionStudioCanvasPreset;
  audioVolume: number;
  audioTrack: FashionStudioAudioTrack | null;
  textOverlays: FashionStudioTextOverlay[];
  imageOverlays: FashionStudioImageOverlay[];
};
type FashionStudioProject = {
  id: string;
  title: string;
  sourcePostId: string;
  document: FashionStudioProjectDocument;
  createdAt: string;
  updatedAt: string;
};
type FashionStudioVideoSource = Pick<FashionModerationItem, 'id' | 'title' | 'videoUrl' | 'image'> & {
  rightsStatus?: FashionModerationItem['rightsStatus'];
};
type FashionStudioImageSource = Pick<FashionModerationItem, 'id' | 'title' | 'image'> & {
  rightsStatus?: FashionModerationItem['rightsStatus'];
  supported?: boolean;
};
type FashionStudioGeneratedAsset = {
  id: string;
  title: string;
  previewUrl: string;
  sourceType: 'generated';
  mediaType: 'image';
  createdAt: string;
  rightsStatus?: 'authorized' | 'pending' | 'restricted';
  storageKey?: string | null;
  contentType?: string;
  sizeBytes?: number;
};
const isFilterStatus = (value: string): value is FilterStatus =>
  ['all', 'draft', 'pending', 'approved', 'unpublished'].includes(value);
const isFashionStudioMode = (value: string): value is FashionStudioMode =>
  ['upload', 'slice', 'import', 'generate'].includes(value);
const fashionCategories = ['女装趋势', '男装趋势', '鞋履趋势', '包袋配饰', '面料与针织', '秀场街拍'] as const;
const parseSocialVideoLinks = (value: string) =>
  Array.from(new Set(value.split(/[\r\n,]+/).map(url => url.trim()).filter(Boolean)));
const MAX_SOCIAL_VIDEO_LINKS = 3;
const MAX_STUDIO_TIMELINE_CLIPS = 12;
const MAX_STUDIO_TIMELINE_DURATION_SECONDS = 180;
const MAX_STUDIO_TEXT_OVERLAYS = 24;
const MAX_STUDIO_IMAGE_OVERLAYS = 8;
const MAX_STUDIO_AUDIO_FILE_SIZE_BYTES = 100 * 1024 * 1024;
const studioCanvasPresets: Record<FashionStudioCanvasPreset, { label: string; aspectRatio: string; previewWidth: string } | null> = {
  source: null,
  portrait: { label: '竖屏 9:16', aspectRatio: '9 / 16', previewWidth: 'min(100%, calc(42vh * 9 / 16))' },
  square: { label: '方形 1:1', aspectRatio: '1 / 1', previewWidth: 'min(100%, 42vh)' },
  landscape: { label: '横屏 16:9', aspectRatio: '16 / 9', previewWidth: 'min(100%, calc(42vh * 16 / 9))' }
};
const studioTaskIsTerminal = (status: string) => ['completed', 'failed', 'dead_letter', 'cancelled'].includes(status);
const studioTaskStatusLabel: Record<string, string> = {
  queued: '排队中',
  planning: '准备中',
  running: '处理中',
  verifying: '校验中',
  retrying: '自动重试',
  completed: '已完成',
  failed: '失败',
  dead_letter: '失败',
  cancelled: '已取消'
};
const studioTaskStageLabel: Record<string, string> = {
  loading_source: '读取源视频',
  rendering_timeline: '准备时间线',
  rendering_clip: '渲染片段',
  assembling_timeline: '拼接片段',
  mixing_audio: '混合背景音乐',
  rendering_text_overlays: '渲染文字与字幕',
  rendering_image_overlays: '渲染图片叠加轨',
  saving_output: '保存成品'
};
const getStudioTaskPlan = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
const getStudioTaskResult = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
const formatStudioTrimError = (code: string) => ({
  FASHION_VIDEO_TRIM_RANGE_EXCEEDS_SOURCE: '结束时间超过了源视频时长，请调整剪辑范围。',
  FASHION_VIDEO_TRIM_RANGE_INVALID: '时间线无效；每段至少 0.25 秒，最多 12 段，总时长不超过 180 秒。',
  FASHION_VIDEO_AUDIO_VOLUME_INVALID: '原声音量设置无效，请调整后重试。',
  FASHION_STUDIO_AUDIO_FORMAT_INVALID: '请选择 MP3、M4A、WAV、OGG、WebM、AAC 或 FLAC 音频。',
  FASHION_STUDIO_AUDIO_FORMAT_MISMATCH: '文件内容与音频格式不匹配，请重新导入原音频。',
  FASHION_STUDIO_AUDIO_SIZE_INVALID: '音频文件无效或超过 100 MB。',
  FASHION_STUDIO_AUDIO_TOO_LARGE: '音频文件不能超过 100 MB。',
  FASHION_STUDIO_AUDIO_DURATION_INVALID: '音频时长必须大于 0.25 秒且不超过 30 分钟。',
  FASHION_STUDIO_AUDIO_INVALID: '音频文件无法读取，请检查文件后重新导入。',
  FASHION_STUDIO_AUDIO_NOT_FOUND: '背景音乐文件不存在，请重新上传。',
  FASHION_STUDIO_AUDIO_REFERENCE_INVALID: '项目中的背景音乐信息无效，请重新上传音乐。',
  FASHION_STUDIO_AUDIO_REQUIRED: '请选择一个音频文件。',
  FASHION_STUDIO_AUDIO_PROBE_TIMEOUT: '音频检查超时，请尝试使用较短或较小的文件。',
  FASHION_STUDIO_AUDIO_PREVIEW_FAILED: '音乐预览暂时不可用；可以先保存项目后再试。',
  FASHION_STUDIO_AUDIO_TRACK_SETTINGS_INVALID: '背景音乐的入点、出点或音量设置无效，请检查音乐参数。',
  FASHION_STUDIO_TEXT_OVERLAY_INVALID: '字幕文字或时间范围无效；请检查内容并确保它在成片时长内。',
  FASHION_STUDIO_TEXT_FONT_UNAVAILABLE: '服务器缺少可用字体，无法渲染字幕；请配置 FASHION_STUDIO_FONT_FILE。',
  FASHION_STUDIO_IMAGE_SOURCE_NOT_FOUND: '叠加图片素材已不存在，请从素材列表重新选择。',
  FASHION_STUDIO_IMAGE_SOURCE_RESTRICTED: '该图片素材版权状态受限，不能用于导出。',
  FASHION_STUDIO_IMAGE_SOURCE_UNSUPPORTED: '该图片没有可安全读取的原文件；请重新上传到素材库。',
  FASHION_STUDIO_IMAGE_REFERENCE_INVALID: '项目中的图片叠加素材信息无效，请重新选择。',
  FASHION_STUDIO_IMAGE_NOT_FOUND: '图片素材文件已不存在，请重新上传到素材库。',
  FASHION_STUDIO_IMAGE_STORAGE_UNAVAILABLE: '图片素材存储暂不可用，请检查后台存储配置。',
  FASHION_STUDIO_IMAGE_INVALID: '图片素材无法读取或格式不受支持。',
  FASHION_STUDIO_IMAGE_TOO_LARGE: '叠加图片不能超过 12 MB。',
  FASHION_STUDIO_AUDIO_IN_USE: '当前项目或可恢复的历史版本仍引用这段音乐，原文件已保留。',
  FASHION_STUDIO_AUDIO_DELETE_FAILED: '背景音乐文件清理失败，请稍后重试。',
  FASHION_STUDIO_VIDEO_SOURCE_RESTRICTED: '该素材版权状态受限，不能生成新作品。',
  FASHION_STUDIO_VIDEO_SOURCE_NOT_FOUND: '原视频已不存在或无法读取，请从素材列表重新选择。',
  FASHION_STUDIO_PROJECT_INVALID: '项目名称或剪辑范围无效，请检查后重试。',
  FASHION_STUDIO_PROJECT_CHANGED_RETRY: '项目刚刚在其他操作中更新；请刷新项目后再保存。',
  FASHION_STUDIO_PROJECT_DATA_INVALID: '项目数据无法读取，请重新创建项目。',
  FASHION_STUDIO_PROJECT_NOT_FOUND: '项目已不存在，请刷新项目列表。',
  FASHION_STUDIO_SOURCE_REFERENCE_UNSUPPORTED: '该历史素材没有可安全读取的原文件；请重新导入原视频。',
  FASHION_STUDIO_SOURCE_STORAGE_UNAVAILABLE: '素材存储暂不可用，请检查后台存储配置。',
  FASHION_VIDEO_PROCESSOR_UNAVAILABLE: '服务器未安装或无法运行 FFmpeg/ffprobe。',
  FASHION_VIDEO_TRIM_TIMEOUT: '视频转码超时；可缩短片段后重试。',
  FASHION_VIDEO_EXPORT_INVALID: '导出文件校验失败，原素材未被修改。'
}[code] || code);
const formatClipTime = (seconds: number) => {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  return `${Math.floor(safeSeconds / 60)}:${String(safeSeconds % 60).padStart(2, '0')}`;
};
const parseStudioTimelineClips = (clips: FashionStudioTimelineClip[]) => {
  if (clips.length < 1 || clips.length > MAX_STUDIO_TIMELINE_CLIPS) return null;
  const ids = new Set<string>();
  const parsed: FashionStudioParsedTimelineClip[] = [];
  let duration = 0;
  for (const clip of clips) {
    const startSeconds = Number(clip.startSeconds);
    const endSeconds = Number(clip.endSeconds);
    const clipDuration = endSeconds - startSeconds;
    if (
      !/^[A-Za-z0-9_-]{1,80}$/.test(clip.id)
      || ids.has(clip.id)
      || !Number.isFinite(startSeconds)
      || !Number.isFinite(endSeconds)
      || startSeconds < 0
      || endSeconds > 30 * 60
      || clipDuration < 0.25
      || clipDuration > MAX_STUDIO_TIMELINE_DURATION_SECONDS
    ) return null;
    const normalizedStart = Number(startSeconds.toFixed(3));
    const normalizedEnd = Number(endSeconds.toFixed(3));
    duration = Number((duration + normalizedEnd - normalizedStart).toFixed(3));
    if (duration > MAX_STUDIO_TIMELINE_DURATION_SECONDS) return null;
    if (clip.sourcePostId !== undefined && !/^[A-Za-z0-9_-]{1,120}$/.test(clip.sourcePostId)) return null;
    ids.add(clip.id);
    parsed.push({
      id: clip.id,
      startSeconds: normalizedStart,
      endSeconds: normalizedEnd,
      ...(clip.sourcePostId ? { sourcePostId: clip.sourcePostId } : {})
    });
  }
  return parsed;
};
const parseStudioTextOverlays = (
  overlays: FashionStudioTextOverlayDraft[],
  durationSeconds: number
): FashionStudioTextOverlay[] | null => {
  if (overlays.length > MAX_STUDIO_TEXT_OVERLAYS) return null;
  const ids = new Set<string>();
  const parsed: FashionStudioTextOverlay[] = [];
  for (const overlay of overlays) {
    const startSeconds = Number(overlay.startSeconds);
    const endSeconds = Number(overlay.endSeconds);
    if (!/^[A-Za-z0-9_-]{1,80}$/.test(overlay.id)
      || ids.has(overlay.id)
      || !overlay.text.trim()
      || Array.from(overlay.text).length > 200
      || /[\u0000-\u001f\u007f]/.test(overlay.text)
      || !Number.isFinite(startSeconds)
      || !Number.isFinite(endSeconds)
      || startSeconds < 0
      || endSeconds - startSeconds < 0.25
      || endSeconds > durationSeconds + 0.001
      || !['top', 'center', 'bottom'].includes(overlay.position)
      || !Number.isInteger(overlay.fontSize)
      || overlay.fontSize < 18
      || overlay.fontSize > 96) return null;
    ids.add(overlay.id);
    parsed.push({
      ...overlay,
      text: overlay.text.trim(),
      startSeconds: Number(startSeconds.toFixed(3)),
      endSeconds: Number(endSeconds.toFixed(3))
    });
  }
  return parsed;
};
const parseStudioImageOverlays = (
  overlays: FashionStudioImageOverlayDraft[],
  durationSeconds: number
): FashionStudioImageOverlay[] | null => {
  if (overlays.length > MAX_STUDIO_IMAGE_OVERLAYS) return null;
  const ids = new Set<string>();
  const parsed: FashionStudioImageOverlay[] = [];
  for (const overlay of overlays) {
    const startSeconds = Number(overlay.startSeconds);
    const endSeconds = Number(overlay.endSeconds);
    if (!/^[A-Za-z0-9_-]{1,80}$/.test(overlay.id)
      || ids.has(overlay.id)
      || !/^[A-Za-z0-9_-]{1,120}$/.test(overlay.sourcePostId)
      || !Number.isFinite(startSeconds)
      || !Number.isFinite(endSeconds)
      || startSeconds < 0
      || endSeconds - startSeconds < 0.25
      || endSeconds > durationSeconds + 0.001
      || !['top-left', 'top-right', 'center', 'bottom-left', 'bottom-right'].includes(overlay.position)
      || !Number.isInteger(overlay.sizePercent)
      || overlay.sizePercent < 10
      || overlay.sizePercent > 70) return null;
    ids.add(overlay.id);
    parsed.push({
      ...overlay,
      startSeconds: Number(startSeconds.toFixed(3)),
      endSeconds: Number(endSeconds.toFixed(3))
    });
  }
  return parsed;
};
const isValidStudioAudioTrack = (track: FashionStudioAudioTrack | null) => !track || (
  Number.isFinite(track.trimStartSeconds)
  && Number.isFinite(track.trimEndSeconds)
  && track.trimStartSeconds >= 0
  && track.trimEndSeconds - track.trimStartSeconds >= 0.25
  && track.trimEndSeconds <= track.durationSeconds + 0.05
  && Number.isFinite(track.volume)
  && track.volume >= 0
  && track.volume <= 2
);

const readFileAsDataUrl = (file: Blob): Promise<string> => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('FILE_READ_FAILED'));
  reader.onerror = () => reject(new Error('FILE_READ_FAILED'));
  reader.readAsDataURL(file);
});

const createAdminVideoPoster = async (file: File, customPoster?: Blob): Promise<Blob> => {
  if (customPoster) return customPoster;
  const url = URL.createObjectURL(file);
  const video = document.createElement('video');
  video.preload = 'metadata';
  video.muted = true;
  video.playsInline = true;
  try {
    const duration = await new Promise<number>((resolve, reject) => {
      video.onloadedmetadata = () => resolve(video.duration);
      video.onerror = () => reject(new Error('视频读取失败'));
      video.src = url;
    });
    if (!Number.isFinite(duration) || duration <= 0 || duration > 180) throw new Error('视频时长不能超过 3 分钟');
    await new Promise<void>((resolve, reject) => {
      video.onseeked = () => resolve();
      video.onerror = () => reject(new Error('视频封面生成失败'));
      video.currentTime = duration / 2;
    });
    const scale = Math.min(1, 1400 / Math.max(video.videoWidth, video.videoHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
    canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('视频封面生成失败');
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(poster => poster ? resolve(poster) : reject(new Error('视频封面生成失败')), 'image/jpeg', 0.78);
    });
  } finally {
    video.removeAttribute('src');
    video.load();
    URL.revokeObjectURL(url);
  }
};

const compressAdminImage = async (file: File): Promise<Blob> => {
  if (file.size > 24 * 1024 * 1024) throw new Error('IMAGE_FILE_TOO_LARGE');
  const objectUrl = URL.createObjectURL(file);
  try {
    const image = new Image();
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error('INVALID_IMAGE'));
      image.src = objectUrl;
    });
    const scale = Math.min(1, 1800 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('IMAGE_PROCESSING_UNAVAILABLE');
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.86));
    if (!blob) throw new Error('IMAGE_PROCESSING_UNAVAILABLE');
    if (blob.size > 1.5 * 1024 * 1024) throw new Error('IMAGE_OUTPUT_TOO_LARGE');
    return blob;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
};

type AdminMediaPayload =
  | { mediaType: 'image'; image: string; video: '' }
  | { mediaType: 'video'; image: ''; videoFile: File; poster: Blob };

const getAdminMediaPayload = async (file: File, customVideoPoster?: Blob): Promise<AdminMediaPayload> => {
  const extension = file.name.split('.').pop()?.toLocaleLowerCase() || '';
  const isVideo = file.type.startsWith('video/') || ['mp4', 'm4v', 'webm', 'mov'].includes(extension);
  if (isVideo) {
    if (file.size > 20 * 1024 * 1024) throw new Error('视频最大支持 20 MB');
    const mimeType = file.type || (extension === 'mov' ? 'video/quicktime' : extension === 'm4v' ? 'video/mp4' : `video/${extension}`);
    if (!['video/mp4', 'video/webm', 'video/quicktime'].includes(mimeType)) throw new Error('仅支持 MP4、WebM、MOV 视频');
    const normalizedVideo = file.type === mimeType ? file : new File([file], file.name, { type: mimeType });
    const poster = await createAdminVideoPoster(normalizedVideo, customVideoPoster);
    if (poster.size > 2_200_000) throw new Error('视频封面文件过大');
    return {
      mediaType: 'video',
      image: '',
      videoFile: normalizedVideo,
      poster
    };
  }
  if (!file.type.startsWith('image/') && !['jpg', 'jpeg', 'png', 'webp'].includes(extension)) throw new Error('文件格式不支持');
  return { mediaType: 'image', image: await readFileAsDataUrl(await compressAdminImage(file)), video: '' };
};

export const AdminFashionCommunity: React.FC<{ initialMode?: FashionStudioMode; batchSocialLinks?: boolean }> = ({
  initialMode = 'upload',
  batchSocialLinks = false
}) => {
  const { addNotification, lang } = useB2B();
  const [items, setItems] = useState<FashionModerationItem[]>([]);
  const [summary, setSummary] = useState<FashionModerationSummary>({ total: 0, draft: 0, pending: 0, approved: 0, unpublished: 0 });
  const [hasMoreItems, setHasMoreItems] = useState(false);
  const itemOffsetRef = useRef(0);
  const [status, setStatus] = useState<FilterStatus>('all');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [expandedComments, setExpandedComments] = useState<string | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [selectedPreviewIndex, setSelectedPreviewIndex] = useState(0);
  const [studioMode, setStudioMode] = useState<FashionStudioMode>(initialMode);
  const [uploadTitle, setUploadTitle] = useState('');
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [customVideoCover, setCustomVideoCover] = useState<File | null>(null);
  const [customVideoCoverUrl, setCustomVideoCoverUrl] = useState('');
  const [uploadCaption, setUploadCaption] = useState('');
  const [uploadCategory, setUploadCategory] = useState<(typeof fashionCategories)[number]>(fashionCategories[0]);
  const [uploadStatus, setUploadStatus] = useState<'pending' | 'approved'>('approved');
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number } | null>(null);
  const [uploadByteProgress, setUploadByteProgress] = useState(0);
  const [socialVideoUrl, setSocialVideoUrl] = useState('');
  const [imagePrompt, setImagePrompt] = useState('');
  const [generatedImageCandidates, setGeneratedImageCandidates] = useState<Array<{
    id: string;
    imageDataUrl: string;
    url?: string;
    storageKey?: string;
    contentType?: string;
    sizeBytes?: number;
  }>>([]);
  const [selectedGeneratedImageIndex, setSelectedGeneratedImageIndex] = useState(0);
  const [generatingImage, setGeneratingImage] = useState(false);
  const [importProgress, setImportProgress] = useState<{ current: number; total: number } | null>(null);
  const [importFailures, setImportFailures] = useState<string[]>([]);
  const [downloadedDraftCount, setDownloadedDraftCount] = useState(0);
  const [contentRightsConfirmed, setContentRightsConfirmed] = useState(false);
  const [importingSocialVideo, setImportingSocialVideo] = useState(false);
  const [sliceSourceFile, setSliceSourceFile] = useState<File | null>(null);
  const [sliceCount, setSliceCount] = useState<4 | 8 | 12 | 16>(4);
  const [slicingVideo, setSlicingVideo] = useState(false);
  const [sliceUploadProgress, setSliceUploadProgress] = useState(0);
  const [suggestingContent, setSuggestingContent] = useState(false);
  const [editingItem, setEditingItem] = useState<FashionModerationItem | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editCaption, setEditCaption] = useState('');
  const [editCategory, setEditCategory] = useState<(typeof fashionCategories)[number]>(fashionCategories[0]);
  const [editMediaFile, setEditMediaFile] = useState<File | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [studioTasks, setStudioTasks] = useState<FashionStudioTask[]>([]);
  const [studioProjects, setStudioProjects] = useState<FashionStudioProject[]>([]);
  const [studioProjectsLoading, setStudioProjectsLoading] = useState(false);
  const [studioProjectsError, setStudioProjectsError] = useState('');
  const [projectVersions, setProjectVersions] = useState<FashionStudioProjectVersion[]>([]);
  const [projectHistoryOpen, setProjectHistoryOpen] = useState(false);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const undoSnapshotsRef = useRef<FashionStudioEditorSnapshot[]>([]);
  const redoSnapshotsRef = useRef<FashionStudioEditorSnapshot[]>([]);
  const observedSnapshotRef = useRef('');
  const resetHistoryRef = useRef(false);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [projectTitle, setProjectTitle] = useState('');
  const [projectSaving, setProjectSaving] = useState(false);
  const [projectSaveState, setProjectSaveState] = useState<'idle' | 'saved' | 'dirty' | 'saving' | 'error'>('idle');
  const savedProjectSnapshotRef = useRef('');
  const failedAutoSaveSnapshotRef = useRef('');
  const [trimEditorItem, setTrimEditorItem] = useState<FashionStudioVideoSource | null>(null);
  const [timelineClips, setTimelineClips] = useState<FashionStudioTimelineClip[]>([]);
  const [studioTimelineSources, setStudioTimelineSources] = useState<FashionStudioVideoSource[]>([]);
  const [textOverlayDrafts, setTextOverlayDrafts] = useState<FashionStudioTextOverlayDraft[]>([]);
  const [studioTimelineImageSources, setStudioTimelineImageSources] = useState<FashionStudioImageSource[]>([]);
  const [generatedAssetLibrary, setGeneratedAssetLibrary] = useState<FashionStudioGeneratedAsset[]>([]);
  const [imageOverlayDrafts, setImageOverlayDrafts] = useState<FashionStudioImageOverlayDraft[]>([]);
  const [canvasPreset, setCanvasPreset] = useState<FashionStudioCanvasPreset>('source');
  const [previewTimelineSeconds, setPreviewTimelineSeconds] = useState(0);
  const [timelinePreviewPlaying, setTimelinePreviewPlaying] = useState(false);
  const [previewSourceId, setPreviewSourceId] = useState('');
  const [audioVolume, setAudioVolume] = useState(1);
  const [studioAudioTrack, setStudioAudioTrack] = useState<FashionStudioAudioTrack | null>(null);
  const [studioAudioPreviewError, setStudioAudioPreviewError] = useState('');
  const [studioAudioUploading, setStudioAudioUploading] = useState(false);
  const [studioAudioUploadProgress, setStudioAudioUploadProgress] = useState(0);
  const [trimTask, setTrimTask] = useState<FashionStudioTask | null>(null);
  const [trimSubmitting, setTrimSubmitting] = useState(false);
  const [trimError, setTrimError] = useState('');
  const worksSectionRef = useRef<HTMLDivElement>(null);
  const videoPreviewRef = useRef<HTMLVideoElement>(null);
  const activeTimelineClipIndexRef = useRef(0);
  const pendingTimelineSeekRef = useRef<number | null>(null);
  const playTimelineAfterSeekRef = useRef(false);
  const socialVideoUrls = useMemo(() => parseSocialVideoLinks(socialVideoUrl), [socialVideoUrl]);
  const previewFiles = useMemo(
    () => studioMode === 'slice' ? (sliceSourceFile ? [sliceSourceFile] : []) : studioMode === 'upload' ? selectedFiles : [],
    [selectedFiles, sliceSourceFile, studioMode]
  );
  const previewFile = studioMode === 'slice' ? sliceSourceFile : studioMode === 'upload' ? selectedFiles[selectedPreviewIndex] || null : null;
  const previewUrl = previewUrls[studioMode === 'slice' ? 0 : selectedPreviewIndex] || '';
  const studioVideoSourceOptions = useMemo(() => {
    const sources = [
      ...studioTimelineSources,
      ...items.filter(item => item.mediaType === 'video' && item.videoUrl).map(item => ({
        id: item.id,
        title: item.title,
        image: item.image,
        videoUrl: item.videoUrl,
        rightsStatus: item.rightsStatus
      })),
      ...(trimEditorItem ? [trimEditorItem] : [])
    ];
    return Array.from(new Map(sources
      .filter(source => source.videoUrl && source.rightsStatus !== 'restricted')
      .map(source => [source.id, source])).values());
  }, [items, studioTimelineSources, trimEditorItem]);
  const studioImageSourceOptions = useMemo(() => {
    const generatedAssets = generatedAssetLibrary.map(asset => ({
      id: asset.id,
      title: asset.title || 'AI 生成素材',
      image: asset.previewUrl,
      rightsStatus: asset.rightsStatus || 'authorized',
      supported: true
    } satisfies FashionStudioImageSource));
    const sources: FashionStudioImageSource[] = [
      ...studioTimelineImageSources,
      ...generatedAssets,
      ...items.filter(item => item.mediaType === 'image' && item.image).map(item => ({
        id: item.id,
        title: item.title,
        image: item.image,
        rightsStatus: item.rightsStatus
      }))
    ];
    return Array.from(new Map(sources
      .filter(source => source.image && source.rightsStatus !== 'restricted' && source.supported !== false)
      .map(source => [source.id, source])).values());
  }, [generatedAssetLibrary, items, studioTimelineImageSources]);
  const previewSource = studioVideoSourceOptions.find(source => source.id === previewSourceId) || trimEditorItem;
  const studioAudioPreviewUrl = studioAudioTrack
    ? resolveApiUrl(`/api/admin/fashion/studio/audio/${encodeURIComponent(studioAudioTrack.assetId)}`)
    : '';

  useEffect(() => {
    const urls = previewFiles.map(file => URL.createObjectURL(file));
    setPreviewUrls(urls);
    return () => urls.forEach(url => URL.revokeObjectURL(url));
  }, [previewFiles]);

  useEffect(() => {
    if (!customVideoCover) {
      setCustomVideoCoverUrl('');
      return;
    }
    const url = URL.createObjectURL(customVideoCover);
    setCustomVideoCoverUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [customVideoCover]);

  useEffect(() => {
    const assetId = studioAudioTrack?.assetId;
    if (!assetId) {
      setStudioAudioPreviewError('');
      return;
    }
    setStudioAudioPreviewError('');
  }, [studioAudioTrack?.assetId]);

  useEffect(() => {
    setStudioMode(initialMode);
  }, [initialMode]);

  const loadItems = useCallback(async (append = false) => {
    setLoading(true);
    try {
      const offset = append ? itemOffsetRef.current : 0;
      const params = new URLSearchParams({ status, q: query.trim(), limit: '50', offset: String(offset) });
      const result = await apiGet<{
        success: true;
        items: FashionModerationItem[];
        summary: FashionModerationSummary;
        hasMore?: boolean;
      }>(`/api/admin/fashion/community?${params.toString()}`);
      const loadedItems = result.items || [];
      setItems(current => append ? [...current, ...loadedItems] : loadedItems);
      itemOffsetRef.current = offset + loadedItems.length;
      setHasMoreItems(Boolean(result.hasMore));
      setSummary(result.summary);
    } catch (error) {
      console.error('[admin-fashion-community]', error);
      addNotification('warning', '时尚设计室加载失败', '请确认管理员权限后重试。');
    } finally {
      setLoading(false);
    }
  }, [addNotification, query, status]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadItems(), query ? 250 : 0);
    return () => window.clearTimeout(timer);
  }, [loadItems, query]);

  const loadStudioTasks = useCallback(async () => {
    try {
      const result = await apiGet<{ tasks: FashionStudioTask[] }>('/api/admin/fashion/studio/tasks');
      setStudioTasks(result.tasks || []);
    } catch (error) {
      addNotification('warning', '导出任务读取失败', error instanceof Error ? error.message : '请稍后刷新重试。');
    }
  }, [addNotification]);

  const loadGeneratedAssetLibrary = useCallback(async () => {
    try {
      const result = await apiGet<{ assets: FashionStudioGeneratedAsset[] }>('/api/admin/fashion/studio/generated-assets');
      setGeneratedAssetLibrary((result.assets || []).filter((asset): asset is FashionStudioGeneratedAsset => Boolean(asset?.previewUrl)));
    } catch (error) {
      console.warn('[admin-fashion-community-generated-assets]', error);
    }
  }, []);

  useEffect(() => {
    void loadStudioTasks();
    void loadGeneratedAssetLibrary();
  }, [loadGeneratedAssetLibrary, loadStudioTasks]);

  const loadStudioProjects = useCallback(async () => {
    setStudioProjectsLoading(true);
    try {
      const result = await apiGet<{ projects: FashionStudioProject[] }>('/api/admin/fashion/studio/projects');
      setStudioProjects(result.projects || []);
      setStudioProjectsError('');
    } catch (error) {
      setStudioProjectsError(error instanceof Error ? error.message : '项目读取失败');
    } finally {
      setStudioProjectsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadStudioProjects();
  }, [loadStudioProjects]);

  const openTrimEditor = (item: FashionModerationItem) => {
    resetHistoryRef.current = true;
    activeTimelineClipIndexRef.current = 0;
    pendingTimelineSeekRef.current = null;
    setTimelinePreviewPlaying(false);
    setPreviewSourceId(item.id);
    setStudioTimelineSources([item]);
    setTrimEditorItem(item);
    setTimelineClips([{ id: `clip-${crypto.randomUUID()}`, startSeconds: '0', endSeconds: '15' }]);
    setTextOverlayDrafts([]);
    setImageOverlayDrafts([]);
    setCanvasPreset('source');
    setStudioTimelineImageSources([]);
    setPreviewTimelineSeconds(0);
    setProjectVersions([]);
    setProjectHistoryOpen(false);
    setAudioVolume(1);
    setStudioAudioTrack(null);
    setTrimTask(null);
    setTrimError('');
    setActiveProjectId(null);
    savedProjectSnapshotRef.current = '';
    failedAutoSaveSnapshotRef.current = '';
    setProjectSaveState('dirty');
    setProjectTitle(`${item.title || '未命名视频'} 剪辑`.slice(0, 120));
  };

  const closeTrimEditor = () => {
    if (studioAudioUploading || projectSaving || trimSubmitting) {
      addNotification('warning', '创作任务仍在进行', '请等待上传、保存或导出完成后再关闭剪辑器。');
      return;
    }
    if (
      ['dirty', 'saving', 'error'].includes(projectSaveState)
      && !window.confirm('项目有未保存的修改，确定关闭吗？')
    ) return;
    setTrimEditorItem(null);
    setTrimTask(null);
    setActiveProjectId(null);
    setTrimError('');
  };

  const openSavedVideoProject = async (projectId: string) => {
    setTrimError('');
    try {
      const result = await apiGet<{
        project: FashionStudioProject;
        source: FashionStudioVideoSource | null;
        sources?: FashionStudioVideoSource[];
        imageSources?: FashionStudioImageSource[];
      }>(`/api/admin/fashion/studio/projects/${encodeURIComponent(projectId)}`);
      if (!result.source?.videoUrl) {
        throw new Error('FASHION_STUDIO_VIDEO_SOURCE_NOT_FOUND');
      }
      const sources = result.sources || [result.source];
      const requiredSourceIds = new Set([
        result.project.document.sourcePostId,
        ...result.project.document.clips.map(clip => clip.sourcePostId).filter((id): id is string => Boolean(id))
      ]);
      if ([...requiredSourceIds].some(sourceId => !sources.some(source =>
        source.id === sourceId && source.videoUrl && source.rightsStatus !== 'restricted'
      ))) {
        if (sources.some(source => source.rightsStatus === 'restricted')) {
          throw new Error('FASHION_STUDIO_VIDEO_SOURCE_RESTRICTED');
        }
        throw new Error('FASHION_STUDIO_VIDEO_SOURCE_NOT_FOUND');
      }
      const requiredImageSourceIds = new Set(result.project.document.imageOverlays.map(overlay => overlay.sourcePostId));
      const imageSources = result.imageSources || [];
      const unavailableImageSource = [...requiredImageSourceIds]
        .map(sourceId => imageSources.find(imageSource => imageSource.id === sourceId))
        .find(imageSource => !imageSource?.image || imageSource.rightsStatus === 'restricted' || !imageSource.supported);
      const imageSourceProblem = unavailableImageSource?.rightsStatus === 'restricted'
        ? 'FASHION_STUDIO_IMAGE_SOURCE_RESTRICTED'
        : unavailableImageSource && !unavailableImageSource.supported
          ? 'FASHION_STUDIO_IMAGE_SOURCE_UNSUPPORTED'
          : unavailableImageSource
            ? 'FASHION_STUDIO_IMAGE_SOURCE_NOT_FOUND'
            : '';
      resetHistoryRef.current = true;
      activeTimelineClipIndexRef.current = 0;
      pendingTimelineSeekRef.current = null;
      setTimelinePreviewPlaying(false);
      setStudioTimelineSources(sources);
      setStudioTimelineImageSources(imageSources);
      setPreviewSourceId(result.project.document.clips[0]?.sourcePostId || result.project.document.sourcePostId);
      setTrimEditorItem(result.source);
      setTrimTask(null);
      setActiveProjectId(result.project.id);
      setProjectTitle(result.project.title);
      setProjectVersions(result.project.document.history);
      setProjectHistoryOpen(false);
      setTimelineClips(result.project.document.clips.map(clip => ({
        id: clip.id,
        startSeconds: String(clip.startSeconds),
        endSeconds: String(clip.endSeconds),
        ...(clip.sourcePostId ? { sourcePostId: clip.sourcePostId } : {})
      })));
      setTextOverlayDrafts(result.project.document.textOverlays.map(overlay => ({
        ...overlay,
        startSeconds: String(overlay.startSeconds),
        endSeconds: String(overlay.endSeconds)
      })));
      setImageOverlayDrafts(result.project.document.imageOverlays.map(overlay => ({
        ...overlay,
        startSeconds: String(overlay.startSeconds),
        endSeconds: String(overlay.endSeconds)
      })));
      setCanvasPreset(result.project.document.canvasPreset || 'source');
      setPreviewTimelineSeconds(0);
      setAudioVolume(result.project.document.audioVolume);
      setStudioAudioTrack(result.project.document.audioTrack);
      savedProjectSnapshotRef.current = JSON.stringify({
        title: result.project.title,
        sourcePostId: result.project.document.sourcePostId,
        clips: result.project.document.clips,
        canvasPreset: result.project.document.canvasPreset || 'source',
        audioVolume: result.project.document.audioVolume,
        audioTrack: result.project.document.audioTrack,
        textOverlays: result.project.document.textOverlays,
        imageOverlays: result.project.document.imageOverlays
      });
      failedAutoSaveSnapshotRef.current = '';
      setProjectSaveState('saved');
      setTrimError(imageSourceProblem);
    } catch (error) {
      const message = error instanceof Error ? formatStudioTrimError(error.message) : '项目恢复失败，请检查源素材后重试。';
      setTrimError(message);
      addNotification('warning', '项目无法打开', message);
    }
  };

  const persistCurrentVideoProject = useCallback(async (
    audioTrackOverride?: FashionStudioAudioTrack | null,
    textOverlaysOverride?: FashionStudioTextOverlayDraft[],
    imageOverlaysOverride?: FashionStudioImageOverlayDraft[]
  ) => {
    if (!trimEditorItem) throw new Error('FASHION_STUDIO_PROJECT_SOURCE_REQUIRED');
    const clips = parseStudioTimelineClips(timelineClips);
    const title = projectTitle.trim() || `${trimEditorItem.title || '未命名视频'} 剪辑`;
    const audioTrack = audioTrackOverride === undefined ? studioAudioTrack : audioTrackOverride;
    const rawDuration = clips?.reduce((total, clip) => total + clip.endSeconds - clip.startSeconds, 0) || 0;
    const textOverlays = parseStudioTextOverlays(textOverlaysOverride || textOverlayDrafts, rawDuration);
    const imageOverlays = parseStudioImageOverlays(imageOverlaysOverride || imageOverlayDrafts, rawDuration);
    if (!clips) throw new Error('FASHION_VIDEO_TRIM_RANGE_INVALID');
    if (!isValidStudioAudioTrack(audioTrack)) throw new Error('FASHION_STUDIO_AUDIO_TRACK_SETTINGS_INVALID');
    if (!textOverlays) throw new Error('FASHION_STUDIO_TEXT_OVERLAY_INVALID');
    if (!imageOverlays) throw new Error('FASHION_STUDIO_IMAGE_REFERENCE_INVALID');
    if (Array.from(title).length > 120) throw new Error('FASHION_STUDIO_PROJECT_INVALID');
    const payload = {
      title,
      sourcePostId: trimEditorItem.id,
      clips,
      audioVolume,
      audioTrack,
      textOverlays,
      imageOverlays,
      canvasPreset
    };
    const result = activeProjectId
      ? await apiRequest<{ project: FashionStudioProject }>(
        `/api/admin/fashion/studio/projects/${encodeURIComponent(activeProjectId)}`,
        { method: 'PUT', body: JSON.stringify(payload) }
      )
      : await apiPost<{ project: FashionStudioProject }>('/api/admin/fashion/studio/projects', payload);
    const savedProject = result.project;
    savedProjectSnapshotRef.current = JSON.stringify({
      title: savedProject.title,
      sourcePostId: savedProject.document.sourcePostId,
      clips: savedProject.document.clips,
      canvasPreset: savedProject.document.canvasPreset,
      audioVolume: savedProject.document.audioVolume,
      audioTrack: savedProject.document.audioTrack,
      textOverlays: savedProject.document.textOverlays,
      imageOverlays: savedProject.document.imageOverlays
    });
    failedAutoSaveSnapshotRef.current = '';
    setActiveProjectId(savedProject.id);
    setProjectVersions(savedProject.document.history);
    setStudioProjects(current => [savedProject, ...current.filter(project => project.id !== savedProject.id)]
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
      .slice(0, 30));
    setStudioProjectsError('');
    return savedProject;
  }, [activeProjectId, audioVolume, canvasPreset, imageOverlayDrafts, projectTitle, studioAudioTrack, textOverlayDrafts, timelineClips, trimEditorItem]);

  const saveVideoProject = async () => {
    if (projectSaving || !trimEditorItem) return;
    setProjectSaving(true);
    setProjectSaveState('saving');
    setTrimError('');
    try {
      await persistCurrentVideoProject();
      setProjectSaveState('saved');
      addNotification('success', '项目已保存', '刷新页面后可从“最近项目”继续剪辑。');
      await loadStudioProjects();
    } catch (error) {
      setProjectSaveState('error');
      setTrimError(error instanceof Error ? formatStudioTrimError(error.message) : '项目保存失败，请稍后重试。');
    } finally {
      setProjectSaving(false);
    }
  };

  const uploadStudioAudio = async (file: File) => {
    if (studioAudioUploading || projectSaving || trimSubmitting || trimTask) return;
    if (file.size > MAX_STUDIO_AUDIO_FILE_SIZE_BYTES) {
      setTrimError(formatStudioTrimError('FASHION_STUDIO_AUDIO_TOO_LARGE'));
      return;
    }
    const previousTrack = studioAudioTrack;
    setStudioAudioUploading(true);
    setStudioAudioUploadProgress(0);
    setTrimError('');
    const form = new FormData();
    form.append('file', file);
    try {
      const result = await apiPostWithUploadProgress<{
        audioTrack: FashionStudioAudioTrack;
      }>('/api/admin/fashion/studio/audio', form, 600_000, (loaded, total) => {
        setStudioAudioUploadProgress(total > 0 ? Math.min(99, Math.round(loaded / total * 100)) : 0);
      });
      setStudioAudioTrack(result.audioTrack);
      setProjectSaveState('dirty');
      if (previousTrack) {
        if (activeProjectId) {
          setProjectSaving(true);
          setProjectSaveState('saving');
          try {
            await persistCurrentVideoProject(result.audioTrack);
            setProjectSaveState('saved');
          } catch (error) {
            setProjectSaveState('error');
            setTrimError(error instanceof Error
              ? `新音乐已导入，但项目保存失败：${formatStudioTrimError(error.message)}`
              : '新音乐已导入，但项目保存失败。');
            return;
          } finally {
            setProjectSaving(false);
          }
        }
        try {
          await apiDelete(`/api/admin/fashion/studio/audio/${encodeURIComponent(previousTrack.assetId)}`);
        } catch (error) {
          const code = error instanceof Error ? error.message : 'FASHION_STUDIO_AUDIO_DELETE_FAILED';
          addNotification(
            'warning',
            '新音乐已导入',
            code === 'FASHION_STUDIO_AUDIO_IN_USE'
              ? formatStudioTrimError(code)
              : '旧音乐文件暂时无法清理。'
          );
          return;
        }
      }
      addNotification(
        'success',
        '背景音乐已导入',
        activeProjectId
          ? '已加入当前项目；调整片段范围和音量后会自动保存。'
          : '已加入新项目；点击“保存项目”或导出以持久保存。'
      );
    } catch (error) {
      const code = error instanceof Error ? error.message : 'FASHION_STUDIO_AUDIO_UPLOAD_FAILED';
      setTrimError(formatStudioTrimError(code));
    } finally {
      setStudioAudioUploading(false);
    }
  };

  const removeStudioAudioTrack = async () => {
    if (!studioAudioTrack || studioAudioUploading || projectSaving || trimSubmitting || trimTask) return;
    const removedTrack = studioAudioTrack;
    setStudioAudioTrack(null);
    setStudioAudioPreviewError('');
    setProjectSaveState('dirty');
    setTrimError('');
    if (activeProjectId) {
      setProjectSaving(true);
      setProjectSaveState('saving');
      try {
        await persistCurrentVideoProject(null);
        setProjectSaveState('saved');
      } catch (error) {
        setProjectSaveState('error');
        setTrimError(error instanceof Error ? formatStudioTrimError(error.message) : '项目保存失败，背景音乐文件已保留。');
        return;
      } finally {
        setProjectSaving(false);
      }
    }
    try {
      await apiDelete(`/api/admin/fashion/studio/audio/${encodeURIComponent(removedTrack.assetId)}`);
      addNotification('success', '背景音乐已移除', '项目中的音乐轨道和未引用的音乐文件已清理。');
    } catch (error) {
      const code = error instanceof Error ? error.message : 'FASHION_STUDIO_AUDIO_DELETE_FAILED';
      setTrimError(formatStudioTrimError(code));
      addNotification('warning', '音乐轨道已移除', formatStudioTrimError(code));
    }
  };

  const buildEditorSnapshot = (): FashionStudioEditorSnapshot | null => {
    if (!trimEditorItem) return null;
    const clips = parseStudioTimelineClips(timelineClips);
    if (!clips || !isValidStudioAudioTrack(studioAudioTrack)) return null;
    const durationSeconds = clips.reduce((total, clip) => total + clip.endSeconds - clip.startSeconds, 0);
    const textOverlays = parseStudioTextOverlays(textOverlayDrafts, durationSeconds);
    const imageOverlays = parseStudioImageOverlays(imageOverlayDrafts, durationSeconds);
    if (!textOverlays || !imageOverlays) return null;
    return {
      title: projectTitle.trim() || `${trimEditorItem.title || '未命名视频'} 剪辑`,
      sourcePostId: trimEditorItem.id,
      clips,
      canvasPreset,
      audioVolume,
      audioTrack: studioAudioTrack,
      textOverlays,
      imageOverlays
    };
  };

  useEffect(() => {
    const snapshot = buildEditorSnapshot();
    if (!snapshot) {
      if (!trimEditorItem) {
        undoSnapshotsRef.current = [];
        redoSnapshotsRef.current = [];
        observedSnapshotRef.current = '';
        setCanUndo(false);
        setCanRedo(false);
      }
      return;
    }
    const serialized = JSON.stringify(snapshot);
    if (resetHistoryRef.current || !observedSnapshotRef.current) {
      resetHistoryRef.current = false;
      undoSnapshotsRef.current = [];
      redoSnapshotsRef.current = [];
      observedSnapshotRef.current = serialized;
      setCanUndo(false);
      setCanRedo(false);
      return;
    }
    if (serialized === observedSnapshotRef.current) return;
    try {
      undoSnapshotsRef.current.push(JSON.parse(observedSnapshotRef.current) as FashionStudioEditorSnapshot);
    } catch (error) {
      console.error('[fashion-studio-undo-history]', error instanceof Error ? error.name : 'unknown error');
      undoSnapshotsRef.current = [];
    }
    if (undoSnapshotsRef.current.length > 50) undoSnapshotsRef.current.shift();
    redoSnapshotsRef.current = [];
    observedSnapshotRef.current = serialized;
    setCanUndo(undoSnapshotsRef.current.length > 0);
    setCanRedo(false);
  }, [audioVolume, canvasPreset, imageOverlayDrafts, projectTitle, studioAudioTrack, textOverlayDrafts, timelineClips, trimEditorItem]);

  useEffect(() => {
    if (!activeProjectId || !trimEditorItem || trimTask || projectSaving || trimSubmitting) return;
    const clips = parseStudioTimelineClips(timelineClips);
    const title = projectTitle.trim() || `${trimEditorItem.title || '未命名视频'} 剪辑`;
    if (!clips) {
      setProjectSaveState('dirty');
      return;
    }
    if (!isValidStudioAudioTrack(studioAudioTrack)) {
      setProjectSaveState('error');
      setTrimError(formatStudioTrimError('FASHION_STUDIO_AUDIO_TRACK_SETTINGS_INVALID'));
      return;
    }
    const timelineDurationSeconds = clips.reduce((total, clip) => total + clip.endSeconds - clip.startSeconds, 0);
    const textOverlays = parseStudioTextOverlays(textOverlayDrafts, timelineDurationSeconds);
    const imageOverlays = parseStudioImageOverlays(imageOverlayDrafts, timelineDurationSeconds);
    if (!textOverlays) {
      setProjectSaveState('error');
      setTrimError(formatStudioTrimError('FASHION_STUDIO_TEXT_OVERLAY_INVALID'));
      return;
    }
    if (!imageOverlays) {
      setProjectSaveState('error');
      setTrimError(formatStudioTrimError('FASHION_STUDIO_IMAGE_REFERENCE_INVALID'));
      return;
    }
    if (Array.from(title).length > 120) {
      setProjectSaveState('error');
      setTrimError(formatStudioTrimError('FASHION_STUDIO_PROJECT_INVALID'));
      return;
    }
    const snapshot = JSON.stringify({
      title,
      sourcePostId: trimEditorItem.id,
      clips,
      canvasPreset,
      audioVolume,
      audioTrack: studioAudioTrack,
      textOverlays,
      imageOverlays
    });
    if (snapshot === savedProjectSnapshotRef.current) {
      setProjectSaveState('saved');
      return;
    }
    if (snapshot === failedAutoSaveSnapshotRef.current) {
      setProjectSaveState('error');
      return;
    }
    setProjectSaveState('dirty');
    const timer = window.setTimeout(() => {
      setProjectSaving(true);
      setProjectSaveState('saving');
      void persistCurrentVideoProject()
        .then(() => setProjectSaveState('saved'))
        .catch(error => {
          failedAutoSaveSnapshotRef.current = snapshot;
          setProjectSaveState('error');
          setTrimError(error instanceof Error ? formatStudioTrimError(error.message) : '自动保存失败，请手动重试。');
        })
        .finally(() => setProjectSaving(false));
    }, 800);
    return () => window.clearTimeout(timer);
  }, [activeProjectId, audioVolume, canvasPreset, imageOverlayDrafts, persistCurrentVideoProject, projectSaving, projectTitle, studioAudioTrack, textOverlayDrafts, timelineClips, trimEditorItem, trimSubmitting, trimTask]);

  useEffect(() => {
    if (!['dirty', 'saving'].includes(projectSaveState)) return;
    const preventUnsavedExit = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', preventUnsavedExit);
    return () => window.removeEventListener('beforeunload', preventUnsavedExit);
  }, [projectSaveState]);

  const startVideoTrim = async () => {
    if (!trimEditorItem || trimSubmitting || studioAudioUploading || !trimEditorItem.videoUrl) return;
    const clips = parseStudioTimelineClips(timelineClips);
    if (!clips) {
      setTrimError(formatStudioTrimError('FASHION_VIDEO_TRIM_RANGE_INVALID'));
      return;
    }
    if (!isValidStudioAudioTrack(studioAudioTrack)) {
      setTrimError(formatStudioTrimError('FASHION_STUDIO_AUDIO_TRACK_SETTINGS_INVALID'));
      return;
    }
    const timelineDurationSeconds = clips.reduce((total, clip) => total + clip.endSeconds - clip.startSeconds, 0);
    const textOverlays = parseStudioTextOverlays(textOverlayDrafts, timelineDurationSeconds);
    const imageOverlays = parseStudioImageOverlays(imageOverlayDrafts, timelineDurationSeconds);
    if (!textOverlays) {
      setTrimError(formatStudioTrimError('FASHION_STUDIO_TEXT_OVERLAY_INVALID'));
      return;
    }
    if (!imageOverlays) {
      setTrimError(formatStudioTrimError('FASHION_STUDIO_IMAGE_REFERENCE_INVALID'));
      return;
    }
    setTrimSubmitting(true);
    setTrimError('');
    try {
      await persistCurrentVideoProject();
      setProjectSaveState('saved');
      const result = await apiPost<{ taskId: string; status: string }>(
        '/api/admin/fashion/studio/video-trims',
        { sourcePostId: trimEditorItem.id, clips, canvasPreset, audioVolume, audioTrack: studioAudioTrack, textOverlays, imageOverlays }
      );
      const task: FashionStudioTask = {
        id: result.taskId,
        goal: `剪辑：${trimEditorItem.title}`,
        status: result.status,
        plan: null,
        result: null
      };
      setTrimTask(task);
      setStudioTasks(current => [task, ...current.filter(existing => existing.id !== task.id)].slice(0, 30));
      void loadStudioProjects();
    } catch (error) {
      setTrimError(error instanceof Error ? formatStudioTrimError(error.message) : '创建转码任务失败，请稍后重试。');
    } finally {
      setTrimSubmitting(false);
    }
  };

  const updateTimelineClip = (
    clipId: string,
    patch: Partial<Pick<FashionStudioTimelineClip, 'startSeconds' | 'endSeconds' | 'sourcePostId'>>
  ) => {
    setTimelineClips(current => current.map(clip => clip.id === clipId ? { ...clip, ...patch } : clip));
    setProjectSaveState('dirty');
  };

  const updateTextOverlay = (
    overlayId: string,
    patch: Partial<Omit<FashionStudioTextOverlayDraft, 'id'>>
  ) => {
    setTextOverlayDrafts(current => current.map(overlay => overlay.id === overlayId
      ? { ...overlay, ...patch }
      : overlay));
    setProjectSaveState('dirty');
  };

  const updateImageOverlay = (
    overlayId: string,
    patch: Partial<Omit<FashionStudioImageOverlayDraft, 'id'>>
  ) => {
    setImageOverlayDrafts(current => current.map(overlay => overlay.id === overlayId
      ? { ...overlay, ...patch }
      : overlay));
    setProjectSaveState('dirty');
  };

  const applyEditorSnapshot = (snapshot: FashionStudioEditorSnapshot) => {
    setProjectTitle(snapshot.title);
    setTimelineClips(snapshot.clips.map(clip => ({
      id: clip.id,
      startSeconds: String(clip.startSeconds),
      endSeconds: String(clip.endSeconds),
      ...(clip.sourcePostId ? { sourcePostId: clip.sourcePostId } : {})
    })));
    setCanvasPreset(snapshot.canvasPreset);
    setAudioVolume(snapshot.audioVolume);
    setStudioAudioTrack(snapshot.audioTrack);
    setTextOverlayDrafts(snapshot.textOverlays.map(overlay => ({
      ...overlay,
      startSeconds: String(overlay.startSeconds),
      endSeconds: String(overlay.endSeconds)
    })));
    setImageOverlayDrafts(snapshot.imageOverlays.map(overlay => ({
      ...overlay,
      startSeconds: String(overlay.startSeconds),
      endSeconds: String(overlay.endSeconds)
    })));
    setPreviewTimelineSeconds(0);
    setProjectSaveState('dirty');
    setTrimError('');
  };

  const undoEditorChange = () => {
    const previous = undoSnapshotsRef.current.pop();
    const current = buildEditorSnapshot();
    if (!previous || !current) return;
    redoSnapshotsRef.current.push(current);
    observedSnapshotRef.current = JSON.stringify(previous);
    setCanUndo(undoSnapshotsRef.current.length > 0);
    setCanRedo(true);
    applyEditorSnapshot(previous);
  };

  const redoEditorChange = () => {
    const next = redoSnapshotsRef.current.pop();
    const current = buildEditorSnapshot();
    if (!next || !current) return;
    undoSnapshotsRef.current.push(current);
    observedSnapshotRef.current = JSON.stringify(next);
    setCanUndo(true);
    setCanRedo(redoSnapshotsRef.current.length > 0);
    applyEditorSnapshot(next);
  };

  const restoreProjectVersion = (version: FashionStudioProjectVersion) => {
    if (!window.confirm(`恢复到 ${new Date(version.createdAt).toLocaleString()} 的项目版本？当前内容会先保留为一个新版本。`)) {
      return;
    }
    applyEditorSnapshot({
      title: version.title,
      sourcePostId: version.document.sourcePostId,
      clips: version.document.clips,
      canvasPreset: version.document.canvasPreset,
      audioVolume: version.document.audioVolume,
      audioTrack: version.document.audioTrack,
      textOverlays: version.document.textOverlays,
      imageOverlays: version.document.imageOverlays
    });
    setProjectHistoryOpen(false);
  };

  const addTextOverlay = () => {
    const clips = parseStudioTimelineClips(timelineClips);
    if (!clips || textOverlayDrafts.length >= MAX_STUDIO_TEXT_OVERLAYS) return;
    const durationSeconds = clips.reduce((total, clip) => total + clip.endSeconds - clip.startSeconds, 0);
    const endSeconds = Math.min(4, durationSeconds);
    setTextOverlayDrafts(current => [...current, {
      id: `text-${crypto.randomUUID()}`,
      text: '新建文字',
      startSeconds: '0',
      endSeconds: String(Number(endSeconds.toFixed(3))),
      position: 'bottom',
      fontSize: 36
    }]);
    setProjectSaveState('dirty');
  };

  const removeTextOverlay = (overlayId: string) => {
    setTextOverlayDrafts(current => current.filter(overlay => overlay.id !== overlayId));
    setProjectSaveState('dirty');
  };

  const addImageOverlay = () => {
    const clips = parseStudioTimelineClips(timelineClips);
    const imageSource = studioImageSourceOptions[0];
    if (!clips || !imageSource || imageOverlayDrafts.length >= MAX_STUDIO_IMAGE_OVERLAYS) return;
    const durationSeconds = clips.reduce((total, clip) => total + clip.endSeconds - clip.startSeconds, 0);
    const endSeconds = Math.min(4, durationSeconds);
    setImageOverlayDrafts(current => [...current, {
      id: `image-${crypto.randomUUID()}`,
      sourcePostId: imageSource.id,
      startSeconds: '0',
      endSeconds: String(Number(endSeconds.toFixed(3))),
      position: 'bottom-right',
      sizePercent: 25
    }]);
    setProjectSaveState('dirty');
  };

  const removeImageOverlay = (overlayId: string) => {
    setImageOverlayDrafts(current => current.filter(overlay => overlay.id !== overlayId));
    setProjectSaveState('dirty');
  };

  const seekTimelineTime = (targetSeconds: number) => {
    const clips = parseStudioTimelineClips(timelineClips);
    if (!clips) return;
    const position = resolveFashionStudioTimelinePosition(clips, targetSeconds);
    if (!position) return;
    activeTimelineClipIndexRef.current = position.clipIndex;
    const sourcePostId = clips[position.clipIndex].sourcePostId || trimEditorItem?.id;
    if (!sourcePostId) return;
    const video = videoPreviewRef.current;
    pendingTimelineSeekRef.current = position.sourceSeconds;
    if (sourcePostId !== previewSourceId) {
      playTimelineAfterSeekRef.current = Boolean(video && !video.paused);
      setPreviewSourceId(sourcePostId);
    } else if (video && Math.abs(video.currentTime - position.sourceSeconds) > 0.02) {
      video.currentTime = position.sourceSeconds;
    } else {
      pendingTimelineSeekRef.current = null;
    }
    setPreviewTimelineSeconds(position.timelineSeconds);
  };

  const updateTimelinePreviewPosition = (sourceSeconds: number) => {
    const pendingSeek = pendingTimelineSeekRef.current;
    if (pendingSeek !== null) {
      if (Math.abs(sourceSeconds - pendingSeek) > 0.08) return;
      pendingTimelineSeekRef.current = null;
    }
    const clips = parseStudioTimelineClips(timelineClips);
    if (!clips) return;
    const clipIndex = Math.min(activeTimelineClipIndexRef.current, clips.length - 1);
    const clip = clips[clipIndex];
    if (sourceSeconds < clip.startSeconds - 0.04) {
      pendingTimelineSeekRef.current = clip.startSeconds;
      if (videoPreviewRef.current) videoPreviewRef.current.currentTime = clip.startSeconds;
      return;
    }
    if (sourceSeconds >= clip.endSeconds - 0.025) {
      if (clipIndex < clips.length - 1) {
        const nextClipIndex = clipIndex + 1;
        const nextClip = clips[nextClipIndex];
        const nextTimelineSeconds = clips.slice(0, nextClipIndex).reduce(
          (total, previous) => total + previous.endSeconds - previous.startSeconds,
          0
        );
        activeTimelineClipIndexRef.current = nextClipIndex;
        setPreviewTimelineSeconds(nextTimelineSeconds);
        pendingTimelineSeekRef.current = nextClip.startSeconds;
        const nextSourceId = nextClip.sourcePostId || trimEditorItem?.id;
        if (nextSourceId && nextSourceId !== previewSourceId) {
          playTimelineAfterSeekRef.current = Boolean(videoPreviewRef.current && !videoPreviewRef.current.paused);
          setPreviewSourceId(nextSourceId);
        }
        else if (videoPreviewRef.current) videoPreviewRef.current.currentTime = nextClip.startSeconds;
        return;
      }
      const totalDurationSeconds = clips.reduce(
        (total, current) => total + current.endSeconds - current.startSeconds,
        0
      );
      setPreviewTimelineSeconds(totalDurationSeconds);
      videoPreviewRef.current?.pause();
      return;
    }
    const elapsedSeconds = clips.slice(0, clipIndex).reduce(
      (total, previous) => total + previous.endSeconds - previous.startSeconds,
      0
    );
    setPreviewTimelineSeconds(elapsedSeconds + sourceSeconds - clip.startSeconds);
  };

  const handleTimelinePreviewEnded = () => {
    const clips = parseStudioTimelineClips(timelineClips);
    const video = videoPreviewRef.current;
    if (!clips || !video) return;
    if (pendingTimelineSeekRef.current !== null) {
      void video.play().catch(() => {
        addNotification('warning', '预览无法继续播放', '请再次点击播放，或检查浏览器的媒体播放权限。');
      });
      return;
    }
    const nextClipIndex = activeTimelineClipIndexRef.current + 1;
    if (nextClipIndex >= clips.length) {
      setTimelinePreviewPlaying(false);
      setPreviewTimelineSeconds(clips.reduce(
        (total, clip) => total + clip.endSeconds - clip.startSeconds,
        0
      ));
      return;
    }
    const nextClip = clips[nextClipIndex];
    activeTimelineClipIndexRef.current = nextClipIndex;
    setPreviewTimelineSeconds(clips.slice(0, nextClipIndex).reduce(
      (total, clip) => total + clip.endSeconds - clip.startSeconds,
      0
    ));
    pendingTimelineSeekRef.current = nextClip.startSeconds;
    const nextSourceId = nextClip.sourcePostId || trimEditorItem?.id;
    if (nextSourceId && nextSourceId !== previewSourceId) {
      playTimelineAfterSeekRef.current = true;
      setPreviewSourceId(nextSourceId);
      return;
    }
    else video.currentTime = nextClip.startSeconds;
    void video.play().catch(() => {
      addNotification('warning', '预览无法继续播放', '请再次点击播放，或检查浏览器的媒体播放权限。');
    });
  };

  const toggleTimelinePreview = () => {
    const video = videoPreviewRef.current;
    const clips = parseStudioTimelineClips(timelineClips);
    if (!video || !clips) return;
    if (!video.paused) {
      video.pause();
      return;
    }
    const durationSeconds = clips.reduce(
      (total, clip) => total + clip.endSeconds - clip.startSeconds,
      0
    );
    const targetSeconds = previewTimelineSeconds >= durationSeconds ? 0 : previewTimelineSeconds;
    const position = resolveFashionStudioTimelinePosition(clips, targetSeconds);
    const targetSourceId = position
      ? clips[position.clipIndex].sourcePostId || trimEditorItem?.id
      : undefined;
    if (targetSourceId && targetSourceId !== previewSourceId) {
      playTimelineAfterSeekRef.current = true;
      seekTimelineTime(targetSeconds);
      return;
    }
    seekTimelineTime(targetSeconds);
    void video.play().catch(() => {
      addNotification('warning', '预览无法播放', '请检查浏览器的媒体播放权限后重试。');
    });
  };

  const updateStudioAudioTrack = (patch: Partial<Pick<FashionStudioAudioTrack, 'trimStartSeconds' | 'trimEndSeconds' | 'volume'>>) => {
    setStudioAudioTrack(current => current ? { ...current, ...patch } : current);
    setProjectSaveState('dirty');
  };

  const moveTimelineClip = (clipIndex: number, offset: -1 | 1) => {
    setTimelineClips(current => {
      const nextIndex = clipIndex + offset;
      if (nextIndex < 0 || nextIndex >= current.length) return current;
      const next = [...current];
      [next[clipIndex], next[nextIndex]] = [next[nextIndex], next[clipIndex]];
      return next;
    });
    setProjectSaveState('dirty');
  };

  const addTimelineClip = () => {
    if (timelineClips.length >= MAX_STUDIO_TIMELINE_CLIPS) return;
    const previousEnd = Number(timelineClips.at(-1)?.endSeconds || 0);
    const startSeconds = Number.isFinite(previousEnd) ? Math.min(previousEnd, 30 * 60 - 0.25) : 0;
    const endSeconds = Math.min(startSeconds + 15, 30 * 60);
    setTimelineClips(current => [...current, {
      id: `clip-${crypto.randomUUID()}`,
      startSeconds: String(Number(startSeconds.toFixed(1))),
      endSeconds: String(Number(endSeconds.toFixed(1)))
    }]);
    setProjectSaveState('dirty');
  };

  const removeTimelineClip = (clipId: string) => {
    setTimelineClips(current => current.filter(clip => clip.id !== clipId));
    setProjectSaveState('dirty');
  };

  const cancelVideoTrim = async () => {
    if (!trimTask || studioTaskIsTerminal(trimTask.status)) return;
    try {
      await apiPost(`/api/admin/fashion/studio/tasks/${encodeURIComponent(trimTask.id)}/cancel`, {});
      setTrimTask(current => current ? { ...current, status: 'cancelled' } : current);
      setStudioTasks(current => current.map(task => task.id === trimTask.id ? { ...task, status: 'cancelled' } : task));
    } catch (error) {
      setTrimError(error instanceof Error ? error.message : '取消任务失败，请稍后重试。');
    }
  };

  const watchedTrimTaskId = trimTask && !studioTaskIsTerminal(trimTask.status) ? trimTask.id : null;
  useEffect(() => {
    if (!watchedTrimTaskId) return;
    let cancelled = false;
    let failures = 0;
    let timer: number | undefined;
    const poll = async () => {
      try {
        const result = await apiGet<{ task: FashionStudioTask }>(
          `/api/admin/fashion/studio/tasks/${encodeURIComponent(watchedTrimTaskId)}`
        );
        if (cancelled) return;
        failures = 0;
        setTrimTask(result.task);
        setStudioTasks(current => [result.task, ...current.filter(task => task.id !== result.task.id)].slice(0, 30));
        if (result.task.status === 'completed') {
          await Promise.all([loadItems(), loadStudioTasks()]);
          return;
        }
        if (studioTaskIsTerminal(result.task.status)) return;
      } catch (error) {
        if (cancelled) return;
        failures += 1;
        if (failures >= 5) {
          setTrimError(error instanceof Error ? `任务状态读取失败：${error.message}` : '任务状态读取失败；可在任务记录中刷新。');
          return;
        }
      }
      timer = window.setTimeout(() => void poll(), failures ? 2500 : 1200);
    };
    void poll();
    return () => {
      cancelled = true;
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [loadItems, loadStudioTasks, watchedTrimTaskId]);

  const reviewPost = async (item: FashionModerationItem, publicationStatus: FilterStatus) => {
    if (publicationStatus === 'all') return;
    setBusyId(item.id);
    try {
      await apiRequest(`/api/admin/fashion/community/${encodeURIComponent(item.id)}`, {
        method: 'PUT',
        body: JSON.stringify({
          publicationStatus,
          rightsStatus: publicationStatus === 'approved' ? 'authorized' : item.rightsStatus
        })
      });
      addNotification('success', '审核状态已更新', publicationStatus === 'approved' ? '内容已发布到时尚社区。' : publicationStatus === 'pending' ? '内容已退回待审核。' : '内容已从公开信息流隐藏。');
      await loadItems();
    } catch (error) {
      addNotification('warning', '审核操作失败', error instanceof Error ? error.message : '请稍后重试。');
    } finally {
      setBusyId(null);
    }
  };

  const deletePost = async (item: FashionModerationItem) => {
    if (!window.confirm(`确定永久删除“${item.title || '未命名内容'}”及其评论吗？`)) return;
    setBusyId(item.id);
    try {
      await apiDelete(`/api/admin/fashion/community/${encodeURIComponent(item.id)}`);
      addNotification('success', '内容已删除', '帖子及其关联互动已从社区移除。');
      await loadItems();
    } catch (error) {
      addNotification('warning', '删除失败', error instanceof Error ? error.message : '请稍后重试。');
    } finally {
      setBusyId(null);
    }
  };

  const deleteComment = async (item: FashionModerationItem, commentId: string) => {
    if (!window.confirm('确定删除这条评论吗？')) return;
    setBusyId(`${item.id}:${commentId}`);
    try {
      await apiDelete(`/api/admin/fashion/community/${encodeURIComponent(item.id)}/comments/${encodeURIComponent(commentId)}`);
      addNotification('success', '评论已删除', '不适宜评论已从帖子中移除。');
      await loadItems();
    } catch (error) {
      addNotification('warning', '评论删除失败', error instanceof Error ? error.message : '请稍后重试。');
    } finally {
      setBusyId(null);
    }
  };

  const uploadSelectedFiles = async () => {
    if (!selectedFiles.length || uploadProgress) return;
    const files = [...selectedFiles];
    setUploadProgress({ current: 0, total: files.length });
    let uploaded = 0;
    const failures: string[] = [];
    const failedFiles: File[] = [];
    let customVideoPoster: Blob | undefined;
    if (customVideoCover) {
      try {
        customVideoPoster = await compressAdminImage(customVideoCover);
      } catch (error) {
        setUploadProgress(null);
        addNotification('warning', '封面处理失败', error instanceof Error ? error.message : '请换一张图片后重试。');
        return;
      }
    }
    for (const [index, file] of files.entries()) {
      setUploadProgress({ current: index + 1, total: files.length });
      try {
        const media = await getAdminMediaPayload(file, customVideoPoster);
        const fileTitle = file.name.replace(/\.[^.]+$/, '').trim();
        const title = (files.length === 1
          ? uploadTitle.trim() || fileTitle
          : [uploadTitle.trim(), fileTitle].filter(Boolean).join(' · ')).slice(0, 120) || 'RUDA Fashion';
        if (media?.mediaType === 'video') {
          const form = new FormData();
          form.set('title', title);
          form.set('text', uploadCaption);
          form.set('category', uploadCategory);
          form.set('publicationStatus', uploadStatus);
          form.set('video', media.videoFile, media.videoFile.name);
          form.set('poster', media.poster, 'poster.jpg');
          setUploadByteProgress(0);
          await apiPostWithUploadProgress('/api/admin/fashion/community/video', form, 600_000, (loaded, total) => {
            setUploadByteProgress(total > 0 ? Math.min(100, Math.round((loaded / total) * 100)) : 0);
          });
          setUploadByteProgress(0);
        } else {
          await apiPost('/api/admin/fashion/community', {
            title,
            caption: uploadCaption,
            category: uploadCategory,
            ...media,
            publicationStatus: uploadStatus
          }, 120_000);
        }
        uploaded += 1;
      } catch (error) {
        failures.push(`${file.name}: ${error instanceof Error ? error.message : '上传失败'}`);
        failedFiles.push(file);
      }
    }
    setSelectedFiles(failedFiles);
    setSelectedPreviewIndex(0);
    if (!failedFiles.length) {
      setUploadTitle('');
      setCustomVideoCover(null);
    }
    setUploadProgress(null);
    setUploadByteProgress(0);
    await loadItems();
    if (failures.length) {
      addNotification('warning', `批量上传完成：成功 ${uploaded} 个，失败 ${failures.length} 个`, `失败素材已保留，可移除或重试：${failures.slice(0, 3).join('；')}`);
    } else {
      addNotification('success', '批量上传完成', `已成功上传 ${uploaded} 个内容。`);
    }
  };

  const importSocialVideo = async () => {
    if (!socialVideoUrls.length || socialVideoUrls.length > MAX_SOCIAL_VIDEO_LINKS || !contentRightsConfirmed || importingSocialVideo) return;
    setImportingSocialVideo(true);
    setImportProgress({ current: 0, total: socialVideoUrls.length });
    setImportFailures([]);
    setDownloadedDraftCount(0);
    const failedUrls: string[] = [];
    let importedCount = 0;
    let createdCount = 0;
    let aiDraftCount = 0;
    for (const [index, url] of socialVideoUrls.entries()) {
      setImportProgress({ current: index + 1, total: socialVideoUrls.length });
      try {
        const result = await apiPost<{
          complete: boolean;
          requested: number;
          created: Array<{ id: string; title: string; aiTitleGenerated: boolean }>;
          failedClip?: number;
        }>('/api/admin/fashion/community/import-social', {
          url,
          title: socialVideoUrls.length === 1 ? uploadTitle.trim() : '',
          clipCount: sliceCount,
          caption: uploadCaption,
          category: uploadCategory,
          publicationStatus: uploadStatus,
          rightsConfirmed: true
        }, 1_200_000);
        importedCount += 1;
        createdCount += result.created.length;
        aiDraftCount += result.created.filter(clip => clip.aiTitleGenerated).length;
        if (!result.complete) failedUrls.push(`${url}（第 ${result.failedClip || '?'} 段失败）`);
      } catch (error) {
        failedUrls.push(`${url}（${error instanceof Error ? error.message : '下载失败'}）`);
      }
    }
    setSocialVideoUrl(failedUrls.map(value => value.replace(/（.*$/, '')).join('\n'));
    setImportFailures(failedUrls);
    setDownloadedDraftCount(createdCount);
    if (!failedUrls.length) {
      setUploadTitle('');
      setContentRightsConfirmed(false);
    }
    setImportProgress(null);
    setImportingSocialVideo(false);
    await loadItems();
    if (failedUrls.length) {
      addNotification(
        'warning',
        `已处理 ${importedCount}/${socialVideoUrls.length} 个链接`,
        `生成 ${createdCount} 条草稿，${failedUrls.length} 个链接未完成；失败链接已保留，可重试。`
      );
    } else {
      addNotification('success', '视频下载完成', `已生成 ${createdCount} 条草稿，其中 ${aiDraftCount} 条完成 AI 标题，可在作品中编辑或发布。`);
    }
  };

  const suggestContentFromPreview = async () => {
    if (!previewFile || suggestingContent || studioBusy) return;
    setSuggestingContent(true);
    try {
      const isVideo = previewFile.type.startsWith('video/') || /\.(mp4|m4v|mov|webm)$/i.test(previewFile.name);
      const image = isVideo
        ? await createAdminVideoPoster(previewFile, customVideoCover || undefined)
        : await compressAdminImage(previewFile);
      const result = await apiPost<{ title: string; caption: string }>('/api/admin/fashion/community/suggest-content', {
        imageDataUrl: await readFileAsDataUrl(image),
        category: uploadCategory
      }, 60_000);
      setUploadTitle(result.title);
      setUploadCaption(current => current.trim() ? current : result.caption);
      addNotification('success', 'AI 建议已填入', '检查并修改后再发布。');
    } catch (error) {
      addNotification('warning', 'AI 标题生成失败', error instanceof Error ? error.message : '请稍后重试。');
    } finally {
      setSuggestingContent(false);
    }
  };

  const sliceLargeVideo = async () => {
    if (!sliceSourceFile || !contentRightsConfirmed || slicingVideo) return;
    setSlicingVideo(true);
    setSliceUploadProgress(0);
    try {
      const form = new FormData();
      form.set('video', sliceSourceFile, sliceSourceFile.name);
      form.set('clipCount', String(sliceCount));
      form.set('title', uploadTitle.trim() || sliceSourceFile.name.replace(/\.[^.]+$/, '').slice(0, 100));
      form.set('caption', uploadCaption);
      form.set('category', uploadCategory);
      form.set('publicationStatus', uploadStatus);
      form.set('rightsConfirmed', 'true');
      const result = await apiPostWithUploadProgress<{
        complete: boolean;
        requested: number;
        created: Array<{ id: string; title: string; aiTitleGenerated: boolean }>;
        failedClip?: number;
      }>('/api/admin/fashion/community/slice-video', form, 1_800_000, (loaded, total) => {
        setSliceUploadProgress(total > 0 ? Math.min(100, Math.round((loaded / total) * 100)) : 0);
      });
      setSliceSourceFile(null);
      setUploadTitle('');
      setContentRightsConfirmed(false);
      const aiDraftCount = result.created.filter(clip => clip.aiTitleGenerated).length;
      addNotification(
        result.complete ? 'success' : 'warning',
        result.complete ? '视频智能切片完成' : '视频部分切片成功',
        result.complete
          ? `已生成 ${result.created.length} 个草稿和封面，其中 ${aiDraftCount} 个完成 AI 标题，可逐个编辑或发布。`
          : `已创建 ${result.created.length}/${result.requested} 个帖子，第 ${result.failedClip || '?'} 段失败。`
      );
      await loadItems();
    } catch (error) {
      addNotification('warning', '视频切片失败', error instanceof Error ? error.message : '请稍后重试。');
    } finally {
      setSlicingVideo(false);
      setSliceUploadProgress(0);
    }
  };

  const beginEdit = (item: FashionModerationItem) => {
    setEditingItem(item);
    setEditTitle(item.title || '');
    setEditCaption(item.caption || '');
    setEditCategory(fashionCategories.includes(item.category as (typeof fashionCategories)[number]) ? item.category as (typeof fashionCategories)[number] : fashionCategories[0]);
    setEditMediaFile(null);
  };

  const saveEdit = async () => {
    if (!editingItem || savingEdit) return;
    setSavingEdit(true);
    try {
      const media: AdminMediaPayload | null = editMediaFile ? await getAdminMediaPayload(editMediaFile) : null;
      if (media?.mediaType === 'video') {
        const form = new FormData();
        form.set('title', editTitle);
        form.set('text', editCaption);
        form.set('category', editCategory);
        form.set('publicationStatus', editingItem.publicationStatus === 'approved' ? 'approved' : 'pending');
        form.set('replaceId', editingItem.id);
        form.set('video', media.videoFile, media.videoFile.name);
        form.set('poster', media.poster, 'poster.jpg');
        await apiPostWithUploadProgress('/api/admin/fashion/community/video', form, 600_000, () => undefined);
      } else {
        await apiRequest(`/api/admin/fashion/community/${encodeURIComponent(editingItem.id)}`, {
          method: 'PUT',
          body: JSON.stringify({ title: editTitle, caption: editCaption, category: editCategory, ...media })
        });
      }
      addNotification('success', '内容编辑已保存', '标题和内容说明已更新。');
      setEditingItem(null);
      await loadItems();
    } catch (error) {
      addNotification('warning', '内容编辑失败', error instanceof Error ? error.message : '请稍后重试。');
    } finally {
      setSavingEdit(false);
    }
  };

  const filters: Array<{ id: FilterStatus; label: string; count: number }> = [
    { id: 'all', label: '全部内容', count: summary.total },
    { id: 'draft', label: '草稿', count: summary.draft },
    { id: 'pending', label: '待审核', count: summary.pending },
    { id: 'approved', label: '已发布', count: summary.approved },
    { id: 'unpublished', label: '已隐藏', count: summary.unpublished }
  ];
  const studioBusy = Boolean(uploadProgress) || slicingVideo || importingSocialVideo || suggestingContent || generatingImage;
  const selectStudioFiles = (files: File[]) => {
    const remainingSlots = Math.max(0, 40 - selectedFiles.length);
    const acceptedFiles = files.slice(0, remainingSlots);
    if (!acceptedFiles.length) return;
    if (files.length > remainingSlots) addNotification('warning', '已达到批量上限', '每批最多选择 40 个素材。');
    setSelectedFiles(current => [...current, ...acceptedFiles].slice(0, 40));
    setSelectedPreviewIndex(selectedFiles.length);
    setUploadTitle(current => {
      const priorFilename = selectedFiles[0]?.name.replace(/\.[^.]+$/, '').slice(0, 100);
      if (selectedFiles.length === 1 && current === priorFilename) return '';
      if (selectedFiles.length + acceptedFiles.length > 1) {
        const firstAcceptedFilename = acceptedFiles[0].name.replace(/\.[^.]+$/, '').slice(0, 100);
        return current === firstAcceptedFilename ? '' : current;
      }
      return current || (selectedFiles.length ? '' : acceptedFiles[0].name.replace(/\.[^.]+$/, '').slice(0, 100));
    });
  };
  const generateStudioImage = async () => {
    const prompt = imagePrompt.trim();
    if (!prompt || generatingImage || studioBusy) return;
    setGeneratingImage(true);
    setGeneratedImageCandidates([]);
    setSelectedGeneratedImageIndex(0);
    try {
      const result = await apiPost<{ imageDataUrl?: string; results?: Array<{ imageDataUrl: string; storageKey?: string; url?: string; contentType?: string; sizeBytes?: number }> }>('/api/admin/fashion/studio/generate-image', { prompt, count: 3 }, 180_000);
      const candidates = result.results && result.results.length > 0
        ? result.results
        : result.imageDataUrl
          ? [{ imageDataUrl: result.imageDataUrl }]
          : [];
      if (!candidates.length) throw new Error('AI_IMAGE_RESULT_INVALID');
      const prepared = candidates.map((candidate, index) => ({
        id: `${Date.now()}-${index}`,
        imageDataUrl: candidate.imageDataUrl,
        url: candidate.url,
        storageKey: candidate.storageKey,
        contentType: candidate.contentType,
        sizeBytes: candidate.sizeBytes
      }));
      setGeneratedImageCandidates(prepared);
      setSelectedGeneratedImageIndex(0);
      setSelectedFiles([]);
      setUploadTitle(current => current || prompt.slice(0, 100));
      setStudioMode('upload');
      addNotification('success', '图片已生成', `已生成 ${prepared.length} 个候选，可在列表中预览并保存。`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'AI_IMAGE_GENERATION_FAILED';
      const detail = /NOT_CONFIGURED|KEY_NOT_CONFIGURED/.test(message)
        ? '图片模型尚未配置。请到 AI 控制中心配置 Fal 图片服务，或启用本机图片生成服务。'
        : message;
      addNotification('warning', '图片生成失败', detail);
    } finally {
      setGeneratingImage(false);
    }
  };

  const saveSelectedGeneratedImage = async () => {
    const candidate = generatedImageCandidates[selectedGeneratedImageIndex];
    if (!candidate) return;
    try {
      const response = await fetch(candidate.imageDataUrl);
      if (!response.ok) throw new Error('AI_IMAGE_RESULT_INVALID');
      const image = await response.blob();
      if (!image.type.startsWith('image/')) throw new Error('AI_IMAGE_RESULT_INVALID');
      const file = new File([image], `ruda-ai-${Date.now()}.webp`, { type: image.type || 'image/webp' });
      setSelectedFiles([file]);
      setSelectedPreviewIndex(0);
      setUploadTitle(current => current || imagePrompt.trim().slice(0, 100));
      setStudioMode('upload');
      await loadGeneratedAssetLibrary();
      addNotification('success', '候选图已保存到作品区', '可继续完善标题、说明与发布状态。');
    } catch (error) {
      addNotification('warning', '候选图保存失败', error instanceof Error ? error.message : '请重试。');
    }
  };
  const selectSliceSource = (file: File | null) => {
    if (!file) {
      setSliceSourceFile(null);
      return;
    }
    const extension = file.name.split('.').pop()?.toLocaleLowerCase() || '';
    const supportedVideo = file.type.startsWith('video/') || ['mp4', 'm4v', 'webm', 'mov'].includes(extension);
    if (!supportedVideo) {
      addNotification('warning', '文件格式不支持', '请选择 MP4、WebM 或 MOV 视频。');
      return;
    }
    if (file.size > 500 * 1024 * 1024) {
      addNotification('warning', '视频超过大小限制', '原视频最大支持 500 MB。');
      return;
    }
    setSliceSourceFile(file);
    setUploadTitle(current => current || file.name.replace(/\.[^.]+$/, '').slice(0, 100));
  };
  const previewTitle = selectedFiles.length > 1
    ? [uploadTitle.trim(), previewFile?.name.replace(/\.[^.]+$/, '')].filter(Boolean).join(' · ')
    : uploadTitle.trim() || previewFile?.name.replace(/\.[^.]+$/, '') || '内容标题预览';
  const trimTaskPlan = getStudioTaskPlan(trimTask?.plan);
  const trimTaskResult = getStudioTaskResult(trimTask?.result);
  const normalizedTimeline = parseStudioTimelineClips(timelineClips);
  const timelineDuration = normalizedTimeline?.reduce((total, clip) => total + clip.endSeconds - clip.startSeconds, 0) || 0;
  const normalizedTextOverlays = parseStudioTextOverlays(textOverlayDrafts, timelineDuration);
  const normalizedImageOverlays = parseStudioImageOverlays(imageOverlayDrafts, timelineDuration);
  const activePreviewTextOverlay = normalizedTextOverlays?.find(overlay =>
    previewTimelineSeconds >= overlay.startSeconds && previewTimelineSeconds < overlay.endSeconds
  ) || null;
  const activePreviewImageOverlay = normalizedImageOverlays?.find(overlay =>
    previewTimelineSeconds >= overlay.startSeconds && previewTimelineSeconds < overlay.endSeconds
  ) || null;
  const activePreviewImageSource = studioImageSourceOptions.find(source =>
    source.id === activePreviewImageOverlay?.sourcePostId
  );
  const selectedCanvasPreset = studioCanvasPresets[canvasPreset];

  return (
    <section className="space-y-4">
      <AdminFashionReports />
      <section className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-xs">
        <div className="grid gap-5 p-4 sm:p-6 lg:grid-cols-[minmax(0,1fr)_280px]">
          <div className="min-w-0 space-y-4">
            <div>
              <label className="mb-3 block max-w-xs">
                <span className="mb-1.5 block text-[11px] font-semibold text-neutral-600">素材来源</span>
                <select
                  value={studioMode}
                  onChange={event => {
                    const nextMode = event.currentTarget.value;
                    if (isFashionStudioMode(nextMode)) setStudioMode(nextMode);
                  }}
                  disabled={studioBusy}
                  className="h-10 w-full rounded-lg border border-neutral-200 bg-white px-3 text-xs font-medium text-neutral-800 outline-none focus:border-neutral-800 disabled:bg-neutral-50"
                >
                  <option value="upload">本地图片 / 视频</option>
                  <option value="generate">AI 生成图片</option>
                  <option value="slice">大视频智能切片</option>
                  <option value="import">社交平台链接</option>
                </select>
              </label>
              {studioMode === 'generate' && (
                <div className="space-y-3 rounded-xl border border-neutral-200 bg-neutral-50 p-4">
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-semibold text-neutral-800">描述你要的时尚图片</span>
                    <textarea
                      value={imagePrompt}
                      onChange={event => setImagePrompt(event.target.value.slice(0, 800))}
                      maxLength={800}
                      rows={3}
                      placeholder="例如：极简高级感的春季风衣大片，米兰街景，自然光，竖版构图"
                      className="w-full resize-y rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs outline-none focus:border-neutral-800"
                    />
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={!imagePrompt.trim() || studioBusy}
                      onClick={() => void generateStudioImage()}
                      className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-neutral-950 px-4 text-xs font-semibold text-white hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {generatingImage ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                      {generatingImage ? '正在生成…' : '生成 3 个候选'}
                    </button>
                    {generatedImageCandidates.length > 0 && (
                      <button
                        type="button"
                        onClick={() => void saveSelectedGeneratedImage()}
                        className="inline-flex h-10 items-center justify-center rounded-lg border border-neutral-300 bg-white px-4 text-xs font-semibold text-neutral-700 hover:bg-neutral-50"
                      >
                        保存当前候选
                      </button>
                    )}
                  </div>
                  {generatedImageCandidates.length > 0 && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-[10px] text-neutral-600">
                        <span>候选图片 · {selectedGeneratedImageIndex + 1}/{generatedImageCandidates.length}</span>
                        <span>{generatedImageCandidates[selectedGeneratedImageIndex]?.sizeBytes ? `${Math.max(1, Math.round(generatedImageCandidates[selectedGeneratedImageIndex].sizeBytes / 1024))} KB` : '已生成'}</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        {generatedImageCandidates.map((candidate, index) => (
                          <button
                            type="button"
                            key={candidate.id}
                            onClick={() => setSelectedGeneratedImageIndex(index)}
                            className={`overflow-hidden rounded-lg border-2 ${selectedGeneratedImageIndex === index ? 'border-neutral-900' : 'border-neutral-200'} bg-white`}
                          >
                            <img src={candidate.imageDataUrl} alt={`生成候选 ${index + 1}`} className="aspect-square w-full object-cover" />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  <p className="text-[10px] leading-4 text-neutral-500">生成后会保留 3 个候选，可按需选择、保存到作品区或继续微调文案。</p>
                </div>
              )}
              {studioMode === 'upload' && (
                <>
                  <label
                    onDragOver={event => event.preventDefault()}
                    onDrop={event => {
                      event.preventDefault();
                      if (!studioBusy) selectStudioFiles(Array.from(event.dataTransfer.files));
                    }}
                    className={`flex min-h-28 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-neutral-300 bg-neutral-50 px-4 py-5 text-center transition-colors hover:border-neutral-500 hover:bg-neutral-100 ${studioBusy ? 'pointer-events-none opacity-60' : ''}`}
                  >
                    <UploadCloud className="h-6 w-6 text-neutral-500" />
                    <span className="mt-2 text-xs font-semibold text-neutral-800">拖放或点击选择图片 / 视频</span>
                    <span className="mt-1 text-[10px] text-neutral-500">最多 40 个 · 视频 20 MB / 3 分钟以内</span>
                    <input
                      type="file"
                      multiple
                      accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime,video/x-m4v"
                      className="hidden"
                      disabled={studioBusy}
                      onChange={event => {
                        selectStudioFiles(Array.from(event.currentTarget.files || []));
                        event.currentTarget.value = '';
                      }}
                    />
                  </label>
                  {selectedFiles.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {selectedFiles.map((file, index) => (
                        <span key={`${file.name}-${file.lastModified}-${index}`} className={`inline-flex max-w-full items-center gap-1 rounded-lg border py-1 pl-1 pr-1 text-[10px] text-neutral-700 ${selectedPreviewIndex === index ? 'border-neutral-900 bg-neutral-100' : 'border-neutral-200 bg-white'}`}>
                          <button type="button" onClick={() => setSelectedPreviewIndex(index)} className="flex min-w-0 items-center gap-2 text-left" aria-pressed={selectedPreviewIndex === index} title="预览素材">
                            {previewUrls[index] && (file.type.startsWith('video/') || /\.(mp4|m4v|mov|webm)$/i.test(file.name))
                              ? <video src={previewUrls[index]} muted preload="metadata" className="h-9 w-9 rounded object-cover" />
                              : previewUrls[index]
                                ? <img src={previewUrls[index]} alt="" className="h-9 w-9 rounded object-cover" />
                                : <span className="flex h-9 w-9 items-center justify-center rounded bg-neutral-100"><ImageIcon className="h-4 w-4" /></span>}
                            <span className="max-w-40 truncate">{file.name}</span>
                          </button>
                          <button type="button" disabled={studioBusy} onClick={() => {
                            setSelectedFiles(current => current.filter((_, fileIndex) => fileIndex !== index));
                            setSelectedPreviewIndex(current => Math.max(0, Math.min(current > index ? current - 1 : current === index ? index : current, selectedFiles.length - 2)));
                          }} className="rounded-full p-1 hover:bg-neutral-200 disabled:opacity-40" aria-label={`移除 ${file.name}`}><X className="h-3 w-3" /></button>
                        </span>
                      ))}
                    </div>
                  )}
                  {selectedFiles.some(file => file.type.startsWith('video/') || /\.(mp4|m4v|mov|webm)$/i.test(file.name)) && (
                    <div className="flex flex-wrap items-center gap-2">
                      <label className={`inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg border border-neutral-200 bg-white px-3 text-[11px] font-semibold text-neutral-700 hover:bg-neutral-50 ${studioBusy ? 'pointer-events-none opacity-50' : ''}`}>
                        <ImageIcon className="h-3.5 w-3.5" />
                        {customVideoCover ? '更换视频封面' : '自定义视频封面'}
                        <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" disabled={studioBusy} onChange={event => {
                          setCustomVideoCover(event.currentTarget.files?.[0] || null);
                          event.currentTarget.value = '';
                        }} />
                      </label>
                      {customVideoCover && (
                        <>
                          <span className="max-w-48 truncate text-[10px] text-neutral-500">{customVideoCover.name}</span>
                          <button type="button" disabled={studioBusy} onClick={() => setCustomVideoCover(null)} className="text-[10px] font-semibold text-neutral-500 underline disabled:opacity-50">恢复自动封面</button>
                        </>
                      )}
                    </div>
                  )}
                  {selectedFiles.length >= 40 && <p className="mt-2 text-[10px] text-amber-700">已达到 40 个文件上限</p>}
                  {uploadProgress && (
                    <div className="mt-3" aria-live="polite">
                      <div role="progressbar" aria-label="素材上传进度" aria-valuemin={0} aria-valuemax={100} aria-valuenow={uploadByteProgress} className="h-1.5 overflow-hidden rounded-full bg-neutral-200">
                        <div className="h-full bg-neutral-950 transition-[width] duration-150" style={{ width: `${uploadByteProgress}%` }} />
                      </div>
                      <p className="mt-1 text-[10px] text-neutral-500">{uploadProgress.current}/{uploadProgress.total} · {uploadByteProgress}%</p>
                    </div>
                  )}
                </>
              )}

              {studioMode === 'slice' && (
                <div className="space-y-3">
                  <label
                    onDragOver={event => event.preventDefault()}
                    onDrop={event => {
                      event.preventDefault();
                      if (!studioBusy) selectSliceSource(event.dataTransfer.files[0] || null);
                    }}
                    className={`flex min-h-24 cursor-pointer items-center gap-3 rounded-xl border border-dashed border-neutral-300 bg-neutral-50 px-4 py-4 text-xs hover:border-neutral-500 ${studioBusy ? 'pointer-events-none opacity-60' : ''}`}
                  >
                    <UploadCloud className="h-5 w-5 shrink-0 text-neutral-500" />
                    <span className="min-w-0">
                      <span className="block truncate font-semibold text-neutral-800">{sliceSourceFile ? sliceSourceFile.name : '选择长视频'}</span>
                      <span className="mt-1 block text-[10px] text-neutral-500">{sliceSourceFile ? `${(sliceSourceFile.size / 1024 / 1024).toFixed(1)} MB` : '最大 500 MB · 30 分钟'}</span>
                    </span>
                    <input
                      type="file"
                      accept="video/mp4,video/webm,video/quicktime,video/x-m4v"
                      className="hidden"
                      disabled={studioBusy}
                      onChange={event => {
                        selectSliceSource(event.currentTarget.files?.[0] || null);
                        event.currentTarget.value = '';
                      }}
                    />
                  </label>
                  <details className="rounded-lg border border-neutral-200 px-3 py-2">
                    <summary className="cursor-pointer text-[11px] font-semibold text-neutral-600">切片设置</summary>
                    <label className="mt-2 flex items-center gap-3 text-[11px] text-neutral-600" htmlFor="fashion-slice-count">
                      切成
                      <select id="fashion-slice-count" value={sliceCount} onChange={event => setSliceCount(Number(event.target.value) as 4 | 8 | 12 | 16)} disabled={studioBusy} className="h-9 rounded-lg border border-neutral-200 bg-white px-3 text-xs">
                        {[4, 8, 12, 16].map(count => <option key={count} value={count}>{count} 段</option>)}
                      </select>
                    </label>
                  </details>
                  {slicingVideo && <p className="text-[10px] text-neutral-500">处理中 · {sliceUploadProgress}%</p>}
                </div>
              )}

              {studioMode === 'import' && (
                <div className="space-y-3">
                  <textarea
                    value={socialVideoUrl}
                    onChange={event => setSocialVideoUrl(event.target.value)}
                    maxLength={6200}
                    disabled={studioBusy}
                    placeholder={batchSocialLinks ? '粘贴多个 TikTok、Instagram、YouTube 或 Facebook 链接，每行一个' : '粘贴 TikTok、Instagram、YouTube 或 Facebook 链接'}
                    rows={batchSocialLinks ? 4 : 2}
                    className="w-full resize-y rounded-lg border border-neutral-200 px-3 py-3 text-xs outline-none focus:border-neutral-800 disabled:bg-neutral-50"
                  />
                  <p className="text-[10px] text-neutral-500">{socialVideoUrls.length}/{MAX_SOCIAL_VIDEO_LINKS} 个链接 · 下载后自动切片并保存为草稿</p>
                  {socialVideoUrls.length > MAX_SOCIAL_VIDEO_LINKS && <p role="alert" className="text-[11px] text-rose-700">一次最多处理 {MAX_SOCIAL_VIDEO_LINKS} 个链接</p>}
                  {importProgress && <p className="text-[11px] text-neutral-600">正在下载第 {importProgress.current}/{importProgress.total} 个</p>}
                  {importFailures.length > 0 && (
                    <ul role="alert" className="space-y-1 rounded-lg bg-rose-50 p-3 text-[10px] leading-4 text-rose-800">
                      {importFailures.map((failure, index) => <li key={`${index}-${failure}`} className="break-all">{failure}</li>)}
                    </ul>
                  )}
                  <details className="rounded-lg border border-neutral-200 px-3 py-2">
                    <summary className="cursor-pointer text-[11px] font-semibold text-neutral-600">高级设置</summary>
                    <label className="mt-2 flex items-center gap-3 text-[11px] text-neutral-600" htmlFor="fashion-import-slice-count">
                      每个视频切成
                      <select id="fashion-import-slice-count" value={sliceCount} onChange={event => setSliceCount(Number(event.target.value) as 4 | 8 | 12 | 16)} disabled={studioBusy} className="h-9 rounded-lg border border-neutral-200 bg-white px-3 text-xs">
                        {[4, 8, 12, 16].map(count => <option key={count} value={count}>{count} 段</option>)}
                      </select>
                    </label>
                  </details>
                </div>
              )}
            </div>

            <div className="space-y-3">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={uploadTitle}
                  onChange={event => setUploadTitle(event.target.value.slice(0, 100))}
                  maxLength={100}
                  aria-label="作品标题"
                  placeholder={studioMode === 'upload' && selectedFiles.length > 1 ? '批量标题前缀（选填）' : '作品标题'}
                  className="h-10 min-w-0 flex-1 rounded-lg border border-neutral-200 px-3 text-xs outline-none focus:border-neutral-800"
                />
                <button
                  type="button"
                  disabled={!previewFile || studioBusy || suggestingContent}
                  onClick={() => void suggestContentFromPreview()}
                  className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-lg border border-neutral-200 px-3 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-45"
                >
                  {suggestingContent ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                  AI 写标题
                </button>
              </div>
              <details className="rounded-lg border border-neutral-200 px-3 py-2">
                <summary className="cursor-pointer text-[11px] font-semibold text-neutral-600">编辑说明与发布选项</summary>
                <div className="mt-3 space-y-3">
                  <textarea value={uploadCaption} onChange={event => setUploadCaption(event.target.value)} maxLength={2000} rows={3} aria-label="作品说明" placeholder="作品说明（选填）" className="w-full resize-y rounded-lg border border-neutral-200 px-3 py-2 text-xs outline-none focus:border-neutral-800" />
                  <select aria-label="作品分类" value={uploadCategory} onChange={event => setUploadCategory(event.target.value as (typeof fashionCategories)[number])} className="h-9 rounded-lg border border-neutral-200 bg-white px-3 text-xs">
                    {fashionCategories.map(category => <option key={category} value={category}>{category}</option>)}
                  </select>
                  {studioMode === 'upload' && (
                  <select aria-label="发布状态" value={uploadStatus} onChange={event => setUploadStatus(event.target.value as 'pending' | 'approved')} className="h-9 rounded-lg border border-neutral-200 bg-white px-3 text-xs">
                    <option value="approved">立即发布</option>
                    <option value="pending">待审核</option>
                  </select>
                  )}
                </div>
              </details>
              {(studioMode === 'slice' || studioMode === 'import') && (
                <label className="flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-[11px] leading-5 text-amber-900">
                  <input type="checkbox" checked={contentRightsConfirmed} onChange={event => setContentRightsConfirmed(event.target.checked)} disabled={studioBusy} className="mt-0.5 h-4 w-4 shrink-0 accent-neutral-950" />
                  <span>我拥有版权或已获得转载授权</span>
                </label>
              )}
            </div>

            {studioMode !== 'generate' && <button
              type="button"
              disabled={studioBusy || (studioMode === 'upload'
                ? !selectedFiles.length
                : studioMode === 'slice'
                  ? !sliceSourceFile || !contentRightsConfirmed
                  : !socialVideoUrls.length || socialVideoUrls.length > MAX_SOCIAL_VIDEO_LINKS || !contentRightsConfirmed)}
              onClick={() => {
                if (studioMode === 'upload') void uploadSelectedFiles();
                else if (studioMode === 'slice') void sliceLargeVideo();
                else void importSocialVideo();
              }}
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-neutral-950 px-4 text-xs font-semibold text-white hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
            >
              {studioBusy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : studioMode === 'upload' ? <UploadCloud className="h-4 w-4" /> : studioMode === 'slice' ? <Film className="h-4 w-4" /> : <Link2 className="h-4 w-4" />}
              {studioMode === 'upload'
                ? uploadProgress ? `上传中 ${uploadProgress.current}/${uploadProgress.total}` : `上传素材${selectedFiles.length > 1 ? ` (${selectedFiles.length})` : ''}`
                : studioMode === 'slice'
                  ? slicingVideo ? `处理中 ${sliceUploadProgress}%` : '开始智能切片'
                  : importingSocialVideo ? `下载中 ${importProgress?.current || 0}/${importProgress?.total || socialVideoUrls.length}` : `开始下载${socialVideoUrls.length > 1 ? ` (${socialVideoUrls.length})` : ''}`}
            </button>}
            {studioMode === 'import' && downloadedDraftCount > 0 && (
                <button
                  type="button"
                  onClick={() => worksSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                  className="ml-3 h-11 px-3 text-xs font-semibold text-neutral-700 underline underline-offset-2"
                >
                  查看并编辑 {downloadedDraftCount} 条草稿
                </button>
            )}
          </div>

          <aside className="rounded-xl bg-neutral-50 p-4">
            <p className="mb-3 text-xs font-bold text-neutral-800">预览</p>
            <div className="mx-auto w-full max-w-[250px] overflow-hidden rounded-[2rem] border-[6px] border-neutral-900 bg-neutral-950 shadow-lg">
              <div className="relative aspect-[9/16] overflow-hidden bg-neutral-800">
                {previewUrl && previewFile && (previewFile.type.startsWith('video/') || /\.(mp4|m4v|mov|webm)$/i.test(previewFile.name)) ? (
                  <video src={previewUrl} poster={customVideoCoverUrl || undefined} controls playsInline className="absolute inset-0 h-full w-full bg-black object-contain" />
                ) : previewUrl && previewFile ? (
                  <img src={previewUrl} alt="素材实时预览" className="absolute inset-0 h-full w-full object-cover" />
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-5 text-center text-white/70">
                    {studioMode === 'import' && socialVideoUrl ? <Link2 className="h-8 w-8" /> : <ImageIcon className="h-8 w-8" />}
                    <span className="text-[10px]">{studioMode === 'import' && socialVideoUrl ? '链接导入后显示' : '选择素材预览'}</span>
                  </div>
                )}
                <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent px-3 pb-4 pt-12 text-white">
                  <p className="text-[9px] font-bold tracking-wide">RUDA.FASHION</p>
                  <p className="mt-1 line-clamp-2 text-xs font-semibold">{previewTitle}</p>
                  {uploadCaption && <p className="mt-1 line-clamp-2 text-[9px] leading-4 text-white/80">{uploadCaption}</p>}
                  <p className="mt-1 text-[9px] text-white/70">{uploadCategory}</p>
                </div>
              </div>
            </div>
            {studioMode === 'upload' && selectedFiles.length > 1 && (
              <p className="mx-auto mt-2 max-w-[250px] text-center text-[10px] text-neutral-500">{selectedPreviewIndex + 1} / {selectedFiles.length}</p>
            )}
            {customVideoCover && (
              <p className="mx-auto mt-2 max-w-[250px] text-center text-[10px] text-neutral-500">本批次视频使用自定义封面</p>
            )}
          </aside>
        </div>
      </section>

      <div ref={worksSectionRef} className="flex flex-col gap-3 rounded-xl border border-neutral-200 bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-sm font-bold text-neutral-900">社区作品</h2>
          <span className="text-xs text-neutral-500">{summary.total}</span>
          <select aria-label="筛选作品状态" value={status} onChange={event => {
            const nextStatus = event.currentTarget.value;
            if (isFilterStatus(nextStatus)) setStatus(nextStatus);
          }} className="h-9 rounded-lg border border-neutral-200 bg-white px-2 text-xs">
            {filters.map(filter => <option key={filter.id} value={filter.id}>{filter.label} · {filter.count}</option>)}
          </select>
        </div>
        <div className="flex gap-2">
          <label className="relative block min-w-0 flex-1 sm:w-72">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
            <input value={query} onChange={event => setQuery(event.target.value)} placeholder="搜索作品" className="h-10 w-full rounded-lg border border-neutral-200 bg-white pl-9 pr-3 text-xs outline-none focus:border-neutral-800" />
          </label>
          <button type="button" onClick={() => void loadItems()} disabled={loading} className="inline-flex h-10 shrink-0 items-center gap-2 rounded-lg border border-neutral-200 bg-white px-3 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 disabled:opacity-50">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />刷新
          </button>
        </div>
      </div>

      {(studioProjects.length > 0 || studioProjectsError) && (
        <details className="rounded-xl border border-neutral-200 bg-white px-4 py-3">
          <summary className="cursor-pointer text-xs font-semibold text-neutral-800">
            最近项目 · {studioProjects.length}
          </summary>
          {studioProjectsError && (
            <p role="alert" className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-[11px] leading-5 text-rose-800">
              项目暂不可用：{studioProjectsError}。如刚启用此功能，请先部署数据库迁移后再试。
            </p>
          )}
          {studioProjects.length > 0 && (
            <div className="mt-3 divide-y divide-neutral-100">
              {studioProjects.map(project => (
                <button
                  key={project.id}
                  type="button"
                  onClick={() => void openSavedVideoProject(project.id)}
                  className="flex w-full items-center justify-between gap-3 py-2 text-left"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-[11px] font-medium text-neutral-800">{project.title}</span>
                    <span className="block truncate text-[10px] text-neutral-500">
                      {project.document.clips.length} 个片段 · {project.document.clips.reduce((total, clip) => total + clip.endSeconds - clip.startSeconds, 0).toFixed(1)} 秒
                      {' · '}更新于 {new Date(project.updatedAt).toLocaleString(getIntlLocale(lang))}
                    </span>
                  </span>
                  <span className="shrink-0 text-[10px] font-semibold text-neutral-600">继续剪辑</span>
                </button>
              ))}
            </div>
          )}
          <button
            type="button"
            onClick={() => void loadStudioProjects()}
            disabled={studioProjectsLoading}
            className="mt-2 text-[10px] font-semibold text-neutral-600 underline underline-offset-2 disabled:opacity-50"
          >
            {studioProjectsLoading ? '刷新中…' : '刷新项目'}
          </button>
        </details>
      )}

      {studioTasks.length > 0 && (
        <details className="rounded-xl border border-neutral-200 bg-white px-4 py-3">
          <summary className="cursor-pointer text-xs font-semibold text-neutral-800">
            视频任务 · {studioTasks.filter(task => !studioTaskIsTerminal(task.status)).length} 个处理中
          </summary>
          <div className="mt-3 divide-y divide-neutral-100">
            {studioTasks.slice(0, 10).map(task => {
              const plan = getStudioTaskPlan(task.plan);
              return (
                <button
                  key={task.id}
                  type="button"
                  onClick={() => {
                    videoPreviewRef.current?.pause();
                    setTimelinePreviewPlaying(false);
                    setTrimEditorItem(null);
                    setTrimTask(task);
                    setTrimError('');
                  }}
                  className="flex w-full items-center justify-between gap-3 py-2 text-left"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-[11px] font-medium text-neutral-800">{task.goal || task.id}</span>
                    <span className="block truncate text-[10px] text-neutral-500">
                      {task.lastErrorCode
                        ? formatStudioTrimError(task.lastErrorCode)
                        : plan?.stage === 'rendering_clip'
                          ? `渲染片段 ${String(plan.clipIndex || '?')} / ${String(plan.clipCount || '?')}`
                          : studioTaskStageLabel[String(plan?.stage || '')] || task.id}
                    </span>
                  </span>
                  <span className="shrink-0 text-[10px] font-semibold text-neutral-600">{studioTaskStatusLabel[task.status] || task.status}</span>
                </button>
              );
            })}
          </div>
        </details>
      )}

      {loading && items.length === 0 ? (
        <div className="flex min-h-48 items-center justify-center rounded-xl border border-neutral-200 bg-white text-xs text-neutral-500"><LoaderCircle className="mr-2 h-4 w-4 animate-spin" />加载中</div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-neutral-300 bg-white px-4 py-14 text-center">
          <ShieldAlert className="mx-auto h-7 w-7 text-neutral-300" />
          <p className="mt-2 text-sm font-semibold text-neutral-700">暂无作品</p>
          {(status !== 'all' || query) && (
            <button type="button" onClick={() => { setStatus('all'); setQuery(''); }} className="mt-2 text-xs font-semibold text-neutral-600 underline underline-offset-2">清除筛选</button>
          )}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {items.map(item => (
            <article key={item.id} className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-xs">
              <div className="relative aspect-[4/3] bg-neutral-100">
                {item.mediaType === 'video' && item.videoUrl ? (
                  <video src={item.videoUrl} poster={item.image || undefined} controls preload="none" playsInline className="h-full w-full object-contain bg-neutral-950" />
                ) : item.image ? (
                  <img src={item.image} alt={item.title || '时尚社区图片'} loading="lazy" className="h-full w-full object-cover" />
                ) : <div className="flex h-full items-center justify-center text-neutral-300"><ImageIcon className="h-10 w-10" /></div>}
                <span className={`absolute left-3 top-3 rounded-full px-2.5 py-1 text-[9px] font-bold ${item.publicationStatus === 'approved' ? 'bg-emerald-600 text-white' : item.publicationStatus === 'draft' ? 'bg-sky-500 text-white' : item.publicationStatus === 'pending' ? 'bg-amber-400 text-neutral-950' : 'bg-neutral-800 text-white'}`}>
                  {item.publicationStatus === 'approved' ? '已发布' : item.publicationStatus === 'draft' ? '切片草稿' : item.publicationStatus === 'pending' ? '待审核' : '已隐藏'}
                </span>
                {item.mediaType === 'video' && <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-black/65 px-2 py-1 text-[9px] font-semibold text-white"><Film className="h-3 w-3" />视频</span>}
              </div>
              <div className="space-y-3 p-4">
                <div>
                  {item.category && <span className="mb-1 inline-flex rounded-full bg-neutral-100 px-2 py-0.5 text-[9px] font-semibold text-neutral-600">{item.category}</span>}
                  <h3 className="line-clamp-1 text-sm font-bold">{item.title || 'RUDA Fashion'}</h3>
                  <p className="mt-1 line-clamp-2 min-h-8 text-xs leading-4 text-neutral-600">{item.caption || '暂无文字说明'}</p>
                  {item.mediaItems?.[0]?.sourceClips && item.mediaItems[0].sourceClips.length > 1 ? (
                    <p className="mt-1 text-[10px] text-neutral-500">
                      时间线 {item.mediaItems[0].sourceClips.length} 段 · {item.mediaItems[0].sourceClips.reduce((total, clip) => total + clip.endSeconds - clip.startSeconds, 0).toFixed(1)} 秒
                    </p>
                  ) : item.mediaItems?.[0]?.sourceStartSeconds !== undefined && item.mediaItems[0].sourceEndSeconds !== undefined && (
                    <p className="mt-1 text-[10px] text-neutral-500">
                      片段 {formatClipTime(item.mediaItems[0].sourceStartSeconds)}–{formatClipTime(item.mediaItems[0].sourceEndSeconds)}
                      {' · '}{formatClipTime(item.mediaItems[0].sourceEndSeconds - item.mediaItems[0].sourceStartSeconds)}
                    </p>
                  )}
                  <p className="mt-2 text-[10px] text-neutral-400">{item.merchantName} · {new Date(item.createdAt).toLocaleString(getIntlLocale(lang))}</p>
                </div>
                <div className="flex items-center gap-4 border-y border-neutral-100 py-2 text-[10px] text-neutral-500">
                  <span className="inline-flex items-center gap-1"><Heart className="h-3.5 w-3.5" />{item.stats.likes}</span>
                  <span className="inline-flex items-center gap-1"><Play className="h-3.5 w-3.5" />{item.stats.views} 播放</span>
                  <button type="button" onClick={() => setExpandedComments(current => current === item.id ? null : item.id)} className="inline-flex items-center gap-1 hover:text-neutral-900"><MessageCircle className="h-3.5 w-3.5" />{item.stats.comments} 评论</button>
                  <span>收藏 {item.stats.saves}</span>
                </div>
                {expandedComments === item.id && (
                  <div className="space-y-2">
                    {item.comments.length ? item.comments.map(comment => (
                      <div key={comment.id} className="flex items-start justify-between gap-2 rounded-lg bg-neutral-50 p-2">
                        <div className="min-w-0"><p className="text-[10px] font-semibold text-neutral-600">{comment.displayName}</p><p className="break-words text-xs text-neutral-700">{comment.text}</p></div>
                        <button type="button" disabled={busyId === `${item.id}:${comment.id}`} onClick={() => void deleteComment(item, comment.id)} aria-label="删除评论" className="rounded p-1 text-neutral-400 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"><Trash2 className="h-3.5 w-3.5" /></button>
                      </div>
                    )) : <p className="text-[10px] text-neutral-400">暂无评论</p>}
                    {item.stats.comments > item.comments.length && <p className="text-[10px] text-neutral-400">仅显示最近 5 条；共 {item.stats.comments} 条</p>}
                  </div>
                )}
                <div className="flex flex-wrap gap-2">
                  {item.mediaType === 'video' && item.videoUrl && <a href={item.videoUrl} download target="_blank" rel="noreferrer" className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg border border-neutral-200 px-3 text-[11px] font-semibold text-neutral-700 hover:bg-neutral-50"><Download className="h-3.5 w-3.5" />下载</a>}
                  {item.mediaType === 'video' && item.videoUrl && <button type="button" onClick={() => openTrimEditor(item)} className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg border border-neutral-300 px-3 text-[11px] font-semibold text-neutral-800 hover:bg-neutral-100"><Scissors className="h-3.5 w-3.5" />剪辑并导出</button>}
                  <button type="button" disabled={busyId === item.id} onClick={() => beginEdit(item)} className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg border border-neutral-200 px-3 text-[11px] font-semibold text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"><Edit3 className="h-3.5 w-3.5" />编辑</button>
                  {item.publicationStatus !== 'approved' && <button type="button" disabled={busyId === item.id} onClick={() => void reviewPost(item, 'approved')} className="inline-flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-lg bg-emerald-700 px-3 text-[11px] font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"><Check className="h-3.5 w-3.5" />{item.publicationStatus === 'draft' ? '发布' : '审核通过并发布'}</button>}
                  {item.publicationStatus === 'approved' && <button type="button" disabled={busyId === item.id} onClick={() => void reviewPost(item, 'unpublished')} className="inline-flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-lg border border-amber-300 px-3 text-[11px] font-semibold text-amber-800 hover:bg-amber-50 disabled:opacity-50"><ShieldAlert className="h-3.5 w-3.5" />隐藏内容</button>}
                  {item.publicationStatus === 'unpublished' && <button type="button" disabled={busyId === item.id} onClick={() => void reviewPost(item, 'pending')} className="min-h-9 rounded-lg border border-neutral-300 px-3 text-[11px] font-semibold text-neutral-700 hover:bg-neutral-50 disabled:opacity-50">恢复为待审核</button>}
                  <button type="button" disabled={busyId === item.id} onClick={() => void deletePost(item)} className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg border border-rose-200 px-3 text-[11px] font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50"><Trash2 className="h-3.5 w-3.5" />删除</button>
                </div>
                {busyId === item.id && <p className="inline-flex items-center gap-1 text-[10px] text-neutral-400"><LoaderCircle className="h-3 w-3 animate-spin" />正在保存…</p>}
              </div>
            </article>
          ))}
        </div>
      )}
      {hasMoreItems && (
        <button type="button" onClick={() => void loadItems(true)} disabled={loading} className="mx-auto flex h-10 items-center gap-2 rounded-full border border-neutral-300 px-5 text-xs font-semibold hover:border-neutral-800 disabled:opacity-50">
          {loading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
          {loading ? '正在加载…' : '加载更多内容'}
        </button>
      )}
      {editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setEditingItem(null); }}>
          <form className="w-full max-w-lg space-y-4 rounded-2xl bg-white p-5 shadow-2xl" onSubmit={event => { event.preventDefault(); void saveEdit(); }}>
            <div className="flex items-center justify-between"><h3 className="text-base font-bold">编辑社区内容</h3><button type="button" onClick={() => setEditingItem(null)} className="rounded-lg p-2 text-neutral-500 hover:bg-neutral-100" aria-label="关闭"><X className="h-4 w-4" /></button></div>
            <label className="block space-y-1.5 text-xs font-semibold text-neutral-700">标题<input value={editTitle} onChange={event => setEditTitle(event.target.value)} maxLength={120} required className="h-10 w-full rounded-lg border border-neutral-200 px-3 font-normal outline-none focus:border-neutral-800" /></label>
            <label className="block space-y-1.5 text-xs font-semibold text-neutral-700">内容说明<textarea value={editCaption} onChange={event => setEditCaption(event.target.value)} maxLength={2000} rows={5} className="w-full rounded-lg border border-neutral-200 px-3 py-2 font-normal outline-none focus:border-neutral-800" /></label>
            <label className="block space-y-1.5 text-xs font-semibold text-neutral-700">时尚分类<select value={editCategory} onChange={event => setEditCategory(event.target.value as (typeof fashionCategories)[number])} className="h-10 w-full rounded-lg border border-neutral-200 bg-white px-3 font-normal">{fashionCategories.map(category => <option key={category} value={category}>{category}</option>)}</select></label>
            <label className="block space-y-1.5 text-xs font-semibold text-neutral-700">替换图片或视频（可选）<input type="file" accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime" onChange={event => setEditMediaFile(event.currentTarget.files?.[0] || null)} className="block w-full rounded-lg border border-neutral-200 p-2 text-xs font-normal" /></label>
            {editMediaFile && <div className="flex items-center justify-between rounded-lg bg-neutral-50 px-3 py-2 text-xs"><span className="truncate">{editMediaFile.name}</span><button type="button" onClick={() => setEditMediaFile(null)} className="ml-2 text-neutral-500 hover:text-rose-600">移除</button></div>}
            <div className="flex justify-end gap-2"><button type="button" onClick={() => setEditingItem(null)} className="h-10 rounded-lg border border-neutral-200 px-4 text-xs font-semibold">取消</button><button type="submit" disabled={savingEdit} className="inline-flex h-10 items-center gap-2 rounded-lg bg-neutral-950 px-4 text-xs font-semibold text-white disabled:opacity-50">{savingEdit && <LoaderCircle className="h-4 w-4 animate-spin" />}保存修改</button></div>
          </form>
        </div>
      )}
      {(trimEditorItem || trimTask) && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4"
          role="presentation"
          onMouseDown={event => {
            if (event.target === event.currentTarget) {
              closeTrimEditor();
            }
          }}
        >
          <section className="w-full max-w-xl space-y-4 rounded-2xl border border-neutral-200 bg-white p-5 shadow-2xl">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-base font-bold text-neutral-950">{trimEditorItem ? '剪辑视频' : '视频导出任务'}</h3>
              <button type="button" onClick={closeTrimEditor} className="rounded-lg p-2 text-neutral-500 hover:bg-neutral-100" aria-label="关闭">
                <X className="h-4 w-4" />
              </button>
            </div>
            {trimEditorItem && (
              <>
                <div
                  className="relative mx-auto overflow-hidden rounded-xl bg-black"
                  style={selectedCanvasPreset
                    ? {
                      aspectRatio: selectedCanvasPreset.aspectRatio,
                      width: selectedCanvasPreset.previewWidth,
                      maxWidth: '100%'
                    }
                    : undefined}
                >
                  <video
                    ref={videoPreviewRef}
                    key={`${trimEditorItem.id}-${previewSourceId}`}
                    src={previewSource?.videoUrl || undefined}
                    poster={previewSource?.image || undefined}
                    preload="metadata"
                    playsInline
                    className={selectedCanvasPreset
                      ? 'absolute inset-0 h-full w-full object-contain'
                      : 'max-h-[42vh] w-full object-contain'}
                    onLoadedMetadata={event => {
                      const duration = event.currentTarget.duration;
                      const activeClipIndex = Math.min(activeTimelineClipIndexRef.current, timelineClips.length - 1);
                      const activeClip = timelineClips[activeClipIndex];
                      if (Number.isFinite(duration) && duration > 0 && activeClip?.endSeconds === '15' && duration < 15) {
                        updateTimelineClip(activeClip.id, { endSeconds: String(Number(duration.toFixed(1))) });
                      }
                      const parsedClips = parseStudioTimelineClips(timelineClips);
                      const parsedActiveClip = parsedClips?.[activeClipIndex];
                      if (parsedActiveClip) {
                        const pendingSeek = pendingTimelineSeekRef.current;
                        const targetSeconds = pendingSeek ?? parsedActiveClip.startSeconds;
                        pendingTimelineSeekRef.current = targetSeconds;
                        event.currentTarget.currentTime = targetSeconds;
                        if (pendingSeek === null) {
                          setPreviewTimelineSeconds(parsedClips.slice(0, activeClipIndex).reduce(
                            (total, clip) => total + clip.endSeconds - clip.startSeconds,
                            0
                          ));
                        }
                      }
                    }}
                    onTimeUpdate={event => updateTimelinePreviewPosition(event.currentTarget.currentTime)}
                    onSeeked={event => {
                      const pendingSeek = pendingTimelineSeekRef.current;
                      if (pendingSeek !== null && Math.abs(event.currentTarget.currentTime - pendingSeek) <= 0.08) {
                        pendingTimelineSeekRef.current = null;
                        updateTimelinePreviewPosition(event.currentTarget.currentTime);
                        if (playTimelineAfterSeekRef.current) {
                          playTimelineAfterSeekRef.current = false;
                          void event.currentTarget.play().catch(() => {
                            addNotification('warning', '预览无法继续播放', '请再次点击播放，或检查浏览器的媒体播放权限。');
                          });
                        }
                      }
                    }}
                    onPlay={() => setTimelinePreviewPlaying(true)}
                    onPause={() => setTimelinePreviewPlaying(false)}
                    onEnded={handleTimelinePreviewEnded}
                  />
                  {activePreviewImageOverlay && activePreviewImageSource && (
                    <img
                      src={activePreviewImageSource.image}
                      alt=""
                      className={`pointer-events-none absolute max-h-[70%] max-w-[70%] object-contain ${
                        activePreviewImageOverlay.position === 'top-left'
                          ? 'left-2 top-2'
                          : activePreviewImageOverlay.position === 'top-right'
                            ? 'right-2 top-2'
                            : activePreviewImageOverlay.position === 'center'
                              ? 'left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2'
                              : activePreviewImageOverlay.position === 'bottom-left'
                                ? 'bottom-2 left-2'
                                : 'bottom-2 right-2'
                      }`}
                      style={{ width: `${activePreviewImageOverlay.sizePercent}%` }}
                    />
                  )}
                  {activePreviewTextOverlay && (
                    <div
                      className={`pointer-events-none absolute left-2 right-2 text-center font-semibold text-white [text-shadow:0_1px_3px_#000] ${
                        activePreviewTextOverlay.position === 'top'
                          ? 'top-[12%]'
                          : activePreviewTextOverlay.position === 'center'
                            ? 'top-1/2 -translate-y-1/2'
                            : 'bottom-[12%]'
                      }`}
                      style={{
                        fontSize: `${Math.max(12, Math.round(activePreviewTextOverlay.fontSize * 0.55))}px`,
                        lineHeight: 1.2
                      }}
                    >
                      <span className="rounded bg-black/60 px-2 py-1">{activePreviewTextOverlay.text}</span>
                    </div>
                  )}
                </div>
                <div className="space-y-3 rounded-xl border border-neutral-200 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-xs font-bold text-neutral-900">视频时间线</p>
                      <p className="mt-0.5 text-[10px] text-neutral-500">{timelineClips.length} 段 · {normalizedTimeline ? `${timelineDuration.toFixed(1)} / 180 秒` : '检查片段范围'}</p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={toggleTimelinePreview}
                        disabled={!normalizedTimeline || trimSubmitting || Boolean(trimTask)}
                        aria-label={timelinePreviewPlaying ? '暂停时间线预览' : '播放时间线预览'}
                        className="inline-flex h-8 items-center gap-1 rounded-lg bg-neutral-950 px-2.5 text-[10px] font-semibold text-white hover:bg-neutral-800 disabled:opacity-50"
                      >
                        {timelinePreviewPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                        {timelinePreviewPlaying ? '暂停' : '播放'}
                      </button>
                      <button
                        type="button"
                        onClick={addTimelineClip}
                        disabled={timelineClips.length >= MAX_STUDIO_TIMELINE_CLIPS}
                        className="inline-flex h-8 items-center gap-1 rounded-lg border border-neutral-300 px-2.5 text-[10px] font-semibold text-neutral-700 hover:bg-neutral-100 disabled:opacity-50"
                      >
                        <Plus className="h-3.5 w-3.5" />添加片段
                      </button>
                    </div>
                  </div>
                  <label className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-neutral-200 bg-white px-3 py-2">
                    <span>
                      <span className="block text-[10px] font-semibold text-neutral-700">导出画幅</span>
                      <span className="text-[9px] text-neutral-500">保持完整画面，空白区域以黑色填充。</span>
                    </span>
                    <select
                      value={canvasPreset}
                      disabled={trimSubmitting || Boolean(trimTask)}
                      onChange={event => {
                        setCanvasPreset(event.currentTarget.value as FashionStudioCanvasPreset);
                        setProjectSaveState('dirty');
                      }}
                      aria-label="导出画幅"
                      className="h-8 min-w-28 rounded-md border border-neutral-200 bg-white px-2 text-[10px] font-semibold text-neutral-800 outline-none focus:border-neutral-800 disabled:opacity-50"
                    >
                      {Object.entries(studioCanvasPresets).map(([value, preset]) => (
                        <option key={value} value={value}>{preset?.label || '原素材比例'}</option>
                      ))}
                    </select>
                  </label>
                  <div className="flex min-h-7 gap-1 overflow-x-auto rounded-md bg-neutral-100 p-1" aria-label="时间线片段顺序">
                    {timelineClips.map((clip, index) => {
                      const duration = Math.max(0, Number(clip.endSeconds) - Number(clip.startSeconds));
                      const widthPercent = timelineDuration > 0 ? Math.max(9, duration / timelineDuration * 100) : 100 / timelineClips.length;
                      return (
                        <button
                          key={clip.id}
                          type="button"
                          onClick={() => seekTimelineTime(timelineClips.slice(0, index).reduce(
                            (total, previous) => total + Math.max(0, Number(previous.endSeconds) - Number(previous.startSeconds)),
                            0
                          ))}
                          title={`片段 ${index + 1} · ${clip.startSeconds}–${clip.endSeconds} 秒`}
                          style={{ flexBasis: `${widthPercent}%` }}
                          className="min-w-12 rounded bg-neutral-800 px-2 py-1 text-[9px] font-semibold text-white hover:bg-neutral-600"
                        >
                          {index + 1} · {Number.isFinite(duration) ? `${duration.toFixed(1)}s` : '—'}
                        </button>
                      );
                    })}
                  </div>
                  <label className="block space-y-1 text-[9px] font-semibold text-neutral-600">
                    <span className="flex items-center justify-between gap-2">
                      <span>时间线播放头</span>
                      <span className="tabular-nums text-neutral-500">
                        {Math.min(previewTimelineSeconds, timelineDuration).toFixed(1)} / {timelineDuration.toFixed(1)} 秒
                      </span>
                    </span>
                    <input
                      type="range"
                      min="0"
                      max={timelineDuration || 0}
                      step="0.05"
                      value={Math.min(previewTimelineSeconds, timelineDuration)}
                      disabled={!normalizedTimeline}
                      onChange={event => seekTimelineTime(Number(event.currentTarget.value))}
                      aria-label="时间线播放头位置"
                      className="h-1.5 w-full accent-neutral-900 disabled:opacity-40"
                    />
                  </label>
                  <div className="space-y-2">
                    {timelineClips.map((clip, index) => (
                      <div key={clip.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-lg bg-neutral-50 p-2.5">
                        <div className="min-w-0">
                          <div className="mb-2 flex items-center justify-between gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                seekTimelineTime(timelineClips.slice(0, index).reduce(
                                  (total, previous) => total + Math.max(0, Number(previous.endSeconds) - Number(previous.startSeconds)),
                                  0
                                ));
                              }}
                              className="truncate text-[10px] font-semibold text-neutral-800 hover:underline"
                            >
                              片段 {index + 1} · {Number.isFinite(Number(clip.endSeconds) - Number(clip.startSeconds)) ? `${(Number(clip.endSeconds) - Number(clip.startSeconds)).toFixed(1)} 秒` : '时间无效'}
                            </button>
                            <div className="flex shrink-0 gap-1">
                              <button type="button" disabled={index === 0} onClick={() => moveTimelineClip(index, -1)} className="rounded p-1 text-neutral-500 hover:bg-neutral-200 disabled:opacity-30" aria-label={`片段 ${index + 1} 上移`}><ArrowUp className="h-3 w-3" /></button>
                              <button type="button" disabled={index === timelineClips.length - 1} onClick={() => moveTimelineClip(index, 1)} className="rounded p-1 text-neutral-500 hover:bg-neutral-200 disabled:opacity-30" aria-label={`片段 ${index + 1} 下移`}><ArrowDown className="h-3 w-3" /></button>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <label className="space-y-1 text-[9px] font-semibold text-neutral-600">
                              入点（秒）
                              <input type="number" min="0" max="1800" step="0.1" value={clip.startSeconds} onChange={event => updateTimelineClip(clip.id, { startSeconds: event.target.value })} className="h-8 w-full rounded-md border border-neutral-200 bg-white px-2 text-[10px] font-normal outline-none focus:border-neutral-800" />
                            </label>
                            <label className="space-y-1 text-[9px] font-semibold text-neutral-600">
                              出点（秒）
                              <input type="number" min="0.1" max="1800" step="0.1" value={clip.endSeconds} onChange={event => updateTimelineClip(clip.id, { endSeconds: event.target.value })} className="h-8 w-full rounded-md border border-neutral-200 bg-white px-2 text-[10px] font-normal outline-none focus:border-neutral-800" />
                            </label>
                          </div>
                          <label className="mt-2 block space-y-1 text-[9px] font-semibold text-neutral-600">
                            素材来源
                            <select
                              value={clip.sourcePostId || trimEditorItem.id}
                              disabled={studioVideoSourceOptions.length < 2 || trimSubmitting || Boolean(trimTask)}
                              onChange={event => updateTimelineClip(clip.id, {
                                sourcePostId: event.currentTarget.value === trimEditorItem.id
                                  ? undefined
                                  : event.currentTarget.value
                              })}
                              className="h-8 w-full rounded-md border border-neutral-200 bg-white px-2 text-[10px] font-normal outline-none focus:border-neutral-800 disabled:bg-neutral-100"
                              aria-label={`片段 ${index + 1} 素材来源`}
                            >
                              {studioVideoSourceOptions.map(source => (
                                <option key={source.id} value={source.id}>
                                  {source.id === trimEditorItem.id ? '主素材 · ' : ''}{source.title || '未命名视频'}
                                </option>
                              ))}
                            </select>
                          </label>
                        </div>
                        <button type="button" disabled={timelineClips.length <= 1} onClick={() => removeTimelineClip(clip.id)} className="rounded-lg p-2 text-neutral-500 hover:bg-rose-50 hover:text-rose-700 disabled:opacity-30" aria-label={`删除片段 ${index + 1}`}><Trash2 className="h-3.5 w-3.5" /></button>
                      </div>
                    ))}
                  </div>
                  <div className="rounded-lg border border-neutral-200 bg-white px-3 py-2.5">
                    <label htmlFor="studio-original-audio-volume" className="flex items-center justify-between gap-3 text-[10px] font-semibold text-neutral-700">
                      <span>原声音轨</span>
                      <span className="tabular-nums text-neutral-500">{Math.round(audioVolume * 100)}%</span>
                    </label>
                    <input
                      id="studio-original-audio-volume"
                      type="range"
                      min="0"
                      max="2"
                      step="0.05"
                      value={audioVolume}
                      onChange={event => {
                        setAudioVolume(Number(event.target.value));
                        setProjectSaveState('dirty');
                      }}
                      aria-label="原声音量"
                      className="mt-2 h-1.5 w-full accent-neutral-900"
                    />
                    <p className="mt-1 text-[9px] text-neutral-500">静音至 200%；调整会保存到项目并应用于导出。</p>
                  </div>
                  <section className="space-y-3 rounded-lg border border-neutral-200 bg-white p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="text-[10px] font-bold text-neutral-800">字幕 / 文字轨</p>
                        <p className="text-[9px] text-neutral-500">按成片时间定位；预览与导出使用同一时间范围。</p>
                      </div>
                      <button
                        type="button"
                        onClick={addTextOverlay}
                        disabled={!normalizedTimeline || textOverlayDrafts.length >= MAX_STUDIO_TEXT_OVERLAYS || trimSubmitting || Boolean(trimTask)}
                        className="inline-flex h-8 shrink-0 items-center gap-1 rounded-lg border border-neutral-300 px-2.5 text-[10px] font-semibold text-neutral-700 hover:bg-neutral-100 disabled:opacity-50"
                      >
                        <Plus className="h-3.5 w-3.5" />添加文字
                      </button>
                    </div>
                    <div className="relative h-8 overflow-hidden rounded-md bg-neutral-100" aria-label="字幕和文字时间线">
                      {textOverlayDrafts.map((overlay, index) => {
                        const startSeconds = Number(overlay.startSeconds) || 0;
                        const endSeconds = Number(overlay.endSeconds) || 0;
                        const leftPercent = timelineDuration > 0
                          ? Math.min(100, Math.max(0, startSeconds / timelineDuration * 100))
                          : 0;
                        const widthPercent = timelineDuration > 0
                          ? Math.min(100 - leftPercent, Math.max(2, (endSeconds - startSeconds) / timelineDuration * 100))
                          : 0;
                        return (
                          <button
                            key={overlay.id}
                            type="button"
                            onClick={() => seekTimelineTime(startSeconds)}
                            title={`${overlay.text} · ${startSeconds.toFixed(1)}–${endSeconds.toFixed(1)} 秒`}
                            className="absolute inset-y-1 truncate rounded bg-neutral-800 px-1.5 text-left text-[9px] font-semibold text-white hover:bg-neutral-600"
                            style={{ left: `${leftPercent}%`, width: `${widthPercent}%` }}
                          >
                            {index + 1} · {overlay.text || '文字'}
                          </button>
                        );
                      })}
                    </div>
                    {textOverlayDrafts.length ? (
                      <div className="max-h-52 space-y-2 overflow-y-auto">
                        {textOverlayDrafts.map((overlay, index) => (
                          <div key={overlay.id} className="space-y-2 rounded-lg bg-neutral-50 p-2.5">
                            <div className="flex items-center justify-between gap-2">
                              <button type="button" onClick={() => seekTimelineTime(Number(overlay.startSeconds) || 0)} className="text-[9px] font-semibold text-neutral-700 hover:underline">
                                文字 {index + 1} · {overlay.position === 'top' ? '上方' : overlay.position === 'center' ? '居中' : '下方'}
                              </button>
                              <button
                                type="button"
                                disabled={trimSubmitting || Boolean(trimTask)}
                                onClick={() => removeTextOverlay(overlay.id)}
                                className="rounded p-1 text-neutral-500 hover:bg-rose-50 hover:text-rose-700 disabled:opacity-40"
                                aria-label={`删除文字 ${index + 1}`}
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </div>
                            <textarea
                              value={overlay.text}
                              maxLength={200}
                              rows={2}
                              disabled={trimSubmitting || Boolean(trimTask)}
                              onChange={event => updateTextOverlay(overlay.id, { text: event.target.value })}
                              aria-label={`文字 ${index + 1} 内容`}
                              className="w-full resize-y rounded-md border border-neutral-200 bg-white px-2 py-1.5 text-[10px] outline-none focus:border-neutral-800 disabled:opacity-60"
                            />
                            <div className="grid grid-cols-2 gap-2">
                              <label className="space-y-1 text-[9px] font-semibold text-neutral-600">
                                入点（成片秒）
                                <input
                                  type="number"
                                  min="0"
                                  max={timelineDuration}
                                  step="0.1"
                                  value={overlay.startSeconds}
                                  disabled={trimSubmitting || Boolean(trimTask)}
                                  onChange={event => updateTextOverlay(overlay.id, { startSeconds: event.target.value })}
                                  className="h-8 w-full rounded-md border border-neutral-200 bg-white px-2 text-[10px] font-normal outline-none focus:border-neutral-800 disabled:opacity-60"
                                />
                              </label>
                              <label className="space-y-1 text-[9px] font-semibold text-neutral-600">
                                出点（成片秒）
                                <input
                                  type="number"
                                  min="0.25"
                                  max={timelineDuration}
                                  step="0.1"
                                  value={overlay.endSeconds}
                                  disabled={trimSubmitting || Boolean(trimTask)}
                                  onChange={event => updateTextOverlay(overlay.id, { endSeconds: event.target.value })}
                                  className="h-8 w-full rounded-md border border-neutral-200 bg-white px-2 text-[10px] font-normal outline-none focus:border-neutral-800 disabled:opacity-60"
                                />
                              </label>
                              <label className="space-y-1 text-[9px] font-semibold text-neutral-600">
                                位置
                                <select
                                  value={overlay.position}
                                  disabled={trimSubmitting || Boolean(trimTask)}
                                  onChange={event => updateTextOverlay(overlay.id, { position: event.target.value as FashionStudioTextOverlay['position'] })}
                                  className="h-8 w-full rounded-md border border-neutral-200 bg-white px-2 text-[10px] font-normal outline-none focus:border-neutral-800 disabled:opacity-60"
                                >
                                  <option value="top">上方</option>
                                  <option value="center">居中</option>
                                  <option value="bottom">下方</option>
                                </select>
                              </label>
                              <label className="space-y-1 text-[9px] font-semibold text-neutral-600">
                                字号
                                <input
                                  type="number"
                                  min="18"
                                  max="96"
                                  step="1"
                                  value={overlay.fontSize}
                                  disabled={trimSubmitting || Boolean(trimTask)}
                                  onChange={event => updateTextOverlay(overlay.id, { fontSize: Number(event.target.value) })}
                                  className="h-8 w-full rounded-md border border-neutral-200 bg-white px-2 text-[10px] font-normal outline-none focus:border-neutral-800 disabled:opacity-60"
                                />
                              </label>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[9px] text-neutral-500">还没有文字。点击“添加文字”创建一条可编辑、可保存并会真实渲染的字幕轨。</p>
                    )}
                  </section>
                  <section className="space-y-3 rounded-lg border border-neutral-200 bg-white p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="text-[10px] font-bold text-neutral-800">图片叠加轨</p>
                        <p className="text-[9px] text-neutral-500">从素材库选图，设定显示时间、位置和尺寸；预览与导出保持一致。</p>
                      </div>
                      <button
                        type="button"
                        onClick={addImageOverlay}
                        disabled={!normalizedTimeline || !studioImageSourceOptions.length || imageOverlayDrafts.length >= MAX_STUDIO_IMAGE_OVERLAYS || trimSubmitting || Boolean(trimTask)}
                        className="inline-flex h-8 shrink-0 items-center gap-1 rounded-lg border border-neutral-300 px-2.5 text-[10px] font-semibold text-neutral-700 hover:bg-neutral-100 disabled:opacity-50"
                      >
                        <Plus className="h-3.5 w-3.5" />添加图片
                      </button>
                    </div>
                    <div className="relative h-8 overflow-hidden rounded-md bg-neutral-100" aria-label="图片叠加时间线">
                      {imageOverlayDrafts.map((overlay, index) => {
                        const startSeconds = Number(overlay.startSeconds) || 0;
                        const endSeconds = Number(overlay.endSeconds) || 0;
                        const leftPercent = timelineDuration > 0
                          ? Math.min(100, Math.max(0, startSeconds / timelineDuration * 100))
                          : 0;
                        const widthPercent = timelineDuration > 0
                          ? Math.min(100 - leftPercent, Math.max(2, (endSeconds - startSeconds) / timelineDuration * 100))
                          : 0;
                        return (
                          <button
                            key={overlay.id}
                            type="button"
                            onClick={() => seekTimelineTime(startSeconds)}
                            title={`图片 ${index + 1} · ${startSeconds.toFixed(1)}–${endSeconds.toFixed(1)} 秒`}
                            className="absolute inset-y-1 truncate rounded bg-neutral-500 px-1.5 text-left text-[9px] font-semibold text-white hover:bg-neutral-700"
                            style={{ left: `${leftPercent}%`, width: `${widthPercent}%` }}
                          >
                            {index + 1} · 图片
                          </button>
                        );
                      })}
                    </div>
                    {imageOverlayDrafts.length ? (
                      <div className="max-h-52 space-y-2 overflow-y-auto">
                        {imageOverlayDrafts.map((overlay, index) => (
                          <div key={overlay.id} className="space-y-2 rounded-lg bg-neutral-50 p-2.5">
                            <div className="flex items-center justify-between gap-2">
                              <button type="button" onClick={() => seekTimelineTime(Number(overlay.startSeconds) || 0)} className="text-[9px] font-semibold text-neutral-700 hover:underline">
                                图片 {index + 1}
                              </button>
                              <button
                                type="button"
                                disabled={trimSubmitting || Boolean(trimTask)}
                                onClick={() => removeImageOverlay(overlay.id)}
                                className="rounded p-1 text-neutral-500 hover:bg-rose-50 hover:text-rose-700 disabled:opacity-40"
                                aria-label={`删除图片叠加 ${index + 1}`}
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </div>
                            <label className="block space-y-1 text-[9px] font-semibold text-neutral-600">
                              图片素材
                              <select
                                value={overlay.sourcePostId}
                                disabled={trimSubmitting || Boolean(trimTask)}
                                onChange={event => updateImageOverlay(overlay.id, { sourcePostId: event.currentTarget.value })}
                                className="h-8 w-full rounded-md border border-neutral-200 bg-white px-2 text-[10px] font-normal outline-none focus:border-neutral-800 disabled:opacity-60"
                                aria-label={`图片叠加 ${index + 1} 素材来源`}
                              >
                                {!studioImageSourceOptions.some(source => source.id === overlay.sourcePostId) && (
                                  <option value={overlay.sourcePostId}>当前图片不可用 · 请选择新素材</option>
                                )}
                                {studioImageSourceOptions.map(source => (
                                  <option key={source.id} value={source.id}>{source.title || '未命名图片'}</option>
                                ))}
                              </select>
                            </label>
                            {!studioImageSourceOptions.some(source => source.id === overlay.sourcePostId) && (
                              <p role="alert" className="text-[9px] text-amber-700">这张图片目前无法用于导出；可重新选择素材或删除此轨道，项目仍可恢复。</p>
                            )}
                            <div className="grid grid-cols-2 gap-2">
                              <label className="space-y-1 text-[9px] font-semibold text-neutral-600">
                                入点（成片秒）
                                <input
                                  type="number"
                                  min="0"
                                  max={timelineDuration}
                                  step="0.1"
                                  value={overlay.startSeconds}
                                  disabled={trimSubmitting || Boolean(trimTask)}
                                  onChange={event => updateImageOverlay(overlay.id, { startSeconds: event.target.value })}
                                  className="h-8 w-full rounded-md border border-neutral-200 bg-white px-2 text-[10px] font-normal outline-none focus:border-neutral-800 disabled:opacity-60"
                                />
                              </label>
                              <label className="space-y-1 text-[9px] font-semibold text-neutral-600">
                                出点（成片秒）
                                <input
                                  type="number"
                                  min="0.25"
                                  max={timelineDuration}
                                  step="0.1"
                                  value={overlay.endSeconds}
                                  disabled={trimSubmitting || Boolean(trimTask)}
                                  onChange={event => updateImageOverlay(overlay.id, { endSeconds: event.target.value })}
                                  className="h-8 w-full rounded-md border border-neutral-200 bg-white px-2 text-[10px] font-normal outline-none focus:border-neutral-800 disabled:opacity-60"
                                />
                              </label>
                              <label className="space-y-1 text-[9px] font-semibold text-neutral-600">
                                位置
                                <select
                                  value={overlay.position}
                                  disabled={trimSubmitting || Boolean(trimTask)}
                                  onChange={event => updateImageOverlay(overlay.id, { position: event.currentTarget.value as FashionStudioImageOverlay['position'] })}
                                  className="h-8 w-full rounded-md border border-neutral-200 bg-white px-2 text-[10px] font-normal outline-none focus:border-neutral-800 disabled:opacity-60"
                                >
                                  <option value="top-left">左上</option>
                                  <option value="top-right">右上</option>
                                  <option value="center">居中</option>
                                  <option value="bottom-left">左下</option>
                                  <option value="bottom-right">右下</option>
                                </select>
                              </label>
                              <label className="space-y-1 text-[9px] font-semibold text-neutral-600">
                                尺寸
                                <select
                                  value={overlay.sizePercent}
                                  disabled={trimSubmitting || Boolean(trimTask)}
                                  onChange={event => updateImageOverlay(overlay.id, { sizePercent: Number(event.currentTarget.value) })}
                                  className="h-8 w-full rounded-md border border-neutral-200 bg-white px-2 text-[10px] font-normal outline-none focus:border-neutral-800 disabled:opacity-60"
                                >
                                  {[15, 25, 35, 50, 65].map(size => <option key={size} value={size}>{size}%</option>)}
                                </select>
                              </label>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[9px] text-neutral-500">
                        {studioImageSourceOptions.length
                          ? '尚未添加图片。添加后可在预览中检查显示效果，并在导出中真实合成。'
                          : '当前素材列表没有可用图片；先将图片导入素材库，再添加叠加轨。'}
                      </p>
                    )}
                  </section>
                </div>
                <section className="space-y-3 rounded-xl border border-neutral-200 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-xs font-bold text-neutral-900">背景音乐</p>
                      <p className="mt-0.5 text-[10px] text-neutral-500">单独混入成片，可裁剪音乐并调节音量。</p>
                    </div>
                    <label className={`inline-flex h-8 cursor-pointer items-center gap-1 rounded-lg border border-neutral-300 px-2.5 text-[10px] font-semibold text-neutral-700 hover:bg-neutral-100 ${studioAudioUploading || projectSaving || trimSubmitting || trimTask ? 'pointer-events-none opacity-50' : ''}`}>
                      {studioAudioUploading || projectSaving ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <UploadCloud className="h-3.5 w-3.5" />}
                      {studioAudioUploading
                        ? studioAudioUploadProgress >= 99 ? '正在检查音乐…' : `导入中 ${studioAudioUploadProgress}%`
                        : projectSaving ? '保存中' : studioAudioTrack ? '更换音乐' : '导入音乐'}
                      <input
                        type="file"
                        accept="audio/mpeg,audio/mp4,audio/wav,audio/x-wav,audio/ogg,audio/webm,audio/aac,audio/flac,.mp3,.m4a,.wav,.ogg,.webm,.aac,.flac"
                        className="sr-only"
                        disabled={studioAudioUploading || projectSaving || trimSubmitting || Boolean(trimTask)}
                        onChange={event => {
                          const file = event.currentTarget.files?.[0];
                          event.currentTarget.value = '';
                          if (file) void uploadStudioAudio(file);
                        }}
                      />
                    </label>
                  </div>
                  {studioAudioUploading && (
                    <div className="h-1.5 overflow-hidden rounded-full bg-neutral-100">
                      <div className="h-full rounded-full bg-neutral-900 transition-[width]" style={{ width: `${studioAudioUploadProgress}%` }} />
                    </div>
                  )}
                  {studioAudioTrack && (
                    <div className="space-y-3 rounded-lg bg-neutral-50 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-[11px] font-semibold text-neutral-800">{studioAudioTrack.fileName}</p>
                          <p className="text-[9px] text-neutral-500">{studioAudioTrack.durationSeconds.toFixed(1)} 秒 · {studioAudioTrack.contentType}</p>
                        </div>
                        <button
                          type="button"
                          disabled={studioAudioUploading || projectSaving || trimSubmitting || Boolean(trimTask)}
                          onClick={() => void removeStudioAudioTrack()}
                          className="shrink-0 rounded-lg border border-neutral-200 px-2.5 py-1.5 text-[10px] font-semibold text-neutral-600 hover:bg-white disabled:opacity-50"
                        >
                          移除
                        </button>
                      </div>
                      {studioAudioPreviewError ? (
                        <p role="alert" className="text-[10px] text-rose-700">{studioAudioPreviewError}</p>
                      ) : studioAudioPreviewUrl ? (
                        <audio
                          controls
                          preload="metadata"
                          src={studioAudioPreviewUrl}
                          crossOrigin="use-credentials"
                          onError={() => setStudioAudioPreviewError(formatStudioTrimError('FASHION_STUDIO_AUDIO_PREVIEW_FAILED'))}
                          className="h-9 w-full"
                          aria-label="背景音乐预览"
                        />
                      ) : (
                        <p className="text-[10px] text-neutral-500">背景音乐预览不可用。</p>
                      )}
                      <div className="grid grid-cols-2 gap-2">
                        <label className="space-y-1 text-[9px] font-semibold text-neutral-600">
                          音乐入点（秒）
                          <input
                            type="number"
                            min="0"
                            max={studioAudioTrack.durationSeconds}
                            step="0.1"
                            value={studioAudioTrack.trimStartSeconds}
                            onChange={event => updateStudioAudioTrack({ trimStartSeconds: event.currentTarget.value === '' ? Number.NaN : Number(event.currentTarget.value) })}
                            className="h-8 w-full rounded-md border border-neutral-200 bg-white px-2 text-[10px] font-normal outline-none focus:border-neutral-800"
                          />
                        </label>
                        <label className="space-y-1 text-[9px] font-semibold text-neutral-600">
                          音乐出点（秒）
                          <input
                            type="number"
                            min="0.25"
                            max={studioAudioTrack.durationSeconds}
                            step="0.1"
                            value={studioAudioTrack.trimEndSeconds}
                            onChange={event => updateStudioAudioTrack({ trimEndSeconds: event.currentTarget.value === '' ? Number.NaN : Number(event.currentTarget.value) })}
                            className="h-8 w-full rounded-md border border-neutral-200 bg-white px-2 text-[10px] font-normal outline-none focus:border-neutral-800"
                          />
                        </label>
                      </div>
                      <label className="block text-[9px] font-semibold text-neutral-600">
                        音乐音量 <span className="float-right tabular-nums text-neutral-500">{Math.round(studioAudioTrack.volume * 100)}%</span>
                        <input
                          type="range"
                          min="0"
                          max="2"
                          step="0.05"
                          value={studioAudioTrack.volume}
                          onChange={event => updateStudioAudioTrack({ volume: Number(event.currentTarget.value) })}
                          aria-label="背景音乐音量"
                          className="mt-2 h-1.5 w-full accent-neutral-900"
                        />
                      </label>
                    </div>
                  )}
                  <p className="text-[9px] leading-4 text-neutral-500">支持 MP3、M4A、WAV、OGG、WebM、AAC、FLAC；单个最大 100 MB、30 分钟。请只导入已获授权的音乐。</p>
                </section>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={undoEditorChange}
                    disabled={!canUndo || projectSaving || trimSubmitting || studioAudioUploading || Boolean(trimTask)}
                    className="inline-flex h-8 items-center gap-1 rounded-lg border border-neutral-200 px-2.5 text-[10px] font-semibold text-neutral-700 hover:bg-neutral-100 disabled:opacity-40"
                  >
                    <Undo2 className="h-3.5 w-3.5" />撤销
                  </button>
                  <button
                    type="button"
                    onClick={redoEditorChange}
                    disabled={!canRedo || projectSaving || trimSubmitting || studioAudioUploading || Boolean(trimTask)}
                    className="inline-flex h-8 items-center gap-1 rounded-lg border border-neutral-200 px-2.5 text-[10px] font-semibold text-neutral-700 hover:bg-neutral-100 disabled:opacity-40"
                  >
                    <Redo2 className="h-3.5 w-3.5" />重做
                  </button>
                  <button
                    type="button"
                    onClick={() => setProjectHistoryOpen(current => !current)}
                    disabled={!activeProjectId || projectSaving || studioAudioUploading || Boolean(trimTask)}
                    aria-expanded={projectHistoryOpen}
                    className="inline-flex h-8 items-center gap-1 rounded-lg border border-neutral-200 px-2.5 text-[10px] font-semibold text-neutral-700 hover:bg-neutral-100 disabled:opacity-40"
                  >
                    <History className="h-3.5 w-3.5" />版本历史{projectVersions.length ? ` (${projectVersions.length})` : ''}
                  </button>
                </div>
                {projectHistoryOpen && (
                  <section className="space-y-2 rounded-xl border border-neutral-200 bg-neutral-50 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[10px] font-bold text-neutral-800">已保存版本</p>
                      <p className="text-[9px] text-neutral-500">保留最近 20 个修改前版本</p>
                    </div>
                    {projectVersions.length ? (
                      <div className="max-h-40 space-y-1.5 overflow-y-auto">
                        {[...projectVersions].reverse().map((version, index) => (
                          <div key={version.id} className="flex items-center justify-between gap-2 rounded-lg bg-white px-2.5 py-2">
                            <div className="min-w-0">
                              <p className="truncate text-[10px] font-semibold text-neutral-800">{version.title}</p>
                              <p className="text-[9px] text-neutral-500">{new Date(version.createdAt).toLocaleString()} · {version.document.clips.length} 段</p>
                            </div>
                            <button
                              type="button"
                              disabled={projectSaving || trimSubmitting || studioAudioUploading || Boolean(trimTask)}
                              onClick={() => restoreProjectVersion(version)}
                              className="shrink-0 rounded-md border border-neutral-200 px-2 py-1 text-[9px] font-semibold text-neutral-700 hover:bg-neutral-100 disabled:opacity-40"
                            >
                              恢复
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[9px] leading-4 text-neutral-500">还没有历史版本。项目每次保存新的编辑内容时，服务器会保留修改前版本。</p>
                    )}
                  </section>
                )}
                <label className="block space-y-1.5 text-xs font-semibold text-neutral-700">
                  <span className="flex items-center justify-between gap-2">
                    项目名称
                    <span className={`text-[10px] font-medium ${projectSaveState === 'error' ? 'text-rose-700' : 'text-neutral-500'}`}>
                      {projectSaveState === 'saved' ? '已自动保存' : projectSaveState === 'saving' ? '正在保存…' : projectSaveState === 'dirty' ? '有未保存修改' : projectSaveState === 'error' ? '保存失败' : activeProjectId ? '' : '新项目'}
                    </span>
                  </span>
                  <input
                    value={projectTitle}
                    onChange={event => {
                      setProjectTitle(event.target.value);
                      setProjectSaveState('dirty');
                    }}
                    maxLength={120}
                    className="h-10 w-full rounded-lg border border-neutral-200 px-3 font-normal outline-none focus:border-neutral-800"
                  />
                </label>
                <p className="text-[11px] text-neutral-500">按顺序拼接同一源视频的片段，最多 12 段、总长 180 秒；项目保存原声音量和独立音乐轨。</p>
              </>
            )}
            {trimError && <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-800">{trimError}</p>}
            {trimTask && (
              <div className="space-y-2 rounded-xl bg-neutral-100 p-4" aria-live="polite">
                <p className="text-sm font-semibold text-neutral-900">
                  {studioTaskStatusLabel[trimTask.status] || trimTask.status}
                  {trimTaskPlan?.stage && !studioTaskIsTerminal(trimTask.status)
                    ? ` · ${trimTaskPlan.stage === 'rendering_clip'
                      ? `渲染片段 ${String(trimTaskPlan.clipIndex || '?')} / ${String(trimTaskPlan.clipCount || '?')}`
                      : studioTaskStageLabel[String(trimTaskPlan.stage)] || '处理中'}`
                    : ''}
                </p>
                {trimTask.lastErrorCode && <p className="text-xs leading-5 text-rose-800">{formatStudioTrimError(trimTask.lastErrorCode)}</p>}
                {trimTask.status === 'completed' && trimTaskResult && Boolean(trimTaskResult.postId) && (
                  <p className="text-xs leading-5 text-neutral-700">
                    成品已校验并保存为草稿，时长 {Number(trimTaskResult.durationSeconds || 0).toFixed(1)} 秒，文件 {(Number(trimTaskResult.sizeBytes || 0) / 1024 / 1024).toFixed(1)} MB。
                  </p>
                )}
                {studioTaskIsTerminal(trimTask.status) && trimTask.status !== 'completed' && !trimTask.lastErrorCode && (
                  <p className="text-xs text-neutral-600">任务已结束，源素材保持不变。</p>
                )}
              </div>
            )}
            <div className="flex flex-wrap justify-end gap-2">
              {trimTask && !studioTaskIsTerminal(trimTask.status) && (
                <button type="button" onClick={() => void cancelVideoTrim()} className="h-10 rounded-lg border border-neutral-300 px-4 text-xs font-semibold text-neutral-700 hover:bg-neutral-100">取消任务</button>
              )}
              {trimEditorItem && !trimTask && (
                <>
                  <button
                    type="button"
                    onClick={() => void saveVideoProject()}
                    disabled={projectSaving || trimSubmitting || studioAudioUploading}
                    className="inline-flex h-10 items-center gap-2 rounded-lg border border-neutral-300 px-4 text-xs font-semibold text-neutral-700 hover:bg-neutral-100 disabled:opacity-50"
                  >
                    {projectSaving && <LoaderCircle className="h-4 w-4 animate-spin" />}
                    保存项目
                  </button>
                  <button
                    type="button"
                    onClick={() => void startVideoTrim()}
                    disabled={trimSubmitting || projectSaving || studioAudioUploading}
                    className="inline-flex h-10 items-center gap-2 rounded-lg bg-neutral-950 px-4 text-xs font-semibold text-white hover:bg-neutral-800 disabled:opacity-50"
                  >
                    {trimSubmitting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Scissors className="h-4 w-4" />}
                    加入导出任务
                  </button>
                </>
              )}
              {trimTask?.status === 'completed' && (
                <button
                  type="button"
                  onClick={() => {
                    setStatus('draft');
                    setQuery('');
                    setTrimEditorItem(null);
                    setTrimTask(null);
                  }}
                  className="h-10 rounded-lg bg-neutral-950 px-4 text-xs font-semibold text-white hover:bg-neutral-800"
                >
                  查看成品草稿
                </button>
              )}
            </div>
          </section>
        </div>
      )}
    </section>
  );
};
