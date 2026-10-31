/**
 * 程序化皮革材质：用 canvas 生成颗粒法线贴图，得到真实微观皮革起伏。
 * 不依赖外部贴图资源，也不需要商家上传；用途是「影棚道具与包体基材」，
 * 不代表具体商品的面料成分（商品面料以商品数据为准）。
 */
import type * as THREE from 'three';

function grainCanvas(size: number, seed = 1): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  const image = ctx.createImageData(size, size);
  // 简易可重复噪声：多层哈希叠加，模拟皮革毛孔
  const hash = (x: number, y: number, salt: number) => {
    const value = Math.sin(x * 127.1 + y * 311.7 + salt * 74.7) * 43758.5453;
    return value - Math.floor(value);
  };
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const index = (y * size + x) * 4;
      let value = 0;
      let amplitude = 0.55;
      let frequency = 0.09;
      for (let octave = 0; octave < 4; octave += 1) {
        value += amplitude * hash(Math.floor(x * frequency), Math.floor(y * frequency), octave + seed);
        amplitude *= 0.5;
        frequency *= 2.1;
      }
      const level = Math.round(128 + (value - 0.5) * 150);
      image.data[index] = level;
      image.data[index + 1] = level;
      image.data[index + 2] = level;
      image.data[index + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);
  return canvas;
}

export function createLeatherMaterial(
  THREE_NS: typeof import('three'),
  options: { color?: string; roughness?: number; size?: number } = {}
): { material: THREE.MeshPhysicalMaterial; dispose: () => void } {
  const size = options.size ?? 512;
  const canvas = grainCanvas(size);
  const texture = new THREE_NS.CanvasTexture(canvas);
  texture.wrapS = THREE_NS.RepeatWrapping;
  texture.wrapT = THREE_NS.RepeatWrapping;
  texture.repeat.set(3, 3);

  const material = new THREE_NS.MeshPhysicalMaterial({
    color: new THREE_NS.Color(options.color ?? '#7a5c3e'),
    roughness: options.roughness ?? 0.68,
    metalness: 0.02,
    clearcoat: 0.18,
    clearcoatRoughness: 0.55,
    normalMap: texture,
    normalScale: new THREE_NS.Vector2(0.55, 0.55),
    envMapIntensity: 0.9
  });
  return { material, dispose: () => { material.dispose(); texture.dispose(); } };
}

/** 拉丝金属五金材质（拉链、锁扣），给箱包细节可信反射。 */
export function createHardwareMaterial(
  THREE_NS: typeof import('three'),
  tone: 'gold' | 'steel' = 'gold'
): { material: THREE.MeshPhysicalMaterial; dispose: () => void } {
  const material = new THREE_NS.MeshPhysicalMaterial({
    color: new THREE_NS.Color(tone === 'gold' ? '#c8a96b' : '#b9bcc0'),
    roughness: 0.22,
    metalness: 1,
    clearcoat: 0.5,
    clearcoatRoughness: 0.2,
    envMapIntensity: 1.6
  });
  return { material, dispose: () => material.dispose() };
}
