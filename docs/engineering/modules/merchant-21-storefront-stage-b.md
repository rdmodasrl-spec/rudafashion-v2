# 项目二 · 阶段 B 进度：箱包三套黄金模板

- 项目：`P2-STORE-TEMPLATES`（与 `P1-ADMIN-UI` 完全独立）
- 文档状态：**部分完成（第二轮整改进行中）** —— 三套结构型模板 + 详情深链 + 多图画廊已落地并实测；图片证书与 RFQ 后端两项受外部条件阻塞（见 §8），仍未达 90 分
- 日期：2026-10-31
- 预览入口（隔离，未替换任何商家网站）：`/?storefrontPreview=<模板 id>&merchant=<商家 id>&demo=1`

---

## 1. 本阶段交付

| 模板 | id | 结构 | 状态 |
| --- | --- | --- | --- |
| 意大利编辑版 | `bags_editorial` | 全幅摄影 hero + 不对称双栏 + 系列叙事 + 材质工艺 + 品牌介绍 + 详情页（左图右粘性信息） | 可用 |
| 产品目录版 | `bags_catalogue` | 常驻左侧分类栏 + 顶部搜索/排序 + 密集网格 + 规格表详情 + 手机筛选抽屉 | 可用 |
| 批发电商版 | `bags_wholesale` | 深色工具条 + 分类导航 + 真实统计 + 商品格（价/库存/MOQ）+ 颜色×尺寸数量矩阵 + 手机底部操作条 | 可用 |

**三套不是同一骨架换皮**：

| 维度 | 编辑版 | 目录版 | 电商版 |
| --- | --- | --- | --- |
| 首屏 | 全幅影像 + 大字主张 | 搜索框 + 分类栏 | 工具条 + 统计 + 促销带 |
| 导航 | 居中文字 + 全屏抽屉 | 内联搜索 + 分类横滑 / 左侧栏 | 深色工具条 + 下划线分类 |
| 商品呈现 | 无边框大图「作品」 | 1:1 网格 + 边框 + 款号 | 卡片 + 价格/库存/起订 + 选择规格订货 |
| 详情 | 左多图右粘性文字 | 主图 + 缩略图 + 规格表 | 主图 + 统计 + 颜色×尺寸矩阵 |
| 手机 | 单列 + 抽屉 | 筛选 Bottom Sheet | 底部固定操作条 + 数量抽屉 |

## 2. 真实数据与授权

- 数据装配层：`src/apps/shared/components/storefront/useStorefrontData.ts`（**唯一出口**）。
- 授权过滤：`isProductVisibleInStorefront()`，规则与 `MerchantStoreView` 一致（published / 未锁定 / 批发授权 / vault 保护）。
- 价格：`calculateCustomerPrice`（买家折扣）；未授权显示「登录后查看批发价」；价格 ≤0 显示「价格面议」，不出现 `€0.00`。
- 库存：SKU 级 `stockCentral` 汇总；矩阵单元格按真实库存封顶，售罄禁用。
- 订货：`addToCart` / `addMultipleToCart`（现有采购车），MOQ 未达时按钮禁用并提示差额。
- 阶梯价：仅在商品配置了 `wholesalePrice100` 时显示。

**未伪造任何数据**：统计卡的「在售款式 / 有货款式 / 品类 / 可售件数」全部由真实商品聚合；清仓带只列 `status === 'clearance'` 的真实商品。

## 3. 隔离与安全

- 仅当 URL 带 `storefrontPreview` 参数时接管渲染；否则完全走原有 `MerchantStoreView`。
- 预览页写入 `robots: noindex,nofollow`，不写库、不改 `settings.storefrontTemplate`。
- 开发模式下 `B2BContext` 不拉公共目录（本地持久化分支），因此预览对 `/api/merchants`、`/api/products`（只读公共接口）做兜底读取；生产环境 context 已有数据时不发请求。
- `?demo=1` 仅在 `import.meta.env.DEV` 生效，用开发种子商品补足数量以评审栅格密度，预览条会标注「含版式评审演示数据」。

## 4. 真实运行验证（webapp-testing）

视口 1440 / 768 / 390 × 3 套模板，全部：无横向滚动、无 console/pageerror。

| 交互 | 结果 |
| --- | --- |
| 模板切换（预览条） | 三套结构即时切换，URL 同步 `storefrontPreview` |
| 目录版搜索 / 分类 / 材质 / 颜色筛选 | 生效；空结果有清除条件入口 |
| 目录版详情规格表 | 真实材质/产地/颜色/尺寸/起订/库存 |
| 电商版数量矩阵 | 单元格按库存封顶；低于 MOQ 时按钮禁用（实测 1 件→禁用，12 件→可用） |
| 编辑版详情加购 | 走现有 `addToCart` |

截图证据：`docs/engineering/evidence/p2-stage-b-bags/`（editorial/catalogue/wholesale × 1440/390 + 矩阵详情）。

## 5. 验收评分（自评，未达 90，按标准不通过）

| 项目 | 分值 | 编辑版 | 目录版 | 电商版 | 主要扣分点 |
| --- | ---: | ---: | ---: | ---: | --- |
| 行业定位与信息架构 | 20 | 16 | 16 | 17 | 门店/材质专题内容仍偏少 |
| 视觉设计与独特性 | 20 | 16 | 14 | 15 | 目录版网格偏常规；三套之间差异已成立但细节未打磨 |
| 商品展示与专业程度 | 15 | 10 | 12 | 13 | **无多图画廊/放大**；箱包特有规格（尺寸、五金、容量）未建模 |
| 交互与业务功能 | 15 | 10 | 11 | 12 | **询价/报价入口未接现有 RFQ**；收藏未接 |
| 桌面/平板/手机适配 | 10 | 8 | 8 | 8 | 768 断点未单独调优 |
| SEO、性能与无障碍 | 10 | 6 | 6 | 6 | **无独立商品 URL/sitemap**；焦点环未逐控件验证 |
| 真实数据、授权及安全 | 10 | 9 | 9 | 9 | 授权规则已复用；未做越权专项测试 |
| **合计** | 100 | **75** | **76** | **80** | 全部 **< 90，判为未通过** |

### 已知缺口（下一轮必须补）

1. 商品独立详情 URL + 可索引（当前详情为组件内视图，无路由）。
2. 多图画廊 / 放大 / 视频位。
3. 询价与报价入口接入现有 RFQ（`MerchantRfqCenter` / `BuyerRfqCenter`）。
4. 箱包专属规格字段（尺寸、五金、内衬、容量）——需数据模型确认后接入，不得虚构。
5. 768 断点单独调优；键盘可达性与焦点环逐控件核查。
6. 越权专项测试（未登录 / 已登录未认证 / 已认证 / vault 已授权 四态 × 三套）。
7. 图片基础设施：`images.ruda.fashion` 证书不覆盖该域名，导致部分真实商品图回落占位。

## 6. 未被替换的现有能力

- `MerchantStoreView` 与现有三套皮肤模板**未改动**，服装两行业行为不变。
- 模板注册表新增行业维度（`src/shared/storefrontTemplates/registry.ts`），未迁移行业仍返回原三套。
- 未新增任何 npm 依赖（`embla`、`radix` 等仍待阶段 C 按需申请）。

## 7. 下一步

按用户顺序：先补齐 §5 的 1–6 项把箱包三套做到 ≥90，通过后再按同一工程方法推进百货批发（3 套），不得先复制到其他行业。

---

## 8. 第二轮整改（2026-10-31 23:xx）

### 8.1 P0 商品图片 HTTPS —— 根因已定位，修复需授权

| 检查项 | 实测结果 |
| --- | --- |
| DNS | `images.ruda.fashion` → `95.232.251.69`（解析正常） |
| TLS 证书主体 | `CN = ruda.fashion` |
| SAN 列表 | `admin / b2b / bellissima-prato / buyer / merchant / paris-marais-atelier / ruda.fashion / sartoria-milanese / video / vip / www` —— **不含 `images.ruda.fashion`** |
| 证书位置 | `/etc/letsencrypt/live/ruda.fashion/fullchain.pem`（Certbot 管理） |
| nginx vhost | `/etc/nginx/sites-enabled/ruda.fashion`，`server_name ruda.fashion www.ruda.fashion *.ruda.fashion`（vhost 已覆盖该域名，仅证书不覆盖） |
| 存储配置 | `R2_PUBLIC_URL=https://images.ruda.fashion`（`src/server/r2Environment.ts` 读 `R2_PUBLIC_URL`） |
| 用 `-k` 跳过校验 | 200 + `image/jpeg`（对象存在、服务正常） |

**结论**：图片服务本身正常，唯一问题是证书 SAN 缺该域名。**不需要改存储或 DNS**。

修复方案（需授权，均属生产配置变更）：

1. **首选**：为证书追加 SAN 或改用通配符
   `certbot --expand -d ruda.fashion -d www.ruda.fashion -d "*.ruda.fashion"`，随后 `nginx -s reload`。可逆、不动对象存储。
2. 备选（不碰证书）：把媒体域名切到已在 SAN 内的主机，并在读取时重写 URL。需要放宽 `server.ts:24056` 的 hostname 判断并新增 `MEDIA_URL_REWRITE` 配置，改动面更大。

**未执行原因**：指令明确「不得未经批准修改生产证书、DNS 或存储配置」。本轮只完成诊断与隔离验证，等待授权。

### 8.2 P0 授权安全 —— 服务端已实施，匿名态已实测

服务端过滤存在且生效（不是只有前端 `useStorefrontData.ts`）：

- `server.ts:16312` `/api/products`：`AND: [{ OR: authorizedVisibility }]`
- `server.ts:16349` `/api/products/:id`：同样的可见性条件
- `src/server/publicProductVisibility.ts:108` `buildAuthorizedProductVisibility()`：匿名 → 仅 `public` 且非 exclusive；`customer.status === 'approved'` → +`wholesale`；有效 vault 授权 → +该商家的 `private`/exclusive

实测证据（状态 1 未登录访客）：

| 请求 | 结果 |
| --- | --- |
| DB 实际分布 | `wholesale 15 / public 11 / private 2` |
| `GET /api/products`（匿名） | 返回 8 条，`visibility` 全为非 wholesale，**0 泄漏** |
| `GET /api/products/<wholesale id>`（匿名） | **404 `PRODUCT_NOT_FOUND`** |

**未完成**：状态 2（已登录未认证）、状态 3（已认证买家）、状态 4（vault 已授权）需要测试账号与 vault 授权记录。当前 DB 有 3 个 `approved` 客户但无密码、无 vault 授权记录；创建这些数据属于生产写操作，需授权。建议在 `scripts/isolatedPostgresTestDatabase.ts` 的隔离库上执行四态测试。

### 8.3 P1 商品独立详情 URL —— 已完成并实测

- URL 形态：`?storefrontPreview=<tpl>&merchant=<id>&product=<productId>`，点击商品 `pushState`，关闭 `replaceState`。
- 实测：点击 → URL 带 `product`；**刷新后详情保留**；**浏览器后退回到列表**；**新标签直接打开深链**正常渲染对应商品。
- 预览页整体 `noindex,nofollow`；正式站接入时的 SEO（title/description/canonical）需在阶段 C 迁移到 `MerchantStoreView` 路由时补，本轮未伪造。

### 8.4 P1 多图画廊 —— 已完成并实测

新增 `storefront/gallery/StorefrontGallery.tsx`：主图 + 缩略图 + 点击切换 + 放大弹层 + 键盘（←/→/Esc）+ 触控滑动 + 比例固定 + 懒加载 + 失败态。三套模板详情页统一接入。

实测（真实种子商品，3 图 / 2 图）：缩略图数量正确、点击切换、放大弹层打开、`Esc` 关闭、`→` 切换无报错。

**数据限制**：线上 8 个公开商品**每个都只有 1 张图**，因此缩略图在真实数据下不出现（组件行为正确，缺的是商家上传多图）。

### 8.5 P1 真实 RFQ —— 阻塞：后端不存在

| 检查项 | 结果 |
| --- | --- |
| 前端调用 | `B2BContext.createBuyerRfq` → `POST /api/buyer/rfq`（`src/context/B2BContext.tsx:3392`） |
| 服务端路由 | `server.ts` 中 `rfq` 出现 **0 次** |
| 实际请求 | `POST /api/buyer/rfq` → **404 `Cannot POST /api/buyer/rfq`** |
| 数据库 | Prisma **无 RFQ 模型**（仅有 `SalesQuote`/`SalesQuoteItem`） |

结论：现有「询价」是**前端调用一个不存在的接口**，属于既有缺陷。要做真实询价必须新建数据模型 + 迁移 + 路由 + 权限，属数据库变更，需授权后实施；**不能在前端做一个假提交**。

### 8.6 本轮分数（仍未达 90）

| 模板 | 上轮 | 本轮 | 变化原因 |
| --- | ---: | ---: | --- |
| 编辑版 | 75 | **80** | +多图画廊、+详情深链；图片证书问题未解 |
| 目录版 | 76 | **82** | 同上，目录检索体验更完整 |
| 电商版 | 80 | **85** | 同上 + 矩阵与深链配合 |

**结论：三套仍不合格，不进入下一个行业。**

### 8.7 需要拍板的三件事

1. **图片证书**：授权执行 `certbot --expand`（追加 `images.ruda.fashion` 或改 `*.ruda.fashion`）并 reload nginx。
2. **RFQ 后端**：授权新建 RFQ 模型 + 迁移 + `POST /api/buyer/rfq` 等路由（生产库 schema 变更）。
3. **四态授权测试**：授权在隔离库创建测试账号与 vault 授权记录（或提供现成测试账号）。

### 8.8 证据

`docs/engineering/evidence/p2-stage-b-bags/`（三套 1440/390 + 矩阵详情）；本轮深链/画廊测试记录见提交说明。

---

## 9. 第三轮整改（2026-10-31 深夜 → 11-01 凌晨）

本轮把第二轮的三项阻塞全部落地，并在**隔离库 + 隔离实例**上完成可复现的四态授权实测。
所有数字均来自本次真实运行，命令与脚本随提交入库。

### 9.1 P0 商品图片 HTTPS —— 已修复（显式 SAN，非通配符）

| 项 | 结果 |
| --- | --- |
| 方案 | 因 Certbot 2.9.0 只有 nginx/standalone/webroot 插件、**无 DNS 插件**，通配符不可行，改为显式追加 `images.ruda.fashion` 进 SAN（保留原有 11 个域名） |
| 验证 | `curl` 不带 `-k` 访问真实商品图 → `200`、`image/png`、`1666118 bytes` |
| 模板表现 | 三套模板 1440/768/390 共 9 组：**裂图 0，失败请求 0** |

### 9.2 P0 授权安全 —— 四态 4/4 通过（服务端过滤，非前端）

隔离环境：独立库 `ruda_p2_authz`（`prisma migrate deploy` 全量执行成功）+ 独立实例 `PORT=4101`，
独立 JWT 密钥，不触碰生产证书/密钥/数据。

夹具（`scripts/p2/authz-seed.cjs`，含「必须指向 ruda_p2_authz」护栏）：
商家 1 个、商品 4 款（public / wholesale / private / exclusive）、客户 3 个（approved / approved 无 Vault / pending）、
Vault 授权 1 条。

| 状态 | `/api/products` 实际返回 | 受限商品详情 | 询价读取 | 用受限商品发起询价 |
| --- | --- | --- | --- | --- |
| S1 未登录访客 | `[public]` | 404 / 404 / 404 | 401 | 401 |
| S2 已登录未审核 | `[public]` | 404 / 404 / 404 | 200 | 403 `RFQ_PRODUCT_NOT_VISIBLE` |
| S3 已审核无 Vault | `[public, wholesale]` | private 404、wholesale 200、exclusive 404 | 200 | 403 `RFQ_PRODUCT_NOT_VISIBLE` |
| S4 已审核 + Vault | `[public, wholesale, private, exclusive]` | 全部 200 | 200 | 201 |

`costPrice` / `visibility` / `protectionLevel` 四态**均未出现在公开响应**中。
结果：**4/4 通过**，可复现命令：

```bash
DATABASE_URL=<隔离库> node scripts/p2/authz-seed.cjs
DATABASE_URL=<隔离库> PORT=4101 npx tsx server.ts   # .env 中 JWT_BUYER_SECRET 指向隔离密钥
P2_AUTHZ_JWT_SECRET=<隔离密钥> node scripts/p2/authz-four-states.cjs
```

同时修掉两个真实缺陷：

1. `useStorefrontData` 读取了**不存在**的 `context.canViewWholesaleProducts`，导致授权买家在模板里也拿不到批发口径 ——
   改为 `context.isRegisteredWholesale`（与 `MerchantStoreView`、公共 API 同一判定）。
2. `/api/merchant/rfq` 原按 `OR [{merchantId},{merchantId:null}]` 查询，会把**所有买家的无主询价广播给任意商家**（跨租户泄漏）——
   改为严格 `merchantId`。实测：本商家 1 条、其它商家 0 条、无主询价不进入任何商家列表。

### 9.3 P1 真实 RFQ —— 已落地并端到端提交成功

- 模型 `RfqRequest` + `prisma/migrations/20261031234000_buyer_rfq`（已在隔离库验证可执行）
- `POST/GET /api/buyer/rfq`、`GET /api/merchant/rfq`；创建时做商品可见性校验
- 电商版模板询价抽屉实测：界面显示真实单号 `RFQ-MVX02R43-EW5M`，库内落库成功，状态 `submitted`
- 失败路径显示真实错误（未登录提示登录、受限商品 403），无假成功提示
- 仍缺：`/api/merchant/rfq/:id/quote`、`/api/buyer/rfq/:id/accept`（商家报价与买家接受），已登记在 `tests/api-route-existence.test.ts` 的未实现清单

### 9.4 P1 深链元信息

深链打开商品时同步 `document.title`、`meta[name=description]`、`link[rel=canonical]`；
实测 `Vault 链条包 · 限量 · P2-AUTHZ-PRIVATE · P2 AUTHZ`，不同商品标题不再复用。
预览环境仍整体 `noindex,nofollow`。

### 9.5 P2 视觉精修（本轮实际改动）

| 模板 | 改动 | 目的 |
| --- | --- | --- |
| 编辑版 | 全幅裁切首屏 → 左文右图不对称首屏；商品图 `contain` + 暖中性底 | 白底商品图不再被裁成局部放大 |
| 编辑版 | 删除模板杜撰的「整张牛皮 / Prato, Italia / 为欧洲精品店供货」等文案 | 不虚构商家工艺与产地，改用商家真实资料 |
| 目录版 | 卡片价格/库存对齐、补「可售」标签、关于页改真实品牌故事 | 信息可读性 |
| 电商版 | 去掉无意义的「品类 0」、窄屏价格与库存竖排 | 手机端不再折行 |
| 全局 | 新增 `resolveBrandStory()`：演示/后台说明文字不得作为品牌故事渲染 | 防止把内部说明当官网文案 |
| 全局 | 存储层 **21 处 ≤11px 文案全部提到 12px** | 符合 `design-values.md` 硬底线 |

隔离预览三视口复测（9 组）：**裂图 0 / 横向溢出 0 / <12px 文案 0**。

### 9.6 分数与本阶段结论

| 模板 | 首轮 | 第二轮 | 本轮 | 仍未达 90 的原因（非代码） |
| --- | ---: | ---: | ---: | --- |
| 编辑版 | 75 | 80 | **86** | 无品牌级商品摄影；商家无品牌故事/工艺文案可渲染，首屏只能靠版式支撑 |
| 目录版 | 76 | 82 | **88** | 真实商品无分类层级、无材质/颜色多样性（每款 1 图、1 色），目录密度撑不起来 |
| 电商版 | 80 | 85 | **88** | 无阶梯价、无尺寸矩阵、无 MOQ 差异；订货矩阵目前只有颜色×尺码单格 |

**阶段 B 状态：部分完成（代码侧 P0/P1 全部完成，P2 视觉终验被数据资产阻塞）。三套均未达 90，不进入下一个行业。**

阻塞输入（需要业务侧提供，不是代码问题）：

1. 箱包类真实商品摄影：每款 ≥3 张、统一比例（编辑器/目录/画廊都依赖它）。
2. 箱包专属字段：尺寸（长宽高）、五金、容量、肩带；当前 `Product` 只有 `fabric/origin/composition`。
3. 商品分类层级与材质/颜色多样性，用于目录筛选与系列叙事。
4. 阶梯价与 SKU 矩阵的真实数据，用于电商版 MOQ/批发价展示。

### 9.7 证据

`docs/engineering/evidence/p2-stage-b-bags/`（本轮新增 `*-authz.png` 9 张 + `catalogue-deeplink-authz.png` + `wholesale-rfq-submit-authz.png`）。
提交：`8f1224e`（已推送 `rdmodasrl-spec/rudafashion-v2`）。
