import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { ADMIN_NAV_GROUPS } from '../src/apps/platform-admin-common/components/admin/adminNavigation';

const mobileAdminSource = readFileSync(
  new URL('../src/apps/platform-admin-mobile/PlatformAdminMobile.tsx', import.meta.url),
  'utf8'
);

test('mobile product review lists only products awaiting review', () => {
  assert.match(mobileAdminSource, /const pendingProducts = products\.filter\(p => p\.lifecycleStatus === 'pending_review'\);/);
  assert.doesNotMatch(mobileAdminSource, /const pendingProducts = products\.filter\(p =>[^;]*visibility === 'private'/);
});

test('mobile product review actions persist approval and rejection through the shared product API', () => {
  const reviewSection = mobileAdminSource.split("{activeTab === 'product_audit' && (")[1]?.split("{activeTab === 'inventory_alert' && (")[0];
  assert.ok(reviewSection, 'mobile product review section exists');
  assert.match(mobileAdminSource, /await updateProduct\(productId, \{ lifecycleStatus \}\)/);
  assert.match(reviewSection, /reviewProduct\(p\.id, 'published'\)/);
  assert.match(reviewSection, /reviewProduct\(p\.id, 'rejected'\)/);
  assert.match(reviewSection, /disabled=\{productReviewSaving\}/);
});

test('mobile order and appointment cards expose the existing persisted status workflows', () => {
  assert.match(mobileAdminSource, /await adminUpdateOrderStatus\(orderId, status\)/);
  assert.match(mobileAdminSource, /const pendingOrders = orders\.filter\(order => nextMobileOrderStatus\[order\.status\] !== undefined\);/);
  assert.match(mobileAdminSource, /pending: 'confirmed'/);
  assert.match(mobileAdminSource, /confirmed: 'picking'/);
  assert.match(mobileAdminSource, /picking: 'shipped'/);
  assert.match(mobileAdminSource, /shipped: 'delivered'/);
  assert.match(mobileAdminSource, /await adminUpdateAppointmentStatus\(appointmentId, status\)/);
  assert.match(mobileAdminSource, /updateMobileAppointmentStatus\(a\.id, 'confirmed'\)/);
  assert.match(mobileAdminSource, /updateMobileAppointmentStatus\(a\.id, 'completed'\)/);
  assert.match(mobileAdminSource, /updateMobileAppointmentStatus\(a\.id, 'no_show'\)/);
  assert.match(mobileAdminSource, /updateMobileAppointmentStatus\(a\.id, 'cancelled'\)/);
});

test('mobile vault approvals and POS sales use existing authenticated server workflows', () => {
  assert.match(mobileAdminSource, /vault_requests: 'vault_requests'/);
  assert.match(mobileAdminSource, /await adminReviewVaultRequest\(requestId, status\)/);
  assert.match(mobileAdminSource, /reviewMobileVaultRequest\(request\.id, 'approved'\)/);
  assert.match(mobileAdminSource, /reviewMobileVaultRequest\(request\.id, 'rejected'\)/);
  assert.match(mobileAdminSource, /pos: 'pos'/);
  assert.ok(mobileAdminSource.includes("apiPost<{ success: true; product: Product }>('/api/admin/inventory/pos-sale'"));
  assert.match(mobileAdminSource, /location: 'central'/);
  assert.match(mobileAdminSource, /referenceId/);
});

test('every platform admin route is native on mobile or is explicitly tracked as a desktop handoff', () => {
  const tabMap = mobileAdminSource.match(/const tabs: Partial<Record<AdminTab, MobileAdminTab>> = \{([\s\S]*?)\n  \};/)?.[1];
  assert.ok(tabMap, 'mobile route map exists');
  const mobileTabs = new Set(Array.from(tabMap.matchAll(/^\s+([a-z_]+):/gm), match => match[1]));
  const visibleTabs = ADMIN_NAV_GROUPS.flatMap(group => group.items.map(item => item.key));
  const desktopHandoffs = visibleTabs.filter(tab => !mobileTabs.has(tab));
  assert.deepEqual(desktopHandoffs, ['account_identities', 'ai_support']);
});
