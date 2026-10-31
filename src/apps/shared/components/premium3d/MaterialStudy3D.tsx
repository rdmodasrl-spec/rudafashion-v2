/**
 * 材质研究台：用 PBR 光照展示皮革 / 金属 / 哑光 / 半透明质感。
 * 用于箱包（皮革）、珠宝（金属反射）、美妆（液体光）等行业的材质叙事区块。
 * 材质参数是设计演示，不宣称商家工艺。
 */
import React, { useCallback } from 'react';
import { Premium3DScene, type SceneSetupContext, type SceneHandle } from './Premium3DScene';
import { textureUrlCandidates, RUDA_3D_PALETTE, type Premium3DQuality } from './capability';

export type MaterialPreset = 'leather' | 'metal' | 'matte' | 'glass';

export type MaterialStudy3DProps = {
  preset?: MaterialPreset;
  color?: string;
  label?: string;
  quality?: Premium3DQuality;
  enabled?: boolean;
  ratio?: string;
  className?: string;
};

const PRESETS: Record<MaterialPreset, { roughness: number; metalness: number; clearcoat: number; label: string }> = {
  leather: { roughness: 0.72, metalness: 0.06, clearcoat: 0.12, label: '皮革' },
  metal: { roughness: 0.16, metalness: 0.98, clearcoat: 0.4, label: '金属' },
  matte: { roughness: 0.92, metalness: 0.02, clearcoat: 0.02, label: '哑光' },
  glass: { roughness: 0.08, metalness: 0.2, clearcoat: 1, label: '玻璃' }
};

export const MaterialStudy3D: React.FC<MaterialStudy3DProps> = ({
  preset = 'leather',
  color = RUDA_3D_PALETTE.leather,
  label,
  quality = 'high',
  enabled = true,
  ratio = '1 / 1',
  className = ''
}) => {
  const setup = useCallback((ctx: SceneSetupContext): SceneHandle => {
    const { THREE, renderer, scene, camera, pointer } = ctx;
    renderer.setClearColor(0x000000, 0);
    camera.position.set(0, 0.2, 5.2);
    camera.lookAt(0, 0, 0);

    const config = PRESETS[preset];
    const ambient = new THREE.AmbientLight(0xffffff, 0.55);
    scene.add(ambient);
    const key = new THREE.DirectionalLight(0xffffff, 2.1);
    key.position.set(3, 4, 3.4);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xffffff, 0.8);
    fill.position.set(-3.4, -1.2, 2.4);
    scene.add(fill);
    const rim = new THREE.PointLight(new THREE.Color('#ffffff'), 4.2, 12);
    rim.position.set(-2.2, 1.6, -2.6);
    scene.add(rim);

    // 环境反射贴图：用程序化立方体渐变，避免引入外部 HDR 资源
    const size = 128;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext('2d');
    if (context) {
      const gradient = context.createLinearGradient(0, 0, 0, size);
      gradient.addColorStop(0, '#ffffff');
      gradient.addColorStop(0.5, '#e8e2d8');
      gradient.addColorStop(1, '#9d968c');
      context.fillStyle = gradient;
      context.fillRect(0, 0, size, size);
    }
    const envTexture = new THREE.CanvasTexture(canvas);
    envTexture.mapping = THREE.EquirectangularReflectionMapping;
    envTexture.colorSpace = THREE.SRGBColorSpace;
    scene.environment = envTexture;

    const geometry = new THREE.IcosahedronGeometry(1.42, quality === 'low' ? 4 : 6);
    const material = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(color),
      roughness: config.roughness,
      metalness: config.metalness,
      clearcoat: config.clearcoat,
      clearcoatRoughness: 0.35,
      envMapIntensity: preset === 'glass' ? 1.4 : 1.05,
      transparent: preset === 'glass',
      opacity: preset === 'glass' ? 0.82 : 1
    });
    const sphere = new THREE.Mesh(geometry, material);
    scene.add(sphere);

    const groundGeometry = new THREE.CircleGeometry(2.1, 64);
    const groundMaterial = new THREE.MeshBasicMaterial({ color: new THREE.Color(RUDA_3D_PALETTE.paperDeep), transparent: true, opacity: 0.9 });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.position.y = -1.55;
    ground.rotation.x = -Math.PI / 2;
    scene.add(ground);

    return {
      update: (_dt, t) => {
        sphere.rotation.y = t * 0.22 + pointer.current.x * 0.3;
        sphere.rotation.x = Math.sin(t * 0.18) * 0.12 + pointer.current.y * 0.1;
        sphere.position.y = Math.sin(t * 0.7) * 0.04;
      },
      dispose: () => {
        geometry.dispose();
        material.dispose();
        groundGeometry.dispose();
        groundMaterial.dispose();
        envTexture.dispose();
      }
    };
  }, [preset, color, quality]);

  return (
    <figure className={className}>
      <Premium3DScene
        label={label || `${PRESETS[preset].label}材质展示，可拖动查看反光`}
        ratio={ratio}
        enabled={enabled}
        quality={quality}
        interactive
        className="!bg-[#f7f5f1]"
        placeholderClassName="bg-[#f2eee8]"
        setup={setup}
      />
      <figcaption className="mt-3 text-center text-xs tracking-[0.24em] uppercase text-neutral-500">{PRESETS[preset].label}</figcaption>
    </figure>
  );
};
