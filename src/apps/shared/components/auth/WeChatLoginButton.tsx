import React, { useEffect, useState } from 'react';
import { useB2B } from '../../../../context/B2BContext';

export const WeChatLoginButton: React.FC<{ intent?: 'login' | 'bind' }> = ({ intent = 'login' }) => {
  const { localizeCopy } = useB2B();
  const [status, setStatus] = useState<'loading' | 'enabled' | 'disabled' | 'error'>('loading');

  useEffect(() => {
    let active = true;
    fetch('/api/auth/providers', { credentials: 'include' })
      .then(async response => {
        if (!response.ok) throw new Error('WECHAT_PROVIDER_STATUS_UNAVAILABLE');
        const result = await response.json() as { wechat?: { enabled?: boolean } };
        if (active) setStatus(result.wechat?.enabled === true ? 'enabled' : 'disabled');
      })
      .catch(() => {
        if (active) setStatus('error');
      });
    return () => { active = false; };
  }, []);

  return (
    <div className="space-y-1.5">
      <button
        type="button"
        disabled={status !== 'enabled'}
        onClick={() => window.location.assign('/api/auth/login/wechat')}
        className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-emerald-700 bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:border-neutral-300 disabled:bg-neutral-100 disabled:text-neutral-500"
      >
        <span aria-hidden="true" className="grid h-5 w-5 place-items-center rounded-full border border-current text-[10px] font-black">W</span>
        {status === 'enabled'
          ? intent === 'bind'
            ? localizeCopy('绑定微信公众号', 'Collega WeChat')
            : localizeCopy('使用微信公众号登录', 'Accedi con WeChat')
          : status === 'loading'
            ? localizeCopy('正在检查微信公众号登录…', 'Verifica accesso WeChat…')
            : localizeCopy('微信公众号登录暂不可用', 'Accesso WeChat non disponibile')}
      </button>
      {status === 'disabled' && <p role="status" className="text-center text-xs text-neutral-500">{localizeCopy('请联系平台管理员完成服务号 AppID 和 AppSecret 配置。', 'Contatta l’amministratore per configurare il servizio WeChat.')}</p>}
      {status === 'error' && <p role="alert" className="text-center text-xs text-rose-700">{localizeCopy('无法读取微信公众号登录状态，请刷新页面重试。', 'Impossibile verificare WeChat. Aggiorna la pagina e riprova.')}</p>}
    </div>
  );
};
