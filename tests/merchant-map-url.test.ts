import assert from 'node:assert/strict';
import test from 'node:test';
import { buildMerchantMapUrl } from '../src/shared/merchantMapUrl';

test('creates a Google Maps driving route for exact coordinates', () => {
  const result = buildMerchantMapUrl({
    name: 'Moda Milano',
    latitude: '45.4642',
    longitude: 9.19
  });
  const url = new URL(result.url);

  assert.equal(url.hostname, 'www.google.com');
  assert.equal(url.pathname, '/maps/dir/');
  assert.equal(url.searchParams.get('destination'), '45.4642,9.19');
  assert.equal(result.hasExactLocation, true);
});

test('creates a Google Maps driving route for a street address', () => {
  const result = buildMerchantMapUrl({
    name: 'Moda Milano',
    streetAddress: 'Via Roma 10',
    city: 'Milano',
    country: 'Italia'
  });
  const url = new URL(result.url);

  assert.equal(url.pathname, '/maps/dir/');
  assert.equal(url.searchParams.get('destination'), 'Via Roma 10, Milano, Italia');
  assert.equal(result.hasExactLocation, true);
});

test('uses Google Maps place search for city-level locations and ignores placeholder addresses', () => {
  const result = buildMerchantMapUrl({
    name: 'Urban Moda Retail',
    streetAddress: 'RUDA Demo District, Turin',
    city: 'Turin',
    country: 'Italia'
  });
  const url = new URL(result.url);

  assert.equal(url.pathname, '/maps/search/');
  assert.equal(url.searchParams.get('query'), 'Turin, Italia');
  assert.equal(result.hasExactLocation, false);
});

test('falls back to merchant-name search when no usable location is available', () => {
  const result = buildMerchantMapUrl({
    name: 'Moda Milano',
    streetAddress: 'Not provided',
    city: 'Unknown',
    country: 'N/A',
    latitude: 120,
    longitude: 200
  });
  const url = new URL(result.url);

  assert.equal(url.pathname, '/maps/search/');
  assert.equal(url.searchParams.get('query'), 'Moda Milano');
  assert.equal(result.hasExactLocation, false);
});
