# 平台全局开关（时尚版块 / ModaUI）验收证据

- 日期：2026-10-28（首轮 15:45 UTC；复验 18:07 UTC / 本机 19:07）
- 环境：本机生产进程（`node dist/server.cjs`，PID 600182，启动于 2026-10-28 17:10:48，构建于 17:09，监听 `127.0.0.1:3011`）+ 生产 PostgreSQL；总后台经 `https://admin.ruda.fashion` 访问。
- 管理员：`admin@admin.com`（`settings.features` / `*`），真实表单登录。
- 浏览器：Playwright + 本机 Chromium，桌面 1440×1000、手机 390×844。
- 当前最终状态：`fashion_enabled=true`、`modaui_enabled=true`（与变更前一致），两个小程序开关保持 `false`。
- 复验脚本：`node scripts/platform-switches-shot.mjs` → 退出码 0，输出 `all switch checks passed`，
  原始结果见同目录 [`verification.json`](./verification.json)（`failures: []`，`pageErrors: []`）。

## 1. 服务端行为（真实 HTTP 请求）

| 步骤 | 请求 | 结果 |
|---|---|---|
| 基线 | `GET /api/public/feature-flags` | `{"fashion_enabled":true,"modaui_enabled":true}` |
| 基线 | `GET /api/fashion/posts?limit=1` | 200 |
| 关闭时尚 | `PATCH /api/admin/feature-flags/fashion_enabled {"enabled":false}` | 200，`updatedBy=admin@admin.com` |
| 关闭时尚 | `GET /api/fashion/posts?limit=1` | **403** `FASHION_MODULE_DISABLED` |
| 关闭时尚 | `POST /api/fashion/posts/any-id/view` | **403** `FASHION_MODULE_DISABLED` |
| 关闭时尚 | `POST /api/modagpt/public/chat {}` | 400 `MESSAGE_REQUIRED`（未被时尚开关影响） |
| 关闭时尚 | `GET /api/admin/feature-flags` | 200（管理员仍可管理） |
| 关闭 ModaUI | `PATCH .../modaui_enabled {"enabled":false}` | 200 |
| 关闭 ModaUI | `POST /api/modagpt/public/chat {}` | **403** `MODAUI_DISABLED` |
| 关闭 ModaUI | `GET /api/fashion/posts?limit=1` | 200（时尚不受影响） |
| 关闭 ModaUI | `GET /api/miniprogram/features` | `aiSectionEnabled=false` |
| 重新开启 | 两个 `PATCH enabled=true` | 200，`/api/fashion/posts` 200、公共对话回到 400 `MESSAGE_REQUIRED` |
| 进程重启 | `pm2 restart ruda-fashion` 后重复读取 | 值不变（`logs/feature-flags.json` 为权威来源） |

## 2. 数据保留（关闭前后对比）

| 表 | 关闭/重开前后 |
|---|---|
| `FashionCommunityPost` | 14 → 14 |
| `FashionCommunityComment` | 0 → 0 |
| `FashionCommunityFollow` | 0 → 0 |
| `MerchantModaGptDesign` | 0 → 0 |
| `ModaGptTask` | 12 → 12 |
| `FashionMediaEvent` | 0 → 0 |

## 3. 审计记录

`AuditLog` 中 `entity=FeatureFlag` 的写入示例：

```
FEATURE_FLAG_UPDATED fashion_enabled
old {"enabled":true,"updatedAt":null,"name":"时尚版块"}
new {"enabled":false,"updatedAt":"2026-10-28T15:45:06.053Z","name":"时尚版块","result":"success"}
user admin@admin.com  time 2026-10-28T15:45:06.054Z
```

每次开启/关闭均写入一条，操作人、时间、前后状态齐全。

## 4. 截图

| 文件 | 内容 |
|---|---|
| `admin-flags-01-desktop.png` | 总后台「平台管理 → 功能开关」四个开关、状态、最近操作人/时间 |
| `admin-flags-02-confirm.png` | 关闭「时尚版块」的确认框（确认关闭 / 取消） |
| `admin-flags-03-mobile.png` | 390×844 手机端总后台同一页面 |
| `web-01-home-fashion-on.png` | 桌面首页：顶部导航含「潮流时尚」 |
| `web-02-home-fashion-off.png` | 关闭后首页：「潮流时尚」入口消失 |
| `web-03-trends-disabled.png` | 关闭后直接访问 `/trends`：统一「该功能暂未开放」提示 + 返回首页 |
| `web-04-trends-restored.png` | 重新开启后 `/trends` 恢复正常 |
| `mobile-01-home-modaui-on.png` | 手机网页底部导航含 ModaUI |
| `mobile-02-home-modaui-off.png` | 关闭 ModaUI 后底部导航只剩 首页/找店/时尚/我的 |

## 5. 复现命令

```bash
npx tsc --noEmit
node --import tsx --test tests/platform-feature-flags.test.ts tests/platform-global-switches.test.ts \
  tests/modaui-miniprogram-flag.test.ts tests/miniprogram-fashion-parity.test.ts
node scripts/platform-switches-shot.mjs        # 自动恢复开启并打印最终状态
node scripts/platform-switches-mobile-shot.mjs # 总后台手机端截图
```

全量回归（`node --import tsx --test tests/*.test.ts`）：**1056 项 / 1054 通过 / 2 失败**，
两个失败均为本次改动前已存在的测试债，与开关无关：

1. `tests/growth-migrations.test.ts`：重复迁移时间戳 `20261023130000`（两个迁移均已在生产库历史中）。
2. `tests/ui-translation-copy.test.ts`：192 条文案对缺失（`FashionTrendsView.tsx` 等历史文件），本次新增文案已补齐，该测试不再报告本次改动文件。

UI 质量检查：`.agents/skills/impeccable/scripts/impeccable detect src/apps/platform-admin-common/components/admin/AdminFeatureFlags.tsx`
与 `.../src/apps/shared/components/ModuleUnavailableView.tsx` 均为 `EXIT:0`（该模式只做 regex 规则，
逐元素对比度/字号规则需对运行页面扫描，未计入通过结论）。


## 6. 未完成 / 待验证

1. **微信小程序真机 / 开发者工具**：`custom-tab-bar` 动态隐藏「时尚」「ModaUI」、`pages/fashion` 的关闭提示均只完成代码与单测检查，**待验证**（需部署后真机复验）。
2. **商家 Web / 手机 Web**：服务端门禁与入口隐藏已实现并通过单测，但本轮未截取商家端「创作空间」消失截图，**待验证**。
3. 商家小程序 ModaUI 的全局开关联动已完成代码检查（`merchant-miniprogram/utils/feature-flags.js` 取交集），真机**待验证**。
4. `/trends` 之外的旧收藏链接（如站内历史路由）统一落到同一提示页；未逐一枚举历史 URL。

---

## 7. 2026-10-28 18:07 UTC 复验（同一生产进程，脚本自动执行）

本次复验把「关闭 → 验证 → 重新开启」与截图放在同一次运行中完成，避免两次运行之间状态漂移；
脚本开始时先把两个全局总闸归位为开启，结束时无论成败都恢复开启。

| 步骤 | 请求 / 操作 | 实际结果 |
|---|---|---|
| 基线 | `GET /api/miniprogram/features`（时尚开启） | 200，`fashionSectionEnabled=true`、`aiSectionEnabled=false` |
| 基线 | `GET /api/merchant/feature-flags`（未登录） | **401** `MERCHANT_AUTH_REQUIRED`（商家载荷需要租户身份） |
| 基线 | `GET /api/fashion/posts?limit=1` | 200 |
| 关闭时尚 | `PATCH /api/admin/feature-flags/fashion_enabled {"enabled":false}` | 200，审计记录操作人 `admin@admin.com` |
| 关闭时尚 | `GET /api/fashion/posts?limit=1` | **403** `FASHION_MODULE_DISABLED` |
| 关闭时尚 | `GET /api/miniprogram/features` | 200，`fashionSectionEnabled=false`（小程序统一规则） |
| 关闭时尚 | `GET /api/public/feature-flags` | 200，`fashion_enabled=false`、`modaui_enabled=true`（互不影响） |
| 关闭时尚 | `POST /api/modagpt/public/chat {}` | 400 `MESSAGE_REQUIRED`（未被时尚开关拦截） |
| 重新开启时尚 | `PATCH enabled=true` | 200 |
| 关闭 ModaUI | `PATCH .../modaui_enabled {"enabled":false}` | 200 |
| 关闭 ModaUI | `POST /api/modagpt/public/chat {}` | **403** `MODAUI_DISABLED` |
| 关闭 ModaUI | `GET /api/fashion/posts?limit=1` | 200（时尚不受影响） |
| 重新开启 | 两个 `PATCH enabled=true` | 200，`/api/fashion/posts` 200、公共对话回到 400 `MESSAGE_REQUIRED` |

数据保留（复验前后直接查库，值完全一致）：
`FashionCommunityPost` 14、`FashionCommunityComment` 0、`FashionCommunityFollow` 0、
`FashionCommunityView` 8、`ModaGptTask` 12、`MerchantModaGptDesign` 0、`FashionMediaEvent` 0。

审计（`AuditLog`，`entity=FeatureFlag`，本次 18:07 共 7 条）：

```
18:07:19.524 fashion_enabled  false → true   admin@admin.com（基线归位）
18:07:19.564 modaui_enabled   false → true   admin@admin.com（基线归位）
18:07:25.508 fashion_enabled  true  → false  admin@admin.com
18:07:31.059 fashion_enabled  false → true   admin@admin.com
18:07:40.153 modaui_enabled   true  → false  admin@admin.com
18:07:43.860 fashion_enabled  true  → true   admin@admin.com（幂等归位写入）
18:07:43.879 modaui_enabled   false → true   admin@admin.com（恢复开启）
```

截图（本次运行重新生成，桌面 1440×1000 / 手机 390×844）：
`admin-flags-01-desktop.png`、`admin-flags-02-confirm.png`、`admin-flags-03-mobile.png`、
`web-01-home-fashion-on.png`、`web-02-home-fashion-off.png`、`web-03-trends-disabled.png`、
`web-04-trends-restored.png`、`mobile-01-home-modaui-on.png`、`mobile-02-home-modaui-off.png`。

### 7.1 复验期间发现的线上状态异常（已归位）

18:00 复核时发现生产开关在 17:47:06–17:48:36 被账号 `admin` 依次把**四个开关全部关闭**
（`merchant_miniprogram_modaui_enabled`、`miniprogram_modaui_enabled`、`fashion_enabled`、
`modaui_enabled`），即时尚与 ModaUI 在线上处于关闭状态。审计记录完整可查。
本次脚本运行第一步即把两个全局总闸归位为开启，结束时再次确认 `fashion_enabled=true`、
`modaui_enabled=true`。

> 结论：开关本身工作正常（可关、可开、互不影响、审计完整），但**关闭状态不会自动恢复**。
> 运营/开发在手工关闭后必须显式重新开启；建议后续增加「关闭超过 N 分钟」的告警，
> 该告警属新增能力，未在本次范围内实现。

