import React, { useEffect, useMemo, useState } from 'react';
import { Check, Download, ExternalLink, ImagePlus, Loader2, Play, RefreshCw, ShieldCheck, Trash2, WandSparkles } from 'lucide-react';
import { apiGet, apiPost, resolveApiUrl } from '../../../../api/client';

type CollectorResult = { id: string; image: string; sourceUrl: string; pageUrl: string; sourceHost: string; width: number; height: number; bytes: number; qualityScore: number; analysis: { category: string; colors: string[]; materials: string[]; style: string[]; trendTags: string[] }; rightsStatus: 'pending' };
type CollectorJob = { id: string; urls: string[]; status: 'queued' | 'running' | 'completed' | 'failed'; discovered: number; downloaded: number; duplicates: number; failed: number; results: CollectorResult[]; error?: string };

export const WebsiteImageCollector: React.FC = () => {
  const [input, setInput] = useState('');
  const [job, setJob] = useState<CollectorJob | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [starting, setStarting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [message, setMessage] = useState('');
  const [history, setHistory] = useState<Array<Pick<CollectorJob, 'id' | 'status' | 'discovered' | 'downloaded' | 'duplicates' | 'failed'>>>([]);
  const [pollError, setPollError] = useState('');
  const [historyError, setHistoryError] = useState('');
  const [historyLoading, setHistoryLoading] = useState(false);

  const urls = useMemo(() => input.split(/\r?\n|,/).map(value => value.trim()).filter(Boolean), [input]);

  const loadHistory = async () => {
    setHistoryLoading(true);
    setHistoryError('');
    try {
      const result = await apiGet<{ success: true; jobs: Array<Pick<CollectorJob, 'id' | 'status' | 'discovered' | 'downloaded' | 'duplicates' | 'failed'>> }>('/api/admin/website-collector/history');
      setHistory(result.jobs);
    } catch (error) {
      setHistoryError(error instanceof Error ? error.message : '读取采集历史失败');
    } finally {
      setHistoryLoading(false);
    }
  };

  const refreshJob = async (id: string) => {
    setPollError('');
    try {
      const result = await apiGet<{ success: true; job: CollectorJob }>(`/api/admin/website-collector/jobs/${id}`);
      setJob(result.job);
    } catch (error) {
      setPollError(error instanceof Error ? error.message : '刷新采集任务失败');
    }
  };

  useEffect(() => {
    if (!job || !['queued', 'running'].includes(job.status)) return;
    let cancelled = false;
    let timer: number | undefined;
    let retryDelay = 3000;
    const poll = async () => {
      try {
        const result = await apiGet<{ success: true; job: CollectorJob }>(`/api/admin/website-collector/jobs/${job.id}`);
        if (cancelled) return;
        setJob(result.job);
        setPollError('');
        retryDelay = 3000;
      } catch (error) {
        if (cancelled) return;
        setPollError(error instanceof Error ? error.message : '采集状态暂时无法读取，将自动重试');
        retryDelay = Math.min(retryDelay * 2, 30_000);
      }
      if (!cancelled) timer = window.setTimeout(() => void poll(), retryDelay);
    };
    timer = window.setTimeout(() => void poll(), retryDelay);
    return () => {
      cancelled = true;
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [job?.id, job?.status]);

  useEffect(() => {
    void loadHistory();
  }, [job?.status]);

  const start = async () => {
    if (!urls.length || starting) return;
    setStarting(true);
    setMessage('');
    setPollError('');
    try {
      const result = await apiPost<{ success: true; job: CollectorJob }>('/api/admin/website-collector/jobs', { urls });
      setJob(result.job);
      setSelected([]);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '采集任务创建失败');
    } finally {
      setStarting(false);
    }
  };

  const importToGallery = async () => {
    if (!job || !selected.length || importing) return;
    setImporting(true);
    try {
      await apiPost(`/api/admin/website-collector/jobs/${job.id}/import`, { ids: selected });
      setMessage(`已将 ${selected.length} 张图片整理上传到总后台图库，版权状态为“待确认”，请继续编辑后审核发布`);
      setSelected([]);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '导入图库失败');
    } finally {
      setImporting(false);
    }
  };

  const toggle = (id: string) => setSelected(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id]);
  const formatBytes = (bytes: number) => `${(bytes / 1024).toFixed(0)} KB`;

  return <div className="space-y-6">
    <div className="border-b border-neutral-200 pb-5">
      <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.24em] text-neutral-500"><ShieldCheck className="h-4 w-4" /> RUDA AI / Authorized Collector</div>
      <h1 className="mt-3 font-serif text-3xl font-bold tracking-tight">图片采集</h1>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-500">仅处理公开且允许采集的页面。自动识别动态图片、过滤装饰图、去重并把结果送入图库审核。</p>
    </div>
    <section className="border border-neutral-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row"><textarea value={input} onChange={event => setInput(event.target.value)} placeholder="输入一个或多个网站 URL，每行一个，例如：https://brand.example/fashion" className="min-h-12 flex-1 resize-y border border-neutral-300 px-3 py-3 text-sm outline-none focus:border-neutral-900" /><button type="button" onClick={() => void start()} disabled={!urls.length || starting || job?.status === 'running'} className="inline-flex h-12 cursor-pointer items-center justify-center gap-2 bg-neutral-950 px-5 text-xs font-bold text-white hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-40"><Play className="h-4 w-4" />{starting ? '创建中...' : '开始采集'}</button></div>
      <div className="mt-3 flex items-center gap-2 text-[11px] text-neutral-500"><ShieldCheck className="h-3.5 w-3.5 text-neutral-700" />自动遵守 robots.txt，不绕过登录、验证码或网站限制 · 最多 20 个 URL</div>
    </section>
    {job && <section className="border border-neutral-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {([['发现', job.discovered], ['下载', job.downloaded], ['重复', job.duplicates], ['失败', job.failed], ['状态', job.status === 'completed' ? '完成' : job.status === 'running' ? '采集中' : job.status === 'failed' ? '失败' : '排队']] as const).map(([label, value]) => <div key={label} className="border border-neutral-100 bg-neutral-50 p-3"><p className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">{label}</p><p className="mt-2 text-xl font-bold">{value}</p></div>)}
      </div>
      {job.status === 'running' && <div className="mt-4 flex items-center gap-2 text-xs text-neutral-500"><Loader2 className="h-4 w-4 animate-spin" />正在访问公开页面并分析图片...</div>}
      {job.error && <p className="mt-3 text-xs text-neutral-700">{job.error}</p>}
      {pollError && <p role="alert" className="mt-3 rounded-lg border border-neutral-300 bg-neutral-50 p-3 text-xs text-neutral-800">任务状态读取失败：{pollError}。系统会退避重试，也可手动刷新。</p>}
    </section>}
    {job?.results.length ? <section className="border border-neutral-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="mb-4 flex flex-wrap items-center gap-2"><div className="mr-auto"><h2 className="text-sm font-bold">采集结果</h2><p className="mt-1 text-xs text-neutral-500">选择图片后上传到后台图库；需确认授权，不会自动发布。</p></div><button type="button" onClick={() => setSelected(job.results.map(item => item.id))} className="border border-neutral-300 px-3 py-2 text-xs font-semibold cursor-pointer">全选</button><button type="button" onClick={() => setSelected([])} className="border border-neutral-300 px-3 py-2 text-xs font-semibold cursor-pointer">清空</button><button type="button" onClick={() => void importToGallery()} disabled={!selected.length || importing} className="inline-flex items-center gap-2 bg-neutral-950 px-3 py-2 text-xs font-semibold text-white cursor-pointer disabled:opacity-40"><ImagePlus className="h-4 w-4" />{importing ? '上传中...' : `整理并上传 (${selected.length})`}</button></div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">{job.results.map(item => <article key={item.id} className={`group relative overflow-hidden border ${selected.includes(item.id) ? 'border-neutral-900 ring-2 ring-neutral-300' : 'border-neutral-200'}`}><button type="button" onClick={() => toggle(item.id)} className="block w-full cursor-pointer text-left"><img src={item.image} alt={item.sourceUrl} className="aspect-square w-full object-cover" loading="lazy" /><div className="p-2"><div className="flex items-center justify-between gap-2"><p className="truncate text-[10px] font-semibold">{item.analysis.category}</p><span className="text-[10px] font-bold text-neutral-700">{item.qualityScore}/100</span></div><p className="mt-1 truncate text-[10px] text-neutral-500">{item.analysis.colors.join(', ')} · {item.analysis.materials.join(', ')}</p><p className="mt-1 text-[10px] text-neutral-400">{item.width}×{item.height} · {formatBytes(item.bytes)}</p></div></button>{selected.includes(item.id) && <span className="absolute right-2 top-2 bg-neutral-900 p-1 text-white"><Check className="h-3.5 w-3.5" /></span>}<span className="absolute left-2 top-2 bg-black/70 p-1 text-white"><WandSparkles className="h-3.5 w-3.5" /></span><a href={item.sourceUrl} target="_blank" rel="noreferrer" className="absolute bottom-14 right-2 bg-black/75 p-1.5 text-white opacity-0 group-hover:opacity-100" title="打开原图"><ExternalLink className="h-3.5 w-3.5" /></a><a href={item.image} download={`ruda-collected-${item.id}.jpg`} className="absolute bottom-2 right-2 bg-black/75 p-1.5 text-white opacity-0 group-hover:opacity-100" title="下载图片"><Download className="h-3.5 w-3.5" /></a></article>)}</div>
    </section> : job?.status === 'completed' && <section className="flex min-h-48 flex-col items-center justify-center border border-dashed border-neutral-300 bg-white text-center text-sm text-neutral-500"><Trash2 className="mb-2 h-6 w-6 text-neutral-300" />没有符合过滤条件的图片</section>}
    {job && <div className="flex flex-wrap gap-2"><a href={resolveApiUrl(`/api/admin/website-collector/jobs/${encodeURIComponent(job.id)}/export`)} className="inline-flex items-center gap-2 border border-neutral-300 bg-white px-3 py-2 text-xs font-semibold"><Download className="h-4 w-4" />导出 CSV</a><button type="button" onClick={() => void refreshJob(job.id)} className="inline-flex items-center gap-2 border border-neutral-300 bg-white px-3 py-2 text-xs font-semibold cursor-pointer"><RefreshCw className="h-4 w-4" />刷新任务</button></div>}
    <section className="border-t border-neutral-200 pt-5"><div className="flex items-center justify-between"><h2 className="text-sm font-bold">任务历史</h2><button type="button" onClick={() => void loadHistory()} disabled={historyLoading} className="inline-flex items-center gap-2 border border-neutral-300 bg-white px-3 py-2 text-xs font-semibold disabled:opacity-50"><RefreshCw className="h-3.5 w-3.5" />{historyLoading ? '读取中…' : '刷新历史'}</button></div>{historyError && <p role="alert" className="mt-3 rounded-lg border border-neutral-300 bg-neutral-50 p-3 text-xs text-neutral-800">历史记录读取失败：{historyError}</p>}{history.length > 0 && <div className="mt-3 grid gap-2">{history.slice(0, 10).map(item => <button key={item.id} type="button" onClick={() => void refreshJob(item.id).then(() => setSelected([]))} className="flex cursor-pointer items-center gap-3 border border-neutral-200 bg-white px-3 py-2 text-left text-xs hover:border-neutral-500"><span className="font-mono text-[10px] text-neutral-400">{item.id.slice(-8)}</span><span>{item.status}</span><span>发现 {item.discovered}</span><span>下载 {item.downloaded}</span><span>重复 {item.duplicates}</span><span>失败 {item.failed}</span></button>)}</div>}{!historyLoading && !historyError && history.length === 0 && <p className="mt-3 text-xs text-neutral-500">暂无采集历史</p>}</section>
    {message && <p role="status" className="text-xs font-semibold text-neutral-700">{message}</p>}
  </div>;
};
