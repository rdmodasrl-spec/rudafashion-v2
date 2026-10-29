import React, { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, KeyRound, Loader2, ShieldCheck } from 'lucide-react';
import { apiGet } from '../../../../api/client';
import { useB2B } from '../../../../context/B2BContext';


interface PaymentSettingsCardProps {
  audience: 'admin' | 'merchant';
  isIt?: boolean;
}

type PaymentStatus = {
  provider: string;
  supportsPayments: boolean;
  supportsRefunds: boolean;
  mode: 'placeholder' | 'configured';
  onlineCheckoutEnabled?: boolean;
};

export const PaymentSettingsCard: React.FC<PaymentSettingsCardProps> = ({ audience, isIt = false }) => {
  const { localizeCopy } = useB2B();
  const [payment, setPayment] = useState<PaymentStatus | null>(null);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    const endpoint = audience === 'admin' ? '/api/admin/payment-config' : '/api/merchant/payment-config';
    apiGet<{ success: true; payment: PaymentStatus }>(endpoint)
      .then(result => setPayment(result.payment))
      .catch(() => setLoadError(true));
  }, [audience]);

  const configured = audience === 'admin'
    ? payment?.mode === 'configured'
    : payment?.onlineCheckoutEnabled === true;
  const statusLabel = loadError
    ? (localizeCopy('无法读取状态', 'Impossibile verificare'))
    : !payment
      ? (localizeCopy('读取中', 'Verifica in corso'))
      : configured
        ? (localizeCopy('已配置并启用', 'Configurato e attivo'))
        : (localizeCopy('未配置', 'Non configurato'));

  return (
    <section className={`bg-white rounded-xl border ${configured ? 'border-emerald-200' : 'border-amber-200'} shadow-xs overflow-hidden`}>
      <div className={`${configured ? 'bg-emerald-50/60 border-emerald-100' : 'bg-amber-50/60 border-amber-100'} p-4 border-b flex items-start gap-3`}>
        <KeyRound className={`w-5 h-5 ${configured ? 'text-emerald-700' : 'text-amber-700'} mt-0.5 shrink-0`} />
        <div>
          <h3 className="text-sm font-bold text-neutral-900">
            {localizeCopy('支付通道设置', 'Integrazione pagamenti')}
          </h3>
          <p className="text-xs text-neutral-600 mt-1">
            {configured
              ? localizeCopy('支付服务已启用，凭证仅保留在服务端。', 'Il provider è attivo. Le credenziali restano solo lato server.')
              : localizeCopy('当前未连接外部支付服务，凭证仅允许配置在服务端。', 'Nessun provider esterno è collegato. Le credenziali sono gestite solo lato server.')}
          </p>
        </div>
      </div>
      <div className="p-4 grid gap-3 sm:grid-cols-3 text-xs">
        <div>
          <div className="text-neutral-500">{localizeCopy('支付服务', 'Servizio di pagamento')}</div>
          <div className="font-semibold text-neutral-900 mt-1">{payment?.provider || (localizeCopy("人工处理", "Gestione manuale"))}</div>
        </div>
        <div>
          <div className="text-neutral-500">{localizeCopy('状态', 'Stato')}</div>
          <div className={`mt-1 inline-flex items-center gap-1.5 font-semibold ${configured ? 'text-emerald-700' : 'text-amber-700'}`}>
            {!payment && !loadError ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : configured ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
            {statusLabel}
          </div>
        </div>
        <div>
          <div className="text-neutral-500">{localizeCopy('适用范围', 'Ambito')}</div>
          <div className="font-semibold text-neutral-900 mt-1">
            {audience === 'admin' ? (localizeCopy('平台收款与退款', 'Piattaforma')) : (localizeCopy('商户结算', 'Liquidazioni'))}
          </div>
        </div>
      </div>
      <div className="px-4 pb-4 flex items-start gap-2 text-[11px] text-neutral-500">
        <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 mt-0.5 shrink-0" />
        {isIt
          ? (configured ? `Servizio ${payment?.provider} attivo; pagamenti: ${payment?.supportsPayments ? 'sì' : 'no'}, rimborsi: ${payment?.supportsRefunds ? 'sì' : 'no'}.` : 'I flussi restano in modalità sicura senza chiamate esterne.')
          : (configured ? `支付服务已启用；收款：${payment?.supportsPayments ? '支持' : '关闭'}，退款：${payment?.supportsRefunds ? '支持' : '关闭'}。` : '当前使用安全的人工处理方式，暂不会向外部支付平台发起请求。')}
      </div>
    </section>
  );
};
