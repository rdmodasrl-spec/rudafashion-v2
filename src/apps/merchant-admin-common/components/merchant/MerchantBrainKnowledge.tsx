import React, { useCallback, useEffect, useState } from 'react';
import { BookOpen, Check, Eye, FileText, RefreshCw, ShieldAlert, X } from 'lucide-react';
import { apiGet, apiPatch, apiPost } from '../../../../api/client';
import { useB2B } from '../../../../context/B2BContext';

type BrainDocument = {
  id: string;
  sourceType: string;
  sourceId: string | null;
  title: string;
  mimeType: string | null;
  status: string;
  version: number;
  chunks?: Array<{ id: string; chunkIndex: number; content: string; verificationStatus: string }>;
  updatedAt: string;
};

const statusCopy: Record<string, [string, string]> = {
  ingested: ['待审核', 'Da verificare'],
  published: ['已发布', 'Pubblicato'],
  superseded: ['已被新版本替代', 'Sostituito'],
  rejected: ['已拒绝', 'Rifiutato'],
  invalidated: ['已失效', 'Invalidato']
};

export const MerchantBrainKnowledge: React.FC<{ isIt: boolean }> = ({ isIt }) => {
  const { localizeCopy } = useB2B();
  const [documents, setDocuments] = useState<BrainDocument[]>([]);
  const [selected, setSelected] = useState<BrainDocument | null>(null);
  const [title, setTitle] = useState('');
  const [sourceId, setSourceId] = useState('');
  const [mimeType, setMimeType] = useState<'text/markdown' | 'text/plain'>('text/markdown');
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const loadDocuments = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await apiGet<{ success: true; documents: BrainDocument[] }>('/api/merchant/modagpt/brain/documents');
      setDocuments(result.documents);
    } catch (loadError) {
      setError(loadError instanceof Error
        ? loadError.message
        : localizeCopy('无法读取知识库；请确认已授予知识库读取权限。', 'Impossibile leggere la knowledge base; verifica il permesso.'));
    } finally {
      setLoading(false);
    }
  }, [localizeCopy]);

  useEffect(() => { void loadDocuments(); }, [loadDocuments]);

  const openDocument = async (document: BrainDocument) => {
    setBusy(true);
    setError('');
    try {
      const result = await apiGet<{ success: true; document: BrainDocument }>(
        `/api/merchant/modagpt/brain/documents/${encodeURIComponent(document.id)}`
      );
      setSelected(result.document);
    } catch (openError) {
      setError(openError instanceof Error ? openError.message : localizeCopy('无法读取文档。', 'Impossibile leggere il documento.'));
    } finally {
      setBusy(false);
    }
  };

  const submitDocument = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!title.trim() || !content.trim() || busy) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await apiPost('/api/merchant/modagpt/brain/documents', {
        title: title.trim(),
        sourceId: sourceId.trim() || undefined,
        mimeType,
        content
      });
      setTitle('');
      setSourceId('');
      setContent('');
      setNotice(localizeCopy('文档已进入待审核状态；审核通过前不会作为知识回答。', 'Documento in revisione; non sarà usato prima dell’approvazione.'));
      await loadDocuments();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : localizeCopy('添加文档失败。', 'Impossibile aggiungere il documento.'));
    } finally {
      setBusy(false);
    }
  };

  const reviewDocument = async (document: BrainDocument, decision: 'approve' | 'reject') => {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await apiPatch(
        `/api/merchant/modagpt/brain/documents/${encodeURIComponent(document.id)}/review`,
        { decision }
      );
      setSelected(null);
      await loadDocuments();
    } catch (reviewError) {
      setError(reviewError instanceof Error ? reviewError.message : localizeCopy('审核失败。', 'Revisione non riuscita.'));
    } finally {
      setBusy(false);
    }
  };

  const invalidateDocument = async (document: BrainDocument) => {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await apiPost(`/api/merchant/modagpt/brain/documents/${encodeURIComponent(document.id)}/invalidate`, {});
      setSelected(null);
      await loadDocuments();
    } catch (invalidateError) {
      setError(invalidateError instanceof Error ? invalidateError.message : localizeCopy('失效文档失败。', 'Impossibile invalidare il documento.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="mx-auto w-full max-w-3xl space-y-4 pb-4" aria-label={localizeCopy('ModaUI 知识库', 'Knowledge base ModaUI')}>
      <header className="rounded-3xl border border-neutral-200 bg-white p-4">
        <div className="flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-neutral-800" />
          <h1 className="text-sm font-bold">{localizeCopy('店铺知识库', 'Knowledge base del negozio')}</h1>
        </div>
        <p className="mt-2 text-[11px] leading-5 text-neutral-600">
          {localizeCopy('添加纯文本或 Markdown 资料。新文档必须由有审核权限的员工批准后，AI 才会检索；聊天记录不会自动变成知识。', 'Aggiungi testo semplice o Markdown. I nuovi documenti vengono usati solo dopo l’approvazione; le chat non diventano automaticamente conoscenza.')}
        </p>
      </header>

      {error && <p role="alert" className="rounded-3xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">{error}</p>}
      {notice && <p role="status" className="rounded-3xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">{notice}</p>}

      <form onSubmit={event => void submitDocument(event)} className="space-y-3 rounded-3xl border border-neutral-200 bg-white p-4">
        <h2 className="text-xs font-bold">{localizeCopy('添加知识文档', 'Aggiungi documento')}</h2>
        <input
          required
          maxLength={240}
          value={title}
          onChange={event => setTitle(event.target.value)}
          placeholder={localizeCopy('文档标题', 'Titolo del documento')}
          className="h-10 w-full rounded-2xl border border-neutral-200 px-3 text-xs"
        />
        <input
          maxLength={160}
          value={sourceId}
          onChange={event => setSourceId(event.target.value)}
          placeholder={localizeCopy('来源编号（可选；相同编号用于版本更新）', 'ID fonte (opzionale; riusalo per aggiornare la versione)')}
          className="h-10 w-full rounded-2xl border border-neutral-200 px-3 text-xs"
        />
        <select value={mimeType} onChange={event => setMimeType(event.target.value as typeof mimeType)} className="h-10 rounded-2xl border border-neutral-200 bg-white px-3 text-xs">
          <option value="text/markdown">Markdown</option>
          <option value="text/plain">{localizeCopy('纯文本', 'Testo semplice')}</option>
        </select>
        <textarea
          required
          maxLength={512 * 1024}
          value={content}
          onChange={event => setContent(event.target.value)}
          placeholder={localizeCopy('粘贴已确认的商品说明、尺寸规则、店铺政策或常见问答…', 'Incolla informazioni verificate su prodotti, taglie, politiche o FAQ…')}
          className="min-h-36 w-full resize-y rounded-2xl border border-neutral-200 p-3 text-xs leading-5"
        />
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] text-neutral-500">{localizeCopy('上限 512 KB；禁止上传密码、付款资料或未经授权的客户信息。', 'Massimo 512 KB; non inserire password, dati di pagamento o dati cliente non autorizzati.')}</span>
          <button type="submit" disabled={busy || !title.trim() || !content.trim()} className="shrink-0 rounded-2xl bg-neutral-950 px-4 py-2 text-xs font-semibold text-white hover:bg-neutral-800 disabled:opacity-40">
            {busy ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : localizeCopy('提交审核', 'Invia per revisione')}
          </button>
        </div>
      </form>

      <section className="overflow-hidden rounded-3xl border border-neutral-200 bg-white">
        <div className="flex items-center justify-between border-b border-neutral-100 p-4">
          <h2 className="text-xs font-bold">{localizeCopy('文档与审核状态', 'Documenti e stato revisione')}</h2>
          <button type="button" onClick={() => void loadDocuments()} disabled={loading} aria-label={localizeCopy('刷新知识文档', 'Aggiorna documenti')} className="rounded-xl p-2 text-neutral-500 hover:bg-neutral-50 disabled:opacity-40">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
        {loading ? <p className="p-4 text-xs text-neutral-500">{localizeCopy('正在读取…', 'Caricamento…')}</p>
          : documents.length ? <div className="divide-y divide-neutral-100">{documents.map(document => (
            <article key={document.id} className="flex items-center gap-3 p-4">
              <FileText className="h-4 w-4 shrink-0 text-neutral-400" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold">{document.title}</p>
                <p className="mt-1 text-[10px] text-neutral-500">
                  {statusCopy[document.status]?.[isIt ? 1 : 0] || document.status} · v{document.version} · {document.mimeType || 'text'}
                </p>
              </div>
              <button type="button" onClick={() => void openDocument(document)} disabled={busy} className="inline-flex h-9 items-center gap-1 rounded-xl border border-neutral-200 px-3 text-[10px] font-semibold text-neutral-700 hover:bg-neutral-50">
                <Eye className="h-3 w-3" />{localizeCopy('查看', 'Apri')}
              </button>
            </article>
          ))}</div> : <p className="p-4 text-xs text-neutral-500">{localizeCopy('还没有知识文档。', 'Nessun documento presente.')}</p>}
      </section>

      {selected && <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/40 p-3 sm:items-center" role="presentation" onClick={() => setSelected(null)}>
        <section role="dialog" aria-modal="true" aria-label={selected.title} onClick={event => event.stopPropagation()} className="max-h-[85dvh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white p-4 shadow-2xl">
          <div className="flex items-start justify-between gap-3">
            <div><h2 className="text-sm font-bold">{selected.title}</h2><p className="mt-1 text-[10px] text-neutral-500">{selected.status} · v{selected.version}</p></div>
            <button type="button" onClick={() => setSelected(null)} aria-label={localizeCopy('关闭', 'Chiudi')} className="rounded-xl p-2 hover:bg-neutral-50"><X className="h-4 w-4" /></button>
          </div>
          <div className="mt-4 space-y-3">{selected.chunks?.map(chunk => <pre key={chunk.id} className="whitespace-pre-wrap break-words rounded-2xl bg-neutral-50 p-3 text-xs leading-5 text-neutral-700">{chunk.content}</pre>)}</div>
          <div className="mt-4 flex flex-wrap justify-end gap-2 border-t border-neutral-100 pt-3">
            {selected.status === 'ingested' && <>
              <button type="button" disabled={busy} onClick={() => void reviewDocument(selected, 'reject')} className="inline-flex h-9 items-center gap-1 rounded-xl border border-rose-200 px-3 text-xs font-semibold text-rose-700 hover:bg-rose-50"><X className="h-3.5 w-3.5" />{localizeCopy('拒绝', 'Rifiuta')}</button>
              <button type="button" disabled={busy} onClick={() => void reviewDocument(selected, 'approve')} className="inline-flex h-9 items-center gap-1 rounded-xl bg-emerald-800 px-3 text-xs font-semibold text-white hover:bg-emerald-900"><Check className="h-3.5 w-3.5" />{localizeCopy('审核并发布', 'Approva e pubblica')}</button>
            </>}
            {selected.status === 'published' && <button type="button" disabled={busy} onClick={() => void invalidateDocument(selected)} className="inline-flex h-9 items-center gap-1 rounded-xl border border-amber-200 px-3 text-xs font-semibold text-amber-800 hover:bg-amber-50"><ShieldAlert className="h-3.5 w-3.5" />{localizeCopy('使知识失效', 'Invalida conoscenza')}</button>}
          </div>
        </section>
      </div>}
    </section>
  );
};
