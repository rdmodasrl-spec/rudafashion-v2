import React, { useState } from 'react';
import { ArrowLeft, ChevronRight, Download, Images, LoaderCircle, Sparkles, Video } from 'lucide-react';
import { apiPost } from '../../../../api/client';
import { MerchantGallery } from '../../../merchant-admin-common/components/merchant/MerchantGallery';
import { AdminFashionCommunity } from './AdminFashionCommunity';
import { WebsiteImageCollector } from './WebsiteImageCollector';
import { AdminPageHeader } from './AdminPageHeader';

export type FashionContentSection = 'community' | 'gallery' | 'collector';
type AssetTool = FashionContentSection;
type StudioWorkspace = 'home' | 'download' | 'image' | 'video' | 'assets';
type StudioPlan = {
  workflow: Exclude<StudioWorkspace, 'home'>;
  summary: string;
  steps: string[];
  limitations: string[];
};

const workspaceCards: Array<{
  id: Exclude<StudioWorkspace, 'home'>;
  title: string;
  description: string;
  icon: typeof Download;
}> = [
  { id: 'download', title: '智能下载', description: '粘贴链接，下载视频并生成可编辑草稿', icon: Download },
  { id: 'image', title: '图片创作', description: 'AI 生成或上传图片，编辑后预览发布', icon: Sparkles },
  { id: 'video', title: '视频创作', description: '上传长视频，切片后逐条编辑', icon: Video },
  { id: 'assets', title: '我的素材', description: '管理图片图库、网页采集与社区作品', icon: Images }
];

export const AdminFashionContentHub: React.FC<{ initialSection?: FashionContentSection }> = ({
  initialSection = 'community'
}) => {
  const [workspace, setWorkspace] = useState<StudioWorkspace>(initialSection === 'community' ? 'home' : 'assets');
  const [assetTool, setAssetTool] = useState<AssetTool>(initialSection === 'collector' ? 'collector' : 'gallery');
  const [visitedTools, setVisitedTools] = useState<Set<FashionContentSection>>(
    () => new Set(initialSection === 'community' ? [] : [initialSection])
  );
  const [assistantInput, setAssistantInput] = useState('');
  const [assistantPlan, setAssistantPlan] = useState<StudioPlan | null>(null);
  const [assistantError, setAssistantError] = useState('');
  const [assistantBusy, setAssistantBusy] = useState(false);

  const visitAssetTool = (tool: FashionContentSection) => {
    setAssetTool(tool);
    setVisitedTools(current => current.has(tool) ? current : new Set(current).add(tool));
  };

  const createPlan = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const request = assistantInput.trim();
    if (!request || assistantBusy) return;
    setAssistantBusy(true);
    setAssistantError('');
    setAssistantPlan(null);
    try {
      const result = await apiPost<{ plan: StudioPlan }>('/api/admin/fashion/studio/assistant', { request }, 60_000);
      setAssistantPlan(result.plan);
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      setAssistantError(message.includes('FASHION_STUDIO_ASSISTANT_UNAVAILABLE')
        ? 'AI 文字模型暂不可用。请在后台 AI 控制中心配置 OpenAI API Key，或启用 DeepSeek / 本地模型并测试连接。'
        : message || 'AI 助手暂时不可用，请重试。');
    } finally {
      setAssistantBusy(false);
    }
  };

  const initialMode = workspace === 'download' ? 'import' : workspace === 'video' ? 'slice' : 'upload';
  const activeCard = workspaceCards.find(card => card.id === workspace);

  return (
    <main className="space-y-5">
      <AdminPageHeader title="时尚设计" actions={workspace !== 'home' ? (
        <button
          type="button"
          onClick={() => setWorkspace('home')}
          className="inline-flex min-h-9 items-center gap-2 border border-neutral-300 bg-white px-3 text-xs font-semibold text-neutral-700 hover:bg-neutral-50"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          返回工作台
        </button>
      ) : undefined} />

      {workspace === 'home' && (
        <section className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            {workspaceCards.map(card => (
              <button
                key={card.id}
                type="button"
                onClick={() => setWorkspace(card.id)}
                className="group flex min-h-28 items-center gap-4 rounded-xl border border-neutral-200 bg-white p-4 text-left transition-colors hover:border-neutral-400 hover:bg-neutral-50 sm:p-5"
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-neutral-100 text-neutral-700">
                  <card.icon className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-neutral-900">{card.title}</span>
                  <span className="mt-1 block text-xs leading-5 text-neutral-500">{card.description}</span>
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-neutral-400 transition-transform group-hover:translate-x-0.5" />
              </button>
            ))}
          </div>
          <section className="rounded-xl border border-neutral-200 bg-white p-4 sm:p-5">
            <div className="mb-3 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-neutral-700" />
              <h3 className="text-sm font-semibold text-neutral-900">AI 创作助手</h3>
            </div>
            <form onSubmit={event => void createPlan(event)} className="space-y-3">
              <textarea
                value={assistantInput}
                onChange={event => setAssistantInput(event.target.value.slice(0, 1000))}
                maxLength={1000}
                rows={2}
                placeholder="描述你要做什么，例如：把一段时装秀视频做成 3 条短视频"
                className="w-full resize-y rounded-lg border border-neutral-200 px-3 py-3 text-xs outline-none focus:border-neutral-800"
              />
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[10px] text-neutral-500">AI 分析需求并推荐 RUDA 内可执行的创作流程</span>
                <button
                  type="submit"
                  disabled={!assistantInput.trim() || assistantBusy}
                  className="inline-flex h-9 items-center gap-2 rounded-lg bg-neutral-950 px-3 text-xs font-semibold text-white hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {assistantBusy && <LoaderCircle className="h-3.5 w-3.5 animate-spin" />}
                  {assistantBusy ? '分析中…' : '生成方案'}
                </button>
              </div>
            </form>
            {assistantError && <p role="alert" className="mt-3 rounded-lg bg-rose-50 p-3 text-xs text-rose-800">{assistantError}</p>}
            {assistantPlan && (
              <div className="mt-4 space-y-3 border-t border-neutral-100 pt-4">
                <p className="text-sm font-semibold text-neutral-900">{assistantPlan.summary}</p>
                <ol className="list-inside list-decimal space-y-1.5 text-xs leading-5 text-neutral-700">
                  {assistantPlan.steps.map((step, index) => <li key={`${index}-${step}`}>{step}</li>)}
                </ol>
                {assistantPlan.limitations.length > 0 && (
                  <p className="rounded-lg bg-amber-50 px-3 py-2 text-[11px] leading-5 text-amber-900">
                    {assistantPlan.limitations.join('；')}
                  </p>
                )}
                <button
                  type="button"
                  onClick={() => setWorkspace(assistantPlan.workflow)}
                  className="inline-flex h-9 items-center gap-2 rounded-lg border border-neutral-300 px-3 text-xs font-semibold text-neutral-800 hover:bg-neutral-50"
                >
                  按方案开始
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </section>
          <p className="text-xs text-neutral-500">高级工具在编辑器和素材管理中按需展开。</p>
        </section>
      )}

      {workspace !== 'home' && workspace !== 'assets' && activeCard && (
        <div className="flex items-center gap-2 text-sm font-semibold text-neutral-800">
          {activeCard.title}
        </div>
      )}

      {workspace === 'assets' && (
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-neutral-900">我的素材</h2>
            <label>
              <span className="sr-only">素材工具</span>
              <select
                value={assetTool}
                onChange={event => {
                  const nextTool = event.currentTarget.value;
                  if (nextTool === 'gallery' || nextTool === 'collector' || nextTool === 'community') visitAssetTool(nextTool);
                }}
                className="h-9 rounded-lg border border-neutral-200 bg-white px-3 text-xs font-medium text-neutral-800 outline-none focus:border-neutral-800"
              >
                <option value="gallery">图片图库</option>
                <option value="collector">网页图片采集</option>
                <option value="community">我的作品</option>
              </select>
            </label>
          </div>
          {visitedTools.has('gallery') && (
            <div hidden={assetTool !== 'gallery'}>
              <MerchantGallery mode="admin" />
            </div>
          )}
          {visitedTools.has('collector') && (
            <div hidden={assetTool !== 'collector'}>
              <WebsiteImageCollector />
            </div>
          )}
          {assetTool === 'community' && <p className="text-xs text-neutral-500">作品草稿、已发布内容和审核状态</p>}
        </section>
      )}

      <div hidden={workspace === 'home' || (workspace === 'assets' && assetTool !== 'community')}>
        <AdminFashionCommunity
          initialMode={initialMode}
          batchSocialLinks={workspace === 'download'}
        />
      </div>
    </main>
  );
};
