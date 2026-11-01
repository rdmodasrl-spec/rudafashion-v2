/**
 * 真实 3D 商品模型链路守卫。
 *
 * 三件必须机械可查的事：
 * 1) 只有「已审核的真实模型」才算 3D，图片绝不能冒充；
 * 2) 模型上传走同一套媒体预签名，并单独限制类型与体积；
 * 3) 3D 组件不得把立体图片板当作 3D 模型对外呈现。
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');
const storefront = read('src/apps/shared/components/storefront/useStorefrontData.ts');
const viewer = read('src/apps/shared/components/premium3d/ruda3d/Ruda3DProductViewer.tsx');
const uploader = read('src/apps/merchant-admin-common/components/merchant/Model3DUploader.tsx');
const server = read('server.ts');

test('只有审核通过的 model 媒体才算 3D 模型', () => {
  assert.match(storefront, /item\.type === 'model'/);
  assert.match(storefront, /reviewStatus \|\| 'approved'\) === 'approved'/);
  assert.match(storefront, /if \(!picked\) return null;/);
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

test('模型上传复用同一套媒体预签名，并限制类型与体积', () => {
  assert.match(uploader, /uploadMerchantMedia/);
  assert.match(server, /MODEL_MEDIA_TYPES = new Set\(\['model\/gltf-binary', 'model\/gltf\+json'\]\)/);
  assert.match(server, /const maxFileSize = mediaType === 'models'\s*\?\s*25 \* 1024 \* 1024/);
  assert.match(server, /\? 'glb'/);
});

test('模型上传前端有扩展名与体积校验，且审核前不展示给买家', () => {
  assert.match(uploader, /MAX_MODEL_BYTES = 25 \* 1024 \* 1024/);
  assert.match(uploader, /\.glb/);
  assert.match(uploader, /reviewStatus: 'pending'/);
});

test('3D 场景主体不得把图片板声明为模型', () => {
  const sceneKit = read('src/apps/shared/components/premium3d/ruda3d/sceneKit.ts');
  assert.match(sceneKit, /kind: 'photo'/);
  assert.match(sceneKit, /kind: 'model'/);
  // 有模型才走 buildModelSubject
  assert.match(sceneKit, /export async function buildModelSubject/);
});
