/**
 * 图片引擎真实商品图基准测试（P1 验收工具）。
 *
 * 用法：
 *   npx tsx scripts/ai-image-quality-benchmark.ts <图片目录> [--out report.json]
 *
 * 说明（docs/engineering/modules/modaui-ai-advertising.md §22.6）：
 * - 只做真实像素处理，不调用任何供应商；失败就是失败，不把不可处理图判成成功。
 * - 输出 JSON 记录每张图的分割原因、背景一致性、主体占比、白底图结果与质检明细，
 *   用于确定「哪些商品能自动处理、哪些必须人工抠图」的适用边界。
 * - 结论只是算法可处理性，不等于视觉验收通过；外观是否可发布仍需人工看图。
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import {
  assessAiImageQuality,
  composeAiProductShot,
  segmentAiImageSubject
} from '../src/server/aiImageEngine';

type ImageReport = {
  file: string;
  bytes: number;
  quality: {
    status: string;
    score: number;
    width: number;
    height: number;
    items: Array<{ key: string; status: string; measured: number | string | null }>;
  } | null;
  segmentation: {
    ok: boolean;
    reason: string;
    subjectCoverage: number;
    borderUniformity: number;
    borderDeltaE: number;
    borderColor: string;
  } | null;
  productShot: {
    ok: boolean;
    reason: string;
    subjectFillRatio: number;
    width: number;
    height: number;
  } | null;
  error: string | null;
};

const IMAGE_EXTENSIONS = /\.(jpe?g|png|webp|avif)$/i;

async function main() {
  const args = process.argv.slice(2);
  const dir = args.find(arg => !arg.startsWith('--'));
  const outIndex = args.findIndex(arg => arg === '--out');
  const outPath = outIndex >= 0 ? args[outIndex + 1] : null;
  if (!dir) {
    console.error('usage: npx tsx scripts/ai-image-quality-benchmark.ts <image-dir> [--out report.json]');
    process.exit(2);
  }

  const entries = (await fs.readdir(dir)).filter(name => IMAGE_EXTENSIONS.test(name)).sort();
  if (entries.length === 0) {
    console.error(`no images found in ${dir}`);
    process.exit(2);
  }

  const reports: ImageReport[] = [];
  for (const name of entries) {
    const filePath = path.join(dir, name);
    const buffer = await fs.readFile(filePath);
    const report: ImageReport = {
      file: name,
      bytes: buffer.length,
      quality: null,
      segmentation: null,
      productShot: null,
      error: null
    };
    try {
      const quality = await assessAiImageQuality(buffer);
      report.quality = {
        status: quality.overallStatus,
        score: quality.score,
        width: quality.width,
        height: quality.height,
        items: quality.items.map(item => ({ key: item.key, status: item.status, measured: item.measured }))
      };
    } catch (error) {
      report.error = error instanceof Error ? error.message : 'QUALITY_FAILED';
    }
    try {
      const segmentation = await segmentAiImageSubject(buffer);
      report.segmentation = {
        ok: segmentation.ok,
        reason: segmentation.reason,
        subjectCoverage: Number(segmentation.subjectCoverage.toFixed(4)),
        borderUniformity: Number(segmentation.borderUniformity.toFixed(4)),
        borderDeltaE: Number(segmentation.borderDeltaE.toFixed(2)),
        borderColor: segmentation.borderColor
      };
    } catch (error) {
      report.error = report.error ?? (error instanceof Error ? error.message : 'SEGMENT_FAILED');
    }
    try {
      const shot = await composeAiProductShot(buffer, { format: 'png' });
      report.productShot = {
        ok: shot.ok,
        reason: shot.reason,
        subjectFillRatio: Number(shot.subjectFillRatio.toFixed(4)),
        width: shot.width,
        height: shot.height
      };
    } catch (error) {
      report.error = report.error ?? (error instanceof Error ? error.message : 'PRODUCT_SHOT_FAILED');
    }
    reports.push(report);
    const status = report.segmentation?.reason ?? report.error ?? 'unknown';
    console.log(`${name}\t${status}\t${report.productShot?.ok ? 'packshot-ok' : 'packshot-skip'}\tquality=${report.quality?.status ?? 'n/a'}`);
  }

  const summary = {
    total: reports.length,
    segmentationOk: reports.filter(item => item.segmentation?.ok).length,
    backgroundNotUniform: reports.filter(item => item.segmentation?.reason === 'background_not_uniform').length,
    subjectNotFound: reports.filter(item => item.segmentation?.reason === 'subject_not_found').length,
    subjectFillsFrame: reports.filter(item => item.segmentation?.reason === 'subject_fills_frame').length,
    qualityFail: reports.filter(item => item.quality?.status === 'fail').length,
    qualityUnknown: reports.filter(item => item.quality?.items.some(entry => entry.status === 'unknown')).length,
    errors: reports.filter(item => item.error).length
  };

  const payload = {
    generatedAt: new Date().toISOString(),
    engine: 'deterministic-sharp',
    inputDir: path.resolve(dir),
    disclaimer: '算法可处理性报告，不代表视觉验收通过；失败图片必须人工处理，不得强判为成功。',
    summary,
    reports
  };
  if (outPath) {
    await fs.mkdir(path.dirname(path.resolve(outPath)), { recursive: true });
    await fs.writeFile(outPath, JSON.stringify(payload, null, 2), 'utf8');
    console.log(`report: ${outPath}`);
  }
  console.log(JSON.stringify(summary));
}

void main().catch(error => {
  console.error(error instanceof Error ? error.message : 'BENCHMARK_FAILED');
  process.exit(1);
});
