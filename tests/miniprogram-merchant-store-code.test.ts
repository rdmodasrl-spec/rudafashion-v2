import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import test from 'node:test';

const root = new URL('../miniprogram/', import.meta.url);
const findStoreSource = readFileSync(new URL('pages/find-store/index.js', root), 'utf8');
const findStoreTemplate = readFileSync(new URL('pages/find-store/index.wxml', root), 'utf8');
const serverSource = readFileSync(new URL('../server.ts', import.meta.url), 'utf8');
const schemaSource = readFileSync(new URL('../prisma/schema.prisma', import.meta.url), 'utf8');
const migrationSource = readFileSync(
  new URL('../prisma/migrations/20261024130000_merchant_store_lookup_code/migration.sql', import.meta.url),
  'utf8'
);

function createFindStoreHarness(storeResult: { storeSlug: string } | ((code: string) => { storeSlug: string }) = { storeSlug: 'atelier-example' }) {
  let definition: Record<string, any> | undefined;
  const calls: Array<{ name: string; value: string }> = [];
  const navigations: string[] = [];
  runInNewContext(findStoreSource, {
    Page: (value: Record<string, any>) => { definition = value; },
    require(specifier: string) {
      if (specifier === '../../utils/api') {
        return {
          getAssetUrl: (value: string) => value,
          getMerchants: async (query?: string) => {
            calls.push({ name: 'getMerchants', value: query || '' });
            return { merchants: [{ id: 'merchant-1', name: 'Atelier Example', storeSlug: 'atelier-example' }] };
          },
          getStoreByLookupCode: async (code: string) => {
            calls.push({ name: 'getStoreByLookupCode', value: code });
            return typeof storeResult === 'function' ? storeResult(code) : storeResult;
          },
          getStoreLookupQrUrl: (code: string) => `/api/merchants/code/${code}/qr.png`
        };
      }
      if (specifier === '../../utils/auth') {
        return { getAuthSession: () => null, getVerifiedAuthProfile: async () => null };
      }
      throw new Error(`Unexpected module: ${specifier}`);
    },
    wx: {
      navigateTo: (options: { url: string }) => navigations.push(options.url),
      showToast() {},
      showModal() {},
      scanCode() {}
    }
  });
  assert.ok(definition);
  const page = Object.assign({}, definition, {
    data: Object.assign({}, definition.data),
    setData(update: Record<string, unknown>) { Object.assign(this.data, update); }
  });
  return { page, calls, navigations };
}

test('six-digit merchant codes route to public storefronts without redeeming private access codes', async () => {
  const { page, calls, navigations } = createFindStoreHarness();
  await page.redeemCode('000001');
  assert.deepEqual(calls, [{ name: 'getStoreByLookupCode', value: '000001' }]);
  assert.deepEqual(navigations, ['/pages/store/index?storeSlug=atelier-example']);
});

test('different six-digit codes resolve to their matching storefronts', async () => {
  const { page, navigations } = createFindStoreHarness(code => ({
    storeSlug: code === '000001' ? 'store-a' : 'store-b'
  }));
  await page.redeemCode('000001');
  await page.redeemCode('000002');
  assert.deepEqual(navigations, [
    '/pages/store/index?storeSlug=store-a',
    '/pages/store/index?storeSlug=store-b'
  ]);
});

test('the merchant QR deep link is parsed as its six-digit store code', async () => {
  const { page, calls, navigations } = createFindStoreHarness();
  page.onLoad({ q: 'https://ruda.fashion/showrooms?storeCode=000001' });
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.deepEqual(calls, [{ name: 'getStoreByLookupCode', value: '000001' }]);
  assert.deepEqual(navigations, ['/pages/store/index?storeSlug=atelier-example']);
});

test('merchant names are searched through the public merchant API', async () => {
  const { page, calls } = createFindStoreHarness();
  await page.redeemCode('Atelier');
  assert.deepEqual(calls, [{ name: 'getMerchants', value: 'Atelier' }]);
  assert.equal(page.data.searchResults[0].storeSlug, 'atelier-example');
});

test('legacy private store access codes are refused explicitly instead of calling a missing endpoint', async () => {
  const code = `RUDA-${'A'.repeat(32)}`;
  const { page, calls, navigations } = createFindStoreHarness();
  await page.redeemCode(code);
  // 该能力没有任何签发方与后端实现：不得调用接口，也不得伪造跳转。
  assert.deepEqual(calls, []);
  assert.deepEqual(navigations, []);
  assert.match(page.data.message, /访问码兑换暂未开放/);
  assert.match(findStoreTemplate, /六位商家代码或搜索商家名称/);
  assert.doesNotMatch(findStoreSource, /store-access\/redeem/);
});

test('all merchant records receive a unique six-digit string lookup code', () => {
  assert.match(schemaSource, /storeLookupCode\s+String\s+@unique\s+@default\(dbgenerated\(/);
  assert.match(migrationSource, /ROW_NUMBER\(\) OVER \(ORDER BY "createdAt" ASC, "id" ASC\)/);
  assert.match(migrationSource, /LPAD\(numbered_merchants\.ordinal::TEXT, 6, '0'\)/);
  assert.match(migrationSource, /MAXVALUE 999999/);
  assert.match(migrationSource, /CREATE UNIQUE INDEX "Merchant_storeLookupCode_key"/);
  assert.doesNotMatch(schemaSource, /storeLookupCode\s+Int\b/);
});

test('public six-digit store codes resolve only to public storefronts and expose a share QR', () => {
  assert.match(serverSource, /app\.get\('\/api\/merchants\/code\/:storeLookupCode'/);
  assert.match(serverSource, /where: \{ storeLookupCode \}[\s\S]*?select: \{ storeSlug: true, storefrontEnabled: true, isVerified: true \}/);
  assert.match(serverSource, /if \(!merchant \|\| !isPublicStorefront\(merchant\)\)/);
  assert.match(serverSource, /app\.get\('\/api\/merchants\/code\/:storeLookupCode\/qr\.png'/);
  assert.match(serverSource, /storeCode', storeLookupCode/);
  assert.match(serverSource, /searchTerm \? \[\{/);
  assert.match(serverSource, /\^\\d\{6\}\$/);
});
