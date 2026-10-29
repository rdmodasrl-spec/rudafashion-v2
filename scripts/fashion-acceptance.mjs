import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';

const BASE = process.env.FASHION_BASE_URL || 'http://127.0.0.1:3000';
const OUT = process.env.FASHION_SHOT_DIR || '/tmp/fashion-shots';
// Seed a temporary approved post + product link to exercise the product-card and
// deep-link assertions; see docs/engineering/modules/fashion-community-upgrade.md §15.
const TEST_POST_ID = process.env.FASHION_TEST_POST_ID || '';
const DEEP_LINK = TEST_POST_ID ? `${BASE}/trends?post=${TEST_POST_ID}` : `${BASE}/trends`;
const CREATOR = process.env.FASHION_TEST_CREATOR_ID || 'fashion-account-344ffd21-0c2e-4dc5-badc-245652c66dab';
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({ args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const report = { checks: [], consoleErrors: [] };

const record = (name, ok, detail = '') => report.checks.push({ name, ok, detail });

async function run({ label, width, height, mobile }) {
  const ctx = await browser.newContext({
    viewport: { width, height },
    locale: 'zh-CN',
    isMobile: mobile,
    hasTouch: mobile,
    deviceScaleFactor: 1
  });
  const page = await ctx.newPage();
  page.on('console', msg => { if (msg.type() === 'error') report.consoleErrors.push(`[${label}] ${msg.text().slice(0, 300)}`); });
  page.on('pageerror', err => report.consoleErrors.push(`[${label}] pageerror ${err.message.slice(0, 300)}`));

  await page.goto(`${BASE}/trends`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1600);
  // Site-wide analytics consent (anonymous). Dismiss so it cannot intercept clicks.
  const consentReject = page.getByRole('button', { name: '拒绝' }).last();
  if (await consentReject.count()) {
    await consentReject.click();
    await page.waitForTimeout(400);
  }
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${OUT}/${label}-01-trends.png`, fullPage: false });
  record(`${label}: trends page renders`, (await page.locator('text=风格与趋势').count()) > 0);

  await page.goto(`${DEEP_LINK}`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('article[data-feed-id]', { timeout: 20000 }).catch(() => null);
  await page.waitForTimeout(2200);
  await page.screenshot({ path: `${OUT}/${label}-02-feed.png` });
  const activePostId = await page.evaluate(() => {
    const cards = [...document.querySelectorAll('article[data-feed-id]')];
    const active = cards.find(el => Math.abs(el.getBoundingClientRect().top) < 40);
    return active ? active.getAttribute('data-feed-id') : '';
  });
  record(`${label}: post deep link opens the matching post`, TEST_POST_ID ? activePostId === TEST_POST_ID : true, activePostId || 'no test post configured');

  const productPill = page.getByRole('button', { name: /RDM-DC597FA4-BAG/ }).first();
  const productPillCount = await productPill.count();
  record(`${label}: feed shows linked product card`, TEST_POST_ID ? productPillCount > 0 : true, TEST_POST_ID ? '' : 'skipped: FASHION_TEST_POST_ID not set');
  if (productPillCount) {
    await page.screenshot({ path: `${OUT}/${label}-06-product-pill.png` });
  }

  const commentButton = page.locator('button[aria-label="打开评论"]').first();
  if (await commentButton.count()) {
    await commentButton.click();
    await page.waitForTimeout(1400);
    await page.screenshot({ path: `${OUT}/${label}-03-comments.png` });
    record(`${label}: comments sheet opens`, (await page.locator('section[aria-label="评论"]').count()) > 0);
    const close = page.locator('button[aria-label="关闭评论"]').first();
    if (await close.count()) await close.click();
    await page.waitForTimeout(600);
  }

  const moreButton = page.locator('button[aria-label="更多操作"]').first();
  if (await moreButton.count()) {
    await moreButton.click();
    await page.waitForTimeout(400);
    const reportItem = page.getByRole('menuitem', { name: '举报内容' });
    if (await reportItem.count()) {
      await reportItem.click();
      await page.waitForTimeout(700);
      await page.screenshot({ path: `${OUT}/${label}-04-report.png` });
      record(`${label}: report dialog opens with reason options`, (await page.locator('#fashion-report-reason option').count()) >= 5);
      const close = page.locator('button[aria-label="关闭"]').first();
      if (await close.count()) await close.click();
      await page.waitForTimeout(400);
    }
  }

  await page.goto(`${BASE}/creators/${CREATOR}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2600);
  await page.screenshot({ path: `${OUT}/${label}-05-creator.png` });
  record(`${label}: creator page loads real profile`, (await page.locator('text=modaui').count()) > 0);

  if (productPillCount) {
    await page.goto(`${DEEP_LINK}`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2800);
    const pill = page.locator('button:has-text("RDM-DC597FA4-BAG")').first();
    if (await pill.count()) {
      await pill.click();
      await page.waitForTimeout(1800);
      await page.screenshot({ path: `${OUT}/${label}-07-product-detail.png` });
      record(`${label}: product card navigates to product detail`, !page.url().includes('/trends'));
    }
  }

  // Stage 4 season filter: archive card -> feed overlay -> filter panel -> 夏季 -> 查看内容
  const seasonRequests = [];
  const seasonListener = request => {
    if (request.url().includes('/api/fashion/posts?') && request.url().includes('season=')) seasonRequests.push(request.url());
  };
  page.on('request', seasonListener);
  await page.goto(`${BASE}/trends`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1800);
  const archiveCard = page.locator('main button').filter({ has: page.locator('img') }).first();
  if (await archiveCard.count()) {
    await archiveCard.click();
    await page.waitForTimeout(1600);
    const filterToggle = page.locator('button[aria-label="城市、分类和季节筛选"], button[aria-label="Filtri città, categoria e stagione"]').first();
    if (await filterToggle.count()) {
      await filterToggle.click();
      await page.waitForTimeout(500);
      const summerChip = page.getByRole('button', { name: '夏季', exact: true }).first();
      const winterChip = page.getByRole('button', { name: '冬季', exact: true }).first();
      const allSeasons = page.getByRole('button', { name: '全部季节', exact: true }).first();
      record(`${label}: season filter lists four seasons`, (await summerChip.count()) === 1 && (await winterChip.count()) === 1 && (await allSeasons.count()) === 1);
      if (await summerChip.count()) {
        await summerChip.click();
        await page.waitForTimeout(300);
        record(`${label}: season chip selects 夏季`, (await summerChip.getAttribute('aria-pressed')) === 'true');
        await page.screenshot({ path: `${OUT}/${label}-08-season-filter.png` });
        const applyFilters = page.getByRole('button', { name: '查看内容', exact: true }).first();
        if (await applyFilters.count()) {
          await applyFilters.click();
          await page.waitForTimeout(1800);
          record(`${label}: applying season reloads feed with season param`, seasonRequests.length > 0, seasonRequests[0] || 'no season request observed');
        }
      }
    } else {
      record(`${label}: season filter toggle reachable`, false, 'filter toggle not found');
    }
  } else {
    record(`${label}: season filter reachable`, false, 'no archive card available');
  }
  page.off('request', seasonListener);

  await ctx.close();
}

try {
  await run({ label: 'desktop', width: 1440, height: 900, mobile: false });
  await run({ label: 'mobile', width: 390, height: 844, mobile: true });
} finally {
  await browser.close();
  await writeFile(`${OUT}/report.json`, JSON.stringify(report, null, 2), 'utf8');
  console.log(JSON.stringify(report, null, 2));
}
