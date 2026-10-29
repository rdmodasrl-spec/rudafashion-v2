import { chromium } from 'playwright';
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();
await page.goto('http://127.0.0.1:3011/zh/?post=fashion-demo-1', { waitUntil: 'networkidle', timeout: 60000 });
const allow = page.getByRole('button', { name: '允许' });
if (await allow.count()) { await allow.first().click(); await page.waitForTimeout(600); }
const nav = page.getByRole('button', { name: '潮流时尚' });
if (await nav.count()) { await nav.first().click(); } else { await page.getByText('潮流时尚', { exact: true }).first().click().catch(() => {}); }
await page.waitForTimeout(1500);
const enter = page.getByRole('button', { name: '浏览时尚内容' });
if (await enter.count()) { await enter.first().click(); }
await page.waitForTimeout(4000);
await page.screenshot({ path: '/www/wwwroot/ruda.fashion/docs/engineering/evidence/fashion-stage5/desktop-09-editorial-owned.png' });
console.log('ok', page.url());
await browser.close();
