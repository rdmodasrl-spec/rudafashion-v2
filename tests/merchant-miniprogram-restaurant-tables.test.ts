import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import test from 'node:test';

const miniRoot = new URL('../merchant-miniprogram/', import.meta.url);
const source = readFileSync(new URL('pages/restaurant-tables/index.js', miniRoot), 'utf8');
const markup = readFileSync(new URL('pages/restaurant-tables/index.wxml', miniRoot), 'utf8');
const app = JSON.parse(readFileSync(new URL('app.json', miniRoot), 'utf8'));
const industryConfig = readFileSync(new URL('industries/restaurant-ordering.js', miniRoot), 'utf8');

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
    modules: options.modules ?? ['restaurant_tables'],
    employeeId: options.employeeId ?? null,
    permissions: options.permissions ?? []
  };
  const stores = [
    { id: 'store-1', name: '中心店', city: 'Prato' },
    { id: 'store-2', name: '北区店', city: 'Prato' }
  ];
  const tables = new Map<string, Array<Record<string, any>>>([
    ['store-1', [{
      id: 'table-1', storeId: 'store-1', code: 'A01', name: '靠窗桌',
      capacity: 4, area: '一层', status: 'active', version: 1
    }]],
    ['store-2', []]
  ]);
  let failNextCreate = false;
  const modalContent: string[] = [];

  runInNewContext(source, {
    Page(page: Record<string, any>) { definition = page; },
    require(specifier: string) {
      if (specifier === '../../utils/api') {
        return {
          async request(path: string, requestOptions: Record<string, any> = {}) {
            calls.push({ path, options: requestOptions });
            if (path === '/api/merchant/restaurant/table-stores') return { stores };
            const listMatch = path.match(/^\/api\/merchant\/restaurant\/tables\?storeId=([^&]+)$/);
            if (listMatch) return { tables: tables.get(decodeURIComponent(listMatch[1])) || [] };
            if (path === '/api/merchant/restaurant/tables' && requestOptions.method === 'POST') {
              if (failNextCreate) {
                failNextCreate = false;
                throw Object.assign(new Error('network unavailable'), { code: 'NETWORK_ERROR' });
              }
              const rows = tables.get(requestOptions.data.storeId) || [];
              const table = {
                id: `table-${rows.length + 2}`,
                ...requestOptions.data,
                status: 'active',
                version: 1
              };
              tables.set(requestOptions.data.storeId, [...rows, table]);
              return { table };
            }
            const updateMatch = path.match(/^\/api\/merchant\/restaurant\/tables\/([^/]+)$/);
            if (updateMatch && requestOptions.method === 'PATCH') {
              const tableId = decodeURIComponent(updateMatch[1]);
              for (const [storeId, rows] of tables) {
                const index = rows.findIndex(table => table.id === tableId);
                if (index >= 0) {
                  const updated = { ...rows[index], ...requestOptions.data, version: rows[index].version + 1 };
                  rows[index] = updated;
                  return { table: updated };
                }
              }
            }
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
    wx: {
      showModal(options: { content: string; success: (value: { confirm: boolean }) => void }) {
        modalContent.push(options.content);
        options.success({ confirm: true });
      }
    },
    console
  });
  assert.ok(definition);
  const page = Object.assign({}, definition, {
    data: JSON.parse(JSON.stringify(definition.data)),
    calls,
    modalContent,
    setData(update: Record<string, unknown>) {
      Object.assign(this.data, update);
    }
  });
  return {
    page,
    calls,
    tables,
    setFailNextCreate() { failNextCreate = true; }
  };
}

test('Restaurant table page is registered and only loads for entitled Restaurant merchants', async () => {
  assert.ok((app.pages as string[]).includes('pages/restaurant-tables/index'));
  assert.match(industryConfig, /module: 'restaurant_tables'[\s\S]*?permission: 'employees\.manage'[\s\S]*?\/pages\/restaurant-tables\/index/);
  const { page, calls } = createPage();
  await page.onLoad();
  assert.equal(page.data.tables[0].code, 'A01');
  assert.deepEqual(calls.map(call => call.path), [
    '/api/merchant/restaurant/table-stores',
    '/api/merchant/restaurant/tables?storeId=store-1'
  ]);

  for (const context of [
    { templateId: 'general_retail', modules: ['restaurant_tables'] },
    { templateId: 'restaurant_ordering', modules: [] }
  ]) {
    const denied = createPage(context);
    await denied.page.onLoad();
    assert.equal(denied.calls.length, 0);
    assert.match(denied.page.data.error, /餐饮桌台目录权限/);
  }
});

test('Restaurant table page creates idempotently and updates with the current version', async () => {
  const { page, calls } = createPage();
  await page.onLoad();
  page.setData({ code: 'A02', name: '双人桌', capacity: '2', area: '一层' });
  await page.createTable();
  const create = calls.find(call => call.options.method === 'POST');
  assert.ok(create);
  assert.equal(create.options.headers['Idempotency-Key'].startsWith('restaurant-table-'), true);
  assert.equal(page.data.tables.some((table: Record<string, any>) => table.code === 'A02'), true);

  page.beginEdit({ currentTarget: { dataset: { id: 'table-1' } } });
  page.setData({ editName: '窗边四人桌', editCapacity: '4', editArea: '一层北侧' });
  await page.saveEdit();
  const update = calls.find(call => call.options.method === 'PATCH');
  assert.ok(update);
  assert.equal(update.options.data.expectedVersion, 1);
  assert.equal(page.data.tables.find((table: Record<string, any>) => table.id === 'table-1').name, '窗边四人桌');

  await page.toggleStatus({ currentTarget: { dataset: { id: 'table-1' } } });
  assert.match(page.modalContent[0], /A01/);
  const statusUpdate = calls.filter(call => call.options.method === 'PATCH')[1];
  assert.equal(statusUpdate.options.data.status, 'inactive');
  assert.equal(statusUpdate.options.data.expectedVersion, 2);
  assert.equal(page.data.tables.find((table: Record<string, any>) => table.id === 'table-1').status, 'inactive');
});

test('Restaurant table page keeps an idempotency key on retry and hides writes from unauthorized employees', async () => {
  const retry = createPage();
  await retry.page.onLoad();
  retry.page.setData({ code: 'A02', name: '双人桌', capacity: '2', area: '' });
  retry.setFailNextCreate();
  await retry.page.createTable();
  const firstKey = retry.calls.find(call => call.options.method === 'POST')?.options.headers['Idempotency-Key'];
  await retry.page.createTable();
  const createCalls = retry.calls.filter(call => call.options.method === 'POST');
  assert.equal(createCalls[1].options.headers['Idempotency-Key'], firstKey);
  assert.equal(retry.page.data.tables.some((table: Record<string, any>) => table.code === 'A02'), true);

  const employee = createPage({
    employeeId: 'employee-1',
    permissions: []
  });
  await employee.page.onLoad();
  assert.equal(employee.page.data.canManageTables, false);
  employee.page.setData({ code: 'A03', name: '员工桌', capacity: '2' });
  await employee.page.createTable();
  assert.equal(employee.calls.some(call => call.options.method === 'POST'), false);
  assert.match(markup, /wx:if="\{\{canManageTables\}\}"/);
  assert.match(markup, /wx:if="\{\{canManageTables && storeId\}\}"/);
});
