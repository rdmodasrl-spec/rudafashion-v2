/**
 * 动态品牌文字：把商家名称采样成粒子，形成可浮动的 3D 字标。
 * 文字来自真实商家名称，不做装饰性假文案。
 */
import React, { useCallback } from 'react';
import { Premium3DScene, type SceneSetupContext, type SceneHandle } from './Premium3DScene';
import { RUDA_3D_PALETTE, type Premium3DQuality } from './capability';

export type BrandWordmark3DProps = {
  text: string;
  subline?: string;
  color?: string;
  fontFamily?: string;
  quality?: Premium3DQuality;
  enabled?: boolean;
  ratio?: string;
  className?: string;
  /** 供性能实验室读取实时帧率 */
  onFps?: (fps: number) => void;
};

export const BrandWordmark3D: React.FC<BrandWordmark3DProps> = ({
  text,
  subline,
  color = RUDA_3D_PALETTE.ink,
  fontFamily = 'Manrope, "Noto Sans SC", system-ui, sans-serif',
  quality = 'high',
  enabled = true,
  ratio = '16 / 6',
  className = '',
  onFps
}) => {
  const setup = useCallback((ctx: SceneSetupContext): SceneHandle => {
    const { THREE, renderer, scene, camera, pointer } = ctx;
    renderer.setClearColor(0x000000, 0);

    const canvas = document.createElement('canvas');
    const width = quality === 'low' ? 1024 : 1600;
    const height = Math.round(width / 3.4);
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('wordmark: canvas 2d unavailable');
    context.fillStyle = '#000';
    context.fillRect(0, 0, width, height);
    context.fillStyle = '#fff';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    const fittedSize = Math.min(height * 0.52, (width * 0.86) / Math.max(3, text.length * 0.62));
    context.font = `700 ${fittedSize}px ${fontFamily}`;
    context.fillText(text, width / 2, height / 2);

    const pixels = context.getImageData(0, 0, width, height).data;
    const step = quality === 'low' ? 9 : 6;
    const positions: number[] = [];
    for (let y = 0; y < height; y += step) {
      for (let x = 0; x < width; x += step) {
        if (pixels[(y * width + x) * 4] > 160) {
          positions.push(
            (x / width - 0.5) * 6.4,
            -(y / height - 0.5) * (6.4 / (width / height)),
            (Math.random() - 0.5) * 0.34
          );
        }
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    const material = new THREE.PointsMaterial({ color: new THREE.Color(color), size: quality === 'low' ? 0.038 : 0.03, transparent: true, opacity: 0.94, sizeAttenuation: true });
    const points = new THREE.Points(geometry, material);
    scene.add(points);

    const aspect = width / height;
    camera.position.set(0, 0, 5.6);
    camera.fov = Math.min(60, 42 / Math.min(1.8, aspect / 1.6));
    camera.updateProjectionMatrix();

    return {
      update: (_dt, t) => {
        points.rotation.y = Math.sin(t * 0.25) * 0.16 + pointer.current.x * 0.12;
        points.rotation.x = pointer.current.y * 0.06;
        points.position.y = Math.sin(t * 0.6) * 0.03;
      },
      dispose: () => { geometry.dispose(); material.dispose(); }
    };
  }, [text, color, fontFamily, quality]);

  return (
    <figure className={className}>
      <Premium3DScene
        label={`${text} 品牌字标`}
        ratio={ratio}
        enabled={enabled}
        quality={quality}
        interactive
        className="!bg-transparent"
        placeholderClassName="bg-neutral-50"
        onFps={onFps}
        setup={setup}
      />
      {subline && <figcaption className="mt-3 text-center text-xs tracking-[0.28em] uppercase text-neutral-500">{subline}</figcaption>}
    </figure>
  );
};
