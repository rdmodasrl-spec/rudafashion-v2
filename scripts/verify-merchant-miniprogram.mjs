/**
 * 商家小程序 7 条断链的真实 HTTP 校验（配合 scripts/test-merchant-miniprogram-isolated.sh）。
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
