import type { ModaGptTaskStatus } from './modagptTaskQueue';
import type { GrowthWorkerDefinition, GrowthWorkerRuntimeStatus } from '../shared/growthWorkers';

export function buildGrowthWorkerCenter(input: {
  growthMissionReady: boolean;
  taskQueueReady: boolean;
  crmAutomationReady: boolean;
  taskWorkerRuntimeStatus: GrowthWorkerRuntimeStatus;
  reviewTasks: Array<{ status: string; count: number; lastUpdatedAt: Date | null }>;
}): GrowthWorkerDefinition[] {
  const taskCounts: Partial<Record<ModaGptTaskStatus, number>> = {};
  let lastActivityAt: string | null = null;
  for (const task of input.reviewTasks) {
    if (
      task.status === 'queued' || task.status === 'planning' || task.status === 'running'
      || task.status === 'waiting_approval' || task.status === 'verifying'
      || task.status === 'retrying' || task.status === 'completed' || task.status === 'failed'
      || task.status === 'dead_letter' || task.status === 'cancelled'
    ) {
      taskCounts[task.status] = task.count;
    }
    if (task.lastUpdatedAt && (!lastActivityAt || task.lastUpdatedAt.toISOString() > lastActivityAt)) {
      lastActivityAt = task.lastUpdatedAt.toISOString();
    }
  }

  return [
    {
      id: 'growth-manager',
      name: 'Growth Manager',
      kind: 'orchestrator',
      availability: input.growthMissionReady ? 'limited' : 'migration_required',
      runtimeStatus: null,
      scope: 'platform',
      purpose: '将管理员设定的增长目标转为 Growth Mission 策略草稿。',
      capabilities: ['范围受限的 AI 策略草稿', '市场与渠道建议', '人工审核后内部规划'],
      permissionBoundary: '仅平台 Growth Mission；不操作预算、渠道或客户消息。',
      humanControl: 'approval',
      externalSideEffects: false,
      taskType: null,
      taskCounts: null,
      lastActivityAt: null
    },
    {
      id: 'growth-mission-review-worker',
      name: 'Growth Mission Review Worker',
      kind: 'worker',
      availability: input.growthMissionReady && input.taskQueueReady ? 'available' : 'migration_required',
      runtimeStatus: input.taskWorkerRuntimeStatus,
      scope: 'platform',
      purpose: '校验已生成的 Mission 建议并准备内部人工审核任务。',
      capabilities: ['验证 Mission 与建议范围', '写入审核队列', '保留可审计任务结果'],
      permissionBoundary: '仅处理 tenant=platform 的 Growth Mission review 任务；不得执行外部发布。',
      humanControl: 'approval',
      externalSideEffects: false,
      taskType: 'growth.mission.review',
      taskCounts: input.taskQueueReady ? taskCounts : null,
      lastActivityAt: input.taskQueueReady ? lastActivityAt : null
    },
    {
      id: 'growth-crm-lifecycle-rules',
      name: 'CRM Activation & Retention Rules',
      kind: 'automation',
      availability: input.crmAutomationReady ? 'available' : 'migration_required',
      runtimeStatus: null,
      scope: 'platform',
      purpose: '根据注册时长、订单数和最近登录时间生成内部跟进任务。',
      capabilities: ['注册激活跟进', '长期未登录服务核实'],
      permissionBoundary: '仅读取现有平台消费者事实并创建管理员内部任务；不会向客户发送消息。',
      humanControl: 'internal_follow_up',
      externalSideEffects: false,
      taskType: null,
      taskCounts: null,
      lastActivityAt: null
    }
  ];
}
