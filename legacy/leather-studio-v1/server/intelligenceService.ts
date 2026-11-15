import {
  and,
  cosineDistance,
  desc,
  eq,
  or,
  sql,
} from 'drizzle-orm';
import { db, isPostgresConfigured } from '../src/db/index.ts';
import {
  memArchiveProjectAsCase,
  memCreateBlindTestRecord,
  memCreateCustomMasterTemplate,
  memCreateFactoryFeedback,
  memCreateTrainingSample,
  memDeleteUserMemoryItem,
  memEnsureSeeded,
  memExportTrainingDatasetJsonl,
  memGetIntelligenceOverview,
  memGetLatestBenchmark,
  memListBlindTests,
  memListCustomMasterTemplates,
  memListFactoryFeedbacks,
  memListTrainingSamples,
  memRecordAiFeedbackAndExtractLearning,
  memRetrieveRelevantMemoryForPrompt,
  memReviewLearningCandidate,
  memRollbackKnowledgeVersion,
  memRunAccuracyBenchmark,
  memRunAiEvaluationSuite,
  memUpdateCustomMasterTemplate,
  memUpdateTrainingSample,
  memUpsertMemoryItemWithMerge,
} from './intelligenceInMemory.ts';
import {
  accuracyBenchmarkRuns,
  aiEvaluationDatasets,
  aiEvaluationResults,
  aiFeedbackEvents,
  aiKnowledgeVersions,
  aiLearningCandidates,
  aiMemoryItems,
  blindTestRecords,
  factoryProductionFeedbacks,
  leatherComponentCatalog,
  leatherConstructionRules,
  leatherEmbeddings,
  leatherExperienceRecords,
  leatherHardwareLibrary,
  leatherKnowledgeDocuments,
  leatherMaterialLibrary,
  leatherPatternCases,
  leatherProcessRules,
  leatherTrainingSamples,
  masterPatternTemplates,
} from '../src/db/schema.ts';
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
  STANDARD_COMPONENT_CATALOG,
} from '../src/shared/leatherKnowledge.ts';
import type {
  AccuracyBenchmarkSummary,
  BagType,
  BenchmarkSplit,
  BlindTestRecord,
  EdgeProcessType,
  FactoryProductionFeedback,
  ImageAngle,
  MasterPatternTemplate,
  Project,
  StructureType,
  StructuredCadCommand,
  TrainingAnnotationStatus,
  TrainingSampleRecord,
} from '../src/shared/types.ts';
import { computeDeterministicEmbedding, generateSemanticEmbedding } from './embeddings.ts';
import { deriveBlindTestProofs, executeAccuracyBenchmarkSuite } from './benchmarkRunner.ts';

export const REVIEW_LEVEL_LABELS: Record<number, string> = {
  1: 'LEVEL 1：AI 推测（仅供参考）',
  2: 'LEVEL 2：几何验证通过',
  3: 'LEVEL 3：用户确认',
  4: 'LEVEL 4：专业打版师审核',
  5: 'LEVEL 5：实际生产验证',
};

export const SECURITY_SCOPE_LABELS: Record<string, string> = {
  A_PLATFORM_PUBLIC: 'A · 全平台共享知识',
  B_ENTERPRISE_PRIVATE: 'B · 企业私有知识',
  C_USER_PRIVATE: 'C · 用户个人设计',
  D_AI_CANDIDATE: 'D · AI 待审核经验',
};

let seededPromise: Promise<void> | null = null;

export async function ensureIntelligenceSeeded(): Promise<void> {
  if (!isPostgresConfigured) return memEnsureSeeded();
  if (seededPromise) return seededPromise;

  seededPromise = (async () => {
    try {
      const existingDocs = await db
        .select({ id: leatherKnowledgeDocuments.id })
        .from(leatherKnowledgeDocuments)
        .limit(1);

      if (existingDocs.length === 0) {

      // 1. Seed leather_material_library
      for (const m of MATERIAL_LIBRARY) {
        await db
          .insert(leatherMaterialLibrary)
          .values({
            id: m.id,
            name: m.name,
            category: m.category,
            thicknessMm: m.thicknessMm,
            temper: m.temper,
            stretchFactor: m.stretchFactor,
            grainRequired: m.grainRequired,
            recommendedEdgeProcess: m.recommendedEdgeProcess,
            defaultSeamAllowanceMm: m.defaultSeamAllowanceMm,
            defaultFoldWidthMm: m.defaultFoldWidthMm,
            stitchSpacingMm: m.stitchSpacingMm,
            skivingRecommendedAboveMm: m.skivingRecommendedAboveMm,
            costPerDm2Cny: m.costPerDm2Cny ?? 6.5,
            description: m.description,
            source: KNOWLEDGE_BASE_META.sources[2],
            version: KNOWLEDGE_BASE_META.version,
            confidence: 0.96,
            reviewLevel: 5,
          })
          .onConflictDoNothing();
      }

      // 2. Seed leather_component_catalog
      for (const c of STANDARD_COMPONENT_CATALOG) {
        await db
          .insert(leatherComponentCatalog)
          .values({
            id: `cat_${c.standardType}`,
            standardType: c.standardType,
            partCodePrefix: c.partCodePrefix,
            name: c.name,
            category: c.category,
            defaultSeamAllowanceMm: c.defaultSeamAllowanceMm,
            matingEdges: c.matingEdges,
            applicableBagTypes: ['tote', 'handbag', 'shoulder_bag'],
            productionNotes: c.productionNotes,
            source: 'RUDA 标准部件库',
            version: KNOWLEDGE_BASE_META.version,
            confidence: 0.96,
            reviewLevel: 4,
          })
          .onConflictDoNothing();
      }

      // 3. Seed leather_hardware_library
      const seedHardware = [
        {
          id: 'hw_lib_d_ring_16',
          name: '16mm 焊接 D 形环',
          hardwareType: 'd_ring',
          mountWidthMm: 16,
          holeDiameterMm: 2.0,
          holeSpacingMm: 8,
          finish: '浅金色电镀',
          loadRatingKg: 28,
          installationNotes: '耳仔皮料穿入后背贴 0.4mm 防拉补强织带，防止长肩带承重拉裂。',
        },
        {
          id: 'hw_lib_mag_snap_18',
          name: '18mm 超薄暗磁扣',
          hardwareType: 'magnetic_snap',
          mountWidthMm: 18,
          holeDiameterMm: 2.5,
          holeSpacingMm: 10,
          finish: '拉丝古铜',
          loadRatingKg: 8,
          installationNotes: '背面必须垫 0.8mm 皮糠纸或金属垫片折脚，避免磁扣脚顶破正面皮面。',
        },
        {
          id: 'hw_lib_zip_5',
          name: '5# YKK 金属闭尾拉链',
          hardwareType: 'zipper',
          mountWidthMm: 240,
          holeDiameterMm: 1.5,
          holeSpacingMm: 3.38,
          finish: '浅金拉齿',
          loadRatingKg: 22,
          installationNotes: '拉链挡片左右端需比包身内口退让 6mm，防止包角车缝卡死拉头。',
        },
        {
          id: 'hw_lib_turn_lock_32',
          name: '32mm 翻盖插锁扣',
          hardwareType: 'turn_lock',
          mountWidthMm: 32,
          holeDiameterMm: 2.5,
          holeSpacingMm: 22,
          finish: '浅金色电镀',
          loadRatingKg: 18,
          installationNotes: '安装位中心需加贴 1.0mm 补强衬板以保持翻盖开合平整度。',
        },
      ];
      for (const h of seedHardware) {
        await db.insert(leatherHardwareLibrary).values(h).onConflictDoNothing();
      }

      // 4. Seed leather_process_rules
      for (const s of PROCESS_SCHEMES) {
        await db
          .insert(leatherProcessRules)
          .values({
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
            applicableMaterials: MATERIAL_LIBRARY.filter((m) =>
              s.applicableTempers.includes(m.temper)
            ).map((m) => m.id),
            relatedParts: ['front_panel', 'back_panel', 'left_gusset', 'handle_strap'],
            source: s.sourceStandard,
            version: KNOWLEDGE_BASE_META.version,
            confidence: 0.95,
            reviewLevel: 5,
            isActive: true,
          })
          .onConflictDoNothing();
      }

      // 5. Seed leather_construction_rules
      const seedConstruction = [
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
        },
      ];
      for (const cr of seedConstruction) {
        const crVec = computeDeterministicEmbedding(
          `${cr.code} ${cr.title} ${cr.fromPart} ${cr.toPart} ${cr.ruleDetail} ${cr.applicableMaterials.join(' ')}`
        );
        await db
          .insert(leatherConstructionRules)
          .values({
            ...cr,
            embedding: crVec,
          })
          .onConflictDoNothing();
      }

      // 6. Seed leather_knowledge_documents with vectors
      const seedDocs = [
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
        },
      ];
      for (const d of seedDocs) {
        await db
          .insert(leatherKnowledgeDocuments)
          .values({
            ...d,
            embedding: computeDeterministicEmbedding(`${d.title} ${d.content} ${d.applicableMaterials.join(' ')}`),
          })
          .onConflictDoNothing();
      }

      // 7. Seed leather_pattern_cases
      const toteSnap = createStarterSnapshot('tote');
      const handbagSnap = createStarterSnapshot('handbag');
      const seedCases = [
        {
          id: 'case_verified_tote_300',
          projectId: null,
          title: '经典植鞣立挺托特包 300×240×120mm（生产验证样板）',
          bagType: 'tote',
          materialId: 'veg_tan_18',
          edgeProcess: 'raw_burnish',
          photoSummary: '正面直筒托特包照片：双条手拎带+水滴形耳仔撞钉+包口暗磁扣。',
          dimensionsSummary: {
            widthMm: 300,
            heightMm: 240,
            depthMm: 120,
            handleLengthMm: 420,
            seamAllowanceMm: 5,
          },
          structureBreakdown: toteSnap.components.map((c) => `${c.partCode} ${c.name} (${c.widthMm}×${c.heightMm}mm)`),
          componentRelations: toteSnap.relations.map((r) => `${r.fromComponentId}.${r.fromEdgeId} -> ${r.toComponentId}.${r.toEdgeId}`),
          nativePatternsSummary: toteSnap.patterns.map((p) => ({
            partCode: p.partCode,
            name: p.name,
            widthMm: p.boundingBoxMm.width,
            heightMm: p.boundingBoxMm.height,
            quantity: p.quantity,
          })),
          processSummary: '1.8mm 植鞣牛皮原皮打磨封边，3.85mm 斩距，内衬缩量 -4.5mm/-5.9mm，底托内缩 6.2mm。',
          validationPassed: true,
          productionVerified: true,
          productionResultNote: '已完成首件裁切与成品装配测试，接缝对位误差 < 0.8mm，包身立挺无堆褶。',
          securityScope: 'A_PLATFORM_PUBLIC',
          source: 'RUDA 样板车间实测归档',
          version: '1.0.0',
          confidence: 0.97,
          reviewLevel: 5,
        },
        {
          id: 'case_verified_handbag_280',
          projectId: null,
          title: '意式梯形盒式小牛皮手提包 280×210×110mm',
          bagType: 'handbag',
          materialId: 'box_calf_15',
          edgeProcess: 'edge_paint',
          photoSummary: '梯形挺括手提包：顶部短提手、翻盖插锁、侧耳D环配长肩带与底部脚钉。',
          dimensionsSummary: {
            widthMm: 280,
            heightMm: 210,
            depthMm: 110,
            handleLengthMm: 310,
            seamAllowanceMm: 5,
          },
          structureBreakdown: handbagSnap.components.map((c) => `${c.partCode} ${c.name} (${c.widthMm}×${c.heightMm}mm)`),
          componentRelations: handbagSnap.relations.map((r) => `${r.fromComponentId}.${r.fromEdgeId} -> ${r.toComponentId}.${r.toEdgeId}`),
          nativePatternsSummary: handbagSnap.patterns.map((p) => ({
            partCode: p.partCode,
            name: p.name,
            widthMm: p.boundingBoxMm.width,
            heightMm: p.boundingBoxMm.height,
            quantity: p.quantity,
          })),
          processSummary: '1.5mm Box Calf 意式油边定型，3.38mm 针距，梯形侧围收口配合底脚钉。',
          validationPassed: true,
          productionVerified: true,
          productionResultNote: '打版师终审与样板试制均通过，油边饱满无溢胶。',
          securityScope: 'A_PLATFORM_PUBLIC',
          source: 'RUDA 意式箱包参考库',
          version: '1.0.0',
          confidence: 0.95,
          reviewLevel: 5,
        },
      ];
      for (const cs of seedCases) {
        await db
          .insert(leatherPatternCases)
          .values({
            ...cs,
            embedding: computeDeterministicEmbedding(`${cs.title} ${cs.bagType} ${cs.materialId} ${cs.processSummary}`),
          })
          .onConflictDoNothing();
      }

      // 8. Seed leather_experience_records (Historical success/failure lessons)
      const seedExperiences = [
        {
          id: 'exp_gusset_curve_mismatch',
          projectId: null,
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
          source: '历史纠错案例 #EXP-01',
          version: '1.0.0',
          confidence: 0.94,
          reviewLevel: 5,
        },
        {
          id: 'exp_folded_crack_thick_hide',
          projectId: null,
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
          source: '历史纠错案例 #EXP-02',
          version: '1.0.0',
          confidence: 0.96,
          reviewLevel: 5,
        },
        {
          id: 'exp_lining_bunching',
          projectId: null,
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
          source: '历史纠错案例 #EXP-03',
          version: '1.0.0',
          confidence: 0.95,
          reviewLevel: 5,
        },
      ];
      for (const ex of seedExperiences) {
        await db
          .insert(leatherExperienceRecords)
          .values({
            ...ex,
            embedding: computeDeterministicEmbedding(
              `${ex.errorCategory} ${ex.errorLocation} ${ex.rootCause} ${ex.fixMethod}`
            ),
          })
          .onConflictDoNothing();
      }

      // 9. Seed ai_evaluation_datasets (All 10 required capability categories)
      const evalDatasets = [
        {
          id: 'eval_01_bag_type',
          name: '托特包型结构初始化识别',
          category: 'bag_type',
          bagType: 'tote',
          inputPrompt: '生成一个经典植鞣牛皮托特包版型',
          inputContext: { targetBagType: 'tote' },
          expectedCriteria: { expectedMinPieces: 8, expectedKeywords: ['front', 'gusset', 'handle'] },
          baselineScore: 1.0,
        },
        {
          id: 'eval_02_component_id',
          name: '翻盖手提包与内袋部件完整性识别',
          category: 'component_id',
          bagType: 'handbag',
          inputPrompt: '识别手提包全部标准部件并生成纸格',
          inputContext: { targetBagType: 'handbag' },
          expectedCriteria: { expectedMinPieces: 9, expectedKeywords: ['A01', 'H01', 'I01'] },
          baselineScore: 1.0,
        },
        {
          id: 'eval_03_structure_reasoning',
          name: '隐藏内部结构（内衬与底托）推理与厚度补偿',
          category: 'structure_reasoning',
          bagType: 'tote',
          inputPrompt: '验证内衬与底托板的隐藏结构推理和厚度内缩量',
          inputContext: { checkThicknessCompensation: true },
          expectedCriteria: { expectedMinPieces: 9 },
          baselineScore: 1.0,
        },
        {
          id: 'eval_04_nl_understanding',
          name: '自然语言尺寸增减指令映射准确性',
          category: 'nl_understanding',
          bagType: 'tote',
          inputPrompt: '把包宽增加 2 厘米',
          inputContext: { deltaWidthMm: 20 },
          expectedCriteria: { expectedIntent: 'resize_product', expectedDeltaWidthMm: 20 },
          baselineScore: 1.0,
        },
        {
          id: 'eval_05_cad_execution',
          name: 'CAD 事务执行与自相交异常原子回滚保护',
          category: 'cad_execution',
          bagType: 'tote',
          inputPrompt: '验证异常轮廓触发事务回滚且不破坏原版型',
          inputContext: { testRollback: true },
          expectedCriteria: { expectedMinPieces: 8 },
          baselineScore: 1.0,
        },
        {
          id: 'eval_06_parametric_linkage',
          name: '包宽修改后底片与拉链挡片参数联动验证',
          category: 'parametric_linkage',
          bagType: 'shoulder_bag',
          inputPrompt: '将肩背包宽度增加 30mm，检查底片及拉链挡片同步缩放',
          inputContext: { deltaWidthMm: 30 },
          expectedCriteria: { expectedDeltaWidthMm: 30 },
          baselineScore: 1.0,
        },
        {
          id: 'eval_07_geometry_correctness',
          name: '轮廓闭合、非自相交与打孔边距几何校验',
          category: 'geometry_correctness',
          bagType: 'handbag',
          inputPrompt: '检查手提包全套纸格几何闭合与孔位边距',
          inputContext: { checkGeometry: true },
          expectedCriteria: { expectedMaxSeamDiffMm: 1.2 },
          baselineScore: 1.0,
        },
        {
          id: 'eval_08_seam_matching',
          name: '圆弧侧围与主包片接缝长度误差匹配（≤±1.2mm）',
          category: 'seam_matching',
          bagType: 'shoulder_bag',
          inputPrompt: '侧面改成圆弧并校对接缝误差',
          inputContext: { gussetStyle: 'curved' },
          expectedCriteria: { expectedMaxSeamDiffMm: 1.2 },
          baselineScore: 1.0,
        },
        {
          id: 'eval_09_material_process',
          name: '意式高端风格工艺与排料利用率优化',
          category: 'material_process',
          bagType: 'tote',
          inputPrompt: '做一个更高级的意大利风格手提包',
          inputContext: { optimizationGoal: 'italian_luxury' },
          expectedCriteria: { expectedMaterialId: 'box_calf_15' },
          baselineScore: 1.0,
        },
        {
          id: 'eval_10_memory_accuracy',
          name: '历史工程知识与经验库混合检索命中率验证',
          category: 'memory_accuracy',
          bagType: 'tote',
          inputPrompt: '植鞣皮折边爆裂与内衬起皱怎么避免',
          inputContext: { query: '折边 铲薄 内衬 起皱' },
          expectedCriteria: { expectedKeywords: ['铲薄', '内缩'] },
          baselineScore: 1.0,
        },
      ];
      for (const ds of evalDatasets) {
        await db.insert(aiEvaluationDatasets).values(ds).onConflictDoNothing();
      }

      // 10. Seed initial knowledge version entry
      await db
        .insert(aiKnowledgeVersions)
        .values({
          id: 'kver_init_kb_2026_11',
          versionTag: KNOWLEDGE_BASE_META.version,
          entityType: 'knowledge_document',
          entityId: 'platform_baseline',
          changeSummary: '初始化 RUDA V1.1 专业知识库（含 4 份核心规范、4 套工艺方案、3 条结构连接规则及 3 条历史纠错经验）',
          previousSnapshot: null,
          newSnapshot: {
            version: KNOWLEDGE_BASE_META.version,
            docsCount: seedDocs.length,
            casesCount: seedCases.length,
            experiencesCount: seedExperiences.length,
          },
          authorUid: 'system',
          reviewerName: '陈工（首席皮具打版师）',
          reviewLevel: 5,
        })
        .onConflictDoNothing();
      }

      // Sync unified leather_embeddings table for construction rules & historical pattern cases (idempotent backfill)
      const existingEmbeds = await db
        .select({ id: leatherEmbeddings.id })
        .from(leatherEmbeddings)
        .limit(1);

      if (existingEmbeds.length === 0) {
        const allRules = await db.select().from(leatherConstructionRules);
        for (const rule of allRules) {
          const vec =
            rule.embedding ??
            computeDeterministicEmbedding(
              `${rule.code} ${rule.title} ${rule.fromPart} ${rule.toPart} ${rule.ruleDetail} ${rule.applicableMaterials.join(' ')}`
            );
          if (!rule.embedding) {
            await db
              .update(leatherConstructionRules)
              .set({ embedding: vec, updatedAt: new Date() })
              .where(eq(leatherConstructionRules.id, rule.id));
          }
          await db
            .insert(leatherEmbeddings)
            .values({
              id: `emb_const_${rule.id}`,
              sourceTable: 'leather_construction_rules',
              sourceId: rule.id,
              constructionRuleId: rule.id,
              patternCaseId: null,
              title: `${rule.code} ${rule.title}`,
              contentText: `${rule.fromPart} -> ${rule.toPart} (${rule.relationType}, ±${rule.toleranceMm}mm): ${rule.ruleDetail}`,
              applicableBagTypes: rule.applicableBagTypes,
              applicableMaterials: rule.applicableMaterials,
              relatedParts: rule.relatedParts,
              reviewLevel: rule.reviewLevel,
              securityScope: 'A_PLATFORM_PUBLIC',
              ownerUid: null,
              embeddingModel: 'gemini-embedding-001',
              dimensions: 256,
              embedding: vec,
              metadataJson: { code: rule.code, toleranceMm: rule.toleranceMm },
              isActive: rule.isActive,
            })
            .onConflictDoNothing();
        }

        const allCases = await db.select().from(leatherPatternCases);
        for (const cs of allCases) {
          const vec =
            cs.embedding ??
            computeDeterministicEmbedding(
              `${cs.title} ${cs.bagType} ${cs.materialId} ${cs.processSummary} ${cs.productionResultNote}`
            );
          if (!cs.embedding) {
            await db
              .update(leatherPatternCases)
              .set({ embedding: vec, updatedAt: new Date() })
              .where(eq(leatherPatternCases.id, cs.id));
          }
          await db
            .insert(leatherEmbeddings)
            .values({
              id: `emb_case_${cs.id}`,
              sourceTable: 'leather_pattern_cases',
              sourceId: cs.id,
              constructionRuleId: null,
              patternCaseId: cs.id,
              title: cs.title,
              contentText: `${cs.bagType} ${cs.materialId} ${cs.edgeProcess} · ${cs.processSummary} · ${cs.productionResultNote}`,
              applicableBagTypes: [cs.bagType],
              applicableMaterials: [cs.materialId],
              relatedParts: [],
              reviewLevel: cs.reviewLevel,
              securityScope: cs.securityScope,
              ownerUid: cs.ownerUid,
              embeddingModel: 'gemini-embedding-001',
              dimensions: 256,
              embedding: vec,
              metadataJson: {
                productionVerified: cs.productionVerified,
                validationPassed: cs.validationPassed,
              },
              isActive: true,
            })
            .onConflictDoNothing();
        }
      }
    } catch (error) {
      seededPromise = null;
      console.error('Failed to seed RUDA Intelligence tables:', error);
      throw new Error('初始化知识库数据失败', { cause: error });
    }
  })();

  return seededPromise;
}

export interface RetrievedMemoryBundle {
  sessionContext: Record<string, unknown>;
  userPreferences: Record<string, unknown>;
  userMemories: Array<{
    id: string;
    memoryKey: string;
    content: string;
    reviewLevel: number;
    confidence: number;
  }>;
  engineeringKnowledge: Array<{
    id: string;
    title: string;
    content: string;
    knowledgeType: string;
    source: string;
    version: string;
    reviewLevel: number;
    securityScope: string;
  }>;
  processRules: Array<{
    id: string;
    name: string;
    edgeProcess: string;
    seamAllowanceMm: number;
    stitchSpacingMm: number;
    reinforcementAdvice: string;
    reviewLevel: number;
  }>;
  constructionRules: Array<{
    id: string;
    code: string;
    title: string;
    fromPart: string;
    toPart: string;
    toleranceMm: number;
    ruleDetail: string;
    reviewLevel: number;
  }>;
  similarCases: Array<{
    id: string;
    title: string;
    bagType: string;
    materialId: string;
    processSummary: string;
    productionVerified: boolean;
    reviewLevel: number;
  }>;
  experienceRecords: Array<{
    id: string;
    errorCategory: string;
    errorLocation: string;
    fixMethod: string;
    productionVerified: boolean;
    reviewLevel: number;
  }>;
  retrievedKnowledgeIds: string[];
  usedCaseIds: string[];
}

/**
 * Layer 1-5 Hybrid Retrieval:
 * Combines structured filtering (bagType, materialId, securityScope, active status),
 * pgvector cosine similarity search, and keyword scoring without dumping raw chat history.
 */
export async function retrieveRelevantMemoryForPrompt(
  uid: string,
  project: Project,
  queryText: string
): Promise<RetrievedMemoryBundle> {
  if (!isPostgresConfigured) return memRetrieveRelevantMemoryForPrompt(uid, project, queryText);
  await ensureIntelligenceSeeded();

  const userProfile = await getUserByUid(uid);
  const queryVec = await generateSemanticEmbedding(
    `${project.bagType} ${project.materialId} ${project.edgeProcess} ${queryText}`
  );
  const lowered = queryText.toLowerCase();

  // Layer 2 & 3: User long-term memories & project memories scoped strictly to uid
  const rawMemories = await db
    .select({
      id: aiMemoryItems.id,
      memoryLayer: aiMemoryItems.memoryLayer,
      memoryKey: aiMemoryItems.memoryKey,
      content: aiMemoryItems.content,
      reviewLevel: aiMemoryItems.reviewLevel,
      confidence: aiMemoryItems.confidence,
      distance: cosineDistance(aiMemoryItems.embedding, queryVec),
    })
    .from(aiMemoryItems)
    .where(
      and(
        eq(aiMemoryItems.isActive, true),
        or(
          eq(aiMemoryItems.ownerUid, uid),
          eq(aiMemoryItems.securityScope, 'A_PLATFORM_PUBLIC')
        )
      )
    )
    .orderBy(cosineDistance(aiMemoryItems.embedding, queryVec))
    .limit(6);

  // Layer 4: Engineering Knowledge Documents (vector + scope + keyword boost)
  const docRows = await db
    .select({
      id: leatherKnowledgeDocuments.id,
      title: leatherKnowledgeDocuments.title,
      content: leatherKnowledgeDocuments.content,
      knowledgeType: leatherKnowledgeDocuments.knowledgeType,
      applicableBagTypes: leatherKnowledgeDocuments.applicableBagTypes,
      applicableMaterials: leatherKnowledgeDocuments.applicableMaterials,
      source: leatherKnowledgeDocuments.source,
      version: leatherKnowledgeDocuments.version,
      reviewLevel: leatherKnowledgeDocuments.reviewLevel,
      securityScope: leatherKnowledgeDocuments.securityScope,
      distance: cosineDistance(leatherKnowledgeDocuments.embedding, queryVec),
    })
    .from(leatherKnowledgeDocuments)
    .where(
      and(
        eq(leatherKnowledgeDocuments.isActive, true),
        or(
          eq(leatherKnowledgeDocuments.securityScope, 'A_PLATFORM_PUBLIC'),
          and(
            eq(leatherKnowledgeDocuments.securityScope, 'C_USER_PRIVATE'),
            eq(leatherKnowledgeDocuments.ownerUid, uid)
          )
        )
      )
    )
    .orderBy(cosineDistance(leatherKnowledgeDocuments.embedding, queryVec))
    .limit(8);

  const scoredDocs = docRows
    .map((d) => {
      let bonus = 0;
      if (d.applicableBagTypes.includes(project.bagType)) bonus += 0.15;
      if (d.applicableMaterials.includes(project.materialId)) bonus += 0.25;
      if (lowered && (d.title.toLowerCase().includes(lowered) || d.content.toLowerCase().includes(lowered))) {
        bonus += 0.25;
      }
      bonus += d.reviewLevel * 0.04;
      const distVal = typeof d.distance === 'number' ? d.distance : 0.5;
      return { ...d, score: 1 - distVal + bonus };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 4);

  // Matching process rules for current edgeProcess/material
  const procRows = await db
    .select()
    .from(leatherProcessRules)
    .where(eq(leatherProcessRules.isActive, true))
    .limit(6);

  // Layer 4B: Vector Retrieval of Leather Construction Rules via leather_embeddings & pgvector
  const embeddedRules = await db
    .select({
      sourceId: leatherEmbeddings.sourceId,
      distance: cosineDistance(leatherEmbeddings.embedding, queryVec),
    })
    .from(leatherEmbeddings)
    .where(
      and(
        eq(leatherEmbeddings.isActive, true),
        eq(leatherEmbeddings.sourceTable, 'leather_construction_rules')
      )
    )
    .orderBy(cosineDistance(leatherEmbeddings.embedding, queryVec))
    .limit(4);

  const allConstructionRules = await db
    .select({
      id: leatherConstructionRules.id,
      code: leatherConstructionRules.code,
      title: leatherConstructionRules.title,
      fromPart: leatherConstructionRules.fromPart,
      toPart: leatherConstructionRules.toPart,
      toleranceMm: leatherConstructionRules.toleranceMm,
      ruleDetail: leatherConstructionRules.ruleDetail,
      reviewLevel: leatherConstructionRules.reviewLevel,
    })
    .from(leatherConstructionRules)
    .where(eq(leatherConstructionRules.isActive, true));

  const rankedRuleIds = new Set(embeddedRules.map((r) => r.sourceId));
  const constructionRuleRows = [
    ...embeddedRules
      .map((er) => allConstructionRules.find((r) => r.id === er.sourceId))
      .filter((r): r is NonNullable<typeof r> => Boolean(r)),
    ...allConstructionRules.filter((r) => !rankedRuleIds.has(r.id)),
  ].slice(0, 4);

  // Layer 5A: Similar Pattern Cases (ordered via pgvector embeddings index)
  const caseRows = await db
    .select({
      id: leatherPatternCases.id,
      title: leatherPatternCases.title,
      bagType: leatherPatternCases.bagType,
      materialId: leatherPatternCases.materialId,
      processSummary: leatherPatternCases.processSummary,
      productionVerified: leatherPatternCases.productionVerified,
      reviewLevel: leatherPatternCases.reviewLevel,
      distance: cosineDistance(leatherPatternCases.embedding, queryVec),
    })
    .from(leatherPatternCases)
    .where(
      or(
        eq(leatherPatternCases.securityScope, 'A_PLATFORM_PUBLIC'),
        eq(leatherPatternCases.ownerUid, uid)
      )
    )
    .orderBy(cosineDistance(leatherPatternCases.embedding, queryVec))
    .limit(3);

  // Layer 5B: Historical Error & Fix Experiences
  const expRows = await db
    .select({
      id: leatherExperienceRecords.id,
      errorCategory: leatherExperienceRecords.errorCategory,
      errorLocation: leatherExperienceRecords.errorLocation,
      fixMethod: leatherExperienceRecords.fixMethod,
      productionVerified: leatherExperienceRecords.productionVerified,
      reviewLevel: leatherExperienceRecords.reviewLevel,
      distance: cosineDistance(leatherExperienceRecords.embedding, queryVec),
    })
    .from(leatherExperienceRecords)
    .where(
      or(
        eq(leatherExperienceRecords.securityScope, 'A_PLATFORM_PUBLIC'),
        eq(leatherExperienceRecords.ownerUid, uid)
      )
    )
    .orderBy(cosineDistance(leatherExperienceRecords.embedding, queryVec))
    .limit(3);

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
    constructionRules: constructionRuleRows,
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

/**
 * Upsert or deduplicate/merge a memory item into ai_memory_items.
 */
export async function upsertMemoryItemWithMerge(params: {
  ownerUid: string;
  memoryLayer:
    | 'session'
    | 'user_long_term'
    | 'project_long_term'
    | 'engineering_knowledge'
    | 'historical_experience';
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
  if (!isPostgresConfigured) return memUpsertMemoryItemWithMerge(params);
  await ensureIntelligenceSeeded();

  // Check user consent for personal long-term preference memory
  if (params.memoryLayer === 'user_long_term') {
    const u = await getUserByUid(params.ownerUid);
    if (u?.preferencesJson?.memoryConsentEnabled === false) {
      return null;
    }
  }

  const embedding = await generateSemanticEmbedding(
    `${params.memoryKey} ${params.content} ${(params.applicableBagTypes ?? []).join(' ')}`
  );

  // Deduplicate / merge if same key & owner exists
  const existing = await db
    .select()
    .from(aiMemoryItems)
    .where(
      and(
        eq(aiMemoryItems.ownerUid, params.ownerUid),
        eq(aiMemoryItems.memoryLayer, params.memoryLayer),
        eq(aiMemoryItems.memoryKey, params.memoryKey),
        eq(aiMemoryItems.isActive, true)
      )
    )
    .limit(1);

  if (existing[0]) {
    const prev = existing[0];
    const [updated] = await db
      .update(aiMemoryItems)
      .set({
        content: params.content,
        mergedCount: prev.mergedCount + 1,
        confidence: Math.min(0.99, Math.max(prev.confidence, params.confidence ?? 0.85)),
        reviewLevel: Math.max(prev.reviewLevel, params.reviewLevel ?? 3),
        embedding,
        updatedAt: new Date(),
      })
      .where(eq(aiMemoryItems.id, prev.id))
      .returning();
    return updated;
  }

  const id = `mem_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
  const [inserted] = await db
    .insert(aiMemoryItems)
    .values({
      id,
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
    })
    .returning();

  return inserted;
}

/**
 * Records all 11 required feedback points for every AI CAD operation (Section 5).
 * Extracts reusable learning candidates (always starting at LEVEL 1: AI Speculation).
 */
export async function recordAiFeedbackAndExtractLearning(params: {
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
  correctionClassification?:
    | 'project_specific'
    | 'user_preference'
    | 'reusable_experience'
    | 'general_rule_candidate';
  correctionDetail?: string;
}) {
  if (!isPostgresConfigured) return memRecordAiFeedbackAndExtractLearning(params);
  await ensureIntelligenceSeeded();

  const eventId = `fb_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
  const [event] = await db
    .insert(aiFeedbackEvents)
    .values({
      id: eventId,
      projectId: params.project.id,
      ownerUid: params.ownerUid,
      userOriginalPrompt: params.userOriginalPrompt,
      interpretedTask: params.interpretedTask,
      retrievedKnowledgeIds: params.retrievedKnowledgeIds,
      usedCaseIds: params.usedCaseIds,
      generatedParameters: {
        widthMm: params.project.dimensions.widthMm,
        heightMm: params.project.dimensions.heightMm,
        depthMm: params.project.dimensions.depthMm,
        materialId: params.project.materialId,
        edgeProcess: params.project.edgeProcess,
        seamAllowanceMm: params.project.dimensions.seamAllowanceMm,
      },
      cadOperations: params.commands,
      geometryDiffSummary: params.diffSummary,
      validationPassed: params.validationPassed,
      userAccepted: params.userAccepted,
      patternMakerCorrected: Boolean(params.patternMakerCorrected),
      correctionClassification: params.correctionClassification ?? null,
      correctionDetail: params.correctionDetail ?? '',
      productionResult: params.project.qualitySignoff?.physicalSamplePassed ? 'passed' : 'pending',
    })
    .returning();

  // Extract material / process preferences into Layer 2 user memory if user changed material
  for (const cmd of params.commands) {
    if (cmd.intent === 'change_material' && cmd.parameters?.materialId) {
      await upsertMemoryItemWithMerge({
        ownerUid: params.ownerUid,
        memoryLayer: 'user_long_term',
        memoryKey: `preferred_material_${params.project.bagType}`,
        content: `用户在 ${params.project.bagType} 设计中倾向选用皮料 ${cmd.parameters.materialId}（${params.project.edgeProcess}）`,
        applicableBagTypes: [params.project.bagType],
        applicableMaterials: [cmd.parameters.materialId],
        source: `项目 ${params.project.name} 对话操作`,
        sourceProjectId: params.project.id,
        securityScope: 'C_USER_PRIVATE',
        reviewLevel: 3, // LEVEL 3: User confirmed
        confidence: 0.85,
      });

      const user = await getUserByUid(params.ownerUid);
      if (user?.preferencesJson?.memoryConsentEnabled !== false) {
        const mats = new Set(user?.preferencesJson?.preferredMaterials ?? []);
        mats.add(cmd.parameters.materialId);
        await updateUserPreferences(params.ownerUid, {
          preferredMaterials: Array.from(mats),
        });
      }
    }
  }

  // If this was a manual correction or structural fix, create a LEVEL 1 Learning Candidate
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

    await db.insert(aiLearningCandidates).values({
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
      reviewLevel: params.validationPassed ? 2 : 1, // LEVEL 1 (AI Speculation) or LEVEL 2 (Geometry Verified) — NEVER auto-promoted to Level 4/5!
      status: 'pending',
      securityScope: 'D_AI_CANDIDATE',
      ownerUid: params.ownerUid,
    });
  }

  return event;
}

/**
 * Human-in-the-loop Review Workflow for AI Learning Candidates (LEVEL 1 -> LEVEL 5).
 * Only explicitly approved LEVEL 4/5 candidates promote into shared Engineering Knowledge.
 */
export async function reviewLearningCandidate(params: {
  candidateId: string;
  reviewerUid: string;
  reviewerName: string;
  action: 'approve' | 'reject' | 'promote_level';
  targetReviewLevel: number; // 2..5
  securityScope?: 'A_PLATFORM_PUBLIC' | 'B_ENTERPRISE_PRIVATE' | 'C_USER_PRIVATE';
  reviewNote?: string;
  createEvalCase?: boolean;
}) {
  if (!isPostgresConfigured) return memReviewLearningCandidate(params);
  await ensureIntelligenceSeeded();

  const rows = await db
    .select()
    .from(aiLearningCandidates)
    .where(eq(aiLearningCandidates.id, params.candidateId))
    .limit(1);

  const cand = rows[0];
  if (!cand) {
    throw new Error('未找到指定的待审核知识条目');
  }

  if (params.action === 'reject') {
    const [rejected] = await db
      .update(aiLearningCandidates)
      .set({
        status: 'rejected',
        reviewerUid: params.reviewerUid,
        reviewerName: params.reviewerName,
        reviewNote: params.reviewNote ?? '专业审核未通过，驳回待审经验',
        updatedAt: new Date(),
      })
      .where(eq(aiLearningCandidates.id, cand.id))
      .returning();
    return { candidate: rejected, promotedDoc: null };
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

    const existingDocRows = await db
      .select({
        id: leatherKnowledgeDocuments.id,
        title: leatherKnowledgeDocuments.title,
        content: leatherKnowledgeDocuments.content,
        reviewLevel: leatherKnowledgeDocuments.reviewLevel,
        securityScope: leatherKnowledgeDocuments.securityScope,
        version: leatherKnowledgeDocuments.version,
        isActive: leatherKnowledgeDocuments.isActive,
      })
      .from(leatherKnowledgeDocuments)
      .where(eq(leatherKnowledgeDocuments.id, docId))
      .limit(1);

    const prevDocSnapshot = existingDocRows[0] ?? null;

    const [doc] = await db
      .insert(leatherKnowledgeDocuments)
      .values({
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
      })
      .onConflictDoUpdate({
        target: leatherKnowledgeDocuments.id,
        set: {
          content: cand.proposedContent,
          version: newVersionTag,
          reviewLevel: nextLevel,
          securityScope: scope,
          confidence: nextLevel === 5 ? 0.96 : 0.9,
          isActive: true,
          embedding,
          updatedAt: new Date(),
        },
      })
      .returning();

    promotedDoc = doc;
    promotedDocId = doc.id;

    // Record immutable version snapshot
    await db.insert(aiKnowledgeVersions).values({
      id: `kver_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      versionTag: newVersionTag,
      entityType: 'knowledge_document',
      entityId: doc.id,
      changeSummary: `审核升级至 ${REVIEW_LEVEL_LABELS[nextLevel]}：${cand.title}`,
      previousSnapshot: prevDocSnapshot,
      newSnapshot: {
        id: doc.id,
        title: doc.title,
        content: doc.content,
        reviewLevel: doc.reviewLevel,
        securityScope: doc.securityScope,
        version: doc.version,
        isActive: doc.isActive,
      },
      authorUid: params.reviewerUid,
      reviewerName: params.reviewerName,
      reviewLevel: nextLevel,
    });

    // Step 8 of continuous learning workflow: create new evaluation test case
    if (params.createEvalCase !== false) {
      await db
        .insert(aiEvaluationDatasets)
        .values({
          id: `eval_learned_${Date.now()}`,
          name: `学习验证：${cand.title.slice(0, 32)}`,
          category: 'memory_accuracy',
          bagType: cand.applicableBagTypes[0] || 'tote',
          inputPrompt: cand.title,
          inputContext: { query: cand.title },
          expectedCriteria: { expectedKeywords: [cand.title.slice(0, 4)] },
          baselineScore: 1.0,
          isActive: true,
        })
        .onConflictDoNothing();
    }
  }

  const [updatedCand] = await db
    .update(aiLearningCandidates)
    .set({
      reviewLevel: nextLevel,
      status: shouldPromoteToKb ? 'approved' : 'pending',
      reviewerUid: params.reviewerUid,
      reviewerName: params.reviewerName,
      reviewNote: params.reviewNote ?? `已由 ${params.reviewerName} 核定为 LEVEL ${nextLevel}`,
      promotedKnowledgeId: promotedDocId ?? null,
      updatedAt: new Date(),
    })
    .where(eq(aiLearningCandidates.id, cand.id))
    .returning();

  return { candidate: updatedCand, promotedDoc };
}

/**
 * Archive a verified Project into leather_pattern_cases (Section 8)
 * respecting intellectual property isolation (default C_USER_PRIVATE unless explicitly shared).
 */
export async function archiveProjectAsCase(params: {
  project: Project;
  ownerUid: string;
  securityScope: 'A_PLATFORM_PUBLIC' | 'B_ENTERPRISE_PRIVATE' | 'C_USER_PRIVATE';
  productionResultNote: string;
}) {
  if (!isPostgresConfigured) return memArchiveProjectAsCase(params);
  await ensureIntelligenceSeeded();
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

  const [saved] = await db
    .insert(leatherPatternCases)
    .values({
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
      structureBreakdown: project.components.map(
        (c) => `${c.partCode} ${c.name} (${c.widthMm}×${c.heightMm}mm)`
      ),
      componentRelations: project.relations.map(
        (r) => `${r.fromComponentId}.${r.fromEdgeId} -> ${r.toComponentId}.${r.toEdgeId}`
      ),
      nativePatternsSummary: project.patterns.map((p) => ({
        partCode: p.partCode,
        name: p.name,
        widthMm: p.boundingBoxMm.width,
        heightMm: p.boundingBoxMm.height,
        quantity: p.quantity,
      })),
      processSummary,
      validationPassed: project.validation.passed,
      productionVerified: isProdVerified,
      productionResultNote:
        params.productionResultNote ||
        (isProdVerified ? '实物样板验证通过' : '数字版型归档（参考用，投产前需实物打样）'),
      securityScope: params.securityScope,
      ownerUid: params.ownerUid,
      source: `项目 ${project.name} 归档`,
      version: `v${project.currentVersion}`,
      confidence: isProdVerified ? 0.96 : 0.85,
      reviewLevel,
      embedding,
    })
    .returning();

  await db
    .insert(leatherEmbeddings)
    .values({
      id: `emb_case_${saved.id}`,
      sourceTable: 'leather_pattern_cases',
      sourceId: saved.id,
      constructionRuleId: null,
      patternCaseId: saved.id,
      title: saved.title,
      contentText: `${saved.bagType} ${saved.materialId} ${saved.edgeProcess} · ${saved.processSummary} · ${saved.productionResultNote}`,
      applicableBagTypes: [saved.bagType],
      applicableMaterials: [saved.materialId],
      relatedParts: [],
      reviewLevel: saved.reviewLevel,
      securityScope: saved.securityScope,
      ownerUid: saved.ownerUid,
      embeddingModel: 'gemini-embedding-001',
      dimensions: 256,
      embedding,
      metadataJson: {
        productionVerified: saved.productionVerified,
        validationPassed: saved.validationPassed,
      },
      isActive: true,
    })
    .onConflictDoNothing();

  return saved;
}

/**
 * Runs the 10-Capability Fixed Regression Evaluation Suite (Section 9).
 * Blocks deployment if any benchmark regresses below baselineScore.
 */
export async function runAiEvaluationSuite(uid: string) {
  if (!isPostgresConfigured) return memRunAiEvaluationSuite(uid);
  await ensureIntelligenceSeeded();

  const datasets = await db
    .select()
    .from(aiEvaluationDatasets)
    .where(eq(aiEvaluationDatasets.isActive, true));

  const latestVer = await db
    .select({ versionTag: aiKnowledgeVersions.versionTag })
    .from(aiKnowledgeVersions)
    .orderBy(desc(aiKnowledgeVersions.createdAt))
    .limit(1);

  const versionTag = latestVer[0]?.versionTag ?? KNOWLEDGE_BASE_META.version;
  const runId = `evalrun_${Date.now()}`;
  const modelName = process.env.GEMINI_MODEL || 'gemini-4-hydrogen';

  const results = [];
  let anyRegression = false;

  for (const ds of datasets) {
    const startMs = Date.now();
    let passed = false;
    let score = 0;
    let observedSummary = '';
    const criteria = ds.expectedCriteria;

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
            {
              intent: 'resize_product',
              target: 'product',
              operation: 'increment',
              parameters: { deltaWidthMm: deltaW },
            },
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
                  {
                    intent: 'modify_geometry',
                    target: 'gusset',
                    operation: 'set_style',
                    parameters: { gussetStyle: 'curved', gussetCurveRadiusMm: 22 },
                  },
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
            {
              intent: 'optimize_pattern',
              target: 'product',
              operation: 'optimize',
              parameters: { optimizationGoal: 'italian_luxury' },
            },
          ]);
          const nest = computeSmartNesting(
            tx.nextSnapshot.patterns,
            tx.nextSnapshot.materialId,
            tx.nextSnapshot.hardware
          );
          passed =
            tx.committed &&
            tx.nextSnapshot.materialId === (criteria.expectedMaterialId ?? 'box_calf_15') &&
            nest.unplacedPieces.length === 0;
          score = passed ? 1.0 : 0.4;
          observedSummary = `材料=${tx.nextSnapshot.materialId}, 排料利用率=${nest.utilizationPct}%`;
          break;
        }
        case 'memory_accuracy':
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
          const mem = await retrieveRelevantMemoryForPrompt(uid, fakeProj, ds.inputPrompt);
          const combinedText = mem.engineeringKnowledge.map((k) => `${k.title} ${k.content}`).join(' ') +
            mem.experienceRecords.map((e) => e.fixMethod).join(' ');
          const kws = criteria.expectedKeywords ?? [];
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
    });
  }

  for (const r of results) {
    await db.insert(aiEvaluationResults).values(r);
  }

  const passedCount = results.filter((r) => r.passed).length;
  return {
    runId,
    knowledgeVersionTag: versionTag,
    modelName,
    totalTests: results.length,
    passedCount,
    avgScore: results.length
      ? Math.round((results.reduce((s, r) => s + r.score, 0) / results.length) * 100) / 100
      : 0,
    regressionDetected: anyRegression,
    allowedToDeploy: !anyRegression,
    results,
  };
}

export async function getIntelligenceOverview(uid: string) {
  if (!isPostgresConfigured) return memGetIntelligenceOverview(uid);
  await ensureIntelligenceSeeded();

  const [
    userProfile,
    docs,
    cases,
    experiences,
    memories,
    candidates,
    feedbacks,
    versions,
    evalDatasets,
    latestEvals,
    procRules,
    constRules,
  ] = await Promise.all([
    getUserByUid(uid),
    db
      .select({
        id: leatherKnowledgeDocuments.id,
        knowledgeType: leatherKnowledgeDocuments.knowledgeType,
        title: leatherKnowledgeDocuments.title,
        content: leatherKnowledgeDocuments.content,
        applicableBagTypes: leatherKnowledgeDocuments.applicableBagTypes,
        applicableMaterials: leatherKnowledgeDocuments.applicableMaterials,
        relatedParts: leatherKnowledgeDocuments.relatedParts,
        source: leatherKnowledgeDocuments.source,
        version: leatherKnowledgeDocuments.version,
        confidence: leatherKnowledgeDocuments.confidence,
        reviewLevel: leatherKnowledgeDocuments.reviewLevel,
        securityScope: leatherKnowledgeDocuments.securityScope,
        ownerUid: leatherKnowledgeDocuments.ownerUid,
        isActive: leatherKnowledgeDocuments.isActive,
        createdAt: leatherKnowledgeDocuments.createdAt,
        updatedAt: leatherKnowledgeDocuments.updatedAt,
      })
      .from(leatherKnowledgeDocuments)
      .where(
        and(
          eq(leatherKnowledgeDocuments.isActive, true),
          or(
            eq(leatherKnowledgeDocuments.securityScope, 'A_PLATFORM_PUBLIC'),
            eq(leatherKnowledgeDocuments.ownerUid, uid)
          )
        )
      )
      .orderBy(desc(leatherKnowledgeDocuments.reviewLevel), desc(leatherKnowledgeDocuments.updatedAt)),
    db
      .select({
        id: leatherPatternCases.id,
        projectId: leatherPatternCases.projectId,
        title: leatherPatternCases.title,
        bagType: leatherPatternCases.bagType,
        materialId: leatherPatternCases.materialId,
        edgeProcess: leatherPatternCases.edgeProcess,
        photoSummary: leatherPatternCases.photoSummary,
        dimensionsSummary: leatherPatternCases.dimensionsSummary,
        structureBreakdown: leatherPatternCases.structureBreakdown,
        processSummary: leatherPatternCases.processSummary,
        validationPassed: leatherPatternCases.validationPassed,
        productionVerified: leatherPatternCases.productionVerified,
        productionResultNote: leatherPatternCases.productionResultNote,
        securityScope: leatherPatternCases.securityScope,
        reviewLevel: leatherPatternCases.reviewLevel,
        version: leatherPatternCases.version,
        createdAt: leatherPatternCases.createdAt,
      })
      .from(leatherPatternCases)
      .where(
        or(
          eq(leatherPatternCases.securityScope, 'A_PLATFORM_PUBLIC'),
          eq(leatherPatternCases.ownerUid, uid)
        )
      )
      .orderBy(desc(leatherPatternCases.createdAt)),
    db
      .select({
        id: leatherExperienceRecords.id,
        bagType: leatherExperienceRecords.bagType,
        materialId: leatherExperienceRecords.materialId,
        relatedParts: leatherExperienceRecords.relatedParts,
        errorCategory: leatherExperienceRecords.errorCategory,
        errorLocation: leatherExperienceRecords.errorLocation,
        rootCause: leatherExperienceRecords.rootCause,
        fixMethod: leatherExperienceRecords.fixMethod,
        geometryPassed: leatherExperienceRecords.geometryPassed,
        patternMakerReviewed: leatherExperienceRecords.patternMakerReviewed,
        productionVerified: leatherExperienceRecords.productionVerified,
        outcomeSummary: leatherExperienceRecords.outcomeSummary,
        reviewLevel: leatherExperienceRecords.reviewLevel,
        createdAt: leatherExperienceRecords.createdAt,
      })
      .from(leatherExperienceRecords)
      .where(
        or(
          eq(leatherExperienceRecords.securityScope, 'A_PLATFORM_PUBLIC'),
          eq(leatherExperienceRecords.ownerUid, uid)
        )
      )
      .orderBy(desc(leatherExperienceRecords.createdAt)),
    db
      .select({
        id: aiMemoryItems.id,
        memoryLayer: aiMemoryItems.memoryLayer,
        memoryKey: aiMemoryItems.memoryKey,
        content: aiMemoryItems.content,
        applicableBagTypes: aiMemoryItems.applicableBagTypes,
        applicableMaterials: aiMemoryItems.applicableMaterials,
        source: aiMemoryItems.source,
        securityScope: aiMemoryItems.securityScope,
        reviewLevel: aiMemoryItems.reviewLevel,
        confidence: aiMemoryItems.confidence,
        mergedCount: aiMemoryItems.mergedCount,
        isActive: aiMemoryItems.isActive,
        updatedAt: aiMemoryItems.updatedAt,
      })
      .from(aiMemoryItems)
      .where(and(eq(aiMemoryItems.ownerUid, uid), eq(aiMemoryItems.isActive, true)))
      .orderBy(desc(aiMemoryItems.updatedAt))
      .limit(30),
    db
      .select()
      .from(aiLearningCandidates)
      .where(or(eq(aiLearningCandidates.ownerUid, uid), sql`${aiLearningCandidates.ownerUid} IS NULL`))
      .orderBy(desc(aiLearningCandidates.createdAt))
      .limit(30),
    db
      .select()
      .from(aiFeedbackEvents)
      .where(eq(aiFeedbackEvents.ownerUid, uid))
      .orderBy(desc(aiFeedbackEvents.createdAt))
      .limit(20),
    db
      .select()
      .from(aiKnowledgeVersions)
      .orderBy(desc(aiKnowledgeVersions.createdAt))
      .limit(15),
    db
      .select()
      .from(aiEvaluationDatasets)
      .where(eq(aiEvaluationDatasets.isActive, true)),
    db
      .select()
      .from(aiEvaluationResults)
      .orderBy(desc(aiEvaluationResults.createdAt))
      .limit(20),
    db.select().from(leatherProcessRules).where(eq(leatherProcessRules.isActive, true)),
    db.select().from(leatherConstructionRules).where(eq(leatherConstructionRules.isActive, true)),
  ]);

  return {
    knowledgeVersion: versions[0]?.versionTag ?? KNOWLEDGE_BASE_META.version,
    userPreferences: userProfile?.preferencesJson ?? { memoryConsentEnabled: true },
    knowledgeDocs: docs,
    processRules: procRules,
    constructionRules: constRules,
    patternCases: cases,
    experienceRecords: experiences,
    memories,
    learningCandidates: candidates,
    feedbackEvents: feedbacks,
    knowledgeVersions: versions,
    evalDatasets,
    latestEvalResults: latestEvals,
    blindTests: await listBlindTests(uid),
    customTemplates: await listCustomMasterTemplates(uid),
    factoryFeedbacks: await listFactoryFeedbacks(uid),
    latestBenchmark: await getLatestAccuracyBenchmark(uid),
    trainingSamples: await listTrainingSamples(uid),
  };
}

export interface PatternCaseSummary {
  id: string;
  title: string;
  bagType: string;
  dimensionsSummary: {
    widthMm: number;
    heightMm: number;
    depthMm: number;
    handleLengthMm: number;
    seamAllowanceMm: number;
  };
  productionVerified: boolean;
}

export async function listPatternCasesForMatching(uid: string): Promise<PatternCaseSummary[]> {
  if (!isPostgresConfigured) {
    const overview = await memGetIntelligenceOverview(uid);
    return overview.patternCases;
  }
  await ensureIntelligenceSeeded();
  const rows = await db
    .select({
      id: leatherPatternCases.id,
      title: leatherPatternCases.title,
      bagType: leatherPatternCases.bagType,
      dimensionsSummary: leatherPatternCases.dimensionsSummary,
      productionVerified: leatherPatternCases.productionVerified,
    })
    .from(leatherPatternCases)
    .where(
      or(
        eq(leatherPatternCases.securityScope, 'A_PLATFORM_PUBLIC'),
        eq(leatherPatternCases.ownerUid, uid)
      )
    )
    .orderBy(desc(leatherPatternCases.createdAt));
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    bagType: r.bagType,
    dimensionsSummary: r.dimensionsSummary ?? {
      widthMm: 300,
      heightMm: 240,
      depthMm: 120,
      handleLengthMm: 420,
      seamAllowanceMm: 5,
    },
    productionVerified: Boolean(r.productionVerified),
  }));
}

export async function listBlindTests(uid: string): Promise<BlindTestRecord[]> {
  if (!isPostgresConfigured) return memListBlindTests();
  await ensureIntelligenceSeeded();
  const rows = await db
    .select()
    .from(blindTestRecords)
    .where(eq(blindTestRecords.ownerUid, uid))
    .orderBy(desc(blindTestRecords.createdAt))
    .limit(40);
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    bagType: r.bagType as BagType,
    structureType: r.structureType as BlindTestRecord['structureType'],
    photoCount: r.photoCount,
    actualDimensionsMm: r.actualDimensionsMm,
    aiInitialDimensionsMm: r.aiInitialDimensionsMm,
    matchedTemplateId: r.matchedTemplateId,
    aiInitialSummary: r.aiInitialSummary,
    manualCorrections: r.manualCorrections,
    physicalSampleOutcome: r.physicalSampleOutcome as BlindTestRecord['physicalSampleOutcome'],
    dimensionErrorMm: r.dimensionErrorMm,
    maxSeamDiffMm: r.maxSeamDiffMm,
    completenessScore: r.completenessScore,
    processReasonable: r.processReasonable,
    aiRecognitionPassed: r.aiRecognitionPassed,
    geometry2DPassed: r.geometry2DPassed,
    seamsAndProcessPassed: r.seamsAndProcessPassed,
    physicalProductionPassed: r.physicalProductionPassed,
    testerNotes: r.testerNotes,
    createdAt: r.createdAt.toISOString(),
  }));
}

export async function createBlindTestRecord(
  uid: string,
  input: Omit<BlindTestRecord, 'id' | 'createdAt' | 'dimensionErrorMm'>
): Promise<BlindTestRecord> {
  if (!isPostgresConfigured) return memCreateBlindTestRecord(input);
  await ensureIntelligenceSeeded();
  const dw = Math.abs(input.actualDimensionsMm.widthMm - input.aiInitialDimensionsMm.widthMm);
  const dh = Math.abs(input.actualDimensionsMm.heightMm - input.aiInitialDimensionsMm.heightMm);
  const dd = Math.abs(input.actualDimensionsMm.depthMm - input.aiInitialDimensionsMm.depthMm);
  const dimensionErrorMm = Math.round(Math.max(dw, dh, dd) * 10) / 10;
  const proofs = deriveBlindTestProofs(input);

  const [saved] = await db
    .insert(blindTestRecords)
    .values({
      id: `bt_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      ownerUid: uid,
      title: input.title,
      bagType: input.bagType,
      structureType: input.structureType,
      photoCount: input.photoCount,
      actualDimensionsMm: input.actualDimensionsMm,
      aiInitialDimensionsMm: input.aiInitialDimensionsMm,
      matchedTemplateId: input.matchedTemplateId,
      aiInitialSummary: input.aiInitialSummary,
      manualCorrections: input.manualCorrections,
      physicalSampleOutcome: input.physicalSampleOutcome,
      dimensionErrorMm,
      maxSeamDiffMm: input.maxSeamDiffMm,
      completenessScore: input.completenessScore,
      processReasonable: input.processReasonable,
      aiRecognitionPassed: proofs.aiRecognitionPassed,
      geometry2DPassed: proofs.geometry2DPassed,
      seamsAndProcessPassed: proofs.seamsAndProcessPassed,
      physicalProductionPassed: proofs.physicalProductionPassed,
      testerNotes: input.testerNotes,
    })
    .returning();

  return {
    id: saved.id,
    title: saved.title,
    bagType: saved.bagType as BagType,
    structureType: saved.structureType as BlindTestRecord['structureType'],
    photoCount: saved.photoCount,
    actualDimensionsMm: saved.actualDimensionsMm,
    aiInitialDimensionsMm: saved.aiInitialDimensionsMm,
    matchedTemplateId: saved.matchedTemplateId,
    aiInitialSummary: saved.aiInitialSummary,
    manualCorrections: saved.manualCorrections,
    physicalSampleOutcome: saved.physicalSampleOutcome as BlindTestRecord['physicalSampleOutcome'],
    dimensionErrorMm: saved.dimensionErrorMm,
    maxSeamDiffMm: saved.maxSeamDiffMm,
    completenessScore: saved.completenessScore,
    processReasonable: saved.processReasonable,
    aiRecognitionPassed: saved.aiRecognitionPassed,
    geometry2DPassed: saved.geometry2DPassed,
    seamsAndProcessPassed: saved.seamsAndProcessPassed,
    physicalProductionPassed: saved.physicalProductionPassed,
    testerNotes: saved.testerNotes,
    createdAt: saved.createdAt.toISOString(),
  };
}

export async function listCustomMasterTemplates(uid: string): Promise<MasterPatternTemplate[]> {
  if (!isPostgresConfigured) return memListCustomMasterTemplates();
  await ensureIntelligenceSeeded();
  const rows = await db
    .select()
    .from(masterPatternTemplates)
    .where(or(eq(masterPatternTemplates.ownerUid, uid), eq(masterPatternTemplates.status, 'published')))
    .orderBy(desc(masterPatternTemplates.updatedAt))
    .limit(50);
  return rows.map((r) => ({
    ...(r.templateJson as unknown as MasterPatternTemplate),
    id: r.id,
    name: r.name,
    bagType: r.bagType as BagType,
    structureType: r.structureType as MasterPatternTemplate['structureType'],
    status: r.status as MasterPatternTemplate['status'],
    templateVersion: r.templateVersion,
    isCustom: true,
  }));
}

export async function createCustomMasterTemplate(
  uid: string,
  tpl: MasterPatternTemplate
): Promise<MasterPatternTemplate> {
  if (!isPostgresConfigured) return memCreateCustomMasterTemplate(tpl);
  await ensureIntelligenceSeeded();
  const savedObj: MasterPatternTemplate = {
    ...tpl,
    isCustom: true,
    status: tpl.status ?? 'draft',
    templateVersion: tpl.templateVersion ?? 'V1.0-CUSTOM',
  };
  await db.insert(masterPatternTemplates).values({
    id: savedObj.id,
    ownerUid: uid,
    name: savedObj.name,
    bagType: savedObj.bagType,
    structureType: savedObj.structureType,
    status: savedObj.status ?? 'draft',
    templateVersion: savedObj.templateVersion ?? 'V1.0-CUSTOM',
    templateJson: savedObj as unknown as Record<string, unknown>,
  });
  return savedObj;
}

export async function updateCustomMasterTemplate(
  uid: string,
  id: string,
  patch: Partial<MasterPatternTemplate>
): Promise<MasterPatternTemplate | null> {
  if (!isPostgresConfigured) return memUpdateCustomMasterTemplate(id, patch);
  await ensureIntelligenceSeeded();
  const rows = await db
    .select()
    .from(masterPatternTemplates)
    .where(and(eq(masterPatternTemplates.id, id), eq(masterPatternTemplates.ownerUid, uid)))
    .limit(1);
  if (!rows[0]) return null;
  const existing = rows[0].templateJson as unknown as MasterPatternTemplate;
  const merged: MasterPatternTemplate = {
    ...existing,
    ...patch,
    id,
    isCustom: true,
  };
  await db
    .update(masterPatternTemplates)
    .set({
      name: merged.name,
      bagType: merged.bagType,
      structureType: merged.structureType,
      status: merged.status ?? 'draft',
      templateVersion: merged.templateVersion ?? 'V1.0-CUSTOM',
      templateJson: merged as unknown as Record<string, unknown>,
      updatedAt: new Date(),
    })
    .where(eq(masterPatternTemplates.id, id));
  return merged;
}

export async function listFactoryFeedbacks(
  uid: string,
  projectId?: string
): Promise<FactoryProductionFeedback[]> {
  if (!isPostgresConfigured) return memListFactoryFeedbacks(projectId);
  await ensureIntelligenceSeeded();
  const rows = await db
    .select()
    .from(factoryProductionFeedbacks)
    .where(
      projectId
        ? and(eq(factoryProductionFeedbacks.ownerUid, uid), eq(factoryProductionFeedbacks.projectId, projectId))
        : eq(factoryProductionFeedbacks.ownerUid, uid)
    )
    .orderBy(desc(factoryProductionFeedbacks.createdAt))
    .limit(50);
  return rows.map((r) => ({
    id: r.id,
    projectId: r.projectId,
    projectName: r.projectName,
    projectVersion: r.projectVersion,
    bagType: r.bagType as BagType,
    materialId: r.materialId,
    actualCutDeviationMm: r.actualCutDeviationMm,
    stitchingCondition: r.stitchingCondition,
    seamDeviationMm: r.seamDeviationMm,
    materialIssues: r.materialIssues,
    skivingIssues: r.skivingIssues,
    pieceDeformation: r.pieceDeformation,
    finishedDimensionsMm: r.finishedDimensionsMm,
    appearanceRating: Math.min(5, Math.max(1, r.appearanceRating)) as 1 | 2 | 3 | 4 | 5,
    patternMakerCorrections: r.patternMakerCorrections,
    conclusion: r.conclusion as FactoryProductionFeedback['conclusion'],
    recordedBy: r.recordedBy,
    promotedToExperienceId: r.promotedToExperienceId ?? undefined,
    createdAt: r.createdAt.toISOString(),
  }));
}

export async function createFactoryFeedback(
  uid: string,
  input: Omit<FactoryProductionFeedback, 'id' | 'createdAt' | 'promotedToExperienceId'>
): Promise<FactoryProductionFeedback> {
  if (!isPostgresConfigured) return memCreateFactoryFeedback(uid, input);
  await ensureIntelligenceSeeded();
  const expId = `exp_ff_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
  const hasIssue =
    input.conclusion !== 'approved_for_mass_production' ||
    input.patternMakerCorrections.length > 0 ||
    input.seamDeviationMm > 1.2;

  await db.insert(leatherExperienceRecords).values({
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
    fixMethod: input.patternMakerCorrections.join('；') || input.stitchingCondition,
    geometryPassed: input.seamDeviationMm <= 1.2,
    patternMakerReviewed: true,
    productionVerified: input.conclusion === 'approved_for_mass_production',
    outcomeSummary: `成包实测 ${input.finishedDimensionsMm.widthMm}×${input.finishedDimensionsMm.heightMm}×${input.finishedDimensionsMm.depthMm}mm · 外观评分 ${input.appearanceRating}/5`,
    securityScope: 'A_PLATFORM_PUBLIC',
    ownerUid: uid,
    reviewLevel: input.conclusion === 'approved_for_mass_production' ? 5 : 4,
    embedding: computeDeterministicEmbedding(
      `${input.bagType} ${input.materialId} ${input.materialIssues} ${input.patternMakerCorrections.join(' ')}`
    ),
  });

  if (hasIssue) {
    await db.insert(aiLearningCandidates).values({
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
    });
  }

  const [saved] = await db
    .insert(factoryProductionFeedbacks)
    .values({
      id: `ff_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      ownerUid: uid,
      projectId: input.projectId,
      projectName: input.projectName,
      projectVersion: input.projectVersion,
      bagType: input.bagType,
      materialId: input.materialId,
      actualCutDeviationMm: input.actualCutDeviationMm,
      stitchingCondition: input.stitchingCondition,
      seamDeviationMm: input.seamDeviationMm,
      materialIssues: input.materialIssues,
      skivingIssues: input.skivingIssues,
      pieceDeformation: input.pieceDeformation,
      finishedDimensionsMm: input.finishedDimensionsMm,
      appearanceRating: input.appearanceRating,
      patternMakerCorrections: input.patternMakerCorrections,
      conclusion: input.conclusion,
      recordedBy: input.recordedBy,
      promotedToExperienceId: expId,
    })
    .returning();

  return {
    id: saved.id,
    projectId: saved.projectId,
    projectName: saved.projectName,
    projectVersion: saved.projectVersion,
    bagType: saved.bagType as BagType,
    materialId: saved.materialId,
    actualCutDeviationMm: saved.actualCutDeviationMm,
    stitchingCondition: saved.stitchingCondition,
    seamDeviationMm: saved.seamDeviationMm,
    materialIssues: saved.materialIssues,
    skivingIssues: saved.skivingIssues,
    pieceDeformation: saved.pieceDeformation,
    finishedDimensionsMm: saved.finishedDimensionsMm,
    appearanceRating: Math.min(5, Math.max(1, saved.appearanceRating)) as 1 | 2 | 3 | 4 | 5,
    patternMakerCorrections: saved.patternMakerCorrections,
    conclusion: saved.conclusion as FactoryProductionFeedback['conclusion'],
    recordedBy: saved.recordedBy,
    promotedToExperienceId: saved.promotedToExperienceId ?? undefined,
    createdAt: saved.createdAt.toISOString(),
  };
}

export async function getLatestAccuracyBenchmark(uid: string): Promise<AccuracyBenchmarkSummary> {
  if (!isPostgresConfigured) return memGetLatestBenchmark();
  await ensureIntelligenceSeeded();
  const rows = await db
    .select()
    .from(accuracyBenchmarkRuns)
    .where(eq(accuracyBenchmarkRuns.ownerUid, uid))
    .orderBy(desc(accuracyBenchmarkRuns.createdAt))
    .limit(1);
  if (rows[0]) {
    return rows[0].summaryJson as unknown as AccuracyBenchmarkSummary;
  }
  return runAccuracyBenchmark(uid);
}

export async function runAccuracyBenchmark(uid: string): Promise<AccuracyBenchmarkSummary> {
  if (!isPostgresConfigured) return memRunAccuracyBenchmark();
  await ensureIntelligenceSeeded();
  const summary = executeAccuracyBenchmarkSuite();
  await db.insert(accuracyBenchmarkRuns).values({
    id: `bm_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    runId: summary.runId,
    ownerUid: uid,
    modelVersion: summary.modelVersion,
    datasetVersion: summary.datasetVersion,
    summaryJson: summary as unknown as Record<string, unknown>,
  });
  return summary;
}

export async function deleteUserMemoryItem(id: string, uid: string): Promise<boolean> {
  if (!isPostgresConfigured) return memDeleteUserMemoryItem(id, uid);
  const deleted = await db
    .delete(aiMemoryItems)
    .where(and(eq(aiMemoryItems.id, id), eq(aiMemoryItems.ownerUid, uid)))
    .returning({ id: aiMemoryItems.id });
  return deleted.length > 0;
}

/**
 * Rollback a knowledge version entry cleanly without destroying audit history (Section 6).
 */
export async function rollbackKnowledgeVersion(params: {
  versionId: string;
  reviewerUid: string;
  reviewerName: string;
}) {
  if (!isPostgresConfigured) return memRollbackKnowledgeVersion(params);
  await ensureIntelligenceSeeded();

  const rows = await db
    .select()
    .from(aiKnowledgeVersions)
    .where(eq(aiKnowledgeVersions.id, params.versionId))
    .limit(1);

  const ver = rows[0];
  if (!ver) {
    throw new Error('未找到指定的知识版本记录');
  }
  if (ver.entityId === 'platform_baseline') {
    throw new Error('平台初始基线版本不可回滚停用');
  }

  const prev = ver.previousSnapshot as Record<string, unknown> | null;
  const rollbackTag = `KB-RB-${new Date().toISOString().slice(0, 10)}.${Math.floor(Date.now() % 1000)}`;

  if (ver.entityType === 'knowledge_document') {
    if (prev && typeof prev.content === 'string') {
      const embedding = await generateSemanticEmbedding(
        `${String(prev.title ?? '')} ${prev.content}`
      );
      await db
        .update(leatherKnowledgeDocuments)
        .set({
          title: typeof prev.title === 'string' ? prev.title : undefined,
          content: prev.content,
          reviewLevel: typeof prev.reviewLevel === 'number' ? prev.reviewLevel : 4,
          securityScope: typeof prev.securityScope === 'string' ? prev.securityScope : 'C_USER_PRIVATE',
          version: typeof prev.version === 'string' ? prev.version : rollbackTag,
          isActive: prev.isActive !== false,
          embedding,
          updatedAt: new Date(),
        })
        .where(eq(leatherKnowledgeDocuments.id, ver.entityId));
    } else {
      await db
        .update(leatherKnowledgeDocuments)
        .set({
          isActive: false,
          supersededById: 'rolled_back',
          updatedAt: new Date(),
        })
        .where(eq(leatherKnowledgeDocuments.id, ver.entityId));
    }
  }

  const [auditRow] = await db
    .insert(aiKnowledgeVersions)
    .values({
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
    })
    .returning();

  return { rolledBackVersion: ver, auditEntry: auditRow };
}

export async function listTrainingSamples(
  uid: string,
  filters?: { datasetSplit?: string; annotationStatus?: string; bagType?: string }
): Promise<TrainingSampleRecord[]> {
  if (!isPostgresConfigured) return memListTrainingSamples(filters);
  await ensureIntelligenceSeeded();
  const rows = await db
    .select()
    .from(leatherTrainingSamples)
    .where(eq(leatherTrainingSamples.ownerUid, uid))
    .orderBy(desc(leatherTrainingSamples.updatedAt))
    .limit(60);

  const mapped: TrainingSampleRecord[] = rows.map((r) => ({
    id: r.id,
    title: r.title,
    sourceProjectId: r.sourceProjectId ?? undefined,
    bagType: r.bagType as BagType,
    structureType: r.structureType as StructureType,
    materialId: r.materialId,
    edgeProcess: r.edgeProcess as EdgeProcessType,
    datasetSplit: r.datasetSplit as BenchmarkSplit,
    photoAngles: (r.photoAngles ?? []) as ImageAngle[],
    photoCount: r.photoCount,
    hasReferenceCalibration: r.hasReferenceCalibration,
    referenceObjectType: r.referenceObjectType ?? undefined,
    trueDimensionsMm: r.trueDimensionsMm,
    visiblePartLabels: r.visiblePartLabels ?? [],
    hiddenPartLabels: r.hiddenPartLabels ?? [],
    seamBoundaryNotes: r.seamBoundaryNotes,
    verifiedPieceCount: r.verifiedPieceCount,
    verifiedPatternSummary: r.verifiedPatternSummary ?? [],
    annotationStatus: r.annotationStatus as TrainingAnnotationStatus,
    annotatedBy: r.annotatedBy,
    leatherSpecificRulesChecked: r.leatherSpecificRulesChecked,
    notes: r.notes,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  }));

  if (mapped.length === 0) {
    return memListTrainingSamples(filters);
  }

  return mapped.filter((s) => {
    if (filters?.datasetSplit && s.datasetSplit !== filters.datasetSplit) return false;
    if (filters?.annotationStatus && s.annotationStatus !== filters.annotationStatus) return false;
    if (filters?.bagType && s.bagType !== filters.bagType) return false;
    return true;
  });
}

export async function createTrainingSample(
  uid: string,
  input: Omit<TrainingSampleRecord, 'id' | 'createdAt' | 'updatedAt'>
): Promise<TrainingSampleRecord> {
  if (!isPostgresConfigured) return memCreateTrainingSample(input);
  await ensureIntelligenceSeeded();
  const id = `ts_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
  const embedding = computeDeterministicEmbedding(
    `${input.title} ${input.bagType} ${input.structureType} ${input.materialId} ${input.visiblePartLabels.join(' ')} ${input.seamBoundaryNotes}`
  );
  const [saved] = await db
    .insert(leatherTrainingSamples)
    .values({
      id,
      ownerUid: uid,
      sourceProjectId: input.sourceProjectId ?? null,
      title: input.title,
      bagType: input.bagType,
      structureType: input.structureType,
      materialId: input.materialId,
      edgeProcess: input.edgeProcess,
      datasetSplit: input.datasetSplit,
      photoAngles: input.photoAngles,
      photoCount: input.photoCount,
      hasReferenceCalibration: input.hasReferenceCalibration,
      referenceObjectType: input.referenceObjectType ?? null,
      trueDimensionsMm: input.trueDimensionsMm,
      visiblePartLabels: input.visiblePartLabels,
      hiddenPartLabels: input.hiddenPartLabels,
      seamBoundaryNotes: input.seamBoundaryNotes,
      verifiedPieceCount: input.verifiedPieceCount,
      verifiedPatternSummary: input.verifiedPatternSummary,
      annotationStatus: input.annotationStatus,
      annotatedBy: input.annotatedBy,
      leatherSpecificRulesChecked: input.leatherSpecificRulesChecked,
      notes: input.notes,
      embedding,
    })
    .returning();

  return {
    id: saved.id,
    title: saved.title,
    sourceProjectId: saved.sourceProjectId ?? undefined,
    bagType: saved.bagType as BagType,
    structureType: saved.structureType as StructureType,
    materialId: saved.materialId,
    edgeProcess: saved.edgeProcess as EdgeProcessType,
    datasetSplit: saved.datasetSplit as BenchmarkSplit,
    photoAngles: (saved.photoAngles ?? []) as ImageAngle[],
    photoCount: saved.photoCount,
    hasReferenceCalibration: saved.hasReferenceCalibration,
    referenceObjectType: saved.referenceObjectType ?? undefined,
    trueDimensionsMm: saved.trueDimensionsMm,
    visiblePartLabels: saved.visiblePartLabels ?? [],
    hiddenPartLabels: saved.hiddenPartLabels ?? [],
    seamBoundaryNotes: saved.seamBoundaryNotes,
    verifiedPieceCount: saved.verifiedPieceCount,
    verifiedPatternSummary: saved.verifiedPatternSummary ?? [],
    annotationStatus: saved.annotationStatus as TrainingAnnotationStatus,
    annotatedBy: saved.annotatedBy,
    leatherSpecificRulesChecked: saved.leatherSpecificRulesChecked,
    notes: saved.notes,
    createdAt: saved.createdAt.toISOString(),
    updatedAt: saved.updatedAt.toISOString(),
  };
}

export async function updateTrainingSample(
  id: string,
  uid: string,
  patch: Partial<TrainingSampleRecord>
): Promise<TrainingSampleRecord | null> {
  if (!isPostgresConfigured) return memUpdateTrainingSample(id, patch);
  await ensureIntelligenceSeeded();
  const [existing] = await db
    .select()
    .from(leatherTrainingSamples)
    .where(and(eq(leatherTrainingSamples.id, id), eq(leatherTrainingSamples.ownerUid, uid)))
    .limit(1);
  if (!existing) {
    return memUpdateTrainingSample(id, patch);
  }
  const [updated] = await db
    .update(leatherTrainingSamples)
    .set({
      datasetSplit: patch.datasetSplit ?? existing.datasetSplit,
      annotationStatus: patch.annotationStatus ?? existing.annotationStatus,
      leatherSpecificRulesChecked:
        patch.leatherSpecificRulesChecked ?? existing.leatherSpecificRulesChecked,
      notes: patch.notes ?? existing.notes,
      annotatedBy: patch.annotatedBy ?? existing.annotatedBy,
      updatedAt: new Date(),
    })
    .where(eq(leatherTrainingSamples.id, id))
    .returning();

  return {
    id: updated.id,
    title: updated.title,
    sourceProjectId: updated.sourceProjectId ?? undefined,
    bagType: updated.bagType as BagType,
    structureType: updated.structureType as StructureType,
    materialId: updated.materialId,
    edgeProcess: updated.edgeProcess as EdgeProcessType,
    datasetSplit: updated.datasetSplit as BenchmarkSplit,
    photoAngles: (updated.photoAngles ?? []) as ImageAngle[],
    photoCount: updated.photoCount,
    hasReferenceCalibration: updated.hasReferenceCalibration,
    referenceObjectType: updated.referenceObjectType ?? undefined,
    trueDimensionsMm: updated.trueDimensionsMm,
    visiblePartLabels: updated.visiblePartLabels ?? [],
    hiddenPartLabels: updated.hiddenPartLabels ?? [],
    seamBoundaryNotes: updated.seamBoundaryNotes,
    verifiedPieceCount: updated.verifiedPieceCount,
    verifiedPatternSummary: updated.verifiedPatternSummary ?? [],
    annotationStatus: updated.annotationStatus as TrainingAnnotationStatus,
    annotatedBy: updated.annotatedBy,
    leatherSpecificRulesChecked: updated.leatherSpecificRulesChecked,
    notes: updated.notes,
    createdAt: updated.createdAt.toISOString(),
    updatedAt: updated.updatedAt.toISOString(),
  };
}

export async function exportTrainingDatasetJsonl(uid: string): Promise<{
  jsonl: string;
  count: number;
  splits: Record<string, number>;
}> {
  if (!isPostgresConfigured) return memExportTrainingDatasetJsonl();
  const samples = await listTrainingSamples(uid);
  const splits: Record<string, number> = { train: 0, validation: 0, sealed_test: 0 };
  const lines = samples.map((s) => {
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
