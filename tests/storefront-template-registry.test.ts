import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ALL_STRUCTURAL_TEMPLATES,
  STOREFRONT_INDUSTRY_GROUPS,
  getStorefrontTemplateOptionsForIndustry,
  isStorefrontTemplateAllowedForIndustry
} from '../src/shared/storefrontTemplates/registry';
import { STOREFRONT_TEMPLATE_COMPONENTS } from '../src/apps/shared/components/storefront/templateComponents';

test('seven industries each register three distinct storefront templates', () => {
  assert.equal(STOREFRONT_INDUSTRY_GROUPS.length, 7);
  assert.ok(STOREFRONT_INDUSTRY_GROUPS.every(group => group.templates.length === 3));
  assert.equal(ALL_STRUCTURAL_TEMPLATES.length, 21);
  assert.equal(new Set(ALL_STRUCTURAL_TEMPLATES.map(template => template.id)).size, 21);
});

test('every structural template resolves to a production-capable component', () => {
  assert.deepEqual(
    Object.keys(STOREFRONT_TEMPLATE_COMPONENTS).sort(),
    ALL_STRUCTURAL_TEMPLATES.map(template => template.id).sort()
  );
});

test('industry assignment only accepts templates registered to that industry', () => {
  for (const group of STOREFRONT_INDUSTRY_GROUPS) {
    for (const template of group.templates) {
      assert.equal(isStorefrontTemplateAllowedForIndustry(template.id, group.industry), true);
      const otherGroup = STOREFRONT_INDUSTRY_GROUPS.find(candidate => candidate.industry !== group.industry);
      assert.ok(otherGroup);
      assert.equal(isStorefrontTemplateAllowedForIndustry(template.id, otherGroup.industry), false);
    }
  }
});

test('industry options preserve a currently selected legacy template without offering other industries', () => {
  const options = getStorefrontTemplateOptionsForIndustry('bags_wholesale', 'luxury_black_gold');
  assert.deepEqual(
    options.map(template => template.id),
    ['bags_editorial', 'bags_catalogue', 'bags_wholesale', 'luxury_black_gold']
  );
  assert.deepEqual(
    getStorefrontTemplateOptionsForIndustry('bags_wholesale').map(template => template.id),
    ['bags_editorial', 'bags_catalogue', 'bags_wholesale']
  );
});
