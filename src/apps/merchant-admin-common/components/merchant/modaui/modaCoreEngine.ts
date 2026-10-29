/**
 * ModaUI 数字生命核心渲染引擎（WebGL2：神经生命体）
 *
 * 硬性约束（见 docs/engineering/modules/modaui-core.md 第 0 节与第 16 节）：
 * - 可见元素只有细胞、神经纤维、脉冲与内部尘埃，全部由 GPU 按同一组运动函数实时计算；
 *   没有头像、五官、身体、底座，也没有任何图片、贴图、GIF 或视频，不绘制实体曲面。
 * - 细胞、纤维、脉冲、尘埃共用同一套运动函数（`lifeformPoint()`），因此纤维端点永远贴合细胞。
 * - 6 个状态权重通过 `uState[6]` 逐帧插值，不切换预设画面。
 * - 零新增运行时依赖；WebGL2 不可用时返回 null，由调用方使用 CSS 降级视觉。
 */

import { buildNeuralLifeform, isInsideLifeform, type NeuralLifeformData } from './neuralLifeform';
import { MODA_CORE_MOBILE_MAX_PARTICLES, modaCoreParticleCountForSize } from './modaCoreStageMath';
import {
  MODA_CORE_FIBER_FRAGMENT_SHADER,
  MODA_CORE_FIBER_VERTEX_SHADER,
  MODA_CORE_SPRITE_FRAGMENT_SHADER,
  MODA_CORE_SPRITE_VERTEX_SHADER
} from './coreShaders';
import type { ModaCoreLifeFrame } from './modaCoreLife';
import {
  createModaBrainBehavior,
  BRAIN_BUDGET,
  type BrainBehaviorFrame,
  type BrainPresentationMode
} from './modaBrainBehavior';

export type ModaCoreVisualState = 'idle' | 'listening' | 'thinking' | 'speaking' | 'success' | 'error';

export const MODA_CORE_STATES: ModaCoreVisualState[] = ['idle', 'listening', 'thinking', 'speaking', 'success', 'error'];

export type ModaCoreStats = {
  /** 可见精灵粒子数（细胞 + 内部尘埃）。 */
  particleCount: number;
  cellCount: number;
  dustCount: number;
  fiberCount: number;
  pulseCount: number;
  dpr: number;
  frames: number;
  lastFrameMs: number;
  /** 当前生命通道数值（聚拢/前移/流动/脉冲/能量），用于验收与自动化检查。 */
  life: { contraction: number; forward: number; flow: number; pulse: number; energy: number };
  /** 主体运动快照（位置/深度/尺寸/姿态/行为/动态），用于量化验收。 */
  motion: {
    x: number;
    y: number;
    depth: number;
    scale: number;
    tiltX: number;
    tiltY: number;
    tiltZ: number;
    energy: number;
    speed: number;
    extent: number;
    behavior: BrainBehaviorFrame['behavior'];
    kind: BrainBehaviorFrame['kind'];
    progress: number;
    dwelling: boolean;
    dynamics: BrainBehaviorFrame['dynamics'];
  };
};

export type ModaCoreRendererOptions = {
  canvas: HTMLCanvasElement;
  /** 真实麦克风 RMS，0–1，由调用方采样。 */
  readLevel: () => number;
  /** 真实语音播报脉冲，0–1，由语音 boundary 事件置位。 */
  readPulse: () => number;
  /**
   * 对话实时生命通道（输入/提交/文本片段/语音），0–1 连续值。
   * 未提供时核心保持原有待机行为。
   */
  readLife?: () => ModaCoreLifeFrame | null;
  /** WebGL 上下文丢失时回调，调用方应切换到降级视觉。 */
  onContextLost?: () => void;
};

export type ModaCoreRendererHandle = {
  setState: (state: ModaCoreVisualState) => void;
  /** 呈现模式：自由舞台 / 回答内嵌头像。运动控制器据此限制宏观换位，不重置位姿。 */
  setPresentation: (mode: BrainPresentationMode) => void;
  /** 按显示尺寸调整粒子预算：复用同一 WebGL 上下文与着色器程序，只重建顶点数据。 */
  setParticleCount: (count: number) => void;
  start: () => void;
  stop: () => void;
  resize: () => void;
  dispose: () => void;
  getStats: () => ModaCoreStats;
};

const FRAME_BUDGET_MS = 26;
const FOV_DEGREES = 32;
/**
 * 投影留白：与小程序 `PROJECTION_SCALE` 同值，来源于 `BRAIN_BUDGET.projectionScale`（单一事实来源）。
 * 生命体半径 1、视距 3.55、FOV 32°，主体运动（近 0.18 / 放大 1.05）会把外圈推到约 1.19 倍，
 * 0.82 使中性构图约占半屏 0.85、峰值不超过 0.945，任何通道组合都不会被画布边缘裁切。
 */
const PROJECTION_SCALE = BRAIN_BUDGET.projectionScale;
/** 精灵顶点：base(3) + seed(4) + size(1) + tone(1)。 */
const SPRITE_STRIDE = 9;
/** 纤维顶点：baseA(3) + seedA(4) + baseB(3) + seedB(4) + phase(1) + tone(1)。 */
const FIBER_STRIDE = 16;

type CoreUniforms = {
  projection: WebGLUniformLocation | null;
  time: WebGLUniformLocation | null;
  level: WebGLUniformLocation | null;
  pulse: WebGLUniformLocation | null;
  state: WebGLUniformLocation | null;
  pointScale: WebGLUniformLocation | null;
  coreHeight: WebGLUniformLocation | null;
  pointer: WebGLUniformLocation | null;
  gaze: WebGLUniformLocation | null;
  life: WebGLUniformLocation | null;
  energy: WebGLUniformLocation | null;
  burst: WebGLUniformLocation | null;
  color: WebGLUniformLocation | null;
  errorColor: WebGLUniformLocation | null;
  errorMix: WebGLUniformLocation | null;
  highlight: WebGLUniformLocation | null;
  sprite: WebGLUniformLocation | null;
  fiberAlpha: WebGLUniformLocation | null;
  fiberPass: WebGLUniformLocation | null;
  body: WebGLUniformLocation | null;
  bodyTilt: WebGLUniformLocation | null;
  /** 内部动态：x 激活、y 聚合、z 外传、w 自主脉冲（BrainBehaviorController 每帧输出）。 */
  cognition: WebGLUniformLocation | null;
};

function compileShader(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error('ModaUI core: 无法创建着色器');
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader) ?? '';
    gl.deleteShader(shader);
    throw new Error(`ModaUI core: 着色器编译失败 ${log}`);
  }
  return shader;
}

function linkProgram(gl: WebGL2RenderingContext, vertexSource: string, fragmentSource: string): WebGLProgram {
  const vertex = compileShader(gl, gl.VERTEX_SHADER, vertexSource);
  const fragment = compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
  const program = gl.createProgram();
  if (!program) throw new Error('ModaUI core: 无法创建着色器程序');
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(program) ?? '';
    gl.deleteProgram(program);
    throw new Error(`ModaUI core: 着色器链接失败 ${log}`);
  }
  return program;
}

function resolveUniforms(gl: WebGL2RenderingContext, program: WebGLProgram): CoreUniforms {
  const at = (name: string) => gl.getUniformLocation(program, name);
  return {
    projection: at('uProjection'),
    time: at('uTime'),
    level: at('uLevel'),
    pulse: at('uPulse'),
    state: at('uState[0]'),
    pointScale: at('uPointScale'),
    coreHeight: at('uCoreHeight'),
    pointer: at('uPointer'),
    gaze: at('uGaze'),
    life: at('uLife'),
    energy: at('uEnergy'),
    burst: at('uBurst'),
    color: at('uColor'),
    errorColor: at('uErrorColor'),
    errorMix: at('uErrorMix'),
    highlight: at('uHighlight'),
    sprite: at('uSprite'),
    fiberAlpha: at('uFiberAlpha'),
    fiberPass: at('uFiberPass'),
    body: at('uBody'),
    bodyTilt: at('uBodyTilt'),
    cognition: at('uCognition')
  };
}

function perspectiveMatrix(aspect: number, fovDegrees: number, near: number, far: number): Float32Array {
  const f = 1 / Math.tan((fovDegrees * Math.PI) / 360);
  const range = 1 / (near - far);
  return new Float32Array([
    f / aspect, 0, 0, 0,
    0, f, 0, 0,
    0, 0, (far + near) * range, -1,
    0, 0, 2 * far * near * range, 0
  ]);
}

/** 生命体专用投影：标准透视再乘投影留白，w 不变，透视深度关系保持线性。 */
function lifeformProjection(aspect: number): Float32Array {
  const matrix = perspectiveMatrix(aspect, FOV_DEGREES, 0.1, 30);
  matrix[0] *= PROJECTION_SCALE;
  matrix[5] *= PROJECTION_SCALE;
  return matrix;
}

/** 把细胞/尘埃数据交错成一条顶点缓冲，供点精灵通道使用。 */
function interleaveSprites(source: {
  count: number;
  base: Float32Array;
  seeds: Float32Array;
  sizes: Float32Array;
  tones: Float32Array;
}): Float32Array {
  const out = new Float32Array(source.count * SPRITE_STRIDE);
  for (let index = 0; index < source.count; index += 1) {
    const at = index * SPRITE_STRIDE;
    out[at] = source.base[index * 3];
    out[at + 1] = source.base[index * 3 + 1];
    out[at + 2] = source.base[index * 3 + 2];
    out[at + 3] = source.seeds[index * 4];
    out[at + 4] = source.seeds[index * 4 + 1];
    out[at + 5] = source.seeds[index * 4 + 2];
    out[at + 6] = source.seeds[index * 4 + 3];
    out[at + 7] = source.sizes[index];
    out[at + 8] = source.tones[index];
  }
  return out;
}

/** 把纤维端点交错成一条顶点缓冲：纤维线与脉冲共用，脉冲通道改用 stride 取样。 */
function interleaveFibers(fibers: NeuralLifeformData['fibers']): Float32Array {
  const out = new Float32Array(fibers.vertexCount * FIBER_STRIDE);
  for (let vertex = 0; vertex < fibers.vertexCount; vertex += 1) {
    const at = vertex * FIBER_STRIDE;
    out[at] = fibers.baseA[vertex * 3];
    out[at + 1] = fibers.baseA[vertex * 3 + 1];
    out[at + 2] = fibers.baseA[vertex * 3 + 2];
    out[at + 3] = fibers.seedA[vertex * 4];
    out[at + 4] = fibers.seedA[vertex * 4 + 1];
    out[at + 5] = fibers.seedA[vertex * 4 + 2];
    out[at + 6] = fibers.seedA[vertex * 4 + 3];
    out[at + 7] = fibers.baseB[vertex * 3];
    out[at + 8] = fibers.baseB[vertex * 3 + 1];
    out[at + 9] = fibers.baseB[vertex * 3 + 2];
    out[at + 10] = fibers.seedB[vertex * 4];
    out[at + 11] = fibers.seedB[vertex * 4 + 1];
    out[at + 12] = fibers.seedB[vertex * 4 + 2];
    out[at + 13] = fibers.seedB[vertex * 4 + 3];
    out[at + 14] = fibers.phases[vertex];
    out[at + 15] = fibers.tones[vertex];
  }
  return out;
}

export function createModaCoreRenderer(options: ModaCoreRendererOptions): ModaCoreRendererHandle | null {
  const { canvas } = options;
  const gl = canvas.getContext('webgl2', {
    alpha: true,
    antialias: false,
    depth: false,
    stencil: false,
    premultipliedAlpha: true,
    powerPreference: 'high-performance'
  });
  if (!gl) return null;

  const spriteProgram = linkProgram(gl, MODA_CORE_SPRITE_VERTEX_SHADER, MODA_CORE_SPRITE_FRAGMENT_SHADER);
  const fiberProgram = linkProgram(gl, MODA_CORE_FIBER_VERTEX_SHADER, MODA_CORE_FIBER_FRAGMENT_SHADER);
  const spriteUniforms = resolveUniforms(gl, spriteProgram);
  const fiberUniforms = resolveUniforms(gl, fiberProgram);

  const reducedMotion = typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const compactViewport = typeof window === 'undefined'
    || Math.min(window.innerWidth, window.innerHeight) < 480;
  // 粒子预算按显示边长计算（见 modaCoreStageMath）：32px 的对话内小核心不需要一万六千个粒子，
  // 大舞台保持原有密度（手机 9000 / 桌面 16000）。生命体结构数量由预算的平方根推导。
  const initialSize = Math.max(1, Math.min(canvas.clientWidth || 240, canvas.clientHeight || 240));
  const budget = (count: number) => (reducedMotion ? Math.min(count, MODA_CORE_MOBILE_MAX_PARTICLES) : count);
  let data = buildNeuralLifeform(budget(modaCoreParticleCountForSize(initialSize, compactViewport)));

  // 顶点数据可在显示尺寸变化时重建；着色器程序、VAO 与 WebGL 上下文始终复用。
  let buffers: WebGLBuffer[] = [];
  let vaos: WebGLVertexArrayObject[] = [];
  let cellVao: WebGLVertexArrayObject | null = null;
  let dustVao: WebGLVertexArrayObject | null = null;
  let fiberLineVao: WebGLVertexArrayObject | null = null;
  let fiberPulseVao: WebGLVertexArrayObject | null = null;

  const newBuffer = (array: Float32Array): WebGLBuffer | null => {
    const buffer = gl.createBuffer();
    if (!buffer) return null;
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, array, gl.STATIC_DRAW);
    buffers.push(buffer);
    return buffer;
  };

  /** 精灵 VAO：location 0 base、1 seed、2 size、3 tone。 */
  const bindSpriteVao = (buffer: WebGLBuffer | null): WebGLVertexArrayObject | null => {
    const vao = gl.createVertexArray();
    if (!vao) return null;
    vaos.push(vao);
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    const stride = SPRITE_STRIDE * 4;
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, stride, 0);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 4, gl.FLOAT, false, stride, 3 * 4);
    gl.enableVertexAttribArray(2);
    gl.vertexAttribPointer(2, 1, gl.FLOAT, false, stride, 7 * 4);
    gl.enableVertexAttribArray(3);
    gl.vertexAttribPointer(3, 1, gl.FLOAT, false, stride, 8 * 4);
    gl.bindVertexArray(null);
    return vao;
  };

  /**
   * 纤维 VAO：location 0 baseA、1 seedA、2 baseB、3 seedB、4 phase、5 tone。
   * 传 `FIBER_STRIDE * 4` 得到连续顶点（画线）；传 `FIBER_STRIDE * 2 * 4` 只取每条边的
   * 第一个顶点（画脉冲），因此脉冲通道不需要第二份几何数据。
   */
  const bindFiberVao = (buffer: WebGLBuffer | null, strideBytes: number): WebGLVertexArrayObject | null => {
    const vao = gl.createVertexArray();
    if (!vao) return null;
    vaos.push(vao);
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, strideBytes, 0);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 4, gl.FLOAT, false, strideBytes, 3 * 4);
    gl.enableVertexAttribArray(2);
    gl.vertexAttribPointer(2, 3, gl.FLOAT, false, strideBytes, 7 * 4);
    gl.enableVertexAttribArray(3);
    gl.vertexAttribPointer(3, 4, gl.FLOAT, false, strideBytes, 10 * 4);
    gl.enableVertexAttribArray(4);
    gl.vertexAttribPointer(4, 1, gl.FLOAT, false, strideBytes, 14 * 4);
    gl.enableVertexAttribArray(5);
    gl.vertexAttribPointer(5, 1, gl.FLOAT, false, strideBytes, 15 * 4);
    gl.bindVertexArray(null);
    return vao;
  };

  const upload = (next: NeuralLifeformData) => {
    vaos.forEach(vao => gl.deleteVertexArray(vao));
    buffers.forEach(buffer => gl.deleteBuffer(buffer));
    vaos = [];
    buffers = [];

    const cellBuffer = newBuffer(interleaveSprites(next.cells));
    const dustBuffer = newBuffer(interleaveSprites(next.dust));
    const fiberBuffer = newBuffer(interleaveFibers(next.fibers));

    cellVao = bindSpriteVao(cellBuffer);
    dustVao = bindSpriteVao(dustBuffer);
    fiberLineVao = bindFiberVao(fiberBuffer, FIBER_STRIDE * 4);
    fiberPulseVao = bindFiberVao(fiberBuffer, FIBER_STRIDE * 2 * 4);
  };
  upload(data);

  const weights = new Float32Array(6);
  weights[0] = 1;
  // 生命通道的引擎侧再平滑一次：即便调用方在片段到达时直接置位，粒子也不会跳变。
  const life = { contraction: 0, forward: 0, flow: 0, pulse: 0, energy: 0.82 };
  // 主体运动控制器：位置/深度/尺寸/姿态与内部动态的唯一来源，渲染器只负责把结果写进 uniform。
  const motion = createModaBrainBehavior();
  const motionInput = {
    idle: 1,
    listening: 0,
    thinking: 0,
    responding: 0,
    success: 0,
    error: 0,
    energy: 0.82,
    forward: 0,
    pulse: 0,
    burst: 0,
    pointerX: 0,
    pointerY: 0,
    presentation: 'stage' as BrainPresentationMode,
    reduced: reducedMotion
  };
  let motionFrame = motion.getFrame();
  let presentationMode: BrainPresentationMode = 'stage';
  let visualState: ModaCoreVisualState = 'idle';
  let burst = 0;
  const dprCap = compactViewport ? 1.25 : 1.6;
  const dpr = Math.min(typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1, dprCap);
  let dprScale = 1;
  let projection = lifeformProjection(1);
  let pointScale = 1;
  let rafId = 0;
  let running = false;
  let disposed = false;
  let lastFrame = 0;
  let elapsed = 0;
  let frames = 0;
  let lastFrameMs = 0;
  let emaMs = 16;
  let lastAdaptCheck = 0;
  let probeClock = 0;
  const pointer = { x: 0, y: 0, targetX: 0, targetY: 0 };
  const gazeScale = reducedMotion ? 0.25 : 1;

  const resize = () => {
    if (disposed) return;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    if (!width || !height) return;
    const ratio = dpr * dprScale;
    const deviceWidth = Math.max(1, Math.round(width * ratio));
    const deviceHeight = Math.max(1, Math.round(height * ratio));
    if (canvas.width !== deviceWidth) canvas.width = deviceWidth;
    if (canvas.height !== deviceHeight) canvas.height = deviceHeight;
    projection = lifeformProjection(width / height);
    // 小画布（对话内 32px 核心）必须把点精灵的像素半径从构图预算里让出去。
    motion.setViewport(Math.min(width, height));
    // 手机端画布像素更少，同样点数会更淡；按同一视觉密度补偿点尺寸。
    pointScale = deviceHeight / (2 * Math.tan((FOV_DEGREES * Math.PI) / 360)) * (compactViewport ? 1.25 : 1);
    gl.viewport(0, 0, deviceWidth, deviceHeight);
  };

  // 鼠标交互：整个页面范围内的指针都会驱动姿态视差与局部鼓起，指针停止后回到正面。
  const onPointerMove = (event: PointerEvent) => {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const rawX = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    const rawY = ((event.clientY - rect.top) / rect.height) * 2 - 1;
    pointer.targetX = Math.max(-1.25, Math.min(1.25, rawX));
    pointer.targetY = Math.max(-1.25, Math.min(1.25, rawY));
  };

  const onPointerReset = () => {
    pointer.targetX = 0;
    pointer.targetY = 0;
  };

  // 点击冲击波：只有落在生命体外接圆内才触发，画布本身 pointer-events: none 不拦截页面交互。
  const onPointerDown = (event: PointerEvent) => {
    if (disposed) return;
    if (isInsideLifeform(canvas.getBoundingClientRect(), event.clientX, event.clientY)) {
      burst = 1;
    }
  };

  const stop = () => {
    running = false;
    if (rafId) cancelAnimationFrame(rafId);
    rafId = 0;
    lastFrame = 0;
  };

  const onContextLost = (event: Event) => {
    event.preventDefault();
    stop();
    options.onContextLost?.();
  };

  const setCommonUniforms = (programUniforms: CoreUniforms) => {
    gl.uniformMatrix4fv(programUniforms.projection, false, projection);
    gl.uniform1f(programUniforms.time, elapsed);
    gl.uniform1f(programUniforms.level, Math.max(0, Math.min(1, options.readLevel())));
    gl.uniform1f(programUniforms.pulse, Math.max(0, Math.min(1, options.readPulse())));
    gl.uniform1fv(programUniforms.state, weights);
    gl.uniform1f(programUniforms.pointScale, pointScale);
    gl.uniform1f(programUniforms.coreHeight, Math.max(1, canvas.clientHeight || 0));
    gl.uniform2f(programUniforms.pointer, pointer.x, pointer.y);
    gl.uniform1f(programUniforms.gaze, gazeScale);
    gl.uniform4f(programUniforms.life, life.contraction, life.forward, life.flow, life.pulse);
    gl.uniform1f(programUniforms.energy, life.energy);
    gl.uniform1f(programUniforms.burst, burst);
    // 主体运动：x/y 位移、z 深度、w 自身尺寸；倾斜单独一组，纤维与细胞共用。
    gl.uniform4f(programUniforms.body, motionFrame.x, motionFrame.y, motionFrame.depth, motionFrame.scale);
    gl.uniform3f(programUniforms.bodyTilt, motionFrame.tiltX, motionFrame.tiltY, motionFrame.tiltZ);
    // 内部动态：行为控制器统一给出的神经激活 / 聚合 / 外传 / 自主脉冲。
    gl.uniform4f(
      programUniforms.cognition,
      motionFrame.dynamics.agitation,
      motionFrame.dynamics.cohesion,
      motionFrame.dynamics.outflow,
      motionFrame.dynamics.pulse
    );
    // 近黑墨色：白底上以灰阶呈现，不用纯黑也不用纯白；失败态转为中性石墨灰，不使用彩色。
    gl.uniform3f(programUniforms.color, 0.085, 0.085, 0.095);
    gl.uniform3f(programUniforms.errorColor, 0.16, 0.155, 0.165);
    gl.uniform1f(programUniforms.errorMix, weights[5]);
  };

  const draw = () => {
    gl.disable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    // 纯白背景上的灰阶结构：普通 alpha 混合（预乘），叠加后仍是灰阶，不会发出白光。
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    // 纤维随真实活动与点击冲击增亮，但始终留在中灰区间；基线保证细线在 32px 小核心上仍可辨认。
    const fiberAlpha = Math.max(0.18, Math.min(0.44, 0.2 + 0.12 * life.energy + 0.3 * burst));
    const pulseCount = Math.min(data.layout.pulses, data.fibers.edgeCount);

    // 1) 纤维线：画在细胞下层，形成结构底纹。
    gl.useProgram(fiberProgram);
    setCommonUniforms(fiberUniforms);
    gl.uniform1f(fiberUniforms.fiberAlpha, fiberAlpha);
    gl.uniform1f(fiberUniforms.fiberPass, 0);
    gl.bindVertexArray(fiberLineVao);
    gl.drawArrays(gl.LINES, 0, data.fibers.vertexCount);

    // 2) 内部尘埃 → 3) 半透明细胞：同一支精灵程序，只切换 uSprite。
    gl.useProgram(spriteProgram);
    setCommonUniforms(spriteUniforms);
    gl.uniform3f(spriteUniforms.highlight, 0.56, 0.56, 0.59);
    gl.uniform1f(spriteUniforms.sprite, 1);
    gl.bindVertexArray(dustVao);
    gl.drawArrays(gl.POINTS, 0, data.dust.count);
    gl.uniform1f(spriteUniforms.sprite, 0);
    gl.bindVertexArray(cellVao);
    gl.drawArrays(gl.POINTS, 0, data.cells.count);

    // 4) 脉冲：压在细胞之上，形成可追踪的神经信号。
    gl.useProgram(fiberProgram);
    gl.uniform1f(fiberUniforms.fiberPass, 1);
    gl.uniform1f(fiberUniforms.fiberAlpha, fiberAlpha);
    gl.bindVertexArray(fiberPulseVao);
    gl.drawArrays(gl.POINTS, 0, pulseCount);

    gl.bindVertexArray(null);
  };

  const frame = (now: number) => {
    if (!running) return;
    rafId = requestAnimationFrame(frame);
    const deltaMs = lastFrame ? now - lastFrame : 16;
    lastFrame = now;
    const dt = Math.min(0.05, deltaMs / 1000);
    lastFrameMs = deltaMs;
    emaMs = emaMs * 0.9 + deltaMs * 0.1;
    frames += 1;
    elapsed += dt * (reducedMotion ? 0.18 : 1);
    pointer.x += (pointer.targetX - pointer.x) * Math.min(1, dt * 3);
    pointer.y += (pointer.targetY - pointer.y) * Math.min(1, dt * 3);
    // 点击冲击按指数衰减回常态，不留下永久位移。
    burst *= Math.exp(-dt * 2.4);

    // 状态权重逐帧插值：同一套细胞连续变形，不切换任何预设画面。
    const settle = 1 - Math.exp(-dt * (reducedMotion ? 3.2 : 5.5));
    for (let index = 0; index < MODA_CORE_STATES.length; index += 1) {
      const goal = MODA_CORE_STATES[index] === visualState ? 1 : 0;
      weights[index] += (goal - weights[index]) * settle;
    }

    // 对话实时生命通道：读取真实事件平滑后的目标值，再按帧率做一次阻尼。
    const lifeFrame = options.readLife ? options.readLife() : null;
    const lifeSettle = 1 - Math.exp(-dt * (reducedMotion ? 4 : 7));
    const readLifeValue = (key: 'contraction' | 'forward' | 'flow' | 'pulse' | 'energy', fallback: number) => {
      const raw = lifeFrame ? lifeFrame[key] : fallback;
      return Number.isFinite(raw) ? Math.max(0, Math.min(1, raw as number)) : fallback;
    };
    life.contraction += (readLifeValue('contraction', 0) - life.contraction) * lifeSettle;
    life.forward += (readLifeValue('forward', 0) - life.forward) * lifeSettle;
    life.flow += (readLifeValue('flow', 0) - life.flow) * lifeSettle;
    life.pulse += (readLifeValue('pulse', 0) - life.pulse) * lifeSettle;
    life.energy += (readLifeValue('energy', 0.82) - life.energy) * lifeSettle;

    // 主体运动：真实状态权重 + 生命通道 → 运动控制器统一编排（位置/深度/尺寸/姿态）。
    motionInput.idle = weights[0];
    motionInput.listening = weights[1];
    motionInput.thinking = weights[2];
    motionInput.responding = Math.max(weights[3], life.flow);
    motionInput.success = weights[4];
    motionInput.error = weights[5];
    motionInput.energy = life.energy;
    motionInput.forward = life.forward;
    motionInput.pulse = Math.max(life.pulse, burst * 0.4);
    motionInput.burst = burst;
    motionInput.pointerX = pointer.x;
    motionInput.pointerY = pointer.y;
    motionInput.presentation = presentationMode;
    motionFrame = motion.update(dt, motionInput);

    // 性能降级：帧时间长期超预算时先降运动频率与幅度，再降渲染分辨率；恢复后自动回到高档。
    if (now - lastAdaptCheck > 1200) {
      lastAdaptCheck = now;
      if (emaMs > FRAME_BUDGET_MS) {
        motion.setQuality('low');
        if (dprScale > 0.55) {
          dprScale = Math.max(0.55, dprScale - 0.15);
          resize();
        }
      } else if (emaMs < FRAME_BUDGET_MS * 0.6) {
        motion.setQuality('high');
      }
    }

    // 真实页面验收探针：每 200ms 记录一次主体位姿与行为，不参与渲染、不影响帧预算。
    probeClock += dt;
    if (probeClock >= 0.2 && typeof window !== 'undefined') {
      probeClock = 0;
      const store = window as unknown as {
        __modauiBrainMotion?: Array<{ t: number; behavior: string; x: number; y: number; extent: number }>;
      };
      const log = store.__modauiBrainMotion || (store.__modauiBrainMotion = []);
      log.push({
        t: Math.round(now),
        behavior: `${motionFrame.behavior}:${motionFrame.dwelling ? 'dwell' : motionFrame.kind}`,
        x: Number(motionFrame.x.toFixed(4)),
        y: Number(motionFrame.y.toFixed(4)),
        extent: Number(motionFrame.extent.toFixed(4))
      });
      if (log.length > 400) log.splice(0, log.length - 400);
    }

    draw();
  };

  const start = () => {
    if (running || disposed) return;
    running = true;
    lastFrame = 0;
    resize();
    rafId = requestAnimationFrame(frame);
  };

  const setState = (next: ModaCoreVisualState) => {
    visualState = MODA_CORE_STATES.includes(next) ? next : 'idle';
  };

  /** 呈现模式只影响运动语义（宏观换位/幅度），不重置位姿、不重建画布。 */
  const setPresentation = (mode: BrainPresentationMode) => {
    presentationMode = mode === 'inline' ? 'inline' : 'stage';
  };

  const setParticleCount = (count: number) => {
    if (disposed || !Number.isFinite(count) || count <= 0) return;
    const next = buildNeuralLifeform(budget(Math.round(count)));
    // 细胞数量变化不到 20% 不重建，避免在尺寸临界点反复抖动。
    if (Math.abs(next.cells.count - data.cells.count) / data.cells.count < 0.2) return;
    data = next;
    upload(data);
  };

  const dispose = () => {
    if (disposed) return;
    stop();
    disposed = true;
    document.removeEventListener('pointermove', onPointerMove);
    document.removeEventListener('pointerdown', onPointerDown);
    window.removeEventListener('pointerout', onPointerReset);
    window.removeEventListener('blur', onPointerReset);
    canvas.removeEventListener('webglcontextlost', onContextLost);
    vaos.forEach(vao => gl.deleteVertexArray(vao));
    buffers.forEach(buffer => gl.deleteBuffer(buffer));
    vaos = [];
    buffers = [];
    gl.deleteProgram(spriteProgram);
    gl.deleteProgram(fiberProgram);
  };

  resize();
  // 指针监听绑在 document 上：鼠标在页面任意位置移动都会驱动姿态视差。
  document.addEventListener('pointermove', onPointerMove, { passive: true });
  document.addEventListener('pointerdown', onPointerDown, { passive: true });
  window.addEventListener('pointerout', onPointerReset);
  window.addEventListener('blur', onPointerReset);
  canvas.addEventListener('webglcontextlost', onContextLost, false);

  return {
    setState,
    setPresentation,
    setParticleCount,
    start,
    stop,
    resize,
    dispose,
    getStats: () => ({
      particleCount: data.cells.count + data.dust.count,
      cellCount: data.cells.count,
      dustCount: data.dust.count,
      fiberCount: data.fibers.edgeCount,
      pulseCount: Math.min(data.layout.pulses, data.fibers.edgeCount),
      dpr: Number((dpr * dprScale).toFixed(2)),
      frames,
      lastFrameMs,
      life: {
        contraction: Number(life.contraction.toFixed(3)),
        forward: Number(life.forward.toFixed(3)),
        flow: Number(life.flow.toFixed(3)),
        pulse: Number(life.pulse.toFixed(3)),
        energy: Number(life.energy.toFixed(3))
      },
      motion: {
        x: Number(motionFrame.x.toFixed(4)),
        y: Number(motionFrame.y.toFixed(4)),
        depth: Number(motionFrame.depth.toFixed(4)),
        scale: Number(motionFrame.scale.toFixed(4)),
        tiltX: Number(motionFrame.tiltX.toFixed(4)),
        tiltY: Number(motionFrame.tiltY.toFixed(4)),
        tiltZ: Number(motionFrame.tiltZ.toFixed(4)),
        energy: Number(motionFrame.energy.toFixed(3)),
        speed: Number(motionFrame.speed.toFixed(4)),
        extent: Number(motionFrame.extent.toFixed(4)),
        behavior: motionFrame.behavior,
        kind: motionFrame.kind,
        progress: Number(motionFrame.progress.toFixed(3)),
        dwelling: motionFrame.dwelling,
        dynamics: {
          agitation: Number(motionFrame.dynamics.agitation.toFixed(3)),
          cohesion: Number(motionFrame.dynamics.cohesion.toFixed(3)),
          outflow: Number(motionFrame.dynamics.outflow.toFixed(3)),
          pulse: Number(motionFrame.dynamics.pulse.toFixed(3))
        }
      }
    })
  };
}
