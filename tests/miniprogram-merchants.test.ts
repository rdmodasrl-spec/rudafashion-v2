import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import test from 'node:test';

const pageSource = readFileSync(new URL('../miniprogram/pages/merchants/index.js', import.meta.url), 'utf8');
const templateSource = readFileSync(new URL('../miniprogram/pages/merchants/index.wxml', import.meta.url), 'utf8');

function createMerchantPage(options: {
  merchants?: Array<Record<string, unknown>>;
  statuses?: Record<string, string>;
  session?: { role: string; token: string } | null;
  requestResult?: Record<string, unknown>;
} = {}) {
  let definition: Record<string, any> | undefined;
  const calls: Array<{ method: string; options?: Record<string, unknown> }> = [];
  const methods = {
    getMerchants: async () => ({ merchants: options.merchants || [] }),
    getVaultStatuses: async () => ({ statusByMerchant: options.statuses || {} }),
    requestVaultAccess: async () => options.requestResult || {
      success: true,
      message: '申请已提交',
      request: { status: 'pending' }
    },
    getAssetUrl: (value: string) => value
  };
  runInNewContext(pageSource, {
    Page: (page: Record<string, any>) => { definition = page; },
    require: (specifier: string) => {
      if (specifier === '../../utils/api') return methods;
      if (specifier === '../../utils/auth') return { getAuthSession: () => options.session || null };
      throw new Error(`Unexpected module: ${specifier}`);
    },
    wx: {
      navigateTo: (value: Record<string, unknown>) => calls.push({ method: 'navigateTo', options: value }),
      openLocation: (value: Record<string, unknown>) => calls.push({ method: 'openLocation', options: value }),
      makePhoneCall: (value: Record<string, unknown>) => calls.push({ method: 'makePhoneCall', options: value }),
      showLoading: () => calls.push({ method: 'showLoading' }),
      hideLoading: () => calls.push({ method: 'hideLoading' }),
      showModal: (value: Record<string, unknown>) => calls.push({ method: 'showModal', options: value }),
      showToast: (value: Record<string, unknown>) => calls.push({ method: 'showToast', options: value })
    },
    console
  });
  assert.ok(definition);
  const page = Object.assign({}, definition, {
    data: { ...definition.data },
    calls,
    setData(update: Record<string, unknown>) {
      Object.assign(this.data, update);
    }
  });
  return page;
}

const lamiar = {
  id: 'merchant-lamiar',
  name: 'LAMIAR',
  storeSlug: 'lamiar',
  industry: 'FASHION_WHOLESALE',
  tagline_zh: '时尚女装、连衣裙、上衣、针织衫及裤装',
  showroomAddress: 'Via Basilicata, 14, 59100 Prato PO, Italy',
  contactPhone: '+39 351 128 6089',
  websiteUrl: 'www。ruda.com',
  mapLatitude: 43.8777,
  mapLongitude: 11.1022
};

test('mini merchant cards hide address and phone labels while keeping contact values', () => {
  const contactRows = [...templateSource.matchAll(/<view class="merchant-contact-row">([\s\S]*?)<\/view>/g)]
    .map(([, content]) => content);

  assert.equal(contactRows.length, 2);
  assert.ok(contactRows.every(content => !content.includes('contact-label')));
  assert.ok(contactRows[0].includes('{{item.address'));
  assert.ok(contactRows[1].includes('{{item.phone}}'));
});

test('mini merchant cards normalize real merchant details and show saved authorization state', async () => {
  const page = createMerchantPage({
    merchants: [lamiar],
    statuses: { 'merchant-lamiar': 'approved' },
    session: { role: 'buyer', token: 'buyer-token' }
  });

  await page.loadMerchants();

  const [merchant] = page.data.merchants;
  assert.equal(merchant.name, 'LAMIAR');
  assert.equal(merchant.category, '服装批发');
  assert.equal(merchant.address, lamiar.showroomAddress);
  assert.equal(merchant.phone, lamiar.contactPhone);
  assert.equal(merchant.websiteUrl, 'https://www.ruda.com');
  assert.equal(merchant.hasCoordinates, true);
  assert.equal(merchant.vaultStatus, 'approved');

  page.requestMerchantAccess({ currentTarget: { dataset: { id: merchant.id } } });
  assert.equal(page.calls.at(-1)?.method, 'navigateTo');
  assert.equal(page.calls.at(-1)?.options?.url, '/pages/store/index?storeSlug=lamiar');
});

test('mini merchant actions open WeChat maps and dial the merchant number', async () => {
  const page = createMerchantPage({ merchants: [lamiar] });
  await page.loadMerchants();
  const [merchant] = page.data.merchants;

  page.navigateToMerchant({
    currentTarget: {
      dataset: {
        latitude: merchant.latitude,
        longitude: merchant.longitude,
        name: merchant.name,
        address: merchant.address
      }
    }
  });
  page.callMerchant({ currentTarget: { dataset: { phone: merchant.phone } } });

  assert.equal(page.calls.find(call => call.method === 'openLocation')?.options?.latitude, 43.8777);
  assert.equal(page.calls.find(call => call.method === 'makePhoneCall')?.options?.phoneNumber, '+393511286089');
});

test('mini merchant access applications update the card to pending status', async () => {
  const page = createMerchantPage({
    merchants: [lamiar],
    session: { role: 'buyer', token: 'buyer-token' }
  });
  await page.loadMerchants();

  await page.requestMerchantAccess({ currentTarget: { dataset: { id: 'merchant-lamiar' } } });

  assert.equal(page.data.merchants[0].vaultStatus, 'pending');
  assert.ok(page.calls.some(call => call.method === 'showModal' && call.options?.title === '授权申请'));
});

test('mini merchant sharing opens the specific merchant store with its identifier', async () => {
  const page = createMerchantPage({ merchants: [lamiar] });
  await page.loadMerchants();

  assert.deepEqual(
    JSON.parse(JSON.stringify(page.onShareAppMessage({ target: { dataset: { id: lamiar.id } } }))),
    {
      title: 'LAMIAR｜RUDA 商家名片',
      path: `/pages/store/index?shopId=${lamiar.id}`
    }
  );
});
