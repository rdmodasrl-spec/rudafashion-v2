/**
 * 旧演示模型审核状态：只读核对 + 可选的精确回滚。
 *
 * 背景：生产库有 4 条由 `scripts/attach-sample-bag-model.mjs --apply` 直接写入的
 * 模型媒体，`reviewStatus = 'approved'` 但没有管理员审核凭证 `modelReview`。
 * 第四轮起公开接口凭「缺少合法凭证」自动隐藏它们，所以数据库里的 approved
 * 已经不再构成可见性。本脚本只做两件事：
 *
 *   1) 默认（不带 --apply）：只读打印这 4 条记录的真实状态，不写库。
 *   2) 带 `--apply`（且要求 P2_LEGACY_MODEL_ROLLBACK=yes）：把它们精确改回
 *      `reviewStatus: 'pending'`，让数据库状态与「从未被审核」的事实对齐。
 *
 * 约束：
 *   - 只动 `type === 'model'` 且 `reviewStatus === 'approved'` 且缺少合法凭证的条目。
 *   - 绝不删除媒体条目，绝不修改 `images` 字段，绝不触碰图片/视频条目。
 *   - 写库前把原始 media 备份到 /tmp，便于人工恢复。
 *
 * 用法：
 *   DATABASE_URL=... node scripts/p2/3d-legacy-model-review.mjs            # 只读核对
 *   DATABASE_URL=... P2_LEGACY_MODEL_ROLLBACK=yes node scripts/p2/3d-legacy-model-review.mjs --apply
 */
import { writeFileSync } from 'node:fs';
import { PrismaClient } from '@prisma/client';
import { isValidModelReviewCredential } from '../../src/shared/modelReviewCredential.ts';

const TARGET_IDS = [
  'demo-industry-department-chain-retail-3',
  'demo-industry-bags-wholesale-1',
  'demo-industry-bags-wholesale-2',
  'demo-industry-bags-wholesale-3'
];

const apply = process.argv.includes('--apply');
const prisma = new PrismaClient();

if (apply && process.env.P2_LEGACY_MODEL_ROLLBACK !== 'yes') {
  console.error('拒绝执行：--apply 需要同时设置 P2_LEGACY_MODEL_ROLLBACK=yes（生产写入门槛）。');
  process.exit(2);
}

const dbLabel = (process.env.DATABASE_URL || '').replace(/:\/\/([^:]+):[^@]*@/, '://$1:***@');
console.log(`数据库：${dbLabel}`);
console.log(`模式：${apply ? 'APPLY（会写库）' : '只读核对（不写库）'}\n`);

const rows = await prisma.product.findMany({
  where: { id: { in: TARGET_IDS } },
  select: { id: true, images: true, media: true }
});

const report = [];
for (const id of TARGET_IDS) {
  const row = rows.find(r => r.id === id);
  if (!row) {
    report.push({ productId: id, status: 'MISSING' });
    continue;
  }
  const media = JSON.parse(row.media || '[]');
  const imageEntries = media.filter(m => m.type !== 'model');
  const modelEntries = media.filter(m => m.type === 'model');
  const imagesArray = JSON.parse(row.images || '[]');

  for (const model of modelEntries) {
    report.push({
      productId: id,
      modelMediaId: model.id,
      reviewStatus: model.reviewStatus ?? null,
      hasModelReview: Boolean(model.modelReview),
      credentialValid: isValidModelReviewCredential(model.modelReview),
      modelUrl: model.url,
      needsRollback: model.reviewStatus === 'approved' && !isValidModelReviewCredential(model.modelReview),
      imageEntriesKept: imageEntries.length,
      imagesArrayKept: imagesArray.length
    });
  }
  if (!modelEntries.length) {
    report.push({ productId: id, modelEntries: 0, imageEntriesKept: imageEntries.length });
  }
}

for (const entry of report) console.log(JSON.stringify(entry));

const targets = report.filter(entry => entry.needsRollback);
console.log(`\n需要回滚为 pending 的模型媒体：${targets.length} 条`);
if (!targets.length) {
  console.log('无需处理。');
  await prisma.$disconnect();
  process.exit(0);
}

if (!apply) {
  console.log('未加 --apply，未写库。影响范围：这些商品在公开接口中本来就已经被隐藏，');
  console.log('回滚只是让数据库 reviewStatus 与事实一致，不改变买家可见性，不删除任何图片。');
  await prisma.$disconnect();
  process.exit(0);
}

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
for (const target of targets) {
  const row = await prisma.product.findUnique({ where: { id: target.productId }, select: { media: true } });
  const backupPath = `/tmp/p2-legacy-model-rollback-${target.productId}-${stamp}.json`;
  writeFileSync(backupPath, row.media || '[]');
  const media = JSON.parse(row.media || '[]');
  const next = media.map(entry => (
    entry.id === target.modelMediaId && entry.type === 'model'
      ? { ...entry, reviewStatus: 'pending' }
      : entry
  ));
  await prisma.product.update({ where: { id: target.productId }, data: { media: JSON.stringify(next) } });
  console.log(`已回滚 ${target.productId} / ${target.modelMediaId} → pending（原 media 备份：${backupPath}）`);
}

await prisma.$disconnect();
