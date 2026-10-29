import 'dotenv/config';
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import jwt from 'jsonwebtoken';
import { request, type APIRequestContext } from 'playwright';
import { getIsolatedE2ETestDatabaseUrl } from '../../scripts/e2eTestDatabaseSafety';
import { merchantIndustryTemplates } from '../../src/constants/merchantIndustryTemplates';

const baseURL = process.env.E2E_BASE_URL;
const jwtSecret = process.env.JWT_ADMIN_SECRET;
const contexts: APIRequestContext[] = [];

before(() => {
  getIsolatedE2ETestDatabaseUrl({
    nodeEnv: process.env.NODE_ENV,
    testDatabaseUrl: process.env.E2E_TEST_DATABASE_URL,
    applicationDatabaseUrl: process.env.DATABASE_URL,
    allowRemoteDatabase: process.env.E2E_ALLOW_REMOTE_DATABASE
  });
  if (!baseURL) throw new Error('E2E_BASE_URL_REQUIRED');
  if (!jwtSecret) throw new Error('E2E_ADMIN_JWT_SECRET_REQUIRED');
  const target = new URL(baseURL);
  if (!['localhost', '127.0.0.1', '::1', '[::1]'].includes(target.hostname)) {
    throw new Error('E2E_TARGET_MUST_BE_LOOPBACK');
  }
});

after(async () => {
  await Promise.all(contexts.map(context => context.dispose().catch(() => undefined)));
});

async function createApi(token?: string) {
  const api = await request.newContext({
    baseURL,
    extraHTTPHeaders: {
      Accept: 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    }
  });
  contexts.push(api);
  return api;
}

test('platform merchant center enforces permission and isolates demo statistics', async () => {
  const anonymous = await createApi();
  const noSession = await anonymous.get('/api/admin/merchant-center/overview');
  assert.equal(noSession.status(), 401);
  assert.match(noSession.headers()['content-type'] || '', /application\/json/);

  const restrictedToken = jwt.sign({
    username: 'e2e-restricted-admin',
    role: 'admin',
    permissions: ['products.review']
  }, jwtSecret!);
  const restricted = await createApi(restrictedToken);
  const noPermission = await restricted.get('/api/admin/merchant-center/overview');
  assert.equal(noPermission.status(), 403);

  const adminToken = jwt.sign({
    username: 'e2e-merchant-center-admin',
    role: 'admin',
    permissions: ['merchants.review']
  }, jwtSecret!);
  const admin = await createApi(adminToken);
  const overviewResponse = await admin.get('/api/admin/merchant-center/overview');
  assert.equal(overviewResponse.status(), 200);
  const overviewPayload = await overviewResponse.json();
  assert.equal(overviewPayload.overview.demo, 7, 'all seven seeded demo merchants are separately counted');

  const official = await admin.get('/api/admin/merchant-center/merchants?page=1&pageSize=2&scope=official');
  assert.equal(official.status(), 200);
  const officialPayload = await official.json();
  assert.equal(officialPayload.total, overviewPayload.overview.total);
  assert.equal(officialPayload.merchants.length, Math.min(2, officialPayload.total));
  assert.ok(officialPayload.merchants.every((merchant: { isDemo: boolean; id: string }) =>
    !merchant.isDemo && !merchant.id.startsWith('demo-industry-')));

  const officialPageTwo = await admin.get('/api/admin/merchant-center/merchants?page=2&pageSize=2&scope=official');
  assert.equal(officialPageTwo.status(), 200);
  assert.equal((await officialPageTwo.json()).merchants.length, Math.min(2, Math.max(0, officialPayload.total - 2)));

  const demo = await admin.get('/api/admin/merchant-center/merchants?page=1&pageSize=100&scope=demo');
  assert.equal(demo.status(), 200);
  const demoPayload = await demo.json();
  assert.equal(demoPayload.total, 7);
  assert.ok(demoPayload.merchants.every((merchant: { isDemo: boolean; id: string }) =>
    merchant.isDemo && merchant.id.startsWith('demo-industry-')));

  for (const template of merchantIndustryTemplates.filter(item => item.status === 'open')) {
    const industryResponse = await admin.get(
      `/api/admin/merchant-center/merchants?page=1&pageSize=10&scope=demo&industry=${encodeURIComponent(template.id)}`
    );
    assert.equal(industryResponse.status(), 200);
    const industryPayload = await industryResponse.json();
    assert.equal(industryPayload.total, 1, `${template.id} has one dedicated demo merchant`);
    assert.equal(industryPayload.merchants[0].industryTemplate, template.id);
    assert.equal(industryPayload.merchants[0].industryName, template.zh);
  }

  const firstDemoId = demoPayload.merchants[0].id;
  const detailResponse = await admin.get(`/api/admin/merchant-center/merchants/${encodeURIComponent(firstDemoId)}`);
  assert.equal(detailResponse.status(), 200);
  const detail = (await detailResponse.json()).merchant;
  assert.equal(detail.id, firstDemoId);
  assert.equal(detail.isDemo, true);
  assert.ok(detail.counts.products > 0);
  assert.ok(detail.counts.orders > 0);

  const invalidFilter = await admin.get('/api/admin/merchant-center/merchants?industry=unknown-industry');
  assert.equal(invalidFilter.status(), 400);
});
