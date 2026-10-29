
import React, { useEffect, useState } from 'react';
import { useB2B } from '../../../../context/B2BContext';
import { apiDelete, apiGet, apiPost, apiPut } from '../../../../api/client';
import { describeAppStoreError } from '../../appStoreErrors';
import { AdminPageHeader } from './AdminPageHeader';
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  Eye,
  EyeOff,
  Grid2X2,
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
  Save,
  X,
  PlusCircle,
  LayoutGrid
} from 'lucide-react';

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
  status: string;
  pricingType: string;
  pricePlan: any;
  developer: string;
  features: string;
  permissions: string;
  _count?: { installations: number };
}

interface AppInstallation {
  id: string;
  status: string;
  installedVersion: string | null;
  installedAt: string;
  updatedAt: string;
  merchant: { id: string; name: string };
}

interface Category {
  id: string;
  name: string;
  slug: string;
}

function categoryLabel(category: Pick<Category, 'name' | 'slug'>): string {
  const labels: Record<string, string> = {
    communication: '沟通协作',
    analytics: '数据分析',
    marketing: '营销推广',
    productivity: '效率工具'
  };
  return labels[category.slug.toLowerCase()] || category.name;
}

function statusLabel(status: string): string {
  const labels: Record<string, string> = {
    published: '已上架',
    draft: '草稿',
    archived: '已归档',
    disabled: '已停用'
  };
  return labels[status.toLowerCase()] || status;
}

function pricingLabel(pricingType: string): string {
  const labels: Record<string, string> = {
    free: '免费',
    subscription: '订阅',
    'one-time': '一次性付费'
  };
  return labels[pricingType.toLowerCase()] || pricingType;
}

export const AdminAppStoreMgmt: React.FC = () => {
  const { addNotification } = useB2B();
  const [apps, setApps] = useState<App[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [currentApp, setCurrentApp] = useState<Partial<App> | null>(null);
  const [installationsApp, setInstallationsApp] = useState<App | null>(null);
  const [installations, setInstallations] = useState<AppInstallation[]>([]);
  const [installationsLoading, setInstallationsLoading] = useState(false);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      setLoadError('');
      const [appsData, catsData] = await Promise.all([
        apiGet<{ success: true; apps: App[] }>('/api/admin/app-store/apps'),
        apiGet<{ success: true; categories: Category[] }>('/api/admin/app-store/categories')
      ]);
      setApps(Array.isArray(appsData.apps) ? appsData.apps : []);
      setCategories(Array.isArray(catsData.categories) ? catsData.categories : []);
    } catch (error) {
      // 统一走 API 客户端的错误解析：错误体是 { error: { code, message } }，直接拼字符串会得到 [object Object]。
      const message = describeAppStoreError(error, '应用数据读取失败');
      setApps([]);
      setCategories([]);
      setLoadError(message);
      addNotification('warning', '加载失败', message);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!currentApp?.name || !currentApp?.appId || !currentApp?.categoryId) {
      addNotification('warning', '信息不全', '请填写必填项。');
      return;
    }

    const normalizeStringArray = (value: string | undefined, label: string): string | null => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(value || '[]');
      } catch {
        addNotification('warning', '信息格式错误', `${label} 必须是 JSON 字符串数组。`);
        return null;
      }
      if (!Array.isArray(parsed) || parsed.some(item => typeof item !== 'string')) {
        addNotification('warning', '信息格式错误', `${label} 必须是 JSON 字符串数组。`);
        return null;
      }
      return JSON.stringify(parsed);
    };
    const features = normalizeStringArray(currentApp.features, '功能列表');
    const permissions = normalizeStringArray(currentApp.permissions, '权限声明');
    if (features === null || permissions === null) return;

    try {
      const payload = { ...currentApp, features, permissions };
      if (currentApp.id) {
        await apiPut<{ success: true }>(`/api/admin/app-store/apps/${currentApp.id}`, payload);
      } else {
        await apiPost<{ success: true }>('/api/admin/app-store/apps', payload);
      }
      addNotification('success', '保存成功', '应用信息已保存。');
      setIsEditing(false);
      setCurrentApp(null);
      void fetchData();
    } catch (error) {
      addNotification('warning', '保存失败', describeAppStoreError(error, '应用保存失败，请重试。'));
    }
  };

  const showInstallations = async (app: App) => {
    setInstallationsApp(app);
    setInstallations([]);
    setInstallationsLoading(true);
    try {
      const data = await apiGet<{ success: true; installations: AppInstallation[] }>(`/api/admin/app-store/apps/${encodeURIComponent(app.id)}/installations`);
      setInstallations(Array.isArray(data.installations) ? data.installations : []);
    } catch (error) {
      addNotification('warning', '读取失败', describeAppStoreError(error, '安装企业读取失败'));
      setInstallationsApp(null);
    } finally {
      setInstallationsLoading(false);
    }
  };

  const getIcon = (icon: string) => {
    const icons: any = { Mail, Bot, Users, Package, Warehouse, ShoppingCart, Megaphone, BarChart3 };
    const IconComp = icons[icon] || Package;
    return <IconComp className="w-5 h-5" />;
  };

  return (
    <div className="space-y-6">
      <AdminPageHeader title="生态应用" actions={<button
          onClick={() => {
            setCurrentApp({
              status: 'draft',
              pricingType: 'free',
              developer: 'RUDA FASHION',
              icon: 'Package',
              version: '1.0.0',
              permissions: '[]',
              features: '[]'
            });
            setIsEditing(true);
          }}
          className="inline-flex min-h-9 items-center gap-2 bg-neutral-950 px-3 text-xs font-semibold text-white hover:bg-neutral-800"
        >
          <Plus className="w-4 h-4" /> 新增应用
        </button>} />

      {loadError && (
        <div role="alert" className="flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-950 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-semibold">生态应用列表加载失败</p>
            <p className="mt-1 break-words text-xs leading-5">{loadError}</p>
          </div>
          <button
            type="button"
            onClick={() => void fetchData()}
            className="shrink-0 rounded-lg bg-neutral-950 px-3 py-2 text-xs font-semibold text-white hover:bg-neutral-800"
          >
            重试
          </button>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black" />
        </div>
      ) : loadError ? null : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {apps.map(app => (
            <div key={app.id} className="border border-neutral-200 bg-white p-4 transition-colors hover:border-neutral-400">
              <div className="mb-3 flex items-start justify-between">
                <div className="flex h-10 w-10 items-center justify-center bg-neutral-100 text-neutral-700">
                  {getIcon(app.icon)}
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-1 text-[10px] font-semibold ${
                    app.status === 'published' ? 'bg-emerald-50 text-emerald-700' : 'bg-neutral-100 text-neutral-600'
                  }`}>
                    {statusLabel(app.status)}
                  </span>
                  <button
                    type="button"
                    onClick={() => void showInstallations(app)}
                    aria-label={`查看${app.name}安装企业`}
                    title="查看安装企业"
                    className="rounded-lg p-2 text-neutral-500 transition-colors hover:bg-neutral-50 hover:text-neutral-900"
                  >
                    <Users className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => {
                      setCurrentApp(app);
                      setIsEditing(true);
                    }}
                    className="p-2 hover:bg-neutral-50 rounded-lg text-neutral-400 hover:text-neutral-900 transition-colors"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <h3 className="text-lg font-bold text-neutral-900">{app.name}</h3>
              <p className="text-xs text-neutral-400 font-mono mt-1">{app.appId}</p>
              <div className="mt-4 flex items-center justify-between border-t border-neutral-100 pt-3">
                <div className="flex items-center gap-4">
                  <div className="text-center">
                    <p className="text-[10px] font-semibold text-neutral-500">分类</p>
                    <p className="mt-0.5 text-xs font-semibold text-neutral-800">{categoryLabel(app.category)}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] font-semibold text-neutral-500">登记数</p>
                    <p className="mt-0.5 text-xs font-semibold text-neutral-800">{app._count?.installations || 0}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-semibold text-neutral-500">价格</p>
                  <p className="mt-0.5 text-xs font-semibold text-neutral-800">{pricingLabel(app.pricingType)}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {installationsApp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
          <button type="button" aria-label="关闭安装企业" className="absolute inset-0 bg-black/50" onClick={() => setInstallationsApp(null)} />
          <section role="dialog" aria-modal="true" aria-labelledby="app-installations-title" className="relative flex max-h-[85vh] w-full max-w-xl flex-col overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-2xl">
            <header className="flex items-center justify-between border-b border-neutral-100 px-4 py-3">
              <div className="min-w-0">
                <h2 id="app-installations-title" className="truncate text-sm font-bold text-neutral-900">安装企业</h2>
                <p className="mt-0.5 truncate text-[11px] text-neutral-500">{installationsApp.name} · {installationsApp._count?.installations || 0} 家</p>
              </div>
              <button type="button" onClick={() => setInstallationsApp(null)} className="rounded-lg p-2 text-neutral-500 hover:bg-neutral-50" aria-label="关闭">
                <X className="h-4 w-4" />
              </button>
            </header>
            <div className="min-h-24 overflow-y-auto">
              {installationsLoading ? (
                <p className="p-5 text-xs text-neutral-500">正在加载…</p>
              ) : installations.length ? (
                <ul className="divide-y divide-neutral-100">
                  {installations.map(installation => (
                    <li key={installation.id} className="flex items-center justify-between gap-3 px-4 py-3">
                      <div className="min-w-0">
                        <p className="truncate text-xs font-semibold text-neutral-900">{installation.merchant.name}</p>
                        <p className="mt-1 truncate font-mono text-[10px] text-neutral-400">{installation.merchant.id}</p>
                      </div>
                      <div className="shrink-0 text-right">
                        <span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${installation.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-neutral-100 text-neutral-600'}`}>
                          {installation.status === 'active' ? '已启用' : installation.status === 'disabled' ? '已停用' : installation.status === 'installed' ? '已安装' : installation.status}
                        </span>
                        <p className="mt-1 text-[9px] text-neutral-500">版本 {installation.installedVersion || '待启用'}</p>
                        <p className="mt-1 text-[9px] text-neutral-400">更新 {new Date(installation.updatedAt).toLocaleDateString()}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="p-5 text-xs text-neutral-500">暂无安装企业。</p>
              )}
            </div>
          </section>
        </div>
      )}

      {/* Edit Modal */}
      {isEditing && currentApp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsEditing(false)} />
          <div className="relative flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-neutral-100 bg-neutral-50/50 px-4 py-3 sm:px-5">
              <h3 className="text-lg font-bold text-neutral-900">
                {currentApp.id ? '编辑应用' : '新增应用'}
              </h3>
              <button onClick={() => setIsEditing(false)} className="p-2 hover:bg-white rounded-full transition-colors">
                <X className="w-5 h-5 text-neutral-500" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-8 space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-neutral-700 uppercase tracking-wider">应用名称 *</label>
                  <input
                    type="text"
                    value={currentApp.name || ''}
                    onChange={e => setCurrentApp({...currentApp, name: e.target.value})}
                    className="w-full px-4 py-3 rounded-xl border border-neutral-200 focus:ring-2 focus:ring-black/5 transition-all outline-none text-sm"
                    placeholder="例如: RUDA Business Email"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-neutral-700 uppercase tracking-wider">唯一标识 (appId) *</label>
                  <input
                    type="text"
                    value={currentApp.appId || ''}
                    onChange={e => setCurrentApp({...currentApp, appId: e.target.value})}
                    className="w-full px-4 py-3 rounded-xl border border-neutral-200 focus:ring-2 focus:ring-black/5 transition-all outline-none text-sm font-mono"
                    placeholder="ruda-business-email"
                    disabled={!!currentApp.id}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-neutral-700 uppercase tracking-wider">分类 *</label>
                  <select
                    value={currentApp.categoryId || ''}
                    onChange={e => setCurrentApp({...currentApp, categoryId: e.target.value})}
                    className="w-full px-4 py-3 rounded-xl border border-neutral-200 focus:ring-2 focus:ring-black/5 transition-all outline-none text-sm bg-white"
                  >
                    <option value="">选择分类</option>
                    {categories.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-neutral-700 uppercase tracking-wider">图标 (Lucide Icon)</label>
                  <select
                    value={currentApp.icon || 'Package'}
                    onChange={e => setCurrentApp({...currentApp, icon: e.target.value})}
                    className="w-full px-4 py-3 rounded-xl border border-neutral-200 focus:ring-2 focus:ring-black/5 transition-all outline-none text-sm bg-white"
                  >
                    <option value="Mail">Mail</option>
                    <option value="Bot">Bot</option>
                    <option value="Users">Users</option>
                    <option value="Package">Package</option>
                    <option value="Warehouse">Warehouse</option>
                    <option value="ShoppingCart">ShoppingCart</option>
                    <option value="Megaphone">Megaphone</option>
                    <option value="BarChart3">BarChart3</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-neutral-700 uppercase tracking-wider">简短介绍 *</label>
                <textarea
                  value={currentApp.description || ''}
                  onChange={e => setCurrentApp({...currentApp, description: e.target.value})}
                  className="w-full px-4 py-3 rounded-xl border border-neutral-200 focus:ring-2 focus:ring-black/5 transition-all outline-none text-sm min-h-[80px]"
                  placeholder="显示在列表页的简短介绍"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-neutral-700 uppercase tracking-wider">详细说明</label>
                <textarea
                  value={currentApp.detailedIntro || ''}
                  onChange={e => setCurrentApp({ ...currentApp, detailedIntro: e.target.value })}
                  className="min-h-[90px] w-full rounded-xl border border-neutral-200 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-black/5"
                  placeholder="说明真实功能和限制"
                />
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-neutral-700 uppercase tracking-wider">版本</label>
                  <input
                    type="text"
                    maxLength={32}
                    value={currentApp.version || ''}
                    onChange={e => setCurrentApp({ ...currentApp, version: e.target.value })}
                    className="w-full rounded-xl border border-neutral-200 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-black/5"
                    placeholder="1.0.0"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-neutral-700 uppercase tracking-wider">开发者</label>
                  <input
                    type="text"
                    maxLength={160}
                    value={currentApp.developer || ''}
                    onChange={e => setCurrentApp({ ...currentApp, developer: e.target.value })}
                    className="w-full rounded-xl border border-neutral-200 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-black/5"
                    placeholder="RUDA FASHION"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <label className="space-y-2 text-xs font-bold text-neutral-700">
                  功能列表（JSON 字符串数组）
                  <textarea
                    value={currentApp.features || '[]'}
                    onChange={e => setCurrentApp({ ...currentApp, features: e.target.value })}
                    className="min-h-[90px] w-full rounded-xl border border-neutral-200 px-3 py-2 font-mono text-xs outline-none focus:ring-2 focus:ring-black/5"
                    placeholder='["域名所有权验证"]'
                  />
                </label>
                <label className="space-y-2 text-xs font-bold text-neutral-700">
                  权限声明（JSON 字符串数组）
                  <textarea
                    value={currentApp.permissions || '[]'}
                    onChange={e => setCurrentApp({ ...currentApp, permissions: e.target.value })}
                    className="min-h-[90px] w-full rounded-xl border border-neutral-200 px-3 py-2 font-mono text-xs outline-none focus:ring-2 focus:ring-black/5"
                    placeholder='["domain.manage"]'
                  />
                </label>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-neutral-700 uppercase tracking-wider">价格类型</label>
                  <select
                    value={currentApp.pricingType || 'free'}
                    onChange={e => setCurrentApp({...currentApp, pricingType: e.target.value})}
                    className="w-full px-4 py-3 rounded-xl border border-neutral-200 focus:ring-2 focus:ring-black/5 transition-all outline-none text-sm bg-white"
                  >
                    <option value="free">免费</option>
                    <option value="subscription" disabled={currentApp.pricingType !== 'subscription'}>订阅（未开放）</option>
                    <option value="one-time" disabled={currentApp.pricingType !== 'one-time'}>一次性付费（未开放）</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-neutral-700 uppercase tracking-wider">状态</label>
                  <select
                    value={currentApp.status || 'draft'}
                    onChange={e => setCurrentApp({...currentApp, status: e.target.value})}
                    className="w-full px-4 py-3 rounded-xl border border-neutral-200 focus:ring-2 focus:ring-black/5 transition-all outline-none text-sm bg-white"
                  >
                    <option value="draft">草稿</option>
                    <option value="published">已上架</option>
                    <option value="hidden">隐藏</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-neutral-700 uppercase tracking-wider">Slug</label>
                <input
                  type="text"
                  value={currentApp.slug || ''}
                  onChange={e => setCurrentApp({...currentApp, slug: e.target.value})}
                  className="w-full px-4 py-3 rounded-xl border border-neutral-200 focus:ring-2 focus:ring-black/5 transition-all outline-none text-sm font-mono"
                  placeholder="URL 路径部分，例如: ruda-email"
                />
              </div>
            </div>

            <div className="px-8 py-6 border-t border-neutral-100 bg-neutral-50/50 flex justify-end gap-3">
              <button
                onClick={() => setIsEditing(false)}
                className="px-6 py-2.5 rounded-xl text-sm font-medium text-neutral-600 hover:bg-white transition-colors border border-transparent hover:border-neutral-200"
              >
                取消
              </button>
              <button
                onClick={handleSave}
                className="bg-black text-white px-8 py-2.5 rounded-xl text-sm font-semibold hover:bg-neutral-800 transition-all flex items-center gap-2"
              >
                <Save className="w-4 h-4" /> 保存应用
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
