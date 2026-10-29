import React, { useRef, useState } from 'react';
import { ArrowLeft, ImagePlus, Loader2, X } from 'lucide-react';
import {
  generateMerchantProductVariants,
  validateMerchantProductDraft,
  type MerchantProductDraft,
  type MerchantProductVariantDraft
} from '../../shared/merchantProductCreation';
import { getProductZone, getProductZoneUpdates } from '../../utils/productZone';
import { MerchantProductTryOn } from '../merchant-admin-common/components/merchant/MerchantProductTryOn';
import { ProductCategoryPicker } from '../merchant-admin-common/components/merchant/ProductCategoryPicker';
import { ProductChoicePicker } from '../merchant-admin-common/components/merchant/ProductChoicePicker';
import { ProductEditorStepBar } from '../merchant-admin-common/components/merchant/ProductEditorStepBar';
import { ProductFormSection } from '../merchant-admin-common/components/merchant/ProductFormSection';
import { ProductZonePicker } from '../merchant-admin-common/components/merchant/ProductZonePicker';
import { SmartMediaUploader } from '../merchant-admin-common/components/merchant/SmartMediaUploader';
import { PRODUCT_CHOICES } from '../merchant-admin-common/components/merchant/MerchantProductCreateForm';

interface MerchantMobileProductCreateFormProps {
  value: MerchantProductDraft;
  mode: 'quick' | 'full';
  onChange: (value: MerchantProductDraft) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>, action: 'draft' | 'publish', mode: 'quick' | 'full') => void;
  onCancel: () => void;
  busy: boolean;
  isItalian: boolean;
  canManageCosts: boolean;
}

const fieldClass = 'h-10 w-full rounded-[6px] border border-neutral-200 bg-white px-3 text-sm text-neutral-900 outline-none focus:border-neutral-700';
const labelClass = 'block space-y-1 text-xs font-medium text-neutral-700';

const blankVariant = (): MerchantProductVariantDraft => ({
  sku: '',
  color: '',
  colorCode: '',
  size: '',
  barcode: '',
  initialStock: 0,
  isActive: true
});

/** 商家手机端发布商品：第一步媒体，第二步商品信息，字段与 Web 端发布保持一致。 */
export const MerchantMobileProductCreateForm: React.FC<MerchantMobileProductCreateFormProps> = ({
  value,
  mode,
  onChange,
  onSubmit,
  onCancel,
  busy,
  isItalian,
  canManageCosts
}) => {
  const [step, setStep] = useState<1 | 2>(1);
  const [zoneChosen, setZoneChosen] = useState(false);
  const [zoneError, setZoneError] = useState('');
  const [formError, setFormError] = useState('');
  const [mediaBusy, setMediaBusy] = useState(false);
  const [skuMessage, setSkuMessage] = useState('');
  const [selectedColors, setSelectedColors] = useState<string[]>(() => [...new Set(value.variants.map(variant => variant.color).filter(Boolean))]);
  const [selectedSizes, setSelectedSizes] = useState<string[]>(() => [...new Set(value.variants.map(variant => variant.size).filter(Boolean))]);
  const contentRef = useRef<HTMLDivElement>(null);
  const actionBusy = busy || mediaBusy;
  const isFull = mode === 'full';
  const zone = getProductZone(value);
  const mainImage = value.media.find(item => item.type === 'image' && item.role === 'main')
    || value.media.find(item => item.type === 'image');
  const totalCombinations = selectedColors.length * selectedSizes.length;
  const colorChoices = PRODUCT_CHOICES.colors.map(choice => isItalian ? choice.it : choice.zh);
  const sizeChoices = PRODUCT_CHOICES.sizes.map(choice => isItalian ? choice.it : choice.zh);

  const update = (changes: Partial<MerchantProductDraft>) => {
    setFormError('');
    onChange({ ...value, ...changes });
  };
  const updateVariant = (index: number, changes: Partial<MerchantProductVariantDraft>) => {
    update({ variants: value.variants.map((variant, current) => current === index ? { ...variant, ...changes } : variant) });
  };
  const scrollToTop = () => contentRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  const goToStep = (next: 1 | 2) => {
    setStep(next);
    setFormError('');
    scrollToTop();
  };
  const goNext = () => {
    if (mediaBusy) {
      setFormError('媒体正在上传，请等待上传完成。');
      return;
    }
    goToStep(2);
  };
  const selectZone = (nextZone: ReturnType<typeof getProductZone>) => {
    const updates = getProductZoneUpdates(nextZone);
    update({
      status: updates.status === 'clearance' ? 'clearance' : 'new',
      visibility: updates.visibility === 'private' ? 'private' : 'public'
    });
    setZoneChosen(true);
    setZoneError('');
  };
  const generateMatrix = () => {
    const existing = new Set(value.variants.map(variant => `${variant.color.trim().toLocaleLowerCase()}::${variant.size.trim().toLocaleLowerCase()}`));
    const generated = generateMerchantProductVariants(value.styleNo, selectedColors, selectedSizes)
      .filter(variant => !existing.has(`${variant.color.toLocaleLowerCase()}::${variant.size.toLocaleLowerCase()}`));
    if (!generated.length) {
      setSkuMessage(totalCombinations === 0 ? '请先选择颜色和尺码' : '所选颜色和尺码组合已全部生成');
      return;
    }
    update({ variants: [...value.variants, ...generated] });
    setSkuMessage(`已生成 ${generated.length} 个 SKU 组合`);
  };
  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const action = submitter?.value === 'publish' ? 'publish' : 'draft';
    if (action === 'publish') {
      if (mediaBusy) {
        setFormError('媒体正在上传，请等待上传完成后再发布商品');
        scrollToTop();
        return;
      }
      if (!zoneChosen) {
        setZoneError('请选择产品分区后再发布');
        setFormError('请选择产品分区后再发布');
        document.getElementById('product-zone-card')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }
      const validationError = validateMerchantProductDraft(value, 'publish', mode, {
        allowOptionalFullDetails: true,
        requireImageOnPublish: true,
        validateVariantPrices: true
      });
      if (validationError) {
        setFormError(validationError);
        if (/图片/.test(validationError)) setStep(1);
        scrollToTop();
        return;
      }
    }
    setFormError('');
    onSubmit(event, action, mode);
  };

  return (
    <form onSubmit={submit} className="ruda-product-form fixed inset-0 z-[60] flex flex-col bg-neutral-50 pt-[env(safe-area-inset-top)]" noValidate>
      <header className="shrink-0 border-b border-neutral-200 bg-white px-4 pb-3 pt-2">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-base font-semibold text-neutral-950">发布商品</h1>
          <button type="button" onClick={onCancel} disabled={actionBusy} aria-label="关闭商品创建" className="grid h-9 w-9 place-items-center rounded-[6px] text-neutral-500 disabled:opacity-50">
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        <div className="mt-1">
          <ProductEditorStepBar step={step} onStepClick={next => goToStep(next)} isItalian={isItalian} />
        </div>
      </header>

      <div ref={contentRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4">
        {step === 1 ? (
          <div className="space-y-4">
            <p className="text-xs leading-5 text-neutral-500">先上传商品媒体，图片顺序与主图会直接用于商品展示。</p>
            <div className="rounded-xl border border-neutral-200 bg-white p-4">
              <SmartMediaUploader
                value={value.media}
                variant="editor"
                maxItems={32}
                allowVideo
                isIt={isItalian}
                onBusyChange={setMediaBusy}
                onChange={media => update({ media })}
              />
            </div>
            <MerchantProductTryOn media={value.media} maxItems={32} onAddMedia={media => update({ media: [...value.media, media] })} />
            {formError && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{formError}</div>}
          </div>
        ) : (
          <div className="space-y-4">
            {formError && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{formError}</div>}


            <ProductFormSection title="基本信息">
              <div className="space-y-4">
                <label className={labelClass}>商品名称
                  <input value={value.name} onChange={event => update({ name: event.target.value })} placeholder="例如 双面羊毛短外套" className={fieldClass} />
                </label>
                <label className={labelClass}>款式编号
                  <input value={value.styleNo} onChange={event => update({ styleNo: event.target.value })} placeholder="例如 STY-2026-1024" className={`${fieldClass} font-mono`} />
                </label>
                <ProductCategoryPicker value={value.category} onChange={category => update({ category })} isItalian={isItalian} />
                <label className={labelClass}>二级分类
                  <input value={value.subCategory} onChange={event => update({ subCategory: event.target.value })} placeholder="选填" className={fieldClass} />
                </label>
                {isFull && <>
                  <label className={labelClass}>品牌
                    <input value={value.brand} onChange={event => update({ brand: event.target.value })} className={fieldClass} />
                  </label>
                  <label className={labelClass}>季节
                    <input value={value.season} onChange={event => update({ season: event.target.value })} className={fieldClass} />
                  </label>
                  <label className={labelClass}>产地
                    <input value={value.origin} onChange={event => update({ origin: event.target.value })} className={fieldClass} />
                  </label>
                  <label className={labelClass}>面料
                    <input value={value.fabric} onChange={event => update({ fabric: event.target.value })} className={fieldClass} />
                  </label>
                  <label className={labelClass}>材质成分
                    <input value={value.composition} onChange={event => update({ composition: event.target.value })} placeholder="例如 90% 羊毛 10% 羊绒" className={fieldClass} />
                  </label>
                </>}
                <label className={labelClass}>商品描述
                  <textarea
                    value={value.description}
                    onChange={event => update({ description: event.target.value })}
                    rows={4}
                    maxLength={3000}
                    placeholder={isFull ? '面料、工艺、尺码建议等' : '选填'}
                    className={`${fieldClass} h-auto min-h-24 resize-y py-2 leading-6`}
                  />
                </label>
              </div>
            </ProductFormSection>

            <ProductFormSection id="product-zone-card" title="产品分区" hint="分区决定商品进入授权区、现货区或折扣市场，发布前必须选择。">
              <ProductZonePicker value={zone} hasSelection={zoneChosen} onChange={selectZone} isItalian={isItalian} error={zoneError} />
            </ProductFormSection>


            <ProductFormSection
              title="颜色、尺码与 SKU"
              hint="勾选颜色与尺码后生成 SKU 组合，再补充编码、库存与可售状态。"
              action={(
                <button type="button" onClick={generateMatrix} disabled={!selectedColors.length || !selectedSizes.length} className="h-10 rounded-lg border border-neutral-300 px-3 text-xs font-semibold text-neutral-800 disabled:opacity-50">
                  生成 SKU
                </button>
              )}
            >
              <div className="space-y-4">
                <ProductChoicePicker label="颜色" values={selectedColors} options={PRODUCT_CHOICES.colors} onChange={setSelectedColors} isItalian={isItalian} kind="color" commonCount={8} placeholder="选择或搜索颜色" />
                <ProductChoicePicker label="尺码" values={selectedSizes} options={PRODUCT_CHOICES.sizes} onChange={setSelectedSizes} isItalian={isItalian} commonCount={6} placeholder="选择或搜索尺码" />
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <p className={`text-xs ${skuMessage ? 'font-medium text-neutral-800' : 'text-neutral-500'}`} aria-live="polite">
                  {skuMessage || (totalCombinations ? `已选 ${selectedColors.length} 个颜色 × ${selectedSizes.length} 个尺码，共 ${totalCombinations} 个组合` : '尚未选择颜色和尺码')}
                </p>
                <p className="text-xs tabular-nums text-neutral-500">当前 {value.variants.length} 个 SKU</p>
              </div>
              <div className="mt-3 overflow-x-auto rounded-lg border border-neutral-200">
                <table className="w-full min-w-[720px] border-collapse text-left text-xs">
                  <thead className="bg-neutral-50 text-neutral-600">
                    <tr className="h-9 border-b border-neutral-200">
                      <th className="px-2 font-medium">颜色</th>
                      <th className="px-2 font-medium">尺码</th>
                      <th className="px-2 font-medium">SKU 编码</th>
                      {isFull && <><th className="px-2 font-medium">颜色代码</th><th className="px-2 font-medium">条码</th></>}
                      <th className="px-2 text-right font-medium">初始库存</th>
                      <th className="px-2 text-center font-medium">可售</th>
                      <th className="px-2 text-right font-medium">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {value.variants.length === 0
                      ? <tr><td colSpan={isFull ? 8 : 6} className="h-16 px-3 text-center text-neutral-500">选择颜色和尺码后生成 SKU</td></tr>
                      : value.variants.map((variant, index) => <tr key={`${variant.sku}-${index}`} className="h-12 border-b border-neutral-100 last:border-0">
                        <td className="min-w-24 px-2">
                          <label className="sr-only" htmlFor={`mobile-variant-color-${index}`}>颜色</label>
                          <select id={`mobile-variant-color-${index}`} value={variant.color} onChange={event => updateVariant(index, { color: event.target.value })} className={`${fieldClass} h-10 min-w-24`}>
                            <option value="">选择</option>
                            {[...new Set([variant.color, ...colorChoices].filter(Boolean))].map(color => <option key={color} value={color}>{color}</option>)}
                          </select>
                        </td>
                        <td className="min-w-20 px-2">
                          <label className="sr-only" htmlFor={`mobile-variant-size-${index}`}>尺码</label>
                          <select id={`mobile-variant-size-${index}`} value={variant.size} onChange={event => updateVariant(index, { size: event.target.value })} className={`${fieldClass} h-10 min-w-20`}>
                            <option value="">选择</option>
                            {[...new Set([variant.size, ...sizeChoices].filter(Boolean))].map(size => <option key={size} value={size}>{size}</option>)}
                          </select>
                        </td>
                        <td className="min-w-32 px-2">
                          <label className="sr-only" htmlFor={`mobile-variant-sku-${index}`}>SKU 编码</label>
                          <input id={`mobile-variant-sku-${index}`} value={variant.sku} onChange={event => updateVariant(index, { sku: event.target.value })} className={`${fieldClass} h-10 font-mono`} />
                        </td>

                        {isFull && <>
                          <td className="min-w-24 px-2">
                            <label className="sr-only" htmlFor={`mobile-variant-color-code-${index}`}>颜色代码</label>
                            <input id={`mobile-variant-color-code-${index}`} value={variant.colorCode} onChange={event => updateVariant(index, { colorCode: event.target.value })} placeholder="#000000" className={`${fieldClass} h-10 font-mono`} />
                          </td>
                          <td className="min-w-28 px-2">
                            <label className="sr-only" htmlFor={`mobile-variant-barcode-${index}`}>条码</label>
                            <input id={`mobile-variant-barcode-${index}`} value={variant.barcode} onChange={event => updateVariant(index, { barcode: event.target.value })} className={`${fieldClass} h-10`} />
                          </td>
                        </>}
                        <td className="min-w-20 px-2">
                          <label className="sr-only" htmlFor={`mobile-variant-stock-${index}`}>初始库存</label>
                          <input id={`mobile-variant-stock-${index}`} type="number" min="0" step="1" inputMode="numeric" value={variant.initialStock} onChange={event => updateVariant(index, { initialStock: Number(event.target.value) })} className={`${fieldClass} h-10 text-right tabular-nums`} />
                        </td>
                        <td className="min-w-16 px-2 text-center">
                          <label className="inline-flex min-h-10 items-center gap-2 text-xs text-neutral-700">
                            <input type="checkbox" checked={variant.isActive} onChange={event => updateVariant(index, { isActive: event.target.checked })} />可售
                          </label>
                        </td>
                        <td className="min-w-16 px-2 text-right">
                          <button type="button" onClick={() => update({ variants: value.variants.filter((_, current) => current !== index) })} className="h-10 px-2 font-medium text-neutral-600 hover:text-red-700">删除</button>
                        </td>
                      </tr>)}
                  </tbody>
                </table>
              </div>
              <button type="button" onClick={() => update({ variants: [...value.variants, blankVariant()] })} className="mt-3 h-10 rounded-lg border border-dashed border-neutral-400 px-3 text-xs font-semibold text-neutral-700">+ 手动添加 SKU</button>
            </ProductFormSection>


            <ProductFormSection title="价格与订货" hint="批发价与起订量会直接用于商家订货；成本价仅用于内部毛利核算。">
              <div className="space-y-4">
                <label className={labelClass}>普通批发价 (€ / 件)
                  <input type="number" min="0" step="0.01" inputMode="decimal" value={value.wholesalePrice || ''} onChange={event => update({ wholesalePrice: Number(event.target.value) })} className={`${fieldClass} text-right tabular-nums`} />
                </label>
                <label className={labelClass}>量大批发价 (€ / 件)
                  <input type="number" min="0" step="0.01" inputMode="decimal" value={value.wholesalePrice100 ?? ''} onChange={event => update({ wholesalePrice100: event.target.value === '' ? null : Number(event.target.value) })} placeholder="选填" className={`${fieldClass} text-right tabular-nums`} />
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label className={labelClass}>量大批发门槛 (件)
                    <input type="number" min="1" step="1" inputMode="numeric" value={value.bulkPriceMinimumQuantity} onChange={event => update({ bulkPriceMinimumQuantity: Number(event.target.value) })} className={`${fieldClass} text-right tabular-nums`} />
                  </label>
                  <label className={labelClass}>起订量 MOQ (件)
                    <input type="number" min="1" step="1" inputMode="numeric" value={value.moq} onChange={event => update({ moq: Number(event.target.value) })} className={`${fieldClass} text-right tabular-nums`} />
                  </label>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <label className={labelClass}>箱规 (件 / 箱)
                    <input type="number" min="1" step="1" inputMode="numeric" value={value.packSize} onChange={event => update({ packSize: Number(event.target.value) })} className={`${fieldClass} text-right tabular-nums`} />
                  </label>
                  {canManageCosts && (
                    <label className={labelClass}>成本价 (€ / 件)
                      <input type="number" min="0" step="0.01" inputMode="decimal" value={value.costPrice || ''} onChange={event => update({ costPrice: Number(event.target.value) })} className={`${fieldClass} text-right tabular-nums`} />
                    </label>
                  )}
                </div>
                <label className="inline-flex min-h-11 items-center gap-2 text-xs font-medium text-neutral-700">
                  <input type="checkbox" checked={value.requiresFullCarton} onChange={event => update({ requiresFullCarton: event.target.checked })} />
                  必须整箱起订
                </label>
              </div>
            </ProductFormSection>

            <ProductFormSection
              title="媒体"
              hint={mainImage ? '主图将作为商品列表与详情页的首图。' : '尚未设置主图，可返回第一步上传。'}
              action={(
                <button type="button" onClick={() => goToStep(1)} className="h-10 rounded-lg border border-neutral-300 px-3 text-xs font-semibold text-neutral-800">管理媒体</button>
              )}
            >
              <div className="flex items-center gap-3">
                <div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-lg border border-neutral-200 bg-neutral-50">
                  {mainImage
                    ? <img src={mainImage.url} alt={mainImage.alt || '商品主图'} className="h-full w-full object-cover" />
                    : <ImagePlus className="h-5 w-5 text-neutral-400" aria-hidden="true" />}
                </div>
                <div className="min-w-0 text-xs leading-5 text-neutral-600">
                  <p className="font-semibold text-neutral-900">{value.media.length} 个媒体文件</p>
                  <p className="tabular-nums">{value.media.filter(item => item.type === 'image').length} 张图片 · {value.media.filter(item => item.type === 'video').length} 个视频</p>
                </div>
              </div>
            </ProductFormSection>
          </div>
        )}
      </div>


      <footer className="ruda-action-bar shrink-0 border-t border-neutral-200 bg-white px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3">
        {step === 1 ? (
          <div className="flex items-center gap-2">
            <button type="button" onClick={onCancel} disabled={actionBusy} className="h-10 min-w-0 flex-1 rounded-[6px] border border-neutral-300 text-sm font-semibold text-neutral-800 disabled:opacity-50">取消</button>
            <button type="button" onClick={goNext} disabled={actionBusy} className="inline-flex h-10 min-w-0 flex-[2] items-center justify-center gap-1.5 rounded-[6px] bg-neutral-950 text-sm font-semibold text-white disabled:opacity-50">
              下一步
              <ArrowLeft className="h-4 w-4 rotate-180" aria-hidden="true" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => goToStep(1)} className="inline-flex h-10 min-w-0 flex-1 items-center justify-center gap-1 rounded-[6px] border border-neutral-300 text-sm font-semibold text-neutral-800">
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              上一步
            </button>
            <button type="submit" value="draft" disabled={actionBusy} className="h-10 min-w-0 flex-1 rounded-[6px] border border-neutral-300 text-sm font-semibold text-neutral-800 disabled:opacity-50">保存草稿</button>
            <button type="submit" value="publish" disabled={actionBusy} className="inline-flex h-10 min-w-0 flex-[2] items-center justify-center gap-1.5 rounded-[6px] bg-neutral-950 text-sm font-semibold text-white disabled:opacity-50">
              {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              {busy ? '发布中…' : '发布商品'}
            </button>
          </div>
        )}
      </footer>
    </form>
  );
};

