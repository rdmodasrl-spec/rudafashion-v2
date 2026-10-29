import assert from 'node:assert/strict';
import test from 'node:test';
import { buildOrderChatAutoReply, classifyOrderChatMessage, type OrderChatFactSnapshot } from '../src/server/orderChatAssistant';

const order: OrderChatFactSnapshot = {
  orderNo: 'RU-TEST-001',
  status: 'shipped',
  currentTask: '查看包裹物流记录',
  paymentStatus: 'partially_paid',
  totalQty: 12,
  totalAmount: 840,
  shippingFee: 25,
  discountAmount: 15,
  paidAmount: 300,
  paymentAmountDue: 565,
  items: [{ name: '西装外套', sku: 'BLZ-M', quantity: 12, unitPrice: 70 }],
  shipments: [{
    status: 'in_transit',
    carrier: 'Test carrier',
    trackingNumber: 'TRACK-123',
    shippedAt: '2026-10-24T10:00:00.000Z',
    latestEvent: {
      status: '运输中',
      location: '米兰',
      description: '已到达分拨中心',
      occurredAt: '2026-10-24T12:30:00.000Z'
    }
  }]
};

test('routes supported factual order questions to deterministic answers', () => {
  assert.deepEqual(classifyOrderChatMessage('订单现在到哪一步了？'), { kind: 'automatic', topic: 'status' });
  assert.deepEqual(classifyOrderChatMessage('付款确认了吗？'), { kind: 'automatic', topic: 'payment' });
  assert.deepEqual(classifyOrderChatMessage('包裹到哪里了？'), { kind: 'automatic', topic: 'tracking' });
  assert.deepEqual(classifyOrderChatMessage('这笔订单商品数量和金额是多少？'), { kind: 'automatic', topic: 'summary' });

  const statusReply = buildOrderChatAutoReply('status', order, '订单现在到哪一步了？');
  assert.match(statusReply, /自动回复/);
  assert.match(statusReply, /RU-TEST-001/);
  assert.match(statusReply, /运输中/);
  assert.match(buildOrderChatAutoReply('payment', order, '付款确认了吗？'), /净收款 €300\.00/);
  assert.match(buildOrderChatAutoReply('payment', order, '付款确认了吗？'), /应付 €565\.00/);
  const trackingReply = buildOrderChatAutoReply('tracking', order, '包裹到哪里了？');
  assert.match(trackingReply, /米兰/);
  assert.match(trackingReply, /2026-10-24T12:30:00\.000Z/);
  assert.match(trackingReply, /不代表实时 GPS/);
});

test('routes commercial changes, disputes, and unsupported questions to the merchant', () => {
  assert.deepEqual(classifyOrderChatMessage('能不能便宜一点？'), { kind: 'merchant', reason: 'commercial' });
  assert.deepEqual(classifyOrderChatMessage('能否提前发货？'), { kind: 'merchant', reason: 'change_request' });
  assert.deepEqual(classifyOrderChatMessage('可以修改订单数量吗？'), { kind: 'merchant', reason: 'change_request' });
  assert.deepEqual(classifyOrderChatMessage('我要申请退款'), { kind: 'merchant', reason: 'refund_or_dispute' });
  assert.deepEqual(classifyOrderChatMessage('这批货面料是什么？'), { kind: 'merchant', reason: 'unsupported' });
});

test('does not invent package tracking when an order has no shipment records', () => {
  const reply = buildOrderChatAutoReply('tracking', { ...order, shipments: [] }, '包裹到哪里了？');
  assert.match(reply, /暂无已创建的包裹或发货信息/);
  assert.doesNotMatch(reply, /GPS|预计送达/);
});

test('does not invent a location or delivery estimate before a carrier scan', () => {
  const reply = buildOrderChatAutoReply('tracking', {
    ...order,
    shipments: [{ ...order.shipments[0], latestEvent: null }]
  }, '包裹到哪里了？');
  assert.match(reply, /尚无承运商扫描记录/);
  assert.match(reply, /无法提供物流地点或预计送达时间/);
});
