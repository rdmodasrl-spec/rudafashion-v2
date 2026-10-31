/**
 * 滚动驱动的相机控制器：关键帧 + 缓动，避免滚动时跳变。
 */
import type * as THREE from 'three';

/** three 由调用方注入，避免在此模块静态引入 3D 运行时 */
type ThreeNamespace = typeof import('three');

export type CameraKeyframe = {
  /** 滚动进度 0..1 */
  at: number;
  position: [number, number, number];
  target: [number, number, number];
};

export function createCameraController(
  THREE_NS: ThreeNamespace,
  camera: THREE.PerspectiveCamera,
  keyframes: CameraKeyframe[]
) {
  const sorted = [...keyframes].sort((a, b) => a.at - b.at);
  let progress = 0;
  let smoothed = 0;
  let pointerBias = { x: 0, y: 0 };
  const currentTarget = new THREE_NS.Vector3(...(sorted[0]?.target ?? ([0, 0, 0] as [number, number, number])));

  const sample = (value: number) => {
    if (sorted.length === 0) return { position: [0, 0.6, 4.6] as [number, number, number], target: [0, 0, 0] as [number, number, number] };
    if (value <= sorted[0].at) return sorted[0];
    if (value >= sorted[sorted.length - 1].at) return sorted[sorted.length - 1];
    for (let index = 0; index < sorted.length - 1; index += 1) {
      const left = sorted[index];
      const right = sorted[index + 1];
      if (value >= left.at && value <= right.at) {
        const span = right.at - left.at || 1;
        const local = (value - left.at) / span;
        // smoothstep：进出都缓，避免线性运动带来的机械感
        const eased = local * local * (3 - 2 * local);
        return {
          position: [
            left.position[0] + (right.position[0] - left.position[0]) * eased,
            left.position[1] + (right.position[1] - left.position[1]) * eased,
            left.position[2] + (right.position[2] - left.position[2]) * eased
          ] as [number, number, number],
          target: [
            left.target[0] + (right.target[0] - left.target[0]) * eased,
            left.target[1] + (right.target[1] - left.target[1]) * eased,
            left.target[2] + (right.target[2] - left.target[2]) * eased
          ] as [number, number, number]
        };
      }
    }
    return sorted[sorted.length - 1];
  };

  const host = typeof document === 'undefined' ? null : document;
  const read = () => {
    const element = camera.userData.scrollHost as HTMLElement | undefined;
    if (!element) return;
    const rect = element.getBoundingClientRect();
    const viewport = window.innerHeight || 1;
    const span = Math.max(1, rect.height - viewport * 0.35);
    progress = Math.min(1, Math.max(0, -rect.top / span));
  };
  host?.addEventListener('scroll', read, { passive: true });
  window.addEventListener('resize', read);
  read();

  return {
    attach(host: HTMLElement) {
      camera.userData.scrollHost = host;
      read();
    },
    setPointer(x: number, y: number) {
      pointerBias = { x, y };
    },
    update(dt: number) {
      smoothed += (progress - smoothed) * Math.min(1, dt * 3.2);
      const frame = sample(smoothed);
      // 指针只做极轻微偏移，保持「摄影机在动」而不是「场景在晃」
      camera.position.set(
        frame.position[0] + pointerBias.x * 0.22,
        frame.position[1] + pointerBias.y * 0.1,
        frame.position[2]
      );
      currentTarget.set(frame.target[0], frame.target[1], frame.target[2]);
      camera.lookAt(currentTarget);
    },
    get progress() { return smoothed; },
    dispose() {
      host?.removeEventListener('scroll', read);
      window.removeEventListener('resize', read);
    }
  };
}
