import {
  getMerchantIndustryTemplate,
  type MerchantIndustryTemplateId
} from '../../../../../constants/merchantIndustryTemplates';
import { ApiError } from '../../../../../api/client';

export type MerchantStudioAccessSummary = {
  industryTemplate: string;
};

const apparelTemplateIds = new Set<MerchantIndustryTemplateId>([
  'apparel_production_wholesale',
  'apparel_wholesale'
]);

export function resolveCurrentMerchantStudio<T extends MerchantStudioAccessSummary>(
  studios: readonly T[],
  industryTemplateId: unknown
): T | null {
  if (typeof industryTemplateId === 'string' && industryTemplateId.trim()) {
    return studios.find(studio => studio.industryTemplate === industryTemplateId.trim()) || null;
  }
  return studios.length === 1 ? studios[0] : null;
}

export function shouldUseModaUIIndustryChat(templateId: unknown, merchantIndustry: unknown): boolean {
  const template = getMerchantIndustryTemplate(templateId);
  if (template) return !apparelTemplateIds.has(template.id);

  const legacyIndustry = typeof merchantIndustry === 'string' ? merchantIndustry.trim().toUpperCase() : '';
  if (!legacyIndustry) return false;
  return legacyIndustry !== 'FASHION_COMPANY' && legacyIndustry !== 'FASHION_WHOLESALE';
}

export function getModaUIIndustryChatTemplate(templateId: unknown) {
  return getMerchantIndustryTemplate(templateId);
}

export function requestsProcurementDraft(message: string): boolean {
  return /(?:创建|生成|准备|新建).{0,12}(?:采购草稿|采购单|采购订单|进货单|补货订单)/i.test(message);
}

export function merchantTaskErrorCopy(error: unknown, isIt: boolean): string {
  const code = error instanceof ApiError ? error.code : error instanceof Error ? error.message : '';
  const known: Record<string, [string, string]> = {
    MODAGPT_TASK_PERMISSION_REQUIRED: ['当前账号没有执行此任务的权限，任务未执行。', 'L’utente non dispone dei permessi per questa attività. Attività non eseguita.'],
    EMPLOYEE_PERMISSION_REQUIRED: ['当前账号没有执行此任务的权限，任务未执行。', 'L’utente non dispone dei permessi per questa attività. Attività non eseguita.'],
    MODAGPT_TASK_WORKFLOW_UNAVAILABLE: ['当前商家行业暂不支持此任务。', 'Questo settore non supporta l’attività richiesta.'],
    MODAGPT_TASK_NOT_FOUND: ['任务不存在或不属于当前商家。', 'Attività non trovata o non appartenente a questo negozio.'],
    REQUEST_TIMEOUT: ['请求超时；如已提交，请使用同一任务重试或查询状态。', 'Richiesta scaduta: riprova con la stessa attività o controllane lo stato.']
  };
  if (code && known[code]) return isIt ? known[code][1] : known[code][0];
  if (error instanceof ApiError && error.status === 401) {
    return isIt ? 'Sessione scaduta: accedi di nuovo.' : '登录已过期，请重新登录。';
  }
  if (error instanceof ApiError && error.status === 403) {
    return isIt ? 'Non hai il permesso di eseguire questa attività.' : '当前账号无权执行此任务。';
  }
  if (error instanceof Error && error.message && !/^[A-Z0-9_]{6,}$/.test(error.message)) return error.message;
  return isIt
    ? `Impossibile completare l’attività${code ? ` (${code})` : ''}. Verifica i dati o riprova.`
    : `任务未能完成${code ? `（${code}）` : ''}。请检查权限和输入后重试。`;
}
