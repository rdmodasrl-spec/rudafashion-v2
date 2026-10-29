import React, { Suspense, lazy } from 'react';
import { Loader2 } from 'lucide-react';
import { useB2B } from '../../context/B2BContext';
import { UnifiedAuthEntry } from '../shared/components/auth/UnifiedAuthEntry';
import { NotificationToasts } from '../shared/components/NotificationToasts';
import { getMerchantMobileTabForHost } from '../../shared/portalDomains';
import { isModaGptEntryRequest } from '../../shared/merchantMobileSettings';
import { navigateToAppTarget } from '../shared/navigateToAppTarget';
import { ManagementAppShell } from '../shared/ManagementAppShell';
import { useManagementBootstrap } from '../shared/useManagementBootstrap';
import { useMerchantIndustryDemoEntry } from '../shared/useMerchantIndustryDemoEntry';
import { getIndustryWorkspaceModule } from '../merchant-admin-industries/registry';

const LazyMerchantMobileApp = lazy(() => import('./MerchantMobileApp').then(module => ({ default: module.MerchantMobileApp })));
const LazyMerchantEmployeeMobileApp = lazy(() => import('../merchant-admin-common/components/merchant/MerchantEmployeeMobileApp').then(module => ({ default: module.MerchantEmployeeMobileApp })));
const LazyMessagesCenter = lazy(() => import('../shared/components/common/MessagesCenter').then(module => ({ default: module.MessagesCenter })));
const LazyMerchantRfqCenter = lazy(() => import('../merchant-admin-common/components/merchant/MerchantRfqCenter').then(module => ({ default: module.MerchantRfqCenter })));

const Loading = () => (
  <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-neutral-500">
    <Loader2 className="h-10 w-10 animate-spin text-black" />
    <span className="text-sm font-medium">正在准备商家手机管理端...</span>
  </div>
);

const MerchantAdminMobileContent: React.FC = () => {
  const { authRole, currentView, merchants, authMerchantId, activeMerchantId, selectedMerchantId } = useB2B() as any;
  const { booted, portalZone } = useManagementBootstrap();
  const employeeRoute = portalZone === 'employee'
    || window.location.pathname.startsWith('/employee')
    || window.location.hostname === 'a.ruda.fashion';
  const demoEntry = useMerchantIndustryDemoEntry(booted, !employeeRoute);

  if (!booted || !portalZone || demoEntry.loading) return <Loading />;

  if (demoEntry.failed || authRole !== 'merchant') {
    return (
      <div className="min-h-screen bg-neutral-50">
        <UnifiedAuthEntry
          initialRole={employeeRoute ? 'employee' : 'merchant'}
          merchantCenter
          onRegister={() => window.location.assign('https://modaui.com/register-wholesale?registration=merchant')}
        />
        <NotificationToasts />
      </div>
    );
  }

  const initialTab = getMerchantMobileTabForHost(window.location.hostname)
    || (isModaGptEntryRequest(window.location.search) ? 'ai_home' : undefined);
  const merchantId = authMerchantId || activeMerchantId || selectedMerchantId;
  const merchant = merchants.find((item: any) => item.id === merchantId) || merchants[0];
  const templateId = merchant?.workspace?.templateId || merchant?.industryTemplate || '';
  const IndustryWorkspace = getIndustryWorkspaceModule(templateId);

  return (
    <div className={`portal-theme-${employeeRoute ? 'employee' : 'merchant'} min-h-screen bg-neutral-100 text-neutral-900 font-sans antialiased`}>
      <main className="min-h-screen">
        <Suspense fallback={<Loading />}>
          {employeeRoute
            ? <LazyMerchantEmployeeMobileApp />
            : currentView === 'messages_center'
              ? <LazyMessagesCenter />
              : currentView === 'rfq_merchant_list'
                ? <LazyMerchantRfqCenter />
                : IndustryWorkspace
                ? <LazyMerchantMobileApp
                    initialTab={initialTab}
                    industryWorkspace={IndustryWorkspace}
                    onSwitchToDesktop={() => navigateToAppTarget('merchant-admin-web')}
                  />
                : <LazyMerchantMobileApp
                  initialTab={initialTab}
                  onSwitchToDesktop={() => navigateToAppTarget('merchant-admin-web')}
                  />}
        </Suspense>
      </main>
      <NotificationToasts />
    </div>
  );
};

export const MerchantAdminApp: React.FC = () => (
  <ManagementAppShell>
    <MerchantAdminMobileContent />
  </ManagementAppShell>
);
