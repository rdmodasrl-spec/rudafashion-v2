import React from 'react';
import { ArrowLeft, Ban } from 'lucide-react';
import { useB2B } from '../../../context/B2BContext';

type ModuleUnavailableViewProps = {
  /** 页面标题，例如「时尚版块」「ModaUI」。 */
  title: string;
  /** 可选说明；默认使用统一文案，避免每个模块自造提示。 */
  description?: string;
};

/**
 * 平台关闭某个版块时的统一占位页。
 * 关闭只停用入口与操作，不删除任何数据；此处不渲染空白页、死按钮或错误循环。
 */
export const ModuleUnavailableView: React.FC<ModuleUnavailableViewProps> = ({ title, description }) => {
  const { setCurrentView, localizeCopy } = useB2B();

  return (
    <section className="mx-auto flex min-h-[60vh] w-full max-w-xl flex-col items-center justify-center px-5 py-16 text-center">
      <span className="flex h-12 w-12 items-center justify-center border border-neutral-300 text-neutral-500">
        <Ban className="h-5 w-5" strokeWidth={1.6} aria-hidden="true" />
      </span>
      <h1 className="mt-5 text-xl font-semibold tracking-tight text-neutral-950">
        {localizeCopy('该功能暂未开放', 'Questa funzione non è al momento disponibile')}
      </h1>
      <p className="mt-2 text-sm leading-6 text-neutral-500">
        {description ?? localizeCopy('当前已由平台关闭。历史内容与数据均已保留，重新开启后可继续使用。', 'La funzione è stata disattivata dalla piattaforma. I contenuti restano salvati e torneranno disponibili alla riattivazione.')}
      </p>
      <p className="mt-1 text-xs text-neutral-400">{title}</p>
      <button
        type="button"
        onClick={() => setCurrentView('home')}
        className="mt-6 inline-flex items-center gap-2 border border-neutral-900 bg-neutral-900 px-4 py-2 text-sm text-white transition-colors hover:bg-neutral-700"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        {localizeCopy('返回首页', 'Torna alla home')}
      </button>
    </section>
  );
};
