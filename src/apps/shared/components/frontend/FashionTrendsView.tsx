import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowUpRight, Bookmark, Camera, ChevronDown, Download, Flag, Heart, Home, Languages, Link2, LoaderCircle, MapPin, MessageCircle, MoreVertical, Pause, Play, Plus, RotateCcw, Search, Share2, ShoppingBag, Sparkles, Tag, UserRound, UserRoundPlus, Video, Volume2, VolumeX, X } from 'lucide-react';
import { useB2B } from '../../../../context/B2BContext';
import { ApiError, apiDelete, apiGet, apiPatch, apiPost, apiPostWithUploadProgress } from '../../../../api/client';
import { getFeedWindowBounds } from '../../../../utils/feedWindow';
import { alternateFashionMedia, buildFashionGalleryLayout } from '../../../../utils/fashionFeedOrder';
import { parseFashionDismissedItems, parseFashionTasteProfile, rankFashionItems, updateFashionDismissedItems, updateFashionTaste, type FashionTasteProfile, type FashionTasteSignal } from '../../../../utils/fashionTaste';
import { getIntlLocale } from '../../../../i18n/translations';


// Hero backdrop ships with the product. Editorial posts are read from the fashion
// API only: the Web client no longer injects hard-coded posts into the feed.
const fashionHeroImage = '/fashion/imgi_59_00016-prada-fall-2023-ready-to-w.jpg';

const trendTags = [
  { zh: '女装趋势', it: 'Moda donna' },
  { zh: '男装趋势', it: 'Moda uomo' },
  { zh: '鞋履趋势', it: 'Calzature' },
  { zh: '包袋配饰', it: 'Borse e accessori' },
  { zh: '面料与针织', it: 'Tessuti e maglieria' },
  { zh: '秀场街拍', it: 'Sfilate e street style' }
];
const fashionCategories = trendTags.map(tag => tag.zh);
const fashionCities = ['Prato', 'Milano', 'Firenze', 'Roma', 'Torino', 'Bologna', 'Venezia', 'Napoli'] as const;
// Canonical season vocabulary shared with the server and the mini program.
const fashionSeasons = ['春季', '夏季', '秋季', '冬季'] as const;
const getFashionCategory = (category?: string, ...content: string[]) => {
  if (category && fashionCategories.includes(category)) return category;
  const text = content.join(' ').toLocaleLowerCase();
  return trendTags.find(tag => text.includes(tag.zh.toLocaleLowerCase()))?.zh;
};
const postPageSize = 12;
const maximumUploadSize = 2_200_000;
const maximumVideoSize = 20 * 1024 * 1024;
const maximumVideoDurationSeconds = 180;
const feedRailButtonClass = 'group flex flex-col items-center gap-1 rounded-full transition duration-200 ease-out hover:-translate-y-0.5 hover:scale-105 active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80 motion-reduce:transform-none motion-reduce:transition-none disabled:opacity-60';
const feedRailIconClass = 'transition duration-200 ease-out group-hover:scale-110 group-active:scale-75 motion-reduce:transform-none motion-reduce:transition-none';

type FashionProductCard = {
  id: string;
  styleNo: string;
  name: string;
  nameEn: string;
  brand: string;
  category: string;
  image: string;
  retailPrice: number;
  currency: string;
  availability: string;
  merchant: { id: string; name: string; slug: string | null; city: string | null; verified: boolean } | null;
};

type FashionPost = {
  id: string;
  image: string | null;
  title: string;
  text: string;
  createdAt: string;
  mediaType: 'image' | 'video' | 'mixed';
  videoUrl: string | null;
  mediaItems?: Array<{ type: 'image' | 'video'; url: string; posterUrl?: string }>;
  hashtags?: string[];
  category?: string;
  city?: string;
  season?: string;
  creatorAccountId?: string;
  creatorName?: string;
  viewsCount?: number;
  savedAt?: string;
  products?: FashionProductCard[];
};

type FashionNotificationItem = {
  id: string;
  type: string;
  actorName: string;
  actorAccountId: string | null;
  postId: string | null;
  postImage: string | null;
  commentId: string | null;
  preview: string | null;
  read: boolean;
  createdAt: string;
};

type FashionConnectionItem = {
  id: string;
  displayName: string;
  bio: string | null;
  avatarUrl: string | null;
  following: boolean;
  isSelf: boolean;
};

type FashionDraftMedia = { type: 'image' | 'video'; url?: string; posterUrl?: string; uploadToken?: string; posterToken?: string };

type FashionDraftItem = {
  id: string;
  title: string;
  caption: string;
  hashtags: string[];
  category: string | null;
  city: string | null;
  season?: string | null;
  mediaItems: FashionDraftMedia[];
  productIds: string[];
  createdAt: string;
  updatedAt: string;
};

type FashionAnalyticsRow = {
  id: string;
  title: string;
  image: string;
  createdAt: string;
  publicationStatus: string;
  mediaType: string;
  views: number;
  completions: number;
  avgWatchedMs: number;
  likes: number;
  comments: number;
  saves: number;
  productClicks: number;
};

type FashionAnalytics = {
  totals: {
    posts: number; approved: number; pending: number; rejected: number;
    views: number; completions: number; completionRate: number; likes: number; comments: number; saves: number;
    productClicks: number; followers: number;
  };
  posts: FashionAnalyticsRow[];
};

type FeedItem = {
  id: string;
  image: string | null;
  title: string;
  text: string;
  sourceName: string;
  creatorId: string;
  mediaType: 'image' | 'video';
  videoUrl: string | null;
  mediaItems?: Array<{ type: 'image' | 'video'; url: string; posterUrl?: string }>;
  hashtags?: string[];
  category?: string;
  city?: string;
  season?: string;
  viewsCount?: number;
  products?: FashionProductCard[];
};

type FashionSocialStats = {
  likesCount: number;
  commentsCount: number;
  savesCount: number;
  followersCount: number;
  liked: boolean;
  saved: boolean;
  following: boolean;
};

type PublicMerchantCard = {
  id: string;
  storeSlug: string;
  name: string;
  city: string;
  city_it: string | null;
  city_zh: string | null;
  logo: string;
  banner: string;
  showroomImage: string;
  storefrontVideo: string;
  tagline: string;
  tagline_it: string | null;
  tagline_zh: string | null;
  description: string;
  description_it: string | null;
  description_zh: string | null;
  specialties: string[];
  rating: number;
  isVerified: boolean;
};

type FashionSocialComment = {
  id: string;
  displayName: string;
  text: string;
  createdAt: string;
  viewerId?: string;
  parentId?: string | null;
  mine?: boolean;
  replies?: FashionSocialComment[];
};

type FashionCreatorProfile = {
  creator: {
    id: string;
    displayName: string;
    bio: string | null;
    avatarUrl: string | null;
    createdAt: string;
    postsCount: number;
    followersCount: number;
    followingCount: number;
    following: boolean;
    isSelf: boolean;
    merchant: { id: string; name: string; slug: string | null; city: string | null; logo: string | null; verified: boolean } | null;
  };
  posts: Array<{
    id: string;
    image: string;
    title: string;
    text: string;
    createdAt: string;
    mediaType: 'image' | 'video' | 'mixed';
    videoUrl: string | null;
    mediaItems?: Array<{ type: 'image' | 'video'; url: string; posterUrl?: string }>;
    hashtags: string[];
    category?: string;
    city?: string;
    season?: string;
    products?: FashionProductCard[];
  }>;
};

type DraftFashionMedia = {
  type: 'image' | 'video';
  file: File;
  preview: string;
  poster?: Blob;
  posterPreview?: string;
};

const blobToDataUrl = (blob: Blob) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('IMAGE_READ_FAILED'));
  reader.onerror = () => reject(new Error('IMAGE_READ_FAILED'));
  reader.readAsDataURL(blob);
});

const compressImage = async (file: File) => {
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('IMAGE_PROCESSING_UNAVAILABLE');
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(result => result ? resolve(result) : reject(new Error('IMAGE_COMPRESSION_FAILED')), 'image/jpeg', 0.82);
    });
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('IMAGE_READ_FAILED'));
      reader.onerror = () => reject(new Error('IMAGE_READ_FAILED'));
      reader.readAsDataURL(blob);
    });
    if (dataUrl.length > maximumUploadSize) throw new Error('IMAGE_TOO_LARGE');
    return dataUrl;
  } finally {
    bitmap.close();
  }
};

const createVideoPoster = async (file: File) => {
  const objectUrl = URL.createObjectURL(file);
  const video = document.createElement('video');
  video.preload = 'metadata';
  video.muted = true;
  video.playsInline = true;
  try {
    const duration = await new Promise<number>((resolve, reject) => {
      video.onloadedmetadata = () => resolve(video.duration);
      video.onerror = () => reject(new Error('VIDEO_READ_FAILED'));
      video.src = objectUrl;
    });
    if (!Number.isFinite(duration) || duration <= 0 || duration > maximumVideoDurationSeconds) {
      throw new Error('VIDEO_DURATION_INVALID');
    }
    await new Promise<void>((resolve, reject) => {
      video.onseeked = () => resolve();
      video.onerror = () => reject(new Error('VIDEO_READ_FAILED'));
      video.currentTime = Math.min(0.5, duration / 2);
    });
    const scale = Math.min(1, 1400 / Math.max(video.videoWidth, video.videoHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
    canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('IMAGE_PROCESSING_UNAVAILABLE');
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(poster => poster ? resolve(poster) : reject(new Error('VIDEO_POSTER_FAILED')), 'image/jpeg', 0.78);
    });
  } finally {
    video.removeAttribute('src');
    video.load();
    URL.revokeObjectURL(objectUrl);
  }
};

const readAsDataUrl = (file: File) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('FILE_READ_FAILED'));
  reader.onerror = () => reject(new Error('FILE_READ_FAILED'));
  reader.readAsDataURL(file);
});

const readBlobAsDataUrl = (blob: Blob) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('FILE_READ_FAILED'));
  reader.onerror = () => reject(new Error('FILE_READ_FAILED'));
  reader.readAsDataURL(blob);
});

export const FashionTrendsView: React.FC = () => {
  const { authRole, setCurrentView, setCatalogFilterStatus, setSelectedMerchantId, setSelectedProductId, lang, addNotification, localizeCopy } = useB2B();
  const isIt = lang === 'it';
  const localizeTrendTag = (category: string) => {
    const tag = trendTags.find(item => item.zh === category || item.it === category);
    return tag ? localizeCopy(tag.zh, tag.it) : category;
  };
  const [viewerId] = useState(() => {
    const key = 'ruda_fashion_viewer_id';
    try {
      const existing = window.localStorage.getItem(key);
      if (existing && /^[a-f0-9-]{36}$/i.test(existing)) return existing;
      const generated = window.crypto.randomUUID();
      window.localStorage.setItem(key, generated);
      return generated;
    } catch {
      return window.crypto.randomUUID();
    }
  });
  const [tasteProfile, setTasteProfile] = useState<FashionTasteProfile>(() => {
    try {
      const saved = window.localStorage.getItem(`ruda_fashion_taste_${viewerId}`);
      return saved ? parseFashionTasteProfile(JSON.parse(saved)) : {};
    } catch (error) {
      console.warn('[fashion-taste-load]', error);
      return {};
    }
  });
  const [dismissedRecommendationIds, setDismissedRecommendationIds] = useState<string[]>(() => {
    try {
      const saved = window.localStorage.getItem(`ruda_fashion_dismissed_${viewerId}`);
      return saved ? parseFashionDismissedItems(JSON.parse(saved)) : [];
    } catch (error) {
      console.warn('[fashion-dismissed-load]', error);
      return [];
    }
  });
  const [recommendationTaste, setRecommendationTaste] = useState(tasteProfile);
  const [approvedImages, setApprovedImages] = useState<Array<{ id: string; image: string; title: string; sourceName: string; category?: string }>>([]);
  const [publicPosts, setPublicPosts] = useState<FashionPost[]>([]);
  const [socialById, setSocialById] = useState<Record<string, FashionSocialStats>>({});
  const [socialPending, setSocialPending] = useState<Record<string, boolean>>({});
  const [commentTarget, setCommentTarget] = useState<FeedItem | null>(null);
  const [comments, setComments] = useState<FashionSocialComment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentDraft, setCommentDraft] = useState('');
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const [hasMorePosts, setHasMorePosts] = useState(false);
  const [loadingMorePosts, setLoadingMorePosts] = useState(false);
  const [feedOpen, setFeedOpen] = useState(false);
  const [feedStartId, setFeedStartId] = useState<string | null>(null);
  // Deep link captured before the URL-sync effect can rewrite the query string.
  const initialPostIdRef = useRef<string | null>(new URLSearchParams(window.location.search).get('post'));
  const feedOpenedRef = useRef(false);
  const [activeTag, setActiveTag] = useState('');
  const [archiveSearch, setArchiveSearch] = useState('');
  const [archiveSearchOpen, setArchiveSearchOpen] = useState(false);
  const [showComposer, setShowComposer] = useState(false);
  const [postTitle, setPostTitle] = useState('');
  const [postText, setPostText] = useState('');
  const [postCategory, setPostCategory] = useState(fashionCategories[0]);
  // Admin-managed taxonomy: categories added or renamed in the platform console
  // become selectable here without a client release. The static list stays as a
  // fallback when the taxonomy request fails.
  const [taxonomyCategories, setTaxonomyCategories] = useState<string[]>([]);
  const categoryOptions = useMemo(() => {
    const extra = taxonomyCategories.filter(name => name && !fashionCategories.includes(name));
    return [...trendTags, ...extra.map(name => ({ zh: name, it: name }))];
  }, [taxonomyCategories]);
  const categoryNames = useMemo(() => categoryOptions.map(option => option.zh), [categoryOptions]);
  useEffect(() => {
    let active = true;
    void apiGet<{ success: boolean; categories: Array<{ name: string }> }>('/api/fashion/taxonomy', 60_000)
      .then(result => {
        if (!active) return;
        const names = (result.categories || []).map(category => category.name).filter(Boolean);
        if (names.length) setTaxonomyCategories(names);
      })
      .catch(() => undefined);
    return () => { active = false; };
  }, []);
  const [postCity, setPostCity] = useState('');
  const [postSeason, setPostSeason] = useState('');
  const [draftMedia, setDraftMedia] = useState<DraftFashionMedia[]>([]);
  const [postHashtags, setPostHashtags] = useState<string[]>([]);
  const [hashtagDraft, setHashtagDraft] = useState('');
  const [aiCaptionLoading, setAiCaptionLoading] = useState(false);
  const [rightsConfirmed, setRightsConfirmed] = useState(false);
  const [postMediaProcessing, setPostMediaProcessing] = useState(false);
  const [isMediaDragActive, setIsMediaDragActive] = useState(false);
  const [feedMode, setFeedMode] = useState<'for-you' | 'latest' | 'following' | 'saved' | 'videos' | 'stores'>('for-you');
  const [publicMerchants, setPublicMerchants] = useState<PublicMerchantCard[]>([]);
  const [merchantsLoading, setMerchantsLoading] = useState(false);
  const [merchantsLoaded, setMerchantsLoaded] = useState(false);
  const [merchantSocialLoaded, setMerchantSocialLoaded] = useState(false);
  const [merchantFollowedOnly, setMerchantFollowedOnly] = useState(false);
  const [failedMerchantVideos, setFailedMerchantVideos] = useState<Record<string, boolean>>({});
  // Creator profile page (deep-linkable via /creators/<id> or ?creator=<id>).
  const [creatorProfile, setCreatorProfile] = useState<FashionCreatorProfile | null>(null);
  const [creatorLoading, setCreatorLoading] = useState(false);
  const [creatorError, setCreatorError] = useState<string | null>(null);
  const [creatorId, setCreatorId] = useState<string | null>(null);
  // Comment replies and moderation.
  const [replyTarget, setReplyTarget] = useState<{ id: string; displayName: string } | null>(null);
  const [commentsHasMore, setCommentsHasMore] = useState(false);
  const [commentsLoadingMore, setCommentsLoadingMore] = useState(false);
  const [commentsTotal, setCommentsTotal] = useState(0);
  const [reportTarget, setReportTarget] = useState<{ type: 'post' | 'comment'; id: string; label: string } | null>(null);
  const [reportReason, setReportReason] = useState('other');
  const [reportDetail, setReportDetail] = useState('');
  const [reportSubmitting, setReportSubmitting] = useState(false);
  // Product linking (composer) and product detail sheet (feed).
  const [productPickerOpen, setProductPickerOpen] = useState(false);
  const [productQuery, setProductQuery] = useState('');
  const [productOptions, setProductOptions] = useState<FashionProductCard[]>([]);
  const [productPickerLoading, setProductPickerLoading] = useState(false);
  const [productPickerManageable, setProductPickerManageable] = useState(true);
  const [selectedProducts, setSelectedProducts] = useState<FashionProductCard[]>([]);
  const [feedProductsItem, setFeedProductsItem] = useState<FeedItem | null>(null);
  const [feedCity, setFeedCity] = useState('');
  const [feedCategory, setFeedCategory] = useState('');
  const [feedSeason, setFeedSeason] = useState('');
  const [draftFeedCity, setDraftFeedCity] = useState('');
  const [draftFeedCategory, setDraftFeedCategory] = useState('');
  const [draftFeedSeason, setDraftFeedSeason] = useState('');
  const [feedFiltersOpen, setFeedFiltersOpen] = useState(false);
  const [feedSearchOpen, setFeedSearchOpen] = useState(false);
  const [feedSearchQuery, setFeedSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{
    posts: FashionPost[];
    creators: Array<{ id: string; displayName: string; bio: string | null; avatarUrl: string | null }>;
    merchants: Array<{ id: string; name: string; storeSlug: string | null; city: string | null; logo: string | null; isVerified: boolean }>;
  } | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [mediaActionsItemId, setMediaActionsItemId] = useState<string | null>(null);
  const [activeSoundId, setActiveSoundId] = useState<string | null>(null);
  const [pausedVideoIds, setPausedVideoIds] = useState<Record<string, boolean>>({});
  const [heartBurstId, setHeartBurstId] = useState<string | null>(null);
  const [activeFeedIndex, setActiveFeedIndex] = useState(0);
  const [feedViewportHeight, setFeedViewportHeight] = useState(0);
  const [videoProgress, setVideoProgress] = useState(0);
  const [postSubmitting, setPostSubmitting] = useState(false);
  const [postUploadProgress, setPostUploadProgress] = useState<number | null>(null);
  const [translations, setTranslations] = useState<Record<string, string>>({});
  const [translationVisible, setTranslationVisible] = useState<Record<string, boolean>>({});
  const [translationPending, setTranslationPending] = useState<Record<string, boolean>>({});
  const [lightboxImage, setLightboxImage] = useState<{ items: Array<{ src: string; title: string }>; index: number } | null>(null);
  const [lightboxZoom, setLightboxZoom] = useState(1);
  const [feedMediaIndexById, setFeedMediaIndexById] = useState<Record<string, number>>({});
  const lightboxTouchRef = useRef<number | null>(null);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<FashionNotificationItem[]>([]);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [notificationUnread, setNotificationUnread] = useState(0);
  const [connectionsOpen, setConnectionsOpen] = useState<'followers' | 'following' | null>(null);
  const [connections, setConnections] = useState<FashionConnectionItem[]>([]);
  const [connectionsLoading, setConnectionsLoading] = useState(false);
  const [drafts, setDrafts] = useState<FashionDraftItem[]>([]);
  const [draftsLoading, setDraftsLoading] = useState(false);
  const [activeDraftId, setActiveDraftId] = useState<string | null>(null);
  const [draftSaving, setDraftSaving] = useState(false);
  const [draftAssets, setDraftAssets] = useState<FashionDraftMedia[]>([]);
  const [analyticsOpen, setAnalyticsOpen] = useState(false);
  const [analytics, setAnalytics] = useState<FashionAnalytics | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [discoverTags, setDiscoverTags] = useState<Array<{ tag: string; posts: number }>>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const feedScrollRef = useRef<HTMLDivElement>(null);
  const feedEndRef = useRef<HTMLDivElement>(null);
  const feedCardRefs = useRef(new Map<string, HTMLElement>());
  const feedVideoRefs = useRef(new Map<string, HTMLVideoElement>());
  const draftMediaCountRef = useRef(0);
  const draftMediaRef = useRef(draftMedia);
  draftMediaRef.current = draftMedia;
  useEffect(() => () => {
    draftMediaRef.current.forEach(media => {
      if (media.preview.startsWith('blob:')) URL.revokeObjectURL(media.preview);
      if (media.posterPreview?.startsWith('blob:')) URL.revokeObjectURL(media.posterPreview);
    });
  }, []);
  const activeSoundIdRef = useRef<string | null>(null);
  const tasteProfileRef = useRef(tasteProfile);
  const tasteObservedItemsRef = useRef(new Set<string>());
  const pendingMediaTapRef = useRef<{ id: string; timer: number } | null>(null);
  const heartBurstTimerRef = useRef<number | null>(null);
  const heroVideoRef = useRef<HTMLVideoElement>(null);
  const postOffsetRef = useRef(0);
  const postCursorRef = useRef<string | null>(null);
  const loadingPostsRef = useRef(false);
  const postRequestGenerationRef = useRef(0);
  const [heroVideoReady, setHeroVideoReady] = useState(false);
  activeSoundIdRef.current = activeSoundId;

  const recordTasteSignal = (category: string | undefined, signal: FashionTasteSignal, active: boolean) => {
    if (!category) return;
    const nextProfile = updateFashionTaste(tasteProfileRef.current, category, signal, active);
    tasteProfileRef.current = nextProfile;
    setTasteProfile(nextProfile);
    try {
      window.localStorage.setItem(`ruda_fashion_taste_${viewerId}`, JSON.stringify(nextProfile));
    } catch (error) {
      console.warn('[fashion-taste-save]', error);
    }
  };
  const resetTasteProfile = () => {
    tasteProfileRef.current = {};
    setTasteProfile({});
    setRecommendationTaste({});
    setDismissedRecommendationIds([]);
    tasteObservedItemsRef.current.clear();
    try {
      window.localStorage.removeItem(`ruda_fashion_taste_${viewerId}`);
      window.localStorage.removeItem(`ruda_fashion_dismissed_${viewerId}`);
    } catch (error) {
      console.warn('[fashion-taste-reset]', error);
      addNotification('warning', '推荐偏好已清除', '本设备无法更新本地存储，请检查浏览器设置。');
      return;
    }
    setActiveFeedIndex(0);
    feedScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    addNotification('success', '推荐偏好已重置', '推荐内容将从通用排序重新开始。');
  };
  const dismissRecommendedItem = (item: FeedItem) => {
    const nextDismissed = updateFashionDismissedItems(dismissedRecommendationIds, item.id);
    setDismissedRecommendationIds(nextDismissed);
    try {
      window.localStorage.setItem(`ruda_fashion_dismissed_${viewerId}`, JSON.stringify(nextDismissed));
    } catch (error) {
      console.warn('[fashion-dismissed-save]', error);
      addNotification('warning', '暂时无法记录反馈', '请检查浏览器存储空间后重试。');
      return;
    }
    recordTasteSignal(item.category, 'dislike', true);
    setMediaActionsItemId(null);
    addNotification('success', '已减少相似推荐', '这条内容已从本设备的推荐中隐藏。');
  };
  const reduceRecommendedCategory = (item: FeedItem) => {
    recordTasteSignal(item.category, 'dislike', true);
    setMediaActionsItemId(null);
    addNotification('success', '已调整推荐偏好', item.category ? `之后会减少「${item.category}」相关内容。` : '之后会减少相似内容。');
  };

  const navigateToCatalog = () => {
    setCurrentView('catalog');
    if (window.location.pathname !== '/catalog') window.history.pushState({}, '', '/catalog');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const navigateToDiscounts = () => {
    setCatalogFilterStatus('clearance');
    navigateToCatalog();
  };
  const openFeed = (id: string) => {
    feedOpenedRef.current = true;
    setFeedStartId(id);
    setFeedMode('for-you');
    setRecommendationTaste(tasteProfileRef.current);
    setMediaActionsItemId(null);
    setActiveFeedIndex(0);
    setFeedOpen(true);
  };
  const trackedViewKeysRef = useRef<Set<string>>(new Set());
  const trackPostView = (item: FeedItem, watchedMs: number, completed: boolean) => {
    const key = `${item.id}:${completed ? 'complete' : 'view'}`;
    if (trackedViewKeysRef.current.has(key)) return;
    trackedViewKeysRef.current.add(key);
    void apiPost(`/api/fashion/posts/${encodeURIComponent(item.id)}/view`, { watchedMs, completed })
      .catch(error => console.warn('[fashion-view-track]', error));
  };
  const changeFeedMode = async (mode: 'for-you' | 'latest' | 'following' | 'saved' | 'videos' | 'stores') => {
    if ((mode === 'saved' || mode === 'following') && !(await ensureFashionAccount())) return;
    setFeedStartId(null);
    setFeedMode(mode);
    if (mode === 'for-you') setRecommendationTaste(tasteProfileRef.current);
    setMediaActionsItemId(null);
    setActiveFeedIndex(0);
    feedScrollRef.current?.scrollTo({ top: 0, left: 0 });
    const generation = ++postRequestGenerationRef.current;
    if (mode === 'stores') {
      loadingPostsRef.current = false;
      setLoadingMorePosts(false);
      setMerchantFollowedOnly(false);
      return;
    }
    loadingPostsRef.current = true;
    postCursorRef.current = null;
    setLoadingMorePosts(true);
    try {
      const sort = mode === 'latest' || mode === 'following' ? 'latest' : 'recommended';
      const savedQuery = mode === 'saved' ? '&saved=true' : '';
      const followingQuery = mode === 'following' ? '&following=true' : '';
      const feedFilterQuery = `${feedCity ? `&city=${encodeURIComponent(feedCity)}` : ''}${feedCategory ? `&category=${encodeURIComponent(feedCategory)}` : ''}${feedSeason ? `&season=${encodeURIComponent(feedSeason)}` : ''}`;
      const result = await apiGet<{ success: boolean; posts: FashionPost[]; hasMore: boolean; nextCursor?: string | null }>(
        `/api/fashion/posts?sort=${sort}&limit=${postPageSize}&offset=0${savedQuery}${followingQuery}${feedFilterQuery}`
      );
      if (generation !== postRequestGenerationRef.current) return;
      setPublicPosts(result.posts || []);
      postOffsetRef.current = result.posts?.length || 0;
      postCursorRef.current = result.nextCursor || null;
      setHasMorePosts(result.hasMore);
    } catch {
      if (generation === postRequestGenerationRef.current) addNotification('warning', '信息流切换失败', '暂时无法刷新时尚内容，请稍后重试。');
    } finally {
      if (generation === postRequestGenerationRef.current) {
        loadingPostsRef.current = false;
        setLoadingMorePosts(false);
      }
    }
  };
  const applyFeedFilters = async () => {
    setFeedCity(draftFeedCity);
    setFeedCategory(draftFeedCategory);
    setFeedSeason(draftFeedSeason);
    setFeedFiltersOpen(false);
    setFeedStartId(null);
    setActiveFeedIndex(0);
    feedScrollRef.current?.scrollTo({ top: 0, left: 0 });
    if (feedMode === 'stores') return;
    const generation = ++postRequestGenerationRef.current;
    loadingPostsRef.current = true;
    setLoadingMorePosts(true);
    postCursorRef.current = null;
    postOffsetRef.current = 0;
    try {
      const cityQuery = draftFeedCity ? `&city=${encodeURIComponent(draftFeedCity)}` : '';
      const categoryQuery = draftFeedCategory ? `&category=${encodeURIComponent(draftFeedCategory)}` : '';
      const seasonQuery = draftFeedSeason ? `&season=${encodeURIComponent(draftFeedSeason)}` : '';
      const savedQuery = feedMode === 'saved' ? '&saved=true' : '';
      const followingQuery = feedMode === 'following' ? '&following=true' : '';
      const sort = feedMode === 'latest' || feedMode === 'following' ? 'latest' : 'recommended';
      const result = await apiGet<{ success: boolean; posts: FashionPost[]; hasMore: boolean; nextCursor?: string | null }>(
        `/api/fashion/posts?sort=${sort}&limit=${postPageSize}&offset=0${cityQuery}${categoryQuery}${seasonQuery}${savedQuery}${followingQuery}`
      );
      if (generation !== postRequestGenerationRef.current) return;
      const posts = result.posts || [];
      setPublicPosts(posts);
      postOffsetRef.current = posts.length;
      postCursorRef.current = result.nextCursor || null;
      setHasMorePosts(result.hasMore);
    } catch {
      if (generation === postRequestGenerationRef.current) addNotification('warning', '筛选内容失败', '暂时无法加载所选城市、分类和季节的内容，请重试。');
    } finally {
      if (generation === postRequestGenerationRef.current) {
        loadingPostsRef.current = false;
        setLoadingMorePosts(false);
      }
    }
  };

  const feedItems = useMemo<FeedItem[]>(() => [
    ...publicPosts.map((post): FeedItem => ({
      id: post.id,
      image: post.mediaItems?.[0]?.type === 'image' ? post.mediaItems[0].url : post.mediaItems?.[0]?.posterUrl || post.image,
      title: post.title,
      text: post.text,
      sourceName: post.creatorName || localizeCopy('RUDA 时尚社区', 'RUDA Community'),
      creatorId: post.creatorAccountId || 'creator-ruda-community',
      mediaType: (post.mediaItems?.[0]?.type || post.mediaType) === 'video' ? 'video' : 'image',
      videoUrl: post.mediaItems?.[0]?.type === 'video' ? post.mediaItems[0].url : post.videoUrl || null,
      mediaItems: post.mediaItems,
      hashtags: post.hashtags || [],
      category: getFashionCategory(post.category, post.title, post.text),
      city: post.city,
      season: post.season,
      viewsCount: post.viewsCount,
      products: post.products
    })),
    ...approvedImages.map((item): FeedItem => ({
      id: item.id,
      image: item.image,
      title: item.title,
      text: '',
      sourceName: item.sourceName,
      creatorId: 'creator-ruda-editors',
      mediaType: 'image',
      videoUrl: null,
      category: getFashionCategory(item.category, item.title)
    })),
  ], [publicPosts, approvedImages]);
  const archiveItems = useMemo(() => alternateFashionMedia([
    ...publicPosts.map(post => ({
      id: post.id,
      image: post.image,
      title: post.title,
      text: post.text,
      mediaType: post.mediaType === 'video' ? 'video' as const : 'image' as const,
      videoUrl: post.mediaType === 'video' ? post.videoUrl : null,
      category: getFashionCategory(post.category, post.title, post.text),
      city: post.city
    })),
    ...approvedImages.map(item => ({ id: item.id, image: item.image, title: item.title, text: '', mediaType: 'image' as const, videoUrl: null, category: getFashionCategory(item.category, item.title) }))
  ]), [publicPosts, approvedImages, isIt]);
  const filteredArchiveItems = useMemo(() => {
    const query = archiveSearch.trim().replace(/^#/, '').toLocaleLowerCase();
    return archiveItems.filter(item => {
      const matchesCategory = !activeTag || item.category === activeTag;
      const matchesQuery = !query || `${item.title} ${item.text}`.toLocaleLowerCase().includes(query);
      return matchesCategory && matchesQuery;
    });
  }, [activeTag, archiveItems, archiveSearch]);
  const fashionGalleryLayout = useMemo(() => buildFashionGalleryLayout(filteredArchiveItems), [filteredArchiveItems]);
  const fashionGallerySections = useMemo(() => fashionGalleryLayout.reduce<Array<{
    size: 'medium' | 'feature';
    items: Array<(typeof fashionGalleryLayout)[number] & { index: number }>;
  }>>((sections, entry, index) => {
    const currentSection = sections.at(-1);
    const indexedEntry = { ...entry, index };
    if (currentSection?.size === entry.size) currentSection.items.push(indexedEntry);
    else sections.push({ size: entry.size, items: [indexedEntry] });
    return sections;
  }, []), [fashionGalleryLayout]);
  const visibleFeedItems = useMemo(
    () => {
      const followedItems = feedItems;
      const filteredItems = followedItems.filter(item =>
        (!feedCategory || item.category === feedCategory)
        && (!feedCity || item.city === feedCity)
        && (!feedSeason || item.season === feedSeason)
        && (!feedSearchQuery.trim() || `${item.title} ${item.text} ${item.sourceName} ${(item.hashtags || []).map(tag => `#${tag}`).join(' ')}`.toLocaleLowerCase().includes(feedSearchQuery.trim().toLocaleLowerCase())));
      const modeItems = feedMode === 'videos'
        ? filteredItems.filter(item => item.mediaType === 'video' && item.videoUrl)
        : filteredItems;
      const selectedItems = feedMode === 'saved'
        ? modeItems.filter(item => socialById[item.id]?.saved)
        : modeItems;
      const rankedItems = feedMode === 'for-you'
        ? rankFashionItems(selectedItems.filter(item => !dismissedRecommendationIds.includes(item.id)), recommendationTaste)
        : selectedItems;
      return alternateFashionMedia(rankedItems);
    },
    [dismissedRecommendationIds, feedCategory, feedCity, feedItems, feedMode, feedSeason, feedSearchQuery, recommendationTaste, socialById]
  );
  const publicPostIds = useMemo(() => new Set(publicPosts.map(post => post.id)), [publicPosts]);
  const visibleMerchantCards = useMemo(() => publicMerchants.filter(merchant => {
    const socialId = `merchant-${merchant.id}`;
    const matchesCity = !feedCity || merchant.city === feedCity || merchant.city_it === feedCity || merchant.city_zh === feedCity;
    const specialties = merchant.specialties.map(specialty => specialty.toLocaleLowerCase());
    const category = trendTags.find(tag => tag.zh === feedCategory);
    const matchesCategory = !feedCategory || specialties.some(specialty =>
      specialty.includes(feedCategory.toLocaleLowerCase())
      || Boolean(category && specialty.includes(category.it.toLocaleLowerCase())));
    const query = feedSearchQuery.trim().toLocaleLowerCase();
    const matchesSearch = !query || `${merchant.name} ${merchant.city} ${merchant.description} ${merchant.tagline} ${specialties.join(' ')}`.toLocaleLowerCase().includes(query);
    return matchesCity && matchesCategory && matchesSearch && (!merchantFollowedOnly || socialById[socialId]?.following);
  }), [feedCategory, feedCity, feedSearchQuery, merchantFollowedOnly, publicMerchants, socialById]);
  const { start: feedWindowStart, end: feedWindowEnd } = getFeedWindowBounds(visibleFeedItems.length, activeFeedIndex);
  const virtualFeedItems = visibleFeedItems.slice(feedWindowStart, feedWindowEnd);
  const feedVideoIds = virtualFeedItems.filter(item => item.videoUrl && !(item.mediaItems && item.mediaItems.length > 1)).map(item => item.id).join(',');
  const isCommunityCreator = (creatorId: string) => creatorId === 'creator-ruda-community' || creatorId.startsWith('fashion-account-');
  const visibleCommunityPostCount = visibleFeedItems.filter(item => isCommunityCreator(item.creatorId)).length;
  const lastCommunityFeedIndex = visibleFeedItems.reduce(
    (lastIndex, item, index) => isCommunityCreator(item.creatorId) ? index : lastIndex,
    -1
  );

  useEffect(() => {
    let active = true;
    void apiGet<{ success: boolean; items: Array<{ id: string; image: string; title: string; sourceName: string; category?: string }> }>('/api/fashion/editorial')
      .then(result => { if (active) setApprovedImages(result.items || []); })
      .catch(() => { if (active) addNotification('warning', '时尚内容暂不可用', '编辑精选图片加载失败，请稍后重试。'); });
    void apiGet<{ success: boolean; posts: FashionPost[]; hasMore: boolean; nextCursor?: string | null }>(`/api/fashion/posts?sort=recommended&limit=${postPageSize}&offset=0`)
      .then(result => {
        if (!active) return;
        const loadedPosts = result.posts || [];
        setPublicPosts(loadedPosts);
        postOffsetRef.current = loadedPosts.length;
        postCursorRef.current = result.nextCursor || null;
        setHasMorePosts(result.hasMore);
      })
      .catch(() => { if (active) addNotification('warning', '社区内容暂不可用', '时尚社区内容加载失败，请稍后重试。'); });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    const nearbyItems = visibleFeedItems.slice(Math.max(0, activeFeedIndex - 3), activeFeedIndex + 9);
    const ids = [...new Set([
      ...nearbyItems.map(item => item.id),
      ...nearbyItems.map(item => item.creatorId)
    ])].filter(id => !socialById[id]);
    if (!ids.length) return;
    void apiGet<{ success: boolean; items: Record<string, FashionSocialStats> }>(
      `/api/fashion/social?ids=${encodeURIComponent(ids.join(','))}`
    ).then(result => {
      if (active) setSocialById(previous => ({ ...previous, ...result.items }));
    }).catch(() => {
      if (active) addNotification('warning', '互动数据暂不可用', '点赞、评论和收藏状态加载失败，请稍后重试。');
    });
    return () => { active = false; };
  }, [activeFeedIndex, visibleFeedItems, socialById]);

  useEffect(() => {
    if (!feedOpen || feedMode !== 'stores' || merchantsLoaded) return;
    let active = true;
    setMerchantsLoading(true);
    void apiGet<{ success: boolean; merchants: PublicMerchantCard[] }>('/api/fashion/merchants')
      .then(result => {
        if (active) setPublicMerchants(result.merchants || []);
      })
      .catch(() => {
        if (active) addNotification('warning', '商家暂不可用', '公开商家列表加载失败，请稍后重试。');
      })
      .finally(() => {
        if (active) {
          setMerchantsLoading(false);
          setMerchantsLoaded(true);
        }
      });
    return () => { active = false; };
  }, [addNotification, feedMode, feedOpen, merchantsLoaded]);

  useEffect(() => {
    if (!feedOpen || feedMode !== 'stores' || !publicMerchants.length || merchantSocialLoaded) return;
    let active = true;
    const missingIds = publicMerchants
      .map(merchant => `merchant-${merchant.id}`)
      .filter(id => !socialById[id]);
    if (!missingIds.length) {
      setMerchantSocialLoaded(true);
      return;
    }
    const batches = Array.from({ length: Math.ceil(missingIds.length / 100) }, (_, index) =>
      missingIds.slice(index * 100, (index + 1) * 100));
    void Promise.all(batches.map(ids => apiGet<{ success: boolean; items: Record<string, FashionSocialStats> }>(
      `/api/fashion/social?ids=${encodeURIComponent(ids.join(','))}`
    ))).then(results => {
      if (active) {
        const mergedItems: Record<string, FashionSocialStats> = {};
        results.forEach(result => Object.assign(mergedItems, result.items));
        setSocialById(previous => ({ ...previous, ...mergedItems }));
      }
    }).catch(() => {
      if (active) addNotification('warning', '关注数据暂不可用', '商家关注状态加载失败，请稍后重试。');
    }).finally(() => {
      if (active) setMerchantSocialLoaded(true);
    });
    return () => { active = false; };
  }, [addNotification, feedMode, feedOpen, merchantSocialLoaded, publicMerchants, socialById]);

  useEffect(() => {
    if (!feedOpen || feedMode !== 'for-you' || commentTarget || showComposer) return;
    const item = visibleFeedItems[activeFeedIndex];
    if (!item?.category || tasteObservedItemsRef.current.has(item.id)) return;
    const timer = window.setTimeout(() => {
      tasteObservedItemsRef.current.add(item.id);
      recordTasteSignal(item.category, 'view', true);
    }, 5000);
    return () => window.clearTimeout(timer);
  }, [feedOpen, feedMode, activeFeedIndex, visibleFeedItems, commentTarget, showComposer]);

  const loadComments = async (offset = 0) => {
    if (!commentTarget) return;
    const targetId = commentTarget.id;
    if (offset === 0) setCommentsLoading(true);
    else setCommentsLoadingMore(true);
    try {
      const result = await apiGet<{
        success: boolean;
        comments: FashionSocialComment[];
        commentsCount: number;
        hasMore: boolean;
        nextOffset: number | null;
      }>(`/api/fashion/social/${encodeURIComponent(targetId)}/comments?limit=20&offset=${offset}`);
      setComments(previous => offset === 0 ? (result.comments || []) : [...previous, ...(result.comments || [])]);
      setCommentsTotal(result.commentsCount || 0);
      setCommentsHasMore(Boolean(result.hasMore));
    } catch {
      addNotification(
        'warning',
        localizeCopy('评论加载失败', 'Impossibile caricare i commenti'),
        localizeCopy('暂时无法读取评论，请稍后重试。', 'Non è possibile caricare i commenti. Riprova più tardi.')
      );
    } finally {
      setCommentsLoading(false);
      setCommentsLoadingMore(false);
    }
  };

  useEffect(() => {
    if (!commentTarget) return;
    setReplyTarget(null);
    setComments([]);
    setCommentsHasMore(false);
    setCommentsTotal(0);
    void loadComments(0);
    // reload when the target post changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [commentTarget?.id]);

  useEffect(() => {
    const resumeVideo = () => {
      const video = heroVideoRef.current;
      if (!video || document.visibilityState !== 'visible' || (!video.paused && !video.ended)) return;
      if (video.ended) video.currentTime = 0;
      void video.play().catch(error => console.warn('[fashion-video-playback]', error));
    };
    document.addEventListener('visibilitychange', resumeVideo);
    window.addEventListener('focus', resumeVideo);
    return () => {
      document.removeEventListener('visibilitychange', resumeVideo);
      window.removeEventListener('focus', resumeVideo);
    };
  }, []);

  useEffect(() => {
    if (!feedOpen || !feedStartId) return;
    const targetIndex = visibleFeedItems.findIndex(item => item.id === feedStartId);
    if (targetIndex < 0) return;
    setActiveFeedIndex(targetIndex);
    const scrollToTarget = () => {
      const root = feedScrollRef.current;
      const node = feedCardRefs.current.get(feedStartId);
      if (!root) return false;
      const top = node ? node.offsetTop : targetIndex * root.clientHeight;
      if (Math.abs(root.scrollTop - top) > 2) root.scrollTop = top;
      return Boolean(node);
    };
    const frame = window.requestAnimationFrame(() => {
      if (!scrollToTarget()) {
        const root = feedScrollRef.current;
        if (root) root.scrollTo({ top: targetIndex * root.clientHeight });
      }
    });
    // Layout can settle one frame later (fonts/media); retry once so shared links
    // never silently open the first item instead of the requested post.
    const retry = window.setTimeout(scrollToTarget, 220);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(retry);
    };
  }, [feedOpen, feedStartId, visibleFeedItems.length]);

  useEffect(() => {
    setMediaActionsItemId(null);
  }, [activeFeedIndex]);

  useEffect(() => {
    if (!feedOpen || commentTarget || showComposer) return;
    const item = visibleFeedItems[activeFeedIndex];
    if (!item || !publicPostIds.has(item.id)) return;
    const timer = window.setTimeout(() => {
      const video = item.videoUrl ? feedVideoRefs.current.get(item.id) : null;
      const watchedMs = video && Number.isFinite(video.currentTime) ? Math.round(video.currentTime * 1000) : 2_000;
      trackPostView(item, Math.max(2_000, watchedMs), false);
    }, 2_000);
    return () => window.clearTimeout(timer);
  }, [feedOpen, activeFeedIndex, visibleFeedItems, commentTarget, showComposer, publicPostIds]);

  useEffect(() => {
    const url = new URL(window.location.href);
    if (!feedOpen) {
      // Keep the deep-link parameter until the feed has actually opened once.
      if (!feedOpenedRef.current || !url.searchParams.has('post')) return;
      url.searchParams.delete('post');
      window.history.replaceState({ ...window.history.state }, '', `${url.pathname}${url.search}`);
      return;
    }
    const item = visibleFeedItems[activeFeedIndex];
    if (!item) return;
    url.searchParams.set('post', item.id);
    window.history.replaceState({ ...window.history.state }, '', `${url.pathname}${url.search}`);
  }, [feedOpen, activeFeedIndex, visibleFeedItems]);

  useEffect(() => {
    if (feedOpen || !publicPosts.length) return;
    const requestedPostId = initialPostIdRef.current;
    if (!requestedPostId) return;
    if (!publicPosts.some(post => post.id === requestedPostId)) return;
    initialPostIdRef.current = null;
    openFeed(requestedPostId);
  }, [feedOpen, publicPosts]);

  // Creator deep links: /creators/<id> (share link) and ?creator=<id>.
  useEffect(() => {
    if (creatorId) return;
    const pathMatch = /^\/creators\/([^/?#]+)/.exec(window.location.pathname);
    const requested = pathMatch ? decodeURIComponent(pathMatch[1]) : new URLSearchParams(window.location.search).get('creator');
    if (!requested || !/^fashion-account-[a-z0-9-]+$/i.test(requested)) return;
    setCreatorId(requested);
  }, [creatorId]);

  useEffect(() => {
    if (!feedOpen) return;
    const root = feedScrollRef.current;
    if (!root) return;
    const updateHeight = () => setFeedViewportHeight(root.clientHeight);
    updateHeight();
    const observer = new ResizeObserver(updateHeight);
    observer.observe(root);
    return () => observer.disconnect();
  }, [feedOpen]);

  useEffect(() => {
    if (!feedOpen) return;
    const root = feedScrollRef.current;
    if (!root) return;
    const observer = new IntersectionObserver(entries => {
      const activeEntry = entries
        .filter(entry => entry.isIntersecting)
        .sort((left, right) => right.intersectionRatio - left.intersectionRatio)[0];
      if (!activeEntry) return;
      const index = Number((activeEntry.target as HTMLElement).dataset.feedIndex);
      if (Number.isInteger(index)) setActiveFeedIndex(index);
      const activeId = (activeEntry.target as HTMLElement).dataset.feedId;
      const activeVideo = activeId ? feedVideoRefs.current.get(activeId) : null;
      setVideoProgress(activeVideo && activeVideo.duration ? activeVideo.currentTime / activeVideo.duration : 0);
    }, { root, threshold: [0.45, 0.7, 0.9] });
    feedCardRefs.current.forEach(card => observer.observe(card));
    return () => observer.disconnect();
  }, [feedOpen, feedWindowStart, feedWindowEnd]);

  useEffect(() => {
    if (!feedOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleFeedKeyDown = (event: KeyboardEvent) => {
      if (commentTarget || showComposer || lightboxImage) return;
      if (event.key === 'Escape') setFeedOpen(false);
      if (event.key === 'ArrowDown' || event.key === 'PageDown') {
        event.preventDefault();
        feedScrollRef.current?.scrollBy({ top: feedScrollRef.current.clientHeight, behavior: 'smooth' });
      }
      if (event.key === 'ArrowUp' || event.key === 'PageUp') {
        event.preventDefault();
        feedScrollRef.current?.scrollBy({ top: -feedScrollRef.current.clientHeight, behavior: 'smooth' });
      }
      if (feedMode === 'stores' && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) {
        event.preventDefault();
        feedScrollRef.current?.scrollBy({
          left: (event.key === 'ArrowRight' ? 1 : -1) * feedScrollRef.current.clientWidth,
          behavior: 'smooth'
        });
      }
    };
    window.addEventListener('keydown', handleFeedKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleFeedKeyDown);
    };
  }, [feedOpen, feedMode, commentTarget, showComposer, lightboxImage]);

  useEffect(() => {
    if (feedOpen) return;
    feedVideoRefs.current.forEach(video => video.pause());
    setActiveSoundId(null);
  }, [feedOpen]);

  useEffect(() => {
    if (!feedOpen || !feedVideoRefs.current.size) return;
    if (commentTarget || showComposer) {
      feedVideoRefs.current.forEach((video, id) => {
        video.pause();
        setPausedVideoIds(previous => previous[id] ? previous : { ...previous, [id]: true });
      });
      return;
    }
    const root = feedScrollRef.current;
    if (!root) return;
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        const video = entry.target as HTMLVideoElement;
        if (entry.isIntersecting) {
          void video.play().then(() => setPausedVideoIds(previous => ({ ...previous, [video.dataset.itemId || '']: false }))).catch(error => {
            console.warn('[fashion-feed-video-playback]', error);
            setPausedVideoIds(previous => ({ ...previous, [video.dataset.itemId || '']: true }));
          });
        } else {
          video.pause();
          setPausedVideoIds(previous => ({ ...previous, [video.dataset.itemId || '']: true }));
          if (video.dataset.itemId === activeSoundIdRef.current) setActiveSoundId(null);
        }
      });
    }, { root, threshold: 0.65 });
    feedVideoRefs.current.forEach(video => observer.observe(video));
    return () => observer.disconnect();
  }, [feedOpen, feedVideoIds, commentTarget, showComposer]);

  useEffect(() => {
    if (!feedOpen) return;
    const root = feedScrollRef.current;
    const target = feedEndRef.current;
    if (!root || !target || !hasMorePosts || feedMode === 'videos' || feedMode === 'stores') return;
    const observer = new IntersectionObserver(entries => {
      if (!entries.some(entry => entry.isIntersecting) || loadingPostsRef.current) return;
      loadingPostsRef.current = true;
      setLoadingMorePosts(true);
      const generation = postRequestGenerationRef.current;
      const savedQuery = feedMode === 'saved' ? '&saved=true' : '';
      const followingQuery = feedMode === 'following' ? '&following=true' : '';
      const sort = feedMode === 'latest' || feedMode === 'following' ? 'latest' : 'recommended';
      const cursorQuery = postCursorRef.current ? `&cursor=${encodeURIComponent(postCursorRef.current)}` : '';
      const feedFilterQuery = `${feedCity ? `&city=${encodeURIComponent(feedCity)}` : ''}${feedCategory ? `&category=${encodeURIComponent(feedCategory)}` : ''}${feedSeason ? `&season=${encodeURIComponent(feedSeason)}` : ''}`;
      void apiGet<{ success: boolean; posts: FashionPost[]; hasMore: boolean; nextCursor?: string | null }>(
        `/api/fashion/posts?sort=${sort}&limit=${postPageSize}&offset=${postOffsetRef.current}${cursorQuery}${savedQuery}${followingQuery}${feedFilterQuery}`
      ).then(result => {
        if (generation !== postRequestGenerationRef.current) return;
        const nextPosts = result.posts || [];
        postOffsetRef.current += nextPosts.length;
        postCursorRef.current = result.nextCursor || null;
        setPublicPosts(previous => {
          const existingIds = new Set(previous.map(post => post.id));
          return [...previous, ...nextPosts.filter(post => !existingIds.has(post.id))];
        });
        setHasMorePosts(result.hasMore && nextPosts.length > 0);
      }).catch(() => {
        if (generation === postRequestGenerationRef.current) addNotification('warning', '加载失败', '继续加载时尚内容失败，请稍后重试。');
      }).finally(() => {
        if (generation === postRequestGenerationRef.current) {
          loadingPostsRef.current = false;
          setLoadingMorePosts(false);
        }
      });
    }, { root, rootMargin: '400px 0px' });
    observer.observe(target);
    return () => observer.disconnect();
  }, [feedOpen, hasMorePosts, feedMode, feedCity, feedCategory, visibleCommunityPostCount]);

  const toggleReaction = async (item: FeedItem, reaction: 'like' | 'save') => {
    const actionKey = `${item.id}:${reaction}`;
    if (socialPending[actionKey]) return;
    setSocialPending(previous => ({ ...previous, [actionKey]: true }));
    try {
      if (reaction === 'save' && !(await ensureFashionAccount())) return;
      const result = await apiPost<{
        success: true;
        liked: boolean;
        saved: boolean;
        likesCount: number;
        savesCount: number;
      }>(`/api/fashion/social/${encodeURIComponent(item.id)}/reaction`, { reaction });
      setSocialById(previous => ({
        ...previous,
        [item.id]: {
          likesCount: result.likesCount,
          commentsCount: previous[item.id]?.commentsCount || 0,
          savesCount: result.savesCount,
          followersCount: previous[item.id]?.followersCount || 0,
          liked: result.liked,
          saved: result.saved,
          following: previous[item.id]?.following || false
        }
      }));
      recordTasteSignal(item.category, reaction, reaction === 'like' ? result.liked : result.saved);
      if (reaction === 'save' && !result.saved && feedMode === 'saved') {
        setPublicPosts(previous => previous.filter(post => post.id !== item.id));
      }
    } catch {
      addNotification('warning', reaction === 'like' ? '点赞失败' : '收藏失败', '操作未能保存，请稍后重试。');
    } finally {
      setSocialPending(previous => ({ ...previous, [actionKey]: false }));
    }
  };

  const toggleFeedVideo = (item: FeedItem) => {
    if (!item.videoUrl) return;
    const video = feedVideoRefs.current.get(item.id);
    if (!video) return;
    if (video.paused) {
      void video.play().then(() => setPausedVideoIds(previous => ({ ...previous, [item.id]: false }))).catch(error => {
        console.warn('[fashion-feed-video-playback]', error);
        setPausedVideoIds(previous => ({ ...previous, [item.id]: true }));
      });
    } else {
      video.pause();
      setPausedVideoIds(previous => ({ ...previous, [item.id]: true }));
    }
  };

  const openMediaLightbox = (item: FeedItem, imageIndex = 0) => {
    const images = (item.mediaItems || []).filter(media => media.type === 'image');
    if (!images.length) return;
    const index = Math.max(0, Math.min(images.length - 1, imageIndex));
    setLightboxZoom(1);
    setLightboxImage({
      items: images.map(media => ({ src: media.url, title: item.title })),
      index
    });
  };

  const stepLightbox = (delta: number) => {
    setLightboxZoom(1);
    setLightboxImage(previous => {
      if (!previous) return previous;
      const next = Math.max(0, Math.min(previous.items.length - 1, previous.index + delta));
      return next === previous.index ? previous : { ...previous, index: next };
    });
  };

  const scrollFeedGallery = (itemId: string, delta: number) => {
    const container = document.querySelector<HTMLElement>(`[data-feed-gallery="${itemId}"]`);
    if (!container) return;
    const width = container.clientWidth || 1;
    const total = container.children.length;
    const current = Math.round(container.scrollLeft / width);
    const next = Math.max(0, Math.min(total - 1, current + delta));
    if (next === current) return;
    container.scrollTo({ left: next * width, behavior: 'smooth' });
  };

  const handleFeedMediaTap = (item: FeedItem) => {
    const pendingTap = pendingMediaTapRef.current;
    if (pendingTap?.id === item.id) {
      window.clearTimeout(pendingTap.timer);
      pendingMediaTapRef.current = null;
      if (!socialById[item.id]?.liked) void toggleReaction(item, 'like');
      setHeartBurstId(item.id);
      if (heartBurstTimerRef.current !== null) window.clearTimeout(heartBurstTimerRef.current);
      heartBurstTimerRef.current = window.setTimeout(() => setHeartBurstId(null), 750);
      return;
    }
    if (pendingTap) {
      window.clearTimeout(pendingTap.timer);
      const previousItem = visibleFeedItems.find(feedItem => feedItem.id === pendingTap.id);
      if (previousItem) toggleFeedVideo(previousItem);
    }
    const timer = window.setTimeout(() => {
      if (pendingMediaTapRef.current?.timer !== timer) return;
      pendingMediaTapRef.current = null;
      toggleFeedVideo(item);
    }, 280);
    pendingMediaTapRef.current = { id: item.id, timer };
  };

  const handleFeedImageTap = (item: FeedItem, imageIndex: number) => {
    const pendingTap = pendingMediaTapRef.current;
    if (pendingTap?.id === item.id) {
      window.clearTimeout(pendingTap.timer);
      pendingMediaTapRef.current = null;
      if (!socialById[item.id]?.liked) void toggleReaction(item, 'like');
      setHeartBurstId(item.id);
      if (heartBurstTimerRef.current !== null) window.clearTimeout(heartBurstTimerRef.current);
      heartBurstTimerRef.current = window.setTimeout(() => setHeartBurstId(null), 750);
      return;
    }
    if (pendingTap) {
      window.clearTimeout(pendingTap.timer);
      const previousItem = visibleFeedItems.find(feedItem => feedItem.id === pendingTap.id);
      if (previousItem) toggleFeedVideo(previousItem);
    }
    const timer = window.setTimeout(() => {
      if (pendingMediaTapRef.current?.timer !== timer) return;
      pendingMediaTapRef.current = null;
      openMediaLightbox(item, imageIndex);
    }, 280);
    pendingMediaTapRef.current = { id: item.id, timer };
  };

  const openFashionAccountSignIn = () => {
    try {
      window.sessionStorage.setItem('ruda:open-customer-login', '1');
    } catch (error) {
      console.warn('[fashion-account-login-navigation]', error);
    }
    setCurrentView('account');
    window.setTimeout(() => window.dispatchEvent(new Event('ruda:open-customer-login')), 0);
  };

  const ensureFashionAccount = async () => {
    try {
      await apiPost('/api/fashion/account/activate', {});
      return true;
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        addNotification('info', '请先登录 RUDA 账户', '登录后即可发布、关注创作者和收藏内容；游客仍可浏览和点赞。');
        openFashionAccountSignIn();
        return false;
      }
      addNotification('warning', '账户验证失败', error instanceof Error ? error.message : '请稍后重试。');
      return false;
    }
  };

  const refreshNotificationCount = async () => {
    try {
      const result = await apiGet<{ success: boolean; unreadCount: number; authenticated: boolean }>('/api/fashion/notifications/unread-count');
      setNotificationUnread(result.authenticated ? result.unreadCount : 0);
    } catch {
      setNotificationUnread(0);
    }
  };
  useEffect(() => {
    void refreshNotificationCount();
    apiGet<{ success: boolean; tags: Array<{ tag: string; posts: number }> }>('/api/fashion/tags')
      .then(result => setDiscoverTags(Array.isArray(result.tags) ? result.tags.slice(0, 12) : []))
      .catch(() => setDiscoverTags([]));
  }, []);

  const runFeedSearch = async (rawQuery: string) => {
    const query = rawQuery.trim().slice(0, 60);
    setFeedSearchQuery(query);
    setFeedSearchOpen(true);
    if (!query) {
      setSearchResults(null);
      setSearchError('');
      return;
    }
    setSearchLoading(true);
    setSearchError('');
    try {
      const result = await apiGet<{
        success: boolean;
        posts: FashionPost[];
        creators: Array<{ id: string; displayName: string; bio: string | null; avatarUrl: string | null }>;
        merchants: Array<{ id: string; name: string; storeSlug: string | null; city: string | null; logo: string | null; isVerified: boolean }>;
      }>(`/api/fashion/search?q=${encodeURIComponent(query)}`);
      setSearchResults({
        posts: result.posts || [],
        creators: result.creators || [],
        merchants: result.merchants || []
      });
    } catch {
      setSearchResults(null);
      setSearchError(localizeCopy('搜索失败，请稍后重试。', 'Ricerca non riuscita, riprova.'));
    } finally {
      setSearchLoading(false);
    }
  };

  const openNotifications = async () => {
    setNotificationsOpen(true);
    setNotificationsLoading(true);
    try {
      const result = await apiGet<{ success: boolean; notifications: FashionNotificationItem[]; unreadCount: number }>(
        '/api/fashion/notifications?limit=30'
      );
      setNotifications(result.notifications || []);
      setNotificationUnread(result.unreadCount || 0);
      if ((result.unreadCount || 0) > 0) {
        await apiPost('/api/fashion/notifications/read', { all: true }).catch(() => undefined);
        setNotificationUnread(0);
      }
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        setNotifications([]);
        addNotification('info', '登录后查看消息', '点赞、评论、回复和关注动态会显示在这里。');
      } else {
        addNotification('warning', '消息加载失败', '请检查网络后重试。');
      }
    } finally {
      setNotificationsLoading(false);
    }
  };

  const openConnectionList = async (kind: 'followers' | 'following') => {
    if (!creatorProfile) return;
    setConnectionsOpen(kind);
    setConnections([]);
    setConnectionsLoading(true);
    try {
      const result = await apiGet<{ success: boolean; accounts: FashionConnectionItem[] }>(
        `/api/fashion/creators/${encodeURIComponent(creatorProfile.creator.id)}/${kind}?limit=60`
      );
      setConnections(result.accounts || []);
    } catch {
      addNotification('warning', '列表加载失败', '请稍后重试。');
    } finally {
      setConnectionsLoading(false);
    }
  };

  const toggleConnectionFollow = async (account: FashionConnectionItem) => {
    if (account.isSelf) return;
    if (!(await ensureFashionAccount())) return;
    try {
      const result = await apiPost<{ success: boolean; following: boolean; followersCount: number }>(
        `/api/fashion/social/${encodeURIComponent(account.id)}/follow`,
        {}
      );
      setConnections(previous => previous.map(item => item.id === account.id ? { ...item, following: result.following } : item));
      if (creatorProfile && creatorProfile.creator.id === account.id) {
        setCreatorProfile(previous => previous ? {
          ...previous,
          creator: { ...previous.creator, following: result.following, followersCount: result.followersCount }
        } : previous);
      }
    } catch {
      addNotification('warning', '关注操作失败', '请稍后重试。');
    }
  };

  const blockCreator = async (accountId: string) => {
    if (!accountId) return;
    if (!(await ensureFashionAccount())) return;
    if (!window.confirm(localizeCopy('屏蔽该创作者？屏蔽后将不再看到对方内容。', 'Bloccare questo creator? Non vedrai più i suoi contenuti.'))) return;
    try {
      await apiPost('/api/fashion/blocks', { accountId });
      setPublicPosts(previous => previous.filter(post => post.creatorAccountId !== accountId));
      setCreatorId(null);
      setConnectionsOpen(null);
      addNotification('success', '已屏蔽', '该创作者的内容不会再出现在你的信息流中。');
    } catch {
      addNotification('warning', '屏蔽失败', '请稍后重试。');
    }
  };

  const hideFeedItem = async (item: FeedItem) => {
    if (!(await ensureFashionAccount())) return;
    try {
      await apiPost(`/api/fashion/posts/${encodeURIComponent(item.id)}/hide`, {});
      setPublicPosts(previous => previous.filter(post => post.id !== item.id));
      setMediaActionsItemId(null);
      addNotification('success', '已减少此类内容', '你可以在刷新后继续浏览其他作品。');
    } catch {
      addNotification('warning', '操作失败', '请稍后重试。');
    }
  };

  const loadDrafts = async () => {
    setDraftsLoading(true);
    try {
      const result = await apiGet<{ success: boolean; drafts: FashionDraftItem[] }>('/api/fashion/drafts');
      setDrafts(result.drafts || []);
    } catch {
      setDrafts([]);
    } finally {
      setDraftsLoading(false);
    }
  };

  useEffect(() => {
    if (showComposer) void loadDrafts();
  }, [showComposer]);

  const resetComposerMedia = () => {
    draftMediaRef.current.forEach(media => {
      if (media.preview.startsWith('blob:')) URL.revokeObjectURL(media.preview);
      if (media.posterPreview?.startsWith('blob:')) URL.revokeObjectURL(media.posterPreview);
    });
    draftMediaCountRef.current = 0;
    setDraftMedia([]);
    setDraftAssets([]);
  };

  const removeDraft = async (draftId: string) => {
    if (!window.confirm(localizeCopy('删除这条草稿？', 'Eliminare questa bozza?'))) return;
    try {
      await apiDelete(`/api/fashion/drafts/${encodeURIComponent(draftId)}`);
      setDrafts(previous => previous.filter(draft => draft.id !== draftId));
      if (activeDraftId === draftId) setActiveDraftId(null);
      addNotification('success', '草稿已删除', '');
    } catch {
      addNotification('warning', '删除失败', '请稍后重试。');
    }
  };

  const resumeDraft = (draft: FashionDraftItem) => {
    resetComposerMedia();
    setActiveDraftId(draft.id);
    setPostTitle(draft.title);
    setPostText(draft.caption);
    setPostHashtags(draft.hashtags);
    setPostCategory(categoryNames.includes(draft.category || '') ? draft.category as string : (categoryNames[0] || fashionCategories[0]));
    setPostCity(draft.city || '');
    setPostSeason(fashionSeasons.includes((draft.season || '') as typeof fashionSeasons[number]) ? draft.season as string : '');
    setDraftAssets(draft.mediaItems || []);
    setSelectedProducts([]);
    setRightsConfirmed(true);
    setShowComposer(true);
    addNotification('info', '草稿已载入', draft.mediaItems?.length ? '已保存的媒体会随草稿一起发布。' : '请补充内容后发布。');
  };

  const saveDraft = async () => {
    if (!(await ensureFashionAccount())) return;
    if (!postTitle.trim() && !postText.trim() && !draftMedia.length && !draftAssets.length) {
      addNotification('warning', '草稿为空', '请先填写标题、说明或添加媒体。');
      return;
    }
    setDraftSaving(true);
    try {
      const mediaItems: FashionDraftMedia[] = [...draftAssets];
      for (const media of draftMedia) {
        const form = new FormData();
        form.set('type', media.type);
        form.set('kind', 'media');
        form.set('draft', 'true');
        form.set('filename', media.file.name);
        form.append('file', media.file, media.file.name);
        const uploaded = await apiPostWithUploadProgress<{ success: boolean; uploadToken: string }>(
          '/api/fashion/posts/mixed/assets', form, 120_000, () => undefined
        );
        let posterToken: string | undefined;
        if (media.type === 'video' && media.poster) {
          const posterForm = new FormData();
          posterForm.set('type', 'image');
          posterForm.set('kind', 'poster');
          posterForm.set('draft', 'true');
          posterForm.set('filename', 'poster.jpg');
          posterForm.append('file', media.poster, 'poster.jpg');
          const posterResult = await apiPostWithUploadProgress<{ success: boolean; uploadToken: string }>(
            '/api/fashion/posts/mixed/assets', posterForm, 120_000, () => undefined
          );
          posterToken = posterResult.uploadToken;
        }
        mediaItems.push({ type: media.type, uploadToken: uploaded.uploadToken, ...(posterToken ? { posterToken } : {}) });
      }
      const payload = {
        title: postTitle,
        caption: postText,
        hashtags: postHashtags,
        category: postCategory,
        city: postCity,
        season: postSeason,
        mediaItems,
        productIds: selectedProducts.map(product => product.id)
      };
      if (activeDraftId) {
        await apiPatch(`/api/fashion/drafts/${encodeURIComponent(activeDraftId)}`, payload);
      } else {
        await apiPost('/api/fashion/drafts', payload);
      }
      resetComposerMedia();
      setPostTitle('');
      setPostText('');
      setPostHashtags([]);
      setHashtagDraft('');
      setSelectedProducts([]);
      setActiveDraftId(null);
      setShowComposer(false);
      addNotification('success', '草稿已保存', '可稍后在任何设备继续编辑。');
      void loadDrafts();
    } catch (error) {
      const message = error instanceof ApiError && error.status === 401
        ? '请先登录 RUDA 账户。'
        : error instanceof Error ? error.message : '请稍后重试。';
      addNotification('warning', '草稿保存失败', message);
    } finally {
      setDraftSaving(false);
    }
  };

  const deleteOwnPost = async (row: FashionAnalyticsRow) => {
    if (!window.confirm(localizeCopy('删除这条作品？删除后无法在信息流中查看。', 'Eliminare questo post? Non sarà più visibile nel feed.'))) return;
    try {
      await apiDelete(`/api/fashion/posts/${encodeURIComponent(row.id)}`);
      setAnalytics(previous => previous ? {
        ...previous,
        posts: previous.posts.filter(post => post.id !== row.id),
        totals: { ...previous.totals, posts: Math.max(0, previous.totals.posts - 1) }
      } : previous);
      setPublicPosts(previous => previous.filter(post => post.id !== row.id));
      addNotification('success', '作品已删除', '该作品不会再出现在公开信息流。');
    } catch {
      addNotification('warning', '删除失败', '请稍后重试。');
    }
  };

  const openAnalytics = async () => {
    setAnalyticsOpen(true);
    setAnalyticsLoading(true);
    try {
      const result = await apiGet<{ success: boolean } & FashionAnalytics>('/api/fashion/account/analytics');
      setAnalytics({ totals: result.totals, posts: result.posts || [] });
    } catch {
      setAnalytics(null);
      addNotification('warning', '数据加载失败', '请登录后重试。');
    } finally {
      setAnalyticsLoading(false);
    }
  };

  const toggleFollow = async (item: FeedItem) => {
    const actionKey = `${item.creatorId}:follow`;
    if (socialPending[actionKey]) return;
    setSocialPending(previous => ({ ...previous, [actionKey]: true }));
    try {
      if (!(await ensureFashionAccount())) return;
      const result = await apiPost<{ success: true; following: boolean; followersCount: number }>(
        `/api/fashion/social/${encodeURIComponent(item.creatorId)}/follow`,
        {}
      );
      setSocialById(previous => ({
        ...previous,
        [item.creatorId]: {
          likesCount: previous[item.creatorId]?.likesCount || 0,
          commentsCount: previous[item.creatorId]?.commentsCount || 0,
          savesCount: previous[item.creatorId]?.savesCount || 0,
          followersCount: result.followersCount,
          liked: previous[item.creatorId]?.liked || false,
          saved: previous[item.creatorId]?.saved || false,
          following: result.following
        }
      }));
    } catch {
      addNotification('warning', '关注失败', '暂时无法关注该创作者，请稍后重试。');
    } finally {
      setSocialPending(previous => ({ ...previous, [actionKey]: false }));
    }
  };
  const openMerchantStore = (merchantId: string) => {
    setSelectedMerchantId(merchantId);
    setFeedOpen(false);
    setCurrentView('merchant_store');
  };

  const submitComment = async (event: React.FormEvent) => {
    event.preventDefault();
    const text = commentDraft.trim();
    if (!commentTarget || !text || text.length > 300 || commentSubmitting) return;
    setCommentSubmitting(true);
    try {
      if (!(await ensureFashionAccount())) return;
      const result = await apiPost<{
        success: true;
        comment: FashionSocialComment;
        commentsCount: number;
      }>(`/api/fashion/social/${encodeURIComponent(commentTarget.id)}/comments`, {
        text,
        ...(replyTarget ? { parentId: replyTarget.id } : {})
      });
      setSocialById(previous => ({
        ...previous,
        [commentTarget.id]: {
          likesCount: previous[commentTarget.id]?.likesCount || 0,
          commentsCount: result.commentsCount,
          savesCount: previous[commentTarget.id]?.savesCount || 0,
          followersCount: previous[commentTarget.id]?.followersCount || 0,
          liked: previous[commentTarget.id]?.liked || false,
          saved: previous[commentTarget.id]?.saved || false,
          following: previous[commentTarget.id]?.following || false
        }
      }));
      setCommentDraft('');
      setReplyTarget(null);
      await loadComments(0);
    } catch {
      addNotification(
        'warning',
        localizeCopy('评论发送失败', 'Invio del commento non riuscito'),
        localizeCopy('评论未能发布，请检查内容后重试。', 'Il commento non è stato pubblicato. Controlla il testo e riprova.')
      );
    } finally {
      setCommentSubmitting(false);
    }
  };

  const deleteOwnComment = async (comment: FashionSocialComment) => {
    if (!commentTarget || !comment.mine) return;
    try {
      const result = await apiDelete<{ success: boolean; removedCount: number; commentsCount: number }>(
        `/api/fashion/social/${encodeURIComponent(commentTarget.id)}/comments/${encodeURIComponent(comment.id)}`
      );
      setSocialById(previous => ({
        ...previous,
        [commentTarget.id]: {
          likesCount: previous[commentTarget.id]?.likesCount || 0,
          commentsCount: result.commentsCount,
          savesCount: previous[commentTarget.id]?.savesCount || 0,
          followersCount: previous[commentTarget.id]?.followersCount || 0,
          liked: previous[commentTarget.id]?.liked || false,
          saved: previous[commentTarget.id]?.saved || false,
          following: previous[commentTarget.id]?.following || false
        }
      }));
      addNotification('success', '评论已删除', `已移除 ${result.removedCount} 条评论。`);
      await loadComments(0);
    } catch (error) {
      addNotification('warning', '删除失败', error instanceof ApiError && error.status === 403 ? '只能删除自己发布的评论。' : '请稍后重试。');
    }
  };

  const submitReport = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!reportTarget || reportSubmitting) return;
    setReportSubmitting(true);
    try {
      await apiPost('/api/fashion/reports', {
        targetType: reportTarget.type,
        targetId: reportTarget.id,
        reason: reportReason,
        detail: reportDetail.trim()
      });
      addNotification('success', '举报已提交', 'RUDA 内容团队会审核处理，结果不会公开举报人信息。');
      setReportTarget(null);
      setReportDetail('');
      setReportReason('other');
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        addNotification('info', '已提交过举报', '同一内容无需重复举报，我们会在处理后更新状态。');
        setReportTarget(null);
      } else {
        addNotification('warning', '举报提交失败', '请检查网络后重试。');
      }
    } finally {
      setReportSubmitting(false);
    }
  };

  const openCreatorProfile = (creatorId: string) => {
    if (!creatorId || creatorId === 'creator-ruda-editors') return;
    setCreatorId(creatorId);
    setFeedOpen(false);
  };

  useEffect(() => {
    if (!creatorId) return;
    let active = true;
    setCreatorLoading(true);
    setCreatorError(null);
    setCreatorProfile(null);
    void apiGet<FashionCreatorProfile & { success: boolean }>(`/api/fashion/creators/${encodeURIComponent(creatorId)}`)
      .then(result => {
        if (active) setCreatorProfile(result);
      })
      .catch(error => {
        if (!active) return;
        setCreatorError(error instanceof ApiError && error.status === 404 ? 'not-found' : 'failed');
      })
      .finally(() => {
        if (active) setCreatorLoading(false);
      });
    return () => { active = false; };
  }, [creatorId]);

  const toggleCreatorFollow = async () => {
    if (!creatorProfile) return;
    const creator = creatorProfile.creator;
    try {
      if (!(await ensureFashionAccount())) return;
      const result = await apiPost<{ success: boolean; following: boolean; followersCount: number }>(
        `/api/fashion/social/${encodeURIComponent(creator.id)}/follow`,
        {}
      );
      setCreatorProfile(previous => previous ? {
        ...previous,
        creator: { ...previous.creator, following: result.following, followersCount: result.followersCount }
      } : previous);
      setSocialById(previous => ({
        ...previous,
        [creator.id]: {
          likesCount: previous[creator.id]?.likesCount || 0,
          commentsCount: previous[creator.id]?.commentsCount || 0,
          savesCount: previous[creator.id]?.savesCount || 0,
          followersCount: result.followersCount,
          liked: previous[creator.id]?.liked || false,
          saved: previous[creator.id]?.saved || false,
          following: result.following
        }
      }));
    } catch {
      addNotification('warning', '关注失败', '暂时无法更新关注状态，请稍后重试。');
    }
  };

  const searchFashionProducts = async (query = productQuery) => {
    setProductPickerLoading(true);
    try {
      const result = await apiGet<{ success: boolean; manageable: boolean; products: FashionProductCard[] }>(
        `/api/fashion/products/search?limit=12${query.trim() ? `&q=${encodeURIComponent(query.trim())}` : ''}`
      );
      setProductOptions(result.products || []);
      setProductPickerManageable(result.manageable !== false);
    } catch {
      setProductOptions([]);
      setProductPickerManageable(false);
    } finally {
      setProductPickerLoading(false);
    }
  };

  const openProductPicker = () => {
    setProductPickerOpen(true);
    setProductOptions([]);
    void searchFashionProducts('');
  };

  const toggleSelectedProduct = (product: FashionProductCard) => {
    setSelectedProducts(previous => previous.some(item => item.id === product.id)
      ? previous.filter(item => item.id !== product.id)
      : previous.length >= 6 ? previous : [...previous, product]);
  };

  const openCreatorPost = (post: FashionCreatorProfile['posts'][number]) => {
    const firstMedia = post.mediaItems?.[0];
    const feedPost: FashionPost = {
      id: post.id,
      image: post.image,
      title: post.title,
      text: post.text,
      createdAt: post.createdAt,
      mediaType: firstMedia?.type === 'video' || post.mediaType === 'video' ? 'video' : 'image',
      videoUrl: firstMedia?.type === 'video' ? firstMedia.url : post.videoUrl,
      mediaItems: post.mediaItems,
      hashtags: post.hashtags,
      category: post.category,
      city: post.city,
      creatorAccountId: creatorProfile?.creator.id,
      creatorName: creatorProfile?.creator.displayName,
      products: post.products
    };
    setPublicPosts(previous => previous.some(existing => existing.id === post.id) ? previous : [feedPost, ...previous]);
    setCreatorId(null);
    setFeedMode('for-you');
    openFeed(post.id);
  };

  const openFeedProduct = (item: FeedItem, product: FashionProductCard) => {
    void apiPost(`/api/fashion/posts/${encodeURIComponent(item.id)}/products/${encodeURIComponent(product.id)}/click`, {}).catch(() => undefined);
    setSelectedProductId(product.id);
    setFeedProductsItem(null);
    setFeedOpen(false);
    setCurrentView('product_detail');
  };

  const suggestFashionCopy = async () => {
    if (aiCaptionLoading || postMediaProcessing || postSubmitting) return;
    setAiCaptionLoading(true);
    try {
      const firstMedia = draftMedia[0];
      const imageDataUrl = firstMedia?.type === 'image'
        ? firstMedia.preview
        : firstMedia?.poster ? await blobToDataUrl(firstMedia.poster) : undefined;
      const suggestion = await apiPost<{ success: true; title: string; caption: string; hashtags: string[] }>(
        '/api/fashion/ai/caption',
        { title: postTitle, caption: postText, category: postCategory, language: isIt ? 'it' : 'zh', ...(imageDataUrl ? { imageDataUrl } : {}) },
        45_000
      );
      setPostTitle(suggestion.title);
      setPostText(suggestion.caption);
      setPostHashtags(suggestion.hashtags);
      addNotification('success', 'AI 文案已生成', '标题、说明和话题已填入草稿；发布前仍可自行修改。');
    } catch {
      addNotification('warning', 'AI 文案暂不可用', '请稍后重试，或继续手动编辑内容。');
    } finally {
      setAiCaptionLoading(false);
    }
  };

  const addFashionHashtag = () => {
    const tag = hashtagDraft.trim().replace(/^#+/, '').replace(/[^\p{L}\p{N}_-]/gu, '').slice(0, 30);
    if (!tag) return;
    setPostHashtags(previous => previous.length >= 8 || previous.some(existing => existing.toLocaleLowerCase() === tag.toLocaleLowerCase())
      ? previous
      : [...previous, tag]);
    setHashtagDraft('');
  };

  const translateFeedItem = async (item: FeedItem) => {
    if (translations[item.id]) {
      setTranslationVisible(previous => ({ ...previous, [item.id]: !previous[item.id] }));
      return;
    }
    if (translationPending[item.id]) return;
    setTranslationPending(previous => ({ ...previous, [item.id]: true }));
    try {
      const result = await apiPost<{ success: true; translation: string }>('/api/fashion/ai/translate', {
        text: [item.title, item.text].filter(Boolean).join('\n'),
        language: isIt ? 'zh' : 'it'
      }, 30_000);
      setTranslations(previous => ({ ...previous, [item.id]: result.translation }));
      setTranslationVisible(previous => ({ ...previous, [item.id]: true }));
    } catch {
      addNotification('warning', '翻译暂不可用', '请稍后重试，原文仍可正常查看。');
    } finally {
      setTranslationPending(previous => ({ ...previous, [item.id]: false }));
    }
  };

  const submitPublicPost = async (event: React.FormEvent) => {
    event.preventDefault();
    if ((!postTitle.trim() && !postText.trim() && draftMedia.length === 0 && draftAssets.length === 0) || postSubmitting) return;
    if (!rightsConfirmed) {
      addNotification('warning', '请确认内容授权', '请确认你拥有该图片或视频的发布权，或已获得权利人许可。');
      return;
    }
    setPostSubmitting(true);
    try {
      if (!(await ensureFashionAccount())) return;
      const tokenAssets = draftAssets.filter(asset => Boolean(asset.uploadToken));
      if (!draftMedia.length && tokenAssets.length) {
        await apiPost<{ success: true; post: FashionPost }>('/api/fashion/posts/mixed', {
          manifest: tokenAssets.map(asset => ({
            type: asset.type,
            uploadToken: asset.uploadToken,
            ...(asset.posterToken ? { posterToken: asset.posterToken } : {})
          })),
          title: postTitle,
          text: postText,
          category: postCategory,
          ...(postCity ? { city: postCity } : {}),
          ...(postSeason ? { season: postSeason } : {}),
          rightsConfirmed: 'true',
          hashtags: postHashtags,
          ...(selectedProducts.length ? { productIds: selectedProducts.map(product => product.id) } : {})
        });
      } else {
      const form = new FormData();
      form.set('title', postTitle);
      form.set('text', postText);
      form.set('category', postCategory);
      if (postCity) form.set('city', postCity);
      if (postSeason) form.set('season', postSeason);
      form.set('rightsConfirmed', 'true');
      form.set('manifest', JSON.stringify(draftMedia.map(media => ({ type: media.type, name: media.file.name }))));
      form.set('hashtags', JSON.stringify(postHashtags));
      if (selectedProducts.length) form.set('productIds', JSON.stringify(selectedProducts.map(product => product.id)));
      draftMedia.forEach((media, index) => {
        form.append(`media-${index}`, media.file, media.file.name);
        if (media.poster) form.append(`poster-${index}`, media.poster, `poster-${index}.jpg`);
      });
      setPostUploadProgress(0);
      await apiPostWithUploadProgress<{ success: true; post: FashionPost }>(
        '/api/fashion/posts/mixed',
        form,
        600_000,
        (loaded, total) => setPostUploadProgress(total > 0 ? Math.min(100, Math.round((loaded / total) * 100)) : 0)
      );
      }
      if (activeDraftId) {
        void apiDelete(`/api/fashion/drafts/${encodeURIComponent(activeDraftId)}`).catch(() => undefined);
        setDrafts(previous => previous.filter(draft => draft.id !== activeDraftId));
        setActiveDraftId(null);
      }
      setDraftAssets([]);
      setPostTitle('');
      setPostText('');
      setPostCategory(fashionCategories[0]);
      setPostCity('');
      setPostSeason('');
      setPostHashtags([]);
      setHashtagDraft('');
      setSelectedProducts([]);
      setProductPickerOpen(false);
      draftMedia.forEach(media => {
        if (media.preview.startsWith('blob:')) URL.revokeObjectURL(media.preview);
        if (media.posterPreview?.startsWith('blob:')) URL.revokeObjectURL(media.posterPreview);
      });
      draftMediaCountRef.current = 0;
      setDraftMedia([]);
      setRightsConfirmed(false);
      setShowComposer(false);
      addNotification('success', '投稿已提交', '内容已进入审核队列，通过审核后会显示在时尚信息流。');
    } catch (error) {
      const code = error instanceof Error ? error.message : '';
      const message = code === 'REQUEST_FAILED_413'
            ? '视频请求超过服务器限制，请换用较小的视频重试。'
            : code === 'REQUEST_FAILED_429'
              ? '发布过于频繁，请稍后再试。'
            : code === 'REQUEST_TIMEOUT'
              ? '上传超时，请检查网络后重试。'
            : code === 'FASHION_POST_VIDEO_TOO_LARGE' || code === 'FASHION_POST_MEDIA_TOO_LARGE'
              ? '视频不能超过 20 MB。'
            : code === 'FASHION_POST_VIDEO_POSTER_TOO_LARGE'
              ? '视频封面文件过大，请重新选择视频。'
            : code === 'FASHION_POST_VIDEO_FORMAT_INVALID' || code === 'FASHION_POST_VIDEO_INVALID' || code === 'FASHION_POST_MEDIA_INVALID'
              ? '视频格式不受支持，请选择 MP4、WebM 或 MOV。'
            : code === 'FASHION_POST_VIDEO_POSTER_INVALID'
              ? '视频封面无法读取，请重新选择视频。'
            : code === 'FASHION_COMMUNITY_CAPACITY_REACHED'
              ? '社区投稿暂时已满，请稍后再试。'
            : code === 'FASHION_POST_VIDEO_DURATION_INVALID'
              ? '视频时长必须在 3 分钟以内。'
            : code === 'FASHION_POST_MEDIA_TOTAL_TOO_LARGE'
              ? '所有图片和视频合计不能超过 50 MB。'
            : code === 'FASHION_POST_RIGHTS_CONFIRMATION_REQUIRED'
              ? '请先确认你拥有内容发布权或已获得授权。'
            : code === 'NETWORK_ERROR'
              ? '网络连接失败，请检查网络后重试。'
            : code === 'FASHION_POST_CATEGORY_INVALID'
              ? '时尚分类无效，请重新选择分类后发布。'
                : code === 'VIDEO_POSTER_MISSING'
                  ? '视频封面生成失败，请重新选择视频。'
                  : code || '内容未能上传，请检查网络后重试。';
      addNotification('warning', '发布失败', message);
    } finally {
      setPostSubmitting(false);
      setPostUploadProgress(null);
    }
  };

  const processMediaFile = async (file?: File) => {
    if (!file) return;
    if (draftMediaCountRef.current >= 8) {
      addNotification('warning', '媒体数量已达上限', '一条内容最多添加 8 个图片或视频。');
      return;
    }
    const imageTypes = ['image/jpeg', 'image/png', 'image/webp'];
    const videoTypes = ['video/mp4', 'video/webm', 'video/quicktime'];
    const extension = file.name.split('.').pop()?.toLowerCase() || '';
    const videoMimeByExtension: Record<string, string> = {
      mp4: 'video/mp4',
      m4v: 'video/mp4',
      webm: 'video/webm',
      mov: 'video/quicktime'
    };
    const detectedVideoType = videoTypes.includes(file.type) ? file.type : videoMimeByExtension[extension];
    if (!imageTypes.includes(file.type) && !detectedVideoType) {
      addNotification('warning', '媒体格式不支持', '请选择 JPG、PNG、WebP、MP4、WebM 或 MOV 文件。');
      return;
    }
    const isVideo = Boolean(detectedVideoType);
    if (file.size > (isVideo ? maximumVideoSize : 12 * 1024 * 1024)) {
      addNotification('warning', '文件太大', isVideo ? '视频不能超过 20 MB。' : '图片请选择小于 12 MB 的文件。');
      return;
    }
    setPostMediaProcessing(true);
    try {
      let nextMedia: DraftFashionMedia;
      if (isVideo) {
        const normalizedVideoFile = file.type === detectedVideoType ? file : new File([file], file.name, { type: detectedVideoType });
        const poster = await createVideoPoster(normalizedVideoFile);
        if (poster.size > maximumUploadSize) throw new Error('VIDEO_POSTER_TOO_LARGE');
        nextMedia = {
          type: 'video',
          file: normalizedVideoFile,
          preview: URL.createObjectURL(normalizedVideoFile),
          poster,
          posterPreview: URL.createObjectURL(poster)
        };
      } else {
        nextMedia = { type: 'image', file, preview: await compressImage(file) };
      }
      draftMediaCountRef.current += 1;
      setDraftMedia(previous => [...previous, nextMedia]);
      setRightsConfirmed(false);
    } catch (error) {
      const code = error instanceof Error ? error.message : '';
      addNotification('warning', '媒体处理失败', code === 'VIDEO_DURATION_INVALID'
        ? '视频时长需在 3 分钟以内。'
        : code === 'IMAGE_TOO_LARGE' || code === 'VIDEO_POSTER_TOO_LARGE'
          ? '图片压缩后仍过大，请换一张图片重试。'
          : '无法读取此媒体文件，请换一个 MP4、WebM 或 MOV 文件重试。');
    } finally {
      setPostMediaProcessing(false);
    }
  };
  const handleMediaSelection = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = [...(event.target.files || [])];
    event.target.value = '';
    void (async () => {
      const availableSlots = Math.max(0, 8 - draftMediaCountRef.current);
      for (const file of files.slice(0, availableSlots)) await processMediaFile(file);
      if (files.length > availableSlots) addNotification('warning', '媒体数量过多', '一条内容最多添加 8 个图片或视频。');
    })();
  };
  const handleMediaDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsMediaDragActive(false);
    if (postMediaProcessing || postSubmitting) return;
    const files = [...event.dataTransfer.files];
    const availableSlots = Math.max(0, 8 - draftMediaCountRef.current);
    void (async () => {
      for (const file of files.slice(0, availableSlots)) await processMediaFile(file);
      if (files.length > availableSlots) addNotification('warning', '媒体数量过多', '一条内容最多添加 8 个图片或视频。');
    })();
  };
  const removeDraftMedia = (index: number) => {
    setDraftMedia(previous => {
      const media = previous[index];
      if (media?.preview.startsWith('blob:')) URL.revokeObjectURL(media.preview);
      if (media?.posterPreview?.startsWith('blob:')) URL.revokeObjectURL(media.posterPreview);
      return previous.filter((_, itemIndex) => itemIndex !== index);
    });
    draftMediaCountRef.current = Math.max(0, draftMediaCountRef.current - 1);
    setRightsConfirmed(false);
  };

  const fashionPostShareUrl = (id: string) => {
    const pathname = window.location.pathname.includes('/trends') ? window.location.pathname : '/trends';
    const url = new URL(pathname, window.location.origin);
    url.searchParams.set('post', id);
    return url.toString();
  };

  const shareImage = async (src: string, title: string) => {
    try {
      if (navigator.share) {
        await navigator.share({ title, text: 'RUDA Fashion', url: src });
      } else {
        await navigator.clipboard.writeText(src);
        addNotification('success', '分享地址已复制', '图片地址已复制到剪贴板。');
      }
    } catch {
      if (!navigator.share) addNotification('warning', '分享失败', '请稍后重试或手动复制图片地址。');
    }
  };

  const shareFeedItem = async (item: FeedItem) => {
    setMediaActionsItemId(null);
    const url = fashionPostShareUrl(item.id);
    try {
      if (navigator.share) {
        await navigator.share({ title: item.title, text: item.text || 'RUDA Fashion', url });
      } else {
        await navigator.clipboard.writeText(url);
        addNotification('success', '分享地址已复制', '内容链接已复制到剪贴板。');
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      if (!navigator.share) addNotification('warning', '分享失败', '请稍后重试或手动复制内容地址。');
      else console.warn('[fashion-share]', error);
    }
  };

  const copyFeedItemLink = async (item: FeedItem) => {
    try {
      await navigator.clipboard.writeText(fashionPostShareUrl(item.id));
      addNotification('success', '链接已复制', '内容链接已复制到剪贴板。');
    } catch (error) {
      console.error('[fashion-copy-link]', error);
      addNotification('warning', '复制失败', '请检查浏览器剪贴板权限后重试。');
    }
    setMediaActionsItemId(null);
  };

  const downloadFeedItem = async (
    item: FeedItem,
    mediaUrl = item.videoUrl || item.image,
    downloadLabel = item.videoUrl ? 'video' : 'image'
  ) => {
    if (!mediaUrl) return;
    try {
      const response = await fetch(new URL(mediaUrl, window.location.origin), { mode: 'cors' });
      if (!response.ok) throw new Error(`DOWNLOAD_FAILED_${response.status}`);
      const blobUrl = URL.createObjectURL(await response.blob());
      const extension = new URL(mediaUrl, window.location.origin).pathname.split('.').pop() || (downloadLabel === 'video' ? 'mp4' : 'jpg');
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `ruda-fashion-${item.id}-${downloadLabel}.${extension}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
    } catch (error) {
      console.error('[fashion-download]', error);
      addNotification('warning', '下载失败', '媒体服务器暂不支持下载，请稍后重试。');
    }
    setMediaActionsItemId(null);
  };

  const renderArchiveCard = (
    item: (typeof filteredArchiveItems)[number],
    index: number,
    size: 'medium' | 'feature'
  ) => (
    <button
      key={item.id}
      type="button"
      onClick={() => openFeed(item.id)}
      className={`group relative block overflow-hidden bg-neutral-200 text-left text-white ${size === 'medium' ? 'aspect-[4/5]' : 'aspect-[4/3] sm:aspect-[2/1]'}`}
    >
      {item.mediaType === 'video' && item.videoUrl ? (
        <video src={item.videoUrl} poster={item.image || undefined} muted autoPlay loop playsInline preload="metadata" aria-label={item.title} onError={() => console.warn('[fashion-gallery-video-load]', item.id)} className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.035]" />
      ) : item.image ? (
        <img src={item.image} alt={item.title} className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.035]" loading={index === 0 ? 'eager' : 'lazy'} referrerPolicy="no-referrer" />
      ) : <span className="absolute inset-0 bg-neutral-800" />}
      <span className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/0 to-black/10 opacity-90 transition-opacity group-hover:opacity-100" />
      <span className="absolute left-3 top-3 flex items-center gap-2 text-[8px] font-bold uppercase tracking-[0.2em] text-white/85 sm:left-6 sm:top-6">
        <span>{String(index + 1).padStart(2, '0')}</span><span className="h-px w-5 bg-white/70" /><span>{item.category ? localizeTrendTag(item.category) : localizeCopy('RUDA 编辑精选', 'RUDA edit')}</span>
      </span>
      <span className="absolute bottom-3 left-3 right-3 sm:bottom-7 sm:left-6 sm:right-6">
        <span className={`block font-serif leading-[0.95] tracking-[-0.025em] ${size === 'medium' ? 'text-xl sm:text-3xl' : 'text-3xl sm:text-5xl lg:text-6xl'}`}>{item.title}</span>
        <span className="mt-2 inline-flex items-center gap-2 text-[8px] font-semibold uppercase tracking-[0.18em] text-white/80 transition-colors group-hover:text-white sm:mt-3">{localizeCopy('进入沉浸浏览', 'Apri la storia')} <ArrowUpRight className="h-3.5 w-3.5" /></span>
      </span>
      {item.mediaType === 'video' && <span className="absolute right-3 top-3 rounded-full border border-white/50 bg-black/25 px-2 py-1 text-[8px] font-bold uppercase tracking-[0.12em] text-white backdrop-blur-sm sm:right-4 sm:top-4">VIDEO</span>}
    </button>
  );

  useEffect(() => {
    if (!lightboxImage) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setLightboxImage(null);
      if (event.key === 'ArrowRight') { event.preventDefault(); stepLightbox(1); }
      if (event.key === 'ArrowLeft') { event.preventDefault(); stepLightbox(-1); }
      if (event.key === '+' || event.key === '=') setLightboxZoom(value => Math.min(3, Number((value + 0.25).toFixed(2))));
      if (event.key === '-') setLightboxZoom(value => Math.max(1, Number((value - 0.25).toFixed(2))));
      if (event.key === '0') setLightboxZoom(1);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [lightboxImage]);

  useEffect(() => {
    if (!feedOpen || lightboxImage) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
      const item = visibleFeedItems[activeFeedIndex];
      if (!item?.mediaItems || item.mediaItems.length < 2) return;
      event.preventDefault();
      scrollFeedGallery(item.id, event.key === 'ArrowRight' ? 1 : -1);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [feedOpen, lightboxImage, activeFeedIndex, visibleFeedItems]);

  useEffect(() => {
    setFeedMediaIndexById({});
  }, [activeFeedIndex]);

  useEffect(() => () => {
    if (heartBurstTimerRef.current !== null) window.clearTimeout(heartBurstTimerRef.current);
    if (pendingMediaTapRef.current) window.clearTimeout(pendingMediaTapRef.current.timer);
  }, []);

  return (
    <>
    <section className="group relative isolate flex min-h-[min(780px,calc(100svh-8rem))] items-end overflow-hidden bg-neutral-950 text-white sm:min-h-[min(900px,calc(100svh-9rem))]">
      <img
        src={fashionHeroImage}
        alt=""
        aria-hidden="true"
        className={`absolute inset-0 h-full w-full object-cover transition-transform duration-[1800ms] group-hover:scale-[1.02] ${heroVideoReady ? 'opacity-0' : 'opacity-70'}`}
        referrerPolicy="no-referrer"
      />
      <video
        ref={heroVideoRef}
        src="/videos/ruda-fashion.mp4"
        aria-label={localizeCopy('RUDA 时尚全屏视频', 'Film di moda RUDA')}
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        onCanPlay={event => {
          setHeroVideoReady(true);
          if (event.currentTarget.paused) void event.currentTarget.play().catch(error => console.warn('[fashion-video-playback]', error));
        }}
        onError={() => setHeroVideoReady(false)}
        onEnded={event => {
          event.currentTarget.currentTime = 0;
          void event.currentTarget.play().catch(error => console.warn('[fashion-video-playback]', error));
        }}
        className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ${heroVideoReady ? 'opacity-80' : 'opacity-0'}`}
      />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.04)_0%,rgba(0,0,0,0.04)_35%,rgba(0,0,0,0.72)_100%)]" />
      <div className="absolute left-5 top-1/2 hidden -translate-y-1/2 [writing-mode:vertical-rl] text-[9px] font-semibold uppercase tracking-[0.34em] text-white/65 lg:block">
        {localizeCopy('意大利风格 · 欧洲灵感', 'ITALIAN STYLE · EUROPEAN VISION')}
      </div>
        <div className="absolute right-3 top-[calc(env(safe-area-inset-top)+6.85rem)] z-10 flex items-center gap-2 rounded-full border border-white/10 bg-black/25 px-2.5 py-1 text-[9px] text-white/75 backdrop-blur-sm">
          <span>{String(activeFeedIndex + 1).padStart(2, '0')} / {String(visibleFeedItems.length).padStart(2, '0')}</span>
          <span className="h-2.5 w-px bg-white/30" />
          <span>{localizeCopy('双击点赞 · 点击视频暂停', 'Doppio tocco · Mi piace')}</span>
        </div>
      <div className="relative mx-auto flex w-full max-w-[1440px] flex-col items-center px-5 pb-16 pt-20 text-center sm:px-10 sm:pb-24">
        <p className="inline-flex items-center gap-3 text-[9px] font-semibold uppercase tracking-[0.36em] text-white/80 sm:text-[11px]"><span className="h-px w-7 bg-white/50" />{localizeCopy('时尚 · 文化 · 趋势', 'Moda · Cultura · Tendenze')}<span className="h-px w-7 bg-white/50" /></p>
        <h1 className="mt-6 font-serif text-7xl font-normal leading-[0.84] tracking-[-0.045em] sm:text-9xl lg:text-[11rem]">RUDA<span className="mt-4 block font-sans text-[0.13em] font-medium tracking-[0.72em]">FASHION</span></h1>
        <div className="mt-7 flex flex-col items-center gap-3 sm:flex-row">
          <button type="button" onClick={() => document.getElementById('fashion-visuals')?.scrollIntoView({ behavior: 'smooth' })} className="inline-flex min-h-11 cursor-pointer items-center border border-white/80 px-5 text-[10px] font-semibold uppercase tracking-[0.18em] text-white transition-colors hover:bg-white hover:text-black">
            {localizeCopy('浏览时尚内容', 'Entra nel mondo RUDA')}
          </button>
        </div>
      </div>
      <div className="absolute bottom-5 left-5 flex items-center gap-3 text-[8px] font-semibold uppercase tracking-[0.22em] text-white/60 sm:bottom-7 sm:left-8"><span>01</span><span className="h-px w-10 bg-white/40" /><span>RUDA FASHION FILM</span></div>
      <span className="absolute bottom-5 right-5 text-[8px] font-semibold uppercase tracking-[0.18em] text-white/70 sm:bottom-7 sm:right-8">{localizeCopy('秋冬 · 2026', 'AUTUNNO / INVERNO 2026')}</span>
    </section>

    <main className="bg-[#f7f6f3] text-neutral-950">
      <header className="mx-auto flex min-h-16 max-w-[1680px] flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-neutral-200 px-4 py-2 sm:px-8">
        <button type="button" onClick={() => setCurrentView('home')} className="text-left">
          <span className="block text-[8px] font-semibold uppercase tracking-[0.24em] text-neutral-500">{localizeCopy('RUDA · 意大利时尚视觉誌', 'RUDA · IL DIARIO DELLA MODA')}</span>
          <span className="font-serif text-lg font-semibold tracking-tight">{localizeCopy('风格与趋势', 'Stile e tendenze')}</span>
        </button>
        <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-1 text-[9px] font-semibold uppercase tracking-[0.12em] text-neutral-500 sm:gap-x-4">
          <span>{localizeCopy("{{RUDA_ARG_0}} 个故事", "{{RUDA_ARG_0}} storie", [String(filteredArchiveItems.length)])}</span>
          <button type="button" onClick={() => setShowComposer(true)} className="text-neutral-950 underline decoration-neutral-400 underline-offset-4">{localizeCopy('分享灵感', 'Condividi')}</button>
          <button type="button" onClick={navigateToCatalog} className="inline-flex items-center border-b border-neutral-400 pb-1 text-[9px] font-semibold uppercase tracking-[0.12em] text-neutral-700 transition-colors hover:border-black hover:text-black">
            {localizeCopy('逛折扣', 'Shopping')}
          </button>
          <div className="flex items-center gap-2">
            {archiveSearchOpen && (
              <input
                autoFocus
                value={archiveSearch}
                onChange={event => setArchiveSearch(event.target.value)}
                onKeyDown={event => {
                  if (event.key === 'Escape') setArchiveSearchOpen(false);
                }}
                placeholder={localizeCopy('搜索风格…', 'Cerca una storia...')}
                aria-label={localizeCopy('搜索时尚内容', 'Cerca nella moda')}
                className="w-32 border-b border-neutral-400 bg-transparent px-1 py-1 text-xs font-normal normal-case tracking-normal outline-none placeholder:text-neutral-500 focus:border-neutral-950 sm:w-44"
              />
            )}
            <button
              type="button"
              onClick={() => setArchiveSearchOpen(value => !value)}
              aria-label={archiveSearchOpen ? localizeCopy('关闭搜索', 'Chiudi ricerca') : localizeCopy('搜索时尚内容', 'Cerca nella moda')}
              aria-expanded={archiveSearchOpen}
              className="flex h-8 w-8 items-center justify-center text-neutral-700 transition-colors hover:text-black"
            >
              <Search className="h-4 w-4" strokeWidth={1.8} />
            </button>
          </div>
        </div>
      </header>

      <div id="fashion-visuals" className="mx-auto max-w-[1680px] px-3 pb-14 sm:px-8 lg:px-12">
        <section id="fashion-archive" className="pb-10 pt-8 sm:pb-16 sm:pt-12">
          <div className="mb-6 flex flex-col gap-4 border-b border-neutral-300 pb-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
              <button type="button" onClick={() => { setActiveTag(''); setArchiveSearch(''); }} aria-pressed={!activeTag} className={`shrink-0 border px-3 py-2 text-[9px] font-semibold uppercase tracking-[0.1em] transition-colors ${!activeTag ? 'border-black bg-black text-white' : 'border-neutral-300 text-neutral-600 hover:border-black'}`}>{localizeCopy('全部', 'Tutte')}</button>
              {categoryOptions.map(tag => <button key={tag.zh} type="button" onClick={() => { setActiveTag(tag.zh); setArchiveSearch(''); }} aria-pressed={activeTag === tag.zh} className={`shrink-0 border px-3 py-2 text-[9px] font-semibold uppercase tracking-[0.1em] transition-colors ${activeTag === tag.zh ? 'border-black bg-black text-white' : 'border-neutral-300 text-neutral-600 hover:border-black'}`}>{localizeCopy(tag.zh, tag.it)}</button>)}
            </div>
          </div>

          <div className="space-y-3 sm:space-y-4">
            {fashionGallerySections.map((section, sectionIndex) => (
              <div key={`${section.size}-${sectionIndex}`} className={`grid gap-3 sm:gap-4 ${section.size === 'medium' ? 'grid-cols-2' : 'grid-cols-1'}`}>
                {section.items.map(({ item, size, index }) => renderArchiveCard(item, index, size))}
              </div>
            ))}
          </div>
          {filteredArchiveItems.length === 0 && <p className="py-16 text-center text-sm text-neutral-500">{localizeCopy('没有找到匹配的内容。', 'Nessuna storia corrispondente.')}</p>}
          {feedMode !== 'videos' && publicPosts.length > 0 && hasMorePosts && (
            <button type="button" onClick={() => setShowComposer(true)} className="mt-8 w-full border border-neutral-300 py-3 text-xs font-semibold hover:border-black">
              {localizeCopy('发布你的时尚灵感', 'Condividi una storia')}
            </button>
          )}
        </section>
      </div>
    </main>

      {feedOpen && <div className="fixed inset-0 z-[65] bg-neutral-950 text-white">
        <div className="absolute inset-x-3 top-[calc(env(safe-area-inset-top)+0.5rem)] z-20 flex h-9 items-center justify-between gap-2">
          <nav aria-label={localizeCopy('时尚内容导航', 'Navigazione moda')} className="flex min-w-0 flex-1 items-center justify-around gap-0.5">
            <button
              type="button"
              onClick={() => {
                setDraftFeedCity(feedCity);
                setDraftFeedCategory(feedCategory);
                setDraftFeedSeason(feedSeason);
                setFeedFiltersOpen(value => !value);
                setFeedSearchOpen(false);
              }}
              aria-expanded={feedFiltersOpen}
              aria-label={localizeCopy('城市、分类和季节筛选', 'Filtri città, categoria e stagione')}
              className={`relative flex h-9 min-w-8 items-center justify-center px-1.5 text-[10px] font-medium transition-colors hover:text-white ${feedFiltersOpen || feedCity || feedCategory || feedSeason ? 'text-white' : 'text-white/75'}`}
            >
              <MapPin className="mr-0.5 h-3.5 w-3.5" />
              {localizeCopy('定位', 'Città')}
              {(feedFiltersOpen || feedCity || feedCategory || feedSeason) && <span className="absolute inset-x-1 bottom-0 h-0.5 rounded-full bg-white" />}
            </button>
            <button type="button" aria-pressed={feedMode === 'following'} onClick={() => void changeFeedMode('following')} className={`relative flex h-9 min-w-8 items-center justify-center px-1.5 text-[10px] font-medium transition-colors hover:text-white ${feedMode === 'following' ? 'text-white' : 'text-white/70'}`}>
              {localizeCopy('关注', 'Seguiti')}
              {feedMode === 'following' && <span className="absolute inset-x-1 bottom-0 h-0.5 rounded-full bg-white" />}
            </button>
            <button type="button" aria-pressed={feedMode === 'latest'} onClick={() => void changeFeedMode('latest')} className={`relative flex h-9 min-w-8 items-center justify-center px-1.5 text-[10px] font-medium transition-colors hover:text-white ${feedMode === 'latest' ? 'text-white' : 'text-white/70'}`}>
              {localizeCopy('最新', 'Recenti')}
              {feedMode === 'latest' && <span className="absolute inset-x-1 bottom-0 h-0.5 rounded-full bg-white" />}
            </button>
            <button type="button" aria-pressed={feedMode === 'saved'} onClick={() => void changeFeedMode('saved')} className={`relative flex h-9 min-w-8 items-center justify-center px-1.5 text-[10px] font-medium transition-colors hover:text-white ${feedMode === 'saved' ? 'text-white' : 'text-white/70'}`}>
              {localizeCopy('收藏', 'Salvati')}
              {feedMode === 'saved' && <span className="absolute inset-x-1 bottom-0 h-0.5 rounded-full bg-white" />}
            </button>
            <button type="button" onClick={() => { setFeedOpen(false); navigateToCatalog(); }} className="flex h-9 min-w-8 items-center justify-center px-1.5 text-[10px] font-medium text-white/70 transition-colors hover:text-white">
              {localizeCopy('商城', 'Shop')}
            </button>
            <button type="button" aria-pressed={feedMode === 'for-you'} onClick={() => void changeFeedMode('for-you')} className={`relative flex h-9 min-w-8 items-center justify-center px-1.5 text-[10px] font-medium transition-colors hover:text-white ${feedMode === 'for-you' ? 'text-white' : 'text-white/70'}`}>
              {localizeCopy('推荐', 'Per te')}
              {feedMode === 'for-you' && <span className="absolute inset-x-1 bottom-0 h-0.5 rounded-full bg-white" />}
            </button>
            <button type="button" onClick={() => void openNotifications()} aria-label={localizeCopy('消息通知', 'Notifiche')} className="relative flex h-9 w-8 shrink-0 items-center justify-center text-white/85 transition-colors hover:text-white">
              <MessageCircle className="h-5 w-5" strokeWidth={1.8} />
              {notificationUnread > 0 && <span className="absolute right-0 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-white px-1 text-[8px] font-bold text-neutral-950">{notificationUnread > 99 ? '99+' : notificationUnread}</span>}
            </button>
            <button type="button" onClick={() => { setFeedSearchOpen(value => !value); setFeedFiltersOpen(false); }} aria-label={localizeCopy('搜索内容', 'Cerca contenuti')} aria-expanded={feedSearchOpen} className={`flex h-9 w-8 shrink-0 items-center justify-center text-white/85 transition-colors hover:text-white ${feedSearchOpen ? 'text-white' : ''}`}>
              <Search className="h-5 w-5" strokeWidth={1.8} />
            </button>
          </nav>
        </div>
        {feedSearchOpen && (
          <form onSubmit={event => { event.preventDefault(); void runFeedSearch(feedSearchQuery); }} className="absolute left-3 right-3 top-[calc(env(safe-area-inset-top)+3.25rem)] z-20 flex h-10 items-center gap-2 rounded-full border border-white/15 bg-neutral-950/90 px-3 backdrop-blur-xl">
            <Search className="h-4 w-4 shrink-0 text-white/60" />
            <input
              autoFocus
              value={feedSearchQuery}
              onChange={event => setFeedSearchQuery(event.target.value)}
              placeholder={localizeCopy('搜索商家或内容', 'Cerca negozi o contenuti')}
              aria-label={localizeCopy('搜索商家或内容', 'Cerca negozi o contenuti')}
              className="min-w-0 flex-1 bg-transparent text-xs text-white outline-none placeholder:text-white/45"
            />
            <button type="submit" className="shrink-0 rounded-full bg-white px-2.5 py-1 text-[10px] font-semibold text-neutral-950">{localizeCopy('搜索', 'Cerca')}</button>
            <button type="button" onClick={() => { setFeedSearchQuery(''); setSearchResults(null); setSearchError(''); setFeedSearchOpen(false); }} aria-label={localizeCopy('清除搜索并关闭', 'Cancella e chiudi')} className="flex h-7 w-7 items-center justify-center text-white/65 hover:text-white"><X className="h-4 w-4" /></button>
          </form>
        )}
        {feedSearchOpen && (searchLoading || searchError || searchResults) && (
          <div className="absolute left-3 right-3 top-[calc(env(safe-area-inset-top)+6rem)] z-20 max-h-[min(64svh,34rem)] overflow-y-auto rounded-2xl border border-white/15 bg-neutral-950/95 p-3 text-white shadow-2xl backdrop-blur-xl">
            {searchLoading ? (
              <div className="flex justify-center py-8"><LoaderCircle className="h-5 w-5 animate-spin text-white/60" /></div>
            ) : searchError ? (
              <p className="py-6 text-center text-xs text-rose-200">{searchError}</p>
            ) : searchResults ? (
              <div className="space-y-4">
                {searchResults.creators.length > 0 && (
                  <section>
                    <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/55">{localizeCopy('创作者', 'Creator')}</p>
                    <div className="space-y-1">
                      {searchResults.creators.map(creator => (
                        <button key={creator.id} type="button" onClick={() => { setFeedSearchOpen(false); setCreatorId(creator.id); }} className="flex w-full items-center gap-2 rounded-xl px-2 py-1.5 text-left hover:bg-white/10">
                          {creator.avatarUrl
                            ? <img src={creator.avatarUrl} alt="" loading="lazy" referrerPolicy="no-referrer" className="h-8 w-8 rounded-full object-cover" />
                            : <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15 text-[10px]">{creator.displayName.slice(0, 1)}</span>}
                          <span className="min-w-0">
                            <span className="block truncate text-[11px] font-semibold">{creator.displayName}</span>
                            {creator.bio && <span className="block truncate text-[9px] text-white/50">{creator.bio}</span>}
                          </span>
                        </button>
                      ))}
                    </div>
                  </section>
                )}
                {searchResults.merchants.length > 0 && (
                  <section>
                    <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/55">{localizeCopy('商家', 'Negozi')}</p>
                    <div className="space-y-1">
                      {searchResults.merchants.map(merchant => (
                        <button key={merchant.id} type="button" onClick={() => { setFeedSearchOpen(false); setFeedOpen(false); openMerchantStore(merchant.id); }} className="flex w-full items-center gap-2 rounded-xl px-2 py-1.5 text-left hover:bg-white/10">
                          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15"><ShoppingBag className="h-3.5 w-3.5" /></span>
                          <span className="min-w-0">
                            <span className="block truncate text-[11px] font-semibold">{merchant.name}</span>
                            <span className="block truncate text-[9px] text-white/50">{merchant.city || ''}{merchant.isVerified ? ' · ✓' : ''}</span>
                          </span>
                        </button>
                      ))}
                    </div>
                  </section>
                )}
                {searchResults.posts.length > 0 && (
                  <section>
                    <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/55">{localizeCopy('作品', 'Post')}</p>
                    <div className="grid grid-cols-3 gap-1">
                      {searchResults.posts.map(post => (
                        <button key={post.id} type="button" onClick={() => {
                          setFeedSearchOpen(false);
                          setPublicPosts(previous => [post, ...previous.filter(item => item.id !== post.id)]);
                          openFeed(post.id);
                        }} className="relative aspect-[3/4] overflow-hidden bg-white/10">
                          <img src={post.image || ''} alt={post.title} loading="lazy" referrerPolicy="no-referrer" className="h-full w-full object-cover" />
                          <span className="absolute inset-x-0 bottom-0 line-clamp-2 bg-black/55 px-1.5 py-1 text-left text-[9px]">{post.title}</span>
                        </button>
                      ))}
                    </div>
                  </section>
                )}
                {!searchResults.posts.length && !searchResults.creators.length && !searchResults.merchants.length && (
                  <p className="py-6 text-center text-xs text-white/60">{localizeCopy('没有找到相关内容。', 'Nessun risultato.')}</p>
                )}
              </div>
            ) : null}
          </div>
        )}
        {feedFiltersOpen && (
          <section className="absolute left-3 right-3 top-[calc(env(safe-area-inset-top)+3.25rem)] z-20 max-h-[min(72svh,38rem)] overflow-y-auto rounded-2xl border border-white/15 bg-neutral-950/95 p-4 shadow-2xl backdrop-blur-xl sm:left-4 sm:right-auto sm:w-[22rem]">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-semibold">{localizeCopy('城市与分类', 'Città e categorie')}</h2>
              <button type="button" onClick={() => setFeedFiltersOpen(false)} aria-label={localizeCopy('关闭', 'Chiudi')} className="rounded-full p-1 text-white/70 hover:bg-white/10 hover:text-white"><X className="h-4 w-4" /></button>
            </div>
            <p className="mt-4 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/55">{localizeCopy('城市', 'Città')}</p>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {(['', ...fashionCities] as const).map(city => (
                <button key={city || 'all-cities'} type="button" aria-pressed={draftFeedCity === city} onClick={() => setDraftFeedCity(city)} className={`min-h-9 rounded-lg border px-2 text-[10px] transition-colors ${draftFeedCity === city ? 'border-white bg-white text-neutral-950' : 'border-white/15 text-white/75 hover:bg-white/10'}`}>
                  {city || localizeCopy('全部城市', 'Tutte le città')}
                </button>
              ))}
            </div>
            <p className="mt-4 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/55">{localizeCopy('时尚分类', 'Categoria moda')}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button type="button" aria-pressed={!draftFeedCategory} onClick={() => setDraftFeedCategory('')} className={`rounded-full border px-3 py-1.5 text-[10px] transition-colors ${!draftFeedCategory ? 'border-white bg-white text-neutral-950' : 'border-white/15 text-white/75 hover:bg-white/10'}`}>{localizeCopy('全部分类', 'Tutte le categorie')}</button>
              {categoryOptions.map(tag => <button key={tag.zh} type="button" aria-pressed={draftFeedCategory === tag.zh} onClick={() => setDraftFeedCategory(tag.zh)} className={`rounded-full border px-3 py-1.5 text-[10px] transition-colors ${draftFeedCategory === tag.zh ? 'border-white bg-white text-neutral-950' : 'border-white/15 text-white/75 hover:bg-white/10'}`}>{localizeCopy(tag.zh, tag.it)}</button>)}
            </div>
            <p className="mt-4 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/55">{localizeCopy('季节', 'Stagione')}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button type="button" aria-pressed={!draftFeedSeason} onClick={() => setDraftFeedSeason('')} className={`rounded-full border px-3 py-1.5 text-[10px] transition-colors ${!draftFeedSeason ? 'border-white bg-white text-neutral-950' : 'border-white/15 text-white/75 hover:bg-white/10'}`}>{localizeCopy('全部季节', 'Tutte le stagioni')}</button>
              {fashionSeasons.map(season => <button key={season} type="button" aria-pressed={draftFeedSeason === season} onClick={() => setDraftFeedSeason(season)} className={`rounded-full border px-3 py-1.5 text-[10px] transition-colors ${draftFeedSeason === season ? 'border-white bg-white text-neutral-950' : 'border-white/15 text-white/75 hover:bg-white/10'}`}>{season}</button>)}
            </div>
            {discoverTags.length > 0 && (
              <div className="mt-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/55">{localizeCopy('热门话题', 'Temi caldi')}</p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {discoverTags.map(tag => (
                    <button key={tag.tag} type="button" onClick={() => { setFeedFiltersOpen(false); void runFeedSearch(tag.tag); }} className="rounded-full border border-white/15 px-2.5 py-1 text-[10px] text-white/75 hover:bg-white/10">#{tag.tag} · {tag.posts}</button>
                  ))}
                </div>
              </div>
            )}
            <p className="mt-4 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/55">{localizeCopy('内容流', 'Feed')}</p>
            <div className="mt-2 grid grid-cols-5 gap-1">
              {([
                ['for-you', localizeCopy('推荐', 'Per te')],
                ['latest', localizeCopy('最新', 'Recenti')],
                ['videos', localizeCopy('视频', 'Video')],
                ['following', localizeCopy('关注', 'Seguiti')],
                ['saved', localizeCopy('收藏', 'Preferiti')]
              ] as const).map(([mode, label]) => (
                <button key={mode} type="button" disabled={loadingMorePosts} aria-pressed={feedMode === mode} onClick={() => { setFeedFiltersOpen(false); void changeFeedMode(mode); }} className={`min-h-8 rounded-full border px-1 text-[9px] transition-colors disabled:opacity-50 ${feedMode === mode ? 'border-white bg-white text-neutral-950' : 'border-white/15 text-white/75 hover:bg-white/10'}`}>{label}</button>
              ))}
            </div>
            {(Object.keys(tasteProfile).length > 0 || dismissedRecommendationIds.length > 0) && <button type="button" onClick={resetTasteProfile} title={localizeCopy('重置本设备的推荐偏好', 'Reimposta le preferenze')} className="mt-4 rounded-full border border-white/15 px-3 py-1.5 text-[10px] text-white/65 hover:bg-white/10 hover:text-white">{localizeCopy('重置推荐', 'Reimposta')}</button>}
            <button type="button" disabled={loadingMorePosts} onClick={() => void applyFeedFilters()} className="mt-5 min-h-10 w-full rounded-lg bg-white text-xs font-semibold text-neutral-950 transition-colors hover:bg-neutral-200 disabled:opacity-50">{loadingMorePosts ? localizeCopy('加载中…', 'Caricamento…') : localizeCopy('查看内容', 'Mostra i contenuti')}</button>
          </section>
        )}
      {feedMode === 'stores' && (
        <div className="absolute left-1/2 top-[calc(env(safe-area-inset-top)+5.75rem)] z-10 flex -translate-x-1/2 items-center gap-1 rounded-full border border-white/15 bg-black/55 p-1 backdrop-blur-md">
          <button type="button" aria-pressed={!merchantFollowedOnly} onClick={() => { setMerchantFollowedOnly(false); setActiveFeedIndex(0); feedScrollRef.current?.scrollTo({ left: 0 }); }} className={`rounded-full px-3 py-1.5 text-[10px] transition-colors ${!merchantFollowedOnly ? 'bg-white text-neutral-950' : 'text-white/75 hover:bg-white/10'}`}>{localizeCopy('全店', 'Tutti')}</button>
          <button type="button" aria-pressed={merchantFollowedOnly} onClick={() => { setMerchantFollowedOnly(true); setActiveFeedIndex(0); feedScrollRef.current?.scrollTo({ left: 0 }); }} className={`rounded-full px-3 py-1.5 text-[10px] transition-colors ${merchantFollowedOnly ? 'bg-white text-neutral-950' : 'text-white/75 hover:bg-white/10'}`}>{localizeCopy('已关', 'Seguiti')}</button>
        </div>
      )}
      <div
        ref={feedScrollRef}
        aria-label={feedMode === 'stores' ? localizeCopy('公开商家', 'Negozio pubblico') : localizeCopy('时尚视频信息流', 'Feed moda')}
        onScroll={event => {
          const root = event.currentTarget;
          if (feedMode === 'stores' && root.clientWidth > 0 && visibleMerchantCards.length > 0) {
            setActiveFeedIndex(Math.min(
              visibleMerchantCards.length - 1,
              Math.max(0, Math.floor((root.scrollLeft + root.clientWidth / 2) / root.clientWidth))
            ));
          } else if (root.clientHeight > 0 && visibleFeedItems.length > 0) {
            setActiveFeedIndex(Math.min(
              visibleFeedItems.length - 1,
              Math.max(0, Math.floor((root.scrollTop + root.clientHeight / 2) / root.clientHeight))
            ));
          }
        }}
        className={`h-[100svh] bg-neutral-900 [scrollbar-width:none] ${feedMode === 'stores' ? 'flex snap-x snap-mandatory overflow-x-auto overflow-y-hidden overscroll-x-contain' : 'snap-y snap-mandatory overflow-y-auto overscroll-y-contain'}`}
      >
        {feedMode === 'stores' ? (
          merchantsLoading ? (
            <div className="flex h-[100svh] w-full shrink-0 items-center justify-center gap-2 text-xs text-white/70"><LoaderCircle className="h-4 w-4 animate-spin" />{localizeCopy('正在加载商家…', 'Caricamento negozi…')}</div>
          ) : visibleMerchantCards.length ? visibleMerchantCards.map((merchant, index) => {
            const socialId = `merchant-${merchant.id}`;
            const followItem: FeedItem = {
              id: `merchant-card-${merchant.id}`,
              image: merchant.banner || merchant.showroomImage || merchant.logo || null,
              title: merchant.name,
              text: merchant.description,
              sourceName: merchant.name,
              creatorId: socialId,
              mediaType: merchant.storefrontVideo && !failedMerchantVideos[merchant.id] ? 'video' : 'image',
              videoUrl: merchant.storefrontVideo && !failedMerchantVideos[merchant.id] ? merchant.storefrontVideo : null
            };
            const imageUrl = failedMerchantVideos[`${merchant.id}:image`]
              ? merchant.logo
              : merchant.banner || merchant.showroomImage || merchant.logo;
            const title = merchant.name;
            const intro = (isIt
              ? merchant.description_it || merchant.description || merchant.tagline_it || merchant.tagline
              : merchant.description_zh || merchant.description || merchant.tagline_zh || merchant.tagline).trim();
            const socialStats = socialById[socialId];
            return (
              <article key={merchant.id} className="relative h-[100svh] min-h-[100svh] w-full shrink-0 snap-center snap-always overflow-hidden bg-neutral-900">
                {followItem.videoUrl ? (
                  <video
                    src={followItem.videoUrl}
                    poster={imageUrl || undefined}
                    muted
                    loop
                    playsInline
                    preload="metadata"
                    autoPlay={index === activeFeedIndex}
                    onError={() => setFailedMerchantVideos(previous => ({ ...previous, [merchant.id]: true }))}
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                ) : imageUrl ? (
                  <img
                    src={imageUrl}
                    alt={title}
                    loading={index < 2 ? 'eager' : 'lazy'}
                    referrerPolicy="no-referrer"
                    onError={() => {
                      if (imageUrl !== merchant.logo) setFailedMerchantVideos(previous => ({ ...previous, [`${merchant.id}:image`]: true }));
                    }}
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                ) : <div className="absolute inset-0 bg-neutral-800" />}
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/15 to-black/25" />
                <div className="absolute bottom-[calc(env(safe-area-inset-bottom)+6.8rem)] left-5 right-5 max-w-2xl sm:bottom-24 sm:left-10">
                  <div className="mb-3 flex items-center gap-2 text-[9px] font-semibold uppercase tracking-[0.2em] text-white/75">
                    <span>{localizeCopy('公开商家', 'Negozio pubblico')}</span>
                    {merchant.isVerified && <span className="rounded-full border border-white/40 px-2 py-0.5">{localizeCopy('已认证', 'OK')}</span>}
                    {merchant.city && <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{isIt ? merchant.city_it || merchant.city : merchant.city_zh || merchant.city}</span>}
                  </div>
                  <h2 className="font-serif text-4xl font-medium leading-tight sm:text-6xl">{title}</h2>
                  {intro && <p className="mt-3 line-clamp-4 max-w-xl whitespace-pre-line text-sm leading-6 text-white/90 sm:text-base">{intro}</p>}
                  {merchant.specialties.length > 0 && <div className="mt-3 flex flex-wrap gap-1.5">
                    {merchant.specialties.slice(0, 4).map(specialty => <span key={specialty} className="rounded-full border border-white/30 bg-black/20 px-2.5 py-1 text-[9px] text-white/85 backdrop-blur-sm">{specialty}</span>)}
                  </div>}
                  <div className="mt-5 flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => void toggleFollow(followItem)}
                      disabled={socialPending[`${socialId}:follow`]}
                      className={`inline-flex min-h-10 items-center gap-2 rounded-full px-4 text-xs font-semibold transition-colors disabled:opacity-60 ${socialStats?.following ? 'bg-white/15 text-white ring-1 ring-white/40 hover:bg-white/25' : 'bg-white text-neutral-950 hover:bg-neutral-200'}`}
                    >
                      {socialStats?.following ? <Heart className="h-3.5 w-3.5 fill-current" /> : <UserRoundPlus className="h-3.5 w-3.5" />}
                      {socialStats?.following ? localizeCopy('已关注', 'Seguiti') : localizeCopy('关注商家', 'Segui negozio')}
                      <span className="text-[10px] opacity-70">{socialStats?.followersCount || 0}</span>
                    </button>
                    <button type="button" onClick={() => openMerchantStore(merchant.id)} className="inline-flex min-h-10 items-center gap-2 rounded-full border border-white/50 bg-black/20 px-4 text-xs font-semibold text-white backdrop-blur-sm transition-colors hover:bg-white/15">
                      {localizeCopy('查看店铺', 'Negozio')} <ArrowUpRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                <div className="absolute bottom-[calc(env(safe-area-inset-bottom)+6rem)] right-4 rounded-full border border-white/20 bg-black/30 px-3 py-1.5 text-[10px] text-white/80 backdrop-blur-md">
                  {String(index + 1).padStart(2, '0')} / {String(visibleMerchantCards.length).padStart(2, '0')} · {localizeCopy('左滑浏览', 'Scorri a sinistra')}
                </div>
              </article>
            );
          }) : (
            <div className="flex h-[100svh] w-full shrink-0 flex-col items-center justify-center px-8 text-center">
              <UserRoundPlus className="h-10 w-10 text-white/70" />
              <h2 className="mt-4 font-serif text-2xl">{merchantFollowedOnly ? localizeCopy('还没有关注的商家', 'Nessun negozio seguito') : localizeCopy('暂时没有符合条件的商家', 'Nessun negozio corrispondente')}</h2>
              <p className="mt-2 max-w-xs text-xs leading-5 text-white/65">{merchantFollowedOnly ? localizeCopy('返回全部商家，发现并关注喜欢的品牌。', 'Torna a tutti i negozi per scoprire i brand.') : localizeCopy('试试其他城市或分类。', 'Prova un’altra città o categoria.')}</p>
              {merchantFollowedOnly
                ? <button type="button" onClick={() => setMerchantFollowedOnly(false)} className="mt-5 rounded-full bg-white px-5 py-2.5 text-xs font-semibold text-black">{localizeCopy('查看全部商家', 'Visualizza tutti i negozi')}</button>
                : <button type="button" onClick={() => { setDraftFeedCity(feedCity); setDraftFeedCategory(feedCategory); setFeedFiltersOpen(true); }} className="mt-5 rounded-full border border-white/40 px-4 py-2 text-xs font-semibold text-white">{localizeCopy('更改筛选', 'Modifica filtri')}</button>}
            </div>
          )
        ) : <>
        {feedWindowStart > 0 && <div aria-hidden="true" style={{ height: feedViewportHeight * feedWindowStart }} />}
        {virtualFeedItems.map((item, windowIndex) => {
          const index = feedWindowStart + windowIndex;
          const isSingleVideo = Boolean(item.videoUrl) && !(item.mediaItems && item.mediaItems.length > 1);
          return (
          <React.Fragment key={`${item.id}-${index}`}>
          <article data-feed-index={index} data-feed-id={item.id} ref={node => { if (node) feedCardRefs.current.set(item.id, node); else feedCardRefs.current.delete(item.id); }} className="relative h-[100svh] min-h-[100svh] snap-start snap-always overflow-hidden bg-neutral-900 [content-visibility:auto] [contain-intrinsic-size:0_100svh]">
            {item.mediaItems && item.mediaItems.length > 1 ? (
              <div
                data-feed-gallery={item.id}
                onScroll={event => {
                  const element = event.currentTarget;
                  const width = element.clientWidth || 1;
                  const next = Math.max(0, Math.min(item.mediaItems!.length - 1, Math.round(element.scrollLeft / width)));
                  setFeedMediaIndexById(previous => previous[item.id] === next ? previous : { ...previous, [item.id]: next });
                }}
                className="absolute inset-0 z-[1] flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              >
                {item.mediaItems.map((media, mediaIndex) => <div key={`${item.id}-media-${mediaIndex}`} className="relative h-full w-full shrink-0 snap-center bg-neutral-950">
                  {media.type === 'video'
                    ? <video src={media.url} poster={media.posterUrl} muted loop playsInline controls preload={mediaIndex === 0 ? 'metadata' : 'none'} aria-label={`${item.title} ${mediaIndex + 1}`} onError={() => console.warn('[fashion-feed-video-load]', `${item.id}:${mediaIndex}`)} className="h-full w-full object-contain" />
                    : <img src={media.url} alt={`${item.title} ${mediaIndex + 1}`} loading={index < 2 ? 'eager' : 'lazy'} referrerPolicy="no-referrer" onClick={() => handleFeedImageTap(item, item.mediaItems!.slice(0, mediaIndex).filter(entry => entry.type === 'image').length)} className="h-full w-full object-cover" />}
                </div>)}
              </div>
            ) : item.mediaType === 'video' && item.videoUrl ? (
              <video
                ref={node => {
                  if (node) {
                    node.dataset.itemId = item.id;
                    feedVideoRefs.current.set(item.id, node);
                  } else feedVideoRefs.current.delete(item.id);
                }}
                src={item.videoUrl}
                poster={item.image || undefined}
                muted={activeSoundId !== item.id}
                loop
                playsInline
                preload={index <= activeFeedIndex + 1 ? 'metadata' : 'none'}
                onClick={() => handleFeedMediaTap(item)}
                onTimeUpdate={event => {
                  if (index === activeFeedIndex && event.currentTarget.duration) {
                    setVideoProgress(event.currentTarget.currentTime / event.currentTarget.duration);
                  }
                }}
                onEnded={event => trackPostView(item, Math.round(event.currentTarget.duration * 1000), true)}
                onLoadedMetadata={event => {
                  if (index === activeFeedIndex && event.currentTarget.duration) {
                    setVideoProgress(event.currentTarget.currentTime / event.currentTarget.duration);
                  }
                }}
                onError={() => console.warn('[fashion-feed-video-load]', item.id)}
                className="absolute inset-0 h-full w-full cursor-pointer object-cover"
              />
            ) : item.image ? (
              <img
                src={item.image}
                alt={item.title}
                className="absolute inset-0 h-full w-full object-cover"
                loading={index < 2 ? 'eager' : 'lazy'}
                referrerPolicy="no-referrer"
                onClick={() => handleFeedImageTap(item, 0)}
              />
            ) : <div className="absolute inset-0 bg-neutral-900" />}
            {item.mediaItems && item.mediaItems.length > 1 && (
              <div className="absolute left-1/2 top-[calc(env(safe-area-inset-top)+4.5rem)] z-[3] flex -translate-x-1/2 items-center gap-1 rounded-full bg-black/40 pl-1 pr-1 text-white backdrop-blur-sm" aria-label={localizeCopy('多图浏览', 'Galleria')}>
                <button type="button" onClick={() => scrollFeedGallery(item.id, -1)} disabled={(feedMediaIndexById[item.id] || 0) <= 0} aria-label={localizeCopy('上一张', 'Immagine precedente')} className="flex h-7 w-7 items-center justify-center rounded-full disabled:opacity-30">‹</button>
                <span className="min-w-8 text-center text-[10px] tabular-nums">{Math.min(item.mediaItems.length, (feedMediaIndexById[item.id] || 0) + 1)} / {item.mediaItems.length}</span>
                <button type="button" onClick={() => scrollFeedGallery(item.id, 1)} disabled={(feedMediaIndexById[item.id] || 0) >= item.mediaItems.length - 1} aria-label={localizeCopy('下一张', 'Immagine successiva')} className="flex h-7 w-7 items-center justify-center rounded-full disabled:opacity-30">›</button>
              </div>
            )}
            {heartBurstId === item.id && <div className="pointer-events-none absolute inset-0 z-[2] flex items-center justify-center"><Heart className="h-20 w-20 animate-[pulse_0.35s_ease-in-out_2] fill-rose-500 text-rose-500 drop-shadow-xl" /></div>}
            {isSingleVideo && pausedVideoIds[item.id] && (
              <button type="button" onClick={() => {
                const video = feedVideoRefs.current.get(item.id);
                if (!video) return;
                void video.play().then(() => setPausedVideoIds(previous => ({ ...previous, [item.id]: false }))).catch(error => console.warn('[fashion-feed-video-playback]', error));
              }} className="absolute left-1/2 top-1/2 z-[1] flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur" aria-label={localizeCopy('播放视频', 'Riproduci video')}>
                <Play className="ml-1 h-6 w-6 fill-current" />
              </button>
            )}
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-black/25" />
            {isSingleVideo && <div className="absolute inset-x-0 bottom-0 z-[3] h-1 bg-white/20"><div className="h-full bg-white/90 transition-[width] duration-150" style={{ width: `${Math.min(100, Math.max(0, videoProgress * 100))}%` }} /></div>}
            <div className="absolute bottom-[calc(env(safe-area-inset-bottom)+5.25rem)] left-4 right-[4.5rem] sm:bottom-20 sm:left-8 sm:right-20">
              {item.category && <div className="mb-2 flex flex-wrap items-center gap-1.5">
                <span className="inline-flex rounded-full border border-white/35 bg-black/25 px-2.5 py-1 text-[9px] font-semibold text-white/90 backdrop-blur-sm">{localizeTrendTag(item.category)}</span>
                {feedMode === 'for-you' && (recommendationTaste[item.category] || 0) > 0 && <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2 py-1 text-[8px] font-medium text-white/85 backdrop-blur-sm"><Sparkles className="h-2.5 w-2.5" />{localizeCopy('根据你的兴趣推荐', 'In base ai tuoi interessi')}</span>}
              </div>}
              {item.creatorId.startsWith('fashion-account-') && (
                <button
                  type="button"
                  onClick={() => openCreatorProfile(item.creatorId)}
                  className="mb-2 inline-flex items-center gap-2 rounded-full bg-black/25 py-1 pl-1 pr-3 text-[10px] font-medium text-white/90 backdrop-blur-sm transition-colors hover:bg-black/45"
                  aria-label={localizeCopy('查看创作者主页', 'Apri il profilo del creator')}
                >
                  <span className="flex h-6 w-6 items-center justify-center rounded-full border border-white/40 bg-white/15 text-[10px] font-semibold">{item.sourceName.slice(0, 1)}</span>
                  <span className="max-w-[9rem] truncate">{item.sourceName}</span>
                  <ArrowUpRight className="h-3 w-3" />
                </button>
              )}
              <h2 className="font-editorial text-2xl font-medium leading-tight sm:text-3xl">{item.title}</h2>
              {item.text && <p className="mt-1.5 line-clamp-4 font-editorial text-xs leading-5 text-white/90 sm:text-sm">{item.text}</p>}
              {translationVisible[item.id] && translations[item.id] && <p className="mt-1.5 line-clamp-4 border-l border-white/50 pl-2 font-editorial text-[11px] leading-4 text-white/85 sm:text-xs">{translations[item.id]}</p>}
              {item.hashtags && item.hashtags.length > 0 && <div className="mt-2 flex flex-wrap gap-1.5">{item.hashtags.map(tag => <button type="button" key={`${item.id}-tag-${tag}`} onClick={() => { setFeedSearchQuery(`#${tag}`); setFeedSearchOpen(true); }} className="rounded-full bg-black/25 px-2 py-1 text-[10px] text-white/90 backdrop-blur-sm">#{tag}</button>)}</div>}
              {item.products && item.products.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5" aria-label={localizeCopy('关联商品', 'Prodotti collegati')}>
                  {item.products.slice(0, 3).map(product => (
                    <button
                      key={`${item.id}-product-${product.id}`}
                      type="button"
                      onClick={() => openFeedProduct(item, product)}
                      className="flex items-center gap-2 rounded-full border border-white/25 bg-black/40 py-1 pl-1 pr-3 text-left backdrop-blur-sm transition-colors hover:bg-black/60"
                    >
                      {product.image && <img src={product.image} alt="" loading="lazy" referrerPolicy="no-referrer" className="h-6 w-6 rounded-full object-cover" />}
                      <span className="text-[10px] leading-tight text-white/90">
                        <span className="block max-w-[8rem] truncate">{product.name}</span>
                        <span className="block text-[8px] text-white/60">{product.styleNo} · €{product.retailPrice.toFixed(0)}</span>
                      </span>
                    </button>
                  ))}
                </div>
              )}
              {(item.title || item.text) && <button
                type="button"
                disabled={translationPending[item.id]}
                onClick={() => void translateFeedItem(item)}
                aria-label={translationPending[item.id]
                  ? localizeCopy('正在翻译', 'Traduzione in corso')
                  : translationVisible[item.id]
                    ? localizeCopy('隐藏翻译', 'Nascondi traduzione')
                    : localizeCopy('查看翻译', 'Traduci')}
                title={translationVisible[item.id] ? localizeCopy('隐藏翻译', 'Nascondi traduzione') : localizeCopy('查看翻译', 'Traduci')}
                className="mt-2 inline-flex min-h-8 w-8 items-center justify-center rounded-full bg-transparent text-white/70 transition-colors hover:text-white disabled:opacity-60"
              >
                {translationPending[item.id] ? <LoaderCircle className="h-3 w-3 animate-spin" /> : <Languages className="h-3 w-3" />}
              </button>}
              <button type="button" onClick={navigateToCatalog} className="mt-4 inline-flex items-center gap-2 border-b border-white/70 pb-1 text-[9px] font-semibold uppercase tracking-[0.14em]">
                {localizeCopy('发现本季精选', 'Scopri la selezione')} <ArrowUpRight className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="absolute bottom-[calc(env(safe-area-inset-bottom)+5rem)] right-2 z-[2] flex max-h-[min(64svh,30rem)] flex-col items-center gap-1.5 overflow-y-auto bg-transparent p-0 shadow-none [scrollbar-width:none] sm:bottom-20 sm:right-4 sm:gap-2">
              <button type="button" onClick={() => void toggleFollow(item)} disabled={socialPending[`${item.creatorId}:follow`]} className={feedRailButtonClass} aria-label={socialById[item.creatorId]?.following ? localizeCopy('取消关注创作者', 'Smetti di seguire il creator') : localizeCopy('关注创作者', 'Segui il creator')}>
                <span className={`relative flex h-7 w-7 items-center justify-center rounded-full border border-white/40 bg-white/20 text-xs font-semibold backdrop-blur-md ${feedRailIconClass}`}>
                  {item.sourceName.slice(0, 1)}
                  {!socialById[item.creatorId]?.following && <span className="absolute -bottom-1 flex h-3 w-3 items-center justify-center rounded-full bg-rose-500"><UserRoundPlus className="h-2 w-2" /></span>}
                </span>
                <span className="text-[8px] font-medium">{socialById[item.creatorId]?.followersCount || 0}</span>
              </button>
              <button type="button" onClick={() => void toggleReaction(item, 'like')} disabled={socialPending[`${item.id}:like`]} className={feedRailButtonClass} aria-label={socialById[item.id]?.liked ? localizeCopy('取消点赞', 'Rimuovi mi piace') : localizeCopy('点赞', 'Mi piace')}>
                <span className={`flex h-7 w-7 items-center justify-center rounded-full border border-white/40 backdrop-blur-md transition-colors duration-200 ${socialById[item.id]?.liked ? 'bg-rose-500/80 text-white' : 'bg-black/20 text-white'}`}>
                  <Heart className={`h-4 w-4 ${feedRailIconClass} ${socialById[item.id]?.liked ? 'fill-current' : ''}`} />
                </span>
                <span className="text-[8px] font-medium">{socialById[item.id]?.likesCount || 0}</span>
              </button>
              <button type="button" onClick={() => { setCommentTarget(item); setComments([]); }} className={feedRailButtonClass} aria-label={localizeCopy('打开评论', 'Apri commenti')}>
                <span className={`flex h-7 w-7 items-center justify-center rounded-full border border-white/40 bg-black/20 backdrop-blur-md ${feedRailIconClass}`}><MessageCircle className="h-4 w-4" /></span>
                <span className="text-[8px] font-medium">{socialById[item.id]?.commentsCount || 0}</span>
              </button>
              <button type="button" onClick={() => void toggleReaction(item, 'save')} disabled={socialPending[`${item.id}:save`]} className={feedRailButtonClass} aria-label={socialById[item.id]?.saved ? localizeCopy('取消收藏', 'Rimuovi dai preferiti') : localizeCopy('收藏', 'Preferiti')}>
                <span className={`flex h-7 w-7 items-center justify-center rounded-full border border-white/40 backdrop-blur-md transition-colors duration-200 ${socialById[item.id]?.saved ? 'bg-amber-400/85 text-black' : 'bg-black/20 text-white'}`}><Bookmark className={`h-4 w-4 ${feedRailIconClass} ${socialById[item.id]?.saved ? 'fill-current' : ''}`} /></span>
                <span className="text-[8px] font-medium">{socialById[item.id]?.savesCount || 0}</span>
              </button>
              {typeof item.viewsCount === 'number' && item.viewsCount > 0 && (
                <span className="flex flex-col items-center gap-1 text-white/85" aria-label={localizeCopy(`播放 ${item.viewsCount} 次`, `${item.viewsCount} visualizzazioni`)}>
                  <span className={`flex h-7 w-7 items-center justify-center rounded-full border border-white/25 bg-black/20 backdrop-blur-md ${feedRailIconClass}`}><Play className="h-3.5 w-3.5" /></span>
                  <span className="text-[8px] font-medium">{item.viewsCount > 999 ? `${(item.viewsCount / 1000).toFixed(1)}k` : item.viewsCount}</span>
                </span>
              )}
              {isSingleVideo && (
                <>
                <button type="button" onClick={() => {
                  const video = feedVideoRefs.current.get(item.id);
                  if (!video) return;
                  if (video.paused) {
                    void video.play().then(() => setPausedVideoIds(previous => ({ ...previous, [item.id]: false }))).catch(error => console.warn('[fashion-feed-video-playback]', error));
                  } else {
                    video.pause();
                    setPausedVideoIds(previous => ({ ...previous, [item.id]: true }));
                  }
                }} className={feedRailButtonClass} aria-label={pausedVideoIds[item.id] ? localizeCopy('播放视频', 'Riproduci video') : localizeCopy('暂停视频', 'Metti in pausa il video')}>
                  <span className={`flex h-7 w-7 items-center justify-center rounded-full border border-white/40 bg-black/20 backdrop-blur-md ${feedRailIconClass}`}>{pausedVideoIds[item.id] ? <Play className="h-4 w-4 fill-current" /> : <Pause className="h-4 w-4" />}</span>
                  <span className="text-[8px] font-medium">{pausedVideoIds[item.id] ? localizeCopy('播放', 'Play') : localizeCopy('暂停', 'Pausa')}</span>
                </button>
                <button type="button" onClick={() => setActiveSoundId(value => value === item.id ? null : item.id)} className={feedRailButtonClass} aria-label={activeSoundId === item.id ? localizeCopy('关闭声音', 'Disattiva audio') : localizeCopy('打开声音', 'Attiva audio')}>
                  <span className={`flex h-7 w-7 items-center justify-center rounded-full border border-white/40 bg-black/20 backdrop-blur-md ${feedRailIconClass}`}>{activeSoundId === item.id ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}</span>
                  <span className="text-[8px] font-medium">{activeSoundId === item.id ? localizeCopy('声音开', 'Audio attivo') : localizeCopy('静音', 'Muto')}</span>
                </button>
                </>
              )}
              {(item.image || item.videoUrl) && (
                  <button type="button" onClick={() => setMediaActionsItemId(current => current === item.id ? null : item.id)} className={feedRailButtonClass} aria-label={localizeCopy('更多操作', 'Altre opzioni')} aria-expanded={mediaActionsItemId === item.id}>
                    <span className={`flex h-7 w-7 items-center justify-center rounded-full border border-white/40 bg-black/20 backdrop-blur-md ${feedRailIconClass}`}><MoreVertical className="h-4 w-4" /></span>
                    <span className="text-[8px] font-medium">{localizeCopy('更多', 'Altro')}</span>
                  </button>
              )}
            </div>
            {mediaActionsItemId === item.id && (
              <div role="menu" aria-label={localizeCopy('内容操作', 'Azioni media')} className="absolute bottom-[calc(env(safe-area-inset-bottom)+1rem)] right-[3.5rem] z-[4] flex w-48 flex-col gap-1 rounded-2xl border border-white/15 bg-neutral-950/85 p-2 text-left shadow-2xl backdrop-blur-xl sm:bottom-10 sm:right-16">
                <button role="menuitem" type="button" onClick={() => void shareFeedItem(item)} className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-[11px] hover:bg-white/10"><Share2 className="h-4 w-4 shrink-0" />{localizeCopy('分享内容', 'Condividi')}</button>
                <button role="menuitem" type="button" onClick={() => void copyFeedItemLink(item)} className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-[11px] hover:bg-white/10"><Link2 className="h-4 w-4 shrink-0" />{localizeCopy('复制链接', 'Copia link')}</button>
                <button role="menuitem" type="button" onClick={() => void downloadFeedItem(item)} className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-[11px] hover:bg-white/10"><Download className="h-4 w-4 shrink-0" />{item.videoUrl ? (localizeCopy('下载视频', 'Scarica video')) : (localizeCopy('下载图片', 'Scarica immagine'))}</button>
                {item.videoUrl && item.image && <button role="menuitem" type="button" onClick={() => void downloadFeedItem(item, item.image, 'cover')} className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-[11px] hover:bg-white/10"><Camera className="h-4 w-4 shrink-0" />{localizeCopy('下载视频封面', 'Scarica copertina')}</button>}
                <span className="mx-2 h-px bg-white/15" />
                <button role="menuitem" type="button" onClick={() => { setMediaActionsItemId(null); setReportTarget({ type: 'post', id: item.id, label: item.title }); }} className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-[11px] text-rose-200 hover:bg-white/10"><Flag className="h-4 w-4 shrink-0" />{localizeCopy('举报内容', 'Segnala contenuto')}</button>
                {feedMode === 'for-you' && <>
                  <span className="mx-2 h-px bg-white/15" />
                  <button role="menuitem" type="button" onClick={() => { dismissRecommendedItem(item); void hideFeedItem(item); }} className="rounded-xl px-3 py-2.5 text-left text-[11px] text-white/85 hover:bg-white/10">{localizeCopy('不感兴趣', 'Non mi interessa')}</button>
                  <button role="menuitem" type="button" onClick={() => reduceRecommendedCategory(item)} className="rounded-xl px-3 py-2.5 text-left text-[11px] text-white/85 hover:bg-white/10">{localizeCopy('少看这类内容', 'Mostra meno contenuti simili')}</button>
                  {item.creatorId && !item.creatorId.startsWith('creator-ruda-community') && <button role="menuitem" type="button" onClick={() => { setMediaActionsItemId(null); void blockCreator(item.creatorId); }} className="rounded-xl px-3 py-2.5 text-left text-[11px] text-rose-200 hover:bg-white/10">{localizeCopy('屏蔽作者', 'Blocca autore')}</button>}
                </>}
              </div>
            )}
            {index === lastCommunityFeedIndex && hasMorePosts && (
              <div ref={feedEndRef} className="pointer-events-none absolute inset-x-0 bottom-2 h-1" aria-hidden="true" />
            )}
          </article>
          </React.Fragment>
          );
        })}
        {feedWindowEnd < visibleFeedItems.length && <div aria-hidden="true" style={{ height: feedViewportHeight * (visibleFeedItems.length - feedWindowEnd) }} />}
        {visibleFeedItems.length === 0 && !loadingMorePosts && (feedMode === 'following' || feedMode === 'saved' || feedMode === 'videos' || feedCity || feedCategory) && (
          <div className="flex h-[100svh] flex-col items-center justify-center px-8 text-center">
            {(feedCity || feedCategory) ? <MapPin className="h-10 w-10 text-white/70" /> : feedMode === 'saved' ? <Bookmark className="h-10 w-10 text-white/70" /> : feedMode === 'videos' ? <Video className="h-10 w-10 text-white/70" /> : <UserRoundPlus className="h-10 w-10 text-white/70" />}
            <h2 className="mt-4 font-serif text-2xl">{(feedCity || feedCategory) ? localizeCopy('没有找到符合条件的内容', 'Nessun contenuto corrispondente') : feedMode === 'saved' ? (localizeCopy('收藏夹还是空的', 'Nessun contenuto salvato')) : feedMode === 'videos' ? (localizeCopy('暂时还没有视频', 'Nessun video disponibile')) : (localizeCopy('还没有关注创作者', 'Nessun creator seguito'))}</h2>
            <p className="mt-2 max-w-xs text-xs leading-5 text-white/65">{(feedCity || feedCategory) ? localizeCopy('试试其他城市或分类。', 'Prova un’altra città o categoria.') : feedMode === 'saved' ? (localizeCopy('在信息流收藏喜欢的内容，之后可以在这里继续查看。', 'Salva storie e video per ritrovarli qui.')) : feedMode === 'videos' ? (localizeCopy('有新视频时会在这里展示。', 'I nuovi video appariranno qui.')) : (localizeCopy('先在“为你推荐”中关注喜欢的创作者，新内容会汇集在这里。', 'Segui un creator nel feed Per te per vedere qui i suoi nuovi contenuti.'))}</p>
            {(feedCity || feedCategory) ? <button type="button" onClick={() => { setDraftFeedCity(feedCity); setDraftFeedCategory(feedCategory); setFeedFiltersOpen(true); }} className="mt-5 rounded-full border border-white/40 px-4 py-2 text-xs font-semibold text-white">{localizeCopy('更改筛选', 'Modifica filtri')}</button> : (
            <button type="button" onClick={() => void changeFeedMode('for-you')} className="mt-5 rounded-full bg-white px-5 py-2.5 text-xs font-semibold text-black">{localizeCopy('去发现', 'Esplora')}</button>
            )}
          </div>
        )}
        {feedWindowEnd === visibleFeedItems.length && <div className="flex h-28 items-center justify-center snap-start text-xs text-white/65">
          {loadingMorePosts ? (
            <span className="inline-flex items-center gap-2"><LoaderCircle className="h-4 w-4 animate-spin" />{localizeCopy('继续加载…', 'Caricamento')}</span>
          ) : hasMorePosts ? (
            <span>{localizeCopy('上滑继续发现', 'Scorri per continuare')}</span>
          ) : feedMode === 'videos' ? (
            <span>{localizeCopy('已看到全部视频', 'Hai visto tutti i video')}</span>
          ) : (
            <span>{localizeCopy('已看到全部内容', 'Hai visto tutti i contenuti')}</span>
          )}
        </div>}
        </>}
      </div>
      <nav aria-label={localizeCopy('时尚导航', 'Navigazione moda')} className="absolute inset-x-0 bottom-0 z-10 border-t border-white/10 bg-neutral-950/50 px-5 pt-2 backdrop-blur-xl" style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 0.5rem)' }}>
        <div className="mx-auto grid max-w-lg grid-cols-5 items-center">
          <button type="button" onClick={() => { setFeedOpen(false); setCurrentView('home'); }} className="flex min-h-12 flex-col items-center justify-center gap-1 text-white/80 transition-colors hover:text-white" aria-label={localizeCopy('首页', 'Home')}>
            <Home className="h-5 w-5" strokeWidth={1.8} />
            <span className="text-[9px] font-medium">{localizeCopy('首页', 'Home')}</span>
          </button>
          <button type="button" onClick={() => { setFeedOpen(false); setCatalogFilterStatus('all'); navigateToCatalog(); }} className="flex min-h-12 flex-col items-center justify-center gap-1 text-white/80 transition-colors hover:text-white" aria-label={localizeCopy('商店', 'Negozio')}>
            <ShoppingBag className="h-5 w-5" strokeWidth={1.8} />
            <span className="text-[9px] font-medium">{localizeCopy('商店', 'Negozio')}</span>
          </button>
          <button type="button" onClick={() => setShowComposer(true)} className="mx-auto flex h-10 w-12 items-center justify-center rounded-lg border border-white/75 bg-white/5 text-white transition-colors hover:bg-white/15 active:scale-95" aria-label={localizeCopy('上传图片或视频', 'Carica foto o video')}>
            <Plus className="h-6 w-6" strokeWidth={1.7} />
          </button>
          <button type="button" onClick={() => { setFeedOpen(false); navigateToDiscounts(); }} className="flex min-h-12 flex-col items-center justify-center gap-1 text-white/80 transition-colors hover:text-white" aria-label={localizeCopy('折扣', 'Sconti')}>
            <Tag className="h-5 w-5" strokeWidth={1.8} />
            <span className="text-[9px] font-medium">{localizeCopy('折扣', 'Sconti')}</span>
          </button>
          <button type="button" onClick={() => { setFeedOpen(false); setCurrentView(authRole === 'guest' ? 'consumer_account' : 'account'); }} className="flex min-h-12 flex-col items-center justify-center gap-1 text-white/80 transition-colors hover:text-white" aria-label={localizeCopy('我的', 'Profilo')}>
            <UserRound className="h-5 w-5" strokeWidth={1.8} />
            <span className="text-[9px] font-medium">{localizeCopy('我的', 'Profilo')}</span>
          </button>
        </div>
      </nav>
      </div>}

      {commentTarget && (
        <div className="fixed inset-0 z-[75] flex items-end justify-center bg-black/65 sm:items-center sm:p-4" onClick={() => setCommentTarget(null)}>
          <section role="dialog" aria-modal="true" aria-label={localizeCopy('评论', 'Commenti')} onClick={event => event.stopPropagation()} className="flex max-h-[82svh] w-full max-w-xl flex-col rounded-t-2xl bg-white text-xs text-neutral-950 sm:rounded-2xl">
            <header className="flex items-center justify-between border-b border-neutral-100 px-4 py-3">
              <div className="min-w-0">
                <p className="text-xs font-bold">{localizeCopy('评论', 'Commenti')} · {socialById[commentTarget.id]?.commentsCount || 0}</p>
                <p className="truncate text-[10px] text-neutral-500">{commentTarget.title}</p>
              </div>
              <button type="button" onClick={() => setCommentTarget(null)} aria-label={localizeCopy('关闭评论', 'Chiudi commenti')} className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-neutral-100"><X className="h-4 w-4" /></button>
            </header>
            <div className="min-h-48 flex-1 space-y-4 overflow-y-auto px-4 py-4">
              {commentsLoading ? (
                <div className="flex justify-center py-8" aria-label={localizeCopy('正在加载评论', 'Caricamento commenti')}><LoaderCircle className="h-5 w-5 animate-spin text-neutral-500" /></div>
              ) : comments.length === 0 ? (
                <div className="py-10 text-center">
                  <MessageCircle className="mx-auto h-8 w-8 text-neutral-300" />
                  <p className="mt-3 text-xs font-medium">{localizeCopy('还没有评论', 'Nessun commento ancora')}</p>
                  <p className="mt-1 text-xs text-neutral-500">{localizeCopy('来说说你的看法，开启讨论。', 'Inizia la conversazione.')}</p>
                </div>
              ) : comments.map(comment => (
                <article key={comment.id} className="space-y-2">
                  <div className="flex gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-xs font-semibold text-neutral-600">{comment.displayName.slice(-2, -1)}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-semibold text-neutral-700">{comment.displayName}</p>
                        <time className="text-[10px] text-neutral-400">{new Date(comment.createdAt).toLocaleDateString(getIntlLocale(lang))}</time>
                      </div>
                      <p className="mt-1 whitespace-pre-wrap break-words text-xs leading-5">{comment.text}</p>
                      <div className="mt-1 flex items-center gap-3 text-[10px] text-neutral-500">
                        <button type="button" onClick={() => setReplyTarget({ id: comment.id, displayName: comment.displayName })} className="hover:text-neutral-900">{localizeCopy('回复', 'Rispondi')}</button>
                        <button type="button" onClick={() => setReportTarget({ type: 'comment', id: comment.id, label: comment.text.slice(0, 40) })} className="hover:text-neutral-900">{localizeCopy('举报', 'Segnala')}</button>
                        {comment.mine && <button type="button" onClick={() => void deleteOwnComment(comment)} className="text-rose-600 hover:text-rose-800">{localizeCopy('删除', 'Elimina')}</button>}
                      </div>
                    </div>
                  </div>
                  {comment.replies && comment.replies.length > 0 && (
                    <div className="ml-12 space-y-2 border-l border-neutral-200 pl-3">
                      {comment.replies.map(reply => (
                        <div key={reply.id} className="flex gap-2">
                          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-[10px] font-semibold text-neutral-600">{reply.displayName.slice(-2, -1)}</span>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <p className="text-[11px] font-semibold text-neutral-700">{reply.displayName}</p>
                              <time className="text-[9px] text-neutral-400">{new Date(reply.createdAt).toLocaleDateString(getIntlLocale(lang))}</time>
                            </div>
                            <p className="mt-0.5 whitespace-pre-wrap break-words text-[11px] leading-4">{reply.text}</p>
                            <div className="mt-0.5 flex items-center gap-3 text-[9px] text-neutral-500">
                              <button type="button" onClick={() => setReportTarget({ type: 'comment', id: reply.id, label: reply.text.slice(0, 40) })} className="hover:text-neutral-900">{localizeCopy('举报', 'Segnala')}</button>
                              {reply.mine && <button type="button" onClick={() => void deleteOwnComment(reply)} className="text-rose-600 hover:text-rose-800">{localizeCopy('删除', 'Elimina')}</button>}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </article>
              ))}
              {commentsHasMore && !commentsLoading && (
                <button type="button" disabled={commentsLoadingMore} onClick={() => void loadComments(comments.length)} className="mx-auto flex min-h-9 items-center gap-2 rounded-full border border-neutral-300 px-4 text-[11px] font-medium text-neutral-700 disabled:opacity-50">
                  {commentsLoadingMore ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : null}
                  {localizeCopy('加载更多评论', 'Carica altri commenti')}
                </button>
              )}
            </div>
            {replyTarget && (
              <div className="flex items-center justify-between border-t border-neutral-100 bg-neutral-50 px-4 py-2 text-[10px] text-neutral-600">
                <span>{localizeCopy('正在回复', 'Rispondi a')} @{replyTarget.displayName}</span>
                <button type="button" onClick={() => setReplyTarget(null)} className="font-medium text-neutral-900">{localizeCopy('取消', 'Annulla')}</button>
              </div>
            )}
            <form onSubmit={submitComment} className="flex items-center gap-2 border-t border-neutral-100 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
              <input
                value={commentDraft}
                onChange={event => setCommentDraft(event.target.value.slice(0, 300))}
                maxLength={300}
                placeholder={replyTarget ? localizeCopy(`回复 @${replyTarget.displayName}…`, `Rispondi a @${replyTarget.displayName}...`) : localizeCopy('添加评论…', 'Aggiungi un commento...')}
                aria-label={localizeCopy('写评论', 'Scrivi un commento')}
                className="min-h-11 min-w-0 flex-1 rounded-full bg-neutral-100 px-4 text-xs outline-none focus:ring-2 focus:ring-neutral-300"
              />
              <button type="submit" disabled={!commentDraft.trim() || commentSubmitting} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-neutral-950 text-white disabled:opacity-40" aria-label={localizeCopy('发送评论', 'Invia commento')}>
                {commentSubmitting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ArrowUpRight className="h-4 w-4" />}
              </button>
            </form>
          </section>
        </div>
      )}

      {creatorId && (
        <div className="fixed inset-0 z-[80] overflow-y-auto bg-[#f7f6f3] text-neutral-950">
          <header className="sticky top-0 z-10 flex items-center justify-between border-b border-neutral-200 bg-[#f7f6f3]/95 px-4 py-3 backdrop-blur">
            <button type="button" onClick={() => { setCreatorId(null); if (/^\/creators\//.test(window.location.pathname)) window.history.replaceState(window.history.state, '', '/trends'); }} className="flex min-h-9 items-center gap-2 text-[11px] font-medium text-neutral-700" aria-label={localizeCopy('返回', 'Indietro')}>
              <ChevronDown className="h-4 w-4 rotate-90" />{localizeCopy('返回', 'Indietro')}
            </button>
            <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-neutral-500">{localizeCopy('创作者', 'Creator')}</span>
            <button
              type="button"
              disabled={!creatorProfile}
              onClick={() => {
                if (!creatorProfile) return;
                const url = `${window.location.origin}/creators/${creatorProfile.creator.id}`;
                void navigator.clipboard?.writeText(url)
                  .then(() => addNotification('success', '链接已复制', '可直接分享该创作者主页。'))
                  .catch(() => addNotification('warning', '复制失败', '请手动复制浏览器地址。'));
              }}
              className="flex h-9 w-9 items-center justify-center rounded-full text-neutral-700 hover:bg-neutral-200 disabled:opacity-40"
              aria-label={localizeCopy('复制创作者链接', 'Copia link creator')}
            >
              <Share2 className="h-4 w-4" />
            </button>
          </header>
          {creatorLoading ? (
            <div className="flex min-h-[60svh] items-center justify-center"><LoaderCircle className="h-6 w-6 animate-spin text-neutral-500" /></div>
          ) : creatorError ? (
            <div className="flex min-h-[60svh] flex-col items-center justify-center px-8 text-center">
              <UserRound className="h-10 w-10 text-neutral-400" />
              <h1 className="mt-4 font-serif text-2xl">{creatorError === 'not-found' ? localizeCopy('创作者不存在', 'Creator non trovato') : localizeCopy('主页暂时无法加载', 'Profilo non disponibile')}</h1>
              <p className="mt-2 max-w-xs text-xs leading-5 text-neutral-500">{creatorError === 'not-found' ? localizeCopy('该账号可能已注销，或链接有误。', 'L’account potrebbe essere stato eliminato o il link non è corretto.') : localizeCopy('请检查网络后重试。', 'Controlla la connessione e riprova.')}</p>
              <button type="button" onClick={() => setCreatorId(null)} className="mt-5 rounded-full bg-neutral-950 px-5 py-2.5 text-xs font-semibold text-white">{localizeCopy('返回时尚首页', 'Torna alla home')}</button>
            </div>
          ) : creatorProfile ? (
            <>
              <section className="border-b border-neutral-200 px-5 py-8 sm:px-10">
                <div className="mx-auto flex max-w-4xl flex-col gap-5 sm:flex-row sm:items-center">
                  {creatorProfile.creator.avatarUrl
                    ? <img src={creatorProfile.creator.avatarUrl} alt={creatorProfile.creator.displayName} referrerPolicy="no-referrer" className="h-20 w-20 rounded-full object-cover" />
                    : <span className="flex h-20 w-20 items-center justify-center rounded-full bg-neutral-200 font-serif text-3xl">{creatorProfile.creator.displayName.slice(0, 1)}</span>}
                  <div className="min-w-0 flex-1">
                    <h1 className="font-serif text-3xl font-medium">{creatorProfile.creator.displayName}</h1>
                    {creatorProfile.creator.bio && <p className="mt-2 max-w-xl whitespace-pre-line text-xs leading-5 text-neutral-600">{creatorProfile.creator.bio}</p>}
                    <div className="mt-3 flex flex-wrap items-center gap-4 text-[11px] text-neutral-600">
                      <span><strong className="text-neutral-950">{creatorProfile.creator.postsCount}</strong> {localizeCopy('作品', 'Post')}</span>
                      <button type="button" onClick={() => void openConnectionList('followers')} className="hover:text-neutral-950"><strong className="text-neutral-950">{creatorProfile.creator.followersCount}</strong> {localizeCopy('粉丝', 'Follower')}</button>
                      <button type="button" onClick={() => void openConnectionList('following')} className="hover:text-neutral-950"><strong className="text-neutral-950">{creatorProfile.creator.followingCount}</strong> {localizeCopy('关注', 'Seguiti')}</button>
                      {creatorProfile.creator.isSelf && <button type="button" onClick={() => void openAnalytics()} className="rounded-full border border-neutral-300 px-2.5 py-0.5 text-[10px] hover:border-neutral-900">{localizeCopy('作品数据', 'Statistiche')}</button>}
                    </div>
                    {creatorProfile.creator.merchant && (
                      <button type="button" onClick={() => { const merchantId = creatorProfile.creator.merchant?.id; setCreatorId(null); if (merchantId) openMerchantStore(merchantId); }} className="mt-3 inline-flex items-center gap-2 rounded-full border border-neutral-300 px-3 py-1.5 text-[10px] font-medium text-neutral-800 hover:border-neutral-900">
                        <ShoppingBag className="h-3 w-3" />
                        {creatorProfile.creator.merchant.name}
                        {creatorProfile.creator.merchant.verified && <span className="rounded-full bg-neutral-900 px-1.5 py-0.5 text-[8px] text-white">{localizeCopy('认证商家', 'Verificato')}</span>}
                      </button>
                    )}
                  </div>
                  {!creatorProfile.creator.isSelf && (
                    <div className="flex shrink-0 flex-col gap-2 sm:items-end">
                    <button
                      type="button"
                      onClick={() => void toggleCreatorFollow()}
                      className={`inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-full px-5 text-xs font-semibold transition-colors ${creatorProfile.creator.following ? 'border border-neutral-400 text-neutral-800 hover:border-neutral-900' : 'bg-neutral-950 text-white hover:bg-neutral-800'}`}
                      aria-pressed={creatorProfile.creator.following}
                    >
                      {creatorProfile.creator.following ? <Heart className="h-3.5 w-3.5 fill-current" /> : <UserRoundPlus className="h-3.5 w-3.5" />}
                      {creatorProfile.creator.following ? localizeCopy('已关注', 'Segui già') : localizeCopy('关注', 'Segui')}
                    </button>
                    <button type="button" onClick={() => void blockCreator(creatorProfile.creator.id)} className="inline-flex min-h-9 items-center justify-center rounded-full border border-neutral-300 px-4 text-[11px] text-neutral-600 hover:border-neutral-900 hover:text-neutral-950">{localizeCopy('屏蔽', 'Blocca')}</button>
                    </div>
                  )}
                </div>
              </section>

              <section className="mx-auto max-w-4xl px-2 py-6 sm:px-6">
                {creatorProfile.posts.length === 0 ? (
                  <div className="py-16 text-center text-xs text-neutral-500">{localizeCopy('还没有公开作品。', 'Nessun post pubblico.')}</div>
                ) : (
                  <div className="grid grid-cols-3 gap-1 sm:gap-2">
                    {creatorProfile.posts.map(post => (
                      <button key={post.id} type="button" onClick={() => openCreatorPost(post)} className="group relative aspect-[3/4] overflow-hidden bg-neutral-200" aria-label={post.title}>
                        <img src={post.image} alt={post.title} loading="lazy" referrerPolicy="no-referrer" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                        {post.mediaType !== 'image' && <span className="absolute right-1.5 top-1.5 rounded-full bg-black/55 p-1 text-white"><Video className="h-3 w-3" /></span>}
                        {post.products && post.products.length > 0 && <span className="absolute bottom-1.5 left-1.5 rounded-full bg-white/90 px-1.5 py-0.5 text-[8px] font-semibold text-neutral-900"><ShoppingBag className="mr-0.5 inline h-2.5 w-2.5" />{post.products.length}</span>}
                      </button>
                    ))}
                  </div>
                )}
              </section>

            </>
          ) : null}
        </div>
      )}

      {reportTarget && (
        <div className="fixed inset-0 z-[85] flex items-end justify-center bg-black/65 sm:items-center sm:p-4" onClick={() => setReportTarget(null)}>
          <form onSubmit={submitReport} onClick={event => event.stopPropagation()} role="dialog" aria-modal="true" aria-label={localizeCopy('举报内容', 'Segnala contenuto')} className="w-full max-w-md rounded-t-2xl bg-white p-5 text-neutral-950 sm:rounded-2xl">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">{localizeCopy('举报内容', 'Segnala contenuto')}</h2>
              <button type="button" onClick={() => setReportTarget(null)} className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-neutral-100" aria-label={localizeCopy('关闭', 'Chiudi')}><X className="h-4 w-4" /></button>
            </div>
            <p className="mt-1 truncate text-[10px] text-neutral-500">{reportTarget.type === 'post' ? localizeCopy('作品', 'Post') : localizeCopy('评论', 'Commento')} · {reportTarget.label}</p>
            <label className="mt-4 block text-[11px] font-medium text-neutral-700" htmlFor="fashion-report-reason">{localizeCopy('举报原因', 'Motivo')}</label>
            <select id="fashion-report-reason" value={reportReason} onChange={event => setReportReason(event.target.value)} className="mt-1 min-h-10 w-full rounded-lg border border-neutral-300 bg-white px-3 text-xs outline-none focus:border-neutral-900">
              <option value="copyright">{localizeCopy('侵犯版权或商标', 'Violazione di copyright')}</option>
              <option value="violence">{localizeCopy('暴力或危险内容', 'Violenza o pericolo')}</option>
              <option value="sexual">{localizeCopy('色情或不适宜内容', 'Contenuto sessuale')}</option>
              <option value="harassment">{localizeCopy('骚扰或仇恨言论', 'Molestie o odio')}</option>
              <option value="spam">{localizeCopy('垃圾广告', 'Spam')}</option>
              <option value="misinformation">{localizeCopy('虚假信息', 'Disinformazione')}</option>
              <option value="other">{localizeCopy('其他', 'Altro')}</option>
            </select>
            <label className="mt-3 block text-[11px] font-medium text-neutral-700" htmlFor="fashion-report-detail">{localizeCopy('补充说明（可选）', 'Dettagli (facoltativo)')}</label>
            <textarea id="fashion-report-detail" value={reportDetail} onChange={event => setReportDetail(event.target.value.slice(0, 500))} rows={3} maxLength={500} className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-xs outline-none focus:border-neutral-900" />
            <div className="mt-4 flex items-center justify-end gap-2">
              <button type="button" onClick={() => setReportTarget(null)} className="min-h-10 rounded-full px-4 text-xs font-medium text-neutral-600">{localizeCopy('取消', 'Annulla')}</button>
              <button type="submit" disabled={reportSubmitting} className="inline-flex min-h-10 items-center gap-2 rounded-full bg-neutral-950 px-5 text-xs font-semibold text-white disabled:opacity-50">
                {reportSubmitting && <LoaderCircle className="h-3.5 w-3.5 animate-spin" />}
                {localizeCopy('提交举报', 'Invia segnalazione')}
              </button>
            </div>
          </form>
        </div>
      )}

      {showComposer && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-4" onClick={() => { if (!postSubmitting) setShowComposer(false); }}>
          <form onSubmit={submitPublicPost} onClick={event => event.stopPropagation()} className="max-h-[90svh] w-full max-w-lg space-y-3 overflow-y-auto rounded-t-2xl bg-white p-4 text-neutral-950 sm:rounded-2xl sm:p-6">
            <div className="sticky top-0 z-10 -mx-4 -mt-4 flex items-center justify-between border-b border-neutral-100 bg-white px-4 py-3 sm:-mx-6 sm:-mt-6 sm:px-6">
              <h2 className="text-base font-semibold">{localizeCopy('发布内容', 'Nuovo post')}</h2>
              <button type="button" disabled={postSubmitting} onClick={() => setShowComposer(false)} aria-label={localizeCopy('关闭', 'Chiudi')} className="p-2 disabled:opacity-50"><X className="h-4 w-4" /></button>
            </div>
            <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,video/*,.mp4,.m4v,.webm,.mov" multiple className="hidden" onChange={handleMediaSelection} />
            <div
              role="button"
              tabIndex={postMediaProcessing || postSubmitting ? -1 : 0}
              aria-label={localizeCopy('选择照片或视频', 'Scegli una foto o un video')}
              aria-disabled={postMediaProcessing || postSubmitting}
              onClick={() => { if (!postMediaProcessing && !postSubmitting) fileInputRef.current?.click(); }}
              onKeyDown={event => {
                if ((event.key === 'Enter' || event.key === ' ') && !postMediaProcessing && !postSubmitting) {
                  event.preventDefault();
                  fileInputRef.current?.click();
                }
              }}
              onDragOver={event => {
                event.preventDefault();
                if (!postMediaProcessing && !postSubmitting) setIsMediaDragActive(true);
              }}
              onDragLeave={() => setIsMediaDragActive(false)}
              onDrop={handleMediaDrop}
              className={`flex min-h-32 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed px-4 py-5 text-center transition-colors focus:outline-none focus:ring-2 focus:ring-neutral-500 ${isMediaDragActive ? 'border-neutral-950 bg-neutral-100' : 'border-neutral-300 hover:border-neutral-700 hover:bg-neutral-50'} ${(postMediaProcessing || postSubmitting) ? 'cursor-not-allowed opacity-60' : ''}`}
            >
              {postMediaProcessing ? <LoaderCircle className="h-6 w-6 animate-spin text-neutral-700" /> : <Camera className="h-6 w-6 text-neutral-700" />}
              <span className="mt-2 text-xs font-semibold">{postMediaProcessing ? localizeCopy('处理中…', 'Preparazione…') : draftMedia.length ? localizeCopy('继续添加', 'Aggiungi altro') : localizeCopy('添加照片或视频', 'Aggiungi foto o video')}</span>
              {draftMedia.length > 0 && <span className="mt-1 text-[10px] text-neutral-500">{draftMedia.length} / 8</span>}
            </div>
            <div>
              <button type="button" onClick={() => void suggestFashionCopy()} disabled={aiCaptionLoading || postMediaProcessing || postSubmitting} className="flex min-h-10 w-full items-center justify-center gap-2 rounded-lg border border-neutral-300 px-3 text-xs font-semibold disabled:opacity-50">
                {aiCaptionLoading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                {aiCaptionLoading ? localizeCopy('生成中…', 'Generazione…') : localizeCopy('AI 生成文案', 'Testo AI')}
              </button>
              <p className="mt-1 text-center text-[10px] text-neutral-500">{localizeCopy('首张图片或视频封面将用于 AI 生成', 'La prima foto o copertina sarà inviata all’AI')}</p>
            </div>
            <input value={postTitle} onChange={event => setPostTitle(event.target.value)} placeholder={localizeCopy('标题', 'Titolo')} aria-label={localizeCopy('标题', 'Titolo')} className="w-full rounded-lg border border-neutral-200 px-3 py-2.5 text-sm outline-none focus:border-black" maxLength={120} />
            <textarea value={postText} onChange={event => setPostText(event.target.value)} placeholder={localizeCopy('写点说明…', 'Aggiungi una descrizione…')} aria-label={localizeCopy('内容说明', 'Descrizione')} className="min-h-20 w-full rounded-lg border border-neutral-200 px-3 py-2.5 text-sm outline-none focus:border-black" maxLength={2000} />
            <div className="grid grid-cols-2 gap-2">
              <label className="sr-only" htmlFor="fashion-post-category">{localizeCopy('时尚分类', 'Categoria moda')}</label>
              <select id="fashion-post-category" value={postCategory} onChange={event => setPostCategory(event.target.value)} aria-label={localizeCopy('时尚分类', 'Categoria moda')} className="min-h-10 min-w-0 rounded-lg border border-neutral-200 bg-white px-3 text-xs outline-none focus:border-black">
                {categoryOptions.map(tag => <option key={tag.zh} value={tag.zh}>{localizeCopy(tag.zh, tag.it)}</option>)}
              </select>
              <label className="sr-only" htmlFor="fashion-post-city">{localizeCopy('城市（可选）', 'Città (facoltativa)')}</label>
              <select id="fashion-post-city" value={postCity} onChange={event => setPostCity(event.target.value)} aria-label={localizeCopy('城市（可选）', 'Città (facoltativa)')} className="min-h-10 min-w-0 rounded-lg border border-neutral-200 bg-white px-3 text-xs outline-none focus:border-black">
                <option value="">{localizeCopy('城市（可选）', 'Città (facoltativa)')}</option>
                {fashionCities.map(city => <option key={city} value={city}>{city}</option>)}
              </select>
              <label className="sr-only" htmlFor="fashion-post-season">{localizeCopy('季节（可选）', 'Stagione (facoltativa)')}</label>
              <select id="fashion-post-season" value={postSeason} onChange={event => setPostSeason(event.target.value)} aria-label={localizeCopy('季节（可选）', 'Stagione (facoltativa)')} className="min-h-10 min-w-0 rounded-lg border border-neutral-200 bg-white px-3 text-xs outline-none focus:border-black">
                <option value="">{localizeCopy('季节（可选）', 'Stagione (facoltativa)')}</option>
                {fashionSeasons.map(season => <option key={season} value={season}>{season}</option>)}
              </select>
            </div>
            <details className="group rounded-lg border border-neutral-200 px-3">
              <summary className="cursor-pointer py-2 text-xs font-medium text-neutral-600">{localizeCopy('添加话题标签', 'Aggiungi hashtag')}</summary>
              <div className="flex gap-2 pb-3">
                  <input value={hashtagDraft} onChange={event => setHashtagDraft(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); addFashionHashtag(); } }} placeholder={localizeCopy('输入话题', 'Scrivi un hashtag')} aria-label={localizeCopy('输入话题', 'Scrivi un hashtag')} maxLength={30} className="min-h-10 min-w-0 flex-1 border border-neutral-200 px-3 text-sm font-normal outline-none focus:border-black" />
                <button type="button" onClick={addFashionHashtag} disabled={postHashtags.length >= 8 || !hashtagDraft.trim()} className="border border-neutral-300 px-3 text-xs disabled:opacity-50">{localizeCopy('添加', 'Aggiungi')}</button>
              </div>
              {postHashtags.length > 0 && <div className="flex flex-wrap gap-1.5 pb-3">{postHashtags.map(tag => <button key={tag} type="button" onClick={() => setPostHashtags(previous => previous.filter(item => item !== tag))} className="rounded-full bg-neutral-100 px-2.5 py-1 text-[11px] text-neutral-700">#{tag} ×</button>)}</div>}
            </details>
            <div className="rounded-lg border border-neutral-200 p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-medium">{localizeCopy('关联商品', 'Prodotti collegati')}</p>
                  <p className="mt-0.5 text-[10px] text-neutral-500">{localizeCopy('只能选择你有权管理且已公开的商品。', 'Solo prodotti pubblici che puoi gestire.')}</p>
                </div>
                <button type="button" onClick={() => productPickerOpen ? setProductPickerOpen(false) : openProductPicker()} className="min-h-9 shrink-0 rounded-full border border-neutral-300 px-3 text-[11px] font-medium">
                  {selectedProducts.length ? `${selectedProducts.length} / 6` : localizeCopy('选择', 'Scegli')}
                </button>
              </div>
              {selectedProducts.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {selectedProducts.map(product => (
                    <button key={product.id} type="button" onClick={() => toggleSelectedProduct(product)} className="inline-flex items-center gap-1.5 rounded-full bg-neutral-100 py-1 pl-1 pr-2.5 text-[10px] text-neutral-800">
                      {product.image && <img src={product.image} alt="" className="h-5 w-5 rounded-full object-cover" />}
                      <span className="max-w-[9rem] truncate">{product.name}</span>
                      <X className="h-3 w-3" />
                    </button>
                  ))}
                </div>
              )}
              {productPickerOpen && (
                <div className="mt-3 border-t border-neutral-200 pt-3">
                  <div className="flex gap-2">
                    <input
                      value={productQuery}
                      onChange={event => setProductQuery(event.target.value)}
                      onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); void searchFashionProducts(); } }}
                      placeholder={localizeCopy('搜索款号、名称或品牌', 'Cerca codice, nome o brand')}
                      aria-label={localizeCopy('搜索商品', 'Cerca prodotti')}
                      className="min-h-10 min-w-0 flex-1 rounded-lg border border-neutral-200 px-3 text-xs outline-none focus:border-black"
                    />
                    <button type="button" onClick={() => void searchFashionProducts()} className="min-h-10 rounded-lg bg-neutral-950 px-4 text-[11px] font-semibold text-white">{localizeCopy('搜索', 'Cerca')}</button>
                  </div>
                  {productPickerLoading ? (
                    <div className="flex justify-center py-4"><LoaderCircle className="h-4 w-4 animate-spin text-neutral-500" /></div>
                  ) : !productPickerManageable ? (
                    <p className="mt-3 text-[10px] leading-4 text-neutral-500">{localizeCopy('当前账号未关联商家，无法关联商品；仍可发布普通时尚作品。', 'Questo account non è collegato a un negozio: puoi pubblicare senza prodotti.')}</p>
                  ) : productOptions.length === 0 ? (
                    <p className="mt-3 text-[10px] text-neutral-500">{localizeCopy('没有找到可关联的公开商品。', 'Nessun prodotto pubblico disponibile.')}</p>
                  ) : (
                    <div className="mt-2 max-h-56 space-y-1 overflow-y-auto">
                      {productOptions.map(product => {
                        const active = selectedProducts.some(item => item.id === product.id);
                        return (
                          <button key={product.id} type="button" onClick={() => toggleSelectedProduct(product)} aria-pressed={active} className={`flex w-full items-center gap-2 rounded-lg p-1.5 text-left transition-colors ${active ? 'bg-neutral-900 text-white' : 'hover:bg-neutral-100'}`}>
                            {product.image
                              ? <img src={product.image} alt="" loading="lazy" referrerPolicy="no-referrer" className="h-10 w-10 shrink-0 rounded object-cover" />
                              : <span className="h-10 w-10 shrink-0 rounded bg-neutral-200" />}
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-[11px] font-medium">{product.name}</span>
                              <span className={`block text-[9px] ${active ? 'text-white/70' : 'text-neutral-500'}`}>{product.styleNo} · {product.brand} · €{product.retailPrice.toFixed(0)}</span>
                            </span>
                            {active && <span className="text-[10px]">✓</span>}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
            <label className="flex items-center gap-2 text-[11px] text-neutral-600">
              <input
                type="checkbox"
                checked={rightsConfirmed}
                onChange={event => setRightsConfirmed(event.target.checked)}
                className="h-4 w-4 shrink-0 accent-neutral-950"
              />
              <span>{localizeCopy('我拥有内容版权或已获授权', 'Possiedo i diritti o ho l’autorizzazione')}</span>
            </label>
            {draftMedia.length > 0 && <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {draftMedia.map((media, index) => <div key={`${media.file.name}-${index}`} draggable={!postSubmitting && !postMediaProcessing} onDragStart={event => event.dataTransfer.setData('text/plain', String(index))} onDragOver={event => event.preventDefault()} onDrop={event => {
                event.preventDefault();
                const sourceIndex = Number(event.dataTransfer.getData('text/plain'));
                if (!Number.isInteger(sourceIndex) || sourceIndex === index) return;
                setDraftMedia(previous => {
                  const reordered = [...previous];
                  const [moved] = reordered.splice(sourceIndex, 1);
                  if (moved) reordered.splice(index, 0, moved);
                  return reordered;
                });
              }} className="group relative aspect-[4/5] overflow-hidden bg-neutral-100">
                {media.type === 'video'
                  ? <video src={media.preview} poster={media.posterPreview} muted playsInline className="h-full w-full object-cover" />
                  : <img src={media.preview} alt={media.file.name} className="h-full w-full object-cover" />}
                <span className="absolute bottom-1.5 left-1.5 rounded bg-black/65 px-1.5 py-0.5 text-[9px] text-white">{index + 1} · {media.type === 'video' ? localizeCopy('视频', 'VIDEO') : localizeCopy('照片', 'FOTO')}</span>
                <button type="button" disabled={postSubmitting || postMediaProcessing} onClick={() => removeDraftMedia(index)} aria-label={localizeCopy('移除媒体', 'Rimuovi media')} className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-black/65 text-white"><X className="h-3.5 w-3.5" /></button>
              </div>)}
            </div>}
            {draftAssets.length > 0 && (
              <div className="rounded-lg bg-neutral-100 p-3 text-[11px] text-neutral-700">
                {localizeCopy('已保存 {{RUDA_ARG_0}} 个媒体，将随作品一起发布。', '{{RUDA_ARG_0}} media salvati con la bozza.', [String(draftAssets.length)])}
                <button type="button" onClick={() => setDraftAssets([])} className="ml-2 underline">{localizeCopy('移除', 'Rimuovi')}</button>
              </div>
            )}
            {drafts.length > 0 && (
              <div className="rounded-lg border border-neutral-200 p-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-neutral-500">{localizeCopy('草稿箱', 'Bozze')}</p>
                <div className="mt-2 space-y-1">
                  {drafts.map(draft => (
                    <div key={draft.id} className="flex items-center gap-2">
                      <button type="button" onClick={() => resumeDraft(draft)} className="min-w-0 flex-1 truncate text-left text-[11px] hover:underline">{draft.title || draft.caption.slice(0, 24) || localizeCopy('未命名草稿', 'Bozza senza titolo')}</button>
                      <button type="button" onClick={() => void removeDraft(draft.id)} className="text-[10px] text-rose-600">{localizeCopy('删除', 'Elimina')}</button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="flex gap-2">
              {draftMedia.length > 0 && <button type="button" disabled={postSubmitting || postMediaProcessing} onClick={() => { draftMedia.forEach(media => { if (media.preview.startsWith('blob:')) URL.revokeObjectURL(media.preview); if (media.posterPreview?.startsWith('blob:')) URL.revokeObjectURL(media.posterPreview); }); setDraftMedia([]); draftMediaCountRef.current = 0; setRightsConfirmed(false); }} className="flex min-h-11 items-center gap-2 border border-neutral-300 px-3 text-xs font-semibold disabled:opacity-50" aria-label={localizeCopy('移除媒体', 'Rimuovi media')}><X className="h-4 w-4" />{localizeCopy('全部移除', 'Rimuovi tutto')}</button>}
              <button type="button" disabled={postSubmitting || postMediaProcessing || draftSaving} onClick={() => void saveDraft()} className="min-h-11 border border-neutral-300 px-4 text-xs font-semibold disabled:opacity-50">
                {draftSaving ? localizeCopy('保存中…', 'Salvataggio…') : localizeCopy('存草稿', 'Salva bozza')}
              </button>
              <button type="submit" disabled={postSubmitting || postMediaProcessing || !rightsConfirmed} className="min-h-11 flex-1 rounded-lg bg-black px-5 text-xs font-bold text-white disabled:opacity-50">
                {postSubmitting ? (localizeCopy('发布中…', 'Pubblicazione…')) : (localizeCopy('发布', 'Pubblica'))}
              </button>
            </div>
            {postSubmitting && draftMedia.some(media => media.type === 'video') && postUploadProgress !== null && (
              <div className="space-y-1.5" aria-live="polite">
                <div role="progressbar" aria-label={localizeCopy('视频上传进度', 'Caricamento video')} aria-valuemin={0} aria-valuemax={100} aria-valuenow={postUploadProgress} className="h-1.5 overflow-hidden rounded-full bg-neutral-200">
                  <div className="h-full bg-neutral-950 transition-[width] duration-150" style={{ width: `${postUploadProgress}%` }} />
                </div>
                <p className="text-[10px] text-neutral-500">{postUploadProgress >= 100 ? (localizeCopy('视频已上传，正在保存…', 'Salvataggio del video…')) : (localizeCopy("视频上传中 {{RUDA_ARG_0}}%", "Caricamento video {{RUDA_ARG_0}}%", [String(postUploadProgress)]))}</p>
              </div>
            )}
          </form>
        </div>
      )}

      {notificationsOpen && (
        <div className="fixed inset-0 z-[78] flex justify-end bg-black/50" onClick={() => setNotificationsOpen(false)}>
          <aside role="dialog" aria-modal="true" aria-label={localizeCopy('消息通知', 'Notifiche')} onClick={event => event.stopPropagation()} className="flex h-full w-full max-w-sm flex-col bg-white text-neutral-950">
            <header className="flex items-center justify-between border-b border-neutral-100 px-4 py-4">
              <h2 className="text-sm font-semibold">{localizeCopy('消息', 'Messaggi')}</h2>
              <button type="button" onClick={() => setNotificationsOpen(false)} aria-label={localizeCopy('关闭', 'Chiudi')} className="p-2"><X className="h-4 w-4" /></button>
            </header>
            <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
              {notificationsLoading ? (
                <div className="flex justify-center py-10"><LoaderCircle className="h-5 w-5 animate-spin text-neutral-500" /></div>
              ) : notifications.length === 0 ? (
                <div className="px-4 py-16 text-center">
                  <MessageCircle className="mx-auto h-8 w-8 text-neutral-300" />
                  <p className="mt-3 text-xs font-medium">{localizeCopy('还没有新消息', 'Nessuna notifica')}</p>
                  <p className="mt-1 text-[11px] text-neutral-500">{localizeCopy('作品获得点赞、评论、回复或关注时会显示在这里。', 'Like, commenti, risposte e follow appariranno qui.')}</p>
                </div>
              ) : notifications.map(item => (
                <div key={item.id} className={`flex items-start gap-1 rounded-xl transition-colors hover:bg-neutral-50 ${item.read ? '' : 'bg-neutral-50'}`}>
                  <button
                    type="button"
                    onClick={() => {
                      setNotificationsOpen(false);
                      if (item.postId) openFeed(item.postId);
                      else if (item.actorAccountId) setCreatorId(item.actorAccountId);
                    }}
                    className="flex min-w-0 flex-1 items-start gap-3 px-2 py-2.5 text-left"
                  >
                  {item.postImage
                    ? <img src={item.postImage} alt="" loading="lazy" referrerPolicy="no-referrer" className="h-11 w-11 shrink-0 rounded-lg object-cover" />
                    : <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-neutral-100"><UserRound className="h-4 w-4 text-neutral-500" /></span>}
                  <span className="min-w-0 flex-1">
                    <span className="block text-[11px] font-semibold leading-4">{item.actorName}</span>
                    <span className="block text-[11px] leading-4 text-neutral-600">
                      {item.type === 'like' ? localizeCopy('赞了你的作品', 'ha messo mi piace') : item.type === 'follow' ? localizeCopy('关注了你', 'ha iniziato a seguirti') : item.type === 'reply' ? localizeCopy('回复了你的评论', 'ha risposto al tuo commento') : item.type === 'comment' ? localizeCopy('评论了你的作品', 'ha commentato il tuo post') : localizeCopy('有新的互动', 'nuova attività')}
                    </span>
                    {item.preview && item.type !== 'like' && item.type !== 'follow' && <span className="mt-0.5 block truncate text-[11px] text-neutral-500">{item.preview}</span>}
                    <span className="mt-0.5 block text-[9px] text-neutral-400">{new Date(item.createdAt).toLocaleString(getIntlLocale(lang))}</span>
                  </span>
                    {!item.read && <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-neutral-900" />}
                  </button>
                  <button
                    type="button"
                    onClick={async event => {
                      event.stopPropagation();
                      try {
                        await apiDelete(`/api/fashion/notifications/${encodeURIComponent(item.id)}`);
                        setNotifications(previous => previous.filter(entry => entry.id !== item.id));
                        if (!item.read) setNotificationUnread(count => Math.max(0, count - 1));
                      } catch {
                        addNotification('warning', localizeCopy('删除失败', 'Eliminazione non riuscita'), localizeCopy('请稍后重试。', 'Riprova più tardi.'));
                      }
                    }}
                    aria-label={localizeCopy('删除这条消息', 'Elimina questa notifica')}
                    className="mt-1 shrink-0 p-2 text-neutral-400 transition-colors hover:text-neutral-900"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </aside>
        </div>
      )}

      {connectionsOpen && (
        <div className="fixed inset-0 z-[78] flex items-center justify-center bg-black/60 p-4" onClick={() => setConnectionsOpen(null)}>
          <div role="dialog" aria-modal="true" aria-label={connectionsOpen === 'followers' ? localizeCopy('粉丝', 'Follower') : localizeCopy('关注', 'Seguiti')} onClick={event => event.stopPropagation()} className="flex max-h-[80svh] w-full max-w-md flex-col rounded-2xl bg-white text-neutral-950">
            <header className="flex items-center justify-between border-b border-neutral-100 px-4 py-3">
              <h2 className="text-sm font-semibold">{connectionsOpen === 'followers' ? localizeCopy('粉丝', 'Follower') : localizeCopy('关注', 'Seguiti')}</h2>
              <button type="button" onClick={() => setConnectionsOpen(null)} aria-label={localizeCopy('关闭', 'Chiudi')} className="p-2"><X className="h-4 w-4" /></button>
            </header>
            <div className="min-h-0 flex-1 overflow-y-auto p-2">
              {connectionsLoading ? (
                <div className="flex justify-center py-10"><LoaderCircle className="h-5 w-5 animate-spin text-neutral-500" /></div>
              ) : connections.length === 0 ? (
                <p className="py-12 text-center text-xs text-neutral-500">{localizeCopy('暂无用户。', 'Nessun utente.')}</p>
              ) : connections.map(account => (
                <div key={account.id} className="flex items-center gap-3 rounded-xl px-2 py-2.5 hover:bg-neutral-50">
                  {account.avatarUrl
                    ? <img src={account.avatarUrl} alt="" loading="lazy" referrerPolicy="no-referrer" className="h-10 w-10 shrink-0 rounded-full object-cover" />
                    : <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-neutral-200 text-xs font-semibold">{account.displayName.slice(0, 1)}</span>}
                  <button type="button" onClick={() => { setConnectionsOpen(null); setCreatorId(account.id); }} className="min-w-0 flex-1 text-left">
                    <span className="block truncate text-xs font-semibold">{account.displayName}</span>
                    {account.bio && <span className="block truncate text-[10px] text-neutral-500">{account.bio}</span>}
                  </button>
                  {!account.isSelf && (
                    <button type="button" onClick={() => void toggleConnectionFollow(account)} className={`min-h-8 shrink-0 rounded-full px-3 text-[10px] font-semibold ${account.following ? 'border border-neutral-300 text-neutral-700' : 'bg-neutral-950 text-white'}`}>
                      {account.following ? localizeCopy('已关注', 'Segui già') : localizeCopy('关注', 'Segui')}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {analyticsOpen && (
        <div className="fixed inset-0 z-[78] flex items-center justify-center bg-black/60 p-4" onClick={() => setAnalyticsOpen(false)}>
          <div role="dialog" aria-modal="true" aria-label={localizeCopy('作品数据', 'Statistiche')} onClick={event => event.stopPropagation()} className="flex max-h-[86svh] w-full max-w-2xl flex-col rounded-2xl bg-white text-neutral-950">
            <header className="flex items-center justify-between border-b border-neutral-100 px-4 py-3">
              <h2 className="text-sm font-semibold">{localizeCopy('作品数据', 'Statistiche')}</h2>
              <button type="button" onClick={() => setAnalyticsOpen(false)} aria-label={localizeCopy('关闭', 'Chiudi')} className="p-2"><X className="h-4 w-4" /></button>
            </header>
            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              {analyticsLoading ? (
                <div className="flex justify-center py-12"><LoaderCircle className="h-5 w-5 animate-spin text-neutral-500" /></div>
              ) : !analytics ? (
                <p className="py-12 text-center text-xs text-neutral-500">{localizeCopy('暂无数据，或需要重新登录。', 'Nessun dato disponibile.')}</p>
              ) : (
                <>
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                    {([
                      [localizeCopy('曝光播放', 'Visualizzazioni'), analytics.totals.views],
                      [localizeCopy('完播率', 'Completamento'), `${analytics.totals.completionRate || 0}%`],
                      [localizeCopy('完播次数', 'Completati'), analytics.totals.completions || 0],
                      [localizeCopy('点赞', 'Like'), analytics.totals.likes],
                      [localizeCopy('评论', 'Commenti'), analytics.totals.comments],
                      [localizeCopy('收藏', 'Salvataggi'), analytics.totals.saves],
                      [localizeCopy('商品点击', 'Click prodotto'), analytics.totals.productClicks],
                      [localizeCopy('粉丝', 'Follower'), analytics.totals.followers],
                      [localizeCopy('已通过', 'Approvati'), analytics.totals.approved],
                      [localizeCopy('待审核', 'In revisione'), analytics.totals.pending]
                    ] as const).map(([label, value]) => (
                      <div key={label} className="rounded-xl border border-neutral-200 p-3">
                        <p className="text-lg font-semibold tabular-nums">{value}</p>
                        <p className="mt-0.5 text-[10px] text-neutral-500">{label}</p>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 space-y-2">
                    {analytics.posts.length === 0 ? (
                      <p className="py-8 text-center text-xs text-neutral-500">{localizeCopy('还没有作品。', 'Nessun post.')}</p>
                    ) : analytics.posts.map(row => (
                      <div key={row.id} className="flex items-center gap-3 rounded-xl border border-neutral-200 p-2">
                        <img src={row.image} alt="" loading="lazy" referrerPolicy="no-referrer" className="h-12 w-12 shrink-0 rounded-lg object-cover" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[11px] font-semibold">{row.title}</p>
                          <p className="mt-0.5 text-[10px] text-neutral-500">
                            {row.publicationStatus === 'approved' ? localizeCopy('已发布', 'Pubblicato') : row.publicationStatus === 'pending' ? localizeCopy('审核中', 'In revisione') : row.publicationStatus === 'rejected' ? localizeCopy('未通过', 'Rifiutato') : row.publicationStatus}
                          </p>
                          <p className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-neutral-600">
                            <span>{localizeCopy('播放', 'Viste')} {row.views}</span>
                            <span>{localizeCopy('完播', 'Completati')} {row.completions || 0}</span>
                            <span>{localizeCopy('平均观看', 'Durata media')} {Math.round((row.avgWatchedMs || 0) / 100) / 10}s</span>
                            <span>{localizeCopy('赞', 'Like')} {row.likes}</span>
                            <span>{localizeCopy('评论', 'Commenti')} {row.comments}</span>
                            <span>{localizeCopy('收藏', 'Salvati')} {row.saves}</span>
                            <span>{localizeCopy('商品点击', 'Click')} {row.productClicks}</span>
                          </p>
                        </div>
                        <div className="flex shrink-0 flex-col gap-1">
                          <button type="button" onClick={() => { setAnalyticsOpen(false); if (row.publicationStatus === 'approved') openFeed(row.id); }} className="rounded-full border border-neutral-300 px-3 py-1 text-[10px]">{localizeCopy('查看', 'Apri')}</button>
                          <button type="button" onClick={() => void deleteOwnPost(row)} aria-label={localizeCopy('删除作品', 'Elimina post')} className="rounded-full border border-rose-200 px-3 py-1 text-[10px] text-rose-600">{localizeCopy('删除', 'Elimina')}</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {lightboxImage && (
        <div
          className="fixed inset-0 z-[80] flex flex-col bg-black/95 p-3 text-white sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-label={localizeCopy('图片预览', 'Anteprima immagine')}
          onClick={() => setLightboxImage(null)}
          onTouchStart={event => { lightboxTouchRef.current = event.touches[0]?.clientX ?? null; }}
          onTouchEnd={event => {
            const start = lightboxTouchRef.current;
            lightboxTouchRef.current = null;
            if (start === null) return;
            const delta = (event.changedTouches[0]?.clientX ?? start) - start;
            if (Math.abs(delta) > 40) stepLightbox(delta < 0 ? 1 : -1);
          }}
        >
          <div className="flex items-center justify-between gap-3">
            <p className="truncate text-xs font-bold uppercase tracking-[0.16em] text-white/80">{lightboxImage.items[lightboxImage.index]?.title || ''}</p>
            <div className="flex items-center gap-1">
              <span className="min-w-12 text-center text-xs tabular-nums text-white/80">{lightboxImage.index + 1} / {lightboxImage.items.length}</span>
              <button type="button" onClick={event => { event.stopPropagation(); setLightboxZoom(value => Math.max(1, Number((value - 0.25).toFixed(2)))); }} className="p-2" aria-label={localizeCopy('缩小', 'Riduci')}>−</button>
              <span className="min-w-12 text-center text-xs">{Math.round(lightboxZoom * 100)}%</span>
              <button type="button" onClick={event => { event.stopPropagation(); setLightboxZoom(value => Math.min(3, Number((value + 0.25).toFixed(2)))); }} className="p-2" aria-label={localizeCopy('放大', 'Ingrandisci')}>+</button>
              <button type="button" onClick={event => { event.stopPropagation(); const current = lightboxImage.items[lightboxImage.index]; if (current) void shareImage(current.src, current.title); }} className="p-2" aria-label={localizeCopy('分享图片', 'Condividi immagine')}><Share2 className="h-4 w-4" /></button>
              <button type="button" onClick={() => setLightboxImage(null)} className="p-2" aria-label={localizeCopy('关闭', 'Chiudi')}><X className="h-5 w-5" /></button>
            </div>
          </div>
          <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-auto py-4" onClick={event => event.stopPropagation()}>
            {lightboxImage.index > 0 && (
              <button type="button" onClick={() => stepLightbox(-1)} aria-label={localizeCopy('上一张', 'Immagine precedente')} className="absolute left-0 top-1/2 z-[1] flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-2xl leading-none text-white hover:bg-black/70">‹</button>
            )}
            <img src={lightboxImage.items[lightboxImage.index]?.src || ''} alt={lightboxImage.items[lightboxImage.index]?.title || ''} className="max-h-full max-w-full object-contain transition-transform duration-200" style={{ transform: `scale(${lightboxZoom})` }} referrerPolicy="no-referrer" onWheel={event => { event.preventDefault(); setLightboxZoom(value => Math.min(3, Math.max(1, Number((value + (event.deltaY < 0 ? 0.1 : -0.1)).toFixed(2))))); }} />
            {lightboxImage.index < lightboxImage.items.length - 1 && (
              <button type="button" onClick={() => stepLightbox(1)} aria-label={localizeCopy('下一张', 'Immagine successiva')} className="absolute right-0 top-1/2 z-[1] flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-2xl leading-none text-white hover:bg-black/70">›</button>
            )}
          </div>
          {lightboxImage.items.length > 1 && (
            <div className="flex items-center justify-center gap-1.5 pb-1" onClick={event => event.stopPropagation()}>
              {lightboxImage.items.map((item, itemIndex) => (
                <button
                  key={`${item.src}-${itemIndex}`}
                  type="button"
                  onClick={() => { setLightboxZoom(1); setLightboxImage(previous => previous ? { ...previous, index: itemIndex } : previous); }}
                  aria-label={`${localizeCopy('第', 'Immagine')} ${itemIndex + 1}`}
                  aria-current={itemIndex === lightboxImage.index}
                  className={`h-1.5 rounded-full transition-all ${itemIndex === lightboxImage.index ? 'w-6 bg-white' : 'w-1.5 bg-white/40'}`}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
};
