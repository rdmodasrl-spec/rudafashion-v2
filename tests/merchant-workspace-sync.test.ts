import assert from 'node:assert/strict';
import test from 'node:test';
import { mergePublicMerchantsPreservingWorkspace } from '../src/shared/merchantWorkspaceSync.js';

type MerchantRow = {
  id: string;
  name: string;
  workspace?: { templateId: string };
  industryTemplate?: string;
  industryTemplateSource?: string;
  registrationProfile?: { categories: string[] };
};

const sessionMerchant: MerchantRow = {
  id: 'demo-industry-bags-wholesale',
  name: 'DEMO · 箱包批发商',
  workspace: { templateId: 'bags_wholesale' },
  industryTemplate: 'bags_wholesale',
  industryTemplateSource: 'ADMIN',
  registrationProfile: { categories: ['BAGS'] }
};
const publicMerchantWithoutWorkspace: MerchantRow = { id: 'demo-industry-bags-wholesale', name: 'DEMO · 箱包批发商' };
const otherMerchant: MerchantRow = { id: 'merchant-x', name: 'Another Shop' };

test('public catalog refresh keeps an already known workspace snapshot', () => {
  const merged = mergePublicMerchantsPreservingWorkspace(
    [publicMerchantWithoutWorkspace, otherMerchant],
    [sessionMerchant]
  );
  const sessionRow = merged.find(merchant => merchant.id === sessionMerchant.id);
  assert.equal(sessionRow?.workspace?.templateId, 'bags_wholesale');
  assert.equal(sessionRow?.industryTemplate, 'bags_wholesale');
  assert.equal(sessionRow?.industryTemplateSource, 'ADMIN');
  assert.deepEqual(sessionRow?.registrationProfile, { categories: ['BAGS'] });
  assert.equal(merged.filter(merchant => merchant.id === sessionMerchant.id).length, 1);
  assert.deepEqual(merged.find(merchant => merchant.id === otherMerchant.id), otherMerchant);
});

test('signed-in merchant survives a public list that does not include it', () => {
  const merged = mergePublicMerchantsPreservingWorkspace([otherMerchant], [sessionMerchant]);
  assert.equal(merged.length, 2);
  assert.equal(merged[1].workspace?.templateId, 'bags_wholesale');
});

test('the result does not depend on which request resolves first', () => {
  const afterSession = mergePublicMerchantsPreservingWorkspace(
    [publicMerchantWithoutWorkspace, otherMerchant],
    [sessionMerchant, otherMerchant]
  );
  const afterCatalogFirst = mergePublicMerchantsPreservingWorkspace(
    [publicMerchantWithoutWorkspace, otherMerchant],
    [sessionMerchant]
  );
  assert.deepEqual(afterSession, afterCatalogFirst);
});

test('guest visitors keep the public merchant list untouched', () => {
  const merged = mergePublicMerchantsPreservingWorkspace([publicMerchantWithoutWorkspace, otherMerchant], []);
  assert.deepEqual(merged, [publicMerchantWithoutWorkspace, otherMerchant]);
});

test('merchants without workspace state are not fabricated', () => {
  const plain: MerchantRow = { id: 'merchant-plain', name: 'Plain Shop' };
  const merged = mergePublicMerchantsPreservingWorkspace([otherMerchant], [plain]);
  const row = merged.find(merchant => merchant.id === plain.id);
  assert.equal(row, undefined);
  assert.equal(merged.length, 1);
});
