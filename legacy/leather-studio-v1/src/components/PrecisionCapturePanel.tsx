import React, { useState } from 'react';
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  RefreshCw,
  Ruler,
  ScanEye,
  Sun,
  Upload,
} from 'lucide-react';
import {
  ANGLE_SHORT_LABEL,
  PRECISION_CAPTURE_STEPS,
} from '../shared/imageQualityAnalyzer';
import type {
  BatchCaptureAudit,
  CaptureGuidanceProfile,
  ImageAngle,
  PhotoQualityCheckItem,
  QualityCheckStatus,
} from '../shared/types';

export const REFERENCE_OBJECT_OPTIONS: Array<{
  value: NonNullable<CaptureGuidanceProfile['referenceObjectType']>;
  label: string;
  defaultMm?: number;
}> = [
  { value: 'none', label: '无参考标定物（仅文字/视觉估计）' },
  { value: 'calibration_board', label: '专业棋盘标定板 (200mm)', defaultMm: 200 },
  { value: 'credit_card_85_6mm', label: '标准银行卡/身份证 (85.6mm)', defaultMm: 85.6 },
  { value: 'a4_sheet_297mm', label: 'A4 标准纸长边 (297mm)', defaultMm: 297 },
  { value: 'ruler_scale', label: '直尺/游标卡尺参照 (自定义 mm)', defaultMm: 100 },
];

interface PrecisionCapturePanelProps {
  photos: Array<{ id: string; name: string; angle: ImageAngle; dataUrl: string }>;
  perPhotoChecks: Record<string, PhotoQualityCheckItem>;
  batchAudit: BatchCaptureAudit;
  analyzingQuality: boolean;
  referenceObjectType: NonNullable<CaptureGuidanceProfile['referenceObjectType']>;
  referenceObjectMm: number;
  onChangeReferenceObject: (
    type: NonNullable<CaptureGuidanceProfile['referenceObjectType']>,
    mm: number
  ) => void;
  onUploadForAngle: (angle: ImageAngle) => void;
  onReanalyzeQuality: () => void;
}

function statusColors(status: QualityCheckStatus): {
  border: string;
  bg: string;
  text: string;
  label: string;
} {
  if (status === 'pass') {
    return {
      border: 'border-[#16A34A]/35',
      bg: 'bg-[#F0FDF4]',
      text: 'text-[#166534]',
      label: '通过',
    };
  }
  if (status === 'warn') {
    return {
      border: 'border-[#F59E0B]/40',
      bg: 'bg-[#FFFBEB]',
      text: 'text-[#92400E]',
      label: '需注意',
    };
  }
  return {
    border: 'border-[#DC2626]/35',
    bg: 'bg-[#FEF2F2]',
    text: 'text-[#991B1B]',
    label: '未达标',
  };
}

export const PrecisionCapturePanel: React.FC<PrecisionCapturePanelProps> = ({
  photos,
  perPhotoChecks,
  batchAudit,
  analyzingQuality,
  referenceObjectType,
  referenceObjectMm,
  onChangeReferenceObject,
  onUploadForAngle,
  onReanalyzeQuality,
}) => {
  const [activeStepIdx, setActiveStepIdx] = useState<number>(() => {
    const firstMissing = PRECISION_CAPTURE_STEPS.findIndex(
      (st) =>
        !photos.some(
          (p) =>
            p.angle === st.angle ||
            (st.angle === 'left' && p.angle === 'side')
        )
    );
    return firstMissing >= 0 ? firstMissing : 0;
  });

  const activeStep = PRECISION_CAPTURE_STEPS[activeStepIdx] ?? PRECISION_CAPTURE_STEPS[0];

  const isAngleCovered = (ang: ImageAngle) =>
    photos.some(
      (p) => p.angle === ang || (ang === 'left' && p.angle === 'side')
    );

  const activeStepPhotos = photos.filter(
    (p) =>
      p.angle === activeStep.angle ||
      (activeStep.angle === 'left' && p.angle === 'side')
  );
  const activeStepCheck = activeStepPhotos[0]
    ? perPhotoChecks[activeStepPhotos[0].id]
    : undefined;

  const lightStyle = statusColors(batchAudit.lightingStatus);
  const distStyle = statusColors(batchAudit.distortionStatus);
  const matchStyle = statusColors(batchAudit.multiAngleStatus);

  const handleUploadCurrentAndAdvance = () => {
    onUploadForAngle(activeStep.angle);
    const nextIdx = PRECISION_CAPTURE_STEPS.findIndex(
      (st, idx) => idx > activeStepIdx && !isAngleCovered(st.angle)
    );
    if (nextIdx >= 0) {
      setTimeout(() => setActiveStepIdx(nextIdx), 350);
    }
  };

  return (
    <div className="pt-3 border-t border-[#ECEAE3] space-y-4">
      {/* 1. Standard 7-Step Guided Workflow */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-[#141413]">
            <Camera className="w-3.5 h-3.5 text-[#9A4D22]" />
            <span>标准采集流程引导（1–3 步为核心必采视角）</span>
          </div>
          <span className="text-[11px] font-mono tabular-nums text-[#5C5B57]">
            已采视角 {7 - batchAudit.missingRecommendedAngles.length}/7 · 预估测量误差 ±
            {batchAudit.estimatedErrorMm}mm
          </span>
        </div>

        <div className="grid grid-cols-4 sm:grid-cols-7 gap-1.5">
          {PRECISION_CAPTURE_STEPS.map((st, idx) => {
            const covered = isAngleCovered(st.angle);
            const isSelected = idx === activeStepIdx;
            const photoForStep = photos.find(
              (p) => p.angle === st.angle || (st.angle === 'left' && p.angle === 'side')
            );
            const check = photoForStep ? perPhotoChecks[photoForStep.id] : undefined;
            const hasQualityFlag =
              check && (check.lightingStatus === 'fail' || check.distortionStatus === 'fail');

            return (
              <button
                key={st.angle}
                type="button"
                onClick={() => setActiveStepIdx(idx)}
                className={`px-2 py-2 rounded border text-left transition-colors ${
                  isSelected
                    ? 'border-[#9A4D22] bg-[#FAF6F2] ring-1 ring-[#9A4D22]/40'
                    : hasQualityFlag
                      ? 'border-[#DC2626]/40 bg-[#FEF2F2]'
                      : covered
                        ? 'border-[#16A34A]/40 bg-[#F0FDF4]'
                        : 'border-[#D8D5CD] bg-white hover:border-[#9A4D22]/60'
                }`}
              >
                <div className="flex items-center justify-between gap-1 text-[10px] font-mono">
                  <span className={st.requiredForStandard ? 'text-[#9A4D22] font-semibold' : 'text-[#78756E]'}>
                    0{st.stepNumber}
                    {st.requiredForStandard ? '*' : ''}
                  </span>
                  <span
                    className={
                      hasQualityFlag
                        ? 'text-[#DC2626]'
                        : covered
                          ? 'text-[#16A34A]'
                          : 'text-[#78756E]'
                    }
                  >
                    {hasQualityFlag ? '!' : covered ? '✓' : '待拍'}
                  </span>
                </div>
                <div className="text-[11px] font-medium text-[#141413] truncate mt-0.5">
                  {ANGLE_SHORT_LABEL[st.angle]}
                </div>
              </button>
            );
          })}
        </div>

        {/* Active Step Instruction Card */}
        <div className="bg-white border border-[#E4E2DC] rounded-md p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="font-mono font-semibold text-[#9A4D22]">
                STEP 0{activeStep.stepNumber}
              </span>
              <span className="font-semibold text-[#141413]">{activeStep.label}</span>
              <span className="text-[11px] text-[#5C5B57]">
                ({activeStep.priorityLabel})
              </span>
              {activeStepCheck && (
                <span className="font-mono tabular-nums text-[11px] text-[#166534]">
                  · 已检：{activeStepCheck.widthPx}×{activeStepCheck.heightPx}px · 光照{' '}
                  {activeStepCheck.lightingScore} · 清晰度 {activeStepCheck.sharpnessScore}
                </span>
              )}
            </div>
            <p className="text-xs text-[#141413] leading-relaxed">
              {activeStep.cameraInstruction}
            </p>
            <p className="text-[11px] text-[#5C5B57] leading-relaxed">
              要点：{activeStep.framingTip}
            </p>
          </div>

          <button
            type="button"
            onClick={handleUploadCurrentAndAdvance}
            className="px-3.5 py-2 text-xs font-medium text-white bg-[#141413] hover:bg-[#2C2C2A] rounded flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0"
          >
            <Upload className="w-3.5 h-3.5" />
            {activeStepPhotos.length > 0
              ? `重拍/追加【${ANGLE_SHORT_LABEL[activeStep.angle]}】`
              : `上传【${ANGLE_SHORT_LABEL[activeStep.angle]}】照片`}
          </button>
        </div>
      </div>

      {/* 2. Reference Object Calibration */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 items-end bg-white border border-[#E4E2DC] rounded-md p-3">
        <label className="sm:col-span-2 block">
          <span className="flex items-center gap-1.5 text-[11px] font-semibold text-[#141413]">
            <Ruler className="w-3.5 h-3.5 text-[#9A4D22]" />
            比例尺标定物（确保毫米级真尺寸还原）
          </span>
          <select
            value={referenceObjectType}
            onChange={(e) => {
              const val = e.target.value as NonNullable<
                CaptureGuidanceProfile['referenceObjectType']
              >;
              const opt = REFERENCE_OBJECT_OPTIONS.find((o) => o.value === val);
              onChangeReferenceObject(val, opt?.defaultMm ?? referenceObjectMm);
            }}
            className="mt-1 w-full px-2.5 py-1.5 text-xs bg-[#FAF9F6] border border-[#D8D5CD] rounded"
          >
            {REFERENCE_OBJECT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        {referenceObjectType !== 'none' ? (
          <label className="block">
            <span className="text-[11px] text-[#5C5B57]">参照物实长 (mm)</span>
            <input
              type="number"
              step="0.1"
              value={referenceObjectMm}
              onChange={(e) =>
                onChangeReferenceObject(referenceObjectType, Number(e.target.value) || 0)
              }
              className="mt-1 w-full px-2.5 py-1.5 text-xs font-mono tabular-nums bg-[#FAF9F6] border border-[#D8D5CD] rounded"
            />
          </label>
        ) : (
          <div className="text-[11px] text-[#92400E] bg-[#FFFBEB] border border-[#F59E0B]/30 rounded px-2.5 py-1.5">
            建议随包放置银行卡或 A4 纸，否则需在下方输入已知尺寸。
          </div>
        )}
      </div>

      {/* 3. Automatic Quality Inspection & Readiness Gate */}
      <div className="bg-white border border-[#E4E2DC] rounded-md p-3.5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-xs font-semibold text-[#141413]">
            自动采集质量检测（光照 · 镜头畸变 · 多角度匹配度）
          </div>
          <button
            type="button"
            disabled={analyzingQuality || photos.length === 0}
            onClick={onReanalyzeQuality}
            className="px-2.5 py-1 text-[11px] font-medium border border-[#D8D5CD] rounded bg-[#FAF9F6] hover:bg-[#ECEAE3] disabled:opacity-40 text-[#141413] flex items-center gap-1 whitespace-nowrap"
          >
            <RefreshCw className={`w-3 h-3 ${analyzingQuality ? 'animate-spin' : ''}`} />
            {analyzingQuality ? '检测中...' : '重新自动检测'}
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
          {/* Lighting */}
          <div className={`rounded border p-2.5 space-y-1 ${lightStyle.border} ${lightStyle.bg}`}>
            <div className="flex items-center justify-between gap-1">
              <span className="flex items-center gap-1 font-medium text-[#141413]">
                <Sun className="w-3.5 h-3.5 text-[#9A4D22]" />
                光照均匀度
              </span>
              <span className={`font-mono tabular-nums font-semibold ${lightStyle.text}`}>
                {photos.length > 0 ? `${batchAudit.lightingScore}/100 · ${lightStyle.label}` : '待上传'}
              </span>
            </div>
            <div className="text-[11px] text-[#5C5B57]">
              {photos.length === 0
                ? '等待上传后检测亮度与阴影差'
                : batchAudit.lightingStatus === 'pass'
                  ? '曝光适中，表面缝线与边缘对比清晰'
                  : '建议避免逆光与硬阴影，使用柔和漫射光'}
            </div>
          </div>

          {/* Distortion & Sharpness */}
          <div className={`rounded border p-2.5 space-y-1 ${distStyle.border} ${distStyle.bg}`}>
            <div className="flex items-center justify-between gap-1">
              <span className="flex items-center gap-1 font-medium text-[#141413]">
                <ScanEye className="w-3.5 h-3.5 text-[#9A4D22]" />
                畸变与清晰度
              </span>
              <span className={`font-mono tabular-nums font-semibold ${distStyle.text}`}>
                {photos.length > 0 ? `${batchAudit.distortionScore}/100 · ${distStyle.label}` : '待上传'}
              </span>
            </div>
            <div className="text-[11px] text-[#5C5B57]">
              {photos.length === 0
                ? '等待检测分辨率、对焦清晰度与广角拉伸'
                : batchAudit.distortionStatus === 'pass'
                  ? '边缘锐利且主体居中，透视拉伸风险低'
                  : '避免近距离广角贴拍，保持主体四周留白'}
            </div>
          </div>

          {/* Multi-angle match */}
          <div className={`rounded border p-2.5 space-y-1 ${matchStyle.border} ${matchStyle.bg}`}>
            <div className="flex items-center justify-between gap-1">
              <span className="flex items-center gap-1 font-medium text-[#141413]">
                <Camera className="w-3.5 h-3.5 text-[#9A4D22]" />
                多角度匹配度
              </span>
              <span className={`font-mono tabular-nums font-semibold ${matchStyle.text}`}>
                {photos.length > 0 ? `${batchAudit.multiAngleMatchPct}% · ${matchStyle.label}` : '待上传'}
              </span>
            </div>
            <div className="text-[11px] text-[#5C5B57] font-mono tabular-nums">
              {photos.length >= 2
                ? `色温一致 ${batchAudit.colorConsistencyPct}% · 尺度一致 ${batchAudit.resolutionConsistencyPct}%`
                : '需 ≥2 张不同视角才可校验跨视角一致性'}
            </div>
          </div>
        </div>

        {/* Readiness Verdict */}
        <div
          className={`rounded border px-3 py-2.5 text-xs space-y-1 ${
            batchAudit.meetsStandardPatternRequirements
              ? 'bg-[#F0FDF4] border-[#16A34A]/35 text-[#166534]'
              : 'bg-[#FFFBEB] border-[#F59E0B]/40 text-[#92400E]'
          }`}
        >
          <div className="flex items-center gap-1.5 font-semibold">
            {batchAudit.meetsStandardPatternRequirements ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-[#16A34A]" />
            ) : (
              <AlertTriangle className="w-4 h-4 shrink-0 text-[#D97706]" />
            )}
            <span>{batchAudit.readinessSummary}</span>
          </div>
          {batchAudit.blockingReasons.length > 0 && (
            <div className="text-[11px] pl-5">
              必改项：{batchAudit.blockingReasons.join('；')}
            </div>
          )}
          {batchAudit.warnings.length > 0 && (
            <div className="text-[11px] pl-5 opacity-90">
              优化建议：{batchAudit.warnings.join('；')}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
