# RUDA 工程架构现状

> 依据仓库源码与配置核查，更新日期：2026-10-23。本文记录已观察到的实现；未进行生产环境或全链路验证的内容明确标为待验证。

## 1. 系统概览

- 仓库采用 React、TypeScript、Vite、Express、Prisma 与 PostgreSQL。依赖和命令见 `package.json`。
- 六个独立 Web 构建目标由 `src/apps/appTarget.ts` 定义：前台 Web/手机、商家后台 Web/手机、平台总后台 Web/手机。
- 主要 API 服务入口为根目录 `server.ts`；大量业务路由和中间件仍注册在该组合入口，领域服务逐步位于 `src/server/`。
- Prisma schema 位于 `prisma/schema.prisma`，迁移位于 `prisma/migrations/`。运行时也保留部分内存态/兼容路径，不能假定所有读写都已迁移为统一 Prisma 服务。
- `fashion-ingestion/` 有独立 Python 依赖；`miniprogram/`、`merchant-miniprogram/` 和 `fu/` 是仓库内其他运行面。其部署、身份互通和完整数据流需按具体任务核验。

## 2. Web 应用边界

| 目标 | 入口 | 构建命令 | 输出 |
|---|---|---|---|
| 前台 Web | `src/apps/frontend-web/main.tsx` | `npm run build:app:frontend-web` | `dist/apps/frontend-web/releases/<release-id>/` |
| 前台手机 | `src/apps/frontend-mobile/main.tsx` | `npm run build:app:frontend-mobile` | `dist/apps/frontend-mobile/releases/<release-id>/` |
| 商家后台 Web | `src/apps/merchant-admin-web/main.tsx` | `npm run build:app:merchant-admin-web` | `dist/apps/merchant-admin-web/releases/<release-id>/` |
| 商家后台手机 | `src/apps/merchant-admin-mobile/main.tsx` | `npm run build:app:merchant-admin-mobile` | `dist/apps/merchant-admin-mobile/releases/<release-id>/` |
| 平台后台 Web | `src/apps/platform-admin-web/main.tsx` | `npm run build:app:platform-admin-web` | `dist/apps/platform-admin-web/releases/<release-id>/` |
| 平台后台手机 | `src/apps/platform-admin-mobile/main.tsx` | `npm run build:app:platform-admin-mobile` | `dist/apps/platform-admin-mobile/releases/<release-id>/` |

`src/main.tsx` 和 `src/apps/appTarget.ts` 根据域名、路径、视口或有效的 `ruda-app` 参数选择目标。前台共享页面位于 `src/apps/shared/`；商家和平台后台专属组件分别位于 `src/apps/merchant-admin-common/`、`src/apps/platform-admin-common/`。已有详细边界说明见 [`docs/application-boundaries.md`](../application-boundaries.md)。

三个手机端目标（前台手机、商家手机、平台手机）共用 [`mobile-design-system.css`](../../src/apps/shared/mobile-design-system.css) 的按钮、卡片、输入框、弹窗、标签和图标令牌，规范与验收状态见 [`mobile-design-system.md`](./mobile-design-system.md)。Web 目标保持现有 `2px` 直角基线，不继承手机端圆角。小程序与 Flutter 是独立样式体系，不在该共享层覆盖范围内。

`scripts/build-app.ts` 为单一目标写入独立版本目录，不激活 release；`scripts/publish-app.ts` 切换该目标 `current.json` 并保留前一个指针；`scripts/rollback-app.ts` 按目标恢复。`npm run build` 会构建全部目标并构建服务端，不等同于独立应用构建。上述脚本行为已核对，生产发布流程未在本次验证。

## 3. 后端、API 与数据流

- 浏览器共享 API 客户端为 `src/api/client.ts`，负责 URL 解析、凭证携带、超时、GET 重试和结构化错误转换。
- Express 路由在 `server.ts` 注册；业务逻辑有一部分抽取到 `src/server/`。开始新增接口前，先搜索 `server.ts`、`src/server/` 和 `src/api/` 的现有路径及调用方。
- 本次检查未发现仓库根目录统一的 OpenAPI 文档入口；各 API 的实际契约需从路由、调用方类型、服务实现和测试共同确认，避免另建不一致契约源。
- PostgreSQL/Prisma schema 是主要持久化模型来源；模型、迁移和个别兼容/投影逻辑的真实写入归属需逐业务域核实。不要只依据 `schema.prisma` 推断读写链路完整。
- 共享客户端业务状态位于 `src/context/B2BContext.tsx`；它不是服务端数据权威来源。服务端的内存态兼容路径、缓存失效及多实例一致性需在涉及业务时专门审计。
- 商家三端（商家 Web、商家手机 Web、商家小程序）共用同一商家 JWT、租户边界和 `/api/merchant/*` 权威数据。Web/手机 Web 通过 `B2BContext` 的 SSE（`/api/merchant/events`）加 30 秒补偿刷新，小程序通过页面 `onShow` 与受限补偿刷新获得服务端结果；共享 GET 缓存在认证/商家切换时必须清理。规格见 [`modules/merchant-cross-device-sync.md`](./modules/merchant-cross-device-sync.md)，逐功能状态见 [`modules/merchant-three-end-matrix.md`](./modules/merchant-three-end-matrix.md)。

## 4. 身份、认证与授权

- 认证 API 位于 `server.ts` 的 `/api/auth/...` 路由组，覆盖管理员、商家、员工、买家/消费者和合作伙伴等不同流程。
- 管理员 API 使用 `requireAdminAuth`；当前实现检查 Bearer token 或 `ruda_admin_jwt` Cookie，验证管理员 JWT，并校验管理员账户的凭证版本/更新时间。`requireAdminPermission` 执行管理员权限检查。
- 商家、员工、消费者/买家等流程也有各自的角色和资源边界。`src/server/tenantAccess.ts`、`src/server/employeePermissions.ts` 及路由级中间件是相关核查入口；每次改动仍须沿真实 API 链验证租户与资源授权。
- `prisma/schema.prisma` 中可见 `AccountIdentity`、`AuthAccount`、`Consumer`、`MerchantEmployee` 等身份/关系模型。各角色账户映射、Cookie 生命周期、刷新/撤销规则尚未在本文件中穷尽，需在认证任务中继续追踪。
- 统一身份与商家入驻的新权威边界见 [`modules/identity-merchant-onboarding.md`](./modules/identity-merchant-onboarding.md)：普通客户注册只获得前台/采购身份；商家必须先生成 `MerchantOnboardingApplication`，由平台管理员审核通过后才创建或激活 `Merchant`、商家账号和 `apparel_production_wholesale` 工作区；平台管理员权限不能通过公开注册获得。
- 不得因前端应用分开而新建独立认证后端、用户权威表或权限绕过路径。

## 5. 业务领域登记原则

当前服务端组合入口仍承载大量路由；可确认的领域服务包括商家履约/采购/退款、库存、客服、增长归因与 CRM、合作伙伴、ModaGPT/AI 任务、应用商店、邮件域名、智能生产链、通知和备份等。源码入口、主要模型及验证状态见 [`module-registry.md`](./module-registry.md)。

智能生产链是应用商店中的**可选安装业务应用**（`ruda-production-chain`），不是新的应用运行面：其商家页面仍由商家后台 Web/手机端承载，服务端路由为 `/api/production/*`，安装状态由 `AppInstallation` 控制。工厂协作使用独立主体会话与工厂归属校验，不进入商家后台菜单。规格见 [`modules/production-chain.md`](./modules/production-chain.md)。

MODAUI AI 工具平台（App Store 独立应用 + 工具注册协议）目前处于**设计待评审**，尚未实现。设计文档为 [`architecture/MODaUI-AI-TOOLS-PLATFORM.md`](./architecture/MODaUI-AI-TOOLS-PLATFORM.md)，其中记录了一个关键现状：商店安装记录 `AppInstallation` 只在 `src/server/productionChain.ts:256` 被当作能力门禁（appId 写死），AI 工具链完全不读取安装记录；可安装性被硬编码在 `src/server/appStoreValidation.ts` 的两个 `appId` 白名单内。因此"安装某个应用"当前不等于"获得对应 AI 能力"。该文档给出 Tool Manifest v1 协议与解析链设计，实施前必须先评审。


开始改动一个领域时，应从真实页面/调用方追踪至 API、服务、数据库和权限，而非仅按组件名推断业务边界。创建可独立交付的新模块时，使用 `templates/module-spec-template.md` 先记录复用、契约、权限和验收。

## 6. 其他运行面

| 运行面 | 源码/配置 | 当前可确认事实 | 未确认事项 |
|---|---|---|---|
| RUDA 微信小程序 | `miniprogram/` | 有 `app.json`；后端含 `wechatMiniProgram.ts`、微信身份服务 | 独立构建、发布与全链路权限需按任务核查 |
| 商家微信小程序 | `merchant-miniprogram/` | 有 `app.json`、`package.json` | 与后台 API、租户权限和发布流程需按任务核查 |
| Flutter 应用 | `fu/` | 有 `pubspec.yaml` | API/认证兼容、构建发布状态待确认 |
| Fashion ingestion | `fashion-ingestion/` | 有 Python 依赖清单，为单独目录 | 服务入口、持久化、队列和主站集成状态待逐项核实 |

不得因这些目录存在就宣称相应运行面已生产启用或端到端完成。

## 7. 测试、发布与自动化

- TypeScript 检查：`npm run lint`（`tsc --noEmit`）。
- 单元测试：`npm run test:unit`，使用 Node test runner 与 `tsx`。
- 有针对应用选择的 `tests/app-target.test.ts`、`tests/admin-navigation.test.ts` 等测试；具体覆盖见测试源码。
- PostgreSQL 集成与 E2E 命令见 `package.json`，需要相应环境时不可用未执行结果替代。
- 本次仓库清单未发现 `.github/workflows/` CI 工作流；自动化运行范围待确认。
- 部署配置入口包括 `ecosystem.config.cjs`、`scripts/start-production.sh`、`BAOTA-DEPLOY.md`；发布 smoke 默认检查公共站点 `https://modaui.com`（可由 `SMOKE_BASE_URL` 覆盖），不使用商家域名 `APP_URL` 检查公共首页重定向。

## 8. 已知限制与待确认

- `server.ts` 仍为大型路由/组合入口，模块边界不能只凭目录推断。
- 部分业务使用内存态或兼容路径；跨实例一致性及缓存失效不在本次全面审计范围。
- 没有找到集中维护的 OpenAPI 目录或 GitHub Actions workflow；不据此推断没有其他外部 CI。
- 本文件是工程接入时的基线，不表示所有应用、权限、接口和数据流程都已完成全链路验收。

## 9. 证据位置

- 应用入口与目标：`src/apps/appTarget.ts`、`src/main.tsx`
- 构建/发布/回滚：`scripts/build-app.ts`、`scripts/publish-app.ts`、`scripts/rollback-app.ts`
- API 客户端：`src/api/client.ts`
- 服务端组合入口与管理员授权：`server.ts`
- 持久化 schema/migrations：`prisma/schema.prisma`、`prisma/migrations/`
- 测试与命令：`tests/`、`package.json`
- 运行面边界补充：`docs/application-boundaries.md`
