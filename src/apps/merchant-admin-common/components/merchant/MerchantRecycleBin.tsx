import React, { useCallback, useEffect, useState } from 'react';
import { ArchiveRestore, RefreshCw, Search, ShieldAlert, Trash2 } from 'lucide-react';
import { apiGet, apiPost, ApiError } from '../../../../api/client';
import { useB2B } from '../../../../context/B2BContext';

type RecycleBinProduct = {
  id: string;
  styleNo: string;
  name: string;
  category: string | null;
  images: string[];
  lifecycleStatus: string;
  archivedAt: string;
};

type RecycleBinResponse = {
  success: true;
  products: RecycleBinProduct[];
};

export function MerchantRecycleBin({ onOpenProducts }: { onOpenProducts?: () => void }) {
  const { localizeCopy, lang } = useB2B();
  const isIt = lang === 'it';
  const [products, setProducts] = useState<RecycleBinProduct[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  // 错误只保存稳定代码，渲染时再本地化，避免文案回调变化触发重复请求。
  const [error, setError] = useState<'forbidden' | 'failed' | null>(null);
  const [restoring, setRestoring] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async (keyword: string) => {
    setLoading(true);
    setError(null);
    try {
      const query = new URLSearchParams({ limit: '50' });
      if (keyword.trim()) query.set('search', keyword.trim());
      const result = await apiGet<RecycleBinResponse>(`/api/merchant/recycle-bin?${query.toString()}`);
      setProducts(Array.isArray(result.products) ? result.products : []);
    } catch (loadError) {
      setProducts([]);
      setError(loadError instanceof ApiError && loadError.status === 403 ? 'forbidden' : 'failed');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(search); }, search ? 300 : 0);
    return () => window.clearTimeout(timer);
  }, [load, search]);

  const restore = async (product: RecycleBinProduct) => {
    if (restoring) return;
    setRestoring(product.id);
    setNotice(null);
    try {
      await apiPost(`/api/merchant/recycle-bin/products/${encodeURIComponent(product.id)}/restore`, {});
      setProducts(current => current.filter(item => item.id !== product.id));
      setNotice(localizeCopy('商品已恢复到草稿', 'Prodotto ripristinato come bozza'));
    } catch (restoreError) {
      const code = restoreError instanceof ApiError ? restoreError.code : '';
      if (code === 'EMPLOYEE_PERMISSION_REQUIRED') {
        setNotice(localizeCopy('无权限恢复商品', 'Permesso insufficiente per ripristinare'));
      } else if (code === 'PRODUCT_EDITING_LOCKED') {
        setNotice(localizeCopy('商品编辑已锁定', 'Modifica prodotti bloccata'));
      } else if (code === 'RECYCLE_BIN_PRODUCT_NOT_ARCHIVED') {
        setNotice(localizeCopy('该商品不在回收站', 'Il prodotto non è nel cestino'));
      } else {
        setNotice(localizeCopy('恢复失败，请重试', 'Ripristino non riuscito'));
      }
    } finally {
      setRestoring(null);
    }
  };

  const formatter = new Intl.DateTimeFormat(isIt ? 'it-IT' : 'zh-CN', { dateStyle: 'medium', timeStyle: 'short' });

  return (
    <section id="merchant-recycle-bin" className="space-y-3">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-base font-bold text-neutral-950">{localizeCopy('回收站', 'Cestino')}</h1>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-400" />
            <input
              value={search}
              onChange={event => setSearch(event.target.value)}
              placeholder={localizeCopy('搜索款式号或商品名称', 'Cerca codice o nome')}
              aria-label={localizeCopy('搜索款式号或商品名称', 'Cerca codice o nome')}
              className="h-9 w-full min-w-0 rounded-lg border border-neutral-200 bg-white pl-8 pr-3 text-xs text-neutral-900 placeholder:text-neutral-500 focus:border-neutral-400 focus:outline-none sm:w-64"
            />
          </div>
          <button
            type="button"
            onClick={() => void load(search)}
            disabled={loading}
            aria-label={localizeCopy('刷新', 'Aggiorna')}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 text-[11px] font-semibold text-neutral-700 hover:border-neutral-300 hover:text-neutral-950 disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </header>

      {notice ? (
        <p role="status" className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-[11px] font-semibold text-neutral-800">{notice}</p>
      ) : null}

      {error ? (
        <div role="alert" className="flex items-start gap-3 rounded-xl border border-neutral-200 bg-white p-4">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-neutral-500" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-neutral-900">{error === 'forbidden'
              ? localizeCopy('无权限查看回收站', 'Permesso insufficiente per il cestino')
              : localizeCopy('无法加载回收站', 'Impossibile caricare il cestino')}</p>
            <button
              type="button"
              onClick={() => void load(search)}
              className="mt-2 rounded-lg border border-neutral-200 px-3 py-1.5 text-[11px] font-semibold text-neutral-700 hover:border-neutral-300 hover:text-neutral-950"
            >
              {localizeCopy('重试', 'Riprova')}
            </button>
          </div>
        </div>
      ) : loading && !products.length ? (
        <ul className="divide-y divide-neutral-100 rounded-xl border border-neutral-200 bg-white">
          {[0, 1, 2].map(index => (
            <li key={index} className="flex items-center gap-3 px-4 py-3">
              <span className="h-12 w-12 animate-pulse rounded-lg bg-neutral-100" />
              <span className="flex-1 space-y-2">
                <span className="block h-2.5 w-32 animate-pulse rounded bg-neutral-100" />
                <span className="block h-2.5 w-20 animate-pulse rounded bg-neutral-100" />
              </span>
            </li>
          ))}
        </ul>
      ) : !products.length ? (
        <div className="rounded-xl border border-neutral-200 bg-white px-4 py-12 text-center">
          <Trash2 className="mx-auto h-5 w-5 text-neutral-300" />
          <p className="mt-2 text-xs text-neutral-500">{localizeCopy('回收站为空', 'Cestino vuoto')}</p>
        </div>
      ) : (
        <ul className="divide-y divide-neutral-100 overflow-hidden rounded-xl border border-neutral-200 bg-white">
          {products.map(product => {
            const cover = product.images[0] || '';
            return (
              <li key={product.id} className="flex items-center gap-3 px-4 py-3">
                {cover ? (
                  <img src={cover} alt="" className="h-12 w-12 shrink-0 rounded-lg border border-neutral-200 object-cover" />
                ) : (
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-neutral-100 text-neutral-400">
                    <Trash2 className="h-4 w-4" />
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold text-neutral-900">
                    {[product.styleNo, product.name].filter(Boolean).join(' · ')}
                  </p>
                  <p className="mt-0.5 truncate text-[11px] text-neutral-500">
                    {localizeCopy('归档时间', 'Archiviato il')} {formatter.format(new Date(product.archivedAt))}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void restore(product)}
                  disabled={restoring === product.id}
                  aria-label={`${localizeCopy('恢复', 'Ripristina')} ${product.styleNo}`}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-neutral-900 bg-neutral-900 px-3 py-2 text-[11px] font-semibold text-white transition hover:bg-neutral-700 disabled:opacity-50"
                >
                  <ArchiveRestore className={`h-3.5 w-3.5 ${restoring === product.id ? 'animate-pulse' : ''}`} />
                  {localizeCopy('恢复', 'Ripristina')}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {onOpenProducts ? (
        <button
          type="button"
          onClick={onOpenProducts}
          className="text-[11px] font-semibold text-neutral-600 underline decoration-neutral-300 underline-offset-4 hover:text-neutral-950"
        >
          {localizeCopy('返回商品列表', 'Torna ai prodotti')}
        </button>
      ) : null}
    </section>
  );
}
