import React, { useState } from 'react';
import { 
  Zap, 
  Plus, 
  Trash2, 
  ShoppingBag, 
  X
} from 'lucide-react';
import { useB2B } from '../../../../context/B2BContext';
import { CartItem } from '../../../../types/b2b';
import { getLocalizedProductName } from '../../../../i18n/translations';

interface QuickRow {
  id: string;
  styleInput: string;
  matchedProduct: any | null;
  selectedColor: string;
  selectedSize: string;
  qty: number;
}

interface QuickOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const QuickOrderModal: React.FC<QuickOrderModalProps> = ({ isOpen, onClose }) => {
  const { products, addMultipleToCart, calculateCustomerPrice, addNotification, setCurrentView, lang, localizeCopy } = useB2B();
  const isIt = lang === 'it';

  const [rows, setRows] = useState<QuickRow[]>([
    { id: '1', styleInput: 'DRS-2026-0088', matchedProduct: null, selectedColor: isIt ? 'Nero' : '曜石黑', selectedSize: 'M', qty: 6 },
    { id: '2', styleInput: 'COAT-2026-0112', matchedProduct: null, selectedColor: isIt ? 'Cammello' : '皇室驼', selectedSize: 'S', qty: 6 },
    { id: '3', styleInput: '', matchedProduct: null, selectedColor: '', selectedSize: 'M', qty: 6 }
  ]);

  if (!isOpen) return null;

  const handleStyleChange = (index: number, val: string) => {
    const updated = [...rows];
    const row = { ...updated[index], styleInput: val };
    const found = products.find(p => 
      p.styleNo.toLowerCase().includes(val.trim().toLowerCase()) ||
      p.name.toLowerCase().includes(val.trim().toLowerCase())
    );
    if (found) {
      row.matchedProduct = found;
      if (!row.selectedColor && found.colors?.[0]) row.selectedColor = found.colors[0];
      if (!row.selectedSize && found.sizes?.[0]) row.selectedSize = found.sizes[0];
      if (found.moq && row.qty < found.moq) row.qty = found.moq;
    } else {
      row.matchedProduct = null;
    }
    updated[index] = row;
    setRows(updated);
  };

  const handleAddRow = () => {
    setRows(prev => [
      ...prev,
      { id: Date.now().toString(), styleInput: '', matchedProduct: null, selectedColor: '', selectedSize: 'M', qty: 6 }
    ]);
  };

  const handleRemoveRow = (index: number) => {
    setRows(prev => prev.filter((_, i) => i !== index));
  };

  const handleQuickBatchAdd = () => {
    const validItems: Array<Omit<CartItem, 'id'>> = [];
    
    rows.forEach(r => {
      const prod = r.matchedProduct || products.find(p => p.styleNo.toLowerCase() === r.styleInput.trim().toLowerCase());
      if (prod && r.qty > 0) {
        const color = r.selectedColor || prod.colors?.[0] || (isIt ? 'Standard' : '标准色');
        const size = r.selectedSize || prod.sizes?.[0] || 'M';
        const localizedName = getLocalizedProductName(prod, lang);
        validItems.push({
          productId: prod.id,
          styleNo: prod.styleNo,
          productName: localizedName,
          image: prod.images[0] || '',
          sku: `${prod.styleNo}-${color}-${size}`,
          color,
          size,
          quantity: r.qty,
          unitPrice: calculateCustomerPrice(prod.wholesalePrice),
          packSize: prod.packSize || 6,
          merchantId: prod.merchantId,
          merchantName: prod.merchantName
        });
      }
    });

    if (validItems.length === 0) {
      addNotification(
        'warning', 
        localizeCopy('请先填写有效款号', 'Nessun articolo valido'),
        localizeCopy('未找到可匹配的款式，请核对款号代码', 'Inserisci un codice articolo valido per procedere.')
      );
      return;
    }

    addMultipleToCart(validItems);
    onClose();
    setCurrentView('cart');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-neutral-200 flex items-center justify-between bg-neutral-50/90">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-black text-white flex items-center justify-center">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-base text-neutral-900 font-serif">
                {localizeCopy('急速选款采购模式', 'Inserimento Rapido Ordine')}
              </h3>
              <p className="text-xs text-neutral-500">
                {localizeCopy('熟练买手按款号直接批量排单，免翻阅目录。', 'Inserisci rapidamente codici modello, taglie e quantità per ordini wholesale diretti.')}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-neutral-400 hover:text-black rounded-lg hover:bg-neutral-200/60 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Rows form */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3">
          <div className="text-[11px] font-semibold text-neutral-500 grid grid-cols-12 gap-2 px-1 uppercase tracking-wider">
            <span className="col-span-4">{localizeCopy('款号 / 关键字', 'Codice Modello')}</span>
            <span className="col-span-3">{localizeCopy('颜色规格', 'Colore')}</span>
            <span className="col-span-2">{localizeCopy('尺码', 'Taglia')}</span>
            <span className="col-span-2 text-center">{localizeCopy('件数', 'Quantità')}</span>
            <span className="col-span-1 text-center">{localizeCopy('操作', 'Azione')}</span>
          </div>

          {rows.map((row, idx) => {
            const prod = row.matchedProduct || products.find(p => p.styleNo.toLowerCase().includes(row.styleInput.trim().toLowerCase()));
            const colors = prod?.colors || (isIt ? ['Nero', 'Bianco', 'Cammello'] : ['曜石黑', '米白', '驼色']);
            const sizes = prod?.sizes || ['S', 'M', 'L', 'XL'];

            return (
              <div key={row.id} className="grid grid-cols-12 gap-2 items-center bg-neutral-50 p-2 rounded-xl border border-neutral-200/70">
                {/* Style No search input */}
                <div className="col-span-4 relative">
                  <input
                    type="text"
                    value={row.styleInput}
                    onChange={(e) => handleStyleChange(idx, e.target.value)}
                    placeholder={localizeCopy('如: DRS-2026...', 'Es: DRS-2026...')}
                    className="w-full text-xs font-mono font-bold bg-white border border-neutral-300 rounded-lg px-2.5 py-2 focus:outline-none focus:ring-1 focus:ring-black"
                  />
                  {prod && (
                    <span className="absolute right-2 top-2.5 text-[10px] text-emerald-600 font-bold">
                      ✓
                    </span>
                  )}
                </div>

                {/* Color select */}
                <div className="col-span-3">
                  <select
                    value={row.selectedColor}
                    onChange={(e) => {
                      const copy = [...rows];
                      copy[idx].selectedColor = e.target.value;
                      setRows(copy);
                    }}
                    className="w-full text-xs bg-white border border-neutral-300 rounded-lg px-2 py-2 focus:outline-none"
                  >
                    {colors.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>

                {/* Size select */}
                <div className="col-span-2">
                  <select
                    value={row.selectedSize}
                    onChange={(e) => {
                      const copy = [...rows];
                      copy[idx].selectedSize = e.target.value;
                      setRows(copy);
                    }}
                    className="w-full text-xs font-bold bg-white border border-neutral-300 rounded-lg px-2 py-2 focus:outline-none"
                  >
                    {sizes.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>

                {/* Qty input */}
                <div className="col-span-2">
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={row.qty}
                    onChange={(e) => {
                      const copy = [...rows];
                      copy[idx].qty = parseInt(e.target.value) || 1;
                      setRows(copy);
                    }}
                    className="w-full text-xs text-center font-bold bg-white border border-neutral-300 rounded-lg py-2 focus:outline-none"
                  />
                </div>

                {/* Remove */}
                <div className="col-span-1 text-center">
                  <button
                    type="button"
                    onClick={() => handleRemoveRow(idx)}
                    disabled={rows.length <= 1}
                    className="text-neutral-400 hover:text-red-600 disabled:opacity-30 p-1 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5 mx-auto" />
                  </button>
                </div>
              </div>
            );
          })}

          <button
            type="button"
            onClick={handleAddRow}
            className="w-full py-2.5 border border-dashed border-neutral-300 hover:border-black rounded-xl text-xs font-semibold text-neutral-600 hover:text-black flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{localizeCopy('+ 添加一行款号', '+ Aggiungi Riga Articolo')}</span>
          </button>
        </div>

        {/* Footer */}
        <div className="p-4 bg-neutral-50 border-t border-neutral-200 flex items-center justify-between">
          <span className="text-xs text-neutral-500">
            {localizeCopy("共填写 {{RUDA_ARG_0}} 组采购款", "{{RUDA_ARG_0}} articoli configurati", [String(rows.filter(r => r.styleInput.trim()).length)])}
          </span>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-neutral-600 hover:text-black cursor-pointer"
            >
              {localizeCopy('取消', 'Annulla')}
            </button>
            <button
              type="button"
              onClick={handleQuickBatchAdd}
              className="px-5 py-2.5 bg-black hover:bg-neutral-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <ShoppingBag className="w-3.5 h-3.5" />
              <span>{localizeCopy('加入采购车', 'Aggiungi al Carrello')}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
