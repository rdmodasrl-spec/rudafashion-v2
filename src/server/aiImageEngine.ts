import sharp from 'sharp';
import { AI_MEDIA_LIMITS, AiMediaError } from './aiMediaToolkit';

/**
 * MODAUI Image Engine —— 确定性图片算法引擎。
 *
 * 定位（docs/engineering/modules/modaui-media-engines.md）：
 * 抠图、白底合成、颜色变体、质检、去重、重构图这类高频操作**不调用任何付费模型**，
 * 用 Sharp 原始像素 + Lab 色彩空间 + 连通域 / 拉普拉斯 / 感知哈希等经典算法完成。
 *
 * 产品必须诚实的能力边界：
 * - 本引擎解决「纯色/近纯色背景」抠图（服装批发白底实拍是主流场景），
 *   复杂背景人像式抠图需要分割模型（未接通，需模型文件与许可证审查）。
 * - 边界不满足条件时返回 `reason`，**不伪造抠图结果**，调用方据此降级到模型能力。
 *
 * 安全与资源约束：复用 aiMediaToolkit 的输入体积上限、尺寸上限与错误码；
 * 所有分析在最长边 ≤ 640px 的降采样图上进行，避免大图把 CPU 拖死。
 */

export const AI_IMAGE_ENGINE_LIMITS = {
  analysisSize: 640,
  maxInputBytes: AI_MEDIA_LIMITS.maxImageBytes,
  maxDim: AI_MEDIA_LIMITS.maxDimension
} as const;

export type AiLab = { L: number; a: number; b: number };
export type AiRgb = { r: number; g: number; b: number };
export type AiBox = { left: number; top: number; width: number; height: number };

/** 一次降采样分析结果：原图分辨率只在最终导出时使用。 */
export type AiRaster = {
  data: Buffer;
  width: number;
  height: number;
  channels: number;
};

function clampByte(value: number): number {
  return value < 0 ? 0 : value > 255 ? 255 : Math.round(value);
}

export function srgbToLinear(channel: number): number {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

export function linearToSrgb(channel: number): number {
  const c = channel <= 0.0031308 ? channel * 12.92 : 1.055 * Math.pow(channel, 1 / 2.4) - 0.055;
  return clampByte(c * 255);
}

function pivot(t: number): number {
  return t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116;
}

/** sRGB → CIE Lab（D65），与 OpenCV / ImageMagick 结果同量级，可直接用于 ΔE 比较。 */
export function rgbToLab(r: number, g: number, b: number): AiLab {
  const lr = srgbToLinear(r);
  const lg = srgbToLinear(g);
  const lb = srgbToLinear(b);
  const x = (lr * 0.4124564 + lg * 0.3575761 + lb * 0.1804375) / 0.95047;
  const y = lr * 0.2126729 + lg * 0.7151522 + lb * 0.072175;
  const z = (lr * 0.0193339 + lg * 0.119192 + lb * 0.9503041) / 1.08883;
  const fx = pivot(x);
  const fy = pivot(y);
  const fz = pivot(z);
  return { L: 116 * fy - 16, a: 500 * (fx - fy), b: 200 * (fy - fz) };
}

export function labToRgb(L: number, a: number, b: number): AiRgb {
  const fy = (L + 16) / 116;
  const fx = fy + a / 500;
  const fz = fy - b / 200;
  const inv = (t: number): number => {
    const t3 = t * t * t;
    return t3 > 0.008856 ? t3 : (t - 16 / 116) / 7.787;
  };
  const x = inv(fx) * 0.95047;
  const y = inv(fy);
  const z = inv(fz) * 1.08883;
  const lr = x * 3.2404542 + y * -1.5371385 + z * -0.4985314;
  const lg = x * -0.969266 + y * 1.8760108 + z * 0.041556;
  const lb = x * 0.0556434 + y * -0.2040259 + z * 1.0572252;
  return { r: linearToSrgb(lr), g: linearToSrgb(lg), b: linearToSrgb(lb) };
}

/** ΔE76 色差：<2.3 人眼几乎不可分辨，>10 已是明显不同颜色。 */
export function labDistance(a: AiLab, b: AiLab): number {
  const dL = a.L - b.L;
  const da = a.a - b.a;
  const db = a.b - b.b;
  return Math.sqrt(dL * dL + da * da + db * db);
}

export function parseHexColor(hex: string): AiRgb {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) throw new AiMediaError('AI_MEDIA_PARAMS_INVALID', `hex:${hex}`);
  const value = parseInt(match[1], 16);
  return { r: (value >> 16) & 0xff, g: (value >> 8) & 0xff, b: value & 0xff };
}

export function toHexColor(rgb: AiRgb): string {
  const hex = (channel: number): string => clampByte(channel).toString(16).padStart(2, '0');
  return `#${hex(rgb.r)}${hex(rgb.g)}${hex(rgb.b)}`;
}

/** 降采样到分析尺寸并统一为 RGBA，供所有算法复用同一份像素数据。 */
export async function loadAiRaster(input: Buffer, maxSize: number = AI_IMAGE_ENGINE_LIMITS.analysisSize): Promise<AiRaster> {
  if (!Buffer.isBuffer(input) || input.length === 0) throw new AiMediaError('AI_MEDIA_INPUT_INVALID');
  if (input.length > AI_IMAGE_ENGINE_LIMITS.maxInputBytes) throw new AiMediaError('AI_MEDIA_INPUT_TOO_LARGE');
  if (!Number.isInteger(maxSize) || maxSize < 32 || maxSize > 2048) {
    throw new AiMediaError('AI_MEDIA_PARAMS_INVALID', 'maxSize');
  }
  try {
    const { data, info } = await sharp(input, { failOn: 'error' })
      .rotate()
      .resize({ width: maxSize, height: maxSize, fit: 'inside', withoutEnlargement: true })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    return { data, width: info.width, height: info.height, channels: info.channels };
  } catch (error) {
    if (error instanceof AiMediaError) throw error;
    throw new AiMediaError('AI_MEDIA_INPUT_INVALID');
  }
}

function pixelsToLab(raster: AiRaster): Float32Array {
  const { data, width, height, channels } = raster;
  const out = new Float32Array(width * height * 3);
  for (let i = 0, p = 0; i < width * height; i += 1, p += channels) {
    const lab = rgbToLab(data[p], data[p + 1], data[p + 2]);
    out[i * 3] = lab.L;
    out[i * 3 + 1] = lab.a;
    out[i * 3 + 2] = lab.b;
  }
  return out;
}

/** 中位数对白底阴影、反光等离群点比均值稳健，抠图边界色不会被染脏。 */
function medianOf(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function boxBlur(src: Float32Array, width: number, height: number, radius: number): Float32Array {
  if (radius <= 0) return src;
  const tmp = new Float32Array(src.length);
  const out = new Float32Array(src.length);
  const span = radius * 2 + 1;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let sum = 0;
      for (let k = -radius; k <= radius; k += 1) {
        const xx = Math.min(width - 1, Math.max(0, x + k));
        sum += src[y * width + xx];
      }
      tmp[y * width + x] = sum / span;
    }
  }
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let sum = 0;
      for (let k = -radius; k <= radius; k += 1) {
        const yy = Math.min(height - 1, Math.max(0, y + k));
        sum += tmp[yy * width + x];
      }
      out[y * width + x] = sum / span;
    }
  }
  return out;
}

export type AiSegmentationReason =
  | 'ok'
  | 'background_not_uniform'
  | 'subject_fills_frame'
  | 'subject_not_found';

export type AiImageSegmentation = {
  ok: boolean;
  reason: AiSegmentationReason;
  analysisWidth: number;
  analysisHeight: number;
  sourceWidth: number;
  sourceHeight: number;
  /** 源图像素 / 分析像素，用于把 bbox 还原到原图坐标。 */
  scale: number;
  bbox: AiBox | null;
  subjectCoverage: number;
  /** 1 = 四周边框颜色完全一致；背景越花这个值越低。 */
  borderUniformity: number;
  borderColor: string;
  borderDeltaE: number;
  /** 分析分辨率下的主体遮罩（0–255），只在 ok 时有值。 */
  alpha: Buffer | null;
};

export type AiSegmentOptions = {
  maxAnalysisSize?: number;
  /** ΔE 容差：越大越宽松，白底实拍默认 10 足够吸收阴影渐变。 */
  tolerance?: number;
  minCoverage?: number;
  maxCoverage?: number;
};

/**
 * 纯色背景商品分割：边框取中位色 → Lab 容差泛洪 → 主体遮罩 → 羽化。
 * 泛洪只从四条边出发，因此商品内部的白色 Logo、白标不会被打成背景。
 */
export async function segmentAiImageSubject(
  input: Buffer,
  options: AiSegmentOptions = {}
): Promise<AiImageSegmentation> {
  const maxAnalysisSize = options.maxAnalysisSize ?? AI_IMAGE_ENGINE_LIMITS.analysisSize;
  const tolerance = options.tolerance ?? 10;
  const minCoverage = options.minCoverage ?? 0.01;
  const maxCoverage = options.maxCoverage ?? 0.995;
  if (!Number.isFinite(tolerance) || tolerance <= 0 || tolerance > 60) {
    throw new AiMediaError('AI_MEDIA_PARAMS_INVALID', 'tolerance');
  }

  const meta = await sharp(input).metadata();
  const raster = await loadAiRaster(input, maxAnalysisSize);
  const { width, height } = raster;
  const labs = pixelsToLab(raster);
  const scale = meta.width && meta.width > 0 ? meta.width / width : 1;

  const band = Math.max(1, Math.min(4, Math.floor(Math.min(width, height) * 0.01)));
  const borderL: number[] = [];
  const borderA: number[] = [];
  const borderB: number[] = [];
  const isBorder = (x: number, y: number): boolean =>
    x < band || y < band || x >= width - band || y >= height - band;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (!isBorder(x, y)) continue;
      const p = (y * width + x) * 3;
      borderL.push(labs[p]);
      borderA.push(labs[p + 1]);
      borderB.push(labs[p + 2]);
    }
  }
  const base: AiLab = { L: medianOf(borderL), a: medianOf(borderA), b: medianOf(borderB) };
  let deltaSum = 0;
  for (let i = 0; i < borderL.length; i += 1) {
    deltaSum += labDistance({ L: borderL[i], a: borderA[i], b: borderB[i] }, base);
  }
  const borderDeltaE = borderL.length > 0 ? deltaSum / borderL.length : 0;
  const borderUniformity = Math.max(0, Math.min(1, 1 - borderDeltaE / 15));
  const baseLabel = labToRgb(base.L, base.a, base.b);

  const baseResult = {
    analysisWidth: width,
    analysisHeight: height,
    sourceWidth: meta.width ?? width,
    sourceHeight: meta.height ?? height,
    scale,
    borderUniformity: Math.round(borderUniformity * 1000) / 1000,
    borderColor: toHexColor(baseLabel),
    borderDeltaE: Math.round(borderDeltaE * 100) / 100
  };

  // 背景不够干净时明确拒绝，交给分割模型，而不是给商家一张边缘被啃掉的图。
  if (borderUniformity < 0.55) {
    return { ...baseResult, ok: false, reason: 'background_not_uniform', bbox: null, subjectCoverage: 0, alpha: null };
  }

  const total = width * height;
  const isBackground = new Uint8Array(total);
  const stack = new Int32Array(total);
  let top = 0;
  const toleranceSq = tolerance * tolerance;
  const closeToBase = (index: number): boolean => {
    const p = index * 3;
    const dL = labs[p] - base.L;
    const da = labs[p + 1] - base.a;
    const db = labs[p + 2] - base.b;
    return dL * dL + da * da + db * db <= toleranceSq;
  };

  const seed = (index: number): void => {
    if (isBackground[index] === 1 || !closeToBase(index)) return;
    isBackground[index] = 1;
    stack[top++] = index;
  };
  for (let x = 0; x < width; x += 1) {
    seed(x);
    seed((height - 1) * width + x);
  }
  for (let y = 0; y < height; y += 1) {
    seed(y * width);
    seed(y * width + width - 1);
  }

  let backgroundCount = 0;
  while (top > 0) {
    const index = stack[--top];
    backgroundCount += 1;
    const x = index % width;
    const y = (index - x) / width;
    if (x > 0) seed(index - 1);
    if (x < width - 1) seed(index + 1);
    if (y > 0) seed(index - width);
    if (y < height - 1) seed(index + width);
  }

  const backgroundRatio = backgroundCount / total;
  const subjectCoverage = Math.round((1 - backgroundRatio) * 10000) / 10000;
  if (backgroundRatio < 0.01) {
    return { ...baseResult, ok: false, reason: 'subject_fills_frame', bbox: null, subjectCoverage, alpha: null };
  }
  if (subjectCoverage < minCoverage || subjectCoverage > maxCoverage) {
    return { ...baseResult, ok: false, reason: 'subject_not_found', bbox: null, subjectCoverage, alpha: null };
  }

  const mask = new Float32Array(total);
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x;
      if (isBackground[index] === 1) continue;
      mask[index] = 255;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }

  const feathered = boxBlur(boxBlur(mask, width, height, 1), width, height, 1);
  const alpha = Buffer.allocUnsafe(total);
  for (let i = 0; i < total; i += 1) alpha[i] = clampByte(feathered[i]);

  const bbox: AiBox = {
    left: Math.round(minX * scale),
    top: Math.round(minY * scale),
    width: Math.max(1, Math.round((maxX - minX + 1) * scale)),
    height: Math.max(1, Math.round((maxY - minY + 1) * scale))
  };

  return { ...baseResult, ok: true, reason: 'ok', bbox, subjectCoverage, alpha };
}

export type AiCutoutResult = {
  ok: boolean;
  reason: AiSegmentationReason;
  buffer: Buffer | null;
  format: 'png' | 'webp' | 'jpeg';
  width: number;
  height: number;
  bbox: AiBox | null;
  subjectCoverage: number;
  borderColor: string;
  borderUniformity: number;
};

/** 遮罩缩放：sharp 的 raw 输出会把单通道按 sRGB 升到 3 通道，必须显式取回 b-w 再按 stride 取样。 */
async function resizeMask(
  mask: Buffer,
  from: { width: number; height: number },
  to: { width: number; height: number }
): Promise<Buffer> {
  const { data, info } = await sharp(mask, {
    raw: { width: from.width, height: from.height, channels: 1 }
  })
    .resize({ width: to.width, height: to.height, fit: 'fill', kernel: 'cubic' })
    .toColourspace('b-w')
    .raw()
    .toBuffer({ resolveWithObject: true });
  const stride = info.channels && info.channels > 0 ? info.channels : 1;
  const out = Buffer.allocUnsafe(to.width * to.height);
  for (let i = 0; i < out.length; i += 1) out[i] = data[i * stride] ?? 0;
  return out;
}

/** 把分析分辨率的遮罩还原到原图分辨率（双三次），边缘不会出现锯齿台阶。 */
async function upscaleAlpha(
  input: Buffer,
  segmentation: AiImageSegmentation
): Promise<{ alpha: Buffer; width: number; height: number } | null> {
  if (!segmentation.alpha) return null;
  const meta = await sharp(input).metadata();
  const width = meta.width ?? segmentation.sourceWidth;
  const height = meta.height ?? segmentation.sourceHeight;
  const alpha = await resizeMask(
    segmentation.alpha,
    { width: segmentation.analysisWidth, height: segmentation.analysisHeight },
    { width, height }
  );
  return { alpha, width, height };
}

export type AiCutoutOptions = AiSegmentOptions & {
  format?: 'png' | 'webp' | 'jpeg';
  /** jpeg/webp 不支持透明，需要给一个底色；默认纯白便于电商主图。 */
  backgroundColorHex?: string;
  quality?: number;
};

/**
 * 商品抠图导出。返回透明 PNG（或指定底色的 jpeg/webp）。
 * 分割失败时不返回任何图，只返回原因，避免把错误结果当成抠图成品交付。
 */
export async function cutoutAiProduct(input: Buffer, options: AiCutoutOptions = {}): Promise<AiCutoutResult> {
  const format = options.format ?? 'png';
  const segmentation = await segmentAiImageSubject(input, options);
  const base = {
    ok: false,
    reason: segmentation.reason,
    buffer: null as Buffer | null,
    format,
    width: segmentation.sourceWidth,
    height: segmentation.sourceHeight,
    bbox: segmentation.bbox,
    subjectCoverage: segmentation.subjectCoverage,
    borderColor: segmentation.borderColor,
    borderUniformity: segmentation.borderUniformity
  };
  if (!segmentation.ok) return base;

  const masked = await upscaleAlpha(input, segmentation);
  if (!masked) return base;

  const { data, info } = await sharp(input, { failOn: 'error' })
    .rotate()
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const width = info.width ?? masked.width;
  const height = info.height ?? masked.height;
  const channels = info.channels ?? 4;
  if (channels !== 4) throw new AiMediaError('AI_MEDIA_INPUT_INVALID');
  const total = Math.min(width * height, masked.alpha.length);
  for (let i = 0; i < total; i += 1) {
    const mask = masked.alpha[i] ?? 0;
    data[i * 4 + 3] = Math.min(data[i * 4 + 3], mask);
  }

  let pipeline = sharp(data, { raw: { width, height, channels: 4 } });
  if (format === 'png') {
    pipeline = pipeline.png({ compressionLevel: 9 });
  } else {
    const background = parseHexColor(options.backgroundColorHex ?? '#ffffff');
    pipeline = pipeline.flatten({ background });
    pipeline = format === 'webp'
      ? pipeline.webp({ quality: options.quality ?? 90 })
      : pipeline.jpeg({ quality: options.quality ?? 92, mozjpeg: true });
  }
  const buffer = await pipeline.toBuffer();
  return { ...base, ok: true, buffer, width, height };
}

/** 生成椭圆接触阴影（纯像素计算，不依赖 SVG 渲染器）。 */
function buildContactShadow(width: number, height: number, opacity: number): Buffer {
  const out = Buffer.allocUnsafe(width * height * 4);
  const cx = (width - 1) / 2;
  const cy = (height - 1) / 2;
  const rx = Math.max(1, width / 2);
  const ry = Math.max(1, height / 2);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const dx = (x - cx) / rx;
      const dy = (y - cy) / ry;
      const falloff = Math.max(0, 1 - (dx * dx + dy * dy));
      const p = (y * width + x) * 4;
      out[p] = 0;
      out[p + 1] = 0;
      out[p + 2] = 0;
      out[p + 3] = clampByte(Math.pow(falloff, 1.6) * 255 * opacity);
    }
  }
  return out;
}


export type AiProductShotOptions = AiSegmentOptions & {
  /** 输出正方形边长（商品主图默认 2000）。 */
  size?: number;
  /** 主体四周留白比例，0.08 = 8%。 */
  paddingRatio?: number;
  backgroundColorHex?: string;
  shadowOpacity?: number;
  format?: 'png' | 'jpeg' | 'webp';
  quality?: number;
};

export type AiProductShotResult = {
  ok: boolean;
  reason: AiSegmentationReason;
  buffer: Buffer | null;
  width: number;
  height: number;
  /** 主体在输出画布中的面积占比，供质检使用。 */
  subjectFillRatio: number;
  bbox: AiBox | null;
};

/**
 * 商品白底主图：抠图 → 按 bbox 收紧 → 等比缩放 → 居中留白 → 底部接触阴影 → 导出。
 * 全过程无生成式修改，商品颜色、纹理、Logo 与实拍一致。
 */
export async function composeAiProductShot(
  input: Buffer,
  options: AiProductShotOptions = {}
): Promise<AiProductShotResult> {
  const size = options.size ?? 2000;
  const paddingRatio = options.paddingRatio ?? 0.08;
  const shadowOpacity = options.shadowOpacity ?? 0.18;
  if (!Number.isInteger(size) || size < 200 || size > AI_IMAGE_ENGINE_LIMITS.maxDim) {
    throw new AiMediaError('AI_MEDIA_PARAMS_INVALID', 'size');
  }
  if (!Number.isFinite(paddingRatio) || paddingRatio < 0 || paddingRatio > 0.4) {
    throw new AiMediaError('AI_MEDIA_PARAMS_INVALID', 'paddingRatio');
  }
  const cutout = await cutoutAiProduct(input, options);
  if (!cutout.ok || !cutout.buffer || !cutout.bbox) {
    return {
      ok: false,
      reason: cutout.reason,
      buffer: null,
      width: size,
      height: size,
      subjectFillRatio: 0,
      bbox: cutout.bbox
    };
  }

  const background = parseHexColor(options.backgroundColorHex ?? '#ffffff');
  const inner = Math.round(size * (1 - paddingRatio * 2));
  const subject = await sharp(cutout.buffer)
    .extract({ left: cutout.bbox.left, top: cutout.bbox.top, width: cutout.bbox.width, height: cutout.bbox.height })
    .resize({ width: inner, height: inner, fit: 'inside' })
    .png()
    .toBuffer({ resolveWithObject: true });

  const placedLeft = Math.round((size - subject.info.width) / 2);
  const placedTop = Math.round((size - subject.info.height) / 2);
  const shadowWidth = Math.max(8, Math.round(subject.info.width * 0.86));
  const shadowHeight = Math.max(6, Math.round(subject.info.width * 0.12));
  const shadowLeft = Math.round((size - shadowWidth) / 2);
  const shadowTop = Math.min(
    size - shadowHeight,
    placedTop + subject.info.height - Math.round(shadowHeight * 0.45)
  );

  let pipeline = sharp({
    create: { width: size, height: size, channels: 4, background: { ...background, alpha: 1 } }
  }).composite([
    {
      input: buildContactShadow(shadowWidth, shadowHeight, shadowOpacity),
      raw: { width: shadowWidth, height: shadowHeight, channels: 4 },
      left: shadowLeft,
      top: shadowTop
    },
    { input: subject.data, left: placedLeft, top: placedTop }
  ]);

  const format = options.format ?? 'jpeg';
  pipeline = format === 'png'
    ? pipeline.png({ compressionLevel: 9 })
    : format === 'webp'
      ? pipeline.webp({ quality: options.quality ?? 90 })
      : pipeline.jpeg({ quality: options.quality ?? 92, mozjpeg: true });

  const buffer = await pipeline.toBuffer();
  return {
    ok: true,
    reason: 'ok',
    buffer,
    width: size,
    height: size,
    subjectFillRatio: Math.round(((subject.info.width * subject.info.height) / (size * size)) * 10000) / 10000,
    bbox: cutout.bbox
  };
}



export type AiColorVariantSpec = { name: string; hex: string };

export type AiColorVariant = {
  name: string;
  targetHex: string;
  /** 实际被替换的像素占比，用于判断「这件衣服本来就没有这个颜色」。 */
  changedRatio: number;
  buffer: Buffer;
};

export type AiColorVariantsResult = {
  ok: boolean;
  reason: AiSegmentationReason | 'no_variants';
  sourceColorHex: string | null;
  swatches: AiColorSwatch[];
  variants: AiColorVariant[];
  downscaled: boolean;
  width: number;
  height: number;
};

export type AiColorVariantOptions = AiColorOptions & {
  variants: AiColorVariantSpec[];
  /** 从哪个颜色开始替换；不传则用主体第一主色。 */
  fromHex?: string;
  /** ΔE 容差，越大换色范围越宽（容易误伤同色系装饰）。 */
  tolerance?: number;
  /** 只换色相、保留原明暗与纹理（默认 true）。 */
  preserveShading?: boolean;
  /** 输出长边上限，默认 2048。 */
  outputSize?: number;
  format?: 'png' | 'jpeg' | 'webp';
  quality?: number;
};

function smoothstep(edge0: number, edge1: number, value: number): number {
  const t = Math.max(0, Math.min(1, (value - edge0) / (edge1 - edge0 || 1)));
  return t * t * (3 - 2 * t);
}

/**
 * 智能颜色工厂：在主体遮罩内按 ΔE 找出「原色区域」，
 * 用 Lab 通道把色相/彩度替换为目标色，同时按原图亮度比例缩放明度，
 * 因此褶皱、阴影、面料纹理全部保留，不会出现「贴一块纯色」的假图。
 */
export async function generateAiColorVariants(
  input: Buffer,
  options: AiColorVariantOptions
): Promise<AiColorVariantsResult> {
  if (!Array.isArray(options.variants) || options.variants.length === 0) {
    throw new AiMediaError('AI_MEDIA_PARAMS_INVALID', 'variants');
  }
  if (options.variants.length > 12) throw new AiMediaError('AI_MEDIA_PARAMS_INVALID', 'variants.length');
  for (const variant of options.variants) parseHexColor(variant.hex);

  const tolerance = options.tolerance ?? 14;
  const preserveShading = options.preserveShading ?? true;
  const outputSize = options.outputSize ?? 2048;
  const segmentation = await segmentAiImageSubject(input, options);
  const swatches = (await extractAiDominantColors(input, { ...options, count: 4 })).swatches;
  const empty = {
    ok: false,
    reason: segmentation.reason,
    sourceColorHex: swatches[0]?.hex ?? null,
    swatches,
    variants: [] as AiColorVariant[],
    downscaled: false,
    width: 0,
    height: 0
  };
  if (!segmentation.ok) return empty;

  const raster = await loadAiRaster(input, outputSize);
  const meta = await sharp(input).metadata();
  const downscaled = (meta.width ?? 0) > raster.width;
  const alpha = await resizeMask(
    segmentation.alpha as Buffer,
    { width: segmentation.analysisWidth, height: segmentation.analysisHeight },
    { width: raster.width, height: raster.height }
  );

  const sourceHex = options.fromHex ?? swatches[0]?.hex ?? null;
  if (!sourceHex) return empty;
  const sourceRgb = parseHexColor(sourceHex);
  const sourceLab = rgbToLab(sourceRgb.r, sourceRgb.g, sourceRgb.b);
  const sourceChroma = Math.sqrt(sourceLab.a * sourceLab.a + sourceLab.b * sourceLab.b);

  const variants: AiColorVariant[] = [];
  for (const variant of options.variants) {
    const targetRgb = parseHexColor(variant.hex);
    const targetLab = rgbToLab(targetRgb.r, targetRgb.g, targetRgb.b);
    const out = Buffer.from(raster.data);
    let changed = 0;
    let considered = 0;

    for (let i = 0; i < raster.width * raster.height; i += 1) {
      const mask = alpha[i] / 255;
      if (mask < 0.02) continue;
      considered += 1;
      const p = i * raster.channels;
      const lab = rgbToLab(out[p], out[p + 1], out[p + 2]);
      const dL = (lab.L - sourceLab.L) * 0.45;
      const da = lab.a - sourceLab.a;
      const db = lab.b - sourceLab.b;
      const distance = Math.sqrt(dL * dL + da * da + db * db);
      const weight = 1 - smoothstep(tolerance * 0.55, tolerance, distance);
      if (weight <= 0.01) continue;

      const pixelChroma = Math.sqrt(lab.a * lab.a + lab.b * lab.b);
      const chromaScale = sourceChroma > 1 ? pixelChroma / sourceChroma : 1;
      const luminanceRatio = preserveShading
        ? Math.max(0.4, Math.min(2.4, sourceLab.L > 2 ? lab.L / sourceLab.L : 1))
        : 1;
      const nextLab: AiLab = {
        L: Math.max(0, Math.min(100, preserveShading ? targetLab.L * luminanceRatio : lab.L)),
        a: targetLab.a * chromaScale,
        b: targetLab.b * chromaScale
      };
      const next = labToRgb(nextLab.L, nextLab.a, nextLab.b);
      const blend = weight * mask;
      out[p] = clampByte(out[p] * (1 - blend) + next.r * blend);
      out[p + 1] = clampByte(out[p + 1] * (1 - blend) + next.g * blend);
      out[p + 2] = clampByte(out[p + 2] * (1 - blend) + next.b * blend);
      changed += 1;
    }

    for (let i = 0; i < raster.width * raster.height; i += 1) out[i * raster.channels + 3] = alpha[i];

    let pipeline = sharp(out, { raw: { width: raster.width, height: raster.height, channels: 4 } });
    const format = options.format ?? 'png';
    pipeline = format === 'png'
      ? pipeline.png({ compressionLevel: 9 })
      : format === 'webp'
        ? pipeline.webp({ quality: options.quality ?? 90 })
        : pipeline.flatten({ background: { r: 255, g: 255, b: 255 } }).jpeg({ quality: options.quality ?? 92 });

    variants.push({
      name: variant.name,
      targetHex: toHexColor(targetRgb),
      changedRatio: considered > 0 ? Math.round((changed / considered) * 10000) / 10000 : 0,
      buffer: await pipeline.toBuffer()
    });
  }

  return {
    ok: true,
    reason: 'ok',
    sourceColorHex: sourceHex,
    swatches,
    variants,
    downscaled,
    width: raster.width,
    height: raster.height
  };
}


export type AiQualityStatus = 'pass' | 'warn' | 'fail' | 'unknown';

export type AiQualityItem = {
  key: string;
  label: string;
  status: AiQualityStatus;
  /** 真实测量值；unknown 时为 null，绝不填占位数字。 */
  measured: number | string | null;
  threshold: string;
  suggestion: string | null;
};

export type AiImageQualityReport = {
  ok: boolean;
  width: number;
  height: number;
  score: number;
  overallStatus: AiQualityStatus;
  items: AiQualityItem[];
  /** 算法原始指标，便于在后台追溯评分依据。 */
  metrics: {
    laplacianVariance: number;
    shadowClipRatio: number;
    highlightClipRatio: number;
    colorCastA: number;
    colorCastB: number;
    subjectCoverage: number;
    borderUniformity: number;
    segmentation: AiSegmentationReason;
  };
};

export type AiQualityOptions = AiSegmentOptions & {
  minShortSide?: number;
  /** 判定模糊的拉普拉斯方差下限，默认 60（经验值，后台可按机型调整）。 */
  blurFailBelow?: number;
  blurWarnBelow?: number;
};

function grayscaleOf(raster: AiRaster): Float32Array {
  const { data, width, height, channels } = raster;
  const out = new Float32Array(width * height);
  for (let i = 0, p = 0; i < width * height; i += 1, p += channels) {
    out[i] = 0.299 * data[p] + 0.587 * data[p + 1] + 0.114 * data[p + 2];
  }
  return out;
}

/** 拉普拉斯方差：>150 清晰，60–150 边缘偏软，<60 基本糊掉。 */
function laplacianVariance(
  gray: Float32Array,
  width: number,
  height: number,
  inside: (index: number) => boolean
): number {
  let count = 0;
  let sum = 0;
  let sumSq = 0;
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const index = y * width + x;
      if (!inside(index)) continue;
      const value = -4 * gray[index]
        + gray[index - 1] + gray[index + 1] + gray[index - width] + gray[index + width];
      sum += value;
      sumSq += value * value;
      count += 1;
    }
  }
  if (count < 16) return 0;
  const mean = sum / count;
  return Math.max(0, sumSq / count - mean * mean);
}

export type AiQualityMetrics = AiImageQualityReport['metrics'];

/** 测量曝光 / 色彩偏移；主体分割成功时只统计主体内部像素，避免白底把高光比例拉爆。 */
async function measureAiPixels(input: Buffer, options: AiQualityOptions): Promise<{
  segmentation: AiImageSegmentation;
  laplacian: number;
  shadowClipRatio: number;
  highlightClipRatio: number;
  colorCastA: number;
  colorCastB: number;
}> {
  const raster = await loadAiRaster(input, options.maxAnalysisSize);
  const gray = grayscaleOf(raster);
  const segmentation = await segmentAiImageSubject(input, options);
  const total = raster.width * raster.height;
  const alpha = segmentation.ok ? segmentation.alpha : null;
  const inside = (index: number): boolean => (alpha ? alpha[index] > 128 : true);
  const laplacian = laplacianVariance(gray, raster.width, raster.height, inside);
  const labs = pixelsToLab(raster);

  let shadowCount = 0;
  let highlightCount = 0;
  let sampled = 0;
  let sumA = 0;
  let sumB = 0;
  for (let i = 0; i < total; i += 1) {
    if (!inside(i)) continue;
    const p = i * raster.channels;
    const luma = 0.299 * raster.data[p] + 0.587 * raster.data[p + 1] + 0.114 * raster.data[p + 2];
    if (luma < 6) shadowCount += 1;
    if (luma > 250) highlightCount += 1;
    sumA += labs[i * 3 + 1];
    sumB += labs[i * 3 + 2];
    sampled += 1;
  }
  return {
    segmentation,
    laplacian,
    shadowClipRatio: sampled > 0 ? shadowCount / sampled : 0,
    highlightClipRatio: sampled > 0 ? highlightCount / sampled : 0,
    colorCastA: sampled > 0 ? sumA / sampled : 0,
    colorCastB: sampled > 0 ? sumB / sampled : 0
  };
}

/**
 * 商品图质检：清晰度、尺寸、完整度、主体占比、曝光、色彩偏差、背景一致性、比例。
 * 分数全部来自真实像素计算；无法判定时状态为 unknown 并给出原因，不编造通过与不通过。
 */
export async function assessAiImageQuality(
  input: Buffer,
  options: AiQualityOptions = {}
): Promise<AiImageQualityReport> {
  const meta = await sharp(input).metadata();
  const width = meta.width ?? 0;
  const height = meta.height ?? 0;
  if (!width || !height) throw new AiMediaError('AI_MEDIA_INPUT_INVALID');

  const measured = await measureAiPixels(input, options);
  const { segmentation, laplacian } = measured;
  const blurFailBelow = options.blurFailBelow ?? 60;
  const blurWarnBelow = options.blurWarnBelow ?? 150;
  const minShortSide = options.minShortSide ?? 800;
  const shortSide = Math.min(width, height);
  const items: AiQualityItem[] = [];

  items.push({
    key: 'sharpness',
    label: '图片清晰度',
    status: laplacian < blurFailBelow ? 'fail' : laplacian < blurWarnBelow ? 'warn' : 'pass',
    measured: Math.round(laplacian * 10) / 10,
    threshold: `≥${blurWarnBelow} 通过，<${blurFailBelow} 不通过`,
    suggestion: laplacian < blurFailBelow ? '重新对焦拍摄，或减少相机抖动后重拍' : null
  });

  items.push({
    key: 'resolution',
    label: '图片尺寸',
    status: shortSide < minShortSide * 0.5 ? 'fail' : shortSide < minShortSide ? 'warn' : 'pass',
    measured: `${width}×${height}`,
    threshold: `短边 ≥${minShortSide}px`,
    suggestion: shortSide < minShortSide ? '用原图导出，避免被聊天软件压缩过的图片' : null
  });

  const edgeMargin = Math.max(2, Math.round(Math.min(width, height) * 0.01));
  const bbox = segmentation.bbox;
  const cropped = bbox
    ? bbox.left <= edgeMargin
      || bbox.top <= edgeMargin
      || bbox.left + bbox.width >= width - edgeMargin
      || bbox.top + bbox.height >= height - edgeMargin
    : false;
  items.push({
    key: 'completeness',
    label: '商品完整度',
    status: segmentation.ok ? (cropped ? 'fail' : 'pass') : 'unknown',
    measured: segmentation.ok ? (cropped ? '主体贴边' : '主体完整') : '背景非纯色，无法判定',
    threshold: '主体四周至少留 1% 边距',
    suggestion: cropped ? '商品被画幅裁切，请重拍或扩大取景范围' : null
  });

  items.push({
    key: 'subject_scale',
    label: '主体占比',
    status: segmentation.ok
      ? segmentation.subjectCoverage < 0.08 || segmentation.subjectCoverage > 0.98 ? 'warn' : 'pass'
      : 'unknown',
    measured: segmentation.ok ? `${Math.round(segmentation.subjectCoverage * 1000) / 10}%` : null,
    threshold: '建议 8%–98%',
    suggestion: segmentation.ok && segmentation.subjectCoverage < 0.08
      ? '主体过小，建议裁剪到商品占画面主要区域'
      : null
  });

  items.push({
    key: 'exposure',
    label: '曝光',
    status: measured.shadowClipRatio > 0.15
      ? 'fail'
      : measured.shadowClipRatio > 0.05 || measured.highlightClipRatio > 0.35 ? 'warn' : 'pass',
    measured: `暗部丢失 ${Math.round(measured.shadowClipRatio * 1000) / 10}% / 高光溢出 ${Math.round(measured.highlightClipRatio * 1000) / 10}%`,
    threshold: '暗部丢失 ≤5%，高光溢出 ≤35%',
    suggestion: measured.shadowClipRatio > 0.05 ? '补光或提高曝光，暗部细节已丢失' : null
  });

  const castA = Math.abs(measured.colorCastA);
  const castB = Math.abs(measured.colorCastB);
  items.push({
    key: 'color_cast',
    label: '色彩偏差',
    status: castA > 5 || castB > 7 ? 'warn' : 'pass',
    measured: `a=${Math.round(measured.colorCastA * 10) / 10} b=${Math.round(measured.colorCastB * 10) / 10}`,
    threshold: '|a|≤5 且 |b|≤7',
    suggestion: castA > 5 || castB > 7 ? '做白平衡校正，避免商品偏黄或偏蓝' : null
  });

  items.push({
    key: 'background',
    label: '背景一致性',
    status: segmentation.borderUniformity > 0.9 ? 'pass' : 'warn',
    measured: segmentation.borderUniformity,
    threshold: '≥0.9 视为统一背景',
    suggestion: segmentation.borderUniformity <= 0.9 ? '换成纯色背景重新导出，主图更统一' : null
  });

  const ratios: Array<[string, number]> = [['1:1', 1], ['4:5', 0.8], ['2:3', 2 / 3], ['9:16', 9 / 16], ['16:9', 16 / 9]];
  const currentRatio = width / height;
  const matched = ratios.find(([, ratioValue]) => Math.abs(currentRatio - ratioValue) / ratioValue < 0.02);
  items.push({
    key: 'aspect_ratio',
    label: '图片比例',
    status: matched ? 'pass' : 'warn',
    measured: matched ? matched[0] : `${Math.round(currentRatio * 100) / 100}:1`,
    threshold: '1:1 / 4:5 / 2:3 / 9:16 / 16:9',
    suggestion: matched ? null : '用「多平台尺寸」输出标准比例，避免平台自动裁切'
  });

  const weights: Record<string, number> = {
    sharpness: 30, resolution: 20, exposure: 15, color_cast: 15, completeness: 10, subject_scale: 5, background: 5
  };
  const scoreOf = (status: AiQualityStatus): number => (status === 'pass' ? 1 : status === 'warn' ? 0.5 : 0);
  let weighted = 0;
  let weightSum = 0;
  for (const item of items) {
    const weight = weights[item.key] ?? 0;
    if (weight === 0 || item.status === 'unknown') continue;
    weighted += scoreOf(item.status) * weight;
    weightSum += weight;
  }
  const score = weightSum > 0 ? Math.round((weighted / weightSum) * 100) : 0;
  const overallStatus: AiQualityStatus = items.some(item => item.status === 'fail')
    ? 'fail'
    : items.some(item => item.status === 'warn') ? 'warn' : 'pass';

  const metrics: AiQualityMetrics = {
    laplacianVariance: Math.round(laplacian * 10) / 10,
    shadowClipRatio: Math.round(measured.shadowClipRatio * 10000) / 10000,
    highlightClipRatio: Math.round(measured.highlightClipRatio * 10000) / 10000,
    colorCastA: Math.round(measured.colorCastA * 10) / 10,
    colorCastB: Math.round(measured.colorCastB * 10) / 10,
    subjectCoverage: segmentation.subjectCoverage,
    borderUniformity: segmentation.borderUniformity,
    segmentation: segmentation.reason
  };

  return { ok: overallStatus !== 'fail', width, height, score, overallStatus, items, metrics };
}

export type AiColorSwatch = { hex: string; lab: AiLab; share: number };

export type AiColorOptions = AiSegmentOptions & {
  count?: number;
  /** subject：只统计主体；all：整图（含背景）。 */
  region?: 'subject' | 'all';
};

/**
 * 主色提取：Lab 空间确定性 k-means（farthest-first 初始化，同图同参必然同结果）。
 * 比按 RGB 直方图取峰值更接近人眼判断，能区分「藏青」和「黑」这类相近色。
 */
export async function extractAiDominantColors(
  input: Buffer,
  options: AiColorOptions = {}
): Promise<{ ok: boolean; reason: AiSegmentationReason | null; swatches: AiColorSwatch[] }> {
  const count = options.count ?? 5;
  if (!Number.isInteger(count) || count < 1 || count > 12) {
    throw new AiMediaError('AI_MEDIA_PARAMS_INVALID', 'count');
  }
  const raster = await loadAiRaster(input, options.maxAnalysisSize);
  const labs = pixelsToLab(raster);
  const segmentation = await segmentAiImageSubject(input, options);
  const useSubject = options.region !== 'all' && segmentation.ok && segmentation.alpha !== null;
  const total = raster.width * raster.height;

  const samples: Float32Array[] = [];
  for (let i = 0; i < total; i += 1) {
    if (useSubject && segmentation.alpha && segmentation.alpha[i] <= 128) continue;
    const p = i * 3;
    samples.push(new Float32Array([labs[p], labs[p + 1], labs[p + 2]]));
  }
  if (samples.length < 32) {
    return { ok: false, reason: useSubject ? segmentation.reason : 'subject_not_found', swatches: [] };
  }

  const centroids: Float32Array[] = [];
  let first = samples[0];
  let bestChroma = -1;
  for (const sample of samples) {
    const chroma = sample[1] * sample[1] + sample[2] * sample[2];
    if (chroma > bestChroma) {
      bestChroma = chroma;
      first = sample;
    }
  }
  centroids.push(new Float32Array(first));
  while (centroids.length < Math.min(count, samples.length)) {
    let farthest = samples[0];
    let farthestDistance = -1;
    for (const sample of samples) {
      let nearest = Number.POSITIVE_INFINITY;
      for (const centroid of centroids) {
        const dL = sample[0] - centroid[0];
        const da = sample[1] - centroid[1];
        const db = sample[2] - centroid[2];
        nearest = Math.min(nearest, dL * dL + da * da + db * db);
      }
      if (nearest > farthestDistance) {
        farthestDistance = nearest;
        farthest = sample;
      }
    }
    centroids.push(new Float32Array(farthest));
  }

  const assignment = new Int32Array(samples.length);
  for (let iteration = 0; iteration < 12; iteration += 1) {
    for (let s = 0; s < samples.length; s += 1) {
      let best = 0;
      let bestDistance = Number.POSITIVE_INFINITY;
      for (let c = 0; c < centroids.length; c += 1) {
        const dL = samples[s][0] - centroids[c][0];
        const da = samples[s][1] - centroids[c][1];
        const db = samples[s][2] - centroids[c][2];
        const distance = dL * dL + da * da + db * db;
        if (distance < bestDistance) {
          bestDistance = distance;
          best = c;
        }
      }
      assignment[s] = best;
    }
    const sums = centroids.map(() => [0, 0, 0, 0]);
    for (let s = 0; s < samples.length; s += 1) {
      const bucket = sums[assignment[s]];
      bucket[0] += samples[s][0];
      bucket[1] += samples[s][1];
      bucket[2] += samples[s][2];
      bucket[3] += 1;
    }
    for (let c = 0; c < centroids.length; c += 1) {
      const bucket = sums[c];
      if (bucket[3] === 0) continue;
      centroids[c] = new Float32Array([bucket[0] / bucket[3], bucket[1] / bucket[3], bucket[2] / bucket[3]]);
    }
  }

  const counts = new Array<number>(centroids.length).fill(0);
  for (let s = 0; s < samples.length; s += 1) counts[assignment[s]] += 1;
  const swatches = centroids
    .map((centroid, index) => ({
      hex: toHexColor(labToRgb(centroid[0], centroid[1], centroid[2])),
      lab: { L: centroid[0], a: centroid[1], b: centroid[2] },
      share: samples.length > 0 ? counts[index] / samples.length : 0
    }))
    .filter(swatch => swatch.share > 0.01)
    .sort((a, b) => b.share - a.share);
  return { ok: swatches.length > 0, reason: swatches.length > 0 ? 'ok' : 'subject_not_found', swatches };
}

export type AiPerceptualHash = { dHash: string; aHash: string };

function bitsToHex(bits: number[]): string {
  let hex = '';
  for (let i = 0; i < bits.length; i += 4) {
    let nibble = 0;
    for (let k = 0; k < 4; k += 1) nibble = (nibble << 1) | (bits[i + k] ?? 0);
    hex += nibble.toString(16);
  }
  return hex;
}

/**
 * 感知哈希：dHash（9×8 水平梯度 64bit）+ aHash（8×8 均值 64bit）。
 * 只依赖像素灰度，不调用任何模型，几万张素材可在服务端批量建索引。
 */
export async function computeAiPerceptualHash(input: Buffer): Promise<AiPerceptualHash> {
  if (!Buffer.isBuffer(input) || input.length === 0) throw new AiMediaError('AI_MEDIA_INPUT_INVALID');
  const dRaw = await sharp(input, { failOn: 'error' })
    .greyscale()
    .resize({ width: 9, height: 8, fit: 'fill', kernel: 'lanczos3' })
    .raw()
    .toBuffer();
  const aRaw = await sharp(input, { failOn: 'error' })
    .greyscale()
    .resize({ width: 8, height: 8, fit: 'fill', kernel: 'lanczos3' })
    .raw()
    .toBuffer();

  const dBits: number[] = [];
  for (let y = 0; y < 8; y += 1) {
    for (let x = 0; x < 8; x += 1) {
      dBits.push(dRaw[y * 9 + x] > dRaw[y * 9 + x + 1] ? 1 : 0);
    }
  }
  let sum = 0;
  for (const value of aRaw) sum += value;
  const mean = sum / aRaw.length;
  const aBits: number[] = [];
  for (const value of aRaw) aBits.push(value > mean ? 1 : 0);

  return { dHash: bitsToHex(dBits), aHash: bitsToHex(aBits) };
}

function hexToBits(hex: string): number[] {
  const bits: number[] = [];
  for (const char of hex) {
    const value = parseInt(char, 16);
    for (let k = 3; k >= 0; k -= 1) bits.push((value >> k) & 1);
  }
  return bits;
}

/** 汉明距离越小越像；≤8/128 基本是同一张图的不同导出。 */
export function compareAiPerceptualHash(a: AiPerceptualHash, b: AiPerceptualHash): {
  hammingDistance: number;
  similarity: number;
  duplicate: boolean;
} {
  const bitsA = [...hexToBits(a.dHash), ...hexToBits(a.aHash)];
  const bitsB = [...hexToBits(b.dHash), ...hexToBits(b.aHash)];
  let distance = 0;
  for (let i = 0; i < bitsA.length; i += 1) distance += bitsA[i] === bitsB[i] ? 0 : 1;
  return {
    hammingDistance: distance,
    similarity: Math.round((1 - distance / bitsA.length) * 10000) / 10000,
    duplicate: distance <= 8
  };
}

/**
 * 素材去重：并查集聚合相似图，返回分组。
 * 单批上限 500 张，避免 O(n²) 在接口内失控；大批量走后台任务分批。
 */
export function groupAiDuplicateImages(
  items: Array<{ id: string; hash: AiPerceptualHash }>,
  options: { maxHammingDistance?: number } = {}
): Array<{ ids: string[]; maxDistance: number }> {
  if (items.length > 500) throw new AiMediaError('AI_MEDIA_PARAMS_INVALID', 'items.limit500');
  const threshold = options.maxHammingDistance ?? 8;
  const parent = items.map((_, index) => index);
  const find = (index: number): number => {
    let current = index;
    while (parent[current] !== current) {
      parent[current] = parent[parent[current]];
      current = parent[current];
    }
    return current;
  };
  const union = (a: number, b: number): void => {
    const rootA = find(a);
    const rootB = find(b);
    if (rootA !== rootB) parent[rootB] = rootA;
  };

  const pairDistance = new Map<string, number>();
  for (let i = 0; i < items.length; i += 1) {
    for (let j = i + 1; j < items.length; j += 1) {
      const result = compareAiPerceptualHash(items[i].hash, items[j].hash);
      if (result.hammingDistance <= threshold) {
        union(i, j);
        pairDistance.set(`${i}:${j}`, result.hammingDistance);
      }
    }
  }

  const buckets = new Map<number, number[]>();
  for (let i = 0; i < items.length; i += 1) {
    const root = find(i);
    const bucket = buckets.get(root) ?? [];
    bucket.push(i);
    buckets.set(root, bucket);
  }

  const groups: Array<{ ids: string[]; maxDistance: number }> = [];
  for (const indices of buckets.values()) {
    if (indices.length < 2) continue;
    let maxDistance = 0;
    for (let a = 0; a < indices.length; a += 1) {
      for (let b = a + 1; b < indices.length; b += 1) {
        const forward = pairDistance.get(`${indices[a]}:${indices[b]}`);
        const backward = pairDistance.get(`${indices[b]}:${indices[a]}`);
        maxDistance = Math.max(maxDistance, forward ?? backward ?? 0);
      }
    }
    groups.push({ ids: indices.map(index => items[index].id), maxDistance });
  }
  return groups.sort((a, b) => b.ids.length - a.ids.length);
}



/**
 * 多平台画幅：把同一张商品图重裁到目标比例。
 * 有主体时以主体包围盒为中心（避免把商品裁掉半只袖子），无主体时回退画面中心并如实标注。
 * 只做裁剪与缩放，不补边、不生成，避免用算法伪造不存在的画面。
 */
export type AiReframeAnchor = 'subject' | 'center';

export type AiReframeOptions = AiSegmentOptions & {
  /** '1:1' / '4:5' / '3:4' / '2:3' / '9:16' / '16:9' / '4:3'，默认 '1:1'。 */
  aspect?: string;
  /** 输出宽度上限；原图不够宽时不放大。默认 2048。 */
  width?: number;
  anchor?: AiReframeAnchor;
  format?: 'png' | 'jpeg' | 'webp';
  quality?: number;
};

export type AiReframeResult = {
  ok: boolean;
  reason: AiSegmentationReason;
  buffer: Buffer | null;
  width: number;
  height: number;
  aspect: string;
  /** 实际使用的锚点；请求 subject 但分割失败时会回退 center。 */
  anchorUsed: AiReframeAnchor;
  /** 主体是否被目标画幅切到；true 时建议先走 composeAiProductShot 生成主图。 */
  subjectClipped: boolean;
  crop: AiBox | null;
  bbox: AiBox | null;
};

const AI_ASPECT_PRESETS: Record<string, number> = {
  '1:1': 1,
  '4:5': 4 / 5,
  '3:4': 3 / 4,
  '2:3': 2 / 3,
  '9:16': 9 / 16,
  '16:9': 16 / 9,
  '4:3': 4 / 3
};

/** 解析 'w:h'；非法或超出常用平台比例范围时抛参数错误，不做静默兜底。 */
export function parseAiAspect(value: string): number {
  const raw = value.trim();
  const preset = AI_ASPECT_PRESETS[raw];
  if (preset !== undefined) return preset;
  const matched = /^(\d{1,3}):(\d{1,3})$/.exec(raw);
  if (!matched) throw new AiMediaError('AI_MEDIA_PARAMS_INVALID', 'aspect');
  const w = Number(matched[1]);
  const h = Number(matched[2]);
  if (w <= 0 || h <= 0) throw new AiMediaError('AI_MEDIA_PARAMS_INVALID', 'aspect');
  const ratio = w / h;
  if (ratio < 0.2 || ratio > 5) throw new AiMediaError('AI_MEDIA_PARAMS_INVALID', 'aspect');
  return ratio;
}

export async function reframeAiImageToAspect(
  input: Buffer,
  options: AiReframeOptions = {}
): Promise<AiReframeResult> {
  if (!Buffer.isBuffer(input) || input.length === 0) throw new AiMediaError('AI_MEDIA_INPUT_INVALID');
  const aspect = options.aspect ?? '1:1';
  const ratio = parseAiAspect(aspect);
  const maxWidth = options.width ?? 2048;
  if (!Number.isInteger(maxWidth) || maxWidth < 64 || maxWidth > AI_IMAGE_ENGINE_LIMITS.maxDim) {
    throw new AiMediaError('AI_MEDIA_PARAMS_INVALID', 'width');
  }

  // EXIF 旋转必须先落地，否则 crop 坐标与视觉方向不一致。
  const normalized = await sharp(input, { failOn: 'error' })
    .rotate()
    .png()
    .toBuffer({ resolveWithObject: true });
  const sourceWidth = normalized.info.width;
  const sourceHeight = normalized.info.height;

  const segmentation = await segmentAiImageSubject(input, options);
  const useSubject = (options.anchor ?? 'subject') === 'subject'
    && segmentation.ok
    && segmentation.bbox !== null;

  const sourceRatio = sourceWidth / sourceHeight;
  const cropWidth = sourceRatio > ratio
    ? Math.min(sourceWidth, Math.round(sourceHeight * ratio))
    : sourceWidth;
  const cropHeight = sourceRatio > ratio
    ? sourceHeight
    : Math.min(sourceHeight, Math.round(sourceWidth / ratio));

  const bbox = segmentation.bbox;
  const targetLeft = useSubject && bbox
    ? Math.round(bbox.left + bbox.width / 2 - cropWidth / 2)
    : Math.round((sourceWidth - cropWidth) / 2);
  const targetTop = useSubject && bbox
    ? Math.round(bbox.top + bbox.height / 2 - cropHeight / 2)
    : Math.round((sourceHeight - cropHeight) / 2);
  const left = Math.max(0, Math.min(targetLeft, sourceWidth - cropWidth));
  const top = Math.max(0, Math.min(targetTop, sourceHeight - cropHeight));

  const subjectClipped = useSubject && bbox !== null
    ? bbox.left < left - 1
      || bbox.top < top - 1
      || bbox.left + bbox.width > left + cropWidth + 1
      || bbox.top + bbox.height > top + cropHeight + 1
    : false;

  const outWidth = Math.min(cropWidth, maxWidth);
  const outHeight = Math.max(1, Math.round(outWidth / ratio));
  let pipeline = sharp(normalized.data)
    .extract({ left, top, width: cropWidth, height: cropHeight })
    .resize({ width: outWidth, height: outHeight, fit: 'fill' });
  const format = options.format ?? 'jpeg';
  pipeline = format === 'png'
    ? pipeline.png({ compressionLevel: 9 })
    : format === 'webp'
      ? pipeline.webp({ quality: options.quality ?? 90 })
      : pipeline.jpeg({ quality: options.quality ?? 92, mozjpeg: true });

  return {
    ok: true,
    reason: 'ok',
    buffer: await pipeline.toBuffer(),
    width: outWidth,
    height: outHeight,
    aspect,
    anchorUsed: useSubject ? 'subject' : 'center',
    subjectClipped,
    crop: { left, top, width: cropWidth, height: cropHeight },
    bbox
  };
}
