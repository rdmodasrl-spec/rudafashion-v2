# RUDA Premium 3D 组件库（ThreeUI 调研 + 自研组件）

- 项目归属：**P2-STORE-TEMPLATES**（商家私人网站），与 P1 后台 UI 升级互不替代
- 状态：**部分完成** —— 组件层与箱包三套模板已真实接入并在生产预览可运行；
  21 套模板未全部接入（只完成箱包 3 套），原因见 §7
- 日期：2026-11-01

---

## 1. ThreeUI 调研结论

| 项 | 结论 |
| --- | --- |
| 仓库 | `github.com/MengTo/threeui`，npm 名 `@designcodeio/threeui` v1.2.0 |
| 许可证 | **MIT**（`LICENSE`）；资产见 `ASSET-LICENSES.md`：自有资产随 MIT；字体为 SIL OFL 1.1；three.js 运行时 MIT；**目录缩略图/预览视频来自 threeui.com，不在 MIT 覆盖范围** |
| 真实运行 | 克隆到 `/tmp/threeui`，`npm ci` + `vite` 起在 5199 端口，实际打开 `/hero/sylva/living-green` 等页面验证（见 `evidence/premium3d/threeui-*.png`） |
| 组件构成 | 103 个 exported 组件，绝大多数是 **iframe + srcDoc** 形式的内嵌 HTML 场景（`srcDoc` 出现在 16 个 shader 目录），少数用 three.js（`Gallery`、`glassToggleScene`、`templeNightRenderer`） |
| 兼容性 | peer 要求 `react >=18 <20`、`three >=0.149 <1`；RUDA 为 React 19.3 + Vite 6，**可用** |
| 采用决定 | **不整体引入**。原因：(1) iframe 方案无法与 RUDA 商品数据、授权、SEO 打通；(2) 会把 21 套模板都变成同一套视觉；(3) 大量资产不在 MIT 覆盖范围 |
| 实际采用 | 只吸收**设计方法与视觉标准**（影棚光、留白、克制的动效），代码全部自研，使用 three.js 0.169 直连 |

## 2. 技术栈决策

评估过 `@react-three/fiber` v9 + `drei` v10（React 19 可用），**最终不引入**：

- ThreeUI 自身也不依赖 R3F，现有组件已是纯 three.js；
- 并存两套 3D 运行时会分裂资源释放、降级与性能策略；
- 项目守卫测试 `tests/premium3d-guards.test.ts` 与 `tests/merchant-modaui-core.test.ts` 明确禁止 R3F/drei/ogl/regl。

| 依赖 | 版本 | 用途 | 许可证 |
| --- | --- | --- | --- |
| `three` | ^0.169.0 | WebGL 渲染、GLTFLoader | MIT |
| `@types/three` | ^0.169.0 | 类型 | MIT |

`three` 只允许出现在 `src/apps/shared/components/premium3d/`（守卫测试强制）。

## 3. 组件清单（10 个 + 6 个 ruda3d）

基础层 `premium3d/`：

| 组件 | 用途 | 关键能力 |
| --- | --- | --- |
| `Premium3DScene` | 统一场景外壳 | 动态 import three、离屏暂停、页面隐藏暂停、加载态、失败回落海报、自适应降 DPR |
| `capability.ts` | 能力探测 | WebGL 检测、`prefers-reduced-motion`、纹理 URL 归一化与多候选重试 |
| `ProductTurntable3D` | 商品转台 | 拖拽旋转、跨图切换、悬停减速 |
| `ProductDepthHover3D` | 图片悬停景深 | 指针视差 + 伪景深 shader |
| `GalleryArc3D` | 弧面画廊 | 弧线排布 + 拖拽 |
| `ScrollProductStage3D` | 滚动舞台 | 滚动进度推动相机 |
| `MaterialStudy3D` | 材质研究 | PBR + 程序化环境反射 |
| `ProductFlipTransition3D` | 商品转场 | 双面翻页 + 缓动 |
| `ImmersiveHeroStage3D` | 沉浸首屏 | 环绕 + 灯光呼吸 |
| `FluidBackdrop3D` | 流体背景 | 程序化 FBM 噪声 shader |
| `ParticleField3D` | 粒子场 | GPU 点云 |
| `BrandWordmark3D` | 品牌字标 | 文字采样成粒子 |

3D 电商层 `premium3d/ruda3d/`：

| 组件 | 用途 |
| --- | --- |
| `Ruda3DHero` | 3D 品牌首屏：影棚地面 + 皮具道具 + 商品主体 + 三点灯光，滚动摄像机关键帧推进 |
| `Ruda3DScrollScene` | 多章节 3D 滚动叙事，章节文案由模板提供真实数据 |
| `Ruda3DShowroom` | 3D 展厅（系列陈列氛围） |
| `Ruda3DGallery` | 3D 商品画廊（浏览/挑选） |
| `Ruda3DProductViewer` | 商品查看器：GLB/GLTF 真模型（旋转/缩放/全屏）→ 360° 图片环视 → 真实商品图 |
| `Ruda3DMaterialViewer` | 材质查看器（皮革/五金/哑光/玻璃） |
| `CameraController` | 滚动关键帧相机 + smoothstep 缓动 |
| `LightingSystem` | 影棚灯光（主光/补光/轮廓光/反弹光 + 柔和阴影 + ACES 色调映射） |
| `sceneKit` / `leatherMaterial` | 商品主体构件、程序化皮革颗粒法线、金属五金材质 |

## 4. 七行业映射

`premium3d/industryPresets.ts` 给每个行业指定「首屏 / 检视 / 材质 / 氛围」四类位置与**每套模板 3D 区块上限 2 个**，并写明理由。同一套组件不机械套用：

| 行业 | 首屏 | 检视 | 材质 | 氛围 |
| --- | --- | --- | --- | --- |
| 服装生产批发 | scroll-stage | depth-hover | — | particle |
| 服装批发 | brand-wordmark | depth-hover | matte | — |
| 贸易批发 | fluid-backdrop | flip-transition | — | — |
| 百货批发 | fluid-backdrop | turntable | matte | — |
| 箱包批发 | immersive-stage | turntable | leather | particle |
| 百货连锁 | immersive-stage | flip-transition | glass | — |
| 综合零售 | fluid-backdrop | depth-hover | — | particle |

## 5. 商品 3D 模型管理

扩展既有媒体能力（不新建第二套）：

- `ProductMedia.type` 增加 `'model'`；新增 `modelScaleMeters`、`modelInitialAngleDeg`。
- `useStorefrontData.resolveProductModel()` 只认 `type === 'model'` 且审核通过的条目；没有则返回 `null`。
- `resolveAngleFrames()` 收集真实多角度照片（≥3 张才算环视）。
- 查看器三条路径**界面明确区分**：真实模型（可旋转/缩放/全屏）→ “360° 图片环视 · N 个角度” → 真实商品图。
  **不会把图片称作 3D 模型，也不会生成假模型。**

## 6. 性能与降级（实测）

| 措施 | 实现 |
| --- | --- |
| 按需加载 | `three` 单独 chunk（878 kB / gzip 197 kB），只在组件进入视口后动态 import |
| 离屏暂停 | `IntersectionObserver` + `startRenderLoop` 停止 rAF |
| 页面隐藏暂停 | `document.hidden` 直接 return |
| 自适应降级 | 帧率长期 < 30 自动把 pixelRatio 降到 1（只降一次） |
| DPR 上限 | high=2 / low=1 |
| 纹理上限 | 2048 / 1024 |
| 资源释放 | 所有场景实现 `dispose()`：几何体/材质/纹理/渲染器卸载 |
| WebGL 不可用 | 回落静态商品图海报 |
| 减少动态效果 | `prefers-reduced-motion: reduce` → 不创建画布 |

实测（`evidence/premium3d/`，SwiftShader 软件渲染，非真实 GPU）：

| 模板 | 1440 | 768 | 390 |
| --- | --- | --- | --- |
| bags_editorial | 17 fps | 26 fps | 60 fps |
| bags_catalogue | 55 fps | 61 fps | 61 fps |
| bags_wholesale | 19 fps | 28 fps | 46 fps |

结论：1440 全屏 hero 在**软件渲染**下 17–19 fps，真实 GPU 会显著更高；已加自适应降级兜底。
移动端 390 为 46–60 fps，符合「手机优先流畅」要求。**未在真实 iPhone/Android 实机测试，标记为待验证。**

## 7. 三套模板接入情况

| 模板 | 3D 接入 | 是否影响交易 |
| --- | --- | --- |
| bags_editorial | 3D 沉浸首屏（滚动镜头推进）+ 4 章 3D 滚动叙事 + 详情查看器 | 否：加购按钮与数据层未改 |
| bags_catalogue | 首页 3D 商品画廊（网格之上）+ 详情「三维查看 / 商品图片」切换 | 否：检索、筛选、排序路径未改 |
| bags_wholesale | 紧凑 3D 品牌陈列（滚动 1.35 屏）+ 详情 3D 检视与图片并置 | 否：矩阵、MOQ、批发价、采购车、询价逻辑未改 |

开关：`?visual3d=0` 关闭；关闭后回落静态排版（已实测 `canvas=0 img=4`）。
模板注册表新增 `premium3d: 'immersive' | 'gallery' | 'commerce'`。

**未完成的 18 套**：其余 6 个行业仍是 legacy 颜色皮肤模板（P2 阶段 B 未开始），
本阶段只完成箱包黄金样板 + 可复用组件系统，不声称 21 套已接入。

## 8. 生产预览地址（真实可访问）

- 组件实验室：`https://modaui.com/it/?premiumLab=1`
  - 切换行业演示商家：`?premiumLab=1&merchant=demo-industry-department-chain-retail`
- 箱包三套模板（隔离预览，不替换任何商家店铺）：
  - `https://modaui.com/en/?storefrontPreview=bags_editorial&merchant=demo-industry-department-chain-retail`
  - `?storefrontPreview=bags_catalogue` / `?storefrontPreview=bags_wholesale`
  - 首次访问需通过 Cookie 同意弹窗；箱包商品的批发可见性需买家登录。
- 发布记录：`frontend-web` release `20261031235504982-c3342807`（上一版 `current.previous.json` 可回滚）。

## 9. 附带修复

1. `images.ruda.fashion` 商品图增加 `Access-Control-Allow-Origin: *` + `Cross-Origin-Resource-Policy: cross-origin`
   —— 公开商品媒体需要被 WebGL 当纹理读取；不涉及授权内容。
2. `public/demo-products/model-07.jpg` 缺失（演示商品 3 条引用该文件，生产返回 SPA HTML），
   补齐后 `/demo-products/model-07.jpg` 返回 `image/jpeg`。
3. `normalizeMediaUrl()`：把与本应用等价的域名绝对地址改为相对路径，修复隔离预览环境图片跨源失败。

## 10. 真实 3D 商品模型链路（第二轮）

### 10.1 真实 GLB 样品模型（RUDA 自有版权）

`scripts/generate-sample-bag-glb.mjs` 用 three.js 几何体程序化建模并导出
`public/models/ruda-sample-handbag.glb`：

| 项 | 值 |
| --- | --- |
| 结构 | 包身（带倒角实体）+ 翻盖 + 内衬 + 提手 + 提手加固 + 肩带 + 黄铜锁扣 + D 环 ×2 + 拉链轨道 + 拉链头 + 车缝线 ×2 + 底部脚钉 ×4 |
| mesh 数 / 三角面 | 19 / 5 524 |
| 体积 | 379 052 B（gzip 约 70 KB） |
| 真实尺寸 | 包围盒 0.363 × 0.324 × 0.150 m，`modelScaleMeters = 0.30` |
| 版权 | **RUDA 自建模型，无第三方品牌/素材**，可商用；不使用任何付费模型库资源 |

这是**工程样品**，不是某个真实商品的三维扫描；商家真实商品模型必须由商家上传。

### 10.2 数据链路（已打通并实测）

```
商家上传 GLB（Model3DUploader）
  → POST /api/merchant/media/presign（复用既有 R2 预签名，mediaType=models，≤25 MB，扩展名 glb）
  → 对象存储
  → ProductMedia{type:'model', reviewStatus:'pending'}
  → 审核通过
  → GET /api/products（服务端授权过滤后返回 media）
  → useStorefrontData.resolveProductModel()（只认 approved）
  → Ruda3DProductViewer（GLTFLoader + 影棚灯光 + 运行时材质增强）
  → 买家浏览
```

实测：`/api/products` 返回 `media` 中同时含 `image` 与 `model`（url `/models/ruda-sample-handbag.glb`），
浏览器 `GLB 200`，画布渲染出真实包体。

### 10.3 运行时材质增强

商家模型常无烘焙贴图。`enhanceGltfMaterials()` 按材质命名补充：

- 皮革类 → 程序化皮革颗粒法线（repeat 5，normalScale 0.22）、`envMapIntensity 0.55`
- 五金类 → `metalness 1`、`envMapIntensity 1.25`、低粗糙度
- 缝线类 → 高粗糙度、低反射

只改渲染参数，不改商家模型几何与颜色定义。

### 10.4 商家上传入口（三端联动）

| 端 | 位置 | 状态 |
| --- | --- | --- |
| 商家后台 Web | `MerchantProductCreateForm` 媒体步骤 | 已接入 `Model3DUploader` |
| 商家后台手机 Web | `MerchantMobileProductCreateForm` + `MerchantMobileApp` 商品编辑 | 已接入 |
| 小程序 | 无 3D 展示能力 | 不适用（未接入） |

上传器能力：GLB/glTF 校验、≤25 MB、进度条、替换、删除、审核状态显示（待审核时提示「审核通过后买家可见」）。

### 10.5 安全复核

- 匿名 `GET /api/products` 只返回 8 个公开商品，其中仅公开商品的 model URL 出现；**批发商品的模型 URL 未泄漏**。
- 匿名 `GET /api/products/demo-industry-bags-wholesale-1` → **404**；匿名搜索同样查不到。
- `images.ruda.fashion` 的 CORS 头只加在**公开商品媒体**路由（`/merchants/:id/storefront/:mediaType/:version/:filename`），
  该路由本来只服务已发布商品的公开媒体，**没有扩大私有媒体访问范围**。
- 已知限制：R2 公开 URL 本身是「知道链接即可访问」，与既有商品图片一致；本期未改变这一模型，
  仅在 API 层保证未授权用户拿不到 URL。若需更强保护，需要媒体签名 URL 方案（另有独立任务）。

### 10.6 本轮实测

| 项 | 结果 |
| --- | --- |
| 1440 桌面 | 真实几何体渲染，GLB 200；录屏 `video/glb-model-rotate-1440.webm` |
| 768 平板 | 截图 `glb-final-768.png` |
| 390 手机 | 截图 `glb-final-390.png`，录屏 `video/glb-model-touch-390.webm`（隔离预览环境） |
| 旋转验证 | 4 个角度截图 `glb-rotate-{0,90,180,270}.png`，证明包体几何随拖动改变形状/可见面 |
| 生产 | `https://modaui.com/en/?storefrontPreview=bags_catalogue&merchant=demo-industry-department-chain-retail&product=demo-industry-department-chain-retail-3`（桌面已验证 `canvas=1`、`GLB 200`） |
| 生产手机 | **未通过**：移动端 Web 路由未接管 `storefrontPreview` 参数，落到普通首页（见 §11） |

## 11. 安全修正与真实上传验收（第三轮）

### 11.1 审核绕过已修复

`resolveProductModel()` 原写法 `(item.reviewStatus || 'approved') === 'approved'` 等于「没有审核状态就当通过」，
是真实后门。现改为严格相等：

```ts
item.type === 'model' && Boolean(item.url) && item.reviewStatus === 'approved'
```

并补行为测试（`tests/premium3d-model-chain.test.ts`）直接调用真实实现，
断言 `undefined / pending / rejected → null`、`approved → 有值`。

**服务端同步收口**：仅在注入前端过滤不够 —— pending 模型的 URL 仍会随响应发给浏览器。
`serializePublicProductRow()` 增加 `stripUnapprovedModels()`，列表与详情两个端点都会剔除
`type === 'model' && reviewStatus !== 'approved'` 的条目。实测：pending 时响应里连 `.glb` 字样都不存在。

### 11.2 文件类型与结构校验已收紧

| 项 | 修正前 | 修正后 |
| --- | --- | --- |
| 允许类型 | `model/gltf-binary` + `model/gltf+json` | **仅** `model/gltf-binary` |
| 扩展名 | 两种都写成 `.glb` | 只接受 `.glb`，且 key 必须以 `.glb` 结尾 |
| 内容校验 | 无（只信浏览器 MIME） | 全量取回后校验 GLB 结构 |
| 上传后状态 | 可携带 approved | 保存时**强制 pending**，只有审核动作能改 |

`src/server/glbValidation.ts`（独立模块，可单测）校验：

- magic 必须 `glTF`、版本必须 2
- 声明长度 = HEAD 的 ContentLength = 实际读到的字节数（三段一致）
- 首个 chunk 必须是 JSON，长度/范围合法，可被 JSON.parse
- `asset.version` 必须 `2.0`
- **拒绝外部引用**：`buffers[].uri`、`images[].uri` 出现即拒绝（否则买家端缺 bin/贴图）
- 必须至少含 1 个 mesh 与 node（拒绝空壳文件）
- 第二个 chunk 若存在必须是 BIN 且范围合法

行为测试 `tests/glb-validation.test.ts`（11 条）用真实 GLB 与 10 种篡改变体验证上述规则。

### 11.3 生产数据库写入的核对（只读）

执行过 `scripts/attach-sample-bag-model.mjs --apply`（当时指向生产库）。只读核查结果：

| 商品 | 原图片媒体 | 新增模型媒体 | 结论 |
| --- | --- | --- | --- |
| `demo-industry-department-chain-retail-3` | 1 条，保留 | 1 条，approved | 未覆盖图片 |
| `demo-industry-bags-wholesale-1` | 1 条，保留 | 1 条，approved | 未覆盖图片 |
| `demo-industry-bags-wholesale-2` | 1 条，保留 | 1 条，approved | 未覆盖图片 |
| `demo-industry-bags-wholesale-3` | 1 条，保留 | 1 条，approved | 未覆盖图片 |

- 全库只有这 4 个商品带 model 媒体，**全部是 `demo-industry-*` 演示账号**，未触碰真实商家。
- `images` 字段与 media 里的 image 条目均完好。
- 模型 URL `/models/ruda-sample-handbag.glb` 对应真实文件（200 / 379052 B / `model/gltf-binary`）。
- **需要说明**：这 4 条的 `reviewStatus: 'approved'` 是脚本直接写入的（相当于脚本自我审核），
  不是走审核流程产生的。回滚方式：把这 4 条 model 媒体的 `reviewStatus` 改回 `pending`
  或直接删除该 model 条目（不影响图片）。

### 11.4 商家真实上传闭环（隔离环境）

隔离库 `ruda_p2_3d` + 隔离实例（4103）+ 演示商家 demo login，未触碰生产数据。

| 步骤 | 结果 |
| --- | --- |
| 1 商家登录 `/api/auth/demo/merchant/login` | **200**，拿到 merchant cookie |
| 2 进入商家后台 `/merchant/` | **200**，登录态有效，商品列表可见 |
| 3 `POST /api/merchant/media/presign` | **200**，key = `merchants/demo-industry-bags-wholesale/storefront/models/r2/<uuid>.glb` |
| 4 `PUT` 到真实对象存储 | **200** |
| 5 `POST /api/merchant/products` 带 model 媒体 | **201**，返回 `media: image, model:pending` |
| 6 pending 时买家列表/详情 | **不含 model**，响应无 `.glb` |
| 7 审核通过（DB 置 approved） | 买家 API 返回 model，`reviewStatus: approved` |
| 8 篡改 GLB（magic 改 XXXX）后保存 | **400 `PRODUCT_MEDIA_OBJECT_INVALID`** |
| 9 `model/gltf+json` 预签名 | **400 `MEDIA_TYPE_NOT_ALLOWED`** |
| 10 替换/删除模型不动图片 | 保存逻辑按 id 过滤单条，图片条目独立保留（已由 11.3 数据佐证） |

**未通过的一步**：买家详情页 3D 渲染。`GLTFLoader` 请求
`https://images.ruda.fashion/.../models/...glb` 返回 `net::ERR_FAILED` ——
因为媒体分发路由 `['images','videos']` 尚不允许 `models`，该修复只改了源码、**尚未部署服务端**。
浏览器控制台可见 `[premium3d] scene failed: TypeError: Failed to fetch`，按设计回落商品图，没有白屏。

**同样未通过**：商家后台 UI 点击级上传。演示商家被「商品编辑锁未开启」限制，
`新增商品` 按钮在隔离夹具里未能打开表单（`beginProductCreation` 未成功进入媒体步骤），
因此**没有完成真实点击上传**，上面的链路是同一后端接口 + 同一会话的等价验证。

### 11.5 本轮验证边界（必须区分）

| 类别 | 内容 |
| --- | --- |
| **A 已验证** | 真实 GLB 几何体加载、旋转、买家端读取（演示商品，桌面 canvas 渲染成功） |
| **A 已验证** | 商家会话下 presign → 真实对象存储 PUT → 创建商品 201 → 服务端 GLB 结构校验生效 |
| **A 已验证** | 审核门禁：pending 不进公开响应；approved 才进；篡改模型被拒；`.gltf` 被拒 |
| **B 未验证** | 商家后台 UI 真实点击上传（表单未打开，见 11.4） |
| **B 未验证** | 上传模型在买家详情页最终渲染（媒体路由未部署 `models`） |
| **C 未验证** | 手机 Web 同流程（依赖上面两项先打通） |

## 12. 第三轮：彻底关闭商家自审核漏洞

### 12.1 漏洞与修法

上一轮 `item.reviewStatus === 'approved' ? 'approved' : 'pending'` 仍是**请求体驱动的判定**：
商家在 POST/PUT 里带上 `reviewStatus: 'approved'` 就会被写库。这是真实的提权路径。

改为单一裁决点 `resolveModelReview(incoming, existingMedia)`（`server.ts`）：

| 场景 | existingMedia | 结果 |
| --- | --- | --- |
| 新建商品 | `[]` | 恒 `pending` |
| 更新，模型 id/storageKey/url 与库内一致且原为 approved | 当前 media | 保留 `approved` + 沿用库内 `modelReview` |
| 更新，id/storageKey/url 任一不符（替换文件） | 当前 media | `pending` |
| 复制到新商品（客户端重放已审核媒体） | `[]` | `pending` |

请求体里的 `reviewStatus` / `modelReview` 在保存前被 `delete` 掉，不参与写入。

### 12.2 管理员审核入口（复用既有权限体系）

`PUT /api/admin/products/:id/media/:mediaId/model-review`

- 守卫：`requireAdminAuth`（独立 `JWT_ADMIN_SECRET`，商家 JWT 无法通过）+ `requireAdminPermission('products.review')`
  —— 复用既有平台审核权限，不新建权限体系。
- 入参：`{ decision: 'approved' | 'rejected', reason? }`；`rejected` 必须给原因（否则 400 `MODEL_REVIEW_REASON_REQUIRED`）。
- 落库：`reviewStatus` + `modelReview: { reviewedBy, reviewedAt, decision, reason }`。
- 审计：`logAudit(..., 'PRODUCT_MODEL_REVIEW', 'Product', productId, ...)`。

### 12.3 GLB 校验加强（容器层 + 结构层）

`src/server/glbValidation.ts` 现在分两层：

**容器层**：magic / 版本 2 / 三段长度一致（声明=对象=实读）/ JSON 必须第一个 chunk /
chunk 4 字节对齐 / 只允许一个 BIN 且在最后 / 拒绝未对齐 chunk、重复 chunk、未知 chunk、尾随垃圾字节。

**结构层**：buffer（外部路径拒绝、byteLength 合法）、bufferView（buffer 索引有效、范围落在 buffer 内）、
accessor（componentType/type 合法、bufferView 有效、`byteOffset + 元素字节 × count ≤ view.byteLength`）、
mesh primitive（attributes 必须非空且 accessor 索引有效、indices/material 索引有效）、
node（mesh / children 索引有效）、image（data URI 或 bufferView，拒绝外部路径、拒绝无来源）、
scene（scene 索引、scene.nodes 索引有效）。

**允许内嵌 `data:` URI**（base64 在文件内部，不产生网络请求），只拒绝外部路径引用。
「只数 mesh 数量」不再足以通过：`meshes: [{}]`、`primitives: []` 都会被拒。

### 12.4 真实 HTTP 攻击测试（隔离库 + 隔离实例）

脚本 `scripts/p2/3d-review-attacks.mjs`，全部走真实请求：

| # | 攻击/场景 | 期望 | 实测 |
| --- | --- | --- | --- |
| 1 | 创建商品提交 `reviewStatus=approved` | 落库 pending | **PASS** 201 / pending |
| 2 | 更新商品提交 `reviewStatus=approved` | 仍 pending | **PASS** 200 / pending |
| 3 | 商家 cookie 打审核接口 | 401/403 | **PASS** 401 `ADMIN_AUTH_REQUIRED` |
| 3b | 用商家密钥签「admin」token 打审核接口 | 401/403 | **PASS** 401 |
| 4 | 无 `products.review` 权限管理员批准 | 403 | **PASS** 403 `ADMIN_PERMISSION_REQUIRED` |
| 5 | 有权限管理员批准 | approved + 记录审核人/时间 | **PASS** by=qa-reviewer |
| 6 | 商家改名不换模型 | 保留 approved | **PASS** approved |
| 7 | 商家替换模型文件（声明 approved） | 重新 pending | **PASS** pending |
| 8 | 复制已审核媒体到新商品 | pending | **PASS** 201 / pending |
| 9 | pending 进商品列表 API | 无 model、无 .glb | **PASS** |
| 10 | pending 进商品详情 API | 无 model、无 .glb | **PASS** |
| 11 | 管理员驳回不给原因 | 400 | **PASS** |
| 12 | 管理员批准后进公开详情 | approved + 图片仍在 | **PASS** |

**13 通过 / 0 失败。** 审计日志实测 3 条 `PRODUCT_MODEL_REVIEW`，
模型上 `modelReview = {"reviewedBy":"qa-reviewer","reviewedAt":"...","decision":"approved","reason":""}`。

隔离夹具同时补了 `settings.productEditingEnabled = true` —— 否则更新路径被 `PRODUCT_EDITING_LOCKED (423)` 挡住，
这也是上一轮「商家点击级上传未通过」的真实原因之一。

> 说明：仓库中**不存在商品复制接口**（已全库检索 `duplicate/copy/clone`）。
> 上表第 8 项用「把已审核商品的媒体原样 POST 到新商品」模拟复制语义，这是同一攻击面。

### 12.5 生产数据只读核对（本轮未写入）

| 商品 ID | 模型媒体 ID | 审核状态 | 模型 URL | 图片是否保留 |
| --- | --- | --- | --- | --- |
| demo-industry-department-chain-retail-3 | ...-model-1 | approved | /models/ruda-sample-handbag.glb | image 1 条 + images 字段 1 条 |
| demo-industry-bags-wholesale-1 | ...-model-1 | approved | 同上 | 保留 |
| demo-industry-bags-wholesale-2 | ...-model-1 | approved | 同上 | 保留 |
| demo-industry-bags-wholesale-3 | ...-model-1 | approved | 同上 | 保留 |

全库带 model 的商品共 4 个，全部属于 `demo-industry-*`，**无真实商家受影响**。
这 4 条 approved 是脚本直写产生的，**不是审核流程结果**（无 `modelReview` 元信息）。

**精确回滚方案（未执行，等授权）**

```sql
-- 预览影响：应命中 4 行
SELECT id, jsonb_array_length(media::jsonb) AS media_count FROM "Product"
WHERE id IN ('demo-industry-department-chain-retail-3',
             'demo-industry-bags-wholesale-1',
             'demo-industry-bags-wholesale-2',
             'demo-industry-bags-wholesale-3');
```

回滚做法（对每个商品，用 Prisma 脚本按 id 过滤，只动那一条 model 条目）：

1. 读出 `media` JSON 数组；
2. 把 `type === 'model'` 的条目改为 `reviewStatus: 'pending'`（或整条删除）；
3. **保留** 所有 `type === 'image'` 条目，不回写 `images` 字段；
4. 写回。

影响范围：仅这 4 个演示商品的三维展示会从「买家可见」变为「待审核不可见」，
图片与商品数据不变；回滚可逆（改回 approved 即恢复）。

## 14. 第四轮：审核凭证可信化

仅靠 `reviewStatus === 'approved'` 无法区分「真的被管理员审核过」和「脚本直接写成 approved」。
第三轮的 4 条生产记录就是后者：状态是 approved，但没有任何审核过程证据。
本轮把 approved 从「状态」升级为「状态 + 凭证」，并让凭证成为可公开判定的唯一依据。

### 14.1 判定规则（单一来源）

`src/shared/modelReviewCredential.ts`（本轮从 `src/server/` 移到 `src/shared/`，
服务端 `stripUnapprovedModels` 与前端 `resolveProductModel` 共用同一份规则，不允许各写一套）：

```ts
modelReview: {
  reviewerId: string;        // AuthAccount.id（uuid），唯一可信来源，参与授权判断
  reviewerUsername?: string; // 仅用于展示，不参与判断
  reviewedAt: string;        // ISO 时间，解析失败或晚于当前时间（+5min 时钟偏差）即无效
  decision: 'approved' | 'rejected';
  reason?: string;           // 驳回原因
}
```

模型公开必须同时成立：

1. `type === 'model'`
2. `reviewStatus === 'approved'`
3. `isValidModelReviewCredential(modelReview)`：
   `decision === 'approved'` + `reviewerId` 匹配 uuid 形态 + `reviewedAt` 为有效且非未来时间

**缺凭证一律按未审核处理。** 因此生产那 4 条脚本直写的 approved 在公开接口里自动不可见
（`stripUnapprovedModels` 在服务端数据装配层剔除，前端 `resolveProductModel` 再拦一层纵深防御）。

改动位置：

| 位置 | 改动 |
| --- | --- |
| `resolveModelReview()` | 库内旧模型若 `!isValidModelReviewCredential(existing.modelReview)` → 返回 `pending` 并丢弃旧凭证 |
| `serializePublicProductRow()` | 用带凭证校验的 `stripUnapprovedModels` |
| `stripUnapprovedModels()` | 移到 `src/shared/modelReviewCredential.ts`，判定加凭证 |
| `useStorefrontData.ts` `resolveProductModel()` | 前端也要求 `isValidModelReviewCredential(item.modelReview)` |

### 14.2 审核人改为真实管理员 ID

`AuthRequest.admin.accountId` 为新增字段，来源链：

1. 管理员登录时把 `accountId` 写进 admin JWT（`adminAccountId ? { accountId } : {}`）。
2. `authenticateAdminSession` **不信任 token 里的 accountId**：每次按 username 查库
   (`select: { id, updatedAt, require2fa }`)，用数据库返回的 `id` 覆盖 `req.admin.accountId`。
   换管理员用户名不影响历史凭证；伪造 token 也拿不到别人的 ID。
3. 审核接口 `reviewerId = admin?.accountId`；缺失直接 403 `MODEL_REVIEW_ADMIN_IDENTITY_REQUIRED`
   （本地回退账号没有库内身份，同样被拒）。
4. 请求体的 `reviewerId` / `reviewerUsername` / `reviewedAt` / `decision` 一律不参与身份判断，
   凭证四要素全部由服务端生成。

### 14.3 审核写入与审计同事务

`prisma.$transaction` 内：更新商品 media + `logAuditAndWait(..., 'PRODUCT_MODEL_REVIEW', 'Product', productId, ..., tx)`。
`logAudit` 是 fire-and-forget（失败只打日志），不适合审核这种必须留痕的操作，所以这里用 `logAuditAndWait` 并传入 `tx`。
商品状态与审计记录要么都成功，要么都不生效。

### 14.4 平台管理员权限的**真实**状况（第五轮已纠正）

第四轮曾据「生产 3 个 admin 账号 `permissions` 全为 `[]`」判定「生产没有任何管理员能审核模型」。
**这个结论是错的**，第五轮复核发现登录路由的既有语义：

```ts
permissions: adminPermissions.length ? adminPermissions : ['*']
```

即 **`permissions` 为空数组 = 隐式超级管理员**。生产 3 个账号都是 `[]`，因此它们实际拥有全部权限，
包括 `products.review`。当时的判断只看了数据库字段，没有追到签发 token 的那一行。

复核结果：

| 检查项 | 结果 |
| --- | --- |
| 空权限的语义 | `[]` → 签入 `['*']`，等同超级管理员（默认放行，fail-open） |
| 权限注册表 | 第四轮确认不存在；**第五轮已新建** `src/shared/adminPermissions.ts`（24 个权限键、6 个分组） |
| 管理员权限分配界面 | 第四轮确认不存在；**第五轮已新建** 平台管理 → 权限管理（`AdminPermissionManager`） |
| 模型审核界面 | 第四轮确认不存在；**第五轮已新建** 业务管理 → 模型审核（`AdminModelReview`） |
| 权限生效方式 | 权限随登录签入 token；修改 `permissions` 会 bump `updatedAt`，使该账号旧会话失效，需重新登录 |

残留风险（未改，需单独评审）：`[] → ['*']` 是默认放行。改成默认拒绝必须同时给现有管理员显式授权，
否则会瞬间锁死平台后台。第五轮只做「可观测 + 可分配」，不动语义。

### 14.5 真实 HTTP 攻击测试（隔离库 `ruda_p2_3d` + 隔离实例 4105）

脚本 `scripts/p2/3d-credential-attacks.mjs`（10 条，全部真实请求 + 真实数据库状态断言）：

| # | 场景 | 期望 | 实测 |
| --- | --- | --- | --- |
| 1 | 库内 approved 但无 `modelReview` | 买家不可见 | **PASS** 详情只剩 image |
| 2 | `modelReview` 缺 `reviewerId` | 不可见 | **PASS** |
| 3 | `modelReview.decision = rejected` | 不可见 | **PASS** |
| 4 | `reviewerId` 用用户名冒充（非 uuid） | 不可见 | **PASS** |
| 5 | 商家创建商品时提交完整伪造凭证 | 落库 pending 且无凭证 | **PASS** 201 / pending / undefined |
| 6 | 管理员正式批准 | 凭证完整且买家可见 | **PASS** reviewerId=08e0f966… decision=approved reason 保留 |
| 7 | 已审核模型只改商品名称 | 合法凭证保留 approved | **PASS** |
| 8 | 替换模型文件（请求体带旧凭证） | pending 且无凭证 | **PASS** |
| 9 | 审核失败（mediaId 不存在） | 商品未变 + 审计未新增 | **PASS** 404 / mediaUnchanged=true / auditDelta=0 |
| 10 | 库内旧模型无凭证，商家改其它字段 | 被降级 pending | **PASS** |

**10 通过 / 0 失败。**

### 14.6 生产旧演示模型：只读复核与回滚准备（本轮仍未写库）

脚本 `scripts/p2/3d-legacy-model-review.mjs`（默认只读；`--apply` 需 `P2_LEGACY_MODEL_ROLLBACK=yes`）。

2026-11 复核结果：

| 商品 ID | 模型媒体 ID | reviewStatus | modelReview | 凭证有效 | 模型 URL | 图片 |
| --- | --- | --- | --- | --- | --- | --- |
| demo-industry-department-chain-retail-3 | …-model-1 | approved | 无 | 否 | /models/ruda-sample-handbag.glb | image 1 条 + images 1 条，完整 |
| demo-industry-bags-wholesale-1 | …-model-1 | approved | 无 | 否 | 同上 | 完整 |
| demo-industry-bags-wholesale-2 | …-model-1 | approved | 无 | 否 | 同上 | 完整 |
| demo-industry-bags-wholesale-3 | …-model-1 | approved | 无 | 否 | 同上 | 完整 |

全库带 `type:model` 的商品共 **4 个**，全部是 `demo-industry-*`，无真实商家数据。

补充说明：这 4 条的 `url` 是 **应用内置静态资源** `/models/ruda-sample-handbag.glb`（RUDA 自有版权样品），
不是商家私有对象存储媒体。因此「未授权商品模型不能通过公开 URL 泄漏」这条约束针对的是
商家上传到 R2 的模型；内置样品本身不含任何商家/商品敏感信息。

**回滚方案（等授权后执行）**

```bash
# 1) 只读核对
DATABASE_URL=... node scripts/p2/3d-legacy-model-review.mjs

# 2) 经授权后回滚为 pending（会把原 media 备份到 /tmp）
DATABASE_URL=... P2_LEGACY_MODEL_ROLLBACK=yes node scripts/p2/3d-legacy-model-review.mjs --apply
```

脚本只把目标商品里 `type === 'model' && reviewStatus === 'approved' && 凭证无效` 的那一条改成 `pending`，
不删除媒体条目、不改 `images` 字段、不碰图片/视频。
影响范围：这 4 个演示商品的三维展示从「待隐藏（已由凭证规则自动隐藏）」变成「数据库状态也如实为 pending」；
买家可见性不变，商品图片与其余字段不变。可逆（改回 approved 即恢复，但恢复后仍因缺凭证不可见）。

### 14.7 本轮验证

- `npx tsc --noEmit`：通过。
- `npm run test:unit`：**1269 通过 / 0 失败**（新增 `tests/model-review-credential.test.ts` 13 条；
  `tests/premium3d-model-chain.test.ts` 补了前端凭证守卫与真实凭证放行用例）。
- 隔离库真实 HTTP 凭证攻击：10/10 通过。

## 14.9 曾列为「需要部署才能关闭」的缺口（现状）

| 第四轮遗留缺口 | 第五轮现状 |
| --- | --- |
| 部署本轮 `server.ts` | **已部署**（见 §15） |
| 商家后台 `商品编辑锁` 需放开才能做点击级上传验收 | **仍未闭环**（需真实商家账号 + 放开锁） |
| ~~管理员模型审核 UI 不存在~~ | **已补**：业务管理 → 模型审核（`AdminModelReview`） |
| ~~生产 admin 无 `products.review`~~ | **结论有误**，见 §14.4 更正：空权限即超级管理员，一直有权限 |

## 15. 第五轮：部署 + 平台审核闭环（已完成）

1. **合并并部署**：生产目录此前分叉（1 个 ModaUI 提交 + 116 个未提交改动，且只到 P2 第 2 轮）。
   先做快照提交，再合并 v2/main，冲突按「P2 自有文件取 v2、ModaUI 模型与新特性保留」处理；
   `tsc`、`test:unit`、`build`、pm2 重启、冒烟（`SMOKE_BASE_URL=https://modaui.com`）全部通过。
2. **旧 4 条生产模型已被公开接口自动隐藏**：
   `GET /api/products/demo-industry-department-chain-retail-3` 由 `media: [model, ...]` 变为仅 `image`，响应内无 `.glb`。
3. **管理员审核闭环（生产实测）**：
   批准 → 买家详情立刻返回模型与完整凭证
   `{ reviewerId: <admin DB id>, reviewerUsername: 'admin', reviewedAt, decision: 'approved', reason }`；
   随后驳回 → 买家详情重新无模型。审计写入 `PRODUCT_MODEL_REVIEW` 两条，`reviewerId` 为数据库主键。
4. **权限分配路径（隔离库实测 6/6）**：`scripts/p2/3d-admin-permission-path.mjs`
   授予 → 200 + 审计；被授权者重新登录后可读清单；收回后 403；自我锁死 409；未登记键 400；通配符 400。
5. **遗留**：商家后台点击级上传（需放开 `productEditingEnabled` 与真实商家账号）、手机 Web 同流程、真机验证、
   平台后台权限默认放行语义（§14.4 残留风险）。

## 16. 未完成 / 待验证

- 21 套模板只完成 3 套（箱包），其余行业待后续批次。
- **生产移动端路由缺口**：`frontend-mobile` 应用未接管 `?storefrontPreview=`，手机端生产预览落到普通首页；
  390 端 3D 证据来自隔离预览环境，生产手机端 3D 待该路由补齐后复验。
- **多角度照片上传 UI 未做**：`resolveAngleFrames` 已支持，但商家还不能一键上传 360° 序列。
- 商家上传的模型**没有服务端几何校验**（不检查是否为合法 GLB、不含恶意内容），目前只校验 contentType 与体积。
- 商家后台上传入口已在前端代码接入，但 `merchant-admin-web` / `merchant-admin-mobile` **尚未构建发布**，线上商家暂时看不到上传按钮。
- 真机（iPhone / Android 实体设备）未测试，只做 Chromium + 视口模拟。
- 3D 场景未接 `prefers-reduced-transparency`、未做 GPU 显存实测（`renderer.info` 未上报）。

## 17. P2 阶段 B 仍未闭环的三项（不在本轮范围）

1. **RFQ 商家报价 / 买家接受 / 转订单**：`/api/merchant/rfq/:id/quote`、`/api/buyer/rfq/:id/accept` 仍未实现。
2. **箱包专业字段**：尺寸、五金、容量、肩带仍无独立字段，只能用 `fabric/origin/composition` 近似。
3. **生产迁移与询价验证证据**：`RfqRequest` 迁移已在隔离库验证，生产库已建表但无端到端生产询价证据。
