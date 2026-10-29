import assert from 'node:assert/strict';
import test from 'node:test';
import { getAiEmployeeInferenceMetrics, measureAiEmployeeInference } from '../src/server/aiEmployeeMetrics';

test('records successful and failed Fal creative calls without swallowing provider errors', async () => {
  await measureAiEmployeeInference('creative:fal', async () => 'generated');
  await assert.rejects(
    measureAiEmployeeInference('creative:fal_tryon', async () => {
      throw new Error('synthetic try-on failure');
    }),
    /synthetic try-on failure/
  );

  const metrics = getAiEmployeeInferenceMetrics();
  assert.equal(metrics['creative:fal'].attempts, 1);
  assert.equal(metrics['creative:fal'].failures, 0);
  assert.equal(metrics['creative:fal'].lastSucceeded, true);
  assert.equal(metrics['creative:fal_tryon'].attempts, 1);
  assert.equal(metrics['creative:fal_tryon'].failures, 1);
  assert.equal(metrics['creative:fal_tryon'].failureRate, 1);
  assert.equal(metrics['creative:fal_tryon'].lastSucceeded, false);
});
