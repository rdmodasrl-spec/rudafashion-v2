import assert from 'node:assert/strict';
import test from 'node:test';
import {
  answerWithSalesSummary,
  createAiEmployeeSalesSummary
} from '../src/server/aiEmployeeSales';

test('sales summary aggregates safe values and excludes cancelled and returned orders from totals', () => {
  const summary = createAiEmployeeSalesSummary('2026-09-01', '2026-09-30', [
    { status: 'delivered', orderCount: 4, totalAmount: 320.5, totalQuantity: 8 },
    { status: 'cancelled', orderCount: 2, totalAmount: 120, totalQuantity: 3 },
    { status: 'returned', orderCount: 1, totalAmount: 40, totalQuantity: 1 },
    { status: 'unexpected', orderCount: 1, totalAmount: 9, totalQuantity: 1 }
  ]);

  assert.equal(summary.orderCount, 5);
  assert.equal(summary.totalAmount, 329.5);
  assert.equal(summary.totalQuantity, 9);
  assert.equal(summary.byStatus[3].status, 'other');
});

test('sales answers use only aggregate facts, preserve language, and reject invented numbers', async () => {
  const summary = createAiEmployeeSalesSummary('2026-09-01', '2026-09-30', [
    { status: 'delivered', orderCount: 4, totalAmount: 320.5, totalQuantity: 8 }
  ]);
  const answer = await answerWithSalesSummary(
    '近 30 天销售情况？',
    summary,
    async (prompt, systemPrompt) => {
      assert.match(prompt, /聚合销售与订单状态数据/);
      assert.doesNotMatch(prompt, /buyer|email|phone|address|customerId/i);
      assert.match(systemPrompt, /不得输出订单号或买家个人资料/);
      return '{"reply":"统计范围 2026-09-01 至 2026-09-30，共 4 笔订单，销售额 €320.5。"}';
    }
  );
  assert.match(answer, /4 笔订单/);
  await assert.rejects(
    answerWithSalesSummary('多少订单？', summary, async () => '{"reply":"共有 99 笔订单。"}'),
    /AI_EMPLOYEE_SALES_ANSWER_UNGROUNDED/
  );
  const italianAnswer = await answerWithSalesSummary(
    'Quanti ordini abbiamo negli ultimi giorni?',
    summary,
    async () => '{"reply":"Abbiamo 4 ordini nel periodo indicato."}'
  );
  assert.match(italianAnswer, /ordini/);
  await assert.rejects(
    answerWithSalesSummary(
      'Quanti ordini abbiamo negli ultimi giorni?',
      summary,
      async () => '{"reply":"There were 4 orders in the period."}'
    ),
    /AI_EMPLOYEE_SALES_ANSWER_INVALID/
  );
});
