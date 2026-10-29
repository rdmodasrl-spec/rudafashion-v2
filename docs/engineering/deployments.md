# 生产发布记录

记录每次生产发布的构建、迁移、发布产物与回滚方式。发布机制本身见 [`../../BAOTA-DEPLOY.md`](../../BAOTA-DEPLOY.md) 与 `scripts/start-production.sh`、`scripts/build-app.ts`、`scripts/publish-app.ts`、`scripts/rollback-app.ts`。

## 2026-10-27（全站发布 + ModaUI 套餐目录修复）

- 来源：工作区（分支 `xin2026`，HEAD `9a85ac9`）。**本次发布直接使用工作区代码，未创建 Git 提交**；工作区仍包含六应用迁移与本轮 ModaUI 改动的大量未提交文件。
- 发布范围：六个前端应用全部重建并激活，服务端 `dist/server.cjs` 重建；**无数据库迁移、无数据变更**。
- 修复内容：`loadModaGptBillingCatalog` 与管理端套餐目录查询限定 `modaGptPlanCodes`，排除年度占位套餐 `PLUS_YEAR/PRO_YEAR/BUSINESS_YEAR`；另补齐 `AssistantReplyActions` 的 `复制/Copia` 文案目录项。
- 前置备份：
  - 数据库：`release/pre-deploy-backups/pre-deploy-2026-10-27T03-25-35-291Z.dump`（`pg_dump --format=custom`，858,869 字节，已用 `pg_restore --list` 校验）。
  - 发布状态：`release/deploy-state/20261027T042539/`（旧 `server.cjs`、source map 与六个 `current.json`）。
- 应用 release：

| 应用 | 新 release | 上一 release（`current.previous.json`） |
| --- | --- | --- |
| frontend-web | `20261027032543884-a914988d` | `20261026022802085-da546e4d` |
| frontend-mobile | `20261027032546270-937db518` | `20261026022804319-529d8a3b` |
| merchant-admin-web | `20261027032548102-b180f0f5` | `20261027022735458-ee400daa` |
| merchant-admin-mobile | `20261027032557941-e7a339d8` | `20261027022747459-9ab092a2` |
| platform-admin-web | `20261027032600271-d0c4d999` | `20261026022817638-83ad8ba6` |
| platform-admin-mobile | `20261027032602002-819c86b8` | `20261026022819405-755c78de` |

- 服务端：`dist/server.cjs` 通过 `node --check`；PM2 应用 `ruda-fashion` 于服务器本地时间 2026-10-27 04:27:46（UTC 03:27:46）重启成功，监听 `127.0.0.1:3011` 与兼容端口 `127.0.0.1:3000`；`pm2 save` 已执行。
- 验证：
  - `npx tsc --noEmit -p tsconfig.json` = EXIT 0。
  - `npm run test:unit` = **966/966** 通过。
  - `npm run build` 六端与服务端全部成功；`dist/server.cjs` 已包含目录过滤修复。
  - 六个 `https://ruda.fashion/apps/<target>/current.json` 均返回新 release，`Cache-Control` 为 `no-store`/等价不缓存。
  - `https://ruda.fashion/api/health`、`https://modaui.com/api/health` = 200。
  - 真实商家会话 `GET https://ruda.fashion/api/merchant/modagpt/plans` = **200**，返回 5 个套餐：`FREE, PLUS, PRO, BUSINESS, FASHION_PRO`。
  - 管理端套餐查询使用相同 `modaGptPlanCodes` 条件，5 条全部通过 `serializePlanCatalogItem`；未登录 `GET /api/admin/modagpt/billing/catalog` = 401 `ADMIN_AUTH_REQUIRED`。
  - `npm run smoke:post-deploy`（`SMOKE_BASE_URL=https://modaui.com`）通过：健康、数据库就绪、商家注册路由、管理员 API/CORS、小程序视频 CORS、60 个本地化公开页、根跳转、发现文件。
  - 生产真实商家会话（Playwright）：手机 390×844 与桌面 1440×900 均正确加载，无横向溢出；手机端“套餐与额度”完整显示 5 档套餐；无 5xx。截图：`/tmp/ruda-prod-mobile-390.png`、`/tmp/ruda-prod-mobile-pricing.png`、`/tmp/ruda-prod-desktop-1440.png`。
  - 桌面端 4 个失败请求均为既有演示图片 `https://b2b.ruda.fashion/demo-products/*`，与本次发布无关。
- 回滚方式：
  - 应用级：`npm run rollback:app <target>`（使用 `current.previous.json`）。
  - 服务端：`cp release/deploy-state/20261027T042539/server.cjs.prev dist/server.cjs && ./node_modules/.bin/pm2 restart ruda-fashion`。
  - 数据库：本次无迁移、无数据变更，无需恢复；前置备份仍可用于灾难恢复。
- 已知遗留：
  - 商家小程序未上传/未发布：当前环境无微信上传密钥或 CI；`pages/assistant` 仍受 `AI_FEATURES_ENABLED=false` 与 `app.json` 未注册 tab 限制，真机视觉/触控待验收。
  - 管理端套餐目录的完整鉴权后 200 尚未用管理员会话实测；同查询与序列化、路由鉴权 401 已验证。
  - 工作区仍未提交 Git，需补提交以形成可追溯版本。

## 2026-10-26（全站发布）

- 来源：工作区（分支 `ui/merchant-miniprogram-premium`，HEAD `9a85ac9`）。**该次发布直接使用工作区代码，未创建 Git 提交**；工作区当时有 1,633 项未提交改动（`src/components` → `src/apps` 六应用架构迁移、商家手机端消息中心、智能生产链等）。
- 发布范围：六个前端应用全部重建并激活，服务端 `dist/server.cjs` 重建，数据库迁移 2 个。
- 前置备份：
  - 数据库：`release/pre-deploy-backups/pre-deploy-2026-10-26T01-18-00-442Z.dump`（`pg_dump --format=custom`，787,809 字节，已用 `pg_restore --list` 校验）。
  - 发布状态：`release/deploy-state/20261026T021756/`（旧 `server.cjs` 与六个 `current.json`）。
- 数据库迁移：`20261025190000_production_chain_app`、`20261026120000_production_chain_simplified`（后者删除 v1 未上线的扩展表，恢复依赖上述备份）。执行后 `prisma migrate status` = `Database schema is up to date!`，139 个迁移。
- 应用 release：

| 应用 | 新 release | 上一 release（`current.previous.json`） |
| --- | --- | --- |
| frontend-web | `20261026011805035-e86a4a2a` | `20261024233059299-74903e2b` |
| frontend-mobile | `20261026011807373-3ace856f` | `20261024233101621-08a6972e` |
| merchant-admin-web | `20261026011809129-b4d51518` | `20261025131816326-1c81aae7` |
| merchant-admin-mobile | `20261026011818643-56faef98` | `20261025131816326-7d059581` |
| platform-admin-web | `20261026011820839-3c406bb5` | `20261024233115011-060ffe8d` |
| platform-admin-mobile | `20261026011822470-a78c326a` | `20261024233116614-6455af27` |

- 服务端：PM2 应用 `ruda-fashion` 重启成功（服务器本地时间 2026-10-26 02:19:46，UTC 01:19:46），监听 `127.0.0.1:3011` 与兼容端口 `127.0.0.1:3000`；`pm2 save` 已执行。
- 验证：
  - `npm run smoke:post-deploy`（`SMOKE_BASE_URL=https://modaui.com`）通过：健康检查、数据库就绪、商家注册路由、管理员 API/CORS、小程序视频 CORS、60 个本地化公开页、根跳转、发现文件。
  - 本机：`/`、`/api/health`、`/zh` 均 200；`/merchant` 200；`/api/merchant/notifications` 未登录 401。
  - 六个应用 `app.js` 均 200；`https://ruda.fashion/apps/<target>/current.json` 返回新 release 且 `Cache-Control: no-store`。
  - 商家手机端 bundle 内含 `chunks/MessagesCenter-*.js`（消息中心）。
- 回滚方式：
  - 应用级：`npm run rollback:app <target>`（使用 `current.previous.json`）。
  - 服务端：`cp release/deploy-state/20261026T021756/server.cjs.prev dist/server.cjs && ./node_modules/.bin/pm2 restart ruda-fashion`。
  - 数据库：仅迁移 2 个新增迁移，如需回滚按备份恢复；`production_chain` 相关表为新增表，回滚代码后不再引用。
- 已知遗留：`npm run lint`（`tsc --noEmit`）仍有 63 个既有类型错误，不影响 Vite/esbuild 构建；发布未提交 Git，需补提交以形成可追溯版本。

## 运维手册：管理端 IP 白名单与客户端 IP 解析

管理端 API（`requireAdminAuth`）在生产环境强制校验来源 IP，命中 `ADMIN_IP_WHITELIST` 才放行；该链路依赖反向代理把真实客户端 IP 传给 Node 进程。排障顺序如下。

1. 看服务端日志中的拒绝记录，确认 Node 实际解析到的 IP：
   ```
   pm2 logs ruda-fashion --lines 200 --nostream | grep 'security] rejected admin API request'
   # [security] rejected admin API request from non-allowlisted client IP 127.0.0.1 (GET /api/admin/...); allowlistConfigured=true allowPrivateAdminIps=false
   ```
   - 显示为 `127.0.0.1` / `::1`：Nginx 没有传 `X-Forwarded-For`，问题在代理配置，不在白名单。
   - 显示为运营者真实公网 IP 但被拒：白名单条目过期，按下述第 3 条更新。
   - 显示为 CDN 边缘 IP：多一层代理，按第 4 条提高信任跳数。
2. Nginx 站点配置必须包含（宝塔站点 → 配置文件）：
   ```nginx
   proxy_set_header Host $host;
   proxy_set_header X-Real-IP $remote_addr;
   proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
   proxy_set_header X-Forwarded-Proto $scheme;
   ```
   改完 `nginx -t && nginx -s reload`。
3. 更新白名单（逗号分隔，支持 IPv4/IPv6 与 CIDR），保留校验，不得为消除报错关闭 IP 限制：
   ```env
   ADMIN_IP_WHITELIST="203.0.113.10,198.51.100.0/24,2001:db8:1::7,2001:db8:abcd::/48"
   ALLOW_PRIVATE_ADMIN_IPS="false"   # 仅在 SSH 隧道/内网访问时临时置 true
   ```
   修改后 `pm2 reload ruda-fashion --update-env`。
   - 变量名固定为 `ADMIN_IP_WHITELIST`；不存在 `ADMIN_IP_ALLOWLIST`。
   - 单独写 IPv6 地址表示精确匹配；网段请带 `/128`、`/64` 等前缀。IPv4-mapped 地址（`::ffff:203.0.113.10`）会被归一为 IPv4 再比较。
   - 登录态下可访问 `GET /api/admin/security/access-check` 查看 Node 解析到的 `clientIp`、`allowed`、`allowlistConfigured` 与代理跳数，该接口不受 IP 白名单拦截，只要求管理员会话。
4. 如果前面还有 CDN 或其他代理，把 `TRUST_PROXY_HOPS` 设为实际代理层数（1-5，默认 1），否则 `req.ip` 只会取到上一跳地址；非法值会被忽略并回退到 1，同时打印 `[security] Ignoring invalid TRUST_PROXY_HOPS=...`。
5. 相关实现：`src/server/clientIp.ts`（取址）、`src/server/adminIpAllowlist.ts`（白名单解析与匹配）、`src/server/trustedProxy.ts`（跳数解析）、`server.ts`（`trust proxy` 设置与 `requireAdminAuth`）。


## 发布闸门与本次新增迁移（2026-10-29）

- 发布脚本：`scripts/deploy-release.sh`（`--dry-run` 预检 / `--confirm` 执行）。
- 顺序：数据库预发布备份 → `prisma migrate deploy` → `npm run build` → `pm2 startOrRestart ecosystem.config.js` → `smoke:post-deploy`。
- 本次待应用迁移：
  - `20261029120000_consumer_account_closure`：新增 `ConsumerWishlistItem` 表、`Order.consumerId` 列与索引。
  - `20261029230000_notification_business_status`：新增 `NotificationEvent.businessStatus` 列与索引。
- 两条迁移都是**只增结构**，旧代码可继续运行；回滚脚本末尾有逆向 SQL。
- 发布前必须确认 `prisma migrate status` 只列出这两条，且已安排维护窗口。
- 生产发布需要显式授权：脚本在无 `--confirm` 时不会改动任何数据。
