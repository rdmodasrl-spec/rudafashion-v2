/**
 * 商家小程序行业工作台配置契约测试（不依赖小程序运行时）。
 *
 * 目的：保证七种行业都有独立配置模块，且配置只描述界面编排，
 * 不允许出现服务端能力清单之外的模块动作，避免小程序自建行业能力。
 */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import { merchantIndustryCapabilities } from '../src/constants/merchantIndustryCapabilities';
import { merchantIndustryTemplates } from '../src/constants/merchantIndustryTemplates';

const require = createRequire(import.meta.url);
const industry = require('../merchant-miniprogram/utils/industry.js');

const templateIds = merchantIndustryTemplates
  .filter(template => template.status === 'open')
  .map(template => template.id);

test('every open industry template ships its own mini-program config module', () => {
  assert.equal(templateIds.length, 7, 'seven open industry templates are expected');
  assert.deepEqual(
    Object.keys(industry.INDUSTRY_CONFIGS).sort(),
    [...templateIds].sort(),
    'mini-program industry registry must cover exactly the open templates'
  );
  for (const templateId of templateIds) {
    const config = industry.INDUSTRY_CONFIGS[templateId];
    assert.equal(config.templateId, templateId, `${templateId} config must declare its own template id`);
    assert.ok(String(config.title || '').length > 0, `${templateId} config needs a title`);
    assert.ok(String(config.summary || '').length > 0, `${templateId} config needs a summary`);
    assert.ok(String(config.inventoryNote || '').length > 0, `${templateId} config needs an inventory rule note`);
    assert.ok(String(config.orderNote || '').length > 0, `${templateId} config needs an order rule note`);
  }
});

test('industry config actions and metrics stay inside the server capability', () => {
  for (const templateId of templateIds) {
    const config = industry.INDUSTRY_CONFIGS[templateId];
    const capability = merchantIndustryCapabilities[templateId];
    assert.ok(capability, `${templateId} capability must exist`);
    const moduleSet = new Set<string>(capability.modules as readonly string[]);
    const fieldKeys = new Set<string>(capability.productFields.map(field => field.key));

    assert.ok(config.metrics.length >= 3, `${templateId} needs at least three workbench metrics`);
    for (const metric of config.metrics) {
      assert.ok(String(metric.key || '').length > 0, `${templateId} metric needs a key`);
      assert.ok(String(metric.label || '').length > 0, `${templateId} metric needs a label`);
    }

    assert.ok(config.actions.length >= 3, `${templateId} needs at least three workbench actions`);
    const actionIds = new Set<string>();
    for (const action of config.actions) {
      assert.ok(String(action.id || '').length > 0, `${templateId} action needs an id`);
      assert.ok(!actionIds.has(action.id), `${templateId} action id ${action.id} must be unique`);
      actionIds.add(action.id);
      assert.ok(['tab', 'page', 'workspace'].includes(action.target.type), `${templateId} action ${action.id} target type invalid`);
      if (action.target.type === 'workspace') {
        assert.ok(String(action.target.module || '').length > 0, `${templateId} workspace action needs a module`);
      } else {
        assert.ok(String(action.target.url || '').startsWith('/pages/'), `${templateId} action ${action.id} needs a page url`);
      }
      if (action.module) {
        assert.ok(moduleSet.has(action.module), `${templateId} action ${action.id} uses module outside capability: ${action.module}`);
      }
    }

    for (const key of config.productFieldKeys) {
      assert.ok(fieldKeys.has(key), `${templateId} productFieldKeys entry ${key} is not part of the capability`);
    }
  }
});


test('industry helpers gate actions by module and employee permission', () => {
  const context = {
    templateId: 'general_retail',
    modules: ['dashboard', 'pos', 'products', 'orders'],
    productFields: [
      { key: 'barcode', label: '条码', type: 'text' },
      { key: 'category', label: '零售品类', type: 'select' },
      { key: 'description', label: '描述', type: 'textarea' }
    ],
    permissions: [],
    employeeId: null
  };
  const config = industry.getIndustryConfig(context);
  assert.ok(config, 'known template resolves its config');
  assert.equal(industry.getIndustryConfig({ templateId: 'unknown_template' }), null, 'unknown template must fail closed');

  // 商家本人：模块内动作全部可用，模块外动作被过滤。
  const ownerActions = industry.availableActions(config, context);
  assert.ok(ownerActions.length > 0);
  assert.ok(ownerActions.every((action: any) => !action.module || context.modules.includes(action.module)));

  // 员工无权限：权限受控动作必须被过滤。
  const employeeContext = Object.assign({}, context, { employeeId: 'emp-1', permissions: [] });
  const employeeActions = industry.availableActions(config, employeeContext);
  assert.ok(employeeActions.every((action: any) => !action.permission), 'employee without permission must not see permission-gated actions');
  const allowedContext = Object.assign({}, context, { employeeId: 'emp-1', permissions: ['product.publish'] });
  const allowedActions = industry.availableActions(config, allowedContext);
  assert.ok(allowedActions.some((action: any) => action.id === 'create-product'), 'employee with product.publish sees the create action');

  const cards = industry.metricCards(config, { todaySales: 12.5, totalOrders: 3 });
  assert.equal(cards.length, config.metrics.length);
  assert.equal(cards[0].value, '12.5');
  assert.equal(cards[0].suffix, '€');

  const summary = industry.productFieldSummary(context, Object.assign({}, config, { productFieldKeys: ['barcode'] }));
  assert.deepEqual(summary[0], { key: 'barcode', label: '条码' });
  assert.ok(summary.some((item: any) => item.key === 'category'));
});

test('parseIndustryAttributes tolerates stored JSON, objects and broken values', () => {
  assert.deepEqual(industry.parseIndustryAttributes('{"spec":"500g"}'), { spec: '500g' });
  assert.deepEqual(industry.parseIndustryAttributes({ unit: '箱' }), { unit: '箱' });
  assert.deepEqual(industry.parseIndustryAttributes('not-json'), {});
  assert.deepEqual(industry.parseIndustryAttributes('[1,2]'), {});
  assert.deepEqual(industry.parseIndustryAttributes(null), {});
});
