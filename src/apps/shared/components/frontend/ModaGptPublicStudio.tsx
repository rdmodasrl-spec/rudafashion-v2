import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowUp, ArrowUpRight, BookOpen, Bot, CreditCard, ImagePlus, Lightbulb, LoaderCircle, LogOut, LockKeyhole, MessageSquarePlus, Mic, MicOff, MoreVertical, PencilLine, Plus, Search, Settings2, Shirt, Sparkles, Trash2, UserRound, X } from 'lucide-react';
import { apiPost } from '../../../../api/client';
import { useB2B } from '../../../../context/B2BContext';
import { PORTAL_DOMAINS } from '../../../../shared/portalDomains';

type StudioMessage = { role: 'user' | 'assistant'; text: string };
type StudioConversation = { id: string; title: string; updatedAt: number; messages: StudioMessage[] };
type ModaGptEntryTool = 'chat' | 'design' | 'generate' | 'tryon' | 'inspiration' | 'create' | 'designs' | 'knowledge' | 'settings' | 'pricing';
type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>>; resultIndex: number }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};
type WindowWithSpeechRecognition = Window & {
  SpeechRecognition?: new () => SpeechRecognitionLike;
  webkitSpeechRecognition?: new () => SpeechRecognitionLike;
};

export const ModaGptPublicStudio: React.FC = () => {
  const { authRole, lang, localizeCopy, logout, setCurrentView } = useB2B();
  const [messages, setMessages] = useState<StudioMessage[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [toolsMenuOpen, setToolsMenuOpen] = useState(false);
  const [historySearch, setHistorySearch] = useState('');
  const [loginPromptOpen, setLoginPromptOpen] = useState(false);
  const [requestedTool, setRequestedTool] = useState<ModaGptEntryTool>('create');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const toolsMenuRef = useRef<HTMLDivElement>(null);
  const promptTypingTimerRef = useRef<number | null>(null);
  const speechRecognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const [conversations, setConversations] = useState<StudioConversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const isEnterpriseMerchant = authRole === 'merchant';

  useEffect(() => {
    const host = window.location.hostname.toLowerCase();
    if (isEnterpriseMerchant && (host === PORTAL_DOMAINS.public || host === PORTAL_DOMAINS.www)) {
      window.location.replace(`https://${PORTAL_DOMAINS.merchant}/?workspace=modagpt`);
    }
  }, [isEnterpriseMerchant]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, busy]);

  useEffect(() => {
    const inputElement = inputRef.current;
    if (!inputElement) return;
    inputElement.style.height = 'auto';
    inputElement.style.height = `${Math.min(inputElement.scrollHeight, 144)}px`;
  }, [input]);

  useEffect(() => () => {
    speechRecognitionRef.current?.stop();
    if (promptTypingTimerRef.current !== null) window.clearInterval(promptTypingTimerRef.current);
  }, []);

  useEffect(() => {
    if (!toolsMenuOpen) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && !toolsMenuRef.current?.contains(event.target)) {
        setToolsMenuOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setToolsMenuOpen(false);
    };
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [toolsMenuOpen]);

  const openEnterpriseStudio = (tool: ModaGptEntryTool = 'chat') => {
    const query = new URLSearchParams({ workspace: 'modagpt' });
    if (tool !== 'chat') query.set('modagptTool', tool);
    window.location.assign(`https://${PORTAL_DOMAINS.merchant}/?${query.toString()}`);
  };
  const openEnterpriseLogin = (tool: ModaGptEntryTool = 'chat') => {
    openEnterpriseStudio(tool);
  };
  const openEnterpriseFeature = (tool: ModaGptEntryTool) => {
    setToolsMenuOpen(false);
    if (isEnterpriseMerchant) openEnterpriseStudio(tool);
    else {
      setRequestedTool(tool);
      setLoginPromptOpen(true);
    }
  };
  const startNewConversation = () => {
    if (busy) return;
    if (promptTypingTimerRef.current !== null) {
      window.clearInterval(promptTypingTimerRef.current);
      promptTypingTimerRef.current = null;
    }
    setActiveConversationId(null);
    setMessages([]);
    setInput('');
    setError('');
    setHistoryOpen(false);
  };
  const typeDesignerPrompt = () => {
    const prompt = localizeCopy('我是一个设计师', 'Sono uno stilista');
    if (promptTypingTimerRef.current !== null) window.clearInterval(promptTypingTimerRef.current);
    const characters = Array.from(prompt);
    setInput('');
    inputRef.current?.focus();
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setInput(prompt);
      return;
    }
    let index = 0;
    promptTypingTimerRef.current = window.setInterval(() => {
      index += 1;
      setInput(characters.slice(0, index).join(''));
      if (index >= characters.length && promptTypingTimerRef.current !== null) {
        window.clearInterval(promptTypingTimerRef.current);
        promptTypingTimerRef.current = null;
      }
    }, 48);
  };
  const stopPromptTyping = () => {
    if (promptTypingTimerRef.current === null) return;
    window.clearInterval(promptTypingTimerRef.current);
    promptTypingTimerRef.current = null;
  };
  const selectConversation = (conversation: StudioConversation) => {
    if (busy) return;
    setActiveConversationId(conversation.id);
    setMessages(conversation.messages);
    setInput('');
    setError('');
    setHistoryOpen(false);
  };
  const deleteConversation = (id: string) => {
    if (busy) return;
    setConversations(previous => previous.filter(conversation => conversation.id !== id));
    if (activeConversationId === id) startNewConversation();
  };
  const clearConversationHistory = () => {
    if (busy) return;
    setConversations([]);
    setActiveConversationId(null);
    setMessages([]);
    setHistorySearch('');
    setHistoryOpen(false);
  };
  const updateConversation = (id: string, nextMessages: StudioMessage[]) => {
    setConversations(previous => {
      const existing = previous.find(conversation => conversation.id === id);
      const firstUserMessage = nextMessages.find(message => message.role === 'user')?.text || '';
      const updated: StudioConversation = {
        id,
        title: firstUserMessage.slice(0, 48) || localizeCopy('新对话', 'Nuova chat'),
        updatedAt: Date.now(),
        messages: nextMessages
      };
      return [updated, ...previous.filter(conversation => conversation.id !== id || !existing)]
        .sort((left, right) => right.updatedAt - left.updatedAt)
        .slice(0, 30);
    });
  };

  const toggleVoiceInput = () => {
    if (isListening) {
      speechRecognitionRef.current?.stop();
      return;
    }

    const SpeechRecognition = (window as WindowWithSpeechRecognition).SpeechRecognition
      ?? (window as WindowWithSpeechRecognition).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setError(localizeCopy(
        '当前浏览器不支持语音输入，请直接键盘输入。',
        'Il browser non supporta la dettatura. Usa la tastiera.'
      ));
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = lang === 'it' ? 'it-IT' : 'zh-CN';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onresult = event => {
      const transcript = event.results[event.resultIndex]?.[0]?.transcript?.trim();
      if (transcript) setInput(previous => [previous.trim(), transcript].filter(Boolean).join(' '));
    };
    recognition.onerror = () => {
      setIsListening(false);
      setError(localizeCopy('语音输入失败，请检查麦克风权限后重试。', 'Dettatura non riuscita. Controlla i permessi del microfono e riprova.'));
    };
    recognition.onend = () => setIsListening(false);
    speechRecognitionRef.current = recognition;
    setError('');
    try {
      recognition.start();
      setIsListening(true);
    } catch {
      setIsListening(false);
      setError(localizeCopy('无法启动语音输入，请检查麦克风权限后重试。', 'Impossibile avviare la dettatura. Controlla i permessi del microfono e riprova.'));
    }
  };

  const sendMessage = async (prompt = input) => {
    const text = prompt.trim();
    if (!text || busy) return;
    setInput('');
    setError('');
    const conversationId = activeConversationId || crypto.randomUUID();
    const userMessage = { role: 'user' as const, text };
    const updatedMessages = [...messages, userMessage];
    setActiveConversationId(conversationId);
    setMessages(updatedMessages);
    updateConversation(conversationId, updatedMessages);
    setBusy(true);
    try {
      const result = await apiPost<{ reply: string }>('/api/modagpt/public/chat', {
        message: text,
        language: lang,
        history: messages.slice(-6)
      });
      const nextMessages = [...updatedMessages, { role: 'assistant' as const, text: result.reply }];
      setMessages(nextMessages);
      updateConversation(conversationId, nextMessages);
    } catch (requestError) {
      setError(requestError instanceof Error && requestError.message === 'MODAGPT_SENSITIVE_PROMPT_BLOCKED'
        ? localizeCopy(
          '请勿发送个人联系方式、证件、银行卡或密码等敏感信息。',
          'Non inviare dati personali, documenti, coordinate bancarie o password.'
        )
        : localizeCopy(
          '这次没有连接成功，请稍后重试；你的问题没有丢失，可以再次发送。',
          'Connessione non riuscita. Riprova tra poco: puoi inviare di nuovo la domanda.'
        ));
    } finally {
      setBusy(false);
    }
  };

  const isEmpty = messages.length === 0;
  const filteredConversations = conversations.filter(conversation =>
    conversation.title.toLocaleLowerCase().includes(historySearch.trim().toLocaleLowerCase())
  );
  const toolMenuItems: Array<{ id: ModaGptEntryTool; label: string; Icon: typeof Shirt; group: 'creative' | 'workspace' }> = [
    { id: 'design', label: localizeCopy('服装设计与推理', 'Design moda e ragionamento'), Icon: Shirt, group: 'creative' },
    { id: 'generate', label: localizeCopy('生成时尚图片', 'Genera immagini moda'), Icon: ImagePlus, group: 'creative' },
    { id: 'tryon', label: localizeCopy('AI 虚拟试穿', 'Prova virtuale AI'), Icon: UserRound, group: 'creative' },
    { id: 'inspiration', label: localizeCopy('趋势与设计灵感', 'Tendenze e ispirazione'), Icon: Lightbulb, group: 'creative' },
    { id: 'create', label: localizeCopy('创作中心', 'Studio creativo'), Icon: Sparkles, group: 'workspace' },
    { id: 'designs', label: localizeCopy('我的作品', 'I miei progetti'), Icon: ImagePlus, group: 'workspace' },
    { id: 'knowledge', label: localizeCopy('店铺知识库', 'Conoscenza del negozio'), Icon: BookOpen, group: 'workspace' },
    { id: 'pricing', label: localizeCopy('套餐与额度', 'Piani e crediti'), Icon: CreditCard, group: 'workspace' },
    { id: 'settings', label: localizeCopy('隐私与设置', 'Privacy e impostazioni'), Icon: Settings2, group: 'workspace' }
  ];

  return (
    <div className="flex min-h-dvh flex-col bg-[#f8f8f8] text-neutral-950">
      <header className="z-10 px-4 pb-3 pt-[max(env(safe-area-inset-top),1rem)] sm:px-6">
        <div className="mx-auto grid h-12 max-w-3xl grid-cols-3 items-center">
          <button
            type="button"
            onClick={() => { setToolsMenuOpen(false); setCurrentView('home'); }}
            aria-label={localizeCopy('返回首页', 'Torna alla home')}
            className="modagpt-rounded-control flex h-[52px] w-[52px] items-center justify-center rounded-full bg-white text-neutral-950 transition hover:bg-neutral-100 disabled:opacity-40"
          >
            <ArrowLeft className="h-6 w-6" strokeWidth={2.2} />
          </button>
          <div className="justify-self-center">
            <span className="inline-flex min-h-[52px] items-center gap-2 rounded-full bg-sky-50 px-6 py-3 text-lg font-medium text-sky-700">
              <Sparkles className="h-5 w-5 fill-current" />
              ModaUI
            </span>
          </div>
          <div ref={toolsMenuRef} className="relative justify-self-end">
            <button
              type="button"
              onClick={() => setToolsMenuOpen(open => !open)}
              aria-label={localizeCopy('菜单、聊天记录与工具', 'Menu, cronologia chat e strumenti')}
              aria-expanded={toolsMenuOpen}
              title={localizeCopy('菜单、聊天记录与工具', 'Menu, cronologia chat e strumenti')}
              className="modagpt-rounded-control flex h-[52px] w-[52px] items-center justify-center rounded-full bg-white text-neutral-950 transition hover:bg-neutral-100"
            >
              <MoreVertical className="h-5 w-5" />
            </button>
            {toolsMenuOpen && (
              <div role="menu" aria-label={localizeCopy('ModaUI 菜单、聊天记录与工具', 'Menu, cronologia chat e strumenti ModaUI')} className="absolute right-0 top-14 z-40 max-h-[min(76dvh,620px)] w-[min(88vw,340px)] overflow-y-auto rounded-[1.5rem] border border-neutral-200 bg-white p-2 shadow-2xl">
                <button type="button" role="menuitem" disabled={busy} onClick={() => { setToolsMenuOpen(false); startNewConversation(); }} className="flex min-h-11 w-full items-center gap-3 rounded-full px-3 text-left text-sm text-neutral-700 transition hover:bg-neutral-50 disabled:opacity-40">
                  <MessageSquarePlus className="h-4 w-4" />
                  {localizeCopy('新对话', 'Nuova chat')}
                </button>
                <button type="button" role="menuitem" onClick={() => { setToolsMenuOpen(false); setHistoryOpen(true); }} className="flex min-h-11 w-full items-center gap-3 rounded-full px-3 text-left text-sm text-neutral-700 transition hover:bg-neutral-50">
                  <Search className="h-4 w-4" />
                  {localizeCopy('聊天记录', 'Cronologia chat')}
                </button>
                <div className="my-2 border-t border-neutral-100" />
                <p className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-neutral-400">{localizeCopy('设计与创作', 'Design e creatività')}</p>
                {toolMenuItems.filter(item => item.group === 'creative').map(({ id, label, Icon }) => (
                  <button key={id} type="button" role="menuitem" onClick={() => openEnterpriseFeature(id)} className="flex min-h-11 w-full items-center gap-3 rounded-full px-3 text-left text-sm text-neutral-700 transition hover:bg-neutral-50">
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="flex-1">{label}</span>
                    {!isEnterpriseMerchant && <LockKeyhole className="h-3.5 w-3.5 text-neutral-400" />}
                  </button>
                ))}
                <div className="my-2 border-t border-neutral-100" />
                <p className="px-3 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-wider text-neutral-400">{localizeCopy('工作区与设置', 'Workspace e impostazioni')}</p>
                {toolMenuItems.filter(item => item.group === 'workspace').map(({ id, label, Icon }) => (
                  <button key={id} type="button" role="menuitem" onClick={() => openEnterpriseFeature(id)} className="flex min-h-11 w-full items-center gap-3 rounded-full px-3 text-left text-sm text-neutral-700 transition hover:bg-neutral-50">
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="flex-1">{label}</span>
                    {!isEnterpriseMerchant && <LockKeyhole className="h-3.5 w-3.5 text-neutral-400" />}
                  </button>
                ))}
                <div className="my-2 border-t border-neutral-100" />
                {isEnterpriseMerchant ? (
                  <>
                    <button type="button" role="menuitem" onClick={() => openEnterpriseStudio('chat')} className="flex min-h-11 w-full items-center gap-3 rounded-full px-3 text-left text-sm text-neutral-700 transition hover:bg-neutral-50">
                      <ArrowUpRight className="h-4 w-4" />
                      {localizeCopy('完整企业工作台', 'Workspace aziendale')}
                    </button>
                    <button type="button" role="menuitem" onClick={logout} className="flex min-h-11 w-full items-center gap-3 rounded-full px-3 text-left text-sm text-neutral-700 transition hover:bg-neutral-50">
                      <LogOut className="h-4 w-4" />
                      {localizeCopy('退出登录', 'Esci')}
                    </button>
                  </>
                ) : (
                  <button type="button" role="menuitem" onClick={() => openEnterpriseFeature('chat')} className="flex min-h-11 w-full items-center gap-3 rounded-full px-3 text-left text-sm text-neutral-700 transition hover:bg-neutral-50">
                    <UserRound className="h-4 w-4" />
                    {localizeCopy('企业账号登录', 'Accesso account aziendale')}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      {historyOpen && (
        <div className="fixed inset-0 z-50 bg-neutral-950/30" onClick={() => setHistoryOpen(false)}>
          <aside
            role="dialog"
            aria-modal="true"
            aria-label={localizeCopy('菜单和聊天记录', 'Menu e cronologia chat')}
            onClick={event => event.stopPropagation()}
            className="flex h-full w-[min(86vw,350px)] flex-col rounded-r-[2rem] bg-[#f8f8f8] p-4 shadow-2xl"
          >
            <div className="mb-4 flex items-center justify-between">
              <span className="text-base font-semibold">ModaUI</span>
              <button
                type="button"
                onClick={() => setHistoryOpen(false)}
                aria-label={localizeCopy('关闭菜单', 'Chiudi menu')}
                className="modagpt-rounded-control flex h-10 w-10 items-center justify-center rounded-full bg-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <button
              type="button"
              onClick={startNewConversation}
              disabled={busy}
              className="modagpt-rounded-control flex min-h-12 items-center gap-3 rounded-full border border-neutral-200 bg-white px-4 text-left text-sm font-medium"
            >
              <MessageSquarePlus className="h-4 w-4" />
              {localizeCopy('新对话', 'Nuova chat')}
            </button>
            <label className="relative mt-4 block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
              <input
                type="search"
                value={historySearch}
                onChange={event => setHistorySearch(event.target.value)}
                placeholder={localizeCopy('搜索本次聊天', 'Cerca in questa sessione')}
                className="modagpt-rounded-input h-11 w-full rounded-full border border-neutral-200 bg-white pl-10 pr-4 text-sm outline-none focus:border-neutral-400"
              />
            </label>
            <p className="px-2 pb-2 pt-5 text-xs font-medium text-neutral-500">{localizeCopy('本次聊天', 'Questa sessione')}</p>
            <div className="min-h-0 flex-1 space-y-1 overflow-y-auto">
              {filteredConversations.map(conversation => (
                <div key={conversation.id} className={`flex items-center gap-1 rounded-2xl ${conversation.id === activeConversationId ? 'bg-white' : 'hover:bg-white/70'}`}>
                  <button
                    type="button"
                    onClick={() => selectConversation(conversation)}
                    className="min-w-0 flex-1 truncate rounded-full px-3 py-3 text-left text-sm text-neutral-700"
                  >
                    {conversation.title}
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteConversation(conversation.id)}
                    disabled={busy}
                    aria-label={localizeCopy(`删除聊天：${conversation.title}`, `Elimina chat: ${conversation.title}`)}
                    className="modagpt-rounded-control mr-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-neutral-500 hover:bg-neutral-100 hover:text-rose-600 disabled:opacity-40"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
              {!filteredConversations.length && (
                <p className="px-3 py-4 text-sm text-neutral-400">
                  {historySearch ? localizeCopy('没有找到匹配的聊天。', 'Nessuna chat trovata.') : localizeCopy('还没有聊天记录。', 'Nessuna cronologia chat.')}
                </p>
              )}
            </div>
            {conversations.length > 0 && (
              <button
                type="button"
                onClick={clearConversationHistory}
                disabled={busy}
                className="modagpt-rounded-control mt-2 flex min-h-10 items-center gap-2 rounded-full px-3 text-xs text-neutral-500 hover:bg-white hover:text-rose-600 disabled:opacity-40"
              >
                <Trash2 className="h-3.5 w-3.5" />
                {localizeCopy('清空本次聊天', 'Cancella cronologia sessione')}
              </button>
            )}
          </aside>
        </div>
      )}

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 sm:px-6">
        {isEmpty ? (
          <section aria-label="ModaUI" className="flex flex-1 flex-col justify-end gap-5 pb-5">
            <button
              type="button"
              onClick={() => openEnterpriseFeature('tryon')}
              className="flex min-h-12 items-center gap-4 px-3 text-left text-[15px] text-neutral-600 transition hover:text-neutral-950"
            >
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white">
                <Shirt className="h-6 w-6" strokeWidth={1.8} />
              </span>
              {localizeCopy('AI 换衣', 'AI Try-On')}
            </button>
            <button
              type="button"
              onClick={typeDesignerPrompt}
              className="flex min-h-12 items-center gap-4 px-3 text-left text-[15px] text-neutral-600 transition hover:text-neutral-950"
            >
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white">
                <PencilLine className="h-6 w-6" strokeWidth={1.8} />
              </span>
              {localizeCopy('我是一个设计师', 'Sono uno stilista')}
            </button>
          </section>
        ) : (
          <section className="flex-1 space-y-6 overflow-y-auto py-6" aria-live="polite">
            {messages.map((message, index) => (
              <div key={`${message.role}-${index}`} className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {message.role === 'assistant' && (
                  <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-neutral-950 text-white">
                    <Bot className="h-3.5 w-3.5" />
                  </span>
                )}
                <div className={`max-w-[88%] whitespace-pre-wrap text-sm leading-6 ${message.role === 'user' ? 'rounded-2xl bg-neutral-950 px-4 py-3 text-white' : 'py-1 text-neutral-800'}`}>
                  {message.text}
                </div>
                {message.role === 'user' && (
                  <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-neutral-200 bg-white text-neutral-500">
                    <UserRound className="h-3.5 w-3.5" />
                  </span>
                )}
              </div>
            ))}
            {busy && (
              <p role="status" className="flex items-center gap-2 pl-10 text-xs text-neutral-500">
                <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                {localizeCopy('ModaUI 正在思考…', 'ModaUI sta elaborando…')}
              </p>
            )}
            <div ref={messagesEndRef} />
          </section>
        )}

        {error && <p role="alert" className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">{error}</p>}
        <div className="sticky bottom-0 mt-auto bg-[#f8f8f8] pb-[max(env(safe-area-inset-bottom),1rem)] pt-3">
          <form
            onSubmit={event => { event.preventDefault(); void sendMessage(); }}
            className="rounded-[2rem] border border-neutral-100 bg-white p-2.5 shadow-[0_4px_24px_rgba(15,23,42,0.09)] transition focus-within:border-neutral-200 focus-within:shadow-[0_8px_30px_rgba(15,23,42,0.12)] sm:p-3"
          >
            <div className="flex items-end gap-2">
              <button
                type="button"
                onClick={() => openEnterpriseFeature('create')}
                aria-label={localizeCopy('打开创作工具', 'Apri strumenti creativi')}
                title={localizeCopy('企业创作工具', 'Strumenti creativi aziendali')}
                className="modagpt-rounded-control mb-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-neutral-900 transition hover:bg-neutral-100"
              >
                <Plus className="h-6 w-6" strokeWidth={2.4} />
              </button>
              <textarea
                ref={inputRef}
                value={input}
                onChange={event => { stopPromptTyping(); setInput(event.target.value); }}
                onKeyDown={event => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    void sendMessage();
                  }
                }}
                maxLength={2000}
                rows={1}
                aria-label={localizeCopy('发送消息给 ModaUI', 'Messaggio per ModaUI')}
                placeholder={localizeCopy('给 ModaUI 发消息', 'Scrivi a ModaUI')}
                disabled={busy}
                className="block max-h-36 min-h-10 min-w-0 flex-1 resize-none overflow-y-auto bg-transparent px-2 py-2 text-[15px] leading-6 outline-none placeholder:text-neutral-400 disabled:cursor-not-allowed sm:px-2.5"
              />
              <button
                type="button"
                onClick={toggleVoiceInput}
                aria-label={isListening ? localizeCopy('停止语音输入', 'Ferma dettatura') : localizeCopy('语音输入', 'Dettatura')}
                title={isListening ? localizeCopy('停止语音输入', 'Ferma dettatura') : localizeCopy('语音输入', 'Dettatura')}
                className={`modagpt-rounded-control mb-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition ${
                  isListening ? 'bg-rose-50 text-rose-600' : 'text-neutral-900 hover:bg-neutral-100'
                }`}
              >
                {isListening ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
              </button>
              <button
                type="submit"
                disabled={busy || !input.trim()}
                aria-label={localizeCopy('发送', 'Invia')}
                className={`modagpt-rounded-control mb-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition active:scale-95 disabled:cursor-not-allowed ${
                  input.trim() || busy
                    ? 'bg-sky-600 text-white hover:bg-sky-700'
                    : 'bg-neutral-200 text-neutral-500'
                }`}
              >
                {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-5 w-5" />}
              </button>
            </div>
          </form>
          {!isEmpty && !busy && (
            <button
              type="button"
              onClick={startNewConversation}
              className="modagpt-rounded-control mx-auto mt-2 flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-800"
            >
              <MessageSquarePlus className="h-3.5 w-3.5" />
              {localizeCopy('新对话', 'Nuova chat')}
            </button>
          )}
        </div>
      </main>

      {loginPromptOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-neutral-950/35 p-5" onClick={() => setLoginPromptOpen(false)}>
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="modagpt-enterprise-prompt-title"
            onClick={event => event.stopPropagation()}
            className="w-full max-w-sm rounded-[2rem] bg-white p-6 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 id="modagpt-enterprise-prompt-title" className="text-base font-semibold text-neutral-950">
                  {localizeCopy('企业账号专属功能', 'Funzioni per account aziendali')}
                </h2>
                <p className="mt-2 text-sm leading-6 text-neutral-600">
                  {localizeCopy('访客可以免费聊天和推理。图片创作、文件工具与虚拟试穿需使用企业账号登录。', 'La chat e il ragionamento sono disponibili agli ospiti. Per immagini, file e prova virtuale accedi con un account aziendale.')}
                </p>
              </div>
              <button type="button" onClick={() => setLoginPromptOpen(false)} aria-label={localizeCopy('关闭', 'Chiudi')} className="modagpt-rounded-control flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-neutral-100">
                <X className="h-4 w-4" />
              </button>
            </div>
            <button type="button" onClick={() => openEnterpriseLogin(requestedTool)} className="modagpt-rounded-control mt-5 flex min-h-11 w-full items-center justify-center rounded-full bg-neutral-950 px-4 text-sm font-semibold text-white">
              {localizeCopy('企业账号登录', 'Accedi con account aziendale')}
            </button>
          </section>
        </div>
      )}
    </div>
  );
};
