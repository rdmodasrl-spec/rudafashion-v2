/**
 * 3D 商品转场：两张真实商品图之间的翻页式切换，用于系列切换与主推位轮播。
 */
import React, { useCallback } from 'react';
import { Premium3DScene, type SceneSetupContext, type SceneHandle } from './Premium3DScene';
import { loadTextureWithFallback, RUDA_3D_PALETTE, type Premium3DQuality } from './capability';

export type ProductFlipTransition3DProps = {
  frontImage: string;
  backImage: string;
  frontLabel: string;
  backLabel: string;
  /** 自动翻页间隔毫秒，0 表示只响应点击 */
  intervalMs?: number;
  quality?: Premium3DQuality;
  enabled?: boolean;
  ratio?: string;
  className?: string;
  onFlip?: (showingBack: boolean) => void;
};

export const ProductFlipTransition3D: React.FC<ProductFlipTransition3DProps> = ({
  frontImage,
  backImage,
  frontLabel,
  backLabel,
  intervalMs = 0,
  quality = 'high',
  enabled = true,
  ratio = '4 / 5',
  className = '',
  onFlip
}) => {
  const setup = useCallback(async (ctx: SceneSetupContext): Promise<SceneHandle> => {
    const { THREE, renderer, scene, camera } = ctx;
    renderer.setClearColor(0x000000, 0);
    camera.position.set(0, 0, 4.6);
    scene.add(new THREE.AmbientLight(0xffffff, 1.65));

        const load = (url: string) => new Promise<import('three').Texture | null>(resolve => {
      loadTextureWithFallback(THREE, url).then(resolve, () => resolve(null));
    });
    const [front, back] = await Promise.all([load(frontImage), load(backImage)]);

    const makeCard = (texture: import('three').Texture | null) => {
      const geometry = new THREE.PlaneGeometry(2.4, 3.0, 1, 1);
      const material = texture
        ? new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide })
        : new THREE.MeshBasicMaterial({ color: new THREE.Color(RUDA_3D_PALETTE.paperDeep), side: THREE.DoubleSide });
      return new THREE.Mesh(geometry, material);
    };

    const frontMesh = makeCard(front);
    frontMesh.position.z = 0.012;
    const backMesh = makeCard(back);
    backMesh.rotation.y = Math.PI;
    const pivot = new THREE.Group();
    pivot.add(frontMesh, backMesh);
    scene.add(pivot);

    let angle = 0;
    let target = 0;
    let showingBack = false;
    let timer: number | undefined;
    if (intervalMs > 0) {
      timer = window.setInterval(() => {
        showingBack = !showingBack;
        target = showingBack ? Math.PI : 0;
        onFlip?.(showingBack);
      }, intervalMs);
    }

    const host = renderer.domElement.parentElement;
    const onClick = () => {
      showingBack = !showingBack;
      target += Math.PI;
      onFlip?.(showingBack);
    };
    host?.addEventListener('click', onClick);

    return {
      update: (dt) => {
        // 弹簧式缓动，翻页时带轻微过冲，避免机械线性
        const delta = target - angle;
        angle += delta * Math.min(1, dt * 5.2);
        pivot.rotation.y = angle;
      },
      dispose: () => {
        if (timer) window.clearInterval(timer);
        host?.removeEventListener('click', onClick);
        [frontMesh, backMesh].forEach(mesh => {
          mesh.geometry.dispose();
          const material = mesh.material as import('three').Material & { map?: import('three').Texture };
          material.map?.dispose();
          material.dispose();
        });
      }
    };
  }, [frontImage, backImage, intervalMs, onFlip]);

  return (
    <figure className={className}>
      <Premium3DScene
        label={`${frontLabel} / ${backLabel} 商品转场，点击翻面`}
        poster={frontImage}
        posterAlt={frontLabel}
        ratio={ratio}
        enabled={enabled}
        quality={quality}
        className="cursor-pointer !bg-[#f7f5f1]"
        placeholderClassName="bg-[#f2eee8]"
        setup={setup}
      />
      <figcaption className="mt-3 flex items-center justify-between text-xs text-neutral-500">
        <span>{frontLabel}</span>
        <span>{backLabel}</span>
      </figcaption>
    </figure>
  );
};
