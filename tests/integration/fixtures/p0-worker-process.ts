import { PrismaClient } from '@prisma/client';
import { handleGrowthMissionReviewTask } from '../../../src/server/growthMissionReviewWorker';
import { PrismaModaGptTaskStore } from '../../../src/server/prismaModaGptTaskStore';
import { ModaGptTaskRuntime } from '../../../src/server/modagptTaskQueue';
import { startModaGptTaskWorker } from '../../../src/server/modagptTaskWorker';

const mode = process.argv[2];
const prisma = new PrismaClient();
const runtime = new ModaGptTaskRuntime(new PrismaModaGptTaskStore(prisma));
const worker = startModaGptTaskWorker(
  runtime,
  `p0-${mode}-${process.pid}`,
  {
    'growth.mission.review': async (task, execution) => {
      if (mode === 'hold') {
        process.send?.({ event: 'claimed', taskId: task.id, attempts: task.attempts });
        await new Promise<never>(() => undefined);
      }
      if (mode === 'cancellable') {
        process.send?.({ event: 'claimed', taskId: task.id, attempts: task.attempts });
        await new Promise<void>(resolve => {
          execution.signal.addEventListener('abort', () => resolve(), { once: true });
        });
        process.send?.({ event: 'aborted', taskId: task.id });
        return { cancelled: true };
      }
      return handleGrowthMissionReviewTask(prisma, task);
    },
    'ops.health_check': async (task, execution) => {
      if (mode === 'hold') {
        process.send?.({ event: 'claimed', taskId: task.id, attempts: task.attempts });
        await new Promise<never>(() => undefined);
      }
      if (mode === 'shutdown') {
        process.send?.({ event: 'claimed', taskId: task.id, attempts: task.attempts });
        await new Promise<void>(resolve => {
          execution.signal.addEventListener('abort', () => resolve(), { once: true });
        });
        process.send?.({ event: 'aborted', taskId: task.id });
        return { cancelled: true };
      }
      if (mode === 'long') {
        process.send?.({ event: 'claimed', taskId: task.id, attempts: task.attempts });
        await new Promise(resolve => setTimeout(resolve, 2_200));
      }
      if (mode === 'dead' || (mode === 'retry' && task.attempts === 1)) {
        throw new Error('P0_WORKER_PROCESS_TEST_FAILURE');
      }
      return { workerPid: process.pid, attempts: task.attempts };
    }
  },
  {
    pollIntervalMs: 100,
    leaseMs: 1_000,
    onWorkerError: error => process.send?.({
      event: 'error',
      code: error instanceof Error ? error.message : 'P0_WORKER_PROCESS_UNKNOWN'
    })
  }
);

process.send?.({ event: 'started', pid: process.pid });
process.once('SIGTERM', () => {
  void worker.stop().then(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
});
