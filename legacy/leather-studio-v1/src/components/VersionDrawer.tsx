import React from 'react';
import { History, RotateCcw, X } from 'lucide-react';
import type { Project } from '../shared/types';

interface VersionDrawerProps {
  project: Project;
  onClose: () => void;
  onRestoreVersion: (version: number) => Promise<void>;
}

export const VersionDrawer: React.FC<VersionDrawerProps> = ({
  project,
  onClose,
  onRestoreVersion,
}) => {
  return (
    <div className="fixed inset-0 z-50 bg-[#141413]/35 flex justify-end">
      <div className="w-full max-w-[400px] bg-[#FFFFFF] h-full border-l border-[#E4E2DC] flex flex-col shadow-xl">
        <div className="px-5 py-4 border-b border-[#ECEAE3] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-[#9A4D22]" />
            <h2 className="font-display text-sm font-semibold text-[#141413]">
              设计版本历史 (当前 v{project.currentVersion})
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭版本历史"
            className="p-1 text-[#5C5B57] hover:text-[#141413]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-[#ECEAE3] px-5">
          {project.versions.map((ver) => (
            <div key={`${ver.version}-${ver.timestamp}`} className="py-3.5 space-y-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs">
                  <span className="font-mono font-semibold text-[#141413]">
                    v{ver.version}
                  </span>
                  <span className="text-[#78756E]">
                    {ver.author === 'ai' ? 'AI 执行' : '手工操作'}
                  </span>
                </div>
                <span className="text-[11px] font-mono tabular-nums text-[#78756E]">
                  {new Date(ver.timestamp).toLocaleString('zh-CN', {
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
              <p className="text-xs text-[#5C5B57] leading-relaxed">{ver.summary}</p>
              <div className="flex items-center justify-between pt-1">
                <span className="text-[11px] font-mono tabular-nums text-[#78756E]">
                  {ver.snapshot.dimensions.widthMm}×{ver.snapshot.dimensions.heightMm}×
                  {ver.snapshot.dimensions.depthMm}mm · {ver.snapshot.patterns.length} 片
                </span>
                {ver.version !== project.currentVersion && (
                  <button
                    type="button"
                    onClick={() => onRestoreVersion(ver.version)}
                    className="text-xs font-medium text-[#9A4D22] hover:underline flex items-center gap-1 whitespace-nowrap shrink-0"
                  >
                    <RotateCcw className="w-3 h-3" />
                    恢复此版本
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
