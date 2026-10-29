import React, { Suspense, lazy } from 'react';
import { Loader2 } from 'lucide-react';
import { useB2B } from '../../context/B2BContext';
import { UnifiedAuthEntry } from '../shared/components/auth/UnifiedAuthEntry';
import { NotificationToasts } from '../shared/components/NotificationToasts';
import { ADMIN_AREA_ITEMS, ADMIN_NAV_GROUPS, normalizeAdminTab, type AdminTab } from '../platform-admin-common/components/admin/adminNavigation';
import { ManagementAppShell } from '../shared/ManagementAppShell';
import { useManagementBootstrap } from '../shared/useManagementBootstrap';

const LazyPlatformAdmin = lazy(() => import('./PlatformAdmin').then(module => ({ default: module.PlatformAdmin })));
const LazyMessagesCenter = lazy(() => import('../shared/components/common/MessagesCenter').then(module => ({ default: module.MessagesCenter })));

const Loading = () => (
  <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-neutral-500">
    <Loader2 className="h-10 w-10 animate-spin text-black" />
    <span className="text-sm font-medium">正在准备平台电脑管理端...</span>
  </div>
);

const PlatformAdminWebContent: React.FC = () => {
  const { authRole, currentView } = useB2B();
  const { booted, portalZone } = useManagementBootstrap();

  if (!booted || !portalZone) return <Loading />;

  if (authRole !== 'admin') {
    return (
      <div className="min-h-screen bg-neutral-50">
        <UnifiedAuthEntry initialRole="admin" />
        <NotificationToasts />
      </div>
    );
  }

  const requestedTab = new URLSearchParams(window.location.search).get('adminTab');
  const knownTab = requestedTab && [
    ...ADMIN_NAV_GROUPS.flatMap(group => group.items),
    ...ADMIN_AREA_ITEMS.platform
  ]
    .find(item => item.key === requestedTab)?.key;
  const initialTab: AdminTab = knownTab ? normalizeAdminTab(knownTab) : 'overview';

  return (
    <div className="portal-theme-admin min-h-screen bg-neutral-100/60 text-neutral-900 font-sans antialiased">
      <Suspense fallback={<Loading />}>
        {currentView === 'messages_center'
          ? <LazyMessagesCenter />
          : <LazyPlatformAdmin initialTab={initialTab} />}
      </Suspense>
      <NotificationToasts />
    </div>
  );
};

export const PlatformAdminApp: React.FC = () => (
  <ManagementAppShell>
    <PlatformAdminWebContent />
  </ManagementAppShell>
);
