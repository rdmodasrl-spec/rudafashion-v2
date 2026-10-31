/**
 * Premium 3D 场景外壳：负责画布生命周期、加载态、降级态与错误兜底。
 *
 * 所有 3D 组件都通过它工作，保证：
 * - three.js 动态加载，不进主包；
 * - 离屏 / 页面隐藏 / 减少动态效果时停止渲染；
 * - WebGL 不可用或初始化失败时显示静态海报，而不是空白或报错。
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  resolveDevicePixelRatio,
  startRenderLoop,
  useInView,
  usePremium3DEnvironment,
  type Premium3DEnvironment,
  type Premium3DQuality
} from './capability';

export type SceneHandle = {
  /** 每帧回调，dt/t 单位为秒 */
  update?: (deltaSeconds: number, elapsedSeconds: number) => void;
  /** 卸载时释放几何体、材质、纹理 */
  dispose?: () => void;
  /** 是否请求持续渲染（默认 true）；静态场景可返回 false 只渲染一帧 */
  animate?: boolean;
};

export type SceneSetupContext = {
  THREE: typeof import('three');
  renderer: import('three').WebGLRenderer;
  scene: import('three').Scene;
  camera: import('three').PerspectiveCamera;
  width: number;
  height: number;
  env: Premium3DEnvironment;
  /** 归一化指针位置，范围 -1..1 */
  pointer: React.RefObject<{ x: number; y: number }>;
};

export type Premium3DSceneProps = {
  /** 无 WebGL / 关闭 3D 时的静态替代图 */
  poster?: string;
  posterAlt?: string;
  /** 无障碍名称，必填 */
  label: string;
  className?: string;
  /** 画布容器比例，如 "4 / 5" */
  ratio?: string;
  enabled?: boolean;
  quality?: Premium3DQuality;
  /** 允许指针交互时记录指针位置 */
  interactive?: boolean;
  /** 3D 加载完成前的占位配色 */
  placeholderClassName?: string;
  onFps?: (fps: number) => void;
  setup: (context: SceneSetupContext) => SceneHandle | Promise<SceneHandle>;
};

export const Premium3DScene: React.FC<Premium3DSceneProps> = ({
  poster,
  posterAlt,
  label,
  className = '',
  ratio = '4 / 5',
  enabled = true,
  quality = 'high',
  interactive = false,
  placeholderClassName = 'bg-neutral-100',
  onFps,
  setup
}) => {
  const env = usePremium3DEnvironment({ enabled, quality });
  const [container, inView] = useInView<HTMLDivElement>();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const pointer = useRef({ x: 0, y: 0 });
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'failed'>('idle');

  const active = env.enabled && inView && !env.reduceMotion;

  // setup / env / onFps 用 ref 承载，避免调用方每次 render 生成新函数导致场景反复重建
  const setupRef = useRef(setup);
  setupRef.current = setup;
  const envRef = useRef(env);
  envRef.current = env;
  const fpsRef = useRef(onFps);
  fpsRef.current = onFps;

  useEffect(() => {
    if (!active) return undefined;
    const canvas = canvasRef.current;
    const host = container.current;
    if (!canvas || !host) return undefined;

    let disposed = false;
    let stopLoop: (() => void) | undefined;
    let handle: SceneHandle | undefined;
    let cleanupResize: (() => void) | undefined;

    setStatus('loading');

    (async () => {
      try {
        const THREE = await import('three');
        if (disposed) return;

        const renderer = new THREE.WebGLRenderer({ canvas, antialias: quality === 'high', alpha: true, powerPreference: 'high-performance' });
        renderer.setPixelRatio(resolveDevicePixelRatio(quality));
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);

        const resize = () => {
          const bounds = host.getBoundingClientRect();
          const width = Math.max(1, Math.round(bounds.width));
          const height = Math.max(1, Math.round(bounds.height));
          renderer.setSize(width, height, false);
          camera.aspect = width / height;
          camera.updateProjectionMatrix();
        };
        resize();

        if (typeof ResizeObserver !== 'undefined') {
          const observer = new ResizeObserver(resize);
          observer.observe(host);
          cleanupResize = () => observer.disconnect();
        } else {
          window.addEventListener('resize', resize);
          cleanupResize = () => window.removeEventListener('resize', resize);
        }

        handle = await setupRef.current({ THREE, renderer, scene, camera, width: 1, height: 1, env: envRef.current, pointer });
        if (disposed) { handle.dispose?.(); return; }

        // 自适应降级：软件渲染或低端 GPU 上，帧率长期低于 30 时把像素比降到 1，
        // 保画面流畅而不是保锐度；只降一次，避免来回抖动。
        let degraded = false;
        const watchFps = (fps: number) => {
          fpsRef.current?.(fps);
          if (!degraded && fps < 30 && quality === 'high') {
            degraded = true;
            renderer.setPixelRatio(1);
            resize();
          }
        };

        const animate = handle.animate !== false;
        if (!animate) {
          renderer.render(scene, camera);
          setStatus('ready');
          return;
        }
        stopLoop = startRenderLoop((dt, t) => {
          handle?.update?.(dt, t);
          renderer.render(scene, camera);
        }, { fpsCap: quality === 'low' ? 40 : 60, onFps: watchFps });
        setStatus('ready');
      } catch (error) {
        if (!disposed) setStatus('failed');
        // 控制台保留一次可诊断信息，但页面只显示静态降级，不影响业务
        console.warn('[premium3d] scene failed:', error);
      }
    })();

    return () => {
      disposed = true;
      stopLoop?.();
      cleanupResize?.();
      try { handle?.dispose?.(); } catch { /* 释放失败不影响卸载 */ }
    };
  }, [active, quality, container]);

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!interactive) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    pointer.current = {
      x: ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
      y: ((event.clientY - bounds.top) / bounds.height) * 2 - 1
    };
  };
  const onPointerLeave = () => { pointer.current = { x: 0, y: 0 }; };

  const showPoster = !active || status === 'failed';

  return (
    <div
      ref={container}
      className={`relative overflow-hidden ${className}`}
      style={{ aspectRatio: ratio }}
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
      role="img"
      aria-label={label}
    >
      {showPoster && (
        poster
          ? <img src={poster} alt={posterAlt || label} className="h-full w-full object-cover" loading="lazy" />
          : <div className={`h-full w-full ${placeholderClassName}`} aria-hidden="true" />
      )}
      {!showPoster && (
        <>
          <canvas ref={canvasRef} className="h-full w-full" />
          {status === 'loading' && <div className={`absolute inset-0 ${placeholderClassName}`} aria-hidden="true" />}
        </>
      )}
    </div>
  );
};
