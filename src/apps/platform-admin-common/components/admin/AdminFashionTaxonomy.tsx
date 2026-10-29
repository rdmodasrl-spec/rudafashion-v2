import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, LoaderCircle, Merge, Plus, RefreshCw, Tag, Tags } from 'lucide-react';
import { apiGet, apiPatch, apiPost } from '../../../../api/client';

type TaxonomyTerm = {
  id: string;
  kind: 'category' | 'tag';
  name: string;
  slug: string;
  status: 'active' | 'disabled' | 'merged';
  mergedInto: string | null;
  sortOrder: number;
  usage: number;
};

type TaxonomyResponse = { success: boolean; terms: TaxonomyTerm[] };

const statusLabels: Record<TaxonomyTerm['status'], string> = {
  active: '启用',
  disabled: '停用',
  merged: '已合并'
};

const statusClass: Record<TaxonomyTerm['status'], string> = {
  active: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  disabled: 'border-neutral-200 bg-neutral-100 text-neutral-600',
  merged: 'border-sky-200 bg-sky-50 text-sky-700'
};

export const AdminFashionTaxonomy: React.FC = () => {
  const [kind, setKind] = useState<'category' | 'tag'>('category');
  const [terms, setTerms] = useState<TaxonomyTerm[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [draftName, setDraftName] = useState('');
  const [draftSlug, setDraftSlug] = useState('');
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [mergeSourceId, setMergeSourceId] = useState<string | null>(null);
  const [mergeTargetId, setMergeTargetId] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await apiGet<TaxonomyResponse>('/api/admin/fashion/taxonomy?kind=all');
      setTerms(result.terms || []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '分类与标签加载失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const visibleTerms = useMemo(() => terms.filter(term => term.kind === kind), [terms, kind]);
  const activeTargets = useMemo(() => visibleTerms.filter(term => term.status === 'active'), [visibleTerms]);
  const mergeSource = terms.find(term => term.id === mergeSourceId) || null;

  const createTerm = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const name = draftName.trim();
    if (!name) return;
    setBusy('create');
    setError('');
    setNotice('');
    try {
      await apiPost('/api/admin/fashion/taxonomy', {
        kind,
        name,
        ...(draftSlug.trim() ? { slug: draftSlug.trim() } : {}),
        sortOrder: (visibleTerms.length + 1) * 10
      });
      setDraftName('');
      setDraftSlug('');
      setNotice(kind === 'category' ? '分类已创建，发布与筛选立即可用。' : '标签已创建。');
      await load();
    } catch (createError) {
      const message = createError instanceof Error ? createError.message : '';
      setError(message.includes('FASHION_TAXONOMY_TERM_EXISTS') ? '同名或同别名的词条已存在。' : message || '创建失败');
    } finally {
      setBusy(null);
    }
  };

  const updateTerm = async (term: TaxonomyTerm, payload: { name?: string; status?: 'active' | 'disabled' }) => {
    setBusy(term.id);
    setError('');
    setNotice('');
    try {
      const result = await apiPatch<{ success: boolean; affectedPosts: number }>(
        `/api/admin/fashion/taxonomy/${term.id}`,
        payload
      );
      setNotice(payload.name
        ? `已重命名，同步更新 ${result.affectedPosts} 条作品。`
        : payload.status === 'disabled' ? '已停用，发布与筛选不再提供该词条。' : '已重新启用。');
      setRenameId(null);
      await load();
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : '更新失败');
    } finally {
      setBusy(null);
    }
  };

  const mergeTerm = async () => {
    if (!mergeSource || !mergeTargetId) return;
    setBusy(mergeSource.id);
    setError('');
    setNotice('');
    try {
      const result = await apiPost<{ success: boolean; affectedPosts: number; mergedInto: { name: string } }>(
        `/api/admin/fashion/taxonomy/${mergeSource.id}/merge`,
        { targetId: mergeTargetId }
      );
      setNotice(`已合并到「${result.mergedInto.name}」，迁移 ${result.affectedPosts} 条作品。`);
      setMergeSourceId(null);
      setMergeTargetId('');
      await load();
    } catch (mergeError) {
      setError(mergeError instanceof Error ? mergeError.message : '合并失败');
    } finally {
      setBusy(null);
    }
  };
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex rounded-full border border-neutral-200 p-0.5 text-[11px]">
          <button
            type="button"
            onClick={() => setKind('category')}
            className={`inline-flex items-center gap-1 rounded-full px-3 py-1 ${kind === 'category' ? 'bg-neutral-900 text-white' : 'text-neutral-600'}`}
          >
            <Tags className="h-3 w-3" />分类
          </button>
          <button
            type="button"
            onClick={() => setKind('tag')}
            className={`inline-flex items-center gap-1 rounded-full px-3 py-1 ${kind === 'tag' ? 'bg-neutral-900 text-white' : 'text-neutral-600'}`}
          >
            <Tag className="h-3 w-3" />标签
          </button>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="inline-flex h-8 items-center gap-1.5 rounded-full border border-neutral-200 px-3 text-[11px] font-medium text-neutral-700 hover:bg-neutral-50"
        >
          <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />刷新
        </button>
      </div>

      {error && <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-[11px] text-rose-700">{error}</p>}
      {notice && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-[11px] text-emerald-800">{notice}</p>}

      <form onSubmit={event => void createTerm(event)} className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_160px_auto]">
        <label className="block">
          <span className="sr-only">{kind === 'category' ? '分类名称' : '标签名称'}</span>
          <input
            value={draftName}
            onChange={event => setDraftName(event.target.value.slice(0, 24))}
            placeholder={kind === 'category' ? '新增分类名称' : '新增标签名称'}
            className="h-9 w-full rounded-lg border border-neutral-200 px-3 text-xs outline-none focus:border-neutral-800"
          />
        </label>
        <label className="block">
          <span className="sr-only">英文别名</span>
          <input
            value={draftSlug}
            onChange={event => setDraftSlug(event.target.value.slice(0, 40))}
            placeholder="英文别名（可选）"
            className="h-9 w-full rounded-lg border border-neutral-200 px-3 text-xs outline-none focus:border-neutral-800"
          />
        </label>
        <button
          type="submit"
          disabled={busy === 'create' || !draftName.trim()}
          className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-neutral-900 px-4 text-xs font-semibold text-white disabled:opacity-40"
        >
          {busy === 'create' ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}新增
        </button>
      </form>
      {loading && !terms.length ? (
        <div className="flex justify-center py-10"><LoaderCircle className="h-5 w-5 animate-spin text-neutral-400" /></div>
      ) : visibleTerms.length === 0 ? (
        <p className="py-10 text-center text-[11px] text-neutral-500">暂无{kind === 'category' ? '分类' : '标签'}。</p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-neutral-200">
          <table className="w-full text-left text-[11px]">
            <thead className="bg-neutral-50 text-neutral-500">
              <tr>
                <th className="px-3 py-2 font-medium">名称</th>
                <th className="px-3 py-2 font-medium">作品数</th>
                <th className="px-3 py-2 font-medium">状态</th>
                <th className="px-3 py-2 font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {visibleTerms.map(term => (
                <tr key={term.id} className="border-t border-neutral-100 align-middle">
                  <td className="px-3 py-2">
                    {renameId === term.id ? (
                      <div className="flex items-center gap-1.5">
                        <input
                          value={renameValue}
                          onChange={event => setRenameValue(event.target.value.slice(0, 24))}
                          className="h-8 w-36 rounded-md border border-neutral-300 px-2 text-[11px] outline-none focus:border-neutral-800"
                          aria-label="新名称"
                        />
                        <button
                          type="button"
                          onClick={() => void updateTerm(term, { name: renameValue.trim() })}
                          disabled={!renameValue.trim() || busy === term.id}
                          className="inline-flex h-8 items-center gap-1 rounded-md bg-neutral-900 px-2 text-[11px] text-white disabled:opacity-40"
                        >
                          <Check className="h-3 w-3" />保存
                        </button>
                        <button type="button" onClick={() => setRenameId(null)} className="text-[11px] text-neutral-500">取消</button>
                      </div>
                    ) : (
                      <div>
                        <p className="font-medium text-neutral-900">{term.name}</p>
                        <p className="text-[10px] text-neutral-400">{term.slug}</p>
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2 text-neutral-700">{term.usage}</td>
                  <td className="px-3 py-2">
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] ${statusClass[term.status]}`}>
                      {statusLabels[term.status]}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {term.status !== 'merged' && (
                        <button
                          type="button"
                          onClick={() => { setRenameId(term.id); setRenameValue(term.name); }}
                          disabled={busy === term.id}
                          className="rounded-md border border-neutral-200 px-2 py-1 text-[10px] text-neutral-700 hover:bg-neutral-50 disabled:opacity-40"
                        >重命名</button>
                      )}
                      {term.status === 'active' && (
                        <button
                          type="button"
                          onClick={() => void updateTerm(term, { status: 'disabled' })}
                          disabled={busy === term.id}
                          className="rounded-md border border-neutral-200 px-2 py-1 text-[10px] text-neutral-700 hover:bg-neutral-50 disabled:opacity-40"
                        >停用</button>
                      )}
                      {term.status === 'disabled' && (
                        <button
                          type="button"
                          onClick={() => void updateTerm(term, { status: 'active' })}
                          disabled={busy === term.id}
                          className="rounded-md border border-neutral-200 px-2 py-1 text-[10px] text-neutral-700 hover:bg-neutral-50 disabled:opacity-40"
                        >启用</button>
                      )}
                      {term.status === 'active' && (
                        <button
                          type="button"
                          onClick={() => { setMergeSourceId(term.id); setMergeTargetId(''); }}
                          className="inline-flex items-center gap-1 rounded-md border border-neutral-200 px-2 py-1 text-[10px] text-neutral-700 hover:bg-neutral-50"
                        >
                          <Merge className="h-2.5 w-2.5" />合并
                        </button>
                      )}
                      {term.status === 'merged' && term.mergedInto && (
                        <span className="text-[10px] text-neutral-400">
                          已并入 {terms.find(candidate => candidate.id === term.mergedInto)?.name || '其他词条'}
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {mergeSource && (
        <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-3">
          <p className="text-[11px] font-semibold text-neutral-900">合并「{mergeSource.name}」到</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <select
              value={mergeTargetId}
              onChange={event => setMergeTargetId(event.target.value)}
              className="h-8 rounded-md border border-neutral-200 bg-white px-2 text-[11px]"
              aria-label="合并目标"
            >
              <option value="">选择目标词条</option>
              {activeTargets.filter(term => term.id !== mergeSource.id).map(term => (
                <option key={term.id} value={term.id}>{term.name}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => void mergeTerm()}
              disabled={!mergeTargetId || busy === mergeSource.id}
              className="inline-flex h-8 items-center gap-1 rounded-md bg-neutral-900 px-3 text-[11px] font-medium text-white disabled:opacity-40"
            >
              {busy === mergeSource.id ? <LoaderCircle className="h-3 w-3 animate-spin" /> : <Merge className="h-3 w-3" />}确认合并
            </button>
            <button type="button" onClick={() => { setMergeSourceId(null); setMergeTargetId(''); }} className="text-[11px] text-neutral-500">取消</button>
          </div>
          <p className="mt-2 text-[10px] leading-4 text-neutral-500">合并会把该词条下的作品迁移到目标词条，原词条保留为“已合并”记录，可追溯。</p>
        </div>
      )}
    </div>
  );
};



