import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { fork, type ChildProcess } from 'node:child_process';
import net from 'node:net';
import path from 'node:path';
import test from 'node:test';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { getIsolatedPostgresTestDatabaseUrl } from '../../scripts/isolatedPostgresTestDatabase';

if (process.env.NODE_ENV !== 'test') {
  throw new Error('RESTAURANT_CATALOG_INTEGRATION_REQUIRES_NODE_ENV_TEST');
}

const databaseUrl = getIsolatedPostgresTestDatabaseUrl({
  nodeEnv: process.env.NODE_ENV,
  testDatabaseUrl: process.env.RESTAURANT_TEST_DATABASE_URL,
  applicationDatabaseUrl: process.env.RUDA_APPLICATION_DATABASE_URL,
  runId: process.env.RESTAURANT_TEST_RUN_ID,
  containerId: process.env.RESTAURANT_TEST_CONTAINER_ID
});
const merchantSecret = process.env.JWT_MERCHANT_SECRET;
if (!merchantSecret) throw new Error('RESTAURANT_CATALOG_INTEGRATION_JWT_SECRET_REQUIRED');

const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });

type ApiBody = {
  menu?: { id: string; version: number; status: string; items?: Array<{ id: string; status: string; version: number }> };
  dish?: { id: string; version: number; status: string };
  item?: { id: string; version: number; status: string };
  ingredient?: {
    id: string;
    version: number;
    category: string;
    allergens: string[];
    material: { id: string; code: string; name: string; unit: string; status: string; [key: string]: unknown };
  };
  recipe?: {
    id: string;
    dishId: string;
    version: number;
    status: string;
    items: Array<{
      ingredientId: string;
      ingredientCodeSnapshot: string;
      ingredientNameSnapshot: string;
      unitSnapshot: string;
      quantity: string;
    }>;
  };
  cost?: {
    recipeId: string;
    recipeVersion: number;
    status: string;
    method: string;
    currency: string | null;
    totalBatchCost: string | null;
    costPerYield: string | null;
    sourceItemCount: number;
    latestSourceAt: string | null;
    ingredients: Array<{ averageUnitCost: string | null; lineCost: string | null }>;
  };
  menuComparison?: {
    status: string;
    menuCurrency: string;
    menuPrice: string;
    grossMargin: string | null;
    grossMarginRate: string | null;
  };
  stock?: {
    ingredientId: string;
    locationCode: string;
    onHandQuantity: string;
    reservedQuantity: string;
    availableQuantity: string;
    version: number;
  };
  movement?: { id: string; quantity: string; movementType: string; createdAt: string };
  purchaseOrder?: {
    id: string;
    status: string;
    version: number;
    currency: string;
    supplierId: string;
    items: Array<{
      id: string;
      ingredientId: string;
      orderedQuantity: string;
      receivedQuantity: string;
      quotedUnitCost: string;
    }>;
  };
  table?: { id: string; code: string; name: string; capacity: number; area: string; status: string; version: number };
  tables?: Array<{ id: string; code: string; status: string; version: number }>;
  stores?: Array<{ id: string; code: string; name: string; city: string }>;
  receipt?: {
    id: string;
    items: Array<{ purchaseOrderItemId: string; quantity: string; unitCost: string; currency: string }>;
  };
  menus?: Array<{
    name: string;
    description: string;
    currency: string;
    items: Array<{ name: string; nameZh: string | null; nameIt: string | null; price: string; allergens: string[] }>;
  }>;
  dishes?: Array<{ id: string }>;
  ingredients?: Array<{ id: string }>;
  recipes?: Array<{ id: string; version: number; status: string }>;
  materials?: Array<{ id: string }>;
  movements?: Array<{ id: string }>;
  total?: number;
  replay?: boolean;
  success?: boolean;
  error?: string | { code?: string };
  [key: string]: unknown;
};

type HttpResult = { status: number; body: ApiBody; headers: Headers };

async function getFreePort(): Promise<number> {
  const listener = net.createServer();
  await new Promise<void>((resolve, reject) => {
    listener.once('error', reject);
    listener.listen(0, '127.0.0.1', resolve);
  });
  const address = listener.address();
  if (!address || typeof address === 'string') throw new Error('RESTAURANT_CATALOG_TEST_PORT_UNAVAILABLE');
  await new Promise<void>((resolve, reject) => listener.close(error => error ? reject(error) : resolve()));
  return address.port;
}

async function request(baseUrl: string, route: string, options: {
  method?: string;
  token?: string;
  cookie?: string;
  idempotencyKey?: string;
  body?: unknown;
} = {}): Promise<HttpResult> {
  const response = await fetch(`${baseUrl}${route}`, {
    method: options.method || 'GET',
    headers: {
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
      ...(options.cookie ? { Cookie: options.cookie } : {}),
      ...(options.idempotencyKey ? { 'Idempotency-Key': options.idempotencyKey } : {}),
      ...(options.body === undefined ? {} : { 'Content-Type': 'application/json' })
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    signal: AbortSignal.timeout(20_000)
  });
  const text = await response.text();
  let body: ApiBody = {};
  try {
    body = text ? JSON.parse(text) as ApiBody : {};
  } catch {
    body = { text };
  }
  return { status: response.status, body, headers: response.headers };
}

function errorCode(body: ApiBody): string | undefined {
  return typeof body.error === 'string' ? body.error : body.error?.code;
}

function merchantToken(merchantId: string, employeeId?: string): string {
  return jwt.sign({
    id: employeeId || merchantId,
    merchantId,
    role: employeeId ? 'employee' : 'merchant',
    ...(employeeId ? { employeeId } : {})
  }, merchantSecret!, { expiresIn: '20m' });
}

async function createMerchant(suffix: string, industryTemplate: string, source = 'ADMIN'): Promise<string> {
  const id = crypto.randomUUID();
  await prisma.merchant.create({
    data: {
      id,
      name: `Restaurant Catalog ${suffix}`,
      companyLegalName: `Restaurant Catalog ${suffix} Ltd`,
      code: `REST-${suffix}`,
      country: 'Italy',
      city: 'Prato',
      showroomAddress: 'Isolated test address',
      showroomArea: 'Test',
      showroomImage: '',
      logo: '',
      banner: '',
      tagline: 'Isolated Restaurant Catalog integration test',
      description: 'Test-only merchant fixture.',
      specialties: '[]',
      foundedYear: 2020,
      contactPerson: 'Integration Test',
      contactPhone: '+390000000000',
      contactEmail: `restaurant-${suffix}@example.test`,
      storeSlug: `restaurant-${suffix}`,
      industry: industryTemplate === 'restaurant_ordering' ? 'RESTAURANT' : 'FASHION_COMPANY',
      industryTemplate,
      industryTemplateSource: source
    }
  });
  return id;
}

async function createStore(merchantId: string, suffix: string): Promise<string> {
  const store = await prisma.merchantStore.create({
    data: {
      merchantId,
      code: `STORE-${suffix}`,
      name: `Restaurant ${suffix}`,
      status: 'active'
    }
  });
  return store.id;
}

async function waitForReady(baseUrl: string, child: ChildProcess, logs: () => string): Promise<void> {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`RESTAURANT_CATALOG_SERVER_EXITED:${child.exitCode}:${logs()}`);
    }
    try {
      const response = await fetch(`${baseUrl}/api/health/ready`, { signal: AbortSignal.timeout(1_500) });
      if (response.ok) return;
    } catch {
      await new Promise(resolve => setTimeout(resolve, 400));
    }
  }
  throw new Error(`RESTAURANT_CATALOG_SERVER_START_TIMEOUT:${logs()}`);
}

test('Restaurant catalog API persists tenant-scoped drafts with permission, idempotency and version guards', async () => {
  const suffix = crypto.randomUUID().replaceAll('-', '').slice(0, 20);
  const merchantA = await createMerchant(suffix, 'restaurant_ordering');
  const merchantB = await createMerchant(`${suffix}-other`, 'restaurant_ordering');
  const wrongIndustry = await createMerchant(`${suffix}-retail`, 'general_retail');
  const nonPilotRestaurant = await createMerchant(`${suffix}-self`, 'restaurant_ordering', 'SELF_SELECTED');
  await prisma.merchant.update({
    where: { id: merchantA },
    data: { isVerified: true, storefrontEnabled: true }
  });
  const storeA = await createStore(merchantA, suffix);
  const storeB = await createStore(merchantB, `${suffix}-other`);
  const selfSelectedStore = await createStore(nonPilotRestaurant, `${suffix}-self`);
  const legacyMaterial = await prisma.material.create({
    data: {
      merchantId: merchantA,
      code: `FAB-${suffix}`,
      name: 'Cotton test fabric',
      category: 'fabric',
      unit: 'meter'
    }
  });
  const foreignIngredientMaterial = await prisma.material.create({
    data: {
      merchantId: merchantB,
      code: `FOOD-${suffix}`,
      name: 'Foreign tenant produce',
      category: 'other',
      unit: 'kg'
    }
  });
  const foreignIngredient = await prisma.restaurantIngredient.create({
    data: {
      merchantId: merchantB,
      materialId: foreignIngredientMaterial.id,
      category: 'produce'
    }
  });
  const employeeAllowed = crypto.randomUUID();
  const employeeDenied = crypto.randomUUID();
  const employeeInventoryManager = crypto.randomUUID();
  const employeeStoreManager = crypto.randomUUID();
  const employeeTableManager = crypto.randomUUID();
  const employeePurchasingManager = crypto.randomUUID();
  const employeeStorePurchasingManager = crypto.randomUUID();
  await prisma.merchantEmployee.createMany({
    data: [
      {
        id: employeeAllowed,
        merchantId: merchantA,
        storeId: storeA,
        email: `restaurant-allowed-${suffix}@example.test`,
        name: 'Authorized restaurant editor',
        passwordHash: 'not-used-by-this-api-test',
        role: 'sales',
        permissions: '["product.import.draft"]'
      },
      {
        id: employeeDenied,
        merchantId: merchantA,
        storeId: storeA,
        email: `restaurant-denied-${suffix}@example.test`,
        name: 'Restricted restaurant editor',
        passwordHash: 'not-used-by-this-api-test',
        role: 'sales',
        permissions: '[]'
      },
      {
        id: employeeInventoryManager,
        merchantId: merchantA,
        email: `restaurant-inventory-${suffix}@example.test`,
        name: 'Authorized restaurant inventory manager',
        passwordHash: 'not-used-by-this-api-test',
        role: 'production',
        permissions: '["production.manage"]'
      },
      {
        id: employeeStoreManager,
        merchantId: merchantA,
        storeId: storeA,
        email: `restaurant-store-manager-${suffix}@example.test`,
        name: 'Store scoped inventory manager',
        passwordHash: 'not-used-by-this-api-test',
        role: 'store_manager',
        permissions: '["production.manage"]'
      },
      {
        id: employeeTableManager,
        merchantId: merchantA,
        storeId: storeA,
        email: `restaurant-table-manager-${suffix}@example.test`,
        name: 'Authorized restaurant table manager',
        passwordHash: 'not-used-by-this-api-test',
        role: 'store_manager',
        permissions: '["employees.manage"]'
      },
      {
        id: employeePurchasingManager,
        merchantId: merchantA,
        email: `restaurant-purchase-manager-${suffix}@example.test`,
        name: 'Authorized restaurant purchasing manager',
        passwordHash: 'not-used-by-this-api-test',
        role: 'production',
        permissions: '["purchase.manage"]'
      },
      {
        id: employeeStorePurchasingManager,
        merchantId: merchantA,
        storeId: storeA,
        email: `restaurant-store-purchase-manager-${suffix}@example.test`,
        name: 'Store scoped restaurant purchasing manager',
        passwordHash: 'not-used-by-this-api-test',
        role: 'store_manager',
        permissions: '["purchase.manage"]'
      }
    ]
  });
  const supplierA = await prisma.supplier.create({
    data: { merchantId: merchantA, name: `Restaurant Supplier ${suffix}`, status: 'active' }
  });
  const supplierB = await prisma.supplier.create({
    data: { merchantId: merchantB, name: `Other Restaurant Supplier ${suffix}`, status: 'active' }
  });
  const centralLocation = await prisma.warehouseLocation.findFirst({
    where: { merchantId: null, code: 'central', isActive: true }
  }) ?? await prisma.warehouseLocation.create({
    data: { merchantId: null, code: 'central', name: 'Shared central warehouse', type: 'central', isActive: true }
  });
  const mismatchedBalanceMaterial = await prisma.material.create({
    data: {
      merchantId: merchantA,
      code: `SAFE-${suffix}`,
      name: 'Tenant boundary test ingredient',
      category: 'other',
      unit: 'kg'
    }
  });
  const mismatchedBalanceIngredient = await prisma.restaurantIngredient.create({
    data: { merchantId: merchantA, materialId: mismatchedBalanceMaterial.id, category: 'produce' }
  });
  await prisma.materialInventoryBalance.create({
    data: {
      merchantId: merchantB,
      materialId: mismatchedBalanceMaterial.id,
      locationId: centralLocation.id,
      onHandQuantity: 77
    }
  });
  const foreignProductId = crypto.randomUUID();
  await prisma.product.create({
    data: {
      id: foreignProductId,
      styleNo: `REST-${suffix}`,
      name: 'Foreign tenant product',
      category: 'food',
      subCategory: '',
      brand: 'Test',
      season: '',
      images: '',
      wholesalePrice: 1,
      rrpPrice: 1,
      status: 'draft',
      inventoryStatus: 'available',
      origin: 'Italy',
      fabric: '',
      composition: '',
      weight: '',
      packaging: '',
      washCare: '',
      description: 'Foreign tenant fixture',
      skus: '[]',
      merchantId: merchantB
    }
  });

  const port = await getFreePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const serverLogs: string[] = [];
  const logs = () => serverLogs.join('').slice(-12_000);
  const server = fork(path.resolve('server.ts'), [], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      NODE_ENV: 'test',
      P0_HTTP_TEST_MODE: 'true',
      DATABASE_URL: databaseUrl,
      PORT: String(port),
      JWT_MERCHANT_SECRET: merchantSecret!,
      JWT_ADMIN_SECRET: process.env.JWT_ADMIN_SECRET || 'restaurant-catalog-test-admin-secret-0123456789abcdef',
      JWT_BUYER_SECRET: 'restaurant-catalog-test-buyer-secret-0123456789abcdef',
      SHARE_LINK_SECRET: 'restaurant-catalog-test-share-secret-0123456789abcdef',
      ADMIN_TOTP_ENCRYPTION_KEY: 'restaurant-catalog-test-totp-secret-0123456789abcdef',
      PAYMENT_ENABLED: 'false',
      MODAGPT_BRAIN_ENABLED: 'false',
      OBJECT_STORAGE_ENDPOINT: '',
      OBJECT_STORAGE_BUCKET: '',
      OBJECT_STORAGE_ACCESS_KEY_ID: '',
      OBJECT_STORAGE_SECRET_ACCESS_KEY: ''
    },
    execArgv: ['--import', 'tsx'],
    stdio: ['ignore', 'pipe', 'pipe', 'ipc']
  });
  server.stdout?.on('data', chunk => serverLogs.push(String(chunk)));
  server.stderr?.on('data', chunk => serverLogs.push(String(chunk)));

  const ownerA = merchantToken(merchantA);
  const ownerB = merchantToken(merchantB);
  const wrongIndustryOwner = merchantToken(wrongIndustry);
  const nonPilotOwner = merchantToken(nonPilotRestaurant);
  const allowedEmployee = merchantToken(merchantA, employeeAllowed);
  const deniedEmployee = merchantToken(merchantA, employeeDenied);
  const inventoryManager = merchantToken(merchantA, employeeInventoryManager);
  const storeManager = merchantToken(merchantA, employeeStoreManager);
  const tableManager = merchantToken(merchantA, employeeTableManager);
  const purchasingManager = merchantToken(merchantA, employeePurchasingManager);
  const storePurchasingManager = merchantToken(merchantA, employeeStorePurchasingManager);
  const menuPath = '/api/merchant/restaurant/menus';
  const dishPath = '/api/merchant/restaurant/dishes';
  const publicMenuPath = `/api/restaurant/stores/restaurant-${suffix}/menus`;
  const tablePath = '/api/merchant/restaurant/tables';
  const tableStoresPath = '/api/merchant/restaurant/table-stores';

  try {
    await waitForReady(baseUrl, server, logs);
    const registrationEmail = `restaurant-open-${suffix}@example.test`;
    const verificationCode = '246810';
    const verificationId = `merchant-register-${crypto.randomUUID()}`;
    await prisma.contactVerificationCode.create({
      data: {
        id: verificationId,
        destination: registrationEmail,
        channel: 'email',
        purpose: 'merchant_registration',
        codeHash: await bcrypt.hash(verificationCode, 10),
        expiresAt: new Date(Date.now() + 10 * 60_000)
      }
    });
    const verifiedContact = await request(baseUrl, '/api/auth/register/merchant/email-verify', {
      method: 'POST',
      body: { email: registrationEmail, code: verificationCode }
    });
    assert.equal(verifiedContact.status, 200, logs());
    const openedRestaurant = await request(baseUrl, '/api/auth/register/merchant/quick', {
      method: 'POST',
      body: {
        email: registrationEmail,
        password: 'restaurant-integration-password',
        storeName: `Restaurant Signup ${suffix}`,
        industryTemplate: 'restaurant_ordering',
        verificationToken: verifiedContact.body.verificationToken
      }
    });
    assert.equal(openedRestaurant.status, 201, logs());
    assert.equal(openedRestaurant.body.status, 'setup_required');
    const openedRestaurantId = String(openedRestaurant.body.merchantId || '');
    assert.ok(openedRestaurantId);
    const persistedRestaurant = await prisma.merchant.findUnique({
      where: { id: openedRestaurantId },
      select: { industry: true, industryTemplate: true, businessType: true, registrationProfile: true }
    });
    assert.deepEqual(persistedRestaurant, {
      industry: 'RESTAURANT',
      industryTemplate: 'restaurant_ordering',
      businessType: 'restaurant',
      registrationProfile: { categories: [], roles: ['RESTAURANT_OPERATOR'] }
    });
    const sessionCookie = (openedRestaurant.headers.get('set-cookie') || '').split(';', 1)[0];
    assert.match(sessionCookie, /^ruda_merchant_jwt=/);
    const openedWorkspaceAccess = await request(baseUrl, tableStoresPath, {
      cookie: sessionCookie
    });
    assert.equal(openedWorkspaceAccess.status, 200, logs());

    const companyRegistrationEmail = `restaurant-company-${suffix}@example.test`;
    const companyVerificationCode = '135790';
    await prisma.contactVerificationCode.create({
      data: {
        id: `company-register-${crypto.randomUUID()}`,
        destination: companyRegistrationEmail,
        channel: 'email',
        purpose: 'company_registration',
        codeHash: await bcrypt.hash(companyVerificationCode, 10),
        expiresAt: new Date(Date.now() + 10 * 60_000)
      }
    });
    const verifiedCompanyContact = await request(baseUrl, '/api/auth/register/company/verify', {
      method: 'POST',
      body: { channel: 'email', destination: companyRegistrationEmail, code: companyVerificationCode }
    });
    assert.equal(verifiedCompanyContact.status, 200, logs());
    const registeredCompanyRestaurant = await request(baseUrl, '/api/auth/register/company', {
      method: 'POST',
      body: {
        email: companyRegistrationEmail,
        password: 'restaurant-company-integration-password',
        displayName: `Restaurant Company Signup ${suffix}`,
        legalName: `Restaurant Company Signup ${suffix} Ltd`,
        country: 'Italy',
        city: 'Prato',
        roles: ['RESTAURANT_OPERATOR'],
        categories: ['RESTAURANT'],
        industryTemplate: 'restaurant_ordering',
        verificationToken: verifiedCompanyContact.body.verificationToken,
        acceptedTerms: true,
        acceptedPrivacy: true
      }
    });
    assert.equal(registeredCompanyRestaurant.status, 201, logs());
    assert.equal(registeredCompanyRestaurant.body.status, 'ACTIVE');
    assert.equal(registeredCompanyRestaurant.body.merchantLoginAvailable, true);
    const companyMerchantId = String(registeredCompanyRestaurant.body.merchantId || '');
    assert.ok(companyMerchantId);
    const companyMerchant = await prisma.merchant.findUnique({
      where: { id: companyMerchantId },
      select: { industry: true, industryTemplate: true, businessType: true, registrationProfile: true }
    });
    assert.deepEqual(companyMerchant, {
      industry: 'RESTAURANT',
      industryTemplate: 'restaurant_ordering',
      businessType: 'restaurant',
      registrationProfile: { categories: ['RESTAURANT'], roles: ['RESTAURANT_OPERATOR'] }
    });
    const companySessionCookie = (registeredCompanyRestaurant.headers.get('set-cookie') || '')
      .match(/(?:^|,\s*)(ruda_merchant_jwt=[^;,\s]+)/)?.[1];
    assert.ok(companySessionCookie);
    const companyWorkspaceAccess = await request(baseUrl, tableStoresPath, { cookie: companySessionCookie });
    assert.equal(companyWorkspaceAccess.status, 200, logs());

    const tableStores = await request(baseUrl, tableStoresPath, { token: ownerA });
    assert.equal(tableStores.status, 200);
    assert.deepEqual(tableStores.body.stores?.map(store => store.id), [storeA]);
    const selfSelectedStores = await request(baseUrl, tableStoresPath, { token: nonPilotOwner });
    assert.equal(selfSelectedStores.status, 200, logs());
    assert.deepEqual(selfSelectedStores.body.stores?.map(store => store.id), [selfSelectedStore]);
    const selfSelectedTable = await request(baseUrl, tablePath, {
      method: 'POST',
      token: nonPilotOwner,
      idempotencyKey: `restaurant-self-table-${suffix}`,
      body: { storeId: selfSelectedStore, code: 'S-01', name: 'Self-selected table', capacity: 2 }
    });
    assert.equal(selfSelectedTable.status, 201, logs());
    const scopedTableStores = await request(baseUrl, tableStoresPath, { token: tableManager });
    assert.deepEqual(scopedTableStores.body.stores?.map(store => store.id), [storeA]);
    const ordersBeforeTableSetup = await prisma.order.count({ where: { merchantId: merchantA } });
    const paymentsBeforeTableSetup = await prisma.paymentTransaction.count();
    const movementsBeforeTableSetup = await prisma.materialInventoryMovement.count({ where: { merchantId: merchantA } });
    const tableCreateInput = { storeId: storeA, code: ' t-01 ', name: ' Table 1 ', capacity: 4, area: ' Patio ' };
    const tableKey = `restaurant-table-${suffix}`;
    const createdTable = await request(baseUrl, tablePath, {
      method: 'POST',
      token: tableManager,
      idempotencyKey: tableKey,
      body: tableCreateInput
    });
    assert.equal(createdTable.status, 201, logs());
    assert.equal(createdTable.body.table?.code, 'T-01');
    assert.equal(createdTable.body.table?.version, 1);
    const replayedTable = await request(baseUrl, tablePath, {
      method: 'POST',
      token: tableManager,
      idempotencyKey: tableKey,
      body: tableCreateInput
    });
    assert.equal(replayedTable.status, 200);
    assert.equal(replayedTable.body.table?.id, createdTable.body.table?.id);
    assert.equal(replayedTable.body.replay, true);
    const keyConflict = await request(baseUrl, tablePath, {
      method: 'POST',
      token: tableManager,
      idempotencyKey: tableKey,
      body: { ...tableCreateInput, name: 'Different table' }
    });
    assert.equal(keyConflict.status, 409);
    assert.equal(errorCode(keyConflict.body), 'IDEMPOTENCY_KEY_REUSED');
    const duplicateCode = await request(baseUrl, tablePath, {
      method: 'POST',
      token: tableManager,
      idempotencyKey: `restaurant-table-duplicate-${suffix}`,
      body: { ...tableCreateInput, name: 'Duplicate code' }
    });
    assert.equal(duplicateCode.status, 409);
    assert.equal(errorCode(duplicateCode.body), 'RESTAURANT_TABLE_CODE_CONFLICT');
    const foreignStoreTable = await request(baseUrl, tablePath, {
      method: 'POST',
      token: ownerA,
      idempotencyKey: `restaurant-table-foreign-${suffix}`,
      body: { ...tableCreateInput, storeId: storeB }
    });
    assert.equal(foreignStoreTable.status, 404);
    assert.equal(errorCode(foreignStoreTable.body), 'STORE_NOT_FOUND');
    assert.equal((await request(baseUrl, tablePath, { method: 'POST', token: deniedEmployee, idempotencyKey: `denied-table-${suffix}`, body: tableCreateInput })).status, 403);
    assert.equal((await request(baseUrl, `${tablePath}?storeId=${storeB}`, { token: tableManager })).status, 403);
    const tableList = await request(baseUrl, `${tablePath}?storeId=${storeA}&status=active`, { token: ownerA });
    assert.equal(tableList.status, 200);
    assert.equal(tableList.body.total, 1);
    const tableId = String(createdTable.body.table?.id);
    const updatedTable = await request(baseUrl, `${tablePath}/${tableId}`, {
      method: 'PATCH',
      token: tableManager,
      body: { expectedVersion: 1, status: 'inactive' }
    });
    assert.equal(updatedTable.status, 200);
    assert.equal(updatedTable.body.table?.version, 2);
    assert.equal(updatedTable.body.table?.status, 'inactive');
    const staleTableUpdate = await request(baseUrl, `${tablePath}/${tableId}`, {
      method: 'PATCH',
      token: tableManager,
      body: { expectedVersion: 1, name: 'Stale update' }
    });
    assert.equal(staleTableUpdate.status, 409);
    assert.equal(errorCode(staleTableUpdate.body), 'RESTAURANT_TABLE_VERSION_CONFLICT');
    assert.equal((await request(baseUrl, `${tablePath}?storeId=${storeA}&status=active`, { token: ownerA })).body.total, 0);
    assert.equal((await request(baseUrl, `${tablePath}?storeId=${storeA}&status=inactive`, { token: ownerA })).body.total, 1);
    assert.equal(await prisma.order.count({ where: { merchantId: merchantA } }), ordersBeforeTableSetup);
    assert.equal(await prisma.paymentTransaction.count(), paymentsBeforeTableSetup);
    assert.equal(await prisma.materialInventoryMovement.count({ where: { merchantId: merchantA } }), movementsBeforeTableSetup);
    assert.deepEqual((await request(baseUrl, publicMenuPath)).body.menus, []);
    const retailPublicMenu = await request(baseUrl, `/api/restaurant/stores/restaurant-${suffix}-retail/menus`);
    assert.equal(retailPublicMenu.status, 404);
    assert.match(retailPublicMenu.headers.get('cache-control') ?? '', /no-store/i);
    const selfSelectedPublicMenu = await request(baseUrl, `/api/restaurant/stores/restaurant-${suffix}-self/menus`);
    assert.equal(selfSelectedPublicMenu.status, 200);
    assert.deepEqual(selfSelectedPublicMenu.body.menus, []);
    assert.match(selfSelectedPublicMenu.headers.get('cache-control') ?? '', /no-store/i);
    const deniedAccess = await request(baseUrl, dishPath, { token: deniedEmployee });
    assert.equal(deniedAccess.status, 403, logs());
    assert.equal(errorCode(deniedAccess.body), 'EMPLOYEE_PERMISSION_REQUIRED');
    assert.equal((await request(baseUrl, dishPath, { token: wrongIndustryOwner })).status, 403);
    const nonPilotAccess = await request(baseUrl, dishPath, { token: nonPilotOwner });
    assert.equal(nonPilotAccess.status, 200, logs());
    assert.deepEqual(nonPilotAccess.body.dishes, []);

    const dishKey = `restaurant-dish-${suffix}`;
    const dishInput = { name: 'Tomato Soup', nameZh: '番茄汤', allergens: ['Celery'] };
    const concurrentDishCreates = await Promise.all([
      request(baseUrl, dishPath, { method: 'POST', token: ownerA, idempotencyKey: dishKey, body: dishInput }),
      request(baseUrl, dishPath, { method: 'POST', token: ownerA, idempotencyKey: dishKey, body: dishInput })
    ]);
    assert.deepEqual(concurrentDishCreates.map(result => result.status).sort(), [200, 201], logs());
    assert.equal(concurrentDishCreates[0].body.dish?.id, concurrentDishCreates[1].body.dish?.id);
    const dishId = concurrentDishCreates[0].body.dish?.id;
    assert.ok(dishId);
    assert.equal(concurrentDishCreates.filter(result => result.body.replay === true).length, 1);
    assert.equal(concurrentDishCreates[0].body.dish?.status, 'draft');
    assert.equal(await prisma.restaurantDish.count({ where: { merchantId: merchantA } }), 1);

    const reusedDishKey = await request(baseUrl, dishPath, {
      method: 'POST',
      token: ownerA,
      idempotencyKey: dishKey,
      body: { ...dishInput, name: 'Different Soup' }
    });
    assert.equal(reusedDishKey.status, 409);
    assert.equal(errorCode(reusedDishKey.body), 'IDEMPOTENCY_KEY_REUSED');
    const foreignDish = await request(baseUrl, `${dishPath}/${dishId}`, { token: ownerB });
    assert.equal(foreignDish.status, 404);
    assert.equal(errorCode(foreignDish.body), 'RESTAURANT_DISH_NOT_FOUND');
    assert.equal((await request(baseUrl, dishPath, {
      method: 'POST',
      token: ownerA,
      idempotencyKey: `foreign-product-${suffix}`,
      body: { name: 'Foreign Product Dish', productId: foreignProductId }
    })).status, 404);

    const menuKey = `restaurant-menu-${suffix}`;
    const menuInput = { name: 'Lunch Menu', storeId: storeA, currency: 'EUR' };
    const concurrentMenuCreates = await Promise.all([
      request(baseUrl, menuPath, { method: 'POST', token: ownerA, idempotencyKey: menuKey, body: menuInput }),
      request(baseUrl, menuPath, { method: 'POST', token: ownerA, idempotencyKey: menuKey, body: menuInput })
    ]);
    assert.deepEqual(concurrentMenuCreates.map(result => result.status).sort(), [200, 201], logs());
    const menuId = concurrentMenuCreates[0].body.menu?.id;
    assert.ok(menuId);
    assert.equal(concurrentMenuCreates[0].body.menu?.id, concurrentMenuCreates[1].body.menu?.id);
    assert.equal(concurrentMenuCreates[0].body.menu?.status, 'draft');
    const foreignMenu = await request(baseUrl, `${menuPath}/${menuId}`, { token: ownerB });
    assert.equal(foreignMenu.status, 404);

    const foreignStore = await request(baseUrl, menuPath, {
      method: 'POST',
      token: ownerA,
      idempotencyKey: `foreign-store-${suffix}`,
      body: { name: 'Wrong Store Menu', storeId: storeB }
    });
    assert.equal(foreignStore.status, 404);
    const menuList = await request(baseUrl, menuPath, { token: ownerA, });
    assert.equal(menuList.status, 200);
    assert.equal(menuList.body.total, 1);

    const itemCreate = await request(baseUrl, `${menuPath}/${menuId}/items`, {
      method: 'POST',
      token: ownerA,
      body: { dishId, price: '8.50', sortOrder: 1 }
    });
    assert.equal(itemCreate.status, 201, logs());
    assert.ok(itemCreate.body.item?.id);
    const itemId = itemCreate.body.item!.id as string;
    const menuPublishPath = `${menuPath}/${menuId}/publish`;
    assert.equal((await request(baseUrl, publicMenuPath)).body.menus?.length, 0);
    assert.equal((await request(baseUrl, menuPublishPath, {
      method: 'POST',
      token: ownerA,
      body: { expectedVersion: 1 }
    })).status, 409);
    assert.equal(errorCode((await request(baseUrl, menuPublishPath, {
      method: 'POST',
      token: deniedEmployee,
      body: { expectedVersion: 1 }
    })).body), 'EMPLOYEE_PERMISSION_REQUIRED');
    assert.equal((await request(baseUrl, `${menuPath}/${menuId}/items`, {
      method: 'POST',
      token: ownerA,
      body: { dishId, price: '8.50', sortOrder: 1 }
    })).status, 409);

    const menuUpdate = await request(baseUrl, `${menuPath}/${menuId}`, {
      method: 'PATCH',
      token: ownerA,
      body: { expectedVersion: 1, name: 'Lunch Menu Updated' }
    });
    assert.equal(menuUpdate.status, 200, logs());
    assert.equal(menuUpdate.body.menu?.version, 2);
    assert.equal((await request(baseUrl, `${menuPath}/${menuId}`, {
      method: 'PATCH',
      token: ownerA,
      body: { expectedVersion: 1, name: 'Stale Menu Update' }
    })).status, 409);
    assert.equal((await request(baseUrl, `${menuPath}/${menuId}`, {
      method: 'PATCH',
      token: ownerA,
      body: { expectedVersion: 2, status: 'published' }
    })).status, 400);

    const dishUpdate = await request(baseUrl, `${dishPath}/${dishId}`, {
      method: 'PATCH',
      token: ownerA,
      body: { expectedVersion: 1, description: 'Contains celery.' }
    });
    assert.equal(dishUpdate.status, 200, logs());
    assert.equal(dishUpdate.body.dish?.version, 2);
    assert.equal((await request(baseUrl, `${dishPath}/${dishId}`, {
      method: 'PATCH',
      token: ownerA,
      body: { expectedVersion: 1, description: 'Stale description' }
    })).status, 409);

    const itemUpdate = await request(baseUrl, `${menuPath}/${menuId}/items/${itemId}`, {
      method: 'PATCH',
      token: ownerA,
      body: { expectedVersion: 1, status: 'sold_out' }
    });
    assert.equal(itemUpdate.status, 200, logs());
    assert.equal(itemUpdate.body.item?.version, 2);
    assert.equal((await request(baseUrl, `${menuPath}/${menuId}/items/${itemId}`, {
      method: 'PATCH',
      token: ownerA,
      body: { expectedVersion: 1, status: 'available' }
    })).status, 409);

    const storeScopedMenu = await request(baseUrl, menuPath, {
      method: 'POST',
      token: allowedEmployee,
      idempotencyKey: `scoped-menu-${suffix}`,
      body: { name: 'Store A Menu', storeId: storeA }
    });
    assert.equal(storeScopedMenu.status, 201, logs());
    const globalMenu = await request(baseUrl, menuPath, {
      method: 'POST',
      token: ownerA,
      idempotencyKey: `global-menu-${suffix}`,
      body: { name: 'All Stores Menu' }
    });
    assert.equal(globalMenu.status, 201, logs());
    const storeScopedGlobalEdit = await request(baseUrl, `${menuPath}/${globalMenu.body.menu?.id}`, {
      method: 'PATCH',
      token: allowedEmployee,
      body: { expectedVersion: 1, name: 'Unauthorized Global Change' }
    });
    assert.equal(storeScopedGlobalEdit.status, 403);
    assert.equal((await request(baseUrl, menuPath, { token: deniedEmployee })).status, 403);
    const storeScopedList = await request(baseUrl, `${menuPath}?storeId=${storeA}`, { token: allowedEmployee });
    assert.equal(storeScopedList.status, 200);
    assert.equal(storeScopedList.body.total, 2);
    assert.equal(await prisma.restaurantMenu.count({ where: { merchantId: merchantA } }), 3);
    assert.equal(await prisma.restaurantMenu.count({ where: { merchantId: merchantB } }), 0);
    assert.equal(await prisma.restaurantMenuItem.count({ where: { merchantId: merchantA } }), 1);
    assert.equal(await prisma.product.count({ where: { merchantId: merchantA } }), 0);
    assert.equal(await prisma.order.count({ where: { merchantId: merchantA } }), 0);

    const ingredientPath = '/api/merchant/restaurant/ingredients';
    const ingredientInput = {
      code: `TOMATO-${suffix}`,
      name: 'Tomato',
      category: 'produce',
      unit: 'kg',
      allergens: ['celery'],
      reorderPoint: '2.500',
      leadTimeDays: 2
    };
    const ingredientKey = `restaurant-ingredient-${suffix}`;
    const ingredientCreate = await request(baseUrl, ingredientPath, {
      method: 'POST',
      token: ownerA,
      idempotencyKey: ingredientKey,
      body: ingredientInput
    });
    assert.equal(ingredientCreate.status, 201, logs());
    const ingredientId = ingredientCreate.body.ingredient?.id;
    const ingredientMaterialId = ingredientCreate.body.ingredient?.material.id;
    assert.ok(ingredientId);
    assert.ok(ingredientMaterialId);
    assert.equal(ingredientCreate.body.ingredient?.version, 1);
    assert.equal(ingredientCreate.body.ingredient?.material.unit, 'kg');
    assert.equal(Object.hasOwn(ingredientCreate.body.ingredient!.material, 'unitCost'), false);
    const ingredientReplay = await request(baseUrl, ingredientPath, {
      method: 'POST',
      token: ownerA,
      idempotencyKey: ingredientKey,
      body: ingredientInput
    });
    assert.equal(ingredientReplay.status, 200);
    assert.equal(ingredientReplay.body.ingredient?.id, ingredientId);
    assert.equal((await request(baseUrl, ingredientPath, {
      method: 'POST',
      token: ownerA,
      idempotencyKey: ingredientKey,
      body: { ...ingredientInput, name: 'Different ingredient' }
    })).status, 409);
    assert.equal((await request(baseUrl, `${ingredientPath}/${ingredientId}`, { token: ownerB })).status, 404);
    assert.equal((await request(baseUrl, ingredientPath, { token: wrongIndustryOwner })).status, 403);
    assert.equal((await request(baseUrl, ingredientPath, { token: deniedEmployee })).status, 403);
    assert.equal((await request(baseUrl, `${ingredientPath}?category=unknown`, { token: ownerA })).status, 400);
    assert.equal((await request(baseUrl, `${ingredientPath}/${ingredientId}/stock`, { token: deniedEmployee })).status, 403);
    const storeScopedStock = await request(baseUrl, `${ingredientPath}/${ingredientId}/stock`, { token: storeManager });
    assert.equal(storeScopedStock.status, 403);
    assert.equal(errorCode(storeScopedStock.body), 'RESTAURANT_STORE_INVENTORY_NOT_CONFIGURED');

    const emptyStock = await request(baseUrl, `${ingredientPath}/${ingredientId}/stock`, { token: inventoryManager });
    assert.equal(emptyStock.status, 200);
    assert.deepEqual(emptyStock.body.stock, {
      ingredientId,
      locationCode: 'central',
      onHandQuantity: '0.000',
      reservedQuantity: '0.000',
      availableQuantity: '0.000',
      version: 0
    });
    const mismatchedBalanceStock = await request(baseUrl, `${ingredientPath}/${mismatchedBalanceIngredient.id}/stock`, { token: inventoryManager });
    assert.equal(mismatchedBalanceStock.status, 200);
    assert.equal(mismatchedBalanceStock.body.stock?.onHandQuantity, '0.000');
    const adjustmentPath = `${ingredientPath}/${ingredientId}/stock-adjustments`;
    const openingAdjustment = await request(baseUrl, adjustmentPath, {
      method: 'POST',
      token: inventoryManager,
      idempotencyKey: `restaurant-stock-${suffix}`,
      body: { locationCode: 'central', delta: '10', reason: 'count_correction', expectedVersion: 0 }
    });
    assert.equal(openingAdjustment.status, 201, logs());
    assert.equal(openingAdjustment.body.stock?.onHandQuantity, '10.000');
    assert.equal(openingAdjustment.body.stock?.version, 1);
    const adjustmentReplay = await request(baseUrl, adjustmentPath, {
      method: 'POST',
      token: inventoryManager,
      idempotencyKey: `restaurant-stock-${suffix}`,
      body: { locationCode: 'central', delta: '10', reason: 'count_correction', expectedVersion: 0 }
    });
    assert.equal(adjustmentReplay.status, 200);
    assert.equal(adjustmentReplay.body.movement?.id, openingAdjustment.body.movement?.id);
    assert.equal((await request(baseUrl, adjustmentPath, {
      method: 'POST',
      token: inventoryManager,
      idempotencyKey: `restaurant-stock-${suffix}`,
      body: { locationCode: 'central', delta: '9', reason: 'count_correction', expectedVersion: 0 }
    })).status, 409);
    assert.equal((await request(baseUrl, adjustmentPath, {
      method: 'POST',
      token: inventoryManager,
      idempotencyKey: `restaurant-stale-stock-${suffix}`,
      body: { locationCode: 'central', delta: '1', reason: 'count_correction', expectedVersion: 0 }
    })).status, 409);
    const wasteAdjustment = await request(baseUrl, adjustmentPath, {
      method: 'POST',
      token: inventoryManager,
      idempotencyKey: `restaurant-waste-${suffix}`,
      body: { locationCode: 'central', delta: '-2', reason: 'waste', expectedVersion: 1, note: 'Expired produce' }
    });
    assert.equal(wasteAdjustment.status, 201, logs());
    assert.equal(wasteAdjustment.body.stock?.onHandQuantity, '8.000');
    assert.equal(wasteAdjustment.body.stock?.version, 2);
    await prisma.materialInventoryBalance.update({
      where: { materialId_locationId: { materialId: ingredientMaterialId, locationId: centralLocation.id } },
      data: { reservedQuantity: 2 }
    });
    const reservedConflict = await request(baseUrl, adjustmentPath, {
      method: 'POST',
      token: inventoryManager,
      idempotencyKey: `restaurant-reserved-stock-${suffix}`,
      body: { locationCode: 'central', delta: '-7', reason: 'count_correction', expectedVersion: 2 }
    });
    assert.equal(reservedConflict.status, 409);
    assert.equal(errorCode(reservedConflict.body), 'RESTAURANT_STOCK_BELOW_RESERVED');
    assert.equal((await request(baseUrl, `${ingredientPath}/${ingredientId}/stock`, { token: ownerB })).status, 404);
    assert.equal((await request(baseUrl, `${ingredientPath}/${ingredientId}/stock`, { token: wrongIndustryOwner })).status, 403);
    assert.equal(await prisma.materialInventoryMovement.count({
      where: { merchantId: merchantA, materialId: ingredientMaterialId, locationId: centralLocation.id }
    }), 2);

    const purchaseOrderPath = '/api/merchant/restaurant/purchase-orders';
    assert.equal((await request(baseUrl, purchaseOrderPath, {
      method: 'POST',
      token: deniedEmployee,
      idempotencyKey: `restaurant-po-denied-${suffix}`,
      body: { supplierId: supplierA.id, currency: 'EUR', items: [{ ingredientId, orderedQuantity: '3', quotedUnitCost: '2.5' }] }
    })).status, 403);
    const foreignSupplierOrder = await request(baseUrl, purchaseOrderPath, {
      method: 'POST',
      token: purchasingManager,
      idempotencyKey: `restaurant-po-foreign-${suffix}`,
      body: { supplierId: supplierB.id, currency: 'EUR', items: [{ ingredientId, orderedQuantity: '3', quotedUnitCost: '2.5' }] }
    });
    assert.equal(foreignSupplierOrder.status, 404);
    const foreignIngredientOrder = await request(baseUrl, purchaseOrderPath, {
      method: 'POST',
      token: purchasingManager,
      idempotencyKey: `restaurant-po-foreign-ingredient-${suffix}`,
      body: { supplierId: supplierA.id, currency: 'EUR', items: [{ ingredientId: foreignIngredient.id, orderedQuantity: '3', quotedUnitCost: '2.5' }] }
    });
    assert.equal(foreignIngredientOrder.status, 404);
    const purchaseOrderInput = {
      supplierId: supplierA.id,
      currency: 'EUR',
      notes: 'Restaurant ingredient order',
      items: [{ ingredientId, orderedQuantity: '3', quotedUnitCost: '2.5000' }]
    };
    const purchaseOrderCreated = await request(baseUrl, purchaseOrderPath, {
      method: 'POST',
      token: purchasingManager,
      idempotencyKey: `restaurant-po-${suffix}`,
      body: purchaseOrderInput
    });
    assert.equal(purchaseOrderCreated.status, 201, logs());
    assert.equal(purchaseOrderCreated.body.purchaseOrder?.status, 'draft');
    assert.equal(purchaseOrderCreated.body.purchaseOrder?.version, 1);
    assert.equal(purchaseOrderCreated.body.purchaseOrder?.items[0]?.orderedQuantity, '3.000');
    const purchaseOrderId = purchaseOrderCreated.body.purchaseOrder?.id;
    const purchaseOrderItemId = purchaseOrderCreated.body.purchaseOrder?.items[0]?.id;
    assert.ok(purchaseOrderId);
    assert.ok(purchaseOrderItemId);
    const purchaseOrderReplay = await request(baseUrl, purchaseOrderPath, {
      method: 'POST',
      token: purchasingManager,
      idempotencyKey: `restaurant-po-${suffix}`,
      body: purchaseOrderInput
    });
    assert.equal(purchaseOrderReplay.status, 200);
    assert.equal(purchaseOrderReplay.body.purchaseOrder?.id, purchaseOrderId);
    assert.equal((await request(baseUrl, purchaseOrderPath, {
      method: 'POST',
      token: purchasingManager,
      idempotencyKey: `restaurant-po-${suffix}`,
      body: { ...purchaseOrderInput, currency: 'USD' }
    })).status, 409);
    assert.equal((await request(baseUrl, `${purchaseOrderPath}/${purchaseOrderId}`, { token: ownerB })).status, 404);
    await prisma.supplier.update({ where: { id: supplierA.id }, data: { status: 'suspended' } });
    const inactiveSupplierSubmit = await request(baseUrl, `${purchaseOrderPath}/${purchaseOrderId}/submit`, {
      method: 'POST',
      token: purchasingManager,
      body: { expectedVersion: 1 }
    });
    assert.equal(inactiveSupplierSubmit.status, 409);
    assert.equal(errorCode(inactiveSupplierSubmit.body), 'RESTAURANT_PURCHASE_SUPPLIER_INACTIVE');
    await prisma.supplier.update({ where: { id: supplierA.id }, data: { status: 'active' } });
    const submittedOrder = await request(baseUrl, `${purchaseOrderPath}/${purchaseOrderId}/submit`, {
      method: 'POST',
      token: purchasingManager,
      body: { expectedVersion: 1 }
    });
    assert.equal(submittedOrder.status, 200);
    assert.equal(submittedOrder.body.purchaseOrder?.status, 'ordered');
    assert.equal(submittedOrder.body.purchaseOrder?.version, 2);
    assert.equal((await request(baseUrl, `${purchaseOrderPath}/${purchaseOrderId}/submit`, {
      method: 'POST',
      token: purchasingManager,
      body: { expectedVersion: 1 }
    })).status, 409);
    const firstReceiptInput = {
      expectedVersion: 2,
      note: 'First partial delivery',
      items: [{ itemId: purchaseOrderItemId, quantity: '1', unitCost: '3.1' }]
    };
    const blockedStoreReceipt = await request(baseUrl, `${purchaseOrderPath}/${purchaseOrderId}/receipts`, {
      method: 'POST',
      token: storePurchasingManager,
      idempotencyKey: `restaurant-receipt-store-${suffix}`,
      body: firstReceiptInput
    });
    assert.equal(blockedStoreReceipt.status, 403);
    assert.equal(errorCode(blockedStoreReceipt.body), 'RESTAURANT_STORE_INVENTORY_NOT_CONFIGURED');
    const firstReceipt = await request(baseUrl, `${purchaseOrderPath}/${purchaseOrderId}/receipts`, {
      method: 'POST',
      token: purchasingManager,
      idempotencyKey: `restaurant-receipt-1-${suffix}`,
      body: firstReceiptInput
    });
    assert.equal(firstReceipt.status, 201, logs());
    assert.equal(firstReceipt.body.receipt?.items[0]?.unitCost, '3.1000');
    assert.equal(firstReceipt.body.receipt?.items[0]?.currency, 'EUR');
    const partiallyReceivedOrder = await request(baseUrl, `${purchaseOrderPath}/${purchaseOrderId}`, { token: purchasingManager });
    assert.equal(partiallyReceivedOrder.body.purchaseOrder?.status, 'partially_received');
    assert.equal(partiallyReceivedOrder.body.purchaseOrder?.version, 3);
    assert.equal(partiallyReceivedOrder.body.purchaseOrder?.items[0]?.receivedQuantity, '1.000');
    const firstReceiptReplay = await request(baseUrl, `${purchaseOrderPath}/${purchaseOrderId}/receipts`, {
      method: 'POST',
      token: purchasingManager,
      idempotencyKey: `restaurant-receipt-1-${suffix}`,
      body: firstReceiptInput
    });
    assert.equal(firstReceiptReplay.status, 200);
    assert.equal(firstReceiptReplay.body.receipt?.id, firstReceipt.body.receipt?.id);
    assert.equal((await request(baseUrl, `${purchaseOrderPath}/${purchaseOrderId}/receipts`, {
      method: 'POST',
      token: purchasingManager,
      idempotencyKey: `restaurant-receipt-1-${suffix}`,
      body: { ...firstReceiptInput, items: [{ itemId: purchaseOrderItemId, quantity: '1', unitCost: '3.2' }] }
    })).status, 409);
    const overReceipt = await request(baseUrl, `${purchaseOrderPath}/${purchaseOrderId}/receipts`, {
      method: 'POST',
      token: purchasingManager,
      idempotencyKey: `restaurant-receipt-over-${suffix}`,
      body: { expectedVersion: 3, items: [{ itemId: purchaseOrderItemId, quantity: '3', unitCost: '3.5' }] }
    });
    assert.equal(overReceipt.status, 400);
    assert.equal(await prisma.restaurantPurchaseReceipt.count({ where: { purchaseOrderId } }), 1);
    assert.equal(await prisma.materialInventoryMovement.count({
      where: {
        merchantId: merchantA,
        materialId: ingredientMaterialId,
        locationId: centralLocation.id,
        movementType: 'restaurant_purchase_receipt'
      }
    }), 1);
    const finalReceipt = await request(baseUrl, `${purchaseOrderPath}/${purchaseOrderId}/receipts`, {
      method: 'POST',
      token: purchasingManager,
      idempotencyKey: `restaurant-receipt-2-${suffix}`,
      body: {
        expectedVersion: 3,
        note: 'Final delivery',
        items: [{ itemId: purchaseOrderItemId, quantity: '2', unitCost: '3.5' }]
      }
    });
    assert.equal(finalReceipt.status, 201, logs());
    const completedPurchaseOrder = await request(baseUrl, `${purchaseOrderPath}/${purchaseOrderId}`, { token: purchasingManager });
    assert.equal(completedPurchaseOrder.body.purchaseOrder?.status, 'received');
    assert.equal(completedPurchaseOrder.body.purchaseOrder?.version, 4);
    assert.equal(completedPurchaseOrder.body.purchaseOrder?.items[0]?.receivedQuantity, '3.000');
    const restaurantReceipts = await prisma.restaurantPurchaseReceiptItem.findMany({
      where: { receipt: { purchaseOrderId } },
      orderBy: { createdAt: 'asc' }
    });
    assert.deepEqual(restaurantReceipts.map(item => [item.quantity.toFixed(3), item.unitCost.toFixed(4), item.currency]), [
      ['1.000', '3.1000', 'EUR'],
      ['2.000', '3.5000', 'EUR']
    ]);
    assert.equal(await prisma.materialInventoryMovement.count({
      where: {
        merchantId: merchantA,
        materialId: ingredientMaterialId,
        locationId: centralLocation.id,
        movementType: 'restaurant_purchase_receipt'
      }
    }), 2);
    assert.equal(await prisma.materialInventoryMovement.count({
      where: { merchantId: merchantA, materialId: ingredientMaterialId, locationId: centralLocation.id }
    }), 4);
    const stockAfterReceipts = await request(baseUrl, `${ingredientPath}/${ingredientId}/stock`, { token: inventoryManager });
    assert.equal(stockAfterReceipts.body.stock?.onHandQuantity, '11.000');

    const restaurantLocation = await prisma.warehouseLocation.create({
      data: {
        merchantId: merchantA,
        code: `REST-${suffix}`,
        name: 'Restaurant ingredient test location',
        type: 'restaurant'
      }
    });
    await prisma.materialInventoryBalance.create({
      data: {
        merchantId: merchantA,
        materialId: ingredientMaterialId,
        locationId: restaurantLocation.id,
        onHandQuantity: 3
      }
    });
    await prisma.materialInventoryMovement.create({
      data: {
        merchantId: merchantA,
        materialId: ingredientMaterialId,
        locationId: restaurantLocation.id,
        quantity: 3,
        movementType: 'restaurant_test_inbound',
        idempotencyKey: `restaurant-movement-${suffix}`
      }
    });
    await prisma.materialInventoryMovement.create({
      data: {
        merchantId: merchantA,
        materialId: legacyMaterial.id,
        locationId: restaurantLocation.id,
        quantity: 1,
        movementType: 'apparel_test_inbound',
        idempotencyKey: `apparel-movement-${suffix}`
      }
    });
    const lockedUnitUpdate = await request(baseUrl, `${ingredientPath}/${ingredientId}`, {
      method: 'PATCH',
      token: ownerA,
      body: { expectedVersion: 1, unit: 'g' }
    });
    assert.equal(lockedUnitUpdate.status, 409);
    assert.equal(errorCode(lockedUnitUpdate.body), 'RESTAURANT_INGREDIENT_UNIT_LOCKED');
    const ingredientUpdate = await request(baseUrl, `${ingredientPath}/${ingredientId}`, {
      method: 'PATCH',
      token: ownerA,
      body: { expectedVersion: 1, allergens: ['milk'] }
    });
    assert.equal(ingredientUpdate.status, 200, logs());
    assert.equal(ingredientUpdate.body.ingredient?.version, 2);
    assert.deepEqual(ingredientUpdate.body.ingredient?.allergens, ['milk']);
    assert.equal((await request(baseUrl, `${ingredientPath}/${ingredientId}`, {
      method: 'PATCH',
      token: ownerA,
      body: { expectedVersion: 1, name: 'Stale ingredient update' }
    })).status, 409);

    const materialsResponse = await request(baseUrl, '/api/merchant/materials', { token: ownerA });
    assert.equal(materialsResponse.status, 403);
    assert.equal(errorCode(materialsResponse.body), 'APPAREL_OWN_PRODUCTION_REQUIRED');
    const restaurantMovements = await request(baseUrl, `/api/merchant/material-movements?materialId=${ingredientMaterialId}`, {
      token: ownerA
    });
    assert.equal(restaurantMovements.status, 200, logs());
    assert.ok(restaurantMovements.body.movements.some(movement => 'movementType' in movement && movement.movementType === 'restaurant_test_inbound'));
    assert.ok(restaurantMovements.body.movements.every(movement => 'materialId' in movement && movement.materialId === ingredientMaterialId));
    const apparelMovementFiltered = await request(baseUrl, `/api/merchant/material-movements?materialId=${legacyMaterial.id}`, {
      token: ownerA
    });
    assert.equal(apparelMovementFiltered.status, 200, logs());
    assert.deepEqual(apparelMovementFiltered.body.movements, []);
    const allRestaurantMovements = await request(baseUrl, '/api/merchant/material-movements', { token: ownerA });
    assert.equal(allRestaurantMovements.status, 200, logs());
    assert.ok(allRestaurantMovements.body.movements.every(movement => 'materialId' in movement && movement.materialId !== legacyMaterial.id));
    const inventoryManagerMovements = await request(baseUrl, `/api/merchant/material-movements?materialId=${ingredientMaterialId}`, {
      token: inventoryManager
    });
    assert.equal(inventoryManagerMovements.status, 200, logs());
    const restrictedEmployeeMovements = await request(baseUrl, `/api/merchant/material-movements?materialId=${ingredientMaterialId}`, {
      token: merchantToken(merchantA, employeeDenied)
    });
    assert.equal(restrictedEmployeeMovements.status, 403);
    assert.equal(errorCode(restrictedEmployeeMovements.body), 'EMPLOYEE_PERMISSION_REQUIRED');
    const foreignMovements = await request(baseUrl, `/api/merchant/material-movements?materialId=${ingredientMaterialId}`, {
      token: ownerB
    });
    assert.equal(foreignMovements.status, 200, logs());
    assert.equal(foreignMovements.body.movements.length, 0);
    const otherIndustryMovements = await request(baseUrl, '/api/merchant/material-movements', {
      token: wrongIndustryOwner
    });
    assert.equal(otherIndustryMovements.status, 403);
    assert.equal(errorCode(otherIndustryMovements.body), 'APPAREL_OWN_PRODUCTION_REQUIRED');
    const excludedInbound = await request(baseUrl, `/api/merchant/materials/${ingredientMaterialId}/inbound`, {
      method: 'POST',
      token: ownerA,
      body: { quantity: 1, locationCode: 'central', idempotencyKey: `legacy-inbound-${suffix}` }
    });
    assert.equal(excludedInbound.status, 403);
    assert.equal(errorCode(excludedInbound.body), 'APPAREL_OWN_PRODUCTION_REQUIRED');

    const foreignIngredientCreate = await request(baseUrl, ingredientPath, {
      method: 'POST',
      token: ownerB,
      idempotencyKey: `foreign-ingredient-${suffix}`,
      body: { ...ingredientInput, code: `FOREIGN-${suffix}` }
    });
    assert.equal(foreignIngredientCreate.status, 201, logs());
    const recipePath = `${dishPath}/${dishId}/recipes`;
    const recipeInput = {
      yieldQuantity: '4',
      yieldUnit: 'portion',
      items: [{ ingredientId, quantity: '0.2500', wasteRate: '0.02' }]
    };
    const foreignRecipe = await request(baseUrl, recipePath, {
      method: 'POST',
      token: ownerA,
      idempotencyKey: `foreign-recipe-${suffix}`,
      body: { ...recipeInput, items: [{ ...recipeInput.items[0], ingredientId: foreignIngredientCreate.body.ingredient?.id }] }
    });
    assert.equal(foreignRecipe.status, 404);
    assert.equal(errorCode(foreignRecipe.body), 'RESTAURANT_INGREDIENT_NOT_FOUND');

    const recipeKey = `restaurant-recipe-${suffix}`;
    const recipeCreate = await request(baseUrl, recipePath, {
      method: 'POST',
      token: ownerA,
      idempotencyKey: recipeKey,
      body: recipeInput
    });
    assert.equal(recipeCreate.status, 201, logs());
    assert.equal(recipeCreate.body.recipe?.version, 1);
    assert.equal(recipeCreate.body.recipe?.status, 'draft');
    assert.equal(recipeCreate.body.recipe?.items[0]?.ingredientNameSnapshot, 'Tomato');
    assert.equal(recipeCreate.body.recipe?.items[0]?.unitSnapshot, 'kg');
    const recipeReplay = await request(baseUrl, recipePath, {
      method: 'POST',
      token: ownerA,
      idempotencyKey: recipeKey,
      body: recipeInput
    });
    assert.equal(recipeReplay.status, 200);
    assert.equal(recipeReplay.body.recipe?.id, recipeCreate.body.recipe?.id);
    assert.equal((await request(baseUrl, `${dishPath}/${dishId}/recipes`, { token: ownerB })).status, 404);
    const recipeId = recipeCreate.body.recipe?.id;
    assert.ok(recipeId);
    const recipeActivation = await request(baseUrl, `/api/merchant/restaurant/recipes/${recipeId}/activate`, {
      method: 'POST',
      token: ownerA,
      body: { expectedVersion: 1 }
    });
    assert.equal(recipeActivation.status, 200, logs());
    assert.equal(recipeActivation.body.recipe?.status, 'active');

    const recipeVersionTwo = await request(baseUrl, recipePath, {
      method: 'POST',
      token: ownerA,
      idempotencyKey: `restaurant-recipe-v2-${suffix}`,
      body: { ...recipeInput, items: [{ ingredientId, quantity: '0.3000', wasteRate: '0.02' }] }
    });
    assert.equal(recipeVersionTwo.status, 201, logs());
    assert.equal(recipeVersionTwo.body.recipe?.version, 2);
    const recipeVersionTwoId = recipeVersionTwo.body.recipe?.id;
    assert.ok(recipeVersionTwoId);
    assert.equal((await request(baseUrl, `/api/merchant/restaurant/recipes/${recipeVersionTwoId}/activate`, {
      method: 'POST',
      token: ownerA,
      body: { expectedVersion: 2 }
    })).status, 200);
    const recipeHistory = await request(baseUrl, `${dishPath}/${dishId}/recipes`, { token: ownerA });
    assert.equal(recipeHistory.status, 200);
    assert.deepEqual(
      recipeHistory.body.recipes?.map(recipe => [recipe.version, recipe.status]),
      [[2, 'active'], [1, 'archived']]
    );
    await prisma.material.update({
      where: { id: ingredientMaterialId },
      data: { unitCost: '100.0000' }
    });
    const receiptsBeforeCostRead = await prisma.restaurantPurchaseReceipt.count({ where: { purchaseOrderId } });
    const movementsBeforeCostRead = await prisma.materialInventoryMovement.count({
      where: { merchantId: merchantA, materialId: ingredientMaterialId }
    });
    const costPath = `${dishPath}/${dishId}/cost`;
    assert.equal((await request(baseUrl, costPath, { token: deniedEmployee })).status, 403);
    assert.equal((await request(baseUrl, `${dishPath}/${dishId}/cost?menuId=${menuId}`, {
      token: storePurchasingManager
    })).status, 403);
    assert.equal((await request(baseUrl, costPath, { token: ownerB })).status, 404);
    const recipeCost = await request(baseUrl, `${costPath}?menuId=${menuId}`, { token: purchasingManager });
    assert.equal(recipeCost.status, 200, logs());
    assert.equal(recipeCost.body.cost?.recipeId, recipeVersionTwoId);
    assert.equal(recipeCost.body.cost?.recipeVersion, 2);
    assert.equal(recipeCost.body.cost?.status, 'ready');
    assert.equal(recipeCost.body.cost?.method, 'weighted_average_actual_receipts');
    assert.equal(recipeCost.body.cost?.currency, 'EUR');
    assert.equal(recipeCost.body.cost?.totalBatchCost, '1.0302');
    assert.equal(recipeCost.body.cost?.costPerYield, '0.2576');
    assert.equal(recipeCost.body.cost?.sourceItemCount, 2);
    assert.equal(recipeCost.body.cost?.ingredients[0]?.averageUnitCost, '3.366667');
    assert.equal(recipeCost.body.cost?.ingredients[0]?.lineCost, '1.0302');
    const latestReceipt = await prisma.restaurantPurchaseReceipt.findFirst({
      where: { purchaseOrderId },
      orderBy: { receivedAt: 'desc' },
      select: { receivedAt: true }
    });
    assert.equal(recipeCost.body.cost?.latestSourceAt, latestReceipt?.receivedAt.toISOString());
    assert.equal(recipeCost.body.menuComparison?.status, 'ready');
    assert.equal(recipeCost.body.menuComparison?.menuPrice, '8.50');
    assert.equal(recipeCost.body.menuComparison?.grossMargin, '8.2424');
    assert.equal(recipeCost.body.menuComparison?.grossMarginRate, '96.97');
    assert.equal(await prisma.restaurantPurchaseReceipt.count({ where: { purchaseOrderId } }), receiptsBeforeCostRead);
    assert.equal(await prisma.materialInventoryMovement.count({
      where: { merchantId: merchantA, materialId: ingredientMaterialId }
    }), movementsBeforeCostRead);
    assert.equal((await prisma.material.findUniqueOrThrow({ where: { id: ingredientMaterialId } })).unitCost.toFixed(4), '100.0000');
    const mismatchedCurrencyMenu = await request(baseUrl, `${menuPath}/${menuId}`, {
      method: 'PATCH',
      token: ownerA,
      body: { expectedVersion: 2, currency: 'USD' }
    });
    assert.equal(mismatchedCurrencyMenu.status, 200, logs());
    const mismatchedMenuCost = await request(baseUrl, `${costPath}?menuId=${menuId}`, { token: purchasingManager });
    assert.equal(mismatchedMenuCost.status, 200, logs());
    assert.equal(mismatchedMenuCost.body.menuComparison?.status, 'currency_mismatch');
    assert.equal(mismatchedMenuCost.body.menuComparison?.grossMargin, null);
    assert.equal(mismatchedMenuCost.body.menuComparison?.grossMarginRate, null);
    const restoreMenuCurrency = await request(baseUrl, `${menuPath}/${menuId}`, {
      method: 'PATCH',
      token: ownerA,
      body: { expectedVersion: 3, currency: 'EUR' }
    });
    assert.equal(restoreMenuCurrency.status, 200, logs());
    assert.equal(await prisma.restaurantRecipe.count({ where: { merchantId: merchantA } }), 2);
    assert.equal(await prisma.restaurantRecipeItem.count({ where: { merchantId: merchantA } }), 2);
    assert.equal(await prisma.materialInventoryBalance.count({ where: { merchantId: merchantA, materialId: ingredientMaterialId } }), 2);
    assert.equal(await prisma.restaurantMenu.count({ where: { merchantId: merchantA } }), 3);
    assert.equal(await prisma.productBomItem.count({ where: { productId: foreignProductId } }), 0);
    assert.equal(await prisma.order.count({ where: { merchantId: merchantA } }), 0);
    const unpricedDish = await request(baseUrl, dishPath, {
      method: 'POST',
      token: ownerA,
      idempotencyKey: `unpriced-dish-${suffix}`,
      body: { name: 'Unpriced Test Dish' }
    });
    assert.equal(unpricedDish.status, 201, logs());
    const unpricedIngredient = await request(baseUrl, ingredientPath, {
      method: 'POST',
      token: ownerA,
      idempotencyKey: `unpriced-ingredient-${suffix}`,
      body: { ...ingredientInput, code: `UNPRICED-${suffix}`, name: 'Unpriced ingredient' }
    });
    assert.equal(unpricedIngredient.status, 201, logs());
    const unpricedRecipe = await request(baseUrl, `${dishPath}/${unpricedDish.body.dish?.id}/recipes`, {
      method: 'POST',
      token: ownerA,
      idempotencyKey: `unpriced-recipe-${suffix}`,
      body: {
        yieldQuantity: '2',
        yieldUnit: 'portion',
        items: [{ ingredientId: unpricedIngredient.body.ingredient?.id, quantity: '0.1', wasteRate: '0' }]
      }
    });
    assert.equal(unpricedRecipe.status, 201, logs());
    assert.equal((await request(baseUrl, `${dishPath}/${unpricedDish.body.dish?.id}/cost`, {
      token: purchasingManager
    })).status, 409);
    assert.equal((await request(baseUrl, `/api/merchant/restaurant/recipes/${unpricedRecipe.body.recipe?.id}/activate`, {
      method: 'POST',
      token: ownerA,
      body: { expectedVersion: 1 }
    })).status, 200);
    const unavailableRecipeCost = await request(baseUrl, `${dishPath}/${unpricedDish.body.dish?.id}/cost`, {
      token: purchasingManager
    });
    assert.equal(unavailableRecipeCost.status, 200, logs());
    assert.equal(unavailableRecipeCost.body.cost?.status, 'insufficient_data');
    assert.equal(unavailableRecipeCost.body.cost?.totalBatchCost, null);
    assert.equal(unavailableRecipeCost.body.cost?.costPerYield, null);

    const publicMenuCreate = await request(baseUrl, menuPath, {
      method: 'POST',
      token: ownerA,
      idempotencyKey: `public-menu-${suffix}`,
      body: { name: 'Public Lunch', currency: 'EUR' }
    });
    assert.equal(publicMenuCreate.status, 201, logs());
    const publicMenuId = publicMenuCreate.body.menu?.id;
    assert.ok(publicMenuId);
    const publicMenuItem = await request(baseUrl, `${menuPath}/${publicMenuId}/items`, {
      method: 'POST',
      token: ownerA,
      body: { dishId, price: '8.50', sortOrder: 1 }
    });
    assert.equal(publicMenuItem.status, 201, logs());
    const publishedMenu = await request(baseUrl, `${menuPath}/${publicMenuId}/publish`, {
      method: 'POST',
      token: ownerA,
      body: { expectedVersion: 1 }
    });
    assert.equal(publishedMenu.status, 200, logs());
    assert.equal(publishedMenu.body.menu?.status, 'published');
    assert.equal(publishedMenu.body.menu?.version, 2);
    assert.equal((await prisma.restaurantDish.findUniqueOrThrow({ where: { id: dishId } })).status, 'active');
    const publicMenus = await request(baseUrl, publicMenuPath);
    assert.equal(publicMenus.status, 200);
    assert.match(publicMenus.headers.get('cache-control') ?? '', /no-store/i);
    assert.equal(publicMenus.body.menus?.length, 1);
    assert.deepEqual(publicMenus.body.menus?.[0], {
      name: 'Public Lunch',
      description: '',
      currency: 'EUR',
      items: [{
        name: 'Tomato Soup',
        nameZh: '番茄汤',
        nameIt: null,
        category: '',
        description: 'Contains celery.',
        allergens: ['Celery'],
        price: '8.50',
        sortOrder: 1
      }]
    });
    assert.equal(Object.hasOwn(publicMenus.body.menus![0] as object, 'id'), false);
    assert.equal((await request(baseUrl, `${menuPath}/${publicMenuId}/publish`, {
      method: 'POST',
      token: ownerA,
      body: { expectedVersion: 1 }
    })).status, 409);
    const unpublishedMenu = await request(baseUrl, `${menuPath}/${publicMenuId}/unpublish`, {
      method: 'POST',
      token: ownerA,
      body: { expectedVersion: 2 }
    });
    assert.equal(unpublishedMenu.status, 200, logs());
    assert.equal(unpublishedMenu.body.menu?.status, 'draft');
    assert.equal(unpublishedMenu.body.menu?.version, 3);
    assert.deepEqual((await request(baseUrl, publicMenuPath)).body.menus, []);
    for (let requestNumber = 0; requestNumber < 56; requestNumber += 1) {
      assert.equal((await request(baseUrl, publicMenuPath)).status, 200);
    }
    const rateLimited = await request(baseUrl, publicMenuPath);
    assert.equal(rateLimited.status, 429);
    assert.equal(errorCode(rateLimited.body), 'API_RATE_LIMITED');
    assert.match(rateLimited.headers.get('cache-control') ?? '', /no-store/i);
  } finally {
    if (server.exitCode === null && server.signalCode === null) {
      const exited = new Promise<void>(resolve => server.once('exit', () => resolve()));
      server.kill('SIGTERM');
      await Promise.race([exited, new Promise(resolve => setTimeout(resolve, 15_000))]);
      if (server.exitCode === null && server.signalCode === null) server.kill('SIGKILL');
    }
    await prisma.$disconnect();
  }
});
