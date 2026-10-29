import { chromium } from 'playwright';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

/**
 * 平台全局开关验收截图脚本。
 * - 管理端：真实登录 + 真实页面点击，截图四个开关与关闭确认框。
 * - 前台：通过管理端 API 短暂关闭/开启「时尚版块」「ModaUI」，验证入口消失/恢复与提示页。
 * 结束时把两个开关恢复为开启，并打印最终状态。
 */

const shotDir = '/www/wwwroot/ruda.fashion/docs/engineering/evidence/feature-switches';
mkdirSync(shotDir, { recursive: true });
const base = 'http://127.0.0.1:3011';

const env = Object.fromEntries(readFileSync('/www/wwwroot/ruda.fashion/.env', 'utf8')
  .split('\n')
  .filter(line => line.includes('=') && !line.trim().startsWith('#'))
  .map(line => {
    const index = line.indexOf('=');
    const value = line.slice(index + 1).trim().replace(/^(['"])(.*)\1$/, '$2');
    return [line.slice(0, index).trim(), value];
  }));

const browser = await chromium.launch({
  args: ['--host-resolver-rules=MAP admin.ruda.fashion 127.0.0.1']
});

const errors = [];

const adminContext = await browser.newContext({ viewport: { width: 1440, height: 1000 }, ignoreHTTPSErrors: true });
const adminPage = await adminContext.newPage();
adminPage.on('pageerror', error => errors.push(`admin: ${error.message}`));
await adminPage.goto('https://admin.ruda.fashion/', { waitUntil: 'domcontentloaded', timeout: 60000 });

const loginButton = adminPage.getByRole('button', { name: /登录平台管理中心/ }).first();
await adminPage.waitForTimeout(1500);
if (await loginButton.count()) {
  const inputs = adminPage.locator('input');
  await inputs.nth(0).fill(env.ADMIN_USERNAME || '');
  await inputs.nth(1).fill(env.ADMIN_PASSWORD || '');
  await loginButton.click();
  await adminPage.waitForTimeout(5000);
  console.log('logged in via form:', adminPage.url());
}

async function readAdminFlags(context) {
  const cookieHeader = (await context.cookies()).map(item => `${item.name}=${item.value}`).join('; ');
  const response = await context.request.get('https://admin.ruda.fashion/api/admin/feature-flags', { headers: { cookie: cookieHeader } });
  const body = await response.json();
  if (!body || !Array.isArray(body.flags)) {
    throw new Error(`admin flags read failed: ${response.status()} ${JSON.stringify(body).slice(0, 200)}`);
  }
  const map = {};
  for (const flag of body.flags) map[flag.key] = flag;
  return map;
}

async function setAdminFlag(context, key, enabled) {
  const flags = await readAdminFlags(context);
  const current = flags[key];
  if (!current) throw new Error(`flag ${key} not found`);
  const cookieHeader = (await context.cookies()).map(item => `${item.name}=${item.value}`).join('; ');
  const response = await context.request.patch(`https://admin.ruda.fashion/api/admin/feature-flags/${encodeURIComponent(key)}`, {
    headers: { cookie: cookieHeader },
    data: { enabled, expectedUpdatedAt: current.updatedAt }
  });
  const body = await response.json();
  if (response.status() !== 200 || !body || !body.success) {
    throw new Error(`PATCH ${key} failed: ${response.status()} ${JSON.stringify(body).slice(0, 200)}`);
  }
  return body.flag;
}

const dismissConsent = async page => {
  const decline = page.getByRole('button', { name: '拒绝', exact: true }).first();
  if (await decline.count()) await decline.click().catch(() => {});
  await page.waitForTimeout(200);
};

// 服务端行为校验：与 UI 截图同一次运行完成，避免两次运行之间状态漂移。
const checks = [];
async function apiCheck(label, pathname, init) {
  const response = await fetch(`${base}${pathname}`, init);
  const text = await response.text();
  let code = null;
  try {
    const payload = JSON.parse(text);
    code = typeof payload?.error === 'string' ? payload.error : payload?.error?.code ?? null;
  } catch {
    code = null;
  }
  checks.push({ label, path: pathname, status: response.status, code });
  console.log('check:', label, response.status, code ?? '');
  return { status: response.status, code };
}

// 只读副本校验（小程序/公开开关载荷），用于证明各端读到同一权威值。
async function readJsonCheck(label, pathname) {
  const response = await fetch(`${base}${pathname}`);
  const body = await response.json().catch(() => null);
  checks.push({ label, path: pathname, status: response.status, code: null, body });
  console.log('check:', label, response.status, JSON.stringify(body).slice(0, 200));
  return { status: response.status, body };
}

// 在 try 块内赋值、在 try 之外断言，因此声明提升到模块作用域。
let miniOn;
let miniOff;
let publicOff;
let merchantUnauthed;



const clickText = async (page, text) => {
  const button = page.getByRole('button', { name: text, exact: true }).first();
  if (await button.count()) { await button.click(); return true; }
  const link = page.getByText(text, { exact: true }).first();
  if (await link.count()) { await link.click(); return true; }
  return false;
};

// 基线归一：无论上一次运行（或他人操作）留下什么状态，先把两个全局总闸置为开启，
// 使后续「关闭 → 验证 → 重新开启」的截图与断言可重复。两个小程序评审开关保持原值。
await setAdminFlag(adminContext, 'fashion_enabled', true);
await setAdminFlag(adminContext, 'modaui_enabled', true);

console.log('platform nav:', await clickText(adminPage, '平台管理'));
await adminPage.waitForTimeout(800);
console.log('flags nav:', await clickText(adminPage, '功能开关'));
await adminPage.waitForTimeout(1500);
await adminPage.screenshot({ path: `${shotDir}/admin-flags-01-desktop.png` });

const fashionSwitch = adminPage.getByRole('switch', { name: /时尚版块/ }).first();
if (await fashionSwitch.count()) {
  await fashionSwitch.click();
  await adminPage.waitForTimeout(500);
  await adminPage.screenshot({ path: `${shotDir}/admin-flags-02-confirm.png` });
  const cancel = adminPage.getByRole('button', { name: '取消', exact: true }).first();
  if (await cancel.count()) await cancel.click();
} else {
  console.log('fashion switch not found');
}

// 前台：桌面端（时尚入口 + 关闭提示页 + 恢复）
const publicContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const publicPage = await publicContext.newPage();
publicPage.on('pageerror', error => errors.push(`public: ${error.message}`));

try {
  await publicPage.goto(`${base}/`, { waitUntil: 'networkidle', timeout: 60000 });
  await publicPage.waitForTimeout(800);
  await dismissConsent(publicPage);
  await publicPage.screenshot({ path: `${shotDir}/web-01-home-fashion-on.png` });

  await apiCheck('时尚开启 → /api/fashion/posts', '/api/fashion/posts?limit=1');
  const miniOnResult = await readJsonCheck('小程序特性（时尚开启）', '/api/miniprogram/features');
  miniOn = miniOnResult;
  const merchantUnauthedResult = await readJsonCheck('商家端开关（未登录）', '/api/merchant/feature-flags');
  merchantUnauthed = merchantUnauthedResult;
  await setAdminFlag(adminContext, 'fashion_enabled', false);
  await apiCheck('时尚关闭 → /api/fashion/posts', '/api/fashion/posts?limit=1');
  miniOff = await readJsonCheck('小程序特性（时尚关闭）', '/api/miniprogram/features');
  publicOff = await readJsonCheck('公开开关副本（时尚关闭）', '/api/public/feature-flags');
  await apiCheck('时尚关闭 → 公共对话（不受影响）', '/api/modagpt/public/chat', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{}'
  });
  await publicPage.waitForTimeout(1200);
  await publicPage.reload({ waitUntil: 'networkidle' });
  await publicPage.waitForTimeout(800);
  await dismissConsent(publicPage);
  await publicPage.screenshot({ path: `${shotDir}/web-02-home-fashion-off.png` });

  await publicPage.goto(`${base}/trends`, { waitUntil: 'networkidle', timeout: 60000 });
  await publicPage.waitForTimeout(800);
  await dismissConsent(publicPage);
  await publicPage.screenshot({ path: `${shotDir}/web-03-trends-disabled.png` });

  await setAdminFlag(adminContext, 'fashion_enabled', true);
  await publicPage.waitForTimeout(1200);
  await publicPage.goto(`${base}/trends`, { waitUntil: 'networkidle', timeout: 60000 });
  await publicPage.waitForTimeout(800);
  await dismissConsent(publicPage);
  await publicPage.screenshot({ path: `${shotDir}/web-04-trends-restored.png` });

  // 手机网页：底部导航 ModaUI 隐藏/恢复
  const mobileContext = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const mobilePage = await mobileContext.newPage();
  mobilePage.on('pageerror', error => errors.push(`mobile: ${error.message}`));
  await mobilePage.goto(`${base}/`, { waitUntil: 'networkidle', timeout: 60000 });
  await mobilePage.waitForTimeout(800);
  await dismissConsent(mobilePage);
  await mobilePage.screenshot({ path: `${shotDir}/mobile-01-home-modaui-on.png` });

  await apiCheck('ModaUI 开启 → 公共对话', '/api/modagpt/public/chat', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{}'
  });
  await setAdminFlag(adminContext, 'modaui_enabled', false);
  await apiCheck('ModaUI 关闭 → 公共对话', '/api/modagpt/public/chat', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{}'
  });
  await apiCheck('ModaUI 关闭 → 时尚接口（不受影响）', '/api/fashion/posts?limit=1');
  await mobilePage.waitForTimeout(1200);
  await mobilePage.reload({ waitUntil: 'networkidle' });
  await mobilePage.waitForTimeout(800);
  await dismissConsent(mobilePage);
  await mobilePage.screenshot({ path: `${shotDir}/mobile-02-home-modaui-off.png` });
} finally {
  // 无论成功失败都恢复开启，避免影响线上。
  await setAdminFlag(adminContext, 'fashion_enabled', true).catch(() => {});
  await setAdminFlag(adminContext, 'modaui_enabled', true).catch(() => {});
}

const finalFlags = await readAdminFlags(adminContext);
const finalEnabled = Object.fromEntries(Object.entries(finalFlags).map(([key, flag]) => [key, flag.enabled]));
console.log('final flags:', JSON.stringify(finalEnabled));
console.log('page errors:', JSON.stringify(errors));

// 重新开启后的恢复验证：两个总闸都回到可用状态。
const restored = await apiCheck('恢复后 → /api/fashion/posts', '/api/fashion/posts?limit=1');
const restoredChat = await apiCheck('恢复后 → 公共对话', '/api/modagpt/public/chat', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: '{}'
});

const failures = [];
const expect = (label, actual, expectedStatus, expectedCode = null) => {
  if (actual.status !== expectedStatus || actual.code !== expectedCode) {
    failures.push(`${label}: 期望 ${expectedStatus}${expectedCode ? `/${expectedCode}` : ''}，实际 ${actual.status}${actual.code ? `/${actual.code}` : ''}`);
  }
};
const byLabel = label => checks.find(item => item.label === label);
expect('时尚开启 → /api/fashion/posts', byLabel('时尚开启 → /api/fashion/posts'), 200);
expect('时尚关闭 → /api/fashion/posts', byLabel('时尚关闭 → /api/fashion/posts'), 403, 'FASHION_MODULE_DISABLED');
expect('时尚关闭 → 公共对话（不受影响）', byLabel('时尚关闭 → 公共对话（不受影响）'), 400, 'MESSAGE_REQUIRED');
expect('ModaUI 开启 → 公共对话', byLabel('ModaUI 开启 → 公共对话'), 400, 'MESSAGE_REQUIRED');
expect('ModaUI 关闭 → 公共对话', byLabel('ModaUI 关闭 → 公共对话'), 403, 'MODAUI_DISABLED');
expect('ModaUI 关闭 → 时尚接口（不受影响）', byLabel('ModaUI 关闭 → 时尚接口（不受影响）'), 200);
expect('恢复后 → /api/fashion/posts', restored, 200);
expect('恢复后 → 公共对话', restoredChat, 400, 'MESSAGE_REQUIRED');
// 各端只读副本必须与权威值一致：
if (miniOn.body?.features?.fashionSectionEnabled !== true) failures.push('小程序特性（时尚开启）应为 true');
if (miniOff.body?.features?.fashionSectionEnabled !== false) failures.push('小程序特性（时尚关闭）应为 false');
if (publicOff.body?.flags?.fashion_enabled !== false) failures.push('公开开关副本（时尚关闭）应为 false');
if (publicOff.body?.flags?.modaui_enabled !== true) failures.push('关闭时尚不得影响 ModaUI（公开副本应为 true）');
if (merchantUnauthed.status !== 401) failures.push(`商家端开关未登录应返回 401，实际 ${merchantUnauthed.status}`);

writeFileSync(
  `${shotDir}/verification.json`,
  JSON.stringify({
    ranAt: new Date().toISOString(),
    base,
    checks,
    finalEnabled,
    pageErrors: errors,
    failures
  }, null, 2) + '\n',
  'utf8'
);

await browser.close();

if (failures.length > 0) {
  console.error('FAILED:', failures.join(' | '));
  process.exitCode = 1;
} else {
  console.log('all switch checks passed');
}
