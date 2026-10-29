import React, { useCallback, useEffect, useState } from 'react';
import { Copy, Gift, RefreshCw } from 'lucide-react';
import { apiGet } from '../../../../api/client';

type ReferralProgram = {
  referralLink: string;
  referredMerchantCount: number;
  qualifiedReferralCount: number;
  pendingReferralCount: number;
  referralRewardsMonths: number;
  trial: { startsAt: string; endsAt: string | null } | null;
};

export const MerchantReferralProgram: React.FC = () => {
  const [program, setProgram] = useState<ReferralProgram | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setProgram(await apiGet<ReferralProgram>('/api/merchant/growth/referrals'));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '推广奖励暂时无法读取');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const copyLink = async () => {
    if (!program?.referralLink) return;
    try {
      await navigator.clipboard.writeText(program.referralLink);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '复制失败，请检查浏览器剪贴板权限');
    }
  };

  return (
    <section className="rounded-md border border-neutral-200 bg-white p-4" aria-labelledby="merchant-referral-heading">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <Gift className="h-4 w-4 text-neutral-700" />
          <div>
            <h2 id="merchant-referral-heading" className="text-sm font-semibold text-neutral-900">推荐奖励</h2>
            <div className="mt-1 flex flex-wrap gap-2 text-[10px] text-neutral-500"><span>完成注册验证</span><span>补齐资料</span><span>上架 3 个商品</span><span>完成 1 项操作</span><span>奖励 3 个月初级版</span></div>
          </div>
        </div>
        <button type="button" onClick={() => void load()} disabled={loading} aria-label="刷新推荐奖励" className="rounded p-1 text-neutral-500 hover:bg-neutral-100 disabled:opacity-50">
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>
      {error && <p role="alert" className="mt-3 text-xs text-red-700">{error}</p>}
      {loading && !program ? (
        <p className="mt-3 text-xs text-neutral-500">正在读取推广信息…</p>
      ) : program ? (
        <>
          <div className="mt-4 grid grid-cols-3 gap-2">
            <div className="rounded bg-neutral-50 p-2">
              <p className="text-[10px] text-neutral-500">已推荐</p>
              <p className="mt-1 text-sm font-semibold text-neutral-900">{program.referredMerchantCount}</p>
            </div>
            <div className="rounded bg-neutral-50 p-2">
              <p className="text-[10px] text-neutral-500">已达标</p>
              <p className="mt-1 text-sm font-semibold text-neutral-900">{program.qualifiedReferralCount}</p>
            </div>
            <div className="rounded bg-neutral-50 p-2">
              <p className="text-[10px] text-neutral-500">奖励月数</p>
              <p className="mt-1 text-sm font-semibold text-neutral-900">{program.referralRewardsMonths}</p>
            </div>
          </div>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <input readOnly aria-label="商家推广链接" value={program.referralLink} className="min-w-0 flex-1 rounded border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs text-neutral-600" />
            <button type="button" onClick={() => void copyLink()} className="inline-flex min-h-9 items-center justify-center gap-2 rounded bg-neutral-950 px-3 text-xs font-semibold text-white hover:bg-neutral-800">
              <Copy className="h-3.5 w-3.5" />{copied ? '已复制' : '复制链接'}
            </button>
          </div>
          {program.trial?.endsAt && (
            <p className="mt-2 text-[11px] text-neutral-500">当前初级版试用／奖励权益至 {new Date(program.trial.endsAt).toLocaleDateString()}</p>
          )}
        </>
      ) : null}
    </section>
  );
};
