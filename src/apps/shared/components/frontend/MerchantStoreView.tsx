import React, { useEffect, useRef, useState } from 'react';
import { 
  ShieldCheck, 
  Lock, 
  Unlock, 
  Sparkles, 
  ShoppingBag, 
  Clock, 
  Eye, 
  Layers, 
  Send,
  CheckCircle2,
  Search,
  Bot,
  X,
  Minus,
  Plus
} from 'lucide-react';
import { useB2B } from '../../../../context/B2BContext';
import {
  getLocalizedMerchantName,
  getLocalizedMerchantTagline,
  getLocalizedProductName
} from '../../../../i18n/translations';
import { ProductImage } from '../common/ProductImage';
import { ShareButton } from '../common/ShareButton';
import { DEFAULT_MERCHANT_BANNER, merchantMediaUrl } from '../../../../utils/merchantMedia';
import { getMerchantStoreUrl } from '../../../../utils/share';
import { Product } from '../../../../types/b2b';
import { getProductCategoryLabel } from '../../../../constants/productCategories';
import './MerchantStoreView.css';

export const MerchantStoreView: React.FC<{ embeddedInMerchantApp?: boolean; merchantId?: string }> = ({ embeddedInMerchantApp = false, merchantId }) => {
  const { 
    merchants, 
    selectedMerchantId, 
    products, 
    hasVaultAccess, 
    getVaultStatus,
    requestVaultAccess,
    currentCustomer,
    isRegisteredWholesale,
    calculateCustomerPrice,
    addToCart,
    cart,
    clearCart,
    setSingleItemCheckoutToken,
    setCurrentView,
    addNotification,
    lang,
    t, localizeCopy
  } = useB2B();

  const isIt = lang === 'it';
  const activeMerchant = merchants.find(m => m.id === (merchantId || selectedMerchantId)) || merchants[0];

  // Active tab: 'public' vs 'vault'
  const [activeTab, setActiveTab] = useState<'new' | 'special' | 'custom' | 'profile'>(() =>
    new URLSearchParams(window.location.search).get('tab') === 'custom' ? 'custom' : 'new'
  );
  const [failedStoreVideoUrl, setFailedStoreVideoUrl] = useState('');
  const [selectedStoreProduct, setSelectedStoreProduct] = useState<Product | null>(null);
  const [selectedStoreSku, setSelectedStoreSku] = useState('');
  const [storeProductQuantity, setStoreProductQuantity] = useState(1);
  const [singleItemLink, setSingleItemLink] = useState('');
  const [creatingSingleItemLink, setCreatingSingleItemLink] = useState(false);
  const [paymentEnabled, setPaymentEnabled] = useState<boolean | null>(null);
  const initializedSharedProduct = useRef(false);
  const paymentStatusRequested = useRef(false);
  const addNotificationRef = useRef(addNotification);
  addNotificationRef.current = addNotification;
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Request form state
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [requestNote, setRequestNote] = useState(
    localizeCopy('申请查看当季首发新款、样板细节及大货起订报价', 'Richiesta di consultazione campionario protetto e listino wholesale')
  );
  const [showAiSupport, setShowAiSupport] = useState(false);
  const [aiInput, setAiInput] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [storefrontAiEnabled, setStorefrontAiEnabled] = useState(false);
  const [aiMessages, setAiMessages] = useState<Array<{ role: 'user' | 'assistant'; text: string }>>([]);
  const [aiQuickQuestions, setAiQuickQuestions] = useState<string[]>([]);

  const isVaultApproved = embeddedInMerchantApp || hasVaultAccess(activeMerchant.id);
  const canViewWholesaleProducts = embeddedInMerchantApp || isRegisteredWholesale;
  const vaultStatus = getVaultStatus(activeMerchant.id);
  const accessIntentHandled = useRef(false);

  useEffect(() => {
    if (accessIntentHandled.current) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('requestAccess') !== '1') return;
    accessIntentHandled.current = true;
    if (!isVaultApproved && vaultStatus !== 'pending') setShowRequestModal(true);
  }, [isVaultApproved, vaultStatus]);

  useEffect(() => {
    if (embeddedInMerchantApp) {
      setStorefrontAiEnabled(false);
      return;
    }
    let active = true;
    setStorefrontAiEnabled(false);
    fetch(`/api/merchant-ai/support/status/${encodeURIComponent(activeMerchant.id)}`)
      .then(async response => {
        if (!response.ok) throw new Error('STOREFRONT_AI_STATUS_UNAVAILABLE');
        const result = await response.json() as { enabled?: boolean };
        if (active) setStorefrontAiEnabled(result.enabled === true);
      })
      .catch(error => {
        console.error('[storefront-ai-status]', error instanceof Error ? error.message : error);
      });
    return () => { active = false; };
  }, [activeMerchant.id, embeddedInMerchantApp]);

  // Filter products for this merchant
  const merchantProducts = products.filter(
    product => product.merchantId === activeMerchant.id
      && (product.lifecycleStatus || 'published') === 'published'
      && (embeddedInMerchantApp || (
        !product.isLockedForBuyer
        && (canViewWholesaleProducts || product.visibility !== 'wholesale')
        && ((product.visibility !== 'private' && !product.isExclusiveProtected) || isVaultApproved)
      ))
  );
  const newProducts = merchantProducts.filter(p => !p.isExclusiveProtected && p.visibility !== 'private' && p.status !== 'clearance');
  const customProducts = merchantProducts.filter(p => p.isExclusiveProtected || p.visibility === 'private');
  const specialProducts = merchantProducts.filter(p => !p.isExclusiveProtected && p.visibility !== 'private' && p.status === 'clearance');
  const displayProducts = activeTab === 'new' ? newProducts : activeTab === 'special' ? specialProducts : customProducts;

  const filteredProducts = displayProducts.filter(p => {
    if (categoryFilter !== 'all' && p.category !== categoryFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return p.name.toLowerCase().includes(q) || 
             p.styleNo.toLowerCase().includes(q) ||
             p.fabric.toLowerCase().includes(q);
    }
    return true;
  });

  const handleApplyAccess = (e: React.FormEvent) => {
    e.preventDefault();
    requestVaultAccess(activeMerchant.id, requestNote);
    setShowRequestModal(false);
  };

  const merchantName = getLocalizedMerchantName(activeMerchant, lang);
  const storefrontTemplate = activeMerchant.storefrontTemplate || 'fashion_monochrome';
  const merchantTagline = getLocalizedMerchantTagline(activeMerchant, lang);
  const merchantCity = isIt ? activeMerchant.city.replace(/[\u4e00-\u9fa5]/g, '').trim() : activeMerchant.city;
  const merchantCountry = localizeCopy('意大利', 'Italia');
  const merchantBanner = merchantMediaUrl(activeMerchant.banner, DEFAULT_MERCHANT_BANNER);
  const storefrontVideoUrl = activeMerchant.storefrontVideo || '/videos/ruda-home.mp4';
  const storeCartItems = cart.filter(item => item.merchantId === activeMerchant.id);
  const storeCartCount = storeCartItems.reduce((total, item) => total + item.quantity, 0);
  const getAvailableStock = (sku: Product['skus'][number]) => Math.max(0, sku.stockCentral - (sku.reserved || 0));

  useEffect(() => {
    if (embeddedInMerchantApp || paymentStatusRequested.current) return;
    paymentStatusRequested.current = true;
    let active = true;
    fetch('/api/payments/status')
      .then(async response => {
        const result = await response.json() as { onlinePaymentsEnabled?: boolean };
        if (!response.ok) throw new Error('PAYMENT_STATUS_UNAVAILABLE');
        if (active) setPaymentEnabled(result.onlinePaymentsEnabled === true);
      })
      .catch(() => {
        if (active) {
          setPaymentEnabled(false);
          addNotificationRef.current('warning', '在线支付状态暂不可用', '请稍后刷新店铺；支付状态确认前不会允许生成收款链接。');
        }
      });
    return () => { active = false; };
  }, [embeddedInMerchantApp]);

  useEffect(() => {
    if (embeddedInMerchantApp || initializedSharedProduct.current) return;
    const params = new URLSearchParams(window.location.search);
    const productId = params.get('product');
    const sku = params.get('sku');
    const token = params.get('singleItemToken');
    if (!productId) return;
    const product = merchantProducts.find(item => item.id === productId);
    if (!product) return;
    const sharedSku = sku
      ? product.skus.find(item => item.sku === sku && getAvailableStock(item) > 0)
      : product.skus.find(item => getAvailableStock(item) > 0);
    if (!sharedSku) {
      initializedSharedProduct.current = true;
      addNotification('warning', '商品规格暂不可购买', '此链接对应的规格已售罄或不再提供，请联系商家。');
      return;
    }
    initializedSharedProduct.current = true;
    if (token) {
      setSingleItemCheckoutToken(token);
      setSingleItemLink(window.location.href);
    } else {
      setSingleItemCheckoutToken(null);
      setSingleItemLink('');
    }
    setSelectedStoreProduct(product);
    setSelectedStoreSku(sharedSku.sku);
    setStoreProductQuantity(token ? 1 : Math.max(1, product.moq || product.packSize || 1));
    setActiveTab(product.status === 'clearance' ? 'special' : 'new');
  }, [addNotification, embeddedInMerchantApp, merchantProducts, setSingleItemCheckoutToken]);

  const openStoreProduct = (product: Product) => {
    setSingleItemLink('');
    setSingleItemCheckoutToken(null);
    setSelectedStoreProduct(product);
    const firstAvailableSku = product.skus.find(item => getAvailableStock(item) > 0) || product.skus[0];
    setSelectedStoreSku(firstAvailableSku?.sku || '');
    setStoreProductQuantity(Math.max(1, product.moq || product.packSize || 1));
  };

  const addStoreProductToCart = () => {
    if (!selectedStoreProduct || !selectedStoreSku) return;
    const sku = selectedStoreProduct.skus.find(item => item.sku === selectedStoreSku);
    if (!sku || storeProductQuantity < (selectedStoreProduct.moq || 1) || storeProductQuantity > getAvailableStock(sku)) return;
    addToCart({
      productId: selectedStoreProduct.id,
      productName: getLocalizedProductName(selectedStoreProduct, lang),
      styleNo: selectedStoreProduct.styleNo,
      image: selectedStoreProduct.images[0],
      sku: sku.sku,
      color: sku.color,
      size: sku.size,
      quantity: storeProductQuantity,
      unitPrice: calculateCustomerPrice(selectedStoreProduct.wholesalePrice),
      packSize: selectedStoreProduct.packSize,
      merchantId: activeMerchant.id,
      merchantName
    });
    setSelectedStoreProduct(null);
  };

  const createSingleItemPaymentLink = async () => {
    if (!selectedStoreProduct || !selectedStoreSku || creatingSingleItemLink || paymentEnabled !== true) return;
    setCreatingSingleItemLink(true);
    setSingleItemLink('');
    try {
      const response = await fetch('/api/storefront/single-item-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId: selectedStoreProduct.id, sku: selectedStoreSku })
      });
      const result = await response.json() as { success?: boolean; url?: string; error?: string };
      if (!response.ok || !result.success || !result.url) {
        throw new Error(result.error === 'ONLINE_PAYMENT_NOT_CONFIGURED'
          ? '在线支付尚未配置，暂时不能生成单件收款链接。'
          : result.error === 'SINGLE_ITEM_LINK_SIGNING_NOT_CONFIGURED'
            ? '安全链接签名密钥尚未配置，暂时不能生成收款链接。'
          : '暂时无法生成单件付款链接，请稍后重试。');
      }
      setSingleItemLink(result.url);
      addNotification('success', '单件付款链接已生成', '链接仅允许购买所选规格 1 件，并将在 180 天后失效。');
    } catch (error) {
      addNotification('warning', '生成付款链接失败', error instanceof Error ? error.message : '请稍后重试。');
    } finally {
      setCreatingSingleItemLink(false);
    }
  };

  const buySingleItem = () => {
    if (!selectedStoreProduct || !selectedStoreSku || !singleItemLink || paymentEnabled !== true) return;
    const token = new URL(singleItemLink, window.location.origin).searchParams.get('singleItemToken');
    const sku = selectedStoreProduct.skus.find(item => item.sku === selectedStoreSku);
    if (!token || !sku || getAvailableStock(sku) < 1) return;
    clearCart();
    addToCart({
      productId: selectedStoreProduct.id,
      productName: getLocalizedProductName(selectedStoreProduct, lang),
      styleNo: selectedStoreProduct.styleNo,
      image: selectedStoreProduct.images[0],
      sku: sku.sku,
      color: sku.color,
      size: sku.size,
      quantity: 1,
      unitPrice: calculateCustomerPrice(selectedStoreProduct.wholesalePrice),
      packSize: selectedStoreProduct.packSize,
      merchantId: activeMerchant.id,
      merchantName
    });
    setSingleItemCheckoutToken(token);
    setSelectedStoreProduct(null);
    setCurrentView('checkout');
  };

  const openStoreCart = () => {
    if (embeddedInMerchantApp) {
      const slug = activeMerchant.storeSlug || activeMerchant.slug || activeMerchant.id;
      window.open(`/shop/${encodeURIComponent(slug)}`, '_blank', 'noopener,noreferrer');
      return;
    }
    setCurrentView('cart');
  };

  const askMerchantAi = async (question?: string) => {
    const text = (question || aiInput).trim();
    if (!text || aiLoading) return;
    const history = aiMessages.slice(-6);
    setAiInput('');
    setAiMessages(prev => [...prev, { role: 'user', text }]);
    setAiLoading(true);
    try {
      const response = await fetch('/api/merchant-ai/support/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ merchantId: activeMerchant.id, message: text, lang, history })
      });
      const result = await response.json() as { success?: boolean; reply?: string; suggestions?: string[] };
      if (response.status === 403) setStorefrontAiEnabled(false);
      if (!response.ok || !result.success) throw new Error('MERCHANT_AI_UNAVAILABLE');
      setAiMessages(prev => [...prev, { role: 'assistant', text: result.reply || '暂时无法回答，请稍后再试。' }]);
      if (Array.isArray(result.suggestions)) setAiQuickQuestions(result.suggestions);
    } catch {
      setAiMessages(prev => [...prev, { role: 'assistant', text: localizeCopy('AI 客服暂时无法连接，您也可以直接通过店铺电话联系生产商。', 'Servizio AI temporaneamente non disponibile. Contatta direttamente l’atelier.') }]);
    } finally {
      setAiLoading(false);
    }
  };

  const categoryOptions = [
    { key: 'all', label: localizeCopy('全部品类', 'Tutti i Capi') },
    ...[...new Set(merchantProducts.map(product => product.category))].map(category => ({
      key: category,
      label: getProductCategoryLabel(category, isIt)
    }))
  ];

  return (
    <div data-storefront-template={storefrontTemplate} className="merchant-storefront min-h-screen bg-white text-neutral-950">
      <div className="mx-auto max-w-[1440px] px-4 pb-12 sm:px-8 lg:px-12">
        <header className="storefront-header border-b border-neutral-200 pb-5 pt-8 text-center sm:pt-12">
          <p className="text-[9px] font-semibold uppercase tracking-[0.38em] text-neutral-500">{localizeCopy('独立品牌 · 批发精选', 'Atelier · Collezione')}</p>
          <h1 className="mt-3 font-serif text-3xl font-medium tracking-[0.08em] text-black sm:text-5xl">{merchantName}</h1>
          <p className="mt-2 text-[10px] tracking-[0.16em] text-neutral-500">{merchantCity} · {merchantCountry}{activeMerchant.showroomArea ? ` · ${activeMerchant.showroomArea}` : ''}</p>
          {merchantTagline && <p className="mx-auto mt-3 max-w-xl text-xs leading-5 text-neutral-600">{merchantTagline}</p>}
          {!embeddedInMerchantApp && (
            <div className="mt-4 flex justify-center">
              <ShareButton
                title={`${merchantName} · RUDA Fashion`}
                text={`浏览 ${merchantName} 的店铺和商品`}
                path={getMerchantStoreUrl(activeMerchant)}
                source={`store-${activeMerchant.id}`}
              />
            </div>
          )}
        </header>

        <nav className="storefront-nav sticky top-0 z-30 -mx-4 flex items-center justify-center gap-0 overflow-x-auto border-b border-neutral-200 bg-white/95 px-2 backdrop-blur sm:mx-0 sm:gap-6 sm:px-4" aria-label={localizeCopy('店铺导航', 'Navigazione negozio')}>
          {([
            ['new', localizeCopy('新款区', 'NUOVI ARRIVI'), newProducts.length],
            ['special', localizeCopy('特价区', 'OFFERTA'), specialProducts.length],
            ['custom', localizeCopy('授权订做区', 'SU ORDINAZIONE'), customProducts.length],
            ['profile', localizeCopy('我的', 'ATELIER'), undefined]
          ] as const).map(([key, label, count]) => (
            <button key={key} type="button" onClick={() => setActiveTab(key)} className={`storefront-nav-link relative shrink-0 px-3 py-4 text-[9px] font-semibold tracking-[0.16em] transition-colors sm:px-4 sm:text-[10px] ${activeTab === key ? 'text-black' : 'text-neutral-500 hover:text-black'}`}>
              {label}{count !== undefined ? <span className="ml-1 text-[8px] text-neutral-400">{count}</span> : null}
              {activeTab === key && <span className="storefront-nav-active absolute inset-x-3 bottom-0 h-[2px] bg-black sm:inset-x-4" />}
            </button>
          ))}
          <button type="button" onClick={openStoreCart} className="storefront-cart relative ml-2 inline-flex shrink-0 items-center gap-1.5 border-l border-neutral-200 px-3 py-3 text-[9px] font-semibold tracking-[0.12em] text-neutral-800 hover:text-black sm:text-[10px]" aria-label={localizeCopy('购物车', 'Carrello')}>
            <ShoppingBag className="h-4 w-4" />
            <span>{localizeCopy('购物车', 'CARRELLO')}</span>
            {storeCartCount > 0 && <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-black px-1 text-[9px] text-white">{storeCartCount}</span>}
          </button>
        </nav>

        <section className="storefront-hero relative mt-5 h-[58vh] min-h-[360px] max-h-[760px] overflow-hidden bg-neutral-100 sm:mt-8 sm:h-[72vh]" aria-label={localizeCopy('店铺视频展示', 'Film della collezione')}>
          {failedStoreVideoUrl !== storefrontVideoUrl ? (
            <video
              className="absolute inset-0 h-full w-full object-cover"
              src={storefrontVideoUrl}
              poster={merchantBanner}
              autoPlay
              muted
              loop
              playsInline
              controls
              preload="metadata"
              onError={() => setFailedStoreVideoUrl(storefrontVideoUrl)}
            />
          ) : (
            <img
              src={merchantBanner}
              alt={merchantName}
              className="absolute inset-0 h-full w-full object-cover"
              referrerPolicy="no-referrer"
              onError={event => {
                event.currentTarget.onerror = null;
                event.currentTarget.src = DEFAULT_MERCHANT_BANNER;
              }}
            />
          )}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-black/5" />
          <div className="pointer-events-none absolute inset-x-5 bottom-6 text-white sm:inset-x-10 sm:bottom-10">
            <p className="text-[9px] font-medium uppercase tracking-[0.3em] text-white/80">{localizeCopy('本季精选', 'La selezione')}</p>
            <p className="mt-2 font-serif text-2xl tracking-[0.08em] sm:text-4xl">{merchantName}</p>
          </div>
        </section>

        {activeTab === 'profile' && (
          <section className="storefront-profile mx-auto max-w-3xl border-b border-neutral-200 py-10 text-center sm:py-16">
            <p className="text-[9px] font-semibold uppercase tracking-[0.3em] text-neutral-500">{localizeCopy('品牌故事', 'La Maison')}</p>
            <h2 className="mt-3 font-serif text-2xl tracking-wide sm:text-3xl">{merchantName}</h2>
            <p className="mt-5 whitespace-pre-line text-sm leading-7 text-neutral-600">{(lang === 'zh' ? activeMerchant.description_zh : activeMerchant.description_it) || activeMerchant.description || localizeCopy("了解品牌与店铺精选系列。", "Scopri la collezione e l’identità dell’atelier.")}</p>
            <p className="mt-5 text-[10px] tracking-[0.14em] text-neutral-500">{merchantCity} · {merchantCountry}{activeMerchant.showroomAddress ? ` · ${activeMerchant.showroomAddress}` : ''}</p>
            {activeMerchant.specialties.length > 0 && <div className="mt-6 flex flex-wrap justify-center gap-2">{activeMerchant.specialties.map(specialty => <span key={specialty} className="border border-neutral-300 px-3 py-1.5 text-[9px] uppercase tracking-[0.12em] text-neutral-600">{specialty}</span>)}</div>}
            <div className="mt-8 flex flex-col items-center gap-2 text-xs text-neutral-600">
              {activeMerchant.contactPerson && <span>{activeMerchant.contactPerson}</span>}
              {activeMerchant.contactPhone && <a href={`tel:${activeMerchant.contactPhone}`} className="underline underline-offset-4">{activeMerchant.contactPhone}</a>}
              {activeMerchant.contactEmail && <a href={`mailto:${activeMerchant.contactEmail}`} className="underline underline-offset-4">{activeMerchant.contactEmail}</a>}
            </div>
          </section>
        )}

      {/* DISPLAY MODE 1: PUBLIC PRODUCTS SECTION */}
      {(activeTab === 'new' || activeTab === 'special') && (
        <div className="storefront-products space-y-5">
          {/* Subheader and Filters */}
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-5 border-b border-neutral-300 pb-5">
            <div>
              <p className="text-[10px] font-bold tracking-[0.25em] text-neutral-500 uppercase mb-2">{localizeCopy('本季选品目录', 'The current edit')}</p>
              <h2 className="text-xl sm:text-2xl font-bold font-serif text-neutral-950 flex items-center gap-2">
                <span>{activeTab === 'special' ? (localizeCopy('特价区', 'Offerte Speciali')) : (localizeCopy('新款区', 'Nuovi Arrivi'))}</span>
              </h2>
              <p className="text-xs text-neutral-500 mt-1 max-w-2xl">
                {activeTab === 'special'
                  ? (localizeCopy('限时特价成衣，库存售完即下架。', 'Modelli a prezzo speciale fino a esaurimento scorte.'))
                  : (localizeCopy('当季新款成衣，零售商可直接查看库存、起订量并下单。', 'Nuovi modelli per rivenditori wholesale, con disponibilità e MOQ visibili.'))}
              </p>
              {!canViewWholesaleProducts && merchantProducts.some(product => product.visibility === 'wholesale') && (
                <p className="mt-2 text-[10px] leading-4 text-neutral-500">{localizeCopy('部分商品仅对完成认证的批发买手开放。', 'Alcuni modelli sono riservati ai buyer wholesale verificati.')}</p>
              )}
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full lg:w-auto">
              <label className="relative flex items-center min-w-56 border-b border-neutral-400">
                <Search className="w-3.5 h-3.5 text-neutral-500" />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={localizeCopy('搜索款号、面料或款式', 'Cerca modello, tessuto...')}
                  className="w-full bg-transparent px-2 py-2 text-xs text-neutral-900 placeholder-neutral-400 outline-none"
                />
              </label>
              <div className="flex flex-wrap items-center gap-1.5 text-xs">
              {categoryOptions.map(cat => (
                <button
                  key={cat.key}
                  type="button"
                  onClick={() => setCategoryFilter(cat.key)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors cursor-pointer ${
                    categoryFilter === cat.key
                      ? 'bg-black text-white font-bold'
                      : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
              </div>
            </div>
          </div>

          {/* Product Grid */}
          {filteredProducts.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-2xl border border-neutral-200">
              <Layers className="w-10 h-10 text-neutral-300 mx-auto mb-3" />
              <p className="text-sm font-semibold text-neutral-700">
                {activeTab === 'special'
                  ? (localizeCopy('该分类暂时没有特价款', 'Nessuna offerta speciale in questa categoria'))
                  : (localizeCopy('该分类暂时没有新款', 'Nessun nuovo modello trovato per questa selezione'))}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-3 gap-y-8 sm:gap-x-5 sm:gap-y-10">
              {filteredProducts.map(product => {
                const price = calculateCustomerPrice(product.wholesalePrice);
                const totalStock = product.skus.reduce((sum, sku) => sum + getAvailableStock(sku), 0);
                const localizedName = getLocalizedProductName(product, lang);
                const isDemoProduct = product.id.startsWith('demo-showroom-product-');

                return (
                  <div
                    key={product.id}
                    className="storefront-product-card group overflow-hidden flex flex-col justify-between hover:-translate-y-1 transition-transform duration-300"
                  >
                    <div>
                      {/* Image Thumbnail */}
                      <div 
                        onClick={() => openStoreProduct(product)}
                        className="relative aspect-[3/4] bg-[#e7e2da] overflow-hidden cursor-pointer"
                      >
                        <ProductImage
                          src={product.images[0]}
                          alt={localizedName}
                          contain
                          className="h-full w-full"
                          imageClassName="group-hover:scale-105 transition-transform duration-700"
                        />
                        <div className="absolute top-2 left-2 flex flex-col gap-1">
                          <span className="px-2 py-1 rounded-none bg-white/90 text-black text-[9px] font-bold tracking-[0.12em]">
                            {product.styleNo}
                          </span>
                          {isDemoProduct && (
                            <span className="w-fit bg-neutral-950/90 px-2 py-1 text-[9px] font-bold tracking-[0.12em] text-white">
                              {localizeCopy('样品展示', 'ARTICOLO IN ESPOSIZIONE')}
                            </span>
                          )}
                        </div>
                        <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded bg-neutral-900/80 text-white text-[10px] font-medium">
                          {isDemoProduct
                            ? (localizeCopy("规格库存 {{RUDA_ARG_0}} 件", "{{RUDA_ARG_0}} pz nelle varianti", [String(totalStock)]))
                            : (localizeCopy("现货: {{RUDA_ARG_0}} 件", "{{RUDA_ARG_0}} pz disp.", [String(totalStock)]))}
                        </div>
                      </div>

                      {/* Content */}
                      <div className="storefront-product-info pt-3 space-y-2">
                        <h3 
                          onClick={() => openStoreProduct(product)}
                          className="storefront-product-title font-semibold text-xs sm:text-sm text-neutral-900 hover:underline line-clamp-1 cursor-pointer"
                        >
                          {localizedName}
                        </h3>

                        <div className="pt-2 flex items-baseline justify-between border-t border-neutral-300">
                          <div>
                            <span className="storefront-product-price text-base font-bold text-neutral-900 font-serif">
                              €{price.toFixed(2)}
                            </span>
                            <span className="text-[10px] text-neutral-400 ml-1">{localizeCopy('/件', '/pz')}</span>
                          </div>
                          <span className="text-xs text-neutral-500">
                            {localizeCopy("{{RUDA_ARG_0}}件/包", "Pacco da {{RUDA_ARG_0}}", [String(product.packSize)])}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Bottom Actions */}
                    <div className="pt-1 flex gap-1.5">
                      <button
                        type="button"
                        onClick={() => openStoreProduct(product)}
                        className="storefront-product-secondary flex-1 py-2 px-2 border border-neutral-300 hover:bg-neutral-950 hover:text-white text-neutral-800 text-[10px] font-bold uppercase tracking-[0.08em] transition-colors cursor-pointer"
                      >
                        {localizeCopy('详情与配码', 'Dettagli')}
                      </button>
                      <button
                        type="button"
                        onClick={() => openStoreProduct(product)}
                        className="storefront-product-action py-2 px-3 bg-neutral-950 hover:bg-neutral-700 text-white text-xs font-semibold transition-colors flex items-center justify-center cursor-pointer"
                        title={localizeCopy('选择颜色尺码与数量', 'Scegli variante e quantità')}
                      >
                        <ShoppingBag className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* DISPLAY MODE 2: EXCLUSIVE VAULT */}
      {activeTab === 'custom' && (
        <div className="space-y-6">
          {/* Anti-Copy Protection Policy Banner */}
          <div className="rounded-2xl border border-neutral-300 bg-neutral-900 text-white p-6 sm:p-8 relative overflow-hidden shadow-lg">
            <div className="relative z-10 max-w-3xl space-y-3 text-left">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 text-white text-xs font-semibold backdrop-blur-md">
                <ShieldCheck className="w-4 h-4 text-white" />
                <span>{localizeCopy('授权订做款', 'Su Ordinazione Autorizzata')}</span>
              </div>

              <h2 className="text-xl sm:text-2xl font-bold font-serif tracking-tight">
                {merchantName} · {localizeCopy('授权订做区', 'Area Su Ordinazione')}
              </h2>

              <p className="text-xs sm:text-sm text-neutral-300 leading-relaxed">
                {localizeCopy('定制与限定款需获授权后查看，包含要求、起订量和报价。', 'Modelli esclusivi su autorizzazione; requisiti, minimo e prezzo.')}
              </p>
            </div>
          </div>

          {/* Conditional View: Approved vs Not Approved */}
          {isVaultApproved ? (
            /* STATE A: UNLOCKED & AUTHORIZED */
            <div className="space-y-6">
              <div className="bg-neutral-100 border border-neutral-300 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-neutral-900">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-black text-white flex items-center justify-center shrink-0">
                    <Unlock className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-neutral-900">
                      {isIt 
                        ? `Accesso abilitato per ${currentCustomer?.companyName || 'la tua attività'}` 
                        : `看货权限已解锁: ${currentCustomer?.companyName || '贵公司'}`}
                    </h3>
                    <p className="text-xs text-neutral-600">
                      {localizeCopy('生产商已通过您的看货核验，当前款式享受一手批发直供。', 'Visualizzazione autorizzata con listini dedicati e ordinazione immediata.')}
                    </p>
                  </div>
                </div>
              </div>

              {/* Protected Products Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
                {customProducts.map(product => {
                  const price = calculateCustomerPrice(product.wholesalePrice);
                  const totalStock = product.skus.reduce((sum, s) => sum + s.stockCentral, 0);
                  const localizedName = getLocalizedProductName(product, lang);

                  return (
                    <div 
                      key={product.id}
                      className="group bg-white rounded-2xl border border-neutral-300 overflow-hidden flex flex-col justify-between shadow-2xs hover:border-neutral-900 transition-all"
                    >
                      <div>
                        {/* Image Thumbnail with Security Watermark */}
                        <div 
                          onClick={() => openStoreProduct(product)}
                          className="relative aspect-3/4 bg-neutral-100 overflow-hidden cursor-pointer"
                        >
                          <ProductImage
                            src={product.images[0]}
                            alt={localizedName}
                            contain
                            className="h-full w-full"
                            imageClassName="group-hover:scale-105 transition-transform duration-700"
                          />

                          <div className="absolute top-2 left-2 flex flex-col gap-1">
                            <span className="px-2 py-0.5 rounded bg-black text-white text-[10px] font-bold flex items-center gap-1">
                              <Sparkles className="w-3 h-3 text-white" />
                              {localizeCopy('专属首发', 'Riservato')}
                            </span>
                          </div>

                          <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded bg-black/80 text-white text-[10px] font-mono">
                            {localizeCopy("配额: {{RUDA_ARG_0}} 件", "{{RUDA_ARG_0}} pz", [String(totalStock)])}
                          </div>
                        </div>

                        {/* Content */}
                        <div className="p-3.5 space-y-2">
                          <h3 
                            onClick={() => openStoreProduct(product)}
                            className="font-bold text-xs sm:text-sm text-neutral-900 hover:underline line-clamp-1 cursor-pointer"
                          >
                            {localizedName}
                          </h3>

                          <div className="pt-2 flex items-baseline justify-between border-t border-neutral-100">
                            <div>
                              <span className="text-base font-bold text-black font-serif">
                                €{price.toFixed(2)}
                              </span>
                              <span className="text-[10px] text-neutral-400 ml-1">{localizeCopy('/件', '/pz')}</span>
                            </div>
                            <span className="text-xs font-medium text-neutral-700">
                              {localizeCopy(
                                '起订量 {{RUDA_ARG_0}} 件 · 每手 {{RUDA_ARG_1}} 件',
                                'MOQ {{RUDA_ARG_0}} pz · Confezione {{RUDA_ARG_1}} pz',
                                [String(product.moq), String(product.packSize)]
                              )}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Bottom Actions */}
                      <div className="p-3.5 pt-0 flex gap-1.5">
                        <button
                          type="button"
                          onClick={() => openStoreProduct(product)}
                          className="flex-1 py-1.5 px-2 bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                        >
                          {localizeCopy('查阅全套细节与订货', 'Dettagli')}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            /* STATE B: LOCKED GATEWAY */
            <div className="space-y-8">
              <div className="bg-white border border-neutral-300 rounded-2xl p-6 sm:p-8 text-center space-y-4 shadow-sm max-w-3xl mx-auto">
                <div className="w-16 h-16 rounded-full bg-neutral-100 text-neutral-800 mx-auto flex items-center justify-center">
                  <Lock className="w-8 h-8 text-black" />
                </div>

                <div className="space-y-1">
                  <h3 className="text-xl font-bold font-serif text-neutral-900">
                    {vaultStatus === 'pending'
                      ? (localizeCopy('专属商品申请正在生产商核验中', 'Richiesta di accesso in fase di verifica'))
                      : (localizeCopy('该生产商专属商品需授权后查看', 'Accesso riservato per i clienti accreditati'))}
                  </h3>
                  <p className="text-xs sm:text-sm text-neutral-600 max-w-lg mx-auto leading-relaxed">
                    {vaultStatus === 'pending'
                      ? localizeCopy(
                        '提交给 {{RUDA_ARG_0}} 的看货申请正在核验中。',
                        'La richiesta inviata a {{RUDA_ARG_0}} è in fase di verifica.',
                        [String(merchantName)]
                      )
                      : (localizeCopy("生产商共有 {{RUDA_ARG_0}} 款授权订做款，审核通过后开放查看与订购。", "L'atelier dispone di {{RUDA_ARG_0}} modelli su ordinazione per buyer autorizzati.", [String(customProducts.length)]))}
                  </p>
                </div>

                <div className="pt-2">
                  {vaultStatus === 'pending' ? (
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-neutral-100 text-neutral-800 font-semibold text-xs border border-neutral-300">
                      <Clock className="w-4 h-4 text-black animate-spin" />
                      <span>{localizeCopy('正在等待生产商审核', 'In attesa di approvazione')}</span>
                    </div>
                  ) : (
                    <button
                      type="button"
                      id="btn-apply-vault-access"
                      onClick={() => setShowRequestModal(true)}
                      className="px-6 py-2.5 rounded-xl bg-black hover:bg-neutral-800 text-white font-bold text-xs sm:text-sm transition-all shadow-md flex items-center gap-2 mx-auto cursor-pointer"
                    >
                      <Lock className="w-4 h-4" />
                      <span>{localizeCopy('向生产商提交看货申请', 'Invia Richiesta di Accreditamento')}</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {(activeMerchant.storefrontShippingPolicy || activeMerchant.storefrontReturnsPolicy || activeMerchant.storefrontReturnAddress) && (
        <section className="mt-10 grid gap-4 border-t border-neutral-200 pt-8 md:grid-cols-2">
          {activeMerchant.storefrontShippingPolicy && (
            <article id="store-shipping" className="rounded-xl border border-neutral-200 bg-white p-5">
              <h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-950">
                {localizeCopy('配送与运费', 'SPEDIZIONE')}
              </h2>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-neutral-600">{activeMerchant.storefrontShippingPolicy}</p>
            </article>
          )}
          {activeMerchant.storefrontReturnsPolicy && (
            <article id="store-returns" className="rounded-xl border border-neutral-200 bg-white p-5">
              <h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-950">
                {localizeCopy('退换货与售后', 'RESI E ASSISTENZA')}
              </h2>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-neutral-600">{activeMerchant.storefrontReturnsPolicy}</p>
            </article>
          )}
          {activeMerchant.storefrontReturnAddress && (
            <article id="store-return-address" className="rounded-xl border border-neutral-200 bg-white p-5">
              <h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-950">
                {localizeCopy('退货地址与费用', 'INDIRIZZO E COSTI DI RESO')}
              </h2>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-neutral-600">{activeMerchant.storefrontReturnAddress}</p>
              <p className="mt-3 text-xs leading-5 text-neutral-500">
                {localizeCopy('普通撤回退货运费由消费者承担；商品瑕疵或法律另有规定的情形除外。', 'Le spese di restituzione per il recesso ordinario sono a carico del consumatore, salvo difetti del prodotto o obblighi di legge.')}
              </p>
            </article>
          )}
        </section>
      )}

      {!embeddedInMerchantApp && (
        <footer className="-mx-4 mt-12 border-t border-neutral-200 bg-white sm:mx-0">
          <div className="mx-auto flex max-w-[1440px] flex-col gap-6 px-5 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-12">
            <div className="flex min-w-0 items-center gap-4">
              {activeMerchant.logo && (
                <img src={merchantMediaUrl(activeMerchant.logo, '')} alt="" className="h-12 max-w-32 shrink-0 object-contain object-left" />
              )}
              <div className="min-w-0">
                <p className="font-serif text-lg font-medium text-neutral-950">{merchantName}</p>
                {(activeMerchant.companyLegalName || activeMerchant.vatNumber) && (
                  <p className="mt-1 text-[11px] text-neutral-500">
                    {[activeMerchant.companyLegalName, activeMerchant.vatNumber && `${isIt ? 'P.IVA' : 'VAT'} ${activeMerchant.vatNumber}`].filter(Boolean).join(' · ')}
                  </p>
                )}
                {(lang === 'zh' ? activeMerchant.tagline_zh : activeMerchant.tagline_it) && (
                  <p className="mt-1 text-xs text-neutral-500">{lang === 'zh' ? activeMerchant.tagline_zh : activeMerchant.tagline_it}</p>
                )}
                {((lang === 'zh' ? activeMerchant.description_zh : activeMerchant.description_it) || activeMerchant.description) && (
                  <p className="mt-2 max-w-xl whitespace-pre-line text-xs leading-5 text-neutral-600">
                    {(lang === 'zh' ? activeMerchant.description_zh : activeMerchant.description_it) || activeMerchant.description}
                  </p>
                )}
              </div>
            </div>
            {(activeMerchant.showroomAddress || activeMerchant.city || activeMerchant.country || activeMerchant.contactPerson || activeMerchant.contactPhone || activeMerchant.contactEmail || activeMerchant.whatsapp || activeMerchant.wechat) && (
              <address className="flex shrink-0 flex-col gap-2 text-xs not-italic text-neutral-600 sm:items-end">
                {(activeMerchant.showroomAddress || activeMerchant.city || activeMerchant.country) && (
                  <span>{[activeMerchant.showroomAddress, activeMerchant.city, activeMerchant.country].filter(Boolean).join(', ')}</span>
                )}
                {activeMerchant.contactPerson && <span>{activeMerchant.contactPerson}</span>}
                {activeMerchant.contactPhone && <a href={`tel:${activeMerchant.contactPhone.replace(/[^\d+]/g, '')}`} className="hover:text-neutral-950">{activeMerchant.contactPhone}</a>}
                {activeMerchant.contactEmail && <a href={`mailto:${activeMerchant.contactEmail}`} className="break-all hover:text-neutral-950">{activeMerchant.contactEmail}</a>}
                {activeMerchant.whatsapp && <a href={`https://wa.me/${activeMerchant.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" className="hover:text-neutral-950">{activeMerchant.whatsapp}</a>}
                {activeMerchant.wechat && <span>{activeMerchant.wechat}</span>}
              </address>
            )}
          </div>
        </footer>
      )}

      {selectedStoreProduct && (() => {
        const sku = selectedStoreProduct.skus.find(item => item.sku === selectedStoreSku);
        const stock = sku ? getAvailableStock(sku) : 0;
        const minQuantity = Math.max(1, selectedStoreProduct.moq || 1);
        const step = Math.max(1, selectedStoreProduct.packSize || 1);
        const price = calculateCustomerPrice(selectedStoreProduct.wholesalePrice);
        const productName = getLocalizedProductName(selectedStoreProduct, lang);
        const isDemoProduct = selectedStoreProduct.id.startsWith('demo-showroom-product-');
        const singleItemCheckout = Boolean(!embeddedInMerchantApp && singleItemLink && new URL(singleItemLink, window.location.origin).searchParams.has('singleItemToken'));
        const canPurchase = Boolean(sku && stock >= minQuantity && storeProductQuantity >= minQuantity && storeProductQuantity <= stock);
        return (
          <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-4" onClick={() => setSelectedStoreProduct(null)}>
            <section role="dialog" aria-modal="true" aria-label={productName} className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl" onClick={event => event.stopPropagation()}>
              <div className="sticky top-0 z-10 flex items-center justify-between border-b border-neutral-200 bg-white/95 px-4 py-3 backdrop-blur sm:px-6">
                <div>
                  <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-neutral-500">{localizeCopy('商品详情与下单', 'DETTAGLI PRODOTTO')}</p>
                  <p className="mt-1 text-xs font-bold text-neutral-900">{selectedStoreProduct.styleNo}</p>
                </div>
                <button type="button" onClick={() => setSelectedStoreProduct(null)} aria-label={localizeCopy('关闭', 'Chiudi')} className="rounded-full p-2 text-neutral-500 hover:bg-neutral-100 hover:text-black"><X className="h-5 w-5" /></button>
              </div>
              <div className="grid gap-5 p-4 sm:grid-cols-[0.9fr_1.1fr] sm:gap-7 sm:p-6">
                <div className="aspect-[4/5] overflow-hidden bg-neutral-100">
                  <ProductImage src={selectedStoreProduct.images[0]} alt={productName} contain className="h-full w-full" />
                </div>
                <div className="flex flex-col gap-4">
                  <div>
                    <h2 className="font-serif text-xl font-semibold text-neutral-950 sm:text-2xl">{productName}</h2>
                    <p className="mt-2 text-sm font-semibold text-neutral-950">€{price.toFixed(2)} <span className="text-xs font-normal text-neutral-500">{localizeCopy('/件', '/pezzo')}</span></p>
                    <p className="mt-2 text-xs leading-5 text-neutral-600">{selectedStoreProduct.description_zh || selectedStoreProduct.description || selectedStoreProduct.fabric}</p>
                  </div>
                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-xs font-semibold text-neutral-800">{localizeCopy('颜色 / 尺码', 'Colore / Taglia')}</span>
                      <span className="text-[10px] text-neutral-500">{localizeCopy("起订 {{RUDA_ARG_0}} 件", "Min. {{RUDA_ARG_0}} pz", [String(minQuantity)])}</span>
                    </div>
                    {selectedStoreProduct.skus.length > 0 ? (
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                        {selectedStoreProduct.skus.map(option => (
                          <button key={option.sku} type="button" disabled={getAvailableStock(option) <= 0} onClick={() => { setSelectedStoreSku(option.sku); setStoreProductQuantity(Math.max(minQuantity, step)); setSingleItemLink(''); setSingleItemCheckoutToken(null); }} className={`rounded-lg border px-3 py-2 text-left text-[11px] transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${selectedStoreSku === option.sku ? 'border-black bg-neutral-950 text-white' : 'border-neutral-200 text-neutral-700 hover:border-neutral-500'}`}>
                            <span className="block font-semibold">{option.color} · {option.size}</span>
                            <span className={`mt-1 block text-[9px] ${selectedStoreSku === option.sku ? 'text-white/70' : 'text-neutral-500'}`}>{localizeCopy("库存 {{RUDA_ARG_0}} 件", "Disponibili {{RUDA_ARG_0}}", [String(getAvailableStock(option))])}</span>
                          </button>
                        ))}
                      </div>
                    ) : <p className="rounded-lg bg-neutral-50 p-3 text-xs text-neutral-500">{localizeCopy('暂无可选规格', 'Varianti non disponibili')}</p>}
                  </div>
                  <div className="flex items-center justify-between rounded-lg border border-neutral-200 px-3 py-2.5">
                    <div>
                      <p className="text-xs font-semibold text-neutral-800">{localizeCopy('购买数量', 'Quantità')}</p>
                      <p className="mt-0.5 text-[10px] text-neutral-500">{localizeCopy("可购库存 {{RUDA_ARG_0}} 件 · 按 {{RUDA_ARG_1}} 件递增", "Disponibili {{RUDA_ARG_0}} pz · multipli di {{RUDA_ARG_1}}", [String(stock), String(step)])}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <button type="button" aria-label={localizeCopy('减少数量', 'Diminuisci')} disabled={storeProductQuantity - step < minQuantity} onClick={() => setStoreProductQuantity(quantity => quantity - step)} className="rounded-full border border-neutral-200 p-1.5 disabled:opacity-40"><Minus className="h-3.5 w-3.5" /></button>
                      <span className="min-w-8 text-center text-sm font-bold">{storeProductQuantity}</span>
                      <button type="button" aria-label={localizeCopy('增加数量', 'Aumenta')} disabled={storeProductQuantity + step > stock} onClick={() => setStoreProductQuantity(quantity => quantity + step)} className="rounded-full border border-neutral-200 p-1.5 disabled:opacity-40"><Plus className="h-3.5 w-3.5" /></button>
                    </div>
                  </div>
                  <div className="mt-auto space-y-2">
                    {!embeddedInMerchantApp && selectedStoreProduct.visibility === 'public' && !isDemoProduct && (
                      <div className="space-y-2">
                        <div className="flex flex-wrap gap-2">
                          <ShareButton
                            title={`${productName} · ${merchantName}`}
                            text={`查看 ${productName}（款号 ${selectedStoreProduct.styleNo}）`}
                            path={`${getMerchantStoreUrl(activeMerchant)}?product=${encodeURIComponent(selectedStoreProduct.id)}&sku=${encodeURIComponent(selectedStoreSku)}`}
                            source={`product-${selectedStoreProduct.id}`}
                          />
                          <button type="button" disabled={!sku || stock < 1 || creatingSingleItemLink || paymentEnabled !== true} onClick={() => void createSingleItemPaymentLink()} className="border border-neutral-300 px-3 py-2 text-xs font-semibold text-neutral-800 hover:border-black disabled:cursor-not-allowed disabled:opacity-50">
                            {creatingSingleItemLink ? '正在生成…' : paymentEnabled === null ? '正在检查支付状态…' : paymentEnabled ? '生成单件付款链接' : '在线付款未配置'}
                          </button>
                        </div>
                        {singleItemLink && (
                          <div className="space-y-2 border border-neutral-200 bg-neutral-50 p-3">
                            <p className="break-all text-[10px] leading-4 text-neutral-600">此链接可购买当前规格 1 件，已绑定商品和规格。</p>
                            <div className="flex flex-wrap items-center gap-2">
                              <ShareButton title={`${productName} · 单件付款`} text={`购买 ${productName} 1 件`} path={singleItemLink} source={`single-item-${selectedStoreProduct.id}`} />
                              <button type="button" disabled={!singleItemCheckout || paymentEnabled !== true} onClick={buySingleItem} className="bg-black px-3 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">
                                立即购买 1 件
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                    <button type="button" disabled={!canPurchase} onClick={addStoreProductToCart} className="w-full bg-neutral-950 px-4 py-3 text-xs font-bold tracking-[0.1em] text-white transition-colors hover:bg-neutral-700 disabled:cursor-not-allowed disabled:bg-neutral-300">
                      {canPurchase
                        ? localizeCopy('加入购物车 · €{{RUDA_ARG_0}}', 'Aggiungi al carrello · €{{RUDA_ARG_0}}', [(price * storeProductQuantity).toFixed(2)])
                        : stock === 0
                            ? localizeCopy('暂时无库存', 'Non disponibile')
                            : localizeCopy('库存不足，起订 {{RUDA_ARG_0}} 件', 'Scorte insufficienti, minimo {{RUDA_ARG_0}} pz', [String(minQuantity)])}
                    </button>
                    {embeddedInMerchantApp && <p className="text-center text-[10px] leading-4 text-neutral-500">{localizeCopy('已加入购物车后，可从购物车按钮打开公开网店完成结算。', 'L’acquisto completo è disponibile nel negozio pubblico.')}</p>}
                  </div>
                </div>
              </div>
            </section>
          </div>
        );
      })()}

      {/* REQUEST VAULT ACCESS MODAL */}
      {showRequestModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 sm:p-7 space-y-5 border border-neutral-200 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-black text-white flex items-center justify-center">
                  <ShieldCheck className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-lg font-serif text-neutral-900">
                    {localizeCopy("申请【{{RUDA_ARG_0}}】看货权限", "Richiesta di abilitazione per {{RUDA_ARG_0}}", [String(merchantName)])}
                  </h3>
                  <p className="text-xs text-neutral-500">
                    {localizeCopy('提交申请以获取该生产商的专属商品授权', 'Invia la richiesta per consultare i modelli della Collezione Riservata')}
                  </p>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => setShowRequestModal(false)}
                className="text-neutral-400 hover:text-black text-lg p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleApplyAccess} className="space-y-4 text-xs">
              <div className="bg-neutral-50 p-3 rounded-xl border border-neutral-200 space-y-1">
                <p className="text-neutral-500">{localizeCopy('申请零售商企业:', 'Azienda Richiedente:')}</p>
                <p className="font-bold text-neutral-900 text-sm">
                  {currentCustomer?.companyName || localizeCopy('已核准买家账户', 'Boutique registrata')}
                </p>
              </div>

              <div className="space-y-1">
                <label className="block font-semibold text-neutral-700">
                  {localizeCopy('采购意向与看货申请说明:', 'Note e indicazioni commerciali per l\'atelier:')}
                </label>
                <textarea
                  value={requestNote}
                  onChange={(e) => setRequestNote(e.target.value)}
                  rows={3}
                  className="w-full border border-neutral-300 rounded-xl p-3 text-xs focus:outline-none focus:ring-1 focus:ring-black"
                  placeholder={localizeCopy('说明您的门店定位、主营风格及预计采购数量...', 'Indica i marchi trattati e il volume acquisti...')}
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowRequestModal(false)}
                  className="flex-1 py-2 px-3 border border-neutral-300 rounded-xl text-neutral-700 font-semibold hover:bg-neutral-100 cursor-pointer"
                >
                  {localizeCopy('取消', 'Annulla')}
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 px-3 bg-black text-white rounded-xl font-bold hover:bg-neutral-800 flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{localizeCopy('正式提交生产商审核', 'Invia Richiesta')}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Independent merchant AI concierge */}
      {!embeddedInMerchantApp && storefrontAiEnabled && <div className="fixed bottom-5 right-4 sm:right-8 z-40 flex flex-col items-end gap-3">
        {showAiSupport && (
          <div className="w-[min(360px,calc(100vw-2rem))] overflow-hidden border border-neutral-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between bg-neutral-950 px-4 py-3 text-white">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-black"><Bot className="h-4 w-4" /></div>
                <div>
                  <p className="text-xs font-bold">{merchantName} AI Concierge</p>
                  <p className="text-[10px] text-neutral-400">{localizeCopy('本店专属智能客服', 'Assistente personale dell’atelier')}</p>
                </div>
              </div>
              <button type="button" onClick={() => setShowAiSupport(false)} aria-label="关闭 AI 客服" className="text-neutral-400 hover:text-white cursor-pointer"><X className="h-4 w-4" /></button>
            </div>
            <div className="max-h-72 space-y-2 overflow-y-auto bg-[#f3f0ea] p-3">
              {aiMessages.length === 0 && (
                <div className="bg-white p-3 text-xs leading-relaxed text-neutral-700 shadow-sm">
                  {localizeCopy("您好，我是{{RUDA_ARG_0}}专属 AI 客服，可以帮您查询本店款式、库存、起订量和授权规则。", "Ciao, sono l’assistente di {{RUDA_ARG_0}}. Posso aiutarti con modelli, stock, MOQ e accesso alla collezione riservata.", [String(merchantName)])}
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {(aiQuickQuestions.length > 0 ? aiQuickQuestions : [
                      localizeCopy('本店有哪些现货？', 'Quali modelli sono disponibili?'),
                      localizeCopy('怎么申请授权款？', 'Come richiedere l’accesso?'),
                      localizeCopy('起订量是多少？', 'Qual è il MOQ?')
                    ]).map(question => (
                      <button key={question} type="button" onClick={() => void askMerchantAi(question)} className="rounded-full border border-neutral-300 bg-white px-2.5 py-1 text-[10px] text-neutral-600 hover:border-black hover:text-black cursor-pointer">{question}</button>
                    ))}
                  </div>
                </div>
              )}
              {aiMessages.map((message, index) => (
                <div key={`${message.role}-${index}`} className={`max-w-[88%] px-3 py-2 text-xs leading-relaxed ${message.role === 'user' ? 'ml-auto bg-neutral-950 text-white' : 'bg-white text-neutral-700 shadow-sm'}`}>
                  {message.text}
                </div>
              ))}
              {aiLoading && <div className="w-fit bg-white px-3 py-2 text-xs text-neutral-400 shadow-sm">正在查询本店资料…</div>}
            </div>
            <form onSubmit={event => { event.preventDefault(); void askMerchantAi(); }} className="flex items-center gap-2 border-t border-neutral-200 bg-white p-3">
              <input value={aiInput} onChange={event => setAiInput(event.target.value)} placeholder={localizeCopy('询问本店款式、库存或采购', 'Chiedi al nostro atelier...')} className="min-w-0 flex-1 bg-neutral-100 px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-black" />
              <button type="submit" disabled={aiLoading || !aiInput.trim()} aria-label="发送问题" className="bg-neutral-950 p-2 text-white disabled:opacity-40 cursor-pointer"><Send className="h-3.5 w-3.5" /></button>
            </form>
          </div>
        )}
        <button type="button" onClick={() => setShowAiSupport(value => !value)} aria-label="打开生产商 AI 客服" title={`${merchantName} AI 客服`} className="flex h-12 w-12 items-center justify-center rounded-full bg-neutral-950 text-white shadow-xl hover:bg-neutral-700 cursor-pointer">
          <Bot className="h-5 w-5" />
        </button>
      </div>}
    </div>
    </div>
  );
};
