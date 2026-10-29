import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {
  canTransitionMerchantOnboardingStatus,
  normalizeMerchantOnboardingStatus,
  resolveMerchantOnboardingReviewStatus
} from '../src/server/merchantOnboarding';
import { merchantIndustryTemplates, openMerchantIndustryTemplates } from '../src/constants/merchantIndustryTemplates';

const root = process.cwd();
const serverSource = readFileSync(path.join(root, 'server.ts'), 'utf8');
const schemaSource = readFileSync(path.join(root, 'prisma', 'schema.prisma'), 'utf8');
const migrationSource = readFileSync(
  path.join(root, 'prisma', 'migrations', '20261028234000_merchant_onboarding_identity', 'migration.sql'),
  'utf8'
);
const moduleSpec = readFileSync(path.join(root, 'docs', 'engineering', 'modules', 'identity-merchant-onboarding.md'), 'utf8');

function routeSegment(startNeedle: string, endNeedle: string): string {
  const start = serverSource.indexOf(startNeedle);
  const end = serverSource.indexOf(endNeedle, start + startNeedle.length);
  assert.ok(start >= 0, `${startNeedle} exists`);
  assert.ok(end > start, `${endNeedle} exists after ${startNeedle}`);
  return serverSource.slice(start, end);
}

test('all seven merchant industry templates are open and map to unique workspaces', () => {
  assert.equal(openMerchantIndustryTemplates.length, 7);
  assert.equal(new Set(merchantIndustryTemplates.map(template => template.id)).size, 7);
  assert.equal(new Set(merchantIndustryTemplates.map(template => template.workspaceTemplateId)).size, 7);
  assert.equal(openMerchantIndustryTemplates[0].id, 'apparel_production_wholesale');
  assert.equal(openMerchantIndustryTemplates[0].workspaceTemplateId, 'merchant_admin_apparel_production_wholesale');
});

test('merchant onboarding status machine keeps applicant state separate from merchant access', () => {
  assert.equal(normalizeMerchantOnboardingStatus('submitted'), 'pending_review');
  assert.equal(normalizeMerchantOnboardingStatus('reviewing'), 'pending_review');
  assert.equal(canTransitionMerchantOnboardingStatus('pending_review', 'approved'), true);
  assert.equal(canTransitionMerchantOnboardingStatus('pending_review', 'additional_info_needed'), true);
  assert.equal(canTransitionMerchantOnboardingStatus('approved', 'pending_review'), false);
  assert.equal(canTransitionMerchantOnboardingStatus('closed', 'approved'), false);
  assert.equal(resolveMerchantOnboardingReviewStatus('draft'), null);
});

test('onboarding application schema stores account link and industry template before merchant creation', () => {
  for (const field of [
    'accountIdentityId',
    'companyId',
    'industryTemplate',
    'industryTemplateSource',
    'registrationProfile',
    'submittedByAuthAccountId'
  ]) {
    assert.match(schemaSource, new RegExp(`\\b${field}\\b`), `${field} is in schema`);
    assert.match(migrationSource, new RegExp(`"${field}"`), `${field} is in migration`);
  }
  assert.match(schemaSource, /status\s+String\s+@default\("pending_review"\)/);
  assert.match(migrationSource, /ALTER COLUMN "status" SET DEFAULT 'pending_review'/);
});

test('public merchant onboarding submission creates an application instead of merchant session', () => {
  const segment = routeSegment(
    "app.post('/api/onboarding/merchant/submit'",
    "app.get('/api/admin/merchant-onboarding/applications'"
  );
  assert.match(segment, /prisma\.merchantOnboardingApplication\.create/);
  assert.match(segment, /status:\s*'pending_review'/);
  assert.match(segment, /industryTemplate:\s*templateResolution\.template\.id/);
  assert.match(segment, /merchantLoginAvailable:\s*false/);
  assert.doesNotMatch(segment, /setAuthCookie\(res,\s*'ruda_merchant_jwt'/);
});

test('merchant register endpoints provision the selected industry workspace immediately', () => {
  const full = routeSegment(
    "app.post('/api/auth/register/merchant',",
    '// Merchant registration is immediate; public marketplace access stays verification-gated.'
  );
  const quickStart = serverSource.indexOf("app.post('/api/auth/register/merchant/quick'");
  assert.ok(quickStart >= 0, 'quick register route exists');
  const nextRoute = serverSource.indexOf('\n  app.', quickStart + 10);
  const quick = serverSource.slice(quickStart, nextRoute > quickStart ? nextRoute : quickStart + 16000);
  for (const segment of [full, quick]) {
    assert.match(segment, /resolveMerchantRegistrationTemplate/);
    assert.match(segment, /industryTemplate:\s*industryTemplate\.id/);
    assert.match(segment, /industryTemplateInitializedAt/);
    assert.doesNotMatch(segment, /merchantOnboardingApplication\.create/);
    assert.doesNotMatch(segment, /merchantLoginAvailable:\s*false/);
  }
  assert.match(full, /setAuthCookie\(res,\s*'ruda_merchant_jwt'/);
  assert.match(full, /provisionModaGptIndustryTeam/);
  assert.match(quick, /setAuthCookie\(res,\s*'ruda_merchant_jwt'/);
});

test('admin onboarding review is protected and provisions the apparel merchant workspace', () => {
  const listRoute = routeSegment(
    "app.get('/api/admin/merchant-onboarding/applications'",
    "app.put('/api/admin/merchant-onboarding/applications/:id/review'"
  );
  const reviewRoute = routeSegment(
    "app.put('/api/admin/merchant-onboarding/applications/:id/review'",
    '// Dedicated employee login for a.ruda.fashion.'
  );
  assert.match(listRoute, /requireAdminAuth,\s*requireAdminPermission\('merchants\.review'\)/);
  assert.match(reviewRoute, /requireAdminAuth,\s*requireAdminPermission\('merchants\.review'\)/);
  assert.match(reviewRoute, /approvedMerchantId:\s*merchant\.id/);
  assert.match(reviewRoute, /tx\.authAccount\.create/);
  assert.match(reviewRoute, /tx\.warehouseLocation\.create/);
  assert.match(reviewRoute, /provisionModaGptIndustryTeam/);
});

test('module spec records customer, merchant, employee and admin boundary', () => {
  assert.match(moduleSpec, /普通注册只获得前台\/采购身份/);
  assert.match(moduleSpec, /先提交 `MerchantOnboardingApplication`/);
  assert.match(moduleSpec, /apparel_production_wholesale/);
  assert.match(moduleSpec, /不能通过公开注册获得/);
});
