import {
  AI_AD_ROUTE_TEMPLATES,
  type AiAdCameraMove,
  type AiAdFraming,
  type AiAdRoute,
  type AiAdShotCrop,
  type AiAdShotPosition,
  type AiAdShotTransition,
  type AiAdStoryboardShot
} from './modauiAdPlanner';

/**
 * MODAUI 广告工作室 — 镜头的本地确定性修改（无 Prisma、无网络、无付费调用）。
 *
 * 规则（见 docs/engineering/modules/modaui-ai-advertising.md §24.6）：
 * - 预设与自由文本都由服务端映射成结构化 `patch`，前端只提交意图，不提交结构。
 * - 文字/景别/机位/时长/速度/裁切/转场属于本地参数，立即生效，不调用任何供应商。
 * - 需要重新生成画面的要求只写入 `directionNote` 并标记 `requiresGeneration`，
 *   因为本仓库还没有图像/视频生成 Adapter；不能把「已记录要求」说成「已生成」。
 */

export const AI_AD_SHOT_EDIT_PRESETS = [
  'premium',
  'product_clarity',
  'background',
  'natural_person',
  'faster',
  'redesign'
] as const;

export type AiAdShotEditPreset = (typeof AI_AD_SHOT_EDIT_PRESETS)[number] | 'custom';

export type AiAdShotEditPatch = Partial<
  Pick<
    AiAdStoryboardShot,
    | 'visual'
    | 'voiceover'
    | 'subtitle'
    | 'durationMs'
    | 'framing'
    | 'camera'
    | 'transition'
    | 'speed'
    | 'crop'
    | 'position'
    | 'directionNote'
  >
>;

export type AiAdShotEditPlan = {
  preset: AiAdShotEditPreset;
  label: string;
  /** local：本地参数立即可用；generation：需要真实画面生成才能生效。 */
  tier: 'local' | 'generation';
  /** 本轮所有预设都不调用付费供应商，响应必须如实返回 false。 */
  callsPaidProvider: false;
  requiresGeneration: boolean;
  patch: AiAdShotEditPatch;
  note: string;
};

export const AI_AD_SHOT_EDIT_LABELS: Record<AiAdShotEditPreset, string> = {
  premium: '更高级',
  product_clarity: '商品更清楚',
  background: '换一个背景',
  natural_person: '人物更自然',
  faster: '节奏更快',
  redesign: '重新设计',
  custom: '自定义要求'
};

const PRESET_KEYWORDS: ReadonlyArray<readonly [Exclude<AiAdShotEditPreset, 'custom'>, RegExp]> = [
  ['background', /背景|纯色|background/i],
  ['natural_person', /人物|模特|姿态|自然|model|person|natural/i],
  ['product_clarity', /清楚|清晰|细节|特写|detail|sharp|close/i],
  ['premium', /高级|质感|高端|premium|luxury|elegant/i],
  ['faster', /更快|节奏|紧凑|faster|pace|tight/i],
  ['redesign', /重做|重新设计|换一个|redesign|redo/i]
];

const LOCAL_NOTE = '已在本地调整镜头参数，没有调用任何付费模型，也没有生成新画面。';
const GENERATION_NOTE = '已记录画面要求。视频/图像生成能力尚未接通，本次没有生成新画面、没有扣费。';

export function isAiAdShotEditPreset(value: unknown): value is AiAdShotEditPreset {
  return value === 'custom'
    || (typeof value === 'string' && (AI_AD_SHOT_EDIT_PRESETS as readonly string[]).includes(value));
}

/** 自由文本只用于识别预设意图；识别不到就按自定义要求记录。 */
export function matchAiAdShotEditPreset(instruction: string): Exclude<AiAdShotEditPreset, 'custom'> | null {
  for (const [preset, pattern] of PRESET_KEYWORDS) {
    if (pattern.test(instruction)) return preset;
  }
  return null;
}

function normalizeInstruction(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const text = value
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!text) return null;
  if (text.length > 200) throw new Error('AI_AD_SHOT_EDIT_INVALID');
  return text;
}

const VISUAL_LIMIT = 300;

/** 只在末尾追加要求，保留模型给出的原始画面描述，避免覆盖事实。 */
function appendVisual(visual: string, addition: string): string {
  const base = visual.trim();
  if (base.includes(addition)) return base;
  const room = VISUAL_LIMIT - addition.length - 1;
  const head = room > 0 ? base.slice(0, room) : '';
  return head ? `${head}｜${addition}` : addition.slice(0, VISUAL_LIMIT);
}

function shortenDuration(durationMs: number, ratio: number): number {
  const next = Math.round((durationMs * ratio) / 100) * 100;
  return Math.min(30_000, Math.max(500, next));
}

export function planAiAdShotEdit(input: {
  shot: AiAdStoryboardShot;
  route: AiAdRoute;
  shotIndex: number;
  preset?: unknown;
  instruction?: unknown;
}): AiAdShotEditPlan {
  const instruction = normalizeInstruction(input.instruction);
  const rawPreset = input.preset;
  const hasPreset = rawPreset !== undefined && rawPreset !== null && rawPreset !== '';
  if (!hasPreset && !instruction) throw new Error('AI_AD_SHOT_EDIT_INVALID');
  if (hasPreset && !isAiAdShotEditPreset(rawPreset)) throw new Error('AI_AD_SHOT_EDIT_INVALID');
  if (rawPreset === 'custom' && !instruction) throw new Error('AI_AD_SHOT_EDIT_INVALID');

  const requested = hasPreset && isAiAdShotEditPreset(rawPreset) ? rawPreset : undefined;
  const preset: AiAdShotEditPreset = requested
    ?? (instruction ? matchAiAdShotEditPreset(instruction) ?? 'custom' : 'custom');

  const shot = input.shot;
  const directionNote = instruction;

  const build = (
    tier: AiAdShotEditPlan['tier'],
    patch: AiAdShotEditPatch,
    requiresGeneration: boolean
  ): AiAdShotEditPlan => ({
    preset,
    label: AI_AD_SHOT_EDIT_LABELS[preset],
    tier,
    callsPaidProvider: false,
    requiresGeneration,
    patch: directionNote ? { ...patch, directionNote } : patch,
    note: requiresGeneration ? GENERATION_NOTE : LOCAL_NOTE
  });

  switch (preset) {
    case 'premium':
      return build('local', {
        framing: 'close' satisfies AiAdFraming,
        camera: 'push_in' satisfies AiAdCameraMove,
        transition: 'fade' satisfies AiAdShotTransition,
        speed: 0.9,
        visual: appendVisual(shot.visual, '高级商业质感：柔和侧光、干净背景、材质与做工细节清晰')
      }, false);

    case 'product_clarity':
      return build('local', {
        framing: 'close' satisfies AiAdFraming,
        crop: 'tight' satisfies AiAdShotCrop,
        position: 'center' satisfies AiAdShotPosition,
        visual: appendVisual(shot.visual, '商品居中、轮廓清晰、颜色与材质细节可见')
      }, false);

    case 'background':
      return build('generation', {
        transition: 'fade' satisfies AiAdShotTransition,
        visual: appendVisual(shot.visual, '背景改为简洁纯色，商品本体、颜色与版型保持不变')
      }, true);

    case 'natural_person':
      return build('generation', {
        visual: appendVisual(shot.visual, '出镜人物姿态自然、动作松弛、表情真实，商品细节保持原样')
      }, true);

    case 'faster':
      return build('local', {
        durationMs: shortenDuration(shot.durationMs, 0.75),
        speed: 1.1
      }, false);

    case 'redesign': {
      const template = AI_AD_ROUTE_TEMPLATES[input.route].shots[input.shotIndex];
      return build('generation', {
        framing: (template?.framing ?? shot.framing) satisfies AiAdFraming,
        camera: (template?.camera ?? shot.camera) satisfies AiAdCameraMove,
        durationMs: template?.durationMs ?? shot.durationMs,
        transition: 'fade' satisfies AiAdShotTransition,
        directionNote: directionNote ?? '按当前商品与所选风格重新设计这一镜头'
      }, true);
    }

    case 'custom':
    default:
      return {
        preset: 'custom',
        label: AI_AD_SHOT_EDIT_LABELS.custom,
        tier: 'local',
        callsPaidProvider: false,
        requiresGeneration: false,
        patch: { directionNote: instruction! },
        note: '已把你的要求记录为这一镜头的修改说明，没有调用任何付费模型；画面本身未重新生成。'
      };
  }
}
