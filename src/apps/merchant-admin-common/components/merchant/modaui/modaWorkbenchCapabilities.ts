/**
 * ModaUI 工作台能力注册表。
 *
 * 这里是“用户可选择的五项创作能力”在前端的唯一声明处：
 * - 每项能力对应的真实执行方式（服务端文字生成 / 服务端试穿 / 本地像素换色 / 未接入）；
 * - 需要的素材槽位；
 * - 依据服务端 entitlements 计算结果可用性。
 *
 * 规则：能力是否可用只由服务端返回的套餐、能力开关与图片引擎决定，前端不硬编码“应该能用”。
 * 没有真实引擎的能力（时装视频、图生图棚拍）必须返回 blocked，界面不得发起请求。
 */

export const WORKBENCH_CAPABILITY_IDS = ['design', 'tryon', 'recolor', 'studio', 'video'] as const;

export type WorkbenchCapabilityId = (typeof WORKBENCH_CAPABILITY_IDS)[number];

export type WorkbenchExecution =
  | 'server_image_generation'
  | 'server_try_on'
  | 'client_recolor'
  | 'unavailable';

export type WorkbenchAssetSlot = 'person' | 'garment';

export type WorkbenchMissingInput = 'brief' | WorkbenchAssetSlot;

export type WorkbenchBlockedReason = 'not_integrated' | 'plan_required' | 'engine_unavailable';

export type WorkbenchImageProvider = 'fal' | 'automatic1111' | 'local' | 'unavailable';

export type WorkbenchEntitlementSnapshot = {
  plan: string;
  imageGeneration: boolean;
  tryOn: boolean;
  imageProvider: WorkbenchImageProvider;
};

export type WorkbenchAvailability = {
  available: boolean;
  /** 不可用时必须给出真实原因；可用时不填。 */
  reason?: WorkbenchBlockedReason;
};

export type WorkbenchCapability = {
  id: WorkbenchCapabilityId;
  labelZh: string;
  labelIt: string;
  hintZh: string;
  hintIt: string;
  execution: WorkbenchExecution;
  requires: readonly WorkbenchMissingInput[];
};

/** 与服务端 `productLaunch` 套餐门槛一致的棚拍套餐集合。 */
export const WORKBENCH_STUDIO_PLANS = ['pro', 'business', 'fashion_pro'] as const;

export const WORKBENCH_CAPABILITIES: readonly WorkbenchCapability[] = [
  {
    id: 'design',
    labelZh: 'AI 服装设计',
    labelIt: 'Design moda',
    hintZh: '文字或参考方向生成款式',
    hintIt: 'Crea un capo da un brief',
    execution: 'server_image_generation',
    requires: ['brief']
  },
  {
    id: 'tryon',
    labelZh: '虚拟试穿',
    labelIt: 'Prova virtuale',
    hintZh: '人物与服装两个素材',
    hintIt: 'Persona e capo',
    execution: 'server_try_on',
    requires: ['person', 'garment']
  },
  {
    id: 'recolor',
    labelZh: '精准换色',
    labelIt: 'Ricoloratura',
    hintZh: '保留纹理与版型换色',
    hintIt: 'Cambia colore, mantieni il capo',
    execution: 'client_recolor',
    requires: ['garment']
  },
  {
    id: 'studio',
    labelZh: '商业棚拍',
    labelIt: 'Servizio commerciale',
    hintZh: '主图、模特图、细节图',
    hintIt: 'Scatti commerciali',
    execution: 'server_image_generation',
    requires: ['brief']
  },
  {
    id: 'video',
    labelZh: '时装视频',
    labelIt: 'Video moda',
    hintZh: '视频引擎未接入',
    hintIt: 'Motore video non attivo',
    execution: 'unavailable',
    requires: []
  }
];

export function getWorkbenchCapability(id: WorkbenchCapabilityId): WorkbenchCapability {
  const capability = WORKBENCH_CAPABILITIES.find(item => item.id === id);
  if (!capability) throw new Error('MODAUI_WORKBENCH_CAPABILITY_UNKNOWN');
  return capability;
}

/**
 * 解析能力可用性。
 * `snapshot` 为 null 表示套餐/额度尚未加载成功：此时除本地换色外一律按引擎不可用处理，
 * 避免在未知状态下发起可能扣额度的请求。
 */
export function resolveWorkbenchAvailability(
  id: WorkbenchCapabilityId,
  snapshot: WorkbenchEntitlementSnapshot | null
): WorkbenchAvailability {
  const capability = getWorkbenchCapability(id);
  if (capability.execution === 'unavailable') return { available: false, reason: 'not_integrated' };
  if (capability.execution === 'client_recolor') return { available: true };
  if (!snapshot) return { available: false, reason: 'engine_unavailable' };

  const imageReady = snapshot.imageGeneration && snapshot.imageProvider !== 'unavailable';
  if (capability.execution === 'server_try_on') {
    if (!snapshot.tryOn || snapshot.imageProvider !== 'fal') {
      return { available: false, reason: 'engine_unavailable' };
    }
    return { available: true };
  }

  if (!imageReady) return { available: false, reason: 'engine_unavailable' };
  if (id === 'studio' && !WORKBENCH_STUDIO_PLANS.includes(snapshot.plan as (typeof WORKBENCH_STUDIO_PLANS)[number])) {
    return { available: false, reason: 'plan_required' };
  }
  return { available: true };
}

export function isWorkbenchCapabilityId(value: unknown): value is WorkbenchCapabilityId {
  return typeof value === 'string' && (WORKBENCH_CAPABILITY_IDS as readonly string[]).includes(value);
}
