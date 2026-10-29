import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import vm from 'node:vm';
import test from 'node:test';

const root = process.cwd();
const miniRoot = path.join(root, 'merchant-miniprogram');
const pageSource = readFileSync(path.join(miniRoot, 'pages', 'more', 'index.js'), 'utf8');
const require = createRequire(import.meta.url);

function createPageHarness(initialMerchant: Record<string, unknown> = {
  name: 'Roma Atelier',
  storeSlug: 'roma-atelier',
  storefrontEnabled: true
}) {
  let definition: Record<string, any> | undefined;
  let merchant: Record<string, unknown> = initialMerchant;
  let chooseOptions: Record<string, any> | null = null;
  const calls: Array<{ path: string; options: Record<string, any> }> = [];
  const toasts: string[] = [];
  const uploadedImages: string[] = [];
  const sharedImages: string[] = [];
  const copiedValues: string[] = [];
  const qrValues: string[] = [];
  const context = {
    Page(value: Record<string, any>) {
      definition = value;
    },
    require(id: string) {
      if (id === '../../utils/api') {
        return {
          getAssetUrl: (url: string) => url.startsWith('http') ? url : `https://ruda.fashion${url}`,
          request: async (requestPath: string, options: Record<string, any> = {}) => {
            calls.push({ path: requestPath, options });
            if (requestPath === '/api/merchant/media/presign') {
              return {
                uploadUrl: 'https://media.example/upload',
                publicUrl: 'https://media.example/merchant-logo.jpg',
                key: 'merchants/1/storefront/images/v2/logo.jpg',
                contentType: options.data.contentType,
                sizeBytes: options.data.fileSize
              };
            }
            if (requestPath === '/api/merchant/storefront' && options.method === 'PUT') {
              merchant = Object.assign({}, merchant, { logo: options.data.logo });
              return { success: true };
            }
            if (requestPath === '/api/merchant/notifications') return { unread: 0 };
            throw new Error(`Unexpected API request: ${requestPath}`);
          }
        };
      }
      if (id === '../../utils/auth') {
        return {
          clearSession() {},
          verifySession: async () => ({
            session: { role: 'merchant', merchant },
            response: { merchant }
          })
        };
      }
      if (id === '../../utils/constants') return { PUBLIC_SITE_URL: 'https://modaui.com' };
      if (id === '../../utils/permissions') {
        return {
          canAccessWorkspace: (_auth: unknown, id: string) => id === 'settings',
          roleLabel: () => '老板工作台',
          visibleGroups: () => []
        };
      }
      if (id === '../../utils/tabbar') return { syncTabBar() {} };
      if (id === '../../utils/feature-flags') return { refreshFeatureFlags: async () => ({ modaui: false }) };
      if (id === '../../utils/qrcode-generator') {
        return () => ({
          addData(value: string) { qrValues.push(value); },
          make() {},
          getModuleCount: () => 21,
          isDark: (row: number, column: number) => (row + column) % 2 === 0
        });
      }
      throw new Error(`Unexpected module: ${id}`);
    },
    wx: {
      chooseMedia(options: Record<string, any>) {
        chooseOptions = options;
      },
      getFileSystemManager() {
        return { readFile: (options: Record<string, any>) => options.success({ data: new ArrayBuffer(8) }) };
      },
      request(options: Record<string, any>) {
        uploadedImages.push(options.url);
        options.success({ statusCode: 200 });
      },
      createSelectorQuery() {
        const canvas = {
          width: 0,
          height: 0,
          getContext: () => ({ fillRect() {}, set fillStyle(_value: string) {} })
        };
        return {
          select: () => ({
            fields: () => ({
              exec: (callback: (result: unknown[]) => void) => callback([{ node: canvas, width: 240, height: 240 }])
            })
          })
        };
      },
      getSystemInfoSync: () => ({ pixelRatio: 2 }),
      canvasToTempFilePath(options: Record<string, any>) {
        options.success({ tempFilePath: '/tmp/merchant-qr.png' });
      },
      nextTick(callback: () => void) {
        callback();
      },
      showShareImageMenu(options: Record<string, any>) {
        sharedImages.push(options.path);
      },
      setClipboardData(options: Record<string, any>) {
        copiedValues.push(options.data);
        options.success();
      },
      showToast(options: { title: string }) {
        toasts.push(options.title);
      },
      navigateTo() {},
      switchTab() {},
      showModal() {},
      removeStorageSync() {}
    },
    Promise,
    console
  };
  vm.runInNewContext(pageSource, context, { filename: 'more-page.js' });
  assert.ok(definition);
  const page = Object.assign({}, definition, {
    data: structuredClone(definition.data),
    setData(values: Record<string, unknown>) {
      Object.assign(this.data, values);
    }
  });
  return {
    page,
    calls,
    toasts,
    uploadedImages,
    sharedImages,
    copiedValues,
    qrValues,
    getChooseOptions: () => chooseOptions
  };
}

test('More page loads the local QR module without requiring mini program npm packaging', () => {
  const localQrModule = require('../merchant-miniprogram/utils/qrcode-generator');
  const qr = localQrModule(0, 'M');
  qr.addData('https://modaui.com/shop/roma-atelier');
  qr.make();
  assert.ok(qr.getModuleCount() > 0);
  assert.equal(typeof qr.isDark(0, 0), 'boolean');
  assert.match(pageSource, /require\(['"]\.\.\/\.\.\/utils\/qrcode-generator['"]\)/);
});

test('More profile uses the RUDA fallback and exposes the published store QR entry', async () => {
  const { page } = createPageHarness();
  await page.loadProfile();

  const markup = readFileSync(path.join(miniRoot, 'pages', 'more', 'index.wxml'), 'utf8');
  const styles = readFileSync(path.join(miniRoot, 'pages', 'more', 'index.wxss'), 'utf8');
  assert.equal(page.data.merchantWebsiteUrl, 'https://modaui.com/shop/roma-atelier');
  assert.match(markup, /wx:else class="avatar-img avatar-fallback" src="\/assets\/default-merchant-logo\.jpg"/);
  assert.match(markup, /wx:if="\{\{merchantWebsiteUrl\}\}" class="merchant-qr-entry"/);
  assert.match(styles, /\.avatar-box[\s\S]*?width:\s*84rpx[\s\S]*?height:\s*84rpx[\s\S]*?border-radius:\s*50%/);
  assert.ok(existsSync(path.join(miniRoot, 'assets', 'default-merchant-logo.jpg')));
});

test('merchant can upload a logo through presigned media and refresh the storefront profile', async () => {
  const { page, calls, uploadedImages, toasts, getChooseOptions } = createPageHarness();
  await page.loadProfile();
  page.chooseMerchantLogo();
  const options = getChooseOptions();
  assert.ok(options);
  await options.success({
    tempFiles: [{ tempFilePath: '/tmp/custom-logo.jpg', size: 1024 }]
  });

  const presign = calls.find(call => call.path === '/api/merchant/media/presign');
  const storefront = calls.find(call => call.path === '/api/merchant/storefront');
  assert.equal(presign?.options.data.contentType, 'image/jpeg');
  assert.deepEqual(JSON.parse(JSON.stringify(storefront?.options.data.storefrontMediaItems[0])), {
    field: 'logo',
    url: 'https://media.example/merchant-logo.jpg',
    storageKey: 'merchants/1/storefront/images/v2/logo.jpg',
    contentType: 'image/jpeg',
    sizeBytes: 1024
  });
  assert.deepEqual(uploadedImages, ['https://media.example/upload']);
  assert.equal(page.data.merchantLogo, 'https://media.example/merchant-logo.jpg');
  assert.ok(toasts.includes('店铺头像已更新'));
});

test('published store QR is generated locally and can be shared or copied', async () => {
  const { page, sharedImages, copiedValues } = createPageHarness();
  await page.loadProfile();
  page.openMerchantQrCode();

  assert.equal(page.data.merchantQrImagePath, '/tmp/merchant-qr.png');
  assert.equal(page.data.qrLoading, false);
  page.shareMerchantQrCode();
  page.copyMerchantWebsite();
  assert.deepEqual(sharedImages, ['/tmp/merchant-qr.png']);
  assert.deepEqual(copiedValues, ['https://modaui.com/shop/roma-atelier']);
});

test('merchant profile displays the six-digit code and QR resolves through the public finder', async () => {
  const { page, qrValues } = createPageHarness({
    name: 'Roma Atelier',
    storeSlug: 'roma-atelier',
    storeLookupCode: '000001',
    storefrontEnabled: true
  });
  await page.loadProfile();
  assert.equal(page.data.storeLookupCode, '000001');
  assert.equal(page.data.merchantWebsiteUrl, 'https://modaui.com/showrooms?storeCode=000001');
  page.openMerchantQrCode();
  assert.deepEqual(qrValues, ['https://modaui.com/showrooms?storeCode=000001']);

  const markup = readFileSync(path.join(miniRoot, 'pages', 'more', 'index.wxml'), 'utf8');
  assert.match(markup, /class="store-lookup-code">店铺码 \{\{storeLookupCode\}\}/);
});
