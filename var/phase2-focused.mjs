import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const BASE = 'http://localhost:4187';
const OUT = '/www/wwwroot/ruda.fashion/var/phase2-evidence';
mkdirSync(OUT, { recursive: true });
const token = readFileSync('/tmp/ruda-phase2-token.txt', 'utf8').trim();
const report = { startedAt: new Date().toISOString(), checks: {}, screenshots: [], errors: [] };
const check = (name, value) => { report.checks[name] = value; console.log('CHECK', name, JSON.stringify(value)); };
const shot = async (page, name) => { const file = `${OUT}/${name}.png`; await page.screenshot({ path: file }); report.screenshots.push(file); };

async function addCookie(context) {
  await context.addCookies([{ name: 'ruda_merchant_jwt', value: token, domain: 'localhost', path: '/', httpOnly: true, secure: false, sameSite: 'Lax' }]);
}

async function metrics(page) {
  return page.evaluate(() => {
    const nav = document.querySelector('#merchant-bottom-navigation');
    const handle = document.querySelector('button[aria-controls="merchant-bottom-navigation"]');
    const textarea = document.querySelector('textarea');
    let pane = null;
    let node = textarea;
    while (node) {
      if (getComputedStyle(node).position === 'fixed' && node !== nav) { pane = node; break; }
      node = node.parentElement;
    }
    const rect = element => {
      if (!element) return null;
      const value = element.getBoundingClientRect();
      return { top: Math.round(value.top * 10) / 10, bottom: Math.round(value.bottom * 10) / 10, height: Math.round(value.height * 10) / 10 };
    };
    return {
      innerHeight: window.innerHeight,
      visualHeight: window.visualViewport ? Math.round(window.visualViewport.height) : null,
      visualOffsetTop: window.visualViewport ? Math.round(window.visualViewport.offsetTop) : null,
      navHidden: nav && nav.getAttribute('aria-hidden'),
      navClasses: nav && nav.className,
      navTranslate: nav && getComputedStyle(nav).translate,
      nav: rect(nav), handle: rect(handle), pane: rect(pane), textarea: rect(textarea),
      paneClasses: pane && pane.className,
      paneInlineStyle: pane && pane.getAttribute('style'),
      scrollWidth: document.documentElement.scrollWidth
    };
  });
}

async function openMenu(page) {
  await page.locator('button[aria-haspopup="menu"]').first().click();
  const menu = page.locator('[role="menu"]').first();
  await menu.waitFor({ state: 'visible', timeout: 10000 });
  return menu;
}

const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext({ baseURL: BASE, viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'zh-CN' });
  await addCookie(context);
  const page = await context.newPage();
  page.on('pageerror', error => report.errors.push('pageerror:' + error.message));
  await page.goto('/merchant?ruda-app=merchant-admin-mobile&workspace=modagpt', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.locator('textarea').first().waitFor({ state: 'visible', timeout: 90000 });
  await page.waitForTimeout(1200);

  check('paneAndNav', await metrics(page));
  const handle = page.locator('button[aria-controls="merchant-bottom-navigation"]');
  const box = await handle.boundingBox();
  if (box) {
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x, y - 46, { steps: 6 });
    await page.mouse.up();
    for (const wait of [50, 150, 350, 800]) {
      await page.waitForTimeout(wait);
      check(`dragUpAfter+${wait}`, await metrics(page));
    }
  }

  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.locator('textarea').first().waitFor({ state: 'visible', timeout: 90000 });
  await page.waitForTimeout(800);
  await openMenu(page);
  await page.locator('[role="menuitem"]').filter({ hasText: /历史对话|Cronologia/ }).first().click();
  const history = page.locator('[role="dialog"][aria-label*="聊天历史"], [role="dialog"][aria-label*="Cronologia chat"]').first();
  await history.waitFor({ state: 'visible', timeout: 10000 });
  check('historyDialog', { visible: await history.isVisible(), text: (await history.innerText()).replace(/\s+/g, ' ').slice(0, 700) });
  await shot(page, 'mobile-390-history');

  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.locator('textarea').first().waitFor({ state: 'visible', timeout: 90000 });
  await page.waitForTimeout(800);
  await openMenu(page);
  await page.locator('[role="menuitem"]').filter({ hasText: /创作中心|Create/ }).first().click();
  await page.waitForTimeout(900);
  check('createSectionBody', {
    header: await page.locator('header').first().innerText(),
    body: (await page.locator('body').innerText()).replace(/\s+/g, ' ').slice(0, 1200)
  });


  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.locator('textarea').first().waitFor({ state: 'visible', timeout: 90000 });
  await page.waitForTimeout(800);
  await page.locator('textarea').first().click();
  const synthetic = await page.evaluate(async () => {
    const viewport = window.visualViewport;
    if (!viewport) return { supported: false };
    Object.defineProperty(viewport, 'height', { configurable: true, get: () => 500 });
    Object.defineProperty(viewport, 'offsetTop', { configurable: true, get: () => 0 });
    viewport.dispatchEvent(new Event('resize'));
    await new Promise(resolve => setTimeout(resolve, 500));
    const textarea = document.querySelector('textarea');
    let pane = null;
    let node = textarea;
    while (node) {
      if (getComputedStyle(node).position === 'fixed') { pane = node; break; }
      node = node.parentElement;
    }
    const paneRect = pane ? pane.getBoundingClientRect() : null;
    const textareaRect = textarea ? textarea.getBoundingClientRect() : null;
    const nav = document.querySelector('#merchant-bottom-navigation');
    return {
      supported: true,
      innerHeight: window.innerHeight,
      visualHeight: viewport.height,
      paneBottom: paneRect && Math.round(paneRect.bottom),
      textareaBottom: textareaRect && Math.round(textareaRect.bottom),
      paneInlineStyle: pane && pane.getAttribute('style'),
      navHidden: nav && nav.getAttribute('aria-hidden'),
      paneAboveKeyboard: Boolean(paneRect && paneRect.bottom <= viewport.height + 2),
      textareaAboveKeyboard: Boolean(textareaRect && textareaRect.bottom <= viewport.height + 2)
    };
  });
  check('syntheticVisualViewportInset', synthetic);
  await shot(page, 'mobile-390-visual-viewport-inset');
  await context.close();


  const desktopContext = await browser.newContext({ baseURL: BASE, viewport: { width: 1440, height: 900 }, locale: 'zh-CN' });
  await addCookie(desktopContext);
  const desktop = await desktopContext.newPage();
  desktop.on('pageerror', error => report.errors.push('desktop-pageerror:' + error.message));
  await desktop.goto('/merchant?ruda-app=merchant-admin-web', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await desktop.locator('#merchant-sidebar-tab-modagpt').waitFor({ state: 'visible', timeout: 90000 });
  await desktop.waitForTimeout(1200);
  check('desktop.portalShell', await desktop.evaluate(() => {
    const sidebar = document.querySelector('aside');
    const rect = sidebar ? sidebar.getBoundingClientRect() : null;
    return { sidebarWidth: rect ? Math.round(rect.width) : null, hasSidebarTab: Boolean(document.querySelector('#merchant-sidebar-tab-modagpt')), horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth };
  }));
  await shot(desktop, 'desktop-1440-portal');
  await desktop.locator('#merchant-sidebar-tab-modagpt').click();
  await desktop.getByRole('heading', { name: /服装创作|Creazione moda/i }).first().waitFor({ state: 'visible', timeout: 30000 });
  check('desktop.fashionStudioLanding', await desktop.evaluate(() => ({
    hasDesign: /服装设计|Design moda/.test(document.body.innerText),
    hasTryOn: /虚拟试衣|Virtual Try-On/.test(document.body.innerText),
    hasModel: /商业模特|Modelli moda/.test(document.body.innerText),
    hasRecolor: /服装换色|Ricolora capo/.test(document.body.innerText)
  })));
  await shot(desktop, 'desktop-1440-fashion-studio');
  await desktop.locator('article').filter({ hasText: /服装设计|Design moda/ }).locator('button').first().click();
  await desktop.waitForTimeout(700);
  const enterWorkspace = desktop.getByRole('button', { name: /进入 ModaUI 工作区|Apri area di lavoro ModaUI/i }).first();
  if (await enterWorkspace.count()) {
    await enterWorkspace.click();
  }
  await desktop.getByText('ModaUI', { exact: true }).first().waitFor({ state: 'visible', timeout: 30000 });
  await desktop.locator('textarea').first().waitFor({ state: 'visible', timeout: 30000 });
  await desktop.waitForTimeout(1000);
  check('desktop.aiWorkspace', await desktop.evaluate(() => {
    const main = document.querySelector('main');
    const rect = main ? main.getBoundingClientRect() : null;
    return {
      mainWidth: rect ? Math.round(rect.width) : null, mainHeight: rect ? Math.round(rect.height) : null,
      hasDragHandle: Boolean(document.querySelector('button[aria-controls="merchant-bottom-navigation"]')),
      hasBack: Boolean(document.querySelector('button[aria-label*="退出聊天"], button[aria-label*="Esci dalla chat"]')),
      hasMenu: Boolean(document.querySelector('button[aria-haspopup="menu"]')),
      textareaVisible: Boolean(document.querySelector('textarea')),
      horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth
    };
  }));
  const dmenu = await openMenu(desktop);
  check('desktop.menuItems', (await dmenu.locator('[role="menuitem"]').allTextContents()).map(item => item.trim()).filter(Boolean));
  await shot(desktop, 'desktop-1440-modaui-menu');
  await desktop.keyboard.press('Escape');
  await desktop.setViewportSize({ width: 1024, height: 768 });
  await desktop.waitForTimeout(500);
  check('desktop.resized1024', await desktop.evaluate(() => ({
    horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth,
    textareaVisible: Boolean(document.querySelector('textarea')),
    textareaBottom: (() => { const el = document.querySelector('textarea'); return el ? Math.round(el.getBoundingClientRect().bottom) : null; })(),
    viewportHeight: window.innerHeight
  })));
  await shot(desktop, 'desktop-1024-modaui');
  await desktop.locator('button[aria-label*="退出聊天"], button[aria-label*="Esci dalla chat"]').first().click();
  await desktop.waitForTimeout(700);
  check('desktop.backToStudio', await desktop.evaluate(() => ({ sidebarPresent: Boolean(document.querySelector('#merchant-sidebar-tab-modagpt')), heading: document.querySelector('h1')?.textContent || '' })));
  await desktopContext.close();
} catch (error) {
  report.fatal = error instanceof Error ? `${error.message}\n${error.stack}` : String(error);
  console.error('FATAL', report.fatal);
} finally {
  writeFileSync(`${OUT}/focused-report.json`, JSON.stringify({ ...report, finishedAt: new Date().toISOString() }, null, 2));
  console.log('REPORT', `${OUT}/focused-report.json`);
  await browser.close();
}

