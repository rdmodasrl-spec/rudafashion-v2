/**
 * RUDA Premium 3D 基础能力层。
 *
 * 设计原则（对应工程规则：不得用大型 3D 场景拖慢电商站点）：
 * - three.js 只在组件真正进入视口时才动态 import，主包不背 3D 依赖。
 * - 统一 DPR 上限、离屏暂停、页面隐藏暂停、帧率降级。
 * - WebGL 不可用 / 用户要求减少动态效果时，一律回落到静态海报，不报错、不空屏。
 */
import { useEffect, useRef, useState } from 'react';

export type Premium3DQuality = 'low' | 'high';

export type Premium3DEnvironment = {
  /** 页面级开关：商家在模板配置里关掉后，所有 3D 组件退化为静态图 */
  enabled: boolean;
  quality: Premium3DQuality;
  /** 系统 prefers-reduced-motion: reduce */
  reduceMotion: boolean;
};

const DEFAULT_ENV: Premium3DEnvironment = { enabled: true, quality: 'high', reduceMotion: false };

export function detectWebGL(): boolean {
  if (typeof document === 'undefined') return false;
  try {
    const canvas = document.createElement('canvas');
    return Boolean(
      canvas.getContext('webgl2')
      || canvas.getContext('webgl')
      || canvas.getContext('experimental-webgl')
    );
  } catch {
    return false;
  }
}

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined;
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(query.matches);
    const onChange = (event: MediaQueryListEvent) => setReduced(event.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);
  return reduced;
}

/** 元素是否进入视口；离屏时停止渲染循环，避免多个 3D 区块同时吃 GPU。 */
export function useInView<T extends Element>(rootMargin = '160px') {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const node = ref.current;
    if (!node || typeof IntersectionObserver === 'undefined') {
      setInView(true);
      return undefined;
    }
    const observer = new IntersectionObserver(
      entries => setInView(entries.some(entry => entry.isIntersecting)),
      { rootMargin, threshold: 0.01 }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [rootMargin]);
  return [ref, inView] as const;
}

export function usePremium3DEnvironment(override?: Partial<Premium3DEnvironment>): Premium3DEnvironment {
  const reduceMotion = useReducedMotion();
  const [webgl, setWebgl] = useState<boolean | null>(null);
  useEffect(() => { setWebgl(detectWebGL()); }, []);
  const env = { ...DEFAULT_ENV, reduceMotion, ...override };
  // webgl === null 表示还没探测完，此时按可用处理，避免首帧闪一次降级层
  if (webgl === false) return { ...env, enabled: false };
  return env;
}

/** 渲染循环：自带页面可见性暂停与自适应降帧，返回销毁函数。 */
export function startRenderLoop(
  render: (deltaSeconds: number, elapsedSeconds: number) => void,
  options: { fpsCap?: number; onFps?: (fps: number) => void } = {}
): () => void {
  const fpsCap = options.fpsCap ?? 60;
  const minInterval = 1000 / fpsCap;
  let frame = 0;
  let last = 0;
  let elapsed = 0;
  let stopped = false;
  let samples = 0;
  let sampleStart = 0;

  const tick = (now: number) => {
    if (stopped) return;
    frame = requestAnimationFrame(tick);
    if (document.hidden) return;
    const delta = last ? now - last : 16.7;
    if (delta < minInterval - 1) return;
    last = now;
    elapsed += delta / 1000;
    render(Math.min(delta / 1000, 0.05), elapsed);
    samples += 1;
    if (!sampleStart) sampleStart = now;
    else if (now - sampleStart > 1000) {
      options.onFps?.((samples * 1000) / (now - sampleStart));
      samples = 0;
      sampleStart = now;
    }
  };
  frame = requestAnimationFrame(tick);
  return () => { stopped = true; cancelAnimationFrame(frame); };
}

/** 纹理尺寸上限，避免 4K 商品图直接进显存。 */
export function textureSizeLimit(quality: Premium3DQuality): number {
  return quality === 'low' ? 1024 : 2048;
}

export function resolveDevicePixelRatio(quality: Premium3DQuality): number {
  const dpr = typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1;
  return Math.min(dpr, quality === 'low' ? 1 : 2);
}

/** 统一 RUDA 空间色，3D 场景与页面底色保持一致，避免出现「黑盒子」。 */
export const RUDA_3D_PALETTE = {
  paper: '#fbfaf8',
  paperDeep: '#f2eee8',
  ink: '#171717',
  inkSoft: '#4a4a4a',
  line: '#dcd8d2',
  leather: '#7a5c3e'
} as const;

/**
 * 纹理 URL 候选：先试同源路径，再试原始绝对地址。
 *
 * 页面在 modaui.com / ruda.fashion 上时，商品图与页面同源，可直接读纹理；
 * 隔离预览环境（127.0.0.1:PORT）域名不同，因此先按同源相对路径试一次，
 * 失败再退回绝对地址（跨源图由 images 主机的 CORS 头支持）。
 */
const APP_EQUIVALENT_HOSTS = new Set([
  'modaui.com',
  'www.modaui.com',
  'ruda.fashion',
  'www.ruda.fashion',
  'b2b.ruda.fashion'
]);

export function textureUrlCandidates(url: string): string[] {
  if (typeof window === 'undefined') return [url];
  try {
    const parsed = new URL(url, window.location.href);
    if (parsed.host === window.location.host) return [`${parsed.pathname}${parsed.search}`];
    if (APP_EQUIVALENT_HOSTS.has(parsed.host)) {
      return [`${parsed.pathname}${parsed.search}`, parsed.toString()];
    }
    return [parsed.toString()];
  } catch {
    return [url];
  }
}

/**
 * 按候选地址依次尝试加载纹理，任一成功即返回，全部失败返回 null。
 * three 由调用方注入，避免本模块静态引入 3D 运行时。
 */
export async function loadTextureWithFallback(
  THREE_NS: typeof import('three'),
  url: string,
  configure?: (texture: import('three').Texture) => void
): Promise<import('three').Texture | null> {
  for (const candidate of textureUrlCandidates(url)) {
    const texture = await new Promise<import('three').Texture | null>(resolve => {
      const loader = new THREE_NS.TextureLoader();
      loader.setCrossOrigin('anonymous');
      loader.load(candidate, loaded => {
        loaded.colorSpace = THREE_NS.SRGBColorSpace;
        configure?.(loaded);
        resolve(loaded);
      }, undefined, () => resolve(null));
    });
    if (texture) return texture;
  }
  return null;
}

/**
 * 媒体 URL 归一化：把「与本应用等价的域名」绝对地址改成相对路径。
 *
 * 目的：隔离预览环境（127.0.0.1:PORT）与正式域名不同，绝对地址会被当作跨源请求，
 * 部分网络策略下会直接失败；改成相对路径后由当前应用自己提供同一份资源。
 * 生产环境页面就在 modaui.com / ruda.fashion 上，这个转换是等价的 no-op。
 */
export function normalizeMediaUrl(url: string): string {
  if (!url || typeof window === 'undefined') return url;
  try {
    const parsed = new URL(url, window.location.href);
    if (parsed.host === window.location.host || APP_EQUIVALENT_HOSTS.has(parsed.host)) {
      return `${parsed.pathname}${parsed.search}`;
    }
    return parsed.toString();
  } catch {
    return url;
  }
}
