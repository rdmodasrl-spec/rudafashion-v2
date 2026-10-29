# 平台商家中心与七行业分类管理

- Module ID：`platform-merchant-center`
- 状态：部分完成（商家中心只读 API 与 Web/Mobile 共用界面已实现；自动化页面/API 权限测试、实机截图、注册入口改造与生产发布待完成）
- 日期：2026-10-29
- 运行面：平台总后台 Web、平台总后台 Mobile、统一商家注册入口、`/api/admin/*`、商家后台七行业模块
- 权威行业来源：`src/constants/merchantIndustryTemplates.ts`；能力来源：`src/constants/merchantIndustryCapabilities.ts`
- 相关文档：`merchant-seven-industry-acceptance.md`、`merchant-three-end-matrix.md`、`identity-merchant-onboarding.md`、`merchant-store-fulfillment.md`

## 1. 问题与目标

现有「平台商家」页面把生产商创建表单、财务台账和商家列表混在一起；列表从共享状态读取、浏览器内搜索，没有七行业经营概览、服务端分页、资料/营业状态、入驻进度或商家详情。七行业注册、演示商家和平台运营因此难以从一个权威界面核验。

目标是保留当前平台导航和商家/商品/订单/库存/权限模型，使用统一行业模板、真实商家数据及受控 `/api/admin/*` 查询，形成 Web 与 Mobile 一致的商家经营管理中心。商家行业由服务端模板字段决定，平台页面只查看，不允许通过下拉框任意改行业。

## 2. 非目标与复用结论

- 不创建第二套商家、商品、订单、员工、门店、库存、认证或权限数据。
- 不在平台管理页直接修改员工权限、商品、订单或库存；相关操作继续进入现有受控业务接口。
- 不新增平台一级导航；现有 `merchants` 页面和管理员权限体系保持。
- 不推翻七行业商家后台，不改变行业能力规则。
- 演示商家使用既有 `scripts/seed-industry-demo-merchants.ts` 创建的固定主键 `demo-industry-<industry-key>` 识别；服务端按此受控命名空间隔离统计，前端不可传参将正式商家变成演示商家。
- 商家登录页演示入口只传权威模板 ID 到 `POST /api/auth/demo/merchant/login`；服务端只允许固定七个演示商家 ID，签发既有商家会话 Cookie。七个直达入口使用 `/merchant?industryDemo=001..007`，只改变现有登录页的 URL 状态，不重排登录页，也不改后台外壳或导航。生产环境必须显式设置 `INDUSTRY_DEMO_LOGIN_ENABLED=true` 才开放，默认不可用；接口限流且不接受邮箱、密码、merchantId 或客户端令牌。
- 复用 `Merchant.createdAt`、`industryTemplate`、`industryTemplateSource`、`storefrontEnabled`、`isVerified`、`storeSlug`、`registrationProfile`，以及真实商品、订单、员工、门店关系计数；旧商家没有行业时只显示「未分类」，不推断回填。
- 复用 `requireAdminAuth`、`requireAdminPermission('merchants.review')`、统一 API client、行业模板/能力清单、商家演示种子和审计能力。平台查询为只读，不需要新增数据库模型或迁移。

## 3. 页面与交互

页面名称：**平台商家**。使用既有 RUDA 黑白/中性灰后台视觉。

1. 经营概览：正式商家总数、营业中、暂停营业、新入驻（7/30 天或自定义日期）、资料待完善、未分类；点击指标切换列表过滤。
2. 七行业入口：从权威模板清单生成 7 个入口，每项显示中文行业名、正式商家总数、新增数、营业中/暂停数。另有全部、未分类和独立演示商家视图。
3. 商家列表：服务端搜索（企业名、代码、负责人、联系方式、域名）、行业/状态/时间筛选、日期与商品/订单排序、分页和每页数量。列表显示企业/Logo、商家代码、中文行业名、负责人、注册时间、来源、店铺、商品/订单/员工数和状态。
4. 详情：概览、商品与订单、店铺、员工、行业信息分区；展示同一商家的真实汇总、员工角色分布和行业已启用模块。商品/订单跳转继续复用平台原模块及商家归属，不提供跨租户写入旁路。店铺链接以现有 `merchantStorefrontUrl` 规则构造。
5. 演示隔离：单独展示演示商家和醒目标识，默认不进入正式商家任何数量/列表；任何演示重置若后续提供，必须限制在固定演示主键集合、服务端授权、二次确认并写审计，不属于本阶段自动执行的数据操作。

营业状态只按权威字段判定：`storefrontEnabled=true` 为营业中，`false` 为暂停；历史 `null` 仅在 `isVerified=true` 时沿用现有默认营业规则，否则显示待确认，不伪装成暂停或正常。资料待完善是独立标签，不冻结登录、商品或订单权限。缺字段显示「未填写」。

入驻日期使用 `Merchant.createdAt`；注册来源只展示真实 `industryTemplateSource`。不虚构邀请、试用或登录记录。若当前数据库没有可信字段，详情标为未记录。

## 4. API 契约

新增只读查询：

- `GET /api/admin/merchant-center/overview?newFrom=&newTo=`
- `GET /api/admin/merchant-center/merchants?page=&pageSize=&industry=&status=&newFrom=&newTo=&sort=&direction=&q=&scope=official|demo`
- `GET /api/admin/merchant-center/merchants/:id`
- `POST /api/auth/demo/merchant/login`（仅测试/演示用途）
- 身份：平台管理员；所有路由执行 `requireAdminAuth` 与 `requireAdminPermission('merchants.review')`。
- 演示登录是单独的公开演示入口，不属于平台管理查询：请求仅含 `industryTemplateId`；服务端精确映射固定演示 ID，核对 Merchant 行业模板和 DEMO 命名/代码、商家登录账号和工作区可用性，再设置现有 HttpOnly 商家 Cookie；响应不返回 JWT。端点具 IP 限流，生产环境需明确启用开关，默认返回 404。它只授予固定演示商家的现有业务权限，绝不改变角色或租户边界。
- 列表分页、筛选、排序和 `q` 搜索由数据库执行。响应仅含界面必要字段、聚合计数、中文模板标签、初始化进度与演示标记；不返回密码、令牌、密钥或原始凭证。
- overview 与列表均默认排除固定演示 ID 命名空间；`scope=demo` 只读列出这些固定演示账号。客户端参数不能改变数据库归属。
- 错误统一 JSON：401 未登录、403 无权限、400 参数无效、404 商家不存在、500 通用错误并记录 request id；不返回内部堆栈。
- 日期范围按 UTC ISO 日期校验；排序字段采用白名单；最大 pageSize 为 100。

## 5. 数据口径

- 行业：仅 `Merchant.industryTemplate` 精确匹配权威模板；为空或未知值归「未分类」，禁止使用 `industry` 或名称猜测。
- 总数：正式视图中固定 demo ID 前缀排除后的 `Merchant` 数量。
- 营业：沿用上述 `storefrontEnabled`/`isVerified` 兼容规则；另保留「待确认」状态。
- 资料完整：按商家名、法定名称、负责人、联系方式、注册国家/城市、店铺 slug 做缺失检查；只作提醒，不改变权限。
- 商品、订单、启用员工、门店：Prisma 关系计数；订单统计明确为全部订单数与未取消订单数，不估算销售额。
- 行业新增数：`createdAt` 落入所选闭区间；自定义日期需同时传入合法起止日期。
- 演示数据：固定 seed 主键是服务端定义，演示视图不参与正式统计，也不接受任意 `merchantId` 列表或用户可编辑标志。

## 6. 注册与七行业联动

商家注册继续复用 `/api/auth/register/company` 与服务端 `resolveMerchantRegistrationTemplate`。公开注册只允许状态为 `open` 的模板；七个模板现均为 open。注册事务必须将所选模板写入 `Merchant.industryTemplate`、来源写为 `SELF_SELECTED`，并关联已有统一账号和对应工作区；行业名称不由前端另建映射。现有 `/register-wholesale?registration=merchant` 仍渲染旧的人工审核申请表，必须改为进入同一经过联系验证的 `RegistrationPortal`，避免并存两条语义冲突的商家开通路径。

按已确认产品规则，商家资料后续补齐不应成为进入后台经营的人工审核门槛。账号冲突/安全核验仍使用现有统一身份流程。旧商家保持未分类，平台详情可见并能追踪；本阶段不自动改写历史行业。

## 7. 权限、租户与审计

- 平台列表/详情仅平台管理员权限；员工无平台商家数据访问权。
- 查询服务端仅返回商家管理所需字段，不泄露凭证或其他租户私有明细。
- 详情跳转和任何已有管理操作继续走现有管理员受控 API，并保留现有审计记录。
- 不实现行业转换；行业变更需另立包含库存、产品、订单、员工权限和审计的迁移设计。

## 8. 影响范围、测试与验收

- 影响：`platform-admin-web`、`platform-admin-mobile`、共享平台组件、平台商家管理 API、七行业注册与演示种子、旧商家入驻入口路由；商家后台不改其行业数据模型。
- API 测试：管理员权限、非法行业、未分类、正式/演示隔离、统计口径、搜索字段、分页边界、排序白名单、详情租户归属和计数。
- UI 测试：行业入口切换、统计指标过滤、搜索/日期/分页、错误/空/加载、详情与店铺跳转、Web 和窄屏响应。
- 验收：数据库精确计数与接口一致；七种行业筛选均不串行业；新注册行业写入与平台视图一致；旧无行业记录不被猜测；演示记录不计入正式数；无权请求被服务端拒绝。
- 视觉验收必须实际运行平台 Web/Mobile 页面并留截图；代码或构建通过不能代替截图。

### 当前实现记录

- 已新增只读 overview/list/detail API：数据库聚合、正式/演示固定 ID 隔离、服务端分页/搜索/行业/状态/日期/排序白名单、商家详情计数；路由要求 `merchants.review`。
- Web 与 Mobile 已接入共享 `AdminMerchantCenter`，展示行业分布、可点击经营指标、列表筛选/分页、演示隔离和详情页；原商家列表视图暂时保留为不可达旧分支，后续需清理并复核其原有管理操作是否已被正式中心覆盖。
- `industryTemplate` 为空或未知时仅进入未分类；详情不输出注册资料 JSON，也不声称有登录追踪数据。
- 专项隔离数据库集成测试必须创建具备 `merchants.review` 的管理员会话及无该权限的管理员会话，检查 overview/list/detail 的权限、筛选、分页、计数与正式/演示隔离；还要验证演示登录只接受固定行业映射、响应无 token、登录后的 industry-context 与模板一致。
- 七行业直达 URL 的编号映射与演示商家邮箱统一维护在 `merchant-industry-backends.md` §12；不得在前端放置密码、商家凭证或可指定 merchantId 的入口参数。
- 尚无浏览器截图或页面操作验收；构建/类型检查仅验证代码形态，不能标记页面完成。
- 生产数据清理目标是删除经批准范围内的商家/买家业务数据与账号，同时保留平台管理员、审计日志、配置和安全设置；现有通用清理脚本会删除审计日志并拒绝生产环境，不能直接使用，须先完成逐表清点、备份恢复演练和再次授权。

### 本地页面联调

Vite 仅在显式设置 `RUDA_DEV_API_PROXY_TARGET=http://127.0.0.1:<隔离 API 端口>` 时，将 `/api` 代理到本机隔离服务；目标只允许 loopback HTTP。未设置时不创建代理，生产构建与线上 API 路由不受影响。浏览器测试必须由独立测试 PostgreSQL、`NODE_ENV=test` 服务端及七行业演示种子构成，不得把开发页面代理到生产域名。

## 9. 发布与恢复

本功能无数据库结构迁移。平台 Web 与 Mobile 独立构建、独立发布；服务端随现有 `dist/server.cjs` 构建部署。发布前备份当前服务端构建和应用 release 指针，验证 health、未授权 API JSON、管理员查询和商家端回归。恢复时回滚平台 Web/Mobile release 并恢复旧服务端构建，再按当前服务管理方式重启。未经证据验证不得宣称生产发布成功。
