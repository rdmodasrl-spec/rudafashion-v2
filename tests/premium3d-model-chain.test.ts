/**
 * 真实 3D 商品模型链路守卫。
 *
 * 这里检查的是「安全边界」而不是观感：
 * 1) 只有显式 approved 的真实模型才算 3D，缺失状态/待审/驳回一律不展示；
 * 2) 上传只接受自包含 GLB，服务端必须校验 GLB 结构，不能相信 MIME；
 * 3) 上传后的模型一律 pending，审核通过前不得进入买家响应。
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');
const storefront = read('src/apps/shared/components/storefront/useStorefrontData.ts');
const viewer = read('src/apps/shared/components/premium3d/ruda3d/Ruda3DProductViewer.tsx');
const uploader = read('src/apps/merchant-admin-common/components/merchant/Model3DUploader.tsx');
const server = read('server.ts');

test('只有显式 reviewStatus === approved 的模型才展示（禁止缺省即通过）', () => {
  assert.match(storefront, /item\.reviewStatus === 'approved'/);
  assert.doesNotMatch(
    storefront,
    /reviewStatus \|\| 'approved'/,
    '不得把缺失的审核状态当成已通过'
  );
  assert.match(storefront, /if \(!picked\) return null;/);
});

test('缺少状态 / pending / rejected 都不能进入买家 3D 查看器', async () => {
  // 直接调用真实实现，用最小 fake product 覆盖四种审核状态
  const module = await import('../src/apps/shared/components/storefront/useStorefrontData.ts');
  const base: Record<string, unknown> = {
    id: 'p1', styleNo: 'S1', name: '包', merchantId: 'm1', images: ['/a.jpg']
  };
  const withStatus = (reviewStatus?: string) => ({
    ...base,
    media: [{ id: 'm', type: 'model', url: '/models/x.glb', ...(reviewStatus ? { reviewStatus } : {}) }]
  }) as never;

  assert.equal(module.resolveProductModel(withStatus(undefined)), null, '缺少审核状态必须拒绝');
  assert.equal(module.resolveProductModel(withStatus('pending')), null, 'pending 必须拒绝');
  assert.equal(module.resolveProductModel(withStatus('rejected')), null, 'rejected 必须拒绝');
  const approved = module.resolveProductModel(withStatus('approved'));
  assert.ok(approved, 'approved 才允许展示');
  assert.equal(approved?.url, '/models/x.glb');
});

test('多角度图片必须够 3 张才启用 360 环视，否则回落真实商品图', () => {
  assert.match(storefront, /unique\.length >= 3 \? unique : \[\]/);
  assert.match(viewer, /if \(model\?\.url\) return 'model';/);
  assert.match(viewer, /if \(\(angleFrames\?\.length \|\| 0\) >= 3\) return 'photo360';/);
});

test('360 图片环视在界面上明确标注不是 3D 模型', () => {
  assert.match(viewer, /360° 图片环视/);
  assert.match(viewer, /3D 模型加载失败，显示商品图/);
});

test('上传端只接受自包含 GLB，拒绝 .gltf', () => {
  assert.match(uploader, /const ACCEPTED = \['\.glb'\];/);
  assert.doesNotMatch(uploader, /gltf\+json/);
  assert.match(uploader, /MAX_MODEL_BYTES = 25 \* 1024 \* 1024/);
  assert.match(uploader, /reviewStatus: 'pending'/);
});

test('服务端预签名只放行 model/gltf-binary，并限制 25 MB', () => {
  assert.match(server, /MODEL_MEDIA_TYPES = new Set\(\['model\/gltf-binary'\]\)/);
  assert.doesNotMatch(server, /'model\/gltf\+json'/);
  assert.match(server, /const maxFileSize = mediaType === 'models'\s*\?\s*25 \* 1024 \* 1024/);
});

test('服务端在保存商品媒体时对模型做全量 GLB 结构校验', () => {
  // 具体算法在 src/server/glbValidation.ts，由 glb-validation.test.ts 做行为验证
  assert.match(server, /import \{ validateGlbStructure \} from '\.\/src\/server\/glbValidation';/);
  assert.match(server, /const verdict = validateGlbStructure\(buffer, sizeBytes\);/);
  const validator = read('src/server/glbValidation.ts');
  assert.match(validator, /export function validateGlbStructure/);
  assert.match(validator, /buffer\.toString\('ascii', 0, 4\) !== GLB_MAGIC/);
  assert.match(validator, /if \(version !== 2\)/);
  assert.match(validator, /declaredLength !== expectedSize/);
  assert.match(validator, /GLB_JSON_CHUNK_OUT_OF_RANGE/);
  assert.match(validator, /GLB_BIN_CHUNK_OUT_OF_RANGE/);
  assert.match(validator, /GLB_EXTERNAL_BUFFER_REFERENCE/);
  assert.match(validator, /GLB_EXTERNAL_IMAGE_REFERENCE/);
  assert.match(validator, /GLB_NO_MESH/);
});

test('商品媒体里 model 条目只能指向自家对象存储的 .glb，且保存时强制 pending', () => {
  assert.match(server, /storefront\/models\//);
  assert.match(server, /item\.contentType !== 'model\/gltf-binary'/);
  assert.match(server, /modelReviewStatus = item\.type === 'model'/);
  assert.match(server, /item\.reviewStatus === 'approved' \? 'approved' as const : 'pending' as const/);
});

test('3D 场景主体区分 photo 与 model，不得把图片板声明为模型', () => {
  const sceneKit = read('src/apps/shared/components/premium3d/ruda3d/sceneKit.ts');
  assert.match(sceneKit, /kind: 'photo'/);
  assert.match(sceneKit, /kind: 'model'/);
  assert.match(sceneKit, /export async function buildModelSubject/);
});
