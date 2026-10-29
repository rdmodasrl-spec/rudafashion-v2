import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { fork, type ChildProcess } from 'node:child_process';
import net from 'node:net';
import path from 'node:path';
import test from 'node:test';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { getIsolatedPostgresTestDatabaseUrl } from '../../scripts/isolatedPostgresTestDatabase';

if (process.env.NODE_ENV !== 'test') {
  throw new Error('APP_STORE_INTEGRATION_REQUIRES_NODE_ENV_TEST');
}

const databaseUrl = getIsolatedPostgresTestDatabaseUrl({
  nodeEnv: process.env.NODE_ENV,
  testDatabaseUrl: process.env.APP_STORE_TEST_DATABASE_URL,
  applicationDatabaseUrl: process.env.RUDA_APPLICATION_DATABASE_URL,
  runId: process.env.APP_STORE_TEST_RUN_ID,
  containerId: process.env.APP_STORE_TEST_CONTAINER_ID
});
const merchantSecret = process.env.JWT_MERCHANT_SECRET;
const adminSecret = process.env.JWT_ADMIN_SECRET;
if (!merchantSecret || !adminSecret) throw new Error('APP_STORE_INTEGRATION_JWT_SECRETS_REQUIRED');

const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
const appId = 'ruda-business-email';
const appVersion = '1.0.0';
type HttpResult = { status: number; body: Record<string, any> };

async function getFreePort(): Promise<number> {
  const listener = net.createServer();
  await new Promise<void>((resolve, reject) => {
    listener.once('error', reject);
    listener.listen(0, '127.0.0.1', resolve);
  });
  const address = listener.address();
  if (!address || typeof address === 'string') throw new Error('APP_STORE_TEST_PORT_UNAVAILABLE');
  await new Promise<void>((resolve, reject) => listener.close(error => error ? reject(error) : resolve()));
  return address.port;
}

async function request(baseUrl: string, route: string, options: {
  method?: string;
  token?: string;
  body?: unknown;
} = {}): Promise<HttpResult> {
  const response = await fetch(`${baseUrl}${route}`, {
    method: options.method || 'GET',
    headers: {
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
      ...(options.body === undefined ? {} : { 'Content-Type': 'application/json' })
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
  return { status: response.status, body };
}

function errorCode(body: Record<string, any>): string | undefined {
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

function adminToken(): string {
  return jwt.sign({
    id: 'app-store-test-admin',
    username: 'app-store-test-admin',
    role: 'admin',
    permissions: ['settings.integrations']
  }, adminSecret!, { expiresIn: '20m' });
}

async function waitForReady(baseUrl: string, child: ChildProcess, logs: () => string): Promise<void> {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`APP_STORE_SERVER_EXITED:${child.exitCode}:${logs()}`);
    try {
      const response = await fetch(`${baseUrl}/api/health/ready`, { signal: AbortSignal.timeout(1_500) });
      if (response.ok) return;
    } catch {
      await new Promise(resolve => setTimeout(resolve, 400));
    }
  }
  throw new Error(`APP_STORE_SERVER_START_TIMEOUT:${logs()}`);
}

async function createMerchant(suffix: string, label: string): Promise<string> {
  const id = crypto.randomUUID();
  await prisma.merchant.create({
    data: {
      id,
      name: `App Store ${label} ${suffix}`,
      companyLegalName: `App Store ${label} ${suffix} Ltd`,
      code: `APPSTORE-${label}-${suffix}`,
      country: 'Italy',
      city: 'Milan',
      showroomAddress: 'Isolated test address',
      showroomArea: 'Test',
      showroomImage: '',
      logo: '',
      banner: '',
      tagline: 'Isolated App Store test',
      description: 'Test-only merchant fixture.',
      specialties: '[]',
      foundedYear: 2020,
      contactPerson: 'Integration Test',
      contactPhone: '+390000000000',
      contactEmail: `app-store-${label}-${suffix}@example.test`,
      storeSlug: `app-store-${label}-${suffix}`,
      industry: 'FASHION_COMPANY'
    }
  });
  return id;
}

test('App Store platform, tenant lifecycle, guarded runtime, persistence and audit APIs', async () => {
  const suffix = crypto.randomUUID().replaceAll('-', '');
  const merchantA = await createMerchant(suffix, 'A');
  const merchantB = await createMerchant(suffix, 'B');
  const employeeId = crypto.randomUUID();
  await prisma.merchantEmployee.create({
    data: {
      id: employeeId,
      merchantId: merchantB,
      email: `app-store-no-permission-${suffix}@example.test`,
      name: 'Restricted test employee',
      passwordHash: 'not-used-by-this-api-test',
      role: 'sales',
      permissions: '[]'
    }
  });

  const port = await getFreePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const serverLogs: string[] = [];
  const logs = () => serverLogs.join('').slice(-12_000);
  const serverEntry = process.env.APP_STORE_TEST_SERVER_ENTRY || 'server.ts';
  const server = fork(path.resolve(serverEntry), [], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      NODE_ENV: 'test',
      P0_HTTP_TEST_MODE: 'true',
      DATABASE_URL: databaseUrl,
      PORT: String(port),
      JWT_MERCHANT_SECRET: merchantSecret,
      JWT_ADMIN_SECRET: adminSecret,
      JWT_BUYER_SECRET: 'app-store-test-buyer-secret-0123456789abcdef',
      SHARE_LINK_SECRET: 'app-store-test-share-secret-0123456789abcdef',
      ADMIN_TOTP_ENCRYPTION_KEY: 'app-store-test-totp-secret-0123456789abcdef',
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
  const admin = adminToken();
  const ownerA = merchantToken(merchantA);
  const ownerB = merchantToken(merchantB);
  const restrictedEmployeeB = merchantToken(merchantB, employeeId);

  try {
    await waitForReady(baseUrl, server, logs);

    const deniedEmployeeInstall = await request(baseUrl, '/api/app-store/installations', {
      method: 'POST',
      token: restrictedEmployeeB,
      body: { appId }
    });
    assert.equal(deniedEmployeeInstall.status, 403);
    assert.equal(errorCode(deniedEmployeeInstall.body), 'EMPLOYEE_PERMISSION_REQUIRED');

    const adminAppsResponse = await request(baseUrl, '/api/admin/app-store/apps', { token: admin });
    assert.equal(adminAppsResponse.status, 200);
    const catalogApp = adminAppsResponse.body.apps.find((item: { appId: string }) => item.appId === appId);
    assert.ok(catalogApp, 'seeded native email-domain app exists in the catalog');
    const categoryId = catalogApp.categoryId as string;
    const draftAppPayload = {
      appId: `app-store-test-${suffix}`,
      name: `App Store Test ${suffix}`,
      slug: `app-store-test-${suffix}`,
      categoryId,
      description: 'Integration-only draft to verify platform publication and runtime gating.',
      detailedIntro: 'Test-only application.',
      icon: 'Package',
      version: '1.0.0',
      status: 'draft',
      pricingType: 'free',
      developer: 'RUDA Integration Test',
      permissions: '[]',
      features: '[]'
    };
    const invalidMetadata = await request(baseUrl, '/api/admin/app-store/apps', {
      method: 'POST',
      token: admin,
      body: { ...draftAppPayload, appId: `app-store-invalid-${suffix}`, features: '{invalid' }
    });
    assert.equal(invalidMetadata.status, 400, `${JSON.stringify(invalidMetadata.body)}\n${logs()}`);
    assert.equal(errorCode(invalidMetadata.body), 'APP_STORE_APP_FIELDS_INVALID');

    const createDraft = await request(baseUrl, '/api/admin/app-store/apps', {
      method: 'POST',
      token: admin,
      body: draftAppPayload
    });
    assert.equal(createDraft.status, 201);
    const publishDraft = await request(baseUrl, `/api/admin/app-store/apps/${createDraft.body.app.id}`, {
      method: 'PUT',
      token: admin,
      body: { ...draftAppPayload, status: 'published' }
    });
    assert.equal(publishDraft.status, 200);
    assert.equal(publishDraft.body.app.status, 'published');
    const unsupportedDiscovery = await request(baseUrl, '/api/app-store/apps', { token: ownerA });
    const unsupportedApp = unsupportedDiscovery.body.apps.find(
      (item: { appId: string }) => item.appId === draftAppPayload.appId
    );
    assert.ok(unsupportedApp, 'merchant can discover the newly published application');
    assert.equal(unsupportedApp.runtimeAvailable, false);
    const unsupportedInstall = await request(baseUrl, '/api/app-store/installations', {
      method: 'POST',
      token: ownerA,
      body: { appId: draftAppPayload.appId }
    });
    assert.equal(unsupportedInstall.status, 409);
    assert.equal(errorCode(unsupportedInstall.body), 'APP_STORE_RUNTIME_UNAVAILABLE');
    assert.equal(await prisma.appInstallation.count({
      where: { merchantId: merchantA, appId: createDraft.body.app.id }
    }), 0);

    const catalogPayload = {
      name: catalogApp.name,
      appId,
      slug: catalogApp.slug,
      categoryId: catalogApp.categoryId,
      description: catalogApp.description,
      detailedIntro: catalogApp.detailedIntro,
      icon: catalogApp.icon,
      version: appVersion,
      status: 'draft',
      pricingType: 'free',
      developer: catalogApp.developer,
      permissions: catalogApp.permissions,
      features: catalogApp.features,
      pricePlan: catalogApp.pricePlan
    };
    const setDraft = await request(baseUrl, `/api/admin/app-store/apps/${catalogApp.id}`, {
      method: 'PUT',
      token: admin,
      body: catalogPayload
    });
    assert.equal(setDraft.status, 200);
    assert.equal(setDraft.body.app.status, 'draft');
    const publish = await request(baseUrl, `/api/admin/app-store/apps/${catalogApp.id}`, {
      method: 'PUT',
      token: admin,
      body: { ...catalogPayload, status: 'published' }
    });
    assert.equal(publish.status, 200);
    assert.equal(publish.body.app.status, 'published');

    const discovery = await request(baseUrl, '/api/app-store/apps', { token: ownerA });
    assert.equal(discovery.status, 200);
    const visibleApp = discovery.body.apps.find((item: { appId: string }) => item.appId === appId);
    assert.ok(visibleApp, 'merchant can discover the published app');
    assert.equal(visibleApp.runtimeAvailable, true);
    assert.equal(visibleApp.installationStatus, null);

    const firstInstall = await request(baseUrl, '/api/app-store/installations', {
      method: 'POST',
      token: ownerA,
      body: { appId }
    });
    assert.equal(firstInstall.status, 201);
    assert.equal(firstInstall.body.installation.status, 'installed');
    assert.equal(firstInstall.body.installation.installedVersion, appVersion);
    const repeatedInstall = await request(baseUrl, '/api/app-store/installations', {
      method: 'POST',
      token: ownerA,
      body: { appId }
    });
    assert.equal(repeatedInstall.status, 201);
    assert.equal(repeatedInstall.body.installation.status, 'installed');

    const enableA = await request(baseUrl, `/api/app-store/installations/${appId}/enable`, {
      method: 'POST',
      token: ownerA
    });
    assert.equal(enableA.status, 200);
    assert.equal(enableA.body.installation.status, 'active');
    assert.equal(enableA.body.installation.installedVersion, appVersion);
    const repeatedEnableA = await request(baseUrl, `/api/app-store/installations/${appId}/enable`, {
      method: 'POST',
      token: ownerA
    });
    assert.equal(repeatedEnableA.status, 200);
    assert.equal(repeatedEnableA.body.installation.status, 'active');

    const featureStatus = await request(baseUrl, '/api/merchant/email/status', { token: ownerA });
    assert.equal(featureStatus.status, 200);
    assert.equal(featureStatus.body.serviceStatus, 'setup_required');
    assert.equal(featureStatus.body.mailboxProvisioningAvailable, false);

    const domainName = `app-store-${suffix}.invalid`;
    const addDomain = await request(baseUrl, '/api/merchant/email/domains', {
      method: 'POST',
      token: ownerA,
      body: { domainName }
    });
    assert.equal(addDomain.status, 201);
    const domainId = addDomain.body.domain.id as string;
    assert.ok(addDomain.body.domain.verificationRecordValue);
    assert.equal(addDomain.body.domain.isVerified, false);

    const duplicateDomain = await request(baseUrl, '/api/merchant/email/domains', {
      method: 'POST',
      token: ownerA,
      body: { domainName }
    });
    assert.equal(duplicateDomain.status, 409);

    const installB = await request(baseUrl, '/api/app-store/installations', {
      method: 'POST',
      token: ownerB,
      body: { appId }
    });
    assert.equal(installB.status, 201);
    const enableB = await request(baseUrl, `/api/app-store/installations/${appId}/enable`, {
      method: 'POST',
      token: ownerB
    });
    assert.equal(enableB.status, 200);
    const domainsB = await request(baseUrl, '/api/merchant/email/domains', { token: ownerB });
    assert.equal(domainsB.status, 200);
    assert.deepEqual(domainsB.body.domains, []);
    const foreignVerify = await request(baseUrl, `/api/merchant/email/domains/${domainId}/verify`, {
      method: 'POST',
      token: ownerB
    });
    assert.equal(foreignVerify.status, 404);
    assert.equal(errorCode(foreignVerify.body), 'EMAIL_DOMAIN_NOT_FOUND');

    const dnsVerify = await request(baseUrl, `/api/merchant/email/domains/${domainId}/verify`, {
      method: 'POST',
      token: ownerA
    });
    assert.ok(dnsVerify.status === 409 || dnsVerify.status === 502);
    assert.notEqual(dnsVerify.body.success, true, 'unconfigured .invalid DNS cannot be reported as verified');

    const disableA = await request(baseUrl, `/api/app-store/installations/${appId}/disable`, {
      method: 'POST',
      token: ownerA
    });
    assert.equal(disableA.status, 200);
    assert.equal(disableA.body.installation.status, 'disabled');
    const disabledRuntime = await request(baseUrl, '/api/merchant/email/status', { token: ownerA });
    assert.equal(disabledRuntime.status, 403);
    assert.equal(errorCode(disabledRuntime.body), 'APP_STORE_APP_NOT_ENABLED');
    const repeatedDisableA = await request(baseUrl, `/api/app-store/installations/${appId}/disable`, {
      method: 'POST',
      token: ownerA
    });
    assert.equal(repeatedDisableA.status, 200);
    assert.equal(repeatedDisableA.body.installation.status, 'disabled');

    const uninstallA = await request(baseUrl, `/api/app-store/installations/${appId}`, {
      method: 'DELETE',
      token: ownerA
    });
    assert.equal(uninstallA.status, 200);
    const repeatedUninstallA = await request(baseUrl, `/api/app-store/installations/${appId}`, {
      method: 'DELETE',
      token: ownerA
    });
    assert.equal(repeatedUninstallA.status, 200);
    const uninstalledRuntime = await request(baseUrl, '/api/merchant/email/status', { token: ownerA });
    assert.equal(uninstalledRuntime.status, 403);

    const [installationA, installationB, persistedDomain, merchantAudits, platformAudits] = await Promise.all([
      prisma.appInstallation.findUnique({
        where: { merchantId_appId: { merchantId: merchantA, appId: catalogApp.id } }
      }),
      prisma.appInstallation.findUnique({
        where: { merchantId_appId: { merchantId: merchantB, appId: catalogApp.id } }
      }),
      prisma.merchantEmailDomain.findUnique({ where: { id: domainId } }),
      prisma.employeeAuditLog.findMany({
        where: { merchantId: merchantA, entityType: 'App', entityId: catalogApp.id },
        select: { action: true }
      }),
      prisma.auditLog.findMany({
        where: { entity: 'App', entityId: { in: [catalogApp.id, createDraft.body.app.id] } },
        select: { action: true }
      })
    ]);
    assert.equal(installationA, null, 'uninstall removes only the tenant installation relation');
    assert.equal(installationB?.status, 'active', 'merchant B installation remains isolated and enabled');
    assert.ok(persistedDomain, 'uninstall preserves merchant-owned domain data');
    assert.equal(persistedDomain.verifiedAt, null);
    for (const action of ['APP_INSTALLED', 'APP_ENABLED', 'APP_DISABLED', 'APP_UNINSTALLED']) {
      assert.ok(merchantAudits.some(item => item.action === action), `merchant audit includes ${action}`);
    }
    assert.ok(platformAudits.some(item => item.action === 'APP_STORE_APP_UPDATED'));
    assert.ok(platformAudits.some(item => item.action === 'APP_STORE_APP_CREATED'));
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
