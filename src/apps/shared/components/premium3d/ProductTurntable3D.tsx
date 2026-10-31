/**
 * 3D 商品转台：用商家真实商品图做纹理，指针拖拽旋转、悬停放大、自动慢速回转。
 *
 * 使用场景：箱包/珠宝/美妆/家具/电子等需要「看细节」的商品详情首屏。
 * 商品图本身是平面照片，这里通过倾斜的立体展台 + 视差 + 高光让照片获得体积感，
 * 不伪造不存在的几何结构，也不编造商品信息。
 */
import React, { useCallback } from 'react';
import { Premium3DScene, type SceneSetupContext, type SceneHandle } from './Premium3DScene';
import { loadTextureWithFallback, RUDA_3D_PALETTE, type Premium3DQuality } from './capability';

export type ProductTurntable3DProps = {
  images: string[];
  productName: string;
  productCode?: string;
  /** 展台颜色，默认 RUDA 纸感中性色 */
  stageColor?: string;
  /** 每秒自动旋转角度 */
  autoRotateSpeed?: number;
  quality?: Premium3DQuality;
  enabled?: boolean;
  ratio?: string;
  className?: string;
  onSelectImage?: (index: number) => void;
};

export const ProductTurntable3D: React.FC<ProductTurntable3DProps> = ({
  images,
  productName,
  productCode,
  stageColor = RUDA_3D_PALETTE.paperDeep,
  autoRotateSpeed = 6,
  quality = 'high',
  enabled = true,
  ratio = '4 / 5',
  className = '',
  onSelectImage
}) => {
  const usable = images.filter(Boolean);

  const setup = useCallback(async (ctx: SceneSetupContext): Promise<SceneHandle> => {
    const { THREE, renderer, scene, camera, pointer } = ctx;
    renderer.setClearColor(0x000000, 0);
    scene.background = null;

    camera.position.set(0, 0.35, 4.1);
    camera.lookAt(0, 0, 0);

    const loadTexture = (url: string) => loadTextureWithFallback(THREE, url, texture => {
      texture.anisotropy = quality === 'low' ? 2 : 8;
    });

    const textures = (await Promise.all(usable.slice(0, 4).map(url => loadTexture(url).catch(() => null))))
      .filter((texture): texture is import('three').Texture => Boolean(texture));
    const firstTexture = textures[0];
    if (!firstTexture) throw new Error('turntable: no texture');

    scene.add(new THREE.AmbientLight(0xffffff, 1.15));
    const key = new THREE.DirectionalLight(0xffffff, 1.35);
    key.position.set(2.4, 3.2, 2.6);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0xffffff, 0.5);
    rim.position.set(-2.6, 1.2, -2.2);
    scene.add(rim);

    // 展台：低矮圆柱 + 柔和环，给商品一个落点，不喧宾夺主
    const stageGeometry = new THREE.CylinderGeometry(1.62, 1.72, 0.16, 64);
    const stageMaterial = new THREE.MeshStandardMaterial({ color: new THREE.Color(stageColor), roughness: 0.92, metalness: 0.02 });
    const stage = new THREE.Mesh(stageGeometry, stageMaterial);
    stage.position.y = -0.92;
    scene.add(stage);

    const ringGeometry = new THREE.RingGeometry(1.66, 1.74, 64);
    const ringMaterial = new THREE.MeshBasicMaterial({ color: new THREE.Color(RUDA_3D_PALETTE.line), transparent: true, opacity: 0.85, side: THREE.DoubleSide });
    const ring = new THREE.Mesh(ringGeometry, ringMaterial);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = -0.835;
    scene.add(ring);

    // 商品：带轻微厚度的圆角板，正面贴真实商品图，产生「实体卡片」的厚度与边缘光
    const aspectOf = (texture: import('three').Texture) => {
      const image = texture.image as { width?: number; height?: number } | undefined;
      return image?.width && image?.height ? image.width / image.height : 1;
    };
    const boxGroup = new THREE.Group();
    scene.add(boxGroup);

    const buildCard = (texture: import('three').Texture) => {
      const aspect = aspectOf(texture);
      const height = 2.1;
      const width = Math.min(1.95, height * aspect);
      const geometry = new THREE.BoxGeometry(width, height, 0.075, 1, 1, 1);
      const side = new THREE.MeshStandardMaterial({ color: new THREE.Color('#f7f4ef'), roughness: 0.72, metalness: 0.04 });
      const front = new THREE.MeshStandardMaterial({ map: texture, roughness: 0.58, metalness: 0.03 });
      const materials = [side, side, side, side, front, side];
      const mesh = new THREE.Mesh(geometry, materials);
      mesh.position.y = 0.18;
      return mesh;
    };

    let currentMesh = buildCard(firstTexture);
    boxGroup.add(currentMesh);
    let activeIndex = 0;

    const disposeMesh = (mesh: import('three').Mesh) => {
      mesh.geometry.dispose();
      (mesh.material as import('three').Material[]).forEach(material => material.dispose());
    };

    let suggestedIndex = -1;
    const clearSuggested = () => {
      if (suggestedIndex < 0) return;
      const next = textures[suggestedIndex];
      if (!next) { suggestedIndex = -1; return; }
      const replacement = buildCard(next);
      boxGroup.remove(currentMesh);
      disposeMesh(currentMesh);
      currentMesh = replacement;
      boxGroup.add(currentMesh);
      activeIndex = suggestedIndex;
      suggestedIndex = -1;
    };

    let rotation = 0.35;
    let dragging = false;
    let lastX = 0;
    let velocity = 0;
    let hover = false;

    const host = renderer.domElement.parentElement;
    const onPointerDown = (event: PointerEvent) => {
      dragging = true;
      lastX = event.clientX;
      velocity = 0;
      host?.setPointerCapture?.(event.pointerId);
    };
    const onPointerUp = (event: PointerEvent) => {
      dragging = false;
      host?.releasePointerCapture?.(event.pointerId);
      if (suggestedIndex >= 0) clearSuggested();
    };
    const onPointerMove = (event: PointerEvent) => {
      if (!dragging) return;
      const delta = (event.clientX - lastX) / 260;
      lastX = event.clientX;
      rotation += delta;
      velocity = delta;
      // 拖过约 90° 切下一张图，让「转」有信息量而不是空转
      if (Math.abs(rotation) > 1.35 && textures.length > 1) {
        suggestedIndex = (activeIndex + 1) % textures.length;
        rotation = rotation > 0 ? rotation - 1.35 : rotation + 1.35;
        onSelectImage?.(suggestedIndex);
      }
    };
    host?.addEventListener('pointerdown', onPointerDown);
    host?.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    host?.addEventListener('pointerenter', () => { hover = true; });
    host?.addEventListener('pointerleave', () => { hover = false; });

    return {
      update: (dt, t) => {
        if (!dragging) {
          rotation += velocity * 0.9;
          velocity *= 0.92;
          const autoSpeed = hover ? autoRotateSpeed * 0.25 : autoRotateSpeed;
          rotation += (autoSpeed * Math.PI / 180) * dt;
        }
        boxGroup.rotation.y = rotation;
        boxGroup.rotation.x = -0.06 + pointer.current.y * 0.05;
        boxGroup.position.x = pointer.current.x * 0.06;
        boxGroup.position.y = 0.18 + Math.sin(t * 0.7) * 0.035;
        camera.position.z = 4.1 - Math.min(0.25, pointer.current.y * -0.12);
        camera.lookAt(0, 0.1, 0);
      },
      dispose: () => {
        host?.removeEventListener('pointerdown', onPointerDown);
        host?.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerup', onPointerUp);
        disposeMesh(currentMesh);
        stageGeometry.dispose();
        stageMaterial.dispose();
        ringGeometry.dispose();
        ringMaterial.dispose();
        textures.forEach(texture => texture.dispose());
      }
    };
  }, [usable.join('|'), stageColor, autoRotateSpeed, quality, onSelectImage]);

  return (
    <figure className={`relative ${className}`}>
      <Premium3DScene
        label={`${productName} 三维展示，可拖拽查看`}
        poster={usable[0]}
        posterAlt={productName}
        ratio={ratio}
        enabled={enabled}
        quality={quality}
        interactive
        placeholderClassName="bg-[#f2eee8]"
        setup={setup}
      />
      <figcaption className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 bg-gradient-to-t from-black/35 to-transparent px-4 pb-3 pt-10 text-white">
        <span className="text-xs tracking-[0.16em] uppercase">拖拽查看细节</span>
        {productCode && <span className="text-xs tabular-nums opacity-80">{productCode}</span>}
      </figcaption>
    </figure>
  );
};
