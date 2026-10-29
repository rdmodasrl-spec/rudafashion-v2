
import React, { useEffect, useState } from 'react';
import { useB2B } from '../../../../context/B2BContext';
import { 
  Mail, 
  Globe, 
  ShieldCheck, 
  AlertCircle, 
  CheckCircle2, 
  XCircle, 
  Search, 
  MoreVertical,
  ChevronRight,
  Database,
  Activity,
  Settings,
  History,
  HardDrive
} from 'lucide-react';

interface EmailStats {
  totalDomains: number;
  totalMailboxes: number;
  verifiedDomains: number;
  recentLogs: any[];
}

export const AdminEmailMgmt: React.FC = () => {
  const { addNotification } = useB2B();
  const [stats, setStats] = useState<EmailStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'domains' | 'logs'>('overview');

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/email/overview');
      const data = await res.json();
      if (data.success) setStats(data.stats);
    } catch (error) {
      addNotification('warning', 'Error', 'Failed to load email admin data');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between border-b border-neutral-200 pb-5">
        <div>
          <h2 className="text-xl font-bold text-neutral-900">邮箱管理</h2>
          <p className="text-sm text-neutral-500 mt-1">监控全平台企业邮箱运行状态、域名验证及资源使用情况。</p>
        </div>
        <div className="flex gap-2">
          <button className="p-2.5 rounded-xl border border-neutral-200 hover:bg-neutral-50 transition-colors">
            <Settings className="w-5 h-5 text-neutral-500" />
          </button>
        </div>
      </header>

      {/* Admin Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: '总域名数', value: stats?.totalDomains || 0, icon: Globe, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: '总邮箱数', value: stats?.totalMailboxes || 0, icon: Mail, color: 'text-purple-600', bg: 'bg-purple-50' },
          { label: '已验证域名', value: stats?.verifiedDomains || 0, icon: ShieldCheck, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: '服务状态', value: '正常', icon: Activity, color: 'text-emerald-600', bg: 'bg-emerald-50' },
        ].map((item, idx) => (
          <div key={idx} className="bg-white border border-neutral-200 rounded-2xl p-5 flex items-center gap-4">
            <div className={`${item.bg} p-3 rounded-xl`}>
              <item.icon className={`w-6 h-6 ${item.color}`} />
            </div>
            <div>
              <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">{item.label}</p>
              <p className="text-xl font-bold text-neutral-900">{item.value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white border border-neutral-200 rounded-2xl overflow-hidden">
        <div className="flex border-b border-neutral-100">
          {[
            { id: 'overview', label: '最近活动', icon: History },
            { id: 'domains', label: '域名监控', icon: Globe },
            { id: 'logs', label: '系统日志', icon: Database }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-6 py-4 text-sm font-bold flex items-center gap-2 border-b-2 transition-all ${activeTab === tab.id ? 'border-black text-black bg-neutral-50/50' : 'border-transparent text-neutral-400 hover:text-neutral-600'}`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        <div className="p-6">
          {activeTab === 'overview' && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-neutral-900 mb-4">最近邮件传输记录</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest border-b border-neutral-100">
                      <th className="pb-4">时间</th>
                      <th className="pb-4">商家</th>
                      <th className="pb-4">类型</th>
                      <th className="pb-4">发件人 / 收件人</th>
                      <th className="pb-4">状态</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-50">
                    {stats?.recentLogs && stats.recentLogs.length > 0 ? stats.recentLogs.map((log: any) => (
                      <tr key={log.id} className="text-sm">
                        <td className="py-4 text-neutral-500">{new Date(log.createdAt).toLocaleString()}</td>
                        <td className="py-4 font-medium">{log.merchant.name}</td>
                        <td className="py-4">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${log.type === 'outbound' ? 'bg-blue-50 text-blue-600' : 'bg-purple-50 text-purple-600'}`}>
                            {log.type}
                          </span>
                        </td>
                        <td className="py-4">
                          <p className="text-xs font-mono">{log.from}</p>
                          <p className="text-[10px] text-neutral-400 mt-0.5">→ {log.to}</p>
                        </td>
                        <td className="py-4">
                          <span className={`flex items-center gap-1.5 text-[10px] font-bold ${log.status === 'sent' || log.status === 'received' ? 'text-emerald-600' : 'text-red-600'}`}>
                            {log.status === 'sent' || log.status === 'received' ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                            {log.status.toUpperCase()}
                          </span>
                        </td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan={5} className="py-12 text-center text-neutral-400 italic">暂无传输记录</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'domains' && (
            <div className="py-12 text-center text-neutral-400">
              <Globe className="w-12 h-12 mx-auto mb-4 opacity-20" />
              <p>全平台域名监控功能正在开发中...</p>
            </div>
          )}

          {activeTab === 'logs' && (
            <div className="py-12 text-center text-neutral-400">
              <Database className="w-12 h-12 mx-auto mb-4 opacity-20" />
              <p>详细系统日志查询正在集成中...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
