/**
 * RUDA 3D 商品查看器。
 *
 * 两条真实路径，界面上明确区分，互不冒充：
 * 1) 商家上传了 GLB/GLTF（media.type === 'model'）→ three.js GLTFLoader 真模型，可旋转/缩放/看结构。
 * 2) 只有真实多角度照片（>=3 张）→ 360° 图片环视，标题写明「360° 图片」，不是 3D 模型。
 * 3) 两者都没有 → 直接显示真实商品图，不生成任何伪 3D。
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Premium3DScene, type SceneSetupContext, type SceneHandle } from '../Premium3DScene';
import type { Premium3DQuality } from '../capability';

export type ProductModelSource = {
  url: string;
  scaleMeters?: number;
  initialAngleDeg?: number;
  poster?: string;
};

export type Ruda3DProductViewerProps = {
  productName: string;
  productCode?: string;
  images: string[];
  model?: ProductModelSource | null;
  angleFrames?: string[];
  quality?: Premium3DQuality;
  enabled?: boolean;
  ratio?: string;
  className?: string;
  /** 全屏展示 */
  fullscreen?: boolean;
  /** 自动旋转 */
  autoRotate?: boolean;
};

type ViewerMode = 'model' | 'photo360' | 'image';

function resolveMode(model: ProductModelSource | null | undefined, angleFrames: string[] | undefined, images: string[]): ViewerMode {
  if (model?.url) return 'model';
  if ((angleFrames?.length || 0) >= 3) return 'photo360';
  void images;
  return 'image';
}

export const Ruda3DProductViewer: React.FC<Ruda3DProductViewerProps> = ({
  productName,
  productCode,
  images,
  model,
  angleFrames = [],
  quality = 'high',
  enabled = true,
  ratio = '4 / 5',
  className = '',
  fullscreen = false,
  autoRotate = true
}) => {
  const mode = resolveMode(model, angleFrames, images);
  const [spin, setSpin] = useState(true);
  const [frame, setFrame] = useState(0);
  const [fullscreenOpen, setFullscreenOpen] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // 360° 图片环视：真实多角度照片，按指针横向拖动切换
  const frames = angleFrames.length ? angleFrames : images;
  const dragging = useRef<{ startX: number; startFrame: number } | null>(null);
  useEffect(() => {
    if (mode !== 'photo360' || !spin) return undefined;
    const timer = window.setInterval(() => setFrame(current => (current + 1) % frames.length), 1400);
    return () => window.clearInterval(timer);
  }, [mode, spin, frames.length]);

  const setupModel = useCallback(async (ctx: SceneSetupContext): Promise<SceneHandle> => {
    if (!model?.url) throw new Error('viewer: no model');
    const { THREE, renderer, scene, camera, pointer } = ctx;
    renderer.setClearColor(0x000000, 0);
    const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
    const { buildLightingRig, buildStudioEnvironment, buildStudioFloor } = await import('./LightingSystem');

    const env = buildStudioEnvironment(THREE);
    scene.environment = env;
    const rig = buildLightingRig(THREE, scene, renderer, 'showcase');
    const floor = buildStudioFloor(THREE);
    scene.add(floor);

    const loader = new GLTFLoader();
    const gltf = await loader.loadAsync(model.url);
    const root = gltf.scene;
    root.traverse(child => {
      const asMesh = child as import('three').Mesh;
      if (asMesh.isMesh) {
        asMesh.castShadow = true;
        asMesh.receiveShadow = true;
        asMesh.material = Array.isArray(asMesh.material)
          ? asMesh.material.map(material => material)
          : asMesh.material;
      }
    });

    // 按真实尺寸归一化：scaleMeters 有值时按米换算到场景单位，保证不同商品比例可信
    const bounds = new THREE.Box3().setFromObject(root);
    const size = new THREE.Vector3();
    bounds.getSize(size);
    const maxDimension = Math.max(size.x, size.y, size.z) || 1;
    const targetSize = model.scaleMeters ? Math.min(3.2, model.scaleMeters * 1.6) : 2.4;
    const scale = targetSize / maxDimension;
    root.scale.setScalar(scale);
    bounds.setFromObject(root);
    const center = new THREE.Vector3();
    bounds.getCenter(center);
    root.position.sub(center);
    root.position.y += 0.02;
    scene.add(root);

    const initialAngle = THREE.MathUtils.degToRad(model.initialAngleDeg ?? 18);
    root.rotation.y = initialAngle;
    camera.position.set(0, 0.55, 4.6);
    camera.lookAt(0, 0, 0);

    let rotation = initialAngle;
    let targetRotation = initialAngle;
    let zoom = 4.6;
    let targetZoom = 4.6;
    let isDragging = false;
    let lastX = 0;
    let lastY = 0;
    let tilt = 0;
    let targetTilt = 0;

    const host = renderer.domElement.parentElement;
    const onDown = (event: PointerEvent) => {
      isDragging = true;
      lastX = event.clientX;
      lastY = event.clientY;
      host?.setPointerCapture?.(event.pointerId);
    };
    const onMove = (event: PointerEvent) => {
      if (!isDragging) return;
      targetRotation += (event.clientX - lastX) / 220;
      targetTilt = Math.max(-0.35, Math.min(0.45, targetTilt + (event.clientY - lastY) / 600));
      lastX = event.clientX;
      lastY = event.clientY;
    };
    const onUp = (event: PointerEvent) => {
      isDragging = false;
      host?.releasePointerCapture?.(event.pointerId);
    };
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      targetZoom = Math.max(2.6, Math.min(7.2, targetZoom + event.deltaY / 420));
    };
    host?.addEventListener('pointerdown', onDown);
    host?.addEventListener('pointermove', onMove);
    host?.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('pointerup', onUp);

    return {
      update: (dt, t) => {
        if (!isDragging && autoRotate && spin) targetRotation += dt * 0.42;
        rotation += (targetRotation - rotation) * Math.min(1, dt * 7);
        tilt += (targetTilt - tilt) * Math.min(1, dt * 6);
        zoom += (targetZoom - zoom) * Math.min(1, dt * 6);
        root.rotation.y = rotation;
        root.rotation.x = tilt;
        root.position.y = 0.02 + Math.sin(t * 0.55) * 0.012;
        camera.position.z = zoom - Math.min(0.3, pointer.current.y * -0.1);
        camera.position.y = 0.55 + pointer.current.y * 0.16;
        camera.lookAt(0, 0, 0);
        rig.update?.(t);
      },
      dispose: () => {
        host?.removeEventListener('pointerdown', onDown);
        host?.removeEventListener('pointermove', onMove);
        host?.removeEventListener('wheel', onWheel);
        window.removeEventListener('pointerup', onUp);
        rig.dispose();
        scene.remove(root, floor);
        root.traverse(child => {
          const asMesh = child as import('three').Mesh;
          if (!asMesh.isMesh) return;
          asMesh.geometry.dispose();
          const material = asMesh.material as import('three').Material | import('three').Material[];
          (Array.isArray(material) ? material : [material]).forEach(item => item.dispose());
        });
        floor.geometry.dispose();
        env.dispose();
      }
    };
  }, [model?.url, model?.scaleMeters, model?.initialAngleDeg, autoRotate, spin, quality]);

  // 加载失败：降到真实商品图，不显示坏掉的 3D 画布
  const modelFailed = loadError !== null;

  const body = (() => {
    if (mode === 'model' && !modelFailed) {
      return (
        <Premium3DScene
          label={`${productName} 三维模型，可拖动旋转、滚轮缩放`}
          poster={model?.poster || images[0]}
          posterAlt={productName}
          ratio={ratio}
          enabled={enabled}
          quality={quality}
          interactive
          className="!bg-[#f7f5f1]"
          placeholderClassName="bg-[#f2eee8]"
          setup={async ctx => {
            try {
              return await setupModel(ctx);
            } catch (error) {
              setLoadError(error instanceof Error ? error.message : '模型加载失败');
              throw error;
            }
          }}
        />
      );
    }
    // 360° 图片环视：真实多角度照片，明示不是 3D 模型
    return (
      <div
        className="relative select-none overflow-hidden bg-[#f7f5f1]"
        style={{ aspectRatio: ratio }}
        role="img"
        aria-label={`${productName} 360 度图片环视，共 ${frames.length} 个角度`}
        onPointerDown={event => {
          if (mode !== 'photo360') return;
          dragging.current = { startX: event.clientX, startFrame: frame };
        }}
        onPointerMove={event => {
          if (!dragging.current || frames.length < 2) return;
          const delta = event.clientX - dragging.current.startX;
          const step = Math.round(delta / 40);
          setFrame(((dragging.current.startFrame + step) % frames.length + frames.length) % frames.length);
        }}
        onPointerUp={() => { dragging.current = null; }}
        onPointerLeave={() => { dragging.current = null; }}
      >
        <img src={frames[frame]} alt={`${productName} 第 ${frame + 1} 个角度`} className="h-full w-full object-contain" />
        {mode === 'photo360' && (
          <span className="absolute left-3 top-3 border border-neutral-300 bg-white/90 px-2 py-1 text-[12px] text-neutral-700">
            360° 图片环视 · {frames.length} 个角度
          </span>
        )}
        {mode === 'image' && modelFailed && (
          <span className="absolute left-3 top-3 border border-neutral-300 bg-white/90 px-2 py-1 text-[12px] text-neutral-700">3D 模型加载失败，显示商品图</span>
        )}
      </div>
    );
  })();

  const canvas = (
    <figure className={`relative ${className}`}>
      {body}
      {mode === 'model' && !modelFailed && (
        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-neutral-600">
          <button type="button" onClick={() => setSpin(value => !value)} aria-pressed={spin} className="border border-neutral-300 px-2.5 py-1.5 hover:border-neutral-950">
            {spin ? '停止自动旋转' : '开始自动旋转'}
          </button>
          <button type="button" onClick={() => setFullscreenOpen(true)} className="border border-neutral-300 px-2.5 py-1.5 hover:border-neutral-950">全屏 3D</button>
          <span>拖动旋转 · 滚轮缩放</span>
          {productCode && <span className="ml-auto tabular-nums text-neutral-500">{productCode}</span>}
        </div>
      )}
      {fullscreenOpen && mode === 'model' && !modelFailed && (
        <div className="fixed inset-0 z-[80] flex flex-col bg-[#f7f5f1]" role="dialog" aria-modal="true" aria-label={`${productName} 全屏三维展示`}>
          <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
            <span className="text-sm font-medium">{productName}</span>
            <button type="button" onClick={() => setFullscreenOpen(false)} className="border border-neutral-300 px-3 py-1.5 text-xs hover:border-neutral-950">关闭</button>
          </div>
          <div className="flex-1">
            <Premium3DScene
              label={`${productName} 全屏三维展示`}
              poster={model?.poster || images[0]}
              posterAlt={productName}
              ratio="16 / 9"
              enabled={enabled}
              quality="high"
              interactive
              className="h-full !bg-[#f7f5f1]"
              placeholderClassName="bg-[#f2eee8]"
              setup={setupModel}
            />
          </div>
        </div>
      )}
    </figure>
  );
  return canvas;
};
