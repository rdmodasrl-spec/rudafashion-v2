import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Check, ChevronLeft, ChevronRight, Copy, Download, Edit3, FolderOpen, ImagePlus, Maximize2, Minus, Plus, Search, Star, Trash2, UploadCloud, X } from 'lucide-react';
import { useB2B } from '../../../../context/B2BContext';
import { SmartImageUploader } from './SmartImageUploader';
import { apiGet, apiPost, apiRequest } from '../../../../api/client';

type SharedGalleryImage = {
  id: string;
  image: string;
  merchantId: string;
  merchantName: string;
  createdAt: string;
  featured?: boolean;
  title?: string;
  caption?: string;
  category?: string;
  rightsStatus?: 'authorized' | 'pending' | 'restricted';
  publicationStatus?: 'draft' | 'pending' | 'approved' | 'unpublished';
};

export const MerchantGallery: React.FC<{ onBack?: () => void; mode?: 'merchant' | 'admin' }> = ({ onBack, mode = 'merchant' }) => {
  const { merchants, products, selectedMerchantId, activeMerchantId, lang, addNotification, localizeCopy } = useB2B();
  const merchantId = activeMerchantId || selectedMerchantId || 'mch-prato';
  const merchant = merchants.find(item => item.id === merchantId) || merchants[0];
  const isAdmin = mode === 'admin';
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [sourceFilter, setSourceFilter] = useState<'all' | 'shared' | 'catalog' | 'mine'>('all');
  const [adminFilter, setAdminFilter] = useState<'all' | 'featured' | 'unfeatured'>('all');
  const [galleryQuery, setGalleryQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [sharedImages, setSharedImages] = useState<SharedGalleryImage[]>([]);
  const [galleryLoading, setGalleryLoading] = useState(true);
  const [sharing, setSharing] = useState(false);
  const isIt = lang === 'it';

  const productImages = useMemo(() => {
    const images = products.filter(product => product.merchantId === merchant?.id).flatMap(product => product.images || []);
    return Array.from(new Set(images));
  }, [merchant?.id, products]);
  useEffect(() => {
    setGalleryLoading(true);
    void apiGet<{ success: true; images: SharedGalleryImage[] }>(isAdmin ? '/api/admin/gallery' : '/api/merchant/gallery')
      .then(result => setSharedImages(result.images || []))
      .catch(() => addNotification('warning', localizeCopy('共享图库读取失败', 'Gallery unavailable'), localizeCopy('请稍后刷新重试', 'Try again later.')))
      .finally(() => setGalleryLoading(false));
  }, [merchantId, isAdmin]);

  const allImages = Array.from(new Set([...uploadedImages, ...sharedImages.map(item => item.image), ...productImages]));
  const visibleImages = allImages.filter(image => {
    const shared = sharedImages.find(item => item.image === image);
    if (isAdmin && shared && adminFilter === 'featured' && !shared.featured) return false;
    if (isAdmin && shared && adminFilter === 'unfeatured' && shared.featured) return false;
    if (isAdmin && shared && galleryQuery.trim()) {
      const query = galleryQuery.trim().toLocaleLowerCase();
      if (![shared.title, shared.caption, shared.merchantName].some(value => value?.toLocaleLowerCase().includes(query))) return false;
    }
    if (sourceFilter === 'shared') return Boolean(shared);
    if (sourceFilter === 'mine') return shared?.merchantId === merchantId || uploadedImages.includes(image);
    if (sourceFilter === 'catalog') return productImages.includes(image);
    return true;
  });
  const selectedVisibleIds = selectedIds.filter(id => visibleImages.some(image => sharedImages.some(item => item.id === id && item.image === image)));
  const selectedIndex = selectedImage ? visibleImages.indexOf(selectedImage) : -1;

  const openImage = (image: string) => {
    setSelectedImage(image);
    setZoom(1);
  };
  const moveImage = (direction: -1 | 1) => {
    if (!visibleImages.length) return;
    const nextIndex = (Math.max(0, selectedIndex) + direction + visibleImages.length) % visibleImages.length;
    setSelectedImage(visibleImages[nextIndex]);
    setZoom(1);
  };

  useEffect(() => {
    if (!selectedImage) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSelectedImage(null);
      if (event.key === 'ArrowLeft') moveImage(-1);
      if (event.key === 'ArrowRight') moveImage(1);
      if (event.key === '+' || event.key === '=') setZoom(value => Math.min(3, Number((value + 0.25).toFixed(2))));
      if (event.key === '-') setZoom(value => Math.max(1, Number((value - 0.25).toFixed(2))));
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedImage, selectedIndex, visibleImages]);

  const uploadToSharedGallery = async () => {
    if (!uploadedImages.length || sharing) return;
    setSharing(true);
    try {
      const result = await apiPost<{ success: true; images: SharedGalleryImage[] }>(isAdmin ? '/api/admin/gallery' : '/api/merchant/gallery', { images: uploadedImages });
      setSharedImages(previous => [...result.images, ...previous]);
      setUploadedImages([]);
      addNotification('success', localizeCopy('已上传到共享图库', 'Shared gallery updated'), localizeCopy('所有商家现在都可以查看和下载这些图片。', 'All merchant partners can now view and download these images.'));
    } catch (error) {
      addNotification('warning', localizeCopy('共享上传失败', 'Upload failed'), error instanceof Error ? error.message : '服务端未接受图片');
    } finally {
      setSharing(false);
    }
  };

  const copyImageUrl = async (image: string) => {
    try {
      await navigator.clipboard.writeText(image);
      addNotification('success', localizeCopy('图片地址已复制', 'Link copiato'), localizeCopy('可以粘贴到商品资料或品牌页面使用', 'Image URL copied to clipboard'));
    } catch {
      addNotification('warning', localizeCopy('复制失败', 'Copia non riuscita'), localizeCopy('请手动选择图片地址', 'Select the image URL manually'));
    }
  };

  const editGalleryImage = async (image: SharedGalleryImage) => {
    const title = window.prompt('图片标题', image.title || 'RUDA Fashion Edit');
    if (title === null) return;
    const caption = window.prompt('图片说明 / 来源', image.caption || image.merchantName);
    if (caption === null) return;
    const category = window.prompt('内容分类（如 Editorial、Runway、Street Style）', image.category || 'Editorial');
    if (category === null) return;
    const rightsStatus = window.prompt('版权状态：authorized / pending / restricted', image.rightsStatus || 'authorized');
    if (rightsStatus === null || !['authorized', 'pending', 'restricted'].includes(rightsStatus)) {
      addNotification('warning', '版权状态无效', '请使用 authorized、pending 或 restricted');
      return;
    }
    try {
      const result = await apiRequest<{ image: SharedGalleryImage }>(`/api/admin/gallery/${encodeURIComponent(image.id)}`, {
        method: 'PUT',
        body: JSON.stringify({ title, caption, category, rightsStatus })
      });
      setSharedImages(images => images.map(item => item.id === image.id ? result.image : item));
      addNotification('success', '图片信息已更新', '标题和说明已保存');
    } catch {
      addNotification('warning', '编辑失败', '请稍后重试');
    }
  };

  const bulkGalleryAction = async (action: 'feature' | 'unfeature' | 'delete') => {
    if (!selectedVisibleIds.length) return;
    if (action === 'delete' && !window.confirm(`确定删除选中的 ${selectedVisibleIds.length} 张图片吗？`)) return;
    try {
      await Promise.all(selectedVisibleIds.map(id => apiRequest(`/api/admin/gallery/${encodeURIComponent(id)}`, {
        method: action === 'delete' ? 'DELETE' : 'PUT',
        ...(action === 'delete' ? {} : { body: JSON.stringify({ featured: action === 'feature' }) })
      })));
      if (action === 'delete') setSharedImages(images => images.filter(image => !selectedVisibleIds.includes(image.id)));
      else setSharedImages(images => images.map(image => selectedVisibleIds.includes(image.id) ? { ...image, featured: action === 'feature' } : image));
      setSelectedIds([]);
      addNotification('success', '批量操作完成', action === 'delete' ? '选中图片已删除' : '精选状态已更新');
    } catch {
      addNotification('warning', '批量操作失败', '请刷新后重试');
    }
  };

  return (
    <div className="space-y-4">
      <header className="merchant-home-intro relative flex flex-wrap items-start justify-between gap-5 overflow-hidden rounded-3xl border border-neutral-200 bg-[radial-gradient(ellipse_at_85%_0%,rgba(209,250,229,0.7),transparent_38%),linear-gradient(145deg,#fff_18%,#f8fafc_72%,#eef2ff_100%)] p-4 shadow-sm sm:p-6">
        <div className="flex items-start gap-3">
          {onBack && <button type="button" onClick={onBack} className="mt-1 rounded-xl border border-white bg-white/80 p-2 text-neutral-600 shadow-sm hover:bg-white cursor-pointer" title={localizeCopy('返回后台', 'Indietro')}><ArrowLeft className="h-4 w-4" /></button>}
          <div>
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.24em] text-neutral-500"><FolderOpen className="h-4 w-4" /> {localizeCopy('品牌素材图库', 'Brand media library')}</div>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight text-neutral-950 sm:text-3xl">{isAdmin ? (localizeCopy('RUDA · 全网图库管理', 'RUDA · Editorial Media')) : (localizeCopy("{{RUDA_ARG_0}} · 商家图库", "{{RUDA_ARG_0}} · Media", [String(merchant.name)]))}</h1>
          </div>
        </div>
        <div className="grid grid-cols-3 divide-x divide-neutral-200 overflow-hidden rounded-2xl border border-neutral-200 bg-white/90 text-center shadow-sm">
          <div className="px-3 py-2"><p className="text-[9px] uppercase tracking-widest text-neutral-400">Total</p><p className="mt-1 text-sm font-bold">{sharedImages.length}</p></div>
          <div className="px-3 py-2"><p className="text-[9px] uppercase tracking-widest text-neutral-400">精选</p><p className="mt-1 text-sm font-bold text-[#149aaa]">{sharedImages.filter(image => image.featured).length}</p></div>
          <div className="px-3 py-2"><p className="text-[9px] uppercase tracking-widest text-neutral-400">选中</p><p className="mt-1 text-sm font-bold">{selectedVisibleIds.length}</p></div>
        </div>
      </header>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_1.5fr]">
        <div className="merchant-home-card rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex items-center justify-between"><h2 className="text-sm font-bold text-neutral-900">{localizeCopy('上传新素材', 'Upload assets')}</h2><UploadCloud className="h-4 w-4 text-neutral-500" /></div>
          <p className="mt-1 text-[10px] text-neutral-500">{localizeCopy('JPG / PNG / WebP · 自动压缩', 'JPG / PNG / WebP · compressione automatica')}</p>
          <div className="mt-4"><SmartImageUploader value={uploadedImages} onChange={setUploadedImages} maxImages={24} isIt={isIt} /></div>
          {uploadedImages.length > 0 && <button type="button" onClick={() => void uploadToSharedGallery()} disabled={sharing} className="mt-3 flex w-full items-center justify-center gap-2 bg-neutral-950 px-3 py-2.5 text-xs font-semibold text-white hover:bg-neutral-700 disabled:opacity-50 cursor-pointer"><Check className="h-4 w-4" />{sharing ? (localizeCopy('上传中...', 'Uploading...')) : (isAdmin ? (localizeCopy('发布到全网图库', 'Publish to shared library')) : (localizeCopy('上传到商家共享图库', 'Share with all merchants')))}</button>}
        </div>

        <div className="merchant-home-card rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-sm font-bold text-neutral-900">{localizeCopy('商家共享图库', 'Shared family gallery')}</h2></div>          <span className="text-[11px] text-neutral-400">{sharedImages.length} {localizeCopy('张共享图片', 'shared images')} · {sharedImages.filter(image => image.publicationStatus === 'pending').length} 待审核</span></div>
          <div className="mt-4 flex flex-wrap items-center gap-1.5 border-y border-neutral-100 py-3">
            {isAdmin && <div className="relative mr-1 min-w-48 flex-1"><Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-neutral-400" /><input value={galleryQuery} onChange={event => setGalleryQuery(event.target.value)} placeholder="搜索标题、来源、说明" className="w-full border border-neutral-200 py-1.5 pl-8 pr-2 text-xs outline-none focus:border-[#14edfc]" /></div>}
            {([['all', '全部'], ['shared', '共享'], ['mine', '我的上传'], ['catalog', '商品目录']] as const).map(([key, label]) => <button key={key} type="button" onClick={() => setSourceFilter(key)} className={`rounded-full px-3 py-1.5 text-[11px] font-semibold cursor-pointer ${sourceFilter === key ? 'bg-neutral-950 text-white' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'}`}>{isIt ? key : label}</button>)}
            {isAdmin && ([['all', '全部状态'], ['featured', '已精选'], ['unfeatured', '未精选']] as const).map(([key, label]) => <button key={key} type="button" onClick={() => setAdminFilter(key)} className={`rounded-full px-3 py-1.5 text-[11px] font-semibold cursor-pointer ${adminFilter === key ? 'bg-[#14edfc] text-black' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'}`}>{label}</button>)}
          </div>
          {isAdmin && selectedVisibleIds.length > 0 && <div className="flex flex-wrap items-center gap-2 border-b border-neutral-100 pb-3"><span className="mr-auto text-xs font-semibold text-neutral-600">已选择 {selectedVisibleIds.length} 张</span><button type="button" onClick={() => void bulkGalleryAction('feature')} className="flex cursor-pointer items-center gap-1 border border-neutral-300 px-2.5 py-1.5 text-[11px] font-semibold hover:border-black"><Star className="h-3.5 w-3.5" />设为精选</button><button type="button" onClick={() => void bulkGalleryAction('unfeature')} className="cursor-pointer border border-neutral-300 px-2.5 py-1.5 text-[11px] font-semibold hover:border-black">取消精选</button><button type="button" onClick={() => void bulkGalleryAction('delete')} className="flex cursor-pointer items-center gap-1 border border-red-200 px-2.5 py-1.5 text-[11px] font-semibold text-red-600 hover:bg-red-50"><Trash2 className="h-3.5 w-3.5" />批量删除</button></div>}
          {galleryLoading ? <div className="flex min-h-56 items-center justify-center text-xs text-neutral-500">{localizeCopy('正在加载共享图库...', 'Loading gallery...')}</div> : visibleImages.length === 0 ? <div className="flex min-h-56 flex-col items-center justify-center text-center text-xs text-neutral-500"><ImagePlus className="mb-2 h-8 w-8 text-neutral-300" />{localizeCopy('当前筛选暂无图片', 'No images in this view')}</div> : <div className="mt-5 columns-2 gap-2 sm:columns-3 sm:gap-3"><div className="sr-only">{selectedImage}</div>{visibleImages.map((image, index) => { const shared = sharedImages.find(item => item.image === image); return <div key={`${image}-${index}`} className="group relative mb-2 block w-full overflow-hidden bg-[#e7e2da] sm:mb-3"><button type="button" onClick={() => openImage(image)} className="block w-full cursor-pointer text-left"><img src={image} alt={`${merchant.name} ${index + 1}`} className="block h-auto w-full transition-transform duration-700 group-hover:scale-105" loading="lazy" referrerPolicy="no-referrer" /><span className="absolute left-2 top-2 bg-white/90 px-1.5 py-1 text-[8px] font-bold tracking-[0.1em] text-neutral-900 sm:text-[9px]">{shared ? (shared.merchantId === merchantId ? (localizeCopy('我的上传', 'MY UPLOAD')) : shared.merchantName) : productImages.includes(image) ? 'CATALOG' : (localizeCopy('待上传', 'LOCAL'))}</span></button>{isAdmin && shared && <button type="button" onClick={() => setSelectedIds(current => current.includes(shared.id) ? current.filter(id => id !== shared.id) : [...current, shared.id])} className={`absolute right-2 top-2 z-10 flex h-7 w-7 cursor-pointer items-center justify-center border ${selectedIds.includes(shared.id) ? 'border-[#14edfc] bg-[#14edfc] text-black' : 'border-white/70 bg-black/60 text-white'}`} aria-label="选择图片">{selectedIds.includes(shared.id) ? <Check className="h-4 w-4" /> : <span className="h-3 w-3 border border-white/80" />}</button>}<span className="pointer-events-none absolute bottom-2 right-2 bg-black/75 p-1.5 text-white opacity-0 transition-opacity group-hover:opacity-100"><Maximize2 className="h-3 w-3" /></span></div>; })}</div>}
        </div>
      </section>

      {selectedImage && <div className="fixed inset-0 z-50 flex flex-col bg-neutral-950/95 p-3 sm:p-6" onClick={() => setSelectedImage(null)}><div className="flex items-center justify-between text-white"><div><div className="text-xs font-semibold tracking-[0.14em]">{selectedIndex + 1} / {visibleImages.length}</div>{(() => { const target = sharedImages.find(item => item.image === selectedImage); return target ? <div className="mt-1 flex flex-wrap gap-2 text-[10px] text-white/60"><span>{target.category || 'Editorial'}</span><span>·</span><span>{target.rightsStatus === 'restricted' ? '受限使用' : target.rightsStatus === 'pending' ? '待确认授权' : '已授权'}</span></div> : null; })()}</div><div className="flex items-center gap-1"><button type="button" onClick={event => { event.stopPropagation(); setZoom(value => Math.max(1, Number((value - 0.25).toFixed(2)))); }} className="p-2 hover:bg-white/10 cursor-pointer" title="缩小"><Minus className="h-4 w-4" /></button><span className="min-w-12 text-center text-xs">{Math.round(zoom * 100)}%</span><button type="button" onClick={event => { event.stopPropagation(); setZoom(value => Math.min(3, Number((value + 0.25).toFixed(2)))); }} className="p-2 hover:bg-white/10 cursor-pointer" title="放大"><Plus className="h-4 w-4" /></button><button type="button" onClick={event => { event.stopPropagation(); setZoom(1); }} className="p-2 hover:bg-white/10 cursor-pointer" title="重置"><Maximize2 className="h-4 w-4" /></button><button type="button" onClick={() => setSelectedImage(null)} className="p-2 hover:bg-white/10 cursor-pointer" title="关闭"><X className="h-5 w-5" /></button></div></div><div className="relative flex min-h-0 flex-1 items-center justify-center" onClick={event => event.stopPropagation()}><button type="button" onClick={() => moveImage(-1)} className="absolute left-0 z-10 rounded-full bg-white/10 p-3 text-white hover:bg-white/25 cursor-pointer" title="上一张"><ChevronLeft className="h-6 w-6" /></button><img src={selectedImage} alt="预览图片" className="max-h-full max-w-full object-contain transition-transform duration-200" style={{ transform: `scale(${zoom})` }} referrerPolicy="no-referrer" /><button type="button" onClick={() => moveImage(1)} className="absolute right-0 z-10 rounded-full bg-white/10 p-3 text-white hover:bg-white/25 cursor-pointer" title="下一张"><ChevronRight className="h-6 w-6" /></button></div><div className="flex items-center justify-between gap-3 border-t border-white/15 pt-3 text-white" onClick={event => event.stopPropagation()}><span className="max-w-[45vw] truncate text-xs text-white/60">{sharedImages.find(item => item.image === selectedImage)?.merchantName || '商品目录图片'}</span><div className="flex flex-wrap gap-2"><a href={selectedImage} download={`ruda-gallery-${Date.now()}.jpg`} className="flex items-center gap-1 bg-white px-3 py-2 text-xs font-semibold text-black cursor-pointer"><Download className="h-3.5 w-3.5" />下载</a>      <button type="button" onClick={() => void copyImageUrl(selectedImage)} className="flex items-center gap-1 border border-white/30 px-3 py-2 text-xs font-semibold text-white cursor-pointer"><Copy className="h-3.5 w-3.5" />复制地址</button>{isAdmin && <button type="button" onClick={() => { const target = sharedImages.find(item => item.image === selectedImage); if (target) void editGalleryImage(target); }} className="flex items-center gap-1 border border-white/30 px-3 py-2 text-xs font-semibold text-white cursor-pointer"><Edit3 className="h-3.5 w-3.5" />编辑信息</button>}{isAdmin && <button type="button" onClick={() => { const target = sharedImages.find(item => item.image === selectedImage); if (!target) return; void apiRequest(`/api/admin/gallery/${encodeURIComponent(target.id)}`, { method: 'PUT', body: JSON.stringify({ featured: !target.featured }) }).then(result => { const updated = (result as { image: SharedGalleryImage }).image; setSharedImages(images => images.map(image => image.id === updated.id ? updated : image)); addNotification('success', '精选状态已更新', updated.featured ? '图片已设为图库精选' : '图片已取消精选'); }).catch(() => addNotification('warning', '设置失败', '请稍后重试')); }} className="border border-amber-300 px-3 py-2 text-xs font-semibold text-amber-300 cursor-pointer">{sharedImages.find(item => item.image === selectedImage)?.featured ? '取消精选' : '设为精选'}</button>}{(isAdmin || sharedImages.find(item => item.image === selectedImage)?.merchantId === merchantId) && <button type="button" onClick={() => { const target = sharedImages.find(item => item.image === selectedImage); if (!target) return; void apiRequest(`${isAdmin ? '/api/admin/gallery' : '/api/merchant/gallery'}/${encodeURIComponent(target.id)}`, { method: 'DELETE' }).then(() => { setSharedImages(images => images.filter(image => image.id !== target.id)); setSelectedImage(null); addNotification('success', '图片已删除', '共享图库已同步更新'); }).catch(() => addNotification('warning', '删除失败', '请稍后重试')); }} className="flex items-center gap-1 border border-red-300 px-3 py-2 text-xs font-semibold text-red-300 cursor-pointer"><Trash2 className="h-3.5 w-3.5" />删除</button>}</div></div><div className="mt-3 flex gap-2 overflow-x-auto pb-1" onClick={event => event.stopPropagation()}>{visibleImages.map((image, index) => <button key={`${image}-thumb-${index}`} type="button" onClick={() => { setSelectedImage(image); setZoom(1); }} className={`h-14 w-11 shrink-0 overflow-hidden border-2 cursor-pointer ${image === selectedImage ? 'border-white' : 'border-transparent opacity-60 hover:opacity-100'}`}><img src={image} alt="缩略图" className="h-full w-full object-cover" /></button>)}</div></div>}
    </div>
  );
};
