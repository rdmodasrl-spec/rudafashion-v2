/**
 * ModaUI 数字生命 V7：神经生命体几何与运动函数。
 *
 * 规范见 docs/engineering/modules/modaui-core.md 第 0 节与第 16 节。
 *
 * 硬性约束：
 * - 只有细胞、神经纤维、脉冲与内部尘埃；没有头像、五官、身体或底座。
 * - 全部坐标由纯函数生成，固定种子保证三端一致、可确定性测试。
 * - 不读写 DOM / WebGL / React，不加载任何图片或纹理。
 *
 * `animateNeuralCell()` 是细胞运动的唯一参考实现：GLSL（coreShaders.ts）与
 * 小程序 Canvas 2D（merchant-miniprogram/utils/moda-core.js）必须逐项镜像同一组公式，
 * 否则三端会出现细胞位置与纤维端点不一致。
 */

export type Vec3 = [number, number, number];

export type NeuralLifeformLayout = {
  cells: number;
  dust: number;
  pulses: number;
};

export type NeuralCellData = {
  count: number;
  /** 3 × count：细胞基点（已含内外层半径）。 */
  base: Float32Array;
  /** 4 × count：x 相位，y 尺寸抖动，z 亮度抖动，w 备用。 */
  seeds: Float32Array;
  /** count：细胞世界尺寸。 */
  sizes: Float32Array;
  /** count：细胞浓度权重。 */
  tones: Float32Array;
  /** count：基点半径，用于差速旋转与内外层判定。 */
  radii: Float32Array;
};

export type NeuralFiberData = {
  /** 神经连接条数。 */
  edgeCount: number;
  /** 顶点数 = 2 × edgeCount（每顶点带两端点数据，便于用 stride 复用同一缓冲）。 */
  vertexCount: number;
  baseA: Float32Array;
  seedA: Float32Array;
  baseB: Float32Array;
  seedB: Float32Array;
  /** 脉冲沿该纤维传播的相位 0–1。 */
  phases: Float32Array;
  tones: Float32Array;
};

export type NeuralDustData = {
  count: number;
  base: Float32Array;
  seeds: Float32Array;
  sizes: Float32Array;
  tones: Float32Array;
};

export type NeuralLifeformData = {
  layout: NeuralLifeformLayout;
  cells: NeuralCellData;
  fibers: NeuralFiberData;
  dust: NeuralDustData;
};

/** 单帧运动输入。字段与着色器 uniform 一一对应。 */
export type NeuralActivity = {
  /** 已推进的时间（秒）。 */
  time: number;
  /** 0–1 整体能量（对话生命通道 uEnergy）。 */
  energy: number;
  /** 思考聚拢强度（thinking 权重 + 输入聚拢的合成值）。 */
  contraction: number;
  /** 成功舒展强度（success 权重）。 */
  expansion: number;
  /** 真实麦克风 RMS 0–1。 */
  level: number;
  /** 真实语音 boundary 脉冲 0–1。 */
  pulse: number;
  /** 点击冲击 0–1，指数衰减。 */
  burst: number;
  /** 失败强度（error 权重）。 */
  error: number;
  /** 指针归一化坐标 ±1.25（已含 uGaze 衰减）。 */
  gazeX: number;
  gazeY: number;
};

export const NEURAL_MAX_CELLS = 460;
export const NEURAL_MIN_CELLS = 96;
/** 每个细胞保留的最近邻数量；去重后形成无向连接图。 */
export const NEURAL_NEIGHBOURS = 3;
export const NEURAL_SEED = 20261027;
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

export function createLifeformRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * 把既有粒子预算换算成生命体结构数量。
 *
 * 预算来自 `modaCoreParticleCountForSize()`（桌面大核心 16000、手机 9000、32px 小核心 1400）。
 * 这里只用它的平方根决定细胞密度：细胞数量必须是「看起来像一团细胞」的数量级，
 * 而不是把一万六千个点原样铺在球面上。
 */
export function neuralLifeformLayoutForBudget(budget: number): NeuralLifeformLayout {
  const safe = Number.isFinite(budget) && budget > 0 ? budget : 16000;
  const cells = Math.round(Math.min(NEURAL_MAX_CELLS, Math.max(NEURAL_MIN_CELLS, Math.sqrt(safe) * 3.64)));
  const dust = Math.round(Math.min(2600, Math.max(220, safe * 0.16)));
  const pulses = Math.round(Math.min(220, Math.max(36, cells * 0.45)));
  return { cells, dust, pulses };
}

/**
 * 细胞基点：Fibonacci 球面分布，约 78% 落在 0.80–0.98 的外壳，其余落在 0.32–0.70 的内层。
 * 内层细胞让球体有真实体积与前后遮挡，而不是一层空心壳。
 */
export function buildNeuralCells(count: number, seed = NEURAL_SEED): NeuralCellData {
  const total = Math.max(1, Math.round(count));
  const random = createLifeformRandom(seed);
  const base = new Float32Array(total * 3);
  const seeds = new Float32Array(total * 4);
  const sizes = new Float32Array(total);
  const tones = new Float32Array(total);
  const radii = new Float32Array(total);

  for (let index = 0; index < total; index += 1) {
    const y = 1 - (index / Math.max(1, total - 1)) * 2;
    const ring = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = GOLDEN_ANGLE * index;
    // 内层细胞按固定节奏穿插，避免全部挤在球面同一侧。
    const inner = index % 9 < 2;
    const radial = inner ? 0.32 + random() * 0.38 : 0.8 + random() * 0.18;
    const jitter = 0.97 + random() * 0.06;

    base[index * 3] = Math.cos(theta) * ring * radial * jitter;
    base[index * 3 + 1] = y * radial * jitter;
    base[index * 3 + 2] = Math.sin(theta) * ring * radial * jitter;
    seeds[index * 4] = random();
    seeds[index * 4 + 1] = random();
    seeds[index * 4 + 2] = random();
    seeds[index * 4 + 3] = random();
    sizes[index] = inner ? 0.028 + random() * 0.018 : 0.036 + random() * 0.032;
    tones[index] = inner ? 0.62 + random() * 0.16 : 0.86 + random() * 0.12;
    radii[index] = radial;
  }

  return { count: total, base, seeds, sizes, tones, radii };
}

/**
 * 神经连接：按基点空间距离取最近邻，去重后得到无向边。
 * 端点数据在每个顶点上重复一份，渲染端用 stride 让脉冲通道复用同一缓冲。
 */
export function buildNeuralFibers(cells: NeuralCellData, neighbours = NEURAL_NEIGHBOURS): NeuralFiberData {
  const count = cells.count;
  const seen = new Set<number>();
  const edges: Array<[number, number]> = [];
  const k = Math.max(1, Math.min(neighbours, Math.max(1, count - 1)));

  for (let i = 0; i < count; i += 1) {
    const nearestIndex = new Int32Array(k).fill(-1);
    const nearestDistance = new Float64Array(k).fill(Number.POSITIVE_INFINITY);
    const ax = cells.base[i * 3];
    const ay = cells.base[i * 3 + 1];
    const az = cells.base[i * 3 + 2];

    for (let j = 0; j < count; j += 1) {
      if (i === j) continue;
      const dx = ax - cells.base[j * 3];
      const dy = ay - cells.base[j * 3 + 1];
      const dz = az - cells.base[j * 3 + 2];
      const distance = dx * dx + dy * dy + dz * dz;
      // 只维护前 k 个最近邻，避免为每个细胞分配整个邻居数组。
      if (distance >= nearestDistance[k - 1]) continue;
      let slot = k - 1;
      while (slot > 0 && distance < nearestDistance[slot - 1]) {
        nearestDistance[slot] = nearestDistance[slot - 1];
        nearestIndex[slot] = nearestIndex[slot - 1];
        slot -= 1;
      }
      nearestDistance[slot] = distance;
      nearestIndex[slot] = j;
    }

    for (let slot = 0; slot < k; slot += 1) {
      const j = nearestIndex[slot];
      if (j < 0) continue;
      const a = Math.min(i, j);
      const b = Math.max(i, j);
      // 无向边去重：同一对细胞只保留一条纤维。
      const key = a * count + b;
      if (seen.has(key)) continue;
      seen.add(key);
      edges.push([a, b]);
    }
  }

  const edgeCount = edges.length;
  const vertexCount = edgeCount * 2;
  const baseA = new Float32Array(vertexCount * 3);
  const seedA = new Float32Array(vertexCount * 4);
  const baseB = new Float32Array(vertexCount * 3);
  const seedB = new Float32Array(vertexCount * 4);
  const phases = new Float32Array(vertexCount);
  const tones = new Float32Array(vertexCount);
  const random = createLifeformRandom(NEURAL_SEED + 71);

  for (let edge = 0; edge < edgeCount; edge += 1) {
    const [a, b] = edges[edge];
    const phase = random();
    const dx = cells.base[a * 3] - cells.base[b * 3];
    const dy = cells.base[a * 3 + 1] - cells.base[b * 3 + 1];
    const dz = cells.base[a * 3 + 2] - cells.base[b * 3 + 2];
    const length = Math.sqrt(dx * dx + dy * dy + dz * dz);
    // 纤维亮度随长度轻微变化：短连接更亮、长连接更淡，避免均匀网格感。
    const tone = Math.max(0.45, Math.min(1, 1.05 - length * 0.55));

    for (let side = 0; side < 2; side += 1) {
      const vertex = edge * 2 + side;
      baseA[vertex * 3] = cells.base[a * 3];
      baseA[vertex * 3 + 1] = cells.base[a * 3 + 1];
      baseA[vertex * 3 + 2] = cells.base[a * 3 + 2];
      seedA[vertex * 4] = cells.seeds[a * 4];
      seedA[vertex * 4 + 1] = cells.seeds[a * 4 + 1];
      seedA[vertex * 4 + 2] = cells.seeds[a * 4 + 2];
      seedA[vertex * 4 + 3] = cells.seeds[a * 4 + 3];
      baseB[vertex * 3] = cells.base[b * 3];
      baseB[vertex * 3 + 1] = cells.base[b * 3 + 1];
      baseB[vertex * 3 + 2] = cells.base[b * 3 + 2];
      seedB[vertex * 4] = cells.seeds[b * 4];
      seedB[vertex * 4 + 1] = cells.seeds[b * 4 + 1];
      seedB[vertex * 4 + 2] = cells.seeds[b * 4 + 2];
      seedB[vertex * 4 + 3] = cells.seeds[b * 4 + 3];
      phases[vertex] = phase;
      tones[vertex] = tone;
    }
  }

  return { edgeCount, vertexCount, baseA, seedA, baseB, seedB, phases, tones };
}

/** 球体内部的漂浮尘埃：半径按体积均匀分布，提供纵深。 */
export function buildNeuralDust(count: number, seed = NEURAL_SEED + 31): NeuralDustData {
  const total = Math.max(0, Math.round(count));
  const random = createLifeformRandom(seed);
  const base = new Float32Array(total * 3);
  const seeds = new Float32Array(total * 4);
  const sizes = new Float32Array(total);
  const tones = new Float32Array(total);

  for (let index = 0; index < total; index += 1) {
    const u = random() * 2 - 1;
    const angle = random() * Math.PI * 2;
    const ring = Math.sqrt(Math.max(0, 1 - u * u));
    const radius = Math.cbrt(random()) * 0.92;
    base[index * 3] = Math.cos(angle) * ring * radius;
    base[index * 3 + 1] = u * radius;
    base[index * 3 + 2] = Math.sin(angle) * ring * radius;
    seeds[index * 4] = random();
    seeds[index * 4 + 1] = random();
    seeds[index * 4 + 2] = random();
    seeds[index * 4 + 3] = random();
    sizes[index] = 0.01 + random() * 0.01;
    tones[index] = 0.42 + random() * 0.2;
  }

  return { count: total, base, seeds, sizes, tones };
}

export function buildNeuralLifeform(budget: number, seed = NEURAL_SEED): NeuralLifeformData {
  const layout = neuralLifeformLayoutForBudget(budget);
  const cells = buildNeuralCells(layout.cells, seed);
  return {
    layout,
    cells,
    fibers: buildNeuralFibers(cells),
    dust: buildNeuralDust(layout.dust, seed + 31)
  };
}

/**
 * 细胞运动参考实现。
 *
 * 必须与 coreShaders.ts 的 `lifeformPoint()`、以及小程序 `moda-core.js` 的
 * `animateCell()` 保持同一组系数；任何一侧调整都要同步另外两侧。
 */
export function animateNeuralCell(base: Vec3 | readonly number[], phase: number, activity: NeuralActivity): Vec3 {
  const bx = base[0];
  const by = base[1];
  const bz = base[2];
  const radius = Math.hypot(bx, by, bz) || 1;

  // 整体呼吸 + 细胞级起伏。
  const breath = 1 + 0.045 * Math.sin(activity.time * 1.15) + 0.02 * Math.sin(activity.time * 0.47);
  const wave = 0.03 * Math.sin(activity.time * 1.25 + phase) + 0.02 * Math.sin(activity.time * 0.63 + phase * 1.7);
  const scale = breath + wave + activity.energy * 0.03 + activity.burst * 0.09
    - activity.contraction * 0.12 + activity.expansion * 0.05 - activity.error * 0.05;

  let x = bx * scale;
  let z = bz * scale;
  const y = by * scale;

  // 差速旋转：外层转得快、内层转得慢，细胞之间因此持续发生相对位移。
  const swirl = (0.16 + 0.1 * radius) * Math.sin(activity.time * 0.37);
  const swirlCos = Math.cos(swirl);
  const swirlSin = Math.sin(swirl);
  const swirledX = x * swirlCos + z * swirlSin;
  const swirledZ = -x * swirlSin + z * swirlCos;
  x = swirledX;
  z = swirledZ;

  const nx = bx / radius;
  const ny = by / radius;
  const nz = bz / radius;

  // 聆听波纹（真实麦克风 RMS）、语音脉冲（真实 boundary）、指针局部鼓起。
  const ripple = activity.level * (0.012 + activity.level * 0.07)
    * (0.5 + 0.5 * Math.sin(activity.time * 3.1 - radius * 6 + phase));
  const speak = activity.pulse * 0.03 * (0.5 + 0.5 * Math.sin(activity.time * 9 + phase * 2));
  const pointerX = activity.gazeX;
  const pointerY = -activity.gazeY;
  const pointerZ = 0.55;
  const pointerLength = Math.hypot(pointerX, pointerY, pointerZ) || 1;
  const pointerDot = (nx * pointerX + ny * pointerY + nz * pointerZ) / pointerLength;
  const bulge = Math.max(0, pointerDot) * 0.032 * (1 - Math.min(1, activity.contraction) * 0.5);
  const push = ripple + speak + bulge;
  x += nx * push;
  const pushedY = y + ny * push;
  z += nz * push;

  // 姿态视差：Rx(pitch) · Ry(yaw)，与着色器矩阵顺序一致。
  const yaw = activity.gazeX * 0.46 + 0.05 * Math.sin(activity.time * 0.23);
  const pitch = -activity.gazeY * 0.26 - 0.02 + 0.02 * Math.sin(activity.time * 0.31);
  const yawCos = Math.cos(yaw);
  const yawSin = Math.sin(yaw);
  const yawedX = x * yawCos + z * yawSin;
  const yawedZ = -x * yawSin + z * yawCos;
  const pitchCos = Math.cos(pitch);
  const pitchSin = Math.sin(pitch);
  const pitchedY = pushedY * pitchCos - yawedZ * pitchSin;
  const pitchedZ = pushedY * pitchSin + yawedZ * pitchCos;

  return [yawedX, pitchedY, pitchedZ];
}

/**
 * 点击命中判定：指针落在生命体外接圆内才算命中。
 * 画布本身 `pointer-events: none`，因此用矩形换算而不是 DOM 事件目标。
 */
export function isInsideLifeform(
  rect: { left: number; top: number; width: number; height: number },
  clientX: number,
  clientY: number
): boolean {
  if (!rect.width || !rect.height) return false;
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const dx = clientX - cx;
  const dy = clientY - cy;
  const radius = Math.min(rect.width, rect.height) * 0.56;
  return dx * dx + dy * dy <= radius * radius;
}

