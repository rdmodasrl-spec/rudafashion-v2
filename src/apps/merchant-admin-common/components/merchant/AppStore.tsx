
import React, { useEffect, useState } from 'react';
import { useB2B } from '../../../../context/B2BContext';
import { ApiError, apiDelete, apiGet, apiPost } from '../../../../api/client';
import {
  Search,
  Mail,
  Bot,
  Users,
  Package,
  Warehouse,
  ShoppingCart,
  Megaphone,
  BarChart3,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  CreditCard,
  CheckCircle2,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface App {
  id: string;
  appId: string;
  name: string;
  slug: string;
  description: string;
  detailedIntro: string | null;
  icon: string;
  categoryId: string;
  category: { name: string; slug: string };
  version: string;
  pricingType: string;
  pricePlan: unknown;
  developer: string;
  runtimeAvailable: boolean;
  isInstalled: boolean;
  installationStatus: string | null;
  installedVersion: string | null;
  features: string;
  permissions: string;
  updatedAt: string;
}

interface AppCategory {
  id: string;
  name: string;
  slug: string;
  icon: string;
}

interface PricePlan {
  name: string;
  price: string | number;
  period?: string;
  features: string[];
}

interface AppStoreAppsResponse {
  apps: App[];
  categories: AppCategory[];
}

interface AppStoreMutationResponse {
  success: true;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function parseStringArray(value: string): string[] | null {
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return null;
    const values = parsed.filter((item): item is string => typeof item === 'string');
    return values.length === parsed.length ? values : null;
  } catch {
    return null;
  }
}

function parsePricePlans(value: unknown): PricePlan[] | null {
  if (!isRecord(value)) return null;
  const plans = value.plans;
  if (plans === undefined) return [];
  if (!Array.isArray(plans)) return null;

  const parsed: PricePlan[] = [];
  for (const plan of plans) {
    if (!isRecord(plan)) return null;
    const { name, price, period, features } = plan;
    if (typeof name !== 'string'
      || (typeof price !== 'string' && typeof price !== 'number')
      || (period !== undefined && typeof period !== 'string')
      || !Array.isArray(features)) return null;
    const featureNames = features.filter((feature): feature is string => typeof feature === 'string');
    if (featureNames.length !== features.length) return null;
    parsed.push({
      name,
      price,
      ...(typeof period === 'string' ? { period } : {}),
      features: featureNames
    });
  }
  return parsed;
}

function appStoreErrorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof ApiError)) return fallback;

  const messages: Record<string, string> = {
    APP_STORE_APP_NOT_AVAILABLE: '应用不可用，请刷新目录。',
    APP_STORE_APP_NOT_FOUND: '应用不存在，请刷新目录。',
    APP_STORE_APP_ID_INVALID: '应用信息无效，请刷新目录。',
    APP_STORE_PURCHASE_REQUIRED: '付费应用暂未开放。',
    APP_STORE_RUNTIME_UNAVAILABLE: '运行环境不可用，暂无法使用。',
    APP_STORE_RUNTIME_VERSION_UNSUPPORTED: '应用版本不兼容，暂无法使用。',
    APP_STORE_INSTALLATION_NOT_FOUND: '未找到安装记录，请刷新目录。',
    APP_STORE_INSTALLATION_STATE_INVALID: '当前状态无法执行此操作，请刷新目录。'
  };
  const knownMessage = error.code ? messages[error.code] : undefined;
  if (knownMessage) return knownMessage;
  if (error.status === 401) return '登录已失效，请重新登录。';
  if (error.status === 403) return '无权限执行此操作。';
  if (error.status === 408 || error.code === 'REQUEST_TIMEOUT') return '请求超时，请重试。';
  if (error.status === 409) return '状态已变化，请刷新后重试。';
  if (error.status >= 500) return '服务暂不可用，请稍后重试。';
  return fallback;
}

const getIconComponent = (iconName: string) => {
  switch (iconName) {
    case 'Mail': return Mail;
    case 'Bot': return Bot;
    case 'Users': return Users;
    case 'Package': return Package;
    case 'Warehouse': return Warehouse;
    case 'ShoppingCart': return ShoppingCart;
    case 'Megaphone': return Megaphone;
    case 'BarChart3': return BarChart3;
    case 'Factory': return Warehouse;
    default: return Package;
  }
};

export const AppStore: React.FC<{ onOpenApp?: (appId: string) => void }> = ({ onOpenApp }) => {
  const { addNotification } = useB2B();
  const [apps, setApps] = useState<App[]>([]);
  const [categories, setCategories] = useState<AppCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedApp, setSelectedApp] = useState<App | null>(null);
  const [view, setView] = useState<'store' | 'my-apps'>('store');
  const [busyAppId, setBusyAppId] = useState<string | null>(null);
  const selectedFeatures = selectedApp ? parseStringArray(selectedApp.features || '[]') : [];
  const selectedPermissions = selectedApp ? parseStringArray(selectedApp.permissions || '[]') : [];
  const selectedPricePlans = selectedApp ? parsePricePlans(selectedApp.pricePlan) : [];
  const selectedMetadataInvalid = selectedFeatures === null
    || selectedPermissions === null
    || selectedPricePlans === null;

  useEffect(() => {
    fetchApps();
    const onMerchantDataChanged = (event: Event) => {
      const resources = (event as CustomEvent<{ resources?: unknown[] }>).detail?.resources;
      if (Array.isArray(resources) && resources.includes('settings')) void fetchApps();
    };
    window.addEventListener('merchant-data-changed', onMerchantDataChanged);
    return () => window.removeEventListener('merchant-data-changed', onMerchantDataChanged);
  }, []);

  const fetchApps = async () => {
    try {
      setLoading(true);
      setLoadError(null);
      const data = await apiGet<AppStoreAppsResponse>('/api/app-store/apps');
      if (!Array.isArray(data.apps) || !Array.isArray(data.categories)) throw new Error('INVALID_APP_STORE_RESPONSE');
      setApps(data.apps);
      setCategories(data.categories);
    } catch (error) {
      const message = appStoreErrorMessage(error, '应用目录读取失败，请重试。');
      setLoadError(message);
      addNotification('warning', '加载失败', message);
    } finally {
      setLoading(false);
    }
  };

  const handleInstall = async (appId: string) => {
    setBusyAppId(appId);
    try {
      await apiPost<AppStoreMutationResponse>('/api/app-store/installations', { appId });
      addNotification('success', '已安装', '启用后可使用。');
      await fetchApps();
      setSelectedApp(current => current?.appId === appId
        ? { ...current, isInstalled: true, installationStatus: 'installed', installedVersion: current.version }
        : current);
    } catch (error) {
      addNotification('warning', '安装失败', appStoreErrorMessage(error, '安装未完成，请重试。'));
    } finally {
      setBusyAppId(null);
    }
  };

  const handleInstallationAction = async (appId: string, action: 'enable' | 'disable') => {
    setBusyAppId(appId);
    try {
      await apiPost<AppStoreMutationResponse>(`/api/app-store/installations/${encodeURIComponent(appId)}/${action}`, {});
      await fetchApps();
      const status = action === 'enable' ? 'active' : 'disabled';
      setSelectedApp(current => current?.appId === appId
        ? {
            ...current,
            isInstalled: true,
            installationStatus: status,
            installedVersion: action === 'enable' ? current.version : current.installedVersion
          }
        : current);
      addNotification('success', action === 'enable' ? '已启用' : '已停用', '状态已更新。');
    } catch (error) {
      addNotification('warning', '状态未更改', appStoreErrorMessage(error, '操作未完成，请重试。'));
    } finally {
      setBusyAppId(null);
    }
  };

  const handleUninstall = async (appId: string) => {
    if (!confirm('确认卸载？域名验证记录会保留。')) return;

    setBusyAppId(appId);
    try {
      await apiDelete<AppStoreMutationResponse>(`/api/app-store/installations/${encodeURIComponent(appId)}`);
      addNotification('success', '已卸载', '安装记录已删除。');
      await fetchApps();
      setSelectedApp(current => current?.appId === appId
        ? { ...current, isInstalled: false, installationStatus: null, installedVersion: null }
        : current);
    } catch (error) {
      addNotification('warning', '卸载失败', appStoreErrorMessage(error, '卸载未完成，请重试。'));
    } finally {
      setBusyAppId(null);
    }
  };

  const filteredApps = apps.filter(app => {
    const matchesSearch = app.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          app.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = !selectedCategory || app.category.slug === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const myApps = apps.filter(app => app.isInstalled);

  return (
    <div className="min-h-screen bg-white pb-8">
      {/* Header */}
      <div className="bg-white px-4 pb-5 pt-5 sm:px-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-neutral-950 sm:text-3xl">应用商店</h1>
            </div>
            <div className="flex w-fit bg-neutral-100 p-1 rounded-xl">
              <button
                onClick={() => setView('store')}
                className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all ${view === 'store' ? 'bg-white text-black shadow-sm' : 'text-neutral-500 hover:text-neutral-700'}`}
              >
                应用目录
              </button>
              <button
                onClick={() => setView('my-apps')}
                className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all ${view === 'my-apps' ? 'bg-white text-black shadow-sm' : 'text-neutral-500 hover:text-neutral-700'}`}
              >
                已安装
                {myApps.length > 0 && (
                  <span className="ml-2 bg-black text-white px-2 py-0.5 rounded-full text-[10px]">
                    {myApps.length}
                  </span>
                )}
              </button>
            </div>
          </div>

          {view === 'store' && (
            <div className="mt-4 flex flex-col gap-3 border-t border-neutral-100 pt-4 sm:flex-row sm:items-center">
              <div className="relative flex-1 w-full group">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400 group-focus-within:text-black transition-colors" />
                <input
                  type="text"
                  placeholder="搜索应用"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-xl border border-neutral-200 bg-neutral-50 py-2.5 pl-10 pr-3 text-sm outline-none transition-all focus:border-black"
                />
              </div>
              <div className="flex gap-3 overflow-x-auto w-full md:w-auto pb-2 md:pb-0 no-scrollbar">
                <button
                  onClick={() => setSelectedCategory(null)}
                  className={`rounded-lg px-3 py-2 text-xs font-semibold whitespace-nowrap transition-all ${!selectedCategory ? 'bg-black text-white' : 'bg-white border border-neutral-200 text-neutral-600 hover:border-black'}`}
                >
                  全部
                </button>
                {categories.map(cat => (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.slug)}
                    className={`rounded-lg px-3 py-2 text-xs font-semibold whitespace-nowrap transition-all ${selectedCategory === cat.slug ? 'bg-black text-white' : 'bg-white border border-neutral-200 text-neutral-600 hover:border-black'}`}
                  >
                    {cat.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        {loading ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-36 animate-pulse rounded-xl bg-neutral-50" />
            ))}
          </div>
        ) : loadError ? (
          <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4">
            <p className="text-sm font-semibold text-rose-900">应用目录加载失败</p>
            <p className="mt-1 break-words text-xs text-rose-800">{loadError}</p>
            <button type="button" onClick={() => void fetchApps()} className="mt-3 rounded-lg bg-neutral-950 px-3 py-2 text-xs font-semibold text-white">重试</button>
          </div>
        ) : view === 'store' ? (
          <div>
            <section>
              <div className="mb-4 flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-neutral-900">
                  {selectedCategory ? categories.find(c => c.slug === selectedCategory)?.name : '全部应用'}
                </h2>
                <span className="text-[11px] text-neutral-500">{filteredApps.length} 个应用</span>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                {filteredApps.map(app => (
                  <motion.div
                    key={app.id}
                    layout
                    whileHover={{ y: -8 }}
                    className="flex h-full cursor-pointer flex-col rounded-xl border border-neutral-200 bg-white p-4 transition-shadow hover:shadow-md"
                    onClick={() => setSelectedApp(app)}
                  >
                    <div className="mb-3 flex items-start justify-between">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-neutral-100 bg-neutral-50 text-neutral-700">
                        {React.createElement(getIconComponent(app.icon), { className: "w-8 h-8" })}
                      </div>
                      {app.isInstalled && (
                        <span className="flex items-center gap-2 text-emerald-700 text-[10px] font-bold uppercase tracking-widest bg-emerald-50 px-4 py-1.5 rounded-full border border-emerald-100">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          {app.installationStatus === 'active'
                            ? '已启用'
                            : app.installationStatus === 'disabled'
                                ? '已停用'
                                : '已安装'}
                        </span>
                      )}
                    </div>
                    <h3 className="mb-1 text-sm font-semibold text-neutral-950">{app.name}</h3>
                    <div className="mt-auto flex items-center justify-between border-t border-neutral-100 pt-3">
                      <span className="text-[10px] font-medium text-neutral-500">
                        {app.category.name}
                      </span>
                      <div className="flex items-center gap-1 text-xs font-semibold text-neutral-900">
                        {app.pricingType !== 'free'
                          ? '付费未开放'
                          : app.runtimeAvailable ? '免费' : '运行环境不可用'}
                        <ChevronRight className="w-4 h-4 text-neutral-300" />
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </section>

            {filteredApps.length === 0 && (
              <div className="text-center py-12">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-neutral-100">
                <Search className="h-5 w-5 text-neutral-400" />
              </div>
              <h3 className="text-sm font-semibold text-neutral-900">没有匹配的应用</h3>
              </div>
            )}
          </div>
        ) : (
          /* My Apps View */
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-neutral-900">已安装</h2>
              <p className="text-[11px] text-neutral-500">{myApps.length} 个应用</p>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
              {myApps.length > 0 ? myApps.map(app => (
                <div
                  key={app.id}
                  className="rounded-xl border border-neutral-200 bg-white p-4 transition-shadow hover:shadow-md"
                >
                  <div className="flex justify-between items-start mb-10">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-neutral-950">
                      {React.createElement(getIconComponent(app.icon), { className: "w-8 h-8 text-white" })}
                    </div>
                    <button
                      onClick={() => setSelectedApp(app)}
                      className="p-3 hover:bg-neutral-50 rounded-full transition-colors group-hover:rotate-45 duration-500"
                    >
                      <ExternalLink className="w-5 h-5 text-neutral-300" />
                    </button>
                  </div>
                  <h3 className="mb-1 text-sm font-semibold text-neutral-950">{app.name}</h3>
                  <div className="flex gap-4">
                    {app.installationStatus === 'active' && app.runtimeAvailable && onOpenApp ? (
                      <button
                        onClick={() => onOpenApp(app.appId)}
                        className="flex-1 rounded-lg bg-black py-2.5 text-xs font-semibold text-white hover:bg-neutral-800"
                      >
                        打开应用
                      </button>
                    ) : (
                      <span className="flex-1 self-center text-center text-xs text-neutral-400">
                        {app.installationStatus === 'active'
                          ? '运行环境不可用'
                          : `状态：${app.installationStatus}`}
                      </span>
                    )}
                    {app.installationStatus !== 'active' && (
                      <button
                        type="button"
                        disabled={busyAppId === app.appId || !app.runtimeAvailable}
                        onClick={() => void handleInstallationAction(app.appId, 'enable')}
                        className="rounded-lg bg-black px-3 py-2.5 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:bg-neutral-300"
                      >
                        启用
                      </button>
                    )}
                    {app.installationStatus === 'active' && (
                      <button
                        type="button"
                        disabled={busyAppId === app.appId}
                        onClick={() => void handleInstallationAction(app.appId, 'disable')}
                        className="rounded-lg border border-neutral-200 px-3 py-2.5 text-xs font-semibold text-neutral-600 disabled:opacity-50"
                      >
                        停用
                      </button>
                    )}
                    <button
                      onClick={() => handleUninstall(app.appId)}
                      disabled={busyAppId === app.appId}
                      className="rounded-lg border border-neutral-200 px-3 py-2.5 text-xs font-semibold text-neutral-500 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              )) : (
                <div className="col-span-full rounded-xl border border-dashed border-neutral-200 bg-neutral-50 py-12 text-center">
                  <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-white">
                    <Package className="h-5 w-5 text-neutral-300" />
                  </div>
                  <h3 className="text-sm font-semibold text-neutral-900">暂无已安装应用</h3>
                  <button
                    onClick={() => setView('store')}
                    className="mt-4 rounded-lg bg-black px-4 py-2.5 text-xs font-semibold text-white"
                  >
                    浏览应用
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* App Detail Modal */}
      <AnimatePresence>
        {selectedApp && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-8">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedApp(null)}
              className="absolute inset-0 bg-black/60 backdrop-blur-xl"
            />
            <motion.div
              initial={{ opacity: 0, y: 100, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 100, scale: 0.9 }}
              className="relative flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-white/20 bg-white shadow-2xl"
            >
              <button
                onClick={() => setSelectedApp(null)}
                className="absolute right-3 top-3 z-20 rounded-full bg-neutral-50 p-2 transition-colors hover:bg-black hover:text-white sm:right-5 sm:top-5"
                aria-label="关闭"
              >
                <X className="w-6 h-6" />
              </button>

              <div className="overflow-y-auto no-scrollbar">
                {selectedMetadataInvalid && (
                  <p role="alert" className="mx-5 mt-5 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 sm:mx-6">
                    应用目录数据格式异常，部分信息暂不可显示。请联系平台管理员。
                  </p>
                )}
                {/* Modal Header */}
                <div className="flex flex-col items-start gap-4 p-5 pb-6 sm:flex-row sm:p-6">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-neutral-950 ring-1 ring-white/10 sm:h-16 sm:w-16">
                    {React.createElement(getIconComponent(selectedApp.icon), { className: "h-7 w-7 text-white" })}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="mb-3 flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-neutral-100 px-3 py-1 text-[10px] font-semibold text-neutral-600">
                        {selectedApp.category.name}
                      </span>
                      <span className="w-1.5 h-1.5 bg-neutral-200 rounded-full" />
                      <span className="truncate font-mono text-[10px] text-neutral-400">{selectedApp.appId}</span>
                    </div>
                    <h2 className="mb-2 text-xl font-semibold leading-tight tracking-tight text-neutral-950 sm:text-2xl">{selectedApp.name}</h2>
                    {selectedApp.appId === 'ruda-business-email' && (
                      <p className="mb-4 text-xs text-neutral-500">不提供邮箱服务</p>
                    )}
                    <div className="flex flex-wrap gap-2">
                      {selectedApp.isInstalled ? (
                        <div className="flex gap-4">
                          {selectedApp.installationStatus === 'active' && selectedApp.runtimeAvailable && onOpenApp ? (
                            <button
                              onClick={() => onOpenApp(selectedApp.appId)}
                              className="rounded-lg bg-black px-4 py-2.5 text-xs font-semibold text-white hover:bg-neutral-800"
                            >
                              打开应用
                            </button>
                          ) : selectedApp.installationStatus === 'active' ? (
                            <p className="self-center text-sm text-neutral-500">
                              运行环境不可用
                            </p>
                          ) : (
                            <button
                              type="button"
                              disabled={busyAppId === selectedApp.appId || !selectedApp.runtimeAvailable}
                              onClick={() => void handleInstallationAction(selectedApp.appId, 'enable')}
                              className="rounded-lg bg-black px-4 py-2.5 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:bg-neutral-300"
                            >
                              {busyAppId === selectedApp.appId ? '保存中…' : '启用'}
                            </button>
                          )}
                          {selectedApp.installationStatus === 'active' && (
                            <button
                              type="button"
                              disabled={busyAppId === selectedApp.appId}
                              onClick={() => void handleInstallationAction(selectedApp.appId, 'disable')}
                              className="rounded-lg border border-neutral-200 px-4 py-2.5 text-xs font-semibold text-neutral-700 disabled:opacity-50"
                            >
                              停用
                            </button>
                          )}
                          <button
                            onClick={() => handleUninstall(selectedApp.appId)}
                            disabled={busyAppId === selectedApp.appId}
                            className="rounded-lg border border-neutral-200 px-4 py-2.5 text-xs font-semibold text-neutral-600 hover:bg-red-50 hover:text-red-600"
                          >
                            卸载
                          </button>
                        </div>
                      ) : selectedApp.pricingType === 'free' && selectedApp.runtimeAvailable ? (
                        <button
                          disabled={busyAppId === selectedApp.appId}
                          onClick={() => handleInstall(selectedApp.appId)}
                          className="rounded-lg bg-black px-4 py-2.5 text-xs font-semibold text-white hover:bg-neutral-800 disabled:opacity-50"
                        >
                          {busyAppId === selectedApp.appId ? '安装中…' : '安装'}
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled
                          className="cursor-not-allowed rounded-2xl border border-neutral-200 px-6 py-4 text-sm font-semibold text-neutral-400"
                        >
                          {selectedApp.pricingType !== 'free' ? '付费功能未开放' : '运行环境不可用'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Modal Body */}
                <div className="grid grid-cols-1 gap-6 border-t border-neutral-100 p-5 pt-5 sm:p-6 lg:grid-cols-12">
                  <div className="space-y-5 lg:col-span-8">
                    <section>
                      <h3 className="mb-2 text-sm font-semibold text-neutral-900">功能</h3>
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        {(selectedFeatures || []).map((feature, idx) => (
                          <div key={idx} className="flex items-center gap-2 rounded-lg border border-neutral-100 bg-neutral-50 p-3">
                            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-white">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                            </div>
                            <span className="text-xs font-medium text-neutral-800">{feature}</span>
                          </div>
                        ))}
                      </div>
                    </section>
                  </div>

                  <div className="space-y-5 lg:col-span-4">
                    <section className="rounded-xl border border-neutral-200 bg-white p-4">
                      <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-neutral-900">
                        <CreditCard className="h-4 w-4 text-neutral-500" />
                        价格
                      </h3>
                      {selectedApp.pricingType !== 'free' && (
                        <p className="text-xs text-neutral-600">
                          付费尚未开放
                        </p>
                      )}
                      {selectedPricePlans?.length ? (
                        <div className="mt-3 space-y-3">
                          {selectedPricePlans.map((plan, idx) => (
                            <div key={idx} className="pb-8 border-b border-white/10 last:border-0 last:pb-0">
                              <div className="flex justify-between items-baseline mb-4">
                                <span className="text-lg font-bold text-white">{plan.name}</span>
                                <span className="text-sm font-semibold text-neutral-800">
                                  {plan.price === '0' || plan.price === 0 ? '免费' : `€${plan.price}`}
                                  {plan.period && <span className="ml-1 text-[10px] text-neutral-500">/{plan.period}</span>}
                                </span>
                              </div>
                              <ul className="space-y-3">
                                {plan.features.map((f, fidx) => (
                                  <li key={fidx} className="flex items-center gap-2 text-xs text-neutral-500">
                                    <div className="h-1.5 w-1.5 rounded-full bg-neutral-500" />
                                    {f}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="py-2 text-xs text-neutral-500">{selectedApp.pricingType === 'free' ? '免费' : '价格尚未配置'}</div>
                      )}
                    </section>

                    <section className="rounded-xl border border-neutral-200 p-4">
                      <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold text-neutral-700">
                        <ShieldCheck className="h-4 w-4" />
                        权限
                      </h3>
                      <div className="space-y-4">
                        {(selectedPermissions || []).map((perm, idx) => (
                          <div key={idx} className="flex items-center justify-between gap-2 border-b border-neutral-100 py-2 last:border-0">
                            <span className="break-all font-mono text-[10px] text-neutral-600">{perm}</span>
                            <span className="shrink-0 text-[9px] text-neutral-400">已声明</span>
                          </div>
                        ))}
                      </div>
                    </section>

                    <div className="space-y-2 border-t border-neutral-100 pt-3">
                      <div className="flex justify-between gap-2 text-[10px] text-neutral-500">
                        <span>开发者</span>
                        <span className="text-right font-semibold text-neutral-900">{selectedApp.developer}</span>
                      </div>
                      <div className="flex justify-between gap-2 text-[10px] text-neutral-500">
                        <span>目录版本</span>
                        <span className="font-semibold text-neutral-900">{selectedApp.version}</span>
                      </div>
                      {selectedApp.isInstalled && (
                        <div className="flex justify-between gap-2 text-[10px] text-neutral-500">
                          <span>安装版本</span>
                          <span className="font-semibold text-neutral-900">
                            {selectedApp.installedVersion || '待启用后记录'}
                          </span>
                        </div>
                      )}
                      <div className="flex justify-between gap-2 text-[10px] text-neutral-500">
                        <span>更新</span>
                        <span className="font-semibold text-neutral-900">{new Date(selectedApp.updatedAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
