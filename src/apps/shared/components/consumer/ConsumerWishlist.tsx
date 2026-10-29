import React, { useEffect } from 'react';
import { useB2B } from '../../../../context/B2BContext';
import { Heart, ShoppingBag, Trash2, Star } from 'lucide-react';

export const ConsumerWishlist: React.FC = () => {
  const { consumerWishlist, loadConsumerWishlist, toggleConsumerWishlist, addToConsumerCart, formatMoney, setCurrentView } = useB2B();
  useEffect(() => { void loadConsumerWishlist(); }, [loadConsumerWishlist]);

  if (consumerWishlist.length === 0) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 md:py-24 text-center">
        <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-rose-50 flex items-center justify-center">
          <Heart className="w-12 h-12 text-rose-400" />
        </div>
        <h1 className="font-serif font-black text-3xl mb-3 text-neutral-950">您的愿望清单是空的</h1>
        <p className="text-neutral-500 mb-8 text-sm leading-7">浏览 RUDA 精选，将心仪单品加入愿望清单，补货与降价会第一时间通知您。</p>
        <button onClick={() => setCurrentView('consumer_store')} className="ui-primary-button px-7 py-3 text-sm">去逛商城</button>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-6 py-8 md:py-12">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif font-black text-3xl md:text-4xl text-neutral-950 mb-1 flex items-center gap-3">
            <Heart className="w-8 h-8 fill-rose-500 text-rose-500" /> 我的愿望清单
          </h1>
          <p className="text-sm text-neutral-500">共 {consumerWishlist.length} 件收藏的单品，降价即提醒</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => {
            consumerWishlist.forEach(product => {
              const sku = product.skus[0]?.sku;
              if (sku) addToConsumerCart(product.id, sku, 1);
            });
            setCurrentView('consumer_cart');
          }} className="ui-primary-button px-5 py-2.5 text-xs flex items-center gap-1.5">
            <ShoppingBag className="w-3.5 h-3.5" /> 一键全部加入购物袋
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
        {consumerWishlist.map(p => {
          const price = p.rrpPrice || p.wholesalePrice * 2.2;
          return (
            <div key={p.id} className="group relative bg-white rounded-2xl overflow-hidden border border-neutral-200/80 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300">
              <div className="relative aspect-[3/4] overflow-hidden bg-neutral-100">
                <img src={p.images?.[0] || '/pwa-512x512.png'} alt="" loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                <button onClick={() => toggleConsumerWishlist(p.id, false)} className="absolute top-3 right-3 w-9 h-9 rounded-full bg-rose-500/95 text-white backdrop-blur flex items-center justify-center shadow-sm hover:scale-110 transition">
                  <Heart className="w-4 h-4 fill-white" />
                </button>
                <div className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-white/95 backdrop-blur text-[10px] font-black text-neutral-900 tracking-wide shadow-sm">
                  收藏
                </div>
              </div>
              <div className="p-4">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] uppercase tracking-wider text-neutral-500 font-semibold">{p.brand || p.merchantName || 'RUDA'}</span>
                  <span className="text-[10px] text-neutral-500">{p.season}</span>
                </div>
                <h3 className="text-sm font-semibold text-neutral-900 leading-snug mb-1 line-clamp-2 min-h-[2.5rem]">{p.name}</h3>
                <div className="flex items-baseline gap-2 mb-4">
                  <span className="font-black text-lg text-neutral-950 leading-none">{formatMoney(price)}</span>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => { const sku = p.skus[0]?.sku; if (sku) addToConsumerCart(p.id, sku, 1); }} className="flex-1 ui-primary-button !py-2.5 !text-xs !rounded-xl flex items-center justify-center gap-1.5">
                    <ShoppingBag className="w-3.5 h-3.5" /> 加入购物袋
                  </button>
                  <button onClick={() => toggleConsumerWishlist(p.id, false)} title="移除" className="w-11 h-11 rounded-xl border border-neutral-200 hover:border-rose-300 hover:bg-rose-50 flex items-center justify-center transition">
                    <Trash2 className="w-4 h-4 text-neutral-500 hover:text-rose-600" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
