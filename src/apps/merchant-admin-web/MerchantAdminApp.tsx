import React, { Suspense, lazy, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { useB2B } from '../../context/B2BContext';
import { UnifiedAuthEntry } from '../shared/components/auth/UnifiedAuthEntry';
import { NotificationToasts } from '../shared/components/NotificationToasts';
import { navigateToAppTarget } from '../shared/navigateToAppTarget';
import { ManagementAppShell } from '../shared/ManagementAppShell';
import { useManagementBootstrap } from '../shared/useManagementBootstrap';
import { useMerchantIndustryDemoEntry } from '../shared/useMerchantIndustryDemoEntry';
import { getIndustryWorkspaceModule } from '../merchant-admin-industries/registry';

const LazyMerchantPortal = lazy(() => import('./MerchantPortal').then(module => ({ default: module.MerchantPortal })));
const LazyMessagesCenter = lazy(() => import('../shared/components/common/MessagesCenter').then(module => ({ default: module.MessagesCenter })));
const LazyMerchantRfqCenter = lazy(() => import('../merchant-admin-common/components/merchant/MerchantRfqCenter').then(module => ({ default: module.MerchantRfqCenter })));

const Loading = () => (
  <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-neutral-500">
    <Loader2 className="h-10 w-10 animate-spin text-black" />
    <span className="text-sm font-medium">正在准备商家电脑管理端...</span>
  </div>
);

const MerchantAdminWebContent: React.FC = () => {
  const { authRole, currentView, merchants, authMerchantId, activeMerchantId, selectedMerchantId } = useB2B() as any;
  const { booted, portalZone } = useManagementBootstrap();
  const demoEntry = useMerchantIndustryDemoEntry(booted, portalZone !== 'employee');

  useEffect(() => {
    if (portalZone === 'employee') navigateToAppTarget('merchant-admin-mobile');
  }, [portalZone]);

  if (!booted || !portalZone || demoEntry.loading) return <Loading />;
  if (portalZone === 'employee') return <Loading />;

  if (demoEntry.failed || authRole !== 'merchant') {
    return (
      <div className="min-h-screen bg-neutral-50">
        <UnifiedAuthEntry
          initialRole="merchant"
          merchantCenter
          onRegister={() => window.location.assign('https://modaui.com/register-wholesale?registration=merchant')}
        />
        <NotificationToasts />
      </div>
    );
  }
  const merchantId = authMerchantId || activeMerchantId || selectedMerchantId;
  const merchant = merchants.find((item: any) => item.id === merchantId) || merchants[0];
  const templateId = merchant?.workspace?.templateId || merchant?.industryTemplate || '';
  const IndustryWorkspace = getIndustryWorkspaceModule(templateId);

  return (
    <div className="portal-theme-merchant min-h-screen bg-neutral-100 text-neutral-900 font-sans antialiased">
      <main className="min-h-screen">
        <Suspense fallback={<Loading />}>
          {currentView === 'messages_center'
            ? <LazyMessagesCenter />
            : currentView === 'rfq_merchant_list'
              ? <LazyMerchantRfqCenter />
              : IndustryWorkspace
              ? <LazyMerchantPortal industryWorkspace={IndustryWorkspace} />
              : <LazyMerchantPortal />}
        </Suspense>
      </main>
      <NotificationToasts />
    </div>
  );
};

export const MerchantAdminApp: React.FC = () => (
  <ManagementAppShell>
    <MerchantAdminWebContent />
  </ManagementAppShell>
);
