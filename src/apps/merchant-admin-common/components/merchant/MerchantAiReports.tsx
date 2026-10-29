import React, { useState } from 'react';
import { BarChart3, Download, RefreshCw } from 'lucide-react';
import { apiGet } from '../../../../api/client';
import { useB2B } from '../../../../context/B2BContext';

type SalesReport = {
  filters: { from: string; to: string; status: string };
  summary: {
    orderCount: number;
    totalQuantity: number;
    totalAmount: number;
    byStatus: Array<{ status: string; orderCount: number; totalQuantity: number; totalAmount: number }>;
  };
  orders: Array<{
    id: string;
    orderNo: string;
    date: string;
    status: string;
    paymentStatus: string;
    totalQty: number;
    totalAmount: number;
    shippingFee: number;
  }>;
};

type InventoryReport = {
  asOf: string;
  filters: { search: string };
  summary: {
    skuCount: number;
    onHandQuantity: number;
    reservedQuantity: number;
    availableQuantity: number;
    inTransitQuantity: number;
  };
  rows: Array<{
    styleNo: string;
    productName: string;
    sku: string;
    color: string;
    size: string;
    onHandQuantity: number;
    reservedQuantity: number;
    availableQuantity: number;
    inTransitQuantity: number;
    updatedAt: string;
  }>;
};

type ReportKind = 'sales' | 'inventory';

const orderStatusOptions = ['placed', 'pending', 'confirmed', 'picking', 'shipped', 'delivered', 'cancelled', 'returned'];

function getInitialDateRange() {
  const end = new Date();
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - 29);
  return { from: start.toISOString().slice(0, 10), to: end.toISOString().slice(0, 10) };
}

export const MerchantAiReports: React.FC = () => {
  const { localizeCopy } = useB2B();
  const initialRange = getInitialDateRange();
  const [reportKind, setReportKind] = useState<ReportKind>('sales');
  const [from, setFrom] = useState(initialRange.from);
  const [to, setTo] = useState(initialRange.to);
  const [status, setStatus] = useState('all');
  const [search, setSearch] = useState('');
  const [salesReport, setSalesReport] = useState<SalesReport | null>(null);
  const [inventoryReport, setInventoryReport] = useState<InventoryReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const orderStatusLabels: Record<string, string> = {
    placed: localizeCopy('已下单', 'Inserito'),
    pending: localizeCopy('待处理', 'In attesa'),
    confirmed: localizeCopy('已确认', 'Confermato'),
    picking: localizeCopy('配货中', 'In preparazione'),
    shipped: localizeCopy('已发货', 'Spedito'),
    delivered: localizeCopy('已送达', 'Consegnato'),
    cancelled: localizeCopy('已取消', 'Annullato'),
    returned: localizeCopy('已退回', 'Reso')
  };
  const paymentStatusLabels: Record<string, string> = {
    paid: localizeCopy('已付款', 'Pagato'),
    unpaid: localizeCopy('未付款', 'Non pagato'),
    pending_credit: localizeCopy('账期待结', 'Credito in attesa'),
    partially_refunded: localizeCopy('部分退款', 'Rimborsato parzialmente'),
    pending_refund: localizeCopy('退款处理中', 'Rimborso in corso'),
    refunded: localizeCopy('已退款', 'Rimborsato')
  };

  const loadReport = async () => {
    setLoading(true);
    setError('');
    try {
      if (reportKind === 'sales') {
        if (!from || !to || from > to) throw new Error('AI_REPORT_DATE_RANGE_INVALID');
        const query = new URLSearchParams({ from, to, status });
        const result = await apiGet<{ success: true } & SalesReport>(`/api/merchant/ai-reports/sales?${query}`);
        setSalesReport(result);
      } else {
        const query = new URLSearchParams();
        if (search.trim()) query.set('search', search.trim());
        const result = await apiGet<{ success: true } & InventoryReport>(`/api/merchant/ai-reports/inventory?${query}`);
        setInventoryReport(result);
      }
    } catch (loadError) {
      const code = loadError instanceof Error ? loadError.message : '';
      setError(code === 'AI_REPORT_RESULT_LIMIT_EXCEEDED'
        ? localizeCopy('结果超过 5,000 条，请缩小日期范围或增加筛选条件。', 'Oltre 5.000 righe: restringi l’intervallo o aggiungi un filtro.')
        : code === 'AI_REPORT_DATE_RANGE_TOO_LARGE'
          ? localizeCopy('日期范围最多 367 天，请缩小范围。', 'L’intervallo massimo è 367 giorni.')
          : code || localizeCopy('报表读取失败，请重试。', 'Impossibile caricare il report. Riprova.'));
    } finally {
      setLoading(false);
    }
  };

  const salesExportQuery = salesReport
    ? new URLSearchParams(salesReport.filters)
    : new URLSearchParams();
  const inventoryExportQuery = inventoryReport?.filters.search
    ? new URLSearchParams({ search: inventoryReport.filters.search })
    : new URLSearchParams();
  const exportHref = reportKind === 'sales'
    ? `/api/merchant/ai-reports/sales.csv?${salesExportQuery}`
    : `/api/merchant/ai-reports/inventory.csv?${inventoryExportQuery}`;

  return (
    <section className="mt-5 rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm sm:p-5" aria-labelledby="merchant-ai-reports-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-neutral-900"><BarChart3 className="h-4 w-4" /><h3 id="merchant-ai-reports-title" className="text-sm font-bold">{localizeCopy('报表', 'Report')}</h3></div>
          <div className="mt-1 flex flex-wrap gap-2 text-[10px] text-neutral-500"><span>{localizeCopy('不推算利润', 'Nessuna stima')}</span><span>{localizeCopy('订单按日期', 'Ordini per data')}</span><span>{localizeCopy('库存为当前值', 'Scorte attuali')}</span></div>
        </div>
        <div className="flex rounded-lg border border-neutral-200 p-0.5" role="tablist" aria-label={localizeCopy('报表类型', 'Tipo di report')}>
          {(['sales', 'inventory'] as const).map(kind => <button key={kind} type="button" role="tab" aria-selected={reportKind === kind} onClick={() => { setReportKind(kind); setError(''); }} className={`rounded-md px-3 py-1.5 text-[10px] font-semibold ${reportKind === kind ? 'bg-neutral-950 text-white' : 'text-neutral-600 hover:bg-neutral-100'}`}>
            {kind === 'sales' ? localizeCopy('销售', 'Vendite') : localizeCopy('库存', 'Scorte')}
          </button>)}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-end gap-2">
        {reportKind === 'sales' ? <>
          <label className="grid gap-1 text-[10px] font-semibold text-neutral-600">{localizeCopy('开始日期', 'Dal')}<input type="date" value={from} max={to} onChange={event => setFrom(event.target.value)} className="rounded-lg border border-neutral-200 px-2.5 py-2 text-xs font-normal text-neutral-800" /></label>
          <label className="grid gap-1 text-[10px] font-semibold text-neutral-600">{localizeCopy('结束日期', 'Al')}<input type="date" value={to} min={from} onChange={event => setTo(event.target.value)} className="rounded-lg border border-neutral-200 px-2.5 py-2 text-xs font-normal text-neutral-800" /></label>
          <label className="grid gap-1 text-[10px] font-semibold text-neutral-600">{localizeCopy('订单状态', 'Stato ordine')}<select value={status} onChange={event => setStatus(event.target.value)} className="min-w-32 rounded-lg border border-neutral-200 bg-white px-2.5 py-2 text-xs font-normal text-neutral-800"><option value="all">{localizeCopy('全部状态', 'Tutti')}</option>{orderStatusOptions.map(item => <option key={item} value={item}>{orderStatusLabels[item] || item}</option>)}</select></label>
        </> : <label className="grid min-w-52 gap-1 text-[10px] font-semibold text-neutral-600">{localizeCopy('商品 / 款号 / SKU', 'Prodotto / modello / SKU')}<input value={search} maxLength={100} onChange={event => setSearch(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') void loadReport(); }} placeholder={localizeCopy('可选搜索条件', 'Filtro facoltativo')} className="rounded-lg border border-neutral-200 px-2.5 py-2 text-xs font-normal text-neutral-800" /></label>}
        <button type="button" onClick={() => void loadReport()} disabled={loading} className="inline-flex items-center gap-1.5 rounded-lg bg-neutral-950 px-3.5 py-2 text-xs font-semibold text-white disabled:opacity-50">
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />{localizeCopy('生成报表', 'Genera report')}
        </button>
        {(salesReport && reportKind === 'sales' || inventoryReport && reportKind === 'inventory') && <a href={exportHref} className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 px-3.5 py-2 text-xs font-semibold text-neutral-700 hover:bg-neutral-50"><Download className="h-3.5 w-3.5" />CSV</a>}
      </div>

      {error && <div role="alert" className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">{error}</div>}
      {reportKind === 'sales' && salesReport && <div className="mt-4">
        <div className="grid gap-2 sm:grid-cols-3">
          {[[localizeCopy('订单', 'Ordini'), salesReport.summary.orderCount], [localizeCopy('商品件数', 'Unità'), salesReport.summary.totalQuantity], [localizeCopy('订单金额', 'Importo ordini'), `€${salesReport.summary.totalAmount.toFixed(2)}`]].map(([label, value]) => <div key={label} className="rounded-lg bg-neutral-50 p-3"><div className="text-[10px] text-neutral-500">{label}</div><div className="mt-1 text-sm font-bold text-neutral-900">{value}</div></div>)}
        </div>
        <div className="mt-3 overflow-x-auto rounded-lg border border-neutral-200">
          <table className="w-full min-w-[700px] text-left text-[10px]">
            <thead className="bg-neutral-50 text-neutral-500"><tr>{[localizeCopy('日期', 'Data'), localizeCopy('订单号', 'Ordine'), localizeCopy('状态', 'Stato'), localizeCopy('支付状态', 'Pagamento'), localizeCopy('数量', 'Quantità'), localizeCopy('订单金额', 'Importo ordini'), localizeCopy('运费', 'Spedizione')].map(label => <th key={label} className="px-3 py-2 font-semibold">{label}</th>)}</tr></thead>
            <tbody>{salesReport.orders.slice(0, 50).map(order => <tr key={order.id} className="border-t border-neutral-100 text-neutral-700"><td className="px-3 py-2">{order.date}</td><td className="px-3 py-2 font-mono">{order.orderNo}</td><td className="px-3 py-2">{orderStatusLabels[order.status] || order.status}</td><td className="px-3 py-2">{paymentStatusLabels[order.paymentStatus] || order.paymentStatus}</td><td className="px-3 py-2">{order.totalQty}</td><td className="px-3 py-2">€{order.totalAmount.toFixed(2)}</td><td className="px-3 py-2">€{order.shippingFee.toFixed(2)}</td></tr>)}</tbody>
          </table>
        </div>
        {salesReport.orders.length > 50 && <p className="mt-2 text-[10px] text-neutral-500">{localizeCopy(`预览前 50 条；CSV 包含全部 ${salesReport.orders.length} 条。`, `Anteprima di 50 righe; il CSV contiene tutte le ${salesReport.orders.length} righe.`)}</p>}
      </div>}
      {reportKind === 'inventory' && inventoryReport && <div className="mt-4">
        <div className="mb-2 text-[10px] text-neutral-500">{localizeCopy('快照时间：', 'Snapshot: ')}{new Date(inventoryReport.asOf).toLocaleString()}</div>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
          {[[localizeCopy('SKU', 'SKU'), inventoryReport.summary.skuCount], [localizeCopy('现有库存', 'Giacenza'), inventoryReport.summary.onHandQuantity], [localizeCopy('已预留', 'Riservato'), inventoryReport.summary.reservedQuantity], [localizeCopy('可用库存', 'Disponibile'), inventoryReport.summary.availableQuantity], [localizeCopy('在途', 'In transito'), inventoryReport.summary.inTransitQuantity]].map(([label, value]) => <div key={label} className="rounded-lg bg-neutral-50 p-3"><div className="text-[10px] text-neutral-500">{label}</div><div className="mt-1 text-sm font-bold text-neutral-900">{value}</div></div>)}
        </div>
        <div className="mt-3 overflow-x-auto rounded-lg border border-neutral-200">
          <table className="w-full min-w-[650px] text-left text-[10px]">
            <thead className="bg-neutral-50 text-neutral-500"><tr>{[localizeCopy('款号 / 商品', 'Modello / prodotto'), localizeCopy('SKU', 'SKU'), localizeCopy('颜色 / 尺码', 'Colore / taglia'), localizeCopy('现有', 'Giacenza'), localizeCopy('预留', 'Riservato'), localizeCopy('可用', 'Disponibile'), localizeCopy('在途', 'In transito')].map(label => <th key={label} className="px-3 py-2 font-semibold">{label}</th>)}</tr></thead>
            <tbody>{inventoryReport.rows.slice(0, 50).map((row, index) => <tr key={`${row.sku}-${index}`} className="border-t border-neutral-100 text-neutral-700"><td className="px-3 py-2">{row.styleNo} · {row.productName}</td><td className="px-3 py-2 font-mono">{row.sku}</td><td className="px-3 py-2">{row.color} / {row.size}</td><td className="px-3 py-2">{row.onHandQuantity}</td><td className="px-3 py-2">{row.reservedQuantity}</td><td className="px-3 py-2">{row.availableQuantity}</td><td className="px-3 py-2">{row.inTransitQuantity}</td></tr>)}</tbody>
          </table>
        </div>
        {inventoryReport.rows.length > 50 && <p className="mt-2 text-[10px] text-neutral-500">{localizeCopy(`预览前 50 条；CSV 包含全部 ${inventoryReport.rows.length} 条。`, `Anteprima di 50 righe; il CSV contiene tutte le ${inventoryReport.rows.length} righe.`)}</p>}
      </div>}
    </section>
  );
};
