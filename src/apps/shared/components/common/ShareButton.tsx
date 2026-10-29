import React, { useState } from 'react';
import { Check, Copy, Mail, MessageCircle, Share2 } from 'lucide-react';
import { buildShareUrl, recordShare, shareOrCopy, SharePayload } from '../../../../utils/share';

export const ShareButton: React.FC<SharePayload & { compact?: boolean; iconOnly?: boolean; className?: string }> = ({ compact, iconOnly = false, className = '', title, text, path, source }) => {
  const [status, setStatus] = useState<'idle' | 'done'>('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const handleShare = async (channel: 'native' | 'copy' | 'whatsapp' | 'email' | 'wechat' | 'facebook' = 'native') => {
    if (busy) return;
    setBusy(true);
    setErrorMessage('');
    try {
      const url = buildShareUrl(path, source || 'ruda');
      if (channel === 'whatsapp') {
        window.open(`https://wa.me/?text=${encodeURIComponent(`${text}\n${url}`)}`, '_blank', 'noopener,noreferrer');
        recordShare(source || 'ruda', 'whatsapp');
      } else if (channel === 'facebook') {
        window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`, '_blank', 'noopener,noreferrer');
        recordShare(source || 'ruda', 'facebook');
      } else if (channel === 'email') {
        window.location.href = `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(`${text}\n${url}`)}`;
        recordShare(source || 'ruda', 'email');
      } else {
        await shareOrCopy(
          { title, text, path, source },
          channel === 'native' ? 'native' : channel === 'wechat' ? 'wechat' : 'copy'
        );
      }
      setStatusMessage(channel === 'wechat' ? '已复制微信分享内容，请粘贴发送' : '分享链接已复制');
      setStatus('done');
      setOpen(false);
      window.setTimeout(() => setStatus('idle'), 2200);
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        setOpen(false);
        return;
      }
      console.error('[share] share action failed', error);
      setErrorMessage('分享失败，请检查浏览器权限后重试。');
      setOpen(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative inline-flex">
      <button
        type="button"
        onClick={() => setOpen(value => !value)}
        disabled={busy}
        aria-label={status === 'done' ? statusMessage : '分享此页面'}
        aria-expanded={open}
        aria-haspopup="menu"
        title={status === 'done' ? statusMessage : '分享此页面'}
        className={`inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs font-semibold text-neutral-700 transition-colors hover:border-neutral-950 hover:bg-neutral-950 hover:text-white disabled:cursor-wait disabled:opacity-60 ${className}`}
      >
        {status === 'done' ? <Check className="h-3.5 w-3.5" /> : (iconOnly ? <Share2 className="h-3.5 w-3.5" /> : (compact ? <Copy className="h-3.5 w-3.5" /> : <Share2 className="h-3.5 w-3.5" />))}
        {!iconOnly && <span>{status === 'done' ? '已完成' : '分享'}</span>}
      </button>
      {open && (
        <div role="menu" className="absolute bottom-full right-0 z-50 mb-2 flex min-w-48 flex-col gap-1 rounded-xl border border-neutral-200 bg-white p-1.5 text-left shadow-xl">
          {errorMessage && <p role="alert" className="px-2.5 py-1 text-[11px] text-rose-700">{errorMessage}</p>}
          <button type="button" role="menuitem" onClick={() => void handleShare('native')} className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-neutral-950 hover:text-white"><Share2 className="h-3.5 w-3.5" />系统分享</button>
          <button type="button" role="menuitem" onClick={() => void handleShare('wechat')} className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-neutral-950 hover:text-white"><MessageCircle className="h-3.5 w-3.5" />微信（复制后粘贴分享）</button>
          <button type="button" role="menuitem" onClick={() => void handleShare('whatsapp')} className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-neutral-950 hover:text-white"><MessageCircle className="h-3.5 w-3.5" />WhatsApp</button>
          <button type="button" role="menuitem" onClick={() => void handleShare('facebook')} className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-neutral-950 hover:text-white"><Share2 className="h-3.5 w-3.5" />Facebook</button>
          <button type="button" role="menuitem" onClick={() => void handleShare('email')} className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-neutral-950 hover:text-white"><Mail className="h-3.5 w-3.5" />邮件</button>
          <button type="button" role="menuitem" onClick={() => void handleShare('copy')} className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-neutral-950 hover:text-white"><Copy className="h-3.5 w-3.5" />复制链接</button>
        </div>
      )}
    </div>
  );
};
