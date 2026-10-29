import React, { useCallback, useEffect, useState } from 'react';
import { Bot, RefreshCw } from 'lucide-react';
import { apiGet } from '../../../../api/client';
import { growthRoleCatalog, type GrowthWorkerDefinition } from '../../../../shared/growthWorkers';

type GrowthWorkerCenterResponse = {
  checkedAt: string;
  workers: GrowthWorkerDefinition[];
};

const availabilityLabels = {
  limited: '有限能力',
  available: '能力已实现',
  migration_required: '等待数据库迁移'
} as const;

const roleStatusLabels = {
  limited: '有限实现',
  planned: '尚未实现'
} as const;

const runtimeStatusLabels = {
  running: '进程运行中',
  stopped: '进程未运行'
} as const;

const taskStatusLabels: Record<string, string> = {
  queued: '排队中',
  planning: '规划中',
  running: '运行中',
  waiting_approval: '待审核',
  verifying: '校验中',
  retrying: '重试中',
  completed: '已完成',
  failed: '失败',
  dead_letter: '死信',
  cancelled: '已取消'
};

export function AdminGrowthWorkerCenter() {
  const [data, setData] = useState<GrowthWorkerCenterResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setData(await apiGet<GrowthWorkerCenterResponse>('/api/admin/growth/workers'));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '读取智能工人状态失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <section className="border border-neutral-200 bg-white p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-bold text-neutral-900"><Bot className="h-4 w-4" />AI 智能工人中心</h3>
          <p className="mt-1 max-w-4xl text-xs leading-5 text-neutral-600">仅展示当前已实现的 Growth OS 编排器、队列 Worker 和规则自动化。状态与任务数来自运行配置和持久化队列；有限运行或等待迁移的能力不会显示为已全面自动化。</p>
        </div>
        <button type="button" onClick={() => void load()} disabled={loading} className="inline-flex min-h-9 items-center gap-2 border border-neutral-300 px-3 text-xs font-semibold disabled:opacity-50">
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />刷新
        </button>
      </div>
      {error && <p role="alert" className="mt-3 border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">智能工人状态读取失败：{error}</p>}
      <div className="mt-4">
        <h4 className="text-xs font-bold text-neutral-900">蓝图岗位（{growthRoleCatalog.length}）</h4>
        <p className="mt-1 text-[10px] leading-4 text-neutral-500">岗位状态按当前代码能力标注；“尚未实现”的岗位不会创建任务、显示运行量或执行外部操作。</p>
        <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {growthRoleCatalog.map(role => (
            <article key={role.id} className="border border-neutral-200 bg-neutral-50 p-3">
              <div className="flex items-start justify-between gap-2">
                <h5 className="text-xs font-bold text-neutral-900">{role.name}</h5>
                <span className={`shrink-0 rounded-full px-2 py-1 text-[9px] font-semibold ${role.status === 'limited' ? 'bg-amber-100 text-amber-800' : 'bg-neutral-200 text-neutral-700'}`}>
                  {roleStatusLabels[role.status]}
                </span>
              </div>
              <p className="mt-2 text-[10px] leading-4 text-neutral-700">目标：{role.goal}</p>
              <p className="mt-1 text-[10px] leading-4 text-neutral-500">现状：{role.currentEvidence}</p>
              <p className="mt-1 text-[10px] leading-4 text-neutral-500">下一步：{role.nextStep}</p>
            </article>
          ))}
        </div>
      </div>
      <div className="mt-5 border-t border-neutral-200 pt-4">
        <h4 className="text-xs font-bold text-neutral-900">实际运行组件</h4>
      </div>
      {loading && !data ? <p className="py-6 text-center text-xs text-neutral-500">正在读取运行状态…</p> : data && (
        <>
          <div className="mt-4 grid gap-3 lg:grid-cols-3">
            {data.workers.map(worker => (
              <article key={worker.id} className="rounded-lg border border-neutral-200 bg-neutral-50 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h4 className="text-xs font-bold text-neutral-900">{worker.name}</h4>
                    <p className="mt-1 text-[10px] text-neutral-500">{worker.kind} · {worker.scope}</p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-semibold ${worker.availability === 'available' ? 'bg-emerald-100 text-emerald-800' : worker.availability === 'limited' ? 'bg-amber-100 text-amber-800' : 'bg-neutral-200 text-neutral-700'}`}>
                    {availabilityLabels[worker.availability]}
                  </span>
                </div>
                <p className="mt-2 text-[11px] leading-5 text-neutral-700">{worker.purpose}</p>
                <p className="mt-2 text-[10px] leading-4 text-neutral-500">{worker.permissionBoundary}</p>
                {worker.runtimeStatus && (
                  <p className={`mt-2 text-[10px] font-semibold ${worker.runtimeStatus === 'running' ? 'text-emerald-700' : 'text-amber-700'}`}>
                    实际进程：{runtimeStatusLabels[worker.runtimeStatus]}
                  </p>
                )}
                <ul className="mt-2 list-inside list-disc text-[10px] leading-4 text-neutral-600">
                  {worker.capabilities.map(capability => <li key={capability}>{capability}</li>)}
                </ul>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  <span className="rounded bg-white px-2 py-1 text-[9px] text-neutral-600">{worker.humanControl === 'approval' ? '需人工审核后继续' : '由团队人工完成跟进'}</span>
                  <span className="rounded bg-white px-2 py-1 text-[9px] text-neutral-600">无外部副作用</span>
                  {worker.taskType && <span className="rounded bg-white px-2 py-1 text-[9px] text-neutral-600">{worker.taskType}</span>}
                </div>
                {worker.taskCounts && (
                  <div className="mt-3 flex flex-wrap gap-2 border-t border-neutral-200 pt-2">
                    {Object.entries(worker.taskCounts).map(([status, count]) => (
                      <span key={status} className="text-[9px] text-neutral-600">{taskStatusLabels[status] || status} {count}</span>
                    ))}
                    {Object.keys(worker.taskCounts).length === 0 && <span className="text-[9px] text-neutral-500">暂无队列任务</span>}
                  </div>
                )}
              </article>
            ))}
          </div>
          <p className="mt-3 text-right text-[10px] text-neutral-400">状态检查：{new Date(data.checkedAt).toLocaleString()}</p>
        </>
      )}
    </section>
  );
}
