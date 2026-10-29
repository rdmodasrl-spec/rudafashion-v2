import React from 'react';
import { CheckCircle2, Info, AlertTriangle, X } from 'lucide-react';
import { useB2B } from '../../../context/B2BContext';

export const NotificationToasts: React.FC = () => {
  const { notifications, removeNotification, localizeCopy } = useB2B();

  if (notifications.length === 0) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-md w-full pointer-events-none">
      {notifications.map((n) => (
        <div
          key={n.id}
          className={`pointer-events-auto p-4 rounded-xl shadow-xl border flex items-start gap-3 backdrop-blur-md transition-all duration-300 animate-in slide-in-from-right-8 ${
            n.type === 'success'
              ? 'bg-neutral-900/95 text-white border-emerald-500/40'
              : n.type === 'warning'
              ? 'bg-amber-950/95 text-amber-100 border-amber-500/40'
              : 'bg-neutral-900/95 text-white border-neutral-700'
          }`}
        >
          <div className="shrink-0 mt-0.5">
            {n.type === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-400" />}
            {n.type === 'warning' && <AlertTriangle className="w-5 h-5 text-amber-400" />}
            {n.type === 'info' && <Info className="w-5 h-5 text-blue-400" />}
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="font-semibold text-sm leading-tight text-white mb-0.5">{n.title}</h4>
            <p className="text-xs text-neutral-300 leading-relaxed break-words">{n.message}</p>
          </div>
          <button
            type="button"
            onClick={() => removeNotification(n.id)}
            aria-label={localizeCopy('关闭通知', 'Chiudi notifica')}
            title={localizeCopy('关闭通知', 'Chiudi notifica')}
            className="shrink-0 text-neutral-400 hover:text-white p-1 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
};
