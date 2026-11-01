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
  const bad = makeGlb({ asset: { version: '2.0' }, meshes: [{}], nodes: [{}] });
  bad.writeUInt32LE(0x004e4942, 16);
  assert.equal(validateGlbStructure(bad, bad.length).ok, false);
});

test('引用外部 .bin 的模型拒绝（买家端会缺二进制）', () => {
  const external = makeGlb({
    asset: { version: '2.0' },
    buffers: [{ uri: 'scene.bin', byteLength: 128 }],
    meshes: [{}],
    nodes: [{}]
  });
  const verdict = validateGlbStructure(external, external.length);
  assert.equal(verdict.ok, false);
  assert.equal((verdict as { reason: string }).reason, 'GLB_EXTERNAL_BUFFER_REFERENCE');
});

test('引用外部纹理的模型拒绝（买家端会缺贴图）', () => {
  const external = makeGlb({
    asset: { version: '2.0' },
    images: [{ uri: 'leather.png' }],
    meshes: [{}],
    nodes: [{}]
  });
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

test('合法自包含 GLB（含 BIN chunk）通过', () => {
  const good = makeGlb(
    { asset: { version: '2.0' }, buffers: [{ byteLength: 8 }], meshes: [{}], nodes: [{}] },
    Buffer.alloc(8, 1)
  );
  assert.deepEqual(validateGlbStructure(good, good.length), { ok: true });
});

test('JSON chunk 越界拒绝', () => {
  const good = makeGlb({ asset: { version: '2.0' }, meshes: [{}], nodes: [{}] });
  const tampered = Buffer.from(good);
  tampered.writeUInt32LE(tampered.length * 4, 12);
  assert.equal(validateGlbStructure(tampered, tampered.length).ok, false);
});
