import assert from 'node:assert/strict';
import test from 'node:test';
import {
  hashMerchantStudioFileInput,
  normalizeMerchantStudioFileInput,
  normalizeMerchantStudioProjectFileIds
} from '../src/server/merchantStudioFile';

test('Studio upload metadata accepts only supported file types, matching extensions and size limits', () => {
  assert.deepEqual(normalizeMerchantStudioFileInput({
    fileName: 'front pattern.DXF',
    contentType: 'application/dxf',
    sizeBytes: 1024
  }), {
    ok: true,
    input: { fileName: 'front pattern.DXF', contentType: 'application/dxf', sizeBytes: 1024 }
  });
  const sanitizedTraversalName = normalizeMerchantStudioFileInput({
    fileName: '../private.pdf',
    contentType: 'application/pdf',
    sizeBytes: 1024
  });
  assert.equal(sanitizedTraversalName.ok, true);
  if (sanitizedTraversalName.ok) assert.equal(sanitizedTraversalName.input.fileName.includes('/'), false);
  assert.equal(normalizeMerchantStudioFileInput({
    fileName: 'model.gltf',
    contentType: 'model/gltf-binary',
    sizeBytes: 1024
  }).ok, false);
  assert.equal(normalizeMerchantStudioFileInput({
    fileName: 'pattern.dxf',
    contentType: 'application/octet-stream',
    sizeBytes: 1024
  }).ok, false);
  assert.equal(normalizeMerchantStudioFileInput({
    fileName: 'large.pdf',
    contentType: 'application/pdf',
    sizeBytes: 50 * 1024 * 1024 + 1
  }).ok, false);
});

test('Studio upload metadata is canonicalized and replay hashes are deterministic', () => {
  const first = normalizeMerchantStudioFileInput({
    fileName: ' pattern.pdf ',
    contentType: 'APPLICATION/PDF',
    sizeBytes: 2048
  });
  const second = normalizeMerchantStudioFileInput({
    fileName: ' pattern.pdf ',
    contentType: 'application/pdf',
    sizeBytes: 2048
  });
  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  if (!first.ok || !second.ok) return;
  assert.equal(first.input.fileName, 'pattern.pdf');
  assert.equal(hashMerchantStudioFileInput(first.input), hashMerchantStudioFileInput(second.input));
});

test('project file references must be unique UUIDs and are limited to one hundred', () => {
  const fileId = 'c4c9d488-6f9e-4e31-b639-e0730f64726e';
  assert.deepEqual(normalizeMerchantStudioProjectFileIds({}), { ok: true, fileIds: null });
  assert.deepEqual(normalizeMerchantStudioProjectFileIds({ fileIds: [fileId] }), { ok: true, fileIds: [fileId] });
  assert.deepEqual(normalizeMerchantStudioProjectFileIds({ fileIds: [fileId, fileId] }), { ok: false });
  assert.deepEqual(normalizeMerchantStudioProjectFileIds({ fileIds: ['not-a-uuid'] }), { ok: false });
  assert.deepEqual(normalizeMerchantStudioProjectFileIds({ fileIds: Array(101).fill(fileId) }), { ok: false });
});
