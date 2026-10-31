/**
 * 高级商品画廊：真实商品图沿弧线排布在 3D 空间，可拖拽/滚动旋转，点击进入商品。
 */
import React, { useCallback } from 'react';
import { Premium3DScene, type SceneSetupContext, type SceneHandle } from './Premium3DScene';
import { loadTextureWithFallback, RUDA_3D_PALETTE, type Premium3DQuality } from './capability';

export type GalleryArcItem = { id: string; image: string; title: string };

export type GalleryArc3DProps = {
  items: GalleryArcItem[];
  onSelect?: (id: string) => void;
  quality?: Premium3DQuality;
  enabled?: boolean;
  ratio?: string;
  className?: string;
};

export const GalleryArc3D: React.FC<GalleryArc3DProps> = ({
  items,
  onSelect,
  quality = 'high',
  enabled = true,
  ratio = '16 / 7',
  className = ''
}) => {
  const setup = useCallback(async (ctx: SceneSetupContext): Promise<SceneHandle> => {
    const { THREE, renderer, scene, camera } = ctx;
    renderer.setClearColor(0x000000, 0);
    camera.position.set(0, 0.4, 7.4);
    camera.lookAt(0, 0, 0);
    scene.add(new THREE.AmbientLight(0xffffff, 1.6));

        const load = (url: string) => new Promise<import('three').Texture | null>(resolve => {
      loadTextureWithFallback(THREE, url).then(resolve, () => resolve(null));
    });

    const list = items.slice(0, 9);
    const textures = await Promise.all(list.map(item => load(item.image)));
    const group = new THREE.Group();
    scene.add(group);

    const planes: Array<import('three').Mesh> = [];
    const radius = 5.2;
    list.forEach((item, index) => {
      const texture = textures[index];
      const angle = (index - (list.length - 1) / 2) * 0.34;
      const geometry = new THREE.PlaneGeometry(1.62, 2.02, 1, 1);
      const material = texture
        ? new THREE.MeshBasicMaterial({ map: texture, transparent: true })
        : new THREE.MeshBasicMaterial({ color: new THREE.Color(RUDA_3D_PALETTE.paperDeep) });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(Math.sin(angle) * radius, 0, Math.cos(angle) * radius - radius + 1.1);
      mesh.rotation.y = -angle;
      group.add(mesh);
      planes.push(mesh);
      void item;
    });

    let rotation = 0;
    let velocity = 0;
    let dragging = false;
    let lastX = 0;
    const host = renderer.domElement.parentElement;
    const down = (e: PointerEvent) => { dragging = true; lastX = e.clientX; };
    const move = (e: PointerEvent) => {
      if (!dragging) return;
      velocity = (e.clientX - lastX) / 420;
      rotation += velocity;
      lastX = e.clientX;
    };
    const up = () => { dragging = false; };
    host?.addEventListener('pointerdown', down);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);

    return {
      update: (dt, t) => {
        if (!dragging) { rotation += velocity; velocity *= 0.93; rotation += dt * 0.05; }
        planes.forEach((mesh, index) => {
          const baseAngle = (index - (planes.length - 1) / 2) * 0.34 + rotation;
          mesh.position.x = Math.sin(baseAngle) * radius;
          mesh.position.z = Math.cos(baseAngle) * radius - radius + 1.1;
          mesh.rotation.y = -baseAngle;
          mesh.position.y = Math.sin(t * 0.5 + index) * 0.05;
        });
      },
      dispose: () => {
        host?.removeEventListener('pointerdown', down);
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
        planes.forEach(mesh => {
          mesh.geometry.dispose();
          const material = mesh.material as import('three').Material & { map?: import('three').Texture };
          material.map?.dispose();
          material.dispose();
        });
      }
    };
  }, [items.map(item => item.id).join('|')]);

  return (
    <div className={className}>
      <Premium3DScene
        label="商品画廊，可拖拽浏览"
        ratio={ratio}
        enabled={enabled}
        quality={quality}
        className="!bg-neutral-50"
        placeholderClassName="bg-neutral-100"
        setup={setup}
      />
      {onSelect && (
        <ul className="mt-4 flex flex-wrap gap-2">
          {items.slice(0, 9).map(item => (
            <li key={item.id}>
              <button type="button" onClick={() => onSelect(item.id)} className="border border-neutral-300 px-3 py-1.5 text-xs hover:border-neutral-950">
                {item.title}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
