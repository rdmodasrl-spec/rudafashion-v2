/**
 * 流体/Shader 背景：全屏噪声流动场，取 RUDA 暖中性色，不引入品牌外渐变。
 * 用作首页首屏或区块背景，位于内容之下，透明叠加。
 */
import React, { useCallback } from 'react';
import { Premium3DScene, type SceneSetupContext, type SceneHandle } from './Premium3DScene';
import { RUDA_3D_PALETTE, type Premium3DQuality } from './capability';

export type FluidBackdrop3DProps = {
  label?: string;
  /** 流动速度倍率 */
  speed?: number;
  /** 主色，默认 RUDA 暖中性 */
  tint?: string;
  quality?: Premium3DQuality;
  enabled?: boolean;
  ratio?: string;
  className?: string;
};

const VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position, 1.0);
  }
`;

const FRAGMENT = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform float uTime;
  uniform vec3 uTint;
  uniform vec3 uPaper;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
               mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
  }

  float fbm(vec2 p) {
    float value = 0.0;
    float amplitude = 0.5;
    for (int i = 0; i < 5; i++) {
      value += amplitude * noise(p);
      p *= 2.02;
      amplitude *= 0.5;
    }
    return value;
  }

  void main() {
    vec2 uv = vUv;
    float t = uTime * 0.06;
    vec2 flow = vec2(fbm(uv * 2.4 + vec2(t, -t)), fbm(uv * 2.1 + vec2(-t * 0.8, t * 0.6)));
    float body = fbm(uv * 1.7 + flow * 1.9 + vec2(t * 0.4));
    float band = smoothstep(0.35, 0.95, body);
    vec3 color = mix(uPaper, uTint, band * 0.55);
    float grain = hash(uv * 1200.0) * 0.035;
    color += grain;
    float vignette = smoothstep(1.25, 0.25, distance(uv, vec2(0.5)));
    gl_FragColor = vec4(color, 0.92 * vignette);
  }
`;

export const FluidBackdrop3D: React.FC<FluidBackdrop3DProps> = ({
  label = '流体动态背景',
  speed = 1,
  tint = RUDA_3D_PALETTE.paperDeep,
  quality = 'high',
  enabled = true,
  ratio = '16 / 9',
  className = ''
}) => {
  const setup = useCallback((ctx: SceneSetupContext): SceneHandle => {
    const { THREE, renderer, scene } = ctx;
    renderer.setClearColor(0x000000, 0);
    const uniforms = {
      uTime: { value: 0 },
      uTint: { value: new THREE.Color(tint) },
      uPaper: { value: new THREE.Color(RUDA_3D_PALETTE.paper) }
    };
    const geometry = new THREE.PlaneGeometry(2, 2);
    const material = new THREE.ShaderMaterial({ vertexShader: VERTEX, fragmentShader: FRAGMENT, uniforms, transparent: true, depthWrite: false });
    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);
    return {
      update: (_dt, t) => {
        uniforms.uTime.value = t * speed;
      },
      dispose: () => { geometry.dispose(); material.dispose(); }
    };
  }, [tint, speed]);

  return (
    <Premium3DScene
      label={label}
      ratio={ratio}
      enabled={enabled}
      quality={quality}
      className={className}
      placeholderClassName="bg-[#f2eee8]"
      setup={setup}
    />
  );
};
