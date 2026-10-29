import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import test from 'node:test';

const homeSource = readFileSync(new URL('../miniprogram/pages/home/index.js', import.meta.url), 'utf8');

type MiniProgramHomeHarness = {
  data: { feedItems: Array<Record<string, unknown>>; loading: boolean };
  navigation: Array<Record<string, string>>;
  _products: Array<Record<string, unknown>>;
  _visibleCount: number;
  setData(update: Record<string, unknown>): void;
  loadProducts(): Promise<void>;
  onReachBottom(): void;
  updateFeed(): void;
  openStore(event: { currentTarget: { dataset: { slug: string } } }): void;
};

function createHomePage(
  products: Array<Record<string, unknown>>,
  merchants: Array<Record<string, unknown>> = []
) {
  let definition: Record<string, any> | undefined;
  const navigation: Array<Record<string, string>> = [];
  runInNewContext(homeSource, {
    Page: (page: Record<string, any>) => { definition = page; },
    require: (specifier: string) => {
      if (specifier === '../../utils/api') {
        return {
          getAssetUrl: (url: string) => url,
          getProducts: async () => ({ products }),
          getMerchants: async () => ({ merchants }),
        };
      }
      throw new Error(`Unexpected module: ${specifier}`);
    },
    wx: {
      navigateTo: (options: Record<string, string>) => navigation.push(options)
    },
    console
  });

  assert.ok(definition);
  const page = Object.assign({}, definition, {
    data: JSON.parse(JSON.stringify(definition.data)),
    navigation,
    setData(update: Record<string, unknown>) {
      Object.assign(this.data, update);
    }
  }) as MiniProgramHomeHarness;
  return page;
}

test('mini program homepage starts with video and follows the editorial product layout', async () => {
  const products = Array.from({ length: 36 }, (_, index) => ({
    id: `product-${index}`,
    merchantId: `merchant-${index % 3}`,
    images: [`https://example.test/${index}.jpg`],
    visibility: 'public'
  }));
  const page = createHomePage(products);

  assert.equal(page.data.feedItems[0].type, 'video');
  assert.equal(page.data.feedItems[0].isHero, true);
  assert.equal(page.data.feedItems[0].videoUrl, 'https://ruda.fashion/videos/ruda-home-hero.mp4?v=20261017-corpfix');

  await page.loadProducts();

  const items = page.data.feedItems as Array<Record<string, any>>;
  const productBlocks = items.filter(item => item.type === 'products');
  assert.deepEqual(
    JSON.parse(JSON.stringify(
      productBlocks.slice(0, 6).map(item => [item.layout, item.products.length])
    )),
    [
      ['medium', 4],
      ['large', 1],
      ['medium', 6],
      ['large', 3],
      ['medium', 4],
      ['large', 4]
    ]
  );
  assert.deepEqual(
    JSON.parse(JSON.stringify(items.filter(item => item.type === 'video').map(item => item.isHero))),
    [true, false, false]
  );
  assert.deepEqual(
    JSON.parse(JSON.stringify(items.filter(item => item.type === 'video').map(item => item.key))),
    ['opening-video', 'video-2', 'video-5']
  );
  assert.deepEqual(
    JSON.parse(JSON.stringify(items.filter(item => item.type === 'video').map(item => item.videoUrl))),
    [
      'https://ruda.fashion/videos/ruda-home-hero.mp4?v=20261017-corpfix',
      'https://ruda.fashion/videos/ruda-fashion.mp4?v=20261017-corpfix',
      'https://ruda.fashion/videos/ruda-fashion.mp4?v=20261017-corpfix'
    ]
  );
});

test('mini program homepage keeps each product block complete when loading more', async () => {
  const products = Array.from({ length: 36 }, (_, index) => ({
    id: `product-${index}`,
    merchantId: `merchant-${index % 3}`,
    images: [`https://example.test/${index}.jpg`],
    visibility: 'public'
  }));
  const page = createHomePage(products);

  await page.loadProducts();
  assert.equal(
    (page.data.feedItems as Array<Record<string, any>>)
      .filter(item => item.type === 'products')
      .reduce((count, item) => count + item.products.length, 0),
    22
  );

  page.onReachBottom();

  assert.equal(
    (page.data.feedItems as Array<Record<string, any>>)
      .filter(item => item.type === 'products')
      .reduce((count, item) => count + item.products.length, 0),
    33
  );
});

test('mini program homepage interleaves up to ten real merchant storefronts', async () => {
  const products = Array.from({ length: 36 }, (_, index) => ({
    id: `product-${index}`,
    merchantId: `product-merchant-${index % 3}`,
    images: [`https://example.test/product-${index}.jpg`],
    visibility: 'public'
  }));
  const merchants = Array.from({ length: 12 }, (_, index) => ({
    id: `store-${index}`,
    storeSlug: `store-${index}`,
    showroomImage: `https://example.test/store-${index}.jpg`
  }));
  const page = createHomePage(products, merchants);

  await page.loadProducts();
  assert.equal(
    (page.data.feedItems as Array<Record<string, any>>).filter(item => item.type === 'merchant').length,
    10
  );
  page._visibleCount = products.length;
  page.updateFeed();

  const items = JSON.parse(JSON.stringify(page.data.feedItems)) as Array<Record<string, any>>;
  const merchantItems = items.filter(item => item.type === 'merchant');
  assert.equal(merchantItems.length, 10);
  assert.deepEqual(
    merchantItems.map(item => item.storeSlug),
    Array.from({ length: 10 }, (_, index) => `store-${index}`)
  );
  assert.equal(items[0].key, 'opening-video');

  page.openStore({ currentTarget: { dataset: { slug: 'store-0' } } });
  assert.equal(page.navigation[0].url, '/pages/store/index?storeSlug=store-0');
});
