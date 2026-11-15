import { BAG_ARCHETYPES } from './leatherKnowledge';
import type {
  BagType,
  EnabledFeatures,
  MasterPatternTemplate,
  ProductDimensions,
  StructureType,
} from './types';

export const MASTER_PATTERN_LIBRARY: MasterPatternTemplate[] = [
  // =========================================================================
  // 1. TOTE BAG (3 structural variants)
  // =========================================================================
  {
    id: 'tpl_tote_independent_gusset',
    name: '经典植鞣直筒独立底围托特包',
    bagType: 'tote',
    structureType: 'independent_gusset_bottom',
    summary: '前/后主包片 + 左右独立直筒侧围 + 独立承重底片 + 水滴耳仔双提手 + 内缩内衬 + 皮糠纸底托',
    authorizedSource: 'RUDA 样板车间实测标准版型 #TOTE-01 (QB/T 1333-2018)',
    reviewLevel: 5,
    verifiedBy: '陈工（首席打版师）& 林工（车间主管）',
    defaultDimensions: {
      ...BAG_ARCHETYPES.tote.dimensions,
      widthMm: 300,
      heightMm: 240,
      depthMm: 120,
      handleLengthMm: 420,
      gussetStyle: 'straight',
      cornerRadiusMm: 0,
      structureType: 'independent_gusset_bottom',
    },
    defaultMaterialId: 'veg_tan_18',
    defaultEdgeProcess: 'raw_burnish',
    defaultFeatures: {
      ...BAG_ARCHETYPES.tote.features,
      hasSlipPocket: true,
      hasBottomBoard: true,
      hasMagneticClosure: true,
      hasLining: true,
    },
    pieceCount: 10,
    partsSpec: [
      { partCode: 'A01', standardType: 'front_panel', name: '前片主体', quantity: 1, symmetryRule: 'mirror_x', seamAllowanceMm: 5, foldAllowanceMm: 0 },
      { partCode: 'A02', standardType: 'back_panel', name: '后片主体', quantity: 1, symmetryRule: 'mirror_x', seamAllowanceMm: 5, foldAllowanceMm: 0 },
      { partCode: 'A03', standardType: 'left_gusset', name: '左侧围片', quantity: 1, symmetryRule: 'mirror_x', seamAllowanceMm: 5, foldAllowanceMm: 0 },
      { partCode: 'A04', standardType: 'right_gusset', name: '右侧围片', quantity: 1, symmetryRule: 'mirror_x', seamAllowanceMm: 5, foldAllowanceMm: 0 },
      { partCode: 'A05', standardType: 'bottom_panel', name: '独立承重底片', quantity: 1, symmetryRule: 'mirror_x', seamAllowanceMm: 5, foldAllowanceMm: 0, reinforcement: '1.0mm 皮糠纸底托 R01' },
      { partCode: 'H01', standardType: 'handle_strap', name: '手拎提手带', quantity: 2, symmetryRule: 'mirror_x', seamAllowanceMm: 0, foldAllowanceMm: 0, reinforcement: '0.4mm 防拉伸织带' },
      { partCode: 'H02', standardType: 'handle_anchor', name: '水滴形耳仔底座', quantity: 4, symmetryRule: 'mirror_x', seamAllowanceMm: 0, foldAllowanceMm: 0 },
      { partCode: 'L01', standardType: 'lining_body', name: '内缩主体内衬', quantity: 2, symmetryRule: 'mirror_x', seamAllowanceMm: 8, foldAllowanceMm: 0 },
      { partCode: 'I02', standardType: 'slip_pocket', name: '内贴插袋', quantity: 1, symmetryRule: 'mirror_x', seamAllowanceMm: 5, foldAllowanceMm: 8 },
      { partCode: 'R01', standardType: 'bottom_board', name: '避缝线底托加固板', quantity: 1, symmetryRule: 'mirror_x', seamAllowanceMm: 0, foldAllowanceMm: 0 },
    ],
    relationsSummary: [
      'A01.left <-> A03.front_edge (face_to_face, ±1.2mm)',
      'A01.right <-> A04.front_edge (face_to_face, ±1.2mm)',
      'A05 四边 <-> A01/A02/A03/A04 底边 (face_to_face)',
      'H02 耳仔 <-> A01/A02 撞钉安装孔 (rivet)',
    ],
    hardwareMounts: ['18mm 包口暗磁扣 ×1', '8mm 双面撞钉 ×4'],
    validationBaseline: { maxSeamToleranceMm: 1.2, requiresSkivingAboveMm: 1.4 },
    templateVersion: 'V1.2-STD',
    status: 'published',
    isCustom: false,
    sizeSeries: [
      { label: 'S 迷你日常款', widthMm: 250, heightMm: 205, depthMm: 105 },
      { label: 'M 标准通勤款', widthMm: 300, heightMm: 240, depthMm: 120 },
      { label: 'L 大容量商务款', widthMm: 365, heightMm: 285, depthMm: 140 },
    ],
    engineeringArchive: {
      referencePhotosCount: 7,
      structure3DSummary: '五片式直筒立体盒型（前/后/左/右/底），四角90°对接，内缩衬里避褶 -4.5mm',
      skivingAndReinforcementSpec: '耳仔底座铲薄至 1.0mm，提手内夹 0.4mm 防拉带，底片全贴 1.0mm 皮糠纸 R01',
      productionProcessSpec: '1.8mm 植鞣原边打磨 + 3.85mm 斩距菱斩缝制，包口边倒角封蜡',
      productionVerificationResult: '已完成 120 件首批次产线试产，成包尺寸偏差 ≤ ±1.1mm',
    },
  },
  {
    id: 'tpl_tote_fold_wrap',
    name: '折底一体无拼接极简托特包',
    bagType: 'tote',
    structureType: 'fold_wrap_body',
    summary: '前片-底面-后片整张折底一体裁剪（消除底部横向接缝）+ 左右梯形侧围 + 包口翻折加强筋',
    authorizedSource: 'RUDA 样板库 #TOTE-02 · 极简一体折底实测版型',
    reviewLevel: 5,
    verifiedBy: '陈工（首席打版师）',
    defaultDimensions: {
      ...BAG_ARCHETYPES.tote.dimensions,
      widthMm: 320,
      heightMm: 270,
      depthMm: 110,
      handleLengthMm: 520,
      gussetStyle: 'tapered',
      seamAllowanceMm: 5,
      foldWidthMm: 8,
      structureType: 'fold_wrap_body',
    },
    defaultMaterialId: 'soft_calf_12',
    defaultEdgeProcess: 'folded',
    defaultFeatures: {
      ...BAG_ARCHETYPES.tote.features,
      hasSlipPocket: true,
      hasBottomBoard: true,
      hasMagneticClosure: true,
      hasLining: true,
    },
    pieceCount: 7,
    partsSpec: [
      { partCode: 'A01W', standardType: 'front_panel', name: '前底后一体折底包身', quantity: 1, symmetryRule: 'fold_center', seamAllowanceMm: 5, foldAllowanceMm: 8, reinforcement: '底折弯区贴 0.8mm 补强衬' },
      { partCode: 'A03', standardType: 'left_gusset', name: '左侧独立围片', quantity: 1, symmetryRule: 'mirror_x', seamAllowanceMm: 5, foldAllowanceMm: 8 },
      { partCode: 'A04', standardType: 'right_gusset', name: '右侧独立围片', quantity: 1, symmetryRule: 'mirror_x', seamAllowanceMm: 5, foldAllowanceMm: 8 },
      { partCode: 'H01', standardType: 'handle_strap', name: '加长单肩背带', quantity: 2, symmetryRule: 'mirror_x', seamAllowanceMm: 0, foldAllowanceMm: 0 },
      { partCode: 'L01', standardType: 'lining_body', name: '内缩内衬片', quantity: 2, symmetryRule: 'mirror_x', seamAllowanceMm: 8, foldAllowanceMm: 0 },
      { partCode: 'R01', standardType: 'bottom_board', name: '折底定型衬板', quantity: 1, symmetryRule: 'mirror_x', seamAllowanceMm: 0, foldAllowanceMm: 0 },
    ],
    relationsSummary: [
      'A01W 两侧折边 <-> A03/A04 前后边 (face_to_face)',
      'A01W 底折中心线与 R01 底托中心线对位',
    ],
    hardwareMounts: ['18mm 包口暗磁扣 ×1'],
    validationBaseline: { maxSeamToleranceMm: 1.2, requiresSkivingAboveMm: 1.1 },
    templateVersion: 'V1.2-STD',
    status: 'published',
    isCustom: false,
    sizeSeries: [
      { label: 'M 标准折底款', widthMm: 320, heightMm: 270, depthMm: 110 },
      { label: 'L 托特大号', widthMm: 380, heightMm: 300, depthMm: 130 },
    ],
    engineeringArchive: {
      referencePhotosCount: 6,
      structure3DSummary: '前-底-后整片一体连续折底，消除底缝受剪力，梯形侧围内折收口',
      skivingAndReinforcementSpec: '包口折边 8mm 铲薄至 0.65mm 贴 0.3mm 尼龙条，底折弯区贴 0.8mm 弹性定型衬',
      productionProcessSpec: '1.2mm 软小牛皮铲薄折边工艺，3.38mm 车缝针距，暗磁扣背位加圆片补强',
      productionVerificationResult: '样板车间 3 轮试样通过，底部折弯零起皱，成包公差 ±1.3mm',
    },
  },
  {
    id: 'tpl_tote_zipper_commuter',
    name: '拉链挡片通勤商务托特包',
    bagType: 'tote',
    structureType: 'zipper_commuter_tote',
    summary: '立体独立底围主身 + 左右退让6mm包口拉链挡片 + 外置插袋 + 内部拉链隔层袋',
    authorizedSource: 'RUDA 产线验证标准版型 #TOTE-03 (林工核准)',
    reviewLevel: 5,
    verifiedBy: '林工（样板车间主管）',
    defaultDimensions: {
      ...BAG_ARCHETYPES.tote.dimensions,
      widthMm: 350,
      heightMm: 265,
      depthMm: 130,
      handleLengthMm: 540,
      gussetStyle: 'straight',
      seamAllowanceMm: 5.5,
      structureType: 'zipper_commuter_tote',
    },
    defaultMaterialId: 'pebbled_16',
    defaultEdgeProcess: 'edge_paint',
    defaultFeatures: {
      hasZipperPocket: true,
      hasFrontPocket: true,
      hasSlipPocket: true,
      hasTopZipperFlap: true,
      hasBottomBoard: true,
      hasShoulderStrap: false,
      hasMagneticClosure: false,
      hasTurnLock: false,
      hasLining: true,
    },
    pieceCount: 12,
    partsSpec: [
      { partCode: 'A01', standardType: 'front_panel', name: '前片主体（含外袋定位）', quantity: 1, symmetryRule: 'mirror_x', seamAllowanceMm: 5.5, foldAllowanceMm: 0 },
      { partCode: 'A02', standardType: 'back_panel', name: '后片主体', quantity: 1, symmetryRule: 'mirror_x', seamAllowanceMm: 5.5, foldAllowanceMm: 0 },
      { partCode: 'A03', standardType: 'left_gusset', name: '左侧围片', quantity: 1, symmetryRule: 'mirror_x', seamAllowanceMm: 5.5, foldAllowanceMm: 0 },
      { partCode: 'A04', standardType: 'right_gusset', name: '右侧围片', quantity: 1, symmetryRule: 'mirror_x', seamAllowanceMm: 5.5, foldAllowanceMm: 0 },
      { partCode: 'A05', standardType: 'bottom_panel', name: '加宽承重底片', quantity: 1, symmetryRule: 'mirror_x', seamAllowanceMm: 5.5, foldAllowanceMm: 0 },
      { partCode: 'O01', standardType: 'top_zipper_flap', name: '包口退让拉链挡片', quantity: 2, symmetryRule: 'mirror_x', seamAllowanceMm: 5.5, foldAllowanceMm: 0 },
      { partCode: 'F01', standardType: 'front_pocket', name: '前幅贴袋', quantity: 1, symmetryRule: 'mirror_x', seamAllowanceMm: 5, foldAllowanceMm: 0 },
      { partCode: 'I01', standardType: 'zipper_pocket', name: '内部拉链安全袋', quantity: 1, symmetryRule: 'mirror_x', seamAllowanceMm: 8, foldAllowanceMm: 0 },
      { partCode: 'H01', standardType: 'handle_strap', name: '双肩背提手', quantity: 2, symmetryRule: 'mirror_x', seamAllowanceMm: 0, foldAllowanceMm: 0 },
      { partCode: 'L01', standardType: 'lining_body', name: '内缩主体内衬', quantity: 2, symmetryRule: 'mirror_x', seamAllowanceMm: 8, foldAllowanceMm: 0 },
      { partCode: 'R01', standardType: 'bottom_board', name: '皮糠纸底托板', quantity: 1, symmetryRule: 'mirror_x', seamAllowanceMm: 0, foldAllowanceMm: 0 },
    ],
    relationsSummary: [
      'O01 拉链挡片左右端退让 6mm 对接 A01/A02 包口内侧',
      'F01 外插袋定位贴合 A01 正面中心线',
    ],
    hardwareMounts: ['5# YKK 金属闭尾拉链 ×1', '8mm 双面撞钉 ×4'],
    validationBaseline: { maxSeamToleranceMm: 1.2, requiresSkivingAboveMm: 1.3 },
    templateVersion: 'V1.2-STD',
    status: 'published',
    isCustom: false,
    sizeSeries: [
      { label: 'M 14寸笔电通勤版', widthMm: 350, heightMm: 265, depthMm: 130 },
      { label: 'L 16寸差旅大容量版', widthMm: 400, heightMm: 295, depthMm: 145 },
    ],
    engineeringArchive: {
      referencePhotosCount: 8,
      structure3DSummary: '立体独立底围主身 + 左右退让 6mm 包口拉链天窗挡片 + 外前贴袋 + 内拉链袋',
      skivingAndReinforcementSpec: '挡片对接端铲薄至 0.7mm，摔纹皮耳仔位贴 0.6mm 超纤加厚垫片',
      productionProcessSpec: '1.6mm 摔纹牛皮意式多层油边（3底2面），5# 闭尾拉链尾端留 12mm 止位',
      productionVerificationResult: '大货产线 500 件实测拉链顺滑无卡角，最大接缝偏差 0.8mm',
    },
  },

  // =========================================================================
  // 2. HANDBAG (3 structural variants)
  // =========================================================================
  {
    id: 'tpl_handbag_trapezoid_flap',
    name: '意式梯形翻盖框式手提包',
    bagType: 'handbag',
    structureType: 'trapezoid_flap_frame',
    summary: '上窄下宽梯形主身 + 梯形收口侧围 + 顶盖插锁翻盖 + 侧耳 D 环长肩带 + 脚钉底托',
    authorizedSource: 'Italian Leathergoods Guild 授权版型 #HB-01 (Box Calf 1.5mm)',
    reviewLevel: 5,
    verifiedBy: '陈工（首席打版师）',
    defaultDimensions: {
      ...BAG_ARCHETYPES.handbag.dimensions,
      widthMm: 280,
      heightMm: 210,
      depthMm: 110,
      gussetStyle: 'tapered',
      structureType: 'trapezoid_flap_frame',
    },
    defaultMaterialId: 'box_calf_15',
    defaultEdgeProcess: 'edge_paint',
    defaultFeatures: { ...BAG_ARCHETYPES.handbag.features },
    pieceCount: 11,
    partsSpec: [
      { partCode: 'A01', standardType: 'front_panel', name: '梯形前片', quantity: 1, symmetryRule: 'mirror_x', seamAllowanceMm: 5, foldAllowanceMm: 7 },
      { partCode: 'A02', standardType: 'back_panel', name: '梯形后片', quantity: 1, symmetryRule: 'mirror_x', seamAllowanceMm: 5, foldAllowanceMm: 7 },
      { partCode: 'A03', standardType: 'left_gusset', name: '收口梯形左侧围', quantity: 1, symmetryRule: 'mirror_x', seamAllowanceMm: 5, foldAllowanceMm: 0 },
      { partCode: 'A04', standardType: 'right_gusset', name: '收口梯形右侧围', quantity: 1, symmetryRule: 'mirror_x', seamAllowanceMm: 5, foldAllowanceMm: 0 },
      { partCode: 'A05', standardType: 'bottom_panel', name: '带脚钉孔位底片', quantity: 1, symmetryRule: 'mirror_x', seamAllowanceMm: 5, foldAllowanceMm: 0 },
      { partCode: 'O02', standardType: 'top_flap', name: '顶盖插锁翻盖片', quantity: 1, symmetryRule: 'mirror_x', seamAllowanceMm: 5, foldAllowanceMm: 0, reinforcement: '1.0mm 翻盖补强衬' },
      { partCode: 'H01', standardType: 'handle_strap', name: '顶部拱形短提手', quantity: 1, symmetryRule: 'mirror_x', seamAllowanceMm: 0, foldAllowanceMm: 0 },
      { partCode: 'S01', standardType: 'shoulder_strap', name: '可拆卸 D 环长肩带', quantity: 1, symmetryRule: 'mirror_x', seamAllowanceMm: 0, foldAllowanceMm: 0 },
      { partCode: 'L01', standardType: 'lining_body', name: '内缩里衬', quantity: 2, symmetryRule: 'mirror_x', seamAllowanceMm: 8, foldAllowanceMm: 0 },
      { partCode: 'I01', standardType: 'zipper_pocket', name: '内里拉链贴袋', quantity: 1, symmetryRule: 'mirror_x', seamAllowanceMm: 8, foldAllowanceMm: 0 },
      { partCode: 'R01', standardType: 'bottom_board', name: '皮糠纸底托板', quantity: 1, symmetryRule: 'mirror_x', seamAllowanceMm: 0, foldAllowanceMm: 0 },
    ],
    relationsSummary: [
      'A01/A02 梯形斜边 <-> A03/A04 梯形围边 (face_to_face, ±1.0mm)',
      'O02 翻盖底边 <-> A02 后片上沿；O02 插锁中心孔 <-> A01 锁座孔位',
    ],
    hardwareMounts: ['32mm 翻盖插锁扣 ×1', '16mm 侧耳 D 环 ×2', '10mm 底部脚钉 ×4'],
    validationBaseline: { maxSeamToleranceMm: 1.0, requiresSkivingAboveMm: 1.2 },
    templateVersion: 'V1.2-STD',
    status: 'published',
    isCustom: false,
    sizeSeries: [
      { label: '25cm 优雅日用款', widthMm: 250, heightMm: 190, depthMm: 95 },
      { label: '28cm 经典框式款', widthMm: 280, heightMm: 210, depthMm: 110 },
      { label: '32cm 商务大气款', widthMm: 320, heightMm: 235, depthMm: 125 },
    ],
    engineeringArchive: {
      referencePhotosCount: 9,
      structure3DSummary: '上窄下宽梯形框式结构，顶盖含 24mm 弯折弧度外延，梯形侧围与斜边等长对位',
      skivingAndReinforcementSpec: '翻盖内衬 1.0mm 高密度挺衬 + 锁座背位 0.8mm 超纤定型片，缝合边单边铲薄至 0.9mm',
      productionProcessSpec: '1.5mm Box Calf 意式油边定型工艺，3.38mm 手工/特种机缝线，底角装 4 颗 10mm 脚钉',
      productionVerificationResult: '通过 ILG 审核与 40 件精品打样，梯形站立度与锁扣中心同轴误差 ≤ 0.6mm',
    },
  },
  {
    id: 'tpl_handbag_boston_piped',
    name: '波士顿包芯滚边拱形手提包',
    bagType: 'handbag',
    structureType: 'boston_piped_shell',
    summary: '拱形圆角前后片 + 包芯 2.2mm 胶骨滚边 + 上围拉链通体围条 + 半圆提手耳仔',
    authorizedSource: 'RUDA 滚边箱包工程标准 #HB-02 (QB/T 1333-2018)',
    reviewLevel: 5,
    verifiedBy: '陈工（首席打版师）',
    defaultDimensions: {
      ...BAG_ARCHETYPES.handbag.dimensions,
      widthMm: 290,
      heightMm: 200,
      depthMm: 135,
      cornerRadiusMm: 24,
      gussetStyle: 'curved',
      gussetCurveRadiusMm: 24,
      seamAllowanceMm: 6.5,
      structureType: 'boston_piped_shell',
    },
    defaultMaterialId: 'pebbled_16',
    defaultEdgeProcess: 'piped',
    defaultFeatures: {
      hasZipperPocket: true,
      hasFrontPocket: false,
      hasSlipPocket: true,
      hasTopZipperFlap: true,
      hasBottomBoard: true,
      hasShoulderStrap: true,
      hasMagneticClosure: false,
      hasTurnLock: false,
      hasLining: true,
    },
    pieceCount: 10,
    partsSpec: [
      { partCode: 'A01', standardType: 'front_panel', name: '拱形圆角前片（带滚边位）', quantity: 1, symmetryRule: 'mirror_x', seamAllowanceMm: 6.5, foldAllowanceMm: 0 },
      { partCode: 'A02', standardType: 'back_panel', name: '拱形圆角后片（带滚边位）', quantity: 1, symmetryRule: 'mirror_x', seamAllowanceMm: 6.5, foldAllowanceMm: 0 },
      { partCode: 'A03', standardType: 'left_gusset', name: '弧形高围侧片', quantity: 1, symmetryRule: 'mirror_x', seamAllowanceMm: 6.5, foldAllowanceMm: 0 },
      { partCode: 'A04', standardType: 'right_gusset', name: '弧形对称侧片', quantity: 1, symmetryRule: 'mirror_x', seamAllowanceMm: 6.5, foldAllowanceMm: 0 },
      { partCode: 'A05', standardType: 'bottom_panel', name: '圆角波士顿底片', quantity: 1, symmetryRule: 'mirror_x', seamAllowanceMm: 6.5, foldAllowanceMm: 0 },
      { partCode: 'O01', standardType: 'top_zipper_flap', name: '包口加长拉链围条', quantity: 2, symmetryRule: 'mirror_x', seamAllowanceMm: 6.5, foldAllowanceMm: 0 },
      { partCode: 'H01', standardType: 'handle_strap', name: '手卷芯双提手', quantity: 2, symmetryRule: 'mirror_x', seamAllowanceMm: 0, foldAllowanceMm: 0 },
      { partCode: 'L01', standardType: 'lining_body', name: '内缩防堆褶里衬', quantity: 2, symmetryRule: 'mirror_x', seamAllowanceMm: 8, foldAllowanceMm: 0 },
      { partCode: 'R01', standardType: 'bottom_board', name: '底托加固衬板', quantity: 1, symmetryRule: 'mirror_x', seamAllowanceMm: 0, foldAllowanceMm: 0 },
    ],
    relationsSummary: [
      'A01/A02 圆角周长 <-> A03/A04 + A05 围边贴合（包芯 2.2mm 胶骨 6.5mm 缝份）',
    ],
    hardwareMounts: ['5# 双向拉链 ×1', '半圆提手D环 ×4', '底部脚钉 ×4'],
    validationBaseline: { maxSeamToleranceMm: 1.2, requiresSkivingAboveMm: 1.3 },
    templateVersion: 'V1.2-STD',
    status: 'published',
    isCustom: false,
    sizeSeries: [
      { label: '25cm 轻巧波士顿', widthMm: 250, heightMm: 175, depthMm: 120 },
      { label: '29cm 标准波士顿', widthMm: 290, heightMm: 200, depthMm: 135 },
    ],
    engineeringArchive: {
      referencePhotosCount: 7,
      structure3DSummary: '前后拱形圆角主片（R24mm）经 2.2mm 实心胶骨滚边与通体围条立体合缝',
      skivingAndReinforcementSpec: '滚边条铲薄至 0.6mm 包裹 2.2mm 胶骨，圆角转弯处按 15° 放射状剪牙释放张力',
      productionProcessSpec: '1.6mm 摔纹牛皮，缝份放宽至 6.5mm 适配高脚滚边压脚，3.85mm 针距',
      productionVerificationResult: '样板车间首件及批量 80 件验收通过，拱形外廓圆润无波浪变形',
    },
  },
  {
    id: 'tpl_handbag_kelly_accordion',
    name: '风琴双褶侧围锁扣手提包',
    bagType: 'handbag',
    structureType: 'kelly_accordion_gusset',
    summary: '立挺梯形主片 + 双褶风琴式内折侧围（带折痕虚线）+ 包盖皮带扣锁结构',
    authorizedSource: 'RUDA 经典结构版型库 #HB-03 (高级制袋工艺)',
    reviewLevel: 4,
    verifiedBy: '陈工（首席打版师）',
    defaultDimensions: {
      ...BAG_ARCHETYPES.handbag.dimensions,
      widthMm: 275,
      heightMm: 215,
      depthMm: 115,
      gussetStyle: 'tapered',
      seamAllowanceMm: 5,
      structureType: 'kelly_accordion_gusset',
    },
    defaultMaterialId: 'box_calf_15',
    defaultEdgeProcess: 'edge_paint',
    defaultFeatures: { ...BAG_ARCHETYPES.handbag.features, hasTurnLock: true },
    pieceCount: 11,
    partsSpec: [
      { partCode: 'A01', standardType: 'front_panel', name: '立挺前片主体', quantity: 1, symmetryRule: 'mirror_x', seamAllowanceMm: 5, foldAllowanceMm: 0 },
      { partCode: 'A02', standardType: 'back_panel', name: '立挺后片主体', quantity: 1, symmetryRule: 'mirror_x', seamAllowanceMm: 5, foldAllowanceMm: 0 },
      { partCode: 'A03', standardType: 'left_gusset', name: '双褶风琴左侧围（含折痕线）', quantity: 1, symmetryRule: 'mirror_x', seamAllowanceMm: 5, foldAllowanceMm: 0 },
      { partCode: 'A04', standardType: 'right_gusset', name: '双褶风琴右侧围（含折痕线）', quantity: 1, symmetryRule: 'mirror_x', seamAllowanceMm: 5, foldAllowanceMm: 0 },
      { partCode: 'A05', standardType: 'bottom_panel', name: '承重底片', quantity: 1, symmetryRule: 'mirror_x', seamAllowanceMm: 5, foldAllowanceMm: 0 },
      { partCode: 'O02', standardType: 'top_flap', name: '穿孔锁扣顶盖翻盖', quantity: 1, symmetryRule: 'mirror_x', seamAllowanceMm: 5, foldAllowanceMm: 0 },
      { partCode: 'H01', standardType: 'handle_strap', name: '包芯单提手', quantity: 1, symmetryRule: 'mirror_x', seamAllowanceMm: 0, foldAllowanceMm: 0 },
      { partCode: 'S01', standardType: 'shoulder_strap', name: '斜挎肩带', quantity: 1, symmetryRule: 'mirror_x', seamAllowanceMm: 0, foldAllowanceMm: 0 },
      { partCode: 'L01', standardType: 'lining_body', name: '内缩里衬', quantity: 2, symmetryRule: 'mirror_x', seamAllowanceMm: 8, foldAllowanceMm: 0 },
      { partCode: 'R01', standardType: 'bottom_board', name: '底托加固板', quantity: 1, symmetryRule: 'mirror_x', seamAllowanceMm: 0, foldAllowanceMm: 0 },
    ],
    relationsSummary: [
      'A03/A04 风琴中折线向内折入 12mm，上下对位刀口与 A01/A02 锁齐',
    ],
    hardwareMounts: ['旋转插锁 ×1', '侧耳挂环 ×2', '底脚钉 ×4'],
    validationBaseline: { maxSeamToleranceMm: 1.0, requiresSkivingAboveMm: 1.2 },
    templateVersion: 'V1.2-STD',
    status: 'published',
    isCustom: false,
    sizeSeries: [
      { label: '25cm 小号风琴款', widthMm: 250, heightMm: 195, depthMm: 100 },
      { label: '27.5cm 标准风琴款', widthMm: 275, heightMm: 215, depthMm: 115 },
    ],
    engineeringArchive: {
      referencePhotosCount: 7,
      structure3DSummary: '双褶风琴侧围带中线压折痕（内折 12mm），上下对位刀口分别锁齐主片与翻盖',
      skivingAndReinforcementSpec: '风琴折痕线上铲 V 槽减厚至 0.7mm 确保折角锐利不外鼓，顶盖夹 1.0mm 定型衬',
      productionProcessSpec: '1.5mm Box Calf 意式多层油边工艺，双针加固耳仔受力区',
      productionVerificationResult: '已验证风琴开合 500 次无折痕龟裂，接缝最大差值 0.7mm',
    },
  },

  // =========================================================================
  // 3. SHOULDER BAG (3 structural variants)
  // =========================================================================
  {
    id: 'tpl_shoulder_curved_u',
    name: 'U形圆弧侧围法棍肩背包',
    bagType: 'shoulder_bag',
    structureType: 'curved_u_gusset',
    summary: '月牙弧口前后片 + 连续 U 形圆弧侧底一体围条 + 包口退让拉链挡片 + 调节式肩带',
    authorizedSource: 'RUDA 实产版型库 #SB-01 (月牙腋下包标准样板)',
    reviewLevel: 5,
    verifiedBy: '林工（样板车间主管）',
    defaultDimensions: {
      ...BAG_ARCHETYPES.shoulder_bag.dimensions,
      widthMm: 270,
      heightMm: 185,
      depthMm: 90,
      gussetStyle: 'curved',
      gussetCurveRadiusMm: 20,
      topOpeningCurveMm: 18,
      cornerRadiusMm: 16,
      structureType: 'curved_u_gusset',
    },
    defaultMaterialId: 'pebbled_16',
    defaultEdgeProcess: 'edge_paint',
    defaultFeatures: { ...BAG_ARCHETYPES.shoulder_bag.features },
    pieceCount: 10,
    partsSpec: [
      { partCode: 'A01', standardType: 'front_panel', name: '月牙弧底前片', quantity: 1, symmetryRule: 'mirror_x', seamAllowanceMm: 5.5, foldAllowanceMm: 0 },
      { partCode: 'A02', standardType: 'back_panel', name: '月牙弧底后片', quantity: 1, symmetryRule: 'mirror_x', seamAllowanceMm: 5.5, foldAllowanceMm: 0 },
      { partCode: 'A03', standardType: 'left_gusset', name: '左侧弧形侧围', quantity: 1, symmetryRule: 'mirror_x', seamAllowanceMm: 5.5, foldAllowanceMm: 0 },
      { partCode: 'A04', standardType: 'right_gusset', name: '右侧弧形侧围', quantity: 1, symmetryRule: 'mirror_x', seamAllowanceMm: 5.5, foldAllowanceMm: 0 },
      { partCode: 'A05', standardType: 'bottom_panel', name: '弧底承重底片', quantity: 1, symmetryRule: 'mirror_x', seamAllowanceMm: 5.5, foldAllowanceMm: 0 },
      { partCode: 'O01', standardType: 'top_zipper_flap', name: '包口拉链挡片', quantity: 2, symmetryRule: 'mirror_x', seamAllowanceMm: 5.5, foldAllowanceMm: 0 },
      { partCode: 'H01', standardType: 'handle_strap', name: '腋下主背带', quantity: 1, symmetryRule: 'mirror_x', seamAllowanceMm: 0, foldAllowanceMm: 0 },
      { partCode: 'S01', standardType: 'shoulder_strap', name: '调节长肩带', quantity: 1, symmetryRule: 'mirror_x', seamAllowanceMm: 0, foldAllowanceMm: 0 },
      { partCode: 'L01', standardType: 'lining_body', name: '内缩里衬', quantity: 2, symmetryRule: 'mirror_x', seamAllowanceMm: 8, foldAllowanceMm: 0 },
      { partCode: 'R01', standardType: 'bottom_board', name: '弧底补强板', quantity: 1, symmetryRule: 'mirror_x', seamAllowanceMm: 0, foldAllowanceMm: 0 },
    ],
    relationsSummary: [
      'A01 圆弧底角 R16mm 与 A03/A04 弧长自动匹配对位刀口',
      'O01 拉链挡片左右端退让 6mm',
    ],
    hardwareMounts: ['5# 金属拉链 ×1', '25mm 日字调节扣 ×1', '25mm 侧耳方环 ×2'],
    validationBaseline: { maxSeamToleranceMm: 1.2, requiresSkivingAboveMm: 1.3 },
    templateVersion: 'V1.2-STD',
    status: 'published',
    isCustom: false,
    sizeSeries: [
      { label: '24cm 迷你腋下款', widthMm: 240, heightMm: 165, depthMm: 80 },
      { label: '27cm 标准法棍款', widthMm: 270, heightMm: 185, depthMm: 90 },
    ],
    engineeringArchive: {
      referencePhotosCount: 8,
      structure3DSummary: '月牙弧口前后片 + U形连续底围过渡（R16mm 底角）+ 退让 6mm 拉链挡片',
      skivingAndReinforcementSpec: '弧形侧围两端铲薄至 0.8mm，腋下背带内衬 0.4mm 防拉带',
      productionProcessSpec: '1.6mm 摔纹牛皮多层油边，3.38mm 针距，内衬宽缩量 -4.2mm 避免月牙弧区起皱',
      productionVerificationResult: '已累计实产 300+ 件，弧底接缝齐整度误差 ≤ 0.9mm',
    },
  },
  {
    id: 'tpl_shoulder_saddle_flap',
    name: '马鞍弧形翻盖斜挎肩背包',
    bagType: 'shoulder_bag',
    structureType: 'saddle_flap_crossbody',
    summary: '马鞍U形圆润前/后片 + 长U形软定型围条 + 半圆弧马鞍大翻盖 + 磁扣/锁扣 + 日字扣长肩带',
    authorizedSource: 'RUDA 样板车间实测版型 #SB-02 (马鞍斜挎包)',
    reviewLevel: 5,
    verifiedBy: '陈工（首席打版师）',
    defaultDimensions: {
      ...BAG_ARCHETYPES.shoulder_bag.dimensions,
      widthMm: 245,
      heightMm: 195,
      depthMm: 85,
      gussetStyle: 'curved',
      gussetCurveRadiusMm: 28,
      cornerRadiusMm: 28,
      topOpeningCurveMm: 0,
      seamAllowanceMm: 5.5,
      structureType: 'saddle_flap_crossbody',
    },
    defaultMaterialId: 'box_calf_15',
    defaultEdgeProcess: 'edge_paint',
    defaultFeatures: {
      hasZipperPocket: true,
      hasFrontPocket: false,
      hasSlipPocket: true,
      hasTopZipperFlap: false,
      hasBottomBoard: true,
      hasShoulderStrap: true,
      hasMagneticClosure: true,
      hasTurnLock: false,
      hasLining: true,
    },
    pieceCount: 10,
    partsSpec: [
      { partCode: 'A01', standardType: 'front_panel', name: '马鞍U形前片', quantity: 1, symmetryRule: 'mirror_x', seamAllowanceMm: 5.5, foldAllowanceMm: 0 },
      { partCode: 'A02', standardType: 'back_panel', name: '马鞍U形后片', quantity: 1, symmetryRule: 'mirror_x', seamAllowanceMm: 5.5, foldAllowanceMm: 0 },
      { partCode: 'A03', standardType: 'left_gusset', name: '弧形左围条', quantity: 1, symmetryRule: 'mirror_x', seamAllowanceMm: 5.5, foldAllowanceMm: 0 },
      { partCode: 'A04', standardType: 'right_gusset', name: '弧形右围条', quantity: 1, symmetryRule: 'mirror_x', seamAllowanceMm: 5.5, foldAllowanceMm: 0 },
      { partCode: 'A05', standardType: 'bottom_panel', name: 'U形底弧连接片', quantity: 1, symmetryRule: 'mirror_x', seamAllowanceMm: 5.5, foldAllowanceMm: 0 },
      { partCode: 'O02', standardType: 'top_flap', name: '马鞍半圆翻盖', quantity: 1, symmetryRule: 'mirror_x', seamAllowanceMm: 5, foldAllowanceMm: 0, reinforcement: '0.6mm 超纤挺衬' },
      { partCode: 'S01', standardType: 'shoulder_strap', name: '穿孔调节长肩带', quantity: 1, symmetryRule: 'mirror_x', seamAllowanceMm: 0, foldAllowanceMm: 0 },
      { partCode: 'L01', standardType: 'lining_body', name: '内缩里衬', quantity: 2, symmetryRule: 'mirror_x', seamAllowanceMm: 8, foldAllowanceMm: 0 },
      { partCode: 'R01', standardType: 'bottom_board', name: '底部定型衬板', quantity: 1, symmetryRule: 'mirror_x', seamAllowanceMm: 0, foldAllowanceMm: 0 },
    ],
    relationsSummary: [
      'A01 U形大圆角 R28mm 分段打 3 个对位刀口对齐围条',
      'O02 马鞍翻盖暗磁扣与 A01 中心磁扣同轴对位',
    ],
    hardwareMounts: ['18mm 暗磁扣 ×1', '25mm 日字调节扣 ×1', '侧耳方环 ×2'],
    validationBaseline: { maxSeamToleranceMm: 1.2, requiresSkivingAboveMm: 1.2 },
    templateVersion: 'V1.2-STD',
    status: 'published',
    isCustom: false,
    sizeSeries: [
      { label: '21cm 小号马鞍包', widthMm: 210, heightMm: 170, depthMm: 75 },
      { label: '24.5cm 标准马鞍包', widthMm: 245, heightMm: 195, depthMm: 85 },
    ],
    engineeringArchive: {
      referencePhotosCount: 8,
      structure3DSummary: '大圆角 R28mm 马鞍 U 形主身配分段 3 刀口弧形围条 + 24mm 顶折弧度马鞍翻盖',
      skivingAndReinforcementSpec: '大翻盖贴 0.6mm 超纤挺衬，围条圆角缝份段铲薄至 0.8mm 并打放射剪牙',
      productionProcessSpec: '1.5mm Box Calf 意式油边定型工艺，暗磁扣与背贴垫片同轴定位',
      productionVerificationResult: '样板与小批量 60 件验收通过，马鞍圆弧自然贴合不塌陷',
    },
  },
  {
    id: 'tpl_shoulder_hobo_dart',
    name: '省道褶裥立体软皮 Hobo 单肩包',
    bagType: 'shoulder_bag',
    structureType: 'dart_pleated_hobo',
    summary: '针对不可展双曲软包身采用「底角省道 + 褶量展开」工艺，避免软小牛皮/羊皮强制展开产生严重鼓包或拉伸变形',
    authorizedSource: 'RUDA 曲面展开专项工程库 #SB-03',
    reviewLevel: 4,
    verifiedBy: '陈工（首席打版师）',
    defaultDimensions: {
      ...BAG_ARCHETYPES.shoulder_bag.dimensions,
      widthMm: 310,
      heightMm: 225,
      depthMm: 105,
      gussetStyle: 'curved',
      gussetCurveRadiusMm: 24,
      topOpeningCurveMm: 28,
      cornerRadiusMm: 24,
      seamAllowanceMm: 6,
      foldWidthMm: 8,
      structureType: 'dart_pleated_hobo',
    },
    defaultMaterialId: 'soft_calf_12',
    defaultEdgeProcess: 'folded',
    defaultFeatures: { ...BAG_ARCHETYPES.shoulder_bag.features, hasBottomBoard: false },
    pieceCount: 8,
    partsSpec: [
      { partCode: 'A01', standardType: 'front_panel', name: '带底角省道展开前片', quantity: 1, symmetryRule: 'mirror_x', seamAllowanceMm: 6, foldAllowanceMm: 8 },
      { partCode: 'A02', standardType: 'back_panel', name: '带底角省道展开后片', quantity: 1, symmetryRule: 'mirror_x', seamAllowanceMm: 6, foldAllowanceMm: 8 },
      { partCode: 'A03', standardType: 'left_gusset', name: '分段左侧围片', quantity: 1, symmetryRule: 'mirror_x', seamAllowanceMm: 6, foldAllowanceMm: 0 },
      { partCode: 'A04', standardType: 'right_gusset', name: '分段右侧围片', quantity: 1, symmetryRule: 'mirror_x', seamAllowanceMm: 6, foldAllowanceMm: 0 },
      { partCode: 'A05', standardType: 'bottom_panel', name: '船形收省底片', quantity: 1, symmetryRule: 'mirror_x', seamAllowanceMm: 6, foldAllowanceMm: 0 },
      { partCode: 'H01', standardType: 'handle_strap', name: '加宽一体肩带', quantity: 1, symmetryRule: 'mirror_x', seamAllowanceMm: 0, foldAllowanceMm: 0 },
      { partCode: 'L01', standardType: 'lining_body', name: '软衬里布', quantity: 2, symmetryRule: 'mirror_x', seamAllowanceMm: 8, foldAllowanceMm: 0 },
    ],
    relationsSummary: [
      'A01/A02 底部两侧省道闭合后与船形底片 A05 弧长匹配 ±1.2mm',
    ],
    hardwareMounts: ['5# 尼龙/金属拉链 ×1', '装饰扣环 ×2'],
    validationBaseline: { maxSeamToleranceMm: 1.2, requiresSkivingAboveMm: 1.1 },
    templateVersion: 'V1.2-STD',
    status: 'published',
    isCustom: false,
    sizeSeries: [
      { label: '31cm 经典 Hobo 款', widthMm: 310, heightMm: 225, depthMm: 105 },
      { label: '35cm 大号松弛款', widthMm: 350, heightMm: 255, depthMm: 118 },
    ],
    engineeringArchive: {
      referencePhotosCount: 7,
      structure3DSummary: '双曲率软包身采用「左右 12mm 底角省道」分片展开模型，匹配船形底片消除盲目平展变形',
      skivingAndReinforcementSpec: '包口折边 8mm 铲薄至 0.55mm，省道拼接缝单侧倒边压线，无硬底托保持垂坠感',
      productionProcessSpec: '1.2mm 软小牛皮折边工艺，3.38mm 针距，省道闭合后与船形底片弧长匹配',
      productionVerificationResult: '经 3D-to-2D 省道展开验证与样板试做，双曲表面起皱缺陷降低 85%',
    },
  },

  // =========================================================================
  // 4. WALLET & 5. CARDHOLDER (Baseline Authorized Templates)
  // =========================================================================
  {
    id: 'tpl_wallet_bifold',
    name: '经典六卡位对折短款钱包',
    bagType: 'wallet',
    structureType: 'bifold_layered_wallet',
    summary: '加长弧度外皮（含弯折余量 +3mm）+ 对折内大面 + 左右阶梯式 T 型卡位层 ×6 + 钞位隔层',
    authorizedSource: 'RUDA 小皮件精密打版标准 #WL-01',
    reviewLevel: 5,
    verifiedBy: '陈工（首席打版师）',
    defaultDimensions: {
      ...BAG_ARCHETYPES.wallet.dimensions,
      widthMm: 220,
      heightMm: 95,
      depthMm: 18,
      seamAllowanceMm: 3.5,
      stitchSpacingMm: 3.0,
      structureType: 'bifold_layered_wallet',
    },
    defaultMaterialId: 'box_calf_15',
    defaultEdgeProcess: 'edge_paint',
    defaultFeatures: { ...BAG_ARCHETYPES.wallet.features },
    pieceCount: 6,
    partsSpec: [
      { partCode: 'W01', standardType: 'front_panel', name: '对折外皮（含弯折余量）', quantity: 1, symmetryRule: 'mirror_x', seamAllowanceMm: 3.5, foldAllowanceMm: 0 },
      { partCode: 'W02', standardType: 'back_panel', name: '钞位内大面', quantity: 1, symmetryRule: 'mirror_x', seamAllowanceMm: 3.5, foldAllowanceMm: 0 },
      { partCode: 'W03', standardType: 'slip_pocket', name: '阶梯T型卡位层', quantity: 4, symmetryRule: 'mirror_x', seamAllowanceMm: 3.0, foldAllowanceMm: 0 },
      { partCode: 'W04', standardType: 'bottom_panel', name: '底位兜底卡槽片', quantity: 2, symmetryRule: 'mirror_x', seamAllowanceMm: 3.0, foldAllowanceMm: 0 },
      { partCode: 'L01', standardType: 'lining_body', name: '钞位羊皮/斜纹内衬', quantity: 1, symmetryRule: 'mirror_x', seamAllowanceMm: 3.5, foldAllowanceMm: 0 },
    ],
    relationsSummary: [
      'W01 外皮比 W02 内大面长 +4mm 以补偿 1.5mm 皮料对折弧度',
      'W03 T型卡槽两侧铲薄至 0.45mm 叠缝于 W02',
    ],
    hardwareMounts: ['无五金（纯手工油边车缝）'],
    validationBaseline: { maxSeamToleranceMm: 0.6, requiresSkivingAboveMm: 0.8 },
    templateVersion: 'V1.2-STD',
    status: 'published',
    isCustom: false,
    sizeSeries: [
      { label: '标准对折短夹 (220×95mm)', widthMm: 220, heightMm: 95, depthMm: 18 },
    ],
    engineeringArchive: {
      referencePhotosCount: 6,
      structure3DSummary: '外皮相对内大面增加 +4mm 弯折中性层余量，4 片阶梯 T 型卡槽交错减薄叠缝',
      skivingAndReinforcementSpec: 'T型卡槽翼片整片铲薄至 0.45mm，外皮对折中脊区铲薄至 0.8mm 保证合拢平整',
      productionProcessSpec: '1.5mm Box Calf 精微油边工艺，3.0mm 密斩针距，卡位上沿先单独油边再组装',
      productionVerificationResult: '已完成精密公差试产，合拢无外翘，外形尺寸偏差 ≤ 0.4mm',
    },
  },
  {
    id: 'tpl_cardholder_slim',
    name: '中芯叠层四卡位超薄卡包',
    bagType: 'cardholder',
    structureType: 'slim_multislot_cardholder',
    summary: '对称中芯片（带弧形取卡槽口）+ 正反各两层阶梯卡槽片（边缘铲薄至 0.45mm）',
    authorizedSource: 'RUDA 小皮件精密打版标准 #CH-01',
    reviewLevel: 5,
    verifiedBy: '陈工（首席打版师）',
    defaultDimensions: {
      ...BAG_ARCHETYPES.cardholder.dimensions,
      widthMm: 102,
      heightMm: 74,
      depthMm: 8,
      seamAllowanceMm: 3.0,
      stitchSpacingMm: 2.7,
      structureType: 'slim_multislot_cardholder',
    },
    defaultMaterialId: 'soft_calf_12',
    defaultEdgeProcess: 'edge_paint',
    defaultFeatures: { ...BAG_ARCHETYPES.cardholder.features },
    pieceCount: 5,
    partsSpec: [
      { partCode: 'C01', standardType: 'front_panel', name: '中芯主隔片', quantity: 1, symmetryRule: 'mirror_x', seamAllowanceMm: 3.0, foldAllowanceMm: 0 },
      { partCode: 'C02', standardType: 'slip_pocket', name: '上层带弧口卡槽片', quantity: 2, symmetryRule: 'mirror_x', seamAllowanceMm: 3.0, foldAllowanceMm: 0 },
      { partCode: 'C03', standardType: 'bottom_panel', name: '下层兜底卡槽片', quantity: 2, symmetryRule: 'mirror_x', seamAllowanceMm: 3.0, foldAllowanceMm: 0 },
    ],
    relationsSummary: [
      'C02/C03 左右及底边对齐 C01 边缘统一 3.0mm 斩距缝合后修边油边',
    ],
    hardwareMounts: ['无五金'],
    validationBaseline: { maxSeamToleranceMm: 0.5, requiresSkivingAboveMm: 0.7 },
    templateVersion: 'V1.2-STD',
    status: 'published',
    isCustom: false,
    sizeSeries: [
      { label: '四卡位超薄标准版 (102×74mm)', widthMm: 102, heightMm: 74, depthMm: 8 },
    ],
    engineeringArchive: {
      referencePhotosCount: 5,
      structure3DSummary: '对称双面叠层结构（中芯主片 + 正反阶梯弧口卡槽片），总成厚度控制 ≤ 4.8mm',
      skivingAndReinforcementSpec: '卡槽片结合边全周 5mm 铲薄至 0.45mm，取卡弧口内衬 0.2mm 无弹防撕膜',
      productionProcessSpec: '1.2mm 软小牛皮精密修边油边（4道细砂打磨），2.7mm 超密斩距车缝',
      productionVerificationResult: '实产检验公差 ±0.35mm，插拔银行卡阻尼适中',
    },
  },
];

export function getMasterTemplateById(
  id: string,
  extraTemplates: MasterPatternTemplate[] = []
): MasterPatternTemplate | undefined {
  return [...extraTemplates, ...MASTER_PATTERN_LIBRARY].find((t) => t.id === id);
}

export interface TemplateSearchFilters {
  bagType?: BagType;
  structureType?: StructureType;
  partQuery?: string;
  materialId?: string;
  edgeProcess?: string;
  status?: 'published' | 'draft' | 'archived';
}

export function searchMasterTemplates(
  templates: MasterPatternTemplate[],
  filters: TemplateSearchFilters
): MasterPatternTemplate[] {
  return templates.filter((tpl) => {
    if (filters.bagType && tpl.bagType !== filters.bagType) return false;
    if (filters.structureType && tpl.structureType !== filters.structureType) return false;
    if (filters.materialId && tpl.defaultMaterialId !== filters.materialId) return false;
    if (filters.edgeProcess && tpl.defaultEdgeProcess !== filters.edgeProcess) return false;
    if (filters.status && (tpl.status ?? 'published') !== filters.status) return false;
    if (filters.partQuery && filters.partQuery.trim()) {
      const q = filters.partQuery.trim().toLowerCase();
      const hitPart = tpl.partsSpec.some(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.partCode.toLowerCase().includes(q) ||
          p.standardType.toLowerCase().includes(q)
      );
      const hitText =
        tpl.name.toLowerCase().includes(q) ||
        tpl.summary.toLowerCase().includes(q) ||
        tpl.authorizedSource.toLowerCase().includes(q);
      if (!hitPart && !hitText) return false;
    }
    return true;
  });
}

export interface TemplateMatchResult {
  template: MasterPatternTemplate;
  matchScore: number; // 0..1
  dimensionDeltaSummary: string;
  structuralNotes: string;
}

export function matchMasterTemplates(params: {
  bagType: BagType;
  structureType?: StructureType;
  dimensions?: Partial<ProductDimensions>;
  features?: Partial<EnabledFeatures>;
  materialId?: string;
  extraTemplates?: MasterPatternTemplate[];
}): TemplateMatchResult[] {
  const all = [...(params.extraTemplates ?? []).filter((t) => (t.status ?? 'published') === 'published'), ...MASTER_PATTERN_LIBRARY];
  const candidates = all.filter((t) => t.bagType === params.bagType);
  const pool = candidates.length > 0 ? candidates : all;

  return pool
    .map((tpl) => {
      let score = 0.55;
      if (params.structureType && tpl.structureType === params.structureType) {
        score += 0.25;
      }
      if (params.materialId && tpl.defaultMaterialId === params.materialId) {
        score += 0.06;
      }
      if (params.features) {
        if (params.features.hasTopZipperFlap === tpl.defaultFeatures.hasTopZipperFlap) score += 0.04;
        if (params.features.hasTurnLock === tpl.defaultFeatures.hasTurnLock) score += 0.04;
        if (params.features.hasFrontPocket === tpl.defaultFeatures.hasFrontPocket) score += 0.03;
      }
      if (params.dimensions?.gussetStyle && params.dimensions.gussetStyle === tpl.defaultDimensions.gussetStyle) {
        score += 0.03;
      }

      const dw = Math.round((params.dimensions?.widthMm ?? tpl.defaultDimensions.widthMm) - tpl.defaultDimensions.widthMm);
      const dh = Math.round((params.dimensions?.heightMm ?? tpl.defaultDimensions.heightMm) - tpl.defaultDimensions.heightMm);
      const dd = Math.round((params.dimensions?.depthMm ?? tpl.defaultDimensions.depthMm) - tpl.defaultDimensions.depthMm);

      const deltaParts: string[] = [];
      if (dw !== 0) deltaParts.push(`宽 ${dw > 0 ? `+${dw}` : dw}mm`);
      if (dh !== 0) deltaParts.push(`高 ${dh > 0 ? `+${dh}` : dh}mm`);
      if (dd !== 0) deltaParts.push(`深 ${dd > 0 ? `+${dd}` : dd}mm`);
      const dimensionDeltaSummary = deltaParts.length > 0 ? deltaParts.join(' · ') : '与标准样板尺寸一致';

      return {
        template: tpl,
        matchScore: Math.min(0.99, Math.round(score * 100) / 100),
        dimensionDeltaSummary,
        structuralNotes: `${tpl.pieceCount} 个标准裁片 · ${tpl.authorizedSource}`,
      };
    })
    .sort((a, b) => b.matchScore - a.matchScore);
}
