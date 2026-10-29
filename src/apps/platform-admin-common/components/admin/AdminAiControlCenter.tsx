import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Activity, Bot, BrainCircuit, CirclePause, RefreshCw, Rocket, Save, ShieldCheck, Sparkles } from 'lucide-react';
import { apiGet, apiPatch, apiPost, apiPut } from '../../../../api/client';
import { PasswordInput } from '../../../shared/components/common/PasswordInput';
import { AdminGrowthWorkerCenter } from './AdminGrowthWorkerCenter';
import {
  getAiProviderCircuitLabel,
  getAiProviderInferenceMetricLabel,
  parseAiProviderCircuitSnapshots,
  parseAiProviderInferenceMetrics,
  parseAiProviderSettings,
  type AiProviderCircuitSnapshot,
  type AiProviderInferenceMetric,
  type AiProviderEntry,
  type AiProviderMode,
  type AiProviderSettings
} from './aiProviderSettings';

type AiEmployeeStatus = 'planned' | 'development' | 'pilot' | 'available' | 'paused';
type AiEmployee = {
  id: string;
  slug: string;
  name: string;
  department: string;
  description: string;
  version: string;
  status: AiEmployeeStatus;
  capabilities: string;
  requiredPermissions: string;
};
type EmployeeDraft = Pick<AiEmployee, 'description' | 'status' | 'version'>;
type AiEmployeeRequest = {
  id: string;
  createdAt: string;
  merchant: { name: string; storeSlug: string };
  definition: { id: string; name: string; slug: string; status: AiEmployeeStatus; department: string };
};
type LocalModelStatus = {
  provider: 'ollama' | 'deepseek' | 'gemini';
  model: string;
  fallbackToLocal: boolean;
  reachable: boolean;
  modelInstalled: boolean;
  inferenceSucceeded: boolean;
  inferenceDurationMs: number | null;
  inferenceErrorCode: string | null;
};
type AiEmployeeInferenceMetric = {
  attempts: number;
  failures: number;
  failureRate: number;
  averageDurationMs: number;
  lastDurationMs: number;
  lastSucceeded: boolean;
};
type LocalModelDiagnostics = {
  reasoning: LocalModelStatus;
  vision: LocalModelStatus;
  inferenceMetrics: Record<string, AiEmployeeInferenceMetric>;
};
type AssistantFeedback = {
  id: string;
  merchantId: string;
  merchantName: string;
  conversationTitle: string;
  context: string;
  feedback: 'up' | 'down';
  feedbackAt: string | null;
  feedbackPrompt: string | null;
  content: string;
};
type ModaGptTask = {
  id: string;
  merchantId: string | null;
  taskType: string;
  status: 'pending' | 'processing' | 'retry' | 'succeeded' | 'dead_letter';
  attempts: number;
  maxAttempts: number;
  availableAt: string;
  lockedUntil: string | null;
  lastErrorCode: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

const statusLabels: Record<AiEmployeeStatus, string> = {
  planned: '规划中',
  development: '开发中',
  pilot: '内部试点',
  available: '商家可开通',
  paused: '已暂停'
};

function parseList(value: string): string[] {
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

type AdminAiControlCenterView = 'agents' | 'models';

const AdminAiControlCenterContent: React.FC<{ view: AdminAiControlCenterView }> = ({ view }) => {
  const [employees, setEmployees] = useState<AiEmployee[]>([]);
  const [requests, setRequests] = useState<AiEmployeeRequest[]>([]);
  const [drafts, setDrafts] = useState<Record<string, EmployeeDraft>>({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [providerSettings, setProviderSettings] = useState<AiProviderSettings | null>(null);
  const [providerCircuits, setProviderCircuits] = useState<Record<string, AiProviderCircuitSnapshot> | null>(null);
  const [inferenceMetrics, setInferenceMetrics] = useState<Record<string, AiProviderInferenceMetric> | null>(null);
  const [telemetryLoading, setTelemetryLoading] = useState(false);
  const [telemetryError, setTelemetryError] = useState('');
  const [telemetryUpdatedAt, setTelemetryUpdatedAt] = useState<string | null>(null);
  const telemetryMounted = useRef(false);
  const telemetryRequestInFlight = useRef(false);
  const [providerSettingsDirty, setProviderSettingsDirty] = useState(false);
  const [localModelDiagnostics, setLocalModelDiagnostics] = useState<LocalModelDiagnostics | null>(null);
  const [deepseekApiKey, setDeepseekApiKey] = useState('');
  const [clearDeepSeekApiKey, setClearDeepSeekApiKey] = useState(false);
  const [falApiKey, setFalApiKey] = useState('');
  const [clearFalApiKey, setClearFalApiKey] = useState(false);
  const [openaiApiKey, setOpenAiApiKey] = useState('');
  const [clearOpenAiApiKey, setClearOpenAiApiKey] = useState(false);
  const [geminiApiKey, setGeminiApiKey] = useState('');
  const [clearGeminiApiKey, setClearGeminiApiKey] = useState(false);
  const [error, setError] = useState('');
  const [loadErrors, setLoadErrors] = useState<{ employees: string; requests: string; providers: string }>({ employees: '', requests: '', providers: '' });
  const [notice, setNotice] = useState('');
  const [assistantFeedback, setAssistantFeedback] = useState<AssistantFeedback[]>([]);
  const [feedbackLoading, setFeedbackLoading] = useState(true);
  const [feedbackError, setFeedbackError] = useState('');
  const [modaGptTasks, setModaGptTasks] = useState<ModaGptTask[]>([]);
  const [modaGptTaskCounts, setModaGptTaskCounts] = useState<Record<string, number> | null>(null);
  const [modaGptQueueLoading, setModaGptQueueLoading] = useState(true);
  const [modaGptQueueError, setModaGptQueueError] = useState('');
  const [retryingTaskId, setRetryingTaskId] = useState<string | null>(null);
  const [modaGptQueueNotice, setModaGptQueueNotice] = useState('');
  const modaGptQueueMounted = useRef(false);
  const modaGptQueueRequestInFlight = useRef(false);

  const loadEmployees = async () => {
    setLoading(true);
    setError('');
    const [employeeResult, requestResult, providerResult] = await Promise.allSettled([
      apiGet<{ employees: AiEmployee[] }>('/api/admin/ai-employees'),
      apiGet<{ requests: AiEmployeeRequest[] }>('/api/admin/ai-employee-requests'),
      apiGet<{ providers: unknown; providerCircuits?: unknown; inferenceMetrics?: unknown }>('/api/admin/ai-employee-providers')
    ]);
    const parsedProviders = providerResult.status === 'fulfilled'
      ? parseAiProviderSettings(providerResult.value.providers)
      : null;
    setProviderCircuits(providerResult.status === 'fulfilled'
      ? parseAiProviderCircuitSnapshots(providerResult.value.providerCircuits)
      : null);
    setInferenceMetrics(providerResult.status === 'fulfilled'
      ? parseAiProviderInferenceMetrics(providerResult.value.inferenceMetrics)
      : null);
    const resultErrors = {
      employees: employeeResult.status === 'rejected'
        ? employeeResult.reason instanceof Error ? employeeResult.reason.message : 'AI 员工目录读取失败'
        : !Array.isArray(employeeResult.value.employees) ? 'AI 员工目录返回的数据格式无效' : '',
      requests: requestResult.status === 'rejected'
        ? requestResult.reason instanceof Error ? requestResult.reason.message : '员工申请列表读取失败'
        : !Array.isArray(requestResult.value.requests) ? '员工申请列表返回的数据格式无效' : '',
      providers: providerResult.status === 'rejected'
        ? providerResult.reason instanceof Error ? providerResult.reason.message : 'AI 服务配置读取失败'
        : !parsedProviders ? 'AI 服务配置缺少有效的模型通道信息，请检查后台前后端部署版本后重试。' : ''
    };
    setLoadErrors(resultErrors);
    if (!resultErrors.employees && employeeResult.status === 'fulfilled') {
      setEmployees(employeeResult.value.employees);
      setDrafts(Object.fromEntries(employeeResult.value.employees.map(employee => [employee.id, {
        description: employee.description,
        status: employee.status,
        version: employee.version
      }])));
    }
    if (!resultErrors.requests && requestResult.status === 'fulfilled') setRequests(requestResult.value.requests);
    if (!resultErrors.providers && parsedProviders && !providerSettingsDirty) {
      setProviderSettings(parsedProviders);
    }
    setLoading(false);
  };

  const refreshProviderTelemetry = useCallback(async () => {
    if (telemetryRequestInFlight.current) return;
    telemetryRequestInFlight.current = true;
    setTelemetryLoading(true);
    try {
      const result = await apiGet<{ providerCircuits?: unknown; inferenceMetrics?: unknown }>('/api/admin/ai-employee-providers');
      const circuits = parseAiProviderCircuitSnapshots(result.providerCircuits);
      const metrics = parseAiProviderInferenceMetrics(result.inferenceMetrics);
      if (circuits === null || metrics === null) {
        throw new Error('AI 服务运行状态接口返回的数据格式无效。');
      }
      if (telemetryMounted.current) {
        setProviderCircuits(circuits);
        setInferenceMetrics(metrics);
        setTelemetryUpdatedAt(new Date().toISOString());
        setTelemetryError('');
      }
    } catch (loadError) {
      if (telemetryMounted.current) {
        setTelemetryError(loadError instanceof Error ? loadError.message : 'AI 服务运行状态读取失败。');
      }
    } finally {
      telemetryRequestInFlight.current = false;
      if (telemetryMounted.current) setTelemetryLoading(false);
    }
  }, []);

  const loadAssistantFeedback = async () => {
    setFeedbackLoading(true);
    setFeedbackError('');
    try {
      const result = await apiGet<{ success: true; feedback: AssistantFeedback[] }>('/api/admin/merchant-assistant/feedback');
      if (!Array.isArray(result.feedback)) throw new Error('ModaUI 反馈接口返回的数据格式无效');
      setAssistantFeedback(result.feedback);
    } catch (loadError) {
      setFeedbackError(loadError instanceof Error && loadError.message === 'AI_FEEDBACK_MIGRATION_REQUIRED'
        ? '反馈数据所需的数据库迁移尚未应用。请先备份数据库并审核待执行迁移，再按生产部署流程更新。'
        : loadError instanceof Error ? loadError.message : 'ModaUI 反馈读取失败。');
    } finally {
      setFeedbackLoading(false);
    }
  };

  const refreshModaGptQueue = useCallback(async () => {
    if (modaGptQueueRequestInFlight.current) return;
    modaGptQueueRequestInFlight.current = true;
    setModaGptQueueLoading(true);
    try {
      const result = await apiGet<{
        tasks: ModaGptTask[];
        counts: Record<string, number>;
      }>('/api/admin/modagpt/tasks');
      if (
        !Array.isArray(result.tasks)
        || !result.counts
        || typeof result.counts !== 'object'
        || Object.values(result.counts).some(count => !Number.isInteger(count) || count < 0)
      ) throw new Error('ModaUI 任务队列接口返回的数据格式无效。');
      if (modaGptQueueMounted.current) {
        setModaGptTasks(result.tasks);
        setModaGptTaskCounts(result.counts);
        setModaGptQueueError('');
      }
    } catch (queueError) {
      if (modaGptQueueMounted.current) {
        setModaGptQueueError(queueError instanceof Error ? queueError.message : 'ModaUI 任务队列读取失败。');
      }
    } finally {
      modaGptQueueRequestInFlight.current = false;
      if (modaGptQueueMounted.current) setModaGptQueueLoading(false);
    }
  }, []);

  const retryModaGptTask = async (task: ModaGptTask) => {
    setRetryingTaskId(task.id);
    setModaGptQueueNotice('');
    setModaGptQueueError('');
    try {
      await apiPost(`/api/admin/modagpt/tasks/${encodeURIComponent(task.id)}/retry`, {});
      setModaGptQueueNotice(`任务 ${task.id} 已重新排队。`);
      await refreshModaGptQueue();
    } catch (queueError) {
      setModaGptQueueError(queueError instanceof Error ? queueError.message : 'ModaUI 任务重试失败。');
    } finally {
      setRetryingTaskId(null);
    }
  };

  useEffect(() => {
    void loadEmployees();
    void loadAssistantFeedback();
  }, []);

  useEffect(() => {
    telemetryMounted.current = true;
    void refreshProviderTelemetry();
    const timer = window.setInterval(() => void refreshProviderTelemetry(), 30_000);
    return () => {
      telemetryMounted.current = false;
      window.clearInterval(timer);
    };
  }, [refreshProviderTelemetry]);

  useEffect(() => {
    modaGptQueueMounted.current = true;
    void refreshModaGptQueue();
    const timer = window.setInterval(() => void refreshModaGptQueue(), 30_000);
    return () => {
      modaGptQueueMounted.current = false;
      window.clearInterval(timer);
    };
  }, [refreshModaGptQueue]);

  const updateDraft = (id: string, update: Partial<EmployeeDraft>) => {
    setDrafts(current => ({ ...current, [id]: { ...current[id], ...update } }));
    setNotice('');
  };

  const saveEmployee = async (employee: AiEmployee) => {
    const draft = drafts[employee.id];
    if (!draft) return;
    setSavingId(employee.id);
    setError('');
    setNotice('');
    try {
      const result = await apiPut<{ employee: AiEmployee }>(`/api/admin/ai-employees/${encodeURIComponent(employee.id)}`, draft);
      setEmployees(current => current.map(item => item.id === employee.id ? result.employee : item));
      setRequests(current => current.map(request => request.definition.id === employee.id
        ? { ...request, definition: { ...request.definition, status: result.employee.status } }
        : request));
      setDrafts(current => ({ ...current, [employee.id]: {
        description: result.employee.description,
        status: result.employee.status,
        version: result.employee.version
      } }));
      setNotice(`${employee.name} 的目录配置已保存。`);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : '保存失败，请检查配置后重试。');
    } finally {
      setSavingId(null);
    }
  };

  const decideRequest = async (request: AiEmployeeRequest, decision: 'approve' | 'decline') => {
    setSavingId(request.id);
    setError('');
    setNotice('');
    try {
      await apiPatch(`/api/admin/ai-employee-requests/${encodeURIComponent(request.id)}`, { decision });
      setRequests(current => current.filter(item => item.id !== request.id));
      setNotice(decision === 'approve'
        ? `${request.merchant.name} 的 ${request.definition.name} 申请已批准。`
        : `${request.merchant.name} 的 ${request.definition.name} 申请已拒绝。`);
    } catch (decisionError) {
      setError(decisionError instanceof Error ? decisionError.message : '处理 AI 员工申请失败，请重试。');
    } finally {
      setSavingId(null);
    }
  };

  const updateProvider = (role: keyof Pick<AiProviderSettings, 'reasoning' | 'advancedReasoning' | 'vision' | 'image'>, update: Partial<AiProviderEntry>) => {
    setProviderSettings(current => current ? {
      ...current,
      [role]: { ...current[role], ...update }
    } : current);
    setProviderSettingsDirty(true);
    setLocalModelDiagnostics(null);
    setNotice('');
  };

  const saveProviderSettings = async () => {
    if (!providerSettings) return;
    setSavingId('ai-provider-settings');
    setError('');
    setNotice('');
    try {
      const result = await apiPut<{ providers: AiProviderSettings }>('/api/admin/ai-employee-providers', {
        reasoning: providerSettings.reasoning,
        advancedReasoning: providerSettings.advancedReasoning,
        vision: providerSettings.vision,
        image: providerSettings.image,
        deepseekApiKey,
        clearDeepSeekApiKey,
        falApiKey,
        clearFalApiKey,
        openaiApiKey,
        clearOpenAiApiKey,
        geminiApiKey,
        clearGeminiApiKey
      });
      setProviderSettings(result.providers);
      setProviderSettingsDirty(false);
      setDeepseekApiKey('');
      setClearDeepSeekApiKey(false);
      setFalApiKey('');
      setClearFalApiKey(false);
      setOpenAiApiKey('');
      setClearOpenAiApiKey(false);
      setGeminiApiKey('');
      setClearGeminiApiKey(false);
      setNotice('AI 服务设置已保存，服务密钥仅加密保存在 RUDA 服务器。');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : '保存 AI 服务配置失败，请重试。');
    } finally {
      setSavingId(null);
    }
  };

  const testDeepSeekConnection = async () => {
    setSavingId('deepseek-test');
    setError('');
    setNotice('');
    try {
      const result = await apiPost<{ model: string }>('/api/admin/ai-employee-providers/test-deepseek', {});
      setNotice(`DeepSeek 连接成功（${result.model}）。`);
    } catch (testError) {
      setError(testError instanceof Error ? testError.message : 'DeepSeek 连接失败，请检查设置。');
    } finally {
      setSavingId(null);
    }
  };

  const testFalConnection = async () => {
    setSavingId('fal-test');
    setError('');
    setNotice('');
    try {
      const result = await apiPost<{ model: string }>('/api/admin/ai-employee-providers/test-fal', {});
      setNotice(`Fal 连接成功（${result.model}），已生成一张测试图片。`);
    } catch (testError) {
      setError(testError instanceof Error ? testError.message : 'Fal 连接失败，请检查设置。');
    } finally {
      setSavingId(null);
    }
  };

  const testOpenAiConnection = async () => {
    setSavingId('openai-test');
    setError('');
    setNotice('');
    try {
      const result = await apiPost<{ model: string }>('/api/admin/ai-employee-providers/test-openai', {});
      setNotice(`OpenAI 复杂 Agent 通道连接成功（${result.model}）。`);
    } catch (testError) {
      setError(testError instanceof Error ? testError.message : 'OpenAI 连接失败，请检查设置。');
    } finally {
      setSavingId(null);
    }
  };

  const testGeminiConnection = async () => {
    setSavingId('gemini-test');
    setError('');
    setNotice('');
    try {
      const result = await apiPost<{ model: string }>('/api/admin/ai-employee-providers/test-gemini', {});
      setNotice(`Gemini 视觉通道连接成功（${result.model}）；仅发送了合成的 1 像素测试图。`);
    } catch (testError) {
      setError(testError instanceof Error ? testError.message : 'Gemini 连接失败，请检查设置。');
    } finally {
      setSavingId(null);
    }
  };

  const testLocalModels = async () => {
    setSavingId('local-model-test');
    setError('');
    setNotice('');
    try {
      const result = await apiPost<{ models: LocalModelDiagnostics }>('/api/admin/ai-employee-providers/test-local-models', {});
      setLocalModelDiagnostics(result.models);
      const reasoningRequired = result.models.reasoning.provider === 'ollama' || result.models.reasoning.fallbackToLocal;
      const visionRequired = result.models.vision.provider === 'ollama' || result.models.vision.fallbackToLocal;
      const allReady = (!visionRequired || (
        result.models.vision.reachable
        && result.models.vision.modelInstalled
        && result.models.vision.inferenceSucceeded
      ))
        && (!reasoningRequired || (
          result.models.reasoning.reachable
          && result.models.reasoning.modelInstalled
          && result.models.reasoning.inferenceSucceeded
        ));
      setNotice(allReady
        ? '当前配置需要的本地模型回退链路均已通过真实推理诊断。'
        : '本地模型诊断已完成；请根据下方状态检查服务、模型安装或真实推理错误。');
    } catch (testError) {
      setError(testError instanceof Error ? testError.message : '本地模型诊断失败，请稍后重试。');
    } finally {
      setSavingId(null);
    }
  };

  const counts = employees.reduce<Record<AiEmployeeStatus, number>>((result, employee) => {
    result[employee.status] += 1;
    return result;
  }, { planned: 0, development: 0, pilot: 0, available: 0, paused: 0 });

  return (
    <section className="space-y-5" aria-labelledby="ai-control-center-title">
      <header className="rounded-xl bg-neutral-950 p-5 text-white sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-emerald-400"><BrainCircuit className="h-5 w-5" /><span className="text-xs font-semibold tracking-wider">{view === 'agents' ? 'AI 员工' : 'AI 服务'}</span></div>
            <h2 id="ai-control-center-title" className="mt-2 text-xl font-bold">{view === 'agents' ? '智能代理' : '模型管理'}</h2>
            {view === 'agents' && <p className="mt-2 max-w-3xl text-xs leading-5 text-neutral-400">
              管理 AI 员工和商家开通申请。员工开通前由平台审核；开通后也不会自动获得商家数据或操作权限。
            </p>}
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-emerald-400/20 bg-emerald-400/5 px-3 py-2 text-[11px] text-emerald-200">
            <ShieldCheck className="h-4 w-4" /> 平台目录 · 商家数据隔离
          </div>
        </div>
      </header>

      {view === 'agents' && <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {[
          { label: '员工总数', value: employees.length, icon: Bot },
          { label: '规划中', value: counts.planned, icon: Sparkles },
          { label: '内部试点', value: counts.pilot, icon: Rocket },
          { label: '商家可开通', value: counts.available, icon: Bot },
          { label: '已暂停', value: counts.paused, icon: CirclePause }
        ].map(item => {
          const Icon = item.icon;
          return <div key={item.label} className="rounded-xl border border-neutral-200 bg-white p-4">
            <div className="flex items-center justify-between text-xs text-neutral-500"><span>{item.label}</span><Icon className="h-4 w-4" /></div>
            <div className="mt-2 text-2xl font-bold text-neutral-950">{item.value}</div>
          </div>;
        })}
      </div>}

      {view === 'agents' && <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">
        <Activity className="mt-0.5 h-4 w-4 shrink-0" />
        <p>“商家可开通”表示商家可以申请启用该员工，不代表它可以自动处理业务。实际操作仍需单独授权。</p>
      </div>}

      {view === 'agents' && <AdminGrowthWorkerCenter />}

      {Object.entries(loadErrors).some(([, loadError]) => Boolean(loadError)) && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
        <div>
          <p className="font-semibold">部分 AI 管理数据读取失败；失败区块保留最近一次成功数据，首次加载失败时不会显示为空数据。</p>
          {Object.entries(loadErrors).filter(([, loadError]) => Boolean(loadError)).map(([section, loadError]) => (
            <p key={section} className="mt-1">{section === 'employees' ? '员工目录' : section === 'requests' ? '开通申请' : 'AI 服务配置'}：{loadError}</p>
          ))}
        </div>
        <button type="button" onClick={() => void loadEmployees()} disabled={loading || savingId !== null} className="rounded border border-amber-300 px-3 py-2 font-semibold hover:bg-amber-100 disabled:opacity-50">{loading ? '正在重试…' : '重试读取'}</button>
      </div>}
      {error && <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">{error}</div>}
      {notice && <div role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">{notice}</div>}

      {view === 'agents' && <section className="rounded-xl border border-neutral-200 bg-white p-4 sm:p-5" aria-labelledby="assistant-feedback-title">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 id="assistant-feedback-title" className="text-sm font-bold text-neutral-950">ModaUI 商家回答反馈</h3>
            <p className="mt-1 text-[11px] leading-5 text-neutral-500">最近 100 条赞/踩。仅供平台 AI 运营人员查看，包含反馈对应的问题与回答；请按最小必要范围访问。</p>
          </div>
          <button type="button" onClick={() => void loadAssistantFeedback()} disabled={feedbackLoading} className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 px-3 py-2 text-[11px] font-semibold text-neutral-700 disabled:opacity-50">
            <RefreshCw className={`h-3.5 w-3.5 ${feedbackLoading ? 'animate-spin' : ''}`} />刷新
          </button>
        </div>
        {feedbackError && <div role="alert" className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-800">
          <span>{feedbackError}{assistantFeedback.length ? '；当前保留最近一次成功读取的数据。' : ''}</span>
          {!assistantFeedback.length && <button type="button" onClick={() => void loadAssistantFeedback()} disabled={feedbackLoading} className="font-semibold underline disabled:opacity-50">重试</button>}
        </div>}
        {feedbackLoading ? <p role="status" className="mt-4 text-xs text-neutral-500">正在读取商家反馈…</p>
          : assistantFeedback.length === 0 ? <p className="mt-4 rounded-lg bg-neutral-50 p-4 text-xs text-neutral-500">{feedbackError ? '反馈数据暂不可用，不能视为暂无反馈。' : '目前没有已提交的 ModaUI 反馈。'}</p>
            : <div className="mt-4 space-y-3">
              {assistantFeedback.map(item => <article key={item.id} className="rounded-lg border border-neutral-200 p-3">
                <div className="flex flex-wrap items-center gap-2 text-[10px] text-neutral-500">
                  <span className={`rounded-full px-2 py-1 font-semibold ${item.feedback === 'up' ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-800'}`}>{item.feedback === 'up' ? '有帮助' : '没帮助'}</span>
                  <span>{item.merchantName}</span>
                  <span>· {item.conversationTitle}</span>
                  <span>· {item.context}</span>
                  {item.feedbackAt && <time dateTime={item.feedbackAt}>· {new Date(item.feedbackAt).toLocaleString()}</time>}
                </div>
                {item.feedbackPrompt && <p className="mt-2 whitespace-pre-wrap text-xs leading-5 text-neutral-600"><b className="text-neutral-800">商家问题：</b>{item.feedbackPrompt}</p>}
                <p className="mt-2 whitespace-pre-wrap text-xs leading-5 text-neutral-800"><b>AI 回答：</b>{item.content}</p>
              </article>)}
            </div>}
      </section>}

      {view === 'agents' && <section className="rounded-xl border border-neutral-200 bg-white p-4 sm:p-5" aria-labelledby="modagpt-queue-title">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 id="modagpt-queue-title" className="text-sm font-bold text-neutral-950">ModaUI 后台任务队列</h3>
            <p className="mt-1 text-[11px] leading-5 text-neutral-500">PostgreSQL 持久任务、租约恢复和死信重试。任务正文不会在此列表展示；状态每 30 秒刷新。</p>
          </div>
          <button type="button" onClick={() => void refreshModaGptQueue()} disabled={modaGptQueueLoading} className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 px-3 py-2 text-[11px] font-semibold text-neutral-700 disabled:opacity-50">
            <RefreshCw className={`h-3.5 w-3.5 ${modaGptQueueLoading ? 'animate-spin' : ''}`} />刷新队列
          </button>
        </div>
        {modaGptQueueError && <div role="alert" className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">{modaGptQueueError}</div>}
        {modaGptQueueNotice && <div role="status" className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">{modaGptQueueNotice}</div>}
        {modaGptTaskCounts && <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
          {[
            ['pending', '待处理'],
            ['processing', '执行中'],
            ['retry', '等待重试'],
            ['succeeded', '已完成'],
            ['dead_letter', '死信']
          ].map(([status, label]) => <div key={status} className="rounded-lg bg-neutral-50 px-3 py-2">
            <div className="text-[10px] text-neutral-500">{label}</div>
            <div className={`mt-1 text-lg font-bold ${status === 'dead_letter' && (modaGptTaskCounts[status] || 0) > 0 ? 'text-rose-700' : 'text-neutral-900'}`}>
              {modaGptTaskCounts[status] || 0}
            </div>
          </div>)}
        </div>}
        {modaGptQueueLoading && !modaGptTaskCounts ? <p role="status" className="mt-3 text-xs text-neutral-500">正在读取任务队列…</p>
          : modaGptTasks.length === 0 ? <p className="mt-3 rounded-lg bg-neutral-50 p-3 text-xs text-neutral-500">
            {modaGptQueueError ? '队列状态读取失败，不能视为暂无任务。' : '目前没有最近任务记录。'}
          </p>
            : <div className="mt-3 space-y-2">
              {modaGptTasks.map(task => <article key={task.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-neutral-200 px-3 py-2.5">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 text-[11px]">
                    <span className="font-semibold text-neutral-900">{task.taskType}</span>
                    <span className={`rounded-full px-2 py-0.5 font-semibold ${task.status === 'dead_letter' ? 'bg-rose-50 text-rose-800' : task.status === 'succeeded' ? 'bg-emerald-50 text-emerald-800' : 'bg-neutral-100 text-neutral-700'}`}>{task.status}</span>
                    <span className="font-mono text-neutral-400">{task.id}</span>
                  </div>
                  <div className="mt-1 text-[10px] text-neutral-500">
                    尝试 {task.attempts}/{task.maxAttempts} · {new Date(task.createdAt).toLocaleString()}
                    {task.lastErrorCode && <span className="ml-2 text-rose-700">错误码：{task.lastErrorCode}</span>}
                  </div>
                </div>
                {task.status === 'dead_letter' && <button
                  type="button"
                  onClick={() => void retryModaGptTask(task)}
                  disabled={retryingTaskId !== null}
                  className="rounded-lg border border-rose-200 px-3 py-1.5 text-[10px] font-semibold text-rose-800 hover:bg-rose-50 disabled:opacity-50"
                >
                  {retryingTaskId === task.id ? '重新排队中…' : '重试任务'}
                </button>}
              </article>)}
            </div>}
      </section>}

      {view === 'models' && <section className="rounded-xl border border-neutral-200 bg-white p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-neutral-950">AI 服务设置</h3>
            <p className="mt-1 text-[11px] leading-5 text-neutral-500">配置 ModaUI 的四家模型服务；商家端只显示 ModaUI。所有密钥 AES-GCM 加密保存在 RUDA 服务器，不会返回浏览器。</p>
          </div>
          <div className="flex gap-2">
            <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${providerSettings?.deepseekApiKeyConfigured ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800'}`}>
              DeepSeek {providerSettings ? providerSettings.deepseekApiKeyConfigured ? '已配置' : '未设置' : loading ? '检查中…' : '读取失败'}
            </span>
            <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${providerSettings?.falApiKeyConfigured ? 'bg-emerald-50 text-emerald-800' : 'bg-neutral-100 text-neutral-600'}`}>
              Fal {providerSettings ? providerSettings.falApiKeyConfigured ? '已配置' : '未设置' : loading ? '检查中…' : '读取失败'}
            </span>
            <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${providerSettings?.geminiApiKeyConfigured ? 'bg-emerald-50 text-emerald-800' : 'bg-neutral-100 text-neutral-600'}`}>
              Gemini {providerSettings ? providerSettings.geminiApiKeyConfigured ? '已配置' : '未设置' : loading ? '检查中…' : '读取失败'}
            </span>
            <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${providerSettings?.openaiApiKeyConfigured ? 'bg-emerald-50 text-emerald-800' : 'bg-neutral-100 text-neutral-600'}`}>
              OpenAI {providerSettings ? providerSettings.openaiApiKeyConfigured ? '已配置' : '未设置' : loading ? '检查中…' : '读取失败'}
            </span>
          </div>
        </div>
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] leading-5 text-amber-900">
          路由用途：DeepSeek 日常推理；OpenAI 多步骤 Agent 规划；Gemini 商品视觉识别；Fal 图片与换衣。启用云端服务后，相关提示词/附件会发送给所选供应商。连接测试会产生少量模型调用费用；Fal 测试会生成付费图片。
        </div>
        <div className="mt-3 rounded-lg border border-neutral-200 bg-neutral-50 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h4 className="text-xs font-bold text-neutral-800">模型线路熔断状态</h4>
              <p className="mt-1 text-[10px] leading-4 text-neutral-500">仅反映当前服务进程的线路状态；“关闭”不等于供应商健康检查通过，重启后状态会清空。</p>
            </div>
            <button
              type="button"
              onClick={() => void refreshProviderTelemetry()}
              disabled={telemetryLoading}
              className="rounded border border-neutral-300 bg-white px-2.5 py-1.5 text-[10px] font-semibold text-neutral-700 disabled:opacity-50"
            >
              {telemetryLoading ? '刷新中…' : '刷新状态'}
            </button>
          </div>
          <p className="mt-1 text-[10px] text-neutral-500">
            {telemetryUpdatedAt ? `最近更新：${new Date(telemetryUpdatedAt).toLocaleTimeString()}` : '正在读取最近线路状态…'}
            {' · 每 30 秒自动更新'}
          </p>
          {telemetryError && <p role="alert" className="mt-2 text-[11px] text-rose-800">{telemetryError} 自动刷新会继续重试。</p>}
          {providerCircuits === null ? (
            <p role="status" className="mt-2 text-[11px] text-amber-800">线路状态暂不可用；请检查 AI 服务配置接口并重试读取。</p>
          ) : Object.keys(providerCircuits).length === 0 ? (
            <p className="mt-2 text-[11px] text-neutral-500">当前进程暂无供应商调用记录；这不代表线路已通过连通性检查。</p>
          ) : (
            <div className="mt-2 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {Object.entries(providerCircuits).map(([key, circuit]) => {
                const open = circuit.state !== 'closed';
                const stateLabel = circuit.state === 'open'
                  ? `熔断中 · ${Math.ceil(circuit.retryAfterMs / 1000)} 秒后可探测`
                  : circuit.state === 'half_open' ? '半开 · 等待单次探测' : '关闭';
                return (
                  <div key={key} className={`rounded-md border px-2.5 py-2 text-[10px] ${open ? 'border-amber-200 bg-amber-50 text-amber-950' : 'border-neutral-200 bg-white text-neutral-700'}`}>
                    <div className="font-semibold">{getAiProviderCircuitLabel(key)}</div>
                    <div className="mt-1">{stateLabel}</div>
                    <div className="mt-0.5 opacity-75">连续可重试故障：{circuit.consecutiveFailures}</div>
                  </div>
                );
              })}
            </div>
          )}
          {inferenceMetrics === null ? (
            <p role="status" className="mt-2 text-[11px] text-amber-800">推理统计暂不可用；请刷新配置数据后重试。</p>
          ) : Object.keys(inferenceMetrics).length > 0 ? (
            <div className="mt-3 border-t border-neutral-200 pt-3">
              <h5 className="text-[11px] font-bold text-neutral-700">当前进程推理统计</h5>
              <div className="mt-2 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {Object.entries(inferenceMetrics).map(([key, metric]) => (
                  <div key={key} className="rounded-md border border-neutral-200 bg-white px-2.5 py-2 text-[10px] text-neutral-700">
                    <div className="font-semibold">{getAiProviderInferenceMetricLabel(key)}</div>
                    <div className="mt-1">
                      {metric.attempts} 次 · 失败 {metric.failures} 次 ({(metric.failureRate * 100).toFixed(1)}%)
                    </div>
                    <div className="mt-0.5 text-neutral-500">
                      平均 {metric.averageDurationMs} ms · 最近 {metric.lastDurationMs} ms · 最近一次{metric.lastSucceeded ? '成功' : '失败'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="mt-2 text-[10px] text-neutral-500">当前进程尚无已记录的推理任务。</p>
          )}
        </div>
        {providerSettings && <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {providerSettingsDirty && <div role="status" className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 lg:col-span-2">
            有未保存的服务商、模型或密钥更改。诊断和连通性测试只会检查服务器当前已保存配置；请先保存后再测试。
          </div>}
          <label className="block">
            <span className="text-[11px] font-semibold text-neutral-600">DeepSeek 服务密钥</span>
            <PasswordInput
              value={deepseekApiKey}
              autoComplete="new-password"
              disabled={savingId !== null}
              onChange={event => { setDeepseekApiKey(event.target.value); setClearDeepSeekApiKey(false); setProviderSettingsDirty(true); }}
              placeholder={providerSettings.deepseekApiKeyConfigured ? '已保存；留空即可保留' : '粘贴 DeepSeek 密钥'}
              className="mt-1.5 w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 pr-10 text-xs text-neutral-800 outline-none focus:border-neutral-500 disabled:opacity-60"
            />
          </label>
          <label className="flex items-center gap-2 self-end pb-2 text-[11px] text-neutral-600">
            <input
              type="checkbox"
              checked={clearDeepSeekApiKey}
              disabled={!providerSettings.deepseekApiKeyConfigured || savingId !== null || Boolean(deepseekApiKey) || providerSettings.reasoning.provider === 'deepseek'}
              onChange={event => { setClearDeepSeekApiKey(event.target.checked); setProviderSettingsDirty(true); }}
              className="rounded border-neutral-300"
            />
            删除已保存的 DeepSeek 密钥
          </label>
          <label className="block">
            <span className="text-[11px] font-semibold text-neutral-600">Fal 服务密钥</span>
            <PasswordInput
              value={falApiKey}
              autoComplete="new-password"
              disabled={savingId !== null}
              onChange={event => { setFalApiKey(event.target.value); setClearFalApiKey(false); setProviderSettingsDirty(true); }}
              placeholder={providerSettings.falApiKeyConfigured ? '已保存；留空即可保留' : '粘贴 Fal 密钥'}
              className="mt-1.5 w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 pr-10 text-xs text-neutral-800 outline-none focus:border-neutral-500 disabled:opacity-60"
            />
          </label>
          <label className="flex items-center gap-2 self-end pb-2 text-[11px] text-neutral-600">
            <input
              type="checkbox"
              checked={clearFalApiKey}
              disabled={!providerSettings.falApiKeyConfigured || savingId !== null || Boolean(falApiKey) || providerSettings.image.provider === 'fal'}
              onChange={event => { setClearFalApiKey(event.target.checked); setProviderSettingsDirty(true); }}
              className="rounded border-neutral-300"
            />
            删除已保存的 Fal 密钥
          </label>
          <label className="block">
            <span className="text-[11px] font-semibold text-neutral-600">OpenAI 服务密钥</span>
            <PasswordInput
              value={openaiApiKey}
              autoComplete="new-password"
              disabled={savingId !== null}
              onChange={event => { setOpenAiApiKey(event.target.value); setClearOpenAiApiKey(false); setProviderSettingsDirty(true); }}
              placeholder={providerSettings.openaiApiKeyConfigured ? '已保存；留空即可保留' : '粘贴 OpenAI API key'}
              className="mt-1.5 w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 pr-10 text-xs text-neutral-800 outline-none focus:border-neutral-500 disabled:opacity-60"
            />
          </label>
          <label className="flex items-center gap-2 self-end pb-2 text-[11px] text-neutral-600">
            <input
              type="checkbox"
              checked={clearOpenAiApiKey}
              disabled={!providerSettings.openaiApiKeyConfigured || savingId !== null || Boolean(openaiApiKey) || !providerSettings.advancedReasoning.fallbackToLocal}
              onChange={event => { setClearOpenAiApiKey(event.target.checked); setProviderSettingsDirty(true); }}
              className="rounded border-neutral-300"
            />
            删除已保存的 OpenAI 密钥
          </label>
          <label className="block">
            <span className="text-[11px] font-semibold text-neutral-600">Google Gemini API 密钥</span>
            <PasswordInput
              value={geminiApiKey}
              autoComplete="new-password"
              disabled={savingId !== null}
              onChange={event => { setGeminiApiKey(event.target.value); setClearGeminiApiKey(false); setProviderSettingsDirty(true); }}
              placeholder={providerSettings.geminiApiKeyConfigured ? '已保存；留空即可保留' : '粘贴 Google AI Studio API key'}
              className="mt-1.5 w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 pr-10 text-xs text-neutral-800 outline-none focus:border-neutral-500 disabled:opacity-60"
            />
          </label>
          <label className="flex items-center gap-2 self-end pb-2 text-[11px] text-neutral-600">
            <input
              type="checkbox"
              checked={clearGeminiApiKey}
              disabled={!providerSettings.geminiApiKeyConfigured || savingId !== null || Boolean(geminiApiKey) || providerSettings.vision.provider === 'gemini'}
              onChange={event => { setClearGeminiApiKey(event.target.checked); setProviderSettingsDirty(true); }}
              className="rounded border-neutral-300"
            />
            删除已保存的 Gemini 密钥
          </label>
          {([
            ['reasoning', '文字问答服务', 'deepseek-flash', 'ollama'],
            ['advancedReasoning', '复杂 Agent 规划', 'gpt-4.1-mini', 'ollama'],
            ['vision', '商品图片识别', 'llava:latest', 'ollama'],
            ['image', '图片生成服务', 'fal-ai/flux/schnell', 'automatic1111']
          ] as const).map(([role, label, falModelPlaceholder, localProvider]) => {
            const entry = providerSettings[role];
            return <div key={role} className="rounded-lg border border-neutral-200 p-3">
              <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
                <label className="block">
                  <span className="text-[10px] font-semibold text-neutral-600">{label}</span>
                  {role === 'reasoning'
                    ? <select
                      value={entry.provider}
                      disabled={savingId !== null}
                      onChange={event => updateProvider(role, {
                        provider: event.target.value as AiProviderMode,
                        model: event.target.value === 'deepseek' ? 'deepseek-flash' : 'qwen2.5:7b'
                      })}
                      className="mt-1 w-full rounded-lg border border-neutral-200 bg-white px-2.5 py-2 text-xs text-neutral-800 disabled:opacity-60"
                    >
                      <option value="deepseek">DeepSeek（云端）</option>
                      <option value="ollama">本地服务</option>
                    </select>
                    : role === 'advancedReasoning'
                      ? <div className="mt-1 rounded-lg border border-neutral-200 bg-neutral-50 px-2.5 py-2 text-xs text-neutral-700">OpenAI 复杂任务规划（未配置密钥时按策略回退到主力推理）</div>
                    : role === 'image'
                    ? <select
                      value={entry.provider}
                      disabled={savingId !== null}
                      onChange={event => updateProvider(role, { provider: event.target.value as AiProviderMode })}
                      className="mt-1 w-full rounded-lg border border-neutral-200 bg-white px-2.5 py-2 text-xs text-neutral-800 disabled:opacity-60"
                    >
                      <option value="fal">Fal（云端）</option>
                      <option value={localProvider}>本地服务</option>
                    </select>
                    : <select
                      value={entry.provider}
                      disabled={savingId !== null}
                      onChange={event => updateProvider(role, {
                        provider: event.target.value as AiProviderMode,
                        model: event.target.value === 'gemini' ? 'gemini-2.5-flash' : 'llava:latest'
                      })}
                      className="mt-1 w-full rounded-lg border border-neutral-200 bg-white px-2.5 py-2 text-xs text-neutral-800 disabled:opacity-60"
                    >
                      <option value="gemini">Gemini（云端视觉）</option>
                      <option value="ollama">本地 Ollama</option>
                    </select>}
                </label>
                <label className="block">
                  <span className="text-[10px] font-semibold text-neutral-600">{role === 'reasoning' ? '使用的模型' : '模型名称'}</span>
                  {role === 'reasoning' && entry.provider === 'deepseek'
                    ? <select
                      value={entry.model}
                      disabled={savingId !== null}
                      onChange={event => updateProvider(role, { model: event.target.value })}
                      className="mt-1 w-full rounded-lg border border-neutral-200 bg-white px-2.5 py-2 font-mono text-[11px] text-neutral-800 disabled:opacity-60"
                    >
                      <option value="deepseek-flash">deepseek-flash</option>
                      <option value="deepseek-v4-pro">deepseek-v4-pro</option>
                    </select>
                    : <input
                      value={entry.model}
                      maxLength={120}
                      disabled={savingId !== null}
                      onChange={event => updateProvider(role, { model: event.target.value })}
                      placeholder={falModelPlaceholder}
                      className="mt-1 w-full rounded-lg border border-neutral-200 bg-neutral-50 px-2.5 py-2 font-mono text-[11px] text-neutral-800 disabled:opacity-60"
                    />}
                </label>
              </div>
              {role === 'reasoning' && entry.provider === 'deepseek' && <label className="mt-2 flex items-center gap-2 text-[10px] text-neutral-600">
                <input
                  type="checkbox"
                  checked={entry.fallbackToLocal}
                  disabled={savingId !== null}
                  onChange={event => updateProvider(role, { fallbackToLocal: event.target.checked })}
                  className="rounded border-neutral-300"
                />
                DeepSeek 暂时不可用时，改用本地 qwen2.5:7b 模型
              </label>}
              {role === 'advancedReasoning' && <label className="mt-2 flex items-center gap-2 text-[10px] text-neutral-600">
                <input
                  type="checkbox"
                  checked={entry.fallbackToLocal}
                  disabled={savingId !== null || (!providerSettings.openaiApiKeyConfigured && !openaiApiKey.trim())}
                  onChange={event => updateProvider(role, { fallbackToLocal: event.target.checked })}
                  className="rounded border-neutral-300"
                />
                OpenAI 规划失败时回退到已配置的 DeepSeek/本地推理
              </label>}
              {role === 'vision' && entry.provider === 'gemini' && <label className="mt-2 flex items-center gap-2 text-[10px] text-neutral-600">
                <input
                  type="checkbox"
                  checked={entry.fallbackToLocal}
                  disabled={savingId !== null}
                  onChange={event => updateProvider(role, { fallbackToLocal: event.target.checked })}
                  className="rounded border-neutral-300"
                />
                Gemini 不可用时回退到本地 Ollama 视觉模型
              </label>}
              {role === 'image' && <label className="mt-2 flex items-center gap-2 text-[10px] text-neutral-600">
                <input
                  type="checkbox"
                  checked={entry.fallbackToLocal}
                  disabled={savingId !== null}
                  onChange={event => updateProvider(role, { fallbackToLocal: event.target.checked })}
                  className="rounded border-neutral-300"
                />
                Fal 暂时不可用时，改用本地图片生成
              </label>}
            </div>;
          })}
          <div className="flex items-end justify-end lg:col-span-2">
            <button
              type="button"
              onClick={() => void testLocalModels()}
              disabled={savingId !== null || providerSettingsDirty}
              className="mr-2 inline-flex items-center gap-2 rounded-lg border border-neutral-300 px-3.5 py-2 text-xs font-semibold text-neutral-800 hover:bg-neutral-50 disabled:opacity-50"
            >
              {savingId === 'local-model-test' ? '检查中…' : '诊断本地模型'}
            </button>
            <button
              type="button"
              onClick={() => void testDeepSeekConnection()}
              disabled={savingId !== null || providerSettingsDirty || !providerSettings.deepseekApiKeyConfigured || providerSettings.reasoning.provider !== 'deepseek'}
              className="mr-2 inline-flex items-center gap-2 rounded-lg border border-neutral-300 px-3.5 py-2 text-xs font-semibold text-neutral-800 hover:bg-neutral-50 disabled:opacity-50"
            >
              {savingId === 'deepseek-test' ? '测试中…' : '测试 DeepSeek 连接'}
            </button>
            <button
              type="button"
              onClick={() => {
                if (window.confirm('OpenAI 连接测试会使用已保存模型发起一次短文本请求，可能产生少量 API 费用。是否继续？')) void testOpenAiConnection();
              }}
              disabled={savingId !== null || providerSettingsDirty || !providerSettings.openaiApiKeyConfigured}
              className="mr-2 inline-flex items-center gap-2 rounded-lg border border-neutral-300 px-3.5 py-2 text-xs font-semibold text-neutral-800 hover:bg-neutral-50 disabled:opacity-50"
            >
              {savingId === 'openai-test' ? '测试中…' : '测试 OpenAI'}
            </button>
            <button
              type="button"
              onClick={() => {
                if (window.confirm('Gemini 视觉测试会发送合成的 1 像素图片和短提示词，可能产生少量 API 费用；不会发送商家资料。是否继续？')) void testGeminiConnection();
              }}
              disabled={savingId !== null || providerSettingsDirty || !providerSettings.geminiApiKeyConfigured || providerSettings.vision.provider !== 'gemini'}
              className="mr-2 inline-flex items-center gap-2 rounded-lg border border-neutral-300 px-3.5 py-2 text-xs font-semibold text-neutral-800 hover:bg-neutral-50 disabled:opacity-50"
            >
              {savingId === 'gemini-test' ? '测试中…' : '测试 Gemini 视觉'}
            </button>
            <button
              type="button"
              onClick={() => {
                if (window.confirm('Fal 测试会实际调用图片生成服务，可能产生服务费用；生成图片仅用于连通性验证，不会保存。是否继续？')) void testFalConnection();
              }}
              disabled={savingId !== null || providerSettingsDirty || !providerSettings.falApiKeyConfigured || providerSettings.image.provider !== 'fal'}
              className="mr-2 inline-flex items-center gap-2 rounded-lg border border-neutral-300 px-3.5 py-2 text-xs font-semibold text-neutral-800 hover:bg-neutral-50 disabled:opacity-50"
            >
              {savingId === 'fal-test' ? '付费生成测试中…' : '付费测试 Fal 生成'}
            </button>
            <button
              type="button"
              onClick={() => void saveProviderSettings()}
              disabled={savingId !== null}
              className="inline-flex items-center gap-2 rounded-lg bg-neutral-950 px-3.5 py-2 text-xs font-semibold text-white hover:bg-neutral-800 disabled:opacity-50"
            >
              <Save className="h-3.5 w-3.5" />{savingId === 'ai-provider-settings' ? '保存中…' : '保存设置'}
            </button>
          </div>
          {localModelDiagnostics && (
            <div role="status" className="grid gap-2 sm:grid-cols-2 lg:col-span-2">
              {([
                ['reasoning', '文字服务本地模型'],
                ['vision', '图片识别本地模型']
              ] as const).map(([key, label]) => {
                const status = localModelDiagnostics[key];
                const ready = status.reachable && status.modelInstalled && status.inferenceSucceeded;
                const required = key === 'vision'
                  ? status.provider === 'ollama' || status.fallbackToLocal
                  : status.provider !== 'deepseek' || status.fallbackToLocal;
                const metricKey = key === 'reasoning' ? 'probe:reasoning:ollama' : 'probe:vision:ollama';
                const metric = localModelDiagnostics.inferenceMetrics[metricKey];
                return (
                  <div key={key} className={`rounded-lg border px-3 py-2 text-[11px] ${ready ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : required ? 'border-amber-200 bg-amber-50 text-amber-950' : 'border-neutral-200 bg-neutral-50 text-neutral-700'}`}>
                    <div className="font-semibold">
                      {label}{key === 'reasoning' && status.provider === 'deepseek' ? status.fallbackToLocal ? '（DeepSeek 本地回退，必需）' : '（当前未启用，非阻断项）' : ''} · {status.model}
                    </div>
                    <div className="mt-1">
                      {!status.reachable
                        ? required ? 'Ollama 服务不可达，请检查服务是否启动及服务器本地配置。' : `Ollama 服务不可达；当前未启用本地回退，不影响 ${key === 'reasoning' ? 'DeepSeek' : 'Gemini'} 云端推理。`
                        : !status.modelInstalled
                          ? required ? 'Ollama 已连接，但该模型未安装。' : `本地回退模型未安装；当前未启用本地回退，不影响 ${key === 'reasoning' ? 'DeepSeek' : 'Gemini'} 云端推理。`
                          : !status.inferenceSucceeded
                            ? required ? `模型实际推理失败（${status.inferenceErrorCode || 'UNKNOWN'}）。` : `本地推理检查失败（${status.inferenceErrorCode || 'UNKNOWN'}）；当前未启用本地回退，不影响 ${key === 'reasoning' ? 'DeepSeek' : 'Gemini'} 云端推理。`
                            : `真实推理成功，耗时 ${status.inferenceDurationMs ?? '—'} ms${status.provider === 'deepseek'
                            ? (status.fallbackToLocal ? '（云端不可用时可回退使用）' : '（本地回退尚未启用）')
                            : ''}。`}
                    </div>
                    {metric && (
                      <div className="mt-1 text-[10px] opacity-80">
                        进程累计自检 {metric.attempts} 次 · 失败率 {(metric.failureRate * 100).toFixed(1)}% · 平均 {metric.averageDurationMs} ms
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>}
      </section>}

      {view === 'agents' && <>
      <section className="rounded-xl border border-neutral-200 bg-white p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-neutral-950">商家员工开通申请</h3>
            <p className="mt-1 text-[11px] text-neutral-500">仅批准已发布为“商家可开通”的岗位；批准仅启用员工，不会自动授予业务数据权限。</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-800">{requests.length}</span>
            <button
              type="button"
              onClick={() => void loadEmployees()}
              disabled={loading || savingId !== null}
              className="inline-flex items-center gap-1 rounded-lg border border-neutral-200 px-2.5 py-1.5 text-[10px] font-semibold text-neutral-700 disabled:opacity-50"
            >
              <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
              刷新
            </button>
          </div>
        </div>
        {requests.length === 0 ? (
          loading ? <p role="status" className="mt-3 rounded-lg bg-neutral-50 p-3 text-xs text-neutral-500">正在读取开通申请…</p>
            : loadErrors.requests ? <p className="mt-3 rounded-lg bg-neutral-50 p-3 text-xs text-neutral-500">申请列表暂不可用，请重试读取。</p>
              : <p className="mt-3 rounded-lg bg-neutral-50 p-3 text-xs text-neutral-500">当前没有待处理申请。</p>
        ) : (
          <ul className="mt-3 divide-y divide-neutral-100">
            {requests.map(request => (
              <li key={request.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <p className="text-xs font-semibold text-neutral-900">{request.definition.name} · {request.merchant.name}</p>
                  <p className="mt-1 text-[10px] text-neutral-500">{request.merchant.storeSlug} · {request.definition.department} · 岗位状态：{statusLabels[request.definition.status]}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={savingId !== null || request.definition.status !== 'available'}
                    onClick={() => void decideRequest(request, 'approve')}
                    className="rounded-lg bg-emerald-700 px-3 py-2 text-[10px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
                    title={request.definition.status !== 'available' ? '请先将该员工发布为商家可开通' : undefined}
                  >
                    批准开通
                  </button>
                  <button
                    type="button"
                    disabled={savingId !== null}
                    onClick={() => void decideRequest(request, 'decline')}
                    className="rounded-lg border border-neutral-200 px-3 py-2 text-[10px] font-semibold text-neutral-700 disabled:opacity-40"
                  >
                    拒绝
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {loading && employees.length === 0 ? <div role="status" className="rounded-xl border border-neutral-200 bg-white p-8 text-center text-sm text-neutral-500">正在读取 AI 员工目录…</div>
        : loadErrors.employees && employees.length === 0 ? <div className="rounded-xl border border-neutral-200 bg-white p-8 text-center text-sm text-neutral-500">AI 员工目录暂不可用，请重试读取。</div>
        : employees.length === 0 ? <div className="rounded-xl border border-neutral-200 bg-white p-8 text-center text-sm text-neutral-500">目录中暂无员工定义。请先部署数据库迁移。</div>
          : <div className="grid gap-4 xl:grid-cols-2">
            {employees.map(employee => {
              const draft = drafts[employee.id];
              const descriptionInvalid = Boolean(draft && (!draft.description.trim() || draft.description.length > 2000));
              const versionInvalid = Boolean(draft && (draft.version.length > 32 || !/^\d+\.\d+\.\d+(?:-[a-zA-Z0-9.-]+)?$/.test(draft.version)));
              const changed = Boolean(draft && (
                draft.description !== employee.description
                || draft.version !== employee.version
                || draft.status !== employee.status
              ));
              return <article key={employee.id} className="rounded-xl border border-neutral-200 bg-white p-5 shadow-xs">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-bold text-neutral-950">{employee.name}</h3>
                      <span className="rounded-full bg-neutral-100 px-2 py-1 text-[10px] font-semibold text-neutral-600">{employee.department}</span>
                      <span className="rounded-full bg-emerald-50 px-2 py-1 font-mono text-[10px] text-emerald-800">{employee.slug}</span>
                    </div>
                  </div>
                  <span className="shrink-0 rounded-full border border-neutral-200 px-2 py-1 text-[10px] font-semibold text-neutral-600">{statusLabels[employee.status]}</span>
                </div>

                {draft && <div className="mt-4 space-y-3">
                  <label className="block">
                    <span className="text-[11px] font-semibold text-neutral-600">岗位说明</span>
                    <textarea value={draft.description} maxLength={2000} rows={3} disabled={savingId !== null} onChange={event => updateDraft(employee.id, { description: event.target.value })} className="mt-1.5 w-full rounded-lg border border-neutral-200 bg-neutral-50 p-2.5 text-xs leading-5 text-neutral-800 outline-none focus:border-neutral-500 disabled:opacity-60" />
                    {descriptionInvalid && <span className="mt-1 block text-[10px] text-rose-700">岗位说明必填，且不能超过 2000 个字符。</span>}
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <label className="block">
                      <span className="text-[11px] font-semibold text-neutral-600">开通状态</span>
                      <select value={draft.status} disabled={savingId !== null} onChange={event => updateDraft(employee.id, { status: event.target.value as AiEmployeeStatus })} className="mt-1.5 w-full rounded-lg border border-neutral-200 bg-white px-2.5 py-2 text-xs text-neutral-800 disabled:opacity-60">
                        {Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                      </select>
                    </label>
                    <label className="block">
                      <span className="text-[11px] font-semibold text-neutral-600">版本号</span>
                      <input value={draft.version} maxLength={32} disabled={savingId !== null} onChange={event => updateDraft(employee.id, { version: event.target.value })} className="mt-1.5 w-full rounded-lg border border-neutral-200 bg-white px-2.5 py-2 text-xs font-mono text-neutral-800 disabled:opacity-60" />
                      {versionInvalid && <span className="mt-1 block text-[10px] text-rose-700">版本号格式应为 x.y.z，可选添加 -beta 等预发布标记。</span>}
                    </label>
                  </div>
                  <div className="border-t border-neutral-100 pt-3">
                    <div className="text-[11px] font-semibold text-neutral-600">可提供的帮助</div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {parseList(employee.capabilities).map(capability => <span key={capability} className="rounded-full bg-slate-100 px-2 py-1 text-[10px] text-slate-700">{capability}</span>)}
                    </div>
                    <div className="mt-2 text-[10px] text-neutral-400">可执行的操作：{parseList(employee.requiredPermissions).length ? parseList(employee.requiredPermissions).join('、') : '尚未授权具体操作'}</div>
                  </div>
                  <div className="flex justify-end">
                    <button type="button" onClick={() => void saveEmployee(employee)} disabled={!changed || descriptionInvalid || versionInvalid || savingId !== null} className="inline-flex items-center gap-2 rounded-lg bg-neutral-950 px-3.5 py-2 text-xs font-semibold text-white hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-40">
                      <Save className="h-3.5 w-3.5" />{savingId === employee.id ? '保存中…' : '保存员工信息'}
                    </button>
                  </div>
                </div>}
              </article>;
            })}
          </div>}
      </>}
    </section>
  );
};

type AdminAiControlCenterBoundaryState = {
  hasError: boolean;
};

class AdminAiControlCenterBoundary extends React.Component<
  React.PropsWithChildren,
  AdminAiControlCenterBoundaryState
> {
  state: AdminAiControlCenterBoundaryState = { hasError: false };

  static getDerivedStateFromError(): AdminAiControlCenterBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('[admin-ai-control-center-render] failed:', error, info.componentStack);
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <section role="alert" className="rounded-xl border border-rose-200 bg-white p-6">
        <h2 className="text-sm font-bold text-rose-900">智能员工后台暂时无法显示</h2>
        <p className="mt-2 text-xs leading-5 text-neutral-600">
          此版块发生了页面错误，其他总后台功能仍可继续使用。可重试加载；如果问题持续，请联系 RUDA 客服并告知该版块名称。
        </p>
        <button
          type="button"
          onClick={() => this.setState({ hasError: false })}
          className="mt-4 rounded-lg bg-neutral-950 px-3.5 py-2 text-xs font-semibold text-white hover:bg-neutral-800"
        >
          重试智能员工版块
        </button>
      </section>
    );
  }
}

export const AdminAiControlCenter: React.FC<{ view?: AdminAiControlCenterView }> = ({ view = 'agents' }) => (
  <AdminAiControlCenterBoundary>
    <AdminAiControlCenterContent view={view} />
  </AdminAiControlCenterBoundary>
);
