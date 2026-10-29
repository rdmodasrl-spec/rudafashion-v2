import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import test from 'node:test';
import {
  animateNeuralCell,
  buildNeuralLifeform,
  isInsideLifeform,
  neuralLifeformLayoutForBudget,
  type NeuralActivity
} from '../src/apps/merchant-admin-common/components/merchant/modaui/neuralLifeform';
import { createModaCoreLife as createModaCoreLifeFactory } from '../src/apps/merchant-admin-common/components/merchant/modaui/modaCoreLife';
import {
  createModaBrainBehavior,
  BRAIN_BEHAVIORS,
  BRAIN_BUDGET,
  BRAIN_LIMITS,
  BRAIN_SEED,
  type BrainBehaviorInput
} from '../src/apps/merchant-admin-common/components/merchant/modaui/modaBrainBehavior';

const root = process.cwd();
const read = (relativePath: string) => readFileSync(path.join(root, relativePath), 'utf8');

const coreDir = 'src/apps/merchant-admin-common/components/merchant/modaui';
const lifeformSource = read(`${coreDir}/neuralLifeform.ts`);
const shadersSource = read(`${coreDir}/coreShaders.ts`);
const engineSource = read(`${coreDir}/modaCoreEngine.ts`);
const componentSource = read(`${coreDir}/ModaUICore.tsx`);
const audioSource = read(`${coreDir}/useModaCoreAudio.ts`);
const miniCore = read('merchant-miniprogram/utils/moda-core.js');
const miniWelcome = read('merchant-miniprogram/pages/assistant/index.wxml');
const miniPage = read('merchant-miniprogram/pages/assistant/index.js');

test('数字生命核心零新增依赖，且不含任何头像图片、贴图或视频', () => {
  const pkg = JSON.parse(read('package.json')) as {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };
  for (const field of ['dependencies', 'devDependencies'] as const) {
    const deps = pkg[field] ?? {};
    for (const banned of ['three', '@react-three/fiber', '@react-three/drei', 'ogl', 'regl']) {
      assert.equal(deps[banned], undefined, `${banned} must not be added`);
    }
  }
  for (const source of [lifeformSource, shadersSource, engineSource, componentSource, miniCore]) {
    assert.doesNotMatch(source, /new Image\(|createImageBitmap|texImage2D|createTexture/i);
    assert.doesNotMatch(source, /\.(png|jpe?g|webp|gif|svg)/i);
    assert.doesNotMatch(source, /<img|<image/i);
  }
});

test('神经生命体几何可复现：细胞分内外两层、纤维无向边去重、脉冲在合理范围', () => {
  const first = buildNeuralLifeform(16000);
  const second = buildNeuralLifeform(16000);
  assert.deepEqual(Array.from(first.cells.base.slice(0, 30)), Array.from(second.cells.base.slice(0, 30)));
  assert.deepEqual(Array.from(first.fibers.phases.slice(0, 20)), Array.from(second.fibers.phases.slice(0, 20)));
  assert.equal(first.cells.count, second.cells.count);

  // 布局：预算只决定密度，结构定义不变。
  const layout = neuralLifeformLayoutForBudget(16000);
  assert.equal(layout.cells, first.cells.count);
  assert.ok(layout.cells >= 96 && layout.cells <= 460, `细胞数量必须受控，实际 ${layout.cells}`);
  assert.ok(layout.dust > 0 && layout.pulses > 0, '尘埃与脉冲必须有实际数量');
  assert.deepEqual(
    neuralLifeformLayoutForBudget(1400),
    neuralLifeformLayoutForBudget(1400),
    '同一预算必须给出同一布局'
  );
  assert.ok(
    neuralLifeformLayoutForBudget(1400).cells < layout.cells,
    '小核心的细胞数量必须少于大核心'
  );

  // 内外两层：内层细胞半径明显更小，提供体积与前后遮挡，而不是一层空心壳。
  let inner = 0;
  let outer = 0;
  for (let index = 0; index < first.cells.count; index += 1) {
    const x = first.cells.base[index * 3];
    const y = first.cells.base[index * 3 + 1];
    const z = first.cells.base[index * 3 + 2];
    const length = Math.hypot(x, y, z);
    assert.ok(length > 0.2 && length <= 1.05, `细胞基点必须落在球体内，实际 ${length}`);
    if (first.cells.radii[index] < 0.75) inner += 1;
    else outer += 1;
  }
  assert.ok(inner > 0, '必须有内层细胞');
  assert.ok(outer > inner, '外层细胞必须多于内层');
});

test('神经纤维连接真实细胞：无向边去重、两端数据齐备、脉冲相位可用', () => {
  const lifeform = buildNeuralLifeform(16000);
  const { fibers, cells } = lifeform;
  assert.equal(fibers.vertexCount, fibers.edgeCount * 2, '每条纤维两个顶点');
  assert.ok(
    fibers.edgeCount >= cells.count && fibers.edgeCount <= cells.count * 3,
    `纤维数量应在细胞数量与三倍之间，实际 ${fibers.edgeCount}`
  );

  const cellKeys = new Set<string>();
  for (let index = 0; index < cells.count; index += 1) {
    cellKeys.add([
      cells.base[index * 3],
      cells.base[index * 3 + 1],
      cells.base[index * 3 + 2]
    ].join(','));
  }

  const seen = new Set<string>();
  for (let edge = 0; edge < fibers.edgeCount; edge += 1) {
    const ax = fibers.baseA[edge * 6];
    const ay = fibers.baseA[edge * 6 + 1];
    const az = fibers.baseA[edge * 6 + 2];
    const bx = fibers.baseB[edge * 6];
    const by = fibers.baseB[edge * 6 + 1];
    const bz = fibers.baseB[edge * 6 + 2];
    const aKey = [ax, ay, az].join(',');
    const bKey = [bx, by, bz].join(',');
    assert.ok(cellKeys.has(aKey) && cellKeys.has(bKey), '纤维端点必须是真实细胞基点');
    assert.notEqual(aKey, bKey, '纤维不能自连');
    // 同一缓冲被线通道与脉冲通道共用：两侧顶点的端点数据必须一致。
    assert.equal(fibers.baseA[edge * 6 + 3], ax, '第二个顶点必须复用同一端点数据');
    assert.equal(fibers.baseB[edge * 6 + 4], by);

    const key = aKey < bKey ? `${aKey}|${bKey}` : `${bKey}|${aKey}`;
    assert.equal(seen.has(key), false, '同一对细胞只能有一条纤维');
    seen.add(key);

    assert.ok(fibers.phases[edge * 2] >= 0 && fibers.phases[edge * 2] < 1, '脉冲相位必须在 0–1');
    assert.ok(fibers.tones[edge * 2] >= 0.45 && fibers.tones[edge * 2] <= 1, '纤维浓度必须受控');
  }
});

const restActivity: NeuralActivity = {
  time: 0,
  energy: 0.82,
  contraction: 0,
  expansion: 0,
  level: 0,
  pulse: 0,
  burst: 0,
  error: 0,
  gazeX: 0,
  gazeY: 0
};
const restCell: [number, number, number] = [0.62, 0.48, 0.22];
const cellLength = (activity: NeuralActivity, phase = 0.7) =>
  Math.hypot(...animateNeuralCell(restCell, phase, activity));

test('细胞运动是纯函数：呼吸有界，状态与点击冲击方向正确', () => {
  const base: NeuralActivity = { ...restActivity, time: 1.5 };
  const first = animateNeuralCell(restCell, 0.7, base);
  const second = animateNeuralCell(restCell, 0.7, base);
  assert.deepEqual(first, second, '同一输入必须给出同一位置');
  assert.notDeepEqual(first, animateNeuralCell(restCell, 0.7, { ...base, time: 2.4 }), '时间推进必须移动细胞');

  const rest = Math.hypot(...restCell);
  let shortest = Number.POSITIVE_INFINITY;
  let longest = 0;
  for (let step = 0; step < 300; step += 1) {
    const length = cellLength({ ...restActivity, time: step * 0.05 });
    shortest = Math.min(shortest, length);
    longest = Math.max(longest, length);
    assert.ok(Number.isFinite(length));
  }
  assert.ok(shortest > rest * 0.8 && longest < rest * 1.2, '呼吸必须在小范围内起伏，不能突然放大或塌缩');

  const neutral = cellLength(base);
  const contracted = cellLength({ ...base, contraction: 1 });
  const expanded = cellLength({ ...base, expansion: 1 });
  const failed = cellLength({ ...base, error: 1 });
  const burst = cellLength({ ...base, burst: 1 });
  assert.ok(contracted < neutral, '思考聚拢必须让细胞向内收');
  assert.ok(expanded > neutral, '成功舒展必须让细胞向外扩');
  assert.ok(failed < neutral, '失败应略微收缩而不是膨胀');
  assert.ok(burst > neutral, '点击冲击必须先放大再衰减');

  // 真实能量：能量越高，同一时刻的尺度越大。
  assert.ok(cellLength({ ...base, energy: 1 }) > cellLength({ ...base, energy: 0 }));

  // 指针局部鼓起只影响朝向指针的一侧，不整体平移结构。
  const gaze = animateNeuralCell(restCell, 0.7, { ...base, gazeX: 1, gazeY: 0.4 });
  assert.ok(gaze.every(value => Number.isFinite(value)));
  assert.notDeepEqual(gaze, first);
});

test('点击命中判定只认生命体外接圆内的指针位置', () => {
  const rect = { left: 100, top: 50, width: 300, height: 300 };
  assert.equal(isInsideLifeform(rect, 250, 200), true, '中心必然命中');
  assert.equal(isInsideLifeform(rect, 250, 69), true, '圆内位置必须命中');
  assert.equal(isInsideLifeform(rect, 105, 55), false, '矩形角落在外接圆之外');
  assert.equal(isInsideLifeform(rect, 1, 1), false, '画布外不得触发');
  assert.equal(isInsideLifeform({ left: 0, top: 0, width: 0, height: 0 }, 10, 10), false, '零尺寸画布不得命中');
});

test('渲染器用点精灵 + 线段绘制四层结构：细胞、纤维、脉冲、尘埃，墨色普通混合', () => {
  assert.match(engineSource, /gl\.POINTS/);
  assert.match(engineSource, /gl\.LINES/);
  assert.match(engineSource, /drawArrays\(gl\.LINES, 0, data\.fibers\.vertexCount\)/);
  assert.match(engineSource, /drawArrays\(gl\.POINTS, 0, data\.dust\.count\)/);
  assert.match(engineSource, /drawArrays\(gl\.POINTS, 0, data\.cells\.count\)/);
  assert.match(engineSource, /drawArrays\(gl\.POINTS, 0, pulseCount\)/);
  // 脉冲复用纤维缓冲：同一份几何、不同 stride，不复制第二套顶点数据。
  assert.match(engineSource, /FIBER_STRIDE/);
  assert.match(engineSource, /bindVertexArray/);
  // 纯白背景上的墨色结构必须用普通 alpha 混合，不能用加法混合（加法会在白底上过曝成一片白）。
  assert.match(engineSource, /blendFunc\(gl\.ONE, gl\.ONE_MINUS_SRC_ALPHA\)/);
  assert.doesNotMatch(engineSource, /blendFunc\(gl\.ONE, gl\.ONE\)/);
  assert.match(engineSource, /uniform1fv\(programUniforms\.state, weights\)/);
  assert.match(engineSource, /MODA_CORE_STATES/);
  assert.match(engineSource, /getContext\('webgl2'/);
  assert.match(engineSource, /webglcontextlost/);
  assert.match(engineSource, /onContextLost/);
  assert.match(engineSource, /requestAnimationFrame/);
  assert.match(engineSource, /modaCoreParticleCountForSize/);
  assert.match(engineSource, /setParticleCount/);
  assert.match(engineSource, /readLife/);
  assert.match(engineSource, /uniform1f\(programUniforms\.burst/);
  assert.match(engineSource, /uniform4f\(programUniforms\.life/);
  // 指针交互：姿态视差与点击冲击都绑在 document 上，覆盖整页范围。
  assert.match(engineSource, /document\.addEventListener\('pointermove'/);
  assert.match(engineSource, /document\.addEventListener\('pointerdown'/);
  assert.match(engineSource, /isInsideLifeform/);
  assert.match(engineSource, /pointer\.targetX/);
  assert.doesNotMatch(engineSource, /createTexture|bindTexture|texImage2D/);

  assert.match(shadersSource, /gl_PointSize/);
  assert.match(shadersSource, /gl_PointCoord/);
  assert.match(shadersSource, /uniform float uState\[6\]/);
  assert.match(shadersSource, /uniform float uLevel/);
  assert.match(shadersSource, /uniform float uPulse/);
  assert.match(shadersSource, /uniform float uGaze/);
  assert.match(shadersSource, /uniform float uBurst/);
  assert.match(shadersSource, /uniform vec4 uLife/);
  assert.match(shadersSource, /uniform float uEnergy/);
  assert.match(shadersSource, /uniform float uFiberAlpha/);
  assert.match(shadersSource, /uniform float uFiberPass/);
  // 纤维与细胞共用同一套位置算法，端点必须精确贴合细胞。
  assert.match(shadersSource, /vec3 lifeformPoint\(vec3 base, float phase\)/);
  assert.match(shadersSource, /lifeformPoint\(aBaseA, aSeedA\.x \* 6\.2831853\)/);
  assert.match(shadersSource, /lifeformPoint\(aBaseB, aSeedB\.x \* 6\.2831853\)/);
  assert.match(shadersSource, /float swirl = \(0\.16 \+ 0\.10 \* radius\) \* sin\(uTime \* 0\.37\)/);
  // 指针局部鼓起 + 姿态视差。
  assert.match(shadersSource, /vec3 pointerDir = normalize\(vec3\(uPointer \* uGaze, 0\.55\)\)/);
  assert.match(shadersSource, /uPointer\.x \* uGaze \* 0\.46/);
  // 细胞逐像素球面着色：边缘环 + 核心 + 高光，而不是一张贴图。
  assert.match(shadersSource, /float rim = pow\(1\.0 - z, 1\.5\)/);
  assert.match(shadersSource, /float specular = pow\(max\(dot\(normal/);
  assert.match(shadersSource, /uniform vec3 uHighlight/);
  assert.doesNotMatch(shadersSource, /mix\(ink, vec3\(1\.0\)/);
  assert.doesNotMatch(shadersSource, /texture\(|sampler2D/);
});

test('视觉终态：纯白背景、只有神经生命体、白底灰阶细胞与指针交互', () => {
  const homeSource = read('src/apps/merchant-admin-common/components/merchant/MerchantAiHome.tsx');
  const commonCss = read('src/apps/merchant-admin-common.css');
  const miniStyles = read('merchant-miniprogram/pages/assistant/index.wxss');

  // 纯白舞台：不再有深色径向渐变底，文案改为深色。
  // 只锁定语义：白底圆形舞台。圆角 token 随排版迭代微调（当前 rounded-3xl = 24px）。
  assert.match(homeSource, /modaui-hero relative overflow-hidden rounded-(?:3xl|\[26px\]) bg-white/);
  assert.doesNotMatch(homeSource, /modaui-hero[^"]*radial-gradient/);
  // 只锁定语义：深色标题 + 响应式字号。具体字号随排版迭代微调（当前 22px / sm:28px）。
  assert.match(homeSource, /<h1 className="[^"]*text-neutral-950[^"]*sm:text-\[\d+px\][^"]*">/);
  assert.match(commonCss, /\.modaui-core-fallback[\s\S]*?background-image:/);

  // 只有生命体：没有头像、五官、脖子、肩膀、身体或底座光晕，也不加载任何图片。
  assert.match(lifeformSource, /没有头像、五官、身体或底座/);
  assert.match(lifeformSource, /不加载任何图片或纹理/);
  assert.doesNotMatch(lifeformSource, /headSurfacePoint|eyeZone|脸颊|下颌/);
  assert.doesNotMatch(miniCore, /headSurfacePoint|脸颊|下颌/);

  // 白底灰阶：近黑墨色结构 + 中灰纤维 + 浅灰高光，禁止纯白粒子（会把墨色打成白洞）。
  assert.match(miniCore, /rgba\(17, 17, 19, /);
  assert.match(miniCore, /rgba\(158, 158, 164, /);
  assert.doesNotMatch(miniCore, /rgba\(255, 255, 255/);
  assert.match(miniStyles, /\.core-stage \{[\s\S]*?background: #ffffff;/);
  assert.match(miniStyles, /\.core-greeting-line \{[\s\S]*?color: #141416;/);
});

test('视觉状态来自真实事件，语音与麦克风能力复用既有实现', () => {
  assert.match(componentSource, /data-modaui-core-state=\{state\}/);
  assert.match(componentSource, /data-modaui-core=\{fallback \? 'css' : 'webgl'\}/);
  assert.match(componentSource, /modaui-core-fallback/);
  assert.match(componentSource, /IntersectionObserver/);
  assert.match(componentSource, /ResizeObserver/);

  assert.match(audioSource, /getUserMedia/);
  assert.match(audioSource, /AnalyserNode|createAnalyser/);
  assert.match(audioSource, /track\.stop\(\)/);
  assert.match(audioSource, /speechSynthesis/);
  assert.match(audioSource, /onboundary/);
});

test('商家小程序用 Canvas 2D 绘制同一神经生命体与同一欢迎语', () => {
  assert.match(miniWelcome, /<canvas type="2d" id="modaui-core" class="core-canvas">/);
  assert.match(miniWelcome, /你好，/);
  assert.match(miniWelcome, /我是 MODAUI。/);
  assert.doesNotMatch(miniWelcome, /今天想做什么/);

  // 几何与运动必须镜像 neuralLifeform.ts：同一固定种子、同一细胞/纤维/尘埃构建顺序。
  assert.match(miniCore, /function buildCells\(count\)/);
  assert.match(miniCore, /function buildFibers\(cells\)/);
  assert.match(miniCore, /function buildDust\(count\)/);
  assert.match(miniCore, /function buildLifeform\(budget\)/);
  assert.match(miniCore, /function animateCell\(base, phase, activity, out\)/);
  assert.match(miniCore, /SEED = 20261027/);
  assert.match(miniCore, /GOLDEN_ANGLE = Math\.PI \* \(3 - Math\.sqrt\(5\)\)/);
  // 与 WebGL 端同一透视：同 FOV、同观察距离、同投影留白（留白唯一来源是 BRAIN_BUDGET）。
  assert.match(miniCore, /const FOV = \(32 \* Math\.PI\) \/ 180;/);
  assert.match(miniCore, /const VIEW_DISTANCE = 3\.55;/);
  assert.match(miniCore, /const PROJECTION_SCALE = BRAIN_BUDGET\.projectionScale;/);
  assert.match(engineSource, /const FOV_DEGREES = 32;/);
  assert.match(engineSource, /const PROJECTION_SCALE = BRAIN_BUDGET\.projectionScale;/);
  assert.equal(BRAIN_BUDGET.projectionScale, 0.76);
  assert.match(shadersSource, /viewPos\.z -= 3\.55;/);
  // 纤维浓度基线两端同值，避免一端纤维细到看不见。
  assert.match(engineSource, /0\.2 \+ 0\.12 \* life\.energy/);
  assert.match(miniCore, /inkColor\(\(0\.2 \+ 0\.12 \* activity\.energy\)/);
  assert.match(miniCore, /module\.exports = \{\s*createModaCore/);
  assert.match(miniCore, /clearRect/);
  assert.match(miniCore, /requestAnimationFrame/);
  assert.match(miniCore, /STATES/);
  assert.doesNotMatch(miniCore, /\.(png|jpe?g|webp|gif)/i);

  assert.match(miniPage, /createModaCore/);
  assert.match(miniPage, /mountModaCore\(\)/);
  assert.match(miniPage, /unmountModaCore\(\)/);
});

test('小程序 Canvas 2D 核心可以真实逐帧绘制出完整神经生命体', () => {
  const require = createRequire(import.meta.url);
  const { createModaCore } = require('../merchant-miniprogram/utils/moda-core.js') as {
    createModaCore: (options: {
      canvas: unknown;
      width: number;
      height: number;
      pixelRatio: number;
      readState: () => string;
    }) => {
      start: () => void;
      stop: () => void;
      dispose: () => void;
      getStats: () => {
        particleCount: number;
        cellCount: number;
        dustCount: number;
        fiberCount: number;
        pulseCount: number;
        frames: number;
        state: string;
      };
    };
  };

  const drawn: Array<{ x: number; y: number; radius: number }> = [];
  let strokes = 0;
  let scheduled: ((timestamp: number) => void) | null = null;
  const context = {
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 0,
    setTransform: () => undefined,
    clearRect: () => undefined,
    beginPath: () => undefined,
    fill: () => undefined,
    stroke: () => { strokes += 1; },
    moveTo: () => undefined,
    lineTo: () => undefined,
    arc: (x: number, y: number, radius: number) => { drawn.push({ x, y, radius }); }
  };
  const canvas = {
    width: 0,
    height: 0,
    getContext: () => context,
    requestAnimationFrame: (callback: (timestamp: number) => void) => { scheduled = callback; return 1; },
    cancelAnimationFrame: () => undefined
  };

  const core = createModaCore({ canvas, width: 320, height: 260, pixelRatio: 2, readState: () => 'thinking' });
  core.start();
  assert.ok(scheduled, 'requestAnimationFrame 应被排入一帧');
  (scheduled as (timestamp: number) => void)(16);
  const firstFrame = drawn.slice();
  // 连续推进 40 帧：状态权重应收敛到页面传入的 thinking，且每帧都继续请求下一帧。
  for (let frame = 1; frame <= 40; frame += 1) {
    assert.ok(scheduled, `第 ${frame} 帧后必须继续排帧`);
    (scheduled as (timestamp: number) => void)(16 + frame * 16);
  }
  const stats = core.getStats();
  core.dispose();

  assert.ok(firstFrame.length > 300, '一帧应绘制三百个以上粒子');
  const xs = firstFrame.map(point => point.x);
  const ys = firstFrame.map(point => point.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  assert.ok(minX >= 0 && maxX <= 320, `粒子应落在画布水平范围内，实际 ${minX.toFixed(1)}–${maxX.toFixed(1)}`);
  assert.ok(minY >= 0 && maxY <= 260, `粒子应落在画布垂直范围内，实际 ${minY.toFixed(1)}–${maxY.toFixed(1)}`);
  assert.ok(maxY - minY > 140, '生命体应覆盖足够高度，而不是聚成一团');
  assert.ok(maxX - minX > 100, '生命体应有足够宽度');
  assert.ok(strokes > 0, '神经纤维必须真实描边，不能只有细胞点');
  assert.equal(canvas.width, 640, '画布应按像素比放大');

  assert.ok(stats.frames >= 41, `应真实推进每一帧，实际 ${stats.frames}`);
  assert.ok(stats.cellCount > 0 && stats.fiberCount > 0 && stats.dustCount > 0 && stats.pulseCount > 0);
  assert.equal(
    stats.particleCount,
    stats.cellCount + stats.dustCount,
    '粒子总量必须等于细胞 + 尘埃；脉冲复用纤维缓冲，不计入粒子预算'
  );
  assert.equal(stats.state, 'thinking', '状态权重应收敛到页面传入的真实状态');
});

const lifeSource = read(`${coreDir}/modaCoreLife.ts`);
const stageSource = read(`${coreDir}/modaCoreStage.ts`);
const stageMathSource = read(`${coreDir}/modaCoreStageMath.ts`);
const stageComponentSource = read(`${coreDir}/ModaCoreStage.tsx`);
const chatHomeSource = read('src/apps/merchant-admin-common/components/merchant/MerchantAiHome.tsx');
const portalSource = read('src/apps/merchant-admin-web/MerchantPortal.tsx');

test('数字生命事件通道只由真实输入/请求/文本片段驱动', async () => {
  const { createModaCoreLife } = await import('../src/apps/merchant-admin-common/components/merchant/modaui/modaCoreLife');
  let clock = 0;
  const life = createModaCoreLife({ now: () => clock });

  const idle = life.sample(clock);
  assert.equal(idle.phase, 'idle');
  assert.ok(idle.contraction < 0.01, '待机时不应聚拢');

  life.emit({ type: 'input:change', length: 3 });
  for (let index = 0; index < 40; index += 1) { clock += 16; life.sample(clock); }
  const focus = life.getFrame();
  assert.equal(focus.phase, 'focus');
  assert.ok(focus.contraction > 0.4, `真实输入应让粒子聚拢，实际 ${focus.contraction}`);

  life.emit({ type: 'message:submit' });
  for (let index = 0; index < 40; index += 1) { clock += 16; life.sample(clock); }
  const sending = life.getFrame();
  assert.equal(sending.phase, 'sending');
  assert.ok(sending.forward > 0.6, `提交后核心应向前靠近，实际 ${sending.forward}`);

  for (let index = 0; index < 150; index += 1) { clock += 16; life.sample(clock); }
  const waiting = life.getFrame();
  assert.ok(waiting.energy < sending.energy - 0.2, '真实等待期间运动应自然减弱');

  life.emit({ type: 'response:chunk', chars: 6 });
  clock += 16; life.sample(clock);
  clock += 16; life.sample(clock);
  assert.ok(life.getFrame().pulse > 0.5, '真实片段到达应有一次脉冲');
  for (let index = 0; index < 20; index += 1) { clock += 16; life.sample(clock); }
  const responding = life.getFrame();
  assert.equal(responding.phase, 'responding');
  assert.ok(responding.energy > waiting.energy + 0.2, `片段到达后活动度应回升，实际 ${responding.energy}`);
  assert.ok(responding.flow > 0.3, `生成回答时应出现定向流动，实际 ${responding.flow}`);

  life.emit({ type: 'response:complete' });
  for (let index = 0; index < 20; index += 1) { clock += 16; life.sample(clock); }
  assert.equal(life.getPhase(), 'complete');
  for (let index = 0; index < 130; index += 1) { clock += 16; life.sample(clock); }
  const settled = life.getFrame();
  assert.equal(settled.phase, 'idle');
  assert.ok(settled.forward < 0.05, '回答结束后核心应回到原位');
  assert.ok(settled.flow < 0.05, '回答结束后流动应停止');
  life.dispose();
});

test('失败与中断由真实事件触发，不依赖定时器假装状态', () => {
  let clock = 0;
  const life = createModaCoreLifeFactory({ now: () => clock });
  life.emit({ type: 'message:submit' });
  clock += 16; life.sample(clock);
  life.emit({ type: 'response:error' });
  clock += 16; life.sample(clock);
  assert.equal(life.getPhase(), 'error');
  clock += 2000; life.sample(clock);
  assert.equal(life.getPhase(), 'idle');

  life.emit({ type: 'response:abort' });
  assert.equal(life.getPhase(), 'complete');
  life.dispose();
  assert.doesNotMatch(lifeSource, /setInterval|setTimeout/, '事件通道自身不得用定时器伪造状态');
});

test('聊天界面与桌面面板把真实对话事件接到同一套粒子', () => {
  assert.match(chatHomeSource, /createModaCoreLife/);
  assert.match(chatHomeSource, /coreLife\.emit\(\{ type: 'input:change'/);
  assert.match(chatHomeSource, /coreLife\.emit\(\{ type: 'message:submit' \}\)/);
  assert.match(chatHomeSource, /coreLife\.emit\(\{ type: 'response:chunk'/);
  assert.match(chatHomeSource, /coreLife\.emit\(\{ type: 'response:complete' \}\)/);
  assert.match(chatHomeSource, /coreLife\.emit\(\{ type: 'response:error' \}\)/);
  assert.match(chatHomeSource, /revealAssistantReply\([\s\S]{0,80}result\.messageId,[\s\S]{0,40}result\.reply/);
  assert.match(chatHomeSource, /life=\{coreLife\}/);

  assert.match(portalSource, /createModaCoreLife/);
  assert.match(portalSource, /assistantCoreLife\.emit\(\{ type: 'message:submit' \}\)/);
  assert.match(portalSource, /assistantCoreLife\.emit\(\{ type: 'response:chunk'/);
  assert.match(portalSource, /revealAssistantAnswer\(result\.messageId, reply, \(\) => flashAssistantCoreSuccess\(\)\)/);
  assert.match(portalSource, /life=\{assistantCoreLife\}/);

  assert.match(engineSource, /readLife/);
  assert.match(engineSource, /uniform4f\(programUniforms\.life/);
  assert.match(shadersSource, /uniform vec4 uLife;/);
  assert.match(shadersSource, /uniform float uEnergy;/);
  // 提交后的前移不再是 0.42 直推，而是运动控制器给出的有界深度通道。
  assert.doesNotMatch(shadersSource, /uLife\.y, 0\.0, 1\.0\) \* 0\.42/);
  assert.match(shadersSource, /viewPos\.z \+= uBody\.z;/);
  assert.match(engineSource, /uniform4f\(programUniforms\.body,/);
  assert.match(componentSource, /data-modaui-core-phase/);
});

test('对话内嵌舞台：同一画布靠搬迁宿主落位，锚点优先回复位置，粒子预算随显示尺寸变化', async () => {
  const { modaCoreParticleCountForSize, pickModaCoreAnchorKind, stepModaCoreTravel } = await import(
    '../src/apps/merchant-admin-common/components/merchant/modaui/modaCoreStageMath'
  );

  assert.equal(pickModaCoreAnchorKind([]), null);
  assert.equal(pickModaCoreAnchorKind(['hero']), 'hero');
  assert.equal(pickModaCoreAnchorKind(['hero', 'reply']), 'reply', '有回复锚点时核心必须在回复位置');

  const tiny = modaCoreParticleCountForSize(32, false);
  const small = modaCoreParticleCountForSize(72, false);
  const hero = modaCoreParticleCountForSize(300, false);
  assert.ok(tiny >= 900 && tiny < 1800, `32px 小核心应采用千级粒子，实际 ${tiny}`);
  assert.ok(small > tiny && small < hero, '粒子预算必须随显示尺寸单调变化');
  assert.equal(hero, 16000, '桌面大核心保持原有密度');
  assert.equal(modaCoreParticleCountForSize(300, true), 9000, '手机端大核心保持原有密度');

  const target = { x: 220, y: 640, size: 32 };
  let rect = { x: 0, y: 0, size: 300 };
  let settled = false;
  let previousDistance = Number.POSITIVE_INFINITY;
  for (let step = 0; step < 120 && !settled; step += 1) {
    const next = stepModaCoreTravel(rect, target, 1 / 60);
    rect = next.rect;
    settled = next.settled;
    const distance = Math.abs(rect.x - target.x) + Math.abs(rect.y - target.y) + Math.abs(rect.size - target.size);
    assert.ok(distance <= previousDistance + 1e-6, '位移必须单调靠近目标，不能回弹');
    previousDistance = distance;
    assert.ok(rect.size >= target.size - 0.001, '核心不能缩到比目标更小');
  }
  assert.ok(settled, '两秒内必须完成落位');
  assert.deepEqual(rect, target);
});

test('舞台只移动宿主元素：画布与 WebGL 上下文不重建，也没有第二套渲染器', () => {
  assert.match(stageComponentSource, /createModaCoreStage/);
  assert.match(stageComponentSource, /createPortal/);
  assert.match(stageComponentSource, /registerAnchor/);
  assert.doesNotMatch(stageComponentSource, /<canvas|getContext\(/, '画布只能由 ModaUICore 创建一次');

  assert.match(stageSource, /getBoundingClientRect/);
  assert.match(stageSource, /appendChild\(host\)/);
  assert.match(stageSource, /position = 'fixed'/);
  assert.match(stageSource, /position = 'absolute'/);
  assert.match(stageSource, /queueMicrotask/);
  assert.match(stageSource, /cancelAnimationFrame/);
  assert.doesNotMatch(stageSource, /setInterval|setTimeout/, '舞台不得用定时器伪造移动');
  assert.doesNotMatch(stageSource, /getContext\(|createProgram|createTexture|new Image/);
  for (const source of [stageSource, stageMathSource, stageComponentSource]) {
    assert.doesNotMatch(source, /\.(png|jpe?g|webp|gif|svg)/i, '舞台层不得引用任何图片资源');
  }

  assert.match(stageMathSource, /MODA_CORE_DESKTOP_MAX_PARTICLES = 16000/);
  assert.match(stageMathSource, /MODA_CORE_MOBILE_MAX_PARTICLES = 9000/);

  // 两个聊天入口都改成「同一个 provider + 两种锚点」，并删掉了静态头像点。
  for (const source of [chatHomeSource, portalSource]) {
    assert.match(source, /<ModaCoreStageProvider/);
    assert.match(source, /kind="hero"/);
    assert.match(source, /kind="reply"/);
    assert.match(source, /float-left mr-2\.5 mt-0\.5 h-8 w-8/, '小头部必须悬浮在回复首行左侧');
    assert.doesNotMatch(source, /<ModaUICore/, '不允许在聊天界面再挂第二个核心');
  }
  assert.doesNotMatch(chatHomeSource, /radial-gradient/, '不允许用渐变圆点冒充粒子头像');
});

test('打字不会打断正在生成的回答，两个聊天入口只在首页阶段响应按键', async () => {
  let clock = 0;
  const life = createModaCoreLifeFactory({ now: () => clock });
  life.emit({ type: 'message:submit' });
  life.emit({ type: 'response:chunk', chars: 4 });
  for (let index = 0; index < 10; index += 1) { clock += 16; life.sample(clock); }
  assert.equal(life.getPhase(), 'responding');

  life.emit({ type: 'input:change', length: 6 });
  clock += 16; life.sample(clock);
  assert.equal(life.getPhase(), 'responding', '打字不能覆盖正在生成的回答');
  life.emit({ type: 'input:focus' });
  assert.equal(life.getPhase(), 'responding');
  life.dispose();

  assert.match(lifeSource, /phase === 'idle' \|\| phase === 'focus'/);
  assert.match(chatHomeSource, /if \(!messages\.length\) coreLife\.emit\(\{ type: 'input:change'/);
  assert.match(portalSource, /if \(!assistantHistory\.length\) assistantCoreLife\.emit\(\{ type: 'input:change'/);
});


/** 构造一帧行为输入：默认待机、自由舞台。 */
const brainInput = (overrides: Partial<BrainBehaviorInput> = {}): BrainBehaviorInput => ({
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
  presentation: 'stage',
  reduced: false,
  ...overrides
});

const runBrain = (
  seconds: number,
  input: BrainBehaviorInput,
  controller = createModaBrainBehavior(),
  fps = 60
) => {
  const frames: ReturnType<typeof controller.update>[] = [];
  const steps = Math.round(seconds * fps);
  for (let index = 0; index < steps; index += 1) frames.push(controller.update(1 / fps, input));
  return frames;
};

const span = (values: number[]) => Math.max(...values) - Math.min(...values);
const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;

const correlation = (left: number[], right: number[]) => {
  const leftMean = mean(left);
  const rightMean = mean(right);
  let covariance = 0;
  let leftVariance = 0;
  let rightVariance = 0;
  for (let index = 0; index < left.length; index += 1) {
    const a = left[index] - leftMean;
    const b = right[index] - rightMean;
    covariance += a * b;
    leftVariance += a * a;
    rightVariance += b * b;
  }
  return covariance / Math.sqrt(leftVariance * rightVariance || 1);
};

/** 1 世界单位在 300px 画布上的像素数（含投影留白）。 */
const PX_PER_UNIT_300 = (300 / 2) / BRAIN_BUDGET.visibleHalfHeight * BRAIN_BUDGET.projectionScale;


test('生命行为控制器：固定种子可复现，任何状态都不越界', () => {
  const first = createModaBrainBehavior();
  const second = createModaBrainBehavior();
  const script = [
    brainInput(),
    brainInput({ idle: 0, listening: 1, energy: 0.5 }),
    brainInput({ idle: 0, thinking: 1, energy: 0.95 }),
    brainInput({ idle: 0, responding: 1, energy: 1, forward: 0.62 }),
    brainInput({ idle: 0, error: 1, energy: 0.2 }),
    brainInput({ idle: 0, success: 1, energy: 0.8 })
  ];
  const stepsPerState = 900;
  for (let index = 0; index < stepsPerState * script.length; index += 1) {
    const input = script[Math.floor(index / stepsPerState)];
    const a = first.update(1 / 60, input);
    const b = second.update(1 / 60, input);
    assert.deepEqual(a, b, '同一输入序列必须逐帧相同（固定种子）');
    assert.ok(Math.abs(a.x) <= BRAIN_LIMITS.offsetX + 1e-9, `x 越界 ${a.x}`);
    assert.ok(Math.abs(a.y) <= BRAIN_LIMITS.offsetY + 1e-9, `y 越界 ${a.y}`);
    assert.ok(a.depth >= BRAIN_LIMITS.depthFar - 1e-9 && a.depth <= BRAIN_LIMITS.depthNear + 1e-9);
    // 构图软限幅会额外收缩输出尺寸，因此下限按 0.7 放宽（见 §18.5）。
    assert.ok(a.scale >= BRAIN_LIMITS.scaleMin * 0.7 - 1e-9, `scale 过低 ${a.scale}`);
    assert.ok(a.scale <= BRAIN_LIMITS.scaleMax + 1e-9);
    assert.ok(Math.abs(a.tiltX) <= BRAIN_LIMITS.tiltX + 1e-9);
    assert.ok(Math.abs(a.tiltY) <= BRAIN_LIMITS.tiltY + 1e-9);
    assert.ok(Math.abs(a.tiltZ) <= BRAIN_LIMITS.tiltZ + 1e-9);
    assert.ok(a.extent <= BRAIN_BUDGET.maxExtent + 1e-6, `构图越界 ${a.extent}`);
    assert.ok(a.speed < 4, `单帧速度不可能这么大 ${a.speed}`);
    for (const value of Object.values(a.dynamics)) {
      assert.ok(value >= 0 && value <= 1, `内部动态必须归一化 ${value}`);
    }
  }
  assert.equal(BRAIN_SEED, 20261027);
});

test('生命行为控制器：状态切换继承位姿，逐帧位移不超过 2px（300px 核心）', () => {
  const controller = createModaBrainBehavior();
  const plan: Array<[number, BrainBehaviorInput]> = [
    [5, brainInput()],
    [7, brainInput({ idle: 0, thinking: 1, energy: 0.95 })],
    [9, brainInput({ idle: 0, responding: 1, energy: 1, forward: 0.62 })],
    [5, brainInput()]
  ];
  let previous = controller.getFrame();
  const jumps = { x: 0, y: 0, depth: 0, scale: 0, tiltY: 0 };
  const centers: number[] = [];
  for (const [seconds, input] of plan) {
    for (const frame of runBrain(seconds, input, controller)) {
      jumps.x = Math.max(jumps.x, Math.abs(frame.x - previous.x));
      jumps.y = Math.max(jumps.y, Math.abs(frame.y - previous.y));
      jumps.depth = Math.max(jumps.depth, Math.abs(frame.depth - previous.depth));
      jumps.scale = Math.max(jumps.scale, Math.abs(frame.scale - previous.scale));
      jumps.tiltY = Math.max(jumps.tiltY, Math.abs(frame.tiltY - previous.tiltY));
      centers.push(frame.x * PX_PER_UNIT_300);
      previous = frame;
    }
  }
  assert.ok(jumps.x * PX_PER_UNIT_300 <= 2, `横向单帧位移过大 ${jumps.x * PX_PER_UNIT_300}px`);
  assert.ok(jumps.y * PX_PER_UNIT_300 <= 2, `纵向单帧位移过大 ${jumps.y * PX_PER_UNIT_300}px`);
  assert.ok(jumps.depth <= 0.02, `深度单帧跳变过大 ${jumps.depth}`);
  assert.ok(jumps.scale <= 0.02, `尺寸单帧跳变过大 ${jumps.scale}`);
  assert.ok(jumps.tiltY <= 0.02, `倾斜单帧跳变过大 ${jumps.tiltY}`);
  // 连续 26 秒里中心位置必须真的改变过，不能挂在一个点上。
  assert.ok(span(centers) >= 20, `主体位移不可见（${span(centers)}px）`);
});


test('自主生命：待机 60 秒持续运动、多次换位、有停顿且不机械重复', () => {
  const frames = runBrain(60, brainInput());
  const xs = frames.map(frame => frame.x * PX_PER_UNIT_300);
  const ys = frames.map(frame => frame.y * PX_PER_UNIT_300);

  // 1) 不聊天时也必须有可见的自主运动（这是 V8 与 V7.1 最大的差别）。
  assert.ok(span(xs) >= 40, `待机横向位移不足（${span(xs).toFixed(1)}px）`);
  assert.ok(span(ys) >= 25, `待机纵向位移不足（${span(ys).toFixed(1)}px）`);

  // 2) 行为序列：换位发生多次，出现的动作种类足够多。
  const starts: string[] = [frames[0].behavior];
  for (let index = 1; index < frames.length; index += 1) {
    if (frames[index].behavior !== frames[index - 1].behavior) starts.push(frames[index].behavior);
  }
  const travels = starts.filter(id => id === 'travel').length;
  // 待机 60 秒至少两次真正换位（实测 2–3 次；换位有 7.5s 冷却，不会被刷成抖动）。
  assert.ok(travels >= 2, `60 秒内宏观换位不足（${travels} 次）`);
  assert.ok(new Set(starts).size >= 5, `行为种类太少（${[...new Set(starts)].join(',')}）`);

  // 3) 重复抑制：不允许连续三次同一个动作。
  for (let index = 2; index < starts.length; index += 1) {
    const triple = starts[index] === starts[index - 1] && starts[index] === starts[index - 2];
    assert.ok(!triple, `连续三次重复同一行为：${starts[index]}`);
  }

  // 4) 节奏：必须有停顿帧，而不是永远在动。
  const dwellRatio = frames.filter(frame => frame.dwelling).length / frames.length;
  assert.ok(dwellRatio > 0.05, `缺少停顿（dwelling ${(dwellRatio * 100).toFixed(1)}%）`);

  // 5) 速度：平均在动，且从不失控。
  const speeds = frames.map(frame => frame.speed);
  assert.ok(mean(speeds) > 0.004, `平均速度过低（${mean(speeds)}）`);
  assert.ok(Math.max(...speeds) < 2, `速度失控（${Math.max(...speeds)}）`);

  // 6) 行为不是固定轨道：前后两个 30 秒片段的轨迹不能重合。
  const firstHalf = xs.slice(0, 1800);
  const secondHalf = xs.slice(1800);
  assert.ok(
    Math.abs(mean(firstHalf) - mean(secondHalf)) + Math.abs(span(firstHalf) - span(secondHalf)) > 1,
    '前后两段的位移统计完全一致，说明在跑固定轨道'
  );
});

test('自主生命：不同对话轮次不重置为同一套运动轨迹', () => {
  const controller = createModaBrainBehavior();
  const rounds: number[][] = [];
  for (let round = 0; round < 3; round += 1) {
    const session = [
      [6, brainInput({ idle: 0, thinking: 1, energy: 0.9 })],
      [7, brainInput({ idle: 0, responding: 1, energy: 1, forward: 0.6 })],
      [5, brainInput()]
    ] as Array<[number, BrainBehaviorInput]>;
    const xs: number[] = [];
    for (const [seconds, input] of session) {
      for (const frame of runBrain(seconds, input, controller)) xs.push(frame.x);
    }
    rounds.push(xs);
  }
  const signature = (values: number[]) => values.map(value => Number(value.toFixed(3))).join(',');
  assert.notEqual(signature(rounds[0]), signature(rounds[1]));
  assert.notEqual(signature(rounds[1]), signature(rounds[2]));
  // 但必须是同一套运动语言：三个轮次的位移量级在同一区间，不能突然收敛成静止。
  for (const values of rounds) {
    assert.ok(span(values) > 0.02, '每一轮都应有真实位移');
  }
});


test('生命行为：深度与尺寸独立，思考与回答的运动语言不同', () => {
  const thinking = runBrain(18, brainInput({ idle: 0, thinking: 1, energy: 0.3 }));
  const responding = runBrain(18, brainInput({ idle: 0, responding: 1, energy: 1, forward: 0.62 }));

  // 两个通道必须各自成立，而不是用缩放冒充远近。
  assert.ok(span(thinking.map(frame => frame.depth)) > 0.02, '思考态必须有真实前后移动');
  assert.ok(span(thinking.map(frame => frame.scale)) > 0.01, '思考态必须有独立尺寸变化');
  const relation = correlation(thinking.map(frame => frame.depth), thinking.map(frame => frame.scale));
  assert.ok(Math.abs(relation) < 0.95, `深度与尺寸不能是同一个通道（r=${relation}）`);

  // 状态签名：思考偏聚拢/靠近，回答偏舒展/外传。
  assert.ok(
    mean(responding.map(frame => frame.scale)) > mean(thinking.map(frame => frame.scale)),
    '回答态整体应比思考态更舒展'
  );
  assert.ok(
    mean(responding.map(frame => frame.dynamics.outflow)) > mean(thinking.map(frame => frame.dynamics.outflow)) + 0.2,
    '回答态的信息外传必须明显强于思考态'
  );
  assert.ok(
    mean(thinking.map(frame => frame.dynamics.cohesion)) > mean(responding.map(frame => frame.dynamics.cohesion)),
    '思考态的聚合必须强于回答态'
  );
  // 视觉尺寸（自身尺寸 × 透视放大）才是"舒展"的可观测结果。
  const apparent = (frame: { scale: number; depth: number }) =>
    frame.scale * (BRAIN_BUDGET.viewDistance / (BRAIN_BUDGET.viewDistance - frame.depth));
  assert.ok(
    mean(responding.map(apparent)) > mean(thinking.map(apparent)),
    '回答态在屏幕上必须实际更大（舒展不能被构图限幅吃掉）'
  );
});

test('生命行为：真实帧时间驱动，30fps 与 120fps 的运动语言一致', () => {
  const run = (fps: number) => {
    const controller = createModaBrainBehavior();
    const frames = runBrain(14, brainInput(), controller, fps);
    return frames;
  };
  const slow = run(30);
  const fast = run(120);
  // 采样到同一时间点（每 0.25 秒）比较位置。
  const sample = (frames: ReturnType<typeof run>, fps: number, seconds: number) =>
    frames[Math.min(frames.length - 1, Math.round(seconds * fps))];
  let worst = 0;
  for (let second = 1; second <= 14; second += 1) {
    const a = sample(slow, 30, second);
    const b = sample(fast, 120, second);
    worst = Math.max(worst, Math.abs(a.x - b.x), Math.abs(a.y - b.y));
  }
  assert.ok(worst < 0.05, `不同帧率下的轨迹偏差过大（${worst}）`);
  assert.ok(
    Math.abs(span(slow.map(frame => frame.x)) - span(fast.map(frame => frame.x))) < 0.05,
    '不同帧率下的位移范围必须一致'
  );
});

test('生命行为：prefers-reduced-motion 收敛位移、前后移动与姿态', () => {
  const input = brainInput({ idle: 0, thinking: 1, energy: 0.9 });
  const normal = runBrain(24, input);
  const reduced = runBrain(24, { ...input, reduced: true });
  assert.ok(
    span(reduced.map(frame => frame.x)) < span(normal.map(frame => frame.x)) * 0.6,
    '减弱动效必须显著减小横向漂移'
  );
  assert.ok(
    span(reduced.map(frame => frame.depth)) < span(normal.map(frame => frame.depth)) * 0.7,
    '减弱动效必须收敛前后移动'
  );
  assert.ok(
    span(reduced.map(frame => frame.tiltY)) < span(normal.map(frame => frame.tiltY)) * 0.7,
    '减弱动效必须收敛姿态变化'
  );
  // 减弱动效下依然存在生命运动（不是冻结），只是幅度更小。
  assert.ok(span(reduced.map(frame => frame.x)) * PX_PER_UNIT_300 > 1, '减弱动效不能变成静止');
});


test('呈现模式：内嵌头像不做宏观换位，但内部生命运动与位姿连续性保留', () => {
  const stage = runBrain(60, brainInput());
  const inline = runBrain(60, brainInput({ presentation: 'inline' }));

  assert.ok(stage.some(frame => frame.kind === 'macro'), '自由舞台必须发生宏观换位');
  assert.ok(!inline.some(frame => frame.kind === 'macro'), '32px 头像不允许宏观换位');

  // 头像模式不是冻结：位置、尺寸与内部动态仍在变化。
  assert.ok(span(inline.map(frame => frame.x)) > 0.005, '内嵌模式仍有细微位移');
  assert.ok(span(inline.map(frame => frame.scale)) > 0.005, '内嵌模式仍有尺寸变化');
  assert.ok(span(inline.map(frame => frame.dynamics.agitation)) > 0.05, '内嵌模式仍有神经激活变化');

  // 位姿连续：任何相邻两帧都不能跳变（切换呈现模式也不能）。
  for (let index = 1; index < inline.length; index += 1) {
    assert.ok(Math.abs(inline[index].x - inline[index - 1].x) * PX_PER_UNIT_300 <= 2, '内嵌模式出现位置跳变');
  }
});

test('构图：小画布按像素收紧，32px 内嵌核心不贴边', () => {
  const controller = createModaBrainBehavior();
  controller.setViewport(32);
  const frames = runBrain(
    30,
    brainInput({ idle: 0, responding: 1, energy: 1, forward: 0.62 }),
    controller
  );
  const cap = (16 - BRAIN_BUDGET.bleedPx) / 16;
  const maxExtent = Math.max(...frames.map(frame => frame.extent));
  assert.ok(maxExtent <= cap + 1e-6, `32px 核心外接必须让出像素边距，实际 ${maxExtent} > ${cap}`);

  // 大画布仍然使用 0.94 的硬上限。
  const large = createModaBrainBehavior();
  large.setViewport(300);
  const largeFrames = runBrain(30, brainInput({ idle: 0, thinking: 1, energy: 0.95 }), large);
  assert.ok(Math.max(...largeFrames.map(frame => frame.extent)) <= BRAIN_BUDGET.maxExtent + 1e-6);
});

test('生命行为三端一致：常量同值、着色器与小程序都接线', () => {
  const behaviorSource = read(`${coreDir}/modaBrainBehavior.ts`);
  assert.match(behaviorSource, /export const BRAIN_SEED = 20261027;/);
  assert.match(behaviorSource, /export const BRAIN_LIMITS = \{/);
  assert.match(behaviorSource, /export const BRAIN_BUDGET = \{/);
  assert.match(behaviorSource, /export const BRAIN_BEHAVIORS: BrainBehaviorId\[\] = \[/);
  assert.equal(BRAIN_BEHAVIORS.length, 11);
  // 旧的运动控制器必须被取代，不能留下第二套运动权威。
  assert.throws(() => read(`${coreDir}/modaCoreMotion.ts`));

  // 小程序镜像的常量必须逐项数值相同（不是"存在即通过"）。
  assert.match(miniCore, /const BRAIN_SEED = 20261027;/);
  for (const [key, value] of Object.entries(BRAIN_LIMITS)) {
    const pattern = `${key}: ${String(value).replace('.', '\\.')}[,\\n]`;
    assert.match(miniCore, new RegExp(pattern), `小程序 BRAIN_LIMITS.${key} 必须为 ${value}`);
  }
  for (const [key, value] of Object.entries(BRAIN_BUDGET)) {
    const pattern = `${key}: ${String(value).replace('.', '\\.')}[,\\n]`;
    assert.match(miniCore, new RegExp(pattern), `小程序 BRAIN_BUDGET.${key} 必须为 ${value}`);
  }
  assert.match(miniCore, /function createBrainBehavior\(\)/);
  assert.match(miniCore, /const BRAIN_BEHAVIORS = \[/);

  // 两个 GLSL 程序都必须有内部动态通道，否则细胞与纤维会各说各话。
  assert.equal((shadersSource.match(/uniform vec4 uCognition;/g) ?? []).length, 2);
  assert.match(engineSource, /cognition: at\('uCognition'\)/);
  assert.match(engineSource, /programUniforms\.cognition,/);
  assert.match(engineSource, /motionFrame = motion\.update\(dt, motionInput\)/);
  assert.match(engineSource, /motion\.setViewport\(Math\.min\(width, height\)\)/);
  assert.match(engineSource, /setPresentation,/);
  assert.match(engineSource, /extent: Number\(motionFrame\.extent\.toFixed\(4\)\)/);
  assert.match(engineSource, /behavior: motionFrame\.behavior/);
  // 舞台把锚点转换成呈现模式，回答头像与自由舞台共用同一个控制器。
  assert.match(read(`${coreDir}/modaCoreStage.ts`), /setPresentationMode\(kind === 'reply' \? 'inline' : 'stage'\)/);
  assert.match(read(`${coreDir}/ModaCoreStage.tsx`), /setPresentation\(stage\.getPresentationMode\(\)\)/);
});

