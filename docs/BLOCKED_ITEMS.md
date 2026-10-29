# Blocked Items

截至 2026-10-06。本清单仅保留不能安全由代码推断或缺少外部条件的项目；仓库内可自动修复的事项已另行处理。

| Item | Why blocked | Safe next step |
| --- | --- | --- |
| Fashion ingestion source tracking | 根 `.gitignore` 明确忽略整个 `fashion-ingestion/`；本轮改动在工作区但不会进入正常 Git diff/提交 | 由仓库负责人确认该服务应纳入主仓库还是独立仓库；未获确认前不移除 ignore，也不使用 `git add -f` |
| Production AI provider verification | 需要经批准的 OpenAI-compatible endpoint、API key、模型及预算；本轮没有真实凭证 | 由密钥管理系统注入 `AI_PROVIDER=openai_compatible`、`AI_BASE_URL`、`AI_MODEL`、`AI_API_KEY` 后，在 staging 运行连通性/成本验收；不要把 key 写入仓库 |
| Admin MFA enforcement policy | 强制 MFA 涉及管理员注册、恢复码、锁定与 break-glass 策略；仅拒绝未配置 MFA 会造成锁号风险 | 由系统负责人确定强制范围和恢复责任人，再实现受控 rollout；现有 MFA setup/enable 保留 |
| Production proxy/IP verification | 生产代码已限制 loopback 监听并使用框架解析 IP；线上 Nginx 实际配置和来源 IP 仍未实测 | 运维确认 Nginx 转发头与入口网络，部署后针对 allowlist 做负测 |
| Production credential rotation | VS Code 任务中的数据库明文口令已移除，但凭证轮换/会话撤销会影响生产服务 | 由有权限的运维在密钥管理/受控终端轮换，并使旧会话失效；本轮未执行 |
| General accounting ledger | 仓库没有通用双分录总账模型；不能推断科目表、收入确认、退款/税/手续费分录规则 | 财务负责人批准科目表、记账时点、舍入和对账规则后，再基于现有 payment/refund/commission 事务补最小账务闭环 |
| Tax, VAT, country and FX policy | 费率、税务地点、汇率来源/时间、精度与舍入属于法律/财务规则 | 由税务/财务确认目标市场规则及汇率供应商后配置实现与验收 |
| Marketplace dispute outcomes | 争议时限、举证、退款、冻结结算与申诉结果属于商业/法律政策 | 产品与法务批准状态机和责任边界后，复用订单、退款、佣金、审核基础实现 dispute 流程 |
| Successful payment-to-delivery E2E | B2C 建单/幂等/未配置支付拒绝/取消库存释放已通过；真实支付成功、配送与退货退款需要 provider sandbox 和地区业务规则 | 使用 provider sandbox 与隔离商户/买家执行，断言 webhook、订单、库存、退款、settlement 和 audit 状态 |
| Representative production restore evidence | 空库隔离恢复和 migration rehearsal 已通过；代表性生产数据量、数据完整性与实际 RTO/RPO 未验证 | 运维提供脱敏备份、独立恢复目标和批准的 RTO/RPO 后运行 `scripts/recovery-drill.ts`；不使用线上目标 |
| GDPR/data retention decisions | 删除、匿名化、账务留存期限与法定保留义务需法律确认 | 由隐私/法律负责人确认数据分类、保留期、删除例外后补齐自动化与审计 |
| Public developer ecosystem scope | OAuth、SDK、App Marketplace 是否属于当前商业版本未获确认 | 先确定外部开发者产品范围；已存在内部 API 不应因此重建 |
| Flutter SDK/package resolution and mobile acceptance | `flutter test` 在收集测试前无法解析 SDK 包 `flutter_localizations`（尝试访问 pub.dev 仍找不到）；设备/商店签名条件也未验证 | 修复/确认 Flutter SDK 与 package source 后先运行 `flutter test`，再用平台 SDK、测试设备和签名配置验收 Android/iOS |
