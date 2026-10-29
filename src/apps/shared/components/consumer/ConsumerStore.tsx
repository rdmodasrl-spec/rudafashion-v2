import React, { useEffect, useState } from 'react';
import { useB2B } from '../../../../context/B2BContext';
import { Heart, Search, ShoppingBag, SlidersHorizontal, Star, X, Eye } from 'lucide-react';
import type { Product } from '../../../../types/b2b';

export const ConsumerStore: React.FC = () => {
  const { loadConsumerRetailProducts, consumerRetailProducts, consumerRetailProductsMeta, formatMoney, consumerWishlist, toggleConsumerWishlist, addToConsumerCart, loadConsumerWishlist, setCurrentView, consumerCart, authConsumer, setSelectedProductId, products } = useB2B();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<string>('all');
  const [sort, setSort] = useState<'newest' | 'price_asc' | 'price_desc' | 'popular'>('newest');
  const [quick, setQuick] = useState<Product | null>(null);
  const [page, setPage] = useState(1);
  useEffect(() => { void loadConsumerRetailProducts({ q: search || undefined, category: category !== 'all' ? category : undefined, sort, page }); }, [loadConsumerRetailProducts, search, category, sort, page]);
  useEffect(() => { if (authConsumer) void loadConsumerWishlist(); }, [authConsumer, loadConsumerWishlist]);

  const catList = ['all', 'dresses', 'tops', 'knitwear', 'outerwear', 'pants', 'skirts', 'accessories', 'shoes'];
  const catLabels: Record<string, string> = { all: '全部 ALL', dresses: '连衣裙', tops: '上衣 T恤', knitwear: '针织毛衫', outerwear: '外套大衣', pants: '裤装', skirts: '半裙', accessories: '配饰包袋', shoes: '鞋履' };

  return (
    <div className="max-w-[1400px] mx-auto px-4 md:px-6 pt-6 md:pt-10">
      <div className="mb-8 relative overflow-hidden rounded-3xl bg-gradient-to-br from-neutral-900 via-neutral-800 to-neutral-950 text-white p-8 md:p-14">
        <div className="absolute -right-10 -top-10 w-64 h-64 rounded-full bg-white/5 blur-3xl" />
        <div className="absolute right-20 bottom-0 w-40 h-40 rounded-full bg-amber-400/10 blur-3xl" />
        <div className="relative max-w-xl">
          <p className="text-xs uppercase tracking-[0.3em] text-white/60 mb-3">RUDA Fashion · Retail · FW 2025</p>
          <h1 className="font-serif font-black text-3xl md:text-5xl leading-[1.05] mb-4">精选意大利成衣<br />直送您的衣橱</h1>
          <p className="text-sm md:text-base text-white/75 leading-7 mb-6">来自 RUDA 认证的意大利设计师、品牌工厂与官方展厅，为个人消费者提供同渠道时装，首单立减 €20，全球 48h 发货，无忧售后。</p>
          <div className="flex flex-wrap gap-3">
            <button onClick={() => setCategory('dresses')} className="px-5 py-2.5 rounded-full bg-white text-neutral-950 text-sm font-semibold hover:bg-neutral-100 transition">立即选购连衣裙</button>
            <button onClick={() => setCurrentView('consumer_wishlist')} className="px-5 py-2.5 rounded-full bg-white/10 backdrop-blur text-sm font-semibold hover:bg-white/20 transition border border-white/20">我的愿望清单 {consumerWishlist.length > 0 && `(${consumerWishlist.length})`}</button>
          </div>
        </div>
      </div>

      <div className="mb-6 flex flex-col md:flex-row md:items-center gap-4 sticky top-14 z-20 bg-neutral-50/95 backdrop-blur-md py-3 -mx-4 md:-mx-6 px-4 md:px-6 border-b border-neutral-200/60">
        <div className="relative flex-1 max-w-xl">
          <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="搜索商品、品牌或款号 (例如: dress, knits, RD2401)..."
            className="w-full pl-11 pr-4 py-3 rounded-2xl border border-neutral-200 bg-white text-sm focus:border-neutral-900 focus:outline-none transition shadow-sm" />
        </div>
        <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0 flex-1">
          {catList.map(c => (
            <button key={c} onClick={() => { setCategory(c); setPage(1); }}
              className={`shrink-0 px-3.5 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition ${category === c ? 'bg-neutral-900 text-white shadow-sm' : 'bg-white text-neutral-600 border border-neutral-200 hover:border-neutral-400'}`}>
              {catLabels[c] || c}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 rounded-2xl bg-white border border-neutral-200 px-1 py-1 text-xs">
            <SlidersHorizontal className="w-3.5 h-3.5 text-neutral-500 ml-1.5" />
            {([
              ['newest', '新品'],
              ['price_asc', '价低'],
              ['price_desc', '价高'],
              ['popular', '热销'],
            ] as const).map(([k, label]) => (
              <button key={k} onClick={() => setSort(k)} className={`px-3 py-1.5 rounded-xl font-medium transition ${sort === k ? 'bg-neutral-900 text-white' : 'text-neutral-600 hover:text-neutral-900'}`}>{label}</button>
            ))}
          </div>
          <button onClick={() => setCurrentView('consumer_cart')} className="relative rounded-2xl bg-neutral-900 text-white px-4 py-3 hover:bg-neutral-800 transition flex items-center gap-2">
            <ShoppingBag className="w-4 h-4" />
            <span className="hidden md:inline text-sm font-semibold">购物袋</span>
            {consumerCart.length > 0 && <span className="absolute -top-1.5 -right-1.5 min-w-5 h-5 px-1 rounded-full bg-amber-400 text-[11px] font-black text-neutral-950 flex items-center justify-center">{consumerCart.reduce((s, i) => s + i.quantity, 0)}</span>}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6 pb-12">
        {consumerRetailProducts.map(p => {
          const onWish = consumerWishlist.some(w => w.id === p.id);
          const price = p.rrpPrice || p.wholesalePrice * 2.2 || 99;
          const orig = price * 1.3;
          return (
            <div key={p.id} className="group relative bg-white rounded-2xl overflow-hidden border border-neutral-200/80 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300">
              <div className="relative aspect-[3/4] overflow-hidden bg-neutral-100">
                <img src={p.images?.[0] || '/pwa-512x512.png'} alt={p.name} loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                {p.rrpPrice > p.wholesalePrice * 2 && <div className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-rose-500/95 backdrop-blur text-[10px] font-black text-white tracking-wide">SALE</div>}
                <div className="absolute inset-x-3 bottom-3 flex items-center justify-between gap-2 opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all duration-300">
                  <button onClick={() => setQuick(p)} className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-white/95 backdrop-blur text-[11px] font-bold text-neutral-900 shadow-lg">
                    <Eye className="w-3.5 h-3.5" /> 快速查看
                  </button>
                </div>
                <button onClick={() => authConsumer ? toggleConsumerWishlist(p.id, !onWish) : setCurrentView('consumer_login')}
                  className="absolute top-3 right-3 w-9 h-9 rounded-full bg-white/95 backdrop-blur flex items-center justify-center shadow-sm hover:scale-110 transition">
                  <Heart className={`w-4 h-4 ${onWish ? 'fill-rose-500 text-rose-500' : 'text-neutral-500'}`} />
                </button>
              </div>
              <div className="p-4">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] uppercase tracking-wider text-neutral-500 font-semibold">{p.brand || p.merchantName || 'RUDA'}</span>
                  <span className="text-[10px] text-neutral-500">{p.season}</span>
                </div>
                <h3 className="text-sm font-semibold text-neutral-900 leading-snug mb-1 line-clamp-2 min-h-[2.5rem]">{p.name}</h3>
                <div className="text-[11px] text-neutral-500 mb-3">款号 {p.styleNo || p.id.slice(0, 8)}</div>
                <div className="flex items-end justify-between mb-3">
                  <div className="flex items-baseline gap-2">
                    <span className="font-black text-lg text-neutral-950 leading-none">{formatMoney(price)}</span>
                    {p.rrpPrice > p.wholesalePrice * 2 && <span className="text-xs text-neutral-400 line-through">{formatMoney(orig)}</span>}
                  </div>
                </div>
                <button onClick={() => { const sku = p.skus[0]?.sku; if (sku) addToConsumerCart(p.id, sku, 1); }} className="w-full ui-primary-button !py-2.5 !text-xs !rounded-xl flex items-center justify-center gap-1.5">
                  <ShoppingBag className="w-3.5 h-3.5" /> 加入购物袋
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {(consumerRetailProductsMeta ? Math.ceil(consumerRetailProductsMeta.total / consumerRetailProductsMeta.limit) : 1) > 1 && (
        <div className="flex items-center justify-center gap-2 pb-10">
          {Array.from({ length: Math.min(5, consumerRetailProductsMeta ? Math.ceil(consumerRetailProductsMeta.total / consumerRetailProductsMeta.limit) : 1) }, (_, i) => i + 1).map(n => (
            <button key={n} onClick={() => setPage(n)} className={`min-w-10 h-10 rounded-xl text-sm font-semibold transition ${page === n ? 'bg-neutral-900 text-white shadow' : 'bg-white border border-neutral-200 text-neutral-700 hover:border-neutral-500'}`}>{n}</button>
          ))}
          {page < (consumerRetailProductsMeta ? Math.ceil(consumerRetailProductsMeta.total / consumerRetailProductsMeta.limit) : 1) && (
            <button onClick={() => setPage(p => p + 1)} className="px-4 h-10 rounded-xl text-sm font-semibold bg-white border border-neutral-200 text-neutral-700 hover:border-neutral-500 transition">下一页 →</button>
          )}
        </div>
      )}

      {quick && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setQuick(null)}>
          <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[90vh] overflow-auto shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="grid md:grid-cols-2">
              <div className="aspect-[3/4] bg-neutral-100 overflow-hidden rounded-t-3xl md:rounded-l-3xl md:rounded-tr-none">
                <img src={quick.images?.[0] || '/pwa-512x512.png'} className="w-full h-full object-cover" alt="" />
              </div>
              <div className="p-6 md:p-8 relative">
                <button onClick={() => setQuick(null)} className="absolute top-4 right-4 w-10 h-10 rounded-full bg-neutral-100 hover:bg-neutral-200 flex items-center justify-center transition"><X className="w-4 h-4" /></button>
                <p className="text-[10px] uppercase tracking-[0.25em] text-neutral-500 mb-2">{quick.brand || quick.merchantName || 'RUDA Exclusive'}</p>
                <h2 className="font-serif font-black text-2xl md:text-3xl leading-tight mb-2">{quick.name}</h2>
                <div className="flex items-center gap-3 mb-4">
                  <span className="flex items-center gap-0.5 text-sm text-amber-600">
                    {[...Array(5)].map((_, i) => <Star key={i} className={`w-4 h-4 ${i < 4 ? 'fill-amber-500 text-amber-500' : 'text-neutral-300'}`} />)}
                    <span className="ml-1 text-xs font-semibold">4.7 (248 reviews)</span>
                  </span>
                </div>
                <p className="text-sm text-neutral-600 leading-7 mb-5">{quick.description || '精致的意式做工，精选面料带来柔和垂坠感与高级触感。易打理、抗皱、四季皆宜。'}</p>
                <div className="flex items-baseline gap-3 mb-5">
                  <span className="font-black text-3xl text-neutral-950">{formatMoney(quick.rrpPrice || quick.wholesalePrice * 2.2)}</span>
                  {quick.rrpPrice > quick.wholesalePrice * 2 && <span className="text-sm text-neutral-400 line-through">{formatMoney(quick.rrpPrice * 1.3)}</span>}
                  <span className="px-2.5 py-1 rounded-full bg-rose-50 text-rose-600 text-[10px] font-black">限时 23% OFF</span>
                </div>
                <div className="mb-5">
                  <span className="ui-section-title block mb-2">尺码 Size</span>
                  <div className="flex flex-wrap gap-2">
                    {['XS', 'S', 'M', 'L', 'XL'].map(s => (
                      <button key={s} className="min-w-12 h-10 rounded-xl border border-neutral-200 text-sm font-semibold hover:border-neutral-900 hover:bg-neutral-900 hover:text-white transition">{s}</button>
                    ))}
                  </div>
                </div>
                <div className="mb-6">
                  <span className="ui-section-title block mb-2">颜色 Colour</span>
                  <div className="flex gap-2">
                    {['#111827', '#f5f5dc', '#6b21a8', '#991b1b', '#3b82f6'].map(c => (
                      <button key={c} className="w-10 h-10 rounded-full border-2 border-white shadow-md transition hover:scale-110" style={{ backgroundColor: c }} />
                    ))}
                  </div>
                </div>
                <div className="flex gap-3">
                  <button onClick={() => { const sku = quick.skus[0]?.sku; if (sku) { addToConsumerCart(quick.id, sku, 1); setQuick(null); setCurrentView('consumer_cart'); } }} className="flex-1 ui-primary-button py-3.5 text-sm flex items-center justify-center gap-2">
                    <ShoppingBag className="w-4 h-4" /> 加入购物袋并查看
                  </button>
                  <button onClick={() => authConsumer ? toggleConsumerWishlist(quick.id, !consumerWishlist.some(item => item.id === quick.id)) : setCurrentView('consumer_login')} className="w-14 h-[50px] rounded-2xl border border-neutral-200 hover:border-neutral-900 flex items-center justify-center transition">
                    <Heart className="w-4 h-4" />
                  </button>
                </div>
                <div className="mt-5 grid grid-cols-3 gap-2 text-[11px] text-neutral-500 border-t border-neutral-200/70 pt-4">
                  <div>🚚 满 €200 免邮</div>
                  <div>🔄 14 天无忧退换</div>
                  <div>💳 多币种结算</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
