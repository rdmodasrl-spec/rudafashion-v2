import React, { useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, ImagePlus, Loader2 } from 'lucide-react';
import type { MerchantProductDraft, MerchantProductVariantDraft } from '../../../../shared/merchantProductCreation';
import { generateMerchantProductVariants, validateMerchantProductDraft } from '../../../../shared/merchantProductCreation';
import { getProductCategoryLabel } from '../../../../constants/productCategories';
import { getProductZone, getProductZoneUpdates } from '../../../../utils/productZone';
import { ProductCategoryPicker } from './ProductCategoryPicker';
import { SmartMediaUploader } from './SmartMediaUploader';
import { MerchantProductTryOn } from './MerchantProductTryOn';
import { ProductChoicePicker } from './ProductChoicePicker';
import { ProductEditorStepBar } from './ProductEditorStepBar';
import { ProductFormSection } from './ProductFormSection';
import { ProductZonePicker } from './ProductZonePicker';

interface MerchantProductCreateFormProps {
  value: MerchantProductDraft;
  onChange: (value: MerchantProductDraft) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>, action: 'draft' | 'publish', mode: 'quick' | 'full') => void;
  onCancel: () => void;
  busy: boolean;
  isItalian: boolean;
  canManageCosts?: boolean;
  descriptionDraft?: boolean;
  mode: 'quick' | 'full';
  onModeChange: (mode: 'quick' | 'full') => void;
}

const blankVariant = (): MerchantProductVariantDraft => ({
  sku: '',
  color: '',
  colorCode: '',
  size: '',
  barcode: '',
  initialStock: 0,
  isActive: true
});

type ProductChoice = { zh: string; it: string };

export const PRODUCT_CHOICES = {
  colors: [
    { zh: '黑色', it: 'Nero' }, { zh: '白色', it: 'Bianco' }, { zh: '米色', it: 'Beige' },
    { zh: '灰色', it: 'Grigio' }, { zh: '海军蓝', it: 'Blu navy' }, { zh: '蓝色', it: 'Blu' },
    { zh: '棕色', it: 'Marrone' }, { zh: '卡其色', it: 'Cachi' }, { zh: '红色', it: 'Rosso' },
    { zh: '粉色', it: 'Rosa' }, { zh: '绿色', it: 'Verde' }, { zh: '黄色', it: 'Giallo' },
    { zh: '紫色', it: 'Viola' }, { zh: '橙色', it: 'Arancione' }, { zh: '多色', it: 'Multicolore' },
    { zh: '其他 / 拼色', it: 'Altro / bicolore' }
  ],
  sizes: [
    { zh: '均码', it: 'Taglia unica' }, ...['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'].map(size => ({ zh: size, it: size })),
    ...['34', '36', '38', '40', '42', '44', '46', '48', '50'].map(size => ({ zh: `EU ${size}`, it: `EU ${size}` }))
  ],
  origins: [
    { zh: '意大利', it: 'Italia' }, { zh: '中国', it: 'Cina' }, { zh: '法国', it: 'Francia' },
    { zh: '西班牙', it: 'Spagna' }, { zh: '葡萄牙', it: 'Portogallo' }, { zh: '土耳其', it: 'Turchia' },
    { zh: '印度', it: 'India' }, { zh: '罗马尼亚', it: 'Romania' }, { zh: '保加利亚', it: 'Bulgaria' },
    { zh: '希腊', it: 'Grecia' }, { zh: '波兰', it: 'Polonia' }, { zh: '孟加拉国', it: 'Bangladesh' },
    { zh: '其他产地', it: 'Altro paese' }
  ],
  fabrics: [
    { zh: '棉', it: 'Cotone' }, { zh: '亚麻', it: 'Lino' }, { zh: '羊毛', it: 'Lana' },
    { zh: '羊绒', it: 'Cashmere' }, { zh: '真丝', it: 'Seta' }, { zh: '粘胶纤维', it: 'Viscosa' },
    { zh: '聚酯纤维', it: 'Poliestere' }, { zh: '锦纶', it: 'Poliammide' }, { zh: '牛仔布', it: 'Denim' },
    { zh: '皮革', it: 'Pelle' }, { zh: '针织面料', it: 'Maglia' }, { zh: '混纺面料', it: 'Tessuto misto' },
    { zh: '其他面料', it: 'Altro tessuto' }
  ],
  compositions: [
    { zh: '100% 棉', it: '100% cotone' }, { zh: '100% 亚麻', it: '100% lino' },
    { zh: '100% 羊毛', it: '100% lana' }, { zh: '100% 真丝', it: '100% seta' },
    { zh: '100% 粘胶纤维', it: '100% viscosa' }, { zh: '100% 聚酯纤维', it: '100% poliestere' },
    { zh: '95% 棉，5% 氨纶', it: '95% cotone, 5% elastan' },
    { zh: '70% 棉，30% 聚酯纤维', it: '70% cotone, 30% poliestere' },
    { zh: '80% 羊毛，20% 锦纶', it: '80% lana, 20% poliammide' },
    { zh: '55% 亚麻，45% 棉', it: '55% lino, 45% cotone' },
    { zh: '其他混纺（成分以标签为准）', it: 'Altra miscela (composizione da etichetta)' }
  ],
  processes: [
    { zh: '常规车缝', it: 'Cucitura standard' }, { zh: '双面呢手工缝制', it: 'Cucitura artigianale double-face' },
    { zh: '水洗处理', it: 'Lavaggio' }, { zh: '成衣染色', it: 'Tintura in capo' },
    { zh: '针织工艺', it: 'Lavorazione a maglia' }, { zh: '钩针编织', it: 'Lavorazione all’uncinetto' },
    { zh: '刺绣', it: 'Ricamo' }, { zh: '压褶', it: 'Plissettatura' },
    { zh: '印花', it: 'Stampa' }, { zh: '激光裁剪', it: 'Taglio laser' },
    { zh: '其他工艺', it: 'Altra lavorazione' }
  ],
  fits: [
    { zh: '修身', it: 'Slim' }, { zh: '常规', it: 'Regular' }, { zh: '宽松', it: 'Comodo' },
    { zh: '宽大廓形', it: 'Oversize' }, { zh: '直筒', it: 'Dritto' }, { zh: '阔腿', it: 'Gamba larga' },
    { zh: 'A字', it: 'Linea ad A' }, { zh: '收腰', it: 'Vita sagomata' }, { zh: '短款', it: 'Cropped' },
    { zh: '宽松箱型', it: 'Boxy' }, { zh: '其他版型', it: 'Altra vestibilità' }
  ]
} satisfies Record<string, ProductChoice[]>;

const choiceValue = (choice: ProductChoice, isItalian: boolean) => isItalian ? choice.it : choice.zh;

const ChoiceField: React.FC<{
  label: string;
  value: string;
  options: ProductChoice[];
  isItalian: boolean;
  fieldClass: string;
  labelClass: string;
  onChange: (value: string) => void;
}> = ({ label, value, options, isItalian, fieldClass, labelClass, onChange }) => {
  const field = <select aria-label={labelClass.includes('sr-only') ? label : undefined} value={value} onChange={event => onChange(event.target.value)} className={fieldClass}>
    <option value="">请选择</option>
    {options.map(option => {
      const optionValue = choiceValue(option, isItalian);
      return <option key={optionValue} value={optionValue}>{optionValue}</option>;
    })}
    {value && !options.some(option => choiceValue(option, isItalian) === value) && <option value={value}>{value}</option>}
  </select>;
  if (labelClass.includes('sr-only')) {
    return <div className="min-w-0"><span className="sr-only">{label}</span>{field}</div>;
  }
  return <label className={labelClass}>{label}{field}</label>;
};

export const MerchantProductCreateForm: React.FC<MerchantProductCreateFormProps> = ({
  value,
  onChange,
  onSubmit,
  onCancel,
  busy,
  isItalian,
  canManageCosts = false,
  descriptionDraft = false,
  mode,
  onModeChange
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
  const update = (updates: Partial<MerchantProductDraft>) => onChange({ ...value, ...updates });
  const updateVariant = (index: number, updates: Partial<MerchantProductVariantDraft>) =>
    update({ variants: value.variants.map((variant, current) => current === index ? { ...variant, ...updates } : variant) });
  const fieldClass = 'h-10 w-full rounded-lg border border-neutral-300 bg-white px-3 text-sm font-normal outline-none transition focus:border-neutral-900 focus:ring-2 focus:ring-neutral-900/10';
  const labelClass = 'block min-w-0 text-xs font-semibold text-neutral-700';
  const isFull = mode === 'full';
  const zone = getProductZone(value);
  const mainImage = value.media.find(item => item.type === 'image' && item.role === 'main')
    || value.media.find(item => item.type === 'image');
  const totalCombinations = selectedColors.length * selectedSizes.length;

  const scrollToTop = () => contentRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  const goToStep = (next: 1 | 2) => {
    setStep(next);
    setFormError('');
    scrollToTop();
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
      const validationError = validateMerchantProductDraft(value, 'publish', mode);
      if (validationError) {
        setFormError(validationError);
        scrollToTop();
        return;
      }
    }
    setFormError('');
    onSubmit(event, action, mode);
  };

  const generateMatrix = () => {
    const existingCombinations = new Set(value.variants.map(variant => `${variant.color.trim().toLocaleLowerCase()}::${variant.size.trim().toLocaleLowerCase()}`));
    const generated = generateMerchantProductVariants(value.styleNo, selectedColors, selectedSizes)
      .filter(variant => !existingCombinations.has(`${variant.color.toLocaleLowerCase()}::${variant.size.toLocaleLowerCase()}`));
    if (!generated.length) {
      setSkuMessage(totalCombinations === 0 ? '请先选择颜色和尺码' : '所选颜色和尺码组合已全部生成');
      return;
    }
    update({ variants: [...value.variants, ...generated] });
    setSkuMessage(`已生成 ${generated.length} 个 SKU 组合`);
  };

  return (
    <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col" noValidate>
      <div ref={contentRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div className="mx-auto w-full max-w-[1120px] px-4 py-5 sm:px-8">
          <div className="mb-5 flex flex-col gap-3 border-b border-neutral-200 pb-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-xl font-semibold text-neutral-950 sm:text-2xl">{step === 1 ? '上传图片 / 视频' : '商品信息'}</h1>
              <p className="mt-1 text-xs leading-5 text-neutral-500 sm:text-sm">
                {step === 1 ? '先上传商品媒体，图片顺序与主图会直接用于商品展示。' : '填写商品资料、产品分区、SKU 与批发价格后发布。'}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex h-9 rounded-lg border border-neutral-200 bg-neutral-50 p-0.5" role="tablist" aria-label="商品创建模式">
                <button type="button" role="tab" aria-selected={!isFull} onClick={() => onModeChange('quick')} className={`rounded-md px-3 text-xs font-semibold transition-colors ${!isFull ? 'bg-neutral-900 text-white' : 'text-neutral-600 hover:bg-white'}`}>快速创建</button>
                <button type="button" role="tab" aria-selected={isFull} onClick={() => onModeChange('full')} className={`rounded-md px-3 text-xs font-semibold transition-colors ${isFull ? 'bg-neutral-900 text-white' : 'text-neutral-600 hover:bg-white'}`}>完整创建</button>
              </div>
              <ProductEditorStepBar step={step} onStepClick={next => goToStep(next)} isItalian={isItalian} />
            </div>
          </div>

          {step === 1 ? (
            <div className="space-y-4">
              <div className="rounded-xl border border-neutral-200 bg-white p-4 sm:p-5">
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
            </div>
          ) : (
            <div className="space-y-4">
              {formError && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{formError}</div>}

              <ProductFormSection title="基本信息">
                <div className="grid grid-cols-1 gap-4 min-[520px]:grid-cols-2 xl:grid-cols-4">
                  <label className={labelClass}>款式编号
                    <input value={value.styleNo} onChange={event => update({ styleNo: event.target.value })} placeholder="例如 STY-2026-1024" className={`${fieldClass} font-mono`} />
                  </label>
                  <label className={labelClass}>商品名称
                    <input value={value.name} onChange={event => update({ name: event.target.value })} placeholder="例如 双面羊毛短外套" className={fieldClass} />
                  </label>
                  <div className="min-[520px]:col-span-2 xl:col-span-4">
                    <ProductCategoryPicker value={value.category} onChange={category => update({ category })} isItalian={isItalian} />
                  </div>
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
                    <ChoiceField label="工艺" value={value.manufacturingProcess} options={PRODUCT_CHOICES.processes} isItalian={isItalian} fieldClass={fieldClass} labelClass={labelClass} onChange={manufacturingProcess => update({ manufacturingProcess })} />
                    <ChoiceField label="版型" value={value.fit} options={PRODUCT_CHOICES.fits} isItalian={isItalian} fieldClass={fieldClass} labelClass={labelClass} onChange={fit => update({ fit })} />
                  </>}
                  <label className={`${labelClass} min-[520px]:col-span-2 xl:col-span-4`}>
                    商品描述
                    <textarea
                      value={value.description}
                      onChange={event => update({ description: event.target.value })}
                      rows={4}
                      maxLength={3000}
                      placeholder="面料、工艺、尺码建议等"
                      className={`${fieldClass} mt-1 h-auto min-h-24 resize-y py-2 leading-6`}
                    />
                    {descriptionDraft && <span className="mt-1 block text-xs font-normal text-neutral-500">当前描述为 AI 草稿，发布前请核对。</span>}
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
                  <button type="button" onClick={generateMatrix} disabled={!selectedColors.length || !selectedSizes.length} className="h-9 rounded-lg border border-neutral-300 px-3 text-xs font-semibold text-neutral-800 transition hover:border-neutral-900 disabled:cursor-not-allowed disabled:opacity-50">
                    生成 SKU
                  </button>
                )}
              >
                <div className="grid gap-4 lg:grid-cols-2">
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
                  <table className="w-full min-w-[880px] border-collapse text-left text-xs">
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
                          <td className="min-w-28 px-2"><ChoiceField label="颜色" value={variant.color} options={PRODUCT_CHOICES.colors} isItalian={isItalian} fieldClass={`${fieldClass} h-9 min-w-28`} labelClass="sr-only" onChange={color => updateVariant(index, { color })} /></td>
                          <td className="min-w-24 px-2"><ChoiceField label="尺码" value={variant.size} options={PRODUCT_CHOICES.sizes} isItalian={isItalian} fieldClass={`${fieldClass} h-9 min-w-24`} labelClass="sr-only" onChange={size => updateVariant(index, { size })} /></td>
                          <td className="min-w-36 px-2"><label className="sr-only" htmlFor={`product-sku-${index}`}>SKU 编码</label><input id={`product-sku-${index}`} value={variant.sku} onChange={event => updateVariant(index, { sku: event.target.value })} className={`${fieldClass} h-9 font-mono`} /></td>
                          {isFull && <>
                            <td className="min-w-28 px-2"><label className="sr-only" htmlFor={`product-color-code-${index}`}>颜色代码</label><input id={`product-color-code-${index}`} value={variant.colorCode} onChange={event => updateVariant(index, { colorCode: event.target.value })} placeholder="#000000" className={`${fieldClass} h-9 font-mono`} /></td>
                            <td className="min-w-32 px-2"><label className="sr-only" htmlFor={`product-barcode-${index}`}>条码</label><input id={`product-barcode-${index}`} value={variant.barcode} onChange={event => updateVariant(index, { barcode: event.target.value })} className={`${fieldClass} h-9`} /></td>
                          </>}
                          <td className="min-w-24 px-2"><label className="sr-only" htmlFor={`product-stock-${index}`}>初始库存</label><input id={`product-stock-${index}`} type="number" min="0" step="1" value={variant.initialStock} onChange={event => updateVariant(index, { initialStock: Number(event.target.value) })} className={`${fieldClass} h-9 text-right tabular-nums`} /></td>
                          <td className="min-w-16 px-2 text-center"><label className="inline-flex min-h-10 items-center gap-2 text-xs text-neutral-700"><input type="checkbox" checked={variant.isActive} onChange={event => updateVariant(index, { isActive: event.target.checked })} />可售</label></td>
                          <td className="min-w-16 px-2 text-right"><button type="button" onClick={() => update({ variants: value.variants.filter((_, current) => current !== index) })} className="h-9 px-2 font-medium text-neutral-600 transition hover:text-red-700">删除</button></td>
                        </tr>)}
                    </tbody>
                  </table>
                </div>
                <button type="button" onClick={() => update({ variants: [...value.variants, blankVariant()] })} className="mt-3 h-9 rounded-lg border border-dashed border-neutral-400 px-3 text-xs font-semibold text-neutral-700 transition hover:border-neutral-900">+ 手动添加 SKU</button>
              </ProductFormSection>
              <ProductFormSection title="价格与订货" hint="批发价与起订量会直接用于商家订货；成本价仅用于内部毛利核算。">
                <div className="grid grid-cols-1 gap-4 min-[520px]:grid-cols-2 xl:grid-cols-4">
                  <label className={labelClass}>普通批发价 (€ / 件)
                    <input type="number" min="0" step="0.01" inputMode="decimal" value={value.wholesalePrice || ''} onChange={event => update({ wholesalePrice: Number(event.target.value) })} className={`${fieldClass} text-right tabular-nums`} />
                  </label>
                  <label className={labelClass}>量大批发价 (€ / 件)
                    <input type="number" min="0" step="0.01" inputMode="decimal" value={value.wholesalePrice100 ?? ''} onChange={event => update({ wholesalePrice100: event.target.value === '' ? null : Number(event.target.value) })} placeholder="选填" className={`${fieldClass} text-right tabular-nums`} />
                  </label>
                  <label className={labelClass}>量大批发门槛 (件)
                    <input type="number" min="1" step="1" inputMode="numeric" value={value.bulkPriceMinimumQuantity} onChange={event => update({ bulkPriceMinimumQuantity: Number(event.target.value) })} className={`${fieldClass} text-right tabular-nums`} />
                  </label>
                  <label className={labelClass}>起订量 MOQ (件)
                    <input type="number" min="1" step="1" inputMode="numeric" value={value.moq} onChange={event => update({ moq: Number(event.target.value) })} className={`${fieldClass} text-right tabular-nums`} />
                  </label>
                  <label className={labelClass}>箱规 (件 / 箱)
                    <input type="number" min="1" step="1" inputMode="numeric" value={value.packSize} onChange={event => update({ packSize: Number(event.target.value) })} className={`${fieldClass} text-right tabular-nums`} />
                  </label>
                  {canManageCosts && (
                    <label className={labelClass}>成本价 (€ / 件)
                      <input type="number" min="0" step="0.01" inputMode="decimal" value={value.costPrice || ''} onChange={event => update({ costPrice: Number(event.target.value) })} className={`${fieldClass} text-right tabular-nums`} />
                    </label>
                  )}
                  <label className={`${labelClass} min-[520px]:col-span-2 xl:col-span-4`}>
                    <span className="inline-flex min-h-10 items-center gap-2">
                      <input type="checkbox" checked={value.requiresFullCarton} onChange={event => update({ requiresFullCarton: event.target.checked })} />
                      必须整箱起订
                    </span>
                  </label>
                </div>
              </ProductFormSection>

              <ProductFormSection
                title="媒体"
                hint={mainImage ? '主图将作为商品列表与详情页的首图。' : '尚未设置主图，可返回第一步上传。'}
                action={(
                  <button type="button" onClick={() => goToStep(1)} className="h-9 rounded-lg border border-neutral-300 px-3 text-xs font-semibold text-neutral-800 transition hover:border-neutral-900">管理媒体</button>
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
      </div>

      <footer className="shrink-0 border-t border-neutral-200 bg-white px-4 py-3 sm:px-8">
        {step === 1 ? (
          <div className="mx-auto flex max-w-[1120px] items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button type="button" onClick={onCancel} disabled={busy} className="inline-flex h-10 items-center rounded-lg px-3 text-sm font-semibold text-neutral-600 transition hover:bg-neutral-100 hover:text-neutral-900 disabled:opacity-50">取消</button>
              <p className="hidden text-xs text-neutral-500 sm:block">已上传 <span className="font-semibold tabular-nums text-neutral-900">{value.media.length}</span> 个文件</p>
            </div>
            <button type="button" onClick={() => goToStep(2)} className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-neutral-950 px-5 text-sm font-semibold text-white transition hover:bg-neutral-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900">
              下一步：商品信息
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        ) : (
          <div className="mx-auto flex max-w-[1120px] items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => goToStep(1)} className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-neutral-300 bg-white px-3 text-sm font-semibold text-neutral-800 transition hover:border-neutral-900">
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                上一步
              </button>
              <button type="button" onClick={onCancel} disabled={busy} className="hidden h-10 rounded-lg px-3 text-sm font-semibold text-neutral-600 transition hover:bg-neutral-100 hover:text-neutral-900 disabled:opacity-50 sm:inline-flex sm:items-center">取消</button>
            </div>
            <div className="flex items-center gap-2">
              <button type="submit" value="draft" disabled={busy} className="h-10 rounded-lg border border-neutral-300 bg-white px-4 text-sm font-semibold text-neutral-800 transition hover:border-neutral-900 disabled:opacity-50">保存草稿</button>
              <button type="submit" value="publish" disabled={busy || mediaBusy} className="inline-flex h-10 items-center gap-2 rounded-lg bg-neutral-950 px-5 text-sm font-semibold text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50">
                {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                {busy ? '发布中...' : '发布商品'}
              </button>
            </div>
          </div>
        )}
      </footer>
    </form>
  );
};

