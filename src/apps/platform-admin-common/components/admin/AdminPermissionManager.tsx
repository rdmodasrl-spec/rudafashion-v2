import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshCw, Save, ShieldCheck } from 'lucide-react';
import { apiGet, apiPut } from '../../../../api/client';
import { ADMIN_PERMISSION_GROUPS } from '../../../../shared/adminPermissions';
import { AdminPageHeader } from './AdminPageHeader';

/**
 * 平台总后台 → 平台管理 → 权限管理。
 *
 * 只读写 AuthAccount.permissions；权限键来自共享目录 src/shared/adminPermissions.ts，
 * 前端不做任何授权判断（服务端 requireAnyAdminPermission('accounts.manage') 才是门禁）。
 * 契约见 docs/engineering/modules/platform-admin-model-review.md §4.3、§4.4、§5.2。
 */

type AdminAccount = {
  id: string;
  username: string | null;
  email: string | null;
  permissions: string[];
  isSuper: boolean;
  require2fa: boolean;
  lastLoginAt: string | null;
  updatedAt: string;
};

function formatTime(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('zh-CN', { hour12: false });
}

export const AdminPermissionManager: React.FC = () => {
  const [accounts, setAccounts] = useState<AdminAccount[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const payload = await apiGet<{ accounts: AdminAccount[] }>('/api/admin/accounts');
      const list = payload.accounts || [];
      setAccounts(list);
      setSelectedId(prev => (prev && list.some(item => item.id === prev) ? prev : list[0]?.id ?? null));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '管理员清单读取失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const selected = useMemo(
    () => accounts.find(account => account.id === selectedId) ?? null,
    [accounts, selectedId]
  );

  useEffect(() => {
    setDraft(selected ? [...selected.permissions] : []);
    setNotice('');
  }, [selected]);

  const toggle = (key: string) => {
    setDraft(prev => (prev.includes(key) ? prev.filter(item => item !== key) : [...prev, key]));
  };

  const save = async () => {
    if (!selected) return;
    setSaving(true);
    setError('');
    setNotice('');
    try {
      await apiPut(`/api/admin/accounts/${selected.id}/permissions`, { permissions: draft });
      setNotice('权限已更新。该账号需重新登录，新权限随新会话生效。');
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '权限保存失败');
    } finally {
      setSaving(false);
    }
  };

  const dirty = selected
    ? draft.length !== selected.permissions.length || draft.some(key => !selected.permissions.includes(key))
    : false;

  return (
    <div className="space-y-4">
      <AdminPageHeader
        title="权限管理"
        description="按最小权限原则分配管理员权限。权限目录与代码共用一份清单，未登记的权限键无法分配。"
        actions={(
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs font-semibold text-neutral-800 transition hover:border-neutral-400 disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            刷新
          </button>
        )}
      />

      <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-xs leading-6 text-neutral-700">
        权限为空数组表示<b>超级管理员</b>（既有语义，默认放行全部权限）。该语义本轮不做调整，
        如需收窄最小权限，请显式勾选所需权限。
      </div>

      {error && (
        <div role="alert" className="rounded-xl border border-neutral-900 bg-white px-4 py-3 text-xs font-medium text-neutral-900">
          {error}
        </div>
      )}
      {notice && (
        <div role="status" className="rounded-xl border border-neutral-200 bg-white px-4 py-3 text-xs font-medium text-neutral-800">
          {notice}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
        <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
          <div className="border-b border-neutral-200 px-4 py-3 text-xs font-semibold text-neutral-800">
            管理员（{accounts.length}）
          </div>
          {loading && accounts.length === 0 ? (
            <div className="space-y-2 p-3">
              {[0, 1, 2].map(row => <div key={row} className="h-10 animate-pulse rounded-lg bg-neutral-100" />)}
            </div>
          ) : accounts.length === 0 ? (
            <p className="px-4 py-8 text-center text-xs text-neutral-500">暂无管理员账号</p>
          ) : (
            <ul>
              {accounts.map(account => (
                <li key={account.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(account.id)}
                    aria-current={account.id === selectedId}
                    className={`w-full border-b border-neutral-100 px-4 py-3 text-left transition last:border-0 ${
                      account.id === selectedId ? 'bg-neutral-900 text-white' : 'bg-white text-neutral-800 hover:bg-neutral-50'
                    }`}
                  >
                    <span className="block text-xs font-semibold">{account.username || account.email || account.id}</span>
                    <span className={`mt-0.5 block text-xs ${account.id === selectedId ? 'text-neutral-300' : 'text-neutral-500'}`}>
                      {account.isSuper ? '超级管理员' : `${account.permissions.length} 项权限`}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-xl border border-neutral-200 bg-white p-4">
          {!selected ? (
            <p className="py-10 text-center text-xs text-neutral-500">选择左侧管理员以分配权限</p>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-200 pb-3">
                <div>
                  <p className="text-sm font-semibold text-neutral-900">{selected.username || selected.email || selected.id}</p>
                  <p className="mt-0.5 text-xs text-neutral-500">
                    {selected.email || '无邮箱'} · 最近登录 {formatTime(selected.lastLoginAt)} · 2FA {selected.require2fa ? '已启用' : '未启用'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-neutral-500">已选 {draft.length} 项</span>
                  <button
                    type="button"
                    onClick={() => void save()}
                    disabled={!dirty || saving}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-neutral-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-black disabled:opacity-40"
                  >
                    <Save className="h-3.5 w-3.5" />
                    保存权限
                  </button>
                </div>
              </div>

              {selected.isSuper && (
                <p className="flex items-start gap-2 rounded-lg border border-neutral-300 bg-neutral-50 px-3 py-2 text-xs text-neutral-800">
                  <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  当前为空权限，等同超级管理员。一旦勾选任意权限保存，该账号将降为显式权限集合。
                </p>
              )}

              {ADMIN_PERMISSION_GROUPS.map(group => (
                <section key={group.key}>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">{group.label}</h3>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    {group.permissions.map(permission => {
                      const checked = draft.includes(permission.key);
                      return (
                        <label
                          key={permission.key}
                          className={`flex cursor-pointer items-start gap-2 rounded-lg border px-3 py-2 transition ${
                            checked ? 'border-neutral-900 bg-neutral-50' : 'border-neutral-200 bg-white hover:border-neutral-400'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggle(permission.key)}
                            className="mt-0.5 h-3.5 w-3.5 accent-neutral-900"
                          />
                          <span className="min-w-0">
                            <span className="flex flex-wrap items-center gap-1.5">
                              <span className="text-xs font-semibold text-neutral-900">{permission.label}</span>
                              {permission.risk === 'sensitive' && (
                                <span className="rounded-full border border-neutral-900 px-1.5 py-0.5 text-xs font-semibold text-neutral-900">
                                  敏感
                                </span>
                              )}
                            </span>
                            <span className="mt-0.5 block text-xs text-neutral-500">{permission.description}</span>
                            <code className="mt-0.5 block text-xs text-neutral-400">{permission.key}</code>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
