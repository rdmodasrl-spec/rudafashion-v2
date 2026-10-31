/**
 * Ruda3DGallery —— 3D 商品画廊（弧面排布 + 点击进入商品）。
 * 与 Showroom 的差别：Gallery 强调「浏览/挑选」，Showroom 强调「陈列氛围」。
 */
import React, { useCallback } from 'react';
import { Premium3DScene, type SceneSetupContext, type SceneHandle } from '../Premium3DScene';
import type { Premium3DQuality } from '../capability';
import { buildLightingRig, buildStudioEnvironment } from './LightingSystem';
import { buildPhotoSubject } from './sceneKit';

export type Gallery3DItem = { id: string; image: string; title: string };

export type Ruda3DGalleryProps = {
  items: Gallery3DItem[];
  onSelect?: (id: string) => void;
  quality?: Premium3DQuality;
  enabled?: boolean;
  ratio?: string;
  className?: string;
};

export const Ruda3DGallery: React.FC<Ruda3DGalleryProps> = ({
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
    const env = buildStudioEnvironment(THREE);
    scene.environment = env;
    const rig = buildLightingRig(THREE, scene, renderer, 'softbox');

    const list = items.slice(0, 7);
    const handles = await Promise.all(list.map(item => buildPhotoSubject(THREE, item.image, { height: 2.0 }).catch(() => null)));
    const usable = handles.filter((handle): handle is NonNullable<typeof handle> => Boolean(handle));
    const radius = 3.6;
    usable.forEach((handle, index) => {
      const span = usable.length === 1 ? 0 : index / (usable.length - 1) - 0.5;
      const angle = span * 1.15;
      handle.group.position.set(Math.sin(angle) * radius, 0, Math.cos(angle) * radius - radius + 1.0);
      handle.group.rotation.y = -angle * 0.8;
      scene.add(handle.group);
    });

    camera.position.set(0, 0.35, 7.4);
    camera.lookAt(0, 0, 0);

    let rotation = 0;
    let velocity = 0;
    let dragging = false;
    let lastX = 0;
    const host = renderer.domElement.parentElement;
    const down = (event: PointerEvent) => { dragging = true; lastX = event.clientX; };
    const move = (event: PointerEvent) => {
      if (!dragging) return;
      velocity = (event.clientX - lastX) / 900;
      rotation += velocity;
      lastX = event.clientX;
    };
    const up = () => { dragging = false; };
    host?.addEventListener('pointerdown', down);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);

    return {
      update: (dt, elapsed) => {
        if (!dragging) { rotation += velocity; velocity *= 0.9; rotation += dt * 0.04; }
        usable.forEach((handle, index) => {
          const span = usable.length === 1 ? 0 : index / (usable.length - 1) - 0.5;
          const angle = span * 1.15 + rotation * 0.6;
          handle.group.position.x = Math.sin(angle) * radius;
          handle.group.position.z = Math.cos(angle) * radius - radius + 1.0;
          handle.group.rotation.y = -angle;
          handle.update(elapsed + index * 0.3);
        });
        rig.update?.(elapsed);
      },
      dispose: () => {
        host?.removeEventListener('pointerdown', down);
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
        rig.dispose();
        usable.forEach(handle => { handle.dispose(); scene.remove(handle.group); });
        env.dispose();
      }
    };
  }, [items.map(item => item.id).join('|')]);

  return (
    <div className={className}>
      <Premium3DScene
        label="3D 商品画廊，可拖拽浏览"
        poster={items[0]?.image}
        posterAlt="商品画廊"
        ratio={ratio}
        enabled={enabled}
        quality={quality}
        className="!bg-[#f5f2ec]"
        placeholderClassName="bg-[#f2eee8]"
        setup={setup}
      />
      {onSelect && (
        <ul className="mt-4 flex flex-wrap gap-2">
          {items.slice(0, 7).map(item => (
            <li key={item.id}>
              <button type="button" onClick={() => onSelect(item.id)} className="border border-neutral-300 px-3 py-1.5 text-xs hover:border-neutral-950">{item.title}</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
