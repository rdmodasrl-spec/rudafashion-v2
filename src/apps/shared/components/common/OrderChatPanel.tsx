import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, RefreshCw, Send } from 'lucide-react';
import { ApiError, apiGet, apiPost } from '../../../../api/client';
import { useB2B } from '../../../../context/B2BContext';
import { getIntlLocale } from '../../../../i18n/translations';
import type { OrderMessage } from '../../../../types/b2b';

type OrderChatPanelProps = {
  orderId: string;
  orderNo: string;
  role: 'buyer' | 'merchant';
  disabled?: boolean;
  onUnreadCountChange?: (count: number) => void;
};

type MessagePage = {
  success: true;
  messages: OrderMessage[];
  escalationUpdates?: Array<{ id: string; merchantRepliedAt: string | null }>;
  nextBefore: string | null;
  nextAfter: string | null;
  hasMore: boolean;
};

function mergeMessages(current: OrderMessage[], incoming: OrderMessage[]): OrderMessage[] {
  const byId = new Map(current.map(message => [message.id, message]));
  incoming.forEach(message => byId.set(message.id, message));
  return [...byId.values()].sort((left, right) =>
    left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id)
  );
}

export const OrderChatPanel: React.FC<OrderChatPanelProps> = ({
  orderId,
  orderNo,
  role,
  disabled = false,
  onUnreadCountChange
}) => {
  const { lang, localizeCopy } = useB2B();
  const [messages, setMessages] = useState<OrderMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [beforeCursor, setBeforeCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const afterCursor = useRef<string | null>(null);
  const pendingMessageId = useRef<string | null>(null);
  const unreadCallback = useRef(onUnreadCountChange);
  unreadCallback.current = onUnreadCountChange;
  const refreshRef = useRef<() => void>(() => undefined);
  const endOfMessagesRef = useRef<HTMLDivElement | null>(null);
  const basePath = role === 'merchant'
    ? `/api/merchant/orders/${encodeURIComponent(orderId)}/messages`
    : `/api/orders/${encodeURIComponent(orderId)}/messages`;

  useEffect(() => {
    if (disabled) {
      setLoading(false);
      return;
    }
    let disposed = false;
    let inFlight = false;
    let markReadPending = false;
    const load = async (initial: boolean) => {
      if (inFlight || disposed) return;
      inFlight = true;
      try {
        const query = !initial && afterCursor.current
          ? `?after=${encodeURIComponent(afterCursor.current)}`
          : '';
        const page = await apiGet<MessagePage>(`${basePath}${query}`);
        if (disposed) return;
        setMessages(current => initial ? page.messages : mergeMessages(current, page.messages));
          if (page.escalationUpdates?.length) {
            const updates = new Map(page.escalationUpdates.map(item => [item.id, item.merchantRepliedAt]));
            setMessages(current => current.map(message => updates.has(message.id)
              ? { ...message, merchantRepliedAt: updates.get(message.id) || null }
              : message
            ));
          }
        if (initial) setBeforeCursor(page.nextBefore);
        if (initial) setHasMore(page.hasMore);
        if (page.nextAfter) afterCursor.current = page.nextAfter;
        setError(null);
        setLoading(false);
        if (page.messages.some(message => message.senderRole !== role)) markReadPending = true;
        if (markReadPending) {
          await apiPost(`${basePath}/read`, {});
          markReadPending = false;
          if (!disposed) unreadCallback.current?.(0);
        }
      } catch (loadError) {
        if (!disposed) {
          setError(getErrorMessage(loadError, localizeCopy));
          setLoading(false);
        }
      } finally {
        inFlight = false;
      }
    };
    refreshRef.current = () => { void load(false); };
    void load(true);
    const interval = window.setInterval(() => void load(false), 3000);
    return () => {
      disposed = true;
      window.clearInterval(interval);
    };
  }, [basePath, disabled, role]);

  useEffect(() => {
    endOfMessagesRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages]);

  const loadEarlier = async () => {
    if (!beforeCursor) return;
    setLoading(true);
    try {
      const page = await apiGet<MessagePage>(`${basePath}?before=${encodeURIComponent(beforeCursor)}`);
      setMessages(current => mergeMessages(page.messages, current));
      setBeforeCursor(page.nextBefore);
      setHasMore(page.hasMore);
      setError(null);
    } catch (loadError) {
      setError(getErrorMessage(loadError, localizeCopy));
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async (event: React.FormEvent) => {
    event.preventDefault();
    const content = draft.trim();
    if (!content || sending || disabled) return;
    if (!pendingMessageId.current) pendingMessageId.current = crypto.randomUUID();
    setSending(true);
    try {
      const result = await apiPost<{ success: true; message: OrderMessage; automaticReply?: OrderMessage }>(basePath, {
        content,
        clientMessageId: pendingMessageId.current
      });
      setMessages(current => mergeMessages(current, [result.message, ...(result.automaticReply ? [result.automaticReply] : [])]));
      setDraft('');
      pendingMessageId.current = null;
      setSendError(null);
      setError(null);
      unreadCallback.current?.(0);
    } catch (sendError) {
      setSendError(getErrorMessage(sendError, localizeCopy));
    } finally {
      setSending(false);
    }
  };

  return (
    <section className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm lg:h-[calc(100vh-8rem)]">
      <header className="flex shrink-0 items-center justify-between border-b border-neutral-100 px-4 py-3">
        <div>
          <h3 className="text-sm font-semibold text-neutral-950">{localizeCopy('订单沟通', 'Messaggi ordine')}</h3>
          <p className="mt-0.5 text-[10px] text-neutral-500">{orderNo}</p>
        </div>
        <button
          type="button"
          onClick={() => setExpanded(value => !value)}
          aria-expanded={expanded}
          aria-label={expanded ? localizeCopy('收起订单沟通', 'Comprimi messaggi ordine') : localizeCopy('展开订单沟通', 'Apri messaggi ordine')}
          className="rounded-lg border border-neutral-200 p-2 text-neutral-600 hover:bg-neutral-50 lg:hidden"
        >
          <ChevronDown className={`h-4 w-4 transition-transform ${expanded ? '' : '-rotate-90'}`} />
        </button>
      </header>

      <div className={`${expanded ? 'flex' : 'hidden'} min-h-0 flex-1 flex-col lg:flex`}>
        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4" aria-live="polite">
          {hasMore && beforeCursor && (
            <button
              type="button"
              onClick={() => void loadEarlier()}
              disabled={loading}
              className="mb-4 w-full rounded-lg border border-neutral-200 px-3 py-2 text-xs font-medium text-neutral-600 hover:bg-neutral-50 disabled:opacity-50"
            >
              {localizeCopy('查看更早消息', 'Mostra messaggi precedenti')}
            </button>
          )}
          {loading && messages.length === 0 ? (
            <p className="py-8 text-center text-xs text-neutral-500">{localizeCopy('正在加载消息…', 'Caricamento messaggi…')}</p>
          ) : messages.length === 0 ? (
            <p className="py-8 text-center text-xs text-neutral-500">{localizeCopy('暂无消息', 'Nessun messaggio')}</p>
          ) : (
            <ol className="space-y-3">
              {messages.map(message => {
                const automatic = message.source === 'automatic';
                const mine = !automatic && message.senderRole === role;
                return (
                  <li key={message.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[88%] rounded-2xl px-3 py-2 ${mine ? 'bg-neutral-950 text-white' : 'bg-neutral-100 text-neutral-900'}`}>
                      <p className={`mb-1 text-[10px] font-medium ${mine ? 'text-neutral-300' : 'text-neutral-500'}`}>
                        {automatic
                          ? localizeCopy('自动回复', 'Risposta automatica')
                          : mine ? localizeCopy('你', 'Tu') : role === 'merchant' ? localizeCopy('客户', 'Cliente') : localizeCopy('商家', 'Venditore')}
                      </p>
                      <p className="whitespace-pre-wrap break-words text-xs leading-5">{message.content}</p>
                      {message.requiresMerchantReply && (
                        <p className="mt-1 text-[10px] font-medium text-neutral-500">
                          {message.merchantRepliedAt
                            ? localizeCopy('商家已回复', 'Il venditore ha risposto')
                            : role === 'merchant'
                              ? localizeCopy('待商家回复', 'In attesa della risposta del venditore')
                              : localizeCopy('已提醒商家，等待回复', 'Venditore avvisato, in attesa di risposta')}
                        </p>
                      )}
                      <time className={`mt-1 block text-right text-[9px] ${mine ? 'text-neutral-400' : 'text-neutral-500'}`}>
                        {new Date(message.createdAt).toLocaleString(getIntlLocale(lang))}
                      </time>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
          <div ref={endOfMessagesRef} />
        </div>

        {error && (
          <div role="alert" className="flex items-center justify-between gap-2 border-t border-neutral-100 bg-neutral-50 px-3 py-2">
            <p className="min-w-0 text-[11px] text-neutral-700">{error}</p>
            <button type="button" onClick={() => refreshRef.current()} className="shrink-0 rounded-md p-1.5 text-neutral-600 hover:bg-white" aria-label={localizeCopy('重试加载消息', 'Riprova a caricare i messaggi')}>
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
        {disabled ? (
          <p className="shrink-0 border-t border-neutral-100 bg-neutral-50 px-3 py-3 text-center text-[11px] text-neutral-500">
            演示订单不加载或发送聊天记录。
          </p>
        ) : sendError && <p role="alert" className="border-t border-neutral-100 bg-neutral-50 px-3 py-2 text-[11px] text-neutral-700">{sendError} · {localizeCopy('消息仍保留在输入框中，可再次发送。', 'Il testo è conservato: puoi riprovare.')}</p>}

        {!disabled && <form onSubmit={sendMessage} className="shrink-0 border-t border-neutral-100 p-3">
          <label htmlFor={`order-message-${orderId}`} className="sr-only">{localizeCopy('输入订单消息', 'Scrivi un messaggio ordine')}</label>
          <textarea
            id={`order-message-${orderId}`}
            value={draft}
            onChange={event => {
              if (event.target.value !== draft && sendError) {
                pendingMessageId.current = null;
                setSendError(null);
              }
              setDraft(event.target.value);
            }}
            maxLength={2000}
            rows={2}
            placeholder={localizeCopy('输入消息…', 'Scrivi un messaggio…')}
            className="w-full resize-none rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs leading-5 outline-none transition focus:border-neutral-400 focus:bg-white"
          />
          <div className="mt-2 flex items-center justify-between">
            <span className="text-[10px] text-neutral-400">{draft.length}/2000</span>
            <button
              type="submit"
              disabled={!draft.trim() || sending}
              className="inline-flex items-center gap-2 rounded-xl bg-neutral-950 px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Send className="h-3.5 w-3.5" />
              {sending ? localizeCopy('发送中…', 'Invio…') : localizeCopy('发送', 'Invia')}
            </button>
          </div>
        </form>}
      </div>
    </section>
  );
};

function getErrorMessage(
  error: unknown,
  localizeCopy: (chinese: string, italian: string) => string
): string {
  if (!(error instanceof ApiError)) {
    return error instanceof Error ? error.message : localizeCopy('消息操作失败，请重试。', 'Operazione non riuscita. Riprova.');
  }
  if (error.code === 'ORDER_MESSAGE_TOO_LONG') {
    return localizeCopy('消息不能超过 2000 个字符。', 'Il messaggio non può superare 2000 caratteri.');
  }
  if (error.code === 'ORDER_NOT_FOUND') {
    return localizeCopy('无法访问此订单的消息。', 'Non puoi accedere ai messaggi di questo ordine.');
  }
  return localizeCopy('消息服务暂时不可用，请重试。', 'Servizio messaggi non disponibile. Riprova.');
}
