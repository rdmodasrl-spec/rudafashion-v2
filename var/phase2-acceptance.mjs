import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const BASE = 'http://localhost:4187';
const OUT = '/www/wwwroot/ruda.fashion/var/phase2-evidence';
mkdirSync(OUT, { recursive: true });

const token = readFileSync('/tmp/ruda-phase2-token.txt', 'utf8').trim();
const report = { startedAt: new Date().toISOString(), checks: {}, screenshots: [], consoleErrors: [], failedResponses: [] };

function check(name, value) {
  report.checks[name] = value;
  console.log('CHECK', name, JSON.stringify(value));
}

async function addSessionCookie(context) {
  await context.addCookies([{
    name: 'ruda_merchant_jwt', value: token, domain: 'localhost', path: '/',
    httpOnly: true, secure: false, sameSite: 'Lax'
  }]);
}

function watchPage(page, label) {
  page.on('pageerror', error => report.consoleErrors.push(`${label}:pageerror:${error.message}`));
  page.on('console', message => {
    if (message.type() !== 'error') return;
    const text = message.text();
    if (!/Service Worker|sw\.js|manifest/i.test(text)) report.consoleErrors.push(`${label}:console:${text.slice(0, 300)}`);
  });
  page.on('response', response => {
    if (response.status() < 400) return;
    const url = response.url().replace(BASE, '');
    if (!/favicon|manifest|sw\.js|apple-touch/i.test(url)) report.failedResponses.push(`${label}:${response.status()}:${url}`);
  });
}

async function waitForComposer(page) {
  const textarea = page.locator('textarea').first();
  await textarea.waitFor({ state: 'visible', timeout: 90_000 });
  await page.waitForTimeout(1200);
  return textarea;
}

async function openMenu(page) {
  await page.locator('button[aria-haspopup="menu"]').first().click();
  const menu = page.locator('[role="menu"]').first();
  await menu.waitFor({ state: 'visible', timeout: 10_000 });
  return menu;
}

async function clickMenuItem(page, matcher) {
  const menu = await openMenu(page);
  await menu.locator('[role="menuitem"]').filter({ hasText: matcher }).first().click();
  await page.waitForTimeout(900);
}

async function navMetrics(page) {
  return page.evaluate(() => {
    const nav = document.querySelector('#merchant-bottom-navigation');
    const handle = document.querySelector('button[aria-controls="merchant-bottom-navigation"]');
    const pane = document.querySelector('#merchant-mobile-app-root > div.fixed.inset-x-0.top-0');
    const textarea = document.querySelector('textarea');
    const rect = element => {
      if (!element) return null;
      const value = element.getBoundingClientRect();
      return Object.fromEntries(['top', 'bottom', 'left', 'right', 'width', 'height'].map(key => [key, Math.round(value[key] * 10) / 10]));
    };
    return {
      innerHeight: window.innerHeight,
      innerWidth: window.innerWidth,
      visualHeight: window.visualViewport ? Math.round(window.visualViewport.height) : null,
      visualOffsetTop: window.visualViewport ? Math.round(window.visualViewport.offsetTop) : null,
      scrollWidth: document.documentElement.scrollWidth,
      navHidden: nav ? nav.getAttribute('aria-hidden') : null,
      navPointerEvents: nav ? getComputedStyle(nav).pointerEvents : null,
      navTransform: nav ? getComputedStyle(nav).transform : null,
      nav: rect(nav), handle: rect(handle), pane: rect(pane), textarea: rect(textarea),
      elementAtBottomCenter: (() => {
        const element = document.elementFromPoint(window.innerWidth / 2, window.innerHeight - 2);
        return element ? `${element.tagName}.${typeof element.className === 'string' ? element.className.slice(0, 60) : ''}` : null;
      })()
    };
  });
}

async function screenshot(page, name) {
  const file = `${OUT}/${name}.png`;
  await page.screenshot({ path: file, fullPage: false });
  report.screenshots.push(file);
}

const browser = await chromium.launch({ headless: true });
try {
  const mobileContext = await browser.newContext({
    baseURL: BASE, viewport: { width: 390, height: 844 }, deviceScaleFactor: 2,
    isMobile: true, hasTouch: true, locale: 'zh-CN'
  });
  await addSessionCookie(mobileContext);
  const mobile = await mobileContext.newPage();
  watchPage(mobile, 'mobile');

  await mobile.goto('/merchant?ruda-app=merchant-admin-mobile&workspace=modagpt', { waitUntil: 'domcontentloaded', timeout: 90_000 });
  await waitForComposer(mobile);
  await mobile.getByText('ModaUI', { exact: true }).first().waitFor({ state: 'visible' });
  check('mobile.session', await mobile.evaluate(() => ({
    title: document.title,
    app: document.documentElement.dataset.rudaApp,
    merchantSession: !document.body.innerText.includes('企业中心'),
    viewport: [window.innerWidth, window.innerHeight]
  })));

  const initial = await navMetrics(mobile);
  check('mobile.initialNavigation', initial);
  check('mobile.initialNavigationHidden', {
    hidden: initial.navHidden === 'true',
    translated: initial.nav ? initial.nav.top >= initial.innerHeight - 2 : false,
    paneFillsViewport: initial.pane ? Math.abs(initial.pane.bottom - initial.innerHeight) <= 2 : false,
    handleVisible: initial.handle ? initial.handle.height >= 16 && initial.handle.bottom <= initial.innerHeight : false,
    horizontalOverflow: initial.scrollWidth > initial.innerWidth
  });
  await screenshot(mobile, 'mobile-390-initial');

  const handle = mobile.locator('button[aria-controls="merchant-bottom-navigation"]');
  await handle.click();
  await mobile.waitForTimeout(500);
  const opened = await navMetrics(mobile);
  check('mobile.navigationAfterClickOpen', opened);
  check('mobile.navigationOpenContract', {
    hidden: opened.navHidden === 'false',
    navAtBottom: opened.nav ? Math.abs(opened.nav.bottom - opened.innerHeight) <= 2 : false,
    paneMeetsNav: Boolean(opened.pane && opened.nav && Math.abs(opened.pane.bottom - opened.nav.top) <= 2),
    navAboveHandle: Boolean(opened.nav && opened.handle && opened.nav.top >= opened.handle.bottom - 2)
  });
  await screenshot(mobile, 'mobile-390-nav-open');

  await handle.click();
  await mobile.waitForTimeout(450);
  const closedByClick = await navMetrics(mobile);
  check('mobile.navigationAfterClickClose', {
    hidden: closedByClick.navHidden === 'true',
    translated: closedByClick.nav.top >= closedByClick.innerHeight - 2
  });

  const dragBox = await handle.boundingBox();
  if (dragBox) {
    const x = dragBox.x + dragBox.width / 2;
    const y = dragBox.y + dragBox.height / 2;
    await mobile.mouse.move(x, y);
    await mobile.mouse.down();
    await mobile.mouse.move(x, y - 46, { steps: 6 });
    await mobile.mouse.up();
    await mobile.waitForTimeout(450);
    const dragOpen = await navMetrics(mobile);
    check('mobile.navigationAfterDragUp', { hidden: dragOpen.navHidden === 'false', navTop: dragOpen.nav && dragOpen.nav.top });
    await mobile.mouse.move(x, y - 46);
    await mobile.mouse.down();
    await mobile.mouse.move(x, y, { steps: 6 });
    await mobile.mouse.up();
    await mobile.waitForTimeout(450);
    const dragClose = await navMetrics(mobile);
    check('mobile.navigationAfterDragDown', { hidden: dragClose.navHidden === 'true', navTop: dragClose.nav && dragClose.nav.top });
  }

  await handle.click();
  await mobile.waitForTimeout(350);
  await mobile.locator('textarea').first().click();
  await mobile.waitForTimeout(450);
  const focusClosed = await navMetrics(mobile);
  check('mobile.navigationClosesOnComposerFocus', {
    hidden: focusClosed.navHidden === 'true',
    paneFillsViewport: focusClosed.pane ? Math.abs(focusClosed.pane.bottom - focusClosed.innerHeight) <= 2 : false
  });

  let keyboardSimulation = { method: 'none' };
  try {
    const cdp = await mobileContext.newCDPSession(mobile);
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      mobile: true, width: 390, height: 844, deviceScaleFactor: 2,
      screenWidth: 390, screenHeight: 844,
      viewport: { x: 0, y: 0, width: 390, height: 500, scale: 1 }
    });
    await mobile.waitForTimeout(600);
    const simulated = await navMetrics(mobile);
    keyboardSimulation = { method: 'cdp-visual-viewport', ...simulated };
    check('mobile.keyboardInsetSimulation', {
      visualHeight: simulated.visualHeight,
      paneBottom: simulated.pane && simulated.pane.bottom,
      textareaBottom: simulated.textarea && simulated.textarea.bottom,
      navHidden: simulated.navHidden,
      paneAboveKeyboard: Boolean(simulated.pane && simulated.visualHeight && simulated.pane.bottom <= simulated.visualHeight + 2),
      textareaAboveKeyboard: Boolean(simulated.textarea && simulated.visualHeight && simulated.textarea.bottom <= simulated.visualHeight + 2)
    });
    await screenshot(mobile, 'mobile-390-keyboard-inset');
    await cdp.send('Emulation.clearDeviceMetricsOverride');
  } catch (error) {
    keyboardSimulation = { method: 'cdp-failed', message: error instanceof Error ? error.message : String(error) };
    check('mobile.keyboardInsetSimulation', keyboardSimulation);
  }
  report.keyboardSimulation = keyboardSimulation;
  await mobile.setViewportSize({ width: 390, height: 844 });
  await mobile.waitForTimeout(400);


  const widths = [];
  for (const width of [320, 360, 390, 430]) {
    await mobile.setViewportSize({ width, height: 844 });
    await mobile.waitForTimeout(350);
    const metrics = await navMetrics(mobile);
    widths.push({
      width,
      overflow: metrics.scrollWidth > width,
      navHidden: metrics.navHidden === 'true',
      handleWidth: metrics.handle && metrics.handle.width,
      handleInside: Boolean(metrics.handle && metrics.handle.left >= 0 && metrics.handle.right <= width),
      paneFills: Boolean(metrics.pane && Math.abs(metrics.pane.bottom - metrics.innerHeight) <= 2)
    });
    if (width === 320) await screenshot(mobile, 'mobile-320-initial');
  }
  check('mobile.responsiveWidths', widths);

  await mobile.setViewportSize({ width: 390, height: 844 });
  await mobile.waitForTimeout(400);
  check('mobile.quickActions', await mobile.evaluate(() => {
    const buttons = [...document.querySelectorAll('.ruda-ai-suggestions button')];
    return buttons.map(button => {
      const rect = button.getBoundingClientRect();
      return { label: button.innerText.trim(), left: Math.round(rect.left), right: Math.round(rect.right), width: Math.round(rect.width), complete: rect.left >= 0 && rect.right <= window.innerWidth + 0.5 };
    });
  }));
  await screenshot(mobile, 'mobile-390-quick-actions');
  await mobile.locator('.ruda-ai-suggestions button').filter({ hasText: /服装设计|Design moda/ }).first().click();
  await mobile.waitForTimeout(500);
  check('mobile.quickActionDesign', await mobile.evaluate(() => ({
    prompt: document.querySelector('textarea')?.value.slice(0, 80) || '',
    hasDesignPanel: /多方案概念图|Concept multipli/.test(document.body.innerText),
    hasFashionMode: /服装设计|Design moda/.test(document.body.innerText)
  })));
  await screenshot(mobile, 'mobile-390-quick-design');
  await mobile.reload({ waitUntil: 'domcontentloaded' });
  await waitForComposer(mobile);

  const menu = await openMenu(mobile);
  check('mobile.menuPanel', await menu.evaluate(element => {
    const rect = element.getBoundingClientRect();
    const items = [...element.querySelectorAll('[role="menuitem"]')];
    const last = items[items.length - 1];
    return {
      top: Math.round(rect.top), bottom: Math.round(rect.bottom), height: Math.round(rect.height),
      width: Math.round(rect.width), viewportHeight: window.innerHeight,
      scrollHeight: element.scrollHeight, clientHeight: element.clientHeight,
      innerScroll: element.scrollHeight > element.clientHeight + 1,
      lastItemVisible: Boolean(last && last.getBoundingClientRect().bottom <= rect.bottom + 0.5)
    };
  }));
  const items = (await menu.locator('[role="menuitem"]').allTextContents()).map(item => item.trim()).filter(Boolean);
  check('mobile.menuItems', items);
  check('mobile.menuInventory', {
    count: items.length,
    hasNewConversation: items.some(item => /新建对话|Nuova conversazione/.test(item)),
    hasHistory: items.some(item => /历史对话|Cronologia/.test(item)),
    hasCreate: items.some(item => /创作中心|Create/.test(item)),
    hasDesigns: items.some(item => /我的作品|I miei contenuti/.test(item)),
    hasRecolor: items.some(item => /服装换色|Ricolora capo/.test(item)),
    hasModel: items.some(item => /商业模特|Modelli moda/.test(item)),
    hasKnowledge: items.some(item => /店铺知识库|Knowledge base/.test(item)),
    hasPricing: items.some(item => /套餐与额度|Piani e crediti/.test(item)),
    hasLogout: items.some(item => /退出登录|Sign out/.test(item))
  });
  await screenshot(mobile, 'mobile-390-menu');
  await mobile.keyboard.press('Escape');
  await mobile.waitForTimeout(300);

  await clickMenuItem(mobile, /创作中心|Create/);
  check('mobile.createSection', await mobile.evaluate(() => ({
    header: document.querySelector('header')?.innerText.trim(),
    hasDesign: /服装设计|Design moda/.test(document.body.innerText),
    hasGenerate: /图片生成|Genera immagini/.test(document.body.innerText),
    hasTryOn: /虚拟试衣|Virtual Try-On/.test(document.body.innerText),
    hasRecolor: /服装换色|Ricolora capo/.test(document.body.innerText),
    hasModel: /商业模特|Modelli moda/.test(document.body.innerText)
  })));
  await screenshot(mobile, 'mobile-390-create');

  await mobile.reload({ waitUntil: 'domcontentloaded' });
  await waitForComposer(mobile);
  await clickMenuItem(mobile, /我的作品|I miei contenuti/);
  check('mobile.designsSection', await mobile.evaluate(() => ({
    header: document.querySelector('header')?.innerText.trim(),
    bodyMentionsPortfolio: /作品|contenuti|portfolio|暂无/i.test(document.body.innerText)
  })));

  await mobile.reload({ waitUntil: 'domcontentloaded' });
  await waitForComposer(mobile);
  await clickMenuItem(mobile, /店铺知识库|Knowledge base/);
  check('mobile.knowledgeSection', await mobile.evaluate(() => ({
    header: document.querySelector('header')?.innerText.trim(),
    bodyMentionsKnowledge: /知识库|Knowledge base/i.test(document.body.innerText)
  })));

  await mobile.reload({ waitUntil: 'domcontentloaded' });
  await waitForComposer(mobile);
  await clickMenuItem(mobile, /套餐与额度|Piani e crediti/);
  const pricingDialog = mobile.locator('[role="dialog"]').filter({ hasText: /套餐|Piani/ }).first();
  await pricingDialog.waitFor({ state: 'visible', timeout: 15_000 });
  check('mobile.pricingDialog', { visible: await pricingDialog.isVisible(), text: (await pricingDialog.innerText()).replace(/\s+/g, ' ').slice(0, 500) });
  await screenshot(mobile, 'mobile-390-pricing');
  const closePricing = pricingDialog.locator('button[aria-label*="关闭"], button[aria-label*="Chiudi"]').first();
  if (await closePricing.count()) await closePricing.click();

  await mobile.reload({ waitUntil: 'domcontentloaded' });
  await waitForComposer(mobile);
  await clickMenuItem(mobile, /服装换色|Ricolora capo/);
  check('mobile.recolorFlow', await mobile.evaluate(() => ({
    header: document.querySelector('header')?.innerText.trim(),
    mentionsRecolor: /换色|Ricolora/.test(document.body.innerText),
    mentionsSelect: /涂选|Selezione/.test(document.body.innerText)
  })));

  await mobile.reload({ waitUntil: 'domcontentloaded' });
  await waitForComposer(mobile);
  await clickMenuItem(mobile, /商业模特|Modelli moda/);
  check('mobile.commercialModelFlow', await mobile.evaluate(() => ({
    header: document.querySelector('header')?.innerText.trim(),
    mentionsModel: /模特|Modelli/.test(document.body.innerText),
    mentionsScene: /场景|scena/i.test(document.body.innerText)
  })));

  await mobile.reload({ waitUntil: 'domcontentloaded' });
  await waitForComposer(mobile);
  await clickMenuItem(mobile, /新建对话|Nuova conversazione/);
  check('mobile.newConversation', await mobile.evaluate(() => ({
    greetingVisible: /今天想做什么|Cosa vuoi fare oggi/.test(document.body.innerText),
    messagesCleared: !document.querySelector('[aria-live="polite"]')
  })));


  const chatComposer = await waitForComposer(mobile);
  const prompt = 'Rispondi soltanto con OK.';
  await chatComposer.fill(prompt);
  await mobile.locator('button[aria-label*="发送消息"], button[aria-label*="Invia messaggio"]').first().click();
  const chatResult = { prompt, assistantText: '', error: '', elapsedMs: 0 };
  const started = Date.now();
  try {
    await mobile.waitForFunction(expected => {
      const live = document.querySelector('[aria-live="polite"]');
      if (!live) return false;
      const text = live.textContent || '';
      return text.includes(expected) && text.length > expected.length + 15 && !document.querySelector('[role="status"]');
    }, prompt, { timeout: 120_000, polling: 750 });
    chatResult.elapsedMs = Date.now() - started;
    chatResult.assistantText = (await mobile.locator('[aria-live="polite"]').innerText()).replace(/\s+/g, ' ').slice(0, 800);
    const alert = mobile.locator('[role="alert"]').first();
    if (await alert.count()) chatResult.error = (await alert.innerText()).slice(0, 300);
  } catch (error) {
    chatResult.elapsedMs = Date.now() - started;
    chatResult.error = error instanceof Error ? error.message : String(error);
    chatResult.assistantText = (await mobile.locator('[aria-live="polite"]').innerText().catch(() => '')).replace(/\s+/g, ' ').slice(0, 800);
  }
  check('mobile.realChat', chatResult);
  await screenshot(mobile, 'mobile-390-chat-result');

  await clickMenuItem(mobile, /历史对话|Cronologia/);
  const history = mobile.locator('[role="dialog"][aria-label*="聊天历史"], [role="dialog"][aria-label*="Cronologia chat"]').first();
  try {
    await history.waitFor({ state: 'visible', timeout: 4_000 });
  } catch {
    await clickMenuItem(mobile, /历史对话|Cronologia/);
    await history.waitFor({ state: 'visible', timeout: 10_000 });
  }
  const historyText = (await history.innerText()).replace(/\s+/g, ' ').slice(0, 600);
  check('mobile.historyAfterChat', {
    visible: await history.isVisible(),
    hasConversation: /Rispondi|OK|conversaz/i.test(historyText),
    text: historyText
  });
  await screenshot(mobile, 'mobile-390-history');
  await mobileContext.close();

  const desktopContext = await browser.newContext({ baseURL: BASE, viewport: { width: 1440, height: 900 }, locale: 'zh-CN' });
  await addSessionCookie(desktopContext);
  const desktop = await desktopContext.newPage();
  watchPage(desktop, 'desktop');
  await desktop.goto('/merchant?ruda-app=merchant-admin-web', { waitUntil: 'domcontentloaded', timeout: 90_000 });
  await desktop.locator('#merchant-sidebar-tab-modagpt').waitFor({ state: 'visible', timeout: 90_000 });
  await desktop.waitForTimeout(1200);
  check('desktop.portalShell', await desktop.evaluate(() => {
    const sidebar = document.querySelector('aside');
    const rect = sidebar ? sidebar.getBoundingClientRect() : null;
    return {
      sidebarWidth: rect ? Math.round(rect.width) : null,
      hasSidebarTab: Boolean(document.querySelector('#merchant-sidebar-tab-modagpt')),
      horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth,
      viewportWidth: window.innerWidth
    };
  }));
  await screenshot(desktop, 'desktop-1440-portal');


  await desktop.locator('#merchant-sidebar-tab-modagpt').click();
  await desktop.getByRole('heading', { name: /服装创作|Creazione moda/i }).first().waitFor({ state: 'visible', timeout: 30_000 });
  check('desktop.fashionStudioLanding', await desktop.evaluate(() => ({
    hasDesign: /服装设计|Design moda/.test(document.body.innerText),
    hasTryOn: /虚拟试衣|Virtual Try-On/.test(document.body.innerText),
    hasModel: /商业模特|Modelli moda/.test(document.body.innerText),
    hasRecolor: /服装换色|Ricolora capo/.test(document.body.innerText)
  })));
  await screenshot(desktop, 'desktop-1440-fashion-studio');

  await desktop.locator('article').filter({ hasText: /服装设计|Design moda/ }).locator('button').first().click();
  await desktop.waitForTimeout(800);
  const desktopEnter = desktop.getByRole('button', { name: /进入 ModaUI 工作区|Apri area di lavoro ModaUI/i }).first();
  if (await desktopEnter.count()) await desktopEnter.click();
  await desktop.getByText('ModaUI', { exact: true }).first().waitFor({ state: 'visible', timeout: 30_000 });
  await desktop.locator('textarea').first().waitFor({ state: 'visible', timeout: 30_000 });
  await desktop.waitForTimeout(1000);
  check('desktop.aiWorkspace', await desktop.evaluate(() => {
    const main = document.querySelector('textarea')?.closest('main');
    const rect = main ? main.getBoundingClientRect() : null;
    return {
      mainWidth: rect ? Math.round(rect.width) : null,
      mainHeight: rect ? Math.round(rect.height) : null,
      stillOnCreateSection: /进入 ModaUI 工作区/.test(document.body.innerText),
      quickActions: [...document.querySelectorAll('.ruda-ai-suggestions button')].map(button => button.innerText.trim()),
      hasDragHandle: Boolean(document.querySelector('button[aria-controls="merchant-bottom-navigation"]')),
      hasBack: Boolean(document.querySelector('button[aria-label*="退出聊天"], button[aria-label*="Esci dalla chat"]')),
      hasMenu: Boolean(document.querySelector('button[aria-haspopup="menu"]')),
      textareaVisible: Boolean(document.querySelector('textarea')),
      horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth
    };
  }));
  const desktopMenu = await openMenu(desktop);
  check('desktop.menuItems', (await desktopMenu.locator('[role="menuitem"]').allTextContents()).map(item => item.trim()).filter(Boolean));
  await screenshot(desktop, 'desktop-1440-modaui-menu');
  await desktop.keyboard.press('Escape');

  await desktop.setViewportSize({ width: 1024, height: 768 });
  await desktop.waitForTimeout(500);
  check('desktop.resized1024', await desktop.evaluate(() => ({
    horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth,
    textareaVisible: Boolean(document.querySelector('textarea')),
    textareaBottom: (() => { const el = document.querySelector('textarea'); return el ? Math.round(el.getBoundingClientRect().bottom) : null; })(),
    viewportHeight: window.innerHeight
  })));
  await screenshot(desktop, 'desktop-1024-modaui');

  await desktop.locator('button[aria-label*="退出聊天"], button[aria-label*="Esci dalla chat"]').first().click();
  await desktop.waitForTimeout(700);
  check('desktop.backToStudio', await desktop.evaluate(() => ({
    sidebarPresent: Boolean(document.querySelector('#merchant-sidebar-tab-modagpt')),
    heading: document.querySelector('h1')?.textContent || ''
  })));
  await desktopContext.close();
} catch (error) {
  report.fatal = error instanceof Error ? `${error.message}\n${error.stack}` : String(error);
  console.error('FATAL', report.fatal);
} finally {
  report.finishedAt = new Date().toISOString();
  report.consoleErrors = [...new Set(report.consoleErrors)].slice(0, 50);
  report.failedResponses = [...new Set(report.failedResponses)].slice(0, 50);
  writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 2));
  console.log('REPORT', `${OUT}/report.json`);
  await browser.close();
}

