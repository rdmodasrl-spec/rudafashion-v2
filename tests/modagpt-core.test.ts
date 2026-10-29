import assert from 'node:assert/strict';
import test from 'node:test';
import { superviseModaGptRequest } from '../src/server/modagptCore';

test('master supervisor limits clear inventory intent to installed inventory capabilities', () => {
  const decision = superviseModaGptRequest('检查库存并给出补货建议', [
    'product_search',
    'inventory_search',
    'replenishment_analysis'
  ]);

  assert.equal(decision.agentRequired, true);
  assert.equal(decision.agent, 'inventory-manager');
  assert.deepEqual(decision.capabilities, ['inventory_search', 'replenishment_analysis']);
  assert.equal(decision.reason, 'authorized_capability_match');
});

test('master supervisor does not invent an agent when matching capability is not authorized', () => {
  const decision = superviseModaGptRequest('查询本店库存', ['product_search']);

  assert.equal(decision.agentRequired, false);
  assert.equal(decision.agent, null);
  assert.deepEqual(decision.capabilities, []);
  assert.equal(decision.reason, 'no_authorized_capability');
});

test('master supervisor requests clarification for ambiguous unsupported requests', () => {
  const decision = superviseModaGptRequest('帮我把生意做得更好', [
    'product_search',
    'inventory_search',
    'sales_summary'
  ]);

  assert.equal(decision.agentRequired, false);
  assert.equal(decision.requiresClarification, true);
});

test('master supervisor rejects invalid input and forged capabilities', () => {
  assert.throws(() => superviseModaGptRequest('', ['product_search']), /MODAGPT_SUPERVISOR_REQUEST_INVALID/);
  assert.throws(
    () => superviseModaGptRequest('查询商品', ['finance_write'] as never),
    /MODAGPT_SUPERVISOR_CAPABILITY_INVALID/
  );
});
