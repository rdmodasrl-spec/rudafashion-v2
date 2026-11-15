import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { fork, type ChildProcess } from 'node:child_process';
import net from 'node:net';
import path from 'node:path';
import test from 'node:test';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { getIsolatedPostgresTestDatabaseUrl } from '../../scripts/isolatedPostgresTestDatabase';
import { getMerchantIndustryTemplate } from '../../src/constants/merchantIndustryTemplates';

if (process.env.NODE_ENV !== 'test') {
  throw new Error('LEATHER_STUDIO_PROJECT_INTEGRATION_REQUIRES_NODE_ENV_TEST');
}

const databaseUrl = getIsolatedPostgresTestDatabaseUrl({
  nodeEnv: process.env.NODE_ENV,
  testDatabaseUrl: process.env.LEATHER_STUDIO_TEST_DATABASE_URL,
  applicationDatabaseUrl: process.env.RUDA_APPLICATION_DATABASE_URL,
  runId: process.env.LEATHER_STUDIO_TEST_RUN_ID,
  containerId: process.env.LEATHER_STUDIO_TEST_CONTAINER_ID
});
const merchantSecret = process.env.JWT_MERCHANT_SECRET;
if (!merchantSecret) throw new Error('LEATHER_STUDIO_PROJECT_INTEGRATION_JWT_SECRET_REQUIRED');

const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
type LeatherProject = {
  id: string;
  title: string;
  payload: Record<string, unknown>;
  revision: number;
  studioCode?: string;
  industryTemplate?: string;
};
type ApiError = string | { code?: string; details?: Record<string, unknown> };
type ApiBody = {
  project?: LeatherProject;
  projects?: Array<{ id: string; revision: number }>;
  versions?: Array<{ revision: number }>;
  studios?: Array<{
    industryCode: string;
    industryTemplate: string;
    studioCode: string;
    status: string;
    source: string;
    capabilities: { apparelPatternEngineering: boolean };
  }>;
  replayed?: boolean;
  error?: ApiError;
  [key: string]: unknown;
};
type HttpResult = { status: number; body: ApiBody };

async function getFreePort(): Promise<number> {
  const listener = net.createServer();
  await new Promise<void>((resolve, reject) => {
    listener.once('error', reject);
    listener.listen(0, '127.0.0.1', resolve);
  });
  const address = listener.address();
  if (!address || typeof address === 'string') throw new Error('LEATHER_STUDIO_PROJECT_TEST_PORT_UNAVAILABLE');
  await new Promise<void>((resolve, reject) => listener.close(error => error ? reject(error) : resolve()));
  return address.port;
}

async function request(baseUrl: string, route: string, options: {
  method?: string;
  token?: string;
  idempotencyKey?: string;
  body?: unknown;
} = {}): Promise<HttpResult> {
  const response = await fetch(`${baseUrl}${route}`, {
    method: options.method || 'GET',
    headers: {
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
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
  return { status: response.status, body };
}

function errorCode(body: ApiBody): string | undefined {
  return typeof body.error === 'string' ? body.error : body.error?.code;
}

function requireProject(body: ApiBody): LeatherProject {
  if (!body.project) throw new Error('LEATHER_STUDIO_PROJECT_RESPONSE_MISSING_PROJECT');
  return body.project;
}

function requireVersions(body: ApiBody): Array<{ revision: number }> {
  if (!body.versions) throw new Error('LEATHER_STUDIO_PROJECT_RESPONSE_MISSING_VERSIONS');
  return body.versions;
}

function merchantToken(merchantId: string, employeeId?: string): string {
  return jwt.sign({
    id: employeeId || merchantId,
    merchantId,
    role: employeeId ? 'employee' : 'merchant',
    ...(employeeId ? { employeeId } : {})
  }, merchantSecret!, { expiresIn: '20m' });
}

async function createMerchant(
  suffix: string,
  industryTemplate: string,
  industryOverride?: string
): Promise<string> {
  const id = crypto.randomUUID();
  const template = getMerchantIndustryTemplate(industryTemplate);
  if (!template) throw new Error(`UNKNOWN_TEST_MERCHANT_INDUSTRY_TEMPLATE:${industryTemplate}`);
  await prisma.merchant.create({
    data: {
      id,
      name: `Leather Studio ${industryTemplate} ${suffix}`,
      companyLegalName: `Leather Studio ${industryTemplate} ${suffix} Ltd`,
      code: `LEATHER-${industryTemplate}-${suffix}`,
      country: 'Italy',
      city: 'Prato',
      showroomAddress: 'Isolated test address',
      showroomArea: 'Test',
      showroomImage: '',
      logo: '',
      banner: '',
      tagline: 'Isolated Leather Studio integration test',
      description: 'Test-only merchant fixture.',
      specialties: '[]',
      foundedYear: 2020,
      contactPerson: 'Integration Test',
      contactPhone: '+390000000000',
      contactEmail: `leather-${industryTemplate}-${suffix}@example.test`,
      storeSlug: `leather-${industryTemplate}-${suffix}`,
      industry: industryOverride || template.merchantIndustry,
      industryTemplate
    }
  });
  return id;
}

async function waitForReady(baseUrl: string, child: ChildProcess, logs: () => string): Promise<void> {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`LEATHER_STUDIO_PROJECT_SERVER_EXITED:${child.exitCode}:${logs()}`);
    }
    try {
      const response = await fetch(`${baseUrl}/api/health/ready`, { signal: AbortSignal.timeout(1_500) });
      if (response.ok) return;
    } catch {
      await new Promise(resolve => setTimeout(resolve, 400));
    }
  }
  throw new Error(`LEATHER_STUDIO_PROJECT_SERVER_START_TIMEOUT:${logs()}`);
}

test('merchant Studio project APIs enforce tenant, Studio, employee, idempotency and revision boundaries', async () => {
  const suffix = crypto.randomUUID().replaceAll('-', '');
  const merchantA = await createMerchant(suffix, 'bags_wholesale');
  const merchantB = await createMerchant(`${suffix}-other-tenant`, 'bags_wholesale');
  const multiStudioMerchant = await createMerchant(`${suffix}-multi-studio`, 'bags_wholesale');
  const merchantWrongIndustry = await createMerchant(
    `${suffix}-wrong-industry`,
    'restaurant_ordering',
    'FASHION_COMPANY'
  );
  const apparelMerchant = await createMerchant(`${suffix}-apparel`, 'apparel_wholesale');
  const apparelProductionMerchant = await createMerchant(`${suffix}-apparel-production`, 'apparel_production_wholesale');
  const apparelIndustry = getMerchantIndustryTemplate('apparel_wholesale')?.merchantIndustry;
  if (!apparelIndustry) throw new Error('APPAREL_TEST_INDUSTRY_UNAVAILABLE');
  await prisma.merchantAiTeamAssignment.createMany({
    data: [
      'business-manager',
      'sales-customer-manager',
      'supply-chain-finance-manager'
    ].map(agentId => ({
      merchantId: apparelMerchant,
      agentId,
      industry: apparelIndustry,
      displayName: `Integration ${agentId}`,
      configuration: '{}',
      packVersion: 'integration-test'
    }))
  });
  const apparelDesignId = crypto.randomUUID();
  const foreignDesignId = crypto.randomUUID();
  await prisma.merchantModaGptDesign.createMany({
    data: [
      {
        id: apparelDesignId,
        merchantId: apparelMerchant,
        actorId: apparelMerchant,
        title: 'Merchant-owned blouse design',
        prompt: 'Integration test design',
        category: 'design',
        imageStorageKey: `integration/${suffix}/apparel.webp`,
        imageWidth: 640,
        imageHeight: 800
      },
      {
        id: foreignDesignId,
        merchantId: merchantB,
        actorId: merchantB,
        title: 'Other merchant design',
        prompt: 'Integration test design',
        category: 'design',
        imageStorageKey: `integration/${suffix}/foreign.webp`,
        imageWidth: 640,
        imageHeight: 800
      }
    ]
  });
  await prisma.merchantStudioEntitlement.createMany({
    data: [
      {
        merchantId: multiStudioMerchant,
        industryCode: 'leather_bag_wholesale',
        industryTemplate: 'bags_wholesale',
        studioCode: 'leather_studio',
        mode: 'default',
        status: 'active',
        capabilities: {},
        source: 'integration_test'
      },
      {
        merchantId: multiStudioMerchant,
        industryCode: 'trade_wholesale',
        industryTemplate: 'trading_wholesale',
        studioCode: 'trade_studio',
        mode: 'default',
        status: 'active',
        capabilities: {},
        source: 'integration_test'
      },
      {
        merchantId: multiStudioMerchant,
        industryCode: 'apparel_production_wholesale',
        industryTemplate: 'apparel_production_wholesale',
        studioCode: 'apparel_studio',
        mode: 'production',
        status: 'active',
        capabilities: { apparelPatternEngineering: true },
        source: 'integration_test'
      },
      {
        merchantId: multiStudioMerchant,
        industryCode: 'apparel_wholesale',
        industryTemplate: 'apparel_wholesale',
        studioCode: 'apparel_studio',
        mode: 'wholesale',
        status: 'active',
        capabilities: { apparelPatternEngineering: true },
        source: 'integration_test'
      },
      {
        merchantId: multiStudioMerchant,
        industryCode: 'restaurant',
        industryTemplate: 'restaurant_ordering',
        studioCode: 'restaurant_studio',
        mode: 'default',
        status: 'pending',
        capabilities: {},
        source: 'integration_test'
      },
      {
        merchantId: multiStudioMerchant,
        industryCode: 'incorrect_mapping',
        industryTemplate: 'general_retail',
        studioCode: 'retail_studio',
        mode: 'default',
        status: 'active',
        capabilities: {},
        source: 'integration_test'
      }
    ]
  });
  const deniedEmployeeId = crypto.randomUUID();
  const allowedEmployeeId = crypto.randomUUID();
  await prisma.merchantEmployee.createMany({
    data: [
      {
        id: deniedEmployeeId,
        merchantId: merchantA,
        email: `leather-denied-${suffix}@example.test`,
        name: 'Restricted integration employee',
        passwordHash: 'not-used-by-this-api-test',
        role: 'sales',
        permissions: '[]'
      },
      {
        id: allowedEmployeeId,
        merchantId: merchantA,
        email: `leather-allowed-${suffix}@example.test`,
        name: 'Authorized integration employee',
        passwordHash: 'not-used-by-this-api-test',
        role: 'sales',
        permissions: '["ai.tools.use"]'
      }
    ]
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
      JWT_ADMIN_SECRET: process.env.JWT_ADMIN_SECRET || 'leather-studio-test-admin-secret-0123456789abcdef',
      JWT_BUYER_SECRET: 'leather-studio-test-buyer-secret-0123456789abcdef',
      SHARE_LINK_SECRET: 'leather-studio-test-share-secret-0123456789abcdef',
      ADMIN_TOTP_ENCRYPTION_KEY: 'leather-studio-test-totp-secret-0123456789abcdef',
      PAYMENT_ENABLED: 'false',
      MODAGPT_BRAIN_ENABLED: 'false',
      OBJECT_STORAGE_ENDPOINT: '',
      OBJECT_STORAGE_BUCKET: '',
      OBJECT_STORAGE_ACCESS_KEY_ID: '',
      OBJECT_STORAGE_SECRET_ACCESS_KEY: '',
      R2_ACCOUNT_ID: '',
      R2_ENDPOINT: '',
      R2_ACCESS_KEY_ID: '',
      R2_SECRET_ACCESS_KEY: '',
      R2_BUCKET_NAME: '',
      R2_PRIVATE_BUCKET_NAME: '',
      R2_PUBLIC_URL: ''
    },
    execArgv: ['--import', 'tsx'],
    stdio: ['ignore', 'pipe', 'pipe', 'ipc']
  });
  server.stdout?.on('data', chunk => serverLogs.push(String(chunk)));
  server.stderr?.on('data', chunk => serverLogs.push(String(chunk)));

  const ownerA = merchantToken(merchantA);
  const ownerB = merchantToken(merchantB);
  const wrongIndustryOwner = merchantToken(merchantWrongIndustry);
  const apparelOwner = merchantToken(apparelMerchant);
  const apparelProductionOwner = merchantToken(apparelProductionMerchant);
  const deniedEmployee = merchantToken(merchantA, deniedEmployeeId);
  const allowedEmployee = merchantToken(merchantA, allowedEmployeeId);
  const projectPath = '/api/merchant/leather-studio/projects';
  const studioProjectPath = '/api/merchant/studio-projects';
  const projectPayload = { title: 'Cross-device sample', payload: { pattern: { pieces: [{ id: 'front' }] } } };
  const projectIdempotencyKey = `leather-project:${suffix}`;

  try {
    await waitForReady(baseUrl, server, logs);
    assert.equal((await request(baseUrl, projectPath)).status, 401);

    const multiStudioAccess = await request(baseUrl, '/api/merchant/studios', {
      token: merchantToken(multiStudioMerchant)
    });
    assert.equal(multiStudioAccess.status, 200, logs());
    assert.deepEqual(
      multiStudioAccess.body.studios?.map(studio => studio.industryCode).sort(),
      ['apparel_production_wholesale', 'apparel_wholesale', 'leather_bag_wholesale', 'trade_wholesale']
    );
    assert.ok(multiStudioAccess.body.studios?.every(studio =>
      studio.status === 'active' && studio.source === 'entitlement'
    ));
    assert.equal(
      multiStudioAccess.body.studios?.find(studio => studio.industryCode === 'apparel_production_wholesale')
        ?.capabilities.apparelPatternEngineering,
      true
    );
    assert.equal(
      multiStudioAccess.body.studios?.find(studio => studio.industryCode === 'apparel_wholesale')
        ?.capabilities.apparelPatternEngineering,
      false
    );
    const otherTenantStudioAccess = await request(baseUrl, '/api/merchant/studios', { token: ownerB });
    assert.equal(otherTenantStudioAccess.status, 200);
    assert.deepEqual(otherTenantStudioAccess.body.studios?.map(studio => studio.industryCode), ['leather_bag_wholesale']);
    const multiStudioToken = merchantToken(multiStudioMerchant);
    const tradeProject = await request(baseUrl, studioProjectPath, {
      method: 'POST',
      token: multiStudioToken,
      idempotencyKey: `trade-project:${suffix}`,
      body: {
        title: 'Trade project',
        industryTemplate: 'trading_wholesale',
        payload: { catalog: { language: 'it' } }
      }
    });
    assert.equal(tradeProject.status, 201, `${JSON.stringify(tradeProject.body)}\n${logs()}`);
    const tradeProjectData = requireProject(tradeProject.body);
    assert.equal(tradeProjectData.industryTemplate, 'trading_wholesale');
    assert.equal(tradeProjectData.studioCode, 'trade_studio');
    const defaultProjectList = await request(baseUrl, studioProjectPath, { token: multiStudioToken });
    assert.equal(defaultProjectList.status, 200);
    assert.ok(!defaultProjectList.body.projects?.some(project => project.id === tradeProjectData.id));
    const tradeProjectList = await request(
      baseUrl,
      `${studioProjectPath}?industryTemplate=trading_wholesale`,
      { token: multiStudioToken }
    );
    assert.ok(tradeProjectList.body.projects?.some(project => project.id === tradeProjectData.id));
    const secondaryIndustryTask = await request(baseUrl, '/api/merchant/modagpt/task', {
      method: 'POST',
      token: multiStudioToken,
      idempotencyKey: `secondary-industry-task:${suffix}`,
      body: { message: '分析本周销售表现', projectId: tradeProjectData.id }
    });
    assert.equal(secondaryIndustryTask.status, 409);
    assert.equal(errorCode(secondaryIndustryTask.body), 'MODAGPT_PROJECT_INDUSTRY_CONTEXT_UNAVAILABLE');
    assert.equal(
      await prisma.modaGptTask.count({ where: { merchantId: multiStudioMerchant, projectId: tradeProjectData.id } }),
      0,
      'a secondary-industry project must not enqueue work through the merchant primary industry AI team'
    );
    assert.equal(
      (await request(baseUrl, `${studioProjectPath}/${tradeProjectData.id}`, { token: ownerB })).status,
      404
    );
    const sameApparelRequestId = `apparel-dual-mode:${suffix}`;
    const apparelProjectPayload = { title: 'Apparel mode project', payload: { design: { garment: 'shirt' } } };
    const productionProject = await request(baseUrl, studioProjectPath, {
      method: 'POST',
      token: multiStudioToken,
      idempotencyKey: sameApparelRequestId,
      body: { ...apparelProjectPayload, industryTemplate: 'apparel_production_wholesale' }
    });
    const wholesaleProject = await request(baseUrl, studioProjectPath, {
      method: 'POST',
      token: multiStudioToken,
      idempotencyKey: sameApparelRequestId,
      body: { ...apparelProjectPayload, industryTemplate: 'apparel_wholesale' }
    });
    assert.equal(productionProject.status, 201, `${JSON.stringify(productionProject.body)}\n${logs()}`);
    assert.equal(wholesaleProject.status, 201, `${JSON.stringify(wholesaleProject.body)}\n${logs()}`);
    assert.notEqual(requireProject(productionProject.body).id, requireProject(wholesaleProject.body).id);
    assert.equal(requireProject(productionProject.body).industryTemplate, 'apparel_production_wholesale');
    assert.equal(requireProject(wholesaleProject.body).industryTemplate, 'apparel_wholesale');

    const wrongIndustry = await request(baseUrl, projectPath, { token: wrongIndustryOwner });
    assert.equal(wrongIndustry.status, 403);
    assert.equal(errorCode(wrongIndustry.body), 'INDUSTRY_TEMPLATE_UNAVAILABLE');
    const unsupportedStudio = await request(baseUrl, studioProjectPath, { token: wrongIndustryOwner });
    assert.equal(unsupportedStudio.status, 403);
    assert.equal(errorCode(unsupportedStudio.body), 'STUDIO_PROJECT_ACCESS_DENIED');

    const deniedList = await request(baseUrl, projectPath, { token: deniedEmployee });
    assert.equal(deniedList.status, 403);
    assert.equal(errorCode(deniedList.body), 'EMPLOYEE_PERMISSION_REQUIRED');
    assert.equal((await request(baseUrl, projectPath, { token: allowedEmployee })).status, 200);

    const concurrentCreates = await Promise.all([
      request(baseUrl, projectPath, { method: 'POST', token: ownerA, idempotencyKey: projectIdempotencyKey, body: projectPayload }),
      request(baseUrl, projectPath, { method: 'POST', token: ownerA, idempotencyKey: projectIdempotencyKey, body: projectPayload })
    ]);
    assert.deepEqual(concurrentCreates.map(result => result.status).sort(), [200, 201], logs());
    assert.equal(requireProject(concurrentCreates[0].body).id, requireProject(concurrentCreates[1].body).id);
    assert.equal(concurrentCreates.filter(result => result.body.replayed === true).length, 1);
    const projectId = requireProject(concurrentCreates[0].body).id;
    assert.equal(requireProject(concurrentCreates[0].body).revision, 1);
    assert.deepEqual(requireProject(concurrentCreates[0].body).payload, projectPayload.payload);

    const conflictingReplay = await request(baseUrl, projectPath, {
      method: 'POST',
      token: ownerA,
      idempotencyKey: projectIdempotencyKey,
      body: { ...projectPayload, title: 'Different content' }
    });
    assert.equal(conflictingReplay.status, 409);
    assert.equal(errorCode(conflictingReplay.body), 'IDEMPOTENCY_KEY_REUSED');

    const foreignRead = await request(baseUrl, `${projectPath}/${projectId}`, { token: ownerB });
    assert.equal(foreignRead.status, 404);
    assert.equal(errorCode(foreignRead.body), 'NOT_FOUND');
    assert.deepEqual(requireProject((await request(baseUrl, `${projectPath}/${projectId}`, { token: ownerA })).body).payload, projectPayload.payload);
    assert.equal((await request(baseUrl, `${projectPath}/${projectId}`, { token: allowedEmployee })).status, 200);

    const concurrentUpdates = await Promise.all([
      request(baseUrl, `${projectPath}/${projectId}`, {
        method: 'PUT',
        token: ownerA,
        body: { title: 'Revision from desktop', payload: { cad: { version: 1 } }, expectedRevision: 1 }
      }),
      request(baseUrl, `${projectPath}/${projectId}`, {
        method: 'PUT',
        token: allowedEmployee,
        body: { title: 'Revision from mobile', payload: { cad: { version: 2 } }, expectedRevision: 1 }
      })
    ]);
    assert.deepEqual(concurrentUpdates.map(result => result.status).sort(), [200, 409], logs());
    const conflict = concurrentUpdates.find(result => result.status === 409)!;
    assert.equal(errorCode(conflict.body), 'REVISION_CONFLICT');
    assert.equal(typeof conflict.body.error, 'object');
    if (typeof conflict.body.error !== 'object') throw new Error('LEATHER_STUDIO_PROJECT_CONFLICT_MISSING_ERROR');
    assert.equal(conflict.body.error.details?.currentRevision, 2);

    const currentProject = await request(baseUrl, `${projectPath}/${projectId}`, { token: ownerA });
    assert.equal(currentProject.status, 200);
    assert.equal(requireProject(currentProject.body).revision, 2);
    assert.ok(['Revision from desktop', 'Revision from mobile'].includes(requireProject(currentProject.body).title));
    const sharedProjectList = await request(baseUrl, projectPath, { token: ownerA });
    assert.equal(sharedProjectList.status, 200);
    assert.ok(sharedProjectList.body.projects);
    assert.ok(
      sharedProjectList.body.projects.some(project =>
        project.id === projectId && project.revision === 2
      ),
      'all merchant clients must list the same persisted project revision'
    );
    const versions = await request(baseUrl, `${projectPath}/${projectId}/versions`, { token: ownerA });
    assert.equal(versions.status, 200);
    assert.deepEqual(requireVersions(versions.body).map(version => version.revision), [2, 1]);
    assert.equal((await prisma.merchantStudioProject.count({ where: { merchantId: merchantA, studioCode: 'leather_studio' } })), 1);
    assert.equal((await prisma.merchantStudioProject.count({ where: { merchantId: merchantB, studioCode: 'leather_studio' } })), 0);
    assert.equal((await prisma.merchantStudioProjectVersion.count({ where: { projectId } })), 2);

    const staleWrite = await request(baseUrl, `${projectPath}/${projectId}`, {
      method: 'PUT',
      token: ownerA,
      body: { title: 'Stale write', payload: { cad: { version: 0 } }, expectedRevision: 1 }
    });
    assert.equal(staleWrite.status, 409);
    assert.equal(requireProject((await request(baseUrl, `${projectPath}/${projectId}`, { token: ownerA })).body).revision, 2);

    const foreignVersions = await request(baseUrl, `${projectPath}/${projectId}/versions`, { token: ownerB });
    assert.equal(foreignVersions.status, 404);

    const apparelCreate = await request(baseUrl, studioProjectPath, {
      method: 'POST',
      token: apparelOwner,
      idempotencyKey: `apparel-project:${suffix}`,
      body: { title: 'Apparel sample', payload: { design: { garment: 'shirt' } } }
    });
    assert.equal(apparelCreate.status, 201, `${JSON.stringify(apparelCreate.body)}\n${logs()}`);
    const apparelProject = requireProject(apparelCreate.body);
    assert.equal(apparelProject.studioCode, 'apparel_studio');
    assert.equal(apparelProject.industryTemplate, 'apparel_wholesale');
    const apparelRead = await request(baseUrl, `${studioProjectPath}/${apparelProject.id}`, { token: apparelOwner });
    assert.equal(apparelRead.status, 200);
    assert.equal(requireProject(apparelRead.body).revision, apparelProject.revision);
    const linkedDesignUpdate = await request(baseUrl, `${studioProjectPath}/${apparelProject.id}`, {
      method: 'PUT',
      token: apparelOwner,
      body: {
        title: apparelProject.title,
        payload: {
          ...apparelProject.payload,
          linkedDesigns: [
            { designId: apparelDesignId, title: 'Forged client title', category: 'forged' },
            { designId: apparelDesignId, title: 'Duplicate reference', category: 'forged' }
          ]
        },
        expectedRevision: apparelProject.revision
      }
    });
    assert.equal(linkedDesignUpdate.status, 200, `${JSON.stringify(linkedDesignUpdate.body)}\n${logs()}`);
    const linkedProject = requireProject(linkedDesignUpdate.body);
    assert.equal(linkedProject.revision, apparelProject.revision + 1);
    assert.deepEqual(linkedProject.payload.linkedDesigns, [{
      designId: apparelDesignId,
      title: 'Merchant-owned blouse design',
      category: 'design'
    }]);
    assert.equal(
      (await prisma.merchantStudioProjectVersion.count({ where: { projectId: apparelProject.id } })),
      2,
      'linking a saved design must create a project revision'
    );
    const foreignDesignUpdate = await request(baseUrl, `${studioProjectPath}/${apparelProject.id}`, {
      method: 'PUT',
      token: apparelOwner,
      body: {
        title: apparelProject.title,
        payload: { ...linkedProject.payload, linkedDesigns: [{ designId: foreignDesignId, title: 'Other merchant design', category: 'design' }] },
        expectedRevision: linkedProject.revision
      }
    });
    assert.equal(foreignDesignUpdate.status, 404);
    assert.equal(errorCode(foreignDesignUpdate.body), 'STUDIO_PROJECT_DESIGN_NOT_FOUND');
    assert.equal(
      requireProject((await request(baseUrl, `${studioProjectPath}/${apparelProject.id}`, { token: apparelOwner })).body).revision,
      linkedProject.revision,
      'a foreign design reference must not change the stored project revision'
    );
    assert.deepEqual(requireProject(apparelRead.body).payload, { design: { garment: 'shirt' } });
    const apparelList = await request(baseUrl, studioProjectPath, { token: apparelOwner });
    assert.ok(apparelList.body.projects);
    assert.ok(
      apparelList.body.projects.some(project => project.id === apparelProject.id),
      'Apparel projects must be visible to the shared project list on every client'
    );
    const projectTaskKey = `studio-project-task:${suffix}`;
    const projectTask = await request(baseUrl, '/api/merchant/modagpt/task', {
      method: 'POST',
      token: apparelOwner,
      idempotencyKey: projectTaskKey,
      body: { message: '分析最近 30 天的销售情况', projectId: apparelProject.id }
    });
    assert.equal(projectTask.status, 202, `${JSON.stringify(projectTask.body)}\n${logs()}`);
    assert.equal(projectTask.body.projectId, apparelProject.id);
    assert.equal(typeof projectTask.body.taskId, 'string');
    const projectTaskReplay = await request(baseUrl, '/api/merchant/modagpt/task', {
      method: 'POST',
      token: apparelOwner,
      idempotencyKey: projectTaskKey,
      body: { message: '分析最近 30 天的销售情况', projectId: apparelProject.id }
    });
    assert.equal(projectTaskReplay.status, 202, logs());
    assert.equal(projectTaskReplay.body.taskId, projectTask.body.taskId);
    assert.equal(projectTaskReplay.body.deduplicated, true);
    const projectTaskId = String(projectTask.body.taskId);
    const projectTaskList = await request(baseUrl, `${studioProjectPath}/${apparelProject.id}/jobs`, {
      token: apparelOwner
    });
    assert.equal(projectTaskList.status, 200, logs());
    assert.ok(
      (projectTaskList.body.jobs as Array<{ jobId: string }>).some(job => job.jobId === projectTaskId),
      'a task submitted from a Studio project must appear in that project task list'
    );
    const projectTaskDetail = await request(baseUrl, `/api/merchant/modagpt/task/${projectTaskId}`, {
      token: apparelOwner
    });
    assert.equal(projectTaskDetail.status, 200, logs());
    assert.equal(projectTaskDetail.body.projectId, apparelProject.id);
    const foreignProjectTask = await request(baseUrl, '/api/merchant/modagpt/task', {
      method: 'POST',
      token: ownerB,
      idempotencyKey: `foreign-studio-project-task:${suffix}`,
      body: { message: '分析最近 30 天的销售情况', projectId: apparelProject.id }
    });
    assert.equal(foreignProjectTask.status, 404);
    assert.equal(
      await prisma.modaGptTask.count({ where: { merchantId: merchantB, projectId: apparelProject.id } }),
      0,
      'a foreign project task must not be enqueued'
    );
    const apparelReplay = await request(baseUrl, studioProjectPath, {
      method: 'POST',
      token: apparelOwner,
      idempotencyKey: `apparel-project:${suffix}`,
      body: { title: 'Apparel sample', payload: { design: { garment: 'shirt' } } }
    });
    assert.equal(apparelReplay.status, 200);
    assert.equal(requireProject(apparelReplay.body).id, apparelProject.id);
    const crossStudioRead = await request(baseUrl, `${studioProjectPath}/${projectId}`, { token: apparelOwner });
    assert.equal(crossStudioRead.status, 404);
    const apparelProductionCreate = await request(baseUrl, studioProjectPath, {
      method: 'POST',
      token: apparelProductionOwner,
      idempotencyKey: `apparel-production-project:${suffix}`,
      body: { title: 'Production apparel sample', payload: { design: { garment: 'shirt' } } }
    });
    assert.equal(apparelProductionCreate.status, 201, logs());
    assert.equal(requireProject(apparelProductionCreate.body).studioCode, 'apparel_studio');
    assert.equal(requireProject(apparelProductionCreate.body).industryTemplate, 'apparel_production_wholesale');

    const unavailableUpload = await request(baseUrl, `${studioProjectPath}/${projectId}/files`, {
      method: 'POST',
      token: ownerA,
      idempotencyKey: `studio-file:${suffix}`,
      body: { fileName: 'pattern.pdf', contentType: 'application/pdf', sizeBytes: 1024 }
    });
    assert.equal(unavailableUpload.status, 503);
    assert.equal(errorCode(unavailableUpload.body), 'OBJECT_STORAGE_NOT_CONFIGURED');
    assert.equal(await prisma.merchantStudioProjectFile.count({ where: { merchantId: merchantA, projectId } }), 0);
    const deniedFileUpload = await request(baseUrl, `${studioProjectPath}/${projectId}/files`, {
      method: 'POST',
      token: deniedEmployee,
      idempotencyKey: `denied-studio-file:${suffix}`,
      body: { fileName: 'pattern.pdf', contentType: 'application/pdf', sizeBytes: 1024 }
    });
    assert.equal(deniedFileUpload.status, 403);
    const foreignFileUpload = await request(baseUrl, `${studioProjectPath}/${projectId}/files`, {
      method: 'POST',
      token: ownerB,
      idempotencyKey: `foreign-studio-file:${suffix}`,
      body: { fileName: 'pattern.pdf', contentType: 'application/pdf', sizeBytes: 1024 }
    });
    assert.equal(foreignFileUpload.status, 404);

    const privateFileId = crypto.randomUUID();
    await prisma.merchantStudioProjectFile.create({
      data: {
        id: privateFileId,
        merchantId: merchantA,
        projectId,
        actorId: merchantA,
        clientRequestId: `studio-file-fixture:${suffix}`,
        requestPayloadHash: 'a'.repeat(64),
        storageBucket: 'isolated-private-bucket',
        storageKey: `merchants/${merchantA}/studio/${projectId}/${privateFileId}`,
        fileName: 'pattern.pdf',
        contentType: 'application/pdf',
        sizeBytes: 1024,
        status: 'ready',
        uploadedAt: new Date()
      }
    });
    await assert.rejects(prisma.merchantStudioProjectFile.create({
      data: {
        merchantId: merchantB,
        projectId,
        actorId: merchantB,
        clientRequestId: `foreign-studio-file:${suffix}`,
        requestPayloadHash: 'b'.repeat(64),
        storageBucket: 'isolated-private-bucket',
        storageKey: `merchants/${merchantB}/studio/${projectId}/${crypto.randomUUID()}`,
        fileName: 'pattern.pdf',
        contentType: 'application/pdf',
        sizeBytes: 1024,
        status: 'ready'
      }
    }));

    const projectFiles = await request(baseUrl, `${studioProjectPath}/${projectId}/files`, { token: ownerA });
    assert.equal(projectFiles.status, 200);
    assert.ok(Array.isArray(projectFiles.body.files));
    assert.equal(projectFiles.body.files.length, 1);
    assert.equal((projectFiles.body.files[0] as { id?: string }).id, privateFileId);
    assert.equal(
      (await request(baseUrl, `${studioProjectPath}/${projectId}/files`, { token: ownerB })).status,
      404
    );
    const linkedFileProject = await request(baseUrl, `${studioProjectPath}/${projectId}`, {
      method: 'PUT',
      token: ownerA,
      body: {
        title: 'Version with private file',
        payload: { fileIds: [privateFileId] },
        expectedRevision: 2
      }
    });
    assert.equal(linkedFileProject.status, 200, `${JSON.stringify(linkedFileProject.body)}\n${logs()}`);
    assert.deepEqual(requireProject(linkedFileProject.body).payload.fileIds, [privateFileId]);
    const referencedFileDelete = await request(baseUrl, `/api/merchant/studio-files/${privateFileId}`, {
      method: 'DELETE',
      token: ownerA
    });
    assert.equal(referencedFileDelete.status, 409);
    assert.equal(errorCode(referencedFileDelete.body), 'STUDIO_FILE_IN_USE');

    const projectJobs = await request(baseUrl, `${studioProjectPath}/${projectId}/jobs`, { token: ownerA });
    assert.equal(projectJobs.status, 200);
    assert.deepEqual(projectJobs.body.jobs, []);
    assert.equal((await request(baseUrl, `${studioProjectPath}/${projectId}/jobs`, { token: ownerB })).status, 404);
    const linkedTaskId = crypto.randomUUID();
    await prisma.modaGptTask.create({
      data: {
        id: linkedTaskId,
        merchantId: merchantA,
        projectId,
        tenantId: merchantA,
        actorId: merchantA,
        traceId: `studio-task:${suffix}`,
        goal: 'Studio project task fixture',
        taskType: 'ai.workflow.run',
        status: 'completed',
        payload: JSON.stringify({ version: 1, workflow: 'merchant_task' }),
        result: JSON.stringify({ status: 'completed' }),
        context: '{}',
        completedAt: new Date()
      }
    });
    const persistedProjectJobs = await request(baseUrl, `${studioProjectPath}/${projectId}/jobs`, { token: ownerA });
    assert.equal(persistedProjectJobs.status, 200);
    assert.equal((persistedProjectJobs.body.jobs as Array<{ jobId: string }>)[0]?.jobId, linkedTaskId);
    const linkedTaskRead = await request(baseUrl, `/api/merchant/modagpt/task/${linkedTaskId}`, { token: ownerA });
    assert.equal(linkedTaskRead.status, 200);
    assert.equal(linkedTaskRead.body.projectId, projectId);
    assert.equal(
      (await request(baseUrl, `/api/merchant/modagpt/task/${linkedTaskId}`, { token: ownerB })).status,
      404
    );
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
