import React, { useState } from 'react';
import { 
  ShoppingBag, 
  Trash2, 
  Plus, 
  Minus, 
  ArrowRight, 
  ArrowLeft, 
  BookmarkPlus, 
  RotateCcw,
  Store,
  AlertTriangle
} from 'lucide-react';
import { useB2B } from '../../../../context/B2BContext';
import { CartItem } from '../../../../types/b2b';
import { getLocalizedColor } from '../../../../i18n/translations';
import { ProductImage } from '../common/ProductImage';

export const CartView: React.FC = () => {
  const { 
    cart, 
    updateCartQuantity, 
    removeFromCart, 
    clearCart, 
    totalCartAmount, 
    totalCartQty, 
    setCurrentView,
    saveCurrentCartAsDraft,
    savedCarts,
    loadDraftCart,
    checkCartAvailability,
    lang,
    t, localizeCopy
  } = useB2B();

  const isIt = lang === 'it';
  const [draftName, setDraftName] = useState('');
  const [showSaveDraftInput, setShowSaveDraftInput] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleSaveDraft = () => {
    if (!draftName.trim() && !showSaveDraftInput) {
      setShowSaveDraftInput(true);
      return;
    }
    saveCurrentCartAsDraft(draftName || localizeCopy('采购草稿', 'Bozza ordine'));
    setDraftName('');
    setShowSaveDraftInput(false);
  };

  const handleProceedToCheckout = () => {
    setValidationError(null);
    const check = checkCartAvailability();
    if (!check.isValid) {
      setValidationError(
        isIt 
          ? 'Alcuni articoli non soddisfano i requisiti minimi di confezione o disponibilità.'
          : check.issues.join('；')
      );
      return;
    }
    setCurrentView('checkout');
  };

  if (cart.length === 0) {
    return (
      <div className="ui-empty-state my-10 space-y-6">
        <div className="w-16 h-16 rounded-full bg-neutral-100 flex items-center justify-center mx-auto text-neutral-400">
          <ShoppingBag className="w-8 h-8" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-neutral-900 font-serif">
            {localizeCopy('采购车暂无选款', 'Il carrello B2B è vuoto')}
          </h2>
          <p className="text-xs text-neutral-500 mt-1 max-w-sm mx-auto leading-relaxed">
            {localizeCopy('购物车为空。去商品目录选款，或载入已保存草稿。', 'Carrello vuoto. Sfoglia il catalogo o carica una bozza.')}
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => setCurrentView('catalog')}
            className="px-6 py-2.5 bg-neutral-900 text-white rounded-xl text-xs font-semibold hover:bg-neutral-800 transition-colors cursor-pointer shadow-xs"
          >
            {localizeCopy('前往选款下单', 'Sfoglia Catalogo Capi')}
          </button>
        </div>

        {/* Saved Draft Carts quick load */}
        {savedCarts.length > 0 && (
          <div className="mt-8 border-t border-neutral-200 pt-8 max-w-xl mx-auto text-left">
            <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-600 mb-3 flex items-center gap-1.5">
              <RotateCcw className="w-3.5 h-3.5" />
              <span>{localizeCopy('历史保存的采购单草稿', 'Bozze Ordine Salvate in Precedenza')}</span>
            </h3>
            <div className="space-y-2">
              {savedCarts.map(draft => (
                <div 
                  key={draft.id} 
                  className="bg-neutral-50 border border-neutral-200 rounded-xl p-3 flex items-center justify-between hover:bg-neutral-100 transition-colors"
                >
                  <div>
                    <h4 className="font-semibold text-xs text-neutral-900">{draft.name}</h4>
                    <span className="text-[11px] text-neutral-400">
                      {draft.createdAt} · {draft.items.length} {localizeCopy('组 SKU', 'modelli')} · {draft.items.reduce((s, i) => s + i.quantity, 0)} {localizeCopy('件', 'capi totali')}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => loadDraftCart(draft.id)}
                    className="px-3 py-1.5 bg-white border border-neutral-300 text-xs font-medium rounded-lg hover:bg-neutral-200 cursor-pointer"
                  >
                    {localizeCopy('载入此单', 'Carica Bozza')}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // Group cart items by merchantId for multi-merchant split orders
  const groupedByMerchant = cart.reduce((acc, item) => {
    const mId = item.merchantId || 'mch-prato';
    const mName = item.merchantName || 'Atelier Bellissima Prato';
    if (!acc[mId]) {
      acc[mId] = {
        merchantId: mId,
        merchantName: mName,
        items: [] as CartItem[],
        subtotal: 0,
        totalQty: 0
      };
    }
    acc[mId].items.push(item);
    acc[mId].subtotal += item.quantity * item.unitPrice;
    acc[mId].totalQty += item.quantity;
    return acc;
  }, {} as Record<string, { merchantId: string; merchantName: string; items: CartItem[]; subtotal: number; totalQty: number }>);

  interface MerchantCartGroup {
    merchantId: string;
    merchantName: string;
    items: CartItem[];
    subtotal: number;
    totalQty: number;
  }

  const merchantGroups: MerchantCartGroup[] = Object.values(groupedByMerchant) as MerchantCartGroup[];

  return (
    <div className="ui-page-shell max-w-5xl space-y-6">
      {/* Top Header */}
      <div className="ui-page-header mb-0">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold font-serif text-neutral-900 tracking-wide">
              {localizeCopy('批发采购清单', 'Riepilogo Carrello B2B')}
            </h1>
            <span className="text-[11px] bg-neutral-900 text-white px-2.5 py-0.5 rounded-full font-mono font-bold">
              {localizeCopy("{{RUDA_ARG_0}} 家生产商分单", "{{RUDA_ARG_0}} Produttori", [String(merchantGroups.length)])}
            </span>
          </div>
          <p className="text-xs text-neutral-500 mt-1">
            {localizeCopy('单品条码级 SKU 订购清单，系统按生产商自动拆单分箱发货与对账', 'Riepilogo delle referenze ordinate con suddivisione automatica per fornitore e fattura singola.')}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Save Draft button */}
          <button
            type="button"
            onClick={handleSaveDraft}
            className="px-3.5 py-2 border border-neutral-300 text-neutral-800 hover:bg-neutral-100 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <BookmarkPlus className="w-3.5 h-3.5 text-black" />
            <span>{localizeCopy('保存采购草稿', 'Salva Bozza')}</span>
          </button>

          <button
            type="button"
            onClick={clearCart}
            className="px-3 py-2 text-neutral-500 hover:text-black rounded-xl text-xs font-medium transition-colors cursor-pointer"
          >
            {localizeCopy('清空清单', 'Svuota')}
          </button>
        </div>
      </div>

      {/* Draft input prompt if triggered */}
      {showSaveDraftInput && (
        <div className="bg-neutral-100 border border-neutral-300 rounded-xl p-4 flex flex-col sm:flex-row items-center gap-3">
          <input
            type="text"
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            placeholder={localizeCopy('请输入采购草稿名称 (例: 巴黎精品店 10月第二批秋季大衣补货单)...', 'Nome della bozza d\'ordine (es. Riassortimento Autunno Milano)...')}
            className="flex-1 bg-white border border-neutral-300 rounded-lg px-3 py-2 text-xs text-neutral-900 focus:outline-none"
          />
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={handleSaveDraft}
              className="px-4 py-2 bg-black text-white text-xs font-semibold rounded-lg hover:bg-neutral-800 transition-colors cursor-pointer"
            >
              {localizeCopy('保存', 'Conferma')}
            </button>
            <button
              type="button"
              onClick={() => setShowSaveDraftInput(false)}
              className="px-3 py-2 text-neutral-500 text-xs font-medium hover:text-black cursor-pointer"
            >
              {localizeCopy('取消', 'Annulla')}
            </button>
          </div>
        </div>
      )}

      {/* Validation Error Banner */}
      {validationError && (
        <div className="bg-neutral-100 border border-neutral-300 rounded-xl p-4 flex items-start gap-3 text-xs text-neutral-900">
          <AlertTriangle className="w-5 h-5 text-neutral-700 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-bold">{localizeCopy('部分款号暂未满足下单条件：', 'Attenzione ai requisiti d\'ordine:')}</p>
            <p className="text-neutral-700">{validationError}</p>
          </div>
        </div>
      )}

      {/* Multi-Merchant Split View */}
      <div className="space-y-6">
        {merchantGroups.map((group) => (
          <div key={group.merchantId} className="bg-white border border-neutral-200 rounded-2xl overflow-hidden shadow-xs">
            {/* Merchant Header Bar */}
            <div className="bg-neutral-50 px-4 py-3 border-b border-neutral-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Store className="w-4 h-4 text-neutral-700" />
                <span className="font-bold text-xs text-neutral-900 tracking-wide uppercase">
                  {group.merchantName}
                </span>
                <span className="text-[11px] text-neutral-500 font-mono bg-white px-2 py-0.5 rounded border border-neutral-200">
                  {localizeCopy("分单: {{RUDA_ARG_0}} 组款 · 共 {{RUDA_ARG_1}} 件", "{{RUDA_ARG_0}} articoli · {{RUDA_ARG_1}} capi", [String(group.items.length), String(group.totalQty)])}
                </span>
              </div>
              <div className="text-xs text-neutral-600">
                {localizeCopy('本生产商小计:', 'Subtotale Produttore:')} <strong className="font-bold text-neutral-900 text-sm font-serif">€{group.subtotal.toFixed(2)}</strong>
              </div>
            </div>

            {/* Desktop Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="bg-neutral-100/70 text-neutral-600 uppercase font-semibold border-b border-neutral-200">
                    <th className="p-3">{localizeCopy('商品款号与名称', 'Articolo')}</th>
                    <th className="p-3">{localizeCopy('颜色', 'Colore')}</th>
                    <th className="p-3">{localizeCopy('尺码', 'Taglia')}</th>
                    <th className="p-3">{localizeCopy('单品 SKU', 'SKU')}</th>
                    <th className="p-3 text-center">{localizeCopy('采购数量', 'Quantità')}</th>
                    <th className="p-3 text-right">{localizeCopy('批发单价', 'Prezzo Unitario')}</th>
                    <th className="p-3 text-right">{localizeCopy('小计', 'Subtotale')}</th>
                    <th className="p-3 text-center">{localizeCopy('操作', 'Elimina')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200/80">
                  {group.items.map((item) => {
                    const itemTotal = item.quantity * item.unitPrice;
                    const localizedColor = getLocalizedColor(item.color, lang);

                    return (
                      <tr key={item.id} className="hover:bg-neutral-50 transition-colors">
                        <td className="p-3">
                          <div className="flex items-center gap-3">
                            <ProductImage
                              src={item.image}
                              alt={item.productName}
                              contain
                              className="w-12 h-14 rounded-lg border border-neutral-200 shrink-0"
                            />
                            <div>
                              <span className="font-mono text-[10px] font-bold bg-black text-white px-1.5 py-0.5 rounded">
                                {item.styleNo}
                              </span>
                              <p className="font-semibold text-neutral-900 text-xs mt-1 line-clamp-1">
                                {item.productName}
                              </p>
                              <span className="text-[10px] text-neutral-400">
                                {localizeCopy("箱规: {{RUDA_ARG_0}}件/包", "Pacco da {{RUDA_ARG_0}} pz", [String(item.packSize)])}
                              </span>
                            </div>
                          </div>
                        </td>

                        <td className="p-3 font-medium text-neutral-800">
                          {localizedColor}
                        </td>

                        <td className="p-3">
                          <span className="font-bold text-neutral-900 bg-neutral-100 px-2 py-0.5 rounded">
                            {item.size}
                          </span>
                        </td>

                        <td className="p-3 font-mono text-[11px] text-neutral-500">
                          {item.sku}
                        </td>

                        <td className="p-3 text-center">
                          <div className="inline-flex items-center border border-neutral-300 rounded-lg bg-white overflow-hidden shadow-2xs">
                            <button
                              type="button"
                              onClick={() => updateCartQuantity(item.id, item.quantity - 1)}
                              className="px-2 py-1 text-neutral-600 hover:bg-neutral-100 cursor-pointer"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <input
                              type="number"
                              min="1"
                              value={item.quantity}
                              onChange={(e) => updateCartQuantity(item.id, parseInt(e.target.value) || 1)}
                              className="w-12 text-center text-xs font-bold py-1 focus:outline-none border-x border-neutral-200"
                            />
                            <button
                              type="button"
                              onClick={() => updateCartQuantity(item.id, item.quantity + 1)}
                              className="px-2 py-1 text-neutral-600 hover:bg-neutral-100 cursor-pointer"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                        </td>

                        <td className="p-3 text-right font-medium text-neutral-800">
                          €{item.unitPrice.toFixed(2)}
                        </td>

                        <td className="p-3 text-right font-bold text-neutral-950 font-serif text-sm">
                          €{itemTotal.toFixed(2)}
                        </td>

                        <td className="p-3 text-center">
                          <button
                            type="button"
                            onClick={() => removeFromCart(item.id)}
                            className="text-neutral-400 hover:text-black p-1 transition-colors cursor-pointer"
                            title={localizeCopy('删除该项', 'Rimuovi articolo')}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>

      {/* Summary Footer */}
      <div className="bg-white border border-neutral-200 rounded-2xl overflow-hidden shadow-xs">
        <div className="p-4 sm:p-6 bg-neutral-50 flex flex-col sm:flex-row items-center justify-between gap-4 sm:gap-6">
          <div className="space-y-1 text-xs text-neutral-600 w-full sm:w-auto">
            <div className="flex items-center gap-2">
              <span className="text-neutral-500">{localizeCopy('拆单总计:', 'Fornitori coinvolti:')}</span>
              <strong className="text-neutral-900">{merchantGroups.length} {localizeCopy('家独立生产商订单', 'ordini distinti')}</strong>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-neutral-500">{localizeCopy('商品规格与件数:', 'Totale referenze:')}</span>
              <strong className="text-neutral-900 text-sm">
                {cart.length} {localizeCopy('组 SKU', 'modelli')} · {totalCartQty} {localizeCopy('件', 'capi')}
              </strong>
            </div>
            <p className="text-[11px] text-neutral-400">
              {localizeCopy('* 提交后将自动生成总采购单及各独立生产商的分箱发货单', '* Verranno generate le fatture e le note di spedizione separate per ciascun fornitore.')}
            </p>
          </div>

          <div className="text-right space-y-3 w-full sm:w-auto">
            <div>
              <span className="text-xs text-neutral-500 uppercase tracking-wider block">
                {localizeCopy('采购总额 (不含增值税)', 'Totale Imponibile Merce')}
              </span>
              <span className="text-2xl sm:text-3xl font-black text-black font-serif">
                €{totalCartAmount.toFixed(2)}
              </span>
            </div>

            <div className="flex items-center gap-2 sm:gap-3 justify-end">
              <button
                type="button"
                onClick={() => setCurrentView('catalog')}
                className="flex-1 sm:flex-initial px-4 py-2.5 border border-neutral-300 text-neutral-800 hover:bg-neutral-100 rounded-xl text-xs font-semibold transition-colors cursor-pointer flex items-center justify-center gap-1.5"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>{localizeCopy('继续选款', 'Continua la Selezione')}</span>
              </button>

              <button
                type="button"
                id="cart-checkout-btn"
                onClick={handleProceedToCheckout}
                className="flex-1 sm:flex-initial px-6 py-2.5 bg-black hover:bg-neutral-800 text-white rounded-xl text-xs font-bold uppercase tracking-wider shadow-xs transition-colors cursor-pointer flex items-center justify-center gap-2"
              >
                <span>{localizeCopy('提交订单结算', 'Procedi all\'Ordine')}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
