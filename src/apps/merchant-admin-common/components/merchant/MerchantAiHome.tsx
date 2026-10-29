import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, ArrowUp, BookOpen, Check, CreditCard, Download, Heart, History, ImagePlus, Lightbulb, LogOut, MessageSquarePlus, Mic, MoreVertical, Paperclip, Plus, RefreshCw, Search, Shirt, SlidersHorizontal, Sparkles, Trash2, UserRound, X } from 'lucide-react';
import { apiDelete, apiGet, apiPatch, apiPost } from '../../../../api/client';
import { ModaGptPricingSheet } from './ModaGptPricingSheet';
import { ModaGptGarmentRecolor } from './ModaGptGarmentRecolor';
import { MerchantBrainKnowledge } from './MerchantBrainKnowledge';
import { useB2B } from '../../../../context/B2BContext';
import { getIntlLocale } from '../../../../i18n/translations';
import type { MerchantCopilotPageContext } from '../../../../shared/merchantCopilotContext';
import { buildFashionDesignConceptPrompt, buildModelStudioPrompt } from '../../../../shared/modagptImageContract';
import { ModaCoreAnchor, ModaCoreStageProvider } from './modaui/ModaCoreStage';
import type { ModaCoreVisualState } from './modaui/modaCoreEngine';
import { createModaCoreLife } from './modaui/modaCoreLife';
import { useMicLevel, useSpeechReply } from './modaui/useModaCoreAudio';
import { AssistantReplyActions } from './AssistantReplyActions';
import { assistantReplyFrameInterval, buildAssistantReplyFrames } from '../../../../shared/assistantReplyReveal';



type AssistantMessage = {
  role: 'user' | 'assistant';
  content: string;
  id?: string;
  imageDataUrl?: string;
  attachments?: ChatAttachment[];
  actions?: AssistantAction[];
  designCategory?: 'imageGeneration' | 'tryOn';
  designId?: string;
};

type AssistantAction = {
  label: string;
  target: 'products' | 'sku_matrix' | 'inventory' | 'materials' | 'production' | 'orders' | 'vault_requests' | 'customers' | 'growth' | 'content' | 'finance' | 'profile' | 'settings' | 'gallery' | 'support' | 'procurement';
};

type AssistantMobileTab = 'products' | 'inventory' | 'orders' | 'customers' | 'profile' | 'finance' | 'growth' | 'production' | 'procurement' | 'content';

type ChatAttachment = {
  name: string;
  dataUrl: string;
  kind: 'image' | 'document';
  size: number;
};

type SpeechRecognitionResultEvent = {
  resultIndex: number;
  results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }>;
};

type SpeechRecognitionErrorEvent = { error: string };

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechRecognitionResultEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

type ModaGptDesign = {
  id: string;
  title: string;
  prompt: string;
  category: 'design' | 'imageGeneration' | 'tryOn';
  imageMime: string;
  imageWidth: number;
  imageHeight: number;
  isFavorite: boolean;
  createdAt: string;
  imageUrl: string;
};

type AssistantConversation = {
  id: string;
  title: string;
  updatedAt: string;
  messageCount: number;
};

type FashionMode = 'design' | 'generate' | 'tryon' | 'edit' | 'fashionVideo' | 'inspiration' | 'productLaunch';
type ModaGptSection = 'chat' | 'create' | 'designs' | 'knowledge' | 'recolor';
type ModaGptEntitlements = {
  plan: 'free' | 'plus' | 'pro' | 'business' | 'fashion_pro';
  expiresAt: string | null;
  period: string;
  quotas: { chat: number; imageGeneration: number; tryOn: number };
  usage: { chat: number; imageGeneration: number; tryOn: number };
  remaining: { chat: number; imageGeneration: number; tryOn: number };
  capabilities: { fashionDesign: boolean; imageGeneration: boolean; tryOn: boolean };
  providers: { reasoning: 'deepseek' | 'local'; image: 'fal' | 'local' | 'unavailable' };
  billing: {
    active: boolean;
    planId: 'FREE' | 'PLUS' | 'PRO' | 'BUSINESS' | 'FASHION_PRO' | null;
    monthlyCredits: number | null;
    creditBalance: number;
  };
};

type MerchantAiHomeProps = {
  isIt: boolean;
  merchantId: string;
  merchantName: string;
  copilotContext: {
    context: string;
    scope: string;
    pageContext: MerchantCopilotPageContext;
  };
  initialMode?: FashionMode;
  onExit: () => void;
  onNavigate: (tab: AssistantMobileTab) => void;
  bottomNavigation?: {
    open: boolean;
    onToggle: () => void;
  };
  onComposerFocus?: () => void;
};

function fashionModeAvailable(mode: FashionMode, entitlements: ModaGptEntitlements | null): boolean {
  if (!entitlements) return false;
  if (mode === 'generate') return entitlements.capabilities.imageGeneration;
  if (mode === 'tryon') return entitlements.capabilities.tryOn;
  if (mode === 'productLaunch') {
    return ['pro', 'business', 'fashion_pro'].includes(entitlements.plan) && entitlements.capabilities.imageGeneration;
  }
  return true;
}

const productLaunchShotDirections = [
  'full-body front view, clear garment silhouette',
  'three-quarter pose, commercial fashion photography',
  'full-body side pose showing garment fit',
  'editorial pose with clear garment details'
] as const;
const assistantActionTargets: Partial<Record<AssistantAction['target'], AssistantMobileTab>> = {
  products: 'products',
  sku_matrix: 'products',
  inventory: 'inventory',
  orders: 'orders',
  vault_requests: 'customers',
  customers: 'customers',
  profile: 'profile',
  settings: 'profile',
  finance: 'finance',
  growth: 'growth',
  production: 'production',
  materials: 'production',
  content: 'content',
  procurement: 'procurement'
};

function renderMessageContent(content: string, messageIndex: number) {
  const formatInline = (line: string) => line.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((part, partIndex) => {
    if (part.startsWith('**') && part.endsWith('**')) return <strong key={partIndex}>{part.slice(2, -2)}</strong>;
    if (part.startsWith('`') && part.endsWith('`')) return <code key={partIndex} className="rounded bg-neutral-100 px-1 py-0.5 text-[0.92em]">{part.slice(1, -1)}</code>;
    return part;
  });
  const segments = content.split(/```([^\n]*)\n([\s\S]*?)```/g);
  return segments.map((segment, index) => {
    if (index % 3 === 1) {
      const code = segments[index + 1] || '';
      return <pre key={`code-${index}`} className="my-3 overflow-x-auto rounded-xl bg-neutral-950 p-3 text-[11px] leading-5 text-neutral-100"><code>{code}</code></pre>;
    }
    if (index % 3 === 2) return null;
    return segment.split('\n').map((line, lineIndex) => {
      const key = `${messageIndex}-${index}-${lineIndex}`;
      if (!line.trim()) return <div key={key} className="h-2" />;
      if (/^#{1,3}\s/.test(line)) return <h3 key={key} className="mb-1 mt-3 font-semibold">{formatInline(line.replace(/^#{1,3}\s/, ''))}</h3>;
      if (/^[-*]\s/.test(line)) return <p key={key} className="pl-3 before:mr-2 before:content-['•']">{formatInline(line.replace(/^[-*]\s/, ''))}</p>;
      return <p key={key}>{formatInline(line)}</p>;
    });
  });
}

function readImageFile(file: File): Promise<string> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 3 * 1024 * 1024) {
    return Promise.reject(new Error('只支持不超过 3MB 的 JPG、PNG 或 WebP 图片。'));
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('无法读取图片文件。'));
    reader.onerror = () => reject(reader.error || new Error('读取图片失败。'));
    reader.readAsDataURL(file);
  });
}

function readAttachmentFile(file: File): Promise<string> {
  const extension = file.name.toLowerCase().match(/\.[a-z0-9]+$/)?.[0] || '';
  const isImage = ['image/jpeg', 'image/png', 'image/webp'].includes(file.type);
  const isPdf = extension === '.pdf' && file.type === 'application/pdf';
  const isText = ['.txt', '.md', '.csv'].includes(extension)
    && ['text/plain', 'text/markdown', 'text/csv', 'application/vnd.ms-excel'].includes(file.type);
  if ((!isImage && !isPdf && !isText) || file.size > 3 * 1024 * 1024 || file.size === 0) {
    return Promise.reject(new Error('MODAGPT_ATTACHMENT_INVALID'));
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('无法读取附件。'));
    reader.onerror = () => reject(reader.error || new Error('读取附件失败。'));
    reader.readAsDataURL(file);
  });
}

export const MerchantAiHome: React.FC<MerchantAiHomeProps> = ({ isIt, merchantId, merchantName, copilotContext, initialMode, onExit, onNavigate, bottomNavigation, onComposerFocus }) => {
  const { localizeCopy, lang, logout } = useB2B();
  const sharedChatContext = { context: copilotContext.context, scope: copilotContext.scope };
  const [question, setQuestion] = useState('');
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
  const [recordingVoice, setRecordingVoice] = useState(false);
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [conversations, setConversations] = useState<AssistantConversation[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<ModaGptSection>('chat');
  const [selectedCreation, setSelectedCreation] = useState<FashionMode | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historySearch, setHistorySearch] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [pricingOpen, setPricingOpen] = useState(false);
  const [composerToolsOpen, setComposerToolsOpen] = useState(false);
  const [modeSheetOpen, setModeSheetOpen] = useState(false);
  const [fashionMode, setFashionMode] = useState<FashionMode | null>(null);
  const [fashionDesignNotes, setFashionDesignNotes] = useState('');
  const [designCandidateCount, setDesignCandidateCount] = useState(3);
  const [designGenerationProgress, setDesignGenerationProgress] = useState<{ completed: number; total: number } | null>(null);
  const [productLaunchImageCount, setProductLaunchImageCount] = useState(4);
  const [productLaunchProgress, setProductLaunchProgress] = useState<{
    stage: 'copy' | 'images' | 'complete' | 'partial';
    completedImages: number;
    totalImages: number;
  } | null>(null);
  const [productLaunchRecovery, setProductLaunchRecovery] = useState<{
    prompt: string;
    nextImageIndex: number;
    totalImages: number;
  } | null>(null);
  const [entitlements, setEntitlements] = useState<ModaGptEntitlements | null>(null);
  const [designs, setDesigns] = useState<ModaGptDesign[]>([]);
  const [designFilter, setDesignFilter] = useState<'all' | 'design' | 'imageGeneration' | 'tryOn' | 'favorite'>('all');
  const [selectedDesignId, setSelectedDesignId] = useState<string | null>(null);
  const [designsLoading, setDesignsLoading] = useState(false);
  const [designsRefresh, setDesignsRefresh] = useState(0);
  const [savingDesignMessage, setSavingDesignMessage] = useState<AssistantMessage | null>(null);
  const [designActionId, setDesignActionId] = useState<string | null>(null);
  const [designNotice, setDesignNotice] = useState('');
  const [personImage, setPersonImage] = useState('');
  const [garmentImage, setGarmentImage] = useState('');
  const [tryOnCategory, setTryOnCategory] = useState<'tops' | 'bottoms' | 'one-pieces'>('tops');
  const [privacyConsent, setPrivacyConsent] = useState(false);
  const [imageBusy, setImageBusy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [taskMode, setTaskMode] = useState(false);
  const [taskPreview, setTaskPreview] = useState<{
    message: string;
    workflow: string;
    goal: string;
    agents: string[];
    tools: string[];
    summary: string;
    sideEffects: string;
    requiresApprovalForSensitiveActions: boolean;
  } | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [error, setError] = useState('');
  const conversationIdRef = useRef<string | null>(null);
  const busyRef = useRef(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const personImageInputRef = useRef<HTMLInputElement>(null);
  const garmentImageInputRef = useRef<HTMLInputElement>(null);
  const chatAttachmentInputRef = useRef<HTMLInputElement>(null);
  const speechRecognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const questionTypingTimerRef = useRef<number | null>(null);
  const designSaveRequestIdsRef = useRef(new WeakMap<AssistantMessage, string>());
  const navigationDragStartRef = useRef<number | null>(null);
  const navigationDragHandledRef = useRef(false);
  const voiceTurnRef = useRef(false);
  const coreSuccessTimerRef = useRef<number | null>(null);
  const [coreSuccessFlash, setCoreSuccessFlash] = useState(false);
  const micLevelRef = useMicLevel(recordingVoice);
  const { speaking: speechSpeaking, pulseRef: speechPulseRef, speak: speakReply, cancel: cancelSpeech } = useSpeechReply(isIt);
  // 粒子核心与聊天输入、真实请求、真实回答片段、语音生命周期共用同一条事件通道。
  const coreLife = useMemo(() => createModaCoreLife(), []);
  const replyRevealTimerRef = useRef<number | null>(null);
  const replyRevealRef = useRef<{ id: string; full: string; onDone?: () => void } | null>(null);
  const coreState: ModaCoreVisualState = error
    ? 'error'
    : busy
      ? 'thinking'
      : recordingVoice
        ? 'listening'
        : speechSpeaking
          ? 'speaking'
          : coreSuccessFlash
            ? 'success'
            : 'idle';
  const flashCoreSuccess = () => {
    setCoreSuccessFlash(true);
    if (coreSuccessTimerRef.current !== null) window.clearTimeout(coreSuccessTimerRef.current);
    coreSuccessTimerRef.current = window.setTimeout(() => {
      setCoreSuccessFlash(false);
      coreSuccessTimerRef.current = null;
    }, 1600);
  };
  const finishReplyReveal = (flush: boolean) => {
    if (replyRevealTimerRef.current !== null) {
      window.clearInterval(replyRevealTimerRef.current);
      replyRevealTimerRef.current = null;
    }
    const reveal = replyRevealRef.current;
    replyRevealRef.current = null;
    if (!reveal) return;
    if (flush) {
      setMessages(current => current.map(message => message.id === reveal.id ? { ...message, content: reveal.full } : message));
      coreLife.emit({ type: 'response:complete' });
      reveal.onDone?.();
    } else {
      coreLife.emit({ type: 'response:abort' });
    }
  };

  /**
   * 真实回答的渐进呈现。
   *
   * 服务端 `/api/merchant/assistant/query` 目前整包返回（无 SSE），因此这里不伪造“思考”，
   * 只把同一段真实回复按自然片段逐步显示，并把每个片段作为真实事件交给粒子核心；
   * 文本内容始终来自接口返回，不改写、不生成任何额外文案。
   */
  const revealAssistantReply = (
    messageId: string,
    fullText: string,
    extras: Omit<AssistantMessage, 'role' | 'content' | 'id'> = {},
    onDone?: () => void
  ) => {
    finishReplyReveal(false);
    setMessages(current => [...current, { role: 'assistant', id: messageId, content: '', ...extras }]);
    if (!fullText) {
      coreLife.emit({ type: 'response:complete' });
      onDone?.();
      return;
    }
    const frames = buildAssistantReplyFrames(fullText);
    let frameIndex = 0;
    replyRevealRef.current = { id: messageId, full: fullText, onDone };
    coreLife.emit({ type: 'response:start' });
    replyRevealTimerRef.current = window.setInterval(() => {
      const reveal = replyRevealRef.current;
      if (!reveal || reveal.id !== messageId) return;
      const frame = frames[frameIndex];
      frameIndex += 1;
      if (frame) {
        setMessages(current => current.map(message => message.id === messageId ? { ...message, content: reveal.full.slice(0, frame.end) } : message));
        coreLife.emit({ type: 'response:chunk', chars: frame.delta });
      }
      if (!frame || frame.end >= reveal.full.length) finishReplyReveal(true);
    }, assistantReplyFrameInterval(fullText));
  };


  conversationIdRef.current = conversationId;
  busyRef.current = busy;

  useEffect(() => () => {
    speechRecognitionRef.current?.stop();
    if (questionTypingTimerRef.current !== null) window.clearInterval(questionTypingTimerRef.current);
    if (coreSuccessTimerRef.current !== null) window.clearTimeout(coreSuccessTimerRef.current);
    if (replyRevealTimerRef.current !== null) window.clearInterval(replyRevealTimerRef.current);
    replyRevealRef.current = null;
    coreLife.dispose();
    cancelSpeech();
  }, []);

  // 真实语音播报开始/结束驱动同一套粒子；文字与语音来自同一个回答。
  useEffect(() => {
    if (!speechSpeaking) return;
    coreLife.emit({ type: 'audio:start' });
    return () => coreLife.emit({ type: 'audio:end' });
  }, [speechSpeaking, coreLife]);

  useEffect(() => {
    if (!menuOpen) return;
    const closeMenuOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    window.addEventListener('keydown', closeMenuOnEscape);
    return () => window.removeEventListener('keydown', closeMenuOnEscape);
  }, [menuOpen]);

  useEffect(() => {
    if (!modeSheetOpen) return;
    const closeSheetOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setModeSheetOpen(false);
    };
    window.addEventListener('keydown', closeSheetOnEscape);
    return () => window.removeEventListener('keydown', closeSheetOnEscape);
  }, [modeSheetOpen]);

  const dismissMenu = () => setMenuOpen(false);
  const handleNavigationPointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
    navigationDragStartRef.current = event.clientY;
    navigationDragHandledRef.current = false;
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };
  const handleNavigationPointerUp = (event: React.PointerEvent<HTMLButtonElement>) => {
    const startY = navigationDragStartRef.current;
    navigationDragStartRef.current = null;
    if (!bottomNavigation || startY === null) return;
    const deltaY = event.clientY - startY;
    if (Math.abs(deltaY) < 16) return;
    navigationDragHandledRef.current = true;
    if (deltaY < 0 && !bottomNavigation.open) bottomNavigation.onToggle();
    if (deltaY > 0 && bottomNavigation.open) bottomNavigation.onToggle();
  };
  const handleNavigationPointerCancel = () => {
    navigationDragStartRef.current = null;
    navigationDragHandledRef.current = false;
  };
  const handleNavigationClick = () => {
    if (navigationDragHandledRef.current) {
      navigationDragHandledRef.current = false;
      return;
    }
    bottomNavigation?.onToggle();
  };

  useEffect(() => {
    if (activeSection !== 'designs') return;
    let active = true;
    setDesignsLoading(true);
    apiGet<{ success: true; designs: ModaGptDesign[] }>(`/api/merchant/modagpt/designs?category=${designFilter}`)
      .then(result => {
        if (active) {
          setDesigns(result.designs);
          setDesignNotice('');
        }
      })
      .catch(loadError => {
        if (active) setDesignNotice(loadError instanceof Error ? loadError.message : (localizeCopy('作品加载失败，请稍后重试。', 'Impossibile caricare il portfolio.')));
      })
      .finally(() => {
        if (active) setDesignsLoading(false);
      });
    return () => { active = false; };
  }, [activeSection, designFilter, designsRefresh, isIt, merchantId]);

  const fashionModes: Array<{ id: FashionMode; title: string; description: string; prompt: string; Icon: typeof Shirt; imageTask?: boolean; available: boolean }> = [
      { id: 'design', title: localizeCopy("服装设计", "Design moda"), description: localizeCopy("生成设计方案", "Crea un design"), prompt: localizeCopy("帮我设计一款服装。先询问我还没有提供的关键信息，再整理成完整的设计方案。", "Aiutami a progettare un capo. Chiedimi prima le informazioni che mancano e poi prepara una scheda di design."), Icon: Shirt, available: true },
      { id: 'generate', title: localizeCopy("图片生成", "Genera immagini"), description: localizeCopy("生成商品图片", "Immagini prodotto"), prompt: '', Icon: ImagePlus, imageTask: true, available: true },
      { id: 'tryon', title: localizeCopy("虚拟试衣", "Virtual Try-On"), description: localizeCopy("授权图片试穿", "Prova con foto autorizzata"), prompt: localizeCopy("请把服装图片中的服装自然地换到人物照片上，保持人物姿势和背景，并呈现真实合身效果。", "Applica il capo della foto alla persona in modo naturale, mantenendo posa e sfondo e mostrando una vestibilità realistica."), Icon: UserRound, imageTask: true, available: true },
      { id: 'edit', title: localizeCopy("服装换色", "Ricolora capo"), description: localizeCopy("手动选区换色", "Selezione manuale"), prompt: '', Icon: ImagePlus, available: true },
      { id: 'fashionVideo', title: localizeCopy("秀场视频", "Video runway"), description: localizeCopy("视频服务未接", "Servizio non attivo"), prompt: '', Icon: Sparkles, available: false },
      { id: 'inspiration', title: localizeCopy("设计灵感", "Ispirazione"), description: localizeCopy("获取设计灵感", "Idee per il design"), prompt: localizeCopy("请为我提出三个服装系列创意方向，并说明配色、廓形、面料和适合的客群。", "Proponi tre direzioni creative per una nuova collezione di moda e spiega palette, silhouette e materiali."), Icon: Lightbulb, available: true },
      { id: 'productLaunch', title: localizeCopy("商业模特", "Modelli moda"), description: localizeCopy("生成模特图片", "Foto con modelli"), prompt: '', Icon: Sparkles, imageTask: true, available: true }
    ];
  const modeQuickPrompts = fashionMode === 'design'
    ? (isIt ? ['Abito da sera', 'Streetwear', 'Alta moda', 'Borsa o accessori'] : ['女装', '男装', '童装', '礼服', '街头风', '运动装', '高级定制', '鞋包配饰'])
    : fashionMode === 'generate'
      ? ([localizeCopy("Lookbook", "Lookbook"), localizeCopy("电商白底图", "E-commerce"), localizeCopy("时尚大片", "Editoriale"), localizeCopy("面料细节", "Dettaglio tessuto")])
      : fashionMode === 'tryon'
        ? ([localizeCopy("上传人物照片", "Carica foto persona"), localizeCopy("选择服装", "Scegli un capo"), localizeCopy("描述想要的风格", "Definisci lo stile")])
        : fashionMode === 'inspiration'
          ? ([localizeCopy("春季趋势", "Tendenza primavera"), localizeCopy("配色灵感", "Palette colori"), localizeCopy("胶囊系列", "Capsule collection")])
          : [];

  const loadConversations = async () => {
    const query = new URLSearchParams(sharedChatContext);
    const result = await apiGet<{ success: true; conversations: AssistantConversation[] }>(
      `/api/merchant/assistant/conversations?${query}`
    );
    setConversations(result.conversations);
    return result.conversations;
  };

  const openConversation = async (id: string) => {
    const query = new URLSearchParams(sharedChatContext);
    const result = await apiGet<{
      success: true;
      conversation: {
        id: string;
        messages: Array<{ id: string; role: string; text: string; actions?: AssistantAction[] }>;
      };
    }>(`/api/merchant/assistant/conversations/${encodeURIComponent(id)}?${query}`);
    if (conversationIdRef.current !== id) return;
    setMessages(result.conversation.messages.flatMap(message =>
      message.role === 'user' || message.role === 'assistant'
        ? [{ id: message.id, role: message.role, content: message.text, actions: message.actions }]
        : []
    ));
  };

  useEffect(() => {
    let active = true;
    void apiGet<ModaGptEntitlements & { success: true }>('/api/merchant/modagpt/entitlements')
      .then(result => { if (active) setEntitlements(result); })
      .catch(loadError => {
        if (active) setError(loadError instanceof Error ? loadError.message : (localizeCopy('AI 权益读取失败，请稍后重试。', 'Caricamento piano AI non riuscito.')));
      });
    return () => { active = false; };
  }, [isIt, merchantId, copilotContext.context, copilotContext.scope]);

  useEffect(() => {
    let active = true;
    setLoadingHistory(true);
    setError('');
    setMessages([]);
    setConversations([]);
    setConversationId(null);
    conversationIdRef.current = null;
    void (async () => {
      try {
        const query = new URLSearchParams(sharedChatContext);
        const result = await apiGet<{ success: true; conversations: AssistantConversation[] }>(
          `/api/merchant/assistant/conversations?${query}`
        );
        if (!active) return;
        setConversations(result.conversations);
        const latest = result.conversations[0];
        if (latest) {
          conversationIdRef.current = latest.id;
          setConversationId(latest.id);
          const detailQuery = new URLSearchParams(sharedChatContext);
          const detail = await apiGet<{
            success: true;
            conversation: {
              id: string;
              messages: Array<{ id: string; role: string; text: string; actions?: AssistantAction[] }>;
            };
          }>(`/api/merchant/assistant/conversations/${encodeURIComponent(latest.id)}?${detailQuery}`);
          if (active && conversationIdRef.current === latest.id) {
            setMessages(detail.conversation.messages.flatMap(message =>
              message.role === 'user' || message.role === 'assistant'
                ? [{ id: message.id, role: message.role, content: message.text, actions: message.actions }]
                : []
            ));
          }
        }
      } catch (loadError) {
        if (active) setError(loadError instanceof Error
          ? loadError.message
          : (localizeCopy('AI 对话历史加载失败，请重试。', 'Impossibile caricare la cronologia AI.')));
      } finally {
        if (active) setLoadingHistory(false);
      }
    })();
    return () => { active = false; };
  }, [isIt, merchantId, copilotContext.context, copilotContext.scope]);

  useEffect(() => {
    const synchronize = async () => {
      try {
        await loadConversations();
        const selectedId = conversationIdRef.current;
        // 逐字呈现期间不要用服务端整包结果覆盖正在显示的文本，避免文字回跳。
        if (selectedId && !busyRef.current && !replyRevealRef.current) await openConversation(selectedId);
      } catch (syncError) {
        setError(syncError instanceof Error
          ? syncError.message
          : (localizeCopy('同步 ModaUI 对话失败，请重试。', 'Sincronizzazione conversazione non riuscita.')));
      }
    };
    const interval = window.setInterval(() => void synchronize(), 5000);
    return () => window.clearInterval(interval);
  }, [isIt, merchantId, copilotContext.context, copilotContext.scope]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, busy]);

  const startNewConversation = () => {
    finishReplyReveal(false);
    coreLife.emit({ type: 'core:reset' });
    if (busy) return;
    if (questionTypingTimerRef.current !== null) {
      window.clearInterval(questionTypingTimerRef.current);
      questionTypingTimerRef.current = null;
    }
    setConversationId(null);
    conversationIdRef.current = null;
    setMessages([]);
    setQuestion('');
    setError('');
    setActiveSection('chat');
    setMenuOpen(false);
    setComposerToolsOpen(false);
    setModeSheetOpen(false);
    setProductLaunchProgress(null);
    setProductLaunchRecovery(null);
    setHistoryOpen(false);
  };

  const typeQuestionWithEffect = (text: string) => {
    if (questionTypingTimerRef.current !== null) window.clearInterval(questionTypingTimerRef.current);
    const characters = Array.from(text);
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setQuestion(text);
      return;
    }
    let index = 0;
    setQuestion('');
    questionTypingTimerRef.current = window.setInterval(() => {
      index += 1;
      setQuestion(characters.slice(0, index).join(''));
      if (index >= characters.length && questionTypingTimerRef.current !== null) {
        window.clearInterval(questionTypingTimerRef.current);
        questionTypingTimerRef.current = null;
      }
    }, 32);
  };

  const activateCreation = (mode: FashionMode, preserveDraft = false, promptOverride?: string) => {
    const selected = fashionModes.find(item => item.id === mode);
    if (!selected?.available) return;
    setTaskMode(false);
    setActiveSection('chat');
    setFashionMode(mode);
    setModeSheetOpen(mode === 'tryon' || mode === 'productLaunch');
    const nextQuestion = promptOverride
      ?? (preserveDraft && selectedCreation === mode && question.trim() ? question : selected.prompt);
    if (mode === 'tryon') typeQuestionWithEffect(nextQuestion);
    else {
      if (questionTypingTimerRef.current !== null) {
        window.clearInterval(questionTypingTimerRef.current);
        questionTypingTimerRef.current = null;
      }
      setQuestion(nextQuestion);
    }
    setError('');
    if (mode === 'inspiration') {
      window.setTimeout(() => {
        const input = document.querySelector<HTMLTextAreaElement>('textarea[aria-label="发送消息给 ModaUI"], textarea[aria-label="Messaggio per ModaUI"]');
        input?.focus();
      }, 0);
    }
  };

  const closeModeSheet = () => setModeSheetOpen(false);

  const exitCreationMode = () => {
    setModeSheetOpen(false);
    setFashionMode(null);
  };

  const selectCreationMode = (mode: FashionMode) => {
    if (fashionMode === mode) {
      exitCreationMode();
      return;
    }
    activateCreation(mode);
  };

  const handleComposerFocus = () => {
    setModeSheetOpen(false);
    setComposerToolsOpen(false);
    onComposerFocus?.();
  };

  const modeHasSettings = fashionMode === 'design' || fashionMode === 'tryon' || fashionMode === 'productLaunch';
  const activeModeTitle = fashionMode ? fashionModes.find(mode => mode.id === fashionMode)?.title ?? '' : '';


  const buildFashionDesignPrompt = () => {
    const brief = fashionDesignNotes.trim();
    if (!brief) {
      return localizeCopy(
        '我想设计一款服装。先用不超过 3 个简短问题确认品类、季节、客群和设计偏好；信息足够后给出 3 个不同方向，并标记待确认的成分或工艺。',
        'Voglio progettare un capo. Fammi al massimo 3 domande brevi su categoria, stagione, pubblico e preferenze; poi proponi 3 direzioni e indica composizioni o lavorazioni da confermare.'
      );
    }
    return localizeCopy(
      `请根据这份服装创意简报给出 3 个明显不同的设计方向：${brief}。每个方向简要说明廓形、关键细节、配色和面料观感；未知成分或工艺标记为待确认，不要声称可直接量产。`,
      `Proponi 3 direzioni di design distinte per questo brief: ${brief}. Per ciascuna indica silhouette, dettagli, colori e aspetto del tessuto; segna come da confermare composizioni e lavorazioni sconosciute.`
    );
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requestedTool = initialMode || params.get('modagptTool');
    if (!requestedTool) return;

    switch (requestedTool) {
      case 'design':
        if (initialMode === 'design') {
          setSelectedCreation('design');
          setActiveSection('create');
          break;
        }
        activateCreation(requestedTool);
        break;
      case 'generate':
      case 'tryon':
      case 'inspiration':
        activateCreation(requestedTool);
        break;
      case 'productLaunch':
        activateCreation(requestedTool);
        break;
      case 'edit':
        setSelectedCreation('edit');
        setActiveSection('recolor');
        break;
      case 'create':
        setActiveSection('create');
        break;
      case 'designs':
        setActiveSection('designs');
        break;
      case 'knowledge':
        setActiveSection('knowledge');
        break;
      case 'settings':
        setMenuOpen(true);
        break;
      case 'pricing':
        setPricingOpen(true);
        break;
      default:
        return;
    }

    params.delete('modagptTool');
    const nextSearch = params.toString();
    window.history.replaceState(
      window.history.state,
      '',
      `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ''}${window.location.hash}`
    );
  }, []);

  const generateProductLaunchImage = async (
    prompt: string,
    index: number,
    totalImages: number
  ) => {
    const result = await apiPost<{
      success: true;
      imageDataUrl: string;
      quota?: { used: number; limit: number; remaining: number };
      credits?: { used: number; remaining: number };
    }>('/api/merchant/modagpt/images', {
      task: 'imageGeneration',
      prompt: buildModelStudioPrompt(prompt, index + 1, productLaunchShotDirections[index])
    }, 180_000, { 'Idempotency-Key': `image-${crypto.randomUUID()}` });
    if (result.quota) {
      setEntitlements(current => current ? {
        ...current,
        usage: { ...current.usage, imageGeneration: result.quota!.used },
        remaining: { ...current.remaining, imageGeneration: result.quota!.remaining }
      } : current);
    }
    if (result.credits) setEntitlements(current => current ? {
      ...current,
      billing: { ...current.billing, creditBalance: result.credits!.remaining }
    } : current);
    setMessages(current => [...current, {
      role: 'assistant',
      content: localizeCopy(
        `商品上新视觉图 ${index + 1}/${totalImages}。请检查款式细节和生成结果；只有点击“保存到作品库”后才会保存。`,
        `Immagine prodotto ${index + 1}/${totalImages}. Verifica il risultato; verrà salvato solo dopo aver scelto “Salva nei progetti”.`
      ),
      imageDataUrl: result.imageDataUrl,
      designCategory: 'imageGeneration'
    }]);
  };

  const generateDesignCandidates = async () => {
    if (busy) return;
    const designPrompt = question.trim()
      || [...messages].reverse().find(message => message.role === 'assistant')?.content.trim()
      || [...messages].reverse().find(message => message.role === 'user')?.content.trim()
      || '';
    if (!designPrompt) {
      setError(localizeCopy('先填写服装设计简报，再生成概念图。', 'Inserisci prima il brief di design.'));
      return;
    }
    if (!entitlements) {
      setError(localizeCopy('正在核对图片生成权限，请稍后重试。', 'Verifica i permessi immagini e riprova.'));
      return;
    }
    if (!entitlements.capabilities.imageGeneration) {
      setError(entitlements.plan === 'free'
        ? localizeCopy('设计概念图需要 ModaUI 高级版，请联系 RUDA 管理员开通。', 'Le immagini di design richiedono il piano ModaUI Pro.')
        : localizeCopy('当前图像生成服务未配置或不可用。', 'Il provider immagini non è configurato o non è disponibile.'));
      return;
    }
    if (!entitlements.billing.active && entitlements.remaining.imageGeneration < designCandidateCount) {
      setError(localizeCopy(
        `图片额度不足；本次需要 ${designCandidateCount} 次图片生成额度。`,
        `Quota immagini insufficiente: servono ${designCandidateCount} generazioni.`
      ));
      return;
    }
    if (!window.confirm(localizeCopy(
      `将为这份设计简报生成 ${designCandidateCount} 张独立概念图，按当前套餐额度或 Credits 结算；结果需要人工核对，不会自动保存或发布。继续吗？`,
      `Genererai ${designCandidateCount} immagini concept indipendenti, usando le quote o i Credits del piano. Verifica i risultati: non verranno salvati o pubblicati automaticamente. Continuare?`
    ))) return;

    setBusy(true);
    busyRef.current = true;
    setImageBusy(true);
    setError('');
    setDesignGenerationProgress({ completed: 0, total: designCandidateCount });
    let completed = 0;
    try {
      for (let index = 0; index < designCandidateCount; index += 1) {
        const result = await apiPost<{
          success: true;
          imageDataUrl: string;
          quota?: { used: number; remaining: number };
          credits?: { used: number; remaining: number };
        }>('/api/merchant/modagpt/images', {
          task: 'imageGeneration',
          prompt: buildFashionDesignConceptPrompt(designPrompt, index + 1)
        }, 180_000, { 'Idempotency-Key': `image-${crypto.randomUUID()}` });
        completed = index + 1;
        if (result.quota) {
          setEntitlements(current => current ? {
            ...current,
            usage: { ...current.usage, imageGeneration: result.quota!.used },
            remaining: { ...current.remaining, imageGeneration: result.quota!.remaining }
          } : current);
        }
        if (result.credits) setEntitlements(current => current ? {
          ...current,
          billing: { ...current.billing, creditBalance: result.credits!.remaining }
        } : current);
        setMessages(current => [...current, {
          role: 'assistant',
          content: localizeCopy(
            `设计概念图 ${completed}/${designCandidateCount}。这是独立候选，不保证与其他候选保持完全相同的服装细节；请核对并选择是否保存。`,
            `Concept ${completed}/${designCandidateCount}. È un candidato indipendente; i dettagli non sono garantiti identici agli altri. Verifica e salva solo se approvato.`
          ),
          imageDataUrl: result.imageDataUrl,
          designCategory: 'imageGeneration'
        }]);
        setDesignGenerationProgress({ completed, total: designCandidateCount });
      }
    } catch (generationError) {
      const code = generationError instanceof Error ? generationError.message : 'MODAGPT_IMAGE_GENERATION_FAILED';
      setError(localizeCopy(
        `已生成 ${completed}/${designCandidateCount} 张概念图，后续请求失败：${code}。已完成图片保留在当前对话，请先检查并保存。`,
        `${completed}/${designCandidateCount} concept completati; la richiesta successiva è fallita: ${code}. Verifica e salva le immagini già create.`
      ));
    } finally {
      setImageBusy(false);
      setBusy(false);
      busyRef.current = false;
    }
  };

  const selectConversation = async (id: string) => {
    finishReplyReveal(false);
    coreLife.emit({ type: 'core:reset' });
    if (busy) return;
    setConversationId(id);
    conversationIdRef.current = id;
    setMessages([]);
    setHistoryOpen(false);
    setError('');
    setProductLaunchProgress(null);
    setProductLaunchRecovery(null);
    try {
      await openConversation(id);
    } catch (loadError) {
      setError(loadError instanceof Error
        ? loadError.message
        : (localizeCopy('无法打开这段对话，请重试。', 'Impossibile aprire la conversazione.')));
    }
  };

  const previewTask = async (message: string) => {
    if (!message.trim() || busy) return;
    setBusy(true);
    setError('');
    setQuestion('');
    try {
      const result = await apiPost<{
        success: true;
        workflow: string;
        goal: string;
        agents: string[];
        tools: string[];
        summary: string;
        sideEffects: string;
        requiresApprovalForSensitiveActions: boolean;
      }>('/api/merchant/modagpt/task/preview', { message: message.trim() });
      setTaskPreview({ message: message.trim(), ...result });
    } catch (previewError) {
      setError(previewError instanceof Error ? previewError.message : localizeCopy('无法准备任务，请检查权限或稍后重试。', 'Impossibile preparare l’attività. Verifica i permessi e riprova.'));
    } finally {
      setBusy(false);
    }
  };

  const confirmTask = async () => {
    const preview = taskPreview;
    if (!preview || busy) return;
    setBusy(true);
    setTaskPreview(null);
    setTaskMode(false);
    setError('');
    setMessages(current => [...current, { role: 'user', content: preview.message }]);
    try {
      const created = await apiPost<{
        success: true;
        taskId: string;
        status: string;
      }>('/api/merchant/modagpt/task', {
        message: preview.message,
        conversationId: conversationIdRef.current || undefined,
        inputs: {}
      }, 30_000, { 'Idempotency-Key': `merchant-task-${crypto.randomUUID()}` });
      setMessages(current => [...current, {
        role: 'assistant',
        content: `任务已提交到服务端队列（${created.taskId}），当前状态：${created.status}。入队不代表业务操作已完成。`
      }]);
      let latest: {
        runtimeStatus: string;
        status: string;
        summary: string | null;
        approvalId: string | null;
        errors: string[];
      } | null = null;
      for (let attempt = 0; attempt < 30; attempt += 1) {
        await new Promise(resolve => setTimeout(resolve, 1_000));
        const task = await apiGet<{
          success: true;
          runtimeStatus: string;
          status: string;
          summary: string | null;
          approvalId: string | null;
          errors: string[];
        }>(`/api/merchant/modagpt/task/${encodeURIComponent(created.taskId)}`);
        latest = task;
        if (['completed', 'failed', 'dead_letter', 'cancelled', 'waiting_approval'].includes(task.runtimeStatus)) break;
      }
      if (!latest) throw new Error('MODAGPT_TASK_STATUS_INVALID');
      const finalMessage = latest.runtimeStatus === 'waiting_approval'
        ? `任务等待商家审批${latest.approvalId ? `（${latest.approvalId}）` : ''}，敏感操作尚未执行。${latest.summary || ''}`
        : ['failed', 'dead_letter', 'cancelled'].includes(latest.runtimeStatus)
          ? `任务未完成（${latest.runtimeStatus}）：${latest.errors.join('、') || '请检查任务后重试。'}`
          : latest.runtimeStatus === 'completed'
            ? `任务已完成：${latest.summary || latest.status}。`
            : `任务仍在处理中，任务编号：${created.taskId}。`;
      setMessages(current => [...current, { role: 'assistant', content: finalMessage }]);
    } catch (taskError) {
      setError(taskError instanceof Error ? taskError.message : localizeCopy('无法确认任务状态，请稍后检查任务列表。', 'Impossibile confermare lo stato. Controlla le attività più tardi.'));
    } finally {
      setBusy(false);
    }
  };

  const sendQuestion = async (value = question, messageAttachments = attachments) => {
    const prompt = value.trim() || (messageAttachments.length ? (localizeCopy('请分析我上传的附件并帮助我。', 'Analizza gli allegati e aiutami.')) : '');
    if (!prompt || busy) return;
    cancelSpeech();
    if (taskMode) {
      if (messageAttachments.length) {
        setError(localizeCopy('执行任务暂不支持附件，请先移除附件或使用普通对话分析。', 'Gli allegati non sono supportati per le attività. Rimuovili o usa la chat normale.'));
        return;
      }
      await previewTask(prompt);
      return;
    }
    const productLaunchTask = fashionMode === 'productLaunch';
    const imageTask = fashionMode === 'generate' || fashionMode === 'tryon';
    if (imageTask && !entitlements) {
      setError(localizeCopy('正在核对 AI 套餐权限，请稍后重试。', 'Verifica il piano AI e riprova.'));
      return;
    }
    if (fashionMode === 'generate' && !entitlements?.capabilities.imageGeneration) {
      setError(entitlements?.plan === 'free'
        ? (localizeCopy('服装出图需要 ModaUI Pro 套餐，请联系平台管理员开通。', 'La generazione immagini richiede il piano ModaUI Pro. Contatta il tuo amministratore per l’attivazione.'))
        : (localizeCopy('图像服务暂不可用，请联系平台管理员。', 'Il provider immagini non è configurato.')));
      return;
    }
    if (fashionMode === 'tryon' && !entitlements?.capabilities.tryOn) {
      setError(entitlements?.plan === 'free'
        ? (localizeCopy('AI 换衣需要 ModaUI Pro 套餐，请联系平台管理员开通。', 'AI Try-On richiede il piano ModaUI Pro. Contatta il tuo amministratore per l’attivazione.'))
        : (localizeCopy('当前图像服务暂不支持 AI 换衣，请联系平台管理员。', 'AI Try-On non è disponibile per il provider configurato.')));
      return;
    }
    if (fashionMode === 'tryon' && (!personImage || !garmentImage || !privacyConsent)) {
      setError(localizeCopy('请上传人物和服装图片，并确认将照片发送到 Fal AI 处理。', 'Carica entrambe le immagini e conferma il trasferimento al provider AI.'));
      return;
    }
    if (productLaunchTask) {
      if (!entitlements) {
        setError(localizeCopy('正在核对 AI 套餐权限，请稍后重试。', 'Verifica il piano AI e riprova.'));
        return;
      }
      if (!entitlements.billing.active && entitlements.remaining.chat < 1) {
        setError(localizeCopy('本月对话额度已用完，无法启动商品上新工作流。', 'Quota chat mensile esaurita; impossibile avviare il workflow.'));
        return;
      }
      if (!entitlements.capabilities.imageGeneration) {
        setError(entitlements.plan === 'free'
          ? localizeCopy('商品上新工作流需要 ModaUI Pro，请联系平台管理员开通。', 'Il workflow richiede ModaUI Pro. Contatta l’amministratore RUDA.')
          : localizeCopy('当前图像生成服务未配置或不可用。', 'Il provider immagini non è configurato o non è disponibile.'));
        return;
      }
      if (!entitlements.billing.active && entitlements.remaining.imageGeneration < productLaunchImageCount) {
        setError(localizeCopy(
          `图片额度不足；本次需要 ${productLaunchImageCount} 次图片生成额度。`,
          `Quota immagini insufficiente: servono ${productLaunchImageCount} generazioni.`
        ));
        return;
      }
      if (!window.confirm(localizeCopy(
        `此工作流会生成 ${productLaunchImageCount} 张图片，并按当前套餐额度或 Credits 结算；同时调用已配置的 AI 服务。服务商可能产生费用，结果不会自动发布商品。继续吗？`,
        `Il workflow genera ${productLaunchImageCount} immagini e usa le quote o i Credits previsti dal tuo piano. Il provider può addebitare costi; nessun prodotto verrà pubblicato. Continuare?`
      ))) return;
    }
    setBusy(true);
    busyRef.current = true;
    setError('');
    setQuestion('');
    setModeSheetOpen(false);
    setComposerToolsOpen(false);
    setProductLaunchProgress(productLaunchTask
      ? { stage: 'copy', completedImages: 0, totalImages: productLaunchImageCount }
      : null);
    if (productLaunchTask) setProductLaunchRecovery(null);
    setMessages(current => [...current, { role: 'user', content: prompt, attachments: messageAttachments }]);
    // 真实提交：核心向前靠近，进入请求处理状态（不是按时间表演示思考）。
    coreLife.emit({ type: 'message:submit' });
    coreLife.emit({ type: 'response:start' });
    const chatIdempotencyKey = `assistant-${crypto.randomUUID()}`;
    let productLaunchCopyCompleted = false;
    let completedProductLaunchImages = 0;
    try {
      if (productLaunchTask) {
        const copyResult = await apiPost<{
          success: true;
          reply: string;
          conversationId: string;
          conversationTitle: string;
          conversationUpdatedAt: string;
          messageCount: number;
          actions?: AssistantAction[];
          messageId: string;
          quota?: { used: number; limit: number; remaining: number };
          credits?: { used: number; remaining: number };
        }>('/api/merchant/assistant/query', {
          question: prompt,
          conversationId: conversationIdRef.current,
          attachments: messageAttachments.map(({ name, dataUrl }) => ({ name, dataUrl })),
          workflow: 'product_launch_copy',
          pageContext: copilotContext.pageContext,
          ...sharedChatContext
        }, 60_000, { 'Idempotency-Key': chatIdempotencyKey });
        productLaunchCopyCompleted = true;
        conversationIdRef.current = copyResult.conversationId;
        setConversationId(copyResult.conversationId);
        revealAssistantReply(
          copyResult.messageId,
          `${localizeCopy('商品文案草稿（请核实后再使用）：', 'Bozza descrizione prodotto (verifica prima dell’uso):')}\n\n${copyResult.reply}`,
          { actions: copyResult.actions || [] },
          () => {
            flashCoreSuccess();
            if (voiceTurnRef.current && copyResult.reply) speakReply(copyResult.reply);
            voiceTurnRef.current = false;
          }
        );
        if (copyResult.quota) setEntitlements(current => current ? {
          ...current,
          usage: { ...current.usage, chat: copyResult.quota!.used },
          remaining: { ...current.remaining, chat: copyResult.quota!.remaining }
        } : current);
        setConversations(current => [
          {
            id: copyResult.conversationId,
            title: copyResult.conversationTitle,
            updatedAt: copyResult.conversationUpdatedAt,
            messageCount: copyResult.messageCount
          },
          ...current.filter(conversation => conversation.id !== copyResult.conversationId)
        ].slice(0, 30));
        setAttachments([]);

        setProductLaunchProgress({ stage: 'images', completedImages: 0, totalImages: productLaunchImageCount });
        setImageBusy(true);
        for (let index = 0; index < productLaunchImageCount; index += 1) {
          await generateProductLaunchImage(prompt, index, productLaunchImageCount);
          completedProductLaunchImages = index + 1;
          setProductLaunchProgress({ stage: 'images', completedImages: index + 1, totalImages: productLaunchImageCount });
        }
        setProductLaunchRecovery(null);
        setProductLaunchProgress({ stage: 'complete', completedImages: productLaunchImageCount, totalImages: productLaunchImageCount });
        return;
      }
      if (fashionMode === 'generate' || fashionMode === 'tryon') {
        setImageBusy(true);
        const result = await apiPost<{
          success: true;
          imageDataUrl: string;
          quota?: { used: number; limit: number; remaining: number };
          credits?: { used: number; remaining: number };
        }>('/api/merchant/modagpt/images', fashionMode === 'tryon'
          ? { task: 'tryOn', prompt, category: tryOnCategory, personImage, garmentImage, privacyConsent }
          : { task: 'imageGeneration', prompt }, 180_000, { 'Idempotency-Key': `image-${crypto.randomUUID()}` });
        const feature = fashionMode === 'tryon' ? 'tryOn' : 'imageGeneration';
        if (result.quota) {
          setEntitlements(current => current ? {
            ...current,
            usage: { ...current.usage, [feature]: result.quota!.used },
            remaining: { ...current.remaining, [feature]: result.quota!.remaining }
          } : current);
        }
        if (result.credits) setEntitlements(current => current ? {
          ...current,
          billing: { ...current.billing, creditBalance: result.credits!.remaining }
        } : current);
        setMessages(current => [...current, {
          role: 'assistant',
          content: fashionMode === 'tryon'
            ? (localizeCopy('这是本次 AI 换衣效果图。', 'Ecco il risultato del virtual try-on.'))
            : (localizeCopy('这是生成的服装设计图。', 'Ecco la proposta visiva.')),
          imageDataUrl: result.imageDataUrl,
          designCategory: fashionMode === 'tryon' ? 'tryOn' : 'imageGeneration'
        }]);
        coreLife.emit({ type: 'response:complete' });
        setPersonImage('');
        setGarmentImage('');
        setPrivacyConsent(false);
        return;
      }
      const result = await apiPost<{
        success: true;
        reply: string;
        conversationId: string;
        conversationTitle: string;
        conversationUpdatedAt: string;
        messageCount: number;
        actions?: AssistantAction[];
        messageId: string;
        quota?: { used: number; limit: number; remaining: number };
        credits?: { used: number; remaining: number };
      }>('/api/merchant/assistant/query', {
        question: prompt,
        conversationId: conversationIdRef.current,
        attachments: messageAttachments.map(({ name, dataUrl }) => ({ name, dataUrl })),
        pageContext: copilotContext.pageContext,
        ...sharedChatContext
      }, 30_000, { 'Idempotency-Key': chatIdempotencyKey });
      conversationIdRef.current = result.conversationId;
      setConversationId(result.conversationId);
      revealAssistantReply(
        result.messageId,
        result.reply,
        { actions: result.actions || [] },
        () => {
          flashCoreSuccess();
          if (voiceTurnRef.current && result.reply) speakReply(result.reply);
          voiceTurnRef.current = false;
        }
      );
      if (result.quota) setEntitlements(current => current ? {
        ...current,
        usage: { ...current.usage, chat: result.quota!.used },
        remaining: { ...current.remaining, chat: result.quota!.remaining }
      } : current);
      setConversations(current => [
        {
          id: result.conversationId,
          title: result.conversationTitle,
          updatedAt: result.conversationUpdatedAt,
          messageCount: result.messageCount
        },
        ...current.filter(conversation => conversation.id !== result.conversationId)
      ].slice(0, 30));
      setAttachments([]);
    } catch (requestError) {
      coreLife.emit({ type: 'response:error' });
      if (!productLaunchCopyCompleted) {
        setProductLaunchProgress(null);
        setMessages(current => current.filter((message, index) =>
          !(index === current.length - 1 && message.role === 'user' && message.content === prompt)
        ));
        setQuestion(prompt);
      }
      const errorCode = requestError instanceof Error ? requestError.message : '';
      if (productLaunchCopyCompleted) {
        setProductLaunchRecovery({
          prompt,
          nextImageIndex: completedProductLaunchImages,
          totalImages: productLaunchImageCount
        });
        setProductLaunchProgress(current => current
          ? { ...current, stage: 'partial', completedImages: completedProductLaunchImages }
          : { stage: 'partial', completedImages: completedProductLaunchImages, totalImages: productLaunchImageCount });
      }
      setError(productLaunchCopyCompleted
        ? localizeCopy(
          `商品文案已生成，图片工作流中途停止。${completedProductLaunchImages} 张已完成图片目前只在当前对话中，请离开前保存；可单独补生成剩余图片。若服务超时，供应商可能已处理该请求，请确认可能产生的费用后再重试。错误：${errorCode || '图片生成失败'}`,
          `Bozza testo creata, ma la generazione immagini si è interrotta. Le ${completedProductLaunchImages} immagini completate sono solo nella chat: salvale prima di uscire. Puoi generare solo quelle mancanti. In caso di timeout, il provider potrebbe aver già elaborato la richiesta: verifica i costi prima di riprovare. Errore: ${errorCode || 'generazione non riuscita'}`
        )
        : errorCode === 'MODAGPT_ATTACHMENT_INVALID'
        ? (localizeCopy('附件格式或大小不符合要求，请使用指定图片/PDF/TXT/MD/CSV 格式并检查大小限制。', 'Formato o dimensione allegato non valido. Usa immagini JPG/PNG/WebP, PDF, TXT, MD o CSV entro i limiti indicati.'))
        : errorCode === 'MODAGPT_ATTACHMENT_NO_TEXT'
          ? (localizeCopy('附件中未找到可读取的文本；暂不支持扫描版 PDF。', 'Non è stato trovato testo leggibile nel file. I PDF scannerizzati non sono ancora supportati.'))
          : errorCode === 'MODAGPT_ATTACHMENT_TOO_MANY_PAGES'
            ? (localizeCopy('PDF 页数超过 20 页限制。', 'Il PDF supera il limite di 20 pagine.'))
            : errorCode === 'MODAGPT_VISION_PROVIDER_UNAVAILABLE'
              ? (localizeCopy('图片识别服务当前不可用，请联系 RUDA 管理员检查视觉模型配置。', 'Il servizio AI visivo non è disponibile. Contatta l’amministratore RUDA per verificare il modello visivo.'))
        : errorCode === 'MODAGPT_UPGRADE_REQUIRED'
        ? (localizeCopy('该功能需要 ModaUI 高级版，请联系 RUDA 管理员开通。', 'Questa funzione richiede il piano Pro. Contatta l’amministratore RUDA.'))
        : errorCode === 'MODAGPT_QUOTA_EXCEEDED'
          ? (localizeCopy('本月此功能的使用额度已用完。', 'Hai raggiunto il limite mensile per questa funzione.'))
          : errorCode === 'MODAGPT_IMAGE_PROVIDER_NOT_CONFIGURED' || errorCode === 'MODAGPT_TRYON_PROVIDER_NOT_CONFIGURED'
            ? (localizeCopy('服务器尚未配置此 AI 服务，请联系管理员。', 'Il provider AI richiesto non è configurato dal server.'))
            : errorCode || localizeCopy('ModaUI 暂时无法回答，请稍后重试。', 'Assistente AI non disponibile. Riprova.'));
    } finally {
      setImageBusy(false);
      setBusy(false);
      busyRef.current = false;
    }
  };

  const resumeProductLaunchImages = async () => {
    const recovery = productLaunchRecovery;
    if (!recovery || busy) return;
    const remainingImages = recovery.totalImages - recovery.nextImageIndex;
    if (remainingImages <= 0) {
      setProductLaunchRecovery(null);
      return;
    }
    if (!entitlements?.capabilities.imageGeneration
    || (!entitlements.billing.active && entitlements.remaining.imageGeneration < remainingImages)) {
    setError(localizeCopy(
      `图像服务不可用或剩余图片额度不足；补生成还需要 ${remainingImages} 次图片额度。`,
      `Quota immagini insufficiente: servono altre ${remainingImages} generazioni.`
    ));
    return;
    }
    if (!window.confirm(localizeCopy(
    `只补生成剩余 ${remainingImages} 张图片，不会重做文案；按当前套餐额度或 Credits 结算。若上次超时，服务商可能已完成处理并计费，确认后继续。`,
    `Genera solo le ${remainingImages} immagini mancanti, senza rifare il testo; verranno usate le quote o i Credits del piano. In caso di timeout il provider potrebbe aver già completato e addebitato la richiesta. Continuare?`
    ))) return;
    setBusy(true);
    busyRef.current = true;
    setImageBusy(true);
    setError('');
    setProductLaunchProgress({
      stage: 'images',
      completedImages: recovery.nextImageIndex,
      totalImages: recovery.totalImages
    });
    let completedImages = recovery.nextImageIndex;
    try {
      for (let index = recovery.nextImageIndex; index < recovery.totalImages; index += 1) {
        await generateProductLaunchImage(recovery.prompt, index, recovery.totalImages);
        completedImages = index + 1;
        setProductLaunchProgress({
          stage: 'images',
          completedImages,
          totalImages: recovery.totalImages
        });
      }
      setProductLaunchRecovery(null);
      setProductLaunchProgress({
        stage: 'complete',
        completedImages: recovery.totalImages,
        totalImages: recovery.totalImages
      });
    } catch (requestError) {
      const errorCode = requestError instanceof Error ? requestError.message : '';
      setProductLaunchRecovery({ ...recovery, nextImageIndex: completedImages });
      setProductLaunchProgress({
        stage: 'partial',
        completedImages,
        totalImages: recovery.totalImages
      });
      setError(localizeCopy(
        `补生成中途停止，${completedImages} 张图片已完成。核对额度和服务费用后，可继续补生成剩余图片。错误：${errorCode || '图片生成失败'}`,
        `Generazione interrotta: ${completedImages} immagini completate. Controlla quote e costi prima di continuare. Errore: ${errorCode || 'generazione non riuscita'}`
      ));
    } finally {
      setImageBusy(false);
      setBusy(false);
      busyRef.current = false;
    }
  };

  const filteredConversations = conversations.filter(conversation =>
    conversation.title.toLocaleLowerCase().includes(historySearch.trim().toLocaleLowerCase())
  );
  const selectedDesign = designs.find(design => design.id === selectedDesignId) || null;

  /** 删除只作用于选中的这条 AI 回复；服务端删除由共享操作组件完成后再回调这里。 */
  const removeAssistantMessage = (index: number, messageId?: string) => {
    const target = messages[index];
    if (!target || target.role !== 'assistant') return;
    if (messageId && replyRevealRef.current?.id === messageId) finishReplyReveal(false);
    setMessages(current => messageId
      ? current.filter(message => message.id !== messageId)
      : current.filter((_, currentIndex) => currentIndex !== index));
  };

  const addChatAttachments = async (files: FileList | null) => {
    if (!files?.length) return;
    const selectedFiles = Array.from(files);
    const existingBytes = attachments.reduce((total, item) => total + item.size, 0);
    const newAttachments: ChatAttachment[] = [];
    let totalBytes = existingBytes;
    let imageCount = attachments.filter(item => item.kind === 'image').length;
    let documentCount = attachments.length - imageCount;
    try {
      if (attachments.length + selectedFiles.length > 4) throw new Error('MODAGPT_ATTACHMENT_INVALID');
      for (const file of selectedFiles) {
        const isImage = ['image/jpeg', 'image/png', 'image/webp'].includes(file.type);
        totalBytes += file.size;
        if (totalBytes > 5 * 1024 * 1024) throw new Error('MODAGPT_ATTACHMENT_INVALID');
        if (isImage) imageCount += 1;
        else documentCount += 1;
        if (imageCount > 3 || documentCount > 2) throw new Error('MODAGPT_ATTACHMENT_INVALID');
        newAttachments.push({
          name: file.name,
          dataUrl: await readAttachmentFile(file),
          kind: isImage ? 'image' : 'document',
          size: file.size
        });
      }
      setAttachments(current => [...current, ...newAttachments]);
      setError('');
    } catch (attachmentError) {
      const code = attachmentError instanceof Error ? attachmentError.message : '';
      setError(code === 'MODAGPT_ATTACHMENT_INVALID'
        ? (localizeCopy('可上传最多 3 张图片（JPG、PNG、WebP）和 2 个 PDF/TXT/MD/CSV 文件；单个文件不超过 3MB，总大小不超过 5MB。', 'Allega fino a 3 immagini (JPG, PNG o WebP) e 2 file PDF, TXT, MD o CSV. Massimo 3 MB per file e 5 MB totali.'))
        : (attachmentError instanceof Error ? attachmentError.message : (localizeCopy('读取附件失败，请重试。', 'Lettura allegato non riuscita.'))));
    }
  };

  const toggleVoiceInput = () => {
    if (recordingVoice) {
      speechRecognitionRef.current?.stop();
      return;
    }
    cancelSpeech();
    const speechWindow = window as Window & {
      SpeechRecognition?: SpeechRecognitionConstructor;
      webkitSpeechRecognition?: SpeechRecognitionConstructor;
    };
    const Recognition = speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;
    if (!Recognition) {
      setError(localizeCopy('当前浏览器不支持语音输入，请使用更新版 Safari 或 Chrome 并允许麦克风权限。', 'Questo browser non supporta la dettatura vocale. Prova con Safari o Chrome aggiornato.'));
      return;
    }
    const recognition = new Recognition();
    recognition.lang = getIntlLocale(lang);
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.onresult = event => {
      const transcript = Array.from(event.results)
        .slice(event.resultIndex)
        .filter(result => result.isFinal)
        .map(result => result[0]?.transcript.trim())
        .filter(Boolean)
        .join(' ');
      if (transcript) {
        voiceTurnRef.current = true;
        setQuestion(current => current ? `${current}${/[\s，。！？]$/.test(current) ? '' : ' '}${transcript}` : transcript);
      }
    };
    recognition.onerror = event => {
      setRecordingVoice(false);
      speechRecognitionRef.current = null;
      setError(event.error === 'not-allowed' || event.error === 'service-not-allowed'
        ? (localizeCopy('请在浏览器设置中允许使用麦克风。', 'Consenti l’accesso al microfono nelle impostazioni del browser.'))
        : (localizeCopy("语音识别失败：{{RUDA_ARG_0}}", "Riconoscimento vocale non riuscito: {{RUDA_ARG_0}}", [String(event.error)])));
    };
    recognition.onend = () => {
      setRecordingVoice(false);
      speechRecognitionRef.current = null;
    };
    try {
      speechRecognitionRef.current = recognition;
      recognition.start();
      setRecordingVoice(true);
      setError('');
    } catch (voiceError) {
      speechRecognitionRef.current = null;
      setRecordingVoice(false);
      setError(voiceError instanceof Error ? voiceError.message : (localizeCopy('无法启动语音输入，请检查麦克风权限。', 'Impossibile avviare la dettatura.')));
    }
  };

  const saveDesign = async (message: AssistantMessage, index: number) => {
    if (!message.imageDataUrl || !message.designCategory || message.designId || savingDesignMessage !== null) return;
    const prompt = messages.slice(0, index).reverse().find(item => item.role === 'user')?.content || message.content;
    let clientRequestId = designSaveRequestIdsRef.current.get(message);
    if (!clientRequestId) {
      clientRequestId = crypto.randomUUID();
      designSaveRequestIdsRef.current.set(message, clientRequestId);
    }
    setSavingDesignMessage(message);
    setError('');
    try {
      const result = await apiPost<{ success: true; design: ModaGptDesign }>('/api/merchant/modagpt/designs', {
        title: prompt.slice(0, 160),
        prompt,
        category: message.designCategory,
        imageDataUrl: message.imageDataUrl,
        clientRequestId
      });
      setMessages(current => current.map(item => item === message
        ? { ...item, designId: result.design.id }
        : item));
      setDesignsRefresh(current => current + 1);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : (localizeCopy('作品保存失败，请稍后重试。', 'Impossibile salvare il progetto.')));
    } finally {
      setSavingDesignMessage(null);
    }
  };

  const toggleDesignFavorite = async (design: ModaGptDesign) => {
    setDesignActionId(design.id);
    setDesignNotice('');
    try {
      await apiPatch<{ success: true }>(`/api/merchant/modagpt/designs/${encodeURIComponent(design.id)}/favorite`, {
        isFavorite: !design.isFavorite
      });
      setDesigns(current => current
        .map(item => item.id === design.id ? { ...item, isFavorite: !item.isFavorite } : item)
        .filter(item => designFilter !== 'favorite' || item.isFavorite));
    } catch (actionError) {
      setDesignNotice(actionError instanceof Error ? actionError.message : (localizeCopy('收藏状态更新失败，请重试。', 'Impossibile aggiornare i preferiti.')));
    } finally {
      setDesignActionId(null);
    }
  };

  const deleteDesign = async (design: ModaGptDesign) => {
    const confirmed = window.confirm(localizeCopy('确定永久删除这件作品吗？', 'Eliminare definitivamente questo progetto?'));
    if (!confirmed) return;
    setDesignActionId(design.id);
    setDesignNotice('');
    try {
      await apiDelete<{ success: true }>(`/api/merchant/modagpt/designs/${encodeURIComponent(design.id)}`);
      setDesigns(current => current.filter(item => item.id !== design.id));
      setSelectedDesignId(null);
    } catch (actionError) {
      setDesignNotice(actionError instanceof Error ? actionError.message : (localizeCopy('作品删除失败，请重试。', 'Impossibile eliminare il progetto.')));
    } finally {
      setDesignActionId(null);
    }
  };

  return (
    <ModaCoreStageProvider life={coreLife} state={coreState} levelRef={micLevelRef} pulseRef={speechPulseRef}>
    <main className="relative mx-auto flex h-full min-h-0 w-full max-w-[430px] flex-col overflow-hidden bg-white text-neutral-900 lg:max-w-[880px]">
      {menuOpen && <button type="button" aria-label={localizeCopy('关闭菜单', 'Chiudi menu')} onClick={dismissMenu} className="absolute inset-0 z-30 cursor-default bg-neutral-950/10" />}
      <header className="relative z-40 flex h-14 shrink-0 items-center justify-between border-b border-neutral-200/70 bg-white px-3">
        <button type="button" onClick={onExit} aria-label={localizeCopy('退出聊天', 'Esci dalla chat')} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-neutral-700 hover:bg-neutral-100">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-16">
          <span className="truncate text-sm font-semibold text-neutral-900">
            {activeSection === 'chat'
              ? 'ModaUI'
              : activeSection === 'create'
                ? localizeCopy('创作中心', 'Create')
                : activeSection === 'designs'
                  ? localizeCopy('我的作品', 'Designs')
                  : localizeCopy('店铺知识库', 'Knowledge base del negozio')}
          </span>
        </div>
        <button
          type="button"
          aria-label={localizeCopy('更多操作', 'Altre opzioni')}
          aria-expanded={menuOpen}
          aria-haspopup="menu"
          onClick={() => { setMenuOpen(open => !open); setHistoryOpen(false); setModeSheetOpen(false); setComposerToolsOpen(false); }}
          className="relative z-40 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-neutral-700 hover:bg-neutral-100"
        >
          <MoreVertical className="h-5 w-5" />
        </button>
        {menuOpen && <div
          role="menu"
          aria-label={localizeCopy('更多操作', 'Altre opzioni')}
          onClick={event => event.stopPropagation()}
          className="absolute right-3 top-[calc(100%+4px)] z-50 max-h-[min(calc(100dvh-88px),520px)] w-[min(calc(100vw-24px),236px)] overflow-y-auto overscroll-contain rounded-2xl border border-neutral-200/80 bg-white py-1.5 shadow-[0_16px_40px_rgba(0,0,0,0.12)]"
        >
          <p className="px-3 pb-1 pt-2.5 text-[9px] font-medium tracking-[0.14em] text-neutral-400">{localizeCopy('对话', 'Conversazione')}</p>
          <button type="button" role="menuitem" disabled={busy} onClick={startNewConversation} className="flex min-h-9 w-full items-center gap-2.5 rounded-xl px-3 text-left text-[11px] font-medium text-neutral-700 hover:bg-neutral-100 active:bg-neutral-100 disabled:opacity-40">
            <MessageSquarePlus className="h-4 w-4 shrink-0 text-neutral-500" strokeWidth={1.8} />
            {localizeCopy('新建对话', 'Nuova conversazione')}
          </button>
          <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); setHistoryOpen(true); }} className="flex min-h-9 w-full items-center gap-2.5 rounded-xl px-3 text-left text-[11px] font-medium text-neutral-700 hover:bg-neutral-100 active:bg-neutral-100">
            <History className="h-4 w-4 shrink-0 text-neutral-500" strokeWidth={1.8} />
            {localizeCopy('历史对话', 'Cronologia')}
          </button>
          <button
            type="button"
            role="menuitemcheckbox"
            aria-checked={taskMode}
            disabled={busy}
            onClick={() => {
              setTaskMode(enabled => !enabled);
              setFashionMode(null);
              setModeSheetOpen(false);
              setError('');
              setMenuOpen(false);
            }}
            className="flex min-h-9 w-full items-center gap-2.5 rounded-xl px-3 text-left text-[11px] font-medium text-neutral-700 hover:bg-neutral-100 active:bg-neutral-100 disabled:opacity-40"
          >
            <span aria-hidden="true" className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] border transition ${taskMode ? 'border-neutral-900 bg-neutral-900 text-white' : 'border-neutral-300 bg-white'}`}>
              {taskMode && <Check className="h-3 w-3" strokeWidth={3} />}
            </span>
            {localizeCopy('任务模式', 'Modalità attività')}
            {taskMode && <span className="ml-auto text-[9px] font-medium text-emerald-700">{localizeCopy('已开启', 'Attivo')}</span>}
          </button>
          <div className="mx-3 my-1 h-px bg-neutral-100" />
          <p className="px-3 pb-1 pt-2.5 text-[9px] font-medium tracking-[0.14em] text-neutral-400">{localizeCopy('创作工具', 'Strumenti creativi')}</p>
          <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); setActiveSection('create'); setError(''); }} className="flex min-h-9 w-full items-center gap-2.5 rounded-xl px-3 text-left text-[11px] font-medium text-neutral-700 hover:bg-neutral-100 active:bg-neutral-100">
            <Sparkles className="h-4 w-4 shrink-0 text-neutral-500" strokeWidth={1.8} />
            {localizeCopy('创作中心', 'Create')}
          </button>
          <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); setActiveSection('designs'); setError(''); }} className="flex min-h-9 w-full items-center gap-2.5 rounded-xl px-3 text-left text-[11px] font-medium text-neutral-700 hover:bg-neutral-100 active:bg-neutral-100">
            <Shirt className="h-4 w-4 shrink-0 text-neutral-500" strokeWidth={1.8} />
            {localizeCopy('我的作品', 'I miei contenuti')}
          </button>
          <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); setActiveSection('recolor'); setError(''); }} className="flex min-h-9 w-full items-center gap-2.5 rounded-xl px-3 text-left text-[11px] font-medium text-neutral-700 hover:bg-neutral-100 active:bg-neutral-100">
            <ImagePlus className="h-4 w-4 shrink-0 text-neutral-500" strokeWidth={1.8} />
            {localizeCopy('服装换色', 'Ricolora capo')}
          </button>
          <button
            type="button"
            role="menuitem"
            disabled={!fashionModes.find(mode => mode.id === 'productLaunch')?.available}
            onClick={() => { setMenuOpen(false); activateCreation('productLaunch'); }}
            className="flex min-h-9 w-full items-center gap-2.5 rounded-xl px-3 text-left text-[11px] font-medium text-neutral-700 hover:bg-neutral-100 active:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <UserRound className="h-4 w-4 shrink-0 text-neutral-500" strokeWidth={1.8} />
            {localizeCopy('商业模特', 'Modelli moda')}
          </button>
          <div className="mx-3 my-1 h-px bg-neutral-100" />
          <p className="px-3 pb-1 pt-2.5 text-[9px] font-medium tracking-[0.14em] text-neutral-400">{localizeCopy('其他', 'Altro')}</p>
          <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); setActiveSection('knowledge'); setError(''); }} className="flex min-h-9 w-full items-center gap-2.5 rounded-xl px-3 text-left text-[11px] font-medium text-neutral-700 hover:bg-neutral-100 active:bg-neutral-100">
            <BookOpen className="h-4 w-4 shrink-0 text-neutral-500" strokeWidth={1.8} />
            {localizeCopy('店铺知识库', 'Knowledge base del negozio')}
          </button>
          <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); setPricingOpen(true); }} className="flex min-h-9 w-full items-center gap-2.5 rounded-xl px-3 text-left text-[11px] font-medium text-neutral-700 hover:bg-neutral-100 active:bg-neutral-100">
            <CreditCard className="h-4 w-4 shrink-0 text-neutral-500" strokeWidth={1.8} />
            {localizeCopy('套餐与额度', 'Piani e crediti')}
          </button>
          <div className="mx-3 my-1 h-px bg-neutral-100" />
          <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); logout(); }} className="flex min-h-9 w-full items-center gap-2.5 rounded-xl px-3 text-left text-[11px] font-medium text-neutral-600 hover:bg-neutral-100 hover:text-rose-700 active:bg-neutral-100">
            <LogOut className="h-4 w-4 shrink-0" strokeWidth={1.8} />
            {localizeCopy('退出登录', 'Sign out')}
          </button>
        </div>}

      </header>
      {historyOpen && <div className="absolute inset-0 z-40 bg-neutral-950/35" onClick={() => setHistoryOpen(false)}>
        <aside role="dialog" aria-modal="true" aria-label={localizeCopy('聊天历史', 'Cronologia chat')} onClick={event => event.stopPropagation()} className="flex h-full w-[min(86vw,340px)] flex-col border-r border-neutral-200 bg-[#f7f7f8] p-3 shadow-2xl">
          <div className="flex items-center justify-between px-1 pb-3">
            <span className="text-sm font-semibold">{localizeCopy('聊天历史', 'Cronologia chat')}</span>
            <button type="button" onClick={() => setHistoryOpen(false)} aria-label={localizeCopy('关闭历史', 'Chiudi cronologia')} className="flex h-9 w-9 items-center justify-center rounded-xl hover:bg-neutral-200"><X className="h-4 w-4" /></button>
          </div>
          <button type="button" onClick={startNewConversation} className="flex h-11 items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 text-left text-xs font-semibold hover:bg-neutral-50">
            <MessageSquarePlus className="h-4 w-4" />{localizeCopy('新聊天', 'Nuova conversazione')}
          </button>
          <label className="relative mt-3 block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
            <input value={historySearch} onChange={event => setHistorySearch(event.target.value)} placeholder={localizeCopy('搜索聊天', 'Cerca nelle chat')} className="h-10 w-full rounded-xl border border-neutral-200 bg-white pl-9 pr-3 text-xs outline-none focus:border-neutral-400" />
          </label>
          <p className="px-1 pb-2 pt-4 text-[10px] font-semibold text-neutral-500">{localizeCopy('最近 · 与 Web 商家端同步', 'Recenti · Cronologia condivisa con Web')}</p>
          <div className="min-h-0 flex-1 space-y-1 overflow-y-auto">
            {filteredConversations.map(conversation => <button key={conversation.id} type="button" onClick={() => void selectConversation(conversation.id)} className={`block w-full rounded-xl px-3 py-2.5 text-left hover:bg-white ${conversation.id === conversationId ? 'bg-white shadow-sm' : ''}`}>
              <span className="block truncate text-xs font-medium text-neutral-800">{conversation.title}</span>
              <span className="mt-1 block text-[9px] text-neutral-400">{new Date(conversation.updatedAt).toLocaleString(getIntlLocale(lang), { dateStyle: 'short', timeStyle: 'short' })} · {conversation.messageCount}</span>
            </button>)}
            {!filteredConversations.length && <p className="px-3 py-4 text-[10px] text-neutral-400">{loadingHistory ? (localizeCopy('正在加载…', 'Caricamento…')) : (historySearch ? (localizeCopy('无匹配聊天', 'Nessun risultato.')) : (localizeCopy('暂无聊天记录', 'Nessuna conversazione.')))}</p>}
          </div>
          <div className="border-t border-neutral-200 px-1 pt-3 text-[9px] leading-4 text-neutral-500">{isIt ? 'Le conversazioni sono associate al tuo account commerciante.' : `当前商家：${merchantName || 'RUDA'}`}</div>
        </aside>
      </div>}

      <section className={`min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-4 pt-6 ${activeSection === 'chat' ? 'flex flex-col' : ''}`}>
        {activeSection === 'chat' ? (!messages.length ? (
          <div className="my-auto w-full">
            <div className="modaui-hero relative overflow-hidden rounded-3xl bg-white px-5 py-7 sm:px-7 sm:py-10">
              <div className="relative flex flex-col items-center gap-1.5 lg:flex-row lg:items-center lg:gap-9">
                <div className="flex w-full items-center justify-center lg:w-[48%]">
                  <ModaCoreAnchor
                    kind="hero"
                    className="aspect-square w-[min(56vw,220px)] shrink-0 sm:w-[280px] lg:w-[min(34vw,360px)]"
                  />
                </div>
                <div className="w-full text-center lg:text-left">
                  <h1 className="text-[22px] font-semibold leading-[1.28] tracking-tight text-neutral-950 sm:text-[28px]">
                    <span className="block">{localizeCopy('你好，', 'Ciao,')}</span>
                    <span className="block">{localizeCopy('我是 MODAUI。', 'sono ModaUI.')}</span>
                  </h1>
                  <p className="mx-auto mt-3 max-w-[20rem] text-[12px] leading-5.5 text-neutral-600 lg:mx-0">
                    {localizeCopy('我可以帮你处理商品、订单、库存、数据分析，并提供时尚行业的专业建议。', 'Gestisco prodotti, ordini, magazzino e dati, con consigli dedicati alla moda.')}
                  </p>
                  <div className="mx-auto mt-4 grid w-full max-w-[20rem] grid-cols-2 gap-2 lg:mx-0">
                    {[
                      localizeCopy('帮我查一款商品的库存', 'Controlla le scorte di un prodotto'),
                      localizeCopy('今天有哪些订单需要处理', 'Quali ordini gestire oggi'),
                      localizeCopy('分析最近 30 天的销售情况', 'Analizza le vendite degli ultimi 30 giorni'),
                      localizeCopy('帮我生成新品推广文案', 'Crea il testo promo per un nuovo prodotto')
                    ].map(suggestion => (
                      <button
                        key={suggestion}
                        type="button"
                        onClick={() => void sendQuestion(suggestion)}
                        className="flex h-9 w-full items-center justify-between gap-2 rounded-xl border border-neutral-200 bg-white px-3 text-left text-[11px] font-medium text-neutral-600 transition hover:border-neutral-300 hover:bg-neutral-50 active:bg-neutral-100"
                      >
                        <span className="truncate text-neutral-700">{suggestion}</span>
                        <ArrowRight className="h-3 w-3 shrink-0 text-neutral-400" aria-hidden="true" />
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="mx-auto w-full max-w-2xl space-y-5 py-3" aria-live="polite">
            {messages.map((message, index) => {
              // 只有当前这条助手回复承载粒子小头部；已完成的旧回复不再保留第二个活动核心。
              const isActiveReply = message.role === 'assistant'
                && !messages.slice(index + 1).some(next => next.role === 'assistant');
              return (
              <div key={`${index}-${message.role}`} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={message.role === 'user' ? 'max-w-[88%] rounded-3xl rounded-bl-lg bg-neutral-100 px-4 py-3 text-sm leading-6 text-neutral-900 shadow-[0_1px_2px_rgba(0,0,0,0.04)]' : 'w-full max-w-[94%] text-sm leading-6 text-neutral-800'}>
                  {message.role === 'assistant' &&                   <div className="mb-1 text-[10px] font-medium tracking-[0.06em] text-neutral-500">MODAUI</div>}
                  <div className="break-words">
                    {isActiveReply && <ModaCoreAnchor kind="reply" className="float-left mr-2.5 mt-0.5 h-8 w-8 rounded-full" />}
                    {renderMessageContent(message.content, index)}
                  </div>
                  {message.role === 'assistant' && message.actions?.some(action => assistantActionTargets[action.target]) && <div className="mt-3 flex flex-wrap gap-2">
                    {message.actions.filter(action => assistantActionTargets[action.target]).map(action => {
                      const target = assistantActionTargets[action.target];
                      if (!target) return null;
                      return <button key={action.target} type="button" onClick={() => onNavigate(target)} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-neutral-950 px-3 text-[10px] font-semibold text-white hover:bg-neutral-700">
                        {action.label}<ArrowRight className="h-3 w-3" />
                      </button>;
                    })}
                  </div>}
                  {message.role === 'user' && message.attachments?.length ? <div className="mt-2 flex flex-wrap justify-end gap-2">
                    {message.attachments.map((attachment, attachmentIndex) => attachment.kind === 'image'
                      ? <img key={`${attachment.name}-${attachmentIndex}`} src={attachment.dataUrl} alt={attachment.name} className="h-20 w-20 rounded-xl border border-neutral-200 object-cover" />
                      : <span key={`${attachment.name}-${attachmentIndex}`} className="max-w-48 truncate rounded-xl border border-neutral-200 bg-white px-3 py-2 text-[10px] text-neutral-600"><Paperclip className="mr-1 inline h-3 w-3" />{attachment.name}</span>)}
                  </div> : null}
                  {message.imageDataUrl && <img src={message.imageDataUrl} alt={localizeCopy('ModaUI 生成结果', 'Risultato ModaUI')} className="mt-3 max-h-[65dvh] w-full rounded-2xl border border-neutral-200 object-contain" />}
                  {message.imageDataUrl && <div className="mt-2 flex flex-wrap gap-2">
                    <a href={message.imageDataUrl} download={`modagpt-design-${index + 1}.webp`} className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 px-3 py-1.5 text-[10px] font-semibold text-neutral-600 hover:bg-neutral-50"><Download className="h-3.5 w-3.5" />{localizeCopy('下载图片', 'Scarica immagine')}</a>
                    {message.designCategory && (message.designId
                      ? <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-1.5 text-[10px] font-semibold text-emerald-800"><Check className="h-3.5 w-3.5" />{localizeCopy('已保存到作品库', 'Salvato nei progetti')}</span>
                      : <button type="button" onClick={() => void saveDesign(message, index)} disabled={savingDesignMessage !== null} className="inline-flex items-center gap-1.5 rounded-lg bg-neutral-950 px-3 py-1.5 text-[10px] font-semibold text-white disabled:opacity-50">
                        {savingDesignMessage === message ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <ImagePlus className="h-3.5 w-3.5" />}
                        {savingDesignMessage === message ? (localizeCopy('正在保存…', 'Salvataggio…')) : (localizeCopy('保存到作品库', 'Salva nei progetti'))}
                      </button>)}
                  </div>}
                  {message.role === 'assistant' && (
                    <AssistantReplyActions
                      className="mt-1.5"
                      text={message.content}
                      messageId={message.id}
                      onBeforeDelete={() => { if (message.id && replyRevealRef.current?.id === message.id) finishReplyReveal(false); }}
                      onDeleted={() => removeAssistantMessage(index, message.id)}
                      onError={setError}
                    />
                  )}
                </div>
              </div>
              );
            })}
            {busy && (
              <div role="status" className="flex items-start gap-2 text-[11px] leading-5 text-neutral-500">
                {messages[messages.length - 1]?.role !== 'assistant' && <ModaCoreAnchor kind="reply" className="h-8 w-8 shrink-0" />}
                <span className="flex items-start gap-2 pt-1.5">
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                {fashionMode === 'productLaunch' && productLaunchProgress?.stage === 'copy'
                  ? (localizeCopy('正在撰写商品文案…', 'Creazione descrizione prodotto…'))
                  : imageBusy
                ? fashionMode === 'productLaunch' && productLaunchProgress
                  ? localizeCopy(`正在生成上新图片 ${Math.min(productLaunchProgress.completedImages + 1, productLaunchProgress.totalImages)}/${productLaunchProgress.totalImages}…`, `Generazione immagine ${Math.min(productLaunchProgress.completedImages + 1, productLaunchProgress.totalImages)}/${productLaunchProgress.totalImages}…`)
                  : (localizeCopy('正在生成图片…', 'Creazione immagine…'))
                : (localizeCopy('ModaUI 正在思考…', 'ModaUI sta rispondendo…'))}
                </span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )) : activeSection === 'knowledge' ? (
          <MerchantBrainKnowledge isIt={isIt} />
        ) : activeSection === 'recolor' ? (
          <ModaGptGarmentRecolor
            onBack={() => setActiveSection('create')}
            onSaved={() => setDesignsRefresh(current => current + 1)}
          />
        ) : activeSection === 'create' ? (
              <div className="mx-auto w-full max-w-2xl py-4">
                <div className="mb-5">
                  <h1 className="text-2xl font-bold tracking-tight text-neutral-950">{localizeCopy('创作工具', 'Strumenti creativi')}</h1>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {fashionModes.filter(mode => mode.id !== 'inspiration' && mode.id !== 'generate').map(mode => {
                    const isAvailable = mode.available && fashionModeAvailable(mode.id, entitlements);
                    const lockedByPlan = mode.available
                      && (mode.id === 'generate' || mode.id === 'tryon' || mode.id === 'productLaunch')
                      && entitlements?.plan === 'free';
                    return (
                      <article key={mode.id} className={`flex flex-col rounded-3xl border bg-white p-4 ${selectedCreation === mode.id ? 'border-neutral-900 ring-1 ring-neutral-900 shadow-sm' : 'border-neutral-200'}`}>
                        <button type="button" onClick={() => {
                          setSelectedCreation(mode.id);
                          setQuestion(mode.prompt);
                        }} className="flex w-full items-start gap-3 text-left">
                          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-neutral-50 text-neutral-800"><mode.Icon className="h-5 w-5" /></span>
                          <span className="min-w-0 flex-1">
                            <span className="flex items-center justify-between gap-2">
                              <b className="text-sm font-semibold text-neutral-900">{mode.title}</b>
                              {mode.available
                                ? lockedByPlan
                                  ? <span className="rounded-full bg-amber-50 px-2 py-1 text-[9px] font-semibold text-amber-800">{localizeCopy('需高级版', 'Pro required')}</span>
                                  : <span className="rounded-full bg-emerald-50 px-2 py-1 text-[9px] font-semibold text-emerald-800">{localizeCopy('可使用', 'Disponibile')}</span>
                                : <span className="rounded-full bg-neutral-100 px-2 py-1 text-[9px] font-semibold text-neutral-500">{localizeCopy('后续阶段', 'In sviluppo')}</span>}
                            </span>
                            <span className="mt-1 block text-[10px] leading-4 text-neutral-500">{mode.description}</span>
                          </span>
                        </button>
                        {selectedCreation === mode.id && (
                          <div className="mt-4 flex-1 border-t border-neutral-100 pt-3">
                            {mode.id === 'design' && <label className="mb-3 block text-[10px] font-medium text-neutral-700">
                              {localizeCopy('用一句话描述你的设计', 'Descrivi il tuo design')}
                              <textarea
                                value={fashionDesignNotes}
                                onChange={event => setFashionDesignNotes(event.target.value)}
                                maxLength={350}
                                rows={3}
                                placeholder={localizeCopy('例如：春夏通勤女装，宽松廓形，海盐蓝棉麻，加入不对称门襟。', 'Es. look donna primavera, silhouette morbida, lino blu, chiusura asimmetrica.')}
                                className="mt-1.5 w-full resize-y rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-xs leading-5 text-neutral-800 placeholder:text-neutral-400"
                              />
                            </label>}
                            {mode.id === 'generate' && <div className="mb-3 flex flex-wrap gap-2 text-[10px] leading-4 text-neutral-500"><span>描述款式 · 材质 · 颜色</span><span>构图 · 背景</span><span>按配置生成图片</span></div>}
                            {mode.id === 'tryon' && <div className="mb-3 flex flex-wrap gap-2 text-[10px] leading-4 text-neutral-500"><span>上传图片并授权</span><span>不读取文字指令</span></div>}
                            {mode.id === 'productLaunch' && <div className="mb-3 flex flex-wrap gap-2 text-[10px] leading-4 text-neutral-500"><span>描述模特与场景</span><span>不读取商品参考图</span><span>结果需核验</span></div>}
                            {mode.id === 'edit' && <div className="mb-3 flex flex-wrap gap-2 text-[10px] leading-4 text-neutral-500"><span>涂选衣物后选色</span><span>自动识别未接入</span></div>}
                            {mode.id === 'fashionVideo' && <div className="mb-3 flex flex-wrap gap-2 text-[10px] leading-4 text-neutral-500"><span>视频服务未接入</span><span>不会提交或扣费</span></div>}
                            <button
                              type="button"
                              disabled={!isAvailable}
                              onClick={() => {
                                if (!isAvailable) return;
                                if (mode.id === 'edit') {
                                  setActiveSection('recolor');
                                  return;
                                }
                                activateCreation(
                                  mode.id,
                                  true,
                                  mode.id === 'design' ? buildFashionDesignPrompt() : undefined
                                );
                              }}
                              className="min-h-10 w-full rounded-xl bg-neutral-950 px-4 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:bg-neutral-200 disabled:text-neutral-500"
                            >
                              {!mode.available
                                ? (localizeCopy('暂未开放', 'Non ancora disponibile'))
                                : lockedByPlan
                                  ? (localizeCopy('需要高级版 · 查看方案', 'Upgrade richiesto · vedi piani'))
                                  : mode.id === 'edit'
                                    ? (localizeCopy('打开局部换色工具', 'Apri lo strumento recolor'))
                                    : (localizeCopy('进入 ModaUI 工作区', 'Apri ModaUI'))}
                            </button>
                            {lockedByPlan && <button type="button" onClick={() => setPricingOpen(true)} className="mt-2 w-full py-1 text-[10px] font-semibold text-neutral-600">{localizeCopy('查看套餐方案', 'Visualizza i piani')}</button>}
                          </div>
                        )}
                      </article>
                    );
                  })}
                </div>
                <button type="button" onClick={() => activateCreation('inspiration')} className="mt-3 flex min-h-12 w-full items-center gap-3 rounded-2xl border border-neutral-200 bg-white px-4 text-left text-xs font-semibold text-neutral-800">
                  <Lightbulb className="h-4 w-4 text-amber-600" />{localizeCopy('打开设计灵感助手', 'Apri l’assistente di ispirazione')}<span className="ml-auto text-neutral-400">→</span>
                </button>
              </div>
            ) : (
              <div className="mx-auto min-h-full w-full max-w-2xl py-4">
                {selectedDesign ? (
                  <div>
                    <button type="button" onClick={() => setSelectedDesignId(null)} className="mb-3 inline-flex min-h-9 items-center gap-1 rounded-lg px-2 text-xs font-semibold text-neutral-600 hover:bg-neutral-100"><ArrowLeft className="h-4 w-4" />{localizeCopy('返回作品库', 'Portfolio')}</button>
                    <img src={selectedDesign.imageUrl} alt={selectedDesign.title} className="max-h-[55dvh] w-full rounded-2xl border border-neutral-200 bg-neutral-50 object-contain" />
                    <h1 className="mt-4 text-base font-bold text-neutral-950">{selectedDesign.title}</h1>
                    <p className="mt-1 text-[10px] text-neutral-500">{new Date(selectedDesign.createdAt).toLocaleString(getIntlLocale(lang))} · {selectedDesign.imageWidth} × {selectedDesign.imageHeight}</p>
                    <p className="mt-3 whitespace-pre-wrap rounded-xl bg-neutral-50 p-3 text-xs leading-5 text-neutral-700">{selectedDesign.prompt}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <a href={`/api/merchant/modagpt/designs/${encodeURIComponent(selectedDesign.id)}/image?download=1`} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-neutral-950 px-3 text-xs font-semibold text-white"><Download className="h-4 w-4" />{localizeCopy('下载作品', 'Scarica')}</a>
                      <button type="button" onClick={() => void toggleDesignFavorite(selectedDesign)} disabled={designActionId === selectedDesign.id} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-neutral-200 px-3 text-xs font-semibold text-neutral-700 disabled:opacity-50"><Heart className={`h-4 w-4 ${selectedDesign.isFavorite ? 'fill-rose-500 text-rose-500' : ''}`} />{selectedDesign.isFavorite ? (localizeCopy('取消收藏', 'Rimuovi dai preferiti')) : (localizeCopy('收藏', 'Preferiti'))}</button>
                      <button type="button" onClick={() => void deleteDesign(selectedDesign)} disabled={designActionId === selectedDesign.id} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-rose-200 px-3 text-xs font-semibold text-rose-700 disabled:opacity-50"><Trash2 className="h-4 w-4" />{localizeCopy('删除', 'Elimina')}</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between">
                      <div>
                        <h1 className="text-lg font-bold text-neutral-950">{localizeCopy('我的 ModaUI 作品', 'Il tuo portfolio moda')}</h1>
                        <p className="mt-1 text-[10px] text-neutral-500">{localizeCopy('仅当前商家可见', 'Visibile solo al tuo negozio')}</p>
                      </div>
                      <button type="button" aria-label={localizeCopy('刷新作品', 'Aggiorna portfolio')} onClick={() => setDesignsRefresh(current => current + 1)} className="flex h-9 w-9 items-center justify-center rounded-xl border border-neutral-200 text-neutral-600 hover:bg-neutral-50"><RefreshCw className={`h-4 w-4 ${designsLoading ? 'animate-spin' : ''}`} /></button>
                    </div>
                    <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
                      {(['all', 'imageGeneration', 'tryOn', 'favorite'] as const).map(filter => (
                        <button key={filter} type="button" onClick={() => { setDesignFilter(filter); setSelectedDesignId(null); }} className={`shrink-0 rounded-full px-3 py-2 text-[10px] font-semibold ${designFilter === filter ? 'bg-neutral-950 text-white' : 'border border-neutral-200 text-neutral-600'}`}>
                          {filter === 'all' ? (localizeCopy('全部', 'Tutti')) : filter === 'imageGeneration' ? (localizeCopy('图片', 'Immagini')) : filter === 'tryOn' ? (localizeCopy('换衣', 'Try-On')) : (localizeCopy('收藏', 'Preferiti'))}
                        </button>
                      ))}
                    </div>
                    {designNotice && <p role="alert" className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-[10px] text-rose-800">{designNotice}</p>}
                    {designsLoading ? (
                      <div className="flex min-h-48 items-center justify-center text-xs text-neutral-500"><RefreshCw className="mr-2 h-4 w-4 animate-spin" />{localizeCopy('正在加载作品…', 'Caricamento…')}</div>
                    ) : designs.length ? (
                      <div className="mt-3 grid grid-cols-2 gap-3">
                        {designs.map(design => (
                          <button key={design.id} type="button" onClick={() => setSelectedDesignId(design.id)} className="group overflow-hidden rounded-2xl border border-neutral-200 bg-white text-left">
                            <span className="relative block aspect-[4/5] bg-neutral-50">
                              <img src={design.imageUrl} alt={design.title} loading="lazy" className="h-full w-full object-cover transition group-hover:scale-[1.02]" />
                              <span className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-white/90 shadow-sm"><Heart className={`h-3.5 w-3.5 ${design.isFavorite ? 'fill-rose-500 text-rose-500' : 'text-neutral-400'}`} /></span>
                            </span>
                            <span className="block truncate px-3 pt-2 text-[11px] font-semibold text-neutral-800">{design.title}</span>
                            <span className="block px-3 pb-3 pt-1 text-[9px] text-neutral-500">{design.category === 'tryOn' ? (localizeCopy('AI 换衣', 'AI Try-On')) : (localizeCopy('AI 图片设计', 'Image design'))} · {new Date(design.createdAt).toLocaleDateString(getIntlLocale(lang))}</span>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="flex min-h-64 flex-col items-center justify-center px-5 text-center">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-neutral-100 text-neutral-600"><ImagePlus className="h-5 w-5" /></div>
                        <p className="mt-3 text-sm font-semibold text-neutral-900">{localizeCopy('还没有保存的作品', 'Nessun progetto salvato')}</p>
                        <p className="mt-1 max-w-xs text-[10px] leading-4 text-neutral-500">{localizeCopy('生成图片后，点击“保存到作品库”即可在这里查看、收藏或下载。', 'Dopo aver generato un’immagine, tocca “Salva nei progetti” per conservarla qui.')}</p>
                        <button type="button" onClick={() => setActiveSection('create')} className="mt-4 rounded-xl bg-neutral-950 px-4 py-2.5 text-xs font-semibold text-white">{localizeCopy('去创作中心', 'Esplora Create')}</button>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
      </section>

      {taskPreview && (
        <div className="absolute inset-0 z-[46] flex items-end bg-neutral-950/25" onClick={() => setTaskPreview(null)}>
          <section
            role="dialog"
            aria-modal="true"
            aria-label="ModaUI 任务预览"
            onClick={event => event.stopPropagation()}
            className="w-full rounded-t-2xl border-t border-neutral-200 bg-white px-4 pt-3 shadow-[0_-12px_36px_rgba(0,0,0,0.14)]"
            style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
          >
            <div className="mx-auto mb-2 h-1 w-9 rounded-full bg-neutral-200" />
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[12px] font-semibold text-neutral-900">执行前预览 · {taskPreview.workflow}</p>
                <p className="mt-1 text-[11px] leading-5 text-neutral-600">{taskPreview.summary}</p>
              </div>
              <button type="button" aria-label="取消任务预览" onClick={() => setTaskPreview(null)} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-neutral-500 hover:bg-neutral-100"><X className="h-4 w-4" /></button>
            </div>
            <p className="mt-3 max-h-32 overflow-y-auto whitespace-pre-wrap rounded-xl bg-neutral-50 p-3 text-[11px] leading-5 text-neutral-700">{taskPreview.message}</p>
            <p className="mt-2 text-[10px] leading-4 text-neutral-500">{taskPreview.sideEffects}</p>
            <p className="mt-1 text-[9px] text-neutral-400">工具：{taskPreview.tools.join(' · ') || '无'} · 角色：{taskPreview.agents.join(' · ')}</p>
            {taskPreview.requiresApprovalForSensitiveActions && <p className="mt-1 text-[9px] font-medium text-amber-700">敏感操作需审批</p>}
            <div className="mt-3 flex gap-2">
              <button type="button" onClick={() => setTaskPreview(null)} className="h-10 flex-1 rounded-xl border border-neutral-200 text-[11px] font-medium text-neutral-700 active:bg-neutral-50">取消</button>
              <button type="button" disabled={busy} onClick={() => void confirmTask()} className="h-10 flex-[1.4] rounded-xl bg-neutral-950 text-[11px] font-semibold text-white disabled:opacity-40">{busy ? '提交中…' : '确认并提交任务'}</button>
            </div>
          </section>
        </div>
      )}

      {modeSheetOpen && fashionMode && (
        <div className="absolute inset-0 z-[45] flex items-end bg-neutral-950/25" onClick={closeModeSheet}>
          <section
            role="dialog"
            aria-modal="true"
            aria-label={localizeCopy('创作设置', 'Impostazioni creazione')}
            onClick={event => event.stopPropagation()}
            className="max-h-[78%] w-full overflow-y-auto overscroll-contain rounded-t-2xl border-t border-neutral-200 bg-white px-4 pt-3 shadow-[0_-12px_36px_rgba(0,0,0,0.14)]"
            style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
          >
            <div className="mx-auto mb-2 h-1 w-9 rounded-full bg-neutral-200" />
            <div className="mb-3 flex items-center gap-2">
              <span className="text-[12px] font-semibold text-neutral-900">{activeModeTitle}</span>
              <span className="truncate text-[10px] text-neutral-400">
                {fashionMode === 'design' && entitlements ? `${entitlements.remaining.imageGeneration}/${entitlements.quotas.imageGeneration}` : ''}
                {fashionMode === 'tryon' && entitlements ? `${entitlements.remaining.tryOn}/${entitlements.quotas.tryOn}` : ''}
                {fashionMode === 'productLaunch' && entitlements ? `${entitlements.remaining.imageGeneration}/${entitlements.quotas.imageGeneration} ${localizeCopy('图片', 'immagini')}` : ''}
              </span>
              <button type="button" onClick={closeModeSheet} className="ml-auto h-8 rounded-full bg-neutral-100 px-3 text-[10px] font-semibold text-neutral-700 active:bg-neutral-200">{localizeCopy('完成', 'Fatto')}</button>
            </div>


            {fashionMode === 'design' && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <label className="flex shrink-0 items-center gap-2 text-[10px] font-medium text-neutral-600">
                    <span>{localizeCopy('张数', 'Numero')}</span>
                    <select value={designCandidateCount} disabled={busy} onChange={event => setDesignCandidateCount(Number(event.target.value))} className="h-10 rounded-xl border border-neutral-200 bg-white px-2 text-[11px]">
                      {[2, 3, 4].map(count => <option key={count} value={count}>{count}</option>)}
                    </select>
                  </label>
                  <button type="button" disabled={busy || !entitlements?.capabilities.imageGeneration} onClick={() => void generateDesignCandidates()} className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-neutral-950 px-3 text-[11px] font-semibold text-white disabled:cursor-not-allowed disabled:bg-neutral-300">
                    {imageBusy ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <ImagePlus className="h-3.5 w-3.5" />}
                    {imageBusy && designGenerationProgress
                      ? localizeCopy(`生成中 ${designGenerationProgress.completed}/${designGenerationProgress.total}`, `Generazione ${designGenerationProgress.completed}/${designGenerationProgress.total}`)
                      : localizeCopy('生成设计候选图', 'Genera candidati')}
                  </button>
                </div>
                {entitlements && <p className="text-[9px] text-neutral-400">{localizeCopy(`图片额度 ${entitlements.remaining.imageGeneration} 次`, `Quote immagini: ${entitlements.remaining.imageGeneration}`)}{entitlements.billing.active ? ` · ${entitlements.billing.creditBalance} Credits` : ''}</p>}
              </div>
            )}

            {fashionMode === 'productLaunch' && (
              <div className="flex items-center justify-between gap-3 rounded-xl bg-neutral-50 px-3 py-2.5">
                <label className="flex items-center gap-2 text-[10px] font-medium text-neutral-600">
                  {localizeCopy('候选图', 'Immagini')}
                  <select value={productLaunchImageCount} disabled={busy} onChange={event => setProductLaunchImageCount(Number(event.target.value))} className="h-9 rounded-xl border border-neutral-200 bg-white px-2 text-[11px] disabled:opacity-50">
                    {[1, 2, 3, 4].map(count => <option key={count} value={count}>{count}</option>)}
                  </select>
                </label>
                <span className="text-[9px] leading-4 text-neutral-400">{localizeCopy('不自动发布商品', 'Nessuna pubblicazione automatica')}</span>
              </div>
            )}

            {entitlements?.plan === 'free' && (fashionMode === 'tryon' || fashionMode === 'productLaunch') && (
              <button type="button" onClick={() => { closeModeSheet(); setPricingOpen(true); }} className="mt-2 flex w-full items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-left text-[10px] text-amber-900 active:bg-amber-100">
                <span className="font-semibold">{localizeCopy('需 ModaUI Pro', 'Richiede ModaUI Pro')}</span>
                <span className="ml-auto text-amber-700">{localizeCopy('查看套餐', 'Vedi piani')} →</span>
              </button>
            )}

            {fashionMode === 'tryon' && (
              <div className="space-y-2">
                <input ref={personImageInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={event => {
                  const file = event.target.files?.[0];
                  if (!file) return;
                  void readImageFile(file).then(setPersonImage).catch(fileError => setError(fileError instanceof Error ? fileError.message : '读取人物图片失败。'));
                  event.currentTarget.value = '';
                }} />
                <input ref={garmentImageInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={event => {
                  const file = event.target.files?.[0];
                  if (!file) return;
                  void readImageFile(file).then(setGarmentImage).catch(fileError => setError(fileError instanceof Error ? fileError.message : '读取服装图片失败。'));
                  event.currentTarget.value = '';
                }} />
                <div className="flex gap-2">
                  <button type="button" onClick={() => personImageInputRef.current?.click()} className="flex h-10 flex-1 items-center justify-center gap-2 rounded-xl border border-neutral-200 text-[10px] font-semibold text-neutral-700 active:bg-neutral-50">
                    <UserRound className="h-4 w-4" />{personImage ? (localizeCopy('已选人物照', 'Persona caricata')) : (localizeCopy('人物照片', 'Foto persona'))}
                  </button>
                  <button type="button" onClick={() => garmentImageInputRef.current?.click()} className="flex h-10 flex-1 items-center justify-center gap-2 rounded-xl border border-neutral-200 text-[10px] font-semibold text-neutral-700 active:bg-neutral-50">
                    <Shirt className="h-4 w-4" />{garmentImage ? (localizeCopy('已选服装', 'Capo caricato')) : (localizeCopy('服装图片', 'Foto capo'))}
                  </button>
                </div>
                {(personImage || garmentImage) && <div className="flex gap-2">
                  {personImage && <img src={personImage} alt={localizeCopy('已选人物照片', 'Persona selezionata')} className="h-14 w-14 rounded-lg border border-neutral-200 object-cover" />}
                  {garmentImage && <img src={garmentImage} alt={localizeCopy('已选服装照片', 'Capo selezionato')} className="h-14 w-14 rounded-lg border border-neutral-200 object-cover" />}
                </div>}
                <select
                  value={tryOnCategory}
                  onChange={event => setTryOnCategory(event.target.value as 'tops' | 'bottoms' | 'one-pieces')}
                  aria-label={localizeCopy('服装类别', 'Categoria del capo')}
                  className="h-10 w-full rounded-xl border border-neutral-200 bg-white px-3 text-[11px] text-neutral-700"
                >
                  <option value="tops">{localizeCopy('上装、衬衫和外套', 'Top, camicie e giacche')}</option>
                  <option value="bottoms">{localizeCopy('裤装和裙装', 'Pantaloni e gonne')}</option>
                  <option value="one-pieces">{localizeCopy('连衣裙和连体服', 'Abiti interi e tute')}</option>
                </select>
                <label className="flex items-start gap-2 rounded-xl bg-neutral-50 p-2.5 text-[9px] leading-4 text-neutral-600">
                  <input type="checkbox" checked={privacyConsent} onChange={event => setPrivacyConsent(event.target.checked)} className="mt-0.5 accent-neutral-900" />
                  <span>{localizeCopy('我同意将所选人物照和服装图发送到 Fal 服务商服务器进行 AI 换衣。请只上传已获授权的图片，不要上传其他敏感信息。', 'Acconsento all’invio delle immagini a Fal per il try-on. Carica solo immagini che sei autorizzato a usare e non includere dati o foto sensibili.')}</span>
                </label>
                <p className="text-[9px] leading-4 text-neutral-400">{localizeCopy('图片副本一天后过期；不处理文字风格指令。', 'Le copie scadono dopo un giorno; le istruzioni di stile testuali non vengono applicate.')}</p>
              </div>
            )}

            {modeQuickPrompts.length > 0 && (
              <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1">
                {modeQuickPrompts.map(prompt => <button key={prompt} type="button" onClick={() => { setQuestion(current => current ? `${current}，${prompt}` : prompt); closeModeSheet(); }} className="h-7 shrink-0 rounded-full border border-neutral-200 px-3 text-[10px] text-neutral-600 active:bg-neutral-50">{prompt}</button>)}
              </div>
            )}

            <button type="button" onClick={exitCreationMode} disabled={busy} className="mt-3 h-9 w-full rounded-xl border border-neutral-200 text-[10px] font-medium text-neutral-500 active:bg-neutral-50 disabled:opacity-40">{localizeCopy('退出该模式', 'Esci dalla modalità')}</button>
          </section>
        </div>
      )}



      {activeSection === 'chat' && <footer className="relative z-10 shrink-0 bg-white px-3 pt-2 sm:px-4" style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}>
        {error && (
          <div role="alert" className="mb-2 rounded-xl bg-rose-50 px-3 py-2 text-[10px] leading-4 text-rose-800">
            <p>{error}</p>
            {productLaunchRecovery && <button
              type="button"
              onClick={() => void resumeProductLaunchImages()}
              disabled={busy}
              className="mt-2 rounded-lg border border-rose-200 bg-white px-3 py-1.5 font-semibold text-rose-900 disabled:opacity-50"
            >{localizeCopy(`只补生成剩余 ${productLaunchRecovery.totalImages - productLaunchRecovery.nextImageIndex} 张图片`, `Genera solo le ${productLaunchRecovery.totalImages - productLaunchRecovery.nextImageIndex} immagini mancanti`)}</button>}
          </div>
        )}
        <div className="ruda-ai-suggestions mx-auto mb-2 flex w-full max-w-2xl items-center gap-1.5">
          {fashionModes.filter(mode => ['design', 'generate', 'tryon', 'inspiration'].includes(mode.id)).map(({ id, title, Icon }) => {
            const selected = fashionMode === id;
            return (
              <button
                key={id}
                type="button"
                aria-label={title}
                aria-pressed={selected}
                onClick={() => selectCreationMode(id)}
                className={`inline-flex h-8 min-w-0 flex-1 items-center justify-center gap-1 rounded-full border px-1 text-[10px] font-medium transition active:scale-[0.98] ${selected ? 'border-neutral-900 bg-neutral-900 text-white' : 'border-neutral-200 bg-white text-neutral-700 shadow-[0_1px_2px_rgba(0,0,0,0.025)] hover:border-neutral-300 hover:bg-neutral-50'}`}
              >
                {!modeHasSettings && <Icon className={`h-3 w-3 shrink-0 ${selected ? 'text-white/80' : 'text-neutral-500'}`} strokeWidth={1.8} aria-hidden="true" />}
                <span className="truncate">{title}</span>
              </button>
            );
          })}
          {modeHasSettings && <button
            type="button"
            aria-label={localizeCopy('创作设置', 'Impostazioni creazione')}
            aria-expanded={modeSheetOpen}
            onClick={() => setModeSheetOpen(open => !open)}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-neutral-900 text-white transition active:scale-95"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" strokeWidth={1.9} />
          </button>}
        </div>
        {composerToolsOpen && <div className="absolute inset-x-3 bottom-[calc(100%-2px)] z-30 mx-auto grid w-auto max-w-2xl grid-cols-2 gap-1 rounded-2xl border border-neutral-200/80 bg-white p-1.5 shadow-[0_16px_40px_rgba(0,0,0,0.12)] sm:inset-x-4">
          {fashionModes.filter(mode => mode.id !== 'edit').map(({ id, title, Icon }) => <button key={id} type="button" onClick={() => {
            activateCreation(id);
            setComposerToolsOpen(false);
          }} className="flex min-h-11 items-center gap-2 rounded-xl px-2.5 text-left text-[11px] font-semibold text-neutral-700 hover:bg-neutral-50">
            <Icon className="h-4 w-4 shrink-0 text-neutral-500" />{title}
          </button>)}
          <button type="button" onClick={() => {
            chatAttachmentInputRef.current?.click();
            setComposerToolsOpen(false);
          }} className="flex min-h-11 items-center gap-2 rounded-xl px-2.5 text-left text-[11px] font-medium text-neutral-700 hover:bg-neutral-50">
            <Paperclip className="h-4 w-4" />{localizeCopy('上传图片或文件', 'Allega immagini o file')}
          </button>
        </div>}
        {fashionMode !== 'generate' && fashionMode !== 'tryon' && <input
          ref={chatAttachmentInputRef}
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp,application/pdf,text/plain,text/markdown,text/csv,.pdf,.txt,.md,.csv"
          className="hidden"
          onChange={event => {
            void addChatAttachments(event.currentTarget.files);
            event.currentTarget.value = '';
          }}
        />}
        {attachments.length > 0 && <div className="mx-auto mb-2 flex w-full max-w-2xl flex-wrap gap-1.5">
          {attachments.map((attachment, index) => <span key={`${attachment.name}-${index}`} className="relative flex items-center gap-1.5 rounded-xl border border-neutral-200 bg-white p-1.5 pr-7 text-[10px] text-neutral-600">
            {attachment.kind === 'image'
              ? <img src={attachment.dataUrl} alt="" className="h-8 w-8 rounded-lg object-cover" />
              : <Paperclip className="ml-1 h-3.5 w-3.5" />}
            <span className="max-w-32 truncate">{attachment.name}</span>
            <button type="button" aria-label={localizeCopy("移除 {{RUDA_ARG_0}}", "Rimuovi {{RUDA_ARG_0}}", [String(attachment.name)])} onClick={() => setAttachments(current => current.filter((_, currentIndex) => currentIndex !== index))} className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-md text-neutral-400 hover:bg-neutral-100 hover:text-neutral-800"><X className="h-3 w-3" /></button>
          </span>)}
        </div>}
        {taskMode && <div className="mx-auto mb-1.5 flex w-full max-w-2xl items-center justify-end">
          <button
            type="button"
            onClick={() => setTaskMode(false)}
            aria-label={localizeCopy('关闭任务模式', 'Disattiva modalità attività')}
            className="inline-flex h-6 items-center gap-1 rounded-full border border-neutral-200 bg-white pl-2 pr-1.5 text-[9px] font-medium text-neutral-700 active:bg-neutral-50"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" aria-hidden="true" />
            {localizeCopy('任务模式', 'Modalità attività')}
            <X className="h-3 w-3 text-neutral-400" />
          </button>
        </div>}
        <form
          onSubmit={event => {
            event.preventDefault();
            void sendQuestion();
          }}
          className="ruda-ai-composer mx-auto flex w-full max-w-2xl items-end gap-2 rounded-3xl border border-neutral-200 bg-white p-2 shadow-[0_3px_18px_rgba(0,0,0,0.055)] transition-shadow focus-within:border-neutral-300 focus-within:shadow-[0_4px_22px_rgba(0,0,0,0.08)]"
        >
          <button type="button" aria-label={localizeCopy('创作工具', 'Strumenti creativi')} aria-expanded={composerToolsOpen} onClick={() => setComposerToolsOpen(open => !open)} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-neutral-500 hover:bg-neutral-50 hover:text-neutral-700 transition"><Plus className="h-4.5 w-4.5" /></button>
          <textarea
            value={question}
            onChange={event => {
              if (questionTypingTimerRef.current !== null) {
                window.clearInterval(questionTypingTimerRef.current);
                questionTypingTimerRef.current = null;
              }
              setQuestion(event.target.value);
              if (!messages.length) coreLife.emit({ type: 'input:change', length: event.target.value.length });
            }}
            onKeyDown={event => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                void sendQuestion();
              }
            }}
            onFocus={() => {
              handleComposerFocus();
              if (!messages.length) coreLife.emit({ type: 'input:focus' });
            }}
            onBlur={() => coreLife.emit({ type: 'input:blur' })}
            maxLength={500}
            rows={1}
            aria-label={localizeCopy('发送消息给 ModaUI', 'Messaggio per ModaUI')}
            placeholder={isIt
              ? taskMode ? 'Descrivi l’attività da eseguire…'
                : fashionMode === 'productLaunch' ? 'Descrivi modello, scena e stile…' : fashionMode === 'design' ? 'Descrivi il capo…' : 'Scrivi…'
              : taskMode ? '描述要执行的任务…'
                : fashionMode === 'productLaunch' ? '描述商品、模特、场景、灯光与摄影风格…'
                  : fashionMode === 'tryon' ? '描述你想试穿的服装…'
                    : fashionMode === 'generate' ? '描述你想生成的服装图…'
                      : fashionMode === 'design' ? '描述设计…' : '发消息…'}
            className="max-h-32 min-h-10 flex-1 resize-none border-0 bg-transparent px-2 py-1.5 text-[13px] leading-5 text-neutral-900 outline-none placeholder:text-neutral-400 focus:ring-0 sm:text-[14px]"
          />
          {fashionMode !== 'generate' && fashionMode !== 'tryon' && <button type="button" onClick={toggleVoiceInput} aria-label={recordingVoice ? (localizeCopy('停止语音输入', 'Interrompi dettatura')) : (localizeCopy('语音输入', 'Dettatura vocale'))} aria-pressed={recordingVoice} className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition ${recordingVoice ? 'bg-rose-50 text-rose-700' : 'text-neutral-500 hover:bg-neutral-50 hover:text-neutral-700'}`}><Mic className="h-4 w-4" /></button>}
          <button
            type="submit"
            aria-label={localizeCopy('发送消息', 'Invia messaggio')}
            disabled={busy || (!question.trim() && attachments.length === 0)}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-neutral-950 text-white transition active:scale-95 hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-35"
          >
            {busy ? <RefreshCw className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" />}
          </button>
        </form>
        {bottomNavigation && (
          <button
            type="button"
            aria-label={bottomNavigation.open ? localizeCopy('收起商家导航', 'Chiudi navigazione') : localizeCopy('展开商家导航', 'Apri navigazione')}
            aria-expanded={bottomNavigation.open}
            aria-controls="merchant-bottom-navigation"
            onClick={handleNavigationClick}
            onPointerDown={handleNavigationPointerDown}
            onPointerUp={handleNavigationPointerUp}
            onPointerCancel={handleNavigationPointerCancel}
            className="mx-auto mt-0.5 flex h-10 w-24 touch-none select-none items-center justify-center rounded-full"
            style={{ touchAction: 'none' }}
          >
            <span className={`h-[3px] rounded-full transition-[width,background-color] duration-200 ${bottomNavigation.open ? 'w-7 bg-neutral-500' : 'w-8 bg-neutral-300'}`} />
          </button>
        )}
      </footer>}
      {pricingOpen && (
        <ModaGptPricingSheet
          isIt={isIt}
          currentPlan={entitlements?.plan || 'free'}
          onClose={() => setPricingOpen(false)}
        />
      )}
    </main>
    </ModaCoreStageProvider>
  );
};
