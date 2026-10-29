import React, { useEffect, useRef, useState } from 'react';
import { apiGet } from '../../../../api/client';
import { getLocalizedMerchantName } from '../../../../i18n/translations';
import { merchantStorefrontUrl } from '../../../../shared/merchantStoreUrl';
import { Merchant } from '../../../../types/b2b';
import { useB2B } from '../../../../context/B2BContext';

type PublicMerchantsResponse = {
  success: true;
  merchants: Merchant[];
};

type StoreLookupResponse = {
  success: true;
  storeSlug: string;
};

export const MerchantFinder: React.FC = () => {
  const { lang, localizeCopy } = useB2B();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Merchant[]>([]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const autoLookupStarted = useRef(false);

  const openStore = (storeSlug: string) => {
    window.location.assign(merchantStorefrontUrl(storeSlug, lang === 'zh' ? 'zh' : 'it'));
  };

  const find = async (value: string) => {
    const search = value.trim();
    if (!search) {
      setMessage(localizeCopy('请输入六位店铺码或商家名称。', 'Inserisci il codice a 6 cifre o il nome del negozio.'));
      setResults([]);
      return;
    }
    setLoading(true);
    setMessage('');
    setResults([]);
    try {
      if (/^\d{6}$/.test(search)) {
        const result = await apiGet<StoreLookupResponse>(`/api/merchants/code/${encodeURIComponent(search)}`);
        openStore(result.storeSlug);
        return;
      }
      if (/^\d+$/.test(search)) {
        setMessage(localizeCopy('商家代码必须是完整的六位数字。', 'Il codice negozio deve contenere esattamente sei cifre.'));
        return;
      }
      const result = await apiGet<PublicMerchantsResponse>(`/api/merchants?q=${encodeURIComponent(search)}`);
      const merchants = result.merchants.filter(merchant => Boolean(merchant.storeSlug));
      setResults(merchants);
      if (merchants.length === 0) {
        setMessage(localizeCopy('没有找到公开店铺，请检查名称后重试。', 'Nessun negozio pubblico trovato. Controlla il nome e riprova.'));
      }
    } catch (error) {
      const status = (error as { status?: number }).status;
      setMessage(status === 404
        ? localizeCopy('店铺不存在、未开放或暂不可访问。', 'Negozio inesistente, non pubblicato o non disponibile.')
        : localizeCopy('暂时无法查询店铺，请稍后重试。', 'Impossibile cercare il negozio. Riprova più tardi.'));
      console.error('[merchant-finder]', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (autoLookupStarted.current) return;
    const code = new URLSearchParams(window.location.search).get('storeCode');
    if (!code) return;
    autoLookupStarted.current = true;
    setQuery(code);
    void find(code);
  }, []);

  return (
    <section aria-label={localizeCopy('按编号或名称找店', 'Trova un negozio')} className="rounded-xl border border-neutral-200 bg-white p-4 sm:p-5">
      <form
        onSubmit={event => {
          event.preventDefault();
          void find(query);
        }}
        className="flex flex-col gap-2 sm:flex-row"
      >
        <input
          value={query}
          onChange={event => {
            setQuery(event.target.value);
            setMessage('');
            setResults([]);
          }}
          maxLength={80}
          placeholder={localizeCopy('输入六位商家代码或搜索商家名称、品牌', 'Codice negozio a 6 cifre o nome del brand')}
          aria-label={localizeCopy('商家代码或名称', 'Codice o nome del negozio')}
          className="h-11 min-w-0 flex-1 rounded-lg border border-neutral-300 bg-neutral-50 px-3 text-sm outline-none focus:border-neutral-900"
        />
        <button
          type="submit"
          disabled={loading}
          className="h-11 rounded-lg bg-neutral-950 px-5 text-sm font-semibold text-white disabled:opacity-60"
        >
          {loading ? localizeCopy('正在查询…', 'Ricerca…') : localizeCopy('找店', 'Cerca')}
        </button>
      </form>
      {message && <p role="status" className="mt-3 text-sm text-neutral-600">{message}</p>}
      {results.length > 0 && (
        <ul className="mt-3 divide-y divide-neutral-100 border-t border-neutral-100">
          {results.map(merchant => (
            <li key={merchant.id}>
              <button
                type="button"
                onClick={() => merchant.storeSlug && openStore(merchant.storeSlug)}
                className="flex min-h-14 w-full items-center justify-between gap-3 py-3 text-left"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-neutral-900">
                    {getLocalizedMerchantName(merchant, lang)}
                  </span>
                  <span className="mt-1 block truncate text-xs text-neutral-500">
                    {[merchant.city, merchant.country].filter(Boolean).join(' · ')}
                  </span>
                </span>
                <span className="shrink-0 text-xs font-medium text-neutral-600">
                  {localizeCopy('进入店铺 ›', 'Apri negozio ›')}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};
