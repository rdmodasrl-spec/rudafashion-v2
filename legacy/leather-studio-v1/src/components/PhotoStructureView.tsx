import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Camera, ChevronDown, ChevronUp, Eye, EyeOff, ImagePlus } from 'lucide-react';
import { buildQualityAssessmentReport, buildSeamPairDetails } from '../shared/cadEngine';
import {
  analyzeSinglePhotoQuality,
  evaluateMultiAngleBatch,
} from '../shared/imageQualityAnalyzer';
import { BAG_TYPE_LABELS, STRUCTURE_TYPE_LABELS } from '../shared/leatherKnowledge';
import type {
  CaptureGuidanceProfile,
  ImageAngle,
  PhotoQualityCheckItem,
  Project,
} from '../shared/types';
import { PrecisionCapturePanel } from './PrecisionCapturePanel';

interface PhotoStructureViewProps {
  project: Project;
  onSelectPiece: (pieceId: string) => void;
  onAddPhotos: (
    images: Array<{ name: string; angle: ImageAngle; dataUrl: string; mimeType: string }>,
    captureGuidance?: Partial<CaptureGuidanceProfile>
  ) => Promise<void>;
}

const ANGLE_LABEL: Record<ImageAngle, string> = {
  front: '正面',
  back: '背面',
  left: '左侧',
  right: '右侧',
  side: '侧面',
  bottom: '底部',
  top: '顶部',
  interior: '内部',
  detail: '细节',
};

const PHASE_LABEL: Record<string, string> = {
  task1_vision: '任务1·图像识别',
  task2_reasoning: '任务2·结构推理',
  task3_pattern_cad: '任务3·2D纸格生成',
};

const CURVE_CORR_LABEL: Record<string, string> = {
  straight_to_straight: '直边对直边',
  arc_to_arc: '同弧度对位',
  curve_to_straight_ease: '弧配直吃势对位',
};

const STITCH_DIR_LABEL: Record<string, string> = {
  face_to_face: '面对面正缝',
  lap: '搭接压缝',
  edge_to_edge: '对口平缝',
};

export const PhotoStructureView: React.FC<PhotoStructureViewProps> = ({
  project,
  onSelectPiece,
  onAddPhotos,
}) => {
  const [activeImgIdx, setActiveImgIdx] = useState(0);
  const [showOverlays, setShowOverlays] = useState(true);
  const [hoveredCompId, setHoveredCompId] = useState<string | null>(null);
  const [showPipelineSteps, setShowPipelineSteps] = useState(false);
  const [showPrecisionGuide, setShowPrecisionGuide] = useState(false);
  const [guidedUploadAngle, setGuidedUploadAngle] = useState<ImageAngle>('left');
  const [perPhotoChecks, setPerPhotoChecks] = useState<Record<string, PhotoQualityCheckItem>>({});
  const [analyzingQuality, setAnalyzingQuality] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const guidedFileRef = useRef<HTMLInputElement | null>(null);

  const vs = project.visionSummary;
  const steps = vs?.reconstructionSteps ?? [];
  const captureGuidance = project.captureGuidance || vs?.captureGuidance;
  const qualityReport = useMemo(() => buildQualityAssessmentReport(project), [project]);

  const [refType, setRefType] = useState<NonNullable<CaptureGuidanceProfile['referenceObjectType']>>(
    captureGuidance?.referenceObjectType ?? 'none'
  );
  const [refMm, setRefMm] = useState<number>(captureGuidance?.referenceObjectMm ?? 85.6);

  useEffect(() => {
    if (captureGuidance?.referenceObjectType) {
      setRefType(captureGuidance.referenceObjectType);
    }
    if (captureGuidance?.referenceObjectMm) {
      setRefMm(captureGuidance.referenceObjectMm);
    }
  }, [captureGuidance?.referenceObjectType, captureGuidance?.referenceObjectMm]);

  const runBatchInspection = useCallback(
    async (forceAll = false) => {
      if (project.images.length === 0) return;
      setAnalyzingQuality(true);
      try {
        const next: Record<string, PhotoQualityCheckItem> = {};
        for (const img of project.images) {
          const existing = !forceAll ? perPhotoChecks[img.id] : undefined;
          if (existing && existing.angle === img.angle) {
            next[img.id] = existing;
          } else {
            next[img.id] = await analyzeSinglePhotoQuality(img);
          }
        }
        setPerPhotoChecks(next);
      } finally {
        setAnalyzingQuality(false);
      }
    },
    [project.images, perPhotoChecks]
  );

  useEffect(() => {
    if (!showPrecisionGuide || project.images.length === 0) return;
    const missing = project.images.some(
      (img) => !perPhotoChecks[img.id] || perPhotoChecks[img.id].angle !== img.angle
    );
    if (missing) {
      void runBatchInspection(false);
    }
  }, [showPrecisionGuide, project.images, perPhotoChecks, runBatchInspection]);

  const orderedChecks = useMemo(
    () =>
      project.images
        .map((img) => perPhotoChecks[img.id])
        .filter((x): x is PhotoQualityCheckItem => Boolean(x)),
    [project.images, perPhotoChecks]
  );

  const batchAudit = useMemo(
    () => evaluateMultiAngleBatch(orderedChecks, refType),
    [orderedChecks, refType]
  );

  const activeImage = project.images[activeImgIdx] || project.images[0];
  const visibleWithBox = project.components.filter(
    (c) => !c.isInferredHidden && c.boundingBox2D && c.boundingBox2D.length === 4
  );
  const inferredHidden = project.components.filter((c) => c.isInferredHidden);

  const seamPairs = useMemo(
    () =>
      project.seamPairDetails && project.seamPairDetails.length > 0
        ? project.seamPairDetails
        : buildSeamPairDetails(project.patterns, project.relations),
    [project.seamPairDetails, project.patterns, project.relations]
  );

  const handleFileChange = async (files: FileList | null, forcedAngle?: ImageAngle) => {
    if (!files || files.length === 0) return;
    const prevCount = project.images.length;
    const targetAngle = forcedAngle ?? guidedUploadAngle;
    const loaded: Array<{
      name: string;
      angle: ImageAngle;
      dataUrl: string;
      mimeType: string;
    }> = [];
    for (const f of Array.from(files)) {
      const dataUrl = await new Promise<string>((resolve) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result || ''));
        r.readAsDataURL(f);
      });
      loaded.push({
        name: f.name,
        angle: targetAngle,
        dataUrl,
        mimeType: f.type || 'image/jpeg',
      });
    }

    // Run real Canvas quality inspection across existing + newly added photos
    setAnalyzingQuality(true);
    try {
      const existingChecks: PhotoQualityCheckItem[] = [];
      const nextMap: Record<string, PhotoQualityCheckItem> = { ...perPhotoChecks };
      for (const img of project.images) {
        const chk = nextMap[img.id] ?? (await analyzeSinglePhotoQuality(img));
        nextMap[img.id] = chk;
        existingChecks.push(chk);
      }
      const newChecks: PhotoQualityCheckItem[] = [];
      for (let i = 0; i < loaded.length; i++) {
        const item = loaded[i];
        const chk = await analyzeSinglePhotoQuality({
          id: `pending_${Date.now()}_${i}`,
          name: item.name,
          angle: item.angle,
          dataUrl: item.dataUrl,
        });
        newChecks.push(chk);
      }
      setPerPhotoChecks(nextMap);
      const nextAudit = evaluateMultiAngleBatch([...existingChecks, ...newChecks], refType);
      await onAddPhotos(loaded, {
        mode: 'precision_pattern',
        referenceObjectType: refType,
        referenceObjectMm: refType === 'none' ? undefined : refMm,
        qualityInspection: nextAudit,
      });
      setActiveImgIdx(prevCount);
    } finally {
      setAnalyzingQuality(false);
    }
  };

  return (
    <div className="flex-1 bg-[#F6F5F1] overflow-y-auto p-6 min-h-0">
      <div className="max-w-[1160px] mx-auto space-y-6">
        {/* Top Banner: Strict Separation of 3 Engineering Tasks + Perspective / Multi-view Readout */}
        <div className="bg-[#FFFFFF] border border-[#E4E2DC] rounded-lg p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-display text-sm font-semibold text-[#141413]">
                  AI 反向工程三阶段解耦架构（禁止将图像分割直接当作生产纸格）
                </h2>
                <span
                  className={`px-2 py-0.5 text-[11px] font-medium rounded border ${
                    qualityReport.deliveryEdition === 'production_standard_edition'
                      ? 'bg-[#F0FDF4] border-[#16A34A]/30 text-[#166534]'
                      : 'bg-[#FFFBEB] border-[#F59E0B]/30 text-[#92400E]'
                  }`}
                >
                  {qualityReport.deliveryEdition === 'production_standard_edition'
                    ? '标准生产版'
                    : 'AI 设计版（概念参考）'}
                </span>
              </div>
              <p className="text-xs text-[#5C5B57] mt-0.5">
                包型：{BAG_TYPE_LABELS[project.bagType]}
                {project.structureType
                  ? ` · 结构分类：${STRUCTURE_TYPE_LABELS[project.structureType] || project.structureType}`
                  : ''}
                {vs?.matchedTemplateName
                  ? ` · 匹配模板：${vs.matchedTemplateName} (${Math.round((vs.templateMatchScore ?? 0.85) * 100)}%)`
                  : ''}
              </p>
            </div>
            {steps.length > 0 && (
              <button
                type="button"
                onClick={() => setShowPipelineSteps((v) => !v)}
                className="px-3 py-1.5 text-xs font-medium border border-[#D8D5CD] rounded bg-[#FAF9F6] hover:bg-[#ECEAE3] text-[#141413] flex items-center gap-1 whitespace-nowrap shrink-0"
              >
                {showPipelineSteps ? '收起' : '查看'} 14 步反向工程轨迹 ({steps.length})
                {showPipelineSteps ? (
                  <ChevronUp className="w-3.5 h-3.5" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5" />
                )}
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <div className="bg-[#FAF9F6] border border-[#ECEAE3] rounded p-3 space-y-1">
              <div className="font-semibold text-[#141413]">任务 1 · 图像识别 (Vision)</div>
              <div className="text-[#5C5B57]">
                识别 {visibleWithBox.length} 个可见外观部件及缝线轮廓；
                {vs?.detectedSeamsAndBoundaries?.length
                  ? ` 检测到接缝：${vs.detectedSeamsAndBoundaries.slice(0, 2).join('、')}`
                  : ' 标注透视边界与五金位'}
              </div>
            </div>
            <div className="bg-[#FAF9F6] border border-[#ECEAE3] rounded p-3 space-y-1">
              <div className="font-semibold text-[#141413]">任务 2 · 皮具结构推理 (Reasoning)</div>
              <div className="text-[#5C5B57]">
                拆解 {project.components.length} 个独立皮料/衬料部件（含 {inferredHidden.length} 个隐藏内结构），建立 {seamPairs.length} 组 Seam Pair 装配关系。
              </div>
            </div>
            <div className="bg-[#FAF9F6] border border-[#ECEAE3] rounded p-3 space-y-1">
              <div className="font-semibold text-[#141413]">任务 3 · 标准 2D 纸格生成 (CAD)</div>
              <div className="text-[#5C5B57]">
                参数化重建 {project.patterns.length} 片三层几何纸格（净版线 + 工艺缝份刀口 + 纹向裁剪版），禁止直接转描像素框。
              </div>
            </div>
          </div>

          {/* V1.2 Precision Capture Guidance & Competing Structures */}
          {(captureGuidance || (vs?.competingStructuresConsidered && vs.competingStructuresConsidered.length > 0)) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              {captureGuidance && (
                <div className="bg-[#FAF9F6] border border-[#E4E2DC] rounded p-3 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2 font-semibold text-[#141413]">
                    <span>
                      采集校准模式：
                      {captureGuidance.mode === 'precision_pattern'
                        ? '精准打版模式'
                        : '普通 AI 模式'}
                    </span>
                    <span className="font-mono tabular-nums text-[#9A4D22]">
                      预估测量误差 ±{captureGuidance.estimatedMeasurementErrorMm}mm
                    </span>
                  </div>
                  <div className="text-[#5C5B57] font-mono tabular-nums">
                    已覆盖视角 ({captureGuidance.coveredAngles.length})：
                    {captureGuidance.coveredAngles.map((a) => ANGLE_LABEL[a] || a).join('、') || '无'}
                    {captureGuidance.missingRecommendedAngles.length > 0 && (
                      <span className="text-[#D97706]">
                        {' '}· 建议补充：
                        {captureGuidance.missingRecommendedAngles
                          .map((a) => ANGLE_LABEL[a] || a)
                          .join('、')}
                      </span>
                    )}
                  </div>
                  {captureGuidance.qualityInspection && (
                    <div className="grid grid-cols-3 gap-2 pt-1 text-[11px] font-mono tabular-nums">
                      <div className="bg-white border border-[#E4E2DC] rounded px-2 py-1">
                        <span className="text-[#78756E]">光照 </span>
                        <span className="font-semibold text-[#141413]">
                          {captureGuidance.qualityInspection.lightingScore}/100
                        </span>
                      </div>
                      <div className="bg-white border border-[#E4E2DC] rounded px-2 py-1">
                        <span className="text-[#78756E]">畸变 </span>
                        <span className="font-semibold text-[#141413]">
                          {captureGuidance.qualityInspection.distortionScore}/100
                        </span>
                      </div>
                      <div className="bg-white border border-[#E4E2DC] rounded px-2 py-1">
                        <span className="text-[#78756E]">匹配 </span>
                        <span
                          className={`font-semibold ${
                            captureGuidance.qualityInspection.meetsStandardPatternRequirements
                              ? 'text-[#166534]'
                              : 'text-[#92400E]'
                          }`}
                        >
                          {captureGuidance.qualityInspection.multiAngleMatchPct}%
                        </span>
                      </div>
                    </div>
                  )}
                  <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#5C5B57] leading-relaxed">
                    <span>{captureGuidance.lensDistortionNote}</span>
                    <button
                      type="button"
                      onClick={() => setShowPrecisionGuide((v) => !v)}
                      className="text-[#9A4D22] hover:underline font-medium shrink-0"
                    >
                      {showPrecisionGuide ? '收起精准补采引导' : '展开精准补采与质检 →'}
                    </button>
                  </div>
                </div>
              )}

              {vs?.competingStructuresConsidered && vs.competingStructuresConsidered.length > 0 && (
                <div className="bg-[#FAF9F6] border border-[#E4E2DC] rounded p-3 space-y-1.5">
                  <div className="font-semibold text-[#141413]">
                    同外观备选构造对比与排除依据（结构反向推理）
                  </div>
                  <div className="space-y-1 text-[11px]">
                    {vs.competingStructuresConsidered.map((comp) => (
                      <div key={comp.structureType} className="text-[#5C5B57]">
                        <span className="font-medium text-[#141413]">
                          排除「{STRUCTURE_TYPE_LABELS[comp.structureType] || comp.structureType}」：
                        </span>
                        {comp.reasonRejected}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {vs?.perspectiveAssessment && (
            <div
              className={`rounded p-3 text-xs border ${
                vs.perspectiveAssessment.isSinglePhotoMode
                  ? 'bg-[#FFFBEB] border-[#F59E0B]/30 text-[#92400E]'
                  : 'bg-[#F0FDF4] border-[#16A34A]/30 text-[#166534]'
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2 font-semibold">
                <span>
                  {vs.perspectiveAssessment.isSinglePhotoMode
                    ? `单张照片模式（透视风险：${vs.perspectiveAssessment.perspectiveRisk.toUpperCase()}）`
                    : `多角度一致性检验（${vs.perspectiveAssessment.photoCount} 张照片）`}
                </span>
                <span className="font-mono tabular-nums">
                  尺寸来源：{project.dimensions.dimensionSource}
                </span>
              </div>
              <p className="mt-1 leading-relaxed">{vs.perspectiveAssessment.perspectiveNote}</p>
              <p className="mt-0.5 leading-relaxed opacity-90">
                {vs.perspectiveAssessment.multiViewConsistencyNote}
              </p>
            </div>
          )}

          {showPipelineSteps && steps.length > 0 && (
            <div className="border-t border-[#ECEAE3] pt-3 space-y-2">
              <div className="text-xs font-semibold text-[#141413]">
                14 步固定照片反向工程流程执行明细
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {steps.map((st) => (
                  <div
                    key={st.stepKey}
                    className="border border-[#ECEAE3] bg-[#FAF9F6] rounded p-2.5 text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-[#141413]">
                        <span className="font-mono text-[#9A4D22] mr-1">
                          {String(st.stepNumber).padStart(2, '0')}
                        </span>
                        {st.title}
                      </span>
                      <span className="text-[11px] font-mono tabular-nums text-[#78756E] shrink-0">
                        {PHASE_LABEL[st.phase] || st.phase} · {Math.round(st.confidence * 100)}%
                      </span>
                    </div>
                    <div className="text-[11px] text-[#5C5B57]">{st.outputSummary}</div>
                    {st.warnings && st.warnings.length > 0 && (
                      <div className="text-[11px] text-[#D97706]">
                        风险提示：{st.warnings.join('；')}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
          {/* Left: Uploaded Reference Photo + AI Segmentation / Bounding Boxes */}
          <div className="xl:col-span-5 bg-[#FFFFFF] border border-[#E4E2DC] rounded-lg p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-display text-sm font-semibold text-[#141413]">
                参考照片与可见部件定位
              </h3>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowOverlays((v) => !v)}
                  className="px-2.5 py-1 text-xs border border-[#D8D5CD] rounded bg-[#FAF9F6] text-[#141413] flex items-center gap-1 whitespace-nowrap shrink-0"
                >
                  {showOverlays ? (
                    <>
                      <EyeOff className="w-3.5 h-3.5" />
                      隐藏识别框
                    </>
                  ) : (
                    <>
                      <Eye className="w-3.5 h-3.5" />
                      显示识别框
                    </>
                  )}
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    const nextDefault =
                      captureGuidance?.missingRecommendedAngles?.[0] ?? 'side';
                    void handleFileChange(e.target.files, nextDefault);
                    e.target.value = '';
                  }}
                />
                <input
                  ref={guidedFileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    void handleFileChange(e.target.files, guidedUploadAngle);
                    e.target.value = '';
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPrecisionGuide((v) => !v)}
                  className={`px-2.5 py-1 text-xs border rounded flex items-center gap-1 whitespace-nowrap shrink-0 ${
                    showPrecisionGuide
                      ? 'border-[#9A4D22] bg-[#FAF6F2] text-[#9A4D22] font-medium'
                      : 'border-[#D8D5CD] bg-white hover:bg-[#FAF9F6] text-[#141413]'
                  }`}
                >
                  <Camera className="w-3.5 h-3.5" />
                  {showPrecisionGuide ? '收起采集引导' : '精准补采引导'}
                </button>
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="px-2.5 py-1 text-xs border border-[#D8D5CD] rounded bg-white hover:bg-[#FAF9F6] text-[#9A4D22] flex items-center gap-1 whitespace-nowrap shrink-0"
                >
                  <ImagePlus className="w-3.5 h-3.5" />
                  快速补图
                </button>
              </div>
            </div>

            {showPrecisionGuide && (
              <div className="bg-[#FAF9F6] border border-[#E4E2DC] rounded-md p-3.5">
                <PrecisionCapturePanel
                  photos={project.images}
                  perPhotoChecks={perPhotoChecks}
                  batchAudit={batchAudit}
                  analyzingQuality={analyzingQuality}
                  referenceObjectType={refType}
                  referenceObjectMm={refMm}
                  onChangeReferenceObject={(t, mm) => {
                    setRefType(t);
                    setRefMm(mm);
                  }}
                  onUploadForAngle={(angle) => {
                    setGuidedUploadAngle(angle);
                    guidedFileRef.current?.click();
                  }}
                  onReanalyzeQuality={() => void runBatchInspection(true)}
                />
              </div>
            )}

            {activeImage ? (
              <div className="relative w-full aspect-[4/3] bg-[#ECEAE3] rounded border border-[#E4E2DC] overflow-hidden">
                <img
                  src={activeImage.dataUrl}
                  alt={activeImage.name}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-contain"
                />
                {showOverlays &&
                  visibleWithBox.map((comp) => {
                    const [ymin, xmin, ymax, xmax] = comp.boundingBox2D!;
                    const isHov = hoveredCompId === comp.id;
                    return (
                      <div
                        key={comp.id}
                        onMouseEnter={() => setHoveredCompId(comp.id)}
                        onMouseLeave={() => setHoveredCompId(null)}
                        onClick={() => {
                          const match = project.patterns.find(
                            (p) => p.componentId === comp.id
                          );
                          if (match) onSelectPiece(match.id);
                        }}
                        style={{
                          top: `${ymin / 10}%`,
                          left: `${xmin / 10}%`,
                          width: `${Math.max(4, (xmax - xmin) / 10)}%`,
                          height: `${Math.max(4, (ymax - ymin) / 10)}%`,
                        }}
                        className={`absolute border transition-colors cursor-pointer ${
                          isHov
                            ? 'border-[#9A4D22] bg-[#9A4D22]/15 z-10'
                            : 'border-[#16A34A]/80 bg-[#16A34A]/5'
                        }`}
                      >
                        <span className="inline-block px-1.5 py-0.5 text-[10px] font-mono bg-[#141413]/80 text-white whitespace-nowrap">
                          {comp.partCode} {comp.name} ({Math.round(comp.confidence * 100)}%)
                        </span>
                      </div>
                    );
                  })}
              </div>
            ) : (
              <div className="aspect-[4/3] border border-dashed border-[#C9C5BC] rounded flex flex-col items-center justify-center text-xs text-[#78756E]">
                尚未上传参考照片（当前为纯参数/模板模式）
              </div>
            )}

            {project.images.length > 1 && (
              <div className="flex items-center gap-2 overflow-x-auto">
                {project.images.map((img, idx) => (
                  <button
                    key={img.id}
                    type="button"
                    onClick={() => setActiveImgIdx(idx)}
                    className={`flex items-center gap-1.5 p-1 rounded border text-xs whitespace-nowrap shrink-0 ${
                      idx === activeImgIdx
                        ? 'border-[#9A4D22] bg-[#FAF6F2]'
                        : 'border-[#E4E2DC] bg-white'
                    }`}
                  >
                    <img
                      src={img.dataUrl}
                      alt={img.name}
                      referrerPolicy="no-referrer"
                      className="w-8 h-8 object-cover rounded"
                    />
                    <span>{ANGLE_LABEL[img.angle] || img.angle}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Vision Analysis Notes & Case Comparison */}
            {vs && (
              <div className="pt-3 border-t border-[#ECEAE3] space-y-2.5 text-xs">
                <div>
                  <span className="font-semibold text-[#141413]">结构推理摘要：</span>
                  <span className="text-[#5C5B57]">{vs.visualNotes}</span>
                </div>

                {vs.similarCaseComparisons && vs.similarCaseComparisons.length > 0 && (
                  <div className="bg-[#FAF9F6] border border-[#ECEAE3] rounded p-2.5 space-y-1">
                    <div className="font-semibold text-[#141413]">
                      已验证样板对照评估（历史案例复用）：
                    </div>
                    {vs.similarCaseComparisons.map((cs) => (
                      <div key={cs.caseId} className="text-[11px] text-[#5C5B57]">
                        <span className="font-medium text-[#141413]">{cs.title}</span> · 相似度{' '}
                        <span className="font-mono tabular-nums text-[#9A4D22]">
                          {cs.similarityPct}%
                        </span>{' '}
                        · {cs.dimensionDeltaSummary}
                        {cs.productionVerified ? ' · 已实产验证' : ''}
                      </div>
                    ))}
                  </div>
                )}

                {vs.uncertainStructures.length > 0 && (
                  <div className="bg-[#FFFBEB] border border-[#F59E0B]/30 rounded p-2.5 text-[#92400E]">
                    <div className="font-semibold mb-1">
                      不可见 / 需人工确认的结构（未伪造确定性）：
                    </div>
                    <ul className="list-disc pl-4 space-y-0.5">
                      {vs.uncertainStructures.map((u, idx) => (
                        <li key={idx}>{u}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right: Structure Relation Engine (Piece -> Edge -> Seam Pair -> Assembly Relation) */}
          <div className="xl:col-span-7 space-y-6">
            <div className="bg-[#FFFFFF] border border-[#E4E2DC] rounded-lg p-5 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h3 className="font-display text-sm font-semibold text-[#141413]">
                    结构关系引擎 · Piece → Edge → Seam Pair ({seamPairs.length} 组)
                  </h3>
                  <p className="text-[11px] text-[#78756E] mt-0.5">
                    精确追踪接缝边 ID、对位刀口、缝合方向、曲线对应与转角吃势工艺余量
                  </p>
                </div>
                <span className="text-xs text-[#78756E] font-mono tabular-nums shrink-0">
                  {project.components.length} 个部件
                </span>
              </div>

              <div className="border border-[#ECEAE3] rounded overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#FAF9F6] text-[#5C5B57] border-b border-[#ECEAE3]">
                    <tr>
                      <th className="py-2 px-2.5 font-medium whitespace-nowrap">配对ID</th>
                      <th className="py-2 px-2.5 font-medium">部件 A · 边</th>
                      <th className="py-2 px-2.5 font-medium">部件 B · 边</th>
                      <th className="py-2 px-2.5 font-medium">工艺与曲线对应</th>
                      <th className="py-2 px-2.5 font-medium text-right whitespace-nowrap">刀口</th>
                      <th className="py-2 px-2.5 font-medium text-right whitespace-nowrap">边长差</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#ECEAE3]">
                    {seamPairs.map((sp) => (
                      <tr key={sp.seamPairId} className="hover:bg-[#FAF9F6]">
                        <td className="py-2 px-2.5 font-mono text-[#9A4D22] whitespace-nowrap">
                          {sp.seamPairId}
                        </td>
                        <td className="py-2 px-2.5">
                          <div className="font-mono text-[#141413]">
                            {sp.fromPieceCode}[{sp.fromEdgeId}]
                          </div>
                          <div className="text-[11px] text-[#78756E] font-mono tabular-nums">
                            {sp.fromLengthMm}mm
                          </div>
                        </td>
                        <td className="py-2 px-2.5">
                          <div className="font-mono text-[#141413]">
                            {sp.toPieceCode}[{sp.toEdgeId}]
                          </div>
                          <div className="text-[11px] text-[#78756E] font-mono tabular-nums">
                            {sp.toLengthMm}mm
                          </div>
                        </td>
                        <td className="py-2 px-2.5 text-[11px] text-[#5C5B57]">
                          <div>
                            {STITCH_DIR_LABEL[sp.stitchDirection] || sp.stitchDirection} ·{' '}
                            {CURVE_CORR_LABEL[sp.curveCorrespondence] || sp.curveCorrespondence}
                          </div>
                          <div className="text-[#78756E]">{sp.cornerTreatment}</div>
                        </td>
                        <td className="py-2 px-2.5 text-right font-mono tabular-nums text-[#5C5B57] whitespace-nowrap">
                          {sp.notchCountFrom}/{sp.notchCountTo}
                        </td>
                        <td className="py-2 px-2.5 text-right font-mono tabular-nums whitespace-nowrap">
                          {sp.withinTolerance ? (
                            <span className="text-[#16A34A]">
                              {sp.diffMm === 0 ? '0.0 mm' : `${sp.diffMm > 0 ? `+${sp.diffMm}` : sp.diffMm} mm`}
                            </span>
                          ) : (
                            <span className="text-[#DC2626]">
                              {sp.diffMm > 0 ? `+${sp.diffMm}` : sp.diffMm} mm
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Inferred Hidden Components */}
            <div className="bg-[#FFFFFF] border border-[#E4E2DC] rounded-lg p-5 space-y-3">
              <h3 className="font-display text-sm font-semibold text-[#141413]">
                隐藏与推断部件标记 ({inferredHidden.length})
              </h3>
              <p className="text-xs text-[#5C5B57]">
                以下部件无法从外部照片直接观测，由皮具结构知识库依据包型推断生成，请在打版与打样前确认：
              </p>
              <div className="divide-y divide-[#ECEAE3]">
                {inferredHidden.map((comp) => (
                  <div key={comp.id} className="py-2.5 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-mono font-medium text-[#141413]">
                        {comp.partCode}
                      </span>{' '}
                      <span className="font-medium text-[#141413]">{comp.name}</span>
                      <span className="text-[#78756E]"> · {comp.role}</span>
                    </div>
                    <span className="font-mono tabular-nums text-[#D97706] shrink-0">
                      推断置信度 {Math.round(comp.confidence * 100)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
