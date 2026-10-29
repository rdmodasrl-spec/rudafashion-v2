# ModaUI 数字生命核心（神经生命体）

状态：代码完成（V7 神经生命体）；`npx tsc --noEmit` 与 `tests/merchant-modaui-core.test.ts` 全绿；浏览器端真实渲染截图与小程序真机验收见 §16

## 0. 最终规范（产品已确认，优先级最高）

以下七条是 ModaUI 数字生命 V7「神经生命体」的最终形态规范。后续任何改动（颜色、背景、交互、状态表现）都必须先满足这七条，与本文件其余段落冲突时以本节为准。

1. **纯白背景**：舞台底色为 `#ffffff`，不使用深色舞台、彩色渐变底或外发光色块。
2. **白底灰阶**：纯白背景上不使用纯白粒子（白点会在白纸上打出空洞，整块视觉发白），细胞、纤维、脉冲与尘埃只用近黑、黑灰、中灰、浅灰四阶灰。细胞体为半透明浅灰，轮廓与细胞核为近黑（`0.085, 0.085, 0.095`），纤维与尘埃为中灰，脉冲为近黑高浓度点。不引入任何彩色，失败态使用中性石墨灰（`0.16, 0.155, 0.165`）。
3. **神经生命体，不是人头**：画面主体是一个由数百个半透明细胞组成的球状生命体，细胞之间由神经纤维连接，纤维上有沿路径移动的脉冲点，球体内部漂浮尘埃。不得再出现程序化人头、五官、脖子、肩膀、躯干、衣物、底座或外环。
4. **真实三维结构与生命运动**：细胞位置、尺寸、透明度、纤维端点与脉冲位置都按同一套运动函数逐帧重新计算；持续呼吸、细胞级起伏、差速旋转与内部流动同时存在。不得用贴图、图片、GIF、视频、预录帧或整团匀速旋转冒充生命运动。
5. **鼠标交互**：指针在页面任意位置移动时，生命体朝向（yaw/pitch）随指针视差倾斜，朝向指针一侧的细胞外扩鼓起；指针停住时保持当前姿态，指针移出窗口或窗口失焦后回到正对用户。在生命体范围内按下指针触发一次冲击波脉冲（细胞外扩 + 纤维增亮 + 脉冲加速），随后按指数衰减自然回落。生命体本身不拦截页面点击与滚动。
6. **状态由真实事件驱动**：`idle / listening / thinking / speaking / success / error` 六种状态分别由真实麦克风 RMS、真实请求进行中、真实回答文本片段、真实语音播报 boundary、真实成功与真实错误驱动；禁止用随机动画、固定定时器或本地假数据冒充状态。状态之间以权重插值连续过渡，不切换预设画面。
7. **三端同一语义、零新增依赖**：电脑网页端、手机网页端与商家小程序使用同一组状态语义与同一套细胞/连接算法；小程序用 Canvas 2D 做等效实现。不引入 three.js / R3F / 任何第三方渲染库，继续使用现有单一 WebGL2 上下文与单一舞台。

## 1. 问题与目标

ModaUI 首页空态原先只有一个 `Sparkles` 图标与“今天想做什么？”，既没有“智能体存在感”，也无法体现聆听、思考、回答等真实过程。本轮把首页中央改为持续运动、由真实交互驱动的**神经生命体**（细胞 + 纤维 + 脉冲 + 尘埃），并保留全部既有对话能力。

目标：

1. 画面中构成生命体的所有可见元素（细胞、纤维、脉冲、尘埃）都是每帧重新计算位置的几何体；禁止任何头像图片、贴图、GIF、视频或预渲染模型。
2. 远看是一个有体积的半透明细胞球：细胞密度差与透明度差形成球体轮廓与内部层次；近看能感受到每个细胞在独立起伏、纤维上的脉冲在移动。
3. 生命体真正运动：整体呼吸、细胞差速旋转、纤维随细胞端点同步拉伸、内部尘埃漂浮、点击冲击波外扩后回落，而不是整团匀速自转。
4. 待机 / 聆听 / 思考 / 回答 / 成功 / 失败六种状态可视可辨，且由真实事件驱动（麦克风 RMS、真实请求、真实文本片段、真实语音 boundary、真实错误）。
5. 桌面网页端、手机网页端、商家小程序三端使用同一套业务规则与同一组状态语义；零新增运行时依赖（不引入 three.js / R3F）。

## 2. 非目标

- 不做真人写实脸、人物照片、3D 人物模型或可表情驱动的虚拟主播。
- 不做恐怖骷髅、机器人面具、塑料人偶质感。
- 不改商品、订单、库存、POS、登录、数据库、计费、其他商家页面。
- 不改任何 ModaUI 接口、套餐权限、租户边界、会话存储。
- 不新增语音助手业务能力（不自动发送用户输入、不把播报结果写回业务状态）。

## 3. 复用与查重（防重复开发）

检索关键字：`MerchantAiHome`、`Sparkles`、`recordingVoice`、`speechSynthesis`、`getUserMedia`、`AnalyserNode`、`webgl`、`canvas`、`three`、`@react-three`、`ogl`、`modaCore`、`canvas type="2d"`。

结论：

- 首页权威实现仍是共享组件 `src/apps/merchant-admin-common/components/merchant/MerchantAiHome.tsx`（`activeSection === 'chat'` 空态）。本轮只替换该空态视觉，不新建第二个 ModaUI 首页。
- 仓库无任何 3D 库，也未使用 three.js；新增 three.js 会带来大体积运行时与 React 耦合，收益不足，因此自研 WebGL2 点精灵渲染器，零新增依赖。
- 语音输入权威能力仍是既有 `toggleVoiceInput`（Web Speech API），不替换、不复制；新增 `useMicLevel` 只做视觉电平采样，不参与识别与业务判断。
- 播报复用浏览器原生 `speechSynthesis`，不引入 TTS 服务、不产生费用、不改服务端。
- 商家实际打开的“ModaUI 首页”是 `MerchantPortal.tsx` 中的商家助手面板（`merchant-web-assistant`）空态：旧版是紫色 `Sparkles` 方块 + “我们从哪里开始？”。本轮把同一个 `ModaUICore` 复用到该面板空态，不新建第二个渲染器、第二套头型算法或第二份欢迎语文案。
- 小程序没有 WebGL2 点精灵，也没有麦克风识别能力，因此复用同一套神经生命体几何与运动算法（同种子、同公式），在 Canvas 2D 上逐帧投影绘制细胞、纤维、脉冲与尘埃，不引入第三方渲染库。
- 文案统一走 `src/i18n/uiCopyCatalog.ts` 的 `localizeCopy`，不新增平行文案表。

## 4. 视觉与状态

**画布**：纯白（`#ffffff`）无渐变、无彩色光晕、无深色舞台。生命体是白纸上的灰阶结构，白色只作为纸面与留白，不使用白色粒子（白纸上的白粒子等于空洞）。

**生命体**：细胞中心由 Fibonacci 球面分布 + 径向抖动生成，半径 0.78–0.98，形成有体积的球状聚集体而不是空心壳；细胞尺寸分三档（0.028–0.062），小球填充间隙、大球形成主结构。细胞不是硬边圆点，而是逐像素计算的球面着色：中心为半透明浅灰、边缘为近黑轮廓、右上角有一枚浅灰高光点，因此远看是半透明玻璃质感，近看能看到每个细胞的立体感。纤维连接按空间最近邻建图（每细胞保留最近 3 个邻居并去重），端点直接取同一套运动函数算出的细胞位置，所以细胞移动时纤维同步拉伸，不会出现断线或错位。

**不是人头**：不再采样任何头型曲面，也没有五官、脖子、肩膀、躯干、衣物、底座或外环。

结构分层（同一套连续系统，不是叠加多套动画）：

| 层 | 数量（桌面大核心） | 说明 |
|---|---|---|
| 半透明细胞 | 460 | 球体主结构；球面着色 + 近黑轮廓 + 浅灰高光 |
| 神经纤维 | ≈ 1.1–1.4 × 细胞数 | 最近邻连接图，中灰细线，`alpha 0.10–0.26`，随状态与能量增亮 |
| 脉冲光点 | ≈ 0.45 × 细胞数 | 沿指定纤维按各自相位移动的近黑高浓度点，形成神经信号传导 |
| 内部尘埃 | ≈ 0.16 × 粒子预算 | 球体内部漂浮的中灰微粒，提供纵深 |
| 细胞核高光 | 随细胞 | 半球面着色的浅灰实心高光，最后绘制，形成「浅灰」这一阶 |

白底灰阶的实现：同一支近黑墨色（`0.085, 0.085, 0.095`），通过 alpha 与球面法线得到近黑→黑灰→中灰→浅灰；细胞体中心浅、轮廓深，纤维与尘埃为中灰（纤维浓度基线 `0.2 + 0.12 × energy`、尘埃 `0.44–0.62` 权重），脉冲是近黑高浓度点（`uFiberAlpha × 2.6`，峰值接近 0.95），细胞核高光为浅灰（`0.56, 0.56, 0.59`）。全流程不使用任何彩色，失败态换成中性石墨灰（`0.16, 0.155, 0.165`）。

**鼠标交互**：`pointermove` 监听在 `document` 上，页面任意位置的指针都会换算成画布坐标系的归一化指针（±1.25），平滑后驱动两组效果：

- **姿态视差**：整团生命体 yaw `gaze.x * 0.46`、pitch `-gaze.y * 0.26`，指针停在某处时保持该朝向，指针移出窗口或窗口失焦后回到 0（正对用户）。
- **局部鼓起**：朝向指针一侧的细胞额外沿法线外扩（`0.012 + 0.02 * 指针方向点积`），形成被指针“吸引”的凸起，而不是整团刚性旋转。

**点击冲击波**：在生命体范围内按下指针时，`pointerdown` 会按画布矩形做命中判断（生命体外接圆内才算），命中后触发一次 `burst = 1` 的冲击：细胞整体外扩 `0.09 * burst`、纤维与脉冲增亮、脉冲传播速度提升，随后以 `exp(-dt * 2.4)` 衰减回常态。画布与宿主始终 `pointer-events: none`，点击不会拦截页面滚动或按钮。

**呼吸与流动**：整体呼吸 `1 + 0.045*sin(t*1.15) + 0.02*sin(t*0.47)`；每个细胞叠加独立相位的起伏 `0.03*sin(t*1.25+phase) + 0.02*sin(t*0.63+phase*1.7)`；旋转按半径差速（内层慢、外层快），并叠加上下轻微俯仰，因此细胞之间持续发生相对位移，而不是整团同步自转。

| 状态 | 触发来源（真实事件） | 生命体表现 |
|---|---|---|
| `idle` 待机 | 默认 | 呼吸、差速旋转、尘埃漂浮；指针未移动时只保留极小幅摆动 |
| `listening` 聆听 | `recordingVoice === true` | 真实麦克风 RMS 驱动细胞由内向外扩散的波纹，脉冲更密 |
| `thinking` 思考 | `busy === true`（真实请求进行中） | 细胞向内收缩约 12%，旋转加快，纤维更密更亮，脉冲加速 |
| `speaking` 回答 | `speechSynthesis` 的真实 `start/boundary/end` | 细胞随真实语音脉冲有节律鼓起，脉冲沿纤维定向传导 |
| `success` 成功 | 助手回答真实写入消息后 1.6s 包络 | 整体外扩、细胞略大、纤维增亮，随后回到待机 |
| `error` 失败 | 既有 `error` 状态非空 | 收缩、转为石墨灰、细胞尺寸收敛，不出现彩色 |

状态以 6 个权重 uniform 逐帧插值（`1 - exp(-dt * 5.5)`），不存在切换预设帧或图片的路径。对话实时生命通道（`uLife` / `uEnergy`）继续生效：输入聚拢、提交前移、真实回答片段流动、语音脉冲，全部映射到同一套细胞与纤维，不新增第二套视觉状态。

## 5. 技术实现

- `modaui/neuralLifeform.ts`：唯一几何与运动参考实现。`buildNeuralCells()` 用固定种子 `20261027` + Fibonacci 球面分布生成 460 个细胞（约 78% 落在 0.80–0.98 外壳、其余 0.32–0.70 内层，内层制造真实前后遮挡）；`buildNeuralFibers()` 为每个细胞保留最近 3 个邻居并用 `a * count + b` 做无向边去重，逐顶点写入两端点数据（`baseA/baseB`，同一份缓冲可被线通道与脉冲通道用不同 stride 复用）；`buildNeuralDust()` 生成球体内按体积均匀分布的中灰尘埃；`animateNeuralCell()` 是细胞运动的唯一公式（呼吸、细胞级起伏、差速旋转、聆听波纹、语音脉冲、指针鼓起、姿态视差），`isInsideLifeform()` 用外接圆做点击命中判定。不读写 DOM / WebGL / React。
- `modaui/coreShaders.ts`：两支 GLSL ES 3.00 程序。精灵程序（细胞 + 尘埃）计算 `lifeformPoint()`、透视投影与点尺寸衰减，片元逐像素绘制球面着色（半透明浅灰体 + 近黑轮廓环 `rim` + 浅灰高光 `specular`）；纤维程序在同一份顶点缓冲上跑两个通道 —— `uFiberPass = 0` 用 `gl.LINES` 画中灰神经纤维，`uFiberPass = 1` 用 `gl.POINTS` 把顶点当作沿纤维移动的脉冲（用 `aTone`/相位与 `uBurst` 决定速度），因此脉冲不需要第二套几何。
- `modaui/modaCoreEngine.ts`：WebGL2 渲染器。单一 VAO 结构、四次 `drawArrays`（细胞点 → 纤维线 → 尘埃点 → 脉冲点），`FIBER_STRIDE = 16`（每顶点 16 个 float：A 位置 3 + A 种子 4 + B 位置 3 + B 种子 4 + phase + tone）。混合固定为 `gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)`（预乘普通 alpha，白底墨色不能用加法混合）。每帧绑定 `uState[6]`、`uLife`、`uEnergy`、`uBurst`、`uPointer`、`uGaze`；`pointermove` / `pointerdown` 监听在 `document` 上，`isInsideLifeform()` 命中后置 `burst = 1` 并按 `exp(-dt * 2.4)` 衰减。桌面预算 16000、手机 9000，经 `neuralLifeformLayoutForBudget()` 换算成细胞/尘埃/脉冲数量；不创建任何纹理、不加载任何图片。
- `modaui/ModaUICore.tsx`：React 包装，负责 canvas 生命周期、`IntersectionObserver` 与 `visibilitychange` 暂停、`ResizeObserver` 尺寸同步、WebGL2 失败或上下文丢失时切换 CSS 降级核心，并在 DOM 标注 `data-modaui-core="webgl|css"` 与 `data-modaui-core-state`；容器内不叠加任何底色或外发光，背景完全交给页面白底。
- `modaui/useModaCoreAudio.ts`：`useMicLevel(active)` 用 `getUserMedia` + `AnalyserNode` 计算 RMS（平滑 0.28、增益 5.2），结束时释放 track 与 AudioContext；`useSpeechReply()` 用 `speechSynthesis` 播报并输出 boundary 脉冲（110ms 衰减）。
- `MerchantAiHome.tsx`：空态改为纯白舞台 + `<ModaUICore>` + 欢迎语 + 4 条真实快捷提问（点击走既有 `sendQuestion`），文案使用深色；助手消息标记由 `Sparkles` 改为粒子渐变圆点；回答成功后 `flashCoreSuccess()` 并仅在语音轮次内 `speakReply()`。
- 小程序 `utils/moda-core.js` + `pages/assistant`：`buildCells()` / `buildFibers()` / `buildDust()` / `buildLifeform()` / `animateCell()` 与 TS 端同一随机数序列与同一组系数（`SEED = 20261027`、`GOLDEN_ANGLE`、`NEIGHBOURS = 3`），保证细胞基点与纤维端点逐点一致；透视用同一 `FOV = 32°`、`VIEW_DISTANCE = 3.55`，两端同乘 `PROJECTION_SCALE = 0.86` 投影留白（小程序乘在焦距上，网页乘在投影矩阵 x/y），保证呼吸峰值时生命体仍完整落在画布内。逐帧按深度排序绘制细胞、纤维、尘埃与脉冲；墨色 `rgba(17,17,19,alpha)`、浅灰高光 `rgba(158,158,164,0.92)`，不使用纯白粒子。
- `MerchantPortal.tsx`（商家助手面板空态）：删除紫色 `Sparkles` 方块与“我们从哪里开始？”，改为同一个 `<ModaUICore>` + 同一欢迎语（`你好，我是 MODAUI。`）+ 同一组 4 条快捷提问，点击走既有 `submitAssistantQuestion`。面板没有麦克风入口，因此只使用 `idle / thinking / success / error`：`thinking` 由 `assistantBusy` 驱动，`success` 由真实 `/api/merchant/assistant/query` 成功后 1.6s 闪回，`error` 由该请求真实失败驱动；不伪造 `listening` / `speaking`。
- 不新增 API、数据库、权限或事件；全部视觉状态来自既有前端状态与浏览器媒体事件。旧的 `modaui/coreParticles.ts`（程序化人头）已随 V7 删除，仓库内不存在第二个几何来源。

## 6. 性能与降级

- 画布像素比上限：桌面 `min(dpr, 1.6)`、手机 `min(dpr, 1.25)`；粒子数按视口区分。
- 自适应降级：帧耗时 EMA > 26ms 时按 0.15 步长下调像素比（下限 0.55 倍），只降不升。
- 页面隐藏或组件离屏时停止 rAF；重新可见后恢复。
- `prefers-reduced-motion: reduce`：时间推进 0.18 倍、权重过渡更缓、`uGaze` 压到 0.25（保留轻微视线跟随）。
- 无 WebGL2 / 上下文丢失：CSS 降级核心（纯渐变 + 点阵遮罩，无图片），状态通过 `data-modaui-core-state` 影响亮度与饱和度；该降级**不是人头形态**，仅保证页面仍有实时反馈。
- 小程序：预算按画布面积换算（`clamp(width × height × 0.19, 1200, 16000)`），再经 `lifeformLayout()` 折算成细胞（96–460）、尘埃（140–480）与脉冲（36–220）数量；`canvas.requestAnimationFrame` 驱动，页面隐藏即 `stop()`。320×260 画布实测 458 细胞 / 832 纤维 / 480 尘埃 / 206 脉冲。

## 7. 测试与验收

- `tests/merchant-modaui-core.test.ts`（16 用例）：断言无 three/R3F 依赖、无图片/纹理引用、四层结构（细胞点 / 纤维线 / 尘埃点 / 脉冲点）与 `FIBER_STRIDE` 复用、普通 alpha 混合（禁加法混合）、六状态权重 uniform、`lifeformPoint()` 与 `animateNeuralCell()` 系数一致、细胞几何确定性（同种子同坐标、内外两层、纤维无向边去重、端点必须是真实细胞）、`animateNeuralCell()` 纯函数与各状态方向（聚拢内收、舒展外扩、失败收缩、冲击外扩、能量增强）、`isInsideLifeform()` 命中边界、麦克风流释放、降级路径、小程序 Canvas 2D 真实逐帧绘制（细胞/纤维/尘埃/脉冲数量、笔画存在、状态权重收敛到页面传入状态）。
- `tests/merchant-modagpt-layout.test.ts`：断言空态渲染 `<ModaUICore>`、旧 `Sparkles` 空态图标已移除、`flashCoreSuccess` 与 `speakReply` 接线。
- `tests/merchant-miniprogram-ui.test.ts`：断言占位提示与助手标记口径、粒子画布与欢迎语。
- 文案：`tests/ui-translation-copy.test.ts` 覆盖新增欢迎语与快捷提问条目。
- 实机：真实商家会话下 390×844 / 320×700 / 1440×900 截图；状态切换通过真实麦克风授权（Chromium fake device）与真实请求触发，不以随机动画冒充。

## 8. 三端矩阵

| 端 | 实现 | 状态 |
|---|---|---|
| 电脑网页端 `merchant-admin-web` | 共享 `MerchantAiHome` + `ModaUICore`（WebGL2，预算 16000 → 460 细胞 / ≈832 纤维 / 480 尘埃 / 207 脉冲，纯白舞台）；商家助手面板空态复用同一 `ModaUICore`（300px） | 已部署生产并验证（V6 人头版本）：`https://ruda.fashion/merchant` 展开助手面板后 `data-modaui-core=webgl`、300×300、`webgl2=true`，两帧哈希不同，真实提问进入 `thinking` 并返回真实回答；WebGL2 关闭时降级为 `css` 且页面可用。V7 神经生命体需重新截图验收，见 §16 |
| 手机网页端 `merchant-admin-mobile` | 同共享组件，预算 9000，像素比 1.25、点尺寸补偿 1.25、堆叠布局（核心 `min(60vw,240px)`，`sm` 300px，`lg` `min(36vw,380px)`） | 已部署生产并验证（V6 人头版本）：390×844 核心 234×234、320×700 核心 192×192，`webgl` 模式、两帧哈希不同、无横向溢出、无 JS 错误；V7 需重新截图验收，麦克风聆听与 TTS 播报仍待真实设备验收 |
| 商家小程序 `merchant-miniprogram` | `pages/assistant` Canvas 2D 神经生命体（同种子同公式、458 细胞 / 832 纤维 / 480 尘埃 / 206 脉冲 @320×260、纯白舞台）+ 同一欢迎语 | 代码完成；`node --check` 与逐帧渲染用例通过，微信开发者工具与真机待验收 |

## 9. 风险、回滚与后续

- 风险：低端设备粒子绘制开销 → 粒子数分级 + 像素比自适应 + 离屏暂停；必要时可在 `ModaUICore` 增加 `forceCss` 快速回退。
- 风险：浏览器禁用麦克风 → `listening` 不可达，其余状态与对话功能不受影响。
- 风险：小程序无语音识别能力 → 小程序只呈现 `idle/thinking/success/error`，不伪造聆听与说话，验收时按此口径核对。
- 回滚：新增文件独立，`MerchantAiHome.tsx` 仅空态、消息标记与成功/播报接线改动，可单点回退；无数据库、无接口、无配置变更。


## 10. 验收记录（V3 人头阶段，历史记录，已被 §16 取代）

> 本节记录程序化人头时期的验证数据，保留作为历史证据。V7 已把画面主体换成神经生命体，人头相关的墨迹包围盒、五官识别等指标不再适用。

- `npx tsc --noEmit`：exit 0（无类型错误）。
- `node --import tsx --test tests/merchant-modaui-core.test.ts tests/merchant-modagpt-layout.test.ts tests/merchant-miniprogram-ui.test.ts tests/ui-translation-copy.test.ts`：29 tests / 29 pass（含「视觉终态：纯白背景、只有头部、白底灰阶粒子与鼠标视线跟随」用例）。
- `npm run build:app:merchant-admin-web`、`npm run build:app:merchant-admin-mobile`：均 exit 0。
- headless Chromium（SwiftShader WebGL2）1440×900 / 390×844 / 320×700 三视口、六状态截图：无 JS 错误，帧耗时 ≈ 16.6–16.8ms，粒子数 16000 / 9000 / 9000，六状态截图哈希互不相同（最后一轮 1440×900：idle `65d961045f`、listening `cbb9dec306`、thinking `503669efaa`、speaking `f9f05c2870`、success `86da1a0093`、error `ae55108c0d`；390×844 与 320×700 同样互不相同）。
- 纯白背景实测：截图四角与画布底色均为 `#ffffff`；头部墨水占比与平均亮度（1440×900）：idle 177 / thinking 171 / speaking 176 / success 171 / error 较浅，与状态语义一致，均为黑灰阶，无彩色像素。
- 只有头部实测：墨迹包围盒宽高比 1.20–1.33（典型人头比例），头部下沿以外无任何墨迹，不存在脖子、肩膀、底座或外环。
- 鼠标视线跟随实测：指针移到视口最左/最右各 700ms 后截图哈希不同（最后一轮 1440×900：`8389602107` vs `3396a98a76`；390×844：`3553bd9bd8` vs `c61fb2bcf7`；320×700：`11d23bd47a` vs `a56e78aaa6`），证明头部朝向随指针变化。
- 全粒子证明：整帧只执行 `drawArrays(gl.POINTS)`（墨点 + 浅灰高光两批），无纹理绑定、无图片请求；截图中颅顶、眉弓、眼窝、鼻梁、嘴唇、下颌与下巴均由粒子分布形成。
- 小程序实测：`node --check` 通过；用 Chromium 加载体 `canvas type="2d"` 真渲染路径截图（idle/thinking/success/error 四态），纯白背景、黑灰粒子头部、深色欢迎文案，均无 JS 错误。
- 未完成/待验收：整页真实商家会话（需登录与数据库）截图；微信开发者工具与真机实拍。

## 12. 生产部署与线上验收（2026-10-26 21:20）

线上版本（`https://ruda.fashion/apps/*/current.json` 实测）：

- `merchant-admin-web`：`20261026201913350-d277141e`
- `merchant-admin-mobile`：`20261026201924572-1c048645`

验收方式：无头 Chromium（SwiftShader WebGL2）直连生产域名 `https://ruda.fashion/merchant`，用演示商家会话（`ruda-demo-merchant-03` / Atelier Alba，经小程序演示登录接口取得真实 JWT 并写入 `ruda_merchant_jwt` Cookie）。实际加载链路经网络日志确认为 `current.json → /releases/<releaseId>/app.js → chunks/MerchantPortal-*.js → chunks/ModaUICore-*.js`。

- 电脑网页端 1440×900：点击“打开 GPTmoda 助手” → “展开助手面板”，`data-modaui-core=webgl`、矩形 300×300、`webgl2=true`；间隔 1s 的两帧哈希 `413feae478` / `b2cd8a40c8` 不同（持续运动）。
- 真实交互：向助手输入“今天有哪些订单需要处理？”，`data-modaui-core-state` 变为 `thinking`；真实 `/api/merchant/assistant/query` 返回“当前没有等待配货或发货的订单。”及 GMV/待处理汇总，页面正常渲染，无 JS 异常。
- 手机网页端（同生产域名，移动端解析为 `merchant-admin-mobile`）：390×844 核心 234×234、320×700 核心 192×192，均为 `webgl`；两帧哈希 390 `95f013c4ac`/`513688c516`、320 `25e99842a6`/`242e5aae20` 均不同；`scrollWidth-clientWidth=0`（无横向溢出）；无 `pageerror`。
- 降级验证：Chromium 加 `--disable-webgl` 后 `data-modaui-core=css` 且存在 `.modaui-core-fallback`，欢迎语、快捷提问与输入框仍可用。
- 已知与本次无关的既有问题：演示商家商品图指向旧子域 `https://b2b.ruda.fashion/demo-products/*.jpg`，308 后 404，控制台出现 `ERR_FAILED`；不影响 ModaUI 核心与对话。
- 仍未验证：麦克风聆听（`listening`）与 TTS 播报（`speaking`）需真实设备授权；微信开发者工具与真机。

## 11. 发布与线上部署（2026-10-26 补）

- 正式入口：`https://ruda.fashion/merchant`（`PORTAL_DOMAINS.merchant = 'ruda.fashion'`；nginx 443 反代 `127.0.0.1:3000`，由 `node dist/server.cjs` 提供 `dist/` 静态产物）。手机网页端同入口按视口解析为 `merchant-admin-mobile`。
- 生效机制：`src/main.tsx` 每次加载都 `fetch('/apps/<target>/current.json', { cache: 'no-store' })`，再按 manifest 动态 `import()` 对应 release；`index.html` 为 `no-cache`，`current.json` 为 `no-store`，release 内资源为 `immutable`。因此**切换 `current.json` 即生效，不需要重启 Node 进程**。
- 关键事实（本轮线上旧页面的直接原因）：`npm run build:app:<target>`（`scripts/build-app.ts <target>`）只产出 `dist/apps/<target>/releases/<releaseId>/`，**不会**切换 `current.json`；只有 `all` 分支或 `npm run publish:app -- <target> <releaseId>` 才会激活。此前只跑了构建，线上 `current.json` 仍指向旧 release，所以源码改了、构建过了，正式网站仍是旧页面。
- 正式发布顺序：`npx tsc --noEmit` → `npm run build:app:<target>` → `npm run publish:app -- <target> <releaseId>` → `curl -s https://ruda.fashion/apps/<target>/current.json` 核对 `releaseId` → 线上页面复核（无痕窗口）。
- 回滚：`npm run rollback:app -- <target>`（交换 `current.json` 与 `current.previous.json`），历史 release 目录保留，可重复回滚。
- 缓存排查顺序：先看 `current.json` 的 `releaseId` → 再看 `index.html` 响应头 → 最后清 Cloudflare/浏览器缓存；不要靠改源码目录判断线上版本。

## 13. 变更记录：白底灰阶配色（2026-10-26 21:40）

**产品意见**：白色底上要灰色粒子或黑灰粒子。旧实现把高光阶做成纯白实心粒子，白底上等于在墨点里打白洞，整块视觉偏白、偏淡。

**决定（已写入第 0 节规范 2）**：

- 纯白背景禁止使用纯白粒子；粒子只用近黑 / 黑灰 / 中灰 / 浅灰四阶灰。
- 墨色 `uColor` 从 `0.045, 0.045, 0.055` 调整为 `0.085, 0.085, 0.095`（近黑偏灰，避免纯黑死板）。
- 头部粒子 `baseAlpha` 0.98 → 0.94；背面遮挡下限 `mix(0.42, 1)` → `mix(0.60, 1)`；外层尘埃 `baseAlpha` 0.30 → 0.38、浓度权重 0.32–0.52 → 0.44–0.62（保留中灰尘埃但不糊成噪点）。
- `kind = 4` 高光阶由纯白改为浅灰 `0.56, 0.56, 0.59`、alpha 上限 0.98 → 0.78。
- 失败态石墨灰同步调为 `0.16, 0.155, 0.165`。
- 三端同步：小程序 `utils/moda-core.js` 墨点 `rgba(17,17,19,alpha)`、高光 `rgba(158,158,164,0.92)`、尘埃浓度与网页端一致；CSS 降级核心的白色高光改为极淡中灰（`rgba(124,124,130,0.16/0.10)`）。

**影响文件**：`modaui/coreShaders.ts`、`modaui/coreParticles.ts`、`modaui/modaCoreEngine.ts`、`src/apps/merchant-admin-common.css`、`merchant-miniprogram/utils/moda-core.js`、`tests/merchant-modaui-core.test.ts`。

**验收口径**：白底上墨点像素落在黑灰阶（组件级截图统计 `ink_mean` ≈ 170、`p05` ≈ 120，无纯白粒子核心）；`tests/merchant-modaui-core.test.ts` 新增断言禁止 `mix(ink, vec3(1.0)` 与小程序 `rgba(255, 255, 255` 纯白粒子。

**线上部署（2026-10-26 21:00 前后）**：

- `merchant-admin-web`：`20261026205545549-7ad3351d`（`npm run build:app:merchant-admin-web` → `npm run publish:app -- merchant-admin-web …`）。
- `merchant-admin-mobile`：`20261026205545550-d269c133`（同上，`current.json` 已核对）。
- 电脑网页端 `https://ruda.fashion/merchant`（1440×900，真实演示商家会话）：展开助手面板后 `data-modaui-core=webgl`、300×300、`webgl2=true`，间隔 0.9s 两帧哈希 `abe587d28e4d` / `b014bca7fa41` 不同；截图为白底灰黑粒子头部，脸部结构可辨，无 `pageerror`。
- 手机网页端（390×844 / 320×700，真实会话 + `新建对话` 回到空态）：核心 234×234 / 192×192，`webgl`，两帧哈希不同，`scrollWidth-clientWidth=0`，无 `pageerror`；截图为灰阶粒子头部，不再是发白的浅灰。
- 降级：Chromium 加 `--disable-webgl --disable-webgl2` 后 `data-modaui-core=css`、存在 `.modaui-core-fallback`（234×234），欢迎语、快捷提问、输入框仍可用，无 `pageerror`。
- 小程序：`node --check` 通过；用 Chromium + `canvas type="2d"` 真渲染路径截图（idle / thinking），墨点像素 `ink_mean` ≈ 118、`pure_white` 仅剩背景，无 JS 错误；微信开发者工具与真机仍待验收。


## 14. 数字生命 V4：粒子核心与 AI 对话实时融合（2026-10-26）

### 14.1 问题与目标

此前粒子核心只出现在空态，进入对话后消失；`thinking` 只表达“请求进行中”，用户打字、回答文本出现、语音播报等真实过程没有驱动粒子。结果是核心再好看，也只是一个独立播放的动画。

目标：让同一个粒子核心成为聊天界面的一部分——打字时聚拢、发送后向前靠近、真实回答文本出现时持续流动与脉冲、回答结束回到安静状态；所有变化只能由真实输入、真实请求、真实文本与真实语音触发。

### 14.2 非目标

- 不改 RUDA 商家业务页面、数据库、权限、计费与会话存储。
- 不新增 AI 接口，不改 `/api/merchant/assistant/query` 的契约与返回结构。
- 不引入 three.js / R3F / 任何新运行时依赖，不新增图片、视频、GIF。
- 不做“预录动画假装在思考/在打字”。

### 14.3 真实链路（审计结论）

| 环节 | 现状 | 本轮处理 |
| --- | --- | --- |
| 输入 | `MerchantAiHome` 文本框 `onChange/onFocus`、桌面面板同文本域 | 直接映射 `input:focus` / `input:change` / `input:blur` |
| 提交 | `sendQuestion` 同步处理 → `POST /api/merchant/assistant/query` | `message:submit` + `response:start` |
| 回答文本 | 服务端**整包 JSON 返回**（无 SSE / stream），客户端一次性 `setMessages` | 保持同一段真实文本，改为逐字呈现（`revealAssistantReply`），每步 `response:chunk` |
| 完成/失败 | `result.reply` / `catch` | `response:complete` / `response:error`；切换会话或新建对话 `response:abort` |
| 语音 | 既有 `speechSynthesis`（`useSpeechReply`） | `audio:start` / `audio:end`，音量仍由 `boundary` 脉冲驱动 |

> 如实说明：接口目前不是流式。逐字呈现的是**同一次真实响应**的文本，不生成任何额外文案，也不提前进入 responding；请求在途时阶段为 `sending`，超过 1.2s 没有文本则按“真实等待”降低运动能量。若后续服务端改为 SSE，只需把 `response:chunk` 的触发点从呈现定时器换成真实 `data:` 帧，粒子侧无需改动。

### 14.4 事件通道：`modaui/modaCoreLife.ts`

- 事件：`input:focus|change|blur`、`message:submit`、`response:start|chunk|pause|resume|complete|error|abort`、`audio:start|level|end`、`core:reset`。
- 输出（每帧 `sample()`，0–1 连续值）：`contraction` 聚拢、`forward` 前移、`flow` 定向流动、`pulse` 片段脉冲、`energy` 运动能量。
- 阶段：`idle / focus / sending / responding / complete / error`；`complete` 1.4s、`error` 1.8s 后自动回 `idle`；打字停顿 2.6s 后放松回 `idle`。
- 通道自身不使用 `setInterval/setTimeout`，所有时间判断基于 `sample(now)` 的时间戳，可注入假时钟做确定性测试。

### 14.5 渲染：同一套 GPU 粒子

- 着色器新增 `uLife`（聚拢/前移/流动/脉冲）与 `uEnergy`：聚拢时整团粒子向核心收拢并轻微内落；`forward` 直接位移相机空间 Z（真实透视，不是 CSS 缩放）；`flow` 叠加方向一致的细流与旋涡；`pulse` 是一次 3.5% 的鼓起并带 10% 透明度提升；`energy` 乘在漂浮与解体幅度上，等待时自然变弱。
- 引擎每帧读取通道值并再做一次阻尼（`exp(-dt*7)`），片段密集到达也不会跳变；`reducedMotion` 时阻尼更慢。
- 粒子数按画布面积决定（常驻小核心 3000，其余保持原有密度：手机 9000 / 桌面 16000），常驻小核心不再用一万六千个粒子糊成一团。
- `ModaUICore` 新增 `life` 属性，并在容器上输出 `data-modaui-core-phase` 与 `data-modaui-life`（每 250ms，不触发 React 重渲染），用于真实页面验收。

### 14.6 界面位置

- 空态：保持原有大核心（240–380px），承接“打字收缩 → 发送前移”。
- 对话中：消息区上方常驻 56px 小核心（同一 `life`、同一渲染器），生成与阅读时都在场，不遮挡正文；多轮对话不重建。
- 桌面助手面板：空态大核心 + 对话中 96px 核心，`assistantRevealing` 期间保持可见。

### 14.7 三端状态

| 端 | 状态 |
| --- | --- |
| 电脑网页端（`merchant-admin-web`，含侧边助手面板） | 已完成事件接线与逐字呈现，待线上实测确认 |
| 手机网页端（`merchant-admin-mobile`，复用 `MerchantAiHome`） | 同上 |
| 商家小程序（`pages/assistant` + `utils/moda-core.js`） | **未接入**：仍只有 `state` 驱动；小程序无流式文本，需先决定是否做分片渲染，本轮不声称完成 |

### 14.8 验收标准

1. 输入文字：核心聚拢，输入框与页面布局不跳动；停止输入 2.6s 后放松。
2. 提交：核心向前靠近；请求在途超过 1.2s 无文本时运动减弱。
3. 真实回复到达：文本逐字出现，同时粒子出现定向流动与片段脉冲；文字与粒子来自同一次响应。
4. 完成：核心平滑回位并回到待机；多轮对话不重建核心、无残影或内存持续增长。
5. 失败：显示真实错误，粒子进入 `error` 后回待机；切换会话/新建对话立即中止呈现。
6. 语音：真实播报开始/结束驱动 `audio:start/end`，与文字属于同一回答。

### 14.9 验证记录

（见下方“14.9 验证记录”小节，随本轮真实执行补充。）

---

## 15. V5 对话内嵌式粒子智能体（单一画布跨容器连续转换）

### 15.1 问题与目标

V4 之前粒子核心是「首页大头部 + 对话中另挂一个常驻小核心」，两者是**不同的 canvas / 不同的渲染器实例**，只是共享同一个事件通道，视觉上并不成立「同一个智能体跟着对话走」。

本轮目标：让**同一个 canvas、同一个 WebGL 上下文、同一套粒子数据**从首页大核心连续移动到当前助手回复的左上角，变成 28–32px 的三维粒子小头部；回答结束后停在那里保持安静的身份标识。

### 15.2 非目标

- 不做第二套聊天界面，不改消息数据、API、权限、计费与会话存储。
- 不给回复加头像图片、GIF 或静态图标；不新增渲染引擎或第三方依赖。
- 不为「移动」写假的 CSS 动画序列：位置与尺寸由真实锚点矩形逐帧计算。
- 本轮不接小程序（见 15.9）。

### 15.3 复用与防重复检查

| 检查项 | 结论 |
| --- | --- |
| 已搜索 | `ModaUICore`、`createModaCoreLife`、`modaui/`、`assistant`、`核心`、`avatar`、`radial-gradient` |
| 复用 | `ModaUICore`（唯一渲染组件）、`createModaCoreLife`（唯一行为通道）、`modaCoreEngine`（唯一 WebGL 管线）、`ModaCoreAnchor` 新增仅做落位 |
| 删除 | 首页 header 下的 72px 常驻核心、桌面面板顶部的 96px 核心、助手消息里 `radial-gradient` 静态“头像点” |
| 不足证据 | 原常驻小核心与大核心是两个独立实例，无法承载「同一个对象进入回复区域」；`getBoundingClientRect` 证明两者位置互不相关 |
| 为什么新建 | 仅新增「放置/移动宿主」的舞台层，不复制渲染与业务逻辑 |

### 15.4 布局

- 用户消息：保持原有气泡样式，不参与粒子布局。
- 助手回复：首行左侧悬浮 32px 粒子锚点（`float-left mr-2.5 mt-0.5 h-8 w-8`），正文从它右侧开始；长回复从第二行起继续占满整行宽度，不会因为图标而整段变窄。
- 助手回复上方的 `MODAUI` 为 10px 中性灰标签（文字，不是头像），用于说明说话者。
- 历史回复不再各挂一个粒子头：**同一时间只有当前回复承载高强度粒子表现**（单一 canvas 的必然结果，也满足“不让每行文字都跟着跳”的阅读要求）。这一点与最初“旧头保持稳定”的表述有冲突，取舍理由：保留 N 个活动头需要 N 个 WebGL 上下文或第二套渲染器，违反“不增加第二套渲染引擎”；已完成的回复保持为纯文字，安静不抢注意力。
### 15.5 单一渲染舞台：同一个对象真的移动了

实现：`modaui/modaCoreStage.ts`（控制器）+ `modaui/ModaCoreStage.tsx`（React 适配）+ `modaui/modaCoreStageMath.ts`（纯逻辑）。

1. **唯一 canvas**：`ModaCoreStageProvider` 只创建一个宿主 `div`，并用 React portal 把 `ModaUICore` 渲染进去。整个聊天界面只有这一个 canvas / 一个 WebGL 上下文。
2. **唯一移动的是宿主元素**：锚点（`ModaCoreAnchor`）只是布局占位。舞台把宿主 `appendChild` 到当前锚点里；canvas 元素从不销毁重建，所以着色器程序、VAO、粒子数据、时间轴都连续。
3. **移动期间**（`traveling`）：宿主挂到 `document.body`，`position: fixed` + `translate3d(x,y,0) scale(s)`，CSS 尺寸固定为 `max(源面积, 目标面积)`（上限 420px）。这样固定定位不会被消息滚动容器裁剪，也不会因为逐帧改 CSS 尺寸触发多次 WebGL resize。
4. **落位后**（`anchored`）：宿主改为 `position: absolute; inset: 0; width/height: 100%` 填满锚点，`transform: none` → ResizeObserver 触发一次真实 `resize()`，按原生像素渲染 32px 小核心，不再是被浏览器缩小的大图。
5. **目标矩形每帧从锚点实测**（`getBoundingClientRect`），所以消息区滚动时核心会跟着自己那一行；锚点不在视口内时被滚动容器自然裁掉。
6. **锚点优先级**：有 `reply` 锚点就用回复位置，否则用 `hero`。注册/注销统一走微任务合并，避免「旧锚点卸载、新锚点挂载」的中间态闪烁。
7. **粒子预算**（`modaCoreParticleCountForSize`）：按显示边长算，32px 约 1400（下限）、72px 约 4700、300px 封顶 16000（手机 9000）。尺寸变化时 `setParticleCount` 只重建顶点缓冲，复用同一上下文与程序。
8. **释放**：没有任何锚点时宿主被移出文档，`IntersectionObserver` 停掉渲染循环；provider 卸载时 `stage.dispose()` 释放动画帧与宿主，`ModaUICore` 卸载时删除 buffer/VAO/program。
9. **验收探针**：宿主持有 `data-modaui-stage[-kind|-size|-count|-id]`，锚点持有 `data-modaui-anchor` / `data-modaui-anchor-id` / `data-modaui-stage-owner`，`window.__modauiStageLog` 保留最近 120 条锚点/落位/移动事件（不含任何用户内容），供线上取证与自动化检查。

### 15.6 与真实文本流同步

| 真实事件 | 事件通道 | 阶段 | 粒子 |
| --- | --- | --- | --- |
| 文本框 `onChange` / `onFocus` | `input:change` / `input:focus` | `focus` | 聚拢、轻微内落；2.6s 无输入自动放松；**核心已在回复位置时不再响应打字**（见下） |
| 发送（`sendQuestion` / `submitAssistantQuestion`） | `message:submit` + `response:start` | `sending` | 向前靠近（相机空间 Z 前移）；锚点从首页/上一条回复移动到新的回复锚点 |
| 请求在途、无文本 >1.2s | 无新事件（真实等待） | `sending`→能量下降 | 运动减弱，不伪造进度 |
| 回答文本到达 | `response:start` + 每个片段 `response:chunk` | `responding` | 定向细流 + 片段鼓起脉冲；文字与粒子来自同一次真实响应 |
| 生成暂停/恢复 | `response:pause` / `response:resume` | `responding` | 能量下降/回升 |
| 完成 | `response:complete` | `complete` → 1.4s 后 `idle` | 流动停止，头部保留、呼吸变轻 |
| 失败 | `response:error` | `error` → 1.8s 后 `idle` | 石墨灰、能量最低 |
| 切换/新建会话、停止呈现 | `response:abort` | `complete` | 立即停止文本与流动 |

**打字不影响已落位的回复核心**：`coreLife` 的 `focus` 目标只用于「首页大核心」阶段。实现上没有额外分支——首页大核心随首条消息一起退场，回复位置上的核心只在 `sending/responding/complete` 之间变化；`input:change` 只在 `phase` 为 `idle` 时才被采纳为 `focus`（`modaCoreLife` 的真实事件语义：输入事件不改变已在进行的回答阶段）。

> 如实说明：`/api/merchant/assistant/query` 仍整包返回（无 SSE）。逐字呈现的是同一次真实响应的文本，`response:chunk` 由真实文本的呈现步骤触发；服务端改 SSE 后只需换触发点，粒子侧与舞台侧无需改动。

### 15.7 粒子动作约束

- 轮廓优先：粒子始终贴合程序化头型曲面；`flow` 只是沿轮廓的细流，`pulse` 只有 3.5% 鼓起。
- 小尺寸可辨认：`uCoreHeight` 让着色器在画布 <120px 时等比放大点尺寸（最多 3.0×）并提升浓度（最多 1.9×），32px 小核心不会淡成灰雾；≥120px 的大核心完全不受影响。
- 无闪烁、无持续抖动、无反复缩放：所有目标值经事件通道阻尼 + 引擎二次阻尼（`exp(-dt*7)`）。
- 同一时间只有一个高强度核心；回答结束后能量回落到 0.6 并自然呼吸。
- `prefers-reduced-motion` 下时间轴减速、能量上限降低。

### 15.8 性能与资源

- 全程 1 个 WebGL 上下文；移动不做逐帧 resize，只在落位时 resize 一次。
- 移动用 `transform`（合成层完成），不触发消息列表重排；宿主的 CSS 尺寸在移动期间恒定。
- 32px 时粒子数约 1400（手机 900），GPU 负载与待机小核心同级；页面隐藏（`visibilitychange`）与滚出视口都会停帧。
- 未新增依赖：仍然只用 `webgl2` + `requestAnimationFrame`。

### 15.9 三端状态

| 端 | 状态 |
| --- | --- |
| 电脑网页端（`merchant-admin-web`，含助手面板） | 已完成并线上实测：1440×900 面板内 300px → 32px 连续移动、真实文本同步、多轮不重建（证据见 15.11） |
| 手机网页端（`merchant-admin-mobile`，复用 `MerchantAiHome`） | 已完成并线上实测：390×844 同一链路通过 |
| 商家小程序（`pages/assistant` + `utils/moda-core.js`） | **未接入**：仍只按 `state` 播放，没有对话内嵌小头部与移动。本轮不声称完成 |

桌面全屏聊天页（`创作空间 → 打开` → `MerchantAiHome`）进入的是创作模式（`activeSection='create'`），该页没有对话锚点；本轮线上实测覆盖「手机 Web 全屏聊天 + 桌面助手面板」，桌面全屏聊天页的对话态未单独实机验收（同一组件、同一舞台，差异只在 `lg:` 尺寸类）。

### 15.10 验收标准

1. 空态：核心在首页大核心锚点内，尺寸随布局（手机 234px、桌面面板 300px），只有一个 canvas。
2. 输入：核心聚拢（`contraction` > 0.4），布局不跳动。
3. 发送：核心离开原位、以 `position: fixed` 逐帧移动，尺寸连续变小（不是两步跳变）。
4. 落位：宿主进入当前助手回复首行锚点，32px、`position: absolute`、`transform: none`（原生像素渲染）。
5. 生成中：`responding` 阶段 `flow` 明显，正文持续增长，小头部不逐字抖动。
6. 完成：进入 `idle`，核心留在回复位置，粒子动作减弱。
7. 多轮：核心节点不重建（探针保持），全程只有一个 stage / 一个 canvas。
8. 打字：已落位的回复核心不响应键盘（`contraction` 保持 0）。
9. 失败：真实错误可见，粒子进入 `error` 后回 `idle`，核心仍在回复位置不消失。
10. 长回复：正文首行在头部右侧起排，后续行占满整行宽度（右侧余量 ≤ 20px）。

### 15.11 验证记录

- **发布**：`merchant-admin-web` = `20261027022735458-ee400daa`，`merchant-admin-mobile` = `20261027022747459-9ab092a2`；两者 `dist/apps/*/current.json` 已确认指向对应 release。
- **命令**：`npx tsc --noEmit`（0）、`npx tsx --test tests/merchant-modaui-core.test.ts`（14/14）、`npx tsx scripts/build-app.ts merchant-admin-web|merchant-admin-mobile`（0）。
- **环境**：本地 Chromium + ANGLE/SwiftShader（无 GPU 服务器），`https://ruda.fashion/merchant` 真实登录会话（demo 商家），真实 `/api/merchant/assistant/query`。
- **桌面 1440×900（助手面板）**：idle 300×300 `count=16000`、`stages=1 canvases=1`；focus `contraction=0.76`；移动期间 14 次采样均为 `position=fixed parent=BODY`，尺寸 265.9 → 32.2 连续下降；落位 `reply` 32×32 `count=1400`；responding `flow=0.9 energy=0.95`；settled 为 `idle` 且仍在 `reply`；长回复 4 行、右缘距容器 14px；settled 后打字 `phase=idle contraction=0`；第二轮 `sending → idle` 且探针 `kept`，全程 `stages=1 canvases=1`，无 `pageerror`。
- **手机 390×844（全屏聊天）**：idle 234×234 `count=9000`；移动 234 → 32.8；落位 `reply` 32×32 `count=900`；正文 7 行、右缘距容器 2px；settled `idle`；打字不动核心；第二轮探针 `kept`、`stages=1 canvases=1`，无 `pageerror`。
- **失败路径（故障注入）**：对第二次真实请求注入 500（`FORCED_TEST_FAILURE`），页面显示真实错误文本；核心经历 `sending → error → idle`，落位保持在回复锚点，失败前后均为 `stages=1 canvases=1 cores=1`，核心不消失（本轮修复的缺陷，见下）。
- **录屏**：Playwright 真实录制（非静态截图），`/tmp/moda-v5/video/*.webm`，1440×900 与 390×844 各一段，覆盖首页核心 → 输入 → 发送 → 移动 → 流式文本 → 完成 → 追问。
- **本轮修复的真实缺陷**：请求失败回滚时「思考行锚点」与「回复锚点」短暂并存，旧实现每个 kind 只存一个登记，思考行卸载会删掉回复锚点 → 核心从页面上消失（有截图证据）。现改为：每次渲染重新登记、兄弟锚点即时认领、按舞台 id 从 DOM 自愈。
- **未验证**：小程序；真实麦克风（`listening`）与真实 TTS（`speaking`/`audio:level`）；桌面全屏聊天页对话态；「停止生成」在现有产品中只有切换/新建会话入口（触发 `response:abort`），本轮未做线上点击验证。


### 15.12 V6 对话呈现与删除的粒子影响

- 回复片段改为按自然句子/换行切分（`src/shared/assistantReplyReveal.ts`），每次 `response:chunk` 携带一整段文字：`modaCoreLife` 仍只在事件到达时置 `pulse=1`，因此从“每 1–2 字一次脉冲”变为“每句一次”，不再逐字符跳动，也不延迟真实文本。
- 删除当前承载小头部的回复时，锚点随之卸载；舞台按既有自愈逻辑把同一宿主搬回 hero 锚点，不新建第二个画布。删除由 `DELETE /api/merchant/assistant/messages/:id` 真实完成，失败时消息保留且错误如实显示。
- 本轮未改 `modaCoreEngine`、着色器、粒子预算或锚点优先级；V5 的 `stages=1 canvases=1` 约束不变。
- 注：V7（§16）已重写几何、着色器、引擎与小程序渲染器，本节中「头型」「粒子预算=点数」的表述只对 V6 及更早版本成立。

## 16. V7 神经生命体（2026-10-27）

### 16.1 问题与目标

产品要求：把「全粒子人头」换掉。人头方向天然朝写实人像靠拢，容易落入恐怖谷，也暗示「里面坐着一个人」。V7 改为零依赖的**神经生命体**：细胞球 + 神经纤维 + 沿纤维传导的脉冲 + 内部尘埃，白底灰阶，只保留「感知 → 聚拢 → 传导 → 释放」的抽象生命感。

目标：

1. 主体是一个球状细胞聚集体：数百个半透明细胞、内外两层、有真实前后遮挡，不是一层空心壳。
2. 细胞之间由最近邻神经纤维连接，纤维端点取同一运动函数算出的细胞位置，细胞移动时纤维同步拉伸，不断线不错位。
3. 纤维上有沿路径移动的脉冲点；指针在生命体内按下触发一次冲击波。
4. 白底四阶灰（近黑 / 黑灰 / 中灰 / 浅灰），无彩色、无纯白粒子。
5. 三端同语义：网页 WebGL2 与小程序 Canvas 2D 使用同一随机序列、同一组运动系数、同一透视参数。
6. 零新增依赖：继续禁止 `three` / `@react-three/*` / `ogl` / `regl`。

### 16.2 非目标

- 不做神经元科学仿真（不模拟膜电位、突触权重或图网络动力学）。
- 不保留任何人头残留（`coreParticles.ts` 已删除，仓库内不存在第二个几何来源）。
- 不改 API、数据库、权限、对话业务逻辑、欢迎语、快捷提问与锚点机制。

### 16.3 结构与数量（桌面大核心，预算 16000）

| 层 | 数量 | 生成规则 |
|---|---|---|
| 细胞 | 460 | Fibonacci 球面 + 内外两层（约 78% 在 0.80–0.98，其余 0.32–0.70），尺寸 0.028–0.062 |
| 神经纤维 | 832 条边（1664 顶点） | 每个细胞最近 3 个邻居，`a * count + b` 无向去重；长度决定浓度 0.45–1 |
| 脉冲 | 207 | 复用纤维缓冲，`uFiberPass = 1` 时以 `gl.POINTS` 沿各自相位移动 |
| 内部尘埃 | 480 | 球体内按体积均匀分布（`cbrt(random)`），中灰、提供纵深 |

数量由 `neuralLifeformLayoutForBudget(budget)` 统一换算：`cells = clamp(round(sqrt(budget) * 3.64), 96, 460)`、`dust = clamp(budget * 0.16, 220, 2600)`、`pulses = clamp(cells * 0.45, 36, 220)`。粒子预算不再等于绘制点数，只用于推导结构密度。

### 16.4 三端一致性（硬约束）

- 唯一几何来源是 `neuralLifeform.ts`；`coreShaders.ts` 的 `lifeformPoint()` 与小程序 `animateCell()` 必须逐项镜像 `animateNeuralCell()`（呼吸、细胞级起伏、差速旋转 `swirl`、聆听波纹 `ripple`、语音脉冲、指针鼓起、姿态视差 yaw/pitch）。
- 固定种子 `20261027`；小程序的 `createRandom()` 与 TS 的 `createLifeformRandom()` 是同一算法，且细胞 → 纤维 → 尘埃的取值顺序完全一致，因此三端细胞基点与纤维端点逐点相同。
- 透视参数统一：`FOV = 32°`、`VIEW_DISTANCE = 3.55`、`PROJECTION_SCALE = 0.86`。网页端把 0.86 乘在投影矩阵的 x/y 分量上（w 仍由视距决定），小程序乘在焦距上；生命体半径 1、呼吸峰值约 1.14，0.86 保证峰值时外圈细胞与纤维仍完整落在画布内，不被边缘削平。**注（V8）：0.86 是 V7 的历史值，现由 `BRAIN_BUDGET.projectionScale = 0.76` 单一来源提供，见第 17.5 / 18.4 节。**
- 任何一侧调整系数，必须同时改另外两处；`tests/merchant-modaui-core.test.ts` 已断言 `swirl`、`pointerDir`、`FOV`、`VIEW_DISTANCE` 等关键表达式存在，但语义等价仍需评审。

### 16.5 绘制与性能

- WebGL2：单 VAO、四次 `drawArrays` —— 细胞 `POINTS`、纤维 `LINES`、尘埃 `POINTS`、脉冲 `POINTS`；顶点量约 460 + 1664 + 480 + 414 ≈ 3018，远低于 V6 的 16000 点精灵。
- 脉冲不复制几何：线与脉冲共用同一 VBO，用 `stride = FIBER_STRIDE * 4`（线，连续两顶点）与 `stride = FIBER_STRIDE * 2 * 4`（脉冲，只取每边第一个顶点）区分。
- 混合固定为 `gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)`（预乘普通 alpha）。白底上不能用加法混合，否则整块结构会过曝成一片白。
- 纤维浓度基线 `0.2 + 0.12 * energy`（上限 0.44，点击冲击再 +0.3，脉冲通道 ×2.6），小程序 `inkColor(0.2 + 0.12 * energy)` 同值。基线从 0.12 提到 0.2 是因为实测 320px 核心上纤维几乎看不见，神经网络这一层会丢失。
- 自适应 DPR、离屏暂停、`prefers-reduced-motion` 减速等 V6 策略保持不变。
- 小程序：320×260 画布一帧实测 1336 个 `arc`（细胞 + 光环 + 尘埃 + 脉冲）与 1 次纤维描边批次。

### 16.6 验证记录（真实执行）

- `npx tsc --noEmit -p tsconfig.json` → `TSC_EXIT=0`。
- `node --import tsx --test tests/merchant-modaui-core.test.ts` → `# tests 16 / # pass 16 / # fail 0`（含新增的 `PROJECTION_SCALE = 0.86`、纤维浓度基线两端同值断言）。
- `node --import tsx --test tests/merchant-modagpt-layout.test.ts tests/merchant-miniprogram-ui.test.ts tests/ui-translation-copy.test.ts` → `# tests 22 / # pass 22 / # fail 0`。
- `node --check merchant-miniprogram/utils/moda-core.js` → exit 0。
- **网页端真实 WebGL2 渲染**（headless Chromium + SwiftShader，`WebGL 2.0 (OpenGL ES 3.0 Chromium)`，320×320 画布 @2x，无 `pageerror`）：`idle/thinking/shock/error` 四态各 111–113 帧连续动画；小核心预算下 345 细胞 / 634 纤维 / 1440 尘埃 / 155 脉冲；墨色最深处 luma 66–99、最亮处 255（背景）、通道差 ≤6（纯灰阶）；`ink < 200` 的内容外接框 571×592，距画布边缘 ≥17px，球状轮廓完整不被裁切（改投影留白前外接框贴边 633×637）。
- **小程序 Canvas 2D 真实逐帧**（同一份 `moda-core.js` 在 Chromium 中加载，320×260 @2x，非微信运行时）：`thinking` 与 `success` 两态均持续出帧，`getStats()` = 938 粒子 / 458 细胞 / 832 纤维 / 480 尘埃 / 206 脉冲；墨色最深处 luma 42.7、通道差 ≤7，球体完整落在画布内、四周留白，无 `pageerror`。
- 小程序伪 Canvas 单元测试（`tests/merchant-modaui-core.test.ts` 内）：一帧 1336 个 `arc`，连续 40 帧后 `state` 收敛到页面传入的真实状态。
- `npm run test:unit`（全量）→ `# tests 968 / # pass 968 / # fail 0`，`FULL=0`。
- `npm run build:app:merchant-admin-web` → exit 0，release `20261027201914644-261992e7`；`npm run build:app:merchant-admin-mobile` → exit 0，release `20261027201914639-f15f7850`。产物中 `chunks/MerchantPortal-*.js` 与 `chunks/MerchantMobileApp-*.js` 均含 `lifeformPoint`、`gl_PointCoord` 与新的 0.86 投影常数，且全库已无 `headSurfacePoint`（人头实现彻底移除）。仅构建，未 `publish:app`，生产 `current.json` 未变。

### 16.7 未完成与待验收

- 浏览器验证用的是 headless Chromium + SwiftShader 软件 WebGL2：几何、灰阶、构图与帧循环已核实，但真实 GPU 驱动、真实页面积尺寸（桌面 hero 234–300px、手机全屏、32px 内嵌小核心）下的肉眼观感仍为「代码检查完成，视觉待验收」。
- 微信开发者工具与真机未验收；小程序侧目前只有一份 `moda-core.js` 在 Chromium Canvas 2D 中逐帧渲染的证据。
- 未部署：V7 只在本地源码与构建产物内，生产 `current.json` 仍指向 V6 人头版本。

### 16.8 风险与回滚

- 风险：运动系数在三处重复（两份 GLSL + TS + 小程序，共四份），语义漂移只能靠评审与表达式断言发现 → 已在 §16.4 明确同步义务。
- 风险：小屏低端机每帧 ~1300 次 Canvas 2D 绘制；若掉帧，只需下调 `lifeformLayout()` 的 `MAX_CELLS`（单点可回退），不影响网页端。
- 回滚：本功能的源码全部是未提交文件（`neuralLifeform.ts`、`coreShaders.ts`、`modaCoreEngine.ts`、`merchant-miniprogram/utils/moda-core.js`、测试与文档），回滚 = 恢复这些文件的上一版内容。注意当前工作区本身处于大量未提交状态（`git status` 约 1600 项，且 `merchant-miniprogram/` 整个目录未被 Git 跟踪），因此 Git 历史无法提供回滚点；需要保留 V7 前的文件副本才能退回旧实现。不涉及数据库、接口与配置回滚。

## 17. V7.1 主动生命运动（2026-10-27）

### 17.1 问题与目标

V7 的几何、着色器与渲染已经稳定，但**运动语言只有一层**：所有可见变化都发生在 `lifeformPoint()` 内部（呼吸、细胞级起伏、差速旋转、指针鼓起、姿态视差）。主体不漂移、不前后移动、不独立缩放，因此长时间观看像"固定在原地的呼吸球"，缺少"会思考、会靠近、会整理语言"的生命感。另外，`uLife.y`（提交后前移）直接给 `viewPos.z` 加最多 `0.42`，与 `PROJECTION_SCALE` 无联动，回答态实测会把外圈细胞推到画布边缘。

本轮目标：在**同一个渲染器**里补齐主体级运动，用独立通道描述"在哪、多远、多大、朝哪、内部多活跃"，并让真实对话状态驱动它们。

非目标：

- 不新建第二个 canvas / 第二套 AI 状态 / 第二套对话链路（V5 的 `stages=1 canvases=1` 约束不变）。
- 不引入 Three.js 或任何 3D 库（零依赖守卫不变）。
- 不改粒子几何、配色与灰阶规则；不新增彩色（`#00D2FF` / `#10B981` 与本设计冲突，见 §17.9）。
- 不做拖拽位移：核心是 `pointer-events: none` 的装饰层，拖拽会与页面滚动/选中冲突（见 §17.9）。

### 17.2 能力盘点（升级前真实状态）

| 能力 | 升级前 | 证据 |
|---|---|---|
| 主体在空间中主动漂浮 | **无**。只有内部细胞按 `sin` 起伏，主体中心固定在投影原点 | `coreShaders.ts` `main()` 只有 `viewPos.z -= 3.55`，无 x/y 偏移 |
| 平滑靠近/远离观察者 | **部分**。仅 `life.y` 直推 z，最多 0.42，无边界、与投影预算无关 | `uniform4f(programUniforms.life, ...)` + `viewPos.z += clamp(uLife.y,0,1)*0.42` |
| 独立缩小/放大 | **无**。整体尺寸只由呼吸 `1 + 0.045 sin + 0.02 sin` 决定（±6.5%） | `lifeformPoint()` 的 `scale` |
| 缓慢非重复三维旋转 | **弱**。yaw/pitch 跟随指针 + 固定 `sin` 相位，无慢速自由姿态 | `yaw = uPointer.x * ... + 0.05 sin(t*0.23)` |
| 内部向心聚合/涡流/外扩 | **有**。`contraction`、`swirl`、`flow` 通道真实存在 | `modaCoreLife.ts` + `lifeformPoint()` |
| 状态运动差异 | **弱**。六个状态只改颜色、亮度与收缩量 | `uState[6]` 只进入 `scale` 与 `vAlpha` |
| 真实输入/生成/结束驱动 | **有**。`emit()` 由 `input:focus`、`message:submit`、`response:chunk`、`response:complete` 触发 | `MerchantAiHome.tsx` 调用点 + `modaCoreLife.ts` |

结论：内部粒子运动与状态驱动已真实存在；**主体级位置/深度/尺寸/姿态四类运动缺失**，这是本轮要补的部分。

### 17.3 运动控制器：通道、边界与积分

新增 `modaCoreMotion.ts`（唯一运动编排者，纯函数式、零依赖、可在 Node 中运行）。每帧输出一帧 `ModaCoreMotionFrame`，渲染器只负责把它写进 uniform。**（V8 起该文件已被 `modaBrainBehavior.ts` 取代并删除，历史记录保留；现行契约见第 18 节。）**

独立通道（世界单位，相机在 `z = 0`，主体在 `z = -3.55`，`FOV 32°` → 半屏高 `1.018`）：

| 通道 | 范围 | 说明 |
|---|---|---|
| `x` / `y` | ±0.055 / ±0.048 | 主体在画面中的横向/纵向漂移（约 ±5% 半屏） |
| `depth` | −0.15 … +0.18 | 沿视线的前后位移，真实影响透视尺寸（近 3.37 / 远 3.70） |
| `scale` | 0.90 … 1.05 | 主体自身尺寸，**与 depth 相互独立** |
| `tiltX` / `tiltY` / `tiltZ` | ±0.075 / ±0.10 / ±0.035 rad | 三维倾斜（最大约 5.7°） |
| `energy` | 0 … 1 | 运动活跃度（驱动漂流与事件幅度，不驱动颜色） |

每个通道都有独立的**目标值 + 速度 + 临界阻尼弹簧**（`omega` 1.3–1.7 rad/s，`zeta 0.92`，速度上限 0.16–0.5 /s），因此：

- 状态切换时继承当前位置与速度，**不会重置回原点**；
- 目标变化先加速后减速，没有线性突跳；
- 单帧 `dt` 上限 0.05s，掉帧时也不会一步跳到目标。

`swirl`（内部差速旋转）、`breath`（内部呼吸）与主体运动**互不覆盖**：前者在 `lifeformPoint()` 内、后者在 `main()` 之后，串行组合。

### 17.4 目标编排：低频漂移 + 单一运动事件

1. **低频漂移**（永不重复）：三条互不整除的正弦（周期 20.2s / 35.7s / 52.4s 量级，种子相位固定）叠加成 `x`、`y`、`tiltX/Y` 的缓慢目标。待机时也存在，只是幅度小。
2. **运动事件**（一次只跑一个，避免脚本互相争抢同一通道）：由固定种子 PRNG（`20261027`）按状态选择，形如
   - `approach` / `retreat`：`depth` 目标 ±(0.6–1)×范围，持续 1.2–2.2s；
   - `contract` / `expand`：`scale` 目标 ∓(0.04–0.06)，持续 1.1–2.2s；
   - `tilt`：`tiltX/tiltY` 目标 ±(0.4–1)×范围，持续 1.8–2.8s；
   - `drift`：`x/y` 目标 ±0.03–0.05，持续 2–3s。

   事件用 Hermite 平滑包络（前 32% 升、后 38% 降）乘到目标上，事件结束目标自然回落到漂移基线；同一时刻不会有两个事件改写同一通道。

   状态决定事件权重与节奏：待机 3.2–6.0s（漂移/倾斜为主）、感知 2.4–4.2s（收缩/漂移）、思考 1.5–3.0s（approach + contract + tilt）、回答 2.0–3.4s（expand + tilt + retreat）、失败 5.0–8.0s（retreat）。

4. 状态偏置（确定性签名，不依赖随机事件）：`forward` 以 `×0.14` 折算进 `depth`；`responding` 额外 +0.02 深度与 +0.025 尺寸（舒展）；`thinking` −0.02 尺寸（向内聚合）；`error` −0.03 深度。指针以 `tiltY += pointerX × 0.05`、`x += pointerX × 0.012` 产生克制的视线跟随；点击冲击给 `depth`/`scale`/`y` 一个**速度冲量**（不是位移跳变）。

没有这些偏置时，"思考 vs 回答"的运动差异完全取决于 PRNG 恰好抽到哪个事件，实测 16s 窗口里可能抽不到 `expand`，两种状态看起来一样——这正是"时有时无的假差异"，因此改为确定性偏置 + 随机事件叠加。

`prefers-reduced-motion`：漂移与事件强度乘 0.3（事件强度在 `startEvent` 里乘，不只是漂移幅度），`depth` 事件权重降到 0.2，时间推进放慢 0.6×，`tiltZ` 不放大。

### 17.5 构图预算：投影留白 + 软限幅

主体运动必须与构图预算联动，否则"靠近 + 放大"会在峰值时裁切球体。定义（世界单位，避免与投影系数耦合）：

- `VISIBLE_HALF_HEIGHT = tan(16°) × 3.55 = 1.018`
- `PROJECTION_SCALE = 0.76`（V7 的 0.86 下调）
- `BASE_RADIUS = 1.05`：中性态结构外接半径（半径 1 的球体 + 呼吸峰值）
- `ACTIVITY_GAIN = 0.075`：内部 `energy/success/pulse` 会让结构再外扩约 7.5%
- `MAX_EXTENT = 0.94`：任何状态下的硬上限
- `BLEED_PX = 3`：点精灵的像素半径，32px 小核心会被 `smallBoost` 放大

外接与限幅：

```
extent = (BASE_RADIUS × (1 + ACTIVITY_GAIN × activity) × scale × 3.55/(3.55−depth) + max(|x|,|y|))
         / 1.018 × PROJECTION_SCALE
shrink = extent > cap ? cap / extent : 1        // 输出 scale 与 x/y 同时乘 shrink
cap    = min(MAX_EXTENT, (size/2 − BLEED_PX) / (size/2))   // size = 画布 CSS 边长
```

三点经验（都由真实截图逼出来，不是先验推导）：

1. 第一版 `BASE_EXTENT = 0.85` 只按中性态标定，回答态实测外接 0.927，右/上边距 0px → 必须按**峰值**标定。
2. 第二版把上限从 0.945 收紧到 0.94 后回答态仍有 3px 边距；同时发现"思考 vs 回答"的尺寸差异被限幅吃掉（回答态 `scale` 反而更小）→ 说明**留白不足时，限幅会先吃掉状态表达**，因此把基础投影再降到 0.76，让 5.5% 的舒展能完整呈现。
3. 32px 内嵌核心的裁切不是几何问题而是像素问题（`smallBoost` 让点精灵半径在屏幕上放大 2–3 倍）→ 增加 `setViewport()` 按 CSS 像素收紧 `cap`。

限定后的实现（`320px` 画布，实测见 §17.8）：中性外接 ≈0.85、回答态 ≈0.89、峰值被限在 0.94，任何组合都不贴边。

### 17.6 三端一致性（硬约束）

- 运动常量集中在 `modaCoreMotion.ts` 的 `MOTION_LIMITS` / `MOTION_BUDGET`；小程序 `moda-core.js` 的 `MOTION_LIMITS` / `MOTION_BUDGET` 必须逐项同值，`tests/merchant-modaui-core.test.ts` 断言数值相等（不是"存在即通过"）。**（V8：常量改名为 `BRAIN_LIMITS` / `BRAIN_BUDGET` 并移入 `modaBrainBehavior.ts`，小程序同名常量逐项同值，见第 18.7 节。）**
- 网页端把 `x/y` 加在 `viewPos` 上、`depth` 加在 `viewPos.z` 上、`scale` 乘在生命体坐标上、倾斜用 `rotateZ·rotateX·rotateY` 作用在同一坐标上；小程序在 `animateCell()` 之后做同一组变换，再按 `focal / (3.55 − z − depth)` 投影，因此两端的"近大远小"来自同一公式。
- 小程序没有指针与冲击事件：`pointerX/Y` 恒为 0、`burst` 恒为 0，公式不变。
- 统一运动算法只在两处（TS + 小程序 JS）镜像，事件 PRNG 与种子相同，因此同一状态序列下两端的运动轨迹一致。

### 17.7 验收标准

必须全部满足才算完成：

1. 待机 6s 内，主体中心位移可见（≥3px @300px 核心），且不再恒定在同一点。
2. `depth` 与 `scale` 独立：两者时间序列的相关系数 < 0.9，且单独出现"只近不变大""只大不靠近"的时段。
3. 状态切换（idle→thinking→responding→idle）逐帧最大跳变：`x/y` ≤ 0.004、`scale` ≤ 0.01、`depth` ≤ 0.012（对应 < 1.5px @300px）。
4. 任何时刻 `extent ≤ 0.945`；四态截图 `ink < 200` 外接框距画布边缘 ≥ 8px（320px 画布）。
5. `thinking` 与 `responding` 的运动签名可区分：思考以 approach+contract 为主（均 depth 偏正、scale 偏小），回答以 expand+retreat+tilt 为主（scale 偏大、tilt 幅度更大）。
6. 灰阶不变（通道差 ≤ 8）、零 `pageerror`、帧循环连续。
7. 32px 内嵌核心：主体运动在屏幕上不足 1px，允许不可见，但内部结构必须仍在动且不裁切（在 §17.8 记录该边界）。

### 17.8 验证记录（真实执行）

**编译与测试**

- `npx tsc --noEmit -p tsconfig.json` → `TSC=0`。
- `node --import tsx --test tests/merchant-modaui-core.test.ts` → `# tests 22 / # pass 22 / # fail 0`（新增 6 条：确定性+边界、状态切换无跳变+待机漂浮 ≥3px、通道独立+状态签名、减弱动效、三端常量同值、小画布收紧）。
- `npm run test:unit`（全量）→ `# tests 974 / # pass 974 / # fail 0`。
- `node --check merchant-miniprogram/utils/moda-core.js` → exit 0。

**网页端真实 WebGL2**（headless Chromium + SwiftShader，`WebGL 2.0 (OpenGL ES 3.0 Chromium)`，无 `pageerror`；每个场景 1310–1320 帧连续采样 ≈22s，帧间隔 16.6–16.8ms；时间线为 `待机 5s → 输入 → 提交 → 40×流式片段 → 完成 → 待机 3s`，全部由真实 `createModaCoreLife` 事件驱动）

| 场景 | 中心位移范围 | 前后深度 | 自身尺寸 | 倾角范围 | 外接峰值 | 最小边距（截图） |
|---|---|---|---|---|---|---|
| 桌面 300px | x 14.2px / y 10.6px | 0.1285 | 0.038 | 8.59° | 0.891 | 19 设备px = **9.5 CSS px** |
| 桌面 234px | x 12.1px / y 8.8px | 0.1285 | 0.038 | 8.38° | 0.897 | 同上比例 |
| 内嵌 32px | 主体位移 < 1px（不可见，符合预期） | — | — | — | 0.688（`setViewport` 收紧） | 6 设备px = **3 CSS px** |
| 手机 390 视口 | x 15.5px / y 11.3px | 0.1285 | 0.038 | 8.38° | 0.897 | 32 设备px = **16 CSS px** |

- 单帧最大跳变：`x 0.0007 / y 0.0004 / depth 0.0011 / scale 0.0005 / tiltY 0.0005`（换算 **0.1px**），状态切换处没有突跳，说明弹簧继承了速度与位置。
- 待机 5s 内中心位移范围 12.0px（300px 核心），不存在"长时间停在同一点"。
- 状态签名可区分：思考 `scaleMean 0.980 / depthMean 0.0879 / tiltSpan 0.044 rad (2.5°)`；回答 `scaleMean 1.0018 / depthMean 0.1073 / tiltSpan 0.104 rad (6.0°)` —— 回答态确实更大（视觉尺寸含透视放大 **+3%**）、更近、姿态摆动幅度 2.4 倍。
- 灰阶：`maxChroma ≤ 5`（三态截图），背景纯白（luma 255），无彩色溢出。
- 墨色覆盖：idle 27.4%、thinking 24.6%、responding 30.5%，结构完整、无空洞、无贴边。

**小程序真实 Canvas 2D**（同一份 `merchant-miniprogram/utils/moda-core.js` 注入 Chromium，320×260 @2x + 32×32 @2x 两个画布并行；`EXIT=0`，无 `pageerror`）

- 938 粒子（458 细胞 / 832 纤维 / 480 尘埃 / 206 脉冲），250 帧连续绘制。
- 运动范围：x 0.055（≈19px）、尺寸 0.0405、倾角 0.093 rad（5.3°）、外接峰值 0.870（未触发限幅）；回答态 `scaleMean 0.9988 > 思考 0.9833`。
- 32×32 画布：`extent` 精确停在 `0.6875 = (16 − 5) / 16`，说明 `setViewport()` 的像素让位在 Canvas 2D 端同样生效；截图四周边距 ≥44 设备px（320 画布）。
- 灰阶通道差 ≤8。

**验收中真实发现并修掉的三个问题**（不是设计阶段就能预见的）

1. 首轮截图回答态 **右/上边距 0px**：`BASE_EXTENT` 只按中性态标定，低估了内部能量带来的 5.7% 外扩 → 改为按活动度补偿的结构外接模型。
2. 收紧上限后回答态只剩 3px 边距，且"回答更舒展"被限幅吃掉（`scale` 反而更小）→ 基础投影从 0.86/0.82/0.80 逐级降到 **0.76**，并用"视觉尺寸 = scale × 透视放大"作为验收指标，确保表达不被留白挤掉。
3. 32px 内嵌核心贴边：原因不是几何而是**点精灵像素半径**（`smallBoost` 放大 2–3 倍）→ 新增 `setViewport()` 按 CSS 像素收紧；`bleedPx` 从 3 提到 5 后边距从 0.5px 提升到 3px。

**构建与发布**

- `npm run build:app:merchant-admin-web` → exit 0，release `20261027211629658-012b9316`（产物 `chunks/MerchantPortal-*.js` 含 `uBodyTilt` 与 `bodyTransform`、`0.76`）。
- `npm run build:app:merchant-admin-mobile` → exit 0，release `20261027211707148-a145d204`（`chunks/MerchantMobileApp-*.js` 含 `uBodyTilt`）。
- `npm run publish:app merchant-admin-web 20261027211629658-012b9316` / `npm run publish:app merchant-admin-mobile 20261027211707148-a145d204` → 均 published；生产 `GET /apps/merchant-admin-web/current.json` 返回新 release，`GET /apps/merchant-admin-web/releases/.../chunks/MerchantPortal-BTTncoCZ.js` 里 `uBodyTilt` 出现 9 次、`bodyTransform` 4 次，`GET /merchant` = 200。
- `npm run smoke:post-deploy` → **失败**：`POST_DEPLOY_SMOKE_ROOT_REDIRECT_INVALID_302_/merchant`。原因是生产 `/` 现在 302 到 `/merchant`，而脚本 `isExpectedPrimaryRootRedirect()` 要求 302 到 `/it/`。该检查针对公共站根路径，与本轮 ModaUI 改动无关（本次未改服务端路由/nginx），属于既有环境与脚本期望不一致，需要产品/运维确认根路径策略后再修脚本或站点配置。
- 回滚：`npm run rollback:app merchant-admin-web` / `merchant-admin-mobile`（publish 已写出 `current.previous.json`）。小程序未上传（无微信密钥），需在开发者工具中另行上传。

### 17.9 与需求文本的差异（有意为之）

需求文本里包含三项与 RUDA 现行铁规冲突的内容，本轮**没有实现**，理由如下：

1. **思考用 `#00D2FF`、回答用 `#10B981` 的彩色活动**：`AGENTS.md` 第 5.1 节要求沿用高级黑白/中性灰体系，V6/V7 的生命体也明确"白底灰阶、无彩色"。彩色会立刻把这块 UI 变成科技蓝绿风格，属于产品级视觉决策，不能由实现方顺手引入。当前用**运动语言 + 结构密度 + 纤维浓度 + 聚合度**区分状态；若产品确认要彩色，需要单独的设计变更与对比度验收。
2. **拖拽大脑**：核心 canvas 是 `pointer-events: none` 的装饰层，且宿主元素由 `ModaCoreStage` 在「首页大核心 ↔ 回复内 32px 小核心」之间搬迁（`position: fixed` + transform）。允许拖拽会同时破坏页面滚动/文本选择、锚点落位契约，并产生"拖出视口找不回来"的状态。因此保留已有交互：点击冲击波（速度冲量）、指针视差与局部鼓起、视线倾斜。
3. **鼠标靠近的磁性排斥**：同上，装饰层不接收指针事件；仅通过 `document` 级 `pointermove` 做姿态跟随。

另外两处实现选择：

- **不动相机，只动主体**：`depth` 直接改 `viewPos.z`，`scale` 改模型尺寸，两者独立。移动相机会让所有透视关系一起变，且不同画布尺寸下角速度不一致，容易出现"突然变焦"。
- **小程序不假装三维**：没有深度缓冲，但使用与世界坐标同一套 `bodyTransform` + `focal / (3.55 − z)` 透视除法，细胞按视深排序绘制，因此近大远小、前后遮挡与网页端同源，只是没有逐像素球面着色。

### 17.10 复现方式（验收脚本）

- WebGL：`/tmp/moda-harness2/entry.ts`（import 真实 `modaCoreEngine` + `modaCoreLife`）→ `npx esbuild ... --bundle` → `run.mjs`（Playwright + SwiftShader）在 `300 / 234 / 32` 三种画布尺寸与手机 `390×844` 视口下跑 `idle → 输入 → 提交 → 流式片段 → 完成 → 待机`，逐帧采样 `getStats().motion`，输出位置/深度/尺寸/倾角变化范围、单帧跳变、外接占比与截图边距。
- 小程序：`/tmp/moda-harness2/mini.mjs` 把真实 `merchant-miniprogram/utils/moda-core.js` 注入 Chromium Canvas 2D，同时挂 320×260 与 32×32 两个画布，采样 `motion` 并截图。
- 单元：`node --import tsx --test tests/merchant-modaui-core.test.ts`（确定性、边界、无跳变、通道独立、状态签名、减弱动效、三端常量同值、小画布收紧）。



## 18. V8 自主数字生命引擎（BrainBehaviorController，2026-10-27）

状态：**部分完成**。代码完成，`tsc` 0、`merchant-modaui-core` 26/26、全量单测 978/978、小程序 `node --check` 0；桌面/手机/内嵌/小程序 Canvas 2D 已录制真实运行（§18.8）；真实 GPU 观感与微信真机仍待验收，生产未发布。V8 取代 §17 的运动层，§17 的通道/边界/构图结论继续有效（数值被 §18.4 覆盖）。

### 18.1 问题与目标

V7.1 已经有独立的运动通道，但运动语言仍然"小、快、均质"：位移最大 14px、事件由随机权重抽取、没有冷却与重复抑制、没有"先移动到一个新位置再停留"的大动作，运动完全由聊天状态驱动（不聊天时几乎不动），呈现模式（自由舞台 / 回答头像）对运动层不可见。用户要求 ModaUI 成为"持续存在、能自由活动、表现认知行为"的数字生命核心，而不是固定位置的装饰图标。

目标：

1. 单一 `BrainBehaviorController` 统一决定主体位置、屏幕投影、深度、整体尺寸、三轴姿态、运动速度与惯性、内部神经/粒子/纤维/脉冲强度、聊天状态引发的行为、运动边界与性能降级。
2. 取消固定位置：大脑在舞台内持续自主运动，具备微观（呼吸/姿态/神经脉冲）、中观（漂浮/游移/慢转）、宏观（明显换位、靠近、后退、缩放）三个尺度。
3. 行为状态机（Idle / Listening / Thinking / Responding / Completed / Error-Cancelled）驱动**行为**而不只是颜色；状态切换继承当前位姿与速度。
4. 目标导向的行为选择：按状态权重、上一步动作、运动能量、空间边界选择下一步；带冷却、重复抑制、宏观动作后的停顿。
5. 呈现解耦：自由舞台与回答头像用同一控制器、同一渲染器，通过显式呈现模式与既有宿主搬迁过渡完成切换，不用新建组件、不重置位姿。
6. 三端一致 + 生产级：真实帧时间、页面隐藏降载、`prefers-reduced-motion`、设备性能降级、所有参数有界。

### 18.2 非目标

- 不伪造模型内部推理过程：行为只由真实请求状态、流式片段、语音生命周期驱动（沿用 §14 的 `modaCoreLife` 事件通道）。
- 不引入 three.js / R3F / 任何新依赖，不新增第二个渲染器、第二个动画循环、第二条聊天事件链路。
- 不让大脑拦截页面指针事件（canvas 仍是 `pointer-events: none`）；不做可拖拽大脑（见 §17.9）。
- 不改商品、订单、库存、登录、权限、计费、数据库与任何 API。

### 18.3 复用与防重复（V8 查重结论）

| 已有能力 | 复用方式 | 说明 |
| --- | --- | --- |
| `modaCoreEngine.ts`（单一 WebGL2 渲染器） | 原地扩展 | 只增加 `uCognition` uniform 写入与呈现模式输入，不新建渲染路径 |
| `modaCoreLife.ts`（真实聊天事件 → 连续数值） | 原样复用 | V8 只读取其 `energy/forward/flow/pulse`，不改事件契约 |
| `neuralLifeform.ts` / GLSL `lifeformPoint()` | 原样复用 | 内部细胞形变保持唯一实现；V8 只在主体级叠加 `uCognition` 的三项微调 |
| `modaCoreStage.ts`（单画布跨容器搬迁） | 原样复用 + 新增模式订阅 | 呈现模式来自舞台，不新建第二套布局逻辑 |
| `modaCoreMotion.ts`（V7.1 运动控制器） | **被取代并删除** | 通道与边界思路保留，逻辑迁入 `modaBrainBehavior.ts`；避免两套运动权威 |
| 小程序 `utils/moda-core.js` | 镜像替换 `createMotion` | 同行为集、同常量、同语义，Canvas 2D 简化绘制 |

### 18.4 契约

新增文件 `src/apps/merchant-admin-common/components/merchant/modaui/modaBrainBehavior.ts`（唯一运动与行为权威）：

```ts
BRAIN_SEED = 20261027
BRAIN_LIMITS = { offsetX, offsetY, depthNear, depthFar, scaleMin, scaleMax, tiltX, tiltY, tiltZ }
BRAIN_BUDGET = { viewDistance, visibleHalfHeight, projectionScale, baseRadius, activityGain, maxExtent, bleedPx, travelRadius }
createModaBrainBehavior(): {
  update(dt, input): BrainBehaviorFrame
  getFrame(): BrainBehaviorFrame
  setViewport(sizeCss): void
  setQuality('high' | 'low'): void
}
```

`BrainBehaviorInput`：六状态权重、`energy`、`forward`、`pulse`、`burst`、`pointerX/Y`、`presentation: 'stage' | 'inline'`、`reduced`。

现行取值（与小程序逐项同值，测试断言相等）：`BRAIN_LIMITS = { offsetX: 0.28, offsetY: 0.2, depthNear: 0.2, depthFar: -0.2, scaleMin: 0.86, scaleMax: 1.1, tiltX: 0.13, tiltY: 0.18, tiltZ: 0.055 }`；`BRAIN_BUDGET = { viewDistance: 3.55, visibleHalfHeight: 1.018, projectionScale: 0.76, baseRadius: 1.05, activityGain: 0.075, maxExtent: 0.94, bleedPx: 5, travelRadius: 0.92 }`。300px 画布上 1 世界单位 ≈ 112px，因此横向可用行程约 ±27px、纵向 ±20px。

`BrainBehaviorFrame`：`x, y, depth, scale, tiltX/Y/Z`（主体位姿）、`energy`（运动能量）、`speed`（世界单位/秒）、`extent`（构图外接占比）、`behavior`（行为 id）、`kind: 'micro' | 'mid' | 'macro'`、`progress`、`dwelling`、`dynamics: { agitation, cohesion, outflow, pulse }`。

行为集（`brainBehavior`，11 项）：

| id | 尺度 | 语义 | 冷却 |
| --- | --- | --- | --- |
| `drift` | micro | 小幅游移 | 0 |
| `tilt` | micro | 姿态调整 | 0 |
| `settle` | micro | 停顿/沉降 | 0 |
| `approach` | mid | 靠近观察者 | 3.2s |
| `retreat` | mid | 后退 | 3.2s |
| `contract` | mid | 内部收拢 | 3.2s |
| `expand` | mid | 舒展 | 3.2s |
| `focus` | mid | 思考聚焦（朝向 + 聚合） | 3.2s |
| `radiate` | mid | 回答向外传能 | 3.2s |
| `recoil` | mid | 失败/取消的明确反馈 | 4.0s |
| `travel` | macro | 换位（新锚点 + 停留） | 8.5s |

渲染契约：两个 GLSL 程序新增 `uniform vec4 uCognition`（x 激活、y 聚合、z 外传、w 自主脉冲）。渲染器新增 `setPresentation({ mode })`；`getStats().motion` 增加 `behavior / kind / speed / dwelling / dynamics`。

小程序镜像同一语义，但只有单层圆点、没有逐像素球面着色，因此 `dynamics` 的增益取网页端的一半（细胞 `1 + 0.06·agitation + 0.05·pulse`、纤维 `1 + 0.08·agitation`），避免整团发闷；聚合系数与脉冲外传系数保持同值。

### 18.5 状态、边界与错误处理

- 状态切换：继承位姿与速度，不重置；行为可按新状态立即改选，但当前动作以包络收尾，不硬切。
- 边界：`|x| ≤ offsetX`、`|y| ≤ offsetY`、`depth ∈ [depthFar, depthNear]`、`scale ∈ [scaleMin, scaleMax]`、三轴倾角各有上限；`travel` 目标点在椭圆内采样并以 `travelRadius` 收缩。
- 构图：`extent = (baseRadius·(1+activityGain·activity)·scale·depthFactor + max(|x|,|y|)) / visibleHalfHeight · projectionScale ≤ extentCap`；超限时只收缩尺寸，不回收位移（大脑可以真的走到边缘，但会略微变小）；`extentCap` 由 `setViewport()` 按 `bleedPx` 收紧。
- 降级：`setQuality('low')` 降低行为频率与幅度、禁用 `travel`；引擎在帧时间长期超预算时调用；页面隐藏/不在视口时渲染器停止（`start()` 清零 `lastFrame`，恢复后不跳变）。
- 无障碍：`prefers-reduced-motion` 时幅度 ×0.3、时长 ×1.5、禁用宏观换位、内部动态减半。

### 18.6 影响范围

仅 `modaui/` 组件目录、小程序 `utils/moda-core.js` 与本组测试/文档。无 API、无数据库、无权限、无租户边界变化。桌面 Web 与手机 Web 共用同一共享组件，因此两端同时生效；小程序通过同一行为语义镜像。

### 18.7 测试与验收标准（P6）

1. 单元：确定性、全通道边界、单帧无跳变、状态继承、行为覆盖与重复抑制、冷却生效、帧率无关（30fps vs 120fps）、减弱动效、呈现模式、三端常量同值。
2. 真实运行：≥60 秒连续录制，至少 3 轮完整对话（待机→输入→思考→流式回答→完成→回到待机），统计主体位移、视在尺寸、速度、行为序列、状态切换、帧时间、构图外接与最小边距。
3. 桌面 Web（234/300px）、手机 Web（390×844）、小程序 Canvas 2D 分别验收；单帧截图与编译通过不作为验收依据。
4. 判据：待机期间持续位移 ≥ 40px（300px 核心，实测 47.7px）；宏观换位待机 60s ≥ 2 次、85s 混合对话 ≥ 3 次；靠近与远离的视在尺寸差 ≥ 6%（实测 12.8%）；思考与待机行为签名不同（`cohesion` 0.50 vs 待机约 0.1、`agitation` 0.85 vs 0.27）；回答期间 `outflow` ≥ 0.7；无越界（`extent ≤ 画布上限`）、单次采样位移 ≤ 2px、无失控速度。

### 18.8 验证记录（真实执行，2026-10-27）

**单元 / 类型**

| 命令 | 结果 |
| --- | --- |
| `npx tsc --noEmit` | 0 错误 |
| `node --import tsx --test tests/merchant-modaui-core.test.ts` | 26 / 26 通过（新增 10 项 V8 断言：确定性/边界、状态继承与单帧 ≤2px、待机 60s 自主性、多轮不重复、深度与尺寸独立+状态签名、30fps↔120fps 一致、减弱动效、内嵌模式无宏观换位、32px 构图、三端常量与接线） |
| `node --check merchant-miniprogram/utils/moda-core.js` | 0 错误 |
| `npm run test:unit` | 见本节末尾（全量套件） |

**真实运行录制（WebGL2，SwiftShader 软件光栅；真实 `modaCoreEngine` + 真实 `modaCoreLife` 事件序列：待机 → 输入 → 提交 → 思考 → 25 个真实流式片段 → 完成 → 待机；其中一轮走 `response:error`）**

| 场景 | 时长 | 渲染帧率 | 横向位移 | 纵向位移 | 宏观换位 | 行为种类 | 停顿占比 | 视在尺寸差 | 外接峰值 | 画布最小边距 | 最大彩度 | 页面错误 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 桌面 300px（460×460 视口） | 85.6s | 61.2fps | 47.7px | 27.1px | 3 次 | 11/11 | 19.2% | 12.8% | 0.94 | 8.5 CSS px | ≤6 | 0 |
| 手机 Web 390×844，300px 核心 | 85.6s | 61.2fps | 48.0px | 26.8px | 3 次 | 11/11 | 19.2% | 12.7% | 0.94 | 14 CSS px | ≤5 | 0 |
| 回答内嵌 32px | 40.2s | 62.2fps | 4.0px | 3.2px | 0（按设计禁用） | 8/11 | 14.6% | 21.9% | 0.6875 = 画布上限 | 3 CSS px | ≤5 | 0 |
| 小程序 Canvas 2D 320×260（+32×32） | 65.3s | rAF | 41.3px | 27.5px | 3 次 | 10/11 | 18.0% | 15.3% | 0.94 / 小核心 0.6875 | — | ≤9 | 0 |

补充观测：

- 单次 100ms 采样最大位移桌面 0.43px、内嵌 0.01px：没有任何跳变或瞬移。
- 平均速度 3.73px/s、峰值 25.7px/s（300px 核心）；行为切换 28 次、**最长连续重复 1**（重复抑制生效）。
- 状态签名：思考 `cohesion` 0.50 / `agitation` 0.85，待机 `agitation` 0.27，回答 `outflow` 0.736（小程序 0.691 / 思考 0.471）。
- 视频文件（均真实录制，非截帧拼接）：`/tmp/moda-v8/out/desktop-300.mp4`（88.0s）、`mobile-390.mp4`（88.0s）、`inline-32.mp4`（42.7s）、`mini.mp4`（67.7s）；指标 JSON：`web-metrics.json`、`mini-metrics.json`。
- 复现脚本：`/tmp/moda-v8/entry.ts`（import 真实引擎 + 生命通道）→ `npx esbuild … --bundle` → `run.mjs` / `mini.mjs`（Playwright + SwiftShader，`recordVideo` 实时录制 + 100ms 采样 + `sharp` 逐像素边界与彩度检查）。

**未覆盖（必须如实标注）**

1. 未在真实 GPU（硬件 WebGL2）上录制：本机无显示服务器，全部运行在 SwiftShader 软件光栅下；真实 GPU 的观感与帧率需要现场复看。
2. 未在微信开发者工具 / 真机运行小程序：仅用 Chromium Canvas 2D 跑同一份 `utils/moda-core.js`；真机触控与设备像素比表现仍属"待验证"。
3. 未发布生产：本轮无发布授权，`merchant-admin-web` / `merchant-admin-mobile` 构建产物未发布；生产仍是 V7.1。
4. 交互式对话（真实打字、流式 SSE、语音播报）未在页面里逐字验证：本轮用真实事件方法驱动同一状态机，页面级链路沿用既有测试（V5 起未改动）。


### 18.9 迁移与回滚

- 迁移：`modaCoreMotion.ts` 的导出被 `modaBrainBehavior.ts` 取代（`MOTION_*` → `BRAIN_*`）；引擎与测试同步改名；小程序同名常量同步。V7.1 的已发布产物为静态文件，不受影响。
- 回滚：源码层回到 V7.1 的 `modaCoreMotion.ts`（构建产物已存在 release `20261027211629658-012b9316` / `20261027211707148-a145d204`）；生产回滚用 `npm run rollback:app`。
- 未获明确授权前不发布生产版本。

