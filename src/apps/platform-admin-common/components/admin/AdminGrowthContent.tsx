import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RefreshCw, Sparkles } from 'lucide-react';
import { apiGet, apiPost, apiPut } from '../../../../api/client';
import { growthChannels, type GrowthMarket } from '../../../../shared/growthChannels';
import { AdminPageHeader } from './AdminPageHeader';
import { AdminPromotions } from './AdminPromotions';
import { describeGrowthError } from './growthAdminErrors';
import {
  growthCopyChannelLabels,
  growthCopyChannels,
  type GrowthCopyChannel,
  type GrowthCopyDraft,
  type GrowthCopyLanguage,
  type MarketingCampaign,
  type MarketingChannel
} from './growthAdminTypes';

const marketLabels: Record<GrowthMarket, string> = { china: '中国', europe: '欧洲', mexico: '墨西哥' };
const marketOptions: GrowthMarket[] = ['china', 'europe', 'mexico'];
const languageLabels: Record<GrowthCopyLanguage, string> = { it: '意大利语', en: '英语', zh: '简体中文' };
const languageOptions: GrowthCopyLanguage[] = ['it', 'en', 'zh'];
const landingOptions = ['/', '/catalog', '/showrooms'] as const;
const campaignChannels: MarketingChannel[] = ['instagram', 'facebook', 'tiktok', 'google_ads', 'whatsapp'];

const isCopyChannel = (value: string): value is GrowthCopyChannel => (growthCopyChannels as readonly string[]).includes(value);
const isMarketingChannel = (value: string): value is MarketingChannel => (campaignChannels as string[]).includes(value);

export const AdminGrowthContent: React.FC = () => {
  const [market, setMarket] = useState<GrowthMarket>('europe');
  const [language, setLanguage] = useState<GrowthCopyLanguage>('it');
  const [channel, setChannel] = useState<GrowthCopyChannel>('instagram');
  const [campaignName, setCampaignName] = useState('');
  const [objective, setObjective] = useState('');
  const [landingPath, setLandingPath] = useState<(typeof landingOptions)[number]>('/catalog');
  const [prospectCompany, setProspectCompany] = useState('');
  const [salesAngle, setSalesAngle] = useState('');
  const [draft, setDraft] = useState<GrowthCopyDraft | null>(null);
  const [selectedVariant, setSelectedVariant] = useState(0);
  const [editedCopy, setEditedCopy] = useState('');
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [campaigns, setCampaigns] = useState<MarketingCampaign[]>([]);
  const [campaignsLoading, setCampaignsLoading] = useState(true);
  const [campaignsError, setCampaignsError] = useState(false);
  const [showPromotions, setShowPromotions] = useState(false);
  const campaignsRequestRef = useRef(0);

  const availableChannels = useMemo(() => growthChannels
    .filter(entry => entry.phase === 'p0'
      && isCopyChannel(entry.id)
      && entry.markets.includes(market))
    .map(entry => entry.id as GrowthCopyChannel), [market]);

  useEffect(() => {
    if (!availableChannels.includes(channel) && availableChannels.length > 0) {
      setChannel(availableChannels[0]);
    }
  }, [availableChannels, channel]);

  const loadCampaigns = useCallback(async () => {
    const requestId = ++campaignsRequestRef.current;
    setCampaignsLoading(true);
    setCampaignsError(false);
    setCampaigns([]);
    setError('');
    try {
      const result = await apiGet<{ campaigns: MarketingCampaign[] }>('/api/admin/growth/campaigns');
      if (requestId !== campaignsRequestRef.current) return;
      setCampaigns(result.campaigns);
    } catch (loadError) {
      if (requestId !== campaignsRequestRef.current) return;
      setCampaigns([]);
      setCampaignsError(true);
      setError(describeGrowthError(loadError));
    } finally {
      if (requestId === campaignsRequestRef.current) setCampaignsLoading(false);
    }
  }, []);

  useEffect(() => { void loadCampaigns(); }, [loadCampaigns]);

  const generate = async () => {
    if (!campaignName.trim() || !objective.trim()) {
      setError('请填写推广活动名称与目标');
      return;
    }
    setGenerating(true);
    setError('');
    setNotice('');
    try {
      const result = await apiPost<{ draft: GrowthCopyDraft; notice: string }>('/api/admin/growth/copy', {
        campaignName: campaignName.trim(),
        objective: objective.trim(),
        market,
        language,
        channel,
        landingPath,
        prospectCompany: prospectCompany.trim() || null,
        salesAngle: salesAngle.trim() || null
      });
      setDraft(result.draft);
      setSelectedVariant(0);
      setEditedCopy(result.draft.variants[0]?.copy ?? '');
      setNotice(result.notice);
    } catch (generateError) {
      setError(describeGrowthError(generateError));
    } finally {
      setGenerating(false);
    }
  };

  const saveCampaign = async () => {
    if (!campaignName.trim() || !objective.trim()) {
      setError('请填写推广活动名称与目标');
      return;
    }
    if (!editedCopy.trim()) {
      setError('请选择或编辑一份文案后再保存');
      return;
    }
    if (!isMarketingChannel(channel)) {
      setError('当前渠道仅支持生成文案；推广草稿保存仅支持 Instagram、Facebook、TikTok、Google Ads、WhatsApp。');
      return;
    }
    setSaving(true);
    setError('');
    setNotice('');
    try {
      await apiPost('/api/admin/growth/campaigns', {
        name: campaignName.trim(),
        objective: objective.trim(),
        channels: [channel],
        landingPath,
        copies: { [channel]: editedCopy.trim() }
      });
      setNotice('文案已保存为推广草稿，需在下方列表审核后才能发布。');
      await loadCampaigns();
    } catch (saveError) {
      setError(describeGrowthError(saveError));
    } finally {
      setSaving(false);
    }
  };

  const approveCampaign = async (campaign: MarketingCampaign) => {
    setSaving(true);
    setError('');
    setNotice('');
    try {
      await apiPut(`/api/admin/growth/campaigns/${campaign.id}`, { status: 'approved' });
      setNotice('活动已审核通过；发布仍需前往对应投放渠道完成。');
      await loadCampaigns();
    } catch (approveError) {
      setError(describeGrowthError(approveError));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="space-y-4">
      <AdminPageHeader
        title="内容推广"
        description="AI 生成的是待审核草稿；系统不会自动发布，也不会自动执行投放。"
        actions={(
          <button type="button" onClick={() => void loadCampaigns()} disabled={campaignsLoading} className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-50">
            <RefreshCw className={`h-3.5 w-3.5 ${campaignsLoading ? 'animate-spin' : ''}`} />刷新草稿
          </button>
        )}
      />

      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div>}
      {notice && <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs text-neutral-700">{notice}</div>}

      <div className="grid gap-4 lg:grid-cols-2">
        <article className="rounded-xl border border-neutral-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-neutral-900">文案生成</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="text-xs text-neutral-600">活动名称<input value={campaignName} onChange={event => setCampaignName(event.target.value)} maxLength={100} className="mt-1 w-full rounded-lg border border-neutral-200 px-2.5 py-1.5 text-sm" /></label>
            <label className="text-xs text-neutral-600">市场
              <select value={market} onChange={event => setMarket(event.target.value as GrowthMarket)} className="mt-1 w-full rounded-lg border border-neutral-200 px-2.5 py-1.5 text-sm">
                {marketOptions.map(option => <option key={option} value={option}>{marketLabels[option]}</option>)}
              </select>
            </label>
            <label className="text-xs text-neutral-600">语言
              <select value={language} onChange={event => setLanguage(event.target.value as GrowthCopyLanguage)} className="mt-1 w-full rounded-lg border border-neutral-200 px-2.5 py-1.5 text-sm">
                {languageOptions.map(option => <option key={option} value={option}>{languageLabels[option]}</option>)}
              </select>
            </label>
            <label className="text-xs text-neutral-600">渠道
              <select value={channel} onChange={event => setChannel(event.target.value as GrowthCopyChannel)} className="mt-1 w-full rounded-lg border border-neutral-200 px-2.5 py-1.5 text-sm">
                {availableChannels.map(option => <option key={option} value={option}>{growthCopyChannelLabels[option]}</option>)}
              </select>
            </label>
            <label className="text-xs text-neutral-600">落地页
              <select value={landingPath} onChange={event => setLandingPath(event.target.value as typeof landingPath)} className="mt-1 w-full rounded-lg border border-neutral-200 px-2.5 py-1.5 text-sm">
                {landingOptions.map(option => <option key={option} value={option}>{option}</option>)}
              </select>
            </label>
            <label className="text-xs text-neutral-600">目标客商（可选）<input value={prospectCompany} onChange={event => setProspectCompany(event.target.value)} maxLength={120} className="mt-1 w-full rounded-lg border border-neutral-200 px-2.5 py-1.5 text-sm" /></label>
          </div>
          <label className="mt-3 block text-xs text-neutral-600">推广目标<textarea value={objective} onChange={event => setObjective(event.target.value)} maxLength={300} rows={2} className="mt-1 w-full rounded-lg border border-neutral-200 px-2.5 py-1.5 text-sm" placeholder="例如：邀请欧洲买手注册并浏览 2026 秋冬目录" /></label>
          <label className="mt-3 block text-xs text-neutral-600">销售角度（可选）<input value={salesAngle} onChange={event => setSalesAngle(event.target.value)} maxLength={200} className="mt-1 w-full rounded-lg border border-neutral-200 px-2.5 py-1.5 text-sm" placeholder="例如：小批量起订、7 天出样" /></label>
          <button type="button" onClick={() => void generate()} disabled={generating} className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-neutral-950 px-3 py-1.5 text-xs font-medium text-white hover:bg-neutral-800 disabled:opacity-50">
            <Sparkles className="h-3.5 w-3.5" />{generating ? '生成中' : '生成文案草稿'}
          </button>
        </article>

        <article className="rounded-xl border border-neutral-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-neutral-900">待审核文案</h2>
          {!draft && <p className="mt-2 text-xs text-neutral-500">尚未生成草稿。</p>}
          {draft && (
            <div className="mt-3 space-y-3">
              <div className="flex flex-wrap gap-2">
                {draft.variants.map((variant, index) => (
                  <button
                    key={variant.label}
                    type="button"
                    onClick={() => { setSelectedVariant(index); setEditedCopy(variant.copy); }}
                    className={`rounded-lg border px-2.5 py-1 text-[11px] ${selectedVariant === index ? 'border-neutral-950 bg-neutral-950 text-white' : 'border-neutral-200 text-neutral-700'}`}
                  >
                    {variant.label}
                  </button>
                ))}
              </div>
              <textarea value={editedCopy} onChange={event => setEditedCopy(event.target.value)} rows={10} maxLength={5000} className="w-full rounded-lg border border-neutral-200 px-2.5 py-2 text-xs leading-relaxed" />
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" onClick={() => void saveCampaign()} disabled={saving} className="rounded-lg bg-neutral-950 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50">保存为推广草稿</button>
                <span className="text-[11px] text-neutral-500">渠道：{growthCopyChannelLabels[channel]} · 需人工审核后发布</span>
              </div>
            </div>
          )}
        </article>
      </div>


      <article className="rounded-xl border border-neutral-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-neutral-900">推广活动审核</h2>
        <p className="mt-1 text-[11px] text-neutral-500">审核仅改变草稿状态，不代表已发布；发布仍需在投放渠道完成。</p>
        <ul className="mt-3 divide-y divide-neutral-100">
          {campaigns.map(campaign => (
            <li key={campaign.id} className="py-3 text-xs">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium text-neutral-900">{campaign.name}</p>
                  <p className="mt-0.5 text-[11px] text-neutral-500">
                    {campaign.channels.map(item => growthCopyChannelLabels[item]).join(' / ')} · {campaign.landingPath} · {new Date(campaign.updatedAt).toLocaleString('zh-CN')}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-[11px] ${campaign.status === 'approved' ? 'bg-neutral-950 text-white' : 'bg-neutral-100 text-neutral-700'}`}>
                    {campaign.status === 'approved' ? '已审核' : '待审核'}
                  </span>
                  {campaign.status === 'draft' && (
                    <button type="button" onClick={() => void approveCampaign(campaign)} disabled={saving} className="rounded-lg border border-neutral-200 px-2.5 py-1 text-[11px] text-neutral-700 hover:bg-neutral-50 disabled:opacity-50">审核通过</button>
                  )}
                </div>
              </div>
              {campaign.channels.map(item => (
                campaign.copies[item] ? <p key={item} className="mt-1 line-clamp-2 whitespace-pre-wrap text-[11px] text-neutral-600">{growthCopyChannelLabels[item]}：{campaign.copies[item]}</p> : null
              ))}
            </li>
          ))}
          {!campaignsLoading && !campaignsError && campaigns.length === 0 && <li className="py-4 text-xs text-neutral-500">暂无推广活动。</li>}
          {!campaignsLoading && campaignsError && <li className="py-4 text-xs text-neutral-500">草稿加载失败，请刷新重试。</li>}
          {campaignsLoading && <li className="py-4 text-xs text-neutral-500">加载中…</li>}
        </ul>
      </article>

      <details
        className="rounded-xl border border-neutral-200 bg-white p-4"
        onToggle={event => setShowPromotions((event.currentTarget as HTMLDetailsElement).open)}
      >
        <summary className="cursor-pointer text-sm font-semibold text-neutral-900">促销活动</summary>
        <p className="mt-1 text-[11px] text-neutral-500">沿用原「促销管理」页面：阶梯价、生效时间与状态仍写入同一套促销数据。</p>
        <div className="mt-3">{showPromotions && <AdminPromotions embedded />}</div>
      </details>
    </section>
  );
};

