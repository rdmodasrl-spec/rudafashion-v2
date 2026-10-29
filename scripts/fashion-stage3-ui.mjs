import 'dotenv/config';
import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

const prisma = new PrismaClient();
const secret = crypto.createHmac('sha256', process.env.JWT_BUYER_SECRET || '')
  .update('ruda-fashion-account-v1')
  .digest('hex');
const BASE = process.env.FASHION_BASE_URL || 'http://127.0.0.1:3011';
const OUT = process.env.FASHION_SHOT_DIR || '/tmp/fashion-stage3-ui';
await mkdir(OUT, { recursive: true });

const suffix = Date.now().toString(36);
const viewer = await prisma.fashionAccount.create({ data: { displayName: `界面验收用户${suffix}` } });
const creator = await prisma.fashionAccount.create({ data: { displayName: `界面验收创作者${suffix}`, bio: '阶段三验收账号' } });
const postId = `fashion-post-ui-${suffix}`;
await prisma.fashionCommunityPost.create({
  data: {
    id: postId,
    image: '/fashion/imgi_59_00016-prada-fall-2023-ready-to-w.jpg',
    merchantId: 'public-fashion',
    merchantName: 'RUDA Fashion Community',
    createdAt: new Date(),
    title: `界面验收作品 ${suffix}`,
    caption: '用于浏览器验收的通知与草稿流程',
    category: '女装趋势',
    mediaType: 'image',
    publicationStatus: 'approved',
    creatorAccountId: creator.id,
    hashtags: [`界面${suffix}`]
  }
});
await prisma.fashionCommunityNotification.create({
  data: {
    id: crypto.randomUUID(),
    recipientAccountId: viewer.id,
    actorAccountId: creator.id,
    actorName: creator.displayName,
    type: 'like',
    postId,
    postImage: '/fashion/imgi_59_00016-prada-fall-2023-ready-to-w.jpg',
    preview: '赞了你的作品'
  }
});
const token = jwt.sign({ role: 'fashion_account', accountId: viewer.id }, secret, { expiresIn: '1h' });

const report = { checks: [], errors: [] };
const record = (name, ok, detail = '') => {
  report.checks.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` :: ${detail}` : ''}`);
};

const browser = await chromium.launch({ args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'zh-CN' });
await context.addCookies([{ name: 'ruda_fashion_account_jwt', value: token, domain: '127.0.0.1', path: '/' }]);
const page = await context.newPage();
page.on('pageerror', error => report.errors.push(error.message.slice(0, 200)));

try {
  await page.goto(`${BASE}/trends?post=${postId}`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('article[data-feed-id]', { timeout: 20000 });
  await page.waitForTimeout(1500);
  const consentReject = page.getByRole('button', { name: '拒绝' }).last();
  if (await consentReject.count()) {
    await consentReject.click().catch(() => undefined);
    await page.waitForTimeout(400);
  }

  await page.locator('button[aria-label="消息通知"]').first().click();
  await page.waitForTimeout(1200);
  const dialog = page.locator('[role="dialog"][aria-label="消息通知"]');
  record('消息抽屉打开', await dialog.count() > 0);
  record('通知显示真实互动者', (await dialog.getByText(creator.displayName).count()) > 0);
  await page.screenshot({ path: `${OUT}/01-notifications.png` });
  await dialog.locator('button[aria-label="关闭"]').first().click().catch(() => undefined);
  await page.waitForTimeout(400);

  await page.locator('button[aria-label="搜索内容"]').first().click();
  await page.waitForTimeout(400);
  await page.locator('input[aria-label="搜索商家或内容"]').fill(creator.displayName);
  await page.locator('form').filter({ has: page.locator('input[aria-label="搜索商家或内容"]') }).locator('button[type="submit"]').click();
  await page.waitForTimeout(1500);
  record('搜索结果出现创作者分组', (await page.getByText('创作者', { exact: true }).count()) > 0);
  record('搜索结果命中真实创作者', (await page.getByText(creator.displayName).count()) > 0);
  await page.screenshot({ path: `${OUT}/02-search.png` });
  await page.locator('button[aria-label="清除搜索并关闭"]').first().click().catch(() => undefined);
  await page.waitForTimeout(400);

  await page.locator('button[aria-label="上传图片或视频"]').first().click();
  await page.waitForTimeout(800);
  record('发布面板打开', (await page.getByText('发布内容').count()) > 0);
  await page.locator('input[aria-label="标题"]').fill(`界面草稿 ${suffix}`);
  await page.locator('textarea[aria-label="内容说明"]').fill('浏览器验收草稿内容');
  await page.getByRole('button', { name: '存草稿' }).first().click();
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${OUT}/03-draft-saved.png` });
  await page.locator('button[aria-label="上传图片或视频"]').first().click();
  await page.waitForTimeout(1500);
  record('草稿箱显示已保存草稿', (await page.getByText(`界面草稿 ${suffix}`).count()) > 0);
  await page.screenshot({ path: `${OUT}/04-draft-list.png` });

  const draftCount = await prisma.fashionCommunityDraft.count({ where: { accountId: viewer.id } });
  record('草稿已写入数据库', draftCount === 1, `count=${draftCount}`);
} catch (error) {
  record('浏览器验收脚本执行', false, error instanceof Error ? error.message.slice(0, 300) : 'unknown');
} finally {
  await context.close();
  await browser.close();
  await prisma.fashionCommunityNotification.deleteMany({ where: { recipientAccountId: viewer.id } }).catch(() => undefined);
  await prisma.fashionCommunityDraft.deleteMany({ where: { accountId: viewer.id } }).catch(() => undefined);
  await prisma.fashionCommunityPost.deleteMany({ where: { id: postId } }).catch(() => undefined);
  await prisma.fashionAccount.deleteMany({ where: { id: { in: [viewer.id, creator.id] } } }).catch(() => undefined);
  await prisma.$disconnect();
}

const failed = report.checks.filter(check => !check.ok).length;
console.log(`\nSUMMARY ${report.checks.length - failed}/${report.checks.length} passed; page errors ${report.errors.length}`);
if (failed) process.exitCode = 1;
