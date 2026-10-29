/**
 * ModaUI 工作台推理中枢（纯函数）。
 *
 * 职责：把用户一句话 + 已有素材，转换成可执行的创作计划：
 *   意图识别 → 能力序列 → 素材缺口 → 硬约束 → 需要用户决定的问题。
 *
 * 约束：这里不发起任何请求，也不假装存在引擎。凡是需要“以某张图作为输入继续生成”
 * 而服务端尚未接入的能力（商品图棚拍、图生视频），一律返回 blocked/未接入说明。
 */

import {
  getWorkbenchCapability,
  resolveWorkbenchAvailability,
  type WorkbenchAssetSlot,
  type WorkbenchBlockedReason,
  type WorkbenchCapabilityId,
  type WorkbenchEntitlementSnapshot,
  type WorkbenchExecution,
  type WorkbenchMissingInput
} from './modaWorkbenchCapabilities';

export type WorkbenchAssets = {
  person?: string;
  garment?: string;
};

export type WorkbenchPlanStep = {
  capability: WorkbenchCapabilityId;
  execution: WorkbenchExecution;
  status: 'ready' | 'blocked';
  reason?: WorkbenchBlockedReason;
};

export type WorkbenchCopy = { zh: string; it: string };

export type ModaWorkbenchPlan = {
  capability: WorkbenchCapabilityId;
  steps: WorkbenchPlanStep[];
  /** 第一步执行前还缺的输入（阻塞执行）。 */
  missing: WorkbenchMissingInput[];
  /** 后续步骤还缺的输入（提示用，不阻塞第一步）。 */
  laterMissing: WorkbenchMissingInput[];
  constraints: string[];
  color: string | null;
  /** 必须由用户决定的唯一问题；没有则为 null。 */
  question: WorkbenchCopy | null;
  /** 不阻塞执行、但必须如实告知的限制说明（例如组合任务后续步骤未接入）。 */
  notice: WorkbenchCopy | null;
  blocked: WorkbenchBlockedReason | null;
};

export type WorkbenchPlanInput = {
  text: string;
  capability: WorkbenchCapabilityId | null;
  assets: WorkbenchAssets;
  entitlements: WorkbenchEntitlementSnapshot | null;
};

const defaultRecolorConstraints = ['保留版型', '保留纹理与褶皱', '保留纽扣与缝线', '保留原有光影'];

const intentPatterns = {
  video: /视频|短片|走秀|动态展示|时装片|\bvideo\b|\bclip\b|\brunway\b|\bfilm\b/i,
  recolor: /换色|改色|改成[^，。；,.;]{0,10}色|换成[^，。；,.;]{0,10}色|颜色(?:改|换|变)|ricolor|recolou?r|cambia (?:il )?colore|change (?:the )?colou?r/i,
  tryon: /试穿|试衣|上身|穿(?:在|到)身上|try[ -]?on|prova virtuale|indossa/i,
  studio: /棚拍|主图|电商图|模特图|细节图|场景图|白底图|商品图|lookbook|e-?commerce|editorial|servizio fotografico|\bstudio\b/i,
  design: /设计|款式|草图|版型构思|\bdesign\b|\bsketch\b|\bconcept\b/i
} as const;

const colorPattern = /(?:改成|改为|换成|变成|调成|做成)\s*([\u4e00-\u9fa5A-Za-z][\u4e00-\u9fa5A-Za-z\s]{0,7}?色)/;
const englishColorPattern = /(?:to|into)\s+(camel|beige|black|white|navy|red|green|grey|gray|brown|pink|blue|cream|ivory|charcoal)\b/i;
const keepPattern = /(保留[^，。；,.;]{1,18}|不要(?:改|动)[^，。；,.;]{1,18}|只(?:改|换)[^，。；,.;]{1,18})/g;
const existingImagePattern = /这(?:件|张|款|个|条)|该(?:商品|图|款)|图中|这张图|上面这张|刚才|上一次|这个结果|this (?:garment|image|item)|questo capo|questa immagine/i;

export function detectWorkbenchCapability(text: string): WorkbenchCapabilityId {
  const value = typeof text === 'string' ? text : '';
  if (intentPatterns.video.test(value)) return 'video';
  if (intentPatterns.recolor.test(value)) return 'recolor';
  if (intentPatterns.tryon.test(value)) return 'tryon';
  if (intentPatterns.studio.test(value)) return 'studio';
  return 'design';
}

export function extractWorkbenchColor(text: string): string | null {
  const value = typeof text === 'string' ? text : '';
  const chinese = colorPattern.exec(value)?.[1]?.trim();
  if (chinese) return chinese.replace(/\s+/g, '');
  const english = englishColorPattern.exec(value)?.[1]?.toLowerCase();
  return english ?? null;
}

export function extractWorkbenchConstraints(text: string, capability: WorkbenchCapabilityId): string[] {
  const value = typeof text === 'string' ? text : '';
  const captured = (value.match(keepPattern) ?? []).map(item => item.trim()).filter(Boolean);
  const merged = capability === 'recolor' ? [...captured, ...defaultRecolorConstraints] : captured;
  return [...new Set(merged)].slice(0, 6);
}

function detectIntents(text: string): Record<'design' | 'tryon' | 'recolor' | 'studio' | 'video', boolean> {
  const value = typeof text === 'string' ? text : '';
  return {
    design: intentPatterns.design.test(value),
    tryon: intentPatterns.tryon.test(value),
    recolor: intentPatterns.recolor.test(value),
    studio: intentPatterns.studio.test(value),
    video: intentPatterns.video.test(value)
  };
}

/**
 * 计划步骤顺序：设计 → 试穿 → 换色 → 棚拍 → 视频。
 * 只有设计、试穿、换色之间可以真实串联（试穿接受图片输入、换色在本地完成）；
 * 换色之后接棚拍、以及任何视频步骤都需要图生图/图生视频引擎，当前未接入。
 */
function buildStepOrder(
  explicit: WorkbenchCapabilityId | null,
  matched: Record<'design' | 'tryon' | 'recolor' | 'studio' | 'video', boolean>
): WorkbenchCapabilityId[] {
  if (explicit) return [explicit];
  if (matched.video) return ['video'];
  const order: WorkbenchCapabilityId[] = [];
  if (matched.design) order.push('design');
  if (matched.tryon) order.push('tryon');
  if (matched.recolor) order.push('recolor');
  if (matched.studio) order.push('studio');
  if (!order.length) order.push('design');
  return [...new Set(order)].slice(0, 3);
}

function isStudioInputBlocked(text: string, assets: WorkbenchAssets): boolean {
  if (!assets.garment && !assets.person) return false;
  return existingImagePattern.test(text);
}

function missingFor(capability: WorkbenchCapabilityId, text: string, assets: WorkbenchAssets): WorkbenchMissingInput[] {
  const requirements = getWorkbenchCapability(capability).requires;
  const missing: WorkbenchMissingInput[] = [];
  for (const requirement of requirements) {
    if (requirement === 'brief') {
      if (!text.trim()) missing.push('brief');
    } else if (requirement === 'person') {
      if (!assets.person) missing.push('person');
    } else if (requirement === 'garment') {
      if (!assets.garment) missing.push('garment');
    }
  }
  return missing;
}

function assetSlotLabel(slot: WorkbenchMissingInput): WorkbenchCopy {
  if (slot === 'person') return { zh: '人物照片', it: 'foto persona' };
  if (slot === 'garment') return { zh: '服装图片', it: 'immagine del capo' };
  return { zh: '需求描述', it: 'descrizione' };
}

export function describeMissingWorkbenchInputs(missing: WorkbenchMissingInput[]): WorkbenchCopy | null {
  if (!missing.length) return null;
  const labels = missing.map(assetSlotLabel);
  return {
    zh: `还需要：${labels.map(item => item.zh).join('、')}。`,
    it: `Serve ancora: ${labels.map(item => item.it).join(', ')}.`
  };
}


export function planModaWorkbenchTask(input: WorkbenchPlanInput): ModaWorkbenchPlan {
  const text = typeof input.text === 'string' ? input.text : '';
  const assets: WorkbenchAssets = {
    person: input.assets?.person || undefined,
    garment: input.assets?.garment || undefined
  };
  const matched = detectIntents(text);
  const order = buildStepOrder(input.capability, matched);
  const color = extractWorkbenchColor(text);

  const steps: WorkbenchPlanStep[] = order.map(capabilityId => {
    const capability = getWorkbenchCapability(capabilityId);
    if (capability.execution === 'unavailable') {
      return { capability: capabilityId, execution: 'unavailable', status: 'blocked', reason: 'not_integrated' };
    }
    if (capabilityId === 'studio' && isStudioInputBlocked(text, assets)) {
      return { capability: capabilityId, execution: capability.execution, status: 'blocked', reason: 'not_integrated' };
    }
    const availability = resolveWorkbenchAvailability(capabilityId, input.entitlements);
    if (availability.available) {
      return { capability: capabilityId, execution: capability.execution, status: 'ready' };
    }
    return {
      capability: capabilityId,
      execution: capability.execution,
      status: 'blocked',
      reason: availability.reason ?? 'engine_unavailable'
    };
  });

  const first = steps[0];
  const missing = missingFor(first.capability, text, assets);
  const laterMissing: WorkbenchMissingInput[] = [];
  for (const step of steps.slice(1)) {
    for (const item of missingFor(step.capability, text, assets)) {
      if (!laterMissing.includes(item)) laterMissing.push(item);
    }
  }
  const constraints = extractWorkbenchConstraints(text, first.capability);
  const feedback = buildPlanFeedback(first, steps, text, assets);

  return {
    capability: first.capability,
    steps,
    missing,
    laterMissing,
    constraints,
    color,
    question: feedback.question,
    notice: feedback.notice,
    blocked: first.status === 'blocked' ? first.reason ?? 'not_integrated' : null
  };
}

function buildPlanFeedback(
  first: WorkbenchPlanStep,
  steps: WorkbenchPlanStep[],
  text: string,
  assets: WorkbenchAssets
): { question: WorkbenchCopy | null; notice: WorkbenchCopy | null } {
  if (first.capability === 'video') {
    return {
      question: null,
      notice: {
        zh: '当前未接入视频引擎，暂不能创建视频任务。',
        it: 'Il motore video non è ancora collegato: nessuna attività video può essere creata.'
      }
    };
  }

  if (first.capability === 'studio' && isStudioInputBlocked(text, assets)) {
    return {
      question: {
        zh: '目前只能按文字描述生成棚拍图；以商品图为输入的棚拍引擎尚未接入。请改用文字描述要展示的款式与场景。',
        it: 'Oggi possiamo generare scatti solo da una descrizione testuale: il motore che parte da una foto prodotto non è ancora collegato.'
      },
      notice: null
    };
  }

  if (first.reason === 'plan_required') {
    return {
      question: null,
      notice: {
        zh: '商业棚拍需要专业套餐，当前套餐不可用。',
        it: 'Il servizio commerciale richiede un piano professionale.'
      }
    };
  }

  if (first.reason === 'engine_unavailable') {
    return {
      question: null,
      notice: first.capability === 'tryon'
        ? { zh: '虚拟试穿需要已配置的 fal 图像引擎，当前不可用。', it: 'La prova virtuale richiede il motore fal configurato.' }
        : { zh: '图片引擎当前不可用，暂不能生成。', it: 'Il motore immagini non è disponibile.' }
    };
  }

  const laterBlocked = steps.slice(1).find(step => step.status === 'blocked');
  if (laterBlocked?.capability === 'video') {
    return {
      question: null,
      notice: {
        zh: '后续视频步骤需要视频引擎，当前未接入。',
        it: 'Il passaggio video richiede un motore video non ancora collegato.'
      }
    };
  }
  if (laterBlocked?.reason === 'not_integrated') {
    return {
      question: null,
      notice: {
        zh: '当前步骤可以完成；把它继续做成棚拍图需要图生图引擎，尚未接入。',
        it: 'Questo passaggio è disponibile; lo scatto commerciale dal risultato richiede un motore image-to-image non ancora collegato.'
      }
    };
  }
  if (laterBlocked?.reason === 'plan_required') {
    return {
      question: null,
      notice: {
        zh: '后续棚拍步骤需要专业套餐。',
        it: 'Il passaggio commerciale richiede un piano professionale.'
      }
    };
  }

  return { question: null, notice: null };
}

/** 试穿默认提示词：服务端要求 prompt 非空，且必须保留人物身份与姿态。 */
export function buildDefaultTryOnPrompt(assetsNote: string): string {
  const suffix = assetsNote.trim() ? ` 服装说明：${assetsNote.trim()}。` : '';
  return `请把服装图片中的服装自然穿到人物照片上，保持人物身份、脸部、姿势与背景不变，呈现真实合身效果与布料质感。${suffix}`.trim();
}

/** 换色默认提示词快照（写入结果记录，便于回看当时的意图）。 */
export function buildRecolorPrompt(color: string | null): string {
  return color
    ? `改成${color}，保留版型、纹理、褶皱、纽扣与光影。`
    : '换成目标颜色，保留版型、纹理、褶皱、纽扣与光影。';
}

export function workbenchAssetSlotFor(capability: WorkbenchCapabilityId): WorkbenchAssetSlot[] {
  return getWorkbenchCapability(capability).requires.filter(
    (item): item is WorkbenchAssetSlot => item === 'person' || item === 'garment'
  );
}

export function describeWorkbenchStep(step: WorkbenchPlanStep): WorkbenchCopy {
  const capability = getWorkbenchCapability(step.capability);
  if (step.status === 'ready') return { zh: capability.labelZh, it: capability.labelIt };
  if (step.reason === 'not_integrated') {
    return { zh: `${capability.labelZh}（未接入）`, it: `${capability.labelIt} (non attivo)` };
  }
  if (step.reason === 'plan_required') {
    return { zh: `${capability.labelZh}（需升级套餐）`, it: `${capability.labelIt} (piano richiesto)` };
  }
  return { zh: `${capability.labelZh}（引擎不可用）`, it: `${capability.labelIt} (motore non disponibile)` };
}

