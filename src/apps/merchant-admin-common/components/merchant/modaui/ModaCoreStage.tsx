import React, { createContext, useContext, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ModaUICore } from './ModaUICore';
import { createModaCoreStage, type ModaCoreStageHandle } from './modaCoreStage';
import type { ModaCoreRendererHandle, ModaCoreVisualState } from './modaCoreEngine';
import type { AudioLevelRef } from './useModaCoreAudio';
import type { ModaCoreLifeHandle } from './modaCoreLife';
import type { ModaCoreAnchorKind } from './modaCoreStageMath';

const ModaCoreStageContext = createContext<ModaCoreStageHandle | null>(null);

type ModaCoreStageProviderProps = {
  life: ModaCoreLifeHandle;
  state: ModaCoreVisualState;
  levelRef: AudioLevelRef;
  pulseRef: AudioLevelRef;
  children: React.ReactNode;
};

/**
 * 对话内嵌粒子智能体的渲染舞台。
 *
 * 整个 provider 只创建一个 canvas：React 通过 portal 把 `ModaUICore` 渲染到 stage 的宿主元素上，
 * 宿主元素本身由 `ModaCoreAnchor` 的注册结果决定挂在哪里（首页大核心 / 回复左上角），
 * 因此从大核心移动到回复位置的是同一个 WebGL 上下文，而不是“销毁旧核心再新建一个头像”。
 */
export const ModaCoreStageProvider: React.FC<ModaCoreStageProviderProps> = ({
  life,
  state,
  levelRef,
  pulseRef,
  children
}) => {
  const stage = useMemo(() => createModaCoreStage(), []);
  const rendererRef = useRef<ModaCoreRendererHandle | null>(null);

  useEffect(() => {
    stage.setDensityHandler(count => rendererRef.current?.setParticleCount(count));
    return () => {
      stage.setDensityHandler(null);
      stage.dispose();
    };
  }, [stage]);

  // 子组件的 effect 先于父组件执行：这里渲染器已经就绪，把舞台当前的粒子预算同步过去。
  useEffect(() => {
    const count = stage.getDensity();
    if (count) rendererRef.current?.setParticleCount(count);
  }, [stage, state]);

  // 呈现模式随舞台锚点切换（自由舞台 ↔ 回答内嵌头像），运动控制器据此调整尺度，不重置位姿。
  useEffect(() => {
    rendererRef.current?.setPresentation(stage.getPresentationMode());
    return stage.subscribePresentationMode(mode => rendererRef.current?.setPresentation(mode));
  }, [stage]);

  return (
    <ModaCoreStageContext.Provider value={stage}>
      {children}
      {createPortal(
        <ModaUICore
          state={state}
          levelRef={levelRef}
          pulseRef={pulseRef}
          life={life}
          rendererRef={rendererRef}
          className="h-full w-full"
        />,
        stage.host,
        'modaui-core-stage'
      )}
    </ModaCoreStageContext.Provider>
  );
};

type ModaCoreAnchorProps = {
  kind: ModaCoreAnchorKind;
  /** 尺寸完全由布局决定（Tailwind 宽高类），粒子核心按锚点真实像素渲染。 */
  className?: string;
};

/**
 * 粒子核心的落位锚点。只占位、不接受指针事件；真正的 canvas 在舞台宿主里。
 */
export const ModaCoreAnchor: React.FC<ModaCoreAnchorProps> = ({ kind, className = '' }) => {
  const stage = useContext(ModaCoreStageContext);
  const ref = useRef<HTMLDivElement | null>(null);
  const instanceId = useRef(typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID().slice(0, 8) : Math.random().toString(36).slice(2, 10));

  // 不在依赖里写死：每次渲染都重新登记当前 DOM 节点。
  // 消息列表会因为流式文本重渲染、也会因为失败回滚重建行节点，登记必须始终指向真实存在的锚点。
  useEffect(() => {
    const el = ref.current;
    if (!el || !stage) return;
    return stage.registerAnchor(kind, el);
  });

  return (
    <div
      ref={ref}
      aria-hidden="true"
      data-modaui-anchor={kind}
      data-modaui-anchor-id={instanceId.current}
      data-modaui-stage-owner={stage ? stage.id : undefined}
      className={`pointer-events-none relative overflow-hidden ${className}`}
    />
  );
};
