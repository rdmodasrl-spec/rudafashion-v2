/**
 * ModaUI 单一渲染舞台：整个聊天界面只创建一个 canvas / WebGL 上下文，
 * 通过移动宿主元素在「首页大核心」和「回复内 32px 小核心」之间连续转换。
 *
 * 关键事实：
 * - 只有宿主 div 被移动（appendChild），canvas 元素本身从不销毁，WebGL 上下文与粒子数据保持不变。
 * - 移动期间宿主是 `position: fixed` 并用 transform 缩放，CSS 尺寸不变 → 不触发逐帧 resize。
 * - 落位后宿主改为填充锚点（100%），由 ResizeObserver 触发一次真实 resize，得到原生像素渲染。
 *
 * 见 docs/engineering/modules/modaui-core.md 第 15 节。
 */

import {
  modaCoreParticleCountForSize,
  pickModaCoreAnchorKind,
  stepModaCoreTravel,
  type ModaCoreAnchorKind,
  type ModaCoreTravelRect
} from './modaCoreStageMath';

export type ModaCoreStageHandle = {
  /** 舞台实例标识：锚点用它标注归属，舞台据此在登记丢失时从 DOM 自愈。 */
  id: string;
  /** 唯一宿主元素；React 通过 portal 把 ModaUICore 渲染到这里。 */
  host: HTMLDivElement;
  registerAnchor: (kind: ModaCoreAnchorKind, el: HTMLElement) => () => void;
  /** 粒子预算变化时回调（宿主尺寸变了要重建顶点数据）。 */
  setDensityHandler: (handler: ((count: number) => void) | null) => void;
  getDensity: () => number;
  /** 当前承载核心的锚点类型，仅供验收探针使用。 */
  getActiveKind: () => ModaCoreAnchorKind | null;
  /**
   * 呈现模式：`hero` 锚点是自由生命舞台，`reply` 锚点是对话内嵌头像。
   * 运动控制器据此限制宏观换位，但位姿与渲染器不重置（同一画布连续转换）。
   */
  getPresentationMode: () => ModaCorePresentationMode;
  subscribePresentationMode: (listener: (mode: ModaCorePresentationMode) => void) => () => void;
  dispose: () => void;
};

export type ModaCorePresentationMode = 'stage' | 'inline';

const MAX_TRAVEL_BASE = 420;

/**
 * 舞台事件日志：只保留最近 120 条，挂在 window 上供真实页面验收取证。
 * 不含用户内容，只记录锚点注册/落位/移动与销毁。
 */
const log = (event: string, detail = '') => {
  if (typeof window === 'undefined') return;
  const store = window as unknown as { __modauiStageLog?: Array<{ t: number; event: string; detail: string }> };
  const entries = store.__modauiStageLog || (store.__modauiStageLog = []);
  entries.push({ t: Math.round(performance.now()), event, detail });
  if (entries.length > 120) entries.splice(0, entries.length - 120);
};

const readRect = (el: HTMLElement): ModaCoreTravelRect => {
  const box = el.getBoundingClientRect();
  return {
    x: box.left,
    y: box.top,
    size: Math.max(1, Math.min(box.width || 1, box.height || 1))
  };
};

export function createModaCoreStage(): ModaCoreStageHandle {
  const stageId = Math.random().toString(36).slice(2, 10);
  const host = document.createElement('div');
  host.setAttribute('data-modaui-stage', '');
  host.setAttribute('data-modaui-stage-id', stageId);
  host.setAttribute('aria-hidden', 'true');
  host.style.position = 'fixed';
  host.style.left = '0px';
  host.style.top = '0px';
  host.style.pointerEvents = 'none';
  host.style.zIndex = '45';
  host.style.transformOrigin = '0 0';
  host.style.willChange = 'transform';
  host.style.opacity = '0';

  const anchors = new Map<ModaCoreAnchorKind, HTMLElement>();
  const compactViewport = typeof window !== 'undefined'
    && Math.min(window.innerWidth, window.innerHeight) < 480;

  let activeKind: ModaCoreAnchorKind | null = null;
  let presentationMode: ModaCorePresentationMode = 'stage';
  const modeListeners = new Set<(mode: ModaCorePresentationMode) => void>();
  const setPresentationMode = (mode: ModaCorePresentationMode) => {
    if (mode === presentationMode) return;
    presentationMode = mode;
    log('mode', mode);
    modeListeners.forEach(listener => listener(mode));
  };
  let activeEl: HTMLElement | null = null;
  let placedRect: ModaCoreTravelRect | null = null;
  let travelTarget: HTMLElement | null = null;
  let travelBase = 0;
  let travelLast = 0;
  let rafId = 0;
  let density = 0;
  let densityHandler: ((count: number) => void) | null = null;
  let disposed = false;
  let refreshQueued = false;

  const applyDensity = (size: number) => {
    const next = modaCoreParticleCountForSize(size, compactViewport);
    if (next === density) return;
    density = next;
    host.dataset.modauiStageCount = String(next);
    densityHandler?.(next);
  };

  const cancelTravel = () => {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = 0;
    travelTarget = null;
  };

  /** 落位：宿主填满锚点，缩放归零，粒子预算按锚点真实尺寸计算。 */
  const attachTo = (el: HTMLElement, size: number) => {
    if (host.parentElement !== el) el.appendChild(host);
    log('attach', `${el.dataset.modauiAnchor || ''}:${Math.round(size)}`);
    host.dataset.modauiStageKind = el.dataset.modauiAnchor || '';
    host.style.position = 'absolute';
    host.style.left = '0px';
    host.style.top = '0px';
    host.style.width = '100%';
    host.style.height = '100%';
    host.style.transform = 'none';
    host.style.opacity = '1';
    placedRect = readRect(el);
    applyDensity(size || placedRect.size);
  };

  const applyTravel = (rect: ModaCoreTravelRect, base: number) => {
    host.style.position = 'fixed';
    host.style.left = '0px';
    host.style.top = '0px';
    host.style.width = `${base}px`;
    host.style.height = `${base}px`;
    host.style.transform = `translate3d(${rect.x.toFixed(2)}px, ${rect.y.toFixed(2)}px, 0) scale(${(rect.size / base).toFixed(4)})`;
    host.style.opacity = '1';
    host.dataset.modauiStageSize = rect.size.toFixed(1);
  };

  const travelFrame = (now: number) => {
    rafId = 0;
    if (disposed) return;
    const target = travelTarget;
    if (!target) return;
    if (!target.isConnected) {
      travelTarget = null;
      scheduleRefresh();
      return;
    }
    const dt = travelLast ? (now - travelLast) / 1000 : 0.016;
    travelLast = now;
    const goal = readRect(target);
    const { rect, settled } = stepModaCoreTravel(placedRect ?? goal, goal, dt);
    placedRect = rect;
    if (settled) {
      travelTarget = null;
      attachTo(target, goal.size);
      return;
    }
    applyTravel(rect, travelBase);
    rafId = requestAnimationFrame(travelFrame);
  };

  const startTravel = (el: HTMLElement) => {
    cancelTravel();
    const goal = readRect(el);
    // 首次出现：直接落位，不做假动画。
    if (!placedRect) {
      attachTo(el, goal.size);
      return;
    }
    // 移动期间宿主放在 body 上：fixed 定位不受滚动容器裁剪，也不参与任何布局。
    if (host.parentElement !== document.body) document.body.appendChild(host);
    travelTarget = el;
    travelBase = Math.min(MAX_TRAVEL_BASE, Math.max(48, Math.max(placedRect.size, goal.size)));
    travelLast = 0;
    applyTravel(placedRect, travelBase);
    rafId = requestAnimationFrame(travelFrame);
  };

  function scheduleRefresh() {
    if (refreshQueued || disposed) return;
    refreshQueued = true;
    // 同一次提交里旧锚点先卸载、新锚点后挂载：等所有 effect 跑完再决定目标，避免中间态闪烁。
    queueMicrotask(() => {
      refreshQueued = false;
      refresh();
    });
  }

  const refresh = () => {
    if (disposed) {
      log('refresh-skip-disposed');
      return;
    }
    let kind = pickModaCoreAnchorKind(anchors.keys());
    log('refresh', `${kind || 'none'}:${anchors.size}`);
    // 自愈：React 重建消息行、或失败的请求回滚时，登记可能与真实 DOM 脱节。
    // 这里以本舞台自己的锚点（owner 标记）为准，重新认领仍在文档里的锚点。
    const adopt = (wanted: ModaCoreAnchorKind) => {
      const mapped = anchors.get(wanted);
      if (mapped && mapped.isConnected) return mapped;
      const candidate = Array.from(document.querySelectorAll<HTMLElement>(`[data-modaui-anchor="${wanted}"]`))
        .find(node => node.dataset.modauiStageOwner === stageId);
      if (candidate) {
        anchors.set(wanted, candidate);
        log('adopt', `${wanted}:${candidate.dataset.modauiAnchorId || ''}`);
        return candidate;
      }
      return null;
    };
    if (!kind) kind = adopt('reply') ? 'reply' : (adopt('hero') ? 'hero' : null);
    if (!kind) {
      cancelTravel();
      activeKind = null;
      activeEl = null;
      placedRect = null;
      setPresentationMode('stage');
      // 没有锚点就把宿主移出文档：IntersectionObserver 会停掉渲染循环，不空转 GPU。
      host.remove();
      host.style.opacity = '0';
      return;
    }
    const el = adopt(kind);
    if (!el) return;
    if (el === activeEl && !travelTarget) {
      applyDensity(readRect(el).size);
      return;
    }
    activeKind = kind;
    activeEl = el;
    // 呈现模式与锚点同步切换：回合内 32px 头像不再做宏观换位，但内部生命运动继续。
    setPresentationMode(kind === 'reply' ? 'inline' : 'stage');
    startTravel(el);
  };

  const registerAnchor = (kind: ModaCoreAnchorKind, el: HTMLElement) => {
    anchors.set(kind, el);
    log('register', `${kind}:${el.dataset.modauiAnchorId || ''}`);
    scheduleRefresh();
    return () => {
      if (anchors.get(kind) !== el) return;
      anchors.delete(kind);
      log('unregister', `${kind}:${el.dataset.modauiAnchorId || ''}`);
      // 过渡瞬间可能同时存在两个同类型锚点（思考行 → 回复行、失败回滚时重建行）：
      // 立刻认领仍在文档里的那个，避免核心因为一次登记删除而消失。
      const sibling = Array.from(document.querySelectorAll<HTMLElement>(`[data-modaui-anchor="${kind}"]`))
        .find(node => node !== el && node.isConnected && node.dataset.modauiStageOwner === stageId);
      if (sibling) {
        anchors.set(kind, sibling);
        log('sibling', `${kind}:${sibling.dataset.modauiAnchorId || ''}`);
      }
      scheduleRefresh();
    };
  };

  const dispose = () => {
    if (disposed) return;
    disposed = true;
    log('dispose');
    cancelTravel();
    anchors.clear();
    modeListeners.clear();
    densityHandler = null;
    host.remove();
  };

  return {
    id: stageId,
    host,
    registerAnchor,
    setDensityHandler: handler => {
      densityHandler = handler;
      if (handler && density) handler(density);
    },
    getDensity: () => density,
    getActiveKind: () => activeKind,
    getPresentationMode: () => presentationMode,
    subscribePresentationMode: listener => {
      modeListeners.add(listener);
      return () => {
        modeListeners.delete(listener);
      };
    },
    dispose
  };
}
