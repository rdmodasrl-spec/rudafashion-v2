/**
 * Ruda3DShowroom —— 3D 展厅：多件真实商品在环形空间中排布，可水平推进浏览。
 * 用于首页「系列陈列」区块，与商品网格互补（网格负责效率，展厅负责氛围）。
 */
import React, { useCallback } from 'react';
import { Premium3DScene, type SceneSetupContext, type SceneHandle } from '../Premium3DScene';
import type { Premium3DQuality } from '../capability';
import { buildLightingRig, buildStudioEnvironment, buildStudioFloor } from './LightingSystem';
import { buildPhotoSubject } from './sceneKit';

export type ShowroomItem = { id: string; image: string; title: string; styleNo?: string };

export type Ruda3DShowroomProps = {
  items: ShowroomItem[];
  onSelect?: (id: string) => void;
  quality?: Premium3DQuality;
  enabled?: boolean;
  ratio?: string;
  className?: string;
  label?: string;
};

export const Ruda3DShowroom: React.FC<Ruda3DShowroomProps> = ({
  items,
  onSelect,
  quality = 'high',
  enabled = true,
  ratio = '16 / 9',
  className = '',
  label = '3D 展厅'
}) => {
  const setup = useCallback(async (ctx: SceneSetupContext): Promise<SceneHandle> => {
    const { THREE, renderer, scene, camera, pointer } = ctx;
    renderer.setClearColor(0x000000, 0);
    const env = buildStudioEnvironment(THREE);
    scene.environment = env;
    const rig = buildLightingRig(THREE, scene, renderer, 'showcase');
    const floor = buildStudioFloor(THREE, '#f4f0e9');
    scene.add(floor);

    const list = items.slice(0, 6);
    const handles = await Promise.all(list.map(item => buildPhotoSubject(THREE, item.image, { height: 2.05 }).catch(() => null)));
    const usable = handles.filter((handle): handle is NonNullable<typeof handle> => Boolean(handle));

    const radius = 3.4;
    usable.forEach((handle, index) => {
      const span = usable.length === 1 ? 0 : index / (usable.length - 1);
      const angle = (span - 0.5) * 1.25;
      handle.group.position.set(Math.sin(angle) * radius, 0, Math.cos(angle) * radius - radius + 1.2);
      handle.group.rotation.y = -angle;
      scene.add(handle.group);
    });

    camera.position.set(0, 0.35, 6.4);
    camera.lookAt(0, 0, 0);

    return {
      update: (_dt, elapsed) => {
        usable.forEach((handle, index) => {
          handle.update(elapsed + index * 0.4);
        });
        camera.position.x = pointer.current.x * 0.9;
        camera.position.y = 0.35 - pointer.current.y * 0.2;
        camera.lookAt(pointer.current.x * 0.3, 0, 0);
        rig.update?.(elapsed);
      },
      dispose: () => {
        rig.dispose();
        usable.forEach(handle => { handle.dispose(); scene.remove(handle.group); });
        scene.remove(floor);
        floor.geometry.dispose();
        env.dispose();
      }
    };
  }, [items.map(item => item.id).join('|')]);

  return (
    <div className={className}>
      <Premium3DScene
        label={label}
        poster={items[0]?.image}
        posterAlt={label}
        ratio={ratio}
        enabled={enabled}
        quality={quality}
        interactive
        className="!bg-[#f4f0e9]"
        placeholderClassName="bg-[#f2eee8]"
        setup={setup}
      />
      {onSelect && (
        <ul className="mt-4 flex flex-wrap gap-2">
          {items.slice(0, 6).map(item => (
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
