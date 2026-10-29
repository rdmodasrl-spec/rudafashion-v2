import assert from 'node:assert/strict';
import test from 'node:test';
import { verifyAiEmployeeReply } from '../src/server/aiEmployeeVerifier';

const options = {
  message: 'How many units are available?',
  facts: { sku: 'SKU-01', available: 12 },
  invalidErrorCode: 'ANSWER_INVALID',
  ungroundedErrorCode: 'ANSWER_UNGROUNDED'
};

test('AI reply verifier accepts a concise, language-matched answer grounded in executor facts', () => {
  assert.equal(
    verifyAiEmployeeReply('  SKU-01 has 12 units available.  ', options),
    'SKU-01 has 12 units available.'
  );
});

test('AI reply verifier rejects malformed, oversized, and wrong-language output', () => {
  assert.throws(() => verifyAiEmployeeReply(null, options), /ANSWER_INVALID/);
  assert.throws(() => verifyAiEmployeeReply('   ', options), /ANSWER_INVALID/);
  assert.throws(() => verifyAiEmployeeReply('Available stock is 12. \u0001', options), /ANSWER_INVALID/);
  assert.throws(
    () => verifyAiEmployeeReply('x'.repeat(1501), options),
    /ANSWER_INVALID/
  );
  assert.throws(
    () => verifyAiEmployeeReply('有 12 件可用。', options),
    /ANSWER_INVALID/
  );
});

test('AI reply verifier rejects numbers not present in authoritative executor facts', () => {
  assert.throws(
    () => verifyAiEmployeeReply('SKU-01 has 13 units available.', options),
    /ANSWER_UNGROUNDED/
  );
});

test('AI reply verifier accepts Chinese answers while retaining fact-number checks', () => {
  assert.equal(
    verifyAiEmployeeReply('SKU-01 有 12 件可用。', {
      ...options,
      message: 'SKU-01 有多少件可用？'
    }),
    'SKU-01 有 12 件可用。'
  );
  assert.throws(
    () => verifyAiEmployeeReply('SKU-01 有 13 件可用。', {
      ...options,
      message: 'SKU-01 有多少件可用？'
    }),
    /ANSWER_UNGROUNDED/
  );
});
