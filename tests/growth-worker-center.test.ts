import assert from 'node:assert/strict';
import test from 'node:test';
import { buildGrowthWorkerCenter } from '../src/server/growthWorkerCenter';
import { growthRoleCatalog } from '../src/shared/growthWorkers';

test('exposes all twelve blueprint roles without claiming planned roles are implemented', () => {
  assert.equal(growthRoleCatalog.length, 12);
  assert.equal(new Set(growthRoleCatalog.map(role => role.id)).size, 12);
  assert.deepEqual(
    growthRoleCatalog.filter(role => role.status === 'planned').map(role => role.id),
    ['market-research', 'content', 'advertising', 'seo', 'kol', 'sales', 'customer-service', 'virality']
  );
  assert.ok(growthRoleCatalog.every(role => role.goal && role.currentEvidence && role.nextStep));
});

test('reports only bounded platform workers and exposes persisted review queue counts', () => {
  const checkedAt = new Date('2026-10-10T12:00:00.000Z');
  const workers = buildGrowthWorkerCenter({
    growthMissionReady: true,
    taskQueueReady: true,
    crmAutomationReady: false,
    taskWorkerRuntimeStatus: 'running',
    reviewTasks: [
      { status: 'waiting_approval', count: 3, lastUpdatedAt: checkedAt },
      { status: 'completed', count: 7, lastUpdatedAt: new Date(checkedAt.getTime() - 60_000) },
      { status: 'unexpected', count: 100, lastUpdatedAt: null }
    ]
  });

  assert.deepEqual(workers.map(worker => [worker.id, worker.availability]), [
    ['growth-manager', 'limited'],
    ['growth-mission-review-worker', 'available'],
    ['growth-crm-lifecycle-rules', 'migration_required']
  ]);
  assert.equal(workers[1].taskType, 'growth.mission.review');
  assert.equal(workers[1].runtimeStatus, 'running');
  assert.equal(workers[0].runtimeStatus, null);
  assert.deepEqual(workers[1].taskCounts, { waiting_approval: 3, completed: 7 });
  assert.equal(workers[1].lastActivityAt, checkedAt.toISOString());
  assert.ok(workers.every(worker => worker.scope === 'platform' && worker.externalSideEffects === false));
  assert.equal(workers[0].taskCounts, null);
});

test('does not fabricate task statistics when required tables are not available', () => {
  const workers = buildGrowthWorkerCenter({
    growthMissionReady: false,
    taskQueueReady: false,
    crmAutomationReady: false,
    taskWorkerRuntimeStatus: 'stopped',
    reviewTasks: []
  });
  assert.ok(workers.every(worker => worker.availability === 'migration_required' || worker.id === 'growth-manager'));
  assert.equal(workers[1].taskCounts, null);
  assert.equal(workers[1].lastActivityAt, null);
  assert.equal(workers[1].runtimeStatus, 'stopped');
});
