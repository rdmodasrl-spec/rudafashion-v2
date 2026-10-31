/**
 * Ruda3DHero —— 3D 品牌首屏（真实 WebGL 场景）。
 *
 * 场景构成：影棚地面（接受阴影）+ 皮具道具（皮革卷/五金扣）+ 商品主体 + 三点灯光 + 环境反射。
 * 摄像机在滚动中沿关键帧推进：全景 → 靠近细节 → 侧向环绕 → 拉远交还给页面内容。
 * 商品主体优先使用商家上传的真实 GLB；没有模型时使用带厚度、接受灯光与投影的真实商品图立体板，
 * 界面与文档都明确区分，不把图片称作 3D 模型。
 */
import React, { useCallback, useMemo } from 'react';
import { Premium3DScene, type SceneSetupContext, type SceneHandle } from '../Premium3DScene';
import type { Premium3DQuality } from '../capability';
import { buildLightingRig, buildStudioEnvironment, buildStudioFloor } from './LightingSystem';
import { createCameraController } from './CameraController';
import { buildLeatherProps, buildModelSubject, buildPhotoSubject } from './sceneKit';

export type Ruda3DHeroProps = {
  productName: string;
  image: string;
  modelUrl?: string | null;
  /** 滚动叙事总长度（视口高度的倍数），建议 2.2–3 */
  scrollLength?: number;
  quality?: Premium3DQuality;
  enabled?: boolean;
  className?: string;
  /** 覆盖首屏文案渲染位置，保持页面排版由模板决定 */
  children?: React.ReactNode;
  /** 场景就绪回调，用于外部展示「3D 已就绪」状态 */
  onReady?: (kind: 'model' | 'photo') => void;
  /** 外部滚动容器；默认取最近的可滚动祖先 */
  scrollHostRef?: React.RefObject<HTMLElement | null>;
  /** 商品主体水平偏移（场景单位），用于给模板标题留出版面空间 */
  subjectOffsetX?: number;
  /** 商品主体高度（场景单位） */
  subjectHeight?: number;
};

export const Ruda3DHero: React.FC<Ruda3DHeroProps> = ({
  productName,
  image,
  modelUrl,
  scrollLength = 2.4,
  quality = 'high',
  enabled = true,
  className = '',
  children,
  onReady,
  scrollHostRef,
  subjectOffsetX = 0,
  subjectHeight = 2.55
}) => {
  const keyframes = useMemo(() => ([
    { at: 0, position: [0, 0.75, 6.1] as [number, number, number], target: [0, 0, 0] as [number, number, number] },
    { at: 0.34, position: [0.55, 0.42, 3.9] as [number, number, number], target: [0.1, 0.05, 0] as [number, number, number] },
    { at: 0.62, position: [-1.55, 0.3, 3.1] as [number, number, number], target: [-0.1, 0.02, 0] as [number, number, number] },
    { at: 0.86, position: [1.35, 0.95, 4.4] as [number, number, number], target: [0, 0.1, 0] as [number, number, number] },
    { at: 1, position: [0, 1.35, 7.2] as [number, number, number], target: [0, -0.1, 0] as [number, number, number] }
  ]), []);

  const setup = useCallback(async (ctx: SceneSetupContext): Promise<SceneHandle> => {
    const { THREE, renderer, scene, camera, pointer } = ctx;
    renderer.setClearColor(0x000000, 0);

    const env = buildStudioEnvironment(THREE);
    scene.environment = env;
    const rig = buildLightingRig(THREE, scene, renderer, 'studio');
    const floor = buildStudioFloor(THREE, '#f4f0ea');
    scene.add(floor);

    let subject;
    if (modelUrl) {
      subject = await buildModelSubject(THREE, modelUrl, { targetSize: 2.7 });
    } else {
      subject = await buildPhotoSubject(THREE, image, { height: subjectHeight });
    }
    subject.group.position.x = subjectOffsetX;
    scene.add(subject.group);
    onReady?.(subject.kind);

    const props = buildLeatherProps(THREE);
    scene.add(props.group);

    const cameraController = createCameraController(THREE, camera, keyframes);
    const host = scrollHostRef?.current || (renderer.domElement.closest('[data-ruda3d-scroll]') as HTMLElement | null);
    if (host) cameraController.attach(host);

    let spin = 0;
    return {
      update: (dt, elapsed) => {
        cameraController.setPointer(pointer.current.x, pointer.current.y);
        cameraController.update(dt);
        // 商品自身缓慢旋转，让空间层次持续可见
        spin += dt * 0.16;
        subject.group.rotation.y = Math.sin(spin) * 0.22;
        subject.update(elapsed);
        props.update(elapsed);
        rig.update?.(elapsed);
      },
      dispose: () => {
        cameraController.dispose();
        rig.dispose();
        subject.dispose();
        props.dispose();
        scene.remove(subject.group, props.group, floor);
        floor.geometry.dispose();
        env.dispose();
      }
    };
  }, [image, modelUrl, keyframes, onReady, scrollHostRef, subjectOffsetX, subjectHeight]);

  return (
    <div
      data-ruda3d-scroll
      className={`relative ${className}`}
      style={{ height: `${scrollLength * 100}vh` }}
    >
      <div className="sticky top-0 h-screen w-full overflow-hidden">
        <Premium3DScene
          label={`${productName} 三维品牌首屏`}
          poster={image}
          posterAlt={productName}
          ratio="auto"
          enabled={enabled}
          quality={quality}
          interactive
          className="!h-screen !w-full !bg-[#f7f5f1]"
          placeholderClassName="bg-[#f2eee8]"
          setup={setup}
        />
        {children}
      </div>
    </div>
  );
};
