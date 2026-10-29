# 商家 ModaUI 对话界面与回复风格（V6）

状态：实施中（代码完成后按实际验证结果更新）
范围：商家后台电脑端 `merchant-admin-web`、手机网页端 `merchant-admin-mobile`（共用 `MerchantAiHome`）、商家小程序 `merchant-miniprogram`，共享层 `merchant-admin-common`，服务端 `/api/merchant/assistant/*`，提示词模块 `src/server/merchantSupportAi.ts`。

## 1. 问题与目标

现状问题（来自真实截图与代码核查）：

1. 每条回复下方渲染 `dataBasis` 汇总（“订单/成交数据：近30天 · 库存数据：查询时的当前库存快照 · …”），属内部数据来源说明，普通对话不需要逐轮展示。
2. 电脑端操作按钮下方固定显示“按钮仅打开页面 / 不自动保存”的操作规则说明。
3. 输入框左侧常驻“执行任务”文字开关，被当作内部操作提示反复出现。
4. AI 回复操作行包含复制、有帮助、没帮助、重新生成四个按钮，尺寸偏大且带文字标签。
5. 提示词要求“结论 + 依据 + 建议”，模型倾向输出长报告；前端按固定节奏逐字重放，存在机械感与延迟。

目标：

1. 聊天区不再出现上述三类系统说明；数据依据、操作规则、任务信息仍保留在服务端 metadata、审计与对应管理界面。
2. 每条 AI 回复下方只保留小尺寸灰阶图标操作：分享（浏览器支持时）、复制、删除；重新生成隐藏且不占位。
3. 提示词、响应格式与前端呈现共同改造成“先结论、默认 1–3 句、需要时才展开”的自然对话。
4. 文字仍按真实回复内容分段呈现，粒子状态跟随真实事件，不逐字符跳动，不延迟真实文字。
5. 不改变订单、库存、商品、生产、客户、售后、财务的数据逻辑、权限与租户隔离。

## 2. 非目标

- 不新增 SSE 或第二套流式接口；`/api/merchant/assistant/query` 仍是整包返回，前端只做真实文本的分段呈现。
- 不实现“重新生成”的新交互（本次要求隐藏）。
- 不调整 ModaUI 粒子引擎、WebGL 生命周期与跨锚点迁移（见 `modaui-core.md`）。
- 不改动 `MerchantSupportChat`（平台客服会话，与本模块不同）。

## 3. 复用与查重（防重复建设）

| 现有能力 | 复用方式 |
|---|---|
| `/api/merchant/assistant/query`、`/api/merchant/assistant/conversations*` | 唯一对话数据源，不新增第二套接口 |
| `MerchantAssistantMessage` 表 | 消息唯一权威存储，删除作用在同一行 |
| `MerchantAiHome.tsx`、`MerchantPortal.tsx` | 各自界面复用同一 `AssistantReplyActions` 组件 |
| `modaCoreLife` 事件（`response:start/chunk/complete/abort`） | 继续作为粒子唯一输入，不新增事件类型 |
| `apiDelete`、`localizeCopy`、既有 `window.confirm` 习惯 | 删除与文案处理复用现有封装 |

已搜索关键字：`dataBasis`、`按钮仅打开页面`、`执行任务`、`重新生成`、`assistant/query`、`submitFeedback`、`copyMessage`。
结论：不新建聊天页面、不新建对话表、不新建认证或权限路径；仅在既有链路上做删减、补一个消息级删除接口与一个共享操作组件。

## 4. 聊天界面规则

### 4.1 不展示的系统说明

- 数据依据列表：服务端 `dataBasis` 继续写入 `MerchantAssistantMessage.metadata` 并由会话详情接口返回，供平台侧审计与排障；聊天正文与消息尾注不再渲染。
- 操作规则说明：“按钮仅打开页面 / 不自动保存”从聊天面板移除；动作按钮本身的行为不变。
- 任务说明：“执行任务”不再作为可见文字常驻输入框；任务模式保留为图标开关（`aria-label` 说明），开启时的审批与风险提示保留（真实风险信息不得隐藏）。

### 4.2 AI 回复操作

| 操作 | 规则 |
|---|---|
| 分享 | 仅当 `navigator.share` 可用时显示；内容为当前回复全文；失败不影响复制 |
| 复制 | 复制当前已生成文本（生成中为已显示部分，结束后为完整回复）；成功显示 1.6 秒“已复制”，不弹对话框 |
| 删除 | 先确认；有服务端 `messageId` 时调用 `DELETE /api/merchant/assistant/messages/:id`，失败保留消息并提示真实错误；仅本地消息（图片结果、任务状态文案）才本地移除 |
| 重新生成 | 不显示、不占位 |

视觉：`h-7 w-7` 图标按钮，默认 `text-neutral-400`、`opacity-60`，悬停/聚焦/触摸时 `opacity-100` 且文字变深，无背景色、无文字标签、无分隔线。

### 4.3 三端一致性

| 端 | 实现 |
|---|---|
| 电脑端 `MerchantPortal.tsx` | 共享 `AssistantReplyActions`；对话历史回填 `id` 以支持服务端删除 |
| 手机网页 `MerchantAiHome.tsx` | 同一组件，同一接口，同一删除语义 |
| 小程序 `pages/assistant` | 同一消息 `id` 与同一 DELETE 接口；`wx.setClipboardData` 复制，`wx.showModal` 确认后删除；不展示数据依据 |

## 5. 提示词与回复风格（服务端）

`src/server/merchantSupportAi.ts` 的商家经营助理系统指令改为自然对话约束：

1. 先给结论，再给必要细节；简单问题 1–3 句。
2. 一次回答一个核心问题；不重复用户原话；不用固定开场白与“根据以上分析 / 综上所述 / 以下是完整说明”类套话。
3. 不默认输出标题、编号清单、总结与下一步规划；需要步骤时最多 3 步关键操作。
4. 用户明确要求详细方案、文档或完整报告时才展开长内容。
5. 库存、订单、财务等关键数字、风险、失败原因、权限限制不得为简短而省略。
6. 不确定就说明，不编造数据、执行结果或已完成操作。
7. 不输出数据来源清单、按钮操作说明、任务执行提示等系统说明（这些属于后台与审计）。
8. 输出 JSON 契约不变（`reply`/`confidence`/`needsHuman`/`scope`/`memorySuggestion`）；数值校验、语言一致性校验、`trustedFacts` 唯一事实来源规则不变。

## 6. API 契约：删除单条 AI 回复

`DELETE /api/merchant/assistant/messages/:id`

- 认证：`requireMerchantTenant`；仅会话所属 `merchantId` + 当前 `actorId` 可删。
- 仅允许 `role = 'assistant'` 的消息；用户消息不走该接口。
- 事务内先删除该消息关联的 `ModaGptBrainFeedback`（`messageId` 无外键，需显式清理，避免留下孤儿反馈），再删除消息行。
- 成功：`200 { success: true, messageId }`；不存在或非本人/本租户：`404 { success: false, error: 'ASSISTANT_MESSAGE_NOT_FOUND' }`。
- 幂等性：重复删除返回 404，前端据此提示“消息已不存在”并移除界面项。
- 审计：不写入新审计表；`ModaGptBrainFeedback` 清理保证平台侧不再出现无主反馈。
- 不影响：会话其余消息、用户提问、积分/用量记录、`MerchantAssistantConversation.updatedAt`。

## 7. 流式呈现与粒子同步

- 新增共享 helper `src/shared/assistantReplyReveal.ts`：把真实回复切成自然片段（句末标点、换行、Markdown 列表/标题边界，超长句按 ~42 字再切），返回累计字符锚点。
- 前端按片段更新文本（约 26–30ms/帧），每次只发一个 `response:chunk`（带本次字符数），不再按单字符触发。
- 生成结束后 `response:complete`；删除或中断时 `response:abort`；文本始终来自接口返回，不改写、不并发第二份动画。
- 长回复（>1200 字）按片段数自然延长，但因每帧包含整段文字，整体速度明显快于逐字重放。

## 8. 测试与验收

机械检查（`tests/merchant-assistant-conversation.test.ts`）：

- 片段切分：拼接后与原文完全一致、不产生空片段、句末标点结尾、超长句被切分。
- 系统指令包含精简规则且不含数据依据展示要求。
- `MerchantPortal.tsx`、`MerchantAiHome.tsx` 不再渲染 `dataBasis`/“按钮仅打开页面”/“重新生成”；均引用 `AssistantReplyActions`。
- 小程序 `index.wxml` 不含 `data-basis`/`feedback-actions`，含 `copyReply`/`deleteReply`。
- `server.ts` 含消息级 DELETE 路由与租户/actor 约束。

人工/真实页面验收：

1. 简单问题回复明显更短；复杂问题仍能展开。
2. 三类系统说明不再出现。
3. 复制完整准确；删除只影响目标消息，失败有真实提示。
4. 桌面、手机 Web、小程序布局检查；粒子在生成中连续、结束后平静。

## 9. 部署与回滚

- 只新增一个 DELETE 路由与前端组件，无数据库迁移。
- 回滚：还原 `server.ts`、`merchantSupportAi.ts`、两个聊天组件、小程序三文件与新增 helper/组件即可；已删除消息为真实删除，回滚代码不会恢复，需由备份恢复。
- 发布按既有 `dist/apps/merchant-admin-web`、`merchant-admin-mobile` 独立构建与 `current.json` 切换流程执行。

## 10. 状态

- 文档：已完成。
- 代码：实施中。
- 小程序真机/微信开发者工具：待验收。
