/**
 * RUDA 3D 模型审核安全 —— 真实 HTTP 攻击测试。
 *
 * 只打隔离实例（默认 4104）+ 隔离库，全部通过真实请求验证，
 * 不调用前端函数、不直接改数据库当作审核流程。
 *
 * 用法：P2_BASE=http://127.0.0.1:4104 node scripts/p2/3d-review-attacks.mjs
 */
import { readFileSync } from 'node:fs';
import jwt from 'jsonwebtoken';

const BASE = process.env.P2_BASE || 'http://127.0.0.1:4104';
const GLB = readFileSync('public/models/ruda-sample-handbag.glb');
const MERCHANT_SECRET = 'p2-3d-merchant-secret';
const ADMIN_SECRET = 'p2-3d-admin-secret';
const DEMO_MERCHANT = 'demo-industry-bags-wholesale';
const IMG = 'https://modaui.com/demo-products/category-bags.jpg';

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
if (login.status !== 200) { console.error('demo login failed', login.status, login.text.slice(0,150)); process.exit(1); }
const merchantCookie = login.cookie;

async function uploadModel(tag) {
  const pre = await api('/api/merchant/media/presign', { method:'POST', cookie:merchantCookie, body:{ contentType:'model/gltf-binary', fileSize: GLB.length }});
  if (pre.status !== 200) throw new Error('presign ' + pre.status + ' ' + pre.text.slice(0,120));
  const put = await fetch(pre.json.uploadUrl, { method:'PUT', headers:{'Content-Type':'model/gltf-binary'}, body: GLB });
  if (!put.ok) throw new Error('put ' + put.status);
  return { id:`model-${tag}`, type:'model', url:pre.json.publicUrl, storageKey:pre.json.key,
    contentType:'model/gltf-binary', sizeBytes:GLB.length, role:'main', source:'merchant-upload', alt:`${tag}.glb` };
}

const RUN = Date.now().toString(36).toUpperCase();
const payload = (suffix, media) => ({
  styleNo:`QA-ATK-${RUN}-${suffix}`, name:`攻击测试商品 ${RUN}-${suffix}`, category:'bags', subCategory:'tote',
  brand:'RUDA QA', season:'SS26', origin:'Italia', fabric:'calf leather', composition:'100% calf leather',
  wholesalePrice:55, rrpPrice:99, moq:1, packSize:1, lifecycleStatus:'published',
  description:'审核攻击测试', industryAttributes:{ material:'头层牛皮' },
  skus:[{ sku:`QA-ATK-${RUN}-${suffix}`, color:'Black', size:'One', stockCentral:10 }], media
});

const imageMedia = { id:'img-1', type:'image', url:IMG, role:'main', source:'merchant-upload' };

// 1 创建时伪造 approved
const forged = await uploadModel('forged-create');
const created = await api('/api/merchant/products', { method:'POST', cookie:merchantCookie,
  body: payload('01', [imageMedia, { ...forged, reviewStatus:'approved' }]) });
const productId = created.json?.product?.id;
const createdModel = (created.json?.product?.media || []).find(m => m.type === 'model');
check('1 创建商品提交 reviewStatus=approved → 落库 pending',
  created.status === 201 && createdModel?.reviewStatus === 'pending',
  `status=${created.status} reviewStatus=${createdModel?.reviewStatus}`);

// 2 更新时伪造 approved
const upd = await api(`/api/merchant/products/${productId}`, { method:'PUT', cookie:merchantCookie,
  body:{ media:[imageMedia, { ...forged, reviewStatus:'approved' }] }});
const updModel = (upd.json?.product?.media || []).find(m => m.type === 'model');
check('2 更新商品提交 reviewStatus=approved → 仍 pending',
  upd.status === 200 && updModel?.reviewStatus === 'pending',
  `status=${upd.status} reviewStatus=${updModel?.reviewStatus}`);

// 3 商家打审核接口
const m2a = await api(`/api/admin/products/${productId}/media/${forged.id}/model-review`, { method:'PUT', cookie:merchantCookie, body:{ decision:'approved' }});
check('3 商家调用管理员审核接口被拒', [401,403].includes(m2a.status), `status=${m2a.status} ${m2a.json?.error?.code || ''}`);

const forgedToken = jwt.sign({ id:'x', username:'qa-reviewer', role:'merchant', merchantId:DEMO_MERCHANT }, MERCHANT_SECRET, { expiresIn:'1h' });
const m3 = await api(`/api/admin/products/${productId}/media/${forged.id}/model-review`, { method:'PUT', token:forgedToken, body:{ decision:'approved' }});
check('3b 商家密钥签发 token 打审核接口被拒', [401,403].includes(m3.status), `status=${m3.status}`);

// 4 无权限管理员
const noPerm = jwt.sign({ username:'qa-no-perm', role:'admin', permissions:['settings.ai_support'] }, ADMIN_SECRET, { expiresIn:'1h' });
const r4 = await api(`/api/admin/products/${productId}/media/${forged.id}/model-review`, { method:'PUT', token:noPerm, body:{ decision:'approved' }});
check('4 无 products.review 权限管理员批准 → 403', r4.status === 403, `status=${r4.status} ${r4.json?.error?.code || ''}`);

// 5 有权限管理员批准
const reviewer = jwt.sign({ username:'qa-reviewer', role:'admin', permissions:['products.review'] }, ADMIN_SECRET, { expiresIn:'1h' });
const r5 = await api(`/api/admin/products/${productId}/media/${forged.id}/model-review`, { method:'PUT', token:reviewer, body:{ decision:'approved', reason:'外观与尺寸核对无误' }});
check('5 有权限管理员批准 → approved，记录审核人与时间',
  r5.status === 200 && r5.json?.reviewStatus === 'approved' && r5.json?.reviewedBy === 'qa-reviewer' && Boolean(r5.json?.reviewedAt),
  `status=${r5.status} by=${r5.json?.reviewedBy} at=${r5.json?.reviewedAt}`);

// 6 改名不换模型 → 保留 approved
const rename = await api(`/api/merchant/products/${productId}`, { method:'PUT', cookie:merchantCookie,
  body:{ name:'攻击测试商品 改名后', media:[imageMedia, forged] }});
const renamedModel = (rename.json?.product?.media || []).find(m => m.type === 'model');
check('6 商家改名不替换模型 → 保留 approved（读数据库）',
  rename.status === 200 && renamedModel?.reviewStatus === 'approved',
  `status=${rename.status} reviewStatus=${renamedModel?.reviewStatus}`);

// 7 替换模型 → 重新 pending
const repl = await uploadModel('replacement');
const r7 = await api(`/api/merchant/products/${productId}`, { method:'PUT', cookie:merchantCookie,
  body:{ media:[imageMedia, { ...repl, reviewStatus:'approved' }] }});
const replModel = (r7.json?.product?.media || []).find(m => m.type === 'model');
check('7 商家替换模型文件 → 新模型 pending',
  r7.status === 200 && replModel?.reviewStatus === 'pending',
  `status=${r7.status} reviewStatus=${replModel?.reviewStatus}`);

// 8 复制已审核媒体到新商品
const copy = await api('/api/merchant/products', { method:'POST', cookie:merchantCookie,
  body: payload('08', [imageMedia, { ...forged, reviewStatus:'approved' }]) });
const copyModel = (copy.json?.product?.media || []).find(m => m.type === 'model');
check('8 复制已审核媒体到新商品 → 新商品模型 pending',
  copy.status === 201 && copyModel?.reviewStatus === 'pending',
  `status=${copy.status} reviewStatus=${copyModel?.reviewStatus}`);

// 9/10 pending 不进公开接口
const list = await api('/api/products');
const listed = (list.json?.products || []).find(p => p.id === productId);
const detail = await api(`/api/products/${productId}`);
const det = detail.json?.product || detail.json;
check('9 pending 模型不出现在商品列表 API',
  !(listed?.media || []).some(m => m.type === 'model') && !JSON.stringify(listed || {}).includes('.glb'),
  `mediaTypes=${(listed?.media || []).map(m => m.type).join(',') || '无'}`);
check('10 pending 模型不出现在商品详情 API',
  !(det?.media || []).some(m => m.type === 'model') && !JSON.stringify(det || {}).includes('.glb'),
  `mediaTypes=${(det?.media || []).map(m => m.type).join(',') || '无'}`);

// 11 驳回必须给原因
const r11 = await api(`/api/admin/products/${productId}/media/${repl.id}/model-review`, { method:'PUT', token:reviewer, body:{ decision:'rejected' }});
check('11 管理员驳回未填原因 → 400', r11.status === 400 && r11.json?.error === 'MODEL_REVIEW_REASON_REQUIRED', `status=${r11.status}`);

// 12 批准后进入公开详情
const r12 = await api(`/api/admin/products/${productId}/media/${repl.id}/model-review`, { method:'PUT', token:reviewer, body:{ decision:'approved' }});
const after = await api(`/api/products/${productId}`);
const afterP = after.json?.product || after.json;
const visible = (afterP?.media || []).find(m => m.type === 'model');
check('12 管理员批准后模型进入公开详情，图片仍在',
  r12.status === 200 && visible?.reviewStatus === 'approved' && (afterP?.media || []).some(m => m.type === 'image'),
  `status=${r12.status} reviewStatus=${visible?.reviewStatus}`);

console.log(`\n汇总：${pass} 通过 / ${fail} 失败`);
if (fail) { console.log(JSON.stringify(results.filter(r => !r.ok), null, 2)); process.exit(1); }
