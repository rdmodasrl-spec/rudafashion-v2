/**
 * 店铺模板隔离预览（Stage B）。
 *
 * 只在 URL 带 `?storefrontPreview=<templateId>` 时接管渲染，不替换任何商家现有网站，
 * 也不写库。用于三套模板的真实浏览器验收与截图取证。
 */
import React, { useEffect, useMemo, useState } from 'react';
import { BAGS_STOREFRONT_TEMPLATES } from '../../../../shared/storefrontTemplates/registry';
import { mapProductForStorefront, useStorefrontData, type StorefrontProduct } from './useStorefrontData';
import { BagsEditorialTemplate } from './bags/BagsEditorialTemplate';
import { BagsCatalogueTemplate } from './bags/BagsCatalogueTemplate';
import { BagsWholesaleTemplate } from './bags/BagsWholesaleTemplate';

export function readPreviewTemplateFromLocation(): string | null {
  if (typeof window === 'undefined') return null;
  return new URLSearchParams(window.location.search).get('storefrontPreview');
}

export function readPreviewMerchantFromLocation(): string | null {
  if (typeof window === 'undefined') return null;
  return new URLSearchParams(window.location.search).get('merchant');
}

const TEMPLATES = BAGS_STOREFRONT_TEMPLATES;

export const StorefrontPreview: React.FC<{ templateId: string; merchantId: string | null; demoFill?: boolean }> = ({ templateId, merchantId, demoFill = false }) => {
  const base = useStorefrontData(merchantId);
  const [current, setCurrent] = useState(templateId);
  const [demoProducts, setDemoProducts] = useState<StorefrontProduct[]>([]);

  // 版式评审用：仅当 URL 带 demo=1 时，用开发种子商品补足数量，便于检查栅格与密度。
  // 默认路径始终使用真实 API 数据；演示数据只在预览环境出现。
  useEffect(() => {
    if (!demoFill || !import.meta.env.DEV) return undefined;
    let active = true;
    import('../../../../data/mockData').then(module => {
      if (!active) return;
      const seeded = (module.INITIAL_PRODUCTS || [])
        .filter(product => Array.isArray(product.images) && product.images.length > 0)
        .map(product =>
          mapProductForStorefront(product as never, Number(product.wholesalePrice) || 0, null)
        );
      setDemoProducts(seeded);
    }).catch(() => undefined);
    return () => { active = false; };
  }, [demoFill]);

  const data = useMemo(() => {
    if (!demoFill || !demoProducts.length) return base;
    return { ...base, products: [...base.products, ...demoProducts] };
  }, [base, demoFill, demoProducts]);

  useEffect(() => {
    document.documentElement.setAttribute('data-storefront-preview', current);
  }, [current]);

  // 预览只用于内部验收，禁止被搜索引擎收录。
  useEffect(() => {
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex,nofollow';
    document.head.appendChild(meta);
    return () => { meta.remove(); };
  }, []);

  const [activeProductId, setActiveProductId] = useState<string | null>(() =>
    typeof window === 'undefined' ? null : new URLSearchParams(window.location.search).get('product')
  );

  // 商品深链与浏览器前进/后退保持一致
  useEffect(() => {
    const onPop = () => {
      const params = new URLSearchParams(window.location.search);
      setActiveProductId(params.get('product'));
      const tpl = params.get('storefrontPreview');
      if (tpl) setCurrent(tpl);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const handleProductChange = (productId: string | null) => {
    setActiveProductId(productId);
    const url = new URL(window.location.href);
    if (productId) url.searchParams.set('product', productId);
    else url.searchParams.delete('product');
    if (productId) window.history.pushState({ productId }, '', url.toString());
    else window.history.replaceState({}, '', url.toString());
  };

  const switchTemplate = (next: string) => {
    setCurrent(next);
    const url = new URL(window.location.href);
    url.searchParams.set('storefrontPreview', next);
    url.searchParams.delete('product');
    setActiveProductId(null);
    window.history.replaceState({}, '', url.toString());
  };

  return (
    <div data-preview-template={current}>
      <div className="sticky top-0 z-[60] flex flex-wrap items-center gap-2 border-b border-neutral-800 bg-neutral-950 px-3 py-2 text-neutral-200">
        <span className="mr-1 text-[11px] uppercase tracking-[0.18em] text-neutral-500">模板预览 · 隔离环境，未影响线上店铺</span>
        {TEMPLATES.map(template => (
          <button
            key={template.id}
            type="button"
            onClick={() => switchTemplate(template.id)}
            aria-pressed={current === template.id}
            className={`border px-2.5 py-1 text-[11px] transition-colors ${current === template.id ? 'border-white bg-white text-neutral-950' : 'border-neutral-700 hover:border-neutral-400'}`}
          >
            {template.name}
          </button>
        ))}
        <span className="ml-auto text-[11px] text-neutral-500">
          {data.merchant ? `${data.merchant.name} · ${data.products.length} 款` : '未找到商家'}
          {demoFill && demoProducts.length > 0 ? ' · 含版式评审演示数据' : ''}
        </span>
      </div>

      {current === 'bags_editorial' && (
        <BagsEditorialTemplate data={data} initialProductId={activeProductId} onProductChange={handleProductChange} />
      )}
      {current === 'bags_catalogue' && (
        <BagsCatalogueTemplate data={data} initialProductId={activeProductId} onProductChange={handleProductChange} />
      )}
      {current === 'bags_wholesale' && (
        <BagsWholesaleTemplate data={data} initialProductId={activeProductId} onProductChange={handleProductChange} />
      )}
      {!TEMPLATES.some(template => template.id === current) && (
        <div className="grid min-h-[60vh] place-items-center px-6 text-center text-sm text-neutral-600">
          未知模板：{current}
        </div>
      )}
    </div>
  );
};
