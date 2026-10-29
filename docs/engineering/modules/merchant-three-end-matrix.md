# 商家后台三端功能一致性矩阵

- 日期：2026-10-27
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
| 七行业演示登录入口 | 共用旧版 `MerchantLogin`；`industryDemo=001..007` 直达固定行业 | 同 Web，沿用旧版手机登录布局 | 未新增演示入口 | Web/Mobile 使用共享编号映射与现有演示 API，自动登录固定 `demo-industry-*` 商家；不传密码/令牌/商家 ID。页面布局不变；直达 URL 的会话切换、七账号密码登录与正式/演示隔离待本轮隔离实测及生产核验 |
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
| ModaUI/AI | 有；桌面宽度 880px | 有；9 项分组菜单、四个常驻快捷胶囊、导航默认收于细拖柄、创作设置底部面板、任务模式互斥 | 审核期隐藏；`pages/assistant` 已同步同一结构（菜单 68rpx 行高、四个快捷胶囊、`setHidden`、64rpx 拖柄） | 三端业务规则一致；Web/手机真实会话 Playwright 通过；小程序受审核开关限制待真机 |
| 七行业首页一致性 | 共用原版 `MerchantPortal` 首页；生产登录态页面已重载核对 | 共用原版 `MerchantMobileApp` 首页；生产登录态页面已重载核对，390×844 隔离页 7/7 同结构 | 保留小程序自己的旧版首页与导航，未在本轮修改/验收 | 商家 Web `20261029201319473-5ab5440d`、手机 Web `20261029201330774-839824fd` 已发布；线上桌面/手机截图确认旧首页结构。小程序与七账号生产登录仍待验收 |
| 七行业后台布局/AI 助手栏 | 六行业业务模块复用 `MerchantPortal` 顶栏、旧导航、响应式水平导航及上下文 GPTmoda | 六行业业务模块复用 `MerchantMobileApp` 底部导航/更多页及 ModaUI 入口 | 原生小程序按既有运行面保持，不套用 Web 构建布局 | 隔离预览仅抽验服装批发商：Web 881×485 旧水平导航与 GPTmoda 可用；手机 390×844 旧底部导航正常且无页面横向溢出。其余行业逐页视觉/AI 上下文和小程序仍待验收；发布仍阻塞，见 `merchant-industry-backends.md` 与 `merchant-seven-industry-acceptance.md` §2.6 |
| ModaUI 单页创作工作台 | 有；`fashion_studio`/`modagpt` 直接进入单页工作台（左五项、中时间流、右检查器），无卡片落地页 | 有；`ai_home` 渲染同一个 `ModaUIWorkbench`（固定全屏 + 键盘内缩，旧拖柄导航已删） | 缺失（`pages/assistant` 仍是旧结构，无创作入口；审核期 AI 开关关闭） | 三端共用同一能力注册表、推理规划与 `/api/merchant/modagpt/*`；Web 已浏览器验收，手机 App 已代码接入并构建通过（真实登录态视觉待验收），小程序未接入（见 `modaui-workbench.md` §13） |
| 采购/生产/财务 | 有 | 有（部分） | 有（部分） | 各自模块状态见模块文档 |

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
