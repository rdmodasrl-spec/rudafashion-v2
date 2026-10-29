import { Prisma, PrismaClient } from '@prisma/client';
import sharp from 'sharp';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

/**
 * Editorial rights remediation (stage 5).
 *
 * The 14 seeded `fashion-demo-*` editorial posts pointed at third-party runway
 * photos (Vogue), a Getty image and TikTok captures. No commercial licence could
 * be verified for any of them, so this script:
 *
 *   - replaces the 10 image posts with RUDA-owned typographic covers generated
 *     here (rightsStatus = "owned"),
 *   - takes the 4 video posts offline (rightsStatus = "unverified"), keeping the
 *     rows and original source paths for the record,
 *   - writes an evidence file with the exact before/after mapping.
 *
 * Idempotent: running it twice produces the same result.
 */
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const outputDirectory = path.join(root, 'public', 'fashion', 'editorial');
const evidencePath = path.join(root, 'docs', 'engineering', 'evidence', 'fashion-stage5', 'editorial-rights.json');

const coverSvg = (index: number) => `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1500" viewBox="0 0 1200 1500">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#141414"/>
      <stop offset="1" stop-color="#0a0a0a"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="1500" fill="url(#bg)"/>
  <rect x="56" y="56" width="1088" height="1388" fill="none" stroke="#f5f3ee" stroke-opacity="0.18" stroke-width="1.5"/>
  <circle cx="900" cy="620" r="330" fill="none" stroke="#f5f3ee" stroke-opacity="0.12" stroke-width="1.5"/>
  <circle cx="900" cy="620" r="220" fill="none" stroke="#f5f3ee" stroke-opacity="0.08" stroke-width="1"/>
  <line x1="56" y1="300" x2="1144" y2="300" stroke="#f5f3ee" stroke-opacity="0.14" stroke-width="1"/>
  <text x="108" y="230" fill="#f5f3ee" font-family="Helvetica, Arial, sans-serif" font-size="52" letter-spacing="18">RUDA</text>
  <text x="1092" y="230" text-anchor="end" fill="#8f8a80" font-family="Helvetica, Arial, sans-serif" font-size="22" letter-spacing="7">FASHION ARCHIVE</text>
  <text x="1092" y="1330" text-anchor="end" fill="#1d1d1d" font-family="Helvetica, Arial, sans-serif" font-size="300" font-weight="bold">${String(index).padStart(2, '0')}</text>
  <text x="108" y="1246" fill="#f5f3ee" font-family="Helvetica, Arial, sans-serif" font-size="30" letter-spacing="11">EDITORIAL</text>
  <text x="108" y="1286" fill="#8f8a80" font-family="Helvetica, Arial, sans-serif" font-size="19" letter-spacing="6">RUDA OWNED VISUAL / 2026</text>
  <line x1="108" y1="1320" x2="420" y2="1320" stroke="#f5f3ee" stroke-opacity="0.5" stroke-width="1"/>
</svg>`;

const run = async () => {
  const prisma = new PrismaClient();
  const report: { replaced: unknown[]; withdrawn: unknown[]; skipped: string[] } = {
    replaced: [], withdrawn: [], skipped: []
  };
  try {
    await mkdir(outputDirectory, { recursive: true });
    const posts = await prisma.fashionCommunityPost.findMany({
      where: { id: { startsWith: 'fashion-demo-' } },
      orderBy: { id: 'asc' },
      select: { id: true, image: true, videoUrl: true, mediaType: true, rightsStatus: true, publicationStatus: true, featured: true }
    });
    let imageIndex = 0;
    for (const post of posts) {
      if (post.mediaType === 'video' || post.videoUrl) {
        const updated = await prisma.fashionCommunityPost.update({
          where: { id: post.id },
          data: { publicationStatus: 'unpublished', featured: false, rightsStatus: 'unverified' }
        });
        report.withdrawn.push({
          id: post.id,
          previousStatus: post.publicationStatus,
          previousRights: post.rightsStatus,
          newStatus: updated.publicationStatus,
          videoUrl: post.videoUrl,
          reason: '视频来源为第三方平台抓取，无法核实商用授权，已下架待替换'
        });
        continue;
      }
      imageIndex += 1;
      const filename = `ruda-editorial-2026-${String(imageIndex).padStart(2, '0')}.jpg`;
      const buffer = await sharp(Buffer.from(coverSvg(imageIndex))).jpeg({ quality: 88 }).toBuffer();
      await writeFile(path.join(outputDirectory, filename), buffer);
      const image = `/fashion/editorial/${filename}`;
      await prisma.fashionCommunityPost.update({
        where: { id: post.id },
        // mediaItems carried the original third-party URLs; clearing them forces
        // every client to use the owned cover instead of the withdrawn asset.
        data: { image, mediaItems: Prisma.DbNull, rightsStatus: 'owned', publicationStatus: 'approved', featured: true }
      });
      report.replaced.push({
        id: post.id,
        previousImage: post.image,
        image,
        reason: '原图为第三方秀场/图库素材，授权无法核实；已替换为 RUDA 自有版式封面'
      });
    }
    // Curated web-collected feeds live in logs/fashion-feed-items.json. Anything
    // approved but not explicitly licensed is returned to the review queue so it
    // stops appearing in /api/fashion/editorial.
    const feedPath = path.join(root, 'logs', 'fashion-feed-items.json');
    try {
      const raw = await readFile(feedPath, 'utf8');
      const items = JSON.parse(raw) as Array<{ id: string; status?: string; image?: string; sourceName?: string }>;
      if (Array.isArray(items)) {
        let changed = 0;
        const next = items.map(item => {
          if (item.status !== 'approved') return item;
          changed += 1;
          report.withdrawn.push({
            id: item.id,
            source: item.sourceName,
            image: item.image,
            reason: '站外采集素材授权未核实，已退回待审核'
          });
          return { ...item, status: 'pending' };
        });
        if (changed) await writeFile(feedPath, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
    await mkdir(path.dirname(evidencePath), { recursive: true });
    await writeFile(evidencePath, `${JSON.stringify({
      generatedAt: new Date().toISOString(),
      policy: '无法核实商用授权的第三方图片/视频一律替换为自有素材或暂时下架，原始来源保留在记录中',
      replacedCount: report.replaced.length,
      withdrawnCount: report.withdrawn.length,
      ...report
    }, null, 2)}\n`, 'utf8');
    console.log(JSON.stringify({ ok: true, replaced: report.replaced.length, withdrawn: report.withdrawn.length }, null, 2));
  } finally {
    await prisma.$disconnect();
  }
};

void run().catch(error => {
  console.error(error);
  process.exit(1);
});
