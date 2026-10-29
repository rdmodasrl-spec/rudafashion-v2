/**
 * 行业后台员工管理入口：渲染唯一共享组件 `MerchantTeamManagement`，
 * 不在行业目录里复制员工逻辑，也不放宽服务端权限。
 */
import React from 'react';
import { MerchantTeamManagement } from '../../merchant-admin-common/components/merchant/MerchantTeamManagement';
import { PageHeader } from './kit';

export const IndustryTeamSection: React.FC<{
  workspaceName: string;
  merchantId: string | null;
  notify: (type: 'success' | 'info' | 'warning', title: string, message: string) => void;
}> = ({ workspaceName, merchantId, notify }) => (
  <div className="space-y-4">
    <PageHeader
      title="团队与权限"
      description={`${workspaceName} · 员工账号、岗位、门店归属与权限由服务端校验`}
    />
    <MerchantTeamManagement notify={notify} scopeKey={merchantId} />
  </div>
);
