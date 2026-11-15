import type {
  BatchCaptureAudit,
  CaptureGuidanceProfile,
  ImageAngle,
  PhotoQualityCheckItem,
  QualityCheckStatus,
} from './types';

export interface GuidedCaptureStepSpec {
  stepNumber: number;
  angle: ImageAngle;
  label: string;
  requiredForStandard: boolean;
  priorityLabel: '必采视角' | '推荐补全';
  cameraInstruction: string;
  framingTip: string;
}

export const PRECISION_CAPTURE_STEPS: GuidedCaptureStepSpec[] = [
  {
    stepNumber: 1,
    angle: 'front',
    label: '正面平视',
    requiredForStandard: true,
    priorityLabel: '必采视角',
    cameraInstruction: '镜头正对包身正面中心 90° 垂直平视，距包体约 60–80cm，避免俯拍。',
    framingTip: '包身四周留白约 15%，并在包旁平放标定物（银行卡/A4纸/标定板）作为比例基准。',
  },
  {
    stepNumber: 2,
    angle: 'left',
    label: '左侧面轮廓',
    requiredForStandard: true,
    priorityLabel: '必采视角',
    cameraInstruction: '将包体旋转 90° 拍摄左侧面，保持与正面相同的拍摄高度与漫射光源。',
    framingTip: '必须清晰拍出侧面厚度（角撑宽度）、侧围拼接缝线及底角弧度转折。',
  },
  {
    stepNumber: 3,
    angle: 'bottom',
    label: '底部结构',
    requiredForStandard: true,
    priorityLabel: '必采视角',
    cameraInstruction: '包底朝上平稳摆放，相机正对包底垂直拍摄，确保四角不裁切。',
    framingTip: '用于判断独立底片、一体折底或箱型底角结构，并核对底钉与压线位置。',
  },
  {
    stepNumber: 4,
    angle: 'back',
    label: '背面视图',
    requiredForStandard: false,
    priorityLabel: '推荐补全',
    cameraInstruction: '正对包身背面垂直平视拍摄，露出后幅拉链袋、插袋或翻盖延展位。',
    framingTip: '用于确认后幅是否与翻盖一体裁切，核对背面五金耳仔位置。',
  },
  {
    stepNumber: 5,
    angle: 'right',
    label: '右侧面轮廓',
    requiredForStandard: false,
    priorityLabel: '推荐补全',
    cameraInstruction: '拍摄右侧面并与左侧面保持同焦段与距离，检查左右对称性及单侧五金。',
    framingTip: '可进一步消除单侧透视误差，验证左右侧围一致。',
  },
  {
    stepNumber: 6,
    angle: 'top',
    label: '顶部与包口',
    requiredForStandard: false,
    priorityLabel: '推荐补全',
    cameraInstruction: '从正上方俯拍包口闭合或拉链开口状态，注意提手不要遮挡拉链挡片。',
    framingTip: '清晰展示拉链贴边、磁扣位置、包口弧度及风琴围折边余量。',
  },
  {
    stepNumber: 7,
    angle: 'interior',
    label: '内部里布结构',
    requiredForStandard: false,
    priorityLabel: '推荐补全',
    cameraInstruction: '适度撑开包口并补光拍摄内部，尽量拍清内拉链袋、贴袋与底托硬衬。',
    framingTip: '帮助反向工程引擎确认隐藏里布、内袋数量与折边包边工艺。',
  },
];

export const ANGLE_SHORT_LABEL: Record<ImageAngle, string> = {
  front: '正面',
  back: '背面',
  left: '左侧',
  right: '右侧',
  side: '侧面',
  bottom: '底部',
  top: '顶部',
  interior: '内部',
  detail: '细节',
};

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('图片加载失败'));
    img.src = src;
  });
}

/**
 * Real HTML5 Canvas pixel & geometry analysis for uploaded leather product photos.
 * Computes luminance, highlight/shadow clipping, quadrant uniformity, edge-gradient sharpness,
 * resolution sufficiency, and framing/perspective distortion heuristics.
 */
export async function analyzeSinglePhotoQuality(photo: {
  id: string;
  name: string;
  angle: ImageAngle;
  dataUrl: string;
}): Promise<PhotoQualityCheckItem> {
  if (typeof document === 'undefined' || typeof Image === 'undefined') {
    return {
      photoId: photo.id,
      name: photo.name,
      angle: photo.angle,
      widthPx: 1000,
      heightPx: 750,
      lightingScore: 80,
      lightingStatus: 'pass',
      lightingDetail: '服务端/无画布环境默认记录',
      meanLuminance: 135,
      uniformityPct: 85,
      distortionScore: 80,
      distortionStatus: 'pass',
      distortionRisk: 'low',
      distortionDetail: '标准比例',
      sharpnessScore: 78,
      rgbCentroid: [140, 132, 124],
    };
  }

  try {
    const img = await loadImageElement(photo.dataUrl);
    const widthPx = img.naturalWidth || img.width || 0;
    const heightPx = img.naturalHeight || img.height || 0;
    const maxSample = 192;
    const scale = Math.min(1, maxSample / Math.max(widthPx, heightPx, 1));
    const sw = Math.max(16, Math.round(widthPx * scale));
    const sh = Math.max(16, Math.round(heightPx * scale));

    const canvas = document.createElement('canvas');
    canvas.width = sw;
    canvas.height = sh;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('无法初始化 Canvas 2D 上下文');

    ctx.drawImage(img, 0, 0, sw, sh);
    const { data } = ctx.getImageData(0, 0, sw, sh);

    const totalPixels = sw * sh;
    const lum = new Float32Array(totalPixels);
    let sumLum = 0;
    let sumR = 0;
    let sumG = 0;
    let sumB = 0;
    let darkClip = 0;
    let brightClip = 0;

    // Quadrant luminance sums for uniformity check
    const quadSum = [0, 0, 0, 0];
    const quadCnt = [0, 0, 0, 0];
    const halfW = sw >> 1;
    const halfH = sh >> 1;

    for (let y = 0; y < sh; y++) {
      for (let x = 0; x < sw; x++) {
        const idx = y * sw + x;
        const p = idx * 4;
        const r = data[p];
        const g = data[p + 1];
        const b = data[p + 2];
        const yVal = 0.299 * r + 0.587 * g + 0.114 * b;
        lum[idx] = yVal;
        sumLum += yVal;
        sumR += r;
        sumG += g;
        sumB += b;
        if (yVal < 18) darkClip++;
        if (yVal > 246) brightClip++;

        const q = (y >= halfH ? 2 : 0) + (x >= halfW ? 1 : 0);
        quadSum[q] += yVal;
        quadCnt[q]++;
      }
    }

    const meanLuminance = Math.round(sumLum / totalPixels);
    const shadowClipPct = (darkClip / totalPixels) * 100;
    const highlightClipPct = (brightClip / totalPixels) * 100;

    const quadMeans = quadSum.map((s, i) => (quadCnt[i] > 0 ? s / quadCnt[i] : meanLuminance));
    const maxQuadDiff = Math.max(...quadMeans) - Math.min(...quadMeans);
    const uniformityPct = Math.round(clamp(100 - maxQuadDiff * 0.65, 25, 99));

    // Lighting Score & Verdict
    let lightingScore = 95;
    const lightingIssues: string[] = [];
    if (meanLuminance < 60) {
      lightingScore -= 38;
      lightingIssues.push(`整体偏暗(亮度 ${meanLuminance})`);
    } else if (meanLuminance < 85) {
      lightingScore -= 16;
      lightingIssues.push(`光线略暗(亮度 ${meanLuminance})`);
    } else if (meanLuminance > 225) {
      lightingScore -= 34;
      lightingIssues.push(`整体过曝(亮度 ${meanLuminance})`);
    } else if (meanLuminance > 205) {
      lightingScore -= 14;
      lightingIssues.push('亮度偏高');
    }

    if (highlightClipPct > 18 && meanLuminance > 150) {
      lightingScore -= 14;
      lightingIssues.push(`局部强反光(${highlightClipPct.toFixed(0)}%)`);
    }
    if (shadowClipPct > 28) {
      lightingScore -= 16;
      lightingIssues.push(`死黑阴影区(${shadowClipPct.toFixed(0)}%)`);
    }
    if (uniformityPct < 65) {
      lightingScore -= 18;
      lightingIssues.push(`受光不均(均匀度 ${uniformityPct}%)`);
    } else if (uniformityPct < 78) {
      lightingScore -= 8;
      lightingIssues.push(`轻微阴影差(均匀度 ${uniformityPct}%)`);
    }

    lightingScore = Math.round(clamp(lightingScore, 20, 99));
    const lightingStatus: QualityCheckStatus =
      lightingScore >= 75 ? 'pass' : lightingScore >= 55 ? 'warn' : 'fail';
    const lightingDetail =
      lightingIssues.length === 0
        ? `光照均匀 (亮度 ${meanLuminance} · 均匀度 ${uniformityPct}%)`
        : lightingIssues.join('，');

    // Sharpness via Sobel / gradient energy
    let gradSum = 0;
    let gradCount = 0;
    for (let y = 1; y < sh - 1; y++) {
      for (let x = 1; x < sw - 1; x++) {
        const idx = y * sw + x;
        const gx = Math.abs(lum[idx + 1] - lum[idx - 1]);
        const gy = Math.abs(lum[idx + sw] - lum[idx - sw]);
        gradSum += gx + gy;
        gradCount++;
      }
    }
    const avgGrad = gradCount > 0 ? gradSum / gradCount : 0;
    const sharpnessScore = Math.round(clamp((avgGrad / 26) * 100, 15, 99));

    // Resolution & Framing Aspect Ratio Distortion Heuristics
    const minDim = Math.min(widthPx, heightPx);
    const maxDim = Math.max(widthPx, heightPx);
    const aspectRatio = maxDim / Math.max(1, minDim);

    let distortionScore = 95;
    const distortionIssues: string[] = [];

    if (minDim < 360) {
      distortionScore -= 38;
      distortionIssues.push(`分辨率过低 (${widthPx}×${heightPx})`);
    } else if (minDim < 600) {
      distortionScore -= 16;
      distortionIssues.push(`分辨率偏低 (${widthPx}×${heightPx})`);
    }

    if (sharpnessScore < 35) {
      distortionScore -= 30;
      distortionIssues.push('边缘模糊/疑似手抖失焦');
    } else if (sharpnessScore < 55) {
      distortionScore -= 12;
      distortionIssues.push('边缘清晰度一般');
    }

    if (aspectRatio > 2.35) {
      distortionScore -= 22;
      distortionIssues.push(`画幅拉伸极端 (${aspectRatio.toFixed(1)}:1)`);
    } else if (aspectRatio > 1.95) {
      distortionScore -= 8;
      distortionIssues.push('构图长宽比较偏斜');
    }

    // Check if bag subject touches image boundaries (possible perspective cropping)
    let borderEdgeSum = 0;
    let borderCnt = 0;
    for (let x = 2; x < sw - 2; x++) {
      borderEdgeSum += Math.abs(lum[x + sw] - lum[x]);
      borderEdgeSum += Math.abs(lum[(sh - 2) * sw + x] - lum[(sh - 1) * sw + x]);
      borderCnt += 2;
    }
    const borderActivity = borderCnt > 0 ? borderEdgeSum / borderCnt : 0;
    if (borderActivity > 22) {
      distortionScore -= 10;
      distortionIssues.push('主体贴近边缘，存在边缘广角拉伸风险');
    }

    distortionScore = Math.round(clamp(distortionScore, 20, 99));
    const distortionStatus: QualityCheckStatus =
      distortionScore >= 75 ? 'pass' : distortionScore >= 55 ? 'warn' : 'fail';
    const distortionRisk: 'low' | 'medium' | 'high' =
      distortionScore >= 78 ? 'low' : distortionScore >= 58 ? 'medium' : 'high';
    const distortionDetail =
      distortionIssues.length === 0
        ? `${widthPx}×${heightPx} · 清晰度 ${sharpnessScore} · 畸变风险低`
        : `${widthPx}×${heightPx} · ${distortionIssues.join('，')}`;

    return {
      photoId: photo.id,
      name: photo.name,
      angle: photo.angle,
      widthPx,
      heightPx,
      lightingScore,
      lightingStatus,
      lightingDetail,
      meanLuminance,
      uniformityPct,
      distortionScore,
      distortionStatus,
      distortionRisk,
      distortionDetail,
      sharpnessScore,
      rgbCentroid: [
        Math.round(sumR / totalPixels),
        Math.round(sumG / totalPixels),
        Math.round(sumB / totalPixels),
      ],
    };
  } catch {
    return {
      photoId: photo.id,
      name: photo.name,
      angle: photo.angle,
      widthPx: 0,
      heightPx: 0,
      lightingScore: 50,
      lightingStatus: 'warn',
      lightingDetail: '无法读取图片像素（请确认本地图片格式）',
      meanLuminance: 128,
      uniformityPct: 70,
      distortionScore: 50,
      distortionStatus: 'warn',
      distortionRisk: 'medium',
      distortionDetail: '无法解析分辨率与清晰度',
      sharpnessScore: 50,
      rgbCentroid: [128, 128, 128],
    };
  }
}

/**
 * Evaluates multi-angle coverage, cross-photo RGB/lighting consistency,
 * resolution alignment, and standard pattern generation readiness gate.
 */
export function evaluateMultiAngleBatch(
  perPhoto: PhotoQualityCheckItem[],
  referenceObjectType: CaptureGuidanceProfile['referenceObjectType'] = 'none'
): BatchCaptureAudit {
  const checkedAt = new Date().toISOString();
  const angles = new Set(perPhoto.map((p) => p.angle));

  const missingCoreAngles: ImageAngle[] = [];
  if (!angles.has('front')) missingCoreAngles.push('front');
  if (!angles.has('left') && !angles.has('right') && !angles.has('side')) {
    missingCoreAngles.push('left');
  }
  if (!angles.has('bottom')) missingCoreAngles.push('bottom');

  const recommendedList: ImageAngle[] = [
    'front',
    'back',
    'left',
    'right',
    'bottom',
    'top',
    'interior',
  ];
  const missingRecommendedAngles = recommendedList.filter(
    (a) =>
      !angles.has(a) &&
      !((a === 'left' || a === 'right') && angles.has('side'))
  );

  if (perPhoto.length === 0) {
    return {
      photoCount: 0,
      lightingScore: 0,
      lightingStatus: 'fail',
      distortionScore: 0,
      distortionStatus: 'fail',
      multiAngleMatchPct: 0,
      multiAngleStatus: 'fail',
      colorConsistencyPct: 0,
      resolutionConsistencyPct: 0,
      missingCoreAngles,
      missingRecommendedAngles,
      meetsStandardPatternRequirements: false,
      readinessSummary: '请按引导上传至少 正面 + 侧面 + 底部 照片以启动精准质量检测。',
      blockingReasons: ['尚未上传产品照片'],
      warnings: [],
      estimatedErrorMm: 12.0,
      checkedAt,
    };
  }

  const lightingScore = Math.round(
    perPhoto.reduce((acc, p) => acc + p.lightingScore, 0) / perPhoto.length
  );
  const distortionScore = Math.round(
    perPhoto.reduce((acc, p) => acc + p.distortionScore, 0) / perPhoto.length
  );

  // Cross-view color / lighting consistency
  let colorConsistencyPct = 100;
  let resolutionConsistencyPct = 100;

  if (perPhoto.length >= 2) {
    const avgRgb: [number, number, number] = [0, 0, 0];
    for (const p of perPhoto) {
      avgRgb[0] += p.rgbCentroid[0];
      avgRgb[1] += p.rgbCentroid[1];
      avgRgb[2] += p.rgbCentroid[2];
    }
    avgRgb[0] /= perPhoto.length;
    avgRgb[1] /= perPhoto.length;
    avgRgb[2] /= perPhoto.length;

    let maxDist = 0;
    for (const p of perPhoto) {
      const dist = Math.sqrt(
        (p.rgbCentroid[0] - avgRgb[0]) ** 2 +
          (p.rgbCentroid[1] - avgRgb[1]) ** 2 +
          (p.rgbCentroid[2] - avgRgb[2]) ** 2
      );
      if (dist > maxDist) maxDist = dist;
    }
    // Euclidean RGB distance 0..441; > 110 indicates very different lighting/background/bag
    colorConsistencyPct = Math.round(clamp(100 - maxDist * 0.48, 30, 99));

    const minResList = perPhoto.map((p) => Math.min(p.widthPx, p.heightPx)).filter((v) => v > 0);
    if (minResList.length >= 2) {
      const ratio = Math.min(...minResList) / Math.max(...minResList);
      resolutionConsistencyPct = Math.round(clamp(ratio * 100, 40, 99));
    }
  } else {
    colorConsistencyPct = 60;
    resolutionConsistencyPct = 65;
  }

  const coreCoverageRatio = (3 - missingCoreAngles.length) / 3;
  const fullCoverageBonus = ((7 - missingRecommendedAngles.length) / 7) * 15;
  const multiAngleMatchPct =
    perPhoto.length === 1
      ? Math.round(coreCoverageRatio * 42)
      : Math.round(
          clamp(
            coreCoverageRatio * 45 +
              colorConsistencyPct * 0.25 +
              resolutionConsistencyPct * 0.15 +
              fullCoverageBonus,
            20,
            99
          )
        );

  const hasRef = Boolean(referenceObjectType && referenceObjectType !== 'none');
  const lightingStatus: QualityCheckStatus =
    lightingScore >= 75 ? 'pass' : lightingScore >= 55 ? 'warn' : 'fail';
  const distortionStatus: QualityCheckStatus =
    distortionScore >= 75 ? 'pass' : distortionScore >= 55 ? 'warn' : 'fail';
  const multiAngleStatus: QualityCheckStatus =
    missingCoreAngles.length === 0 && multiAngleMatchPct >= 75
      ? 'pass'
      : perPhoto.length >= 2 && multiAngleMatchPct >= 55
        ? 'warn'
        : 'fail';

  const blockingReasons: string[] = [];
  const warnings: string[] = [];

  if (missingCoreAngles.length > 0) {
    blockingReasons.push(
      `缺少核心必采视角：${missingCoreAngles.map((a) => ANGLE_SHORT_LABEL[a]).join('、')}`
    );
  }
  if (!hasRef) {
    warnings.push('尚未选择实物参考标定物，建议勾选银行卡/A4纸或标定板以消除透视误差');
  }
  if (lightingStatus === 'fail') {
    blockingReasons.push(`光照质量不达标 (${lightingScore}/100)，请补光或避免强反光后重拍`);
  } else if (lightingStatus === 'warn') {
    warnings.push(`部分照片光照或均匀度偏低 (${lightingScore}/100)`);
  }
  if (distortionStatus === 'fail') {
    blockingReasons.push(`分辨率/清晰度或畸变不达标 (${distortionScore}/100)，请垂直平视重拍`);
  } else if (distortionStatus === 'warn') {
    warnings.push(`存在轻微畸变或清晰度波动 (${distortionScore}/100)`);
  }
  if (perPhoto.length >= 2 && colorConsistencyPct < 65) {
    warnings.push(`各角度照片光线/色温差异较大 (色彩一致性 ${colorConsistencyPct}%)，建议同环境连续拍摄`);
  }
  if (missingRecommendedAngles.length > 0 && missingCoreAngles.length === 0) {
    warnings.push(
      `可进一步补拍 ${missingRecommendedAngles.map((a) => ANGLE_SHORT_LABEL[a]).join('、')} 提升内部结构还原度`
    );
  }

  const meetsStandardPatternRequirements =
    blockingReasons.length === 0 &&
    lightingScore >= 68 &&
    distortionScore >= 68 &&
    multiAngleMatchPct >= 72;

  const estimatedErrorMm =
    hasRef && meetsStandardPatternRequirements && missingRecommendedAngles.length <= 2
      ? 1.2
      : hasRef && missingCoreAngles.length === 0
        ? 1.8
        : hasRef || perPhoto.length >= 3
          ? 3.8
          : perPhoto.length === 2
            ? 6.5
            : 12.0;

  const readinessSummary = meetsStandardPatternRequirements
    ? `多视角采集达标（光照 ${lightingScore} · 畸变 ${distortionScore} · 匹配度 ${multiAngleMatchPct}%），满足标准版型生成要求`
    : blockingReasons.length > 0
      ? `暂未满足标准版型要求：${blockingReasons.join('；')}`
      : `接近标准版型要求，建议优化提示项后启动打版`;

  return {
    photoCount: perPhoto.length,
    lightingScore,
    lightingStatus,
    distortionScore,
    distortionStatus,
    multiAngleMatchPct,
    multiAngleStatus,
    colorConsistencyPct,
    resolutionConsistencyPct,
    missingCoreAngles,
    missingRecommendedAngles,
    meetsStandardPatternRequirements,
    readinessSummary,
    blockingReasons,
    warnings,
    estimatedErrorMm,
    checkedAt,
  };
}
