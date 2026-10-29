/**
 * ModaUI 数字生命 V8：BrainBehaviorController（唯一的自主运动与行为权威）。
 *
 * 见 docs/engineering/modules/modaui-core.md 第 18 节。
 *
 * 三套系统协作，但运动决策只有这一处：
 * 1. 生命系统（本文件）：自主漂浮、游移、换位、靠近/后退、收缩/舒展、停顿与惯性。
 * 2. 认知表现系统：`neuralLifeform.ts` / GLSL `lifeformPoint()` 负责内部细胞形变；
 *    本文件只输出四个内部强度（`dynamics`），由渲染器写进 `uCognition`。
 * 3. 交流系统：`modaCoreLife.ts` 把真实聊天事件变成连续数值作为本文件输入，
 *    本文件不自己编造"正在思考"的状态。
 *
 * 硬约束：
 * - 通道独立：`depth`（前后）与 `scale`（自身尺寸）不是同一个量，禁止互相模拟。
 * - 状态切换继承位姿与速度，任何行为切换都不重置到原点、不瞬间回中。
 * - 所有输出有界；构图超限时只收缩尺寸、不回收位移（大脑可以真的走到边缘并略微变小）。
 * - 只用 `dt` 推进，不读系统时钟；同一输入序列逐帧可复现，帧率变化不改变运动语言。
 */

/** 与小程序 `utils/moda-core.js` 的行为随机种子同值，保证两端行为序列一致。 */
export const BRAIN_SEED = 20261027;

/**
 * 运动通道边界（世界单位；相机在 z = 0，主体在 z = -3.55）。
 * 小程序 `BRAIN_LIMITS` 必须逐项同值。
 */
export const BRAIN_LIMITS = {
  offsetX: 0.28,
  offsetY: 0.2,
  depthNear: 0.2,
  depthFar: -0.2,
  scaleMin: 0.86,
  scaleMax: 1.1,
  tiltX: 0.13,
  tiltY: 0.18,
  tiltZ: 0.055
} as const;

/**
 * 构图预算（世界单位）。
 * - `visibleHalfHeight = tan(16°) × 3.55 ≈ 1.018`：世界 1.018 对应半屏；
 * - `projectionScale`：投影留白，决定中性构图占半屏的比例；
 * - `baseRadius`：中性姿态下结构外接半径（半径 1 的球体 + 呼吸峰值 ≈ 1.05）；
 * - `activityGain`：内部激活会让结构再外扩约 7.5%，按活动度补偿；
 * - `maxExtent`：任何通道组合的硬上限；
 * - `bleedPx`：点精灵像素半径 + 抗锯齿需要让出的 CSS 像素；
 * - `travelRadius`：宏观换位目标点半径（占 offsetX/offsetY 的比例上限）。
 */
export const BRAIN_BUDGET = {
  viewDistance: 3.55,
  visibleHalfHeight: 1.018,
  projectionScale: 0.76,
  baseRadius: 1.05,
  activityGain: 0.075,
  maxExtent: 0.94,
  bleedPx: 5,
  travelRadius: 0.92
} as const;

export type BrainBehaviorId =
  | 'drift'
  | 'tilt'
  | 'settle'
  | 'approach'
  | 'retreat'
  | 'contract'
  | 'expand'
  | 'focus'
  | 'radiate'
  | 'recoil'
  | 'travel';

export type BrainBehaviorKind = 'micro' | 'mid' | 'macro';

/** 全部行为（顺序即文档顺序，测试与验收按此遍历）。 */
export const BRAIN_BEHAVIORS: BrainBehaviorId[] = [
  'drift', 'tilt', 'settle', 'approach', 'retreat',
  'contract', 'expand', 'focus', 'radiate', 'recoil', 'travel'
];

export type BrainPresentationMode = 'stage' | 'inline';

export type BrainQuality = 'high' | 'low';

export type BrainBehaviorInput = {
  /** 六个状态权重（0–1，由渲染器的 uState 权重直接传入）。 */
  idle: number;
  listening: number;
  thinking: number;
  responding: number;
  success: number;
  error: number;
  /** 真实生命能量 0–1（输入焦点、流式文本、语音）。 */
  energy: number;
  /** 消息已提交 0–1：折算成受边界约束的前移。 */
  forward: number;
  /** 真实语音/文本片段脉冲 0–1。 */
  pulse: number;
  /** 点击冲击 0–1（一次性速度冲量）。 */
  burst: number;
  pointerX: number;
  pointerY: number;
  /** 呈现模式：自由舞台 / 回答内嵌头像。运动语义不变，宏观换位受限。 */
  presentation: BrainPresentationMode;
  /** 系统减弱动态效果。 */
  reduced: boolean;
};

export type BrainDynamics = {
  /** 神经激活强度 0–1（内部闪烁、脉冲亮度、点尺寸抖动）。 */
  agitation: number;
  /** 内部聚合 0–1（细胞向核心收拢）。 */
  cohesion: number;
  /** 信息外传 0–1（脉冲沿纤维向外传播的速度与浓度）。 */
  outflow: number;
  /** 自主/真实脉冲 0–1（一次轻柔鼓起，指数衰减）。 */
  pulse: number;
};

export type BrainBehaviorFrame = {
  /** 世界坐标横向/纵向偏移。 */
  x: number;
  y: number;
  /** 沿视线前后位移：正数靠近观察者。 */
  depth: number;
  /** 主体自身尺寸倍率（已按构图预算收缩）。 */
  scale: number;
  tiltX: number;
  tiltY: number;
  tiltZ: number;
  /** 运动能量 0–1（不影响颜色，只影响振幅与节奏）。 */
  energy: number;
  /** 主体速度（世界单位/秒），用于验收"是否真的在动"。 */
  speed: number;
  /** 当前结构外接占半屏的比例（软限幅后的真实值）。 */
  extent: number;
  behavior: BrainBehaviorId;
  kind: BrainBehaviorKind;
  /** 当前行为进度 0–1。 */
  progress: number;
  /** 是否处于两个行为之间的停顿。 */
  dwelling: boolean;
  dynamics: BrainDynamics;
};

export type BrainBehaviorHandle = {
  update: (dt: number, input: BrainBehaviorInput) => BrainBehaviorFrame;
  getFrame: () => BrainBehaviorFrame;
  /** 画布 CSS 边长：像素级外接（点精灵半径）必须按真实尺寸让出边距。 */
  setViewport: (sizeCss: number) => void;
  /** 设备性能降级：降低行为频率与幅度，并禁用宏观换位。 */
  setQuality: (quality: BrainQuality) => void;
};

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const clamp01 = (value: number) => clamp(Number.isFinite(value) ? value : 0, 0, 1);

const smoothstep = (edge0: number, edge1: number, value: number) => {
  const t = clamp01((value - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
};

/** 固定种子 PRNG：同一状态序列得到同一行为序列，便于复现与测试。 */
const createRandom = (seed: number) => {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

type Spring = { value: number; velocity: number; omega: number; maxSpeed: number };

const spring = (omega: number, maxSpeed: number, value = 0): Spring => ({ value, velocity: 0, omega, maxSpeed });

/**
 * 临界阻尼弹簧（zeta = 0.92）：先加速、后减速，有惯性但不过冲振荡。
 * 内部按 1/120 秒分步积分，保证 30fps 与 120fps 的运动语言一致。
 */
const stepSpring = (channel: Spring, target: number, dt: number) => {
  let remaining = Math.min(0.05, Math.max(0, dt));
  while (remaining > 1e-6) {
    const h = Math.min(1 / 120, remaining);
    remaining -= h;
    const accel = (target - channel.value) * channel.omega * channel.omega
      - 2 * 0.92 * channel.omega * channel.velocity;
    channel.velocity = clamp(channel.velocity + accel * h, -channel.maxSpeed, channel.maxSpeed);
    channel.value += channel.velocity * h;
  }
};

/**
 * 位置软限幅：用 tanh 把目标渐近压到边界内，而不是让弹簧目标越过边界后被硬裁剪。
 * 这样靠近边缘时运动只是变慢、变短，不会出现"贴着画面边缘卡住"的观感。
 */
const softLimit = (value: number, limit: number) => (limit > 0 ? limit * Math.tanh(value / limit) : 0);

/** 行为包络：前 28% 平滑升起、后 40% 平滑回落、中段保持。 */
const behaviorEnvelope = (progress: number) => {
  if (progress <= 0 || progress >= 1) return 0;
  if (progress < 0.28) return smoothstep(0, 1, progress / 0.28);
  if (progress > 0.6) return smoothstep(0, 1, (1 - progress) / 0.4);
  return 1;
};



/**
 * 状态 → 行为权重（idle / listening / thinking / responding / success / error）。
 * 值是选择器的相对分数，不是概率；同状态下的随机抖动由 PRNG 提供。
 */
const BEHAVIOR_WEIGHTS: Record<BrainBehaviorId, readonly [number, number, number, number, number, number]> = {
  drift: [2.4, 1.2, 1.0, 1.4, 1.0, 0.6],
  tilt: [2.0, 1.5, 1.6, 2.2, 0.8, 0.6],
  settle: [1.3, 0.6, 0.4, 0.6, 2.2, 1.8],
  approach: [0.9, 1.4, 2.6, 1.2, 0.4, 0.2],
  retreat: [0.9, 0.4, 0.8, 1.8, 0.6, 2.4],
  contract: [0.7, 1.6, 2.4, 0.6, 0.3, 1.4],
  expand: [0.8, 0.4, 0.6, 2.6, 1.8, 0.2],
  focus: [0.8, 2.4, 2.8, 0.8, 0.2, 0.4],
  radiate: [0.5, 0.2, 0.4, 3.2, 1.4, 0.2],
  recoil: [0.05, 0.05, 0.08, 0.1, 0.2, 3.2],
  travel: [2.5, 0.9, 0.8, 1.3, 0.5, 0.2]
};

const BEHAVIOR_KIND: Record<BrainBehaviorId, BrainBehaviorKind> = {
  drift: 'micro',
  tilt: 'micro',
  settle: 'micro',
  approach: 'mid',
  retreat: 'mid',
  contract: 'mid',
  expand: 'mid',
  focus: 'mid',
  radiate: 'mid',
  recoil: 'mid',
  travel: 'macro'
};

/** 同一行为的冷却时间（秒）：避免"连续三次都是 approach"这种机械感。 */
const BEHAVIOR_COOLDOWN: Record<BrainBehaviorId, number> = {
  drift: 0,
  tilt: 0,
  settle: 0,
  approach: 3.2,
  retreat: 3.2,
  contract: 3.2,
  expand: 3.2,
  focus: 3.2,
  radiate: 3.2,
  recoil: 4,
  travel: 7.5
};

/** 行为持续时长区间（秒）。 */
const BEHAVIOR_DURATION: Record<BrainBehaviorId, readonly [number, number]> = {
  drift: [1.6, 3.0],
  tilt: [1.5, 2.6],
  settle: [1.2, 2.2],
  approach: [1.5, 2.4],
  retreat: [1.6, 2.6],
  contract: [1.3, 2.2],
  expand: [1.4, 2.4],
  focus: [1.6, 2.8],
  radiate: [1.4, 2.6],
  recoil: [0.9, 1.4],
  travel: [2.6, 4.2]
};

/** 行为结束后的停顿区间（秒）：停顿是生命感的一部分，不允许连轴转。 */
const DWELL_BY_KIND: Record<BrainBehaviorKind, readonly [number, number]> = {
  micro: [0.05, 0.35],
  mid: [0.25, 0.8],
  macro: [0.6, 1.8]
};

type ActiveBehavior = {
  id: BrainBehaviorId;
  kind: BrainBehaviorKind;
  duration: number;
  elapsed: number;
  strength: number;
  /** 目标偏移（世界单位），由行为在开始时解析；切换行为不重置当前位姿。 */
  targetX: number;
  targetY: number;
  targetDepth: number;
  targetScale: number;
  targetTiltX: number;
  targetTiltY: number;
  targetTiltZ: number;
};

/**
 * 创建 BrainBehaviorController。
 * 所有时间推进都来自 `update(dt)`，不读系统时钟，因此相同输入序列可以完全复现。
 */
export function createModaBrainBehavior(): BrainBehaviorHandle {
  const random = createRandom(BRAIN_SEED);

  // 漂移相位一次性固定：几种互不整除的角频率叠加，因此轨迹长时间不重复。
  const phases = new Float64Array(10);
  for (let index = 0; index < phases.length; index += 1) phases[index] = random() * Math.PI * 2;

  const x = spring(2.2, 0.34);
  const y = spring(2.2, 0.34);
  const depth = spring(1.7, 0.55);
  // 尺寸通道从 1 开始：从 0 起跳会让挂载后的第一帧整体缩小 10%。
  const scale = spring(1.6, 0.55, 1);
  const tiltX = spring(1.4, 0.45);
  const tiltY = spring(1.4, 0.45);
  const tiltZ = spring(1.15, 0.3);

  let time = 0;
  let energy = 0.6;
  let lastBurst = 0;
  /** 上一次宏观换位的横向目标，用于方向交替（不会连续两次往同一侧跑）。 */
  let lastTravelX = 0;
  /**
   * 当前位置基准（世界单位）：宏观换位会把基准搬到新锚点并在这里停留，
   * 然后以很长的时间常数缓慢向中心松弛。位移因此"留下来"，而不是像一次性事件那样弹回中心。
   */
  let homeX = 0;
  let homeY = 0;
  let quality: BrainQuality = 'high';
  let presentation: BrainPresentationMode = 'stage';

  let active: ActiveBehavior | null = null;
  let dwelling = false;
  let dwellLeft = 0;
  let nextBehaviorIn = 0.8;
  /** 最近行为序列：用于重复抑制，也用于验收"多次连续对话不重复同一套动作"。 */
  const recent: BrainBehaviorId[] = [];
  const cooldowns: Record<BrainBehaviorId, number> = {
    drift: 0, tilt: 0, settle: 0, approach: 0, retreat: 0, contract: 0,
    expand: 0, focus: 0, radiate: 0, recoil: 0, travel: 0
  };

  const dynamics: BrainDynamics = { agitation: 0.12, cohesion: 0, outflow: 0.05, pulse: 0 };

  // 构图上限：默认按大画布；小画布由 setViewport() 收紧以让出像素级外扩。
  let extentCap: number = BRAIN_BUDGET.maxExtent;
  const setViewport = (sizeCss: number) => {
    const half = Math.max(4, (Number.isFinite(sizeCss) ? sizeCss : 0) / 2);
    extentCap = Math.min(BRAIN_BUDGET.maxExtent, (half - BRAIN_BUDGET.bleedPx) / half);
  };

  let frame: BrainBehaviorFrame = {
    x: 0,
    y: 0,
    depth: 0,
    scale: 1,
    tiltX: 0,
    tiltY: 0,
    tiltZ: 0,
    energy,
    speed: 0,
    extent: BRAIN_BUDGET.baseRadius / BRAIN_BUDGET.visibleHalfHeight * BRAIN_BUDGET.projectionScale,
    behavior: 'drift',
    kind: 'micro',
    progress: 0,
    dwelling: false,
    dynamics: { ...dynamics }
  };

  /** 状态向量与行为权重的点积。 */
  const stateScore = (id: BrainBehaviorId, input: BrainBehaviorInput) => {
    const weights = BEHAVIOR_WEIGHTS[id];
    return weights[0] * clamp01(input.idle)
      + weights[1] * clamp01(input.listening)
      + weights[2] * clamp01(input.thinking)
      + weights[3] * clamp01(input.responding)
      + weights[4] * clamp01(input.success)
      + weights[5] * clamp01(input.error);
  };

  /**
   * 目标导向的行为选择：
   * 1. 冷却中的行为不参与；内嵌头像、低性能档、减弱动效不选宏观换位；
   * 2. 最近两个行为默认排除（有足够替代时才排除），避免连续重复；
   * 3. 分数 = 状态权重 × 能量契合度 × 随机抖动；
   * 4. 按权重抽签，而不是永远选最高分（否则会形成固定套路）。
   */
  const selectBehavior = (input: BrainBehaviorInput): BrainBehaviorId => {
    const blocked = new Set<BrainBehaviorId>();
    for (const id of BRAIN_BEHAVIORS) {
      if (cooldowns[id] > 0) blocked.add(id);
      if (id === 'travel' && (presentation === 'inline' || quality === 'low' || input.reduced)) blocked.add(id);
    }
    const excludeRecent = new Set(recent.slice(-2));
    const scoreOf = (id: BrainBehaviorId) => {
      const base = stateScore(id, input);
      if (base <= 0.001) return 0;
      const repeat = recent.length && recent[recent.length - 1] === id ? 0.12 : 1;
      // 能量低时偏好小动作，能量高时才愿意做大幅移动。
      const energyFit = BEHAVIOR_KIND[id] === 'macro'
        ? 0.45 + 0.9 * clamp01(input.energy)
        : BEHAVIOR_KIND[id] === 'mid' ? 0.7 + 0.5 * clamp01(input.energy) : 1;
      return base * repeat * energyFit * (0.65 + random() * 0.7);
    };

    const candidates: Array<{ id: BrainBehaviorId; score: number }> = [];
    for (const id of BRAIN_BEHAVIORS) {
      if (blocked.has(id)) continue;
      const value = scoreOf(id);
      if (value > 0) candidates.push({ id, score: value });
    }
    const filtered = candidates.filter(entry => !excludeRecent.has(entry.id));
    const pool = filtered.length >= 2 ? filtered : candidates;
    const total = pool.reduce((sum, entry) => sum + entry.score, 0);
    if (total <= 0) return 'drift';
    let pick = random() * total;
    for (const entry of pool) {
      pick -= entry.score;
      if (pick <= 0) return entry.id;
    }
    return pool[pool.length - 1].id;
  };

  /** 在允许区域内取一个新锚点：与当前位置明显不同，避免"原地换位"。 */
  const pickTravelTarget = (currentX: number, currentY: number, input: BrainBehaviorInput) => {
    const currentAngle = Math.atan2(currentY / BRAIN_LIMITS.offsetY, currentX / BRAIN_LIMITS.offsetX);
    const direction = random() < 0.5 ? -1 : 1;
    // 转 69°–160°：既不是原路返回，也不会每次落在同一侧。
    const angle = currentAngle + direction * (1.2 + random() * 1.6);
    // 内嵌小头像不做大幅度换位，否则 32px 里看起来像闪烁。
    const reach = (presentation === 'inline' ? 0.45 : 0.62 + random() * 0.24) * BRAIN_BUDGET.travelRadius;
    const depthSign = random() < 0.5 ? -1 : 1;
    const amplitude = input.reduced ? 0.4 : 1;
    let targetX = Math.cos(angle) * reach * BRAIN_LIMITS.offsetX * amplitude;
    // 方向记忆：上一次往右，就优先往左，保证宏观运动真的横跨舞台而不是在一侧抖动。
    if (lastTravelX !== 0 && Math.sign(targetX) === Math.sign(lastTravelX) && Math.abs(lastTravelX) > 0.04) {
      targetX = -targetX;
    }
    lastTravelX = targetX;
    // 纵向独立取点：换位要同时改变上下位置，不能只沿一条水平线前后挪动。
    const verticalSign = random() < 0.5 ? -1 : 1;
    return {
      targetX,
      targetY: verticalSign * (0.35 + random() * 0.5) * BRAIN_LIMITS.offsetY * amplitude,
      targetDepth: depthSign * (0.05 + random() * 0.09) * (input.reduced ? 0.3 : 1),
      targetScale: (random() < 0.5 ? -1 : 1) * (0.01 + random() * 0.015)
    };
  };


  /** 解析一个行为的空间目标并启动它；不触碰当前位姿。 */
  const startBehavior = (input: BrainBehaviorInput) => {
    const id = selectBehavior(input);
    const kind = BEHAVIOR_KIND[id];
    const [minDuration, maxDuration] = BEHAVIOR_DURATION[id];
    const speedFactor = input.reduced ? 1.5 : 1;
    const qualityFactor = quality === 'low' ? 1.25 : 1;
    const amplitude = (0.72 + random() * 0.28) * (input.reduced ? 0.3 : 1) * (quality === 'low' ? 0.75 : 1);

    const behavior: ActiveBehavior = {
      id,
      kind,
      duration: (minDuration + random() * (maxDuration - minDuration)) * speedFactor * qualityFactor,
      elapsed: 0,
      // 宏观换位是"决定要去哪里"的动作，不能被随机强度打折，否则永远走不到舞台另一侧。
      strength: kind === 'macro' ? 1 : amplitude,
      targetX: 0,
      targetY: 0,
      targetDepth: 0,
      targetScale: 0,
      targetTiltX: 0,
      targetTiltY: 0,
      targetTiltZ: 0
    };

    const sign = random() < 0.5 ? -1 : 1;
    switch (id) {
      case 'travel': {
        const target = pickTravelTarget(x.value, y.value, input);
        // 换位 = 搬迁位置基准：目标不是一次性偏移，而是一个新的停留点。
        homeX = target.targetX;
        homeY = target.targetY;
        behavior.targetDepth = target.targetDepth;
        behavior.targetScale = target.targetScale;
        break;
      }
      case 'approach':
        behavior.targetDepth = BRAIN_LIMITS.depthNear * 0.85;
        behavior.targetScale = 0.015;
        behavior.targetY = BRAIN_LIMITS.offsetY * 0.06;
        break;
      case 'retreat':
        behavior.targetDepth = BRAIN_LIMITS.depthFar * 0.85;
        behavior.targetScale = -0.02;
        break;
      case 'contract':
        behavior.targetScale = -0.07;
        behavior.targetY = BRAIN_LIMITS.offsetY * 0.08;
        break;
      case 'expand':
        behavior.targetScale = 0.07;
        behavior.targetY = -BRAIN_LIMITS.offsetY * 0.05;
        break;
      case 'focus':
        behavior.targetDepth = 0.06;
        behavior.targetTiltY = BRAIN_LIMITS.tiltY * 0.35 * sign;
        behavior.targetTiltX = -BRAIN_LIMITS.tiltX * 0.3 * sign;
        break;
      case 'radiate':
        behavior.targetScale = 0.05;
        behavior.targetTiltY = BRAIN_LIMITS.tiltY * 0.55 * sign;
        break;
      case 'recoil':
        behavior.targetDepth = BRAIN_LIMITS.depthFar * 0.5;
        behavior.targetScale = -0.08;
        behavior.targetTiltX = BRAIN_LIMITS.tiltX * 0.45 * sign;
        behavior.targetY = -BRAIN_LIMITS.offsetY * 0.12;
        break;
      case 'tilt':
        behavior.targetTiltY = BRAIN_LIMITS.tiltY * 0.8 * sign;
        behavior.targetTiltX = -BRAIN_LIMITS.tiltX * 0.45 * sign;
        behavior.targetTiltZ = BRAIN_LIMITS.tiltZ * 0.6 * (random() < 0.5 ? -1 : 1);
        break;
      case 'settle':
        behavior.targetScale = -0.025;
        behavior.targetDepth = -0.03;
        break;
      case 'drift':
      default:
        behavior.targetX = BRAIN_LIMITS.offsetX * (0.25 + random() * 0.3) * sign;
        behavior.targetY = BRAIN_LIMITS.offsetY * (0.15 + random() * 0.3) * (random() < 0.5 ? -1 : 1);
        break;
    }

    active = behavior;
    recent.push(id);
    if (recent.length > 6) recent.shift();
    cooldowns[id] = BEHAVIOR_COOLDOWN[id];
    // 每次行为开始都给内部一个轻柔脉冲：视觉上是"动了一下/想了一下"。
    dynamics.pulse = Math.max(dynamics.pulse, kind === 'macro' ? 0.7 : 0.42);
  };

  const finishBehavior = () => {
    if (!active) return;
    const [minDwell, maxDwell] = DWELL_BY_KIND[active.kind];
    dwelling = true;
    dwellLeft = minDwell + random() * (maxDwell - minDwell);
    active = null;
    nextBehaviorIn = 0;
  };

  const update = (dt: number, input: BrainBehaviorInput): BrainBehaviorFrame => {
    const step = clamp(Number.isFinite(dt) ? dt : 0, 0, 0.05);
    const motionScale = input.reduced ? 0.3 : 1;
    presentation = input.presentation === 'inline' ? 'inline' : 'stage';
    time += step * (input.reduced ? 0.5 : 1);

    // 运动能量只看真实活动与当前动作强度，不跟着状态名词涨落。
    const stateActivity = clamp01(
      input.thinking * 0.9 + input.responding * 1.1 + input.error * 0.8 + input.listening * 0.5
    );
    const energyTarget = clamp01(0.3 + 0.42 * clamp01(input.energy) + 0.16 * stateActivity + (active ? 0.12 : 0));
    energy += (energyTarget - energy) * (1 - Math.exp(-2.4 * step));

    for (const id of BRAIN_BEHAVIORS) {
      if (cooldowns[id] > 0) cooldowns[id] = Math.max(0, cooldowns[id] - step);
    }

    // 行为推进：一次只跑一个；结束后进入停顿，再按新状态重新选择。
    if (active) {
      active.elapsed += step;
      if (active.elapsed >= active.duration) finishBehavior();
    } else if (dwelling) {
      dwellLeft -= step;
      if (dwellLeft <= 0) {
        dwelling = false;
        nextBehaviorIn = 0.15 + random() * 0.5;
      }
    } else {
      nextBehaviorIn -= step;
      if (nextBehaviorIn <= 0) startBehavior(input);
    }

    const envelope = active ? behaviorEnvelope(active.elapsed / active.duration) : 0;
    const amount = envelope * (active ? active.strength : 0);


    // 低频漂移：几个不可通约的频率叠加，长时间不形成固定轨道。
    // 换位过程中把漂移压小，避免自由漂移抵消目标位移。
    const travelMask = active && active.id === 'travel' ? 0.35 : 1;
    const wanderAmp = motionScale * (0.55 + 0.45 * energy) * (quality === 'low' ? 0.7 : 1) * travelMask;
    const wanderX = wanderAmp * BRAIN_LIMITS.offsetX
      * (0.55 * Math.sin(time * 0.29 + phases[0]) + 0.45 * Math.sin(time * 0.107 + phases[1]));
    const wanderY = wanderAmp * BRAIN_LIMITS.offsetY
      * (0.55 * Math.sin(time * 0.213 + phases[2]) + 0.45 * Math.sin(time * 0.083 + phases[3]));
    const wanderTiltX = wanderAmp * BRAIN_LIMITS.tiltX
      * (0.5 * Math.sin(time * 0.39 + phases[4]) + 0.5 * Math.sin(time * 0.22 + phases[5]));
    const wanderTiltY = wanderAmp * BRAIN_LIMITS.tiltY
      * (0.5 * Math.sin(time * 0.35 + phases[6]) + 0.5 * Math.sin(time * 0.205 + phases[7]));
    const wanderTiltZ = wanderAmp * BRAIN_LIMITS.tiltZ * Math.sin(time * 0.13 + phases[8]);
    const wanderScale = wanderAmp * 0.014 * Math.sin(time * 0.071 + phases[9]);

    // 真实状态偏置：提交前移受边界约束，失败轻微后退，回答轻微靠近。
    const depthBias = motionScale * (
      clamp01(input.forward) * 0.12 + clamp01(input.responding) * 0.02 - clamp01(input.error) * 0.03
    );
    // 尺寸偏置：思考向内聚合、回答向外舒展——状态的确定性签名，不依赖随机行为恰好抽到。
    const scaleBias = motionScale * (clamp01(input.responding) * 0.03 - clamp01(input.thinking) * 0.025);

    // 指针视线跟随：克制的倾斜与横向偏移，不做磁吸式跟随。
    const pointer = input.reduced ? 0.3 : 1;
    const pointerX = clamp(input.pointerX, -1.25, 1.25);
    const pointerY = clamp(input.pointerY, -1.25, 1.25);

    // 点击冲击：给速度一个冲量，位移仍由弹簧平滑产生，不做位置跳变。
    const burst = clamp01(input.burst);
    if (burst > lastBurst + 0.05) {
      depth.velocity = clamp(depth.velocity + 0.35 * burst, -depth.maxSpeed, depth.maxSpeed);
      scale.velocity = clamp(scale.velocity + 0.22 * burst, -scale.maxSpeed, scale.maxSpeed);
      y.velocity = clamp(y.velocity + 0.05 * burst, -y.maxSpeed, y.maxSpeed);
    }
    lastBurst = burst;

    const previousX = x.value;
    const previousY = y.value;

    // 位置基准缓慢回中（时间常数 20s）：停留感有了，但也不会永久卡在边缘。
    const homeRelax = Math.exp(-step / 20);
    homeX *= homeRelax;
    homeY *= homeRelax;

    stepSpring(
      x,
      softLimit(homeX + wanderX + amount * (active ? active.targetX : 0) + pointerX * 0.012 * pointer, BRAIN_LIMITS.offsetX),
      step
    );
    stepSpring(
      y,
      softLimit(homeY + wanderY + amount * (active ? active.targetY : 0) - pointerY * 0.01 * pointer, BRAIN_LIMITS.offsetY),
      step
    );
    stepSpring(depth, depthBias + amount * (active ? active.targetDepth : 0), step);
    stepSpring(scale, 1 + scaleBias + wanderScale + amount * (active ? active.targetScale : 0), step);
    stepSpring(tiltX, wanderTiltX + amount * (active ? active.targetTiltX : 0) - pointerY * 0.035 * pointer, step);
    stepSpring(tiltY, wanderTiltY + amount * (active ? active.targetTiltY : 0) + pointerX * 0.05 * pointer, step);
    stepSpring(tiltZ, wanderTiltZ + amount * (active ? active.targetTiltZ : 0), step);

    // 通道边界：任何情况都不允许越界漂移。
    x.value = clamp(x.value, -BRAIN_LIMITS.offsetX, BRAIN_LIMITS.offsetX);
    y.value = clamp(y.value, -BRAIN_LIMITS.offsetY, BRAIN_LIMITS.offsetY);
    depth.value = clamp(depth.value, BRAIN_LIMITS.depthFar, BRAIN_LIMITS.depthNear);
    scale.value = clamp(scale.value, BRAIN_LIMITS.scaleMin, BRAIN_LIMITS.scaleMax);
    tiltX.value = clamp(tiltX.value, -BRAIN_LIMITS.tiltX, BRAIN_LIMITS.tiltX);
    tiltY.value = clamp(tiltY.value, -BRAIN_LIMITS.tiltY, BRAIN_LIMITS.tiltY);
    tiltZ.value = clamp(tiltZ.value, -BRAIN_LIMITS.tiltZ, BRAIN_LIMITS.tiltZ);


    // 内部动态：激活 / 聚合 / 外传 / 脉冲。行为与真实状态共同决定，始终有界且平滑。
    const behaviorBoost = active ? envelope : 0;
    const agitationTarget = clamp01(
      0.12 + 0.5 * clamp01(input.thinking) + 0.62 * clamp01(input.responding)
        + 0.45 * clamp01(input.error) + 0.22 * clamp01(input.listening) + 0.25 * behaviorBoost
    );
    const cohesionTarget = clamp01(
      0.1 * clamp01(input.listening) + 0.5 * clamp01(input.thinking)
        + (active && (active.id === 'contract' || active.id === 'focus') ? 0.45 * envelope : 0)
    );
    const outflowTarget = clamp01(
      0.72 * clamp01(input.responding)
        + (active && active.id === 'radiate' ? 0.9 * envelope : 0)
        + (active && active.id === 'expand' ? 0.3 * envelope : 0)
    );
    const dynamicsMix = 1 - Math.exp(-2.2 * step);
    dynamics.agitation += (agitationTarget * (quality === 'low' ? 0.75 : 1) - dynamics.agitation) * dynamicsMix;
    dynamics.cohesion += (cohesionTarget - dynamics.cohesion) * dynamicsMix;
    dynamics.outflow += (outflowTarget - dynamics.outflow) * dynamicsMix;
    dynamics.pulse = Math.max(dynamics.pulse * Math.exp(-step * 2.8), clamp01(input.pulse));



    // 构图软限幅：外接占比超限时只收缩尺寸，不回收位移（详见文档 §17.5 / §18.5）。
    const budget = BRAIN_BUDGET;
    const depthFactor = budget.viewDistance / Math.max(0.4, budget.viewDistance - depth.value);
    const activity = clamp01(0.6 * dynamics.agitation + 0.4 * dynamics.outflow);
    const worldRadius = budget.baseRadius * (1 + budget.activityGain * activity) * scale.value * depthFactor;
    // 对角位移按 0.85 折算，避免圆形活动区被方形画布低估。
    const worldOffset = Math.hypot(x.value, y.value) * 0.85;
    const rawExtent = (worldRadius + worldOffset) / budget.visibleHalfHeight * budget.projectionScale;
    const neededShrink = rawExtent > extentCap ? extentCap / rawExtent : 1;
    // 只在构图装不下时收缩尺寸：大脑可以真的走到边缘，代价是略微变小（不回收位移）。
    const shrink = neededShrink;

    const velocity = step > 0 ? Math.hypot(x.value - previousX, y.value - previousY) / step : 0;

    frame = {
      x: x.value,
      y: y.value,
      depth: depth.value,
      scale: scale.value * shrink,
      tiltX: tiltX.value,
      tiltY: tiltY.value,
      tiltZ: tiltZ.value,
      energy: clamp01(energy),
      speed: velocity,
      extent: rawExtent * shrink,
      behavior: active ? active.id : (recent.length ? recent[recent.length - 1] : 'drift'),
      kind: active ? active.kind : (recent.length ? BEHAVIOR_KIND[recent[recent.length - 1]] : 'micro'),
      progress: active ? clamp01(active.elapsed / active.duration) : 0,
      dwelling,
      dynamics: { ...dynamics }
    };
    return frame;
  };

  return {
    update,
    getFrame: () => frame,
    setViewport,
    setQuality: next => {
      quality = next === 'low' ? 'low' : 'high';
    }
  };
}
