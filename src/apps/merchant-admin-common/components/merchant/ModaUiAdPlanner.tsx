import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Check,
  ChevronDown,
  ChevronUp,
  Film,
  GripVertical,
  ImagePlus,
  LayoutGrid,
  Loader2,
  Lock,
  Search,
  Subtitles,
  Trash2,
  Wand2
} from 'lucide-react';
import { apiGet, apiPatch, apiPost, ApiError } from '../../../../api/client';
import { uploadMerchantMedia } from '../../../../api/merchantMedia';
import { useB2B } from '../../../../context/B2BContext';
import type { Product } from '../../../../types/b2b';
import type { AiAdBrief } from '../../../../server/modauiAdBrief';
import type {
  AiAdConcept,
  AiAdCostEstimate,
  AiAdProviderStatus,
  AiAdStoryboardShot
} from '../../../../server/modauiAdPlanner';

/**
 * MODAUI 广告工作室（P2：双模式 / 视觉比较 / 双层编辑器）。
 *
 * 设计契约见 docs/engineering/modules/modaui-ai-advertising.md §24：
 * - 四步固定：选商品 → 比较方案 → 确认预算 → 编辑并保存分镜；返回上一步不丢内容。
 * - 方案卡只用真实商品图（角标「商品实拍参考」），没有图就显示空状态，不摆示意图。
 * - 没有真实视频/配音 Adapter 时，生成入口固定禁用并写明原因，不做假按钮。
 * - 文字与模板类修改走本地确定性接口，不调用付费供应商；分镜改动 1.5s 防抖自动保存。
 * - 电脑端与手机网页端共用本组件；小程序按同一接口契约实现同等能力。
 */

type AdStep = 'product' | 'concepts' | 'budget' | 'storyboard';
type EditorLayer = 'simple' | 'pro';
type AutoSaveState = 'idle' | 'pending' | 'saving' | 'saved' | 'error';
type ConceptLanguage = 'it' | 'en' | 'zh';
type ConceptAspect = '9:16' | '1:1' | '16:9';
type ResolutionKey = '480p' | '720p' | '1080p';
/** 商家只做商业选择：用途与平台由平台映射成服务端既有字段，不再暴露技术参数。 */
type AdPurpose = 'product_ad' | 'creator_ugc' | 'promotion' | 'brand_film';
type AdPlatform = 'douyin' | 'xiaohongshu' | 'wechat_channels' | 'instagram_reels' | 'youtube_shorts' | 'website' | 'marketplace_feed';

type BriefResponse = {
  success: true;
  brief: AiAdBrief;
  providerStatus: AiAdProviderStatus;
};

type ConceptsResponse = {
  success: true;
  brief: AiAdBrief;
  providerStatus: AiAdProviderStatus;
  concepts: AiAdConcept[];
};

type ProjectConceptRow = AiAdConcept & { id: string };

type AiAdProjectPayload = {
  id: string;
  productId: string | null;
  title: string;
  status: string;
  brief: AiAdBrief;
  selectedConceptId: string | null;
  currentVersionNo: number;
  costEstimate: AiAdCostEstimate | null;
  supplementImages?: string[] | null;
  concepts: ProjectConceptRow[];
  updatedAt: string;
};

type VersionRow = {
  id: string;
  versionNo: number;
  conceptKey: string;
  note: string | null;
  createdAt: string;
  costEstimate: AiAdCostEstimate | null;
  storyboard?: AiAdStoryboardShot[] | null;
};

type QuotaSnapshot = {
  remaining: { daily: number; monthly: number };
  limits: { dailyCalls: number; monthlyCalls: number };
  allowed: boolean;
  billingEnabled: boolean;
};

type ShotEditPlan = {
  preset: string;
  label: string;
  tier: 'local' | 'generation';
  callsPaidProvider: boolean;
  requiresGeneration: boolean;
  patch: Record<string, unknown>;
  note: string;
};

type ShotEditResponse = {
  success: true;
  created: boolean;
  plan: ShotEditPlan;
  project: AiAdProjectPayload;
  storyboard: AiAdStoryboardShot[];
  script: unknown;
  costEstimate: AiAdCostEstimate;
};

const STEPS: ReadonlyArray<{ id: AdStep; zh: string; it: string }> = [
  { id: 'product', zh: '选择商品', it: 'Prodotto' },
  { id: 'concepts', zh: '比较方案', it: 'Confronta' },
  { id: 'budget', zh: '确认预算', it: 'Budget' },
  { id: 'storyboard', zh: '编辑分镜', it: 'Storyboard' }
];

const MISSING_LABELS: Record<string, { zh: string; it: string }> = {
  price: { zh: '价格', it: 'Prezzo' },
  images: { zh: '商品图片', it: 'Immagini' },
  skus: { zh: 'SKU', it: 'SKU' },
  colors: { zh: '颜色', it: 'Colori' },
  material: { zh: '面料成分', it: 'Composizione' },
  description: { zh: '商品描述', it: 'Descrizione' },
  sellingPoints: { zh: '卖点', it: 'Punti vendita' }
};

const SERVICE_LABELS: Record<string, { zh: string; it: string }> = {
  text: { zh: '文案生成', it: 'Testi' },
  video: { zh: '视频生成', it: 'Video' },
  voice: { zh: '配音', it: 'Voce' },
  digitalHuman: { zh: '数字人', it: 'Avatar' }
};

const STATUS_LABELS: Record<string, { zh: string; it: string; ready: boolean }> = {
  ready: { zh: '已接通', it: 'Attivo', ready: true },
  provider_access_required: { zh: '缺少供应商凭据', it: 'Credenziali mancanti', ready: false },
  adapter_not_built: { zh: '适配器未实现', it: 'Adapter non pronto', ready: false },
  price_not_configured: { zh: '未配置单价', it: 'Prezzo non configurato', ready: false },
  provider_not_configured: { zh: '未配置供应商', it: 'Provider non configurato', ready: false }
};

const ROUTE_NAMES: Record<string, string> = {
  product: 'Product Ad',
  ugc: 'UGC Ad',
  quick: 'Quick Ad'
};

const ROUTE_HINTS: Record<string, { zh: string; it: string }> = {
  product: { zh: '商品为主角，突出材质与做工', it: 'Prodotto protagonista, materiali e finiture' },
  ugc: { zh: '真人出镜讲解，接近用户视角', it: 'Creator in camera, taglio autentico' },
  quick: { zh: '图片快剪，成本最低、出片最快', it: 'Montaggio rapido da immagini, costo minimo' }
};

const FRAMING_LABELS: Record<string, { zh: string; it: string }> = {
  wide: { zh: '全景', it: 'Campo lungo' },
  medium: { zh: '中景', it: 'Piano medio' },
  close: { zh: '近景', it: 'Primo piano' },
  macro: { zh: '特写', it: 'Dettaglio' }
};

const CAMERA_LABELS: Record<string, { zh: string; it: string }> = {
  static: { zh: '固定机位', it: 'Fisso' },
  push_in: { zh: '推近', it: 'Avvicina' },
  pan: { zh: '横移', it: 'Pan' },
  orbit: { zh: '环绕', it: 'Orbita' }
};

const TRANSITION_LABELS: Record<string, { zh: string; it: string }> = {
  cut: { zh: '硬切', it: 'Taglio' },
  fade: { zh: '淡入', it: 'Dissolvenza' },
  slide: { zh: '滑动', it: 'Scorrimento' }
};

const CROP_LABELS: Record<string, { zh: string; it: string }> = {
  none: { zh: '原始比例', it: 'Originale' },
  tight: { zh: '紧凑裁切', it: 'Stretto' },
  wide: { zh: '宽松留白', it: 'Ampio' }
};

const POSITION_LABELS: Record<string, { zh: string; it: string }> = {
  center: { zh: '居中', it: 'Centro' },
  top: { zh: '偏上', it: 'Alto' },
  bottom: { zh: '偏下', it: 'Basso' }
};

const SOURCE_LABELS: Record<string, { zh: string; it: string }> = {
  ai_video: { zh: 'AI 视频', it: 'Video AI' },
  product_image: { zh: '商品图', it: 'Immagine prodotto' },
  local_motion: { zh: '本地动效', it: 'Motion locale' }
};

/**
 * 广告用途：商家选「想做什么广告」，平台映射 goal 与首选路线。
 * ready=false 表示该用途依赖尚未接通的能力（数字人/口型同步），界面必须禁用并写明原因。
 */
const PURPOSE_OPTIONS: ReadonlyArray<{
  id: AdPurpose;
  zh: string;
  it: string;
  goal: 'conversion' | 'awareness' | 'launch';
  route: 'product' | 'ugc' | 'quick';
  ready: boolean;
  reasonZh?: string;
  reasonIt?: string;
}> = [
  { id: 'product_ad', zh: '商品宣传', it: 'Promozione prodotto', goal: 'conversion', route: 'product', ready: true },
  {
    id: 'creator_ugc',
    zh: '数字人介绍',
    it: 'Creator digitale',
    goal: 'awareness',
    route: 'ugc',
    ready: false,
    reasonZh: '数字人与口型同步尚未接通',
    reasonIt: 'Avatar e lip-sync non ancora attivi'
  },
  { id: 'promotion', zh: '促销广告', it: 'Offerta', goal: 'conversion', route: 'quick', ready: true },
  { id: 'brand_film', zh: '品牌视频', it: 'Brand film', goal: 'launch', route: 'product', ready: true }
];

/** 发布平台只决定画幅与导出比例；发布能力统一未接通，界面必须如实标注。 */
const PLATFORM_OPTIONS: ReadonlyArray<{ id: AdPlatform; zh: string; it: string; aspect: ConceptAspect }> = [
  { id: 'douyin', zh: '抖音', it: 'Douyin', aspect: '9:16' },
  { id: 'xiaohongshu', zh: '小红书', it: 'Xiaohongshu', aspect: '9:16' },
  { id: 'wechat_channels', zh: '视频号', it: 'WeChat Channels', aspect: '9:16' },
  { id: 'instagram_reels', zh: 'Instagram Reels', it: 'Instagram Reels', aspect: '9:16' },
  { id: 'youtube_shorts', zh: 'YouTube Shorts', it: 'YouTube Shorts', aspect: '9:16' },
  { id: 'website', zh: '官网 / 独立站', it: 'Sito', aspect: '16:9' },
  { id: 'marketplace_feed', zh: '电商主图视频', it: 'Video catalogo', aspect: '1:1' }
];

const SHOT_EDIT_PRESETS: ReadonlyArray<{ id: string; zh: string; it: string }> = [
  { id: 'premium', zh: '更高级', it: 'Più premium' },
  { id: 'product_clarity', zh: '商品更清楚', it: 'Prodotto più chiaro' },
  { id: 'background', zh: '换一个背景', it: 'Cambia sfondo' },
  { id: 'natural_person', zh: '人物更自然', it: 'Persona più naturale' },
  { id: 'faster', zh: '节奏更快', it: 'Più veloce' },
  { id: 'redesign', zh: '重新设计', it: 'Ridisegna' }
];

function formatCurrency(minor: number | null, currency: string): string {
  if (minor === null) return '';
  const amount = (minor / 100).toFixed(2);
  if (currency === 'EUR') return `€${amount}`;
  if (currency === 'USD') return `$${amount}`;
  return `${amount} ${currency}`;
}

function formatUsd(amount: number | null): string | null {
  return amount === null ? null : `$${amount.toFixed(2)}`;
}

function formatDuration(durationMs: number): string {
  const seconds = Math.round(durationMs / 100) / 10;
  return `${seconds}s`;
}

function shotSpeed(shot: AiAdStoryboardShot): number {
  return typeof shot.speed === 'number' ? shot.speed : 1;
}

function shotDurationTotal(shots: ReadonlyArray<AiAdStoryboardShot>): number {
  return shots.reduce((total, shot) => total + shot.durationMs, 0);
}


export interface ModaUiAdPlannerProps {
  /** 手机网页端使用：单列布局、更大的触控目标、步骤条横向滚动、底部固定主操作。 */
  compact?: boolean;
}

export const ModaUiAdPlanner: React.FC<ModaUiAdPlannerProps> = ({ compact = false }) => {
  const { localizeCopy, lang } = useB2B();
  const isIt = lang === 'it';
  const copy = useCallback((zh: string, it: string) => localizeCopy(zh, it), [localizeCopy]);

  const [step, setStep] = useState<AdStep>('product');

  const [products, setProducts] = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [productsError, setProductsError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const [productId, setProductId] = useState<string | null>(null);
  const [brief, setBrief] = useState<AiAdBrief | null>(null);
  const [briefLoading, setBriefLoading] = useState(false);
  const [briefError, setBriefError] = useState<string | null>(null);

  const [supplementImages, setSupplementImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 商业选择 → 既有请求字段的确定性映射；目标/画幅/档位不再让商家选。
  const [purpose, setPurpose] = useState<AdPurpose>('product_ad');
  const [platform, setPlatform] = useState<AdPlatform>('douyin');
  const [conceptLanguage] = useState<ConceptLanguage>(isIt ? 'it' : 'zh');
  const [resolutionKey] = useState<ResolutionKey>('720p');
  const purposeOption = PURPOSE_OPTIONS.find(option => option.id === purpose) ?? PURPOSE_OPTIONS[0];
  const platformOption = PLATFORM_OPTIONS.find(option => option.id === platform) ?? PLATFORM_OPTIONS[0];
  const goal = purposeOption.goal;
  const aspectRatio = platformOption.aspect;

  const [concepts, setConcepts] = useState<AiAdConcept[]>([]);
  const [conceptsLoading, setConceptsLoading] = useState(false);
  const [conceptError, setConceptError] = useState<{ code: string; detail: string } | null>(null);
  const [selectedConceptKey, setSelectedConceptKey] = useState<string | null>(null);
  const [conceptDetailKey, setConceptDetailKey] = useState<string | null>(null);
  const [compareOpen, setCompareOpen] = useState(false);

  const [project, setProject] = useState<AiAdProjectPayload | null>(null);
  const [projectBusy, setProjectBusy] = useState(false);
  const [projectError, setProjectError] = useState<{ code: string; detail: string } | null>(null);
  const [budgetEstimate, setBudgetEstimate] = useState<AiAdCostEstimate | null>(null);

  const [quota, setQuota] = useState<QuotaSnapshot | null>(null);
  const [quotaError, setQuotaError] = useState(false);

  const [editorLayer, setEditorLayer] = useState<EditorLayer>('simple');
  const [draftShots, setDraftShots] = useState<AiAdStoryboardShot[]>([]);
  const [selectedShotId, setSelectedShotId] = useState<string | null>(null);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const [saving, setSaving] = useState(false);
  const [autoSaveState, setAutoSaveState] = useState<AutoSaveState>('idle');
  const [lastAutoSavedVersion, setLastAutoSavedVersion] = useState<number | null>(null);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<{ code: string; detail: string } | null>(null);

  const [editOpenShotId, setEditOpenShotId] = useState<string | null>(null);
  const [editPreset, setEditPreset] = useState<string | null>(null);
  const [editInstruction, setEditInstruction] = useState('');
  const [editBusy, setEditBusy] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [editNotice, setEditNotice] = useState<{ text: string; requiresGeneration: boolean } | null>(null);

  const [versions, setVersions] = useState<VersionRow[]>([]);
  const [versionsLoading, setVersionsLoading] = useState(false);
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [restoringVersionNo, setRestoringVersionNo] = useState<number | null>(null);
  const clientRequestIdRef = useRef<string>('');
  const lastSavedSignatureRef = useRef('[]');
  const saveShotsRef = useRef<(shots: AiAdStoryboardShot[], note?: string, auto?: boolean) => Promise<void>>(async () => {});

  const describeError = useCallback((error: unknown): { code: string; detail: string } => {
    if (!(error instanceof ApiError)) {
      return { code: 'REQUEST_FAILED', detail: copy('请求失败，请稍后重试', 'Richiesta non riuscita, riprova') };
    }
    const code = error.code || `REQUEST_FAILED_${error.status}`;
    const map: Record<string, { zh: string; it: string }> = {
      PROVIDER_NOT_CONFIGURED: {
        zh: '未配置文本模型，无法生成方案。请先在工具中心检查 AI 能力。',
        it: 'Nessun modello testuale configurato: controlla gli strumenti AI.'
      },
      PRICE_NOT_CONFIGURED: {
        zh: '商品缺少价格，方案无法报价。请先补全商品价格。',
        it: 'Prezzo mancante: completa il prezzo del prodotto.'
      },
      AI_AD_FACT_UNGROUNDED: {
        zh: '方案里出现了商品资料没有的数字，已整批拦下。请核对商品资料后重试。',
        it: 'Il testo contiene dati non presenti nel prodotto: batch bloccato.'
      },
      AI_TOOLS_PROVIDER_RESPONSE_INVALID: {
        zh: '模型返回格式异常，请重试。',
        it: 'Risposta del modello non valida, riprova.'
      },
      AI_AD_VERSION_CONFLICT: {
        zh: '内容已被其他端更新，请重新加载后再保存。',
        it: 'Contenuto aggiornato altrove: ricarica prima di salvare.'
      },
      AI_AD_STORYBOARD_EMPTY: {
        zh: '分镜为空，至少保留一个镜头。',
        it: 'Storyboard vuoto: serve almeno una scena.'
      },
      AI_AD_SHOT_NOT_FOUND: {
        zh: '镜头不存在或已被其他端删除，请刷新后重试。',
        it: 'Scena inesistente o rimossa altrove: aggiorna e riprova.'
      },
      AI_AD_SHOT_EDIT_INVALID: {
        zh: '请选择一种修改方式，或写一句具体的要求（最多 200 字）。',
        it: 'Scegli una modifica o scrivi una richiesta (max 200 caratteri).'
      },
      AI_AD_PROJECT_NOT_FOUND: {
        zh: '项目不存在或已删除。',
        it: 'Progetto inesistente o eliminato.'
      },
      AI_AD_PRODUCT_NOT_FOUND: {
        zh: '商品不存在或不属于当前商家。',
        it: 'Prodotto inesistente o di un altro negozio.'
      }
    };
    const label = map[code];
    const extra = error.details ? JSON.stringify(error.details).slice(0, 240) : '';
    return {
      code,
      detail: label ? (isIt ? label.it : label.zh) : `${code}${extra ? ` · ${extra}` : ''}`
    };
  }, [copy, isIt]);

  const loadProducts = useCallback(async () => {
    setProductsLoading(true);
    setProductsError(null);
    try {
      const result = await apiGet<{ success: true; products: Product[] }>('/api/merchant/products', 0);
      setProducts(Array.isArray(result.products) ? result.products : []);
    } catch (error) {
      setProductsError(describeError(error).detail);
    } finally {
      setProductsLoading(false);
    }
  }, [describeError]);

  const loadQuota = useCallback(async () => {
    try {
      const result = await apiGet<{ success: true; quota: QuotaSnapshot }>('/api/merchant/ai-tools', 0);
      setQuota(result.quota ?? null);
      setQuotaError(!result.quota);
    } catch {
      // 额度拿不到时如实显示「未获取到额度」，不猜测任何数字。
      setQuota(null);
      setQuotaError(true);
    }
  }, []);

  useEffect(() => {
    void loadProducts();
    void loadQuota();
  }, [loadProducts, loadQuota]);

  const resetAfterProductChange = useCallback(() => {
    setConcepts([]);
    setSelectedConceptKey(null);
    setConceptDetailKey(null);
    setCompareOpen(false);
    setConceptError(null);
    setProject(null);
    setProjectError(null);
    setBudgetEstimate(null);
    setDraftShots([]);
    setSelectedShotId(null);
    setVersions([]);
    setSaveNotice(null);
    setSaveError(null);
    setAutoSaveState('idle');
    setLastAutoSavedVersion(null);
    setEditOpenShotId(null);
    setEditNotice(null);
    setVersionsOpen(false);
  }, []);

  const selectProduct = useCallback(async (next: Product) => {
    setProductId(next.id);
    setBrief(null);
    setBriefError(null);
    setSupplementImages([]);
    setUploadError(null);
    resetAfterProductChange();
    setBriefLoading(true);
    try {
      const result = await apiGet<BriefResponse>(
        `/api/merchant/ai-ad/products/${encodeURIComponent(next.id)}/brief`,
        0
      );
      setBrief(result.brief);
    } catch (error) {
      setBriefError(describeError(error).detail);
    } finally {
      setBriefLoading(false);
    }
  }, [describeError, resetAfterProductChange]);

  const filteredProducts = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return products;
    return products.filter(product => {
      const haystack = [
        product.name,
        product.name_it ?? '',
        product.name_zh ?? '',
        product.styleNo,
        product.category,
        product.subCategory,
        ...(product.skus ?? []).map(sku => `${sku.sku} ${sku.color ?? ''} ${sku.size ?? ''}`)
      ].join(' ').toLowerCase();
      return haystack.includes(keyword);
    });
  }, [products, search]);

  const selectedProduct = useMemo(
    () => products.find(product => product.id === productId) ?? null,
    [products, productId]
  );

  const selectedConcept = useMemo(
    () => concepts.find(concept => concept.conceptKey === selectedConceptKey) ?? null,
    [concepts, selectedConceptKey]
  );

  const projectConcept = useMemo(() => {
    if (!project) return null;
    return project.concepts.find(concept => concept.conceptKey === selectedConceptKey)
      ?? project.concepts.find(concept => concept.id === project.selectedConceptId)
      ?? project.concepts[0]
      ?? null;
  }, [project, selectedConceptKey]);

  const budgetConcept = selectedConcept ?? projectConcept;

  const savedShots = useMemo<AiAdStoryboardShot[]>(
    () => (projectConcept?.storyboard ?? []) as AiAdStoryboardShot[],
    [projectConcept]
  );

  const savedSignature = useMemo(() => JSON.stringify(savedShots), [savedShots]);
  const draftSignature = useMemo(() => JSON.stringify(draftShots), [draftShots]);
  const dirty = draftSignature !== savedSignature;

  useEffect(() => {
    lastSavedSignatureRef.current = savedSignature;
    setDraftShots(savedShots);
    setSelectedShotId(previous => (previous && savedShots.some(shot => shot.shotId === previous) ? previous : null));
  }, [savedSignature, savedShots]);

  const conceptImage = brief?.imageUrls?.[0] ?? null;
  const totalDurationMs = useMemo(() => shotDurationTotal(draftShots), [draftShots]);
  const activeBudget = budgetEstimate ?? budgetConcept?.costEstimate ?? project?.costEstimate ?? null;

  const uploadSupplement = useCallback(async (file: File) => {
    if (supplementImages.length >= 6) {
      setUploadError(copy('最多添加 6 张补充图片', 'Massimo 6 immagini aggiuntive'));
      return;
    }
    setUploading(true);
    setUploadError(null);
    try {
      const uploaded = await uploadMerchantMedia(file, file.type || 'image/jpeg');
      setSupplementImages(previous => (previous.includes(uploaded.url) ? previous : [...previous, uploaded.url]));
    } catch (error) {
      const code = error instanceof Error ? error.message : '';
      setUploadError(code.startsWith('MEDIA_UPLOAD_FAILED')
        ? copy('图片上传失败，请重试', 'Caricamento non riuscito, riprova')
        : copy('图片上传失败，请检查网络', 'Caricamento non riuscito, controlla la rete'));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, [copy, supplementImages.length]);

  const generateConcepts = useCallback(async () => {
    if (!productId) return;
    setConceptsLoading(true);
    setConceptError(null);
    setConcepts([]);
    setSelectedConceptKey(null);
    setConceptDetailKey(null);
    try {
      const result = await apiPost<ConceptsResponse>('/api/merchant/ai-ad/concepts', {
        productId,
        goal,
        language: conceptLanguage,
        aspectRatio,
        resolutionKey
      }, 120_000);
      // 用途映射的首选路线排在最前；排序是本地确定性行为，不额外调用任何供应商。
      const preferredRoute = purposeOption.route;
      const ordered = [...(Array.isArray(result.concepts) ? result.concepts : [])].sort((a, b) => {
        if (a.route === b.route) return 0;
        if (a.route === preferredRoute) return -1;
        if (b.route === preferredRoute) return 1;
        return 0;
      });
      setConcepts(ordered);
      if (result.brief) setBrief(result.brief);
      if (!ordered.length) {
        setConceptError({ code: 'AI_AD_CONCEPTS_INCOMPLETE', detail: copy('没有拿到完整的三套方案，请重试', 'Non sono arrivati tre concetti completi, riprova') });
        return;
      }
      setSelectedConceptKey(ordered[0]?.conceptKey ?? null);
      setStep('concepts');
    } catch (error) {
      const described = describeError(error);
      // 事实校验失败时把服务端给出的具体数字显示出来，让商家知道要改哪项资料。
      const details = error instanceof ApiError ? error.details : undefined;
      const tokens = details && Array.isArray((details as Record<string, unknown>).details)
        ? JSON.stringify((details as Record<string, unknown>).details).slice(0, 200)
        : '';
      setConceptError({
        code: described.code,
        detail: tokens && described.code === 'AI_AD_FACT_UNGROUNDED' ? `${described.detail} ${tokens}` : described.detail
      });
    } finally {
      setConceptsLoading(false);
    }
  }, [aspectRatio, conceptLanguage, copy, describeError, goal, productId, purposeOption.route, resolutionKey]);

  const chooseConcept = useCallback((conceptKey: string) => {
    setSelectedConceptKey(conceptKey);
    setStep('budget');
  }, []);

  const loadVersions = useCallback(async (projectId: string) => {
    setVersionsLoading(true);
    try {
      const result = await apiGet<{ success: true; versions: VersionRow[] }>(
        `/api/merchant/ai-ad/projects/${encodeURIComponent(projectId)}/versions`,
        0
      );
      setVersions(Array.isArray(result.versions) ? result.versions : []);
    } catch {
      // 版本列表失败不影响当前编辑，但也不伪造历史。
      setVersions([]);
    } finally {
      setVersionsLoading(false);
    }
  }, []);

  const createProject = useCallback(async () => {
    if (!productId || !selectedConcept) return;
    setProjectBusy(true);
    setProjectError(null);
    const requestId = clientRequestIdRef.current
      || (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `ad-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    clientRequestIdRef.current = requestId;
    try {
      const result = await apiPost<{ success: true; created: boolean; project: AiAdProjectPayload }>(
        '/api/merchant/ai-ad/projects',
        {
          productId,
          concepts,
          selectedConceptKey: selectedConcept.conceptKey,
          supplementImages,
          clientRequestId: requestId
        },
        30_000
      );
      const created = result.project.concepts.find(concept => concept.conceptKey === selectedConcept.conceptKey)
        ?? result.project.concepts[0]
        ?? null;
      setProject(result.project);
      setSelectedConceptKey(created?.conceptKey ?? selectedConcept.conceptKey);
      setBudgetEstimate(result.project.costEstimate);
      lastSavedSignatureRef.current = JSON.stringify(created?.storyboard ?? []);
      setDraftShots((created?.storyboard ?? []) as AiAdStoryboardShot[]);
      setAutoSaveState('saved');
      setLastAutoSavedVersion(result.project.currentVersionNo);
      setSaveNotice(copy(
        `项目已保存，当前版本 v${result.project.currentVersionNo}`,
        `Progetto salvato, versione v${result.project.currentVersionNo}`
      ));
      setStep('storyboard');
      await loadVersions(result.project.id);
    } catch (error) {
      setProjectError(describeError(error));
    } finally {
      setProjectBusy(false);
    }
  }, [concepts, copy, describeError, loadVersions, productId, selectedConcept, supplementImages]);

  const saveShots = useCallback(async (shots: AiAdStoryboardShot[], note?: string, auto = false) => {
    if (!project || !projectConcept) return;
    const signature = JSON.stringify(shots);
    if (signature === lastSavedSignatureRef.current) {
      if (auto) setAutoSaveState('saved');
      return;
    }
    if (auto) setAutoSaveState('saving');
    else setSaving(true);
    setSaveError(null);
    if (!auto) setSaveNotice(null);
    try {
      const result = await apiPatch<{
        success: true;
        created: boolean;
        project: AiAdProjectPayload;
        storyboard: AiAdStoryboardShot[];
        costEstimate: AiAdCostEstimate;
      }>(`/api/merchant/ai-ad/projects/${encodeURIComponent(project.id)}`, {
        conceptKey: projectConcept.conceptKey,
        storyboard: shots,
        note: note ?? null,
        resolutionKey
      });
      setProject(result.project);
      if (result.costEstimate) setBudgetEstimate(result.costEstimate);
      lastSavedSignatureRef.current = JSON.stringify(result.storyboard ?? shots);
      if (auto) {
        setAutoSaveState('saved');
        setLastAutoSavedVersion(result.project.currentVersionNo);
      } else {
        setSaveNotice(result.created
          ? copy(`已保存为 v${result.project.currentVersionNo}`, `Salvato come v${result.project.currentVersionNo}`)
          : copy('内容与当前版本一致，未产生新版本', 'Contenuto invariato: nessuna nuova versione'));
      }
      await loadVersions(project.id);
    } catch (error) {
      if (auto) setAutoSaveState('error');
      setSaveError(describeError(error));
    } finally {
      if (!auto) setSaving(false);
    }
  }, [copy, describeError, loadVersions, project, projectConcept, resolutionKey]);

  useEffect(() => {
    saveShotsRef.current = saveShots;
  }, [saveShots]);

  // 自动保存：分镜改动后 1.5s 防抖落库；内容哈希一致时服务端不会产生重复版本。
  useEffect(() => {
    if (!project || !projectConcept || !dirty || editBusy) return;
    setAutoSaveState('pending');
    const timer = setTimeout(() => {
      void saveShotsRef.current(draftShots, copy('自动保存', 'Salvataggio automatico'), true);
    }, 1500);
    return () => clearTimeout(timer);
  }, [project, projectConcept, dirty, draftSignature, draftShots, editBusy, copy]);

  const bulkRestore = useCallback(async (version: VersionRow) => {
    if (!project) return;
    if (!Array.isArray(version.storyboard) || version.storyboard.length === 0) {
      setSaveError({ code: 'AI_AD_STORYBOARD_EMPTY', detail: copy('该版本没有可恢复的分镜', 'Questa versione non ha scene recuperabili') });
      return;
    }
    setRestoringVersionNo(version.versionNo);
    try {
      await saveShots(version.storyboard, copy(`恢复 v${version.versionNo}`, `Ripristino v${version.versionNo}`));
    } finally {
      setRestoringVersionNo(null);
    }
  }, [copy, project, saveShots]);

  const updateDraftShot = useCallback((index: number, patch: Partial<AiAdStoryboardShot>) => {
    setDraftShots(previous => previous.map((shot, position) => (position === index ? { ...shot, ...patch } : shot)));
  }, []);

  const moveDraftShot = useCallback((index: number, direction: -1 | 1) => {
    setDraftShots(previous => {
      const target = index + direction;
      if (target < 0 || target >= previous.length) return previous;
      const next = [...previous];
      const [item] = next.splice(index, 1);
      next.splice(target, 0, item);
      return next.map((shot, position) => ({ ...shot, order: position }));
    });
  }, []);

  const reorderDraftShot = useCallback((from: number, to: number) => {
    setDraftShots(previous => {
      if (from === to || from < 0 || to < 0 || from >= previous.length || to >= previous.length) return previous;
      const next = [...previous];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next.map((shot, position) => ({ ...shot, order: position }));
    });
  }, []);

  const addDraftShot = useCallback(() => {
    setDraftShots(previous => {
      if (previous.length >= 24) return previous;
      const nextId = `shot-${Date.now().toString(36)}`;
      return [...previous, {
        shotId: nextId,
        order: previous.length,
        durationMs: 4000,
        framing: 'medium',
        camera: 'static',
        source: 'local_motion',
        visual: copy('补充镜头画面', 'Scena aggiuntiva'),
        voiceover: '',
        subtitle: null,
        transition: 'cut',
        speed: 1,
        crop: 'none',
        position: 'center'
      }];
    });
  }, [copy]);

  const removeDraftShot = useCallback((index: number) => {
    setDraftShots(previous => (previous.length <= 1
      ? previous
      : previous.filter((_, position) => position !== index).map((shot, position) => ({ ...shot, order: position }))));
  }, []);

  const openShotEdit = useCallback((shotId: string) => {
    setEditOpenShotId(previous => (previous === shotId ? null : shotId));
    setEditPreset(null);
    setEditInstruction('');
    setEditError(null);
    setEditNotice(null);
  }, []);

  const applyShotEdit = useCallback(async (shotId: string) => {
    if (!project || !projectConcept) return;
    if (!editPreset && !editInstruction.trim()) {
      setEditError(copy('先选一种修改方式，或写一句具体要求', 'Scegli una modifica o scrivi una richiesta'));
      return;
    }
    setEditBusy(true);
    setEditError(null);
    setEditNotice(null);
    try {
      const result = await apiPost<ShotEditResponse>(
        `/api/merchant/ai-ad/projects/${encodeURIComponent(project.id)}/shots/${encodeURIComponent(shotId)}/edit`,
        {
          conceptKey: projectConcept.conceptKey,
          preset: editPreset ?? undefined,
          instruction: editInstruction.trim() || undefined,
          resolutionKey
        },
        45_000
      );
      setProject(result.project);
      setDraftShots(result.storyboard);
      lastSavedSignatureRef.current = JSON.stringify(result.storyboard);
      setAutoSaveState('saved');
      setLastAutoSavedVersion(result.project.currentVersionNo);
      if (result.costEstimate) setBudgetEstimate(result.costEstimate);
      setEditNotice({ text: result.plan.note, requiresGeneration: result.plan.requiresGeneration });
      setEditInstruction('');
      setSaveNotice(result.created
        ? copy(`已保存为 v${result.project.currentVersionNo}`, `Salvato come v${result.project.currentVersionNo}`)
        : copy('内容与当前版本一致，未产生新版本', 'Contenuto invariato: nessuna nuova versione'));
      await loadVersions(project.id);
    } catch (error) {
      setEditError(describeError(error).detail);
    } finally {
      setEditBusy(false);
    }
  }, [copy, describeError, editInstruction, editPreset, loadVersions, project, projectConcept, resolutionKey]);

  const primaryButton = 'inline-flex items-center justify-center gap-1.5 rounded-xl bg-neutral-900 px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:bg-neutral-300 disabled:text-neutral-500';
  const secondaryButton = 'inline-flex items-center justify-center gap-1.5 rounded-xl border border-neutral-300 bg-white px-3.5 py-2.5 text-xs font-semibold text-neutral-800 transition hover:border-neutral-400 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50';
  const fieldClass = 'w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-xs text-neutral-900 focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900 disabled:bg-neutral-100';
  const labelClass = 'text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-500';

  const generationBlockedReason = copy(
    '视频与配音生成能力尚未接通，当前只保存策划与分镜，不会发起任何生成或计费。',
    'Generazione video e voce non ancora attive: salviamo solo piano e scene, senza addebiti.'
  );

  const autoSaveLabel = (() => {
    if (autoSaveState === 'saving') return copy('保存中…', 'Salvataggio…');
    if (autoSaveState === 'error') return copy('自动保存失败', 'Salvataggio non riuscito');
    if (autoSaveState === 'pending' || dirty) return copy('待保存', 'Da salvare');
    if (autoSaveState === 'saved') {
      return lastAutoSavedVersion
        ? copy(`已保存 v${lastAutoSavedVersion}`, `Salvato v${lastAutoSavedVersion}`)
        : copy('已保存', 'Salvato');
    }
    return copy('已同步', 'Sincronizzato');
  })();

  const stepIndex = STEPS.findIndex(item => item.id === step);

  return (
    <div
      id="modaui-ad-planner"
      className={compact
        ? 'flex min-h-[520px] flex-col gap-3 text-neutral-950'
        : 'mx-auto w-full max-w-[1320px] space-y-5 text-neutral-950'}
    >
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold tracking-tight">{copy('广告工作室', 'Studio ADV')}</h2>
            <span className="rounded-full border border-neutral-300 px-2 py-0.5 text-[10px] font-semibold tracking-[0.12em] text-neutral-500">MODAUI AD</span>
          </div>
          <p className="mt-1 text-[11px] leading-4 text-neutral-500">
            {copy('先出可执行的策划与分镜，生成能力接通后再出片。', 'Prima piano e storyboard: il video arriva quando la generazione sarà attiva.')}
          </p>
        </div>
      </header>

      <p className="text-[11px] leading-4 text-neutral-500">
        {copy(
          '选商品、选用途和平台即可开始；创意、分镜与费用由 MODAUI 自动完成。',
          'Scegli prodotto, obiettivo e piattaforma: creatività, scene e costi li gestisce ModaUI.'
        )}
      </p>

      <nav aria-label={copy('制作步骤', 'Passaggi')} className={compact ? 'flex gap-1 overflow-x-auto pb-1' : 'grid grid-cols-2 gap-2 sm:grid-cols-4'}>
        {STEPS.map((item, index) => {
          const active = item.id === step;
          const done = index < stepIndex;
          const locked = (item.id === 'budget' && !selectedConcept && !projectConcept)
            || (item.id === 'storyboard' && !project);
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setStep(item.id)}
              disabled={locked}
              aria-current={active ? 'step' : undefined}
              className={`flex shrink-0 items-center gap-1.5 rounded-xl border px-2.5 py-2 text-left transition disabled:cursor-not-allowed disabled:opacity-50 ${active
                ? 'border-neutral-900 bg-neutral-900 text-white'
                : done ? 'border-neutral-300 bg-white text-neutral-700' : 'border-neutral-200 bg-neutral-50 text-neutral-500'}`}
            >
              <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${active ? 'bg-white text-neutral-900' : done ? 'bg-neutral-900 text-white' : 'bg-neutral-200 text-neutral-600'}`}>
                {done ? <Check className="h-3 w-3" aria-hidden="true" /> : index + 1}
              </span>
              <span className="whitespace-nowrap text-[11px] font-semibold">{copy(item.zh, item.it)}</span>
            </button>
          );
        })}
      </nav>

      {step === 'product' && (
        <div className={compact ? 'space-y-3' : 'grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_380px]'}>
          <section className="min-w-0 rounded-2xl border border-neutral-200 bg-white p-3 sm:p-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-xs font-bold text-neutral-950">{copy('商品库', 'Prodotti')}</h3>
              <button type="button" onClick={() => { void loadProducts(); }} disabled={productsLoading} className="text-[10px] font-semibold text-neutral-600 underline underline-offset-2 disabled:opacity-40">
                {copy('刷新', 'Aggiorna')}
              </button>
            </div>
            <label className="mt-2 flex items-center gap-1.5 rounded-xl border border-neutral-300 px-2.5 py-2 focus-within:border-neutral-900">
              <Search className="h-3.5 w-3.5 shrink-0 text-neutral-400" aria-hidden="true" />
              <input
                type="search"
                value={search}
                onChange={event => setSearch(event.target.value)}
                placeholder={copy('搜索商品名 / 款号 / SKU', 'Cerca nome / codice / SKU')}
                aria-label={copy('搜索商品', 'Cerca prodotto')}
                className="w-full bg-transparent text-xs text-neutral-900 placeholder:text-neutral-400 focus:outline-none"
              />
            </label>

            {productsError && (
              <div role="alert" className="mt-3 flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs leading-5 text-rose-700">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span>{productsError}</span>
              </div>
            )}

            {productsLoading ? (
              <p className="mt-4 flex items-center gap-2 text-xs text-neutral-500">
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                {copy('正在读取商品库…', 'Caricamento prodotti…')}
              </p>
            ) : products.length === 0 ? (
              <div className="mt-4 rounded-xl border border-dashed border-neutral-300 bg-neutral-50 p-4 text-center">
                <p className="text-xs font-semibold text-neutral-800">{copy('商品库还是空的', 'Nessun prodotto')}</p>
                <p className="mt-1 text-[11px] leading-5 text-neutral-500">
                  {copy('先在「商品」里创建商品，广告方案需要真实商品资料。', 'Crea prima un prodotto: il piano usa solo dati reali.')}
                </p>
              </div>
            ) : filteredProducts.length === 0 ? (
              <p className="mt-4 text-xs text-neutral-500">{copy('没有匹配的商品', 'Nessun prodotto corrispondente')}</p>
            ) : (
              <ul className={compact ? 'mt-3 max-h-[380px] space-y-2 overflow-y-auto pr-1' : 'mt-3 max-h-[560px] space-y-2 overflow-y-auto pr-1'}>
                {filteredProducts.map(product => {
                  const active = product.id === productId;
                  const firstImage = Array.isArray(product.images) ? product.images[0] : undefined;
                  const colors = [...new Set((product.skus ?? []).map(sku => sku.color).filter(Boolean))];
                  return (
                    <li key={product.id}>
                      <button
                        type="button"
                        onClick={() => { void selectProduct(product); }}
                        aria-pressed={active}
                        className={`flex w-full items-center gap-3 rounded-xl border p-2.5 text-left transition ${active ? 'border-neutral-900 bg-neutral-50' : 'border-neutral-200 hover:bg-neutral-50'}`}
                      >
                        {firstImage ? (
                          <img src={firstImage} alt="" loading="lazy" className="h-14 w-11 shrink-0 rounded-lg border border-neutral-200 object-cover" />
                        ) : (
                          <div className="grid h-14 w-11 shrink-0 place-items-center rounded-lg border border-dashed border-neutral-300 bg-neutral-50 text-[10px] text-neutral-400">
                            {copy('无图', 'No img')}
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-bold text-neutral-950">{product.name}</p>
                          <p className="mt-0.5 truncate text-[11px] text-neutral-500">
                            {product.styleNo}
                            <span aria-hidden="true"> · </span>
                            {copy(`${(product.skus ?? []).length} 个 SKU`, `${(product.skus ?? []).length} SKU`)}
                            {colors.length ? <span aria-hidden="true"> · {colors.slice(0, 3).join(' / ')}</span> : null}
                          </p>
                        </div>
                        <span className="shrink-0 text-right text-[11px] font-semibold tabular-nums text-neutral-900">
                          {formatCurrency(
                            typeof product.wholesalePrice === 'number' ? Math.round(product.wholesalePrice * 100) : null,
                            'EUR'
                          ) || copy('未定价', 'Senza prezzo')}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <aside className="min-w-0 space-y-3">
            <section className="rounded-2xl border border-neutral-200 bg-white p-4">
              {!productId ? (
                <p className="text-xs leading-5 text-neutral-500">
                  {copy('从左侧选择一个商品，这里会显示广告可用的事实。', 'Scegli un prodotto: qui vedrai i dati utilizzabili.')}
                </p>
              ) : briefLoading ? (
                <p className="flex items-center gap-2 text-xs text-neutral-500">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                  {copy('正在读取商品资料…', 'Caricamento dati prodotto…')}
                </p>
              ) : briefError ? (
                <div role="alert" className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs leading-5 text-rose-700">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span>{briefError}</span>
                </div>
              ) : brief ? (
                <div className="space-y-3">
                  <div>
                    <h3 className="text-sm font-bold leading-5 text-neutral-950">{brief.name}</h3>
                    <p className="mt-1 text-[11px] text-neutral-500">
                      {selectedProduct?.styleNo ?? brief.productId}
                      {brief.brand ? <span aria-hidden="true"> · {brief.brand}</span> : null}
                    </p>
                  </div>

                  <dl className="grid grid-cols-2 gap-2 text-[11px]">
                    <div className="rounded-lg bg-neutral-50 px-2.5 py-2">
                      <dt className="text-neutral-500">{copy('批发价', 'Prezzo')}</dt>
                      <dd className="mt-0.5 font-semibold tabular-nums text-neutral-900">
                        {formatCurrency(brief.price.minor, brief.price.currency) || copy('未定价', 'Senza prezzo')}
                      </dd>
                    </div>
                    <div className="rounded-lg bg-neutral-50 px-2.5 py-2">
                      <dt className="text-neutral-500">{copy('颜色 / 尺码', 'Colori / taglie')}</dt>
                      <dd className="mt-0.5 font-semibold text-neutral-900">
                        {brief.colors.length || brief.sizes.length
                          ? `${brief.colors.length} / ${brief.sizes.length}`
                          : copy('未提供', 'Non forniti')}
                      </dd>
                    </div>
                  </dl>

                  {brief.imageUrls.length > 0 && (
                    <div className="flex gap-1.5 overflow-x-auto">
                      {brief.imageUrls.slice(0, 4).map(url => (
                        <img key={url} src={url} alt="" loading="lazy" className="h-16 w-12 shrink-0 rounded-lg border border-neutral-200 object-cover" />
                      ))}
                    </div>
                  )}

                  <div>
                    <p className="text-[11px] font-semibold text-neutral-700">{copy('缺失资料', 'Dati mancanti')}</p>
                    {brief.missing.length === 0 ? (
                      <p className="mt-1 text-[11px] text-neutral-500">{copy('广告需要的资料齐全', 'Dati completi per la pubblicità')}</p>
                    ) : (
                      <ul className="mt-1.5 flex flex-wrap gap-1">
                        {brief.missing.map(key => {
                          const label = MISSING_LABELS[key];
                          return (
                            <li key={key} className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                              {label ? (isIt ? label.it : label.zh) : key}
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>

                  <div>
                    <p className="text-[11px] font-semibold text-neutral-700">{copy('补充图片', 'Immagini aggiuntive')}</p>
                    <p className="mt-0.5 text-[10px] leading-4 text-neutral-500">
                      {copy('最多 6 张，随项目保存，生成阶段使用。', 'Fino a 6 immagini, salvate con il progetto.')}
                    </p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      {supplementImages.map(url => (
                        <span key={url} className="relative inline-flex">
                          <img src={url} alt="" className="h-12 w-9 rounded-lg border border-neutral-200 object-cover" />
                          <button
                            type="button"
                            onClick={() => setSupplementImages(previous => previous.filter(item => item !== url))}
                            aria-label={copy('移除补充图片', 'Rimuovi immagine')}
                            className="absolute -right-1.5 -top-1.5 grid h-4 w-4 place-items-center rounded-full border border-neutral-300 bg-white text-neutral-600 hover:bg-neutral-100"
                          >
                            <Trash2 className="h-2.5 w-2.5" aria-hidden="true" />
                          </button>
                        </span>
                      ))}
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploading || supplementImages.length >= 6}
                        className={`${secondaryButton} h-12 w-9 px-0`}
                        aria-label={copy('上传补充图片', 'Carica immagine')}
                      >
                        {uploading
                          ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                          : <ImagePlus className="h-3.5 w-3.5" aria-hidden="true" />}
                      </button>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={event => {
                          const file = event.target.files?.[0];
                          if (file) void uploadSupplement(file);
                        }}
                      />
                    </div>
                    {uploadError && <p role="alert" className="mt-1 text-[10px] text-rose-700">{uploadError}</p>}
                  </div>

                  <div className="rounded-xl border border-neutral-200 bg-neutral-50/70 p-2.5">
                    <p className="text-[11px] font-semibold text-neutral-800">{copy('广告用途', 'Obiettivo')}</p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {PURPOSE_OPTIONS.map(option => {
                        const active = option.id === purpose;
                        return (
                          <button
                            key={option.id}
                            type="button"
                            aria-pressed={active}
                            disabled={!option.ready}
                            title={option.ready ? undefined : copy(option.reasonZh ?? '', option.reasonIt ?? '')}
                            onClick={() => setPurpose(option.id)}
                            className={`rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition disabled:cursor-not-allowed disabled:border-neutral-200 disabled:bg-neutral-100 disabled:text-neutral-400 ${active
                              ? 'border-neutral-900 bg-neutral-900 text-white'
                              : 'border-neutral-300 bg-white text-neutral-700 hover:border-neutral-400'}`}
                          >
                            {copy(option.zh, option.it)}
                            {option.ready ? null : <span className="ml-1 text-[10px] font-normal">{copy('未接通', 'non attivo')}</span>}
                          </button>
                        );
                      })}
                    </div>

                    <p className="mt-2.5 text-[11px] font-semibold text-neutral-800">{copy('发布平台', 'Piattaforma')}</p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {PLATFORM_OPTIONS.map(option => {
                        const active = option.id === platform;
                        return (
                          <button
                            key={option.id}
                            type="button"
                            aria-pressed={active}
                            onClick={() => setPlatform(option.id)}
                            className={`rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition ${active
                              ? 'border-neutral-900 bg-neutral-900 text-white'
                              : 'border-neutral-300 bg-white text-neutral-700 hover:border-neutral-400'}`}
                          >
                            {copy(option.zh, option.it)}
                          </button>
                        );
                      })}
                    </div>

                    <p className="mt-2 flex items-start gap-1 text-[10px] leading-4 text-neutral-500">
                      <Lock className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
                      {copy(
                        `按 ${aspectRatio} 输出；平台发布尚未接通，本次只生成工程与素材。`,
                        `Output ${aspectRatio}; pubblicazione non ancora attiva.`
                      )}
                    </p>
                  </div>

                  {!compact && (
                    <button
                      type="button"
                      onClick={() => { void generateConcepts(); }}
                      disabled={conceptsLoading}
                      className={`${primaryButton} w-full`}
                    >
                      {conceptsLoading
                        ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                        : <Wand2 className="h-3.5 w-3.5" aria-hidden="true" />}
                      {copy('生成三套方案', 'Genera tre proposte')}
                    </button>
                  )}
                </div>
              ) : null}
            </section>
          </aside>
        </div>
      )}

      {step === 'concepts' && (
        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="min-w-0 truncate text-xs text-neutral-500">
              {brief?.name}
              {selectedConceptKey ? <span aria-hidden="true"> · {copy('已选一套，可继续比较', 'Una scelta, puoi ancora confrontare')}</span> : null}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCompareOpen(open => !open)}
                aria-pressed={compareOpen}
                disabled={concepts.length === 0}
                className={secondaryButton}
              >
                <LayoutGrid className="h-3.5 w-3.5" aria-hidden="true" />
                {compareOpen ? copy('看卡片', 'Vedi schede') : copy('并排对比', 'Confronta')}
              </button>
              <button
                type="button"
                onClick={() => { void generateConcepts(); }}
                disabled={conceptsLoading}
                className={secondaryButton}
              >
                {conceptsLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <Wand2 className="h-3.5 w-3.5" aria-hidden="true" />}
                {copy('重新生成', 'Rigenera')}
              </button>
            </div>
          </div>

          {conceptsLoading && (
            <div role="status" className="flex items-center gap-2 rounded-2xl border border-neutral-200 bg-white px-4 py-6 text-xs text-neutral-600">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              {copy('正在用一次模型调用生成三套方案…', 'Una sola chiamata al modello per tre proposte…')}
            </div>
          )}

          {conceptError && (
            <div role="alert" className="space-y-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs leading-5 text-rose-700">
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{conceptError.detail}</span>
              </div>
              <button type="button" onClick={() => { void generateConcepts(); }} className="ml-6 text-[11px] font-semibold underline underline-offset-2">
                {copy('重试', 'Riprova')}
              </button>
            </div>
          )}

          {!conceptsLoading && concepts.length === 0 && !conceptError && (
            <div className="rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 px-4 py-6 text-center">
              <p className="text-xs font-semibold text-neutral-800">{copy('还没有生成方案', 'Nessuna proposta generata')}</p>
              <p className="mt-1 text-[11px] leading-5 text-neutral-500">
                {copy('回到上一步选商品，或点「重新生成」让 MODAUI 基于商品资料给出三套方向。', 'Torna al prodotto o premi Rigenera: ModaUI crea tre direzioni dai dati reali.')}
              </p>
            </div>
          )}

          {concepts.length > 0 && compareOpen && (
            <div className="overflow-x-auto rounded-2xl border border-neutral-200 bg-white">
              <table className="w-full min-w-[720px] border-collapse text-left text-[11px]">
                <caption className="sr-only">{copy('三套方案并排对比', 'Confronto delle tre proposte')}</caption>
                <thead>
                  <tr className="border-b border-neutral-200 bg-neutral-50">
                    <th scope="col" className="sticky left-0 z-10 bg-neutral-50 px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-neutral-500">{copy('对比项', 'Voce')}</th>
                    {concepts.map(concept => (
                      <th key={concept.conceptKey} scope="col" className="px-3 py-2 text-[11px] font-bold text-neutral-900">
                        {ROUTE_NAMES[concept.route] ?? concept.route}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {([
                    { key: 'hook', label: copy('钩子', 'Hook') },
                    { key: 'duration', label: copy('时长', 'Durata') },
                    { key: 'shots', label: copy('镜头数', 'Scene') },
                    { key: 'aspect', label: copy('画幅', 'Formato') },
                    { key: 'video', label: copy('视频能力', 'Video') },
                    { key: 'voice', label: copy('配音能力', 'Voce') },
                    { key: 'budget', label: copy('预算', 'Budget') }
                  ] as const).map(row => (
                    <tr key={row.key}>
                      <th scope="row" className="sticky left-0 z-10 whitespace-nowrap bg-white px-3 py-2 font-semibold text-neutral-500">{row.label}</th>
                      {concepts.map(concept => {
                        const video = STATUS_LABELS[concept.providerStatus.video];
                        const voice = STATUS_LABELS[concept.providerStatus.voice];
                        const value = row.key === 'hook' ? `“${concept.hook}”`
                          : row.key === 'duration' ? formatDuration(concept.durationMs)
                          : row.key === 'shots' ? `${concept.storyboard.length}`
                          : row.key === 'aspect' ? concept.aspectRatio
                          : row.key === 'video' ? (video ? copy(video.zh, video.it) : concept.providerStatus.video)
                          : row.key === 'voice' ? (voice ? copy(voice.zh, voice.it) : concept.providerStatus.voice)
                          : formatUsd(concept.costEstimate.amountUsd) ?? copy('未配置价格', 'Prezzo non configurato');
                        return <td key={concept.conceptKey} className="px-3 py-2 align-top text-neutral-700">{value}</td>;
                      })}
                    </tr>
                  ))}
                  <tr>
                    <th scope="row" className="sticky left-0 z-10 bg-white px-3 py-2 font-semibold text-neutral-500">{copy('选择', 'Scegli')}</th>
                    {concepts.map(concept => (
                      <td key={concept.conceptKey} className="px-3 py-2">
                        <button
                          type="button"
                          onClick={() => chooseConcept(concept.conceptKey)}
                          aria-pressed={concept.conceptKey === selectedConceptKey}
                          className={`rounded-lg px-2.5 py-1 text-[10px] font-semibold ${concept.conceptKey === selectedConceptKey ? 'bg-neutral-900 text-white' : 'border border-neutral-300 text-neutral-800 hover:bg-neutral-50'}`}
                        >
                          {concept.conceptKey === selectedConceptKey ? copy('已选', 'Scelto') : copy('选这套', 'Scegli')}
                        </button>
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {concepts.length > 0 && !compareOpen && (
            <ul className={`grid gap-3 ${compact ? '' : 'lg:grid-cols-3'}`}>
              {concepts.map(concept => {
                const active = concept.conceptKey === selectedConceptKey;
                const detailOpen = conceptDetailKey === concept.conceptKey;
                const videoStatus = STATUS_LABELS[concept.providerStatus.video];
                const voiceStatus = STATUS_LABELS[concept.providerStatus.voice];
                return (
                  <li key={concept.conceptKey} className={`flex min-w-0 flex-col rounded-2xl border bg-white p-3 ${active ? 'border-neutral-900 shadow-sm' : 'border-neutral-200'}`}>
                    <div className="relative overflow-hidden rounded-xl border border-neutral-200 bg-neutral-100">
                      {conceptImage ? (
                        <img src={conceptImage} alt="" loading="lazy" className="h-40 w-full object-cover" />
                      ) : (
                        <div className="flex h-40 flex-col items-center justify-center gap-1 text-neutral-400">
                          <ImagePlus className="h-5 w-5" aria-hidden="true" />
                          <span className="text-[10px]">{copy('该商品没有实拍图', 'Nessuna foto reale')}</span>
                        </div>
                      )}
                      <span className="absolute left-2 top-2 rounded-full bg-white/95 px-2 py-0.5 text-[10px] font-semibold text-neutral-700">
                        {copy('商品实拍参考', 'Foto prodotto reale')}
                      </span>
                      <span className="absolute right-2 top-2 rounded-full bg-neutral-900/85 px-2 py-0.5 text-[10px] font-semibold tabular-nums text-white">
                        {formatDuration(concept.durationMs)}
                      </span>
                    </div>

                    <div className="mt-2.5 flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="text-sm font-bold text-neutral-950">{ROUTE_NAMES[concept.route] ?? concept.route}</h3>
                        <p className="mt-0.5 text-[11px] leading-4 text-neutral-500">
                          {(() => {
                            const hint = ROUTE_HINTS[concept.route];
                            return hint ? (isIt ? hint.it : hint.zh) : '';
                          })()}
                        </p>
                      </div>
                      {active && (
                        <span className="shrink-0 rounded-full bg-neutral-900 px-2 py-0.5 text-[10px] font-semibold text-white">{copy('已选', 'Scelto')}</span>
                      )}
                    </div>

                    <p className="mt-2 text-xs font-semibold leading-5 text-neutral-900">“{concept.hook}”</p>

                    <dl className="mt-2 grid grid-cols-2 gap-1.5 text-[10px]">
                      <div className="rounded-lg bg-neutral-50 px-2 py-1.5">
                        <dt className="text-neutral-500">{copy('镜头', 'Scene')}</dt>
                        <dd className="font-semibold tabular-nums text-neutral-900">{concept.storyboard.length}</dd>
                      </div>
                      <div className="rounded-lg bg-neutral-50 px-2 py-1.5">
                        <dt className="text-neutral-500">{copy('语言 / 画幅', 'Lingua / formato')}</dt>
                        <dd className="font-semibold text-neutral-900">{concept.language} · {concept.aspectRatio}</dd>
                      </div>
                    </dl>

                    <div className="mt-2.5">
                      <p className="text-[10px] font-bold uppercase tracking-wide text-neutral-400">{copy('镜头预览', 'Anteprima scene')}</p>
                      <ol className="mt-1 space-y-1">
                        {concept.storyboard.slice(0, 3).map((shot, index) => (
                          <li key={shot.shotId} className="flex gap-1.5 text-[11px] leading-4 text-neutral-600">
                            <span className="shrink-0 tabular-nums text-neutral-400">{index + 1}</span>
                            <span className="line-clamp-2 min-w-0">{shot.visual}</span>
                          </li>
                        ))}
                      </ol>
                    </div>

                    <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-neutral-500">
                      <span className={videoStatus?.ready ? 'text-emerald-700' : ''}>
                        {copy('视频', 'Video')}：{videoStatus ? (isIt ? videoStatus.it : videoStatus.zh) : concept.providerStatus.video}
                      </span>
                      <span className={voiceStatus?.ready ? 'text-emerald-700' : ''}>
                        {copy('配音', 'Voce')}：{voiceStatus ? (isIt ? voiceStatus.it : voiceStatus.zh) : concept.providerStatus.voice}
                      </span>
                    </p>

                    <p className="mt-2 flex items-baseline justify-between gap-2 border-t border-neutral-100 pt-2">
                      <span className="text-[10px] text-neutral-500">{copy('预计生成费用', 'Costo stimato')}</span>
                      <span className="text-xs font-bold tabular-nums text-neutral-950">
                        {formatUsd(concept.costEstimate.amountUsd) ?? copy('未配置价格', 'Prezzo non configurato')}
                      </span>
                    </p>

                    <button
                      type="button"
                      onClick={() => setConceptDetailKey(detailOpen ? null : concept.conceptKey)}
                      aria-expanded={detailOpen}
                      className="mt-2 flex w-full items-center justify-between gap-2 rounded-lg border border-neutral-200 px-2.5 py-1.5 text-[10px] font-semibold text-neutral-700 hover:bg-neutral-50"
                    >
                      {detailOpen ? copy('收起详情', 'Chiudi dettaglio') : copy('查看完整脚本', 'Vedi script completo')}
                      {detailOpen ? <ChevronUp className="h-3 w-3" aria-hidden="true" /> : <ChevronDown className="h-3 w-3" aria-hidden="true" />}
                    </button>

                    {detailOpen && (
                      <div className="mt-2 space-y-2 rounded-xl bg-neutral-50 p-2.5">
                        <p className="text-[11px] leading-4 text-neutral-600">
                          <span className="font-semibold text-neutral-800">{copy('受众', 'Pubblico')}：</span>{concept.audience}
                        </p>
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wide text-neutral-400">{copy('配音文案', 'Voce')}</p>
                          <ol className="mt-1 space-y-1">
                            {concept.script.filter(scene => scene.voiceover.trim()).map(scene => (
                              <li key={scene.scene} className="text-[11px] leading-4 text-neutral-600">{scene.voiceover}</li>
                            ))}
                          </ol>
                        </div>
                        <div className="flex flex-wrap items-center gap-1 text-[10px]">
                          <span className="rounded-full bg-neutral-900 px-2 py-0.5 font-semibold text-white">{concept.cta}</span>
                          {concept.hashtags.slice(0, 3).map(tag => (
                            <span key={tag} className="rounded-full border border-neutral-200 bg-white px-2 py-0.5 text-neutral-600">#{tag.replace(/^#/, '')}</span>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="mt-2 flex-1" />
                    <button
                      type="button"
                      onClick={() => chooseConcept(concept.conceptKey)}
                      aria-pressed={active}
                      className={`${active ? secondaryButton : primaryButton} mt-2 w-full`}
                    >
                      {active ? copy('已选择，查看预算', 'Scelto, vedi budget') : copy('选择此方案', 'Scegli questa proposta')}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}

      {step === 'budget' && (() => {
        const concept = budgetConcept;
        if (!concept) {
          return (
            <div className="rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 px-4 py-6 text-center text-xs text-neutral-600">
              {copy('还没有选择方案', 'Nessuna proposta scelta')}
            </div>
          );
        }
        const estimate = activeBudget ?? concept.costEstimate;
        const providerStatus = concept.providerStatus;
        const totalLabel = formatUsd(estimate.amountUsd);
        return (
          <div className={compact ? 'space-y-3' : 'grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]'}>
            <section className="min-w-0 space-y-4 rounded-2xl border border-neutral-200 bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-neutral-950">{ROUTE_NAMES[concept.route] ?? concept.route}</h3>
                  <p className="mt-0.5 text-[11px] leading-4 text-neutral-500">{concept.title}</p>
                </div>
                <div className="flex flex-wrap gap-1 text-[10px] text-neutral-600">
                  <span className="rounded-full border border-neutral-200 px-2 py-0.5 tabular-nums">{formatDuration(concept.durationMs)}</span>
                  <span className="rounded-full border border-neutral-200 px-2 py-0.5">{concept.language}</span>
                  <span className="rounded-full border border-neutral-200 px-2 py-0.5">{concept.aspectRatio}</span>
                  {project && <span className="rounded-full bg-neutral-900 px-2 py-0.5 font-semibold text-white">v{project.currentVersionNo}</span>}
                </div>
              </div>

              <div>
                <h4 className="text-xs font-bold text-neutral-950">{copy('生成能力', 'Capacità di generazione')}</h4>
                <ul className="mt-2 grid gap-2 sm:grid-cols-2">
                  {(['text', 'video', 'voice', 'digitalHuman'] as const).map(service => {
                    const status = providerStatus[service];
                    const label = STATUS_LABELS[status];
                    return (
                      <li key={service} className="flex items-center justify-between gap-2 rounded-lg border border-neutral-200 px-2.5 py-2">
                        <span className="text-[11px] font-semibold text-neutral-800">
                          {SERVICE_LABELS[service] ? copy(SERVICE_LABELS[service].zh, SERVICE_LABELS[service].it) : service}
                        </span>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${label?.ready ? 'bg-emerald-50 text-emerald-700' : 'bg-neutral-100 text-neutral-500'}`}>
                          {label ? copy(label.zh, label.it) : status}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>

              <div>
                <h4 className="text-xs font-bold text-neutral-950">{copy('费用明细', 'Dettaglio costi')}</h4>
                <ul className="mt-2 divide-y divide-neutral-100 rounded-xl border border-neutral-200">
                  {estimate.lines.map((line, index) => {
                    const label = STATUS_LABELS[line.status];
                    return (
                      <li key={`${line.kind}-${index}`} className="flex items-start justify-between gap-3 px-3 py-2">
                        <div className="min-w-0">
                          <p className="text-[11px] font-semibold text-neutral-800">{line.label}</p>
                          <p className="mt-0.5 truncate text-[10px] text-neutral-500">
                            {line.modelId ?? copy('未配置模型', 'Modello non configurato')}
                            {typeof line.seconds === 'number' ? <span aria-hidden="true"> · {line.seconds}s</span> : null}
                            {typeof line.characters === 'number' ? <span aria-hidden="true"> · {line.characters} 字</span> : null}
                          </p>
                          {line.note && <p className="mt-0.5 text-[10px] leading-4 text-neutral-500">{line.note}</p>}
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-[11px] font-semibold tabular-nums text-neutral-900">
                            {formatUsd(line.amountUsd) ?? copy('未配置价格', 'Prezzo non configurato')}
                          </p>
                          {!label?.ready && <p className="text-[10px] text-neutral-400">{label ? copy(label.zh, label.it) : line.status}</p>}
                        </div>
                      </li>
                    );
                  })}
                </ul>
                <p className="mt-1.5 text-[10px] leading-4 text-neutral-500">
                  {copy('单价来自服务端模型目录，本阶段不调用视频或配音供应商，因此不会产生费用。', 'Prezzi dal catalogo server: nessun fornitore video/voce viene chiamato in questa fase.')}
                </p>
              </div>

            </section>

            <aside className="min-w-0 space-y-3">
              <section className="rounded-2xl border border-neutral-900 bg-neutral-950 p-4 text-white">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-neutral-400">{copy('预计生成费用', 'Costo stimato')}</p>
                <p className="mt-1 text-2xl font-bold tabular-nums">{totalLabel ?? copy('未配置价格', 'Prezzo non configurato')}</p>
                <p className="mt-1 text-[10px] leading-4 text-neutral-400">
                  {estimate.status === 'priced'
                    ? copy(`按 ${estimate.resolutionKey} 估算，未含税。`, `Stima a ${estimate.resolutionKey}, tasse escluse.`)
                    : copy('部分能力缺少单价或模型，费用不完整。', 'Mancano prezzi o modelli: costo incompleto.')}
                </p>
              </section>

              <section className="rounded-2xl border border-neutral-200 bg-white p-4">
                <h4 className="text-xs font-bold text-neutral-950">{copy('AI 调用额度', 'Quota AI')}</h4>
                {quotaError || !quota ? (
                  <p className="mt-1 text-[11px] text-neutral-500">{copy('未获取到额度', 'Quota non disponibile')}</p>
                ) : (
                  <dl className="mt-2 grid grid-cols-2 gap-2 text-[11px]">
                    <div className="rounded-lg bg-neutral-50 px-2.5 py-2">
                      <dt className="text-neutral-500">{copy('今日剩余', 'Oggi')}</dt>
                      <dd className="mt-0.5 font-semibold tabular-nums text-neutral-900">{quota.remaining.daily} / {quota.limits.dailyCalls}</dd>
                    </div>
                    <div className="rounded-lg bg-neutral-50 px-2.5 py-2">
                      <dt className="text-neutral-500">{copy('本月剩余', 'Mese')}</dt>
                      <dd className="mt-0.5 font-semibold tabular-nums text-neutral-900">{quota.remaining.monthly} / {quota.limits.monthlyCalls}</dd>
                    </div>
                  </dl>
                )}
              </section>

              {projectError && (
                <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] leading-4 text-rose-700">{projectError.detail}</p>
              )}

              <button
                type="button"
                onClick={() => {
                  if (!project) void createProject();
                  else setStep('storyboard');
                }}
                disabled={projectBusy}
                className={`${primaryButton} w-full`}
              >
                {projectBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <Check className="h-3.5 w-3.5" aria-hidden="true" />}
                {project ? copy('进入分镜编辑', 'Vai allo storyboard') : copy('保存项目并进入分镜', 'Salva e vai allo storyboard')}
              </button>

              <div className="rounded-2xl border border-neutral-200 bg-white p-3">
                <button
                  type="button"
                  disabled
                  aria-describedby="modaui-ad-generation-unavailable"
                  className={`${primaryButton} w-full`}
                >
                  <Lock className="h-3.5 w-3.5" aria-hidden="true" />
                  {copy('开始生成视频（暂未接通）', 'Genera video (non attivo)')}
                </button>
                <p id="modaui-ad-generation-unavailable" className="mt-2 text-[10px] leading-4 text-neutral-500">
                  {generationBlockedReason}
                </p>
              </div>
            </aside>
          </div>
        );
      })()}

      {step === 'storyboard' && (() => {
        if (!project || !projectConcept) {
          return (
            <div className="rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 px-4 py-6 text-center text-xs text-neutral-600">
              {copy('先在预算页保存项目，才能编辑分镜', 'Salva il progetto dal budget per modificare le scene')}
            </div>
          );
        }

        const renderShot = (shot: AiAdStoryboardShot, index: number) => {
          const isEditing = editOpenShotId === shot.shotId;
          const isSelected = selectedShotId === shot.shotId;
          return (
            <li
              key={shot.shotId}
              id={`modaui-ad-shot-${shot.shotId}`}
              draggable={!compact}
              onDragStart={() => setDraggingIndex(index)}
              onDragOver={event => { event.preventDefault(); setDragOverIndex(index); }}
              onDrop={event => {
                event.preventDefault();
                if (draggingIndex !== null) reorderDraftShot(draggingIndex, index);
                setDraggingIndex(null);
                setDragOverIndex(null);
              }}
              onDragEnd={() => { setDraggingIndex(null); setDragOverIndex(null); }}
              className={`space-y-2 rounded-xl border bg-white p-2.5 transition ${isSelected ? 'border-neutral-900' : 'border-neutral-200'} ${dragOverIndex === index && draggingIndex !== null && draggingIndex !== index ? 'border-dashed border-neutral-500 bg-neutral-50' : ''}`}
            >
              <div className="flex items-center justify-between gap-1">
                <div className="flex min-w-0 items-center gap-1.5">
                  {!compact && <GripVertical className="h-3.5 w-3.5 shrink-0 cursor-grab text-neutral-300" aria-hidden="true" />}
                  <button
                    type="button"
                    onClick={() => setSelectedShotId(isSelected ? null : shot.shotId)}
                    aria-pressed={isSelected}
                    className={`flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-bold tabular-nums ${isSelected ? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-700'}`}
                    aria-label={copy(`选择镜头 ${index + 1}`, `Seleziona scena ${index + 1}`)}
                  >
                    {index + 1}
                  </button>
                  <span className="truncate text-[10px] text-neutral-500">
                    {(() => {
                      const framing = FRAMING_LABELS[shot.framing];
                      const camera = CAMERA_LABELS[shot.camera];
                      return [framing ? copy(framing.zh, framing.it) : shot.framing, camera ? copy(camera.zh, camera.it) : shot.camera].join(' · ');
                    })()}
                  </span>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <label className="flex items-center gap-1 text-[10px] text-neutral-500">
                    {copy('时长', 'Durata')}
                    <input
                      type="number"
                      min={0.5}
                      max={30}
                      step={0.5}
                      value={Math.round(shot.durationMs / 100) / 10}
                      onChange={event => {
                        const seconds = Number(event.target.value);
                        if (!Number.isFinite(seconds)) return;
                        updateDraftShot(index, { durationMs: Math.round(Math.min(Math.max(seconds, 0.5), 30) * 1000) });
                      }}
                      className="w-14 rounded-md border border-neutral-300 px-1.5 py-0.5 text-[11px] tabular-nums focus:border-neutral-900 focus:outline-none"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => moveDraftShot(index, -1)}
                    disabled={index === 0}
                    aria-label={copy('上移', 'Sposta su')}
                    className="rounded-md border border-neutral-300 p-1 text-neutral-600 hover:bg-neutral-50 disabled:opacity-30"
                  >
                    <ArrowUp className="h-3 w-3" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveDraftShot(index, 1)}
                    disabled={index === draftShots.length - 1}
                    aria-label={copy('下移', 'Sposta giù')}
                    className="rounded-md border border-neutral-300 p-1 text-neutral-600 hover:bg-neutral-50 disabled:opacity-30"
                  >
                    <ArrowDown className="h-3 w-3" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeDraftShot(index)}
                    disabled={draftShots.length <= 1}
                    aria-label={copy('删除镜头', 'Elimina scena')}
                    className="rounded-md border border-neutral-300 p-1 text-neutral-600 hover:bg-neutral-50 disabled:opacity-30"
                  >
                    <Trash2 className="h-3 w-3" aria-hidden="true" />
                  </button>
                </div>
              </div>

              <label className="block space-y-1">
                <span className={labelClass}>{copy('画面', 'Immagine')}</span>
                <textarea
                  value={shot.visual}
                  rows={2}
                  onChange={event => updateDraftShot(index, { visual: event.target.value })}
                  className={`${fieldClass} resize-y leading-5`}
                />
              </label>

              <div className="grid gap-2 sm:grid-cols-2">
                <label className="block space-y-1">
                  <span className={labelClass}>{copy('配音', 'Voce')}</span>
                  <input
                    type="text"
                    value={shot.voiceover}
                    onChange={event => updateDraftShot(index, { voiceover: event.target.value })}
                    className={fieldClass}
                  />
                </label>
                <label className="block space-y-1">
                  <span className={labelClass}>{copy('字幕', 'Sottotitolo')}</span>
                  <input
                    type="text"
                    value={shot.subtitle ?? ''}
                    onChange={event => updateDraftShot(index, { subtitle: event.target.value.trim() ? event.target.value : null })}
                    className={fieldClass}
                  />
                </label>
              </div>

              {editorLayer === 'pro' && (
                <div className="grid grid-cols-2 gap-2 rounded-lg bg-neutral-50 p-2 sm:grid-cols-4">
                  <label className="space-y-1">
                    <span className={labelClass}>{copy('景别', 'Inquadratura')}</span>
                    <select value={shot.framing} onChange={event => updateDraftShot(index, { framing: event.target.value as AiAdStoryboardShot['framing'] })} className={fieldClass}>
                      {(['wide', 'medium', 'close', 'macro'] as const).map(key => (
                        <option key={key} value={key}>{copy(FRAMING_LABELS[key].zh, FRAMING_LABELS[key].it)}</option>
                      ))}
                    </select>
                  </label>
                  <label className="space-y-1">
                    <span className={labelClass}>{copy('运镜', 'Movimento')}</span>
                    <select value={shot.camera} onChange={event => updateDraftShot(index, { camera: event.target.value as AiAdStoryboardShot['camera'] })} className={fieldClass}>
                      {(['static', 'push_in', 'pan', 'orbit'] as const).map(key => (
                        <option key={key} value={key}>{copy(CAMERA_LABELS[key].zh, CAMERA_LABELS[key].it)}</option>
                      ))}
                    </select>
                  </label>
                  <label className="space-y-1">
                    <span className={labelClass}>{copy('素材', 'Fonte')}</span>
                    <select value={shot.source} onChange={event => updateDraftShot(index, { source: event.target.value as AiAdStoryboardShot['source'] })} className={fieldClass}>
                      {(['product_image', 'local_motion', 'ai_video'] as const).map(key => (
                        <option key={key} value={key}>{copy(SOURCE_LABELS[key].zh, SOURCE_LABELS[key].it)}</option>
                      ))}
                    </select>
                  </label>
                  <label className="space-y-1">
                    <span className={labelClass}>{copy('转场', 'Transizione')}</span>
                    <select value={shot.transition ?? 'cut'} onChange={event => updateDraftShot(index, { transition: event.target.value as NonNullable<AiAdStoryboardShot['transition']> })} className={fieldClass}>
                      {(['cut', 'fade', 'slide'] as const).map(key => (
                        <option key={key} value={key}>{copy(TRANSITION_LABELS[key].zh, TRANSITION_LABELS[key].it)}</option>
                      ))}
                    </select>
                  </label>
                  <label className="space-y-1">
                    <span className={labelClass}>{copy('速度', 'Velocità')}</span>
                    <input
                      type="number"
                      min={0.5}
                      max={2}
                      step={0.1}
                      value={shotSpeed(shot)}
                      onChange={event => {
                        const value = Number(event.target.value);
                        if (!Number.isFinite(value)) return;
                        updateDraftShot(index, { speed: Math.round(Math.min(Math.max(value, 0.5), 2) * 10) / 10 });
                      }}
                      className={fieldClass}
                    />
                  </label>
                  <label className="space-y-1">
                    <span className={labelClass}>{copy('裁切', 'Ritaglio')}</span>
                    <select value={shot.crop ?? 'none'} onChange={event => updateDraftShot(index, { crop: event.target.value as NonNullable<AiAdStoryboardShot['crop']> })} className={fieldClass}>
                      {(['none', 'tight', 'wide'] as const).map(key => (
                        <option key={key} value={key}>{copy(CROP_LABELS[key].zh, CROP_LABELS[key].it)}</option>
                      ))}
                    </select>
                  </label>
                  <label className="space-y-1">
                    <span className={labelClass}>{copy('画面位置', 'Posizione')}</span>
                    <select value={shot.position ?? 'center'} onChange={event => updateDraftShot(index, { position: event.target.value as NonNullable<AiAdStoryboardShot['position']> })} className={fieldClass}>
                      {(['center', 'top', 'bottom'] as const).map(key => (
                        <option key={key} value={key}>{copy(POSITION_LABELS[key].zh, POSITION_LABELS[key].it)}</option>
                      ))}
                    </select>
                  </label>
                </div>
              )}

              {shot.directionNote && (
                <p className="rounded-lg bg-amber-50 px-2 py-1.5 text-[10px] leading-4 text-amber-800">
                  {copy('修改要求', 'Richiesta')}：{shot.directionNote}
                </p>
              )}

              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => openShotEdit(shot.shotId)}
                  aria-expanded={isEditing}
                  className={`${secondaryButton} px-2.5 py-1.5`}
                >
                  <Wand2 className="h-3 w-3" aria-hidden="true" />
                  {copy('修改这个镜头', 'Modifica scena')}
                </button>
                <button
                  type="button"
                  disabled
                  title={generationBlockedReason}
                  className="inline-flex items-center gap-1 rounded-xl border border-neutral-200 px-2.5 py-1.5 text-[10px] font-semibold text-neutral-400"
                >
                  <Film className="h-3 w-3" aria-hidden="true" />
                  {copy('重新生成此镜头（未接通）', 'Rigenera scena (non attivo)')}
                </button>
                <span className="ml-auto text-[10px] text-neutral-400">{autoSaveLabel}</span>
              </div>

              {isEditing && (
                <div className="space-y-2 rounded-xl border border-neutral-900 bg-neutral-50 p-2.5">
                  <p className="text-[11px] font-semibold text-neutral-900">
                    {copy(`修改镜头 ${index + 1}`, `Modifica scena ${index + 1}`)}
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {SHOT_EDIT_PRESETS.map(preset => (
                      <button
                        key={preset.id}
                        type="button"
                        aria-pressed={editPreset === preset.id}
                        onClick={() => {
                          setEditPreset(previous => (previous === preset.id ? null : preset.id));
                          setEditError(null);
                        }}
                        className={`rounded-full border px-2 py-1 text-[10px] font-semibold transition ${editPreset === preset.id ? 'border-neutral-900 bg-neutral-900 text-white' : 'border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-100'}`}
                      >
                        {copy(preset.zh, preset.it)}
                      </button>
                    ))}
                  </div>
                  <label className="block space-y-1">
                    <span className={labelClass}>{copy('或用一句话说明', 'Oppure descrivi a parole')}</span>
                    <textarea
                      value={editInstruction}
                      rows={2}
                      maxLength={200}
                      onChange={event => setEditInstruction(event.target.value)}
                      placeholder={copy('例如：把面料细节推近，背景更干净', 'Es: avvicina il dettaglio del tessuto, sfondo più pulito')}
                      className={`${fieldClass} resize-y leading-5`}
                    />
                    <span className="block text-right text-[10px] tabular-nums text-neutral-400">{editInstruction.length}/200</span>
                  </label>
                  {editError && <p role="alert" className="text-[10px] leading-4 text-rose-700">{editError}</p>}
                  {editNotice && (
                    <p role="status" className={`rounded-lg px-2 py-1.5 text-[10px] leading-4 ${editNotice.requiresGeneration ? 'bg-amber-100 text-amber-800' : 'bg-emerald-50 text-emerald-800'}`}>
                      {editNotice.text}
                      {editNotice.requiresGeneration
                        ? copy('（只记录了修改方向，画面尚未重新生成）', ' (solo direzione registrata, immagine non rigenerata)')
                        : ''}
                    </p>
                  )}
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => { void applyShotEdit(shot.shotId); }}
                      disabled={editBusy || (!editPreset && !editInstruction.trim())}
                      className={`${primaryButton} px-3 py-1.5`}
                    >
                      {editBusy ? <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" /> : <Wand2 className="h-3 w-3" aria-hidden="true" />}
                      {copy('应用修改', 'Applica')}
                    </button>
                    <button type="button" onClick={() => openShotEdit(shot.shotId)} className={`${secondaryButton} px-3 py-1.5`}>
                      {copy('关闭', 'Chiudi')}
                    </button>
                    <span className="text-[10px] leading-4 text-neutral-500">
                      {copy('快捷修改走本地规则，不调用付费模型。', 'Le modifiche rapide usano regole locali, senza costi.')}
                    </span>
                  </div>
                </div>
              )}
            </li>
          );
        };

        return (
          <div className={compact ? 'space-y-3' : 'grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]'}>
            <section className="min-w-0 space-y-3">
              <div className="rounded-2xl border border-neutral-200 bg-white p-3 sm:p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-bold text-neutral-950">{project.title}</h3>
                    <p className="mt-0.5 text-[11px] text-neutral-500">
                      {ROUTE_NAMES[projectConcept.route] ?? projectConcept.route}
                      <span aria-hidden="true"> · </span>
                      {copy(`${draftShots.length} 个镜头`, `${draftShots.length} scene`)}
                      <span aria-hidden="true"> · </span>
                      {copy('合计', 'Totale')} {formatDuration(totalDurationMs)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <span className="rounded-full border border-neutral-200 px-2 py-0.5 text-[10px] font-semibold tabular-nums text-neutral-600">v{project.currentVersionNo}</span>
                    <span
                      role="status"
                      aria-live="polite"
                      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${autoSaveState === 'error' ? 'bg-rose-50 text-rose-700' : dirty || autoSaveState === 'pending' ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}
                    >
                      {autoSaveState === 'saving' ? <Loader2 className="mr-1 inline h-2.5 w-2.5 animate-spin" aria-hidden="true" /> : null}
                      {autoSaveLabel}
                    </span>
                  </div>
                </div>

                <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                  <div role="group" aria-label={copy('编辑层级', 'Livello di modifica')} className="inline-flex rounded-lg border border-neutral-200 bg-neutral-50 p-0.5">
                    <button
                      type="button"
                      aria-pressed={editorLayer === 'simple'}
                      onClick={() => setEditorLayer('simple')}
                      className={`rounded-md px-2 py-1 text-[10px] font-semibold ${editorLayer === 'simple' ? 'bg-white text-neutral-950 shadow-sm' : 'text-neutral-500'}`}
                    >
                      {copy('快速调整', 'Base')}
                    </button>
                    <button
                      type="button"
                      aria-pressed={editorLayer === 'pro'}
                      onClick={() => setEditorLayer('pro')}
                      className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-semibold ${editorLayer === 'pro' ? 'bg-white text-neutral-950 shadow-sm' : 'text-neutral-500'}`}
                    >
                      <Subtitles className="h-3 w-3" aria-hidden="true" />
                      {copy('专业精修（可选）', 'Avanzato (opzionale)')}
                    </button>
                  </div>
                  <button type="button" onClick={addDraftShot} disabled={draftShots.length >= 24} className={`${secondaryButton} px-2.5 py-1.5`}>
                    <ImagePlus className="h-3 w-3" aria-hidden="true" />
                    {copy('加镜头', 'Aggiungi')}
                  </button>
                  <button type="button" onClick={() => { void saveShots(draftShots); }} disabled={saving || !dirty} className={`${primaryButton} ml-auto px-3 py-1.5`}>
                    {saving ? <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" /> : <Check className="h-3 w-3" aria-hidden="true" />}
                    {copy('保存版本', 'Salva versione')}
                  </button>
                </div>

                {saveNotice && <p role="status" className="mt-2 rounded-lg bg-neutral-50 px-2 py-1.5 text-[10px] leading-4 text-neutral-600">{saveNotice}</p>}
                {saveError && (
                  <p role="alert" className="mt-2 rounded-lg border border-rose-200 bg-rose-50 px-2 py-1.5 text-[10px] leading-4 text-rose-700">
                    {saveError.detail}
                  </p>
                )}
              </div>

              {editorLayer === 'pro' && (
                <div className="rounded-2xl border border-neutral-200 bg-white p-2.5">
                  <div className="flex items-center justify-between gap-2 px-1 pb-1.5 text-[10px] text-neutral-500">
                    <span className="flex items-center gap-1"><Film className="h-3 w-3" aria-hidden="true" />{copy('时间线', 'Timeline')}</span>
                    <span className="tabular-nums">{formatDuration(totalDurationMs)}</span>
                  </div>
                  <div className="flex gap-0.5">
                    {draftShots.map((shot, index) => (
                      <button
                        key={shot.shotId}
                        type="button"
                        onClick={() => {
                          setSelectedShotId(shot.shotId);
                          if (typeof document !== 'undefined') {
                            document.getElementById(`modaui-ad-shot-${shot.shotId}`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
                          }
                        }}
                        aria-pressed={selectedShotId === shot.shotId}
                        aria-label={copy(`跳到镜头 ${index + 1}`, `Vai alla scena ${index + 1}`)}
                        style={{ flexGrow: shot.durationMs, flexBasis: 0 }}
                        className={`min-w-8 overflow-hidden rounded-md border px-1 py-1.5 text-left transition ${selectedShotId === shot.shotId ? 'border-neutral-900 bg-neutral-900 text-white' : 'border-neutral-200 bg-neutral-50 text-neutral-700 hover:bg-neutral-100'}`}
                      >
                        <span className="block text-[10px] font-bold tabular-nums">{index + 1}</span>
                        <span className="block truncate text-[9px] tabular-nums opacity-70">{formatDuration(shot.durationMs)}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <ul className="space-y-2">
                {draftShots.map(renderShot)}
              </ul>

              <div className="rounded-2xl border border-neutral-200 bg-white p-3">
                <button
                  type="button"
                  disabled
                  aria-describedby="modaui-ad-generation-unavailable-storyboard"
                  className={`${primaryButton} w-full`}
                >
                  <Lock className="h-3.5 w-3.5" aria-hidden="true" />
                  {copy('开始生成视频（暂未接通）', 'Genera video (non attivo)')}
                </button>
                <p id="modaui-ad-generation-unavailable-storyboard" className="mt-1.5 text-[10px] leading-4 text-neutral-500">
                  {generationBlockedReason}
                </p>
              </div>
            </section>

            <aside className="min-w-0 space-y-3">
              <section className="rounded-2xl border border-neutral-200 bg-white p-4">
                <button type="button" onClick={() => setVersionsOpen(open => !open)} aria-expanded={versionsOpen} className="flex w-full items-center justify-between gap-2 text-left">
                  <span className="text-xs font-bold text-neutral-950">{copy('版本记录', 'Versioni')}</span>
                  <span className="flex items-center gap-1 text-[10px] text-neutral-500">
                    {versionsLoading ? <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" /> : null}
                    {versions.length}
                    {versionsOpen ? <ChevronUp className="h-3 w-3" aria-hidden="true" /> : <ChevronDown className="h-3 w-3" aria-hidden="true" />}
                  </span>
                </button>
                {versionsOpen && (
                  versions.length === 0 ? (
                    <p className="mt-2 text-[11px] text-neutral-500">{copy('还没有版本记录', 'Nessuna versione')}</p>
                  ) : (
                    <ul className="mt-2 max-h-64 space-y-1.5 overflow-y-auto pr-1">
                      {versions.map(version => (
                        <li key={version.id} className="rounded-lg border border-neutral-200 p-2">
                          <div className="flex items-baseline justify-between gap-2">
                            <span className="text-[11px] font-bold tabular-nums text-neutral-900">v{version.versionNo}</span>
                            <span className="text-[10px] text-neutral-400">
                              {new Date(version.createdAt).toLocaleString(isIt ? 'it-IT' : 'zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          {version.note && <p className="mt-0.5 text-[10px] leading-4 text-neutral-500">{version.note}</p>}
                          <div className="mt-1 flex items-center justify-between gap-2">
                            <span className="text-[10px] text-neutral-400">{ROUTE_NAMES[version.conceptKey] ?? version.conceptKey}</span>
                            <button
                              type="button"
                              onClick={() => { void bulkRestore(version); }}
                              disabled={restoringVersionNo !== null}
                              className="text-[10px] font-semibold text-neutral-800 underline underline-offset-2 disabled:opacity-40"
                            >
                              {restoringVersionNo === version.versionNo ? copy('恢复中…', 'Ripristino…') : copy('恢复', 'Ripristina')}
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )
                )}
              </section>

              <section className="rounded-2xl border border-neutral-200 bg-white p-4">
                <h4 className="text-xs font-bold text-neutral-950">{copy('当前预算', 'Budget attuale')}</h4>
                <p className="mt-1 text-sm font-bold tabular-nums text-neutral-950">
                  {formatUsd(activeBudget?.amountUsd ?? null) ?? copy('未配置价格', 'Prezzo non configurato')}
                </p>
                <p className="mt-0.5 text-[10px] leading-4 text-neutral-500">{copy(`按 ${activeBudget?.resolutionKey ?? resolutionKey} 估算`, `Stima a ${activeBudget?.resolutionKey ?? resolutionKey}`)}</p>
                <button type="button" onClick={() => setStep('budget')} className={`${secondaryButton} mt-2 w-full`}>
                  {copy('查看预算与能力', 'Vedi budget')}
                </button>
              </section>

              {(project.supplementImages?.length ?? 0) > 0 && (
                <section className="rounded-2xl border border-neutral-200 bg-white p-4">
                  <h4 className="text-xs font-bold text-neutral-950">{copy('已加入素材', 'Materiali aggiunti')}</h4>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {(project.supplementImages ?? []).map(url => (
                      <img key={url} src={url} alt="" loading="lazy" className="h-12 w-9 rounded-lg border border-neutral-200 object-cover" />
                    ))}
                  </div>
                  <p className="mt-1.5 text-[10px] leading-4 text-neutral-500">
                    {copy('生成阶段使用，本阶段不参与文案。', 'Usate in generazione, non nei testi di questa fase.')}
                  </p>
                </section>
              )}
            </aside>
          </div>
        );
      })()}

      {compact && (
        <div className="sticky bottom-0 z-20 -mx-1 mt-1 border-t border-neutral-200 bg-white/95 px-3 py-2.5 backdrop-blur">
          <div className="flex items-center justify-between gap-2 pb-1.5 text-[10px] text-neutral-500">
            <span>{step === 'storyboard' ? autoSaveLabel : copy(`第 ${stepIndex + 1} / 4 步`, `Passo ${stepIndex + 1} / 4`)}</span>
            <span>{step === 'concepts' && selectedConceptKey ? copy('已选 1 套', '1 scelta') : ''}</span>
          </div>
          {step === 'product' && (
            <button type="button" onClick={() => { void generateConcepts(); }} disabled={!brief || briefLoading || conceptsLoading} className={`${primaryButton} w-full`}>
              {conceptsLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <Wand2 className="h-3.5 w-3.5" aria-hidden="true" />}
              {copy('生成三套方案', 'Genera tre proposte')}
            </button>
          )}
          {step === 'concepts' && (
            <button type="button" onClick={() => setStep('budget')} disabled={!selectedConceptKey} className={`${primaryButton} w-full`}>
              {copy('继续确认预算', 'Continua al budget')}
            </button>
          )}
          {step === 'budget' && (
            <button
              type="button"
              onClick={() => { if (!project) void createProject(); else setStep('storyboard'); }}
              disabled={projectBusy || (!project && !selectedConcept)}
              className={`${primaryButton} w-full`}
            >
              {projectBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <Check className="h-3.5 w-3.5" aria-hidden="true" />}
              {project ? copy('进入分镜编辑', 'Vai allo storyboard') : copy('保存项目并进入分镜', 'Salva e vai allo storyboard')}
            </button>
          )}
          {step === 'storyboard' && (
            <button type="button" onClick={() => { void saveShots(draftShots); }} disabled={saving || !dirty} className={`${primaryButton} w-full`}>
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <Check className="h-3.5 w-3.5" aria-hidden="true" />}
              {copy('保存版本', 'Salva versione')}
            </button>
          )}
        </div>
      )}
    </div>
  );
};
