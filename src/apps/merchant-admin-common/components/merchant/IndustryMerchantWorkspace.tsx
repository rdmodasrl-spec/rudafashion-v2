import React, { useEffect, useMemo, useState } from 'react';
import { BarChart3, Boxes, Building2, ClipboardList, Package, Plus, Receipt, Search, ShoppingCart, Store, Truck, Users } from 'lucide-react';
import { useB2B } from '../../../../context/B2BContext';
import { apiGet, apiPost } from '../../../../api/client';
import { PRODUCT_CATEGORIES, getProductCategoryLabel } from '../../../../constants/productCategories';
import type { Order, Product, WholesaleCustomer } from '../../../../types/b2b';
import { MerchantProcurementWorkspace } from './MerchantProcurementWorkspace';

type IndustryWorkspaceTab = 'dashboard' | 'products' | 'inventory' | 'orders' | 'procurement' | 'customers' | 'pos' | 'settings';

type InventoryBalance = {
  id: string;
  sku: string;
  product: { id: string; styleNo: string; name: string };
  location: { code: string; name: string };
  onHandQuantity: number;
  reservedQuantity: number;
  availableQuantity: number;
};

type IndustryWorkspaceDefinition = {
  templateId: string;
  title: string;
  summary: string;
  productName: string;
  skuLabel: string;
  inventoryName: string;
  orderName: string;
  tabs: IndustryWorkspaceTab[];
  quickActions: Array<{ tab: IndustryWorkspaceTab; label: string }>;
  creationLabels: {
    styleNo: string;
    name: string;
    sku: string;
    category: string;
    price: string;
    stock: string;
  };
};

const definitions: Record<string, IndustryWorkspaceDefinition> = {
  apparel_wholesale: {
    templateId: 'apparel_wholesale',
    title: '服装批发商后台',
    summary: '围绕款式、颜色尺码、SKU、现货批发价、MOQ、客户和订单组织工作流。',
    productName: '服装款式',
    skuLabel: '颜色尺码 SKU',
    inventoryName: '现货库存',
    orderName: '批发订单',
    tabs: ['dashboard', 'products', 'inventory', 'orders', 'customers', 'procurement', 'settings'],
    quickActions: [
      { tab: 'products', label: '新增服装款式' },
      { tab: 'inventory', label: '查看现货库存' },
      { tab: 'orders', label: '处理批发订单' }
    ],
    creationLabels: { styleNo: '款号', name: '款式名称', sku: '首个颜色尺码 SKU', category: '服装品类', price: '批发价', stock: '现货数量' }
  },
  trading_wholesale: {
    templateId: 'trading_wholesale',
    title: '贸易批发商后台',
    summary: '围绕多品牌、多供应商、采购成本、批发销售、客户、供应商和库存组织工作流。',
    productName: '贸易商品',
    skuLabel: '供应商 SKU',
    inventoryName: '可售库存',
    orderName: '批发销售单',
    tabs: ['dashboard', 'products', 'procurement', 'inventory', 'orders', 'customers', 'settings'],
    quickActions: [
      { tab: 'procurement', label: '创建采购单' },
      { tab: 'products', label: '录入贸易商品' },
      { tab: 'inventory', label: '核对进货库存' }
    ],
    creationLabels: { styleNo: '商品编号', name: '商品名称', sku: '供应商 SKU', category: '商品品类', price: '批发价', stock: '入库数量' }
  },
  department_wholesale: {
    templateId: 'department_wholesale',
    title: '百货批发商后台',
    summary: '支持多品类商品、批量采购、批发价格、SKU、库存、客户订单和供应商协同。',
    productName: '百货商品',
    skuLabel: '多品类 SKU',
    inventoryName: '仓储库存',
    orderName: '客户批发订单',
    tabs: ['dashboard', 'products', 'inventory', 'procurement', 'orders', 'customers', 'settings'],
    quickActions: [
      { tab: 'products', label: '新增百货商品' },
      { tab: 'procurement', label: '批量采购' },
      { tab: 'orders', label: '查看客户订单' }
    ],
    creationLabels: { styleNo: '商品编码', name: '商品名称', sku: 'SKU / 条码', category: '百货品类', price: '批发价', stock: '库存数量' }
  },
  bags_wholesale: {
    templateId: 'bags_wholesale',
    title: '箱包批发商后台',
    summary: '围绕箱包款式、材质、颜色、尺寸、SKU、批发价格、库存和订单组织工作流。',
    productName: '箱包款式',
    skuLabel: '颜色尺寸 SKU',
    inventoryName: '箱包库存',
    orderName: '箱包批发订单',
    tabs: ['dashboard', 'products', 'inventory', 'orders', 'customers', 'procurement', 'settings'],
    quickActions: [
      { tab: 'products', label: '新增箱包款式' },
      { tab: 'inventory', label: '核对箱包库存' },
      { tab: 'orders', label: '处理箱包订单' }
    ],
    creationLabels: { styleNo: '款式编号', name: '箱包名称', sku: '颜色尺寸 SKU', category: '箱包品类', price: '批发价', stock: '库存数量' }
  },
  department_chain_retail: {
    templateId: 'department_chain_retail',
    title: '百货连锁店后台',
    summary: '面向多门店商品、门店库存、采购、调拨、POS 收银和门店经营数据。',
    productName: '门店商品',
    skuLabel: '门店 SKU / 条码',
    inventoryName: '门店库存',
    orderName: '门店销售单',
    tabs: ['dashboard', 'pos', 'products', 'inventory', 'procurement', 'orders', 'customers', 'settings'],
    quickActions: [
      { tab: 'pos', label: '打开 POS 收银' },
      { tab: 'inventory', label: '查看门店库存' },
      { tab: 'procurement', label: '发起采购调拨' }
    ],
    creationLabels: { styleNo: '商品条码', name: '商品名称', sku: '门店 SKU', category: '零售品类', price: '零售价', stock: '门店库存' }
  },
  general_retail: {
    templateId: 'general_retail',
    title: '综合零售商后台',
    summary: '面向通用商品、条码、零售价格、采购成本、库存、销售、POS 收银和退换货。',
    productName: '零售商品',
    skuLabel: '条码 / SKU',
    inventoryName: '零售库存',
    orderName: '零售销售单',
    tabs: ['dashboard', 'pos', 'products', 'inventory', 'procurement', 'orders', 'customers', 'settings'],
    quickActions: [
      { tab: 'pos', label: '开始收银' },
      { tab: 'products', label: '录入零售商品' },
      { tab: 'inventory', label: '管理库存' }
    ],
    creationLabels: { styleNo: '商品条码', name: '商品名称', sku: 'SKU', category: '通用品类', price: '零售价', stock: '库存数量' }
  }
};

const fallbackDefinition = definitions.apparel_wholesale;

function money(value: number | string | null | undefined) {
  const amount = Number(value || 0);
  return Number.isFinite(amount) ? `€${amount.toFixed(2)}` : '€0.00';
}

export const IndustryMerchantWorkspace: React.FC<{ mobileMode?: boolean; onBackToLogin?: () => void }> = ({ mobileMode = false }) => {
  const { merchants, products, orders, allCustomers, authMerchantId, activeMerchantId, selectedMerchantId, lang, addNotification, syncMerchantData, replaceMerchantProductsFromServer } = useB2B() as any;
  const merchantId = authMerchantId || activeMerchantId || selectedMerchantId;
  const merchant = merchants.find((item: any) => item.id === merchantId) || merchants[0];
  const templateId = merchant?.workspace?.templateId || merchant?.industryTemplate || '';
  const definition = definitions[templateId] || fallbackDefinition;
  const [activeTab, setActiveTab] = useState<IndustryWorkspaceTab>('dashboard');
  const [inventoryBalances, setInventoryBalances] = useState<InventoryBalance[]>([]);
  const [inventoryLoading, setInventoryLoading] = useState(false);
  const [productSubmitting, setProductSubmitting] = useState(false);
  const [productError, setProductError] = useState('');
  const [productDraft, setProductDraft] = useState({
    styleNo: '',
    name: '',
    category: PRODUCT_CATEGORIES[0]?.value || 'CLOTHING',
    sku: '',
    price: '0',
    stock: '0'
  });
  const isIt = lang === 'it';
  const merchantProducts: Product[] = products.filter((product: Product) => product.merchantId === merchant?.id);
  const merchantOrders: Order[] = orders.filter((order: Order) => order.merchantId === merchant?.id);
  const merchantCustomers: WholesaleCustomer[] = allCustomers;

  useEffect(() => {
    if (!merchant?.id || activeTab !== 'inventory') return;
    let alive = true;
    setInventoryLoading(true);
    apiGet<{ success: true; balances: InventoryBalance[] }>('/api/merchant/inventory/balances?pageSize=300')
      .then(result => { if (alive) setInventoryBalances(result.balances || []); })
      .catch(error => {
        if (alive) addNotification('warning', '库存加载失败', error instanceof Error ? error.message : '请稍后重试');
      })
      .finally(() => { if (alive) setInventoryLoading(false); });
    return () => { alive = false; };
  }, [activeTab, addNotification, merchant?.id]);

  const stats = useMemo(() => {
    const orderValue = merchantOrders.reduce((sum, order) => sum + Number(order.totalAmount || 0), 0);
    const stock = inventoryBalances.reduce((sum, item) => sum + Number(item.availableQuantity || 0), 0);
    return [
      { label: definition.productName, value: merchantProducts.length },
      { label: definition.orderName, value: merchantOrders.length },
      { label: definition.inventoryName, value: stock },
      { label: '订单金额', value: money(orderValue) }
    ];
  }, [definition.inventoryName, definition.orderName, definition.productName, inventoryBalances, merchantOrders, merchantProducts.length]);

  const createDraftProduct = async (event: React.FormEvent) => {
    event.preventDefault();
    setProductError('');
    if (!productDraft.styleNo.trim() || !productDraft.name.trim() || !productDraft.sku.trim()) {
      setProductError('请填写编号、名称和 SKU。');
      return;
    }
    setProductSubmitting(true);
    try {
      const result = await apiPost<{ success: true; product: Product }>('/api/merchant/products', {
        styleNo: productDraft.styleNo,
        name: productDraft.name,
        category: productDraft.category,
        wholesalePrice: Number(productDraft.price || 0),
        rrpPrice: Number(productDraft.price || 0),
        moq: 1,
        packSize: 1,
        lifecycleStatus: 'draft',
        status: 'new',
        visibility: 'public',
        skus: [{
          sku: productDraft.sku,
          color: '默认',
          size: '默认',
          stockCentral: Number(productDraft.stock || 0),
          isActive: true
        }]
      });
      if (result.product && merchant?.id) {
        replaceMerchantProductsFromServer?.(merchant.id, [result.product, ...merchantProducts.filter(product => product.id !== result.product.id)]);
      } else if (merchant?.id) {
        await syncMerchantData?.(merchant.id);
      }
      setProductDraft({ styleNo: '', name: '', category: PRODUCT_CATEGORIES[0]?.value || 'CLOTHING', sku: '', price: '0', stock: '0' });
      addNotification('success', '商品草稿已创建', `${definition.productName}已保存到当前商家。`);
    } catch (error) {
      setProductError(error instanceof Error ? error.message : '商品创建失败');
    } finally {
      setProductSubmitting(false);
    }
  };

  if (!merchant) {
    return <div className="min-h-screen bg-neutral-50 p-6 text-sm text-neutral-600">请先登录已开通的商家账号。</div>;
  }

  const navIcon: Record<IndustryWorkspaceTab, React.ElementType> = {
    dashboard: BarChart3,
    products: Package,
    inventory: Boxes,
    orders: Truck,
    procurement: ClipboardList,
    customers: Users,
    pos: ShoppingCart,
    settings: Store
  };

  return (
    <main className={`min-h-screen bg-neutral-50 text-neutral-950 ${mobileMode ? 'pb-20' : ''}`}>
      <div className="border-b border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-4">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-neutral-500"><Building2 className="h-4 w-4" />{merchant.name}</div>
            <h1 className="mt-1 text-xl font-bold tracking-tight">{definition.title}</h1>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-neutral-600">{definition.summary}</p>
          </div>
          <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs text-neutral-600">
            模板：{definition.templateId}
          </div>
        </div>
      </div>

      <div className="mx-auto grid max-w-7xl gap-4 px-4 py-4 lg:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="space-y-1 rounded-lg border border-neutral-200 bg-white p-2 lg:sticky lg:top-4 lg:h-fit">
          {definition.tabs.map(tab => {
            const Icon = navIcon[tab];
            return (
              <button key={tab} type="button" onClick={() => setActiveTab(tab)} className={`flex min-h-10 w-full items-center gap-2 rounded-md px-3 text-left text-sm font-semibold ${activeTab === tab ? 'bg-neutral-950 text-white' : 'text-neutral-700 hover:bg-neutral-100'}`}>
                <Icon className="h-4 w-4" />
                {{
                  dashboard: '经营首页',
                  products: definition.productName,
                  inventory: definition.inventoryName,
                  orders: definition.orderName,
                  procurement: '采购供应',
                  customers: '客户往来',
                  pos: 'POS 收银',
                  settings: '后台设置'
                }[tab]}
              </button>
            );
          })}
        </aside>

        <section className="min-w-0 space-y-4">
          {activeTab === 'dashboard' && (
            <>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {stats.map(item => <div key={item.label} className="rounded-lg border border-neutral-200 bg-white p-4"><div className="text-xs font-semibold text-neutral-500">{item.label}</div><strong className="mt-2 block text-2xl">{item.value}</strong></div>)}
              </div>
              <div className="rounded-lg border border-neutral-200 bg-white p-4">
                <h2 className="text-sm font-bold">行业工作流</h2>
                <div className="mt-3 flex flex-wrap gap-2">
                  {definition.quickActions.map(action => (
                    <button key={action.label} type="button" onClick={() => setActiveTab(action.tab)} className="inline-flex min-h-10 items-center gap-2 rounded-md border border-neutral-300 px-3 text-sm font-semibold hover:border-neutral-950">
                      <Plus className="h-4 w-4" />{action.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                <RecentProducts products={merchantProducts} label={definition.productName} />
                <RecentOrders orders={merchantOrders} label={definition.orderName} />
              </div>
            </>
          )}

          {activeTab === 'products' && (
            <div className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
              <form onSubmit={createDraftProduct} className="rounded-lg border border-neutral-200 bg-white p-4">
                <h2 className="flex items-center gap-2 text-sm font-bold"><Plus className="h-4 w-4" />创建{definition.productName}草稿</h2>
                <div className="mt-4 space-y-3">
                  <Field label={definition.creationLabels.styleNo} value={productDraft.styleNo} onChange={value => setProductDraft(current => ({ ...current, styleNo: value }))} />
                  <Field label={definition.creationLabels.name} value={productDraft.name} onChange={value => setProductDraft(current => ({ ...current, name: value }))} />
                  <label className="block text-xs font-semibold text-neutral-600">{definition.creationLabels.category}<select value={productDraft.category} onChange={event => setProductDraft(current => ({ ...current, category: event.target.value }))} className="mt-1 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-950">{PRODUCT_CATEGORIES.map(category => <option key={category.value} value={category.value}>{getProductCategoryLabel(category.value, isIt)}</option>)}</select></label>
                  <Field label={definition.creationLabels.sku} value={productDraft.sku} onChange={value => setProductDraft(current => ({ ...current, sku: value }))} />
                  <Field label={definition.creationLabels.price} type="number" value={productDraft.price} onChange={value => setProductDraft(current => ({ ...current, price: value }))} />
                  <Field label={definition.creationLabels.stock} type="number" value={productDraft.stock} onChange={value => setProductDraft(current => ({ ...current, stock: value }))} />
                  {productError && <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{productError}</p>}
                  <button type="submit" disabled={productSubmitting} className="min-h-10 w-full rounded-md bg-neutral-950 px-3 text-sm font-semibold text-white disabled:opacity-50">{productSubmitting ? '保存中...' : '保存草稿'}</button>
                </div>
              </form>
              <ProductTable products={merchantProducts} label={definition.productName} />
            </div>
          )}

          {activeTab === 'inventory' && (
            <div className="rounded-lg border border-neutral-200 bg-white p-4">
              <h2 className="text-sm font-bold">{definition.inventoryName}</h2>
              {inventoryLoading ? <p className="mt-4 text-sm text-neutral-500">正在加载库存...</p> : <InventoryTable balances={inventoryBalances} />}
            </div>
          )}

          {activeTab === 'orders' && <OrderTable orders={merchantOrders} label={definition.orderName} />}
          {activeTab === 'procurement' && <MerchantProcurementWorkspace products={merchantProducts} isIt={isIt} />}
          {activeTab === 'customers' && <CustomerTable customers={merchantCustomers} />}
          {activeTab === 'pos' && <PosSummary orders={merchantOrders} products={merchantProducts} />}
          {activeTab === 'settings' && (
            <div className="rounded-lg border border-neutral-200 bg-white p-4">
              <h2 className="text-sm font-bold">行业后台设置</h2>
              <dl className="mt-4 grid gap-3 sm:grid-cols-2">
                <InfoItem label="商家" value={merchant.name} />
                <InfoItem label="工作区" value={definition.title} />
                <InfoItem label="商家 ID" value={merchant.id} />
                <InfoItem label="城市" value={[merchant.city, merchant.country].filter(Boolean).join(', ') || '待完善'} />
              </dl>
            </div>
          )}
        </section>
      </div>
    </main>
  );
};

const Field: React.FC<{ label: string; value: string; type?: string; onChange: (value: string) => void }> = ({ label, value, type = 'text', onChange }) => (
  <label className="block text-xs font-semibold text-neutral-600">{label}<input type={type} value={value} onChange={event => onChange(event.target.value)} className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm text-neutral-950 outline-none focus:border-neutral-950" /></label>
);

const InfoItem: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div className="rounded-md bg-neutral-50 p-3"><dt className="text-xs text-neutral-500">{label}</dt><dd className="mt-1 text-sm font-semibold text-neutral-900">{value}</dd></div>
);

const RecentProducts: React.FC<{ products: Product[]; label: string }> = ({ products, label }) => (
  <div className="rounded-lg border border-neutral-200 bg-white p-4"><h2 className="text-sm font-bold">最近{label}</h2><div className="mt-3 space-y-2">{products.slice(0, 5).map(product => <div key={product.id} className="flex items-center justify-between rounded-md bg-neutral-50 px-3 py-2 text-sm"><span>{product.styleNo || product.name}</span><span className="text-neutral-500">{money(product.wholesalePrice)}</span></div>)}{!products.length && <p className="text-sm text-neutral-500">暂无商品草稿。</p>}</div></div>
);

const RecentOrders: React.FC<{ orders: Order[]; label: string }> = ({ orders, label }) => (
  <div className="rounded-lg border border-neutral-200 bg-white p-4"><h2 className="text-sm font-bold">最近{label}</h2><div className="mt-3 space-y-2">{orders.slice(0, 5).map(order => <div key={order.id} className="flex items-center justify-between rounded-md bg-neutral-50 px-3 py-2 text-sm"><span>{order.orderNo}</span><span className="text-neutral-500">{money(order.totalAmount)}</span></div>)}{!orders.length && <p className="text-sm text-neutral-500">暂无订单。</p>}</div></div>
);

const ProductTable: React.FC<{ products: Product[]; label: string }> = ({ products, label }) => (
  <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white"><div className="flex items-center gap-2 border-b border-neutral-200 p-4"><Search className="h-4 w-4 text-neutral-400" /><h2 className="text-sm font-bold">{label}列表</h2></div><div className="overflow-x-auto"><table className="w-full min-w-[720px] text-left text-sm"><thead className="bg-neutral-50 text-xs text-neutral-500"><tr><th className="px-4 py-3">编号</th><th className="px-4 py-3">名称</th><th className="px-4 py-3">品类</th><th className="px-4 py-3">SKU</th><th className="px-4 py-3">价格</th><th className="px-4 py-3">状态</th></tr></thead><tbody className="divide-y divide-neutral-100">{products.map(product => <tr key={product.id}><td className="px-4 py-3 font-semibold">{product.styleNo}</td><td className="px-4 py-3">{product.name}</td><td className="px-4 py-3">{product.category}</td><td className="px-4 py-3">{product.skus?.length || 0}</td><td className="px-4 py-3">{money(product.wholesalePrice)}</td><td className="px-4 py-3">{product.lifecycleStatus}</td></tr>)}{!products.length && <tr><td colSpan={6} className="px-4 py-10 text-center text-neutral-500">暂无商品。</td></tr>}</tbody></table></div></div>
);

const InventoryTable: React.FC<{ balances: InventoryBalance[] }> = ({ balances }) => (
  <div className="mt-3 overflow-x-auto"><table className="w-full min-w-[680px] text-left text-sm"><thead className="bg-neutral-50 text-xs text-neutral-500"><tr><th className="px-3 py-3">商品</th><th className="px-3 py-3">SKU</th><th className="px-3 py-3">库位</th><th className="px-3 py-3">在库</th><th className="px-3 py-3">预留</th><th className="px-3 py-3">可售</th></tr></thead><tbody className="divide-y divide-neutral-100">{balances.map(item => <tr key={item.id}><td className="px-3 py-3">{item.product.styleNo} · {item.product.name}</td><td className="px-3 py-3">{item.sku}</td><td className="px-3 py-3">{item.location.name}</td><td className="px-3 py-3">{item.onHandQuantity}</td><td className="px-3 py-3">{item.reservedQuantity}</td><td className="px-3 py-3 font-semibold">{item.availableQuantity}</td></tr>)}{!balances.length && <tr><td colSpan={6} className="px-3 py-10 text-center text-neutral-500">暂无库存记录。</td></tr>}</tbody></table></div>
);

const OrderTable: React.FC<{ orders: Order[]; label: string }> = ({ orders, label }) => (
  <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white"><div className="border-b border-neutral-200 p-4"><h2 className="text-sm font-bold">{label}</h2></div><div className="overflow-x-auto"><table className="w-full min-w-[720px] text-left text-sm"><thead className="bg-neutral-50 text-xs text-neutral-500"><tr><th className="px-4 py-3">订单号</th><th className="px-4 py-3">客户</th><th className="px-4 py-3">金额</th><th className="px-4 py-3">状态</th><th className="px-4 py-3">支付</th></tr></thead><tbody className="divide-y divide-neutral-100">{orders.map(order => <tr key={order.id}><td className="px-4 py-3 font-semibold">{order.orderNo}</td><td className="px-4 py-3">{order.customerCompanyName}</td><td className="px-4 py-3">{money(order.totalAmount)}</td><td className="px-4 py-3">{order.status}</td><td className="px-4 py-3">{order.paymentStatus}</td></tr>)}{!orders.length && <tr><td colSpan={5} className="px-4 py-10 text-center text-neutral-500">暂无订单。</td></tr>}</tbody></table></div></div>
);

const CustomerTable: React.FC<{ customers: WholesaleCustomer[] }> = ({ customers }) => (
  <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white"><div className="border-b border-neutral-200 p-4"><h2 className="text-sm font-bold">客户往来</h2></div><div className="overflow-x-auto"><table className="w-full min-w-[680px] text-left text-sm"><thead className="bg-neutral-50 text-xs text-neutral-500"><tr><th className="px-4 py-3">公司</th><th className="px-4 py-3">联系人</th><th className="px-4 py-3">邮箱</th><th className="px-4 py-3">状态</th></tr></thead><tbody className="divide-y divide-neutral-100">{customers.map(customer => <tr key={customer.id}><td className="px-4 py-3 font-semibold">{customer.companyName}</td><td className="px-4 py-3">{customer.contactPerson}</td><td className="px-4 py-3">{customer.email}</td><td className="px-4 py-3">{customer.status}</td></tr>)}{!customers.length && <tr><td colSpan={4} className="px-4 py-10 text-center text-neutral-500">暂无客户。</td></tr>}</tbody></table></div></div>
);

const PosSummary: React.FC<{ orders: Order[]; products: Product[] }> = ({ orders, products }) => (
  <div className="rounded-lg border border-neutral-200 bg-white p-4">
    <h2 className="flex items-center gap-2 text-sm font-bold"><Receipt className="h-4 w-4" />POS 收银与退换货</h2>
    <p className="mt-2 text-sm leading-6 text-neutral-600">POS 使用现有商家订单与库存服务，销售会进入同一订单与库存事实源。</p>
    <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <InfoItem label="可售商品" value={products.length} />
      <InfoItem label="销售/订单记录" value={orders.length} />
      <InfoItem label="已收款订单" value={orders.filter(order => order.paymentStatus === 'paid').length} />
    </div>
  </div>
);

export function isSpecializedIndustryWorkspace(templateId: unknown): boolean {
  return typeof templateId === 'string' && Object.hasOwn(definitions, templateId);
}
