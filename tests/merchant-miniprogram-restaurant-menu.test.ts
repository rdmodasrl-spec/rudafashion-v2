import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import test from 'node:test';

const miniRoot = new URL('../merchant-miniprogram/', import.meta.url);
const source = readFileSync(new URL('pages/restaurant-menu/index.js', miniRoot), 'utf8');
const markup = readFileSync(new URL('pages/restaurant-menu/index.wxml', miniRoot), 'utf8');
const app = JSON.parse(readFileSync(new URL('app.json', miniRoot), 'utf8'));

function createPage(options: {
  templateId?: string;
  modules?: string[];
  employeeId?: string | null;
  permissions?: string[];
} = {}) {
  let definition: Record<string, any> | undefined;
  const calls: Array<{ path: string; options: Record<string, any> }> = [];
  const context = {
    templateId: options.templateId ?? 'restaurant_ordering',
    modules: options.modules ?? ['restaurant_menu'],
    employeeId: options.employeeId ?? null,
    permissions: options.permissions ?? []
  };
  let dishes = [{ id: 'dish-1', name: '番茄意面', category: '主食', description: '', status: 'draft' }];
  let ingredients: Array<Record<string, any>> = [];
  let recipes: Array<Record<string, any>> = [];
  const suppliers = [{ id: 'supplier-1', name: '本地供应商', status: 'active' }];
  let purchaseOrders: Array<Record<string, any>> = [];
  let menus = [{
    id: 'menu-1',
    name: '午间菜单',
    currency: 'EUR',
    status: 'draft',
    version: 1,
    items: [],
    _count: { items: 0 }
  }];
  runInNewContext(source, {
    Page(page: Record<string, any>) { definition = page; },
    require(specifier: string) {
      if (specifier === '../../utils/api') {
        return {
          async request(path: string, requestOptions: Record<string, any> = {}) {
            calls.push({ path, options: requestOptions });
            if (requestOptions.method === 'POST' && path === '/api/merchant/restaurant/purchase-orders') {
              const order = {
                id: `purchase-${purchaseOrders.length + 1}`,
                version: 1,
                status: 'draft',
                currency: requestOptions.data.currency,
                supplier: suppliers.find(supplier => supplier.id === requestOptions.data.supplierId),
                items: requestOptions.data.items.map((item: Record<string, any>, index: number) => ({
                  id: `purchase-item-${index + 1}`,
                  ingredientId: item.ingredientId,
                  ingredientNameSnapshot: ingredients.find(ingredient => ingredient.id === item.ingredientId)?.material.name || '原料',
                  unitSnapshot: 'kg',
                  orderedQuantity: item.orderedQuantity,
                  receivedQuantity: '0',
                  quotedUnitCost: item.quotedUnitCost
                }))
              };
              purchaseOrders = [...purchaseOrders, order];
              return { purchaseOrder: order };
            }
            const purchaseTransition = path.match(/\/purchase-orders\/([^/]+)\/(submit|receipts)$/);
            if (requestOptions.method === 'POST' && purchaseTransition) {
              const order = purchaseOrders.find(item => item.id === decodeURIComponent(purchaseTransition[1]));
              if (!order) throw new Error('Purchase order not found');
              if (purchaseTransition[2] === 'submit') {
                order.status = 'ordered';
                order.version += 1;
              } else {
                const receiptItems = requestOptions.data.items as Array<Record<string, any>>;
                order.items = order.items.map((item: Record<string, any>) => {
                  const receipt = receiptItems.find(line => line.itemId === item.id);
                  return receipt ? { ...item, receivedQuantity: String(Number(item.receivedQuantity) + Number(receipt.quantity)) } : item;
                });
                order.status = order.items.every((item: Record<string, any>) => Number(item.receivedQuantity) >= Number(item.orderedQuantity))
                  ? 'received'
                  : 'partially_received';
                order.version += 1;
              }
              return { purchaseOrder: order };
            }
            if (requestOptions.method === 'POST' && path.endsWith('/dishes')) {
              const dish = {
                id: `dish-${dishes.length + 1}`,
                ...requestOptions.data,
                status: 'draft'
              };
              dishes = [...dishes, dish];
              return { dish };
            }
            if (requestOptions.method === 'POST' && path.endsWith('/ingredients')) {
              const ingredient = {
                id: `ingredient-${ingredients.length + 1}`,
                category: requestOptions.data.category,
                allergens: requestOptions.data.allergens,
                material: {
                  code: requestOptions.data.code,
                  name: requestOptions.data.name,
                  unit: requestOptions.data.unit,
                  reorderPoint: Number(requestOptions.data.reorderPoint),
                  leadTimeDays: requestOptions.data.leadTimeDays
                }
              };
              ingredients = [...ingredients, ingredient];
              return { ingredient };
            }
            if (requestOptions.method === 'POST' && /\/dishes\/[^/]+\/recipes$/.test(path)) {
              const recipe = {
                id: `recipe-${recipes.length + 1}`,
                version: recipes.length + 1,
                status: 'draft',
                yieldQuantity: requestOptions.data.yieldQuantity,
                yieldUnit: requestOptions.data.yieldUnit,
                items: requestOptions.data.items.map((item: Record<string, any>) => ({
                  ...item,
                  ingredientNameSnapshot: '番茄',
                  unitSnapshot: 'kg'
                }))
              };
              recipes = [...recipes, recipe];
              return { recipe };
            }
            if (requestOptions.method === 'POST' && /\/recipes\/[^/]+\/activate$/.test(path)) {
              recipes = recipes.map(recipe => recipe.id === path.split('/').at(-2) ? { ...recipe, status: 'active' } : recipe);
              return { recipe: recipes.find(recipe => recipe.id === path.split('/').at(-2)) };
            }
            if (requestOptions.method === 'POST' && /\/menus\/[^/]+\/(publish|unpublish)$/.test(path)) {
              const menu = menus.find(item => path.includes(item.id));
              if (menu) {
                menu.status = path.endsWith('/publish') ? 'published' : 'draft';
                menu.version += 1;
              }
              return { menu };
            }
            if (requestOptions.method === 'POST' && path.endsWith('/menus')) {
              const createdMenu = {
                ...menus[0],
                id: 'menu-2',
                name: requestOptions.data.name
              };
              menus = [...menus, createdMenu];
              return { menu: createdMenu };
            }
            if (requestOptions.method === 'POST' && path.endsWith('/items')) return { item: { id: 'item-1' } };
            const recipeMatch = path.match(/\/dishes\/([^/]+)\/recipes/);
            if (recipeMatch) return { recipes };
            if (path === '/api/merchant/suppliers') return { suppliers };
            if (path.startsWith('/api/merchant/restaurant/purchase-orders?')) return { purchaseOrders };
            if (path.includes('/cost')) return { cost: { status: 'insufficient_receipts', currency: null, costPerYield: null, method: 'weighted_average_actual_receipts' } };
            const menuMatch = path.match(/\/menus\/([^/?]+)$/);
            if (menuMatch) return { menu: menus.find(item => item.id === decodeURIComponent(menuMatch[1])) };
            if (path.endsWith('/menus?limit=100')) return { menus };
            if (path.endsWith('/dishes?limit=100')) return { dishes };
            if (path.endsWith('/ingredients?limit=100')) return { ingredients };
            throw new Error(`Unexpected API request: ${requestOptions.method || 'GET'} ${path}`);
          }
        };
      }
      if (specifier === '../../utils/page-auth') {
        return { requireMerchantSession: async () => ({ session: { role: 'merchant' } }) };
      }
      if (specifier === '../../utils/industry') {
        return {
          loadIndustryContext: async () => context,
          hasModule: (value: typeof context, module: string) => value.modules.includes(module),
          hasPermission: (value: typeof context, permission: string) =>
            !value.employeeId || value.permissions.includes(permission)
        };
      }
      throw new Error(`Unexpected module: ${specifier}`);
    },
    wx: { showModal(options: { success: (value: { confirm: boolean }) => void }) { options.success({ confirm: true }); } },
    console
  });
  assert.ok(definition);
  const page = Object.assign({}, definition, {
    data: JSON.parse(JSON.stringify(definition.data)),
    calls,
    setData(update: Record<string, unknown>) {
      Object.assign(this.data, update);
    }
  });
  return page;
}

test('Restaurant mini-program menu page is registered and loads the shared API only for entitled merchants', async () => {
  assert.ok((app.pages as string[]).includes('pages/restaurant-menu/index'));
  const page = createPage();
  await page.onLoad();
  assert.equal(page.data.menu.name, '午间菜单');
  assert.deepEqual(page.calls.map((call: { path: string }) => call.path), [
    '/api/merchant/restaurant/menus?limit=100',
    '/api/merchant/restaurant/dishes?limit=100',
    '/api/merchant/restaurant/ingredients?limit=100',
    '/api/merchant/restaurant/dishes/dish-1/recipes?limit=100',
    '/api/merchant/restaurant/menus/menu-1'
  ]);

  for (const context of [
    { templateId: 'general_retail', modules: ['restaurant_menu'] },
    { templateId: 'restaurant_ordering', modules: [] }
  ]) {
    const deniedPage = createPage(context);
    await deniedPage.onLoad();
    assert.equal(deniedPage.calls.length, 0);
    assert.match(deniedPage.data.error, /餐饮菜单工作区权限/);
  }
});

test('Restaurant menu page saves ingredients and immutable recipe versions, then activates by version', async () => {
  const page = createPage();
  await page.onLoad();
  page.setData({
    ingredientCode: 'TOMATO',
    ingredientName: '番茄',
    ingredientCategory: 'produce',
    ingredientUnit: 'kg',
    ingredientReorderPoint: '2',
    ingredientLeadTimeDays: '2',
    ingredientAllergens: 'celery'
  });
  await page.submitIngredient({ preventDefault() {} });
  const ingredientCall = page.calls.find((call: { path: string }) => call.path === '/api/merchant/restaurant/ingredients');
  assert.ok(ingredientCall);
  assert.equal(ingredientCall.options.headers['Idempotency-Key'].startsWith('restaurant-'), true);

  page.setData({
    recipeDishId: 'dish-1',
    recipeYieldQuantity: '4',
    recipeYieldUnit: 'portion',
    recipeItems: [{ ingredientId: 'ingredient-1', quantity: '0.25', wasteRate: '0.02' }]
  });
  await page.submitRecipe({ preventDefault() {} });
  const recipeCall = page.calls.find((call: { path: string }) => /\/dishes\/dish-1\/recipes$/.test(call.path));
  assert.ok(recipeCall);
  assert.equal(recipeCall.options.data.items[0].ingredientId, 'ingredient-1');
  assert.equal(recipeCall.options.headers['Idempotency-Key'].startsWith('restaurant-'), true);

  page.setData({ recipes: [{ id: 'recipe-1', version: 1, status: 'draft' }] });
  await page.activateRecipe({ currentTarget: { dataset: { id: 'recipe-1' } } });
  const activateCall = page.calls.find((call: { path: string }) => call.path.endsWith('/recipes/recipe-1/activate'));
  assert.equal(activateCall?.options.data.expectedVersion, 1);
});

test('Restaurant menu publish requires confirmation and uses menu version; cost reads the authoritative endpoint', async () => {
  const page = createPage();
  await page.onLoad();
  page.setData({ menu: { id: 'menu-1', version: 3, status: 'draft' }, recipeDishId: 'dish-1' });
  await page.transitionMenu();
  const publishCall = page.calls.find((call: { path: string }) => call.path.endsWith('/menus/menu-1/publish'));
  assert.equal(publishCall?.options.data.expectedVersion, 3);

  await page.readCost();
  assert.ok(page.calls.some((call: { path: string }) => call.path.includes('/dishes/dish-1/cost')));
  assert.equal(page.data.costResult.cost.status, 'insufficient_receipts');
});

test('Restaurant menu page creates menu and dish drafts with idempotency keys and shares the same API contract', async () => {
  const page = createPage();
  await page.onLoad();
  page.setData({ menuName: '晚餐菜单', currency: 'EUR' });
  await page.submitMenu({ preventDefault() {} });
  const createMenuCall = page.calls.find((call: { path: string }) => call.path === '/api/merchant/restaurant/menus' );
  assert.ok(createMenuCall);
  assert.equal(createMenuCall.options.method, 'POST');
  assert.equal(createMenuCall.options.headers['Idempotency-Key'].startsWith('restaurant-'), true);

  page.setData({ dishName: '香草烤鸡', dishCategory: '主菜' });
  await page.submitDish({ preventDefault() {} });
  const createDishCall = page.calls.find((call: { path: string }) => call.path === '/api/merchant/restaurant/dishes');
  assert.ok(createDishCall);
  assert.equal(createDishCall.options.data.name, '香草烤鸡');
  assert.equal(createDishCall.options.data.nameZh, '香草烤鸡');
  assert.equal(createDishCall.options.headers['Idempotency-Key'].startsWith('restaurant-'), true);

  page.setData({ menu: { id: 'menu-1', status: 'draft' }, dishId: 'dish-1', price: '12.50' });
  await page.addDish();
  const addItemCall = page.calls.find((call: { path: string }) => call.path.endsWith('/menus/menu-1/items'));
  assert.ok(addItemCall);
  assert.equal(addItemCall.options.data.dishId, 'dish-1');
  assert.equal(addItemCall.options.data.price, '12.50');
});

test('Restaurant mini-program closes purchase draft, submission and actual receipt on the shared API', async () => {
  const page = createPage();
  await page.onLoad();
  page.setData({
    ingredients: [{
      id: 'ingredient-1',
      material: { name: '番茄', unit: 'kg' }
    }]
  });
  page.toggleProcurement();
  await page.loadProcurement();
  assert.equal(page.data.activeSuppliers[0].id, 'supplier-1');
  page.setData({
    purchaseSupplierId: 'supplier-1',
    purchaseCurrency: 'EUR',
    purchaseItems: [{ ingredientId: 'ingredient-1', orderedQuantity: '2', quotedUnitCost: '3.20' }]
  });
  await page.submitPurchaseOrder({ preventDefault() {} });
  const createCall = page.calls.find((call: { path: string }) => call.path === '/api/merchant/restaurant/purchase-orders');
  assert.ok(createCall);
  assert.equal(createCall.options.data.items[0].ingredientId, 'ingredient-1');
  assert.ok(createCall.options.headers['Idempotency-Key']);

  const order = page.data.purchaseOrders[0];
  assert.equal(order.status, 'draft');
  await page.submitPurchase({ currentTarget: { dataset: { id: order.id } } });
  const submitCall = page.calls.find((call: { path: string }) => call.path.endsWith(`/purchase-orders/${order.id}/submit`));
  assert.equal(submitCall?.options.data.expectedVersion, 1);
  assert.equal(page.data.purchaseOrders[0].status, 'ordered');

  page.beginReceipt({ currentTarget: { dataset: { id: order.id } } });
  page.setData({
    receiptItems: [{ ...page.data.receiptItems[0], quantity: '1.5', unitCost: '3.25' }]
  });
  await page.submitReceipt();
  const receiptCall = page.calls.find((call: { path: string }) => call.path.endsWith(`/purchase-orders/${order.id}/receipts`));
  assert.equal(receiptCall?.options.data.items[0].quantity, '1.5');
  assert.equal(receiptCall?.options.data.items[0].unitCost, '3.25');
  assert.ok(receiptCall?.options.headers['Idempotency-Key']);
  assert.equal(page.data.purchaseOrders[0].status, 'partially_received');
  assert.equal(page.data.receivingOrderId, '');
});

test('Restaurant mini-program menu UI states its draft-only scope and provides labeled fields', () => {
  assert.match(markup, /POS 收银、厨房出单和顾客点单尚未开放/);
  assert.match(markup, /placeholder="菜单名称"/);
  assert.match(markup, /placeholder="菜品名称"/);
  assert.match(markup, /保存菜品草稿/);
  assert.match(markup, /菜单售价|placeholder="售价"/);
  assert.match(markup, /保存原料/);
  assert.match(markup, /保存新版本/);
  assert.match(markup, /确认发布/);
  assert.match(markup, /原料采购与实收/);
  assert.match(markup, /确认实际收货/);
  assert.match(markup, /发票单价/);
});
