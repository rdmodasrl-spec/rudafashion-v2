import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Brain, Headphones, MessageCircle, RefreshCw, Send, ShieldAlert, ThumbsDown, ThumbsUp, Trash2 } from 'lucide-react';
import { apiDelete, apiGet, apiPost, apiPut } from '../../../../api/client';
import { useB2B } from '../../../../context/B2BContext';
import { getIntlLocale } from '../../../../i18n/translations';


type SupportStatus = 'open' | 'in_progress' | 'resolved';
type SupportMessage = {
  id: string;
  senderId: string;
  senderRole: 'merchant' | 'admin' | 'ai';
  senderName: string;
  content: string;
  feedback?: 'helpful' | 'not_helpful' | null;
  isRead: boolean;
  createdAt: string;
};
type SupportConversation = {
  id: string;
  subject: string;
  status: SupportStatus;
  resolvedByAi?: boolean;
  lastMessageAt: string;
  lastMessagePreview: string | null;
  messageCount: number;
  unreadCount: number;
  messages?: SupportMessage[];
};
type SupportMemory = {
  id: string;
  summary: string;
  createdAt: string;
  updatedAt: string;
};

const statusLabels: Record<SupportStatus, { zh: string; it: string; style: string }> = {
  open: { zh: '待客服回复', it: 'In attesa', style: 'bg-amber-100 text-amber-800' },
  in_progress: { zh: '客服处理中', it: 'In gestione', style: 'bg-sky-100 text-sky-800' },
  resolved: { zh: '已完成', it: 'Risolta', style: 'bg-emerald-100 text-emerald-800' }
};

export const MerchantSupportChat: React.FC = () => {
  const { lang, addNotification, localizeCopy } = useB2B();
  const isIt = lang === 'it';
  const [conversations, setConversations] = useState<SupportConversation[]>([]);
  const [activeConversation, setActiveConversation] = useState<SupportConversation | null>(null);
  const [subject, setSubject] = useState('');
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [memories, setMemories] = useState<SupportMemory[]>([]);
  const [memoriesOpen, setMemoriesOpen] = useState(false);
  const [loadingMemories, setLoadingMemories] = useState(false);
  const [clearingMemories, setClearingMemories] = useState(false);
  const [feedbackBusyId, setFeedbackBusyId] = useState<string | null>(null);

  const loadConversations = useCallback(async (quiet = false) => {
    if (!quiet) setRefreshing(true);
    try {
      const result = await apiGet<{ conversations: SupportConversation[] }>('/api/merchant/support/conversations');
      setConversations(result.conversations);
      setError('');
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : '读取商家客服会话失败';
      setError(message);
      if (!quiet) addNotification('warning', localizeCopy('客服会话加载失败', 'Caricamento non riuscito'), message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [addNotification, isIt]);

  const loadConversation = useCallback(async (id: string, quiet = false) => {
    try {
      const result = await apiGet<{ conversation: SupportConversation }>(`/api/merchant/support/conversations/${encodeURIComponent(id)}`);
      setActiveConversation(result.conversation);
      setConversations(current => current.map(item => item.id === id ? {
        ...item,
        unreadCount: 0,
        lastMessageAt: result.conversation.lastMessageAt,
        lastMessagePreview: result.conversation.lastMessagePreview
      } : item));
    } catch (cause) {
      if (!quiet) {
        const message = cause instanceof Error ? cause.message : '读取会话失败';
        setError(message);
        addNotification('warning', localizeCopy('会话读取失败', 'Conversazione non disponibile'), message);
      }
    }
  }, [addNotification, isIt]);

  useEffect(() => {
    void loadConversations();
    const timer = window.setInterval(() => void loadConversations(true), 5000);
    return () => window.clearInterval(timer);
  }, [loadConversations]);

  useEffect(() => {
    if (!activeConversation?.id) return;
    const timer = window.setInterval(() => void loadConversation(activeConversation.id, true), 5000);
    return () => window.clearInterval(timer);
  }, [activeConversation?.id, loadConversation]);

  const sortedConversations = useMemo(
    () => [...conversations].sort((left, right) => right.lastMessageAt.localeCompare(left.lastMessageAt)),
    [conversations]
  );

  const loadMemories = async () => {
    setLoadingMemories(true);
    try {
      const result = await apiGet<{ memories: SupportMemory[] }>('/api/merchant/support/memories');
      setMemories(result.memories);
      setMemoriesOpen(true);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : '读取长期记忆失败';
      setError(message);
      addNotification('warning', localizeCopy('读取 AI 长期记忆失败', 'Memoria non disponibile'), message);
    } finally {
      setLoadingMemories(false);
    }
  };

  const clearMemories = async () => {
    const confirmed = window.confirm(localizeCopy('确定清除本商家的 AI 长期记忆吗？这只删除已解决问题的摘要，不会删除原始客服会话。', 'Vuoi eliminare tutti i riepiloghi AI delle conversazioni risolte? Le conversazioni originali non verranno eliminate.'));
    if (!confirmed || clearingMemories) return;
    setClearingMemories(true);
    try {
      await apiDelete('/api/merchant/support/memories');
      setMemories([]);
      addNotification('success', localizeCopy('AI 长期记忆已清除', 'Memoria eliminata'), localizeCopy('原始客服会话仍保留。', 'Le conversazioni originali sono state conservate.'));
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : '清除长期记忆失败';
      setError(message);
      addNotification('warning', localizeCopy('清除 AI 长期记忆失败', 'Eliminazione non riuscita'), message);
    } finally {
      setClearingMemories(false);
    }
  };

  const rateAiReply = async (messageId: string, feedback: 'helpful' | 'not_helpful') => {
    if (feedbackBusyId) return;
    setFeedbackBusyId(messageId);
    try {
      await apiPut(`/api/merchant/support/messages/${encodeURIComponent(messageId)}/feedback`, { feedback });
      setActiveConversation(current => current ? {
        ...current,
        messages: current.messages?.map(message => message.id === messageId ? { ...message, feedback } : message)
      } : current);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : '保存 AI 回复评价失败';
      setError(message);
      addNotification('warning', localizeCopy('AI 回复评价未保存', 'Valutazione non salvata'), message);
    } finally {
      setFeedbackBusyId(null);
    }
  };

  const send = async () => {
    if (!draft.trim() || sending) return;
    setSending(true);
    try {
      if (!activeConversation) {
        if (!subject.trim()) {
          setError(localizeCopy('请先填写问题主题。', 'Inserisci l’oggetto della richiesta.'));
          return;
        }
        const result = await apiPost<{ conversation: SupportConversation }>('/api/merchant/support/conversations', {
          subject: subject.trim(),
          message: draft.trim()
        });
        setActiveConversation(result.conversation);
        setConversations(current => [result.conversation, ...current.filter(item => item.id !== result.conversation.id)]);
        setSubject('');
      } else {
        const result = await apiPost<{ conversation: SupportConversation }>(
          `/api/merchant/support/conversations/${encodeURIComponent(activeConversation.id)}/messages`,
          { content: draft.trim() }
        );
        setActiveConversation(result.conversation);
        setConversations(current => current.map(item => item.id === result.conversation.id
          ? { ...item, ...result.conversation, messageCount: result.conversation.messages?.length || item.messageCount }
          : item));
      }
      setDraft('');
      setError('');
      await loadConversations(true);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : '消息发送失败';
      setError(message);
      addNotification('warning', localizeCopy('消息发送失败', 'Invio non riuscito'), message);
    } finally {
      setSending(false);
    }
  };

  return (
    <section className="merchant-home-card overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
      <header className="merchant-home-intro flex flex-wrap items-center justify-between gap-3 border-b border-neutral-200 bg-[radial-gradient(ellipse_at_85%_0%,rgba(209,250,229,0.7),transparent_38%),linear-gradient(145deg,#fff_18%,#f8fafc_72%,#eef2ff_100%)] px-4 py-4 sm:px-5">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-neutral-950 text-white"><Headphones className="h-5 w-5" /></span>
          <div>
            <h2 className="text-base font-bold text-neutral-950">{localizeCopy('帮助支持', 'Assistenza RUDA')}</h2>
            <div className="mt-0.5 flex flex-wrap gap-2 text-[10px] text-neutral-500"><span>{localizeCopy('可问 RUDA 与 B2B', 'Supporto RUDA e B2B')}</span><span>{localizeCopy('档案辅助回答', 'Risposte con il profilo')}</span><span>{localizeCopy('政策未明转人工', 'Dubbi inoltrati al team')}</span><span>{localizeCopy('不读密码', 'Nessuna password')}</span><span>{localizeCopy('不读联系方式', 'Nessun contatto')}</span><span>{localizeCopy('不读财务', 'Nessun dato finanziario')}</span></div>
          </div>
        </div>
        <button type="button" onClick={() => void loadConversations()} disabled={refreshing} className="inline-flex min-h-9 items-center gap-2 rounded-xl border border-neutral-200 bg-white/80 px-3 text-xs font-semibold text-neutral-700 shadow-sm disabled:opacity-50">
          <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />{localizeCopy('刷新', 'Aggiorna')}
        </button>
        <button type="button" onClick={() => { if (memoriesOpen) setMemoriesOpen(false); else void loadMemories(); }} disabled={loadingMemories} className="inline-flex min-h-9 items-center gap-2 rounded-xl border border-neutral-200 bg-white/80 px-3 text-xs font-semibold text-neutral-700 shadow-sm disabled:opacity-50">
          <Brain className="h-3.5 w-3.5" />{isIt ? `Memoria AI (${memories.length})` : `AI 长期记忆${memories.length ? `（${memories.length}）` : ''}`}
        </button>
      </header>

      {memoriesOpen && (
        <section className="border-b border-neutral-200 bg-indigo-50/50 px-4 py-4 sm:px-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="flex items-center gap-2 text-xs font-bold text-neutral-900"><Brain className="h-4 w-4 text-indigo-700" />{localizeCopy('仅本商家的客服长期记忆', 'Memoria privata di questa azienda')}</h3>
              <div className="mt-1 flex flex-wrap gap-2 text-[10px] leading-4 text-neutral-600"><span>{localizeCopy('只检索本商家摘要', 'Solo riepiloghi aziendali')}</span><span>{localizeCopy('商家间不共享', 'Nessuna condivisione')}</span><span>{localizeCopy('敏感会话不记忆', 'Chat sensibili escluse')}</span></div>
            </div>
            {memories.length > 0 && <button type="button" onClick={() => void clearMemories()} disabled={clearingMemories} className="inline-flex min-h-8 items-center gap-1.5 border border-rose-200 bg-white px-2.5 text-[10px] font-semibold text-rose-700 disabled:opacity-50"><Trash2 className="h-3 w-3" />{clearingMemories ? (localizeCopy('清除中...', 'Eliminazione...')) : (localizeCopy('清除长期记忆', 'Cancella memoria'))}</button>}
          </div>
          <div className="mt-3 space-y-2">
            {loadingMemories ? <p className="text-[10px] text-neutral-500">{localizeCopy('正在读取记忆...', 'Caricamento...')}</p>
              : memories.length ? memories.map(memory => <article key={memory.id} className="rounded-lg border border-indigo-100 bg-white px-3 py-2"><p className="whitespace-pre-wrap text-[10px] leading-4 text-neutral-700">{memory.summary}</p><time className="mt-1 block text-right text-[9px] text-neutral-400">{new Date(memory.updatedAt).toLocaleDateString(getIntlLocale(lang))}</time></article>)
                : <div className="flex flex-wrap gap-2 text-[10px] text-neutral-500"><span>{localizeCopy('暂无长期记忆', 'Nessuna memoria')}</span><span>{localizeCopy('客服标记完成', 'Chiusura manuale')}</span><span>{localizeCopy('安全摘要留存', 'Riepilogo sicuro salvato')}</span><span>{localizeCopy('同店后续可用', 'Riutilizzabile nello stesso negozio')}</span></div>}
          </div>
        </section>
      )}

      <div className="grid min-h-[540px] lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="border-b border-neutral-200 lg:border-b-0 lg:border-r">
          <div className="flex items-center justify-between px-4 py-3">
            <h3 className="text-xs font-bold text-neutral-800">{localizeCopy('我的咨询', 'Le tue richieste')}</h3>
            <button type="button" onClick={() => { setActiveConversation(null); setDraft(''); setSubject(''); setError(''); }} className="text-xs font-semibold text-blue-700 hover:underline">{localizeCopy('新建咨询', 'Nuova')}</button>
          </div>
          <div className="max-h-64 divide-y divide-neutral-100 overflow-auto lg:max-h-[480px]">
            {loading ? <p className="px-4 py-8 text-center text-xs text-neutral-500">{localizeCopy('正在加载会话...', 'Caricamento...')}</p>
              : sortedConversations.length === 0 ? <div className="px-4 py-8 text-center text-xs text-neutral-500"><span>{localizeCopy('暂无咨询', 'Nessuna richiesta')}</span><span className="mx-1">·</span><span>{localizeCopy('发送消息开始', 'Scrivi per iniziare')}</span></div>
                : sortedConversations.map(conversation => (
                  <button key={conversation.id} type="button" onClick={() => { setError(''); void loadConversation(conversation.id); }} className={`w-full px-4 py-3 text-left hover:bg-neutral-50 ${activeConversation?.id === conversation.id ? 'bg-neutral-50' : ''}`}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-xs font-semibold text-neutral-900">{conversation.subject}</span>
                      {conversation.unreadCount > 0 && <span className="rounded-full bg-rose-600 px-1.5 py-0.5 text-[9px] font-bold text-white">{conversation.unreadCount}</span>}
                    </div>
                    <p className="mt-1 truncate text-[10px] text-neutral-500">{conversation.lastMessagePreview || (isIt ? 'Apri conversazione' : '打开会话查看消息')}</p>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <span className={`rounded-full px-2 py-0.5 text-[9px] font-semibold ${statusLabels[conversation.status].style}`}>{conversation.resolvedByAi && conversation.status === 'resolved' ? (localizeCopy('AI 已自助解决', 'Risolta dall’AI')) : isIt ? statusLabels[conversation.status].it : statusLabels[conversation.status].zh}</span>
                      <time className="text-[9px] text-neutral-400">{new Date(conversation.lastMessageAt).toLocaleDateString(getIntlLocale(lang))}</time>
                    </div>
                  </button>
                ))}
          </div>
        </aside>

        <div className="flex min-h-[500px] flex-col">
          {activeConversation ? (
            <>
              <div className="flex items-start justify-between gap-3 border-b border-neutral-100 px-4 py-3 sm:px-5">
                <div>
                  <h3 className="text-sm font-bold text-neutral-900">{activeConversation.subject}</h3>
                  <p className="mt-1 text-[10px] text-neutral-500">{activeConversation.resolvedByAi
                    ? localizeCopy('AI 已提供初步解答；如仍需帮助，继续发送消息即可重新进入人工客服队列。', 'L’AI ha risposto. Puoi continuare a scrivere per riaprire la richiesta all’assistenza.')
                    : localizeCopy('消息每 5 秒自动刷新', 'Messaggi aggiornati automaticamente ogni 5 secondi')}</p>
                </div>
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold ${statusLabels[activeConversation.status].style}`}>{isIt ? statusLabels[activeConversation.status].it : statusLabels[activeConversation.status].zh}</span>
              </div>
              <div className="flex-1 space-y-3 overflow-auto bg-neutral-50/70 px-4 py-4 sm:px-5">
                {(activeConversation.messages || []).map(message => {
                  const mine = message.senderRole === 'merchant';
                  return (
                    <div key={message.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[88%] rounded-xl px-3 py-2 ${mine ? 'bg-neutral-950 text-white' : message.senderRole === 'ai' ? 'border border-indigo-100 bg-indigo-50 text-neutral-800' : 'border border-neutral-200 bg-white text-neutral-800'}`}>
                        <div className={`mb-1 text-[9px] font-semibold ${mine ? 'text-neutral-300' : message.senderRole === 'ai' ? 'text-indigo-700' : 'text-neutral-500'}`}>{message.senderRole === 'ai' ? (isIt ? `Assistente AI RUDA · ${message.senderName.includes('Qwen') ? 'Qwen locale' : 'Guida sicura'}` : message.senderName) : mine ? message.senderName : (isIt ? 'Assistenza RUDA' : `平台客服 · ${message.senderName}`)}</div>
                        <p className="whitespace-pre-wrap break-words text-xs leading-5">{message.content}</p>
                        {message.senderRole === 'ai' && (
                          <div className="mt-2 flex items-center justify-end gap-1 border-t border-neutral-200/70 pt-1.5">
                            <button type="button" onClick={() => void rateAiReply(message.id, 'helpful')} disabled={feedbackBusyId === message.id} aria-label={localizeCopy('AI 回复有帮助', 'Risposta utile')} aria-pressed={message.feedback === 'helpful'} className={`inline-flex items-center gap-1 rounded px-1.5 py-1 text-[9px] ${message.feedback === 'helpful' ? 'bg-emerald-100 text-emerald-800' : 'text-neutral-500 hover:bg-neutral-100'}`}><ThumbsUp className="h-3 w-3" />{localizeCopy('有帮助', 'Utile')}</button>
                            <button type="button" onClick={() => void rateAiReply(message.id, 'not_helpful')} disabled={feedbackBusyId === message.id} aria-label={localizeCopy('AI 回复没解决', 'Risposta non utile')} aria-pressed={message.feedback === 'not_helpful'} className={`inline-flex items-center gap-1 rounded px-1.5 py-1 text-[9px] ${message.feedback === 'not_helpful' ? 'bg-rose-100 text-rose-800' : 'text-neutral-500 hover:bg-neutral-100'}`}><ThumbsDown className="h-3 w-3" />{localizeCopy('没解决', 'Non utile')}</button>
                          </div>
                        )}
                        <time className={`mt-1 block text-right text-[9px] ${mine ? 'text-neutral-400' : 'text-neutral-400'}`}>{new Date(message.createdAt).toLocaleString(getIntlLocale(lang))}</time>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center px-5 py-10 text-center">
              <MessageCircle className="h-10 w-10 text-neutral-300" />
              <h3 className="mt-3 text-sm font-bold text-neutral-800">{localizeCopy('向 RUDA 平台客服发送问题', 'Nuova richiesta al team RUDA')}</h3>
              <div className="mt-1 flex flex-wrap gap-2 text-xs leading-5 text-neutral-500"><span>{localizeCopy('AI 解答常见问题', 'AI per richieste comuni')}</span><span>{localizeCopy('复杂问题转人工', 'Casi complessi al team')}</span></div>
            </div>
          )}

          <form onSubmit={event => { event.preventDefault(); void send(); }} className="border-t border-neutral-200 bg-white p-4 sm:p-5">
            {!activeConversation && <label className="mb-2 block text-[10px] font-semibold text-neutral-600">{localizeCopy('问题主题', 'Oggetto')}
              <input required maxLength={120} value={subject} onChange={event => setSubject(event.target.value)} placeholder={localizeCopy('例如：商品上架或订单问题', 'Es. Problema con l’ordine')} className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-xs outline-none focus:border-neutral-800" />
            </label>}
            <label className="sr-only" htmlFor="merchant-support-message">{localizeCopy('咨询内容', 'Messaggio')}</label>
            <div className="flex items-end gap-2">
              <textarea id="merchant-support-message" maxLength={4000} rows={3} value={draft} onChange={event => setDraft(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); if (!sending && draft.trim() && (activeConversation || subject.trim())) void send(); } }} placeholder={localizeCopy('输入问题或补充说明，Enter 发送，Shift+Enter 换行', 'Scrivi il tuo messaggio... (Invio per inviare)')} className="min-h-20 flex-1 resize-y rounded-lg border border-neutral-200 px-3 py-2 text-xs leading-5 outline-none focus:border-neutral-800" />
              <button type="submit" disabled={sending || !draft.trim() || (!activeConversation && !subject.trim())} className="inline-flex h-10 shrink-0 items-center gap-2 rounded-lg bg-neutral-950 px-3 text-xs font-semibold text-white disabled:opacity-40">
                {sending ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" /> : <Send className="h-3.5 w-3.5" />}{localizeCopy('发送', 'Invia')}
              </button>
            </div>
            <div className="mt-2 flex items-start gap-1.5 text-[10px] leading-4 text-neutral-500">
              <ShieldAlert className="mt-0.5 h-3 w-3 shrink-0" />
              <span>{localizeCopy('请勿发送密码、验证码或完整银行资料。AI 为常见问题指引，不确定时由人工客服跟进。', 'Non inviare password, codici di verifica o dati bancari completi. L’assistente AI fornisce solo indicazioni iniziali.')}</span>
            </div>
            {error && <p role="alert" className="mt-2 text-xs text-rose-700">{error}</p>}
          </form>
        </div>
      </div>
    </section>
  );
};
