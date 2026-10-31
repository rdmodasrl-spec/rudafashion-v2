/**
 * Ruda3DScrollScene —— 3D 滚动叙事（多章节）。
 *
 * 一个连续场景贯穿多屏：商品主体在 3D 空间中不换位置，摄像机按章节推进，
 * 章节文字由模板提供（真实品牌/商品文案），场景本身不认识任何假数据。
 */
import React, { useCallback, useMemo } from 'react';
import { Premium3DScene, type SceneSetupContext, type SceneHandle } from '../Premium3DScene';
import type { Premium3DQuality } from '../capability';
import { buildLightingRig, buildStudioEnvironment, buildStudioFloor } from './LightingSystem';
import { createCameraController, type CameraKeyframe } from './CameraController';
import { buildLeatherProps, buildModelSubject, buildPhotoSubject } from './sceneKit';

export type ScrollChapter = {
  id: string;
  eyebrow?: string;
  title: string;
  body?: string;
};

export type Ruda3DScrollSceneProps = {
  productName: string;
  image: string;
  modelUrl?: string | null;
  chapters: ScrollChapter[];
  quality?: Premium3DQuality;
  enabled?: boolean;
  className?: string;
  onReady?: (kind: 'model' | 'photo') => void;
};

export const Ruda3DScrollScene: React.FC<Ruda3DScrollSceneProps> = ({
  productName,
  image,
  modelUrl,
  chapters,
  quality = 'high',
  enabled = true,
  className = '',
  onReady
}) => {
  const keyframes = useMemo<CameraKeyframe[]>(() => {
    const frames: CameraKeyframe[] = [
      { at: 0, position: [0, 0.7, 6.4], target: [0, 0, 0] },
      { at: 0.22, position: [0.35, 0.4, 3.35], target: [0.05, 0.15, 0.1] },
      { at: 0.46, position: [-1.85, 0.55, 3.25], target: [0, 0.05, 0] },
      { at: 0.68, position: [1.75, 0.15, 3.0], target: [0, -0.05, 0] },
      { at: 0.88, position: [-0.6, 1.1, 4.9], target: [0, 0.15, 0] },
      { at: 1, position: [0, 0.9, 7.4], target: [0, 0, 0] }
    ];
    return frames;
  }, []);

  const setup = useCallback(async (ctx: SceneSetupContext): Promise<SceneHandle> => {
    const { THREE, renderer, scene, camera, pointer } = ctx;
    renderer.setClearColor(0x000000, 0);

    const env = buildStudioEnvironment(THREE);
    scene.environment = env;
    const rig = buildLightingRig(THREE, scene, renderer, 'softbox');
    const floor = buildStudioFloor(THREE, '#f5f2ec');
    scene.add(floor);

    const subject = modelUrl
      ? await buildModelSubject(THREE, modelUrl, { targetSize: 2.6 })
      : await buildPhotoSubject(THREE, image, { height: 2.45 });
    scene.add(subject.group);
    onReady?.(subject.kind);

    const props = buildLeatherProps(THREE);
    scene.add(props.group);

    const controller = createCameraController(THREE, camera, keyframes);
    const host = renderer.domElement.closest('[data-ruda3d-scroll]') as HTMLElement | null;
    if (host) controller.attach(host);

    let drift = 0;
    return {
      update: (dt, elapsed) => {
        controller.setPointer(pointer.current.x, pointer.current.y);
        controller.update(dt);
        drift += dt * 0.22;
        subject.group.rotation.y = Math.sin(drift * 0.6) * 0.3;
        subject.update(elapsed);
        props.update(elapsed);
        rig.update?.(elapsed);
      },
      dispose: () => {
        controller.dispose();
        rig.dispose();
        subject.dispose();
        props.dispose();
        scene.remove(subject.group, props.group, floor);
        floor.geometry.dispose();
        env.dispose();
      }
    };
  }, [image, modelUrl, keyframes, onReady]);

  return (
    <div data-ruda3d-scroll className={`relative ${className}`} style={{ height: `${Math.max(2.2, chapters.length * 0.85) * 100}vh` }}>
      <div className="sticky top-0 h-screen w-full overflow-hidden">
        <Premium3DScene
          label={`${productName} 三维滚动叙事`}
          poster={image}
          posterAlt={productName}
          ratio="auto"
          enabled={enabled}
          quality={quality}
          interactive
          className="!h-screen !w-full !bg-[#f5f2ec]"
          placeholderClassName="bg-[#f2eee8]"
          setup={setup}
        />
        <div className="pointer-events-none absolute inset-0">
          {chapters.map((chapter, index) => (
            <div
              key={chapter.id}
              className="absolute inset-x-0 bottom-0 mx-auto max-w-[1240px] px-6 pb-14 sm:px-10"
              style={{ opacity: 0.999, transform: `translateY(${index * 0}px)` }}
            >
              {index === 0 && (
                <div className="max-w-lg">
                  {chapter.eyebrow && <p className="text-[12px] uppercase tracking-[0.3em] text-neutral-500">{chapter.eyebrow}</p>}
                  <h2 className="mt-3 font-serif text-3xl leading-tight sm:text-5xl">{chapter.title}</h2>
                  {chapter.body && <p className="mt-4 max-w-md text-sm leading-7 text-neutral-600">{chapter.body}</p>}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
      <div className="relative z-10 -mt-[100vh]">
        {chapters.slice(1).map(chapter => (
          <div key={chapter.id} className="flex min-h-screen items-center">
            <div className="mx-auto w-full max-w-[1240px] px-6 sm:px-10">
              <div className="max-w-md bg-[#fbfaf8]/92 p-6 backdrop-blur-sm">
                {chapter.eyebrow && <p className="text-[12px] uppercase tracking-[0.3em] text-neutral-500">{chapter.eyebrow}</p>}
                <h3 className="mt-3 font-serif text-2xl leading-tight sm:text-3xl">{chapter.title}</h3>
                {chapter.body && <p className="mt-3 text-sm leading-7 text-neutral-600">{chapter.body}</p>}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
