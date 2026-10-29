import React, { useEffect, useState } from 'react';
import {
  BadgeCheck,
  Copy,
  Mail,
  MapPin,
  Phone,
  Share2,
  Store,
  UserRound,
  X
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useB2B } from '../../../../context/B2BContext';
import { merchantStorefrontUrl } from '../../../../shared/merchantStoreUrl';
import { DEFAULT_MERCHANT_LOGO, merchantMediaUrl } from '../../../../utils/merchantMedia';
import { shareOrCopy } from '../../../../utils/share';
import type { Merchant } from '../../../../types/b2b';

export type MerchantBusinessCardMerchant = Pick<
  Merchant,
  | 'id'
  | 'name'
  | 'companyLegalName'
  | 'code'
  | 'storeLookupCode'
  | 'storeSlug'
  | 'logo'
  | 'tagline'
  | 'tagline_it'
  | 'tagline_zh'
  | 'isVerified'
  | 'city'
  | 'city_it'
  | 'city_zh'
  | 'country'
  | 'country_it'
  | 'country_zh'
  | 'showroomAddress'
  | 'contactPerson'
  | 'contactPhone'
  | 'contactEmail'
  | 'whatsapp'
  | 'wechat'
>;

type BusinessCardProps = {
  merchant: MerchantBusinessCardMerchant;
  onClose: () => void;
};

type BusinessCardFactKind = 'text' | 'phone' | 'email' | 'copy' | 'whatsapp';

/**
 * 商家名片：只读展示当前商家的真实资料与推广信息。
 * 手机端首页顶部与电脑端侧栏共用本组件，数据由调用方传入当前会话商家，组件自身不请求数据。
 */
export const MerchantBusinessCard: React.FC<BusinessCardProps> = ({ merchant, onClose }) => {
  const { lang, localizeCopy } = useB2B();
  const [status, setStatus] = useState('');
  const storefrontLanguage = lang === 'zh' ? 'zh' : 'it';
  const storeUrl = merchant.storeSlug ? merchantStorefrontUrl(merchant.storeSlug, storefrontLanguage) : '';
  const logo = merchantMediaUrl(merchant.logo, DEFAULT_MERCHANT_LOGO);
  const tagline = (lang === 'zh' ? merchant.tagline_zh : merchant.tagline_it) || merchant.tagline || '';
  const city = (lang === 'zh' ? merchant.city_zh : merchant.city_it) || merchant.city || '';
  const country = (lang === 'zh' ? merchant.country_zh : merchant.country_it) || merchant.country || '';
  const whatsappDigits = String(merchant.whatsapp || '').replace(/[^\d]/g, '');
  const shareText = localizeCopy(
    '查看 {{RUDA_ARG_0}} 的官方店铺与货盘',
    'Visita il negozio ufficiale {{RUDA_ARG_0}} e il suo catalogo',
    [merchant.name]
  );

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  const flashStatus = (message: string) => {
    setStatus(message);
    window.setTimeout(() => setStatus(''), 2200);
  };

  const copyValue = async (value: string) => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
      } else {
        const input = document.createElement('textarea');
        input.value = value;
        input.setAttribute('readonly', '');
        input.style.position = 'fixed';
        input.style.opacity = '0';
        document.body.appendChild(input);
        input.select();
        const copied = document.execCommand('copy');
        input.remove();
        if (!copied) throw new Error('COPY_FAILED');
      }
      flashStatus(localizeCopy('已复制', 'Copiato'));
    } catch (error) {
      console.error('[merchant-business-card-copy]', error);
      flashStatus(localizeCopy('复制失败，请长按选择复制。', 'Copia non riuscita, seleziona e copia manualmente.'));
    }
  };

  const shareStore = async () => {
    if (!storeUrl) return;
    try {
      const result = await shareOrCopy(
        {
          title: `${merchant.name} · RUDA`,
          text: shareText,
          path: storeUrl,
          source: `merchant-${merchant.id}`
        },
        'native'
      );
      if (result === 'copied') flashStatus(localizeCopy('已复制', 'Copiato'));
    } catch (error) {
      if ((error as { name?: string } | undefined)?.name === 'AbortError') return;
      console.error('[merchant-business-card-share]', error);
      flashStatus(localizeCopy('分享未完成，请复制链接后发送。', 'Condivisione non riuscita, copia il link.'));
    }
  };

  const factRows: Array<{ key: string; label: string; value: string; kind: BusinessCardFactKind }> = [
    { key: 'legalName', label: localizeCopy('公司全称', 'Ragione sociale'), value: merchant.companyLegalName, kind: 'text' },
    { key: 'code', label: localizeCopy('商家编号', 'ID negozio'), value: merchant.code, kind: 'copy' },
    { key: 'city', label: localizeCopy('城市', 'Città'), value: [city, country].filter(Boolean).join(', '), kind: 'text' },
    { key: 'address', label: localizeCopy('展厅地址', 'Indirizzo showroom'), value: merchant.showroomAddress, kind: 'copy' },
    { key: 'contact', label: localizeCopy('联系人', 'Referente'), value: merchant.contactPerson, kind: 'text' },
    { key: 'phone', label: localizeCopy('电话', 'Telefono'), value: merchant.contactPhone, kind: 'phone' },
    { key: 'email', label: localizeCopy('邮箱', 'Email'), value: merchant.contactEmail, kind: 'email' },
    { key: 'whatsapp', label: 'WhatsApp', value: merchant.whatsapp || (whatsappDigits ? `+${whatsappDigits}` : ''), kind: 'whatsapp' },
    { key: 'wechat', label: localizeCopy('微信', 'WeChat'), value: merchant.wechat || '', kind: 'text' }
  ];
  const facts = factRows.filter(fact => fact.value.trim().length > 0);

  return (
    <div
      className="fixed inset-0 z-[90] flex items-end justify-center bg-neutral-950/45 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="merchant-business-card-title"
        onClick={event => event.stopPropagation()}
        className="ruda-business-card max-h-[88vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-white p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-2xl sm:rounded-2xl sm:pb-5"
      >
        <div className="flex items-start gap-3">
          <img
            src={logo}
            alt=""
            className="h-12 w-12 shrink-0 rounded-xl border border-neutral-200 object-cover"
            onError={event => {
              event.currentTarget.onerror = null;
              event.currentTarget.src = DEFAULT_MERCHANT_LOGO;
            }}
          />
          <div className="min-w-0 flex-1">
            <h2 id="merchant-business-card-title" className="truncate font-sans text-base font-semibold tracking-tight text-neutral-950">
              {merchant.name}
            </h2>
            {merchant.isVerified && (
              <span className="mt-1 inline-flex items-center gap-1 text-[10px] font-semibold text-neutral-600">
                <BadgeCheck className="h-3 w-3" aria-hidden="true" />
                {localizeCopy('已验证', 'Verificato')}
              </span>
            )}
            {tagline && <p className="mt-1 line-clamp-2 text-[11px] leading-4 text-neutral-500">{tagline}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={localizeCopy('关闭', 'Chiudi')}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-neutral-500 active:bg-neutral-100"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {storeUrl && (
          <section className="mt-4 rounded-xl border border-neutral-200 bg-neutral-50/60 p-3">
            <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-500">
              <Store className="h-3.5 w-3.5" aria-hidden="true" />
              {localizeCopy('店铺链接', 'Link negozio')}
            </div>
            <p className="mt-1.5 break-all text-[11px] leading-4 text-neutral-800">{storeUrl}</p>
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={() => void copyValue(storeUrl)}
                className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg border border-neutral-300 bg-white text-[11px] font-semibold text-neutral-800 active:bg-neutral-100"
              >
                <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                {localizeCopy('复制链接', 'Copia link')}
              </button>
              <button
                type="button"
                onClick={() => void shareStore()}
                className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg bg-neutral-950 text-[11px] font-semibold text-white active:bg-neutral-800"
              >
                <Share2 className="h-3.5 w-3.5" aria-hidden="true" />
                {localizeCopy('分享', 'Condividi')}
              </button>
            </div>
            <div className="mt-3 flex items-center gap-3">
              <div className="shrink-0 rounded-lg border border-neutral-200 bg-white p-2">
                <QRCodeSVG value={storeUrl} size={96} level="M" />
              </div>
              <div className="min-w-0">
                <div className="text-[10px] font-semibold text-neutral-500">{localizeCopy('扫码打开店铺', 'Scansiona per aprire il negozio')}</div>
                <p className="mt-1 text-[10px] leading-4 text-neutral-500">
                  {localizeCopy('客户扫码或点开链接即可浏览全部公开商品。', 'Il cliente scansiona o apre il link per vedere i prodotti pubblici.')}
                </p>
              </div>
            </div>
          </section>
        )}

        {merchant.storeLookupCode && (
          <section className="mt-3 rounded-xl border border-neutral-200 p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="text-[10px] font-semibold text-neutral-500">{localizeCopy('店铺码', 'Codice negozio')}</div>
                <div className="mt-0.5 text-lg font-semibold tracking-[0.2em] text-neutral-950">{merchant.storeLookupCode}</div>
              </div>
              <button
                type="button"
                onClick={() => void copyValue(merchant.storeLookupCode || '')}
                aria-label={localizeCopy('复制店铺码', 'Copia codice negozio')}
                className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-neutral-300 text-neutral-700 active:bg-neutral-100"
              >
                <Copy className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
            <p className="mt-2 text-[10px] leading-4 text-neutral-500">
              {localizeCopy(
                '客户可在 RUDA 官网或小程序输入店铺码找到本店；授权区商品需客户提交看货申请，经商家审批后可见。',
                'Il cliente trova il negozio inserendo il codice su sito o mini programma; l’area autorizzata richiede richiesta e approvazione del negozio.'
              )}
            </p>
          </section>
        )}

        {facts.length > 0 && (
          <section className="mt-3">
            <h3 className="font-sans text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-500">{localizeCopy('商家资料', 'Dati negozio')}</h3>
            <dl className="mt-1.5 overflow-hidden rounded-xl border border-neutral-200 sm:grid sm:grid-cols-2">
              {facts.map(fact => (
                <div key={fact.key} className="flex items-start gap-3 border-b border-neutral-100 px-3 py-2 sm:odd:border-r">
                  <dt className="flex w-[76px] shrink-0 items-start gap-1 pt-px font-sans text-[10px] font-medium leading-4 text-neutral-500">
                    {fact.key === 'address' && <MapPin className="mt-px h-3 w-3 shrink-0" aria-hidden="true" />}
                    {fact.key === 'contact' && <UserRound className="mt-px h-3 w-3 shrink-0" aria-hidden="true" />}
                    {fact.key === 'phone' && <Phone className="mt-px h-3 w-3 shrink-0" aria-hidden="true" />}
                    {fact.key === 'email' && <Mail className="mt-px h-3 w-3 shrink-0" aria-hidden="true" />}
                    <span>{fact.label}</span>
                  </dt>
                  <dd className="min-w-0 flex-1 break-all text-right text-[11px] leading-4 text-neutral-900">
                    {fact.kind === 'phone' ? (
                      <a href={`tel:${fact.value.replace(/\s+/g, '')}`} className="underline decoration-neutral-300 underline-offset-2">{fact.value}</a>
                    ) : fact.kind === 'email' ? (
                      <a href={`mailto:${fact.value}`} className="underline decoration-neutral-300 underline-offset-2">{fact.value}</a>
                    ) : fact.kind === 'whatsapp' && whatsappDigits ? (
                      <a href={`https://wa.me/${whatsappDigits}`} target="_blank" rel="noopener noreferrer" className="underline decoration-neutral-300 underline-offset-2">{fact.value}</a>
                    ) : fact.kind === 'copy' ? (
                      <button type="button" onClick={() => void copyValue(fact.value)} className="text-right underline decoration-neutral-300 underline-offset-2 active:text-neutral-500">{fact.value}</button>
                    ) : (
                      fact.value
                    )}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        )}

        <p aria-live="polite" className="mt-3 min-h-4 text-center text-[10px] text-neutral-500">{status}</p>
      </section>
    </div>
  );
};

