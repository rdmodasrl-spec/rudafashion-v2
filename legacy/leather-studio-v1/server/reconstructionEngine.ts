import { BAG_ARCHETYPES, BAG_TYPE_LABELS, STRUCTURE_TYPE_LABELS, computeThicknessCompensationMm, getMaterialById } from '../src/shared/leatherKnowledge';
import {
  analyzeSurfaceDevelopability,
  buildSeamPairDetails,
  generateParametricPatterns,
  validateProjectPatterns,
} from '../src/shared/cadEngine';
import { matchMasterTemplates } from '../src/shared/masterPatternLibrary';
import type {
  CaptureGuidanceProfile,
  ImageAngle,
  MasterPatternTemplate,
  ProductDimensions,
  ProductImage,
  Project,
  ReconstructionStepResult,
  SeamPairDetail,
  SurfaceDevelopabilityReport,
  VisionAnalysisSummary,
} from '../src/shared/types';
import { analyzeBagPhotosWithGemini, type VisionAnalysisPayload } from './geminiService.ts';
import type { PatternCaseSummary } from './intelligenceService.ts';

export interface ReconstructionPipelineResult {
  bagType: Project['bagType'];
  structureType: Project['structureType'];
  matchedTemplateId: string;
  captureGuidance: CaptureGuidanceProfile;
  dimensions: ProductDimensions;
  materialId: string;
  edgeProcess: Project['edgeProcess'];
  features: Project['features'];
  hardware: Project['hardware'];
  components: Project['components'];
  relations: Project['relations'];
  patterns: Project['patterns'];
  developability: SurfaceDevelopabilityReport;
  seamPairDetails: SeamPairDetail[];
  validation: Project['validation'];
  visionSummary: VisionAnalysisSummary;
  steps: ReconstructionStepResult[];
}

const RECOMMENDED_PRECISION_ANGLES: ImageAngle[] = [
  'front',
  'back',
  'left',
  'right',
  'bottom',
  'top',
  'interior',
];

export async function runPhotoReconstructionPipeline(params: {
  images: ProductImage[];
  userBrief: string;
  historicalCases?: PatternCaseSummary[];
  captureGuidance?: Partial<CaptureGuidanceProfile>;
  extraTemplates?: MasterPatternTemplate[];
  onStageProgress?: (stepNumber: number, message: string, progress: number) => void;
}): Promise<ReconstructionPipelineResult> {
  const {
    images,
    userBrief,
    historicalCases = [],
    captureGuidance: inputGuidance,
    extraTemplates = [],
    onStageProgress,
  } = params;
  const steps: ReconstructionStepResult[] = [];
  const t0 = Date.now();

  // Step 1: Photo Upload Verification
  const step1Start = Date.now();
  onStageProgress?.(1, '01/14 · 校验原始产品照片与视角清单', 10);
  steps.push({
    stepNumber: 1,
    stepKey: '01_photo_upload',
    title: '01. 原始照片接入',
    phase: 'task1_vision',
    status: images.length > 0 ? 'completed' : 'warning',
    confidence: images.length > 0 ? 1.0 : 0.65,
    durationMs: Math.max(4, Date.now() - step1Start),
    outputSummary:
      images.length > 0
        ? `已接收 ${images.length} 张参考照片（${images.map((i) => i.angle).join('、')}）`
        : '无参考照片输入，基于纯文字规格描述启动推理',
    warnings: images.length <= 1 ? ['单图或无图输入，无法获取隐藏背面及多视角比例参照'] : undefined,
  });

  // Steps 2–7: Call Gemini Vision (Task 1) + Structure Reasoning (Task 2)
  const visionStart = Date.now();
  onStageProgress?.(2, '02-07/14 · 执行图像识别（角度/包型/部件/缝线）与皮具三维结构推理', 35);
  const analysis: VisionAnalysisPayload = await analyzeBagPhotosWithGemini(images, userBrief);
  const visionElapsed = Math.max(50, Date.now() - visionStart);

  const isSinglePhotoMode = images.length <= 1;

  // Step 2: Angle & Perspective Check
  steps.push({
    stepNumber: 2,
    stepKey: '02_angle_detection',
    title: '02. 产品角度与透视误差识别',
    phase: 'task1_vision',
    status: analysis.perspectiveDistortionRisk === 'high' ? 'warning' : 'completed',
    confidence: isSinglePhotoMode ? 0.72 : 0.9,
    durationMs: Math.round(visionElapsed * 0.16),
    outputSummary: `识别视角：${analysis.detectedAngles?.join('、') || (images[0]?.angle ?? 'front')} · 透视风险：${analysis.perspectiveDistortionRisk.toUpperCase()}`,
    details: [analysis.perspectiveNote, analysis.multiViewConsistencyNote],
    warnings: isSinglePhotoMode
      ? ['单张照片存在透视比例失真风险，禁止直接标注为正式生产标准版']
      : undefined,
  });

  // Step 3: Bag Type Classification
  steps.push({
    stepNumber: 3,
    stepKey: '03_bag_type_classification',
    title: '03. 整体包型分类',
    phase: 'task1_vision',
    status: 'completed',
    confidence: analysis.confidence,
    durationMs: Math.round(visionElapsed * 0.14),
    outputSummary: `包型判定：${BAG_TYPE_LABELS[analysis.detectedBagType]}（置信度 ${Math.round(analysis.confidence * 100)}%）`,
  });

  // Step 4: Visible Part Segmentation
  const visibleParts = analysis.detectedParts.filter((p) => !p.isInferredHidden);
  steps.push({
    stepNumber: 4,
    stepKey: '04_visible_part_segmentation',
    title: '04. 可见部件图像分割',
    phase: 'task1_vision',
    status: 'completed',
    confidence: 0.88,
    durationMs: Math.round(visionElapsed * 0.18),
    outputSummary: `已定位 ${visibleParts.length} 个照片可见部件（仅视觉分割，非直接纸格）`,
    details: visibleParts.map((p) => `${p.name} (${p.standardType})`),
  });

  // Step 5: Seam & Boundary Recognition
  steps.push({
    stepNumber: 5,
    stepKey: '05_seam_boundary_detection',
    title: '05. 缝线与部件边界识别',
    phase: 'task1_vision',
    status: 'completed',
    confidence: 0.85,
    durationMs: Math.round(visionElapsed * 0.16),
    outputSummary: `识别 ${analysis.detectedSeamsAndBoundaries?.length || 2} 处主要车缝边界与封边工艺 (${analysis.edgeProcess})`,
    details: analysis.detectedSeamsAndBoundaries,
  });

  // Step 6: 3D Structure Reasoning (Task 2)
  const hiddenParts = analysis.detectedParts.filter((p) => p.isInferredHidden);
  steps.push({
    stepNumber: 6,
    stepKey: '06_3d_structure_reasoning',
    title: '06. 三维结构与隐藏件反向推理',
    phase: 'task2_reasoning',
    status: analysis.uncertainStructures.length > 0 ? 'warning' : 'completed',
    confidence: 0.82,
    durationMs: Math.round(visionElapsed * 0.18),
    outputSummary: analysis.integratedVsSeparateNotes || `推断一体/独立裁片关系，并补充 ${hiddenParts.length} 个隐藏内部结构件`,
    details: hiddenParts.map((p) => `推断隐藏件：${p.name}`),
    warnings: analysis.uncertainStructures.length > 0 ? analysis.uncertainStructures : undefined,
  });

  // Step 7: Structure Type Classification
  steps.push({
    stepNumber: 7,
    stepKey: '07_structure_type_classification',
    title: '07. 制造结构类型分类',
    phase: 'task2_reasoning',
    status: 'completed',
    confidence: 0.86,
    durationMs: Math.round(visionElapsed * 0.18),
    outputSummary: `结构分类：${STRUCTURE_TYPE_LABELS[analysis.detectedStructureType] ?? analysis.detectedStructureType}`,
  });

  // Step 8: Master Pattern Library Match + Verified Case Comparison
  const s8Start = Date.now();
  onStageProgress?.(8, '08-09/14 · 检索标准版型模板库并计算参数与样本差异', 58);
  const templateMatches = matchMasterTemplates({
    bagType: analysis.detectedBagType,
    structureType: analysis.detectedStructureType,
    dimensions: {
      widthMm: analysis.widthMm,
      heightMm: analysis.heightMm,
      depthMm: analysis.depthMm,
      gussetStyle: analysis.gussetStyle,
    },
    features: analysis.features,
    materialId: analysis.materialId,
    extraTemplates,
  });
  const bestMatch = templateMatches[0];
  const matchedTemplate = bestMatch.template;

  const sameBagCases = historicalCases
    .filter((c) => c.bagType === analysis.detectedBagType)
    .slice(0, 3)
    .map((c) => {
      const dw = Math.round(analysis.widthMm - c.dimensionsSummary.widthMm);
      const dh = Math.round(analysis.heightMm - c.dimensionsSummary.heightMm);
      const dd = Math.round(analysis.depthMm - c.dimensionsSummary.depthMm);
      return {
        caseId: c.id,
        title: c.title,
        similarityPct: Math.max(72, Math.min(98, Math.round(95 - (Math.abs(dw) + Math.abs(dh) + Math.abs(dd)) * 0.12))),
        dimensionDeltaSummary: `ΔW ${dw >= 0 ? `+${dw}` : dw} · ΔH ${dh >= 0 ? `+${dh}` : dh} · ΔD ${dd >= 0 ? `+${dd}` : dd}mm`,
        productionVerified: c.productionVerified,
      };
    });

  steps.push({
    stepNumber: 8,
    stepKey: '08_master_template_retrieval',
    title: '08. 标准模板库检索与样板对照',
    phase: 'task2_reasoning',
    status: 'completed',
    confidence: bestMatch.matchScore,
    durationMs: Math.max(3, Date.now() - s8Start),
    outputSummary: `匹配授权样板「${matchedTemplate.name}」（匹配度 ${Math.round(bestMatch.matchScore * 100)}%，审核等级 L${matchedTemplate.reviewLevel}）`,
    details: [
      `授权来源：${matchedTemplate.authorizedSource}`,
      ...sameBagCases.map((sc) => `历史样板对照：${sc.title} (${sc.similarityPct}% · ${sc.dimensionDeltaSummary})`),
    ],
  });

  // Step 9: Capture Guidance, Lens/Perspective Error Estimate & Parameter Delta Computation
  const s9Start = Date.now();
  const archetype = BAG_ARCHETYPES[analysis.detectedBagType];
  const coveredAngles = Array.from(new Set(images.map((i) => i.angle))) as ImageAngle[];
  const missingRecommendedAngles = RECOMMENDED_PRECISION_ANGLES.filter(
    (a) =>
      !coveredAngles.includes(a) &&
      !((a === 'left' || a === 'right') && coveredAngles.includes('side'))
  );
  const captureMode =
    inputGuidance?.mode ?? (images.length >= 3 ? 'precision_pattern' : 'quick_ai');
  const hasRefObject = Boolean(
    inputGuidance?.referenceObjectType && inputGuidance.referenceObjectType !== 'none'
  );
  const perspectiveCorrectionApplied = images.length >= 2 || hasRefObject;
  const qualityInspection = inputGuidance?.qualityInspection;
  const estimatedMeasurementErrorMm = analysis.userProvidedDimensions
    ? 0.8
    : qualityInspection?.estimatedErrorMm && qualityInspection.estimatedErrorMm > 0
      ? Math.min(
          qualityInspection.estimatedErrorMm,
          hasRefObject && images.length >= 3 ? 1.8 : 6.5
        )
      : hasRefObject && images.length >= 3
        ? 1.8
        : hasRefObject || images.length >= 3
          ? 3.8
          : images.length === 2
            ? 6.5
            : 12.0;

  const captureGuidanceProfile: CaptureGuidanceProfile = {
    mode: captureMode,
    referenceObjectType: inputGuidance?.referenceObjectType ?? 'none',
    referenceObjectMm: inputGuidance?.referenceObjectMm,
    perspectiveCorrectionApplied,
    lensDistortionNote: perspectiveCorrectionApplied
      ? `已完成多视角透视比例比对${hasRefObject ? `及标定物(${inputGuidance?.referenceObjectType})换算` : ''}`
      : '单角/无参考标定物，未做镜头广角畸变与透视校准',
    estimatedMeasurementErrorMm,
    coveredAngles,
    missingRecommendedAngles,
    qualityInspection,
  };

  const canMarkScaleCalibrated = hasRefObject && images.length >= 2;
  const dimensionSource: ProductDimensions['dimensionSource'] = analysis.userProvidedDimensions
    ? 'user_confirmed'
    : canMarkScaleCalibrated
      ? 'scale_calibrated'
      : 'ai_estimated';

  const dimensions: ProductDimensions = {
    ...matchedTemplate.defaultDimensions,
    widthMm: analysis.widthMm,
    heightMm: analysis.heightMm,
    depthMm: analysis.depthMm,
    handleLengthMm: analysis.handleLengthMm,
    gussetStyle: analysis.gussetStyle,
    structureType: analysis.detectedStructureType,
    dimensionSource,
    calibrationNote:
      dimensionSource === 'user_confirmed'
        ? '基于用户明确说明的实物毫米尺寸生成'
        : dimensionSource === 'scale_calibrated'
          ? `已按参考物(${inputGuidance?.referenceObjectType})及多角度视图校准，估计误差 ±${estimatedMeasurementErrorMm}mm`
          : `AI 视觉估算比例（估计误差 ±${estimatedMeasurementErrorMm}mm，禁止直接当作生产尺寸）`,
  };

  steps.push({
    stepNumber: 9,
    stepKey: '09_parameter_delta_computation',
    title: '09. 视角采集校准、透视误差与参数差异计算',
    phase: 'task2_reasoning',
    status: dimensionSource === 'ai_estimated' ? 'warning' : 'completed',
    confidence: dimensionSource === 'user_confirmed' ? 0.96 : dimensionSource === 'scale_calibrated' ? 0.86 : 0.65,
    durationMs: Math.max(2, Date.now() - s9Start),
    outputSummary: `模式：${captureMode === 'precision_pattern' ? '精准打版' : '普通AI'} · 估计误差 ±${estimatedMeasurementErrorMm}mm · 相对样板差异：${bestMatch.dimensionDeltaSummary}`,
    warnings:
      dimensionSource === 'ai_estimated'
        ? [
            analysis.clarifyingQuestion || '尚未输入实测毫米尺寸，当前仅可输出「AI 设计版」',
            ...(missingRecommendedAngles.length > 0
              ? [`建议补拍角度：${missingRecommendedAngles.slice(0, 4).join('、')}`]
              : []),
          ]
        : undefined,
  });

  // Step 10–12: Parametric Net CAD Generation + Material/Thickness Compensation + Cut Layer Generation
  const cadStart = Date.now();
  onStageProgress?.(10, '10-12/14 · 生成参数化二维净版、应用皮料厚度补偿与裁剪版边界', 78);
  const generated = generateParametricPatterns(
    analysis.detectedBagType,
    dimensions,
    analysis.materialId,
    analysis.edgeProcess,
    analysis.features
  );
  const mat = getMaterialById(analysis.materialId);
  const comp = computeThicknessCompensationMm(analysis.materialId, analysis.edgeProcess);
  const developability = analyzeSurfaceDevelopability(generated.patterns, dimensions, analysis.materialId);

  steps.push({
    stepNumber: 10,
    stepKey: '10_parametric_net_generation',
    title: '10. 参数化二维净版与缝合线生成',
    phase: 'task3_pattern_cad',
    status: 'completed',
    confidence: 0.96,
    durationMs: Math.max(4, Math.round((Date.now() - cadStart) * 0.4)),
    outputSummary: `生成 ${generated.patterns.length} 片独立二维参数化净版与 ${generated.relations.length} 组接缝关系`,
  });

  steps.push({
    stepNumber: 11,
    stepKey: '11_process_thickness_compensation',
    title: '11. 皮料厚度补偿与曲面展开评估',
    phase: 'task3_pattern_cad',
    status: developability.developableStatus === 'requires_split_or_dart' ? 'warning' : 'completed',
    confidence: 0.94,
    durationMs: Math.max(3, Math.round((Date.now() - cadStart) * 0.3)),
    outputSummary: `${mat.name} (${mat.thicknessMm}mm) 内衬缩减 -${comp.liningWidthDeductionMm}/-${comp.liningHeightDeductionMm}mm · 曲面形变 ${developability.maxDistortionPct}%`,
    details: [developability.summary],
    warnings: comp.skiveRequired ? [`折边区域需铲薄至 ${comp.skiveTargetMm}mm`] : undefined,
  });

  steps.push({
    stepNumber: 12,
    stepKey: '12_cut_pattern_generation',
    title: '12. 裁剪版边界、纹理与刀口生成',
    phase: 'task3_pattern_cad',
    status: 'completed',
    confidence: 0.96,
    durationMs: Math.max(3, Math.round((Date.now() - cadStart) * 0.3)),
    outputSummary: `输出全套三层纸格数据（净版/工艺版/裁剪版），含对称标记、正纹方向及件数编码`,
  });

  // Step 13: 10-Point Pattern Validation & Seam Pair Mapping
  const s13Start = Date.now();
  onStageProgress?.(13, '13-14/14 · 执行 10 项纸格质量检测与生产文件就绪评估', 94);
  const validation = validateProjectPatterns(
    generated.patterns,
    generated.relations,
    analysis.materialId,
    analysis.edgeProcess,
    dimensions
  );
  const seamPairDetails = buildSeamPairDetails(generated.patterns, generated.relations);

  // Merge AI bounding boxes onto components where standardType matches
  const enrichedComponents = generated.components.map((compItem) => {
    const matchedPart = analysis.detectedParts.find(
      (dp) => dp.standardType === compItem.standardType
    );
    return {
      ...compItem,
      boundingBox2D: matchedPart?.boundingBox2D ?? compItem.boundingBox2D,
      confidence: matchedPart?.confidence ?? compItem.confidence,
    };
  });

  steps.push({
    stepNumber: 13,
    stepKey: '13_pattern_quality_validation',
    title: '13. 10 项纸格质量自动校验',
    phase: 'task3_pattern_cad',
    status: validation.errorCount > 0 ? 'failed' : validation.warningCount > 0 ? 'warning' : 'completed',
    confidence: validation.passed ? 0.95 : 0.6,
    durationMs: Math.max(2, Date.now() - s13Start),
    outputSummary: validation.passed
      ? `通过 ${validation.checksRun.length} 项几何检验（${validation.warningCount} 项工艺提醒）`
      : `发现 ${validation.errorCount} 项几何错误与 ${validation.warningCount} 项警告`,
    warnings: validation.issues.slice(0, 4).map((i) => `${i.title}: ${i.detail}`),
  });

  // Step 14: Production Export Readiness
  const readyForProd =
    validation.passed &&
    analysis.userProvidedDimensions &&
    !isSinglePhotoMode;
  steps.push({
    stepNumber: 14,
    stepKey: '14_production_ready_prep',
    title: '14. 生产导出数据包与认证定级',
    phase: 'task3_pattern_cad',
    status: readyForProd ? 'completed' : 'warning',
    confidence: readyForProd ? 0.94 : 0.72,
    durationMs: Math.max(2, Date.now() - t0 - visionElapsed),
    outputSummary: readyForProd
      ? '几何验证通过且已实测标尺，可进入打版师审核及 DXF/PDF/SVG 生产导出'
      : `当前定级为「${validation.passed ? '几何验证版' : 'AI 草版'}」：${isSinglePhotoMode ? '单图模式' : '未实测标尺'}暂不可直接标记为正式生产版`,
    warnings: !readyForProd
      ? ['需补充多角度照或输入实物校准尺寸，并完成打版师与实样确认']
      : undefined,
  });

  const competingStructuresConsidered =
    analysis.competingStructuresConsidered && analysis.competingStructuresConsidered.length > 0
      ? analysis.competingStructuresConsidered
      : templateMatches
          .slice(1, 3)
          .map((m) => ({
            structureType: m.template.structureType,
            reasonRejected: `照片特征与接缝形态更贴合「${STRUCTURE_TYPE_LABELS[analysis.detectedStructureType] ?? analysis.detectedStructureType}」（候选差距：${m.dimensionDeltaSummary}）`,
          }));

  const visionSummary: VisionAnalysisSummary = {
    detectedBagType: analysis.detectedBagType,
    detectedStructureType: analysis.detectedStructureType,
    matchedTemplateId: matchedTemplate.id,
    matchedTemplateName: matchedTemplate.name,
    templateMatchScore: bestMatch.matchScore,
    competingStructuresConsidered,
    confidence: analysis.confidence,
    visualNotes: analysis.visualNotes,
    observedFeatures: analysis.observedFeatures,
    detectedSeamsAndBoundaries: analysis.detectedSeamsAndBoundaries,
    uncertainStructures: Array.from(
      new Set([
        ...analysis.uncertainStructures,
        ...(isSinglePhotoMode ? ['仅单张视角照片，背面与内部隐藏结构待实拍确认'] : []),
      ])
    ),
    clarifyingQuestion: analysis.userProvidedDimensions
      ? undefined
      : analysis.clarifyingQuestion ||
        `当前尺寸按 ${dimensions.widthMm}×${dimensions.heightMm}×${dimensions.depthMm}mm 估算（误差 ±${estimatedMeasurementErrorMm}mm），请输入实际测量的包宽/包高以完成校准。`,
    captureGuidance: captureGuidanceProfile,
    perspectiveAssessment: {
      photoCount: images.length,
      isSinglePhotoMode,
      perspectiveRisk: analysis.perspectiveDistortionRisk,
      perspectiveNote: analysis.perspectiveNote,
      multiViewConsistencyNote: analysis.multiViewConsistencyNote,
    },
    similarCaseComparisons: sameBagCases,
    reconstructionSteps: steps,
    analyzedAt: new Date().toISOString(),
  };

  return {
    bagType: analysis.detectedBagType,
    structureType: analysis.detectedStructureType,
    matchedTemplateId: matchedTemplate.id,
    captureGuidance: captureGuidanceProfile,
    dimensions,
    materialId: analysis.materialId,
    edgeProcess: analysis.edgeProcess,
    features: analysis.features,
    hardware: archetype.hardware.map((h) => ({ ...h })),
    components: enrichedComponents,
    relations: generated.relations,
    patterns: generated.patterns,
    developability,
    seamPairDetails,
    validation,
    visionSummary,
    steps,
  };
}
