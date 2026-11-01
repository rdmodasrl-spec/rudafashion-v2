/**
 * RUDA 3D 影棚灯光系统（纯 three.js）。
 *
 * 技术栈说明：评估过 @react-three/fiber v9 + @react-three/drei v10（React 19 可用），
 * 但 ThreeUI 本身不依赖 R3F，现有 premium3d 组件也已是纯 three.js；
 * 再引入 R3F 会并存两套 3D 运行时，不利于统一资源释放与降级策略。
 * 因此继续复用 three.js 核心 + 自己的场景封装，不重复引入同类技术栈。
 *
 * 灯光方案对齐意大利皮具摄影棚：大面积柔主光 + 环境补光 + 轮廓光 + 柔和投影，
 * 不用霓虹、不用赛博朋克色，避免廉价游戏感。
 */
import type * as THREE from 'three';

export type LightingPreset = 'studio' | 'softbox' | 'showcase';

export type LightingRig = {
  update?: (elapsed: number) => void;
  dispose: () => void;
  key: THREE.DirectionalLight;
};

export function buildLightingRig(
  THREE_NS: typeof import('three'),
  scene: THREE.Scene,
  renderer: THREE.WebGLRenderer,
  preset: LightingPreset = 'studio'
): LightingRig {
  const intensity = preset === 'softbox' ? 0.85 : preset === 'showcase' ? 1.15 : 1;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE_NS.PCFSoftShadowMap;
  renderer.toneMapping = THREE_NS.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.92;
  renderer.outputColorSpace = THREE_NS.SRGBColorSpace;

  scene.add(new THREE_NS.AmbientLight(0xffffff, 0.22 * intensity));
  // 半球光模拟影棚顶部 + 地面反射，让皮革暗部不死黑
  const hemi = new THREE_NS.HemisphereLight(0xffffff, 0xd9d2c7, 0.38 * intensity);
  scene.add(hemi);

  const key = new THREE_NS.DirectionalLight(0xfff6ea, 2.1 * intensity);
  key.position.set(3.2, 4.4, 3.6);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.near = 1;
  key.shadow.camera.far = 18;
  key.shadow.camera.left = -5;
  key.shadow.camera.right = 5;
  key.shadow.camera.top = 5;
  key.shadow.camera.bottom = -5;
  key.shadow.bias = -0.0008;
  scene.add(key);

  const fill = new THREE_NS.DirectionalLight(0xeef2f7, 0.75 * intensity);
  fill.position.set(-3.6, 1.6, 2.4);
  scene.add(fill);

  // 轮廓光：从背后打亮包体边缘，撑出空间层次
  const rim = new THREE_NS.DirectionalLight(0xffffff, 1.35 * intensity);
  rim.position.set(-2.4, 2.2, -4.2);
  scene.add(rim);

  const bounce = new THREE_NS.PointLight(0xfff1de, 6 * intensity, 14, 2);
  bounce.position.set(0, -1.2, 2.2);
  scene.add(bounce);

  return {
    key,
    update: elapsed => {
      // 极缓慢的灯光呼吸，幅度 <8%，只让画面「活着」，不做闪烁
      key.intensity = 2.1 * intensity * (1 + Math.sin(elapsed * 0.35) * 0.05);
      rim.intensity = 1.35 * intensity * (1 + Math.cos(elapsed * 0.28) * 0.06);
    },
    dispose: () => {
      [key, fill, rim, bounce, hemi].forEach(light => light.dispose?.());
      scene.remove(key, fill, rim, bounce, hemi);
    }
  };
}

/** 影棚环境反射：程序化画布生成，不引入外部 HDR 资源。 */
export function buildStudioEnvironment(THREE_NS: typeof import('three')): THREE.Texture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const gradient = ctx.createLinearGradient(0, 0, 0, size);
    gradient.addColorStop(0, '#ffffff');
    gradient.addColorStop(0.42, '#f3ece1');
    gradient.addColorStop(0.72, '#cfc6b8');
    gradient.addColorStop(1, '#7f786e');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
    // 顶部柔光箱高光块，让金属五金出现可信反射
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.fillRect(size * 0.15, size * 0.08, size * 0.7, size * 0.12);
  }
  const texture = new THREE_NS.CanvasTexture(canvas);
  texture.mapping = THREE_NS.EquirectangularReflectionMapping;
  texture.colorSpace = THREE_NS.SRGBColorSpace;
  return texture;
}

/** 影棚地面：接收阴影的浅色地板，让商品有落点而不是漂浮在虚空。 */
export function buildStudioFloor(THREE_NS: typeof import('three'), color = '#f2eee8'): THREE.Mesh {
  const geometry = new THREE_NS.CircleGeometry(6, 64);
  const material = new THREE_NS.ShadowMaterial({ color: 0x8a8377, opacity: 0.22 });
  const catcher = new THREE_NS.Mesh(geometry, material);
  catcher.rotation.x = -Math.PI / 2;
  catcher.position.y = -1.42;
  catcher.receiveShadow = true;
  const backer = new THREE_NS.Mesh(
    new THREE_NS.CircleGeometry(6.05, 64),
    new THREE_NS.MeshBasicMaterial({ color: new THREE_NS.Color(color) })
  );
  backer.rotation.x = -Math.PI / 2;
  backer.position.y = -1.425;
  catcher.add(backer);
  return catcher;
}
