import React, { useCallback, useEffect, useState } from 'react';
import { Clock3, Mail, MessageCircle, Phone, RefreshCw, Send } from 'lucide-react';
import { apiGet, apiPost, apiPut } from '../../../../api/client';
import { useB2B } from '../../../../context/B2BContext';
import { getIntlLocale } from '../../../../i18n/translations';
import { AdminPageHeader } from './AdminPageHeader';


type SupportStatus = 'open' | 'in_progress' | 'resolved';

type SupportRequest = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  subject: string;
  message: string;
  status: SupportStatus;
  internalNote: string | null;
  internalNoteUpdatedAt: string | null;
  internalNoteUpdatedBy: string | null;
  customerReply: string | null;
  replyDeliveryStatus: 'not_sent' | 'sending' | 'provider_accepted' | 'failed' | 'no_email';
  replyAttemptedAt: string | null;
  replyAttemptedBy: string | null;
  replyProviderAcceptedAt: string | null;
  replyProviderAcceptedBy: string | null;
  replyDeliveryError: string | null;
  repliedAt: string | null;
  repliedBy: string | null;
  createdAt: string;
};

const supportStatuses: SupportStatus[] = ['open', 'in_progress', 'resolved'];

const statusLabel: Record<SupportStatus, { zh: string; it: string; className: string }> = {
  open: { zh: '待处理', it: 'Aperta', className: 'border border-neutral-300 bg-neutral-100 text-neutral-800' },
  in_progress: { zh: '处理中', it: 'In lavorazione', className: 'border border-neutral-300 bg-white text-neutral-700' },
  resolved: { zh: '已完成', it: 'Risolta', className: 'border border-neutral-200 bg-neutral-50 text-neutral-600' }
};

const isSupportStatus = (value: string): value is SupportStatus => Object.prototype.hasOwnProperty.call(statusLabel, value);

export const AdminSupportRequests: React.FC = () => {
  const { lang, addNotification, localizeCopy } = useB2B();
  const [requests, setRequests] = useState<SupportRequest[]>([]);
  const [filter, setFilter] = useState<'all' | SupportStatus>('all');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [savingId, setSavingId] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [customerReplies, setCustomerReplies] = useState<Record<string, string>>({});
  const isIt = lang === 'it';

  const loadRequests = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const query = filter === 'all' ? '' : `?status=${filter}`;
      const result = await apiGet<{ requests: SupportRequest[] }>(`/api/admin/support-requests${query}`);
      setRequests(result.requests);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : '无法读取客服咨询');
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    void loadRequests();
  }, [loadRequests]);

  const updateRequest = async (id: string, patch: { status?: SupportStatus; internalNote?: string }) => {
    setSavingId(id);
    try {
      const result = await apiPut<{ request: SupportRequest }>(`/api/admin/support-requests/${encodeURIComponent(id)}`, patch);
      setRequests(current => current.map(request => request.id === id ? result.request : request));
      if (patch.internalNote !== undefined) {
        setNotes(current => ({ ...current, [id]: result.request.internalNote || '' }));
      }
      addNotification('success', localizeCopy('客服工单已更新', 'Richiesta aggiornata'), localizeCopy('内部备注和工单状态已保存；备注不会发送给客户。', 'Nota interna e stato sono stati salvati.'));
    } catch (error) {
      addNotification('warning', localizeCopy('保存失败', 'Aggiornamento non riuscito'), error instanceof Error ? error.message : '请稍后重试。');
    } finally {
      setSavingId(null);
    }
  };

  const sendCustomerReply = async (request: SupportRequest, reply: string) => {
    setSavingId(request.id);
    setRequests(current => current.map(item => item.id === request.id ? {
      ...item,
      customerReply: reply,
      replyDeliveryStatus: 'sending'
    } : item));
    try {
      const result = await apiPost<{ request: SupportRequest; deliveryStatus: SupportRequest['replyDeliveryStatus'] }>(
        `/api/admin/support-requests/${encodeURIComponent(request.id)}/reply`,
        { reply }
      );
      setRequests(current => current.map(item => item.id === request.id ? result.request : item));
      setCustomerReplies(current => ({ ...current, [request.id]: result.request.customerReply || '' }));
      if (result.deliveryStatus === 'provider_accepted') {
        addNotification('success', localizeCopy('邮件服务商已接受回复', 'Risposta accettata dal provider email'), localizeCopy('邮件服务商已接受发送请求；这不代表客户邮箱已确认收到。', 'Il provider ha accettato la richiesta; la consegna nella casella del cliente non è confermata.'));
      } else {
        addNotification('warning', localizeCopy('邮件未发送', 'Invio email non riuscito'), localizeCopy('回复已保留，但邮件服务商未接受发送。请检查状态后再重试。', 'La risposta è salvata ma il provider non l’ha accettata. Controlla lo stato prima di riprovare.'));
      }
    } catch (error) {
      addNotification('warning', localizeCopy('邮件操作失败', 'Invio email non riuscito'), error instanceof Error ? error.message : '请稍后检查邮件服务状态。');
    } finally {
      setSavingId(null);
    }
  };

  return (
    <section className="space-y-5">
      <AdminPageHeader title="服务工单" actions={<button type="button" onClick={() => void loadRequests()} disabled={loading} className="inline-flex min-h-9 items-center gap-2 border border-neutral-300 bg-white px-3 text-xs font-semibold text-neutral-700 hover:border-neutral-800 disabled:opacity-50">
        <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> {localizeCopy('刷新', 'Aggiorna')}
      </button>} />

      <div className="flex flex-wrap gap-2" role="group" aria-label={localizeCopy('筛选客服咨询', 'Filtra richieste')}>
        {([
          ['all', localizeCopy('全部', 'Tutte')],
          ['open', localizeCopy('待处理', 'Aperte')],
          ['in_progress', localizeCopy('处理中', 'In lavorazione')],
          ['resolved', localizeCopy('已完成', 'Risolte')]
        ] as const).map(([value, label]) => (
          <button key={value} type="button" aria-pressed={filter === value} onClick={() => setFilter(value)} className={`min-h-9 border px-3 text-xs font-semibold ${filter === value ? 'border-neutral-950 bg-neutral-950 text-white' : 'border-neutral-200 bg-white text-neutral-600 hover:border-neutral-500'}`}>
            {label}
          </button>
        ))}
      </div>

      {loadError && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 border border-neutral-300 bg-neutral-50 px-4 py-3 text-sm text-neutral-800">
          <span>{localizeCopy("读取客服咨询失败：{{RUDA_ARG_0}}", "Impossibile caricare: {{RUDA_ARG_0}}", [String(loadError)])}</span>
          <button type="button" onClick={() => void loadRequests()} className="font-semibold underline">{localizeCopy('重试', 'Riprova')}</button>
        </div>
      )}

      {loading ? (
        <p className="py-12 text-center text-sm text-neutral-500">{localizeCopy('正在读取客服工单...', 'Caricamento richieste...')}</p>
      ) : requests.length === 0 ? (
        <div className="border border-dashed border-neutral-300 bg-white px-5 py-14 text-center text-sm text-neutral-500">
          <MessageCircle className="mx-auto mb-3 h-6 w-6 text-neutral-400" />
          {localizeCopy('当前分类没有客服咨询。', 'Nessuna richiesta in questa categoria.')}
        </div>
      ) : (
        <div className="grid gap-3 xl:grid-cols-2">
          {requests.map(request => {
            const status = statusLabel[request.status];
            const noteDraft = notes[request.id] ?? request.internalNote ?? '';
            const customerReplyDraft = customerReplies[request.id] ?? request.customerReply ?? '';
            const usableEmail = Boolean(request.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(request.email));
            const deliveryStatus = usableEmail ? request.replyDeliveryStatus : 'no_email';
            const replyChanged = customerReplyDraft.trim() !== (request.customerReply || '').trim();
            return (
              <article key={request.id} className="border border-neutral-200 bg-white p-4 sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <span className={`inline-flex px-2.5 py-1 text-[10px] font-semibold ${status.className}`}>{isIt ? status.it : status.zh}</span>
                    <h3 className="mt-2 text-sm font-semibold text-neutral-950">{request.subject}</h3>
                    <p className="mt-1 text-xs text-neutral-500">{request.name} · {new Date(request.createdAt).toLocaleString(getIntlLocale(lang))}</p>
                  </div>
                  <label className="sr-only" htmlFor={`support-status-${request.id}`}>{localizeCopy('工单状态', 'Stato richiesta')}</label>
                  <select id={`support-status-${request.id}`} value={request.status} disabled={savingId === request.id} onChange={event => {
                    const value = event.target.value;
                    if (isSupportStatus(value)) void updateRequest(request.id, { status: value });
                  }} className="min-h-9 border border-neutral-200 bg-white px-2 text-xs font-medium text-neutral-700">
                    {supportStatuses.map(value => <option key={value} value={value}>{isIt ? statusLabel[value].it : statusLabel[value].zh}</option>)}
                  </select>
                </div>

                <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-neutral-700">{request.message}</p>
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 border-t border-neutral-100 pt-3 text-xs text-neutral-500">
                  {request.email && <a className="inline-flex items-center gap-1.5 hover:text-neutral-950" href={`mailto:${encodeURIComponent(request.email)}`}><Mail className="h-3.5 w-3.5" />{request.email}</a>}
                  {request.phone && <a className="inline-flex items-center gap-1.5 hover:text-neutral-950" href={`tel:${encodeURIComponent(request.phone)}`}><Phone className="h-3.5 w-3.5" />{request.phone}</a>}
                </div>

                <div className="mt-4 space-y-4 border-t border-neutral-100 pt-3">
                  <div>
                    <label htmlFor={`support-note-${request.id}`} className="text-xs font-semibold text-neutral-700">{localizeCopy('内部备注（不会发送给客户）', 'Nota interna (non inviata)')}</label>
                    <textarea id={`support-note-${request.id}`} value={noteDraft} onChange={event => setNotes(current => ({ ...current, [request.id]: event.target.value }))} maxLength={4000} rows={2} placeholder={localizeCopy('仅供 RUDA 团队内部查看...', 'Solo per il team RUDA...')} className="mt-2 w-full resize-y border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm" />
                    <div className="mt-2 flex items-center justify-between gap-3">
                      {request.internalNoteUpdatedAt && <span className="inline-flex items-center gap-1 text-[10px] text-neutral-500"><Clock3 className="h-3 w-3" />{localizeCopy('备注更新', 'Nota aggiornata')} · {request.internalNoteUpdatedBy || 'admin'} · {new Date(request.internalNoteUpdatedAt).toLocaleString(getIntlLocale(lang))}</span>}
                      <button type="button" disabled={savingId === request.id || noteDraft === (request.internalNote || '')} onClick={() => void updateRequest(request.id, { internalNote: noteDraft })} className="ml-auto inline-flex min-h-9 items-center gap-1.5 border border-neutral-300 bg-white px-3 text-xs font-semibold text-neutral-800 hover:border-neutral-800 disabled:cursor-not-allowed disabled:opacity-45">
                        {savingId === request.id ? (localizeCopy('保存中...', 'Salvataggio...')) : (localizeCopy('保存内部备注', 'Salva nota interna'))}
                      </button>
                    </div>
                  </div>

                  <div className="border-t border-neutral-100 pt-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <label htmlFor={`support-customer-reply-${request.id}`} className="text-xs font-semibold text-neutral-700">{localizeCopy('客户回复 · 电子邮件', 'Risposta al cliente · Email')}</label>
                      <span className="border border-neutral-300 bg-neutral-100 px-2 py-1 text-[10px] font-semibold text-neutral-800">
                        {deliveryStatus === 'provider_accepted' ? (localizeCopy('服务商已接受（非收件确认）', 'Accettata dal provider'))
                          : deliveryStatus === 'sending' ? (localizeCopy('发送结果待核实', 'Esito da verificare'))
                            : deliveryStatus === 'failed' ? (localizeCopy('服务商未接受', 'Invio non accettato'))
                              : deliveryStatus === 'no_email' ? (localizeCopy('无可用邮箱', 'Email non disponibile'))
                                : (localizeCopy('未发送', 'Non inviata'))}
                      </span>
                    </div>
                    <textarea id={`support-customer-reply-${request.id}`} value={customerReplyDraft} onChange={event => setCustomerReplies(current => ({ ...current, [request.id]: event.target.value }))} maxLength={4000} rows={3} placeholder={localizeCopy('此内容会通过邮件发送给上方显示的客户地址。', 'Questa risposta verrà inviata via email al contatto indicato.')} className="mt-2 w-full resize-y border border-neutral-200 bg-white px-3 py-2 text-sm" />
                    {request.replyDeliveryError && deliveryStatus === 'failed' && <p className="mt-2 text-[11px] text-neutral-600">{localizeCopy('服务商状态', 'Dettaglio provider')}: {request.replyDeliveryError}</p>}
                    {request.replyAttemptedAt && <p className="mt-2 text-[10px] text-neutral-500">{localizeCopy('邮件尝试', 'Tentativo email')} · {request.replyAttemptedBy || 'admin'} · {new Date(request.replyAttemptedAt).toLocaleString(getIntlLocale(lang))}</p>}
                    {request.replyProviderAcceptedAt && <p className="mt-2 text-[10px] text-neutral-500">{localizeCopy('服务商接受时间', 'Accettata dal provider')} · {request.replyProviderAcceptedBy || 'admin'} · {new Date(request.replyProviderAcceptedAt).toLocaleString(getIntlLocale(lang))}. {localizeCopy('未收到收件方送达回执。', 'La consegna al destinatario non è verificata.')}</p>}
                    {deliveryStatus === 'sending' && <p className="mt-2 text-[11px] text-neutral-600">{localizeCopy('为避免重复邮件，请先核实服务商状态，不要立即重发。', 'Verifica il provider prima di inviare di nuovo, per evitare duplicati.')}</p>}
                    <div className="mt-2 flex justify-end">
                      <button type="button" disabled={savingId === request.id || !usableEmail || deliveryStatus === 'sending' || !customerReplyDraft.trim() || (deliveryStatus === 'provider_accepted' && !replyChanged)} onClick={() => void sendCustomerReply(request, customerReplyDraft)} className="inline-flex min-h-9 items-center gap-1.5 bg-neutral-950 px-3 text-xs font-semibold text-white hover:bg-neutral-700 disabled:cursor-not-allowed disabled:opacity-45">
                        <Send className="h-3.5 w-3.5" />
                        {savingId === request.id ? (localizeCopy('发送中...', 'Invio...')) : (localizeCopy('发送客户邮件', 'Invia email al cliente'))}
                      </button>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
};
