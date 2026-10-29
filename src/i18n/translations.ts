/**
 * RUDA Italian Fashion B2B Platform - Internationalization System
 * Pure Italian (it) and Pure Chinese (zh) without bilingual mixing or raw engineering jargon.
 */

export const LANGUAGE_OPTIONS = [
  { code: 'en', nativeName: 'English', deepSeekName: 'English' },
  { code: 'it', nativeName: 'Italiano', deepSeekName: 'Italian' },
  { code: 'zh', nativeName: '简体中文', deepSeekName: 'Simplified Chinese' },
  { code: 'fr', nativeName: 'Français', deepSeekName: 'French' },
  { code: 'de', nativeName: 'Deutsch', deepSeekName: 'German' },
  { code: 'es', nativeName: 'Español', deepSeekName: 'Spanish' },
  { code: 'pt', nativeName: 'Português', deepSeekName: 'Portuguese' },
  { code: 'nl', nativeName: 'Nederlands', deepSeekName: 'Dutch' },
  { code: 'pl', nativeName: 'Polski', deepSeekName: 'Polish' },
  { code: 'ro', nativeName: 'Română', deepSeekName: 'Romanian' },
  { code: 'tr', nativeName: 'Türkçe', deepSeekName: 'Turkish' },
  { code: 'ar', nativeName: 'العربية', deepSeekName: 'Arabic' }
] as const;

export type Language = typeof LANGUAGE_OPTIONS[number]['code'];
export type TranslationKey = keyof typeof TRANSLATIONS.it;
export type UiCopyInput = {
  id: string;
  zh: string;
  it: string;
};

const OPEN_GRAPH_LOCALES: Record<Language, string> = {
  en: 'en_GB',
  it: 'it_IT',
  zh: 'zh_CN',
  fr: 'fr_FR',
  de: 'de_DE',
  es: 'es_ES',
  pt: 'pt_PT',
  nl: 'nl_NL',
  pl: 'pl_PL',
  ro: 'ro_RO',
  tr: 'tr_TR',
  ar: 'ar_SA'
};

const INTL_LOCALES: Record<Language, string> = {
  en: 'en-GB',
  it: 'it-IT',
  zh: 'zh-CN',
  fr: 'fr-FR',
  de: 'de-DE',
  es: 'es-ES',
  pt: 'pt-PT',
  nl: 'nl-NL',
  pl: 'pl-PL',
  ro: 'ro-RO',
  tr: 'tr-TR',
  ar: 'ar-SA'
};

export const LANGUAGE_PREFERENCE_KEY = 'ruda_b2b_language';
export const UI_TRANSLATION_CACHE_VERSION = 'v2';

export function getUiCopyId(zh: string, it: string): string {
  const input = `${zh}\u0000${it}`;
  const hash = (seed: number) => {
    let value = seed;
    for (let index = 0; index < input.length; index += 1) {
      value = Math.imul(value ^ input.charCodeAt(index), 0x01000193);
    }
    return (value >>> 0).toString(36);
  };
  return `copy_${hash(0x811c9dc5)}_${hash(0x9e3779b9)}`;
}

export function interpolateUiCopy(template: string, values: readonly (string | number)[] = []): string {
  return template.replace(/\{\{RUDA_ARG_(\d+)\}\}/g, (marker, index: string) => {
    const value = values[Number(index)];
    return value === undefined ? marker : String(value);
  });
}

export function hasHanCharacters(value: string): boolean {
  return /\p{Script=Han}/u.test(value);
}

export function isUiTranslationText(value: unknown, language: Language, maxLength: number): value is string {
  return typeof value === 'string'
    && Boolean(value.trim())
    && value.length <= maxLength
    && (language === 'zh' || !hasHanCharacters(value));
}

export function isLanguage(value: unknown): value is Language {
  return typeof value === 'string'
    && LANGUAGE_OPTIONS.some(language => language.code === value);
}

export function getOpenGraphLocale(language: Language): string {
  return OPEN_GRAPH_LOCALES[language];
}

export function getIntlLocale(language: Language): string {
  return INTL_LOCALES[language];
}

export const TRANSLATIONS = {
  it: {
    // Brand & Utility Bar
    brandName: 'RUDA',
    brandTagline: 'Ingrosso Moda Pronta & Showroom',
    brandLocation: 'Milano · Prato',
    uiTranslationUnavailableTitle: 'Traduzione temporaneamente non disponibile',
    uiTranslationUnavailableMessage: 'Alcuni testi dell’interfaccia sono mostrati in italiano. Riprova tra poco.',
    analyticsPrivacySettings: 'Privacy',
    analyticsTitle: 'Statistiche anonime',
    analyticsMessage: 'Statistiche anonime su visite, assistenza e campagne per migliorare il sito. Nessuna chat o contatto; rifiutando, restano disattivate.',
    analyticsAllow: 'Consenti',
    analyticsDeny: 'Rifiuta',
    catalogSyncFailedTitle: 'Catalogo non disponibile',
    catalogSyncFailedMessage: 'Alcuni dati di prodotti, negozi o showroom non sono disponibili. Nuovo tentativo automatico.',
    topAnnouncement: 'PRONTO MODA ITALIA · Spedizioni rapide 24/48h da Prato e Milano · B2B con Partita IVA',
    currencyEu: 'EUR (€) · IVA Escl.',
    wholesaleRegisterTitle: 'Registrazione acquirente B2B',

    // Navigation Roles
    navBuyer: 'Catalogo',
    navMerchant: 'Negozio',
    navMerchantBusiness: 'Business',
    navStorefront: 'Vetrina',
    navPlatform: 'Admin',
    navTerms: 'Termini B2B',

    // Search
    searchPlaceholder: 'Cerca per codice articolo, modello, tessuto (es. DRS-2026, Seta, Abito)...',
    searchButton: 'Cerca',
    quickSearchTags: 'Articoli in evidenza:',

    // Main Navigation Links
    navShowrooms: 'Showroom',
    navReorder: 'Riordino',
    navMyBusiness: 'Account',
    navCatalog: 'Prodotti',
    navCart: 'Carrello',
    navOrders: 'Ordini',

    // Account & Authentication
    guestTitle: 'Visitatore',
    guestSubtitle: 'Prezzi ingrosso riservati',
    switchAccountHeader: 'Seleziona Profilo Aziendale',
    applyWholesale: 'Richiedi Accreditamento B2B con P.IVA',
    creditLine: 'Fido accordato',
    tierMajor: 'Partner Direzionale (Sconto 17.5%)',
    tierVip: 'Cliente VIP (Sconto 10%)',
    tierStandard: 'Rivenditore Accreditato',
    guestDesc: 'Modalità consultazione: per visualizzare i listini all\'ingrosso è richiesta la verifica aziendale.',

    // Categories
    catAll: 'Tutte le Collezioni',
    catNew: 'Nuovi Arrivi',
    catHot: 'I Più Venduti',
    catWomen: 'Collezione Donna',
    catMen: 'Collezione Uomo',
    catShoes: 'Calzature',
    catBags: 'Borse & Pelletteria',
    catAccessories: 'Accessori Moda',
    catShowrooms: 'Showroom Ufficiali',

    // Product Card & Attributes
    styleCode: 'Cod. Articolo',
    wholesalePriceLabel: 'Prezzo Ingrosso',
    retailPriceLabel: 'Prezzo Consigliato Retail',
    packLabel: 'Confezione',
    packUnit: 'pz per pacco',
    minOrderLabel: 'Minimo d\'Ordine',
    minOrderUnit: 'pz',
    inStockStatus: 'Disponibile a Magazzino',
    fastDispatch: 'Pronta Consegna 24/48h',
    exclusiveProtected: 'Collezione Riservata',
    requestExclusiveAccess: 'Richiedi Accesso al Fornitore',
    exclusivePending: 'Richiesta in Valutazione',
    exclusiveGranted: 'Accesso Autorizzato',
    viewDetails: 'Scheda Prodotto',
    quickOrder: 'Ordine Rapido',

    // Product Detail View
    backToCatalog: 'Torna al Catalogo',
    productOrigin: 'Origine di Produzione',
    productSeason: 'Stagione',
    productFabric: 'Composizione Tessuto',
    productCharacteristics: 'Caratteristiche Capi',
    productPackaging: 'Imballo e Spedizione',
    productWashCare: 'Istruzioni di Lavaggio',
    stockDistribution: 'Disponibilità Magazzini',
    stockCentralPrato: 'Magazzino Centrale Prato',
    stockShowroomMestre: 'Showroom Venezia Mestre',
    stockShowroomMilano: 'Showroom Milano Moda',
    totalSelectedQty: 'Quantità Totale Selezionata',
    totalEstimatedAmount: 'Totale Imponibile',
    addToCartBtn: 'Aggiungi all\'Ordine',
    orderDirectBtn: 'Conferma e Procedi',

    // Home View
    homeGreeting: 'Benvenuto',
    homeVerifiedBadge: 'Partita IVA Verificata',
    homePaymentTerm: 'Pagamento Concordato',
    homeStartBuying: 'Inizia gli Acquisti',
    homeUploadPo: 'Carica Lista Ordine',
    homePendingOrders: 'Ordini in Elaborazione',
    homePickingOrders: 'In Preparazione / Spedizione',
    homeDeliveredOrders: 'Spedizioni Recenti',
    homePrivateVaultTitle: 'Collezioni Private Riservate',
    homePrivateVaultDesc: 'Modelli esclusivi protetti da accordi di riservatezza, visibili previo assenso del brand.',
    homeShowroomsTitle: 'Gli Showroom Ufficiali in Italia',
    homeShowroomsDesc: 'Visita i nostri spazi espositivi a Milano, Prato e Roma per toccare con mano i tessuti.',
    homeNewArrivalsTitle: 'Nuove Creazioni della Settimana',

    // Cart View
    cartHeader: 'Riepilogo Ordine all\'Ingrosso',
    cartEmptyTitle: 'Il tuo carrello B2B è vuoto',
    cartEmptyDesc: 'Esplora il catalogo pronto moda per inserire i capi per il tuo punto vendita.',
    cartContinueShopping: 'Continua gli Acquisti',
    cartCheckoutBtn: 'Procedi con l\'Ordine',
    cartMerchantSplitNote: 'Gli ordini sono suddivisi automaticamente per fornitore di riferimento.',
    cartItemsCount: 'capi inseriti',
    cartDeletePrompt: 'Rimuovere questo articolo dall\'ordine?',

    // Checkout View
    checkoutTitle: 'Finalizzazione Ordine Fornitura',
    checkoutStepCompany: '1. Intestazione Aziendale & Fatturazione',
    checkoutStepShipping: '2. Destinazione Merci',
    checkoutStepPayment: '3. Condizioni di Pagamento B2B',
    checkoutVatNotice: 'Fatturazione elettronica comunitaria con applicazione delle normative vigenti.',
    checkoutPlaceOrder: 'Invia Ordine Definitivo',
    checkoutSubmitting: 'Elaborazione in corso...',
    checkoutSuccessTitle: 'Ordine Ricevuto con Successo',
    checkoutSuccessDesc: 'Riceverai la conferma d\'ordine con il dettaglio dei colli e la data stimata di consegna.',

    // Orders View
    ordersTitle: 'Registro Ordini e Spedizioni',
    ordersFilterAll: 'Tutti gli Ordini',
    ordersFilterProcessing: 'In Corso',
    ordersFilterShipped: 'Spediti',
    ordersFilterDelivered: 'Consegnati',
    orderNumber: 'Numero Ordine',
    orderDate: 'Data Inserimento',
    orderTotal: 'Totale Ordine',
    orderStatusPlaced: 'Ricevuto',
    orderStatusConfirmed: 'Confermato',
    orderStatusPicking: 'In Allestimento',
    orderStatusShipped: 'Spedito con Corriere',
    orderStatusDelivered: 'Consegnato',
    orderStatusCancelled: 'Annullato',
    orderReorderBtn: 'Riordina Intero Lotto',

    // Showrooms View
    showroomsTitle: 'Showroom Ufficiali & Centri Espositivi',
    showroomsSubtitle: 'Accoglienza professionale per boutique, buyer internazionali e catene retail.',
    showroomOpeningHours: 'Orari di Apertura',
    showroomCapacity: 'Spazio Espositivo',
    showroomBookVisit: 'Prenota Visita Showroom',
    showroomVirtualTour: 'Tour Espositivo',

    // Merchant Store View
    merchantVerifiedSupplier: 'Fornitore Verificato',
    merchantShowroomAddress: 'Sede Showroom',
    merchantCatalogTab: 'Campionario Pubblico',
    merchantPrivateTab: 'Collezione Privata',
    merchantAboutTab: 'Profilo Fornitore',

    // Supplier & Platform Admin
    portalMerchantTitle: 'Portale Gestione Fornitore',
    portalPlatformTitle: 'Direzione Piattaforma B2B',
    portalOverview: 'Panoramica Attività',
    portalInventory: 'Gestione Magazzino',
    portalOrders: 'Ordini Ricevuti',
    portalSettlement: 'Estratto Conto e Liquidazioni',

    // Footer
    footerDesc: 'Piattaforma di distribuzione b2b per l\'eccellenza del pronto moda italiano. Collegamento diretto tra atelier toscani, maestranze milanesi e i migliori rivenditori europei.',
    footerLogistics: 'Logistica & Hub Distributivi',
    footerLegal: 'Note Legali e Conformità',
    footerCopyright: 'RUDA Pronto Moda Italia B2B. Tutti i diritti riservati.',
    footerVatCompliance: 'Regime fiscale B2B Comunitario · D.P.R. 633/72',

    // General Actions
    confirm: 'Conferma',
    cancel: 'Annulla',
    close: 'Chiudi',
    save: 'Salva',
    edit: 'Modifica',
    delete: 'Elimina',
    exportDoc: 'Esporta Documento',
    copy: 'Copia',
    copied: 'Copiato',

    // Authentication
    authLanguageSelect: 'Seleziona la lingua',
    authLanguageAuto: 'Automatico · Browser',
    authSignIn: 'Accedi',
    authSignInLoading: 'Accesso in corso…',
    authSubmitting: 'Invio in corso…',
    authCreateAccount: 'Crea account',
    authEmail: 'Email',
    authEmailOrPhone: 'Email o telefono',
    authPhone: 'Telefono',
    authPassword: 'Password',
    authConfirmPassword: 'Conferma password',
    authShowPassword: 'Mostra password',
    authHidePassword: 'Nascondi password',
    authBackHome: 'Torna alla home',
    authEmployeeTitle: 'Accesso dipendenti',
    authEmployeeSubtitle: 'Accedi al workspace autorizzato con il tuo account.',
    authEmployeeEmail: 'Email aziendale',
    authEmployeeWorkspace: 'Seleziona il negozio',
    authEmployeeWorkspacePrompt: 'Scegli il workspace merchant',
    authBuyerTitle: 'Accesso grossisti e rivenditori',
    authBuyerSubtitle: 'Accedi per consultare il catalogo e i tuoi ordini.',
    authBuyerInvalid: 'Email o password non corretti. Riprova.',
    authRetailSignIn: 'Accedi al tuo account',
    authRetailCreate: 'Crea un account retail',
    authRetailLastName: 'Cognome',
    authRetailFirstName: 'Nome',
    authRetailPhoneOptional: 'Telefono (facoltativo)',
    authRetailNewsletter: 'Ricevi novità, offerte e tendenze moda (puoi annullare in qualsiasi momento)',
    authRetailSubmit: 'Crea account',
    authRetailLegal: 'Registrandoti accetti i Termini di servizio e l’Informativa sulla privacy.',
    authPasswordMismatch: 'Le password non corrispondono.',
    authRetailPasswordRule: 'Almeno 8 caratteri',
    authLoginFailed: 'Accesso non riuscito. Riprova.',
    authProcessing: 'Elaborazione…',
    authMerchantLoginTitle: 'Area merchant',
    authMerchantRegisterTitle: 'Account merchant',
    authMerchantLoginSubtitle: 'Accedi o crea un account per gestire negozio, prodotti, inventario e team.',
    authMerchantRegisterSubtitle: 'Richiesta soggetta a revisione.',
    authMerchantLoginTab: 'Accedi',
    authMerchantRegisterTab: 'Crea account',
    authMerchantEmailPhone: 'Email o telefono verificato',
    authMerchantRegisterEmail: 'Email per il tuo account RUDA',
    authMerchantStoreName: 'Nome del negozio (facoltativo)',
    authMerchantSalesChannels: 'Canali di vendita (facoltativo)',
    authMerchantSalesExample: 'Es. online, negozio, ingrosso',
    authMerchantPasswordMin: 'Almeno 8 caratteri',
    authMerchantLoginButton: 'Accedi al centro aziendale',
    authMerchantApplyButton: 'Invia la richiesta',
    authMerchantCreateAccountButton: 'Invia richiesta merchant',
    authMerchantNewAccount: 'Nuovo merchant? Richiedi l’accesso',
    authMerchantFullApplication: 'Invia una domanda aziendale completa',
    authMerchantAiOnboarding: 'Prova la registrazione guidata dall’AI',
    authMerchantSubmittedTitle: 'Richiesta inviata',
    authMerchantSubmittedSubtitle: 'Dopo l’approvazione potrai accedere con lo stesso account.',
    authMerchantReviewNotice: 'Le funzioni merchant saranno disponibili dopo la verifica.',
    authMerchantCreatedTitle: 'Richiesta merchant inviata',
    authMerchantCreatedSubtitle: 'Il workspace sarà disponibile dopo l’approvazione.',
    authMerchantVerificationNotice: 'La richiesta è in revisione; l’accesso merchant resta bloccato fino all’approvazione.',
    authMerchantOpenDashboard: 'Apri il centro aziendale',
    authMerchantReturnLogin: 'Torna al login',
    authMerchantPending: 'La richiesta merchant è ancora in revisione.',
    authMerchantAccessRequired: 'Questo account RUDA non ha ancora un workspace merchant approvato. Invia prima una richiesta di accesso.',
    authMerchantInvalidLogin: 'Email, telefono verificato o password non corretti.',
    authTooManyAttempts: 'Troppi tentativi. Attendi circa {minutes} minuti e riprova oppure contatta l’assistenza.',
    authPasswordTooShort: 'La password deve contenere almeno 8 caratteri.',
    authMerchantApplicationError: 'Richiesta non inviata. Controlla i dati e riprova.',
    authAdminTitle: 'Accesso amministratore',
    authAdminSubtitle: 'Accesso riservato agli amministratori autorizzati.',
    authAdminUsername: 'Nome utente',
    authAdminOtp: 'Codice 2FA a 6 cifre',
    authAdminOtpInvalid: 'Inserisci un codice di verifica valido a 6 cifre.',
    authAdminCredentialsInvalid: 'Nome utente o password non validi.',
    authAdminTwoFactorConfig: 'Configurazione 2FA non valida. Contatta l’assistenza tecnica.',
    authAdminVerifying: 'Verifica in corso…',
    authAdminSubmit: 'Accedi alla gestione'
  },
  zh: {
    // Brand & Utility Bar
    brandName: 'RUDA',
    brandTagline: '欧洲快时尚现货批发与品牌展厅',
    brandLocation: '米兰 · 普拉托',
    uiTranslationUnavailableTitle: '界面翻译暂时不可用',
    uiTranslationUnavailableMessage: '部分界面文字暂以意大利语显示，请稍后重试。',
    analyticsPrivacySettings: '隐私',
    analyticsTitle: '匿名统计',
    analyticsMessage: '匿名统计浏览、客服和推广来源以改进网站。不记录聊天或联系方式；拒绝即停用。',
    analyticsAllow: '允许',
    analyticsDeny: '拒绝',
    catalogSyncFailedTitle: '目录暂不可用',
    catalogSyncFailedMessage: '部分商品、商家或展厅暂不可用，系统将自动重试。',
    topAnnouncement: '意大利快时尚现货批发平台 · 普拉托/米兰源头仓 24/48小时极速发货 · 欧洲合规B2B开票',
    currencyEu: 'EUR (€) · 不含税',
    wholesaleRegisterTitle: '批发买手注册',

    // Navigation Roles
    navBuyer: '采购',
    navMerchant: '店铺',
    navMerchantBusiness: '商务',
    navStorefront: '商城前台',
    navPlatform: '管理',
    navTerms: 'B2B 条款',

    // Search
    searchPlaceholder: '按款号、商品名、面料材质快速检索 (如: DRS-2026, 桑蚕丝, 连衣裙)...',
    searchButton: '搜索',
    quickSearchTags: '热门款式直达：',

    // Main Navigation Links
    navShowrooms: '展厅',
    navReorder: '复购',
    navMyBusiness: '账户',
    navCatalog: '商品',
    navCart: '购物车',
    navOrders: '订单',

    // Account & Authentication
    guestTitle: '访客模式',
    guestSubtitle: '仅展示零售建议价',
    switchAccountHeader: '切换采购商企业身份',
    applyWholesale: '申请欧洲企业增值税资质认证',
    creditLine: '授信结算额度',
    tierMajor: '核心大客户 (享82.5折)',
    tierVip: 'VIP优选客户 (享9折)',
    tierStandard: '认证批发商 (标准批发价)',
    guestDesc: '当前为访客模式，通过欧洲企业增值税核验后即可解锁专属批发阶梯价与起订配码。',

    // Categories
    catAll: '全部现货款式',
    catNew: '新品首发',
    catHot: '热销爆款',
    catWomen: '女装系列',
    catMen: '男装系列',
    catShoes: '鞋履精选',
    catBags: '箱包皮具',
    catAccessories: '时尚配饰',
    catShowrooms: '官方展厅街',

    // Product Card & Attributes
    styleCode: '款式编号',
    wholesalePriceLabel: '批发底价',
    retailPriceLabel: '建议零售价',
    packLabel: '装箱规格',
    packUnit: '件/包 (整包出货)',
    minOrderLabel: '起订门槛',
    minOrderUnit: '件',
    inStockStatus: '现货在库',
    fastDispatch: '48小时极速出库',
    exclusiveProtected: '私享订货专区',
    requestExclusiveAccess: '向品牌申请专属查阅权限',
    exclusivePending: '专属权限审核中',
    exclusiveGranted: '已获得专属准入',
    viewDetails: '查看详情',
    quickOrder: '配码下单',

    // Product Detail View
    backToCatalog: '返回现货大厅',
    productOrigin: '原产地与工坊',
    productSeason: '所属季节',
    productFabric: '核心面料成分',
    productCharacteristics: '版型与做工特色',
    productPackaging: '包装规格与吊牌',
    productWashCare: '洗涤保养指南',
    stockDistribution: '欧洲各仓实时库存',
    stockCentralPrato: '普拉托中央仓库',
    stockShowroomMestre: '威尼斯展厅前置仓',
    stockShowroomMilano: '米兰时尚区前置仓',
    totalSelectedQty: '本次选购总量',
    totalEstimatedAmount: '采购货款总额',
    addToCartBtn: '加入批发采购车',
    orderDirectBtn: '立即提交订货',

    // Home View
    homeGreeting: '尊贵客户，您好',
    homeVerifiedBadge: '欧洲企业资质已核验',
    homePaymentTerm: '对公结算通道已开启',
    homeStartBuying: '进入选款大厅',
    homeUploadPo: '上传订货清单',
    homePendingOrders: '待处理订单',
    homePickingOrders: '仓库拣配 / 待发货',
    homeDeliveredOrders: '近期已完成订单',
    homePrivateVaultTitle: '私享专属设计订货区',
    homePrivateVaultDesc: '包含未公开发布的胶囊系列与高定版型，经品牌主理人审核授权后方可查阅。',
    homeShowroomsTitle: '意大利直营实体展厅',
    homeShowroomsDesc: '常驻米兰、普拉托与罗马，欢迎欧洲买手亲临品鉴现货面料与实版做工。',
    homeNewArrivalsTitle: '本周意大利直供首发新款',

    // Cart View
    cartHeader: '批发采购车清单',
    cartEmptyTitle: '采购清单内暂无商品',
    cartEmptyDesc: '请前往现货选款大厅，按手/包将心仪款式加入清单。',
    cartContinueShopping: '挑选更多款式',
    cartCheckoutBtn: '进入结算流程',
    cartMerchantSplitNote: '系统将按照供货品牌独立拆分发货批次与对公单据。',
    cartItemsCount: '件商品',
    cartDeletePrompt: '确认从清单中移除该规格？',

    // Checkout View
    checkoutTitle: '批发采购订单核验与提交',
    checkoutStepCompany: '1. 企业发票抬头与税号信息',
    checkoutStepShipping: '2. 欧洲境内收货地址',
    checkoutStepPayment: '3. 对公结算与支付方式',
    checkoutVatNotice: '符合欧盟企业间增值税申报标准，支持反向征税与合规开票。',
    checkoutPlaceOrder: '确认提交订货单',
    checkoutSubmitting: '订单处理中...',
    checkoutSuccessTitle: '采购订单提交成功',
    checkoutSuccessDesc: '系统已将确认函及形式发票发送至您的企业邮箱，仓库正安排配货。',

    // Orders View
    ordersTitle: '采购订单与物流追踪',
    ordersFilterAll: '全部订单',
    ordersFilterProcessing: '处理中',
    ordersFilterShipped: '已发货',
    ordersFilterDelivered: '已签收',
    orderNumber: '订货单号',
    orderDate: '下单时间',
    orderTotal: '订单总计',
    orderStatusPlaced: '已下单',
    orderStatusConfirmed: '已核单',
    orderStatusPicking: '正在配货',
    orderStatusShipped: '已出库发货',
    orderStatusDelivered: '已送达',
    orderStatusCancelled: '已取消',
    orderReorderBtn: '整单极速翻单',

    // Showrooms View
    showroomsTitle: '生产商 / 批发商 / 零售商选款中心',
    showroomsSubtitle: '为欧洲精品买手店、连锁专柜及批发买家提供实体选样与现货即提服务。',
    showroomOpeningHours: '接待营业时间',
    showroomCapacity: '展厅陈列规模',
    showroomBookVisit: '预约展厅接待',
    showroomVirtualTour: '实景展厅全景',

    // Merchant Store View
    merchantVerifiedSupplier: '源头认证品牌',
    merchantShowroomAddress: '实体展厅地址',
    merchantCatalogTab: '公开展品选款',
    merchantPrivateTab: '私享专属系列',
    merchantAboutTab: '工坊资质简介',

    // Supplier & Platform Admin
    portalMerchantTitle: '供货商户管理中心',
    portalPlatformTitle: '平台综合运营总控',
    portalOverview: '业务经营总览',
    portalInventory: '现货与仓储调度',
    portalOrders: '采购订货协同',
    portalSettlement: '对公结算流水',

    // Footer
    footerDesc: '专注意大利快时尚供应链与现货批发分销，打通普拉托与米兰优质工坊直供全欧买手店通道。',
    footerLogistics: '欧洲快反仓储与物流网络',
    footerLegal: '合规经营与法律声明',
    footerCopyright: 'RUDA Pronto Moda Italia B2B · 版权所有',
    footerVatCompliance: '欧盟企业级 B2B 贸易标准与税务合规',

    // General Actions
    confirm: '确认',
    cancel: '取消',
    close: '关闭',
    save: '保存',
    edit: '编辑',
    delete: '删除',
    exportDoc: '导出文件',
    copy: '复制',
    copied: '已复制',

    // Authentication
    authLanguageSelect: '选择语言',
    authLanguageAuto: '自动 · 浏览器',
    authSignIn: '登录',
    authSignInLoading: '登录中…',
    authSubmitting: '正在提交…',
    authCreateAccount: '创建账户',
    authEmail: '邮箱',
    authEmailOrPhone: '邮箱或手机号',
    authPhone: '手机号',
    authPassword: '密码',
    authConfirmPassword: '确认密码',
    authShowPassword: '显示密码',
    authHidePassword: '隐藏密码',
    authBackHome: '返回首页',
    authEmployeeTitle: '员工工作台',
    authEmployeeSubtitle: '员工使用独立账号登录获授权的商家工作区。',
    authEmployeeEmail: '员工邮箱',
    authEmployeeWorkspace: '选择商家',
    authEmployeeWorkspacePrompt: '选择要进入的商家工作区',
    authBuyerTitle: '批发商 / 零售商登录',
    authBuyerSubtitle: '登录账户以查看采购目录和订单。',
    authBuyerInvalid: '邮箱或密码错误，请重试。',
    authRetailSignIn: '登录零售账户',
    authRetailCreate: '创建零售账户',
    authRetailLastName: '姓氏',
    authRetailFirstName: '名字',
    authRetailPhoneOptional: '手机号（可选）',
    authRetailNewsletter: '接收新品、优惠和时尚资讯（可随时退订）',
    authRetailSubmit: '创建账户',
    authRetailLegal: '注册即表示您同意服务条款和隐私政策。',
    authPasswordMismatch: '两次输入的密码不一致',
    authRetailPasswordRule: '至少 8 位',
    authLoginFailed: '登录失败，请稍后重试。',
    authProcessing: '处理中…',
    authMerchantLoginTitle: '商家工作台',
    authMerchantRegisterTitle: '商家账户',
    authMerchantLoginSubtitle: '登录或创建商家账号，管理店铺、商品、库存和团队。',
    authMerchantRegisterSubtitle: '提交入驻申请，审核通过后开通。',
    authMerchantLoginTab: '登录',
    authMerchantRegisterTab: '创建商家账号',
    authMerchantEmailPhone: 'RUDA 邮箱或已验证手机号',
    authMerchantRegisterEmail: '用于统一登录的邮箱',
    authMerchantStoreName: '店铺名称（可选）',
    authMerchantSalesChannels: '经营渠道（可选）',
    authMerchantSalesExample: '例如：线上、实体店、批发',
    authMerchantPasswordMin: '至少 8 位',
    authMerchantLoginButton: '登录企业中心',
    authMerchantApplyButton: '提交商家申请',
    authMerchantCreateAccountButton: '提交商家入驻申请',
    authMerchantNewAccount: '还没有商家权限？申请入驻',
    authMerchantFullApplication: '提交完整资质入驻申请',
    authMerchantAiOnboarding: '试试 AI 店长对话式入驻（体验版）',
    authMerchantSubmittedTitle: '商家申请已提交',
    authMerchantSubmittedSubtitle: '审核通过后即可使用同一账号登录企业中心。',
    authMerchantReviewNotice: '商家管理权限将在平台审核通过后开放。',
    authMerchantCreatedTitle: '商家入驻申请已提交',
    authMerchantCreatedSubtitle: '平台审核通过后，同一账号即可进入企业中心。',
    authMerchantVerificationNotice: '申请正在审核中；审核通过前不会开放商家后台权限。',
    authMerchantOpenDashboard: '进入企业中心',
    authMerchantReturnLogin: '返回统一登录',
    authMerchantPending: '商家入驻申请仍在审核中。',
    authMerchantAccessRequired: '该 RUDA 账号尚无已批准的企业中心工作区。请先提交商家入驻申请。',
    authMerchantInvalidLogin: '邮箱、已验证手机号或密码错误，请核对后重试。',
    authTooManyAttempts: '登录请求太频繁，请等待约 {minutes} 分钟后再试。若仍无法登录，请联系平台客服。',
    authPasswordTooShort: '密码至少需要 8 位',
    authMerchantApplicationError: '商家入驻申请未提交，请核对信息后重试。',
    authAdminTitle: '平台管理登录',
    authAdminSubtitle: '仅限授权管理员使用。',
    authAdminUsername: '管理员账号',
    authAdminOtp: '6 位动态验证码',
    authAdminOtpInvalid: '请输入有效的 6 位动态验证码',
    authAdminCredentialsInvalid: '管理员账号或密码错误',
    authAdminTwoFactorConfig: '管理员双重验证配置异常，请联系系统维护人员',
    authAdminVerifying: '验证中…',
    authAdminSubmit: '登录平台管理中心'
  }
} as const;

/**
 * Detect user's browser language automatically.
 * Uses the first browser-preferred language supported by RUDA and falls back
 * to English for all other locales.
 */
export function detectBrowserLanguage(): Language {
  if (typeof window !== 'undefined') {
    try {
      const saved = localStorage.getItem(LANGUAGE_PREFERENCE_KEY);
      if (isLanguage(saved)) {
        return saved;
      }
    } catch {}
  }
  return detectPreferredBrowserLanguage();
}

/**
 * Resolve the best supported language from the browser's current preference
 * list. The first supported match wins, just like a mobile browser locale.
 */
export function detectPreferredBrowserLanguage(): Language {
  if (typeof navigator === 'undefined') return 'en';
  const navLangs = navigator.languages?.length
    ? navigator.languages
    : [navigator.language || ''];
  for (const browserLanguage of navLangs) {
    const baseLanguage = browserLanguage.toLowerCase().replaceAll('_', '-').split('-')[0];
    if (isLanguage(baseLanguage)) return baseLanguage;
  }
  return 'en';
}

export function hasManualLanguagePreference(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const saved = localStorage.getItem(LANGUAGE_PREFERENCE_KEY);
    return isLanguage(saved);
  } catch {
    return false;
  }
}

/**
 * Pure translation fetcher
 */
export function translate(
  key: TranslationKey,
  lang: Language,
  aiTranslations?: Partial<Record<TranslationKey, string>>
): string {
  if (aiTranslations?.[key]) return aiTranslations[key]!;
  const staticLanguage = lang === 'zh' ? 'zh' : 'it';
  return TRANSLATIONS[staticLanguage][key] || TRANSLATIONS.it[key] || String(key);
}

/**
 * High-end product title cleaner ensuring NO mixed bilingual text.
 * Italian is the fallback source language until a dedicated locale value exists.
 * When lang is 'zh', outputs pure Chinese naming.
 */
export function getLocalizedProductName(
  product: { name: string; name_it?: string | null; name_zh?: string | null },
  lang: Language
): string {
  if (lang !== 'zh') {
    if (product.name_it) return product.name_it;
    // If name contains parentheses with English/Italian translation
    const match = product.name.match(/\((.*?)\)/);
    if (match && match[1] && /[a-zA-Z]/.test(match[1])) {
      return match[1].trim();
    }
    // Remove Chinese characters when an Italian source value is not available.
    const cleaned = product.name.replace(/[\u4e00-\u9fa5]/g, '').replace(/[()（）]/g, '').trim();
    return cleaned || (/\p{Script=Han}/u.test(product.name) ? 'Articolo RUDA' : product.name);
  } else {
    if (product.name_zh) return product.name_zh;
    // Remove English/Italian in parentheses for clean Chinese
    const cleaned = product.name.replace(/\(.*?\)/g, '').replace(/（.*?）/g, '').trim();
    return cleaned || product.name;
  }
}

export function getLocalizedMerchantName(
  merchant: { name: string; name_it?: string; name_zh?: string },
  lang: Language
): string {
  return lang === 'zh'
    ? merchant.name_zh || merchant.name
    : merchant.name_it || merchant.name;
}

/**
 * Pure localized description without dual languages
 */
export function getLocalizedProductDescription(
  product: { description: string; description_it?: string; description_zh?: string },
  lang: Language
): string {
  if (lang !== 'zh') {
    if (product.description_it) return product.description_it;
    return 'Capo realizzato secondo la tradizione del pronto moda italiano con finiture sartoriali e tessuti selezionati.';
  }
  if (product.description_zh) return product.description_zh;
  return product.description.replace(/\(.*?\)/g, '').trim();
}

/**
 * Pure localized color name without bilingual strings like "Nero 黑色"
 */
export function getLocalizedColor(colorStr: string, lang: Language): string {
  if (!colorStr) return '';
  const parts = colorStr.trim().split(/\s+/);
  if (parts.length >= 2) {
    if (lang !== 'zh') {
      return parts[0]; // e.g. "Nero" from "Nero 黑色"
    } else {
      return parts.slice(1).join(' '); // e.g. "黑色" from "Nero 黑色"
    }
  }
  if (lang !== 'zh') {
    return colorStr.replace(/[\u4e00-\u9fa5]/g, '').trim()
      || (/\p{Script=Han}/u.test(colorStr) ? 'Colore' : colorStr);
  }
  return colorStr.replace(/[a-zA-Z]/g, '').trim() || colorStr;
}

/**
 * Pure city and country names
 */
export function getLocalizedLocation(cityStr: string, countryStr: string, lang: Language): { city: string; country: string } {
  if (lang !== 'zh') {
    const city = cityStr ? cityStr.replace(/[\u4e00-\u9fa5]/g, '').replace(/[()（）]/g, '').trim() : 'Prato';
    const country = countryStr ? countryStr.replace(/[\u4e00-\u9fa5]/g, '').replace(/[()（）]/g, '').trim() : 'Italia';
    return { 
      city: city || 'Prato', 
      country: country || 'Italia' 
    };
  } else {
    // Chinese
    const cityMap: Record<string, string> = {
      'Prato': '普拉托',
      'Milano': '米兰',
      'Firenze': '佛罗伦萨',
      'Roma': '罗马',
      'Paris': '巴黎',
      'Madrid': '马德里',
      'Venice - Mestre': '威尼斯梅斯特雷'
    };
    let cleanCity = cityStr ? cityStr.replace(/\(.*?\)/g, '').trim() : '普拉托';
    for (const [en, zh] of Object.entries(cityMap)) {
      if (cityStr && cityStr.includes(en)) {
        cleanCity = zh;
        break;
      }
    }
    const cleanCountry = countryStr && countryStr.includes('France') ? '法国' : 
                         countryStr && countryStr.includes('Spain') ? '西班牙' : '意大利';
    return { city: cleanCity, country: cleanCountry };
  }
}

/**
 * Pure merchant tagline and description
 */
export function getLocalizedMerchantTagline(merchant: { tagline: string; tagline_it?: string; tagline_zh?: string }, lang: Language): string {
  if (lang !== 'zh') {
    return merchant.tagline_it || merchant.tagline.replace(/[\u4e00-\u9fa5]/g, '').replace(/[·•]/g, '·').trim();
  }
  return merchant.tagline_zh || merchant.tagline.replace(/[a-zA-Z]/g, '').trim();
}

export function getLocalizedMerchantDescription(merchant: { description: string; description_it?: string; description_zh?: string }, lang: Language): string {
  if (lang !== 'zh') {
    return merchant.description_it || 'Azienda leader nel settore dell\'abbigliamento Made in Italy con produzione propria e showroom all\'ingrosso.';
  }
  return merchant.description_zh || merchant.description;
}

/**
 * Pure showroom details
 */
export function getLocalizedShowroomCapacity(showroom: { capacity: string; capacity_it?: string; capacity_zh?: string }, lang: Language): string {
  if (lang !== 'zh') {
    return showroom.capacity_it || showroom.capacity.replace(/[\u4e00-\u9fa5]/g, '').trim();
  }
  return showroom.capacity_zh || showroom.capacity;
}

export function getLocalizedShowroomHours(showroom: { openingHours: string; openingHours_it?: string; openingHours_zh?: string }, lang: Language): string {
  if (lang !== 'zh') {
    return showroom.openingHours_it || showroom.openingHours.replace(/[\u4e00-\u9fa5]/g, '').replace(/[()（）]/g, '').trim();
  }
  return showroom.openingHours_zh || showroom.openingHours;
}

export function getLocalizedShowroomFeatures(showroom: { features: string[]; features_it?: string[]; features_zh?: string[] }, lang: Language): string[] {
  if (lang !== 'zh') {
    const features = showroom.features_it && showroom.features_it.length > 0 ? showroom.features_it : showroom.features;
    return features
      .map(feature => feature.replace(/[\u4e00-\u9fa5]/g, '').trim())
      .filter(Boolean);
  }
  return showroom.features_zh && showroom.features_zh.length > 0 ? showroom.features_zh : showroom.features;
}
