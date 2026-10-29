import React, { useCallback, useEffect, useState } from 'react';
import { 
  Package, 
  Truck, 
  CheckCircle2, 
  Clock, 
  RotateCcw, 
  FileText, 
  Printer, 
  X,
  Layers,
  ArrowRight
  ,Share2,
  RefreshCw,
  ChevronDown
} from 'lucide-react';
import { useB2B } from '../../../../context/B2BContext';
import { Order } from '../../../../types/b2b';
import { apiGet, apiPost } from '../../../../api/client';
import { ProductImage } from '../common/ProductImage';
import { OrderProgressSummary } from '../common/OrderProgressSummary';
import { OrderChatPanel } from '../common/OrderChatPanel';
import { getOrderChainTask } from '../../../../shared/orderChain';

type ShipmentTrackingEvent = {
  id: string;
  status: string;
  location?: string | null;
  description?: string | null;
  occurredAt: string;
};

type OrderShipment = {
  id: string;
  shipmentNo: string;
  carrier?: string | null;
  trackingNumber?: string | null;
  status: string;
  shippedAt?: string | null;
  deliveredAt?: string | null;
  updatedAt: string;
  items: Array<{ orderItemId: string; quantity: number }>;
  trackingEvents: ShipmentTrackingEvent[];
};

export const OrdersView: React.FC<{ onReorderToCart?: () => void }> = ({ onReorderToCart }) => {
  const { orders, reorderHistoricOrder, requestReturn, setCurrentView, addNotification, syncBuyerOrders, lang, t, localizeCopy } = useB2B();
  const isIt = lang === 'it';

  const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'shipped' | 'delivered'>('all');
  const [activeDocModal, setActiveDocModal] = useState<'invoice' | 'packing_list' | null>(null);
  const [docOrder, setDocOrder] = useState<Order | null>(null);
  const [returnOrder, setReturnOrder] = useState<Order | null>(null);
  const [returnReason, setReturnReason] = useState('');
  const [returnQuantity, setReturnQuantity] = useState(0);
  const [agreementProposal, setAgreementProposal] = useState<{
    order: Order;
    agreementId: string;
    terms: NonNullable<Order['agreementVersions']>[number]['terms'];
    prepaymentMode: 'amount' | 'percent';
    prepaymentValue: string;
  } | null>(null);
  const [agreementProposalSaving, setAgreementProposalSaving] = useState(false);
  const [sharingOrderId, setSharingOrderId] = useState<string | null>(null);
  const [payingOrderId, setPayingOrderId] = useState<string | null>(null);
  const [expandedTrackingOrderId, setExpandedTrackingOrderId] = useState<string | null>(null);
  const [shipmentsByOrder, setShipmentsByOrder] = useState<Record<string, OrderShipment[]>>({});
  const [trackingLoading, setTrackingLoading] = useState(false);
  const [trackingError, setTrackingError] = useState<string | null>(null);
  const [activeChatOrderId, setActiveChatOrderId] = useState<string | null>(null);

  const loadOrderShipments = useCallback(async (orderId: string) => {
    setTrackingLoading(true);
    setTrackingError(null);
    try {
      const result = await apiGet<{ success: true; shipments: OrderShipment[] }>(
        `/api/orders/${encodeURIComponent(orderId)}/shipments`
      );
      setShipmentsByOrder(current => ({ ...current, [orderId]: result.shipments }));
    } catch (error) {
      setTrackingError(error instanceof Error ? error.message : '物流记录加载失败，请重试。');
    } finally {
      setTrackingLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!expandedTrackingOrderId) return;
    void loadOrderShipments(expandedTrackingOrderId);
    const interval = window.setInterval(() => void loadOrderShipments(expandedTrackingOrderId), 60_000);
    return () => window.clearInterval(interval);
  }, [expandedTrackingOrderId, loadOrderShipments]);

  // Filter orders
  const filteredOrders = orders.filter(o => {
    if (activeTab === 'all') return true;
    if (activeTab === 'pending') return o.status === 'placed' || o.status === 'pending' || o.status === 'confirmed';
    if (activeTab === 'shipped') return o.status === 'picking' || o.status === 'shipped';
    if (activeTab === 'delivered') return o.status === 'delivered';
    return true;
  });

  const handleOpenDoc = (order: Order, type: 'invoice' | 'packing_list') => {
    setDocOrder(order);
    setActiveDocModal(type);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleShare = async (order: Order, scope: 'order' | 'invoice') => {
    if (sharingOrderId) return;
    setSharingOrderId(order.id);
    try {
      const result = await apiPost<{ success: true; links: { order: string; invoice: string } }>(
        `/api/orders/${encodeURIComponent(order.id)}/share-links`, {}
      );
      const url = result.links[scope];
      const title = scope === 'invoice'
        ? localizeCopy('RUDA 发票 {{RUDA_ARG_0}}', 'Fattura RUDA {{RUDA_ARG_0}}', [String(order.orderNo)])
        : localizeCopy('RUDA 订单 {{RUDA_ARG_0}}', 'Ordine RUDA {{RUDA_ARG_0}}', [String(order.orderNo)]);
      const text = scope === 'invoice'
        ? `${title} · €${order.totalAmount.toFixed(2)}`
        : localizeCopy(
          '{{RUDA_ARG_0}} · {{RUDA_ARG_1}} 件 · €{{RUDA_ARG_2}}',
          '{{RUDA_ARG_0}} · {{RUDA_ARG_1}} pz · €{{RUDA_ARG_2}}',
          [title, String(order.totalQty), order.totalAmount.toFixed(2)]
        );
      if (navigator.share) {
        await navigator.share({ title, text, url });
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(`${text}\n${url}`);
        addNotification('success', localizeCopy('分享链接已复制', 'Link copiato'), localizeCopy('可粘贴到 WhatsApp、微信或邮件发送。', 'Puoi inviarlo via WhatsApp o email.'));
      } else {
        window.open(`https://wa.me/?text=${encodeURIComponent(`${text}\n${url}`)}`, '_blank', 'noopener,noreferrer');
      }
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) {
        addNotification('warning', localizeCopy('分享失败', 'Condivisione non riuscita'), localizeCopy('请稍后重试。', 'Riprova tra poco.'));
      }
    } finally {
      setSharingOrderId(null);
    }
  };

  const handleReorder = (orderId: string) => {
    reorderHistoricOrder(orderId);
    addNotification(
      'success',
      localizeCopy('已加入采购车', 'Articoli Aggiunti'),
      localizeCopy('历史订单款项与配码已成功载入采购车，可直接进行二次确认下单。', 'I capi dell\'ordine sono stati ricaricati nel carrello per il riassortimento.')
    );
    if (onReorderToCart) onReorderToCart();
    else setCurrentView('cart');
  };

  const handleReturnSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!returnOrder || !returnReason.trim()) return;
    requestReturn(returnOrder.id, returnReason.trim(), returnQuantity || undefined);
    setReturnOrder(null);
    setReturnReason('');
    setReturnQuantity(0);
  };

  const handleCardPayment = async (order: Order) => {
    if (payingOrderId) return;
    setPayingOrderId(order.id);
    try {
      const result = await apiPost<{
        success: true;
        payment: { status: string; checkoutUrl?: string };
      }>(`/api/orders/${encodeURIComponent(order.id)}/payment`, { paymentMethod: 'credit_card' });
      if (result.payment.checkoutUrl) {
        const checkoutUrl = new URL(result.payment.checkoutUrl);
        if (checkoutUrl.protocol !== 'https:') throw new Error('PAYMENT_CHECKOUT_URL_INVALID');
        window.location.assign(checkoutUrl.toString());
        return;
      }
      addNotification(
        'info',
        localizeCopy('付款处理中', 'Pagamento in elaborazione'),
        localizeCopy('支付服务尚未返回安全结算页面，请稍后刷新订单状态。', 'La pagina di pagamento sicuro non è ancora disponibile.')
      );
    } catch {
      addNotification(
        'warning',
        localizeCopy('暂时无法发起付款', 'Pagamento non disponibile'),
        localizeCopy('请确认商家已接受订单后重试，或稍后联系平台支持。', 'Verifica che il venditore abbia accettato l’ordine e riprova.')
      );
    } finally {
      setPayingOrderId(null);
    }
  };

  const handleBankTransferRegistration = async (order: Order) => {
    const paymentReference = window.prompt(
      localizeCopy(
        '请先按商家提供的收款信息完成转账，再输入银行交易参考号。商家核实到账前，订单不会标记为已付款。',
        'Dopo il bonifico inserisci il riferimento della transazione. Il venditore dovrà verificare l’accredito.'
      )
    )?.trim();
    if (!paymentReference) return;
    try {
      await apiPost(`/api/orders/${encodeURIComponent(order.id)}/payment`, {
        paymentMethod: 'bank_transfer',
        paymentReference
      });
      addNotification(
        'success',
        localizeCopy('已提交转账参考号', 'Riferimento inviato'),
        localizeCopy('订单仍为付款处理中；商家核实实际到账后才会开始备货。', 'Il venditore verificherà l’accredito prima di avviare la preparazione.')
      );
    } catch {
      addNotification(
        'warning',
        localizeCopy('转账信息提交失败', 'Invio non riuscito'),
        localizeCopy('请确认订单已被商家接受后重试。', 'Verifica che l’ordine sia stato accettato e riprova.')
      );
    }
  };

  const handleConfirmAgreement = async (order: Order) => {
    const agreement = [...(order.agreementVersions || [])].sort((left, right) => right.version - left.version)[0];
    if (!agreement || agreement.status !== 'pending_buyer') return;
    try {
      await apiPost(
        `/api/orders/${encodeURIComponent(order.id)}/agreements/${encodeURIComponent(agreement.id)}/confirm`,
        {}
      );
      await syncBuyerOrders();
      addNotification('success', localizeCopy('约定已确认', 'Condizioni confermate'), localizeCopy('订单将按双方确认的版本继续处理。', 'L’ordine proseguirà secondo le condizioni concordate.'));
    } catch (error) {
      addNotification('warning', localizeCopy('确认失败', 'Conferma non riuscita'), error instanceof Error ? error.message : localizeCopy('请刷新后重试。', 'Aggiorna e riprova.'));
    }
  };

  const openAgreementProposal = (order: Order) => {
    const agreement = [...(order.agreementVersions || [])].sort((left, right) => right.version - left.version)[0];
    if (!agreement || agreement.status !== 'pending_buyer') return;
    setAgreementProposal({
      order,
      agreementId: agreement.id,
      terms: {
        ...structuredClone(agreement.terms),
        expectedDeliveryAt: agreement.terms.expectedDeliveryAt?.slice(0, 10) || null,
        remainingBalanceDueAt: agreement.terms.remainingBalanceDueAt?.slice(0, 10) || null
      },
      prepaymentMode: 'amount',
      prepaymentValue: String(agreement.terms.prepaymentAmount || 0)
    });
  };

  const submitAgreementProposal = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!agreementProposal || agreementProposalSaving) return;
    const { order, terms, agreementId, prepaymentMode, prepaymentValue } = agreementProposal;
    const items = terms.items.map(item => ({
      orderItemId: item.orderItemId,
      quantity: Number(item.quantity),
      unitPrice: Number(item.unitPrice)
    }));
    const shippingFee = Number(terms.shippingFee);
    const discountAmount = Number(terms.discountAmount);
    const prepayment = Number(prepaymentValue);
    if (items.some(item => !Number.isInteger(item.quantity) || item.quantity < 1
      || !Number.isFinite(item.unitPrice) || item.unitPrice <= 0)
      || !Number.isFinite(shippingFee) || shippingFee < 0
      || !Number.isFinite(discountAmount) || discountAmount < 0
      || !Number.isFinite(prepayment) || prepayment < 0) {
      addNotification('warning', localizeCopy('方案内容无效', 'Condizioni non valide'), localizeCopy('请检查商品数量、价格、费用和预付款。', 'Controlla quantità, prezzi, spese e acconto.'));
      return;
    }
    if ((terms.paymentPlan === 'custom' || terms.remainingBalanceTrigger === 'custom') && !terms.customPaymentCondition?.trim()) {
      addNotification('warning', localizeCopy('缺少余款条件', 'Condizione saldo mancante'), localizeCopy('请填写自定义余款条件。', 'Inserisci la condizione personalizzata del saldo.'));
      return;
    }
    if (terms.remainingBalanceTrigger === 'date' && !terms.remainingBalanceDueAt) {
      addNotification('warning', localizeCopy('缺少余款日期', 'Data saldo mancante'), localizeCopy('请选择余款到期日期。', 'Seleziona la data di scadenza del saldo.'));
      return;
    }
    const proposalTerms = {
      ...terms,
      shippingFee,
      discountAmount,
      items,
      ...(terms.paymentPlan === 'partial_prepayment'
        ? prepaymentMode === 'percent'
          ? { prepaymentPercent: prepayment, prepaymentAmount: undefined }
          : { prepaymentAmount: prepayment, prepaymentPercent: undefined }
        : terms.paymentPlan === 'custom'
          ? { prepaymentAmount: prepayment > 0 ? prepayment : undefined }
          : { prepaymentAmount: undefined })
    };
    setAgreementProposalSaving(true);
    try {
      await apiPost(`/api/orders/${encodeURIComponent(order.id)}/agreements`, { agreementId, terms: proposalTerms });
      await syncBuyerOrders();
      setAgreementProposal(null);
      addNotification('success', localizeCopy('新方案已发送', 'Nuove condizioni inviate'), localizeCopy('商家确认前，订单不会按新方案付款或发货。', 'L’ordine attenderà la conferma del venditore.'));
    } catch (error) {
      addNotification('warning', localizeCopy('方案提交失败', 'Invio non riuscito'), error instanceof Error ? error.message : localizeCopy('请刷新后重试。', 'Aggiorna e riprova.'));
    } finally {
      setAgreementProposalSaving(false);
    }
  };

  const pendingCount = orders.filter(o => o.status === 'placed' || o.status === 'pending' || o.status === 'confirmed').length;
  const shippedCount = orders.filter(o => o.status === 'picking' || o.status === 'shipped').length;
  const deliveredCount = orders.filter(o => o.status === 'delivered').length;
  return (
    <div className="ui-page-shell max-w-5xl space-y-6">
      {/* 1. Header */}
      <div className="ui-page-header mb-0">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-black text-white rounded-lg">
              <Package className="w-5 h-5" />
            </span>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-neutral-950 font-serif">
              {localizeCopy('采购订单与发货单据', 'Gestione Ordini e Spedizioni')}
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-neutral-500 mt-1">
            {localizeCopy('查看订单进度、发货记录、单据与补货信息。', 'Consulta avanzamento ordini, spedizioni e documenti.')}
          </p>
        </div>

        <button
          type="button"
          onClick={() => setCurrentView('catalog')}
          className="px-4 py-2 text-xs font-semibold text-white bg-black hover:bg-neutral-800 rounded-xl transition-colors shrink-0 cursor-pointer shadow-xs"
        >
          {localizeCopy('前往选款补货', 'Nuovo Riassortimento')}
        </button>
      </div>

      {/* 2. Status Filter Tabs */}
      <div className="ui-tab-list no-scrollbar">
        <button
          type="button"
          onClick={() => setActiveTab('all')}
          className={`ui-tab cursor-pointer ${
            activeTab === 'all' ? 'bg-black text-white shadow-xs' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
          }`}
        >
          {localizeCopy("全部订单 ({{RUDA_ARG_0}})", "Tutti gli Ordini ({{RUDA_ARG_0}})", [String(orders.length)])}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('pending')}
          className={`ui-tab flex cursor-pointer items-center gap-1.5 ${
            activeTab === 'pending' ? 'bg-black text-white shadow-xs' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          <span>{localizeCopy("待处理 ({{RUDA_ARG_0}})", "In Preparazione ({{RUDA_ARG_0}})", [String(pendingCount)])}</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('shipped')}
          className={`ui-tab flex cursor-pointer items-center gap-1.5 ${
            activeTab === 'shipped' ? 'bg-black text-white shadow-xs' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
          }`}
        >
          <Truck className="w-3.5 h-3.5" />
          <span>{localizeCopy("发货中 / 运输中 ({{RUDA_ARG_0}})", "In Spedizione ({{RUDA_ARG_0}})", [String(shippedCount)])}</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('delivered')}
          className={`ui-tab flex cursor-pointer items-center gap-1.5 ${
            activeTab === 'delivered' ? 'bg-black text-white shadow-xs' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
          }`}
        >
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>{localizeCopy("已完成 ({{RUDA_ARG_0}})", "Consegnati ({{RUDA_ARG_0}})", [String(deliveredCount)])}</span>
        </button>
      </div>

      {/* 3. Orders List */}
      {filteredOrders.length === 0 ? (
        <div className="bg-white border border-neutral-200 rounded-2xl p-12 text-center space-y-3">
          <Package className="w-10 h-10 text-neutral-300 mx-auto" />
          <h3 className="text-sm font-bold text-neutral-700">
            {localizeCopy('当前分类暂无订单', 'Nessun ordine presente in questa sezione')}
          </h3>
          <p className="text-xs text-neutral-400">
            {localizeCopy('您可以直接通过采购单快速下单或从商城挑选现货', 'Puoi iniziare un ordine direttamente dal catalogo all\'ingrosso.')}
          </p>
          <button
            type="button"
            onClick={() => setCurrentView('catalog')}
            className="mt-2 px-4 py-2 bg-black text-white text-xs font-bold rounded-xl hover:bg-neutral-800 transition-colors cursor-pointer"
          >
            {localizeCopy('开始采购选款', 'Esplora Catalogo')}
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredOrders.map(order => {
            const currentAgreement = [...(order.agreementVersions || [])].sort((left, right) => right.version - left.version)[0];
            const currentTask = getOrderChainTask({
              status: order.status,
              paymentStatus: order.paymentStatus,
              paymentMethod: order.paymentMethod,
              paymentPlan: currentAgreement?.terms.paymentPlan,
              remainingBalanceTrigger: currentAgreement?.terms.remainingBalanceTrigger,
              totalAmount: order.totalAmount,
              paidAmount: order.paidAmount,
              paymentAmountDue: order.paymentAmountDue,
              canBeginPreparation: order.canBeginPreparation,
              canShipOrder: order.canShipOrder
            }, 'buyer', currentAgreement?.status);

            return (
              <div
                key={order.id}
                className="bg-white border border-neutral-200 rounded-2xl p-4 sm:p-5 shadow-2xs space-y-4 hover:border-neutral-300 transition-all"
              >
                {/* Order Top Line */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-100 pb-3">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-sm font-bold text-neutral-900">{order.orderNo}</span>
                    {(order.unreadMessageCount || 0) > 0 && (
                      <span className="rounded-full bg-neutral-950 px-2 py-0.5 text-[10px] font-semibold text-white">
                        {localizeCopy('{{RUDA_ARG_0}} 条未读消息', '{{RUDA_ARG_0}} messaggi non letti', [String(order.unreadMessageCount)])}
                      </span>
                    )}
                    <span className="text-xs text-neutral-400">
                      {localizeCopy("下单日期: {{RUDA_ARG_0}}", "Data: {{RUDA_ARG_0}}", [String(order.date)])}
                    </span>
                    <span className="text-xs px-2.5 py-0.5 bg-neutral-100 text-neutral-700 rounded-lg font-medium">
                      {order.deliveryType === 'showroom_pickup' 
                        ? localizeCopy('展厅自提 ({{RUDA_ARG_0}})', 'Ritiro showroom ({{RUDA_ARG_0}})', [String(order.pickupLocation || 'Prato')])
                        : (localizeCopy('国际物流直邮', 'Spedizione Corriere Espresso'))}
                    </span>
                  </div>

                </div>

                <OrderProgressSummary order={order} />

                <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      {currentAgreement && (
                        <div className="text-[11px] text-neutral-600">
                          <span className="font-semibold text-neutral-800">
                            {localizeCopy('约定版本 {{RUDA_ARG_0}}', 'Condizioni v{{RUDA_ARG_0}}', [String(currentAgreement.version)])}
                          </span>
                          <span className="ml-2">
                            {currentAgreement.status === 'pending_buyer'
                              ? localizeCopy('待你确认', 'Da confermare')
                              : currentAgreement.status === 'pending_merchant'
                                ? localizeCopy('待商家确认', 'In attesa del venditore')
                                : localizeCopy('双方已确认', 'Confermate')}
                          </span>
                          <span className="ml-2">
                            {currentAgreement.terms.paymentPlan === 'partial_prepayment'
                              ? localizeCopy('预付 €{{RUDA_ARG_0}}', 'Anticipo €{{RUDA_ARG_0}}', [currentAgreement.terms.prepaymentAmount.toFixed(2)])
                              : currentAgreement.terms.paymentPlan === 'ship_before_payment'
                                ? localizeCopy('先发货后付款', 'Spedizione prima del pagamento')
                                : currentAgreement.terms.paymentPlan === 'cash_on_delivery'
                                  ? localizeCopy('送达时付款', 'Pagamento alla consegna')
                                  : currentAgreement.terms.paymentPlan === 'custom'
                                    ? currentAgreement.terms.customPaymentCondition || ''
                                    : localizeCopy('全额预付', 'Pagamento anticipato')}
                          </span>
                        </div>
                      )}
                      {currentAgreement && (
                        <details className="mt-2 max-w-xl text-[11px] text-neutral-600">
                          <summary className="cursor-pointer font-semibold text-neutral-700">
                            {localizeCopy('查看本版本约定内容', 'Dettagli delle condizioni')}
                          </summary>
                          <div className="mt-2 space-y-1 rounded-lg border border-neutral-200 bg-white p-3">
                            <p>
                              {localizeCopy('订单总额', 'Totale ordine')}: €{currentAgreement.terms.totalAmount.toFixed(2)}
                              {' · '}{localizeCopy('运费', 'Spedizione')}: €{currentAgreement.terms.shippingFee.toFixed(2)}
                              {' · '}{localizeCopy('折扣', 'Sconto')}: €{currentAgreement.terms.discountAmount.toFixed(2)}
                            </p>
                            <p>
                              {localizeCopy('付款方式', 'Metodo di pagamento')}: {currentAgreement.terms.paymentMethod}
                              {' · '}{localizeCopy('供货方式', 'Fornitura')}: {currentAgreement.terms.supplyMode}
                            </p>
                            <p>
                              {localizeCopy('预付款', 'Anticipo')}: €{currentAgreement.terms.prepaymentAmount.toFixed(2)}
                              {' · '}{localizeCopy('余款条件', 'Saldo')}: {currentAgreement.terms.customPaymentCondition
                                || currentAgreement.terms.remainingBalanceTrigger}
                            </p>
                            <p>
                              {localizeCopy('预计交期', 'Consegna prevista')}: {currentAgreement.terms.expectedDeliveryAt
                                ? new Date(currentAgreement.terms.expectedDeliveryAt).toLocaleDateString()
                                : localizeCopy('待确认', 'Da confermare')}
                            </p>
                            <p>
                              {localizeCopy('收货地址', 'Indirizzo di consegna')}: {[
                                currentAgreement.terms.shippingAddress.street,
                                currentAgreement.terms.shippingAddress.city,
                                currentAgreement.terms.shippingAddress.country,
                                currentAgreement.terms.shippingAddress.zip
                              ].filter(Boolean).join(', ') || localizeCopy('未填写', 'Non specificato')}
                            </p>
                            <div className="divide-y divide-neutral-100">
                              {currentAgreement.terms.items.map(item => {
                                const orderItem = order.items.find(candidate => candidate.id === item.orderItemId);
                                return (
                                  <p key={item.orderItemId} className="py-1">
                                    {orderItem ? `${orderItem.productName} · ${orderItem.sku}` : item.orderItemId}
                                    {' · '}{item.quantity} × €{item.unitPrice.toFixed(2)}
                                  </p>
                                );
                              })}
                            </div>
                          </div>
                        </details>
                      )}
                    </div>
                    {currentTask.action === 'confirm_agreement' && (
                      <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                        <button
                          type="button"
                          onClick={() => void handleConfirmAgreement(order)}
                          className="w-full rounded-lg bg-neutral-950 px-4 py-2.5 text-xs font-semibold text-white hover:bg-neutral-800 sm:w-auto"
                        >
                          {localizeCopy('同意本版本', 'Accetta condizioni')}
                        </button>
                        <button
                          type="button"
                          onClick={() => openAgreementProposal(order)}
                          className="w-full rounded-lg border border-neutral-300 bg-white px-4 py-2.5 text-xs font-semibold text-neutral-800 hover:bg-neutral-100 sm:w-auto"
                        >
                          {localizeCopy('提出新方案', 'Proponi modifiche')}
                        </button>
                      </div>
                    )}
                    {(currentTask.action === 'pay' || currentTask.action === 'pay_balance') && (
                      <button
                        type="button"
                        onClick={() => ['bank_transfer', 'bank_transfer_prepay'].includes(order.paymentMethod)
                          ? void handleBankTransferRegistration(order)
                          : void handleCardPayment(order)}
                        disabled={payingOrderId === order.id}
                        className="w-full rounded-lg bg-neutral-950 px-4 py-2.5 text-xs font-semibold text-white hover:bg-neutral-800 disabled:opacity-50 sm:w-auto"
                      >
                        {payingOrderId === order.id
                          ? localizeCopy('处理中…', 'Elaborazione…')
                          : ['bank_transfer', 'bank_transfer_prepay'].includes(order.paymentMethod)
                            ? localizeCopy('登记转账', 'Registra bonifico')
                            : localizeCopy('去付款', 'Paga ora')}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        if (expandedTrackingOrderId === order.id) {
                          setExpandedTrackingOrderId(null);
                          return;
                        }
                        setExpandedTrackingOrderId(order.id);
                      }}
                      className="inline-flex items-center gap-1 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-xs font-semibold text-neutral-800 hover:bg-neutral-100"
                      aria-expanded={expandedTrackingOrderId === order.id}
                    >
                      {localizeCopy('查看物流', 'Visualizza spedizione')}
                      <ChevronDown className={`h-3.5 w-3.5 transition-transform ${expandedTrackingOrderId === order.id ? 'rotate-180' : ''}`} />
                    </button>
                  </div>
                  {expandedTrackingOrderId === order.id && (
                    <div className="mt-3 border-t border-neutral-200 pt-3">
                      <div className="mb-3 flex items-center justify-between gap-2">
                        <p className="text-[11px] text-neutral-500">
                          {localizeCopy('包裹物流记录 · 页面每分钟刷新；也可手动更新。', 'Eventi spedizione · aggiornamento ogni minuto o manuale.')}
                        </p>
                        <button
                          type="button"
                          onClick={() => void loadOrderShipments(order.id)}
                          disabled={trackingLoading}
                          className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold text-neutral-700 hover:bg-white disabled:opacity-50"
                        >
                          <RefreshCw className={`h-3 w-3 ${trackingLoading ? 'animate-spin' : ''}`} />
                          {localizeCopy('刷新', 'Aggiorna')}
                        </button>
                      </div>
                      {trackingError && (
                        <div role="alert" className="mb-3 flex items-center justify-between gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
                          <span>{trackingError}</span>
                          <button type="button" onClick={() => void loadOrderShipments(order.id)} className="shrink-0 font-semibold underline">
                            {localizeCopy('重试', 'Riprova')}
                          </button>
                        </div>
                      )}
                      {trackingLoading && !shipmentsByOrder[order.id] ? (
                        <p className="py-3 text-xs text-neutral-500">{localizeCopy('正在加载物流记录…', 'Caricamento eventi…')}</p>
                      ) : (shipmentsByOrder[order.id] || []).length === 0 ? (
                        <p className="rounded-lg bg-white px-3 py-3 text-xs text-neutral-500">
                          {localizeCopy('暂未创建包裹或收到物流节点。承运商自动追踪尚未接入；此处不会显示虚构地点或预计送达时间。', 'Nessun pacco o evento disponibile. Il tracciamento automatico del corriere non è configurato; non mostriamo località o stime non verificate.')}
                        </p>
                      ) : (
                        <div className="space-y-3">
                          {(shipmentsByOrder[order.id] || []).map(shipment => {
                            const itemSummaries = shipment.items.map(shippedItem => {
                              const item = order.items.find(candidate => candidate.id === shippedItem.orderItemId);
                              return `${item ? `${item.productName} · ${item.color} / ${item.size}` : shippedItem.orderItemId} × ${shippedItem.quantity}`;
                            });
                            const events = [...shipment.trackingEvents].sort(
                              (left, right) => new Date(right.occurredAt).getTime() - new Date(left.occurredAt).getTime()
                            );
                            return (
                              <section key={shipment.id} className="rounded-lg border border-neutral-200 bg-white p-3">
                                <div className="flex flex-wrap items-start justify-between gap-2">
                                  <div>
                                    <p className="text-xs font-semibold text-neutral-900">{shipment.shipmentNo}</p>
                                    <p className="mt-1 text-[11px] text-neutral-600">
                                      {shipment.carrier || localizeCopy('承运商未填写', 'Corriere non indicato')}
                                      {shipment.trackingNumber ? ` · ${shipment.trackingNumber}` : ''}
                                      {' · '}
                                      {shipment.status}
                                    </p>
                                  </div>
                                  <p className="text-[10px] text-neutral-500">
                                    {localizeCopy('平台记录 · 更新于', 'Dato registrato · aggiornato il')} {new Date(shipment.updatedAt).toLocaleString(isIt ? 'it-IT' : 'zh-CN')}
                                  </p>
                                </div>
                                {itemSummaries.length > 0 && <p className="mt-2 text-[11px] text-neutral-600">{itemSummaries.join('、')}</p>}
                                {events.length > 0 ? (
                                  <ol className="mt-3 space-y-3 border-l border-neutral-200 pl-3">
                                    {events.map(event => (
                                      <li key={event.id} className="relative text-xs">
                                        <span className="absolute -left-[17px] top-1 h-2 w-2 rounded-full bg-neutral-700" />
                                        <p className="font-semibold text-neutral-800">{event.status}</p>
                                        {event.location && <p className="mt-0.5 text-neutral-600">{event.location}</p>}
                                        {event.description && <p className="mt-0.5 text-neutral-600">{event.description}</p>}
                                        <time className="mt-1 block text-[10px] text-neutral-400">
                                          {new Date(event.occurredAt).toLocaleString(isIt ? 'it-IT' : 'zh-CN')}
                                        </time>
                                      </li>
                                    ))}
                                  </ol>
                                ) : (
                                  <p className="mt-3 text-[11px] text-neutral-500">{localizeCopy('尚无承运商扫描节点；当前仅有平台发货记录。', 'Nessuna scansione del corriere; è disponibile solo la registrazione della spedizione.')}</p>
                                )}
                              </section>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Items preview */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {order.items.slice(0, 3).map((item, idx) => (
                    <div key={idx} className="flex items-center gap-2.5 bg-neutral-50 p-2.5 rounded-xl border border-neutral-100">
                      <ProductImage
                        src={item.image}
                        alt={item.productName}
                        contain
                        className="w-12 h-14 rounded-lg border border-neutral-200 shrink-0"
                      />
                      <div className="min-w-0 text-xs">
                        <div className="font-mono font-bold text-neutral-900 truncate">{item.styleNo}</div>
                        <div className="text-neutral-600 truncate">{item.productName}</div>
                        <div className="text-neutral-400 mt-0.5">
                          {item.color} / {item.size} × <strong>{item.quantity} {localizeCopy('件', 'pz')}</strong>
                          {Number.isInteger(item.inStockQuantity) && Number.isInteger(item.preorderQuantity) && (
                            <span className="ml-1">
                              · {localizeCopy('现货', 'disponibili')} {item.inStockQuantity} / {localizeCopy('订货', 'in riassortimento')} {item.preorderQuantity}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                  {order.items.length > 3 && (
                    <div className="flex items-center justify-center bg-neutral-50 p-2.5 rounded-xl border border-neutral-100 text-xs text-neutral-500 font-medium">
                      {localizeCopy("+ 另有 {{RUDA_ARG_0}} 款商品", "+ altri {{RUDA_ARG_0}} articoli", [String(order.items.length - 3)])}
                    </div>
                  )}
                </div>

                {/* Bottom Order Actions */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                  <div className="flex items-center gap-4 text-xs text-neutral-600">
                    <span>
                      {localizeCopy('总件数:', 'Totale Capi:')} <strong className="text-neutral-950 font-bold">{order.totalQty} {localizeCopy('件', 'pz')}</strong>
                    </span>
                    <span>
                      {order.status === 'pending' || order.status === 'placed'
                        ? localizeCopy('商品金额预估:', 'Stima merce:')
                        : localizeCopy('订单金额:', 'Totale ordine:')}
                      {' '}<strong className="text-neutral-950 font-serif font-black text-sm">€{order.totalAmount.toFixed(2)}</strong>
                    </span>
                    <span className="text-[11px] px-2 py-0.5 bg-neutral-100 text-neutral-600 rounded-lg">
                      {order.status === 'confirmed' && order.paymentStatus !== 'paid'
                        ? order.paymentStatus === 'pending'
                          ? order.paymentMethod === 'bank_transfer'
                            ? localizeCopy('转账待核实', 'Bonifico in verifica')
                            : localizeCopy('付款处理中', 'Pagamento in elaborazione')
                          : order.paymentStatus === 'pending_credit'
                            ? localizeCopy('账期处理中', 'Pagamento a credito')
                            : localizeCopy('商家已接受 · 待付款', 'Accettato · in attesa di pagamento')
                        : order.status === 'pending' || order.status === 'placed'
                          ? localizeCopy('待商家确认', 'In attesa di conferma')
                          : localizeCopy('付款状态: {{RUDA_ARG_0}}', 'Pagamento: {{RUDA_ARG_0}}', [order.paymentStatus])}
                    </span>
                  </div>

                  <details className="text-xs">
                    <summary className="cursor-pointer list-none font-semibold text-neutral-600 hover:text-neutral-950">
                      {localizeCopy('订单详情与其他操作', 'Dettagli e altre azioni')}
                    </summary>
                    <div className="mt-3 flex flex-wrap gap-2 border-t border-neutral-200 pt-3">
                      {order.status !== 'pending' && order.status !== 'placed' && (
                        <button type="button" onClick={() => handleOpenDoc(order, 'invoice')} className="rounded-lg border border-neutral-200 px-3 py-2 font-semibold text-neutral-700 hover:bg-white">
                          {localizeCopy('查看发票', 'Fattura')}
                        </button>
                      )}
                      <button type="button" onClick={() => void handleShare(order, 'order')} disabled={sharingOrderId === order.id} className="rounded-lg border border-neutral-200 px-3 py-2 font-semibold text-neutral-700 hover:bg-white disabled:opacity-50">
                        {localizeCopy('分享订单', 'Condividi ordine')}
                      </button>
                      <button type="button" onClick={() => handleOpenDoc(order, 'packing_list')} className="rounded-lg border border-neutral-200 px-3 py-2 font-semibold text-neutral-700 hover:bg-white">
                        {localizeCopy('查看装箱单', 'Distinta colli')}
                      </button>
                      <button type="button" onClick={() => handleReorder(order.id)} className="rounded-lg border border-neutral-200 px-3 py-2 font-semibold text-neutral-700 hover:bg-white">
                        {localizeCopy('再次补货', 'Riordina')}
                      </button>
                      {order.status === 'delivered' && !order.refundStatus && (
                        <button
                          type="button"
                          onClick={() => {
                            setReturnOrder(order);
                            setReturnQuantity(order.totalQty);
                          }}
                          className="rounded-lg border border-neutral-200 px-3 py-2 font-semibold text-neutral-700 hover:bg-white"
                        >
                          {localizeCopy('申请售后', 'Richiedi assistenza')}
                        </button>
                      )}
                      {order.refundStatus === 'requested' && (
                        <span className="rounded-lg bg-amber-50 px-3 py-2 font-semibold text-amber-800">
                          {localizeCopy('售后处理中', 'Assistenza in corso')}
                        </span>
                      )}
                    </div>
                  </details>
                  <button
                    type="button"
                    onClick={() => setActiveChatOrderId(current => current === order.id ? null : order.id)}
                    aria-expanded={activeChatOrderId === order.id}
                    className="inline-flex items-center gap-2 rounded-lg border border-neutral-200 px-3 py-2 text-xs font-semibold text-neutral-700 hover:bg-neutral-50"
                  >
                    订单沟通
                  </button>
                  {activeChatOrderId === order.id && (
                    <OrderChatPanel key={order.id} orderId={order.id} orderNo={order.orderNo} role="buyer" />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 4. Document Modal (Invoice / Packing List) */}
      {activeDocModal && docOrder && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200 bg-neutral-50">
              <div className="flex items-center gap-2">
                <span className="p-1 bg-black text-white rounded-lg">
                  <FileText className="w-4 h-4" />
                </span>
                <h3 className="font-bold text-neutral-900 text-sm sm:text-base">
                  {activeDocModal === 'invoice' 
                    ? (localizeCopy('商业发票 Proforma', 'Fattura Proforma Commerciale'))
                    : (localizeCopy('发货装箱单 Packing List', 'Distinta di Spedizione Colli'))}
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handlePrint}
                  className="p-1.5 text-neutral-600 hover:text-black hover:bg-neutral-200 rounded-lg transition-colors cursor-pointer"
                  title={localizeCopy('打印此单据', 'Stampa documento')}
                >
                  <Printer className="w-4 h-4" />
                </button>
                {activeDocModal === 'invoice' && (
                  <button
                    type="button"
                    onClick={() => void handleShare(docOrder, 'invoice')}
                    disabled={sharingOrderId === docOrder.id}
                    className="p-1.5 text-neutral-600 hover:text-black hover:bg-neutral-200 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                    title={localizeCopy('分享发票', 'Condividi fattura')}
                  >
                    <Share2 className="w-4 h-4" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setActiveDocModal(null)}
                  className="p-1.5 text-neutral-400 hover:text-black rounded-lg transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Printable Document Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 text-neutral-800 text-xs font-sans">
              <div className="flex justify-between items-start border-b border-neutral-200 pb-4">
                <div>
                  <h2 className="text-lg font-serif font-bold text-black tracking-wider">RUDA B2B WHOLESALE</h2>
                  <p className="text-[11px] text-neutral-500">Distretto Moda Tessile, 59100 Prato (PO), Italia</p>
                  <p className="text-[11px] text-neutral-500">P.IVA: IT09887766554</p>
                </div>
                <div className="text-right">
                  <span className="font-mono text-xs font-bold px-2.5 py-0.5 bg-neutral-100 rounded-lg">
                    {activeDocModal === 'invoice' ? 'INV-' : 'PKL-'}{docOrder.orderNo.replace('#', '')}
                  </span>
                  <div className="text-[11px] text-neutral-400 mt-1">
                    {localizeCopy("日期: {{RUDA_ARG_0}}", "Data: {{RUDA_ARG_0}}", [String(docOrder.date)])}
                  </div>
                </div>
              </div>

              {/* Items Table */}
              <div className="border border-neutral-200 rounded-xl overflow-hidden">
                <table className="w-full text-left text-[11px]">
                  <thead className="bg-neutral-100 border-b border-neutral-200 font-bold text-neutral-700">
                    <tr>
                      <th className="py-2.5 px-3">{localizeCopy('款号 / 描述', 'Modello')}</th>
                      <th className="py-2.5 px-2">{localizeCopy('颜色 / 尺码', 'Colore / Taglia')}</th>
                      <th className="py-2.5 px-2 text-center">{localizeCopy('件数', 'Q.tà')}</th>
                      {activeDocModal === 'invoice' ? (
                        <>
                          <th className="py-2.5 px-2 text-right">{localizeCopy('单价', 'Prezzo Unit.')}</th>
                          <th className="py-2.5 px-3 text-right">{localizeCopy('金额 (€)', 'Totale (€)')}</th>
                        </>
                      ) : (
                        <>
                          <th className="py-2.5 px-2 text-center">{localizeCopy('包规', 'Collo')}</th>
                          <th className="py-2.5 px-3 text-right">{localizeCopy('毛重 (kg)', 'Peso (kg)')}</th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {docOrder.items.map((item, i) => (
                      <tr key={i} className="hover:bg-neutral-50">
                        <td className="py-2 px-3">
                          <span className="font-mono font-bold block">{item.styleNo}</span>
                          <span className="text-neutral-500 text-[10px] line-clamp-1">{item.productName}</span>
                        </td>
                        <td className="py-2 px-2 text-neutral-700">
                          {item.color} / {item.size}
                        </td>
                        <td className="py-2 px-2 text-center font-bold">{item.quantity}</td>
                        {activeDocModal === 'invoice' ? (
                          <>
                            <td className="py-2 px-2 text-right font-mono">€{item.unitPrice.toFixed(2)}</td>
                            <td className="py-2 px-3 text-right font-mono font-bold">€{(item.unitPrice * item.quantity).toFixed(2)}</td>
                          </>
                        ) : (
                          <>
                            <td className="py-2 px-2 text-center text-neutral-600">{item.packSize} pz/pacco</td>
                            <td className="py-2 px-3 text-right font-mono">{(item.quantity * 0.45).toFixed(2)} kg</td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Total Summary */}
              <div className="flex justify-between items-center pt-2 border-t border-neutral-200">
                <div className="text-[11px] text-neutral-400">
                  {localizeCopy('电子形式单据，可作为清关与收货凭证', 'Documento commerciale generato elettronicamente')}
                </div>
                <div className="text-right">
                  <div className="text-[11px] text-neutral-500">
                    {localizeCopy('合计总件数:', 'Totale Pezzi:')} <span className="font-bold text-neutral-900">{docOrder.totalQty} {localizeCopy('件', 'pz')}</span>
                  </div>
                  {activeDocModal === 'invoice' ? (
                    <div className="text-base font-serif font-black text-black">
                      {localizeCopy('总额:', 'Totale:')} €{docOrder.totalAmount.toFixed(2)}
                    </div>
                  ) : (
                    <div className="text-sm font-bold text-black">
                      {localizeCopy('预估总重:', 'Peso Stimato:')} {(docOrder.totalQty * 0.45).toFixed(2)} kg
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3 border-t border-neutral-200 bg-neutral-50 flex items-center justify-between">
              <span className="text-[11px] text-neutral-400">RUDA B2B Wholesale Management</span>
              <button
                type="button"
                onClick={handlePrint}
                className="px-3.5 py-1.5 bg-black text-white text-xs font-bold rounded-xl hover:bg-neutral-800 transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>{localizeCopy('打印单据', 'Stampa')}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {returnOrder && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <form onSubmit={handleReturnSubmit} className="bg-white rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-neutral-200 pb-3">
              <div>
                <h3 className="font-bold text-neutral-900">申请退货 / 退款</h3>
                <p className="text-[11px] text-neutral-500 mt-1">订单 {returnOrder.orderNo} · 最高退款 €{returnOrder.totalAmount.toFixed(2)}</p>
              </div>
              <button type="button" onClick={() => setReturnOrder(null)} className="p-1.5 text-neutral-400 hover:text-black rounded-lg cursor-pointer" title="关闭">
                <X className="w-5 h-5" />
              </button>
            </div>
            <label className="block text-xs font-semibold text-neutral-700">
              退货件数
              <input
                type="number"
                min="1"
                max={returnOrder.totalQty}
                value={returnQuantity}
                onChange={event => setReturnQuantity(Math.min(returnOrder.totalQty, Math.max(1, Number(event.target.value))))}
                className="mt-1 w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm"
              />
            </label>
            <label className="block text-xs font-semibold text-neutral-700">
              退货原因
              <textarea
                required
                rows={4}
                value={returnReason}
                onChange={event => setReturnReason(event.target.value)}
                placeholder="请填写质量、错发、缺件或其他原因"
                className="mt-1 w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm"
              />
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setReturnOrder(null)} className="px-3 py-2 rounded-xl border border-neutral-200 text-xs font-bold cursor-pointer">取消</button>
              <button type="submit" className="px-4 py-2 rounded-xl bg-black text-white text-xs font-bold cursor-pointer">提交审核</button>
            </div>
          </form>
        </div>
      )}

      {agreementProposal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <form onSubmit={submitAgreementProposal} className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-neutral-200 px-5 py-4">
              <div>
                <h3 className="text-sm font-bold text-neutral-950">{localizeCopy('提出新交易方案', 'Proponi nuove condizioni')}</h3>
                <p className="mt-1 text-[11px] text-neutral-500">{agreementProposal.order.orderNo}</p>
              </div>
              <button type="button" onClick={() => setAgreementProposal(null)} disabled={agreementProposalSaving} className="rounded-lg p-1.5 text-neutral-500 hover:bg-neutral-100 disabled:opacity-50" aria-label={localizeCopy('关闭', 'Chiudi')}>
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-4 overflow-y-auto p-5">
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-neutral-800">{localizeCopy('商品与价格', 'Articoli e prezzi')}</h4>
                {agreementProposal.terms.items.map((item, index) => {
                  const orderItem = agreementProposal.order.items.find(candidate => candidate.id === item.orderItemId);
                  return (
                    <div key={item.orderItemId} className="grid grid-cols-1 gap-2 rounded-xl border border-neutral-200 p-3 sm:grid-cols-[1fr_100px_120px] sm:items-center">
                      <span className="text-xs text-neutral-700">{orderItem ? `${orderItem.productName} · ${orderItem.sku} · ${orderItem.color || ''} / ${orderItem.size || ''}` : item.orderItemId}</span>
                      <label className="text-[11px] text-neutral-500">{localizeCopy('数量', 'Quantità')}
                        <input type="number" min="1" step="1" value={item.quantity} onChange={event => setAgreementProposal(current => current && ({
                          ...current,
                          terms: { ...current.terms, items: current.terms.items.map((row, rowIndex) => rowIndex === index ? { ...row, quantity: Number(event.target.value) } : row) }
                        }))} className="mt-1 w-full rounded-lg border border-neutral-200 px-2 py-1.5 text-xs text-neutral-900" />
                      </label>
                      <label className="text-[11px] text-neutral-500">{localizeCopy('单价 (€)', 'Prezzo unit. (€)')}
                        <input type="number" min="0.01" step="0.01" value={item.unitPrice} onChange={event => setAgreementProposal(current => current && ({
                          ...current,
                          terms: { ...current.terms, items: current.terms.items.map((row, rowIndex) => rowIndex === index ? { ...row, unitPrice: Number(event.target.value) } : row) }
                        }))} className="mt-1 w-full rounded-lg border border-neutral-200 px-2 py-1.5 text-xs text-neutral-900" />
                      </label>
                    </div>
                  );
                })}
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="text-xs font-semibold text-neutral-700">{localizeCopy('付款计划', 'Piano di pagamento')}
                  <select value={agreementProposal.terms.paymentPlan} onChange={event => setAgreementProposal(current => current && ({
                    ...current,
                    terms: { ...current.terms, paymentPlan: event.target.value as typeof current.terms.paymentPlan }
                  }))} className="mt-1 w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs">
                    <option value="full_prepayment">{localizeCopy('全额预付', 'Pagamento anticipato')}</option>
                    <option value="ship_before_payment">{localizeCopy('先发货后付款', 'Spedizione prima del pagamento')}</option>
                    <option value="partial_prepayment">{localizeCopy('部分预付', 'Pagamento parziale')}</option>
                    <option value="cash_on_delivery">{localizeCopy('货到付款', 'Pagamento alla consegna')}</option>
                    <option value="custom">{localizeCopy('自定义条件', 'Condizioni personalizzate')}</option>
                  </select>
                </label>
                <label className="text-xs font-semibold text-neutral-700">{localizeCopy('付款方式', 'Metodo di pagamento')}
                  <select value={agreementProposal.terms.paymentMethod} onChange={event => setAgreementProposal(current => current && ({
                    ...current,
                    terms: { ...current.terms, paymentMethod: event.target.value }
                  }))} className="mt-1 w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs">
                    <option value="bank_transfer">{localizeCopy('银行转账', 'Bonifico bancario')}</option>
                    <option value="credit_card">{localizeCopy('银行卡', 'Carta')}</option>
                  </select>
                </label>
                {['partial_prepayment', 'custom'].includes(agreementProposal.terms.paymentPlan) && (
                  <>
                    <label className="text-xs font-semibold text-neutral-700">{localizeCopy(agreementProposal.terms.paymentPlan === 'custom' ? '预付款金额 (€，可选)' : '预付款', agreementProposal.terms.paymentPlan === 'custom' ? 'Anticipo (€ opzionale)' : 'Anticipo')}
                      <input type="number" min="0.01" step="0.01" value={agreementProposal.prepaymentValue} onChange={event => setAgreementProposal(current => current && ({ ...current, prepaymentValue: event.target.value }))} className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-xs" />
                    </label>
                    {agreementProposal.terms.paymentPlan === 'partial_prepayment' && <label className="text-xs font-semibold text-neutral-700">{localizeCopy('计价方式', 'Tipo di valore')}
                      <select value={agreementProposal.prepaymentMode} onChange={event => setAgreementProposal(current => current && ({ ...current, prepaymentMode: event.target.value as 'amount' | 'percent' }))} className="mt-1 w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs">
                        <option value="amount">{localizeCopy('固定金额 (€)', 'Importo fisso (€)')}</option>
                        <option value="percent">{localizeCopy('百分比 (%)', 'Percentuale (%)')}</option>
                      </select>
                    </label>}
                  </>
                )}
                <label className="text-xs font-semibold text-neutral-700">{localizeCopy('余款触发条件', 'Condizione saldo')}
                  <select value={agreementProposal.terms.remainingBalanceTrigger} onChange={event => setAgreementProposal(current => current && ({
                    ...current,
                    terms: { ...current.terms, remainingBalanceTrigger: event.target.value as typeof current.terms.remainingBalanceTrigger }
                  }))} className="mt-1 w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs">
                    <option value="before_shipment">{localizeCopy('发货前', 'Prima della spedizione')}</option>
                    <option value="on_delivery">{localizeCopy('货到时', 'Alla consegna')}</option>
                    <option value="after_delivery">{localizeCopy('送达后', 'Dopo la consegna')}</option>
                    <option value="date">{localizeCopy('指定日期', 'Data specifica')}</option>
                    <option value="custom">{localizeCopy('自定义条件', 'Condizione personalizzata')}</option>
                  </select>
                </label>
                {agreementProposal.terms.remainingBalanceTrigger === 'date' && (
                  <label className="text-xs font-semibold text-neutral-700">{localizeCopy('余款日期', 'Data saldo')}
                    <input type="date" value={agreementProposal.terms.remainingBalanceDueAt || ''} onChange={event => setAgreementProposal(current => current && ({
                      ...current,
                      terms: { ...current.terms, remainingBalanceDueAt: event.target.value || null }
                    }))} className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-xs" />
                  </label>
                )}
                {(agreementProposal.terms.paymentPlan === 'custom' || agreementProposal.terms.remainingBalanceTrigger === 'custom') && (
                  <label className="text-xs font-semibold text-neutral-700 sm:col-span-2">{localizeCopy('自定义付款条件', 'Condizione di pagamento personalizzata')}
                    <textarea required rows={2} value={agreementProposal.terms.customPaymentCondition || ''} onChange={event => setAgreementProposal(current => current && ({
                      ...current,
                      terms: { ...current.terms, customPaymentCondition: event.target.value || null }
                    }))} className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-xs" />
                  </label>
                )}
                <label className="text-xs font-semibold text-neutral-700">{localizeCopy('供货方式', 'Modalità di fornitura')}
                  <select value={agreementProposal.terms.supplyMode} onChange={event => setAgreementProposal(current => current && ({
                    ...current,
                    terms: { ...current.terms, supplyMode: event.target.value as typeof current.terms.supplyMode }
                  }))} className="mt-1 w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs">
                    <option value="in_stock_first">{localizeCopy('现货优先', 'Prima disponibilità')}</option>
                    <option value="all_ready">{localizeCopy('齐货后发', 'Spedizione a disponibilità completa')}</option>
                    <option value="partial_shipments">{localizeCopy('允许分批发货', 'Spedizioni parziali')}</option>
                  </select>
                </label>
                <label className="text-xs font-semibold text-neutral-700">{localizeCopy('预计交期', 'Consegna prevista')}
                  <input type="date" value={agreementProposal.terms.expectedDeliveryAt || ''} onChange={event => setAgreementProposal(current => current && ({
                    ...current,
                    terms: { ...current.terms, expectedDeliveryAt: event.target.value || null }
                  }))} className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-xs" />
                </label>
                <label className="text-xs font-semibold text-neutral-700">{localizeCopy('运费 (€)', 'Spedizione (€)')}
                  <input type="number" min="0" step="0.01" value={agreementProposal.terms.shippingFee} onChange={event => setAgreementProposal(current => current && ({
                    ...current,
                    terms: { ...current.terms, shippingFee: Number(event.target.value) }
                  }))} className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-xs" />
                </label>
                <label className="text-xs font-semibold text-neutral-700">{localizeCopy('折扣 (€)', 'Sconto (€)')}
                  <input type="number" min="0" step="0.01" value={agreementProposal.terms.discountAmount} onChange={event => setAgreementProposal(current => current && ({
                    ...current,
                    terms: { ...current.terms, discountAmount: Number(event.target.value) }
                  }))} className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-xs" />
                </label>
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-neutral-200 p-4">
              <button type="button" onClick={() => setAgreementProposal(null)} disabled={agreementProposalSaving} className="rounded-lg border border-neutral-300 px-4 py-2 text-xs font-semibold text-neutral-700 disabled:opacity-50">
                {localizeCopy('取消', 'Annulla')}
              </button>
              <button type="submit" disabled={agreementProposalSaving} className="rounded-lg bg-neutral-950 px-4 py-2 text-xs font-semibold text-white disabled:opacity-50">
                {agreementProposalSaving ? localizeCopy('提交中…', 'Invio…') : localizeCopy('发送新方案', 'Invia proposta')}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
