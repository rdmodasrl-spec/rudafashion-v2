/**
 * 生成 RUDA 自有版权的箱包 GLB 样品模型。
 *
 * 用途：3D 商品展示链路的工程验收素材。模型由 RUDA 用 three.js 几何体程序化建模，
 * 版权归 RUDA，可商用（不用任何第三方品牌模型，避免版权风险）。
 * 这是**模型样品**，不是某个真实商品的三维扫描；商家真实商品模型必须由商家上传。
 *
 * 结构（可 360° 观察，含底部/侧面/背面）：
 *   包身（带倒角的实体）+ 翻盖 + 提手 + 肩带 + 五金锁扣与 D 环 + 拉链 + 车缝线
 *
 * 用法：node scripts/generate-sample-bag-glb.mjs
 * 输出：public/models/ruda-sample-handbag.glb
 */
globalThis.FileReader = class {
  readAsArrayBuffer(blob) {
    blob.arrayBuffer().then(buffer => { this.result = buffer; this.onloadend?.(); });
  }
  readAsDataURL(blob) {
    blob.arrayBuffer().then(buffer => {
      this.result = `data:${blob.type || 'application/octet-stream'};base64,${Buffer.from(buffer).toString('base64')}`;
      this.onloadend?.();
    });
  }
};

import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const OUTPUT = path.join('public', 'models', 'ruda-sample-handbag.glb');

/** 皮革主料：棕褐色小牛皮，低金属度、可辨颗粒感通过法线强度留给运行时 */
const LEATHER = () => new THREE.MeshPhysicalMaterial({
  name: 'Leather_Calfskin',
  color: new THREE.Color('#7a5232'),
  roughness: 0.7,
  metalness: 0.02,
  clearcoat: 0.14,
  clearcoatRoughness: 0.6,
  sheen: 0.16,
  sheenRoughness: 0.7,
  sheenColor: new THREE.Color('#c99a6b')
});

/** 内衬：稍浅的哑光皮 */
const LINING = () => new THREE.MeshStandardMaterial({
  name: 'Leather_Lining',
  color: new THREE.Color('#a9855e'),
  roughness: 0.86,
  metalness: 0.0
});

/** 五金：黄铜锁扣/D 环/拉链头 */
const HARDWARE = () => new THREE.MeshPhysicalMaterial({
  name: 'Hardware_Brass',
  color: new THREE.Color('#c8a86a'),
  roughness: 0.2,
  metalness: 1,
  clearcoat: 0.4,
  clearcoatRoughness: 0.25
});

/** 车缝线 */
const THREAD = () => new THREE.MeshStandardMaterial({
  name: 'Thread_Stitch',
  color: new THREE.Color('#e8dcc8'),
  roughness: 0.9,
  metalness: 0
});

/** 圆角矩形轮廓，用作包身与翻盖的拉伸截面 */
function roundedRect(width, height, radius) {
  const shape = new THREE.Shape();
  const x = -width / 2;
  const y = -height / 2;
  shape.moveTo(x + radius, y);
  shape.lineTo(x + width - radius, y);
  shape.quadraticCurveTo(x + width, y, x + width, y + radius);
  shape.lineTo(x + width, y + height - radius);
  shape.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  shape.lineTo(x + radius, y + height);
  shape.quadraticCurveTo(x, y + height, x, y + height - radius);
  shape.lineTo(x, y + radius);
  shape.quadraticCurveTo(x, y, x + radius, y);
  return shape;
}

/** 带倒角的实体板：包身、翻盖、侧袋都用它，保证有真实厚度与圆边 */
function slab(width, height, depth, radius, bevel) {
  const geometry = new THREE.ExtrudeGeometry(roundedRect(width, height, radius), {
    depth,
    bevelEnabled: true,
    bevelSize: bevel,
    bevelThickness: bevel,
    bevelSegments: 2,
    curveSegments: 10,
    steps: 1
  });
  geometry.center();
  geometry.computeVertexNormals();
  return geometry;
}

/** 车缝线：沿一条直线排布的短线段，合并成一个 mesh，避免几十个 draw call */
function stitchLine(from, to, count, size = 0.012) {
  const pieces = [];
  for (let index = 0; index < count; index += 1) {
    const t = count === 1 ? 0.5 : index / (count - 1);
    const item = new THREE.BoxGeometry(size, size, size * 0.6);
    item.translate(
      from.x + (to.x - from.x) * t,
      from.y + (to.y - from.y) * t,
      from.z + (to.z - from.z) * t
    );
    pieces.push(item);
  }
  return mergeGeometries(pieces, false);
}

const scene = new THREE.Scene();
scene.name = 'RUDA_Sample_Handbag';

// ── 包身：宽 0.30 m、高 0.20 m、厚 0.10 m（接近真实中号手提包比例）
const BODY_W = 0.30;
const BODY_H = 0.20;
const BODY_D = 0.10;

const body = new THREE.Mesh(slab(BODY_W, BODY_H, BODY_D, 0.026, 0.012), LEATHER());
body.name = 'Bag_Body';
body.position.y = 0;
scene.add(body);

// ── 翻盖：比包身略宽，向前倾，形成真实盖合关系
const flap = new THREE.Mesh(slab(BODY_W + 0.012, 0.115, 0.018, 0.022, 0.007), LEATHER());
flap.name = 'Bag_Flap';
flap.position.set(0, BODY_H / 2 - 0.045, BODY_D / 2 + 0.012);
flap.rotation.x = -0.16;
scene.add(flap);

// ── 内衬：从包身顶部露出一点，说明内部结构真实存在
const lining = new THREE.Mesh(slab(BODY_W - 0.038, 0.05, BODY_D - 0.038, 0.014, 0.004), LINING());
lining.name = 'Bag_Lining';
lining.position.y = BODY_H / 2 - 0.014;
scene.add(lining);

// ── 提手：半圆环，立在包顶
const handle = new THREE.Mesh(new THREE.TorusGeometry(0.062, 0.0085, 10, 28, Math.PI), LEATHER());
handle.name = 'Bag_Handle';
handle.position.set(0, BODY_H / 2 + 0.004, 0);
handle.rotation.set(0, 0, 0);
scene.add(handle);

// 提手两端加固皮料
for (const side of [-1, 1]) {
  const anchor = new THREE.Mesh(slab(0.03, 0.024, 0.026, 0.006, 0.003), LEATHER());
  anchor.name = `Bag_HandleAnchor_${side > 0 ? 'R' : 'L'}`;
  anchor.position.set(side * 0.062, BODY_H / 2 + 0.006, 0);
  scene.add(anchor);
}

// ── 肩带：细长环带，斜挂在包身两侧的 D 环上
const strap = new THREE.Mesh(new THREE.TorusGeometry(0.175, 0.0065, 8, 44, Math.PI), LEATHER());
strap.name = 'Bag_ShoulderStrap';
strap.position.set(0, 0.026, -0.016);
strap.rotation.set(0, 0, 0);
scene.add(strap);

// ── 五金：正面的锁扣（底板 + 扣针 + 扣环）
const bucklePlate = new THREE.Mesh(new THREE.BoxGeometry(0.042, 0.03, 0.008), HARDWARE());
bucklePlate.name = 'Hardware_BucklePlate';
bucklePlate.position.set(0, -0.012, BODY_D / 2 + 0.016);
scene.add(bucklePlate);

const buckleRing = new THREE.Mesh(new THREE.TorusGeometry(0.014, 0.0032, 8, 20), HARDWARE());
buckleRing.name = 'Hardware_BuckleRing';
buckleRing.position.set(0, -0.012, BODY_D / 2 + 0.022);
scene.add(buckleRing);

// D 环：两侧挂肩带
for (const side of [-1, 1]) {
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.014, 0.0028, 8, 18), HARDWARE());
  ring.name = `Hardware_DRing_${side > 0 ? 'R' : 'L'}`;
  ring.position.set(side * (BODY_W / 2 - 0.002), 0.028, 0);
  ring.rotation.y = Math.PI / 2;
  scene.add(ring);
}

// ── 拉链：沿包身后缘的一条细长轨道 + 拉链头
const zipperTrack = new THREE.Mesh(new THREE.CylinderGeometry(0.0035, 0.0035, BODY_W - 0.06, 8), HARDWARE());
zipperTrack.name = 'Hardware_ZipperTrack';
zipperTrack.position.set(0, BODY_H / 2 - 0.003, -BODY_D / 2 + 0.006);
zipperTrack.rotation.z = Math.PI / 2;
scene.add(zipperTrack);

const zipperPull = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.02, 0.004), HARDWARE());
zipperPull.name = 'Hardware_ZipperPull';
zipperPull.position.set(0.085, BODY_H / 2 - 0.012, -BODY_D / 2 + 0.006);
scene.add(zipperPull);

// ── 车缝线：翻盖边缘与包身顶边
const flapStitches = new THREE.Mesh(
  stitchLine(
    new THREE.Vector3(-BODY_W / 2 + 0.018, BODY_H / 2 - 0.098, BODY_D / 2 + 0.024),
    new THREE.Vector3(BODY_W / 2 - 0.018, BODY_H / 2 - 0.098, BODY_D / 2 + 0.024),
    22
  ),
  THREAD()
);
flapStitches.name = 'Stitch_FlapEdge';
scene.add(flapStitches);

const bodyStitches = new THREE.Mesh(
  stitchLine(
    new THREE.Vector3(-BODY_W / 2 + 0.02, BODY_H / 2 + 0.004, BODY_D / 2 - 0.004),
    new THREE.Vector3(BODY_W / 2 - 0.02, BODY_H / 2 + 0.004, BODY_D / 2 - 0.004),
    22
  ),
  THREAD()
);
bodyStitches.name = 'Stitch_BodyTop';
scene.add(bodyStitches);

// ── 底部脚钉：可以从底部观察到的真实结构
for (const x of [-0.09, 0.09]) {
  for (const z of [-0.03, 0.03]) {
    const stud = new THREE.Mesh(new THREE.CylinderGeometry(0.0075, 0.0075, 0.004, 10), HARDWARE());
    stud.name = `Hardware_FootStud_${x}_${z}`;
    stud.position.set(x, -BODY_H / 2 - 0.014, z);
    scene.add(stud);
  }
}

// 统一材质重命名，便于运行时按名称替换/增强
scene.traverse(child => {
  const mesh = child;
  if (!mesh.isMesh) return;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
});

const binary = await new Promise((resolve, reject) => {
  new GLTFExporter().parse(scene, result => resolve(result), error => reject(error), {
    binary: true,
    onlyVisible: false,
    truncateDrawRange: false
  });
});

const buffer = Buffer.from(binary);
await mkdir(path.dirname(OUTPUT), { recursive: true });
await writeFile(OUTPUT, buffer);

const triangleCount = scene.children.reduce((sum, child) => {
  const geometry = child.geometry;
  if (!geometry) return sum;
  const index = geometry.getIndex();
  const position = geometry.getAttribute('position');
  return sum + Math.floor((index ? index.count : position.count) / 3);
}, 0);

console.log(`写入 ${OUTPUT}`);
console.log(`字节数 ${buffer.byteLength}，mesh 数 ${scene.children.length}，三角面 ${triangleCount}`);
console.log(`包围盒 ${new THREE.Box3().setFromObject(scene).getSize(new THREE.Vector3()).toArray().map(v => v.toFixed(3)).join(' x ')} m`);
