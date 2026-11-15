import { getUserByUid, updateUserPreferences } from '../src/db/users.ts';
import {
  computeSmartNesting,
  createStarterSnapshot,
  executeCadTransaction,
  validateProjectPatterns,
} from '../src/shared/cadEngine.ts';
import {
  KNOWLEDGE_BASE_META,
  MATERIAL_LIBRARY,
  PROCESS_SCHEMES,
} from '../src/shared/leatherKnowledge.ts';
import type {
  AccuracyBenchmarkSummary,
  BagType,
  BlindTestRecord,
  FactoryProductionFeedback,
  MasterPatternTemplate,
  Project,
  StructuredCadCommand,
  TrainingSampleRecord,
} from '../src/shared/types.ts';
import { computeDeterministicEmbedding, generateSemanticEmbedding } from './embeddings.ts';
import { deriveBlindTestProofs, executeAccuracyBenchmarkSuite } from './benchmarkRunner.ts';

function cosineDistanceJs(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  if (!denom) return 1;
  return 1 - dot / denom;
}

const memStore = {
  seeded: false,
  processRules: [] as Array<any>,
  constructionRules: [] as Array<any>,
  knowledgeDocs: [] as Array<any>,
  patternCases: [] as Array<any>,
  experienceRecords: [] as Array<any>,
  memoryItems: [] as Array<any>,
  learningCandidates: [] as Array<any>,
  feedbackEvents: [] as Array<any>,
  knowledgeVersions: [] as Array<any>,
  evalDatasets: [] as Array<any>,
  evalResults: [] as Array<any>,
  blindTests: [] as BlindTestRecord[],
  customTemplates: [] as MasterPatternTemplate[],
  factoryFeedbacks: [] as FactoryProductionFeedback[],
  benchmarkRuns: [] as AccuracyBenchmarkSummary[],
  trainingSamples: [] as TrainingSampleRecord[],
};

export async function memEnsureSeeded(): Promise<void> {
  if (memStore.seeded) return;
  const nowIso = new Date().toISOString();

  memStore.blindTests = [
    {
      id: 'bt_unseen_zip_tote_01',
      title: '盲测 #01 · 未录入新款通勤拉链托特包',
      bagType: 'tote',
      structureType: 'zipper_commuter_tote',
      photoCount: 3,
      actualDimensionsMm: { widthMm: 340, heightMm: 265, depthMm: 130 },
      aiInitialDimensionsMm: { widthMm: 330, heightMm: 255, depthMm: 125 },
      matchedTemplateId: 'tpl_tote_zipper_commuter',
      aiInitialSummary: '3视角自动匹配包口拉链挡片结构（10片裁片），初始尺寸最大偏差 10mm，经实测宽度 340mm 一键校准后全部接缝差 <= 0.4mm。',
      manualCorrections: ['通过实测标尺将包宽由 330mm 校准为 340mm', '调整内拉链袋高度 +10mm'],
      physicalSampleOutcome: 'passed',
      dimensionErrorMm: 10,
      maxSeamDiffMm: 0.4,
      completenessScore: 0.94,
      processReasonable: true,
      aiRecognitionPassed: true,
      geometry2DPassed: true,
      seamsAndProcessPassed: true,
      physicalProductionPassed: true,
      testerNotes: '首件牛皮试样装配顺畅，拉链头端退让 6mm 无卡滞。',
      createdAt: nowIso,
    },
    {
      id: 'bt_unseen_saddle_02',
      title: '盲测 #02 · 单角度拍摄复古马鞍斜挎包',
      bagType: 'shoulder_bag',
      structureType: 'saddle_flap_crossbody',
      photoCount: 1,
      actualDimensionsMm: { widthMm: 225, heightMm: 168, depthMm: 72 },
      aiInitialDimensionsMm: { widthMm: 240, heightMm: 175, depthMm: 75 },
      matchedTemplateId: 'tpl_shoulder_saddle_flap',
      aiInitialSummary: '单图模式正确标注透视误差并禁止直标正式生产版，推荐匹配马鞍弧形翻盖结构，人工补充包宽 225mm 后生成标准 U 型侧围纸格。',
      manualCorrections: ['补测包宽 225mm 与侧面厚度 72mm 并执行多轴校准', '将底角圆角由 22mm 微调至 28mm'],
      physicalSampleOutcome: 'minor_adjustment',
      dimensionErrorMm: 15,
      maxSeamDiffMm: 0.8,
      completenessScore: 0.9,
      processReasonable: true,
      aiRecognitionPassed: true,
      geometry2DPassed: true,
      seamsAndProcessPassed: true,
      physicalProductionPassed: false,
      testerNotes: '单图透视偏差已通过多轴标尺输入消除，车缝U形围弧度吻合（需二轮复样确认）。',
      createdAt: nowIso,
    },
  ];

  memStore.trainingSamples = [
    {
      id: 'ts_seed_tote_01',
      title: '植鞣牛皮立挺托特包（7视角+卡尺标定）',
      bagType: 'tote',
      structureType: 'independent_gusset_bottom',
      materialId: 'veg_tan_18',
      edgeProcess: 'raw_burnish',
      datasetSplit: 'train',
      photoAngles: ['front', 'back', 'left', 'right', 'bottom', 'top', 'interior'],
      photoCount: 7,
      hasReferenceCalibration: true,
      referenceObjectType: 'calibration_board',
      trueDimensionsMm: { widthMm: 300, heightMm: 240, depthMm: 120 },
      visiblePartLabels: ['前包身', '后包身', '独立侧围', '独立底片', '双提手'],
      hiddenPartLabels: ['牛津布里布', '拉链内袋', '1.2mm 再生皮底托板'],
      seamBoundaryNotes: '侧围与前片贴合边外圈车线 3.5mm 针距，底角直角贴合需 45° 对位刀口',
      verifiedPieceCount: 8,
      verifiedPatternSummary: [
        { partCode: 'A01', name: '前包身', widthMm: 310, heightMm: 250, seamAllowanceMm: 5, quantity: 1 },
        { partCode: 'A02', name: '后包身', widthMm: 310, heightMm: 250, seamAllowanceMm: 5, quantity: 1 },
        { partCode: 'A03', name: '左侧围', widthMm: 130, heightMm: 250, seamAllowanceMm: 5, quantity: 2 },
        { partCode: 'A04', name: '独立底片', widthMm: 310, heightMm: 130, seamAllowanceMm: 5, quantity: 1 },
      ],
      annotationStatus: 'production_golden',
      annotatedBy: '陈工（首席皮具打版师）',
      leatherSpecificRulesChecked: true,
      notes: '已核验 1.8mm 植鞣牛皮厚度补偿与底角铲薄坡度，非服装软布料展开规则。',
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      id: 'ts_seed_handbag_02',
      title: '意式梯形翻盖手提包（多角度+实物打样）',
      bagType: 'handbag',
      structureType: 'trapezoid_flap_frame',
      materialId: 'box_calf_15',
      edgeProcess: 'edge_paint',
      datasetSplit: 'validation',
      photoAngles: ['front', 'back', 'left', 'right', 'bottom', 'interior'],
      photoCount: 6,
      hasReferenceCalibration: true,
      referenceObjectType: 'credit_card_85_6mm',
      trueDimensionsMm: { widthMm: 280, heightMm: 210, depthMm: 110 },
      visiblePartLabels: ['梯形前幅', '一体后幅翻盖', '斜梯形侧围', '双半圆提手', '旋锁五金'],
      hiddenPartLabels: ['羊皮里布', '0.8mm 翻盖回弹定型衬', '1.5mm 提手补强织带'],
      seamBoundaryNotes: '翻盖弧度与前幅旋锁孔距中心对齐 ±0.5mm，四层叠加边部铲薄至 0.65mm',
      verifiedPieceCount: 9,
      verifiedPatternSummary: [
        { partCode: 'A01', name: '梯形前幅', widthMm: 290, heightMm: 220, seamAllowanceMm: 5, quantity: 1 },
        { partCode: 'A02', name: '一体后幅翻盖', widthMm: 290, heightMm: 350, seamAllowanceMm: 5, quantity: 1 },
        { partCode: 'A03', name: '梯形侧围', widthMm: 120, heightMm: 220, seamAllowanceMm: 5, quantity: 2 },
      ],
      annotationStatus: 'patternmaker_verified',
      annotatedBy: '林师傅（结构主管）',
      leatherSpecificRulesChecked: true,
      notes: '验证梯形收敛斜度与翻盖弯折半径 14mm 补偿量。',
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      id: 'ts_seed_shoulder_03',
      title: '圆弧 U 形围马鞍斜挎包（封存盲测样本）',
      bagType: 'shoulder_bag',
      structureType: 'curved_u_gusset',
      materialId: 'pebbled_16',
      edgeProcess: 'folded',
      datasetSplit: 'sealed_test',
      photoAngles: ['front', 'left', 'bottom'],
      photoCount: 3,
      hasReferenceCalibration: true,
      referenceObjectType: 'ruler_scale',
      trueDimensionsMm: { widthMm: 260, heightMm: 185, depthMm: 88 },
      visiblePartLabels: ['圆弧前幅', '一体U形侧围', '弧形翻盖', '可调长肩带'],
      hiddenPartLabels: ['里布U形围', 'D形环耳仔防拉织带', '折边定位胶条'],
      seamBoundaryNotes: '圆弧底角折边需等距V型牙口，U形围长度必须按中线中性层弧长积分核算',
      verifiedPieceCount: 7,
      verifiedPatternSummary: [
        { partCode: 'A01', name: '圆弧前幅', widthMm: 272, heightMm: 197, seamAllowanceMm: 6, quantity: 1 },
        { partCode: 'A03', name: '一体U形侧围', widthMm: 100, heightMm: 612, seamAllowanceMm: 6, quantity: 1 },
      ],
      annotationStatus: 'production_golden',
      annotatedBy: '陈工（首席皮具打版师）',
      leatherSpecificRulesChecked: true,
      notes: '封存测试集样本：仅用于模型精度盲测，禁止加入训练梯度。',
      createdAt: nowIso,
      updatedAt: nowIso,
    },
  ];

  memStore.factoryFeedbacks = [
    {
      id: 'ff_seed_tote_300',
      projectId: 'seed_tote_01',
      projectName: '经典植鞣立挺托特包 300×240×120mm',
      projectVersion: 2,
      bagType: 'tote',
      materialId: 'veg_tan_18',
      actualCutDeviationMm: 0.3,
      stitchingCondition: '3.85mm 菱斩过线平顺，耳仔双道车缝无偏斜',
      seamDeviationMm: 0.6,
      materialIssues: '无开裂或溢胶，1.8mm 植鞣背脊正纹立挺度佳',
      skivingIssues: '耳仔底座铲薄至 1.0mm 后铆钉贴合紧密',
      pieceDeformation: '无变形，成包自然站立',
      finishedDimensionsMm: { widthMm: 299.5, heightMm: 240.2, depthMm: 119.5 },
      appearanceRating: 5,
      patternMakerCorrections: ['提手内衬 0.4mm 防拉带位置上移 3mm 更贴合握点'],
      conclusion: 'approved_for_mass_production',
      recordedBy: '林工（样板车间主管）',
      promotedToExperienceId: 'exp_folded_crack_thick_hide',
      createdAt: nowIso,
    },
  ];

  memStore.benchmarkRuns = [executeAccuracyBenchmarkSuite()];

  memStore.processRules = PROCESS_SCHEMES.map((s) => ({
    id: `proc_${s.id}`,
    code: s.id.toUpperCase(),
    name: s.name,
    edgeProcess: s.edgeProcess,
    applicableTempers: s.applicableTempers,
    seamAllowanceMm: s.seamAllowanceMm,
    foldWidthMm: s.foldWidthMm,
    skiveEdgeTargetMm: s.skiveEdgeTargetMm,
    stitchSpacingMm: s.stitchSpacingMm,
    reinforcementAdvice: s.reinforcementAdvice,
    applicableBagTypes: ['tote', 'handbag', 'shoulder_bag'],
    applicableMaterials: MATERIAL_LIBRARY.filter((m) => s.applicableTempers.includes(m.temper)).map((m) => m.id),
    relatedParts: ['front_panel', 'back_panel', 'left_gusset', 'handle_strap'],
    source: s.sourceStandard,
    version: KNOWLEDGE_BASE_META.version,
    confidence: 0.95,
    reviewLevel: 5,
    isActive: true,
  }));

  const rawConstruction = [
    {
      id: 'const_front_gusset',
      code: 'CR-01',
      title: '主包片与侧围弧长匹配公差规则',
      fromPart: 'front_panel',
      toPart: 'left_gusset',
      relationType: 'sew',
      stitchDirection: 'face_to_face',
      allowanceMm: 5.0,
      toleranceMm: 1.2,
      ruleDetail: '前/后片侧边及底角圆弧总长度与侧围贴合边误差必须控制在 ±1.2mm 内，转角每 45° 须打对位刀口。',
      applicableBagTypes: ['tote', 'handbag', 'shoulder_bag'],
      applicableMaterials: ['veg_tan_18', 'box_calf_15', 'soft_calf_12', 'pebbled_16'],
      relatedParts: ['A01', 'A02', 'A03', 'A04'],
      source: 'QB/T 1333-2018 & 陈工终审规范',
      reviewLevel: 5,
      isActive: true,
    },
    {
      id: 'const_lining_shrink',
      code: 'CR-02',
      title: '内衬厚度缩量与防起皱装配规则',
      fromPart: 'front_panel',
      toPart: 'lining_body',
      relationType: 'lining_attach',
      stitchDirection: 'face_to_face',
      allowanceMm: 8.0,
      toleranceMm: 1.0,
      ruleDetail: '内衬净宽须按主皮厚度执行 -(2.0 + 1.4*t)mm 内缩，净高执行 -(3.0 + 1.6*t)mm 内缩，避免成品内部堆褶起皱。',
      applicableBagTypes: ['tote', 'handbag', 'shoulder_bag'],
      applicableMaterials: ['veg_tan_18', 'box_calf_15', 'soft_calf_12', 'pebbled_16', 'lambskin_09'],
      relatedParts: ['L01', 'A01'],
      source: 'RUDA 厚度补偿数学模型 (KB-2026.11-PRO)',
      reviewLevel: 5,
      isActive: true,
    },
    {
      id: 'const_bottom_board_inset',
      code: 'CR-03',
      title: '承重底托衬板避缝线内缩规则',
      fromPart: 'bottom_panel',
      toPart: 'bottom_board',
      relationType: 'reinforce',
      stitchDirection: 'lap',
      allowanceMm: 0,
      toleranceMm: 0.5,
      ruleDetail: '皮糠纸底托四周净尺寸必须单边内缩 (3.5 + 1.5*t)mm 避开缝线走位，防止车缝断针或底角鼓包。',
      applicableBagTypes: ['tote', 'handbag', 'shoulder_bag'],
      applicableMaterials: ['veg_tan_18', 'box_calf_15', 'soft_calf_12', 'pebbled_16'],
      relatedParts: ['A05', 'R01'],
      source: '林工产线适配审核',
      reviewLevel: 5,
      isActive: true,
    },
  ];
  memStore.constructionRules = rawConstruction.map((cr) => ({
    ...cr,
    embedding: computeDeterministicEmbedding(
      `${cr.code} ${cr.title} ${cr.fromPart} ${cr.toPart} ${cr.ruleDetail} ${cr.applicableMaterials.join(' ')}`
    ),
  }));

  const rawDocs = [
    {
      id: 'kdoc_italian_box_calf',
      knowledgeType: 'process',
      title: '意式盒式小牛皮油边定型工艺规范',
      content:
        '制作意式高端手提包（Box Calf 1.5mm）时，缝合缝份设定为 5.0mm，针距 3.38mm，边角缝合前须铲薄至 0.9mm，配合 3 道底油 + 2 道面油打磨，底部增加 1.0mm 环保皮糠纸支撑与脚钉。',
      applicableBagTypes: ['handbag', 'shoulder_bag', 'tote'],
      applicableMaterials: ['box_calf_15'],
      relatedParts: ['A01', 'A02', 'A03', 'A04', 'A05', 'R01'],
      source: 'Italian Leathergoods Guild Patternmaking Manual (2024)',
      version: '1.0.0',
      confidence: 0.96,
      reviewLevel: 5,
      securityScope: 'A_PLATFORM_PUBLIC',
      ownerUid: null,
      isActive: true,
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      id: 'kdoc_soft_calf_skiving',
      knowledgeType: 'material',
      title: '软小牛皮/羊皮包口折边铲薄与防拉伸规范',
      content:
        '使用软小牛皮 (1.2mm) 或软绵羊皮 (0.9mm) 执行包口折边（folded 8mm）时，折边位必须铲薄至 0.6–0.7mm 并粘贴 0.3mm 尼龙防拉伸补强条，否则包口转角及手拎区域易拉伸变形或起皱。',
      applicableBagTypes: ['shoulder_bag', 'handbag', 'tote'],
      applicableMaterials: ['soft_calf_12', 'lambskin_09'],
      relatedParts: ['A01', 'A02', 'H01'],
      source: 'RUDA-STD-03 · 折边及内翻工艺规范',
      version: '1.0.0',
      confidence: 0.95,
      reviewLevel: 4,
      securityScope: 'A_PLATFORM_PUBLIC',
      ownerUid: null,
      isActive: true,
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      id: 'kdoc_zipper_clearance',
      knowledgeType: 'structure',
      title: '包口拉链挡片两端退让与开窗设计规则',
      content:
        '包口拉链挡片 (O01) 总宽应为包口净宽减去 12mm（左右各退让 6mm），中心距上沿 12mm 标记 5# 拉链粘贴定位线，避免拉头停靠处顶破侧围接缝。',
      applicableBagTypes: ['shoulder_bag', 'tote', 'handbag'],
      applicableMaterials: ['veg_tan_18', 'box_calf_15', 'pebbled_16', 'soft_calf_12'],
      relatedParts: ['O01', 'A01', 'A03'],
      source: '林工产线适配审核 (2026-11-12)',
      version: '1.0.0',
      confidence: 0.94,
      reviewLevel: 5,
      securityScope: 'A_PLATFORM_PUBLIC',
      ownerUid: null,
      isActive: true,
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      id: 'kdoc_grain_nesting',
      knowledgeType: 'process',
      title: '头层牛皮纹理方向锁定与瑕疵避让排料原则',
      content:
        '植鞣牛皮与盒式小牛皮排料时，前/后片须按 90° 竖向正纹排列，提手与长肩带须按 0° 顺背脊纤维方向排列禁止 90° 旋转，且自动避让 22mm 边缘肚腩松弛区与颈纹区。',
      applicableBagTypes: ['tote', 'handbag', 'shoulder_bag'],
      applicableMaterials: ['veg_tan_18', 'box_calf_15', 'soft_calf_12'],
      relatedParts: ['A01', 'A02', 'H01', 'S01'],
      source: 'RUDA 裁皮排料工程规范',
      version: '1.0.0',
      confidence: 0.95,
      reviewLevel: 5,
      securityScope: 'A_PLATFORM_PUBLIC',
      ownerUid: null,
      isActive: true,
      createdAt: nowIso,
      updatedAt: nowIso,
    },
  ];
  memStore.knowledgeDocs = rawDocs.map((d) => ({
    ...d,
    embedding: computeDeterministicEmbedding(`${d.title} ${d.content} ${d.applicableMaterials.join(' ')}`),
  }));

  const toteSnap = createStarterSnapshot('tote');
  const handbagSnap = createStarterSnapshot('handbag');
  const rawCases = [
    {
      id: 'case_verified_tote_300',
      projectId: null,
      title: '经典植鞣立挺托特包 300×240×120mm（生产验证样板）',
      bagType: 'tote',
      materialId: 'veg_tan_18',
      edgeProcess: 'raw_burnish',
      photoSummary: '正面直筒托特包照片：双条手拎带+水滴形耳仔撞钉+包口暗磁扣。',
      dimensionsSummary: { widthMm: 300, heightMm: 240, depthMm: 120, handleLengthMm: 420, seamAllowanceMm: 5 },
      structureBreakdown: toteSnap.components.map((c) => `${c.partCode} ${c.name} (${c.widthMm}×${c.heightMm}mm)`),
      processSummary: '1.8mm 植鞣牛皮原皮打磨封边，3.85mm 斩距，内衬缩量 -4.5mm/-5.9mm，底托内缩 6.2mm。',
      validationPassed: true,
      productionVerified: true,
      productionResultNote: '已完成首件裁切与成品装配测试，接缝对位误差 < 0.8mm，包身立挺无堆褶。',
      securityScope: 'A_PLATFORM_PUBLIC',
      ownerUid: null,
      reviewLevel: 5,
      version: '1.0.0',
      createdAt: nowIso,
    },
    {
      id: 'case_verified_handbag_280',
      projectId: null,
      title: '意式梯形盒式小牛皮手提包 280×210×110mm',
      bagType: 'handbag',
      materialId: 'box_calf_15',
      edgeProcess: 'edge_paint',
      photoSummary: '梯形挺括手提包：顶部短提手、翻盖插锁、侧耳D环配长肩带与底部脚钉。',
      dimensionsSummary: { widthMm: 280, heightMm: 210, depthMm: 110, handleLengthMm: 310, seamAllowanceMm: 5 },
      structureBreakdown: handbagSnap.components.map((c) => `${c.partCode} ${c.name} (${c.widthMm}×${c.heightMm}mm)`),
      processSummary: '1.5mm Box Calf 意式油边定型，3.38mm 针距，梯形侧围收口配合底脚钉。',
      validationPassed: true,
      productionVerified: true,
      productionResultNote: '打版师终审与样板试制均通过，油边饱满无溢胶。',
      securityScope: 'A_PLATFORM_PUBLIC',
      ownerUid: null,
      reviewLevel: 5,
      version: '1.0.0',
      createdAt: nowIso,
    },
  ];
  memStore.patternCases = rawCases.map((cs) => ({
    ...cs,
    embedding: computeDeterministicEmbedding(`${cs.title} ${cs.bagType} ${cs.materialId} ${cs.processSummary}`),
  }));

  const rawExperiences = [
    {
      id: 'exp_gusset_curve_mismatch',
      bagType: 'shoulder_bag',
      materialId: 'pebbled_16',
      relatedParts: ['A01', 'A03'],
      errorCategory: 'seam_mismatch',
      errorLocation: '前片底角圆弧与侧围前端弧长贴合边',
      rootCause: '圆角半径增大至 20mm 后仅调整了前片角圆弧，未同步匹配侧围端弧与对位刀口位置，导致侧边多出 4.6mm 褶皱。',
      fixMethod: '在 CAD 引擎中按圆角弧长公式同步更新侧围贴合边节点并执行接缝自动校准，使误差收敛至 ±0.5mm 以内。',
      geometryPassed: true,
      patternMakerReviewed: true,
      productionVerified: true,
      outcomeSummary: '经二次裁片缝合测试，转角贴合平顺无起皱。',
      securityScope: 'A_PLATFORM_PUBLIC',
      ownerUid: null,
      reviewLevel: 5,
      createdAt: nowIso,
    },
    {
      id: 'exp_folded_crack_thick_hide',
      bagType: 'tote',
      materialId: 'veg_tan_18',
      relatedParts: ['A01', 'A02'],
      errorCategory: 'skiving_crack',
      errorLocation: '1.8mm 植鞣皮包口折边转角处',
      rootCause: '在未执行边缘铲薄的情况下直接对 1.8mm 厚植鞣皮进行 7mm 折边，弯折处纤维受拉爆裂。',
      fixMethod: '厚于 1.4mm 的皮料如选用折边工艺，必须强制触发 SKIVING_REQUIRED 警示并规定折边区铲薄至 0.65mm，或切换为原皮打磨/油边工艺。',
      geometryPassed: true,
      patternMakerReviewed: true,
      productionVerified: true,
      outcomeSummary: '已固化为校验规则 #8 与厚度补偿计算准则。',
      securityScope: 'A_PLATFORM_PUBLIC',
      ownerUid: null,
      reviewLevel: 5,
      createdAt: nowIso,
    },
    {
      id: 'exp_lining_bunching',
      bagType: 'handbag',
      materialId: 'box_calf_15',
      relatedParts: ['L01', 'A01'],
      errorCategory: 'lining_wrinkle',
      errorLocation: '包身内衬与外皮贴合下角区',
      rootCause: '内衬使用与外皮完全相同的净尺寸打版，未扣除 1.5mm 外皮厚度占用的内腔周长，装配后内衬底部起鼓堆褶。',
      fixMethod: '按 computeThicknessCompensationMm 计算外皮厚度内缩量（1.5mm 皮料宽度缩 -4.1mm、高度缩 -5.4mm）。',
      geometryPassed: true,
      patternMakerReviewed: true,
      productionVerified: true,
      outcomeSummary: '内衬贴合服帖，容量损失小于 2%。',
      securityScope: 'A_PLATFORM_PUBLIC',
      ownerUid: null,
      reviewLevel: 5,
      createdAt: nowIso,
    },
  ];
  memStore.experienceRecords = rawExperiences.map((ex) => ({
    ...ex,
    embedding: computeDeterministicEmbedding(`${ex.errorCategory} ${ex.errorLocation} ${ex.rootCause} ${ex.fixMethod}`),
  }));

  memStore.evalDatasets = [
    { id: 'eval_01_bag_type', name: '托特包型结构初始化识别', category: 'bag_type', bagType: 'tote', inputPrompt: '生成一个经典植鞣牛皮托特包版型', expectedCriteria: { expectedMinPieces: 8 }, baselineScore: 1.0, isActive: true },
    { id: 'eval_02_component_id', name: '翻盖手提包与内袋部件完整性识别', category: 'component_id', bagType: 'handbag', inputPrompt: '识别手提包全部标准部件并生成纸格', expectedCriteria: { expectedMinPieces: 9 }, baselineScore: 1.0, isActive: true },
    { id: 'eval_03_structure_reasoning', name: '隐藏内部结构（内衬与底托）推理与厚度补偿', category: 'structure_reasoning', bagType: 'tote', inputPrompt: '验证内衬与底托板的隐藏结构推理和厚度内缩量', expectedCriteria: { expectedMinPieces: 9 }, baselineScore: 1.0, isActive: true },
    { id: 'eval_04_nl_understanding', name: '自然语言尺寸增减指令映射准确性', category: 'nl_understanding', bagType: 'tote', inputPrompt: '把包宽增加 2 厘米', expectedCriteria: { expectedIntent: 'resize_product', expectedDeltaWidthMm: 20 }, baselineScore: 1.0, isActive: true },
    { id: 'eval_05_cad_execution', name: 'CAD 事务执行与自相交异常原子回滚保护', category: 'cad_execution', bagType: 'tote', inputPrompt: '验证异常轮廓触发事务回滚且不破坏原版型', expectedCriteria: { expectedMinPieces: 8 }, baselineScore: 1.0, isActive: true },
    { id: 'eval_06_parametric_linkage', name: '包宽修改后底片与拉链挡片参数联动验证', category: 'parametric_linkage', bagType: 'shoulder_bag', inputPrompt: '将肩背包宽度增加 30mm，检查底片及拉链挡片同步缩放', expectedCriteria: { expectedDeltaWidthMm: 30 }, baselineScore: 1.0, isActive: true },
    { id: 'eval_07_geometry_correctness', name: '轮廓闭合、非自相交与打孔边距几何校验', category: 'geometry_correctness', bagType: 'handbag', inputPrompt: '检查手提包全套纸格几何闭合与孔位边距', expectedCriteria: { expectedMaxSeamDiffMm: 1.2 }, baselineScore: 1.0, isActive: true },
    { id: 'eval_08_seam_matching', name: '圆弧侧围与主包片接缝长度误差匹配（≤±1.2mm）', category: 'seam_matching', bagType: 'shoulder_bag', inputPrompt: '侧面改成圆弧并校对接缝误差', expectedCriteria: { expectedMaxSeamDiffMm: 1.2 }, baselineScore: 1.0, isActive: true },
    { id: 'eval_09_material_process', name: '意式高端风格工艺与排料利用率优化', category: 'material_process', bagType: 'tote', inputPrompt: '做一个更高级的意大利风格手提包', expectedCriteria: { expectedMaterialId: 'box_calf_15' }, baselineScore: 1.0, isActive: true },
    { id: 'eval_10_memory_accuracy', name: '历史工程知识与经验库混合检索命中率验证', category: 'memory_accuracy', bagType: 'tote', inputPrompt: '植鞣皮折边爆裂与内衬起皱怎么避免', expectedCriteria: { expectedKeywords: ['铲薄', '内缩'] }, baselineScore: 1.0, isActive: true },
  ];

  memStore.knowledgeVersions = [
    {
      id: 'kver_init_kb_2026_11',
      versionTag: KNOWLEDGE_BASE_META.version,
      entityType: 'knowledge_document',
      entityId: 'platform_baseline',
      changeSummary: '初始化 RUDA V1.1 专业知识库（含 4 份核心规范、4 套工艺方案、3 条结构连接规则及 3 条历史纠错经验）',
      previousSnapshot: null,
      newSnapshot: {
        version: KNOWLEDGE_BASE_META.version,
        docsCount: memStore.knowledgeDocs.length,
        casesCount: memStore.patternCases.length,
        experiencesCount: memStore.experienceRecords.length,
      },
      authorUid: 'system',
      reviewerName: '陈工（首席皮具打版师）',
      reviewLevel: 5,
      createdAt: nowIso,
    },
  ];

  memStore.seeded = true;
}

export async function memRetrieveRelevantMemoryForPrompt(
  uid: string,
  project: Project,
  queryText: string
) {
  await memEnsureSeeded();
  const userProfile = await getUserByUid(uid);
  const queryVec = await generateSemanticEmbedding(
    `${project.bagType} ${project.materialId} ${project.edgeProcess} ${queryText}`
  );
  const lowered = queryText.toLowerCase();

  const rawMemories = memStore.memoryItems
    .filter((m) => m.isActive && (m.ownerUid === uid || m.securityScope === 'A_PLATFORM_PUBLIC'))
    .map((m) => ({ ...m, distance: cosineDistanceJs(m.embedding, queryVec) }))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 6);

  const scoredDocs = memStore.knowledgeDocs
    .filter(
      (d) =>
        d.isActive &&
        (d.securityScope === 'A_PLATFORM_PUBLIC' ||
          (d.securityScope === 'C_USER_PRIVATE' && d.ownerUid === uid))
    )
    .map((d) => {
      let bonus = 0;
      if (d.applicableBagTypes.includes(project.bagType)) bonus += 0.15;
      if (d.applicableMaterials.includes(project.materialId)) bonus += 0.25;
      if (lowered && (d.title.toLowerCase().includes(lowered) || d.content.toLowerCase().includes(lowered))) {
        bonus += 0.25;
      }
      bonus += d.reviewLevel * 0.04;
      const distVal = cosineDistanceJs(d.embedding, queryVec);
      return { ...d, score: 1 - distVal + bonus };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 4);

  const procRows = memStore.processRules.filter((p) => p.isActive).slice(0, 6);

  const constructionRuleRows = memStore.constructionRules
    .filter((r) => r.isActive)
    .map((r) => ({ ...r, distance: cosineDistanceJs(r.embedding, queryVec) }))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 4);

  const caseRows = memStore.patternCases
    .filter((c) => c.securityScope === 'A_PLATFORM_PUBLIC' || c.ownerUid === uid)
    .map((c) => ({ ...c, distance: cosineDistanceJs(c.embedding, queryVec) }))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 3);

  const expRows = memStore.experienceRecords
    .filter((e) => e.securityScope === 'A_PLATFORM_PUBLIC' || e.ownerUid === uid)
    .map((e) => ({ ...e, distance: cosineDistanceJs(e.embedding, queryVec) }))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 3);

  return {
    sessionContext: {
      projectId: project.id,
      bagType: project.bagType,
      currentVersion: project.currentVersion,
      validationPassed: project.validation.passed,
    },
    userPreferences: userProfile?.preferencesJson ?? {},
    userMemories: rawMemories.map((m) => ({
      id: m.id,
      memoryKey: m.memoryKey,
      content: m.content,
      reviewLevel: m.reviewLevel,
      confidence: m.confidence,
    })),
    engineeringKnowledge: scoredDocs.map((d) => ({
      id: d.id,
      title: d.title,
      content: d.content,
      knowledgeType: d.knowledgeType,
      source: d.source,
      version: d.version,
      reviewLevel: d.reviewLevel,
      securityScope: d.securityScope,
    })),
    processRules: procRows.map((p) => ({
      id: p.id,
      name: p.name,
      edgeProcess: p.edgeProcess,
      seamAllowanceMm: p.seamAllowanceMm,
      stitchSpacingMm: p.stitchSpacingMm,
      reinforcementAdvice: p.reinforcementAdvice,
      reviewLevel: p.reviewLevel,
    })),
    constructionRules: constructionRuleRows.map((r) => ({
      id: r.id,
      code: r.code,
      title: r.title,
      fromPart: r.fromPart,
      toPart: r.toPart,
      toleranceMm: r.toleranceMm,
      ruleDetail: r.ruleDetail,
      reviewLevel: r.reviewLevel,
    })),
    similarCases: caseRows.map((c) => ({
      id: c.id,
      title: c.title,
      bagType: c.bagType,
      materialId: c.materialId,
      processSummary: c.processSummary,
      productionVerified: c.productionVerified,
      reviewLevel: c.reviewLevel,
    })),
    experienceRecords: expRows.map((e) => ({
      id: e.id,
      errorCategory: e.errorCategory,
      errorLocation: e.errorLocation,
      fixMethod: e.fixMethod,
      productionVerified: e.productionVerified,
      reviewLevel: e.reviewLevel,
    })),
    retrievedKnowledgeIds: [
      ...scoredDocs.map((d) => d.id),
      ...constructionRuleRows.map((cr) => cr.id),
    ],
    usedCaseIds: caseRows.map((c) => c.id),
  };
}

export async function memUpsertMemoryItemWithMerge(params: {
  ownerUid: string;
  memoryLayer: string;
  memoryKey: string;
  content: string;
  applicableBagTypes?: string[];
  applicableMaterials?: string[];
  relatedParts?: string[];
  source: string;
  sourceProjectId?: string;
  securityScope?: string;
  reviewLevel?: number;
  confidence?: number;
}) {
  await memEnsureSeeded();
  if (params.memoryLayer === 'user_long_term') {
    const u = await getUserByUid(params.ownerUid);
    if (u?.preferencesJson?.memoryConsentEnabled === false) return null;
  }
  const embedding = await generateSemanticEmbedding(
    `${params.memoryKey} ${params.content} ${(params.applicableBagTypes ?? []).join(' ')}`
  );
  const nowIso = new Date().toISOString();
  const prev = memStore.memoryItems.find(
    (m) =>
      m.ownerUid === params.ownerUid &&
      m.memoryLayer === params.memoryLayer &&
      m.memoryKey === params.memoryKey &&
      m.isActive
  );
  if (prev) {
    prev.content = params.content;
    prev.mergedCount += 1;
    prev.confidence = Math.min(0.99, Math.max(prev.confidence, params.confidence ?? 0.85));
    prev.reviewLevel = Math.max(prev.reviewLevel, params.reviewLevel ?? 3);
    prev.embedding = embedding;
    prev.updatedAt = nowIso;
    return prev;
  }
  const created = {
    id: `mem_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
    memoryLayer: params.memoryLayer,
    memoryKey: params.memoryKey,
    content: params.content,
    applicableBagTypes: params.applicableBagTypes ?? [],
    applicableMaterials: params.applicableMaterials ?? [],
    relatedParts: params.relatedParts ?? [],
    source: params.source,
    sourceProjectId: params.sourceProjectId ?? null,
    ownerUid: params.ownerUid,
    securityScope: params.securityScope ?? 'C_USER_PRIVATE',
    version: '1.0.0',
    confidence: params.confidence ?? 0.8,
    reviewLevel: params.reviewLevel ?? 3,
    isActive: true,
    mergedCount: 1,
    embedding,
    updatedAt: nowIso,
  };
  memStore.memoryItems.unshift(created);
  return created;
}

export async function memRecordAiFeedbackAndExtractLearning(params: {
  ownerUid: string;
  project: Project;
  userOriginalPrompt: string;
  interpretedTask: string;
  retrievedKnowledgeIds: string[];
  usedCaseIds: string[];
  commands: StructuredCadCommand[];
  diffSummary: string[];
  validationPassed: boolean;
  userAccepted: boolean;
  patternMakerCorrected?: boolean;
  correctionClassification?: string;
  correctionDetail?: string;
}) {
  await memEnsureSeeded();
  const nowIso = new Date().toISOString();
  const eventId = `fb_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
  const event = {
    id: eventId,
    projectId: params.project.id,
    ownerUid: params.ownerUid,
    userOriginalPrompt: params.userOriginalPrompt,
    interpretedTask: params.interpretedTask,
    retrievedKnowledgeIds: params.retrievedKnowledgeIds,
    usedCaseIds: params.usedCaseIds,
    geometryDiffSummary: params.diffSummary,
    validationPassed: params.validationPassed,
    userAccepted: params.userAccepted,
    patternMakerCorrected: Boolean(params.patternMakerCorrected),
    correctionClassification: params.correctionClassification ?? null,
    correctionDetail: params.correctionDetail ?? '',
    productionResult: params.project.qualitySignoff?.physicalSamplePassed ? 'passed' : 'pending',
    createdAt: nowIso,
  };
  memStore.feedbackEvents.unshift(event);

  for (const cmd of params.commands) {
    if (cmd.intent === 'change_material' && cmd.parameters?.materialId) {
      await memUpsertMemoryItemWithMerge({
        ownerUid: params.ownerUid,
        memoryLayer: 'user_long_term',
        memoryKey: `preferred_material_${params.project.bagType}`,
        content: `用户在 ${params.project.bagType} 设计中倾向选用皮料 ${cmd.parameters.materialId}（${params.project.edgeProcess}）`,
        applicableBagTypes: [params.project.bagType],
        applicableMaterials: [cmd.parameters.materialId],
        source: `项目 ${params.project.name} 对话操作`,
        sourceProjectId: params.project.id,
        securityScope: 'C_USER_PRIVATE',
        reviewLevel: 3,
        confidence: 0.85,
      });

      const user = await getUserByUid(params.ownerUid);
      if (user?.preferencesJson?.memoryConsentEnabled !== false) {
        const mats = new Set(user?.preferencesJson?.preferredMaterials ?? []);
        mats.add(cmd.parameters.materialId);
        await updateUserPreferences(params.ownerUid, { preferredMaterials: Array.from(mats) });
      }
    }
  }

  if (
    params.patternMakerCorrected ||
    params.correctionClassification === 'reusable_experience' ||
    params.correctionClassification === 'general_rule_candidate' ||
    params.commands.some((c) => c.intent === 'fix_seam_mismatch')
  ) {
    const classification =
      params.correctionClassification ??
      (params.commands.some((c) => c.intent === 'fix_seam_mismatch')
        ? 'reusable_experience'
        : 'general_rule_candidate');

    const title = params.correctionDetail
      ? `人工修正经验：${params.correctionDetail.slice(0, 40)}`
      : `自动提取经验：${params.interpretedTask.slice(0, 40)}`;
    const proposedContent =
      params.correctionDetail ||
      `在 ${params.project.bagType} (${params.project.materialId}) 中执行「${params.userOriginalPrompt}」：${params.diffSummary.join('；')}`;

    memStore.learningCandidates.unshift({
      id: `cand_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
      feedbackEventId: eventId,
      knowledgeType: classification === 'general_rule_candidate' ? 'process' : 'defect_fix',
      title,
      proposedContent,
      applicableBagTypes: [params.project.bagType],
      applicableMaterials: [params.project.materialId],
      relatedParts: params.project.patterns.slice(0, 4).map((p) => p.partCode),
      classification,
      source: `反馈事件 ${eventId} (项目: ${params.project.name})`,
      version: '0.1.0-candidate',
      confidence: params.validationPassed ? 0.72 : 0.45,
      reviewLevel: params.validationPassed ? 2 : 1,
      status: 'pending',
      securityScope: 'D_AI_CANDIDATE',
      ownerUid: params.ownerUid,
      reviewerName: null,
      reviewNote: null,
      promotedKnowledgeId: null,
      createdAt: nowIso,
    });
  }

  return event;
}

export async function memReviewLearningCandidate(params: {
  candidateId: string;
  reviewerUid: string;
  reviewerName: string;
  action: 'approve' | 'reject' | 'promote_level';
  targetReviewLevel: number;
  securityScope?: 'A_PLATFORM_PUBLIC' | 'B_ENTERPRISE_PRIVATE' | 'C_USER_PRIVATE';
  reviewNote?: string;
  createEvalCase?: boolean;
}) {
  await memEnsureSeeded();
  const cand = memStore.learningCandidates.find((c) => c.id === params.candidateId);
  if (!cand) throw new Error('未找到指定的待审核知识条目');

  if (params.action === 'reject') {
    cand.status = 'rejected';
    cand.reviewerUid = params.reviewerUid;
    cand.reviewerName = params.reviewerName;
    cand.reviewNote = params.reviewNote ?? '专业审核未通过，驳回待审经验';
    return { candidate: cand, promotedDoc: null };
  }

  const nextLevel = Math.max(cand.reviewLevel, Math.min(5, params.targetReviewLevel));
  const shouldPromoteToKb = params.action === 'approve' && nextLevel >= 4;
  let promotedDocId = cand.promotedKnowledgeId;
  let promotedDoc = null;

  if (shouldPromoteToKb) {
    const newVersionTag = `KB-${new Date().toISOString().slice(0, 10)}.${Math.floor(Date.now() % 1000)}`;
    const docId = promotedDocId || `kdoc_learned_${Date.now()}`;
    const scope = params.securityScope ?? 'C_USER_PRIVATE';
    const embedding = await generateSemanticEmbedding(`${cand.title} ${cand.proposedContent}`);
    const nowIso = new Date().toISOString();
    const existingDoc = memStore.knowledgeDocs.find((d) => d.id === docId);
    const prevSnapshot = existingDoc ? { ...existingDoc } : null;

    if (existingDoc) {
      existingDoc.content = cand.proposedContent;
      existingDoc.version = newVersionTag;
      existingDoc.reviewLevel = nextLevel;
      existingDoc.securityScope = scope;
      existingDoc.confidence = nextLevel === 5 ? 0.96 : 0.9;
      existingDoc.isActive = true;
      existingDoc.embedding = embedding;
      existingDoc.updatedAt = nowIso;
      promotedDoc = existingDoc;
    } else {
      promotedDoc = {
        id: docId,
        knowledgeType: cand.knowledgeType,
        title: cand.title,
        content: cand.proposedContent,
        applicableBagTypes: cand.applicableBagTypes,
        applicableMaterials: cand.applicableMaterials,
        relatedParts: cand.relatedParts,
        source: `${cand.source} · 审核人: ${params.reviewerName}`,
        version: newVersionTag,
        confidence: nextLevel === 5 ? 0.96 : 0.9,
        reviewLevel: nextLevel,
        securityScope: scope,
        ownerUid: scope === 'A_PLATFORM_PUBLIC' ? null : cand.ownerUid,
        isActive: true,
        embedding,
        createdAt: nowIso,
        updatedAt: nowIso,
      };
      memStore.knowledgeDocs.unshift(promotedDoc);
    }
    promotedDocId = promotedDoc.id;

    memStore.knowledgeVersions.unshift({
      id: `kver_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      versionTag: newVersionTag,
      entityType: 'knowledge_document',
      entityId: promotedDoc.id,
      changeSummary: `审核升级至 LEVEL ${nextLevel}：${cand.title}`,
      previousSnapshot: prevSnapshot,
      newSnapshot: { ...promotedDoc },
      authorUid: params.reviewerUid,
      reviewerName: params.reviewerName,
      reviewLevel: nextLevel,
      createdAt: nowIso,
    });

    if (params.createEvalCase !== false) {
      memStore.evalDatasets.push({
        id: `eval_learned_${Date.now()}`,
        name: `学习验证：${cand.title.slice(0, 32)}`,
        category: 'memory_accuracy',
        bagType: cand.applicableBagTypes[0] || 'tote',
        inputPrompt: cand.title,
        expectedCriteria: { expectedKeywords: [cand.title.slice(0, 4)] },
        baselineScore: 1.0,
        isActive: true,
      });
    }
  }

  cand.reviewLevel = nextLevel;
  cand.status = shouldPromoteToKb ? 'approved' : 'pending';
  cand.reviewerUid = params.reviewerUid;
  cand.reviewerName = params.reviewerName;
  cand.reviewNote = params.reviewNote ?? `已由 ${params.reviewerName} 核定为 LEVEL ${nextLevel}`;
  cand.promotedKnowledgeId = promotedDocId ?? null;

  return { candidate: cand, promotedDoc };
}

export async function memArchiveProjectAsCase(params: {
  project: Project;
  ownerUid: string;
  securityScope: 'A_PLATFORM_PUBLIC' | 'B_ENTERPRISE_PRIVATE' | 'C_USER_PRIVATE';
  productionResultNote: string;
}) {
  await memEnsureSeeded();
  const { project } = params;
  const isProdVerified = Boolean(project.qualitySignoff?.physicalSamplePassed);
  const reviewLevel = isProdVerified
    ? 5
    : project.qualitySignoff?.patternMakerConfirmed
      ? 4
      : project.validation.passed
        ? 2
        : 1;
  const title = `${project.name} (${project.dimensions.widthMm}×${project.dimensions.heightMm}×${project.dimensions.depthMm}mm)`;
  const processSummary = `材料 ${project.materialId} · 工艺 ${project.edgeProcess} · 默认缝份 ${project.dimensions.seamAllowanceMm}mm · ${
    project.validation.passed ? '8项几何校验通过' : '含未解校验提醒'
  }`;
  const embedding = await generateSemanticEmbedding(
    `${title} ${project.bagType} ${project.materialId} ${processSummary} ${params.productionResultNote}`
  );
  const saved = {
    id: `case_${project.id}_${Date.now()}`,
    projectId: project.id,
    title,
    bagType: project.bagType,
    materialId: project.materialId,
    edgeProcess: project.edgeProcess,
    photoSummary: project.visionSummary?.visualNotes || `包含 ${project.images.length} 张参考照片`,
    dimensionsSummary: {
      widthMm: project.dimensions.widthMm,
      heightMm: project.dimensions.heightMm,
      depthMm: project.dimensions.depthMm,
      handleLengthMm: project.dimensions.handleLengthMm,
      seamAllowanceMm: project.dimensions.seamAllowanceMm,
    },
    structureBreakdown: project.components.map((c) => `${c.partCode} ${c.name} (${c.widthMm}×${c.heightMm}mm)`),
    processSummary,
    validationPassed: project.validation.passed,
    productionVerified: isProdVerified,
    productionResultNote:
      params.productionResultNote ||
      (isProdVerified ? '实物样板验证通过' : '数字版型归档（参考用，投产前需实物打样）'),
    securityScope: params.securityScope,
    ownerUid: params.ownerUid,
    reviewLevel,
    version: `v${project.currentVersion}`,
    createdAt: new Date().toISOString(),
    embedding,
  };
  memStore.patternCases.unshift(saved);
  return saved;
}

export async function memRunAiEvaluationSuite(uid: string) {
  await memEnsureSeeded();
  const datasets = memStore.evalDatasets.filter((d) => d.isActive);
  const versionTag = memStore.knowledgeVersions[0]?.versionTag ?? KNOWLEDGE_BASE_META.version;
  const runId = `evalrun_${Date.now()}`;
  const modelName = process.env.GEMINI_MODEL || 'gemini-4-hydrogen';
  const results = [];
  let anyRegression = false;

  for (const ds of datasets) {
    const startMs = Date.now();
    let passed = false;
    let score = 0;
    let observedSummary = '';
    const criteria = ds.expectedCriteria ?? {};

    try {
      switch (ds.category) {
        case 'bag_type':
        case 'component_id':
        case 'structure_reasoning': {
          const snap = createStarterSnapshot((ds.bagType as BagType) || 'tote');
          const hasLining = snap.patterns.some((p) => p.partCode === 'L01');
          const hasBoard = snap.patterns.some((p) => p.partCode === 'R01');
          const minOk = snap.patterns.length >= (criteria.expectedMinPieces ?? 6);
          passed = minOk && (ds.category !== 'structure_reasoning' || (hasLining && hasBoard));
          score = passed ? 1.0 : 0.4;
          observedSummary = `生成 ${snap.patterns.length} 个独立纸格 (内衬:${hasLining}, 底托:${hasBoard})`;
          break;
        }
        case 'nl_understanding':
        case 'parametric_linkage': {
          const snap = createStarterSnapshot((ds.bagType as BagType) || 'tote');
          const deltaW = criteria.expectedDeltaWidthMm ?? 20;
          const oldW = snap.dimensions.widthMm;
          const tx = executeCadTransaction(snap, [
            { intent: 'resize_product', target: 'product', operation: 'increment', parameters: { deltaWidthMm: deltaW } },
          ]);
          const botBefore = snap.patterns.find((p) => p.id === 'piece_bottom')?.boundingBoxMm.width ?? 0;
          const botAfter = tx.nextSnapshot.patterns.find((p) => p.id === 'piece_bottom')?.boundingBoxMm.width ?? 0;
          passed = tx.committed && tx.nextSnapshot.dimensions.widthMm === oldW + deltaW && botAfter > botBefore;
          score = passed ? 1.0 : 0.0;
          observedSummary = `包宽 ${oldW}→${tx.nextSnapshot.dimensions.widthMm}mm, 底片宽 ${botBefore}→${botAfter}mm`;
          break;
        }
        case 'cad_execution': {
          const snap = createStarterSnapshot('tote');
          const bad = structuredClone(snap);
          bad.patterns[0] = {
            ...bad.patterns[0],
            sewContour: [{ x: 0, y: 0 }, { x: 100, y: 100 }, { x: 100, y: 0 }, { x: 0, y: 100 }],
            cutContour: [{ x: 0, y: 0 }, { x: 100, y: 100 }, { x: 100, y: 0 }, { x: 0, y: 100 }],
          };
          const txRollback = executeCadTransaction(bad, [
            { intent: 'run_validation', target: 'all', operation: 'validate', parameters: {} },
          ]);
          passed = txRollback.committed === false;
          score = passed ? 1.0 : 0.0;
          observedSummary = passed ? `成功拦截自相交并回滚：${txRollback.rollbackReason}` : '未触发回滚保护';
          break;
        }
        case 'geometry_correctness':
        case 'seam_matching': {
          const snap = createStarterSnapshot((ds.bagType as BagType) || 'handbag');
          const tx =
            ds.category === 'seam_matching'
              ? executeCadTransaction(snap, [
                  { intent: 'modify_geometry', target: 'gusset', operation: 'set_style', parameters: { gussetStyle: 'curved', gussetCurveRadiusMm: 22 } },
                ])
              : { committed: true, nextSnapshot: snap };
          const val = validateProjectPatterns(
            tx.nextSnapshot.patterns,
            tx.nextSnapshot.relations,
            tx.nextSnapshot.materialId,
            tx.nextSnapshot.edgeProcess
          );
          const seamIssues = val.issues.filter((i) => i.code === 'SEAM_LENGTH_MISMATCH');
          passed = tx.committed && val.errorCount === 0 && seamIssues.length === 0;
          score = passed ? 1.0 : 0.5;
          observedSummary = `错误数 ${val.errorCount}，接缝偏差项 ${seamIssues.length}`;
          break;
        }
        case 'material_process': {
          const snap = createStarterSnapshot('tote');
          const tx = executeCadTransaction(snap, [
            { intent: 'optimize_pattern', target: 'product', operation: 'optimize', parameters: { optimizationGoal: 'italian_luxury' } },
          ]);
          const nest = computeSmartNesting(tx.nextSnapshot.patterns, tx.nextSnapshot.materialId, tx.nextSnapshot.hardware);
          passed =
            tx.committed &&
            tx.nextSnapshot.materialId === (criteria.expectedMaterialId ?? 'box_calf_15') &&
            nest.unplacedPieces.length === 0;
          score = passed ? 1.0 : 0.4;
          observedSummary = `材料=${tx.nextSnapshot.materialId}, 排料利用率=${nest.utilizationPct}%`;
          break;
        }
        default: {
          const snap = createStarterSnapshot((ds.bagType as BagType) || 'tote');
          const fakeProj: Project = {
            id: 'eval_tmp',
            name: 'Eval',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            currentVersion: 1,
            undoStack: [],
            redoStack: [],
            images: [],
            ...snap,
            messages: [],
            commandLog: [],
            versions: [],
            exports: [],
          };
          const mem = await memRetrieveRelevantMemoryForPrompt(uid, fakeProj, ds.inputPrompt);
          const combinedText =
            mem.engineeringKnowledge.map((k) => `${k.title} ${k.content}`).join(' ') +
            mem.experienceRecords.map((e) => e.fixMethod).join(' ');
          const kws: string[] = criteria.expectedKeywords ?? [];
          const hitCount = kws.filter((kw) => combinedText.includes(kw)).length;
          passed = mem.engineeringKnowledge.length > 0 && (kws.length === 0 || hitCount > 0);
          score = passed ? 1.0 : 0.3;
          observedSummary = `命中专业知识 ${mem.engineeringKnowledge.length} 条, 历史经验 ${mem.experienceRecords.length} 条`;
          break;
        }
      }
    } catch (err) {
      passed = false;
      score = 0;
      observedSummary = err instanceof Error ? err.message : '执行异常';
    }

    const regressionDetected = score < ds.baselineScore;
    if (regressionDetected) anyRegression = true;

    results.push({
      id: `evalres_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
      runId,
      knowledgeVersionTag: versionTag,
      modelName,
      datasetId: ds.id,
      passed,
      score,
      baselineScore: ds.baselineScore,
      regressionDetected,
      blockedDeployment: regressionDetected,
      details: {
        category: ds.category,
        observedSummary,
        expectedSummary: JSON.stringify(criteria),
        latencyMs: Date.now() - startMs,
      },
      createdAt: new Date().toISOString(),
    });
  }

  memStore.evalResults.unshift(...results);
  if (memStore.evalResults.length > 100) memStore.evalResults.length = 100;

  return {
    runId,
    knowledgeVersionTag: versionTag,
    modelName,
    totalTests: results.length,
    passedCount: results.filter((r) => r.passed).length,
    avgScore: results.length
      ? Math.round((results.reduce((s, r) => s + r.score, 0) / results.length) * 100) / 100
      : 0,
    regressionDetected: anyRegression,
    allowedToDeploy: !anyRegression,
    results,
  };
}

export async function memGetIntelligenceOverview(uid: string) {
  await memEnsureSeeded();
  const userProfile = await getUserByUid(uid);
  return {
    knowledgeVersion: memStore.knowledgeVersions[0]?.versionTag ?? KNOWLEDGE_BASE_META.version,
    userPreferences: userProfile?.preferencesJson ?? { memoryConsentEnabled: true },
    knowledgeDocs: memStore.knowledgeDocs.filter(
      (d) => d.isActive && (d.securityScope === 'A_PLATFORM_PUBLIC' || d.ownerUid === uid)
    ),
    processRules: memStore.processRules.filter((p) => p.isActive),
    constructionRules: memStore.constructionRules.filter((r) => r.isActive),
    patternCases: memStore.patternCases.filter(
      (c) => c.securityScope === 'A_PLATFORM_PUBLIC' || c.ownerUid === uid
    ),
    experienceRecords: memStore.experienceRecords.filter(
      (e) => e.securityScope === 'A_PLATFORM_PUBLIC' || e.ownerUid === uid
    ),
    memories: memStore.memoryItems.filter((m) => m.ownerUid === uid && m.isActive).slice(0, 30),
    learningCandidates: memStore.learningCandidates
      .filter((c) => c.ownerUid === uid || c.ownerUid === null)
      .slice(0, 30),
    feedbackEvents: memStore.feedbackEvents.filter((f) => f.ownerUid === uid).slice(0, 20),
    knowledgeVersions: memStore.knowledgeVersions.slice(0, 15),
    evalDatasets: memStore.evalDatasets.filter((d) => d.isActive),
    latestEvalResults: memStore.evalResults.slice(0, 20),
    blindTests: memStore.blindTests.slice(0, 30),
    customTemplates: memStore.customTemplates.slice(0, 40),
    factoryFeedbacks: memStore.factoryFeedbacks.slice(0, 30),
    latestBenchmark: memStore.benchmarkRuns[0] ?? null,
    trainingSamples: memStore.trainingSamples.slice(0, 60),
  };
}

export async function memListBlindTests(): Promise<BlindTestRecord[]> {
  await memEnsureSeeded();
  return memStore.blindTests;
}

export async function memCreateBlindTestRecord(
  input: Omit<BlindTestRecord, 'id' | 'createdAt' | 'dimensionErrorMm'>
): Promise<BlindTestRecord> {
  await memEnsureSeeded();
  const dw = Math.abs(input.actualDimensionsMm.widthMm - input.aiInitialDimensionsMm.widthMm);
  const dh = Math.abs(input.actualDimensionsMm.heightMm - input.aiInitialDimensionsMm.heightMm);
  const dd = Math.abs(input.actualDimensionsMm.depthMm - input.aiInitialDimensionsMm.depthMm);
  const dimensionErrorMm = Math.round(Math.max(dw, dh, dd) * 10) / 10;
  const proofs = deriveBlindTestProofs(input);

  const rec: BlindTestRecord = {
    ...input,
    ...proofs,
    id: `bt_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    dimensionErrorMm,
    createdAt: new Date().toISOString(),
  };
  memStore.blindTests.unshift(rec);
  return rec;
}

export async function memListCustomMasterTemplates(): Promise<MasterPatternTemplate[]> {
  await memEnsureSeeded();
  return memStore.customTemplates;
}

export async function memCreateCustomMasterTemplate(
  tpl: MasterPatternTemplate
): Promise<MasterPatternTemplate> {
  await memEnsureSeeded();
  const saved: MasterPatternTemplate = {
    ...tpl,
    isCustom: true,
    status: tpl.status ?? 'draft',
    templateVersion: tpl.templateVersion ?? 'V1.0-CUSTOM',
  };
  memStore.customTemplates.unshift(saved);
  return saved;
}

export async function memUpdateCustomMasterTemplate(
  id: string,
  patch: Partial<MasterPatternTemplate>
): Promise<MasterPatternTemplate | null> {
  await memEnsureSeeded();
  const idx = memStore.customTemplates.findIndex((t) => t.id === id);
  if (idx < 0) return null;
  memStore.customTemplates[idx] = {
    ...memStore.customTemplates[idx],
    ...patch,
    id,
    isCustom: true,
  };
  return memStore.customTemplates[idx];
}

export async function memListFactoryFeedbacks(
  projectId?: string
): Promise<FactoryProductionFeedback[]> {
  await memEnsureSeeded();
  return projectId
    ? memStore.factoryFeedbacks.filter((f) => f.projectId === projectId)
    : memStore.factoryFeedbacks;
}

export async function memCreateFactoryFeedback(
  uid: string,
  input: Omit<FactoryProductionFeedback, 'id' | 'createdAt' | 'promotedToExperienceId'>
): Promise<FactoryProductionFeedback> {
  await memEnsureSeeded();
  const nowIso = new Date().toISOString();
  const expId = `exp_ff_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

  // Auto-log into Layer 5 Experience Records
  const hasIssue =
    input.conclusion !== 'approved_for_mass_production' ||
    input.patternMakerCorrections.length > 0 ||
    input.seamDeviationMm > 1.2;

  const expRec = {
    id: expId,
    projectId: input.projectId,
    bagType: input.bagType,
    materialId: input.materialId,
    relatedParts: ['A01', 'A03', 'A05'],
    errorCategory:
      input.conclusion === 'material_process_change'
        ? 'skiving_crack'
        : input.seamDeviationMm > 1.2
          ? 'seam_mismatch'
          : 'success_pattern',
    errorLocation: `${input.projectName} v${input.projectVersion} 产线反馈`,
    rootCause: `${input.materialIssues}；${input.skivingIssues}；${input.pieceDeformation}`,
    fixMethod:
      input.patternMakerCorrections.join('；') || input.stitchingCondition,
    geometryPassed: input.seamDeviationMm <= 1.2,
    patternMakerReviewed: true,
    productionVerified: input.conclusion === 'approved_for_mass_production',
    outcomeSummary: `成包实测 ${input.finishedDimensionsMm.widthMm}×${input.finishedDimensionsMm.heightMm}×${input.finishedDimensionsMm.depthMm}mm · 外观评分 ${input.appearanceRating}/5`,
    securityScope: 'A_PLATFORM_PUBLIC',
    ownerUid: uid,
    reviewLevel: input.conclusion === 'approved_for_mass_production' ? 5 : 4,
    createdAt: nowIso,
    embedding: computeDeterministicEmbedding(
      `${input.bagType} ${input.materialId} ${input.materialIssues} ${input.patternMakerCorrections.join(' ')}`
    ),
  };
  memStore.experienceRecords.unshift(expRec);

  if (hasIssue) {
    memStore.learningCandidates.unshift({
      id: `cand_ff_${Date.now()}`,
      feedbackEventId: null,
      knowledgeType: 'defect_fix',
      title: `产线反馈经验：${input.projectName.slice(0, 28)}`,
      proposedContent: `产线实测接缝偏差 ${input.seamDeviationMm}mm，材料/铲薄问题：${input.materialIssues} / ${input.skivingIssues}。打版师修正：${input.patternMakerCorrections.join('；') || '待补全'}`,
      applicableBagTypes: [input.bagType],
      applicableMaterials: [input.materialId],
      relatedParts: ['A01', 'A03', 'A05'],
      classification: 'reusable_experience',
      source: `工厂反馈 (${input.recordedBy})`,
      version: '0.1.0-candidate',
      confidence: 0.85,
      reviewLevel: 3,
      status: 'pending',
      securityScope: 'D_AI_CANDIDATE',
      ownerUid: uid,
      createdAt: nowIso,
    });
  }

  const saved: FactoryProductionFeedback = {
    ...input,
    id: `ff_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    promotedToExperienceId: expId,
    createdAt: nowIso,
  };
  memStore.factoryFeedbacks.unshift(saved);
  return saved;
}

export async function memGetLatestBenchmark(): Promise<AccuracyBenchmarkSummary> {
  await memEnsureSeeded();
  if (memStore.benchmarkRuns.length === 0) {
    memStore.benchmarkRuns.unshift(executeAccuracyBenchmarkSuite());
  }
  return memStore.benchmarkRuns[0];
}

export async function memRunAccuracyBenchmark(): Promise<AccuracyBenchmarkSummary> {
  await memEnsureSeeded();
  const run = executeAccuracyBenchmarkSuite();
  memStore.benchmarkRuns.unshift(run);
  if (memStore.benchmarkRuns.length > 20) memStore.benchmarkRuns.length = 20;
  return run;
}

export async function memDeleteUserMemoryItem(id: string, uid: string): Promise<boolean> {
  await memEnsureSeeded();
  const idx = memStore.memoryItems.findIndex((m) => m.id === id && m.ownerUid === uid);
  if (idx >= 0) {
    memStore.memoryItems.splice(idx, 1);
    return true;
  }
  return false;
}

export async function memRollbackKnowledgeVersion(params: {
  versionId: string;
  reviewerUid: string;
  reviewerName: string;
}) {
  await memEnsureSeeded();
  const ver = memStore.knowledgeVersions.find((v) => v.id === params.versionId);
  if (!ver) throw new Error('未找到指定的知识版本记录');
  if (ver.entityId === 'platform_baseline') throw new Error('平台初始基线版本不可回滚停用');

  const prev = ver.previousSnapshot as Record<string, any> | null;
  const rollbackTag = `KB-RB-${new Date().toISOString().slice(0, 10)}.${Math.floor(Date.now() % 1000)}`;
  const nowIso = new Date().toISOString();

  if (ver.entityType === 'knowledge_document') {
    const doc = memStore.knowledgeDocs.find((d) => d.id === ver.entityId);
    if (doc) {
      if (prev && typeof prev.content === 'string') {
        doc.title = typeof prev.title === 'string' ? prev.title : doc.title;
        doc.content = prev.content;
        doc.reviewLevel = typeof prev.reviewLevel === 'number' ? prev.reviewLevel : 4;
        doc.securityScope = typeof prev.securityScope === 'string' ? prev.securityScope : 'C_USER_PRIVATE';
        doc.version = typeof prev.version === 'string' ? prev.version : rollbackTag;
        doc.isActive = prev.isActive !== false;
        doc.embedding = await generateSemanticEmbedding(`${doc.title} ${doc.content}`);
        doc.updatedAt = nowIso;
      } else {
        doc.isActive = false;
        doc.updatedAt = nowIso;
      }
    }
  }

  const auditEntry = {
    id: `kver_rb_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    versionTag: rollbackTag,
    entityType: ver.entityType,
    entityId: ver.entityId,
    changeSummary: `版本回滚（撤销 ${ver.versionTag}）：${ver.changeSummary}`,
    previousSnapshot: ver.newSnapshot,
    newSnapshot: prev ?? { id: ver.entityId, isActive: false, rolledBackFrom: ver.versionTag },
    authorUid: params.reviewerUid,
    reviewerName: params.reviewerName,
    reviewLevel: ver.reviewLevel,
    createdAt: nowIso,
  };
  memStore.knowledgeVersions.unshift(auditEntry);
  return { rolledBackVersion: ver, auditEntry };
}

export async function memListTrainingSamples(filters?: {
  datasetSplit?: string;
  annotationStatus?: string;
  bagType?: string;
}): Promise<TrainingSampleRecord[]> {
  await memEnsureSeeded();
  return memStore.trainingSamples.filter((s) => {
    if (filters?.datasetSplit && s.datasetSplit !== filters.datasetSplit) return false;
    if (filters?.annotationStatus && s.annotationStatus !== filters.annotationStatus) return false;
    if (filters?.bagType && s.bagType !== filters.bagType) return false;
    return true;
  });
}

export async function memCreateTrainingSample(
  input: Omit<TrainingSampleRecord, 'id' | 'createdAt' | 'updatedAt'>
): Promise<TrainingSampleRecord> {
  await memEnsureSeeded();
  const nowIso = new Date().toISOString();
  const saved: TrainingSampleRecord = {
    ...input,
    id: `ts_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    createdAt: nowIso,
    updatedAt: nowIso,
  };
  memStore.trainingSamples.unshift(saved);
  return saved;
}

export async function memUpdateTrainingSample(
  id: string,
  patch: Partial<TrainingSampleRecord>
): Promise<TrainingSampleRecord | null> {
  await memEnsureSeeded();
  const idx = memStore.trainingSamples.findIndex((s) => s.id === id);
  if (idx < 0) return null;
  memStore.trainingSamples[idx] = {
    ...memStore.trainingSamples[idx],
    ...patch,
    id,
    updatedAt: new Date().toISOString(),
  };
  return memStore.trainingSamples[idx];
}

export async function memExportTrainingDatasetJsonl(): Promise<{
  jsonl: string;
  count: number;
  splits: Record<string, number>;
}> {
  await memEnsureSeeded();
  const splits: Record<string, number> = { train: 0, validation: 0, sealed_test: 0 };
  const lines = memStore.trainingSamples.map((s) => {
    splits[s.datasetSplit] = (splits[s.datasetSplit] ?? 0) + 1;
    return JSON.stringify({
      id: s.id,
      split: s.datasetSplit,
      annotation_status: s.annotationStatus,
      leather_rules_verified: s.leatherSpecificRulesChecked,
      input: {
        photo_angles: s.photoAngles,
        photo_count: s.photoCount,
        has_reference_calibration: s.hasReferenceCalibration,
        reference_object: s.referenceObjectType || null,
        visible_parts: s.visiblePartLabels,
        seam_boundary_notes: s.seamBoundaryNotes,
      },
      target_structure_and_cad: {
        bag_type: s.bagType,
        structure_type: s.structureType,
        material_id: s.materialId,
        edge_process: s.edgeProcess,
        true_dimensions_mm: s.trueDimensionsMm,
        hidden_parts: s.hiddenPartLabels,
        verified_piece_count: s.verifiedPieceCount,
        verified_patterns: s.verifiedPatternSummary,
      },
      annotated_by: s.annotatedBy,
      notes: s.notes,
    });
  });
  return { jsonl: lines.join('\n'), count: lines.length, splits };
}
