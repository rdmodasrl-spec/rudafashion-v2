# ModaUI 单页智能创作工作台（Workbench）

- 模块 ID：`modaui-workbench`
- 状态：**部分完成**（工作台定义六项 Apparel 能力；Web/手机 Web 的专业打版与走秀视频均未接入真实引擎；小程序仍未切换到该创作工作台；各图片能力当前可用性以服务端 Provider/套餐为准）
- 关联文档：`docs/engineering/modules/modaui-core.md`（粒子数字生命）、`docs/engineering/modules/merchant-three-end-matrix.md`、`docs/engineering/modules/modagpt-billing-catalog.md`
- 强制规则：`AGENTS.md` 第 3 节（单一事实来源）、第 4 节（文档先行）、第 15 节（商家三端联动）
- 验证证据：`docs/engineering/audit/modaui-workbench-2026-10-27/`（4 个视口截图 + `report.json`）

---

## 0. 一句话定型

ModaUI Apparel 工作台列出 **6 项固定专业能力**（真人 AI 虚拟试衣、AI 服装设计、AI 模特棚拍、高清精调色、AI 走秀视频、AI 专业智能打版），由 **后台推理中枢** 判断意图、检查素材、规划步骤并只执行真实已接入的引擎。能力目录不是完成证明；当前视频和专业打版明确未接入，图像能力还受服务端 Provider/套餐限制。

视觉方向：白/浅灰画布、黑色文字、细线分隔，青色只用于选中与真实执行状态。不使用金色、不使用大面积霓虹。

---

## 1. 现状审计（改动前，2026-10-27）

### 1.1 入口与重复结构

| 运行面 | 现状 | 问题 |
|---|---|---|
| 商家 Web `merchant-admin-web` | 侧栏/底栏 `创作空间` → `activeTab='fashion_studio'`（`MerchantPortal.tsx`）→ **4 张卡片落地页**（服装设计/虚拟试衣/商业模特/服装换色，每张卡一个“打开”按钮）→ 设置 `fashionStudioInitialMode` 并切到 `activeTab='modagpt'` → **全屏 `MerchantAiHome`** | 二级落地页 + 卡片入口与工作台内 7 个模式入口重复；同一能力存在两条路径 |
| 商家手机 Web `merchant-admin-mobile` | `ai_home`（导航名 `ModaUI`）→ 直接渲染 `MerchantAiHome` | 同一组件，但入口语义与 Web 不同 |
| 商家小程序 `merchant-miniprogram` | 无 ModaUI 创作入口；仅承载 DigitalLife 粒子（`utils/moda-core.js`） | 创作能力缺失 |

### 1.2 组件内功能清单（`MerchantAiHome.tsx`，2158 行）

- 分区：`chat` / `create` / `designs` / `knowledge` / `recolor`（切换即整屏替换，等同二级页面）。
- 创意模式 7 个：`design`、`generate`、`tryon`、`edit`、`fashionVideo`(available:false)、`inspiration`、`productLaunch`。
- `generate` 与 `productLaunch` 都是“文字 → 图片”的同一服务端能力，仅提示词不同 → 入口重复。
- `inspiration` 只产出对话文本，不产出资产 → 与“AI 服装设计”重复。
- 另有商家助手对话（`/api/merchant/assistant/*`）与知识库管理混在同一组件内。

### 1.3 真实服务端能力（唯一权威，来自源码核验）

| 能力 | 真实契约 | 证据 |
|---|---|---|
| 文字生成图片 | `POST /api/merchant/modagpt/images`，body 仅允许 `{task:'imageGeneration', prompt}`；`prompt ≤ 800`，禁止其它字段 | `server.ts` images 路由；`src/server/modagptEntitlements.ts` `parseModaGptImageRequest` |
| 虚拟试穿 | 同端点 `task:'tryOn'`，需 `category`（tops/bottoms/one-pieces）、`personImage`（data URL）、`garmentImage` 或 `garmentStorageKey`、`privacyConsent:true`；仅 fal 提供方 | 同上 |
| 任务状态恢复 | `GET /api/merchant/modagpt/images/tasks/:key` + `Idempotency-Key: image-<uuid>` | `src/api/modagptImageTasks.ts`（`requestModaGptImage` / `recoverModaGptImageTask` / sessionStorage 待办键） |
| 精准换色 | **客户端像素级**换色：画笔蒙版 + `recolorMaskedPixelsAsync`（`src/shared/garmentRecolor.ts`）+ `ModaGptGarmentRecolor.tsx` | 非生成式；不做 AI 区域分割/修复 |
| 资产保存 | `POST /api/merchant/modagpt/designs`（`imageDataUrl` 必须是 `data:image/webp;base64`，解码 ≤5MB、`clientRequestId` 幂等）；`GET /api/merchant/modagpt/designs?category=`；`PATCH .../:id/favorite`；`DELETE .../:id`；`GET .../:id/image` | `server.ts` designs 路由；`MerchantModaGptDesign` |
| 额度与套餐 | `GET /api/merchant/modagpt/entitlements`（`plan`、`quotas/usage/remaining`、`capabilities.imageGeneration|tryOn`、`providers.image`、`billing.creditBalance`） | `server.ts`；`MerchantAiHome` 类型定义 |
| 计费与扣减 | 每次图片任务先预留额度，失败 `RELEASE` 并记录 `failed` 用量 | `server.ts` images 路由 |
| 时装视频 | **无**图生视频引擎；`fashionVideo*` 服务只做视频导入/切片/编辑器 | `src/server/fashionVideoImport.ts`、`fashionVideoSlicing.ts`、`fashionVideoEditor.ts` |
| 图生图（商品图 → 棚拍图） | **无**：`imageGeneration` 不接受任何图片输入 | `parseModaGptImageRequest` 字段白名单 |

结论：当前真实可用的是 **文字→图（imageGeneration）**、**人物+服装→试穿图（tryOn）**、**本地像素换色**、**资产保存/版本列表**。凡是需要“以某张图作为输入继续生成”的链路（商品图→棚拍、换色→棚拍、试穿→棚拍、图→视频）**都尚未接入**，必须按 §5.3 如实标注，不得用提示词假装实现。

---

## 2. 能力矩阵（产品定义 vs 真实执行）

| # | 能力 | 入口 ID | 真实执行路径 | 输入素材 | 状态 | 限制（必须如实告知） |
|---|---|---|---|---|---|---|
| 1 | 真人 AI 虚拟试衣 | `tryon` | `tryOn`（fal）：人物 + 服装 → 试穿结果 | 人物图、服装图、品类、隐私确认 | 部分完成，受 Provider/套餐门禁 | 未验证人脸/服装细节保持质量 |
| 2 | AI 服装设计 | `design` | `imageGeneration` + `buildFashionDesignConceptPrompt`（1–3 个方向，逐张真实任务） | 文字 brief | 部分完成，受 Provider/套餐门禁 | 结构化款式与可靠局部编辑未接入 |
| 3 | AI 模特棚拍 | `studio` | `imageGeneration` + `buildModelStudioPrompt`（文字 brief） | 文字 brief | 部分完成，受 Provider/套餐门禁 | **商品图作为输入未接入**；不能保证服装一致性 |
| 4 | 高清精调色 | `recolor` | 本地像素映射 + 画笔蒙版，导出 WebP 后保存为资产 | 服装图（本地或已保存资产） | 部分完成（手动选区） | 非 AI 区域识别；无量化色差验证 |
| 5 | AI 走秀视频 | `video` | 无 | — | 被阻塞（未接入） | 不创建假任务或假进度 |
| 6 | AI 专业智能打版 | `pattern` | 无 Apparel CAD/纸样/放码引擎；只显示未接入 | 服装图（未来输入） | 被阻塞（未接入） | 不创建任务，不生成纸样或生产文件 |

`available` 判定以服务端真实状态为准：`imageGeneration` 需 `capabilities.imageGeneration && providers.image !== 'unavailable'`；商业棚拍另需套餐 ∈ `pro/business/fashion_pro`；`tryOn` 需 `capabilities.tryOn` 且 `providers.image === 'fal'`；换色只表示本地手动像素处理可用；视频和专业打版恒不可用。


---

## 3. 单页面布局

### 3.1 桌面（≥1024px）

```
┌ 顶栏：ModaUI · 当前会话 · DigitalLife 状态 · [素材] [设置] [退出] ─────────────┐
├ 左栏 220px          ├ 主工作区（时间流）                    ├ 检查器 300px（按需）┤
│ AI 服装设计          │ 请求 → 推理计划 → 任务状态 → 结果块     │ 提示词快照          │
│ 虚拟试穿            │ …                                     │ 引擎 / 任务 ID      │
│ 精准换色            │ ─────────────────────────────────      │ 版本与来源          │
│ AI 模特棚拍          │ 素材槽位 + 输入框 + 生成按钮            │ 后续操作            │
│ AI 走秀视频（未接入） │                                       │                    │
│ AI 专业智能打版（未接入）│                                     │                    │
│ 最近作品（5）        │                                       │                    │
└────────────────────┴───────────────────────────────────────┴────────────────────┘
```

- 左栏入口只设置“当前创作意图”，**不换页、不清空素材与输入**。
- 检查器在首次出现结果后自动展开；专注模式可同时收起左右栏。
- 素材库为右侧抽屉（300–420px），选中资产后自动回到当前任务并放入对应槽位。
- 设置为轻量弹层：套餐/额度、图片引擎、动画开关（本地持久化），关闭后保持任务上下文。
- DigitalLife 复用既有 `ModaCoreStageProvider` + `ModaCoreAnchor kind="hero"`，尺寸 44–56px，只随真实任务状态变化。

### 3.2 手机（<1024px）

- 顶栏压缩：品牌 + 状态 + 素材/设置图标。
- 六项能力为横向滚动胶囊，位于输入区上方，不占首屏大面积；未接入能力必须显式显示原因且不可提交任务。
- 工作区单列：状态 → 素材槽位 → 结果流；检查器改为底部覆盖层抽屉。
- 输入区固定在底部，`padding-bottom: max(0.75rem, env(safe-area-inset-bottom))`，键盘弹起时不遮挡。
- 试穿的两个素材框窄屏下上下排列，标签固定为“人物 / 服装”。

---

## 4. 推理中枢契约

### 4.1 纯函数边界

`src/apps/merchant-admin-common/components/merchant/modaui/modaWorkbenchPlan.ts`：

```ts
planModaWorkbenchTask({
  text,                                      // 用户本轮输入
  capability: WorkbenchCapabilityId | null,  // 显式选择的意图，null = 自动识别
  assets: { person, garment }                // 已就绪素材（dataUrl）
}) => ModaWorkbenchPlan
```

```ts
type ModaWorkbenchPlan = {
  capability: WorkbenchCapabilityId;       // 主任务
  steps: Array<{
    capability: WorkbenchCapabilityId;
    execution: 'server_image_generation' | 'server_try_on' | 'client_recolor' | 'unavailable';
    status: 'ready' | 'blocked';
    reason?: 'not_integrated' | 'plan_required' | 'engine_unavailable';
  }>;
  missing: Array<'brief' | 'person' | 'garment'>;
  constraints: string[];                   // 硬约束（重新生成不丢失）
  question: { zh: string; it: string } | null;
  blocked: 'not_integrated' | 'plan_required' | 'engine_unavailable' | null;
};
```

规则：

1. **意图识别**：视频关键词（视频/走秀/短片/runway/film）→ `video`；换色关键词（换色/改成…色/颜色改为/recolor）→ `recolor`；试穿关键词（试穿/穿上/上身/try-on）→ `tryon`；棚拍关键词（棚拍/主图/电商图/模特图/细节图/场景图/白底图）→ `studio`；否则 `design`。显式选择优先于自动识别。
2. **组合任务**：同一句出现换色 + 棚拍 → `steps = [recolor(ready), studio(blocked: not_integrated)]`，`question` 只问一次“是否先用文字描述生成独立的棚拍图”。
3. **素材检查**：`tryon` 缺人物/服装 → `missing`；`recolor` 缺服装 → `missing: ['garment']`；其余缺 brief → `missing: ['brief']`。
4. **硬约束**：换色默认追加“保留版型、纹理、纽扣与光影”，用户文本中的“保留/不要改/只改”片段一并保留。
5. **绝不虚构能力**：`video` 恒 `blocked: 'not_integrated'`；需要图片输入的棚拍恒 `blocked: 'not_integrated'`。

### 4.2 任务状态机（客户端真实阶段）

`draft → validating → running → quality_check → completed`，异常：`needs_input / failed`。

映射真实过程：提交前校验（素材/额度/套餐）→ 真实请求进行中（`requestModaGptImage` 阻塞期间显示已用真实秒数，不显示百分比）→ 客户端质量检查（解码返回图、核对尺寸）→ 完成。失败按服务端错误码映射中文原因，可重试（复用输入快照，新的 `Idempotency-Key`）。

刷新恢复：挂载时读取 `getPendingModaGptImageTaskKeys(merchantId)` 并 `recoverModaGptImageTask`，恢复真实结果或失败原因。

### 4.3 结果与版本

- 每个结果块记录：图片 data URL、提示词快照、引擎标识、`taskId`、创建时间、来源结果 ID（本次会话内的加工谱系）。
- 加工链（设计 → 换色、试穿 → 换色）在会话内可回看；**服务端尚无 `parentDesignId`/`AssetRevision`**，跨会话谱系待数据库变更（见 §8）。
- 保存到素材库为显式操作，复用 `POST /api/merchant/modagpt/designs`（WebP + `clientRequestId` 幂等）；保存后结果块显示资产 ID。
- 绝不静默覆盖原始资产。


---

## 5. 页面交互细节

### 5.1 输入区

- 单一输入框，`Enter` 提交、`Shift+Enter` 换行；提交中保留草稿文本。
- 附件按钮：图片（人物/服装/参考），≤8MB，JPEG/PNG/WebP；拖拽与粘贴图片同样写入素材槽位。
- 输入区上方显示当前意图与计划摘要（1 行，最多 3 个步骤 chip）；缺失素材以一行短提示指出，不弹表单。

### 5.2 试穿槽位

- 恒为两个框：左“人物 / 模特”，右“服装”；每个框只有“更换 / 移除”，无说明长文。
- 首次使用需勾选肖像授权（`privacyConsent`），否则主按钮禁用并给出原因。

### 5.3 未接入能力的呈现

- 左栏“时装视频”始终可见，进入后输入区显示「当前未接入视频引擎，暂不能创建视频任务。」，不提供生成按钮。
- “AI 专业智能打版”始终可见并标记未接入；识别到打版请求时显示明确阻塞说明，不创建任务、不导出假纸样/生产文件。
- 商业棚拍在用户附上商品图并期望“以该图为输入”时，计划中第二步标记 `blocked`，提示：目前只能按文字描述生成棚拍图；以商品图为输入的棚拍引擎尚未接入。
- 任何 `blocked` 状态都**不发起请求、不扣额度**。

---

## 6. 复用与防重复

| 复用对象 | 用途 | 不新建的理由 |
|---|---|---|
| `src/api/modagptImageTasks.ts` | 图片/试穿任务提交、幂等、状态恢复 | 已实现 `Idempotency-Key`、sessionStorage 待办、类型不匹配与 404 恢复 |
| `src/shared/modagptImageContract.ts` | 设计/棚拍提示词模板与长度校验 | 与既有页面使用同一模板，避免提示词分叉 |
| `src/shared/garmentRecolor.ts` + `ModaGptGarmentRecolor.tsx` | 精准换色 | 像素映射与蒙版逻辑唯一实现 |
| `modaui/ModaUICore.tsx` + `ModaCoreStage.tsx` + `modaCoreLife.ts` | DigitalLife 状态 | 单一渲染器/事件通道，禁止第二套动画 |
| `MerchantModaGptDesign` + designs 路由 | 资产库与版本 | 已有幂等保存、存储键校验、删除清理 |
| `/api/merchant/modagpt/entitlements` | 套餐、额度、引擎可用性 | 服务端权威，前端不硬编码能力 |

新增代码：`modaWorkbenchCapabilities.ts`（能力注册表）、`modaWorkbenchPlan.ts`（推理/规划纯函数）、`ModaUIWorkbench.tsx`（单页 UI）。三者不复制既有业务规则：能力可用性读 entitlements，执行走既有 API，换色走既有组件。

---

## 7. 权限、租户与计费

- 所有请求沿用 `requireMerchantTenant`；前端不传权威 `merchantId`（仅用于 sessionStorage 键与页面上下文）。
- 员工权限沿用服务端校验；前端隐藏按钮不作为授权。
- 每次真实图片任务在服务端预留并结算额度；失败释放。客户端不计算额度，只显示 `entitlements` 返回值。
- 素材保存走服务端存储键与所有者校验；删除为显式确认。

---

## 8. 已知缺口（本次未做，必须如实告知）

1. **图生图引擎未接入**：商业棚拍不能以商品图为输入；换色/试穿结果无法继续棚拍。需要新增受控的 image-to-image 适配器（服务端能力声明 + 计费项），并同步 `parseModaGptImageRequest` 与本文档。
2. **视频引擎未接入**：无图生视频提供方；`video` 入口为只读说明状态。
3. **Apparel CAD 未接入**：无权威服装纸样几何、放码、质量校验及生产导出服务；`pattern` 仅作明确阻塞提示，不能复用 Leather 行业引擎或图像模型伪造结果。
4. **AI 区域分割未接入**：换色依赖用户画笔蒙版（默认全图/手动选区），非自动识别服装区域。
5. **资产谱系未持久化**：`MerchantModaGptDesign` 无 `parentDesignId`/`revision`/`qualityStatus` 字段；当前仅为会话内谱系。需要一次可回滚迁移（新增可空列 + 索引）后补齐。
6. **商家小程序**：`merchant-miniprogram/pages/assistant` 仍是旧结构，没有 Apparel 六项创作入口，并受 `utils/review-features.js` 的 `AI_FEATURES_ENABLED = false` 审核期开关限制；排在下一轮（见 §13）。
   - 商家手机 App（`merchant-admin-mobile`）已在 2026-10-27 第二轮切换到同一工作台（见 §13.1）。
   - `MerchantAiHome.tsx` 现已没有任何渲染入口，属于待决策的遗留组件（对话与数字生命首页是否并入工作台后再删除）；本轮不删除，避免同时改动 4 个直接读取它的测试。
6. **任务队列与取消**：图片任务为同步等待 + 幂等恢复，无独立队列视图；“取消”不提供（引擎不支持）。

---

## 9. 验收标准（本轮）

| 项 | 判定 | 证据 |
|---|---|---|
| 单页无二级跳转 | Web `创作空间` 直接进入工作台；卡片落地页与 7 模式入口消失；六项能力切换不丢输入/素材 | 源码 + 截图 |
| 六项能力真实状态 | 每项按 Provider/套餐/引擎事实显示；视频与打版明确未接入；`blocked` 不创建任务、不扣额度 | 单测 + 源码 |
| 推理规划 | 组合请求（换色 + 棚拍）产生 `[recolor ready, studio blocked]` 与一次提问；试穿缺素材只提示缺失项 | `tests/modaui-workbench.test.ts` |
| 真实任务 | 生成/试穿走 `requestModaGptImage`，显示真实秒数与真实错误码；刷新可恢复 | 源码 + 真实页面 |
| 资产 | 保存走 designs API，返回资产 ID；不覆盖原件 | 源码 |
| DigitalLife | 复用同一渲染器，状态映射 `idle/thinking/success/error`，无静态图片 | 截图 + `data-modaui-core` |
| 响应式 | 1440 三栏、1024 双栏、390 单列 + 底部抽屉；无横向溢出 | 截图 |
| 类型/单测/构建 | `tsc` 0；新增测试通过；全量单测通过；`build:app` 成功 | 命令输出 |

---

## 10. 实施顺序与状态

- **P0（历史实现）**：单页骨架、五项能力注册表、推理规划纯函数、既有图像/试穿/换色能力接线、保存流程、Web 入口替换。此条不代表六项专业能力已完成。
- **P1（下一轮）**：商家手机 App 与小程序接入同一工作台；素材谱系迁移；AI 区域分割。
- **P2**：图生图引擎接入（棚拍/换色后续加工）、质量检查记录表。
- **P3**：视频引擎接入、成本与质量看板。

---

## 12. 验证记录（2026-10-27）

| 项 | 命令/方法 | 结果 |
|---|---|---|
| 类型检查 | `npx tsc --noEmit -p tsconfig.json`，过滤 `^src/` | `src/` 0 错误（仓库内未跟踪的 `OpenMontage/` 子项目有 64 条历史错误，与本变更无关） |
| 工作台单测 | `node --import tsx --test tests/modaui-workbench.test.ts tests/merchant-modagpt-layout.test.ts` | 16/16 通过 |
| 全量单测 | `npm run test:unit` | **988/988 通过**（第二轮修复 `portal-domains`：删除 `ruda.fashion → ruda.fashion` 自跳转、把 `video.ruda.fashion` 纳入规范来源与断言） |
| 文案目录 | `tests/ui-translation-copy.test.ts` | 9/9 通过（新增 68 条文案对已登记到 `src/i18n/uiCopyCatalog.ts`） |
| 商家 Web 构建 | `npm run build:app:merchant-admin-web` | 成功：`20261027225450945-0ee0cef9`（未发布） |
| 商家手机构建 | `npx tsx scripts/build-app.ts merchant-admin-mobile` | 成功：`20261027231831819-98c881d6`；含 `chunks/ModaUIWorkbench-EUO7QVHI.js`（157.35 kB / gzip 44.39 kB）（未发布） |
| 浏览器验收 | Playwright + Chromium（SwiftShader WebGL2），工作台组件 + 桩 API | 1440×900 / 1024×768 / 390×844 / 320×640：横向溢出 0，`data-modaui-core="webgl"`，控制台 0 错误；组合请求出现「精准换色 → 商业棚拍（未接入）」计划与图生图缺失说明；生成结果块 1 个（无重复结果）；试穿双素材框可见；视频入口提示「当前未接入视频引擎」；1440 下结果检查器可见 |

截图与数据：`docs/engineering/audit/modaui-workbench-2026-10-27/`。
复现脚手架（不含在生产构建内）：`/tmp/moda-wb-harness/`（`build.mjs` 打包、`run.mjs` 截图与断言、`entry.tsx` 桩 API）。

**注意**：截图中的生成结果为桩响应（仅验证界面与真实调用路径），不代表真实引擎出图；真实引擎调用需在已登录商家会话中验收。

---

## 11. 影响面与回滚

- 影响：商家 Web `MerchantPortal.tsx` 的 `fashion_studio`/`modagpt` 分支；新增 3 个共享文件；新增 1 个测试文件；更新 `tests/merchant-modagpt-layout.test.ts` 的 Web 入口断言。
- 不影响：`MerchantAiHome`（手机 App 继续使用）、`/api/merchant/modagpt/*` 契约、数据库结构、计费规则、DigitalLife 渲染器。
- 回滚：`git revert` 本次提交即可恢复卡片落地页与旧入口；无数据库、无静态资源、无生产配置变更。

---

## 13. 第二轮：三端接入与真实环境取证（2026-10-27）

### 13.1 三端接入状态

| 运行面 | AI 入口 | 本轮实现 | 状态 |
|---|---|---|---|
| 商家 Web `merchant-admin-web` | 侧栏/底栏 `创作空间`、`modagpt` | `lazy(ModaUIWorkbench)` 全屏单页（第一轮完成） | 已完成（浏览器验收见 §12） |
| 商家手机 Web / App `merchant-admin-mobile` | 底栏 `ModaUI`（`ai_home`） | `MerchantMobileApp.tsx` 渲染同一个 `lazy(ModaUIWorkbench)`：固定全屏 + `pt-[env(safe-area-inset-top)]` + `bottom: visualViewportInset`；删除旧拖柄导航状态 `aiNavigationOpen` 与 `toggleAiNavigation`，`ai_home` 下底部导航恒隐藏、`tabIndex=-1` | 代码完成、`tsc` 与构建通过；真实登录态视觉验收待执行 |
| 商家小程序 `merchant-miniprogram` | `pages/assistant` | 未接入；`utils/review-features.js` 的 `AI_FEATURES_ENABLED = false` 仍在审核期关闭 AI | 未开始 |

三端共用同一份事实来源：`modaui/modaWorkbenchCapabilities.ts`（能力与可用性）、`modaui/modaWorkbenchPlan.ts`（推理规划）、`/api/merchant/modagpt/*`（任务与资产）、服务端套餐与额度判定。差异只在布局：Web 三栏、手机单列 + 抽屉。

手机端行为说明：旧 `MerchantAiHome` 的空态/对话/数字生命首页不再作为 `ai_home` 入口；退出统一走工作台左上角返回，回到进入前的页签（`copilotOriginTabRef`）。

### 13.2 真实接口取证

会话方式：本地用 `JWT_MERCHANT_SECRET` 签名商家 JWT（服务端走与登录同一个 `verifyToken`），因此是**真实鉴权链路 + 真实数据库**，但不是商家密码登录，不能替代真实登录态的 UI 出图验收。

| 检查 | 结果 |
|---|---|
| `GET /api/merchant/modagpt/entitlements` | 200；`plan: free`、`quotas.imageGeneration: 0`、`providers.image: "unavailable"` |
| `GET /api/merchant/modagpt/designs` | 200；`designs: []` |
| `POST /api/merchant/modagpt/images`（`imageGeneration`，带 `Idempotency-Key`） | 403 `MODAGPT_UPGRADE_REQUIRED`（套餐门，早于引擎门） |
| `POST /api/merchant/modagpt/images`（`tryOn` + 双图 + `privacyConsent`） | 403 `MODAGPT_UPGRADE_REQUIRED` |
| 额度流水 / 资产计数（前后对比） | 0 条 0 分 → 0 条 0 分；设计 0 → 0 |

证据：`docs/engineering/audit/modaui-workbench-2026-10-27/p0-real-api-evidence.json`。
引擎门与套餐门的分层、以及缺失能力的接入方案见 `docs/engineering/modules/modaui-engines.md`。

**必须记录的一次误打**：取证脚本第一版把目标地址取成 `.env` 的 `APP_URL`（`https://ruda.fashion`），因此那两次 POST 打到了生产域名。两次都被套餐门 403 拒绝，额度与资产数量前后一致，无写入；随后脚本改为硬编码 `http://127.0.0.1:3000` 重新取证。原始证据保留在 `p0-real-api-evidence-prod-host-acknowledged.json`，不删除以便追溯。

### 13.3 本轮仍未完成

1. **真实引擎出图**：本机既无 `LOCAL_IMAGE_GENERATION_URL`（7860 无监听）也无 fal key，`providers.image = "unavailable"`；真实出图验收被环境阻塞，不伪造。
2. **小程序接入**：需重写 `pages/assistant` 五项能力结构，并在审核开关打开后于微信开发者工具/真机验收。
3. **资产谱系持久化**：`MerchantModaGptDesign` 仍无父子/版本字段，谱系只在会话内。
4. **`MerchantAiHome` 去留**：已无渲染入口，待产品决策后删除或吸收其对话能力。

---

## 14. 五个非服装行业统一聊天体验（规格先行）

### 14.1 目标与边界

为贸易批发、百货批发、箱包批发、百货连锁、综合零售提供同一套 ModaUI 对话工作区，界面参考用户提供的极简手机聊天示例；行业差异由服务端行业角色说明、已授权的快捷任务与真实业务结果体现。**ModaUI 就是商家后台现有的 AI 版块，不是独立于 AI 版块之外的新模块，也不新增导航入口。**桌面 Web、手机 Web 和商家小程序沿用各自现有 AI 入口与后台外壳，不新增第二套聊天系统。

本范围不修改服装生产批发、服装批发的入口、业务工具或 UI；不重做商家后台顶栏、导航、工作区宽度、公共颜色/字体/按钮；不新增 API、数据库模型、可执行行业工具或图片生成调用。行业角色说明只约束回答范围，不增加权限或业务动作。非服装行业不得显示服装设计、虚拟试衣、换色、商业模特、时装视频等入口。用户可见文案继续使用简体中文。

### 14.2 复用与行业来源

| 运行面/能力 | 复用现状 | 权威边界 |
|---|---|---|
| 商家 Web 与手机 Web 聊天、附件、会话历史 | 新增薄路由组件 `ModaUIEntry`：服装模板继续渲染 `ModaUIWorkbench`，五个非服装模板渲染既有 `MerchantAiHome`；复用现有 ModaUI 会话 API，不复制聊天组件 | 当前登录商家的服务端行业模板；客户端只用于呈现 |
| 业务任务预览、提交、轮询 | 复用 `POST /api/merchant/modagpt/task/preview`、`POST /api/merchant/modagpt/task`、`GET /api/merchant/modagpt/task/:id` 和现有 Supervisor/任务存储 | JWT 商家租户、Agent/员工工具权限由服务端逐次校验 |
| 小程序聊天及任务 | 复用 `merchant-miniprogram/pages/assistant`、商家会话认证和同一商家任务 API；不使用 `/api/modagpt/public/chat` 执行业务工具 | 商家身份来自已认证会话，忽略客户端自报 `merchantId` |
| 行业提示与普通聊天角色 | UI 只展示已有行业 Pack/工具能处理的请求；普通聊天角色由服务端商家模板选择，不承诺未接通能力 | 服务端仍是行业工具和业务权限的最终守卫 |

行业呈现映射：`TRADING_COMPANY`（贸易批发）、`DEPARTMENT_WHOLESALE`（百货批发）、`BAGS_WHOLESALE`（箱包批发）、`DEPARTMENT_CHAIN_RETAIL`（百货连锁）、`GENERAL_RETAIL`（综合零售）。模板 ID 优先于粗粒度行业 ID；百货批发与百货连锁不得因共享 `DEPARTMENT_STORE` 而串用提示或工具。

入口路由：`ModaUIEntry` 只负责呈现选择。精确的非服装 `industryTemplate` 进入聊天；精确服装模板和既有服装行业继续走 `ModaUIWorkbench`。缺少精确模板但已确认是非服装的旧商家只显示通用聊天，不显示行业提示或服装工具。客户端模板字段不改变任何服务端授权。

### 14.2.1 服务端行业角色上下文

- `/api/merchant/assistant/query` 必须从数据库读取当前认证商家的 `industryTemplate`，按已支持的精确模板选择固定的服务端助手角色说明；Restaurant 在专属 Studio 上线前不授予通用 ModaUI persona；不得接受请求体或页面上下文指定行业。
- 行业角色说明只约束回答领域、事实边界和已接通能力，不授予工具权限、不新增业务动作，也不能替代 `/api/merchant/modagpt/task*` 的 Agent、员工权限和租户校验。
- 角色说明必须把真实能力与限制一并写清：例如贸易汇率是参考汇率、百货连锁只给调拨候选、箱包图像识别及尚未接通的行业工作流不得声称可用。
- 缺失/未识别的旧行业模板回退到现有通用助手说明；百货批发与百货连锁依据精确模板使用不同角色，不以共享的 `DEPARTMENT_STORE` 粗粒度行业 ID 选择。
- 这属于现有商家聊天的服务端上下文修正，不改变聊天 API 契约、页面、存储、模型路由、计费或任何行业工具。

### 14.3 交互与状态

1. 已认证商家进入 ModaUI 后看到统一聊天欢迎区、行业名称和少量真实能力提示；提示点击后只填入输入框，不越过预览/确认流程。
2. 普通问题走现有商家聊天 API；业务任务走现有预览 → 用户确认 → 提交 → 终态结果链路。
3. 贸易批发采购草稿必须保留供应商、商品、SKU、数量、成本的确认输入及金额预览；草稿不能直接变为正式采购单。
4. 任务状态、权限拒绝、超时/网络错误、空数据和服务端失败均显式展示；失败不得伪装成成功，也不得静默回退到公共聊天。
5. 已存在的对话历史、附件、键盘/触控可达性和端侧导航继续工作；不得通过隐藏或替换后台外壳来模拟参考图。

| 行业模板 | 仅作为输入框快捷提示的既有能力 |
|---|---|
| 贸易批发 | 分析供应商供货表现；准备采购草稿（进入原任务预览和采购字段确认） |
| 百货批发 | 检查商品包装规格、计量单位和资料缺项 |
| 箱包批发 | 整理箱包材质、尺寸与 SKU 资料 |
| 百货连锁 | 分析门店销售与库存，给出只读调拨候选 |
| 综合零售 | 分析 POS 销售、条码和补货候选 |

### 14.4 数据、API、权限和错误

- 不新增数据所有者或 API；对话、任务、业务数据仍由现有 `MerchantAiHome`/小程序助手、商家 API、Supervisor、行业工具 Handler 和 Prisma 模型提供。
- Web 与手机 Web 可使用认证上下文展示行业；小程序从服务端签发/返回的商家会话资料读取模板。任何客户端行业字段都不能作为授权或租户选择依据。
- `/api/merchant/assistant/query` 只承担既有商家对话行为；预览、执行与轮询始终使用受保护的 `/api/merchant/modagpt/task*`。工具调用须再由服务端 Agent/员工权限、行业 Pack 和 tenant 条件查询检查。
- 加载中禁用重复提交；任务创建使用现有幂等键策略；权限拒绝保留可读错误，租户外资源不可见，网络失败提供同一任务状态重查，不重复创建采购。

### 14.5 验收、影响与恢复

- 自动化：覆盖五个模板的提示映射、服装专属入口隐藏、公共聊天与商家任务 API 不混用、采购草稿必填确认和三端调用契约；不得以静态页面测试代替 API 权限测试。
- 端侧：桌面 Web、手机 Web、微信开发者工具/真机分别验证欢迎区、历史、输入、提示填充、任务预览/结果/错误及窄屏布局；保存实际截图。无运行环境时标记待验证。
- 回归：确认服装两行业的组件选择、提示、布局、工具权限及既有截图基准不变；检查后台外壳导航无变化。
- 数据/API：无 migration、无新 endpoint、无 schema/计费变化。回滚只需恢复商家端 ModaUI 组件选择与小程序行业欢迎区条件，不需数据回滚。当前禁止通过该 UI 变更触发生产发布。
- 已补缺口：普通商家聊天此前使用同一份服装 B2B 助手指令；现由 `/api/merchant/assistant/query` 从数据库读取当前商家的精确 `industryTemplate`，加载七种独立角色说明。该说明只约束回答领域和能力边界，不授予权限、不增加工具或执行写操作；缺少模板时回退通用助手。百货批发与百货连锁使用不同角色。
- 状态：**五行业三端代码接线及定向自动化验证完成；真实商家登录态、桌面/手机浏览器截图与微信开发者工具/真机视觉验收待完成**。本轮 `npx tsc --noEmit` 通过；定向测试 29/29 通过；商家 Web 构建 `20261030031044780-4d386936`、手机 Web 构建 `20261030031044887-6fb64b5a` 成功。没有认证运行环境/微信开发者工具截图；未部署。
- 2026-10-30 行业角色补全回归：`npm run test:unit` 1251/1251；`npx tsc --noEmit` 通过；`npm run build` 通过（商家 Web `20261030032749424-9ab2bcfc`、手机 Web `20261030032759563-e5ec74eb`）；隔离 PostgreSQL 行业任务与贸易采购 HTTP 集成测试各 1/1 通过。上述代码/数据库测试不等于三端真实登录态或视觉验收；未部署。
- 2026-11-14 对照 Apparel 六项验收清单：工作台目录由五项纠正为六项，补录“AI 专业智能打版”。能力注册仅用于让缺口可见；当前没有 Apparel CAD/纸样/放码/生产导出服务，因此入口保持未接入并阻止提交，不得算作打版功能完成。视频和打版明确未接入；其他图像生成能力仍受实际 Provider/套餐限制。

---

## 变更记录

| 日期 | 变更 | 影响 | 验证 |
|---|---|---|---|
| 2026-10-27 | 建立 ModaUI 单页工作台规格；完成审计与能力矩阵；实现单页骨架 + 推理规划 + 真实闭环 | 商家 Web 创作空间入口、新增 `modaui/modaWorkbenchCapabilities.ts`、`modaui/modaWorkbenchPlan.ts`、`modaui/ModaUIWorkbench.tsx` | `tsc` 0；单向 16/16；构建 `20261027225450945-0ee0cef9`；Playwright 1440/1024/390/320 |
| 2026-10-27 | 第二轮：手机 App `ai_home` 切换到同一工作台；修复 `portal-domains` 自跳转与 `video.ruda.fashion` 规范来源；新增引擎事实清单 `modaui-engines.md`；完成真实接口取证 | `MerchantMobileApp.tsx`（删 `toggleAiNavigation`/`aiNavigationOpen`）、`src/shared/portalDomains.ts`、`tests/portal-domains.test.ts`、`tests/merchant-modagpt-layout.test.ts`、`tests/merchant-mobile-message-center.test.ts`、新增 `docs/engineering/modules/modaui-engines.md`、审计证据 | `tsc` 0；全量 988/988；商家手机构建 `20261027231831819-98c881d6`；真实会话接口证据（403 套餐门 + 额度不变） |
