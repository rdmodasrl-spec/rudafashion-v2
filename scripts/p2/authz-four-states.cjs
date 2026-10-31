#!/usr/bin/env node
/**
 * P2 授权四态验证：直接读取 HTTP 原始响应，验证服务端数据装配层的可见性过滤，
 * 而不是前端过滤。
 *
 * 前置：
 *   1. node scripts/p2/authz-seed.cjs（隔离库夹具）
 *   2. DATABASE_URL=<隔离库> PORT=4101 npx tsx server.ts
 *      （隔离实例的 .env 需把 JWT_BUYER_SECRET 设为 P2_AUTHZ_JWT_SECRET）
 *
 * 用法：P2_BASE=http://127.0.0.1:4101 P2_AUTHZ_JWT_SECRET=... node scripts/p2/authz-four-states.cjs
 */
const jwt = require('jsonwebtoken');

const BASE = process.env.P2_BASE || 'http://127.0.0.1:4101';
const SECRET = process.env.P2_AUTHZ_JWT_SECRET || 'p2-authz-dev-secret';
const MERCHANT = 'p2-authz-merchant';

const token = customerId => jwt.sign({ id: customerId, role: 'buyer', customerId, email: `${customerId}@p2.test` }, SECRET, { expiresIn: '1h' });

const STATES = [
  { key: 'S1 未登录访客', auth: null, expect: ['p2-authz-public'] },
  { key: 'S2 已登录未审核买家', auth: token('p2-authz-pending'), expect: ['p2-authz-public'] },
  { key: 'S3 已审核买家（无 Vault）', auth: token('p2-authz-approved2'), expect: ['p2-authz-public', 'p2-authz-wholesale'] },
  { key: 'S4 已审核 + Vault 授权', auth: token('p2-authz-approved'), expect: ['p2-authz-public', 'p2-authz-wholesale', 'p2-authz-private', 'p2-authz-exclusive'] }
];

const PROTECTED_FIELDS = ['costPrice', 'visibility', 'protectionLevel'];
const results = [];

async function post(path, auth, body) {
  const res = await fetch(BASE + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(auth ? { Authorization: `Bearer ${auth}` } : {}) },
    body: JSON.stringify(body)
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* 保留原文 */ }
  return { status: res.status, text, json };
}

async function get(path, auth) {
  const res = await fetch(BASE + path, { headers: auth ? { Authorization: `Bearer ${auth}` } : {} });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* 非 JSON 响应保留原文 */ }
  return { status: res.status, text, json };
}

(async () => {
  for (const state of STATES) {
    const list = await get(`/api/products?merchantId=${MERCHANT}`, state.auth);
    const ids = (list.json?.products || []).map(p => p.id).sort();
    const redacted = (list.json?.products || []).some(p => PROTECTED_FIELDS.some(f => Object.hasOwn(p, f)));
    const leakedPrivate = ids.filter(id => /private|exclusive/.test(id));

    const detailBlocked = [];
    for (const id of ['p2-authz-private', 'p2-authz-wholesale', 'p2-authz-exclusive']) {
      const detail = await get(`/api/products/${id}`, state.auth);
      const visibleToThisState = state.expect.includes(id);
      detailBlocked.push({
        id,
        status: detail.status,
        ok: visibleToThisState ? detail.status === 200 : detail.status === 404 || detail.status === 403
      });
    }

    // 询价读取：未登录 401；已登录（含未审核）200 —— 询价是销售通道，不构成受保护数据泄漏。
    const rfq = await get('/api/buyer/rfq', state.auth);
    const rfqOk = state.auth ? rfq.status === 200 : rfq.status === 401;

    // 防探测：用不可见商品发起询价必须被拒绝，且不能回显商品是否存在之外的信息
    const probe = await post('/api/buyer/rfq', state.auth, {
      title: 'authz probe', targetQuantity: 10, productIds: ['p2-authz-private']
    });
    const probeOk = !state.auth
      ? probe.status === 401
      : state.expect.includes('p2-authz-private')
        ? probe.status === 201
        : probe.status === 403 && probe.json?.error?.code === 'RFQ_PRODUCT_NOT_VISIBLE';

    const passed = JSON.stringify(ids) === JSON.stringify([...state.expect].sort())
      && !redacted
      && detailBlocked.every(item => item.ok)
      && rfqOk
      && probeOk
      && (state.expect.includes('p2-authz-private') ? true : leakedPrivate.length === 0);

    results.push({
      state: state.key,
      listStatus: list.status,
      ids,
      expected: [...state.expect].sort(),
      leakedProtectedFields: redacted,
      detail: detailBlocked,
      rfqStatus: rfq.status,
      probeStatus: probe.status,
      probeCode: probe.json?.error?.code || '',
      passed
    });
  }

  for (const r of results) {
    console.log(`\n=== ${r.state} ${r.passed ? 'PASS' : 'FAIL'}`);
    console.log('  GET /api/products ->', r.listStatus, JSON.stringify(r.ids));
    console.log('  expected          ->', JSON.stringify(r.expected));
    console.log('  暴露 costPrice/visibility/protectionLevel:', r.leakedProtectedFields);
    console.log('  详情:', r.detail.map(d => `${d.id}:${d.status}${d.ok ? '' : '(不符预期)'}`).join(' '));
    console.log('  GET /api/buyer/rfq ->', r.rfqStatus, '| POST 询价(受限商品) ->', r.probeStatus, r.probeCode);
  }
  const failed = results.filter(r => !r.passed);
  console.log(`\n汇总：${results.length - failed.length}/${results.length} 通过`);
  process.exit(failed.length ? 1 : 0);
})();
