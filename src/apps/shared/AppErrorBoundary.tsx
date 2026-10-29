import React from 'react';

export class AppErrorBoundary extends React.Component<
  React.PropsWithChildren,
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.error('[app-render] failed:', error);
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-4 text-center">
        <div className="max-w-md rounded-2xl border border-neutral-200 bg-white p-8 shadow-lg">
          <h1 className="text-lg font-bold text-neutral-950">页面加载遇到问题</h1>
          <p className="mt-3 text-sm leading-6 text-neutral-600">登录状态已经保留。请刷新页面重试；如果问题持续，请联系 RUDA 客服。</p>
          <button type="button" onClick={() => window.location.reload()} className="mt-6 bg-black px-5 py-3 text-sm font-semibold text-white transition hover:bg-neutral-800">
            刷新页面
          </button>
        </div>
      </div>
    );
  }
}
