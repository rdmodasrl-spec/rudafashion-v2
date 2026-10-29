/**
 * ModaUI 数字生命的 GLSL ES 3.00 着色器（神经生命体）。
 *
 * 规范见 docs/engineering/modules/modaui-core.md 第 0 节与第 16 节：纯白背景、
 * 零依赖、只有细胞 / 神经纤维 / 脉冲 / 内部尘埃，没有头像与五官。
 *
 * 两个程序：
 * 1. 精灵程序（细胞与尘埃）：`uSprite = 0` 细胞（逐像素球面着色：中心浅、边缘近黑、
 *    右上角浅灰高光），`uSprite = 1` 内部尘埃（柔和中灰点）。
 * 2. 纤维程序（神经纤维与脉冲）：同一份顶点缓冲画两遍 —— `uFiberPass = 0` 用
 *    `gl.LINES` 连接两端细胞，`uFiberPass = 1` 用 `gl.POINTS` 沿纤维移动脉冲。
 *    脉冲通道用 stride 只取每条边的第一个顶点，因此不需要第二份几何数据。
 *
 * `lifeformPoint()` 必须与 neuralLifeform.ts 的 `animateNeuralCell()` 逐项一致，
 * 否则纤维端点会脱离细胞。所有坐标均由 GPU 现算，没有任何贴图采样。
 */

export const MODA_CORE_SPRITE_VERTEX_SHADER = `#version 300 es
precision highp float;

layout(location = 0) in vec3 aBase;
layout(location = 1) in vec4 aSeed;
layout(location = 2) in float aSize;
layout(location = 3) in float aTone;

uniform mat4 uProjection;
uniform float uTime;
uniform float uLevel;
uniform float uPulse;
uniform float uState[6];
uniform float uPointScale;
/** 画布 CSS 高度：给 32px 对话内小核心补偿点尺寸。 */
uniform float uCoreHeight;
uniform vec2 uPointer;
uniform float uGaze;
// 数字生命实时通道（真实输入/请求/文本片段驱动，见 modaCoreLife.ts）：
// x 聚拢、y 前移、z 定向流动、w 片段脉冲；uEnergy 为整体运动能量。
uniform vec4 uLife;
uniform float uEnergy;
/** 点击冲击 0–1，指数衰减。 */
uniform float uBurst;
/** 0 = 细胞，1 = 内部尘埃。 */
uniform float uSprite;
// 主体运动（modaBrainBehavior.ts 每帧输出）：x/y 空间位移、z 前后深度、w 自身尺寸倍率。
uniform vec4 uBody;
/** 主体三维倾斜（绕 x/y/z 轴）。 */
uniform vec3 uBodyTilt;
// 内部动态（同一控制器输出，见文档 §18.4）：x 激活、y 聚合、z 外传、w 自主脉冲。
uniform vec4 uCognition;

out float vAlpha;

mat3 rotateX(float a) {
  float c = cos(a);
  float s = sin(a);
  return mat3(1.0, 0.0, 0.0, 0.0, c, s, 0.0, -s, c);
}

mat3 rotateY(float a) {
  float c = cos(a);
  float s = sin(a);
  return mat3(c, 0.0, -s, 0.0, 1.0, 0.0, s, 0.0, c);
}

mat3 rotateZ(float a) {
  float c = cos(a);
  float s = sin(a);
  return mat3(c, s, 0.0, -s, c, 0.0, 0.0, 0.0, 1.0);
}

/**
 * 主体级变换：先按自身尺寸缩放，再做三维倾斜，最后做空间位移。
 * 内部形变（呼吸、旋转、聚拢、流动）已由 lifeformPoint() 完成，两者串行叠加、互不覆盖。
 */
vec3 bodyTransform(vec3 p) {
  vec3 q = p * uBody.w;
  q = rotateZ(uBodyTilt.z) * q;
  q = rotateX(uBodyTilt.x) * q;
  q = rotateY(uBodyTilt.y) * q;
  return q + vec3(uBody.x, uBody.y, 0.0);
}

/** 细胞（与尘埃）位置的唯一算法：系数必须与 neuralLifeform.ts 完全相同。 */
vec3 lifeformPoint(vec3 base, float phase) {
  float thinking = uState[2];
  float success = uState[4];
  float error = uState[5];
  float energy = clamp(uEnergy, 0.0, 1.0);
  // 思考与真实输入聚拢合成同一个收缩量，避免两套重合的收缩逻辑。
  float contraction = clamp(thinking + clamp(uLife.x, 0.0, 1.0) * 0.6, 0.0, 1.6);

  // 整体呼吸 + 细胞级独立起伏。
  float breath = 1.0 + 0.045 * sin(uTime * 1.15) + 0.020 * sin(uTime * 0.47);
  float wave = 0.030 * sin(uTime * 1.25 + phase) + 0.020 * sin(uTime * 0.63 + phase * 1.7);
  float scale = breath + wave + energy * 0.03 + uBurst * 0.09 - contraction * 0.12 + success * 0.05 - error * 0.05;

  float radius = max(0.0001, length(base));
  vec3 p = base * scale;

  // 差速旋转：外层转得快、内层转得慢，细胞之间持续发生相对位移。
  float swirl = (0.16 + 0.10 * radius) * sin(uTime * 0.37);
  p.xz = mat2(cos(swirl), sin(swirl), -sin(swirl), cos(swirl)) * p.xz;

  vec3 n = base / radius;

  // 聆听：真实麦克风 RMS 驱动由内向外扩散的波纹。
  p += n * uState[1] * (0.012 + uLevel * 0.07) * (0.5 + 0.5 * sin(uTime * 3.1 - radius * 6.0 + phase));
  // 回答：真实语音 boundary 脉冲驱动有节律鼓起。
  p += n * uState[3] * uPulse * 0.03 * (0.5 + 0.5 * sin(uTime * 9.0 + phase * 2.0));

  // 指针局部鼓起：朝向指针一侧的细胞沿法线外扩，而不是整团刚性旋转。
  vec3 pointerDir = normalize(vec3(uPointer * uGaze, 0.55));
  float bulge = max(0.0, dot(n, pointerDir)) * 0.032 * (1.0 - min(1.0, contraction) * 0.5);
  p += n * bulge;

  // 姿态视差：Rx(pitch) · Ry(yaw)，与 animateNeuralCell() 的矩阵顺序一致。
  float yaw = uPointer.x * uGaze * 0.46 + 0.05 * sin(uTime * 0.23);
  float pitch = -uPointer.y * uGaze * 0.26 - 0.02 + 0.02 * sin(uTime * 0.31);
  return rotateX(pitch) * rotateY(yaw) * p;
}

void main() {
  float phase = aSeed.x * 6.2831853;
  vec3 p = lifeformPoint(aBase, phase);

  // 内部尘埃只做额外漂浮，不参与纤维与脉冲。
  if (uSprite > 0.5) {
    p += vec3(
      sin(uTime * 0.61 + phase * 2.0),
      sin(uTime * 0.47 + phase),
      cos(uTime * 0.53 + phase * 1.4)
    ) * 0.03;
  }

  // 行为控制器的内部动态：聚合把细胞向核心收拢，自主脉冲给一次轻微鼓起。
  // 这两项只作用于主体内部结构，不改变主体位移与布局（P4 的解耦要求）。
  p *= 1.0 - 0.055 * uCognition.y;
  p *= 1.0 + 0.016 * uCognition.w;

  vec4 viewPos = vec4(bodyTransform(p), 1.0);
  viewPos.z -= 3.55;
  // 主体前后移动：由行为控制器给出的有界深度（不再是无界直推）。
  viewPos.z += uBody.z;
  gl_Position = uProjection * viewPos;

  float sizeScale = uPointScale / max(0.4, -viewPos.z);
  // 对话内 32px 小核心：点精灵在屏幕上只剩 1px，会淡到看不见。
  // 按画布高度等比放大点尺寸；≥120px 的大核心完全不受影响（smallBoost = 1）。
  float smallBoost = clamp(120.0 / max(1.0, uCoreHeight), 1.0, 3.2);
  // 神经激活：细胞点尺寸出现轻微、各自相位的搏动，而不是整团一起缩放。
  float activation = 1.0 + 0.10 * uCognition.x * (0.6 + 0.4 * sin(uTime * 3.1 + aSeed.x * 6.2831853));
  float pointSize = aSize * sizeScale * smallBoost * (0.92 + 0.16 * aSeed.y) * activation;
  gl_PointSize = clamp(pointSize, 1.0, 40.0);

  float depthFade = 0.55 + 0.45 * smoothstep(-1.6, 0.6, viewPos.z);
  float flicker = 0.86 + 0.14 * sin(uTime * (0.9 + aSeed.y * 1.3) + phase * 1.7);
  vAlpha = clamp(
    aTone * flicker * depthFade
      * (1.0 + 0.10 * uEnergy + 0.18 * uBurst)
      * (1.0 + 0.10 * uState[4]) * (1.0 - 0.12 * uState[5])
      * (1.0 + 0.10 * uCognition.x + 0.08 * uCognition.w),
    0.05,
    0.96
  );
}
`;

export const MODA_CORE_SPRITE_FRAGMENT_SHADER = `#version 300 es
precision highp float;

in float vAlpha;

uniform vec3 uColor;
uniform vec3 uErrorColor;
uniform float uErrorMix;
/** 浅灰阶：白底上禁止用纯白，否则会在墨点上打出白洞。 */
uniform vec3 uHighlight;
/** 0 = 细胞，1 = 内部尘埃。 */
uniform float uSprite;

out vec4 fragColor;

void main() {
  vec2 delta = gl_PointCoord * 2.0 - 1.0;
  float dist = length(delta);
  if (dist > 1.0) discard;

  vec3 ink = mix(uColor, uErrorColor, uErrorMix);

  if (uSprite < 0.5) {
    // 细胞：逐像素球面着色。中心半透明浅灰、边缘近黑轮廓、右上角浅灰高光，
    // 远看是半透明玻璃球，近看每个细胞都有独立的立体感。
    float z = sqrt(max(0.0, 1.0 - dist * dist));
    vec3 normal = vec3(delta.x, -delta.y, z);
    float rim = pow(1.0 - z, 1.5);
    float core = 1.0 - smoothstep(0.0, 0.72, dist);
    float specular = pow(max(dot(normal, normalize(vec3(0.42, 0.50, 0.76))), 0.0), 24.0);
    float alpha = clamp(vAlpha * (0.10 + 0.55 * rim + 0.22 * core) + specular * 0.35, 0.0, 0.92);
    vec3 color = mix(ink, uHighlight, clamp(core * 0.55 + specular * 1.2, 0.0, 1.0));
    fragColor = vec4(color * alpha, alpha);
  } else {
    // 内部尘埃：柔和中灰点，提供纵深但不抢结构。
    float alpha = pow(1.0 - smoothstep(0.0, 1.0, dist), 1.8) * vAlpha;
    fragColor = vec4(ink * alpha, alpha);
  }
}
`;

export const MODA_CORE_FIBER_VERTEX_SHADER = `#version 300 es
precision highp float;

layout(location = 0) in vec3 aBaseA;
layout(location = 1) in vec4 aSeedA;
layout(location = 2) in vec3 aBaseB;
layout(location = 3) in vec4 aSeedB;
layout(location = 4) in float aPhase;
layout(location = 5) in float aTone;

uniform mat4 uProjection;
uniform float uTime;
uniform float uLevel;
uniform float uPulse;
uniform float uState[6];
uniform float uPointScale;
uniform float uCoreHeight;
uniform vec2 uPointer;
uniform float uGaze;
uniform vec4 uLife;
uniform float uEnergy;
uniform float uBurst;
/** 纤维基准浓度：随真实活动与点击冲击增亮。 */
uniform float uFiberAlpha;
/** 0 = 纤维线，1 = 沿纤维移动的脉冲。 */
uniform float uFiberPass;
// 主体运动与精灵程序同源：纤维与脉冲必须跟着主体一起平移、倾斜、缩放。
uniform vec4 uBody;
uniform vec3 uBodyTilt;
/** 内部动态与精灵程序同源：激活 / 聚合 / 外传 / 自主脉冲。 */
uniform vec4 uCognition;

out float vAlpha;

mat3 rotateX(float a) {
  float c = cos(a);
  float s = sin(a);
  return mat3(1.0, 0.0, 0.0, 0.0, c, s, 0.0, -s, c);
}

mat3 rotateY(float a) {
  float c = cos(a);
  float s = sin(a);
  return mat3(c, 0.0, -s, 0.0, 1.0, 0.0, s, 0.0, c);
}

mat3 rotateZ(float a) {
  float c = cos(a);
  float s = sin(a);
  return mat3(c, s, 0.0, -s, c, 0.0, 0.0, 0.0, 1.0);
}

/** 与精灵程序完全一致的主体级变换。 */
vec3 bodyTransform(vec3 p) {
  vec3 q = p * uBody.w;
  q = rotateZ(uBodyTilt.z) * q;
  q = rotateX(uBodyTilt.x) * q;
  q = rotateY(uBodyTilt.y) * q;
  return q + vec3(uBody.x, uBody.y, 0.0);
}

/** 与精灵程序、neuralLifeform.ts 完全同一套细胞位置算法。 */
vec3 lifeformPoint(vec3 base, float phase) {
  float thinking = uState[2];
  float success = uState[4];
  float error = uState[5];
  float energy = clamp(uEnergy, 0.0, 1.0);
  float contraction = clamp(thinking + clamp(uLife.x, 0.0, 1.0) * 0.6, 0.0, 1.6);

  float breath = 1.0 + 0.045 * sin(uTime * 1.15) + 0.020 * sin(uTime * 0.47);
  float wave = 0.030 * sin(uTime * 1.25 + phase) + 0.020 * sin(uTime * 0.63 + phase * 1.7);
  float scale = breath + wave + energy * 0.03 + uBurst * 0.09 - contraction * 0.12 + success * 0.05 - error * 0.05;

  float radius = max(0.0001, length(base));
  vec3 p = base * scale;

  float swirl = (0.16 + 0.10 * radius) * sin(uTime * 0.37);
  p.xz = mat2(cos(swirl), sin(swirl), -sin(swirl), cos(swirl)) * p.xz;

  vec3 n = base / radius;
  p += n * uState[1] * (0.012 + uLevel * 0.07) * (0.5 + 0.5 * sin(uTime * 3.1 - radius * 6.0 + phase));
  p += n * uState[3] * uPulse * 0.03 * (0.5 + 0.5 * sin(uTime * 9.0 + phase * 2.0));

  vec3 pointerDir = normalize(vec3(uPointer * uGaze, 0.55));
  float bulge = max(0.0, dot(n, pointerDir)) * 0.032 * (1.0 - min(1.0, contraction) * 0.5);
  p += n * bulge;

  float yaw = uPointer.x * uGaze * 0.46 + 0.05 * sin(uTime * 0.23);
  float pitch = -uPointer.y * uGaze * 0.26 - 0.02 + 0.02 * sin(uTime * 0.31);
  return rotateX(pitch) * rotateY(yaw) * p;
}

void main() {
  vec3 pA = lifeformPoint(aBaseA, aSeedA.x * 6.2831853);
  vec3 pB = lifeformPoint(aBaseB, aSeedB.x * 6.2831853);

  vec3 p;
  float alpha;
  if (uFiberPass > 0.5) {
    // 脉冲：沿纤维按各自相位移动，端点处淡出，避免突然出现或消失。
    // 外传通道提高脉冲速度与浓度：回答时信号明确地从内部向外扩散。
    float speed = 0.16 + 0.28 * clamp(uEnergy, 0.0, 1.0) + 0.55 * uBurst + 0.22 * uCognition.z;
    float t = fract(uTime * speed + aPhase);
    p = mix(pA, pB, t);
    alpha = uFiberAlpha * 2.6 * aTone * (1.0 + 0.45 * uCognition.z)
      * smoothstep(0.0, 0.12, t) * (1.0 - smoothstep(0.88, 1.0, t));
  } else {
    // 纤维线：偶数顶点取 A 端、奇数顶点取 B 端，两端都由同一函数算出，永不脱节。
    p = mix(pA, pB, step(0.5, mod(float(gl_VertexID), 2.0)));
    alpha = uFiberAlpha * aTone * (1.0 + 0.12 * uCognition.x);
  }

  // 与精灵程序完全一致的内部动态：聚合收紧、自主脉冲轻微鼓起。
  p *= 1.0 - 0.055 * uCognition.y;
  p *= 1.0 + 0.016 * uCognition.w;

  vec4 viewPos = vec4(bodyTransform(p), 1.0);
  viewPos.z -= 3.55;
  // 与精灵程序同一深度通道：脉冲与纤维和细胞同步前后移动。
  viewPos.z += uBody.z;
  gl_Position = uProjection * viewPos;

  float sizeScale = uPointScale / max(0.4, -viewPos.z);
  float smallBoost = clamp(120.0 / max(1.0, uCoreHeight), 1.0, 3.2);
  gl_PointSize = clamp(0.030 * sizeScale * smallBoost, 1.0, 24.0);

  float depthFade = 0.55 + 0.45 * smoothstep(-1.6, 0.6, viewPos.z);
  vAlpha = clamp(alpha * depthFade, 0.0, 0.95);
}
`;

export const MODA_CORE_FIBER_FRAGMENT_SHADER = `#version 300 es
precision highp float;

in float vAlpha;

uniform vec3 uColor;
uniform vec3 uErrorColor;
uniform float uErrorMix;
/** 0 = 纤维线，1 = 沿纤维移动的脉冲。 */
uniform float uFiberPass;

out vec4 fragColor;

void main() {
  vec3 ink = mix(uColor, uErrorColor, uErrorMix);

  if (uFiberPass > 0.5) {
    // 脉冲：近黑高浓度点，边缘柔化，形成神经信号传导的实心光点。
    vec2 delta = gl_PointCoord * 2.0 - 1.0;
    float dist = length(delta);
    if (dist > 1.0) discard;
    float alpha = pow(1.0 - smoothstep(0.0, 1.0, dist), 1.4) * vAlpha;
    fragColor = vec4(ink * alpha, alpha);
  } else {
    // 纤维：中灰细线，颜色与浓度由顶点插值得到。
    fragColor = vec4(ink * vAlpha, vAlpha);
  }
}
`;


