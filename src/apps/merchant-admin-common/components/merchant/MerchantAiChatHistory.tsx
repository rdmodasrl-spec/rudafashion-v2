import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MessageCircle, RefreshCw, Search, Send, ShieldAlert, Sparkles } from 'lucide-react';
import { apiGet, apiPost, ApiError } from '../../../../api/client';
import { useB2B } from '../../../../context/B2BContext';

type ConversationSummary = {
  id: string;
  title: string;
  updatedAt: string;
  messageCount: number;
  lastMessage: string;
  lastMessageRole: string;
  lastContext: string;
};

type ChatMessage = {
  id: string;
  role: string;
  content: string;
  context: string;
  createdAt: string;
};

type HistoryListResponse = { success: true; conversations: ConversationSummary[] };
type HistoryDetailResponse = {
  success: true;
  conversation: { id: string; title: string; updatedAt: string };
  messages: ChatMessage[];
};
type AssistantQueryResponse = {
  success: true;
  reply: string;
  conversationId: string;
  conversationTitle: string;
  conversationUpdatedAt: string;
  messageCount: number;
  messageId: string;
};

const assistantContextWhitelist = new Set([
  'dashboard', 'analytics', 'products', 'sku_matrix', 'inventory', 'materials',
  'production', 'orders', 'vault_requests', 'customers', 'growth', 'finance',
  'profile', 'settings', 'content', 'gallery', 'support'
]);

const baseContext = (stored: string) => {
  const value = String(stored || '').split(':')[0];
  return assistantContextWhitelist.has(value) ? value : 'dashboard';
};

export function MerchantAiChatHistory({ isIt = false }: { isIt?: boolean }) {
  const { localizeCopy } = useB2B();
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [search, setSearch] = useState('');
  const [listLoading, setListLoading] = useState(true);
  // 错误只保存稳定代码，渲染时再本地化，避免文案回调变化触发重复请求。
  const [listError, setListError] = useState<'forbidden' | 'failed' | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<HistoryDetailResponse | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<'notFound' | 'failed' | null>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const messageEndRef = useRef<HTMLDivElement | null>(null);

  const loadList = useCallback(async (keyword: string) => {
    setListLoading(true);
    setListError(null);
    try {
      const query = new URLSearchParams({ limit: '30' });
      if (keyword.trim()) query.set('search', keyword.trim());
      const result = await apiGet<HistoryListResponse>(`/api/merchant/assistant/history?${query.toString()}`);
      setConversations(Array.isArray(result.conversations) ? result.conversations : []);
    } catch (error) {
      setConversations([]);
      setListError(error instanceof ApiError && error.status === 403 ? 'forbidden' : 'failed');
    } finally {
      setListLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadList(search); }, search ? 300 : 0);
    return () => window.clearTimeout(timer);
  }, [loadList, search]);

  const loadDetail = useCallback(async (conversationId: string) => {
    setSelectedId(conversationId);
    setDetailLoading(true);
    setDetailError(null);
    setSendError(null);
    try {
      const result = await apiGet<HistoryDetailResponse>(`/api/merchant/assistant/history/${encodeURIComponent(conversationId)}`);
      setDetail(result);
    } catch (error) {
      setDetail(null);
      setDetailError(error instanceof ApiError && error.status === 404 ? 'notFound' : 'failed');
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!conversations.length) return;
    if (selectedId && conversations.some(conversation => conversation.id === selectedId)) return;
    void loadDetail(conversations[0]!.id);
  }, [conversations, loadDetail, selectedId]);

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ block: 'end' });
  }, [detail?.messages.length, sending]);

  const activeConversation = useMemo(
    () => conversations.find(conversation => conversation.id === selectedId) || null,
    [conversations, selectedId]
  );

  const send = async () => {
    const question = draft.trim();
    if (!question || sending || !selectedId) return;
    const lastStoredContext = detail?.messages[detail.messages.length - 1]?.context || activeConversation?.lastContext || 'dashboard';
    const context = baseContext(lastStoredContext);
    setSending(true);
    setSendError(null);
    setDraft('');
    const optimisticId = `local-${Date.now()}`;
    setDetail(current => current
      ? { ...current, messages: [...current.messages, { id: optimisticId, role: 'user', content: question, context, createdAt: new Date().toISOString() }] }
      : current);
    try {
      const result = await apiPost<AssistantQueryResponse>('/api/merchant/assistant/query', {
        question,
        conversationId: selectedId,
        context,
        scope: 'overview',
        includeFullHistory: true
      }, 30_000, { 'Idempotency-Key': `assistant-history-${crypto.randomUUID()}` });
      setDetail(current => current
        ? {
            ...current,
            messages: [...current.messages, {
              id: result.messageId,
              role: 'assistant',
              content: result.reply,
              context,
              createdAt: new Date().toISOString()
            }]
          }
        : current);
      setConversations(current => {
        const updated = current.map(conversation => conversation.id === selectedId
          ? {
              ...conversation,
              title: result.conversationTitle || conversation.title,
              updatedAt: result.conversationUpdatedAt,
              messageCount: result.messageCount,
              lastMessage: result.reply,
              lastMessageRole: 'assistant',
              lastContext: context
            }
          : conversation);
        return [...updated].sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime());
      });
    } catch (error) {
      const code = error instanceof ApiError ? error.code : '';
      setSendError(code === 'EMPLOYEE_PERMISSION_REQUIRED' || code === 'MODAUI_DISABLED'
        ? localizeCopy('AI 助手暂不可用', 'Assistente AI non disponibile')
        : localizeCopy('发送失败，请重试', 'Invio non riuscito, riprova'));
      setDraft(question);
    } finally {
      setSending(false);
    }
  };

  const formatter = useMemo(
    () => new Intl.DateTimeFormat(isIt ? 'it-IT' : 'zh-CN', { dateStyle: 'medium', timeStyle: 'short' }),
    [isIt]
  );

  return (
    <section id="merchant-ai-chat-history" className="space-y-3">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-base font-bold text-neutral-950">{localizeCopy('AI 聊天记录', 'Cronologia AI')}</h1>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-400" />
            <input
              value={search}
              onChange={event => setSearch(event.target.value)}
              placeholder={localizeCopy('搜索聊天记录', 'Cerca nella cronologia')}
              aria-label={localizeCopy('搜索聊天记录', 'Cerca nella cronologia')}
              className="h-9 w-full min-w-0 rounded-lg border border-neutral-200 bg-white pl-8 pr-3 text-xs text-neutral-900 placeholder:text-neutral-500 focus:border-neutral-400 focus:outline-none sm:w-64"
            />
          </div>
          <button
            type="button"
            onClick={() => void loadList(search)}
            disabled={listLoading}
            aria-label={localizeCopy('刷新', 'Aggiorna')}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 text-[11px] font-semibold text-neutral-700 hover:border-neutral-300 hover:text-neutral-950 disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${listLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </header>

      <div className="grid gap-3 lg:grid-cols-[300px_minmax(0,1fr)]">
        <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
          {listError ? (
            <div role="alert" className="flex items-start gap-2 p-4">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-neutral-500" />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-neutral-900">{listError === 'forbidden'
                  ? localizeCopy('无权限查看聊天记录', 'Permesso insufficiente per la cronologia')
                  : localizeCopy('无法加载聊天记录', 'Impossibile caricare la cronologia')}</p>
                <button
                  type="button"
                  onClick={() => void loadList(search)}
                  className="mt-2 rounded-lg border border-neutral-200 px-3 py-1.5 text-[11px] font-semibold text-neutral-700 hover:border-neutral-300 hover:text-neutral-950"
                >
                  {localizeCopy('重试', 'Riprova')}
                </button>
              </div>
            </div>
          ) : listLoading && !conversations.length ? (
            <ul className="divide-y divide-neutral-100">
              {[0, 1, 2].map(index => (
                <li key={index} className="space-y-2 px-3 py-3">
                  <span className="block h-2.5 w-32 animate-pulse rounded bg-neutral-100" />
                  <span className="block h-2.5 w-44 animate-pulse rounded bg-neutral-100" />
                </li>
              ))}
            </ul>
          ) : !conversations.length ? (
            <div className="px-4 py-10 text-center">
              <MessageCircle className="mx-auto h-5 w-5 text-neutral-300" />
              <p className="mt-2 text-xs text-neutral-500">
                {search ? localizeCopy('没有匹配的聊天', 'Nessuna chat trovata') : localizeCopy('暂无聊天记录', 'Nessuna conversazione')}
              </p>
            </div>
          ) : (
            <ul className="max-h-[60vh] divide-y divide-neutral-100 overflow-y-auto">
              {conversations.map(conversation => {
                const active = conversation.id === selectedId;
                return (
                  <li key={conversation.id}>
                    <button
                      type="button"
                      onClick={() => void loadDetail(conversation.id)}
                      aria-current={active ? 'true' : undefined}
                      className={`w-full px-3 py-3 text-left transition ${active ? 'bg-neutral-100' : 'hover:bg-neutral-50'}`}
                    >
                      <span className="block truncate text-xs font-semibold text-neutral-900">{conversation.title}</span>
                      <span className="mt-1 block truncate text-[11px] text-neutral-500">{conversation.lastMessage}</span>
                      <span className="mt-1 block text-[10px] text-neutral-500">
                        {formatter.format(new Date(conversation.updatedAt))} · {conversation.messageCount} {localizeCopy('条消息', 'messaggi')}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="flex min-h-[420px] flex-col overflow-hidden rounded-xl border border-neutral-200 bg-white">
          {detailLoading ? (
            <div className="flex flex-1 items-center justify-center text-xs text-neutral-500">{localizeCopy('正在加载…', 'Caricamento…')}</div>
          ) : detailError ? (
            <div role="alert" className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
              <ShieldAlert className="h-5 w-5 text-neutral-400" />
              <p className="text-xs font-semibold text-neutral-900">{detailError === 'notFound'
                ? localizeCopy('该聊天记录不存在', 'Conversazione non trovata')
                : localizeCopy('无法加载对话内容', 'Impossibile caricare la conversazione')}</p>
              <button
                type="button"
                onClick={() => selectedId && void loadDetail(selectedId)}
                className="rounded-lg border border-neutral-200 px-3 py-1.5 text-[11px] font-semibold text-neutral-700 hover:border-neutral-300 hover:text-neutral-950"
              >
                {localizeCopy('重试', 'Riprova')}
              </button>
            </div>
          ) : !detail ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center">
              <Sparkles className="h-5 w-5 text-neutral-300" />
              <p className="text-xs text-neutral-500">{localizeCopy('选择左侧对话查看内容', 'Seleziona una conversazione')}</p>
            </div>
          ) : (
            <>
              <div className="flex-1 space-y-3 overflow-y-auto p-4">
                {detail.messages.map(message => {
                  const mine = message.role === 'user';
                  return (
                    <div key={message.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[85%] rounded-xl px-3 py-2 ${mine ? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-900'}`}>
                        <p className={`text-[10px] font-semibold ${mine ? 'text-neutral-300' : 'text-neutral-500'}`}>
                          {mine ? localizeCopy('你', 'Tu') : localizeCopy('AI 助手', 'Assistente AI')} · {formatter.format(new Date(message.createdAt))}
                        </p>
                        <p className="mt-1 whitespace-pre-wrap break-words text-xs leading-5">{message.content}</p>
                      </div>
                    </div>
                  );
                })}
                {sending ? (
                  <p className="text-[11px] text-neutral-500">{localizeCopy('AI 正在回答…', 'L’assistente sta rispondendo…')}</p>
                ) : null}
                <div ref={messageEndRef} />
              </div>
              <form
                onSubmit={event => { event.preventDefault(); void send(); }}
                className="border-t border-neutral-100 p-3"
              >
                {sendError ? <p role="alert" className="mb-2 text-[11px] font-semibold text-neutral-700">{sendError}</p> : null}
                <div className="flex items-end gap-2">
                  <textarea
                    value={draft}
                    onChange={event => setDraft(event.target.value)}
                    onKeyDown={event => {
                      if (event.key === 'Enter' && !event.shiftKey) {
                        event.preventDefault();
                        void send();
                      }
                    }}
                    rows={2}
                    maxLength={500}
                    placeholder={localizeCopy('继续对话', 'Continua la chat')}
                    aria-label={localizeCopy('继续对话', 'Continua la chat')}
                    className="min-h-[44px] flex-1 resize-none rounded-lg border border-neutral-200 px-3 py-2 text-xs text-neutral-900 placeholder:text-neutral-500 focus:border-neutral-400 focus:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={!draft.trim() || sending}
                    className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-lg bg-neutral-900 px-3 text-[11px] font-semibold text-white transition hover:bg-neutral-700 disabled:opacity-40"
                  >
                    <Send className="h-3.5 w-3.5" />
                    {localizeCopy('发送', 'Invia')}
                  </button>
                </div>
              </form>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
