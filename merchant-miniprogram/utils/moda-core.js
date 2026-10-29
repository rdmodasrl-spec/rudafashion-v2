/**
 * ModaUI 数字生命核心（小程序 Canvas 2D 实现）
 *
 * 与网页端共用同一套「神经生命体」定义：斐波那契球面分布的细胞、k 近邻连成的神经纤维、
 * 沿纤维传播的脉冲与内部尘埃。小程序不支持 WebGL2 点精灵，因此这里用 Canvas 2D
 * 逐帧做同样的透视投影与逐点灰阶绘制。没有任何头像图片、贴图或预录动画，
 * 全部可见元素都是每帧重新计算的几何与运动。
 *
 * 运动系数必须与以下两处保持一致：
 * - src/apps/merchant-admin-common/components/merchant/modaui/neuralLifeform.ts（animateNeuralCell）
 * - src/apps/merchant-admin-common/components/merchant/modaui/coreShaders.ts（lifeformPoint）
 */

const STATES = ['idle', 'listening', 'thinking', 'speaking', 'success', 'error'];

const MAX_CELLS = 460;
const MIN_CELLS = 96;
const NEIGHBOURS = 3;
const SEED = 20261027;
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

const clamp01 = value => Math.min(1, Math.max(0, value));

function createRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 按画布预算换算细胞/尘埃/脉冲数量，保证不同尺寸手机上密度一致。 */
function lifeformLayout(budget) {
  const safe = budget > 0 ? budget : 8000;
  const cells = Math.round(Math.min(MAX_CELLS, Math.max(MIN_CELLS, Math.sqrt(safe) * 3.64)));
  return {
    cells,
    dust: Math.round(Math.min(480, Math.max(140, cells * 1.4))),
    pulses: Math.round(Math.min(220, Math.max(36, cells * 0.45)))
  };
}

/**
 * 细胞基点：斐波那契球面 + 内外两层，随机序列与 neuralLifeform.ts 的
 * buildNeuralCells() 完全一致（同样的取值顺序），因此三端细胞位置逐点相同。
 */
function buildCells(count) {
  const random = createRandom(SEED);
  const total = Math.max(1, Math.round(count));
  const cells = [];
  for (let index = 0; index < total; index += 1) {
    const y = 1 - (index / Math.max(1, total - 1)) * 2;
    const ring = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = GOLDEN_ANGLE * index;
    const inner = index % 9 < 2;
    const radial = inner ? 0.32 + random() * 0.38 : 0.8 + random() * 0.18;
    const jitter = 0.97 + random() * 0.06;
    const seedA = random();
    const seedB = random();
    random();
    random();
    cells.push({
      x: Math.cos(theta) * ring * radial * jitter,
      y: y * radial * jitter,
      z: Math.sin(theta) * ring * radial * jitter,
      size: inner ? 0.028 + random() * 0.018 : 0.036 + random() * 0.032,
      tone: inner ? 0.62 + random() * 0.16 : 0.86 + random() * 0.12,
      inner: inner ? 1 : 0,
      radius: radial,
      phase: seedA * Math.PI * 2,
      spread: seedB
    });
  }
  return cells;
}

/** 神经纤维：每个细胞连到最近的 3 个细胞，无向边去重，并按边长给出浓度。 */
function buildFibers(cells) {
  const edges = [];
  const seen = {};
  for (let index = 0; index < cells.length; index += 1) {
    const origin = cells[index];
    const near = [];
    for (let other = 0; other < cells.length; other += 1) {
      if (other === index) continue;
      const target = cells[other];
      const dx = target.x - origin.x;
      const dy = target.y - origin.y;
      const dz = target.z - origin.z;
      near.push({ index: other, distance: dx * dx + dy * dy + dz * dz });
    }
    near.sort((left, right) => left.distance - right.distance);
    for (let step = 0; step < NEIGHBOURS && step < near.length; step += 1) {
      const other = near[step].index;
      const low = Math.min(index, other);
      const high = Math.max(index, other);
      const key = low + ':' + high;
      if (seen[key]) continue;
      seen[key] = 1;
      edges.push([low, high]);
    }
  }

  const random = createRandom(SEED + 71);
  return edges.map(pair => {
    const a = cells[pair[0]];
    const b = cells[pair[1]];
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    const dz = a.z - b.z;
    const length = Math.sqrt(dx * dx + dy * dy + dz * dz);
    return {
      a: pair[0],
      b: pair[1],
      // 短连接更亮、长连接更淡，避免均匀网格感。
      tone: Math.max(0.45, Math.min(1, 1.05 - length * 0.55)),
      phase: random()
    };
  });
}

/** 内部尘埃：球体内按体积均匀分布，随机序列与 buildNeuralDust() 一致。 */
function buildDust(count) {
  const random = createRandom(SEED + 31);
  const total = Math.max(0, Math.round(count));
  const dust = [];
  for (let index = 0; index < total; index += 1) {
    const u = random() * 2 - 1;
    const angle = random() * Math.PI * 2;
    const ring = Math.sqrt(Math.max(0, 1 - u * u));
    const radius = Math.cbrt(random()) * 0.92;
    const seedA = random();
    const seedB = random();
    random();
    random();
    dust.push({
      x: Math.cos(angle) * ring * radius,
      y: u * radius,
      z: Math.sin(angle) * ring * radius,
      size: 0.01 + random() * 0.01,
      tone: 0.42 + random() * 0.2,
      phase: seedA * Math.PI * 2,
      spread: seedB
    });
  }
  return dust;
}

function buildLifeform(budget) {
  const layout = lifeformLayout(budget);
  const cells = buildCells(layout.cells);
  return {
    layout,
    cells,
    fibers: buildFibers(cells),
    dust: buildDust(layout.dust)
  };
}

const TAU = Math.PI * 2;
/** 视场与观察距离：与 coreShaders.ts / modaCoreEngine.ts 的 FOV_DEGREES = 32、viewPos.z -= 3.55 一致。 */
const FOV = (32 * Math.PI) / 180;
const VIEW_DISTANCE = 3.55;

/**
 * 生命行为常量：与 modaBrainBehavior.ts 的 BRAIN_SEED / BRAIN_LIMITS / BRAIN_BUDGET 逐项同值
 * （见 docs/engineering/modules/modaui-core.md 第 18 节，测试断言数值相等）。
 */
const BRAIN_SEED = 20261027;
const BRAIN_LIMITS = {
  offsetX: 0.28,
  offsetY: 0.2,
  depthNear: 0.2,
  depthFar: -0.2,
  scaleMin: 0.86,
  scaleMax: 1.1,
  tiltX: 0.13,
  tiltY: 0.18,
  tiltZ: 0.055
};
const BRAIN_BUDGET = {
  viewDistance: 3.55,
  visibleHalfHeight: 1.018,
  projectionScale: 0.76,
  baseRadius: 1.05,
  activityGain: 0.075,
  maxExtent: 0.94,
  bleedPx: 5,
  travelRadius: 0.92
};

/** 投影留白：与 modaBrainBehavior.ts 的 BRAIN_BUDGET.projectionScale 同一个值。 */
const PROJECTION_SCALE = BRAIN_BUDGET.projectionScale;

const fract = value => value - Math.floor(value);
const smoothstep = (edge0, edge1, value) => {
  const t = clamp01((value - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
};

/**
 * 细胞运动参考实现的镜像：系数必须与 neuralLifeform.ts 的 animateNeuralCell()
 * 以及 coreShaders.ts 的 lifeformPoint() 逐项一致。
 * `out` 可选，传入时原地写入以避免每帧新建数组。
 */
function animateCell(base, phase, activity, out) {
  const bx = base[0];
  const by = base[1];
  const bz = base[2];
  const radius = Math.sqrt(bx * bx + by * by + bz * bz) || 1;
  const time = activity.time;

  const breath = 1 + 0.045 * Math.sin(time * 1.15) + 0.02 * Math.sin(time * 0.47);
  const wave = 0.03 * Math.sin(time * 1.25 + phase) + 0.02 * Math.sin(time * 0.63 + phase * 1.7);
  const scale = breath + wave + activity.energy * 0.03 + activity.burst * 0.09
    - activity.contraction * 0.12 + activity.expansion * 0.05 - activity.error * 0.05;

  let x = bx * scale;
  let z = bz * scale;
  const y = by * scale;

  // 差速旋转：外层转得快、内层转得慢。
  const swirl = (0.16 + 0.1 * radius) * Math.sin(time * 0.37);
  const swirlCos = Math.cos(swirl);
  const swirlSin = Math.sin(swirl);
  const swirledX = x * swirlCos + z * swirlSin;
  const swirledZ = -x * swirlSin + z * swirlCos;
  x = swirledX;
  z = swirledZ;

  const nx = bx / radius;
  const ny = by / radius;
  const nz = bz / radius;

  const ripple = activity.level * (0.012 + activity.level * 0.07)
    * (0.5 + 0.5 * Math.sin(time * 3.1 - radius * 6 + phase));
  const speak = activity.pulse * 0.03 * (0.5 + 0.5 * Math.sin(time * 9 + phase * 2));
  // 小程序没有指针视差：gaze 恒为 0 时这一项自然为 0，公式仍与网页端同源。
  const pointerX = activity.gazeX;
  const pointerY = -activity.gazeY;
  const pointerZ = 0.55;
  const pointerLength = Math.sqrt(pointerX * pointerX + pointerY * pointerY + pointerZ * pointerZ) || 1;
  const pointerDot = (nx * pointerX + ny * pointerY + nz * pointerZ) / pointerLength;
  const bulge = Math.max(0, pointerDot) * 0.032 * (1 - Math.min(1, activity.contraction) * 0.5);
  const push = ripple + speak + bulge;
  x += nx * push;
  const pushedY = y + ny * push;
  z += nz * push;

  const yaw = activity.gazeX * 0.46 + 0.05 * Math.sin(time * 0.23);
  const pitch = -activity.gazeY * 0.26 - 0.02 + 0.02 * Math.sin(time * 0.31);
  const yawCos = Math.cos(yaw);
  const yawSin = Math.sin(yaw);
  const yawedX = x * yawCos + z * yawSin;
  const yawedZ = -x * yawSin + z * yawCos;
  const pitchCos = Math.cos(pitch);
  const pitchSin = Math.sin(pitch);

  const result = out || [0, 0, 0];
  result[0] = yawedX;
  result[1] = pushedY * pitchCos - yawedZ * pitchSin;
  result[2] = pushedY * pitchSin + yawedZ * pitchCos;
  return result;
}

/**
 * 主体级变换：先按自身尺寸缩放，再 rotateZ → rotateX → rotateY（与 GLSL bodyTransform() 同序），
 * 最后加空间位移。内部形变已由 animateCell() 完成，两者串行叠加。
 */
function bodyTransform(x, y, z, motion, out) {
  const scaled = motion.scale;
  let px = x * scaled;
  let py = y * scaled;
  let pz = z * scaled;

  const cz = Math.cos(motion.tiltZ);
  const sz = Math.sin(motion.tiltZ);
  const rzx = px * cz - py * sz;
  const rzy = px * sz + py * cz;
  px = rzx;
  py = rzy;

  const cx = Math.cos(motion.tiltX);
  const sx = Math.sin(motion.tiltX);
  const rxy = py * cx - pz * sx;
  const rxz = py * sx + pz * cx;
  py = rxy;
  pz = rxz;

  const cy = Math.cos(motion.tiltY);
  const sy = Math.sin(motion.tiltY);
  const ryx = px * cy + pz * sy;
  const ryz = -px * sy + pz * cy;
  px = ryx;
  pz = ryz;

  out[0] = px + motion.x;
  out[1] = py + motion.y;
  out[2] = pz;
  return out;
}

/** 固定种子 PRNG：与 modaBrainBehavior.ts 的 createRandom() 同一算法。 */
function createBrainRandom(seed) {
  let state = seed >>> 0;
  return function next() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const brainSmoothstep = (edge0, edge1, value) => {
  const t = clamp01((value - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
};

const brainEnvelope = progress => {
  if (progress <= 0 || progress >= 1) return 0;
  if (progress < 0.28) return brainSmoothstep(0, 1, progress / 0.28);
  if (progress > 0.6) return brainSmoothstep(0, 1, (1 - progress) / 0.4);
  return 1;
};

/** 位置软限幅：与 modaBrainBehavior.ts 的 softLimit() 同一公式。 */
const brainSoftLimit = (value, limit) => (limit > 0 ? limit * Math.tanh(value / limit) : 0);

const BRAIN_BEHAVIORS = [
  'drift', 'tilt', 'settle', 'approach', 'retreat',
  'contract', 'expand', 'focus', 'radiate', 'recoil', 'travel'
];

/** 状态 → 行为权重（idle / listening / thinking / responding / success / error），与网页端同表。 */
const BRAIN_WEIGHTS = {
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

const BRAIN_KIND = {
  drift: 'micro', tilt: 'micro', settle: 'micro',
  approach: 'mid', retreat: 'mid', contract: 'mid', expand: 'mid',
  focus: 'mid', radiate: 'mid', recoil: 'mid',
  travel: 'macro'
};

const BRAIN_COOLDOWN = {
  drift: 0, tilt: 0, settle: 0,
  approach: 3.2, retreat: 3.2, contract: 3.2, expand: 3.2, focus: 3.2, radiate: 3.2,
  recoil: 4,
  travel: 7.5
};

const BRAIN_DURATION = {
  drift: [1.6, 3.0], tilt: [1.5, 2.6], settle: [1.2, 2.2],
  approach: [1.5, 2.4], retreat: [1.6, 2.6], contract: [1.3, 2.2], expand: [1.4, 2.4],
  focus: [1.6, 2.8], radiate: [1.4, 2.6], recoil: [0.9, 1.4],
  travel: [2.6, 4.2]
};

const BRAIN_DWELL = { micro: [0.05, 0.35], mid: [0.25, 0.8], macro: [0.6, 1.8] };

/**
 * 生命行为控制器：modaBrainBehavior.ts 的镜像实现。
 * 同一套行为集、冷却、停顿、位置基准、软限幅与内部动态；小程序只简化绘制，不简化语义。
 * 返回 update(dt, input) → 行为快照，供绘制时应用 bodyTransform()。
 */
function createBrainBehavior() {
  const random = createBrainRandom(BRAIN_SEED);
  const phases = new Float64Array(10);
  for (let index = 0; index < phases.length; index += 1) phases[index] = random() * Math.PI * 2;

  const channel = (omega, maxSpeed, value) => ({ value: value || 0, velocity: 0, omega: omega, maxSpeed: maxSpeed });
  const x = channel(2.2, 0.34);
  const y = channel(2.2, 0.34);
  const depth = channel(1.7, 0.55);
  const scale = channel(1.6, 0.55, 1);
  const tiltX = channel(1.4, 0.45);
  const tiltY = channel(1.4, 0.45);
  const tiltZ = channel(1.15, 0.3);

  // 1/120 秒分步积分：与网页端同一帧率无关性。
  const stepChannel = (ch, target, dt) => {
    let remaining = Math.min(0.05, Math.max(0, dt));
    while (remaining > 1e-6) {
      const h = Math.min(1 / 120, remaining);
      remaining -= h;
      const accel = (target - ch.value) * ch.omega * ch.omega - 2 * 0.92 * ch.omega * ch.velocity;
      const limit = ch.maxSpeed;
      ch.velocity = Math.max(-limit, Math.min(limit, ch.velocity + accel * h));
      ch.value += ch.velocity * h;
    }
  };

  let time = 0;
  let energy = 0.6;
  let lastBurst = 0;
  let lastTravelX = 0;
  let homeX = 0;
  let homeY = 0;
  let active = null;
  let dwelling = false;
  let dwellLeft = 0;
  let nextBehaviorIn = 0.8;
  const recent = [];
  const cooldowns = {};
  BRAIN_BEHAVIORS.forEach(id => { cooldowns[id] = 0; });
  const dynamics = { agitation: 0.12, cohesion: 0, outflow: 0.05, pulse: 0 };
  let extentCap = BRAIN_BUDGET.maxExtent;

  let frame = {
    x: 0, y: 0, depth: 0, scale: 1, tiltX: 0, tiltY: 0, tiltZ: 0,
    energy: energy,
    speed: 0,
    extent: BRAIN_BUDGET.baseRadius / BRAIN_BUDGET.visibleHalfHeight * BRAIN_BUDGET.projectionScale,
    behavior: 'drift', kind: 'micro', progress: 0, dwelling: false,
    dynamics: { agitation: dynamics.agitation, cohesion: 0, outflow: 0.05, pulse: 0 }
  };

  const setViewport = sizeCss => {
    const half = Math.max(4, (Number.isFinite(sizeCss) ? sizeCss : 0) / 2);
    extentCap = Math.min(BRAIN_BUDGET.maxExtent, (half - BRAIN_BUDGET.bleedPx) / half);
  };

  const stateScore = (id, input) => {
    const weights = BRAIN_WEIGHTS[id];
    return weights[0] * clamp01(input.idle) + weights[1] * clamp01(input.listening)
      + weights[2] * clamp01(input.thinking) + weights[3] * clamp01(input.responding)
      + weights[4] * clamp01(input.success) + weights[5] * clamp01(input.error);
  };

  const selectBehavior = input => {
    const blocked = {};
    BRAIN_BEHAVIORS.forEach(id => {
      if (cooldowns[id] > 0) blocked[id] = true;
      if (id === 'travel' && (input.presentation === 'inline' || input.reduced)) blocked[id] = true;
    });
    const excludeRecent = recent.slice(-2);
    const scoreOf = id => {
      const base = stateScore(id, input);
      if (base <= 0.001) return 0;
      const repeat = recent.length && recent[recent.length - 1] === id ? 0.12 : 1;
      const kind = BRAIN_KIND[id];
      const energyFit = kind === 'macro' ? 0.45 + 0.9 * clamp01(input.energy)
        : kind === 'mid' ? 0.7 + 0.5 * clamp01(input.energy) : 1;
      return base * repeat * energyFit * (0.65 + random() * 0.7);
    };
    const candidates = [];
    BRAIN_BEHAVIORS.forEach(id => {
      if (blocked[id]) return;
      const value = scoreOf(id);
      if (value > 0) candidates.push({ id: id, score: value });
    });
    const filtered = candidates.filter(entry => excludeRecent.indexOf(entry.id) < 0);
    const pool = filtered.length >= 2 ? filtered : candidates;
    const total = pool.reduce((sum, entry) => sum + entry.score, 0);
    if (total <= 0) return 'drift';
    let pick = random() * total;
    for (let index = 0; index < pool.length; index += 1) {
      pick -= pool[index].score;
      if (pick <= 0) return pool[index].id;
    }
    return pool[pool.length - 1].id;
  };


  const pickTravelTarget = (currentX, currentY, input) => {
    const currentAngle = Math.atan2(currentY / BRAIN_LIMITS.offsetY, currentX / BRAIN_LIMITS.offsetX);
    const direction = random() < 0.5 ? -1 : 1;
    const angle = currentAngle + direction * (1.2 + random() * 1.6);
    const reach = (input.presentation === 'inline' ? 0.45 : 0.62 + random() * 0.24) * BRAIN_BUDGET.travelRadius;
    const depthSign = random() < 0.5 ? -1 : 1;
    const amplitude = input.reduced ? 0.4 : 1;
    let targetX = Math.cos(angle) * reach * BRAIN_LIMITS.offsetX * amplitude;
    if (lastTravelX !== 0 && Math.sign(targetX) === Math.sign(lastTravelX) && Math.abs(lastTravelX) > 0.04) {
      targetX = -targetX;
    }
    lastTravelX = targetX;
    // 纵向独立取点：换位要同时改变上下位置，不能只沿一条水平线前后挪动。
    const verticalSign = random() < 0.5 ? -1 : 1;
    return {
      targetX: targetX,
      targetY: verticalSign * (0.35 + random() * 0.5) * BRAIN_LIMITS.offsetY * amplitude,
      targetDepth: depthSign * (0.05 + random() * 0.09) * (input.reduced ? 0.3 : 1),
      targetScale: (random() < 0.5 ? -1 : 1) * (0.01 + random() * 0.015)
    };
  };

  const startBehavior = input => {
    const id = selectBehavior(input);
    const kind = BRAIN_KIND[id];
    const range = BRAIN_DURATION[id];
    const speedFactor = input.reduced ? 1.5 : 1;
    const amplitude = (0.72 + random() * 0.28) * (input.reduced ? 0.3 : 1);
    const behavior = {
      id: id,
      kind: kind,
      duration: (range[0] + random() * (range[1] - range[0])) * speedFactor,
      elapsed: 0,
      // 宏观换位不能被随机强度打折，否则永远走不到舞台另一侧。
      strength: kind === 'macro' ? 1 : amplitude,
      targetX: 0, targetY: 0, targetDepth: 0, targetScale: 0,
      targetTiltX: 0, targetTiltY: 0, targetTiltZ: 0
    };
    const sign = random() < 0.5 ? -1 : 1;
    if (id === 'travel') {
      const target = pickTravelTarget(x.value, y.value, input);
      // 换位 = 搬迁位置基准：目标不是一次性偏移，而是一个新的停留点。
      homeX = target.targetX;
      homeY = target.targetY;
      behavior.targetDepth = target.targetDepth;
      behavior.targetScale = target.targetScale;
    } else if (id === 'approach') {
      behavior.targetDepth = BRAIN_LIMITS.depthNear * 0.85;
      behavior.targetScale = 0.015;
      behavior.targetY = BRAIN_LIMITS.offsetY * 0.06;
    } else if (id === 'retreat') {
      behavior.targetDepth = BRAIN_LIMITS.depthFar * 0.85;
      behavior.targetScale = -0.02;
    } else if (id === 'contract') {
      behavior.targetScale = -0.07;
      behavior.targetY = BRAIN_LIMITS.offsetY * 0.08;
    } else if (id === 'expand') {
      behavior.targetScale = 0.07;
      behavior.targetY = -BRAIN_LIMITS.offsetY * 0.05;
    } else if (id === 'focus') {
      behavior.targetDepth = 0.06;
      behavior.targetTiltY = BRAIN_LIMITS.tiltY * 0.35 * sign;
      behavior.targetTiltX = -BRAIN_LIMITS.tiltX * 0.3 * sign;
    } else if (id === 'radiate') {
      behavior.targetScale = 0.05;
      behavior.targetTiltY = BRAIN_LIMITS.tiltY * 0.55 * sign;
    } else if (id === 'recoil') {
      behavior.targetDepth = BRAIN_LIMITS.depthFar * 0.5;
      behavior.targetScale = -0.08;
      behavior.targetTiltX = BRAIN_LIMITS.tiltX * 0.45 * sign;
      behavior.targetY = -BRAIN_LIMITS.offsetY * 0.12;
    } else if (id === 'tilt') {
      behavior.targetTiltY = BRAIN_LIMITS.tiltY * 0.8 * sign;
      behavior.targetTiltX = -BRAIN_LIMITS.tiltX * 0.45 * sign;
      behavior.targetTiltZ = BRAIN_LIMITS.tiltZ * 0.6 * (random() < 0.5 ? -1 : 1);
    } else if (id === 'settle') {
      behavior.targetScale = -0.025;
      behavior.targetDepth = -0.03;
    } else {
      behavior.targetX = BRAIN_LIMITS.offsetX * (0.25 + random() * 0.3) * sign;
      behavior.targetY = BRAIN_LIMITS.offsetY * (0.15 + random() * 0.3) * (random() < 0.5 ? -1 : 1);
    }
    active = behavior;
    recent.push(id);
    if (recent.length > 6) recent.shift();
    cooldowns[id] = BRAIN_COOLDOWN[id];
    dynamics.pulse = Math.max(dynamics.pulse, kind === 'macro' ? 0.7 : 0.42);
  };

  const finishBehavior = () => {
    if (!active) return;
    const range = BRAIN_DWELL[active.kind];
    dwelling = true;
    dwellLeft = range[0] + random() * (range[1] - range[0]);
    active = null;
    nextBehaviorIn = 0;
  };


  const update = (dt, input) => {
    const step = Math.max(0, Math.min(0.05, Number.isFinite(dt) ? dt : 0));
    const motionScale = input.reduced ? 0.3 : 1;
    time += step * (input.reduced ? 0.5 : 1);

    const stateActivity = clamp01(
      input.thinking * 0.9 + input.responding * 1.1 + input.error * 0.8 + input.listening * 0.5
    );
    const energyTarget = clamp01(0.3 + 0.42 * clamp01(input.energy) + 0.16 * stateActivity + (active ? 0.12 : 0));
    energy += (energyTarget - energy) * (1 - Math.exp(-2.4 * step));

    BRAIN_BEHAVIORS.forEach(id => {
      if (cooldowns[id] > 0) cooldowns[id] = Math.max(0, cooldowns[id] - step);
    });

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

    const envelope = active ? brainEnvelope(active.elapsed / active.duration) : 0;
    const amount = envelope * (active ? active.strength : 0);
    const travelMask = active && active.id === 'travel' ? 0.35 : 1;
    const wanderAmp = motionScale * (0.55 + 0.45 * energy) * travelMask;
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

    const depthBias = motionScale * (
      clamp01(input.forward || 0) * 0.12 + clamp01(input.responding) * 0.02 - clamp01(input.error) * 0.03
    );
    const scaleBias = motionScale * (clamp01(input.responding) * 0.03 - clamp01(input.thinking) * 0.025);

    const burst = clamp01(input.burst || 0);
    if (burst > lastBurst + 0.05) {
      depth.velocity = Math.max(-depth.maxSpeed, Math.min(depth.maxSpeed, depth.velocity + 0.35 * burst));
      scale.velocity = Math.max(-scale.maxSpeed, Math.min(scale.maxSpeed, scale.velocity + 0.22 * burst));
      y.velocity = Math.max(-y.maxSpeed, Math.min(y.maxSpeed, y.velocity + 0.05 * burst));
    }
    lastBurst = burst;

    const previousX = x.value;
    const previousY = y.value;
    const homeRelax = Math.exp(-step / 20);
    homeX *= homeRelax;
    homeY *= homeRelax;

    stepChannel(x, brainSoftLimit(homeX + wanderX + amount * (active ? active.targetX : 0), BRAIN_LIMITS.offsetX), step);
    stepChannel(y, brainSoftLimit(homeY + wanderY + amount * (active ? active.targetY : 0), BRAIN_LIMITS.offsetY), step);
    stepChannel(depth, depthBias + amount * (active ? active.targetDepth : 0), step);
    stepChannel(scale, 1 + scaleBias + wanderScale + amount * (active ? active.targetScale : 0), step);
    stepChannel(tiltX, wanderTiltX + amount * (active ? active.targetTiltX : 0), step);
    stepChannel(tiltY, wanderTiltY + amount * (active ? active.targetTiltY : 0), step);
    stepChannel(tiltZ, wanderTiltZ + amount * (active ? active.targetTiltZ : 0), step);

    x.value = Math.max(-BRAIN_LIMITS.offsetX, Math.min(BRAIN_LIMITS.offsetX, x.value));
    y.value = Math.max(-BRAIN_LIMITS.offsetY, Math.min(BRAIN_LIMITS.offsetY, y.value));
    depth.value = Math.max(BRAIN_LIMITS.depthFar, Math.min(BRAIN_LIMITS.depthNear, depth.value));
    scale.value = Math.max(BRAIN_LIMITS.scaleMin, Math.min(BRAIN_LIMITS.scaleMax, scale.value));
    tiltX.value = Math.max(-BRAIN_LIMITS.tiltX, Math.min(BRAIN_LIMITS.tiltX, tiltX.value));
    tiltY.value = Math.max(-BRAIN_LIMITS.tiltY, Math.min(BRAIN_LIMITS.tiltY, tiltY.value));
    tiltZ.value = Math.max(-BRAIN_LIMITS.tiltZ, Math.min(BRAIN_LIMITS.tiltZ, tiltZ.value));


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
    dynamics.agitation += (agitationTarget - dynamics.agitation) * dynamicsMix;
    dynamics.cohesion += (cohesionTarget - dynamics.cohesion) * dynamicsMix;
    dynamics.outflow += (outflowTarget - dynamics.outflow) * dynamicsMix;
    dynamics.pulse = Math.max(dynamics.pulse * Math.exp(-step * 2.8), clamp01(input.pulse || 0));

    const depthFactor = BRAIN_BUDGET.viewDistance / Math.max(0.4, BRAIN_BUDGET.viewDistance - depth.value);
    const activity = clamp01(0.6 * dynamics.agitation + 0.4 * dynamics.outflow);
    const worldRadius = BRAIN_BUDGET.baseRadius * (1 + BRAIN_BUDGET.activityGain * activity) * scale.value * depthFactor;
    const worldOffset = Math.hypot(x.value, y.value) * 0.85;
    const rawExtent = (worldRadius + worldOffset) / BRAIN_BUDGET.visibleHalfHeight * BRAIN_BUDGET.projectionScale;
    const shrink = rawExtent > extentCap ? extentCap / rawExtent : 1;
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
      kind: active ? active.kind : (recent.length ? BRAIN_KIND[recent[recent.length - 1]] : 'micro'),
      progress: active ? clamp01(active.elapsed / active.duration) : 0,
      dwelling: dwelling,
      dynamics: {
        agitation: dynamics.agitation,
        cohesion: dynamics.cohesion,
        outflow: dynamics.outflow,
        pulse: dynamics.pulse
      }
    };
    return frame;
  };

  return {
    update: update,
    getFrame: () => frame,
    setViewport: setViewport
  };
}


// 灰阶色阶查表：白底上只允许近黑与中灰，禁止纯白（纯白会在墨点上打白洞）。



const INK_STEPS = 24;
const INK_COLORS = [];
const HIGHLIGHT_COLORS = [];
const LIGHT_COLORS = [];
for (let step = 0; step < INK_STEPS; step += 1) {
  const alpha = step / (INK_STEPS - 1);
  INK_COLORS.push('rgba(17, 17, 19, ' + alpha.toFixed(3) + ')');
  HIGHLIGHT_COLORS.push('rgba(158, 158, 164, ' + (alpha * 0.6).toFixed(3) + ')');
  LIGHT_COLORS.push('rgba(158, 158, 164, ' + alpha.toFixed(3) + ')');
}
const stepIndex = alpha => Math.max(0, Math.min(INK_STEPS - 1, Math.round(clamp01(alpha) * (INK_STEPS - 1))));
const inkColor = alpha => INK_COLORS[stepIndex(alpha)];
const highlightColor = alpha => HIGHLIGHT_COLORS[stepIndex(alpha)];
const lightColor = alpha => LIGHT_COLORS[stepIndex(alpha)];

/**
 * 创建小程序版数字生命核心。
 *
 * @param {object} options
 * @param {object} options.canvas 页面 canvas 节点（Canvas 2D）
 * @param {number} options.width CSS 宽度
 * @param {number} options.height CSS 高度
 * @param {number} [options.pixelRatio] 设备像素比，上限 2
 * @param {() => string} [options.readState] 读取当前视觉状态（后台会话状态由页面传入）
 */
function createModaCore(options) {
  const { canvas, width, height, readState } = options;
  const pixelRatio = Math.min(options.pixelRatio || 1, 2);
  const context = canvas.getContext('2d');
  // 预算与网页端同口径（按画布面积换算），再折算成细胞数量，保证手机与网页密度一致。
  const budget = Math.min(16000, Math.max(1200, Math.round(width * height * 0.19)));
  const data = buildLifeform(budget);
  const cellTotal = data.cells.length;
  const fiberTotal = data.fibers.length;
  const dustTotal = data.dust.length;

  const weights = {};
  STATES.forEach(state => { weights[state] = state === 'idle' ? 1 : 0; });

  // 与网页端 NeuralActivity 同名字段；小程序没有指针、麦克风与语音边界，对应项恒为 0。
  const activity = {
    time: 0,
    energy: 0.82,
    contraction: 0,
    expansion: 0,
    level: 0,
    pulse: 0,
    burst: 0,
    error: 0,
    gazeX: 0,
    gazeY: 0
  };

  // 生命行为控制器：位置/深度/尺寸/姿态与内部动态的唯一来源（与网页端同一套常量、行为集与弹簧）。
  const brain = createBrainBehavior();
  const motionInput = {
    idle: 1,
    listening: 0,
    thinking: 0,
    responding: 0,
    success: 0,
    error: 0,
    energy: 0.82,
    forward: 0,
    pulse: 0,
    burst: 0,
    pointerX: 0,
    pointerY: 0,
    // 32px 内嵌头像与自由舞台共用同一控制器：只限制宏观换位，不重置位姿。
    presentation: width <= 64 ? 'inline' : 'stage',
    reduced: options.reducedMotion === true
  };
  let motionFrame = brain.getFrame();
  // 小画布（如 32px 内嵌核心）按真实尺寸收紧构图预算。
  brain.setViewport(Math.min(width, height));
  let lastDeltaMs = 16;

  const requestFrame = typeof canvas.requestAnimationFrame === 'function'
    ? callback => canvas.requestAnimationFrame(callback)
    : callback => setTimeout(() => callback(Date.now()), 33);
  const cancelFrame = typeof canvas.cancelAnimationFrame === 'function'
    ? handle => canvas.cancelAnimationFrame(handle)
    : handle => clearTimeout(handle);

  let frameHandle = 0;
  let running = false;
  let disposed = false;
  let lastFrame = 0;
  let frames = 0;

  canvas.width = Math.round(width * pixelRatio);
  canvas.height = Math.round(height * pixelRatio);

  // 与 WebGL 端同一透视：focal / (VIEW_DISTANCE - z)。
  const focal = ((height / 2) / Math.tan(FOV / 2)) * PROJECTION_SCALE;
  const centerX = width / 2;
  const centerY = height / 2;

  // 每帧复用的投影缓存，避免 30fps 下反复分配数组。
  const cellX = new Float64Array(cellTotal);
  const cellY = new Float64Array(cellTotal);
  const cellZ = new Float64Array(cellTotal);
  const cellR = new Float64Array(cellTotal);
  const cellA = new Float64Array(cellTotal);
  const order = [];
  for (let index = 0; index < cellTotal; index += 1) order.push(index);
  const base = [0, 0, 0];
  const point = [0, 0, 0];
  const bodyPoint = [0, 0, 0];

  const draw = () => {
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    context.clearRect(0, 0, width, height);

    const requested = readState ? readState() : 'idle';
    const active = STATES.indexOf(requested) >= 0 ? requested : 'idle';
    const listening = weights.listening;
    const thinking = weights.thinking;
    const speaking = weights.speaking;
    const success = weights.success;
    const errorWeight = weights.error;

    activity.contraction = Math.min(1, thinking + listening * 0.2);
    activity.expansion = success;
    activity.error = errorWeight;
    activity.energy = clamp01(0.8 + 0.12 * speaking + 0.1 * listening - 0.08 * errorWeight);
    const brightness = (1 + 0.1 * activity.energy) * (1 + 0.1 * success) * (1 - 0.12 * errorWeight);

    // 主体运动：状态权重 → 运动控制器，再用于本帧所有点（细胞、尘埃、纤维、脉冲）。
    motionInput.idle = weights.idle;
    motionInput.listening = weights.listening;
    motionInput.thinking = weights.thinking;
    motionInput.responding = weights.speaking;
    motionInput.success = weights.success;
    motionInput.error = weights.error;
    motionInput.energy = activity.energy;
    motionInput.pulse = Math.max(0, Math.min(1, weights.speaking * 0.5 + weights.success * 0.2));
    motionFrame = brain.update(Math.min(0.05, lastDeltaMs / 1000), motionInput);

    // 内部动态（与网页端 uCognition 同义）：聚合收紧结构、自主脉冲轻微鼓起，
    // 激活提高细胞亮度与点尺寸，外传加快并增益脉冲。三者都只影响内部，不改变位置。
    const dynamics = motionFrame.dynamics;
    const structure = (1 - 0.055 * dynamics.cohesion) * (1 + 0.016 * dynamics.pulse);
    // 小程序只有单层圆点，没有 WebGL 的球面着色，因此激活增益取一半，避免整团发闷。
    const activation = 1 + 0.06 * dynamics.agitation + 0.05 * dynamics.pulse;

    // 1) 细胞投影：纤维与脉冲复用同一批屏幕坐标，端点必然贴合细胞。
    for (let index = 0; index < cellTotal; index += 1) {
      const cell = data.cells[index];
      base[0] = cell.x;
      base[1] = cell.y;
      base[2] = cell.z;
      const moved = animateCell(base, cell.phase, activity, point);
      const body = bodyTransform(moved[0] * structure, moved[1] * structure, moved[2] * structure, motionFrame, bodyPoint);
      const depth = body[2] + motionFrame.depth;
      const factor = focal / Math.max(0.4, VIEW_DISTANCE - depth);
      cellX[index] = centerX + body[0] * factor;
      cellY[index] = centerY - body[1] * factor;
      cellZ[index] = depth;
      cellR[index] = Math.max(0.45, cell.size * factor * 0.5 * (0.92 + 0.16 * cell.spread) * (1 + 0.06 * dynamics.agitation));
      const depthFade = 0.55 + 0.45 * clamp01((depth + 1.4) / 2);
      const flicker = 0.86 + 0.14 * Math.sin(activity.time * (0.9 + cell.spread * 1.3) + cell.phase * 1.7);
      // 单片圆点替代逐像素球面着色：边缘环与核心的浓度折算进同一个 alpha。
      cellA[index] = clamp01(cell.tone * flicker * depthFade * brightness * activation) * 0.62;
    }

    // 2) 神经纤维：全部连接合并到一条路径，只设置一次样式；浓度与 WebGL uFiberAlpha 基线一致。
    context.lineWidth = 0.7;
    context.strokeStyle = inkColor((0.2 + 0.12 * activity.energy) * (1 + 0.08 * dynamics.agitation));
    context.beginPath();
    for (let index = 0; index < fiberTotal; index += 1) {
      const fiber = data.fibers[index];
      context.moveTo(cellX[fiber.a], cellY[fiber.a]);
      context.lineTo(cellX[fiber.b], cellY[fiber.b]);
    }
    context.stroke();

    // 3) 内部尘埃：球体内漂浮的细小颗粒，给出纵深。
    for (let index = 0; index < dustTotal; index += 1) {
      const mote = data.dust[index];
      base[0] = mote.x;
      base[1] = mote.y;
      base[2] = mote.z;
      const moved = animateCell(base, mote.phase, activity, point);
      const driftX = moved[0] + Math.sin(activity.time * 0.61 + mote.phase * 2) * 0.03;
      const driftY = moved[1] + Math.sin(activity.time * 0.47 + mote.phase) * 0.03;
      const driftZ = moved[2] + Math.cos(activity.time * 0.53 + mote.phase * 1.4) * 0.03;
      const body = bodyTransform(driftX * structure, driftY * structure, driftZ * structure, motionFrame, bodyPoint);
      const depth = body[2] + motionFrame.depth;
      const factor = focal / Math.max(0.4, VIEW_DISTANCE - depth);
      const radius = Math.max(0.35, mote.size * factor * 0.35);
      const alpha = clamp01(mote.tone * 0.5 * (0.55 + 0.45 * clamp01((depth + 1.4) / 2)) * activation);
      context.beginPath();
      context.fillStyle = inkColor(alpha);
      context.arc(centerX + body[0] * factor, centerY - body[1] * factor, radius, 0, TAU);
      context.fill();
    }

    // 4) 细胞：按视深从远到近绘制，前面的细胞自然遮挡后面的细胞。
    order.sort((left, right) => cellZ[left] - cellZ[right]);
    for (let step = 0; step < cellTotal; step += 1) {
      const index = order[step];
      const cell = data.cells[index];
      const radius = cellR[index];
      const alpha = cellA[index];
      context.beginPath();
      context.fillStyle = inkColor(alpha);
      context.arc(cellX[index], cellY[index], radius, 0, TAU);
      context.fill();
      // 外层细胞补一个浅灰高光点：近看是半透明细胞，远看是立体结构。
      if (!cell.inner && cellZ[index] > -0.1 && radius > 1.2) {
        context.beginPath();
        context.fillStyle = highlightColor(alpha);
        context.arc(cellX[index] - radius * 0.3, cellY[index] - radius * 0.3, radius * 0.42, 0, TAU);
        context.fill();
      }
    }

    // 5) 脉冲：沿纤维按各自相位移动，两端淡出，压在细胞之上。
    // 外传通道提高速度与浓度：回答时神经信号明确地从内部向外扩散。
    const speed = 0.16 + 0.28 * clamp01(activity.energy) + 0.22 * dynamics.outflow;
    const pulseTotal = Math.min(data.layout.pulses, fiberTotal);
    for (let index = 0; index < pulseTotal; index += 1) {
      const fiber = data.fibers[index];
      const t = fract(activity.time * speed + fiber.phase);
      const alpha = clamp01(
        0.85 * fiber.tone * (1 + 0.45 * dynamics.outflow)
          * smoothstep(0, 0.12, t) * (1 - smoothstep(0.88, 1, t))
      );
      if (alpha <= 0.02) continue;
      const x = cellX[fiber.a] + (cellX[fiber.b] - cellX[fiber.a]) * t;
      const y = cellY[fiber.a] + (cellY[fiber.b] - cellY[fiber.a]) * t;
      context.beginPath();
      context.fillStyle = lightColor(alpha);
      context.arc(x, y, 1.9 * (1 + 0.25 * dynamics.outflow), 0, TAU);
      context.fill();
    }

    weights[active] += (1 - weights[active]) * 0.1;
    STATES.forEach(state => {
      if (state !== active) weights[state] += (0 - weights[state]) * 0.1;
    });
  };

  const frame = timestamp => {
    if (!running || disposed) return;
    frameHandle = requestFrame(frame);
    const delta = lastFrame ? Math.min(80, timestamp - lastFrame) : 16;
    lastFrame = timestamp;
    lastDeltaMs = delta;
    activity.time += delta / 1000;
    frames += 1;
    draw();
  };

  return {
    start() {
      if (running || disposed) return;
      running = true;
      lastFrame = 0;
      frameHandle = requestFrame(frame);
    },
    stop() {
      running = false;
      if (frameHandle) cancelFrame(frameHandle);
      frameHandle = 0;
      lastFrame = 0;
    },
    dispose() {
      this.stop();
      disposed = true;
    },
    getStats() {
      return {
        particleCount: cellTotal + dustTotal,
        cellCount: cellTotal,
        dustCount: dustTotal,
        fiberCount: fiberTotal,
        pulseCount: Math.min(data.layout.pulses, fiberTotal),
        frames,
        state: STATES.find(state => weights[state] > 0.5) || 'idle',
        motion: {
          x: Number(motionFrame.x.toFixed(4)),
          y: Number(motionFrame.y.toFixed(4)),
          depth: Number(motionFrame.depth.toFixed(4)),
          scale: Number(motionFrame.scale.toFixed(4)),
          tiltX: Number(motionFrame.tiltX.toFixed(4)),
          tiltY: Number(motionFrame.tiltY.toFixed(4)),
          tiltZ: Number(motionFrame.tiltZ.toFixed(4)),
          energy: Number(motionFrame.energy.toFixed(3)),
          speed: Number(motionFrame.speed.toFixed(4)),
          extent: Number(motionFrame.extent.toFixed(4)),
          behavior: motionFrame.behavior,
          kind: motionFrame.kind,
          dwelling: motionFrame.dwelling,
          dynamics: {
            agitation: Number(motionFrame.dynamics.agitation.toFixed(3)),
            cohesion: Number(motionFrame.dynamics.cohesion.toFixed(3)),
            outflow: Number(motionFrame.dynamics.outflow.toFixed(3)),
            pulse: Number(motionFrame.dynamics.pulse.toFixed(3))
          }
        }
      };
    }
  };
}

module.exports = {
  createModaCore,
  buildLifeform,
  buildCells,
  buildFibers,
  buildDust,
  animateCell,
  STATES
};
