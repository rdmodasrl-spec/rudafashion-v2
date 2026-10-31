---
name: webapp-testing
description: "RUDA 前端功能与视觉回归测试方法：用仓库已装的 Playwright 启动本地服务、侦察真实 DOM、执行交互、截图取证并读取 console/网络错误。用于验证页面行为、模板切换、响应式断点、空/错误/权限状态与改动前后对比。适用于任何需要「证明它真的能用」的前端任务，替代靠读代码猜测。"
license: Apache-2.0（见同目录 LICENSE.txt）
metadata:
  version: 1.0.0-ruda
  upstream: https://github.com/anthropics/skills
  upstream_skill: webapp-testing
  adapted: 2026-10-31
---

# Web Application Testing（RUDA 适配版）

Adapted from Anthropic's `webapp-testing` (Apache-2.0). Upstream uses Python Playwright. RUDA already ships the Node `playwright` package and Node scripts, so this adaptation keeps the method and switches the language.

## 视觉基线

截图评审的取值标准以 `docs/engineering/design-values.md` 为准（字号 ≥12px、圆角令牌 `--radius-ruda-card`、单一强调色 `#201e1a`、Manrope 字体栈、`lucide-react`、对比度、触控 24px）。本技能负责"证明它真的能用"，不重新定义设计值。动效仍以 `cubic-bezier(0.22, 1, 0.36, 1)` 为准。

## 硬性前提

- **只打本地**：`PORT=41xx npm run dev`，或已确认的测试环境。**禁止对生产站点执行写操作**（下单、改价、改库存、改模板、删除）。
- `npm run dev` 连接仓库 `.env` 的数据库：只做读取与页面渲染验证；需要写入时用隔离库（`scripts/isolatedPostgresTestDatabase.ts` / `scripts/test-ai-growth-p0-isolated.sh`）。
- 产物写到 `/tmp/`，不提交截图；需要留证的截图放 `docs/engineering/evidence/<批次>/`。

## 决策树

```
任务 → 是静态 HTML？
  ├─ 是 → 直接读文件找选择器
  └─ 否（动态应用）
       ├─ 服务没起 → node .agents/skills/webapp-testing/scripts/with-server.mjs -- help 查看用法，再带起服务跑脚本
       └─ 服务已起 → 侦察-再-动作：
            1. goto + waitUntil 'networkidle'
            2. 截图 / 读 DOM
            3. 按真实渲染结果确定选择器
            4. 再执行动作
```

**最常见的错误**：在 `networkidle` 之前就去抓选择器。SPA 首屏是异步渲染的，早抓必然拿到空节点。

## 基本脚本

```js
import { chromium } from '/www/wwwroot/ruda.fashion/node_modules/playwright/index.mjs';

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await ctx.newPage();

const errors = [];
page.on('pageerror', e => errors.push('pageerror: ' + e.message));
page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
page.on('requestfailed', r => { if (r.resourceType() === 'image') errors.push('img: ' + r.url()); });

await page.goto('http://127.0.0.1:4100/', { waitUntil: 'networkidle', timeout: 90000 });
await page.waitForTimeout(1500);
await page.screenshot({ path: '/tmp/shot.png', fullPage: true });

console.log(JSON.stringify({ errors }, null, 2));
await browser.close();
```

## 视口矩阵（必测）

| 宽度 | 代表 |
| --- | --- |
| 390×844 | 手机 Web / 小程序等宽近似 |
| 820×1180 | 平板 |
| 1024×800 | 笔记本 |
| 1440×1000 | 桌面 |

同时检查：无横向滚动（`scrollWidth <= clientWidth`）、主操作在首屏可见、触控目标 ≥24×24、真实图片无裂图（`img.complete && naturalWidth === 0`）。

## 主机名路由

RUDA 按 hostname 选择构建目标（`src/apps/appTarget.ts`），`127.0.0.1` 落到 `frontend-web`。要测商家后台或平台后台，用 Chromium 域名映射：

```js
const browser = await chromium.launch({
  args: ['--host-resolver-rules=MAP ruda.fashion 127.0.0.1']
});
await page.goto('http://ruda.fashion:4100/merchant');
```

经 http 访问非 localhost 域名时，`crypto.randomUUID` 不可用（非安全上下文），需加 `--unsafely-treat-insecure-origin-as-secure=http://ruda.fashion:4100`；部分页面仍可能因其他 dev-only 问题报错，此时改用构建产物验证。

## 登录态

- 生产 `INDUSTRY_DEMO_LOGIN_ENABLED` 默认关闭（`DEMO_LOGIN_UNAVAILABLE`）。**不得擅自开启**；需要时由用户授权，用完整帧结束即关，并用 `pm2 startOrRestart ecosystem.config.cjs --only ruda-fashion` 清掉临时环境变量。
- 本地 `NODE_ENV` 非 production 时 `POST /api/auth/demo/merchant/login` 可用；行业入口 `?industryDemo=001..007`。

## 商家独立店铺三套模板的功能测试配方

模板定义：`src/shared/merchantStorefrontTemplate.ts` —— `fashion_monochrome`（时尚·黑白）、`luxury_black_gold`（豪华·黑金）、`ecommerce_standard`（标准·电商）。

对每个模板都要验证 **5 件事**，缺一不算通过：

1. **视觉落地**：`[data-storefront-template]` 属性等于所选模板 id；页面底色/强调色与该模板声明一致（黑金模板只能在其店铺范围内出现金色，不得外溢到平台其他页面）。
2. **真实预览**：商家后台的「店铺预览 / 店铺链接」能打开公开店铺页，且渲染的是**同一商家、同一模板、同一批商品**，不是 mock。
3. **响应式**：390 / 820 / 1440 三档无横向滚动，商品网格列数随断点变化，主操作在首屏可见。
4. **切换生效**：后台切换模板 → 保存成功提示 → 刷新公开店铺页后模板仍是新的（服务端持久化，不是本地乐观状态）。
5. **切换后功能不回归**：商品详情可打开、加购/询价可用、购物车数量正确、店铺信息与政策文案未丢失、无 console 报错、无裂图。

最小脚本骨架：

```js
const cases = ['fashion_monochrome', 'luxury_black_gold', 'ecommerce_standard'];
for (const tpl of cases) {
  await page.goto(`${shopUrl}?template=${tpl}`, { waitUntil: 'networkidle' });
  const applied = await page.getAttribute('[data-storefront-template]', 'data-storefront-template');
  if (applied !== tpl) report.push(`template not applied: ${tpl} -> ${applied}`);
  for (const width of [390, 820, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.waitForTimeout(600);
    const ok = await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1);
    if (!ok) report.push(`horizontal overflow: ${tpl} @${width}`);
  }
}
```

模板切换写回属于服务端行为：验证持久化必须**重新加载页面**再读属性，不能用切换后的内存状态代替。

## 输出要求

每次报告写明：起点 URL、视口、跑过的动作、截图路径、console/网络错误原文、哪些是**未验证**。不得用"应该没问题"代替实测。
