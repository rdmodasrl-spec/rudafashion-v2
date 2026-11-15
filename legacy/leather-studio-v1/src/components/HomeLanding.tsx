import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  FolderOpen,
  ImagePlus,
  Loader2,
  Plus,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import type { ProjectListItem } from '../api/client';
import { BAG_TYPE_LABELS, STRUCTURE_TYPE_LABELS } from '../shared/leatherKnowledge';
import { MASTER_PATTERN_LIBRARY } from '../shared/masterPatternLibrary';
import {
  analyzeSinglePhotoQuality,
  evaluateMultiAngleBatch,
} from '../shared/imageQualityAnalyzer';
import type {
  AiAnalysisJob,
  BagType,
  CaptureGuidanceProfile,
  CaptureMode,
  ImageAngle,
  PhotoQualityCheckItem,
} from '../shared/types';
import { PrecisionCapturePanel } from './PrecisionCapturePanel';

interface UploadedPhotoDraft {
  id: string;
  name: string;
  angle: ImageAngle;
  dataUrl: string;
  mimeType: string;
}

interface HomeLandingProps {
  projects: ProjectListItem[];
  loadingProjects: boolean;
  activeJob: AiAnalysisJob | null;
  errorMsg: string | null;
  onStartAiDesign: (payload: {
    name: string;
    images: UploadedPhotoDraft[];
    userBrief: string;
    captureGuidance?: Partial<CaptureGuidanceProfile>;
  }) => Promise<void>;
  onCreateBlankProject: (bagType?: BagType) => Promise<void>;
  onCreateFromTemplate: (templateId: string, name?: string) => Promise<void>;
  onOpenProject: (id: string) => Promise<void>;
  onDeleteProject: (id: string) => Promise<void>;
  onOpenIntelligence?: () => void;
  userEmail?: string | null;
  onSignOut?: () => Promise<void>;
}

const ANGLE_OPTIONS: Array<{ value: ImageAngle; label: string }> = [
  { value: 'front', label: '正面' },
  { value: 'back', label: '背面' },
  { value: 'left', label: '左侧' },
  { value: 'right', label: '右侧' },
  { value: 'side', label: '侧面' },
  { value: 'bottom', label: '底部' },
  { value: 'top', label: '顶部' },
  { value: 'interior', label: '内部' },
  { value: 'detail', label: '细节' },
];

const GUIDED_SEVEN_ANGLES: Array<{ value: ImageAngle; label: string }> = [
  { value: 'front', label: '正面' },
  { value: 'back', label: '背面' },
  { value: 'left', label: '左侧' },
  { value: 'right', label: '右侧' },
  { value: 'bottom', label: '底部' },
  { value: 'top', label: '顶部' },
  { value: 'interior', label: '内部' },
];

const SAMPLE_PRESETS: Array<{
  title: string;
  subtitle: string;
  bagType: BagType;
  imageUrl: string;
  brief: string;
}> = [
  {
    title: '植鞣牛皮托特包',
    subtitle: '推荐尺寸 300 × 240 × 120 mm',
    bagType: 'tote',
    imageUrl: '/src/assets/images/sample_tote_bag_1794583671666.jpg',
    brief: '帮我做出这个托特包，尺寸宽 30 厘米、高 24 厘米、侧面 12 厘米，植鞣牛皮，生成生产纸格。',
  },
  {
    title: '盒式小牛皮手提包',
    subtitle: '推荐尺寸 280 × 210 × 110 mm',
    bagType: 'handbag',
    imageUrl: '/src/assets/images/sample_handbag_1794583674127.jpg',
    brief: '帮我拆解这款手提包，宽 28 厘米、高 21 厘米、侧面 11 厘米，带底托加固板和拉链内袋。',
  },
  {
    title: '圆弧侧围肩背包',
    subtitle: '推荐尺寸 270 × 185 × 90 mm',
    bagType: 'shoulder_bag',
    imageUrl: '/src/assets/images/sample_shoulder_bag_1794583671772.jpg',
    brief: '帮我打版这款圆弧侧面肩背包，宽 27 厘米、高 18.5 厘米、侧面 9 厘米，软摔纹牛皮折边工艺。',
  },
];

export const HomeLanding: React.FC<HomeLandingProps> = ({
  projects,
  loadingProjects,
  activeJob,
  errorMsg,
  onStartAiDesign,
  onCreateBlankProject,
  onCreateFromTemplate,
  onOpenProject,
  onDeleteProject,
  onOpenIntelligence,
  userEmail,
  onSignOut,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const angleInputRef = useRef<HTMLInputElement | null>(null);
  const [targetUploadAngle, setTargetUploadAngle] = useState<ImageAngle>('front');
  const [captureMode, setCaptureMode] = useState<CaptureMode>('quick_ai');
  const [referenceObjectType, setReferenceObjectType] =
    useState<NonNullable<CaptureGuidanceProfile['referenceObjectType']>>('none');
  const [referenceObjectMm, setReferenceObjectMm] = useState<number>(85.6);
  const [photos, setPhotos] = useState<UploadedPhotoDraft[]>([]);
  const [userBrief, setUserBrief] = useState(
    '帮我做出这个包，尺寸宽 30 厘米、高 24 厘米、侧面 12 厘米，帮我生成生产纸格。'
  );
  const [projectName, setProjectName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [tplBagFilter, setTplBagFilter] = useState<BagType>('tote');
  const [perPhotoChecks, setPerPhotoChecks] = useState<Record<string, PhotoQualityCheckItem>>({});
  const [analyzingQuality, setAnalyzingQuality] = useState(false);

  const runQualityCheck = useCallback(async (items: UploadedPhotoDraft[], forceAll = false) => {
    if (items.length === 0) return;
    setAnalyzingQuality(true);
    try {
      const next: Record<string, PhotoQualityCheckItem> = {};
      for (const p of items) {
        const existing = !forceAll ? perPhotoChecks[p.id] : undefined;
        if (existing) {
          next[p.id] = { ...existing, angle: p.angle };
        } else {
          next[p.id] = await analyzeSinglePhotoQuality(p);
        }
      }
      setPerPhotoChecks(next);
    } finally {
      setAnalyzingQuality(false);
    }
  }, [perPhotoChecks]);

  useEffect(() => {
    let cancelled = false;
    if (photos.length === 0) {
      setPerPhotoChecks({});
      return;
    }
    const missing = photos.filter((p) => !perPhotoChecks[p.id]);
    const angleChanged = photos.some(
      (p) => perPhotoChecks[p.id] && perPhotoChecks[p.id].angle !== p.angle
    );
    if (missing.length === 0 && !angleChanged) return;

    (async () => {
      setAnalyzingQuality(true);
      const updated: Record<string, PhotoQualityCheckItem> = {};
      for (const p of photos) {
        if (perPhotoChecks[p.id]) {
          updated[p.id] = { ...perPhotoChecks[p.id], angle: p.angle };
        } else {
          updated[p.id] = await analyzeSinglePhotoQuality(p);
        }
      }
      if (!cancelled) {
        setPerPhotoChecks(updated);
        setAnalyzingQuality(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [photos, perPhotoChecks]);

  const orderedChecks = useMemo(
    () =>
      photos
        .map((p) => perPhotoChecks[p.id])
        .filter((x): x is PhotoQualityCheckItem => Boolean(x)),
    [photos, perPhotoChecks]
  );

  const batchAudit = useMemo(
    () => evaluateMultiAngleBatch(orderedChecks, referenceObjectType),
    [orderedChecks, referenceObjectType]
  );

  const handleFiles = async (files: FileList | null, forcedAngle?: ImageAngle) => {
    if (!files) return;
    const valid = Array.from(files).filter((f) =>
      ['image/jpeg', 'image/png', 'image/webp'].includes(f.type)
    );
    const loaded: UploadedPhotoDraft[] = [];
    for (const file of valid) {
      const dataUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.readAsDataURL(file);
      });
      const fallbackAngle: ImageAngle =
        photos.length === 0 && loaded.length === 0
          ? 'front'
          : captureMode === 'precision_pattern'
            ? GUIDED_SEVEN_ANGLES.find(
                (g) => !photos.some((p) => p.angle === g.value) && !loaded.some((p) => p.angle === g.value)
              )?.value ?? 'side'
            : 'side';
      loaded.push({
        id: `draft_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        name: file.name,
        angle: forcedAngle ?? fallbackAngle,
        dataUrl,
        mimeType: file.type,
      });
    }
    setPhotos((prev) => [...prev, ...loaded]);
  };

  const handleUsePreset = (preset: (typeof SAMPLE_PRESETS)[number]) => {
    setPhotos([
      {
        id: `preset_${Date.now()}`,
        name: `${preset.bagType}_reference.jpg`,
        angle: 'front',
        dataUrl: preset.imageUrl,
        mimeType: 'image/jpeg',
      },
    ]);
    setUserBrief(preset.brief);
    setProjectName(preset.title);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting || activeJob) return;
    setIsSubmitting(true);
    try {
      await onStartAiDesign({
        name: projectName.trim() || '新建 AI 皮具设计',
        images: photos,
        userBrief,
        captureGuidance: {
          mode: captureMode,
          referenceObjectType,
          referenceObjectMm: referenceObjectType === 'none' ? undefined : referenceObjectMm,
          qualityInspection: photos.length > 0 ? batchAudit : undefined,
        },
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const busy = isSubmitting || Boolean(activeJob && activeJob.status !== 'completed' && activeJob.status !== 'failed');

  return (
    <div className="min-h-screen bg-[#F6F5F1] text-[#141413]">
      {/* Top Bar Contract: 3 zones */}
      <header className="h-14 border-b border-[#E4E2DC] bg-[#FFFFFF] px-6 flex items-center justify-between gap-8">
        <span className="font-display text-lg font-bold tracking-tight text-[#141413] whitespace-nowrap shrink-0">
          RUDA Leather Studio
        </span>
        <nav className="hidden md:flex items-center gap-6 text-sm text-[#5C5B57]">
          <span className="text-[#141413] font-medium whitespace-nowrap shrink-0">工作台首页</span>
          <a href="#recent-projects" className="hover:text-[#141413] transition-colors whitespace-nowrap shrink-0">
            已有项目 ({projects.length})
          </a>
          {onOpenIntelligence && (
            <button
              type="button"
              onClick={onOpenIntelligence}
              className="hover:text-[#9A4D22] transition-colors whitespace-nowrap shrink-0"
            >
              知识与记忆
            </button>
          )}
        </nav>
        <div className="shrink-0">
          <button
            type="button"
            onClick={() => onCreateBlankProject('tote')}
            disabled={busy}
            className="px-4 py-2 text-xs font-medium text-[#141413] bg-[#F6F5F1] border border-[#D8D5CD] rounded-md hover:bg-[#ECEAE3] transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            新建空白纸格
          </button>
        </div>
      </header>

      <main className="max-w-[1360px] mx-auto px-6 py-10 grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
        {/* Left: Primary AI Entry (Upload Photo + Natural Language Brief + Start) */}
        <section className="lg:col-span-7 bg-[#FFFFFF] border border-[#E4E2DC] rounded-lg p-7">
          <div className="mb-6">
            <h1 className="font-display text-2xl font-semibold tracking-tight text-[#141413] text-balance">
              上传包包照片，直接用普通话生成可生产的二维纸格
            </h1>
            <p className="mt-2 text-sm text-[#5C5B57] leading-relaxed">
              无需学习 CAD 节点或缝份计算。上传至少 1 张参考照片并描述尺寸或用途，系统将自动完成结构拆解、部件联动打版、质量检查与 DXF / PDF 导出。
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Capture Mode Switcher: Quick AI vs Precision Pattern */}
            <div className="bg-[#FAF9F6] border border-[#E4E2DC] rounded-md p-3.5 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-semibold text-[#141413]">
                    采集与打版精度模式
                  </div>
                  <div className="text-[11px] text-[#5C5B57] mt-0.5">
                    {captureMode === 'quick_ai'
                      ? '普通 AI 模式：单图即可快速概念拆解，输出「AI 设计版」（不可直接量产）。'
                      : '精准打版模式：引导拍摄 7 个完整视角 + 参考物标定，估算误差收敛至 ±0.8mm~±1.5mm。'}
                  </div>
                </div>
                <div className="inline-flex bg-[#ECEAE3] p-0.5 rounded shrink-0">
                  <button
                    type="button"
                    onClick={() => setCaptureMode('quick_ai')}
                    className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 ${
                      captureMode === 'quick_ai'
                        ? 'bg-white text-[#141413] shadow-xs'
                        : 'text-[#5C5B57] hover:text-[#141413]'
                    }`}
                  >
                    普通 AI 模式
                  </button>
                  <button
                    type="button"
                    onClick={() => setCaptureMode('precision_pattern')}
                    className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 ${
                      captureMode === 'precision_pattern'
                        ? 'bg-[#9A4D22] text-white shadow-xs'
                        : 'text-[#5C5B57] hover:text-[#141413]'
                    }`}
                  >
                    精准采集模式 (流程引导 + 质检)
                  </button>
                </div>
              </div>

              {captureMode === 'precision_pattern' && (
                <PrecisionCapturePanel
                  photos={photos}
                  perPhotoChecks={perPhotoChecks}
                  batchAudit={batchAudit}
                  analyzingQuality={analyzingQuality}
                  referenceObjectType={referenceObjectType}
                  referenceObjectMm={referenceObjectMm}
                  onChangeReferenceObject={(type, mm) => {
                    setReferenceObjectType(type);
                    setReferenceObjectMm(mm);
                  }}
                  onUploadForAngle={(ang) => {
                    setTargetUploadAngle(ang);
                    angleInputRef.current?.click();
                  }}
                  onReanalyzeQuality={() => void runQualityCheck(photos, true)}
                />
              )}
            </div>

            {/* 1. Photo Upload Zone */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-[#141413]">
                  1. 上传产品参考照片（JPG / PNG / WEBP，单张即可开始）
                </label>
                {photos.length > 0 && (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="text-xs font-medium text-[#9A4D22] hover:underline whitespace-nowrap shrink-0"
                  >
                    + 追加多角度照片
                  </button>
                )}
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                className="hidden"
                onChange={(e) => handleFiles(e.target.files)}
              />
              <input
                ref={angleInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => {
                  handleFiles(e.target.files, targetUploadAngle);
                  e.target.value = '';
                }}
              />

              {photos.length === 0 ? (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    handleFiles(e.dataTransfer.files);
                  }}
                  className="border border-dashed border-[#C9C5BC] bg-[#FAF9F6] hover:bg-[#F3F1EB] rounded-lg p-8 text-center cursor-pointer transition-colors"
                >
                  <Upload className="w-6 h-6 mx-auto text-[#78756E] mb-2" />
                  <p className="text-sm font-medium text-[#141413]">
                    点击或拖拽上传包包正面 / 侧面 / 内部照片
                  </p>
                  <p className="text-xs text-[#78756E] mt-1">
                    仅上传 1 张正面照片即可开始拆解，也可补充多角度照片提高隐藏结构准确度
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {photos.map((photo) => {
                    const check = perPhotoChecks[photo.id];
                    return (
                      <div
                        key={photo.id}
                        className="border border-[#E4E2DC] rounded-md overflow-hidden bg-[#FAF9F6]"
                      >
                        <div className="relative aspect-[4/3] bg-[#ECEAE3]">
                          <img
                            src={photo.dataUrl}
                            alt={photo.name}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              setPhotos((prev) => prev.filter((p) => p.id !== photo.id))
                            }
                            aria-label="移除照片"
                            className="absolute top-1.5 right-1.5 w-6 h-6 rounded bg-[#141413]/75 text-white flex items-center justify-center hover:bg-[#141413]"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <div className="p-2 space-y-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs text-[#5C5B57] truncate">{photo.name}</span>
                            <select
                              value={photo.angle}
                              onChange={(e) => {
                                const val = e.target.value as ImageAngle;
                                setPhotos((prev) =>
                                  prev.map((p) => (p.id === photo.id ? { ...p, angle: val } : p))
                                );
                              }}
                              className="text-xs bg-white border border-[#D8D5CD] rounded px-1.5 py-0.5 text-[#141413]"
                            >
                              {ANGLE_OPTIONS.map((opt) => (
                                <option key={opt.value} value={opt.value}>
                                  {opt.label}
                                </option>
                              ))}
                            </select>
                          </div>
                          {check && (
                            <div className="text-[10px] font-mono tabular-nums flex items-center justify-between gap-1 text-[#5C5B57]">
                              <span
                                className={
                                  check.lightingStatus === 'pass'
                                    ? 'text-[#166534]'
                                    : check.lightingStatus === 'warn'
                                      ? 'text-[#92400E]'
                                      : 'text-[#991B1B]'
                                }
                                title={check.lightingDetail}
                              >
                                光照 {check.lightingScore}
                              </span>
                              <span
                                className={
                                  check.distortionStatus === 'pass'
                                    ? 'text-[#166534]'
                                    : check.distortionStatus === 'warn'
                                      ? 'text-[#92400E]'
                                      : 'text-[#991B1B]'
                                }
                                title={check.distortionDetail}
                              >
                                畸变{check.distortionRisk === 'low' ? '低' : check.distortionRisk === 'medium' ? '中' : '高'} · {check.widthPx}×{check.heightPx}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="aspect-[4/3] border border-dashed border-[#C9C5BC] rounded-md flex flex-col items-center justify-center text-xs text-[#5C5B57] hover:bg-[#FAF9F6] transition-colors"
                  >
                    <ImagePlus className="w-5 h-5 mb-1 text-[#78756E]" />
                    添加角度照片
                  </button>
                </div>
              )}

              {/* Quick sample photos */}
              <div className="mt-4">
                <p className="text-xs text-[#78756E] mb-2">
                  或一键载入测试样包照片体验全流程：
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {SAMPLE_PRESETS.map((preset) => (
                    <button
                      key={preset.bagType}
                      type="button"
                      onClick={() => handleUsePreset(preset)}
                      className="text-left border border-[#E4E2DC] hover:border-[#9A4D22] rounded-md p-2 bg-[#FAF9F6] transition-colors flex items-center gap-2.5"
                    >
                      <img
                        src={preset.imageUrl}
                        alt={preset.title}
                        referrerPolicy="no-referrer"
                        className="w-12 h-10 object-cover rounded shrink-0 bg-[#ECEAE3]"
                      />
                      <div className="min-w-0">
                        <div className="text-xs font-medium text-[#141413] truncate">
                          {preset.title}
                        </div>
                        <div className="text-[11px] text-[#78756E] truncate">
                          {preset.subtitle}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* 2. Design Requirements */}
            <div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
                <div className="sm:col-span-3">
                  <label className="block text-sm font-medium text-[#141413] mb-1.5">
                    2. 输入设计要求与尺寸（支持普通自然语言）
                  </label>
                  <textarea
                    rows={3}
                    value={userBrief}
                    onChange={(e) => setUserBrief(e.target.value)}
                    placeholder="例如：帮我做出这个包，尺寸宽 30 厘米、高 24 厘米、侧面 12 厘米，加一个拉链内袋，帮我生成生产纸格。"
                    className="w-full px-3.5 py-2.5 text-sm bg-[#FAF9F6] border border-[#D8D5CD] rounded-md focus:outline-none focus:border-[#9A4D22] text-[#141413]"
                  />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="text"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  placeholder="项目名称（可选，如：春季通勤托特包）"
                  className="flex-1 px-3 py-2 text-sm bg-[#FAF9F6] border border-[#D8D5CD] rounded-md focus:outline-none focus:border-[#9A4D22]"
                />
                <button
                  type="submit"
                  disabled={busy || (photos.length === 0 && !userBrief.trim())}
                  className="px-6 py-2.5 text-sm font-medium text-white bg-[#9A4D22] hover:bg-[#823F1A] disabled:opacity-50 rounded-md transition-colors whitespace-nowrap shrink-0 flex items-center gap-2"
                >
                  {busy ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      AI 正在拆解打版...
                    </>
                  ) : (
                    <>
                      开始 AI 设计
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Active job progress */}
            {activeJob && activeJob.status !== 'completed' && (
              <div className="border border-[#E4E2DC] bg-[#FAF9F6] rounded-md p-4">
                <div className="flex items-center justify-between text-xs font-medium text-[#141413] mb-2">
                  <span>{activeJob.statusMessage}</span>
                  <span className="font-mono tabular-nums">{activeJob.progress}%</span>
                </div>
                <div className="w-full h-1.5 bg-[#E4E2DC] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#9A4D22] transition-all duration-300"
                    style={{ width: `${activeJob.progress}%` }}
                  />
                </div>
              </div>
            )}

            {errorMsg && (
              <div className="border border-[#DC2626]/30 bg-[#FEF2F2] text-[#991B1B] text-xs px-3.5 py-2.5 rounded-md">
                {errorMsg}
              </div>
            )}
          </form>

          {/* Direct 5-Category Master Pattern Library Quick-Create */}
          <div className="mt-7 pt-6 border-t border-[#ECEAE3] space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold text-[#141413]">
                  或从授权标准版型库直接起版（5 类包型 · {MASTER_PATTERN_LIBRARY.length} 套真实结构）
                </h2>
              </div>
              <div className="flex items-center gap-1 flex-wrap">
                {(
                  [
                    ['tote', '托特包'],
                    ['handbag', '手提包'],
                    ['shoulder_bag', '肩背包'],
                    ['wallet', '钱包'],
                    ['cardholder', '卡包'],
                  ] as const
                ).map(([type, label]) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setTplBagFilter(type)}
                    className={`px-2.5 py-1 text-xs rounded border whitespace-nowrap shrink-0 transition-colors ${
                      tplBagFilter === type
                        ? 'bg-[#141413] text-white border-[#141413]'
                        : 'bg-[#FAF9F6] text-[#5C5B57] border-[#D8D5CD] hover:text-[#141413]'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {MASTER_PATTERN_LIBRARY.filter((t) => t.bagType === tplBagFilter).map((tpl) => (
                <button
                  key={tpl.id}
                  type="button"
                  disabled={busy}
                  onClick={() => onCreateFromTemplate(tpl.id, tpl.name)}
                  className="text-left border border-[#E4E2DC] hover:border-[#9A4D22] bg-[#FAF9F6] rounded-md p-3 transition-colors space-y-1"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-[#141413] truncate">
                      {tpl.name}
                    </span>
                    <span className="text-[11px] font-mono text-[#9A4D22] shrink-0">
                      {tpl.pieceCount} 片
                    </span>
                  </div>
                  <div className="text-[11px] text-[#5C5B57] truncate">
                    {STRUCTURE_TYPE_LABELS[tpl.structureType] || tpl.structureType} ·{' '}
                    <span className="font-mono tabular-nums">
                      {tpl.defaultDimensions.widthMm}×{tpl.defaultDimensions.heightMm}×
                      {tpl.defaultDimensions.depthMm}mm
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Right: Existing Projects */}
        <section
          id="recent-projects"
          className="lg:col-span-5 bg-[#FFFFFF] border border-[#E4E2DC] rounded-lg p-6"
        >
          <div className="flex items-center justify-between pb-4 border-b border-[#ECEAE3]">
            <h2 className="font-display text-base font-semibold text-[#141413]">
              打开已有项目
            </h2>
            <span className="text-xs text-[#78756E] font-mono tabular-nums">
              {projects.length} 个项目
            </span>
          </div>

          {loadingProjects ? (
            <div className="py-12 text-center text-sm text-[#78756E]">
              正在加载设计项目...
            </div>
          ) : projects.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-sm text-[#5C5B57]">暂无已保存的皮具项目</p>
              <p className="text-xs text-[#78756E] mt-1">
                请在左侧上传参考照片开始 AI 自动打版，或点击右上角新建空白纸格。
              </p>
            </div>
          ) : (
            <div className="divide-y divide-[#ECEAE3]">
              {projects.map((proj) => (
                <div
                  key={proj.id}
                  className="py-4 flex items-center justify-between gap-4 group"
                >
                  <div
                    onClick={() => onOpenProject(proj.id)}
                    className="flex items-center gap-3.5 min-w-0 flex-1 cursor-pointer"
                  >
                    <div className="w-16 h-12 rounded border border-[#E4E2DC] bg-[#FAF9F6] overflow-hidden shrink-0 flex items-center justify-center">
                      {proj.thumbnailUrl ? (
                        <img
                          src={proj.thumbnailUrl}
                          alt={proj.name}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <FolderOpen className="w-4 h-4 text-[#78756E]" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-[#141413] group-hover:text-[#9A4D22] truncate transition-colors">
                        {proj.name}
                      </div>
                      <div className="mt-1 flex items-center gap-1.5 text-xs text-[#78756E] font-mono tabular-nums truncate">
                        <span>{BAG_TYPE_LABELS[proj.bagType]?.split(' ')[0]}</span>
                        <span aria-hidden="true">·</span>
                        <span>
                          {proj.dimensions.widthMm}×{proj.dimensions.heightMm}×
                          {proj.dimensions.depthMm}mm
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>{proj.patternCount} 片纸格</span>
                        <span aria-hidden="true">·</span>
                        <span>v{proj.currentVersion}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => onOpenProject(proj.id)}
                      className="px-3 py-1.5 text-xs font-medium text-[#141413] bg-[#F6F5F1] hover:bg-[#ECEAE3] rounded border border-[#D8D5CD] whitespace-nowrap shrink-0"
                    >
                      打开
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteProject(proj.id)}
                      aria-label={`删除 ${proj.name}`}
                      className="p-1.5 text-[#78756E] hover:text-[#DC2626] transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {userEmail && onSignOut && (
            <div className="mt-6 pt-4 border-t border-[#ECEAE3] flex items-center justify-between text-xs text-[#78756E]">
              <span className="truncate">当前账号：{userEmail}</span>
              <button
                type="button"
                onClick={() => void onSignOut()}
                className="text-[#5C5B57] hover:text-[#141413] hover:underline whitespace-nowrap shrink-0 ml-3"
              >
                退出登录
              </button>
            </div>
          )}
        </section>
      </main>
    </div>
  );
};
