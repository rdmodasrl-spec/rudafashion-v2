import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Barcode, CheckCircle2, CreditCard, Minus, Plus, Search, ShoppingCart, Trash2, UserRound, Wallet, Printer, TrendingUp, RotateCcw, Sparkles, ChevronLeft, ChevronRight, Settings, Monitor, Save, Users, MapPin, Languages, History, Banknote, Clock3, ExternalLink } from 'lucide-react';
import type { Order, Product } from '../../../../types/b2b';
import { apiGet, apiPost, apiPut } from '../../../../api/client';
import { ProductImage } from '../../../shared/components/common/ProductImage';
import { isPosPaymentMethod, requiresPosPaymentConfirmation, type PosPaymentMethod } from '../../../../utils/posPaymentMethods';
import { useB2B } from '../../../../context/B2BContext';
import { getIntlLocale } from '../../../../i18n/translations';
import { LanguagePicker } from '../../../shared/components/common/LanguagePicker';


type PosCustomer = {
  id: string;
  companyName: string;
  status: 'pending' | 'approved' | 'rejected';
  discountRate: number;
  creditLimit: number;
  usedCredit: number;
};

type PosLine = {
  product: Product;
  sku: string;
  quantity: number;
};

type PaymentMethod = PosPaymentMethod;
type PosSettings = {
  paperWidth: 58 | 80;
  autoPrint: boolean;
  autoFocusScanner: boolean;
  receiptFooter: string;
  returnWindowDays: number;
  cartRetentionHours: number;
  requireOpenShift: boolean;
  customerDisplayEnabled: boolean;
  customerDisplayMessage: string;
  language: 'auto' | 'zh' | 'it';
};
type PosCashMovement = {
  id: string;
  direction: 'in' | 'out';
  amount: number | string;
  reason: string;
  createdAt: string;
};
type PosShift = {
  id: string;
  status: 'open' | 'closed';
  openingCash: number;
  expectedCash: number;
  cashSales: number;
  cashRefunds: number;
  cashIn: number;
  cashOut: number;
  openedAt: string;
  employee?: { name: string } | null;
  movements: PosCashMovement[];
};
type HeldCart = {
  id: string;
  createdAt: string;
  customerId: string;
  paymentMethod: PaymentMethod;
  items: Array<{ productId: string; sku: string; quantity: number }>;
};
type PosActivity = { id: string; action: string; entityId: string | null; metadata: string | null; createdAt: string; employee?: { name: string } | null };
type PosOperationsIntelligence = {
  summary: { recentGmv?: number; previousGmv?: number; gmvTrend?: number; lowStockSkus: number; slowMoverSkus?: number };
  replenishment: Array<{ variantId: string; styleNo: string; sku: string; availableQuantity: number; sold30d: number; daysCover: number | null; suggestedQuantity: number }>;
  slowMovers?: Array<{ variantId: string; styleNo: string; name: string; sku: string; availableQuantity: number; sold30d: number; daysCover: number | null }>;
};

interface MerchantSmartPosProps {
  mobileMode?: boolean;
  merchantId: string;
  products: Product[];
  customers: PosCustomer[];
  orders: Order[];
  operationsIntelligence: PosOperationsIntelligence | null;
  merchantName: string;
  merchantLocation: { city: string; country: string; address: string };
  isIt: boolean;
  onOrderCreated: (orderNo?: string) => Promise<void>;
  onRefreshProducts: () => Promise<void>;
  onNotify: (type: 'success' | 'warning', title: string, message: string) => void;
  onAskAI: (question: string, onReply: (reply: string) => void) => Promise<boolean>;
  onOpenMerchantSettings: (section: 'staff' | 'location') => void;
}

export const MerchantSmartPos: React.FC<MerchantSmartPosProps> = ({
  mobileMode = false,
  merchantId,
  products,
  customers,
  orders,
  operationsIntelligence,
  merchantName,
  merchantLocation,
  isIt,
  onOrderCreated,
  onRefreshProducts,
  onNotify,
  onAskAI,
  onOpenMerchantSettings
}) => {
  const { localizeCopy, lang } = useB2B();
  const text = {
    sectionLabel: localizeCopy("智能 POS 收银台", "Cassa POS intelligente"),
    title: localizeCopy("智能收银", "Cassa RUDA Smart POS"),
    store: localizeCopy("当前门店", "Negozio attuale"),
    recentSale: localizeCopy("最近一笔销售已入账", "Ultima vendita registrata"),
    continueSale: localizeCopy("继续收银", "Continua la vendita"),
    scanPlaceholder: localizeCopy("搜索商品", "Cerca prodotti"),
    search: localizeCopy("查找 / 加入", "Cerca e aggiungi"),
    available: localizeCopy("可售", "disponibili"),
    pieces: localizeCopy("件", "pz"),
    add: localizeCopy("加入", "Aggiungi"),
    noMatch: localizeCopy("没有匹配的在售商品或可用库存。", "Nessun prodotto in vendita o disponibile in magazzino corrisponde alla ricerca."),
    noStock: localizeCopy("暂无有库存的已上架商品。", "Nessun prodotto pubblicato con scorte disponibili."),
    cart: localizeCopy("当前购物车", "Carrello"),
    customerPlaceholder: localizeCopy("选填：搜索已认证客户（散客可留空）", "Facoltativo: cerca un cliente verificato (vuoto per cliente occasionale)"),
    selectCustomer: localizeCopy("选择客户", "Seleziona cliente"),
    wholesaleDiscount: localizeCopy("批发价 · 客户折扣", "Prezzo all’ingrosso · sconto cliente"),
    removeCustomer: localizeCopy("移除客户，按门店零售价结算", "Rimuovi cliente e applica il prezzo al dettaglio"),
    removeItem: localizeCopy("移除", "Rimuovi"),
    decreaseQuantity: localizeCopy("减少数量", "Riduci quantità"),
    increaseQuantity: localizeCopy("增加数量", "Aumenta quantità"),
    startSale: localizeCopy("扫描或选择商品开始收银", "Scansiona o seleziona un prodotto per iniziare"),
    paymentMethod: localizeCopy("付款方式", "Metodo di pagamento"),
    cash: localizeCopy("现金（店内收款）", "Contanti (incasso in negozio)"),
    alipay: localizeCopy("支付宝（店内收款，人工确认）", "Alipay (conferma manuale)"),
    wechatPay: localizeCopy("微信支付（店内收款，人工确认）", "WeChat Pay (conferma manuale)"),
    card: localizeCopy("银行卡 / 刷卡终端（人工确认）", "Carta / POS (conferma manuale)"),
    bankTransfer: localizeCopy("IBAN 银行转账（待到账）", "Bonifico SEPA / IBAN (in attesa)"),
    net30: localizeCopy("客户账期", "Pagamento a 30 giorni"),
    customerRequired: localizeCopy("（需选择客户）", "(seleziona un cliente)"),
    confirmCash: localizeCopy("我已在店内完成收款", "Ho ricevuto il pagamento in negozio"),
    noGateway: localizeCopy("系统仅登记结果，不会发起支付。", "Il sistema registra solo la conferma: non avvia alcun pagamento."),
    creditDue: localizeCopy("订单将计入客户账期，生成待结算应收。", "L’ordine sarà aggiunto al credito cliente come importo da saldare."),
    transferDue: localizeCopy("订单会记录为待到账，不会标记为已付款。", "L’ordine resterà in attesa dell’accredito e non sarà segnato come pagato."),
    availableCredit: localizeCopy("客户可用账期", "Credito disponibile"),
    totalDue: localizeCopy("应收合计", "Totale"),
    creating: localizeCopy("正在创建订单…", "Creazione ordine…"),
    completeSale: localizeCopy("确认收银并生成订单", "Conferma incasso e crea ordine"),
    unavailableSku: localizeCopy("商品规格不可用", "Variante non disponibile"),
    configureSku: localizeCopy("请先为商品配置可售 SKU。", "Configura prima una SKU vendibile per il prodotto."),
    insufficientStock: localizeCopy("库存不足", "Scorte insufficienti"),
    needsCustomer: localizeCopy("账期付款需要客户", "Il pagamento a 30 giorni richiede un cliente"),
    selectVerifiedCustomer: localizeCopy("请选择已认证客户后再使用账期。", "Seleziona un cliente verificato per usare il pagamento a 30 giorni."),
    creditLimit: localizeCopy("客户可用额度不足", "Credito cliente insufficiente"),
    checkCredit: localizeCopy("请调整付款方式或联系客户确认账期额度。", "Modifica il metodo di pagamento o verifica il plafond con il cliente."),
    confirmPayment: localizeCopy("请确认线下收款", "Conferma l’incasso in negozio"),
    confirmPaymentMessage: localizeCopy("请先在对应收款终端或支付应用中确认实际到账。", "Conferma prima l’incasso effettivo nel terminale o nell’app di pagamento."),
    saleComplete: localizeCopy("POS 销售已完成", "Vendita POS completata"),
    stockDeducted: localizeCopy("库存已同步扣减", "Scorte aggiornate"),
    refreshFailed: localizeCopy("销售已完成，数据刷新失败", "Vendita completata, aggiornamento dati non riuscito"),
    refreshHint: localizeCopy("请刷新工作台查看最新订单和库存。", "Aggiorna il pannello per visualizzare ordini e scorte."),
    saleFailed: localizeCopy("POS 出单失败", "Creazione ordine POS non riuscita"),
    retryHint: localizeCopy("订单未能创建，请检查库存与客户额度后重试。", "Controlla le scorte e il plafond cliente prima di riprovare."),
    soldOut: localizeCopy("暂时无库存", "Esaurito"),
    catalogCount: localizeCopy("款商品", "prodotti in catalogo"),
    today: localizeCopy("今日", "Oggi"),
    register: localizeCopy("收银", "Cassa"),
    dailyReport: localizeCopy("今日营业", "Report giornaliero"),
    returns: localizeCopy("退货退款", "Resi"),
    orders: localizeCopy("笔销售", "vendite"),
    units: localizeCopy("件", "pezzi"),
    printReceipt: localizeCopy("打印小票", "Stampa ricevuta"),
    aiAdvice: localizeCopy("AI 经营建议", "Suggerimenti operativi AI"),
    askAi: localizeCopy("AI 分析本店经营", "Analizza con AI"),
    aiWorking: localizeCopy("AI 正在分析…", "Analisi in corso…"),
    aiFailed: localizeCopy("AI 分析暂不可用，请稍后重试。", "Analisi AI non disponibile, riprova più tardi."),
    aiQuestion: localizeCopy("请结合本店 POS 近期和今日销售、商品库存，给出三条具体的热销补货与滞销处理建议。只使用现有真实数据，数据不足时请明确说明。", "Analizza le vendite POS recenti e di oggi insieme alle scorte: suggerisci tre azioni concrete per riassortimento, articoli più venduti e prodotti a rotazione lenta. Usa solo i dati disponibili e indica chiaramente quando i dati non bastano."),
    replenishment: localizeCopy("建议补货", "Da riassortire"),
    slowMovers: localizeCopy("动销偏慢", "Vendite lente"),
    noAdvice: localizeCopy("暂无需要处理的经营提醒。", "Nessun avviso operativo al momento."),
    returnSearch: localizeCopy("搜索要退货的 POS 订单", "Cerca ordine POS da stornare"),
    exchangeFlow: localizeCopy("换货请先登记退货退款，再为替换商品创建一笔新的 POS 销售单。", "Per un cambio, registra prima il reso e il rimborso, poi crea una nuova vendita POS per l’articolo sostitutivo."),
    returnReason: localizeCopy("退货原因", "Motivo del reso"),
    returnConfirm: localizeCopy("我已在线下实际向客户退款。", "Confermo di aver restituito il denaro al cliente in negozio."),
    processReturn: localizeCopy("确认退货并退款", "Conferma reso e rimborso"),
    returnSuccess: localizeCopy("POS 退货已登记", "Reso POS registrato"),
    returnFailed: localizeCopy("POS 退货处理失败", "Reso POS non riuscito"),
    selectReturnOrder: localizeCopy("请选择已付款的 POS 订单", "Seleziona una vendita POS pagata"),
    noReturnOrders: localizeCopy("未找到已付款的 POS 销售订单。", "Nessuna vendita POS pagata trovata."),
    returnQuantity: localizeCopy("退货数量", "Quantità resa"),
    selectReturnItems: localizeCopy("请至少选择一件退货商品。", "Seleziona almeno un articolo da restituire."),
    confirmReturn: localizeCopy("请先确认已实际向客户完成退款。", "Conferma prima il rimborso effettivo al cliente."),
    previous: localizeCopy("上一页", "Precedente"),
    next: localizeCopy("下一页", "Successivo"),
    page: localizeCopy("页", "Pagina"),
    searchProducts: localizeCopy("搜索完整商品目录", "Cerca articoli in tutto il catalogo"),
    refundAmount: localizeCopy("退款", "Rimborsato"),
    netSales: localizeCopy("净销售额", "Vendite nette"),
    collected: localizeCopy("已收款", "Incassato"),
    outstanding: localizeCopy("待收款", "Da incassare"),
    settings: localizeCopy("POS 设置", "Impostazioni POS"),
    receiptSettings: localizeCopy("小票设置", "Impostazioni ricevuta"),
    paperWidth: localizeCopy("小票纸宽度", "Larghezza carta"),
    paper58: localizeCopy("58 毫米", "58 mm"),
    paper80: localizeCopy("80 毫米", "80 mm"),
    autoPrint: localizeCopy("收银成功后自动打印小票", "Stampa automaticamente dopo la vendita"),
    autoFocus: localizeCopy("自动聚焦扫码输入框", "Attiva automaticamente la scansione"),
    receiptFooter: localizeCopy("小票底部自定义文字", "Messaggio in fondo alla ricevuta"),
    saveSettings: localizeCopy("保存 POS 设置", "Salva impostazioni"),
    settingsSaved: localizeCopy("POS 设置已保存", "Impostazioni POS salvate"),
    settingsSaveFailed: localizeCopy("POS 设置保存失败", "Impossibile salvare le impostazioni POS"),
    scannerHelp: localizeCopy("连接 USB 或蓝牙扫码枪（键盘模式），扫码后按 Enter 即可加入商品。", "Collega uno scanner USB/Bluetooth configurato come tastiera; dopo il codice, premi Invio."),
    notTaxReceipt: localizeCopy("POS 小票仅作为内部销售凭条，不能替代税务发票或法定收据。", "La ricevuta POS è interna e non sostituisce una fattura o uno scontrino fiscale."),
    staff: localizeCopy("员工", "Personale"),
    locations: localizeCopy("地点", "Sedi"),
    language: localizeCopy("语言", "Lingua"),
    customerDisplay: localizeCopy("顾客显示屏", "Schermo cliente"),
    cashManagement: localizeCopy("现金管理", "Gestione contanti"),
    recentCarts: localizeCopy("最近购物车", "Carrelli recenti"),
    returnPolicy: localizeCopy("退货设置", "Politica resi"),
    activityLog: localizeCopy("活动日志", "Registro attività"),
    storeProfile: localizeCopy("门店地址", "Indirizzo negozio"),
    edit: localizeCopy("管理", "Gestisci"),
    currentLocation: localizeCopy("当前营业地点", "Sede operativa attuale"),
    languagePreference: localizeCopy("收银台语言", "Lingua della cassa"),
    autoLanguage: localizeCopy("跟随账户/浏览器语言", "Segui lingua account/browser"),
    openDisplay: localizeCopy("打开顾客显示屏", "Apri schermo cliente"),
    displayEnabled: localizeCopy("启用顾客显示屏", "Consenti schermo cliente"),
    displayMessage: localizeCopy("顾客屏欢迎文字", "Messaggio sullo schermo cliente"),
    cashShift: localizeCopy("收银班次", "Turno di cassa"),
    shiftOpen: localizeCopy("班次进行中", "Turno aperto"),
    shiftClosed: localizeCopy("当前没有打开的班次", "Nessun turno aperto"),
    openShift: localizeCopy("开始班次", "Apri turno"),
    closeShift: localizeCopy("结束班次", "Chiudi turno"),
    openingCash: localizeCopy("开班备用金", "Contanti iniziali"),
    closingCash: localizeCopy("实盘现金", "Contanti contati in cassa"),
    expectedCash: localizeCopy("系统应有现金", "Contanti attesi"),
    cashSales: localizeCopy("现金销售", "Vendite in contanti"),
    cashRefunds: localizeCopy("现金退款", "Rimborsi in contanti"),
    cashIn: localizeCopy("现金收入", "Entrate contanti"),
    cashOut: localizeCopy("现金支出", "Uscite contanti"),
    cashDifference: localizeCopy("现金差额", "Differenza"),
    movementReason: localizeCopy("现金变动原因", "Motivo movimento cassa"),
    movementAmount: localizeCopy("现金变动金额", "Importo movimento"),
    addCashIn: localizeCopy("登记现金收入", "Registra entrata"),
    addCashOut: localizeCopy("登记现金支出", "Registra uscita"),
    shiftNote: localizeCopy("班次备注", "Nota turno"),
    shiftRequired: localizeCopy("请先打开收银班次，再开始 POS 销售。", "Apri prima il turno di cassa per iniziare a vendere."),
    shiftSaveFailed: localizeCopy("收银班次操作失败", "Operazione turno non riuscita"),
    shiftStarted: localizeCopy("收银班次已开始", "Turno aperto"),
    shiftEnded: localizeCopy("收银班次已结束", "Turno chiuso"),
    heldCart: localizeCopy("暂存购物车", "Parcheggia carrello"),
    restoreCart: localizeCopy("恢复", "Riprendi"),
    deleteCart: localizeCopy("删除", "Elimina"),
    noHeldCarts: localizeCopy("暂无暂存购物车。", "Nessun carrello parcheggiato."),
    retention: localizeCopy("购物车自动保留", "Conserva i carrelli per"),
    hours: localizeCopy("小时", "ore"),
    returnWindow: localizeCopy("可退货期限", "Termine per i resi"),
    days: localizeCopy("天", "giorni"),
    returnWindowExpired: localizeCopy("此订单已超过退货期限。", "Il termine per il reso di questo ordine è scaduto."),
    roleEmployees: localizeCopy("可使用 POS 的员工", "Dipendenti con POS"),
    activityEmpty: localizeCopy("暂无 POS 活动记录。", "Nessuna attività POS registrata."),
    settingsReadFailed: localizeCopy("已保存的 POS 设置加载失败。", "Impossibile caricare le impostazioni salvate."),
    unsupportedIntegrations: localizeCopy("POS 订阅和应用商店依赖 RUDA 尚未接入的外部服务，因此不会显示为可用功能。", "Abbonamenti POS e marketplace di app richiedono servizi esterni non attivi su RUDA e non sono mostrati come funzioni disponibili."),
    popupBlocked: localizeCopy("请允许弹出窗口，以打开顾客显示屏。", "Consenti i popup per aprire lo schermo cliente."),
    localCartNotice: localizeCopy("暂存购物车仅保存在此设备和浏览器中。", "I carrelli parcheggiati sono salvati solo su questo dispositivo e browser."),
    cartExpired: localizeCopy("暂存购物车已过期，已自动清理。", "Il carrello parcheggiato è scaduto ed è stato eliminato."),
    noLocationsNotice: localizeCopy("RUDA 当前使用共享中心仓，尚未配置多个 POS 库存地点。", "RUDA usa un magazzino centrale condiviso; non sono configurate sedi POS multiple."),
    settingsOverview: localizeCopy("设置与设备", "Impostazioni e dispositivi"),
    storeCity: localizeCopy("城市", "Città"),
    storeCountry: localizeCopy("国家/地区", "Paese"),
    locationPolicy: localizeCopy("门店资料与中心仓", "Profilo negozio e magazzino centrale"),
    employeeActivity: localizeCopy("最近活动", "Attività recenti"),
    confirmCloseShift: localizeCopy("确认关班并提交现金盘点", "Conferma chiusura e conteggio contanti"),
    returnPolicyHelp: localizeCopy("POS 订单超过此期限后不能退款。", "Gli ordini POS non possono essere rimborsati dopo questo termine."),
    languageHint: localizeCopy("界面语言统一跟随账号语言偏好。", "La lingua dell’interfaccia segue la preferenza condivisa dell’account."),
    currentCartMustBeEmpty: localizeCopy("请先暂存或完成当前购物车，再恢复其他购物车。", "Parcheggia o completa prima il carrello attuale.")
  };
  const formatCurrency = (amount: number) => new Intl.NumberFormat(getIntlLocale(lang), {
    style: 'currency',
    currency: 'EUR'
  }).format(amount);
  const [query, setQuery] = useState('');
  const [customerQuery, setCustomerQuery] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [selectedSkus, setSelectedSkus] = useState<Record<string, string>>({});
  const [lines, setLines] = useState<PosLine[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [paymentConfirmed, setPaymentConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [lastOrder, setLastOrder] = useState<{
    orderNo: string;
    totalAmount: number;
    createdAt: string;
    customerName: string;
    paymentMethod: PaymentMethod;
    items: Array<{ name: string; sku: string; quantity: number; unitPrice: number }>;
  } | null>(null);
  const [activePanel, setActivePanel] = useState<'register' | 'report' | 'returns' | 'settings'>('register');
  const [mobileCheckoutOpen, setMobileCheckoutOpen] = useState(false);
  const [catalogPage, setCatalogPage] = useState(0);
  const [returnOrderQuery, setReturnOrderQuery] = useState('');
  const [selectedReturnOrderId, setSelectedReturnOrderId] = useState('');
  const [returnQuantities, setReturnQuantities] = useState<Record<string, number>>({});
  const [returnReason, setReturnReason] = useState('');
  const [returnConfirmed, setReturnConfirmed] = useState(false);
  const [returnSubmitting, setReturnSubmitting] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiReply, setAiReply] = useState('');
  const [activeSettingsSection, setActiveSettingsSection] = useState<'overview' | 'staff' | 'location' | 'language' | 'display' | 'receipt' | 'register' | 'carts' | 'returns' | 'activity'>('overview');
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [posSettings, setPosSettings] = useState<PosSettings>({
    paperWidth: 80,
    autoPrint: false,
    autoFocusScanner: true,
    receiptFooter: '',
    returnWindowDays: 30,
    cartRetentionHours: 24,
    requireOpenShift: true,
    customerDisplayEnabled: true,
    customerDisplayMessage: '',
    language: 'auto'
  });
  const [shift, setShift] = useState<PosShift | null>(null);
  const [shiftLoading, setShiftLoading] = useState(true);
  const [shiftBusy, setShiftBusy] = useState(false);
  const [openingCash, setOpeningCash] = useState('0');
  const [closingCash, setClosingCash] = useState('');
  const [movementAmount, setMovementAmount] = useState('');
  const [movementReason, setMovementReason] = useState('');
  const [shiftNote, setShiftNote] = useState('');
  const [heldCarts, setHeldCarts] = useState<HeldCart[]>(() => {
    try {
      const saved = window.localStorage.getItem(`ruda-pos-held-carts:${merchantId}`);
      if (!saved) return [];
      const parsed: unknown = JSON.parse(saved);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter((value): value is HeldCart => {
        if (!value || typeof value !== 'object') return false;
        const cart = value as Partial<HeldCart>;
        return typeof cart.id === 'string'
          && typeof cart.createdAt === 'string'
          && Number.isFinite(Date.parse(cart.createdAt))
          && typeof cart.customerId === 'string'
          && isPosPaymentMethod(String(cart.paymentMethod))
          && Array.isArray(cart.items)
          && cart.items.every(item => !!item && typeof item.productId === 'string' && typeof item.sku === 'string' && Number.isInteger(item.quantity) && item.quantity > 0);
      });
    } catch (error) {
      console.warn('[merchant-pos-carts] Could not load saved carts.', error);
      return [];
    }
  });
  const [posActivities, setPosActivities] = useState<PosActivity[]>([]);
  const [displayWindow, setDisplayWindow] = useState<Window | null>(null);
  const displayWindowRef = useRef<Window | null>(null);
  const scanInputRef = useRef<HTMLInputElement>(null);
  const refreshProductsRef = useRef(onRefreshProducts);
  const refreshProductsErrorReported = useRef(false);
  const notifyRef = useRef(onNotify);
  const submissionIdentity = useRef<{ signature: string; key: string } | null>(null);
  const returnSubmissionIdentity = useRef<{ signature: string; key: string } | null>(null);
  const autoPrintNextReceipt = useRef(false);
  const pageSize = mobileMode ? 12 : 30;
  refreshProductsRef.current = onRefreshProducts;
  notifyRef.current = onNotify;

  useEffect(() => {
    let active = true;
    const refreshProducts = async () => {
      if (document.visibilityState === 'hidden') return;
      try {
        await refreshProductsRef.current();
        refreshProductsErrorReported.current = false;
      } catch (error) {
        if (!active || refreshProductsErrorReported.current) return;
        refreshProductsErrorReported.current = true;
        notifyRef.current('warning', text.refreshFailed, error instanceof Error ? error.message : text.refreshHint);
      }
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') void refreshProducts();
    };
    void refreshProducts();
    const interval = window.setInterval(() => void refreshProducts(), 30_000);
    window.addEventListener('focus', handleVisibilityChange);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      active = false;
      window.clearInterval(interval);
      window.removeEventListener('focus', handleVisibilityChange);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [merchantId]);

  const refreshShift = async () => {
    setShiftLoading(true);
    try {
      const result = await apiGet<{ success: true; shift: PosShift | null }>('/api/merchant/pos/shifts/current');
      setShift(result.shift);
    } catch (error) {
      onNotify('warning', text.shiftSaveFailed, error instanceof Error ? error.message : text.settingsReadFailed);
    } finally {
      setShiftLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    setSettingsLoading(true);
    void apiGet<{ success: true; settings: PosSettings }>('/api/merchant/pos/settings')
      .then(result => {
        if (!active) return;
        setPosSettings(result.settings);
      })
      .catch(error => {
        console.error('[merchant-pos-settings]', error);
        if (active) onNotify('warning', text.settingsReadFailed, error instanceof Error ? error.message : text.settingsReadFailed);
      })
      .finally(() => { if (active) setSettingsLoading(false); });
    void refreshShift();
    return () => { active = false; };
  }, [merchantId]);

  useEffect(() => {
    if (settingsLoading) return;
    if (posSettings.cartRetentionHours === 0) return;
    const cutoff = Date.now() - posSettings.cartRetentionHours * 60 * 60 * 1000;
    const fresh = heldCarts.filter(cart => new Date(cart.createdAt).getTime() >= cutoff);
    if (fresh.length !== heldCarts.length) {
      setHeldCarts(fresh);
      try {
        window.localStorage.setItem(`ruda-pos-held-carts:${merchantId}`, JSON.stringify(fresh));
      } catch (error) {
        onNotify('warning', text.settingsSaveFailed, error instanceof Error ? error.message : text.settingsSaveFailed);
      }
    }
  }, [heldCarts, merchantId, posSettings.cartRetentionHours, settingsLoading]);

  useEffect(() => () => {
    if (displayWindowRef.current && !displayWindowRef.current.closed) displayWindowRef.current.close();
  }, []);

  const approvedCustomers = useMemo(
    () => customers.filter(customer => customer.status === 'approved'),
    [customers]
  );
  const selectedCustomer = approvedCustomers.find(customer => customer.id === selectedCustomerId);
  const visibleProducts = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    return products.filter(product => {
      if (product.lifecycleStatus !== 'published') return false;
      if (!normalized) return true;
      return [
        product.styleNo,
        product.name,
        product.name_zh,
        product.name_it,
        product.category,
        product.subCategory,
        ...product.skus.flatMap(sku => [sku.sku, sku.barcode, sku.color, sku.size])
      ].some(value => value?.toLocaleLowerCase().includes(normalized));
    });
  }, [products, query]);
  const pageCount = Math.max(1, Math.ceil(visibleProducts.length / pageSize));
  const pagedProducts = visibleProducts.slice(catalogPage * pageSize, (catalogPage + 1) * pageSize);
  const todayKey = new Date().toLocaleDateString('en-CA');
  const todayOrders = orders.filter(order =>
    order.orderNo.startsWith('POS-')
    && new Date(order.createdAt || `${order.date}T00:00:00`).toLocaleDateString('en-CA') === todayKey
    && order.status !== 'cancelled'
  );
  const todayGross = todayOrders.reduce((sum, order) => sum + order.totalAmount, 0);
  const todayRefunds = todayOrders.reduce((sum, order) => sum + (order.refundAmount || 0), 0);
  const todayCollected = todayOrders
    .filter(order => ['paid', 'partially_refunded', 'refunded'].includes(order.paymentStatus))
    .reduce((sum, order) => sum + order.totalAmount - (order.refundAmount || 0), 0);
  const todayOutstanding = todayOrders
    .filter(order => ['unpaid', 'pending_credit', 'pending'].includes(order.paymentStatus))
    .reduce((sum, order) => sum + order.totalAmount, 0);
  const todayUnits = todayOrders.reduce((sum, order) => sum + order.totalQty, 0);
  const dailyTopProducts = [...todayOrders.reduce((totals, order) => {
    for (const item of order.items) {
      const key = `${item.styleNo || item.productName} · ${item.sku}`;
      totals.set(key, (totals.get(key) || 0) + item.quantity);
    }
    return totals;
  }, new Map<string, number>())].sort((left, right) => right[1] - left[1]).slice(0, 5);
  const returnOrders = orders.filter(order =>
    order.orderNo.startsWith('POS-')
    && ['paid', 'partially_refunded'].includes(order.paymentStatus)
    && order.status !== 'cancelled'
  );
  const normalizedReturnQuery = returnOrderQuery.trim().toLocaleLowerCase();
  const matchingReturnOrders = returnOrders.filter(order =>
    !normalizedReturnQuery
    || order.orderNo.toLocaleLowerCase().includes(normalizedReturnQuery)
    || order.companyName.toLocaleLowerCase().includes(normalizedReturnQuery)
  ).slice(0, 20);
  const selectedReturnOrder = returnOrders.find(order => order.id === selectedReturnOrderId);
  const isReturnWindowExpired = (order: Order) => {
    const purchasedAt = new Date(order.createdAt || `${order.date}T00:00:00`).getTime();
    return Number.isFinite(purchasedAt) && Date.now() - purchasedAt > posSettings.returnWindowDays * 24 * 60 * 60 * 1000;
  };

  const unitPrice = (product: Product) => selectedCustomer
    ? Number((product.wholesalePrice * selectedCustomer.discountRate).toFixed(2))
    : Number((product.rrpPrice || product.wholesalePrice).toFixed(2));
  const totalAmount = lines.reduce((sum, line) => sum + line.quantity * unitPrice(line.product), 0);
  const totalQuantity = lines.reduce((sum, line) => sum + line.quantity, 0);
  const expectedCartRetentionCutoff = posSettings.cartRetentionHours > 0
    ? Date.now() - posSettings.cartRetentionHours * 60 * 60 * 1000
    : null;
  const customerMatches = customerQuery.trim()
    ? approvedCustomers.filter(customer => customer.companyName.toLocaleLowerCase().includes(customerQuery.trim().toLocaleLowerCase())).slice(0, 6)
    : [];
  const directPayment = requiresPosPaymentConfirmation(paymentMethod);

  useEffect(() => {
    const target = displayWindow;
    if (!target || target.closed) return;
    const root = target.document.getElementById('ruda-pos-customer-display');
    if (!root) return;
    root.replaceChildren();
    const container = target.document.createElement('main');
    container.style.cssText = 'min-height:100vh;box-sizing:border-box;padding:6vh 8vw;background:#f8fafc;color:#111827;font:18px/1.5 system-ui,sans-serif';
    const heading = target.document.createElement('h1');
    heading.textContent = merchantName;
    heading.style.cssText = 'margin:0 0 12px;font-size:clamp(28px,4vw,48px)';
    const message = target.document.createElement('p');
    message.textContent = lastOrder
      ? (localizeCopy('感谢惠顾！', 'Grazie per il tuo acquisto!'))
      : posSettings.customerDisplayMessage || (localizeCopy("欢迎光临", "Benvenuti"));
    message.style.cssText = 'color:#64748b';
    const list = target.document.createElement('ul');
    list.style.cssText = 'margin:36px 0;padding:0;list-style:none;border-top:1px solid #e2e8f0';
    const displayItems = lastOrder?.items || lines.map(line => ({
      name: isIt ? line.product.name_it || line.product.name : line.product.name_zh || line.product.name,
      sku: line.sku,
      quantity: line.quantity,
      unitPrice: unitPrice(line.product)
    }));
    for (const line of displayItems) {
      const item = target.document.createElement('li');
      item.textContent = `${line.name} · ${line.sku} × ${line.quantity} — ${formatCurrency(line.quantity * line.unitPrice)}`;
      item.style.cssText = 'padding:14px 0;border-bottom:1px solid #e2e8f0';
      list.append(item);
    }
    const total = target.document.createElement('p');
    total.textContent = `${text.totalDue}: ${formatCurrency(lastOrder?.totalAmount ?? totalAmount)}`;
    total.style.cssText = 'text-align:right;font-size:clamp(26px,4vw,42px);font-weight:800';
    const footer = target.document.createElement('p');
    footer.textContent = localizeCopy("请在付款前核对商品与金额。", "Verifica gli articoli prima del pagamento.");
    footer.style.cssText = 'margin-top:8vh;text-align:center;color:#64748b;font-size:14px';
    container.append(heading, message, list, total, footer);
    root.append(container);
  }, [displayWindow, lines, isIt, lastOrder, merchantName, posSettings.customerDisplayMessage, selectedCustomer, totalAmount, text.totalDue]);

  const addProduct = (product: Product, requestedSku?: string) => {
    const selectedSku = requestedSku || selectedSkus[product.id] || product.skus[0]?.sku;
    const sku = product.skus.find(item => item.sku === selectedSku);
    if (!sku) {
      onNotify('warning', text.unavailableSku, text.configureSku);
      return;
    }
    const available = Math.max(0, sku.stockCentral - (sku.reserved || 0));
    const existing = lines.find(line => line.product.id === product.id && line.sku === sku.sku);
    if (available < (existing?.quantity || 0) + 1) {
      onNotify('warning', text.insufficientStock, `${sku.sku}: ${text.available} ${available} ${text.pieces}.`);
      return;
    }
    setLines(previous => {
      const lineExists = previous.some(line => line.product.id === product.id && line.sku === sku.sku);
      return lineExists
        ? previous.map(line => line.product.id === product.id && line.sku === sku.sku ? { ...line, quantity: line.quantity + 1 } : line)
        : [...previous, { product, sku: sku.sku, quantity: 1 }];
    });
    setLastOrder(null);
    if (requestedSku) setQuery('');
  };

  const scanOrSearch = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = query.trim().toLocaleLowerCase();
    if (!value) return;
    const exactMatch = products.flatMap(product => product.skus.map(sku => ({ product, sku })))
      .find(({ product, sku }) =>
        product.lifecycleStatus === 'published'
        && (sku.barcode?.toLocaleLowerCase() === value || sku.sku.toLocaleLowerCase() === value)
      );
    if (exactMatch) {
      addProduct(exactMatch.product, exactMatch.sku.sku);
      return;
    }
    const exactStyle = products.find(product => product.lifecycleStatus === 'published' && product.styleNo.toLocaleLowerCase() === value);
    if (exactStyle) {
      const availableSku = exactStyle.skus.find(sku => Math.max(0, sku.stockCentral - (sku.reserved || 0)) > 0);
      if (availableSku) addProduct(exactStyle, availableSku.sku);
      else onNotify('warning', text.insufficientStock, text.soldOut);
      return;
    }
    if (visibleProducts.length === 1) {
      const availableSku = visibleProducts[0].skus.find(sku => Math.max(0, sku.stockCentral - (sku.reserved || 0)) > 0);
      if (availableSku) addProduct(visibleProducts[0], availableSku.sku);
      else onNotify('warning', text.insufficientStock, text.soldOut);
    }
  };

  const updateQuantity = (line: PosLine, nextQuantity: number) => {
    if (nextQuantity < 1) {
      setLines(previous => previous.filter(item => item !== line));
      return;
    }
    const sku = line.product.skus.find(item => item.sku === line.sku);
    const available = Math.max(0, (sku?.stockCentral || 0) - (sku?.reserved || 0));
    if (nextQuantity > available) {
      onNotify('warning', text.insufficientStock, `${line.sku}: ${text.available} ${available} ${text.pieces}.`);
      return;
    }
    setLines(previous => previous.map(item => item === line ? { ...item, quantity: nextQuantity } : item));
  };

  const submitSale = async () => {
    if (!lines.length || submitting) return;
    if (posSettings.requireOpenShift && !shift) {
      onNotify('warning', text.shiftSaveFailed, text.shiftRequired);
      return;
    }
    if (paymentMethod === 'net_30' && !selectedCustomer) {
      onNotify('warning', text.needsCustomer, text.selectVerifiedCustomer);
      return;
    }
    if (paymentMethod === 'net_30' && selectedCustomer && totalAmount > selectedCustomer.creditLimit - selectedCustomer.usedCredit) {
      onNotify('warning', text.creditLimit, text.checkCredit);
      return;
    }
    if (directPayment && !paymentConfirmed) {
      onNotify('warning', text.confirmPayment, text.confirmPaymentMessage);
      return;
    }

    setSubmitting(true);
    try {
      const signature = JSON.stringify({
        customerId: selectedCustomer?.id || null,
        paymentMethod,
        posShiftId: shift?.id || null,
        items: lines.map(line => ({ productId: line.product.id, sku: line.sku, quantity: line.quantity }))
      });
      if (submissionIdentity.current?.signature !== signature) {
        submissionIdentity.current = { signature, key: crypto.randomUUID() };
      }
      const result = await apiPost<{ success: true; order: { orderNo: string; totalAmount: number } }>('/api/merchant/employee-orders', {
        source: 'pos',
        customerId: selectedCustomer?.id || undefined,
        paymentMethod,
        posShiftId: shift?.id,
        paymentConfirmed: directPayment,
        items: lines.map(line => ({ productId: line.product.id, sku: line.sku, quantity: line.quantity })),
        idempotencyKey: submissionIdentity.current.key
      });
      submissionIdentity.current = null;
      if (mobileMode) setMobileCheckoutOpen(false);
      autoPrintNextReceipt.current = posSettings.autoPrint;
      setLastOrder({
        ...result.order,
        createdAt: new Date().toISOString(),
        customerName: selectedCustomer?.companyName || (localizeCopy("散客", "Cliente occasionale")),
        paymentMethod,
        items: lines.map(line => ({
          name: isIt ? line.product.name_it || line.product.name : line.product.name_zh || line.product.name,
          sku: line.sku,
          quantity: line.quantity,
          unitPrice: unitPrice(line.product)
        }))
      });
      setLines([]);
      setPaymentConfirmed(false);
      onNotify('success', text.saleComplete, `${result.order.orderNo} · ${formatCurrency(result.order.totalAmount)} · ${text.stockDeducted}`);
      try {
        await onOrderCreated(result.order.orderNo);
      } catch (error) {
        onNotify('warning', text.refreshFailed, error instanceof Error ? error.message : text.refreshHint);
      }
    } catch (error) {
      onNotify('warning', text.saleFailed, error instanceof Error ? error.message : text.retryHint);
    } finally {
      setSubmitting(false);
    }
  };

  const submitReturn = async () => {
    if (!selectedReturnOrder || returnSubmitting) return;
    if (isReturnWindowExpired(selectedReturnOrder)) {
      onNotify('warning', text.returnFailed, text.returnWindowExpired);
      return;
    }
    const items = selectedReturnOrder.items
      .map(item => ({ productId: item.productId, sku: item.sku, quantity: returnQuantities[`${item.productId}:${item.sku}`] || 0 }))
      .filter(item => item.quantity > 0);
    if (!items.length) {
      onNotify('warning', text.returnFailed, text.selectReturnItems);
      return;
    }
    if (!returnConfirmed) {
      onNotify('warning', text.confirmPayment, text.confirmReturn);
      return;
    }
    if (!returnReason.trim()) {
      onNotify('warning', text.returnFailed, text.returnReason);
      return;
    }
    setReturnSubmitting(true);
    const signature = JSON.stringify({ orderId: selectedReturnOrder.id, items, reason: returnReason.trim() });
    if (returnSubmissionIdentity.current?.signature !== signature) {
      returnSubmissionIdentity.current = { signature, key: crypto.randomUUID() };
    }
    try {
      const result = await apiPost<{ success: true; refundAmount: number }>('/api/merchant/pos/returns', {
        orderId: selectedReturnOrder.id,
        items,
        reason: returnReason.trim(),
        refundConfirmed: true,
        idempotencyKey: returnSubmissionIdentity.current.key
      });
      returnSubmissionIdentity.current = null;
      onNotify('success', text.returnSuccess, `${selectedReturnOrder.orderNo} · ${formatCurrency(result.refundAmount)}`);
      setSelectedReturnOrderId('');
      setReturnQuantities({});
      setReturnReason('');
      setReturnConfirmed(false);
      try {
        await onOrderCreated();
      } catch (error) {
        onNotify('warning', text.refreshFailed, error instanceof Error ? error.message : text.refreshHint);
      }
    } catch (error) {
      onNotify('warning', text.returnFailed, error instanceof Error ? error.message : text.retryHint);
    } finally {
      setReturnSubmitting(false);
    }
  };

  const askAiForAdvice = async () => {
    if (aiBusy) return;
    setAiBusy(true);
    setAiReply('');
    try {
      const answered = await onAskAI(text.aiQuestion, setAiReply);
      if (!answered) onNotify('warning', text.aiAdvice, text.aiFailed);
    } catch (error) {
      onNotify('warning', text.aiAdvice, error instanceof Error ? error.message : text.aiFailed);
    } finally {
      setAiBusy(false);
    }
  };

  const savePosSettings = async (nextSettings: PosSettings) => {
    if (settingsSaving) return;
    setSettingsSaving(true);
    try {
      const result = await apiPut<{ success: true; settings: PosSettings }>('/api/merchant/pos/settings', nextSettings);
      setPosSettings(result.settings);
      onNotify('success', text.settingsSaved, text.settings);
    } catch (error) {
      onNotify('warning', text.settingsSaveFailed, error instanceof Error ? error.message : text.settingsSaveFailed);
    } finally {
      setSettingsSaving(false);
    }
  };

  const openCashShift = async () => {
    if (shiftBusy) return;
    setShiftBusy(true);
    try {
      const result = await apiPost<{ success: true; shift: PosShift }>('/api/merchant/pos/shifts', {
        openingCash: openingCash || '0',
        note: shiftNote
      });
      setShift(result.shift);
      setShiftNote('');
      onNotify('success', text.shiftStarted, `${text.expectedCash}: ${formatCurrency(result.shift.expectedCash)}`);
    } catch (error) {
      onNotify('warning', text.shiftSaveFailed, error instanceof Error ? error.message : text.retryHint);
    } finally {
      setShiftBusy(false);
    }
  };

  const recordCashMovement = async (direction: 'in' | 'out') => {
    if (!shift || shiftBusy) return;
    setShiftBusy(true);
    try {
      await apiPost(`/api/merchant/pos/shifts/${encodeURIComponent(shift.id)}/cash-movements`, {
        direction,
        amount: movementAmount,
        reason: movementReason.trim(),
        idempotencyKey: crypto.randomUUID()
      });
      setMovementAmount('');
      setMovementReason('');
      await refreshShift();
    } catch (error) {
      onNotify('warning', text.shiftSaveFailed, error instanceof Error ? error.message : text.retryHint);
    } finally {
      setShiftBusy(false);
    }
  };

  const closeCashShift = async () => {
    if (!shift || shiftBusy) return;
    setShiftBusy(true);
    try {
      const result = await apiPost<{ success: true; shift: { expectedCash: number; cashDifference: number } }>(
        `/api/merchant/pos/shifts/${encodeURIComponent(shift.id)}/close`,
        { closingCash, note: shiftNote }
      );
      setShift(null);
      setClosingCash('');
      setShiftNote('');
      onNotify('success', text.shiftEnded, `${text.expectedCash}: ${formatCurrency(result.shift.expectedCash)} · ${text.cashDifference}: ${formatCurrency(result.shift.cashDifference)}`);
    } catch (error) {
      onNotify('warning', text.shiftSaveFailed, error instanceof Error ? error.message : text.retryHint);
    } finally {
      setShiftBusy(false);
    }
  };

  const persistHeldCarts = (nextCarts: HeldCart[]) => {
    try {
      window.localStorage.setItem(`ruda-pos-held-carts:${merchantId}`, JSON.stringify(nextCarts));
      setHeldCarts(nextCarts);
      return true;
    } catch (error) {
      onNotify('warning', text.settingsSaveFailed, error instanceof Error ? error.message : text.settingsSaveFailed);
      return false;
    }
  };

  const parkCurrentCart = () => {
    if (!lines.length) return;
    const cart: HeldCart = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      customerId: selectedCustomer?.id || '',
      paymentMethod,
      items: lines.map(line => ({ productId: line.product.id, sku: line.sku, quantity: line.quantity }))
    };
    if (persistHeldCarts([cart, ...heldCarts])) {
      setLines([]);
      setSelectedCustomerId('');
      setPaymentConfirmed(false);
      setLastOrder(null);
    }
  };

  const restoreHeldCart = (cart: HeldCart) => {
    if (lines.length) {
      onNotify('warning', text.cart, text.currentCartMustBeEmpty);
      return;
    }
    if (expectedCartRetentionCutoff !== null && new Date(cart.createdAt).getTime() < expectedCartRetentionCutoff) {
      onNotify('warning', text.recentCarts, text.cartExpired);
      persistHeldCarts(heldCarts.filter(item => item.id !== cart.id));
      return;
    }
    const restored: PosLine[] = [];
    for (const item of cart.items) {
      const product = products.find(candidate => candidate.id === item.productId && candidate.lifecycleStatus === 'published');
      const sku = product?.skus.find(candidate => candidate.sku === item.sku);
      const available = sku ? Math.max(0, sku.stockCentral - (sku.reserved || 0)) : 0;
      if (!product || !sku || available < item.quantity) {
        onNotify('warning', text.insufficientStock, `${item.sku}: ${text.available} ${available} ${text.pieces}.`);
        return;
      }
      restored.push({ product, sku: item.sku, quantity: item.quantity });
    }
    setLines(restored);
    setSelectedCustomerId(approvedCustomers.some(customer => customer.id === cart.customerId) ? cart.customerId : '');
    setPaymentMethod(cart.paymentMethod);
    setPaymentConfirmed(false);
    setLastOrder(null);
    persistHeldCarts(heldCarts.filter(item => item.id !== cart.id));
    setActivePanel('register');
  };

  const openCustomerDisplay = () => {
    if (!posSettings.customerDisplayEnabled) return;
    const target = window.open('', `ruda-pos-customer-display-${merchantId}`, 'popup,width=900,height=700');
    if (!target) {
      onNotify('warning', text.customerDisplay, text.popupBlocked);
      return;
    }
    target.opener = null;
    target.document.title = `${merchantName} · RUDA POS`;
    const root = target.document.createElement('div');
    root.id = 'ruda-pos-customer-display';
    target.document.body.replaceChildren(root);
    target.document.body.style.margin = '0';
    displayWindowRef.current = target;
    setDisplayWindow(target);
  };

  const loadPosActivities = async () => {
    try {
      const result = await apiGet<{ success: true; activities: PosActivity[] }>('/api/merchant/pos/activity');
      setPosActivities(result.activities);
    } catch (error) {
      onNotify('warning', text.activityLog, error instanceof Error ? error.message : text.settingsReadFailed);
    }
  };

  React.useEffect(() => {
    if (!mobileMode && activePanel === 'register' && posSettings.autoFocusScanner) {
      scanInputRef.current?.focus();
    }
  }, [activePanel, mobileMode, posSettings.autoFocusScanner]);

  React.useEffect(() => {
    if (!lastOrder || !autoPrintNextReceipt.current) return;
    autoPrintNextReceipt.current = false;
    const printTimer = window.setTimeout(() => window.print(), 250);
    return () => window.clearTimeout(printTimer);
  }, [lastOrder]);

  return (
    <section className={mobileMode ? 'relative flex h-full min-h-0 flex-col overflow-hidden bg-[#f5f5f7]' : 'space-y-4'} aria-label={text.sectionLabel}>
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #merchant-pos-receipt, #merchant-pos-receipt * { visibility: visible !important; }
          #merchant-pos-receipt { display: block !important; position: fixed; inset: 0; width: ${posSettings.paperWidth}mm; margin: 0 auto; padding: 5mm; background: #fff; color: #111; font: 12px/1.45 sans-serif; }
        }
      `}</style>
      {!mobileMode && <header className="border-b border-neutral-200 bg-white px-4 py-3">
        <h1 className="text-lg font-semibold tracking-tight text-neutral-950">{text.title}</h1>
      </header>}

      {!mobileMode && <nav className="flex flex-wrap gap-2" aria-label={text.sectionLabel}>
        {([
          ['register', text.register, ShoppingCart],
          ['report', text.dailyReport, TrendingUp],
          ['returns', text.returns, RotateCcw],
          ['settings', text.settings, Settings]
        ] as const).map(([panel, label, Icon]) => (
          <button key={panel} type="button" onClick={() => { setActivePanel(panel); if (panel === 'settings') setActiveSettingsSection('overview'); }} aria-current={activePanel === panel ? 'page' : undefined} className={`inline-flex h-10 items-center gap-2 rounded-xl px-4 text-xs font-semibold transition ${activePanel === panel ? 'bg-neutral-950 text-white shadow-sm' : 'border border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50'}`}>
            <Icon className="h-4 w-4" />{label}
          </button>
        ))}
      </nav>}
      {mobileMode && <header className="z-10 flex shrink-0 items-center justify-between border-b border-neutral-200 bg-white px-4 py-3 shadow-sm">
        <div className="min-w-0">
          <h1 className="truncate text-sm font-semibold text-neutral-900">{text.title}</h1>
        </div>
        {activePanel !== 'register' && <button type="button" onClick={() => {
          if (activePanel === 'settings') setActivePanel('register');
          else { setActivePanel('settings'); setActiveSettingsSection('overview'); }
        }} className="inline-flex h-9 items-center gap-2 rounded-xl border border-neutral-200 px-3 text-xs font-semibold">
          <ChevronLeft className="h-4 w-4" />{activePanel === 'settings' ? text.register : text.settings}
        </button>}
        {activePanel === 'register' && <button type="button" onClick={() => { setActivePanel('settings'); setActiveSettingsSection('overview'); }} aria-label={text.settings} className="flex h-10 w-10 items-center justify-center rounded-xl border border-neutral-200 text-neutral-700">
          <Settings className="h-5 w-5" />
        </button>}
      </header>}

      {activePanel === 'register' && lastOrder && (
        <div role="status" className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 shrink-0" />
            <div><p className="text-sm font-bold">{text.recentSale}</p><p className="mt-0.5 text-xs">{lastOrder.orderNo} · {formatCurrency(lastOrder.totalAmount)}</p></div>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 px-3 py-2 text-xs font-semibold hover:bg-white"><Printer className="h-3.5 w-3.5" />{text.printReceipt}</button>
            <button type="button" onClick={() => setLastOrder(null)} className="rounded-lg border border-emerald-200 px-3 py-2 text-xs font-semibold hover:bg-white">{text.continueSale}</button>
          </div>
        </div>
      )}

      {activePanel === 'register' && <div className={mobileMode ? 'relative flex min-h-0 flex-1 flex-col overflow-hidden' : 'grid gap-4 xl:grid-cols-[minmax(0,1fr)_390px]'}>
        <div className={mobileMode ? 'min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-3 pb-24 pt-3' : 'min-w-0 space-y-4'}>
          {mobileMode && posSettings.requireOpenShift && !shift && <div className="flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3">
            <span className="min-w-0 text-xs font-semibold text-amber-900">{shiftLoading ? text.creating : text.shiftClosed} · {text.shiftRequired}</span>
            <button type="button" onClick={() => { setActivePanel('settings'); setActiveSettingsSection('register'); }} className="shrink-0 rounded-lg bg-amber-900 px-3 py-2 text-[10px] font-bold text-white">{text.openShift}</button>
          </div>}
          <form onSubmit={scanOrSearch} className="flex gap-2 rounded-2xl border border-neutral-200 bg-white p-3 shadow-sm">
            <label className="relative min-w-0 flex-1">
              <Barcode className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
              <input
                ref={scanInputRef}
                autoFocus={!mobileMode && posSettings.autoFocusScanner && activePanel === 'register'}
                value={query}
                onChange={event => { setQuery(event.target.value); setCatalogPage(0); }}
                placeholder={text.searchProducts}
                aria-label={text.searchProducts}
                className="h-11 w-full rounded-xl border border-neutral-200 bg-neutral-50 pl-10 pr-3 text-sm outline-none transition focus:border-emerald-500 focus:bg-white"
              />
            </label>
            <button type="submit" className="inline-flex h-11 shrink-0 items-center gap-2 rounded-xl bg-neutral-950 px-4 text-xs font-bold text-white hover:bg-neutral-700">
              <Search className="h-4 w-4" /><span className="hidden sm:inline">{text.search}</span>
            </button>
          </form>

          <div className="flex items-center justify-between text-[11px] text-neutral-500">
            <span>{visibleProducts.length} {text.catalogCount}</span>
            <span>{text.page} {catalogPage + 1}/{pageCount}</span>
          </div>
          <div className={`grid gap-2 ${mobileMode ? 'grid-cols-2' : 'sm:grid-cols-2 2xl:grid-cols-3'}`}>
            {pagedProducts.map(product => {
              const availableSkus = product.skus.filter(sku => Math.max(0, sku.stockCentral - (sku.reserved || 0)) > 0);
              const selectedSku = selectedSkus[product.id] || availableSkus[0]?.sku || product.skus[0]?.sku;
              const sku = availableSkus.find(item => item.sku === selectedSku) || product.skus.find(item => item.sku === selectedSku);
              const hasSellableStock = availableSkus.length > 0;
              const image = product.media?.find(media => media.type === 'image')?.url || product.images[0];
              return (
                <article key={product.id} className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
                  <ProductImage src={image} alt={product.name_zh || product.name} className={`${mobileMode ? 'h-28' : 'h-44 sm:h-48'} w-full`} />
                  <div className={`${mobileMode ? 'space-y-2 p-2.5' : 'space-y-3 p-3.5'}`}>
                    <div className="min-w-0">
                      <p className="truncate text-[10px] font-semibold uppercase tracking-wide text-neutral-500">{product.styleNo} · {product.brand}</p>
                      <h2 className="mt-1 truncate text-sm font-bold text-neutral-950">{isIt ? product.name_it || product.name : product.name_zh || product.name}</h2>
                    </div>
                    <div className="flex items-center justify-between gap-1">
                      <span className={`${mobileMode ? 'text-sm' : 'text-base'} font-bold text-emerald-800`}>{formatCurrency(unitPrice(product))}</span>
                      <span className={`truncate text-[9px] ${hasSellableStock ? 'text-neutral-500' : 'font-semibold text-rose-600'}`}>{hasSellableStock ? `${text.available} ${availableSkus.reduce((sum, item) => sum + Math.max(0, item.stockCentral - (item.reserved || 0)), 0)}` : text.soldOut}</span>
                    </div>
                    <div className="flex gap-2">
                      <select
                        aria-label={`${product.styleNo} SKU`}
                        value={sku?.sku || ''}
                        onChange={event => setSelectedSkus(previous => ({ ...previous, [product.id]: event.target.value }))}
                        className={`${mobileMode ? 'h-8' : 'h-9'} min-w-0 flex-1 rounded-lg border border-neutral-200 bg-white px-1.5 text-[10px] text-neutral-700`}
                      >
                        {product.skus.map(option => {
                          const available = Math.max(0, option.stockCentral - (option.reserved || 0));
                          return <option key={option.sku} value={option.sku} disabled={available === 0}>{option.sku} · {option.color} / {option.size} · {available}件</option>;
                        })}
                      </select>
                      <button type="button" disabled={!sku || !hasSellableStock} onClick={() => addProduct(product, sku?.sku)} aria-label={`${text.add} ${product.styleNo}`} className={`inline-flex ${mobileMode ? 'h-8 w-8 justify-center px-0' : 'h-9 gap-1.5 px-3'} shrink-0 items-center rounded-lg bg-neutral-950 text-[11px] font-bold text-white hover:bg-emerald-800 disabled:opacity-40`}>
                        <Plus className="h-3.5 w-3.5" />{!mobileMode && text.add}
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
            {!pagedProducts.length && (
              <div className="rounded-2xl border border-dashed border-neutral-300 bg-white p-10 text-center text-sm text-neutral-500 sm:col-span-2 2xl:col-span-3">
                {text.noMatch}
              </div>
            )}
          </div>
          {pageCount > 1 && <div className="flex justify-center gap-2">
            <button type="button" disabled={catalogPage === 0} onClick={() => setCatalogPage(page => Math.max(0, page - 1))} className="inline-flex h-9 items-center gap-1 rounded-lg border border-neutral-200 bg-white px-3 text-xs font-semibold disabled:opacity-40"><ChevronLeft className="h-4 w-4" />{text.previous}</button>
            <button type="button" disabled={catalogPage + 1 >= pageCount} onClick={() => setCatalogPage(page => Math.min(pageCount - 1, page + 1))} className="inline-flex h-9 items-center gap-1 rounded-lg border border-neutral-200 bg-white px-3 text-xs font-semibold disabled:opacity-40">{text.next}<ChevronRight className="h-4 w-4" /></button>
          </div>}
        </div>

        <aside id="merchant-pos-mobile-cart" aria-label={text.cart} aria-hidden={mobileMode && !mobileCheckoutOpen} inert={mobileMode && !mobileCheckoutOpen} className={`${mobileMode ? `fixed inset-x-0 bottom-0 z-[70] max-h-[88dvh] space-y-4 overflow-y-auto rounded-t-3xl border border-neutral-200 bg-white p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-[0_-12px_40px_rgba(0,0,0,0.18)] transition-transform duration-200 ${mobileCheckoutOpen ? 'translate-y-0' : 'pointer-events-none translate-y-full'}` : 'h-fit space-y-4 rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm xl:sticky xl:top-4'}`}>
          <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
            <div className="flex items-center gap-2"><ShoppingCart className="h-4 w-4 text-emerald-700" /><h2 className="text-sm font-bold text-neutral-950">{text.cart}</h2></div>
            <span className="rounded-full bg-neutral-100 px-2 py-1 text-[10px] font-semibold text-neutral-600">{totalQuantity} {text.pieces}</span>
            {mobileMode && <button type="button" onClick={() => setMobileCheckoutOpen(false)} aria-label={text.previous} className="ml-2 flex h-8 w-8 items-center justify-center rounded-lg border border-neutral-200"><ChevronRight className="h-4 w-4 rotate-90" /></button>}
          </div>
          {!mobileMode && <div className="grid grid-cols-2 gap-2">
            <button type="button" disabled={!lines.length} onClick={parkCurrentCart} className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-neutral-200 text-[10px] font-semibold disabled:opacity-40"><Clock3 className="h-3.5 w-3.5" />{text.heldCart}</button>
            <button type="button" disabled={!posSettings.customerDisplayEnabled} onClick={openCustomerDisplay} className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-neutral-200 text-[10px] font-semibold disabled:opacity-40"><Monitor className="h-3.5 w-3.5" />{text.openDisplay}</button>
          </div>}

          <div className="relative">
            <UserRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
            <input
              value={selectedCustomer ? selectedCustomer.companyName : customerQuery}
              onChange={event => { setSelectedCustomerId(''); setCustomerQuery(event.target.value); }}
              placeholder={text.customerPlaceholder}
              aria-label={text.selectCustomer}
              className="h-10 w-full rounded-xl border border-neutral-200 bg-neutral-50 pl-9 pr-3 text-xs outline-none focus:border-emerald-500"
            />
            {customerMatches.length > 0 && !selectedCustomer && (
              <div className="absolute left-0 right-0 top-11 z-20 overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-lg">
                {customerMatches.map(customer => (
                  <button key={customer.id} type="button" onClick={() => { setSelectedCustomerId(customer.id); setCustomerQuery(''); }} className="block w-full border-b border-neutral-100 px-3 py-2.5 text-left text-xs hover:bg-emerald-50">
                    <span className="block font-semibold text-neutral-900">{customer.companyName}</span>
                    <span className="mt-0.5 block text-[10px] text-neutral-500">{text.wholesaleDiscount} {Math.round((1 - customer.discountRate) * 100)}%</span>
                  </button>
                ))}
              </div>
            )}
            {selectedCustomer && <button type="button" onClick={() => { setSelectedCustomerId(''); setCustomerQuery(''); }} className="mt-1 text-[10px] font-semibold text-neutral-500 hover:text-neutral-900">{text.removeCustomer}</button>}
          </div>

          <div className="max-h-[42vh] min-h-24 space-y-2 overflow-y-auto">
            {lines.map(line => (
              <div key={`${line.product.id}:${line.sku}`} className="rounded-xl border border-neutral-100 bg-neutral-50 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0"><p className="truncate text-xs font-semibold text-neutral-900">{isIt ? line.product.name_it || line.product.name : line.product.name_zh || line.product.name}</p><p className="mt-0.5 text-[10px] text-neutral-500">{line.product.styleNo} · {line.sku}</p></div>
                  <button type="button" aria-label={`${text.removeItem} ${line.sku}`} onClick={() => setLines(previous => previous.filter(item => item !== line))} className="rounded p-1 text-neutral-400 hover:bg-rose-50 hover:text-rose-600"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-xs font-semibold text-neutral-700">{formatCurrency(unitPrice(line.product) * line.quantity)}</span>
                  <div className="flex items-center gap-2">
                    <button type="button" aria-label={text.decreaseQuantity} onClick={() => updateQuantity(line, line.quantity - 1)} className="flex h-7 w-7 items-center justify-center rounded-lg border border-neutral-200 bg-white"><Minus className="h-3 w-3" /></button>
                    <span className="w-5 text-center text-xs font-bold">{line.quantity}</span>
                    <button type="button" aria-label={text.increaseQuantity} onClick={() => updateQuantity(line, line.quantity + 1)} className="flex h-7 w-7 items-center justify-center rounded-lg border border-neutral-200 bg-white"><Plus className="h-3 w-3" /></button>
                  </div>
                </div>
              </div>
            ))}
            {!lines.length && <div className="flex min-h-24 items-center justify-center rounded-xl border border-dashed border-neutral-200 text-xs text-neutral-400">{text.startSale}</div>}
          </div>

          <label className="block text-[10px] font-semibold text-neutral-600">{text.paymentMethod}
            <select value={paymentMethod} onChange={event => { setPaymentMethod(event.target.value as PaymentMethod); setPaymentConfirmed(false); }} className="mt-1.5 h-10 w-full rounded-xl border border-neutral-200 bg-white px-3 text-xs text-neutral-900">
              <option value="cash">{text.cash}</option>
              <option value="alipay">{text.alipay}</option>
              <option value="wechat_pay">{text.wechatPay}</option>
              <option value="credit_card">{text.card}</option>
              <option value="bank_transfer">{text.bankTransfer}</option>
              <option value="net_30" disabled={!selectedCustomer}>{text.net30}{!selectedCustomer ? text.customerRequired : ''}</option>
            </select>
          </label>

          {directPayment ? (
            <label className="flex cursor-pointer gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-[10px] leading-4 text-amber-900">
              <input type="checkbox" checked={paymentConfirmed} onChange={event => setPaymentConfirmed(event.target.checked)} className="mt-0.5 accent-emerald-700" />
              <span>{text.confirmCash}. {text.noGateway}</span>
            </label>
          ) : (
            <p className="rounded-xl bg-neutral-50 p-3 text-[10px] leading-4 text-neutral-500">
              {paymentMethod === 'net_30' ? text.creditDue : text.transferDue}
            </p>
          )}

          {paymentMethod === 'net_30' && selectedCustomer && (
            <p className="text-[10px] text-neutral-500">{text.availableCredit}: {formatCurrency(Math.max(0, selectedCustomer.creditLimit - selectedCustomer.usedCredit))}</p>
          )}

          <div className="flex items-end justify-between border-t border-neutral-100 pt-3">
            <span className="text-xs font-semibold text-neutral-500">{text.totalDue}</span>
            <span className="text-2xl font-black tracking-tight text-neutral-950">{formatCurrency(totalAmount)}</span>
          </div>
          <button type="button" disabled={!lines.length || submitting || (directPayment && !paymentConfirmed) || (posSettings.requireOpenShift && !shift)} onClick={() => void submitSale()} className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-neutral-300">
            {paymentMethod === 'credit_card' ? <CreditCard className="h-4 w-4" /> : paymentMethod === 'cash' ? <Wallet className="h-4 w-4" /> : <ShoppingCart className="h-4 w-4" />}
            {submitting ? text.creating : text.completeSale}
          </button>
        </aside>
        {mobileMode && mobileCheckoutOpen && <button type="button" aria-label={text.previous} onClick={() => setMobileCheckoutOpen(false)} className="fixed inset-0 z-[60] bg-neutral-950/35" />}
        {mobileMode && !mobileCheckoutOpen && <button type="button" aria-controls="merchant-pos-mobile-cart" aria-expanded={mobileCheckoutOpen} onClick={() => setMobileCheckoutOpen(true)} className="fixed inset-x-3 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-50 flex h-14 items-center justify-between rounded-2xl bg-neutral-950 px-4 text-white shadow-xl">
          <span className="flex items-center gap-2 text-sm font-bold"><ShoppingCart className="h-5 w-5" />{text.cart}<span className="rounded-full bg-white/15 px-2 py-0.5 text-xs">{totalQuantity}</span></span>
          <span className="flex items-center gap-2 text-sm font-black">{formatCurrency(totalAmount)}<span className="text-xs font-semibold">{text.completeSale} ›</span></span>
        </button>}
      </div>}

      {activePanel === 'report' && <div className={mobileMode ? 'min-h-0 flex-1 space-y-3 overflow-y-auto p-3' : 'grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(300px,0.8fr)]'}>
        <section className="space-y-4 rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm sm:p-6">
          <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
            <div><h2 className="text-base font-bold text-neutral-950">{text.dailyReport}</h2><p className="mt-1 text-xs text-neutral-500">{new Intl.DateTimeFormat(getIntlLocale(lang), { dateStyle: 'full' }).format(new Date())}</p></div>
            <TrendingUp className="h-5 w-5 text-emerald-700" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              [text.orders, todayOrders.length.toString()],
              [text.netSales, formatCurrency(todayGross - todayRefunds)],
              [text.collected, formatCurrency(todayCollected)],
              [text.outstanding, formatCurrency(todayOutstanding)],
              [text.refundAmount, formatCurrency(todayRefunds)],
              [text.units, `${todayUnits} ${text.pieces}`]
            ].map(([label, value]) => <div key={label} className="rounded-xl bg-neutral-50 p-4"><p className="text-[10px] font-semibold text-neutral-500">{label}</p><p className="mt-2 text-lg font-black text-neutral-950">{value}</p></div>)}
          </div>
          <div>
            <h3 className="mb-2 text-xs font-bold text-neutral-800">{localizeCopy('今日热销商品', 'Articoli più venduti oggi')}</h3>
            {dailyTopProducts.length ? <ol className="divide-y divide-neutral-100 rounded-xl border border-neutral-100">
              {dailyTopProducts.map(([name, quantity], index) => <li key={name} className="flex items-center justify-between gap-3 px-3 py-2.5 text-xs"><span className="truncate"><b className="mr-2 text-emerald-700">{index + 1}.</b>{name}</span><span className="shrink-0 font-bold">{quantity} {text.pieces}</span></li>)}
            </ol> : <p className="rounded-xl border border-dashed border-neutral-200 p-6 text-center text-xs text-neutral-500">{localizeCopy('今日还没有 POS 销售记录。', 'Nessuna vendita POS oggi.')}</p>}
          </div>
        </section>
        <section className="space-y-3 rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50 to-white p-4 shadow-sm sm:p-6">
          <div className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-emerald-700" /><h2 className="text-sm font-bold text-neutral-950">{text.aiAdvice}</h2></div>
          <button type="button" disabled={aiBusy} onClick={() => void askAiForAdvice()} className="inline-flex h-9 items-center gap-2 rounded-lg bg-emerald-800 px-3 text-xs font-semibold text-white hover:bg-emerald-900 disabled:opacity-50"><Sparkles className="h-3.5 w-3.5" />{aiBusy ? text.aiWorking : text.askAi}</button>
          {aiReply && <p role="status" className="whitespace-pre-line rounded-xl border border-emerald-100 bg-white p-3 text-xs leading-5 text-neutral-700">{aiReply}</p>}
          {operationsIntelligence ? <>
            {typeof operationsIntelligence.summary.gmvTrend === 'number' && <p className="rounded-xl bg-white/80 p-3 text-xs text-neutral-700">{localizeCopy('近 7 日销售额趋势', 'Vendite ultimi 7 giorni')}：<b className={operationsIntelligence.summary.gmvTrend < 0 ? 'text-rose-700' : 'text-emerald-700'}>{operationsIntelligence.summary.gmvTrend > 0 ? '+' : ''}{operationsIntelligence.summary.gmvTrend}%</b></p>}
            {operationsIntelligence.replenishment.slice(0, 5).map(item => <div key={item.variantId} className="rounded-xl border border-amber-100 bg-white/90 p-3 text-xs"><p className="font-bold text-neutral-900">{text.replenishment} · {item.styleNo} / {item.sku}</p><p className="mt-1 text-neutral-600">{localizeCopy('可售库存', 'Disponibili')} {item.availableQuantity} · {localizeCopy('近30日销量', 'Venduti 30g')} {item.sold30d} · {localizeCopy('建议补货', 'Suggeriti')} <b>{item.suggestedQuantity}</b></p></div>)}
            {(operationsIntelligence.slowMovers || []).slice(0, 3).map(item => <div key={`slow-${item.variantId}`} className="rounded-xl border border-neutral-100 bg-white/90 p-3 text-xs"><p className="font-bold text-neutral-900">{text.slowMovers} · {item.styleNo} / {item.sku}</p><p className="mt-1 text-neutral-600">{localizeCopy('近30日销量', 'Venduti 30g')} {item.sold30d} · {localizeCopy('可售库存', 'Disponibili')} {item.availableQuantity}</p></div>)}
            {!operationsIntelligence.replenishment.length && !(operationsIntelligence.slowMovers || []).length && <p className="rounded-xl bg-white/80 p-3 text-xs text-neutral-600">{text.noAdvice}</p>}
            <p className="flex flex-wrap gap-2 text-[10px] leading-4 text-neutral-500"><span>{localizeCopy('按近30日数据', 'Dati ultimi 30g')}</span><span>{localizeCopy('采购前复核', 'Verifica prima')}</span></p>
          </> : <p className="text-xs text-neutral-500">{localizeCopy('经营数据暂不可用，请刷新后重试。', 'Dati operativi non disponibili.')}</p>}
        </section>
      </div>}

      {activePanel === 'returns' && <section className={mobileMode ? 'min-h-0 flex-1 space-y-3 overflow-y-auto p-3' : 'grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.7fr)]'}>
        <div className="space-y-4 rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm sm:p-6">
          <div><h2 className="text-base font-bold text-neutral-950">{text.returns}</h2><div className="mt-1 flex flex-wrap gap-2 text-xs text-neutral-500"><span>{localizeCopy('仅限已付款', 'Solo pagati')}</span><span>{localizeCopy('核对实物', 'Verifica articoli')}</span><span>{localizeCopy('确认即线下退款', 'Conferma rimborso')}</span><span>{localizeCopy('库存订单退款同步', 'Inventario, ordine e rimborso sincronizzati')}</span></div><p className="mt-2 rounded-lg bg-sky-50 p-2.5 text-[10px] leading-4 text-sky-900">{text.exchangeFlow}</p></div>
          <input value={returnOrderQuery} onChange={event => setReturnOrderQuery(event.target.value)} placeholder={text.returnSearch} className="h-10 w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 text-xs outline-none focus:border-emerald-500" />
          <div className="max-h-52 space-y-2 overflow-y-auto">
            {matchingReturnOrders.map(order => <button key={order.id} type="button" disabled={isReturnWindowExpired(order)} onClick={() => { setSelectedReturnOrderId(order.id); setReturnQuantities({}); setReturnConfirmed(false); }} className={`flex w-full items-center justify-between gap-3 rounded-xl border p-3 text-left disabled:cursor-not-allowed disabled:opacity-50 ${selectedReturnOrderId === order.id ? 'border-emerald-300 bg-emerald-50' : 'border-neutral-200 hover:bg-neutral-50'}`}>
              <span><b className="block text-xs">{order.orderNo}{isReturnWindowExpired(order) ? ` · ${text.returnWindowExpired}` : ''}</b><small className="mt-1 block text-neutral-500">{order.companyName} · {order.createdAt ? new Date(order.createdAt).toLocaleString(getIntlLocale(lang)) : order.date}</small></span>
              <span className="text-xs font-bold">{formatCurrency(order.totalAmount)}</span>
            </button>)}
            {!matchingReturnOrders.length && <p className="rounded-xl border border-dashed border-neutral-200 p-5 text-center text-xs text-neutral-500">{text.noReturnOrders}</p>}
          </div>
        </div>
        <div className="space-y-4 rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm sm:p-6">
          {selectedReturnOrder ? <>
            <h3 className="text-sm font-bold">{selectedReturnOrder.orderNo}</h3>
            {isReturnWindowExpired(selectedReturnOrder) && <p className="rounded-lg bg-rose-50 p-3 text-xs text-rose-800">{text.returnWindowExpired}</p>}
            <div className="max-h-64 space-y-2 overflow-y-auto">
              {selectedReturnOrder.items.map(item => {
                const key = `${item.productId}:${item.sku}`;
                return <label key={key} className="flex items-center justify-between gap-3 rounded-xl border border-neutral-100 bg-neutral-50 p-3">
                  <span className="min-w-0"><b className="block truncate text-xs">{item.styleNo || item.productName} · {item.sku}</b><small className="text-neutral-500">{formatCurrency(item.unitPrice)} · {localizeCopy('购买', 'Acquistati')} {item.quantity}</small></span>
                  <span className="shrink-0 text-[10px] text-neutral-600">{text.returnQuantity}<input type="number" min="0" max={item.quantity} value={returnQuantities[key] || 0} onChange={event => setReturnQuantities(previous => ({ ...previous, [key]: Math.min(item.quantity, Math.max(0, Number(event.target.value) || 0)) }))} className="ml-2 h-9 w-16 rounded-lg border border-neutral-200 bg-white px-2 text-center text-xs" /></span>
                </label>;
              })}
            </div>
            <label className="block text-[10px] font-semibold text-neutral-600">{text.returnReason}<textarea value={returnReason} onChange={event => setReturnReason(event.target.value)} maxLength={500} rows={2} className="mt-1.5 w-full rounded-xl border border-neutral-200 bg-white p-3 text-xs font-normal outline-none focus:border-emerald-500" /></label>
            <label className="flex gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-[10px] leading-4 text-amber-900"><input type="checkbox" checked={returnConfirmed} onChange={event => setReturnConfirmed(event.target.checked)} className="mt-0.5 accent-emerald-700" /><span>{text.returnConfirm} {isIt && text.noGateway}</span></label>
            <button type="button" disabled={returnSubmitting || !returnConfirmed} onClick={() => void submitReturn()} className="h-11 w-full rounded-xl bg-rose-700 text-xs font-bold text-white hover:bg-rose-800 disabled:cursor-not-allowed disabled:bg-neutral-300">{returnSubmitting ? text.creating : text.processReturn}</button>
          </> : <div className="flex min-h-56 items-center justify-center rounded-xl border border-dashed border-neutral-200 p-6 text-center text-xs text-neutral-500">{text.selectReturnOrder}</div>}
        </div>
      </section>}

      {((activePanel === 'register' && !mobileMode) || (mobileMode && activePanel === 'settings' && activeSettingsSection === 'register')) && <section className="space-y-3 rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2"><Clock3 className="h-4 w-4 text-emerald-700" /><div><h2 className="text-sm font-bold">{text.cashShift}</h2><p className="mt-0.5 text-[10px] text-neutral-500">{shift ? `${text.shiftOpen} · ${shift.employee?.name || merchantName}` : shiftLoading ? text.creating : text.shiftClosed}</p></div></div>
          {shift && <div className="grid grid-cols-2 gap-x-5 gap-y-1 text-right text-[10px] sm:grid-cols-4">
            <span>{text.openingCash}: <b>{formatCurrency(shift.openingCash)}</b></span>
            <span>{text.cashSales}: <b>{formatCurrency(shift.cashSales)}</b></span>
            <span>{text.cashRefunds}: <b>{formatCurrency(shift.cashRefunds)}</b></span>
            <span>{text.expectedCash}: <b>{formatCurrency(shift.expectedCash)}</b></span>
          </div>}
        </div>
        {shift ? <div className="grid gap-2 lg:grid-cols-[1fr_1fr_auto]">
          <div className="flex gap-2">
            <input type="number" min="0.01" step="0.01" value={movementAmount} onChange={event => setMovementAmount(event.target.value)} placeholder={text.movementAmount} aria-label={text.movementAmount} className="h-10 min-w-0 w-28 rounded-lg border border-neutral-200 px-2 text-xs" />
            <input value={movementReason} onChange={event => setMovementReason(event.target.value)} placeholder={text.movementReason} aria-label={text.movementReason} maxLength={300} className="h-10 min-w-0 flex-1 rounded-lg border border-neutral-200 px-3 text-xs" />
            <button type="button" disabled={shiftBusy || !movementReason.trim() || Number(movementAmount) <= 0} onClick={() => void recordCashMovement('in')} className="rounded-lg border border-emerald-200 px-3 text-[10px] font-bold text-emerald-800 disabled:opacity-40">{text.addCashIn}</button>
            <button type="button" disabled={shiftBusy || !movementReason.trim() || Number(movementAmount) <= 0} onClick={() => void recordCashMovement('out')} className="rounded-lg border border-amber-200 px-3 text-[10px] font-bold text-amber-800 disabled:opacity-40">{text.addCashOut}</button>
          </div>
          <div className="flex gap-2">
            <input type="number" min="0" step="0.01" value={closingCash} onChange={event => setClosingCash(event.target.value)} placeholder={text.closingCash} aria-label={text.closingCash} className="h-10 min-w-0 flex-1 rounded-lg border border-neutral-200 px-3 text-xs" />
            <input value={shiftNote} onChange={event => setShiftNote(event.target.value)} placeholder={text.shiftNote} aria-label={text.shiftNote} maxLength={500} className="h-10 min-w-0 flex-1 rounded-lg border border-neutral-200 px-3 text-xs" />
          </div>
          <button type="button" disabled={shiftBusy || closingCash === ''} onClick={() => void closeCashShift()} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-neutral-900 px-4 text-xs font-bold text-white disabled:opacity-40"><Clock3 className="h-4 w-4" />{text.closeShift}</button>
        </div> : <div className="flex flex-wrap items-end gap-2">
          <label className="text-[10px] font-semibold text-neutral-600">{text.openingCash}<input type="number" min="0" step="0.01" value={openingCash} onChange={event => setOpeningCash(event.target.value)} className="mt-1 block h-10 w-40 rounded-lg border border-neutral-200 px-3 text-xs" /></label>
          <label className="min-w-40 flex-1 text-[10px] font-semibold text-neutral-600">{text.shiftNote}<input value={shiftNote} onChange={event => setShiftNote(event.target.value)} maxLength={300} className="mt-1 block h-10 w-full rounded-lg border border-neutral-200 px-3 text-xs" /></label>
          <button type="button" disabled={shiftBusy || shiftLoading} onClick={() => void openCashShift()} className="inline-flex h-10 items-center gap-2 rounded-lg bg-emerald-800 px-4 text-xs font-bold text-white disabled:opacity-40"><Clock3 className="h-4 w-4" />{text.openShift}</button>
        </div>}
      </section>}

      {activePanel === 'settings' && <section className={mobileMode ? 'min-h-0 flex-1 space-y-4 overflow-y-auto p-3' : 'mx-auto w-full max-w-5xl space-y-4'}>
        <div className="flex items-center justify-between rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-neutral-100 text-neutral-700"><Settings className="h-5 w-5" /></span>
            <div><h2 className="text-base font-bold text-neutral-950">{activeSettingsSection === 'overview' ? text.settingsOverview : text[activeSettingsSection === 'staff' ? 'staff' : activeSettingsSection === 'location' ? 'locations' : activeSettingsSection === 'language' ? 'language' : activeSettingsSection === 'display' ? 'customerDisplay' : activeSettingsSection === 'register' ? 'cashManagement' : activeSettingsSection === 'receipt' ? 'receiptSettings' : activeSettingsSection === 'carts' ? 'recentCarts' : activeSettingsSection === 'returns' ? 'returnPolicy' : 'activityLog']}</h2><p className="mt-1 text-xs text-neutral-500">{merchantName}</p></div>
          </div>
          {activeSettingsSection !== 'overview' && <button type="button" onClick={() => setActiveSettingsSection('overview')} className="rounded-lg border border-neutral-200 px-3 py-2 text-xs font-semibold hover:bg-neutral-50">{text.previous}</button>}
        </div>

        {activeSettingsSection === 'overview' && mobileMode && <div className="grid grid-cols-2 gap-3">
          <button type="button" onClick={() => setActivePanel('report')} className="flex min-h-20 items-center gap-3 rounded-2xl border border-neutral-200 bg-white p-3 text-left shadow-sm">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-800"><TrendingUp className="h-5 w-5" /></span><b className="text-xs">{text.dailyReport}</b>
          </button>
          <button type="button" onClick={() => setActivePanel('returns')} className="flex min-h-20 items-center gap-3 rounded-2xl border border-neutral-200 bg-white p-3 text-left shadow-sm">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-rose-800"><RotateCcw className="h-5 w-5" /></span><b className="text-xs">{text.returns}</b>
          </button>
        </div>}
        {activeSettingsSection === 'overview' && <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {([
            ['staff', text.staff, Users],
            ['location', text.locations, MapPin],
            ['language', text.language, Languages],
            ['register', text.cashManagement, Banknote],
            ['display', text.customerDisplay, Monitor],
            ['receipt', text.receiptSettings, Printer],
            ['carts', text.recentCarts, ShoppingCart],
            ['returns', text.returnPolicy, RotateCcw],
            ['activity', text.activityLog, History]
          ] as const).map(([section, label, Icon]) => <button key={section} type="button" onClick={() => { setActiveSettingsSection(section); if (section === 'activity') void loadPosActivities(); }} className="flex min-h-24 items-center gap-3 rounded-2xl border border-neutral-200 bg-white p-4 text-left shadow-sm transition hover:border-emerald-300 hover:bg-emerald-50/40">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-neutral-100 text-neutral-700"><Icon className="h-5 w-5" /></span><span><b className="block text-sm">{label}</b><small className="mt-1 block text-[10px] text-neutral-500">{section === 'location' ? merchantLocation.city : section === 'register' ? shift ? text.shiftOpen : text.shiftClosed : section === 'carts' ? `${heldCarts.length} · ${text.localCartNotice}` : text.settings}</small></span>
          </button>)}
        </div>}

        {activeSettingsSection === 'staff' && <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm sm:p-7">
          <div className="flex items-center gap-3"><Users className="h-5 w-5 text-emerald-700" /><div><h3 className="text-sm font-bold">{text.roleEmployees}</h3><p className="mt-1 text-xs text-neutral-500">{text.staff}</p></div></div>
          <button type="button" onClick={() => onOpenMerchantSettings('staff')} className="mt-5 inline-flex h-10 items-center gap-2 rounded-lg bg-neutral-950 px-4 text-xs font-bold text-white"><Users className="h-4 w-4" />{text.edit} {text.staff}</button>
        </section>}

        {activeSettingsSection === 'location' && <section className="space-y-4 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm sm:p-7">
          <h3 className="text-sm font-bold">{text.locationPolicy}</h3>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl bg-neutral-50 p-3"><small className="text-[10px] text-neutral-500">{text.store}</small><p className="mt-1 text-xs font-semibold">{merchantName}</p></div>
            <div className="rounded-xl bg-neutral-50 p-3"><small className="text-[10px] text-neutral-500">{text.storeCity}</small><p className="mt-1 text-xs font-semibold">{merchantLocation.city || '—'}</p></div>
            <div className="rounded-xl bg-neutral-50 p-3"><small className="text-[10px] text-neutral-500">{text.storeCountry}</small><p className="mt-1 text-xs font-semibold">{merchantLocation.country || '—'}</p></div>
          </div>
          <p className="rounded-xl bg-sky-50 p-3 text-xs leading-5 text-sky-900">{merchantLocation.address || '—'}<br />{text.noLocationsNotice}</p>
          <button type="button" onClick={() => onOpenMerchantSettings('location')} className="inline-flex h-10 items-center gap-2 rounded-lg bg-neutral-950 px-4 text-xs font-bold text-white"><MapPin className="h-4 w-4" />{text.edit} {text.storeProfile}</button>
        </section>}

        {activeSettingsSection === 'language' && <section className="max-w-xl space-y-3 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm sm:p-7">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-semibold text-neutral-700">{text.languagePreference}</span>
            <LanguagePicker placement="top" disabled={settingsLoading || settingsSaving} />
          </div>
          <p className="text-xs text-neutral-500">{text.languageHint}</p>
        </section>}

        {activeSettingsSection === 'display' && <section className="max-w-2xl space-y-4 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm sm:p-7">
          <label className="flex items-center justify-between gap-3 rounded-xl border border-neutral-100 p-3 text-xs"><span>{text.displayEnabled}</span><input type="checkbox" disabled={settingsLoading || settingsSaving} checked={posSettings.customerDisplayEnabled} onChange={event => void savePosSettings({ ...posSettings, customerDisplayEnabled: event.target.checked })} className="h-4 w-4 accent-emerald-700" /></label>
          <label className="block text-xs font-semibold text-neutral-700">{text.displayMessage}<textarea value={posSettings.customerDisplayMessage} maxLength={160} rows={3} onChange={event => setPosSettings(previous => ({ ...previous, customerDisplayMessage: event.target.value }))} className="mt-2 w-full rounded-xl border border-neutral-200 p-3 text-xs font-normal" /></label>
          <button type="button" disabled={settingsSaving || settingsLoading} onClick={() => void savePosSettings(posSettings)} className="inline-flex h-10 items-center gap-2 rounded-lg bg-neutral-950 px-4 text-xs font-bold text-white"><Save className="h-4 w-4" />{text.saveSettings}</button>
          <button type="button" disabled={!posSettings.customerDisplayEnabled} onClick={openCustomerDisplay} className="inline-flex h-10 items-center gap-2 rounded-lg border border-neutral-200 px-4 text-xs font-semibold disabled:opacity-40"><Monitor className="h-4 w-4" />{text.openDisplay}</button>
          <p className="text-[10px] text-neutral-500">{text.popupBlocked}</p>
        </section>}

        {activeSettingsSection === 'register' && <section className="space-y-4 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm sm:p-7">
          <h3 className="text-sm font-bold">{text.cashShift}</h3>
          <label className="flex items-center justify-between gap-3 rounded-xl border border-neutral-100 p-3 text-xs"><span>{text.shiftRequired}</span><input type="checkbox" disabled={settingsLoading || settingsSaving} checked={posSettings.requireOpenShift} onChange={event => void savePosSettings({ ...posSettings, requireOpenShift: event.target.checked })} className="h-4 w-4 accent-emerald-700" /></label>
          <div className="grid gap-3 sm:grid-cols-4 text-xs">{shift ? <>
            <div className="rounded-xl bg-neutral-50 p-3">{text.openingCash}<b className="mt-1 block">{formatCurrency(shift.openingCash)}</b></div><div className="rounded-xl bg-neutral-50 p-3">{text.cashSales}<b className="mt-1 block">{formatCurrency(shift.cashSales)}</b></div><div className="rounded-xl bg-neutral-50 p-3">{text.cashRefunds}<b className="mt-1 block">{formatCurrency(shift.cashRefunds)}</b></div><div className="rounded-xl bg-emerald-50 p-3">{text.expectedCash}<b className="mt-1 block">{formatCurrency(shift.expectedCash)}</b></div>
          </> : <p className="text-neutral-500">{shiftLoading ? text.creating : text.shiftClosed}</p>}</div>
        </section>}

        {activeSettingsSection === 'receipt' && <section className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-4 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm sm:p-7">
            <h3 className="text-sm font-bold">{text.receiptSettings}</h3>
            <label className="block text-xs font-semibold">{text.paperWidth}<select disabled={settingsLoading || settingsSaving} value={posSettings.paperWidth} onChange={event => void savePosSettings({ ...posSettings, paperWidth: Number(event.target.value) === 58 ? 58 : 80 })} className="mt-1.5 h-10 w-full rounded-lg border border-neutral-200 bg-white px-3 text-xs"><option value={58}>{text.paper58}</option><option value={80}>{text.paper80}</option></select></label>
            <label className="flex items-center justify-between gap-3 rounded-xl border border-neutral-100 p-3 text-xs"><span>{text.autoPrint}</span><input type="checkbox" disabled={settingsLoading || settingsSaving} checked={posSettings.autoPrint} onChange={event => void savePosSettings({ ...posSettings, autoPrint: event.target.checked })} className="h-4 w-4 accent-emerald-700" /></label>
            <label className="flex items-center justify-between gap-3 rounded-xl border border-neutral-100 p-3 text-xs"><span>{text.autoFocus}</span><input type="checkbox" disabled={settingsLoading || settingsSaving} checked={posSettings.autoFocusScanner} onChange={event => void savePosSettings({ ...posSettings, autoFocusScanner: event.target.checked })} className="h-4 w-4 accent-emerald-700" /></label>
            <label className="block text-xs font-semibold">{text.receiptFooter}<textarea value={posSettings.receiptFooter} maxLength={200} rows={3} onChange={event => setPosSettings(previous => ({ ...previous, receiptFooter: event.target.value }))} className="mt-1.5 w-full rounded-lg border border-neutral-200 bg-white p-3 text-xs font-normal" /></label>
            <button type="button" disabled={settingsSaving || settingsLoading} onClick={() => void savePosSettings(posSettings)} className="inline-flex h-10 items-center gap-2 rounded-lg bg-neutral-950 px-4 text-xs font-bold text-white"><Save className="h-4 w-4" />{text.saveSettings}</button>
          </div>
          <div className="h-fit space-y-3 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm sm:p-7"><p className="text-xs leading-5 text-neutral-600">{text.scannerHelp}</p><p className="rounded-xl border border-amber-100 bg-amber-50 p-3 text-[10px] leading-4 text-amber-900">{text.notTaxReceipt}</p></div>
        </section>}

        {activeSettingsSection === 'carts' && <section className="space-y-4 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm sm:p-7">
          <button type="button" disabled={!lines.length} onClick={parkCurrentCart} className="inline-flex h-10 items-center gap-2 rounded-lg bg-neutral-950 px-4 text-xs font-bold text-white disabled:opacity-40"><Clock3 className="h-4 w-4" />{text.heldCart}</button>
          <label className="block max-w-md text-xs font-semibold">{text.retention}<select disabled={settingsLoading || settingsSaving} value={posSettings.cartRetentionHours} onChange={event => void savePosSettings({ ...posSettings, cartRetentionHours: Number(event.target.value) })} className="mt-2 h-10 w-full rounded-lg border border-neutral-200 bg-white px-3 text-xs"><option value={1}>1 {text.hours}</option><option value={24}>24 {text.hours}</option><option value={72}>72 {text.hours}</option><option value={168}>168 {text.hours}</option><option value={0}>{localizeCopy('不自动过期', 'Senza scadenza')}</option></select></label>
          <p className="rounded-xl bg-sky-50 p-3 text-xs text-sky-900">{text.localCartNotice}</p>
          {heldCarts.length ? <ul className="divide-y divide-neutral-100 rounded-xl border border-neutral-100">{heldCarts.map(cart => <li key={cart.id} className="flex flex-wrap items-center justify-between gap-3 p-3 text-xs">
            <span><b>{cart.items.length} {text.units}</b><small className="ml-2 text-neutral-500">{new Date(cart.createdAt).toLocaleString(getIntlLocale(lang))}</small></span>
            <span className="flex gap-2"><button type="button" onClick={() => restoreHeldCart(cart)} className="rounded-lg bg-emerald-800 px-3 py-2 font-bold text-white">{text.restoreCart}</button><button type="button" onClick={() => persistHeldCarts(heldCarts.filter(item => item.id !== cart.id))} className="rounded-lg border border-neutral-200 px-3 py-2">{text.deleteCart}</button></span>
          </li>)}</ul> : <p className="rounded-xl border border-dashed border-neutral-200 p-5 text-center text-xs text-neutral-500">{text.noHeldCarts}</p>}
        </section>}

        {activeSettingsSection === 'returns' && <section className="max-w-xl space-y-3 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm sm:p-7">
          <label className="block text-xs font-semibold">{text.returnWindow}<select disabled={settingsLoading || settingsSaving} value={posSettings.returnWindowDays} onChange={event => void savePosSettings({ ...posSettings, returnWindowDays: Number(event.target.value) })} className="mt-2 h-10 w-full rounded-lg border border-neutral-200 bg-white px-3 text-xs">{[7, 14, 30, 60, 90].map(days => <option key={days} value={days}>{days} {text.days}</option>)}</select></label>
          <p className="text-xs text-neutral-500">{text.returnPolicyHelp}</p>
        </section>}

        {activeSettingsSection === 'activity' && <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm sm:p-7">
          <div className="mb-4 flex items-center justify-between"><h3 className="text-sm font-bold">{text.employeeActivity}</h3><button type="button" onClick={() => void loadPosActivities()} className="text-xs font-semibold text-emerald-800">{text.next}</button></div>
          {posActivities.length ? <ul className="divide-y divide-neutral-100">{posActivities.map(activity => <li key={activity.id} className="py-3 text-xs"><div className="flex flex-wrap justify-between gap-2"><b>{activity.action}</b><time className="text-neutral-500">{new Date(activity.createdAt).toLocaleString(getIntlLocale(lang))}</time></div><p className="mt-1 text-neutral-500">{activity.employee?.name || merchantName}{activity.entityId ? ` · ${activity.entityId}` : ''}</p>{activity.metadata && <p className="mt-1 break-all text-[10px] text-neutral-400">{activity.metadata}</p>}</li>)}</ul> : <p className="rounded-xl border border-dashed border-neutral-200 p-6 text-center text-xs text-neutral-500">{text.activityEmpty}</p>}
        </section>}
      </section>}

      {lastOrder && <div id="merchant-pos-receipt" className="hidden" aria-hidden="true">
        <div style={{ textAlign: 'center', fontWeight: 700, fontSize: 16 }}>{merchantName}</div>
        <div style={{ textAlign: 'center', marginBottom: 12 }}>RUDA POS</div>
        <div>{lastOrder.orderNo}</div>
        <div>{new Date(lastOrder.createdAt).toLocaleString(getIntlLocale(lang))}</div>
        <div>{lastOrder.customerName}</div>
        <hr style={{ margin: '10px 0', borderTop: '1px dashed #777' }} />
        {lastOrder.items.map((item, index) => <div key={`${item.sku}-${index}`} style={{ marginBottom: 8 }}>
          <div>{item.name} · {item.sku}</div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>{item.quantity} × {formatCurrency(item.unitPrice)}</span><b>{formatCurrency(item.quantity * item.unitPrice)}</b></div>
        </div>)}
        <hr style={{ margin: '10px 0', borderTop: '1px dashed #777' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}><span>{text.totalDue}</span><span>{formatCurrency(lastOrder.totalAmount)}</span></div>
        <div style={{ marginTop: 6 }}>{text.paymentMethod}: {text[lastOrder.paymentMethod === 'credit_card' ? 'card' : lastOrder.paymentMethod === 'alipay' ? 'alipay' : lastOrder.paymentMethod === 'wechat_pay' ? 'wechatPay' : lastOrder.paymentMethod === 'bank_transfer' ? 'bankTransfer' : lastOrder.paymentMethod === 'net_30' ? 'net30' : 'cash']}</div>
        <div style={{ textAlign: 'center', marginTop: 18 }}>{posSettings.receiptFooter || (localizeCopy("感谢惠顾", "Grazie per il tuo acquisto"))}</div>
        <div style={{ textAlign: 'center', marginTop: 8, fontSize: 9, color: '#555' }}>{localizeCopy('内部销售凭条，非税务发票', 'Ricevuta interna non fiscale')}</div>
      </div>}
    </section>
  );
};
