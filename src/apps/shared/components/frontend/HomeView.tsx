import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowUp, AudioLines, Mic, Plus } from 'lucide-react';
import { useB2B } from '../../../../context/B2BContext';
import { getLocalizedMerchantName, getLocalizedProductName } from '../../../../i18n/translations';
import type { Merchant } from '../../../../types/b2b';
import { merchantIndustries, type MerchantIndustry } from '../../../../constants/merchantIndustries';
import type { PublicMerchantSearchResult } from '../../../../utils/merchantSearch';
import type { PublicProductSearchRecord } from '../../../../utils/publicProductSearch';
import { ProductImage } from '../common/ProductImage';
import { apiGet, apiPost } from '../../../../api/client';
import { trackMarketingEvent } from '../../../../utils/marketingAnalytics';
import { getMerchantStoreUrl } from '../../../../utils/share';
import { PORTAL_DOMAINS } from '../../../../shared/portalDomains';
import { MobileEditorialHome } from './MobileEditorialHome';

type HomeAiMessage = {
  role: 'assistant' | 'user';
  text: string;
  merchants?: PublicMerchantSearchResult[];
  products?: PublicProductSearchRecord[];
  showShowroomsLink?: boolean;
  showCatalogLink?: boolean;
  showRegistrationLink?: boolean;
};

type SpeechRecognitionResultEvent = {
  resultIndex: number;
  results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }>;
};
type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechRecognitionResultEvent) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
};
type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

const getPublicProductImage = (images: string | null | undefined): string | undefined => {
  if (!images) return undefined;
  try {
    const parsed: unknown = JSON.parse(images);
    return Array.isArray(parsed) && typeof parsed[0] === 'string' ? parsed[0] : undefined;
  } catch {
    return images;
  }
};

const getMerchantBusinessTypeLabel = (businessType: string | undefined): [string, string] | null => {
  const normalized = (businessType || '').trim().toLocaleLowerCase().replace(/[\s_-]+/g, '');
  const labels: Record<string, [string, string]> = {
    brandsupplier: ['品牌/生产商', 'Brand / produttore'],
    manufacturer: ['生产厂家', 'Produttore'],
    atelier: ['设计工作室', 'Atelier'],
    wholesaler: ['批发商', 'Grossista'],
    distributor: ['分销商', 'Distributore'],
    retailer: ['零售店', 'Negozio al dettaglio'],
    retailstore: ['零售店', 'Negozio al dettaglio'],
    boutique: ['精品店', 'Boutique']
  };
  return labels[normalized] || null;
};

type HomepageMerchantIndustry = MerchantIndustry;

const getHomepageMerchantIndustry = (merchant: Merchant): HomepageMerchantIndustry | null => {
  const industry = (merchant.industry || '').trim().toUpperCase().replace(/[\s-]+/g, '_');
  const selectedIndustry = merchantIndustries.find(item => item.id === industry);
  if (selectedIndustry) return selectedIndustry.id;
  if (industry === 'FASHION_WHOLESALE' || industry === 'WHOLESALE_COMPANY') return 'FASHION_COMPANY';

  const businessType = (merchant.businessType || '').trim().toLocaleLowerCase().replace(/[\s_-]+/g, '');
  if (/departmentstore|百货/.test(businessType)) return 'DEPARTMENT_STORE';
  if (/tradingcompany|贸易公司/.test(businessType)) return 'TRADING_COMPANY';
  if (/restaurant|takeaway|takeout|餐馆|餐饮|外卖|ristorant|asporto/.test(businessType)) return 'RESTAURANT';
  if (/leather|leathergoods|pelletteria|皮包|皮具/.test(businessType) || merchant.merchantZone === 'leather') return 'LEATHER_GOODS';
  if (/wholesalecompany|wholesaler|wholesale|distributor|批发商|批发公司|分销商|代理|grossist|distribut/.test(businessType)) return 'FASHION_COMPANY';
  if (/retailer|retail|boutique|零售商|零售店|rivenditor/.test(businessType)) return 'RETAIL_STORE';
  if (/producer|brandsupplier|manufacturer|atelier|生产商|品牌商|工厂|produttor|manifattur/.test(businessType)) return 'FASHION_COMPANY';

  if (merchant.merchantZone === 'iolo') return 'FASHION_COMPANY';
  if (merchant.merchantZone === 'tavoro') return 'FASHION_COMPANY';
  if (merchant.merchantZone === 'boutique_department') return 'RETAIL_STORE';
  return null;
};

export const HomeView: React.FC = () => {
  const { 
    products, 
    merchants,
    setSelectedMerchantId,
    setCurrentView, 
    setCatalogCategory,
    setCatalogFilterStatus,
    setCatalogSearchQuery,
    quickSearchStyle,
    quickNavigateToProduct, 
    calculateCustomerPrice,
    addNotification,
    lang,
    t, localizeCopy
  } = useB2B();
  const [selectedZone, setSelectedZone] = useState<'iolo' | 'tavoro' | 'leather' | 'boutique_department' | null>(null);
  const [showAiHelp, setShowAiHelp] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [aiInput, setAiInput] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiMessages, setAiMessages] = useState<HomeAiMessage[]>([]);
  const [aiQuickQuestions, setAiQuickQuestions] = useState<string[]>([]);
  const [showQuickPrompts, setShowQuickPrompts] = useState(false);
  const [recordingVoice, setRecordingVoice] = useState(false);
  const speechRecognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const welcomeMessage = localizeCopy('我们先从哪里开始呢？', 'Da dove iniziamo?');
  const [typedWelcomeMessage, setTypedWelcomeMessage] = useState('');

  useEffect(() => {
    const characters = Array.from(welcomeMessage);
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setTypedWelcomeMessage(welcomeMessage);
      return undefined;
    }

    setTypedWelcomeMessage('');
    let visibleCharacters = 0;
    const timer = window.setInterval(() => {
      visibleCharacters += 1;
      setTypedWelcomeMessage(characters.slice(0, visibleCharacters).join(''));
      if (visibleCharacters >= characters.length) window.clearInterval(timer);
    }, 65);

    return () => window.clearInterval(timer);
  }, [welcomeMessage]);

  useEffect(() => () => speechRecognitionRef.current?.stop(), []);

  const openAiHelp = useCallback(async () => {
    setShowAiHelp(true);
    void trackMarketingEvent('ai_open', 'home');
    if (aiMessages.length > 0) return;
    try {
      const result = await apiGet<{ success: boolean; config: { enabled: boolean; welcomeMessage: string; quickQuestions: string[] } }>('/api/ai/support/config');
      if (!result.config.enabled) {
        setAiMessages([{ role: 'assistant', text: localizeCopy('AI 客服暂未开放，请用商品搜索。', 'Assistenza AI non disponibile. Usa la ricerca.') }]);
        setAiQuickQuestions([]);
        return;
      }
      setAiMessages([{ role: 'assistant', text: result.config.welcomeMessage }]);
      setAiQuickQuestions(result.config.quickQuestions || []);
    } catch {
      setAiMessages([{ role: 'assistant', text: localizeCopy('AI 客服暂不可用，请稍后重试。', 'Assistenza AI non disponibile. Riprova più tardi.') }]);
      setAiQuickQuestions([]);
    }
  }, [aiMessages.length, localizeCopy]);

  useEffect(() => {
    const openAiHelpFromHeader = () => {
      void openAiHelp();
    };
    window.addEventListener('ruda:open-ai-support', openAiHelpFromHeader);
    return () => window.removeEventListener('ruda:open-ai-support', openAiHelpFromHeader);
  }, [openAiHelp]);

  const askAi = async (question = aiInput) => {
    const text = question.trim();
    if (!text || aiLoading) return;
    speechRecognitionRef.current?.stop();
    speechRecognitionRef.current = null;
    setRecordingVoice(false);
    setAiInput('');
    setAiMessages(previous => [...previous, { role: 'user', text }]);
    void trackMarketingEvent('ai_question', 'home');
    setAiLoading(true);
    try {
      const result = await apiPost<{
        success: boolean;
        reply: string;
        suggestions?: string[];
        productSearch?: boolean;
        productResults?: PublicProductSearchRecord[];
        merchantSearch?: boolean;
        merchantResults?: PublicMerchantSearchResult[];
        browseShowrooms?: boolean;
        browseCatalog?: boolean;
        browseRegistration?: boolean;
      }>('/api/ai/support/chat', {
        message: text,
        language: lang,
        history: aiMessages.slice(-6).map(({ role, text: content }) => ({ role, text: content }))
      });
      setAiMessages(previous => [...previous, {
        role: 'assistant',
        text: result.reply,
        products: result.productSearch ? result.productResults || [] : undefined,
        merchants: result.merchantSearch ? result.merchantResults || [] : undefined,
        showShowroomsLink: Boolean(result.browseShowrooms),
        showCatalogLink: Boolean(result.browseCatalog),
        showRegistrationLink: Boolean(result.browseRegistration)
      }]);
      if (result.suggestions) setAiQuickQuestions(result.suggestions);
    } catch {
      setAiMessages(previous => [...previous, { role: 'assistant', text: localizeCopy('客服繁忙，请用商品搜索。', 'Assistenza occupata. Usa la ricerca prodotti.') }]);
    } finally {
      setAiLoading(false);
    }
  };

  const toggleVoiceInput = () => {
    if (recordingVoice) {
      speechRecognitionRef.current?.stop();
      return;
    }
    const speechWindow = window as Window & {
      SpeechRecognition?: SpeechRecognitionConstructor;
      webkitSpeechRecognition?: SpeechRecognitionConstructor;
    };
    const Recognition = speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;
    if (!Recognition) {
      addNotification('info', localizeCopy('语音输入不可用', 'Dettatura non disponibile'), localizeCopy('请使用支持语音识别的浏览器。', 'Usa un browser con riconoscimento vocale.'));
      return;
    }
    const recognition = new Recognition();
    recognition.lang = lang === 'it' ? 'it-IT' : lang === 'zh' ? 'zh-CN' : 'en-US';
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.onresult = event => {
      const transcript = Array.from(event.results)
        .slice(event.resultIndex)
        .filter(result => result.isFinal)
        .map(result => result[0]?.transcript.trim())
        .filter(Boolean)
        .join(' ');
      if (transcript) setAiInput(current => current ? `${current} ${transcript}` : transcript);
    };
    recognition.onerror = () => setRecordingVoice(false);
    recognition.onend = () => {
      setRecordingVoice(false);
      speechRecognitionRef.current = null;
    };
    try {
      recognition.start();
      speechRecognitionRef.current = recognition;
      setRecordingVoice(true);
    } catch (error) {
      console.error('[homepage-ai-voice]', error);
      addNotification('warning', localizeCopy('无法启动语音输入', 'Impossibile avviare la dettatura'), localizeCopy('请检查麦克风权限后重试。', 'Controlla i permessi del microfono e riprova.'));
    }
  };

  const isIt = lang === 'it';
  const openMerchantStore = (event: React.MouseEvent<HTMLAnchorElement>, merchant: PublicMerchantSearchResult) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    setSelectedMerchantId(merchant.id);
    setCurrentView('merchant_store');
    setShowAiHelp(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const openShowrooms = (event: React.MouseEvent<HTMLAnchorElement>) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    setCurrentView('showrooms');
    setShowAiHelp(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const openCatalog = (event: React.MouseEvent<HTMLAnchorElement>) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    setCatalogCategory('all');
    setCatalogSearchQuery('');
    setCatalogFilterStatus('all');
    setCurrentView('catalog');
    setShowAiHelp(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const openCatalogCategory = (category: string) => {
    setCatalogCategory(category);
    setCatalogSearchQuery('');
    setCatalogFilterStatus('all');
    setCurrentView('catalog');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // New Collection products
  const newCollection = products.filter(p => p.status === 'new' && (!p.visibility || p.visibility !== 'private')).slice(0, 6);
  const allSpecialMarketProducts = products
    .filter(product => product.merchantId && product.status === 'clearance' && !product.isExclusiveProtected && product.visibility !== 'private')
    .sort((left, right) => Number(right.featuredOnHome) - Number(left.featuredOnHome));
  const visibleMerchants = selectedZone ? merchants.filter(merchant => merchant.merchantZone === selectedZone) : merchants;
  const productCountsByMerchant = products.reduce((counts, product) => {
    if (product.merchantId) counts.set(product.merchantId, (counts.get(product.merchantId) || 0) + 1);
    return counts;
  }, new Map<string, number>());
  const merchantsByIndustry = merchantIndustries.map(industry => ({
    industry,
    merchants: merchants.filter(merchant => getHomepageMerchantIndustry(merchant) === industry.id)
  }));
  const homepageCategoryCards = [...new Set(
    products
      .filter(product => product.visibility !== 'private' && !product.isExclusiveProtected)
      .map(product => product.category)
      .filter(Boolean)
  )].slice(0, 5).map(category => ({
    category,
    product: products.find(product => product.category === category && product.visibility !== 'private' && !product.isExclusiveProtected)!
  }));
  const cityWholesalers = merchants.filter(merchant => merchant.merchantZone === 'tavoro').slice(0, 4);
  const cityRetailStores = merchants.filter(merchant => merchant.merchantZone === 'boutique_department').slice(0, 4);
  const wholesaleCountryOptions = [
    { key: 'greece', zh: '希腊', it: 'Grecia', aliases: ['greece', 'grecia', '希腊'] },
    { key: 'spain', zh: '西班牙', it: 'Spagna', aliases: ['spain', 'spagna', '西班牙'] },
    { key: 'france', zh: '法国', it: 'Francia', aliases: ['france', 'francia', '法国'] },
    { key: 'italy', zh: '意大利', it: 'Italia', aliases: ['italy', 'italia', '意大利'] },
    { key: 'poland', zh: '波兰', it: 'Polonia', aliases: ['poland', 'polonia', '波兰'] },
    { key: 'portugal', zh: '葡萄牙', it: 'Portogallo', aliases: ['portugal', 'portogallo', '葡萄牙'] }
  ];
  const getMerchantName = (merchant: Merchant) => getLocalizedMerchantName(merchant, lang);
  const getMerchantCity = (merchant: Merchant) => {
    const city = (lang === 'zh'
      ? merchant.city_zh || merchant.city
      : merchant.city_it || merchant.city).trim();
    if (!city || ['待完善', '未填写', '待补充'].includes(city)) {
      return localizeCopy('城市未填写', 'Città non specificata');
    }
    return city;
  };

  return (
    <>
    <MobileEditorialHome />
    <div className="hidden">
      <section className="hidden min-h-[660px] flex-col items-center justify-center px-6 pb-8 pt-14 text-neutral-950 lg:flex" aria-labelledby="home-ai-title">
        <div className="w-full max-w-4xl text-center">
          <h1 id="home-ai-title" aria-label={welcomeMessage} className="mb-8 mt-5 min-h-[2.5rem] text-2xl font-medium tracking-tight text-neutral-900 xl:text-3xl">
            <span aria-hidden="true">{typedWelcomeMessage}</span>
            <span aria-hidden="true" className="ml-0.5 inline-block h-[0.9em] w-px animate-pulse bg-neutral-500 align-[-0.08em] motion-reduce:animate-none" />
          </h1>
          <form onSubmit={event => { event.preventDefault(); void askAi(); }} className="mx-auto flex max-w-3xl items-center gap-2 rounded-full border border-neutral-200 bg-white p-2 pl-3 shadow-[0_8px_32px_-18px_rgba(0,0,0,0.28)] transition focus-within:border-neutral-400 focus-within:shadow-[0_12px_36px_-18px_rgba(0,0,0,0.3)]">
            <button
              type="button"
              onClick={() => setShowQuickPrompts(value => !value)}
              aria-label={localizeCopy('显示常用问题', 'Mostra domande suggerite')}
              aria-expanded={showQuickPrompts}
              className="flex h-9 w-9 shrink-0 items-center justify-center text-neutral-800 transition hover:text-neutral-500"
            >
              <Plus className="h-5 w-5" />
            </button>
            <input
              aria-label={localizeCopy('询问 ModaUI', 'Chiedi a ModaUI')}
              value={aiInput}
              onChange={event => setAiInput(event.target.value)}
              placeholder={localizeCopy('询问 ModaUI', 'Chiedi a ModaUI')}
              className="min-w-0 flex-1 bg-transparent px-1 py-2.5 text-base text-neutral-900 outline-none placeholder:text-neutral-400"
              disabled={aiLoading}
            />
            <button
              type="button"
              onClick={toggleVoiceInput}
              aria-label={recordingVoice ? localizeCopy('停止语音输入', 'Interrompi dettatura') : localizeCopy('语音输入', 'Dettatura vocale')}
              aria-pressed={recordingVoice}
              className={`flex h-9 w-9 shrink-0 items-center justify-center transition ${recordingVoice ? 'text-rose-700' : 'text-neutral-800 hover:text-neutral-500'}`}
            >
              <Mic className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => aiInput.trim() ? void askAi() : toggleVoiceInput()}
              aria-label={aiInput.trim() ? localizeCopy('发送问题', 'Invia domanda') : localizeCopy('语音对话', 'Conversazione vocale')}
              disabled={aiLoading}
              className={`homepage-ai-send flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white transition active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 focus-visible:ring-offset-2 ${aiInput.trim() ? 'bg-neutral-950 hover:bg-neutral-800 active:bg-neutral-700' : 'bg-neutral-400 hover:bg-neutral-500 active:bg-neutral-600'} disabled:cursor-not-allowed disabled:opacity-50`}
            >
              {aiInput.trim() ? <ArrowUp className="h-4 w-4" /> : <AudioLines className="h-4 w-4" />}
            </button>
          </form>
          {showQuickPrompts && (
            <div className="mx-auto mt-3 flex max-w-3xl flex-wrap justify-center gap-2">
              {[
                localizeCopy('找特价商品', 'Cerca offerte'),
                localizeCopy('找认证商家', 'Cerca fornitori verificati'),
                localizeCopy('怎么采购？', 'Come acquistare?')
              ].map(prompt => (
                <button key={prompt} type="button" onClick={() => { setShowQuickPrompts(false); void askAi(prompt); }} className="rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-xs text-neutral-600 transition hover:border-neutral-400 hover:text-neutral-950">
                  {prompt}
                </button>
              ))}
            </div>
          )}
          {aiMessages.length > 0 && (
            <div className="mx-auto mt-4 max-h-64 max-w-2xl space-y-3 overflow-y-auto rounded-2xl border border-neutral-200 bg-white p-4 text-left shadow-sm">
              {aiMessages.slice(-6).map((message, index) => (
                <div key={`${message.role}-${index}`} className={`rounded-xl px-3.5 py-2.5 text-sm leading-6 ${message.role === 'user' ? 'ml-auto max-w-[88%] bg-neutral-100 text-neutral-800' : 'text-neutral-700'}`}>
                  <p>{message.text}</p>
                  {message.products?.length ? <div className="mt-3 grid gap-2 sm:grid-cols-2">{message.products.slice(0, 4).map(product => <button key={product.id} type="button" onClick={() => quickNavigateToProduct(product.id)} className="flex min-w-0 items-center gap-3 rounded-xl border border-neutral-200 p-2 text-left transition duration-200 hover:-translate-y-0.5 hover:border-neutral-400 hover:bg-neutral-50 hover:shadow-md"><img src={getPublicProductImage(product.images)} alt={getLocalizedProductName(product, lang)} className="h-16 w-12 shrink-0 rounded-lg bg-neutral-100 object-cover" /><span className="min-w-0"><span className="block truncate text-xs font-semibold text-neutral-800">{getLocalizedProductName(product, lang)}</span><span className="mt-1 block text-[10px] text-neutral-500">{product.styleNo}</span><span className="mt-1 block text-xs font-bold text-neutral-900">€{product.wholesalePrice.toFixed(2)}</span></span></button>)}</div> : null}
                  {message.merchants?.length ? <div className="mt-3 flex flex-wrap gap-2">{message.merchants.slice(0, 4).map(merchant => <button key={merchant.id} type="button" onClick={() => { setSelectedMerchantId(merchant.id); setCurrentView('merchant_store'); }} className="rounded-full border border-neutral-200 px-3 py-1.5 text-xs font-semibold text-neutral-700 hover:border-neutral-500">{getLocalizedMerchantName(merchant, lang)}</button>)}</div> : null}
                  {(message.showCatalogLink || message.showShowroomsLink || message.showRegistrationLink) && <div className="mt-2 flex flex-wrap gap-2">{message.showCatalogLink && <button type="button" onClick={() => openCatalogCategory('all')} className="rounded-full bg-neutral-900 px-3 py-1.5 text-xs font-semibold text-white">{localizeCopy('打开商品目录', 'Apri catalogo')}</button>}{message.showShowroomsLink && <button type="button" onClick={() => setCurrentView('showrooms')} className="rounded-full border border-neutral-200 px-3 py-1.5 text-xs font-semibold text-neutral-700">{localizeCopy('查看品牌展厅', 'Vedi showroom')}</button>}{message.showRegistrationLink && <button type="button" onClick={() => setCurrentView('register_wholesale')} className="rounded-full bg-neutral-900 px-3 py-1.5 text-xs font-semibold text-white">{localizeCopy('创建 RUDA 账户', 'Crea un account RUDA')}</button>}</div>}
                </div>
              ))}
              {aiLoading && <p role="status" className="text-xs text-neutral-500">{localizeCopy('正在为你查找…', 'Sto cercando…')}</p>}
              {aiQuickQuestions.slice(0, 3).length > 0 && <div className="flex flex-wrap gap-2 border-t border-neutral-100 pt-3">{aiQuickQuestions.slice(0, 3).map(question => <button key={question} type="button" onClick={() => void askAi(question)} className="rounded-full border border-neutral-200 px-3 py-1.5 text-[11px] text-neutral-600 hover:border-neutral-400">{question}</button>)}</div>}
            </div>
          )}
        </div>
        <div className="mt-14 w-full max-w-5xl">
          <div className="mb-3 flex items-center justify-between">
            <button type="button" onClick={() => openCatalogCategory('all')} className="text-xs font-semibold text-neutral-500 hover:text-neutral-950">{localizeCopy('全部商品', 'Tutti i prodotti')}</button>
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            {homepageCategoryCards.map(({ category, product }, index) => (
              <button key={category} type="button" onClick={() => openCatalogCategory(category)} style={{ animationDelay: `${index * 65}ms` }} className="homepage-card-enter group overflow-hidden rounded-2xl border border-neutral-200 bg-white text-left shadow-sm transition duration-300 hover:-translate-y-1 hover:border-neutral-400 hover:shadow-lg active:scale-[0.98]">
                <ProductImage src={product.images[0]} alt={getLocalizedProductName(product, lang)} contain className="aspect-[4/3] w-full bg-neutral-100" imageClassName="transition-transform duration-500 group-hover:scale-105" />
                <span className="block truncate px-3 py-2.5 text-xs font-semibold text-neutral-800">{category}</span>
              </button>
            ))}
            <button type="button" onClick={() => { setCatalogCategory('all'); setCatalogSearchQuery(''); setCatalogFilterStatus('clearance'); setCurrentView('catalog'); }} style={{ animationDelay: `${homepageCategoryCards.length * 65}ms` }} className="homepage-card-enter group overflow-hidden rounded-2xl border border-neutral-200 bg-white text-left shadow-sm transition duration-300 hover:-translate-y-1 hover:border-neutral-400 hover:shadow-lg active:scale-[0.98]">
              {allSpecialMarketProducts[0] ? <ProductImage src={allSpecialMarketProducts[0].images[0]} alt="" contain className="aspect-[4/3] w-full bg-neutral-100" imageClassName="transition-transform duration-500 group-hover:scale-105" /> : <span className="flex aspect-[4/3] w-full items-center justify-center bg-amber-50 text-xs font-semibold uppercase tracking-[0.2em] text-amber-900">RUDA</span>}
              <span className="block px-3 py-2.5 text-xs font-semibold text-neutral-800">{localizeCopy('特价精选', 'Outlet')}</span>
            </button>
          </div>
          <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2">
            <button type="button" onClick={() => setCurrentView('showrooms')} style={{ animationDelay: '100ms' }} className="homepage-card-enter group flex items-center gap-4 rounded-2xl border border-neutral-200 bg-white p-4 text-left shadow-sm transition duration-300 hover:-translate-y-1 hover:border-neutral-400 hover:shadow-md active:scale-[0.99]">
              <span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-neutral-900">{localizeCopy('官方品牌展厅与认证供应商', 'Showroom e fornitori verificati')}</span><span className="mt-1 block text-xs text-neutral-500">{localizeCopy('浏览品牌系列、现货和批发商家。', 'Esplora collezioni e disponibilità B2B.')}</span></span>
            </button>
            <button type="button" onClick={() => setCurrentView('register_wholesale')} style={{ animationDelay: '165ms' }} className="homepage-card-enter group flex items-center gap-4 rounded-2xl border border-neutral-200 bg-white p-4 text-left shadow-sm transition duration-300 hover:-translate-y-1 hover:border-neutral-400 hover:shadow-md active:scale-[0.99]">
              <span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-neutral-900">{localizeCopy('申请 B2B 批发采购', 'Inizia a comprare all’ingrosso')}</span><span className="mt-1 block text-xs text-neutral-500">{localizeCopy('认证后浏览批发货盘与采购服务。', 'Accedi a prezzi e collezioni per buyer.')}</span></span>
            </button>
          </div>
        </div>
      </section>

      <section className="border-y border-neutral-300 py-6 text-center sm:py-8 lg:hidden">
        <form
          onSubmit={event => {
            event.preventDefault();
            if (searchInput.trim()) quickSearchStyle(searchInput.trim());
          }}
          className="relative mx-auto mt-5 max-w-xl"
        >
          <input
            id="home-style-search-input"
            type="search"
            value={searchInput}
            onChange={event => setSearchInput(event.target.value)}
            placeholder={t('searchPlaceholder')}
            className="w-full rounded-none border border-neutral-300 bg-white py-3 pl-4 pr-24 text-sm text-neutral-900 shadow-sm placeholder:text-neutral-400 focus:border-neutral-950 focus:outline-none focus:ring-1 focus:ring-neutral-950"
          />
          <button
            id="home-style-search-button"
            type="submit"
            className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-none bg-neutral-950 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-neutral-700"
          >
            {t('searchButton')}
          </button>
        </form>
        <div className="mx-auto mt-6 grid max-w-3xl grid-cols-3 gap-2 sm:gap-3">
          <button
            type="button"
            onClick={() => setCurrentView('showrooms')}
            className="inline-flex min-h-12 items-center justify-center border border-neutral-300 bg-white px-2 text-[11px] font-semibold text-neutral-900 transition-colors hover:border-neutral-950 sm:px-4 sm:text-sm"
          >
            <span>{localizeCopy('官方品牌展厅', 'Showroom ufficiale')}</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setCatalogCategory('all');
              setCatalogSearchQuery('');
              setCatalogFilterStatus('clearance');
              setCurrentView('catalog');
            }}
            className="inline-flex min-h-12 items-center justify-center border border-neutral-300 bg-white px-2 text-[11px] font-semibold text-neutral-900 transition-colors hover:border-neutral-950 sm:px-4 sm:text-sm"
          >
            <span>{localizeCopy('RUDA 特价展厅', 'RUDA Outlet')}</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setCurrentView('register_wholesale');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className="inline-flex min-h-12 items-center justify-center gap-1 bg-neutral-950 px-2 text-[11px] font-semibold text-white transition-colors hover:bg-neutral-700 sm:gap-2 sm:px-4 sm:text-sm"
          >
            {localizeCopy('马上免费入驻', 'Iscriviti gratis')}
          </button>
        </div>
      </section>

      <section className="space-y-6 border-t border-neutral-300 pt-6 sm:pt-8">
        <div className="flex justify-end">
          <button type="button" onClick={() => setCurrentView('showrooms')} className="text-xs font-semibold text-neutral-500 hover:text-black">
            {localizeCopy('查看全部商家', 'Tutti i negozi')}
          </button>
        </div>

        <div className="space-y-7">
          {merchantsByIndustry.map(({ industry, merchants: industryMerchants }) => (
            <section key={industry.id} aria-label={localizeCopy(industry.zh, industry.it)} className="space-y-3">
              <div className="flex items-center gap-3">
                <h3 className="shrink-0 text-sm font-bold text-neutral-900">{localizeCopy(industry.zh, industry.it)}</h3>
                <span className="h-px flex-1 bg-neutral-200" />
                <span className="text-[10px] text-neutral-500">{industryMerchants.length} {localizeCopy('家企业', 'aziende')}</span>
              </div>
              {industryMerchants.length > 0 ? (
                <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 scrollbar-hide">
                  {industryMerchants.map(merchant => {
                    const merchantName = getMerchantName(merchant);
                    const productCount = productCountsByMerchant.get(merchant.id) || 0;
                    return (
                      <button
                        key={merchant.id}
                        type="button"
                        onClick={() => {
                          setSelectedMerchantId(merchant.id);
                          setCurrentView('merchant_store');
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                        className="group w-[210px] shrink-0 snap-start overflow-hidden rounded-xl border border-neutral-200 bg-white text-left transition-colors hover:border-neutral-500"
                      >
                        <div className="relative h-28 overflow-hidden bg-neutral-900">
                          <img
                            src={merchant.banner || merchant.showroomImage || merchant.logo}
                            alt={merchantName}
                            className="h-full w-full object-cover opacity-85 transition-transform duration-300 group-hover:scale-105"
                            referrerPolicy="no-referrer"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/75 to-transparent" />
                          <div className="absolute bottom-2 left-2 right-2 flex items-center gap-2">
                            <img src={merchant.logo} alt="" className="h-8 w-8 shrink-0 rounded-md border border-white/70 object-cover" referrerPolicy="no-referrer" />
                            <span className="truncate text-xs font-bold text-white">{merchantName}</span>
                          </div>
                        </div>
                        <div className="flex items-center justify-between gap-2 px-3 py-2.5 text-[10px] text-neutral-500">
                          <span className="truncate">{getMerchantCity(merchant)}</span>
                          <span className="shrink-0 font-semibold text-neutral-800">{productCount} {localizeCopy('款商品', 'articoli')}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="py-3 text-xs text-neutral-400">{localizeCopy('该行业暂无商家，欢迎企业入驻。', 'Nessun negozio in questo settore. Le aziende possono registrarsi.')}</p>
              )}
            </section>
          ))}
        </div>
      </section>

      {/* New collection */}
      <section className="space-y-4 border-t border-neutral-300 pt-5 sm:pt-7">
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => {
              setCatalogCategory('all');
              setCatalogSearchQuery('');
              setCatalogFilterStatus('clearance');
              setCurrentView('catalog');
            }}
            className="text-xs font-semibold text-neutral-500 hover:text-black cursor-pointer"
          >
            {localizeCopy('查看全部', 'Vedi tutti')}
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-5">
          {newCollection.slice(0, 6).map((prod) => {
            const customerPrice = calculateCustomerPrice(prod.wholesalePrice);
            const localizedName = getLocalizedProductName(prod, lang);

            return (
              <div
                key={prod.id}
                onClick={() => quickNavigateToProduct(prod.id)}
                className="group overflow-hidden rounded-2xl border border-neutral-200/80 bg-white shadow-[0_8px_25px_-18px_rgba(0,0,0,0.5)] transition-all hover:-translate-y-1 hover:border-neutral-400 hover:shadow-lg cursor-pointer"
              >
                <div className="aspect-3/4 overflow-hidden relative bg-neutral-100">
                  <ProductImage
                    src={prod.images[0]}
                    alt={localizedName}
                    contain
                    className="h-full w-full"
                    imageClassName="group-hover:scale-105 transition-transform duration-700"
                  />
                  <span className="absolute bottom-1 left-1 px-1.5 py-0.2 bg-black/75 backdrop-blur-xs text-white text-[9px] font-mono font-bold rounded">
                    {prod.styleNo.split('-')[0] || 'RUDA'}
                  </span>
                </div>
                <div className="space-y-1 p-3">
                  <div className="text-[10px] font-mono text-neutral-500 truncate">{prod.styleNo}</div>
                  <div className="text-xs font-medium text-neutral-800 truncate" title={localizedName}>
                    {localizedName}
                  </div>
                  <div className="text-xs font-bold text-neutral-900 font-serif">€{customerPrice.toFixed(2)}</div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 7. Featured merchant storefronts */}
      <section className="space-y-4">
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setCurrentView('showrooms')}
            className="text-xs font-semibold text-neutral-500 hover:text-black cursor-pointer"
          >
            {localizeCopy('查看全部生产商', 'Tutti i negozi')}
          </button>
        </div>

        <div className="flex gap-3 overflow-x-auto pb-1 snap-x snap-mandatory scrollbar-hide">
          {visibleMerchants.slice(0, 4).map((merchant) => {
            const merchantName = getMerchantName(merchant);
            const merchantCity = getMerchantCity(merchant);
            const merchantProductCount = products.filter(product => product.merchantId === merchant.id).length;

            return (
              <button
                key={merchant.id}
                type="button"
                onClick={() => {
                  setSelectedMerchantId(merchant.id);
                  setCurrentView('merchant_store');
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="group relative min-w-[190px] flex-1 snap-start overflow-hidden rounded-2xl border border-neutral-200/80 bg-white text-left shadow-[0_8px_25px_-18px_rgba(0,0,0,0.5)] transition-all hover:-translate-y-1 hover:border-neutral-400 hover:shadow-lg cursor-pointer"
              >
                <div className="relative h-28 overflow-hidden bg-neutral-900">
                  <img
                    src={merchant.banner}
                    alt={merchantName}
                    className="h-full w-full object-cover opacity-80 transition-transform duration-300 group-hover:scale-105"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/75 to-transparent" />
                  <div className="absolute bottom-2 left-2 right-2 flex items-end gap-2">
                    <img
                      src={merchant.logo}
                      alt=""
                      className="h-9 w-9 shrink-0 rounded-lg border border-white/70 object-cover shadow-md"
                      referrerPolicy="no-referrer"
                    />
                    <span className="truncate text-xs font-bold text-white">{merchantName}</span>
                  </div>
                </div>
                <div className="p-3">
                  <div className="min-w-0">
                    <div className="truncate text-[11px] text-neutral-500">{merchantCity}</div>
                    <div className="mt-1 text-[10px] font-semibold text-neutral-800">
                      {merchantProductCount} {localizeCopy('款商品在售', 'articoli disponibili')}
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Featured city wholesalers */}
      <section className="space-y-4">
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => {
              window.history.replaceState({}, '', `${window.location.pathname}?businessType=wholesaler&showroomZone=tavoro${window.location.hash}`);
              setSelectedZone('tavoro');
              setCurrentView('showrooms');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className="text-xs font-semibold text-neutral-500 hover:text-black cursor-pointer"
          >
            {localizeCopy('查看全部城市批发商', 'Vedi tutti')}
          </button>
        </div>
        <div className="grid grid-cols-3 gap-2 sm:gap-3" aria-label={localizeCopy('按国家查看城市批发商', 'Cerca grossisti per paese')}>
          {wholesaleCountryOptions.map(country => {
            const localWholesalerCount = merchants.filter(merchant => {
              if (merchant.merchantZone !== 'tavoro') return false;
              const countryValues = [merchant.country, merchant.country_zh, merchant.country_it]
                .filter(Boolean)
                .map(value => value!.toLowerCase());
              return country.aliases.some(alias => countryValues.some(value => value.includes(alias)));
            }).length;

            return (
            <button
              key={country.key}
              type="button"
              onClick={() => {
                const params = new URLSearchParams(window.location.search);
                params.set('wholesaleCountry', country.key);
                params.set('businessType', 'wholesaler');
                params.set('showroomZone', 'tavoro');
                window.history.replaceState({}, '', `${window.location.pathname}?${params.toString()}${window.location.hash}`);
                setSelectedZone('tavoro');
                setCurrentView('showrooms');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="group min-h-16 rounded-xl border border-neutral-200/90 bg-white p-2.5 text-left shadow-sm transition-colors hover:border-neutral-500 hover:bg-neutral-50 sm:min-h-[4.5rem] sm:p-3"
            >
              <span className="block truncate text-xs font-bold tracking-tight text-neutral-950 sm:text-sm">{localizeCopy(country.zh, country.it)}</span>
              <span className="mt-1 block truncate text-[9px] font-medium text-neutral-500 sm:text-[10px]">
                {localWholesalerCount} {localizeCopy('家当地批发商', 'grossisti locali')}
              </span>
            </button>
            );
          })}
        </div>

        {cityWholesalers.length > 0 ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {cityWholesalers.map(merchant => {
              const merchantName = getMerchantName(merchant);
              const merchantCity = getMerchantCity(merchant);
              const merchantProductCount = products.filter(product => product.merchantId === merchant.id).length;

              return (
                <button
                  key={merchant.id}
                  type="button"
                  onClick={() => {
                    setSelectedMerchantId(merchant.id);
                    setCurrentView('merchant_store');
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className="group overflow-hidden rounded-2xl border border-neutral-200/80 bg-white text-left shadow-[0_8px_25px_-18px_rgba(0,0,0,0.5)] transition-all hover:-translate-y-1 hover:border-neutral-400 hover:shadow-lg cursor-pointer"
                >
                  <div className="relative h-24 overflow-hidden bg-neutral-900">
                    <img src={merchant.banner} alt={merchantName} className="h-full w-full object-cover opacity-80 transition-transform duration-300 group-hover:scale-105" referrerPolicy="no-referrer" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/75 to-transparent" />
                    <div className="absolute bottom-2 left-2 right-2 flex items-center gap-2">
                      <img src={merchant.logo} alt="" className="h-8 w-8 shrink-0 rounded-lg border border-white/70 object-cover" referrerPolicy="no-referrer" />
                      <span className="truncate text-xs font-bold text-white">{merchantName}</span>
                    </div>
                  </div>
                  <div className="p-3">
                    <div className="min-w-0">
                      <div className="truncate text-[11px] text-neutral-500">{merchantCity}</div>
                      <div className="mt-1 text-[10px] font-semibold text-neutral-800">{merchantProductCount} {localizeCopy('款现货', 'articoli')}</div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-neutral-300 bg-white px-5 py-8 text-center text-xs text-neutral-500">
            {localizeCopy('城市批发商正在陆续入驻，敬请期待。', 'I grossisti della città saranno disponibili a breve.')}
          </div>
        )}
      </section>

      {/* Featured city retail stores */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-[0.16em] text-neutral-800">
              {localizeCopy('城市零售店', 'Negozi retail della città')}
            </h3>
            <p className="mt-1 text-[11px] text-neutral-500">
              {localizeCopy('浏览城市零售店与其精选商品，进入独立店铺页面。', 'Scopri le boutique e i negozi locali della rete RUDA.')}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setSelectedZone('boutique_department');
              setCurrentView('showrooms');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className="text-xs font-semibold text-neutral-500 hover:text-black cursor-pointer"
          >
            {localizeCopy('查看全部城市零售店', 'Vedi tutti')}
          </button>
        </div>

        {cityRetailStores.length > 0 ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {cityRetailStores.map(merchant => {
              const merchantName = getMerchantName(merchant);
              const merchantCity = getMerchantCity(merchant);
              const merchantProductCount = products.filter(product => product.merchantId === merchant.id).length;

              return (
                <button
                  key={merchant.id}
                  type="button"
                  onClick={() => {
                    setSelectedMerchantId(merchant.id);
                    setCurrentView('merchant_store');
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className="group overflow-hidden rounded-2xl border border-neutral-200/80 bg-white text-left shadow-[0_8px_25px_-18px_rgba(0,0,0,0.5)] transition-all hover:-translate-y-1 hover:border-neutral-400 hover:shadow-lg cursor-pointer"
                >
                  <div className="relative h-24 overflow-hidden bg-neutral-900">
                    <img src={merchant.banner} alt={merchantName} className="h-full w-full object-cover opacity-80 transition-transform duration-300 group-hover:scale-105" referrerPolicy="no-referrer" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/75 to-transparent" />
                    <div className="absolute bottom-2 left-2 right-2 flex items-center gap-2">
                      <img src={merchant.logo} alt="" className="h-8 w-8 shrink-0 rounded-lg border border-white/70 object-cover" referrerPolicy="no-referrer" />
                      <span className="truncate text-xs font-bold text-white">{merchantName}</span>
                    </div>
                  </div>
                  <div className="p-3">
                    <div className="min-w-0">
                      <div className="truncate text-[11px] text-neutral-500">{merchantCity}</div>
                      <div className="mt-1 text-[10px] font-semibold text-neutral-800">{merchantProductCount} {localizeCopy('款商品', 'articoli')}</div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-neutral-300 bg-white px-5 py-8 text-center text-xs text-neutral-500">
            {localizeCopy('城市零售店正在陆续入驻，敬请期待。', 'I negozi retail della città saranno disponibili a breve.')}
          </div>
        )}
      </section>

      {/* Platform special market: all public clearance products, grouped from every verified merchant. */}
      <section className="space-y-5 pt-4">
        <div className="grid gap-3 rounded-xl border border-neutral-200 bg-white px-3.5 py-3 text-neutral-950 sm:grid-cols-[1fr_auto] sm:items-center sm:px-4 sm:py-3.5">
          <div>
            <div className="text-[9px] font-bold uppercase tracking-[0.16em] text-neutral-500">
              {localizeCopy('面向服装批发商', 'Per grossisti')}
            </div>
            <h4 className="mt-0.5 text-base font-serif font-bold tracking-tight">
              {localizeCopy('批发商入驻', 'Apri il tuo negozio B2B')}
            </h4>
            <p className="mt-0.5 text-[11px] leading-relaxed text-neutral-500">
              {localizeCopy('开设独立店铺，上传真实库存，统一管理订单。', 'Negozio indipendente, stock reale e ordini centralizzati.')}
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5 text-[9px] font-medium text-neutral-700">
              <span className="rounded-full border border-neutral-200 bg-neutral-50 px-2 py-0.5">{localizeCopy('独立店铺', 'Negozio indipendente')}</span>
              <span className="rounded-full border border-neutral-200 bg-neutral-50 px-2 py-0.5">{localizeCopy('真实库存', 'Stock reale')}</span>
              <span className="rounded-full border border-neutral-200 bg-neutral-50 px-2 py-0.5">{localizeCopy('订单管理', 'Gestione ordini')}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              window.location.assign(`https://${PORTAL_DOMAINS.merchant}`);
            }}
            className="inline-flex items-center justify-center rounded-lg bg-white px-3 py-2 text-sm font-bold text-neutral-950 transition-colors hover:bg-neutral-200 cursor-pointer"
          >
            {localizeCopy('申请批发商入驻', 'Diventa grossista')}
          </button>
        </div>
        {allSpecialMarketProducts.length === 0 ? (
          <div className="rounded-xl border border-dashed border-neutral-300 bg-white p-5 text-center text-xs text-neutral-500">{localizeCopy('暂无特价商品。', 'Nessun prodotto outlet.')}</div>
        ) : (
          <div className="grid grid-cols-6 items-start gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
            {allSpecialMarketProducts.map((product, index) => {
              const merchant = merchants.find(item => item.id === product.merchantId);
              const localizedName = getLocalizedProductName(product, lang);
              const isThreeColumnCard = index % 7 >= 4 && index % 7 <= 6;
              return (
                <div key={product.id} onClick={() => quickNavigateToProduct(product.id)} className={`group ${isThreeColumnCard ? 'col-span-2' : 'col-span-3'} cursor-pointer overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-2xs transition-all hover:-translate-y-0.5 hover:border-[#14edfc] hover:shadow-[0_0_18px_rgba(20,237,252,0.24)] sm:col-span-1`}>
                  <div className="relative overflow-hidden bg-neutral-100">
                    <ProductImage src={product.images[0]} alt={localizedName} contain className="aspect-[3/4] h-auto w-full p-1" imageClassName="group-hover:scale-105 transition-transform duration-700" />
                    <span className="absolute left-1 top-1 rounded bg-white px-1.5 py-0.5 text-[9px] font-bold text-black shadow-sm">{localizeCopy('特价', 'Outlet')}</span>
                  </div>
                  <div className="space-y-1 p-3">
                    <p className="truncate text-[10px] font-semibold text-neutral-900">{localizedName}</p>
                    <p className="mt-0.5 truncate text-[10px] text-neutral-500">{merchant?.name || product.merchantName || 'RUDA Partner'}</p>
                    <p className="mt-1 text-xs font-bold text-neutral-950">€{calculateCustomerPrice(product.wholesalePrice).toFixed(2)}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="border-y border-neutral-200 py-8 sm:py-9" aria-labelledby="seo-intent-heading">
        <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div>
            <h2 id="seo-intent-heading" className="max-w-2xl font-serif text-2xl font-bold tracking-tight text-neutral-950 sm:text-3xl">
              {localizeCopy('意大利女装现货批发', 'Ingrosso moda donna pronta')}
            </h2>
            <p className="mt-2 max-w-2xl text-sm text-neutral-600">
              {localizeCopy('对接意大利供应商与欧洲买家。', 'Fornitori italiani per buyer europei.')}
            </p>
            <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold">
              <a href="/catalog" className="rounded-full border border-neutral-300 bg-white px-3 py-2 hover:border-black">
                {localizeCopy('现货目录', 'Catalogo')}
              </a>
              <a href="/showrooms" className="rounded-full border border-neutral-300 bg-white px-3 py-2 hover:border-black">
                {localizeCopy('认证供应商', 'Fornitori verificati')}
              </a>
              <a href="/register-wholesale" className="rounded-full border border-neutral-300 bg-white px-3 py-2 hover:border-black">
                {localizeCopy('B2B 认证', 'Accesso B2B')}
              </a>
            </div>
          </div>
          <div className="lg:justify-self-end">
            <details className="rounded-xl border border-neutral-200 bg-white px-4 py-3 lg:max-w-sm">
              <summary className="cursor-pointer text-xs font-semibold text-neutral-900">
                {localizeCopy('怎么采购？', 'Come acquistare?')}
              </summary>
              <p className="mt-2 text-xs text-neutral-600">
                {localizeCopy('完成 B2B 认证后即可联系供应商。', 'Dopo la verifica B2B, contatta i fornitori.')}
              </p>
            </details>
          </div>
        </div>
      </section>

      <div className="fixed bottom-20 right-4 z-40 sm:bottom-6 sm:right-6 lg:hidden">
        {showAiHelp && (
          <div className="fixed bottom-[calc(4.75rem+env(safe-area-inset-bottom))] right-4 z-50 flex h-[min(72vh,640px)] max-h-[calc(100vh-9rem)] w-[min(92vw,480px)] flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-2xl md:absolute md:bottom-14 md:right-0">
            <div className="flex shrink-0 items-center justify-between bg-neutral-950 px-5 py-4 text-white">
              <div className="flex items-center gap-2">
                <div><span className="block text-sm font-bold">{localizeCopy('AI 客服', 'Assistenza AI')}</span><span className="block text-[10px] text-neutral-400">{localizeCopy('RUDA 买手助手', 'Assistente RUDA')}</span></div>
              </div>
              <button type="button" onClick={() => setShowAiHelp(false)} aria-label={localizeCopy('关闭 AI 客服', 'Chiudi assistenza AI')} className="text-xs text-neutral-300 hover:text-white">{localizeCopy('关闭', 'Chiudi')}</button>
            </div>
            <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto bg-neutral-50 p-4">
              {aiMessages.map((message, index) => (
                <div key={`${message.role}-${index}`} className={`rounded-xl px-4 py-3 text-sm leading-relaxed ${message.role === 'user' ? 'ml-auto max-w-[92%] bg-black text-white' : 'w-full border border-neutral-200 bg-white text-neutral-700'}`}>
                  <p>{message.text}</p>
                  {message.products?.length ? (
                    <div className="mt-3 space-y-2">
                      {message.products.map(product => (
                        <button
                          key={product.id}
                          type="button"
                          onClick={() => {
                            quickNavigateToProduct(product.id);
                            setShowAiHelp(false);
                          }}
                          className="flex w-full items-center gap-3 rounded-xl border border-neutral-200 bg-white p-3 text-left transition-colors hover:border-neutral-500 hover:bg-neutral-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900"
                        >
                          {product.images
                            ? <ProductImage src={(() => {
                                try {
                                  const images = JSON.parse(product.images) as string[];
                                  return images[0] || '';
                                } catch {
                                  return '';
                                }
                              })()} alt={product.name_zh || product.name} className="h-14 w-12 shrink-0 overflow-hidden rounded-lg bg-neutral-100" imageClassName="h-full w-full object-cover" />
                            : <span className="h-14 w-12 shrink-0 rounded-lg bg-neutral-100" aria-hidden="true" />}
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-semibold text-neutral-900">{getLocalizedProductName(product, lang)}</span>
                            <span className="mt-1 block truncate text-xs text-neutral-500">{product.merchant?.name || product.merchantName || product.brand}{product.merchant?.city ? ` · ${lang === 'zh' ? product.merchant.city_zh || product.merchant.city : product.merchant.city_it || product.merchant.city}` : ''}</span>
                            <span className="mt-1 block text-xs text-neutral-500">{localizeCopy('起订量', 'MOQ')} {product.moq}</span>
                          </span>
                          <span className="shrink-0 text-right">
                            <span className="block font-bold text-neutral-900">€{product.wholesalePrice.toFixed(2)}</span>
                            <span className="text-[10px] text-neutral-500">{localizeCopy('批发价 / 件', 'all’ingrosso / pezzo')}</span>
                          </span>
                        </button>
                      ))}
                    </div>
                  ) : null}
                  {message.merchants?.length ? (
                    <div className="mt-3 space-y-2">
                      {message.merchants.map(merchant => {
                        const businessTypeLabel = getMerchantBusinessTypeLabel(merchant.businessType);
                        const merchantName = getLocalizedMerchantName(merchant, lang);
                        const tagline = lang === 'zh'
                          ? merchant.tagline_zh || merchant.tagline
                          : merchant.tagline_it || (merchant.tagline || '').replace(/[\u4e00-\u9fa5]/g, '').trim();
                        const city = lang === 'zh'
                          ? merchant.city_zh || merchant.city
                          : merchant.city_it || merchant.city;
                        const country = lang === 'zh'
                          ? merchant.country_zh || merchant.country
                          : merchant.country_it || merchant.country;
                        const visibleCity = city && !['待完善', '未填写', '待补充'].includes(city.trim())
                          ? city
                          : localizeCopy('城市未填写', 'Città non specificata');
                        const location = [visibleCity, country].filter(Boolean).join(', ');
                        return <a
                          key={merchant.id}
                          href={getMerchantStoreUrl(merchant)}
                          onClick={event => openMerchantStore(event, merchant)}
                          className="flex items-center gap-3 rounded-xl border border-neutral-200 bg-white p-3 text-left transition-colors hover:border-neutral-500 hover:bg-neutral-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900"
                        >
                          {merchant.logo
                            ? <img src={merchant.logo} alt="" className="h-12 w-12 shrink-0 rounded-lg object-cover" />
                            : <span className="h-12 w-12 shrink-0 rounded-lg bg-neutral-100" aria-hidden="true" />}
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-semibold text-neutral-900">{merchantName}</span>
                            {merchant.businessType && <span className="mt-0.5 inline-block rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-medium text-neutral-600">{businessTypeLabel ? localizeCopy(businessTypeLabel[0], businessTypeLabel[1]) : merchant.businessType}</span>}
                            {tagline && <span className="mt-0.5 block truncate text-xs text-neutral-500">{tagline}</span>}
                            {location && <span className="mt-1 block text-xs text-neutral-500">{location}</span>}
                          </span>
                          <span className="shrink-0 text-xs font-semibold text-neutral-700">{localizeCopy('进入店铺', 'Apri')}</span>
                        </a>;
                      })}
                    </div>
                  ) : null}
                  {message.showShowroomsLink && (
                    <a href="/showrooms" onClick={openShowrooms} className="mt-3 inline-flex items-center font-semibold text-neutral-900 underline underline-offset-2">
                      {localizeCopy('打开商家地图查看全部认证店铺', 'Apri la mappa con tutti i negozi RUDA')}
                    </a>
                  )}
                  {message.showCatalogLink && (
                    <a href="/catalog" onClick={openCatalog} className="mt-3 inline-flex items-center font-semibold text-neutral-900 underline underline-offset-2">
                      {localizeCopy('打开现货商城浏览公开商品', 'Apri il catalogo prodotti')}
                    </a>
                  )}
                </div>
              ))}
              {aiLoading && <div className="w-fit rounded-xl bg-white px-4 py-3 text-sm text-neutral-400 border border-neutral-200">{localizeCopy('正在查询…', 'Ricerca…')}</div>}
              {aiMessages.length === 1 && <div className="flex flex-wrap gap-2 pt-1">{aiQuickQuestions.map(question => <button key={question} type="button" onClick={() => void askAi(question)} className="rounded-full border border-neutral-300 bg-white px-3 py-2 text-xs text-neutral-600 hover:border-black hover:text-black">{question}</button>)}</div>}
            </div>
            <form onSubmit={event => { event.preventDefault(); void askAi(); }} className="flex shrink-0 items-center gap-3 border-t border-neutral-200 bg-white p-4">
              <input value={aiInput} onChange={event => setAiInput(event.target.value)} placeholder={localizeCopy('输入款号、品类或问题…', 'Codice, categoria o domanda…')} className="min-w-0 flex-1 rounded-lg bg-neutral-100 px-4 py-3 text-sm outline-none focus:ring-1 focus:ring-black" />
              <button type="submit" disabled={aiLoading || !aiInput.trim()} aria-label={localizeCopy('发送问题', 'Invia domanda')} className="rounded-lg bg-black px-3 py-2 text-xs font-semibold text-white disabled:opacity-40">{aiLoading ? localizeCopy('查询中…', 'Controllo…') : localizeCopy('发送', 'Invia')}</button>
            </form>
          </div>
        )}
      </div>

    </div>
    </>
  );
};
