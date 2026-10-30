import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Check, Copy, Loader2, RefreshCw, Sparkles } from 'lucide-react';
import { apiGet, apiPatch, apiPost, ApiError } from '../../../../api/client';
import { useB2B } from '../../../../context/B2BContext';

/**
 * MODAUI AI Tools 商家端工具中心。
 *
 * 数据全部来自 `GET /api/merchant/ai-tools`：
 * - 工具能否调用由服务端门禁（安装状态、授权、试用期、权限）决定，前端不自行判断；
 * - `capabilities` 中 `not_connected` 的工作中心不渲染可点击按钮，只显示真实原因；
 * - 额度与试用期来自服务端，超额时服务端返回 `AI_TOOL_QUOTA_EXCEEDED`。
 *
 * 三端共用：电脑端与手机网页端直接使用本组件；小程序按同一接口契约实现同等能力。
 */

type AiToolCapability = {
  id: string;
  labelZh: string;
  labelIt: string;
  status: 'ready' | 'not_connected';
  reason: string | null;
  toolIds: string[];
};

type AiToolQuota = {
  planId: string;
  limits: { dailyCalls: number; monthlyCalls: number };
  used: { daily: number; monthly: number };
  remaining: { daily: number; monthly: number };
  allowed: boolean;
  reason: 'quota_exceeded_daily' | 'quota_exceeded_monthly' | null;
  billingEnabled: boolean;
};

type AiToolSummary = {
  appId: string;
  appName: string;
  toolId: string;
  version: string;
  displayName: Record<string, string>;
  description: string;
  permission: string;
  riskLevel: string;
  cost: { unit: string; credits: number };
  status: string;
  enabled: boolean;
  availability: 'available' | 'blocked';
  blockedReason: string | null;
  grantStatus: string | null;
  grantSource: string | null;
  grantExpiresAt: string | null;
};

type AiToolsResponse = {
  success: true;
  manifestEnabled: boolean;
  apps: string[];
  tools: AiToolSummary[];
  quota: AiToolQuota;
  trialExpiresAt: string | null;
  capabilities: AiToolCapability[];
};

type InvokeResponse = { success: true; taskId: string; toolId: string; result: unknown };

const languages = [
  { id: 'it', zh: '意大利语', it: 'Italiano' },
  { id: 'en', zh: '英语', it: 'Inglese' },
  { id: 'zh', zh: '简体中文', it: 'Cinese' }
] as const;

const channels = [
  { id: 'product', zh: '商品详情', it: 'Scheda prodotto' },
  { id: 'social', zh: '社媒', it: 'Social' },
  { id: 'email', zh: '邮件', it: 'Email' }
] as const;

const tones = [
  { id: 'premium', zh: '高端', it: 'Premium' },
  { id: 'neutral', zh: '中性', it: 'Neutro' },
  { id: 'bold', zh: '强对比', it: 'Deciso' }
] as const;

const blockedReasonLabels: Record<string, { zh: string; it: string }> = {
  app_disabled: { zh: '应用已停用', it: 'App disattivata' },
  app_not_installed: { zh: '应用未安装', it: 'App non installata' },
  manifest_disabled: { zh: '工具清单已关闭', it: 'Manifest disattivato' },
  tool_not_declared: { zh: '工具未声明', it: 'Strumento non dichiarato' },
  tool_disabled: { zh: '工具已停用', it: 'Strumento disattivato' },
  tool_deprecated: { zh: '工具已下线', it: 'Strumento ritirato' },
  grant_missing: { zh: '无授权', it: 'Nessuna autorizzazione' },
  grant_paused: { zh: '授权已暂停', it: 'Autorizzazione sospesa' },
  grant_expired: { zh: '试用已结束', it: 'Prova terminata' },
  grant_revoked: { zh: '授权已撤销', it: 'Autorizzazione revocata' },
  permission_denied: { zh: '当前账号无权限', it: 'Permesso mancante' },
  credential_missing: { zh: '缺少凭据', it: 'Credenziali mancanti' },
  industry_mismatch: { zh: '行业不匹配', it: 'Settore non compatibile' },
  employee_mismatch: { zh: '员工不匹配', it: 'Dipendente non compatibile' }
};

const centerReasonLabels: Record<string, { zh: string; it: string }> = {
  provider_not_configured: { zh: '模型服务未配置', it: 'Provider non configurato' },
  adapter_not_built: { zh: '接口尚未接通', it: 'Integrazione non attiva' },
  missing_credentials: { zh: '缺少平台授权凭据', it: 'Credenziali piattaforma mancanti' }
};

function remainingDays(expiresAt: string | null): number | null {
  if (!expiresAt) return null;
  const diff = Date.parse(expiresAt) - Date.now();
  if (!Number.isFinite(diff)) return null;
  return Math.max(0, Math.ceil(diff / (24 * 60 * 60 * 1000)));
}

/** 把两种工具的输出统一成可复制文本；未知结构直接 JSON，不猜测字段含义。 */
function formatResultText(payload: unknown): string {
  if (!payload || typeof payload !== 'object') return '';
  const record = payload as Record<string, unknown>;
  if (typeof record.translation === 'string') return record.translation;
  const headline = typeof record.headline === 'string' ? record.headline : '';
  const body = typeof record.body === 'string' ? record.body : '';
  const hashtags = Array.isArray(record.hashtags)
    ? record.hashtags.filter((tag): tag is string => typeof tag === 'string')
    : [];
  if (headline || body) {
    return [headline, body, hashtags.map(tag => `#${tag.replace(/^#/, '')}`).join(' ')].filter(Boolean).join('\n\n');
  }
  return JSON.stringify(record, null, 2);
}


export const MerchantAiTools: React.FC = () => {
  const { localizeCopy, lang } = useB2B();
  const isIt = lang === 'it';
  const [data, setData] = useState<AiToolsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [activeToolId, setActiveToolId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [grantBusy, setGrantBusy] = useState<string | null>(null);
  const [result, setResult] = useState<{ toolId: string; payload: unknown } | null>(null);
  const [copied, setCopied] = useState(false);
  const [form, setForm] = useState({
    brief: '',
    language: 'it' as (typeof languages)[number]['id'],
    channel: 'product' as (typeof channels)[number]['id'],
    tone: 'premium' as (typeof tones)[number]['id'],
    text: '',
    targetLanguage: 'it' as (typeof languages)[number]['id']
  });

  const copy = useCallback((zh: string, it: string) => localizeCopy(zh, it), [localizeCopy]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setData(await apiGet<AiToolsResponse>('/api/merchant/ai-tools'));
    } catch (err) {
      setError(err instanceof ApiError
        ? err.code || err.message
        : copy('工具清单加载失败', 'Caricamento strumenti non riuscito'));
    } finally {
      setLoading(false);
    }
  }, [copy]);

  useEffect(() => {
    void load();
  }, [load]);

  const availableTools = useMemo(
    () => (data?.tools ?? []).filter(tool => tool.availability === 'available'),
    [data]
  );
  const blockedTools = useMemo(
    () => (data?.tools ?? []).filter(tool => tool.availability !== 'available'),
    [data]
  );
  const activeTool = useMemo(
    () => availableTools.find(tool => tool.toolId === activeToolId) ?? null,
    [availableTools, activeToolId]
  );
  const quota = data?.quota ?? null;
  const trialDays = remainingDays(data?.trialExpiresAt ?? null);

  const toggleGrant = async (tool: AiToolSummary) => {
    const nextStatus = tool.grantStatus === 'paused' ? 'active' : 'paused';
    setGrantBusy(tool.toolId);
    setNotice('');
    try {
      await apiPatch(`/api/merchant/ai-tools/${encodeURIComponent(tool.toolId)}/grant`, { status: nextStatus });
      setNotice(nextStatus === 'paused'
        ? copy('已暂停该工具', 'Strumento sospeso')
        : copy('已恢复该工具', 'Strumento riattivato'));
      await load();
    } catch (err) {
      setNotice(err instanceof ApiError
        ? err.code || err.message
        : copy('操作失败', 'Operazione non riuscita'));
    } finally {
      setGrantBusy(null);
    }
  };

  const invoke = async () => {
    if (!activeTool) return;
    setSubmitting(true);
    setNotice('');
    setResult(null);
    setCopied(false);
    try {
      const input = activeTool.toolId === 'ai_tools_translate'
        ? { text: form.text.trim(), targetLanguage: form.targetLanguage }
        : { brief: form.brief.trim(), language: form.language, channel: form.channel, tone: form.tone };
      const response = await apiPost<InvokeResponse>(
        `/api/merchant/ai-tools/${encodeURIComponent(activeTool.toolId)}/invoke`,
        { input }
      );
      setResult({ toolId: response.toolId, payload: response.result });
      await load();
    } catch (err) {
      if (err instanceof ApiError && err.code === 'AI_TOOL_QUOTA_EXCEEDED') {
        setNotice(copy('调用额度已用完，请下个周期再试或升级套餐。', 'Quota esaurita: riprova nel prossimo periodo o aggiorna il piano.'));
      } else if (err instanceof ApiError && err.code === 'AI_TOOL_NOT_AVAILABLE') {
        setNotice(copy('该工具当前不可用，请查看状态说明。', 'Strumento non disponibile: vedi il motivo indicato.'));
      } else {
        setNotice(err instanceof ApiError
          ? err.code || err.message
          : copy('调用失败，请稍后重试', 'Chiamata non riuscita, riprova'));
      }
    } finally {
      setSubmitting(false);
    }
  };

  const copyResult = async () => {
    const text = formatResultText(result?.payload);
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setNotice(copy('复制失败，请手动选择文本', 'Copia non riuscita: seleziona il testo'));
    }
  };

  if (loading && !data) {
    return (
      <section className="rounded-2xl border border-neutral-200 bg-white p-6 text-sm text-neutral-500">
        <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
        {copy('正在加载工具中心…', 'Caricamento centro strumenti…')}
      </section>
    );
  }

  if (error && !data) {
    return (
      <section className="rounded-2xl border border-neutral-200 bg-white p-6">
        <div className="flex items-center gap-2 text-sm font-semibold text-neutral-900">
          <AlertTriangle className="h-4 w-4" />
          {copy('工具中心暂不可用', 'Centro strumenti non disponibile')}
        </div>
        <p className="mt-1 text-xs leading-5 text-neutral-500">{error}</p>
        <button
          type="button"
          onClick={() => void load()}
          className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-semibold text-neutral-800 hover:bg-neutral-50"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          {copy('重试', 'Riprova')}
        </button>
      </section>
    );
  }

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-neutral-200 bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-base font-bold text-neutral-950">MODAUI AI Tools</h2>
            <p className="mt-1 text-xs leading-5 text-neutral-500">
              {data?.manifestEnabled
                ? copy('工具按授权与试用期使用，卸载应用会立即收回。', 'Gli strumenti seguono autorizzazione e prova: la disinstallazione li revoca subito.')
                : copy('工具清单当前已关闭，工具不可调用。', 'Manifest disattivato: gli strumenti non sono richiamabili.')}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold">
            <span className="rounded-full border border-neutral-200 bg-neutral-50 px-2.5 py-1 text-neutral-700">
              {copy('套餐', 'Piano')} {quota?.planId ?? 'FREE'}
            </span>
            {trialDays !== null && (
              <span className="rounded-full border border-neutral-200 bg-neutral-50 px-2.5 py-1 text-neutral-700">
                {copy('试用剩余', 'Prova')} {trialDays} {copy('天', 'gg')}
              </span>
            )}
            <span className={`rounded-full px-2.5 py-1 ${quota?.billingEnabled ? 'border border-emerald-200 bg-emerald-50 text-emerald-700' : 'border border-neutral-200 bg-neutral-50 text-neutral-600'}`}>
              {quota?.billingEnabled ? copy('按额度计费', 'A consumo') : copy('计费未接通', 'Fatturazione non attiva')}
            </span>
          </div>
        </div>

        {quota && (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {([
              { key: 'daily' as const, label: copy('今日调用', 'Oggi'), used: quota.used.daily, limit: quota.limits.dailyCalls },
              { key: 'monthly' as const, label: copy('本月调用', 'Questo mese'), used: quota.used.monthly, limit: quota.limits.monthlyCalls }
            ]).map(item => (
              <div key={item.key} className="rounded-xl border border-neutral-200 p-3">
                <div className="flex items-baseline justify-between text-xs text-neutral-500">
                  <span>{item.label}</span>
                  <span className="font-semibold text-neutral-900">{item.used} / {item.limit}</span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-neutral-100">
                  <div
                    className="h-full rounded-full bg-neutral-900"
                    style={{ width: `${Math.min(100, Math.round((item.used / Math.max(1, item.limit)) * 100))}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        {notice && (
          <p role="status" className="mt-3 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs text-neutral-700">{notice}</p>
        )}
      </section>

      <section className="rounded-2xl border border-neutral-200 bg-white p-5">
        <h3 className="text-sm font-bold text-neutral-950">{copy('工作中心', 'Centri di lavoro')}</h3>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {(data?.capabilities ?? []).map(center => {
            const ready = center.status === 'ready';
            const reason = center.reason ? centerReasonLabels[center.reason] : null;
            return (
              <div key={center.id} className={`rounded-xl border p-3 ${ready ? 'border-neutral-200' : 'border-dashed border-neutral-200 bg-neutral-50'}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-neutral-900">{isIt ? center.labelIt : center.labelZh}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${ready ? 'bg-neutral-900 text-white' : 'bg-neutral-200 text-neutral-600'}`}>
                    {ready ? copy('可用', 'Attivo') : copy('未接通', 'Non attivo')}
                  </span>
                </div>
                <p className="mt-1 text-[11px] leading-4 text-neutral-500">
                  {ready
                    ? copy(`${center.toolIds.length} 个工具可用`, `${center.toolIds.length} strumenti disponibili`)
                    : (reason ? (isIt ? reason.it : reason.zh) : copy('未接通', 'Non attivo'))}
                </p>
              </div>
            );
          })}
        </div>
      </section>


      <section className="rounded-2xl border border-neutral-200 bg-white p-5">
        <h3 className="text-sm font-bold text-neutral-950">{copy('可用工具', 'Strumenti disponibili')}</h3>
        {availableTools.length === 0 ? (
          <p className="mt-2 text-xs leading-5 text-neutral-500">
            {copy('当前没有可调用的工具。安装 AI Tools 应用或等待授权恢复后再试。', 'Nessuno strumento richiamabile: installa AI Tools o attendi la riattivazione.')}
          </p>
        ) : (
          <div className="mt-3 space-y-2">
            {availableTools.map(tool => (
              <div key={tool.toolId} className="rounded-xl border border-neutral-200 p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-neutral-900">
                      {tool.displayName?.zh || tool.toolId}
                      <span className="ml-2 font-mono text-[10px] font-normal text-neutral-400">{tool.toolId}</span>
                    </p>
                    <p className="mt-1 text-[11px] leading-4 text-neutral-500">{tool.description}</p>
                    {tool.grantExpiresAt && (
                      <p className="mt-1 text-[10px] text-neutral-400">
                        {copy('试用到期', 'Prova fino al')} {new Date(tool.grantExpiresAt).toLocaleDateString(isIt ? 'it-IT' : 'zh-CN')}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void toggleGrant(tool)}
                      disabled={grantBusy === tool.toolId}
                      className="rounded-lg border border-neutral-300 px-2.5 py-1 text-[11px] font-semibold text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
                    >
                      {grantBusy === tool.toolId
                        ? copy('处理中…', 'In corso…')
                        : tool.grantStatus === 'paused'
                          ? copy('恢复', 'Riattiva')
                          : copy('暂停', 'Sospendi')}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setActiveToolId(tool.toolId); setResult(null); setNotice(''); }}
                      className="inline-flex items-center gap-1 rounded-lg bg-neutral-900 px-3 py-1 text-[11px] font-semibold text-white hover:bg-neutral-800"
                    >
                      <Sparkles className="h-3 w-3" />
                      {copy('使用', 'Usa')}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {blockedTools.length > 0 && (
          <div className="mt-4 border-t border-neutral-200 pt-3">
            <h4 className="text-[11px] font-bold uppercase tracking-wide text-neutral-400">{copy('暂不可用', 'Non disponibili')}</h4>
            <ul className="mt-2 space-y-1.5">
              {blockedTools.map(tool => {
                const label = tool.blockedReason ? blockedReasonLabels[tool.blockedReason] : null;
                return (
                  <li key={tool.toolId} className="flex items-center justify-between gap-2 text-[11px] text-neutral-500">
                    <span className="truncate">{tool.displayName?.zh || tool.toolId}</span>
                    <span className="shrink-0 rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-semibold text-neutral-600">
                      {label ? (isIt ? label.it : label.zh) : (tool.blockedReason ?? copy('不可用', 'Non disponibile'))}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </section>


      {activeTool && (
        <section className="rounded-2xl border border-neutral-200 bg-white p-5">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-neutral-950">{activeTool.displayName?.zh || activeTool.toolId}</h3>
            <button
              type="button"
              onClick={() => { setActiveToolId(null); setResult(null); }}
              className="rounded-lg px-2 py-1 text-[11px] font-semibold text-neutral-500 hover:bg-neutral-100"
            >
              {copy('关闭', 'Chiudi')}
            </button>
          </div>

          {activeTool.toolId === 'ai_tools_translate' ? (
            <div className="mt-3 space-y-3">
              <label className="block">
                <span className="text-[11px] font-semibold text-neutral-700">{copy('待翻译文本', 'Testo da tradurre')}</span>
                <textarea
                  value={form.text}
                  maxLength={2000}
                  onChange={event => setForm(prev => ({ ...prev, text: event.target.value }))}
                  rows={5}
                  className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2 text-xs text-neutral-900 outline-none focus:border-neutral-900"
                  placeholder={copy('粘贴商品标题、详情或邮件内容', 'Incolla titolo, descrizione o email')}
                />
                <span className="mt-1 block text-[10px] text-neutral-400">{form.text.length}/2000</span>
              </label>
              <label className="block">
                <span className="text-[11px] font-semibold text-neutral-700">{copy('目标语言', 'Lingua di destinazione')}</span>
                <select
                  value={form.targetLanguage}
                  onChange={event => setForm(prev => ({ ...prev, targetLanguage: event.target.value as (typeof languages)[number]['id'] }))}
                  className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2 text-xs text-neutral-900 outline-none focus:border-neutral-900"
                >
                  {languages.map(language => (
                    <option key={language.id} value={language.id}>{isIt ? language.it : language.zh}</option>
                  ))}
                </select>
              </label>
            </div>
          ) : (
            <div className="mt-3 space-y-3">
              <label className="block">
                <span className="text-[11px] font-semibold text-neutral-700">{copy('商品简报', 'Brief prodotto')}</span>
                <textarea
                  value={form.brief}
                  maxLength={800}
                  onChange={event => setForm(prev => ({ ...prev, brief: event.target.value }))}
                  rows={4}
                  className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2 text-xs text-neutral-900 outline-none focus:border-neutral-900"
                  placeholder={copy('例如：夏季亚麻西装外套，中性色，轻商务', 'Es. blazer in lino estivo, colori neutri')}
                />
                <span className="mt-1 block text-[10px] text-neutral-400">{form.brief.length}/800</span>
              </label>
              <div className="grid gap-3 sm:grid-cols-3">
                <label className="block">
                  <span className="text-[11px] font-semibold text-neutral-700">{copy('渠道', 'Canale')}</span>
                  <select
                    value={form.channel}
                    onChange={event => setForm(prev => ({ ...prev, channel: event.target.value as (typeof channels)[number]['id'] }))}
                    className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2 text-xs text-neutral-900 outline-none focus:border-neutral-900"
                  >
                    {channels.map(channel => (
                      <option key={channel.id} value={channel.id}>{isIt ? channel.it : channel.zh}</option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="text-[11px] font-semibold text-neutral-700">{copy('语气', 'Tono')}</span>
                  <select
                    value={form.tone}
                    onChange={event => setForm(prev => ({ ...prev, tone: event.target.value as (typeof tones)[number]['id'] }))}
                    className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2 text-xs text-neutral-900 outline-none focus:border-neutral-900"
                  >
                    {tones.map(tone => (
                      <option key={tone.id} value={tone.id}>{isIt ? tone.it : tone.zh}</option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="text-[11px] font-semibold text-neutral-700">{copy('输出语言', 'Lingua')}</span>
                  <select
                    value={form.language}
                    onChange={event => setForm(prev => ({ ...prev, language: event.target.value as (typeof languages)[number]['id'] }))}
                    className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2 text-xs text-neutral-900 outline-none focus:border-neutral-900"
                  >
                    {languages.map(language => (
                      <option key={language.id} value={language.id}>{isIt ? language.it : language.zh}</option>
                    ))}
                  </select>
                </label>
              </div>
            </div>
          )}


          <button
            type="button"
            onClick={() => void invoke()}
            disabled={submitting || (activeTool.toolId === 'ai_tools_translate' ? form.text.trim().length === 0 : form.brief.trim().length === 0)}
            className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-neutral-900 px-4 py-2 text-xs font-semibold text-white hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            {submitting ? copy('生成中…', 'Generazione…') : copy('开始生成', 'Genera')}
          </button>

          {result && (
            <div className="mt-4 rounded-xl border border-neutral-200 bg-neutral-50 p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wide text-neutral-500">{copy('结果', 'Risultato')}</span>
                <button
                  type="button"
                  onClick={() => void copyResult()}
                  className="inline-flex items-center gap-1 rounded-lg border border-neutral-300 bg-white px-2 py-1 text-[11px] font-semibold text-neutral-700 hover:bg-neutral-50"
                >
                  {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                  {copied ? copy('已复制', 'Copiato') : copy('复制', 'Copia')}
                </button>
              </div>
              <pre className="mt-2 whitespace-pre-wrap break-words text-xs leading-5 text-neutral-900">{formatResultText(result.payload)}</pre>
            </div>
          )}
        </section>
      )}
    </div>
  );
};

