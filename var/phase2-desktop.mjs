import { readFileSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright';

const OUT = '/www/wwwroot/ruda.fashion/var/phase2-evidence';
const token = readFileSync('/tmp/ruda-phase2-token.txt', 'utf8').trim();
const checks = {};
const check = (name, value) => { checks[name] = value; console.log('CHECK', name, JSON.stringify(value)); };
const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext({ baseURL: 'http://localhost:4187', viewport: { width: 1440, height: 900 }, locale: 'zh-CN' });
  await context.addCookies([{ name: 'ruda_merchant_jwt', value: token, domain: 'localhost', path: '/', httpOnly: true, secure: false, sameSite: 'Lax' }]);
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push('pageerror:' + error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push('console:' + message.text().slice(0, 200)); });
  await page.goto('/merchant?ruda-app=merchant-admin-web', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.locator('#merchant-sidebar-tab-modagpt').waitFor({ state: 'visible', timeout: 90000 });
  await page.waitForTimeout(1200);
  const shell = await page.evaluate(() => {
    const sidebar = document.querySelector('aside');
    return { sidebarWidth: sidebar ? Math.round(sidebar.getBoundingClientRect().width) : null, overflow: document.documentElement.scrollWidth > window.innerWidth };
  });
  check('desktop.shell', shell);
  await page.screenshot({ path: `${OUT}/desktop-1440-portal.png` });

  await page.locator('#merchant-sidebar-tab-modagpt').click();
  await page.getByRole('heading', { name: /服装创作|Creazione moda/i }).first().waitFor({ state: 'visible', timeout: 30000 });
  check('desktop.landing', await page.evaluate(() => ({
    design: /服装设计|Design moda/.test(document.body.innerText),
    tryon: /虚拟试衣|Virtual Try-On/.test(document.body.innerText),
    model: /商业模特|Modelli moda/.test(document.body.innerText),
    recolor: /服装换色|Ricolora capo/.test(document.body.innerText)
  })));
  await page.screenshot({ path: `${OUT}/desktop-1440-fashion-studio.png` });

  await page.locator('article').filter({ hasText: /服装设计|Design moda/ }).locator('button').first().click();
  await page.getByRole('heading', { name: /创作工具|Strumenti creativi/i }).first().waitFor({ state: 'visible', timeout: 30000 });
  check('desktop.createSection', await page.evaluate(() => ({
    header: document.querySelector('header')?.innerText.trim(),
    body: document.body.innerText.replace(/\s+/g, ' ').slice(0, 600)
  })));
  await page.screenshot({ path: `${OUT}/desktop-1440-create.png` });

  await page.getByRole('button', { name: /进入 ModaUI 工作区|Apri ModaUI/ }).first().click();
  await page.locator('textarea').first().waitFor({ state: 'visible', timeout: 30000 });
  await page.waitForTimeout(1200);
  const ai = await page.evaluate(() => {
    const main = document.querySelector('main');
    const rect = main ? main.getBoundingClientRect() : null;
    return {
      headerText: document.querySelector('header')?.innerText.trim(),
      mainWidth: rect ? Math.round(rect.width) : null,
      mainHeight: rect ? Math.round(rect.height) : null,
      hasDragHandle: Boolean(document.querySelector('button[aria-controls="merchant-bottom-navigation"]')),
      hasBack: Boolean(document.querySelector('button[aria-label*="退出聊天"], button[aria-label*="Esci dalla chat"]')),
      hasMenu: Boolean(document.querySelector('button[aria-haspopup="menu"]')),
      overflow: document.documentElement.scrollWidth > window.innerWidth
    };
  });
  check('desktop.aiWorkspace', ai);
  await page.locator('button[aria-haspopup="menu"]').first().click();
  const menu = page.locator('[role="menu"]').first();
  await menu.waitFor({ state: 'visible', timeout: 10000 });
  check('desktop.menuItems', (await menu.locator('[role="menuitem"]').allTextContents()).map(item => item.trim()).filter(Boolean));
  await page.screenshot({ path: `${OUT}/desktop-1440-modaui-menu.png` });
  await page.keyboard.press('Escape');

  await page.setViewportSize({ width: 1024, height: 768 });
  await page.waitForTimeout(500);
  check('desktop.resized1024', await page.evaluate(() => ({
    overflow: document.documentElement.scrollWidth > window.innerWidth,
    textareaBottom: (() => { const el = document.querySelector('textarea'); return el ? Math.round(el.getBoundingClientRect().bottom) : null; })(),
    viewportHeight: window.innerHeight,
    menuVisible: Boolean(document.querySelector('button[aria-haspopup="menu"]'))
  })));
  await page.screenshot({ path: `${OUT}/desktop-1024-modaui.png` });

  await page.locator('button[aria-label*="退出聊天"], button[aria-label*="Esci dalla chat"]').first().click();
  await page.waitForTimeout(700);
  check('desktop.backToStudio', await page.evaluate(() => ({
    sidebarPresent: Boolean(document.querySelector('#merchant-sidebar-tab-modagpt')),
    heading: document.querySelector('h1')?.textContent || ''
  })));
  check('desktop.errors', [...new Set(errors)].slice(0, 20));
} catch (error) {
  checks.fatal = error instanceof Error ? `${error.message}\n${error.stack}` : String(error);
  console.error('FATAL', checks.fatal);
} finally {
  writeFileSync(`${OUT}/desktop-report.json`, JSON.stringify(checks, null, 2));
  await browser.close();
}
