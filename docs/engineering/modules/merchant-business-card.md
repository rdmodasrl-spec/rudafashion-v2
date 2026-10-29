# 商家名片（Merchant Business Card）

状态：部分完成（React 手机端与电脑端已接入；小程序原有名片页未改版；真实会话与真机待验收）

## 1. 问题与目标

商家需要把自己的真实资料、店铺链接、二维码与店铺码交给客户，用于**查看自己的商家信息**和**推广分享自己的商家**。此前手机端首页顶部的 Logo 与商家名称是纯展示，电脑端侧栏商家身份也不可点击；推广信息散落在“更多 → 店铺二维码”等入口。

目标：

- 商家手机端首页顶部 Logo + 商家名称可点击，打开当前商家的信息名片。
- 商家电脑端侧栏商家身份（Logo + 名称）可点击，打开同一张名片。
- 名片只读展示当前商家的真实数据，并提供店铺二维码、店铺链接、分享、复制与店铺码。
- 存在商品查看授权能力时，在名片内说明客户如何获得授权区查看权限。

非目标：

- 不新增商家资料编辑入口（编辑仍在设置/店铺页面）。
- 不新增 API、数据库字段、权限、租户配置或对外分享落地页。
- 不改变首页其他区块、底部导航与“更多”页现有入口。
- 不重做微信小程序 `pages/business-card/index`（本次以内容口径对齐，页面改版另行安排）。

## 2. 防重复检查（新增前置）

| 能力 | 现有实现 | 结论 |
|---|---|---|
| 商家名片 | `merchant-miniprogram/pages/business-card/index`（小程序，已上线内容：Logo、公司名、联系人、电话、WhatsApp、微信、邮箱、官网、税号、地址、分享/保存联系人） | **复用其信息口径**，不新建第二套商家资料模型；本次新增 React 共享组件供电脑端与手机端共用 |
| 商家身份展示 | 手机端首页 header（Logo + 名称）；电脑端侧栏 header（Logo + 名称） | 仅把现有身份区块改为可点击，不新增导航项 |
| 店铺链接 | `src/shared/merchantStoreUrl.ts` → `merchantStorefrontOrigin` / `merchantStorefrontUrl`（`storeSlug` 为数据库分配并绑定的二级域名） | 直接复用；不拼接模拟域名 |
| 二维码 | 手机端“更多 → 店铺二维码”已有 `qrcode.react` 弹窗；服务端 `/api/merchants/code/:storeLookupCode/qr.png` 提供店铺码二维码 | 复用 `qrcode.react` 在前端生成店铺链接二维码，不新增接口 |
| 分享 / 复制 | `src/utils/share.ts` → `shareOrCopy`（系统分享 + 剪贴板回退 + 分享事件记录）；电脑端 `ShareButton` | 直接复用 `shareOrCopy`，不重写分享逻辑 |
| 店铺码 | `Merchant.storeLookupCode`（6 位、唯一、DB 序列生成）；公开接口 `GET /api/merchants/code/:storeLookupCode`；客户端 `MerchantFinder` 支持输入店铺码查找商家 | 直接展示真实店铺码，复用现有查询能力 |
| 商品查看授权 | 商品分区“授权区”（`visibility=private` / `isExclusiveProtected`）+ `VaultAccessRequest`（客户申请 → 商家审批，`/api/vault/request`、`/api/merchant/vault-requests/:id/review`） | 名片内只做**说明**与店铺码，不新增授权逻辑、不展示客户名单 |
| 多语言 | `useB2B().localizeCopy` + `src/i18n/uiCopyCatalog.ts` | 新增文案一律进目录 |

搜索关键字：`business-card`、`storeLookupCode`、`vaultAccessRequest`、`merchantStorefrontUrl`、`shareOrCopy`、`店铺码`、`商家名片`。

## 3. 数据归属与租户边界

- 名片数据全部来自当前会话的 `currentMerchant`（`useB2B().merchants` 中按会话商家 ID 选中），**不额外请求商家列表，不接受客户端传入的商家 ID**。
- 服务端 `/api/merchants` 已按公开字段返回 `storeLookupCode`、`code`、`companyLegalName`、`vatNumber`、城市/地址、联系人/电话/邮箱、WhatsApp、微信、`isVerified`、`logo`、`storeSlug`；名片只读这些字段。
- 空字段不渲染，不显示占位假数据；无 `storeSlug` 时不显示链接/二维码，仅保留资料。
- 名片不展示客户、订单、财务或私密货盘明细，避免越权暴露。

## 4. 界面与流程

共享组件：`src/apps/merchant-admin-common/components/merchant/MerchantBusinessCard.tsx`（`role="dialog"`，支持点击遮罩、关闭按钮、`Esc` 关闭、移动端底部抽屉 / 桌面居中弹窗）。

内容顺序（三端一致）：

1. 身份：Logo、商家名称、`已验证` 标记（`isVerified`）、标语（按语言取 `tagline_zh` / `tagline_it` / `tagline`）。
2. 推广：店铺链接（`https://<storeSlug>.ruda.fashion/<it|zh>/`）、`复制链接`、`分享`、店铺链接二维码。
3. 店铺码：`storeLookupCode`（6 位）及复制；无该字段时整块不显示。
4. 商家资料：公司全称、商家编号（`code`）、城市、展厅地址、联系人、电话（`tel:`）、邮箱（`mailto:`）、WhatsApp、微信。
5. 客户看货说明（有店铺码时）：客户在官网或小程序输入店铺码可找到本店；授权区商品需客户提交看货申请、商家审批后可见。

入口：

- 手机端：首页顶部身份区（原静态 Logo + 名称）改为按钮；`更多` 页原有“店铺二维码”保持不动。
- 电脑端：侧栏顶部商家身份区改为按钮。
- 小程序：已有 `pages/business-card/index`，由经营主页与更多页头部触发，本次不改代码；内容口径与本规格对齐。

## 5. 权限与状态

- 只读展示，不新增权限；能进入商家工作台即可查看自己的名片。
- 未公开店铺（`storefrontEnabled !== true`）：仍显示资料与店铺码，链接/二维码仅在存在 `storeSlug` 时显示；不提示“已公开”。
- 复制失败：使用 `shareOrCopy` 的剪贴板回退；仍失败时显示可重试的短提示，不静默失败。
- 无 `navigator.share`：`shareOrCopy` 自动降级为复制链接。

## 6. 验收标准

- 手机端首页点击 Logo 或名称打开名片；关闭后回到首页原状态。
- 电脑端侧栏点击 Logo 或名称打开同一张名片。
- 名片显示的商家名称、公司全称、商家编号、店铺码、城市、展厅地址、联系人、电话、邮箱与当前商家真实数据一致；切换商家后不残留上一商家数据。
- 店铺链接与二维码指向 `storeSlug` 对应域名，`分享` 调用系统分享或复制链接。
- 无数据字段不出现空行、不出现演示数据。
- 桌面 1280+、手机 390×844 与 320×720 下无横向溢出、无遮挡、可键盘关闭。
- 不改变首页其他功能、底部导航和“更多”页入口。

## 7. 验证方式

- 规则测试：`tests/merchant-business-card.test.ts`（数据来源、真实域名、二维码、分享复用、无重复入口、三端接线、文案目录齐备）。
- 定向回归：手机端导航/设计系统/首页快捷入口、电脑端复制与店铺链接相关测试。
- 类型检查与两个应用的独立构建（输出到临时目录，不写 `dist`）。
- 组件级 320 / 390 / 1280 渲染截图；真实商家会话与真机另行验收。

验证结果（2026-10-26）：

- `node --import tsx --test tests/merchant-business-card.test.ts` → 6/6 通过。
- 定向回归（`merchant-mobile-home-quick-actions`、`merchant-mobile-navigation`、`mobile-design-system`、`merchant-store-url`、`duplication-guards` + 新测试）→ 26/26 通过。
- 定向 `tsc`（`MerchantBusinessCard.tsx` + `MerchantMobileApp.tsx` + `MerchantPortal.tsx` 及依赖）→ EXIT 0。
- `merchant-admin-mobile`、`merchant-admin-web` 独立构建到临时目录 → 均成功（EXIT 0），未写 `dist`、未发布。
- 组件级预览截图（假数据，仅验证布局，不代表真实验收）：320×720、390×844、390×844（意大利语）、1280×900，页面与卡片内部横向溢出均为 0，桌面端资料两列；截图 `/tmp/ruda-verify/business-card-*.png`。
- 未能执行：真实商家会话点击、`navigator.share` 真实分享、iOS/Android 真机触控与滚动。

## 8. 风险与回滚

- 风险：首页 header 由展示改为按钮可能影响点击区域与布局；已限制在 `dashboard` 页签内的身份区，尺寸沿用原 Logo/名称。
- 回滚：删除两处入口按钮与 `<MerchantBusinessCard />` 渲染，恢复原静态 header 即可；无数据库与接口变更，无需数据回滚。
