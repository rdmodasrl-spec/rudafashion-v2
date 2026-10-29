export type OrderPaymentPlan =
  | 'full_prepayment'
  | 'ship_before_payment'
  | 'partial_prepayment'
  | 'cash_on_delivery'
  | 'custom';

export interface OrderChainState {
  status: string;
  paymentStatus: string;
  paymentMethod: string;
  paymentPlan?: OrderPaymentPlan;
  remainingBalanceTrigger?: string;
  totalAmount: number;
  paidAmount?: number;
  paymentAmountDue?: number;
  canBeginPreparation?: boolean;
  canShipOrder?: boolean;
}

export interface OrderChainTask {
  phase: number;
  label: string;
  task: string;
  action: 'confirm_agreement' | 'review_agreement' | 'pay' | 'pay_balance' | 'fulfill' | 'trigger_balance' | 'edit_draft' | null;
}

function outstanding(totalAmount: number, paidAmount = 0): number {
  return Number(Math.max(0, totalAmount - paidAmount).toFixed(2));
}

export function getOrderChainTask(
  order: OrderChainState,
  role: 'buyer' | 'merchant',
  agreementStatus?: string
): OrderChainTask {
  if (order.status === 'draft') {
    return {
      phase: 0,
      label: '草稿',
      task: role === 'merchant' ? '继续编辑订单草稿' : '订单尚未提交',
      action: role === 'merchant' ? 'edit_draft' : null
    };
  }
  if (order.status === 'cancelled' || order.status === 'returned') {
    return { phase: -1, label: order.status === 'cancelled' ? '已取消' : '已退货', task: '查看处理记录', action: null };
  }
  if (agreementStatus === 'pending_buyer') {
    return {
      phase: 1,
      label: '约定确认中',
      task: role === 'buyer' ? '确认商家提出的交易约定' : '等待客户确认交易约定',
      action: role === 'buyer' ? 'confirm_agreement' : null
    };
  }
  if (agreementStatus === 'pending_merchant') {
    return {
      phase: 1,
      label: '约定确认中',
      task: role === 'merchant' ? '审核并确认交易约定' : '等待商家确认交易约定',
      action: role === 'merchant' ? 'review_agreement' : null
    };
  }

  const plan = order.paymentPlan || (order.paymentMethod === 'net_30' || order.paymentMethod === 'net_30_days'
    ? 'ship_before_payment'
    : 'full_prepayment');
  const unpaid = outstanding(order.totalAmount, order.paidAmount);
  const due = order.paymentAmountDue ?? unpaid;
  if (order.paymentStatus === 'pending' && unpaid > 0) {
    return {
      phase: order.status === 'delivered' ? 4 : order.status === 'shipped' ? 3 : 2,
      label: order.status === 'delivered' ? '已送达' : order.status === 'shipped' ? '运输中' : '处理中',
      task: role === 'buyer' ? '等待付款核实' : '核实付款状态',
      action: null
    };
  }
  if (role === 'merchant' && unpaid > 0 && due === 0
    && order.remainingBalanceTrigger === 'custom'
    && ['confirmed', 'picking', 'shipped', 'delivered'].includes(order.status)) {
    return {
      phase: order.status === 'delivered' ? 4 : order.status === 'shipped' ? 3 : 2,
      label: order.status === 'delivered' ? '已送达' : order.status === 'shipped' ? '运输中' : '处理中',
      task: '核实并触发约定余款条件',
      action: 'trigger_balance'
    };
  }
  if (order.status === 'delivered' && unpaid > 0 && due > 0) {
    return { phase: 4, label: '已送达', task: role === 'buyer' ? '结清应付款' : '等待结款', action: role === 'buyer' ? 'pay_balance' : null };
  }
  if (order.status === 'delivered' && unpaid > 0) {
    return { phase: 4, label: '已送达', task: '等待约定结款条件', action: null };
  }
  if (order.status === 'delivered' && unpaid === 0) {
    return { phase: 4, label: '已完成', task: '订单已完成', action: null };
  }
  if (order.status === 'shipped') {
    return { phase: 3, label: '运输中', task: '查看包裹物流记录', action: null };
  }
  if (order.status === 'picking' || order.status === 'confirmed') {
    if (role === 'merchant' && order.status === 'confirmed' && order.canBeginPreparation === false) {
      return { phase: 2, label: '处理中', task: '等待约定预付款到账', action: null };
    }
    if (role === 'merchant' && order.status === 'picking' && order.canShipOrder === false) {
      return { phase: 2, label: '处理中', task: '等待发货付款条件满足', action: null };
    }
    if (role === 'buyer' && due > 0) {
      return { phase: 2, label: '处理中', task: '按已确认约定完成付款', action: 'pay' };
    }
    return {
      phase: 2,
      label: '处理中',
      task: role === 'merchant' ? '按约定准备或发货' : '商家正在准备订单',
      action: role === 'merchant' ? 'fulfill' : null
    };
  }
  return {
    phase: 0,
    label: '待确认',
    task: role === 'merchant' ? '审核订单并确认交易约定' : '等待商家审核订单',
    action: role === 'merchant' ? 'review_agreement' : null
  };
}
