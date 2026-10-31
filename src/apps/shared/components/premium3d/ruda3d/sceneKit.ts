/**
 * 场景共用构件：商品主体（真模型 / 真实商品图立体面板）、皮具道具、影棚地面。
 *
 * 诚实边界：
 * - 有 GLB 时就是真实商品模型；
 * - 没有 GLB 时，商品以「在 3D 空间中具有厚度、接受灯光与阴影的真实图片板」呈现，
 *   这是真三维场景，但界面不会声称它是 3D 模型。
 */
import type * as THREE from 'three';
import { createHardwareMaterial, createLeatherMaterial } from './leatherMaterial';
import { textureUrlCandidates } from '../capability';

export type SubjectKind = 'model' | 'photo';

export type SubjectHandle = {
  group: THREE.Group;
  kind: SubjectKind;
  /** 每帧更新，做漂浮 / 呼吸 */
  update: (elapsed: number) => void;
  dispose: () => void;
};

/**
 * 纹理加载：按候选地址依次尝试（同源优先，再退回绝对地址），全部失败返回 null。
 * 失败时调用方回落到纯色材质 / 商品图海报，不出现空白 3D 画布。
 */
async function loadTexture(THREE_NS: typeof import('three'), url: string): Promise<THREE.Texture | null> {
  const candidates = textureUrlCandidates(url);
  for (const candidate of candidates) {
    const texture = await new Promise<THREE.Texture | null>(resolve => {
      const loader = new THREE_NS.TextureLoader();
      loader.setCrossOrigin('anonymous');
      loader.load(candidate, loaded => {
        loaded.colorSpace = THREE_NS.SRGBColorSpace;
        loaded.anisotropy = 4;
        resolve(loaded);
      }, undefined, () => resolve(null));
    });
    if (texture) return texture;
  }
  return null;
}

/** 真实商品图 → 带厚度、带倒角边缘的立体板，接受影棚灯光与投影。 */
export async function buildPhotoSubject(
  THREE_NS: typeof import('three'),
  url: string,
  options: { height?: number; depth?: number } = {}
): Promise<SubjectHandle> {
  const texture = await loadTexture(THREE_NS, url);
  const image = texture?.image as { width?: number; height?: number } | undefined;
  const aspect = image?.width && image?.height ? image.width / image.height : 0.8;
  const height = options.height ?? 2.5;
  const width = Math.min(3.0, height * aspect);
  const depth = options.depth ?? 0.1;

  const group = new THREE_NS.Group();
  const geometry = new THREE_NS.BoxGeometry(width, height, depth, 1, 1, 1);
  const faceMaterial = new THREE_NS.MeshPhysicalMaterial({
    map: texture ?? null,
    color: texture ? 0xffffff : 0xf0ece5,
    roughness: 0.55,
    metalness: 0.02,
    clearcoat: 0.22,
    clearcoatRoughness: 0.4,
    envMapIntensity: 1.1
  });
  const edgeMaterial = new THREE_NS.MeshPhysicalMaterial({ color: 0xf6f2ec, roughness: 0.6, metalness: 0.02 });
  const mesh = new THREE_NS.Mesh(geometry, [edgeMaterial, edgeMaterial, edgeMaterial, edgeMaterial, faceMaterial, edgeMaterial]);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);

  return {
    group,
    kind: 'photo',
    update: elapsed => {
      group.position.y = Math.sin(elapsed * 0.65) * 0.045;
      group.rotation.z = Math.sin(elapsed * 0.4) * 0.006;
    },
    dispose: () => {
      geometry.dispose();
      faceMaterial.dispose();
      edgeMaterial.dispose();
      texture?.dispose();
    }
  };
}

/** 商家上传的真实 GLB 模型。 */
export async function buildModelSubject(
  THREE_NS: typeof import('three'),
  url: string,
  options: { targetSize?: number } = {}
): Promise<SubjectHandle> {
  const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
  const gltf = await new GLTFLoader().loadAsync(url);
  const root = gltf.scene;
  root.traverse(child => {
    const mesh = child as THREE.Mesh;
    if (mesh.isMesh) { mesh.castShadow = true; mesh.receiveShadow = true; }
  });
  const bounds = new THREE_NS.Box3().setFromObject(root);
  const size = new THREE_NS.Vector3();
  bounds.getSize(size);
  const maxDimension = Math.max(size.x, size.y, size.z) || 1;
  root.scale.setScalar((options.targetSize ?? 2.6) / maxDimension);
  bounds.setFromObject(root);
  const center = new THREE_NS.Vector3();
  bounds.getCenter(center);
  root.position.sub(center);

  const group = new THREE_NS.Group();
  group.add(root);
  return {
    group,
    kind: 'model',
    update: elapsed => {
      group.position.y = Math.sin(elapsed * 0.55) * 0.03;
    },
    dispose: () => {
      root.traverse(child => {
        const mesh = child as THREE.Mesh;
        if (!mesh.isMesh) return;
        mesh.geometry.dispose();
        const material = mesh.material as THREE.Material | THREE.Material[];
        (Array.isArray(material) ? material : [material]).forEach(item => item.dispose());
      });
    }
  };
}

/** 皮具道具：一卷皮革 + 五金扣件，给首屏真实的材质与阴影层次。 */
export function buildLeatherProps(THREE_NS: typeof import('three')): { group: THREE.Group; update: (t: number) => void; dispose: () => void } {
  const group = new THREE_NS.Group();
  const leather = createLeatherMaterial(THREE_NS, { color: '#7a5c3e' });
  const hardware = createHardwareMaterial(THREE_NS, 'gold');

  // 皮革卷：圆柱 + 端面，形成有厚度的卷材
  const rollGeometry = new THREE_NS.CylinderGeometry(0.34, 0.34, 1.5, 40, 1, true);
  const roll = new THREE_NS.Mesh(rollGeometry, leather.material);
  roll.rotation.z = Math.PI / 2;
  roll.position.set(-2.05, -0.95, 0.4);
  roll.castShadow = true;
  roll.receiveShadow = true;
  group.add(roll);

  const capGeometry = new THREE_NS.CircleGeometry(0.34, 40);
  const capLeft = new THREE_NS.Mesh(capGeometry, new THREE_NS.MeshPhysicalMaterial({ color: 0x8d6a48, roughness: 0.75, side: THREE_NS.DoubleSide }));
  capLeft.position.set(-2.8, -0.95, 0.4);
  capLeft.rotation.y = -Math.PI / 2;
  const capRight = capLeft.clone();
  capRight.position.x = -1.3;
  capRight.rotation.y = Math.PI / 2;
  group.add(capLeft, capRight);

  // 五金扣件：小圆环，提供可信金属高光
  const ringGeometry = new THREE_NS.TorusGeometry(0.16, 0.028, 16, 48);
  const ring = new THREE_NS.Mesh(ringGeometry, hardware.material);
  ring.position.set(2.15, -0.62, 0.65);
  ring.rotation.set(0.4, 0.6, 0);
  ring.castShadow = true;
  group.add(ring);

  return {
    group,
    update: elapsed => {
      ring.rotation.y = 0.6 + elapsed * 0.18;
    },
    dispose: () => {
      rollGeometry.dispose();
      capGeometry.dispose();
      ringGeometry.dispose();
      leather.dispose();
      hardware.dispose();
      (capLeft.material as THREE.Material).dispose();
    }
  };
}
