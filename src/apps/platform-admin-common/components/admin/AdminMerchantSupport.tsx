import { getIntlLocale } from '../../../../i18n/translations';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { BookOpen, Bot, Headphones, Plus, RefreshCw, Save, Send, Trash2 } from 'lucide-react';
import { apiDelete, apiGet, apiPost, apiPut } from '../../../../api/client';
import { useB2B } from '../../../../context/B2BContext';
import { getMerchantSupportSlaState, type MerchantSupportPriority } from '../../../../server/merchantSupportOperations';
import { AdminPageHeader } from './AdminPageHeader';
import {
  merchantSupportKnowledgeCategories,
  type MerchantSupportKnowledgeArticle,
  type MerchantSupportKnowledgeCategory
} from '../../../../server/merchantSupportKnowledge';

type SupportStatus = 'open' | 'in_progress' | 'resolved';
type SupportMessage = {
  id: string;
  senderRole: 'merchant' | 'admin' | 'ai';
  senderName: string;
  content: string;
  isRead: boolean;
  feedback?: 'helpful' | 'not_helpful' | null;
  createdAt: string;
};
type SupportConversation = {
  id: string;
  merchantId: string;
  subject: string;
  status: SupportStatus;
  lastMessageAt: string;
  lastMessagePreview: string | null;
  unreadCount: number;
  priority: MerchantSupportPriority;
  assignedAdminUsername: string | null;
  firstResponseDueAt: string | null;
  firstRespondedAt: string | null;
  resolvedAt: string | null;
  resolvedByAi: boolean;
  aiHandoffReason: string | null;
  merchant: {
    id: string;
    name: string;
    contactEmail: string;
    companyLegalName?: string;
    code?: string;
    country_zh?: string | null;
    city_zh?: string | null;
    merchantZone?: string;
    isVerified?: boolean;
  };
  messages?: SupportMessage[];
};
type SupportAgent = { username: string; name: string };
type StorefrontAgentMerchant = {
  id: string;
  name: string;
  companyLegalName: string;
  contactEmail: string;
  storefrontAiEnabled: boolean;
  storefrontAiActivatedAt: string | null;
  storefrontAiActivatedBy: string | null;
};
type SupportOpsMetrics = {
  open: number;
  inProgress: number;
  resolved: number;
  overdue: number;
  resolvedLast30Days: number;
  aiResolvedLast30Days: number;
  firstResponsesLast30Days: number;
  averageFirstResponseMinutes: number | null;
  firstResponseSlaCompliancePercent: number | null;
  aiFeedbackLast30Days: { helpful: number; notHelpful: number };
  aiHelpfulPercent: number | null;
};
type MerchantSupportSlaMinutes = Record<MerchantSupportPriority, number>;
type MerchantSupportAiConfig = {
  enabled: boolean;
  autoReplyEnabled: boolean;
  model: 'qwen2.5:7b' | 'llama3.2:latest';
  instructions: string;
};
type MerchantSupportAiStatus = {
  reachable: boolean;
  modelInstalled: boolean;
  embeddingModelInstalled: boolean;
  model: string;
};

const statusLabels: Record<SupportStatus, string> = {
  open: '待处理',
  in_progress: '处理中',
  resolved: '已完成'
};
const priorityLabels: Record<MerchantSupportPriority, string> = {
  urgent: '紧急',
  high: '高',
  normal: '普通'
};

function formatResponseDuration(minutes: number | null): string {
  if (minutes === null) return '暂无数据';
  if (minutes < 60) return `${minutes} 分钟`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes ? `${hours} 小时 ${remainingMinutes} 分钟` : `${hours} 小时`;
}

function knowledgeCategoryLabel(category: MerchantSupportKnowledgeCategory): string {
  return merchantSupportKnowledgeCategories.find(item => item.id === category)?.label || category;
}

type AdminMerchantSupportProps = {
  mode?: 'operations' | 'settings';
};

export const AdminMerchantSupport: React.FC<AdminMerchantSupportProps> = ({ mode = 'operations' }) => {
  const { addNotification, lang } = useB2B();
  const [conversations, setConversations] = useState<SupportConversation[]>([]);
  const [activeConversation, setActiveConversation] = useState<SupportConversation | null>(null);
  const [filter, setFilter] = useState<'all' | SupportStatus>('all');
  const [assignedFilter, setAssignedFilter] = useState<'all' | 'mine' | 'unassigned'>('all');
  const [priorityFilter, setPriorityFilter] = useState<'all' | MerchantSupportPriority>('all');
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [negativeFeedbackOnly, setNegativeFeedbackOnly] = useState(false);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [savingStatus, setSavingStatus] = useState(false);
  const [clearingMerchantMemory, setClearingMerchantMemory] = useState(false);
  const [error, setError] = useState('');
  const [aiConfig, setAiConfig] = useState<MerchantSupportAiConfig>({
    enabled: true,
    autoReplyEnabled: true,
    model: 'qwen2.5:7b',
    instructions: ''
  });
  const [aiStatus, setAiStatus] = useState<MerchantSupportAiStatus>({
    reachable: false,
    modelInstalled: false,
    embeddingModelInstalled: false,
    model: 'qwen2.5:7b'
  });
  const [loadingAiSettings, setLoadingAiSettings] = useState(true);
  const [aiSettingsError, setAiSettingsError] = useState('');
  const [aiSettingsSaveError, setAiSettingsSaveError] = useState('');
  const [savingAiConfig, setSavingAiConfig] = useState(false);
  const [testingAi, setTestingAi] = useState(false);
  const [aiTestResult, setAiTestResult] = useState('');
  const [opsMetrics, setOpsMetrics] = useState<SupportOpsMetrics | null>(null);
  const [supportAgents, setSupportAgents] = useState<SupportAgent[]>([]);
  const [slaMinutes, setSlaMinutes] = useState<MerchantSupportSlaMinutes>({ urgent: 60, high: 240, normal: 1440 });
  const [savingTriage, setSavingTriage] = useState(false);
  const [builtInKnowledge, setBuiltInKnowledge] = useState<MerchantSupportKnowledgeArticle[]>([]);
  const [customKnowledge, setCustomKnowledge] = useState<MerchantSupportKnowledgeArticle[]>([]);
  const [loadingKnowledge, setLoadingKnowledge] = useState(true);
  const [knowledgeError, setKnowledgeError] = useState('');
  const [knowledgeDraft, setKnowledgeDraft] = useState<MerchantSupportKnowledgeArticle | null>(null);
  const [knowledgeFilter, setKnowledgeFilter] = useState<'all' | MerchantSupportKnowledgeCategory>('all');
  const [savingKnowledge, setSavingKnowledge] = useState(false);
  const [knowledgeSaveError, setKnowledgeSaveError] = useState('');
  const [knowledgeRetryArticles, setKnowledgeRetryArticles] = useState<MerchantSupportKnowledgeArticle[] | null>(null);
  const [storefrontAgentMerchants, setStorefrontAgentMerchants] = useState<StorefrontAgentMerchant[]>([]);
  const [storefrontAgentSearch, setStorefrontAgentSearch] = useState('');
  const [loadingStorefrontAgents, setLoadingStorefrontAgents] = useState(true);
  const [updatingStorefrontAgentId, setUpdatingStorefrontAgentId] = useState<string | null>(null);

  const loadAiSettings = useCallback(async () => {
    setLoadingAiSettings(true);
    setAiSettingsError('');
    try {
      const result = await apiGet<{ config: MerchantSupportAiConfig; status: MerchantSupportAiStatus; merchantSupportSlaMinutes: MerchantSupportSlaMinutes }>('/api/admin/merchant-support/ai-config');
      setAiConfig(result.config);
      setAiStatus(result.status);
      setSlaMinutes(result.merchantSupportSlaMinutes);
    } catch (cause) {
      setAiSettingsError(cause instanceof Error ? cause.message : '读取 AI 客服设置失败');
    } finally {
      setLoadingAiSettings(false);
    }
  }, []);

  const loadKnowledge = useCallback(async () => {
    setLoadingKnowledge(true);
    setKnowledgeError('');
    try {
      const result = await apiGet<{ builtInArticles: MerchantSupportKnowledgeArticle[]; customArticles: MerchantSupportKnowledgeArticle[] }>('/api/admin/merchant-support/knowledge');
      setBuiltInKnowledge(result.builtInArticles);
      setCustomKnowledge(result.customArticles);
    } catch (cause) {
      setKnowledgeError(cause instanceof Error ? cause.message : '读取客服知识库失败');
    } finally {
      setLoadingKnowledge(false);
    }
  }, []);

  useEffect(() => {
    if (mode === 'settings') {
      void loadAiSettings();
      void loadKnowledge();
      return;
    }
    const loadOps = async () => {
      try {
        const result = await apiGet<{ metrics: SupportOpsMetrics; agents: SupportAgent[]; firstResponseSlaMinutes: MerchantSupportSlaMinutes }>('/api/admin/merchant-support/ops');
        setOpsMetrics(result.metrics);
        setSupportAgents(result.agents);
        return true;
      } catch (cause) {
        const message = cause instanceof Error ? cause.message : '读取客服运营指标失败';
        setError(message);
        return false;
      }
    };
    let cancelled = false;
    let timer: number | undefined;
    let retryDelay = 30_000;
    const schedule = (delay: number) => {
      if (timer !== undefined) window.clearTimeout(timer);
      timer = window.setTimeout(() => void pollOps(), delay);
    };
    const pollOps = async () => {
      if (cancelled || document.hidden) return;
      if (await loadOps()) retryDelay = 30_000;
      else retryDelay = Math.min(retryDelay * 2, 300_000);
      if (!cancelled && !document.hidden) schedule(retryDelay);
    };
    const onVisibilityChange = () => {
      if (document.hidden) {
        if (timer !== undefined) window.clearTimeout(timer);
        timer = undefined;
      } else {
        void pollOps();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    void pollOps();
    return () => {
      cancelled = true;
      if (timer !== undefined) window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [loadAiSettings, loadKnowledge, mode]);

  useEffect(() => {
    if (mode !== 'operations') return;
    void apiGet<{ merchants: StorefrontAgentMerchant[] }>('/api/admin/merchant-support/storefront-agents')
      .then(result => setStorefrontAgentMerchants(result.merchants))
      .catch(cause => {
        const message = cause instanceof Error ? cause.message : '读取商户智能体开通状态失败';
        setError(message);
        addNotification('warning', '商户智能体列表加载失败', message);
      })
      .finally(() => setLoadingStorefrontAgents(false));
  }, [addNotification, mode]);

  const loadConversations = useCallback(async (quiet = false) => {
    try {
      const params = new URLSearchParams();
      if (filter !== 'all') params.set('status', filter);
      if (assignedFilter !== 'all') params.set('assignedTo', assignedFilter);
      if (priorityFilter !== 'all') params.set('priority', priorityFilter);
      if (overdueOnly) params.set('overdue', 'true');
      if (negativeFeedbackOnly) params.set('aiFeedback', 'not_helpful');
      const query = params.toString();
      const result = await apiGet<{ conversations: SupportConversation[] }>(`/api/admin/merchant-support/conversations${query ? `?${query}` : ''}`);
      setConversations(result.conversations);
      setError('');
      return true;
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : '读取商家客服会话失败';
      setError(message);
      if (!quiet) addNotification('warning', '商家客服列表加载失败', message);
      return false;
    } finally {
      setLoading(false);
    }
  }, [addNotification, assignedFilter, filter, negativeFeedbackOnly, overdueOnly, priorityFilter]);

  const loadConversation = useCallback(async (id: string, quiet = false) => {
    try {
      const result = await apiGet<{ conversation: SupportConversation }>(`/api/admin/merchant-support/conversations/${encodeURIComponent(id)}`);
      setActiveConversation(result.conversation);
      setConversations(current => current.map(item => item.id === id ? { ...item, unreadCount: 0 } : item));
      return true;
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : '读取会话失败';
      setError(message);
      if (!quiet) {
        addNotification('warning', '会话读取失败', message);
      }
      return false;
    }
  }, [addNotification]);

  useEffect(() => {
    if (mode !== 'operations') return;
    setLoading(true);
    let cancelled = false;
    let timer: number | undefined;
    let retryDelay = 5000;
    const schedule = (delay: number) => {
      if (timer !== undefined) window.clearTimeout(timer);
      timer = window.setTimeout(() => void poll(), delay);
    };
    const poll = async () => {
      if (cancelled || document.hidden) return;
      if (await loadConversations(true)) retryDelay = 5000;
      else retryDelay = Math.min(retryDelay * 2, 60_000);
      if (!cancelled && !document.hidden) schedule(retryDelay);
    };
    const onVisibilityChange = () => {
      if (document.hidden) {
        if (timer !== undefined) window.clearTimeout(timer);
        timer = undefined;
      } else {
        void poll();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    void poll();
    return () => {
      cancelled = true;
      if (timer !== undefined) window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [loadConversations, mode]);

  useEffect(() => {
    if (mode !== 'operations' || !activeConversation?.id) return;
    let cancelled = false;
    let timer: number | undefined;
    let retryDelay = 5000;
    const schedule = (delay: number) => {
      if (timer !== undefined) window.clearTimeout(timer);
      timer = window.setTimeout(() => void poll(), delay);
    };
    const poll = async () => {
      if (cancelled || document.hidden) return;
      if (await loadConversation(activeConversation.id, true)) retryDelay = 5000;
      else retryDelay = Math.min(retryDelay * 2, 60_000);
      if (!cancelled && !document.hidden) schedule(retryDelay);
    };
    const onVisibilityChange = () => {
      if (document.hidden) {
        if (timer !== undefined) window.clearTimeout(timer);
        timer = undefined;
      } else {
        void poll();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    void poll();
    return () => {
      cancelled = true;
      if (timer !== undefined) window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [activeConversation?.id, loadConversation, mode]);

  const sortedConversations = useMemo(
    () => [...conversations].sort((left, right) => right.lastMessageAt.localeCompare(left.lastMessageAt)),
    [conversations]
  );
  const updateTriage = async (conversationId: string, update: { priority?: MerchantSupportPriority; assignedAdminUsername?: string | null }) => {
    if (savingTriage) return;
    setSavingTriage(true);
    try {
      const result = await apiPut<{ conversation: SupportConversation }>(
        `/api/admin/merchant-support/conversations/${encodeURIComponent(conversationId)}/triage`,
        update
      );
      setActiveConversation(current => current?.id === conversationId ? { ...current, ...result.conversation } : current);
      setConversations(current => current.map(item => item.id === conversationId ? { ...item, ...result.conversation } : item));
      setError('');
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : '保存工单分配失败';
      setError(message);
      addNotification('warning', '工单分配或优先级未保存', message);
    } finally {
      setSavingTriage(false);
    }
  };

  const sendReply = async () => {
    if (!activeConversation || !draft.trim() || sending) return;
    setSending(true);
    try {
      const result = await apiPost<{ conversation: SupportConversation }>(
        `/api/admin/merchant-support/conversations/${encodeURIComponent(activeConversation.id)}/messages`,
        { content: draft.trim() }
      );
      setActiveConversation(result.conversation);
      setConversations(current => current.map(item => item.id === result.conversation.id
        ? { ...item, ...result.conversation, unreadCount: 0 }
        : item));
      setDraft('');
      setError('');
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : '发送回复失败';
      setError(message);
      addNotification('warning', '回复发送失败', message);
    } finally {
      setSending(false);
    }
  };

  const updateStatus = async (status: SupportStatus) => {
    if (!activeConversation || status === activeConversation.status || savingStatus) return;
    setSavingStatus(true);
    try {
      const result = await apiPut<{
        conversation: SupportConversation;
        memory: { saved: boolean; indexed: boolean };
      }>(`/api/admin/merchant-support/conversations/${encodeURIComponent(activeConversation.id)}/status`, { status });
      setActiveConversation(current => current ? { ...current, ...result.conversation } : current);
      setConversations(current => current.map(item => item.id === activeConversation.id ? { ...item, ...result.conversation } : item));
      if (status === 'resolved' && result.memory.saved) {
        addNotification('success', '已保存商家记忆', result.memory.indexed ? '问题摘要已保存，可用于后续客服答复。' : '问题摘要已保存，将在后续咨询时启用。');
      }
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : '更新会话状态失败';
      setError(message);
      addNotification('warning', '会话状态更新失败', message);
    } finally {
      setSavingStatus(false);
    }
  };

  const clearMerchantMemory = async () => {
    if (!activeConversation || clearingMerchantMemory) return;
    if (!window.confirm(`确定清除「${activeConversation.merchant.name}」的所有 AI 长期记忆吗？原始客服会话不会删除。`)) return;
    setClearingMerchantMemory(true);
    try {
      const result = await apiDelete<{ deletedCount: number }>(`/api/admin/merchant-support/memories/${encodeURIComponent(activeConversation.merchantId)}`);
      addNotification('success', '商家 AI 长期记忆已清除', `已清除 ${result.deletedCount} 条摘要。`);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : '清除商家 AI 长期记忆失败';
      setError(message);
      addNotification('warning', '清除 AI 长期记忆失败', message);
    } finally {
      setClearingMerchantMemory(false);
    }
  };

  const saveKnowledgeArticles = async (articles: MerchantSupportKnowledgeArticle[]) => {
    setSavingKnowledge(true);
    setKnowledgeSaveError('');
    setKnowledgeRetryArticles(articles);
    try {
      const result = await apiPut<{ customArticles: MerchantSupportKnowledgeArticle[] }>('/api/admin/merchant-support/knowledge', { articles });
      setCustomKnowledge(result.customArticles);
      setKnowledgeDraft(null);
      setKnowledgeError('');
      setKnowledgeSaveError('');
      setKnowledgeRetryArticles(null);
      addNotification('success', '客服知识库已保存', `当前维护 ${result.customArticles.length} 条企业专属知识。`);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : '保存客服知识库失败';
      setKnowledgeError(message);
      addNotification('warning', '客服知识库保存失败', message);
    } finally {
      setSavingKnowledge(false);
    }
  };

  const removeKnowledgeArticle = async (id: string) => {
    const article = customKnowledge.find(item => item.id === id);
    if (!article || !window.confirm(`确定删除知识条目「${article.title}」吗？`)) return;
    await saveKnowledgeArticles(customKnowledge.filter(item => item.id !== id));
  };

  const saveAiConfig = async () => {
    setSavingAiConfig(true);
    setAiTestResult('');
    setAiSettingsSaveError('');
    try {
      const result = await apiPut<{ config: MerchantSupportAiConfig; status: MerchantSupportAiStatus; merchantSupportSlaMinutes: MerchantSupportSlaMinutes }>(
        '/api/admin/merchant-support/ai-config',
        { ...aiConfig, merchantSupportSlaMinutes: slaMinutes }
      );
      setAiConfig(result.config);
      setAiStatus(result.status);
      setSlaMinutes(result.merchantSupportSlaMinutes);
      setAiSettingsSaveError('');
      addNotification('success', '商家 AI 客服设置已保存', '大模型自动回复设置已更新。');
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : '保存 AI 客服设置失败';
      setAiSettingsSaveError(message);
      addNotification('warning', 'AI 客服设置保存失败', message);
    } finally {
      setSavingAiConfig(false);
    }
  };

  const testAiConnection = async () => {
    setTestingAi(true);
    setAiTestResult('');
    try {
      const result = await apiPost<{ model: string }>('/api/admin/merchant-support/ai-test', {});
      setAiTestResult(`连接成功 · ${result.model}`);
      addNotification('success', '客服测试成功', `当前使用：${result.model}`);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : '本地模型连接测试失败';
      setAiTestResult(`连接失败 · ${message}`);
      addNotification('warning', '本地模型连接测试失败', message);
    } finally {
      setTestingAi(false);
    }
  };

  const setStorefrontAgentEnabled = async (merchant: StorefrontAgentMerchant, enabled: boolean) => {
    if (updatingStorefrontAgentId) return;
    setUpdatingStorefrontAgentId(merchant.id);
    try {
      const result = await apiPut<{ merchant: StorefrontAgentMerchant }>(
        `/api/admin/merchant-support/storefront-agents/${encodeURIComponent(merchant.id)}`,
        { enabled }
      );
      setStorefrontAgentMerchants(current => current.map(item => item.id === merchant.id ? result.merchant : item));
      addNotification('success', enabled ? '商户智能体已开通' : '商户智能体已停用', `${merchant.name} 的店铺客服已${enabled ? '开放' : '关闭'}`);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : '更新商户智能体开通状态失败';
      setError(message);
      addNotification('warning', '商户智能体开通状态未更新', message);
    } finally {
      setUpdatingStorefrontAgentId(null);
    }
  };

  const filteredStorefrontAgentMerchants = storefrontAgentMerchants.filter(merchant =>
    `${merchant.name} ${merchant.companyLegalName} ${merchant.contactEmail}`.toLocaleLowerCase().includes(storefrontAgentSearch.trim().toLocaleLowerCase())
  );

  return (
    <section className="space-y-4">
      <AdminPageHeader
        title={mode === 'settings' ? '客服设置' : '客服会话'}
        actions={mode === 'operations' ? <button type="button" onClick={() => void loadConversations()} className="inline-flex min-h-9 items-center gap-2 border border-neutral-300 bg-white px-3 text-xs font-semibold text-neutral-700">
          <RefreshCw className="h-3.5 w-3.5" />刷新
        </button> : undefined}
      />

      {mode === 'operations' && <>
      <section className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
        {[
          { label: '待处理', value: opsMetrics?.open ?? '—', style: 'text-neutral-700' },
          { label: '处理中', value: opsMetrics?.inProgress ?? '—', style: 'text-neutral-700' },
          { label: '回复超时', value: opsMetrics?.overdue ?? '—', style: 'text-neutral-900' },
          { label: '30 天按时回复', value: opsMetrics?.firstResponseSlaCompliancePercent == null ? '暂无数据' : `${opsMetrics.firstResponseSlaCompliancePercent}%`, style: 'text-neutral-700' },
          { label: '30 天平均首次人工响应', value: formatResponseDuration(opsMetrics?.averageFirstResponseMinutes ?? null), style: 'text-neutral-900' }
        ].map(metric => (
          <article key={metric.label} className="rounded-lg border border-neutral-200 bg-white px-3 py-3">
            <p className="text-[10px] font-medium text-neutral-500">{metric.label}</p>
            <p className={`mt-1 text-lg font-bold ${metric.style}`}>{metric.value}</p>
          </article>
        ))}
      </section>
      <section className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-lg border border-neutral-200 bg-white px-3 py-2.5 text-[10px] text-neutral-600">
        <span>30 天已解决：<strong className="text-neutral-900">{opsMetrics?.resolvedLast30Days ?? '—'}</strong></span>
        <span>其中 AI 自助解决：<strong className="text-neutral-700">{opsMetrics?.aiResolvedLast30Days ?? '—'}</strong></span>
        <span>AI 有帮助：<strong className="text-neutral-700">{opsMetrics?.aiFeedbackLast30Days.helpful ?? '—'}</strong></span>
        <span>AI 未解决：<strong className="text-neutral-900">{opsMetrics?.aiFeedbackLast30Days.notHelpful ?? '—'}</strong></span>
        <span>AI 有帮助率：<strong className="text-neutral-900">{opsMetrics?.aiHelpfulPercent == null ? '暂无反馈' : `${opsMetrics.aiHelpfulPercent}%`}</strong></span>
      </section>

      <section className="rounded-xl border border-neutral-200 bg-white p-4 shadow-xs sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="flex items-center gap-2 text-sm font-bold text-neutral-900"><Bot className="h-4 w-4" />商户店铺智能体客服 · 付费开通</h3>
            <p className="mt-1 max-w-3xl text-xs leading-5 text-neutral-600">收到商户付款并完成核实后，由总后台为该店铺开通；开通后，商家公开店铺显示专属 AI 客服入口。停用会立即隐藏入口并拒绝客服请求。</p>
          </div>
          <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-[10px] font-semibold text-neutral-600">{storefrontAgentMerchants.filter(merchant => merchant.storefrontAiEnabled).length} 家已开通</span>
        </div>
        <div className="mt-3">
          <input value={storefrontAgentSearch} onChange={event => setStorefrontAgentSearch(event.target.value)} placeholder="按店铺名、公司或邮箱筛选" className="min-h-9 w-full max-w-md border border-neutral-200 px-3 text-xs outline-none focus:border-neutral-800" />
        </div>
        <div className="mt-3 divide-y divide-neutral-100">
          {loadingStorefrontAgents && <p className="py-4 text-xs text-neutral-500">正在读取商户列表…</p>}
          {!loadingStorefrontAgents && filteredStorefrontAgentMerchants.slice(0, 100).map(merchant => (
            <div key={merchant.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold text-neutral-900">{merchant.name} <span className="font-normal text-neutral-500">· {merchant.companyLegalName}</span></p>
                <p className="mt-0.5 truncate text-[10px] text-neutral-500">{merchant.contactEmail}{merchant.storefrontAiEnabled && merchant.storefrontAiActivatedAt ? ` · ${new Date(merchant.storefrontAiActivatedAt).toLocaleDateString()} 开通` : ''}</p>
              </div>
              <button type="button" disabled={updatingStorefrontAgentId !== null} onClick={() => void setStorefrontAgentEnabled(merchant, !merchant.storefrontAiEnabled)} className={`min-h-9 min-w-24 px-3 text-xs font-semibold disabled:opacity-50 ${merchant.storefrontAiEnabled ? 'border border-neutral-300 bg-neutral-100 text-neutral-700' : 'bg-neutral-950 text-white'}`}>
                {updatingStorefrontAgentId === merchant.id ? '更新中…' : merchant.storefrontAiEnabled ? '停用服务' : '确认收款并开通'}
              </button>
            </div>
          ))}
          {!loadingStorefrontAgents && filteredStorefrontAgentMerchants.length === 0 && <p className="py-4 text-xs text-neutral-500">没有匹配的商户。</p>}
          {!loadingStorefrontAgents && filteredStorefrontAgentMerchants.length > 100 && <p className="py-2 text-[10px] text-neutral-500">仅显示前 100 家匹配商户，请继续输入缩小范围。</p>}
        </div>
      </section>

      <div className="flex flex-wrap gap-2" role="group" aria-label="筛选商家客服会话">
        {(['all', 'open', 'in_progress', 'resolved'] as const).map(value => (
          <button key={value} type="button" aria-pressed={filter === value} onClick={() => setFilter(value)} className={`min-h-9 border px-3 text-xs font-semibold ${filter === value ? 'border-neutral-950 bg-neutral-950 text-white' : 'border-neutral-200 bg-white text-neutral-600'}`}>
            {value === 'all' ? '全部会话' : statusLabels[value]}
          </button>
        ))}
        <select aria-label="按客服负责人筛选" value={assignedFilter} onChange={event => setAssignedFilter(event.target.value as typeof assignedFilter)} className="min-h-9 border border-neutral-200 bg-white px-3 text-xs font-semibold text-neutral-700">
          <option value="all">所有负责人</option>
          <option value="mine">我的工单</option>
          <option value="unassigned">未分配</option>
        </select>
        <select aria-label="按优先级筛选" value={priorityFilter} onChange={event => setPriorityFilter(event.target.value as typeof priorityFilter)} className="min-h-9 border border-neutral-200 bg-white px-3 text-xs font-semibold text-neutral-700">
          <option value="all">所有优先级</option>
          <option value="urgent">紧急</option>
          <option value="high">高</option>
          <option value="normal">普通</option>
        </select>
        <label className="inline-flex min-h-9 items-center gap-2 border border-neutral-300 bg-neutral-50 px-3 text-xs font-semibold text-neutral-800">
          <input type="checkbox" checked={overdueOnly} onChange={event => setOverdueOnly(event.target.checked)} className="accent-neutral-900" />只看超时会话
        </label>
        <label className="inline-flex min-h-9 items-center gap-2 border border-neutral-300 bg-neutral-50 px-3 text-xs font-semibold text-neutral-800">
          <input type="checkbox" checked={negativeFeedbackOnly} onChange={event => setNegativeFeedbackOnly(event.target.checked)} className="accent-neutral-900" />只看 AI 未解决反馈
        </label>
      </div>
      </>}

      {mode === 'settings' && <>
      <section className="rounded-xl border border-neutral-200 bg-white p-4 shadow-xs sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="flex items-center gap-2 text-sm font-bold text-neutral-900"><Bot className="h-4 w-4" />智能客服设置</h3>
            <p className="mt-1 max-w-3xl text-xs leading-5 text-neutral-600">商家客服会参考下方已确认的知识答复问题。首页访客助手另行运行。遇到敏感问题或知识不足时，会转由人工处理。</p>
          </div>
          <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-[10px] font-semibold text-neutral-700">
            {!aiStatus.reachable ? '客服服务未连接' : !aiStatus.modelInstalled ? '客服模型尚未安装' : !aiStatus.embeddingModelInstalled ? '知识检索尚未就绪' : '客服服务已就绪'}
          </span>
        </div>
        {loadingAiSettings && <p role="status" className="mt-3 text-xs text-neutral-500">正在读取 AI 客服配置…</p>}
        {aiSettingsError && <div role="alert" className="mt-3 flex flex-wrap items-center justify-between gap-2 border border-neutral-300 bg-neutral-50 px-3 py-2 text-xs text-neutral-800">
          <span>AI 客服配置读取失败：{aiSettingsError}</span>
          <button type="button" onClick={() => void loadAiSettings()} disabled={loadingAiSettings} className="min-h-8 border border-neutral-300 bg-white px-3 font-semibold disabled:opacity-50">{loadingAiSettings ? '重试中…' : '重试读取配置'}</button>
        </div>}
        {aiSettingsSaveError && <div role="alert" className="mt-3 flex flex-wrap items-center justify-between gap-2 border border-neutral-300 bg-neutral-50 px-3 py-2 text-xs text-neutral-800">
          <span>AI 客服配置保存失败：{aiSettingsSaveError}</span>
          <button type="button" onClick={() => void saveAiConfig()} disabled={savingAiConfig} className="min-h-8 border border-neutral-300 bg-white px-3 font-semibold disabled:opacity-50">{savingAiConfig ? '重试中…' : '重试保存配置'}</button>
        </div>}
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <label className="flex items-start gap-2 text-xs font-semibold text-neutral-800">
            <input type="checkbox" checked={aiConfig.enabled} onChange={event => setAiConfig(current => ({ ...current, enabled: event.target.checked }))} className="mt-0.5 accent-neutral-900" />
            启用商家 AI 客服
          </label>
          <label className="flex items-start gap-2 text-xs font-semibold text-neutral-800">
            <input type="checkbox" checked={aiConfig.autoReplyEnabled} onChange={event => setAiConfig(current => ({ ...current, autoReplyEnabled: event.target.checked }))} className="mt-0.5 accent-neutral-900" />
            自动在会话中发送答复
          </label>
          <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3 text-xs text-neutral-700">
            <label className="text-xs font-semibold text-neutral-800">
              商家客服模型
              <select value={aiConfig.model} onChange={event => setAiConfig(current => ({ ...current, model: event.target.value as MerchantSupportAiConfig['model'] }))} className="mt-1.5 block w-full rounded-md border border-neutral-200 bg-white px-2.5 py-2 text-xs">
                <option value="qwen2.5:7b">Qwen2.5-7B-Instruct</option>
                <option value="llama3.2:latest">Llama 3.2</option>
              </select>
            </label>
            <p className="text-[10px] leading-4 text-neutral-500">首页访客助手使用独立设置；商家客服使用上方所选服务。模型和咨询内容保存在 RUDA 服务器，不会发送给外部 AI 服务。</p>
          </div>
          <div className="rounded-lg border border-neutral-200 p-3 lg:col-span-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <strong className="text-xs text-neutral-800">人工回复时限</strong>
              <span className="text-[10px] text-neutral-500">可按优先级设置 1–168 小时；AI 自动回复不算人工回复</span>
            </div>
            <div className="mt-2 grid gap-2 sm:grid-cols-3">
              {(['urgent', 'high', 'normal'] as const).map(priority => (
                <label key={priority} className="text-[10px] font-semibold text-neutral-600">
                  {priorityLabels[priority]}
                  <div className="mt-1 flex items-center gap-2">
                    <input
                      type="number"
                      min={1}
                      max={168}
                      step={1}
                      value={slaMinutes[priority] / 60}
                      onChange={event => {
                        const hours = Number(event.target.value);
                        if (Number.isInteger(hours) && hours >= 1 && hours <= 168) {
                          setSlaMinutes(current => ({ ...current, [priority]: hours * 60 }));
                        }
                      }}
                      className="w-20 rounded-md border border-neutral-200 px-2 py-1.5 text-xs text-neutral-900"
                    />
                    <span>小时</span>
                  </div>
                </label>
              ))}
            </div>
          </div>
          <label className="text-xs font-semibold text-neutral-700 lg:col-span-2">
            客服常见问题与处理说明
            <textarea maxLength={20000} rows={9} value={aiConfig.instructions} onChange={event => setAiConfig(current => ({ ...current, instructions: event.target.value }))} placeholder={'按行填写已确认的平台规则、客服答复和常见问题。保存后，客服会根据顾客的问题查找相关内容。\n请勿填写密钥、顾客隐私或需要实时查询的订单信息。'} className="mt-1.5 w-full rounded-lg border border-neutral-200 bg-neutral-50 p-3 text-xs leading-5 outline-none focus:border-neutral-800" />
          </label>
        </div>
        <p className="mt-3 text-[10px] leading-4 text-neutral-500">咨询内容保存在 RUDA 服务器；发送给 AI 前会隐藏邮箱和电话号码。敏感问题交由人工处理。</p>
        {aiTestResult && <p role="status" className="mt-3 text-xs text-neutral-700">{aiTestResult}</p>}
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <button type="button" onClick={() => void testAiConnection()} disabled={testingAi || !aiStatus.reachable || !aiStatus.modelInstalled || !aiStatus.embeddingModelInstalled} className="min-h-9 border border-neutral-300 bg-white px-3 text-xs font-semibold text-neutral-700 disabled:opacity-40">
            {testingAi ? '正在测试…' : '测试客服答复'}
          </button>
          <button type="button" onClick={() => void saveAiConfig()} disabled={savingAiConfig || loadingAiSettings || Boolean(aiSettingsError)} className="min-h-9 bg-neutral-950 px-4 text-xs font-semibold text-white disabled:opacity-50">
            {savingAiConfig ? '保存中...' : '保存 AI 设置'}
          </button>
        </div>
      </section>

      <section className="rounded-xl border border-neutral-200 bg-white p-4 shadow-xs sm:p-5">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="flex items-center gap-2 text-sm font-bold text-neutral-900"><BookOpen className="h-4 w-4" />客服知识</h3>
            <p className="mt-1 max-w-3xl text-xs leading-5 text-neutral-600">已整理 {builtInKnowledge.length} 条平台流程和行业常见知识。可添加商家入驻说明、常见问题和已确认的平台规则，供客服答复时参考。</p>
          </div>
          <button
            type="button"
            onClick={() => setKnowledgeDraft({
              id: crypto.randomUUID(),
              title: '',
              category: 'platform',
              source: 'platform_verified',
              content: ''
            })}
            disabled={savingKnowledge || loadingKnowledge || Boolean(knowledgeError) || customKnowledge.length >= 100}
            className="inline-flex min-h-9 items-center gap-2 bg-neutral-950 px-3 text-xs font-semibold text-white disabled:opacity-40"
          ><Plus className="h-3.5 w-3.5" />新增知识条目</button>
        </header>
        {loadingKnowledge && <p role="status" className="mt-3 text-xs text-neutral-500">正在读取客服知识库…</p>}
        {knowledgeError && <div role="alert" className="mt-3 flex flex-wrap items-center justify-between gap-2 border border-neutral-300 bg-neutral-50 px-3 py-2 text-xs text-neutral-800">
          <span>客服知识库读取失败：{knowledgeError}</span>
          <button type="button" onClick={() => void loadKnowledge()} disabled={loadingKnowledge} className="min-h-8 border border-neutral-300 bg-white px-3 font-semibold disabled:opacity-50">{loadingKnowledge ? '重试中…' : '重试读取知识库'}</button>
        </div>}
        {knowledgeSaveError && <div role="alert" className="mt-3 flex flex-wrap items-center justify-between gap-2 border border-neutral-300 bg-neutral-50 px-3 py-2 text-xs text-neutral-800">
          <span>客服知识库保存失败：{knowledgeSaveError}</span>
          <button type="button" onClick={() => void saveKnowledgeArticles(knowledgeRetryArticles ?? customKnowledge)} disabled={savingKnowledge} className="min-h-8 border border-neutral-300 bg-white px-3 font-semibold disabled:opacity-50">{savingKnowledge ? '重试中…' : '重试保存知识库'}</button>
        </div>}

        {knowledgeDraft && (
          <form
            onSubmit={event => {
              event.preventDefault();
              const next = customKnowledge.some(article => article.id === knowledgeDraft.id)
                ? customKnowledge.map(article => article.id === knowledgeDraft.id ? knowledgeDraft : article)
                : [...customKnowledge, knowledgeDraft];
              void saveKnowledgeArticles(next);
            }}
            className="mt-4 space-y-3 rounded-lg border border-neutral-200 bg-neutral-50 p-3"
          >
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="text-[10px] font-semibold text-neutral-700 sm:col-span-2">
                标题
                <input required maxLength={160} value={knowledgeDraft.title} onChange={event => setKnowledgeDraft(current => current ? { ...current, title: event.target.value } : current)} placeholder="例如：商家提交入驻后如何查询审核状态" className="mt-1 w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-xs" />
              </label>
              <label className="text-[10px] font-semibold text-neutral-700">
                知识分类
                <select value={knowledgeDraft.category} onChange={event => setKnowledgeDraft(current => current ? { ...current, category: event.target.value as MerchantSupportKnowledgeCategory } : current)} className="mt-1 w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-xs">
                  {merchantSupportKnowledgeCategories.map(category => <option key={category.id} value={category.id}>{category.label}</option>)}
                </select>
              </label>
            </div>
            <label className="block text-[10px] font-semibold text-neutral-700">
              知识来源等级
              <select value={knowledgeDraft.source} onChange={event => setKnowledgeDraft(current => current ? { ...current, source: event.target.value as MerchantSupportKnowledgeArticle['source'] } : current)} className="mt-1 w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-xs sm:max-w-md">
                <option value="platform_verified">RUDA 已确认的平台规则 / SOP</option>
                <option value="industry_general">服装批发 / B2B 行业通用知识</option>
              </select>
              <span className="mt-1 block font-normal text-neutral-500">只有已核实的平台政策才能标记为“RUDA 已确认”；通用经验不能支持平台费用、审核结果或订单承诺。</span>
            </label>
            <label className="block text-[10px] font-semibold text-neutral-700">
              知识正文 / 问答 / 操作步骤
              <textarea required maxLength={8000} rows={7} value={knowledgeDraft.content} onChange={event => setKnowledgeDraft(current => current ? { ...current, content: event.target.value } : current)} placeholder={'推荐格式：\n问题：商家申请入驻需要准备什么？\n答复：……\n办理入口：……\n需要人工确认的情况：……\n请只填写经确认、可公开给商家的信息；不要写密码、密钥、顾客隐私或未经确认的审核/付款承诺。'} className="mt-1 w-full rounded-md border border-neutral-200 bg-white p-3 text-xs leading-5" />
              <span className="mt-1 block text-right font-normal text-neutral-400">{knowledgeDraft.content.length}/8000</span>
            </label>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setKnowledgeDraft(null)} className="min-h-9 border border-neutral-300 bg-white px-3 text-xs font-semibold text-neutral-700">取消</button>
              <button type="submit" disabled={savingKnowledge || !knowledgeDraft.title.trim() || !knowledgeDraft.content.trim()} className="inline-flex min-h-9 items-center gap-2 bg-neutral-950 px-3 text-xs font-semibold text-white disabled:opacity-40"><Save className="h-3.5 w-3.5" />{savingKnowledge ? '保存中…' : '保存并加入 AI 知识库'}</button>
            </div>
          </form>
        )}

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
          <p className="text-[10px] text-neutral-500">已添加 {customKnowledge.length}/100 条 · 内置知识 {builtInKnowledge.length} 条 · 修改后客服会自动使用最新内容</p>
          <select aria-label="筛选知识分类" value={knowledgeFilter} onChange={event => setKnowledgeFilter(event.target.value as typeof knowledgeFilter)} className="min-h-8 border border-neutral-200 bg-white px-2 text-[10px] text-neutral-700">
            <option value="all">所有知识分类</option>
            {merchantSupportKnowledgeCategories.map(category => <option key={category.id} value={category.id}>{category.label}</option>)}
          </select>
        </div>
        <div className="mt-3 space-y-2">
          {customKnowledge.filter(article => knowledgeFilter === 'all' || article.category === knowledgeFilter).map(article => (
            <article key={article.id} className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-neutral-200 p-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <h4 className="text-xs font-bold text-neutral-900">{article.title}</h4>
                  <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-[9px] text-neutral-600">{knowledgeCategoryLabel(article.category)}</span>
                  <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-[9px] text-neutral-700">{article.source === 'platform_verified' ? '平台已确认' : '行业通用'}</span>
                </div>
                <p className="mt-1 whitespace-pre-wrap text-[10px] leading-4 text-neutral-600">{article.content}</p>
              </div>
              <div className="flex shrink-0 gap-1">
                <button type="button" onClick={() => setKnowledgeDraft({ ...article })} className="min-h-8 border border-neutral-200 px-2 text-[10px] font-semibold text-neutral-700">编辑</button>
                <button type="button" onClick={() => void removeKnowledgeArticle(article.id)} className="inline-flex min-h-8 items-center gap-1 border border-neutral-300 px-2 text-[10px] font-semibold text-neutral-700"><Trash2 className="h-3 w-3" />删除</button>
              </div>
            </article>
          ))}
          {builtInKnowledge.filter(article => knowledgeFilter === 'all' || article.category === knowledgeFilter).length > 0 && (
            <details className="rounded-lg border border-neutral-200 bg-neutral-50 p-3">
              <summary className="cursor-pointer text-xs font-semibold text-neutral-800">查看内置知识条目（{builtInKnowledge.filter(article => knowledgeFilter === 'all' || article.category === knowledgeFilter).length}）</summary>
              <div className="mt-3 space-y-2">
                {builtInKnowledge.filter(article => knowledgeFilter === 'all' || article.category === knowledgeFilter).map(article => (
                  <details key={article.id} className="rounded-md border border-neutral-200 bg-white p-2.5">
                    <summary className="cursor-pointer text-[10px] font-semibold text-neutral-800">{article.title}<span className="ml-2 font-normal text-neutral-400">{knowledgeCategoryLabel(article.category)}</span></summary>
                    <p className="mt-2 whitespace-pre-wrap text-[10px] leading-4 text-neutral-600">{article.content}</p>
                  </details>
                ))}
              </div>
            </details>
          )}
          {customKnowledge.length === 0 && <p className="rounded-lg border border-dashed border-neutral-300 px-3 py-4 text-center text-[10px] text-neutral-500">还没有企业自定义知识；可将经过确认的平台政策和客服标准答复添加到这里。</p>}
        </div>
      </section>
      </>}

      {error && <div role="alert" className="border border-neutral-300 bg-neutral-50 px-3 py-2 text-xs text-neutral-800">{error}</div>}

      {mode === 'operations' && <>
      <div className="grid min-h-[560px] overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-xs lg:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="border-b border-neutral-200 lg:border-b-0 lg:border-r">
          <div className="flex items-center gap-2 border-b border-neutral-100 px-4 py-3 text-xs font-bold text-neutral-800"><Headphones className="h-4 w-4" />商家会话（{conversations.length}）</div>
          <div className="max-h-64 divide-y divide-neutral-100 overflow-auto lg:max-h-[500px]">
            {loading ? <p className="px-4 py-10 text-center text-xs text-neutral-500">正在加载商家会话...</p>
              : sortedConversations.length === 0 ? <p className="px-4 py-10 text-center text-xs text-neutral-500">暂无商家咨询</p>
                : sortedConversations.map(conversation => (
                  <button key={conversation.id} type="button" onClick={() => void loadConversation(conversation.id)} className={`w-full px-4 py-3 text-left hover:bg-neutral-50 ${activeConversation?.id === conversation.id ? 'bg-neutral-50' : ''}`}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-xs font-semibold text-neutral-900">{conversation.subject}</span>
                      {conversation.unreadCount > 0 && <span className="rounded-full bg-neutral-950 px-1.5 py-0.5 text-[9px] font-bold text-white">{conversation.unreadCount}</span>}
                    </div>
                    <p className="mt-1 truncate text-[10px] font-medium text-neutral-600">{conversation.merchant.name}</p>
                    <p className="mt-1 truncate text-[10px] text-neutral-500">{conversation.lastMessagePreview || '打开会话查看消息'}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-[9px] font-semibold text-neutral-700">{priorityLabels[conversation.priority]}</span>
                      <span className="text-[9px] text-neutral-500">{conversation.resolvedByAi && conversation.status === 'resolved' ? 'AI 已自助解决' : statusLabels[conversation.status]}</span>
                      {conversation.assignedAdminUsername && <span className="max-w-24 truncate text-[9px] text-neutral-500">· {conversation.assignedAdminUsername}</span>}
                      {getMerchantSupportSlaState(conversation.firstResponseDueAt, conversation.firstRespondedAt) === 'overdue' && <span className="rounded bg-neutral-200 px-1.5 py-0.5 text-[9px] font-semibold text-neutral-900">回复超时</span>}
                    </div>
                    <time className="mt-1 block text-right text-[9px] text-neutral-400">{new Date(conversation.lastMessageAt).toLocaleString(getIntlLocale(lang))}</time>
                  </button>
                ))}
          </div>
        </aside>

        <div className="flex min-h-[520px] flex-col">
          {activeConversation ? (
            <>
              <header className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-100 px-4 py-3 sm:px-5">
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-neutral-900">{activeConversation.subject}</h3>
                  <p className="mt-1 text-[10px] text-neutral-500">{activeConversation.merchant.name} · {activeConversation.merchant.companyLegalName || '企业档案未完善'} · {activeConversation.merchant.code || activeConversation.merchant.id}</p>
                  <p className="mt-1 text-[10px] text-neutral-500">{[activeConversation.merchant.country_zh, activeConversation.merchant.city_zh, activeConversation.merchant.merchantZone].filter(Boolean).join(' · ')} · {activeConversation.merchant.isVerified ? '已认证' : '未认证'} · 消息每 5 秒自动刷新</p>
                  {activeConversation.aiHandoffReason && <p className="mt-1 text-[10px] font-semibold text-neutral-700">{activeConversation.aiHandoffReason === 'sensitive' ? 'AI 已识别为敏感事项，等待人工处理' : 'AI 对答案不确定，已转人工队列'}</p>}
                  <p className={`mt-1 text-[10px] font-semibold ${getMerchantSupportSlaState(activeConversation.firstResponseDueAt, activeConversation.firstRespondedAt) === 'overdue' || getMerchantSupportSlaState(activeConversation.firstResponseDueAt, activeConversation.firstRespondedAt) === 'late' ? 'text-neutral-900' : 'text-neutral-500'}`}>
                    {activeConversation.resolvedByAi && activeConversation.status === 'resolved'
                      ? 'AI 自助解决 · 无需人工响应'
                      : activeConversation.firstRespondedAt
                      ? `首次人工响应：${new Date(activeConversation.firstRespondedAt).toLocaleString(getIntlLocale(lang))} · ${getMerchantSupportSlaState(activeConversation.firstResponseDueAt, activeConversation.firstRespondedAt) === 'late' ? '超时' : '达标'}`
                      : activeConversation.firstResponseDueAt
                        ? `首次人工响应截止：${new Date(activeConversation.firstResponseDueAt).toLocaleString(getIntlLocale(lang))}${getMerchantSupportSlaState(activeConversation.firstResponseDueAt, null) === 'overdue' ? ' · 已逾期' : ''}`
                        : '等待首次人工响应'}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button type="button" onClick={() => void clearMerchantMemory()} disabled={clearingMerchantMemory} className="min-h-9 border border-neutral-200 bg-white px-2 text-[10px] font-semibold text-neutral-600 disabled:opacity-50">{clearingMerchantMemory ? '清除中…' : '清除商家 AI 记忆'}</button>
                  <label className="sr-only" htmlFor="merchant-support-priority">工单优先级</label>
                  <select id="merchant-support-priority" value={activeConversation.priority} disabled={savingTriage} onChange={event => void updateTriage(activeConversation.id, { priority: event.target.value as MerchantSupportPriority })} className="min-h-9 border border-neutral-200 bg-white px-2 text-xs font-medium text-neutral-700">
                    {(['urgent', 'high', 'normal'] as const).map(priority => <option key={priority} value={priority}>{priorityLabels[priority]}</option>)}
                  </select>
                  <label className="sr-only" htmlFor="merchant-support-assignee">客服负责人</label>
                  <select id="merchant-support-assignee" value={activeConversation.assignedAdminUsername || ''} disabled={savingTriage} onChange={event => void updateTriage(activeConversation.id, { assignedAdminUsername: event.target.value || null })} className="min-h-9 max-w-36 border border-neutral-200 bg-white px-2 text-xs font-medium text-neutral-700">
                    <option value="">未分配</option>
                    {supportAgents.map(agent => <option key={agent.username} value={agent.username}>{agent.name}</option>)}
                  </select>
                  <label className="sr-only" htmlFor="merchant-support-admin-status">会话状态</label>
                  <select id="merchant-support-admin-status" value={activeConversation.status} disabled={savingStatus} onChange={event => void updateStatus(event.target.value as SupportStatus)} className="min-h-9 border border-neutral-200 bg-white px-2 text-xs font-medium text-neutral-700">
                    {(['open', 'in_progress', 'resolved'] as const).map(status => <option key={status} value={status}>{statusLabels[status]}</option>)}
                  </select>
                </div>
              </header>
              <div className="flex-1 space-y-3 overflow-auto bg-neutral-50/70 px-4 py-4 sm:px-5">
                {(activeConversation.messages || []).map(message => {
                  const mine = message.senderRole === 'admin';
                  return (
                    <div key={message.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[88%] rounded-xl px-3 py-2 ${mine ? 'bg-neutral-950 text-white' : 'border border-neutral-200 bg-white text-neutral-800'}`}>
                        <div className={`mb-1 text-[9px] font-semibold ${mine ? 'text-neutral-300' : 'text-neutral-500'}`}>{message.senderName}</div>
                        <p className="whitespace-pre-wrap break-words text-xs leading-5">{message.content}</p>
                        {message.senderRole === 'ai' && message.feedback && <p className="mt-1 text-[9px] text-neutral-600">{message.feedback === 'helpful' ? '商家反馈：有帮助' : '商家反馈：未解决'}</p>}
                        <time className="mt-1 block text-right text-[9px] text-neutral-400">{new Date(message.createdAt).toLocaleString(getIntlLocale(lang))}</time>
                      </div>
                    </div>
                  );
                })}
              </div>
              <form onSubmit={event => { event.preventDefault(); void sendReply(); }} className="border-t border-neutral-200 p-4 sm:p-5">
                <div className="flex items-end gap-2">
                  <textarea maxLength={4000} rows={3} value={draft} onChange={event => setDraft(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); if (draft.trim() && !sending) void sendReply(); } }} placeholder="回复商家，Enter 发送，Shift+Enter 换行" className="min-h-20 flex-1 resize-y rounded-lg border border-neutral-200 px-3 py-2 text-xs leading-5 outline-none focus:border-neutral-800" />
                  <button type="submit" disabled={sending || !draft.trim()} className="inline-flex h-10 items-center gap-2 rounded-lg bg-neutral-950 px-3 text-xs font-semibold text-white disabled:opacity-40">
                    {sending ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" /> : <Send className="h-3.5 w-3.5" />}发送
                  </button>
                </div>
              </form>
            </>
          ) : <div className="flex flex-1 flex-col items-center justify-center px-5 text-center text-neutral-500"><Headphones className="h-10 w-10 text-neutral-300" /><p className="mt-3 text-sm font-semibold">选择左侧商家会话开始回复</p><p className="mt-1 text-xs">人工回复会立即显示在商家工作台。</p></div>}
        </div>
      </div>
      </>}
    </section>
  );
};
