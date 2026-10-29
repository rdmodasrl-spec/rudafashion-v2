import React, { Suspense, lazy, useCallback } from 'react';
import { Loader2 } from 'lucide-react';
import { useB2B } from '../../context/B2BContext';
import { UnifiedAuthEntry } from '../shared/components/auth/UnifiedAuthEntry';
import { NotificationToasts } from '../shared/components/NotificationToasts';
import { navigateToAppTarget } from '../shared/navigateToAppTarget';
import { ManagementAppShell } from '../shared/ManagementAppShell';
import { useManagementBootstrap } from '../shared/useManagementBootstrap';
import { ADMIN_NAV_GROUPS, type AdminTab } from '../platform-admin-common/components/admin/adminNavigation';

const LazyPlatformAdminMobile = lazy(() => import('./PlatformAdminMobile').then(module => ({ default: module.PlatformAdminMobile })));
const LazyMessagesCenter = lazy(() => import('../shared/components/common/MessagesCenter').then(module => ({ default: module.MessagesCenter })));

const Loading = () => (
  <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-neutral-500">
    <Loader2 className="h-10 w-10 animate-spin text-black" />
    <span className="text-sm font-medium">正在准备平台手机管理端...</span>
  </div>
);

const PlatformAdminMobileContent: React.FC = () => {
  const { authRole, currentView } = useB2B();
  const { booted, portalZone } = useManagementBootstrap();
  const requestedTab = new URLSearchParams(window.location.search).get('adminTab');
  const initialTab = requestedTab
    ? ADMIN_NAV_GROUPS.flatMap(group => group.items).find(item => item.key === requestedTab)?.key
    : undefined;
  const switchToDesktop = useCallback((tab?: AdminTab) => navigateToAppTarget(
    'platform-admin-web',
    tab ? { adminTab: tab } : {}
  ), []);

  if (!booted || !portalZone) return <Loading />;

  if (authRole !== 'admin') {
    return (
      <div className="min-h-screen bg-neutral-50">
        <UnifiedAuthEntry initialRole="admin" />
        <NotificationToasts />
      </div>
    );
  }

  return (
    <div className="portal-theme-admin min-h-screen bg-neutral-100/60 text-neutral-900 font-sans antialiased">
      <Suspense fallback={<Loading />}>
        {currentView === 'messages_center'
          ? <LazyMessagesCenter />
          : <LazyPlatformAdminMobile initialTab={initialTab} onSwitchToDesktop={switchToDesktop} />}
      </Suspense>
      <NotificationToasts />
    </div>
  );
};

export const PlatformAdminApp: React.FC = () => (
  <ManagementAppShell>
    <PlatformAdminMobileContent />
  </ManagementAppShell>
);
