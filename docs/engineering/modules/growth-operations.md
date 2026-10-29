# 增长运营（平台总后台）

- module-id: `growth-operations`
- 所有者角色：平台运营（管理员权限 `settings.ai_support` / `settings.integrations`）
- 状态（2026-10-26）：工作台、招商获客、内容推广、增长数据为**部分完成**；时尚设计为**已完成（沿用既有实现）**。未接通能力逐项标注。
- 相关文档：[`../audit/2026-10-26-full-closure-audit.md`](../audit/2026-10-26-full-closure-audit.md)、[`../deployments.md`](../deployments.md)

## 1. 问题与目标

原「增长运营」有 9 个一级入口，其中总览/运营助手/营销归因/经营报表/促销管理互相重复，大量卡片没有真实数据来源；管理员还因 `ADMIN_IP_WHITELIST` 未配置而收到 `Admin IP is not allowed`，所有增长接口 403。

目标：收敛为 4 个日常运营工具 + 保留时尚设计；所有列表和数字必须来自真实服务端数据；失败必须显示失败，不得渲染成 0 或空列表。

## 2. 非目标

- 不新建第二套 AI Runtime、Supervisor、任务队列或媒体服务。
- 不重写时尚设计（智能下载/图片创作/视频创作/我的素材/AI 创作助手）。
- 不做无人审批的对外发布、广告投放、付费操作。
- 不提供虚构的企业线索、访问量或转化数据。

## 3. 复用现状（防重复检查）

| 能力 | 复用对象 | 结论 |
| --- | --- | --- |
| AI 文本 | `src/server/aiEmployeeProviders.ts#generateAiEmployeeText` | 复用，不新建 |
| 图片/视频素材 | `/api/admin/fashion/studio/*`（时尚设计媒体服务） | 复用，不新建 |
| 任务记录 | `ModaGptTask` + `/api/admin/modagpt/tasks` + PostgreSQL worker | 复用，不新建队列 |
| 增长任务/计划 | `GrowthMission`、`/api/admin/growth/missions*` | 复用 |
| 客户跟进 | `GrowthCrmFollowUp`、`/api/admin/growth/crm*` | 扩展 `prospectId`，不建第二套跟进表 |
| 内容活动 | `/api/admin/growth/campaigns*`（含 Meta 发布） | 复用 |
| 促销 | `/api/admin/promotions*`、`AdminPromotions` | 原样内嵌在内容推广的「促销活动」折叠区 |
| 归因/报表 | `/api/admin/growth/overview`、`/api/admin/bi/*`、`AdminBIDashboard` | 指标合并到增长数据，原经营报表内嵌为「经营报表」折叠区 |
| 代理网络 | `AdminPartnerGrowth`、Partner API | 原样内嵌在招商获客的「代理网络」折叠区 |
| 运营助手 | `AdminModaGptOperator`、`/api/admin/modagpt/*` | 从增长区移出，保留为「平台管理 → 运营助手」独立入口 |
| 访问/渠道设置 | `/api/admin/growth/channels`、`/api/admin/growth/meta` | 保留 |

已搜索关键字：`growth`、`crm`、`prospect`、`lead`、`bi`、`promotions`、`sales-trend`、`web_search`、`serper`。项目内新增的检索能力只有 `PROSPECT_SEARCH_PROVIDER=serper` + `SERPER_API_KEY` 这一条统一通道；未配置时接口返回 503，前端显示「未接通」并列出所需变量，**不返回任何默认或虚构企业数据**。

## 4. 页面结构

| 入口 | 路由 key | 内容 | 真实数据源 |
| --- | --- | --- | --- |
| 增长总览 | `growth_workbench` | 周期指标、漏斗、待跟进线索、待审核文案、最近注册与入驻、四个工具入口（含时尚设计）；三个请求独立失败 | `growth/overview`、`growth/prospects?due=overdue`、`growth/campaigns` |
| 招商获客 | `growth_acquisition` | 潜在商家线索列表、筛选/搜索、新建、详情、状态流转、跟进记录、AI 检索候选并入线索库；折叠区内嵌无重复标题的代理网络 | `growth/prospects*`、`growth/crm/follow-ups` |
| 内容推广 | `growth_content` | 市场/语言/渠道/目标、AI 文案生成、编辑、保存推广草稿、审核活动；折叠区内嵌无重复标题的原「促销管理」 | `growth/copy`、`growth/campaigns*`、`promotions*` |
| 增长数据 | `growth_analytics` | 指标明细与口径、漏斗、渠道事件、AI 诊断；折叠区内嵌无重复标题的原「经营报表」 | `growth/overview`、`growth/analysis`、`bi/*` |
| 时尚设计 | `fashion_content` | 既有全部功能，保持不变 | `fashion/studio*`、`fashion/community` |

旧路由兼容（`normalizeAdminTab`）：`growth` → `growth_workbench`；`partners` → `growth_acquisition`；`promotions` → `growth_content`；`marketing_attribution`、`bi_dashboard` → `growth_analytics`；`gallery`、`fashion_community`、`website_collector` → `fashion_content`。`ai_center`、`risk_monitor` 位于「平台管理」区；`modagpt_operator`（运营助手）保留独立入口，避免丢失商家/商品草稿能力。旧 `AdminGrowthCenter` 已删除，页面级重复实现不再存在。

## 5. 数据归属与实体

新表 `GrowthProspect`（潜在线索，权威存储）：

| 字段 | 说明 |
| --- | --- |
| `id` | uuid |
| `companyName` / `contactName` / `email` / `phone` | 企业名称与联系人 |
| `website` | 官网（用于去重与来源核对） |
| `country` / `city` | 市场 |
| `businessType` | `wholesaler` / `brand` / `trading` / `other` |
| `source` | `manual` / `import` / `ai_research` |
| `sourceUrl` / `sourceNote` | 来源链接与备注（采集时间由 `createdAt` 记录） |
| `status` | `new` / `contacted` / `negotiating` / `registered` / `onboarded` / `paused` |
| `dedupeKey` | 唯一键：官网 host 优先，否则名称+国家+城市归一化 |
| `customerId` / `merchantId` | 关联已注册采购商 / 已入驻商家，避免重复建客户 |
| `nextFollowUpAt` / `lastContactAt` | 跟进计划与最近联系 |
| `createdBy` / `createdAt` / `updatedAt` | 审计字段 |

`GrowthCrmFollowUp` 新增可空 `prospectId`，跟进记录仍由同一张表与同一套接口管理。

状态机：`new → contacted → negotiating → registered → onboarded`；任意状态可转 `paused`；`paused` 可回到 `contacted`。UI 不允许跳级写入非法值，服务端校验枚举。

## 6. API 契约

全部 `requireAdminAuth` + 生产环境 IP 白名单；读写权限 `settings.ai_support`；响应 `Cache-Control: no-store`；错误结构沿用 `sendApiError`。

| 方法 | 路径 | 说明 | 主要错误 |
| --- | --- | --- | --- |
| GET | `/api/admin/growth/prospects` | 列表（`status`、`q`、`country`、`due=today\|overdue`、`limit`、`offset`）+ `counts` 状态计数 | 400 参数非法 |
| POST | `/api/admin/growth/prospects` | 新建线索，服务端生成 `dedupeKey` | 409 `GROWTH_PROSPECT_DUPLICATE`（含 `existingId`）、400 `GROWTH_PROSPECT_INVALID` |
| PATCH | `/api/admin/growth/prospects/:id` | 更新信息/状态/下次跟进/关联客户或商家 | 404、400、409 |
| GET | `/api/admin/growth/prospects/export` | 导出 CSV（UTF-8 BOM，`text/csv`） | — |
| POST | `/api/admin/growth/prospects/search` | 潜在商家检索。**未配置搜索供应商时返回 503 `GROWTH_PROSPECT_SEARCH_NOT_CONFIGURED`**，不返回任何伪造结果 | 503 |
| GET | `/api/admin/growth/prospects/:id` | 线索详情 + 最近 50 条跟进记录（同一 `GrowthCrmFollowUp` 表） | 404 |
| POST | `/api/admin/growth/crm/follow-ups` | 已扩展 `subjectType=prospect` | 400 |
| POST | `/api/admin/growth/copy` | AI 生成 3 条待审核推广文案（渠道/语言/市场/目标/落地页），不保存、不发布；AI 未配置时返回 502 `GROWTH_COPY_AI_PROVIDER_FAILED` | 400、502 |
| POST | `/api/admin/growth/analysis` | 基于页面提交的真实指标快照生成改善建议，只引用快照数字，不预测收入/ROI | 400、502 |
| GET | `/api/admin/security/access-check` | 管理员会话诊断：返回服务端解析到的出口 IP、是否命中白名单、`TRUST_PROXY_HOPS`；仅需有效管理员 JWT（IP 校验之前），用于排查 `ADMIN_IP_NOT_ALLOWED` | 401 |

写操作幂等：新建线索由 `dedupeKey` 唯一约束保证；重复提交返回 409 而不是生成第二条记录。AI 文案只返回候选内容，管理员编辑后通过既有 `/api/admin/growth/campaigns` 保存为草稿，仍需人工审核才能发布。

`GET /api/admin/growth/overview` 新增可选 `days=7|30|90`（默认 30），并在响应中增量提供 `metrics.merchantsWithProducts`、`metrics.merchantsWithPaidOrders`、`metrics.merchantsWithFirstPaidOrder`、`recentCustomers`、`recentMerchants`、`channelEvents`；口径写入 `metricDefinitions`，不改变既有字段含义。

## 7. 权限与租户边界

- 平台级模块，`tenantId = 'platform'`，不跨商家数据；商家侧增长（`MerchantGrowthWorkspace`）不改动。
- 线索只含公开企业信息，不含个人敏感数据；导出仅管理员可执行并记录审计日志。
- IP 白名单保持开启：修复方式是配置 `ADMIN_IP_WHITELIST`（运维公网 IP）与 `ALLOW_PRIVATE_ADMIN_IPS`（隧道/内网），不关闭校验。
- IPv6：白名单条目与客户端地址均支持 IPv6 与 IPv6 CIDR；`::ffff:a.b.c.d` 归一化为 IPv4，`::1` / `fc00::/7` / `fe80::/10` 视为内网地址（仍需 `ALLOW_PRIVATE_ADMIN_IPS=true`）。
- 排查 `ADMIN_IP_NOT_ALLOWED`：403 响应的 `error.details` 会带 `clientIp`、`allowlistConfigured`、`allowPrivateAdminIps`；前端据此显示实际出口 IP。`GET /api/admin/security/access-check` 额外返回 `trustProxyHops` 与 `forwardedForPresent`，用于确认 Cloudflare/Nginx/Express 的代理层数是否与 `TRUST_PROXY_HOPS` 一致。
- 反向代理要求：Nginx 必须 `real_ip_header CF-Connecting-IP`（使用 Cloudflare 时）并转发 `X-Forwarded-For`；`TRUST_PROXY_HOPS` 必须等于受信代理层数。解析到 Cloudflare 边缘 IP 而不是客户端 IP 时，会表现为所有管理员都被拒绝。

## 8. 状态、错误与空数据

- 四个工具按区块显示加载中、失败和空数据状态；失败时清空当前数据并用 `—` 占位，不把旧周期或旧筛选结果冒充当前结果。
- 并发请求使用单调递增的请求序号。周期切换、筛选/搜索、详情切换后，在途旧响应直接丢弃；内容推广刷新草稿同样受保护。
- AI 诊断失败在诊断卡内显示失败原因与整改入口，不保留上一次诊断；切换周期会作废在途诊断请求。
- 招商候选搜索无结果时显示「供应商未返回候选」；搜索供应商未配置时显示 503 配置说明，不生成默认线索。
- 内嵌的促销、代理网络和经营报表通过 `embedded` 隐藏重复主标题，复用同一组件、API 与状态。

## 9. 测试与验收

- 单元：`tests/growth-prospects.test.ts`（归一化、去重键、校验、CSV）、`tests/growth-content-analytics.test.ts`（AI 文案与诊断的输入校验、严格响应解析、草稿不可执行、漏斗口径）、`tests/growth-admin-errors.test.ts`（403 白名单、无观测 IP、搜索未配置、AI 供应商失败、未知错误文案）、`tests/admin-ip-allowlist.test.ts`（白名单/私有网段/IPv6）、`tests/client-ip.test.ts`（IPv4-mapped 归一化）、`tests/admin-navigation.test.ts`（四个工具入口唯一、旧路由归一化）。
- 接口：`npm run test:p0:integration` 覆盖 growth CRM。
- 手工（待执行）：登录后台 → 工作台四块真实数据 → 新建/去重/跟进/导出线索 → 内容推广生成并保存草稿 → 增长数据筛选 → 时尚设计原功能可用。
- 端侧（待执行）：桌面 1440 与手机 390 检查；小程序不涉及本模块。

## 10. 部署与回滚

- 迁移：`prisma/migrations/20261026130000_growth_prospects`（仅新增表、可空列、索引、外键），回滚为删除该表与 `prospectId` 列。
- 新增环境变量：无（复用 `ADMIN_IP_WHITELIST`、`ALLOW_PRIVATE_ADMIN_IPS`，已在 `.env.example` 说明）。
- 发布：`npm run build` + `pm2 reload ruda-fashion --update-env`；旧代码与新表兼容（新代码不依赖列默认值变更）。
