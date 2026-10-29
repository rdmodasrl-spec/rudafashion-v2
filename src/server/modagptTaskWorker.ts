import type { ModaGptTaskHandler, ModaGptTaskQueue, ModaGptTaskType } from './modagptTaskQueue';

export function startModaGptTaskWorker(
  queue: ModaGptTaskQueue,
  workerId: string,
  handlers: Partial<Record<ModaGptTaskType, ModaGptTaskHandler>>,
  options: {
    pollIntervalMs?: number;
    leaseMs?: number;
    onWorkerError?: (error: unknown) => void;
  } = {}
): { stop: () => Promise<void>; done: Promise<void> } {
  const pollIntervalMs = options.pollIntervalMs ?? 1_000;
  const leaseMs = options.leaseMs ?? 60_000;
  if (!Number.isInteger(pollIntervalMs) || pollIntervalMs < 100 || pollIntervalMs > 60_000) {
    throw new Error('MODAGPT_WORKER_POLL_INTERVAL_INVALID');
  }
  if (!Number.isInteger(leaseMs) || leaseMs < 1_000 || leaseMs > 15 * 60_000) {
    throw new Error('MODAGPT_TASK_LEASE_INVALID');
  }

  let stopped = false;
  const shutdownController = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let finishWait: (() => void) | undefined;
  const waitForNextPoll = () => {
    if (stopped) return Promise.resolve();
    return new Promise<void>(resolve => {
      finishWait = resolve;
      timer = setTimeout(() => {
        timer = undefined;
        finishWait = undefined;
        resolve();
      }, pollIntervalMs);
    });
  };
  const done = (async () => {
    while (!stopped) {
      try {
        const result = await queue.runOne(workerId, handlers, leaseMs, { signal: shutdownController.signal });
        if (result === 'idle' && !stopped) await waitForNextPoll();
      } catch (error) {
        options.onWorkerError?.(error);
        if (!stopped) await waitForNextPoll();
      }
    }
  })();

  return {
    done,
    stop: async () => {
      stopped = true;
      shutdownController.abort(new Error('MODAGPT_WORKER_STOPPING'));
      if (timer) clearTimeout(timer);
      timer = undefined;
      finishWait?.();
      finishWait = undefined;
      await done;
    }
  };
}
