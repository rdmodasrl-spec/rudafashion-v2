export type OrderChatIntent =
  | { kind: 'automatic'; topic: 'status' | 'payment' | 'shipment' | 'tracking' | 'summary' }
  | { kind: 'merchant'; reason: 'commercial' | 'change_request' | 'refund_or_dispute' | 'unsupported' };

const merchantOnlyPatterns = [
  /退款|退费|退货|退换|投诉|争议|纠纷|赔偿|退款进度|refund|chargeback|complaint|dispute|return|rimborso|reclamo/i,
  /便宜|优惠|折扣|打折|降价|砍价|议价|少一点|cheaper|discount|bargain|sconto|prezzo più basso/i,
  /提前发货|提前发|尽快发货|加急发货|更快发货|能否快点|能不能快点|ship earlier|expedite|ship sooner|spedire prima/i,
  /(?:修改|更改|变更|增加|减少|改一下|调整|change|modify|update).{0,12}(?:数量|件数|金额|价格|付款|支付|交期|发货|条件|quantity|amount|price|payment|delivery|shipment|quantità|prezzo|pagamento|consegna)|(?:数量|件数|金额|价格|付款方式|付款条件|交期|发货条件).{0,10}(?:修改|更改|变更|增加|减少|调整|change|modify|update)|付款方式|特殊付款|分期付款|账期|货到付款|payment terms|payment method|pagamento a rate/i
];

export function classifyOrderChatMessage(content: string): OrderChatIntent {
  const normalized = content.trim();
  if (!normalized) return { kind: 'merchant', reason: 'unsupported' };

  if (/退款|退费|退货|退换|投诉|争议|纠纷|赔偿|退款进度|refund|chargeback|complaint|dispute|return|rimborso|reclamo/i.test(normalized)) {
    return { kind: 'merchant', reason: 'refund_or_dispute' };
  }
  if (/便宜|优惠|折扣|打折|降价|砍价|议价|少一点|cheaper|discount|bargain|sconto|prezzo più basso/i.test(normalized)) {
    return { kind: 'merchant', reason: 'commercial' };
  }
  if (/(?:提前发货|提前发|尽快发货|加急发货|更快发货|能否快点|能不能快点|ship earlier|expedite|ship sooner|spedire prima)/i.test(normalized)) {
    return { kind: 'merchant', reason: 'change_request' };
  }
  if (merchantOnlyPatterns[3].test(normalized)) {
    return { kind: 'merchant', reason: 'change_request' };
  }

  if (/包裹|物流|运单|追踪|到哪里|在哪里|tracking|where.*parcel|shipment location|tracciamento|pacco/i.test(normalized)) {
    return { kind: 'automatic', topic: 'tracking' };
  }
  if (/发货了吗|发出了吗|发货状态|备货|配货|出库|ship(?:ped|ment)?|dispatch|prepar|spedito|spedizione/i.test(normalized)) {
    return { kind: 'automatic', topic: 'shipment' };
  }
  if (/付款|支付|到账|收款|已付|付了|payment|paid|charge|pagamento|pagato|ricevuto/i.test(normalized)) {
    return { kind: 'automatic', topic: 'payment' };
  }
  if (/数量|件数|金额|总价|订单价|商品|sku|款号|quantity|amount|total|items|importo|quantità/i.test(normalized)) {
    return { kind: 'automatic', topic: 'summary' };
  }
  if (/订单|进度|状态|到哪|order status|order progress|stato ordine|avanzamento/i.test(normalized)) {
    return { kind: 'automatic', topic: 'status' };
  }
  return { kind: 'merchant', reason: 'unsupported' };
}

export type OrderChatFactSnapshot = {
  orderNo: string;
  status: string;
  currentTask: string;
  paymentStatus: string;
  totalQty: number;
  totalAmount: number;
  shippingFee: number;
  discountAmount: number;
  paidAmount: number;
  paymentAmountDue: number | null;
  items: Array<{ name: string; sku: string; quantity: number; unitPrice: number }>;
  shipments: Array<{
    status: string;
    carrier: string | null;
    trackingNumber: string | null;
    shippedAt: string | null;
    latestEvent: {
      status: string;
      location: string | null;
      description: string | null;
      occurredAt: string;
    } | null;
  }>;
};

function localizedStatus(status: string, language: 'zh' | 'en' | 'it'): string {
  const labels: Record<string, [string, string, string]> = {
    placed: ['待商家确认', 'Awaiting merchant confirmation', 'In attesa di conferma del venditore'],
    pending: ['待处理', 'Pending', 'In attesa'],
    confirmed: ['已确认', 'Confirmed', 'Confermato'],
    picking: ['备货中', 'Preparing', 'In preparazione'],
    shipped: ['运输中', 'In transit', 'In transito'],
    delivered: ['已送达', 'Delivered', 'Consegnato'],
    cancelled: ['已取消', 'Cancelled', 'Annullato'],
    returned: ['已退货', 'Returned', 'Restituito'],
    unpaid: ['未付款', 'Unpaid', 'Non pagato'],
    partially_paid: ['部分付款', 'Partially paid', 'Parzialmente pagato'],
    paid: ['已付清', 'Paid in full', 'Pagato'],
    pending_refund: ['退款处理中', 'Refund processing', 'Rimborso in elaborazione'],
    partially_refunded: ['部分退款', 'Partially refunded', 'Parzialmente rimborsato'],
    refunded: ['已退款', 'Refunded', 'Rimborsato'],
    pending_credit: ['账期待结', 'Payment due on credit terms', 'Pagamento a credito in attesa']
  };
  const index = language === 'zh' ? 0 : language === 'it' ? 2 : 1;
  return labels[status]?.[index] || status;
}

export function buildOrderChatAutoReply(
  topic: Extract<OrderChatIntent, { kind: 'automatic' }>['topic'],
  order: OrderChatFactSnapshot,
  question: string
): string {
  const language: 'zh' | 'en' | 'it' = /[\u4e00-\u9fff]/.test(question)
    ? 'zh'
    : /\b(?:ordine|spedito|pagamento|consegna|pacco|tracciamento)\b/i.test(question) ? 'it' : 'en';
  const money = (value: number) => `€${value.toFixed(2)}`;
  const status = localizedStatus(order.status, language);
  const payment = localizedStatus(order.paymentStatus, language);
  const automatic = language === 'zh' ? '自动回复（订单实时记录）' : language === 'it' ? 'Risposta automatica (dati ordine)' : 'Automatic reply (order records)';

  if (topic === 'status') {
    return language === 'zh'
      ? `${automatic}：订单 ${order.orderNo} 当前状态为「${status}」，当前进度：${order.currentTask}。`
      : language === 'it'
        ? `${automatic}: l’ordine ${order.orderNo} è "${status}". Attività corrente: ${order.currentTask}.`
        : `${automatic}: order ${order.orderNo} is "${status}". Current task: ${order.currentTask}.`;
  }
  if (topic === 'payment') {
    const due = order.paymentAmountDue == null ? '' : language === 'zh'
      ? `，当前应付 ${money(order.paymentAmountDue)}`
      : language === 'it' ? `, importo attualmente dovuto ${money(order.paymentAmountDue)}` : `, currently due ${money(order.paymentAmountDue)}`;
    return language === 'zh'
      ? `${automatic}：付款状态为「${payment}」，系统已记录净收款 ${money(order.paidAmount)}${due}。以已核实的订单付款记录为准。`
      : language === 'it'
        ? `${automatic}: stato pagamento "${payment}", incasso netto registrato ${money(order.paidAmount)}${due}. Fa fede il registro dei pagamenti verificati dell’ordine.`
        : `${automatic}: payment status is "${payment}" with net receipts of ${money(order.paidAmount)}${due}. Verified order payment records are authoritative.`;
  }
  if (topic === 'shipment' || topic === 'tracking') {
    const latest = order.shipments
      .flatMap(shipment => shipment.latestEvent ? [{ shipment, event: shipment.latestEvent }] : [])
      .sort((a, b) => b.event.occurredAt.localeCompare(a.event.occurredAt))[0];
    if (!order.shipments.length) {
      return language === 'zh'
        ? `${automatic}：目前订单记录中暂无已创建的包裹或发货信息。`
        : language === 'it' ? `${automatic}: non risultano ancora pacchi o spedizioni registrati per l’ordine.` : `${automatic}: no packages or shipment records are currently available for this order.`;
    }
    if (topic === 'tracking' && latest) {
      const location = latest.event.location ? ` · ${latest.event.location}` : '';
      const detail = latest.event.description ? ` · ${latest.event.description}` : '';
      const time = new Date(latest.event.occurredAt).toISOString();
      return language === 'zh'
        ? `${automatic}：最近一条已记录物流为「${latest.event.status}」${location}${detail}，记录时间 ${time}。这是订单中最近更新的轨迹，不代表实时 GPS。`
        : language === 'it'
          ? `${automatic}: ultimo evento registrato "${latest.event.status}"${location}${detail}, alle ${time}. È l’ultimo aggiornamento disponibile, non una posizione GPS in tempo reale.`
          : `${automatic}: the latest recorded tracking event is "${latest.event.status}"${location}${detail}, at ${time}. This is the latest available scan, not live GPS.`;
    }
    if (topic === 'tracking' && !latest) {
      return language === 'zh'
        ? `${automatic}：订单已创建 ${order.shipments.length} 个包裹，但尚无承运商扫描记录，暂时无法提供物流地点或预计送达时间。`
        : language === 'it'
          ? `${automatic}: risultano ${order.shipments.length} pacchi, ma non sono ancora disponibili scansioni del corriere né una stima di consegna.`
          : `${automatic}: ${order.shipments.length} package(s) are recorded, but no carrier scan or delivery estimate is available yet.`;
    }
    const shipped = order.shipments.filter(shipment => shipment.shippedAt || shipment.status === 'shipped' || shipment.status === 'delivered').length;
    return language === 'zh'
      ? `${automatic}：订单已记录 ${order.shipments.length} 个包裹，其中 ${shipped} 个有发货记录。包裹状态以订单内的发货记录为准。`
      : language === 'it'
        ? `${automatic}: risultano ${order.shipments.length} pacchi, ${shipped} con spedizione registrata.`
        : `${automatic}: ${order.shipments.length} package(s) are recorded; ${shipped} have a shipment record.`;
  }

  const items = order.items.slice(0, 20).map(item =>
    `${item.name}${item.sku ? ` (${item.sku})` : ''} ×${item.quantity} · ${money(item.unitPrice)}`
  );
  const more = order.items.length > 20
    ? (language === 'zh' ? `\n另有 ${order.items.length - 20} 个商品规格。` : `\n${order.items.length - 20} more item lines.`)
    : '';
  return language === 'zh'
    ? `${automatic}：共 ${order.totalQty} 件，商品金额 ${money(order.totalAmount)}，运费 ${money(order.shippingFee)}，折扣 ${money(order.discountAmount)}；净收款 ${money(order.paidAmount)}。商品：${items.join('；') || '暂无明细'}。${more}`
    : `${automatic}: ${order.totalQty} items; goods ${money(order.totalAmount)}, shipping ${money(order.shippingFee)}, discount ${money(order.discountAmount)}; net receipts ${money(order.paidAmount)}. Lines: ${items.join('; ') || 'no item details'}.${more}`;
}
