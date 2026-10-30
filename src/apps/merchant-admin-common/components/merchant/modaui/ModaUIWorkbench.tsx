import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  Camera,
  Check,
  Download,
  FolderOpen,
  ImagePlus,
  Loader2,
  Maximize2,
  Minimize2,
  Palette,
  RefreshCw,
  Save,
  Settings2,
  Shirt,
  Sparkles,
  UserRound,
  Video,
  X
} from 'lucide-react';

import { apiGet, apiPost, ApiError } from '../../../../../api/client';
import { requestModaGptImage } from '../../../../../api/modagptImageTasks';
import { useB2B } from '../../../../../context/B2BContext';
import type { Product } from '../../../../../types/b2b';
import { buildFashionDesignConceptPrompt, buildModelStudioPrompt } from '../../../../../shared/modagptImageContract';
import { ModaCoreAnchor, ModaCoreStageProvider } from './ModaCoreStage';
import type { ModaCoreVisualState } from './modaCoreEngine';
import { createModaCoreLife } from './modaCoreLife';
import type { AudioLevelRef } from './useModaCoreAudio';
import { ModaGptGarmentRecolor } from '../ModaGptGarmentRecolor';
import {
  WORKBENCH_CAPABILITIES,
  getWorkbenchCapability,
  isWorkbenchCapabilityId,
  resolveWorkbenchAvailability,
  type WorkbenchCapabilityId,
  type WorkbenchEntitlementSnapshot,
  type WorkbenchImageProvider,
  type WorkbenchMissingInput
} from './modaWorkbenchCapabilities';
import {
  buildDefaultTryOnPrompt,
  buildRecolorPrompt,
  describeMissingWorkbenchInputs,
  describeWorkbenchStep,
  planModaWorkbenchTask,
  type ModaWorkbenchPlan
} from './modaWorkbenchPlan';

type WorkbenchProps = {
  isIt: boolean;
  merchantId: string;
  merchantName: string;
  initialCapability?: WorkbenchCapabilityId | null;
  onExit: () => void;
};

type WorkbenchEntitlements = {
  plan: string;
  quotas: { chat: number; imageGeneration: number; tryOn: number };
  remaining: { chat: number; imageGeneration: number; tryOn: number };
  capabilities: { fashionDesign?: boolean; imageGeneration: boolean; tryOn: boolean };
  providers: { image: 'fal' | 'local' | 'unavailable' };
  billing: { active: boolean; planId: string | null; creditBalance: number };
};

type SavedDesign = {
  id: string;
  title: string;
  prompt: string;
  category: 'design' | 'imageGeneration' | 'tryOn';
  imageWidth: number;
  imageHeight: number;
  isFavorite: boolean;
  createdAt: string;
  imageUrl: string;
};

type WorkbenchResult = {
  id: string;
  capability: WorkbenchCapabilityId;
  imageDataUrl: string;
  prompt: string;
  taskId: string | null;
  createdAt: string;
  engine: string;
  parentId: string | null;
  savedDesignId: string | null;
  width: number | null;
  height: number | null;
  recolor: boolean;
};

type WorkbenchEntry =
  | { id: string; kind: 'request'; text: string; capability: WorkbenchCapabilityId; at: number }
  | { id: string; kind: 'task'; role: 'user' | 'assistant'; text: string; at: number }
  | { id: string; kind: 'plan'; plan: ModaWorkbenchPlan; at: number }
  | { id: string; kind: 'status'; tone: 'running' | 'failed' | 'info'; text: string; at: number }
  | { id: string; kind: 'result'; result: WorkbenchResult; at: number };

type WorkbenchAssets = { person: string; garment: string; personName: string; garmentName: string };
type MerchantTaskPreview = {
  message: string;
  workflow: string;
  goal: string;
  agents: string[];
  tools: string[];
  summary: string;
  sideEffects: string;
  requiresApprovalForSensitiveActions: boolean;
  draftRequired: boolean;
};
type ProcurementSupplierOption = { id: string; name: string; status: string };
type ProcurementCatalog = { suppliers: ProcurementSupplierOption[]; products: Product[] };
type ProcurementDraftFields = {
  supplierId: string;
  productId: string;
  variantId: string;
  quantity: string;
  unitCost: string;
};

const studioDirections = [
  'full-body front view on a clean seamless studio background with commercial lighting',
  'three-quarter editorial pose that keeps the garment silhouette readable',
  'close detail of fabric texture, seams and hardware',
  'commercial scene with controlled depth of field and brand-level styling'
] as const;

const silentLevel: AudioLevelRef = { current: 0 };
const maximumAssetBytes = 8 * 1024 * 1024;

function newId(prefix: string): string {
  const suffix = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2, 12);
  return `${prefix}-${suffix}`;
}

function readImageFile(file: File): Promise<string> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size === 0 || file.size > maximumAssetBytes) {
    return Promise.reject(new Error('MODAUI_WORKBENCH_ASSET_INVALID'));
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === 'string'
      ? resolve(reader.result)
      : reject(new Error('MODAUI_WORKBENCH_ASSET_READ_FAILED'));
    reader.onerror = () => reject(reader.error || new Error('MODAUI_WORKBENCH_ASSET_READ_FAILED'));
    reader.readAsDataURL(file);
  });
}

function measureImage(dataUrl: string): Promise<{ width: number; height: number } | null> {
  return new Promise(resolve => {
    const image = new Image();
    image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
    image.onerror = () => resolve(null);
    image.src = dataUrl;
  });
}

function detectGarmentCategory(text: string): 'tops' | 'bottoms' | 'one-pieces' {
  if (/连衣裙|裙装|礼服|大衣|风衣|连体|dress|gown|coat|trench/i.test(text)) return 'one-pieces';
  if (/裤|短裤|半裙|下装|jeans|trousers|pants|skirt|shorts/i.test(text)) return 'bottoms';
  return 'tops';
}

function entitlementSnapshot(entitlements: WorkbenchEntitlements | null): WorkbenchEntitlementSnapshot | null {
  if (!entitlements) return null;
  const provider: WorkbenchImageProvider = entitlements.providers.image === 'fal'
    ? 'fal'
    : entitlements.providers.image === 'local' ? 'automatic1111' : 'unavailable';
  return {
    plan: entitlements.plan,
    imageGeneration: entitlements.capabilities.imageGeneration,
    tryOn: entitlements.capabilities.tryOn,
    imageProvider: provider
  };
}

function requestsProcurementDraft(message: string): boolean {
  return /(?:创建|生成|准备|新建).{0,12}(?:采购草稿|采购单|采购订单|进货单|补货订单)/i.test(message);
}

function merchantTaskErrorCopy(error: unknown, isIt: boolean): string {
  const code = error instanceof ApiError ? error.code : error instanceof Error ? error.message : '';
  const known: Record<string, [string, string]> = {
    MODAGPT_TASK_PERMISSION_REQUIRED: ['当前员工没有采购管理权限，任务未执行。', 'L’utente non dispone dei permessi di acquisto. Attività non eseguita.'],
    EMPLOYEE_PERMISSION_REQUIRED: ['当前员工没有采购管理权限，任务未执行。', 'L’utente non dispone dei permessi di acquisto. Attività non eseguita.'],
    MODAGPT_TASK_WORKFLOW_UNAVAILABLE: ['当前商家行业暂不支持此任务。', 'Questo settore non supporta l’attività richiesta.'],
    MODAGPT_TASK_NOT_FOUND: ['任务不存在或不属于当前商家。', 'Attività non trovata o non appartenente a questo negozio.'],
    REQUEST_TIMEOUT: ['请求超时；如已提交，请使用同一任务重试或查询状态。', 'Richiesta scaduta: riprova con la stessa attività o controllane lo stato.']
  };
  if (code && known[code]) return isIt ? known[code][1] : known[code][0];
  if (error instanceof ApiError && error.status === 401) {
    return isIt ? 'Sessione scaduta: accedi di nuovo.' : '登录已过期，请重新登录。';
  }
  if (error instanceof ApiError && error.status === 403) {
    return isIt ? 'Permesso di acquisto mancante; attività non eseguita.' : '缺少采购管理权限，任务未执行。';
  }
  if (error instanceof Error && error.message && !/^[A-Z0-9_]{6,}$/.test(error.message)) return error.message;
  return isIt
    ? `Impossibile completare l’attività${code ? ` (${code})` : ''}. Verifica i dati o riprova.`
    : `任务未能完成${code ? `（${code}）` : ''}。请检查权限和输入后重试。`;
}


export const ModaUIWorkbench: React.FC<WorkbenchProps> = ({
  isIt,
  merchantId,
  merchantName,
  initialCapability = null,
  onExit
}) => {
  const { localizeCopy } = useB2B();
  const [capability, setCapability] = useState<WorkbenchCapabilityId | null>(initialCapability);
  const [draft, setDraft] = useState('');
  const [taskMode, setTaskMode] = useState(false);
  const [taskPreview, setTaskPreview] = useState<MerchantTaskPreview | null>(null);
  const [taskCatalog, setTaskCatalog] = useState<ProcurementCatalog | null>(null);
  const [taskCatalogLoading, setTaskCatalogLoading] = useState(false);
  const [taskDraft, setTaskDraft] = useState<ProcurementDraftFields>({
    supplierId: '',
    productId: '',
    variantId: '',
    quantity: '1',
    unitCost: ''
  });
  const [taskStartedAt, setTaskStartedAt] = useState<number | null>(null);
  const [taskRetryLocked, setTaskRetryLocked] = useState(false);
  const [pendingTaskId, setPendingTaskId] = useState<string | null>(null);
  const taskIdempotencyKeyRef = useRef<string | null>(null);
  const [assets, setAssets] = useState<WorkbenchAssets>({ person: '', garment: '', personName: '', garmentName: '' });
  const [entries, setEntries] = useState<WorkbenchEntry[]>([]);
  const [entitlements, setEntitlements] = useState<WorkbenchEntitlements | null>(null);
  const [entitlementsError, setEntitlementsError] = useState('');
  const [running, setRunning] = useState<{ capability: WorkbenchCapabilityId; startedAt: number } | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [notice, setNotice] = useState<{ text: string; tone: 'warn' | 'info' } | null>(null);
  const [consent, setConsent] = useState(false);
  const [imageCount, setImageCount] = useState(1);
  const [assetsOpen, setAssetsOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [selectedResultId, setSelectedResultId] = useState<string | null>(null);
  const [designs, setDesigns] = useState<SavedDesign[]>([]);
  const [designsLoading, setDesignsLoading] = useState(false);
  const [designsNotice, setDesignsNotice] = useState('');
  const [savingResultId, setSavingResultId] = useState<string | null>(null);
  const [recolorSource, setRecolorSource] = useState<string | null>(null);
  const [successFlash, setSuccessFlash] = useState(false);
  const [motionEnabled, setMotionEnabled] = useState(() => {
    if (typeof window === 'undefined') return true;
    try {
      return window.localStorage.getItem('modaui.workbench.motion') !== 'off';
    } catch {
      return true;
    }
  });

  const personInputRef = useRef<HTMLInputElement>(null);
  const garmentInputRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<HTMLDivElement>(null);
  const successTimerRef = useRef<number | null>(null);
  const saveRequestIdsRef = useRef<Map<string, string>>(new Map());
  const coreLife = useMemo(() => createModaCoreLife(), []);

  const snapshot = useMemo(() => entitlementSnapshot(entitlements), [entitlements]);

  const plan = useMemo(() => planModaWorkbenchTask({
    text: draft,
    capability,
    assets: { person: assets.person, garment: assets.garment },
    entitlements: snapshot
  }), [draft, capability, assets.person, assets.garment, snapshot]);

  const results = useMemo(
    () => entries
      .filter((entry): entry is Extract<WorkbenchEntry, { kind: 'result' }> => entry.kind === 'result')
      .map(entry => entry.result),
    [entries]
  );
  const selectedResult = useMemo(
    () => results.find(result => result.id === selectedResultId) ?? results[results.length - 1] ?? null,
    [results, selectedResultId]
  );

  const coreState: ModaCoreVisualState = running
    ? 'thinking'
    : successFlash ? 'success' : 'idle';

  const flashSuccess = useCallback(() => {
    setSuccessFlash(true);
    if (successTimerRef.current !== null) window.clearTimeout(successTimerRef.current);
    successTimerRef.current = window.setTimeout(() => {
      setSuccessFlash(false);
      successTimerRef.current = null;
    }, 1600);
  }, []);

  useEffect(() => () => {
    if (successTimerRef.current !== null) window.clearTimeout(successTimerRef.current);
    coreLife.dispose();
  }, [coreLife]);

  useEffect(() => {
    const startedAt = running?.startedAt ?? taskStartedAt;
    if (startedAt === null) {
      setElapsed(0);
      return;
    }
    setElapsed(0);
    const timer = window.setInterval(() => {
      setElapsed(Math.max(0, Math.round((Date.now() - startedAt) / 1000)));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [running, taskStartedAt]);

  useEffect(() => {
    const stream = streamRef.current;
    if (!stream) return;
    stream.scrollTop = stream.scrollHeight;
  }, [entries.length, running, taskPreview, pendingTaskId]);

  useEffect(() => {
    if (initialCapability) return;
    const params = new URLSearchParams(window.location.search);
    const requested = params.get('modagptTool');
    if (!requested) return;
    const mapped: Record<string, WorkbenchCapabilityId> = {
      design: 'design',
      generate: 'studio',
      productLaunch: 'studio',
      tryon: 'tryon',
      edit: 'recolor',
      recolor: 'recolor',
      fashionVideo: 'video'
    };
    const next = mapped[requested];
    if (isWorkbenchCapabilityId(next)) setCapability(next);
  }, [initialCapability]);

  useEffect(() => {
    let active = true;
    apiGet<{ success: true } & WorkbenchEntitlements>('/api/merchant/modagpt/entitlements')
      .then(result => {
        if (!active) return;
        setEntitlements(result);
        setEntitlementsError('');
      })
      .catch(error => {
        if (active) setEntitlementsError(error instanceof Error ? error.message : 'MODAGPT_ENTITLEMENTS_UNAVAILABLE');
      });
    return () => { active = false; };
  }, [merchantId]);

  const loadDesigns = useCallback(async () => {
    setDesignsLoading(true);
    setDesignsNotice('');
    try {
      const result = await apiGet<{ success: true; designs: SavedDesign[] }>('/api/merchant/modagpt/designs?category=all');
      setDesigns(result.designs);
    } catch (error) {
      setDesignsNotice(error instanceof Error ? error.message : 'MODAGPT_DESIGNS_UNAVAILABLE');
    } finally {
      setDesignsLoading(false);
    }
  }, []);

  useEffect(() => { void loadDesigns(); }, [loadDesigns]);


  const acceptAsset = useCallback(async (slot: 'person' | 'garment', file: File | undefined) => {
    if (!file) return;
    try {
      const dataUrl = await readImageFile(file);
      setAssets(current => ({
        ...current,
        [slot]: dataUrl,
        [slot === 'person' ? 'personName' : 'garmentName']: file.name
      }));
      setNotice(null);
    } catch {
      setNotice({
        text: localizeCopy('图片需要是 8MB 以内的 JPG、PNG 或 WebP。', 'Immagine non valida: JPG, PNG o WebP fino a 8 MB.'),
        tone: 'warn'
      });
    }
  }, [localizeCopy]);

  const clearAsset = (slot: 'person' | 'garment') => {
    setAssets(current => ({
      ...current,
      [slot]: '',
      [slot === 'person' ? 'personName' : 'garmentName']: ''
    }));
  };

  const previewMerchantTask = async (message: string) => {
    if (!message || taskStartedAt !== null || taskPreview) return;
    setTaskStartedAt(Date.now());
    setNotice(null);
    try {
      const preview = await apiPost<{
        success: true;
        workflow: string;
        goal: string;
        agents: string[];
        tools: string[];
        summary: string;
        sideEffects: string;
        requiresApprovalForSensitiveActions: boolean;
      }>('/api/merchant/modagpt/task/preview', { message });
      const draftRequired = preview.workflow === 'procurement_management' && requestsProcurementDraft(message);
      if (draftRequired) {
        setTaskCatalogLoading(true);
        const [supplierResult, productResult] = await Promise.all([
          apiGet<{ success: true; suppliers: ProcurementSupplierOption[] }>('/api/merchant/suppliers'),
          apiGet<{ success: true; products: Product[] }>('/api/merchant/products')
        ]);
        const activeSuppliers = supplierResult.suppliers.filter(supplier => supplier.status === 'active');
        const eligibleProducts = productResult.products.filter(product =>
          product.lifecycleStatus !== 'archived' && product.skus.some(sku => Boolean(sku.variantId) && sku.isActive !== false)
        );
        const firstProduct = eligibleProducts[0];
        const firstVariant = firstProduct?.skus.find(sku => Boolean(sku.variantId) && sku.isActive !== false);
        setTaskCatalog({ suppliers: supplierResult.suppliers, products: productResult.products });
        setTaskDraft({
          supplierId: activeSuppliers[0]?.id || '',
          productId: firstProduct?.id || '',
          variantId: firstVariant?.variantId || '',
          quantity: '1',
          unitCost: ''
        });
      } else {
        setTaskCatalog(null);
        setTaskDraft({ supplierId: '', productId: '', variantId: '', quantity: '1', unitCost: '' });
      }
      taskIdempotencyKeyRef.current = null;
      setTaskRetryLocked(false);
      setTaskPreview({ message, ...preview, draftRequired });
      setDraft('');
    } catch (error) {
      setNotice({ text: merchantTaskErrorCopy(error, isIt), tone: 'warn' });
    } finally {
      setTaskCatalogLoading(false);
      setTaskStartedAt(null);
    }
  };

  const pollMerchantTask = async (taskId: string, statusEntryId: string) => {
    let latest: {
      runtimeStatus: string;
      status: string;
      summary: string | null;
      approvalId: string | null;
      errors: string[];
    } | null = null;
    try {
      for (let attempt = 0; attempt < 60; attempt += 1) {
        const task = await apiGet<{
          success: true;
          runtimeStatus: string;
          status: string;
          summary: string | null;
          approvalId: string | null;
          errors: string[];
        }>(`/api/merchant/modagpt/task/${encodeURIComponent(taskId)}`);
        latest = task;
        if (['completed', 'failed', 'dead_letter', 'cancelled', 'waiting_approval'].includes(task.runtimeStatus)) break;
        await new Promise(resolve => window.setTimeout(resolve, 1_000));
      }
      if (!latest) throw new Error('MODAGPT_TASK_STATUS_INVALID');
      const finalMessage = latest.runtimeStatus === 'waiting_approval'
        ? `任务等待商家审批${latest.approvalId ? `（${latest.approvalId}）` : ''}；审批前不会执行敏感操作。${latest.summary || ''}`
        : ['failed', 'dead_letter', 'cancelled'].includes(latest.runtimeStatus)
          ? `任务未完成（${latest.runtimeStatus}）：${latest.errors.join('、') || '请检查任务后重试。'}`
          : latest.runtimeStatus === 'completed'
            ? latest.status === 'needs_input'
              ? `任务尚未创建采购草稿：${latest.summary || '请补充必需的采购信息后重新提交。'}`
              : `任务已完成：${latest.summary || latest.status}。`
            : `任务仍在处理中，任务编号：${taskId}。`;
      setEntries(current => current.map(entry =>
        entry.id === statusEntryId && entry.kind === 'task'
          ? { ...entry, text: finalMessage }
          : entry
      ));
      setPendingTaskId(
        ['completed', 'failed', 'dead_letter', 'cancelled', 'waiting_approval'].includes(latest.runtimeStatus)
          ? null
          : taskId
      );
    } catch (error) {
      setEntries(current => current.map(entry =>
        entry.id === statusEntryId && entry.kind === 'task'
          ? { ...entry, text: `任务已受理（${taskId}），但暂时无法读取状态：${merchantTaskErrorCopy(error, isIt)}` }
          : entry
      ));
      setPendingTaskId(taskId);
    }
  };

  const confirmMerchantTask = async () => {
    const preview = taskPreview;
    if (!preview || taskStartedAt !== null) return;
    let inputs: Record<string, unknown> = {};
    if (preview.draftRequired) {
      const validSupplier = taskSuppliers.some(supplier => supplier.id === taskDraft.supplierId);
      const validProduct = taskProducts.some(product => product.id === taskDraft.productId);
      const validVariant = taskVariants.some(variant => variant.variantId === taskDraft.variantId);
      if (!taskDraftValid || !validSupplier || !validProduct || !validVariant) {
        setNotice({ text: localizeCopy('请选择有效供应商、商品和 SKU，并填写正整数数量及非负单位成本。', 'Seleziona un fornitore, un prodotto e uno SKU validi; inserisci quantità intera e costo non negativo.'), tone: 'warn' });
        return;
      }
      inputs = {
        create_procurement_draft: {
          supplierId: taskDraft.supplierId,
          items: [{
            productId: taskDraft.productId,
            variantId: taskDraft.variantId,
            quantity: Number(taskDraft.quantity),
            unitCost: Number(taskDraft.unitCost)
          }],
          currency: 'EUR'
        }
      };
    }

    const idempotencyKey = taskIdempotencyKeyRef.current || newId('merchant-task');
    taskIdempotencyKeyRef.current = idempotencyKey;
    setTaskRetryLocked(true);
    setTaskStartedAt(Date.now());
    setNotice(null);
    try {
      const created = await apiPost<{ success: true; taskId: string; status: string }>(
        '/api/merchant/modagpt/task',
        { message: preview.message, inputs },
        30_000,
        { 'Idempotency-Key': idempotencyKey }
      );
      taskIdempotencyKeyRef.current = null;
      setTaskRetryLocked(false);
      setTaskPreview(null);
      setTaskCatalog(null);
      setPendingTaskId(created.taskId);
      const statusEntryId = newId('task');
      setEntries(current => [
        ...current,
        { id: newId('task'), kind: 'task', role: 'user', text: preview.message, at: Date.now() },
        { id: statusEntryId, kind: 'task', role: 'assistant', text: `任务已提交（${created.taskId}），正在读取服务端状态。`, at: Date.now() }
      ]);
      await pollMerchantTask(created.taskId, statusEntryId);
    } catch (error) {
      setNotice({ text: merchantTaskErrorCopy(error, isIt), tone: 'warn' });
    } finally {
      setTaskStartedAt(null);
    }
  };

  const cancelMerchantTaskPreview = () => {
    if (taskRetryLocked) {
      setNotice({ text: localizeCopy('提交结果尚未确认，请使用同一请求重试，避免重复采购。', 'Esito non confermato: riprova con la stessa richiesta per evitare duplicati.'), tone: 'warn' });
      return;
    }
    if (taskPreview) setDraft(taskPreview.message);
    setTaskPreview(null);
    setTaskCatalog(null);
    setNotice(null);
    taskIdempotencyKeyRef.current = null;
  };

  const switchTaskMode = (enabled: boolean) => {
    if (busy || taskRetryLocked) return;
    if (taskPreview) cancelMerchantTaskPreview();
    setTaskMode(enabled);
    setNotice(null);
  };

  const submit = async () => {
    if (running || taskStartedAt !== null) return;
    const text = draft.trim();
    if (taskMode) {
      if (!text) {
        setNotice({ text: localizeCopy('请先描述要执行的业务任务。', 'Descrivi prima l’attività da eseguire.'), tone: 'warn' });
        return;
      }
      await previewMerchantTask(text);
      return;
    }
    const nextPlan = planModaWorkbenchTask({
      text,
      capability,
      assets: { person: assets.person, garment: assets.garment },
      entitlements: snapshot
    });
    setEntries(current => [
      ...current,
      {
        id: newId('entry'),
        kind: 'request',
        text: text || localizeCopy('（未填写描述）', '(nessuna descrizione)'),
        capability: nextPlan.capability,
        at: Date.now()
      },
      { id: newId('entry'), kind: 'plan', plan: nextPlan, at: Date.now() }
    ]);
    setSelectedResultId(null);

    if (nextPlan.question) {
      setNotice({ text: isIt ? nextPlan.question.it : nextPlan.question.zh, tone: 'warn' });
      return;
    }
    if (nextPlan.notice) {
      setNotice({ text: isIt ? nextPlan.notice.it : nextPlan.notice.zh, tone: 'info' });
    } else {
      setNotice(null);
    }
    if (nextPlan.blocked) return;

    if (nextPlan.missing.length) {
      const copy = describeMissingWorkbenchInputs(nextPlan.missing);
      setNotice({ text: copy ? (isIt ? copy.it : copy.zh) : '', tone: 'warn' });
      if (nextPlan.missing.includes('person')) personInputRef.current?.click();
      else if (nextPlan.missing.includes('garment')) garmentInputRef.current?.click();
      return;
    }

    setDraft('');
    await executeStep(nextPlan, 0, text);
  };


  const appendResult = useCallback(async (input: {
    capability: WorkbenchCapabilityId;
    imageDataUrl: string;
    prompt: string;
    taskId: string | null;
    parentId: string | null;
    recolor?: boolean;
  }) => {
    const measured = await measureImage(input.imageDataUrl);
    const result: WorkbenchResult = {
      id: newId('result'),
      capability: input.capability,
      imageDataUrl: input.imageDataUrl,
      prompt: input.prompt,
      taskId: input.taskId,
      createdAt: new Date().toISOString(),
      engine: input.recolor
        ? localizeCopy('本地像素换色', 'Ricolorazione locale')
        : entitlements?.providers.image === 'fal' ? 'fal' : entitlements?.providers.image === 'local' ? 'local' : '—',
      parentId: input.parentId,
      savedDesignId: null,
      width: measured?.width ?? null,
      height: measured?.height ?? null,
      recolor: input.recolor === true
    };
    setEntries(current => [...current, { id: newId('entry'), kind: 'result', result, at: Date.now() }]);
    setSelectedResultId(result.id);
    setInspectorOpen(true);
    flashSuccess();
    coreLife.emit({ type: 'response:complete' });
    if (!measured) {
      setNotice({
        text: localizeCopy('结果已返回，但图片无法解码，请重新生成。', 'Immagine ricevuta ma non decodificabile: rigenera.'),
        tone: 'warn'
      });
    }
    return result;
  }, [coreLife, entitlements, flashSuccess, localizeCopy]);

  const buildPrompts = (target: WorkbenchCapabilityId, text: string): string[] => {
    const brief = text.trim();
    if (target === 'studio') {
      if (!brief) throw new Error('MODAUI_WORKBENCH_BRIEF_REQUIRED');
      return Array.from({ length: Math.min(imageCount, 3) }, (_unused, index) =>
        buildModelStudioPrompt(brief, index + 1, studioDirections[index % studioDirections.length])
      );
    }
    const base = brief || localizeCopy('一款高级成衣', 'un capo ready-to-wear');
    return Array.from({ length: Math.min(imageCount, 3) }, (_unused, index) =>
      buildFashionDesignConceptPrompt(base, index + 1)
    );
  };

  const executeStep = async (target: ModaWorkbenchPlan, stepIndex: number, requestText: string) => {
    const step = target.steps[stepIndex];
    if (!step || step.status !== 'ready' || running) return;

    if (step.execution === 'client_recolor') {
      if (!assets.garment) {
        const copy = describeMissingWorkbenchInputs(['garment']);
        setNotice({ text: copy ? (isIt ? copy.it : copy.zh) : '', tone: 'warn' });
        garmentInputRef.current?.click();
        return;
      }
      setRecolorSource(assets.garment);
      return;
    }

    if (step.execution === 'server_try_on' && !consent) {
      setNotice({
        text: localizeCopy('请先确认人物照片已获得本人授权。', 'Conferma di avere l’autorizzazione della persona nella foto.'),
        tone: 'warn'
      });
      return;
    }

    setNotice(null);
    setRunning({ capability: step.capability, startedAt: Date.now() });
    coreLife.emit({ type: 'message:submit' });
    coreLife.emit({ type: 'response:start' });

    try {
      if (step.execution === 'server_try_on') {
        if (!assets.person || !assets.garment) throw new Error('MODAUI_WORKBENCH_ASSET_MISSING');
        const prompt = buildDefaultTryOnPrompt(requestText);
        const result = await requestModaGptImage({
          task: 'tryOn',
          prompt,
          category: detectGarmentCategory(requestText),
          personImage: assets.person,
          garmentImage: assets.garment,
          privacyConsent: true
        }, merchantId);
        await appendResult({ capability: 'tryon', imageDataUrl: result.imageDataUrl, prompt, taskId: result.taskId, parentId: null });
      } else {
        const prompts = buildPrompts(step.capability, requestText);
        for (const prompt of prompts) {
          const result = await requestModaGptImage({ task: 'imageGeneration', prompt }, merchantId);
          await appendResult({ capability: step.capability, imageDataUrl: result.imageDataUrl, prompt, taskId: result.taskId, parentId: null });
        }
      }
    } catch (error) {
      const message = workbenchErrorCopy(error, isIt);
      setEntries(current => [...current, {
        id: newId('entry'),
        kind: 'status',
        tone: 'failed',
        text: message,
        at: Date.now()
      }]);
      setNotice({ text: message, tone: 'warn' });
      // 失败时把原文放回输入框，用户可直接重试，不必重新打字。
      if (requestText.trim()) setDraft(current => current || requestText);
      coreLife.emit({ type: 'response:error' });
    } finally {
      setRunning(null);
    }
  };


  const saveResult = async (result: WorkbenchResult) => {
    if (result.savedDesignId || savingResultId) return;
    let clientRequestId = saveRequestIdsRef.current.get(result.id);
    if (!clientRequestId) {
      clientRequestId = newId('save');
      saveRequestIdsRef.current.set(result.id, clientRequestId);
    }
    setSavingResultId(result.id);
    setNotice(null);
    try {
      const webp = await ensureWebpDataUrl(result.imageDataUrl);
      const created = await apiPost<{ success: true; design: SavedDesign }>('/api/merchant/modagpt/designs', {
        title: (result.prompt || 'ModaUI').slice(0, 160),
        prompt: (result.prompt || 'ModaUI').slice(0, 1000),
        category: result.capability === 'tryon' ? 'tryOn' : result.capability === 'design' ? 'design' : 'imageGeneration',
        imageDataUrl: webp,
        clientRequestId
      });
      setEntries(current => current.map(entry => entry.kind === 'result' && entry.result.id === result.id
        ? { ...entry, result: { ...entry.result, savedDesignId: created.design.id } }
        : entry));
      setDesigns(current => [created.design, ...current.filter(item => item.id !== created.design.id)]);
      flashSuccess();
    } catch (error) {
      setNotice({ text: workbenchErrorCopy(error, isIt), tone: 'warn' });
    } finally {
      setSavingResultId(null);
    }
  };

  const startFromResult = (result: WorkbenchResult, next: WorkbenchCapabilityId) => {
    if (next === 'recolor') {
      setRecolorSource(result.imageDataUrl);
      return;
    }
    if (next === 'tryon') {
      setAssets(current => ({ ...current, garment: result.imageDataUrl, garmentName: localizeCopy('当前结果', 'Risultato corrente') }));
      setCapability('tryon');
      setDraft(current => current || localizeCopy('把这件服装试穿到人物身上', 'Prova questo capo sulla persona'));
      setNotice({
        text: localizeCopy('已把当前结果放入“服装”槽位，请上传人物照片后生成。', 'Risultato inserito come capo: carica la foto persona.'),
        tone: 'info'
      });
      return;
    }
    if (next === 'studio') {
      setCapability('studio');
      setNotice({
        text: localizeCopy('以当前结果为输入的棚拍引擎尚未接入；可用文字描述重新生成棚拍图。', 'Il servizio commerciale da un’immagine non è collegato: descrivi lo scatto a testo.'),
        tone: 'warn'
      });
      return;
    }
    setNotice({ text: localizeCopy('视频引擎当前未接入。', 'Motore video non collegato.'), tone: 'warn' });
  };

  const downloadResult = (result: WorkbenchResult) => {
    const link = document.createElement('a');
    link.href = result.imageDataUrl;
    link.download = `modaui-${result.capability}-${result.id.slice(-6)}.webp`;
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const activeCapability = capability ?? plan.capability;
  const missingCopy = describeMissingWorkbenchInputs(plan.missing);
  const laterMissingCopy = describeMissingWorkbenchInputs(plan.laterMissing);
  const busy = running !== null || taskStartedAt !== null;
  const showTryOnSlots = !taskMode && activeCapability === 'tryon';
  const statusLabel = busy
    ? localizeCopy(`执行中 · 已用 ${elapsed}s`, `In corso · ${elapsed}s`)
    : notice?.tone === 'warn'
      ? localizeCopy('需要处理', 'Da verificare')
      : localizeCopy('待机', 'Inattivo');
  const taskSuppliers = (taskCatalog?.suppliers || []).filter(supplier => supplier.status === 'active');
  const taskProducts = (taskCatalog?.products || []).filter(product =>
    product.lifecycleStatus !== 'archived' && product.skus.some(sku => Boolean(sku.variantId) && sku.isActive !== false)
  );
  const selectedTaskProduct = taskProducts.find(product => product.id === taskDraft.productId) || null;
  const taskVariants = selectedTaskProduct?.skus.filter(sku => Boolean(sku.variantId) && sku.isActive !== false) || [];
  const taskDraftValid = Boolean(
    taskDraft.supplierId
    && taskDraft.productId
    && taskDraft.variantId
    && taskDraft.quantity.trim()
    && Number.isInteger(Number(taskDraft.quantity))
    && Number(taskDraft.quantity) > 0
    && taskDraft.unitCost.trim()
    && Number.isFinite(Number(taskDraft.unitCost))
    && Number(taskDraft.unitCost) >= 0
  );

  const useSavedDesign = async (design: SavedDesign, target: 'recolor' | 'tryon') => {
    try {
      const dataUrl = await loadRemoteImageDataUrl(design.imageUrl);
      if (target === 'recolor') {
        setRecolorSource(dataUrl);
        setAssetsOpen(false);
        return;
      }
      setAssets(current => ({ ...current, garment: dataUrl, garmentName: design.title.slice(0, 40) }));
      setCapability('tryon');
      setAssetsOpen(false);
      setNotice({
        text: localizeCopy('已放入「服装」槽位，请上传人物照片后生成。', 'Capo inserito: carica la foto persona.'),
        tone: 'info'
      });
    } catch {
      setNotice({ text: localizeCopy('素材读取失败，请重试。', 'Lettura non riuscita, riprova.'), tone: 'warn' });
    }
  };

  const inspectorBody = selectedResult ? (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-400">
          {localizeCopy('结果检查', 'Verifica risultato')}
        </p>
        <span className="shrink-0 rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] text-neutral-600">
          {isIt
            ? getWorkbenchCapability(selectedResult.capability).labelIt
            : getWorkbenchCapability(selectedResult.capability).labelZh}
        </span>
      </div>
      <img
        src={selectedResult.imageDataUrl}
        alt=""
        className="w-full rounded-xl border border-neutral-200 bg-neutral-50 object-contain"
      />
      <dl className="space-y-1.5 text-[10px]">
        <div>
          <dt className="text-neutral-400">{localizeCopy('提示词快照', 'Prompt salvato')}</dt>
          <dd className="mt-0.5 break-words leading-4 text-neutral-700">{selectedResult.prompt}</dd>
        </div>
        <div className="flex items-center justify-between gap-2">
          <dt className="text-neutral-400">{localizeCopy('引擎', 'Motore')}</dt>
          <dd className="font-semibold text-neutral-700">{selectedResult.engine}</dd>
        </div>
        <div className="flex items-center justify-between gap-2">
          <dt className="text-neutral-400">{localizeCopy('任务 ID', 'ID attività')}</dt>
          <dd className="max-w-[62%] truncate font-mono text-neutral-700" title={selectedResult.taskId ?? ''}>{selectedResult.taskId ?? '—'}</dd>
        </div>
        <div className="flex items-center justify-between gap-2">
          <dt className="text-neutral-400">{localizeCopy('尺寸', 'Dimensioni')}</dt>
          <dd className="font-semibold text-neutral-700">
            {selectedResult.width && selectedResult.height ? `${selectedResult.width}×${selectedResult.height}` : '—'}
          </dd>
        </div>
        <div className="flex items-center justify-between gap-2">
          <dt className="text-neutral-400">{localizeCopy('生成时间', 'Creato')}</dt>
          <dd className="text-neutral-700">{new Date(selectedResult.createdAt).toLocaleString()}</dd>
        </div>
        <div className="flex items-center justify-between gap-2">
          <dt className="text-neutral-400">{localizeCopy('素材 ID', 'ID materiale')}</dt>
          <dd className="max-w-[62%] truncate font-mono text-neutral-700">{selectedResult.savedDesignId ?? '—'}</dd>
        </div>
      </dl>
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => void saveResult(selectedResult)}
          disabled={Boolean(selectedResult.savedDesignId) || savingResultId === selectedResult.id}
          className={resultActionPrimaryClass}
        >
          <Save className="h-3.5 w-3.5" />{localizeCopy('保存到素材库', 'Salva nel portfolio')}
        </button>
        <button type="button" onClick={() => downloadResult(selectedResult)} className={resultActionClass}>
          <Download className="h-3.5 w-3.5" />{localizeCopy('下载', 'Scarica')}
        </button>
      </div>
      <p className="text-[10px] leading-4 text-neutral-400">
        {localizeCopy('版本谱系当前只保留在本次会话；服务端资产谱系字段尚未上线。', 'La genealogia delle versioni resta in questa sessione: i campi lato server non sono ancora attivi.')}
      </p>
    </div>
  ) : null;

  return (
    <ModaCoreStageProvider life={coreLife} state={coreState} levelRef={silentLevel} pulseRef={silentLevel}>
      <div className="flex h-full min-h-0 w-full flex-col bg-[#f6f6f7] text-neutral-900">
        <header className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-neutral-200 bg-white px-2 sm:px-4">
          <div className="flex min-w-0 items-center gap-1.5">
            <button
              type="button"
              onClick={onExit}
              aria-label={localizeCopy('退出 ModaUI', 'Esci da ModaUI')}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-neutral-600 hover:bg-neutral-100"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className="flex min-w-0 items-center gap-2">
              {motionEnabled
                ? <ModaCoreAnchor kind="hero" className="h-10 w-10 shrink-0 rounded-2xl" />
                : <span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rounded-full bg-neutral-900" />}
              <div className="min-w-0 leading-tight">
                <p className="text-[13px] font-semibold tracking-tight">ModaUI</p>
                <p className="truncate text-[10px] text-neutral-500">{merchantName}</p>
              </div>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <span
              role="status"
              aria-live="polite"
              className={`hidden items-center gap-1 rounded-full px-2 py-1 text-[10px] font-semibold sm:inline-flex ${busy ? 'bg-sky-50 text-sky-800' : 'bg-neutral-100 text-neutral-600'}`}
            >
              {busy && <Loader2 className="h-3 w-3 animate-spin" />}
              {statusLabel}
            </span>
            <button
              type="button"
              onClick={() => setAssetsOpen(true)}
              aria-expanded={assetsOpen}
              aria-label={localizeCopy('素材库', 'Libreria')}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-neutral-600 hover:bg-neutral-100"
            >
              <FolderOpen className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              aria-expanded={settingsOpen}
              aria-label={localizeCopy('设置', 'Impostazioni')}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-neutral-600 hover:bg-neutral-100"
            >
              <Settings2 className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setFocusMode(current => !current)}
              aria-pressed={focusMode}
              aria-label={localizeCopy('专注模式', 'Modalità focus')}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-neutral-600 hover:bg-neutral-100"
            >
              {focusMode ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </button>
          </div>
        </header>

        <div className="flex min-h-0 flex-1">
          {!focusMode && (
            <nav
              aria-label={taskMode ? localizeCopy('经营任务', 'Attività aziendali') : localizeCopy('五项创作', 'Cinque funzioni')}
              className="hidden w-[216px] shrink-0 flex-col gap-1 overflow-y-auto border-r border-neutral-200 bg-white px-2 py-3 lg:flex"
            >
              {taskMode ? (
                <p className="rounded-2xl bg-neutral-50 px-3 py-2 text-[11px] leading-5 text-neutral-600">
                  {localizeCopy('任务由服务端按商家行业和员工权限执行。', 'Le attività sono eseguite dal server secondo settore e permessi.')}
                </p>
              ) : WORKBENCH_CAPABILITIES.map(item => {
                const availability = resolveWorkbenchAvailability(item.id, snapshot);
                const selected = activeCapability === item.id;
                const Icon = capabilityIcons[item.id];
                return (
                  <button
                    key={item.id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => {
                      setCapability(item.id);
                      setNotice(item.id === 'video'
                        ? { text: localizeCopy('当前未接入视频引擎，暂不能创建视频任务。', 'Il motore video non è ancora collegato.'), tone: 'warn' }
                        : null);
                    }}
                    className={`flex items-start gap-2 rounded-2xl px-2.5 py-2 text-left transition ${selected ? 'bg-neutral-900 text-white shadow-sm' : 'text-neutral-700 hover:bg-neutral-50'}`}
                  >
                    <Icon className="mt-0.5 h-4 w-4 shrink-0" />
                    <span className="min-w-0">
                      <span className="block truncate text-[12px] font-semibold">{isIt ? item.labelIt : item.labelZh}</span>
                      <span className={`mt-0.5 block truncate text-[10px] ${selected ? 'text-white/60' : 'text-neutral-400'}`}>
                        {availability.available
                          ? (isIt ? item.hintIt : item.hintZh)
                          : availabilityLabel(availability.reason ?? 'engine_unavailable', isIt)}
                      </span>
                    </span>
                  </button>
                );
              })}
              <p className="mt-3 px-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-400">
                {localizeCopy('最近作品', 'Lavori recenti')}
              </p>
              {designs.slice(0, 5).map(design => (
                  <button
                    key={design.id}
                    type="button"
                    onClick={() => { setAssetsOpen(true); setSelectedResultId(null); }}
                    className="flex items-center gap-2 rounded-xl px-2.5 py-1.5 text-left hover:bg-neutral-50 transition"
                  >
                  <img src={design.imageUrl} alt="" className="h-8 w-8 shrink-0 rounded-md border border-neutral-200 object-cover" loading="lazy" />
                  <span className="min-w-0 flex-1 truncate text-[11px] text-neutral-600">{design.title}</span>
                </button>
              ))}
              {!designs.length && !designsLoading && (
                <p className="px-2 py-1 text-[10px] text-neutral-400">{localizeCopy('暂无已保存作品', 'Nessun lavoro salvato')}</p>
              )}
            </nav>
          )}

          <main className="flex min-h-0 min-w-0 flex-1 flex-col">
            <div ref={streamRef} aria-live="polite" className="min-h-0 min-w-0 flex-1 space-y-3 overflow-y-auto px-3 py-4 sm:px-5">
              {entries.length === 0 && (
                <div className="mx-auto max-w-2xl rounded-3xl border border-dashed border-neutral-300 bg-white/80 p-6 leading-6">
                  <p className="text-[13px] font-semibold text-neutral-900">
                    {localizeCopy('描述一件服装，或先把图片放进素材槽位。', 'Descrivi un capo o inserisci prima un’immagine.')}
                  </p>
                  <p className="mt-1 text-[11px] text-neutral-500">
                    {localizeCopy('五个入口只改变当前意图，不会清空素材与已填写的描述。', 'Le cinque voci cambiano solo l’intento: materiali e testo restano.')}
                  </p>
                </div>
              )}

              {entries.map(entry => {
                if (entry.kind === 'request') {
                  const label = getWorkbenchCapability(entry.capability);
                  return (
                    <div key={entry.id} className="ml-auto max-w-[88%] rounded-2xl bg-neutral-900 px-3.5 py-2.5 text-[13px] leading-6 text-white sm:max-w-[70%]">
                      <p>{entry.text}</p>
                      <p className="mt-1 text-[10px] text-white/60">{isIt ? label.labelIt : label.labelZh}</p>
                    </div>
                  );
                }
                if (entry.kind === 'task') {
                  return entry.role === 'user'
                    ? (
                      <div key={entry.id} className="ml-auto max-w-[88%] whitespace-pre-wrap rounded-2xl bg-neutral-900 px-3.5 py-2.5 text-[13px] leading-6 text-white sm:max-w-[70%]">
                        {entry.text}
                      </div>
                    )
                    : (
                      <div key={entry.id} role="status" className="max-w-[92%] whitespace-pre-wrap rounded-2xl border border-neutral-200 bg-white px-3 py-2.5 text-[11px] leading-5 text-neutral-700">
                        {entry.text}
                      </div>
                    );
                }
                if (entry.kind === 'plan') {
                  return (
                    <div key={entry.id} className="max-w-[92%] rounded-2xl border border-neutral-200 bg-white px-3 py-2.5">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {entry.plan.steps.map((step, index) => {
                          const copy = describeWorkbenchStep(step);
                          return (
                            <span
                              key={`${entry.id}-${step.capability}-${index}`}
                              className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${step.status === 'ready' ? 'border-neutral-300 bg-neutral-50 text-neutral-700' : 'border-amber-300 bg-amber-50 text-amber-900'}`}
                            >
                              {index > 0 && <span aria-hidden="true" className="text-neutral-400">→</span>}
                              {isIt ? copy.it : copy.zh}
                            </span>
                          );
                        })}
                      </div>
                      {entry.plan.constraints.length > 0 && (
                        <p className="mt-1.5 text-[10px] leading-4 text-neutral-500">
                          {localizeCopy('硬约束：', 'Vincoli: ')}{entry.plan.constraints.join(' · ')}
                        </p>
                      )}
                    </div>
                  );
                }

                if (entry.kind === 'status') {
                  return (
                    <div
                      key={entry.id}
                      role="status"
                      className={`flex items-start gap-2 rounded-xl border px-3 py-2 text-[11px] leading-5 ${entry.tone === 'failed' ? 'border-rose-200 bg-rose-50 text-rose-900' : 'border-neutral-200 bg-white text-neutral-600'}`}
                    >
                      {entry.tone === 'failed' ? <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> : <Check className="mt-0.5 h-3.5 w-3.5 shrink-0" />}
                      <span>{entry.text}</span>
                    </div>
                  );
                }
                const result = entry.result;
                const label = getWorkbenchCapability(result.capability);
                const saving = savingResultId === result.id;
                return (
                  <figure key={entry.id} className="max-w-[560px] overflow-hidden rounded-3xl border border-neutral-200 bg-white p-2.5 shadow-sm">
                    <button
                      type="button"
                      onClick={() => { setSelectedResultId(result.id); setInspectorOpen(true); }}
                      className="block w-full overflow-hidden rounded-xl bg-neutral-100"
                      aria-label={localizeCopy('查看结果详情', 'Apri dettaglio risultato')}
                    >
                      <img
                        src={result.imageDataUrl}
                        alt={`${isIt ? label.labelIt : label.labelZh} · ${result.prompt.slice(0, 60)}`}
                        className="max-h-[420px] w-full object-contain"
                      />
                    </button>
                    <figcaption className="mt-2 px-0.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-[11px] font-semibold text-neutral-900">{isIt ? label.labelIt : label.labelZh}</span>
                        <span className={`shrink-0 text-[10px] ${result.savedDesignId ? 'text-emerald-700' : 'text-neutral-400'}`}>
                          {result.savedDesignId
                            ? localizeCopy('已存素材库', 'Nel portfolio')
                            : localizeCopy('未保存', 'Non salvato')}
                        </span>
                      </div>
                      <p className="mt-0.5 truncate text-[10px] text-neutral-500" title={result.prompt}>{result.prompt}</p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <button type="button" onClick={() => startFromResult(result, 'recolor')} className={resultActionClass}>
                          <Palette className="h-3.5 w-3.5" />{localizeCopy('换色', 'Ricolora')}
                        </button>
                        <button type="button" onClick={() => startFromResult(result, 'tryon')} className={resultActionClass}>
                          <UserRound className="h-3.5 w-3.5" />{localizeCopy('试穿', 'Prova')}
                        </button>
                        <button type="button" onClick={() => startFromResult(result, 'studio')} className={resultActionClass}>
                          <Camera className="h-3.5 w-3.5" />{localizeCopy('棚拍', 'Studio')}
                        </button>
                        <button type="button" onClick={() => startFromResult(result, 'video')} className={`${resultActionClass} text-neutral-400`}>
                          <Video className="h-3.5 w-3.5" />{localizeCopy('视频·未接入', 'Video · non attivo')}
                        </button>
                        <button type="button" onClick={() => void saveResult(result)} disabled={Boolean(result.savedDesignId) || saving} className={resultActionPrimaryClass}>
                          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                          {saving ? localizeCopy('保存中', 'Salvataggio') : localizeCopy('保存', 'Salva')}
                        </button>
                        <button type="button" onClick={() => downloadResult(result)} className={resultActionClass} aria-label={localizeCopy('下载', 'Scarica')}>
                          <Download className="h-3.5 w-3.5" />{localizeCopy('下载', 'Scarica')}
                        </button>
                      </div>
                    </figcaption>
                  </figure>
                );
              })}

              {taskPreview && (
                <section aria-label={localizeCopy('任务执行前预览', 'Anteprima attività')} className="max-w-[680px] rounded-2xl border border-neutral-300 bg-white p-3 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[12px] font-semibold text-neutral-900">
                        {localizeCopy('执行前预览', 'Anteprima')} · {taskPreview.workflow}
                      </p>
                      <p className="mt-1 whitespace-pre-wrap text-[11px] leading-5 text-neutral-600">{taskPreview.summary}</p>
                    </div>
                    {taskCatalogLoading && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-neutral-500" />}
                  </div>
                  <p className="mt-2 whitespace-pre-wrap rounded-xl bg-neutral-50 p-2.5 text-[11px] leading-5 text-neutral-700">{taskPreview.message}</p>
                  <p className="mt-2 text-[10px] leading-4 text-neutral-500">{taskPreview.sideEffects}</p>
                  <p className="mt-1 break-words text-[10px] text-neutral-400">
                    {localizeCopy('工具：', 'Strumenti: ')}{taskPreview.tools.join(' · ') || '—'}
                    {' · '}{localizeCopy('角色：', 'Ruoli: ')}{taskPreview.agents.join(' · ') || '—'}
                  </p>
                  {taskPreview.requiresApprovalForSensitiveActions && (
                    <p className="mt-1 text-[10px] font-medium text-neutral-700">{localizeCopy('敏感操作仍需商家审批。', 'Le azioni sensibili richiedono approvazione.')}</p>
                  )}
                  {taskPreview.draftRequired && (
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      <label className="grid gap-1 text-[10px] font-medium text-neutral-600">
                        {localizeCopy('启用供应商', 'Fornitore attivo')}
                        <select
                          value={taskDraft.supplierId}
                          disabled={taskRetryLocked || taskCatalogLoading}
                          onChange={event => setTaskDraft(current => ({ ...current, supplierId: event.currentTarget.value }))}
                          className="min-h-9 rounded-lg border border-neutral-300 bg-white px-2 text-[11px] text-neutral-800 disabled:bg-neutral-100"
                        >
                          <option value="">{localizeCopy('请选择供应商', 'Seleziona un fornitore')}</option>
                          {taskSuppliers.map(supplier => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}
                        </select>
                      </label>
                      <label className="grid gap-1 text-[10px] font-medium text-neutral-600">
                        {localizeCopy('商品', 'Prodotto')}
                        <select
                          value={taskDraft.productId}
                          disabled={taskRetryLocked || taskCatalogLoading}
                          onChange={event => {
                            const product = taskProducts.find(item => item.id === event.currentTarget.value);
                            const firstVariant = product?.skus.find(sku => Boolean(sku.variantId) && sku.isActive !== false);
                            setTaskDraft(current => ({
                              ...current,
                              productId: product?.id || '',
                              variantId: firstVariant?.variantId || ''
                            }));
                          }}
                          className="min-h-9 rounded-lg border border-neutral-300 bg-white px-2 text-[11px] text-neutral-800 disabled:bg-neutral-100"
                        >
                          <option value="">{localizeCopy('请选择商品', 'Seleziona un prodotto')}</option>
                          {taskProducts.map(product => <option key={product.id} value={product.id}>{product.styleNo} · {product.name}</option>)}
                        </select>
                      </label>
                      <label className="grid gap-1 text-[10px] font-medium text-neutral-600">
                        {localizeCopy('SKU / 规格', 'SKU / variante')}
                        <select
                          value={taskDraft.variantId}
                          disabled={taskRetryLocked || taskCatalogLoading || !taskVariants.length}
                          onChange={event => setTaskDraft(current => ({ ...current, variantId: event.currentTarget.value }))}
                          className="min-h-9 rounded-lg border border-neutral-300 bg-white px-2 text-[11px] text-neutral-800 disabled:bg-neutral-100"
                        >
                          <option value="">{localizeCopy('请选择 SKU', 'Seleziona uno SKU')}</option>
                          {taskVariants.map(variant => (
                            <option key={variant.variantId} value={variant.variantId}>
                              {[variant.sku, variant.color, variant.size].filter(Boolean).join(' · ')}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="grid gap-1 text-[10px] font-medium text-neutral-600">
                        {localizeCopy('采购数量', 'Quantità')}
                        <input
                          type="number"
                          min="1"
                          step="1"
                          value={taskDraft.quantity}
                          disabled={taskRetryLocked}
                          onChange={event => setTaskDraft(current => ({ ...current, quantity: event.currentTarget.value }))}
                          className="min-h-9 rounded-lg border border-neutral-300 bg-white px-2 text-[11px] text-neutral-800 disabled:bg-neutral-100"
                        />
                      </label>
                      <label className="grid gap-1 text-[10px] font-medium text-neutral-600 sm:col-span-2">
                        {localizeCopy('单位成本（EUR）', 'Costo unitario (EUR)')}
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={taskDraft.unitCost}
                          disabled={taskRetryLocked}
                          onChange={event => setTaskDraft(current => ({ ...current, unitCost: event.currentTarget.value }))}
                          className="min-h-9 rounded-lg border border-neutral-300 bg-white px-2 text-[11px] text-neutral-800 disabled:bg-neutral-100"
                        />
                      </label>
                      {taskCatalog && (!taskSuppliers.length || !taskProducts.length) && (
                        <p role="status" className="text-[10px] leading-4 text-neutral-600 sm:col-span-2">
                          {localizeCopy(
                            !taskSuppliers.length ? '没有可用的启用供应商。' : '没有可用于采购的商品 SKU。',
                            !taskSuppliers.length ? 'Nessun fornitore attivo disponibile.' : 'Nessun prodotto con SKU acquistabile.'
                          )}
                        </p>
                      )}
                    </div>
                  )}
                  <div className="mt-3 flex flex-wrap justify-end gap-2">
                    <button
                      type="button"
                      onClick={cancelMerchantTaskPreview}
                      disabled={busy || taskRetryLocked}
                      className="min-h-8 rounded-lg border border-neutral-300 px-3 text-[11px] font-semibold text-neutral-700 disabled:opacity-50"
                    >
                      {localizeCopy('返回修改', 'Modifica')}
                    </button>
                    <button
                      type="button"
                      onClick={() => void confirmMerchantTask()}
                      disabled={busy || taskCatalogLoading || (taskPreview.draftRequired && !taskDraftValid)}
                      className="min-h-8 rounded-lg bg-neutral-900 px-3 text-[11px] font-semibold text-white disabled:bg-neutral-300"
                    >
                      {taskStartedAt !== null
                        ? localizeCopy('提交中…', 'Invio…')
                        : taskRetryLocked
                          ? localizeCopy('用同一请求重试', 'Riprova stessa richiesta')
                          : localizeCopy('确认并执行', 'Conferma ed esegui')}
                    </button>
                  </div>
                </section>
              )}
              {pendingTaskId && taskStartedAt === null && (
                <div role="status" className="flex max-w-[680px] items-center justify-between gap-3 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-[10px] text-neutral-600">
                  <span>{localizeCopy(`任务 ${pendingTaskId} 尚未终结。`, `Attività ${pendingTaskId} non ancora conclusa.`)}</span>
                  <button type="button" onClick={() => {
                    const statusEntry = [...entries].reverse().find(entry => entry.kind === 'task' && entry.role === 'assistant');
                    if (statusEntry) {
                      setTaskStartedAt(Date.now());
                      void pollMerchantTask(pendingTaskId, statusEntry.id).finally(() => setTaskStartedAt(null));
                    }
                  }} className="shrink-0 rounded-lg border border-neutral-300 px-2 py-1 font-semibold text-neutral-700">
                    {localizeCopy('查询状态', 'Aggiorna')}
                  </button>
                </div>
              )}
              {busy && (
                <div role="status" className="flex items-center gap-2 rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-[11px] text-sky-900">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  {taskStartedAt !== null
                    ? localizeCopy(`ModaUI 业务任务处理中 · 已用 ${elapsed}s`, `Attività ModaUI in corso · ${elapsed}s`)
                    : localizeCopy(`真实图像任务执行中 · 已用 ${elapsed}s`, `Attività immagine reale · ${elapsed}s`)}
                </div>
              )}
            </div>

            <footer
              className="min-w-0 shrink-0 border-t border-neutral-200 bg-white px-2 pt-2 sm:px-4"
              style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
            >
              <div className="flex items-center gap-1.5 pb-2">
                <button
                  type="button"
                  aria-pressed={!taskMode}
                  disabled={busy || taskRetryLocked}
                  onClick={() => switchTaskMode(false)}
                  className={`min-h-8 rounded-xl border px-3 text-[11px] font-semibold disabled:opacity-50 ${!taskMode ? 'border-neutral-900 bg-neutral-900 text-white' : 'border-neutral-200 bg-white text-neutral-600'}`}
                >
                  {localizeCopy('创作', 'Creatività')}
                </button>
                <button
                  type="button"
                  aria-pressed={taskMode}
                  disabled={busy || taskRetryLocked}
                  onClick={() => switchTaskMode(true)}
                  className={`min-h-8 rounded-xl border px-3 text-[11px] font-semibold disabled:opacity-50 ${taskMode ? 'border-neutral-900 bg-neutral-900 text-white' : 'border-neutral-200 bg-white text-neutral-600'}`}
                >
                  {localizeCopy('业务任务', 'Attività')}
                </button>
                {taskMode && (
                  <span className="ml-auto text-[10px] text-neutral-500">
                    {localizeCopy('预览后确认，业务由服务端执行', 'Anteprima e conferma; esecuzione server-side')}
                  </span>
                )}
              </div>
              {!taskMode && <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-2 lg:hidden">
                {WORKBENCH_CAPABILITIES.map(item => {
                  const availability = resolveWorkbenchAvailability(item.id, snapshot);
                  const selected = activeCapability === item.id;
                  const Icon = capabilityIcons[item.id];
                  return (
                    <button
                      key={item.id}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => {
                        setCapability(item.id);
                        setNotice(item.id === 'video'
                          ? { text: localizeCopy('当前未接入视频引擎，暂不能创建视频任务。', 'Il motore video non è ancora collegato.'), tone: 'warn' }
                          : null);
                      }}
                      className={`inline-flex shrink-0 items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-[11px] font-semibold ${selected ? 'border-neutral-900 bg-neutral-900 text-white shadow-sm' : 'border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50'}`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {isIt ? item.labelIt : item.labelZh}
                      {!availability.available && (
                        <span className={`text-[9px] ${selected ? 'text-white/70' : 'text-amber-700'}`}>
                          {availabilityLabel(availability.reason ?? 'engine_unavailable', isIt)}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>}

              {showTryOnSlots && (
                <div className="grid gap-2 pb-2 sm:grid-cols-2">
                  {(['person', 'garment'] as const).map(slot => {
                    const dataUrl = slot === 'person' ? assets.person : assets.garment;
                    const name = slot === 'person' ? assets.personName : assets.garmentName;
                    return (
                      <div key={slot} className="rounded-2xl border border-dashed border-neutral-300 bg-white p-2 shadow-sm">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-neutral-500">
                            {slot === 'person' ? localizeCopy('人物 / 模特', 'Persona / modello') : localizeCopy('服装', 'Capo')}
                          </span>
                          {dataUrl && (
                            <button type="button" onClick={() => clearAsset(slot)} className="rounded p-0.5 text-neutral-400 hover:bg-neutral-200 hover:text-neutral-700" aria-label={localizeCopy('移除素材', 'Rimuovi')}>
                              <X className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                        <div className="mt-1.5 flex items-center gap-2">
                          {dataUrl && <img src={dataUrl} alt="" className="h-12 w-12 rounded-md border border-neutral-200 object-cover" />}
                          <button
                            type="button"
                            onClick={() => (slot === 'person' ? personInputRef : garmentInputRef).current?.click()}
                            className="inline-flex min-h-8 items-center gap-1 rounded-lg border border-neutral-300 bg-white px-2 text-[11px] font-semibold text-neutral-700"
                          >
                            <ImagePlus className="h-3.5 w-3.5" />
                            {dataUrl ? localizeCopy('更换', 'Sostituisci') : localizeCopy('上传', 'Carica')}
                          </button>
                          {name && <span className="min-w-0 flex-1 truncate text-[10px] text-neutral-400">{name}</span>}
                        </div>
                      </div>
                    );
                  })}
                  <label className="flex items-start gap-2 text-[10px] leading-4 text-neutral-600 sm:col-span-2">
                    <input type="checkbox" checked={consent} onChange={event => setConsent(event.currentTarget.checked)} className="mt-0.5 h-3.5 w-3.5 rounded border-neutral-300" />
                    {localizeCopy('我确认人物照片已获得本人授权，仅用于本次试穿。', 'Confermo di avere l’autorizzazione della persona nella foto.')}
                  </label>
                </div>
              )}


              {!taskMode && <div className="flex flex-wrap items-center gap-1.5 pb-1.5 text-[10px]">
                <span className="font-semibold text-neutral-700">
                  {isIt ? getWorkbenchCapability(activeCapability).labelIt : getWorkbenchCapability(activeCapability).labelZh}
                </span>
                {plan.steps.slice(1).map((step, index) => {
                  const copy = describeWorkbenchStep(step);
                  return (
                    <span key={`next-${step.capability}-${index}`} className={step.status === 'ready' ? 'text-neutral-500' : 'text-amber-700'}>
                      → {isIt ? copy.it : copy.zh}
                    </span>
                  );
                })}
                {missingCopy && <span className="font-semibold text-rose-700">{isIt ? missingCopy.it : missingCopy.zh}</span>}
                {!missingCopy && laterMissingCopy && (
                  <span className="text-neutral-500">
                    {localizeCopy('下一步还需要：', 'Poi serve: ')}
                    {isIt ? laterMissingCopy.it.replace(/^Serve ancora: /, '') : laterMissingCopy.zh.replace(/^还需要：/, '')}
                  </span>
                )}
              </div>}

              {notice && (
                <div
                  role="status"
                  className={`mb-1.5 rounded-xl border px-2.5 py-1.5 text-[11px] leading-5 ${notice.tone === 'warn' ? 'border-amber-300 bg-amber-50 text-amber-900' : 'border-sky-200 bg-sky-50 text-sky-900'}`}
                >
                  {notice.text}
                </div>
              )}
                {entitlementsError && (
                  <div role="status" className="mb-1.5 rounded-xl border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-[11px] leading-5 text-rose-900">
                    {localizeCopy('套餐与额度未能加载，生成仍会由服务端校验。', 'Piano e crediti non caricati: il server verificherà comunque.')}
                  </div>
                )}

              <div className="flex min-w-0 items-end gap-1.5 rounded-3xl border border-neutral-300 bg-white p-1.5 shadow-sm">
                {!taskMode && <button
                  type="button"
                  onClick={() => garmentInputRef.current?.click()}
                  aria-label={localizeCopy('添加服装图片', 'Aggiungi immagine capo')}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-neutral-500 hover:bg-neutral-100"
                >
                  <ImagePlus className="h-4 w-4" />
                </button>}
                {!taskMode && <button
                  type="button"
                  onClick={() => personInputRef.current?.click()}
                  aria-label={localizeCopy('添加人物图片', 'Aggiungi immagine persona')}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-neutral-500 hover:bg-neutral-100"
                >
                  <UserRound className="h-4 w-4" />
                </button>}
                <textarea
                  value={draft}
                  disabled={busy || Boolean(taskPreview)}
                  onChange={event => {
                    setDraft(event.target.value);
                    coreLife.emit({ type: 'input:change', length: event.target.value.length });
                  }}
                  onFocus={() => coreLife.emit({ type: 'input:focus' })}
                  onBlur={() => coreLife.emit({ type: 'input:blur' })}
                  onKeyDown={event => {
                    if (event.key === 'Enter' && !event.shiftKey) {
                      event.preventDefault();
                      void submit();
                    }
                  }}
                  rows={1}
                  aria-label={taskMode ? localizeCopy('描述要执行的业务任务', 'Descrivi l’attività aziendale') : localizeCopy('描述你的创作需求', 'Descrivi la tua richiesta')}
                  placeholder={taskMode
                    ? localizeCopy('描述要执行的业务任务，例如比较供应商或创建采购草稿…', 'Descrivi l’attività, ad esempio confrontare fornitori o creare una bozza…')
                    : localizeCopy('描述你想做什么，或拖入服装图、人物图…', 'Descrivi cosa vuoi creare o trascina un’immagine…')}
                  className="max-h-32 min-h-10 min-w-0 flex-1 resize-none bg-transparent px-1 py-2 text-[13px] leading-5 outline-none placeholder:text-neutral-400"
                />
                <button
                  type="button"
                  onClick={() => void submit()}
                  disabled={busy || Boolean(taskPreview)}
                  className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-2xl bg-neutral-900 px-3 text-[12px] font-semibold text-white transition hover:bg-neutral-800 disabled:bg-neutral-300 disabled:text-neutral-500"
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  {busy ? `${elapsed}s` : taskMode ? localizeCopy('预览任务', 'Anteprima') : localizeCopy('生成', 'Genera')}
                </button>
              </div>
              <p className="mt-1 text-[10px] text-neutral-400">
                {taskMode
                  ? localizeCopy('Enter 预览 · Shift+Enter 换行 · 确认后才提交服务端任务', 'Invio anteprima · Shift+Invio a capo · invio al server solo dopo conferma')
                  : localizeCopy('Enter 生成 · Shift+Enter 换行 · 每张图片按服务端额度计费', 'Invio genera · Shift+Invio a capo · ogni immagine consuma crediti')}
              </p>
            </footer>

            <input
              ref={garmentInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={event => { void acceptAsset('garment', event.currentTarget.files?.[0]); event.currentTarget.value = ''; }}
            />
            <input
              ref={personInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={event => { void acceptAsset('person', event.currentTarget.files?.[0]); event.currentTarget.value = ''; }}
            />
          </main>

          {!focusMode && inspectorBody && (
            <aside className="hidden w-[300px] shrink-0 overflow-y-auto border-l border-neutral-200 bg-white px-3 py-4 xl:block">
              {inspectorBody}
            </aside>
          )}
        </div>


        {assetsOpen && (
          <div
            className="fixed inset-0 z-[120] flex justify-end bg-neutral-950/30"
            role="presentation"
            onClick={() => setAssetsOpen(false)}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-label={localizeCopy('素材库', 'Libreria materiali')}
              className="flex h-full w-full max-w-[420px] flex-col bg-white shadow-2xl"
              onClick={event => event.stopPropagation()}
            >
              <div className="flex h-12 shrink-0 items-center justify-between border-b border-neutral-200 px-3">
                <p className="text-[13px] font-semibold">{localizeCopy('素材库', 'Libreria materiali')}</p>
                <div className="flex items-center gap-1">
                  <button type="button" onClick={() => void loadDesigns()} className="rounded p-1.5 text-neutral-500 hover:bg-neutral-100" aria-label={localizeCopy('刷新', 'Aggiorna')}>
                    <RefreshCw className={`h-4 w-4 ${designsLoading ? 'animate-spin' : ''}`} />
                  </button>
                  <button type="button" onClick={() => setAssetsOpen(false)} className="rounded p-1.5 text-neutral-500 hover:bg-neutral-100" aria-label={localizeCopy('关闭', 'Chiudi')}>
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto p-3">
                {designsNotice && <p role="status" className="mb-2 rounded-lg bg-rose-50 px-2 py-1.5 text-[11px] text-rose-900">{designsNotice}</p>}
                {!designs.length && !designsLoading && (
                  <p className="py-8 text-center text-[11px] text-neutral-400">{localizeCopy('还没有保存的作品。', 'Nessun lavoro salvato.')}</p>
                )}
                <div className="grid grid-cols-2 gap-2">
                  {designs.map(design => (
                    <div key={design.id} className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
                      <img src={design.imageUrl} alt={design.title} className="aspect-square w-full object-cover" loading="lazy" />
                      <div className="space-y-1 p-1.5">
                        <p className="truncate text-[10px] font-semibold text-neutral-700" title={design.title}>{design.title}</p>
                        <div className="flex gap-1">
                          <button
                            type="button"
                            onClick={() => void useSavedDesign(design, 'recolor')}
                            className="flex-1 rounded-md border border-neutral-200 px-1 py-1 text-[10px] font-semibold text-neutral-700"
                          >
                            {localizeCopy('换色', 'Ricolora')}
                          </button>
                          <button
                            type="button"
                            onClick={() => void useSavedDesign(design, 'tryon')}
                            className="flex-1 rounded-md border border-neutral-200 px-1 py-1 text-[10px] font-semibold text-neutral-700"
                          >
                            {localizeCopy('试穿', 'Prova')}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}


        {settingsOpen && (
          <div className="fixed inset-0 z-[121] flex items-center justify-center bg-neutral-950/30 p-4" role="presentation" onClick={() => setSettingsOpen(false)}>
            <div
              role="dialog"
              aria-modal="true"
              aria-label={localizeCopy('设置', 'Impostazioni')}
              className="w-full max-w-sm rounded-2xl bg-white p-4 shadow-xl"
              onClick={event => event.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <p className="text-[13px] font-semibold">{localizeCopy('设置', 'Impostazioni')}</p>
                <button type="button" onClick={() => setSettingsOpen(false)} className="rounded p-1 text-neutral-500 hover:bg-neutral-100" aria-label={localizeCopy('关闭', 'Chiudi')}>
                  <X className="h-4 w-4" />
                </button>
              </div>
              <dl className="mt-3 space-y-2 text-[11px]">
                <div className="flex items-center justify-between gap-2">
                  <dt className="text-neutral-500">{localizeCopy('套餐', 'Piano')}</dt>
                  <dd className="font-semibold text-neutral-900">{entitlements?.plan ?? '—'}</dd>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <dt className="text-neutral-500">{localizeCopy('剩余图片额度', 'Crediti immagine')}</dt>
                  <dd className="font-semibold text-neutral-900">{entitlements ? entitlements.remaining.imageGeneration : '—'}</dd>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <dt className="text-neutral-500">{localizeCopy('剩余试穿额度', 'Crediti prova')}</dt>
                  <dd className="font-semibold text-neutral-900">{entitlements ? entitlements.remaining.tryOn : '—'}</dd>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <dt className="text-neutral-500">{localizeCopy('图片引擎', 'Motore immagini')}</dt>
                  <dd className="font-semibold text-neutral-900">{entitlements?.providers.image ?? '—'}</dd>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <dt className="text-neutral-500">{localizeCopy('本次生成数量', 'Immagini per richiesta')}</dt>
                  <dd className="flex items-center gap-1">
                    {[1, 2, 3].map(count => (
                      <button
                        key={count}
                        type="button"
                        aria-pressed={imageCount === count}
                        onClick={() => setImageCount(count)}
                        className={`h-7 w-7 rounded-md border text-[11px] font-semibold ${imageCount === count ? 'border-neutral-900 bg-neutral-900 text-white' : 'border-neutral-200 text-neutral-700'}`}
                      >
                        {count}
                      </button>
                    ))}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <dt className="text-neutral-500">{localizeCopy('数字生命动效', 'Animazione DigitalLife')}</dt>
                  <dd>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={motionEnabled}
                      onClick={() => {
                        const next = !motionEnabled;
                        setMotionEnabled(next);
                        try { window.localStorage.setItem('modaui.workbench.motion', next ? 'on' : 'off'); } catch { /* 存储不可用时保持内存状态 */ }
                      }}
                      className={`h-6 w-11 rounded-full border transition ${motionEnabled ? 'border-neutral-900 bg-neutral-900' : 'border-neutral-300 bg-neutral-200'}`}
                    >
                      <span className={`block h-4 w-4 rounded-full bg-white transition ${motionEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                  </dd>
                </div>
              </dl>
              <p className="mt-3 text-[10px] leading-4 text-neutral-400">
                {localizeCopy('额度与引擎状态来自服务端，不在本地推算。', 'Crediti e motore provengono dal server.')}
              </p>
            </div>
          </div>
        )}

        {selectedResult && inspectorOpen && (
          <div className="fixed inset-0 z-[122] flex items-end bg-neutral-950/30 xl:hidden" role="presentation" onClick={() => setInspectorOpen(false)}>
            <div
              role="dialog"
              aria-modal="true"
              aria-label={localizeCopy('结果检查', 'Verifica risultato')}
              className="max-h-[80dvh] w-full overflow-y-auto rounded-t-2xl bg-white p-4"
              onClick={event => event.stopPropagation()}
            >
              {inspectorBody}
            </div>
          </div>
        )}

        {recolorSource && (
          <div className="fixed inset-0 z-[130] overflow-y-auto bg-[#f5f5f7] px-3 py-4">
            <ModaGptGarmentRecolor
              initialImageDataUrl={recolorSource}
              onBack={() => setRecolorSource(null)}
              onSaved={detail => {
                if (detail) {
                  void appendResult({
                    capability: 'recolor',
                    imageDataUrl: detail.dataUrl,
                    prompt: buildRecolorPrompt(detail.color),
                    taskId: null,
                    parentId: null,
                    recolor: true
                  });
                }
                void loadDesigns();
                setRecolorSource(null);
              }}
            />
          </div>
        )}
      </div>
    </ModaCoreStageProvider>
  );
};


const capabilityIcons: Record<WorkbenchCapabilityId, React.ComponentType<{ className?: string }>> = {
  design: Shirt,
  tryon: UserRound,
  recolor: Palette,
  studio: Camera,
  video: Video
};

const resultActionClass = 'inline-flex items-center gap-1 rounded-lg border border-neutral-200 px-2 py-1 text-[10px] font-semibold text-neutral-700 transition hover:border-neutral-400 hover:bg-neutral-50 disabled:opacity-40';
const resultActionPrimaryClass = 'inline-flex items-center gap-1 rounded-lg bg-neutral-900 px-2 py-1 text-[10px] font-semibold text-white transition disabled:bg-neutral-200 disabled:text-neutral-500';

function availabilityLabel(reason: 'not_integrated' | 'plan_required' | 'engine_unavailable', isIt: boolean): string {
  if (reason === 'not_integrated') return isIt ? 'non attivo' : '未接入';
  if (reason === 'plan_required') return isIt ? 'piano richiesto' : '需升级套餐';
  return isIt ? 'motore non disponibile' : '引擎不可用';
}

function workbenchErrorCopy(error: unknown, isIt: boolean): string {
  if (error instanceof ApiError && error.status === 401) {
    return isIt ? 'Sessione scaduta: accedi di nuovo.' : '登录已过期，请重新登录。';
  }
  const code = error instanceof ApiError ? error.code : error instanceof Error ? error.message : '';
  const table: Record<string, [string, string]> = {
    MODAGPT_QUOTA_EXCEEDED: ['图片额度已用完。', 'Crediti immagine esauriti.'],
    MODAGPT_CREDITS_INSUFFICIENT: ['积分不足，请充值或升级套餐。', 'Crediti insufficienti.'],
    MODAGPT_UPGRADE_REQUIRED: ['当前套餐不支持该能力。', 'Il piano corrente non include questa funzione.'],
    MODAGPT_FEATURE_NOT_ENTITLED: ['当前套餐未开通该能力。', 'Funzione non inclusa nel piano.'],
    MODAGPT_IMAGE_REQUEST_INVALID: ['请求参数不合法，请检查描述长度。', 'Parametri non validi: controlla la descrizione.'],
    MODAGPT_AI_REQUEST_ALREADY_PROCESSED: ['该请求已处理，请勿重复提交。', 'Richiesta già elaborata.'],
    MODAGPT_IMAGE_TASK_STILL_PROCESSING: ['任务仍在处理中，请稍后刷新。', 'Attività ancora in corso: aggiorna più tardi.'],
    MODAGPT_IMAGE_TASK_FAILED: ['图像任务失败，请重试。', 'Attività immagine non riuscita: riprova.'],
    MODAGPT_IMAGE_TASK_NOT_FOUND: ['任务记录已失效，请重新生成。', 'Attività non trovata: rigenera.'],
    MODAGPT_IMAGE_STORAGE_KEY_FORBIDDEN: ['素材不属于当前商家。', 'Materiale non appartenente a questo negozio.'],
    MODAUI_WORKBENCH_CONSENT_REQUIRED: ['请先确认人物授权。', 'Conferma prima l’autorizzazione.'],
    MODAUI_WORKBENCH_ASSET_MISSING: ['缺少人物或服装图片。', 'Mancano persona o capo.'],
    MODAUI_WORKBENCH_BRIEF_REQUIRED: ['请先描述要展示的款式与场景。', 'Descrivi capo e scena.'],
    MODAUI_WORKBENCH_ASSET_FETCH_FAILED: ['素材读取失败，请重试。', 'Lettura materiale non riuscita.'],
    MODAUI_WORKBENCH_CANVAS_UNAVAILABLE: ['浏览器无法处理该图片。', 'Il browser non può elaborare l’immagine.']
  };
  const entry = code ? table[code] : undefined;
  if (entry) return isIt ? entry[1] : entry[0];
  if (error instanceof Error && error.message && !/^[A-Z0-9_]{6,}$/.test(error.message)) return error.message;
  return isIt ? 'Operazione non riuscita, riprova.' : '操作失败，请重试。';
}

function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('MODAUI_WORKBENCH_CANVAS_UNAVAILABLE'));
    image.src = src;
  });
}

/** 服务端资产接口只接受 WebP data URL；非 WebP 结果在这里无损转码一次。 */
async function ensureWebpDataUrl(dataUrl: string): Promise<string> {
  if (/^data:image\/webp;base64,/.test(dataUrl)) return dataUrl;
  const image = await loadImageElement(dataUrl);
  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('MODAUI_WORKBENCH_CANVAS_UNAVAILABLE');
  context.drawImage(image, 0, 0);
  return canvas.toDataURL('image/webp', 0.92);
}

async function loadRemoteImageDataUrl(url: string): Promise<string> {
  const response = await fetch(url, { credentials: 'include' });
  if (!response.ok) throw new Error('MODAUI_WORKBENCH_ASSET_FETCH_FAILED');
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === 'string'
      ? resolve(reader.result)
      : reject(new Error('MODAUI_WORKBENCH_ASSET_FETCH_FAILED'));
    reader.onerror = () => reject(new Error('MODAUI_WORKBENCH_ASSET_FETCH_FAILED'));
    reader.readAsDataURL(blob);
  });
}
