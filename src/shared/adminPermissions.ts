/**
 * 平台管理员权限目录（唯一事实来源）。
 *
 * 背景：权限键此前只以字符串形式散落在 `server.ts` 的 `requireAdminPermission('...')` 里，
 * 既没有注册表也没有分配界面，导致「谁有 products.review」无法回答、无法最小化授权。
 * 本文件把权限键集中登记，服务端校验与平台后台界面共用同一份清单。
 *
 * 约定：
 * - 键集合必须与 `server.ts` 实际使用的权限键完全一致，
 *   `tests/admin-permission-catalog.test.ts` 会扫描 server.ts 并断言两者相等。
 * - `ADMIN_SUPER_PERMISSION`（`*`）不登记在目录里：它是服务端语义上的超级权限，
 *   界面只以「超级管理员」标签展示，不作为可勾选项，避免误发全权。
 * - `risk: 'sensitive'` 表示该权限能改变买家可见内容、影响资金或平台配置，分配时应谨慎。
 */

export type AdminPermissionRisk = 'normal' | 'sensitive';

export type AdminPermissionDefinition = {
  key: string;
  label: string;
  description: string;
  risk: AdminPermissionRisk;
};

export type AdminPermissionGroup = {
  key: string;
  label: string;
  permissions: AdminPermissionDefinition[];
};

export const ADMIN_SUPER_PERMISSION = '*';

export const ADMIN_PERMISSION_GROUPS: AdminPermissionGroup[] = [
  {
    key: 'catalogue',
    label: '商品与审核',
    permissions: [
      {
        key: 'products.review',
        label: '商品审核',
        description: '审核商品状态与 3D 模型；批准后买家立即可见',
        risk: 'sensitive'
      },
      {
        key: 'merchants.review',
        label: '商家审核',
        description: '审核商家入驻资料与经营状态',
        risk: 'sensitive'
      },
      {
        key: 'customers.review',
        label: '客户审核',
        description: '审核采购客户资料与授信申请',
        risk: 'sensitive'
      },
      {
        key: 'companies.review',
        label: '企业审核',
        description: '审核企业账号与关联关系',
        risk: 'sensitive'
      },
      {
        key: 'vault.review',
        label: '私密授权',
        description: '审批私密商品库（Vault）访问申请',
        risk: 'sensitive'
      },
      {
        key: 'content.gallery',
        label: '图片内容',
        description: '管理平台图片库与素材审核状态',
        risk: 'normal'
      }
    ]
  },
  {
    key: 'trading',
    label: '交易与库存',
    permissions: [
      { key: 'orders.manage', label: '订单管理', description: '处理平台订单、改单与异常单', risk: 'normal' },
      { key: 'inventory.adjust', label: '库存调整', description: '手工调整库存数量与盘点差异', risk: 'sensitive' },
      { key: 'inventory.transfers', label: '库存调拨', description: '发起与确认仓库之间的调拨', risk: 'normal' },
      { key: 'inventory.pos', label: '收银管理', description: '操作门店收银与开单退货', risk: 'normal' },
      { key: 'showrooms.appointments', label: '展厅预约', description: '处理展厅到访预约与改期', risk: 'normal' }
    ]
  },
  {
    key: 'finance',
    label: '资金',
    permissions: [
      { key: 'finance.payouts', label: '结算打款', description: '审批与执行商家结算打款指令', risk: 'sensitive' },
      { key: 'finance.refunds', label: '退款处理', description: '审批买家退款申请与退款金额', risk: 'sensitive' },
      { key: 'finance.credit', label: '账期授信', description: '调整客户账期与授信额度上限', risk: 'sensitive' }
    ]
  },
  {
    key: 'growth',
    label: '增长运营',
    permissions: [
      { key: 'growth.partners', label: '合作伙伴', description: '管理合作伙伴准入与分佣比例', risk: 'normal' }
    ]
  },
  {
    key: 'platform',
    label: '平台设置',
    permissions: [
      { key: 'accounts.manage', label: '账号合并', description: '合并买家/商家身份账号，管理管理员权限', risk: 'sensitive' },
      { key: 'notifications.manage', label: '消息通知', description: '管理平台通知模板与推送', risk: 'normal' },
      { key: 'settings.ai_support', label: 'AI 客服', description: '配置平台 AI 客服知识与话术', risk: 'normal' },
      { key: 'settings.integrations', label: '集成配置', description: '配置第三方集成与访问密钥', risk: 'sensitive' },
      { key: 'settings.features', label: '功能开关', description: '开关平台功能与灰度范围', risk: 'sensitive' },
      { key: 'settings.footer', label: '页脚配置', description: '维护站点页脚链接与备案信息', risk: 'normal' },
      { key: 'settings.health', label: '健康检查', description: '查看平台健康状态与依赖探测', risk: 'normal' },
      { key: 'settings.database', label: '数据备份', description: '触发数据库备份与恢复执行', risk: 'sensitive' },
      {
        key: 'settings.database.backup_delete',
        label: '备份删除',
        description: '删除数据库备份文件（不可恢复）',
        risk: 'sensitive'
      }
    ]
  }
];

const definitionIndex = new Map<string, AdminPermissionDefinition>(
  ADMIN_PERMISSION_GROUPS.flatMap(group => group.permissions.map(permission => [permission.key, permission]))
);

export const ADMIN_PERMISSIONS: string[] = Array.from(definitionIndex.keys()).sort();

export function isKnownAdminPermission(key: string): boolean {
  return definitionIndex.has(key);
}

export function findAdminPermission(key: string): AdminPermissionDefinition | undefined {
  return definitionIndex.get(key);
}

/** 某个权限键所属分组的中文名，界面展示用；未知键返回 null。 */
export function getAdminPermissionGroupLabel(key: string): string | null {
  const group = ADMIN_PERMISSION_GROUPS.find(item =>
    item.permissions.some(permission => permission.key === key)
  );
  return group?.label ?? null;
}
