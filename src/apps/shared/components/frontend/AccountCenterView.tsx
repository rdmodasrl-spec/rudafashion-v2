import React, { useState } from 'react';
import { 
  Building2, 
  Package, 
  RotateCcw, 
  Clock, 
  Truck, 
  CheckCircle2, 
  BookmarkPlus, 
  Layers, 
  Calendar, 
  ChevronRight
} from 'lucide-react';
import { useB2B } from '../../../../context/B2BContext';
import { Order, OrderStatus } from '../../../../types/b2b';

export const AccountCenterView: React.FC = () => {
  const { 
    currentCustomer, 
    orders, 
    reorderDirectly, 
    setCurrentView, 
    savedCarts, 
    loadDraftCart, 
    appointments,
    lang,
    t, localizeCopy
  } = useB2B();

  const isIt = lang === 'it';

  const [activeTab, setActiveTab] = useState<'orders' | 'reorder' | 'saved_carts' | 'prices' | 'company' | 'appointments'>('orders');
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(orders.length > 0 ? orders[0].id : null);

  const selectedOrder = orders.find(o => o.id === selectedOrderId) || (orders.length > 0 ? orders[0] : null);

  // Status visual steps
  const orderSteps: Array<{ key: OrderStatus; label: string }> = [
    { key: 'placed', label: localizeCopy('已下单', 'Inviato') },
    { key: 'confirmed', label: localizeCopy('已确认', 'Confermato') },
    { key: 'picking', label: localizeCopy('配货中', 'Preparazione') },
    { key: 'shipped', label: localizeCopy('已发货', 'Spedito') },
    { key: 'delivered', label: localizeCopy('已签收', 'Consegnato') },
  ];

  const getStepIndex = (status: OrderStatus) => {
    switch (status) {
      case 'placed': return 0;
      case 'confirmed': return 1;
      case 'picking': return 2;
      case 'shipped': return 3;
      case 'delivered': return 4;
      default: return 0;
    }
  };

  const getStatusBadge = (status: OrderStatus) => {
    switch (status) {
      case 'placed':
        return <span className="px-2.5 py-0.5 rounded-lg text-[10px] font-semibold bg-neutral-100 text-neutral-700 border border-neutral-200">{localizeCopy('已提交', 'Inviato')}</span>;
      case 'confirmed':
        return <span className="px-2.5 py-0.5 rounded-lg text-[10px] font-semibold bg-neutral-200 text-neutral-900">{localizeCopy('已确认', 'Confermato')}</span>;
      case 'picking':
        return <span className="px-2.5 py-0.5 rounded-lg text-[10px] font-semibold bg-neutral-800 text-white">{localizeCopy('仓库配货中', 'Preparazione')}</span>;
      case 'shipped':
        return <span className="px-2.5 py-0.5 rounded-lg text-[10px] font-bold bg-black text-white">{localizeCopy('已发出', 'Spedito')}</span>;
      case 'delivered':
        return <span className="px-2.5 py-0.5 rounded-lg text-[10px] font-semibold bg-emerald-100 text-emerald-800">{localizeCopy('已签收完成', 'Consegnato')}</span>;
      default:
        return null;
    }
  };

  const tabItems = [
    { key: 'orders', label: localizeCopy('我的采购订单', 'Storico ordini'), icon: Package },
    { key: 'reorder', label: localizeCopy('一键补货单', 'Riordino rapido'), icon: RotateCcw },
    { key: 'saved_carts', label: localizeCopy('已存采购草稿', 'Bozze di acquisto'), icon: BookmarkPlus },
    { key: 'appointments', label: localizeCopy('展厅看货预约', 'Appuntamenti showroom'), icon: Calendar },
    { key: 'prices', label: localizeCopy('零售商专属价格', 'Listini e sconti'), icon: Layers },
    { key: 'company', label: localizeCopy('企业开票资料', 'Dati aziendali e P.IVA'), icon: Building2 },
  ];

  return (
    <div className="ui-page-shell space-y-8">
      {/* Buyer Profile Card */}
      <div className="bg-black text-white rounded-2xl p-6 sm:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 shadow-sm">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-full bg-white text-black text-[10px] font-bold tracking-wider uppercase">
              {localizeCopy('认证零售商账户', 'Account Rivenditore Verificato')}
            </span>
            <span className="text-xs text-neutral-400 font-mono">
              {localizeCopy("零售商代码: {{RUDA_ARG_0}}", "Codice: {{RUDA_ARG_0}}", [String(currentCustomer?.id)])}
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold font-serif text-white">
            {currentCustomer?.companyName}
          </h1>
          <div className="flex flex-wrap items-center gap-3 text-xs text-neutral-400">
            <span>{localizeCopy('联系人:', 'Referente:')} <strong className="text-white">{currentCustomer?.contactPerson}</strong></span>
            <span>•</span>
            <span>{localizeCopy('税号:', 'Partita IVA:')} <strong className="font-mono text-white">{currentCustomer?.vatNumber}</strong></span>
            <span>•</span>
            <span>{localizeCopy('零售商评级:', 'Fascia Listino:')} <strong className="text-white font-semibold">{currentCustomer?.tier === 'tier_major' ? (localizeCopy('战略合作伙伴 (82.5折)', 'Key Account Partner')) : (localizeCopy('VIP零售店 (9折)', 'Boutique Partner (90%)'))}</strong></span>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
          <button
            type="button"
            onClick={() => setCurrentView('catalog')}
            className="w-full sm:w-auto px-5 py-3 bg-white hover:bg-neutral-100 text-black font-bold text-xs rounded-xl transition-colors cursor-pointer text-center shadow-xs"
          >
            {localizeCopy('快速选款下单', 'Nuovo Ordine all\'Ingrosso')}
          </button>
        </div>
      </div>

      {/* Main Tabs Layout */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* Left Sub-nav */}
        <div className="md:col-span-3">
          <div className="bg-white border border-neutral-200 rounded-2xl p-2 flex md:flex-col overflow-x-auto gap-1 shadow-2xs">
            {tabItems.map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key as any)}
                  className={`whitespace-nowrap shrink-0 text-left px-3.5 py-3 rounded-xl text-xs font-semibold flex items-center gap-2.5 transition-all cursor-pointer ${
                    isActive 
                      ? 'bg-black text-white shadow-xs' 
                      : 'text-neutral-700 hover:bg-neutral-100'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-neutral-500'}`} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Content */}
        <div className="md:col-span-9 space-y-6">
          {/* TAB 1: ORDERS */}
          {activeTab === 'orders' && (
            <div className="space-y-6">
              <div className="bg-white border border-neutral-200 rounded-2xl overflow-hidden shadow-2xs">
                <div className="p-4 sm:p-5 border-b border-neutral-200 flex items-center justify-between">
                  <h3 className="font-bold text-xs uppercase tracking-wider text-black">
                    {localizeCopy("历史批发采购单 ({{RUDA_ARG_0}})", "Ordini Recenti ({{RUDA_ARG_0}})", [String(orders.length)])}
                  </h3>
                  <span className="text-[11px] text-neutral-500">
                    {localizeCopy('点击任意订单查看全流程轨迹', 'Seleziona un ordine per i dettagli')}
                  </span>
                </div>

                {/* Desktop Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-neutral-50 text-neutral-700 font-semibold border-b border-neutral-200">
                      <tr>
                        <th className="p-3.5">{localizeCopy('订单号', 'N. Ordine')}</th>
                        <th className="p-3.5">{localizeCopy('下单日期', 'Data')}</th>
                        <th className="p-3.5">{localizeCopy('采购件数', 'Capi')}</th>
                        <th className="p-3.5">{localizeCopy('总金额 (€)', 'Imponibile (€)')}</th>
                        <th className="p-3.5">{localizeCopy('配送履约', 'Spedizione')}</th>
                        <th className="p-3.5">{localizeCopy('订单状态', 'Stato')}</th>
                        <th className="p-3.5 text-right">{localizeCopy('操作', 'Azione')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100">
                      {orders.map((order) => {
                        const isSelected = selectedOrderId === order.id;
                        return (
                          <tr 
                            key={order.id} 
                            onClick={() => setSelectedOrderId(order.id)}
                            className={`hover:bg-neutral-50 transition-colors cursor-pointer ${
                              isSelected ? 'bg-neutral-100/70 font-medium' : ''
                            }`}
                          >
                            <td className="p-3.5 font-mono font-bold text-neutral-900">
                              {order.orderNo}
                            </td>
                            <td className="p-3.5 text-neutral-500">
                              {order.date}
                            </td>
                            <td className="p-3.5 font-medium text-neutral-800">
                              {order.totalQty} {localizeCopy('件', 'pz')}
                            </td>
                            <td className="p-3.5 font-bold font-serif text-neutral-950 text-sm">
                              €{order.totalAmount.toFixed(2)}
                            </td>
                            <td className="p-3.5 text-neutral-600">
                              {order.deliveryType === 'showroom_pickup' 
                                ? (localizeCopy('展厅自提', 'Ritiro Showroom'))
                                : (localizeCopy('中央仓快递', 'Corriere Diretto'))}
                            </td>
                            <td className="p-3.5">
                              {getStatusBadge(order.status)}
                            </td>
                            <td className="p-3.5 text-right">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  reorderDirectly(order.id);
                                }}
                                className="px-3 py-1.5 bg-black hover:bg-neutral-800 text-white rounded-lg text-[11px] font-semibold transition-colors inline-flex items-center gap-1 cursor-pointer"
                              >
                                <RotateCcw className="w-3 h-3" />
                                <span>{localizeCopy('再次补货', 'Riordina')}</span>
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Order Detail Progression */}
              {selectedOrder && (
                <div className="bg-white border border-neutral-200 rounded-2xl p-6 space-y-6 shadow-2xs">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-neutral-200 pb-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-bold font-mono text-neutral-900">
                          {selectedOrder.orderNo}
                        </h3>
                        {getStatusBadge(selectedOrder.status)}
                      </div>
                      <p className="text-xs text-neutral-500 mt-0.5">
                        {localizeCopy("创建时间: {{RUDA_ARG_0}} · 结算方式: 银行电汇 / 账期信用", "Registrato il {{RUDA_ARG_0}} · Condizione di pagamento: Bonifico Bancario Standard", [String(selectedOrder.date)])}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => reorderDirectly(selectedOrder.id)}
                        className="px-4 py-2 bg-black hover:bg-neutral-800 text-white rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                      >
                        <RotateCcw className="w-3.5 h-3.5 text-white" />
                        <span>{localizeCopy('直接一键补货', 'Riassortisci Questo Ordine')}</span>
                      </button>
                    </div>
                  </div>

                  {/* Stepper */}
                  <div className="py-2 overflow-x-auto">
                    <div className="relative flex items-center justify-between min-w-[320px]">
                      <div className="absolute left-0 top-1/2 -translate-y-1/2 h-0.5 bg-neutral-200 w-full -z-0" />
                      {orderSteps.map((step, idx) => {
                        const currentIdx = getStepIndex(selectedOrder.status);
                        const isDone = idx <= currentIdx;
                        return (
                          <div key={step.key} className="flex flex-col items-center gap-1.5 bg-white px-2 z-10">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${
                              isDone ? 'bg-black text-white' : 'bg-neutral-100 text-neutral-400 border border-neutral-200'
                            }`}>
                              {isDone ? <CheckCircle2 className="w-4 h-4 text-white" /> : idx + 1}
                            </div>
                            <span className={`text-[11px] ${isDone ? 'font-bold text-black' : 'text-neutral-400'}`}>
                              {step.label}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Delivery Info */}
                  <div className="bg-neutral-50 rounded-xl p-4 border border-neutral-200 text-xs grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <span className="text-neutral-500 block text-[11px]">
                        {localizeCopy('物流单号', 'Lettera di Vettura')}
                      </span>
                      <span className="font-mono font-bold text-neutral-900 text-sm">
                        {selectedOrder.trackingNumber || localizeCopy('待分配', 'In assegnazione')}
                      </span>
                    </div>

                    <div>
                      <span className="text-neutral-500 block text-[11px]">
                        {localizeCopy('履约发货模式', 'Modalità di Spedizione')}
                      </span>
                      <span className="font-semibold text-neutral-900">
                        {selectedOrder.deliveryType === 'showroom_pickup' 
                          ? (localizeCopy('展厅现场验货自提', 'Ritiro Diretto presso Showroom'))
                          : (localizeCopy('中央仓库国际速递直发', 'Corriere Espresso DHL'))}
                      </span>
                    </div>

                    <div>
                      <span className="text-neutral-500 block text-[11px]">
                        {localizeCopy('交付地址', 'Destinazione')}
                      </span>
                      <span className="text-neutral-700">
                        {typeof selectedOrder.shippingAddress === 'string' && selectedOrder.shippingAddress 
                          ? selectedOrder.shippingAddress 
                          : (localizeCopy('零售商预设收货地址', 'Sede Legale Boutique'))}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: REORDER */}
          {activeTab === 'reorder' && (
            <div className="bg-white border border-neutral-200 rounded-2xl p-6 space-y-6 shadow-2xs">
              <div>
                <h3 className="font-bold text-sm text-neutral-900 uppercase tracking-wider flex items-center gap-2">
                  <RotateCcw className="w-4 h-4 text-black" />
                  <span>{localizeCopy('一键复购补货中心', 'Riordino Rapido Capi')}</span>
                </h3>
                <p className="text-xs text-neutral-500 mt-1">
                  {localizeCopy('快速复购畅销爆款，无需重新翻找商品，直接点击一键复制全套款式与尺码入采购车。', 'Replica con un clic i capi, le taglie e i colori degli ordini precedenti direttamente nel carrello.')}
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {orders.map((o) => (
                  <div key={o.id} className="p-4 border border-neutral-200 rounded-xl space-y-3 bg-neutral-50/50">
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-neutral-900 text-xs">{o.orderNo}</span>
                      <span className="text-[11px] text-neutral-400">{o.date}</span>
                    </div>

                    <div className="space-y-1 text-xs">
                      <p className="text-neutral-700">
                        {localizeCopy("总计 {{RUDA_ARG_0}} 件 · €{{RUDA_ARG_1}}", "Totale: {{RUDA_ARG_0}} pz · €{{RUDA_ARG_1}}", [String(o.totalQty), String(o.totalAmount.toFixed(2))])}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => reorderDirectly(o.id)}
                      className="w-full py-2.5 bg-black hover:bg-neutral-800 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-colors shadow-xs"
                    >
                      <RotateCcw className="w-3.5 h-3.5 text-white" />
                      <span>{localizeCopy('复购此订单全套款式', 'Riordina Intero Carico')}</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: SAVED CARTS */}
          {activeTab === 'saved_carts' && (
            <div className="bg-white border border-neutral-200 rounded-2xl p-6 space-y-6 shadow-2xs">
              <div>
                <h3 className="font-bold text-sm text-neutral-900 uppercase tracking-wider">
                  {localizeCopy('已保存的采购单草稿', 'Bozze di Acquisto Archiviate')}
                </h3>
                <p className="text-xs text-neutral-500 mt-1">
                  {localizeCopy('零售商在看款期间保存的草稿，随时可一键载入重新下单。', 'Campionari salvati in fase di selezione per approvazione interna.')}
                </p>
              </div>

              {savedCarts.length === 0 ? (
                <div className="text-center py-10 text-neutral-400 text-xs">
                  {localizeCopy('暂无保存的草稿。在采购车页点击 [保存草稿] 即可在此归档。', 'Nessuna bozza archiviata al momento.')}
                </div>
              ) : (
                <div className="space-y-3">
                  {savedCarts.map((draft) => (
                    <div key={draft.id} className="p-4 border border-neutral-200 rounded-xl flex items-center justify-between bg-neutral-50">
                      <div>
                        <h4 className="font-bold text-neutral-900 text-xs">{draft.name}</h4>
                        <p className="text-[11px] text-neutral-500 mt-0.5">
                          {localizeCopy("保存于 {{RUDA_ARG_0}} · 共 {{RUDA_ARG_1}} 件 · 总金额 €{{RUDA_ARG_2}}", "Creato il {{RUDA_ARG_0}} · {{RUDA_ARG_1}} pz · €{{RUDA_ARG_2}}", [String(draft.createdAt), String(draft.totalQty), String(draft.totalAmount.toFixed(2))])}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => loadDraftCart(draft.id)}
                        className="px-4 py-2 bg-black text-white text-xs font-semibold rounded-xl hover:bg-neutral-800 transition-colors cursor-pointer shadow-xs"
                      >
                        {localizeCopy('一键载入采购车', 'Ricarica nel Carrello')}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: SHOWROOM APPOINTMENTS */}
          {activeTab === 'appointments' && (
            <div className="bg-white border border-neutral-200 rounded-2xl p-6 space-y-6 shadow-2xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="font-bold text-sm text-neutral-900 uppercase tracking-wider">
                    {localizeCopy('我的展厅看货预约', 'Appuntamenti Showroom & Atelier')}
                  </h3>
                  <p className="text-xs text-neutral-500 mt-1">
                    {localizeCopy('您已预约的实地到店看样接待记录。', 'Calendario delle visite fisiche in sede per campionatura.')}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setCurrentView('showrooms')}
                  className="px-4 py-2 bg-black hover:bg-neutral-800 text-white rounded-xl text-xs font-semibold cursor-pointer shadow-xs"
                >
                  {localizeCopy('+ 新增展厅预约', '+ Prenota Visita')}
                </button>
              </div>

              <div className="space-y-3">
                {appointments.map((apt) => (
                  <div key={apt.id} className="p-4 border border-neutral-200 rounded-xl bg-neutral-50 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-xs text-black">{apt.appointmentNo}</span>
                        <span className="font-bold text-xs text-neutral-900">{apt.showroomName}</span>
                      </div>
                      <span className="px-2.5 py-0.5 rounded-lg text-[10px] font-bold bg-neutral-200 text-black">
                        {apt.status === 'confirmed' ? (localizeCopy('已确认接待', 'Confermato')) : (localizeCopy('待确认', 'In Verifica'))}
                      </span>
                    </div>
                    <div className="text-xs text-neutral-600 grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <p>{localizeCopy('到店日期:', 'Data:')} <strong>{apt.date}</strong></p>
                      <p>{localizeCopy('预约时段:', 'Orario:')} <strong>{apt.time}</strong></p>
                      <p>{localizeCopy('同行人数:', 'Persone:')} <strong>{apt.visitorCount}</strong></p>
                      <p>{localizeCopy('关注品类:', 'Categorie:')} <strong>{apt.interests.join(', ')}</strong></p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 5: MY PRICES */}
          {activeTab === 'prices' && (
            <div className="bg-white border border-neutral-200 rounded-2xl p-6 space-y-6 shadow-2xs">
              <div>
                <h3 className="font-bold text-sm text-neutral-900 uppercase tracking-wider">
                  {localizeCopy('零售商价格等级与阶梯折扣矩阵', 'Condizioni Commerciali & Fasce di Prezzo')}
                </h3>
                <p className="text-xs text-neutral-500 mt-1">
                  {localizeCopy('根据您每季度的实际批发提货量，系统自动应用专属阶梯价格。', 'Listini applicati in base al volume stagionale di acquisti all\'ingrosso.')}
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className={`p-5 rounded-2xl border ${currentCustomer?.tier === 'tier_standard' ? 'border-neutral-900 bg-neutral-50 font-bold' : 'border-neutral-200'}`}>
                  <span className="text-[10px] text-neutral-400 block uppercase">{localizeCopy('等级 A', 'Fascia 1')}</span>
                  <h4 className="text-sm font-bold text-neutral-900 mt-1">{localizeCopy('普通标准批发', 'Wholesale Base')}</h4>
                  <p className="text-xs text-neutral-500 mt-1">{localizeCopy('标准批发定价 (100% 基准)', 'Listino base wholesale')}</p>
                  <span className="inline-block mt-3 text-[11px] text-neutral-600 bg-neutral-100 px-2.5 py-0.5 rounded-lg">
                    {localizeCopy('MOQ ≥ 4-6 件起', 'MOQ ≥ 4-6 pz')}
                  </span>
                </div>

                <div className={`p-5 rounded-2xl border ${currentCustomer?.tier === 'tier_vip' ? 'border-neutral-900 bg-neutral-50 font-bold ring-1 ring-black' : 'border-neutral-200'}`}>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-neutral-500 block uppercase font-medium">{localizeCopy('等级 B', 'Fascia 2')}</span>
                    {currentCustomer?.tier === 'tier_vip' && <span className="text-[10px] bg-black text-white px-2 py-0.5 rounded-full font-bold">{localizeCopy('当前等级', 'Tuo Listino')}</span>}
                  </div>
                  <h4 className="text-sm font-bold text-neutral-900 mt-1">{localizeCopy('VIP零售店客户', 'Boutique Partner')}</h4>
                  <p className="text-xs text-neutral-500 mt-1">{localizeCopy('全场享 90% 批发专享价 (9折)', 'Sconto 10% sui listini ingrosso')}</p>
                  <span className="inline-block mt-3 text-[11px] text-neutral-900 bg-neutral-200 px-2.5 py-0.5 rounded-lg font-semibold">
                    {localizeCopy('季度采购额 ≥ €5,000', 'Volume trimestrale ≥ €5.000')}
                  </span>
                </div>

                <div className={`p-5 rounded-2xl border ${currentCustomer?.tier === 'tier_major' ? 'border-neutral-900 bg-neutral-50 font-bold ring-1 ring-black' : 'border-neutral-200'}`}>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-neutral-500 block uppercase font-medium">{localizeCopy('等级 C', 'Fascia 3')}</span>
                    {currentCustomer?.tier === 'tier_major' && <span className="text-[10px] bg-black text-white px-2 py-0.5 rounded-full font-bold">{localizeCopy('当前等级', 'Tuo Listino')}</span>}
                  </div>
                  <h4 className="text-sm font-bold text-neutral-900 mt-1">{localizeCopy('战略大客户 / 连锁', 'Key Account Partner')}</h4>
                  <p className="text-xs text-neutral-500 mt-1">{localizeCopy('全场享 82.5% 战略价 (约8.2折)', 'Listino dedicato con sconto fino al 17.5%')}</p>
                  <span className="inline-block mt-3 text-[11px] text-neutral-900 bg-neutral-200 px-2.5 py-0.5 rounded-lg font-semibold">
                    {localizeCopy('季度采购额 ≥ €20,000', 'Volume trimestrale ≥ €20.000')}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 6: COMPANY INFORMATION */}
          {activeTab === 'company' && (
            <div className="bg-white border border-neutral-200 rounded-2xl p-6 space-y-4 shadow-2xs">
              <div>
                <h3 className="font-bold text-sm text-neutral-900 uppercase tracking-wider">
                  {localizeCopy('企业开票信息与 VIES 认证资料', 'Anagrafica Aziendale e Dati di Fatturazione')}
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div className="p-4 bg-neutral-50 rounded-xl border border-neutral-200">
                  <span className="text-neutral-400 block text-[10px]">{localizeCopy('注册企业名', 'Ragione Sociale')}</span>
                  <span className="font-bold text-neutral-900">{currentCustomer?.companyName}</span>
                </div>
                <div className="p-4 bg-neutral-50 rounded-xl border border-neutral-200">
                  <span className="text-neutral-400 block text-[10px]">{localizeCopy('增值税号 (VAT Number)', 'Partita IVA Comunitaria')}</span>
                  <span className="font-mono font-bold text-neutral-900">{currentCustomer?.vatNumber}</span>
                </div>
                <div className="p-4 bg-neutral-50 rounded-xl border border-neutral-200">
                  <span className="text-neutral-400 block text-[10px]">{localizeCopy('注册城市与国家', 'Città e Nazione')}</span>
                  <span className="font-bold text-neutral-900">{currentCustomer?.city}, {currentCustomer?.country}</span>
                </div>
                <div className="p-4 bg-neutral-50 rounded-xl border border-neutral-200">
                  <span className="text-neutral-400 block text-[10px]">{localizeCopy('联系电话', 'Telefono')}</span>
                  <span className="font-bold text-neutral-900">{currentCustomer?.phone}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
