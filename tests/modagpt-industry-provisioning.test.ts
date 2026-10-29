import assert from 'node:assert/strict';
import test from 'node:test';
import type { Prisma } from '@prisma/client';
import {
  getModaGptCoreAgentRoles,
  inferModaGptIndustryFromBusinessType,
  isCurrentModaGptCoreTeam,
  modaGptIndustryPacks,
  parseModaGptIndustry,
  requireModaGptIndustry,
  resolveNewModaGptIndustry
} from '../src/server/modagptCoreEmployees';
import { merchantIndustries } from '../src/constants/merchantIndustries';
import { provisionModaGptIndustryTeam } from '../src/server/modagptIndustryProvisioning';

function createProvisionStore(industry = 'OTHER') {
  const state = {
    industry,
    industrySource: 'LEGACY_INFERENCE',
    assignments: new Map<string, Record<string, unknown>>(),
    runs: new Map<string, Record<string, unknown>>(),
    audits: [] as Array<Record<string, unknown>>
  };
  const tx = {
    merchant: {
      findUnique: async () => ({ industry: state.industry }),
      update: async ({ data }: { data: { industry: string; industrySource?: string } }) => {
        state.industry = data.industry;
        if (data.industrySource) state.industrySource = data.industrySource;
        return { id: 'merchant-a', ...data };
      }
    },
    merchantAiTeamProvisionRun: {
      findUnique: async ({ where }: { where: { merchantId_idempotencyKey: { idempotencyKey: string } } }) =>
        state.runs.get(where.merchantId_idempotencyKey.idempotencyKey) || null,
      upsert: async ({ where, create, update }: {
        where: { merchantId_idempotencyKey: { idempotencyKey: string } };
        create: Record<string, unknown>;
        update: Record<string, unknown>;
      }) => {
        const key = where.merchantId_idempotencyKey.idempotencyKey;
        const row = { ...(state.runs.get(key) || create), ...update };
        state.runs.set(key, row);
        return row;
      },
      update: async ({ where, data }: {
        where: { merchantId_idempotencyKey: { idempotencyKey: string } };
        data: Record<string, unknown>;
      }) => {
        const key = where.merchantId_idempotencyKey.idempotencyKey;
        const row = { ...state.runs.get(key), ...data };
        state.runs.set(key, row);
        return row;
      }
    },
    merchantAiTeamAssignment: {
      upsert: async ({ where, create, update }: {
        where: { merchantId_agentId: { agentId: string } };
        create: Record<string, unknown>;
        update: Record<string, unknown>;
      }) => {
        const key = where.merchantId_agentId.agentId;
        const row = { ...(state.assignments.get(key) || create), ...update };
        state.assignments.set(key, row);
        return row;
      },
      findMany: async ({ where }: { where: { industry: string } }) =>
        [...state.assignments.values()].filter(row => row.industry === where.industry)
    },
    employeeAuditLog: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        state.audits.push(data);
        return data;
      }
    }
  } as unknown as Prisma.TransactionClient;
  return { tx, state };
}

test('industry packs configure exactly the fixed four Core employees', () => {
  const industries = Object.keys(modaGptIndustryPacks);
  assert.equal(industries.length, 9);
  assert.deepEqual(parseModaGptIndustry('fashion_company'), 'FASHION_COMPANY');
  assert.equal(parseModaGptIndustry('fashion'), null);
  assert.equal(inferModaGptIndustryFromBusinessType('wholesaler'), 'WHOLESALE_COMPANY');
  assert.equal(inferModaGptIndustryFromBusinessType('restaurant'), 'RESTAURANT');
  for (const industry of industries) {
    const pack = modaGptIndustryPacks[industry as keyof typeof modaGptIndustryPacks];
    assert.deepEqual(Object.keys(pack.employees).sort(), [...getModaGptCoreAgentRoles()].sort());
    assert.equal(isCurrentModaGptCoreTeam(Object.values(pack.employees).map(employee => ({
      agentId: employee.agentId,
      packVersion: employee.version
    }))), true);
    assert.ok(Object.values(pack.employees).every(employee => employee.industry === industry));
  }
  assert.equal(isCurrentModaGptCoreTeam([{ agentId: 'business-manager', packVersion: '1.0.0' }]), false);
});

test('merchant registration industries share the canonical six homepage categories', () => {
  assert.deepEqual(merchantIndustries.map(industry => [industry.id, industry.zh]), [
    ['FASHION_COMPANY', '服装公司'],
    ['LEATHER_GOODS', '皮包批发'],
    ['TRADING_COMPANY', '贸易公司'],
    ['DEPARTMENT_STORE', '百货货行'],
    ['RESTAURANT', '餐馆外卖'],
    ['RETAIL_STORE', '零售店']
  ]);
});

test('new merchant registration paths require explicit industry and provision the matching employee pack', async () => {
  const paths = [
    { path: 'normal registration', industry: 'FASHION_COMPANY', source: 'SELF_SELECTED' },
    { path: 'Google registration', industry: 'RESTAURANT', source: 'GOOGLE_ONBOARDING' },
    { path: 'Quick Start registration', industry: 'TRADING_COMPANY', source: 'SELF_SELECTED' },
    { path: 'admin creation', industry: 'RETAIL_STORE', source: 'ADMIN' },
    { path: 'wholesale registration', industry: 'WHOLESALE_COMPANY', source: 'SELF_SELECTED' },
    { path: 'leather wholesale registration', industry: 'LEATHER_GOODS', source: 'SELF_SELECTED' }
  ] as const;

  assert.throws(() => requireModaGptIndustry(undefined), /REQUIRE_INDUSTRY/);
  assert.throws(() => requireModaGptIndustry('fashion'), /REQUIRE_INDUSTRY/);
  assert.deepEqual(resolveNewModaGptIndustry(undefined), { error: 'REQUIRE_INDUSTRY' });
  assert.deepEqual(resolveNewModaGptIndustry('not-an-industry'), { error: 'INVALID_INDUSTRY' });
  for (const entry of paths) {
    const resolution = resolveNewModaGptIndustry(entry.industry);
    assert.ok(resolution.industry, entry.path);
    const industry = resolution.industry;
    const { tx, state } = createProvisionStore();
    const assignments = await provisionModaGptIndustryTeam({
      tx,
      merchantId: 'merchant-a',
      industry,
      industrySource: entry.source,
      idempotencyKey: `${entry.path}:merchant-a`
    });
    const pack = modaGptIndustryPacks[industry];

    assert.equal(state.industry, industry, entry.path);
    assert.equal(state.industrySource, entry.source, entry.path);
    assert.equal(assignments.length, 4, entry.path);
    for (const assignment of assignments) {
      const expected = pack.employees[assignment.agentId as keyof typeof pack.employees];
      assert.equal(assignment.industry, industry, entry.path);
      assert.equal(assignment.displayName, expected.displayName, entry.path);
      const configuration = JSON.parse(String(assignment.configuration)) as Record<string, unknown>;
      assert.deepEqual(configuration.skills, expected.skills, entry.path);
      assert.deepEqual(configuration.tools, expected.tools, entry.path);
    }
  }

  const restaurantPack = modaGptIndustryPacks.RESTAURANT;
  assert.ok(Object.values(restaurantPack.employees).every(employee => employee.industry === 'RESTAURANT'));
  assert.ok(Object.values(restaurantPack.employees).every(employee => !employee.skills.includes('fashion_design')));
  assert.ok(Object.values(restaurantPack.employees).every(employee => !employee.knowledgeTags.includes('fashion')));
});

test('industry team provision is idempotent and never turns recommended permissions into grants', async () => {
  const { tx, state } = createProvisionStore();
  const input = {
    tx,
    merchantId: 'merchant-a',
    industry: 'FASHION_COMPANY' as const,
    idempotencyKey: 'signup:merchant-a'
  };

  const first = await provisionModaGptIndustryTeam(input);
  const second = await provisionModaGptIndustryTeam(input);

  assert.equal(first.length, 4);
  assert.equal(second.length, 4);
  assert.equal(state.assignments.size, 4);
  assert.equal(state.runs.size, 1);
  assert.equal(state.audits.length, 1);
  assert.equal(state.industry, 'FASHION_COMPANY');
  const productAssignment = state.assignments.get('product-creative-manager');
  const config = JSON.parse(String(productAssignment?.configuration)) as Record<string, unknown>;
  assert.deepEqual(config.defaultPermissions, ['product.catalog.read']);
  assert.equal('grantedPermissions' in config, false);
});

test('changing industry updates only its pack assignments, records the change, and rejects key reuse', async () => {
  const { tx, state } = createProvisionStore('FASHION_COMPANY');
  await provisionModaGptIndustryTeam({
    tx,
    merchantId: 'merchant-a',
    industry: 'FASHION_WHOLESALE',
    idempotencyKey: 'change-1',
    actorId: 'employee-a'
  });

  assert.equal(state.industry, 'FASHION_WHOLESALE');
  assert.equal(state.assignments.size, 4);
  assert.equal(state.audits.length, 1);
  assert.match(String(state.audits[0].metadata), /FASHION_COMPANY/);
  await assert.rejects(
    provisionModaGptIndustryTeam({
      tx,
      merchantId: 'merchant-a',
      industry: 'RESTAURANT',
      idempotencyKey: 'change-1'
    }),
    /idempotency key was reused/
  );
});
