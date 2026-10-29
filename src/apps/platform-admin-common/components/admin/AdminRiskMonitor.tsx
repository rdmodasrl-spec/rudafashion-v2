import React, { useEffect, useMemo, useState } from 'react';
import { useB2B } from '../../../../context/B2BContext';
import { Shield, AlertTriangle, AlertOctagon, CheckCircle, Search, Clock, Package, CreditCard, User as UserIc, Zap, Filter } from 'lucide-react';
import type { RiskAlert } from '../../../../types/b2b';
import { AdminPageHeader } from './AdminPageHeader';

const typeMeta: Record<RiskAlert['type'], { label: string; ic: any }> = {
  order_frequency: { label: '高频下单异常', ic: Zap },
  inventory_anomaly: { label: 'SKU 库存告警', ic: Package },
  credit_limit: { label: '买家账期超限', ic: CreditCard },
  login_geo: { label: '可疑登录', ic: UserIc },
  return_rate: { label: '退货率异常', ic: AlertOctagon },
  payment_failure: { label: '支付失败重试过多', ic: CreditCard },
};

const sevMeta: Record<RiskAlert['severity'], { label: string; cls: string }> = {
  info: { label: '提示', cls: 'bg-neutral-50 text-neutral-700 border-neutral-200' },
  low: { label: '低', cls: 'bg-neutral-50 text-neutral-700 border-neutral-200' },
  medium: { label: '中', cls: 'bg-neutral-100 text-neutral-800 border-neutral-300' },
  high: { label: '高', cls: 'bg-neutral-200 text-neutral-900 border-neutral-400' },
  critical: { label: '紧急', cls: 'bg-neutral-900 text-white border-neutral-900' },
};

export const AdminRiskMonitor: React.FC = () => {
  const { riskAlerts, loadRiskAlerts, acknowledgeRiskAlert } = useB2B();
  const [f, setF] = useState<{ sev?: RiskAlert['severity']; t?: RiskAlert['type']; onlyOpen: boolean; q: string }>({ onlyOpen: true, q: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [ackingId, setAckingId] = useState<string | null>(null);

  const loadAlerts = async () => {
    setLoading(true);
    setError('');
    try {
      await loadRiskAlerts();
      setLastUpdated(new Date());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '告警读取失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadAlerts(); }, []);

  const alerts = riskAlerts;

  const filtered = useMemo(() => alerts.filter(a => {
    if (f.onlyOpen && a.isAcknowledged) return false;
    if (f.sev && a.severity !== f.sev) return false;
    if (f.t && a.type !== f.t) return false;
    if (f.q) {
      const s = f.q.toLowerCase();
      return a.title.toLowerCase().includes(s) || (a.entityId || '').toLowerCase().includes(s) || a.description.toLowerCase().includes(s);
    }
    return true;
  }), [alerts, f]);

  const sevCounts = useMemo(() => {
    const m: Record<RiskAlert['severity'], number> = { info: 0, low: 0, medium: 0, high: 0, critical: 0 };
    alerts.filter(a => !a.isAcknowledged).forEach(a => { m[a.severity] += 1; });
    return m;
  }, [alerts]);

  const ack = async (id: string) => {
    if (ackingId) return;
    setAckingId(id);
    setError('');
    try {
      await acknowledgeRiskAlert(id);
      setLastUpdated(new Date());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '告警确认失败');
    } finally {
      setAckingId(null);
    }
  };

  return (
    <div className="max-w-[1500px] mx-auto px-4 md:px-6 py-6 md:py-10">
      <AdminPageHeader title="风险监测" actions={<button onClick={() => void loadAlerts()} disabled={loading} className="ui-secondary-button inline-flex min-h-9 items-center gap-2 px-3 text-xs disabled:opacity-50">
        <Clock className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> {loading ? '正在刷新…' : '刷新告警'}
      </button>} />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-neutral-200 bg-white px-4 py-3 text-xs text-neutral-600">
        {loading && <span>正在读取告警…</span>}
        <span>最近更新：{lastUpdated ? lastUpdated.toLocaleString() : '暂无'}</span>
      </div>
      {error && <div role="alert" className="mb-4 rounded-xl border border-neutral-300 bg-neutral-50 p-4 text-sm text-neutral-800">告警操作失败：{error}<button type="button" onClick={() => void loadAlerts()} className="ml-3 underline">重试</button></div>}

      <div className="grid grid-cols-2 gap-2 mb-5 sm:grid-cols-3 md:gap-4 md:mb-8 lg:grid-cols-6">
        <div className="lg:col-span-1 rounded-2xl border border-neutral-800 bg-neutral-900 p-3 text-white md:p-6">
          <div className="mb-2 flex items-center justify-between md:mb-4">
            <div className="w-11 h-11 rounded-2xl bg-neutral-800 flex items-center justify-center"><Shield className="w-5 h-5" /></div>
            <span className="text-[10px] uppercase tracking-widest opacity-75 font-bold">实时</span>
          </div>
          <div className="text-[11px] uppercase tracking-wider opacity-70 mb-1 font-bold">未处理告警</div>
          <div className="font-black text-4xl md:text-5xl tabular-nums">{alerts.filter(alert => !alert.isAcknowledged).length}</div>
        </div>
        {(Object.keys(sevCounts) as Array<keyof typeof sevCounts>).map(k => {
          const s = sevMeta[k];
          return (
            <button key={k} onClick={() => setF(prev => ({ ...prev, sev: prev.sev === k ? undefined : k }))}
              className={`rounded-2xl border-2 p-3 text-left transition md:p-5 ${f.sev === k ? 'border-neutral-900 shadow-md bg-white' : 'border-transparent bg-white hover:bg-neutral-50'}`}>
              <div className={`mb-2 inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[10px] font-black ${s.cls} md:mb-3`}>{s.label}</div>
              <div className="font-black text-3xl md:text-4xl tabular-nums text-neutral-950 mb-1">{sevCounts[k]}</div>
              <div className="text-xs text-neutral-500">条 {f.sev === k ? '✓ 筛选中' : '未处理'}</div>
            </button>
          );
        })}
      </div>

      <div className="ui-card p-4 md:p-5 mb-5 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input value={f.q} onChange={e => setF(p => ({ ...p, q: e.target.value }))} placeholder="搜索告警"
            className="w-full pl-11 pr-4 py-3 rounded-xl border border-neutral-200 bg-white text-sm focus:border-neutral-900 focus:outline-none" />
        </div>
        <div className="flex items-center gap-1 p-1 rounded-xl bg-neutral-100">
          <Filter className="w-4 h-4 text-neutral-500 mx-2" />
          {(Object.keys(typeMeta) as (keyof typeof typeMeta)[]).map(t => {
            const m = typeMeta[t];
            const Ic = m.ic;
            return (
              <button key={t} onClick={() => setF(p => ({ ...p, t: p.t === t ? undefined : t }))}
                title={m.label}
                className={`w-10 h-10 rounded-lg flex items-center justify-center transition ${f.t === t ? 'bg-neutral-900 text-white shadow' : 'text-neutral-600 hover:bg-white'}`}>
                <Ic className="w-4 h-4" />
              </button>
            );
          })}
        </div>
        <label className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-neutral-100 cursor-pointer text-xs font-bold text-neutral-700">
          <input type="checkbox" checked={f.onlyOpen} onChange={e => setF(p => ({ ...p, onlyOpen: e.target.checked }))} className="accent-neutral-900 w-4 h-4" />
          仅看未处理
        </label>
        {(f.sev || f.t || f.q || !f.onlyOpen) && (
          <button onClick={() => setF({ q: '', onlyOpen: true })} className="text-xs font-bold text-neutral-500 hover:text-neutral-900 ml-auto">清除筛选</button>
        )}
      </div>

      <div className="space-y-3 pb-12">
        {filtered.length === 0 && (
          <div className="ui-card p-16 text-center">
              <CheckCircle className="w-16 h-16 mx-auto mb-4 text-neutral-500" />
              <h3 className="font-black text-xl mb-2">{loading ? '正在读取告警' : error ? '告警暂不可用' : '当前无匹配告警'}</h3>
              <p className="text-sm text-neutral-500">{error ? '请检查错误并重试，不能将读取失败视为无告警。' : '调整筛选条件或刷新告警。'}</p>
          </div>
        )}
        {filtered.map(a => {
          const tm = typeMeta[a.type];
          const sm = sevMeta[a.severity];
          const Ic = tm.ic;
          return (
            <div key={a.id} className={`ui-card p-5 md:p-6 transition hover:shadow-lg ${a.isAcknowledged ? 'opacity-60' : ''} ${a.severity === 'critical' ? 'ring-2 ring-neutral-700 ring-offset-2' : ''}`}>
              <div className="flex flex-wrap items-start gap-4">
                <div className="w-14 h-14 shrink-0 rounded-2xl bg-neutral-900 text-white flex items-center justify-center shadow-lg relative">
                  <Ic className="w-6 h-6" />
                  {!a.isAcknowledged && <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-neutral-600 border-2 border-white animate-pulse" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1.5">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-black border ${sm.cls}`}>{sm.label}</span>
                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-neutral-100 text-neutral-700`}>
                      <Ic className="w-3 h-3" /> {tm.label}
                    </span>
                    {a.isAcknowledged && <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-neutral-100 text-neutral-700 border border-neutral-300">
                      <CheckCircle className="w-3 h-3" /> 已确认处理
                    </span>}
                  </div>
                  <h3 className="font-black text-lg md:text-xl text-neutral-950 leading-snug mb-2">{a.title}</h3>
                  {a.description && <p className="text-sm text-neutral-600 leading-7 mb-3 whitespace-pre-wrap line-clamp-3">{a.description}</p>}
                  <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-neutral-500">
                    <span>⏰ {new Date(a.createdAt).toLocaleString()}</span>
                    {a.entityId && <span>🏷 实体ID <code className="bg-neutral-100 px-2 py-0.5 rounded font-mono text-[10px]">{a.entityId.slice(0, 14)}...</code></span>}
                    {a.metricName && a.metricValue !== undefined && <span>{a.metricName}: <b className="text-neutral-900 tabular-nums">{a.metricValue}</b></span>}
                    <span>👤 {a.entity || 'System Auto'}</span>
                  </div>
                </div>
                <div className="flex flex-col md:flex-row shrink-0 gap-2">
                  {!a.isAcknowledged && (
                    <button onClick={() => void ack(a.id)} disabled={ackingId !== null} className="ui-primary-button !py-2.5 !px-4 !text-xs flex items-center gap-1.5 whitespace-nowrap disabled:opacity-50">
                      <CheckCircle className="w-3.5 h-3.5" /> {ackingId === a.id ? '提交中…' : '确认处理'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
