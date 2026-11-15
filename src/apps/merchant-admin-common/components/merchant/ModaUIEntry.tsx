import React, { useEffect, useState } from 'react';
import { apiGet } from '../../../../api/client';
import { useB2B } from '../../../../context/B2BContext';
import type { MerchantCopilotPageContext } from '../../../../shared/merchantCopilotContext';
import { MerchantAiHome } from './MerchantAiHome';
import {
  getModaUIIndustryChatTemplate,
  resolveCurrentMerchantStudio,
  shouldUseModaUIIndustryChat
} from './modaui/modauiIndustryChat';
import type { MerchantStudioAccessSummary } from './modaui/modauiIndustryChat';
import {
  ModaUIWorkbench
} from './modaui/ModaUIWorkbench';
import type { WorkbenchCapabilityId } from './modaui/modaWorkbenchCapabilities';

type MerchantAssistantTab =
  | 'products'
  | 'inventory'
  | 'orders'
  | 'customers'
  | 'profile'
  | 'finance'
  | 'growth'
  | 'production'
  | 'procurement'
  | 'content';

type ModaUIEntryProps = {
  isIt: boolean;
  merchantId: string;
  merchantName: string;
  industryTemplateId?: string | null;
  merchantIndustry?: string | null;
  initialCapability?: WorkbenchCapabilityId | null;
  onExit: () => void;
  onNavigate: (tab: MerchantAssistantTab) => void;
};

const modauiPageContext: MerchantCopilotPageContext = {
  route: 'dashboard',
  section: 'modaui',
  task: 'overview',
  selectedObjectId: null,
  filters: {}
};

type MerchantStudioAccess = MerchantStudioAccessSummary & {
  industryCode: string;
  studioCode: string;
  merchantIndustry: string;
  mode: 'production' | 'wholesale' | 'default';
};

type StudioAccessState = 'loading' | 'error' | 'denied' | 'ready';

export const ModaUIEntry: React.FC<ModaUIEntryProps> = ({
  isIt,
  merchantId,
  merchantName,
  industryTemplateId,
  merchantIndustry,
  initialCapability = null,
  onExit,
  onNavigate
}) => {
  const { localizeCopy } = useB2B();
  const [studioAccess, setStudioAccess] = useState<MerchantStudioAccess | null>(null);
  const [accessState, setAccessState] = useState<StudioAccessState>('loading');
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    let active = true;
    setAccessState('loading');
    setStudioAccess(null);
    apiGet<{ success: true; studios: MerchantStudioAccess[] }>('/api/merchant/studios')
      .then(result => {
        if (!active) return;
        const access = resolveCurrentMerchantStudio(result.studios, industryTemplateId);
        if (!access) {
          setAccessState('denied');
          return;
        }
        setStudioAccess(access);
        setAccessState('ready');
      })
      .catch(() => {
        if (active) setAccessState('error');
      });
    return () => { active = false; };
  }, [industryTemplateId, merchantId, retryCount]);

  if (accessState !== 'ready' || !studioAccess) {
    const loading = accessState === 'loading';
    const denied = accessState === 'denied';
    return (
      <main className="flex h-full min-h-0 w-full items-center justify-center bg-white px-5">
        <section className="w-full max-w-sm text-center">
          <h1 className="text-xl font-semibold text-neutral-950">{localizeCopy('AI工作室', 'AI Studio')}</h1>
          <p role={loading ? 'status' : 'alert'} className="mt-3 text-sm leading-6 text-neutral-600">
            {loading
              ? localizeCopy('正在校验当前行业的工作室授权…', 'Verifica dell’accesso allo Studio…')
              : denied
                ? localizeCopy('当前行业没有可用的 AI 工作室授权。', 'Nessuno Studio AI autorizzato per questo settore.')
                : localizeCopy('无法读取 AI 工作室授权，请检查网络后重试。', 'Impossibile verificare l’accesso allo Studio AI. Controlla la rete e riprova.')}
          </p>
          {accessState === 'error' && (
            <button
              type="button"
              onClick={() => setRetryCount(value => value + 1)}
              className="mt-5 min-h-10 rounded-[var(--radius-ruda-control)] bg-neutral-900 px-4 text-sm font-semibold text-white hover:bg-neutral-800"
            >
              {localizeCopy('重试', 'Riprova')}
            </button>
          )}
          {denied && (
            <button
              type="button"
              onClick={onExit}
              className="mt-5 min-h-10 rounded-[var(--radius-ruda-control)] border border-neutral-200 px-4 text-sm font-semibold text-neutral-800 hover:bg-neutral-50"
            >
              {localizeCopy('返回商家后台', 'Torna al pannello')}
            </button>
          )}
        </section>
      </main>
    );
  }

  const industryTemplate = getModaUIIndustryChatTemplate(studioAccess.industryTemplate);
  if (!industryTemplate) {
    return (
      <main role="alert" className="flex h-full items-center justify-center bg-white px-5 text-center text-sm text-neutral-600">
        {localizeCopy('当前行业的 AI 工作室尚未配置。', 'Lo Studio AI di questo settore non è configurato.')}
      </main>
    );
  }

  if (!shouldUseModaUIIndustryChat(studioAccess.industryTemplate, studioAccess.merchantIndustry)) {
    return (
      <ModaUIWorkbench
        isIt={isIt}
        merchantId={merchantId}
        merchantName={merchantName}
        industryTemplateId={industryTemplate.id}
        initialCapability={initialCapability}
        onExit={onExit}
      />
    );
  }

  return (
    <MerchantAiHome
      isIt={isIt}
      merchantId={merchantId}
      merchantName={merchantName}
      industryTemplateId={industryTemplate.id}
      industryChatOnly
      copilotContext={{
        context: 'dashboard',
        scope: 'home',
        pageContext: modauiPageContext
      }}
      onExit={onExit}
      onNavigate={onNavigate}
    />
  );
};
