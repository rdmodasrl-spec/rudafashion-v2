# 商家后台三端功能一致性矩阵

- 日期：2026-11-14
- 强制规则：`AGENTS.md` 第 15 节
- 对照端：商家 Web（`merchant-admin-web`）、商家手机 Web（`merchant-admin-mobile`）、商家小程序（`merchant-miniprogram`）
- 状态口径：**一致**＝三端使用同一权威 API/规则且有本轮代码证据；**部分**＝存在但仍有字段/刷新/验收缺口；**缺失**＝某一端无入口或服务端无能力；**待验收**＝代码检查完成但无真实会话/设备证据。

> 本矩阵是商家功能变更的必填检查表。任何商家功能任务都必须更新对应行，不能只修改一个端后保持“一致”标记。

## 1. 运行面与数据源

| 项目 | 商家 Web | 商家手机 Web | 商家小程序 | 结论 |
|---|---|---|---|---|
| 构建/入口 | `src/apps/merchant-admin-web/main.tsx` | `src/apps/merchant-admin-mobile/main.tsx` | `merchant-miniprogram/app.json` | 独立入口 |
| API 基址 | 同源 `/api`；admin 域代理到 `ruda.fashion` | 同源 `/api` | `https://ruda.fashion` | 生产一致；开发小程序写生产，见风险 |
| 认证 | `ruda_merchant_jwt` / Bearer | 同 Web | Bearer，独立存储键 | 同一 JWT 密钥与角色 |
| 商家 ID 来源 | 服务端 JWT | 服务端 JWT | 服务端 JWT | 客户端不传权威 merchantId |
| 数据库 | Prisma/PostgreSQL | 同 | 同 | 单一权威数据库 |
| 读取缓存 | `apiGet` 显式 TTL；商家权威读取 TTL=0 | 同 | 无 TTL，页面状态 | 已补认证/切换清理和强制刷新 |
| 跨端事件 | SSE `/api/merchant/events` | 同 Web | 无 SSE，30 秒补偿/onShow | 单实例事件 + 补偿 |

## 2. 核心业务功能

| 功能 | 商家 Web | 商家手机 Web | 商家小程序 | 一致性与验证 |
|---|---|---|---|---|
| 服装自有生产 API 授权 | 共享生产工单/物料与外发生产 API；成本 UI 按 `canViewCosts` 控制 | 同一商家 API；成本 UI 按 `canViewCosts` 控制；本地演示店主会话已实测「更多 → 面辅料库存」及生产工单 CTA | 材料工作区同一 API；创建成本输入按 `canViewCosts` 控制 | 正式 Apparel 必须具备 `APPAREL_OWN_PRODUCTION` entitlement 且员工有生产权限；物料目录需 `production.view`，成本字段仅店主或 `production.cost.view` 可读写；无权限新增只能为零成本，编辑省略成本保留原值，改成本返回 403。物料目录 API 返回 `canViewCosts` 供三端呈现；旧生产模板保留兼容，Leather 生产能力不复用 Apparel 路由。隔离 PostgreSQL HTTP 测试验证授权、越权拒绝、跨租户/行业隔离和成本读写过滤。手机 Web 390/820/1024/1440 无横向溢出、主按钮可见、12 个表单标签均关联控件；真实无成本员工会话、电脑端本轮截图及小程序开发者工具/真机仍待验收 |
| 餐饮/服装共享物料流水查询 | 未接入专属页面 | 未接入专属页面 | 未接入专属页面 | 同一 `MaterialInventoryMovement` 查询 API 按行业过滤：Restaurant 仅读本商家餐饮原料流水且不可读同租户非餐饮流水，Apparel 仅读非餐饮物料且要求自有生产 entitlement；其他行业拒绝。`test:restaurant-catalog:integration`、`test:production-chain:integration` 隔离 PostgreSQL HTTP 测试通过；专属 UI 与三端真实操作均未验收 |
| 正式行业注册与自有生产选择 | 共享 `RegistrationPortal` 使用正式行业 registry，提交 formal ID/能力到 company registration API；代码已接入，真实页面验收待完成 | 同一共享注册页与 API；真实页面验收待完成 | 原生注册页读取公开行业选项 API，并提交同一 formal ID/能力到 company registration API；代码已接入，开发者工具/真机待验收 | `/api/merchant/industry-options` 与企业注册 API、主行业/active entitlement 持久化、开放行业映射、能力选择和非法 capability 拒绝均由 `bash scripts/test-merchant-miniprogram-isolated.sh` 隔离 PostgreSQL HTTP 测试通过；真实注册视觉与端侧操作仍待验收 |
| 商品列表 | 有 | 有 | 有 | 同一 `/api/merchant/products`；待真实交叉验收 |
| 商品详情 | 有（列表/本地状态） | 有（复用上下文） | 有；此前依赖缺失 GET | 本轮新增 `GET /api/merchant/products/:id`；待验收 |
| 新建商品 | 有 | 有 | 有 | 同一 POST，含 `creationRequestKey` |
| 编辑商品基础资料 | 有 | 有 | 有 | 本轮补齐服务端字段写回；待验收 |
| 编辑价格/MOQ/箱规 | 有 | 有 | 有 | 同一 PUT；待验收 |
| 编辑 SKU/颜色/尺码 | 有（SKU 矩阵） | 部分 | 有（编辑模式只读增删） | SKU 变体与 JSON 双表示待专项验证 |
| 修改库存 | 有（库存页，version） | 有（库存页，version） | 有（工作区，version） | 商品 PUT 不写库存；三端均走库存调整 API |
| 上架/下架/分区 | 有 | 有 | 有 | 同一批量/单项 API；SSE 刷新 |
| 商品图片/媒体 | 有 | 有 | 有 | 同一预签名与服务端校验；待真机上传验收 |
| 订单列表/详情 | 有 | 有 | 有 | 同一 `/api/merchant/orders`；页面停留刷新待验收 |
| 订单状态推进/发货/退货 | 有 | 有 | 有 | 服务端事务；三端交叉待验收 |
| 连锁门店在线订单库存 | 有 | 有 | 有（订单流程复用同一服务端 API） | 门店模式复用 `Order.storeId`、`StockReservation` 与 `MerchantStoreStock`；隔离库 E2E 验证买家并发、员工开单、报价转单、取消释放、A/B 门店隔离及 POS/调整/调拨库存保护；Serializable 冲突映射为 409；三端实机待验收 |
| 行业演示登录入口 | 仅开发构建显示固定演示商家按钮；`industryDemo=001..008` 仅开发构建自动登录 | 同 Web，共享登录布局与入口 | 未新增演示入口 | Web/Mobile 使用统一编号映射与现有演示 API，固定登录 `demo-industry-*`；生产构建隐藏按钮并忽略直达参数，正式账号认证不变。演示登录仅在隔离测试环境验证，不开放生产演示认证 |
| 小程序 POS 销售明细/退货/现金流水/历史班次 | Web 有 | Mobile 有 | 代码补齐，运行待验收 | 复用 `/api/merchant/pos/*` 现有接口，已有销售详情/复制小票/退货确认和退款/现金收支/班次历史及详情；退货库存和现金账由服务端事务核算。微信开发者工具实际运行和门店权限验收仍待完成 |
| 客户列表/资料/备注 | 有 | 有 | 只读/部分 | 客户编辑未在全部端对等，标“部分” |
| 生态应用商店 | 有（左侧主导航一级「应用商店」，位于「系统设置」上方；生产已上线 `ec9914d`） | 有（「更多」菜单「应用商店」，底部 Tab 不变；生产已上线） | 缺失（本次未改导航、未发布） | Web/手机共用 `MerchantAppStore` 与 `/api/merchant/apps*`；隔离环境验证安装→启用→停用闭环与平台后台计数一致；生产入口以构建产物核对为准（演示登录在生产关闭）；详见 [ecosystem-app-store.md](./ecosystem-app-store.md) |
| 客户停用/启用 | 待接入（沿用资料编辑，不含停用） | 待接入 | 有 | 本轮新增 `PATCH /api/merchant/customers/:id/status`，只改 `MerchantCustomerLink.status`（不影响平台 KYC）；隔离库实测幂等、跨租户 404、无权限 403 |
| 通知业务处理状态 | 有（`businessStatus`） | 有 | 有（已处理/待处理筛选） | 本轮新增 `NotificationEvent.businessStatus` 与 `POST /api/merchant/notifications/:id/resolve`；按商家收件邮箱隔离，幂等 |
| 往来单位（客户/供应商档案） | 组件存在但未挂载 | 未挂载 | 有 | 本轮新增 `GET/POST/PATCH /api/merchant/counterparties`，租户隔离 + 重名 409；Web 组件仍待决定挂载或删除 |
| 供应商编辑 | 有 | 有 | 有（此前 404） | 本轮新增 `PATCH /api/merchant/suppliers/:id`（白名单、重名 409、`purchase.manage` 权限） |
| 商家推荐奖励 | 未接入 | 未接入 | 有（真实只读） | 推荐码签发与奖励结算未立项：接口只返回真实记录并声明 `REFERRAL_PROGRAM_NOT_LAUNCHED`；小程序增长面板改用 `allSettled`，单点失败不再拖垮看板 |
| ModaUI 图片/试衣任务 | 同步返回 | 同步返回 | 同步返回 | 服务端为同步接口，已删除 Web/小程序的轮询与“刷新恢复”，不再请求不存在的异步任务路由 |
| 门店访问码兑换（买家小程序） | — | — | 明确不可用 | 无签发方/无模型：改为提示「访问码兑换暂未开放」，不调用任何接口 |
| 店铺资料/设置 | 有 | 有 | 有（部分字段） | 同一 GET/PUT；设置事件回显与 `expectedUpdatedAt` 409 已补，待三端验收 |
| 商品编辑锁/员工权限 | 有 | 有 | 有 | 同一服务端权限；待角色矩阵验收 |
| 通知/消息 | 有 | 有 | 有（部分） | 同一服务端；跨端去重待验证 |
| ModaUI/贸易批发任务 | `ModaUIWorkbench` 增加任务模式及预览/确认/提交/轮询；此前 `MerchantPortal` 辅助面板已有独立任务流程，现有界面保留；待真实浏览器任务验收 | 共享 `ModaUIWorkbench`：接入同一任务模式及预览/确认/提交/轮询，待真实手机 Web 验收 | `merchant-miniprogram/pages/assistant`：复用既有商家/员工 JWT 与对话入口，接入受保护 `/api/merchant/modagpt/task*`，待开发者工具/真机验收 | 三端指向同一 Supervisor、`TRADING_COMPANY` Pack、工具运行时和 Prisma 数据；服务端从 JWT 确定租户。创建草稿时三端显式收集并确认供应商、商品、SKU、数量和成本；同一隔离商家执行供应商分析、草稿、无权限员工、跨租户四场景后才可标为一致 |
| ModaUI 通用聊天与图片 | 原工作台与辅助问答保持既有行为；图片 API 同步返回 | 原图片工作台功能保持；任务模式退出后仍走原图像流程 | 原对话、图片/试穿与任务以既有入口区分；公共 `miniprogram/` 文本聊天不获得商家工具权限 | 不把商家工具接入未认证 `/api/modagpt/public/chat`；本阶段不触发计费图片服务 |
| 七行业首页一致性 | 共用原版 `MerchantPortal` 首页；生产登录态页面已重载核对 | 共用原版 `MerchantMobileApp` 首页；生产登录态页面已重载核对，390×844 隔离页 7/7 同结构 | 保留小程序自己的旧版首页与导航，未在本轮修改/验收 | 商家 Web `20261029201319473-5ab5440d`、手机 Web `20261029201330774-839824fd` 已发布；线上桌面/手机截图确认旧首页结构。小程序与七账号生产登录仍待验收 |
| 七行业后台布局/AI 助手栏 | 六行业业务模块复用 `MerchantPortal` 顶栏、旧导航、响应式水平导航及上下文 GPTmoda | 六行业业务模块复用 `MerchantMobileApp` 底部导航/更多页及 ModaUI 入口 | 原生小程序按既有运行面保持，不套用 Web 构建布局 | 隔离预览仅抽验服装批发商：Web 881×485 旧水平导航与 GPTmoda 可用；手机 390×844 旧底部导航正常且无页面横向溢出。其余行业逐页视觉/AI 上下文和小程序仍待验收；发布仍阻塞，见 `merchant-industry-backends.md` 与 `merchant-seven-industry-acceptance.md` §2.6 |
| ModaUI 单页创作工作台 | 有；`fashion_studio`/`modagpt` 直接进入单页工作台（左五项、中时间流、右检查器），无卡片落地页 | 有；`ai_home` 渲染同一个 `ModaUIWorkbench`（固定全屏 + 键盘内缩，旧拖柄导航已删） | 缺失（`pages/assistant` 仍是旧结构，无创作入口；审核期 AI 开关关闭） | 三端共用同一能力注册表、推理规划与 `/api/merchant/modagpt/*`；Web 已浏览器验收，手机 App 已代码接入并构建通过（真实登录态视觉待验收），小程序未接入（见 `modaui-workbench.md` §13） |
| Apparel Studio 作品到商品草稿 | 共享 `ModaUIWorkbench`：保存 AI 结果后可填写商品必需资料，经既有商品媒体上传和 `/api/merchant/products` 创建草稿；不自动发布 | 与 Web 共用同一工作台、媒体 API、商品 API 与幂等请求 | 缺失：小程序无此工作台/结果转换入口；继续沿用已有商品创建功能 | 复用商家 JWT、`product.publish`/`store_manager`、媒体预签名上传和 Product Center 商品持久化；结果必须先保存、用户确认、只能生成 `draft`。上传或商品创建失败需明确反馈；此增量不表示六项专业能力或小程序 Studio 已完成 |
| Apparel Studio V2.0 六项能力/统一项目 | 部分：复用 ModaUI 工作台、图像/试穿/换色 API、共享项目 API；六项能力及专业 CAD 均未完整 | 部分：共享工作台和项目 API；按当前商家行业自动进入，不显示行业选择器 | 部分：assistant 增加项目列表/简报读写；按当前商家行业自动进入，无 Studio 结果到商品草稿入口 | `/api/merchant/studio-projects` 使用服务端 entitlement/template 隔离；Project/Version API 已有，三端基础项目 UI 已接入代码；六项能力及专业 CAD 未完整，真实设备/端到端同步待验收；不得因单一草稿切片标记 Studio 完成 |
| Studio 私有文件与 AI Job 项目关联（Apparel/Leather 基础面板） | Apparel/Leather 复用 `ModaUIProjects` 上传初始化/PUT/完成、文件列表/下载/版本引用、任务列表/详情与游标翻页；列表/创建/读取/版本更新显式传行业模板，服务端校验 entitlement；Apparel 任务带当前项目 ID | 与电脑端复用同一项目面板和 API | Apparel/Leather assistant 项目页复用同一私有文件、任务状态/详情 API 与游标翻页；列表/创建/读取/版本更新显式传行业模板；Apparel 从项目载入对话时带项目 ID，Leather 隐藏 Apparel 作品库及载入对话入口，避免跨行业素材/AI 上下文混用 | 后端 API 与 `ModaGptTask.projectId` 已接入并通过隔离 PostgreSQL 集成测试；客户端接入的仅为项目/文件/任务基础面板，不等于 Leather CAD/纸格/工程编辑或专属 AI 闭环完成。尚无真实对象存储凭证，Web CORS/小程序域名配置、电脑/手机真实浏览器、小程序设备验收未完成。离线只支持页面存续期间重试当前文件；关闭页面后需重新选择。不能称为真实上传/跨端同步完成 |
| AI 工作室单一入口与行业自动路由 | 使用现有 AI 入口；进入后按当前行业自动打开对应 Studio | 共用同一 AI 入口和行业上下文，不增加行业菜单 | 使用现有助手入口；按服务端授权与当前行业自动进入 | 不改公共经营目录、不新增行业选择器；`GET /api/merchant/studios` 是授权事实来源，三端展示必须与当前模板匹配；未授权时拒绝进入 |
| 多行业 Studio 授权与项目隔离 | 商家授权列表 API 可返回多个行业；项目 API 接受 `industryTemplate` 精确选择 | 共享同一授权与项目 API 契约 | 商家助手使用同一授权与项目 API | `MerchantStudioEntitlement` 服务端校验稳定 registry ID、状态和 capability；项目按 tenant + template + Studio 过滤。平台商家中心详情已接入管理员授权/撤销 UI；隔离 PostgreSQL/HTTP 验证了权限拒绝、旧主行业固化、幂等 grant/revoke、能力边界、其他行业保留及撤权后 Studio/项目 API 拒绝。自动路由 UI 与商家三端完整项目同步仍待验收 |
| 采购/生产/财务 | 有 | 有（部分） | 有（部分） | 各自模块状态见模块文档 |

### 新增行业规划与当前进度

| 功能 | 商家 Web | 商家手机 Web | 商家小程序 | 一致性与验证 |
|---|---|---|---|---|
| 第八行业：RUDA Restaurant OS | 共用商家注册页开放 `restaurant_ordering`，只提交 `RESTAURANT_OPERATOR` 和餐饮模板品类；菜单/菜品/原料/配方版本/成本读取/菜单发布与撤回、桌台目录及采购单/实际收货共用既有目录 API | 共用商家注册及桌台/菜单目录分段入口；复用 `RestaurantMenuWorkspace` 与 `RestaurantTableWorkspace`，采购/收货嵌入既有菜单工作区，不增加一级入口；均要求精确 Restaurant 模板和服务端模块权限 | 企业注册页开放 Restaurant，提交相同餐饮身份/品类；原生菜单、配方、成本、确认发布、桌台以及采购/实际收货共用同一 API | 采购 → 实际收货 → 成本 → 配方 → 菜单发布：隔离 PostgreSQL API 集成已验证数据库持久化及租户/权限/幂等/版本规则；Web/手机 Web/小程序操作代码已接入，Web 共享组件用只读模拟 API 完成 1440/820/390 视觉检查。真实商家会话的三端交叉操作和小程序开发者工具/真机仍待验证。POS、支付、KDS、预约、外卖履约及 Restaurant AI Studio 真实模型闭环仍未开放。详见 [restaurant-ordering.md](./restaurant-ordering.md) 与 [identity-merchant-onboarding.md](./identity-merchant-onboarding.md) |

## 3. 本轮修改的逐端检查项

| 检查项 | Web | 手机 Web | 小程序 |
|---|---|---|---|
| 商品详情 GET 可用 | 复用列表状态；不新增调用 | 复用上下文；不新增调用 | `product-detail`、`product-form`、首页最近商品均使用新 GET |
| 商品字段写回 | `updateProduct` 发送版本 | 同 | 编辑保存发送 `expectedUpdatedAt` |
| 商品并发冲突 | 提示并刷新 | 提示并刷新 | 提示并保留表单，提示重新打开 |
| 库存不被商品保存覆盖 | 服务端保留库存 | 同 | 编辑模式不提交库存 |
| 跨端刷新 | SSE + 30 秒 + 前台恢复 | 同 | 列表 30 秒 + onShow；详情 onShow |
| 设置事件回显 | 设置页重新 GET | 设置页重新 GET | 重新进入页面 GET |
| 设置并发冲突 | 409 提示，要求重新打开设置 | 409 提示并重新加载最新值 | 小程序的设置只读/部分字段，不提交版本 |
| 租户缓存隔离 | 登录/退出/切换清理 | 同 | 独立会话；退出清 token |

## 4. 每次商家任务必须填写的变更记录

新增记录时复制以下模板：

| 日期 | 功能/模块 | Web 文件/API | 手机 Web 文件/API | 小程序文件/API | 数据/权限影响 | 测试 | 状态 |
|---|---|---|---|---|---|---|---|
| 2026-10-26 | 跨端数据一致性 P0 | `MerchantPortal.tsx`、`B2BContext.tsx`、`src/api/client.ts`、`server.ts` | 同共享层、`MerchantMobileApp.tsx` | `product-detail`、`product-form`、`products`、`orders`、`utils/api.js` | 商品详情/更新、设置版本、缓存、并发；无迁移 | `merchant-cross-device-contract.test.ts` + `merchant-sync-events.test.ts` 9/9；全量单测 935/935；类型检查与双端构建通过 | 部分完成（真实三端验收待执行） |
| 2026-10-29 | 连锁店门店库存履约与平台商家中心 | `server.ts`、`merchantStoreFulfillment.ts`、平台商家中心共享组件 | 同一商家 API；平台商家中心复用组件 | `pages/orders` 复用订单 API；原生 POS 已补详情/退货/现金流水/班次历史 | 门店库存沿用 `MerchantStoreStock`/`StockReservation`/`StockMovement`，无 schema 迁移；商家中心只读 API 需 `merchants.review`；生产未部署 | 隔离七行业 E2E 12/12、类型检查通过；平台商家中心 API 权限/查询覆盖自动化；浏览器/微信工具截图待验 | 部分完成（端侧和生产验收待执行） |
| 2026-10-29 | 七行业演示登录与小程序 POS 业务入口 | `MerchantLogin.tsx` 共享行业入口；统一登录 API 与会话 | 同 Web | `pages/pos` 销售详情/小票复制、退货退款、现金流水、历史班次 | 演示登录仅映射固定 `demo-industry-*`；POS 只复用现有 API/租户/门店权限；无 schema 迁移 | 七行业登录、平台商家中心、门店买家并发/员工/报价订单及库存保护隔离 E2E 12/12；`npm run lint` 通过；微信开发者工具和真实截图仍待执行 | 部分完成（代码及自动化完成，实机待验收） |
| 2026-10-26 | ModaUI 底部悬浮条收口 | 共享 `MerchantAiHome.tsx`：创作设置底部面板（`role="dialog"` + 安全区内联 padding）、任务模式勾选项与可关闭胶囊、任务模式与创作模式互斥 | 同共享组件；拖柄 40px 命中区、`visualViewport` 键盘 inset | `pages/assistant`：拖柄高度 44rpx→64rpx（约 32px 触控高度），点击/拖动（18px 阈值）同一 `setNavigationOpen` | 无 API/数据/权限变更；任务模式仍走既有 `/api/merchant/modagpt/task` 预览链路 | 全量单测 941/941；定向 `merchant-modagpt-layout`/`merchant-miniprogram-ui`/`ui-translation-copy` 20/20；`tsc` 0；`vite` 本地 lib 构建 0；Playwright 390×844 + 320×700 + 1440×900 真实会话通过（面板底部留白 12px、导航拖起/拖落、任务模式胶囊与占位、点击胶囊退出任务模式后 `chipCount=0`、320px 胶囊行 296=296 无横向溢出）；小程序 `node --check` 通过 | 部分完成（小程序视觉与真机触控待验收） |
| 2026-10-26 | ModaUI 聊天布局 | 共享 `MerchantAiHome.tsx`：9 项分组菜单、四个常驻快捷胶囊、`lg:max-w-[880px]`、历史标题 | 同共享组件；`MerchantMobileApp.tsx` 默认隐藏导航、`visualViewport` 键盘 inset、焦点收起 | `pages/assistant`：左返回/中标题/右更多、9 项分组菜单（68rpx 行高）、四个快捷胶囊、细拖柄、`custom-tab-bar.setHidden`（原生回退） | 无 API/数据/权限变更；菜单动作复用现有会话、创作、知识库、套餐与退出 | 全量 936/936；定向 24/24；`tsc` 0；手机与 Web 构建 0；真实会话 390/320/1024/1440 Playwright 通过；小程序 `node --check` 通过 | 部分完成（套餐目录 500 已于 2026-10-27 修复上线；小程序视觉/触控待真机） |
| 2026-10-26 | ModaUI 全粒子核心上线（含助手面板） | `MerchantPortal.tsx`：助手面板空态改用共享 `ModaUICore`（`idle/thinking/success/error` 由 `assistantBusy`、真实请求成功/失败驱动），旧紫色 `Sparkles` 空态与面板内紫色任务预览/任务模式配色改为黑白中性；共享 `MerchantAiHome.tsx`：手机首屏核心宽度改为 `min(60vw,240px)` | 同共享 `MerchantAiHome`（`MerchantMobileApp.tsx` 直接引用），核心宽度随视口缩放 | `pages/assistant` 未改动（本期不涉及小程序发版）；无 API/数据/权限变更 | 只复用既有 `/api/merchant/assistant/query` 与 `submitAssistantQuestion`，无新增接口 | `tsc` 0；定向 30/30；web/mobile 构建 0；生产 `current.json` 已切到 web `20261026201913350-d277141e`、mobile `20261026201924572-1c048645`；生产域名真实会话 1440×900 面板、390×844/320×700 手机首屏与真实提问均通过 | 部分完成（小程序真机、麦克风与 TTS 待验） |
| 2026-10-26 | ModaUI 核心白底灰阶配色 | `modaui/coreShaders.ts`：墨色 `0.085/0.085/0.095`、头部 `baseAlpha 0.94`、背面遮挡下限 0.60、`kind=4` 高光由纯白改浅灰 `0.56/0.56/0.59`（alpha 0.78）；`coreParticles.ts`：尘埃浓度 0.44–0.62；`modaCoreEngine.ts`：墨色 uniform 与注释；`merchant-admin-common.css`：降级核心 `::after` 白色高光改极淡中灰 | 同共享 `MerchantAiHome` 与 `ModaUICore`，无需单独改动 | `utils/moda-core.js`：墨点 `rgba(17,17,19,alpha)`、高光 `rgba(158,158,164,0.92)`、尘埃浓度与 WebGL 版一致 | 无 API/数据/权限变更；仅视觉令牌 | `tsc` 0；定向 30/30；组件级 Chromium 截图 `ink_mean` ≈170（WebGL）/≈118（小程序），无纯白粒子；`build:app` web/mobile 均 0；生产 `current.json` 已切到 web `20261026205545549-7ad3351d`、mobile `20261026205545550-d269c133`；生产域名真实会话 1440×900 面板、390×844/320×700 手机空态均 `webgl` 且持续动画、无报错；`--disable-webgl` 降级 `css` 正常 | 部分完成（小程序真机与微信开发者工具待验收） |
| 2026-10-27 | ModaUI 数字生命 V4（粒子与对话实时融合） | 新增 `modaui/modaCoreLife.ts` 事件通道（输入/提交/真实文本片段/完成/失败/语音）；`modaui/coreShaders.ts` 增加 `uLife`（聚拢/前移/流动/脉冲）与 `uEnergy`，前移为相机空间真实位移；`modaui/modaCoreEngine.ts` 每帧读取并阻尼、按画布面积决定粒子数（常驻小核心 3000，其余保持手机 9000 / 桌面 16000）；`modaui/ModaUICore.tsx` 新增 `life` 属性、`data-modaui-core-phase`/`data-modaui-life`；`MerchantAiHome.tsx` 接线并逐字呈现真实回复、对话中常驻 56px 核心；`MerchantPortal.tsx` 助手面板同通道 + 96px 核心 + 逐字呈现 | 同共享 `MerchantAiHome`（`MerchantMobileApp.tsx` 直接引用），手机端自动获得同一事件链与小核心布局 | `pages/assistant` 未接入（本轮明确不做，仍只按 `state` 播放），不做发版 | 无 API/数据库/权限/计费变更；`/api/merchant/assistant/query` 契约与整包返回不变；逐字呈现仅是同一段真实文本的展示节奏，未新增 SSE，文档 §14.3 已如实说明 | `tsc` 0；`merchant-modaui-core` 11/11（新增 3 项：事件通道行为、失败/中断无定时器伪造、两端接线）；全量单测待跑；`build:app` web `20261027005219298-f640f999`、mobile `20261027005231633-261d9508` 均 0；生产 `current.json` 已确认 | 部分完成（小程序未接入；线上实测见模块文档 §14.9） |


| 2026-10-27 | ModaUI V5 对话内嵌式粒子智能体 | 新增 `modaui/modaCoreStage.ts`（单一舞台：宿主搬迁 + 逐帧实测锚点 + 微任务合并 + DOM 自愈）、`modaui/modaCoreStageMath.ts`（锚点优先级/旅行插值/粒子预算）、`modaui/ModaCoreStage.tsx`（`ModaCoreStageProvider` + `ModaCoreAnchor`）；`ModaUICore` 增加 `rendererRef`；`modaCoreEngine` 增加 `setParticleCount` 与 `uCoreHeight`；`coreShaders` 小尺寸点补偿；`MerchantAiHome.tsx`/`MerchantPortal.tsx`：删除首页 72px 与面板 96px 常驻核心、删除 `radial-gradient` 静态头像点，改为 hero/ reply 两种锚点（回复首行 `float-left h-8 w-8`），打字只在大核心阶段驱动 `input:*` | 同共享 `MerchantAiHome`；`MerchantMobileApp.tsx` 直接引用，自动获得同一舞台与内嵌小头部 | `pages/assistant` 未接入（明确不做，不做发版） | 无 API/数据库/权限/计费变更；`/api/merchant/assistant/query` 契约不变；`modaCoreLife` 收紧：输入事件不得覆盖 `sending/responding/complete/error` | `tsc` 0；`merchant-modaui-core` 14/14（新增 3 项：舞台/预算/旅行、只移动宿主不建第二渲染器、打字不打断回答）；`build:app` web `20261027022735458-ee400daa`、mobile `20261027022747459-9ab092a2` 均 0 且 `current.json` 已确认；线上真实会话 1440×900 面板 + 390×844 全屏聊天：300/234px → 32px 连续移动（14 次 `fixed` 采样、尺寸单调下降）、真实文本流同步、`stages=1 canvases=1`、多轮探针保持、打字不动核心、故障注入 500 后 `error → idle` 且核心不消失、无 `pageerror`；Playwright 真实录屏 webm 两段 | 部分完成（小程序未接入；桌面全屏聊天页对话态、真实语音/麦克风未验收） |
| 2026-10-27 | ModaUI V6 对话精简与自然回复 | 删除“数据依据”行与“按钮仅打开页面/不自动保存”提示；新增共享 `AssistantReplyActions`（分享/复制/删除三个 `h-7 w-7` 灰阶图标）；隐藏“重新生成”；任务模式改为图标开关；回复按自然片段呈现 | 同共享 `MerchantAiHome`：同一组件、同一 DELETE 接口，菜单项统一为“任务模式” | `pages/assistant`：移除 `data-basis` 与反馈按钮，新增复制/删除图标（`wx.setClipboardData`、`wx.showModal` + 同一 DELETE 接口） | 新增 `DELETE /api/merchant/assistant/messages/:id`（商家 + actor 隔离、仅 assistant、事务内清理无主 `ModaGptBrainFeedback`）；`dataBasis` 继续写入 metadata 但不在聊天展示；`src/server/merchantSupportAi.ts` 提示词改为自然短回复并禁止输出系统说明 | `tsc` 0；`merchant-assistant-conversation` 9/9；定向 5 个测试文件 79/79；小程序 `node --check` 0；真实页面截图与三端视觉待验收 | 部分完成（生产 Web/手机已部署验收；小程序未上传、真机待验收） |
| 2026-10-27 | 全站生产发布（含 ModaUI 套餐目录修复） | 共享代码：`modagptBilling.ts` 与服务端目录查询限定 `modaGptPlanCodes`；`AssistantReplyActions` 文案目录补 `复制/Copia` | 同共享修复；生产 release `20261027032548102-b180f0f5` | `pages/assistant` 本轮无代码改动；未上传（无微信密钥/CI） | 无迁移、无价格/额度/购买状态变更；商家接口返回 5 个套餐 | 全量单测 966/966；`tsc` 0；六端构建 0；`smoke:post-deploy` 通过；生产真实商家会话：手机 390×844 套餐弹窗 5 档、桌面 1440×900 正常，无横向溢出/5xx | 部分完成（Web/手机已上线；小程序未上传、真机待验收） |

| 2026-10-27 | ModaUI V7 神经生命体（替换全粒子人头） | 新增 `modaui/neuralLifeform.ts`（细胞/纤维/尘埃几何 + `animateNeuralCell()` + `isInsideLifeform()`，固定种子 20261027）；重写 `modaui/coreShaders.ts`（精灵程序 + 纤维/脉冲双通道程序，`lifeformPoint()` 与 TS 同系数）、`modaui/modaCoreEngine.ts`（单 VAO 四次 `drawArrays`、`FIBER_STRIDE=16` 复用脉冲几何、`PROJECTION_SCALE=0.86` 投影留白、纤维浓度基线 0.2、`document` 级 `pointermove`/`pointerdown` 冲击波）；删除人头版 `coreParticles.ts` | 同共享 `MerchantAiHome` 与 `ModaUICore`，`MerchantMobileApp.tsx` 直接引用，手机端自动获得同一生命体与同一预算换算 | `utils/moda-core.js` 重写：`buildCells`/`buildFibers`/`buildDust`/`buildLifeform`/`animateCell` 与 TS 同随机序列同系数，`FOV=32°`、`VIEW_DISTANCE=3.55`、`PROJECTION_SCALE=0.86`、纤维浓度 `0.2+0.12*energy`，Canvas 2D 逐帧绘制细胞/纤维/尘埃/脉冲 | 无 API/数据库/权限/计费变更；纯视觉与几何替换 | `tsc` 0；`merchant-modaui-core` 16/16（含投影留白与纤维基线两端同值断言）；定向 `merchant-modagpt-layout`+`merchant-miniprogram-ui`+`ui-translation-copy` 22/22；小程序 `node --check` 0；真实 headless Chromium WebGL2 四态 111–113 帧、灰度通道差 ≤6、球体不裁切；同一 `moda-core.js` 在 Chromium Canvas 2D 逐帧渲染成功（938 粒子/458 细胞/832 纤维）；`build:app` web `20261027201914644-261992e7`、mobile `20261027201914639-f15f7850` 均 0（产物含 `lifeformPoint` 与 0.86，无 `headSurfacePoint`）；未发布 | 部分完成（真实设备/页面尺寸观感、小程序真机、生产发布待执行） |
| 2026-10-27 | ModaUI V7.1 主动生命运动（主体位置/深度/尺寸/姿态 + 状态编排） | 新增 `modaui/modaCoreMotion.ts`（`MOTION_LIMITS`/`MOTION_BUDGET`/`createModaCoreMotion()`：7 个独立通道的临界阻尼弹簧、固定种子事件编排、构图软限幅、`setViewport()` 小画布收紧）；`coreShaders.ts` 两个程序都加 `uBody`/`uBodyTilt` 与 `bodyTransform()`，删除原 `uLife.y × 0.42` 的无界前移；`modaCoreEngine.ts` 每帧喂状态权重/生命通道/活动度给控制器，`PROJECTION_SCALE` 改由 `MOTION_BUDGET.projectionScale`（0.76）单一来源，`getStats().motion` 暴露位置/深度/尺寸/姿态/外接占比 | 同共享 `ModaUICore`/`ModaCoreStage`：桌面与手机网页端同一 canvas、同一控制器，无第二套渲染器；生产 release `20261027211629658-012b9316` / `20261027211707148-a145d204` | `utils/moda-core.js` 镜像同一套常量（`MOTION_SEED`/`MOTION_LIMITS`/`MOTION_BUDGET` 逐项同值）、`createMotion()`、`bodyTransform()` 与 `setViewport()`；细胞/尘埃经主体变换后再投影，纤维与脉冲复用同一批屏幕坐标 | 无 API/数据库/权限/计费变更；`activity` 由引擎内部从能量/成功/流式推导，不上行 | `tsc` 0；`merchant-modaui-core` 22/22；全量单测 974/974；小程序 `node --check` 0；真实 WebGL2 300/234/32/手机 390 四场景各 ≈1320 帧采样（位移 14.2px、深度 0.1285、倾角 8.6°、单帧跳变 0.1px、外接峰值 0.891、回答态最小边距 9.5px、灰阶差 ≤5）；小程序 Canvas 2D 双画布（320 + 32）验证 `setViewport()` 生效；web/mobile 已 `publish:app`；`smoke:post-deploy` 因生产根路径 302→`/merchant`（脚本期望 `/it/`）失败，与本轮无关 | 部分完成（真实 GPU 观感、小程序真机、根路径冒烟一致性问题待处理） |
| 2026-10-27 | ModaUI V8 自主数字生命引擎（BrainBehaviorController） | 删除 `modaui/modaCoreMotion.ts`，新增 `modaui/modaBrainBehavior.ts`（`BRAIN_SEED`/`BRAIN_LIMITS`/`BRAIN_BUDGET`/`createModaBrainBehavior()`：11 种行为 `drift/tilt/settle/approach/retreat/contract/expand/focus/radiate/recoil/travel`、状态权重×能量契合×重复抑制的选择器、7.5s 换位冷却、行为后停顿、位置基准 `home` 与 20s 回中、`softLimit()` 软边界、`dynamics(agitation/cohesion/outflow/pulse)` 内部动态、`setQuality()` 降级、`presentation` 呈现模式）；`coreShaders.ts` 两个程序新增 `uCognition` 并接入细胞聚合/激活/脉冲外传；`modaCoreEngine.ts` 每帧喂行为控制器并写 `uCognition`、新增 `setPresentation()`、`getStats().motion` 暴露 `behavior/kind/speed/dwelling/dynamics`、`__modauiBrainMotion` 验收探针、帧时间超预算先降运动再降分辨率；`modaCoreStage.ts` 暴露呈现模式（`hero`=stage / `reply`=inline），`ModaCoreStage.tsx` 同步给渲染器 | 同共享 `ModaUICore`/`ModaCoreStage`：桌面与手机网页端同一 canvas、同一控制器、同一呈现模式通道，无第二套渲染器/动画循环 | `utils/moda-core.js` 镜像 `BRAIN_SEED`/`BRAIN_LIMITS`/`BRAIN_BUDGET`（逐项同值）、`createBrainBehavior()`（同行为集/冷却/停顿/位置基准/软限幅）、`createBrainRandom`；细胞/尘埃/纤维/脉冲按 `dynamics` 收紧、增亮、加速，32px 画布自动 `presentation: inline` 并禁用宏观换位 | 无 API/数据库/权限/计费变更；无新增依赖；未发布生产 | `tsc` 0；`merchant-modaui-core` 26/26；全量单测 978/978；小程序 `node --check` 0；真实 WebGL2 录制 85.6s（桌面 300px：位移 47.7×27.1px、换位 3 次、11/11 行为、停顿 19.2%、视在尺寸差 12.8%、外接 0.94、画布最小边距 8.5px、彩度 ≤6、0 错误）+ 手机 390×844（48.0×26.8px、3 次、最小边距 14px）+ 内嵌 32px 40.2s（换位 0、外接 0.6875=上限、边距 3px）+ 小程序 Canvas 2D 65.3s（41.3×27.5px、换位 3 次、外接 0.94/小核心 0.6875）；视频 `desktop-300.mp4` 88.0s、`mobile-390.mp4` 88.0s、`inline-32.mp4` 42.7s、`mini.mp4` 67.7s | 部分完成（真实 GPU 观感、微信真机、生产发布待授权） |
| 2026-10-27 | ModaUI 手机 App 接入 + 引擎事实清单 | `MerchantMobileApp.tsx`：`ai_home` 改渲染同一个 `lazy(ModaUIWorkbench)`，删除 `aiNavigationOpen`/`toggleAiNavigation` 与旧 `MerchantAiHome` 引用；`src/shared/portalDomains.ts`：删除 `ruda.fashion → ruda.fashion` 自跳转、`b2b.ruda.fashion` 改指向 `PORTAL_DOMAINS.merchant`；新增 `docs/engineering/modules/modaui-engines.md` | 手机 App `ai_home` 与手机 Web 同一工作台；Web 不变 | 未改动（`pages/assistant` 仍无创作入口，审核开关仍关闭） | 无新增 API/迁移/计费；真实签名会话复核 `entitlements` 200、`images` 403 `MODAGPT_UPGRADE_REQUIRED`、额度与资产前后不变 | `tsc` 0；全量 988/988（`portal-domains` 4/4）；`build:app:merchant-admin-mobile` 0（`20261027231831819-98c881d6`，未发布）；证据 `docs/engineering/audit/modaui-workbench-2026-10-27/p0-real-api-evidence.json` | 部分完成（真实引擎出图受 provider 缺失阻塞；手机 App 真实登录态视觉与小程序待验收） |
| 2026-10-27 | ModaUI 单页创作工作台（五项能力 + 推理中枢） | 新增 `modaui/modaWorkbenchCapabilities.ts`（能力注册表与可用性判定）、`modaui/modaWorkbenchPlan.ts`（意图/计划/缺口/硬约束纯函数）、`modaui/ModaUIWorkbench.tsx`（单页工作台：顶栏 + 五项左栏/手机胶囊 + 时间流结果 + 检查器 + 素材抽屉 + 设置弹层 + 内嵌 DigitalLife）；`MerchantPortal.tsx` 删除四卡片落地页，`fashion_studio` 与 `modagpt` 直接渲染工作台；`ModaGptGarmentRecolor.tsx` 增加 `initialImageDataUrl` 与 `onSaved(detail)` | 同一响应式页面同时服务 1440/1024/390/320；手机 App 端本轮保持旧组件（明确记录缺口） | 小程序未改动；`pages/assistant` 未接入 | 复用既有 `/api/merchant/modagpt/images`（imageGeneration/tryOn）、`/tasks/:key` 恢复、`/designs` 保存与 `/entitlements`；无新增 API、无数据库变更、无计费规则变更 | `tsc`（`src/`）0 错误；工作台与布局单测 16/16；全量 986/988（2 条失败均为工作区既有 `portal-domains` 与未提交域名变更不一致）；文案目录 9/9；`build:app:merchant-admin-web` 0（`20261027225450945-0ee0cef9`，未发布）；Playwright 1440/1024/390/320：溢出 0、`webgl` 核心、0 控制台错误、组合计划与「棚拍未接入」提示、结果块 1 个、试穿双框、视频未接入提示；截图见 `docs/engineering/audit/modaui-workbench-2026-10-27/` | 部分完成（真实会话出图/手机 App/小程序/发布待办） |
| 2026-10-28 | 平台全局开关（时尚版块 / ModaUI）三端联动 | `MerchantPortal.tsx`：`useModuleAvailability()` 读取 `/api/public/feature-flags`，ModaUI 关闭时隐藏「创作空间」入口并渲染统一提示；服务端 5 个 AI 写入口在额度预留前返回 403 `MODAUI_DISABLED` | 同共享 `moduleAvailability.ts` + `MerchantMobileApp.tsx`：`ai_home` 标签隐藏与提示 | `merchant-miniprogram/utils/feature-flags.js`：读取 `/api/merchant/feature-flags`（需租户身份，未登录 401），`review-features.js` 取「全局开关 ∩ 评审开关」交集；`pages/assistant` 同步 | 无新增 API/迁移/计费；时尚关闭只停用入口与 `/api/fashion/*`（403 `FASHION_MODULE_DISABLED`），不删除任何数据；开关值唯一权威来源 `logs/feature-flags.json` | 服务端真实请求见 `docs/engineering/evidence/feature-switches/verification.json`（`failures: []`）；`tests/platform-global-switches.test.ts`、`platform-feature-flags.test.ts`、`modaui-miniprogram-flag.test.ts` 通过；`tsc` 0 | 部分完成（商家 Web/手机 Web 入口隐藏与商家小程序真机待验收） |
| 2026-10-28 | 七种行业商家后台（强隔离） | `MerchantAdminApp` 改为 `merchant-admin-industries/registry` 按 `workspace.templateId` 加载独立行业模块；新增 6 个行业目录（服装批发/贸易/百货/箱包/综合零售/百货连锁）+ 共享原语层；商品表单按行业 schema 渲染；百货连锁新增门店、门店库存、调拨页面；综合零售与连锁新增 POS 与销售记录 | 同一注册表通过 `mobileMode` 挂载到商家手机 Web；导航、商品字段、库存模型与门店/调拨能力与 Web 一致 | 未接入（小程序本轮仅同步商品一级分类目录；行业后台页面待开发，明确标记缺失） | 新增 `/api/merchant/stores*`、`/api/merchant/store-transfers`、`/api/merchant/pos/sales`，由 `requireMerchantIndustryModule` 行业守卫；新增 `MerchantStore`、`MerchantStoreStock`、`MerchantStoreTransfer(+Item)`、`MerchantPosSale(+Item)` 与 `Product.industryAttributes` 迁移；服装生产批发商后台代码与行为未改动 | `tests/merchant-industry-backends.test.ts`、`tests/merchant-onboarding-identity.test.ts`、`tsc`、商家 Web/手机 Web 构建（见交付记录） | 部分完成（Web/手机 Web 代码完成；小程序行业后台、真实门店联调与真机视觉待验收） |

| 2026-10-28 | 七种行业后台 + 演示账号 | 6 个新行业后台按 `workspace.templateId` 独立加载；服装生产批发商继续用现有门户；公开商家目录不再覆盖会话 `workspace`（否则回退旧门户） | 同一 `MerchantAdminApp` 按 `templateId` 加载同一注册表；iPhone 13 实测 4 个行业后台正常、横向溢出 0 | 小程序行业后台本轮未实现，仅商品分类同步；小程序登录仍走同一商家 JWT | 同一 `/api/merchant/*`、同一 `Merchant.industryTemplate` 守卫；门店/调拨/POS 仅在店态行业开放 | 7 个演示账号真实登录、门店 POS 扣减、调拨状态机、跨行业 403 隔离已验证；已发布 Web `20261028232135586-ca9d8424` 与手机端 `20261028232147637-cf200177` | 部分完成（Web/手机端已验收；小程序缺失） |
| 2026-10-28 | 统一身份与商家入驻闭环 | 商家 Web 仍只接受已批准商家 JWT；申请态不得进入 `/merchant`；工作区模板继续来自 `merchant.workspace` | 同 Web，商家手机 Web 只接受已批准商家 JWT 与同一工作区模板 | 商家小程序登录沿用同一商家/员工 JWT；申请态无商家 token，不能调用 `/api/merchant/*` | 新商家来源变为 `MerchantOnboardingApplication` 审核通过事务；当前正式模板仅 `apparel_production_wholesale`；客户/采购身份保留且不自动升级为商家 | 本轮新增规格与服务端/测试；真实三端登录态与总后台 UI 待验收 | 部分完成（审核 API 已作为权威路径补齐；三端真实视觉和小程序真机待验收） |
| 2026-10-28 | 七行业经营闭环 P0（员工/资料/POS/白名单） | 行业后台新增「团队权限」「消息中心」导航；设置页可编辑商家资料；POS 增加开班/交接班/现金收支/折扣/退货弹窗，销售记录显示已退金额 | 服装门户「用户与权限」改为同一 `MerchantTeamManagement`（删除本地重复 CRUD）；手机端员工管理保持原实现未改；小程序仍未实现行业后台 | 同一 `/api/merchant/employees`、`/api/merchant/settings`、`/api/merchant/pos/*`；新增 `Order.storeId`、`MerchantEmployee.storeId`（可空）；员工绑店后服务端只放行本店门店/库存/调拨/销售 | `tsc` 0；`industry-module-contract` 5/5；seed 幂等重跑 7/7 成功；`tests/e2e/industry-backends.e2e.ts` 已入库（隔离库待运行） | 部分完成（真实 POS/退货/交接班已复测；小程序、报表、打印未做） |
| 2026-11-15 | 手机端服装物料台账入口与表单验收 | 本轮未改 | `MerchantMobileApp.tsx`：物料菜单与生产工单 CTA 共用 `openMoreItem('materials')`；切回首页时即使物料面板已展开仍会滚动定位；页面标题一致 | 本轮未改；小程序真机未验收 | 无 API/schema/权限变化；复用既有物料 API 与 `canViewCosts` | `merchant-mobile-material-navigation` + `merchant-mobile-home-quick-actions` 6/6；`npm run lint`、`git diff --check`、`npm run build:app:merchant-admin-mobile`（release `20261115113611612-ac8a8d21`）通过；本地演示店主 Playwright 截图见 [`merchant-mobile-material-ledger-2026-11-15`](../evidence/merchant-mobile-material-ledger-2026-11-15/)；外部演示图 `https://modaui.com/demo-products/model-01.jpg` 返回 `net::ERR_FAILED`；直接 URL 检测仍报告近期商品缩略图容器的 `nested-cards`，精确 `/merchant` 例外只验证了 live-ignore 解析器，未验证实际 Live overlay | 部分完成（员工无成本权限会话、电脑端和小程序实测待验收） |




- 一端使用本地 mock、演示数据或 localStorage 作为正式数据。
- 一端只修改了 UI，服务端字段未持久化。
- 一端通过不同 API 或不同默认值得到不同业务结果。
- 只验证了构建或类型检查，没有真实 API/数据库/其他端读取证据。
- 冲突、权限或失败被隐藏，或提示为成功。
- 小程序未在开发者工具/真机验证，却声称视觉和交互完成。

## 门店级 POS 班次与商家资料字段（2026-10-29，第二批）

| 能力 | 电脑网页端 merchant-admin-web | 手机网页端 merchant-admin-mobile | 商家小程序 merchant-miniprogram |
| --- | --- | --- | --- |
| POS 班次按门店开/查/交班 | 已完成（IndustryPosSection 传 storeId，跨店结算前端拦截 + 服务端 403） | 已完成（同一 `IndustryWorkspace mobileMode` 渲染同一 `IndustryPosSection`，同样传 storeId；待真机截图） | 待验证（小程序无班次页面） |
| 销售小票与明细 | 已完成（弹窗 + 独立窗口打印） | 待验证 | 待验证 |
| 商家 Logo / 网站域名 / 店铺标语 / 店铺简介 | 已完成（IndustrySettingsSection + `PUT /api/merchant/storefront`） | 待验证（未展示） | 待验证（未展示） |
| 店铺营业状态（暂停/恢复展示） | 已完成 | 待验证 | 待验证 |

字段与口径以 `merchant-industry-backends.md` §16 为准；三端调用同一 `PUT /api/merchant/storefront` 与 `GET /api/merchant/settings`，不得各自维护店铺状态。

## POS 退货、现金核算与班次历史（2026-10-29，第二批）

| 能力 | 电脑网页端 merchant-admin-web | 手机网页端 merchant-admin-mobile | 商家小程序 merchant-miniprogram |
| --- | --- | --- | --- |
| 现金退款写入现金流水（服务端） | 已完成（`POST /api/merchant/pos/returns` 必写 `POS 退货` 支出流水，按门店进行中班次归属） | 同一 API，无端侧差异 | 未接入 |
| 应存现金口径（期初 + 现金销售 + 收入 − 退款 − 支出） | 已完成（`summarizePosShiftCash` 单一入口，当前班次 / 交班 / 历史共用） | 同一 API | 未接入 |
| 班次历史列表（门店 / 员工 / 日期 / 状态筛选） | 已完成（`IndustryPosShiftHistory` + `pos_shifts` 导航） | 已完成（同一组件响应式渲染；表格横向滚动，未真机截图） | 缺失 |
| 班次明细（销售 / 退款 / 现金流水） | 已完成（`GET /api/merchant/pos/shifts/:id` 展开面板） | 已完成（同一组件） | 缺失 |
| 员工筛选降级 | 已完成（无 `employees.manage` 权限时隐藏筛选，查询本身不受影响） | 同 Web | 不适用 |
| 已交班数值冻结 | 已完成（历史读取交班时写死的 `expectedCash / closingCash / cashDifference`，不随后续退货变化） | 同 Web | 不适用 |
| 小票重打 | 仅当前销售（浏览器打印窗口，未接 80mm 参数） | 同 Web | 缺失 |

- 验证：`tests/e2e/industry-backends.e2e.ts` 新增用例在三端共用 API 上真实跑通（隔离库 7/7）；班次历史与现金口径不依赖端侧实现，三端只能读取服务端结果。
- 端侧证据边界：电脑端与手机 Web 仅完成类型检查 + 构建 + 接口级 E2E，**浏览器截图与真机验收未执行**；小程序无班次 / 现金页面。不得据此标记三端视觉验收完成。

## 订单状态与库存闭环 + 七行业小程序工作台（2026-10-29，第三批）

| 能力 | 电脑网页端 merchant-admin-web | 手机网页端 merchant-admin-mobile | 商家小程序 merchant-miniprogram |
| --- | --- | --- | --- |
| 订单状态机（确认/拣货/发货/送达，含 409 非法跳转） | 已完成（沿用 `PUT /fulfill`，服务端本轮补并发抢占与错误映射） | 同一组件与 API | 已完成（`pages/orders` 的 `advanceOrder`） |
| 商家取消订单并释放库存 | 服务端已支持（本轮修复前不释放；Web 取消入口按既有页面） | 同一 API | 已完成（订单页「取消订单」二次确认 → `status=cancelled`） |
| 已收款订单取消生成退款请求 | 服务端统一处理（`refundTransaction.status='requested'`，`pending_refund`） | 同一 API | 同一 API |
| 行业上下文（服务端权威，不可伪造） | 已完成（后台能力清单直接来自共享常量） | 同一份常量 | 已完成（`GET /api/merchant/industry-context`） |
| 七行业工作台（行业指标 + 常用动作） | 已完成（既有 `IndustryWorkspace`） | 已完成（同一 `IndustryWorkspace mobileMode`） | 已完成（`pages/industry` + 7 个独立行业配置模块；**未真机验收**） |
| 行业专属商品字段 | 已完成（`IndustryProductForm`） | 同组件 | 已完成（`pages/product-form` 渲染 `productFields` 非列字段并提交 `industryAttributes`） |
| 行业属性展示 | 已完成 | 同组件 | 已完成（`pages/product-detail` 行业字段卡片） |
| 员工权限过滤 | 已完成 | 同组件 | 已完成（上下文的 `permissions` 过滤动作） |
| POS 收银 / 班次 | 已完成（共享接口） | 已完成（同一组件） | 部分完成（`pages/pos` 原生收银、班次开班/交班；历史与流水需验收） |

- 口径以 `docs/engineering/modules/merchant-industry-backends.md` §18 为准：状态转换、库存释放与行业上下文均由服务端单一实现，端侧只消费结果。
- 同批修正：`pos_shifts` 之前只写在两个零售行业的 Web manifest，未进入能力清单；已补入 `general_retail` 与 `department_chain_retail` 的 `modules`，Web 导航与小程序的模块过滤现在都基于同一份清单。
- 验证：`tests/e2e/industry-backends.e2e.ts` 隔离库 **9/9 通过**（含行业上下文不可伪造、七行业订单生命周期库存闭环）；`tests/merchant-miniprogram-industry.test.ts` **4/4 通过**；`npx tsc --noEmit` exit 0。
- 端侧证据边界：小程序**未在微信开发者工具/真机运行**，无截图；电脑端/手机 Web 未做本轮改动，仅回归既有 API。不得据代码存在宣称三端视觉验收完成。

## 2026-10-29 小程序原生收银台 + 开发者工具实机复验

| 功能 | 电脑网页端（merchant-admin-web） | 手机网页端（merchant-admin-mobile） | 商家小程序（merchant-miniprogram） |
| --- | --- | --- | --- |
| POS 收银 / 班次 | 已完成（第二批） | 已完成（同一组件） | **代码完成**：`/pages/pos/index` 门店切换、班次开班/交班、搜索/扫码、清单、收款、最近销售 |
| POS 售后退货 | 已完成 | 已完成 | 部分完成（共用 `/api/merchant/pos/returns` 的端侧流程待补） |
| 销售详情 / 小票 | 已完成 | 已完成 | 部分完成（销售详情、退款、历史班次和小票呈现待补） |

- 小程序收银台只消费 `/api/merchant/pos/*` 与 `/api/merchant/industry-context`：门店模式、可售库存、金额与折扣全部由服务端判定，端侧不重算。
- 行业工作台「收银」动作改为直达 `/pages/pos/index`；其余模块仍进通用工作台。
- 开发者工具实机（Stable 2.02.2608080 / lib 3.17.4）：`pages/industry/index.wxml` 先是 `wx:else`+`wx:for` 同节点报 `Bad attr wx:else`，改结构后又出现 `<block>` 闭合错位（`index.wxml:84:11 expect end-tag view`）；最终结构修复后登录页正常渲染。已补 `tests/merchant-miniprogram-wxml-structure.test.ts`（20 个 wxml 标签配对校验）。
- 冷启动 401 已消除：未登录时不再请求 `GET /api/merchant/feature-flags`，登录成功后强制刷新。该接口返回 401 JSON 而 `/api/merchant/industry-context` 返回 SPA HTML，可判定生产仍是**旧构建**，七行业与收银台真实数据验收需部署后重跑。
- 验证：`node --test`（全部 merchant-miniprogram 套件 + wxml directives + modaui flag）**100/100 通过**；`npx tsc --noEmit` exit 0；`git diff --check` 干净。
- 连锁店在线订单门店库存归属：设计见 `merchant-store-fulfillment.md`，**未实现、未获批准**。
- 验证：`node --test`（pos/login/industry/wxml-directives/ui）**35/35 通过**；`npx tsc --noEmit` exit 0；`git diff --check` 干净。

## 2026-10-30 生态应用商店修复与商家入口

| 功能 | 电脑网页端（merchant-admin-web） | 手机网页端（merchant-admin-mobile） | 商家小程序（merchant-miniprogram） |
| --- | --- | --- | --- |
| 生态应用商店入口 | 已完成：左侧主导航一级「应用商店」，位于「系统设置」上方，`#merchant-sidebar-tab-app-store` | 已完成：「更多」菜单「应用商店」，底部 Tab 结构不变 | 缺失：本次未改小程序导航，未发布 |
| 应用目录/安装状态 | 已有（`MerchantAppStore`） | 已有（同一组件） | 无 |

- 平台总后台空白与 `[object Object]` 根因：`AdminAppStoreMgmt.tsx` 裸 `fetch` 后 `new Error(appsData.error)`，错误信封是对象。已改为 `apiGet/apiPost/apiPut` + `describeAppStoreError`，失败时显示真实原因与「重试」，不再用空数组掩盖失败。
- 真实 schema 漂移：`AppInstallation.updatedAt` 数据库缺列导致安装 500，迁移 `20261029234500_app_installation_updated_at` 以 `ADD COLUMN IF NOT EXISTS` 补齐。
- 未新增任何应用记录、未改后台外壳与配色；生产库核对 2 个已上架应用、9 个分类、修复前 0 条安装记录（非数据丢失）。
- 验证：平台后台列表可见、无 `[object Object]`、商家 Web/手机入口可进入、安装→启用→停用均 200、平台后台 `_count.installations=1`、页面运行时报错 0；截图见 `docs/engineering/evidence/app-store/`。
- 生产迁移与正式发布、商家小程序发布均**未执行**，等待确认。

## 2026-10-30 电脑端左侧导航定型（14 项）与三个新入口

| 功能 | 电脑网页端（merchant-admin-web） | 手机网页端（merchant-admin-mobile） | 商家小程序（merchant-miniprogram） |
| --- | --- | --- | --- |
| 左侧导航结构 | 已完成：14 个一级入口（业务 9 / 应用与记录 3 / 底部固定 2），白色侧栏、浅灰选中态 | **本轮未改**（用户明确要求只做电脑端） | **本轮未改** |
| 顶部品牌位 | 已完成：改为真实 `companyLegalName`（回退 `name`），不再显示 RUDA 占位 | 未改 | 未改 |
| 应用（应用商店 / 回收站） | 已完成：`#merchant-sidebar-tab-apps` 展开「应用商店」「回收站」 | 手机端原有「更多 → 应用商店」保持不变 | 无入口（本次不改） |
| AI 聊天记录 | 已完成：跨页面上下文会话列表、搜索、完整对话、继续对话 | 无独立入口；手机端沿用助手会话菜单 | 无 |
| 最近动态 | 已完成：商品/库存/订单/应用安装事件聚合，可跳转业务页 | 无入口 | 无 |
| 回收站恢复 | 已完成：`POST /api/merchant/recycle-bin/products/:id/restore`，恢复为 `draft` 并写审计 | 无 | 无 |

- 数据源复用：`Product`、`InventoryMovement`、`Order.timeline`、`EmployeeAuditLog`、`MerchantAssistantConversation`；无新增表、无迁移。
- 权限：活动/回收站读取需 `sales.order.create` / `product.publish` / `production.report` 之一；恢复需 `product.publish` 且商品编辑未锁定；会话列表与详情按 `merchantId + actorId` 隔离。
- 规格文档：`docs/engineering/modules/merchant-admin-desktop-navigation.md`。
- 验证：`tsc` 0、`npm run test:unit` 1164/1164、`build:app:merchant-admin-web` 0、新增测试 7/7、组件级真实渲染 1440×900 与 390×844 无横向溢出与 0 控制台错误。
- 未覆盖：真实商家登录态的桌面截图（导航/顶部公司名）、手机 Web 与小程序本轮按范围未改，不参与验收。

## 2026-10-30 贸易批发 ModaUI 三端统一任务接线

| 功能 | 电脑网页端（merchant-admin-web） | 手机网页端（merchant-admin-mobile） | 商家小程序（merchant-miniprogram） |
| --- | --- | --- | --- |
| 任务预览/确认/执行/轮询 | 复用 `/api/merchant/modagpt/task/preview`、`task`、`task/:id` | 在共享 `ModaUIWorkbench` 使用同一契约 | 在 `pages/assistant` 使用 `utils/api.js` 既有认证请求封装调用同一契约 |
| 供应商分析/采购草稿/员工权限/租户隔离 | 由服务端行业 Pack、Supervisor、工具运行时、权限中间件决定 | 同一服务端规则 | 同一服务端规则；不使用公共聊天 API 执行商家业务 |
| UI 与业务边界 | 保持原工作台，不重做布局 | 仅增加任务操作状态并保持现有创作/图片工作台 | 保持原 ModaUI 页面和导航，仅在现有对话加入任务预览/结果状态 |

- 权威数据源：既有 `Supplier`、`Product`、`ProductVariant`、`MerchantPurchaseOrder`/收货关系；无 schema 或迁移变化。
- 身份与租户：复用商家 JWT；客户端不传权威 `merchantId`；每次提交/轮询由服务端授权。
- 幂等与恢复：单次已确认任务使用稳定 `Idempotency-Key`；网络结果不确定时用同一键重试；任务轮询终态和错误码在当前对话展示。
- 文档/API 契约：沿用 [trading-wholesale-ai.md](./trading-wholesale-ai.md) 的预览、提交、轮询契约；没有新增 endpoint。
- 自动化证据：`npm run test:unit` 1166/1166 通过；`npm run test:trading-wholesale:integration` 在隔离 PostgreSQL 上通过，覆盖真实 HTTP 任务、目录租户边界、采购权限拒绝、任务轮询与采购草稿写入。
- 端侧验收：桌面 Web、手机 Web 未提供已认证浏览器会话/截图；小程序未在微信开发者工具或真机运行。三端页面和真实聊天交互仍标记为待验收，不以 API 测试替代。
- 状态：**部分完成（端侧代码接线与自动化验证完成；Web、手机 Web、小程序实机/视觉验收待完成）**。

## ModaUI 四行业 AI 只读分析闭环（规格先行）

| 行业模板 | Web | 手机 Web | 商家小程序 | 权威服务/数据 |
| --- | --- | --- | --- | --- |
| `department_wholesale` | 复用商家 ModaUI 任务 API | 同一任务 API | 同一认证任务 API | 商品目录、变体/条码、`Product.industryAttributes` |
| `bags_wholesale` | 复用商家 ModaUI 任务 API | 同一任务 API | 同一认证任务 API | 商品目录、材质/尺寸/容量属性、SKU |
| `department_chain_retail` | 复用商家 ModaUI 任务 API | 同一任务 API | 同一认证任务 API | 当前商家门店、门店库存、POS 与既有调拨记录 |
| `general_retail` | 复用商家 ModaUI 任务 API | 同一任务 API | 同一认证任务 API | 当前商家 POS、销售明细、商品/条码目录 |

- 身份与能力选择：服务端从已认证商家读取 `industryTemplate`；客户端行业/merchantId 不作为授权依据。百货批发和百货连锁虽共享粗粒度 `DEPARTMENT_STORE`，必须加载不同的工具。
- 写入边界：首期只读分析；不得由 AI 直接写商品、库存、采购、POS、调拨或促销。调拨建议必须经现有人工业务流程执行。
- 同步与错误：三端任务状态/结果来自同一个 `ModaGptTask` 服务端数据源；权限拒绝、租户冲突、数据库错误进入现有失败状态，不以空结果掩盖。
- 规格：[`modaui-four-industry-ai.md`](./modaui-four-industry-ai.md)。四行业专属只读工具、真实 HTTP/隔离 PostgreSQL 验证已通过；百货/箱包输出商品资料待完善清单，连锁输出调拨候选，综合零售输出 POS+库存补货候选。三端真实登录态操作和视觉验收仍待完成；不等同于图片生成、商品写入、调拨执行或促销/采购业务闭环。

## 五行业 ModaUI 聊天呈现（规格先行）

| 运行面 | 目标入口与行为 | 权限/数据源 | 验收状态 |
|---|---|---|---|
| 商家 Web | 在现有 AI/ModaUI 版块中由 `ModaUIEntry` 路由到共享 `MerchantAiHome` 聊天组件；只显示对应行业提示，保留现有会话、任务预览/确认/轮询和结果，不新增独立 AI 入口 | 认证上下文仅作呈现；商家聊天/任务 API、Supervisor 和工具 Handler 是权威 | 代码接线完成；定向测试和 Web 构建通过；真实商家登录态及浏览器截图待验收 |
| 手机 Web | 在现有 AI/ModaUI 版块中与 Web 共用 `MerchantAiHome`、任务 API 和采购草稿确认流程，不创建第二套聊天或入口 | 同一商家 JWT、行业 Pack、员工权限和租户查询 | 代码接线完成；定向测试和手机 Web 构建通过；真实手机浏览器截图待验收 |
| 商家小程序 | 沿用现有 AI/ModaUI 原生页面与导航；使用认证会话加载服务端行业上下文，行业聊天/任务走受保护任务 API，不使用公共文本聊天执行商家业务 | 商家会话认证；服务端按商家、行业、Agent/员工权限校验 | 代码接线完成；小程序契约/WXML 测试通过；微信开发者工具/真机运行截图待验收 |
| 历史服装生产模板、服装批发模板 | 保持现有创作工作台与入口不变；正式产品目标已合并为一个服装批发行业，自有生产为注册可选能力，迁移未实施 | 当前仍按历史模板配置/权限；新生产能力映射待实现，不能把两个旧模板当作两个正式行业 | 回归旧工作区；新行业/能力映射单独开发与验收 |

- 快捷提示只填入输入框，不自动执行；贸易采购草稿仍要求供应商、商品、SKU、数量和成本确认。
- 不新增 API、数据模型、工具或外部模型调用；错误、加载、重复提交和轮询状态沿用现有聊天/任务服务契约。
- 2026-10-30 普通聊天行业角色由同一 `/api/merchant/assistant/query` 按数据库中的当前商家 `industryTemplate` 选择；不接受客户端行业身份，不改变工具/员工权限。七模板均有独立角色说明，百货批发与百货连锁明确分开。全量单测 1251/1251、类型检查和构建通过；隔离 PostgreSQL 行业任务与贸易 HTTP 集成测试各 1/1 通过。
- 完整规格见 [`modaui-workbench.md`](./modaui-workbench.md) §14。三端代码接线与本轮定向自动化验证已完成；整体仍为“部分完成/待验证”，须取得真实商家登录态、桌面/手机浏览器和微信开发者工具/真机证据。服装行业回归由入口路由测试覆盖，未改动其业务配置或 UI。

## MODAUI AI Tools 工具中心（P1 + P2 首批，2026-10-30）

| 能力 | 商家 Web | 手机 Web | 商家小程序 | 权威服务/数据 |
| --- | --- | --- | --- | --- |
| 工具清单与门禁状态 | 侧边栏「应用记录 → 工具中心」 | 「更多 → 员工系统 → 工具中心」 | 「更多 → 智能工具 → 工具中心」 | `GET /api/merchant/ai-tools`（安装/授权/试用/权限/额度一次返回） |
| 额度与试用展示 | 有（日/月额度条 + 试用剩余天数） | 有（同一组件） | 有（同一接口，原生渲染） | `quota`、`trialExpiresAt` 字段 |
| 工作中心真值 | 有（6 个中心：可用/未接通 + 原因） | 同 | 同 | `capabilities`（服务端计算，前端不推断） |
| 工具暂停/恢复 | 有 | 有 | 有 | `PATCH /api/merchant/ai-tools/:toolId/grant` |
| 文案创作 / 翻译 | 有（表单 + 结果复制） | 有 | 有 | `POST /api/merchant/ai-tools/:toolId/invoke` |
| 超额提示 | 有（`AI_TOOL_QUOTA_EXCEEDED`） | 有 | 有 | 服务端 429 + `reason` |

- 身份与租户：三端都用商家 JWT，`merchantId` 由服务端会话确定；小程序额外发送 `X-Ruda-Client` 仅用于平台开关门禁，不作为身份依据。
- 数据一致性：工具可用性、试用期、额度全部由服务端计算；前端不做乐观更新，暂停/恢复与调用后都重新拉取权威列表。
- 小程序可见性：`utils/review-features.js` 的 `aiWorkspaceIds` 纳入 `ai_tools`，与其它 ModaUI 版块共用功能开关；`utils/permissions.js` 要求 `ai.tools.use`。
- 自动化证据：`tests/ai-tools-quota.test.ts` 8 项通过；`tsc --noEmit` 0 错误；三端构建通过。
- 端侧验收：桌面 Web、手机 Web、小程序真机/开发者工具视觉与交互**尚未截图验收**，状态为**部分完成（代码与构建完成，视觉待验收）**。
- 未接通：图片/视频/语音/发布/分析五个中心在三端一致显示「未接通 + 原因」，不提供可点击入口。

## 2026-10-30 ModaUI 广告策划器 P1（商品简报 → 三套方案 → 分镜版本）

| 项目 | 电脑网页端 | 手机网页端 | 商家小程序 | 服务端真值 |
|---|---|---|---|---|
| 商品简报 | 未建入口 | 未建入口 | 未建入口 | `GET /api/merchant/ai-ad/products/:productId/brief` |
| 三套广告方案 | 未建入口 | 未建入口 | 未建入口 | `POST /api/merchant/ai-ad/concepts`（一次文本调用，事实白名单校验） |
| 工程与版本 | 未建入口 | 未建入口 | 未建入口 | `POST/GET /api/merchant/ai-ad/projects`、`PATCH /:id`、`GET /:id/versions` |
| 生成预算 | 未建入口 | 未建入口 | 未建入口 | `POST /api/merchant/ai-ad/projects/:id/estimate`（只读目录单价，不调用供应商） |

- 身份与租户：三条路由全部 `requireMerchantTenant` + `ai.tools.use`；所有查询 `where: { merchantId }`，`merchantId` 只取自会话，测试 `tests/modaui-ad-planner.test.ts` 已断言。
- 数据一致性：简报、方案、分镜、版本、预算全部落在服务端（`AiAdProject` / `AiAdConcept` / `AiAdProjectVersion`），三端未来只读同一接口，不做本地状态权威。
- 未接通：视频生成、TTS 配音、数字人、发布均无 Adapter，接口返回 `adapter_not_built` / `provider_not_configured`，不产生假视频、假音频或 0 成本记账。
- 端侧验收：三端 **UI 尚未建立**，本轮只有服务端与机械测试，状态为**部分完成（后端完成，三端界面待建）**。

### 2026-10-30 P1 商家端四屏（本轮）

| 项目 | 电脑网页端 | 手机网页端 | 商家小程序 | 服务端真值 |
|---|---|---|---|---|
| 商品简报与缺失资料 | `MerchantPortal` → 广告策划（共享组件） | 同一组件 `compact` 布局 | `pages/ad-planner/index` | `GET /api/merchant/ai-ad/products/:productId/brief` |
| 三套广告方案 | 三列并排卡片 | 纵向卡片 | 纵向卡片 | `POST /api/merchant/ai-ad/concepts` |
| 预算确认 | 右侧预算面板 + 能力状态 | 独立步骤 | 独立步骤 | `concept.costEstimate`；建工程后 `POST /:id/estimate` |
| 分镜与版本 | 折叠「高级设置」+ 版本面板 | 折叠面板 | 折叠面板 | `PATCH /api/merchant/ai-ad/projects/:id` + `GET /:id/versions` |
| 补充商品图片 | 复用 `uploadMerchantMedia`，随工程保存 `supplementImages` | 同左 | **不支持**（如实提示到电脑端或手机网页端上传） | `POST /api/merchant/ai-ad/projects` 校验 HTTPS、最多 6 张 |
| 视频/配音/数字人生成 | 禁用 + 「暂未接通」 | 禁用 + 「暂未接通」 | 禁用 + 「暂未接通」 | 无 Adapter，不产生费用 |

- 入口：电脑端侧栏「营销增长 → 广告策划」与顶部「广告策划」；手机端「更多 → 智能工具 → 广告策划」；小程序「工具中心 → 广告策划」。
- 普通商家界面只保留「选商品 / 选方案 / 确认预算 / 分镜与保存」；景别、机位、来源、模型、提示词只在「高级设置 · 逐镜头编辑」折叠区，默认收起。
- 数据一致性：三端同接口、同字段；版本恢复=以历史分镜 PATCH 成新版本，历史不被覆盖；三端都不使用本地存储冒充数据库。
- 机械证据：`tests/modaui-ad-planner-ui.test.ts` 6 项（接口、禁用态、缺失资料、三端挂载、小程序页面与 WXML 指令、文档先行）+ `tests/modaui-ad-planner.test.ts` 17 项通过。
- 端侧验收：三端代码与构建已完成；**真实商家数据、桌面/手机/小程序截图验收尚未执行**（本机无商品库与文本 Provider Key），状态为**部分完成（代码完成，真实环境与视觉待验收）**。

### 2026-10-30 P3 商家端收敛（本轮）

| 项目 | 电脑网页端 | 手机网页端 | 商家小程序 | 服务端真值 |
|---|---|---|---|---|
| 广告用途 | 4 个用途按钮（数字人禁用 + 未接通） | 同左 | 同左（禁用样式 + 提示） | 映射为 `goal`，仍由服务端校验 |
| 发布平台 | 7 个平台按钮 | 同左 | 同左 | 映射为 `aspectRatio`；发布能力未接通 |
| 技术模式 | **已删除** | **已删除** | **已删除** | 无相关字段 |
| 目标/语言/画幅/分辨率下拉 | **已删除** | **已删除** | **已删除** | 客户端不再提交可选值，使用平台默认 |
| 镜头技术字段 | 「专业精修（可选）」默认折叠 | 同左 | `shotProOpen` 默认 false | `storyboard` 同一份数据 |
| 自动保存 | 保留 1500ms 防抖 + 内容签名 | 同左 | 同左 | `PATCH /api/merchant/ai-ad/projects/:id` |

- 机械证据：`tests/modaui-ad-planner-ui.test.ts` 新增 2 项（P3 商业选择、专业层可选）+ P3 文档先行；`node --check` 与 WXML 指令检查 0 问题；`tsc --noEmit` 0。
- 未接通：视频生成、数字人、TTS、平台发布。用途与平台按钮不产生任何供应商调用，只决定请求字段与画幅。
- 端侧验收：**待验证**（本轮只做代码与机械检查，未取得桌面/手机/小程序截图）。

## RUDA 多行业 AI Studio V2.0（入口已接线，专业闭环待实施）

本功能的三端架构/API contract 必须同批规划。电脑端专业能力优先，手机 Web 与小程序基础入口、同一项目读取/恢复/文件/任务状态及版本同步与共享后端同期建设；不得等电脑端完整才启动移动端基础能力。下表记录当前实现与缺口，不能据入口接线宣称专业业务闭环或三端已验收。

| 能力 | 电脑网页端（merchant-admin-web） | 手机网页端（merchant-admin-mobile） | 商家小程序（merchant-miniprogram） | 共享权威契约/当前状态 |
|---|---|---|---|---|
| 登录/行业识别/Studio 匹配 | 复用商家后台登录；授权后按当前行业自动路由 | 复用手机端现有会话与授权校验 | 复用现有小程序商家登录与强制刷新后的授权校验 | 三端代码均使用服务端 entitlement 列表，稳定 Industry/Studio ID；单元及隔离 API 测试通过。当前本地数据库缺少 `MerchantStudioEntitlement` 表，浏览器 GET 返回 500，迁移未应用，端到端待验收 |
| Studio 入口/专业工作流 | 首个完整专业工作站；CAD、模板、工程参数、质量检测、生产资料按行业授权 | 同一 Studio 的移动工作流，保留原导航，复杂 CAD 精细编辑不要求移动端 | 便捷入口与轻操作，不复制后台或手机 Web 布局 | 同一 Studio 能力和权限事实，布局/操作独立；目标规格见 [`modaui-industry-studios-v2.md`](./modaui-industry-studios-v2.md) |
| AI 对话与任务 | 项目工作台发起任务时带当前 `projectId`，可读状态与详情 | 与电脑端共用任务上下文和读取 API | 从项目载入对话时带 `projectId`，可读状态与详情 | 后端与三端调用代码已接入现有 `ModaGptTask`；首批只支持项目模板与商家当前主行业 AI 上下文一致，其他行业返回 409。Provider 实际调用/费用、设备实测、任务失败后的人工重试闭环仍未验收 |
| 项目/版本/CAD | 创建/编辑专业项目与 CAD；保存受版本条件保护 | 打开同一 Project ID、查看结构/纸格/3D（支持时）、基本尺寸编辑、版本历史 | 查看项目历史、结果及简单修改/确认 | Project/Version API 与 File/Job 数据关系已落库；隔离 PostgreSQL 全迁移、租户/行业/授权、版本/幂等相关集成测试通过。三端项目基础 UI 有代码，工作区数据库未执行迁移，CAD 专业闭环与真实同步仍待实施 |
| 照片/文件 | Apparel/Leather 项目面板上传、列出和短时签名下载，支持游标翻页 | 与电脑端共用上传/列表/下载 API，支持游标翻页 | Apparel/Leather assistant 项目页相册/相机或文件选择上传；图片/PDF 预览，DXF/GLB 提示在电脑端打开，列表支持游标翻页 | 后端提供私有文件初始化、HeadObject 完成确认、项目列表、短期签名下载及引用保护删除；客户端代码已接线。依赖私有 S3/R2；无真实对象存储凭证验证，Web CORS 与小程序 request 域名配置、设备上传尚未验收 |
| 权限/审批/通知 | 服务端员工/行业/Studio 授权；审批/生产状态 | 同一权限；审批与进度适配移动布局 | 同一权限；站内消息/任务通知入口 | 服务端逐请求校验；同一任务/项目状态，事件或受控刷新；端 UI 不构成授权 |
| 电脑改动同步 | 写入并以服务端 revision 为准 | 收到事件/恢复后重新读取最新版本 | `onShow`/通知后读取服务端最新版本 | 不以 localStorage 作为 CAD/项目权威来源；幂等、事务和 expectedRevision 尚待建设/验证 |

### V2 跨端项目验收计划

| 编号 | 操作顺序 | 预期结果 | 状态 |
|---|---|---|---|
| 1 | 电脑上传照片 → 手机打开同项目 | 同一 Project/File ID、权限过滤正确、显示服务端文件 | 待实施/验收 |
| 2 | 手机拍照上传 → 电脑打开项目 | 服务端文件持久化，电脑读到同一 File ID 和版本 | 待实施/验收 |
| 3 | 手机提交 AI 自然语言修改 → 电脑查看 | 同一 AI Job ID、项目版本递增，电脑读到服务端最终结果 | 待实施/验收 |
| 4 | 电脑修改 CAD → 手机查看 | 手机看到同一 Pattern Version；不能丢弃未知工程字段 | 待实施/验收 |
| 5 | 小程序确认方案 → 电脑查看 | 同一确认状态/用户/项目版本，服务端记录确认结果 | 待实施/验收 |
| 6 | 旧客户端以过期 revision 保存 | 返回冲突，保留新版本，提示用户重新载入/合并；不得静默覆盖 | 待实施/验收 |
| 7 | 重复 AI 提交/部件操作 | 相同幂等键不重复生成任务/部件 | 待实施/验收 |
| 8 | 上传/任务过程中断网再恢复 | 可通过原 File/AI Job ID 恢复或明确重试；不会重复扣费/生成 | 待实施/验收 |
| 9 | 多人同时编辑一个工程项目 | 服务端事务/版本检查拒绝冲突写，提示冲突双方；无静默 last-write-wins | 待实施/验收 |

UI 约束：电脑、手机 Web、小程序分别沿用自身原有 RUDA 布局、颜色、字体、间距、导航和交互；只统一业务字段、状态、权限及服务端版本。不得因本项目做界面重设计。视觉取值见 [`design-values.md`](../design-values.md) 与 [`mobile-design-system.md`](../mobile-design-system.md)；小程序继续使用自身 WXSS/rpx 规范。

端侧状态：Leather/Apparel 共用 API、schema、migration 和租户/行业/权限/幂等/版本冲突集成测试已落代码，并在临时隔离 PostgreSQL 全量 migration 验证通过；本轮又通过同一隔离测试覆盖私有文件元数据与 Job 项目关联。三端基础 UI/API 调用已接线，但工作区数据库仍未执行 migration，授权路由可能因缺少 entitlement 表返回 500；生产迁移未应用。电脑/手机 Web 本轮未做真实登录后的 Studio 操作检查，小程序未做开发者工具/真机检查；真实对象存储和完整端到端同步、专业工作流仍为“待实施/验收”，不得标记一致或完成。
