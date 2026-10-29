import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {
  CONSUMER_ADDRESS_LIMIT,
  ConsumerAddressError,
  normalizeConsumerAddressInput,
  parseConsumerAddresses,
  pickConsumerProfilePatch,
  removeConsumerAddress,
  upsertConsumerAddress
} from '../src/server/consumerAccount';

const root = process.cwd();
const serverSource = () => readFileSync(path.join(root, 'server.ts'), 'utf8');

const validAddress = {
  firstName: 'Anna',
  lastName: 'Rossi',
  phone: '+39 333 1234567',
  line1: 'Via Roma 1',
  line2: 'Interno 3',
  province: 'MI',
  city: 'Milano',
  postalCode: '20100',
  country: 'Italy'
};

test('consumer address input accepts the storefront form shape and normalizes composite fields', () => {
  const address = normalizeConsumerAddressInput(validAddress, 'addr-1');
  assert.equal(address.id, 'addr-1');
  assert.equal(address.street, 'Via Roma 1, Interno 3');
  assert.equal(address.zip, '20100');
  assert.equal(address.city, 'Milano');
});

test('consumer address input rejects entries missing required fields', () => {
  assert.throws(
    () => normalizeConsumerAddressInput({ ...validAddress, phone: '   ' }, 'addr-1'),
    (error: unknown) => error instanceof ConsumerAddressError && error.code === 'CONSUMER_ADDRESS_INVALID'
  );
});

test('consumer addresses enforce the storage limit and default-address exclusivity', () => {
  const addresses = Array.from({ length: CONSUMER_ADDRESS_LIMIT }, (_, index) => ({
    id: `addr-${index}`,
    firstName: 'Anna',
    lastName: 'Rossi',
    phone: '1',
    street: 'Via Roma 1',
    city: 'Milano',
    country: 'Italy',
    zip: '20100',
    isDefault: index === 0
  }));
  assert.throws(
    () => upsertConsumerAddress(addresses, { ...addresses[0], id: 'addr-new', isDefault: false }),
    (error: unknown) => error instanceof ConsumerAddressError && error.code === 'CONSUMER_ADDRESS_LIMIT_REACHED'
  );

  const next = upsertConsumerAddress(addresses, { ...addresses[1], isDefault: true });
  assert.equal(next.filter(entry => entry.isDefault).length, 1);
  assert.equal(next.find(entry => entry.isDefault)?.id, 'addr-1');
});

test('consumer address update and removal are id-scoped', () => {
  const addresses = parseConsumerAddresses([
    { id: 'a', firstName: 'A', lastName: 'B', phone: '1', street: 'S', city: 'C', country: 'IT', zip: '1' },
    { id: 'b', firstName: 'A', lastName: 'B', phone: '1', street: 'S', city: 'C', country: 'IT', zip: '1' }
  ]);
  assert.equal(addresses.length, 2);
  assert.equal(removeConsumerAddress(addresses, 'a').map(entry => entry.id).join(','), 'b');
  assert.throws(
    () => removeConsumerAddress(addresses, 'missing'),
    (error: unknown) => error instanceof ConsumerAddressError && error.code === 'CONSUMER_ADDRESS_NOT_FOUND'
  );
  assert.deepEqual(parseConsumerAddresses('not-json'), []);
});

test('consumer profile patch only accepts whitelisted fields with valid values', () => {
  assert.deepEqual(pickConsumerProfilePatch({ firstName: '  Anna ', id: 'hacker', points: 99999 }), { firstName: 'Anna' });
  assert.deepEqual(pickConsumerProfilePatch({ currency: 'eur' }), { currency: 'EUR' });
  assert.deepEqual(pickConsumerProfilePatch({ currency: 'euros' }), {});
  assert.deepEqual(pickConsumerProfilePatch({ phone: '   ' }), { phone: null });
  assert.deepEqual(pickConsumerProfilePatch({ newsletterOptIn: true }), { newsletterOptIn: true });
  assert.deepEqual(pickConsumerProfilePatch(null), {});
});

test('consumer account routes exist and derive identity from the consumer token only', () => {
  const server = serverSource();
  for (const route of [
    "app.patch('/api/consumers/me'",
    "app.get('/api/consumers/me/addresses'",
    "app.post('/api/consumers/me/addresses'",
    "app.put('/api/consumers/me/addresses/:id'",
    "app.delete('/api/consumers/me/addresses/:id'",
    "app.get('/api/consumers/me/wishlist'",
    "app.post('/api/consumers/me/wishlist/:productId'",
    "app.delete('/api/consumers/me/wishlist/:productId'",
    "app.get('/api/consumers/me/orders'",
    "app.post('/api/promotions/calculate/retail'",
    "app.get('/api/retail/products'",
    "app.get('/api/retail/products/:idOrStyleNo'"
  ]) {
    assert.ok(server.includes(route), `missing route: ${route}`);
  }
  assert.match(server, /const resolveConsumerSession = async[\s\S]*?payload\?\.role !== 'consumer'/);
  for (const handler of [
    "app.get('/api/consumers/me/wishlist'",
    "app.get('/api/consumers/me/orders'",
    "app.post('/api/promotions/calculate/retail'"
  ]) {
    const start = server.indexOf(handler);
    const block = server.slice(start, start + 400);
    assert.match(block, /await resolveConsumerSession\(req, res\)/, `${handler} must resolve the consumer session`);
  }
  assert.doesNotMatch(server, /req\.body\??\.consumerId/, 'consumer routes must never trust a client supplied consumerId');
});

test('retail endpoints reuse the shared public product visibility rules', () => {
  const server = serverSource();
  assert.match(server, /const consumerRetailProductWhere = \([\s\S]{0,400}PUBLIC_PRODUCT_VISIBILITY_FILTER/);
  assert.match(server, /const consumerRetailProductWhere = \([\s\S]{0,400}PUBLIC_STOREFRONT_MERCHANT_FILTER/);
  assert.match(server, /const consumerRetailProductWhere = \([\s\S]{0,400}rrpPrice: \{ gt: 0 \}/);
});
