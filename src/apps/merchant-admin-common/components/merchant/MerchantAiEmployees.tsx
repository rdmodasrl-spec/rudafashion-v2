import React, { useEffect, useState } from 'react';
import { Bot, BrainCircuit, ChevronDown, CirclePause, History, Image, Megaphone, PackageSearch, Palette, PenLine, Play, RefreshCw, ShieldCheck, Sparkles, UserRound, Users } from 'lucide-react';
import { apiDelete, apiGet, apiPatch, apiPost, apiPostWithUploadProgress } from '../../../../api/client';
import { useB2B } from '../../../../context/B2BContext';
import { getIntlLocale } from '../../../../i18n/translations';



type EmployeeStatus = 'planned' | 'development' | 'pilot' | 'available' | 'paused';
type Installation = {
  id: string;
  status: 'requested' | 'active' | 'paused' | 'declined';
  grantedPermissions: string[];
  createdAt: string;
  updatedAt: string;
};
type AiEmployee = {
  id: string;
  slug: string;
  name: string;
  department: string;
  description: string;
  version: string;
  status: EmployeeStatus;
  capabilities: string[];
  requiredPermissions: string[];
  installation: Installation | null;
};
type ProductCatalogItem = {
  id: string;
  styleNo: string;
  name: string;
  name_zh: string | null;
  name_it: string | null;
  brand: string;
  category: string;
  subCategory: string;
  wholesalePrice: string | number;
  moq: number;
  lifecycleStatus: string;
  inventoryStatus: string;
  updatedAt: string;
};
type ProductContentDraft = {
  id: string;
  productId: string;
  productName?: string;
  styleNo?: string;
  language: 'zh' | 'it' | 'en';
  title: string;
  description: string;
  status: 'pending' | 'applied' | 'rejected' | 'superseded' | 'stale';
  createdAt: string;
  updatedAt: string;
};
type SupplierProductCandidate = {
  styleNo: string;
  name: string;
  brand: string;
  category: string;
  subCategory: string;
  season: string;
  fabric: string;
  composition: string;
  description: string;
  wholesalePrice: number | null;
  rrpPrice: number | null;
  moq: number | null;
};
type ProductImportDraft = {
  id: string;
  sourceFilename: string;
  sourceType: 'image' | 'pdf' | 'csv' | 'xlsx';
  candidate: SupplierProductCandidate;
  status: 'pending' | 'created' | 'rejected';
  createdAt: string;
};
type AiTeamTask = {
  employeeSlug: string;
  employeeName: string;
  tool: string;
  search: string;
  resultCount: number;
};
type AiEmployeeMemoryCategory = 'preference' | 'brand_voice' | 'operating_rule';
type AiEmployeeMemory = {
  id: string;
  category: AiEmployeeMemoryCategory;
  content: string;
  updatedAt: string;
};
type AiEmployeeCreativeDraft = {
  id: string;
  productId: string | null;
  prompt: string;
  imageMime: string;
  imageWidth: number;
  imageHeight: number;
  model: string;
  status: 'pending_review' | 'approved' | 'rejected';
  createdAt: string;
  reviewedAt: string | null;
};
type CreativeProductOption = {
  id: string;
  styleNo: string;
  name: string;
  lifecycleStatus: string;
};
type AiEmployeeInventoryRecord = {
  styleNo: string;
  productName: string;
  sku: string;
  color: string | null;
  size: string | null;
  onHandQuantity: number;
  reservedQuantity: number;
  availableQuantity: number;
  inTransitQuantity: number;
  location: string;
  updatedAt: string;
};
type AiEmployeeSalesSummary = {
  periodStart: string;
  periodEnd: string;
  orderCount: number;
  totalAmount: number;
  totalQuantity: number;
  byStatus: { status: string; orderCount: number; totalAmount: number; totalQuantity: number }[];
};
type AiEmployeeReplenishmentRecommendation = AiEmployeeInventoryRecord & {
  soldLast30Days: number;
  estimatedDaysOfCover: number | null;
  suggestedReorderQuantity: number;
};
type AiEmployeeActivity = {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  createdAt: string;
};

const phaseLabels: Record<EmployeeStatus, string> = {
  planned: '规划中',
  development: '开发中',
  pilot: '内部试点',
  available: '可开通',
  paused: '平台暂停'
};
const productCatalogReadPermission = 'product.catalog.read';
const productImportDraftPermission = 'product.import.draft';
const productCreativeGeneratePermission = 'product.creative.generate';
const inventoryStockReadPermission = 'inventory.stock.read';
const salesSummaryReadPermission = 'sales.summary.read';
const productDraftKey = (productId: string, language: ProductContentDraft['language']) => `${productId}:${language}`;
const getActivityLabel = (action: string, isIt: boolean) => {
  const labels: Record<string, [string, string]> = {
    AI_EMPLOYEE_INSTALLED: ['已加入 AI 团队', 'Aggiunto al team AI'],
    AI_EMPLOYEE_REQUESTED: ['已提交员工开通申请', 'Richiesta di attivazione inviata'],
    AI_EMPLOYEE_PAUSED: ['已暂停 AI 员工', 'Dipendente AI in pausa'],
    AI_EMPLOYEE_RESUMED: ['已恢复 AI 员工', 'Dipendente AI riattivato'],
    AI_EMPLOYEE_PERMISSIONS_UPDATED: ['已更新数据授权', 'Autorizzazioni aggiornate'],
    AI_EMPLOYEE_PRODUCT_CATALOG_READ: ['已读取商品目录', 'Catalogo prodotti consultato'],
    AI_EMPLOYEE_INVENTORY_READ: ['已读取本店实际库存', 'Giacenze del negozio consultate'],
    AI_EMPLOYEE_SALES_SUMMARY_READ: ['已读取本店聚合销售摘要', 'Riepilogo vendite aggregato consultato'],
    AI_EMPLOYEE_TASK_COMPLETED: ['已完成商品查询任务', 'Ricerca prodotti completata'],
    AI_TEAM_TASK_DELEGATED: ['AI 总管已分派员工任务', 'Compito assegnato dal Manager AI'],
    AI_TEAM_RUN_COMPLETED: ['AI 团队任务已完成', 'Compito del team AI completato'],
    AI_TEAM_CAPABILITY_UNAVAILABLE: ['该任务超出已接入员工能力', 'Compito fuori dalle capacità attive'],
    AI_EMPLOYEE_MEMORY_CREATED: ['已添加 AI 团队长期记忆', 'Memoria del team AI aggiunta'],
    AI_EMPLOYEE_MEMORY_UPDATED: ['已修改 AI 团队长期记忆', 'Memoria del team AI aggiornata'],
    AI_EMPLOYEE_MEMORY_DELETED: ['已删除 AI 团队长期记忆', 'Memoria del team AI eliminata'],
    AI_EMPLOYEE_CREATIVE_GENERATED: ['已生成待审核创意图片', 'Immagine creativa generata per revisione'],
    AI_EMPLOYEE_CREATIVE_APPROVED: ['已审核通过创意图片', 'Immagine creativa approvata'],
    AI_EMPLOYEE_CREATIVE_REJECTED: ['已拒绝创意图片', 'Immagine creativa rifiutata'],
    AI_EMPLOYEE_CREATIVE_DELETED: ['已删除创意图片', 'Immagine creativa eliminata'],
    AI_EMPLOYEE_CREATIVE_ATTACHED_TO_PRODUCT: ['已将审核通过的创意图片加入商品', 'Immagine creativa approvata aggiunta al prodotto'],
    AI_EMPLOYEE_CONTENT_DRAFT_GENERATED: ['已生成商品文案草稿', 'Bozza prodotto generata'],
    AI_EMPLOYEE_CONTENT_DRAFT_SUPERSEDED: ['旧草稿已被新草稿替代', 'Bozza precedente sostituita'],
    AI_EMPLOYEE_CONTENT_DRAFT_STALE: ['草稿因商品已变更而过期', 'Bozza obsoleta: prodotto modificato'],
    AI_EMPLOYEE_CONTENT_DRAFT_APPLIED: ['已审核并应用商品文案', 'Bozza approvata e applicata'],
    AI_EMPLOYEE_CONTENT_DRAFT_REJECTED: ['已拒绝商品文案草稿', 'Bozza rifiutata'],
    AI_EMPLOYEE_PRODUCT_IMPORT_EXTRACTED: ['已识别供应商商品资料', 'Dati prodotto estratti'],
    AI_EMPLOYEE_PRODUCT_IMPORT_DRAFT_CREATED: ['已创建待完善的商品草稿', 'Bozza prodotto creata'],
    AI_EMPLOYEE_PRODUCT_IMPORT_REJECTED: ['已拒绝导入商品资料', 'Importazione rifiutata']
  };
  const label = labels[action];
  return label ? label[isIt ? 1 : 0] : action.replace(/^AI_EMPLOYEE_/, '').replaceAll('_', ' ');
};

export const MerchantAiEmployees: React.FC<{ isIt: boolean }> = ({ isIt }) => {
  const { localizeCopy, lang } = useB2B();
  const [employees, setEmployees] = useState<AiEmployee[]>([]);
  const [canManage, setCanManage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [productSearch, setProductSearch] = useState('');
  const [productResults, setProductResults] = useState<ProductCatalogItem[]>([]);
  const [productManagerReply, setProductManagerReply] = useState('');
  const [productSearchBusy, setProductSearchBusy] = useState(false);
  const [productSearchError, setProductSearchError] = useState('');
  const [contentDrafts, setContentDrafts] = useState<Record<string, ProductContentDraft>>({});
  const [contentDraftBusyId, setContentDraftBusyId] = useState<string | null>(null);
  const [contentDraftError, setContentDraftError] = useState('');
  const [productImportDrafts, setProductImportDrafts] = useState<ProductImportDraft[]>([]);
  const [productImportFile, setProductImportFile] = useState<File | null>(null);
  const [productImportBusy, setProductImportBusy] = useState(false);
  const [productImportError, setProductImportError] = useState('');
  const [productImportNotice, setProductImportNotice] = useState('');
  const [activity, setActivity] = useState<AiEmployeeActivity[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);
  const [activityError, setActivityError] = useState('');
  const [teamMessage, setTeamMessage] = useState('');
  const [teamReply, setTeamReply] = useState('');
  const [teamTasks, setTeamTasks] = useState<AiTeamTask[]>([]);
  const [teamProducts, setTeamProducts] = useState<ProductCatalogItem[]>([]);
  const [teamInventoryRecords, setTeamInventoryRecords] = useState<AiEmployeeInventoryRecord[]>([]);
  const [teamSalesSummary, setTeamSalesSummary] = useState<AiEmployeeSalesSummary | null>(null);
  const [teamReplenishmentRecommendations, setTeamReplenishmentRecommendations] = useState<AiEmployeeReplenishmentRecommendation[]>([]);
  const [teamBusy, setTeamBusy] = useState(false);
  const [teamError, setTeamError] = useState('');
  const [inventoryMessage, setInventoryMessage] = useState('');
  const [inventoryReply, setInventoryReply] = useState('');
  const [inventoryRecords, setInventoryRecords] = useState<AiEmployeeInventoryRecord[]>([]);
  const [inventoryBusy, setInventoryBusy] = useState(false);
  const [inventoryError, setInventoryError] = useState('');
  const [teamMemories, setTeamMemories] = useState<AiEmployeeMemory[]>([]);
  const [memoryCategory, setMemoryCategory] = useState<AiEmployeeMemoryCategory>('preference');
  const [memoryContent, setMemoryContent] = useState('');
  const [editingMemoryId, setEditingMemoryId] = useState<string | null>(null);
  const [memoryBusy, setMemoryBusy] = useState(false);
  const [memoryError, setMemoryError] = useState('');
  const [memoryNotice, setMemoryNotice] = useState('');
  const [creativePrompt, setCreativePrompt] = useState('');
  const [creativeProductId, setCreativeProductId] = useState('');
  const [creativeDrafts, setCreativeDrafts] = useState<AiEmployeeCreativeDraft[]>([]);
  const [creativeProducts, setCreativeProducts] = useState<CreativeProductOption[]>([]);
  const [creativeProductQuery, setCreativeProductQuery] = useState('');
  const [creativeProductsLoading, setCreativeProductsLoading] = useState(false);
  const [creativeBusy, setCreativeBusy] = useState(false);
  const [creativeAttachProductIds, setCreativeAttachProductIds] = useState<Record<string, string>>({});
  const [creativeAttachBusyId, setCreativeAttachBusyId] = useState<string | null>(null);
  const [creativeError, setCreativeError] = useState('');
  const [creativeNotice, setCreativeNotice] = useState('');
  const teamAuthorizedEmployees = employees.filter(employee =>
    employee.status === 'available'
    && employee.installation?.status === 'active'
    && ((employee.slug === 'product-manager'
      && employee.installation.grantedPermissions.includes(productCatalogReadPermission))
      || (employee.slug === 'inventory-manager'
        && employee.installation.grantedPermissions.includes(inventoryStockReadPermission))
      || (employee.slug === 'sales-manager'
        && employee.installation.grantedPermissions.includes(salesSummaryReadPermission)))
  );
  const reviewQueueDrafts = Object.values(contentDrafts)
    .filter(draft => draft.status === 'pending' || draft.status === 'stale')
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));

  const loadActivity = async () => {
    setActivityLoading(true);
    setActivityError('');
    try {
      const result = await apiGet<{ logs: AiEmployeeActivity[] }>('/api/merchant/ai-employees/activity');
      setActivity(result.logs);
    } catch (loadError) {
      setActivityError(loadError instanceof Error ? loadError.message : 'AI 员工活动记录加载失败。');
    } finally {
      setActivityLoading(false);
    }
  };

  const loadTeamMemories = async () => {
    setMemoryError('');
    try {
      const result = await apiGet<{ memories: AiEmployeeMemory[] }>('/api/merchant/ai-team/memories');
      setTeamMemories(result.memories);
    } catch (loadError) {
      setMemoryError(loadError instanceof Error ? loadError.message : 'AI 团队记忆加载失败。');
    }
  };

  const loadEmployees = async () => {
    setLoading(true);
    setError('');
    setContentDraftError('');
    try {
      const result = await apiGet<{ employees: AiEmployee[]; canManage: boolean }>('/api/merchant/ai-employees');
      setEmployees(result.employees);
      setCanManage(result.canManage);
      if (result.canManage) {
        void loadActivity();
        void loadTeamMemories();
      } else {
        setActivity([]);
        setTeamMemories([]);
      }
      const productManager = result.employees.find(employee =>
        result.canManage
        &&
        employee.slug === 'product-manager'
        && employee.installation?.status === 'active'
        && (employee.installation.grantedPermissions.includes(productCatalogReadPermission)
        || employee.installation.grantedPermissions.includes(productImportDraftPermission)
        || employee.installation.grantedPermissions.includes(productCreativeGeneratePermission))
      );
      if (productManager?.installation) {
        if (productManager.installation.grantedPermissions.includes(productCatalogReadPermission)) try {
          const draftResult = await apiGet<{ drafts: ProductContentDraft[] }>(
            `/api/merchant/ai-employees/${encodeURIComponent(productManager.installation.id)}/tools/product-content-drafts`
          );
          const draftsByProduct: Record<string, ProductContentDraft> = {};
          for (const draft of draftResult.drafts) {
            const key = productDraftKey(draft.productId, draft.language);
            if (!draftsByProduct[key]) draftsByProduct[key] = draft;
          }
          setContentDrafts(draftsByProduct);
        } catch (draftLoadError) {
          setContentDraftError(draftLoadError instanceof Error ? draftLoadError.message : '商品文案草稿加载失败。');
        } else {
          setContentDrafts({});
        }
        if (productManager.installation.grantedPermissions.includes(productImportDraftPermission)) try {
          const importResult = await apiGet<{ drafts: ProductImportDraft[] }>(
            `/api/merchant/ai-employees/${encodeURIComponent(productManager.installation.id)}/tools/product-import-drafts`
          );
          setProductImportDrafts(importResult.drafts);
        } catch (importLoadError) {
          setProductImportError(importLoadError instanceof Error ? importLoadError.message : '供应商文件草稿加载失败。');
        } else {
          setProductImportDrafts([]);
        }
        if (productManager.installation.grantedPermissions.includes(productCreativeGeneratePermission)) try {
          const [creativeResult, productResult] = await Promise.all([
            apiGet<{ drafts: AiEmployeeCreativeDraft[] }>(
            `/api/merchant/ai-employees/${encodeURIComponent(productManager.installation.id)}/tools/creative-drafts`
            ),
            apiGet<{ products: CreativeProductOption[] }>(
              `/api/merchant/ai-employees/${encodeURIComponent(productManager.installation.id)}/tools/creative-products`
            )
          ]);
          setCreativeDrafts(creativeResult.drafts);
          setCreativeProducts(productResult.products);
        } catch (creativeLoadError) {
          setCreativeError(creativeLoadError instanceof Error ? creativeLoadError.message : '创意草稿加载失败。');
        } else {
          setCreativeDrafts([]);
          setCreativeProducts([]);
          setCreativeError('');
        }
      } else {
        setContentDrafts({});
        setProductImportDrafts([]);
        setCreativeDrafts([]);
        setCreativeProducts([]);
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'AI 员工目录加载失败，请重试。');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadEmployees();
  }, []);

  const setEmployeeActive = async (employee: AiEmployee, active: boolean) => {
    setBusyId(employee.id);
    setError('');
    setNotice('');
    try {
      if (!employee.installation || employee.installation.status === 'declined') {
        const result = await apiPost<{ installation: Installation }>('/api/merchant/ai-employees', { definitionId: employee.id });
        setEmployees(current => current.map(item => item.id === employee.id ? { ...item, installation: result.installation } : item));
        setNotice(localizeCopy('已提交开通申请，平台审核通过后才会启用员工。', 'Richiesta inviata. Il team RUDA la esaminerà prima dell’attivazione.'));
      } else {
        const result = await apiPatch<{ installation: { id: string; status: 'active' | 'paused' } }>(
          `/api/merchant/ai-employees/${encodeURIComponent(employee.installation.id)}/status`,
          { active }
        );
        setEmployees(current => current.map(item => item.id === employee.id && item.installation
          ? { ...item, installation: { ...item.installation, status: result.installation.status } }
          : item));
        if (!active) {
          setProductResults([]);
          setContentDrafts({});
          setProductImportDrafts([]);
        }
        setNotice(active
          ? `${employee.name}${isIt ? ' è stato riattivato.' : '已重新启用。'}`
          : `${employee.name}${isIt ? ' è stato messo in pausa.' : '已暂停。'}`);
      }
      if (active) void loadEmployees();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : '操作失败，请稍后重试。');
    } finally {
      setBusyId(null);
    }
  };

  const setProductPermission = async (employee: AiEmployee, permission: string, granted: boolean) => {
    if (!employee.installation) return;
    setBusyId(employee.id);
    setError('');
    setNotice('');
    try {
      const result = await apiPatch<{ installation: { id: string; grantedPermissions: string[] } }>(
        `/api/merchant/ai-employees/${encodeURIComponent(employee.installation.id)}/permissions`,
        {
          grantedPermissions: granted
            ? [...new Set([...employee.installation.grantedPermissions, permission])]
            : employee.installation.grantedPermissions.filter(item => item !== permission)
        }
      );
      setEmployees(current => current.map(item => item.id === employee.id && item.installation
        ? { ...item, installation: { ...item.installation, grantedPermissions: result.installation.grantedPermissions } }
        : item));
      if (!granted && permission === productCatalogReadPermission) {
        setProductResults([]);
        setContentDrafts({});
      }
      if (!granted && permission === productImportDraftPermission) setProductImportDrafts([]);
      if (!granted && permission === productCreativeGeneratePermission) setCreativeDrafts([]);
      if (!granted && permission === productCreativeGeneratePermission) setCreativeProducts([]);
      setNotice(granted
        ? (localizeCopy('已更新员工数据授权。', 'Autorizzazione aggiornata.'))
        : (localizeCopy('已撤销该项员工数据授权。', 'Autorizzazione revocata.')));
      if (granted) void loadEmployees();
    } catch (permissionError) {
      setError(permissionError instanceof Error ? permissionError.message : '权限更新失败，请重试。');
    } finally {
      setBusyId(null);
    }
  };

  const generateCreativeDraft = async (employee: AiEmployee, event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!employee.installation || !creativePrompt.trim()) return;
    setCreativeBusy(true);
    setCreativeError('');
    setCreativeNotice('');
    try {
      const result = await apiPost<{ draft: AiEmployeeCreativeDraft }>(
        `/api/merchant/ai-employees/${encodeURIComponent(employee.installation.id)}/tools/creative-drafts`,
        { prompt: creativePrompt.trim(), ...(creativeProductId ? { productId: creativeProductId } : {}) },
        180_000
      );
      setCreativeDrafts(current => [result.draft, ...current].slice(0, 20));
      setCreativePrompt('');
      setCreativeNotice(localizeCopy('图片已生成并保存为待审核素材；不会自动加入商品或发布。', 'Immagine generata e salvata per la revisione. Non viene pubblicata né aggiunta al prodotto.'));
      void loadActivity();
    } catch (generateError) {
      setCreativeError(generateError instanceof Error ? generateError.message : '创意图片生成失败，请重试。');
    } finally {
      setCreativeBusy(false);
    }
  };

  const reviewCreativeDraft = async (
    employee: AiEmployee,
    draft: AiEmployeeCreativeDraft,
    action: 'approve' | 'reject' | 'delete'
  ) => {
    if (!canManage || !employee.installation) return;
    const confirmText = action === 'approve'
      ? (localizeCopy('确认审核通过？通过后仍不会自动加入商品或发布。', 'Approvare questa immagine? Non verrà pubblicata né aggiunta al prodotto.'))
      : action === 'reject'
        ? (localizeCopy('确认拒绝？拒绝后图片数据会被清除。', 'Rifiutare ed eliminare l’immagine?'))
        : (localizeCopy('确认永久删除这条素材草稿？', 'Eliminare definitivamente questa bozza?'));
    if (!window.confirm(confirmText)) return;
    setCreativeBusy(true);
    setCreativeError('');
    setCreativeNotice('');
    try {
      const path = `/api/merchant/ai-employees/${encodeURIComponent(employee.installation.id)}/tools/creative-drafts/${encodeURIComponent(draft.id)}`;
      if (action === 'delete') {
        await apiDelete<{ success: true }>(path);
        setCreativeDrafts(current => current.filter(item => item.id !== draft.id));
        setCreativeNotice(localizeCopy('已删除创意草稿。', 'Bozza eliminata.'));
      } else {
        const result = await apiPatch<{ status: 'approved' | 'rejected' }>(path, { action });
        setCreativeDrafts(current => current.map(item => item.id === draft.id
          ? { ...item, status: result.status, reviewedAt: new Date().toISOString() }
          : item));
        setCreativeNotice(result.status === 'approved'
          ? (localizeCopy('素材已审核通过，但尚未加入商品或发布。', 'Immagine approvata, ma non pubblicata.'))
          : (localizeCopy('素材已拒绝，图片数据已清除。', 'Immagine rifiutata e rimossa.')));
      }
      void loadActivity();
    } catch (actionError) {
      setCreativeError(actionError instanceof Error ? actionError.message : '创意素材操作失败，请重试。');
    } finally {
      setCreativeBusy(false);
    }
  };

  const attachCreativeDraft = async (
    employee: AiEmployee,
    draft: AiEmployeeCreativeDraft
  ) => {
    if (!canManage || !employee.installation) return;
    const productId = creativeAttachProductIds[draft.id] || draft.productId || '';
    const product = creativeProducts.find(item => item.id === productId);
    if (!product) {
      setCreativeError(localizeCopy('请先搜索并选择一个有效的本店商品。', 'Cerca e seleziona un prodotto attivo del catalogo.'));
      return;
    }
    const visibilityWarning = product.lifecycleStatus === 'published'
      ? (localizeCopy('该商品已上架，图片可能会立即展示在店铺。', ' Il prodotto è pubblicato e l’immagine potrebbe diventare visibile subito.'))
      : (localizeCopy('该商品尚未上架。', ' Il prodotto non è pubblicato.'));
    if (!window.confirm(localizeCopy("确认将已审核图片加入所选商品的图片组？{{RUDA_ARG_0}}\n这会修改商品图片，但不会更改价格、商品状态或上架设置。", "Aggiungere l’immagine approvata al prodotto selezionato?{{RUDA_ARG_0}}", [String(visibilityWarning)]))) return;

    setCreativeAttachBusyId(draft.id);
    setCreativeError('');
    setCreativeNotice('');
    try {
      await apiPost<{ success: true; product: ProductCatalogItem }>(
        `/api/merchant/ai-employees/${encodeURIComponent(employee.installation.id)}/tools/creative-drafts/${encodeURIComponent(draft.id)}/attach`,
        { productId }
      );
      setCreativeNotice(localizeCopy('已将图片加入商品媒体组并记录操作；商品状态、价格及上架设置未更改。', 'Immagine aggiunta al prodotto. L’operazione è registrata; stato e pubblicazione non sono stati modificati.'));
      void loadActivity();
    } catch (attachError) {
      setCreativeError(attachError instanceof Error ? attachError.message : '无法将素材加入商品，请重试。');
    } finally {
      setCreativeAttachBusyId(null);
    }
  };

  const searchCreativeProducts = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const productManager = employees.find(employee =>
      employee.slug === 'product-manager'
      && employee.installation?.status === 'active'
      && employee.installation.grantedPermissions.includes(productCreativeGeneratePermission)
    );
    if (!productManager?.installation) return;
    setCreativeProductsLoading(true);
    setCreativeError('');
    try {
      const query = creativeProductQuery.trim();
      const result = await apiGet<{ products: CreativeProductOption[] }>(
        `/api/merchant/ai-employees/${encodeURIComponent(productManager.installation.id)}/tools/creative-products${query ? `?q=${encodeURIComponent(query)}` : ''}`
      );
      setCreativeProducts(result.products);
    } catch (searchError) {
      setCreativeError(searchError instanceof Error ? searchError.message : '商品列表搜索失败。');
    } finally {
      setCreativeProductsLoading(false);
    }
  };

  const searchProductCatalog = async (employee: AiEmployee, event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!employee.installation) return;
    setProductSearchBusy(true);
    setProductSearchError('');
    setProductResults([]);
    setContentDraftError('');
    setProductManagerReply('');
    try {
      const result = await apiPost<{ reply: string; products: ProductCatalogItem[] }>(
        `/api/merchant/ai-employees/${encodeURIComponent(employee.installation.id)}/run`,
        { message: productSearch }
      );
      setProductResults(result.products);
      setProductManagerReply(result.reply);
    } catch (searchError) {
      setProductSearchError(searchError instanceof Error ? searchError.message : '商品目录读取失败，请重试。');
    } finally {
      setProductSearchBusy(false);
    }
  };

  const searchInventory = async (employee: AiEmployee, event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!employee.installation) return;
    setInventoryBusy(true);
    setInventoryError('');
    setInventoryReply('');
    setInventoryRecords([]);
    try {
      const result = await apiPost<{
        reply: string;
        records: AiEmployeeInventoryRecord[];
      }>(
        `/api/merchant/ai-employees/${encodeURIComponent(employee.installation.id)}/tools/inventory-search`,
        { message: inventoryMessage }
      );
      setInventoryReply(result.reply);
      setInventoryRecords(result.records);
      void loadActivity();
    } catch (searchError) {
      setInventoryError(searchError instanceof Error ? searchError.message : '库存查询失败，请重试。');
    } finally {
      setInventoryBusy(false);
    }
  };

  const runAiTeam = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setTeamBusy(true);
    setTeamError('');
    setTeamReply('');
    setTeamTasks([]);
    setTeamProducts([]);
    setTeamInventoryRecords([]);
    setTeamSalesSummary(null);
    setTeamReplenishmentRecommendations([]);
    try {
      const result = await apiPost<{
        reply: string;
        tasks: AiTeamTask[];
        products: ProductCatalogItem[];
        inventoryRecords: AiEmployeeInventoryRecord[];
        salesSummary?: AiEmployeeSalesSummary;
        replenishmentRecommendations?: AiEmployeeReplenishmentRecommendation[];
      }>('/api/merchant/ai-team/run', { message: teamMessage });
      setTeamReply(result.reply);
      setTeamTasks(result.tasks);
      setTeamProducts(result.products);
      setTeamInventoryRecords(result.inventoryRecords);
      setTeamSalesSummary(result.salesSummary || null);
      setTeamReplenishmentRecommendations(result.replenishmentRecommendations || []);
      if (result.tasks.length) void loadActivity();
    } catch (runError) {
      setTeamError(runError instanceof Error ? runError.message : 'AI 总管暂时无法完成任务，请重试。');
    } finally {
      setTeamBusy(false);
    }
  };

  const saveTeamMemory = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!memoryContent.trim()) return;
    setMemoryBusy(true);
    setMemoryError('');
    setMemoryNotice('');
    try {
      const payload = { category: memoryCategory, content: memoryContent };
      const result = editingMemoryId
        ? await apiPatch<{ memory: AiEmployeeMemory }>(
          `/api/merchant/ai-team/memories/${encodeURIComponent(editingMemoryId)}`,
          payload
        )
        : await apiPost<{ memory: AiEmployeeMemory }>('/api/merchant/ai-team/memories', payload);
      setTeamMemories(current => [
        result.memory,
        ...current.filter(memory => memory.id !== result.memory.id)
      ].sort((left, right) => left.category.localeCompare(right.category) || right.updatedAt.localeCompare(left.updatedAt)));
      setEditingMemoryId(null);
      setMemoryContent('');
      setMemoryNotice(localizeCopy('已保存，AI 团队会在后续任务中参考。', 'Memoria salvata per il team AI.'));
    } catch (saveError) {
      setMemoryError(saveError instanceof Error ? saveError.message : '保存 AI 团队记忆失败。');
    } finally {
      setMemoryBusy(false);
    }
  };

  const editTeamMemory = (memory: AiEmployeeMemory) => {
    setEditingMemoryId(memory.id);
    setMemoryCategory(memory.category);
    setMemoryContent(memory.content);
    setMemoryError('');
    setMemoryNotice('');
  };

  const deleteTeamMemory = async (memory: AiEmployeeMemory) => {
    const confirmed = window.confirm(localizeCopy('确定删除这条 AI 团队共享记忆吗？删除后后续任务将不再使用。', 'Eliminare questa memoria condivisa del team AI?'));
    if (!confirmed) return;
    setMemoryBusy(true);
    setMemoryError('');
    setMemoryNotice('');
    try {
      await apiDelete(`/api/merchant/ai-team/memories/${encodeURIComponent(memory.id)}`);
      setTeamMemories(current => current.filter(item => item.id !== memory.id));
      if (editingMemoryId === memory.id) {
        setEditingMemoryId(null);
        setMemoryContent('');
      }
      setMemoryNotice(localizeCopy('已删除团队记忆。', 'Memoria eliminata.'));
    } catch (deleteError) {
      setMemoryError(deleteError instanceof Error ? deleteError.message : '删除 AI 团队记忆失败。');
    } finally {
      setMemoryBusy(false);
    }
  };

  const importSupplierCatalog = async (employee: AiEmployee, event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!employee.installation || !productImportFile) return;
    const form = event.currentTarget;
    setProductImportBusy(true);
    setProductImportError('');
    setProductImportNotice('');
    try {
      const formData = new FormData();
      formData.append('file', productImportFile);
      const result = await apiPostWithUploadProgress<{ drafts: ProductImportDraft[] }>(
        `/api/merchant/ai-employees/${encodeURIComponent(employee.installation.id)}/tools/product-import`,
        formData,
        120_000,
        () => undefined
      );
      setProductImportDrafts(current => [...result.drafts, ...current].slice(0, 100));
      setProductImportNotice(localizeCopy("已从文件识别 {{RUDA_ARG_0}} 条商品资料，请核对后再创建商品草稿。", "{{RUDA_ARG_0}} produit(s) extraits. Vérifiez les informations avant de créer des brouillons produit.", [String(result.drafts.length)]));
      setProductImportFile(null);
      form.reset();
    } catch (importError) {
      setProductImportError(importError instanceof Error ? importError.message : '供应商文件识别失败，请重试。');
    } finally {
      setProductImportBusy(false);
    }
  };

  const updateImportCandidate = (
    draftId: string,
    field: keyof SupplierProductCandidate,
    value: string | number | null
  ) => {
    setProductImportDrafts(current => current.map(draft => draft.id === draftId
      ? { ...draft, candidate: { ...draft.candidate, [field]: value } }
      : draft));
  };

  const reviewProductImportDraft = async (
    employee: AiEmployee,
    draft: ProductImportDraft,
    action: 'create_product_draft' | 'reject'
  ) => {
    if (!canManage || !employee.installation) return;
    if (action === 'create_product_draft' && !window.confirm(localizeCopy('确认创建一条未上架的商品草稿？创建后仍需在商品管理中检查和发布。', 'Creare un prodotto non pubblicato nell’area bozze?'))) return;
    if (action === 'reject' && !window.confirm(localizeCopy('确认拒绝这条识别结果？', 'Rifiutare questo elemento importato?'))) return;

    setContentDraftBusyId(draft.id);
    setProductImportError('');
    try {
      const result = await apiPatch<{ status: 'created' | 'rejected'; product?: { id: string; styleNo: string } }>(
        `/api/merchant/ai-employees/${encodeURIComponent(employee.installation.id)}/tools/product-import-drafts/${encodeURIComponent(draft.id)}`,
        action === 'create_product_draft'
          ? { action, candidate: draft.candidate }
          : { action }
      );
      setProductImportDrafts(current => current.filter(item => item.id !== draft.id));
      setProductImportNotice(action === 'create_product_draft'
        ? (localizeCopy("已创建商品草稿 {{RUDA_ARG_0}}，尚未发布。", "Brouillon produit {{RUDA_ARG_0}} creato; non è pubblicato.", [String(result.product?.styleNo || '')]))
        : (localizeCopy('已拒绝这条导入资料。', 'Elemento importato rifiutato.')));
    } catch (reviewError) {
      setProductImportError(reviewError instanceof Error ? reviewError.message : '审核导入商品失败，请重试。');
    } finally {
      setContentDraftBusyId(null);
    }
  };

  const generateProductCopyDraft = async (
    employee: AiEmployee,
    product: Pick<ProductCatalogItem, 'id' | 'name' | 'name_zh' | 'name_it' | 'styleNo'>,
    language: ProductContentDraft['language'] = isIt ? 'it' : 'zh'
  ) => {
    if (!employee.installation) return;
    setContentDraftBusyId(product.id);
    setContentDraftError('');
    try {
      const result = await apiPost<{ draft: ProductContentDraft }>(
        `/api/merchant/ai-employees/${encodeURIComponent(employee.installation.id)}/tools/product-content-draft`,
        { productId: product.id, language }
      );
      setContentDrafts(current => ({
        ...current,
        [productDraftKey(result.draft.productId, result.draft.language)]: {
          ...result.draft,
          productName: result.draft.language === 'it'
            ? product.name_it || product.name
            : result.draft.language === 'zh'
              ? product.name_zh || product.name
              : product.name,
          styleNo: product.styleNo
        }
      }));
    } catch (draftError) {
      setContentDraftError(draftError instanceof Error ? draftError.message : '生成商品文案草稿失败，请重试。');
    } finally {
      setContentDraftBusyId(null);
    }
  };

  const reviewProductContentDraft = async (
    employee: AiEmployee,
    draft: ProductContentDraft,
    action: 'apply' | 'reject'
  ) => {
    if (!canManage || !employee.installation) return;
    if (action === 'apply' && !window.confirm(localizeCopy('确认将此标题和描述更新到商品资料？修改会按商品当前上架状态生效。', 'Applicare titolo e descrizione approvati al prodotto? La modifica diventerà immediatamente visibile secondo lo stato attuale del prodotto.'))) return;
    if (action === 'reject' && !window.confirm(localizeCopy('确认拒绝这条文案草稿？', 'Rifiutare questa bozza?'))) return;

    setContentDraftBusyId(draft.productId);
    setContentDraftError('');
    try {
      const result = await apiPatch<{ status: 'applied' | 'rejected' }>(
        `/api/merchant/ai-employees/${encodeURIComponent(employee.installation.id)}/tools/product-content-drafts/${encodeURIComponent(draft.id)}`,
        action === 'apply'
          ? { action, title: draft.title, description: draft.description }
          : { action }
      );
      setContentDrafts(current => ({
        ...current,
        [productDraftKey(draft.productId, draft.language)]: { ...draft, status: result.status }
      }));
      setNotice(action === 'apply'
        ? (localizeCopy('已将审核通过的文案应用到商品。', 'La bozza approvata è stata applicata al prodotto.'))
        : (localizeCopy('已拒绝该文案草稿。', 'Bozza rifiutata.')));
    } catch (reviewError) {
      if (reviewError instanceof Error && reviewError.message === 'AI_EMPLOYEE_CONTENT_DRAFT_STALE') {
        setContentDrafts(current => ({
          ...current,
          [productDraftKey(draft.productId, draft.language)]: { ...draft, status: 'stale' }
        }));
        setNotice(localizeCopy('商品内容在草稿生成后已变化。请重新生成，再进行审核。', 'Il prodotto è cambiato dopo la generazione. Rigenera la bozza prima di approvarla.'));
      } else {
        setContentDraftError(reviewError instanceof Error ? reviewError.message : '审核商品文案失败，请重试。');
      }
    } finally {
      setContentDraftBusyId(null);
    }
  };

  const visibleEmployees = employees.filter(employee => [
    'product-manager', 'inventory-manager', 'designer', 'photo-editor', 'writer', 'marketer'
  ].includes(employee.slug));
  const activeCount = visibleEmployees.filter(employee => employee.installation?.status === 'active').length;
  const availableCount = visibleEmployees.filter(employee => !employee.installation && employee.status !== 'paused').length;

  return (
    <section className="space-y-4" aria-labelledby="merchant-ai-employees-title">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-200 pb-3">
        <h1 id="merchant-ai-employees-title" className="text-xl font-semibold tracking-tight text-neutral-950">
          {localizeCopy('智能员工', 'Il mio team AI')}
        </h1>
        <p className="text-xs text-neutral-500">
          {localizeCopy(`已启用 ${activeCount} · 可开通 ${availableCount}`, `Attivi ${activeCount} · Disponibili ${availableCount}`)}
        </p>
      </header>

      <details className="group rounded-xl border border-neutral-200 bg-white">
        <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2.5 text-xs font-semibold text-neutral-800 marker:hidden">
          <ShieldCheck className="h-4 w-4 text-neutral-500" />
          {localizeCopy('能力范围', 'Ambito')}
          <span className="text-[10px] font-normal text-neutral-500">{localizeCopy('免费试点 · 只读', 'Pilota · sola lettura')}</span>
          <ChevronDown className="ml-auto h-4 w-4 text-neutral-500 transition group-open:rotate-180" />
        </summary>
        <p className="border-t border-neutral-200 px-3 py-2 text-[10px] text-neutral-600">
          {localizeCopy('仅读取商品、库存和销售汇总；其他角色暂未开放。', 'Lettura di prodotti, stock e vendite; altri ruoli non disponibili.')}
        </p>
      </details>

      {!canManage && !loading && <div className="rounded-xl border border-sky-200 bg-sky-50 p-3 text-xs leading-5 text-sky-900">
        {localizeCopy('仅店主或有员工管理权限的员工可开通或暂停 AI 员工。', 'Solo il titolare o un responsabile autorizzato può gestire il team AI.')}
      </div>}
      {error && <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">{error}</div>}
      {notice && <div role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">{notice}</div>}

      <section className="rounded-xl border border-neutral-200 bg-white p-4" aria-labelledby="ai-team-command-title">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-emerald-50 p-2 text-emerald-800"><Sparkles className="h-4 w-4" /></div>
          <div className="min-w-0 flex-1">
            <h2 id="ai-team-command-title" className="text-sm font-bold text-neutral-950">
              {localizeCopy('团队任务', 'Attività team')}
            </h2>
            <p className="mt-1 text-[10px] leading-4 text-neutral-600">
              {localizeCopy('仅调度已授权员工 · 只读商品、库存、销售 · 不读取客户资料或写入业务 · 勿填敏感信息', 'Solo assistenti autorizzati · lettura prodotti, stock e vendite · nessun dato cliente o modifica · no dati sensibili')}
            </p>
          </div>
          {teamAuthorizedEmployees.length > 0 && (
            <span className="shrink-0 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold text-emerald-800">
              {isIt ? `${teamAuthorizedEmployees.length} dipendent${teamAuthorizedEmployees.length === 1 ? 'e' : 'i'} autorizzat${teamAuthorizedEmployees.length === 1 ? 'o' : 'i'}` : `已授权 ${teamAuthorizedEmployees.length} 名员工`}
            </span>
          )}
        </div>
        <form onSubmit={event => void runAiTeam(event)} className="mt-3 flex flex-wrap gap-2">
          <label className="sr-only" htmlFor="ai-team-command-input">
            {localizeCopy('输入要交给 AI 团队的任务', 'Descrivi il compito per il team AI')}
          </label>
          <input
            id="ai-team-command-input"
            value={teamMessage}
            onChange={event => setTeamMessage(event.target.value)}
            maxLength={500}
            required
            placeholder={localizeCopy('输入任务', 'Descrivi il compito')}
            className="min-w-[220px] flex-1 rounded-lg border border-neutral-200 px-3 py-2 text-xs"
          />
          <button
            type="submit"
            disabled={teamBusy || !teamMessage.trim() || teamAuthorizedEmployees.length === 0}
            className="inline-flex items-center gap-1.5 rounded-lg bg-neutral-950 px-3 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            {teamBusy ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
            {teamBusy ? (localizeCopy('总管调度中…', 'Coordinamento…')) : (localizeCopy('交给 AI 总管', 'Assegna al team'))}
          </button>
        </form>
        {teamAuthorizedEmployees.length === 0 && !loading && (
          <p className="mt-2 text-[10px] text-neutral-500">
            {localizeCopy('先启用员工并授予对应只读权限：商品目录、库存或销售汇总。', 'Attiva un dipendente e assegna la lettura di catalogo, stock o vendite.')}
          </p>
        )}
        {teamError && <p role="alert" className="mt-2 rounded-md bg-rose-50 px-3 py-2 text-[10px] text-rose-800">{teamError}</p>}
        {teamReply && (
          <div role="status" className="mt-3 rounded-lg bg-emerald-50 p-3">
            <p className="text-xs leading-5 text-emerald-950">{teamReply}</p>
            {teamTasks.length > 0 && (
              <ul className="mt-2 space-y-1 border-t border-emerald-100 pt-2">
                {teamTasks.map((task, index) => (
                  <li key={`${task.employeeSlug}-${index}`} className="flex flex-wrap items-center gap-1.5 text-[10px] text-emerald-900">
                    <Users className="h-3 w-3" />
                    <span className="font-semibold">
                      {task.employeeSlug === 'product-manager'
                        ? (localizeCopy('AI 商品经理', 'AI Product Manager'))
                        : task.employeeSlug === 'inventory-manager'
                          ? (localizeCopy('AI 库存经理', 'AI Inventory Manager'))
                          : task.employeeName}
                    </span>
                    <span>· {task.search} · {task.resultCount} {localizeCopy('条结果', 'risultati')}</span>
                  </li>
                ))}
              </ul>
            )}
            {teamProducts.length > 0 && (
              <ul className="mt-2 divide-y divide-emerald-100 rounded-md border border-emerald-100 bg-white">
                {teamProducts.slice(0, 5).map(product => (
                  <li key={product.id} className="flex flex-wrap justify-between gap-2 px-2.5 py-2 text-[10px]">
                    <span className="font-medium text-neutral-900">{product.name_zh || product.name_it || product.name} · {product.styleNo}</span>
                    <span className="text-neutral-600">€{Number(product.wholesalePrice).toFixed(2)} · MOQ {product.moq}</span>
                  </li>
                ))}
              </ul>
            )}
            {teamInventoryRecords.length > 0 && (
              <ul className="mt-2 divide-y divide-sky-100 rounded-md border border-sky-100 bg-white">
                {teamInventoryRecords.slice(0, 5).map(record => (
                  <li key={record.sku} className="flex flex-wrap justify-between gap-2 px-2.5 py-2 text-[10px]">
                    <span className="font-medium text-neutral-900">
                      {record.productName} · {record.styleNo} · {record.sku}
                      {record.color || record.size ? ` · ${[record.color, record.size].filter(Boolean).join(' / ')}` : ''}
                    </span>
                    <span className="text-neutral-600">
                      {localizeCopy('可用', 'Disponibile')} {record.availableQuantity} · {localizeCopy('现有', 'Totale')} {record.onHandQuantity} · {localizeCopy('预留', 'Riservato')} {record.reservedQuantity}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {teamSalesSummary && (
              <div className="mt-2 rounded-md border border-emerald-100 bg-white p-2.5 text-[10px] text-neutral-700">
                <div className="font-semibold">
                  {localizeCopy('本店近 30 天销售汇总', 'Vendite negozio · ultimi 30 giorni')}
                  <span className="ml-1 font-normal text-neutral-500">· {teamSalesSummary.periodStart}–{teamSalesSummary.periodEnd}</span>
                </div>
                <div className="mt-1">
                  {localizeCopy('订单', 'Ordini')} {teamSalesSummary.orderCount}
                  {' · '}{localizeCopy('商品数量', 'Unità')} {teamSalesSummary.totalQuantity}
                  {' · '}{localizeCopy('金额', 'Importo')} €{teamSalesSummary.totalAmount.toFixed(2)}
                </div>
                <div className="mt-1 text-neutral-500">
                  {teamSalesSummary.byStatus.map(group => `${group.status}: ${group.orderCount}`).join(' · ')}
                </div>
              </div>
            )}
            {teamReplenishmentRecommendations.length > 0 && (
              <div className="mt-2 rounded-md border border-amber-200 bg-amber-50 p-2.5">
                <p className="text-[10px] font-semibold text-amber-950">
                  {localizeCopy('补货建议待审核；未创建采购单或修改库存。', 'Riordino da approvare; nessuna modifica a ordini o stock.')}
                </p>
                <ul className="mt-1 divide-y divide-amber-100 rounded bg-white">
                  {teamReplenishmentRecommendations.slice(0, 8).map(record => (
                    <li key={record.sku} className="flex flex-wrap justify-between gap-2 px-2 py-1.5 text-[10px]">
                      <span>{record.productName} · {record.sku}</span>
                      <span>
                        {localizeCopy('近30天销量', 'Venduti')} {record.soldLast30Days}
                        {' · '}{localizeCopy('当前可售', 'Disponibili')} {record.availableQuantity}
                        {' · '}{localizeCopy('建议补充', 'Suggeriti')} {record.suggestedReorderQuantity}
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="mt-1 text-[9px] text-amber-900">
                  {localizeCopy('按近 30 天销量估算，未计交期、季节、安全库存及活动。', 'Stima basata sulle vendite; esclusi tempi, stagionalità, scorte e campagne.')}
                </p>
              </div>
            )}
          </div>
        )}
      </section>

      {canManage && (
        <section className="rounded-xl border border-indigo-200 bg-white p-4 shadow-sm" aria-labelledby="ai-team-memory-title">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-indigo-50 p-2 text-indigo-800"><BrainCircuit className="h-4 w-4" /></div>
            <div className="min-w-0 flex-1">
              <h2 id="ai-team-memory-title" className="text-sm font-bold text-neutral-950">
                {localizeCopy('团队记忆', 'Memoria team')}
              </h2>
              <p className="mt-1 text-[10px] leading-4 text-neutral-600">
                {localizeCopy('仅本店授权员工可见；勿填个人、客户或支付信息。', 'Solo per il team autorizzato; non inserire dati personali, clienti o pagamenti.')}
              </p>
            </div>
            <span className="shrink-0 rounded-full bg-indigo-50 px-2.5 py-1 text-[10px] font-semibold text-indigo-800">
              {teamMemories.length}/50
            </span>
          </div>

          <form onSubmit={event => void saveTeamMemory(event)} className="mt-3 space-y-2 rounded-lg border border-neutral-200 bg-neutral-50 p-3">
            <div className="flex flex-wrap gap-2">
              <label className="min-w-[170px] flex-1 text-[10px] font-semibold text-neutral-700">
                {localizeCopy('记忆类型', 'Tipo di memoria')}
                <select
                  value={memoryCategory}
                  onChange={event => setMemoryCategory(event.target.value as AiEmployeeMemoryCategory)}
                  className="mt-1 block w-full rounded-md border border-neutral-200 bg-white px-2.5 py-2 text-xs font-normal text-neutral-900"
                >
                  <option value="preference">{localizeCopy('工作偏好', 'Preferenze di lavoro')}</option>
                  <option value="brand_voice">{localizeCopy('品牌语气', 'Voce del brand')}</option>
                  <option value="operating_rule">{localizeCopy('经营规则', 'Regola operativa')}</option>
                </select>
              </label>
              <label className="min-w-[240px] flex-[3] text-[10px] font-semibold text-neutral-700">
                {localizeCopy('记忆内容（最多 500 字）', 'Memoria (massimo 500 caratteri)')}
                <textarea
                  value={memoryContent}
                  onChange={event => setMemoryContent(event.target.value)}
                  required
                  maxLength={500}
                  rows={2}
                  className="mt-1 block w-full rounded-md border border-neutral-200 bg-white px-2.5 py-2 text-xs font-normal text-neutral-900"
                />
              </label>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="submit"
                disabled={memoryBusy || !memoryContent.trim() || (!editingMemoryId && teamMemories.length >= 50)}
                className="rounded-lg bg-indigo-800 px-3 py-2 text-[10px] font-semibold text-white disabled:opacity-40"
              >
                {memoryBusy
                  ? (localizeCopy('保存中…', 'Salvataggio…'))
                  : editingMemoryId
                    ? (localizeCopy('保存修改', 'Aggiorna memoria'))
                    : (localizeCopy('添加长期记忆', 'Aggiungi memoria'))}
              </button>
              {editingMemoryId && (
                <button
                  type="button"
                  onClick={() => { setEditingMemoryId(null); setMemoryContent(''); }}
                  disabled={memoryBusy}
                  className="rounded-lg border border-neutral-200 px-3 py-2 text-[10px] font-semibold text-neutral-700"
                >
                  {localizeCopy('取消编辑', 'Annulla')}
                </button>
              )}
              {memoryError && <p role="alert" className="text-[10px] text-rose-700">{memoryError}</p>}
              {memoryNotice && <p role="status" className="text-[10px] text-emerald-800">{memoryNotice}</p>}
            </div>
          </form>

          {teamMemories.length > 0
            ? <ul className="mt-3 divide-y divide-neutral-100 rounded-lg border border-neutral-100">
              {teamMemories.map(memory => (
                <li key={memory.id} className="flex flex-wrap items-start justify-between gap-3 px-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <span className="rounded-full bg-indigo-50 px-2 py-1 text-[9px] font-semibold text-indigo-800">
                      {memory.category === 'preference'
                        ? (localizeCopy('工作偏好', 'Preferenze'))
                        : memory.category === 'brand_voice'
                          ? (localizeCopy('品牌语气', 'Voce del brand'))
                          : (localizeCopy('经营规则', 'Regola operativa'))}
                    </span>
                    <p className="mt-1.5 whitespace-pre-wrap break-words text-xs leading-5 text-neutral-800">{memory.content}</p>
                    <p className="mt-1 text-[9px] text-neutral-400">
                      {localizeCopy('更新时间', 'Aggiornato')} · {new Date(memory.updatedAt).toLocaleString(getIntlLocale(lang))}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button type="button" disabled={memoryBusy} onClick={() => editTeamMemory(memory)} className="rounded-md border border-neutral-200 px-2.5 py-1.5 text-[10px] font-semibold text-neutral-700 disabled:opacity-50">
                      {localizeCopy('编辑', 'Modifica')}
                    </button>
                    <button type="button" disabled={memoryBusy} onClick={() => void deleteTeamMemory(memory)} className="rounded-md border border-rose-200 px-2.5 py-1.5 text-[10px] font-semibold text-rose-700 disabled:opacity-50">
                      {localizeCopy('删除', 'Elimina')}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
            : <p className="mt-3 rounded-lg bg-neutral-50 px-3 py-3 text-[10px] text-neutral-500">
              {localizeCopy('暂无记忆', 'Nessuna memoria')}
            </p>}
        </section>
      )}

      {canManage && (
        <section className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm" aria-labelledby="ai-employee-activity-title">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <History className="h-4 w-4 text-emerald-700" />
              <div>
                <h2 id="ai-employee-activity-title" className="text-xs font-bold text-neutral-900">
                  {localizeCopy('员工活动', 'Attività team')}
                </h2>
              </div>
            </div>
            <span className="text-[10px] text-neutral-500">{localizeCopy('本店 · 最近 50 条', 'Negozio · ultimi 50')}</span>
            <button
              type="button"
              onClick={() => void loadActivity()}
              disabled={activityLoading}
              className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 px-2.5 py-1.5 text-[10px] font-semibold text-neutral-700 disabled:opacity-50"
            >
              <RefreshCw className={`h-3 w-3 ${activityLoading ? 'animate-spin' : ''}`} />
              {localizeCopy('刷新', 'Aggiorna')}
            </button>
          </div>
          {activityError && (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-rose-50 px-3 py-2 text-[10px] text-rose-800">
              <p role="alert">{activityError}</p>
              <button type="button" onClick={() => void loadActivity()} className="font-semibold underline">
                {localizeCopy('重试', 'Riprova')}
              </button>
            </div>
          )}
          {activityLoading && activity.length === 0
            ? <p role="status" className="mt-3 text-[10px] text-neutral-500">{localizeCopy('正在加载活动记录…', 'Caricamento attività…')}</p>
            : activity.length === 0
              ? <p className="mt-3 rounded-lg bg-neutral-50 px-3 py-3 text-[10px] text-neutral-500">
                {localizeCopy('暂无记录', 'Nessun record')}
              </p>
              : <ol className="mt-3 max-h-80 divide-y divide-neutral-100 overflow-y-auto">
                {activity.map(item => (
                  <li key={item.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2 text-[10px]">
                    <span className="font-medium text-neutral-800">{getActivityLabel(item.action, isIt)}</span>
                    <span className="text-neutral-500">
                      {new Date(item.createdAt).toLocaleString(getIntlLocale(lang))}
                    </span>
                  </li>
                ))}
              </ol>}
        </section>
      )}

      {loading
        ? <div role="status" className="rounded-xl border border-neutral-200 bg-white p-8 text-center text-sm text-neutral-500">{localizeCopy('加载中…', 'Caricamento…')}</div>
        : visibleEmployees.length === 0
          ? <div className="rounded-xl border border-neutral-200 bg-white p-8 text-center text-sm text-neutral-500">{localizeCopy('暂无员工', 'Nessun dipendente')}</div>
          : <div className="grid gap-4 xl:grid-cols-2">
            {visibleEmployees.map(employee => {
              const installed = employee.installation !== null;
              const active = employee.installation?.status === 'active';
              const hireable = employee.status === 'available';
              const grantedPermissions = employee.installation?.grantedPermissions ?? [];
              const accessLabels = employee.slug === 'product-manager'
                ? [localizeCopy('商品目录只读', 'Catalogo in sola lettura'), localizeCopy('单独授权', 'Autorizzazione separata'), localizeCopy('文案需审批', 'Testi da approvare'), localizeCopy('不自动修改', 'Nessuna modifica automatica'), localizeCopy('不自动发布', 'Nessuna pubblicazione'), localizeCopy('不自动改价', 'Nessuna modifica prezzi')]
                : employee.slug === 'inventory-manager'
                  ? [localizeCopy('库存需授权', 'Autorizza accesso stock'), localizeCopy('补货需销售授权', 'Vendite autorizzate per riordino'), localizeCopy('近30天汇总', 'Vendite ultimi 30 giorni'), localizeCopy('不改库存', 'Nessuna modifica stock'), localizeCopy('不建采购单', 'Nessun ordine acquisto')]
                  : employee.slug === 'sales-manager'
                    ? [localizeCopy('仅近30天', 'Solo ultimi 30 giorni'), localizeCopy('订单状态与汇总', 'Stati e totali ordini'), localizeCopy('不读买家隐私', 'No dati personali clienti')]
                    : [localizeCopy('未绑定业务工具', 'Nessuno strumento assegnato'), localizeCopy('无数据权限', 'Nessun accesso dati'), localizeCopy('不读写业务数据', 'Nessuna lettura o modifica')];
              const RoleIcon = ({
                'product-manager': PackageSearch,
                designer: Palette,
                'photo-editor': Image,
                writer: PenLine,
                marketer: Megaphone
              }[employee.slug] || UserRound);
              return <article key={employee.id} className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-800"><RoleIcon className="h-5 w-5" /></span>
                    <div className="min-w-0">
                      <h2 className="text-sm font-bold text-neutral-950">{employee.name}</h2>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        <span className="rounded-full bg-neutral-100 px-2 py-1 text-[10px] text-neutral-600">{employee.department}</span>
                        <span className="rounded-full bg-neutral-100 px-2 py-1 font-mono text-[10px] text-neutral-600">v{employee.version}</span>
                      </div>
                    </div>
                  </div>
                  <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-semibold ${active ? 'bg-emerald-50 text-emerald-800' : employee.installation?.status === 'requested' ? 'bg-sky-50 text-sky-800' : employee.installation ? 'bg-amber-50 text-amber-800' : 'bg-neutral-100 text-neutral-600'}`}>
                    {active
                      ? (localizeCopy('已启用', 'Attivo'))
                      : employee.installation?.status === 'requested'
                        ? (localizeCopy('申请审核中', 'Richiesta in revisione'))
                        : employee.installation?.status === 'declined'
                          ? (localizeCopy('申请未通过', 'Richiesta non approvata'))
                          : employee.installation
                            ? (localizeCopy('已暂停', 'In pausa'))
                            : phaseLabels[employee.status]}
                  </span>
                </div>
                {employee.capabilities.length > 0 && <div className="mt-4">
                  <div className="text-[10px] font-semibold text-neutral-500">{localizeCopy('能力', 'Competenze')}</div>
                  <div className="mt-2 flex flex-wrap gap-1.5">{employee.capabilities.map(capability => <span key={capability} className="rounded-full bg-slate-100 px-2 py-1 text-[10px] text-slate-700">{capability}</span>)}</div>
                </div>}
                <div className="mt-4 rounded-lg border border-neutral-100 bg-neutral-50 p-3 text-[10px] text-neutral-600">
                  <div className="font-semibold text-neutral-800">{localizeCopy('数据与操作权限', 'Accesso e azioni')}</div>
                  <div className="mt-2 flex flex-wrap gap-2">{accessLabels.map(label => <span key={label} className="rounded-full bg-white px-2 py-1">{label}</span>)}</div>
                </div>
                {employee.slug === 'product-manager' && installed && (
                  <div className="mt-4 rounded-lg border border-neutral-200 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="text-xs font-semibold text-neutral-800">
                        {localizeCopy('本店商品目录 · 只读工具', 'Catalogo prodotti · sola lettura')}
                      </div>
                      <button
                        type="button"
                        disabled={!canManage || busyId !== null || !active || !hireable}
                        onClick={() => void setProductPermission(employee, productCatalogReadPermission, !grantedPermissions.includes(productCatalogReadPermission))}
                        className={`rounded-lg px-3 py-2 text-[11px] font-semibold disabled:cursor-not-allowed disabled:opacity-40 ${
                          grantedPermissions.includes(productCatalogReadPermission)
                            ? 'border border-neutral-200 text-neutral-700'
                            : 'bg-emerald-700 text-white'
                        }`}
                      >
                        {grantedPermissions.includes(productCatalogReadPermission)
                          ? (localizeCopy('撤销读取授权', 'Revoca accesso'))
                          : (localizeCopy('授权只读访问', 'Autorizza accesso'))}
                      </button>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-violet-50/70 p-3">
                      <div className="text-xs font-semibold text-neutral-800">
                        {localizeCopy('供应商目录导入 · 本地识别', 'Importazione catalogo fornitore · locale')}
                        <p className="mt-1 max-w-xl text-[10px] font-normal leading-4 text-neutral-600">
                          {localizeCopy('单独授权后可用本地模型识别商品图片、PDF、CSV、XLSX。原文件只在内存中处理、不持久化；仅识别出的字段保存为本店待审草稿。', 'Consenti l’estrazione locale di immagini, PDF, CSV e XLSX. I file non vengono conservati; solo i campi estratti restano in bozze tenant-scoped.')}
                        </p>
                      </div>
                      <button
                        type="button"
                        disabled={!canManage || busyId !== null || !active || !hireable}
                        onClick={() => void setProductPermission(employee, productImportDraftPermission, !grantedPermissions.includes(productImportDraftPermission))}
                        className={`rounded-lg px-3 py-2 text-[11px] font-semibold disabled:cursor-not-allowed disabled:opacity-40 ${
                          grantedPermissions.includes(productImportDraftPermission)
                            ? 'border border-neutral-200 bg-white text-neutral-700'
                            : 'bg-violet-700 text-white'
                        }`}
                      >
                        {grantedPermissions.includes(productImportDraftPermission)
                          ? (localizeCopy('撤销导入授权', 'Revoca importazione'))
                          : (localizeCopy('授权文件识别', 'Autorizza importazione'))}
                      </button>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-fuchsia-50/70 p-3">
                      <div className="text-xs font-semibold text-neutral-800">
                        {localizeCopy('创意工作室 · 本地图片生成', 'Studio creativo · generazione locale')}
                        <p className="mt-1 max-w-xl text-[10px] font-normal leading-4 text-neutral-600">
                          {localizeCopy('使用本地图片生成服务制作商品创意图。每张图片先私有保存并人工审核，绝不自动加入商品或发布。', 'Genera immagini con il servizio locale. Ogni risultato resta privato e richiede revisione; non viene mai pubblicato automaticamente.')}
                        </p>
                      </div>
                      <button
                        type="button"
                        disabled={!canManage || busyId !== null || !active || !hireable}
                        onClick={() => void setProductPermission(employee, productCreativeGeneratePermission, !grantedPermissions.includes(productCreativeGeneratePermission))}
                        className={`rounded-lg px-3 py-2 text-[11px] font-semibold disabled:cursor-not-allowed disabled:opacity-40 ${
                          grantedPermissions.includes(productCreativeGeneratePermission)
                            ? 'border border-neutral-200 bg-white text-neutral-700'
                            : 'bg-fuchsia-800 text-white'
                        }`}
                      >
                        {grantedPermissions.includes(productCreativeGeneratePermission)
                          ? (localizeCopy('撤销创意生成授权', 'Revoca generazione'))
                          : (localizeCopy('授权创意生成', 'Autorizza generazione'))}
                      </button>
                    </div>
                    {active && grantedPermissions.includes(productImportDraftPermission) && (
                      <div className="mt-3 space-y-3">
                        <form onSubmit={event => void importSupplierCatalog(employee, event)} className="flex flex-wrap items-end gap-2 rounded-lg border border-violet-100 p-3">
                          <label className="min-w-[220px] flex-1 text-[10px] font-semibold text-neutral-700">
                            {localizeCopy('商品图片或供应商目录', 'Immagine o catalogo fornitore')}
                            <input
                              type="file"
                              required
                              accept="image/jpeg,image/png,image/webp,application/pdf,text/csv,application/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,.jpg,.jpeg,.png,.webp,.pdf,.csv,.xlsx"
                              onChange={event => setProductImportFile(event.target.files?.[0] || null)}
                              className="mt-1 block w-full text-[10px] font-normal text-neutral-600 file:mr-2 file:rounded-md file:border-0 file:bg-violet-100 file:px-2.5 file:py-1.5 file:text-[10px] file:font-semibold file:text-violet-900"
                            />
                          </label>
                          <button
                            type="submit"
                            disabled={!canManage || productImportBusy || !productImportFile}
                            className="rounded-lg bg-violet-800 px-3 py-2 text-[11px] font-semibold text-white disabled:opacity-50"
                          >
                            {productImportBusy
                              ? (localizeCopy('本地识别中…', 'Analisi locale…'))
                              : (localizeCopy('识别商品资料', 'Estrai prodotti'))}
                          </button>
                        </form>
                        {productImportError && <p role="alert" className="rounded-md bg-rose-50 px-3 py-2 text-[10px] text-rose-800">{productImportError}</p>}
                        {productImportNotice && <p role="status" className="rounded-md bg-emerald-50 px-3 py-2 text-[10px] text-emerald-900">{productImportNotice}</p>}
                        {productImportDrafts.length > 0 && (
                          <section className="rounded-xl border border-violet-200 bg-violet-50/40 p-3" aria-label={localizeCopy('待审核的导入商品资料', 'Prodotti importati da verificare')}>
                            <div className="flex items-center justify-between gap-2">
                              <h3 className="text-xs font-bold text-violet-950">{localizeCopy('核对识别出的商品资料', 'Verifica i dati estratti')}</h3>
                              <span className="rounded-full bg-violet-100 px-2 py-1 text-[10px] font-semibold text-violet-900">{productImportDrafts.length}</span>
                            </div>
                            <ul className="mt-3 space-y-3">
                              {productImportDrafts.map(draft => {
                                const candidate = draft.candidate;
                                const readyToCreate = Boolean(
                                  candidate.styleNo.trim()
                                  && candidate.name.trim()
                                  && candidate.brand.trim()
                                  && candidate.category.trim()
                                  && candidate.wholesalePrice !== null && candidate.wholesalePrice > 0
                                  && candidate.rrpPrice !== null && candidate.rrpPrice > 0
                                  && candidate.moq !== null && candidate.moq > 0
                                );
                                const textField = (field: keyof SupplierProductCandidate, label: string, maxLength: number) => (
                                  <label className="block text-[10px] font-semibold text-neutral-700">
                                    {label}
                                    <input
                                      value={String(candidate[field] ?? '')}
                                      maxLength={maxLength}
                                      onChange={event => updateImportCandidate(draft.id, field, event.target.value)}
                                      className="mt-1 w-full rounded-md border border-neutral-200 px-2 py-1.5 text-xs font-normal text-neutral-900"
                                    />
                                  </label>
                                );
                                const numberField = (field: 'wholesalePrice' | 'rrpPrice' | 'moq', label: string) => (
                                  <label className="block text-[10px] font-semibold text-neutral-700">
                                    {label}
                                    <input
                                      type="number"
                                      min={field === 'moq' ? 1 : 0.01}
                                      step={field === 'moq' ? 1 : 0.01}
                                      value={candidate[field] ?? ''}
                                      onChange={event => updateImportCandidate(draft.id, field, event.target.value === '' ? null : Number(event.target.value))}
                                      className="mt-1 w-full rounded-md border border-neutral-200 px-2 py-1.5 text-xs font-normal text-neutral-900"
                                    />
                                  </label>
                                );
                                return (
                                  <li key={draft.id} className="space-y-2 rounded-lg border border-violet-100 bg-white p-3">
                                    <p className="truncate text-[10px] text-neutral-500">{draft.sourceFilename} · {draft.sourceType.toUpperCase()}</p>
                                    <div className="grid gap-2 sm:grid-cols-2">
                                      {textField('styleNo', localizeCopy('款号', 'Codice'), 100)}
                                      {textField('name', localizeCopy('商品名称', 'Nome prodotto'), 200)}
                                      {textField('brand', localizeCopy('品牌', 'Brand'), 120)}
                                      {textField('category', localizeCopy('分类', 'Categoria'), 80)}
                                      {textField('subCategory', localizeCopy('子分类', 'Sottocategoria'), 80)}
                                      {textField('season', localizeCopy('季节', 'Stagione'), 80)}
                                      {numberField('wholesalePrice', localizeCopy('批发价 (€)', 'Prezzo wholesale (€)'))}
                                      {numberField('rrpPrice', localizeCopy('建议零售价 (€)', 'Prezzo consigliato (€)'))}
                                      {numberField('moq', localizeCopy('起订量', 'Quantità minima'))}
                                      {textField('fabric', localizeCopy('面料', 'Tessuto'), 120)}
                                      {textField('composition', localizeCopy('成分', 'Composizione'), 500)}
                                      <label className="block text-[10px] font-semibold text-neutral-700 sm:col-span-2">
                                        {localizeCopy('商品描述', 'Descrizione')}
                                        <textarea
                                          value={candidate.description}
                                          maxLength={2000}
                                          rows={3}
                                          onChange={event => updateImportCandidate(draft.id, 'description', event.target.value)}
                                          className="mt-1 w-full rounded-md border border-neutral-200 px-2 py-1.5 text-xs font-normal text-neutral-900"
                                        />
                                      </label>
                                    </div>
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                      <p className="text-[10px] text-amber-800">
                                        {localizeCopy('请人工核对识别内容；确认只会创建未发布商品草稿。缺失字段需手动补全。', 'La verifica è obbligatoria; la conferma crea solo una bozza non pubblicata.')}
                                      </p>
                                      <div className="flex gap-2">
                                        <button
                                          type="button"
                                          disabled={!readyToCreate || contentDraftBusyId !== null}
                                          onClick={() => void reviewProductImportDraft(employee, draft, 'create_product_draft')}
                                          className="rounded-md bg-violet-800 px-2.5 py-1.5 text-[10px] font-semibold text-white disabled:opacity-40"
                                        >
                                          {localizeCopy('创建商品草稿', 'Crea bozza prodotto')}
                                        </button>
                                        <button
                                          type="button"
                                          disabled={contentDraftBusyId !== null}
                                          onClick={() => void reviewProductImportDraft(employee, draft, 'reject')}
                                          className="rounded-md border border-neutral-300 px-2.5 py-1.5 text-[10px] font-semibold text-neutral-700 disabled:opacity-50"
                                        >
                                          {localizeCopy('拒绝', 'Rifiuta')}
                                        </button>
                                      </div>
                                    </div>
                                  </li>
                                );
                              })}
                            </ul>
                          </section>
                        )}
                      </div>
                    )}
                    {active && grantedPermissions.includes(productCreativeGeneratePermission) && (
                      <section className="mt-3 space-y-3 rounded-lg border border-fuchsia-200 bg-fuchsia-50/30 p-3" aria-label={localizeCopy('AI 创意工作室', 'Studio creativo')}>
                        <form onSubmit={event => void searchCreativeProducts(event)} className="flex flex-wrap items-end gap-2">
                          <label className="min-w-[200px] flex-1 text-[10px] font-semibold text-neutral-700">
                            {localizeCopy('本店商品', 'Prodotti del negozio')}
                            <input
                              value={creativeProductQuery}
                              onChange={event => setCreativeProductQuery(event.target.value)}
                              maxLength={100}
                              placeholder={localizeCopy('商品名称或款号', 'Nome o codice prodotto')}
                              className="mt-1 w-full rounded-md border border-neutral-200 bg-white px-2.5 py-2 text-xs font-normal"
                            />
                          </label>
                          <button type="submit" disabled={creativeProductsLoading} className="rounded-lg border border-fuchsia-200 bg-white px-3 py-2 text-[11px] font-semibold text-fuchsia-900 disabled:opacity-50">
                            {creativeProductsLoading ? (localizeCopy('搜索中…', 'Ricerca…')) : (localizeCopy('搜索商品', 'Cerca prodotti'))}
                          </button>
                        </form>
                        <form onSubmit={event => void generateCreativeDraft(employee, event)} className="space-y-2">
                          <label className="block text-[10px] font-semibold text-neutral-700">
                            {localizeCopy('创作要求', 'Richiesta creativa')}
                            <textarea
                              required
                              value={creativePrompt}
                              onChange={event => setCreativePrompt(event.target.value)}
                              maxLength={800}
                              rows={3}
                              className="mt-1 w-full resize-y rounded-md border border-neutral-200 bg-white px-2.5 py-2 text-xs font-normal"
                            />
                          </label>
                          <div className="flex flex-wrap items-end gap-2">
                            <label className="min-w-[220px] flex-1 text-[10px] font-semibold text-neutral-700">
                              {localizeCopy('关联本店商品（可选）', 'Prodotto (facoltativo)')}
                              <select
                                value={creativeProductId}
                                onChange={event => setCreativeProductId(event.target.value)}
                                className="mt-1 w-full rounded-md border border-neutral-200 bg-white px-2.5 py-2 text-xs font-normal"
                              >
                                <option value="">{localizeCopy('不关联商品', 'Nessun prodotto collegato')}</option>
                                {creativeProducts.map(product => (
                                  <option key={product.id} value={product.id}>{product.styleNo} · {product.name}</option>
                                ))}
                              </select>
                              <span className="mt-1 block font-normal text-neutral-500">
                                {localizeCopy('商品信息仅作视觉参考。', 'Solo come riferimento visivo.')}
                              </span>
                            </label>
                            <button
                              type="submit"
                              disabled={!canManage || creativeBusy || creativePrompt.trim().length === 0}
                              className="rounded-lg bg-fuchsia-800 px-3 py-2 text-[11px] font-semibold text-white disabled:opacity-50"
                            >
                              {creativeBusy
                                ? (localizeCopy('本地生成中…', 'Generazione locale…'))
                                : (localizeCopy('生成待审图片', 'Genera bozza immagine'))}
                            </button>
                          </div>
                        </form>
                        <p className="text-[10px] leading-4 text-neutral-600">
                          {localizeCopy('图片存储在本店私有素材库，负责人审核后仍需在商品管理中手动使用；审核通过不会自动修改商品或上架。', 'L’immagine viene conservata privatamente fino alla revisione. Approvare non la inserisce nel prodotto e non la pubblica.')}
                        </p>
                        {creativeError && <p role="alert" className="rounded-md bg-rose-50 px-3 py-2 text-[10px] text-rose-800">{creativeError}</p>}
                        {creativeNotice && <p role="status" className="rounded-md bg-emerald-50 px-3 py-2 text-[10px] text-emerald-900">{creativeNotice}</p>}
                        {creativeDrafts.length > 0 && (
                          <ul className="grid gap-3 sm:grid-cols-2">
                            {creativeDrafts.map(draft => (
                              <li key={draft.id} className="overflow-hidden rounded-lg border border-fuchsia-100 bg-white">
                                {draft.status !== 'rejected' && (
                                  <img
                                    src={`/api/merchant/ai-team/creatives/${encodeURIComponent(draft.id)}/image`}
                                    alt={draft.prompt}
                                    loading="lazy"
                                    className="aspect-square w-full object-cover"
                                  />
                                )}
                                <div className="space-y-2 p-3">
                                  <div className="flex flex-wrap items-center justify-between gap-2">
                                    <span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${
                                      draft.status === 'approved' ? 'bg-emerald-50 text-emerald-800'
                                        : draft.status === 'rejected' ? 'bg-neutral-100 text-neutral-500'
                                          : 'bg-amber-50 text-amber-800'
                                    }`}>
                                      {draft.status === 'approved'
                                        ? (localizeCopy('已通过 · 未发布', 'Approvata · non pubblicata'))
                                        : draft.status === 'rejected'
                                          ? (localizeCopy('已拒绝 · 图片已清除', 'Rifiutata · immagine rimossa'))
                                          : (localizeCopy('待人工审核', 'In attesa di revisione'))}
                                    </span>
                                    <span className="text-[9px] text-neutral-500">{draft.imageWidth}×{draft.imageHeight} · {new Date(draft.createdAt).toLocaleString(getIntlLocale(lang))}</span>
                                  </div>
                                  <p className="line-clamp-3 text-[10px] leading-4 text-neutral-700">{draft.prompt}</p>
                                  {draft.status === 'pending_review' && (
                                    <div className="flex gap-2">
                                      <button type="button" disabled={!canManage || creativeBusy} onClick={() => void reviewCreativeDraft(employee, draft, 'approve')} className="rounded-md bg-emerald-800 px-2.5 py-1.5 text-[10px] font-semibold text-white disabled:opacity-50">
                                        {localizeCopy('审核通过', 'Approva')}
                                      </button>
                                      <button type="button" disabled={!canManage || creativeBusy} onClick={() => void reviewCreativeDraft(employee, draft, 'reject')} className="rounded-md border border-neutral-300 px-2.5 py-1.5 text-[10px] font-semibold text-neutral-700 disabled:opacity-50">
                                        {localizeCopy('拒绝并清除图片', 'Rifiuta')}
                                      </button>
                                      <button type="button" disabled={!canManage || creativeBusy} onClick={() => void reviewCreativeDraft(employee, draft, 'delete')} className="ml-auto rounded-md border border-rose-200 px-2.5 py-1.5 text-[10px] font-semibold text-rose-700 disabled:opacity-50">
                                        {localizeCopy('删除', 'Elimina')}
                                      </button>
                                    </div>
                                  )}
                                  {draft.status === 'approved' && (
                                    <div className="space-y-2 rounded-md bg-emerald-50/70 p-2">
                                      <a
                                        href={`/api/merchant/ai-team/creatives/${encodeURIComponent(draft.id)}/image?download=1`}
                                        download={`ruda-ai-creative-${draft.id}.webp`}
                                        className="inline-flex rounded-md border border-emerald-200 bg-white px-2.5 py-1.5 text-[10px] font-semibold text-emerald-900"
                                      >
                                        {localizeCopy('下载审核通过的图片', 'Scarica immagine WebP')}
                                      </a>
                                      <div className="flex flex-wrap items-end gap-2">
                                        <label className="min-w-[180px] flex-1 text-[10px] font-semibold text-neutral-700">
                                          {localizeCopy('加入本店商品图片组', 'Aggiungi al prodotto')}
                                          <select
                                            value={creativeProducts.some(product => product.id === (creativeAttachProductIds[draft.id] || draft.productId))
                                              ? creativeAttachProductIds[draft.id] || draft.productId || ''
                                              : ''}
                                            onChange={event => setCreativeAttachProductIds(current => ({ ...current, [draft.id]: event.target.value }))}
                                            className="mt-1 w-full rounded-md border border-neutral-200 bg-white px-2 py-1.5 text-[10px] font-normal"
                                          >
                                            <option value="">{localizeCopy('选择商品…', 'Seleziona prodotto…')}</option>
                                            {creativeProducts.map(product => (
                                              <option key={product.id} value={product.id}>{product.styleNo} · {product.name}</option>
                                            ))}
                                          </select>
                                        </label>
                                        <button
                                          type="button"
                                          disabled={!canManage || creativeAttachBusyId !== null || !creativeProducts.some(product => product.id === (creativeAttachProductIds[draft.id] || draft.productId))}
                                          onClick={() => void attachCreativeDraft(employee, draft)}
                                          className="rounded-md bg-emerald-800 px-2.5 py-1.5 text-[10px] font-semibold text-white disabled:opacity-50"
                                        >
                                          {creativeAttachBusyId === draft.id
                                            ? (localizeCopy('添加中…', 'Salvataggio…'))
                                            : (localizeCopy('确认加入商品', 'Conferma aggiunta'))}
                                        </button>
                                        <p className="basis-full text-[9px] leading-4 text-neutral-600">
                                          {localizeCopy('如果商品已上架，保存后图片可能立即展示在店铺。', 'Se il prodotto è già pubblicato, l’immagine potrebbe essere visibile immediatamente.')}
                                        </p>
                                      </div>
                                    </div>
                                  )}
                                  {draft.status !== 'pending_review' && (
                                    <button type="button" disabled={!canManage || creativeBusy} onClick={() => void reviewCreativeDraft(employee, draft, 'delete')} className="rounded-md border border-rose-200 px-2.5 py-1.5 text-[10px] font-semibold text-rose-700 disabled:opacity-50">
                                      {localizeCopy('删除素材', 'Elimina')}
                                    </button>
                                  )}
                                </div>
                              </li>
                            ))}
                          </ul>
                        )}
                      </section>
                    )}
                    {canManage && active && grantedPermissions.includes(productCatalogReadPermission) && reviewQueueDrafts.length > 0 && (
                      <section className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50/50 p-3" aria-label={localizeCopy('待审核商品文案', 'Bozze in attesa di revisione')}>
                        <div className="flex items-center justify-between gap-2">
                          <h3 className="text-xs font-bold text-emerald-950">
                            {localizeCopy('待审核商品文案', 'Bozze in attesa di revisione')}
                          </h3>
                          <span className="rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-semibold text-emerald-900">
                            {reviewQueueDrafts.length}
                          </span>
                        </div>
                        <ul className="mt-3 space-y-3">
                          {reviewQueueDrafts.map(draft => (
                            <li key={draft.id} className="space-y-2 rounded-lg border border-emerald-100 bg-white p-3 text-[11px]">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <span className="font-semibold text-neutral-900">
                                  {draft.productName || (isIt ? 'Prodotto' : '商品')} · {draft.styleNo || draft.productId}
                                </span>
                                <span className="rounded-full bg-neutral-100 px-2 py-1 text-[10px] text-neutral-600">
                                  {draft.language.toUpperCase()}
                                </span>
                              </div>
                              {draft.status === 'stale' ? (
                                <>
                                  <p role="status" className="rounded-md bg-amber-50 px-2.5 py-2 text-[10px] leading-4 text-amber-900">
                                    {localizeCopy('商品内容在生成草稿后已变化，旧稿不能应用。请基于最新内容重新生成建议。', 'Il prodotto è stato modificato dopo la creazione della bozza. Rigenera la proposta prima di applicarla.')}
                                  </p>
                                  <button
                                    type="button"
                                    disabled={contentDraftBusyId !== null || !active || !hireable}
                                    onClick={() => void generateProductCopyDraft(employee, {
                                      id: draft.productId,
                                      name: draft.productName || '',
                                      name_zh: null,
                                      name_it: null,
                                      styleNo: draft.styleNo || draft.productId
                                    }, draft.language)}
                                    className="rounded-md border border-amber-300 px-2.5 py-1.5 text-[10px] font-semibold text-amber-900 disabled:opacity-50"
                                  >
                                    {contentDraftBusyId === draft.productId
                                      ? (localizeCopy('重新生成中…', 'Generazione…'))
                                      : (localizeCopy('基于最新商品内容重新生成', 'Rigenera bozza'))}
                                  </button>
                                </>
                              ) : (
                                <>
                                  <label className="block font-semibold text-neutral-700">
                                    {localizeCopy('建议标题', 'Titolo proposto')}
                                    <input
                                      value={draft.title}
                                      maxLength={120}
                                      onChange={event => setContentDrafts(current => ({
                                        ...current,
                                        [productDraftKey(draft.productId, draft.language)]: { ...current[productDraftKey(draft.productId, draft.language)], title: event.target.value }
                                      }))}
                                      className="mt-1 w-full rounded-md border border-neutral-200 bg-white px-2 py-1.5 text-xs font-normal text-neutral-900"
                                    />
                                  </label>
                                  <label className="block font-semibold text-neutral-700">
                                    {localizeCopy('建议描述', 'Descrizione proposta')}
                                    <textarea
                                      value={draft.description}
                                      maxLength={2000}
                                      rows={4}
                                      onChange={event => setContentDrafts(current => ({
                                        ...current,
                                        [productDraftKey(draft.productId, draft.language)]: { ...current[productDraftKey(draft.productId, draft.language)], description: event.target.value }
                                      }))}
                                      className="mt-1 w-full rounded-md border border-neutral-200 bg-white px-2 py-1.5 text-xs font-normal leading-5 text-neutral-900"
                                    />
                                  </label>
                                  <div className="flex flex-wrap gap-2 pt-1">
                                    <button
                                      type="button"
                                      disabled={contentDraftBusyId !== null || !hireable}
                                      onClick={() => void reviewProductContentDraft(employee, draft, 'apply')}
                                      className="rounded-md bg-emerald-800 px-2.5 py-1.5 text-[10px] font-semibold text-white disabled:opacity-50"
                                    >
                                      {localizeCopy('审核并应用到商品', 'Approva e applica')}
                                    </button>
                                    <button
                                      type="button"
                                      disabled={contentDraftBusyId !== null}
                                      onClick={() => void reviewProductContentDraft(employee, draft, 'reject')}
                                      className="rounded-md border border-neutral-300 px-2.5 py-1.5 text-[10px] font-semibold text-neutral-700 disabled:opacity-50"
                                    >
                                      {localizeCopy('拒绝草稿', 'Rifiuta')}
                                    </button>
                                  </div>
                                </>
                              )}
                            </li>
                          ))}
                        </ul>
                      </section>
                    )}
                    {active && grantedPermissions.includes(productCatalogReadPermission) && (
                      <form onSubmit={event => void searchProductCatalog(employee, event)} className="mt-3">
                        <label className="sr-only" htmlFor={`ai-employee-product-search-${employee.id}`}>
                          {localizeCopy('向商品经理提问', 'Chiedi al Product Manager')}
                        </label>
                        <div className="flex gap-2">
                          <input
                            id={`ai-employee-product-search-${employee.id}`}
                            value={productSearch}
                            onChange={event => setProductSearch(event.target.value)}
                            maxLength={500}
                            placeholder={localizeCopy('搜索商品或款号', 'Cerca prodotto o codice')}
                            className="min-w-0 flex-1 rounded-lg border border-neutral-200 px-3 py-2 text-xs"
                          />
                          <button type="submit" disabled={productSearchBusy} className="rounded-lg bg-neutral-950 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">
                            {productSearchBusy ? (localizeCopy('员工处理中…', 'Analisi…')) : (localizeCopy('让员工处理', 'Chiedi'))}
                          </button>
                        </div>
                        {productSearchError && <p role="alert" className="mt-2 text-[11px] text-rose-700">{productSearchError}</p>}
                        {productManagerReply && <p role="status" className="mt-3 rounded-lg bg-emerald-50 p-3 text-xs leading-5 text-emerald-950">{productManagerReply}</p>}
                        {productResults.length > 0 && (
                          <ul className="mt-3 divide-y divide-neutral-100 rounded-lg border border-neutral-100">
                            {productResults.map(product => {
                              const draft = contentDrafts[productDraftKey(product.id, isIt ? 'it' : 'zh')];
                              return (
                              <li key={product.id} className="space-y-2 px-3 py-3 text-[11px]">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <span className="min-w-0">
                                    <span className="font-semibold text-neutral-900">{product.name_zh || product.name_it || product.name}</span>
                                    <span className="ml-2 text-neutral-500">{product.styleNo} · {product.brand}</span>
                                  </span>
                                  <span className="shrink-0 text-neutral-600">€{Number(product.wholesalePrice).toFixed(2)} · MOQ {product.moq}</span>
                                </div>
                                <button
                                  type="button"
                                  disabled={contentDraftBusyId !== null}
                                  onClick={() => void generateProductCopyDraft(employee, product)}
                                  className="rounded-md border border-emerald-200 px-2.5 py-1.5 font-semibold text-emerald-800 disabled:opacity-50"
                                >
                                  {contentDraftBusyId === product.id
                                    ? (localizeCopy('生成中…', 'Generazione…'))
                                    : (localizeCopy('生成标题与描述建议', 'Genera bozza titolo e descrizione'))}
                                </button>
                                {draft && (
                                  <p className="rounded-md bg-emerald-50 px-2.5 py-2 text-[10px] text-emerald-800">
                                    {localizeCopy('文案已保存，可在上方待审核队列中查看。', 'Bozza salvata nella coda di revisione.')}
                                  </p>
                                )}
                              </li>
                              );
                            })}
                          </ul>
                        )}
                        {contentDraftError && <p role="alert" className="mt-2 text-[11px] text-rose-700">{contentDraftError}</p>}
                      </form>
                    )}
                  </div>
                )}
                {employee.slug === 'inventory-manager' && installed && (
                  <section className="mt-4 space-y-3 rounded-lg border border-sky-200 bg-sky-50/30 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="text-xs font-semibold text-neutral-800">
                        {localizeCopy('本店实际库存 · 只读查询', 'Lettura inventario · sola lettura')}
                        <p className="mt-1 max-w-xl text-[10px] font-normal leading-4 text-neutral-600">
                          {localizeCopy('只读；不可调整、调拨或创建采购单。', 'Sola lettura; non modifica stock né crea ordini.')}
                        </p>
                      </div>
                      <button
                        type="button"
                        disabled={!canManage || busyId !== null || !active || !hireable}
                        onClick={() => void setProductPermission(employee, inventoryStockReadPermission, !grantedPermissions.includes(inventoryStockReadPermission))}
                        className={`rounded-lg px-3 py-2 text-[11px] font-semibold disabled:cursor-not-allowed disabled:opacity-40 ${
                          grantedPermissions.includes(inventoryStockReadPermission)
                            ? 'border border-neutral-200 bg-white text-neutral-700'
                            : 'bg-sky-800 text-white'
                        }`}
                      >
                        {grantedPermissions.includes(inventoryStockReadPermission)
                          ? (localizeCopy('撤销库存读取授权', 'Revoca lettura stock'))
                          : (localizeCopy('授权读取实际库存', 'Autorizza lettura stock'))}
                      </button>
                      <button
                          type="button"
                          disabled={!canManage || busyId !== null || !active || !hireable}
                          onClick={() => void setProductPermission(employee, salesSummaryReadPermission, !grantedPermissions.includes(salesSummaryReadPermission))}
                          className={`rounded-lg px-3 py-2 text-[11px] font-semibold disabled:cursor-not-allowed disabled:opacity-40 ${
                            grantedPermissions.includes(salesSummaryReadPermission)
                              ? 'border border-neutral-200 bg-white text-neutral-700'
                              : 'bg-emerald-800 text-white'
                          }`}
                      >
                          {grantedPermissions.includes(salesSummaryReadPermission)
                            ? (localizeCopy('撤销销售汇总授权', 'Revoca dati vendite'))
                            : (localizeCopy('授权销量与补货分析', 'Autorizza riordino'))}
                      </button>
                    </div>
                    {active && grantedPermissions.includes(inventoryStockReadPermission) && (
                      <>
                        <form onSubmit={event => void searchInventory(employee, event)} className="flex flex-wrap gap-2">
                          <label className="sr-only" htmlFor={`ai-inventory-search-${employee.id}`}>
                            {localizeCopy('查询库存', 'Cerca disponibilità')}
                          </label>
                          <input
                            id={`ai-inventory-search-${employee.id}`}
                            value={inventoryMessage}
                            onChange={event => setInventoryMessage(event.target.value)}
                            maxLength={500}
                            required
                            placeholder={localizeCopy('查询库存或款号', 'Cerca stock o codice')}
                            className="min-w-[220px] flex-1 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs"
                          />
                          <button type="submit" disabled={!canManage || inventoryBusy || !inventoryMessage.trim()} className="rounded-lg bg-sky-800 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">
                            {inventoryBusy ? (localizeCopy('查询中…', 'Ricerca…')) : (localizeCopy('查询本店库存', 'Verifica stock'))}
                          </button>
                        </form>
                        {inventoryError && <p role="alert" className="rounded-md bg-rose-50 px-3 py-2 text-[10px] text-rose-800">{inventoryError}</p>}
                        {inventoryReply && <p role="status" className="rounded-md bg-white px-3 py-2 text-xs leading-5 text-sky-950">{inventoryReply}</p>}
                        {inventoryRecords.length > 0 && (
                          <div className="overflow-x-auto rounded-lg border border-sky-100 bg-white">
                            <table className="w-full min-w-[650px] text-left text-[10px]">
                              <thead className="bg-sky-50 text-neutral-600">
                                <tr>
                                  <th className="px-2.5 py-2 font-semibold">{localizeCopy('商品 / SKU', 'Prodotto / SKU')}</th>
                                  <th className="px-2.5 py-2 font-semibold">{localizeCopy('颜色 / 尺码', 'Colore / taglia')}</th>
                                  <th className="px-2.5 py-2 text-right font-semibold">{localizeCopy('现有', 'A magazzino')}</th>
                                  <th className="px-2.5 py-2 text-right font-semibold">{localizeCopy('预留', 'Riservato')}</th>
                                  <th className="px-2.5 py-2 text-right font-semibold">{localizeCopy('可售', 'Disponibile')}</th>
                                  <th className="px-2.5 py-2 text-right font-semibold">{localizeCopy('在途', 'In transito')}</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-neutral-100">
                                {inventoryRecords.map((record, index) => (
                                  <tr key={`${record.sku}:${record.location}:${index}`} className="text-neutral-700">
                                    <td className="px-2.5 py-2">
                                      <span className="font-semibold text-neutral-900">{record.productName}</span>
                                      <span className="ml-1.5 text-neutral-500">{record.styleNo} · {record.sku}</span>
                                    </td>
                                    <td className="px-2.5 py-2">{[record.color, record.size].filter(Boolean).join(' / ') || '—'}</td>
                                    <td className="px-2.5 py-2 text-right tabular-nums">{record.onHandQuantity}</td>
                                    <td className="px-2.5 py-2 text-right tabular-nums">{record.reservedQuantity}</td>
                                    <td className="px-2.5 py-2 text-right font-semibold tabular-nums">{record.availableQuantity}</td>
                                    <td className="px-2.5 py-2 text-right tabular-nums">{record.inTransitQuantity}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                            <p className="border-t border-neutral-100 px-2.5 py-2 text-[9px] text-neutral-500">
                              {localizeCopy('库存更新时间', 'Aggiornamento dell’inventario')}：{new Date(inventoryRecords[0].updatedAt).toLocaleString(getIntlLocale(lang))}
                            </p>
                          </div>
                        )}
                      </>
                    )}
                  </section>
                )}
                {employee.slug === 'sales-manager' && installed && (
                  <section className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50/40 p-3">
                    <div className="text-xs font-semibold text-neutral-800">
                      {localizeCopy('本店销售汇总 · 只读授权', 'Riepilogo vendite · sola lettura')}
                    </div>
                    <button
                      type="button"
                      disabled={!canManage || busyId !== null || !active || !hireable}
                      onClick={() => void setProductPermission(employee, salesSummaryReadPermission, !grantedPermissions.includes(salesSummaryReadPermission))}
                      className={`rounded-lg px-3 py-2 text-[11px] font-semibold disabled:cursor-not-allowed disabled:opacity-40 ${
                        grantedPermissions.includes(salesSummaryReadPermission)
                          ? 'border border-neutral-200 bg-white text-neutral-700'
                          : 'bg-emerald-800 text-white'
                      }`}
                    >
                      {grantedPermissions.includes(salesSummaryReadPermission)
                        ? (localizeCopy('撤销销售读取授权', 'Revoca riepilogo'))
                        : (localizeCopy('授权读取销售汇总', 'Autorizza riepilogo'))}
                    </button>
                  </section>
                )}
                <div className="mt-4 flex items-center justify-between gap-3 border-t border-neutral-100 pt-3">
                  <span className="text-[10px] text-neutral-500">
                    {localizeCopy('需审核 · 试点免费', 'Soggetto ad approvazione · pilota gratuito')}
                  </span>
                  {employee.installation?.status === 'requested'
                    ? <span className="rounded-lg bg-sky-50 px-3 py-2 text-xs font-semibold text-sky-800">
                      {localizeCopy('申请审核中', 'Richiesta in revisione')}
                    </span>
                    : active || employee.installation?.status === 'paused'
                      ? <button
                        type="button"
                        disabled={!canManage || busyId !== null || (!active && !hireable)}
                        onClick={() => void setEmployeeActive(employee, !active)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 px-3 py-2 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {active ? <CirclePause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                        {busyId === employee.id
                          ? (localizeCopy('处理中…', 'Salvataggio…'))
                          : active
                            ? (localizeCopy('暂停员工', 'Sospendi'))
                            : (localizeCopy('重新启用', 'Riattiva'))}
                      </button>
                      : <button
                        type="button"
                        disabled={!canManage || employee.status === 'paused' || busyId !== null}
                        onClick={() => void setEmployeeActive(employee, true)}
                        className="rounded-lg bg-neutral-950 px-3 py-2 text-xs font-semibold text-white hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {busyId === employee.id
                          ? (localizeCopy('提交中…', 'Invio…'))
                          : employee.installation?.status === 'declined'
                            ? (localizeCopy('重新申请', 'Invia di nuovo'))
                            : (localizeCopy('申请开通员工服务', 'Richiedi attivazione'))}
                      </button>}
                </div>
              </article>;
            })}
          </div>}
    </section>
  );
};
