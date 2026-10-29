import React, { useEffect, useMemo, useState } from 'react';
import { useB2B } from '../../../../context/B2BContext';
import { Minus, Plus, Trash2, ShoppingBag, ArrowLeft, Tag, Percent, Truck, Shield } from 'lucide-react';
import { CONSUMER_RETAIL_FREE_SHIPPING_THRESHOLD, CONSUMER_RETAIL_SHIPPING_FEE } from '../../../../shared/consumerRetail';

export const ConsumerCart: React.FC = () => {
  const { consumerCart, updateConsumerCartQty, removeFromConsumerCart, clearConsumerCart, formatMoney, calculateConsumerCartPromo, lastPromoCalc, setCurrentView, authConsumer, consumerAddresses } = useB2B();
  const [coupon, setCoupon] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<string | null>(null);

  useEffect(() => {
    if (consumerCart.length > 0) void calculateConsumerCartPromo(appliedCoupon || undefined);
  }, [JSON.stringify(consumerCart), appliedCoupon]);

  const subtotal = useMemo(() => consumerCart.reduce((s, c) => s + c.retailPrice * c.quantity, 0), [consumerCart]);
  const discount = lastPromoCalc?.discountTotal || 0;
  // 运费与折扣以服务端试算为准；服务端不可用时用共享常量兜底，VAT 一律不在此处计算。
  const shipping = lastPromoCalc?.shippingFee ?? (subtotal - discount >= CONSUMER_RETAIL_FREE_SHIPPING_THRESHOLD ? 0 : CONSUMER_RETAIL_SHIPPING_FEE);
  const total = Math.max(0, subtotal - discount + shipping);

  const applyCoupon = () => {
    const code = coupon.trim().toUpperCase();
    if (!code) return;
    setAppliedCoupon(code);
    void calculateConsumerCartPromo(code);
  };

  if (consumerCart.length === 0) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 md:py-24 text-center">
        <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-neutral-100 flex items-center justify-center">
          <ShoppingBag className="w-10 h-10 text-neutral-400" />
        </div>
        <h1 className="font-serif font-black text-3xl mb-3 text-neutral-950">您的购物袋是空的</h1>
        <p className="text-neutral-500 mb-8 text-sm leading-7">浏览 RUDA 精选的意大利设计师成衣，或从愿望清单中挑选您的心仪单品。</p>
        <div className="flex flex-wrap justify-center gap-3">
          <button onClick={() => setCurrentView('consumer_store')} className="ui-primary-button px-7 py-3 text-sm">开始选购</button>
          {authConsumer && <button onClick={() => setCurrentView('consumer_wishlist')} className="ui-secondary-button px-7 py-3 text-sm">查看愿望清单</button>}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-6 py-8 md:py-12">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <button onClick={() => setCurrentView('consumer_store')} className="mb-3 inline-flex items-center gap-1.5 text-xs font-semibold text-neutral-500 hover:text-neutral-900 transition">
            <ArrowLeft className="w-3.5 h-3.5" /> 返回商城继续选购
          </button>
          <h1 className="font-serif font-black text-3xl md:text-4xl text-neutral-950">我的购物袋 <span className="text-lg font-bold text-neutral-400 ml-3 align-middle">({consumerCart.reduce((s, c) => s + c.quantity, 0)} 件)</span></h1>
        </div>
        <button onClick={() => clearConsumerCart()} className="text-xs font-semibold text-neutral-500 hover:text-rose-600 transition flex items-center gap-1.5">
          <Trash2 className="w-3.5 h-3.5" /> 清空购物袋
        </button>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-3">
          {consumerCart.map(item => {
            const base = item.retailPrice;
            return (
              <div key={`${item.productId}-${item.size || 'std'}-${item.color || 'def'}`} className="ui-card p-4 md:p-5 flex gap-4">
                <div className="w-24 md:w-32 aspect-[3/4] rounded-xl overflow-hidden bg-neutral-100 shrink-0">
                  <img src={item.image || '/pwa-512x512.png'} alt="" className="w-full h-full object-cover" />
                </div>
                <div className="flex-1 min-w-0 flex flex-col">
                  <div className="flex justify-between gap-3 mb-1">
                    <div className="min-w-0">
                      <p className="text-[10px] uppercase tracking-[0.2em] text-neutral-500 font-semibold mb-1">{item.styleNo || 'RUDA'}</p>
                      <h3 className="font-bold text-sm md:text-base text-neutral-900 leading-snug truncate">{item.productName}</h3>
                    </div>
                    <span className="font-black text-lg text-neutral-950 whitespace-nowrap">{formatMoney(base * item.quantity)}</span>
                  </div>
                  <div className="text-xs text-neutral-500 mb-3 space-y-0.5">
                    <div>尺码 Size: <span className="font-semibold text-neutral-700">{item.size || 'M'}</span> · 颜色: <span className="font-semibold text-neutral-700">{item.color || '黑色'}</span></div>
                    <div>单价 Unit: <span className="font-semibold text-neutral-700">{formatMoney(base)}</span></div>
                  </div>
                  <div className="mt-auto flex items-center justify-between">
                    <div className="flex items-center gap-2 bg-neutral-100 rounded-xl p-1">
                      <button onClick={() => updateConsumerCartQty(item.id, item.quantity - 1)} disabled={item.quantity <= 1} className="w-8 h-8 rounded-lg hover:bg-white flex items-center justify-center transition disabled:opacity-40 disabled:cursor-not-allowed">
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="min-w-6 text-center text-sm font-bold tabular-nums">{item.quantity}</span>
                      <button onClick={() => updateConsumerCartQty(item.id, item.quantity + 1)} className="w-8 h-8 rounded-lg hover:bg-white flex items-center justify-center transition">
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <button onClick={() => removeFromConsumerCart(item.id)} className="text-xs font-semibold text-neutral-500 hover:text-rose-600 transition flex items-center gap-1.5">
                      <Trash2 className="w-3.5 h-3.5" /> 删除
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
            {[
              { ic: <Truck className="w-5 h-5" />, t: '免费配送', d: '订单满 €200 免邮' },
              { ic: <Shield className="w-5 h-5" />, t: '正品保证', d: '官方认证品牌渠道' },
              { ic: <Percent className="w-5 h-5" />, t: '14 天无忧退换', d: '全球售后保障' },
            ].map((x, i) => (
              <div key={i} className="ui-card p-4 flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-neutral-900 text-white flex items-center justify-center shrink-0">{x.ic}</div>
                <div>
                  <h4 className="font-bold text-sm mb-0.5">{x.t}</h4>
                  <p className="text-xs text-neutral-500 leading-5">{x.d}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-1">
          <div className="ui-card p-6 sticky top-24">
            <h2 className="font-black text-xl mb-5 text-neutral-950">订单摘要</h2>
            <div className="mb-4">
              <label className="ui-section-title block mb-2">优惠码 / 优惠券</label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Tag className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                  <input value={coupon} onChange={e => setCoupon(e.target.value)} placeholder="输入 RUDA20 / NEW20 ..."
                    className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-neutral-200 bg-neutral-50/50 text-sm focus:border-neutral-900 focus:bg-white focus:outline-none uppercase" />
                </div>
                <button onClick={applyCoupon} className="px-4 rounded-xl bg-neutral-900 text-white text-sm font-semibold hover:bg-neutral-700 transition">应用</button>
              </div>
              {appliedCoupon && lastPromoCalc && lastPromoCalc.discountTotal > 0 && (
                <div className="mt-2 px-3 py-2 rounded-xl bg-emerald-50 text-emerald-700 text-xs font-semibold flex items-center justify-between">
                  <span>✓ 优惠券 {appliedCoupon} 已应用</span>
                  <button onClick={() => { setAppliedCoupon(null); setCoupon(''); void calculateConsumerCartPromo(); }} className="text-emerald-800 hover:underline">移除</button>
                </div>
              )}
              {lastPromoCalc && lastPromoCalc.appliedPromotions && lastPromoCalc.appliedPromotions.length > 0 && (
                <div className="mt-3 space-y-1.5">
                  {lastPromoCalc.appliedPromotions.map((p, i) => (
                    <div key={i} className="px-3 py-2 rounded-lg bg-amber-50 text-amber-800 text-[11px] font-semibold flex items-center gap-2">
                      <Percent className="w-3.5 h-3.5" /> {p.promotionName} {p.amountSaved > 0 && <span className="ml-auto">-{formatMoney(p.amountSaved)}</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <dl className="space-y-2.5 mb-5 text-sm">
              <div className="flex justify-between"><dt className="text-neutral-600">商品小计</dt><dd className="font-semibold tabular-nums">{formatMoney(subtotal)}</dd></div>
              {discount > 0 && <div className="flex justify-between text-emerald-700"><dt>优惠折扣</dt><dd className="font-bold tabular-nums">-{formatMoney(discount)}</dd></div>}
              <div className="flex justify-between"><dt className="text-neutral-600">运费 Shipping</dt><dd className="font-semibold tabular-nums">{shipping === 0 ? <span className="text-emerald-700">FREE</span> : formatMoney(shipping)}</dd></div>
              <div className="flex justify-between"><dt className="text-neutral-600">VAT / 关税</dt><dd className="text-xs font-semibold text-neutral-500">结账时由服务端按商品与收货国计算</dd></div>
            </dl>
            <div className="pt-4 border-t border-neutral-200/70 mb-5 flex items-end justify-between">
              <span className="text-sm text-neutral-600">商品金额（不含 VAT）</span>
              <span className="font-black text-3xl text-neutral-950 tabular-nums">{formatMoney(total)}</span>
            </div>
            <button onClick={() => authConsumer ? (consumerAddresses.length > 0 ? setCurrentView('consumer_checkout') : setCurrentView('consumer_account')) : setCurrentView('consumer_login')} className="ui-primary-button w-full py-3.5 text-sm flex items-center justify-center gap-2">
              {authConsumer ? (consumerAddresses.length > 0 ? '查看结账说明' : '先完善收货地址') : '先登录 Checkout as Guest'}
            </button>
            <div className="mt-4 text-[11px] text-neutral-400 leading-6 text-center">结账流程尚未开放；开放前不会收取任何款项。下单即代表您同意《购物条款》。</div>
          </div>
        </div>
      </div>
    </div>
  );
};
