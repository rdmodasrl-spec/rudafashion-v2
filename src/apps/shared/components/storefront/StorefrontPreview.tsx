/**
 * 店铺模板隔离预览（Stage B）。
 *
 * 只在 URL 带 `?storefrontPreview=<templateId>` 时接管渲染，不替换任何商家现有网站，
 * 也不写库。用于三套模板的真实浏览器验收与截图取证。
 */
import React, { Suspense, useEffect, useMemo, useState } from 'react';
import { STOREFRONT_INDUSTRY_GROUPS, findStorefrontIndustryGroup } from '../../../../shared/storefrontTemplates/registry';
import { mapProductForStorefront, useStorefrontData, type StorefrontProduct } from './useStorefrontData';
import { STOREFRONT_TEMPLATE_COMPONENTS } from './templateComponents';

export function readPreviewTemplateFromLocation(): string | null {
  if (typeof window === 'undefined') return null;
  return new URLSearchParams(window.location.search).get('storefrontPreview');
}

export function readPreviewMerchantFromLocation(): string | null {
  if (typeof window === 'undefined') return null;
  return new URLSearchParams(window.location.search).get('merchant');
}

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

  /**
   * 深链 SEO：每个商品 URL 必须有唯一的 title / description / canonical。
   * 预览环境整体 noindex，但元信息仍需正确，换成正式店铺路由后可直接复用。
   */
  useEffect(() => {
    if (typeof document === 'undefined') return undefined;
    const product = activeProductId ? base.products.find(item => item.id === activeProductId) : null;
    const previousTitle = document.title;
    const upsert = (name: string, content: string) => {
      let tag = document.head.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
      if (!tag) { tag = document.createElement('meta'); tag.name = name; document.head.appendChild(tag); }
      tag.content = content;
      return tag;
    };
    let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!canonical) { canonical = document.createElement('link'); canonical.rel = 'canonical'; document.head.appendChild(canonical); }

    const merchantName = base.merchant?.name || 'RUDA';
    if (product) {
      document.title = `${product.name} · ${product.styleNo} · ${merchantName}`;
      upsert('description', (product.description || `${merchantName} ${product.name}（${product.styleNo}）`).slice(0, 160));
    } else {
      document.title = `${merchantName} · RUDA`;
      upsert('description', base.brandStory ? base.brandStory.slice(0, 160) : `${merchantName} 商品目录与批发订货`);
    }
    canonical.href = window.location.href.split('#')[0];
    return () => { document.title = previousTitle; };
  }, [activeProductId, base.products, base.merchant, base.brandStory]);

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
      <div className="sticky top-0 z-[60] flex flex-nowrap items-center gap-2 overflow-x-auto border-b border-neutral-800 bg-neutral-950 px-3 py-2 text-neutral-200">
        <span className="mr-1 hidden shrink-0 text-[12px] uppercase tracking-[0.18em] text-neutral-300 sm:inline">模板预览 · 隔离环境，未影响线上店铺</span>
        <select
          value={current}
          onChange={event => switchTemplate(event.target.value)}
          aria-label="选择模板"
          className="shrink-0 border border-neutral-700 bg-neutral-900 px-2 py-1 text-[12px] text-neutral-200"
        >
          {STOREFRONT_INDUSTRY_GROUPS.map(group => (
            <optgroup key={group.industry} label={group.label}>
              {group.templates.map(template => (
                <option key={template.id} value={template.id}>{template.name}</option>
              ))}
            </optgroup>
          ))}
        </select>
        <span className="shrink-0 whitespace-nowrap text-[12px] text-neutral-300">
          {findStorefrontIndustryGroup(current)?.label || '未知行业'} · {current}
        </span>
        <span className="ml-auto shrink-0 whitespace-nowrap text-[12px] text-neutral-300">
          {data.merchant ? `${data.merchant.name} · ${data.products.length} 款` : '未找到商家'}
          {demoFill && demoProducts.length > 0 ? ' · 含版式评审演示数据' : ''}
        </span>
      </div>

      {data.isLoading ? (
        <div role="status" className="grid min-h-[50vh] place-items-center px-5 text-sm text-neutral-600">
          正在加载真实店铺数据…
        </div>
      ) : data.loadError ? (
        <div role="alert" className="mx-auto my-12 max-w-xl border border-neutral-300 bg-white px-5 py-6 text-sm text-neutral-800">
          {data.loadError}
        </div>
      ) : (() => {
        const Component = STOREFRONT_TEMPLATE_COMPONENTS[current as keyof typeof STOREFRONT_TEMPLATE_COMPONENTS];
        if (!Component) {
          return (
            <div className="grid min-h-[60vh] place-items-center px-6 text-center text-sm text-neutral-600">
              未知模板：{current}
            </div>
          );
        }
        return (
          <Suspense fallback={<div role="status" className="grid min-h-[50vh] place-items-center text-sm text-neutral-600">正在加载模板…</div>}>
            <Component data={data} initialProductId={activeProductId} onProductChange={handleProductChange} />
          </Suspense>
        );
      })()}
    </div>
  );
};
