import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';

const shotDir = '/www/wwwroot/ruda.fashion/docs/engineering/evidence/feature-switches';
const env = Object.fromEntries(readFileSync('/www/wwwroot/ruda.fashion/.env', 'utf8')
  .split('\n')
  .filter(line => line.includes('=') && !line.trim().startsWith('#'))
  .map(line => {
    const index = line.indexOf('=');
    const value = line.slice(index + 1).trim().replace(/^(['"])(.*)\1$/, '$2');
    return [line.slice(0, index).trim(), value];
  }));

const browser = await chromium.launch({ args: ['--host-resolver-rules=MAP admin.ruda.fashion 127.0.0.1'] });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, ignoreHTTPSErrors: true });
const page = await context.newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.message));
await page.goto('https://admin.ruda.fashion/', { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(1500);
const loginButton = page.getByRole('button', { name: /登录平台管理中心/ }).first();
if (await loginButton.count()) {
  const inputs = page.locator('input');
  await inputs.nth(0).fill(env.ADMIN_USERNAME || '');
  await inputs.nth(1).fill(env.ADMIN_PASSWORD || '');
  await loginButton.click();
  await page.waitForTimeout(5000);
}
const clickText = async text => {
  const button = page.getByRole('button', { name: text, exact: true }).first();
  if (await button.count()) { await button.click(); return true; }
  const link = page.getByText(text, { exact: true }).first();
  if (await link.count()) { await link.click(); return true; }
  return false;
};
console.log('platform nav:', await clickText('平台管理'));
await page.waitForTimeout(800);
console.log('flags nav:', await clickText('功能开关'));
await page.waitForTimeout(1500);
await page.screenshot({ path: `${shotDir}/admin-flags-03-mobile.png`, fullPage: true });
console.log('errors:', JSON.stringify(errors));
await browser.close();
