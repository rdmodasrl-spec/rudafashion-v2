/**
 * 消费者账户接口的真实 HTTP 校验（配合 scripts/test-consumer-account-isolated.sh）。
 * 只使用公开 HTTP 接口，不直接读写数据库。
 */
const baseUrl = process.env.BASE_URL;
if (!baseUrl) throw new Error('BASE_URL is required');

let failures = 0;
const check = (name, condition, detail) => {
  if (condition) {
    console.log(`ok - ${name}`);
    return;
  }
  failures += 1;
  console.error(`not ok - ${name}${detail ? ` :: ${JSON.stringify(detail).slice(0, 400)}` : ''}`);
};

const request = async (path, { method = 'GET', token, body } = {}) => {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }
  return { status: response.status, payload };
};

const email = `consumer-e2e-${Date.now()}@example.test`;
const password = 'ConsumerE2E!2026';

const register = await request('/api/consumers/register', {
  method: 'POST',
  body: { email, password, firstName: 'Anna', lastName: 'Rossi', acceptedTerms: true, acceptedPrivacy: true }
});
check('consumer registration succeeds', register.status === 200 || register.status === 201, register);

const login = await request('/api/consumers/login', { method: 'POST', body: { email, password } });
check('consumer login returns a token', login.status === 200 && typeof login.payload?.token === 'string', login);
const token = login.payload?.token;

const anonymous = await request('/api/consumers/me/addresses');
check('addresses require the consumer session', anonymous.status === 401, anonymous);

const patched = await request('/api/consumers/me', {
  method: 'PATCH',
  token,
  body: { firstName: 'Annetta', phone: '+39 333 0001111', currency: 'eur', id: 'injected', points: 999999 }
});
check('profile update succeeds', patched.status === 200 && patched.payload?.firstName === 'Annetta', patched);
check('profile update ignores protected fields', patched.payload?.points === 0 && patched.payload?.id !== 'injected', patched.payload);

const emptyProfilePatch = await request('/api/consumers/me', { method: 'PATCH', token, body: { nickname: 'x' } });
check('empty profile patch is rejected', emptyProfilePatch.status === 400 && emptyProfilePatch.payload?.error === 'CONSUMER_PROFILE_PATCH_EMPTY', emptyProfilePatch);

const addressBody = {
  firstName: 'Anna',
  lastName: 'Rossi',
  phone: '+39 333 1234567',
  line1: 'Via Roma 1',
  line2: 'Interno 3',
  city: 'Milano',
  postalCode: '20100',
  country: 'Italy'
};
const createdAddress = await request('/api/consumers/me/addresses', { method: 'POST', token, body: addressBody });
const addressId = createdAddress.payload?.address?.id;
check('address can be created', createdAddress.status === 200 && typeof addressId === 'string', createdAddress);
check('address normalizes composite street and zip', createdAddress.payload?.address?.street === 'Via Roma 1, Interno 3' && createdAddress.payload?.address?.zip === '20100', createdAddress.payload);

const invalidAddress = await request('/api/consumers/me/addresses', { method: 'POST', token, body: { ...addressBody, phone: ' ' } });
check('invalid address is rejected', invalidAddress.status === 400 && invalidAddress.payload?.error === 'CONSUMER_ADDRESS_INVALID', invalidAddress);

const listed = await request('/api/consumers/me/addresses', { token });
check('address list returns the persisted address', listed.status === 200 && listed.payload?.addresses?.length === 1 && listed.payload.addresses[0].id === addressId, listed);

const updatedAddress = await request(`/api/consumers/me/addresses/${addressId}`, {
  method: 'PUT',
  token,
  body: { ...addressBody, city: 'Torino', postalCode: '10100' }
});
check('address can be updated', updatedAddress.status === 200 && updatedAddress.payload?.address?.city === 'Torino', updatedAddress);

const updatedAddressId = updatedAddress.payload?.address?.id;
check('address update keeps the same id', updatedAddressId === addressId, { addressId, updatedAddressId });

const missingAddress = await request('/api/consumers/me/addresses/does-not-exist', {
  method: 'PUT',
  token,
  body: addressBody
});
check('updating an unknown address returns 404', missingAddress.status === 404 && missingAddress.payload?.error === 'CONSUMER_ADDRESS_NOT_FOUND', missingAddress);

const wishlistUnknown = await request('/api/consumers/me/wishlist/product-does-not-exist', { method: 'POST', token });
check('wishlist rejects unavailable products', wishlistUnknown.status === 404 && wishlistUnknown.payload?.error === 'PRODUCT_NOT_AVAILABLE', wishlistUnknown);

const wishlist = await request('/api/consumers/me/wishlist', { token });
check('wishlist is readable and empty', wishlist.status === 200 && Array.isArray(wishlist.payload?.items) && wishlist.payload.items.length === 0, wishlist);

const orders = await request('/api/consumers/me/orders', { token });
check('consumer orders are readable', orders.status === 200 && Array.isArray(orders.payload?.orders) && orders.payload.orders.length === 0, orders);

const retail = await request('/api/retail/products?page=1&limit=24');
check('retail catalogue responds', retail.status === 200 && Array.isArray(retail.payload?.items) && typeof retail.payload?.total === 'number', retail);

const retailDetail = await request('/api/retail/products/does-not-exist');
check('retail product detail returns 404 for unknown product', retailDetail.status === 404, retailDetail);

const quote = await request('/api/promotions/calculate/retail', {
  method: 'POST',
  token,
  body: { items: [{ productId: 'missing-product', sku: 'x', quantity: 1 }] }
});
check('retail quote rejects unavailable products', quote.status === 409 && quote.payload?.error === 'PRODUCT_NOT_AVAILABLE', quote);

const quoteNoSession = await request('/api/promotions/calculate/retail', {
  method: 'POST',
  body: { items: [{ productId: 'missing-product', sku: 'x', quantity: 1 }] }
});
check('retail quote requires the consumer session', quoteNoSession.status === 401, quoteNoSession);

const removed = await request(`/api/consumers/me/addresses/${addressId}`, { method: 'DELETE', token });
check('address can be deleted', removed.status === 200 && removed.payload?.addresses?.length === 0, removed);

if (failures > 0) {
  console.error(`\n${failures} consumer-account check(s) failed.`);
  process.exit(1);
}
console.log('\nall consumer-account checks passed');
