import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { apiGet, apiPost, apiPostWithUploadProgress, apiPut } from '../../../../api/client';
import { merchantIndustries } from '../../../../constants/merchantIndustries';
import { containsAdminOperatorCredential } from '../../../../server/modagptAdminOperator';
import type { AdminOperatorDraftPayload, AdminOperatorMerchantDraft, AdminOperatorProductDraft } from '../../../../server/modagptAdminOperator';
import { DEFAULT_ADMIN_OPERATOR_INSTRUCTIONS } from '../../../../server/modagptAdminOperator';
import type { Merchant } from '../../../../types/b2b';
import { AdminPageHeader } from './AdminPageHeader';

type OperatorMode = 'merchant' | 'products' | 'training' | 'drafts';
type OperatorDraft = {
  id: string;
  kind: 'merchant' | 'products';
  status: string;
  createdAt: string;
  payload: AdminOperatorDraftPayload;
  result?: string | null;
};
type OperatorImage = { name: string; url: string; bytes: number };
type ChatMessage = { role: 'user' | 'assistant'; content: string };
type AssistantResponse = {
  reply: string;
  merchant: Partial<AdminOperatorMerchantDraft>;
  products: Array<Partial<AdminOperatorProductDraft>>;
  missingFields: string[];
};

const emptyMerchant = (): AdminOperatorMerchantDraft => ({
  name: '',
  companyLegalName: '',
  contactEmail: '',
  country: 'Italy',
  city: '',
  industry: 'FASHION_COMPANY',
  merchantZone: 'iolo',
  businessType: 'brand_supplier',
  contactPerson: '',
  contactPhone: '',
  vatNumber: '',
  description: '',
  specialties: []
});

const emptyProduct = (): AdminOperatorProductDraft => ({
  styleNo: '',
  name: '',
  brand: '',
  category: '',
  subCategory: '',
  season: '',
  fabric: '',
  composition: '',
  description: '',
  wholesalePrice: null,
  rrpPrice: null,
  moq: null,
  images: []
});

const fieldClass = 'mt-1.5 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2.5 text-sm text-neutral-900 outline-none focus:border-neutral-700 focus:ring-2 focus:ring-neutral-200';
const labelClass = 'block text-xs font-semibold text-neutral-600';

export const AdminModaGptOperator: React.FC<{ merchants: Array<Pick<Merchant, 'id' | 'name'>> }> = ({ merchants }) => {
  const [mode, setMode] = useState<OperatorMode>('merchant');
  const [merchant, setMerchant] = useState<AdminOperatorMerchantDraft>(emptyMerchant);
  const [product, setProduct] = useState<AdminOperatorProductDraft>(emptyProduct);
  const [productMerchantId, setProductMerchantId] = useState('');
  const [initialPassword, setInitialPassword] = useState('');
  const [instructions, setInstructions] = useState(DEFAULT_ADMIN_OPERATOR_INSTRUCTIONS);
  const [images, setImages] = useState<OperatorImage[]>([]);
  const [selectedImage, setSelectedImage] = useState<OperatorImage | null>(null);
  const [drafts, setDrafts] = useState<OperatorDraft[]>([]);
  const [currentDraftId, setCurrentDraftId] = useState<string | null>(null);
  const [currentDraftKind, setCurrentDraftKind] = useState<'merchant' | 'products' | null>(null);
  const [conversation, setConversation] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatBusy, setChatBusy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [showMerchantConfirm, setShowMerchantConfirm] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const refreshDrafts = useCallback(async () => {
    const response = await apiGet<{ drafts: OperatorDraft[] }>('/api/admin/modagpt/operator/drafts');
    setDrafts(response.drafts);
  }, []);

  useEffect(() => {
    void refreshDrafts()
      .catch(reason => setError(reason instanceof Error ? reason.message : '读取草稿失败'));
  }, [refreshDrafts]);

  useEffect(() => {
    if (mode === 'training') {
      void apiGet<{ instructions: string }>('/api/admin/modagpt/operator/config')
        .then(response => setInstructions(response.instructions))
        .catch(reason => setError(reason instanceof Error ? reason.message : '读取训练指令失败'));
    }
    if (mode === 'products') {
      void apiGet<{ images: OperatorImage[] }>('/api/admin/modagpt/operator/images')
        .then(response => setImages(response.images))
        .catch(reason => setError(reason instanceof Error ? reason.message : '读取商品图片失败'));
    }
  }, [mode]);

  const currentPayload = useMemo<AdminOperatorDraftPayload>(() => mode === 'products'
    ? { kind: 'products', merchantId: productMerchantId, products: [product] }
    : { kind: 'merchant', merchant }, [merchant, mode, product, productMerchantId]);

  const saveCurrentDraft = useCallback(async (): Promise<string> => {
    const response = currentDraftId && currentDraftKind === currentPayload.kind
      ? await apiPut<{ draft: OperatorDraft; missingFields: string[] }>(`/api/admin/modagpt/operator/drafts/${encodeURIComponent(currentDraftId)}`, { payload: currentPayload })
      : await apiPost<{ draft: OperatorDraft; missingFields: string[] }>('/api/admin/modagpt/operator/drafts', { payload: currentPayload });
    setCurrentDraftId(response.draft.id);
    setCurrentDraftKind(response.draft.kind);
    await refreshDrafts();
    setNotice(response.missingFields.length
      ? `草稿已保存，待补充：${response.missingFields.join('、')}`
      : '草稿已保存，可继续复核资料。');
    return response.draft.id;
  }, [currentDraftId, currentDraftKind, currentPayload, refreshDrafts]);

  const sendMessage = async () => {
    const message = chatInput.trim();
    if (!message || chatBusy) return;
    if (containsAdminOperatorCredential(message)) {
      setError('请勿在聊天中发送密码、API 密钥或支付凭据。开户密码请仅在确认表单中输入。');
      return;
    }
    setError('');
    setNotice('');
    setChatInput('');
    setConversation(previous => [...previous, { role: 'user', content: message }]);
    setChatBusy(true);
    try {
      const response = await apiPost<{ assistant: AssistantResponse }>('/api/admin/modagpt/operator/chat', {
        message,
        history: conversation.slice(-12),
        draft: currentPayload
      }, 55_000);
      const assistant = response.assistant;
      if (mode === 'merchant') {
        setMerchant(previous => ({
          ...previous,
          ...Object.fromEntries(Object.entries(assistant.merchant).filter(([, value]) => value !== '' && value !== undefined)),
          specialties: assistant.merchant.specialties?.length ? assistant.merchant.specialties : previous.specialties
        }));
      } else if (mode === 'products' && assistant.products[0]) {
        const suggestion = assistant.products[0];
        setProduct(previous => ({
          ...previous,
          name: suggestion.name || previous.name,
          category: suggestion.category || previous.category,
          subCategory: suggestion.subCategory || previous.subCategory,
          description: suggestion.description || previous.description
        }));
      }
      const assistantText = assistant.missingFields.length
        ? `${assistant.reply}\n\n待补充：${assistant.missingFields.join('、')}`
        : assistant.reply;
      setConversation(previous => [...previous, { role: 'assistant', content: assistantText }]);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'ModaUI 暂时无法处理，请重试。');
    } finally {
      setChatBusy(false);
    }
  };

  const saveTraining = async () => {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await apiPut('/api/admin/modagpt/operator/config', { instructions });
      setNotice('运营助理训练指令已保存。安全、事实核验和人工确认规则无法被覆盖。');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '保存训练指令失败');
    } finally {
      setBusy(false);
    }
  };

  const analyzeSelectedImage = async () => {
    if (!selectedImage || !productMerchantId || busy) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const response = await apiPost<{ draft: OperatorDraft; missingFields: string[] }>(
        '/api/admin/modagpt/operator/images/analyze',
        { merchantId: productMerchantId, imageUrl: selectedImage.url },
        70_000
      );
      if (response.draft.payload.kind === 'products') {
        setProduct(response.draft.payload.products[0] || emptyProduct());
        setCurrentDraftId(response.draft.id);
        setCurrentDraftKind('products');
        setMode('products');
        setNotice(`已生成商品草稿。还需补充：${response.missingFields.join('、') || '请人工复核全部资料'}`);
        await refreshDrafts();
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '图片分析失败');
    } finally {
      setBusy(false);
    }
  };

  const uploadImage = async (file: File | undefined) => {
    if (!file || busy) return;
    setBusy(true);
    setUploadProgress(0);
    setError('');
    setNotice('');
    try {
      const form = new FormData();
      form.append('image', file);
      const response = await apiPostWithUploadProgress<{ image: OperatorImage }>(
        '/api/admin/modagpt/operator/images/upload',
        form,
        45_000,
        (loaded, total) => setUploadProgress(total > 0 ? Math.min(100, Math.round((loaded / total) * 100)) : 0)
      );
      setImages(previous => [response.image, ...previous.filter(image => image.url !== response.image.url)]);
      setSelectedImage(response.image);
      setNotice('图片已安全转为 WebP 并加入商品图片库，尚未创建商品。');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '上传商品图片失败');
    } finally {
      setUploadProgress(null);
      setBusy(false);
    }
  };

  const addSelectedImageToProduct = () => {
    if (!selectedImage) return;
    setProduct(previous => previous.images.includes(selectedImage.url) || previous.images.length >= 8
      ? previous
      : { ...previous, images: [...previous.images, selectedImage.url] });
  };

  const loadDraft = (draft: OperatorDraft) => {
    setCurrentDraftId(draft.id);
    setCurrentDraftKind(draft.kind);
    setError('');
    setNotice(`已载入草稿 ${draft.id}`);
    setConversation([]);
    if (draft.payload.kind === 'merchant') {
      setMerchant(draft.payload.merchant);
      setMode('merchant');
      setInitialPassword('');
    } else {
      setProductMerchantId(draft.payload.merchantId);
      setProduct(draft.payload.products[0] || emptyProduct());
      setMode('products');
    }
  };

  const createMerchant = async () => {
    if (initialPassword.length < 8) {
      setError('初始密码至少需要 8 个字符。');
      return;
    }
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const draftId = await saveCurrentDraft();
      const response = await apiPost<{ result: { name?: string } }>(
        `/api/admin/modagpt/operator/drafts/${encodeURIComponent(draftId)}/commit`,
        { confirmation: 'CREATE_MERCHANT', password: initialPassword }
      );
      setInitialPassword('');
      setNotice(`商家账号已创建并保持未验证状态：${response.result.name || merchant.name}`);
      setCurrentDraftId(null);
      setCurrentDraftKind(null);
      setShowMerchantConfirm(false);
      await refreshDrafts();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '创建账号失败');
    } finally {
      setInitialPassword('');
      setBusy(false);
    }
  };

  const importProductDraft = async () => {
    if (!window.confirm('确认将商品导入 RUDA？导入后仍为非公开草稿，不会发布到商城。')) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const draftId = await saveCurrentDraft();
      const response = await apiPost<{ result: { products?: Array<{ id: string }> } }>(
        `/api/admin/modagpt/operator/drafts/${encodeURIComponent(draftId)}/commit`,
        { confirmation: 'IMPORT_PRODUCT_DRAFTS' }
      );
      const count = response.result.products?.length || 0;
      setNotice(`已导入 ${count} 件商品草稿；商品仍未公开，需另行审核发布。`);
      setCurrentDraftId(null);
      setCurrentDraftKind(null);
      await refreshDrafts();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '商品导入失败');
    } finally {
      setBusy(false);
    }
  };

  const changeMerchant = (field: keyof AdminOperatorMerchantDraft, value: string) => {
    setMerchant(previous => ({ ...previous, [field]: value }));
  };

  const changeProduct = (field: keyof AdminOperatorProductDraft, value: string) => {
    const numericValue = value.trim() ? Number(value) : null;
    setProduct(previous => ({
      ...previous,
      [field]: ['wholesalePrice', 'rrpPrice', 'moq'].includes(field)
        ? (numericValue !== null && Number.isFinite(numericValue) ? numericValue : null)
        : value
    }));
  };

  const modeButton = (key: OperatorMode, label: string) => (
    <button
      key={key}
      type="button"
      onClick={() => {
        if (mode !== key && (key === 'merchant' || key === 'products')) setConversation([]);
        setMode(key);
        setError('');
        setNotice('');
      }}
      className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${mode === key ? 'bg-neutral-950 text-white' : 'text-neutral-600 hover:bg-neutral-100'}`}
    >
      {label}
    </button>
  );

  return (
    <section className="space-y-5">
      <AdminPageHeader title="运营助手" />
      <p className="text-xs text-neutral-600">AI 仅生成草稿；写入须管理员确认，商品保持非公开。</p>

      {(notice || error) && (
        <div className={`rounded-xl border px-4 py-3 text-sm ${error ? 'border-red-200 bg-red-50 text-red-800' : 'border-emerald-200 bg-emerald-50 text-emerald-800'}`}>
          {error || notice}
        </div>
      )}

      <nav className="flex flex-wrap gap-1 rounded-xl border border-neutral-200 bg-white p-1">
        {modeButton('merchant', '商家开户')}
        {modeButton('products', '商品建档')}
        {modeButton('training', '训练指令')}
        {modeButton('drafts', `草稿管理${drafts.length ? ` · ${drafts.filter(item => item.status === 'draft').length}` : ''}`)}
      </nav>

      {mode === 'training' && (
        <section className="rounded-2xl border border-neutral-200 bg-white p-5 sm:p-6">
          <h2 className="text-base font-bold text-neutral-900">训练设置</h2>
          <p className="mt-1 text-sm text-neutral-500">补充 RUDA 的业务术语和工作偏好。不要粘贴密码、API 密钥或支付资料；系统级事实核验、安全、草稿与审批规则始终优先。</p>
          <textarea value={instructions} onChange={event => setInstructions(event.target.value)} maxLength={20_000} rows={14} className={`${fieldClass} font-mono text-xs leading-5`} />
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <span className="text-xs text-neutral-500">{instructions.length.toLocaleString()} / 20,000</span>
            <button type="button" disabled={busy || instructions.length > 20_000} onClick={() => void saveTraining()} className="rounded-lg bg-neutral-950 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
              {busy ? '保存中…' : '保存训练指令'}
            </button>
          </div>
        </section>
      )}

      {mode === 'drafts' && (
        <section className="rounded-2xl border border-neutral-200 bg-white p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div><h2 className="text-base font-bold text-neutral-900">待审草稿</h2><p className="mt-1 text-sm text-neutral-500">草稿保存企业与商品资料，不保存账号密码。</p></div>
            <button type="button" onClick={() => void refreshDrafts()} className="rounded-lg border border-neutral-300 px-3 py-2 text-sm font-semibold text-neutral-700">刷新</button>
          </div>
          {drafts.length === 0 ? <p className="rounded-lg bg-neutral-50 p-5 text-sm text-neutral-500">还没有运营草稿。</p> : (
            <div className="divide-y divide-neutral-100">
              {drafts.map(draft => (
                <button key={draft.id} type="button" disabled={draft.status !== 'draft'} onClick={() => loadDraft(draft)} className="flex w-full flex-col gap-2 py-4 text-left disabled:cursor-default sm:flex-row sm:items-center sm:justify-between">
                  <span>
                    <span className="block text-sm font-semibold text-neutral-900">
                      {draft.kind === 'merchant'
                        ? `开户：${draft.payload.kind === 'merchant' ? draft.payload.merchant.name || '待填写公司名' : ''}`
                        : `商品：${draft.payload.kind === 'products' ? draft.payload.products[0]?.name || '待填写商品名' : ''}`}
                    </span>
                    <span className="mt-1 block text-xs text-neutral-500">{new Date(draft.createdAt).toLocaleString()} · {draft.id}</span>
                  </span>
                  <span className={`w-fit rounded-full px-2.5 py-1 text-xs font-semibold ${draft.status === 'draft' ? 'bg-amber-50 text-amber-800' : draft.status === 'committed' ? 'bg-emerald-50 text-emerald-800' : 'bg-neutral-100 text-neutral-600'}`}>
                    {draft.status === 'draft' ? '待复核' : draft.status === 'committed' ? '已执行' : draft.status}
                  </span>
                </button>
              ))}
            </div>
          )}
        </section>
      )}

      {(mode === 'merchant' || mode === 'products') && (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
          <section className="space-y-5 rounded-2xl border border-neutral-200 bg-white p-5 sm:p-6">
            {mode === 'merchant' ? (
              <>
                <div>
                  <h2 className="text-base font-bold text-neutral-900">开户资料</h2>
                  <p className="mt-1 text-sm text-neutral-500">先完善并保存草稿；密码仅在最后确认时单独提交。</p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className={labelClass}>公司名称 *<input className={fieldClass} value={merchant.name} onChange={event => changeMerchant('name', event.target.value)} /></label>
                  <label className={labelClass}>法定公司名称 *<input className={fieldClass} value={merchant.companyLegalName} onChange={event => changeMerchant('companyLegalName', event.target.value)} /></label>
                  <label className={labelClass}>登录邮箱 *<input className={fieldClass} type="email" value={merchant.contactEmail} onChange={event => changeMerchant('contactEmail', event.target.value)} /></label>
                  <label className={labelClass}>VAT 税号 *<input className={fieldClass} value={merchant.vatNumber} onChange={event => changeMerchant('vatNumber', event.target.value)} /></label>
                  <label className={labelClass}>行业 *
                    <select className={fieldClass} value={merchant.industry} onChange={event => changeMerchant('industry', event.target.value)}>
                      {merchantIndustries.map(item => <option key={item.id} value={item.id}>{item.zh}</option>)}
                    </select>
                  </label>
                  <label className={labelClass}>商家类型 *
                    <select className={fieldClass} value={merchant.businessType} onChange={event => changeMerchant('businessType', event.target.value)}>
                      <option value="brand_supplier">生产商 / 品牌商</option><option value="manufacturer">服装工厂</option>
                      <option value="wholesaler">批发商</option><option value="atelier">设计工作室</option><option value="distributor">区域代理 / 分销商</option>
                    </select>
                  </label>
                  <label className={labelClass}>国家 *<input className={fieldClass} value={merchant.country} onChange={event => changeMerchant('country', event.target.value)} /></label>
                  <label className={labelClass}>城市 *<input className={fieldClass} value={merchant.city} onChange={event => changeMerchant('city', event.target.value)} /></label>
                  <label className={labelClass}>联系人<input className={fieldClass} value={merchant.contactPerson} onChange={event => changeMerchant('contactPerson', event.target.value)} /></label>
                  <label className={labelClass}>联系电话<input className={fieldClass} value={merchant.contactPhone} onChange={event => changeMerchant('contactPhone', event.target.value)} /></label>
                  <label className={`${labelClass} sm:col-span-2`}>公司简介<textarea className={fieldClass} rows={3} value={merchant.description} onChange={event => changeMerchant('description', event.target.value)} /></label>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" disabled={busy} onClick={() => void saveCurrentDraft()} className="rounded-lg border border-neutral-300 px-4 py-2.5 text-sm font-semibold text-neutral-800 disabled:opacity-50">保存开户草稿</button>
                  <button type="button" disabled={busy} onClick={() => { setError(''); setShowMerchantConfirm(true); }} className="rounded-lg bg-neutral-950 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">复核开户资料并继续</button>
                </div>
              </>
            ) : (
              <>
                <div>
                  <h2 className="text-base font-bold text-neutral-900">商品建档</h2>
                  <p className="mt-1 text-sm text-neutral-500">AI 仅辅助可见款式描述；款号、价格、MOQ 等需要人工提供并复核。</p>
                </div>
                <label className={labelClass}>商品归属商家 *
                  <select className={fieldClass} value={productMerchantId} onChange={event => setProductMerchantId(event.target.value)}>
                    <option value="">选择商家</option>
                    {merchants.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
                  </select>
                </label>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className={labelClass}>款号 *<input className={fieldClass} value={product.styleNo} onChange={event => changeProduct('styleNo', event.target.value)} /></label>
                  <label className={labelClass}>商品名称 *<input className={fieldClass} value={product.name} onChange={event => changeProduct('name', event.target.value)} /></label>
                  <label className={labelClass}>品牌<input className={fieldClass} value={product.brand} onChange={event => changeProduct('brand', event.target.value)} /></label>
                  <label className={labelClass}>分类 *<input className={fieldClass} value={product.category} onChange={event => changeProduct('category', event.target.value)} /></label>
                  <label className={labelClass}>子分类<input className={fieldClass} value={product.subCategory} onChange={event => changeProduct('subCategory', event.target.value)} /></label>
                  <label className={labelClass}>季节<input className={fieldClass} value={product.season} onChange={event => changeProduct('season', event.target.value)} /></label>
                  <label className={labelClass}>批发价 *<input className={fieldClass} type="number" min="0.01" step="0.01" value={product.wholesalePrice ?? ''} onChange={event => changeProduct('wholesalePrice', event.target.value)} /></label>
                  <label className={labelClass}>零售价 *<input className={fieldClass} type="number" min="0.01" step="0.01" value={product.rrpPrice ?? ''} onChange={event => changeProduct('rrpPrice', event.target.value)} /></label>
                  <label className={labelClass}>MOQ *<input className={fieldClass} type="number" min="1" step="1" value={product.moq ?? ''} onChange={event => changeProduct('moq', event.target.value)} /></label>
                  <label className={labelClass}>面料<input className={fieldClass} value={product.fabric} onChange={event => changeProduct('fabric', event.target.value)} /></label>
                  <label className={`${labelClass} sm:col-span-2`}>商品描述<textarea className={fieldClass} rows={4} value={product.description} onChange={event => changeProduct('description', event.target.value)} /></label>
                </div>
                {product.images.length > 0 && <div className="flex gap-3 overflow-x-auto">{product.images.map(image => (
                  <div key={image} className="shrink-0">
                    <img src={image} alt="" className="h-24 w-20 rounded-lg border border-neutral-200 object-cover" />
                    <button type="button" onClick={() => setProduct(previous => ({ ...previous, images: previous.images.filter(item => item !== image) }))} className="mt-1 w-full text-[11px] text-neutral-500 hover:text-red-700">移除</button>
                  </div>
                ))}</div>}
                <div className="flex flex-wrap gap-2">
                  <button type="button" disabled={busy || !productMerchantId} onClick={() => void saveCurrentDraft()} className="rounded-lg border border-neutral-300 px-4 py-2.5 text-sm font-semibold text-neutral-800 disabled:opacity-50">保存商品草稿</button>
                  <button type="button" disabled={busy} onClick={() => void importProductDraft()} className="rounded-lg bg-neutral-950 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{busy ? '处理中…' : '复核并导入为非公开草稿'}</button>
                </div>
                <div className="border-t border-neutral-100 pt-5">
                  <h3 className="text-sm font-bold text-neutral-900">RUDA 商品图片库</h3>
                  <p className="mt-1 text-xs text-neutral-500">上传图片会使用随机静态资源地址；商品记录仍是非公开草稿，持有图片地址的人可直接访问图片。</p>
                  <label className="mt-3 inline-flex cursor-pointer items-center rounded-lg border border-neutral-300 px-3 py-2 text-sm font-semibold text-neutral-800 hover:bg-neutral-50">
                    {uploadProgress === null ? '上传商品图片' : `上传中 ${uploadProgress}%`}
                    <input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} className="sr-only" onChange={event => {
                      const file = event.currentTarget.files?.[0];
                      event.currentTarget.value = '';
                      void uploadImage(file);
                    }} />
                  </label>
                  <div className="mt-3 grid max-h-72 grid-cols-4 gap-2 overflow-y-auto sm:grid-cols-6">
                    {images.map(image => (
                      <button key={image.url} type="button" title={image.name} onClick={() => setSelectedImage(image)} className={`overflow-hidden rounded-lg border-2 ${selectedImage?.url === image.url ? 'border-neutral-950' : 'border-transparent'}`}>
                        <img src={image.url} alt={image.name} loading="lazy" className="aspect-[3/4] w-full object-cover" />
                      </button>
                    ))}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button type="button" disabled={busy || !selectedImage || !productMerchantId} onClick={() => void analyzeSelectedImage()} className="rounded-lg border border-neutral-300 px-4 py-2.5 text-sm font-semibold text-neutral-800 disabled:opacity-50">
                      {busy ? '分析中…' : selectedImage ? `分析 ${selectedImage.name}` : '选择图片后分析'}
                    </button>
                    <button type="button" disabled={!selectedImage || product.images.length >= 8 || product.images.includes(selectedImage.url)} onClick={addSelectedImageToProduct} className="rounded-lg border border-neutral-300 px-4 py-2.5 text-sm font-semibold text-neutral-800 disabled:opacity-50">加入当前商品图片</button>
                  </div>
                </div>
              </>
            )}
          </section>

          <aside className="flex min-h-[520px] flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white">
            <div className="border-b border-neutral-100 px-5 py-4">
              <h2 className="text-sm font-bold text-neutral-900">资料助手</h2>
              <p className="mt-1 text-xs text-neutral-500">描述任务或补充资料；不确定的信息会留空并询问。</p>
            </div>
            <div className="flex-1 space-y-3 overflow-y-auto p-4">
              {conversation.length === 0 && <div className="rounded-xl bg-neutral-50 p-4 text-sm leading-6 text-neutral-600">{mode === 'merchant' ? '例如：帮我整理这家公司的开户资料，缺少的项目请列出来。' : '例如：根据已选商品图片，帮我写一段简洁的商品描述。'}</div>}
              {conversation.map((item, index) => (
                <div key={`${item.role}-${index}`} className={`max-w-[92%] whitespace-pre-wrap rounded-xl px-3.5 py-3 text-sm leading-6 ${item.role === 'user' ? 'ml-auto bg-neutral-950 text-white' : 'bg-neutral-100 text-neutral-800'}`}>{item.content}</div>
              ))}
              {chatBusy && <div className="text-xs text-neutral-500">ModaUI 正在整理资料…</div>}
            </div>
            <div className="border-t border-neutral-100 p-3">
              <textarea value={chatInput} onChange={event => setChatInput(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void sendMessage(); } }} maxLength={4_000} rows={3} placeholder="补充企业或商品信息…" className="w-full resize-none rounded-xl border border-neutral-200 px-3 py-2.5 text-sm outline-none focus:border-neutral-500" />
              <div className="mt-2 flex items-center justify-between gap-3">
                <span className="text-[11px] text-neutral-400">请勿发送密码、API 密钥或支付凭据</span>
                <button type="button" disabled={chatBusy || !chatInput.trim()} onClick={() => void sendMessage()} className="rounded-full bg-neutral-950 px-4 py-2 text-xs font-semibold text-white disabled:opacity-40">发送</button>
              </div>
            </div>
          </aside>
        </div>
      )}

      {showMerchantConfirm && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50 p-4" role="presentation">
          <section role="dialog" aria-modal="true" aria-labelledby="operator-merchant-confirm-title" className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl sm:p-6">
            <h2 id="operator-merchant-confirm-title" className="text-lg font-bold text-neutral-900">最后确认：创建商家账号</h2>
            <p className="mt-2 text-sm leading-6 text-neutral-600">将创建一个未验证、不可公开展示的商家账号。确认公司与邮箱无误后，再输入初始密码。</p>
            <div className="mt-4 rounded-xl bg-neutral-50 p-3 text-sm text-neutral-700">
              <p><strong>公司：</strong>{merchant.name || '未填写'}</p>
              <p className="mt-1"><strong>登录邮箱：</strong>{merchant.contactEmail || '未填写'}</p>
            </div>
            <label className={`${labelClass} mt-4`}>初始密码（至少 8 个字符；仅本次提交使用）
              <input className={fieldClass} type="password" autoComplete="new-password" maxLength={72} value={initialPassword} onChange={event => setInitialPassword(event.target.value)} />
            </label>
            <p className="mt-2 text-xs text-neutral-500">密码不会发给 AI，不会写入聊天、草稿或审计记录，提交后立即清除。</p>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" disabled={busy} onClick={() => { setShowMerchantConfirm(false); setInitialPassword(''); }} className="rounded-lg border border-neutral-300 px-4 py-2.5 text-sm font-semibold text-neutral-700">取消</button>
              <button type="button" disabled={busy || initialPassword.length < 8} onClick={() => void createMerchant()} className="rounded-lg bg-neutral-950 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{busy ? '创建中…' : '确认创建账号'}</button>
            </div>
          </section>
        </div>
      )}
    </section>
  );
};
