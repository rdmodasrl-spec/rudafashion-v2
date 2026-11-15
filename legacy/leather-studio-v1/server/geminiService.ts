import fs from 'node:fs';
import path from 'node:path';
import { GoogleGenAI, Type } from '@google/genai';
import {
  BAG_ARCHETYPES,
  KNOWLEDGE_BASE_META,
  MATERIAL_LIBRARY,
  PROCESS_SCHEMES,
} from '../src/shared/leatherKnowledge';
import {
  buildQualityAssessmentReport,
  computeSmartNesting,
} from '../src/shared/cadEngine';
import type {
  BagType,
  CommandPlan,
  EdgeProcessType,
  EnabledFeatures,
  GussetStyle,
  ProductImage,
  Project,
  StructureType,
  StructuredCadCommand,
} from '../src/shared/types';
import type { RetrievedMemoryBundle } from './intelligenceService.ts';

export function getGeminiModelId(): string {
  return process.env.GEMINI_MODEL || 'gemini-4-hydrogen';
}

function getAiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY 未配置，请在 Settings > Secrets 面板检查 API Key。');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function mapGeminiError(err: unknown): Error {
  const raw = err instanceof Error ? err.message : String(err);
  if (raw.includes('GEMINI_API_KEY') || raw.includes('API_KEY_INVALID') || raw.includes('401')) {
    return new Error('Gemini API Key 未配置或无效，请在 Settings > Secrets 中确认 GEMINI_API_KEY。');
  }
  if (raw.includes('429') || raw.includes('RESOURCE_EXHAUSTED')) {
    return new Error('Gemini 模型请求频率受限 (429)，请稍候几秒后重试。');
  }
  if (raw.includes('404') || raw.includes('NOT_FOUND')) {
    return new Error(`Gemini 模型 "${getGeminiModelId()}" 不可用，请检查模型配置。`);
  }
  return err instanceof Error ? err : new Error(raw);
}

async function withRetry<T>(fn: () => Promise<T>, maxRetries = 2): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const msg = err instanceof Error ? err.message : String(err);
      const isTransient =
        msg.includes('429') ||
        msg.includes('503') ||
        msg.includes('UNAVAILABLE') ||
        msg.includes('ECONNRESET') ||
        msg.includes('ETIMEDOUT');
      if (!isTransient || attempt === maxRetries) {
        throw mapGeminiError(err);
      }
      await new Promise((r) => setTimeout(r, 900 * Math.pow(2, attempt)));
    }
  }
  throw mapGeminiError(lastErr);
}

function resolveImageToInlineData(img: ProductImage): { mimeType: string; data: string } | null {
  if (img.dataUrl.startsWith('data:')) {
    const match = img.dataUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (match) {
      return { mimeType: match[1], data: match[2] };
    }
  }
  // Support local sample asset paths like /src/assets/images/...
  if (img.dataUrl.startsWith('/src/') || img.dataUrl.startsWith('src/')) {
    const rel = img.dataUrl.startsWith('/') ? img.dataUrl.slice(1) : img.dataUrl;
    const absPath = path.resolve(process.cwd(), rel);
    if (fs.existsSync(absPath)) {
      const buf = fs.readFileSync(absPath);
      return {
        mimeType: img.mimeType || 'image/jpeg',
        data: buf.toString('base64'),
      };
    }
  }
  return null;
}

export interface VisionAnalysisPayload {
  detectedBagType: BagType;
  detectedStructureType: StructureType;
  competingStructuresConsidered?: Array<{
    structureType: StructureType;
    reasonRejected: string;
  }>;
  detectedAngles: string[];
  detectedSeamsAndBoundaries: string[];
  integratedVsSeparateNotes: string;
  perspectiveDistortionRisk: 'low' | 'medium' | 'high';
  perspectiveNote: string;
  multiViewConsistencyNote: string;
  confidence: number;
  visualNotes: string;
  observedFeatures: string[];
  uncertainStructures: string[];
  clarifyingQuestion?: string;
  userProvidedDimensions: boolean;
  widthMm: number;
  heightMm: number;
  depthMm: number;
  handleLengthMm: number;
  materialId: string;
  edgeProcess: EdgeProcessType;
  gussetStyle: GussetStyle;
  features: EnabledFeatures;
  detectedParts: Array<{
    standardType: string;
    name: string;
    confidence: number;
    isInferredHidden: boolean;
    boundingBox2D?: [number, number, number, number];
  }>;
}

const VALID_STRUCTURE_TYPES: StructureType[] = [
  'independent_gusset_bottom',
  'fold_wrap_body',
  'zipper_commuter_tote',
  'trapezoid_flap_frame',
  'boston_piped_shell',
  'kelly_accordion_gusset',
  'curved_u_gusset',
  'saddle_flap_crossbody',
  'dart_pleated_hobo',
  'bifold_layered_wallet',
  'slim_multislot_cardholder',
];

export async function analyzeBagPhotosWithGemini(
  images: ProductImage[],
  userBrief: string
): Promise<VisionAnalysisPayload> {
  const ai = getAiClient();

  const imageParts: Array<{ inlineData: { mimeType: string; data: string } }> = [];
  for (const img of images.slice(0, 4)) {
    const inline = resolveImageToInlineData(img);
    if (inline) {
      imageParts.push({ inlineData: inline });
    }
  }

  const materialOptions = MATERIAL_LIBRARY.filter(
    (m) => m.category !== 'lining' && m.category !== 'reinforcement'
  )
    .map((m) => `${m.id}: ${m.name} (${m.thicknessMm}mm, ${m.temper})`)
    .join('\n');

  const isSinglePhoto = images.length <= 1;

  const systemInstruction = `你是 RUDA AI Leather Studio 的资深皮具图像反向工程与结构打版专家。
你必须严格执行【任务一（图像识别）】与【任务二（皮具结构反向推理）】的物理与工程分离，绝不能将图像轮廓分割直接当作二维纸格：

【任务一：图像识别 (Vision Recognition)】
1. 产品角度识别（detectedAngles）：明确判断上传照片属于正面、45°斜侧、侧面、底面、内部或五金特写。
2. 整体包型识别（detectedBagType）：仅限 'tote'（托特包）、'handbag'（手提包）、'shoulder_bag'（肩背包）、'wallet'（对折钱包）、'cardholder'（超薄卡包）。
3. 可见部件分割（detectedParts, isInferredHidden: false）：仅标记照片上真实可见部件及 [ymin, xmin, ymax, xmax] 归一化坐标。
4. 缝线和部件边界识别（detectedSeamsAndBoundaries）：明确列出照片可见的外圈车线、滚边骨条、折边/油边边界与拼接线。

【任务二：皮具结构反向推理 (Structure Reasoning)】
1. 判断制造结构（detectedStructureType）：必须从以下 11 种工业标准结构中选出最匹配的一种：
   - 托特包: independent_gusset_bottom | fold_wrap_body | zipper_commuter_tote
   - 手提包: trapezoid_flap_frame | boston_piped_shell | kelly_accordion_gusset
   - 肩背包: curved_u_gusset | saddle_flap_crossbody | dart_pleated_hobo
   - 钱包/卡包: bifold_layered_wallet | slim_multislot_cardholder
   同时在 competingStructuresConsidered 至少列出 1–2 个相同外观下可能混淆的备选结构及排除理由（例如：为何排除一体折底而选用独立底片）。
2. 一体 vs 独立裁切判定（integratedVsSeparateNotes）：明确说明前片/底片/后片是否一体展开弯折，还是独立分片缝合。
3. 隐藏内部推理（detectedParts, isInferredHidden: true）：推理内部里布、拉链袋、底托加固板等不可见但必须存在的部件。
4. 视角、透视与未确认风险评估（${isSinglePhoto ? '当前仅上传 0-1 张照片' : `当前共上传 ${images.length} 个角度照片`}）：
   - 若仅单张照片，perspectiveDistortionRisk 必须为 'medium' 或 'high'，明确说明透视比例与背面/内部遮挡不可确认，不得伪造高确定性。
   - 若多角度照片，在 multiViewConsistencyNote 总结正面与侧面/底部比例是否一致。
5. 尺寸规则：仅当用户在描述中给出具体数值时设置 userProvidedDimensions=true；若未给出，根据常见比例给出估算毫米值，设 userProvidedDimensions=false，并在 clarifyingQuestion 询问唯一最关键实测维度（如包宽或包高）。
6. 可选 materialId 仅限：\n${materialOptions}`;

  const response = await withRetry(() =>
    ai.models.generateContent({
      model: getGeminiModelId(),
      contents: {
        parts: [
          ...imageParts,
          {
            text: `用户设计要求：${userBrief || '请分析这张皮具照片并严格按图像识别与结构推理拆解。'}\n已上传照片数量：${images.length} 张；角度标签：${images.map((i) => i.angle).join(', ') || '无照片（仅文字描述）'}`,
          },
        ],
      },
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            detectedBagType: {
              type: Type.STRING,
              description: 'Must be one of: tote, handbag, shoulder_bag, wallet, cardholder',
            },
            detectedStructureType: {
              type: Type.STRING,
              description: 'One of the 11 StructureType values',
            },
            competingStructuresConsidered: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  structureType: { type: Type.STRING },
                  reasonRejected: { type: Type.STRING },
                },
                required: ['structureType', 'reasonRejected'],
              },
            },
            detectedAngles: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            detectedSeamsAndBoundaries: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            integratedVsSeparateNotes: { type: Type.STRING },
            perspectiveDistortionRisk: {
              type: Type.STRING,
              description: 'One of: low, medium, high',
            },
            perspectiveNote: { type: Type.STRING },
            multiViewConsistencyNote: { type: Type.STRING },
            confidence: { type: Type.NUMBER },
            visualNotes: { type: Type.STRING },
            observedFeatures: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            uncertainStructures: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            clarifyingQuestion: { type: Type.STRING },
            userProvidedDimensions: { type: Type.BOOLEAN },
            widthMm: { type: Type.NUMBER },
            heightMm: { type: Type.NUMBER },
            depthMm: { type: Type.NUMBER },
            handleLengthMm: { type: Type.NUMBER },
            materialId: { type: Type.STRING },
            edgeProcess: {
              type: Type.STRING,
              description: 'One of: raw_burnish, edge_paint, folded, piped, bound',
            },
            gussetStyle: {
              type: Type.STRING,
              description: 'One of: straight, curved, tapered',
            },
            features: {
              type: Type.OBJECT,
              properties: {
                hasZipperPocket: { type: Type.BOOLEAN },
                hasFrontPocket: { type: Type.BOOLEAN },
                hasSlipPocket: { type: Type.BOOLEAN },
                hasTopZipperFlap: { type: Type.BOOLEAN },
                hasBottomBoard: { type: Type.BOOLEAN },
                hasShoulderStrap: { type: Type.BOOLEAN },
                hasMagneticClosure: { type: Type.BOOLEAN },
                hasTurnLock: { type: Type.BOOLEAN },
                hasLining: { type: Type.BOOLEAN },
              },
              required: [
                'hasZipperPocket',
                'hasFrontPocket',
                'hasSlipPocket',
                'hasTopZipperFlap',
                'hasBottomBoard',
                'hasShoulderStrap',
                'hasMagneticClosure',
                'hasTurnLock',
                'hasLining',
              ],
            },
            detectedParts: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  standardType: { type: Type.STRING },
                  name: { type: Type.STRING },
                  confidence: { type: Type.NUMBER },
                  isInferredHidden: { type: Type.BOOLEAN },
                  boundingBox2D: {
                    type: Type.ARRAY,
                    items: { type: Type.NUMBER },
                  },
                },
                required: ['standardType', 'name', 'confidence', 'isInferredHidden'],
              },
            },
          },
          required: [
            'detectedBagType',
            'detectedStructureType',
            'detectedAngles',
            'detectedSeamsAndBoundaries',
            'integratedVsSeparateNotes',
            'perspectiveDistortionRisk',
            'perspectiveNote',
            'multiViewConsistencyNote',
            'confidence',
            'visualNotes',
            'observedFeatures',
            'uncertainStructures',
            'userProvidedDimensions',
            'widthMm',
            'heightMm',
            'depthMm',
            'handleLengthMm',
            'materialId',
            'edgeProcess',
            'gussetStyle',
            'features',
            'detectedParts',
          ],
        },
      },
    })
  );

  const text = (response.text ?? '{}').trim();
  const parsed = JSON.parse(text) as VisionAnalysisPayload;

  const validBagTypes: BagType[] = ['tote', 'handbag', 'shoulder_bag', 'wallet', 'cardholder'];
  const bagType: BagType = validBagTypes.includes(parsed.detectedBagType)
    ? parsed.detectedBagType
    : 'tote';

  const fallbackStructure: StructureType =
    BAG_ARCHETYPES[bagType].dimensions.structureType ?? 'independent_gusset_bottom';
  const structureType: StructureType = VALID_STRUCTURE_TYPES.includes(parsed.detectedStructureType)
    ? parsed.detectedStructureType
    : fallbackStructure;

  const validMat = MATERIAL_LIBRARY.some((m) => m.id === parsed.materialId)
    ? parsed.materialId
    : BAG_ARCHETYPES[bagType].materialId;

  const validEdge: EdgeProcessType = (
    ['raw_burnish', 'edge_paint', 'folded', 'piped', 'bound'] as EdgeProcessType[]
  ).includes(parsed.edgeProcess)
    ? parsed.edgeProcess
    : BAG_ARCHETYPES[bagType].edgeProcess;

  const validGusset: GussetStyle = (['straight', 'curved', 'tapered'] as GussetStyle[]).includes(
    parsed.gussetStyle
  )
    ? parsed.gussetStyle
    : BAG_ARCHETYPES[bagType].dimensions.gussetStyle;

  const minW = bagType === 'cardholder' ? 80 : bagType === 'wallet' ? 140 : 120;
  const minH = bagType === 'cardholder' ? 55 : bagType === 'wallet' ? 70 : 100;
  const minD = bagType === 'cardholder' ? 4 : bagType === 'wallet' ? 6 : 40;

  const risk: 'low' | 'medium' | 'high' =
    isSinglePhoto && parsed.perspectiveDistortionRisk === 'low'
      ? 'medium'
      : parsed.perspectiveDistortionRisk === 'low' ||
          parsed.perspectiveDistortionRisk === 'medium' ||
          parsed.perspectiveDistortionRisk === 'high'
        ? parsed.perspectiveDistortionRisk
        : isSinglePhoto
          ? 'high'
          : 'low';

  return {
    ...parsed,
    detectedBagType: bagType,
    detectedStructureType: structureType,
    perspectiveDistortionRisk: risk,
    perspectiveNote:
      parsed.perspectiveNote ||
      (isSinglePhoto
        ? '仅单张照片输入，无法排除广角/仰拍透视畸变，背面与内部结构未经实拍验证。'
        : `基于 ${images.length} 张多角度照片交叉比对主轮廓比例。`),
    multiViewConsistencyNote:
      parsed.multiViewConsistencyNote ||
      (isSinglePhoto
        ? '单视角模式：缺少侧面与内部视图，无法执行多视角尺寸一致性交叉核验。'
        : `多视角一致性检查已比对 ${images.map((i) => i.angle).join(' / ')} 角度。`),
    materialId: validMat,
    edgeProcess: validEdge,
    gussetStyle: validGusset,
    widthMm: Math.max(minW, Math.min(600, Math.round(parsed.widthMm || BAG_ARCHETYPES[bagType].dimensions.widthMm))),
    heightMm: Math.max(minH, Math.min(550, Math.round(parsed.heightMm || BAG_ARCHETYPES[bagType].dimensions.heightMm))),
    depthMm: Math.max(minD, Math.min(280, Math.round(parsed.depthMm || BAG_ARCHETYPES[bagType].dimensions.depthMm))),
    handleLengthMm: Math.max(120, Math.min(850, Math.round(parsed.handleLengthMm || BAG_ARCHETYPES[bagType].dimensions.handleLengthMm))),
  };
}

export async function planNaturalLanguageCommandWithGemini(
  project: Project,
  userPrompt: string,
  retrievedMemory?: RetrievedMemoryBundle
): Promise<CommandPlan> {
  const ai = getAiClient();

  const materialList = MATERIAL_LIBRARY.map(
    (m) => `${m.id}: ${m.name} (${m.thicknessMm}mm, ${m.temper}, 默认工艺:${m.recommendedEdgeProcess})`
  ).join('\n');

  const currentPartsSummary = project.patterns
    .map(
      (p) =>
        `${p.partCode} ${p.name} (id:${p.id}, ${p.boundingBoxMm.width}x${p.boundingBoxMm.height}mm, qty:${p.quantity}, edges:${JSON.stringify(p.edgeLengthsMm)})`
    )
    .join('\n');

  // Layer 1 Session Memory: keep only last 4 turns instead of dumping entire chat history
  const recentMessages = project.messages
    .slice(-4)
    .map((m) => `${m.role === 'user' ? '用户' : 'AI'}: ${m.content}`)
    .join('\n');

  const nestingPreview = computeSmartNesting(
    project.patterns,
    project.materialId,
    project.hardware
  );
  const qualitySummary = buildQualityAssessmentReport(project);
  const processSummary = PROCESS_SCHEMES.map(
    (s) => `${s.id}(${s.name}): 缝份${s.seamAllowanceMm}mm, 针距${s.stitchSpacingMm}mm, 铲薄至${s.skiveEdgeTargetMm}mm`
  ).join('\n');

  const memoryContextBlock = retrievedMemory
    ? `\n已检索五层长记忆与专业知识库（按相似度与结构过滤）：
- [Layer 2 用户偏好]: ${JSON.stringify(retrievedMemory.userPreferences)}；长期习惯=${retrievedMemory.userMemories.map((m) => `${m.memoryKey}:${m.content}(L${m.reviewLevel})`).join('；') || '暂无'}
- [Layer 4 工程知识(LEVEL1-5)]: ${retrievedMemory.engineeringKnowledge.map((k) => `[L${k.reviewLevel}] ${k.title}: ${k.content}`).join('\n  ') || '暂无'}
- [Layer 4 结构连接规则(pgvector 匹配)]: ${retrievedMemory.constructionRules.map((r) => `[${r.code} ±${r.toleranceMm}mm] ${r.title}: ${r.ruleDetail}`).join('；') || '暂无'}
- [Layer 5 相似验证案例(仅供参考，不可直接套用)]: ${retrievedMemory.similarCases.map((c) => `[L${c.reviewLevel}${c.productionVerified ? '/实产通过' : ''}] ${c.title}: ${c.processSummary}`).join('；') || '暂无'}
- [Layer 5 历史错题与修复经验]: ${retrievedMemory.experienceRecords.map((e) => `[${e.errorCategory}] ${e.errorLocation} -> ${e.fixMethod}`).join('；') || '暂无'}`
    : '';

  const systemInstruction = `你是 RUDA Leather AI Agent（工程知识库版本 ${KNOWLEDGE_BASE_META.version}），负责将用户的自然语言与设计目标转换为可真实执行的 CAD 工具指令（绝对禁止输出代码，禁止仅口头回复假装修改）。注意：LEVEL 1（AI推测）知识仅供参考，不得直接充当生产规则；参考案例不可不经判断直接复制。
当前项目实时工程上下文：
- 包型：${project.bagType}
- 当前尺寸：宽 ${project.dimensions.widthMm}mm × 高 ${project.dimensions.heightMm}mm × 深 ${project.dimensions.depthMm}mm，提手长 ${project.dimensions.handleLengthMm}mm，底厚 ${project.dimensions.bottomThicknessMm}mm，侧面造型 ${project.dimensions.gussetStyle}，圆角 ${project.dimensions.cornerRadiusMm}mm，尺寸来源 ${project.dimensions.dimensionSource}
- 当前材料：${project.materialId}，边缘工艺：${project.edgeProcess}，缝份：${project.dimensions.seamAllowanceMm}mm，孔距：${project.dimensions.stitchSpacingMm}mm
- 当前排料利用率：${nestingPreview.utilizationPct}%（主面净耗 ${nestingPreview.netPiecesAreaDm2} dm²，预估物料成本 ¥${nestingPreview.estimatedTotalMaterialCostCny}）
- 当前质量状态：几何验证=${qualitySummary.geometryVerified}，工艺检查=${qualitySummary.processRuleVerified}，风险=${qualitySummary.productionRisks.join('；') || '无'}
- 已启用功能：${JSON.stringify(project.features)}
- 当前纸格部件：\n${currentPartsSummary}
- 可选材料库：\n${materialList}
- 工程工艺方案库：\n${processSummary}${memoryContextBlock}

可用 CAD 指令 intent 白名单：
1. "resize_product": 修改整体长宽高/底厚。参数：widthMm, heightMm, depthMm, deltaWidthMm, deltaHeightMm, deltaDepthMm, bottomThicknessMm（1厘米=10mm）。
2. "resize_component": 修改提手长度或全局缝份。target="handle" 时使用 deltaLengthMm，seamAllowanceMm。
3. "modify_geometry": 修改侧面或包身轮廓。参数：gussetStyle ("straight"|"curved"|"tapered"), gussetCurveRadiusMm, cornerRadiusMm, topOpeningCurveMm, bottomThicknessMm。
4. "add_component": 新增部件。参数 componentType 必须是："zipper_pocket"|"front_pocket"|"slip_pocket"|"top_zipper_flap"|"shoulder_strap"|"bottom_board"|"magnetic_closure"。
5. "remove_component": 删除部件。参数 componentType 同上，或 pieceId。
6. "change_material": 修改皮料或工艺。参数 materialId（必须从材料库选），edgeProcess ("raw_burnish"|"edge_paint"|"folded"|"piped"|"bound")，stitchSpacingMm。
7. "calibrate_scale": 按单个实际尺寸等比校准。参数 referenceAxis ("width"|"height"|"depth"), actualMm。
8. "optimize_pattern": 工程优化执行。参数 optimizationGoal 必须是："reduce_waste"（优化缝份与纹理排版降废料）|"reduce_seams"（精简不必要拼接）|"italian_luxury"（升级意式箱包皮料油边与底角结构）|"comfort_handle"（加长与人体工学提手舒适度优化）|"optimize_zipper"（优化拉链位置与挡片退让量）。
9. "apply_nesting": 执行皮革纹理锁定与避瑕智能自动排料（parameters 为 {}）。
10. "undo_last": 撤销上一步修改。
11. "redo_last": 恢复刚才撤销的修改。
12. "design_advice": 当用户提出大范围风格改造或模糊美学目标（如“做一个更高级的意大利风格手提包”、“减少不必要拼接”、“更有立体感”）时，先不直接改图，commands 设为 []，在 proposedOptions 提供 2 个含具体 CAD commands 的专业方案供用户确认！

策略规则：
- 明确安全的操作（如“包底增加支撑保持外观不变” -> modify_geometry bottomThicknessMm=3.2 + add_component bottom_board；“里面增加两个口袋” -> add_component zipper_pocket + slip_pocket；“提手更舒适” -> optimize_pattern comfort_handle；“尽量减少材料浪费” -> optimize_pattern reduce_waste；“改成软一些的小牛皮” -> change_material soft_calf_12），设 needsConfirmation = false 直接返回对应 commands，并在 replyText 说明具体会更新哪些部件与工艺影响。
- 大范围风格/结构重设或删除结构，设 needsConfirmation = true 并提供 proposedOptions。`;

  const response = await withRetry(() =>
    ai.models.generateContent({
      model: getGeminiModelId(),
      contents: `最近会话：\n${recentMessages}\n\n用户最新输入：${userPrompt}`,
    config: {
      systemInstruction,
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          summary: { type: Type.STRING },
          replyText: { type: Type.STRING },
          needsConfirmation: { type: Type.BOOLEAN },
          isDestructiveOrMajor: { type: Type.BOOLEAN },
          clarifyingQuestion: { type: Type.STRING },
          affectedParts: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
          commands: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                intent: { type: Type.STRING },
                target: { type: Type.STRING },
                operation: { type: Type.STRING },
                parameters: {
                  type: Type.OBJECT,
                  properties: {
                    widthMm: { type: Type.NUMBER },
                    heightMm: { type: Type.NUMBER },
                    depthMm: { type: Type.NUMBER },
                    deltaWidthMm: { type: Type.NUMBER },
                    deltaHeightMm: { type: Type.NUMBER },
                    deltaDepthMm: { type: Type.NUMBER },
                    deltaLengthMm: { type: Type.NUMBER },
                    bottomThicknessMm: { type: Type.NUMBER },
                    gussetStyle: { type: Type.STRING },
                    gussetCurveRadiusMm: { type: Type.NUMBER },
                    topOpeningCurveMm: { type: Type.NUMBER },
                    cornerRadiusMm: { type: Type.NUMBER },
                    componentType: { type: Type.STRING },
                    pieceId: { type: Type.STRING },
                    materialId: { type: Type.STRING },
                    edgeProcess: { type: Type.STRING },
                    stitchSpacingMm: { type: Type.NUMBER },
                    seamAllowanceMm: { type: Type.NUMBER },
                    referenceAxis: { type: Type.STRING },
                    actualMm: { type: Type.NUMBER },
                    optimizationGoal: { type: Type.STRING },
                    hideWidthMm: { type: Type.NUMBER },
                    hideHeightMm: { type: Type.NUMBER },
                  },
                },
              },
              required: ['intent', 'target', 'operation', 'parameters'],
            },
          },
          proposedOptions: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                title: { type: Type.STRING },
                description: { type: Type.STRING },
                commands: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      intent: { type: Type.STRING },
                      target: { type: Type.STRING },
                      operation: { type: Type.STRING },
                      parameters: {
                        type: Type.OBJECT,
                        properties: {
                          widthMm: { type: Type.NUMBER },
                          heightMm: { type: Type.NUMBER },
                          depthMm: { type: Type.NUMBER },
                          deltaWidthMm: { type: Type.NUMBER },
                          deltaHeightMm: { type: Type.NUMBER },
                          deltaDepthMm: { type: Type.NUMBER },
                          deltaLengthMm: { type: Type.NUMBER },
                          bottomThicknessMm: { type: Type.NUMBER },
                          gussetStyle: { type: Type.STRING },
                          gussetCurveRadiusMm: { type: Type.NUMBER },
                          cornerRadiusMm: { type: Type.NUMBER },
                          componentType: { type: Type.STRING },
                          materialId: { type: Type.STRING },
                          edgeProcess: { type: Type.STRING },
                          optimizationGoal: { type: Type.STRING },
                        },
                      },
                    },
                    required: ['intent', 'target', 'operation', 'parameters'],
                  },
                },
              },
              required: ['id', 'title', 'description', 'commands'],
            },
          },
        },
        required: [
          'summary',
          'replyText',
          'needsConfirmation',
          'isDestructiveOrMajor',
          'affectedParts',
          'commands',
        ],
      },
    },
    })
  );

  const rawText = (response.text ?? '{}').trim();
  const parsed = JSON.parse(rawText) as Omit<CommandPlan, 'planId' | 'userPrompt'>;

  const memoryHints: string[] = [];
  if (retrievedMemory) {
    for (const k of retrievedMemory.engineeringKnowledge.slice(0, 2)) {
      memoryHints.push(`[知识 L${k.reviewLevel}] ${k.title}`);
    }
    for (const r of retrievedMemory.constructionRules.slice(0, 1)) {
      memoryHints.push(`[结构规则 ${r.code}] ${r.title}`);
    }
    for (const c of retrievedMemory.similarCases.slice(0, 1)) {
      memoryHints.push(`[参考案例] ${c.title}`);
    }
    for (const m of retrievedMemory.userMemories.slice(0, 1)) {
      memoryHints.push(`[用户偏好] ${m.content}`);
    }
  }

  return {
    planId: `plan_${Date.now()}`,
    userPrompt,
    summary: parsed.summary || 'CAD 修改方案',
    replyText: parsed.replyText || '已解析您的修改意图并生成参数化方案。',
    needsConfirmation: Boolean(parsed.needsConfirmation),
    isDestructiveOrMajor: Boolean(parsed.isDestructiveOrMajor),
    clarifyingQuestion: parsed.clarifyingQuestion,
    affectedParts: parsed.affectedParts ?? [],
    commands: (parsed.commands ?? []) as StructuredCadCommand[],
    proposedOptions: parsed.proposedOptions,
    retrievedKnowledgeIds: retrievedMemory?.retrievedKnowledgeIds ?? [],
    usedCaseIds: retrievedMemory?.usedCaseIds ?? [],
    memoryHints,
  };
}
