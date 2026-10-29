import React, { useEffect, useRef, useState } from 'react';
import { useB2B } from '../../../../context/B2BContext';
import { MessageSquare, Search, Send, ArrowLeft, User as UserIc, Building2, Shield, ShoppingBag, Paperclip, Phone, Video, MoreVertical, CheckCheck, Check, ChevronRight } from 'lucide-react';
import type { MessageParticipantRole, MessageThreadSummary } from '../../../../types/b2b';

type DisplayRole = MessageParticipantRole | 'employee' | 'guest';

export const MessagesCenter: React.FC = () => {
  const { messageThreads, activeMessageThread, activeMessageThreadMessages, loadMessageThreads, openMessageThread, sendMessageReply, createMessageThread, authRole, authBuyer, authMerchantId, authAdminName, setCurrentView, authConsumer } = useB2B();
  const [search, setSearch] = useState('');
  const [draft, setDraft] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [newForm, setNewForm] = useState({ title: '', participantRole: 'merchant' as 'admin' | 'merchant' | 'buyer' | 'consumer', participantId: '', initial: '' });
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { void loadMessageThreads(); }, [loadMessageThreads]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [activeMessageThreadMessages.length, activeMessageThread?.id]);

  const displayNameByRole = (r: DisplayRole) => ({
    admin: '平台运营', merchant: '商户客服', buyer: '买家', consumer: '零售会员', system: '系统', employee: '员工', guest: '访客'
  })[r];
  const roleIc = (r: DisplayRole) => r === 'admin' ? Shield : r === 'merchant' ? Building2 : r === 'buyer' ? ShoppingBag : UserIc;
  const accentCls = (r: DisplayRole) => r === 'admin' ? 'from-violet-500 to-fuchsia-500' : r === 'merchant' ? 'from-amber-500 to-orange-500' : r === 'buyer' ? 'from-sky-500 to-indigo-500' : 'from-rose-500 to-pink-500';

  const filtered = messageThreads.filter(t => {
    if (!search) return true;
    const s = search.toLowerCase();
    return t.title.toLowerCase().includes(s) || (t.lastMessagePreview || '').toLowerCase().includes(s);
  });

  const send = async () => {
    const txt = draft.trim();
    if (!txt || !activeMessageThread || sending) return;
    setSending(true);
    await sendMessageReply(txt);
    setDraft('');
    setSending(false);
  };

  const create = async () => {
    if (!newForm.title || !newForm.participantId) return;
    await createMessageThread({ title: newForm.title, participantRole: newForm.participantRole, participantId: newForm.participantId, initialMessage: newForm.initial });
    setShowNew(false); setNewForm({ title: '', participantRole: 'merchant', participantId: '', initial: '' });
  };

  const myRole: DisplayRole = authRole === 'admin' || authRole === 'merchant' || authRole === 'buyer' || authRole === 'consumer'
    ? authRole
    : 'guest';

  return (
    <div className="max-w-[1400px] mx-auto px-0 md:px-6 py-4 md:py-10">
      <div className="ui-card overflow-hidden mx-4 md:mx-0" style={{ height: 'calc(100vh - 180px)', minHeight: 600 }}>
        <div className="grid h-full" style={{ gridTemplateColumns: activeMessageThread ? '320px 1fr' : '100% 0' }}>
          {!activeMessageThread && <style>{`.hide-no-thread { display: none; }`}</style>}
          <aside className="border-r border-neutral-200/70 flex flex-col min-w-0 h-full">
            <div className="p-5 border-b border-neutral-200/70">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="font-black text-xl md:text-2xl text-neutral-950 flex items-center gap-2"><MessageSquare className="w-5 h-5 text-sky-600" /> 消息中心</h2>
                  <p className="text-xs text-neutral-500 mt-0.5">
                    您的身份：<span className="font-bold text-neutral-800">{displayNameByRole(myRole)}</span>
                  </p>
                </div>
                <button onClick={() => setShowNew(true)} className="w-10 h-10 rounded-xl bg-neutral-900 text-white hover:bg-neutral-800 transition flex items-center justify-center shadow-md">
                  <Send className="w-4 h-4 rotate-45" />
                </button>
              </div>
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="搜索会话 / 消息内容..."
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-neutral-200 bg-neutral-50/60 text-sm focus:border-neutral-900 focus:bg-white focus:outline-none" />
              </div>
            </div>
            <div className="flex-1 overflow-auto divide-y divide-neutral-100">
              {filtered.length === 0 && (
                <div className="p-12 text-center text-neutral-400 text-sm">
                  <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-40" />
                  暂无会话，点击右上角 + 发起
                </div>
              )}
              {filtered.map(t => {
                const unread = t.unreadCount > 0;
                const active = activeMessageThread?.id === t.id;
                return (
                  <button key={t.id} onClick={() => openMessageThread(t.id)} className={`w-full text-left p-4 hover:bg-neutral-50 transition flex gap-3 ${active ? 'bg-neutral-100' : ''}`}>
                    <div className={`w-11 h-11 shrink-0 rounded-2xl bg-gradient-to-br ${accentCls(t.participantRole)} text-white flex items-center justify-center shadow-sm relative`}>
                      {React.createElement(roleIc(t.participantRole), { className: 'w-5 h-5' })}
                      {unread && <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-rose-500 text-[10px] font-black text-white flex items-center justify-center border-2 border-white">{t.unreadCount}</span>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1 gap-2">
                        <h4 className="font-bold text-sm text-neutral-900 truncate">{t.title}</h4>
                        <span className="text-[10px] text-neutral-400 shrink-0 tabular-nums">{new Date(t.updatedAt).toLocaleDateString()}</span>
                      </div>
                      <p className="text-xs text-neutral-500 truncate leading-5">
                        {unread ? <span className="font-bold text-neutral-800">{t.lastMessagePreview || '新会话 · 发送第一条消息'}</span> : (t.lastMessagePreview || '点击查看对话')}
                      </p>
                      <p className="text-[10px] text-neutral-400 mt-1 flex items-center gap-1.5">
                        <span className={`inline-block w-1.5 h-1.5 rounded-full bg-gradient-to-br ${accentCls(t.participantRole)}`} />
                        {displayNameByRole(t.participantRole)} · #{t.participantId.slice(0, 8)}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </aside>

          <section className="hide-no-thread flex flex-col h-full min-w-0">
            {activeMessageThread ? (
              <>
                <header className="px-5 md:px-6 py-4 border-b border-neutral-200/70 flex items-center gap-3 bg-white/80 backdrop-blur">
                  <button onClick={() => openMessageThread(null)} className="md:hidden w-10 h-10 -ml-2 rounded-xl hover:bg-neutral-100 flex items-center justify-center"><ArrowLeft className="w-4 h-4" /></button>
                  <div className={`w-12 h-12 shrink-0 rounded-2xl bg-gradient-to-br ${accentCls(activeMessageThread.participantRole)} text-white flex items-center justify-center shadow-sm`}>
                    {React.createElement(roleIc(activeMessageThread.participantRole), { className: 'w-5 h-5' })}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-black text-base md:text-lg text-neutral-950 truncate">{activeMessageThread.title}</h3>
                    <p className="text-xs text-neutral-500">
                      {displayNameByRole(activeMessageThread.participantRole)} · 会话 ID {activeMessageThread.id.slice(0, 10)}
                    </p>
                  </div>
                  <div className="hidden md:flex items-center gap-1">
                    <button className="w-10 h-10 rounded-xl hover:bg-neutral-100 flex items-center justify-center transition text-neutral-500"><Phone className="w-4 h-4" /></button>
                    <button className="w-10 h-10 rounded-xl hover:bg-neutral-100 flex items-center justify-center transition text-neutral-500"><Video className="w-4 h-4" /></button>
                    <button className="w-10 h-10 rounded-xl hover:bg-neutral-100 flex items-center justify-center transition text-neutral-500"><MoreVertical className="w-4 h-4" /></button>
                  </div>
                </header>
                <div className="flex-1 overflow-auto p-4 md:p-6 space-y-3 bg-gradient-to-b from-neutral-50/40 to-white">
                  {activeMessageThreadMessages.length === 0 && (
                    <div className="h-full flex flex-col items-center justify-center text-center text-neutral-400">
                      <MessageSquare className="w-14 h-14 mb-3 opacity-30" />
                      <p className="text-sm">这是您与对方的第一次对话</p>
                      <p className="text-xs">开始输入或通过下方附件发送订单截图</p>
                    </div>
                  )}
                  {activeMessageThreadMessages.map(m => {
                    const mine = m.senderRole === myRole;
                    return (
                      <div key={m.id} className={`flex items-end gap-2.5 ${mine ? 'justify-end' : 'justify-start'}`}>
                        {!mine && (
                          <div className={`w-8 h-8 shrink-0 rounded-full bg-gradient-to-br ${accentCls(m.senderRole as any)} text-white flex items-center justify-center shadow-sm`}>
                            {React.createElement(roleIc(m.senderRole as any), { className: 'w-3.5 h-3.5' })}
                          </div>
                        )}
                        <div className={`max-w-[78%] ${mine ? 'order-first' : ''}`}>
                          <div className={`px-4 py-2.5 rounded-2xl text-sm leading-6 whitespace-pre-wrap break-words shadow-sm ${mine ? 'bg-neutral-900 text-white rounded-br-md' : 'bg-white text-neutral-900 border border-neutral-200/80 rounded-bl-md'}`}>
                            {m.content}
                          </div>
                          <div className={`flex items-center gap-1.5 mt-1 text-[10px] text-neutral-400 ${mine ? 'justify-end' : 'justify-start'}`}>
                            <span>{new Date(m.createdAt).toLocaleTimeString().slice(0, 5)}</span>
                            {mine && (m.status === 'READ' ? <CheckCheck className="w-3 h-3 text-sky-500" /> : <Check className="w-3 h-3" />)}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={endRef} />
                </div>
                <footer className="p-4 border-t border-neutral-200/70 bg-white">
                  <div className="flex items-end gap-2">
                    <div className="flex gap-1 pb-1">
                      <button className="w-9 h-9 rounded-xl hover:bg-neutral-100 text-neutral-500 flex items-center justify-center transition" title="附件"><Paperclip className="w-4 h-4" /></button>
                      <button className="w-9 h-9 rounded-xl hover:bg-neutral-100 text-neutral-500 flex items-center justify-center transition" title="图片">🖼️</button>
                    </div>
                    <div className="flex-1 relative">
                      <textarea rows={1} value={draft} onChange={e => { setDraft(e.target.value); (e.target as any).style.height = 'auto'; (e.target as any).style.height = Math.min(160, (e.target as any).scrollHeight) + 'px'; }}
                        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(); } }}
                        placeholder="输入消息，Enter 发送，Shift+Enter 换行..."
                        className="w-full px-4 py-3 pr-14 rounded-2xl border border-neutral-200 bg-neutral-50/60 text-sm focus:border-neutral-900 focus:bg-white focus:outline-none resize-none" />
                      <button onClick={send} disabled={sending || !draft.trim()} className="absolute right-2 bottom-2 w-10 h-10 rounded-xl bg-neutral-900 text-white hover:bg-neutral-800 disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center justify-center">
                        {sending ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Send className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {['订单咨询', '发货进度', '售后退货', '退换货', '发票', '其他问题'].map(q => (
                      <button key={q} onClick={() => setDraft(q + '：')} className="text-[11px] px-2.5 py-1 rounded-full bg-neutral-100 text-neutral-600 hover:bg-neutral-200 transition">{q}</button>
                    ))}
                  </div>
                </footer>
              </>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-neutral-400 px-6">
                <MessageSquare className="w-20 h-20 mb-5 opacity-30" />
                <h3 className="font-black text-xl md:text-2xl text-neutral-600 mb-2">选择或发起会话</h3>
                <p className="text-sm max-w-md text-center leading-7">从左侧列表选择一个会话开始沟通，或点击右上角 + 按钮向商户、平台运营、买家或零售会员发起新对话。支持发送附件、订单截屏、实时在线咨询。</p>
                <button onClick={() => setShowNew(true)} className="mt-6 ui-primary-button flex items-center gap-2 px-6 py-3"><ChevronRight className="w-4 h-4" /> 发起第一条消息</button>
              </div>
            )}
          </section>
        </div>
      </div>

      {showNew && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowNew(false)}>
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-auto" onClick={e => e.stopPropagation()}>
            <div className="px-6 md:px-8 py-5 border-b border-neutral-200/70 sticky top-0 bg-white flex items-center justify-between">
              <h2 className="font-black text-xl flex items-center gap-2"><MessageSquare className="w-5 h-5 text-sky-600" /> 新建会话</h2>
              <button onClick={() => setShowNew(false)} className="w-10 h-10 rounded-xl hover:bg-neutral-100 flex items-center justify-center">×</button>
            </div>
            <div className="p-6 md:p-8 space-y-4">
              <label className="block"><span className="ui-section-title block mb-1.5">会话标题 *</span><input value={newForm.title} onChange={e => setNewForm(f => ({ ...f, title: e.target.value }))} placeholder="如：订单 #2401RD0032 发货咨询" className="w-full px-4 py-3 rounded-xl border border-neutral-200 bg-white text-sm focus:border-neutral-900 focus:outline-none" /></label>
              <label className="block"><span className="ui-section-title block mb-1.5">接收方身份</span>
                <select value={newForm.participantRole} onChange={e => setNewForm(f => ({ ...f, participantRole: e.target.value as any }))} className="w-full px-4 py-3 rounded-xl border border-neutral-200 bg-white text-sm focus:border-neutral-900 focus:outline-none">
                  <option value="merchant">商户 / 品牌方</option>
                  <option value="buyer">B2B 买家 / 买手</option>
                  <option value="consumer">零售消费者</option>
                  <option value="admin">平台运营 / 客服</option>
                </select>
              </label>
              <label className="block"><span className="ui-section-title block mb-1.5">接收方 ID *</span><input value={newForm.participantId} onChange={e => setNewForm(f => ({ ...f, participantId: e.target.value }))} placeholder="粘贴 user/merchant/buyer/consumer ID" className="w-full px-4 py-3 rounded-xl border border-neutral-200 bg-white text-sm font-mono focus:border-neutral-900 focus:outline-none" /></label>
              <label className="block"><span className="ui-section-title block mb-1.5">第一条消息</span><textarea rows={4} value={newForm.initial} onChange={e => setNewForm(f => ({ ...f, initial: e.target.value }))} placeholder="您好，关于我的订单想咨询一下..." className="w-full px-4 py-3 rounded-xl border border-neutral-200 bg-white text-sm focus:border-neutral-900 focus:outline-none resize-none" /></label>
            </div>
            <div className="px-6 md:px-8 py-5 border-t border-neutral-200/70 flex justify-end gap-3">
              <button onClick={() => setShowNew(false)} className="ui-secondary-button px-6 py-3 text-sm">取消</button>
              <button onClick={create} disabled={!newForm.title || !newForm.participantId} className="ui-primary-button px-6 py-3 text-sm flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed">
                <Send className="w-4 h-4" /> 发起会话
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
