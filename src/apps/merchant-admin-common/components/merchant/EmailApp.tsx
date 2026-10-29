
import React, { useEffect, useState } from 'react';
import { useB2B } from '../../../../context/B2BContext';
import { ApiError, apiGet, apiPost } from '../../../../api/client';
import {
  Mail,
  AlertCircle,
  Plus,
  ShieldCheck,
  Globe,
  CheckCircle2,
  Clock,
  ChevronLeft
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface EmailDomain {
  id: string;
  domainName: string;
  isVerified: boolean;
  verificationRecordName: string;
  verificationRecordValue: string;
  spfStatus: string;
  dkimStatus: string;
  dmarcStatus: string;
}

interface EmailStatusResponse {
  serviceStatus: string;
}

interface EmailDomainsResponse {
  domains: EmailDomain[];
}

function emailDomainErrorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof ApiError)) return fallback;

  const messages: Record<string, string> = {
    EMAIL_DOMAIN_INVALID: '域名格式无效，请检查后重试。',
    EMAIL_DOMAIN_ALREADY_ADDED: '此域名已添加。',
    EMAIL_DOMAIN_NOT_FOUND: '域名记录不存在，请刷新后重试。',
    EMAIL_DOMAIN_DNS_RECORD_NOT_FOUND: '暂未找到 TXT 记录，请检查主机名和值，并等待 DNS 生效。',
    EMAIL_DOMAIN_DNS_TOKEN_MISMATCH: '已找到 TXT 记录，但记录值不匹配。',
    EMAIL_DOMAIN_DNS_LOOKUP_FAILED: 'DNS 查询失败，请稍后重试。',
    APP_STORE_APP_NOT_ENABLED: '请先启用邮箱域名配置应用。'
  };
  const knownMessage = error.code ? messages[error.code] : undefined;
  if (knownMessage) return knownMessage;
  if (error.status === 401) return '登录已失效，请重新登录。';
  if (error.status === 403) return '无权限执行此操作。';
  if (error.status === 408 || error.code === 'REQUEST_TIMEOUT') return '请求超时，请重试。';
  if (error.status === 409) return '状态已变化，请刷新后重试。';
  if (error.status === 429) return '操作过于频繁，请稍后重试。';
  if (error.status >= 500) return '服务暂不可用，请稍后重试。';
  return fallback;
}

export const EmailApp: React.FC<{ onBack?: () => void }> = ({ onBack }) => {
  const { addNotification } = useB2B();
  const [view, setView] = useState<'dashboard' | 'domains'>('dashboard');
  const [status, setStatus] = useState<{ serviceStatus: string } | null>(null);
  const [domains, setDomains] = useState<EmailDomain[]>([]);
  const [loading, setLoading] = useState(true);
  const [verifyingDomainId, setVerifyingDomainId] = useState<string | null>(null);
  const [isAddingDomain, setIsAddingDomain] = useState(false);
  const [addingDomainBusy, setAddingDomainBusy] = useState(false);
  const [newDomainName, setNewDomainName] = useState('');

  useEffect(() => {
    void fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    try {
      setLoading(true);
      const [statusData, domainsData] = await Promise.all([
        apiGet<EmailStatusResponse>('/api/merchant/email/status'),
        apiGet<EmailDomainsResponse>('/api/merchant/email/domains')
      ]);
      if (!Array.isArray(domainsData.domains)) throw new Error('INVALID_EMAIL_DOMAIN_RESPONSE');
      setStatus(statusData);
      setDomains(domainsData.domains);
    } catch (error) {
      addNotification('warning', '加载失败', emailDomainErrorMessage(error, '域名读取失败，请重试。'));
    } finally {
      setLoading(false);
    }
  };

  const handleAddDomain = async () => {
    if (!newDomainName.trim() || addingDomainBusy) return;
    setAddingDomainBusy(true);
    try {
      await apiPost('/api/merchant/email/domains', { domainName: newDomainName });
      addNotification('success', '域名已添加', '添加 TXT 记录后验证所有权。');
      setIsAddingDomain(false);
      setNewDomainName('');
      await fetchInitialData();
    } catch (error) {
      addNotification('warning', '添加失败', emailDomainErrorMessage(error, '域名添加失败，请重试。'));
    } finally {
      setAddingDomainBusy(false);
    }
  };

  const handleVerifyDomain = async (domain: EmailDomain) => {
    setVerifyingDomainId(domain.id);
    try {
      await apiPost(`/api/merchant/email/domains/${encodeURIComponent(domain.id)}/verify`, {});
      addNotification('success', '域名已验证', `${domain.domainName} 所有权验证通过。`);
      await fetchInitialData();
    } catch (error) {
      addNotification('warning', '验证失败', emailDomainErrorMessage(error, '请检查 DNS TXT 记录后重试。'));
    } finally {
      setVerifyingDomainId(null);
    }
  };

  if (loading && !status) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex flex-col gap-3 mb-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          {onBack && (
            <button type="button" onClick={onBack} aria-label="返回应用商店" className="rounded-lg border border-neutral-200 p-2 text-neutral-600">
              <ChevronLeft className="h-4 w-4" />
            </button>
          )}
          <div className="bg-neutral-950 p-3 rounded-2xl">
            <Mail className="w-8 h-8 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-neutral-950">邮箱域名</h1>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-5 border-b border-neutral-200 mb-5">
        {[
          { id: 'dashboard', label: '概览', icon: Globe },
          { id: 'domains', label: '域名配置', icon: ShieldCheck }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setView(tab.id as typeof view)}
            className={`pb-4 text-sm font-medium flex items-center gap-2 transition-all relative ${view === tab.id ? 'text-black' : 'text-neutral-400 hover:text-neutral-600'}`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
            {view === tab.id && (
              <motion.div layoutId="email-tab-indicator" className="absolute bottom-0 left-0 right-0 h-0.5 bg-black" />
            )}
          </button>
        ))}
      </div>

      <div className="min-h-[60vh]">
        {view === 'dashboard' && (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="space-y-4 md:col-span-2">
              {/* Service Status Card */}
              <div className="rounded-xl border border-neutral-200 bg-white p-4 sm:p-5">
                <div className="mb-4 flex items-center justify-between gap-2">
                  <h3 className="text-sm font-bold">服务状态</h3>
                  <span className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                    status?.serviceStatus === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                  }`}>
                    {status?.serviceStatus === 'active' ? <CheckCircle2 className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                    {status?.serviceStatus === 'active' ? '已开通' : '待配置'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                  <div className="space-y-1">
                    <p className="text-[10px] text-neutral-500">域名</p>
                    <p className="text-2xl font-bold">{domains.length}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] text-neutral-500">已验证</p>
                    <p className="text-2xl font-bold text-emerald-600">{domains.filter(d => d.isVerified).length}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] text-neutral-500">邮箱服务</p>
                    <p className="text-xs font-bold text-amber-700">未开通</p>
                  </div>
                </div>
                <p className="mt-4 text-xs text-neutral-600">仅验证域名</p>
              </div>

              {/* Quick Actions */}
              <div className="grid grid-cols-1 gap-3">
                <button
                  onClick={() => setIsAddingDomain(true)}
                  className="flex items-center gap-3 rounded-xl border border-neutral-200 bg-white p-4 transition-colors hover:border-black"
                >
                  <div className="bg-neutral-100 p-3 rounded-xl group-hover:bg-black group-hover:text-white transition-colors">
                    <Globe className="w-6 h-6" />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-semibold text-neutral-900">添加域名</p>
                    <p className="text-xs text-neutral-500">生成 TXT 所有权验证记录</p>
                  </div>
                </button>
              </div>
            </div>

          </div>
        )}

        {view === 'domains' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold">域名列表</h3>
              </div>
              <button
                onClick={() => setIsAddingDomain(true)}
                className="flex shrink-0 items-center gap-1.5 rounded-lg bg-black px-3 py-2 text-xs font-semibold text-white"
              >
                <Plus className="h-4 w-4" /> 添加
              </button>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {domains.map(domain => (
                <div key={domain.id} className="rounded-xl border border-neutral-200 bg-white p-4">
                  <div className="mb-4 flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div className="bg-neutral-100 p-2.5 rounded-xl">
                        <Globe className="w-5 h-5 text-neutral-700" />
                      </div>
                      <div>
                        <h4 className="font-bold text-neutral-900">{domain.domainName}</h4>
                        <p className="mt-0.5 text-[10px] text-neutral-500">域名</p>
                      </div>
                    </div>
                    {domain.isVerified ? (
                      <span className="flex items-center gap-1.5 text-emerald-600 text-[10px] font-bold bg-emerald-50 px-2 py-1 rounded-full uppercase tracking-wider">
                        <CheckCircle2 className="w-3 h-3" /> 已验证
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5 text-amber-600 text-[10px] font-bold bg-amber-50 px-2 py-1 rounded-full uppercase tracking-wider">
                        <AlertCircle className="w-3 h-3" /> 待验证
                      </span>
                    )}
                  </div>

                  <div className="mb-3 rounded-lg bg-neutral-50 p-3">
                    <p className="text-[10px] font-bold text-neutral-600">TXT 验证记录</p>
                    <p className="mt-2 text-[10px] text-neutral-500">主机名</p>
                    <code className="mt-1 block break-all text-xs text-neutral-900">{domain.verificationRecordName}</code>
                    <p className="mt-2 text-[10px] text-neutral-500">记录值</p>
                    <code className="mt-1 block break-all text-xs text-neutral-900">{domain.verificationRecordValue}</code>
                  </div>
                  <button
                    type="button"
                    disabled={domain.isVerified || verifyingDomainId !== null}
                    onClick={() => void handleVerifyDomain(domain)}
                    className="w-full rounded-lg border border-neutral-200 py-2.5 text-xs font-semibold text-neutral-700 transition-colors hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {domain.isVerified ? '已验证' : verifyingDomainId === domain.id ? '正在查询 DNS…' : '验证 TXT 记录'}
                  </button>
                </div>
              ))}
              {domains.length === 0 && (
                <div className="col-span-full rounded-xl border border-dashed border-neutral-200 bg-neutral-50 py-10 text-center">
                  <Globe className="mx-auto mb-3 h-6 w-6 text-neutral-300" />
                  <p className="text-xs text-neutral-500">暂无域名</p>
                  <button
                    onClick={() => setIsAddingDomain(true)}
                    className="mt-3 text-xs font-semibold text-black hover:underline"
                  >
                    添加域名
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

      </div>

      {/* Add Domain Modal */}
      <AnimatePresence>
        {isAddingDomain && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsAddingDomain(false)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              role="dialog"
              aria-modal="true"
              aria-labelledby="add-email-domain-title"
              className="relative w-full max-w-md rounded-xl bg-white p-5 shadow-2xl"
            >
              <h3 id="add-email-domain-title" className="mb-4 text-base font-bold">添加域名</h3>
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-neutral-700">域名</label>
                  <input
                    type="text"
                    autoComplete="url"
                    maxLength={253}
                    disabled={addingDomainBusy}
                    value={newDomainName}
                    onChange={(e) => setNewDomainName(e.target.value)}
                    placeholder="例如：brandname.com"
                    className="w-full rounded-lg border border-neutral-200 px-3 py-2.5 text-sm outline-none focus:border-neutral-800 disabled:bg-neutral-50"
                  />
                </div>
                <div className="flex gap-3">
                  <button
                    type="button"
                    disabled={addingDomainBusy}
                    onClick={() => setIsAddingDomain(false)}
                    className="flex-1 rounded-lg border border-neutral-200 py-2.5 text-xs font-semibold text-neutral-600 disabled:opacity-50"
                  >
                    取消
                  </button>
                  <button
                    type="button"
                    disabled={addingDomainBusy || !newDomainName.trim()}
                    onClick={() => void handleAddDomain()}
                    className="flex-1 rounded-lg bg-black py-2.5 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:bg-neutral-300"
                  >
                    {addingDomainBusy ? '添加中…' : '确认添加'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}

      </AnimatePresence>
    </div>
  );
};
