import React, { useEffect, useRef, useState } from 'react';
import { Check, Loader2, Send, X } from 'lucide-react';
import { BAG_TYPE_LABELS } from '../shared/leatherKnowledge';
import type {
  AiChatMessage,
  CommandPlan,
  DesignOption,
  Project,
} from '../shared/types';

interface AiChatPanelProps {
  project: Project;
  isPlanning: boolean;
  pendingPlan: CommandPlan | null;
  onSendPrompt: (prompt: string) => Promise<void>;
  onConfirmPlan: (plan: CommandPlan) => Promise<void>;
  onSelectOption: (option: DesignOption, plan: CommandPlan) => Promise<void>;
  onCancelPlan: () => void;
}

const QUICK_PROMPTS = [
  '把包宽增加 2 厘米',
  '包底增加支撑，保持整体外观不变',
  '尽量减少材料浪费',
  '里面增加两个口袋',
  '提手更舒适一些',
  '做一个更高级的意大利风格手提包',
];

const SOURCE_LABELS: Record<string, string> = {
  user_confirmed: '用户确认尺寸',
  ai_estimated: 'AI 估算尺寸',
  scale_calibrated: '比例尺校准',
  computed: '计算推导',
};

export const AiChatPanel: React.FC<AiChatPanelProps> = ({
  project,
  isPlanning,
  pendingPlan,
  onSendPrompt,
  onConfirmPlan,
  onSelectOption,
  onCancelPlan,
}) => {
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [project.messages, pendingPlan, isPlanning]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isPlanning) return;
    const text = input.trim();
    setInput('');
    await onSendPrompt(text);
  };

  return (
    <aside className="w-full lg:w-[350px] shrink-0 bg-[#FFFFFF] border-r border-[#E4E2DC] flex flex-col h-full min-h-0">
      {/* Context strip */}
      <div className="px-4 py-3 border-b border-[#ECEAE3] bg-[#FAF9F6]">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-display text-sm font-semibold text-[#141413]">
            AI 设计助手
          </h2>
          <span className="text-xs font-mono tabular-nums text-[#78756E]">
            v{project.currentVersion}
          </span>
        </div>
        <div className="mt-1 text-xs text-[#5C5B57] font-mono tabular-nums flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
          <span>{BAG_TYPE_LABELS[project.bagType]?.split(' ')[0]}</span>
          <span aria-hidden="true">·</span>
          <span>
            {project.dimensions.widthMm}×{project.dimensions.heightMm}×
            {project.dimensions.depthMm}mm
          </span>
          <span aria-hidden="true">·</span>
          <span
            className={
              project.dimensions.dimensionSource === 'ai_estimated'
                ? 'text-[#D97706]'
                : 'text-[#16A34A]'
            }
          >
            {SOURCE_LABELS[project.dimensions.dimensionSource] || '计算尺寸'}
          </span>
        </div>
      </div>

      {/* Chat Thread */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {project.messages.map((msg: AiChatMessage) => (
          <div
            key={msg.id}
            className={`flex flex-col ${
              msg.role === 'user' ? 'items-end' : 'items-start'
            }`}
          >
            <div
              className={`max-w-[92%] rounded-lg px-3.5 py-2.5 text-[13px] leading-relaxed whitespace-pre-wrap ${
                msg.role === 'user'
                  ? 'bg-[#141413] text-white'
                  : 'bg-[#F6F5F1] border border-[#E4E2DC] text-[#141413]'
              }`}
            >
              {msg.content}

              {msg.diffSummary && msg.diffSummary.length > 0 && (
                <div className="mt-2.5 pt-2 border-t border-[#E4E2DC] space-y-1">
                  <div className="text-[11px] font-medium text-[#5C5B57]">
                    CAD 几何变更记录：
                  </div>
                  {msg.diffSummary.map((d, idx) => (
                    <div
                      key={idx}
                      className="text-xs font-mono tabular-nums text-[#16A34A]"
                    >
                      • {d}
                    </div>
                  ))}
                </div>
              )}

              {msg.role === 'assistant' &&
                msg.plan?.memoryHints &&
                msg.plan.memoryHints.length > 0 && (
                  <div className="mt-2.5 pt-2 border-t border-[#E4E2DC] space-y-0.5">
                    <div className="text-[11px] font-medium text-[#78756E]">
                      引用长记忆与工程规范：
                    </div>
                    {msg.plan.memoryHints.map((hint, idx) => (
                      <div key={idx} className="text-[11px] text-[#5C5B57] leading-snug">
                        {hint}
                      </div>
                    ))}
                  </div>
                )}

              {/* Proposed Design Options inside message */}
              {msg.plan?.proposedOptions &&
                msg.plan.proposedOptions.length > 0 &&
                msg.planStatus === 'pending_confirmation' && (
                  <div className="mt-3 space-y-2">
                    {msg.plan.proposedOptions.map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => onSelectOption(opt, msg.plan!)}
                        className="w-full text-left p-2.5 rounded border border-[#D8D5CD] bg-white hover:border-[#9A4D22] transition-colors"
                      >
                        <div className="text-xs font-semibold text-[#9A4D22]">
                          {opt.title}
                        </div>
                        <div className="text-xs text-[#5C5B57] mt-0.5">
                          {opt.description}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
            </div>
            <span className="mt-1 text-[11px] text-[#78756E] font-mono tabular-nums">
              {new Date(msg.timestamp).toLocaleTimeString('zh-CN', {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          </div>
        ))}

        {/* Pending Confirmation Plan */}
        {pendingPlan && (
          <div className="border border-[#9A4D22]/40 bg-[#FAF6F2] rounded-lg p-3.5 space-y-2.5">
            <div className="text-xs font-semibold text-[#9A4D22]">
              请确认结构修改方案
            </div>
            <p className="text-xs text-[#141413] leading-relaxed">
              {pendingPlan.replyText}
            </p>
            {pendingPlan.affectedParts.length > 0 && (
              <div className="text-[11px] text-[#5C5B57]">
                受影响部件：{pendingPlan.affectedParts.join('、')}
              </div>
            )}

            {pendingPlan.proposedOptions && pendingPlan.proposedOptions.length > 0 ? (
              <div className="space-y-2 pt-1">
                {pendingPlan.proposedOptions.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => onSelectOption(opt, pendingPlan)}
                    className="w-full text-left p-2.5 rounded border border-[#D8D5CD] bg-white hover:border-[#9A4D22] transition-colors"
                  >
                    <div className="text-xs font-semibold text-[#141413]">
                      选择：{opt.title}
                    </div>
                    <div className="text-[11px] text-[#5C5B57] mt-0.5">
                      {opt.description}
                    </div>
                  </button>
                ))}
                <button
                  type="button"
                  onClick={onCancelPlan}
                  className="text-xs text-[#78756E] hover:text-[#141413]"
                >
                  暂不修改
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => onConfirmPlan(pendingPlan)}
                  className="px-3 py-1.5 text-xs font-medium text-white bg-[#9A4D22] hover:bg-[#823F1A] rounded flex items-center gap-1 whitespace-nowrap shrink-0"
                >
                  <Check className="w-3.5 h-3.5" />
                  确认执行修改
                </button>
                <button
                  type="button"
                  onClick={onCancelPlan}
                  className="px-3 py-1.5 text-xs font-medium text-[#5C5B57] bg-white border border-[#D8D5CD] rounded hover:bg-[#F6F5F1] flex items-center gap-1 whitespace-nowrap shrink-0"
                >
                  <X className="w-3.5 h-3.5" />
                  取消
                </button>
              </div>
            )}
          </div>
        )}

        {isPlanning && (
          <div className="flex items-center gap-2 text-xs text-[#5C5B57] py-1">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-[#9A4D22]" />
            AI 正在解析结构指令并计算联动纸格...
          </div>
        )}
      </div>

      {/* Quick Prompts & Input */}
      <div className="border-t border-[#ECEAE3] p-3 bg-[#FAF9F6] space-y-2.5">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {QUICK_PROMPTS.map((qp) => (
            <button
              key={qp}
              type="button"
              disabled={isPlanning}
              onClick={() => onSendPrompt(qp)}
              className="px-2.5 py-1 text-[11px] text-[#5C5B57] hover:text-[#141413] bg-white border border-[#E4E2DC] hover:border-[#9A4D22] rounded transition-colors whitespace-nowrap shrink-0"
            >
              {qp}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="flex items-end gap-2">
          <textarea
            rows={2}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
            placeholder="用普通话告诉 AI 你想改哪里，如：把包宽增加 2 厘米..."
            className="flex-1 resize-none px-3 py-2 text-xs bg-white border border-[#D8D5CD] rounded-md focus:outline-none focus:border-[#9A4D22] text-[#141413]"
          />
          <button
            type="submit"
            disabled={!input.trim() || isPlanning}
            aria-label="发送指令"
            className="h-9 px-3 bg-[#9A4D22] hover:bg-[#823F1A] disabled:opacity-45 text-white rounded-md flex items-center justify-center shrink-0 transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </aside>
  );
};
