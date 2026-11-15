import type {
  AuthorizedCadCommandSpec,
  FiveEngineSpec,
  IndustryBenchmarkProduct,
} from './types';

export const FIVE_ENGINE_ARCHITECTURE: FiveEngineSpec[] = [
  {
    id: 'engine_1_multimodal_llm',
    order: 1,
    name: '引擎 1 · 通用多模态大模型',
    englishName: 'General Multimodal LLM (Planner & Dialog)',
    responsibility:
      '理解产品照片语义、自然语言改版要求、多轮上下文，并将设计意图翻译为结构化任务规划与授权 CAD 工具调用（不直接手算几何曲线）。',
    boundaryRule:
      '禁止跳过确定性 CAD 引擎直接输出毫米级裁片坐标，禁止把模型口头回复当作已完成改图。',
    currentModules: ['server/geminiService.ts', 'src/components/AiChatPanel.tsx'],
    upgradeFocus: '引入更细粒度的工具调用校验与多方案对比规划（Leonardo 助手调用范式）。',
  },
  {
    id: 'engine_2_leather_vision',
    order: 2,
    name: '引擎 2 · 皮具视觉模型',
    englishName: 'Leather Vision & Segmentation Model',
    responsibility:
      '识别拍摄视角、包型、可见部件边界、外圈车线、滚边骨条、折边/油边及五金安装区域；支持标定板/已知参照物透视校正。',
    boundaryRule:
      '通用视觉模型存在空间定位与透视误差局限，识别像素框仅用于视觉定位与结构提示，严禁直接当作生产纸格轮廓或真实尺寸。',
    currentModules: ['server/reconstructionEngine.ts (Task 1)', 'src/components/PhotoStructureView.tsx'],
    upgradeFocus: '联合打版师积累 RUDA 自有皮具多角度+车线+五金标注训练集，微调专用皮具视觉分割模型。',
  },
  {
    id: 'engine_3_knowledge_engine',
    order: 3,
    name: '引擎 3 · 专业知识与五层记忆引擎',
    englishName: 'Leather Knowledge + 5-Layer Memory + pgvector',
    responsibility:
      '管理授权标准版型库（Master Pattern Library）、皮料物理特性（厚度/软硬度/拉伸回弹/铲薄）、缝合构造规则、错题经验库及 L1–L5 人工审核门禁。',
    boundaryRule:
      '严格区分服装打版与皮具打版工程规则；LEVEL 1（AI 推测）知识绝不直接充当正式生产规范。',
    currentModules: [
      'src/shared/leatherKnowledge.ts',
      'src/shared/masterPatternLibrary.ts',
      'server/intelligenceService.ts',
      'src/db/schema.ts (pgvector HNSW)',
    ],
    upgradeFocus: '持续扩充实产验证（LEVEL 5）案例与工厂试制反馈闭环，实现跨项目高精度检索。',
  },
  {
    id: 'engine_4_structure_reasoning',
    order: 4,
    name: '引擎 4 · AI 结构反向工程引擎',
    englishName: 'Structure Reverse Engineering Engine',
    responsibility:
      '从可见外观推理真实皮具制造结构（一体 U 形围 vs 独立侧底、箱型底角、圆弧省道、隐藏里布/衬板），检索相似授权模板并计算参数差异。',
    boundaryRule:
      '必须先输出结构拓扑、备选结构排除依据与部件连接关系（Seam Pairs），再驱动参数化纸格重建。',
    currentModules: ['server/reconstructionEngine.ts (Task 2)', 'src/shared/masterPatternLibrary.ts'],
    upgradeFocus: '结合打版师标注的「结构拓扑—标准裁片」训练集，提升复杂隐蔽内结构推理准确率。',
  },
  {
    id: 'engine_5_deterministic_cad',
    order: 5,
    name: '引擎 5 · 专业 CAD 几何及生产计算引擎',
    englishName: 'Deterministic Leather CAD & Production Engine',
    responsibility:
      '执行毫米级参数化二维净版生成、3D-to-2D 曲面展开与残差检查、材料厚度/铲薄补偿、缝份/刀口/纹向生成、8 项几何校验及事务回滚、智能排料与 DXF/SVG/PDF 导出。',
    boundaryRule:
      '所有几何与公差计算必须 100% 确定性可复现，单图/未校尺寸/未过实样阶段强制标记为「AI 设计版」，禁止冒充「标准生产版」。',
    currentModules: ['src/shared/cadEngine.ts', 'src/shared/cadExport.ts', 'src/components/PatternCanvas.tsx'],
    upgradeFocus: '扩充双曲面分片/省道释放展开精度，完善更多特种箱包工艺（如风琴褶、包骨滚边）的确定性算子。',
  },
];

export const INDUSTRY_BENCHMARK_PRODUCTS: IndustryBenchmarkProduct[] = [
  {
    id: 'vlotho_cad',
    name: 'VLOTHO CAD',
    category: 'commercial_cad',
    primaryStudyFocus: '照片转纸格（Photo-to-Pattern）与小皮具试样闭环',
    capabilities: [
      '支持上传最多 3 张正面、侧面、背面照片',
      '支持输入已知实测尺寸并进行对话式修改',
      '支持导出 DXF、SVG、PDF 生产文件',
    ],
    productionLimitations:
      '照片转纸格目前仍为实验性功能，覆盖钱包、卡包、翻盖包、化妆包等相对规则品类，且明确要求制作实物样品验证后才能投产。',
    rudaIntegrationStrategy:
      '吸收其「多视角+已知尺寸+对话修改+DXF/SVG/PDF」产品闭环，并进一步升级至 7 视角拍摄引导、参考物透视校准与单图风险隔离。',
    rudaCurrentProgress: 'implemented',
    rudaProgressNote:
      'RUDA 已落地普通/精准双模式采集（最多 7 视角 + 标定物校正）、多轴校准、对话改版及 DXF 往返校验导出。',
  },
  {
    id: 'romans_cad_3d',
    name: 'Romans CAD 3D Bag',
    category: 'commercial_cad',
    primaryStudyFocus: '专业皮具 3D-to-2D 展开与参数化工程同步',
    capabilities: [
      '专门针对皮具行业建立三维包型并自动展开为二维裁片',
      '支持三维造型与二维裁片双向联动修改',
      '支持尺寸、皮料厚度与结构组件参数化',
    ],
    productionLimitations:
      '属于专业三维工程 CAD，需要打版师/设计师先做三维建模，不具备从单张或几张产品照片自动理解结构的通用 AI 能力。',
    rudaIntegrationStrategy:
      '借鉴其「曲面展开 + 参数化组件联动 + 材料厚度补偿」工程核心，在 RUDA 引擎 5 中构建专用 3D-to-2D 展开求解器与三维重装残差检查。',
    rudaCurrentProgress: 'partial',
    rudaProgressNote:
      'RUDA 已实现平面/单曲面测地线/双曲面分片/省道释放 4 类展开算子、三维重装残差计算与参数联动；可进一步扩充交互式 3D 预览网格。',
  },
  {
    id: 'leonardo_pattern_52',
    name: 'Leonardo Pattern Design 5.2',
    category: 'commercial_cad',
    primaryStudyFocus: '专业皮具知识与 AI 调用授权 CAD 命令',
    capabilities: [
      '2026 年 10 月公布的 5.2 版本内置 350+ 专业皮具打版命令',
      'AI 助手可理解当前 CAD 图纸、部件和材料属性',
      'AI 不直接画线，而是调用经过授权的确定性 CAD 命令完成计算',
    ],
    productionLimitations:
      '核心优势建立在数十年积累的授权 CAD 指令体系上；若缺乏独立的照片反向推理与五层记忆积累，难以持续从工厂反馈中自动进化。',
    rudaIntegrationStrategy:
      '完全采纳其「AI 负责理解与调用，专业 CAD 负责精确计算」核心架构，并将每次 AI 调用与工匠修正沉淀至 RUDA 五层记忆与待审核知识库。',
    rudaCurrentProgress: 'implemented',
    rudaProgressNote:
      'RUDA 已通过结构化指令白名单 + executeCadTransaction 事务保护 + 自动回滚机制实现同类架构，并建立授权命令注册表。',
  },
  {
    id: 'chatgarment_cvpr2025',
    name: 'ChatGarment (CVPR 2025)',
    category: 'research_ai',
    primaryStudyFocus: '微调视觉语言模型 + 参数化二维纸格生成',
    capabilities: [
      '使用微调后的 VLM 从照片和文字描述生成可编辑二维纸格',
      '结合参数化模型重建三维形态，支持开源代码与数据集复现',
    ],
    productionLimitations:
      '面向软质服装面料与人体穿戴拓扑，未涵盖皮革厚度、铲薄坡度、五金承重补强、定型芯材与刚性箱型底角等皮具核心约束。',
    rudaIntegrationStrategy:
      '借鉴其「视觉语言模型 → 结构化参数纸格 → 3D 验证」研究路线，但采用 RUDA 自建的皮具多视角+标准纸格训练集替代服装数据集。',
    rudaCurrentProgress: 'roadmap',
    rudaProgressNote:
      'RUDA 已上线皮具视觉与标准纸格训练集标注工作台（JSONL + pgvector），联合专业打版师累积样本后即可启动皮具专用 VLM 微调。',
  },
  {
    id: 'garmentopia_2026',
    name: 'GarmentoPIA (2026)',
    category: 'research_ai',
    primaryStudyFocus: 'LLM + 领域知识 + 专用打版 DSL',
    capabilities: [
      '结合大语言模型、版型专业知识与专用领域特定语言（DSL）',
      '输出结构化、可解释、可参数编辑的纸格程序',
    ],
    productionLimitations:
      '服装工程规则与皮具箱包工程规则截然不同（针距、刀口、折边/油边、背脊纹向、内衬缩水与补强板逻辑完全不兼容），绝不可直接套用服装模型。',
    rudaIntegrationStrategy:
      '吸收其「领域知识 + 专用结构 DSL」范式，打造面向皮具箱包的 RUDA Leather Pattern DSL 与结构化 CAD 指令协议。',
    rudaCurrentProgress: 'implemented',
    rudaProgressNote:
      'RUDA 已构建独立于服装体系的皮具工程知识库（L1–L5）、SeamPair 装配拓扑及专用皮具 CAD DSL。',
  },
];

export const AUTHORIZED_CAD_COMMANDS: AuthorizedCadCommandSpec[] = [
  {
    intent: 'resize_product',
    operationSummary: '整体长宽高与底厚参数化联动缩放',
    allowedParameters: [
      'widthMm',
      'heightMm',
      'depthMm',
      'deltaWidthMm',
      'deltaHeightMm',
      'deltaDepthMm',
      'bottomThicknessMm',
    ],
    deterministicGuarantees: '前/后片、独立/U形侧围、底片、里布、底托板同步重算，接缝弧长差保持 <= 1.2mm。',
    rollbackGuard: '尺寸 <= 0 或自相交轮廓触发事务回滚。',
  },
  {
    intent: 'resize_component',
    operationSummary: '调整提手长度或全局缝份参数',
    allowedParameters: ['deltaLengthMm', 'seamAllowanceMm'],
    deterministicGuarantees: '同步更新提手净版与裁剪版包边轮廓，并按新缝份重算全部裁片外扩线。',
    rollbackGuard: '缝份小于工艺最低下限或提手宽度非法时拒绝执行。',
  },
  {
    intent: 'modify_geometry',
    operationSummary: '变更侧围风格、底角圆弧半径与包口弧度',
    allowedParameters: [
      'gussetStyle (straight|curved|tapered)',
      'gussetCurveRadiusMm',
      'cornerRadiusMm',
      'topOpeningCurveMm',
      'bottomThicknessMm',
    ],
    deterministicGuarantees: '根据圆弧周长积分重算侧围展开长度，并在转角自动生成 45° 对位刀口。',
    rollbackGuard: '圆角半径超出包身半宽或 3D 展开畸变超限时触发告警/回滚。',
  },
  {
    intent: 'add_component',
    operationSummary: '增配标准化皮具内部/外部结构件',
    allowedParameters: [
      'componentType (zipper_pocket|front_pocket|slip_pocket|top_zipper_flap|shoulder_strap|bottom_board|magnetic_closure)',
    ],
    deterministicGuarantees: '自动生成独立裁片、五金安装定位孔与对应 SeamPair 装配拓扑。',
    rollbackGuard: '重复添加冲突结构或超出包体内腔宽幅时拦截。',
  },
  {
    intent: 'remove_component',
    operationSummary: '安全移除指定功能部件及关联接缝',
    allowedParameters: ['componentType', 'pieceId'],
    deterministicGuarantees: '同步清理对应裁片与 SeamPair，保持剩余主结构闭合完整。',
    rollbackGuard: '禁止删除前/后主包身等核心承重结构。',
  },
  {
    intent: 'change_material',
    operationSummary: '切换主皮料、边缘工艺与针距规格',
    allowedParameters: ['materialId', 'edgeProcess (raw_burnish|edge_paint|folded|piped|bound)', 'stitchSpacingMm'],
    deterministicGuarantees: '按皮料厚度/回弹重新计算折边宽度、铲薄区目标厚度与厚度补偿量。',
    rollbackGuard: '硬挺植鞣厚皮强制折边等物理冲突自动触发工艺风险拦截。',
  },
  {
    intent: 'calibrate_scale',
    operationSummary: '按单轴实测尺寸或参照物比例全套等比校准',
    allowedParameters: ['referenceAxis (width|height|depth)', 'actualMm'],
    deterministicGuarantees: '等比缩放全部关联裁片并更新 dimensionSource 校准确认标记。',
    rollbackGuard: '比例因子异常（<0.2x 或 >5x）自动拦截。',
  },
  {
    intent: 'optimize_pattern',
    operationSummary: '执行面向工艺与降本的结构/版型综合优化',
    allowedParameters: [
      'optimizationGoal (reduce_waste|reduce_seams|italian_luxury|comfort_handle|optimize_zipper)',
    ],
    deterministicGuarantees: '依据工程规则批处理材料、缝份、拉链退让或底角结构参数。',
    rollbackGuard: '优化后执行完整 8 项几何校验，未通过即回滚至前快照。',
  },
  {
    intent: 'apply_nesting',
    operationSummary: '皮革背脊纹向锁定与瑕疵区避让智能排料',
    allowedParameters: ['hideWidthMm', 'hideHeightMm'],
    deterministicGuarantees: '强制 grainLocked 裁片顺纹排列，计算可用皮面利用率与物料预估成本。',
    rollbackGuard: '如有超幅面裁片无法排入，返回 unplacedPieces 明细。',
  },
  {
    intent: 'run_validation',
    operationSummary: '触发全套二维轮廓、接缝公差与三维重装校验',
    allowedParameters: ['pieceId | all'],
    deterministicGuarantees: '输出 10 项量化 QualityMetricCheck 与三层交付门禁结果。',
    rollbackGuard: '发现几何自相交或开环时阻断标准生产版签发。',
  },
];
