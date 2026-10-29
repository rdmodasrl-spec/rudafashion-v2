import React, { useState } from 'react';
import { 
  FileSpreadsheet, 
  Camera, 
  UploadCloud, 
  Sparkles, 
  AlertCircle, 
  CheckCircle2, 
  ShoppingBag, 
  Trash2, 
  ArrowRight, 
  ScanLine,
  RefreshCw
} from 'lucide-react';
import { useB2B } from '../../../../context/B2BContext';
import { Product, CartItem } from '../../../../types/b2b';
import { getLocalizedProductName } from '../../../../i18n/translations';

interface ParsedPOItem {
  rawLine: string;
  productId: string;
  styleNo: string;
  productName: string;
  brand: string;
  image: string;
  sku: string;
  color: string;
  size: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  packSize: number;
  moq: number;
  isMoqMet: boolean;
  matched: boolean;
}

interface POException {
  rawLine: string;
  type: 'moq_below' | 'unmatched_style' | 'out_of_stock';
  message: string;
  item?: ParsedPOItem;
  suggestedProducts?: Product[];
}

export const PurchaseOrderView: React.FC = () => {
  const { products, addMultipleToCart, setCurrentView, addNotification, calculateCustomerPrice, lang, t, localizeCopy } = useB2B();
  const isIt = lang === 'it';

  const defaultItalianText = `DRS-2026-0088 NERO M 12\nCOAT-2026-0112 CAMMELLO S 8\nDRS-2026-0092 VERDE L 6\nSHIRT-2026-0301 BIANCO S 4\nBLZ-2026-0105 NERO 40 10`;
  const defaultChineseText = `DRS-2026-0088 黑色 M 12\nCOAT-2026-0112 皇室驼 S 8\nDRS-2026-0092 墨绿 L 6\nSHIRT-2026-0301 米白 S 4\nBLZ-2026-0105 炭黑 40 10`;

  const [inputMode, setInputMode] = useState<'upload' | 'camera' | 'text'>('upload');
  const [inputText, setInputText] = useState<string>(lang === 'zh' ? defaultChineseText : defaultItalianText);
  const [isParsing, setIsParsing] = useState<boolean>(false);
  const [matchedItems, setMatchedItems] = useState<ParsedPOItem[]>([]);
  const [exceptions, setExceptions] = useState<POException[]>([]);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [hasParsed, setHasParsed] = useState<boolean>(false);

  const handleParsePO = async () => {
    setIsParsing(true);
    try {
      const res = await fetch('/api/po/ocr-parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: inputText, fileName: selectedFileName })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          const adjustedMatches = (data.matchedItems || []).map((m: any) => ({
            ...m,
            unitPrice: calculateCustomerPrice(m.unitPrice),
            subtotal: calculateCustomerPrice(m.unitPrice) * m.quantity
          }));
          setMatchedItems(adjustedMatches);
          setExceptions(data.exceptions || []);
          setHasParsed(true);
          addNotification(
            'success',
            localizeCopy('采购单解析完成', 'Analisi Ordine Completata'),
            localizeCopy(
              '已识别 {{RUDA_ARG_0}} 件商品/尺码；{{RUDA_ARG_1}} 项需要确认。',
              'Riconosciuti {{RUDA_ARG_0}} articoli/taglie; {{RUDA_ARG_1}} da confermare.',
              [String(adjustedMatches.length), String(data.exceptions?.length || 0)]
            )
          );
          setIsParsing(false);
          return;
        }
      }
    } catch (e) {
      console.warn('Fallback to local parse');
    }

    // Local fallback
    const lines = inputText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const matched: ParsedPOItem[] = [];
    const exc: POException[] = [];

    for (const line of lines) {
      const tokens = line.split(/[\t,，\s|]+/).filter(Boolean);
      if (tokens.length < 2) continue;

      let foundProduct: Product | undefined;
      for (const token of tokens) {
        foundProduct = products.find(p => 
          p.styleNo.toLowerCase().includes(token.toLowerCase()) || 
          p.name.toLowerCase().includes(token.toLowerCase())
        );
        if (foundProduct) break;
      }

      let qty = 6;
      for (let i = tokens.length - 1; i >= 0; i--) {
        const num = parseInt(tokens[i], 10);
        if (!isNaN(num) && num > 0 && num < 5000 && !tokens[i].includes('-')) {
          qty = num;
          break;
        }
      }

      let size = 'M';
      for (const token of tokens) {
        const up = token.toUpperCase();
        if (['XS', 'S', 'M', 'L', 'XL', 'XXL', '38', '39', '40', '41', '42', '43', '44', '45', 'ONE SIZE'].includes(up)) {
          size = up;
          break;
        }
      }

      let color = lang === 'zh' ? '黑色' : 'Nero';
      for (const token of tokens) {
        if (['黑', '黑色', '白', '白色', '驼色', '红', '米色', '军绿', 'NERO', 'BIANCO', 'CAMMELLO', 'VERDE'].some(c => token.toUpperCase().includes(c))) {
          color = token;
          break;
        }
      }

      if (foundProduct) {
        const effectivePrice = calculateCustomerPrice(foundProduct.wholesalePrice);
        const isMoqMet = qty >= (foundProduct.moq || 1);
        const localizedName = getLocalizedProductName(foundProduct, lang);
        const item: ParsedPOItem = {
          rawLine: line,
          productId: foundProduct.id,
          styleNo: foundProduct.styleNo,
          productName: localizedName,
          brand: foundProduct.brand,
          image: foundProduct.images[0] || '',
          sku: `${foundProduct.styleNo}-${size}`,
          color,
          size,
          quantity: qty,
          unitPrice: effectivePrice,
          subtotal: effectivePrice * qty,
          packSize: foundProduct.packSize || 6,
          moq: foundProduct.moq || 6,
          isMoqMet,
          matched: true
        };
        matched.push(item);
        if (!isMoqMet) {
          exc.push({
            rawLine: line,
            type: 'moq_below',
            message: localizeCopy(
              '款号 {{RUDA_ARG_0}} 的最低起订量为 {{RUDA_ARG_1}} 件，当前数量为 {{RUDA_ARG_2}} 件。',
              'Il modello {{RUDA_ARG_0}} richiede un minimo di {{RUDA_ARG_1}} pz; quantità attuale: {{RUDA_ARG_2}} pz.',
              [String(foundProduct.styleNo), String(foundProduct.moq), String(qty)]
            ),
            item
          });
        }
      } else {
        exc.push({
          rawLine: line,
          type: 'unmatched_style',
          message: localizeCopy('未在商品库中识别到款号', 'Modello non identificato nel catalogo'),
          suggestedProducts: products.slice(0, 2)
        });
      }
    }

    setMatchedItems(matched);
    setExceptions(exc);
    setHasParsed(true);
    setIsParsing(false);
  };

  const handleSimulateOCRPhoto = () => {
    setSelectedFileName('SCAN_ORDINE_BOUTIQUE.JPG');
    setInputText(localizeCopy(`DRS-2026-0088 曜黑 S 6\nDRS-2026-0088 曜黑 M 12\nCOAT-2026-0112 皇室驼 S 6\nBLZ-2026-0105 炭黑 38 6`, `DRS-2026-0088 NERO S 6\nDRS-2026-0088 NERO M 12\nCOAT-2026-0112 CAMMELLO S 6\nBLZ-2026-0105 NERO 38 6`));
    setInputMode('camera');
    addNotification('info', localizeCopy('OCR 拍照已载入', 'Acquisizione OCR Caricata'), localizeCopy('已识别纸质采购单图像，正在自动解析款式与配码...', 'Riconoscimento testo e codici articolo in corso.'));
  };

  const handleSimulateExcelUpload = () => {
    setSelectedFileName('Ordine_Boutique_Wholesale.xlsx');
    setInputText(localizeCopy(`DRS-2026-0088 黑色 M 18\nCOAT-2026-0112 驼色 L 12\nBAG-2026-0201 焦糖棕 OS 8\nSHO-2026-0421 深咖 42 10`, `DRS-2026-0088 NERO M 18\nCOAT-2026-0112 CAMMELLO L 12\nBAG-2026-0201 CUOIO OS 8\nSHO-2026-0421 TESTA DI MORO 42 10`));
    setInputMode('upload');
    addNotification('info', localizeCopy('Excel 采购单已读取', 'Foglio Excel Letto'), localizeCopy('已加载表格内订单，点击“自动匹配 SKU”即可解析', 'Pronto per la verifica e aggiunta al carrello.'));
  };

  const handleAdjustQty = (index: number, delta: number) => {
    setMatchedItems(prev => {
      const next = [...prev];
      const target = { ...next[index] };
      const newQty = Math.max(1, target.quantity + delta);
      target.quantity = newQty;
      target.subtotal = target.unitPrice * newQty;
      target.isMoqMet = newQty >= target.moq;
      next[index] = target;
      return next;
    });
  };

  const handlePackUpToMOQ = (index: number) => {
    setMatchedItems(prev => {
      const next = [...prev];
      const target = { ...next[index] };
      target.quantity = target.moq;
      target.subtotal = target.unitPrice * target.moq;
      target.isMoqMet = true;
      next[index] = target;
      return next;
    });
  };

  const handleDeleteItem = (index: number) => {
    setMatchedItems(prev => prev.filter((_, i) => i !== index));
  };

  const handleBatchAddToCart = () => {
    if (matchedItems.length === 0) return;

    const itemsToAdd: Array<Omit<CartItem, 'id'>> = matchedItems.map(item => ({
      productId: item.productId,
      styleNo: item.styleNo,
      productName: item.productName,
      image: item.image,
      sku: item.sku,
      color: item.color,
      size: item.size,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      packSize: item.packSize
    }));

    addMultipleToCart(itemsToAdd);
    addNotification('success', localizeCopy('已加入采购车', 'Carrello Aggiornato'), localizeCopy("已成功将 {{RUDA_ARG_0}} 项商品批量导入采购车！", "Aggiunti {{RUDA_ARG_0}} articoli al carrello.", [String(itemsToAdd.length)]));
    setCurrentView('cart');
  };

  const totalCalculatedQty = matchedItems.reduce((acc, i) => acc + i.quantity, 0);
  const totalCalculatedAmount = matchedItems.reduce((acc, i) => acc + i.subtotal, 0);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
      {/* 1. Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-neutral-200 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-black text-white rounded-lg">
              <FileSpreadsheet className="w-5 h-5" />
            </span>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-neutral-950 font-serif">
              {localizeCopy('采购单快速下单', 'Caricamento Rapido Ordini B2B')}
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-neutral-500 mt-1">
            {localizeCopy('支持 Excel / CSV 表格、PDF 导出、拍照 OCR 或文本粘贴，秒级智能匹配款式与配码。', 'Importa liste d\'ordine da fogli Excel, CSV, PDF, OCR fotografico o testo rapido.')}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setCurrentView('catalog')}
            className="px-3 py-1.5 text-xs font-semibold text-neutral-700 bg-neutral-100 hover:bg-neutral-200 rounded-xl transition-colors cursor-pointer"
          >
            {localizeCopy('返回商城选款', 'Torna al Catalogo')}
          </button>
        </div>
      </div>

      {/* 2. Upload / Input Mode Switcher */}
      <div className="bg-white border border-neutral-200 rounded-2xl p-5 shadow-2xs space-y-4">
        <div className="flex items-center gap-2 p-1 bg-neutral-100 rounded-xl max-w-md">
          <button
            type="button"
            onClick={() => setInputMode('upload')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              inputMode === 'upload' ? 'bg-white text-black shadow-xs' : 'text-neutral-500 hover:text-black'
            }`}
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Excel / CSV</span>
          </button>

          <button
            type="button"
            onClick={() => setInputMode('camera')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              inputMode === 'camera' ? 'bg-white text-black shadow-xs' : 'text-neutral-500 hover:text-black'
            }`}
          >
            <Camera className="w-3.5 h-3.5" />
            <span>{localizeCopy('拍照 OCR', 'Foto / OCR')}</span>
          </button>

          <button
            type="button"
            onClick={() => setInputMode('text')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              inputMode === 'text' ? 'bg-white text-black shadow-xs' : 'text-neutral-500 hover:text-black'
            }`}
          >
            <ScanLine className="w-3.5 h-3.5" />
            <span>{localizeCopy('文本粘贴', 'Testo Diretto')}</span>
          </button>
        </div>

        {/* Upload Mode Area */}
        {inputMode === 'upload' && (
          <div className="space-y-3">
            <div 
              onClick={handleSimulateExcelUpload}
              className="border-2 border-dashed border-neutral-300 hover:border-black bg-neutral-50 hover:bg-neutral-100/70 rounded-2xl p-6 sm:p-8 text-center cursor-pointer transition-all flex flex-col items-center justify-center"
            >
              <UploadCloud className="w-9 h-9 text-neutral-400 mb-2" />
              <p className="text-sm font-bold text-neutral-800">
                {localizeCopy('点击上传 Excel (.xlsx, .xls)、CSV 或 PDF 采购清单', 'Carica file Excel (.xlsx) o CSV con il tuo piano acquisti')}
              </p>
              <p className="text-xs text-neutral-400 mt-1">
                {localizeCopy('支持表头包含：款号、颜色、尺码、数量、期望单价等', 'Colonne supportate: Codice Articolo, Colore, Taglia, Quantità')}
              </p>
              <div className="mt-3 inline-flex items-center gap-1 px-3 py-1.5 bg-neutral-200 text-neutral-800 text-[11px] font-medium rounded-lg">
                {localizeCopy('⚡ 点击此处载入零售商标准采购单示例 (Boutique_PO.xlsx)', '⚡ Carica file di esempio d\'ordine boutique wholesale')}
              </div>
            </div>
            {selectedFileName && (
              <div className="flex items-center justify-between px-3.5 py-2 bg-neutral-100 text-neutral-900 border border-neutral-300 rounded-xl text-xs">
                <span className="font-semibold flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-neutral-900" />
                  {localizeCopy("已就绪文件: {{RUDA_ARG_0}}", "File selezionato: {{RUDA_ARG_0}}", [String(selectedFileName)])}
                </span>
                <span className="text-[11px] text-neutral-600">{localizeCopy('可直接点击下方按钮解析', 'Clicca sotto per verificare')}</span>
              </div>
            )}
          </div>
        )}

        {/* Camera OCR Area */}
        {inputMode === 'camera' && (
          <div className="space-y-3">
            <div 
              onClick={handleSimulateOCRPhoto}
              className="border-2 border-dashed border-neutral-300 bg-neutral-50 hover:bg-neutral-100/70 rounded-2xl p-6 text-center cursor-pointer transition-all flex flex-col items-center justify-center"
            >
              <div className="w-12 h-12 rounded-full bg-neutral-200 text-black flex items-center justify-center mb-2">
                <Camera className="w-6 h-6" />
              </div>
              <p className="text-sm font-bold text-neutral-900">
                {localizeCopy('点击拍照或上传手写采购单照片', 'Scatta una foto della distinta cartacea o del block notes')}
              </p>
              <p className="text-xs text-neutral-500 mt-1">
                {localizeCopy('RUDA 视觉识别将快速提取照片中的手写款号、尺码配比与数量', 'Riconoscimento rapido di codici modello e taglie annotate a penna')}
              </p>
              <button 
                type="button"
                className="mt-3 px-4 py-2 bg-black text-white text-xs font-bold rounded-xl hover:bg-neutral-800 transition-colors"
              >
                {localizeCopy('点击拍摄 / 载入单据', 'Scatta / Carica Foto')}
              </button>
            </div>
          </div>
        )}

        {/* Raw Text Input Box */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-neutral-500">
            <label htmlFor="po-text-area" className="font-medium text-neutral-700">
              {localizeCopy('采购明细文本 (每行一行：款号 颜色 尺码 数量):', 'Linee di ordine (un articolo per riga: Codice Colore Taglia Quantità):')}
            </label>
            <span className="text-[11px] text-neutral-400">{localizeCopy('支持逗号、空格或制表符分隔', 'Separati da spazi o tabulazioni')}</span>
          </div>
          <textarea
            id="po-text-area"
            rows={4}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            className="w-full p-3 font-mono text-xs bg-neutral-50 border border-neutral-200 rounded-xl focus:bg-white focus:outline-none focus:ring-1 focus:ring-black"
          />
        </div>

        {/* Action Button */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={() => setInputText('')}
            className="px-3 py-2 text-xs font-semibold text-neutral-500 hover:text-neutral-800 transition-colors cursor-pointer"
          >
            {localizeCopy('清空内容', 'Cancella')}
          </button>
          <button
            type="button"
            onClick={handleParsePO}
            disabled={isParsing || !inputText.trim()}
            className="px-5 py-2.5 bg-black hover:bg-neutral-800 text-white text-xs sm:text-sm font-bold rounded-xl transition-colors flex items-center gap-2 disabled:opacity-50 cursor-pointer shadow-xs"
          >
            {isParsing ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>{localizeCopy('智能匹配中...', 'Elaborazione in corso...')}</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 text-white" />
                <span>{localizeCopy('自动匹配 SKU 与库存', 'Verifica Giacenze e Prezzi')}</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* 3. Parsed Results & SKU Matching Table */}
      {hasParsed && (
        <div className="bg-white border border-neutral-200 rounded-2xl p-5 sm:p-6 shadow-2xs space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-neutral-100 pb-3">
            <div>
              <h2 className="text-base sm:text-lg font-bold text-neutral-900 flex items-center gap-2">
                <span>{localizeCopy('智能匹配清单', 'Distinta Capi Riconosciuti')}</span>
                <span className="px-2.5 py-0.5 bg-neutral-100 text-neutral-800 text-xs rounded-full font-bold">
                  {matchedItems.length} {localizeCopy('款', 'articoli')}
                </span>
              </h2>
            </div>

            {matchedItems.length > 0 && (
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <div className="text-xs text-neutral-500">{localizeCopy("合计 ({{RUDA_ARG_0}} 件)", "Totale ({{RUDA_ARG_0}} pz)", [String(totalCalculatedQty)])}</div>
                  <div className="text-base sm:text-lg font-serif font-black text-black">
                    €{totalCalculatedAmount.toFixed(2)}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleBatchAddToCart}
                  className="px-4 py-2.5 bg-black hover:bg-neutral-800 text-white text-xs sm:text-sm font-bold rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <ShoppingBag className="w-4 h-4" />
                  <span>{localizeCopy('批量加入采购车', 'Importa nel Carrello')}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

          {/* Table of Matched Items */}
          {matchedItems.length === 0 ? (
            <div className="text-center py-8 text-neutral-400 text-xs">
              {localizeCopy('未能识别到有效条目，请核实款号格式后重试', 'Nessun articolo identificato. Verifica il formato del testo.')}
            </div>
          ) : (
            <div className="divide-y divide-neutral-100">
              {matchedItems.map((item, index) => (
                <div key={index} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <img
                      src={item.image}
                      alt={item.productName}
                      className="w-14 h-16 object-cover rounded-xl border border-neutral-200 shrink-0"
                    />
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-neutral-900">{item.styleNo}</span>
                        <span className="text-[10px] px-2 py-0.2 bg-neutral-100 text-neutral-700 rounded-lg font-medium">
                          {item.brand}
                        </span>
                      </div>
                      <h3 className="text-xs sm:text-sm font-medium text-neutral-800 line-clamp-1">{item.productName}</h3>
                      <div className="flex items-center gap-3 text-xs text-neutral-500">
                        <span>{localizeCopy('颜色:', 'Colore:')} <strong>{item.color}</strong></span>
                        <span>{localizeCopy('尺码:', 'Taglia:')} <strong>{item.size}</strong></span>
                        <span>{localizeCopy('单价:', 'Prezzo:')} <strong>€{item.unitPrice}</strong></span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                    {/* Quantity control */}
                    <div className="flex items-center border border-neutral-200 rounded-xl overflow-hidden">
                      <button
                        type="button"
                        onClick={() => handleAdjustQty(index, -1)}
                        className="px-2.5 py-1.5 hover:bg-neutral-100 text-neutral-600 text-xs font-bold"
                      >
                        -
                      </button>
                      <span className="px-2.5 text-xs font-mono font-bold min-w-[32px] text-center">
                        {item.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleAdjustQty(index, 1)}
                        className="px-2.5 py-1.5 hover:bg-neutral-100 text-neutral-600 text-xs font-bold"
                      >
                        +
                      </button>
                    </div>

                    {/* Subtotal */}
                    <div className="min-w-[70px] text-right text-xs font-bold font-mono text-neutral-900">
                      €{item.subtotal.toFixed(2)}
                    </div>

                    {/* Remove */}
                    <button
                      type="button"
                      onClick={() => handleDeleteItem(index)}
                      className="text-neutral-400 hover:text-red-600 p-1 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
