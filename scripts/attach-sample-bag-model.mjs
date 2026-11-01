/**
 * 把 RUDA 自产箱包 GLB 样品挂到演示商品上，打通
 * 「ProductMedia(type=model) → 商品 API → 3D Viewer」的真实链路。
 *
 * 安全护栏：
 * - 只允许写 `demo-industry-*` 演示商家，绝不碰真实商家商品；
 * - 只追加/更新 type=model 的那一条媒体，保留商品原有图片与视频；
 * - 默认 dry-run，需显式 --apply 才写库。
 *
 * 用法：
 *   node --env-file=.env scripts/attach-sample-bag-model.mjs            # 预览
 *   node --env-file=.env scripts/attach-sample-bag-model.mjs --apply    # 写库
 */
import { PrismaClient } from '@prisma/client';

const APPLY = process.argv.includes('--apply');
const MODEL_URL = '/models/ruda-sample-handbag.glb';
/** 样品包实测包围盒 0.385 × 0.291 × 0.375 m，按真实中号手提包填写 */
const MODEL_SCALE_METERS = 0.30;
const MODEL_INITIAL_ANGLE_DEG = 18;

const TARGETS = [
  // 公开商品：未登录访客也能在 Premium 3D Lab 里看到真实几何体
  'demo-industry-department-chain-retail-3',
  // 箱包行业三件（批发可见性，需买家登录）
  'demo-industry-bags-wholesale-1',
  'demo-industry-bags-wholesale-2',
  'demo-industry-bags-wholesale-3'
];

const prisma = new PrismaClient();

function parseMedia(raw) {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

let updated = 0;
for (const id of TARGETS) {
  const product = await prisma.product.findUnique({
    where: { id },
    select: { id: true, merchantId: true, name: true, media: true }
  });
  if (!product) {
    console.log(`跳过 ${id}：商品不存在`);
    continue;
  }
  if (!product.merchantId || !product.merchantId.startsWith('demo-industry-')) {
    console.log(`拒绝 ${id}：不是演示商家商品（${product.merchantId}）`);
    continue;
  }

  const media = parseMedia(product.media);
  const withoutModel = media.filter(item => item.type !== 'model');
  const nextMedia = [
    ...withoutModel,
    {
      id: `${id}-model-1`,
      type: 'model',
      url: MODEL_URL,
      contentType: 'model/gltf-binary',
      role: 'main',
      source: 'merchant-upload',
      reviewStatus: 'approved',
      alt: `${product.name} 三维模型`,
      modelScaleMeters: MODEL_SCALE_METERS,
      modelInitialAngleDeg: MODEL_INITIAL_ANGLE_DEG
    }
  ];

  console.log(`${product.name} (${id}) → media ${media.length} 条，写入后 ${nextMedia.length} 条`);
  if (!APPLY) continue;

  await prisma.product.update({
    where: { id },
    data: { media: JSON.stringify(nextMedia) }
  });
  updated += 1;
}

console.log(APPLY ? `已更新 ${updated} 个商品` : '预览模式（未写库），加 --apply 执行');
await prisma.$disconnect();
