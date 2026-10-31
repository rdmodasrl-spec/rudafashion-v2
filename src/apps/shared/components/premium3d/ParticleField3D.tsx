/**
 * 动态粒子背景：GPU 点云缓慢漂移，用于品牌区块与页脚过渡。
 */
import React, { useCallback } from 'react';
import { Premium3DScene, type SceneSetupContext, type SceneHandle } from './Premium3DScene';
import { RUDA_3D_PALETTE, type Premium3DQuality } from './capability';

export type ParticleField3DProps = {
  label?: string;
  count?: number;
  color?: string;
  /** 漂移速度 */
  speed?: number;
  quality?: Premium3DQuality;
  enabled?: boolean;
  ratio?: string;
  className?: string;
};

export const ParticleField3D: React.FC<ParticleField3DProps> = ({
  label = '粒子动态背景',
  count,
  color = RUDA_3D_PALETTE.inkSoft,
  speed = 0.22,
  quality = 'high',
  enabled = true,
  ratio = '16 / 9',
  className = ''
}) => {
  const total = count ?? (quality === 'low' ? 900 : 2400);

  const setup = useCallback((ctx: SceneSetupContext): SceneHandle => {
    const { THREE, renderer, scene, camera, pointer } = ctx;
    renderer.setClearColor(0x000000, 0);
    camera.position.z = 6;

    const positions = new Float32Array(total * 3);
    const seeds = new Float32Array(total);
    for (let i = 0; i < total; i += 1) {
      positions[i * 3] = (Math.random() - 0.5) * 12;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 7;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 6;
      seeds[i] = Math.random();
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));

    const material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: { uColor: { value: new THREE.Color(color) }, uTime: { value: 0 }, uPointer: { value: new THREE.Vector2() } },
      vertexShader: /* glsl */ `
        attribute float aSeed;
        uniform float uTime;
        uniform vec2 uPointer;
        varying float vAlpha;
        void main() {
          vec3 p = position;
          p.y += sin(uTime * 0.35 + aSeed * 6.2831) * 0.28;
          p.x += cos(uTime * 0.22 + aSeed * 4.188) * 0.2;
          p.x += uPointer.x * 0.22 * (0.4 + aSeed);
          p.y += -uPointer.y * 0.16 * (0.4 + aSeed);
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_PointSize = (1.0 + aSeed * 2.4) * (18.0 / -mv.z);
          gl_Position = projectionMatrix * mv;
          vAlpha = 0.18 + aSeed * 0.5;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uColor;
        varying float vAlpha;
        void main() {
          vec2 d = gl_PointCoord - vec2(0.5);
          float falloff = smoothstep(0.5, 0.0, length(d));
          gl_FragColor = vec4(uColor, vAlpha * falloff);
        }
      `
    });

    const points = new THREE.Points(geometry, material);
    scene.add(points);

    return {
      update: (_dt, t) => {
        material.uniforms.uTime.value = t * speed * 4;
        material.uniforms.uPointer.value.set(pointer.current.x, pointer.current.y);
        points.rotation.y = t * speed * 0.06;
      },
      dispose: () => { geometry.dispose(); material.dispose(); }
    };
  }, [total, color, speed]);

  return (
    <Premium3DScene
      label={label}
      ratio={ratio}
      enabled={enabled}
      quality={quality}
      interactive
      className={className}
      placeholderClassName="bg-neutral-100"
      setup={setup}
    />
  );
};
