import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const BASE = process.env.BASE || 'http://localhost:3000';
const BUILD = '/tmp/ruda-modaui-build';
const OUT = '/www/wwwroot/ruda.fashion/var/phase2-evidence';
mkdirSync(OUT, { recursive: true });
const token = readFileSync('/tmp/ruda-phase2-token.txt', 'utf8').trim();
const report = { base: BASE, startedAt: new Date().toISOString(), checks: {}, screenshots: [], errors: [] };
const check = (name, value) => { report.checks[name] = value; console.log('CHECK', name, JSON.stringify(value)); };
const shot = async (page, name) => { const file = `${OUT}/${name}.png`; await page.screenshot({ path: file }); report.screenshots.push(file); };

const assetIndex = new Map();
for (const dir of ['', 'assets', 'chunks']) {
  const full = path.join(BUILD, dir);
  for (const entry of readdirSync(full, { withFileTypes: true })) {
    if (entry.isFile()) assetIndex.set(entry.name, path.join(full, entry.name));
  }
}
const contentType = name => name.endsWith('.css') ? 'text/css' : name.endsWith('.js') ? 'application/javascript' : name.endsWith('.woff2') ? 'font/woff2' : name.endsWith('.woff') ? 'font/woff' : 'application/octet-stream';
const freshCss = readdirSync(path.join(BUILD, 'assets')).find(name => name.endsWith('.css')) || '';

async function injectFreshBundle(page) {
  await page.route(/\/apps\/merchant-admin-mobile\/releases\/[^/]+\/(.+)$/, async route => {
    const name = path.basename(new URL(route.request().url()).pathname);
    const file = assetIndex.get(name) || (name.endsWith('.css') && freshCss ? assetIndex.get(freshCss) : undefined);
    if (!file) { await route.continue(); return; }
    await route.fulfill({ status: 200, contentType: contentType(name), body: readFileSync(file) });
  });
}

async function addCookie(context) {
  await context.addCookies([{ name: 'ruda_merchant_jwt', value: token, domain: 'localhost', path: '/', httpOnly: true, secure: false, sameSite: 'Lax' }]);
}

const dock = page => page.evaluate(() => {
  const textarea = document.querySelector('textarea');
  const pills = [...document.querySelectorAll('.ruda-ai-suggestions button')];
  const composer = document.querySelector('.ruda-ai-composer');
  const handle = document.querySelector('button[aria-controls="merchant-bottom-navigation"]');
  const nav = document.querySelector('#merchant-bottom-navigation');
  const rect = element => { if (!element) return null; const r = element.getBoundingClientRect(); return { top: Math.round(r.top), bottom: Math.round(r.bottom), height: Math.round(r.height) }; };
  return {
    pillLabels: pills.map(node => (node.textContent || '').trim()),
    pillPressed: pills.map(node => node.getAttribute('aria-pressed')),
    gearCount: document.querySelectorAll('.ruda-ai-suggestions button[aria-expanded]').length,
    footerTaskPill: /执行任务|任务模式已开启/.test((document.querySelector('footer') || document.body).innerText),
    textareaHeight: textarea ? Math.round(textarea.getBoundingClientRect().height) : null,
    textareaResize: textarea ? getComputedStyle(textarea).resize : null,
    composer: rect(composer), handle: rect(handle), nav: rect(nav),
    navAriaHidden: nav ? nav.getAttribute('aria-hidden') : null,
    panelOpen: Boolean(document.querySelector('[role="dialog"]')),
    horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth
  };
});

const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext({ baseURL: BASE, viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'zh-CN', serviceWorkers: 'block' });
  await addCookie(context);
  const page = await context.newPage();
  page.on('pageerror', error => report.errors.push('pageerror:' + error.message));
  await injectFreshBundle(page);
  await page.goto('/merchant?ruda-app=merchant-admin-mobile&workspace=modagpt', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.locator('textarea').first().waitFor({ state: 'visible', timeout: 90000 });
  await page.waitForTimeout(1800);
  check('defaultDock', await dock(page));
  await shot(page, 'modaui-dock-mobile-default');

  const handleBox = await page.locator('button[aria-controls="merchant-bottom-navigation"]').first().boundingBox();
  if (handleBox) {
    const centerX = handleBox.x + handleBox.width / 2;
    const centerY = handleBox.y + handleBox.height / 2;
    await page.mouse.move(centerX, centerY);
    await page.mouse.down();
    await page.mouse.move(centerX, centerY - 70, { steps: 6 });
    await page.mouse.up();
    await page.waitForTimeout(500);
    check('navAfterDragUp', await page.evaluate(() => {
      const nav = document.querySelector('#merchant-bottom-navigation');
      return { ariaHidden: nav ? nav.getAttribute('aria-hidden') : null, top: nav ? Math.round(nav.getBoundingClientRect().top) : null };
    }));
    await shot(page, 'modaui-nav-open-mobile');
    await page.mouse.move(centerX, centerY - 60);
    await page.mouse.down();
    await page.mouse.move(centerX, centerY + 10, { steps: 6 });
    await page.mouse.up();
    await page.waitForTimeout(500);
    check('navAfterDragDown', await page.evaluate(() => {
      const nav = document.querySelector('#merchant-bottom-navigation');
      return { ariaHidden: nav ? nav.getAttribute('aria-hidden') : null, top: nav ? Math.round(nav.getBoundingClientRect().top) : null };
    }));
  } else {
    check('navAfterDragUp', { error: 'handle not found' });
  }

  await page.locator('.ruda-ai-suggestions button', { hasText: /虚拟试衣|Prova virtuale/ }).first().click();
  await page.waitForTimeout(600);
  check('modeSheet', await page.evaluate(() => {
    const dialog = document.querySelector('[role="dialog"]');
    const buttons = dialog ? [...dialog.querySelectorAll('button')] : [];
    const last = buttons[buttons.length - 1];
    return {
      open: Boolean(dialog),
      label: dialog ? dialog.getAttribute('aria-label') : null,
      hasUpload: /人物照片|Foto persona/.test(dialog ? dialog.innerText : ''),
      gearExpanded: document.querySelector('.ruda-ai-suggestions button[aria-expanded]')?.getAttribute('aria-expanded') || null,
      sheetBottom: dialog ? Math.round(dialog.getBoundingClientRect().bottom) : null,
      sheetPaddingBottom: dialog ? getComputedStyle(dialog).paddingBottom : null,
      lastButtonGap: dialog && last ? Math.round(dialog.getBoundingClientRect().bottom - last.getBoundingClientRect().bottom) : null
    };
  }));
  await shot(page, 'modaui-mode-sheet-mobile');
  await page.locator('[role="dialog"] button', { hasText: /完成|Fatto/ }).first().click();
  await page.waitForTimeout(400);
  check('afterSheetClose', await dock(page));

  await page.locator('button[aria-haspopup="menu"]').first().click();
  const menu = page.locator('[role="menu"]').first();
  await menu.waitFor({ state: 'visible', timeout: 10000 });
  check('menu', {
    groups: (await menu.locator('p').allTextContents()).map(item => item.trim()),
    items: (await menu.locator('[role^="menuitem"]').allTextContents()).map(item => item.trim()).filter(Boolean)
  });
  await shot(page, 'modaui-menu-mobile');
  await menu.locator('[role="menuitemcheckbox"]').click();
  await page.waitForTimeout(400);
  check('taskModeOn', {
    ...await dock(page),
    chip: await page.locator('footer button[aria-label="关闭任务模式"]').first().innerText().catch(() => null),
    placeholder: await page.locator('textarea').first().getAttribute('placeholder')
  });
  await shot(page, 'modaui-task-on-mobile');
  await page.locator('.ruda-ai-suggestions button', { hasText: /服装设计|Design abbigliamento/ }).first().click();
  await page.waitForTimeout(500);
  check('taskModeOffAfterPill', {
    chipCount: await page.locator('footer button[aria-label="关闭任务模式"]').count(),
    placeholder: await page.locator('textarea').first().getAttribute('placeholder'),
    pressedPills: await page.locator('.ruda-ai-suggestions button[aria-pressed="true"]').allTextContents()
  });
  await shot(page, 'modaui-task-off-pill-mobile');
  await page.setViewportSize({ width: 320, height: 700 });
  await page.waitForTimeout(500);
  check('narrowDock320', await page.evaluate(() => {
    const row = document.querySelector('.ruda-ai-suggestions');
    const buttons = row ? [...row.querySelectorAll('button')] : [];
    return {
      rowScrollWidth: row ? Math.round(row.scrollWidth) : null,
      rowClientWidth: row ? Math.round(row.clientWidth) : null,
      buttons: buttons.map(node => { const r = node.getBoundingClientRect(); return { left: Math.round(r.left), right: Math.round(r.right), width: Math.round(r.width) }; }),
      horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth,
      composerBottom: document.querySelector('.ruda-ai-composer') ? Math.round(document.querySelector('.ruda-ai-composer').getBoundingClientRect().bottom) : null
    };
  }));
  await shot(page, 'modaui-narrow-320-mobile');
  await context.close();

  const desktopContext = await browser.newContext({ baseURL: BASE, viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, locale: 'zh-CN', serviceWorkers: 'block' });
  await addCookie(desktopContext);
  const desktop = await desktopContext.newPage();
  desktop.on('pageerror', error => report.errors.push('desktop-pageerror:' + error.message));
  await injectFreshBundle(desktop);
  await desktop.goto('/merchant?ruda-app=merchant-admin-mobile&workspace=modagpt', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await desktop.locator('textarea').first().waitFor({ state: 'visible', timeout: 90000 });
  await desktop.waitForTimeout(1400);
  check('desktopDock', await dock(desktop));
  await desktop.locator('.ruda-ai-suggestions button', { hasText: /虚拟试衣|Prova virtuale/ }).first().click();
  await desktop.waitForTimeout(500);
  check('desktopSheet', await desktop.evaluate(() => {
    const dialog = document.querySelector('[role="dialog"]');
    return { open: Boolean(dialog), width: dialog ? Math.round(dialog.getBoundingClientRect().width) : null, left: dialog ? Math.round(dialog.getBoundingClientRect().left) : null };
  }));
  await shot(desktop, 'modaui-mode-sheet-desktop');
  await desktopContext.close();
} catch (error) {
  report.fatal = error instanceof Error ? `${error.message}\n${error.stack}` : String(error);
  console.error('FATAL', report.fatal);
} finally {
  writeFileSync(`${OUT}/modaui-dock-report.json`, JSON.stringify({ ...report, finishedAt: new Date().toISOString() }, null, 2));
  console.log('REPORT', `${OUT}/modaui-dock-report.json`);
  await browser.close();
}

