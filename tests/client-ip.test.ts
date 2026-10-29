import assert from 'node:assert/strict';
import test from 'node:test';
import { getClientIp } from '../src/server/clientIp';

test('client IP uses the framework-resolved address instead of a raw forwarded header', () => {
  const request = {
    ip: '203.0.113.8',
    socket: { remoteAddress: '127.0.0.1' },
    headers: { 'x-forwarded-for': '198.51.100.4' }
  };

  assert.equal(getClientIp(request), '203.0.113.8');
});

test('client IP normalizes IPv4-mapped addresses and falls back to the socket address', () => {
  assert.equal(getClientIp({ ip: '::ffff:203.0.113.8', socket: { remoteAddress: '127.0.0.1' } }), '203.0.113.8');
  assert.equal(getClientIp({ socket: { remoteAddress: '::ffff:127.0.0.1' } }), '127.0.0.1');
});