/**
 * ModaUI 粒子核心「对话内嵌」阶段的纯逻辑。
 *
 * 见 docs/engineering/modules/modaui-core.md 第 15 节。
 * 这里只放可确定性测试的纯函数：锚点优先级、旅行插值、粒子预算。
 * 不触碰 DOM、WebGL、React，也不含任何定时器。
 */

export type ModaCoreAnchorKind = 'hero' | 'reply';

export type ModaCoreTravelRect = {
  /** 视口坐标（与 getBoundingClientRect 一致）。 */
  x: number;
  y: number;
  /** 显示边长（px），粒子核心是正方形。 */
  size: number;
};

export const MODA_CORE_DESKTOP_MAX_PARTICLES = 16000;
export const MODA_CORE_MOBILE_MAX_PARTICLES = 9000;
/** 32px 左右的小核心也要有足够粒子维持可辨认的头型轮廓。 */
export const MODA_CORE_MIN_PARTICLES = 1400;

/**
 * 粒子预算按「显示边长」计算，而不是按固定画布面积。
 *
 * 同一个核心从首页大尺寸移动到回复内 32px 时，点精灵的屏幕尺寸会被压到 1px，
 * 沿用大核心的一万六千个粒子会糊成一团；这里按显示面积给预算，保持可辨认的轮廓。
 */
export function modaCoreParticleCountForSize(size: number, compact: boolean): number {
  const safeSize = Number.isFinite(size) && size > 0 ? size : 240;
  const area = safeSize * safeSize;
  const max = compact ? MODA_CORE_MOBILE_MAX_PARTICLES : MODA_CORE_DESKTOP_MAX_PARTICLES;
  const perPixel = compact ? 0.62 : 0.9;
  const min = compact ? 900 : MODA_CORE_MIN_PARTICLES;
  return Math.round(Math.min(max, Math.max(min, area * perPixel)));
}

/**
 * 同一时间只有一个锚点承载粒子核心：有回复锚点时优先回复，否则回首页大核心。
 */
export function pickModaCoreAnchorKind(kinds: Iterable<ModaCoreAnchorKind>): ModaCoreAnchorKind | null {
  let hero = false;
  for (const kind of kinds) {
    if (kind === 'reply') return 'reply';
    if (kind === 'hero') hero = true;
  }
  return hero ? 'hero' : null;
}

/** 阻尼系数：约 0.35s 完成 95% 行程，落位时不会再回弹。 */
const TRAVEL_RATE = 8.5;
const TRAVEL_SNAP_PX = 0.75;

/**
 * 朝目标矩形推进一帧。位移动画由真实帧时间驱动，可在测试中注入 dt。
 */
export function stepModaCoreTravel(
  current: ModaCoreTravelRect,
  target: ModaCoreTravelRect,
  dtSeconds: number
): { rect: ModaCoreTravelRect; settled: boolean } {
  const dt = Math.max(0, Math.min(0.1, Number.isFinite(dtSeconds) ? dtSeconds : 0));
  const k = 1 - Math.exp(-dt * TRAVEL_RATE);
  const rect: ModaCoreTravelRect = {
    x: current.x + (target.x - current.x) * k,
    y: current.y + (target.y - current.y) * k,
    size: current.size + (target.size - current.size) * k
  };
  const settled = Math.abs(rect.x - target.x) < TRAVEL_SNAP_PX
    && Math.abs(rect.y - target.y) < TRAVEL_SNAP_PX
    && Math.abs(rect.size - target.size) < TRAVEL_SNAP_PX;
  return { rect: settled ? { ...target } : rect, settled };
}
