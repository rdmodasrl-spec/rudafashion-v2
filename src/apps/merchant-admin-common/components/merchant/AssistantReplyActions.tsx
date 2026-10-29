import React, { useEffect, useRef, useState } from 'react';
import { Check, Copy, Share2, Trash2 } from 'lucide-react';
import { apiDelete } from '../../../../api/client';
import { useB2B } from '../../../../context/B2BContext';

/**
 * AI 回复下方的唯一操作行（复制 / 分享 / 删除）。
 *
 * 电脑端与手机网页端共用；小程序不是 React 运行时，按同一契约在 pages/assistant 内实现。
 * 复制成功后只显示短暂的“已复制”，不弹窗；删除必须经过确认并等待服务端真实结果。
 */
export type AssistantReplyActionsProps = {
  text: string;
  /** 服务端消息 ID；本地产物（图片结果、任务状态文案）没有 ID 时只做本地移除。 */
  messageId?: string;
  onDeleted: (messageId?: string) => void;
  onBeforeDelete?: () => void;
  onError?: (message: string) => void;
  disabled?: boolean;
  className?: string;
};

const actionClass = 'flex h-7 w-7 items-center justify-center rounded-md text-neutral-400 opacity-60 transition hover:text-neutral-800 hover:opacity-100 focus-visible:text-neutral-800 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-neutral-300 active:opacity-100 disabled:cursor-not-allowed disabled:opacity-30';

export const AssistantReplyActions: React.FC<AssistantReplyActionsProps> = ({
  text,
  messageId,
  onDeleted,
  onBeforeDelete,
  onError,
  disabled = false,
  className = ''
}) => {
  const { localizeCopy } = useB2B();
  const [copied, setCopied] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [inlineError, setInlineError] = useState('');
  const copiedTimerRef = useRef<number | null>(null);

  useEffect(() => () => {
    if (copiedTimerRef.current !== null) window.clearTimeout(copiedTimerRef.current);
  }, []);

  const copyText = async (value: string) => {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return;
    }
    const area = document.createElement('textarea');
    area.value = value;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    const succeeded = document.execCommand('copy');
    document.body.removeChild(area);
    if (!succeeded) throw new Error('COPY_FAILED');
  };

  const handleCopy = async () => {
    try {
      await copyText(text);
      setCopied(true);
      setInlineError('');
      if (copiedTimerRef.current !== null) window.clearTimeout(copiedTimerRef.current);
      copiedTimerRef.current = window.setTimeout(() => {
        setCopied(false);
        copiedTimerRef.current = null;
      }, 1600);
    } catch {
      const message = localizeCopy('复制失败，请检查剪贴板权限。', 'Impossibile copiare il messaggio.');
      setInlineError(message);
      onError?.(message);
    }
  };

  const handleShare = async () => {
    try {
      await navigator.share({ text });
    } catch (shareError) {
      if (shareError instanceof Error && shareError.name === 'AbortError') return;
      const message = localizeCopy('分享失败，可改用复制。', 'Condivisione non riuscita: usa Copia.');
      setInlineError(message);
      onError?.(message);
    }
  };

  const handleDelete = async () => {
    if (disabled || deleting) return;
    if (!window.confirm(localizeCopy(
      '删除这条回复？只删除当前这条 AI 回复，无法恢复。',
      'Eliminare questa risposta? Solo questa risposta, non è reversibile.'
    ))) return;
    onBeforeDelete?.();
    if (!messageId) {
      onDeleted();
      return;
    }
    setDeleting(true);
    setInlineError('');
    try {
      await apiDelete<{ success: true; messageId: string }>(`/api/merchant/assistant/messages/${encodeURIComponent(messageId)}`);
      onDeleted(messageId);
    } catch (deleteError) {
      const code = deleteError instanceof Error ? deleteError.message : '';
      // 服务端已不存在该消息：界面与真实状态一致，直接移除。
      if (code === 'ASSISTANT_MESSAGE_NOT_FOUND') {
        onDeleted(messageId);
        return;
      }
      const message = code || localizeCopy('删除失败，请稍后重试。', 'Eliminazione non riuscita. Riprova.');
      setInlineError(message);
      onError?.(message);
    } finally {
      setDeleting(false);
    }
  };

  const shareAvailable = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  return (
    <div className={`flex flex-wrap items-center gap-0.5 text-neutral-400 ${className}`}>
      {shareAvailable && (
        <button type="button" onClick={() => void handleShare()} disabled={disabled || !text} aria-label={localizeCopy('分享回答', 'Condividi risposta')} title={localizeCopy('分享', 'Condividi')} className={actionClass}>
          <Share2 className="h-3.5 w-3.5" strokeWidth={1.7} />
        </button>
      )}
      <button type="button" onClick={() => void handleCopy()} disabled={disabled || !text} aria-label={localizeCopy('复制回答', 'Copia risposta')} title={localizeCopy('复制', 'Copia')} className={actionClass}>
        {copied ? <Check className="h-3.5 w-3.5" strokeWidth={1.9} /> : <Copy className="h-3.5 w-3.5" strokeWidth={1.7} />}
      </button>
      <button type="button" onClick={() => void handleDelete()} disabled={disabled || deleting} aria-label={localizeCopy('删除回答', 'Elimina risposta')} title={localizeCopy('删除', 'Elimina')} className={actionClass}>
        <Trash2 className="h-3.5 w-3.5" strokeWidth={1.7} />
      </button>
      {copied && <span className="pl-0.5 text-[10px] text-neutral-500">{localizeCopy('已复制', 'Copiato')}</span>}
      {inlineError && <span role="status" className="pl-0.5 text-[10px] text-rose-700">{inlineError}</span>}
    </div>
  );
};

export default AssistantReplyActions;
