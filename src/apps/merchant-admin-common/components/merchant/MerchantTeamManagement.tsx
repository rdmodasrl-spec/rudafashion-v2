/**
 * 商家员工管理（唯一实现，七种行业后台与服装后台共用）。
 *
 * 契约来源：
 * - `GET /api/merchant/employees`（服务端按商家与员工门店范围过滤，并返回可分配门店）
 * - `POST /api/merchant/employees`
 * - `PATCH /api/merchant/employees/:id`（姓名/岗位/门店）
 * - `PATCH /api/merchant/employees/:id/status`
 * - `PATCH /api/merchant/employees/:id/permissions`
 *
 * 本组件不做本地假保存，也不在前端放宽权限：所有写操作以服务端返回为准，失败时回滚列表并提示。
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshCcw, ShieldCheck, UserPlus } from 'lucide-react';
import { apiGet, apiPatch, apiPost, ApiError } from '../../../../api/client';
import { PasswordInput } from '../../../shared/components/common/PasswordInput';

export type MerchantTeamRole =
  | 'sales'
  | 'warehouse'
  | 'production'
  | 'pos_cashier'
  | 'knowledge_manager'
  | 'store_manager';

export const merchantTeamRoleLabels: Record<MerchantTeamRole, string> = {
  sales: '销售',
  warehouse: '仓库',
  production: '生产',
  pos_cashier: 'POS 收银',
  knowledge_manager: '知识库管理员',
  store_manager: '店长'
};

export const merchantTeamRoleDescriptions: Record<MerchantTeamRole, string> = {
  sales: '可开销售单 · 改价需审批',
  warehouse: '拣货 · 复核 · 打包 · 出库',
  production: '报工 · 质检',
  pos_cashier: '仅销售开单 · 无员工管理权',
  knowledge_manager: '知识库管理 · 无商品权 · 无库存权 · 无财务权',
  store_manager: '含员工与设置管理 · 不含知识库'
};

export const merchantTeamPermissionOptions = [
  ['sales.order.create', '创建销售单'],
  ['product.publish', '创建和管理商品及分类'],
  ['product.cost.view', '查看及管理商品成本'],
  ['pricing.request', '提交改价申请'],
  ['pricing.approve', '审批改价与折扣'],
  ['warehouse.pick', '拣货与差异登记'],
  ['warehouse.review', '复核库存与订单'],
  ['warehouse.pack', '打包'],
  ['warehouse.ship', '出库与发货'],
  ['production.report', '生产报工与质检'],
  ['purchase.manage', '管理成衣采购订单'],
  ['return.manage', '审核退货与退款'],
  ['employees.manage', '创建员工与管理权限'],
  ['brain.read', '查看 ModaUI 知识库'],
  ['brain.write', '添加知识库文档'],
  ['brain.knowledge.review', '审核与失效知识库文档']
] as const;

export const merchantTeamRoleDefaults: Record<MerchantTeamRole, string[]> = {
  sales: ['sales.order.create', 'pricing.request'],
  warehouse: ['warehouse.pick', 'warehouse.review', 'warehouse.pack', 'warehouse.ship'],
  production: ['production.report'],
  pos_cashier: ['sales.order.create'],
  knowledge_manager: ['brain.read', 'brain.write', 'brain.knowledge.review'],
  store_manager: merchantTeamPermissionOptions
    .filter(([permission]) => !permission.startsWith('brain.'))
    .map(([permission]) => permission)
};

type TeamEmployee = {
  id: string;
  name: string;
  email: string;
  role: MerchantTeamRole;
  permissions: string[];
  active: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  storeId: string | null;
  store?: { id: string; name: string; code: string } | null;
};

type StoreOption = { id: string; name: string; code: string; status: string };

type EmployeeForm = {
  name: string;
  email: string;
  password: string;
  role: MerchantTeamRole;
  permissions: string[];
  storeId: string;
};

const emptyForm = (): EmployeeForm => ({
  name: '',
  email: '',
  password: '',
  role: 'sales',
  permissions: [...merchantTeamRoleDefaults.sales],
  storeId: ''
});

function parsePermissions(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.filter((item): item is string => typeof item === 'string');
  if (typeof raw !== 'string') return [];
  try {
    const parsed: unknown = JSON.parse(raw || '[]');
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

function describeError(error: unknown, fallback: string) {
  if (error instanceof ApiError) {
    const messages: Record<string, string> = {
      EMPLOYEE_EMAIL_EXISTS: '该邮箱已是本商家员工',
      EMPLOYEE_ROLE_INVALID: '岗位模板不合法',
      EMPLOYEE_PERMISSIONS_INVALID: '员工权限不合法',
      EMPLOYEE_NAME_REQUIRED: '员工姓名必填',
      EMPLOYEE_NOT_FOUND: '员工不存在或不属于当前商家',
      EMPLOYEE_CANNOT_DISABLE_SELF: '不能停用当前登录账号',
      STORE_ACCESS_DENIED: '没有该门店的操作权限',
      STORE_NOT_FOUND: '门店不存在',
      STORE_INACTIVE: '门店已停用',
      EMPLOYEE_PERMISSION_REQUIRED: '当前账号没有员工管理权限'
    };
    return messages[error.code || ''] || error.message || fallback;
  }
  return error instanceof Error ? error.message : fallback;
}

export type MerchantTeamManagementProps = {
  notify?: (type: 'success' | 'info' | 'warning', title: string, message: string) => void;
  /** 切换商家或门店时重置草稿，避免把上一个账号的数据带过来。 */
  scopeKey?: string | null;
  /** 是否显示岗位模板总览（默认显示）。 */
  showRolesOverview?: boolean;
};

export const MerchantTeamManagement: React.FC<MerchantTeamManagementProps> = ({
  notify,
  scopeKey,
  showRolesOverview = true
}) => {
  const [employees, setEmployees] = useState<TeamEmployee[]>([]);
  const [stores, setStores] = useState<StoreOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [form, setForm] = useState<EmployeeForm>(emptyForm);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  const report = useCallback((type: 'success' | 'info' | 'warning', title: string, message: string) => {
    notify?.(type, title, message);
  }, [notify]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await apiGet<{ success: boolean; employees: Array<Omit<TeamEmployee, 'permissions'> & { permissions: unknown }>; stores?: StoreOption[] }>('/api/merchant/employees');
      setEmployees((response.employees || []).map(employee => ({ ...employee, permissions: parsePermissions(employee.permissions) })));
      setStores(Array.isArray(response.stores) ? response.stores : []);
    } catch (caught) {
      setEmployees([]);
      setStores([]);
      setError(describeError(caught, '员工列表读取失败'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setForm(emptyForm());
    setSearch('');
    setStatusFilter('all');
    void load();
  }, [load, scopeKey]);

  const activeStores = useMemo(() => stores.filter(store => store.status === 'active'), [stores]);

  const filtered = useMemo(() => employees.filter(employee => {
    const keyword = search.trim().toLowerCase();
    const matchesKeyword = !keyword
      || `${employee.name} ${employee.email} ${merchantTeamRoleLabels[employee.role] || employee.role} ${employee.store?.name || ''}`.toLowerCase().includes(keyword);
    const matchesStatus = statusFilter === 'all' || employee.active === (statusFilter === 'active');
    return matchesKeyword && matchesStatus;
  }), [employees, search, statusFilter]);

  const createEmployee = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (creating) return;
    setCreating(true);
    try {
      await apiPost('/api/merchant/employees', {
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
        role: form.role,
        permissions: form.permissions,
        ...(form.storeId ? { storeId: form.storeId } : {})
      });
      setForm(emptyForm());
      await load();
      report('success', '员工账号已创建', '员工可用邮箱和初始密码登录，所选权限即时生效');
    } catch (caught) {
      report('warning', '员工创建失败', describeError(caught, '请检查资料后重试'));
    } finally {
      setCreating(false);
    }
  };

  const updateEmployee = (id: string, patch: Partial<TeamEmployee>) => {
    setEmployees(current => current.map(employee => employee.id === id ? { ...employee, ...patch } : employee));
  };

  const saveProfile = async (employee: TeamEmployee) => {
    if (busyId) return;
    setBusyId(employee.id);
    try {
      await apiPatch(`/api/merchant/employees/${encodeURIComponent(employee.id)}`, {
        name: employee.name,
        role: employee.role,
        storeId: employee.storeId || null
      });
      await load();
      report('success', '员工资料已保存', employee.name);
    } catch (caught) {
      await load();
      report('warning', '员工资料保存失败', describeError(caught, '请稍后重试'));
    } finally {
      setBusyId(null);
    }
  };

  const savePermissions = async (employee: TeamEmployee) => {
    if (busyId) return;
    setBusyId(employee.id);
    try {
      await apiPatch(`/api/merchant/employees/${encodeURIComponent(employee.id)}/permissions`, {
        permissions: employee.permissions
      });
      report('success', '员工权限已保存', `${employee.name} 的权限已即时同步`);
    } catch (caught) {
      await load();
      report('warning', '员工权限保存失败', describeError(caught, '请稍后重试'));
    } finally {
      setBusyId(null);
    }
  };

  const toggleActive = async (employee: TeamEmployee) => {
    if (busyId) return;
    setBusyId(employee.id);
    try {
      await apiPatch(`/api/merchant/employees/${encodeURIComponent(employee.id)}/status`, { active: !employee.active });
      updateEmployee(employee.id, { active: !employee.active });
      report('success', employee.active ? '员工账号已停用' : '员工账号已启用', employee.name);
    } catch (caught) {
      report('warning', '员工状态更新失败', describeError(caught, '请稍后重试'));
    } finally {
      setBusyId(null);
    }
  };

  const togglePermission = (permissions: string[], permission: string, checked: boolean) => checked
    ? [...new Set([...permissions, permission])]
    : permissions.filter(item => item !== permission);

  return (
    <section className="space-y-5" aria-label="员工与权限">
      <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-neutral-900 tracking-tight">员工与权限</h2>
            <p className="mt-1 text-xs text-neutral-500">员工账号只属于当前商家；绑定门店后只能管理该门店的收银、退货与调拨。</p>
          </div>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-xs font-semibold text-neutral-700 transition hover:bg-neutral-50 hover:border-neutral-300 disabled:opacity-50"
          >
            <RefreshCcw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />刷新
          </button>
        </div>
        <div className="mt-4 flex flex-wrap gap-2.5 text-[11px] text-neutral-600">
          <span className="rounded-full bg-neutral-100 px-2.5 py-1">账号 {employees.length}</span>
          <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-700 font-medium">启用 {employees.filter(employee => employee.active).length}</span>
          <span className="rounded-full bg-neutral-100 px-2.5 py-1">已绑定门店 {employees.filter(employee => employee.storeId).length}</span>
        </div>
        {error ? (
          <div role="alert" className="mt-4 flex flex-wrap gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-3.5 text-[11px] text-amber-900">
            <span>员工数据不可读</span><span>{error}</span><span>请使用店主或店长账号</span>
          </div>
        ) : null}
      </div>

      {showRolesOverview ? (
        <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-bold text-neutral-900 tracking-tight">岗位模板</h3>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {(Object.keys(merchantTeamRoleDefaults) as MerchantTeamRole[]).map(role => (
              <article key={role} className="rounded-xl border border-neutral-200 bg-white p-4 hover:border-neutral-300 hover:bg-neutral-50 transition shadow-sm hover:shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
                <h4 className="text-sm font-semibold text-neutral-900">{merchantTeamRoleLabels[role]}</h4>
                <p className="mt-1 text-[11px] leading-4 text-neutral-500">{merchantTeamRoleDescriptions[role]}</p>
                <p className="mt-3.5 text-[10px] font-semibold text-neutral-600">默认权限 · {merchantTeamRoleDefaults[role].length} 项</p>
                <div className="mt-2.5 flex flex-wrap gap-1">
                  {merchantTeamRoleDefaults[role].map(permission => (
                    <span key={permission} className="rounded-full bg-neutral-50 px-2 py-1 text-[10px] text-neutral-600">
                      {merchantTeamPermissionOptions.find(([key]) => key === permission)?.[1] || permission}
                    </span>
                  ))}
                </div>
                <p className="mt-3.5 border-t border-neutral-100 pt-2.5 text-[10px] text-neutral-500">
                  {employees.filter(employee => employee.role === role).length} 个账号使用该模板
                </p>
              </article>
            ))}
          </div>
        </div>
      ) : null}

      <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
        <h3 className="flex items-center gap-1.5 text-sm font-bold text-neutral-900 tracking-tight"><UserPlus className="h-4 w-4" />新增员工</h3>
        <form onSubmit={event => void createEmployee(event)} className="mt-4 grid gap-3.5 text-xs md:grid-cols-2">
          <label className="font-semibold text-neutral-700">员工姓名
            <input required maxLength={100} value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} className="mt-1.5 w-full rounded-xl border border-neutral-300 bg-white px-3.5 py-2.5 font-normal focus:border-neutral-800 focus:ring-1 focus:ring-neutral-800" />
          </label>
          <label className="font-semibold text-neutral-700">员工邮箱
            <input required type="email" maxLength={200} value={form.email} onChange={event => setForm({ ...form, email: event.target.value })} className="mt-1.5 w-full rounded-xl border border-neutral-300 bg-white px-3.5 py-2.5 font-normal focus:border-neutral-800 focus:ring-1 focus:ring-neutral-800" />
          </label>
          <label className="font-semibold text-neutral-700">初始密码（至少 8 位）
            <PasswordInput required minLength={8} maxLength={128} autoComplete="new-password" value={form.password} onChange={event => setForm({ ...form, password: event.target.value })} className="mt-1.5 w-full rounded-xl border border-neutral-300 bg-white px-3.5 py-2.5 pr-10 font-normal focus:border-neutral-800 focus:ring-1 focus:ring-neutral-800" />
          </label>
          <label className="font-semibold text-neutral-700">岗位模板
            <select
              value={form.role}
              onChange={event => {
                const role = event.target.value as MerchantTeamRole;
                setForm({ ...form, role, permissions: [...merchantTeamRoleDefaults[role]] });
              }}
              className="mt-1.5 w-full rounded-xl border border-neutral-300 bg-white px-3.5 py-2.5 font-normal focus:border-neutral-800 focus:ring-1 focus:ring-neutral-800"
            >
              {(Object.keys(merchantTeamRoleLabels) as MerchantTeamRole[]).map(role => (
                <option key={role} value={role}>{merchantTeamRoleLabels[role]}</option>
              ))}
            </select>
          </label>
          {stores.length > 0 ? (
            <label className="font-semibold text-neutral-700 md:col-span-2">绑定门店（留空表示不限制门店）
              <select value={form.storeId} onChange={event => setForm({ ...form, storeId: event.target.value })} className="mt-1.5 w-full rounded-xl border border-neutral-300 bg-white px-3.5 py-2.5 font-normal focus:border-neutral-800 focus:ring-1 focus:ring-neutral-800">
                <option value="">不限制门店</option>
                {activeStores.map(store => <option key={store.id} value={store.id}>{store.name}（{store.code}）</option>)}
              </select>
            </label>
          ) : null}
          <fieldset className="md:col-span-2">
            <legend className="text-xs font-semibold text-neutral-700">选择权限</legend>
            <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
              {merchantTeamPermissionOptions.map(([permission, label]) => (
                <label key={permission} className="flex items-center gap-2.5 rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-xs text-neutral-700 hover:bg-neutral-50 hover:border-neutral-300 transition cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.permissions.includes(permission)}
                    onChange={event => setForm({ ...form, permissions: togglePermission(form.permissions, permission, event.target.checked) })}
                    className="h-4 w-4 accent-neutral-900"
                  />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="md:col-span-2 flex justify-end pt-1">
            <button type="submit" disabled={creating} className="rounded-xl bg-neutral-950 px-4.5 py-3 text-xs font-bold text-white transition hover:bg-neutral-800 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-35">
              {creating ? '创建中…' : '新增员工'}
            </button>
          </div>
        </form>
      </div>

      <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <h3 className="text-sm font-bold text-neutral-900 tracking-tight">员工列表</h3>
          <span className="text-[11px] text-neutral-500">{employees.filter(employee => employee.active).length} / {employees.length} 个账号启用</span>
        </div>
        <div className="mt-4 grid gap-2.5 sm:grid-cols-[1fr_auto]">
          <input
            value={search}
            onChange={event => setSearch(event.target.value)}
            placeholder="搜索姓名、邮箱、岗位或门店"
            aria-label="搜索员工账号"
            className="rounded-xl border border-neutral-200 px-3.5 py-2.5 text-xs focus:border-neutral-800 focus:ring-1 focus:ring-neutral-800"
          />
          <select
            value={statusFilter}
            onChange={event => setStatusFilter(event.target.value as typeof statusFilter)}
            aria-label="按账号状态筛选"
            className="rounded-xl border border-neutral-200 bg-white px-3.5 py-2.5 text-xs focus:border-neutral-800 focus:ring-1 focus:ring-neutral-800"
          >
            <option value="all">全部状态</option>
            <option value="active">已启用</option>
            <option value="inactive">已停用</option>
          </select>
        </div>
        {loading && employees.length === 0 ? <p className="mt-4 rounded-xl bg-neutral-50 p-3.5 text-xs text-neutral-500">正在读取员工…</p> : null}
        <div className="mt-4 space-y-2">
          {filtered.map(employee => (
            <article key={employee.id} className="rounded-xl border border-neutral-200 p-4 hover:bg-neutral-50 hover:border-neutral-300 transition">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <label className="block text-[11px] font-semibold text-neutral-600">姓名
                    <input
                      value={employee.name}
                      maxLength={100}
                      onChange={event => updateEmployee(employee.id, { name: event.target.value })}
                      className="mt-1.5 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm font-normal text-neutral-950 focus:border-neutral-800 focus:ring-1 focus:ring-neutral-800"
                    />
                  </label>
                  <p className="mt-1.5 text-[11px] text-neutral-500">
                    {employee.email} · {employee.lastLoginAt ? `上次登录 ${new Date(employee.lastLoginAt).toLocaleString()}` : '尚未登录'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void toggleActive(employee)}
                  disabled={busyId === employee.id}
                  className={`rounded-xl px-3.5 py-2.5 text-xs font-semibold transition disabled:opacity-50 ${employee.active ? 'border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100' : 'border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'}`}
                >
                  {busyId === employee.id ? '处理中…' : employee.active ? '停用账号' : '重新启用'}
                </button>
              </div>
              <div className="mt-3.5 grid gap-2.5 sm:grid-cols-2">
                <label className="text-[11px] font-semibold text-neutral-600">岗位
                  <select
                    value={employee.role}
                    onChange={event => updateEmployee(employee.id, { role: event.target.value as MerchantTeamRole })}
                    className="mt-1.5 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-xs font-normal focus:border-neutral-800 focus:ring-1 focus:ring-neutral-800"
                  >
                    {(Object.keys(merchantTeamRoleLabels) as MerchantTeamRole[]).map(role => (
                      <option key={role} value={role}>{merchantTeamRoleLabels[role]}</option>
                    ))}
                  </select>
                </label>
                {stores.length > 0 ? (
                  <label className="text-[11px] font-semibold text-neutral-600">所属门店
                    <select
                      value={employee.storeId || ''}
                      onChange={event => updateEmployee(employee.id, { storeId: event.target.value || null })}
                      className="mt-1.5 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-xs font-normal focus:border-neutral-800 focus:ring-1 focus:ring-neutral-800"
                    >
                      <option value="">不限制门店</option>
                      {activeStores.map(store => <option key={store.id} value={store.id}>{store.name}（{store.code}）</option>)}
                    </select>
                  </label>
                ) : null}
              </div>

              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {merchantTeamPermissionOptions.map(([permission, label]) => (
                  <label key={permission} className="flex items-center gap-2 rounded-lg bg-neutral-50 px-3 py-2 text-xs text-neutral-700">
                    <input
                      type="checkbox"
                      checked={employee.permissions.includes(permission)}
                      onChange={event => updateEmployee(employee.id, {
                        permissions: togglePermission(employee.permissions, permission, event.target.checked)
                      })}
                      className="h-4 w-4 accent-neutral-900"
                    />
                    {label}
                  </label>
                ))}
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <p className="inline-flex items-center gap-1 text-[11px] text-neutral-500"><ShieldCheck className="h-3.5 w-3.5" />已选 {employee.permissions.length} 项权限</p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void saveProfile(employee)}
                    disabled={busyId === employee.id}
                    className="rounded-lg border border-neutral-300 px-3 py-2 text-xs font-semibold text-neutral-700 disabled:opacity-50"
                  >
                    {busyId === employee.id ? '保存中…' : '保存资料'}
                  </button>
                  <button
                    type="button"
                    onClick={() => void savePermissions(employee)}
                    disabled={busyId === employee.id}
                    className="rounded-lg bg-neutral-900 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
                  >
                    {busyId === employee.id ? '保存中…' : '保存权限'}
                  </button>
                </div>
              </div>
            </article>
          ))}
          {filtered.length === 0 && !loading ? (
            <p className="rounded-lg bg-neutral-50 p-4 text-center text-xs text-neutral-500">
              {employees.length === 0 ? '暂无员工账号，先在上方新增。' : '无匹配员工'}
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
};

