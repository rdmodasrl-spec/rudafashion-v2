import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getFashionStudioAudioProjectReferenceFilter,
  getFashionStudioAudioTaskReferenceFilter
} from '../src/server/fashionStudioAudioLifecycle';

const assetId = 'f3a34c4e-2b88-4d5a-946d-8d9e55204ab1';

test('audio cleanup checks project references only in the platform workspace', () => {
  assert.deepEqual(getFashionStudioAudioProjectReferenceFilter(assetId), {
    tenantId: 'platform',
    document: { contains: assetId }
  });
});

test('audio cleanup protects active export tasks and cancelled tasks with a live worker lease', () => {
  const now = new Date('2026-10-18T00:00:00.000Z');
  assert.deepEqual(getFashionStudioAudioTaskReferenceFilter(assetId, now), {
    taskType: 'studio.video.trim',
    tenantId: 'platform',
    payload: { contains: assetId },
    OR: [
      { status: { in: ['queued', 'retrying', 'planning', 'running', 'verifying'] } },
      { status: 'cancelled', lockedBy: { not: null }, lockedUntil: { gt: now } }
    ]
  });
});
