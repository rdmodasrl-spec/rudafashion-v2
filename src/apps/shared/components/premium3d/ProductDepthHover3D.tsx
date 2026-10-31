/**
 * 图片悬停深度交互：指针移动时商品图产生真实视差与景深位移（WebGL 位移着色器）。
 * 用于商品网格/系列陈列的高端悬停反馈，不改变商品卡原有可点击区域。
 */
import React, { useCallback } from 'react';
import { Premium3DScene, type SceneSetupContext, type SceneHandle } from './Premium3DScene';
import { loadTextureWithFallback, type Premium3DQuality } from './capability';

export type ProductDepthHover3DProps = {
  image: string;
  alt: string;
  /** 视差强度，0 关闭 */
  depth?: number;
  quality?: Premium3DQuality;
  enabled?: boolean;
  ratio?: string;
  className?: string;
};

const VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const FRAGMENT = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D uMap;
  uniform vec2 uPointer;
  uniform float uDepth;
  uniform float uZoom;

  void main() {
    vec2 center = vec2(0.5);
    vec2 offset = uPointer * uDepth * 0.035;
    vec2 uv = center + (vUv - center) / uZoom + offset;
    if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
      gl_FragColor = vec4(0.969, 0.957, 0.945, 1.0);
      return;
    }
    // 用图自身亮度做伪景深：亮部前移、暗部后退，形成轻微立体误差
    vec3 base = texture2D(uMap, uv).rgb;
    float luma = dot(base, vec3(0.299, 0.587, 0.114));
    vec2 parallax = (uv - center) * (1.0 - luma) * uDepth * 0.012;
    vec3 shifted = texture2D(uMap, uv + parallax).rgb;
    vec3 color = mix(base, shifted, 0.55);
    float vignette = smoothstep(0.95, 0.35, distance(vUv, center));
    gl_FragColor = vec4(color * (0.94 + 0.06 * vignette), 1.0);
  }
`;

export const ProductDepthHover3D: React.FC<ProductDepthHover3DProps> = ({
  image,
  alt,
  depth = 1,
  quality = 'high',
  enabled = true,
  ratio = '1 / 1',
  className = ''
}) => {
  const setup = useCallback(async (ctx: SceneSetupContext): Promise<SceneHandle> => {
    const { THREE, renderer, scene, camera, pointer } = ctx;
    renderer.setClearColor(0x000000, 0);
    camera.position.z = 1;

    const texture = await loadTextureWithFallback(THREE, image, loaded => {
      loaded.anisotropy = quality === 'low' ? 2 : 8;
    });
    if (!texture) throw new Error('depth hover: texture failed');

    const geometry = new THREE.PlaneGeometry(2, 2);
    const material = new THREE.ShaderMaterial({
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      uniforms: {
        uMap: { value: texture },
        uPointer: { value: new THREE.Vector2() },
        uDepth: { value: depth },
        uZoom: { value: 1.04 }
      }
    });
    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    let hover = 0;
    return {
      update: (dt) => {
        const target = pointer.current.x === 0 && pointer.current.y === 0 ? 0 : 1;
        hover += (target - hover) * Math.min(1, dt * 6);
        material.uniforms.uPointer.value.set(pointer.current.x, pointer.current.y);
        material.uniforms.uZoom.value = 1.02 + hover * 0.06;
        material.uniforms.uDepth.value = depth * (0.35 + hover * 0.65);
      },
      dispose: () => { geometry.dispose(); material.dispose(); texture.dispose(); }
    };
  }, [image, depth, quality]);

  return (
    <Premium3DScene
      label={alt}
      poster={image}
      posterAlt={alt}
      ratio={ratio}
      enabled={enabled}
      quality={quality}
      interactive
      className={className}
      placeholderClassName="bg-[#f2eee8]"
      setup={setup}
    />
  );
};
