import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { merchantIndustryCapabilities } from '../src/constants/merchantIndustryCapabilities';
import { defaultEmployeePermissions } from '../src/server/employeePermissions';
import {
  hashLeatherStudioProjectInput,
  MAX_LEATHER_PROJECT_PAYLOAD_BYTES,
  normalizeLeatherStudioExpectedRevision,
  normalizeLeatherStudioIdempotencyKey,
  normalizeLeatherStudioProjectInput
} from '../src/server/leatherStudioProject';

const root = process.cwd();
const serverSource = readFileSync(path.join(root, 'server.ts'), 'utf8');
const schemaSource = readFileSync(path.join(root, 'prisma', 'schema.prisma'), 'utf8');
const migrationSource = readFileSync(
  path.join(root, 'prisma', 'migrations', '20261114210000_merchant_studio_projects', 'migration.sql'),
  'utf8'
);
const entitlementMigrationSource = readFileSync(
  path.join(root, 'prisma', 'migrations', '20261114230000_merchant_studio_entitlements', 'migration.sql'),
  'utf8'
);
const projectScopeMigrationSource = readFileSync(
  path.join(root, 'prisma', 'migrations', '20261114240000_studio_project_template_scope', 'migration.sql'),
  'utf8'
);

test('Leather Studio project input validates title, object payload and size limit', () => {
  assert.deepEqual(normalizeLeatherStudioProjectInput({
    title: '  Sample bag  ',
    payload: { pattern: { pieces: [{ id: 'front' }] } }
  }), {
    ok: true,
    input: { title: 'Sample bag', payload: { pattern: { pieces: [{ id: 'front' }] } } },
    payloadBytes: Buffer.byteLength(JSON.stringify({ pattern: { pieces: [{ id: 'front' }] } }))
  });
  assert.equal(normalizeLeatherStudioProjectInput({ title: ' ', payload: {} }).ok, false);
  assert.equal(normalizeLeatherStudioProjectInput({ title: 'valid', payload: [] }).ok, false);
  assert.equal(
    normalizeLeatherStudioProjectInput({ title: 'valid', payload: { data: 'x'.repeat(MAX_LEATHER_PROJECT_PAYLOAD_BYTES) } }).ok,
    false
  );
});

test('idempotency hashing is stable across object key order and revision is strictly positive', () => {
  const first = { title: 'Sample', payload: { width: 20, height: 30 } };
  const reordered = { title: 'Sample', payload: { height: 30, width: 20 } };
  assert.equal(hashLeatherStudioProjectInput(first), hashLeatherStudioProjectInput(reordered));
  assert.equal(normalizeLeatherStudioIdempotencyKey(' request-1 '), 'request-1');
  assert.equal(normalizeLeatherStudioIdempotencyKey(''), null);
  assert.equal(normalizeLeatherStudioIdempotencyKey('x'.repeat(161)), null);
  assert.equal(normalizeLeatherStudioExpectedRevision(1), 1);
  assert.equal(normalizeLeatherStudioExpectedRevision(0), null);
  assert.equal(normalizeLeatherStudioExpectedRevision('1'), null);
});

test('Leather Studio capability is restricted to bags wholesale and employees need AI-tools permission', () => {
  assert.equal(merchantIndustryCapabilities.bags_wholesale.templateId, 'bags_wholesale');
  assert.ok(defaultEmployeePermissions.store_manager.includes('ai.tools.use'));
});

test('project APIs use merchant, Studio access and employee permission guards with tenant-scoped writes', () => {
  assert.match(serverSource, /resolveMerchantStudioAccess/);
  assert.match(serverSource, /requireEmployeePermission\('ai\.tools\.use'\)/);
  assert.match(serverSource, /app\.use\('\/api\/merchant\/studio-projects', studioProjectRouter\)/);
  assert.match(serverSource, /app\.use\(\s*'\/api\/merchant\/leather-studio\/projects'/);
  assert.match(serverSource, /requireMerchantIndustryTemplate\('bags_wholesale'\)/);
  assert.match(serverSource, /studioCode: context\.studioCode,\s*industryTemplate: context\.industryTemplate,\s*revision: expectedRevision/);
  assert.match(serverSource, /industryTemplate: context\.industryTemplate/);
});

test('shared Studio project schema and migration preserve tenant ownership and immutable revisions', () => {
  assert.match(schemaSource, /model MerchantStudioProject \{/);
  assert.match(schemaSource, /model MerchantStudioProjectVersion \{/);
  assert.match(schemaSource, /model MerchantStudioEntitlement \{/);
  assert.match(schemaSource, /@@unique\(\[merchantId, industryCode, studioCode, mode\]\)/);
  assert.match(schemaSource, /@@unique\(\[merchantId, industryTemplate, studioCode, clientRequestId\]/);
  assert.match(schemaSource, /@@unique\(\[projectId, revision\]\)/);
  assert.match(migrationSource, /REFERENCES "Merchant"\("id"\) ON DELETE CASCADE/);
  assert.match(migrationSource, /"payload" JSONB NOT NULL/);
  assert.match(migrationSource, /FROM "MerchantLeatherStudioProject"/);
  assert.match(migrationSource, /FROM "MerchantLeatherStudioProjectVersion"/);
  assert.match(entitlementMigrationSource, /CREATE TABLE "MerchantStudioEntitlement"/);
  assert.match(entitlementMigrationSource, /"capabilities" JSONB NOT NULL/);
  assert.match(entitlementMigrationSource, /ON DELETE CASCADE/);
  assert.match(projectScopeMigrationSource, /industryTemplate/);
});

test('legacy Leather project storage remains available for additive migration compatibility', () => {
  assert.match(schemaSource, /model MerchantLeatherStudioProject \{/);
  assert.match(schemaSource, /model MerchantLeatherStudioProjectVersion \{/);
  assert.match(schemaSource, /@@unique\(\[merchantId, clientRequestId\]\)/);
});
