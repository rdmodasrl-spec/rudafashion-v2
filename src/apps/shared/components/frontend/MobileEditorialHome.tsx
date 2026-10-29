import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  BadgePercent,
  Heart,
  Search,
  ShoppingBag
} from 'lucide-react';
import '@fontsource-variable/inter';
import '@fontsource-variable/playfair-display';
import { useB2B } from '../../../../context/B2BContext';
import { INITIAL_PRODUCTS } from '../../../../data/mockData';
import { getLocalizedProductName } from '../../../../i18n/translations';
import type { Language } from '../../../../i18n/translations';
import type { Product } from '../../../../types/b2b';
import { ProductImage } from '../common/ProductImage';
import './mobileEditorialHome.css';

type HomepageProduct = Product & { detailProductId?: string };

const isPublicProduct = (product: Product): boolean =>
  product.lifecycleStatus !== 'draft' &&
  product.lifecycleStatus !== 'pending_review' &&
  product.lifecycleStatus !== 'rejected' &&
  product.lifecycleStatus !== 'archived' &&
  (product.visibility === undefined || product.visibility === 'public') &&
  !product.isPrivateVault &&
  !product.isExclusiveProtected &&
  !product.isLockedForBuyer;

const interleaveMerchants = (products: Product[]): Product[] => {
  const groups = new Map<string, Product[]>();
  products.forEach((product) => {
    const key = product.merchantId || product.merchantName || 'independent';
    groups.set(key, [...(groups.get(key) || []), product]);
  });

  const mixed: Product[] = [];
  while (groups.size) {
    for (const [merchantId, merchantProducts] of groups) {
      const next = merchantProducts.shift();
      if (next) mixed.push(next);
      if (merchantProducts.length === 0) groups.delete(merchantId);
    }
  }
  return mixed;
};

type EditorialProductProps = {
  product: HomepageProduct;
  lang: Language;
  onOpen: (productId: string) => void;
  size?: 'feature' | 'compact';
};

const EditorialProduct: React.FC<EditorialProductProps> = ({
  product,
  lang,
  onOpen,
  size = 'compact'
}) => {
  const name = getLocalizedProductName(product, lang);

  return (
    <article className={`editorial-product editorial-product--${size}`}>
      <button
        type="button"
        onClick={() => onOpen(product.detailProductId || product.id)}
        className="editorial-product__image"
        aria-label={name}
      >
        <ProductImage
          src={product.images[0]}
          alt={name}
          priority={size === 'feature'}
          flush
          className="h-full w-full"
          imageClassName="editorial-product__photo"
        />
        {product.status === 'clearance' && (
          <span className="editorial-product__sale" aria-label="Discount">
            <BadgePercent aria-hidden="true" />
          </span>
        )}
      </button>
    </article>
  );
};

export const MobileEditorialHome: React.FC = () => {
  const {
    products,
    lang,
    setCurrentView,
    setCatalogFilterStatus,
    setCatalogSearchQuery,
    quickSearchStyle,
    quickNavigateToProduct,
    cart,
    favorites,
    setActiveBuyerTab
  } = useB2B();

  const publicProducts = useMemo(() => products.filter(isPublicProduct), [products]);
  const homepageProducts = useMemo<HomepageProduct[]>(() => {
    if (!import.meta.env.DEV || publicProducts.length >= 36) return publicProducts;

    const previewSources = INITIAL_PRODUCTS.filter(
      (product) => isPublicProduct(product) && product.images.length > 0
    );
    if (previewSources.length === 0) return publicProducts;

    const previewProducts: HomepageProduct[] = Array.from(
      { length: 36 - publicProducts.length },
      (_, index) => {
        const source = previewSources[index % previewSources.length];
        const imageIndex = Math.floor(index / previewSources.length) % source.images.length;
        return {
          ...source,
          id: `homepage-layout-${index}`,
          detailProductId: source.id,
          images: [source.images[imageIndex]]
        };
      }
    );
    return [...publicProducts, ...previewProducts];
  }, [publicProducts]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [visibleProductCount, setVisibleProductCount] = useState(20);
  const productFeedSentinelRef = useRef<HTMLDivElement | null>(null);
  const mixedProductFeed = useMemo(() => interleaveMerchants(homepageProducts), [homepageProducts]);
  const productFeedBlocks = useMemo(() => {
    const pattern = [
      { size: 'medium' as const, rows: 2 },
      { size: 'large' as const, rows: 1 },
      { size: 'medium' as const, rows: 3 },
      { size: 'large' as const, rows: 3 },
      { size: 'medium' as const, rows: 2 },
      { size: 'large' as const, rows: 4 }
    ];
    const blocks: Array<{
      index: number;
      startIndex: number;
      products: HomepageProduct[];
      size: 'medium' | 'large';
    }> = [];
    let cursor = 0;
    let blockIndex = 0;
    while (cursor < mixedProductFeed.length) {
      const block = pattern[blockIndex % pattern.length];
      const itemCount = block.rows * (block.size === 'medium' ? 2 : 1);
      const blockProducts = mixedProductFeed.slice(cursor, cursor + itemCount);
      blocks.push({
        index: blockIndex,
        startIndex: cursor,
        products: blockProducts,
        size: block.size
      });
      cursor += itemCount;
      blockIndex += 1;
    }
    return blocks;
  }, [mixedProductFeed]);
  const hasMoreProducts = visibleProductCount < mixedProductFeed.length;

  useEffect(() => {
    const sentinel = productFeedSentinelRef.current;
    if (!hasMoreProducts || !sentinel || typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        setVisibleProductCount((count) => Math.min(count + 12, mixedProductFeed.length));
      }
    }, { rootMargin: '500px 0px' });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMoreProducts, mixedProductFeed.length]);

  const renderProduct = (
    product: Product,
    size: 'feature' | 'compact' = 'compact'
  ) => (
    <EditorialProduct
      key={product.id}
      product={product}
      lang={lang}
      onOpen={quickNavigateToProduct}
      size={size}
    />
  );

  return (
    <div className="mobile-editorial-home">
      <header className="mobile-editorial-header">
        <div className="mobile-editorial-masthead">
          <button
            type="button"
            className="mobile-editorial-wordmark"
            onClick={() => setCurrentView('home')}
            aria-label="RUDA Fashion home"
          >
            RUDA<span>.</span>
            <small>FASHION</small>
          </button>
          <div className="mobile-editorial-actions">
            <button
              type="button"
              aria-label="Search fashion"
              aria-expanded={searchOpen}
              onClick={() => setSearchOpen((open) => !open)}
            >
              <Search />
            </button>
            <button
              type="button"
              aria-label={`Favorites, ${favorites.length} items`}
              onClick={() => {
                setActiveBuyerTab('favorites');
                setCurrentView('account');
              }}
            >
              <Heart />
            </button>
            <button
              type="button"
              aria-label={`Shopping bag, ${cart.length} items`}
              onClick={() => setCurrentView('cart')}
            >
              <ShoppingBag />
              {cart.length > 0 && <span className="mobile-editorial-bag-count">{cart.length}</span>}
            </button>
          </div>
        </div>
        {searchOpen && (
          <form
            className="mobile-editorial-search"
            onSubmit={(event) => {
              event.preventDefault();
              const query = searchText.trim();
              if (!query) return;
              setCatalogFilterStatus('all');
              setCatalogSearchQuery(query);
              quickSearchStyle(query);
              setCurrentView('catalog');
            }}
          >
            <Search aria-hidden="true" />
            <input
              aria-label="Search styles and designers"
              autoFocus
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              placeholder="Search styles and designers"
            />
            <button type="submit">SEARCH</button>
          </form>
        )}
      </header>

      <div className="mobile-editorial-content">
        {mixedProductFeed.length > 0 ? (
          <section className="mobile-editorial-section mobile-editorial-feed">
            <div className="mobile-editorial-video mobile-editorial-video--hero" aria-label="Fashion video">
              <video
                src="/videos/ruda-home-hero.mp4"
                autoPlay
                muted
                loop
                playsInline
                preload="metadata"
              />
            </div>
            {productFeedBlocks.map((block) => {
              const isComplete = visibleProductCount >= block.startIndex + block.products.length;
              return (
                <React.Fragment key={`feed-block-${block.index}`}>
                  <div className={`mobile-editorial-product-block mobile-editorial-product-block--${block.size}`}>
                    {block.products.map((product, itemIndex) => {
                      const globalIndex = block.startIndex + itemIndex;
                      if (globalIndex >= visibleProductCount) return null;
                      return renderProduct(product, block.size === 'large' ? 'feature' : 'compact');
                    })}
                  </div>
                  {isComplete && block.index % 3 === 2 && (
                    <div className="mobile-editorial-video" aria-label="Fashion video">
                      <video
                        src="/videos/ruda-fashion.mp4"
                        poster={block.products[0]?.images[0]}
                        autoPlay
                        muted
                        loop
                        playsInline
                        preload="metadata"
                      />
                    </div>
                  )}
                </React.Fragment>
              );
            })}
            {hasMoreProducts && (
              <div ref={productFeedSentinelRef} className="mobile-editorial-feed-sentinel" aria-live="polite">
                <span aria-label="Loading more products" />
              </div>
            )}
          </section>
        ) : (
          <div className="mobile-editorial-empty-visual" aria-label="RUDA fashion film">
            <video
              src="/videos/ruda-fashion.mp4"
              autoPlay
              muted
              loop
              playsInline
              preload="metadata"
            />
          </div>
        )}

      </div>
    </div>
  );
};
