# 贸易批发 ModaUI AI 工具链

- 模块 ID：`trading-wholesale-ai`
- 状态：**部分完成**（隔离 PostgreSQL 与真实 HTTP 任务闭环已验证；三端 UI 实际运行、生产发布及真实图片服务调用未验收）
- 所属模块：`modagpt-ai`；复用既有 ModaUI 任务 API、Supervisor、工具运行时、队列及 Prisma 采购模型
- 运行面：商家后台 Web、手机 Web、商家小程序现有 ModaUI 聊天入口；不新增独立页面或应用
- 复用结论：供应商、商品、采购单和收货记录继续使用现有 `Supplier`、`Product`、`ProductVariant`、`MerchantPurchaseOrder` 及关联模型；不创建平行数据表、API client 或权限系统

## 1. 目标与非目标

目标是在商家 Web、手机 Web 和商家小程序现有 ModaUI 聊天入口中，使用同一任务 API、Supervisor、行业 Pack、工具运行时和数据库，闭合供应商查询、历史绩效分析及采购草稿创建。采购草稿只写入 `draft` 状态，不自动提交、审批、下单或收货。

本阶段不接入第二个行业，不改服装生产批发或服装批发，不重做/重排现有聊天 UI，不迁移数据库，不部署生产，不调用可能计费的图片生成服务。用户必须显式启用现有界面中的任务模式并确认预览后才提交任务；缺少必需的商品、SKU、数量或成本时不得推测或绕过工具校验。

## 2. 运行面与复用边界

| 端 | 现有入口 | 现有认证与调用方式 | 本阶段接线范围 |
|---|---|---|---|
| 商家 Web | `merchant-admin-web` 的 ModaUI 工作台 | 共享 `src/api/client.ts`；商家 JWT Cookie/会话 | 保留既有任务预览、提交与轮询；确认同一工作台的任务模式可用 |
| 商家手机 Web | `merchant-admin-mobile` 加载共享 `ModaUIWorkbench` | 共享 `src/api/client.ts`；同一服务端商家租户会话 | 在现有工作台接入同一任务模式、预览/确认、幂等提交及状态轮询，不另建聊天页 |
| 商家小程序 | `merchant-miniprogram/pages/assistant` | 复用 `utils/api.js` 的 `request()` 和 `utils/page-auth.js` / `utils/auth.js` 中的现有商家/员工令牌；带既有 `X-Ruda-Client` 标记 | 在现有 ModaUI 对话入口接入同一受保护 API；不得把采购工具接到未认证公共聊天路由 |

`miniprogram/` 中面向买家的公共文本聊天 `/api/modagpt/public/chat` 不属于本功能，不修改、不扩展其工具权限。权威商家身份由 `requireMerchantTenant` 从现有 JWT 决定；客户端不得传入或决定 `merchantId`。行业由服务端读取当前商家记录并匹配 `TRADING_COMPANY` pack，Agent 和工具授权由服务端的行业分配及员工权限再次校验。

本功能沿用既有任务/目录契约，无新增 API：

- 预览：`POST /api/merchant/modagpt/task/preview`，请求 `{ message }`；返回 workflow、Agent/工具、权限与副作用说明；不写业务数据。
- 提交：`POST /api/merchant/modagpt/task`，请求 `{ message, inputs?, conversationId? }`，必需 `Idempotency-Key`；服务端入队并按当前 JWT 的租户/员工权限执行。
- 轮询：`GET /api/merchant/modagpt/task/:id`；只允许该任务所属商家读取，返回运行状态、摘要、审批 ID 与结构化错误。
- 目录输入：复用 `GET /api/merchant/suppliers` 与 `GET /api/merchant/products`。后者允许已有 `purchase.manage` 员工读取本商家的商品目录，并在商家 SKU 项中返回可选 `variantId`，供草稿工具准确关联 `ProductVariant`；成本字段仍遵循原 `product.cost.view` 脱敏规则。供应商仅选择 `active`，商品 SKU 必须存在有效变体 ID。
- 写入副作用：采购工作流只允许创建租户内采购 `draft`，不能直接提交订单。

## 3. 真实调用与权限边界

- Web、手机 Web、小程序只能调用上述既有 `/api/merchant/modagpt/task*` 端点；不得在前端执行供应商查询、绩效计算或采购写入。
- 同一预览确认期间沿用一个幂等键。请求不确定/网络中断时，重试必须重放同一键；确认终态后才释放该键，避免重复采购单。
- 三端调用相同 API 请求结构、状态终态和错误信封；运行中、等待审批、失败/死信、取消、超时仍在处理等情况均需在原聊天界面明确显示。
- 小程序从 `utils/auth.js` 获取当前会话并由 `utils/api.js` 自动添加 Authorization；未登录或会话过期时拒绝提交。服务端从认证会话取得 `merchantId`，不信任客户端租户 ID。
- Supervisor 只可为已支持的商家任务工作流路由；贸易采购流程要求当前行业团队中存在 `supply-chain-finance-manager`。
- 商家所有者走现有租户认证；员工必须具备 `purchase.manage`。工具运行时再次验证用户权限、Agent 权限、租户归属和输入/输出。
- `get_suppliers` 只返回当前商家启用的供应商；采购写入要求供应商、商品和 SKU 均属于当前商家，且供应商启用。
- 仅当用户明确要求创建采购草稿时，原聊天界面才显示单商品输入项；供应商、商品、SKU、数量和单位成本必须由用户明确选择/填写并在预览中再次确认。空字段、无效数字或无有效目录项时不提交任务，不推断成本或数量。
- 采购草稿以任务 ID 派生稳定记录 ID，重放同一任务不得重复创建；回读数据库核验状态和金额。

## 4. 工具契约与状态

| 工具 | 读取/写入 | 规则 |
|---|---|---|
| `get_suppliers` | 读取 | 当前租户；只返回启用供应商；无记录返回空列表 |
| `get_supplier_performance` | 读取 | 当前租户内排除草稿/取消单；到货率为已收数量/已订数量；平均交付天数只统计完整收货订单，以最后一笔收货时间减下单时间；无样本返回零并报告样本数 |
| `create_procurement_draft` | 写入 | 必须显式提供有效供应商、商品、SKU、正数量和非负单位成本；金额以十进制精确汇总后按半入规则保留两位小数；仅创建 `draft`，不得绕开既有审批流程 |
| `currency_convert` | 读取/计算 | 复用平台现有 Frankfurter EUR 基准汇率来源；输出来源、提供方基准日期、换算方向及舍入精度（金额 2 位小数、单位汇率 8 位小数）。属于日度参考汇率，不是实时交易报价；来源不可用或数据异常时明确失败 |

失败不返回成功形状、不静默回退到空数据或硬编码汇率。任务 API 应保留可诊断错误码；客户端可据此显示失败并重试。

## 5. 影响与恢复

- 不新增或修改数据库 schema，无迁移和数据回填。既有商家商品目录 API 仅扩展 `purchase.manage` 读取权限，并为 SKU 增加可选 `variantId` 响应字段；不影响旧调用方。
- 不新增外部凭证；汇率复用当前项目已有公开 Frankfurter 接入，当前方案无服务端 API key 配置，受上游可用性和其数据更新时间约束。
- 若工作流验证失败，恢复方法是从聊天预览、提交入口和 worker 路由中撤回该工作流注册；现有其他 ModaUI 工作流与数据模型不变。
- 当前变更仅在隔离测试环境验证；不得以代码或 Mock 测试通过标记生产完成。

## 6. 三端验收标准

以下场景须使用同一隔离测试商家/数据，在 Web、手机 Web、小程序分别实际进入页面、发起请求并查看聊天结果：

1. 供应商比较：真实调用 `get_suppliers`、`get_supplier_performance`，计算历史到货与交付结果。
2. 采购草稿：由用户确认预览后真实创建 `draft`；验证总额、持久化、幂等重试且不正式下单。
3. 无采购权限员工：三端可见的预览/执行入口均不得绕过服务端 `purchase.manage` 校验；预览拒绝或任务失败须显示明确错误。
4. 商家 A 访问商家 B：三端使用 A 会话轮询 B 任务均不得获取数据；客户端不得能指定 B 的租户 ID。
5. 请求失败/任务死信/超时/等待审批均保留在现有聊天 UI 中可辨识，不显示假成功。
6. 保存各端预览、提交、轮询的 HTTP 状态/JSON/执行日志及真实预览截图；仅 API 集成测试不能代替页面验收。

## 7. 后端验收标准

1. 真实 HTTP 请求经过认证、Supervisor、队列 worker、授权工具和 Prisma，再从任务查询 API 返回真实结果。
2. PostgreSQL 验证供应商查询、绩效公式、采购草稿持久化、幂等重放、无效参数、停用供应商、未授权员工及跨租户隔离；测试数据可清理。
3. 采购草稿写后回读状态仍为 `draft`，金额与明细一致；重复任务不产生重复采购单。
4. 汇率使用真实上游响应，明确返回 `Frankfurter` 来源和数据日期；失败不使用伪造/过期回退值，不宣称实时。
5. 真实图片生成需要另行授权；前端/UI 接线验收不调用计费图片服务。
6. Web/手机 Web/小程序的真实页面验收未完成前，整体状态保持“部分完成”。；生产部署、小程序发布和其他行业不在本阶段范围。

## 6. 本阶段验证记录

- `npm run lint`：通过（TypeScript 全项目检查）。
- `node --import tsx --test tests/modaui-workbench.test.ts tests/merchant-miniprogram-ui.test.ts`：19/19 通过；覆盖共享工作台任务契约、小程序会话 API 接线和页面条件。
- `node --check merchant-miniprogram/pages/assistant/index.js`：通过。
- `npm run test:unit`：1166/1166 通过。
- `npm run test:trading-wholesale:integration`：通过；在临时 loopback PostgreSQL 容器中执行真实 HTTP 预览/提交、队列 worker、工具运行时、数据库持久化和任务轮询。
- 集成测试实际验证：供应商绩效结果由真实历史采购/收货数据计算；采购草稿包含 `125.00 EUR` 与 `1.005 EUR` 两条明细，精确汇总并按半入规则返回 `126.01 EUR`，写后回读状态为 `draft`；重复请求返回同一任务且未重复建单；员工缺少 `purchase.manage` 返回 403；跨商家读取任务返回 404；无效商品任务进入死信并返回 `MODAGPT_PRODUCT_UNAVAILABLE`。
- Supervisor 路由规则已区分明确采购/供应商意图与一般补货建议，避免把只读库存建议错误路由为采购工作流。
- `fetchLatestExchangeRates()` 已实际读取 Frankfurter 日度参考数据；本次快照日期为 `2026-10-29`，EUR/USD 为 `1.113`。它不是实时交易报价；汇率接口在上游数据无效或过期时返回错误，不回退至固定汇率。
- Impeccable：运行 `.agents/skills/impeccable/scripts/impeccable detect src/apps/merchant-admin-common/components/merchant/modaui merchant-miniprogram/pages/assistant`，退出码 0；工具报告只对源码执行正则扫描，页面级低对比度/微小文字等规则未运行，不能视为完整视觉验收。
- 当前没有已认证 Web/手机 Web 预览会话或微信开发者工具/真机截图；端侧实际运行、截图与小程序交互仍待验收。
- `npm run build`：通过；仅出现依赖包的 Rollup 注释提示，不影响构建产物。
- 图片生成仅运行既有契约、意图和客户端回归测试（10/10 通过）；未调用可能计费的外部图片服务。
- 新增的 `P0_HTTP_TEST_ENABLE_MODAGPT_WORKER` 仅在 `P0_HTTP_TEST_MODE` 下生效；隔离测试只启动 ModaUI 队列 worker，不运行运维扫描、备份或其它定时任务。
- 本阶段没有数据库 schema/migration 变更，没有提交、推送、生产部署或小程序发布。生产、浏览器 UI 和真实图片服务仍不属于已验证范围。
- 2026-10-30 第四阶段完成代码接线后复核：桌面 Web/手机 Web 共享工作台与商家小程序助手均调用同一受保护任务 API；采购草稿输入、幂等提交、轮询与错误状态已纳入代码和自动化测试。三端实际页面、聊天操作截图和小程序真机验收仍未完成，因此整体保持“部分完成”。
