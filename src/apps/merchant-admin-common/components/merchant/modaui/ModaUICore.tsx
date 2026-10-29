import React, { useEffect, useRef, useState } from 'react';
import { createModaCoreRenderer, type ModaCoreRendererHandle, type ModaCoreVisualState } from './modaCoreEngine';
import type { AudioLevelRef } from './useModaCoreAudio';
import type { ModaCoreLifeHandle, ModaCoreLifePhase } from './modaCoreLife';

type ModaUICoreProps = {
  /** 由真实交互事件映射的视觉状态（待机/聆听/思考/回答/成功/失败）。 */
  state: ModaCoreVisualState;
  /** 真实麦克风电平 0–1。 */
  levelRef: AudioLevelRef;
  /** 真实语音播报脉冲 0–1。 */
  pulseRef: AudioLevelRef;
  /**
   * 对话实时生命通道：输入、提交、真实回答片段与语音生命周期都通过它驱动同一套粒子，
   * 不额外创建第二套 AI 状态。不传时核心只按 `state` 播放。
   */
  life?: ModaCoreLifeHandle;
  /**
   * 把渲染器句柄交给调用方可控的位置（对话内嵌舞台用它调整粒子预算）。
   * 不传时组件内部自管，行为与之前一致。
   */
  rendererRef?: React.MutableRefObject<ModaCoreRendererHandle | null>;
  className?: string;
};

/**
 * ModaUI 首页中央的实时 3D 智能核心。
 *
 * 无 WebGL2 或上下文丢失时自动切换为 CSS 降级核心（仍是实时动画，不使用图片/GIF/视频），
 * 并在容器上以 `data-modaui-core="css"` 标注，便于验收与自动化检查。
 */
export const ModaUICore: React.FC<ModaUICoreProps> = ({ state, levelRef, pulseRef, life, rendererRef, className = '' }) => {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const localRendererRef = useRef<ModaCoreRendererHandle | null>(null);
  const stateRef = useRef<ModaCoreVisualState>(state);
  const [fallback, setFallback] = useState(false);
  const [lifePhase, setLifePhase] = useState<ModaCoreLifePhase | null>(life ? life.getPhase() : null);

  stateRef.current = state;

  useEffect(() => {
    if (!life) {
      setLifePhase(null);
      return;
    }
    setLifePhase(life.getPhase());
    return life.subscribePhase(next => setLifePhase(next));
  }, [life]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let renderer: ModaCoreRendererHandle | null = null;
    try {
      renderer = createModaCoreRenderer({
        canvas,
        readLevel: () => levelRef.current || 0,
        readPulse: () => pulseRef.current || 0,
        readLife: life ? () => life.sample() : undefined,
        onContextLost: () => setFallback(true)
      });
    } catch (error) {
      console.warn('[ModaUI core] WebGL2 渲染初始化失败，使用降级视觉。', error);
    }

    if (!renderer) {
      setFallback(true);
      return;
    }

    setFallback(false);
    localRendererRef.current = renderer;
    if (rendererRef) rendererRef.current = renderer;
    renderer.setState(stateRef.current);
    renderer.start();

    const wrapper = wrapperRef.current;
    let observer: IntersectionObserver | null = null;
    if (wrapper && typeof IntersectionObserver !== 'undefined') {
      observer = new IntersectionObserver(entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) renderer?.start();
          else renderer?.stop();
        });
      }, { threshold: 0.05 });
      observer.observe(wrapper);
    }

    const onVisibilityChange = () => {
      if (document.hidden) renderer?.stop();
      else renderer?.start();
    };
    const onResize = () => renderer?.resize();

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => renderer?.resize());
      if (wrapper) resizeObserver.observe(wrapper);
    }

    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('resize', onResize);

    // 每 250ms 把生命通道数值写到容器上，便于真实页面验收入口与自动化检查（不触发 React 重渲染）。
    let lifeProbe: number | null = null;
    if (life) {
      const wrapper = wrapperRef.current;
      if (wrapper) {
        const writeProbe = () => {
          const frame = life.getFrame();
          wrapper.dataset.modauiLife = `${frame.phase}:${frame.contraction.toFixed(2)},${frame.forward.toFixed(2)},${frame.flow.toFixed(2)},${frame.energy.toFixed(2)}`;
        };
        writeProbe();
        lifeProbe = window.setInterval(writeProbe, 250);
      }
    }

    return () => {
      observer?.disconnect();
      resizeObserver?.disconnect();
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('resize', onResize);
      if (lifeProbe !== null) window.clearInterval(lifeProbe);
      renderer?.dispose();
      localRendererRef.current = null;
      if (rendererRef) rendererRef.current = null;
    };
  }, [levelRef, pulseRef, life, rendererRef]);

  useEffect(() => {
    localRendererRef.current?.setState(state);
  }, [state]);

  useEffect(() => {
    if (fallback) localRendererRef.current?.stop();
  }, [fallback]);

  return (
    <div
      ref={wrapperRef}
      aria-hidden="true"
      data-modaui-core={fallback ? 'css' : 'webgl'}
      data-modaui-core-state={state}
      data-modaui-core-phase={lifePhase ?? undefined}
      className={`relative isolate ${className}`}
    >
      <canvas ref={canvasRef} className={`h-full w-full ${fallback ? 'hidden' : ''}`} />
      {fallback && <div className="modaui-core-fallback h-full w-full" />}
    </div>
  );
};
