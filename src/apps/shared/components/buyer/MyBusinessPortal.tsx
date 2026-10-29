import React, { useEffect, useState, useMemo } from 'react';
import { 
  Building2, 
  Package, 
  RotateCcw, 
  Clock, 
  Truck, 
  CheckCircle2, 
  FileText, 
  Star, 
  ShoppingBag, 
  Search, 
  UploadCloud, 
  FileSpreadsheet, 
  Lock, 
  Unlock, 
  ChevronRight, 
  Plus, 
  Minus, 
  Download, 
  AlertTriangle, 
  ShieldCheck, 
  ArrowRight, 
  Sparkles, 
  X, 
  Eye, 
  ExternalLink,
  Printer,
  Check,
  Filter
  ,Languages
} from 'lucide-react';
import { useB2B } from '../../../../context/B2BContext';
import { Order, OrderStatus, Product, CartItem } from '../../../../types/b2b';
import { apiGet } from '../../../../api/client';
import { ReorderModal } from '../common/ReorderModal';
import { LanguagePicker } from '../common/LanguagePicker';

export const MyBusinessPortal: React.FC = () => {
  const { 
    currentCustomer, 
    orders, 
    products, 
    cart, 
    addToCart, 
    addMultipleToCart, 
    setCurrentView, 
    reorderHistoricOrder, 
    favorites, 
    toggleFavorite, 
    isFavorite,
    calculateCustomerPrice,
    activeBuyerTab,
    setActiveBuyerTab,
    hasVaultAccess,
    requestVaultAccess,
    getVaultStatus,
    merchants,
    addNotification,
    lang,
    t, localizeCopy
  } = useB2B();

  const isIt = lang === 'it';

  // Active Tab state
  const activeTab = activeBuyerTab;
  const setActiveTab = setActiveBuyerTab;

  // Selected Order for Modal/Detail
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(orders.length > 0 ? orders[0].id : null);
  const selectedOrder = orders.find(o => o.id === selectedOrderId) || (orders.length > 0 ? orders[0] : null);
  const [showOrderDetailModal, setShowOrderDetailModal] = useState<boolean>(false);
  const [orderFilter, setOrderFilter] = useState<'all' | 'pending' | 'shipped' | 'delivered'>('all');

  // Tracking Modal
  const [trackingOrder, setTrackingOrder] = useState<Order | null>(null);
  const [trackingShipments, setTrackingShipments] = useState<Array<{
    id: string;
    shipmentNo: string;
    carrier?: string | null;
    trackingNumber?: string | null;
    status: string;
    trackingEvents: Array<{ id: string; status: string; location?: string | null; description?: string | null; occurredAt: string }>;
  }>>([]);
  const [trackingLoading, setTrackingLoading] = useState(false);

  useEffect(() => {
    if (!trackingOrder) {
      setTrackingShipments([]);
      return;
    }
    let active = true;
    setTrackingLoading(true);
    void apiGet<{ success: true; shipments: typeof trackingShipments }>(`/api/orders/${encodeURIComponent(trackingOrder.id)}/shipments`)
      .then(result => { if (active) setTrackingShipments(result.shipments); })
      .catch(error => {
        if (active) addNotification('warning', '物流轨迹读取失败', error instanceof Error ? error.message : '请稍后重试');
      })
      .finally(() => { if (active) setTrackingLoading(false); });
    return () => { active = false; };
  }, [trackingOrder?.id]);

  // Smart Size Ratio Modal state
  const [ratioProduct, setRatioProduct] = useState<Product | null>(null);
  const [ratioQuantities, setRatioQuantities] = useState<{ [size: string]: number }>({
    'S': 2,
    'M': 4,
    'L': 4,
    'XL': 2
  });
  const [selectedColorIndex, setSelectedColorIndex] = useState<number>(0);

  // Upload Order State
  const [uploadText, setUploadText] = useState<string>('');
  const [isProcessingUpload, setIsProcessingUpload] = useState<boolean>(false);
  const [parsedItems, setParsedItems] = useState<Array<{
    rawLine: string;
    styleNo: string;
    productName: string;
    matchedProduct?: Product;
    color: string;
    size: string;
    quantity: number;
    unitPrice: number;
    subtotal: number;
    matched: boolean;
  }> | null>(null);
  const [unmatchedReplacements, setUnmatchedReplacements] = useState<{ [key: string]: Product }>({});
  const [showReplacementModal, setShowReplacementModal] = useState<{ rawLine: string; requestedStyle: string } | null>(null);

  // 1-Click Reorder Safety Check Modal
  const [reorderCheckOrder, setReorderCheckOrder] = useState<Order | null>(null);
  const [showReorderNotice, setShowReorderNotice] = useState<boolean>(false);

  // Company Profile Request Change Modal
  const [showRequestChangeModal, setShowRequestChangeModal] = useState<boolean>(false);
  const [changeField, setChangeField] = useState<string>('VAT Number & Billing Address');
  const [changeNotes, setChangeNotes] = useState<string>('');
  const [changeSubmitted, setChangeSubmitted] = useState<boolean>(false);

  // Shop quick search & category
  const [catalogSearch, setCatalogSearch] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Filtered orders
  const filteredOrders = useMemo(() => {
    if (orderFilter === 'all') return orders;
    if (orderFilter === 'pending') {
      return orders.filter(o => o.status === 'placed' || o.status === 'confirmed');
    }
    if (orderFilter === 'shipped') {
      return orders.filter(o => o.status === 'shipped' || o.status === 'picking');
    }
    if (orderFilter === 'delivered') {
      return orders.filter(o => o.status === 'delivered');
    }
    return orders;
  }, [orders, orderFilter]);

  // Status counts for Dashboard
  const pendingOrdersCount = orders.filter(o => o.status === 'placed' || o.status === 'confirmed').length;
  const shippingOrdersCount = orders.filter(o => o.status === 'picking' || o.status === 'shipped').length;
  const deliveredOrdersCount = orders.filter(o => o.status === 'delivered').length;
  const privateMerchantCount = new Set(
    products
      .filter(product => product.visibility === 'private' && product.merchantId && hasVaultAccess(product.merchantId))
      .map(product => product.merchantId)
  ).size;

  // Filtered products for quick catalog
  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      // Exclude private products if not authorized
      if (p.visibility === 'private' && p.merchantId && !hasVaultAccess(p.merchantId)) {
        return false;
      }
      const matchesSearch = !catalogSearch.trim() || 
        p.styleNo.toLowerCase().includes(catalogSearch.toLowerCase()) ||
        p.name.toLowerCase().includes(catalogSearch.toLowerCase());
      const matchesCat = selectedCategory === 'all' || p.category === selectedCategory;
      return matchesSearch && matchesCat;
    });
  }, [products, catalogSearch, selectedCategory, hasVaultAccess]);

  // Smart ratio calculations
  const totalRatioQty: number = (Object.values(ratioQuantities) as number[]).reduce((a: number, b: number) => a + Number(b), 0);
  const ratioUnitPrice: number = ratioProduct ? calculateCustomerPrice(ratioProduct.wholesalePrice) : 0;
  const totalRatioPrice: number = totalRatioQty * ratioUnitPrice;

  const handleRatioQtyChange = (size: string, delta: number) => {
    setRatioQuantities(prev => ({
      ...prev,
      [size]: Math.max(0, (prev[size] || 0) + delta)
    }));
  };

  const applyRatioPreset = (preset: 'standard' | 'even' | 'plus_size') => {
    if (!ratioProduct) return;
    const moq = ratioProduct.moq || 12;
    if (preset === 'standard') {
      // 1:2:2:1 ratio normalized to MOQ
      setRatioQuantities({
        'S': Math.max(1, Math.round(moq * (2 / 12))),
        'M': Math.max(2, Math.round(moq * (4 / 12))),
        'L': Math.max(2, Math.round(moq * (4 / 12))),
        'XL': Math.max(1, Math.round(moq * (2 / 12)))
      });
    } else if (preset === 'even') {
      const perSize = Math.max(1, Math.floor(moq / 4));
      setRatioQuantities({
        'S': perSize,
        'M': perSize,
        'L': perSize,
        'XL': moq - (perSize * 3)
      });
    } else {
      setRatioQuantities({
        'S': 1,
        'M': 3,
        'L': 5,
        'XL': Math.max(2, moq - 9)
      });
    }
  };

  const handleConfirmAddRatioToCart = () => {
    if (!ratioProduct) return;
    if (totalRatioQty < ratioProduct.moq) {
      addNotification('warning', '未满足起订量', `该款式最低起订量 (MOQ) 为 ${ratioProduct.moq} 件，当前已选 ${totalRatioQty} 件`);
      return;
    }

    const colorItem = ratioProduct.skus[selectedColorIndex] || ratioProduct.skus[0];
    const itemsToAdd: Array<Omit<CartItem, 'id'>> = [];

    Object.entries(ratioQuantities).forEach(([size, rawQty]) => {
      const qty = Number(rawQty);
      if (qty > 0) {
        itemsToAdd.push({
          productId: ratioProduct.id,
          styleNo: ratioProduct.styleNo,
          productName: ratioProduct.name,
          image: ratioProduct.images[0],
          sku: `${ratioProduct.styleNo}-${colorItem?.color || 'BLK'}-${size}`,
          color: colorItem?.color || '默认色',
          size,
          quantity: qty,
          unitPrice: calculateCustomerPrice(ratioProduct.wholesalePrice),
          packSize: ratioProduct.packSize
        });
      }
    });

    addMultipleToCart(itemsToAdd);
    setRatioProduct(null);
    addNotification('success', '配码装车成功', `已将 ${ratioProduct.styleNo} 智能配码合计 ${totalRatioQty} 件加入采购车`);
  };

  // Upload Order Parser Logic
  const handleParseUploadOrder = (sampleText?: string) => {
    setIsProcessingUpload(true);
    const textToProcess = sampleText !== undefined ? sampleText : uploadText;

    setTimeout(() => {
      const lines = textToProcess.split('\n').map(l => l.trim()).filter(l => l.length > 0);
      const results: Array<{
        rawLine: string;
        styleNo: string;
        productName: string;
        matchedProduct?: Product;
        color: string;
        size: string;
        quantity: number;
        unitPrice: number;
        subtotal: number;
        matched: boolean;
      }> = [];

      lines.forEach(line => {
        // Simple token parser: [StyleNo] [Color] [Size] [Qty] or similar
        const tokens = line.split(/[\s,\t|]+/);
        const styleToken = tokens[0]?.toUpperCase() || '';
        const colorToken = tokens[1]?.toUpperCase() || 'BLACK';
        const sizeToken = tokens[2]?.toUpperCase() || 'M';
        const qtyToken = parseInt(tokens[3] || tokens[tokens.length - 1], 10) || 6;

        // Match against existing products
        const matched = products.find(p => 
          p.styleNo.toUpperCase().includes(styleToken) || 
          styleToken.includes(p.styleNo.toUpperCase().replace(/[^A-Z0-9]/g, ''))
        );

        if (matched) {
          const unitP = calculateCustomerPrice(matched.wholesalePrice);
          results.push({
            rawLine: line,
            styleNo: matched.styleNo,
            productName: matched.name,
            matchedProduct: matched,
            color: colorToken,
            size: sizeToken,
            quantity: qtyToken,
            unitPrice: unitP,
            subtotal: unitP * qtyToken,
            matched: true
          });
        } else {
          // Unmatched / Ambiguous line
          results.push({
            rawLine: line,
            styleNo: styleToken || 'UNKNOWN-SKU',
            productName: '未在系统现货库中找到匹配款',
            matchedProduct: undefined,
            color: colorToken,
            size: sizeToken,
            quantity: qtyToken,
            unitPrice: 0,
            subtotal: 0,
            matched: false
          });
        }
      });

      setParsedItems(results);
      setIsProcessingUpload(false);
      addNotification('info', '采购单识别完成', `成功识别 ${results.length} 行数据，请核对配码与小计`);
    }, 600);
  };

  const handleApplyReplacement = (rawLine: string, replacementProduct: Product) => {
    if (!parsedItems) return;
    const unitP = calculateCustomerPrice(replacementProduct.wholesalePrice);
    const updated = parsedItems.map(item => {
      if (item.rawLine === rawLine) {
        return {
          ...item,
          styleNo: replacementProduct.styleNo,
          productName: `${replacementProduct.name} (已人工指定替换)`,
          matchedProduct: replacementProduct,
          unitPrice: unitP,
          subtotal: unitP * item.quantity,
          matched: true
        };
      }
      return item;
    });
    setParsedItems(updated);
    setShowReplacementModal(null);
    addNotification('success', '款式替换成功', `已将 ${rawLine} 替换为 ${replacementProduct.styleNo}`);
  };

  const handleAddAllParsedToCart = () => {
    if (!parsedItems) return;
    const validItems = parsedItems.filter(p => p.matched && p.matchedProduct);
    if (validItems.length === 0) {
      addNotification('warning', '无有效款式', '请先替换或确认有效款号');
      return;
    }

    const itemsToAdd: Array<Omit<CartItem, 'id'>> = validItems.map(item => {
      const prod = item.matchedProduct!;
      return {
        productId: prod.id,
        styleNo: prod.styleNo,
        productName: prod.name,
        image: prod.images[0],
        sku: `${prod.styleNo}-${item.color}-${item.size}`,
        color: item.color,
        size: item.size,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        packSize: prod.packSize
      };
    });

    addMultipleToCart(itemsToAdd);
    setCurrentView('cart');
    addNotification('success', '采购单全量装车', `已成功将 ${validItems.length} 行清单装入采购车，可直接结算`);
  };

  // Reorder Trigger
  const handleTriggerReorder = (order: Order) => {
    setReorderCheckOrder(order);
    setShowReorderNotice(true);
  };

  const handleConfirmReorderAction = () => {
    if (!reorderCheckOrder) return;
    reorderHistoricOrder(reorderCheckOrder.id);
    setShowReorderNotice(false);
  };

  return (
    <div id="my-business-portal" className="max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-5 sm:space-y-6">
      {/* Top Banner: Minimalist, High-Efficiency Luxury Header */}
      <div className="bg-neutral-900 text-white rounded-2xl p-4 sm:p-6 shadow-md border border-neutral-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1 sm:space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-amber-400 text-neutral-950 text-[10px] font-black tracking-wider uppercase flex items-center gap-1">
              {localizeCopy('采购商专属中心', 'Area Riservata B2B')}
            </span>
            <span className="text-xs text-neutral-400 font-mono">
              ID: {currentCustomer?.id || 'VIP-BUYER'}
            </span>
            <span className="hidden sm:inline text-neutral-600">|</span>
            <span className="text-xs text-amber-300 font-medium">
              {currentCustomer?.tier === 'tier_major' 
                ? (localizeCopy('战略级大买家 (82.5折)', 'Partner Strategico (Sconto 17.5%)'))
                : (localizeCopy('VIP 买手店 (9折 · Net 30)', 'Rivenditore VIP (Sconto 10% · Net 30)'))}
            </span>
          </div>
          <h1 className="text-lg sm:text-2xl font-bold font-serif tracking-tight text-white flex items-center gap-2">
            {localizeCopy("欢迎回来，{{RUDA_ARG_0}}", "Benvenuto, {{RUDA_ARG_0}}", [String(currentCustomer?.companyName || 'ABC Boutique Paris')])} 👋
          </h1>
          <p className="text-xs text-neutral-400 flex flex-wrap items-center gap-x-3 gap-y-1">
            <span>{localizeCopy('负责人:', 'Referente:')} <strong className="text-white">{currentCustomer?.contactPerson || 'Sophie Martin'}</strong></span>
            <span>{localizeCopy('税号:', 'P. IVA:')} <strong className="font-mono text-white">{currentCustomer?.vatNumber || 'FR89283746192'}</strong></span>
            <span>{localizeCopy('收货地:', 'Destinazione:')} <strong className="text-white">{currentCustomer?.city || 'Paris'}, {currentCustomer?.country || 'France'}</strong></span>
          </p>
        </div>

        {/* Top Direct Action: Start Buying */}
        <div className="flex items-center gap-2 w-full md:w-auto shrink-0">
          <button
            id="mybusiness-quick-start-buying"
            onClick={() => setActiveTab('shop')}
            className="flex-1 md:flex-initial px-4 py-2.5 bg-white hover:bg-neutral-100 text-neutral-950 font-bold text-xs rounded-xl shadow-sm transition-transform active:scale-95 cursor-pointer flex items-center justify-center gap-2 min-h-[44px]"
          >
            <ShoppingBag className="w-4 h-4 text-neutral-900" />
            <span>{localizeCopy('开始采购', 'Catalogo Prodotti')}</span>
          </button>
          <button
            id="mybusiness-quick-upload-po"
            onClick={() => setActiveTab('upload_order')}
            className="px-3.5 py-2.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-medium text-xs rounded-xl border border-neutral-700 transition-colors cursor-pointer flex items-center justify-center gap-1.5 min-h-[44px]"
            title={localizeCopy('上传采购单', 'Importa Ordine')}
          >
            <UploadCloud className="w-4 h-4 text-neutral-300" />
            <span className="hidden sm:inline">{localizeCopy('上传采购单', 'Importa Ordine')}</span>
          </button>
        </div>
      </div>

      {/* The 7 Core Navigation Tabs: Clean, Minimalist */}
      <div className="bg-white border border-neutral-200 rounded-xl p-1.5 shadow-2xs overflow-x-auto flex items-center gap-1 scrollbar-none">
        {[
          { key: 'dashboard', label: localizeCopy('概览', 'Panoramica'), icon: Sparkles },
          { key: 'shop', label: localizeCopy('现货商城', 'Catalogo All\'ingrosso'), icon: ShoppingBag },
          { key: 'upload_order', label: localizeCopy('批量报单', 'Import Rapido'), icon: FileSpreadsheet, badge: isIt ? 'CSV' : '批量导入' },
          { key: 'orders', label: localizeCopy('我的订单', 'I Miei Ordini'), icon: Package, count: orders.length },
          { key: 'favorites', label: localizeCopy('收藏款式', 'Salvati'), icon: Star, count: favorites.length },
          { key: 'company', label: localizeCopy('企业资料', 'Dati Azienda'), icon: Building2 },
          { key: 'private_vault', label: localizeCopy('私密新品', 'Capsule Riservate'), icon: Lock, badge: localizeCopy('独家', 'Riservato') }
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              id={`buyer-tab-${tab.key}`}
              onClick={() => setActiveTab(tab.key as any)}
              className={`shrink-0 px-3 sm:px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer min-h-[40px] whitespace-nowrap ${
                isActive 
                  ? 'bg-neutral-900 text-white shadow-xs' 
                  : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-neutral-400'}`} />
              <span>{tab.label}</span>
              {tab.badge && (
                <span className={`text-[10px] px-1.5 py-0.2 rounded font-bold ${
                  isActive ? 'bg-amber-400 text-neutral-950' : 'bg-neutral-100 text-neutral-600 border border-neutral-200'
                }`}>
                  {tab.badge}
                </span>
              )}
              {tab.count !== undefined && tab.count > 0 && (
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                  isActive ? 'bg-neutral-700 text-white' : 'bg-neutral-100 text-neutral-500'
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ========================================================================= */}
      {/* 1. 🏠 首页 Dashboard */}
      {/* ========================================================================= */}
      {activeTab === 'dashboard' && (
        <div className="space-y-6">
          {/* 4 Core Status Cards requested by user */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <div 
              onClick={() => { setOrderFilter('pending'); setActiveTab('orders'); }}
              className="bg-white border border-neutral-200 hover:border-neutral-400 p-4 rounded-xl cursor-pointer transition-all shadow-2xs hover:shadow-xs group"
            >
              <div className="flex items-center justify-between text-neutral-500 text-xs mb-2">
                <span className="font-medium">待处理订单</span>
                <Clock className="w-4 h-4 text-amber-500" />
              </div>
              <div className="text-2xl sm:text-3xl font-bold font-serif text-neutral-900 group-hover:text-black">
                {pendingOrdersCount}
              </div>
              <p className="text-[11px] text-neutral-400 mt-1 flex items-center gap-1">
                <span>商家正在核实与确认</span>
                <ChevronRight className="w-3 h-3 text-neutral-400 group-hover:translate-x-0.5 transition-transform" />
              </p>
            </div>

            <div 
              onClick={() => { setOrderFilter('shipped'); setActiveTab('orders'); }}
              className="bg-white border border-neutral-200 hover:border-neutral-400 p-4 rounded-xl cursor-pointer transition-all shadow-2xs hover:shadow-xs group"
            >
              <div className="flex items-center justify-between text-neutral-500 text-xs mb-2">
                <span className="font-medium">待发货 / 配货中</span>
                <Package className="w-4 h-4 text-blue-500" />
              </div>
              <div className="text-2xl sm:text-3xl font-bold font-serif text-neutral-900 group-hover:text-black">
                {shippingOrdersCount}
              </div>
              <p className="text-[11px] text-neutral-400 mt-1 flex items-center gap-1">
                <span>普拉托总仓拣货打包中</span>
                <ChevronRight className="w-3 h-3 text-neutral-400 group-hover:translate-x-0.5 transition-transform" />
              </p>
            </div>

            <div 
              onClick={() => { setOrderFilter('delivered'); setActiveTab('orders'); }}
              className="bg-white border border-neutral-200 hover:border-neutral-400 p-4 rounded-xl cursor-pointer transition-all shadow-2xs hover:shadow-xs group"
            >
              <div className="flex items-center justify-between text-neutral-500 text-xs mb-2">
                <span className="font-medium">已完成订单</span>
                <Truck className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="text-2xl sm:text-3xl font-bold font-serif text-neutral-900 group-hover:text-black">
                {deliveredOrdersCount}
              </div>
              <p className="text-[11px] text-neutral-400 mt-1 flex items-center gap-1">
                <span>已完成并可查看订单记录</span>
                <ChevronRight className="w-3 h-3 text-neutral-400 group-hover:translate-x-0.5 transition-transform" />
              </p>
            </div>

            <div 
              onClick={() => setActiveTab('private_vault')}
              className="bg-gradient-to-br from-neutral-900 to-neutral-800 text-white p-4 rounded-xl cursor-pointer transition-all shadow-xs group"
            >
              <div className="flex items-center justify-between text-amber-400 text-xs mb-2">
                <span className="font-bold flex items-center gap-1">
                  <Lock className="w-3.5 h-3.5" />
                  私密新品 🔒
                </span>
                <span className="text-[10px] bg-amber-400 text-neutral-950 px-1.5 py-0.2 rounded font-black">独家款</span>
              </div>
              <div className="text-xl sm:text-2xl font-bold font-serif text-white">
                {privateMerchantCount} 个商家有授权新品
              </div>
              <p className="text-[11px] text-neutral-300 mt-1 flex items-center gap-1">
                <span>NEW FW26 原创爆款保护</span>
                <ChevronRight className="w-3 h-3 text-amber-400 group-hover:translate-x-0.5 transition-transform" />
              </p>
            </div>
          </div>

          {/* Quick Action Grid (Mobile-First 4 Large Touch Targets) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <button
              onClick={() => setActiveTab('upload_order')}
              className="p-4 bg-white border border-neutral-200 hover:border-black rounded-xl text-left transition-all cursor-pointer flex items-center gap-3.5 group shadow-2xs"
            >
              <div className="w-10 h-10 rounded-lg bg-neutral-100 flex items-center justify-center shrink-0 group-hover:bg-black group-hover:text-white transition-colors">
                <FileSpreadsheet className="w-5 h-5 text-neutral-700 group-hover:text-white" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-neutral-900">上传采购单 (Upload PO)</p>
                <p className="text-[11px] text-neutral-500 truncate">拖入 Excel / 拍照 OCR 识别</p>
              </div>
            </button>

            <button
              onClick={() => setActiveTab('shop')}
              className="p-4 bg-white border border-neutral-200 hover:border-black rounded-xl text-left transition-all cursor-pointer flex items-center gap-3.5 group shadow-2xs"
            >
              <div className="w-10 h-10 rounded-lg bg-neutral-100 flex items-center justify-center shrink-0 group-hover:bg-black group-hover:text-white transition-colors">
                <Sparkles className="w-5 h-5 text-neutral-700 group-hover:text-white" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-neutral-900">智能配码快速选款</p>
                <p className="text-[11px] text-neutral-500 truncate">S:2 M:4 L:4 XL:2 经典配比</p>
              </div>
            </button>

            <button
              onClick={() => setActiveTab('orders')}
              className="p-4 bg-white border border-neutral-200 hover:border-black rounded-xl text-left transition-all cursor-pointer flex items-center gap-3.5 group shadow-2xs"
            >
              <div className="w-10 h-10 rounded-lg bg-neutral-100 flex items-center justify-center shrink-0 group-hover:bg-black group-hover:text-white transition-colors">
                <Truck className="w-5 h-5 text-neutral-700 group-hover:text-white" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-neutral-900">全欧物流实时轨迹</p>
                <p className="text-[11px] text-neutral-500 truncate">DHL/Bartolini 运单与装箱单</p>
              </div>
            </button>
          </div>

          {/* Quick Active Order / Recent Track Banner */}
          {orders.length > 0 && (
            <div className="bg-white border border-neutral-200 rounded-xl p-4 sm:p-5 shadow-2xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span className="text-xs font-bold text-neutral-900">最近活跃订单 #{orders[0].orderNo}</span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-neutral-100 text-neutral-800 border border-neutral-200">
                    {orders[0].status === 'shipped' ? '已由 DHL 发往巴黎' : orders[0].status === 'picking' ? '仓库正在打包' : '已确认待分拨'}
                  </span>
                </div>
                <p className="text-xs text-neutral-500">
                  共计 {orders[0].items.reduce((s, i) => s + i.quantity, 0)} 件 · 采购总额 €{orders[0].totalAmount.toFixed(2)} · 运单号: <span className="font-mono text-neutral-800 font-bold">{orders[0].trackingNumber || 'DHL-IT-992019482'}</span>
                </p>
              </div>

              <div className="flex items-center gap-2 w-full md:w-auto">
                <button
                  onClick={() => setTrackingOrder(orders[0])}
                  className="flex-1 md:flex-initial px-3.5 py-2 bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Truck className="w-3.5 h-3.5 text-neutral-300" />
                  <span>追踪物流</span>
                </button>
                <button
                  onClick={() => handleTriggerReorder(orders[0])}
                  className="px-3 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 text-xs font-semibold rounded-lg border border-neutral-300 transition-colors cursor-pointer flex items-center justify-center gap-1"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-neutral-600" />
                  <span>一键补货</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. 🛍 采购商城 (Shop with Smart Ratio) */}
      {/* ========================================================================= */}
      {activeTab === 'shop' && (
        <div className="space-y-4">
          {/* Search & Category Filter Bar */}
          <div className="bg-white border border-neutral-200 rounded-xl p-3 sm:p-4 shadow-2xs space-y-3">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={catalogSearch}
                  onChange={(e) => setCatalogSearch(e.target.value)}
                  placeholder="搜索款号 (例: DRS-2026-0088, 外套, 针织衫)..."
                  className="w-full pl-9 pr-3 py-2 bg-neutral-50 border border-neutral-200 rounded-lg text-xs text-neutral-900 placeholder-neutral-400 focus:outline-none focus:bg-white focus:border-black"
                />
                {catalogSearch && (
                  <button 
                    onClick={() => setCatalogSearch('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Category Pills */}
              <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
                {[
                  { id: 'all', label: '全部' },
                  { id: 'women', label: '女装' },
                  { id: 'men', label: '男装' },
                  { id: 'shoes', label: '鞋履' },
                  { id: 'bags', label: '包袋' },
                  { id: 'accessories', label: '配饰' }
                ].map(cat => (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium shrink-0 cursor-pointer transition-colors ${
                      selectedCategory === cat.id
                        ? 'bg-neutral-900 text-white font-bold'
                        : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Product Cards List */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
            {filteredProducts.map(product => {
              const customerPrice = calculateCustomerPrice(product.wholesalePrice);
              const isFav = isFavorite(product.id);

              return (
                <div 
                  key={product.id}
                  className="bg-white border border-neutral-200 hover:border-neutral-400 rounded-xl overflow-hidden shadow-2xs hover:shadow-xs transition-all flex flex-col justify-between"
                >
                  <div className="relative aspect-4/3 bg-neutral-100 overflow-hidden">
                    <img
                      src={product.images[0]}
                      alt={product.name}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute top-2 left-2 flex items-center gap-1">
                      <span className="px-2 py-0.5 bg-black/75 backdrop-blur-xs text-white text-[10px] font-mono font-bold rounded">
                        {product.styleNo}
                      </span>
                      {product.visibility === 'private' && (
                        <span className="px-1.5 py-0.5 bg-amber-400 text-neutral-950 text-[10px] font-black rounded flex items-center gap-0.5">
                          <Lock className="w-2.5 h-2.5" /> 私密
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => toggleFavorite(product.id)}
                      className={`absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center backdrop-blur-xs transition-colors cursor-pointer ${
                        isFav ? 'bg-amber-400 text-neutral-950' : 'bg-white/80 text-neutral-600 hover:bg-white'
                      }`}
                      title={isFav ? '已收藏' : '加入收藏'}
                    >
                      <Star className="w-3.5 h-3.5 fill-current" />
                    </button>
                  </div>

                  <div className="p-3 space-y-2 flex-1 flex flex-col justify-between">
                    <div>
                      <p className="text-[11px] text-neutral-400 font-medium truncate">{product.brand} · {product.origin}</p>
                      <h3 className="text-xs font-bold text-neutral-900 line-clamp-1">{product.name}</h3>
                    </div>

                    <div className="pt-1 border-t border-neutral-100 flex items-end justify-between">
                      <div>
                        <div className="text-[10px] text-neutral-500">
                          MOQ: <strong className="text-neutral-800">{product.moq}件起</strong>
                        </div>
                        <div className="text-sm font-bold text-neutral-900 font-serif">
                          €{customerPrice.toFixed(2)}
                          <span className="text-[10px] font-sans font-normal text-neutral-400 ml-1">/件</span>
                        </div>
                      </div>

                      {/* Smart Ratio Add to Cart Button */}
                      <button
                        onClick={() => {
                          setRatioProduct(product);
                          applyRatioPreset('standard');
                        }}
                        className="px-2.5 py-1.5 bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer flex items-center gap-1 shadow-2xs"
                      >
                        <Sparkles className="w-3 h-3 text-amber-300" />
                        <span>快速配码</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. 📄 我的采购单 (UPLOAD ORDER - 核心特色功能) */}
      {/* ========================================================================= */}
      {activeTab === 'upload_order' && (
        <div className="space-y-6">
          {/* Header Description */}
          <div className="bg-white border border-neutral-200 rounded-xl p-4 sm:p-6 shadow-2xs space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-neutral-100 pb-4">
              <div>
                <h2 className="text-base font-bold text-neutral-900 flex items-center gap-2">
                  <UploadCloud className="w-5 h-5 text-neutral-800" />
                  上传采购单 (Upload Order)
                </h2>
                <p className="text-xs text-neutral-500 mt-0.5">
                  支持拖入 Excel / CSV / PDF / 手机拍照 OCR 识别 / 供应商款号清单粘贴，系统自动匹配 SKU 与批发价
                </p>
              </div>

            </div>

            {/* Drag & Drop Upload Zone */}
            <div className="border-2 border-dashed border-neutral-300 hover:border-black rounded-xl p-6 sm:p-8 text-center transition-colors bg-neutral-50 hover:bg-white flex flex-col items-center justify-center gap-3">
              <div className="w-12 h-12 rounded-full bg-neutral-200/80 flex items-center justify-center">
                <FileSpreadsheet className="w-6 h-6 text-neutral-700" />
              </div>
              <div className="space-y-1">
                <p className="text-xs font-bold text-neutral-900">
                  拖入文件至此区域，或点击浏览文件
                </p>
                <p className="text-[11px] text-neutral-500">
                  支持 Excel (.xlsx, .xls), CSV, PDF 格式清单，以及手机拍照采购单 (.jpg, .png)
                </p>
              </div>

            </div>

            {/* Text Paste Box */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <label className="font-bold text-neutral-800">直接粘贴采购清单文本 (格式: 款号 颜色 尺码 数量):</label>
                <span className="text-neutral-400 text-[11px]">每行一个规格</span>
              </div>
              <textarea
                value={uploadText}
                onChange={(e) => setUploadText(e.target.value)}
                placeholder="例如:&#10;DRS-2026-0088   BLACK   M    12&#10;DRS-2026-0088   BLACK   L     8&#10;TOP-2026-0104   BEIGE   M     6&#10;JKT-2026-0312   BLACK   XL    4"
                rows={4}
                className="w-full p-3 bg-neutral-50 border border-neutral-200 rounded-xl font-mono text-xs text-neutral-900 focus:bg-white focus:outline-none focus:border-black"
              />

              <div className="flex justify-end gap-2 pt-1">
                <button
                  onClick={() => handleParseUploadOrder()}
                  disabled={isProcessingUpload || !uploadText.trim()}
                  className="px-5 py-2.5 bg-neutral-900 hover:bg-black text-white text-xs font-bold rounded-xl transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-2 min-h-[42px]"
                >
                  {isProcessingUpload ? (
                    <span>正在识别比对款号...</span>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                      <span>解析采购单并匹配现货</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Parsed Results Section */}
          {parsedItems && (
            <div className="bg-white border border-neutral-200 rounded-xl p-4 sm:p-6 shadow-2xs space-y-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-neutral-100 pb-3">
                <div>
                  <h3 className="text-sm font-bold text-neutral-900 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    已完成识别清单 ({parsedItems.length} 行)
                  </h3>
                  <p className="text-xs text-neutral-500">
                    共识别 {parsedItems.filter(p => p.matched).reduce((s, i) => s + i.quantity, 0)} 件 · 合计金额 €{parsedItems.filter(p => p.matched).reduce((s, i) => s + i.subtotal, 0).toFixed(2)}
                  </p>
                </div>

                <button
                  onClick={handleAddAllParsedToCart}
                  className="w-full sm:w-auto px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer flex items-center justify-center gap-2 min-h-[42px]"
                >
                  <ShoppingBag className="w-4 h-4" />
                  <span>一键加入采购车 (Add to Cart)</span>
                </button>
              </div>

              {/* Items List */}
              <div className="divide-y divide-neutral-100 border border-neutral-200 rounded-xl overflow-hidden">
                {parsedItems.map((item, idx) => (
                  <div key={idx} className="p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-neutral-50 transition-colors">
                    <div className="flex items-start sm:items-center gap-3">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-xs font-bold ${
                        item.matched ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-800'
                      }`}>
                        {item.matched ? '✓' : '!'}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-xs text-neutral-900">{item.styleNo}</span>
                          <span className="px-1.5 py-0.2 rounded bg-neutral-100 text-neutral-700 text-[10px] font-medium">
                            {item.color}
                          </span>
                          <span className="px-1.5 py-0.2 rounded bg-neutral-100 text-neutral-700 text-[10px] font-medium">
                            尺码: {item.size}
                          </span>
                        </div>
                        <p className={`text-xs mt-0.5 ${item.matched ? 'text-neutral-600' : 'text-amber-700 font-medium'}`}>
                          {item.productName}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-4 pl-9 sm:pl-0">
                      <div className="text-right">
                        <span className="text-xs font-bold text-neutral-900">{item.quantity} 件</span>
                        {item.matched && (
                          <div className="text-[11px] text-neutral-500 font-mono">
                            €{item.unitPrice.toFixed(2)}/件 = €{item.subtotal.toFixed(2)}
                          </div>
                        )}
                      </div>

                      {!item.matched && (
                        <button
                          onClick={() => setShowReplacementModal({ rawLine: item.rawLine, requestedStyle: item.styleNo })}
                          className="px-2.5 py-1.5 bg-neutral-900 text-white text-[11px] font-bold rounded-lg hover:bg-neutral-800 cursor-pointer"
                        >
                          人工选择商品
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. 📦 我的订单 (My Orders) */}
      {/* ========================================================================= */}
      {activeTab === 'orders' && (
        <div className="space-y-4">
          {/* Order Status Filter: Only 4 Clean Options as requested */}
          <div className="bg-white border border-neutral-200 rounded-xl p-2 sm:p-3 shadow-2xs flex items-center justify-between gap-2 overflow-x-auto">
            <div className="flex items-center gap-1">
              {[
                { id: 'all', label: '全部订单 (ALL)' },
                { id: 'pending', label: '待处理' },
                { id: 'shipped', label: '发货中' },
                { id: 'delivered', label: '已完成' }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setOrderFilter(tab.id as any)}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors whitespace-nowrap ${
                    orderFilter === tab.id
                      ? 'bg-neutral-900 text-white'
                      : 'text-neutral-600 hover:bg-neutral-100'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <span className="text-xs text-neutral-400 font-mono px-2 hidden sm:inline">
              共 {filteredOrders.length} 笔订单
            </span>
          </div>

          {/* Orders List */}
          <div className="space-y-3">
            {filteredOrders.map(order => {
              const totalItemsCount = order.items.reduce((sum, item) => sum + item.quantity, 0);

              return (
                <div
                  key={order.id}
                  className="bg-white border border-neutral-200 hover:border-neutral-400 rounded-xl p-4 sm:p-5 shadow-2xs transition-all space-y-4"
                >
                  {/* Order Card Top Info */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-neutral-100 pb-3">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-sm text-neutral-900">
                        #{order.orderNo}
                      </span>
                      <span className="text-neutral-300">·</span>
                      <span className="text-xs text-neutral-500">
                        {order.createdAt ? order.createdAt.substring(0, 10) : '2026-03-12'}
                      </span>
                      <span className="text-neutral-300">·</span>
                      <span className="text-xs font-bold text-neutral-900 font-serif">
                        €{order.totalAmount.toFixed(2)}
                      </span>
                      <span className="text-neutral-300">·</span>
                      <span className="text-xs text-neutral-600">
                        {totalItemsCount} items
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                        order.status === 'delivered'
                          ? 'bg-emerald-100 text-emerald-800'
                          : order.status === 'shipped'
                          ? 'bg-blue-100 text-blue-800'
                          : order.status === 'picking'
                          ? 'bg-amber-100 text-amber-900'
                          : 'bg-neutral-100 text-neutral-800'
                      }`}>
                        {order.status === 'delivered' ? '已签收' : order.status === 'shipped' ? '已发货' : order.status === 'picking' ? '仓库配货中' : '已接单确认'}
                      </span>
                    </div>
                  </div>

                  {/* 5-Step Order Progress Timeline as requested */}
                  <div className="py-2">
                    <div className="grid grid-cols-5 gap-1 text-center">
                      {[
                        { label: 'Order Received', active: true, step: 'received' },
                        { label: 'Confirmed', active: order.status !== 'placed', step: 'confirmed' },
                        { label: 'Picking', active: order.status === 'picking' || order.status === 'shipped' || order.status === 'delivered', step: 'picking' },
                        { label: 'Shipped', active: order.status === 'shipped' || order.status === 'delivered', step: 'shipped' },
                        { label: 'Delivered', active: order.status === 'delivered', step: 'delivered' }
                      ].map((step, idx) => (
                        <div key={idx} className="flex flex-col items-center gap-1.5">
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-colors ${
                            step.active ? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-400 border border-neutral-200'
                          }`}>
                            {step.active ? '✓' : idx + 1}
                          </div>
                          <span className={`text-[10px] sm:text-[11px] leading-tight ${step.active ? 'font-bold text-neutral-900' : 'text-neutral-400'}`}>
                            {step.label}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Actions & Items preview */}
                  <div className="pt-2 border-t border-neutral-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="text-xs text-neutral-500 truncate">
                      款式: {order.items.map(i => i.productName).slice(0, 2).join(', ')}
                      {order.items.length > 2 && ` 等 ${order.items.length} 种款式`}
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setSelectedOrderId(order.id);
                          setShowOrderDetailModal(true);
                        }}
                        className="px-3 py-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 text-xs font-bold rounded-lg transition-colors cursor-pointer"
                      >
                        查看订单详情
                      </button>

                      {order.status === 'shipped' && (
                        <button
                          onClick={() => setTrackingOrder(order)}
                          className="px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 text-xs font-bold rounded-lg border border-blue-200 transition-colors cursor-pointer flex items-center gap-1"
                        >
                          <Truck className="w-3.5 h-3.5" />
                          <span>看物流</span>
                        </button>
                      )}

                      <button
                        onClick={() => handleTriggerReorder(order)}
                        className="px-3 py-1.5 bg-neutral-900 hover:bg-black text-white text-xs font-bold rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>再次补货</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 6. ⭐ 我的收藏 (Favorites) */}
      {/* ========================================================================= */}
      {activeTab === 'favorites' && (
        <div className="space-y-4">
          <div className="bg-white border border-neutral-200 rounded-xl p-4 sm:p-5 shadow-2xs flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-neutral-900 flex items-center gap-2">
                <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                我的收藏清单 ({favorites.length})
              </h2>
              <p className="text-xs text-neutral-500 mt-0.5">
                实时追踪热销款现货库存与补货动向，支持一键智能配码装车
              </p>
            </div>
          </div>

          {favorites.length === 0 ? (
            <div className="bg-white border border-neutral-200 rounded-xl p-8 text-center space-y-3">
              <Star className="w-8 h-8 text-neutral-300 mx-auto" />
              <p className="text-xs text-neutral-500">您目前尚未收藏任何款式</p>
              <button
                onClick={() => setActiveTab('shop')}
                className="px-4 py-2 bg-neutral-900 text-white text-xs font-bold rounded-lg cursor-pointer"
              >
                浏览采购商城
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
              {products.filter(p => isFavorite(p.id)).map(product => {
                const customerPrice = calculateCustomerPrice(product.wholesalePrice);

                return (
                  <div 
                    key={product.id}
                    className="bg-white border border-neutral-200 rounded-xl p-3.5 space-y-3 shadow-2xs flex flex-col justify-between"
                  >
                    <div className="flex gap-3">
                      <img
                        src={product.images[0]}
                        alt={product.name}
                        referrerPolicy="no-referrer"
                        className="w-16 h-20 object-cover rounded-lg bg-neutral-100 shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-xs font-bold text-neutral-900">{product.styleNo}</span>
                          <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            现货充足
                          </span>
                        </div>
                        <h3 className="text-xs font-medium text-neutral-800 line-clamp-1 mt-0.5">{product.name}</h3>
                        <p className="text-xs font-bold font-serif text-neutral-900 mt-1">€{customerPrice.toFixed(2)}/件</p>
                        <p className="text-[10px] text-neutral-400">起订量: {product.moq}件</p>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-neutral-100 flex items-center justify-between gap-2">
                      <button
                        onClick={() => toggleFavorite(product.id)}
                        className="text-xs text-neutral-400 hover:text-neutral-700 cursor-pointer"
                      >
                        移除
                      </button>
                      <button
                        onClick={() => {
                          setRatioProduct(product);
                          applyRatioPreset('standard');
                        }}
                        className="px-3 py-1.5 bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                      >
                        <Sparkles className="w-3 h-3 text-amber-300" />
                        <span>智能配码加购</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 7. 🏢 我的公司 (My Company & Documents) */}
      {/* ========================================================================= */}
      {activeTab === 'company' && (
        <div className="space-y-6">
          <div className="bg-white border border-neutral-200 rounded-xl p-4 sm:p-5 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-neutral-100 flex items-center justify-center shrink-0">
                <Languages className="w-4 h-4 text-neutral-700" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-neutral-900">语言设置</h2>
                <p className="text-xs text-neutral-500 mt-1">选择买手中心显示语言，首页不再显示语言按钮。</p>
              </div>
            </div>
            <LanguagePicker className="self-start sm:self-auto" />
          </div>

          <div className="bg-white border border-neutral-200 rounded-xl p-4 sm:p-6 shadow-2xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-neutral-100 pb-3">
              <div>
                <h2 className="text-sm font-bold text-neutral-900 flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-neutral-800" />
                  公司资质与认证资料 (MY COMPANY)
                </h2>
                <p className="text-xs text-neutral-500">
                  欧盟增值税认证与 Net 30 授信资料受平台合规保护，修改敏感信息需提交审核
                </p>
              </div>
              <button
                onClick={() => setShowRequestChangeModal(true)}
                className="px-3.5 py-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 text-xs font-bold rounded-lg border border-neutral-300 transition-colors cursor-pointer"
              >
                Request Change (申请修改)
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
              <div className="p-3 bg-neutral-50 rounded-lg space-y-1">
                <span className="text-neutral-400 block text-[11px]">公司法定全称 (Company Name)</span>
                <span className="font-bold text-neutral-900 block">{currentCustomer?.companyName || 'ABC Boutique & Co.'}</span>
              </div>
              <div className="p-3 bg-neutral-50 rounded-lg space-y-1">
                <span className="text-neutral-400 block text-[11px]">欧盟 VAT 增值税号</span>
                <span className="font-mono font-bold text-emerald-700 block flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  {currentCustomer?.vatNumber || 'FR89283746192'} (已核验免税)
                </span>
              </div>
              <div className="p-3 bg-neutral-50 rounded-lg space-y-1">
                <span className="text-neutral-400 block text-[11px]">账期授信 (Payment Terms)</span>
                <span className="font-bold text-neutral-900 block">
                  Net 30 天结算 · 额度 €{Number(currentCustomer?.creditLimit || 0).toLocaleString()}
                </span>
              </div>
              <div className="p-3 bg-neutral-50 rounded-lg space-y-1">
                <span className="text-neutral-400 block text-[11px]">收货地址 (Shipping Address)</span>
                <span className="text-neutral-800 block">
                  {currentCustomer?.address || '14 Rue du Faubourg Saint-Honoré'}, {currentCustomer?.city || 'Paris'}, {currentCustomer?.country || 'France'}
                </span>
              </div>
              <div className="p-3 bg-neutral-50 rounded-lg space-y-1">
                <span className="text-neutral-400 block text-[11px]">业务负责人 / 电话</span>
                <span className="text-neutral-800 block">
                  {currentCustomer?.contactPerson || 'Sophie Martin'} · {currentCustomer?.phone || '+33 1 42 68 55 00'}
                </span>
              </div>
              <div className="p-3 bg-neutral-50 rounded-lg space-y-1">
                <span className="text-neutral-400 block text-[11px]">开票对公邮箱</span>
                <span className="font-mono text-neutral-800 block">
                  {currentCustomer?.email || 'billing@abcboutique.fr'}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-white border border-neutral-200 rounded-xl p-4 sm:p-6 shadow-2xs space-y-4">
            <div className="border-b border-neutral-100 pb-3">
              <h3 className="text-sm font-bold text-neutral-900 flex items-center gap-2">
                <FileText className="w-4 h-4 text-neutral-800" />
                文件中心 (DOCUMENTS)
              </h3>
              <p className="text-xs text-neutral-500">
                统一收纳商业发票 (Invoices)、采购合同 (Orders)、装箱单 (Packing Lists)、退货单凭证，支持一键下载 PDF
              </p>
            </div>
            <div className="divide-y divide-neutral-100 border border-neutral-200 rounded-xl overflow-hidden text-xs">
              {[
                { title: '商业发票 #INV-2026-0088', type: 'Invoices', date: '2026-03-12', size: '142 KB', orderNo: 'ORD-10088' },
                { title: '发运装箱单 #PKL-2026-0088', type: 'Packing Lists', date: '2026-03-12', size: '98 KB', orderNo: 'ORD-10088' },
                { title: '商业发票 #INV-2026-0042', type: 'Invoices', date: '2026-02-28', size: '156 KB', orderNo: 'ORD-10042' },
                { title: '贷记凭证 / 样品抵扣单 #CR-2026-0012', type: 'Credit Notes', date: '2026-02-15', size: '75 KB', orderNo: '-' }
              ].map((doc, idx) => (
                <div key={idx} className="p-3 sm:p-4 flex items-center justify-between hover:bg-neutral-50 transition-colors">
                  <div className="flex items-center gap-3">
                    <FileText className="w-4 h-4 text-neutral-500 shrink-0" />
                    <div>
                      <span className="font-bold text-neutral-900 block">{doc.title}</span>
                      <span className="text-[11px] text-neutral-400">
                        {doc.type} · 生成日期: {doc.date} · 关联订单: {doc.orderNo} ({doc.size})
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => addNotification('success', '文件下载就绪', `已为您生成 ${doc.title} 的电子凭证 PDF`)}
                    className="px-3 py-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 rounded-lg font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">下载 PDF</span>
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 8. 🔒 私密新品 (Private Collection) */}
      {/* ========================================================================= */}
      {activeTab === 'private_vault' && (
        <div className="space-y-4">
          <div className="bg-white border border-neutral-200 rounded-xl p-4 sm:p-5 shadow-2xs space-y-2">
            <h2 className="text-sm font-bold text-neutral-900 flex items-center gap-2">
              <Lock className="w-4 h-4 text-amber-600" />
              私密新品看货授权专区 (PRIVATE COLLECTION)
            </h2>
            <p className="text-xs text-neutral-500">
              为保护意大利工坊的当季原创爆款与版型版权，私密货盘仅向获得授权的认证买手店开放。
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {merchants.map(merchant => {
              const accessGranted = hasVaultAccess(merchant.id);
              const status = getVaultStatus(merchant.id);

              return (
                <div 
                  key={merchant.id}
                  className={`border rounded-xl p-5 space-y-4 shadow-2xs flex flex-col justify-between ${
                    accessGranted ? 'bg-white border-neutral-300' : 'bg-neutral-50 border-neutral-200'
                  }`}
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                        {merchant.city}, {merchant.country}
                      </span>
                      {accessGranted ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 flex items-center gap-1">
                          <Check className="w-3 h-3" /> 已授权看货
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-neutral-200 text-neutral-700 flex items-center gap-1">
                          <Lock className="w-3 h-3" /> 需申请
                        </span>
                      )}
                    </div>

                    <h3 className="text-sm font-bold text-neutral-900">{merchant.name}</h3>
                    <p className="text-xs text-neutral-500">
                      NEW FW26 CAPSULE · 12 款当季独家保密款
                    </p>
                  </div>

                  <div className="pt-3 border-t border-neutral-200/60">
                    {accessGranted ? (
                      <button
                        onClick={() => {
                          setActiveTab('shop');
                          addNotification('info', '进入私密专区', `已为您解锁 ${merchant.name} 的 12 款私密现货`);
                        }}
                        className="w-full py-2 bg-neutral-900 hover:bg-black text-white text-xs font-bold rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1"
                      >
                        <Eye className="w-3.5 h-3.5 text-amber-300" />
                        <span>查看私密新品</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => {
                          requestVaultAccess(merchant.id, '申请查看当季 FW26 独家款');
                          addNotification('success', '申请已递交', `已向 ${merchant.name} 提交看货资质审核`);
                        }}
                        disabled={status === 'pending'}
                        className="w-full py-2 bg-amber-500 hover:bg-amber-600 disabled:bg-neutral-300 text-neutral-950 text-xs font-bold rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1"
                      >
                        <Lock className="w-3.5 h-3.5" />
                        <span>{status === 'pending' ? '审核中 (Pending)' : '申请查看 Access'}</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 智能配码弹窗 (Smart Size Ratio Modal) */}
      {/* ========================================================================= */}
      {ratioProduct && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 space-y-4 shadow-xl border border-neutral-200">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-neutral-900 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  智能配码 (Smart Size Ratio)
                </h3>
                <p className="text-[11px] text-neutral-500">款号: {ratioProduct.styleNo} · 起订量 MOQ: {ratioProduct.moq}件</p>
              </div>
              <button 
                onClick={() => setRatioProduct(null)}
                className="w-7 h-7 rounded-full bg-neutral-100 hover:bg-neutral-200 flex items-center justify-center text-neutral-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Color selector if available */}
            {ratioProduct.skus.length > 0 && (
              <div className="space-y-1.5">
                <span className="text-xs font-bold text-neutral-800">选择颜色:</span>
                <div className="flex flex-wrap gap-1.5">
                  {ratioProduct.skus.slice(0, 4).map((sku, idx) => (
                    <button
                      key={sku.sku}
                      onClick={() => setSelectedColorIndex(idx)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium border cursor-pointer ${
                        selectedColorIndex === idx
                          ? 'bg-neutral-900 text-white border-black font-bold'
                          : 'bg-neutral-50 text-neutral-700 border-neutral-200 hover:bg-neutral-100'
                      }`}
                    >
                      {sku.color}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Preset Ratio Buttons */}
            <div className="space-y-1.5">
              <span className="text-xs font-bold text-neutral-800">快速配比预设:</span>
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => applyRatioPreset('standard')}
                  className="px-2 py-1.5 bg-neutral-100 hover:bg-neutral-200 rounded-lg text-xs font-semibold text-neutral-800 text-center cursor-pointer"
                >
                  经典 1:2:2:1
                </button>
                <button
                  onClick={() => applyRatioPreset('even')}
                  className="px-2 py-1.5 bg-neutral-100 hover:bg-neutral-200 rounded-lg text-xs font-semibold text-neutral-800 text-center cursor-pointer"
                >
                  均码配比
                </button>
                <button
                  onClick={() => applyRatioPreset('plus_size')}
                  className="px-2 py-1.5 bg-neutral-100 hover:bg-neutral-200 rounded-lg text-xs font-semibold text-neutral-800 text-center cursor-pointer"
                >
                  偏重大码
                </button>
              </div>
            </div>

            {/* Stepper Inputs for S, M, L, XL */}
            <div className="space-y-2 bg-neutral-50 p-3 rounded-xl border border-neutral-200">
              {['S', 'M', 'L', 'XL'].map(size => (
                <div key={size} className="flex items-center justify-between text-xs">
                  <span className="font-bold text-neutral-800 w-10">{size} 码:</span>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => handleRatioQtyChange(size, -1)}
                      className="w-7 h-7 rounded-lg bg-white border border-neutral-300 flex items-center justify-center text-neutral-700 hover:bg-neutral-100 cursor-pointer active:scale-90"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="font-mono font-bold text-sm text-neutral-900 w-6 text-center">
                      {ratioQuantities[size] || 0}
                    </span>
                    <button
                      onClick={() => handleRatioQtyChange(size, 1)}
                      className="w-7 h-7 rounded-lg bg-white border border-neutral-300 flex items-center justify-center text-neutral-700 hover:bg-neutral-100 cursor-pointer active:scale-90"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Total Summary */}
            <div className="flex items-center justify-between text-xs pt-1">
              <div>
                <span className="text-neutral-500">配码总计: </span>
                <strong className={`text-sm ${totalRatioQty >= ratioProduct.moq ? 'text-emerald-700' : 'text-amber-600'}`}>
                  {totalRatioQty} 件
                </strong>
                {totalRatioQty < ratioProduct.moq && (
                  <span className="text-[10px] text-amber-600 block">(还差 {ratioProduct.moq - totalRatioQty} 件达起订量)</span>
                )}
              </div>
              <div className="text-right">
                <span className="text-neutral-500 text-[11px]">预计小计: </span>
                <span className="text-sm font-bold font-serif text-neutral-900">€{totalRatioPrice.toFixed(2)}</span>
              </div>
            </div>

            {/* Action Buttons */}
            <button
              onClick={handleConfirmAddRatioToCart}
              className="w-full py-2.5 bg-neutral-900 hover:bg-black text-white text-xs font-bold rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-2"
            >
              <ShoppingBag className="w-4 h-4" />
              <span>加入采购车 (Add to Cart)</span>
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 人工选择替换商品弹窗 (Human Matching Replacement Modal) */}
      {/* ========================================================================= */}
      {showReplacementModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-lg w-full p-5 space-y-4 shadow-xl border border-neutral-200">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-neutral-900 flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                  人工匹配与替换商品
                </h3>
                <p className="text-[11px] text-neutral-500">
                  采购单中款号: <span className="font-mono font-bold text-neutral-900">{showReplacementModal.requestedStyle}</span> 未完全匹配，请选择替代现货
                </p>
              </div>
              <button 
                onClick={() => setShowReplacementModal(null)}
                className="w-7 h-7 rounded-full bg-neutral-100 hover:bg-neutral-200 flex items-center justify-center text-neutral-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="max-h-72 overflow-y-auto divide-y divide-neutral-100 space-y-1">
              {products.slice(0, 5).map(prod => (
                <div key={prod.id} className="py-2.5 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <img
                      src={prod.images[0]}
                      alt={prod.name}
                      referrerPolicy="no-referrer"
                      className="w-10 h-12 object-cover rounded bg-neutral-100 shrink-0"
                    />
                    <div className="min-w-0">
                      <p className="font-mono text-xs font-bold text-neutral-900">{prod.styleNo}</p>
                      <p className="text-xs text-neutral-500 truncate">{prod.name}</p>
                      <p className="text-[11px] font-serif font-bold text-neutral-800">€{calculateCustomerPrice(prod.wholesalePrice).toFixed(2)}</p>
                    </div>
                  </div>

                  <button
                    onClick={() => handleApplyReplacement(showReplacementModal.rawLine, prod)}
                    className="px-3 py-1.5 bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-bold rounded-lg shrink-0 cursor-pointer"
                  >
                    选择替换
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 再次补货安全校验模态框 (Reorder Safety Check Modal) */}
      {/* ========================================================================= */}
      {showReorderNotice && reorderCheckOrder && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 space-y-4 shadow-xl border border-neutral-200">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
              <h3 className="text-sm font-bold text-neutral-900 flex items-center gap-1.5">
                <RotateCcw className="w-4 h-4 text-neutral-800" />
                补货库存核验
              </h3>
              <button 
                onClick={() => setShowReorderNotice(false)}
                className="w-7 h-7 rounded-full bg-neutral-100 hover:bg-neutral-200 flex items-center justify-center text-neutral-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 bg-emerald-50 text-emerald-800 rounded-xl border border-emerald-200 space-y-1">
                <p className="font-bold flex items-center gap-1">
                  <Check className="w-4 h-4" /> 现货与价格校验通过
                </p>
                <p className="text-[11px]">
                  订单 #{reorderCheckOrder.orderNo} 包含 {reorderCheckOrder.items.length} 种规格，RUDA 总仓将按当前可售库存重新校验。
                </p>
              </div>

              <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-200 text-neutral-600 space-y-1">
                <p className="font-medium text-neutral-800">补货清单概览:</p>
                <ul className="list-disc list-inside text-[11px] space-y-0.5">
                  {reorderCheckOrder.items.slice(0, 3).map((item, idx) => (
                    <li key={idx}>
                      {item.productName} ({item.color} / {item.size}) × {item.quantity}件
                    </li>
                  ))}
                  {reorderCheckOrder.items.length > 3 && (
                    <li>等共计 {reorderCheckOrder.items.length} 个规格</li>
                  )}
                </ul>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={() => setShowReorderNotice(false)}
                className="flex-1 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 text-xs font-semibold rounded-xl cursor-pointer"
              >
                取消
              </button>
              <button
                onClick={handleConfirmReorderAction}
                className="flex-1 py-2 bg-neutral-900 hover:bg-black text-white text-xs font-bold rounded-xl cursor-pointer"
              >
                确认载入采购车
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 物流实时轨迹模态框 (DHL Live Tracking Modal) */}
      {/* ========================================================================= */}
      {trackingOrder && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 space-y-4 shadow-xl border border-neutral-200">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-neutral-900 flex items-center gap-1.5">
                  <Truck className="w-4 h-4 text-blue-600" />
                  订单物流追踪
                </h3>
                <p className="text-[11px] font-mono text-neutral-500">
                  {trackingOrder.carrier || '承运商待确认'} · {trackingOrder.trackingNumber || '暂无物流单号'}
                </p>
              </div>
              <button 
                onClick={() => setTrackingOrder(null)}
                className="w-7 h-7 rounded-full bg-neutral-100 hover:bg-neutral-200 flex items-center justify-center text-neutral-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4 text-xs py-1">
              {trackingLoading && <div className="rounded-xl bg-neutral-50 p-3 text-xs text-neutral-500">正在读取真实物流包裹...</div>}
              {!trackingLoading && trackingShipments.length === 0 && <div className="rounded-xl bg-amber-50 p-3 text-xs text-amber-800">订单暂未创建物流包裹。</div>}
              {trackingShipments.map(shipment => (
              <div key={shipment.id} className="space-y-3 rounded-xl border border-neutral-200 p-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold">{shipment.shipmentNo}</span>
                  <span className="rounded bg-neutral-100 px-2 py-1">{shipment.status}</span>
                </div>
                <div className="text-[11px] text-neutral-500">{shipment.carrier || '承运商待确认'} · {shipment.trackingNumber || '暂无单号'}</div>
                <div className="space-y-2 border-l-2 border-neutral-200 pl-3">
                  {shipment.trackingEvents.length === 0 ? <div className="text-[11px] text-neutral-500">暂无承运商轨迹更新。</div> : shipment.trackingEvents.map((event, index) => (
                    <div key={event.id} className="relative text-xs">
                      <div className={`absolute -left-[19px] top-1.5 h-2.5 w-2.5 rounded-full ${index === 0 ? 'bg-emerald-500' : 'bg-neutral-400'}`} />
                      <div className="font-semibold text-neutral-800">{event.status}</div>
                      <div className="text-[10px] text-neutral-400">{new Date(event.occurredAt).toLocaleString()} · {event.location || '地点未提供'}</div>
                      {event.description && <div className="text-[11px] text-neutral-600">{event.description}</div>}
                    </div>
                  ))}
                </div>
              </div>
              ))}
            </div>

            <button
              onClick={() => setTrackingOrder(null)}
              className="w-full py-2 bg-neutral-900 text-white text-xs font-bold rounded-xl cursor-pointer"
            >
              关闭
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 申请修改资料模态框 (Request Change Modal) */}
      {/* ========================================================================= */}
      {showRequestChangeModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 space-y-4 shadow-xl border border-neutral-200">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
              <h3 className="text-sm font-bold text-neutral-900 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-neutral-800" />
                提交资质信息变更申请
              </h3>
              <button 
                onClick={() => setShowRequestChangeModal(false)}
                className="w-7 h-7 rounded-full bg-neutral-100 hover:bg-neutral-200 flex items-center justify-center text-neutral-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {changeSubmitted ? (
              <div className="p-6 text-center space-y-3">
                <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto" />
                <p className="text-sm font-bold text-neutral-900">变更申请已提交平台</p>
                <p className="text-xs text-neutral-500">
                  平台合规专员将在 1 个工作日内复核您递交的最新资料，期间不影响正常选款下单。
                </p>
                <button
                  onClick={() => {
                    setShowRequestChangeModal(false);
                    setChangeSubmitted(false);
                  }}
                  className="px-4 py-2 bg-neutral-900 text-white text-xs font-bold rounded-lg"
                >
                  好的，知道了
                </button>
              </div>
            ) : (
              <div className="space-y-3 text-xs">
                <p className="text-neutral-500">
                  增值税号 (VAT) 及公司法定注册信息直接关联欧盟反向征税政策，需平台合规审核。
                </p>
                <div className="space-y-1">
                  <label className="font-bold text-neutral-800">修改项目:</label>
                  <select
                    value={changeField}
                    onChange={(e) => setChangeField(e.target.value)}
                    className="w-full p-2 bg-neutral-50 border border-neutral-300 rounded-lg text-xs"
                  >
                    <option value="VAT Number & Billing Address">VAT 增值税号 & 开票地址</option>
                    <option value="Company Legal Name">公司注册法定名称</option>
                    <option value="Shipping Destination">主要收货门市地址</option>
                    <option value="Payment Terms Credit Increase">申请提高 Net 30 授信额度</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-neutral-800">变更诉求与证明文件备注:</label>
                  <textarea
                    value={changeNotes}
                    onChange={(e) => setChangeNotes(e.target.value)}
                    placeholder="请输入需要变更的具体内容，如新的增值税号或新地址..."
                    rows={3}
                    className="w-full p-2.5 bg-neutral-50 border border-neutral-300 rounded-lg text-xs"
                  />
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <button
                    onClick={() => setShowRequestChangeModal(false)}
                    className="flex-1 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 text-xs font-semibold rounded-xl cursor-pointer"
                  >
                    取消
                  </button>
                  <button
                    onClick={() => {
                      setChangeSubmitted(true);
                      addNotification('success', '申请递交成功', '您的资质信息变更请求已发送至平台审核');
                    }}
                    className="flex-1 py-2 bg-neutral-900 hover:bg-black text-white text-xs font-bold rounded-xl cursor-pointer"
                  >
                    提交平台审核
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 订单明细抽屉/模态框 (Order Details Modal) */}
      {/* ========================================================================= */}
      {showOrderDetailModal && selectedOrder && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-xl w-full p-5 space-y-4 shadow-xl border border-neutral-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-neutral-900 flex items-center gap-2">
                  <Package className="w-4 h-4 text-neutral-800" />
                  订单详情 #{selectedOrder.orderNo}
                </h3>
                <p className="text-[11px] text-neutral-500">
                  下单时间: {selectedOrder.createdAt} · 状态: <strong className="text-neutral-800">{selectedOrder.status}</strong>
                </p>
              </div>
              <button 
                onClick={() => setShowOrderDetailModal(false)}
                className="w-7 h-7 rounded-full bg-neutral-100 hover:bg-neutral-200 flex items-center justify-center text-neutral-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Items List */}
            <div className="divide-y divide-neutral-100 border border-neutral-200 rounded-xl overflow-hidden text-xs">
              {selectedOrder.items.map((item, idx) => (
                <div key={idx} className="p-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <img
                      src={item.image}
                      alt={item.productName}
                      referrerPolicy="no-referrer"
                      className="w-10 h-12 object-cover rounded bg-neutral-100 shrink-0"
                    />
                    <div>
                      <span className="font-mono font-bold text-neutral-900">{item.styleNo}</span>
                      <p className="text-neutral-600 line-clamp-1">{item.productName}</p>
                      <p className="text-[11px] text-neutral-400">
                        {item.color} · 尺码: {item.size}
                      </p>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="font-bold text-neutral-900 block">{item.quantity} 件</span>
                    <span className="text-[11px] text-neutral-500 font-mono">€{item.unitPrice.toFixed(2)}/件</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Order Cost Breakdown */}
            <div className="bg-neutral-50 p-3 rounded-xl space-y-1 text-xs">
              <div className="flex justify-between text-neutral-600">
                <span>货品总计 ({selectedOrder.items.reduce((a, b) => a + b.quantity, 0)} 件):</span>
                <span className="font-mono">€{selectedOrder.totalAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-neutral-600">
                <span>增值税 (EU VAT Reverse Charge):</span>
                <span className="font-mono text-emerald-700 font-bold">€0.00 (免税)</span>
              </div>
              <div className="flex justify-between text-sm font-bold text-neutral-900 pt-1 border-t border-neutral-200">
                <span>总计金额:</span>
                <span className="font-serif font-bold">€{selectedOrder.totalAmount.toFixed(2)}</span>
              </div>
            </div>

            {/* Buttons */}
            <div className="flex items-center justify-between gap-2 pt-2">
              <button
                onClick={() => addNotification('success', '发票下载就绪', `发票 #INV-${selectedOrder.orderNo} PDF 已生成`)}
                className="px-3.5 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 text-xs font-bold rounded-lg border border-neutral-200 flex items-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>下载发票 (PDF)</span>
              </button>

              <button
                onClick={() => {
                  setShowOrderDetailModal(false);
                  handleTriggerReorder(selectedOrder);
                }}
                className="px-4 py-2 bg-neutral-900 hover:bg-black text-white text-xs font-bold rounded-lg cursor-pointer flex items-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>基于此单补货</span>
              </button>
            </div>
          </div>
        </div>
      )}

      <ReorderModal />
    </div>
  );
};
