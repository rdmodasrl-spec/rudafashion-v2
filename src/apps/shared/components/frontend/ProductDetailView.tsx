import React, { useState, useEffect, useRef } from 'react';
import { 
  ArrowLeft, 
  ChevronLeft,
  ChevronRight,
  X,
  ShieldCheck, 
  Sparkles, 
  Layers, 
  Plus,
  Minus,
  Lock,
  Clock,
  MessageCircle,
  ShoppingCart,
} from 'lucide-react';
import { useB2B } from '../../../../context/B2BContext';
import { getLocalizedProductName, getLocalizedColor } from '../../../../i18n/translations';
import { ShareButton } from '../common/ShareButton';
import { ProductImage } from '../common/ProductImage';
import { getProductPath } from '../../../../utils/share';
import { getProductCategoryLabel } from '../../../../constants/productCategories';
import { getProductWholesalePriceForQuantity } from '../../../../shared/productPricing';
import { getAvailableSkuStock } from '../../../../shared/productInventory';
import type { ProductSupportContext } from '../../../../shared/productSupportContext';
import { INITIAL_PRODUCTS } from '../../../../data/mockData';

export const ProductDetailView: React.FC = () => {
  const { 
    selectedProductId, 
    getProductById, 
    setCurrentView, 
    setSelectedProductId,
    setSelectedMerchantId,
    calculateCustomerPrice,
    addMultipleToCart,
    cart,
    products,
    isRegisteredWholesale,
    currentCustomer,
    hasVaultAccess,
    getVaultStatus,
    requestVaultAccess,
    addNotification,
    setShowBuyerRegister,
    lang,
    t, localizeCopy
  } = useB2B();

  const isIt = lang === 'it';
  const getLocalizedSizeLabel = (size: string) => (
    !size || ['onesize', 'one size', 'one-size', 'os', '均码'].includes(size.trim().toLowerCase())
      ? localizeCopy('均码', 'Taglia unica')
      : size
  );
  const product = selectedProductId
    ? getProductById(selectedProductId)
      || (import.meta.env.DEV ? INITIAL_PRODUCTS.find(item => item.id === selectedProductId) : undefined)
    : null;
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [showImageLightbox, setShowImageLightbox] = useState(false);
  const lightboxDragStart = useRef<{ x: number; y: number } | null>(null);
  const galleryDragStart = useRef<{ x: number; y: number } | null>(null);
  const galleryWasSwiped = useRef(false);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [requestNote, setRequestNote] = useState(
    localizeCopy('申请查看该商户首发新款大货报价与下达试单', 'Richiesta di consultazione campionario e preventivo lotti')
  );

  // Matrix quantities state: map sku string to ordered quantity
  const [matrixQuantities, setMatrixQuantities] = useState<Record<string, number>>({});
  const [colorSelectionByProduct, setColorSelectionByProduct] = useState<Record<string, string[]>>({});
  const matrixProductId = useRef<string | null>(null);

  useEffect(() => {
    if (!product) return;
    const isSameProduct = matrixProductId.current === product.id;
    matrixProductId.current = product.id;
    setMatrixQuantities(previous => {
      const next: Record<string, number> = {};
      for (const sku of product.skus) {
        const quantity = isSameProduct ? previous[sku.sku] || 0 : 0;
        const available = getAvailableSkuStock(sku);
        if (quantity > 0 && sku.allowBackorder !== false) next[sku.sku] = quantity;
        else if (quantity > 0 && available > 0) next[sku.sku] = Math.min(quantity, available);
      }
      return Object.keys(next).length === Object.keys(previous).length
        && Object.entries(next).every(([sku, quantity]) => previous[sku] === quantity)
        ? previous
        : next;
    });
  }, [product?.id, product?.skus]);

  // If product is not found, fallback to catalog
  if (!product) {
    return (
      <div className="max-w-4xl mx-auto py-20 text-center space-y-4">
        <h2 className="text-xl font-bold text-neutral-800">
          {localizeCopy('未找到对应商品', 'Articolo non trovato')}
        </h2>
        <button
          type="button"
          onClick={() => setCurrentView('catalog')}
          className="px-4 py-2 bg-neutral-900 text-white rounded-lg text-xs font-semibold cursor-pointer"
        >
          {localizeCopy('返回采购大厅', 'Torna al Catalogo')}
        </button>
      </div>
    );
  }

  // Vault access check: if product is exclusive protected, merchant must have approved customer
  const isRestrictedProduct = product.visibility === 'private' || product.isExclusiveProtected;
  const isDemoProduct = product.id.startsWith('demo-showroom-product-');
  const merchantScopeId = product.merchantId;
  const isLocked = Boolean(isRestrictedProduct && (!merchantScopeId || !hasVaultAccess(merchantScopeId)));
  const vaultStatus = merchantScopeId ? getVaultStatus(merchantScopeId) : 'none';
  const availableStock = getAvailableSkuStock;
  const productColors = [...new Map(product.skus.map(sku => [sku.color, sku])).values()];
  const allProductColors = productColors.map(sku => sku.color);
  const selectedColors = colorSelectionByProduct[product.id] ?? allProductColors.slice(0, 1);
  const selectedColorSet = new Set(selectedColors);

  const toggleColorSelection = (color: string) => {
    const isSelected = selectedColorSet.has(color);
    setColorSelectionByProduct(previous => {
      const current = previous[product.id] ?? allProductColors.slice(0, 1);
      return {
        ...previous,
        [product.id]: isSelected
          ? current.filter(selectedColor => selectedColor !== color)
          : [...current, color]
      };
    });
    if (isSelected) {
      setMatrixQuantities(previous => {
        const next = { ...previous };
        product.skus.filter(sku => sku.color === color).forEach(sku => delete next[sku.sku]);
        return next;
      });
    }
  };

  // Calculate pricing & margins
  const selectedMatrixQuantity = Object.values(matrixQuantities).reduce((total, quantity) => total + quantity, 0);
  const existingCartQuantity = cart
    .filter(item => item.productId === product.id)
    .reduce((total, item) => total + item.quantity, 0);
  const totalCartUnits = cart.reduce((total, item) => total + item.quantity, 0);
  const orderQuantity = selectedMatrixQuantity + existingCartQuantity;
  const wholesalePrice = calculateCustomerPrice(product.wholesalePrice);
  const currentWholesalePrice = calculateCustomerPrice(getProductWholesalePriceForQuantity(
    product.wholesalePrice,
    product.wholesalePrice100,
    orderQuantity,
    product.bulkPriceMinimumQuantity
  ));
  const retailPrice = product.rrpPrice;
  const has100PiecePrice = typeof product.wholesalePrice100 === 'number' && product.wholesalePrice100 > 0;
  const markupPercent = retailPrice > 0 ? Math.round(((retailPrice - wholesalePrice) / retailPrice) * 100) : 0;

  // Single-warehouse inventory
  const centralStockTotal = product.skus.reduce((sum, sku) => sum + availableStock(sku), 0);
  const totalStock = centralStockTotal;

  // Matrix manipulation helpers
  const handleQuantityChange = (skuCode: string, qty: number) => {
    const skuItem = product.skus.find(s => s.sku === skuCode);
    const maxStock = availableStock(skuItem);
    setMatrixQuantities(prev => {
      const requestedQuantity = Math.max(0, Math.floor(qty));
      const nextVal = skuItem?.allowBackorder === false
        ? Math.min(maxStock, requestedQuantity)
        : requestedQuantity;
      if (nextVal === 0) {
        const { [skuCode]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [skuCode]: nextVal };
    });
  };

  const handleQuickFillMoq = () => {
    const defaultSku = product.skus.find(sku => selectedColorSet.has(sku.color) && availableStock(sku) > 0);
    if (defaultSku) {
      handleQuantityChange(defaultSku.sku, product.moq);
    }
  };

  const handleQuickClearAll = () => {
    setMatrixQuantities({});
  };

  const totalSelectedQty = selectedMatrixQuantity;
  const totalSelectedAmount: number = totalSelectedQty * currentWholesalePrice;
  const canOrderSelection = isDemoProduct
    ? totalSelectedQty >= product.moq
    : totalSelectedQty > 0;

  const openProductSupport = () => {
    const detail: ProductSupportContext = {
      productId: product.id,
      productName: localizedProductName,
      styleNo: product.styleNo,
      selectedSkus: product.skus
        .filter(sku => selectedColorSet.has(sku.color) && (matrixQuantities[sku.sku] || 0) > 0)
        .map(sku => ({
          sku: sku.sku,
          color: getLocalizedColor(sku.color, lang),
          size: sku.size,
          quantity: matrixQuantities[sku.sku]
        }))
    };
    window.dispatchEvent(new CustomEvent<ProductSupportContext>('ruda:open-platform-support', { detail }));
  };

  const handleBatchAddToCart = () => {
    if (totalSelectedQty === 0) return;

    const itemsToAdd = Object.entries(matrixQuantities)
      .filter(([skuCode, qty]) => Number(qty) > 0 && selectedColorSet.has(product.skus.find(sku => sku.sku === skuCode)?.color || ''))
      .map(([skuCode, qty]) => {
        const skuItem = product.skus.find(s => s.sku === skuCode);
        return {
          productId: product.id,
          styleNo: product.styleNo,
          productName: getLocalizedProductName(product, lang),
          image: product.images[0],
          sku: skuCode,
          color: skuItem?.color || 'Standard',
          size: skuItem?.size || 'OneSize',
          quantity: Number(qty),
          unitPrice: currentWholesalePrice,
          packSize: product.packSize || 6
        };
      });

    addMultipleToCart(itemsToAdd);
    setMatrixQuantities({});
  };
  const handleBatchOrderAndOpenCart = () => {
    handleBatchAddToCart();
    if (totalSelectedQty > 0) setCurrentView('checkout');
  };

  const handleRequestSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (merchantScopeId) requestVaultAccess(merchantScopeId, requestNote);
    setShowRequestModal(false);
  };

  const handleRequestAccess = () => {
    if (!currentCustomer) {
      setShowRequestModal(false);
      setShowBuyerRegister(true);
      return;
    }
    if (currentCustomer.status !== 'approved') {
      addNotification(
        'warning',
        localizeCopy('需要完成企业认证', 'Verifica aziendale necessaria'),
        localizeCopy('注册后可正常浏览公开内容，企业认证通过后才可查看私密或锁定货品。', 'Puoi navigare i contenuti pubblici; le collezioni private sono disponibili dopo l’approvazione.')
      );
      return;
    }
    setShowRequestModal(true);
  };

  const localizedProductName = getLocalizedProductName(product, lang);
  const localizedCategory = getProductCategoryLabel(product.category, isIt);
  const productMedia = product.media?.length
    ? product.media
    : product.images.map((url, index) => ({ id: `legacy-${index}`, type: 'image' as const, url }));
  const sharePath = `${window.location.origin}${getProductPath(product.id)}`;

  if (isDemoProduct || (!isLocked && ['in_stock', 'low_stock', 'pre_order'].includes(product.inventoryStatus))) {
    const colorOptions = productColors;
    const sizeOptions = [...new Set(product.skus.map(sku => sku.size))];
    const localizedDescription = lang === 'zh'
      ? product.description_zh || product.description
      : isIt ? product.description_it || product.description : product.description;
    const localizedFabric = lang === 'zh'
      ? product.fabric_zh || product.fabric
      : isIt ? product.fabric_it || product.fabric : product.fabric;
    const localizedOrigin = lang === 'zh'
      ? product.origin_zh || product.origin
      : isIt ? product.origin_it || product.origin : product.origin;
    const availabilityLabel = totalStock === 0
      ? product.skus.some(sku => sku.allowBackorder !== false)
        ? localizeCopy('支持订货 · 待商家确认', 'Disponibile su ordinazione, da confermare')
        : localizeCopy('暂时缺货', 'Non disponibile')
      : product.inventoryStatus === 'low_stock'
        ? localizeCopy('库存紧张', 'Scorte limitate')
        : localizeCopy('有现货', 'Disponibile');
    const setColorPresetQuantity = (color: string, targetQuantity: number) => {
      const colorSkus = product.skus.filter(sku => sku.color === color);
      const availableQuantity = colorSkus.reduce((total, sku) => total + availableStock(sku), 0);
      if (colorSkus.every(sku => sku.allowBackorder === false) && availableQuantity < targetQuantity) return;

      const allocations = new Map(colorSkus.map(sku => [sku.sku, 0]));
      for (let remaining = targetQuantity; remaining > 0; remaining--) {
        const nextSku = colorSkus
          .filter(sku => sku.allowBackorder !== false || (allocations.get(sku.sku) || 0) < availableStock(sku))
          .sort((left, right) =>
            (allocations.get(left.sku) || 0) - (allocations.get(right.sku) || 0)
          )[0];
        if (!nextSku) return;
        allocations.set(nextSku.sku, (allocations.get(nextSku.sku) || 0) + 1);
      }

      setMatrixQuantities(previous => {
        const next = { ...previous };
        for (const sku of colorSkus) {
          const quantity = allocations.get(sku.sku) || 0;
          if (quantity) next[sku.sku] = quantity;
          else delete next[sku.sku];
        }
        return next;
      });
    };
    const handleAddSampleToCart = () => {
      if (!canOrderSelection) return;
      addMultipleToCart(product.skus
        .filter(sku => selectedColorSet.has(sku.color) && (matrixQuantities[sku.sku] || 0) > 0)
        .map(sku => ({
          productId: product.id,
          styleNo: product.styleNo,
          productName: localizedProductName,
          image: product.images[0],
          sku: sku.sku,
          color: sku.color,
          size: sku.size,
          quantity: matrixQuantities[sku.sku],
          unitPrice: currentWholesalePrice,
          packSize: product.packSize
        })));
      setMatrixQuantities(previous => {
        const next = { ...previous };
        product.skus.forEach(sku => delete next[sku.sku]);
        return next;
      });
    };
    const handleOrderAndOpenCart = () => {
      handleAddSampleToCart();
      if (canOrderSelection) setCurrentView('checkout');
    };

    return (
      <div className="mx-auto max-w-[1800px] bg-white px-3 py-3 pb-32 sm:px-6 sm:py-6 lg:px-8">
        <div className="mb-5 flex items-center justify-between sm:mb-7">
          <button
            type="button"
            onClick={() => setCurrentView('catalog')}
            className="flex items-center gap-1 text-xs font-medium text-neutral-600 hover:text-black"
          >
            <ArrowLeft className="h-4 w-4" />
            {localizeCopy('返回采购大厅', 'Torna al Catalogo')}
          </button>
          <span className="text-[10px] tracking-[0.12em] text-neutral-400">{product.styleNo}</span>
          <ShareButton
            title={`${localizedProductName} · RUDA Fashion B2B`}
            text={`查看 ${localizedProductName}（款号 ${product.styleNo}）`}
            path={sharePath}
            source={`product-${product.id}`}
          />
        </div>

        <div className="grid grid-cols-1 items-start gap-7 lg:grid-cols-[minmax(0,2.2fr)_minmax(290px,0.8fr)] lg:gap-8">
          <div className="space-y-2 sm:space-y-3">
            {productMedia[activeImageIndex]?.type === 'video' ? (
              <video
                src={productMedia[activeImageIndex].url}
                controls
                className="aspect-[4/5] w-full object-cover"
              />
            ) : (
              <button
                type="button"
                onClick={event => {
                  if (galleryWasSwiped.current) {
                    galleryWasSwiped.current = false;
                    event.preventDefault();
                    return;
                  }
                  setShowImageLightbox(true);
                }}
                onPointerDown={event => {
                  galleryDragStart.current = { x: event.clientX, y: event.clientY };
                  event.currentTarget.setPointerCapture(event.pointerId);
                }}
                onPointerUp={event => {
                  const start = galleryDragStart.current;
                  galleryDragStart.current = null;
                  if (!start || productMedia.length < 2) return;
                  const deltaX = event.clientX - start.x;
                  const deltaY = event.clientY - start.y;
                  if (Math.abs(deltaX) < 45 || Math.abs(deltaX) <= Math.abs(deltaY)) return;
                  galleryWasSwiped.current = true;
                  setActiveImageIndex(index => (
                    index + (deltaX < 0 ? 1 : -1) + productMedia.length
                  ) % productMedia.length);
                }}
                onPointerCancel={() => {
                  galleryDragStart.current = null;
                }}
                aria-label={localizeCopy('商品图片放大查看', 'Immagine prodotto ingrandita')}
                className="touch-pan-y block w-full cursor-zoom-in bg-transparent p-0"
              >
                <ProductImage
                  src={productMedia[activeImageIndex]?.url || product.images[0]}
                  alt={`${localizedProductName} ${activeImageIndex + 1}`}
                  priority
                  flush
                  className="aspect-[4/5] w-full"
                  imageClassName={isLocked ? 'blur-sm brightness-90' : ''}
                />
              </button>
            )}
            {productMedia.length > 1 && (
              <div className="grid grid-cols-6 gap-1.5 sm:gap-2">
                {productMedia.map((item, index) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setActiveImageIndex(index)}
                    aria-label={localizeCopy("查看商品图片 {{RUDA_ARG_0}}", "Visualizza immagine {{RUDA_ARG_0}}", [String(index + 1)])}
                    aria-pressed={activeImageIndex === index}
                    className={`aspect-[4/5] w-full overflow-hidden bg-transparent ${activeImageIndex === index ? 'opacity-100' : 'opacity-60 hover:opacity-100'}`}
                  >
                    {item.type === 'video' ? (
                      <video src={item.url} muted className="h-full w-full object-cover" />
                    ) : (
                      <ProductImage
                        src={item.url}
                        alt={`${localizedProductName} ${index + 1}`}
                        flush
                        className="h-full w-full"
                      />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          <section className="space-y-6 lg:sticky lg:top-10 lg:pt-8">
            <div className="border-b border-neutral-200 pb-4">
              <p className="hidden text-[10px] uppercase tracking-[0.16em] text-neutral-500 lg:block">{product.merchantName}</p>
              <h1 className="mt-2 font-serif text-2xl font-medium uppercase leading-tight tracking-[0.025em] text-neutral-950 sm:text-3xl">
                {localizedProductName}
              </h1>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-xl font-semibold text-neutral-950">€{currentWholesalePrice.toFixed(2)}</span>
                <span className="text-[10px] uppercase tracking-[0.1em] text-neutral-500">{orderQuantity >= 100 && has100PiecePrice ? localizeCopy('100件批发价 / 件', 'Prezzo 100 pezzi / capo') : localizeCopy('批发价 / 件', 'all’ingrosso / pezzo')}</span>
              </div>
              <div className="mt-2 flex items-center gap-2 text-[10px] text-neutral-500">
                <span>{localizeCopy('起订 {{RUDA_ARG_0}} 件', 'Min. {{RUDA_ARG_0}} pz', [String(product.moq)])}</span>
                <span aria-hidden="true">·</span>
                <span>{availabilityLabel}</span>
              </div>
              <p className="mt-3 flex items-center gap-2 text-[10px] uppercase tracking-[0.12em] text-neutral-600">
                <span className={`h-1.5 w-1.5 rounded-full ${totalStock === 0 || product.inventoryStatus === 'low_stock' ? 'bg-amber-600' : 'bg-emerald-700'}`} />
                {availabilityLabel}
              </p>
            </div>

            <div>
              <p className="mb-2 text-[9px] uppercase tracking-[0.1em] text-neutral-600">{localizeCopy('选择颜色', 'Seleziona i colori')}</p>
              <div className="mb-3 flex flex-wrap gap-2">
                {colorOptions.map(colorOption => {
                  const isSelected = selectedColorSet.has(colorOption.color);
                  return (
                    <button
                      key={colorOption.color}
                      type="button"
                      onClick={() => toggleColorSelection(colorOption.color)}
                      aria-label={getLocalizedColor(colorOption.color, lang)}
                      aria-pressed={isSelected}
                      title={getLocalizedColor(colorOption.color, lang)}
                      className={`flex min-h-12 min-w-12 flex-col items-center justify-center gap-1 rounded border border-neutral-200 px-1.5 py-1 text-[9px] text-neutral-800 transition-all ${isSelected ? 'border-neutral-950' : 'opacity-50'}`}
                    >
                      <span className="h-4 w-4 rounded-full border border-black/10" style={{ backgroundColor: colorOption.colorCode }} />
                      <span className="max-w-14 truncate">{getLocalizedColor(colorOption.color, lang)}</span>
                    </button>
                  );
                })}
              </div>
              <div className="hidden w-fit max-w-full overflow-x-auto lg:block">
                  <div
                    className="grid w-max items-center gap-0 border-b border-neutral-200 pb-1.5 text-[10px] font-medium uppercase tracking-normal text-neutral-700"
                    style={{ gridTemplateColumns: `minmax(3.5rem,5rem) repeat(${sizeOptions.length},2.25rem) 2.25rem` }}
                  >
                    <span>{localizeCopy('颜色', 'Colore')}</span>
                    {sizeOptions.map(size => <span key={size} className="text-center font-semibold text-neutral-800">{getLocalizedSizeLabel(size)}</span>)}
                    <span className="text-right">{localizeCopy('件数', 'Q.tà')}</span>
                  </div>
                  <div className="divide-y divide-neutral-100">
                    {colorOptions.filter(colorOption => selectedColorSet.has(colorOption.color)).map(colorOption => {
                      const colorSkus = product.skus.filter(sku => sku.color === colorOption.color);
                      const colorQuantity = colorSkus.reduce((total, sku) => total + (matrixQuantities[sku.sku] || 0), 0);
                      const colorStock = colorSkus.reduce((total, sku) => total + availableStock(sku), 0);

                      return (
                        <React.Fragment key={colorOption.color}>
                          <div
                            className="grid items-center gap-0 py-1"
                            style={{ gridTemplateColumns: `minmax(3.5rem,5rem) repeat(${sizeOptions.length},2.25rem) 2.25rem` }}
                          >
                            <span className="flex min-w-0 items-center gap-0.5">
                              <span className="h-2 w-2 shrink-0 rounded-full border border-black/10" style={{ backgroundColor: colorOption.colorCode }} />
                              <span className="truncate text-[8px] text-neutral-700">{getLocalizedColor(colorOption.color, lang)}</span>
                            </span>
                            {sizeOptions.map(size => {
                              const sku = colorSkus.find(item => item.size === size);
                              return (
                                <span key={size} className="text-center">
                                  {sku ? (
                                    <input
                                      type="number"
                                      min="0"
                                      max={sku.allowBackorder === false ? availableStock(sku) : undefined}
                                      disabled={sku.allowBackorder === false && availableStock(sku) === 0}
                                      step="1"
                                      inputMode="numeric"
                                      value={matrixQuantities[sku.sku] ?? ''}
                                      onChange={event => handleQuantityChange(sku.sku, event.currentTarget.valueAsNumber || 0)}
                                      aria-label={`${getLocalizedColor(colorOption.color, lang)} · ${size}`}
                                      className="w-full border-b border-neutral-300 bg-transparent px-0 py-0.5 text-center text-[11px] tabular-nums text-neutral-900 outline-none transition-colors focus:border-neutral-950"
                                    />
                                  ) : <span className="text-neutral-300">—</span>}
                                </span>
                              );
                            })}
                            <span className="text-right text-[8px] tabular-nums text-neutral-700">{colorQuantity || '—'}</span>
                          </div>
                          <div className="flex justify-end gap-0.5 pb-1">
                            {[10, 20, 30, 50].map(quantity => (
                              <button
                                key={quantity}
                                type="button"
                                disabled={colorSkus.every(sku => sku.allowBackorder === false) && colorStock < quantity}
                                onClick={() => setColorPresetQuantity(colorOption.color, quantity)}
                                aria-label={`${getLocalizedColor(colorOption.color, lang)} · ${quantity} ${localizeCopy('件数', 'Q.tà')}`}
                                className="min-w-7 border border-neutral-200 px-1.5 py-0.5 text-[8px] leading-3 tabular-nums text-neutral-600 transition-colors hover:border-neutral-800 hover:text-neutral-950 disabled:cursor-not-allowed disabled:opacity-30"
                              >
                                {quantity}
                              </button>
                            ))}
                          </div>
                        </React.Fragment>
                      );
                    })}
                  </div>
              </div>
                  <div className="space-y-3 lg:hidden" aria-label={localizeCopy('按颜色和尺码选择数量', 'Quantità per colore e taglia')}>
                  {colorOptions.filter(colorOption => selectedColorSet.has(colorOption.color)).map((colorOption, colorIndex) => {
                    const colorSkus = product.skus.filter(sku => sku.color === colorOption.color);
                    const colorQuantity = colorSkus.reduce((total, sku) => total + (matrixQuantities[sku.sku] || 0), 0);
                    const colorStock = colorSkus.reduce((total, sku) => total + availableStock(sku), 0);
                    return (
                      <details key={colorOption.color} open={colorIndex === 0} className="rounded-lg border border-neutral-200 px-3">
                        <summary className="flex min-h-12 cursor-pointer list-none items-center gap-2 text-xs font-semibold text-neutral-900">
                          <span className="h-3 w-3 rounded-full border border-black/10" style={{ backgroundColor: colorOption.colorCode }} />
                          {getLocalizedColor(colorOption.color, lang)}
                          <span className="ml-auto text-[10px] font-normal text-neutral-500">
                            {colorQuantity > 0
                              ? localizeCopy('已选 {{RUDA_ARG_0}} 件', '{{RUDA_ARG_0}} selected', [String(colorQuantity)])
                              : localizeCopy('库存 {{RUDA_ARG_0}}', 'Stock {{RUDA_ARG_0}}', [String(colorStock)])}
                          </span>
                          <span aria-hidden="true" className="text-neutral-500">⌄</span>
                        </summary>
                        <div className="divide-y divide-neutral-100 border-t border-neutral-100">
                          {colorSkus.map(sku => {
                            const available = availableStock(sku);
                            const quantity = matrixQuantities[sku.sku] || 0;
                            return (
                              <div key={sku.sku} className="flex items-center justify-between gap-3 py-2">
                                <div className="min-w-0">
                                  <p className="text-xs font-medium text-neutral-800">{getLocalizedSizeLabel(sku.size)}</p>
                                  <p className="truncate text-[10px] text-neutral-500">
                                    {localizeCopy('可用 {{RUDA_ARG_0}} 件', '{{RUDA_ARG_0}} disponibili', [String(available)])}
                                  </p>
                                </div>
                                <div className="inline-flex shrink-0 items-center overflow-hidden rounded-md border border-neutral-300">
                                  <button
                                    type="button"
                                    onClick={() => handleQuantityChange(sku.sku, quantity - 1)}
                                    disabled={quantity <= 0}
                                    aria-label={`${getLocalizedColor(colorOption.color, lang)} ${getLocalizedSizeLabel(sku.size)} −`}
                                    className="flex h-9 w-9 items-center justify-center text-neutral-700 disabled:opacity-30"
                                  >
                                    <Minus className="h-3.5 w-3.5" />
                                  </button>
                                  <input
                                    type="number"
                                    min="0"
                                    max={available}
                                    step="1"
                                    inputMode="numeric"
                                    disabled={sku.allowBackorder === false && available === 0}
                                    value={quantity || ''}
                                    onChange={event => handleQuantityChange(sku.sku, event.currentTarget.valueAsNumber || 0)}
                                    aria-label={`${getLocalizedColor(colorOption.color, lang)} · ${getLocalizedSizeLabel(sku.size)}`}
                                    className="h-9 w-12 border-x border-neutral-200 text-center text-xs tabular-nums outline-none disabled:bg-neutral-50"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => handleQuantityChange(sku.sku, quantity + 1)}
                                    disabled={sku.allowBackorder === false && quantity >= available}
                                    aria-label={`${getLocalizedColor(colorOption.color, lang)} ${getLocalizedSizeLabel(sku.size)} +`}
                                    className="flex h-9 w-9 items-center justify-center text-neutral-700 disabled:opacity-30"
                                  >
                                    <Plus className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </details>
                    );
                  })}
                  </div>
            </div>

            <div className="flex items-end justify-between border-t border-neutral-200 pt-3">
              <div>
                <span className="block text-[10px] text-neutral-500">
                  {localizeCopy('合计 ({{RUDA_ARG_0}} 件)', 'Totale ({{RUDA_ARG_0}} pz)', [String(totalSelectedQty)])}
                </span>
                <span className="mt-1 block text-sm font-semibold text-neutral-950">€{totalSelectedAmount.toFixed(2)}</span>
              </div>
              <span className="text-[10px] text-neutral-500">
                {localizeCopy('现货不足部分由商家审核订货', 'Il venditore confermerà la disponibilità')}
              </span>
            </div>
          </section>
        </div>
        <div className="mt-8 max-w-3xl border-t border-neutral-200 pt-4">
          <section className="max-w-3xl">
            <details className="border-b border-neutral-200 py-4">
              <summary className="flex cursor-pointer list-none items-center justify-between text-[11px] font-medium uppercase tracking-[0.14em] text-neutral-800">
                {localizeCopy('商品详情', 'Dettagli prodotto')}
                <Plus className="h-4 w-4 text-neutral-500" />
              </summary>
              <p className="pt-4 text-sm leading-6 text-neutral-600">{localizedDescription}</p>
              {localizedOrigin && <p className="pt-2 text-xs text-neutral-500">{localizedOrigin}</p>}
            </details>
            <details className="border-b border-neutral-200 py-4">
              <summary className="flex cursor-pointer list-none items-center justify-between text-[11px] font-medium uppercase tracking-[0.14em] text-neutral-800">
                {localizeCopy('成分', 'Composizione')}
                <Plus className="h-4 w-4 text-neutral-500" />
              </summary>
              <div className="space-y-2 pt-4 text-sm leading-6 text-neutral-600">
                {localizedFabric && <p>{localizedFabric}</p>}
                {product.composition && <p>{product.composition}</p>}
              </div>
            </details>
          </section>
        </div>
        {showImageLightbox && (
          <div
            role="dialog"
            aria-modal="true"
            aria-label={localizeCopy('商品图片放大查看', 'Immagine prodotto ingrandita')}
            className="fixed inset-0 z-[80] flex items-center justify-center bg-black/95 p-3 sm:p-8"
            onClick={() => setShowImageLightbox(false)}
          >
            <button
              type="button"
              onClick={() => setShowImageLightbox(false)}
              aria-label={localizeCopy('关闭', 'Chiudi')}
              className="absolute right-4 top-4 z-10 rounded-full bg-white/15 p-2 text-white hover:bg-white/25"
            >
              <X className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={event => {
                event.stopPropagation();
                setActiveImageIndex(index => (index - 1 + productMedia.length) % productMedia.length);
              }}
              aria-label={localizeCopy('查看上一张', 'Immagine precedente')}
              className="absolute left-3 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/15 p-2 text-white hover:bg-white/25 sm:left-6"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
            <div
              className="touch-pan-y select-none"
              onPointerDown={event => {
                if (event.target instanceof Element && event.target.closest('video, button')) return;
                lightboxDragStart.current = { x: event.clientX, y: event.clientY };
                event.currentTarget.setPointerCapture(event.pointerId);
              }}
              onPointerUp={event => {
                const start = lightboxDragStart.current;
                lightboxDragStart.current = null;
                if (!start || productMedia.length < 2) return;
                const deltaX = event.clientX - start.x;
                const deltaY = event.clientY - start.y;
                if (Math.abs(deltaX) < 45 || Math.abs(deltaX) <= Math.abs(deltaY)) return;
                event.stopPropagation();
                setActiveImageIndex(index => (
                  index + (deltaX < 0 ? 1 : -1) + productMedia.length
                ) % productMedia.length);
              }}
              onPointerCancel={() => {
                lightboxDragStart.current = null;
              }}
              onClick={event => event.stopPropagation()}
            >
              {productMedia[activeImageIndex]?.type === 'video' ? (
                <video
                  src={productMedia[activeImageIndex].url}
                  controls
                  autoPlay
                  className="max-h-[88vh] max-w-[88vw] object-contain"
                />
              ) : (
                <img
                  src={productMedia[activeImageIndex]?.url || product.images[0]}
                  alt={`${localizedProductName} ${activeImageIndex + 1}`}
                  draggable={false}
                  className="max-h-[88vh] max-w-[88vw] object-contain"
                />
              )}
            </div>
            <button
              type="button"
              onClick={event => {
                event.stopPropagation();
                setActiveImageIndex(index => (index + 1) % productMedia.length);
              }}
              aria-label={localizeCopy('查看下一张', 'Immagine successiva')}
              className="absolute right-3 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/15 p-2 text-white hover:bg-white/25 sm:right-6"
            >
              <ChevronRight className="h-6 w-6" />
            </button>
            <span className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/50 px-2 py-1 text-[10px] text-white">
              {activeImageIndex + 1} / {productMedia.length}
            </span>
          </div>
        )}
        <div className="fixed inset-x-0 bottom-[calc(4.25rem+env(safe-area-inset-bottom))] z-40 border-t border-neutral-200 bg-white/95 px-2 py-2 backdrop-blur lg:bottom-0 sm:px-3">
          <div className="mx-auto grid max-w-5xl grid-cols-3 gap-1.5 sm:gap-3">
            <p className="col-span-4 flex items-center justify-between px-1 text-[10px] text-neutral-500">
              <span>{localizeCopy('已选 {{RUDA_ARG_0}} 件 · 商品金额预估', '{{RUDA_ARG_0}} selected · estimated goods', [String(totalSelectedQty)])}</span>
              <strong className="text-neutral-900">€{totalSelectedAmount.toFixed(2)} <span className="font-normal text-neutral-500">{localizeCopy('商品预估', 'stima merce')}</span></strong>
            </p>
            <button type="button" onClick={openProductSupport} className="flex min-h-11 flex-col items-center justify-center gap-0.5 rounded-md text-[9px] font-semibold text-neutral-800 hover:bg-neutral-100 sm:flex-row sm:gap-1.5 sm:text-xs">
              <MessageCircle className="h-4 w-4" />
              <span>{localizeCopy('客服', 'Customer Service')}</span>
            </button>
            <button type="button" onClick={() => setCurrentView('cart')} aria-label={localizeCopy('购物车，全车共 {{RUDA_ARG_0}} 件', 'Cart, {{RUDA_ARG_0}} units total', [String(totalCartUnits)])} className="relative flex min-h-11 flex-col items-center justify-center gap-0.5 rounded-md text-[9px] font-semibold text-neutral-800 hover:bg-neutral-100 sm:flex-row sm:gap-1.5 sm:text-xs">
              <ShoppingCart className="h-4 w-4" />
              <span>{localizeCopy('购物车', 'Cart')}</span>
              <span className="absolute right-1 top-0.5 min-w-4 rounded-full bg-neutral-950 px-1 text-center text-[9px] leading-4 text-white">{totalCartUnits}</span>
              <span className="text-[8px] font-normal text-neutral-500">{localizeCopy('全车 {{RUDA_ARG_0}} 件', '{{RUDA_ARG_0}} units total', [String(totalCartUnits)])}</span>
            </button>
            <button type="button" onClick={handleOrderAndOpenCart} disabled={!canOrderSelection} className="flex min-h-11 flex-col items-center justify-center gap-0.5 rounded-md bg-neutral-950 text-[9px] font-semibold text-white disabled:bg-neutral-300 sm:flex-row sm:gap-1.5 sm:text-xs">
              <span>{localizeCopy('提交订单', 'Submit order')}</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-8 ${!isLocked ? 'pb-28' : ''}`}>
      {/* 1. Breadcrumbs and Return Button */}
      <div className="flex items-center justify-between text-xs text-neutral-500 border-b border-neutral-200 pb-3">
        <button
          type="button"
          onClick={() => setCurrentView('catalog')}
          className="flex items-center gap-1.5 text-neutral-800 hover:text-black font-semibold cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>{localizeCopy('返回采购选款大厅', 'Torna al Catalogo Capi')}</span>
        </button>

        <div className="flex items-center gap-1.5 font-mono text-[11px]">
          <span>{localizedCategory}</span>
          <span>/</span>
          <span>{product.brand}</span>
          <span>/</span>
          <span className="text-black font-bold">{product.styleNo}</span>
        </div>
        <ShareButton
          title={`${localizedProductName} · RUDA Fashion B2B`}
          text={`查看 ${localizedProductName}（款号 ${product.styleNo}）`}
          path={sharePath}
          source={`product-${product.id}`}
        />
      </div>

      {/* 2. Top Grid: Gallery (5 cols) & Product Summary (7 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Image Gallery */}
        <div className="lg:col-span-5 space-y-4">
          <div
            className="relative aspect-3/4 touch-pan-y overflow-hidden bg-neutral-100"
            onPointerDown={event => {
              if (event.target instanceof Element && event.target.closest('video')) return;
              galleryDragStart.current = { x: event.clientX, y: event.clientY };
              event.currentTarget.setPointerCapture(event.pointerId);
            }}
            onPointerUp={event => {
              const start = galleryDragStart.current;
              galleryDragStart.current = null;
              if (!start || productMedia.length < 2) return;
              const deltaX = event.clientX - start.x;
              const deltaY = event.clientY - start.y;
              if (Math.abs(deltaX) < 45 || Math.abs(deltaX) <= Math.abs(deltaY)) return;
              setActiveImageIndex(index => (
                index + (deltaX < 0 ? 1 : -1) + productMedia.length
              ) % productMedia.length);
            }}
            onPointerCancel={() => {
              galleryDragStart.current = null;
            }}
          >
            {productMedia[activeImageIndex]?.type === 'video' ? (
              <video src={productMedia[activeImageIndex].url} controls className="h-full w-full object-contain" />
            ) : (
              <ProductImage
                src={productMedia[activeImageIndex]?.url || product.images[0]}
                alt={localizedProductName}
                priority
                contain
                className="h-full w-full"
                imageClassName={`transition-none ${isLocked ? 'filter blur-sm brightness-90' : ''}`}
              />
            )}

            {/* Private Collection Protection Overlay if locked */}
            {isLocked && (
              <div className="absolute inset-0 bg-neutral-900/60 backdrop-blur-xs flex flex-col items-center justify-center p-6 text-center text-white space-y-2 select-none">
                <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center">
                  <Lock className="w-6 h-6 text-white" />
                </div>
                <span className="font-bold text-sm">
                  {localizeCopy('授权专属商品', 'Collezione Riservata')}
                </span>
                <span className="text-[11px] text-neutral-300 max-w-xs">
                  {localizeCopy("需向【{{RUDA_ARG_0}}】申请专属看货权限方可查看高清细节与大货起订配比。", "Per visionare i dettagli e ordinare questo capo è richiesta l'autorizzazione diretta di {{RUDA_ARG_0}}.", [String(product.merchantName)])}
                </span>
                <button
                  type="button"
                  onClick={handleRequestAccess}
                  className="mt-2 px-3 py-1.5 bg-white text-black font-bold text-xs rounded-lg hover:bg-neutral-200 transition-colors cursor-pointer"
                >
                  {vaultStatus === 'pending' 
                    ? (localizeCopy('审核中 · 查看进度', 'Richiesta in elaborazione'))
                    : (localizeCopy('申请专属商品权限', 'Richiedi Accesso al Campionario'))}
                </button>
              </div>
            )}

            <div className="absolute top-3 left-3 bg-neutral-900/90 text-white text-[10px] font-mono px-2 py-1 rounded font-semibold">
              {isDemoProduct ? localizeCopy('特价样品展厅', 'Showroom campionario') : localizeCopy('意大利原产', 'Made in Italy')}
            </div>

            {isRestrictedProduct && !isLocked && (
              <div className="absolute top-3 right-3 bg-black text-white text-[10px] font-bold px-2 py-1 rounded flex items-center gap-1 shadow-xs">
                <Sparkles className="w-3 h-3 text-white" />
                <span>{localizeCopy('已获看货授权', 'Accesso Autorizzato')}</span>
              </div>
            )}
          </div>

          {/* Thumbnails */}
          {productMedia.length > 1 && (
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              {productMedia.map((item, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setActiveImageIndex(idx)}
                  className={`w-16 h-20 rounded-lg overflow-hidden border-2 shrink-0 transition-all cursor-pointer ${
                    activeImageIndex === idx ? 'border-neutral-900 shadow-xs' : 'border-transparent opacity-60 hover:opacity-100'
                  }`}
                >
                  {item.type === 'video' ? <video src={item.url} className="h-full w-full object-cover" /> : <ProductImage src={item.url} alt={`${localizedProductName} ${idx + 1}`} contain className="h-full w-full" />}
                </button>
              ))}
            </div>
          )}

          {/* Authenticity guarantee box */}
          <div className="p-3.5 bg-neutral-50 border border-neutral-200 rounded-xl text-xs space-y-1.5 text-neutral-600">
            <div className="flex items-center gap-1.5 font-bold text-neutral-900">
              <ShieldCheck className="w-4 h-4 text-black" />
              <span>
                {isDemoProduct
                  ? (localizeCopy('RUDA 特价商品展示款', 'Articolo in esposizione RUDA'))
                  : (localizeCopy('普拉托工坊直供保证 (Made in Italy)', 'Garanzia di Origine Artigianale'))}
              </span>
            </div>
            <p className="text-[11px] leading-relaxed text-neutral-500">
              {isDemoProduct
                ? (localizeCopy('可在此体验颜色、尺码、配码和采购清单的商品页面效果。', 'Esplora colori, taglie, combinazioni e riepilogo del carrello.'))
                : localizeCopy('出厂配备意大利国家商会溯源码，支持欧盟反向增值税开票 (Reverse Charge 0% VAT)，支持大货现货直发全欧。', 'Capi prodotti con standard di conformità UE, predisposti per fatturazione elettronica intracomunitaria Reverse Charge.')}
            </p>
          </div>
        </div>

        {/* Right Column: Pricing, Inventory & Details */}
        <div className="lg:col-span-7 space-y-6">
          {/* Header Title */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="px-2 py-0.5 bg-black text-white text-[10px] font-bold rounded uppercase tracking-wider">
                {product.season}
              </span>
              <span className="px-2 py-0.5 bg-neutral-100 text-neutral-700 text-[10px] font-semibold rounded">
                {product.subCategory}
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold font-serif text-neutral-900 leading-snug">
              {localizedProductName}
            </h1>
            <p className="text-xs text-neutral-500 mt-1">
              {localizeCopy('款号:', 'Codice Articolo:')} <strong className="font-mono text-neutral-800">{product.styleNo}</strong> · {localizeCopy('工坊:', 'Atelier:')} {product.brand}
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div className="rounded-lg border border-neutral-200 bg-white p-3">
                <span className="block text-[10px] uppercase tracking-wider text-neutral-500">{isDemoProduct ? localizeCopy('规格展示库存', 'Stock varianti in anteprima') : localizeCopy('可采购库存', 'Disponibilità')}</span>
                <strong className="mt-1 block text-lg font-black text-neutral-900">{totalStock}<span className="ml-1 text-xs font-normal text-neutral-500">{localizeCopy('件', 'pz')}</span></strong>
              </div>
              <div className="rounded-lg border border-neutral-200 bg-white p-3">
                <span className="block text-[10px] uppercase tracking-wider text-neutral-500">{localizeCopy('最低起订量', 'Ordine minimo')}</span>
                <strong className="mt-1 block text-lg font-black text-neutral-900">{product.moq}<span className="ml-1 text-xs font-normal text-neutral-500">{localizeCopy('件', 'pz')}</span></strong>
              </div>
              <div className="rounded-lg border border-neutral-200 bg-white p-3">
                <span className="block text-[10px] uppercase tracking-wider text-neutral-500">{localizeCopy('包装规格', 'Confezione')}</span>
                <strong className="mt-1 block text-lg font-black text-neutral-900">{product.packSize}<span className="ml-1 text-xs font-normal text-neutral-500">{localizeCopy('件/包', 'pz')}</span></strong>
              </div>
              <div className="rounded-lg border border-neutral-200 bg-white p-3">
                <span className="block text-[10px] uppercase tracking-wider text-neutral-500">{localizeCopy('预计发货', 'Pronta evasione')}</span>
                <strong className="mt-1 block text-sm font-black text-neutral-900">{localizeCopy('24–48 小时', '24–48h')}</strong>
              </div>
            </div>
          </div>

          {/* Pricing Box */}
          <div className="bg-neutral-950 text-white border border-neutral-900 rounded-2xl p-5 sm:p-6 grid grid-cols-1 sm:grid-cols-3 gap-5 shadow-lg">
            <div className="sm:col-span-1">
              <span className="text-[10px] text-neutral-500 uppercase tracking-wider block font-medium">
                {isRegisteredWholesale 
                  ? (localizeCopy('专属批发价', 'Prezzo B2B Riservato'))
                  : (localizeCopy('批发参考价', 'Prezzo Ingrosso'))}
              </span>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span className="text-3xl sm:text-4xl font-black text-white font-serif">
                  €{currentWholesalePrice.toFixed(2)}
                </span>
                <span className="text-xs text-neutral-400 font-medium">{localizeCopy('/ 件', '/ capo')}</span>
              </div>
              {isRegisteredWholesale && currentCustomer?.tier !== 'tier_standard' && (
                <span className="inline-block mt-1 text-[10px] text-white bg-black px-1.5 py-0.5 rounded font-bold">
                  {currentCustomer?.tier === 'tier_major' 
                    ? (localizeCopy('大客户 82.5折', 'Sconto Grandi Volumi 17.5%'))
                    : (localizeCopy('VIP 9折', 'Sconto VIP 10%'))}
                </span>
              )}
            </div>

            <div className="border-t sm:border-t-0 sm:border-l border-neutral-800 sm:pl-5">
              <span className="text-[10px] text-neutral-500 uppercase tracking-wider block font-medium">
                {has100PiecePrice ? localizeCopy('100件起量批发价', 'Prezzo all’ingrosso da 100 pezzi') : localizeCopy('建议零售价 (RRP)', 'Prezzo Consigliato Retail')}
              </span>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span className="text-xl font-bold text-neutral-200 font-serif">
                  €{has100PiecePrice ? Number(product.wholesalePrice100).toFixed(2) : retailPrice.toFixed(2)}
                </span>
                <span className="text-xs text-neutral-500">{localizeCopy('/ 件', '/ capo')}</span>
              </div>
              <p className="text-[11px] text-neutral-400 mt-1">
                {has100PiecePrice
                  ? localizeCopy('单款累计购买满100件时自动应用', 'Applicato automaticamente da 100 pezzi dello stesso articolo')
                  : <>{localizeCopy('零售毛利率预估:', 'Margine indicativo:')} <strong className="text-black font-bold">~{markupPercent}%</strong></>}
              </p>
            </div>

            <div className="border-t sm:border-t-0 sm:border-l border-neutral-800 sm:pl-5">
              <span className="text-[10px] text-neutral-500 uppercase tracking-wider block font-medium">
                {localizeCopy('起订与包装', 'Lotto Minimo')}
              </span>
              <div className="mt-1 text-xs space-y-0.5">
                <p>{localizeCopy('最低起订:', 'Minimo d\'ordine:')} <strong className="text-white font-bold">{product.moq} {localizeCopy('件', 'pz')}</strong></p>
                <p>{localizeCopy('箱规:', 'Confezione:')} <strong className="text-white">{product.packSize} {localizeCopy('件/包', 'pz/pacco')}</strong></p>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* 3. SKU ORDERING MATRIX TABLE */}
      {isLocked ? (
        <section className="bg-neutral-900 text-white rounded-2xl p-6 sm:p-10 text-center space-y-5 border border-neutral-800 shadow-xl">
          <div className="w-16 h-16 rounded-full bg-white/10 mx-auto flex items-center justify-center">
            <Lock className="w-8 h-8 text-white" />
          </div>

          <div className="space-y-2 max-w-xl mx-auto">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 text-white text-xs font-semibold">
              <ShieldCheck className="w-4 h-4 text-white" />
              <span>{localizeCopy('授权专属商品', 'Collezione Riservata per Boutique Accreditate')}</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold font-serif">
              {vaultStatus === 'pending'
                ? (localizeCopy('专属商品申请正在生产商审核中', 'Richiesta di accesso in fase di verifica'))
                : (localizeCopy("需【{{RUDA_ARG_0}}】专属授权", "Accesso riservato per {{RUDA_ARG_0}}", [String(product.merchantName)]))}
            </h2>
            <p className="text-xs sm:text-sm text-neutral-400 leading-relaxed">
              {localizeCopy('通过专属授权与严格的买家认证保护新品设计。审核通过后将即时开放完整配色与下单矩阵。', 'I modelli esclusivi sono protetti per garantire la massima riservatezza commerciale ai nostri rivenditori partner.')}
            </p>
          </div>

          <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
            {vaultStatus === 'pending' ? (
              <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-neutral-800 text-white text-xs font-semibold border border-neutral-700">
                <Clock className="w-4 h-4 text-white animate-spin" />
                <span>{localizeCopy('生产商审核中 · 核验通过后自动开放', 'In attesa di approvazione')}</span>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleRequestAccess}
                className="px-6 py-3 bg-white text-black hover:bg-neutral-200 rounded-xl font-bold text-xs sm:text-sm flex items-center gap-2 transition-colors cursor-pointer shadow-lg"
              >
                <Lock className="w-4 h-4" />
                <span>{localizeCopy('申请看货权限', 'Invia Richiesta di Accreditamento')}</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                if (merchantScopeId) setSelectedMerchantId(merchantScopeId);
                setCurrentView('merchant_store');
              }}
              className="px-5 py-3 bg-neutral-800 hover:bg-neutral-700 text-white rounded-xl text-xs font-semibold cursor-pointer transition-colors"
            >
              {localizeCopy('浏览该商户公开现货', 'Visualizza Capi Pubblici')}
            </button>
          </div>
        </section>
      ) : (
        <section className="bg-white border border-neutral-200 rounded-xl p-5 space-y-4 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-neutral-200 pb-3">
            <div>
              <h2 className="text-base font-bold text-neutral-900 flex items-center gap-2">
                <Layers className="w-4 h-4 text-neutral-800" />
                <span>{localizeCopy('颜色与尺码', 'Colore e taglia')}</span>
              </h2>
            </div>

            {/* Quick Action presets */}
            <div className="flex items-center gap-2 text-xs">
              <button
                type="button"
                onClick={handleQuickFillMoq}
                className="px-2.5 py-1 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-medium rounded transition-colors cursor-pointer"
              >
                {localizeCopy("填入起订量 ({{RUDA_ARG_0}}件)", "Riempi Minimo ({{RUDA_ARG_0}} pz)", [String(product.moq)])}
              </button>
              {totalSelectedQty > 0 && (
                <button
                  type="button"
                  onClick={handleQuickClearAll}
                  className="px-2.5 py-1 text-neutral-500 hover:text-black transition-colors cursor-pointer"
                >
                  {localizeCopy('清空所选', 'Azzera')}
                </button>
              )}
            </div>
          </div>

          <div role="group" className="flex flex-wrap items-center gap-2" aria-label={localizeCopy('选择颜色', 'Seleziona i colori')}>
            <span className="mr-1 text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
              {localizeCopy('颜色', 'Colore')}
            </span>
            {productColors.map(colorOption => {
              const isSelected = selectedColorSet.has(colorOption.color);
              return (
                <button
                  key={colorOption.color}
                  type="button"
                  onClick={() => toggleColorSelection(colorOption.color)}
                  aria-label={getLocalizedColor(colorOption.color, lang)}
                  aria-pressed={isSelected}
                  title={getLocalizedColor(colorOption.color, lang)}
                  className={`h-7 w-7 rounded-full border border-neutral-300 transition-all ${isSelected ? 'ring-2 ring-neutral-950 ring-offset-2' : 'opacity-40'}`}
                  style={{ backgroundColor: colorOption.colorCode }}
                />
              );
            })}
          </div>

          {/* Matrix Table */}
          <div className="hidden overflow-x-auto lg:block">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="bg-neutral-100/90 text-neutral-700 uppercase font-semibold border-b border-neutral-200">
                  <th className="p-3">{localizeCopy('颜色', 'Colore')}</th>
                  <th className="p-3">{localizeCopy('尺码', 'Taglia')}</th>
                  <th className="p-3">{localizeCopy('单品 SKU', 'Codice SKU')}</th>
                    <th className="p-3 text-center">{localizeCopy('可用库存', 'Disponibile')}</th>
                  <th className="p-3 text-right">{localizeCopy('订购数量 (件)', 'Quantità (pz)')}</th>
                  <th className="p-3 text-right">{localizeCopy('小计', 'Subtotale')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200/80">
                {product.skus.filter(skuItem => selectedColorSet.has(skuItem.color)).map((skuItem) => {
                  const qty = matrixQuantities[skuItem.sku] || 0;
                  const skuTotalStock = availableStock(skuItem);
                  const itemSubtotal = qty * currentWholesalePrice;
                  const displayColor = getLocalizedColor(skuItem.color, lang);

                  return (
                    <tr 
                      key={skuItem.sku}
                      className={`hover:bg-neutral-50 transition-colors ${qty > 0 ? 'bg-neutral-100/80 font-medium' : ''}`}
                    >
                      {/* Color */}
                      <td className="p-3 font-medium text-neutral-900">
                        <div className="flex items-center gap-2">
                          <span 
                            className="w-3.5 h-3.5 rounded-full border border-neutral-300 shrink-0 shadow-2xs" 
                            style={{ backgroundColor: skuItem.colorCode }}
                          />
                          <span>{displayColor}</span>
                        </div>
                      </td>

                      {/* Size */}
                      <td className="p-3">
                        <span className="font-bold text-neutral-800 bg-neutral-100 px-2 py-0.5 rounded">
                          {skuItem.size}
                        </span>
                      </td>

                      {/* SKU Code */}
                      <td className="p-3 font-mono text-[11px] text-neutral-500">
                        {skuItem.sku}
                      </td>

                      {/* Total Stock */}
                      <td className="p-3 text-center font-mono font-bold text-neutral-900">
                        {skuTotalStock}
                        {skuItem.allowBackorder !== false && qty > skuTotalStock && (
                          <span className="ml-1 text-[10px] font-normal text-amber-700">
                            +{qty - skuTotalStock} {localizeCopy('订货', 'preorder')}
                          </span>
                        )}
                      </td>

                      {/* Quantity Stepper */}
                      <td className="p-3 text-right">
                        <div className="inline-flex items-center border border-neutral-300 rounded-lg bg-white overflow-hidden shadow-2xs">
                          <button
                            type="button"
                            onClick={() => handleQuantityChange(skuItem.sku, qty - 1)}
                            disabled={qty <= 0}
                            className="min-w-[36px] min-h-[36px] flex items-center justify-center text-neutral-700 hover:bg-neutral-100 disabled:opacity-30 cursor-pointer"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <input
                            type="number"
                            min="0"
                            max={skuItem.allowBackorder === false ? skuTotalStock : undefined}
                            disabled={skuItem.allowBackorder === false && skuTotalStock === 0}
                            value={qty === 0 ? '' : qty}
                            onChange={(e) => handleQuantityChange(skuItem.sku, parseInt(e.target.value) || 0)}
                            placeholder="0"
                            className="w-12 text-center text-xs font-bold py-1.5 focus:outline-none border-x border-neutral-200"
                          />
                          <button
                            type="button"
                            onClick={() => handleQuantityChange(skuItem.sku, qty + 1)}
                            disabled={skuItem.allowBackorder === false && qty >= skuTotalStock}
                            className="min-w-[36px] min-h-[36px] flex items-center justify-center text-neutral-700 hover:bg-neutral-100 disabled:opacity-30 cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>

                      {/* Subtotal */}
                      <td className="p-3 text-right font-bold text-neutral-900">
                        {qty > 0 ? `€${itemSubtotal.toFixed(2)}` : '-'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="space-y-3 lg:hidden" aria-label={localizeCopy('按颜色和尺码选择数量', 'Quantità per colore e taglia')}>
            {productColors.filter(colorOption => selectedColorSet.has(colorOption.color)).map((colorOption, colorIndex) => {
              const colorSkus = product.skus.filter(sku => sku.color === colorOption.color);
              const colorQuantity = colorSkus.reduce((total, sku) => total + (matrixQuantities[sku.sku] || 0), 0);
              const colorStock = colorSkus.reduce((total, sku) => total + availableStock(sku), 0);
              return (
                <details key={colorOption.color} open={colorIndex === 0} className="rounded-lg border border-neutral-200 px-3">
                  <summary className="flex min-h-12 cursor-pointer list-none items-center gap-2 text-xs font-semibold text-neutral-900">
                    <span className="h-3 w-3 rounded-full border border-black/10" style={{ backgroundColor: colorOption.colorCode }} />
                    {getLocalizedColor(colorOption.color, lang)}
                    <span className="ml-auto text-[10px] font-normal text-neutral-500">
                      {colorQuantity > 0
                        ? localizeCopy('已选 {{RUDA_ARG_0}} 件', '{{RUDA_ARG_0}} selected', [String(colorQuantity)])
                        : localizeCopy('库存 {{RUDA_ARG_0}}', 'Stock {{RUDA_ARG_0}}', [String(colorStock)])}
                    </span>
                    <span aria-hidden="true" className="text-neutral-500">⌄</span>
                  </summary>
                  <div className="divide-y divide-neutral-100 border-t border-neutral-100">
                    {colorSkus.map(sku => {
                      const available = availableStock(sku);
                      const quantity = matrixQuantities[sku.sku] || 0;
                      return (
                        <div key={sku.sku} className="flex items-center justify-between gap-3 py-2">
                          <div className="min-w-0">
                            <p className="text-xs font-medium text-neutral-800">{getLocalizedSizeLabel(sku.size)}</p>
                            <p className="truncate font-mono text-[10px] text-neutral-500">{sku.sku}</p>
                            <p className="text-[10px] text-neutral-500">
                              {localizeCopy('现货 {{RUDA_ARG_0}} 件', '{{RUDA_ARG_0}} disponibili', [String(available)])}
                              {sku.allowBackorder !== false && quantity > available
                                ? localizeCopy(' · 订货 {{RUDA_ARG_0}} 件', ' · {{RUDA_ARG_0}} in riassortimento', [String(quantity - available)])
                                : ''}
                            </p>
                          </div>
                          <div className="inline-flex shrink-0 items-center overflow-hidden rounded-md border border-neutral-300">
                            <button
                              type="button"
                              onClick={() => handleQuantityChange(sku.sku, quantity - 1)}
                              disabled={quantity <= 0}
                              aria-label={`${getLocalizedColor(colorOption.color, lang)} ${getLocalizedSizeLabel(sku.size)} −`}
                              className="flex h-9 w-9 items-center justify-center text-neutral-700 disabled:opacity-30"
                            >
                              <Minus className="h-3.5 w-3.5" />
                            </button>
                            <input
                              type="number"
                              min="0"
                              max={available}
                              step="1"
                              inputMode="numeric"
                              disabled={available === 0}
                              value={quantity || ''}
                              onChange={event => handleQuantityChange(sku.sku, event.currentTarget.valueAsNumber || 0)}
                              aria-label={`${getLocalizedColor(colorOption.color, lang)} · ${getLocalizedSizeLabel(sku.size)}`}
                              className="h-9 w-12 border-x border-neutral-200 text-center text-xs tabular-nums outline-none disabled:bg-neutral-50"
                            />
                            <button
                              type="button"
                              onClick={() => handleQuantityChange(sku.sku, quantity + 1)}
                              disabled={quantity >= available}
                              aria-label={`${getLocalizedColor(colorOption.color, lang)} ${getLocalizedSizeLabel(sku.size)} +`}
                              className="flex h-9 w-9 items-center justify-center text-neutral-700 disabled:opacity-30"
                            >
                              <Plus className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </details>
              );
            })}
          </div>

        </section>
      )}

      {!isLocked && (
        <div className="fixed inset-x-0 bottom-[calc(4.25rem+env(safe-area-inset-bottom))] z-40 border-t border-neutral-200 bg-white/95 px-2 py-2 backdrop-blur lg:bottom-0 sm:px-3">
          <div className="mx-auto grid max-w-7xl grid-cols-3 gap-1.5 sm:gap-3">
            <p className="col-span-4 flex items-center justify-between px-1 text-[10px] text-neutral-500">
              <span>{localizeCopy('已选 {{RUDA_ARG_0}} 件', '{{RUDA_ARG_0}} selected', [String(totalSelectedQty)])}</span>
              <strong className="text-neutral-900">€{totalSelectedAmount.toFixed(2)}</strong>
            </p>
            <button type="button" onClick={openProductSupport} className="flex min-h-11 flex-col items-center justify-center gap-0.5 rounded-md text-[9px] font-semibold text-neutral-800 hover:bg-neutral-100 sm:flex-row sm:gap-1.5 sm:text-xs">
              <MessageCircle className="h-4 w-4" />
              <span>{localizeCopy('客服', 'Customer Service')}</span>
            </button>
            <button type="button" onClick={() => setCurrentView('cart')} aria-label={localizeCopy('购物车，全车共 {{RUDA_ARG_0}} 件', 'Cart, {{RUDA_ARG_0}} units total', [String(totalCartUnits)])} className="relative flex min-h-11 flex-col items-center justify-center gap-0.5 rounded-md text-[9px] font-semibold text-neutral-800 hover:bg-neutral-100 sm:flex-row sm:gap-1.5 sm:text-xs">
              <ShoppingCart className="h-4 w-4" />
              <span>{localizeCopy('购物车', 'Cart')}</span>
              <span className="absolute right-1 top-0.5 min-w-4 rounded-full bg-neutral-950 px-1 text-center text-[9px] leading-4 text-white">{totalCartUnits}</span>
              <span className="text-[8px] font-normal text-neutral-500">{localizeCopy('全车 {{RUDA_ARG_0}} 件', '{{RUDA_ARG_0}} units total', [String(totalCartUnits)])}</span>
            </button>
            <button type="button" onClick={handleBatchOrderAndOpenCart} disabled={!canOrderSelection} className="flex min-h-11 flex-col items-center justify-center gap-0.5 rounded-md bg-neutral-950 text-[9px] font-semibold text-white disabled:bg-neutral-300 sm:flex-row sm:gap-1.5 sm:text-xs">
              <span>{localizeCopy('提交订单', 'Submit order')}</span>
            </button>
          </div>
        </div>
      )}

      {/* 4. Vault Access Request Modal */}
      {showRequestModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <h3 className="font-bold text-neutral-900 text-base">
              {localizeCopy('申请专属商品查看与订货权限', 'Richiesta di Accesso al Campionario Riservato')}
            </h3>
            <p className="text-xs text-neutral-500 leading-relaxed">
              {localizeCopy("向【{{RUDA_ARG_0}}】申请查看该商户的授权专属款式。", "La richiesta verrà inviata direttamente alla direzione commerciale di {{RUDA_ARG_0}}.", [String(product.merchantName)])}
            </p>

            <form onSubmit={handleRequestSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">
                  {localizeCopy('采购意向说明 / 门店简介:', 'Note per il fornitore:')}
                </label>
                <textarea
                  rows={3}
                  value={requestNote}
                  onChange={(e) => setRequestNote(e.target.value)}
                  className="w-full bg-neutral-50 border border-neutral-200 rounded-lg p-2.5 text-xs text-neutral-900 focus:bg-white focus:outline-none"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowRequestModal(false)}
                  className="px-4 py-2 text-xs text-neutral-600 hover:text-black cursor-pointer font-medium"
                >
                  {localizeCopy('取消', 'Annulla')}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-black text-white text-xs font-bold rounded-lg hover:bg-neutral-800 cursor-pointer shadow-xs"
                >
                  {localizeCopy('提交申请', 'Invia Richiesta')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
