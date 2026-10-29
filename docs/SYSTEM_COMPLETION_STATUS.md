# System Completion Status

执行基线：2026-10-06。状态区分代码实现与验证结果；测试通过不等于生产环境已验收。

| Domain | Feature | Implementation | Verification | Gap | Action | Test | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Security | Admin IP allowlist / proxy IP | EXISTS | Unit tested | 空/无效配置 fail-closed；生产仅 loopback 监听并使用 Express 解析 IP；真实 Nginx 链路尚未部署验收 | KEEP / production verify | 4 allowlist + 2 client-IP tests pass | NEEDS TEST |
| Security | Admin auth / permissions | EXISTS | P0 HTTP integration | 密码下限已提升为 12 位，改密后旧 JWT 立即失效；MFA 强制范围/恢复策略仍待定 | Decide MFA policy / production verify | Login-change-revoke-relogin integration pass | NEEDS HARDENING |
| Tenant | Merchant/store/company isolation | EXISTS | Isolated HTTP + unit coverage | Company catalog/query/create/update/batch 已有 A/B 跨公司负测；所有 merchant routes 仍未逐条覆盖 | Expand route-level negative tests | P0 company + tenant tests pass | NEEDS TEST |
| Tenant | Partner isolation | EXISTS | PostgreSQL integration | Partner/city scope 有隔离测试；线上身份仍未验证 | KEEP / production verify | P0 integration pass | VERIFIED |
| Finance | Payment webhook | EXISTS | PostgreSQL integration | providerPaymentId 为空时跨交易更新已修复；需真实 provider/staging 验收 | KEEP / verify provider | duplicate, rollback, concurrency tests pass | VERIFIED |
| Finance | Refund / payout allocation | EXISTS | Unit + integration subset | 缺统一会计总账、银行对账和完整线上结算证明 | Business design / complete | Unit and P0 integration pass | NEEDS COMPLETION |
| Finance | General ledger / accounting export | MISSING | Not applicable | 当前只有支付/退款交易、佣金、ModaGPT credits ledger；无通用会计分录与会计导出 | Decide chart of accounts and accounting rules | NOT RUN | MISSING |
| Recovery | Backup / restore drill | EXISTS | Isolated PostgreSQL restore verified | 临时空库已完成 dump、SHA256 manifest、restore、127 表校验与 migration rehearsal；未验证脱敏生产数据/目标容量 | KEEP / verify representative backup | Isolated restore + migration pass | VERIFIED |
| Commerce | B2C checkout/order/cancel | EXISTS | Isolated PostgreSQL E2E | 建单、幂等重放、买家 ownership、未配置支付拒绝和取消库存释放已端到端通过；成功支付/配送/退货退款需 sandbox | Verify full provider-to-delivery flow | 1 B2C E2E pass | NEEDS TEST |
| Merchant OS | POS shift/sale/refund/close | EXISTS | Isolated PostgreSQL E2E | 开班、现金销售、重复请求、审计、退款和结班现金余额已在临时库端到端通过 | KEEP / verify remaining payment methods | 1 E2E journey pass | VERIFIED |
| AI | ModaGPT queue/tool/approval | EXISTS | Unit + PostgreSQL integration | 仓库测试覆盖不等于已接生产模型/生产商户验收 | Verify configured providers and policy | Unit 465 pass; integration 11 pass | NEEDS TEST |
| AI | Fashion ingestion provider | EXISTS (workspace-only) | MockTransport tests | OpenAI-compatible adapter已实现；真实 API 凭证未配置；根 `.gitignore` 忽略该目录，代码不会进入常规 Git diff | Confirm source tracking, then configure approved provider key | Python 10 pass | NEEDS TEST |
| AI Marketing | CRM / attribution | EXISTS | PostgreSQL integration subset | 有 CRM/outbox 测试；真实邮件/SMS/社交渠道、同意与 ROI 尚未闭环 | Verify channel credentials and consent rules | P0 integration pass | NEEDS COMPLETION |
| Partner | Referral / commission / reversal | EXISTS | PostgreSQL integration | payout 与银行侧确认仍需真实流程验收 | Verify payout operation | P0 integration pass | NEEDS TEST |
| Marketplace | Seller/order/settlement | PARTIAL | Repository evidence only | dispute / moderation 判责与退款政策未形成可执行闭环 | Product/legal decision then complete | NOT RUN | NEEDS COMPLETION |
| Developer Platform | OAuth / SDK / app marketplace | MISSING | Repository scan | 公共 OAuth、SDK、App Marketplace 不是已实现能力 | Product scope decision | NOT RUN | MISSING |
| Global | Tax/VAT/currency/privacy | PARTIAL | Repository evidence only | 税制、汇率、留存/删除期限需要法律与商业规则 | Legal/accounting decisions | NOT RUN | NEEDS COMPLETION |
| Flutter | Mobile app | EXISTS | Test command attempted | Flutter 依赖解析在项目测试前失败：SDK 提供的 `flutter_localizations` 未能解析；设备/签名验收也未运行 | Repair/verify Flutter SDK package source, then run tests and device checks | BLOCKED before test collection | NEEDS TEST |
| Operations | TypeScript build / unit tests | EXISTS | Verified | 构建通过；有既存分包/大 chunk 警告 | Review performance separately | lint pass; build pass; 465 unit tests pass | VERIFIED |

## Known safe fallbacks

- Fashion ingestion `MockFashionAIProvider` remains for development/test only; `APP_ENV=production` rejects it.
- `PlaceholderPaymentProvider` reports `not_configured` and never claims to charge/refund. Keep it as the disabled-provider state.
- Test suites use mocks/fakes for deterministic provider checks; these are not production provider implementations.
