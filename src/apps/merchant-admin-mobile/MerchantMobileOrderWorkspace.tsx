import React, { useEffect, useMemo, useState } from 'react';
import { Check, ChevronLeft, ChevronRight, Plus, Search, Trash2, X } from 'lucide-react';
import type { MerchantAssistedOrderDraft, Order, Product, WholesaleCustomer } from '../../types/b2b';
import { apiPost, apiPut } from '../../api/client';
import { ProductImage } from '../shared/components/common/ProductImage';
import { getProductWholesalePriceForQuantity } from '../../shared/productPricing';

type MobileOrderFilter = 'all' | 'action' | 'active' | 'completed' | 'exceptions';
type DraftOrder = {
  id: string | null;
  idempotencyKey: string;
  data: MerchantAssistedOrderDraft;
};

interface MerchantMobileOrderWorkspaceProps {
  orders: Order[];
  products: Product[];
  customers: WholesaleCustomer[];
  onOpenOrder: (order: Order) => void;
  onOpenPos: () => void;
  onRefreshOrders: () => Promise<Order[]>;
  onNotify: (type: 'success' | 'warning', title: string, message: string) => void;
}

const emptyDraft = (): MerchantAssistedOrderDraft => ({
  customerId: null,
  items: [],
  shippingAddress: { street: '', city: '', country: '', zip: '', recipient: '', phone: '' },
  shippingFee: 0,
  additionalFees: 0,
  additionalFeesDescription: '',
  terms: {
    paymentPlan: 'full_prepayment',
    paymentMethod: 'bank_transfer',
    remainingBalanceTrigger: 'before_shipment',
    remainingBalanceDueAt: null,
    customPaymentCondition: null,
    supplyMode: 'partial_shipments',
    expectedDeliveryAt: null
  }
});

const orderStateLabel = (order: Order) => {
  if (order.status === 'draft') return '草稿';
  if (order.orderNo.startsWith('POS-') && order.paymentStatus === 'paid') return '已完成';
  if (order.refundStatus === 'requested') return '退货待处理';
  if (order.status === 'delivered') return order.paymentStatus === 'paid' ? '已完成' : '已送达·待结款';
  if (order.status === 'shipped') return '运输中';
  if (order.status === 'picking') return '备货中';
  if (order.status === 'confirmed') return '处理中';
  if (order.status === 'cancelled') return '已取消';
  if (order.status === 'returned') return '已退货';
  if (order.currentTasks?.merchant.label) return order.currentTasks.merchant.label;
  return '待确认';
};

const paymentLabel = (order: Order) => {
  if (order.paymentStatus === 'paid') return '已付';
  if (Number(order.paidAmount || 0) > 0) return '部分';
  return '未付';
};

export const MerchantMobileOrderWorkspace: React.FC<MerchantMobileOrderWorkspaceProps> = ({
  orders,
  products,
  customers,
  onOpenOrder,
  onOpenPos,
  onRefreshOrders,
  onNotify
}) => {
  const [filter, setFilter] = useState<MobileOrderFilter>('all');
  const [query, setQuery] = useState('');
  const [showCreateChoices, setShowCreateChoices] = useState(false);
  const [draftOrder, setDraftOrder] = useState<DraftOrder | null>(null);
  const [customerQuery, setCustomerQuery] = useState('');
  const [productQuery, setProductQuery] = useState('');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [selectedSku, setSelectedSku] = useState('');
  const [selectedQuantity, setSelectedQuantity] = useState('1');
  const [busy, setBusy] = useState(false);

  const filteredOrders = useMemo(() => {
    const search = query.trim().toLocaleLowerCase();
    return orders.filter(order => {
      const searchText = [
        order.orderNo,
        order.companyName,
        order.customerCompanyName,
        order.shippingAddress?.country,
        ...order.items.flatMap(item => [item.productName, item.styleNo, item.sku])
      ].filter(Boolean).join(' ').toLocaleLowerCase();
      const matchesSearch = !search || searchText.includes(search);
      const matchesFilter = filter === 'all'
        || (filter === 'action' && (order.status === 'draft' || Boolean(order.currentTasks?.merchant.action)))
        || (filter === 'active' && !['draft', 'delivered', 'returned', 'cancelled'].includes(order.status) && !(order.orderNo.startsWith('POS-') && order.paymentStatus === 'paid'))
        || (filter === 'completed' && (['delivered', 'returned', 'cancelled'].includes(order.status) || (order.orderNo.startsWith('POS-') && order.paymentStatus === 'paid')))
        || (filter === 'exceptions' && (order.hasLogisticsException || order.refundStatus === 'requested'));
      return matchesSearch && matchesFilter;
    });
  }, [filter, orders, query]);

  const selectedProduct = products.find(product => product.id === selectedProductId);
  const selectedSkuItem = selectedProduct?.skus.find(sku => sku.sku === selectedSku);
  const matchingProducts = products.filter(product => {
    const search = productQuery.trim().toLocaleLowerCase();
    return (product.lifecycleStatus || 'published') === 'published'
      && (!search || `${product.name} ${product.styleNo} ${product.skus.map(sku => sku.sku).join(' ')}`.toLocaleLowerCase().includes(search));
  }).slice(0, 8);
  const matchingCustomers = customers.filter(customer => {
    const search = customerQuery.trim().toLocaleLowerCase();
    return !search || `${customer.companyName} ${customer.contactPerson} ${customer.email}`.toLocaleLowerCase().includes(search);
  }).slice(0, 8);
  const selectedCustomer = customers.find(customer => customer.id === draftOrder?.data.customerId);
  const draftQuote = useMemo(() => {
    if (!draftOrder || !selectedCustomer || !Number.isFinite(selectedCustomer.discountRate)
      || selectedCustomer.discountRate <= 0 || selectedCustomer.discountRate > 1 || draftOrder.data.items.length === 0) {
      return null;
    }
    const quantityByProduct = new Map<string, number>();
    draftOrder.data.items.forEach(item => quantityByProduct.set(item.productId, (quantityByProduct.get(item.productId) || 0) + item.quantity));
    let subtotal = 0;
    for (const item of draftOrder.data.items) {
      const product = products.find(candidate => candidate.id === item.productId);
      const productQuantity = quantityByProduct.get(item.productId) || 0;
      if (!product || !Number.isFinite(product.wholesalePrice) || product.wholesalePrice <= 0) return null;
      const basePrice = getProductWholesalePriceForQuantity(
        product.wholesalePrice,
        product.wholesalePrice100 ?? null,
        productQuantity,
        product.bulkPriceMinimumQuantity
      );
      subtotal += item.quantity * Number((basePrice * selectedCustomer.discountRate).toFixed(2));
    }
    return Number((subtotal + draftOrder.data.shippingFee + draftOrder.data.additionalFees).toFixed(2));
  }, [draftOrder, products, selectedCustomer]);

  const openNewDraft = () => {
    setCustomerQuery('');
    setProductQuery('');
    setSelectedProductId('');
    setSelectedSku('');
    setSelectedQuantity('1');
    setDraftOrder({ id: null, idempotencyKey: crypto.randomUUID(), data: emptyDraft() });
    setShowCreateChoices(false);
  };

  const resumeDraft = (order: Order) => {
    const savedDraft = order.assistedDraft;
    if (!savedDraft || !order.idempotencyKey) {
      onNotify('warning', '草稿无法打开', '草稿数据不完整，请刷新订单列表后重试。');
      return;
    }
    setCustomerQuery(customers.find(customer => customer.id === savedDraft.customerId)?.companyName || '');
    setProductQuery('');
    setSelectedProductId('');
    setSelectedSku('');
    setSelectedQuantity('1');
    setDraftOrder({ id: order.id, idempotencyKey: order.idempotencyKey, data: savedDraft });
  };

  const updateDraft = (update: (draft: MerchantAssistedOrderDraft) => MerchantAssistedOrderDraft) => {
    setDraftOrder(previous => previous ? { ...previous, data: update(previous.data) } : previous);
  };

  const selectCustomer = (customer: WholesaleCustomer) => {
    updateDraft(draft => ({
      ...draft,
      customerId: customer.id,
      shippingAddress: {
        street: customer.address || '',
        city: customer.city || '',
        country: customer.country || '',
        zip: '',
        recipient: customer.contactPerson || '',
        phone: customer.phone || ''
      }
    }));
    setCustomerQuery(customer.companyName);
  };

  const addSku = () => {
    if (!selectedProduct || !selectedSkuItem) {
      onNotify('warning', '请选择商品规格', '先选择商品和 SKU。');
      return;
    }
    const quantity = Number(selectedQuantity);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 100_000) {
      onNotify('warning', '数量无效', '请输入 1 至 100000 的整数。');
      return;
    }
    updateDraft(draft => {
      const found = draft.items.find(item => item.productId === selectedProduct.id && item.sku === selectedSkuItem.sku);
      return {
        ...draft,
        items: found
          ? draft.items.map(item => item.productId === selectedProduct.id && item.sku === selectedSkuItem.sku
            ? { ...item, quantity: item.quantity + quantity }
            : item)
          : [...draft.items, { productId: selectedProduct.id, sku: selectedSkuItem.sku, quantity }]
      };
    });
    setSelectedQuantity('1');
  };

  const saveDraft = async () => {
    if (!draftOrder || busy) return;
    setBusy(true);
    try {
      const result = draftOrder.id
        ? await apiPut<{ success: true; draft: { id: string; idempotencyKey: string } }>(
          `/api/merchant/orders/assisted-drafts/${encodeURIComponent(draftOrder.id)}`,
          { draft: draftOrder.data }
        )
        : await apiPost<{ success: true; draft: { id: string; idempotencyKey: string } }>(
          '/api/merchant/orders/assisted-drafts',
          { idempotencyKey: draftOrder.idempotencyKey, draft: draftOrder.data }
        );
      setDraftOrder(previous => previous
        ? { ...previous, id: result.draft.id, idempotencyKey: result.draft.idempotencyKey }
        : previous);
      await onRefreshOrders();
      onNotify('success', '草稿已保存', '订单草稿已安全保存，可稍后继续。');
    } catch (error) {
      onNotify('warning', '保存失败', error instanceof Error ? error.message : '请检查网络后重试。');
    } finally {
      setBusy(false);
    }
  };

  const submitOrder = async () => {
    if (!draftOrder || busy) return;
    const { data } = draftOrder;
    const customer = customers.find(item => item.id === data.customerId);
    const phone = String(data.shippingAddress.phone ?? '').trim();
    const recipient = String(data.shippingAddress.recipient ?? '').trim();
    if (!customer || data.items.length === 0 || !recipient
      || !data.shippingAddress.street.trim() || !data.shippingAddress.city.trim()
      || !data.shippingAddress.country.trim() || !data.shippingAddress.zip.trim()
      || !/^[+()\d][+\d()\s.-]{5,59}$/.test(phone) || phone.replace(/\D/g, '').length < 7) {
      onNotify('warning', '信息未完成', '请确认客户、商品、收件人、联系方式和完整收货地址。');
      return;
    }
    if (data.additionalFees > 0 && !data.additionalFeesDescription.trim()) {
      onNotify('warning', '费用说明缺失', '请填写其他费用的说明。');
      return;
    }

    setBusy(true);
    try {
      if (draftOrder.id) {
        await apiPut(`/api/merchant/orders/assisted-drafts/${encodeURIComponent(draftOrder.id)}`, { draft: data });
      }
      const result = await apiPost<{ success: true; order: { id: string; orderNo: string } }>(
        '/api/merchant/orders/assisted-create',
        {
          draftId: draftOrder.id || undefined,
          idempotencyKey: draftOrder.idempotencyKey,
          customerId: data.customerId,
          items: data.items,
          shippingAddress: data.shippingAddress,
          shippingFee: data.shippingFee,
          additionalFees: data.additionalFees,
          additionalFeesDescription: data.additionalFeesDescription,
          discountAmount: 0,
          terms: data.terms
        }
      );
      const refreshed = await onRefreshOrders();
      setDraftOrder(null);
      const createdOrder = refreshed.find(order => order.id === result.order.id);
      if (createdOrder) onOpenOrder(createdOrder);
      onNotify('success', '订单已创建', `${result.order.orderNo} 已进入待客户确认。`);
    } catch (error) {
      onNotify('warning', '创建失败', error instanceof Error ? error.message : '订单草稿已保留，请检查后重试。');
    } finally {
      setBusy(false);
    }
  };

  const updateAddress = (key: keyof MerchantAssistedOrderDraft['shippingAddress'], value: string) => {
    updateDraft(draft => ({
      ...draft,
      shippingAddress: { ...draft.shippingAddress, [key]: value }
    }));
  };

  return (
    <section className="ruda-orders-page space-y-4 pb-5 animate-ruda-fade">
      <header className="flex items-center justify-between px-1">
        <h1 className="text-[20px] font-semibold tracking-tight text-neutral-950">订单</h1>
        <button 
          type="button" 
          onClick={() => setShowCreateChoices(true)} 
          className="ruda-btn-primary gap-1.5"
        >
          <Plus className="h-4 w-4" />开单
        </button>
      </header>

      {/* 统计区域 */}
      <div className="ruda-order-stats flex h-[68px] items-center divide-x divide-neutral-100 rounded-[12px] border border-neutral-100 bg-white shadow-none">
        <button 
          type="button"
          onClick={() => setFilter('action')}
          className="flex flex-1 flex-col items-center justify-center active:bg-neutral-50 transition-colors"
        >
          <strong className="text-[22px] font-semibold tabular-nums text-neutral-950">
            {orders.filter(order => order.status === 'draft' || Boolean(order.currentTasks?.merchant.action)).length}
          </strong>
          <span className="text-[12px] text-neutral-500">待处理</span>
        </button>
        <button 
          type="button"
          onClick={() => setFilter('active')}
          className="flex flex-1 flex-col items-center justify-center active:bg-neutral-50 transition-colors"
        >
          <strong className="text-[22px] font-semibold tabular-nums text-neutral-950">
            {orders.filter(order => !['draft', 'delivered', 'returned', 'cancelled'].includes(order.status)).length}
          </strong>
          <span className="text-[12px] text-neutral-500">进行中</span>
        </button>
        <button 
          type="button"
          onClick={() => setFilter('all')} // 假设点击待收款进入全部或特定筛选
          className="flex flex-1 flex-col items-center justify-center active:bg-neutral-50 transition-colors"
        >
          <strong className="text-[22px] font-semibold tabular-nums text-neutral-950">
            {orders.filter(order => order.paymentStatus !== 'paid' && order.status !== 'draft').length}
          </strong>
          <span className="text-[12px] text-neutral-500">待收款</span>
        </button>
      </div>

      {/* 搜索与筛选 */}
      <div className="space-y-3">
        <div className="ruda-search-bar">
          <Search className="h-[18px] w-[18px] text-neutral-400" />
          <input 
            value={query} 
            onChange={event => setQuery(event.target.value)} 
            placeholder="搜索订单号、客户、商品或手机号" 
            className="flex-1 bg-transparent text-[14px] outline-none" 
          />
          {query && (
            <button type="button" onClick={() => setQuery('')} className="p-1">
              <X className="h-4 w-4 text-neutral-400" />
            </button>
          )}
        </div>
        <div className="flex gap-2 overflow-x-auto scrollbar-hide py-0.5">
          {([
            ['all', '全部'],
            ['action', '待处理'],
            ['active', '运输中'],
            ['completed', '已完成']
          ] as const).map(([value, label]) => (
            <button 
              key={value} 
              type="button" 
              onClick={() => setFilter(value)} 
              className={`ruda-tab-pill whitespace-nowrap ${filter === value ? 'bg-neutral-100 font-semibold text-neutral-950' : 'text-neutral-500'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* 订单列表 */}
      <div className="space-y-2">
        {filteredOrders.map(order => (
          <button
            key={order.id}
            type="button"
            onClick={() => order.status === 'draft' ? resumeDraft(order) : onOpenOrder(order)}
            className="ruda-card ruda-order-card block w-full text-left"
          >
            <div className="flex items-start justify-between">
              <div className="min-w-0 flex-1 space-y-1">
                {/* 第一行：订单号、标签、状态 */}
                <div className="flex items-center gap-2">
                  <span className="text-[14px] font-semibold text-neutral-950">{order.orderNo}</span>
                  <span className="ruda-tag ruda-tag-neutral px-1.5 h-[20px] text-[10px]">
                    {order.status === 'draft' ? '草稿' : order.orderNo.startsWith('POS-') ? 'POS' : '批发'}
                  </span>
                  <span className={`ruda-tag ml-auto ${
                    order.status === 'delivered' ? 'ruda-tag-success' : 
                    order.status === 'shipped' ? 'ruda-tag-info' :
                    order.status === 'cancelled' ? 'ruda-tag-neutral' : 'ruda-tag-warning'
                  }`}>
                    {orderStateLabel(order)}
                  </span>
                </div>
                
                {/* 第二行：客户名称、商品名 */}
                <p className="text-[13px] font-medium text-neutral-900 truncate">
                  {order.companyName}
                </p>
                <div className="flex items-center gap-1.5">
                  {order.items[0]?.image && (
                    <ProductImage 
                      src={order.items[0].image} 
                      alt={order.items[0].productName || ''}
                      className="w-[48px] h-[58px] rounded-[6px] object-cover bg-neutral-50"
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] text-neutral-600 truncate">
                      {order.items.slice(0, 2).map(item => item.productName).filter(Boolean).join('、') || '商品明细'}
                      {order.items.length > 2 ? '…' : ''}
                    </p>
                    <p className="text-[12px] text-neutral-500">
                      {order.items.reduce((sum, item) => sum + item.quantity, 0)} 件 · {new Set(order.items.map(item => item.sku)).size} 规格
                    </p>
                  </div>
                </div>

                {/* 第三行：金额与付款状态 */}
                <div className="mt-2 flex items-center justify-between border-t border-neutral-50 pt-2">
                  <div className="flex items-center gap-1.5 text-[14px]">
                    <span className="font-semibold text-neutral-950">€{Number(order.totalAmount || 0).toFixed(2)}</span>
                    <span className="text-neutral-300">·</span>
                    <span className={`font-medium ${order.paymentStatus === 'paid' ? 'text-emerald-600' : 'text-neutral-500'}`}>
                      {paymentLabel(order)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-[12px] text-neutral-500">
                    <span className="truncate max-w-[120px]">
                      {order.status === 'draft' ? '继续填写' : order.currentTasks?.merchant.task || '查看详情'}
                    </span>
                    <ChevronRight className="h-4 w-4" />
                  </div>
                </div>
              </div>
            </div>
          </button>
        ))}
        {filteredOrders.length === 0 && (
          <div className="py-20 text-center animate-ruda-fade">
            <p className="text-sm text-neutral-400">暂无符合条件的订单</p>
          </div>
        )}
      </div>

      {/* 开单选择弹层 */}
      {showCreateChoices && (
        <div 
          className="fixed inset-0 z-[70] flex items-end justify-center bg-black/40 backdrop-blur-sm animate-ruda-fade" 
          onClick={() => setShowCreateChoices(false)}
        >
          <div 
            className="ruda-modal w-full max-w-sm rounded-t-3xl bg-white p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] animate-ruda-slide" 
            onClick={event => event.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-[17px] font-semibold text-neutral-950">创建订单</h2>
              <button 
                type="button" 
                onClick={() => setShowCreateChoices(false)} 
                className="w-8 h-8 flex items-center justify-center rounded-full bg-neutral-100 text-neutral-500"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-3">
              <button 
                type="button" 
                onClick={openNewDraft} 
                className="flex w-full items-center justify-between rounded-[12px] border border-neutral-100 p-4 text-left active:bg-neutral-50 transition-all"
              >
                <div>
                  <strong className="block text-[15px] font-semibold text-neutral-900">批发开单</strong>
                  <span className="mt-1 block text-[12px] text-neutral-500">客户、SKU、约定及收货信息</span>
                </div>
                <ChevronRight className="h-5 w-5 text-neutral-400" />
              </button>
              <button 
                type="button" 
                onClick={() => { setShowCreateChoices(false); onOpenPos(); }} 
                className="flex w-full items-center justify-between rounded-[12px] border border-neutral-100 p-4 text-left active:bg-neutral-50 transition-all"
              >
                <div>
                  <strong className="block text-[15px] font-semibold text-neutral-900">POS 销售</strong>
                  <span className="mt-1 block text-[12px] text-neutral-500">门店选货、收款及销售记录</span>
                </div>
                <ChevronRight className="h-5 w-5 text-neutral-400" />
              </button>
            </div>
          </div>
        </div>
      )}

      {draftOrder && (
        <div className="fixed inset-0 z-[70] flex flex-col bg-white pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] animate-ruda-fade">
          <header className="flex h-12 shrink-0 items-center justify-between border-b border-neutral-100 px-4">
            <button type="button" onClick={() => setDraftOrder(null)} className="flex items-center gap-1 text-[13px] font-medium text-neutral-600 active:scale-95 transition-transform">
              <ChevronLeft className="h-4 w-4" />返回
            </button>
            <h2 className="text-[15px] font-semibold text-neutral-900">{draftOrder.id ? '编辑草稿' : '批发开单'}</h2>
            <div className="w-12" /> {/* 占位 */}
          </header>

          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-5">
            {/* 客户选择 */}
            <section className="space-y-2">
              <h3 className="text-[12px] font-semibold text-neutral-500 uppercase tracking-wider">客户信息</h3>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
                <input 
                  value={customerQuery} 
                  onChange={event => setCustomerQuery(event.target.value)} 
                  placeholder="搜索客户名称或联系人" 
                  className="ruda-input w-full pl-9" 
                />
              </div>
              {customerQuery && !customers.some(customer => customer.id === draftOrder.data.customerId && customer.companyName === customerQuery) && (
                <div className="overflow-hidden rounded-[10px] border border-neutral-100 bg-white shadow-lg animate-ruda-fade">
                  {matchingCustomers.map(customer => (
                    <button type="button" key={customer.id} onClick={() => selectCustomer(customer)} className="block w-full border-b border-neutral-50 px-4 py-3 text-left last:border-0 active:bg-neutral-50">
                      <span className="block text-[14px] font-medium text-neutral-900">{customer.companyName}</span>
                      <span className="text-[12px] text-neutral-500">{customer.country} · {customer.contactPerson}</span>
                    </button>
                  ))}
                  {matchingCustomers.length === 0 && <p className="px-4 py-3 text-[12px] text-neutral-500 text-center">未找到相关客户</p>}
                </div>
              )}
              {draftOrder.data.customerId && (
                <div className="flex items-center gap-2 rounded-[8px] bg-emerald-50 px-3 py-2 text-emerald-700 text-[12px] font-medium">
                  <Check className="h-4 w-4" /> 已选择客户：{customers.find(c => c.id === draftOrder.data.customerId)?.companyName}
                </div>
              )}
            </section>

            {/* 商品添加 */}
            <section className="space-y-3 border-t border-neutral-50 pt-5">
              <h3 className="text-[12px] font-semibold text-neutral-500 uppercase tracking-wider">添加商品</h3>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
                <input 
                  value={productQuery} 
                  onChange={event => setProductQuery(event.target.value)} 
                  placeholder="搜索商品名、款号或 SKU" 
                  className="ruda-input w-full pl-9" 
                />
              </div>
              
              <div className="grid grid-cols-2 gap-2">
                <select 
                  value={selectedProductId} 
                  onChange={event => { setSelectedProductId(event.target.value); setSelectedSku(''); }} 
                  className="ruda-input w-full appearance-none bg-neutral-50"
                >
                  <option value="">选择商品</option>
                  {matchingProducts.map(product => <option key={product.id} value={product.id}>{product.styleNo} · {product.name}</option>)}
                </select>
                <select 
                  value={selectedSku} 
                  onChange={event => setSelectedSku(event.target.value)} 
                  disabled={!selectedProduct} 
                  className="ruda-input w-full appearance-none bg-neutral-50 disabled:opacity-40"
                >
                  <option value="">选择规格</option>
                  {selectedProduct?.skus.filter(sku => sku.isActive !== false).map(sku => <option key={sku.sku} value={sku.sku}>{sku.color} / {sku.size}</option>)}
                </select>
              </div>

              {selectedProduct && selectedSkuItem && (
                <div className="flex items-center gap-3 rounded-[10px] bg-neutral-50 p-3 animate-ruda-fade">
                  <ProductImage src={selectedProduct.images?.[0]} alt={selectedProduct.name} className="w-[48px] h-[58px] rounded-[6px] object-cover" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold text-neutral-900 truncate">{selectedProduct.name}</p>
                    <p className="text-[12px] text-neutral-500">{selectedSkuItem.color} / {selectedSkuItem.size} · €{Number(selectedProduct.wholesalePrice).toFixed(2)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <input 
                      value={selectedQuantity} 
                      onChange={event => setSelectedQuantity(event.target.value)} 
                      type="number" 
                      className="w-16 h-[36px] text-center rounded-[6px] border border-neutral-200 bg-white text-[14px]" 
                    />
                    <button type="button" onClick={addSku} className="w-[36px] h-[36px] flex items-center justify-center rounded-[6px] bg-neutral-950 text-white active:scale-90 transition-transform">
                      <Plus className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              )}

              {/* 已选商品列表 */}
              <div className="space-y-2">
                {draftOrder.data.items.map((line, index) => {
                  const product = products.find(item => item.id === line.productId);
                  const sku = product?.skus.find(item => item.sku === line.sku);
                  return (
                    <div key={`${line.productId}:${line.sku}`} className="flex items-center gap-3 p-2 rounded-[10px] border border-neutral-50">
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-medium text-neutral-900 truncate">{product?.name || line.productId}</p>
                        <p className="text-[12px] text-neutral-500">{sku ? `${sku.color} / ${sku.size}` : line.sku}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <input 
                          value={line.quantity} 
                          onChange={event => {
                            const quantity = Number(event.target.value);
                            updateDraft(draft => ({ ...draft, items: draft.items.map((item, itemIndex) => itemIndex === index ? { ...item, quantity: Number.isInteger(quantity) && quantity > 0 ? quantity : 1 } : item) }));
                          }} 
                          type="number" 
                          className="w-14 h-[32px] text-center rounded-[4px] border border-neutral-100 bg-neutral-50 text-[13px]" 
                        />
                        <button type="button" onClick={() => updateDraft(draft => ({ ...draft, items: draft.items.filter((_, itemIndex) => itemIndex !== index) }))} className="p-1.5 text-neutral-400 active:text-rose-500">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
              
              {draftOrder.data.items.length > 0 && (
                <div className="flex items-center justify-between rounded-[8px] bg-neutral-950 px-4 py-3 text-white">
                  <span className="text-[12px] font-medium">共 {draftOrder.data.items.reduce((sum, item) => sum + item.quantity, 0)} 件</span>
                  <span className="text-[15px] font-bold">{draftQuote === null ? '预估计算中...' : `€${draftQuote.toFixed(2)}`}</span>
                </div>
              )}
            </section>

            {/* 收货地址 */}
            <section className="space-y-3 border-t border-neutral-50 pt-5">
              <h3 className="text-[12px] font-semibold text-neutral-500 uppercase tracking-wider">配送信息</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2 space-y-1">
                  <span className="text-[12px] text-neutral-500 ml-1">详细地址</span>
                  <input value={draftOrder.data.shippingAddress.street} onChange={event => updateAddress('street', event.target.value)} placeholder="街道、门牌号" className="ruda-input w-full" />
                </div>
                {([
                  ['recipient', '收件人'],
                  ['phone', '联系电话'],
                  ['city', '城市'],
                  ['country', '国家'],
                  ['zip', '邮编']
                ] as const).map(([key, label]) => (
                  <div key={key} className="space-y-1">
                    <span className="text-[12px] text-neutral-500 ml-1">{label}</span>
                    <input value={draftOrder.data.shippingAddress[key] || ''} onChange={event => updateAddress(key, event.target.value)} className="ruda-input w-full" />
                  </div>
                ))}
              </div>
            </section>

            {/* 交易约定 */}
            <section className="space-y-3 border-t border-neutral-50 pt-5">
              <h3 className="text-[12px] font-semibold text-neutral-500 uppercase tracking-wider">交易约定</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <span className="text-[12px] text-neutral-500 ml-1">付款方式</span>
                  <select 
                    value={draftOrder.data.terms.paymentMethod} 
                    onChange={event => updateDraft(draft => ({ ...draft, terms: { ...draft.terms, paymentMethod: event.target.value } }))} 
                    className="ruda-input w-full appearance-none bg-neutral-50"
                  >
                    <option value="bank_transfer">银行转账</option>
                    <option value="credit_card">银行卡</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <span className="text-[12px] text-neutral-500 ml-1">付款条件</span>
                  <select 
                    value={draftOrder.data.terms.paymentPlan} 
                    onChange={event => {
                      const paymentPlan = event.target.value as MerchantAssistedOrderDraft['terms']['paymentPlan'];
                      updateDraft(draft => ({
                        ...draft,
                        terms: {
                          ...draft.terms,
                          paymentPlan,
                          remainingBalanceTrigger: paymentPlan === 'ship_before_payment' ? 'on_delivery' : paymentPlan === 'custom' ? 'custom' : 'before_shipment'
                        }
                      }));
                    }} 
                    className="ruda-input w-full appearance-none bg-neutral-50"
                  >
                    <option value="full_prepayment">全额先付</option>
                    <option value="ship_before_payment">先发货后付款</option>
                    <option value="partial_prepayment">部分预付</option>
                    <option value="custom">其他约定</option>
                  </select>
                </div>
              </div>
            </section>
          </div>

          <div className="shrink-0 border-t border-neutral-100 bg-white px-4 py-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] flex gap-3 ruda-action-bar">
            <button 
              type="button" 
              onClick={saveDraft} 
              disabled={busy} 
              className="ruda-btn-secondary flex-1"
            >
              保存草稿
            </button>
            <button 
              type="button" 
              onClick={submitOrder} 
              disabled={busy} 
              className="ruda-btn-primary flex-1"
            >
              确认开单
            </button>
          </div>
        </div>
      )}
    </section>
  );
};
