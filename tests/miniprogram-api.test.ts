import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import test from 'node:test';

const apiSource = readFileSync(new URL('../miniprogram/utils/api.js', import.meta.url), 'utf8');
const authSource = readFileSync(new URL('../miniprogram/utils/auth.js', import.meta.url), 'utf8');

function createApiHarness(response: Record<string, unknown>, session: Record<string, unknown> | null = null) {
  const requests: Array<Record<string, any>> = [];
  const storage = new Map<string, unknown>();
  if (session) storage.set('ruda_mini_auth', session);
  const module = { exports: {} as Record<string, (...args: any[]) => any> };
  const wx = {
    getStorageSync: (key: string) => storage.get(key),
    removeStorageSync: (key: string) => storage.delete(key),
    request: (options: Record<string, any>) => {
      requests.push(options);
      options.success({ statusCode: response.statusCode || 200, data: response.data, header: response.header || {} });
    }
  };

  runInNewContext(apiSource, {
    module,
    exports: module.exports,
    require: (specifier: string) => {
      if (specifier === './constants') {
        return {
          API_BASE_URL: 'https://ruda.fashion',
          AUTH_STORAGE_KEY: 'ruda_mini_auth'
        };
      }
      throw new Error(`Unexpected module: ${specifier}`);
    },
    wx
  });

  return { api: module.exports, requests, storage };
}

function createAuthHarness(session: Record<string, unknown> | null) {
  const storage = new Map<string, unknown>();
  if (session) storage.set('ruda_mini_auth', session);
  const module = { exports: {} as Record<string, (...args: any[]) => any> };
  const wx = {
    getStorageSync: (key: string) => storage.get(key),
    removeStorageSync: (key: string) => storage.delete(key),
    setStorageSync: (key: string, value: unknown) => storage.set(key, value)
  };

  runInNewContext(authSource, {
    module,
    exports: module.exports,
    require: (specifier: string) => {
      if (specifier === './constants') return { AUTH_STORAGE_KEY: 'ruda_mini_auth' };
      throw new Error(`Unexpected module: ${specifier}`);
    },
    wx,
    Date: { now: () => 1000 }
  });

  return { auth: module.exports, storage };
}

test('mini program API requests use the configured HTTPS host and bearer token', async () => {
  const { api, requests } = createApiHarness({
    data: { success: true, products: [] }
  }, { role: 'buyer', token: 'buyer-token' });

  const result = await api.apiRequest('/api/products');

  assert.equal(result.success, true);
  assert.equal(requests[0].url, 'https://ruda.fashion/api/products');
  assert.equal(requests[0].header.Authorization, 'Bearer buyer-token');
});

test('mini program login posts to a dedicated role endpoint without sending a stale token', async () => {
  const { api, requests } = createApiHarness({
    data: { success: true, token: 'new-token', expiresIn: 604800 }
  }, { role: 'buyer', token: 'old-token' });

  await api.login('buyer', {
    email: 'buyer@example.test',
    password: 'password'
  });

  assert.equal(requests[0].url, 'https://ruda.fashion/api/miniprogram/auth/login/buyer');
  assert.equal(requests[0].method, 'POST');
  assert.equal(requests[0].header.Authorization, undefined);
  assert.deepEqual(requests[0].data, {
    email: 'buyer@example.test',
    password: 'password'
  });
});

test('WeChat login exchanges only the wx.login code and never sends a stored bearer token', async () => {
  const { api, requests } = createApiHarness({
    data: { success: true, requiresAccountBinding: true }
  }, { role: 'buyer', token: 'existing-buyer-token' });

  const result = await api.loginWithWechat('one-time-code');

  assert.equal(result.requiresAccountBinding, true);
  assert.equal(requests[0].url, 'https://ruda.fashion/api/miniprogram/auth/wechat/login');
  assert.equal(requests[0].header.Authorization, undefined);
  assert.equal(requests[0].data.code, 'one-time-code');
  assert.equal(requests[0].data.code, 'one-time-code');
  assert.equal(Object.keys(requests[0].data).length, 1);
});

test('WeChat binding requires the current bearer-authenticated buyer session', async () => {
  const { api, requests } = createApiHarness({
    data: { success: true, bound: true, alreadyBound: false }
  }, { role: 'buyer', token: 'verified-buyer-token' });

  await api.bindWechatIdentity('fresh-one-time-code');

  assert.equal(requests[0].url, 'https://ruda.fashion/api/miniprogram/auth/wechat/bind');
  assert.equal(requests[0].header.Authorization.split(' ')[0], 'Bearer');
  assert.equal(requests[0].header.Authorization.slice('Bearer '.length), 'verified-buyer-token');
  assert.equal(requests[0].data.code, 'fresh-one-time-code');
  assert.equal(requests[0].data.code, 'fresh-one-time-code');
  assert.equal(Object.keys(requests[0].data).length, 1);
});

test('WeChat binding without a stored buyer token receives an explicit unauthorized response', async () => {
  const { api, requests, storage } = createApiHarness({
    statusCode: 401,
    data: { success: false, error: { code: 'BUYER_AUTH_REQUIRED', message: 'Buyer authentication is required' } }
  });

  await assert.rejects(api.bindWechatIdentity('fresh-one-time-code'), error => {
    if (!error || typeof error !== 'object') return false;
    assert.equal('status' in error ? error.status : undefined, 401);
    assert.equal('code' in error ? error.code : undefined, 'BUYER_AUTH_REQUIRED');
    return true;
  });
  assert.equal(requests[0].header.Authorization, undefined);
  assert.equal(storage.has('ruda_mini_auth'), false);
});

test('expired mini program sessions are cleared before they can be reused', () => {
  const { auth, storage } = createAuthHarness({
    role: 'buyer',
    token: 'expired-token',
    expiresAt: 999
  });

  assert.equal(auth.getAuthSession(), null);
  assert.equal(storage.has('ruda_mini_auth'), false);
});

test('unexpired mini program sessions remain available', () => {
  const { auth, storage } = createAuthHarness({
    role: 'buyer',
    token: 'active-token',
    expiresAt: 1001
  });

  const session = auth.getAuthSession();
  assert.equal(session.role, 'buyer');
  assert.equal(session.token, 'active-token');
  assert.equal(storage.has('ruda_mini_auth'), true);
});

test('an authenticated 401 clears the stored token and remains an explicit API error', async () => {
  const { api, storage } = createApiHarness({
    statusCode: 401,
    data: { success: false, error: { code: 'BUYER_AUTH_REQUIRED', message: 'Buyer authentication is required' } }
  }, { role: 'buyer', token: 'expired-token' });

  await assert.rejects(api.apiRequest('/api/orders'), error => {
    if (!error || typeof error !== 'object') return false;
    const apiError = error as { status?: unknown; code?: unknown };
    assert.equal(apiError.status, 401);
    assert.equal(apiError.code, 'BUYER_AUTH_REQUIRED');
    return true;
  });
  assert.equal(storage.has('ruda_mini_auth'), false);
});

test('a failed login does not clear a previously stored session', async () => {
  const { api, storage } = createApiHarness({
    statusCode: 401,
    data: { success: false, error: 'WRONG_PASSWORD' }
  }, { role: 'buyer', token: 'existing-token' });

  await assert.rejects(api.login('buyer', { email: 'buyer@example.test', password: 'bad' }));
  assert.deepEqual(storage.get('ruda_mini_auth'), { role: 'buyer', token: 'existing-token' });
});

test('product identifiers are encoded before requesting a shared detail route', async () => {
  const { api, requests } = createApiHarness({
    data: { success: true, product: { id: 'product/one' } }
  });

  await api.getProduct('product/one');

  assert.equal(requests[0].url, 'https://ruda.fashion/api/products/product%2Fone');
});

test('public discovery APIs use the existing RUDA endpoints without buyer authentication', async () => {
  const { api, requests } = createApiHarness({
    data: { success: true, items: [], posts: [] }
  }, { role: 'buyer', token: 'buyer-token' });

  await api.getFashionEditorial();
  await api.getFashionPosts({ limit: 24, sort: 'latest' });

  assert.equal(requests[0].url, 'https://ruda.fashion/api/fashion/editorial');
  assert.equal(requests[0].header.Authorization, undefined);
  assert.equal(requests[1].url, 'https://ruda.fashion/api/fashion/posts?limit=24&sort=latest');
  assert.equal(requests[1].header.Authorization, undefined);
});

test('public ModaGPT chat uses its existing endpoint without sending stored credentials', async () => {
  const { api, requests } = createApiHarness({
    data: { success: true, reply: '设计建议' }
  }, { role: 'buyer', token: 'buyer-token' });

  const response = await api.postModaGptMessage('设计春季女装', []);

  assert.equal(response.reply, '设计建议');
  assert.equal(requests[0].url, 'https://ruda.fashion/api/modagpt/public/chat');
  assert.equal(requests[0].method, 'POST');
  assert.equal(requests[0].header.Authorization, undefined);
  assert.equal(JSON.stringify(requests[0].data), JSON.stringify({
    message: '设计春季女装',
    history: [],
    language: 'zh'
  }));
});

test('buyer checkout and merchant workspace call the existing protected API routes', async () => {
  const { api, requests } = createApiHarness({
    data: { success: true, orders: [], products: [], balances: [] }
  }, { role: 'buyer', token: 'workspace-token' });
  const masterOrder = { orderNo: 'WX123', items: [] };
  await api.createOrder(masterOrder);
  await api.getBuyerOrders();
  await api.cancelBuyerOrder('order/1', 'buyer request');
  await api.getMerchantProducts();
  await api.updateMerchantProduct('product/1', { lifecycleStatus: 'draft' });
  await api.presignMerchantMedia('image/jpeg', 123);
  await api.createMerchantProduct({ creationRequestKey: 'abcd1234' });
  await api.adjustMerchantInventory({
    balanceId: 'balance-1',
    variantId: 'variant-1',
    locationId: 'location-1',
    version: 2,
    quantity: -1,
    note: 'count correction'
  });
  await api.updateMerchantOrderFulfillment('order/2', {
    status: 'shipped',
    carrier: 'DHL',
    trackingNumber: 'TRACK-123'
  });
  await api.getMerchantOrders();
  await api.getMerchantInventory();

  assert.deepEqual(
    requests.map(request => [request.method || 'GET', new URL(request.url).pathname]),
    [
      ['POST', '/api/orders'],
      ['GET', '/api/orders'],
      ['POST', '/api/orders/order%2F1/cancel'],
      ['GET', '/api/merchant/products'],
      ['PUT', '/api/merchant/products/product%2F1'],
      ['POST', '/api/merchant/media/presign'],
      ['POST', '/api/merchant/products'],
      ['POST', '/api/merchant/inventory/adjustments'],
      ['PUT', '/api/merchant/orders/order%2F2/fulfill'],
      ['GET', '/api/merchant/orders'],
      ['GET', '/api/merchant/inventory/balances']
    ]
  );
  assert.equal(JSON.stringify(requests[0].data), JSON.stringify({ masterOrder }));
  assert.equal(JSON.stringify(requests[2].data), JSON.stringify({ reason: 'buyer request' }));
  assert.equal(JSON.stringify(requests[5].data), JSON.stringify({ contentType: 'image/jpeg', fileSize: 123 }));
  assert.equal(JSON.stringify(requests[7].data), JSON.stringify({
    balanceId: 'balance-1',
    variantId: 'variant-1',
    locationId: 'location-1',
    version: 2,
    quantity: -1,
    note: 'count correction'
  }));
  assert.equal(JSON.stringify(requests[8].data), JSON.stringify({
    status: 'shipped',
    carrier: 'DHL',
    trackingNumber: 'TRACK-123'
  }));
  assert.equal(requests.every(request => request.header.Authorization === 'Bearer workspace-token'), true);
});
