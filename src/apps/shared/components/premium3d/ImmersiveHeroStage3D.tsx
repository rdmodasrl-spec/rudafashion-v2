/**
 * 沉浸式品牌首屏：商品或品牌图立于舞台中央，缓慢环绕 + 灯光呼吸，用于行业官网首屏。
 * 与 ProductTurntable3D 的区别：这里不强调拖拽检视，强调「第一眼的品牌气场」。
 */
import React, { useCallback } from 'react';
import { Premium3DScene, type SceneSetupContext, type SceneHandle } from './Premium3DScene';
import { loadTextureWithFallback, RUDA_3D_PALETTE, type Premium3DQuality } from './capability';

export type ImmersiveHeroStage3DProps = {
  image: string;
  alt: string;
  caption?: string;
  /** 环绕幅度（弧度） */
  orbitAmount?: number;
  quality?: Premium3DQuality;
  enabled?: boolean;
  ratio?: string;
  className?: string;
};

export const ImmersiveHeroStage3D: React.FC<ImmersiveHeroStage3DProps> = ({
  image,
  alt,
  caption,
  orbitAmount = 0.16,
  quality = 'high',
  enabled = true,
  ratio = '16 / 10',
  className = ''
}) => {
  const setup = useCallback(async (ctx: SceneSetupContext): Promise<SceneHandle> => {
    const { THREE, renderer, scene, camera } = ctx;
    renderer.setClearColor(0x000000, 0);
    camera.position.set(0, 0.5, 5.4);
    camera.lookAt(0, 0, 0);

    const ambient = new THREE.AmbientLight(0xffffff, 1.15);
    scene.add(ambient);
    const key = new THREE.DirectionalLight(0xffffff, 1.5);
    key.position.set(2.6, 3.4, 3.2);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0xffffff, 0.6);
    rim.position.set(-3, 0.8, -2);
    scene.add(rim);

    const texture = await new Promise<import('three').Texture | null>(resolve => {
            loadTextureWithFallback(THREE, image).then(resolve, () => resolve(null));
    });

    const aspect = (() => {
      const img = texture?.image as { width?: number; height?: number } | undefined;
      return img?.width && img?.height ? img.width / img.height : 0.78;
    })();
    const height = 3.1;
    const width = Math.min(3.4, height * aspect);

    const geometry = new THREE.PlaneGeometry(width, height, 24, 24);
    const material = texture
      ? new THREE.MeshStandardMaterial({ map: texture, roughness: 0.62, metalness: 0.04 })
      : new THREE.MeshStandardMaterial({ color: new THREE.Color(RUDA_3D_PALETTE.paperDeep), roughness: 0.8 });
    const panel = new THREE.Mesh(geometry, material);
    scene.add(panel);

    // 舞台地面：柔和的椭圆亮斑，营造展厅落点
    const floorGeometry = new THREE.CircleGeometry(2.4, 64);
    const floorMaterial = new THREE.MeshBasicMaterial({ color: new THREE.Color(RUDA_3D_PALETTE.paperDeep), transparent: true, opacity: 0.85 });
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -1.72;
    scene.add(floor);

    return {
      update: (_dt, t) => {
        // 缓慢环绕 + 灯光呼吸，幅度刻意很小，避免「整站都在动」的廉价感
        panel.rotation.y = Math.sin(t * 0.22) * orbitAmount;
        panel.position.y = Math.sin(t * 0.6) * 0.05;
        panel.rotation.x = Math.sin(t * 0.17) * 0.02;
        key.intensity = 1.35 + Math.sin(t * 0.45) * 0.18;
      },
      dispose: () => {
        geometry.dispose();
        material.dispose();
        floorGeometry.dispose();
        floorMaterial.dispose();
        texture?.dispose();
      }
    };
  }, [image, orbitAmount]);

  return (
    <figure className={className}>
      <Premium3DScene
        label={alt}
        poster={image}
        posterAlt={alt}
        ratio={ratio}
        enabled={enabled}
        quality={quality}
        className="!bg-[#f7f5f1]"
        placeholderClassName="bg-[#f2eee8]"
        setup={setup}
      />
      {caption && <figcaption className="mt-3 text-xs tracking-[0.2em] uppercase text-neutral-500">{caption}</figcaption>}
    </figure>
  );
};
