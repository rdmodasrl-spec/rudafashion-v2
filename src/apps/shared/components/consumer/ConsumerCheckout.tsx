import React from 'react';
import { useB2B } from '../../../../context/B2BContext';
import { ArrowLeft, Building2, CreditCard } from 'lucide-react';

export const ConsumerCheckout: React.FC = () => {
  const { consumerCart, formatMoney, setCurrentView } = useB2B();
  const subtotal = consumerCart.reduce((sum, item) => sum + item.retailPrice * item.quantity, 0);
  const itemCount = consumerCart.reduce((sum, item) => sum + item.quantity, 0);

  if (consumerCart.length === 0) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center">
        <h1 className="font-serif font-black text-2xl mb-3">购物袋为空</h1>
        <button onClick={() => setCurrentView('consumer_store')} className="ui-primary-button mt-4">返回商城</button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      <button onClick={() => setCurrentView('consumer_cart')} className="mb-6 inline-flex items-center gap-1.5 text-xs font-semibold text-neutral-500 hover:text-neutral-900 transition">
        <ArrowLeft className="w-3.5 h-3.5" /> 返回购物袋
      </button>
      <section className="ui-card p-6 md:p-8">
        <h1 className="font-serif font-black text-2xl text-neutral-950">消费者结账暂不可用</h1>
        <p className="mt-3 text-sm leading-6 text-neutral-600">
          为避免向您显示错误金额或不完整的卖家信息，订单提交暂时关闭。VAT 和配送费须按商品及收货国家由服务端计算；每个卖家的退货地址及退货运费规则也须在下单前展示。
        </p>
        <div className="mt-6 rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
          <div className="flex items-center gap-2 text-sm font-bold text-neutral-900">
            <CreditCard className="h-4 w-4" /> 付款方式：客人直接向卖家银行转账
          </div>
          <p className="mt-2 text-xs leading-5 text-neutral-600">
            每次只为一个卖家创建订单，RUDA 不代收。订单确认后展示该卖家已审核的银行账户；款项到账并由卖家人工核实前，订单保持待付款。
          </p>
        </div>
        <div className="mt-6 border-t border-neutral-200 pt-5">
          <div className="flex items-center justify-between text-sm text-neutral-600">
            <span>购物袋商品</span>
            <span>{itemCount} 件 · 商品金额 {formatMoney(subtotal)}</span>
          </div>
          <p className="mt-2 text-xs text-neutral-500">此金额不含 VAT 和运费，不能作为应付总额。</p>
        </div>
        <div role="status" className="mt-5 rounded-xl bg-amber-50 p-3 text-xs leading-5 text-amber-900">
          已开通的 VAT API 尚未接入应用服务端；消费者订单和转账核验流程也未就绪。完成服务端税额报价、订单及卖家账户校验后才能开放结账。
        </div>
        <div className="mt-6 flex flex-wrap gap-3">
          <button onClick={() => setCurrentView('consumer_cart')} className="ui-primary-button px-6 py-3 text-sm">返回购物袋</button>
          <a href="/about#terms" className="ui-secondary-button inline-flex items-center gap-2 px-6 py-3 text-sm">
            <Building2 className="h-4 w-4" /> 查看购物条款
          </a>
        </div>
      </section>
    </div>
  );
};
