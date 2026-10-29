import React, { useEffect, useRef, useState } from 'react';
import { Bot, LoaderCircle, MessageCircle, Send, TicketCheck, X } from 'lucide-react';
import { apiGet, apiPost } from '../../../../api/client';
import { useB2B } from '../../../../context/B2BContext';
import { createProductSupportTicketPrefill, type ProductSupportContext } from '../../../../shared/productSupportContext';

type SupportMessage = { role: 'user' | 'assistant'; text: string };

export const PlatformSupportWidget: React.FC = () => {
  const { lang, localizeCopy } = useB2B();
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'ai' | 'ticket'>('ai');
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [input, setInput] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');
  const [ticketBusy, setTicketBusy] = useState(false);
  const [ticketError, setTicketError] = useState('');
  const [ticketSubmitted, setTicketSubmitted] = useState(false);
  const [ticket, setTicket] = useState({ name: '', email: '', phone: '', subject: '', message: '' });
  const endOfMessagesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endOfMessagesRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, aiLoading]);

  useEffect(() => {
    const openSupport = (event: Event) => {
      const detail = (event as CustomEvent<ProductSupportContext>).detail;
      if (detail) {
        const prefill = createProductSupportTicketPrefill(detail);
        setTicket(current => ({ ...current, ...prefill }));
        setTicketError('');
        setTicketSubmitted(false);
      }
      setActiveTab('ticket');
      setOpen(true);
    };
    window.addEventListener('ruda:open-platform-support', openSupport);
    return () => window.removeEventListener('ruda:open-platform-support', openSupport);
  }, []);

  const askSupportAi = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const message = input.trim();
    if (!message || aiLoading) return;
    setInput('');
    setAiError('');
    setMessages(previous => [...previous, { role: 'user', text: message }]);
    setAiLoading(true);
    try {
      const result = await apiPost<{ reply: string }>('/api/ai/support/chat', {
        message,
        language: lang,
        history: messages.slice(-6)
      });
      setMessages(previous => [...previous, { role: 'assistant', text: result.reply }]);
    } catch (error) {
      setAiError(error instanceof Error
        ? error.message
        : localizeCopy('客服暂时无法连接，请稍后再试或提交工单。', 'Assistenza temporaneamente non disponibile. Riprova o invia una richiesta.'));
    } finally {
      setAiLoading(false);
    }
  };

  const submitTicket = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setTicketError('');
    setTicketSubmitted(false);
    if (!ticket.email.trim() && !ticket.phone.trim()) {
      setTicketError(localizeCopy('请至少填写邮箱或联系电话。', 'Inserisci un indirizzo email o un numero di telefono.'));
      return;
    }
    setTicketBusy(true);
    try {
      await apiPost('/api/support-requests', {
        name: ticket.name.trim(),
        email: ticket.email.trim(),
        phone: ticket.phone.trim(),
        subject: ticket.subject.trim(),
        message: ticket.message.trim()
      });
      setTicket(current => ({ ...current, subject: '', message: '' }));
      setTicketSubmitted(true);
    } catch (error) {
      setTicketError(error instanceof Error
        ? error.message
        : localizeCopy('提交失败，请稍后重试。', 'Invio non riuscito. Riprova più tardi.'));
    } finally {
      setTicketBusy(false);
    }
  };

  return (
    <div className="fixed bottom-[calc(5.25rem+env(safe-area-inset-bottom))] right-4 z-[45] flex flex-col items-end gap-2 sm:bottom-6 sm:right-6">
      {open && (
        <section
          aria-label={localizeCopy('RUDA 平台客服', 'Assistenza RUDA')}
          className="flex h-[min(70vh,34rem)] max-h-[calc(100dvh-8rem)] w-[min(22rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-2xl"
        >
          <header className="flex items-center justify-between bg-neutral-950 px-4 py-3 text-white">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10">
                <Bot className="h-4 w-4" />
              </span>
              <div>
                <p className="text-sm font-semibold">{localizeCopy('RUDA 平台客服', 'Assistenza RUDA')}</p>
                <p className="text-[10px] text-neutral-300">{localizeCopy('AI 助手 · 可提交人工工单', 'Assistente AI · richiesta al team')}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label={localizeCopy('关闭客服', 'Chiudi assistenza')}
              className="rounded-full p-1.5 text-neutral-300 transition hover:bg-white/10 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </header>

          <div className="grid grid-cols-2 border-b border-neutral-200">
            <button
              type="button"
              onClick={() => setActiveTab('ai')}
              aria-pressed={activeTab === 'ai'}
              className={`flex min-h-10 items-center justify-center gap-1.5 text-xs font-semibold ${activeTab === 'ai' ? 'border-b-2 border-neutral-950 text-neutral-950' : 'text-neutral-500'}`}
            >
              <MessageCircle className="h-3.5 w-3.5" />
              {localizeCopy('AI 客服', 'Assistente AI')}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('ticket')}
              aria-pressed={activeTab === 'ticket'}
              className={`flex min-h-10 items-center justify-center gap-1.5 text-xs font-semibold ${activeTab === 'ticket' ? 'border-b-2 border-neutral-950 text-neutral-950' : 'text-neutral-500'}`}
            >
              <TicketCheck className="h-3.5 w-3.5" />
              {localizeCopy('提交问题', 'Invia richiesta')}
            </button>
          </div>

          {activeTab === 'ai' ? (
            <>
              <div className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-neutral-50 p-3" aria-live="polite">
                {messages.length === 0 && (
                  <p className="rounded-xl border border-neutral-200 bg-white p-3 text-xs leading-5 text-neutral-700">
                    {localizeCopy('你好，我是 RUDA 平台 AI 客服，可以帮你了解平台功能和批发流程。需要人工跟进时，也可以提交问题和联系方式。', 'Ciao, sono l’assistente AI di RUDA. Posso aiutarti con la piattaforma e gli acquisti wholesale; per un seguito dal team puoi inviare una richiesta con i tuoi recapiti.')}
                  </p>
                )}
                {messages.map((message, index) => (
                  <p
                    key={`${message.role}-${index}`}
                    className={`max-w-[90%] whitespace-pre-wrap rounded-xl px-3 py-2.5 text-xs leading-5 ${message.role === 'user' ? 'ml-auto bg-neutral-950 text-white' : 'border border-neutral-200 bg-white text-neutral-700'}`}
                  >
                    {message.text}
                  </p>
                ))}
                {aiLoading && (
                  <p role="status" className="flex items-center gap-2 text-xs text-neutral-500">
                    <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                    {localizeCopy('客服正在回复…', 'L’assistente sta rispondendo…')}
                  </p>
                )}
                {aiError && <p role="alert" className="text-xs text-rose-700">{aiError}</p>}
                <div ref={endOfMessagesRef} />
              </div>
              <form onSubmit={event => void askSupportAi(event)} className="flex items-center gap-2 border-t border-neutral-200 p-3">
                <input
                  value={input}
                  onChange={event => setInput(event.target.value)}
                  maxLength={2000}
                  aria-label={localizeCopy('输入客服问题', 'Scrivi una domanda')}
                  placeholder={localizeCopy('输入问题…', 'Scrivi una domanda…')}
                  className="min-w-0 flex-1 rounded-lg bg-neutral-100 px-3 py-2.5 text-xs outline-none ring-neutral-300 focus:ring-1"
                />
                <button
                  type="submit"
                  disabled={aiLoading || !input.trim()}
                  aria-label={localizeCopy('发送', 'Invia')}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-neutral-950 text-white disabled:opacity-40"
                >
                  <Send className="h-3.5 w-3.5" />
                </button>
              </form>
            </>
          ) : (
            <form onSubmit={event => void submitTicket(event)} className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
              <p className="text-xs leading-5 text-neutral-600">
                {localizeCopy('留下问题和联系方式，工单会送到 RUDA 平台后台跟进。邮箱或电话至少填写一项，请勿填写密码或验证码。', 'Descrivi il problema e lascia un recapito: la richiesta sarà inviata al team RUDA. Indica email o telefono; non inviare password o codici di verifica.')}
              </p>
              <label className="block text-[11px] font-semibold text-neutral-700">
                {localizeCopy('姓名', 'Nome')}
                <input required maxLength={120} value={ticket.name} onChange={event => setTicket(current => ({ ...current, name: event.target.value }))} className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-xs font-normal outline-none focus:border-neutral-500" />
              </label>
              <label className="block text-[11px] font-semibold text-neutral-700">
                {localizeCopy('邮箱（可选）', 'Email (facoltativa)')}
                <input type="email" maxLength={254} value={ticket.email} onChange={event => setTicket(current => ({ ...current, email: event.target.value }))} className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-xs font-normal outline-none focus:border-neutral-500" />
              </label>
              <label className="block text-[11px] font-semibold text-neutral-700">
                {localizeCopy('联系电话（可选）', 'Telefono (facoltativo)')}
                <input type="tel" maxLength={32} value={ticket.phone} onChange={event => setTicket(current => ({ ...current, phone: event.target.value }))} className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-xs font-normal outline-none focus:border-neutral-500" />
              </label>
              <label className="block text-[11px] font-semibold text-neutral-700">
                {localizeCopy('咨询主题', 'Oggetto')}
                <input required maxLength={120} value={ticket.subject} onChange={event => setTicket(current => ({ ...current, subject: event.target.value }))} className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-xs font-normal outline-none focus:border-neutral-500" />
              </label>
              <label className="block text-[11px] font-semibold text-neutral-700">
                {localizeCopy('问题描述', 'Descrizione')}
                <textarea required minLength={10} maxLength={4000} rows={4} value={ticket.message} onChange={event => setTicket(current => ({ ...current, message: event.target.value }))} className="mt-1 w-full resize-y rounded-lg border border-neutral-200 px-3 py-2 text-xs font-normal outline-none focus:border-neutral-500" />
              </label>
              {ticketError && <p role="alert" className="text-xs text-rose-700">{ticketError}</p>}
              {ticketSubmitted && <p role="status" className="text-xs text-emerald-700">{localizeCopy('问题已提交，RUDA 客服团队会通过你留下的联系方式回复。', 'Richiesta inviata. Il team RUDA ti risponderà usando il recapito indicato.')}</p>}
              <button type="submit" disabled={ticketBusy} className="flex min-h-10 w-full items-center justify-center gap-2 rounded-lg bg-neutral-950 px-3 text-xs font-semibold text-white disabled:cursor-wait disabled:opacity-50">
                {ticketBusy && <LoaderCircle className="h-3.5 w-3.5 animate-spin" />}
                {ticketBusy ? localizeCopy('提交中…', 'Invio…') : localizeCopy('提交给平台客服', 'Invia al team RUDA')}
              </button>
            </form>
          )}
        </section>
      )}

    </div>
  );
};
