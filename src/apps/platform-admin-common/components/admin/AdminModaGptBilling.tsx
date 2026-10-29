import React, { useEffect, useState } from 'react';
import { AlertTriangle, RefreshCw, Save } from 'lucide-react';
import { apiGet, apiPatch } from '../../../../api/client';

type Plan = {
  id: 'FREE' | 'PLUS' | 'PRO' | 'BUSINESS' | 'FASHION_PRO';
  displayName: string;
  monthlyPriceMinor: number;
  monthlyCredits: number | null;
  currency: string;
  interval: string;
  purchaseEnabled: boolean;
  status: string;
  version: number;
};

type Feature = {
  featureKey: string;
  minimumPlan: Plan['id'] | null;
  creditCost: number | null;
  riskLevel: string;
  enabled: boolean;
  config: string;
  version: number;
};

type Catalog = {
  success: true;
  plans: Plan[];
  features: Feature[];
  billingReady: boolean;
  provider: {
    id: string;
    billingMode: 'test' | 'live' | null;
    configured: boolean;
    webhookConfigured: boolean;
    automaticTaxConfigured: boolean;
  };
};

type PlanDraft = { monthlyPriceEuros: string; monthlyCredits: string };
type FeatureDraft = {
  minimumPlan: string;
  creditCost: string;
  enabled: boolean;
  config: string;
};

const planOrder: Plan['id'][] = ['FREE', 'PLUS', 'PRO', 'BUSINESS', 'FASHION_PRO'];

function asPlanDraft(plan: Plan): PlanDraft {
  return {
    monthlyPriceEuros: (plan.monthlyPriceMinor / 100).toFixed(2),
    monthlyCredits: plan.monthlyCredits === null ? '' : String(plan.monthlyCredits)
  };
}

function asFeatureDraft(feature: Feature): FeatureDraft {
  return {
    minimumPlan: feature.minimumPlan || '',
    creditCost: feature.creditCost === null ? '' : String(feature.creditCost),
    enabled: feature.enabled,
    config: JSON.stringify(JSON.parse(feature.config || '{}'), null, 2)
  };
}

export const AdminModaGptBilling: React.FC = () => {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [planDrafts, setPlanDrafts] = useState<Record<string, PlanDraft>>({});
  const [featureDrafts, setFeatureDrafts] = useState<Record<string, FeatureDraft>>({});
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const result = await apiGet<Catalog>('/api/admin/modagpt/billing/catalog');
      setCatalog(result);
      setPlanDrafts(Object.fromEntries(result.plans.map(plan => [plan.id, asPlanDraft(plan)])));
      setFeatureDrafts(Object.fromEntries(result.features.map(feature => [feature.featureKey, asFeatureDraft(feature)])));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'BILLING_CATALOG_LOAD_FAILED');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const savePlan = async (plan: Plan) => {
    const draft = planDrafts[plan.id];
    if (!draft || savingKey) return;
    const monthlyPrice = Number(draft.monthlyPriceEuros);
    const monthlyCredits = draft.monthlyCredits === '' ? null : Number(draft.monthlyCredits);
    if (!Number.isFinite(monthlyPrice) || !Number.isSafeInteger(monthlyPrice * 100) || monthlyPrice < 0
      || (monthlyCredits !== null && (!Number.isSafeInteger(monthlyCredits) || monthlyCredits < 0))) {
      setError('套餐价格必须是欧元金额，Credits 必须是非负整数。');
      return;
    }
    setSavingKey(`plan:${plan.id}`);
    setError('');
    setNotice('');
    try {
      await apiPatch(`/api/admin/modagpt/billing/plans/${encodeURIComponent(plan.id)}`, {
        monthlyPriceMinor: Math.round(monthlyPrice * 100),
        monthlyCredits
      });
      setNotice(`${plan.displayName} 套餐已保存；新周期按当前套餐快照发放 Credits。`);
      await load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'BILLING_PLAN_SAVE_FAILED');
    } finally {
      setSavingKey(null);
    }
  };

  const saveFeature = async (feature: Feature) => {
    const draft = featureDrafts[feature.featureKey];
    if (!draft || savingKey) return;
    const creditCost = draft.creditCost === '' ? null : Number(draft.creditCost);
    if (creditCost !== null && (!Number.isSafeInteger(creditCost) || creditCost < 1 || creditCost > 1_000_000)) {
      setError('单次 Credits 成本必须是 1 到 1,000,000 之间的整数。');
      return;
    }
    let config: Record<string, unknown>;
    try {
      const parsed: unknown = JSON.parse(draft.config);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('JSON must be an object');
      config = parsed as Record<string, unknown>;
    } catch {
      setError(`${feature.featureKey} 的计价配置必须是有效 JSON 对象。`);
      return;
    }
    setSavingKey(`feature:${feature.featureKey}`);
    setError('');
    setNotice('');
    try {
      await apiPatch(`/api/admin/modagpt/billing/features/${encodeURIComponent(feature.featureKey)}`, {
        minimumPlan: draft.minimumPlan || null,
        creditCost,
        enabled: draft.enabled,
        config
      });
      setNotice(`${feature.featureKey} 计费配置已保存。`);
      await load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'BILLING_FEATURE_SAVE_FAILED');
    } finally {
      setSavingKey(null);
    }
  };

  return (
    <section className="space-y-5 rounded-xl border border-neutral-200 bg-white p-5 shadow-xs sm:p-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-neutral-950">套餐计费</h2>
          <p className="mt-1 max-w-3xl text-xs leading-5 text-neutral-600">
            在此调整套餐月价/月度 Credits，并配置每项 AI 能力的最低套餐、单次成本和模型/单位计价规则。配置为后台持久化值；未明确启用的功能继续关闭。
          </p>
        </div>
        <button type="button" onClick={() => void load()} disabled={loading} className="inline-flex items-center gap-2 rounded-lg border border-neutral-300 px-3 py-2 text-xs font-semibold disabled:opacity-50">
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />刷新
        </button>
      </header>

      {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800">{error}</p>}
      {notice && <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900">{notice}</p>}
      {catalog && (
        <>
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-950">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>
              Stripe 模式：{catalog.provider.billingMode === 'live' ? '正式' : catalog.provider.billingMode === 'test' ? '测试' : '未配置'}；
              订阅结账就绪：{catalog.billingReady ? '是' : '否'}；
              Provider：{catalog.provider.id}；
              Webhook：{catalog.provider.webhookConfigured ? '已配置' : '未配置'}；
              自动税：{catalog.provider.automaticTaxConfigured ? '已配置' : '未配置'}。
              未通过完整门控前不可打开套餐购买。
            </span>
          </div>

          <div>
            <h3 className="mb-2 text-sm font-bold text-neutral-900">五档套餐（EUR/月）</h3>
            <div className="grid gap-3 lg:grid-cols-2">
              {planOrder.map(id => {
                const plan = catalog.plans.find(item => item.id === id);
                const draft = planDrafts[id];
                if (!plan || !draft) return null;
                return (
                  <div key={plan.id} className="rounded-lg border border-neutral-200 p-3">
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-bold">{plan.displayName}</p>
                        <p className="text-[10px] text-neutral-500">{plan.id} · 版本 {plan.version} · {plan.status}</p>
                      </div>
                      <span className="text-[10px] text-neutral-500">{plan.purchaseEnabled ? '购买启用' : '购买关闭'}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <label className="text-[10px] font-semibold text-neutral-600">
                        月价 (€)
                        <input type="number" min="0" step="0.01" value={draft.monthlyPriceEuros} onChange={event => setPlanDrafts(previous => ({ ...previous, [plan.id]: { ...draft, monthlyPriceEuros: event.target.value } }))} className="mt-1 w-full rounded border border-neutral-300 px-2 py-1.5 text-sm text-neutral-900" />
                      </label>
                      <label className="text-[10px] font-semibold text-neutral-600">
                        月度 Credits
                        <input type="number" min="0" step="1" value={draft.monthlyCredits} placeholder={plan.id === 'FREE' ? '沿用旧免费配额' : '必须配置后才能购买'} onChange={event => setPlanDrafts(previous => ({ ...previous, [plan.id]: { ...draft, monthlyCredits: event.target.value } }))} className="mt-1 w-full rounded border border-neutral-300 px-2 py-1.5 text-sm text-neutral-900" />
                      </label>
                    </div>
                    <button type="button" onClick={() => void savePlan(plan)} disabled={Boolean(savingKey) || loading} className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-neutral-950 px-3 py-2 text-[10px] font-bold text-white disabled:opacity-50">
                      <Save className="h-3 w-3" />{savingKey === `plan:${plan.id}` ? '保存中…' : '保存套餐'}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          <div>
            <h3 className="mb-2 text-sm font-bold text-neutral-900">AI 能力与计量配置</h3>
            <div className="space-y-3">
              {catalog.features.map(feature => {
                const draft = featureDrafts[feature.featureKey];
                if (!draft) return null;
                return (
                  <div key={feature.featureKey} className="rounded-lg border border-neutral-200 p-3">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-xs font-bold">{feature.featureKey}</p>
                        <p className="text-[10px] text-neutral-500">风险：{feature.riskLevel} · 版本：{feature.version}</p>
                      </div>
                      <label className="flex items-center gap-2 text-[10px] font-semibold">
                        <input type="checkbox" checked={draft.enabled} onChange={event => setFeatureDrafts(previous => ({ ...previous, [feature.featureKey]: { ...draft, enabled: event.target.checked } }))} />
                        平台启用
                      </label>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="text-[10px] font-semibold text-neutral-600">
                        最低套餐
                        <select value={draft.minimumPlan} onChange={event => setFeatureDrafts(previous => ({ ...previous, [feature.featureKey]: { ...draft, minimumPlan: event.target.value } }))} className="mt-1 w-full rounded border border-neutral-300 bg-white px-2 py-1.5 text-xs text-neutral-900">
                          <option value="">不限定</option>
                          {planOrder.map(plan => <option key={plan} value={plan}>{plan}</option>)}
                        </select>
                      </label>
                      <label className="text-[10px] font-semibold text-neutral-600">
                        默认单次 Credits
                        <input type="number" min="1" step="1" value={draft.creditCost} placeholder="留空时不得启用" onChange={event => setFeatureDrafts(previous => ({ ...previous, [feature.featureKey]: { ...draft, creditCost: event.target.value } }))} className="mt-1 w-full rounded border border-neutral-300 px-2 py-1.5 text-xs text-neutral-900" />
                      </label>
                    </div>
                    <label className="mt-3 block text-[10px] font-semibold text-neutral-600">
                      模型/单位价格 JSON（按需配置；默认和覆盖价格均为正整数）
                      <textarea value={draft.config} onChange={event => setFeatureDrafts(previous => ({ ...previous, [feature.featureKey]: { ...draft, config: event.target.value } }))} rows={4} spellCheck={false} className="mt-1 w-full rounded border border-neutral-300 bg-neutral-50 p-2 font-mono text-[10px] text-neutral-900" />
                    </label>
                    <button type="button" onClick={() => void saveFeature(feature)} disabled={Boolean(savingKey) || loading} className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-neutral-950 px-3 py-2 text-[10px] font-bold text-white disabled:opacity-50">
                      <Save className="h-3 w-3" />{savingKey === `feature:${feature.featureKey}` ? '保存中…' : '保存计费配置'}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </section>
  );
};
