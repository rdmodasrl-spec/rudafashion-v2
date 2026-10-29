import React from 'react';
import { 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  Lock, 
  ArrowRight, 
  X, 
  RefreshCw,
  ShoppingBag
} from 'lucide-react';
import { useB2B } from '../../../../context/B2BContext';
import { CartItem } from '../../../../types/b2b';

export const ReorderModal: React.FC = () => {
  const { 
    activeReorderAnalysis, 
    setActiveReorderAnalysis, 
    confirmReorderItems,
    getProductById,
    lang, localizeCopy
  } = useB2B();

  const isIt = lang === 'it';

  if (!activeReorderAnalysis) return null;

  const { orderNo, items, hasPriceChange, hasOutOfStock, hasPermissionIssue } = activeReorderAnalysis;
  const availableItems = items.filter(i => i.isAvailable);

  const handleApplyAllAvailable = () => {
    const cartItems: Array<Omit<CartItem, 'id'>> = availableItems.map(item => {
      const prod = getProductById(item.productId);
      return {
        productId: item.productId,
        styleNo: item.styleNo,
        productName: item.productName,
        image: item.image,
        sku: item.sku,
        color: item.color,
        size: item.size,
        quantity: Math.min(item.orderedQty, item.availableStock),
        unitPrice: item.currentPrice,
        packSize: prod?.packSize || 6,
        merchantId: item.merchantId,
        merchantName: item.merchantName
      };
    });

    confirmReorderItems(cartItems);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-neutral-200 flex items-center justify-between bg-neutral-50/80">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-black text-white flex items-center justify-center">
              <RefreshCw className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-base text-neutral-900 font-serif">
                {localizeCopy("一键复购智能核验 · {{RUDA_ARG_0}}", "Verifica Riordino Rapido · {{RUDA_ARG_0}}", [String(orderNo)])}
              </h3>
              <p className="text-xs text-neutral-500">
                {localizeCopy('已自动核查各款式最新库存状态、当前批发价与授权。', 'Verifica automatica di disponibilità, variazioni di listino e autorizzazioni.')}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setActiveReorderAnalysis(null)}
            className="p-2 text-neutral-400 hover:text-black rounded-lg hover:bg-neutral-200/60 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Warning Banners */}
        {(hasPriceChange || hasOutOfStock || hasPermissionIssue) && (
          <div className="px-5 py-3 bg-neutral-100 border-b border-neutral-200 space-y-1 text-xs text-neutral-800">
            <div className="font-bold flex items-center gap-1.5 text-neutral-900">
              <AlertTriangle className="w-4 h-4 text-neutral-700 shrink-0" />
              <span>{localizeCopy('复购核验提示：', 'Note sul Riassortimento:')}</span>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-neutral-600 pl-5">
              {hasOutOfStock && <span>• {localizeCopy('部分款式现货库存紧张或已售罄', 'Alcuni articoli presentano disponibilità limitata')}</span>}
              {hasPriceChange && <span>• {localizeCopy('部分款式批发单价有最新调整', 'Alcuni prezzi wholesale sono stati aggiornati')}</span>}
              {hasPermissionIssue && <span>• {localizeCopy('含有需要授权的商户专有款', 'Include articoli con accesso riservato')}</span>}
            </div>
          </div>
        )}

        {/* Items List */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 divide-y divide-neutral-100 space-y-3">
          {items.map((item, idx) => (
            <div key={idx} className="pt-3 first:pt-0 flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <img
                  src={item.image}
                  alt={item.productName}
                  className="w-12 h-14 object-cover rounded-lg border border-neutral-200 shrink-0 mt-0.5"
                />
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-neutral-900">{item.styleNo}</span>
                    <span className="text-[10px] text-neutral-500 font-medium">{item.merchantName || 'RUDA Partner'}</span>
                    {!item.hasPermission && (
                      <span className="inline-flex items-center gap-0.5 text-[10px] bg-neutral-100 text-neutral-800 px-2 py-0.5 rounded-full font-bold">
                        <Lock className="w-2.5 h-2.5" /> {localizeCopy('需授权', 'Riservato')}
                      </span>
                    )}
                  </div>
                  <p className="text-xs font-medium text-neutral-800 line-clamp-1">{item.productName}</p>
                  <p className="text-[11px] text-neutral-500">
                    {localizeCopy('规格:', 'Specifiche:')} <span className="font-semibold text-neutral-800">{item.color} · {item.size}</span> | {localizeCopy('原订:', 'Precedente:')} <strong>{item.orderedQty} {localizeCopy('件', 'pz')}</strong> ({localizeCopy('现存', 'Disponibili:')} {item.availableStock} {localizeCopy('件', 'pz')})
                  </p>
                  <p className={`text-[11px] font-medium ${
                    item.isAvailable ? 'text-neutral-900' : 'text-neutral-400'
                  }`}>
                    {item.statusNote}
                  </p>
                </div>
              </div>

              {/* Price comparison & status tag */}
              <div className="text-right shrink-0 space-y-1">
                <div>
                  {item.isPriceChanged && item.originalPrice !== undefined ? (
                    <div className="space-y-0.5">
                      <span className="text-[10px] text-neutral-400 line-through block">€{item.originalPrice.toFixed(2)}</span>
                      <span className="text-xs font-bold text-black">€{item.currentPrice.toFixed(2)}</span>
                    </div>
                  ) : (
                    <span className="text-xs font-bold text-neutral-900">€{item.currentPrice.toFixed(2)}</span>
                  )}
                </div>

                {item.isAvailable ? (
                  <span className="inline-flex items-center gap-1 text-[10px] bg-neutral-100 text-neutral-900 border border-neutral-300 px-2.5 py-0.5 rounded-full font-bold">
                    <CheckCircle2 className="w-3 h-3" /> {localizeCopy('可补货', 'Disponibile')}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[10px] bg-neutral-50 text-neutral-400 border border-neutral-200 px-2.5 py-0.5 rounded-full font-medium">
                    <XCircle className="w-3 h-3 text-neutral-400" /> {localizeCopy('暂不可用', 'Non Disponibile')}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="p-4 bg-neutral-50 border-t border-neutral-200 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-neutral-600">
            {localizeCopy('可复购有效款式:', 'Articoli riordinabili:')} <strong className="text-neutral-900">{availableItems.length}</strong> / {items.length}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => setActiveReorderAnalysis(null)}
              className="flex-1 sm:flex-initial px-4 py-2.5 border border-neutral-300 text-neutral-700 hover:bg-neutral-100 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
            >
              {localizeCopy('取消', 'Annulla')}
            </button>

            <button
              type="button"
              onClick={handleApplyAllAvailable}
              disabled={availableItems.length === 0}
              className="flex-1 sm:flex-initial px-5 py-2.5 bg-black hover:bg-neutral-800 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs transition-all cursor-pointer"
            >
              <ShoppingBag className="w-3.5 h-3.5" />
              <span>{localizeCopy("一键载入可补货商品 ({{RUDA_ARG_0}})", "Carica nel Carrello ({{RUDA_ARG_0}})", [String(availableItems.length)])}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
