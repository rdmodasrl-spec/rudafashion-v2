/**
 * Ruda3DMaterialViewer —— 材质查看器（皮革 / 五金 / 哑光 / 玻璃）。
 * 用真实 PBR 材质与影棚灯光演示质感；参数是设计演示，不代表商家工艺成分。
 */
import React, { useCallback } from 'react';
import { Premium3DScene, type SceneSetupContext, type SceneHandle } from '../Premium3DScene';
import type { Premium3DQuality } from '../capability';
import { buildLightingRig, buildStudioEnvironment, buildStudioFloor } from './LightingSystem';
import { createHardwareMaterial, createLeatherMaterial } from './leatherMaterial';

export type Ruda3DMaterialKind = 'leather' | 'hardware' | 'matte' | 'glass';

export type Ruda3DMaterialViewerProps = {
  kind?: Ruda3DMaterialKind;
  color?: string;
  label?: string;
  quality?: Premium3DQuality;
  enabled?: boolean;
  ratio?: string;
  className?: string;
};

const KIND_LABEL: Record<Ruda3DMaterialKind, string> = {
  leather: '皮革 · 细密颗粒与柔和高光',
  hardware: '五金 · 拉丝金属反射',
  matte: '哑光 · 低反射表面',
  glass: '玻璃 · 透射与边缘折射'
};

export const Ruda3DMaterialViewer: React.FC<Ruda3DMaterialViewerProps> = ({
  kind = 'leather',
  color,
  label,
  quality = 'high',
  enabled = true,
  ratio = '1 / 1',
  className = ''
}) => {
  const setup = useCallback((ctx: SceneSetupContext): SceneHandle => {
    const { THREE, renderer, scene, camera, pointer } = ctx;
    renderer.setClearColor(0x000000, 0);
    const env = buildStudioEnvironment(THREE);
    scene.environment = env;
    const rig = buildLightingRig(THREE, scene, renderer, 'studio');
    const floor = buildStudioFloor(THREE, '#f4f0ea');
    scene.add(floor);

    const geometry = new THREE.TorusKnotGeometry(0.92, 0.32, quality === 'low' ? 96 : 180, quality === 'low' ? 12 : 24);
    let material: import('three').Material;
    let extraDispose: () => void = () => {};
    if (kind === 'leather') {
      const leather = createLeatherMaterial(THREE, { color: color ?? '#7a5c3e' });
      material = leather.material;
      extraDispose = leather.dispose;
    } else if (kind === 'hardware') {
      const hardware = createHardwareMaterial(THREE, 'gold');
      material = hardware.material;
      extraDispose = hardware.dispose;
    } else if (kind === 'glass') {
      material = new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(color ?? '#ffffff'),
        roughness: 0.05,
        metalness: 0,
        transmission: 0.92,
        thickness: 0.6,
        ior: 1.46,
        envMapIntensity: 1.8
      });
    } else {
      material = new THREE.MeshStandardMaterial({ color: new THREE.Color(color ?? '#d9d2c7'), roughness: 0.95, metalness: 0.02 });
    }
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
    camera.position.set(0, 0.5, 4.3);
    camera.lookAt(0, 0, 0);

    return {
      update: (_dt, elapsed) => {
        mesh.rotation.y = elapsed * 0.42 + pointer.current.x * 0.4;
        mesh.rotation.x = Math.sin(elapsed * 0.3) * 0.22 + pointer.current.y * 0.18;
        mesh.position.y = Math.sin(elapsed * 0.8) * 0.04;
        rig.update?.(elapsed);
      },
      dispose: () => {
        rig.dispose();
        geometry.dispose();
        material.dispose();
        extraDispose();
        scene.remove(mesh, floor);
        floor.geometry.dispose();
        env.dispose();
      }
    };
  }, [kind, color, quality]);

  return (
    <figure className={className}>
      <Premium3DScene
        label={label || KIND_LABEL[kind]}
        ratio={ratio}
        enabled={enabled}
        quality={quality}
        interactive
        className="!bg-[#f4f0ea]"
        placeholderClassName="bg-[#f2eee8]"
        setup={setup}
      />
      <figcaption className="mt-3 text-xs text-neutral-500">{KIND_LABEL[kind]}</figcaption>
    </figure>
  );
};
