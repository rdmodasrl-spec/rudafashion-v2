import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {
  getModaUIIndustryChatTemplate,
  merchantTaskErrorCopy,
  resolveCurrentMerchantStudio,
  requestsProcurementDraft,
  shouldUseModaUIIndustryChat
} from '../src/apps/merchant-admin-common/components/merchant/modaui/modauiIndustryChat';

const root = process.cwd();
const read = (relativePath: string) => readFileSync(path.join(root, relativePath), 'utf8');

const nonApparelTemplates = [
  'trading_wholesale',
  'department_wholesale',
  'bags_wholesale',
  'department_chain_retail',
  'general_retail'
] as const;

test('ModaUI routes all five non-apparel templates to the shared industry chat', () => {
  for (const templateId of nonApparelTemplates) {
    assert.equal(shouldUseModaUIIndustryChat(templateId, null), true, templateId);
    assert.equal(getModaUIIndustryChatTemplate(templateId)?.id, templateId);
  }
  assert.equal(shouldUseModaUIIndustryChat('apparel_production_wholesale', null), false);
  assert.equal(shouldUseModaUIIndustryChat('apparel_wholesale', null), false);
  assert.equal(shouldUseModaUIIndustryChat('apparel_wholesale', 'RETAIL_STORE'), false);
  assert.equal(shouldUseModaUIIndustryChat('department_chain_retail', 'FASHION_COMPANY'), true);
});

test('industry AI Studio auto-routes only to the current authorized template', () => {
  const studios = [
    { industryTemplate: 'apparel_production_wholesale', studioCode: 'apparel_studio' },
    { industryTemplate: 'trading_wholesale', studioCode: 'trade_studio' }
  ];

  assert.equal(resolveCurrentMerchantStudio(studios, 'trading_wholesale'), studios[1]);
  assert.equal(resolveCurrentMerchantStudio(studios, 'restaurant_ordering'), null);
  assert.equal(resolveCurrentMerchantStudio(studios, null), null);
  assert.equal(
    resolveCurrentMerchantStudio([studios[0]], null),
    studios[0],
    'legacy single-studio sessions can use the only server-authorized Studio'
  );
});

test('industry prompt mappings remain distinct, including the two department-store templates', () => {
  const departmentWholesale = getModaUIIndustryChatTemplate('department_wholesale');
  const departmentChain = getModaUIIndustryChatTemplate('department_chain_retail');
  assert.notEqual(departmentWholesale?.id, departmentChain?.id);
  assert.notEqual(departmentWholesale?.modauiPrompts?.[0]?.promptZh, departmentChain?.modauiPrompts?.[0]?.promptZh);
  for (const templateId of nonApparelTemplates) {
    assert.ok(getModaUIIndustryChatTemplate(templateId)?.modauiPrompts?.length, `${templateId} needs an industry prompt`);
  }
});

test('procurement prompt detection only recognizes explicit draft/order creation intent', () => {
  assert.equal(requestsProcurementDraft('帮我创建一张采购草稿。'), true);
  assert.equal(requestsProcurementDraft('准备采购订单'), true);
  assert.equal(requestsProcurementDraft('分析供应商供货表现'), false);
  assert.equal(requestsProcurementDraft('查询本月采购金额'), false);
});

test('permission failures describe the requested task without assuming it is procurement', () => {
  assert.equal(merchantTaskErrorCopy(new Error('EMPLOYEE_PERMISSION_REQUIRED'), false), '当前账号没有执行此任务的权限，任务未执行。');
});

test('non-apparel chat keeps task creation protected and hides apparel-only tools', () => {
  const home = read('src/apps/merchant-admin-common/components/merchant/MerchantAiHome.tsx');
  const mini = read('merchant-miniprogram/pages/assistant/index.js');
  const miniMarkup = read('merchant-miniprogram/pages/assistant/index.wxml');
  const entry = read('src/apps/merchant-admin-common/components/merchant/ModaUIEntry.tsx');

  assert.match(entry, /<MerchantAiHome[\s\S]*?industryChatOnly/);
  assert.match(home, /industryChatOnly \? \(/);
  assert.match(home, /!industryChatOnly && modeSheetOpen && fashionMode/);
  assert.match(home, /create_procurement_draft:\s*\{[\s\S]*?supplierId:[\s\S]*?productId:[\s\S]*?variantId:[\s\S]*?quantity:[\s\S]*?unitCost:/);
  assert.match(home, /'\/api\/merchant\/modagpt\/task\/preview'/);
  assert.match(home, /'\/api\/merchant\/modagpt\/task'/);
  assert.match(home, /\/api\/merchant\/modagpt\/task\/\$\{encodeURIComponent\(taskId\)\}/);

  assert.match(mini, /loadIndustryContext\(\{ force: true \}\)/);
  assert.match(mini, /request\('\/api\/merchant\/studios'\)/);
  assert.match(mini, /studio\.industryTemplate === industryContext\.templateId/);
  assert.match(mini, /industryContext\.templateId/);
  assert.match(mini, /\/api\/merchant\/modagpt\/task\/preview/);
  assert.match(mini, /\/api\/merchant\/modagpt\/task'/);
  assert.doesNotMatch(mini, /\/api\/modagpt\/public\/chat/);
  assert.match(miniMarkup, /wx:if="\{\{industryContextLoaded && industryChatOnly\}\}"/);
  assert.match(miniMarkup, /wx:if="\{\{!industryChatOnly\}\}"/);
});
