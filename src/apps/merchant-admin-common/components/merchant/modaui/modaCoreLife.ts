/**
 * ModaUI 数字生命实时事件通道。
 *
 * 硬性约束（见 docs/engineering/modules/modaui-core.md 第 14 节）：
 * - 这里的每一个状态变化都必须由真实输入、真实请求、真实文本片段或真实语音生命周期触发；
 *   禁止用固定定时器假装“正在思考”。
 * - 只输出连续数值（聚拢、前移、流动、片段脉冲、运动能量），由 GPU 粒子系统逐帧解释，
 *   不切换预设画面，也不新建第二套 AI 状态。
 * - 与 React 解耦：聊天组件 emit，渲染引擎每帧 sample，组件不会因为每个片段重渲染。
 */

export type ModaCoreLifePhase = 'idle' | 'focus' | 'sending' | 'responding' | 'complete' | 'error';

export type ModaCoreLifeEvent =
  | { type: 'input:focus' }
  | { type: 'input:blur' }
  | { type: 'input:change'; length?: number }
  | { type: 'message:submit' }
  | { type: 'response:start' }
  | { type: 'response:chunk'; chars?: number }
  | { type: 'response:pause' }
  | { type: 'response:resume' }
  | { type: 'response:complete' }
  | { type: 'response:error' }
  | { type: 'response:abort' }
  | { type: 'audio:start' }
  | { type: 'audio:level'; value?: number }
  | { type: 'audio:end' }
  | { type: 'core:reset' };

export type ModaCoreLifeFrame = {
  phase: ModaCoreLifePhase;
  /** 0–1：粒子整体向核心聚拢（用户正在输入）。 */
  contraction: number;
  /** 0–1：核心沿真实透视方向靠近（消息已提交）。 */
  forward: number;
  /** 0–1：粒子沿头部轮廓定向细流（回答文本正在出现）。 */
  flow: number;
  /** 0–1：新文本片段到达时的一次轻柔鼓起，会自然衰减。 */
  pulse: number;
  /** 0–1：整体运动能量；真实等待与生成暂停时会下降。 */
  energy: number;
};

export type ModaCoreLifeHandle = {
  emit: (event: ModaCoreLifeEvent) => void;
  /** 渲染循环每帧调用；`nowMs` 可注入，便于确定性测试。 */
  sample: (nowMs?: number) => ModaCoreLifeFrame;
  getPhase: () => ModaCoreLifePhase;
  getFrame: () => ModaCoreLifeFrame;
  subscribePhase: (listener: (phase: ModaCoreLifePhase) => void) => () => void;
  dispose: () => void;
};

type Targets = {
  contraction: number;
  forward: number;
  flow: number;
  energy: number;
};

const IDLE_TARGETS: Targets = { contraction: 0, forward: 0, flow: 0, energy: 0.82 };
const FOCUS_TARGETS: Targets = { contraction: 0.78, forward: 0.16, flow: 0, energy: 0.52 };
const SENDING_TARGETS: Targets = { contraction: 0.40, forward: 1, flow: 0.20, energy: 0.90 };
const WAITING_TARGETS: Targets = { contraction: 0.46, forward: 0.90, flow: 0.12, energy: 0.30 };
const RESPONDING_TARGETS: Targets = { contraction: 0.28, forward: 0.62, flow: 0.92, energy: 1 };
const PAUSED_TARGETS: Targets = { contraction: 0.32, forward: 0.55, flow: 0.28, energy: 0.36 };
const COMPLETE_TARGETS: Targets = { contraction: 0, forward: 0, flow: 0, energy: 0.60 };
const ERROR_TARGETS: Targets = { contraction: 0.24, forward: 0.12, flow: 0, energy: 0.24 };

/** 请求在路上但迟迟没有文本：真实的等待时间，不是动画脚本。 */
const WAITING_AFTER_MS = 1200;
/** 用户停止输入后核心慢慢放松，但不会在每次按键之间跳动。 */
const FOCUS_TIMEOUT_MS = 2600;
/** 成功/失败动作的保持时间，之后回到待机。 */
const COMPLETE_HOLD_MS = 1400;
const ERROR_HOLD_MS = 1800;
const PULSE_DECAY_PER_SECOND = 3.4;

const clamp01 = (value: number) => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));

const approach = (current: number, goal: number, rate: number, dt: number) =>
  dt <= 0 ? current : current + (goal - current) * (1 - Math.exp(-rate * dt));
export type ModaCoreLifeOptions = {
  /** 测试可注入假时钟；默认使用 performance.now()。 */
  now?: () => number;
};

export function createModaCoreLife(options: ModaCoreLifeOptions = {}): ModaCoreLifeHandle {
  const clock = options.now ?? (() => (typeof performance !== 'undefined' ? performance.now() : Date.now()));
  const startedAt = clock();

  let phase: ModaCoreLifePhase = 'idle';
  let phaseSince = startedAt;
  let lastEventAt = startedAt;
  let lastChunkAt = Number.NEGATIVE_INFINITY;
  let lastSampleAt: number | null = null;
  let targets: Targets = { ...IDLE_TARGETS };
  let pulse = 0;
  let disposed = false;

  const value = {
    contraction: IDLE_TARGETS.contraction,
    forward: IDLE_TARGETS.forward,
    flow: IDLE_TARGETS.flow,
    energy: IDLE_TARGETS.energy
  };

  const listeners = new Set<(phase: ModaCoreLifePhase) => void>();

  const setPhase = (next: ModaCoreLifePhase) => {
    if (phase === next) return;
    phase = next;
    phaseSince = clock();
    listeners.forEach(listener => {
      try {
        listener(next);
      } catch {
        // 订阅者异常不影响粒子生命本身。
      }
    });
  };

  const emit = (event: ModaCoreLifeEvent) => {
    if (disposed) return;
    const time = clock();
    lastEventAt = time;
    switch (event.type) {
      case 'input:focus':
        // 输入只影响「还没有回答在进行」时的核心：不能覆盖真实的发送/生成/收尾阶段，
        // 否则用户继续打字会让已经落在回复位置的小头部跟着键盘乱跳。
        if (phase === 'idle' || phase === 'focus') {
          setPhase('focus');
          targets = FOCUS_TARGETS;
        }
        break;
      case 'input:change':
        if (phase === 'idle' || phase === 'focus') {
          setPhase('focus');
          targets = FOCUS_TARGETS;
          // 每个真实按键只叠加很小的脉冲，持续输入时保持稳定，不逐字抖动。
          pulse = Math.min(1, pulse + 0.18);
        }
        break;
      case 'input:blur':
        if (phase === 'focus') {
          setPhase('idle');
          targets = IDLE_TARGETS;
        }
        break;
      case 'message:submit':
        setPhase('sending');
        targets = SENDING_TARGETS;
        pulse = 1;
        break;
      case 'response:start':
        setPhase('sending');
        targets = SENDING_TARGETS;
        break;
      case 'response:chunk':
        lastChunkAt = time;
        setPhase('responding');
        targets = RESPONDING_TARGETS;
        pulse = 1;
        break;
      case 'response:pause':
        setPhase('responding');
        targets = PAUSED_TARGETS;
        break;
      case 'response:resume':
        setPhase('responding');
        targets = RESPONDING_TARGETS;
        break;
      case 'response:complete':
        setPhase('complete');
        targets = COMPLETE_TARGETS;
        pulse = Math.max(pulse, 0.5);
        break;
      case 'response:abort':
        setPhase('complete');
        targets = COMPLETE_TARGETS;
        break;
      case 'response:error':
        setPhase('error');
        targets = ERROR_TARGETS;
        break;
      case 'audio:start':
        targets = { ...targets, energy: 1 };
        break;
      case 'audio:level':
        targets = { ...targets, energy: clamp01(0.55 + clamp01(event.value ?? 0) * 0.6) };
        break;
      case 'audio:end':
        targets = { ...targets, energy: IDLE_TARGETS.energy };
        break;
      case 'core:reset':
        targets = IDLE_TARGETS;
        pulse = 0;
        setPhase('idle');
        break;
      default:
        break;
    }
  };



  const sample = (nowMs?: number): ModaCoreLifeFrame => {
    const time = nowMs ?? clock();
    const dt = lastSampleAt === null ? 0 : Math.min(0.08, Math.max(0, (time - lastSampleAt) / 1000));
    lastSampleAt = time;

    if (!disposed) {
      // 真实等待：请求已发出但还没有文本片段，运动自然减弱。
      if (phase === 'sending' && time - Math.max(lastChunkAt, phaseSince) > WAITING_AFTER_MS) {
        targets = WAITING_TARGETS;
      }
      // 用户停止输入：核心慢慢放松回待机，不保留“永远专注”的假状态。
      if (phase === 'focus' && time - lastEventAt > FOCUS_TIMEOUT_MS) {
        targets = IDLE_TARGETS;
        setPhase('idle');
      }
      // 完成 / 失败动作结束后回到待机。
      if (phase === 'complete' && time - phaseSince > COMPLETE_HOLD_MS) {
        targets = IDLE_TARGETS;
        setPhase('idle');
      }
      if (phase === 'error' && time - phaseSince > ERROR_HOLD_MS) {
        targets = IDLE_TARGETS;
        setPhase('idle');
      }
    }

    value.contraction = approach(value.contraction, targets.contraction, 3.6, dt);
    value.forward = approach(value.forward, targets.forward, 3.2, dt);
    value.flow = approach(value.flow, targets.flow, 3.0, dt);
    value.energy = approach(value.energy, targets.energy, 2.2, dt);
    pulse = Math.max(0, pulse - dt * PULSE_DECAY_PER_SECOND);

    return {
      phase,
      contraction: clamp01(value.contraction),
      forward: clamp01(value.forward),
      flow: clamp01(value.flow),
      pulse: clamp01(pulse),
      energy: clamp01(value.energy)
    };
  };

  const getFrame = (): ModaCoreLifeFrame => ({
    phase,
    contraction: clamp01(value.contraction),
    forward: clamp01(value.forward),
    flow: clamp01(value.flow),
    pulse: clamp01(pulse),
    energy: clamp01(value.energy)
  });

  const subscribePhase = (listener: (phase: ModaCoreLifePhase) => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  };

  const dispose = () => {
    disposed = true;
    listeners.clear();
  };

  return {
    emit,
    sample,
    getPhase: () => phase,
    getFrame,
    subscribePhase,
    dispose
  };
}
