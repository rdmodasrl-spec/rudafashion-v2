import { chromium } from 'playwright';
import { readFileSync, mkdirSync } from 'node:fs';

const env = Object.fromEntries(readFileSync('/www/wwwroot/ruda.fashion/.env', 'utf8')
  .split('\n')
  .filter(line => line.includes('=') && !line.trim().startsWith('#'))
  .map(line => {
    const index = line.indexOf('=');
    const value = line.slice(index + 1).trim().replace(/^(['"])(.*)\1$/, '$2');
    return [line.slice(0, index).trim(), value];
  }));

const shotDir = '/www/wwwroot/ruda.fashion/docs/engineering/evidence/fashion-stage5';
mkdirSync(shotDir, { recursive: true });

const token = (() => {
  const line = readFileSync('/tmp/admin.cookies', 'utf8').split('\n').find(entry => entry.includes('ruda_admin_jwt'));
  return line ? line.split('\t').pop().trim() : '';
})();

const browser = await chromium.launch({
  args: ['--host-resolver-rules=MAP admin.ruda.fashion 127.0.0.1']
});
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, ignoreHTTPSErrors: true });
if (token) {
  await context.addCookies([{
    name: 'ruda_admin_jwt', value: token, domain: 'admin.ruda.fashion', path: '/', httpOnly: true, secure: true, sameSite: 'Lax'
  }]);
}
const page = await context.newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.message));
await page.goto('https://admin.ruda.fashion/', { waitUntil: 'networkidle', timeout: 60000 });
console.log('title:', await page.title());

const loginButton = page.getByRole('button', { name: /登录平台管理中心/ });
if (await loginButton.count()) {
  const inputs = page.locator('input');
  await inputs.nth(0).fill(env.ADMIN_USERNAME || '');
  await inputs.nth(1).fill(env.ADMIN_PASSWORD || '');
  await loginButton.first().click();
  await page.waitForTimeout(4000);
  console.log('after login url:', page.url());
}
await page.screenshot({ path: `${shotDir}/admin-00-landing.png`, fullPage: false });

const clickText = async (text) => {
  const target = page.getByRole('button', { name: text, exact: true }).first();
  if (await target.count()) { await target.click(); return true; }
  const link = page.getByText(text, { exact: true }).first();
  if (await link.count()) { await link.click(); return true; }
  return false;
};

console.log('growth nav:', await clickText('增长运营'));
await page.waitForTimeout(600);
console.log('fashion nav:', await clickText('时尚设计'));
await page.waitForTimeout(2000);
console.log('assets card:', await clickText('我的素材'));
await page.waitForTimeout(600);
const assetSelect = page.locator('select').filter({ hasText: '图片图库' }).first();
if (await assetSelect.count()) {
  await assetSelect.selectOption('community');
} else {
  await page.locator('select').last().selectOption('community');
}
await page.waitForTimeout(2500);
await page.screenshot({ path: `${shotDir}/admin-01-governance-reports.png`, fullPage: false });

for (const [label, file] of [['分类标签', 'admin-02-taxonomy'], ['违规用户', 'admin-03-users'], ['媒体异常', 'admin-04-media']]) {
  const tab = page.getByRole('button', { name: new RegExp(label) }).first();
  let clicked = false;
  if (await tab.count()) { await tab.click(); clicked = true; }
  await page.waitForTimeout(2000);
  console.log(label, clicked);
  await page.screenshot({ path: `${shotDir}/${file}.png`, fullPage: false });
}

console.log('pageerrors:', errors.slice(0, 3));
await browser.close();

