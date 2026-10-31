/**
 * Premium 3D 组件守卫。
 *
 * 3D 视觉是可选增强，绝不能破坏交易链路，也不允许把假 3D 当成品交付，
 * 因此以下约束必须能被机械检查。
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const read = (path: string) => readFileSync(path, 'utf8');
const ROOT = 'src/apps/shared/components/premium3d';

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap(entry => {
    const full = join(dir, entry);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

const files = walk(ROOT).filter(file => file.endsWith('.ts') || file.endsWith('.tsx'));

/** 去掉块注释与行注释，避免注释里的说明文字被当成真实引用/文案。 */
const stripComments = (source: string) => source
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '');

test('three 只在 premium3d 目录内被引用，不扩散到业务模块', () => {
  for (const file of files) {
    const source = read(file);
    if (/from 'three/.test(source)) {
      assert.match(file, /premium3d/, `${file} 不允许引用 three`);
    }
  }
});

test('没有引入第二套 3D 运行时（R3F / drei / ogl / regl）', () => {
  for (const file of files) {
    const source = stripComments(read(file));
    assert.doesNotMatch(source, /@react-three|from 'ogl'|from 'regl'/, `${file} 不得引入第二套 3D 运行时`);
  }
});

test('所有 3D 场景都经过 Premium3DScene，统一处理降级与资源释放', () => {
  for (const file of files) {
    if (file.endsWith('Premium3DScene.tsx') || file.endsWith('capability.ts')) continue;
    if (!file.endsWith('.tsx')) continue;
    const source = read(file);
    if (!source.includes('Premium3DScene')) continue;
    assert.match(source, /dispose/, `${file} 必须实现 dispose 释放 GPU 资源`);
  }
});

test('3D 组件不得包含假商品或编造文案', () => {
  for (const file of files) {
    const source = stripComments(read(file));
    assert.doesNotMatch(source, /(假数据|mockProduct|fakeProduct)/, `${file} 不得内置假商品`);
  }
});

test('降级路径存在：WebGL 检测 + prefers-reduced-motion + 静态海报', () => {
  const capability = read(join(ROOT, 'capability.ts'));
  assert.match(capability, /prefers-reduced-motion: reduce/);
  assert.match(capability, /getContext\('webgl2'\)/);
  const scene = read(join(ROOT, 'Premium3DScene.tsx'));
  assert.match(scene, /poster/);
  assert.match(scene, /reduceMotion/);
});

test('3D 不进入交易链路：购物车/订单/询价逻辑不得依赖 3D 组件', () => {
  const storefrontBags = [
    'src/apps/shared/components/storefront/bags/BagsEditorialTemplate.tsx',
    'src/apps/shared/components/storefront/bags/BagsCatalogueTemplate.tsx',
    'src/apps/shared/components/storefront/bags/BagsWholesaleTemplate.tsx'
  ];
  for (const file of storefrontBags) {
    const source = read(file);
    assert.doesNotMatch(source, /Ruda3D[A-Za-z]+\s*[^a-zA-Z]*\.\s*(addToCart|createBuyerRfq)/, `${file} 不得让 3D 组件承担交易动作`);
  }
});
