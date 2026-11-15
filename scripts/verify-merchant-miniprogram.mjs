import { randomUUID } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { chromium } from 'playwright';

/**
 * 商家小程序 API 与正式行业注册的真实 HTTP/数据库校验（配合隔离 PostgreSQL 脚本）。
 * 只用公开接口 + 真实数据库，不使用 stub。
 */
const baseUrl = process.env.BASE_URL;
if (!baseUrl) throw new Error('BASE_URL is required');

const credentials = {
  ops: { email: process.env.E2E_MERCHANT_EMAIL, password: process.env.E2E_MERCHANT_PASSWORD },
  viewer: { email: process.env.E2E_VIEWER_EMAIL, password: process.env.E2E_MERCHANT_PASSWORD },
  other: { email: process.env.E2E_SECOND_MERCHANT_EMAIL, password: process.env.E2E_MERCHANT_PASSWORD }
};

let failures = 0;
const check = (name, condition, detail) => {
  if (condition) { console.log(`ok - ${name}`); return; }
  failures += 1;
  console.error(`not ok - ${name}${detail ? ` :: ${JSON.stringify(detail).slice(0, 500)}` : ''}`);
};

const request = async (path, { method = 'GET', token, body } = {}) => {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  let payload = null;
  try { payload = await response.json(); } catch { payload = null; }
  return { status: response.status, payload };
};

const industryOptions = await request('/api/merchant/industry-options');
const formalIndustries = Array.isArray(industryOptions.payload?.industries)
  ? industryOptions.payload.industries
  : [];
const formalIndustryIds = formalIndustries.map(industry => industry.id);
check(
  'formal industry options are publicly readable and registry-backed',
  industryOptions.status === 200
    && formalIndustryIds.includes('WHOLESALE_APPAREL')
    && formalIndustryIds.includes('WHOLESALE_COMPREHENSIVE')
    && formalIndustryIds.includes('RETAIL_RESTAURANT')
    && !formalIndustryIds.includes('RETAIL_BEAUTY_HAIR')
    && formalIndustries.every(industry =>
      typeof industry.label === 'string'
      && ['WHOLESALE', 'RETAIL'].includes(industry.businessModel)
      && Array.isArray(industry.capabilityIds)
      && Array.isArray(industry.categories)),
  industryOptions
);
const apparelIndustry = formalIndustries.find(industry => industry.id === 'WHOLESALE_APPAREL');
check(
  'apparel registration exposes optional own-production capability',
  apparelIndustry?.capabilityIds.includes('APPAREL_OWN_PRODUCTION') === true,
  apparelIndustry
);

const formalRegistrationCases = [
  { formalIndustryId: 'WHOLESALE_APPAREL', capabilityIds: [], role: 'WHOLESALER', category: 'WOMENSWEAR', template: 'apparel_wholesale' },
  { formalIndustryId: 'WHOLESALE_APPAREL', capabilityIds: ['APPAREL_OWN_PRODUCTION'], role: 'PRODUCER', category: 'WOMENSWEAR', template: 'apparel_production_wholesale' },
  { formalIndustryId: 'WHOLESALE_LEATHER_GOODS', capabilityIds: [], role: 'WHOLESALER', category: 'LEATHER_GOODS', template: 'bags_wholesale' },
  { formalIndustryId: 'WHOLESALE_LEATHER_GOODS', capabilityIds: ['LEATHER_OWN_PRODUCTION'], role: 'PRODUCER', category: 'LEATHER_GOODS', template: 'bags_wholesale' },
  { formalIndustryId: 'WHOLESALE_GENERAL_MERCHANDISE', capabilityIds: [], role: 'WHOLESALER', category: 'OTHER', template: 'department_wholesale' },
  { formalIndustryId: 'WHOLESALE_COMPREHENSIVE', capabilityIds: [], role: 'WHOLESALER', category: 'OTHER', template: 'department_wholesale' },
  { formalIndustryId: 'RETAIL_GENERAL_MERCHANDISE', capabilityIds: [], role: 'RETAILER', category: 'OTHER', template: 'department_chain_retail' },
  { formalIndustryId: 'RETAIL_ECOMMERCE', capabilityIds: [], role: 'RETAILER', category: 'OTHER', template: 'general_retail' },
  { formalIndustryId: 'RETAIL_RESTAURANT', capabilityIds: [], role: 'RESTAURANT_OPERATOR', category: 'RESTAURANT', template: 'restaurant_ordering' }
];
const registrationSecret = process.env.E2E_COMPANY_JWT_SECRET;
const testDatabaseUrl = process.env.E2E_TEST_DATABASE_URL;
const adminSecret = process.env.E2E_ADMIN_JWT_SECRET;
if (!registrationSecret || !testDatabaseUrl || !adminSecret) throw new Error('ISOLATED_REGISTRATION_TEST_CONFIGURATION_REQUIRED');
const prisma = new PrismaClient({ datasources: { db: { url: testDatabaseUrl } } });
try {
  let apparelMerchant = null;
  for (const registrationCase of formalRegistrationCases) {
    const email = `formal-${randomUUID()}@example.test`;
    const password = `Ruda-${randomUUID()}-Aa1!`;
    const businessName = `Test ${registrationCase.formalIndustryId.slice(-8)} ${randomUUID().slice(0, 6)}`;
    const verificationToken = jwt.sign(
      { destination: email, channel: 'email', purpose: 'company_registration' },
      registrationSecret,
      { expiresIn: '5m' }
    );
    const result = await request('/api/auth/register/company', {
      method: 'POST',
      body: {
        email,
        password,
        displayName: businessName,
        legalName: `${businessName} Ltd`,
        country: 'Italy',
        city: 'Prato',
        acceptedTerms: true,
        acceptedPrivacy: true,
        roles: [registrationCase.role],
        categories: [registrationCase.category],
        formalIndustryId: registrationCase.formalIndustryId,
        capabilityIds: registrationCase.capabilityIds,
        verificationToken
      }
    });
    check(
      `formal registration provisions ${registrationCase.formalIndustryId}${registrationCase.capabilityIds.length ? ' with capability' : ''}`,
      result.status === 201
        && result.payload?.formalIndustryId === registrationCase.formalIndustryId
        && result.payload?.merchantLoginAvailable === true,
      result
    );
    if (result.status !== 201 || typeof result.payload?.merchantId !== 'string') continue;
    if (registrationCase.formalIndustryId === 'WHOLESALE_APPAREL' && registrationCase.capabilityIds.length === 0) {
      apparelMerchant = { id: result.payload.merchantId, email, password, name: businessName };
    }

    const merchant = await prisma.merchant.findUnique({
      where: { id: result.payload.merchantId },
      select: {
        formalIndustryId: true,
        industryTemplate: true,
        studioEntitlements: {
          select: { formalIndustryId: true, industryTemplate: true, status: true, capabilities: true }
        }
      }
    });
    const entitlement = merchant?.studioEntitlements[0];
    check(
      `formal registration persists merchant and entitlement for ${registrationCase.formalIndustryId}`,
      merchant?.formalIndustryId === registrationCase.formalIndustryId
        && merchant.industryTemplate === registrationCase.template
        && entitlement?.formalIndustryId === registrationCase.formalIndustryId
        && entitlement.industryTemplate === registrationCase.template
        && entitlement.status === 'active'
        && registrationCase.capabilityIds.every(capability => entitlement.capabilities?.[capability] === true),
      { merchant, registrationCase }
    );
  }

  const rejectedEmail = `formal-invalid-${randomUUID()}@example.test`;
  const rejected = await request('/api/auth/register/company', {
    method: 'POST',
    body: {
      email: rejectedEmail,
      password: `Ruda-${randomUUID()}-Aa1!`,
      displayName: 'Invalid capability test',
      legalName: 'Invalid capability test Ltd',
      country: 'Italy',
      city: 'Prato',
      acceptedTerms: true,
      acceptedPrivacy: true,
      roles: ['WHOLESALER'],
      categories: ['OTHER'],
      formalIndustryId: 'WHOLESALE_COMPREHENSIVE',
      capabilityIds: ['APPAREL_OWN_PRODUCTION'],
      verificationToken: jwt.sign(
        { destination: rejectedEmail, channel: 'email', purpose: 'company_registration' },
        registrationSecret,
        { expiresIn: '5m' }
      )
    }
  });
  const rejectedAccount = await prisma.authAccount.findFirst({ where: { email: rejectedEmail, role: 'company' } });
  check(
    'invalid industry capability is rejected without partial registration writes',
    rejected.status === 400
      && rejected.payload?.error === 'INVALID_INDUSTRY_CAPABILITY'
      && rejectedAccount === null,
    rejected
  );

  if (!apparelMerchant) throw new Error('APPAREL_MERCHANT_FIXTURE_UNAVAILABLE');
  const adminToken = jwt.sign({
    id: 'studio-entitlement-admin',
    username: 'studio-entitlement-admin',
    role: 'admin',
    permissions: ['merchants.review', 'finance.payouts', 'settings.health']
  }, adminSecret, { expiresIn: '10m' });
  const restrictedAdminToken = jwt.sign({
    id: 'studio-entitlement-restricted-admin',
    username: 'studio-entitlement-restricted-admin',
    role: 'admin',
    permissions: []
  }, adminSecret, { expiresIn: '10m' });

  await prisma.merchantStudioEntitlement.deleteMany({ where: { merchantId: apparelMerchant.id } });
  const grantPath = `/api/admin/merchant-center/merchants/${encodeURIComponent(apparelMerchant.id)}/studio-entitlements/WHOLESALE_LEATHER_GOODS`;
  const unauthorizedGrant = await request(grantPath, {
    method: 'PUT',
    token: restrictedAdminToken,
    body: { capabilityIds: [] }
  });
  check('industry authorization requires merchants.review', unauthorizedGrant.status === 403, unauthorizedGrant);

  const grant = await request(grantPath, {
    method: 'PUT',
    token: adminToken,
    body: { capabilityIds: [] }
  });
  const entitlementsAfterGrant = await prisma.merchantStudioEntitlement.findMany({
    where: { merchantId: apparelMerchant.id },
    orderBy: { formalIndustryId: 'asc' }
  });
  check(
    'grant backfills legacy primary access and adds only the requested industry',
    grant.status === 200
      && grant.payload?.changed === true
      && entitlementsAfterGrant.length === 2
      && entitlementsAfterGrant.some(entitlement => entitlement.formalIndustryId === 'WHOLESALE_APPAREL' && entitlement.status === 'active')
      && entitlementsAfterGrant.some(entitlement => entitlement.formalIndustryId === 'WHOLESALE_LEATHER_GOODS' && entitlement.status === 'active'),
    { grant, entitlementsAfterGrant }
  );
  const duplicateGrant = await request(grantPath, {
    method: 'PUT',
    token: adminToken,
    body: { capabilityIds: [] }
  });
  check(
    'repeated grant is idempotent',
    duplicateGrant.status === 200
      && duplicateGrant.payload?.changed === false
      && await prisma.merchantStudioEntitlement.count({ where: { merchantId: apparelMerchant.id } }) === 2,
    duplicateGrant
  );
  const invalidCapability = await request(
    `/api/admin/merchant-center/merchants/${encodeURIComponent(apparelMerchant.id)}/studio-entitlements/WHOLESALE_COMPREHENSIVE`,
    { method: 'PUT', token: adminToken, body: { capabilityIds: ['APPAREL_OWN_PRODUCTION'] } }
  );
  check(
    'grant rejects a capability outside the formal industry and writes nothing',
    invalidCapability.status === 400
      && invalidCapability.payload?.error === 'INVALID_INDUSTRY_CAPABILITY'
      && await prisma.merchantStudioEntitlement.count({
        where: { merchantId: apparelMerchant.id, formalIndustryId: 'WHOLESALE_COMPREHENSIVE' }
      }) === 0,
    invalidCapability
  );
  const apparelCapabilityGrant = await request(
    `/api/admin/merchant-center/merchants/${encodeURIComponent(apparelMerchant.id)}/studio-entitlements/WHOLESALE_APPAREL`,
    { method: 'PUT', token: adminToken, body: { capabilityIds: ['APPAREL_OWN_PRODUCTION'] } }
  );
  const entitlementsAfterCapabilityGrant = await prisma.merchantStudioEntitlement.findMany({
    where: { merchantId: apparelMerchant.id }
  });
  check(
    'capability update affects only its industry and preserves other active grants',
    apparelCapabilityGrant.status === 200
      && apparelCapabilityGrant.payload?.changed === true
      && entitlementsAfterCapabilityGrant.some(entitlement =>
        entitlement.formalIndustryId === 'WHOLESALE_APPAREL'
        && entitlement.capabilities?.APPAREL_OWN_PRODUCTION === true
        && entitlement.capabilities?.apparelPatternEngineering === true
      )
      && entitlementsAfterCapabilityGrant.some(entitlement =>
        entitlement.formalIndustryId === 'WHOLESALE_LEATHER_GOODS' && entitlement.status === 'active'
      ),
    { apparelCapabilityGrant, entitlementsAfterCapabilityGrant }
  );

  const merchantLogin = await request('/api/miniprogram/auth/login/merchant', {
    method: 'POST',
    body: { email: apparelMerchant.email, password: apparelMerchant.password }
  });
  const merchantToken = merchantLogin.payload?.token;
  check('registered merchant can authenticate for entitlement checks', merchantLogin.status === 200 && typeof merchantToken === 'string', merchantLogin);
  if (typeof merchantToken === 'string') {
    const accessibleStudios = await request('/api/merchant/studios', { token: merchantToken });
    check(
      'granted secondary Studio appears in merchant access list',
      accessibleStudios.status === 200
        && accessibleStudios.payload?.studios?.some(studio => studio.formalIndustryId === 'WHOLESALE_LEATHER_GOODS'),
      accessibleStudios
    );
  }

  const revokePath = grantPath;
  const revoke = await request(revokePath, { method: 'DELETE', token: adminToken });
  const entitlementsAfterRevoke = await prisma.merchantStudioEntitlement.findMany({
    where: { merchantId: apparelMerchant.id },
    orderBy: { formalIndustryId: 'asc' }
  });
  check(
    'revoke only deactivates the selected industry and preserves other entitlements',
    revoke.status === 200
      && revoke.payload?.changed === true
      && entitlementsAfterRevoke.length === 2
      && entitlementsAfterRevoke.some(entitlement => entitlement.formalIndustryId === 'WHOLESALE_LEATHER_GOODS' && entitlement.status === 'revoked' && entitlement.revokedAt !== null)
      && entitlementsAfterRevoke.some(entitlement => entitlement.formalIndustryId === 'WHOLESALE_APPAREL' && entitlement.status === 'active'),
    { revoke, entitlementsAfterRevoke }
  );
  const repeatedRevoke = await request(revokePath, { method: 'DELETE', token: adminToken });
  check('repeated revoke is idempotent', repeatedRevoke.status === 200 && repeatedRevoke.payload?.changed === false, repeatedRevoke);
  if (typeof merchantToken === 'string') {
    const remainingStudios = await request('/api/merchant/studios', { token: merchantToken });
    const revokedProjectList = await request('/api/merchant/studio-projects?industryTemplate=bags_wholesale', { token: merchantToken });
    check(
      'revoked Studio is hidden and its project API denies access',
      remainingStudios.status === 200
        && !remainingStudios.payload?.studios?.some(studio => studio.formalIndustryId === 'WHOLESALE_LEATHER_GOODS')
        && revokedProjectList.status === 403,
      { remainingStudios, revokedProjectList }
    );
  }

  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const browserErrors = [];
    const adminApiStatuses = [];
    page.on('pageerror', error => browserErrors.push(`pageerror: ${error.message}`));
    page.on('console', message => {
      if (message.type() === 'error') browserErrors.push(`console: ${message.text().slice(0, 180)}`);
    });
    page.on('response', response => {
      const url = new URL(response.url());
      if (url.pathname.startsWith('/api/')) adminApiStatuses.push(`${response.status()} ${url.pathname}`);
    });
    await page.context().addCookies([{
      name: 'ruda_admin_jwt',
      value: adminToken,
      url: baseUrl,
      httpOnly: true,
      sameSite: 'Lax'
    }]);
    await page.route('**/*', route => {
      const hostname = new URL(route.request().url()).hostname;
      if (!['localhost', '127.0.0.1', '::1'].includes(hostname)) return route.abort();
      return route.continue();
    });
    await page.goto(`${baseUrl}/admin?adminTab=merchants`, { waitUntil: 'networkidle', timeout: 90000 });
    const merchantButton = page.getByRole('button', { name: apparelMerchant.name, exact: true });
    if (await merchantButton.count() !== 1) throw new Error('PLATFORM_ADMIN_MERCHANT_ROW_NOT_RENDERED');
    await merchantButton.click();
    await page.waitForTimeout(1200);
    if (await page.locator('section[aria-label="行业工作室授权"]').count() !== 1) {
      console.error(JSON.stringify({
        adminHeadings: await page.locator('h1,h2,h3').allTextContents(),
        adminApiStatuses,
        browserErrors,
        pageText: (await page.locator('body').innerText()).slice(0, 1200)
      }));
      await page.screenshot({ path: '/tmp/ruda-platform-admin-studios-debug.png', fullPage: true });
      throw new Error('PLATFORM_ADMIN_ENTITLEMENT_SECTION_NOT_RENDERED');
    }
    await page.getByLabel('授予或更新行业').selectOption('WHOLESALE_LEATHER_GOODS');
    const grantButtonVisible = await page.getByRole('button', { name: '授予授权', exact: true }).isVisible();
    await page.screenshot({ path: '/tmp/ruda-platform-admin-studios-1440.png', fullPage: true });
    const overflow1440 = await page.evaluate(() =>
      document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
    );
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(250);
    const overflow390 = await page.evaluate(() =>
      document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
    );
    await page.screenshot({ path: '/tmp/ruda-platform-admin-studios-390.png', fullPage: true });
    check(
      'platform admin entitlement controls render responsively at desktop and mobile widths',
      grantButtonVisible && !overflow1440 && !overflow390 && browserErrors.length === 0,
      { overflow1440, overflow390, browserErrors }
    );
  } finally {
    await browser.close();
  }
} finally {
  await prisma.$disconnect();
}

const login = async (who) => {
  const result = await request('/api/miniprogram/auth/login/employee', {
    method: 'POST',
    body: credentials[who]
  });
  if (result.status !== 200 || typeof result.payload?.token !== 'string') {
    throw new Error(`login failed for ${who}: ${JSON.stringify(result).slice(0, 300)}`);
  }
  return result.payload.token;
};

const ops = await login('ops');
const viewer = await login('viewer');
const other = await login('other');

// 1) 未认证
check('counterparties require authentication', (await request('/api/merchant/counterparties')).status === 401);

// 2) 权限不足
const viewerList = await request('/api/merchant/counterparties', { token: viewer });
check('counterparties require employee permission', viewerList.status === 403, viewerList);

// 3) 列表（租户 A 只看到自己的）
const listA = await request('/api/merchant/counterparties', { token: ops });
const namesA = (listA.payload?.counterparties || []).map(item => item.companyName);
check('counterparty list returns own tenant rows', listA.status === 200 && namesA.includes('MM Counterparty A') && !namesA.includes('MM Counterparty B'), listA.payload);

// 4-6) 新建 / 重名 / 跨租户
const created = await request('/api/merchant/counterparties', { method: 'POST', token: ops, body: { companyName: 'MM New CP', contactName: 'Nina', country: 'Italy' } });
check('counterparty create succeeds', created.status === 201 && created.payload?.counterparty?.companyName === 'MM New CP', created);
const duplicate = await request('/api/merchant/counterparties', { method: 'POST', token: ops, body: { companyName: 'mm new cp' } });
check('duplicate counterparty name returns 409', duplicate.status === 409 && duplicate.payload?.error === 'COUNTERPARTY_NAME_ALREADY_EXISTS', duplicate);
const crossTenantCp = await request('/api/merchant/counterparties/e2e_mm_cp_b', { method: 'PATCH', token: ops, body: { companyName: 'Hijacked' } });
check('cross-tenant counterparty update returns 404', crossTenantCp.status === 404, crossTenantCp);
const patchedCp = await request(`/api/merchant/counterparties/${created.payload.counterparty.id}`, { method: 'PATCH', token: ops, body: { companyName: 'MM New CP', phone: '+39123' } });
check('counterparty update persists', patchedCp.status === 200 && patchedCp.payload?.counterparty?.phone === '+39123', patchedCp);

// 7-9) 供应商编辑
const supplierPatch = await request('/api/merchant/suppliers/e2e_mm_supplier_a', { method: 'PATCH', token: ops, body: { contactName: 'Bob', leadTimeDays: 12 } });
check('supplier patch persists whitelisted fields', supplierPatch.status === 200 && supplierPatch.payload?.supplier?.contactName === 'Bob' && supplierPatch.payload?.supplier?.leadTimeDays === 12, supplierPatch);
const supplierCross = await request('/api/merchant/suppliers/e2e_mm_supplier_b', { method: 'PATCH', token: ops, body: { contactName: 'X' } });
check('cross-tenant supplier patch returns 404', supplierCross.status === 404, supplierCross);
const supplierConflict = await request('/api/merchant/suppliers/e2e_mm_supplier_a', { method: 'PATCH', token: ops, body: { name: 'MM Supplier A2' } });
check('duplicate supplier name returns 409', supplierConflict.status === 409 && supplierConflict.payload?.error === 'SUPPLIER_NAME_ALREADY_EXISTS', supplierConflict);
const supplierEmpty = await request('/api/merchant/suppliers/e2e_mm_supplier_a', { method: 'PATCH', token: ops, body: {} });
check('empty supplier patch is rejected', supplierEmpty.status === 400 && supplierEmpty.payload?.error === 'SUPPLIER_PATCH_EMPTY', supplierEmpty);

// 10-12) 客户停用（租户内关系状态，不动平台 KYC）
const suspend = await request('/api/merchant/customers/e2e_mm_customer_a/status', { method: 'PATCH', token: ops, body: { status: 'suspended' } });
check('customer suspend succeeds', suspend.status === 200 && suspend.payload?.status === 'suspended', suspend);
const suspendAgain = await request('/api/merchant/customers/e2e_mm_customer_a/status', { method: 'PATCH', token: ops, body: { status: 'suspended' } });
check('customer suspend is idempotent', suspendAgain.status === 200, suspendAgain);
const reactivate = await request('/api/merchant/customers/e2e_mm_customer_a/status', { method: 'PATCH', token: ops, body: { status: 'active' } });
check('customer reactivate succeeds', reactivate.status === 200 && reactivate.payload?.status === 'active', reactivate);
const invalidStatus = await request('/api/merchant/customers/e2e_mm_customer_a/status', { method: 'PATCH', token: ops, body: { status: 'approved' } });
check('invalid customer status returns 400', invalidStatus.status === 400 && invalidStatus.payload?.error === 'CUSTOMER_STATUS_INVALID', invalidStatus);
const crossCustomer = await request('/api/merchant/customers/e2e_mm_customer_b/status', { method: 'PATCH', token: ops, body: { status: 'suspended' } });
check('cross-tenant customer status returns 404', crossCustomer.status === 404, crossCustomer);
const viewerSuspend = await request('/api/merchant/customers/e2e_mm_customer_a/status', { method: 'PATCH', token: viewer, body: { status: 'suspended' } });
check('customer status requires permission', viewerSuspend.status === 403, viewerSuspend);
const otherTenantStatus = await request('/api/merchant/customers/e2e_mm_customer_b/status', { method: 'PATCH', token: other, body: { status: 'suspended' } });
check('other tenant can only change its own customer', otherTenantStatus.status === 200, otherTenantStatus);

// 13) 通知已处理
const notices = await request('/api/merchant/notifications', { token: ops });
const openNotice = (notices.payload?.notifications || []).find(item => item.id === 'e2e_mm_notice_open');
check('notifications expose businessStatus', notices.status === 200 && openNotice?.businessStatus === 'open', notices.payload);
const resolve = await request('/api/merchant/notifications/e2e_mm_notice_open/resolve', { method: 'POST', token: ops, body: {} });
check('notification resolve succeeds', resolve.status === 200 && resolve.payload?.businessStatus === 'resolved', resolve);
const resolveAgain = await request('/api/merchant/notifications/e2e_mm_notice_open/resolve', { method: 'POST', token: ops, body: {} });
check('notification resolve is idempotent', resolveAgain.status === 200, resolveAgain);
const afterResolve = await request('/api/merchant/notifications', { token: ops });
const resolvedNotice = (afterResolve.payload?.notifications || []).find(item => item.id === 'e2e_mm_notice_open');
check('notification resolve is persisted', resolvedNotice?.businessStatus === 'resolved', afterResolve.payload);
const missingNotice = await request('/api/merchant/notifications/does-not-exist/resolve', { method: 'POST', token: ops, body: {} });
check('unknown notification returns 404', missingNotice.status === 404, missingNotice);
check('notification resolve requires authentication', (await request('/api/merchant/notifications/e2e_mm_notice_open/resolve', { method: 'POST', body: {} })).status === 401);

// 14) 增长推荐（真实数据 + 明确未开放）
const referrals = await request('/api/merchant/growth/referrals', { token: ops });
const referralCodes = (referrals.payload?.referrals || []).map(item => item.code);
check('growth referrals return real rows', referrals.status === 200 && referralCodes.includes('MM-REF-1'), referrals.payload);
check('growth referrals declare the program as not launched', referrals.payload?.referralProgram?.enabled === false, referrals.payload?.referralProgram);
const otherReferrals = await request('/api/merchant/growth/referrals', { token: other });
check('growth referrals are tenant scoped', (otherReferrals.payload?.referrals || []).length === 0, otherReferrals.payload);

// 15) 门店访问码：接口确实不存在（能力未立项），客户端已改为明确提示
check('store access redeem endpoint is intentionally absent', (await request('/api/vault/store-access/redeem', { method: 'POST', body: {} })).status === 404);

if (failures > 0) {
  console.error(`\n${failures} merchant mini program check(s) failed.`);
  process.exit(1);
}
console.log('\nall merchant miniprogram checks passed');
