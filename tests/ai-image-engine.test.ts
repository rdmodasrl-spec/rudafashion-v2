import assert from 'node:assert/strict';
import test from 'node:test';
import sharp from 'sharp';
import {
  assessAiImageQuality,
  compareAiPerceptualHash,
  composeAiProductShot,
  computeAiPerceptualHash,
  cutoutAiProduct,
  extractAiDominantColors,
  generateAiColorVariants,
  groupAiDuplicateImages,
  labDistance,
  parseAiAspect,
  parseHexColor,
  reframeAiImageToAspect,
  rgbToLab,
  segmentAiImageSubject,
  toHexColor
} from '../src/server/aiImageEngine';

/** 白底 + 居中红色主体（真实像素，不使用 mock）。 */
async function makeProductImage(): Promise<Buffer> {
  const subject = await sharp({
    create: { width: 160, height: 240, channels: 4, background: { r: 190, g: 40, b: 45, alpha: 1 } }
  }).png().toBuffer();
  return sharp({ create: { width: 400, height: 500, channels: 3, background: { r: 255, g: 255, b: 255 } } })
    .composite([{ input: subject, left: 120, top: 130 }])
    .png()
    .toBuffer();
}

/** 8px 棋盘主体：拉普拉斯方差高，用来验证清晰度判定真的算过像素。 */
async function makeTexturedImage(): Promise<Buffer> {
  const width = 400;
  const height = 400;
  const raw = Buffer.alloc(width * height * 3);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const p = (y * width + x) * 3;
      const inSubject = x >= 100 && x < 300 && y >= 100 && y < 300;
      const checker = ((x >> 3) + (y >> 3)) % 2 === 0;
      const value = inSubject ? (checker ? 20 : 235) : 255;
      raw[p] = value;
      raw[p + 1] = value;
      raw[p + 2] = value;
    }
  }
  return sharp(raw, { raw: { width, height, channels: 3 } }).png().toBuffer();
}

test('色彩工具：Lab 往返与 ΔE 距离单调', () => {
  const lab = rgbToLab(190, 40, 45);
  const back = toHexColor({ r: 190, g: 40, b: 45 });
  assert.equal(back, '#be282d');
  assert.ok(labDistance(rgbToLab(190, 40, 45), lab) < 0.001);
  const near = labDistance(rgbToLab(190, 40, 45), rgbToLab(196, 44, 48));
  const far = labDistance(rgbToLab(190, 40, 45), rgbToLab(40, 90, 190));
  assert.ok(near < far, '相近色距离必须小于互补色');
  assert.deepEqual(parseHexColor('#FFFFFF'), { r: 255, g: 255, b: 255 });
  assert.throws(() => parseHexColor('#GGG'), /AI_MEDIA_PARAMS_INVALID/);
});

test('分割：白底商品识别出主体包围盒与覆盖率', async () => {
  const image = await makeProductImage();
  const result = await segmentAiImageSubject(image);
  assert.equal(result.ok, true);
  assert.equal(result.reason, 'ok');
  assert.ok(result.bbox);
  assert.ok(Math.abs(result.bbox!.left - 120) <= 4, `left=${result.bbox!.left}`);
  assert.ok(Math.abs(result.bbox!.top - 130) <= 4, `top=${result.bbox!.top}`);
  assert.ok(Math.abs(result.bbox!.width - 160) <= 6, `width=${result.bbox!.width}`);
  assert.ok(result.subjectCoverage > 0.15 && result.subjectCoverage < 0.25);
  assert.equal(result.borderColor, '#ffffff');
  assert.ok(result.borderUniformity > 0.9);
  assert.ok(result.alpha && result.alpha.length === result.analysisWidth * result.analysisHeight);
});

test('分割：背景不统一时明确拒绝，不输出歪掉的主体', async () => {
  const noisy = Buffer.alloc(240 * 240 * 3);
  for (let i = 0; i < 240 * 240; i += 1) {
    const value = (i * 37) % 255;
    noisy[i * 3] = value;
    noisy[i * 3 + 1] = 255 - value;
    noisy[i * 3 + 2] = (value * 3) % 255;
  }
  const image = await sharp(noisy, { raw: { width: 240, height: 240, channels: 3 } }).png().toBuffer();
  const result = await segmentAiImageSubject(image);
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'background_not_uniform');
  assert.equal(result.alpha, null);
  assert.equal(result.bbox, null);
});

test('抠图：输出带 alpha 的 PNG，背景像素透明、主体像素保留原色', async () => {
  const image = await makeProductImage();
  const cutout = await cutoutAiProduct(image, { format: 'png' });
  assert.equal(cutout.ok, true);
  assert.ok(cutout.buffer);
  const decoded = await sharp(cutout.buffer!).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  assert.equal(decoded.info.width, 400);
  assert.equal(decoded.info.height, 500);
  const at = (x: number, y: number) => (y * decoded.info.width + x) * 4;
  const corner = at(2, 2);
  assert.ok(decoded.data[corner + 3] < 10, `角落 alpha=${decoded.data[corner + 3]}`);
  const center = at(200, 250);
  assert.ok(decoded.data[center + 3] > 245, `主体 alpha=${decoded.data[center + 3]}`);
  assert.ok(Math.abs(decoded.data[center] - 190) <= 3, `红通道=${decoded.data[center]}`);
  assert.ok(decoded.data[center + 1] < 60);
});

test('主图：输出正方形白底，主体占比真实且居中', async () => {
  const image = await makeProductImage();
  const shot = await composeAiProductShot(image, { size: 800, format: 'jpeg' });
  assert.equal(shot.ok, true);
  assert.equal(shot.width, 800);
  assert.equal(shot.height, 800);
  assert.ok(shot.buffer && shot.buffer.length > 1000);
  const meta = await sharp(shot.buffer!).metadata();
  assert.equal(meta.width, 800);
  assert.equal(meta.height, 800);
  assert.ok(shot.subjectFillRatio > 0.1 && shot.subjectFillRatio < 0.6, `fill=${shot.subjectFillRatio}`);

  const pixels = await sharp(shot.buffer!).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const idx = (x: number, y: number) => (y * 800 + x) * 4;
  const corner = idx(3, 3);
  assert.ok(pixels.data[corner] > 245 && pixels.data[corner + 1] > 245 && pixels.data[corner + 2] > 245);
  const middle = idx(400, 400);
  assert.ok(pixels.data[middle] > 120 && pixels.data[middle + 1] < 110, '中心必须是商品而不是背景');
});

test('主图：背景不统一时返回失败原因，不产出假主图', async () => {
  const noisy = Buffer.alloc(200 * 200 * 3).map((_, i) => (i * 53) % 255);
  const image = await sharp(noisy, { raw: { width: 200, height: 200, channels: 3 } }).png().toBuffer();
  const shot = await composeAiProductShot(image, { size: 600 });
  assert.equal(shot.ok, false);
  assert.equal(shot.buffer, null);
  assert.equal(shot.reason, 'background_not_uniform');
});

test('质检：清晰图与糊图给出不同结论，分数来自真实像素', async () => {
  const textured = await makeTexturedImage();
  const sharpReport = await assessAiImageQuality(textured);
  assert.equal(sharpReport.width, 400);
  const sharpness = sharpReport.items.find(item => item.key === 'sharpness');
  assert.ok(sharpness);
  assert.equal(sharpness!.status, 'pass', `measured=${sharpness!.measured}`);
  assert.ok(Number(sharpness!.measured) > 150);
  assert.ok(sharpReport.score > 0 && sharpReport.score <= 100);
  assert.equal(sharpReport.metrics.segmentation, 'ok');

  const flat = await sharp({ create: { width: 400, height: 400, channels: 3, background: { r: 255, g: 255, b: 255 } } })
    .png()
    .toBuffer();
  const flatReport = await assessAiImageQuality(flat);
  const flatSharpness = flatReport.items.find(item => item.key === 'sharpness');
  assert.equal(flatSharpness!.status, 'fail');
  assert.equal(flatReport.overallStatus, 'fail');
  assert.equal(flatReport.ok, false);
});

test('质检：无法判定时标记 unknown，不编造通过', async () => {
  const noisy = Buffer.alloc(200 * 200 * 3).map((_, i) => (i * 31) % 255);
  const image = await sharp(noisy, { raw: { width: 200, height: 200, channels: 3 } }).png().toBuffer();
  const report = await assessAiImageQuality(image, { minShortSide: 800 });
  const completeness = report.items.find(item => item.key === 'completeness');
  const subjectScale = report.items.find(item => item.key === 'subject_scale');
  assert.equal(completeness!.status, 'unknown');
  assert.equal(completeness!.measured, '背景非纯色，无法判定');
  assert.equal(subjectScale!.status, 'unknown');
  assert.equal(subjectScale!.measured, null);
  const resolution = report.items.find(item => item.key === 'resolution');
  assert.equal(resolution!.status, 'fail');
  assert.ok(report.items.every(item => typeof item.threshold === 'string' && item.threshold.length > 0));
});

test('主色：主体区域只统计商品色，整图统计含背景且排序符合真实占比', async () => {
  const image = await makeProductImage();
  const subjectOnly = await extractAiDominantColors(image, { count: 3 });
  assert.equal(subjectOnly.ok, true);
  assert.equal(subjectOnly.swatches.length, 1, '纯色主体不应被 k-means 硬凑出多个色');
  const red = subjectOnly.swatches[0];
  const redRgb = parseHexColor(red.hex);
  assert.ok(labDistance(rgbToLab(redRgb.r, redRgb.g, redRgb.b), rgbToLab(190, 40, 45)) < 12, `主体色=${red.hex}`);
  assert.ok(red.share > 0.9);

  const whole = await extractAiDominantColors(image, { count: 3, region: 'all' });
  assert.equal(whole.ok, true);
  assert.ok(whole.swatches.length >= 2, `整图主色数量=${whole.swatches.length}`);
  assert.equal(whole.swatches[0].hex, '#ffffff', '白底占比最大，必须排第一');
  const shares = whole.swatches.map(swatch => swatch.share);
  for (let i = 1; i < shares.length; i += 1) assert.ok(shares[i - 1] >= shares[i], '占比必须降序');
  const total = whole.swatches.reduce((sum, swatch) => sum + swatch.share, 0);
  assert.ok(total > 0.9 && total <= 1.0001);

  const again = await extractAiDominantColors(image, { count: 3, region: 'all' });
  assert.deepEqual(again.swatches.map(s => s.hex), whole.swatches.map(s => s.hex), '同图同参必须同结果');
});

test('颜色变体：只改主体色相，背景与纹理保留', async () => {
  const image = await makeProductImage();
  const result = await generateAiColorVariants(image, {
    variants: [{ name: '藏青', hex: '#1f3a93' }],
    format: 'png'
  });
  assert.equal(result.ok, true);
  assert.equal(result.variants.length, 1);
  const variant = result.variants[0];
  assert.ok(variant.changedRatio > 0.2, `changedRatio=${variant.changedRatio}`);
  const pixels = await sharp(variant.buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const idx = (x: number, y: number) => (y * pixels.info.width + x) * 4;
  const center = idx(200, 250);
  assert.ok(pixels.data[center + 2] > pixels.data[center], '主体应偏蓝');
  const corner = idx(2, 2);
  assert.ok(pixels.data[corner] > 240 && pixels.data[corner + 1] > 240, '背景必须保持白色');
});

test('感知哈希：同图零距离、缩放后仍判重、换图不判重', async () => {
  const image = await makeTexturedImage();
  const base = await computeAiPerceptualHash(image);
  assert.equal(base.dHash.length, 16);
  assert.equal(base.aHash.length, 16);

  const self = compareAiPerceptualHash(base, base);
  assert.equal(self.hammingDistance, 0);
  assert.equal(self.duplicate, true);
  assert.equal(self.similarity, 1);

  const resized = await sharp(image).resize({ width: 220 }).png().toBuffer();
  const resizedHash = await computeAiPerceptualHash(resized);
  const near = compareAiPerceptualHash(base, resizedHash);
  assert.ok(near.hammingDistance <= 8, `缩放后汉明距离=${near.hammingDistance}`);
  assert.equal(near.duplicate, true);

  const stripes = Buffer.alloc(400 * 400 * 3);
  for (let y = 0; y < 400; y += 1) {
    for (let x = 0; x < 400; x += 1) {
      const p = (y * 400 + x) * 3;
      const value = ((x >> 4) % 2 === 0) ? 0 : 255;
      stripes[p] = value;
      stripes[p + 1] = value;
      stripes[p + 2] = value;
    }
  }
  const other = await sharp(stripes, { raw: { width: 400, height: 400, channels: 3 } }).png().toBuffer();
  const otherHash = await computeAiPerceptualHash(other);
  const far = compareAiPerceptualHash(base, otherHash);
  assert.ok(far.hammingDistance > 8, `不同图汉明距离=${far.hammingDistance}`);
  assert.equal(far.duplicate, false);

  const grouped = groupAiDuplicateImages([
    { id: 'a', hash: base },
    { id: 'b', hash: resizedHash },
    { id: 'c', hash: otherHash }
  ]);
  assert.equal(grouped.length, 1, '只有 a/b 应聚为一组');
  assert.deepEqual(grouped[0].ids, ['a', 'b']);
  assert.ok(grouped[0].maxDistance <= 8);
});

test('画幅：按目标比例重裁，主体居中且不放大原图', async () => {
  const image = await makeProductImage();
  const vertical = await reframeAiImageToAspect(image, { aspect: '9:16', width: 720 });
  assert.equal(vertical.ok, true);
  assert.equal(vertical.anchorUsed, 'subject');
  assert.equal(vertical.aspect, '9:16');
  // 400×500 原图裁 9:16 只有 281px 宽，不放大，如实输出 281×500。
  assert.equal(vertical.width, 281);
  assert.equal(vertical.height, 500);
  const meta = await sharp(vertical.buffer!).metadata();
  assert.equal(meta.width, 281);
  assert.equal(meta.height, 500);
  assert.equal(vertical.subjectClipped, false, '9:16 裁切不应切到主体');
  assert.ok(vertical.crop);
  assert.equal(vertical.crop!.width, 281);
  assert.equal(vertical.crop!.height, 500);

  const wide = await reframeAiImageToAspect(image, { aspect: '16:9', width: 800 });
  assert.equal(wide.ok, true);
  assert.equal(wide.width, 400);
  assert.equal(wide.height, 225);
  assert.equal(wide.subjectClipped, true, '16:9 会切到主体，必须如实上报');

  assert.equal(parseAiAspect('4:5'), 0.8);
  assert.throws(() => parseAiAspect('abc'), /AI_MEDIA_PARAMS_INVALID/);
  assert.throws(() => parseAiAspect('0:5'), /AI_MEDIA_PARAMS_INVALID/);
});

test('画幅：背景不统一时明确回退画面中心并标注', async () => {
  const noisy = Buffer.alloc(300 * 200 * 3).map((_, i) => (i * 41) % 255);
  const image = await sharp(noisy, { raw: { width: 300, height: 200, channels: 3 } }).png().toBuffer();
  const result = await reframeAiImageToAspect(image, { aspect: '1:1', width: 400 });
  assert.equal(result.ok, true);
  assert.equal(result.anchorUsed, 'center');
  assert.equal(result.width, 200);
  assert.equal(result.height, 200);
  assert.equal(result.bbox, null);
});
