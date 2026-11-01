/**
 * 第四轮：审核凭证可信化 —— 真实 HTTP 攻击测试（隔离库 + 隔离实例 4105）。
 *
 * 前置条件（缺一不可）：
 *   1. 隔离库 ruda_p2_3d 已 migrate deploy，并跑过 scripts/p2/3d-upload-fixture.mjs
 *      （夹具提供 demo 商家、productEditingEnabled=true、qa-reviewer(products.review)、qa-no-perm）。
 *   2. 隔离实例已启动且 JWT_ADMIN_SECRET=p2-3d-admin-secret：
 *      PORT=4105 NODE_ENV=test DISABLE_HMR=true npx tsx server.ts
 *   3. 从仓库根目录执行，DATABASE_URL 指向隔离库：
 *      DATABASE_URL=$(cat /tmp/db3d.txt) node scripts/p2/3d-credential-attacks.mjs
 *
 * 只读写隔离库，不接触生产。10 条用例覆盖「缺凭证 / 凭证不全 / 冒充 ID / 伪造提交 /
 * 正式批准 / 保留凭证 / 替换失效 / 事务一致 / 旧数据降级」。
 */
import { readFileSync } from 'node:fs';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';

const BASE = process.env.P2_BASE || 'http://127.0.0.1:4105';
const GLB = readFileSync('public/models/ruda-sample-handbag.glb');
const ADMIN_SECRET = 'p2-3d-admin-secret';
const IMG = 'https://modaui.com/demo-products/category-bags.jpg';
const prisma = new PrismaClient();

let pass = 0, fail = 0;
const results = [];
function check(name, ok, detail) {
  results.push({ name, ok, detail });
  if (ok) pass += 1; else fail += 1;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
}
const cookieFrom = r => (r.headers.getSetCookie?.() || []).map(c => c.split(';')[0]).join('; ');
async function api(path, { method='GET', cookie, token, body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (cookie) headers.Cookie = cookie;
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(BASE + path, { method, headers, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const text = await res.text();
  let json = null; try { json = JSON.parse(text); } catch {}
  return { status: res.status, json, text, cookie: cookieFrom(res) };
}

const login = await api('/api/auth/demo/merchant/login', { method:'POST', body:{ industryTemplateId:'bags_wholesale' }});
if (login.status !== 200) { console.error('login failed', login.status, login.text.slice(0,150)); process.exit(1); }
const merchantCookie = login.cookie;

const reviewerAccount = await prisma.authAccount.findFirst({ where: { role:'admin', username:'qa-reviewer' }, select:{ id:true } });
const RUN = Date.now().toString(36).toUpperCase();
const payload = (suffix, media) => ({
  styleNo:`QA-CRD-${RUN}-${suffix}`, name:`凭证测试 ${RUN}-${suffix}`, category:'bags', subCategory:'tote',
  brand:'RUDA QA', season:'SS26', origin:'Italia', fabric:'calf leather', composition:'100% calf leather',
  wholesalePrice:50, rrpPrice:90, moq:1, packSize:1, lifecycleStatus:'published',
  description:'凭证测试', industryAttributes:{ material:'头层牛皮' },
  skus:[{ sku:`QA-CRD-${RUN}-${suffix}`, color:'Black', size:'One', stockCentral:10 }], media
});
const imageMedia = { id:'img-1', type:'image', url:IMG, role:'main', source:'merchant-upload' };

async function uploadModel(tag) {
  const pre = await api('/api/merchant/media/presign', { method:'POST', cookie:merchantCookie, body:{ contentType:'model/gltf-binary', fileSize: GLB.length }});
  if (pre.status !== 200) throw new Error('presign ' + pre.status);
  const put = await fetch(pre.json.uploadUrl, { method:'PUT', headers:{'Content-Type':'model/gltf-binary'}, body: GLB });
  if (!put.ok) throw new Error('put ' + put.status);
  return { id:`model-${tag}`, type:'model', url:pre.json.publicUrl, storageKey:pre.json.key,
    contentType:'model/gltf-binary', sizeBytes:GLB.length, role:'main', source:'merchant-upload', alt:`${tag}.glb` };
}
const reviewerToken = jwt.sign({ username:'qa-reviewer', role:'admin', permissions:['products.review'] }, ADMIN_SECRET, { expiresIn:'1h' });
const setDbMedia = async (productId, mutate) => {
  const row = await prisma.product.findUnique({ where:{ id: productId }, select:{ media:true } });
  const media = JSON.parse(row.media || '[]');
  await prisma.product.update({ where:{ id: productId }, data:{ media: JSON.stringify(mutate(media)) } });
};
const publicDetail = async id => {
  const r = await api(`/api/products/${id}`);
  return r.json?.product || r.json;
};
const hasModel = doc => (doc?.media || []).some(m => m.type === 'model');
const hasGlb = doc => JSON.stringify(doc || {}).includes('.glb');

// ── 1) 旧数据：approved 但无 modelReview → 买家不可见 ──
const m1 = await uploadModel('legacy');
const p1 = await api('/api/merchant/products', { method:'POST', cookie:merchantCookie, body: payload('01', [imageMedia, m1]) });
const id1 = p1.json.product.id;
await setDbMedia(id1, media => media.map(m => m.type === 'model' ? { id:m.id, type:'model', url:m.url, storageKey:m.storageKey, contentType:m.contentType, sizeBytes:m.sizeBytes, role:'main', source:'merchant-upload', reviewStatus:'approved' } : m));
const d1 = await publicDetail(id1);
check('1 DB approved 但无 modelReview → 买家不可见', !hasModel(d1) && !hasGlb(d1), `mediaTypes=${(d1?.media||[]).map(m=>m.type).join(',')}`);

// ── 2) modelReview 缺 reviewerId → 不可见 ──
await setDbMedia(id1, media => media.map(m => m.type === 'model' ? { ...m, reviewStatus:'approved', modelReview:{ reviewerUsername:'qa-reviewer', reviewedAt:new Date().toISOString(), decision:'approved' } } : m));
const d2 = await publicDetail(id1);
check('2 modelReview 缺 reviewerId → 买家不可见', !hasModel(d2) && !hasGlb(d2), `mediaTypes=${(d2?.media||[]).map(m=>m.type).join(',')}`);

// ── 3) decision 不是 approved → 不可见 ──
await setDbMedia(id1, media => media.map(m => m.type === 'model' ? { ...m, reviewStatus:'approved', modelReview:{ reviewerId:reviewerAccount.id, reviewedAt:new Date().toISOString(), decision:'rejected', reason:'x' } } : m));
const d3 = await publicDetail(id1);
check('3 modelReview.decision=rejected → 买家不可见', !hasModel(d3) && !hasGlb(d3), `mediaTypes=${(d3?.media||[]).map(m=>m.type).join(',')}`);

// ── 4) 用 username 冒充 reviewerId → 不可见 ──
await setDbMedia(id1, media => media.map(m => m.type === 'model' ? { ...m, reviewStatus:'approved', modelReview:{ reviewerId:'qa-reviewer', reviewedAt:new Date().toISOString(), decision:'approved' } } : m));
const d4 = await publicDetail(id1);
check('4 reviewerId 用用户名冒充 → 买家不可见', !hasModel(d4) && !hasGlb(d4), `mediaTypes=${(d4?.media||[]).map(m=>m.type).join(',')}`);

// ── 5) 商家提交 modelReview 对象，不能写入凭证 ──
const m5 = await uploadModel('merchant-cred');
const forgedCredential = { reviewerId: reviewerAccount.id, reviewerUsername:'qa-reviewer', reviewedAt:'2026-10-31T00:00:00.000Z', decision:'approved' };
const p5 = await api('/api/merchant/products', { method:'POST', cookie:merchantCookie, body: payload('05', [imageMedia, { ...m5, reviewStatus:'approved', modelReview: forgedCredential }]) });
const savedModel5 = (p5.json.product.media || []).find(m => m.type === 'model');
check('5 商家提交 modelReview 不能写入凭证', p5.status === 201 && savedModel5?.reviewStatus === 'pending' && !savedModel5?.modelReview,
  `status=${p5.status} reviewStatus=${savedModel5?.reviewStatus} modelReview=${JSON.stringify(savedModel5?.modelReview)}`);
const id5 = p5.json.product.id;

// ── 6) 管理员正式批准 → 凭证完整 → 买家可见 ──
const approve = await api(`/api/admin/products/${id5}/media/${m5.id}/model-review`, { method:'PUT', token: reviewerToken, body:{ decision:'approved', reason:'凭证测试通过' } });
const d6 = await publicDetail(id5);
const model6 = (d6?.media || []).find(m => m.type === 'model');
const afterRow = await prisma.product.findUnique({ where:{ id: id5 }, select:{ media:true } });
const storedCred = JSON.parse(afterRow.media).find(m => m.type === 'model')?.modelReview;
check('6 管理员批准后凭证完整且买家可见',
  approve.status === 200 && model6?.reviewStatus === 'approved'
    && storedCred?.reviewerId === reviewerAccount.id
    && storedCred?.reviewerUsername === 'qa-reviewer'
    && Boolean(storedCred?.reviewedAt)
    && storedCred?.decision === 'approved'
    && storedCred?.reason === '凭证测试通过',
  `status=${approve.status} reviewerId=${storedCred?.reviewerId} decision=${storedCred?.decision}`);

// ── 7) 已审核模型只改商品名称 → 凭证保留 ──
const rename = await api(`/api/merchant/products/${id5}`, { method:'PUT', cookie:merchantCookie, body:{ name:`凭证测试 ${RUN}-05 改名`, media:[imageMedia, m5] } });
const renamedModel = (rename.json.product.media || []).find(m => m.type === 'model');
check('7 改商品名称不替换模型 → 合法凭证保留 approved',
  rename.status === 200 && renamedModel?.reviewStatus === 'approved' && renamedModel?.modelReview?.reviewerId === reviewerAccount.id,
  `status=${rename.status} reviewStatus=${renamedModel?.reviewStatus}`);

// ── 8) 替换模型 → 旧凭证不生效 ──
const repl = await uploadModel('replacement2');
const replaceRes = await api(`/api/merchant/products/${id5}`, { method:'PUT', cookie:merchantCookie,
  body:{ media:[imageMedia, { ...repl, reviewStatus:'approved', modelReview: forgedCredential }] }});
const replModel = (replaceRes.json.product.media || []).find(m => m.type === 'model');
check('8 替换模型后旧凭证不生效 → pending 且无凭证',
  replaceRes.status === 200 && replModel?.reviewStatus === 'pending' && !replModel?.modelReview,
  `status=${replaceRes.status} reviewStatus=${replModel?.reviewStatus} modelReview=${JSON.stringify(replModel?.modelReview)}`);

// ── 9) 审核失败时商品状态与审计一致 ──
// 用一个不存在的 mediaId 让事务内 404，确认商品未被改动、审计也没有新增
const auditBefore = await prisma.auditLog.count({ where:{ action:'PRODUCT_MODEL_REVIEW', entityId: id5 } });
const beforeMedia = (await prisma.product.findUnique({ where:{ id: id5 }, select:{ media:true } })).media;
const ghost = await api(`/api/admin/products/${id5}/media/does-not-exist/model-review`, { method:'PUT', token: reviewerToken, body:{ decision:'approved' } });
const auditAfter = await prisma.auditLog.count({ where:{ action:'PRODUCT_MODEL_REVIEW', entityId: id5 } });
const afterMedia2 = (await prisma.product.findUnique({ where:{ id: id5 }, select:{ media:true } })).media;
check('9 审核失败 → 商品未改变且审计未新增（事务一致）',
  ghost.status === 404 && beforeMedia === afterMedia2 && auditBefore === auditAfter,
  `status=${ghost.status} mediaUnchanged=${beforeMedia === afterMedia2} auditDelta=${auditAfter - auditBefore}`);

// ── 10) 无凭证的旧模型在商家改其他字段时也被降级 ──
const m10 = await uploadModel('legacy-downgrade');
const p10 = await api('/api/merchant/products', { method:'POST', cookie:merchantCookie, body: payload('10', [imageMedia, m10]) });
const id10 = p10.json.product.id;
await setDbMedia(id10, media => media.map(m => m.type === 'model' ? { id:m.id, type:'model', url:m.url, storageKey:m.storageKey, contentType:m.contentType, sizeBytes:m.sizeBytes, role:'main', source:'merchant-upload', reviewStatus:'approved' } : m));
const downgrade = await api(`/api/merchant/products/${id10}`, { method:'PUT', cookie:merchantCookie, body:{ name:`凭证测试 ${RUN}-10 改名`, media:[imageMedia, m10] } });
const downgradedModel = (downgrade.json.product.media || []).find(m => m.type === 'model');
check('10 旧模型无凭证 → 商家改其它字段时被降级 pending',
  downgrade.status === 200 && downgradedModel?.reviewStatus === 'pending',
  `status=${downgrade.status} reviewStatus=${downgradedModel?.reviewStatus}`);

console.log(`\n汇总：${pass} 通过 / ${fail} 失败`);
if (fail) { console.log(JSON.stringify(results.filter(r => !r.ok), null, 2)); }
await prisma.$disconnect();
process.exit(fail ? 1 : 0);
