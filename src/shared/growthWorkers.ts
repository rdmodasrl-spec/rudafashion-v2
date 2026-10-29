import type { ModaGptTaskStatus } from '../server/modagptTaskQueue';

export type GrowthWorkerAvailability = 'limited' | 'available' | 'migration_required';
export type GrowthWorkerRuntimeStatus = 'running' | 'stopped';
export type GrowthRoleStatus = 'limited' | 'planned';

export type GrowthRoleDefinition = {
  id: string;
  name: string;
  goal: string;
  status: GrowthRoleStatus;
  currentEvidence: string;
  nextStep: string;
};

export const growthRoleCatalog: readonly GrowthRoleDefinition[] = [
  {
    id: 'growth-manager',
    name: '增长总管',
    goal: '把经授权的增长目标拆解成可审核的 Mission 计划。',
    status: 'limited',
    currentEvidence: '可创建持久化 Mission，并生成范围受限的 AI 策略草稿。',
    nextStep: '接入已验收的子任务 Connector，并保持逐渠道审批。'
  },
  {
    id: 'market-research',
    name: '市场研究',
    goal: '汇总目标市场、客户需求和可追溯的研究证据。',
    status: 'planned',
    currentEvidence: '尚无 Growth OS 市场研究 Worker。',
    nextStep: '定义可信数据源、采集授权、引用和过期策略。'
  },
  {
    id: 'content',
    name: '内容',
    goal: '基于获批主张制作可审核的渠道内容草稿。',
    status: 'planned',
    currentEvidence: 'Mission 可提出内容方向，尚无岗位级内容任务执行链。',
    nextStep: '接入版本化素材、版权检查和人工审核任务。'
  },
  {
    id: 'advertising',
    name: '广告',
    goal: '分析广告表现并在硬预算和审批边界内提出建议。',
    status: 'planned',
    currentEvidence: '没有 Growth OS 广告 Connector 或预算执行器。',
    nextStep: '先接入官方只读数据，再验收硬预算、暂停和审批。'
  },
  {
    id: 'seo',
    name: 'SEO',
    goal: '发现可验证的自然搜索机会并生成可审核优化建议。',
    status: 'planned',
    currentEvidence: '尚无接入真实搜索数据的 Growth SEO Worker。',
    nextStep: '接入授权搜索指标并记录建议来源与效果窗口。'
  },
  {
    id: 'kol',
    name: 'KOL',
    goal: '管理创作者研究、合作简报和效果复盘。',
    status: 'planned',
    currentEvidence: '尚无 KOL 研究、审批和效果任务链。',
    nextStep: '定义公开资料来源、人工联系审批和可复算归因。'
  },
  {
    id: 'sales',
    name: '销售',
    goal: '基于平台授权 CRM 事实准备销售跟进建议。',
    status: 'planned',
    currentEvidence: '现有商家销售员工不等于平台 Growth 销售 Worker。',
    nextStep: '建立平台 scope 的 CRM 权限、任务和人工接管边界。'
  },
  {
    id: 'customer-service',
    name: '客服',
    goal: '归纳服务问题并准备有来源的内部处理建议。',
    status: 'planned',
    currentEvidence: '现有客服能力尚未纳入 Growth Worker 权限与任务审计。',
    nextStep: '限定可读工单、升级规则和消息发送审批。'
  },
  {
    id: 'user-activation',
    name: '用户激活',
    goal: '从真实生命周期事实生成内部激活跟进任务。',
    status: 'limited',
    currentEvidence: 'CRM 规则可生成管理员内部跟进，不会向客户发消息。',
    nextStep: '补齐同意状态、生命周期时间线和人工批准触达。'
  },
  {
    id: 'user-recall',
    name: '用户召回',
    goal: '识别流失风险并生成可审核的内部召回任务。',
    status: 'limited',
    currentEvidence: 'CRM 规则可按登录与订单事实生成内部跟进。',
    nextStep: '补齐联系限制、退订和客户营销同意后再评估外发。'
  },
  {
    id: 'virality',
    name: '裂变',
    goal: '分析可核验的推荐新增、转化和异常模式。',
    status: 'planned',
    currentEvidence: 'Referral 有归属与指标路径，尚无裂变分析 Worker。',
    nextStep: '覆盖真实注册入口、并发首触归属和风险复核。'
  },
  {
    id: 'data-analysis',
    name: '数据分析',
    goal: '基于可复算指标解释结果、数据质量和下一步风险。',
    status: 'limited',
    currentEvidence: 'Growth 看板提供真实基础指标及 unknown 归属提示。',
    nextStep: '补齐指标字典、数据质量覆盖和带来源的 AI 摘要。'
  }
];

export type GrowthWorkerDefinition = {
  id: string;
  name: string;
  kind: 'orchestrator' | 'worker' | 'automation';
  availability: GrowthWorkerAvailability;
  runtimeStatus: GrowthWorkerRuntimeStatus | null;
  scope: 'platform';
  purpose: string;
  capabilities: string[];
  permissionBoundary: string;
  humanControl: 'approval' | 'internal_follow_up';
  externalSideEffects: false;
  taskType: string | null;
  taskCounts: Partial<Record<ModaGptTaskStatus, number>> | null;
  lastActivityAt: string | null;
};
