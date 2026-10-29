import 'dotenv/config';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import { fork, type ChildProcess } from 'node:child_process';
import crypto from 'node:crypto';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

const databaseUrl = process.env.PARTNER_TEST_DATABASE_URL;
if (process.env.NODE_ENV !== 'test') throw new Error('P0_HTTP_POSTGRES_INTEGRATION_REQUIRES_NODE_ENV_TEST');
if (!databaseUrl) throw new Error('PARTNER_TEST_DATABASE_URL_REQUIRED');

const parsedTestUrl = new URL(databaseUrl);
const databaseName = decodeURIComponent(parsedTestUrl.pathname.replace(/^\//, '').split('/')[0] || '');
if (!/(^|[-_])(test|e2e)([-_]|$)/i.test(databaseName)) {
  throw new Error('P0_HTTP_TEST_DATABASE_NAME_MUST_INCLUDE_TEST_OR_E2E');
}
if (process.env.DATABASE_URL) {
  const configuredUrl = new URL(process.env.DATABASE_URL);
  if (configuredUrl.host === parsedTestUrl.host && configuredUrl.pathname === parsedTestUrl.pathname) {
    throw new Error('P0_HTTP_TEST_DATABASE_MUST_NOT_MATCH_APPLICATION_DATABASE');
  }
}
if (!['localhost', '127.0.0.1', '::1'].includes(parsedTestUrl.hostname)) {
  throw new Error('P0_HTTP_TEST_DATABASE_MUST_BE_LOOPBACK');
}

const adminSecret = 'p0-http-admin-secret-0123456789abcdef';
const partnerSecret = 'p0-http-partner-secret-0123456789abcdef';
const webhookSecret = 'p0-http-webhook-secret';
const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });

type HttpResult = { status: number; body: Record<string, any>; headers: Headers };

async function getFreePort(): Promise<number> {
  const listener = net.createServer();
  await new Promise<void>((resolve, reject) => {
    listener.once('error', reject);
    listener.listen(0, '127.0.0.1', resolve);
  });
  const address = listener.address();
  if (!address || typeof address === 'string') throw new Error('P0_HTTP_TEST_PORT_UNAVAILABLE');
  await new Promise<void>((resolve, reject) => listener.close(error => error ? reject(error) : resolve()));
  return address.port;
}

async function request(baseUrl: string, route: string, options: {
  method?: string;
  token?: string;
  body?: unknown;
  headers?: Record<string, string>;
} = {}): Promise<HttpResult> {
  const response = await fetch(`${baseUrl}${route}`, {
    method: options.method || 'GET',
    headers: {
      ...(options.body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
      ...options.headers
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    signal: AbortSignal.timeout(20_000)
  });
  const text = await response.text();
  let body: Record<string, any> = {};
  try {
    body = text ? JSON.parse(text) as Record<string, any> : {};
  } catch {
    body = { text };
  }
  return { status: response.status, body, headers: response.headers };
}

async function waitForReady(baseUrl: string, child: ChildProcess, getLogs: () => string): Promise<void> {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`P0_HTTP_SERVER_EXITED:${child.exitCode}:${getLogs()}`);
    try {
      const response = await fetch(`${baseUrl}/api/health/ready`, { signal: AbortSignal.timeout(1_500) });
      if (response.ok) return;
    } catch {
      await new Promise(resolve => setTimeout(resolve, 400));
    }
  }
  throw new Error(`P0_HTTP_SERVER_START_TIMEOUT:${getLogs()}`);
}

function adminToken(permissions: string[]): string {
  return jwt.sign({
    id: 'p0-admin',
    username: 'p0-admin',
    role: 'admin',
    permissions
  }, adminSecret, { expiresIn: '10m' });
}

function partnerToken(partnerId: string): string {
  return jwt.sign({ id: `p0-${partnerId}`, role: 'partner', partnerId }, partnerSecret, { expiresIn: '10m' });
}

function companyToken(companyId: string): string {
  return jwt.sign({ id: `p0-${companyId}`, role: 'company', companyId }, partnerSecret, { expiresIn: '10m' });
}

async function createCustomer(prefix: string) {
  const suffix = crypto.randomUUID().replaceAll('-', '');
  return prisma.customer.create({
    data: {
      id: crypto.randomUUID(),
      companyName: `${prefix} ${suffix}`,
      vatNumber: `P0-${suffix}`,
      address: 'P0 Integration Road',
      city: 'Milan',
      country: 'IT',
      contactPerson: 'P0 Test',
      phone: `+3900${suffix.slice(0, 8)}`,
      email: `${prefix.toLowerCase()}-${suffix}@example.test`,
      registrationDate: new Date().toISOString()
    }
  });
}

async function createOrder(input: {
  customerId: string;
  partnerId: string;
  cityPartnerId?: string;
  referralId: string;
  prefix: string;
  createdAt?: Date;
  paymentStatus?: string;
  status?: string;
}) {
  const id = crypto.randomUUID();
  const orderNo = `${input.prefix}-${crypto.randomUUID().replaceAll('-', '').slice(0, 18)}`;
  const order = await prisma.order.create({
    data: {
      id,
      orderNo,
      date: new Date().toISOString(),
      customerId: input.customerId,
      companyName: `P0 ${input.prefix}`,
      totalQty: 1,
      totalAmount: 100,
      status: input.status || 'placed',
      deliveryType: 'shipping',
      paymentMethod: 'card',
      paymentStatus: input.paymentStatus || 'pending',
      timeline: '[]',
      shippingStreet: 'P0 Integration Road',
      shippingCity: 'Milan',
      shippingCountry: 'IT',
      shippingZip: '20100',
      partnerReferralId: input.referralId,
      partnerId: input.partnerId,
      ...(input.cityPartnerId ? { partnerCityAgentId: input.cityPartnerId } : {}),
      ...(input.createdAt ? { createdAt: input.createdAt } : {})
    }
  });
  return order;
}

async function sendWebhook(baseUrl: string, body: Record<string, unknown>): Promise<HttpResult> {
  const payload = JSON.stringify(body);
  const signature = crypto.createHmac('sha256', webhookSecret).update(payload).digest('hex');
  return request(baseUrl, '/api/payments/webhook/custom', {
    method: 'POST',
    body,
    headers: { 'x-payment-signature': signature }
  });
}

async function installAuditFailureTrigger(): Promise<void> {
  await prisma.$executeRawUnsafe('CREATE TABLE "P0AuditFailure" ("targetTable" TEXT NOT NULL, "action" TEXT NOT NULL, PRIMARY KEY ("targetTable", "action"))');
  await prisma.$executeRawUnsafe(`
    CREATE FUNCTION p0_reject_selected_audit() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM "P0AuditFailure"
        WHERE "targetTable" = TG_TABLE_NAME AND "action" = NEW."action"
      ) THEN
        RAISE EXCEPTION 'P0_FORCED_AUDIT_FAILURE';
      END IF;
      RETURN NEW;
    END;
    $$
  `);
  await prisma.$executeRawUnsafe(`
    CREATE TRIGGER p0_reject_audit_log
    BEFORE INSERT ON "AuditLog"
    FOR EACH ROW EXECUTE FUNCTION p0_reject_selected_audit()
  `);
  await prisma.$executeRawUnsafe(`
    CREATE TRIGGER p0_reject_partner_audit
    BEFORE INSERT ON "PartnerAuditEvent"
    FOR EACH ROW EXECUTE FUNCTION p0_reject_selected_audit()
  `);
}

async function failAuditFor(targetTable: 'AuditLog' | 'PartnerAuditEvent', action: string, enabled: boolean): Promise<void> {
  if (enabled) {
    await prisma.$executeRaw`
      INSERT INTO "P0AuditFailure" ("targetTable", "action")
      VALUES (${targetTable}, ${action})
      ON CONFLICT ("targetTable", "action") DO NOTHING
    `;
  } else {
    await prisma.$executeRaw`
      DELETE FROM "P0AuditFailure" WHERE "targetTable" = ${targetTable} AND "action" = ${action}
    `;
  }
}

async function startWorker(mode: string): Promise<ChildProcess> {
  const fixturePath = fileURLToPath(new URL('./fixtures/p0-worker-process.ts', import.meta.url));
  return fork(fixturePath, [mode], {
    cwd: process.cwd(),
    env: { ...process.env, DATABASE_URL: databaseUrl },
    execArgv: ['--import', 'tsx'],
    stdio: ['ignore', 'ignore', 'pipe', 'ipc']
  });
}

function waitForWorkerMessage(child: ChildProcess, event: string, timeoutMs = 15_000): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      child.off('message', onMessage);
      reject(new Error(`P0_WORKER_MESSAGE_TIMEOUT:${event}`));
    }, timeoutMs);
    const onMessage = (message: unknown) => {
      if (!message || typeof message !== 'object' || !('event' in message) || message.event !== event) return;
      clearTimeout(timer);
      child.off('message', onMessage);
      resolve(message as Record<string, unknown>);
    };
    child.on('message', onMessage);
    child.once('exit', code => {
      clearTimeout(timer);
      child.off('message', onMessage);
      reject(new Error(`P0_WORKER_EXITED_BEFORE_MESSAGE:${event}:${code}`));
    });
  });
}

async function waitForTaskStatus(taskId: string, statuses: string[], timeoutMs = 15_000): Promise<any> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const task = await prisma.modaGptTask.findUnique({ where: { id: taskId } });
    if (task && statuses.includes(task.status)) return task;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error(`P0_TASK_STATUS_TIMEOUT:${taskId}:${statuses.join(',')}`);
}

function waitForChildExit(child: ChildProcess, timeoutMs = 15_000): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(
      `P0_WORKER_SHUTDOWN_TIMEOUT:${child.pid}:${child.exitCode}:${child.signalCode}`
    )), timeoutMs);
    child.once('exit', () => {
      clearTimeout(timer);
      resolve();
    });
  });
}

async function stopWorker(child: ChildProcess, signal: NodeJS.Signals = 'SIGKILL'): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) return;
  const exited = waitForChildExit(child);
  child.kill(signal);
  await exited;
}

test('P0 HTTP routes, payment webhooks, CRM/Mission transactions, metrics and worker recovery run against isolated PostgreSQL', async () => {
  const suffix = crypto.randomUUID().replaceAll('-', '');
  const partnerIds = [crypto.randomUUID(), crypto.randomUUID()];
  const inactivePartnerId = crypto.randomUUID();
  const authMatrixReferralId = crypto.randomUUID();
  const cityPartnerId = crypto.randomUUID();
  const partnerCodes = [
    `AG${String(crypto.randomInt(100_000, 999_999))}`,
    `AG${String(crypto.randomInt(100_000, 999_999))}`
  ];
  if (partnerCodes[0] === partnerCodes[1]) partnerCodes[1] = `AG${String((Number(partnerCodes[1].slice(2)) + 1) % 1_000_000).padStart(6, '0')}`;
  const customerIds: string[] = [];
  const adminAccountIds: string[] = [];
  const companyIds: string[] = [];
  const companyMerchantIds: string[] = [];
  const companyProductIds: string[] = [];
  const referralIds: string[] = [];
  const campaignIds: string[] = [];
  const orderIds: string[] = [];
  const paymentIds: string[] = [];
  const refundIds: string[] = [];
  const commissionEntryIds: string[] = [];
  const adminCreatedPartnerIds: string[] = [];
  const consumerIds: string[] = [];
  const missionIds: string[] = [];
  const taskIds: string[] = [];
  let server: ChildProcess | undefined;
  let serverBaseUrl = '';
  let auditTriggerInstalled = false;
  const serverLogs: string[] = [];
  const workers: ChildProcess[] = [];
  const logs = () => serverLogs.join('').slice(-12_000);
  const fullAdmin = adminToken(['growth.partners', 'settings.ai_support']);
  const noPartnerPermissionAdmin = adminToken(['settings.ai_support']);
  const noGrowthPermissionAdmin = adminToken([]);
  const protectedPartnerRequests = [
    { path: '/api/partner/profile' },
    { path: '/api/partner/customers' },
    { path: '/api/partner/campaigns' },
    { path: '/api/partner/commissions' },
    {
      path: '/api/partner/campaigns',
      method: 'POST',
      body: { name: 'Unauthorized campaign', channel: 'instagram' }
    }
  ];
  const protectedAdminPartnerRequests: Array<{ path: string; method?: string; body?: unknown }> = [
    { path: '/api/admin/partners/overview' },
    { path: '/api/admin/partners' },
    { path: '/api/admin/partners', method: 'POST', body: {} },
    { path: `/api/admin/partners/${partnerIds[0]}/status`, method: 'PATCH', body: {} },
    { path: `/api/admin/partners/${partnerIds[0]}/commission-rate`, method: 'PATCH', body: {} },
    {
      path: `/api/admin/partners/referrals/${authMatrixReferralId}/attribution`,
      method: 'PATCH',
      body: { partnerId: partnerIds[0], reason: 'Authorization test' }
    },
    {
      path: `/api/admin/partners/${partnerIds[0]}/campaigns`,
      method: 'POST',
      body: { name: 'Unauthorized admin campaign', channel: 'facebook' }
    },
    { path: '/api/admin/partners/commissions' },
    {
      path: `/api/admin/partners/commissions/${crypto.randomUUID()}/approve`,
      method: 'POST',
      body: {}
    }
  ];
  const protectedAiProviderRequests: Array<{ path: string; method?: string }> = [
    { path: '/api/admin/ai-employee-providers' },
    { path: '/api/admin/ai-employee-providers/test-local-models', method: 'POST' },
    { path: '/api/admin/ai-employee-providers/test-deepseek', method: 'POST' },
    { path: '/api/admin/ai-employee-providers/test-openai', method: 'POST' },
    { path: '/api/admin/ai-employee-providers/test-gemini', method: 'POST' },
    { path: '/api/admin/ai-employee-providers/test-fal', method: 'POST' }
  ];
  const marketingCampaignTag = `p0-${suffix}`;

  try {
    await prisma.partner.create({
      data: {
        id: cityPartnerId,
        partnerCode: `CITY${String(crypto.randomInt(100_000, 999_999))}`,
        role: 'city_agent',
        status: 'active',
        name: `P0 City Partner ${suffix}`,
        email: `p0-city-${suffix}@example.test`,
        cityCommissionRate: 5
      }
    });
    await prisma.partner.createMany({
      data: partnerIds.map((id, index) => ({
        id,
        partnerCode: partnerCodes[index],
        role: 'agent',
        status: 'active',
        name: `P0 Partner ${index}`,
        email: `p0-partner-${suffix}-${index}@example.test`,
        commissionRate: 20,
        ...(index === 0 ? { parentId: cityPartnerId } : {})
      }))
    });
    await prisma.partner.create({
      data: {
        id: inactivePartnerId,
        partnerCode: `AG${String(crypto.randomInt(100_000, 999_999))}`,
        role: 'agent',
        status: 'paused',
        name: `P0 Paused Partner ${suffix}`,
        email: `p0-paused-${suffix}@example.test`
      }
    });
    const [customerA, customerB, unknownCustomer] = await Promise.all([
      createCustomer('P0 attributed'),
      createCustomer('P0 reassigned'),
      createCustomer('P0 unknown')
    ]);
    customerIds.push(customerA.id, customerB.id, unknownCustomer.id);
    const [referralA, referralB] = await Promise.all([
      prisma.partnerReferral.create({
        data: {
          id: crypto.randomUUID(),
          customerId: customerA.id,
          partnerId: partnerIds[0],
          cityPartnerId
        }
      }),
      prisma.partnerReferral.create({
        data: {
          id: crypto.randomUUID(),
          customerId: customerB.id,
          partnerId: partnerIds[1]
        }
      })
    ]);
    referralIds.push(referralA.id, referralB.id);

    const port = await getFreePort();
    serverBaseUrl = `http://127.0.0.1:${port}`;
    server = fork(path.resolve('server.ts'), [], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        NODE_ENV: 'test',
        P0_HTTP_TEST_MODE: 'true',
        DATABASE_URL: databaseUrl,
        PORT: String(port),
        JWT_ADMIN_SECRET: adminSecret,
        JWT_BUYER_SECRET: partnerSecret,
        JWT_MERCHANT_SECRET: 'p0-http-merchant-secret-0123456789abcdef',
        SHARE_LINK_SECRET: 'p0-http-share-secret-0123456789abcdef',
        ADMIN_TOTP_ENCRYPTION_KEY: 'p0-http-totp-secret-0123456789abcdef',
        PAYMENT_PROVIDER: 'custom',
        PAYMENT_PROVIDER_SECRET: webhookSecret,
        PAYMENT_WEBHOOK_SECRET: webhookSecret,
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
    await waitForReady(serverBaseUrl, server, logs);

    const tokenA = partnerToken(partnerIds[0]);
    const tokenB = partnerToken(partnerIds[1]);
    const cityToken = partnerToken(cityPartnerId);
    const inactivePartnerToken = partnerToken(inactivePartnerId);
    for (const partnerRequest of protectedPartnerRequests) {
      const unauthenticated = await request(serverBaseUrl, partnerRequest.path, partnerRequest);
      assert.equal(unauthenticated.status, 401, `anonymous access to ${partnerRequest.path}`);
      assert.equal(unauthenticated.body.error.code, 'PARTNER_AUTH_REQUIRED');
      assert.equal(unauthenticated.body.requestId, unauthenticated.headers.get('x-request-id'));
      const administrator = await request(serverBaseUrl, partnerRequest.path, { ...partnerRequest, token: fullAdmin });
      assert.equal(administrator.status, 401, `admin token access to ${partnerRequest.path}`);
      assert.equal(administrator.body.error.code, 'PARTNER_AUTH_REQUIRED');
      const pausedPartner = await request(serverBaseUrl, partnerRequest.path, {
        ...partnerRequest,
        token: inactivePartnerToken
      });
      assert.equal(pausedPartner.status, 403, `paused Partner access to ${partnerRequest.path}`);
      assert.equal(pausedPartner.body.error.code, 'PARTNER_ACCOUNT_INACTIVE');
    }
    assert.equal((await request(serverBaseUrl, '/api/partner/profile', { token: tokenA })).status, 200);
    const customersA = await request(serverBaseUrl, '/api/partner/customers', { token: tokenA });
    const customersB = await request(serverBaseUrl, '/api/partner/customers', { token: tokenB });
    assert.ok(customersA.body.customers.some((item: { customer: { id: string } }) => item.customer.id === customerA.id));
    assert.ok(customersA.body.customers.every((item: { customer: { id: string } }) => item.customer.id !== customerB.id));
    assert.ok(customersB.body.customers.some((item: { customer: { id: string } }) => item.customer.id === customerB.id));
    assert.ok(customersB.body.customers.every((item: { customer: { id: string } }) => item.customer.id !== customerA.id));
    const cityCustomers = await request(serverBaseUrl, '/api/partner/customers', { token: cityToken });
    assert.ok(cityCustomers.body.customers.some((item: { customer: { id: string } }) => item.customer.id === customerA.id));
    assert.ok(cityCustomers.body.customers.every((item: { customer: { id: string } }) => item.customer.id !== customerB.id));
    for (const adminRequest of protectedAdminPartnerRequests) {
      const unauthenticated = await request(serverBaseUrl, adminRequest.path, adminRequest);
      assert.equal(unauthenticated.status, 401, `anonymous access to ${adminRequest.path}`);
      assert.equal(unauthenticated.body.error.code, 'ADMIN_AUTH_REQUIRED');
      const insufficientAdmin = await request(serverBaseUrl, adminRequest.path, {
        ...adminRequest,
        token: noGrowthPermissionAdmin
      });
      assert.equal(insufficientAdmin.status, 403, `insufficient admin permission for ${adminRequest.path}`);
      assert.equal(insufficientAdmin.body.error.code, 'ADMIN_PERMISSION_REQUIRED');
      assert.equal(insufficientAdmin.body.error.details.permission, 'growth.partners');
    }
    for (const providerRequest of protectedAiProviderRequests) {
      const unauthenticated = await request(serverBaseUrl, providerRequest.path, providerRequest);
      assert.equal(unauthenticated.status, 401, `anonymous access to ${providerRequest.path}`);
      assert.equal(unauthenticated.body.error.code, 'ADMIN_AUTH_REQUIRED');
      const insufficientAdmin = await request(serverBaseUrl, providerRequest.path, {
        ...providerRequest,
        token: noGrowthPermissionAdmin
      });
      assert.equal(insufficientAdmin.status, 403, `insufficient admin permission for ${providerRequest.path}`);
      assert.equal(insufficientAdmin.body.error.code, 'ADMIN_PERMISSION_REQUIRED');
      assert.equal(insufficientAdmin.body.error.details.permission, 'settings.ai_support');
    }
    assert.equal((await request(serverBaseUrl, '/api/admin/partners/overview', { token: fullAdmin })).status, 200);
    const adminPartnerList = await request(serverBaseUrl, '/api/admin/partners', { token: fullAdmin });
    assert.equal(adminPartnerList.status, 200);
    assert.ok(adminPartnerList.body.partners.some((partner: { id: string }) => partner.id === partnerIds[0]));
    const adminCreatedPartnerResponse = await request(serverBaseUrl, '/api/admin/partners', {
      method: 'POST',
      token: fullAdmin,
      body: {
        role: 'agent',
        name: `P0 Admin-created Partner ${suffix}`,
        email: `p0-admin-created-${suffix}@example.test`,
        password: 'p0-admin-created-password',
        status: 'pending',
        commissionRate: 2,
        country: 'IT'
      }
    });
    assert.equal(adminCreatedPartnerResponse.status, 201);
    const adminCreatedPartnerId = adminCreatedPartnerResponse.body.partner.id as string;
    adminCreatedPartnerIds.push(adminCreatedPartnerId);
    assert.ok(await prisma.authAccount.findUnique({ where: { partnerId: adminCreatedPartnerId } }));
    const activateCreatedPartner = await request(
      serverBaseUrl,
      `/api/admin/partners/${adminCreatedPartnerId}/status`,
      { method: 'PATCH', token: fullAdmin, body: { status: 'active' } }
    );
    assert.equal(activateCreatedPartner.status, 200);
    assert.equal(activateCreatedPartner.body.partner.status, 'active');
    const updateCreatedPartnerRate = await request(
      serverBaseUrl,
      `/api/admin/partners/${adminCreatedPartnerId}/commission-rate`,
      { method: 'PATCH', token: fullAdmin, body: { rate: 12.5 } }
    );
    assert.equal(updateCreatedPartnerRate.status, 200);
    assert.equal(Number(updateCreatedPartnerRate.body.partner.commissionRate), 12.5);
    assert.equal(await prisma.partnerAuditEvent.count({
      where: {
        partnerId: adminCreatedPartnerId,
        action: { in: ['partner_created', 'partner_status_changed', 'commission_rate_changed'] }
      }
    }), 3);
    const forbiddenWorkers = await request(serverBaseUrl, '/api/admin/growth/workers', { token: noGrowthPermissionAdmin });
    assert.equal(forbiddenWorkers.status, 403);
    assert.equal(forbiddenWorkers.body.error.details.permission, 'settings.ai_support');
    const workerCenter = await request(serverBaseUrl, '/api/admin/growth/workers', { token: fullAdmin });
    assert.equal(workerCenter.status, 200, logs());
    assert.equal(workerCenter.body.workers.find((worker: { id: string }) => worker.id === 'growth-mission-review-worker').runtimeStatus, 'stopped');
    assert.equal((await request(serverBaseUrl, '/api/marketing/events', {
      method: 'POST',
      body: { event: 'page_view', page: 'home', campaign: marketingCampaignTag }
    })).status, 400);
    const marketingEventResponse = await request(serverBaseUrl, '/api/marketing/events', {
      method: 'POST',
      body: {
        consent: true,
        event: 'page_view',
        page: 'home',
        source: 'p0_source',
        medium: 'integration_test',
        campaign: marketingCampaignTag
      }
    });
    assert.equal(marketingEventResponse.status, 202);
    assert.equal(await prisma.growthMarketingEvent.count({ where: { campaign: marketingCampaignTag } }), 1);

    const createdCampaignResponse = await request(serverBaseUrl, '/api/partner/campaigns', {
      method: 'POST',
      token: tokenA,
      body: { name: 'P0 owned campaign', channel: 'instagram', partnerId: partnerIds[1] }
    });
    assert.equal(createdCampaignResponse.status, 201);
    const ownedCampaign = createdCampaignResponse.body.campaign;
    assert.equal(ownedCampaign.partnerId, partnerIds[0]);
    campaignIds.push(ownedCampaign.id);
    const campaignsA = await request(serverBaseUrl, '/api/partner/campaigns', { token: tokenA });
    const campaignsB = await request(serverBaseUrl, '/api/partner/campaigns', { token: tokenB });
    const cityCampaigns = await request(serverBaseUrl, '/api/partner/campaigns', { token: cityToken });
    assert.ok(campaignsA.body.campaigns.some((item: { id: string }) => item.id === ownedCampaign.id));
    assert.ok(campaignsB.body.campaigns.every((item: { id: string }) => item.id !== ownedCampaign.id));
    const cityOwnedCampaign = cityCampaigns.body.campaigns.find((item: { id: string }) => item.id === ownedCampaign.id);
    assert.ok(cityOwnedCampaign);
    assert.equal(new URL(cityOwnedCampaign.url).searchParams.get('ref'), partnerCodes[0]);
    const adminCampaignResponse = await request(serverBaseUrl, `/api/admin/partners/${partnerIds[1]}/campaigns`, {
      method: 'POST',
      token: fullAdmin,
      body: { name: 'P0 admin-owned campaign', channel: 'facebook', partnerId: partnerIds[0] }
    });
    assert.equal(adminCampaignResponse.status, 201);
    assert.equal(adminCampaignResponse.body.campaign.partnerId, partnerIds[1]);
    campaignIds.push(adminCampaignResponse.body.campaign.id);
    assert.ok((await request(serverBaseUrl, '/api/partner/campaigns', { token: tokenB }))
      .body.campaigns.some((item: { id: string }) => item.id === adminCampaignResponse.body.campaign.id));

    const clickResponse = await request(serverBaseUrl, '/api/partner/referral-click', {
      method: 'POST',
      body: {
        partnerCode: partnerCodes[0],
        campaignCode: ownedCampaign.campaignCode,
        visitorKey: crypto.randomUUID(),
        landingPath: '/it/',
        source: 'forged-source'
      }
    });
    assert.equal(clickResponse.status, 200);
    const click = await prisma.partnerReferralClick.findUniqueOrThrow({ where: { id: clickResponse.body.clickId } });
    assert.equal(click.source, 'instagram');
    assert.equal(click.partnerId, partnerIds[0]);
    const crossCampaignClick = await request(serverBaseUrl, '/api/partner/referral-click', {
      method: 'POST',
      body: {
        partnerCode: partnerCodes[1],
        campaignCode: ownedCampaign.campaignCode,
        visitorKey: crypto.randomUUID()
      }
    });
    assert.equal(crossCampaignClick.status, 404);

    assert.equal((await request(serverBaseUrl, `/api/admin/partners/referrals/${referralB.id}/attribution`, {
      method: 'PATCH',
      token: tokenA,
      body: { partnerId: partnerIds[0], reason: 'P0 HTTP attribution correction' }
    })).status, 401);
    const adjustedReferral = await request(serverBaseUrl, `/api/admin/partners/referrals/${referralB.id}/attribution`, {
      method: 'PATCH',
      token: fullAdmin,
      body: { partnerId: partnerIds[0], reason: 'P0 HTTP attribution correction' }
    });
    assert.equal(adjustedReferral.status, 200);
    assert.equal(adjustedReferral.body.referral.partnerId, partnerIds[0]);
    assert.equal(await prisma.partnerReferralChange.count({ where: { referralId: referralB.id } }), 1);
    assert.equal(await prisma.partnerAuditEvent.count({
      where: { action: 'referral_attribution_changed', entityId: referralB.id }
    }), 1);

    const now = new Date();
    const priorPaidOrder = await createOrder({
      customerId: customerA.id,
      partnerId: partnerIds[0],
      cityPartnerId,
      referralId: referralA.id,
      prefix: 'P0-OLD',
      createdAt: new Date(now.getTime() - 45 * 24 * 60 * 60 * 1000),
      paymentStatus: 'paid',
      status: 'confirmed'
    });
    orderIds.push(priorPaidOrder.id);
    const order = await createOrder({
      customerId: customerA.id,
      partnerId: partnerIds[0],
      cityPartnerId,
      referralId: referralA.id,
      prefix: 'P0-PAY'
    });
    orderIds.push(order.id);
    const paymentId = crypto.randomUUID();
    paymentIds.push(paymentId);
    const unrelatedOrder = await createOrder({
      customerId: customerB.id,
      partnerId: partnerIds[1],
      referralId: referralB.id,
      prefix: 'P0-NULL-PAYMENT'
    });
    orderIds.push(unrelatedOrder.id);
    const unrelatedPaymentId = crypto.randomUUID();
    paymentIds.push(unrelatedPaymentId);
    await prisma.paymentTransaction.create({
      data: {
        id: unrelatedPaymentId,
        orderId: unrelatedOrder.id,
        provider: 'custom',
        providerPaymentId: null,
        amount: 50,
        currency: 'EUR',
        status: 'pending'
      }
    });
    await prisma.paymentTransaction.create({
      data: {
        id: paymentId,
        orderId: order.id,
        provider: 'custom',
        providerPaymentId: null,
        amount: 100,
        currency: 'EUR',
        status: 'pending'
      }
    });
    const paymentBody = {
      eventId: `p0-payment-event-${suffix}`,
      type: 'payment.succeeded',
      orderId: order.id,
      providerPaymentId: `p0-payment-${suffix}`,
      amount: 100,
      currency: 'EUR'
    };
    const paymentResults = await Promise.all([
      sendWebhook(serverBaseUrl, paymentBody),
      sendWebhook(serverBaseUrl, { ...paymentBody, eventId: `p0-payment-concurrent-${suffix}` })
    ]);
    assert.ok(paymentResults.every(result => result.status === 200));
    assert.equal((await prisma.paymentTransaction.findUniqueOrThrow({ where: { id: paymentId } })).status, 'paid');
    const unrelatedPayment = await prisma.paymentTransaction.findUniqueOrThrow({ where: { id: unrelatedPaymentId } });
    assert.equal(unrelatedPayment.status, 'pending');
    assert.equal(unrelatedPayment.providerPaymentId, null);
    assert.equal(await prisma.partnerCommissionEntry.count({
      where: { orderId: order.id, entryType: 'commission' }
    }), 2);
    assert.equal(await prisma.partnerAuditEvent.count({
      where: { action: 'commission_created', entityId: order.id }
    }), 1);
    assert.equal((await prisma.partnerReferral.findUniqueOrThrow({ where: { id: referralA.id } })).firstPaidAt instanceof Date, true);
    const duplicatePayment = await sendWebhook(serverBaseUrl, paymentBody);
    assert.equal(duplicatePayment.body.duplicate, true);
    const adminCommissions = await request(serverBaseUrl, '/api/admin/partners/commissions?status=pending', {
      token: fullAdmin
    });
    assert.equal(adminCommissions.status, 200);
    assert.ok(adminCommissions.body.entries.some((entry: { orderId: string }) => entry.orderId === order.id));
    const commissionToApprove = await prisma.partnerCommissionEntry.findFirst({
      where: { orderId: order.id, entryType: 'commission', status: 'pending' },
      select: { id: true }
    });
    assert.ok(commissionToApprove);
    commissionEntryIds.push(commissionToApprove.id);
    const approvedCommission = await request(
      serverBaseUrl,
      `/api/admin/partners/commissions/${commissionToApprove.id}/approve`,
      { method: 'POST', token: fullAdmin, body: {} }
    );
    assert.equal(approvedCommission.status, 200);
    assert.equal(approvedCommission.body.entry.status, 'approved');
    assert.equal(await prisma.partnerAuditEvent.count({
      where: { action: 'commission_approved', entityId: commissionToApprove.id }
    }), 1);
    const commissionsA = await request(serverBaseUrl, '/api/partner/commissions', { token: tokenA });
    const commissionsB = await request(serverBaseUrl, '/api/partner/commissions', { token: tokenB });
    const cityCommissions = await request(serverBaseUrl, '/api/partner/commissions', { token: cityToken });
    assert.ok(commissionsA.body.entries.some((entry: { orderId: string }) => entry.orderId === order.id));
    assert.ok(commissionsB.body.entries.every((entry: { orderId: string }) => entry.orderId !== order.id));
    assert.ok(cityCommissions.body.entries.some((entry: { orderId: string; partnerId: string }) =>
      entry.orderId === order.id && entry.partnerId === cityPartnerId));
    const cityProfile = await request(serverBaseUrl, '/api/partner/profile', { token: cityToken });
    assert.ok(cityProfile.body.stats.commissions > 0);
    assert.ok(cityProfile.body.stats.activeCampaigns > 0);

    const refundA = crypto.randomUUID();
    const refundB = crypto.randomUUID();
    refundIds.push(refundA, refundB);
    await prisma.refundTransaction.createMany({
      data: [
        {
          id: refundA,
          paymentTransactionId: paymentId,
          orderId: order.id,
          providerRefundId: `p0-refund-${suffix}-a`,
          amount: 25,
          status: 'processing'
        },
        {
          id: refundB,
          paymentTransactionId: paymentId,
          orderId: order.id,
          providerRefundId: `p0-refund-${suffix}-b`,
          amount: 75,
          status: 'processing'
        }
      ]
    });
    const refundResultA = await sendWebhook(serverBaseUrl, {
      eventId: `p0-refund-event-a-${suffix}`,
      type: 'refund.succeeded',
      orderId: order.id,
      amount: 25,
      currency: 'EUR',
      data: { object: { id: `p0-refund-${suffix}-a`, payment_intent: `p0-payment-${suffix}` } }
    });
    assert.equal(refundResultA.status, 200);
    const duplicateRefundA = await sendWebhook(serverBaseUrl, {
      eventId: `p0-refund-event-a-${suffix}`,
      type: 'refund.succeeded',
      orderId: order.id,
      amount: 25,
      currency: 'EUR',
      data: { object: { id: `p0-refund-${suffix}-a`, payment_intent: `p0-payment-${suffix}` } }
    });
    assert.equal(duplicateRefundA.body.duplicate, true);
    const refundResults = await Promise.all([
      sendWebhook(serverBaseUrl, {
        eventId: `p0-refund-event-b-${suffix}`,
        type: 'refund.succeeded',
        orderId: order.id,
        amount: 75,
        currency: 'EUR',
        data: { object: { id: `p0-refund-${suffix}-b`, payment_intent: `p0-payment-${suffix}` } }
      }),
      sendWebhook(serverBaseUrl, {
        eventId: `p0-refund-event-b-replay-${suffix}`,
        type: 'refund.succeeded',
        orderId: order.id,
        amount: 75,
        currency: 'EUR',
        data: { object: { id: `p0-refund-${suffix}-b`, payment_intent: `p0-payment-${suffix}` } }
      })
    ]);
    assert.ok(refundResults.every(result => result.status === 200));
    assert.equal(await prisma.partnerCommissionEntry.count({
      where: { orderId: order.id, entryType: 'reversal' }
    }), 4);
    assert.equal(await prisma.partnerAuditEvent.count({
      where: { action: 'commission_refund_reversed', entityId: { in: (await prisma.partnerCommissionEntry.findMany({
        where: { orderId: order.id, entryType: 'commission' }, select: { id: true }
      })).map(entry => entry.id) } }
    }), 4);
    const orderEntries = await prisma.partnerCommissionEntry.findMany({ where: { orderId: order.id } });
    assert.equal(orderEntries.reduce((sum, entry) => sum + Number(entry.amount), 0), 0);

    await installAuditFailureTrigger();
    auditTriggerInstalled = true;
    const failedCommissionOrder = await createOrder({
      customerId: customerA.id,
      partnerId: partnerIds[0],
      cityPartnerId,
      referralId: referralA.id,
      prefix: 'P0-ROLLBACK'
    });
    orderIds.push(failedCommissionOrder.id);
    const failedCommissionPaymentId = crypto.randomUUID();
    paymentIds.push(failedCommissionPaymentId);
    await prisma.paymentTransaction.create({
      data: {
        id: failedCommissionPaymentId,
        orderId: failedCommissionOrder.id,
        provider: 'custom',
        providerPaymentId: `p0-payment-rollback-${suffix}`,
        amount: 100,
        currency: 'EUR',
        status: 'pending'
      }
    });
    await failAuditFor('PartnerAuditEvent', 'commission_created', true);
    const failedPaymentResponse = await sendWebhook(serverBaseUrl, {
      eventId: `p0-rollback-event-${suffix}`,
      type: 'payment.succeeded',
      orderId: failedCommissionOrder.id,
      providerPaymentId: `p0-payment-rollback-${suffix}`,
      amount: 100,
      currency: 'EUR'
    });
    assert.ok(failedPaymentResponse.status >= 500);
    assert.equal(await prisma.paymentWebhookEvent.count({
      where: { provider: 'custom', providerEventId: `p0-rollback-event-${suffix}` }
    }), 0);
    assert.equal((await prisma.paymentTransaction.findUniqueOrThrow({ where: { id: failedCommissionPaymentId } })).status, 'pending');
    assert.equal((await prisma.order.findUniqueOrThrow({ where: { id: failedCommissionOrder.id } })).paymentStatus, 'pending');
    assert.equal(await prisma.partnerCommissionEntry.count({ where: { orderId: failedCommissionOrder.id } }), 0);
    await failAuditFor('PartnerAuditEvent', 'commission_created', false);
    const failedRefundOrder = await createOrder({
      customerId: customerA.id,
      partnerId: partnerIds[0],
      cityPartnerId,
      referralId: referralA.id,
      prefix: 'P0-REFUND-ROLLBACK'
    });
    orderIds.push(failedRefundOrder.id);
    const failedRefundPaymentId = crypto.randomUUID();
    const failedRefundId = crypto.randomUUID();
    paymentIds.push(failedRefundPaymentId);
    refundIds.push(failedRefundId);
    await prisma.paymentTransaction.create({
      data: {
        id: failedRefundPaymentId,
        orderId: failedRefundOrder.id,
        provider: 'custom',
        providerPaymentId: `p0-payment-refund-rollback-${suffix}`,
        amount: 100,
        currency: 'EUR',
        status: 'pending'
      }
    });
    assert.equal((await sendWebhook(serverBaseUrl, {
      eventId: `p0-payment-refund-rollback-${suffix}`,
      type: 'payment.succeeded',
      orderId: failedRefundOrder.id,
      providerPaymentId: `p0-payment-refund-rollback-${suffix}`,
      amount: 100,
      currency: 'EUR'
    })).status, 200);
    await prisma.refundTransaction.create({
      data: {
        id: failedRefundId,
        paymentTransactionId: failedRefundPaymentId,
        orderId: failedRefundOrder.id,
        providerRefundId: `p0-refund-rollback-${suffix}`,
        amount: 50,
        status: 'processing'
      }
    });
    await failAuditFor('PartnerAuditEvent', 'commission_refund_reversed', true);
    const failedRefundResponse = await sendWebhook(serverBaseUrl, {
      eventId: `p0-refund-rollback-event-${suffix}`,
      type: 'refund.succeeded',
      orderId: failedRefundOrder.id,
      amount: 50,
      currency: 'EUR',
      data: { object: { id: `p0-refund-rollback-${suffix}`, payment_intent: `p0-payment-refund-rollback-${suffix}` } }
    });
    assert.ok(failedRefundResponse.status >= 500);
    assert.equal(await prisma.paymentWebhookEvent.count({
      where: { provider: 'custom', providerEventId: `p0-refund-rollback-event-${suffix}` }
    }), 0);
    assert.equal((await prisma.refundTransaction.findUniqueOrThrow({ where: { id: failedRefundId } })).status, 'processing');
    assert.equal(await prisma.partnerCommissionEntry.count({ where: { orderId: failedRefundOrder.id, entryType: 'reversal' } }), 0);
    await failAuditFor('PartnerAuditEvent', 'commission_refund_reversed', false);

    const staleConsumerId = crypto.randomUUID();
    consumerIds.push(staleConsumerId);
    await prisma.consumer.create({
      data: {
        id: staleConsumerId,
        email: `p0-growth-${suffix}@example.test`,
        passwordHash: 'p0-integration-hash',
        firstName: 'P0',
        lastName: 'Activation',
        status: 'active',
        ordersCount: 0,
        createdAt: new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000)
      }
    });
    const retainedConsumerId = crypto.randomUUID();
    consumerIds.push(retainedConsumerId);
    await prisma.consumer.create({
      data: {
        id: retainedConsumerId,
        email: `p0-retained-${suffix}@example.test`,
        passwordHash: 'p0-integration-hash',
        firstName: 'P0',
        lastName: 'Returning',
        status: 'active',
        ordersCount: 2,
        createdAt: new Date(now.getTime() - 45 * 24 * 60 * 60 * 1000),
        lastLoginAt: now
      }
    });
    assert.equal((await request(serverBaseUrl, '/api/admin/growth/crm/automation/run', { method: 'POST' })).status, 401);
    assert.equal((await request(serverBaseUrl, '/api/admin/growth/crm/automation/run', {
      method: 'POST',
      token: noGrowthPermissionAdmin
    })).status, 403);
    await failAuditFor('AuditLog', 'GROWTH_CRM_AUTOMATION_CANDIDATES_CREATED', true);
    const rejectedCandidates = await request(serverBaseUrl, '/api/admin/growth/crm/automation/run', {
      method: 'POST',
      token: fullAdmin
    });
    assert.ok(rejectedCandidates.status >= 500);
    assert.equal(await prisma.growthCrmFollowUp.count({ where: { consumerId: staleConsumerId, category: 'activation' } }), 0);
    await failAuditFor('AuditLog', 'GROWTH_CRM_AUTOMATION_CANDIDATES_CREATED', false);
    const beforeCandidateAuditCount = await prisma.auditLog.count({ where: { action: 'GROWTH_CRM_AUTOMATION_CANDIDATES_CREATED' } });
    const acceptedCandidates = await request(serverBaseUrl, '/api/admin/growth/crm/automation/run', {
      method: 'POST',
      token: fullAdmin
    });
    assert.equal(acceptedCandidates.status, 200);
    assert.equal(acceptedCandidates.body.created, 1);
    assert.equal(await prisma.auditLog.count({ where: { action: 'GROWTH_CRM_AUTOMATION_CANDIDATES_CREATED' } }), beforeCandidateAuditCount + 1);
    const replayCandidates = await request(serverBaseUrl, '/api/admin/growth/crm/automation/run', {
      method: 'POST',
      token: fullAdmin
    });
    assert.equal(replayCandidates.status, 200);
    assert.equal(replayCandidates.body.created, 0);
    assert.equal(await prisma.growthCrmFollowUp.count({ where: { consumerId: staleConsumerId, category: 'activation' } }), 1);
    assert.equal(await prisma.auditLog.count({ where: { action: 'GROWTH_CRM_AUTOMATION_CANDIDATES_CREATED' } }), beforeCandidateAuditCount + 1);

    const followUpInput = {
      subjectType: 'consumer',
      subjectId: staleConsumerId,
      category: 'activation',
      note: 'P0 HTTP follow-up test record',
      dueAt: new Date(Date.now() + 60_000).toISOString()
    };
    const beforeFollowUpAuditCount = await prisma.auditLog.count({ where: { action: 'GROWTH_CRM_FOLLOW_UP_CREATED' } });
    await failAuditFor('AuditLog', 'GROWTH_CRM_FOLLOW_UP_CREATED', true);
    const failedFollowUp = await request(serverBaseUrl, '/api/admin/growth/crm/follow-ups', {
      method: 'POST',
      token: fullAdmin,
      body: followUpInput
    });
    assert.ok(failedFollowUp.status >= 500);
    assert.equal(await prisma.growthCrmFollowUp.count({ where: { consumerId: staleConsumerId, note: followUpInput.note } }), 0);
    assert.equal(
      await prisma.auditLog.count({ where: { action: 'GROWTH_CRM_FOLLOW_UP_CREATED' } }),
      beforeFollowUpAuditCount
    );
    await failAuditFor('AuditLog', 'GROWTH_CRM_FOLLOW_UP_CREATED', false);
    const followUpResponse = await request(serverBaseUrl, '/api/admin/growth/crm/follow-ups', {
      method: 'POST',
      token: fullAdmin,
      body: followUpInput
    });
    assert.equal(followUpResponse.status, 201);
    const followUpId = followUpResponse.body.followUp.id as string;
    const editedFollowUp = await request(serverBaseUrl, `/api/admin/growth/crm/follow-ups/${followUpId}`, {
      method: 'PUT',
      token: fullAdmin,
      body: { note: 'Updated by P0 HTTP integration', dueAt: new Date(Date.now() + 120_000).toISOString() }
    });
    assert.equal(editedFollowUp.status, 200);
    const completedFollowUp = await request(serverBaseUrl, `/api/admin/growth/crm/follow-ups/${followUpId}`, {
      method: 'PATCH',
      token: fullAdmin,
      body: { status: 'completed', resolutionNote: 'verified through real API' }
    });
    assert.equal(completedFollowUp.status, 200);
    assert.equal((await prisma.growthCrmFollowUp.findUniqueOrThrow({ where: { id: followUpId } })).status, 'completed');

    const missionInput = {
      name: `P0 Mission ${suffix.slice(0, 12)}`,
      objective: 'Exercise the persisted P0 mission workflow',
      audience: 'Existing B2B customers',
      markets: ['europe'],
      channels: ['instagram'],
      budgetAmount: 0,
      budgetCurrency: 'EUR',
      conversionGoal: 'qualified inquiry',
      landingPath: '/it/',
      startAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      endAt: new Date(Date.now() + 8 * 24 * 60 * 60 * 1000).toISOString()
    };
    const idempotencyKey = `p0-mission:${suffix}`;
    assert.equal((await request(serverBaseUrl, '/api/admin/growth/missions', {
      method: 'POST',
      headers: { 'Idempotency-Key': idempotencyKey },
      body: missionInput
    })).status, 401);
    await failAuditFor('AuditLog', 'GROWTH_MISSION_PLAN_CREATED', true);
    const rejectedMission = await request(serverBaseUrl, '/api/admin/growth/missions', {
      method: 'POST',
      token: fullAdmin,
      headers: { 'Idempotency-Key': idempotencyKey },
      body: missionInput
    });
    assert.ok(rejectedMission.status >= 500);
    assert.equal(await prisma.growthMission.count({ where: { idempotencyKey } }), 0);
    await failAuditFor('AuditLog', 'GROWTH_MISSION_PLAN_CREATED', false);
    const missionCreate = await request(serverBaseUrl, '/api/admin/growth/missions', {
      method: 'POST',
      token: fullAdmin,
      headers: { 'Idempotency-Key': idempotencyKey },
      body: missionInput
    });
    assert.equal(missionCreate.status, 201);
    const missionId = missionCreate.body.mission.id as string;
    missionIds.push(missionId);
    const missionDuplicate = await request(serverBaseUrl, '/api/admin/growth/missions', {
      method: 'POST',
      token: fullAdmin,
      headers: { 'Idempotency-Key': idempotencyKey },
      body: missionInput
    });
    assert.equal(missionDuplicate.status, 200);
    assert.equal(missionDuplicate.body.duplicate, true);
    assert.equal(await prisma.growthMission.count({ where: { idempotencyKey } }), 1);
    assert.equal((await request(serverBaseUrl, '/api/admin/growth/missions', {
      method: 'POST',
      token: fullAdmin,
      headers: { 'Idempotency-Key': idempotencyKey },
      body: { ...missionInput, name: `${missionInput.name} conflict` }
    })).status, 409);
    assert.equal((await request(serverBaseUrl, `/api/admin/growth/missions/${missionId}/approve-plan`, {
      method: 'POST',
      token: noGrowthPermissionAdmin
    })).status, 403);
    assert.equal((await request(serverBaseUrl, `/api/admin/growth/missions/${missionId}/approve-plan`, {
      method: 'POST',
      token: fullAdmin
    })).status, 200);
    const storedMission = await prisma.growthMission.findUniqueOrThrow({ where: { id: missionId } });
    const storedPlan = JSON.parse(storedMission.plan);
    storedPlan.strategy = {
      version: 1,
      source: 'ai_draft',
      executionEnabled: false,
      generatedAt: new Date().toISOString(),
      recommendations: [{
        market: 'europe',
        channelId: 'instagram',
        title: 'Prepare a human-reviewed seasonal campaign',
        rationale: 'Use the existing audience and verify the message before execution.',
        successMetric: 'Qualified inquiries'
      }]
    };
    await prisma.growthMission.update({ where: { id: missionId }, data: { plan: JSON.stringify(storedPlan) } });

    const createMissionReviewTask = async () => {
      const response = await request(serverBaseUrl, `/api/admin/growth/missions/${missionId}/review-tasks`, {
        method: 'POST',
        token: fullAdmin
      });
      assert.equal(response.status, 202);
      const taskId = response.body.tasks[0].id as string;
      taskIds.push(taskId);
      return taskId;
    };
    const lifecycle = async (action: 'pause' | 'resume' | 'cancel') => request(
      serverBaseUrl,
      `/api/admin/growth/missions/${missionId}/lifecycle`,
      { method: 'POST', token: fullAdmin, body: { action } }
    );
    const firstTaskId = await createMissionReviewTask();
    await failAuditFor('AuditLog', 'GROWTH_MISSION_PAUSED', true);
    const rejectedPause = await lifecycle('pause');
    assert.ok(rejectedPause.status >= 500);
    assert.equal((await prisma.growthMission.findUniqueOrThrow({ where: { id: missionId } })).status, 'plan_approved');
    assert.equal((await prisma.modaGptTask.findUniqueOrThrow({ where: { id: firstTaskId } })).status, 'queued');
    await failAuditFor('AuditLog', 'GROWTH_MISSION_PAUSED', false);
    let worker = await startWorker('hold');
    workers.push(worker);
    await waitForWorkerMessage(worker, 'claimed');
    const crashedWorker = waitForChildExit(worker);
    worker.kill('SIGKILL');
    await crashedWorker;
    const leasedTask = await prisma.modaGptTask.findUniqueOrThrow({ where: { id: firstTaskId } });
    assert.equal(leasedTask.status, 'running');
    assert.equal(leasedTask.attempts, 1);
    await new Promise(resolve => setTimeout(resolve, 1_150));
    worker = await startWorker('recover');
    workers.push(worker);
    const recoveredTask = await waitForTaskStatus(firstTaskId, ['waiting_approval']);
    await stopWorker(worker);
    assert.equal(recoveredTask.attempts, 2);
    const firstDecision = await request(serverBaseUrl, `/api/admin/growth/missions/${missionId}/review-tasks/${firstTaskId}/decision`, {
      method: 'POST',
      token: fullAdmin,
      body: { decision: 'return' }
    });
    assert.equal(firstDecision.status, 200);

    const secondTaskId = await createMissionReviewTask();
    worker = await startWorker('cancellable');
    workers.push(worker);
    await waitForWorkerMessage(worker, 'claimed');
    assert.equal((await lifecycle('pause')).status, 200);
    await waitForWorkerMessage(worker, 'aborted');
    const pausedTask = await prisma.modaGptTask.findUniqueOrThrow({ where: { id: secondTaskId } });
    assert.equal(pausedTask.status, 'cancelled');
    assert.equal(pausedTask.lastErrorCode, 'GROWTH_MISSION_PAUSED');
    await stopWorker(worker, 'SIGTERM');
    assert.equal((await lifecycle('resume')).status, 200);
    assert.equal((await prisma.modaGptTask.findUniqueOrThrow({ where: { id: secondTaskId } })).status, 'queued');
    worker = await startWorker('recover');
    workers.push(worker);
    const resumedTask = await waitForTaskStatus(secondTaskId, ['waiting_approval']);
    await stopWorker(worker);
    assert.ok(resumedTask.attempts >= 2);
    const secondDecision = await request(serverBaseUrl, `/api/admin/growth/missions/${missionId}/review-tasks/${secondTaskId}/decision`, {
      method: 'POST',
      token: fullAdmin,
      body: { decision: 'return' }
    });
    assert.equal(secondDecision.status, 200);

    const thirdTaskId = await createMissionReviewTask();
    worker = await startWorker('hold');
    workers.push(worker);
    await waitForWorkerMessage(worker, 'claimed');
    assert.equal((await lifecycle('cancel')).status, 200);
    const cancelledTask = await prisma.modaGptTask.findUniqueOrThrow({ where: { id: thirdTaskId } });
    assert.equal(cancelledTask.status, 'cancelled');
    assert.equal(cancelledTask.lastErrorCode, 'GROWTH_MISSION_CANCELLED');
    const cancelledWorker = waitForChildExit(worker);
    worker.kill('SIGKILL');
    await cancelledWorker;
    worker = await startWorker('recover');
    await new Promise(resolve => setTimeout(resolve, 500));
    await stopWorker(worker);
    assert.equal((await prisma.modaGptTask.findUniqueOrThrow({ where: { id: thirdTaskId } })).status, 'cancelled');

    const [{ ModaGptTaskRuntime }, { PrismaModaGptTaskStore }] = await Promise.all([
      import('../../src/server/modagptTaskQueue'),
      import('../../src/server/prismaModaGptTaskStore')
    ]);
    const retryRuntime = new ModaGptTaskRuntime(new PrismaModaGptTaskStore(prisma));
    const retryTask = await retryRuntime.enqueue({
      taskType: 'ops.health_check',
      payload: { test: 'retry-after-process-failure' },
      tenantId: 'platform',
      actorId: 'p0-test',
      goal: 'P0 worker retry verification',
      maxAttempts: 2
    });
    const retryWorker = await startWorker('retry');
    workers.push(retryWorker);
    const completedRetry = await waitForTaskStatus(retryTask.id, ['completed']);
    await stopWorker(retryWorker);
    assert.equal(completedRetry.attempts, 2);
    assert.equal(completedRetry.retryCount, 1);

    const deadTask = await retryRuntime.enqueue({
      taskType: 'ops.health_check',
      payload: { test: 'dead-letter' },
      tenantId: 'platform',
      actorId: 'p0-test',
      goal: 'P0 worker dead-letter verification',
      maxAttempts: 1
    });
    const deadWorker = await startWorker('dead');
    workers.push(deadWorker);
    const deadLetteredTask = await waitForTaskStatus(deadTask.id, ['dead_letter']);
    await stopWorker(deadWorker);
    assert.equal(deadLetteredTask.attempts, 1);
    const deadLetterNotificationKey = `modagpt.task.dead_letter:in_app:admin:${deadTask.id}`;
    const deadLetterNotification = await prisma.notificationEvent.findUniqueOrThrow({
      where: { idempotencyKey: deadLetterNotificationKey }
    });
    const adminNotifications = await request(serverBaseUrl, '/api/admin/notifications?status=sent', { token: fullAdmin });
    assert.equal(adminNotifications.status, 200);
    assert.ok(adminNotifications.body.events.some((event: { idempotencyKey: string }) =>
      event.idempotencyKey === deadLetterNotification.idempotencyKey
    ));

    const longTask = await retryRuntime.enqueue({
      taskType: 'ops.health_check',
      payload: { test: 'active-lease-heartbeat' },
      tenantId: 'platform',
      actorId: 'p0-test',
      goal: 'P0 active worker lease heartbeat verification',
      maxAttempts: 2
    });
    const longWorker = await startWorker('long');
    workers.push(longWorker);
    await waitForWorkerMessage(longWorker, 'claimed');
    await new Promise(resolve => setTimeout(resolve, 1_150));
    const competingWorker = await startWorker('recover');
    workers.push(competingWorker);
    await new Promise(resolve => setTimeout(resolve, 400));
    const stillLeasedTask = await prisma.modaGptTask.findUniqueOrThrow({ where: { id: longTask.id } });
    assert.equal(stillLeasedTask.status, 'running');
    assert.equal(stillLeasedTask.attempts, 1);
    await stopWorker(competingWorker);
    const completedLongTask = await waitForTaskStatus(longTask.id, ['completed']);
    await stopWorker(longWorker);
    assert.equal(completedLongTask.attempts, 1);

    const shutdownTask = await retryRuntime.enqueue({
      taskType: 'ops.health_check',
      payload: { test: 'graceful-worker-shutdown-recovery' },
      tenantId: 'platform',
      actorId: 'p0-test',
      goal: 'P0 graceful worker shutdown recovery verification',
      maxAttempts: 2
    });
    const shutdownWorker = await startWorker('shutdown');
    workers.push(shutdownWorker);
    await waitForWorkerMessage(shutdownWorker, 'claimed');
    await stopWorker(shutdownWorker, 'SIGTERM');
    const shutdownTaskState = await prisma.modaGptTask.findUniqueOrThrow({ where: { id: shutdownTask.id } });
    assert.equal(shutdownTaskState.status, 'running');
    assert.equal(shutdownTaskState.attempts, 1);
    await new Promise(resolve => setTimeout(resolve, 1_150));
    const replacementWorker = await startWorker('recover');
    workers.push(replacementWorker);
    const recoveredShutdownTask = await waitForTaskStatus(shutdownTask.id, ['completed']);
    await stopWorker(replacementWorker);
    assert.equal(recoveredShutdownTask.attempts, 2);

    const unauthorizedMetrics = await request(serverBaseUrl, '/api/admin/growth/overview');
    assert.equal(unauthorizedMetrics.status, 401);
    const forbiddenMetrics = await request(serverBaseUrl, '/api/admin/growth/overview', { token: noGrowthPermissionAdmin });
    assert.equal(forbiddenMetrics.status, 403);
    assert.equal(forbiddenMetrics.body.error.code, 'ADMIN_PERMISSION_REQUIRED');
    assert.equal(forbiddenMetrics.body.error.details.permission, 'settings.ai_support');
    const metrics = await request(serverBaseUrl, '/api/admin/growth/overview', { token: fullAdmin });
    assert.equal(metrics.status, 200, logs());
    assert.equal(metrics.headers.get('cache-control'), 'no-store');
    assert.equal(metrics.body.metricDefinitions.pageViews.source, 'GrowthMarketingEvent.event=page_view + createdAt');
    assert.ok(metrics.body.campaigns.some((item: { campaign: string; events: number }) =>
      item.campaign === marketingCampaignTag && item.events === 1
    ));
    assert.ok(metrics.body.daily.some((item: { pageViews: number }) => item.pageViews >= 1));
    assert.equal(metrics.body.referralAttribution.status, 'available');
    assert.ok(metrics.body.metrics.unknownRegistrations >= 1);
    assert.ok(metrics.body.referralAttribution.breakdown.some((item: { partnerCode: string }) => item.partnerCode === 'unknown'));
    assert.equal(metrics.body.metricDefinitions.unknownRegistrations.source, 'Customer.createdAt + absence of PartnerReferral');
    assert.equal(metrics.body.metricDefinitions.referralFirstPaid.source, 'PartnerReferral.firstPaidAt');
    assert.ok(metrics.body.metrics.repeatPaidOrders >= 1);
    assert.ok(metrics.body.metrics.retainedConsumers >= 1);
    assert.equal(metrics.body.metricDefinitions.retainedConsumers.unit, 'records');
    assert.ok(metrics.body.daily.some((item: { unknownRegistrations: number }) => item.unknownRegistrations >= 1));

    const strategyLimitResponses: HttpResult[] = [];
    for (let attempt = 0; attempt < 11; attempt += 1) {
      strategyLimitResponses.push(await request(
        serverBaseUrl,
        '/api/admin/growth/missions/invalid/strategy',
        { method: 'POST', token: fullAdmin }
      ));
    }
    const rateLimitedResponse = strategyLimitResponses.find(response => response.status === 429);
    assert.ok(rateLimitedResponse);
    assert.equal(rateLimitedResponse.body.success, false);
    assert.equal(rateLimitedResponse.body.error.code, 'API_RATE_LIMITED');
    assert.equal(rateLimitedResponse.body.error.retryable, true);
    assert.equal(rateLimitedResponse.body.requestId, rateLimitedResponse.headers.get('x-request-id'));
    assert.ok(Number(rateLimitedResponse.headers.get('retry-after')) > 0);
    assert.equal(strategyLimitResponses.filter(response => response.status === 400).length, 10);

    const [companyAId, companyBId, foreignMerchantId, foreignProductId] = [
      crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID()
    ];
    companyIds.push(companyAId, companyBId);
    companyMerchantIds.push(foreignMerchantId);
    companyProductIds.push(foreignProductId);
    await prisma.company.createMany({
      data: [
        { id: companyAId, legalName: 'P0 Company A Ltd', displayName: 'P0 Company A', country: 'IT', city: 'Milan' },
        { id: companyBId, legalName: 'P0 Company B Ltd', displayName: 'P0 Company B', country: 'IT', city: 'Prato' }
      ]
    });
    await prisma.merchant.create({
      data: {
        id: foreignMerchantId,
        name: `P0 Company B Merchant ${suffix}`,
        companyLegalName: 'P0 Company B Ltd',
        code: `P0-COMPANY-B-${suffix}`,
        country: 'IT',
        city: 'Prato',
        showroomAddress: 'P0 Company Test Address',
        showroomArea: 'P0 test',
        showroomImage: '',
        logo: '',
        banner: '',
        tagline: 'P0 test merchant',
        description: 'Isolated P0 company tenant fixture.',
        specialties: '[]',
        foundedYear: 2020,
        contactPerson: 'P0 Company Test',
        contactPhone: '+390000000002',
        contactEmail: `company-b-${suffix}@example.test`,
        storeSlug: `p0-company-b-${suffix}`,
        industry: 'FASHION_COMPANY',
        companyId: companyBId
      }
    });
    await prisma.product.create({
      data: {
        id: foreignProductId,
        styleNo: `P0-COMPANY-B-${suffix}`,
        name: 'Company B private catalog item',
        category: 'women',
        subCategory: 'tops',
        brand: 'P0 Company B',
        season: '2026',
        images: '[]',
        wholesalePrice: 20,
        rrpPrice: 40,
        status: 'new',
        inventoryStatus: 'in_stock',
        origin: 'Italy',
        fabric: 'Cotton',
        composition: '100% cotton',
        weight: '0.2kg',
        packaging: 'Standard',
        washCare: 'Standard',
        description: 'Isolated company tenant test product.',
        skus: '[]',
        merchantId: foreignMerchantId,
        merchantName: 'P0 Company B'
      }
    });
    const companyACatalog = await request(serverBaseUrl, '/api/company/catalog', { token: companyToken(companyAId) });
    assert.equal(companyACatalog.status, 200);
    assert.ok(companyACatalog.body.products.every((item: { id: string }) => item.id !== foreignProductId));
    const companyBCatalog = await request(serverBaseUrl, '/api/company/catalog', { token: companyToken(companyBId) });
    assert.equal(companyBCatalog.status, 200);
    assert.ok(companyBCatalog.body.products.some((item: { id: string }) => item.id === foreignProductId));
    const crossCompanyCreate = await request(serverBaseUrl, '/api/company/products', {
      method: 'POST',
      token: companyToken(companyAId),
      body: { merchantId: foreignMerchantId, name: 'Unauthorized product', category: 'women', wholesalePrice: 10, rrpPrice: 20 }
    });
    assert.equal(crossCompanyCreate.status, 403);
    assert.equal(crossCompanyCreate.body.error.code, 'TENANT_SCOPE_MISMATCH');
    const crossCompanyUpdate = await request(serverBaseUrl, `/api/company/products/${foreignProductId}`, {
      method: 'PUT', token: companyToken(companyAId), body: { name: 'Unauthorized update' }
    });
    assert.equal(crossCompanyUpdate.status, 404);
    const crossCompanyBatch = await request(serverBaseUrl, '/api/company/products/batch', {
      method: 'PUT', token: companyToken(companyAId), body: { productIds: [foreignProductId], lifecycleStatus: 'draft' }
    });
    assert.equal(crossCompanyBatch.status, 404);

    const sessionAdminId = crypto.randomUUID();
    adminAccountIds.push(sessionAdminId);
    const sessionAdminUsername = `p0-session-${suffix}`;
    const oldPassword = 'p0-old-admin-password';
    const newPassword = 'p0-new-admin-password-2026';
    await prisma.authAccount.create({
      data: {
        id: sessionAdminId,
        role: 'admin',
        username: sessionAdminUsername,
        passwordHash: await bcrypt.hash(oldPassword, 10),
        permissions: JSON.stringify(['growth.partners'])
      }
    });
    const login = await request(serverBaseUrl, '/api/auth/login/admin', {
      method: 'POST',
      body: { username: sessionAdminUsername, password: oldPassword }
    });
    assert.equal(login.status, 200);
    const oldAdminCookie = login.headers.get('set-cookie')?.split(';', 1)[0];
    if (!oldAdminCookie || !oldAdminCookie.startsWith('ruda_admin_jwt=')) {
      throw new Error('admin login did not return the expected session cookie');
    }
    const accessWithCookie = (cookie: string) => request(serverBaseUrl, '/api/admin/partners/overview', {
      headers: { cookie }
    });
    assert.equal((await accessWithCookie(oldAdminCookie)).status, 200);
    const changed = await request(serverBaseUrl, '/api/auth/admin/password/change', {
      method: 'POST',
      headers: { cookie: oldAdminCookie },
      body: { currentPassword: oldPassword, newPassword }
    });
    assert.equal(changed.status, 200);
    assert.equal((await accessWithCookie(oldAdminCookie)).status, 401);
    const staleSessionCheck = await request(serverBaseUrl, '/api/auth/me/admin', { headers: { cookie: oldAdminCookie } });
    assert.equal(staleSessionCheck.status, 401);

    const relogin = await request(serverBaseUrl, '/api/auth/login/admin', {
      method: 'POST',
      body: { username: sessionAdminUsername, password: newPassword }
    });
    assert.equal(relogin.status, 200);
    const newAdminCookie = relogin.headers.get('set-cookie')?.split(';', 1)[0];
    if (!newAdminCookie || !newAdminCookie.startsWith('ruda_admin_jwt=')) {
      throw new Error('admin relogin did not return the expected session cookie');
    }
    assert.equal((await accessWithCookie(newAdminCookie)).status, 200);
    const currentSession = await request(serverBaseUrl, '/api/auth/me/admin', { headers: { cookie: newAdminCookie } });
    assert.equal(currentSession.status, 200);
    assert.equal(currentSession.body.success, true);
  } catch (error) {
    if (server && server.exitCode === null) {
      server.kill('SIGTERM');
      await new Promise(resolve => server?.once('exit', resolve));
    }
    throw new Error(`${error instanceof Error ? error.stack || error.message : String(error)}\n${logs()}`);
  } finally {
    for (const worker of workers) {
      if (worker.exitCode === null && worker.signalCode === null) {
        worker.kill('SIGKILL');
        await new Promise<void>(resolve => worker.once('exit', () => resolve()));
      }
    }
    if (server && server.exitCode === null && server.signalCode === null) {
      server.kill('SIGTERM');
      await new Promise(resolve => server?.once('exit', resolve));
    }
    if (auditTriggerInstalled) {
      await prisma.$executeRawUnsafe('DROP TRIGGER IF EXISTS p0_reject_audit_log ON "AuditLog"');
      await prisma.$executeRawUnsafe('DROP TRIGGER IF EXISTS p0_reject_partner_audit ON "PartnerAuditEvent"');
      await prisma.$executeRawUnsafe('DROP FUNCTION IF EXISTS p0_reject_selected_audit()');
      await prisma.$executeRawUnsafe('DROP TABLE IF EXISTS "P0AuditFailure"');
    }
    await prisma.partnerCommissionEntry.deleteMany({ where: { orderId: { in: orderIds } } });
    await prisma.growthMarketingEvent.deleteMany({ where: { campaign: marketingCampaignTag } });
    await prisma.partnerAuditEvent.deleteMany({
      where: {
        OR: [
          { entityId: { in: [...orderIds, ...refundIds, ...referralIds, ...campaignIds, ...commissionEntryIds] } },
          { partnerId: { in: adminCreatedPartnerIds } }
        ]
      }
    });
    await prisma.paymentWebhookEvent.deleteMany({ where: { providerEventId: { contains: suffix } } });
    await prisma.refundTransaction.deleteMany({ where: { id: { in: refundIds } } });
    await prisma.paymentTransaction.deleteMany({ where: { id: { in: paymentIds } } });
    await prisma.order.deleteMany({ where: { id: { in: orderIds } } });
    await prisma.growthCrmFollowUp.deleteMany({
      where: {
        OR: [
          { consumerId: { in: consumerIds } },
          { note: { contains: 'P0 HTTP follow-up test record' } },
          { note: { contains: 'Updated by P0 HTTP integration' } }
        ]
      }
    });
    await prisma.consumer.deleteMany({ where: { id: { in: consumerIds } } });
    await prisma.auditLog.deleteMany({
      where: {
        OR: [
          { entityId: { in: adminAccountIds } },
          { entityId: { in: [...missionIds, ...taskIds] } },
          { action: 'GROWTH_CRM_AUTOMATION_CANDIDATES_CREATED' },
          { action: { startsWith: 'GROWTH_MISSION_' }, entity: 'GrowthMission' },
          { action: { startsWith: 'GROWTH_CRM_FOLLOW_UP_' }, entity: 'GrowthCrmFollowUp' }
        ]
      }
    });
    await prisma.modaGptTask.deleteMany({
      where: { OR: [{ id: { in: taskIds } }, { goal: { startsWith: 'P0 worker ' } }] }
    });
    await prisma.notificationEvent.deleteMany({
      where: { idempotencyKey: { in: taskIds.map(id => `modagpt.task.dead_letter:in_app:admin:${id}`) } }
    });
    await prisma.growthMission.deleteMany({ where: { id: { in: missionIds } } });
    await prisma.partnerReferralChange.deleteMany({ where: { referralId: { in: referralIds } } });
    await prisma.partnerReferralClick.deleteMany({ where: { partnerId: { in: partnerIds } } });
    await prisma.partnerReferral.deleteMany({ where: { id: { in: referralIds } } });
    await prisma.partnerCampaign.deleteMany({ where: { id: { in: campaignIds } } });
    await prisma.customer.deleteMany({ where: { id: { in: customerIds } } });
    await prisma.product.deleteMany({ where: { id: { in: companyProductIds } } });
    await prisma.merchant.deleteMany({ where: { id: { in: companyMerchantIds } } });
    await prisma.company.deleteMany({ where: { id: { in: companyIds } } });
    await prisma.authAccount.deleteMany({ where: { partnerId: { in: adminCreatedPartnerIds } } });
    await prisma.authAccount.deleteMany({ where: { id: { in: adminAccountIds } } });
    await prisma.partner.deleteMany({ where: { id: { in: adminCreatedPartnerIds } } });
    await prisma.partner.deleteMany({ where: { id: { in: [...partnerIds, inactivePartnerId] } } });
    await prisma.partner.deleteMany({ where: { id: cityPartnerId } });
    await prisma.$disconnect();
  }
});
