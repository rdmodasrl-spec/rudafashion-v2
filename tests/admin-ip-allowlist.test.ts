import assert from 'node:assert/strict';
import test from 'node:test';
import { parseAdminIpAllowlist, isIpAllowed, isPrivateOrLoopbackIp } from '../src/server/adminIpAllowlist';

test('parseAdminIpAllowlist returns empty for undefined input', () => {
  const list = parseAdminIpAllowlist(undefined);
  assert.equal(list.hasAny, false);
  assert.deepEqual(list.entries, []);
});

test('parseAdminIpAllowlist returns empty for empty string', () => {
  const list = parseAdminIpAllowlist('');
  assert.equal(list.hasAny, false);
});

test('parseAdminIpAllowlist parses plain IPs and CIDR entries', () => {
  const list = parseAdminIpAllowlist('203.0.113.8, 198.51.100.0/24, 192.0.2.1');
  assert.equal(list.hasAny, true);
  assert.equal(list.entries.length, 3);
  assert.equal(list.entries[0].ip, '203.0.113.8');
  assert.equal(list.entries[0].cidr, undefined);
  assert.equal(list.entries[1].ip, '198.51.100.0');
  assert.equal(list.entries[1].cidr, '/24');
  assert.equal(list.entries[2].ip, '192.0.2.1');
});

test('parseAdminIpAllowlist rejects invalid IPs', () => {
  const list = parseAdminIpAllowlist('999.999.999.999, not-an-ip, 203.0.113.8');
  assert.equal(list.hasAny, true);
  assert.equal(list.entries.length, 1);
  assert.equal(list.entries[0].ip, '203.0.113.8');
});

test('isIpAllowed returns false when list is empty (fail-closed)', () => {
  const list = parseAdminIpAllowlist(undefined);
  assert.equal(isIpAllowed('203.0.113.8', list), false);
  assert.equal(isIpAllowed('127.0.0.1', list), false);
});

test('isIpAllowed matches exact IP', () => {
  const list = parseAdminIpAllowlist('203.0.113.8');
  assert.equal(isIpAllowed('203.0.113.8', list), true);
  assert.equal(isIpAllowed('203.0.113.9', list), false);
});

test('isIpAllowed matches CIDR range', () => {
  const list = parseAdminIpAllowlist('198.51.100.0/24');
  assert.equal(isIpAllowed('198.51.100.5', list), true);
  assert.equal(isIpAllowed('198.51.100.255', list), true);
  assert.equal(isIpAllowed('198.51.101.1', list), false);
});

test('isIpAllowed rejects undefined IP', () => {
  const list = parseAdminIpAllowlist('203.0.113.8');
  assert.equal(isIpAllowed(undefined, list), false);
});

test('parseAdminIpAllowlist parses IPv6 addresses and CIDR entries', () => {
  const list = parseAdminIpAllowlist('2001:db8:1::7, 2001:db8:abcd::/48, ::ffff:203.0.113.8');
  assert.equal(list.hasAny, true);
  assert.deepEqual(list.entries, [
    { ip: '2001:db8:1::7' },
    { ip: '2001:db8:abcd::', cidr: '/48' },
    { ip: '203.0.113.8' }
  ]);
});

test('isIpAllowed matches IPv6 exact addresses and CIDR ranges', () => {
  const exact = parseAdminIpAllowlist('2001:db8:1::7');
  assert.equal(isIpAllowed('2001:db8:1::7', exact), true);
  assert.equal(isIpAllowed('2001:db8:1::8', exact), false);
  assert.equal(isIpAllowed('[2001:db8:1::7]', exact), true);

  const range = parseAdminIpAllowlist('2001:db8:abcd::/48');
  assert.equal(isIpAllowed('2001:db8:abcd:1::9', range), true);
  assert.equal(isIpAllowed('2001:db8:abce::9', range), false);
});

test('IPv4-mapped IPv6 clients match an IPv4 allowlist entry', () => {
  const list = parseAdminIpAllowlist('203.0.113.8');
  assert.equal(isIpAllowed('::ffff:203.0.113.8', list), true);
});

test('isPrivateOrLoopbackIp recognises IPv6 loopback and ULA ranges', () => {
  assert.equal(isPrivateOrLoopbackIp('::1'), true);
  assert.equal(isPrivateOrLoopbackIp('fd00::1'), true);
  assert.equal(isPrivateOrLoopbackIp('fe80::1'), true);
  assert.equal(isPrivateOrLoopbackIp('2001:db8::1'), false);
});

test('parseAdminIpAllowlist rejects malformed IPv6 entries', () => {
  const list = parseAdminIpAllowlist('2001:db8::/129, 2001:::1, 2001:db8::1');
  assert.equal(list.hasAny, true);
  assert.deepEqual(list.entries, [{ ip: '2001:db8::1' }]);
});

test('isPrivateOrLoopbackIp recognises loopback and RFC1918 ranges only', () => {
  assert.equal(isPrivateOrLoopbackIp('127.0.0.1'), true);
  assert.equal(isPrivateOrLoopbackIp('10.20.30.40'), true);
  assert.equal(isPrivateOrLoopbackIp('172.16.0.9'), true);
  assert.equal(isPrivateOrLoopbackIp('172.32.0.9'), false);
  assert.equal(isPrivateOrLoopbackIp('192.168.1.7'), true);
  assert.equal(isPrivateOrLoopbackIp('203.0.113.8'), false);
  assert.equal(isPrivateOrLoopbackIp(undefined), false);
});

test('isIpAllowed allows loopback and private clients when private admin IPs are enabled', () => {
  const empty = parseAdminIpAllowlist(undefined);
  assert.equal(isIpAllowed('127.0.0.1', empty, { allowPrivate: true }), true);
  assert.equal(isIpAllowed('192.168.1.20', empty, { allowPrivate: true }), true);
  assert.equal(isIpAllowed('203.0.113.8', empty, { allowPrivate: true }), false);
});

test('isIpAllowed keeps public enforcement when private admin IPs are disabled', () => {
  const list = parseAdminIpAllowlist('203.0.113.8');
  assert.equal(isIpAllowed('127.0.0.1', list), false);
  assert.equal(isIpAllowed('127.0.0.1', list, { allowPrivate: false }), false);
  assert.equal(isIpAllowed('203.0.113.8', list, { allowPrivate: false }), true);
});
