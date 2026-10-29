import React from 'react';
import { useB2B } from '../../../../context/B2BContext';
import { Order } from '../../../../types/b2b';
import { getOrderChainTask } from '../../../../shared/orderChain';

const steps: Array<[string, string]> = [
  ['待确认', 'In attesa'],
  ['约定确认中', 'Conferma accordi'],
  ['处理中', 'In lavorazione'],
  ['运输中', 'In transito'],
  ['已送达 / 已完成', 'Consegnato / completato']
];

export const OrderProgressSummary: React.FC<{ order: Order; compact?: boolean; role?: 'buyer' | 'merchant' }> = ({
  order,
  compact = false,
  role = 'buyer'
}) => {
  const { localizeCopy } = useB2B();
  const currentAgreement = [...(order.agreementVersions || [])].sort((left, right) => right.version - left.version)[0];
  const task = getOrderChainTask({
    status: order.status,
    paymentStatus: order.paymentStatus,
    paymentMethod: order.paymentMethod,
    paymentPlan: currentAgreement?.terms.paymentPlan,
    remainingBalanceTrigger: currentAgreement?.terms.remainingBalanceTrigger,
    totalAmount: order.totalAmount,
    paidAmount: order.paidAmount,
    paymentAmountDue: order.paymentAmountDue,
    canBeginPreparation: order.canBeginPreparation,
    canShipOrder: order.canShipOrder
  }, role, currentAgreement?.status);
  const currentStep = task.phase;
  const cancelled = currentStep < 0;
  const taskIt = ({
    '查看处理记录': 'Visualizza i dettagli',
    '确认商家提出的交易约定': 'Conferma le condizioni del venditore',
    '等待客户确认交易约定': 'In attesa della conferma del cliente',
    '审核并确认交易约定': 'Verifica e conferma le condizioni',
    '等待商家确认交易约定': 'In attesa della conferma del venditore',
    '结清应付款': 'Saldo da pagare',
    '等待结款': 'In attesa del saldo',
    '核实并触发约定余款条件': 'Verifica la condizione del saldo',
    '订单已完成': 'Ordine completato',
    '查看包裹物流记录': 'Visualizza il tracciamento',
    '按已确认约定完成付款': 'Paga secondo le condizioni confermate',
    '按约定准备或发货': 'Prepara o spedisci secondo gli accordi',
    '商家正在准备订单': 'Il venditore sta preparando l’ordine',
    '审核订单并确认交易约定': 'Verifica e conferma le condizioni',
    '等待商家审核订单': 'In attesa della verifica del venditore'
  } as Record<string, string>)[task.task] || task.task;
  const currentTask = localizeCopy(task.task, taskIt);

  return (
    <section className={`rounded-xl border border-neutral-200 bg-white ${compact ? 'p-3' : 'p-4'}`} aria-label={localizeCopy('订单进度', 'Avanzamento ordine')}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-xs font-bold text-neutral-900">{localizeCopy('订单进度', 'Avanzamento ordine')}</h3>
        <span className={`text-xs font-semibold ${cancelled ? 'text-neutral-500' : 'text-neutral-900'}`}>
          {currentTask}
        </span>
      </div>
      {cancelled ? (
        <p className="rounded-lg bg-neutral-100 px-3 py-2 text-xs text-neutral-600">{currentTask}</p>
      ) : (
        <ol className="grid grid-cols-5 gap-1" aria-label={`${localizeCopy('当前进度', 'Avanzamento attuale')}：${localizeCopy(steps[currentStep][0], steps[currentStep][1])}`}>
          {steps.map(([stepZh, stepIt], index) => {
            const complete = index < currentStep || (index === 4 && currentStep === 4);
            const active = index === currentStep && currentStep !== 4;
            return (
              <li key={stepZh} className="min-w-0 text-center">
                <span
                  className={`mb-1 block h-1.5 rounded-full ${
                    complete || active ? 'bg-neutral-900' : 'bg-neutral-200'
                  }`}
                  aria-hidden="true"
                />
                <span className={`text-[10px] sm:text-xs ${complete || active || currentStep === 4 && index === 4 ? 'font-semibold text-neutral-900' : 'text-neutral-400'}`}>
                  {localizeCopy(stepZh, stepIt)}
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
};
