/**
 * 行业商品表单：渲染器只认 schema，字段与必填规则全部来自行业能力清单。
 */
import React, { useMemo, useRef, useState } from 'react';
import { ImagePlus, Loader2, Plus, Trash2 } from 'lucide-react';
import type { MerchantIndustryCapability, MerchantProductField } from '../../../constants/merchantIndustryCapabilities';
import type { ProductMedia } from '../../../types/b2b';
import { buildIndustryProductPayload, createIndustryProduct, describeApiError, uploadIndustryMedia, type IndustryVariantInput } from './data';
import { Button, ErrorBanner, FormField, inputClass } from './kit';

type DraftState = {
  values: Record<string, string>;
  wholesalePrice: string;
  retailPrice: string;
  costPrice: string;
  tierPrice: string;
  bulkPriceMinimumQuantity: string;
  moq: string;
  packSize: string;
  status: 'new' | 'clearance' | 'hot' | 'restocked';
  openingStock: string;
  barcode: string;
  variants: IndustryVariantInput[];
};

const emptyVariant = (): IndustryVariantInput => ({ sku: '', color: '', size: '', barcode: '', initialStock: 0 });

export const IndustryProductForm: React.FC<{
  capability: MerchantIndustryCapability;
  onCancel: () => void;
  onCreated: (message: string) => void;
}> = ({ capability, onCancel, onCreated }) => {
  const [draft, setDraft] = useState<DraftState>({
    values: {},
    wholesalePrice: '',
    retailPrice: '',
    costPrice: '',
    tierPrice: '',
    bulkPriceMinimumQuantity: '100',
    moq: '1',
    packSize: '1',
    status: 'new',
    openingStock: '0',
    barcode: '',
    variants: [emptyVariant()]
  });
  const [media, setMedia] = useState<ProductMedia[]>([]);
  const [mediaBusy, setMediaBusy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const fileRef = useRef<HTMLInputElement>(null);

  const fields = capability.productFields;
  const textualFields = useMemo(() => fields.filter(field => field.type !== 'variants' && field.type !== 'media'), [fields]);
  const variantsField = fields.find(field => field.type === 'variants');
  const usesRetailPrice = capability.pricing.primary === 'retail';
  const setValue = (key: string, value: string) => setDraft(previous => ({ ...previous, values: { ...previous.values, [key]: value } }));

  const setVariant = (index: number, patch: Partial<IndustryVariantInput>) => {
    setDraft(previous => ({
      ...previous,
      variants: previous.variants.map((variant, variantIndex) => variantIndex === index ? { ...variant, ...patch } : variant)
    }));
  };

  const handleUpload = async (file: File | undefined) => {
    if (!file) return;
    setMediaBusy(true);
    setError('');
    try {
      const uploaded = await uploadIndustryMedia(file);
      setMedia(previous => [...previous, { ...uploaded, role: previous.length ? 'detail' : 'main' }]);
    } catch (caught) {
      setError(describeApiError(caught, '图片上传失败'));
    } finally {
      setMediaBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const validate = (): boolean => {
    const errors: Record<string, string> = {};
    for (const field of textualFields) {
      if (field.required && !String(draft.values[field.key] || '').trim()) errors[field.key] = `${field.label}必填`;
    }
    if (usesRetailPrice) {
      if (!(Number(draft.retailPrice) > 0)) errors.retailPrice = '零售价必须大于 0';
    } else if (!(Number(draft.wholesalePrice) > 0)) {
      errors.wholesalePrice = '批发价必须大于 0';
    }
    const variants = variantsField ? draft.variants : [];
    if (variantsField?.required) {
      if (!variants.length) errors.variants = '至少添加一个 SKU';
      else if (variants.some(variant => !variant.sku.trim())) errors.variants = '每个 SKU 必须填写编码';
      else if (capability.variant.requiresColor && variants.some(variant => !variant.color.trim())) errors.variants = `每个 SKU 必须填写${capability.variant.colorLabel}`;
      else if (capability.variant.requiresSize && variants.some(variant => !variant.size.trim())) errors.variants = `每个 SKU 必须填写${capability.variant.sizeLabel}`;
      const skus = variants.map(variant => variant.sku.trim().toLowerCase());
      if (new Set(skus).size !== skus.length) errors.variants = 'SKU 编码不能重复';
    }
    if (capability.variant.barcode && draft.barcode.trim() && !/^[0-9A-Za-z-]{4,100}$/.test(draft.barcode.trim())) {
      errors.barcode = '条码格式不合法';
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const submit = async (lifecycleStatus: 'draft' | 'published') => {
    setError('');
    if (!validate()) return;
    if (lifecycleStatus === 'published' && !media.length) {
      setError('上架商品必须上传至少一张主图');
      return;
    }
    setBusy(true);
    try {
      const input = {
        styleNo: draft.values.styleNo || '',
        name: draft.values.name || '',
        category: draft.values.category || '',
        subCategory: draft.values.subCategory || '',
        brand: draft.values.brand || '',
        season: draft.values.season || '',
        description: draft.values.description || '',
        fabric: draft.values.fabric || '',
        composition: draft.values.composition || '',
        weight: draft.values.weight || '',
        packaging: draft.values.packaging || '',
        origin: draft.values.origin || '',
        wholesalePrice: Number(draft.wholesalePrice) || 0,
        retailPrice: Number(draft.retailPrice) || 0,
        costPrice: Number(draft.costPrice) || 0,
        tierPrice: draft.tierPrice ? Number(draft.tierPrice) : null,
        bulkPriceMinimumQuantity: Number(draft.bulkPriceMinimumQuantity) || 100,
        moq: Number(draft.moq) || 1,
        packSize: Number(draft.packSize) || 1,
        status: draft.status,
        attributes: Object.fromEntries(
          fields
            .filter(field => !field.column && field.type !== 'media' && field.type !== 'variants')
            .map(field => [field.key, draft.values[field.key] || ''])
        ),
        variants: variantsField ? draft.variants.filter(variant => variant.sku.trim()) : [],
        openingStock: Number(draft.openingStock) || 0,
        barcode: draft.barcode
      };
      await createIndustryProduct(buildIndustryProductPayload(capability, input, media, lifecycleStatus));
      onCreated(lifecycleStatus === 'published' ? '商品已创建并上架' : '商品已保存为草稿');
    } catch (caught) {
      setError(describeApiError(caught, '商品创建失败'));
    } finally {
      setBusy(false);
    }
  };

  const renderField = (field: MerchantProductField) => {
    const value = draft.values[field.key] || '';
    const common = { id: `product-field-${field.key}`, 'aria-label': field.label };
    return (
      <FormField key={field.key} label={field.label} required={field.required} error={fieldErrors[field.key]} help={field.help}>
        {field.type === 'select' ? (
          <select className={inputClass} value={value} onChange={event => setValue(field.key, event.target.value)} {...common}>
            <option value="">请选择</option>
            {(field.options || []).map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        ) : field.type === 'textarea' ? (
          <textarea
            className={`${inputClass} h-24 py-2`}
            maxLength={field.maxLength}
            value={value}
            onChange={event => setValue(field.key, event.target.value)}
            {...common}
          />
        ) : (
          <input
            className={inputClass}
            maxLength={field.maxLength}
            value={value}
            placeholder={field.placeholder}
            onChange={event => setValue(field.key, event.target.value)}
            {...common}
          />
        )}
      </FormField>
    );
  };


  return (
    <div className="space-y-4">
      {error ? <ErrorBanner message={error} onDismiss={() => setError('')} /> : null}
      <div className="grid gap-3 sm:grid-cols-2">{textualFields.map(renderField)}</div>

      <div className="rounded-md border border-neutral-200 p-3">
        <h3 className="text-xs font-bold text-neutral-900">价格与起订</h3>
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          {usesRetailPrice ? (
            <FormField label="零售价" required error={fieldErrors.retailPrice}>
              <input className={inputClass} inputMode="decimal" value={draft.retailPrice} onChange={event => setDraft(previous => ({ ...previous, retailPrice: event.target.value }))} />
            </FormField>
          ) : (
            <FormField label="批发价" required error={fieldErrors.wholesalePrice}>
              <input className={inputClass} inputMode="decimal" value={draft.wholesalePrice} onChange={event => setDraft(previous => ({ ...previous, wholesalePrice: event.target.value }))} />
            </FormField>
          )}
          {capability.pricing.cost ? (
            <FormField label="采购成本">
              <input className={inputClass} inputMode="decimal" value={draft.costPrice} onChange={event => setDraft(previous => ({ ...previous, costPrice: event.target.value }))} />
            </FormField>
          ) : null}
          {capability.pricing.tiered && !usesRetailPrice ? (
            <>
              <FormField label="阶梯批发价" help="达到数量门槛后的单价，可不填">
                <input className={inputClass} inputMode="decimal" value={draft.tierPrice} onChange={event => setDraft(previous => ({ ...previous, tierPrice: event.target.value }))} />
              </FormField>
              <FormField label="阶梯数量门槛">
                <input className={inputClass} inputMode="numeric" value={draft.bulkPriceMinimumQuantity} onChange={event => setDraft(previous => ({ ...previous, bulkPriceMinimumQuantity: event.target.value }))} />
              </FormField>
            </>
          ) : null}
          {capability.pricing.moq ? (
            <FormField label="最小起订量 MOQ">
              <input className={inputClass} inputMode="numeric" value={draft.moq} onChange={event => setDraft(previous => ({ ...previous, moq: event.target.value }))} />
            </FormField>
          ) : null}
          <FormField label="商品状态">
            <select className={inputClass} value={draft.status} onChange={event => setDraft(previous => ({ ...previous, status: event.target.value as DraftState['status'] }))}>
              <option value="new">正常</option>
              <option value="hot">热销</option>
              <option value="clearance">折扣清仓</option>
              <option value="restocked">补货中</option>
            </select>
          </FormField>
        </div>
      </div>


      {variantsField ? (
        <div className="rounded-md border border-neutral-200 p-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-neutral-900">{variantsField.label}</h3>
            <Button size="sm" variant="ghost" onClick={() => setDraft(previous => ({ ...previous, variants: [...previous.variants, emptyVariant()] }))}>
              <Plus className="h-3.5 w-3.5" />添加 SKU
            </Button>
          </div>
          {fieldErrors.variants ? <p className="mt-1 text-xs text-red-600">{fieldErrors.variants}</p> : null}
          <div className="mt-2 space-y-2">
            {draft.variants.map((variant, index) => (
              <div key={index} className="grid grid-cols-2 gap-2 rounded-md bg-neutral-50 p-2 sm:grid-cols-5">
                <input className={inputClass} placeholder="SKU 编码" value={variant.sku} onChange={event => setVariant(index, { sku: event.target.value })} aria-label="SKU 编码" />
                {capability.variant.requiresColor ? (
                  <input className={inputClass} placeholder={capability.variant.colorLabel || '颜色'} value={variant.color} onChange={event => setVariant(index, { color: event.target.value })} aria-label={capability.variant.colorLabel || '颜色'} />
                ) : null}
                {capability.variant.requiresSize ? (
                  <input className={inputClass} placeholder={capability.variant.sizeLabel || '尺码'} value={variant.size} onChange={event => setVariant(index, { size: event.target.value })} aria-label={capability.variant.sizeLabel || '尺码'} />
                ) : null}
                {capability.variant.barcode ? (
                  <input className={inputClass} placeholder="条码" value={variant.barcode} onChange={event => setVariant(index, { barcode: event.target.value })} aria-label="条码" />
                ) : null}
                <input
                  className={inputClass}
                  inputMode="numeric"
                  placeholder="初始库存"
                  value={String(variant.initialStock)}
                  onChange={event => setVariant(index, { initialStock: Math.max(0, Math.trunc(Number(event.target.value) || 0)) })}
                  aria-label="初始库存"
                />
                {draft.variants.length > 1 ? (
                  <Button size="sm" variant="ghost" onClick={() => setDraft(previous => ({ ...previous, variants: previous.variants.filter((_, variantIndex) => variantIndex !== index) }))} aria-label="删除 SKU">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                ) : null}
              </div>
            ))}
          </div>
          {!variantsField.required ? <p className="mt-2 text-xs text-neutral-500">未填写 SKU 时，系统使用商品编码作为默认 SKU。</p> : null}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <FormField label="初始库存">
            <input className={inputClass} inputMode="numeric" value={draft.openingStock} onChange={event => setDraft(previous => ({ ...previous, openingStock: event.target.value }))} />
          </FormField>
          {capability.variant.barcode ? (
            <FormField label="条码" error={fieldErrors.barcode}>
              <input className={inputClass} value={draft.barcode} onChange={event => setDraft(previous => ({ ...previous, barcode: event.target.value }))} />
            </FormField>
          ) : null}
        </div>
      )}


      <div>
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-neutral-900">商品图片</h3>
          <Button size="sm" variant="secondary" busy={mediaBusy} onClick={() => fileRef.current?.click()}>
            <ImagePlus className="h-3.5 w-3.5" />上传图片
          </Button>
        </div>
        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={event => void handleUpload(event.target.files?.[0])} />
        <div className="mt-2 flex flex-wrap gap-2">
          {media.map((item, index) => (
            <div key={item.id || `${item.url}-${index}`} className="relative h-20 w-20 overflow-hidden rounded-md border border-neutral-200">
              <img src={item.url} alt={index === 0 ? '商品主图' : `商品详情图 ${index}`} className="h-full w-full object-cover" />
              <button
                type="button"
                onClick={() => setMedia(previous => previous.filter((_, mediaIndex) => mediaIndex !== index))}
                className="absolute right-0.5 top-0.5 rounded bg-black/60 p-0.5 text-white"
                aria-label="删除图片"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ))}
          {!media.length ? <p className="text-xs text-neutral-500">尚未上传图片。上架前必须至少上传一张主图。</p> : null}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2 border-t border-neutral-200 pt-3">
        <Button variant="ghost" onClick={onCancel} disabled={busy}>取消</Button>
        <Button variant="secondary" busy={busy} onClick={() => void submit('draft')}>保存草稿</Button>
        <Button variant="primary" busy={busy} onClick={() => void submit('published')}>保存并上架</Button>
      </div>
    </div>
  );
};

