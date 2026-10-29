import test from 'node:test';
import assert from 'node:assert/strict';
import {
  answerWithProductCatalog,
  generateProductContentDraft,
  parseAiTeamDelegation,
  parseProductCatalogSearchPlan,
  planAiTeamDelegation,
  planProductCatalogSearch
} from '../src/server/aiEmployeeRuntime';
import {
  canMerchantHireAiEmployee,
  canUseAiEmployeeCreativeGeneration,
  canUseAiEmployeeInventory,
  canUseAiEmployeeProductImport,
  canUseAiEmployeeProductCatalog,
  canUseAiEmployeeSalesSummary,
  areAiEmployeePermissionsSupportedForSlug,
  getProductContentUpdateFields,
  parseAiEmployeeContentDraftReview,
  parseAiEmployeePermissions,
  parseAiEmployeeUpdate,
  parseProductCatalogSearchQuery,
  productCatalogReadPermission,
  productCreativeGeneratePermission,
  inventoryStockReadPermission,
  salesSummaryReadPermission
} from '../src/server/aiEmployeeRegistry';
import { parseAiEmployeeMemoryInput, serializeAiEmployeeMemories } from '../src/server/aiEmployeeMemory';

test('merchant AI memory accepts only bounded, categorized content', () => {
  assert.deepEqual(parseAiEmployeeMemoryInput({
    category: 'brand_voice',
    content: '  Use concise product copy.  '
  }), {
    category: 'brand_voice',
    content: 'Use concise product copy.'
  });
  assert.equal(parseAiEmployeeMemoryInput({ category: 'unknown', content: 'Note' }), null);
  assert.equal(parseAiEmployeeMemoryInput({ category: 'preference', content: 'x'.repeat(501) }), null);
  assert.equal(parseAiEmployeeMemoryInput({ category: 'operating_rule', content: 'bad\u0001value' }), null);
  assert.equal(parseAiEmployeeMemoryInput({ category: 'preference', content: '', extra: true }), null);
  assert.deepEqual(serializeAiEmployeeMemories([
    { category: 'brand_voice', content: 'Friendly voice' },
    { category: 'unknown', content: 'must not be used' }
  ]), ['[brand_voice] Friendly voice']);
});

test('accepts only supported AI employee catalog updates', () => {
  assert.deepEqual(parseAiEmployeeUpdate({
    description: ' Product operations assistant ',
    status: 'available',
    version: '1.2.0-beta.1'
  }), {
    description: 'Product operations assistant',
    status: 'available',
    version: '1.2.0-beta.1'
  });
});

test('rejects empty, malformed, and unsupported AI employee updates', () => {
  assert.equal(parseAiEmployeeUpdate(null), null);
  assert.equal(parseAiEmployeeUpdate([]), null);
  assert.equal(parseAiEmployeeUpdate({}), null);
  assert.equal(parseAiEmployeeUpdate({ status: 'published' }), null);
  assert.equal(parseAiEmployeeUpdate({ version: 'latest' }), null);
  assert.equal(parseAiEmployeeUpdate({ version: '1.'.padEnd(33, '0') }), null);
  assert.equal(parseAiEmployeeUpdate({ description: '   ' }), null);
  assert.equal(parseAiEmployeeUpdate({ status: 'pilot', tools: ['product.publish'] }), null);
});

test('only platform-published employees can be hired by merchants', () => {
  assert.equal(canMerchantHireAiEmployee('available', 'product-manager'), true);
  assert.equal(canMerchantHireAiEmployee('available', 'sales-manager'), true);
  assert.equal(canMerchantHireAiEmployee('available', 'designer'), false);
  assert.equal(canMerchantHireAiEmployee('pilot', 'product-manager'), false);
  assert.equal(canMerchantHireAiEmployee('planned', 'product-manager'), false);
  assert.equal(canMerchantHireAiEmployee('paused', 'product-manager'), false);
});

test('merchant consent can grant only the product catalog read permission', () => {
  assert.deepEqual(parseAiEmployeePermissions([productCatalogReadPermission]), [productCatalogReadPermission]);
  assert.deepEqual(parseAiEmployeePermissions([productCatalogReadPermission, 'product.import.draft']), [productCatalogReadPermission, 'product.import.draft']);
  assert.deepEqual(parseAiEmployeePermissions([]), []);
  assert.deepEqual(parseAiEmployeePermissions([productCatalogReadPermission, productCatalogReadPermission]), [productCatalogReadPermission]);
  assert.equal(parseAiEmployeePermissions(['product.update']), null);
  assert.equal(parseAiEmployeePermissions('product.catalog.read'), null);
});

test('supplier import requires an available active Product Manager and explicit merchant consent', () => {
  const allowed = {
    employeeSlug: 'product-manager',
    employeeStatus: 'available',
    installationStatus: 'active',
    grantedPermissions: ['product.import.draft']
  };
  assert.equal(canUseAiEmployeeProductImport(allowed), true);
  assert.equal(canUseAiEmployeeProductImport({ ...allowed, employeeSlug: 'designer' }), false);
  assert.equal(canUseAiEmployeeProductImport({ ...allowed, employeeStatus: 'paused' }), false);
  assert.equal(canUseAiEmployeeProductImport({ ...allowed, installationStatus: 'paused' }), false);
  assert.equal(canUseAiEmployeeProductImport({ ...allowed, grantedPermissions: [] }), false);
});

test('creative generation requires its own merchant consent and an available active Product Manager', () => {
  const allowed = {
    employeeSlug: 'product-manager',
    employeeStatus: 'available',
    installationStatus: 'active',
    grantedPermissions: [productCreativeGeneratePermission]
  };
  assert.deepEqual(parseAiEmployeePermissions(allowed.grantedPermissions), [productCreativeGeneratePermission]);
  assert.equal(canUseAiEmployeeCreativeGeneration(allowed), true);
  assert.equal(canUseAiEmployeeCreativeGeneration({ ...allowed, employeeSlug: 'designer' }), false);
  assert.equal(canUseAiEmployeeCreativeGeneration({ ...allowed, employeeStatus: 'paused' }), false);
  assert.equal(canUseAiEmployeeCreativeGeneration({ ...allowed, installationStatus: 'paused' }), false);
  assert.equal(canUseAiEmployeeCreativeGeneration({ ...allowed, grantedPermissions: [] }), false);
});

test('inventory access requires separate consent for an available active Inventory Manager', () => {
  const allowed = {
    employeeSlug: 'inventory-manager',
    employeeStatus: 'available',
    installationStatus: 'active',
    grantedPermissions: [inventoryStockReadPermission]
  };
  assert.deepEqual(parseAiEmployeePermissions(allowed.grantedPermissions), [inventoryStockReadPermission]);
  assert.equal(canUseAiEmployeeInventory(allowed), true);
  assert.equal(canUseAiEmployeeInventory({ ...allowed, employeeSlug: 'product-manager' }), false);
  assert.equal(canUseAiEmployeeInventory({ ...allowed, employeeStatus: 'paused' }), false);
  assert.equal(canUseAiEmployeeInventory({ ...allowed, installationStatus: 'paused' }), false);
  assert.equal(canUseAiEmployeeInventory({ ...allowed, grantedPermissions: [] }), false);
});

test('product catalog tool requires an available, active Product Manager and merchant consent', () => {
  const allowed = {
    employeeSlug: 'product-manager',
    employeeStatus: 'available',
    installationStatus: 'active',
    grantedPermissions: [productCatalogReadPermission]
  };
  assert.equal(canUseAiEmployeeProductCatalog(allowed), true);
  assert.equal(canUseAiEmployeeProductCatalog({ ...allowed, employeeSlug: 'store-manager' }), false);
  assert.equal(canUseAiEmployeeProductCatalog({ ...allowed, employeeStatus: 'paused' }), false);
  assert.equal(canUseAiEmployeeProductCatalog({ ...allowed, installationStatus: 'paused' }), false);
  assert.equal(canUseAiEmployeeProductCatalog({ ...allowed, grantedPermissions: [] }), false);
});

test('product catalog search accepts bounded plain text only', () => {
  assert.equal(parseProductCatalogSearchQuery(undefined), '');
  assert.equal(parseProductCatalogSearchQuery('  jacket  '), 'jacket');
  assert.equal(parseProductCatalogSearchQuery('x'.repeat(101)), null);
  assert.equal(parseProductCatalogSearchQuery(['jacket']), null);
});

test('content draft review accepts only bounded explicit apply or reject actions', () => {
  assert.deepEqual(parseAiEmployeeContentDraftReview({
    action: 'apply',
    title: '  New title ',
    description: ' Updated description '
  }), {
    action: 'apply',
    title: 'New title',
    description: 'Updated description'
  });
  assert.deepEqual(parseAiEmployeeContentDraftReview({ action: 'reject' }), { action: 'reject' });
  assert.equal(parseAiEmployeeContentDraftReview({ action: 'apply', title: '', description: 'valid' }), null);
  assert.equal(parseAiEmployeeContentDraftReview({ action: 'apply', title: 'x'.repeat(121), description: 'valid' }), null);
  assert.equal(parseAiEmployeeContentDraftReview({ action: 'reject', description: 'unexpected' }), null);
  assert.equal(parseAiEmployeeContentDraftReview({ action: 'apply', title: 'x', description: 'y', productId: 'other' }), null);
});

test('approved content updates only the selected language fields', () => {
  assert.deepEqual(getProductContentUpdateFields('zh', '中文标题', '中文描述'), {
    name_zh: '中文标题',
    description_zh: '中文描述'
  });
  assert.deepEqual(getProductContentUpdateFields('it', 'Titolo', 'Descrizione'), {
    name_it: 'Titolo',
    description_it: 'Descrizione'
  });
  assert.deepEqual(getProductContentUpdateFields('en', 'Title', 'Description'), {
    name: 'Title',
    description: 'Description'
  });
});

test('AI employee search planning accepts only the fixed catalog tool and bounded query', () => {
  assert.deepEqual(parseProductCatalogSearchPlan('{"tool":"search_products","search":"red dress"}'), {
    tool: 'search_products',
    search: 'red dress'
  });
  assert.throws(() => parseProductCatalogSearchPlan('{"tool":"delete_product","search":"dress"}'), /AI_EMPLOYEE_SEARCH_PLAN_INVALID/);
  assert.deepEqual(parseProductCatalogSearchPlan('{"tool":"search_products","search":""}'), { tool: 'search_products', search: '' });
  assert.throws(() => parseProductCatalogSearchPlan(JSON.stringify({ tool: 'search_products', search: 'x'.repeat(101) })), /AI_EMPLOYEE_SEARCH_PLAN_INVALID/);
  assert.throws(() => parseProductCatalogSearchPlan('{"tool":"search_products","search":"dress","merchantId":"other"}'), /AI_EMPLOYEE_SEARCH_PLAN_INVALID/);
});

test('AI employee search planning sends the untrusted request only to the fixed planner', async () => {
  const plan = await planProductCatalogSearch('Trova abiti rossi', async (prompt, system, schema) => {
    assert.match(prompt, /Trova abiti rossi/);
    assert.match(system, /只读工具规划器/);
    assert.deepEqual(schema.required, ['tool', 'search']);
    return '{"tool":"search_products","search":"abiti rossi"}';
  });
  assert.deepEqual(plan, { tool: 'search_products', search: 'abiti rossi' });
});

test('AI team manager delegates only supported catalog tasks to an available employee', async () => {
  const delegation = await planAiTeamDelegation(
    'Find linen shirts from brand Ruda',
    ['product-manager'],
    async (prompt, system, schema) => {
      assert.match(prompt, /Find linen shirts/);
      assert.match(system, /product-manager：只读查询当前商家的商品名称/);
      assert.deepEqual(schema.required, ['workerSlug', 'taskType', 'task']);
      return '{"workerSlug":"product-manager","taskType":"product_search","task":"linen shirts from Ruda"}';
    }
  );
  assert.deepEqual(delegation, { workerSlug: 'product-manager', taskType: 'product_search', task: 'linen shirts from Ruda' });
  assert.deepEqual(await planAiTeamDelegation('search products', []), { workerSlug: null, taskType: null, task: '' });
  assert.deepEqual(parseAiTeamDelegation('{"workerSlug":null,"taskType":null,"task":""}', ['product-manager']), {
    workerSlug: null,
    taskType: null,
    task: ''
  });
  assert.throws(
    () => parseAiTeamDelegation('{"workerSlug":"marketing-manager","taskType":"sales_summary","task":"launch campaign"}', ['product-manager']),
    /AI_EMPLOYEE_TEAM_PLAN_INVALID/
  );
  assert.throws(
    () => parseAiTeamDelegation('{"workerSlug":"product-manager","taskType":"product_search","task":"search","merchantId":"other"}', ['product-manager']),
    /AI_EMPLOYEE_TEAM_PLAN_INVALID/
  );
  assert.throws(
    () => parseAiTeamDelegation('{"workerSlug":"product-manager","taskType":"product_search","task":"search"}', []),
    /AI_EMPLOYEE_TEAM_PLAN_INVALID/
  );
});

test('AI team manager delegates inventory requests only to an authorized inventory employee', async () => {
  const delegation = await planAiTeamDelegation(
    'How many units of SKU-01 are available?',
    ['product-manager', 'inventory-manager'],
    async (prompt, system, schema) => {
      assert.match(prompt, /How many units of SKU-01/);
      assert.match(system, /inventory-manager：只读查询当前商家的库存/);
      assert.match(system, /商品目录查询只能交给 product-manager，库存和补货任务只能交给 inventory-manager/);
      assert.deepEqual(schema.properties.workerSlug, {
        type: ['string', 'null'],
        enum: ['product-manager', 'inventory-manager', 'sales-manager', null]
      });
      return '{"workerSlug":"inventory-manager","taskType":"inventory_search","task":"SKU-01 available quantity"}';
    }
  );
  assert.deepEqual(delegation, { workerSlug: 'inventory-manager', taskType: 'inventory_search', task: 'SKU-01 available quantity' });
  await assert.rejects(
    planAiTeamDelegation('search products', ['inventory-manager'], async () =>
      '{"workerSlug":"product-manager","taskType":"product_search","task":"shirt"}'
    ),
    /AI_EMPLOYEE_TEAM_PLAN_INVALID/
  );
  await assert.rejects(
    planAiTeamDelegation('check stock', ['product-manager'], async () =>
      '{"workerSlug":"inventory-manager","taskType":"inventory_search","task":"SKU-01"}'
    ),
    /AI_EMPLOYEE_TEAM_PLAN_INVALID/
  );
  assert.throws(
    () => parseAiTeamDelegation('{"workerSlug":"inventory-manager","taskType":"inventory_search","task":"search stock"}', []),
    /AI_EMPLOYEE_TEAM_PLAN_INVALID/
  );
});

test('sales summaries require explicit permission for an available Sales Manager', () => {
  const permissions = [salesSummaryReadPermission];
  assert.deepEqual(parseAiEmployeePermissions(permissions), permissions);
  assert.equal(canUseAiEmployeeSalesSummary({
    employeeSlug: 'sales-manager',
    employeeStatus: 'available',
    installationStatus: 'active',
    grantedPermissions: permissions
  }), true);
  assert.equal(canUseAiEmployeeSalesSummary({
    employeeSlug: 'sales-manager',
    employeeStatus: 'available',
    installationStatus: 'active',
    grantedPermissions: [inventoryStockReadPermission]
  }), false);
  assert.equal(canUseAiEmployeeSalesSummary({
    employeeSlug: 'inventory-manager',
    employeeStatus: 'paused',
    installationStatus: 'active',
    grantedPermissions: permissions
  }), false);
  assert.equal(areAiEmployeePermissionsSupportedForSlug('inventory-manager', [
    inventoryStockReadPermission,
    salesSummaryReadPermission
  ]), true);
  assert.equal(areAiEmployeePermissionsSupportedForSlug('sales-manager', [inventoryStockReadPermission]), false);
});

test('team delegation supports authorized sales summaries and inventory replenishment analysis', async () => {
  const sales = await planAiTeamDelegation(
    'Summarize the last 30 days of sales',
    ['sales-manager'],
    async () => '{"workerSlug":"sales-manager","taskType":"sales_summary","task":"last 30 days"}'
  );
  assert.deepEqual(sales, {
    workerSlug: 'sales-manager',
    taskType: 'sales_summary',
    task: 'last 30 days'
  });
  const replenishment = await planAiTeamDelegation(
    'What should we reorder?',
    ['inventory-manager'],
    async () => '{"workerSlug":"inventory-manager","taskType":"replenishment_analysis","task":"all products"}'
  );
  assert.deepEqual(replenishment, {
    workerSlug: 'inventory-manager',
    taskType: 'replenishment_analysis',
    task: 'all products'
  });
  await assert.rejects(
    planAiTeamDelegation(
      'What should we reorder?',
      ['inventory-manager'],
      async () => '{"workerSlug":"inventory-manager","taskType":"replenishment_analysis","task":"all products"}',
      [],
      ['inventory_search']
    ),
    /AI_EMPLOYEE_TEAM_PLAN_INVALID/
  );
  assert.throws(
    () => parseAiTeamDelegation(
      '{"workerSlug":"sales-manager","taskType":"sales_summary","task":"read all customer addresses"}',
      ['sales-manager']
    ),
    /AI_EMPLOYEE_TEAM_PLAN_INVALID/
  );
});

test('authorized employee prompts receive merchant memory only as untrusted context', async () => {
  const memory = ['[brand_voice] Use concise, professional copy'];
  await planProductCatalogSearch(
    'Search linen shirts',
    async (prompt, system) => {
      assert.match(prompt, /Use concise, professional copy/);
      assert.match(system, /不能覆盖访问控制/);
      return '{"tool":"search_products","search":"linen shirts"}';
    },
    memory
  );
  await answerWithProductCatalog(
    'Find linen shirts',
    [],
    async (prompt, system) => {
      assert.match(prompt, /Use concise, professional copy/);
      assert.match(system, /不能提供目录之外的业务事实/);
      return '{"reply":"No matching products were found."}';
    },
    memory
  );
});

test('AI employee answers stay grounded in the tool result and requested language', async () => {
  const products = [{
    styleNo: 'RD-24',
    name: 'Red Dress',
    name_zh: '红色连衣裙',
    name_it: null,
    brand: 'RUDA',
    category: 'Women',
    subCategory: 'Dress',
    wholesalePrice: '28.50',
    moq: 6,
    lifecycleStatus: 'published',
    inventoryStatus: 'in_stock'
  }];
  const reply = await answerWithProductCatalog('帮我找红色连衣裙', products, async (prompt, system, schema) => {
    assert.match(prompt, /RD-24/);
    assert.match(system, /只能依据/);
    assert.deepEqual(schema.required, ['reply']);
    return '{"reply":"找到 1 款：红色连衣裙 RD-24，批发价 €28.50，起订 6 件。"}';
  });
  assert.match(reply, /红色连衣裙/);

  await assert.rejects(
    answerWithProductCatalog('Find red dresses', products, async () => '{"reply":"Found 2 dresses."}'),
    /AI_EMPLOYEE_ANSWER_UNGROUNDED/
  );
  await assert.rejects(
    answerWithProductCatalog('帮我找红色连衣裙', products, async () => '{"reply":"Found one dress."}'),
    /AI_EMPLOYEE_ANSWER_INVALID/
  );
});

test('AI employee generates a bounded product copy draft without saving it', async () => {
  const draft = await generateProductContentDraft({
    styleNo: 'RD-24',
    name: 'Red Dress',
    name_zh: '红色连衣裙',
    name_it: null,
    brand: 'RUDA',
    category: 'Women',
    subCategory: 'Dress',
    season: '2026 SS',
    fabric: 'Cotton',
    description: 'Red cotton dress.',
    wholesalePrice: '28.50',
    moq: 6,
    lifecycleStatus: 'published',
    inventoryStatus: 'in_stock'
  }, 'zh', async (prompt, system, schema) => {
    assert.match(prompt, /RD-24/);
    assert.match(system, /不得加入未提供的面料/);
    assert.deepEqual(schema.required, ['title', 'description']);
    return JSON.stringify({ title: 'RUDA 红色棉质连衣裙', description: '红色棉质连衣裙，适合日常搭配。' });
  });
  assert.equal(draft.title, 'RUDA 红色棉质连衣裙');
  assert.equal(draft.description, '红色棉质连衣裙，适合日常搭配。');

  await assert.rejects(
    generateProductContentDraft({
      styleNo: 'RD-24',
      name: 'Red Dress',
      name_zh: '红色连衣裙',
      name_it: null,
      brand: 'RUDA',
      category: 'Women',
      subCategory: 'Dress',
      season: '2026 SS',
      fabric: 'Cotton',
      description: '',
      wholesalePrice: '28.50',
      moq: 6,
      lifecycleStatus: 'published',
      inventoryStatus: 'in_stock'
    }, 'zh', async () => '{"title":"年度销量第1红裙","description":"销量第1，保证热销。"}'),
    /AI_EMPLOYEE_CONTENT_DRAFT_UNGROUNDED/
  );
});
