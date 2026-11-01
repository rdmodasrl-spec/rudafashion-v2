import React, { Suspense, useEffect, useMemo, useState } from 'react';
import type { StructuralStorefrontTemplateId } from '../../../../shared/storefrontTemplates/registry';
import { STOREFRONT_TEMPLATE_COMPONENTS } from './templateComponents';
import { useStorefrontData } from './useStorefrontData';

type Props = {
  templateId: StructuralStorefrontTemplateId;
  merchantId: string;
  embeddedInMerchantApp?: boolean;
};

function readProductId(): string | null {
  return typeof window === 'undefined'
    ? null
    : new URLSearchParams(window.location.search).get('product');
}

export const StorefrontTemplatePage: React.FC<Props> = ({
  templateId,
  merchantId,
  embeddedInMerchantApp = false
}) => {
  const data = useStorefrontData(merchantId, { embeddedInMerchantApp });
  const [activeProductId, setActiveProductId] = useState(readProductId);
  const activeProduct = useMemo(
    () => data.products.find(product => product.id === activeProductId) || null,
    [activeProductId, data.products]
  );
  const Component = STOREFRONT_TEMPLATE_COMPONENTS[templateId];

  useEffect(() => {
    const handlePopState = () => setActiveProductId(readProductId());
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    const previousTitle = document.title;
    const descriptionTag = document.head.querySelector<HTMLMetaElement>('meta[name="description"]');
    const previousDescription = descriptionTag?.content;
    const description = descriptionTag || document.createElement('meta');
    if (!descriptionTag) {
      description.name = 'description';
      document.head.appendChild(description);
    }

    const canonicalTag = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    const previousCanonical = canonicalTag?.href;
    const canonical = canonicalTag || document.createElement('link');
    if (!canonicalTag) {
      canonical.rel = 'canonical';
      document.head.appendChild(canonical);
    }
    const robotsTag = document.head.querySelector<HTMLMetaElement>('meta[name="robots"]');
    const previousRobots = robotsTag?.content;
    const robots = robotsTag || document.createElement('meta');
    if (!robotsTag) {
      robots.name = 'robots';
      document.head.appendChild(robots);
    }

    const merchantName = data.merchant?.name || 'RUDA';
    document.title = activeProduct
      ? `${activeProduct.name} · ${activeProduct.styleNo} · ${merchantName}`
      : data.merchant?.storefrontSeoTitle || merchantName;
    description.content = activeProduct?.description
      || data.merchant?.storefrontSeoDescription
      || data.brandStory
      || `${merchantName} 商品目录`;
    description.content = description.content.slice(0, 160);
    const canonicalUrl = new URL(window.location.href);
    if (activeProductId && !activeProduct) canonicalUrl.searchParams.delete('product');
    canonical.href = canonicalUrl.href.split('#')[0];
    if (embeddedInMerchantApp || (activeProductId && !activeProduct)) {
      robots.content = 'noindex,nofollow';
    } else if (!robotsTag) {
      robots.remove();
    }

    return () => {
      document.title = previousTitle;
      if (previousDescription === undefined) description.remove();
      else description.content = previousDescription;
      if (previousCanonical === undefined) canonical.remove();
      else canonical.href = previousCanonical;
      if (previousRobots === undefined) robots.remove();
      else robots.content = previousRobots;
    };
  }, [activeProduct, activeProductId, data.brandStory, data.merchant, embeddedInMerchantApp]);

  const handleProductChange = (productId: string | null) => {
    setActiveProductId(productId);
    const nextUrl = new URL(window.location.href);
    if (productId) nextUrl.searchParams.set('product', productId);
    else nextUrl.searchParams.delete('product');
    if (productId) window.history.pushState({ productId }, '', nextUrl);
    else window.history.replaceState({}, '', nextUrl);
  };

  return (
    <div data-storefront-template={templateId}>
      {data.isLoading ? (
        <div role="status" className="grid min-h-[50vh] place-items-center px-5 text-sm text-neutral-600">
          正在加载店铺商品…
        </div>
      ) : data.loadError ? (
        <div role="alert" className="mx-auto my-16 max-w-xl border border-neutral-300 bg-white px-5 py-6 text-sm text-neutral-800">
          {data.loadError}
        </div>
      ) : (
        <Suspense fallback={<div role="status" className="grid min-h-[50vh] place-items-center text-sm text-neutral-600">正在加载店铺页面…</div>}>
          <Component
            data={data}
            initialProductId={activeProduct ? activeProductId : null}
            onProductChange={handleProductChange}
          />
        </Suspense>
      )}
      {!data.isLoading && !data.loadError && activeProductId && !activeProduct ? (
        <p role="status" className="fixed bottom-4 left-1/2 z-[70] -translate-x-1/2 border border-neutral-300 bg-white px-4 py-3 text-sm text-neutral-800 shadow-sm">
          该商品无法访问或已下架。
        </p>
      ) : null}
    </div>
  );
};
