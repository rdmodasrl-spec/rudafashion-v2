import React, { useEffect, useState } from 'react';
import { Check, CreditCard, RefreshCw, Sparkles, X } from 'lucide-react';
import { apiGet, apiPost } from '../../../../api/client';
import { useB2B } from '../../../../context/B2BContext';

type ModaGptPlanId = 'FREE' | 'PLUS' | 'PRO' | 'BUSINESS' | 'FASHION_PRO';
type ModaGptPlan = {
  id: ModaGptPlanId;
  displayName: string;
  monthlyPriceMinor: number;
  currency: 'EUR';
  interval: 'month';
  featured: boolean;
  recommended: boolean;
  monthlyCredits: number | null;
  usageLimits: Record<string, number>;
  featureEntitlements: Record<string, boolean>;
  purchaseEnabled: boolean;
};
type PlanCatalogResponse = {
  success: true;
  checkoutReady: boolean;
  creditBalance: number;
  enabledFeatures: string[];
  currentPlanId: ModaGptPlanId;
  subscription: {
    id: string;
    planId: ModaGptPlanId;
    status: string;
    currentPeriodEnd: string | null;
    cancelAtPeriodEnd: boolean;
  } | null;
  plans: ModaGptPlan[];
};

type PlanCopy = {
  audienceZh: string;
  audienceIt: string;
  featuresZh: string[];
  featuresIt: string[];
};

const planCopy: Record<ModaGptPlanId, PlanCopy> = {
  FREE: {
    audienceZh: '基础 RUDA 管理与 ModaUI 入门',
    audienceIt: 'Gestione RUDA essenziale e ModaUI base',
    featuresZh: ['商品、客户、订单、库存与基础店铺', '基础 AI 问答、文案与翻译', 'AI 使用受额度和功能开关限制'],
    featuresIt: ['Prodotti, clienti, ordini, scorte e negozio base', 'Chat AI, testi e traduzioni di base', 'Uso AI soggetto a quote e funzioni abilitate']
  },
  PLUS: {
    audienceZh: '日常 AI 使用升级',
    audienceIt: 'Più AI per il lavoro quotidiano',
    featuresZh: ['更高的 AI 对话与商品文案额度', '基础营销、翻译与更长记忆', '基础图片能力仅在功能开放后可用'],
    featuresIt: ['Più chat AI e testi prodotto', 'Marketing base, traduzioni e memoria estesa', 'Immagini base solo quando abilitate']
  },
  PRO: {
    audienceZh: 'AI 经营能力',
    audienceIt: 'Gestione aziendale con AI',
    featuresZh: ['经营、销售、客户、库存与采购分析', 'Workflow、自动化与 Knowledge Base', '报价辅助及更高 AI Credits 配额'],
    featuresIt: ['Analisi di vendite, clienti, scorte e acquisti', 'Workflow, automazioni e Knowledge Base', 'Supporto preventivi e più AI Credits']
  },
  BUSINESS: {
    audienceZh: '企业级完整 RUDA + ModaUI 运营方案',
    audienceIt: 'Soluzione completa RUDA + ModaUI per aziende',
    featuresZh: ['企业商品、库存、客户、订单、采购、供应商与报价', '团队、角色、审批、审计及企业经营分析', '支付、收款、退款和结算按实际通道/交易费用另计', '包含 Business AI；交易手续费不包含在订阅费中'],
    featuresIt: ['Prodotti, scorte, clienti, ordini, acquisti e preventivi', 'Team, ruoli, approvazioni, audit e analisi aziendali', 'Pagamenti, rimborsi e commissioni di transazione separati', 'AI Business inclusa; commissioni escluse dall’abbonamento']
  },
  FASHION_PRO: {
    audienceZh: '服装行业 AI 设计与视觉生产',
    audienceIt: 'Design moda AI e produzione visuale',
    featuresZh: ['Fashion 设计、系列概念与商品视觉', 'Try-On、高级图片能力和批量创作按开放状态及额度提供', '不代表当前已开放视频或无限批量生成'],
    featuresIt: ['Design moda, concept di collezione e visual prodotto', 'Try-On e batch secondo disponibilità e quote', 'Video e batch illimitati non sono inclusi finché non attivati']
  }
};

function formatMonthlyPrice(plan: ModaGptPlan): string {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: plan.currency,
    minimumFractionDigits: plan.monthlyPriceMinor % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2
  }).format(plan.monthlyPriceMinor / 100);
}

function formatLimitLabel(key: string): string {
  return key.replace(/[._-]+/g, ' ');
}

export const ModaGptPricingSheet: React.FC<{
  isIt: boolean;
  currentPlan: string;
  onClose: () => void;
}> = ({ isIt, currentPlan, onClose }) => {
  const { localizeCopy } = useB2B();
  const [catalog, setCatalog] = useState<PlanCatalogResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkoutPlan, setCheckoutPlan] = useState<ModaGptPlanId | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    apiGet<PlanCatalogResponse>('/api/merchant/modagpt/plans')
      .then(result => {
        if (active) setCatalog(result);
      })
      .catch(() => {
        if (active) setError(localizeCopy('暂时无法读取套餐目录，请稍后重试。', 'Impossibile caricare i piani. Riprova più tardi.'));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [localizeCopy]);

  const startCheckout = async (plan: ModaGptPlan) => {
    if (!plan.purchaseEnabled || !catalog?.checkoutReady || checkoutPlan) return;
    setCheckoutPlan(plan.id);
    setError('');
    try {
      const response = await apiPost<{ success: true; checkoutUrl: string }>(
        '/api/billing/checkout',
        { plan: plan.id, billing_cycle: 'month', currency: 'EUR' },
        30_000,
        { 'Idempotency-Key': `modagpt-${plan.id}-${crypto.randomUUID()}` }
      );
      const checkoutUrl = new URL(response.checkoutUrl);
      if (checkoutUrl.protocol !== 'https:' || !['checkout.stripe.com'].includes(checkoutUrl.hostname)) {
        throw new Error('MODAGPT_CHECKOUT_URL_INVALID');
      }
      window.location.assign(checkoutUrl.toString());
    } catch {
      setError(localizeCopy('无法创建安全结账，请稍后重试或联系管理员。', 'Impossibile avviare il pagamento sicuro. Riprova o contatta l’amministratore.'));
      setCheckoutPlan(null);
    }
  };

  const effectiveCurrentPlan = catalog?.currentPlanId || currentPlan.toUpperCase();

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-neutral-950/55 p-0 backdrop-blur-sm sm:items-center sm:p-4">
        <section role="dialog"
        aria-modal="true"
        aria-labelledby="modagpt-pricing-title"
        className="flex max-h-[94dvh] w-full max-w-6xl flex-col overflow-hidden rounded-t-3xl bg-[#fafaf8] shadow-2xl sm:rounded-3xl"
      >
        <header className="flex shrink-0 items-start justify-between border-b border-neutral-200 bg-white px-5 py-4 sm:px-7">
          <div>
            <div className="mb-1 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-800">
              <Sparkles className="h-3.5 w-3.5" /> ModaUI
            </div>
            <h2 id="modagpt-pricing-title" className="text-xl font-bold tracking-tight text-neutral-950 sm:text-2xl">
              {localizeCopy('RUDA + ModaUI 套餐', 'Piani RUDA + ModaUI')}
            </h2>
            <p className="mt-1 text-xs text-neutral-500">
              {localizeCopy('欧元/月；最终价格和购买状态由服务端套餐目录提供。', 'EUR/mese; prezzi e disponibilità provengono dal catalogo server.')}
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label={localizeCopy('关闭', 'Chiudi')} className="flex h-9 w-9 items-center justify-center rounded-full text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900">
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="overflow-y-auto px-4 py-5 sm:px-7 sm:py-6">
          <div role="status" className="mb-5 flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-3.5 text-xs leading-5 text-amber-950">
            <CreditCard className="mt-0.5 h-4 w-4 shrink-0" />
            <p>{localizeCopy(
              catalog?.checkoutReady
                ? '结账当前仅在配置完整的 Stripe 测试环境开放；请勿将测试扣款视为生产收费已上线。'
                : '订阅购买尚未开放。服务端会在支付、Webhook、自动税和测试开关均就绪后启用安全结账。',
              catalog?.checkoutReady
                ? 'Il checkout è disponibile solo in modalità di test Stripe; non equivale all’attivazione dei pagamenti in produzione.'
                : 'Gli acquisti non sono ancora attivi. Il server li abiliterà solo quando pagamenti, webhook, imposte e test saranno configurati.'
            )}</p>
          </div>

          {error && <p role="alert" className="mb-4 rounded-xl bg-red-50 p-3 text-xs text-red-800">{error}</p>}
          {loading && <p role="status" className="mb-4 text-xs text-neutral-500">{localizeCopy('正在读取套餐…', 'Caricamento piani…')}</p>}
          {!loading && !catalog && <p role="alert" className="mb-4 text-xs text-red-700">{error}</p>}

          {catalog && (
            <section aria-label={localizeCopy('订阅套餐', 'Piani di abbonamento')}>
              <div className="mb-3 flex items-end justify-between gap-2">
                <div>
                  <h3 className="text-sm font-bold text-neutral-900">{localizeCopy('五档套餐', 'Cinque piani')}</h3>
                  <p className="mt-0.5 text-[10px] text-neutral-500">{localizeCopy('交易手续费另计', 'Commissioni separate')}</p>
                </div>
                <span className="text-[10px] font-semibold text-neutral-500">{localizeCopy('/ 月', '/ mese')}</span>
              </div>
              <p className="mb-3 text-[10px] text-neutral-600">
                {localizeCopy('当前 AI Credits 余额：', 'Saldo AI Credits: ')}{catalog.creditBalance.toLocaleString()}
                {' · '}{localizeCopy('平台当前已启用能力：', 'Funzioni attive: ')}
                {catalog.enabledFeatures.length.toLocaleString()}
              </p>
              {catalog.subscription && (
                <p className="mb-3 rounded-xl bg-blue-50 p-3 text-[10px] text-blue-900">
                  {localizeCopy('订阅状态：', 'Stato abbonamento: ')}{catalog.subscription.status}
                  {catalog.subscription.currentPeriodEnd
                    ? ` · ${localizeCopy('周期结束：', 'Fine periodo: ')}${new Date(catalog.subscription.currentPeriodEnd).toLocaleDateString()}`
                    : ''}
                  {catalog.subscription.cancelAtPeriodEnd
                    ? ` · ${localizeCopy('已设置周期结束时取消', 'Annullamento a fine periodo programmato')}`
                    : ''}
                  {' · '}{localizeCopy('套餐变更尚未开放，请联系管理员。', 'Cambio piano non disponibile; contatta l’amministratore.')}
                </p>
              )}

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {catalog.plans.map(plan => {
                  const copy = planCopy[plan.id];
                  const active = effectiveCurrentPlan === plan.id;
                  const description = isIt ? copy.featuresIt : copy.featuresZh;
                  const limits = Object.entries(plan.usageLimits);
                  return (
                    <article key={plan.id} className={`relative flex flex-col rounded-3xl border bg-white p-4 ${plan.recommended ? 'border-neutral-900 ring-1 ring-neutral-900 shadow-sm' : 'border-neutral-200'}`}>
                      {plan.recommended && <span className="absolute -top-2 right-3 rounded-xl bg-neutral-950 px-2.5 py-1 text-[9px] font-bold text-white">{localizeCopy('主推', 'CONSIGLIATO')}</span>}
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h4 className="text-sm font-bold text-neutral-950">{plan.displayName}</h4>
                          <p className="mt-1 min-h-8 text-[10px] leading-4 text-neutral-500">{isIt ? copy.audienceIt : copy.audienceZh}</p>
                        </div>
                        {active && <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-1 text-[9px] font-bold text-emerald-800">{localizeCopy('当前套餐', 'Attuale')}</span>}
                      </div>
                      <p className="mt-3 text-2xl font-bold tracking-tight text-neutral-950">
                        {formatMonthlyPrice(plan)}<span className="ml-1 text-[10px] font-normal text-neutral-400">{localizeCopy('/ 月', '/ mese')}</span>
                      </p>
                      <p className="mt-2 rounded-lg bg-neutral-50 px-2.5 py-2 text-[10px] font-semibold text-neutral-700">
                        {plan.monthlyCredits === null
                          ? localizeCopy('AI Credits 配额待配置', 'Quota AI Credits da configurare')
                          : `${plan.monthlyCredits.toLocaleString()} Credits / ${localizeCopy('月', 'mese')}`}
                      </p>
                      <p className="mt-1 text-[9px] text-neutral-500">
                        {localizeCopy(
                          `此套餐授权 ${Object.values(plan.featureEntitlements).filter(Boolean).length} 项能力；平台当前开放 ${Object.entries(plan.featureEntitlements).filter(([key, included]) => included && catalog.enabledFeatures.includes(key)).length} 项`,
                          `${Object.values(plan.featureEntitlements).filter(Boolean).length} funzioni incluse; ${Object.entries(plan.featureEntitlements).filter(([key, included]) => included && catalog.enabledFeatures.includes(key)).length} attive sulla piattaforma`
                        )}
                      </p>
                      <ul className="mt-3 flex-1 space-y-2">
                        {description.map(feature => (
                          <li key={feature} className="flex gap-1.5 text-[10px] leading-4 text-neutral-600">
                            <Check className="mt-0.5 h-3 w-3 shrink-0 text-emerald-700" />{feature}
                          </li>
                        ))}
                        {limits.map(([key, value]) => (
                          <li key={key} className="text-[10px] leading-4 text-neutral-500">
                            {formatLimitLabel(key)}: {value}
                          </li>
                        ))}
                      </ul>
                      <button
                        type="button"
                        disabled={!plan.purchaseEnabled || active || checkoutPlan !== null}
                        onClick={() => void startCheckout(plan)}
                        className={`mt-4 flex min-h-10 items-center justify-center gap-2 rounded-2xl border px-4 text-[11px] font-bold ${
                          plan.purchaseEnabled && !active
                            ? 'border-neutral-950 bg-neutral-950 text-white hover:bg-neutral-800 active:bg-neutral-900'
                            : 'border-neutral-200 bg-neutral-50 text-neutral-400'
                        }`}
                      >
                        {checkoutPlan === plan.id && <RefreshCw className="h-3 w-3 animate-spin" />}
                        {active
                          ? localizeCopy('当前套餐', 'Piano attuale')
                          : plan.purchaseEnabled
                            ? localizeCopy('安全结账', 'Checkout sicuro')
                            : localizeCopy('暂不可购买', 'Non disponibile')}
                      </button>
                    </article>
                  );
                })}
              </div>
            </section>
          )}
          <p className="mt-5 text-[10px] leading-4 text-neutral-500">
            {localizeCopy('套餐功能受服务端权限、供应商配置、AI Credits 与使用限制共同控制。套餐说明不代表尚未上线的图片编辑、视频或批量生产能力已可用。', 'Le funzioni dipendono da permessi server, fornitori, crediti e limiti. La descrizione non implica che editing immagini, video o batch non attivi siano già disponibili.')}
          </p>
        </div>
      </section>
    </div>
  );
};
