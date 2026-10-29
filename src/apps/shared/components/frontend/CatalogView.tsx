import React, { useState, useMemo } from 'react';
import { 
  Search, 
  ChevronRight, 
  X,
  Building2,
  Store,
  Lock,
  Eye,
  MapPin,
  Star
} from 'lucide-react';
import { useB2B } from '../../../../context/B2BContext';
import { Product } from '../../../../types/b2b';
import { getProductCategoryLabel } from '../../../../constants/productCategories';
import { getLocalizedMerchantName, getLocalizedMerchantTagline, getLocalizedProductName } from '../../../../i18n/translations';
import { ProductImage } from '../common/ProductImage';

export const CatalogView: React.FC = () => {
  const { 
    products, 
    merchants,
    catalogSearchQuery, 
    setCatalogSearchQuery,
    quickNavigateToProduct,
    calculateCustomerPrice,
    setCurrentView,
    quickSearchStyle,
    addNotification,
    setSelectedMerchantId,
    lang, localizeCopy
  } = useB2B();

  const isIt = lang === 'it';

  // The catalog route is the single cross-merchant clearance showroom.
  const [activeCatalogMode, setActiveCatalogMode] = useState<'marketplace' | 'suppliers'>('marketplace');

  // Filters
  const [selectedSaleCategory, setSelectedSaleCategory] = useState<string>('all');
  const [selectedStockStatus, setSelectedStockStatus] = useState<string>('all');
  const [selectedBrand, setSelectedBrand] = useState<string>('all');
  const [selectedPrivacyFilter, setSelectedPrivacyFilter] = useState<'all' | 'public_only' | 'private_only'>('all');
  const [sortBy, setSortBy] = useState<'new' | 'hot' | 'price_asc' | 'price_desc'>('hot');

  const saleProducts = useMemo(() => (products || []).filter(product =>
    product.merchantId &&
    product.status === 'clearance' &&
    product.lifecycleStatus !== 'archived' &&
    product.lifecycleStatus !== 'draft' &&
    product.lifecycleStatus !== 'pending_review' &&
    product.lifecycleStatus !== 'rejected' &&
    product.visibility !== 'private' &&
    !product.isExclusiveProtected
  ), [products]);

  const saleCategories = ['women', 'men', 'children', 'bags'] as const;
  const getSaleCategoryKey = (category: string) => {
    const normalized = category.trim().toLocaleLowerCase();
    if (['women', 'woman', 'womenswear', '女装'].includes(normalized)) return 'women';
    if (['men', 'man', 'menswear', '男装'].includes(normalized)) return 'men';
    if (['children', 'childrenswear', 'kids', 'kidswear', '童装'].includes(normalized)) return 'children';
    if (['bags', 'bag', 'handbags', '箱包'].includes(normalized)) return 'bags';
    return normalized;
  };
  const availableSaleCategories = [...new Set([
    ...saleCategories,
    ...saleProducts.map(product => getSaleCategoryKey(product.category))
  ])];

  // Filtered & Sorted clearance products
  const filteredProducts = useMemo(() => {
    return saleProducts.filter(p => {
      if (selectedSaleCategory !== 'all' && getSaleCategoryKey(p.category) !== selectedSaleCategory) return false;
      if (catalogSearchQuery.trim()) {
        const query = catalogSearchQuery.toLowerCase().trim();
        const matchesStyle = p.styleNo.toLowerCase().includes(query);
        const matchesName = p.name.toLowerCase().includes(query);
        const matchesBrand = p.brand.toLowerCase().includes(query);
        const matchesSub = p.subCategory.toLowerCase().includes(query);
        const matchesSku = p.skus.some(s => s.sku.toLowerCase().includes(query) || s.color.toLowerCase().includes(query));
        if (!matchesStyle && !matchesName && !matchesBrand && !matchesSub && !matchesSku) {
          return false;
        }
      }
      if (selectedStockStatus !== 'all') {
        if (p.inventoryStatus !== selectedStockStatus) return false;
      }

      return true;
    }).sort((a, b) => {
      if (sortBy === 'new') return Date.parse(b.updatedAt || b.createdAt || '') - Date.parse(a.updatedAt || a.createdAt || '');
      if (sortBy === 'hot') {
        return Number(Boolean(b.featuredOnSale ?? b.featuredOnHome)) - Number(Boolean(a.featuredOnSale ?? a.featuredOnHome));
      }
      if (sortBy === 'price_asc') return a.wholesalePrice - b.wholesalePrice;
      if (sortBy === 'price_desc') return b.wholesalePrice - a.wholesalePrice;
      return 0;
    });
  }, [
    saleProducts,
    selectedSaleCategory,
    catalogSearchQuery, 
    selectedStockStatus, 
    sortBy
  ]);
  const renderProductCard = (prod: Product, index: number, large = false) => {
    const customerPrice = calculateCustomerPrice(prod.wholesalePrice);
    const localizedName = getLocalizedProductName(prod, lang);
    const sourceMerchant = merchants.find(merchant => merchant.id === prod.merchantId);
    const sourceMerchantName = sourceMerchant
      ? getLocalizedMerchantName(sourceMerchant, lang)
      : prod.merchantName || prod.brand || localizeCopy('RUDA 入驻商家', 'Partner RUDA');
    const colorOptions = [...new Map(prod.skus.map(sku => [sku.color, sku])).values()].slice(0, 5);
    return (
      <article
        key={prod.id}
        className={`group min-w-0 ${large ? 'col-span-2' : 'col-span-1'}`}
      >
        <button
          type="button"
          onClick={() => quickNavigateToProduct(prod.id)}
          className={`relative block w-full cursor-pointer overflow-hidden bg-transparent text-left ${large ? 'aspect-[4/5] lg:aspect-[4/3]' : 'aspect-[4/5]'}`}
          aria-label={localizedName}
        >
          <ProductImage
            src={prod.images[0]}
            alt={localizedName}
            flush
            className="h-full w-full"
            imageClassName="transition-transform duration-700 group-hover:scale-105"
          />
        </button>
        <div className="pt-2">
          <div className="flex items-baseline justify-between gap-2">
            <button
              type="button"
              onClick={() => quickNavigateToProduct(prod.id)}
              className="min-w-0 truncate text-left text-[11px] font-medium leading-4 text-neutral-900 hover:underline sm:text-xs"
              title={localizedName}
            >
              {localizedName}
            </button>
            <span className="shrink-0 text-xs font-semibold text-neutral-950">€{customerPrice.toFixed(2)}</span>
          </div>
          <div className="mt-1 flex min-w-0 items-center justify-between gap-2">
            {sourceMerchant ? (
              <button
                type="button"
                onClick={() => {
                  setSelectedMerchantId(sourceMerchant.id);
                  setCurrentView('merchant_store');
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="truncate text-[9px] text-neutral-500 hover:text-neutral-950"
                aria-label={localizeCopy("进入商家店铺：{{RUDA_ARG_0}}", "Apri lo showroom {{RUDA_ARG_0}}", [String(sourceMerchantName)])}
              >
                {sourceMerchantName}
              </button>
            ) : <span className="truncate text-[9px] text-neutral-500">{sourceMerchantName}</span>}
            <span className="flex shrink-0 items-center gap-1" aria-label={colorOptions.map(sku => sku.color).join(', ')}>
              {colorOptions.map(option => (
                <span
                  key={option.color}
                  className="h-2.5 w-2.5 rounded-full border border-black/10"
                  style={{ backgroundColor: option.colorCode }}
                  title={option.color}
                />
              ))}
            </span>
          </div>
        </div>
      </article>
    );
  };

  return (
    <div className="mx-auto w-full max-w-7xl space-y-4 px-3 pb-8 pt-2 sm:space-y-5 sm:px-6 sm:pt-4 lg:px-8">
      <header className="flex justify-end border-b border-neutral-200 pb-4 pt-1">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3.5 top-3 h-4 w-4 text-neutral-400" />
          <input
            type="text"
            value={catalogSearchQuery}
            onChange={event => setCatalogSearchQuery(event.target.value)}
            placeholder={localizeCopy('搜索折扣商品', 'Cerca prodotti in promozione')}
            className="w-full rounded-full border border-neutral-200 bg-white py-2.5 pl-10 pr-9 text-xs transition-colors focus:border-neutral-500 focus:outline-none"
          />
          {catalogSearchQuery && (
            <button type="button" aria-label={localizeCopy('清除搜索', 'Cancella ricerca')} onClick={() => setCatalogSearchQuery('')} className="absolute right-3 top-3 text-neutral-400 hover:text-neutral-950">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </header>

      {/* Legacy supplier mode is retained below but cannot be selected from the clearance showroom. */}
      {activeCatalogMode === 'suppliers' && (
        <div className="space-y-6">
          <div className="bg-neutral-900 text-white rounded-2xl p-5 sm:p-6 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="p-1 bg-white/20 text-white rounded">
                  <Store className="w-4 h-4" />
                </span>
                <h2 className="text-base sm:text-lg font-bold">
                  {localizeCopy('长期合作直供工坊与品牌商户', 'Fornitori Diretti & Maestranze B2B')}
                </h2>
              </div>
              <p className="text-xs text-neutral-300 max-w-2xl leading-relaxed">
                {localizeCopy('浏览认证商家与批发系列。', 'Fornitori e collezioni B2B.')}
              </p>
            </div>
            <div className="text-xs bg-white/10 px-3 py-1.5 rounded-lg border border-white/20 text-neutral-200">
              {localizeCopy('数字版权防抄板水印保护已启用', 'Protezione Proprietà Intellettuale Attiva')}
            </div>
          </div>

          {/* Supplier Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {merchants.map((merchant) => {
              const merchantProds = products.filter(p => p.merchantId === merchant.id);
              const publicProds = merchantProds.filter(p => p.visibility !== 'private' && !p.isExclusiveProtected);
              const privateProds = merchantProds.filter(p => p.visibility === 'private' || p.isExclusiveProtected);

              const merchantName = getLocalizedMerchantName(merchant, lang);
              const merchantTagline = getLocalizedMerchantTagline(merchant, lang);
              const merchantCity = isIt ? merchant.city.replace(/[\u4e00-\u9fa5]/g, '').trim() : merchant.city;
              const merchantCountry = localizeCopy('意大利', 'Italia');

              return (
                <div 
                  key={merchant.id}
                  className="bg-white border border-neutral-200 rounded-2xl overflow-hidden shadow-xs hover:border-neutral-400 transition-all flex flex-col justify-between"
                >
                  {/* Supplier Header Banner */}
                  <div className="relative h-28 bg-neutral-100">
                    <img 
                      src={merchant.banner} 
                      alt={merchantName} 
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent flex items-end p-3.5">
                      <div className="flex items-center gap-2.5">
                        <img 
                          src={merchant.logo} 
                          alt={merchantName} 
                          className="w-10 h-10 rounded-lg object-cover border-2 border-white bg-white shrink-0"
                        />
                        <div className="text-white">
                          <h3 className="font-bold text-sm tracking-wide leading-tight">{merchantName}</h3>
                          <div className="flex items-center gap-1.5 text-[11px] text-neutral-300">
                            <MapPin className="w-3 h-3 text-neutral-400" />
                            <span>{merchantCity}, {merchantCountry}</span>
                            <span className="text-amber-400 flex items-center gap-0.5 ml-1">
                              <Star className="w-3 h-3 fill-amber-400" />
                              {merchant.rating}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Supplier 3-Channel Navigation Hierarchy */}
                  <div className="p-4 space-y-3 flex-1 flex flex-col justify-between">
                    <div className="text-xs text-neutral-500 line-clamp-2">
                      {merchantTagline}
                    </div>

                    {/* 3 Blocks: 店铺 / 展厅 / Private Collection */}
                    <div className="space-y-2 pt-2 border-t border-neutral-100 text-xs">
                      {/* 1. 店铺 (Store) */}
                      <button
                        type="button"
                        onClick={() => {
                          quickSearchStyle(merchant.name);
                          setActiveCatalogMode('marketplace');
                        }}
                        className="w-full p-2.5 bg-neutral-50 hover:bg-neutral-100 rounded-xl flex items-center justify-between border border-neutral-200 transition-colors cursor-pointer text-left"
                      >
                        <div className="flex items-center gap-2">
                          <Eye className="w-4 h-4 text-neutral-600" />
                          <div>
                            <div className="font-bold text-neutral-900">{localizeCopy('公开在售现货', 'Campionario Aperto')}</div>
                            <div className="text-[11px] text-neutral-400">
                              {localizeCopy("公开在售款 ({{RUDA_ARG_0}} 款)", "{{RUDA_ARG_0}} capi disponibili", [String(publicProds.length)])}
                            </div>
                          </div>
                        </div>
                        <span className="text-[11px] text-neutral-700 font-semibold flex items-center">
                          {localizeCopy('浏览货源', 'Visualizza')} <ChevronRight className="w-3.5 h-3.5" />
                        </span>
                      </button>

                      {/* 2. 展厅 (Showroom) */}
                      <button
                        type="button"
                        onClick={() => setCurrentView('showrooms')}
                        className="w-full p-2.5 bg-neutral-50 hover:bg-neutral-100 rounded-xl flex items-center justify-between border border-neutral-200 transition-colors cursor-pointer text-left"
                      >
                        <div className="flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-neutral-600" />
                          <div>
                            <div className="font-bold text-neutral-900">{localizeCopy('线下实体展厅', 'Showroom Ufficiale')}</div>
                            <div className="text-[11px] text-neutral-400">
                              {localizeCopy('现场提货与实体看样', 'Visite e campionatura dal vivo')}
                            </div>
                          </div>
                        </div>
                        <span className="text-[11px] text-neutral-700 font-semibold flex items-center">
                          {localizeCopy('预约到店', 'Prenota')} <ChevronRight className="w-3.5 h-3.5" />
                        </span>
                      </button>

                      {/* 3. Private Collection */}
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedPrivacyFilter('private_only');
                          setSelectedBrand(merchant.name);
                          setActiveCatalogMode('marketplace');
                        }}
                        className="w-full p-2.5 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl flex items-center justify-between transition-colors cursor-pointer text-left"
                      >
                        <div className="flex items-center gap-2">
                          <Lock className="w-4 h-4 text-amber-300" />
                          <div>
                            <div className="font-bold text-white flex items-center gap-1">
                              <span>{localizeCopy('授权专属系列', 'Collezione Riservata')}</span>
                              <span className="px-1.5 py-0.2 bg-white text-neutral-950 text-[9px] font-bold rounded">
                                {localizeCopy('专属', 'B2B')}
                              </span>
                            </div>
                            <div className="text-[10px] text-neutral-400">
                              {localizeCopy("授权买家专属新款 ({{RUDA_ARG_0}} 款)", "{{RUDA_ARG_0}} capi per rivenditori accreditati", [String(privateProds.length)])}
                            </div>
                          </div>
                        </div>
                        <span className="text-[11px] text-white font-semibold flex items-center">
                          {localizeCopy('进入专区', 'Accedi')} <ChevronRight className="w-3.5 h-3.5" />
                        </span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 3. MARKETPLACE MODE */}
      {activeCatalogMode === 'marketplace' && (
        <div className="space-y-5">
          <div className="sticky top-[104px] z-30 -mx-4 border-b border-neutral-300 bg-white/95 px-4 pt-2 backdrop-blur-md sm:top-[160px] sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
            <div className="flex gap-6 overflow-x-auto text-sm">
              {['all', ...availableSaleCategories].map(category => {
                const categoryLabels: Record<string, string> = isIt
                  ? { all: 'Tutte le categorie', women: 'Donna', men: 'Uomo', children: 'Bambini', bags: 'Borse' }
                  : { all: '全部分类', women: '女装', men: '男装', children: '童装', bags: '箱包' };
                const selected = selectedSaleCategory === category;
                return (
                  <button
                    key={category}
                    type="button"
                    onClick={() => {
                      setSelectedSaleCategory(category);
                    }}
                    className={`shrink-0 border-b-2 pb-2.5 font-semibold transition-colors ${selected ? 'border-neutral-950 text-neutral-950' : 'border-transparent text-neutral-500 hover:text-neutral-900'}`}
                  >
                    {categoryLabels[category] || getProductCategoryLabel(category, isIt)}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-3 border-b border-neutral-300 pb-4 pt-1 text-xs">
              <div className="flex items-center gap-2">
                <select
                  value={selectedStockStatus}
                  onChange={event => setSelectedStockStatus(event.target.value)}
                  aria-label={localizeCopy('库存筛选', 'Stato disponibilità')}
                  className="rounded-full border border-neutral-300 bg-white px-3 py-2 text-[11px]"
                >
                  <option value="all">{localizeCopy('全部库存状态', 'Tutta la disponibilità')}</option>
                  <option value="in_stock">{localizeCopy('有现货', 'Disponibile')}</option>
                  <option value="low_stock">{localizeCopy('库存紧张', 'Scorte limitate')}</option>
                  <option value="pre_order">{localizeCopy('可预订', 'Preordine')}</option>
                </select>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  aria-label={localizeCopy('商品排序', 'Ordina articoli')}
                  className="rounded-full border border-neutral-300 bg-white px-3 py-2 text-[11px]"
                >
                  <option value="hot">{localizeCopy('精选优先', 'In evidenza')}</option>
                  <option value="new">{localizeCopy('最新上架', 'Più recenti')}</option>
                  <option value="price_asc">{localizeCopy('价格由低到高', 'Prezzo crescente')}</option>
                  <option value="price_desc">{localizeCopy('价格由高到低', 'Prezzo decrescente')}</option>
                </select>
              </div>
          </div>

          {/* Product Cards Grid */}
          {filteredProducts.length === 0 ? (
            <div className="border-y border-neutral-200 py-16 text-center">
              <p className="font-serif text-2xl text-neutral-900">{localizeCopy('暂无折扣商品', 'Nessun articolo in promozione')}</p>
            </div>
          ) : (
          <section aria-label={localizeCopy('特价精选', 'Selezione in offerta')} className="space-y-8">
            {(() => {
              const patterns = [
                { large: 1, small: 6 },
                { large: 3, small: 8 },
                { large: 4, small: 8 }
              ];
              const sections: Array<Array<{ product: Product; index: number; large: boolean }>> = [];
              let productIndex = 0;
              let patternIndex = 0;

              while (productIndex < filteredProducts.length) {
                const pattern = patterns[patternIndex % patterns.length];
                const largeProducts: Array<{ product: Product; index: number }> = [];
                const smallProducts: Array<{ product: Product; index: number }> = [];
                for (let item = 0; item < pattern.large && productIndex < filteredProducts.length; item++, productIndex++) {
                  largeProducts.push({ product: filteredProducts[productIndex], index: productIndex });
                }
                for (let item = 0; item < pattern.small && productIndex < filteredProducts.length; item++, productIndex++) {
                  smallProducts.push({ product: filteredProducts[productIndex], index: productIndex });
                }
                sections.push([...largeProducts, ...smallProducts].map((item, index) => ({
                  ...item,
                  large: index < largeProducts.length
                })));
                patternIndex++;
              }

              return sections.map((section, sectionIndex) => {
                const largeProducts = section.filter(item => item.large);
                const smallProducts = section.filter(item => !item.large);
                return (
                  <div key={`sale-gallery-${sectionIndex}`} className="space-y-6 sm:space-y-8">
                    <div className="grid grid-cols-2 items-start gap-x-2 gap-y-6 sm:gap-x-4 lg:grid-cols-4 lg:gap-x-5">
                      {largeProducts.map(({ product, index }) => renderProductCard(product, index, true))}
                    </div>
                    {smallProducts.length > 0 && (
                      <div className="grid grid-cols-2 items-start gap-x-2 gap-y-6 sm:grid-cols-3 sm:gap-x-4 lg:grid-cols-4 lg:gap-x-5">
                        {smallProducts.map(({ product, index }) => renderProductCard(product, index))}
                      </div>
                    )}
                  </div>
                );
              });
            })()}
          </section>
          )}
        </div>
      )}

    </div>
  );
};
