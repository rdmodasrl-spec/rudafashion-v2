# 小程序 WXML 条件指令规则

适用：`miniprogram/`（用户端小程序）与 `merchant-miniprogram/`（商家端小程序）所有 `.wxml`。

## 1. 背景（2026-10-28 编译失败）

微信开发者工具（Windows，lib 3.17.5）编译商家小程序时报：

```
[ WXML 文件编译错误 ] ./pages/orders/index.wxml:
Bad attr `wx:else` with message: `wx:if not found, then something must be wrong`
```

排查结论：

- 新版 WXML 编译器要求 `wx:else` / `wx:elif` 的前一个**兄弟节点**必须带 `wx:if` / `wx:elif`，条件链中间不能夹注释或文本节点。
- `merchant-miniprogram/pages/products/index.wxml` 的空状态块前有一行 `<!-- 空状态 -->`，正好夹在 `wx:if` 与 `wx:elif` 之间；这是真实的链条断裂。
- `merchant-miniprogram/pages/orders/index.wxml` 的发货弹层用 `<block wx:else>` + `<text wx:else>` 承接两个 `wx:if`，属于同一类隐式依赖；改动时最容易再次踩坑。
- 该错误只在开发者工具编译期出现，Node 测试、浏览器预览都不复现，因此补了机械检查。

## 2. 强制规则

1. `wx:if` / `wx:elif` / `wx:else` 必须在**同一父节点**下紧邻书写，中间不允许出现注释、文本或其他元素。
2. 不要把 `wx:if` 与 `wx:for` 写在同一个元素上；外层用 `<block wx:if>`，内层再 `wx:for`（或反之）。
3. 条件互斥但语义独立时，优先写显式条件（`wx:if="{{!x}}"`），少用隐式 `wx:else`，便于机械检查与后续维护。
4. 注释可以写在条件链之前，或写在条件元素**内部**作为首个节点，不能插在链条中间。

## 3. 机械检查

```bash
node scripts/check-wxml-directives.mjs                       # 默认检查 miniprogram + merchant-miniprogram
node scripts/check-wxml-directives.mjs merchant-miniprogram  # 只检查商家小程序
node --import tsx --test tests/miniprogram-wxml-directives.test.ts
```

`scripts/check-wxml-directives.mjs` 检查项：

| 检查 | 说明 |
| --- | --- |
| 孤立 `wx:else` / `wx:elif` | 上一兄弟元素缺 `wx:if` / `wx:elif` |
| 条件链被切断 | 链中夹注释或非空文本节点 |
| `wx:if` + `wx:for` 同元素 | 容易产生每个 item 一个条件链的歧义 |
| 标签不平衡 | 多余关闭标签、未闭合标签、配对错误 |

退出码：`0` 无问题，`1` 有问题（可直接接 CI）。`tests/miniprogram-wxml-directives.test.ts` 对两个小程序全量执行，并含三条反例用例，确保检查器本身有效。

## 4. 本次修复

| 文件 | 变更 |
| --- | --- |
| `merchant-miniprogram/pages/orders/index.wxml` | 概要骨架 `wx:elif` → `wx:if="{{!orderSummary && loading}}"`；发货弹层 `<block wx:else>` → `<block wx:if="{{!shipmentLoading}}">`；`<text wx:else>` → `<text wx:if="{{!(item.remaining > 0)}}">`。渲染结果不变，页面不再依赖任何 `wx:else`。 |
| `merchant-miniprogram/pages/products/index.wxml` | `<!-- 空状态 -->` 从 `wx:if` / `wx:elif` 之间移入 `wx:elif` 元素内部。 |

## 5. 限制与复测

- 本仓库运行环境（Linux）没有微信开发者工具，无法在此完成 WXML 编译；上述结论来自静态规则与结构分析，**编译通过需在开发者工具复测**。
- 复测步骤：开发者工具重新打开 `merchant-miniprogram` 或用户端 `miniprogram` → 详情 → 本地设置 → 清缓存（全部）→ 重新编译。
- 若仍报同一错误：确认开发者工具打开的是仓库当前工作副本（非旧拷贝），并检查报错文件当前行号对应的条件链是否被注释或文本切断，可直接运行上面的检查脚本定位。
