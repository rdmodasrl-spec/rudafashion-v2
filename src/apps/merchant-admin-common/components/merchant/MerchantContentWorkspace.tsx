import React, { useEffect, useRef, useState } from 'react';
import { Check, Copy, FolderOpen, Plus, Sparkles, Trash2 } from 'lucide-react';
import { useB2B } from '../../../../context/B2BContext';
import { fetchMerchantWorkspaceDrafts, saveMerchantWorkspaceDraft } from '../../../../shared/merchantWorkspaceDraftClient';


export type ContentKind = 'metaobject' | 'page' | 'blog' | 'menu';
type ContentDraft = {
  id: string;
  kind: ContentKind;
  title: string;
  brief: string;
  body: string;
  updatedAt: string;
};

const contentKinds: Array<{ id: ContentKind; label: string }> = [
  { id: 'metaobject', label: '元对象 / 产品元字段' },
  { id: 'page', label: '店铺页面' },
  { id: 'blog', label: '博客文章' },
  { id: 'menu', label: '菜单结构' }
];

const storageKey = (merchantId: string) => `ruda-merchant-content-drafts:${merchantId}`;
const isContentKind = (value: unknown): value is ContentKind => contentKinds.some(kind => kind.id === value);

export const MerchantContentWorkspace: React.FC<{
  merchantId: string;
  merchantName: string;
  isIt: boolean;
  section: ContentKind;
  generateCopy: (prompt: string) => Promise<string | null>;
  addNotification: (type: 'success' | 'warning' | 'info', title: string, message: string) => void;
}> = ({ merchantId, merchantName, isIt, section, generateCopy, addNotification }) => {
  const { localizeCopy } = useB2B();
  const [title, setTitle] = useState('');
  const [brief, setBrief] = useState('');
  const [audience, setAudience] = useState('');
  const [tone, setTone] = useState('简洁专业');
  const [keywords, setKeywords] = useState('');
  const [callToAction, setCallToAction] = useState('');
  const [language, setLanguage] = useState<'zh' | 'it' | 'en'>(isIt ? 'it' : 'zh');
  const [drafts, setDrafts] = useState<ContentDraft[]>([]);
  const [busy, setBusy] = useState(false);
  const [workingDraftId, setWorkingDraftId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const draftsRef = useRef<ContentDraft[]>([]);
  const localDirtyRef = useRef(false);
  const syncGenerationRef = useRef(0);
  const revisionRef = useRef(0);
  const remoteReadyRef = useRef(false);
  const remoteBlockedRef = useRef(false);
  const remoteSaveQueueRef = useRef<Promise<void>>(Promise.resolve());
  const selectedKind = contentKinds.find(item => item.id === section);

  useEffect(() => {
    let active = true;
    const generation = ++syncGenerationRef.current;
    remoteReadyRef.current = false;
    remoteBlockedRef.current = false;
    localDirtyRef.current = false;
    revisionRef.current = 0;
    let localDrafts: ContentDraft[] = [];
    try {
      const stored = window.localStorage.getItem(storageKey(merchantId));
      const parsed: unknown = stored ? JSON.parse(stored) : [];
      if (!Array.isArray(parsed)) throw new Error('INVALID_CONTENT_DRAFT_STORAGE');
      localDrafts = parsed.filter((item): item is ContentDraft =>
        Boolean(item && typeof item === 'object'
          && typeof item.id === 'string'
          && isContentKind(item.kind)
          && typeof item.title === 'string'
          && typeof item.brief === 'string'
          && typeof item.body === 'string'
          && typeof item.updatedAt === 'string')
      ).slice(0, 100);
      draftsRef.current = localDrafts;
      setDrafts(localDrafts);
    } catch (error) {
      console.error('[merchant-content-drafts-local-read]', error);
      draftsRef.current = [];
      setDrafts([]);
      addNotification('warning', '内容草稿读取失败', '请刷新页面重试；已保存的草稿未被修改。');
    }
    void fetchMerchantWorkspaceDrafts().then(remoteDrafts => {
      if (!active) return;
      const remoteDraft = remoteDrafts.content;
      revisionRef.current = remoteDraft?.revision || 0;
      const remoteContentDrafts = Array.isArray(remoteDraft?.document.drafts)
        ? remoteDraft.document.drafts.filter((item): item is ContentDraft =>
          Boolean(item && typeof item === 'object'
            && typeof item.id === 'string'
            && isContentKind(item.kind)
            && typeof item.title === 'string'
            && typeof item.brief === 'string'
            && typeof item.body === 'string'
            && typeof item.updatedAt === 'string'))
        : [];
      const mergedById = new Map<string, ContentDraft>();
      for (const draft of [...remoteContentDrafts, ...draftsRef.current]) {
        const existing = mergedById.get(draft.id);
        if (!existing || Date.parse(draft.updatedAt) >= Date.parse(existing.updatedAt)) mergedById.set(draft.id, draft);
      }
      const merged = [...mergedById.values()]
        .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt))
        .slice(0, 100);
      localDirtyRef.current = JSON.stringify(merged) !== JSON.stringify(remoteContentDrafts);
      draftsRef.current = merged;
      setDrafts(merged);
      try {
        window.localStorage.setItem(storageKey(merchantId), JSON.stringify(merged));
      } catch (error) {
        console.error('[merchant-content-drafts-local-cache]', error);
        addNotification('warning', '本地草稿缓存失败', '草稿已从服务器读取，但此设备无法缓存副本。');
      }
      remoteReadyRef.current = true;
      if (JSON.stringify(merged) !== JSON.stringify(remoteContentDrafts)) {
        remoteSaveQueueRef.current = remoteSaveQueueRef.current.then(async () => {
          if (syncGenerationRef.current !== generation) return;
          const result = await saveMerchantWorkspaceDraft('content', { drafts: merged }, revisionRef.current);
          if (syncGenerationRef.current === generation) {
            revisionRef.current = result.revision;
            if (JSON.stringify(draftsRef.current) === JSON.stringify(merged)) localDirtyRef.current = false;
          }
        }).catch(error => {
          if (syncGenerationRef.current !== generation) return;
          remoteBlockedRef.current = true;
          console.error('[merchant-content-drafts-sync]', error);
          addNotification('warning', '内容草稿同步失败', '本地草稿已保留；请重新打开内容工作区后重试。');
        });
      }
    }).catch(error => {
      if (!active) return;
      console.error('[merchant-content-drafts-remote-read]', error);
      addNotification('warning', '云端草稿读取失败', '本地草稿仍可使用；重新打开工作区后可重试同步。');
    });
    const onMerchantDataChanged = (event: Event) => {
      const resources = (event as CustomEvent<{ resources?: unknown[] }>).detail?.resources;
      if (!active || !remoteReadyRef.current || localDirtyRef.current
        || !Array.isArray(resources) || !resources.includes('content')) return;
      void fetchMerchantWorkspaceDrafts().then(remoteDrafts => {
        if (!active || localDirtyRef.current) return;
        const remote = remoteDrafts.content;
        if (!remote || remote.revision <= revisionRef.current) return;
        const refreshed = Array.isArray(remote.document.drafts)
          ? remote.document.drafts.filter((item): item is ContentDraft =>
            Boolean(item && typeof item === 'object'
              && typeof item.id === 'string' && isContentKind(item.kind)
              && typeof item.title === 'string' && typeof item.brief === 'string'
              && typeof item.body === 'string' && typeof item.updatedAt === 'string')).slice(0, 100)
          : [];
        revisionRef.current = remote.revision;
        draftsRef.current = refreshed;
        setDrafts(refreshed);
        try {
          window.localStorage.setItem(storageKey(merchantId), JSON.stringify(refreshed));
        } catch (error) {
          console.error('[merchant-content-drafts-local-cache]', error);
          addNotification('warning', '本地草稿缓存失败', '最新草稿已载入，但此设备无法缓存副本。');
        }
      }).catch(error => {
        console.error('[merchant-content-drafts-remote-refresh]', error);
        addNotification('warning', '内容草稿刷新失败', '请重新打开内容工作区以载入最新云端版本。');
      });
    };
    window.addEventListener('merchant-data-changed', onMerchantDataChanged);
    return () => {
      active = false;
      window.removeEventListener('merchant-data-changed', onMerchantDataChanged);
      if (syncGenerationRef.current === generation) syncGenerationRef.current++;
    };
  }, [merchantId, addNotification]);

  const persist = (next: ContentDraft[]) => {
    try {
      window.localStorage.setItem(storageKey(merchantId), JSON.stringify(next));
      draftsRef.current = next;
      localDirtyRef.current = true;
      setDrafts(next);
      if (remoteReadyRef.current && !remoteBlockedRef.current) {
        const generation = syncGenerationRef.current;
        remoteSaveQueueRef.current = remoteSaveQueueRef.current.then(async () => {
          if (syncGenerationRef.current !== generation) return;
          const result = await saveMerchantWorkspaceDraft('content', { drafts: next }, revisionRef.current);
          if (syncGenerationRef.current === generation) {
            revisionRef.current = result.revision;
            if (JSON.stringify(draftsRef.current) === JSON.stringify(next)) localDirtyRef.current = false;
          }
        }).catch(error => {
          if (syncGenerationRef.current !== generation) return;
          remoteBlockedRef.current = true;
          console.error('[merchant-content-drafts-sync]', error);
          addNotification('warning', '云端同步失败', '本地草稿已保留；检测到版本冲突或网络错误，请重新打开工作区后重试。');
        });
      }
      return true;
    } catch (error) {
      console.error('[merchant-content-drafts-local-save]', error);
      addNotification('warning', '内容草稿保存失败', '设备可用空间不足，请清理空间后重试。');
      return false;
    }
  };

  const generateDraft = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy || !title.trim() || !brief.trim()) return;
    const languageName = language === 'it' ? '意大利语' : language === 'en' ? '英语' : '中文';
    const outputInstructions = section === 'metaobject'
      ? [
        '先给出“推荐存储方式：产品元字段 / 元对象 / 两者组合”三选一，并解释理由。',
        '判定原则：只描述单个产品自身的简单属性（如成分、护理说明、产地）优先用产品元字段；需要维护多条可复用、独立更新或被多个产品/页面引用的结构化记录（如设计师档案、尺码指南、材料档案、FAQ 条目）优先用元对象；产品只保存对共享元对象的引用时建议组合使用。',
        '若推荐元对象，输出定义名称、用途、建议访问范围、稳定的机器键，以及字段列表（机器键、标签、类型、必填建议、填写提示）和一条明确标记为示例的条目。',
        '若推荐产品元字段，输出命名空间、机器键、字段标签、建议数据类型、适用产品范围及示例值；不要把它伪装成元对象定义。',
        '若需求信息不足，先列出需要商家确认的问题，再给出带假设标记的暂定方案。字段类型只使用文本、富文本、数字、布尔、日期、URL、图片或引用等常见类型；不得声称这些内容已在店铺中创建或配置。'
      ].join(' ')
      : section === 'menu'
        ? '输出清晰的一级/二级菜单树，用缩进层级展示；逐项给出菜单标签、目标页面类型和待确认链接。全部标注为规划建议，不得暗示它们已存在。'
        : section === 'blog'
          ? '按可直接编辑的格式输出：文章标题、摘要、引言、带小标题的正文、结尾行动引导、SEO 标题（建议不超过 60 字符）和 SEO 描述（建议不超过 160 字符）。'
          : '按可直接编辑的格式输出：页面标题、清晰的小节正文、结尾行动引导、SEO 标题（建议不超过 60 字符）和 SEO 描述（建议不超过 160 字符）。';
    const prompt = [
      `你是 RUDA 商家店铺内容助手，为商家「${merchantName}」准备一份${selectedKind?.label}草稿。`,
      `内容目标与已知信息：${brief.trim().slice(0, 2000)}`,
      audience.trim() ? `目标受众：${audience.trim().slice(0, 300)}` : '',
      `表达语气：${tone}。`,
      keywords.trim() ? `希望自然覆盖的关键词：${keywords.trim().slice(0, 300)}。不要堆砌关键词。` : '',
      callToAction.trim() ? `期望的行动引导：${callToAction.trim().slice(0, 300)}` : '',
      outputInstructions,
      `使用${languageName}。先满足可读性、准确性和实际可用性。`,
      '不得编造商家资质、营业地址、产品材质、认证、价格、库存、配送/退货承诺或已上线内容；未提供的事实用“待商家补充”标出。不要把规划、示例或建议描述成店铺已有信息。',
      '仅生成供商家审阅的草稿，不声称已查询或修改现有菜单、页面、博客或自定义信息，不发布、不保存到线上。'
    ].filter(Boolean).join('\n');
    setBusy(true);
    try {
      const body = await generateCopy(prompt);
      if (!body?.trim()) {
        addNotification('warning', 'AI 暂未生成草稿', '请重试或缩短内容要求；线上内容没有发生变化。');
        return;
      }
      const draft: ContentDraft = {
        id: crypto.randomUUID(),
        kind: section,
        title: title.trim().slice(0, 120),
        brief: brief.trim().slice(0, 2000),
        body: body.trim().slice(0, 16000),
        updatedAt: new Date().toISOString()
      };
      if (persist([draft, ...drafts].slice(0, 100))) {
        setTitle('');
        setBrief('');
        setAudience('');
        setKeywords('');
        setCallToAction('');
        addNotification('success', '内容草稿已准备', '可继续优化或复制内容；网店尚未更新。');
      }
    } catch (error) {
      addNotification('warning', '内容生成失败', `${error instanceof Error ? error.message : '请稍后重试'}；网店内容没有变化。`);
    } finally {
      setBusy(false);
    }
  };

  const refineDraft = async (draft: ContentDraft, goal: 'polish' | 'seo') => {
    if (busy) return;
    const goalInstructions = goal === 'seo'
      ? '重点优化搜索意图匹配、标题层级、自然关键词使用和 SEO 标题/描述。不要承诺排名，不要添加未经提供的事实。'
      : '重点改善清晰度、语法、可读性和结构，保留原意、已有事实、内容类型和语言。不要添加未经提供的事实。';
    const prompt = [
      `请对以下 RUDA 店铺${contentKinds.find(item => item.id === draft.kind)?.label}草稿进行${goal === 'seo' ? 'SEO 优化' : '表达润色'}。`,
      goalInstructions,
      '输出完整的优化后草稿，不要说明你访问过线上店铺，不要发布或修改内容。',
      `草稿名称：${draft.title}`,
      `原始需求：${draft.brief}`,
      '草稿正文：',
      draft.body
    ].join('\n\n');
    setBusy(true);
    setWorkingDraftId(draft.id);
    try {
      const body = await generateCopy(prompt);
      if (!body?.trim()) {
        addNotification('warning', 'AI 暂未完成优化', '请重试；原草稿保持不变。');
        return;
      }
      const versionLabel = goal === 'seo' ? 'SEO 优化版' : '润色版';
      const refinedDraft: ContentDraft = {
        ...draft,
        id: crypto.randomUUID(),
        title: `${draft.title.slice(0, Math.max(0, 120 - versionLabel.length - 3))} - ${versionLabel}`,
        body: body.trim().slice(0, 16000),
        updatedAt: new Date().toISOString()
      };
      if (persist([refinedDraft, ...drafts].slice(0, 100))) {
        addNotification('success', '草稿优化完成', '已另存为新版本；原草稿未被覆盖。');
      }
    } catch (error) {
      addNotification('warning', '草稿优化失败', `${error instanceof Error ? error.message : '请稍后重试'}；原草稿保持不变。`);
    } finally {
      setWorkingDraftId(null);
      setBusy(false);
    }
  };

  const copyDraft = async (draft: ContentDraft) => {
    try {
      await navigator.clipboard.writeText(draft.body);
      setCopiedId(draft.id);
      window.setTimeout(() => setCopiedId(null), 1800);
    } catch (error) {
      addNotification('warning', '复制内容失败', '请检查设备的剪贴板权限后重试。');
    }
  };

  const deleteDraft = (draft: ContentDraft) => {
    if (!window.confirm(`确定删除草稿「${draft.title}」吗？`)) return;
    persist(drafts.filter(item => item.id !== draft.id));
  };

  return (
    <div className="space-y-4">
      <header className="merchant-home-intro relative overflow-hidden rounded-3xl border border-neutral-200 bg-[radial-gradient(ellipse_at_85%_0%,rgba(209,250,229,0.7),transparent_38%),linear-gradient(145deg,#fff_18%,#f8fafc_72%,#eef2ff_100%)] p-4 shadow-sm sm:p-6">
        <div className="pointer-events-none absolute -right-16 -top-24 h-52 w-52 rounded-full bg-emerald-100/70 blur-3xl" />
        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="mt-3 text-xl font-semibold tracking-tight text-neutral-950 sm:text-2xl">{localizeCopy('内容管理', 'Contenuti del negozio')}</h1>
          </div>
        </div>
      </header>

      <section className="merchant-home-card rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-emerald-700" /><h2 className="text-sm font-semibold text-neutral-900">{selectedKind?.label} · AI 起草</h2></div>
        {section === 'metaobject' && <p className="mt-3 rounded-xl border border-violet-100 bg-violet-50/70 p-3 text-[10px] leading-5 text-violet-950">产品属性用元字段，跨产品复用记录用元对象。这里只生成草稿，不创建线上字段。</p>}
        <form onSubmit={event => void generateDraft(event)} className="mt-4 space-y-3">
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_180px]">
            <label className="text-[11px] font-semibold text-neutral-700">草稿名称
              <input required maxLength={120} value={title} onChange={event => setTitle(event.target.value)} className="mt-1 w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-xs font-normal outline-none focus:border-neutral-400 focus:bg-white" />
            </label>
            <label className="text-[11px] font-semibold text-neutral-700">输出语言
              <select value={language} onChange={event => setLanguage(event.target.value as typeof language)} className="mt-1 w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-xs font-normal outline-none focus:border-neutral-400">
                <option value="zh">中文</option><option value="it">意大利语</option><option value="en">英语</option>
              </select>
            </label>
          </div>
          <label className="block text-[11px] font-semibold text-neutral-700">{section === 'metaobject' ? '你要管理或展示哪类信息？' : '你希望展示什么？'}
            <textarea required maxLength={2000} rows={4} value={brief} onChange={event => setBrief(event.target.value)} className="mt-1 w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-xs font-normal leading-5 outline-none focus:border-neutral-400 focus:bg-white" placeholder="写明目标、受众与真实信息；未知事实留空。" />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-[11px] font-semibold text-neutral-700">目标受众 <span className="font-normal text-neutral-400">可选</span>
              <input maxLength={300} value={audience} onChange={event => setAudience(event.target.value)} className="mt-1 w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-xs font-normal outline-none focus:border-neutral-400 focus:bg-white" />
            </label>
            <label className="text-[11px] font-semibold text-neutral-700">表达语气
              <select value={tone} onChange={event => setTone(event.target.value)} className="mt-1 w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-xs font-normal outline-none focus:border-neutral-400">
                <option>简洁专业</option><option>优雅高级</option><option>亲切自然</option><option>活力时尚</option><option>理性说明</option>
              </select>
            </label>
            <label className="text-[11px] font-semibold text-neutral-700">关键词 <span className="font-normal text-neutral-400">可选</span>
              <input maxLength={300} value={keywords} onChange={event => setKeywords(event.target.value)} className="mt-1 w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-xs font-normal outline-none focus:border-neutral-400 focus:bg-white" placeholder="逗号分隔" />
            </label>
            <label className="text-[11px] font-semibold text-neutral-700">行动引导 <span className="font-normal text-neutral-400">可选</span>
              <input maxLength={300} value={callToAction} onChange={event => setCallToAction(event.target.value)} className="mt-1 w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-xs font-normal outline-none focus:border-neutral-400 focus:bg-white" />
            </label>
          </div>
          <button type="submit" disabled={busy || !title.trim() || !brief.trim()} className="inline-flex items-center gap-2 rounded-xl bg-neutral-950 px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-neutral-700 disabled:cursor-not-allowed disabled:opacity-50"><Sparkles className={`h-3.5 w-3.5 ${busy ? 'animate-pulse' : ''}`} />{busy ? 'AI 正在准备…' : '生成草稿'}</button>
        </form>
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2"><div className="flex items-center gap-2"><FolderOpen className="h-4 w-4 text-neutral-600" /><h2 className="text-sm font-semibold text-neutral-900">草稿箱</h2></div><span className="text-[10px] text-neutral-400">尚未发布</span></div>
        {drafts.filter(draft => draft.kind === section).length ? drafts.filter(draft => draft.kind === section).map(draft => {
          const draftKind = contentKinds.find(item => item.id === draft.kind);
          return <article key={draft.id} className="merchant-home-card rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0"><span className="inline-flex items-center gap-1.5 rounded-full bg-neutral-50 px-2.5 py-1 text-[9px] font-semibold text-neutral-600">{draftKind?.label}</span><h3 className="mt-2 text-sm font-semibold text-neutral-950">{draft.title}</h3><p className="mt-1 text-[10px] text-neutral-500">{draft.brief}</p></div>
              <div className="flex shrink-0 gap-2">
                <button type="button" disabled={busy} onClick={() => void refineDraft(draft, 'polish')} className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 px-2.5 py-2 text-[10px] font-semibold text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"><Sparkles className={`h-3.5 w-3.5 ${workingDraftId === draft.id ? 'animate-pulse' : ''}`} />AI 润色</button>
                <button type="button" disabled={busy} onClick={() => void refineDraft(draft, 'seo')} className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 px-2.5 py-2 text-[10px] font-semibold text-neutral-700 hover:bg-neutral-50 disabled:opacity-50">SEO 优化</button>
                <button type="button" onClick={() => void copyDraft(draft)} className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 px-2.5 py-2 text-[10px] font-semibold text-neutral-700 hover:bg-neutral-50">{copiedId === draft.id ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}{copiedId === draft.id ? '已复制' : '复制'}</button>
                <button type="button" onClick={() => deleteDraft(draft)} aria-label={`删除草稿 ${draft.title}`} className="rounded-lg border border-neutral-200 p-2 text-neutral-500 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
            </div>
            <pre className="mt-3 max-h-96 overflow-auto whitespace-pre-wrap rounded-xl border border-neutral-100 bg-neutral-50 p-3 text-[11px] leading-5 text-neutral-700">{draft.body}</pre>
            <p className="mt-2 text-[9px] text-neutral-400">更新于 {new Date(draft.updatedAt).toLocaleString()}</p>
          </article>;
        }) : <div className="rounded-2xl border border-dashed border-neutral-300 bg-white/70 px-4 py-10 text-center text-xs text-neutral-500">暂无草稿</div>}
      </section>
    </div>
  );
};
