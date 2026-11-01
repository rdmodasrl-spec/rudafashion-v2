/**
 * GLB 结构校验的真实行为测试：用真实生成的 GLB 与其被篡改的变体，
 * 证明服务端不是只看 MIME，而是真的按字节校验。
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateGlbStructure } from '../src/server/glbValidation.ts';

const real = readFileSync('public/models/ruda-sample-handbag.glb');

function makeGlb(document: unknown, bin = Buffer.alloc(0)) {
  const json = Buffer.from(JSON.stringify(document), 'utf8');
  const jsonPadded = Buffer.concat([json, Buffer.alloc((4 - (json.length % 4)) % 4, 0x20)]);
  const header = Buffer.alloc(12);
  header.write('glTF', 0, 'ascii');
  header.writeUInt32LE(2, 4);
  const chunks: Buffer[] = [];
  const jsonHeader = Buffer.alloc(8);
  jsonHeader.writeUInt32LE(jsonPadded.length, 0);
  jsonHeader.writeUInt32LE(0x4e4f534a, 4);
  chunks.push(jsonHeader, jsonPadded);
  if (bin.length) {
    const binHeader = Buffer.alloc(8);
    binHeader.writeUInt32LE(bin.length, 0);
    binHeader.writeUInt32LE(0x004e4942, 4);
    chunks.push(binHeader, bin);
  }
  const body = Buffer.concat(chunks);
  header.writeUInt32LE(12 + body.length, 8);
  return Buffer.concat([header, body]);
}

/** 按 GLB 规范把数据补齐到 4 字节对齐 */
const padTo4 = (size: number) => size + ((4 - (size % 4)) % 4);

/** 一个结构完整、自包含的最小合法 GLB：三角面 + 位置/索引 accessor + 材质 + scene。 */
function validDocument() {
  const positions = Buffer.alloc(36);   // 3 × VEC3 float
  const indices = Buffer.alloc(6);      // 3 × UNSIGNED_SHORT
  const payloadBytes = positions.length + indices.length;      // 42，真实数据长度
  const bin = Buffer.concat([positions, indices, Buffer.alloc(padTo4(payloadBytes) - payloadBytes)]);
  return {
    document: {
      asset: { version: '2.0' },
      buffers: [{ byteLength: payloadBytes }],
      bufferViews: [
        { buffer: 0, byteOffset: 0, byteLength: 36, target: 34962 },
        { buffer: 0, byteOffset: 36, byteLength: 6, target: 34963 }
      ],
      accessors: [
        { bufferView: 0, componentType: 5126, count: 3, type: 'VEC3', min: [0, 0, 0], max: [1, 1, 0] },
        { bufferView: 1, componentType: 5123, count: 3, type: 'SCALAR' }
      ],
      materials: [{ name: 'Leather', pbrMetallicRoughness: { baseColorFactor: [0.5, 0.36, 0.24, 1] } }],
      meshes: [{ primitives: [{ attributes: { POSITION: 0 }, indices: 1, material: 0 }] }],
      nodes: [{ mesh: 0 }],
      scenes: [{ nodes: [0] }],
      scene: 0
    },
    bin
  };
}

test('真实导出的 GLB 通过校验', () => {
  const verdict = validateGlbStructure(real, real.length);
  assert.deepEqual(verdict, { ok: true });
});

test('文件头不是 glTF 一律拒绝', () => {
  const bad = Buffer.from(real);
  bad.write('XXXX', 0, 'ascii');
  const verdict = validateGlbStructure(bad, bad.length);
  assert.equal(verdict.ok, false);
  assert.equal((verdict as { reason: string }).reason, 'GLB_MAGIC_INVALID');
});

test('版本不是 2 拒绝', () => {
  const bad = Buffer.from(real);
  bad.writeUInt32LE(1, 4);
  assert.equal(validateGlbStructure(bad, bad.length).ok, false);
});

test('声明长度与实际长度不一致拒绝（防止截断文件）', () => {
  const truncated = real.subarray(0, Math.floor(real.length / 2));
  const verdict = validateGlbStructure(truncated, real.length);
  assert.equal(verdict.ok, false);
  const reason = (verdict as { reason: string }).reason;
  assert.ok(['GLB_SIZE_MISMATCH', 'GLB_JSON_CHUNK_OUT_OF_RANGE', 'GLB_LENGTH_MISMATCH'].includes(reason), reason);
});

test('第一个 chunk 不是 JSON 拒绝', () => {
  const { document, bin } = validDocument();
  const bad = makeGlb(document, bin);
  bad.writeUInt32LE(0x004e4942, 16);
  assert.equal(validateGlbStructure(bad, bad.length).ok, false);
});

test('引用外部 .bin 的模型拒绝（买家端会缺二进制）', () => {
  const { document, bin } = validDocument();
  const external = makeGlb({ ...document, buffers: [{ uri: 'scene.bin', byteLength: 128 }] }, bin);
  const verdict = validateGlbStructure(external, external.length);
  assert.equal(verdict.ok, false);
  assert.equal((verdict as { reason: string }).reason, 'GLB_EXTERNAL_BUFFER_REFERENCE');
});

test('引用外部纹理的模型拒绝（买家端会缺贴图）', () => {
  const { document, bin } = validDocument();
  const external = makeGlb({ ...document, images: [{ uri: 'leather.png' }] }, bin);
  const verdict = validateGlbStructure(external, external.length);
  assert.equal(verdict.ok, false);
  assert.equal((verdict as { reason: string }).reason, 'GLB_EXTERNAL_IMAGE_REFERENCE');
});

test('没有 mesh 的空壳文件拒绝', () => {
  const empty = makeGlb({ asset: { version: '2.0' }, meshes: [], nodes: [] });
  const verdict = validateGlbStructure(empty, empty.length);
  assert.equal(verdict.ok, false);
  assert.equal((verdict as { reason: string }).reason, 'GLB_NO_MESH');
});

test('asset 版本不是 2.0 拒绝', () => {
  const bad = makeGlb({ asset: { version: '1.0' }, meshes: [{}], nodes: [{}] });
  const verdict = validateGlbStructure(bad, bad.length);
  assert.equal(verdict.ok, false);
  assert.equal((verdict as { reason: string }).reason, 'GLB_ASSET_VERSION_INVALID');
});

test('结构完整的自包含 GLB 通过', () => {
  const { document, bin } = validDocument();
  const good = makeGlb(document, bin);
  assert.deepEqual(validateGlbStructure(good, good.length), { ok: true });
});

test('JSON chunk 越界拒绝', () => {
  const { document, bin } = validDocument();
  const good = makeGlb(document, bin);
  const tampered = Buffer.from(good);
  tampered.writeUInt32LE(tampered.length * 4, 12);
  assert.equal(validateGlbStructure(tampered, tampered.length).ok, false);
});

// ───────────────────────────── 第三轮补充：容器层与结构层 ─────────────────────────────

test('chunk 长度未按 4 字节对齐拒绝', () => {
  const { document, bin } = validDocument();
  const good = makeGlb(document, bin);
  const tampered = Buffer.from(good);
  const jsonLen = tampered.readUInt32LE(12);
  tampered.writeUInt32LE(jsonLen + 1, 12);
  const verdict = validateGlbStructure(tampered, tampered.length);
  assert.equal(verdict.ok, false);
});

test('尾随垃圾字节拒绝', () => {
  const { document, bin } = validDocument();
  const good = makeGlb(document, bin);
  const withGarbage = Buffer.concat([good, Buffer.alloc(8, 0xff)]);
  withGarbage.writeUInt32LE(withGarbage.length, 8);
  const verdict = validateGlbStructure(withGarbage, withGarbage.length);
  assert.equal(verdict.ok, false, '尾随字节必须被拒绝（具体原因可能是未对齐 chunk 或未知 chunk）');
});

test('声明了 buffer 但没有 BIN chunk 拒绝', () => {
  const { document } = validDocument();
  const noBin = makeGlb(document, Buffer.alloc(0));
  const verdict = validateGlbStructure(noBin, noBin.length);
  assert.equal(verdict.ok, false);
  assert.equal((verdict as { reason: string }).reason, 'GLB_BIN_CHUNK_MISSING');
});

test('buffer.byteLength 大于 BIN 实际长度拒绝', () => {
  const { document, bin } = validDocument();
  const overclaim = { ...document, buffers: [{ byteLength: bin.length + 64 }] };
  const bad = makeGlb(overclaim, bin);
  const verdict = validateGlbStructure(bad, bad.length);
  assert.equal(verdict.ok, false);
  assert.equal((verdict as { reason: string }).reason, 'GLB_BUFFER_EXCEEDS_BIN');
});

test('bufferView 越界拒绝', () => {
  const { document, bin } = validDocument();
  const bad = { ...document, bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: 4096 }, document.bufferViews[1]] };
  const glb = makeGlb(bad, bin);
  const verdict = validateGlbStructure(glb, glb.length);
  assert.equal(verdict.ok, false);
  assert.equal((verdict as { reason: string }).reason, 'GLB_BUFFER_VIEW_OUT_OF_RANGE');
});

test('bufferView 指向不存在的 buffer 拒绝', () => {
  const { document, bin } = validDocument();
  const bad = { ...document, bufferViews: [{ buffer: 3, byteLength: 4 }, document.bufferViews[1]] };
  const glb = makeGlb(bad, bin);
  const verdict = validateGlbStructure(glb, glb.length);
  assert.equal(verdict.ok, false);
  assert.equal((verdict as { reason: string }).reason, 'GLB_BUFFER_VIEW_BUFFER_INVALID');
});

test('accessor 越界拒绝', () => {
  const { document, bin } = validDocument();
  const bad = {
    ...document,
    accessors: [{ bufferView: 0, componentType: 5126, count: 9999, type: 'VEC3' }, document.accessors[1]]
  };
  const glb = makeGlb(bad, bin);
  const verdict = validateGlbStructure(glb, glb.length);
  assert.equal(verdict.ok, false);
  assert.equal((verdict as { reason: string }).reason, 'GLB_ACCESSOR_OUT_OF_RANGE');
});

test('accessor 类型非法拒绝', () => {
  const { document, bin } = validDocument();
  const bad = { ...document, accessors: [{ bufferView: 0, componentType: 9999, count: 3, type: 'VEC3' }, document.accessors[1]] };
  const glb = makeGlb(bad, bin);
  const verdict = validateGlbStructure(glb, glb.length);
  assert.equal(verdict.ok, false);
  assert.equal((verdict as { reason: string }).reason, 'GLB_ACCESSOR_TYPE_INVALID');
});

test('primitive 引用不存在的 accessor 拒绝', () => {
  const { document, bin } = validDocument();
  const bad = {
    ...document,
    meshes: [{ primitives: [{ attributes: { POSITION: 42 } }] }]
  };
  const glb = makeGlb(bad, bin);
  const verdict = validateGlbStructure(glb, glb.length);
  assert.equal(verdict.ok, false);
  assert.equal((verdict as { reason: string }).reason, 'GLB_PRIMITIVE_ATTRIBUTE_ACCESSOR_INVALID');
});

test('primitive 缺少 attributes 拒绝', () => {
  const { document, bin } = validDocument();
  const bad = { ...document, meshes: [{ primitives: [{}] }] };
  const glb = makeGlb(bad, bin);
  const verdict = validateGlbStructure(glb, glb.length);
  assert.equal(verdict.ok, false);
  assert.equal((verdict as { reason: string }).reason, 'GLB_PRIMITIVE_ATTRIBUTES_MISSING');
});

test('primitive 引用不存在的材质拒绝', () => {
  const { document, bin } = validDocument();
  const bad = { ...document, meshes: [{ primitives: [{ attributes: { POSITION: 0 }, indices: 1, material: 7 }] }] };
  const glb = makeGlb(bad, bin);
  const verdict = validateGlbStructure(glb, glb.length);
  assert.equal(verdict.ok, false);
  assert.equal((verdict as { reason: string }).reason, 'GLB_PRIMITIVE_MATERIAL_INVALID');
});

test('node 引用不存在的 mesh 拒绝', () => {
  const { document, bin } = validDocument();
  const bad = { ...document, nodes: [{ mesh: 9 }] };
  const glb = makeGlb(bad, bin);
  const verdict = validateGlbStructure(glb, glb.length);
  assert.equal(verdict.ok, false);
  assert.equal((verdict as { reason: string }).reason, 'GLB_NODE_MESH_INVALID');
});

test('scene 引用不存在的 node 拒绝', () => {
  const { document, bin } = validDocument();
  const bad = { ...document, scenes: [{ nodes: [5] }] };
  const glb = makeGlb(bad, bin);
  const verdict = validateGlbStructure(glb, glb.length);
  assert.equal(verdict.ok, false);
  assert.equal((verdict as { reason: string }).reason, 'GLB_SCENE_NODE_INVALID');
});

test('内嵌 data URI 纹理允许（不应误判为外部资源）', () => {
  const { document, bin } = validDocument();
  const withEmbeddedTexture = {
    ...document,
    images: [{ uri: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==' }],
    textures: [{ source: 0 }]
  };
  const glb = makeGlb(withEmbeddedTexture, bin);
  assert.deepEqual(validateGlbStructure(glb, glb.length), { ok: true });
});

test('内嵌 data URI buffer 允许（无 BIN chunk 也合法）', () => {
  const payload = Buffer.from('AAAA').toString('base64');
  const document = {
    asset: { version: '2.0' },
    buffers: [{ uri: `data:application/octet-stream;base64,${payload}`, byteLength: 4 }],
    bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: 4 }],
    accessors: [{ bufferView: 0, componentType: 5121, count: 4, type: 'SCALAR' }],
    meshes: [{ primitives: [{ attributes: { _CUSTOM: 0 } }] }],
    nodes: [{ mesh: 0 }]
  };
  const glb = makeGlb(document, Buffer.alloc(0));
  assert.deepEqual(validateGlbStructure(glb, glb.length), { ok: true });
});

test('外部网络纹理拒绝', () => {
  const { document, bin } = validDocument();
  const bad = { ...document, images: [{ uri: 'https://cdn.example.com/leather.png' }] };
  const glb = makeGlb(bad, bin);
  const verdict = validateGlbStructure(glb, glb.length);
  assert.equal(verdict.ok, false);
  assert.equal((verdict as { reason: string }).reason, 'GLB_EXTERNAL_IMAGE_REFERENCE');
});

test('image 既无 uri 也无 bufferView 拒绝', () => {
  const { document, bin } = validDocument();
  const bad = { ...document, images: [{ mimeType: 'image/png' }] };
  const glb = makeGlb(bad, bin);
  const verdict = validateGlbStructure(glb, glb.length);
  assert.equal(verdict.ok, false);
  assert.equal((verdict as { reason: string }).reason, 'GLB_IMAGE_SOURCE_MISSING');
});

test('scene 索引越界拒绝', () => {
  const { document, bin } = validDocument();
  const bad = { ...document, scene: 3 };
  const glb = makeGlb(bad, bin);
  const verdict = validateGlbStructure(glb, glb.length);
  assert.equal(verdict.ok, false);
  assert.equal((verdict as { reason: string }).reason, 'GLB_SCENE_INDEX_INVALID');
});

test('只数 mesh 数量不够：meshes 非空但 primitive 为空也要拒绝', () => {
  const { document, bin } = validDocument();
  const bad = { ...document, meshes: [{ primitives: [] }] };
  const glb = makeGlb(bad, bin);
  const verdict = validateGlbStructure(glb, glb.length);
  assert.equal(verdict.ok, false);
  assert.equal((verdict as { reason: string }).reason, 'GLB_MESH_NO_PRIMITIVE');
});
