# RUDA 商家微信小程序

这是独立于买家小程序的原生微信小程序工程。当前审核版提供工作台、商品、订单和更多商家业务模块。ModaUI、虚拟试衣和智能员工功能在小程序审核通过前隐藏，相关页面源码保留但不注册、不进入导航；审核通过后再按需恢复。重新申请 AI 相关功能审核时，还应先更新用户服务协议和隐私政策，明确 AI 输出可能不准确、用户提交内容及图片会如何处理，以及相关第三方模型服务的数据使用方式，完成隐私保护指引配置和审核要求后再开放。商家/员工登录、商品/订单/库存及各业务数据均通过现有 RUDA 商家 API，并继续由服务端租户和员工权限校验。

## 在微信开发者工具中运行

打开 `merchant-miniprogram/` 目录。商家后台/API 使用 `https://ruda.fashion`，公开店铺和企业注册页面使用 `https://modaui.com`。微信公众平台当前 AppID（`wx18abf078e13f9f0a`）必须配置以下服务器域名：

- **request 合法域名**：`https://ruda.fashion`。店铺和头像/商品图使用签名 `PUT` 请求直传对象存储；当前实际签名上传主机为 `https://ruda888.5c30b9d637c252b8faf821fddfa4be04.r2.cloudflarestorage.com`，也必须加入 request 合法域名。
- **download 合法域名**：`https://images.ruda.fashion`，用于加载商家公开图片。
- **web-view 业务域名**：`https://modaui.com`，用于企业注册页面。
- **uploadFile 合法域名**：当前实现不调用 `wx.uploadFile`；只有后续改用该 API 时才需配置对应域名。

域名前提：微信只接受已完成 ICP 备案的域名作为 request/download/web-view 域名。`ruda.fashion` 与 `modaui.com` 当前解析到境外服务器（`95.232.251.69`），若域名未备案，微信公众平台保存服务器域名时会提示域名未备案，无法加入白名单。此时不得用关闭校验的方式上线，需要改用已备案域名反向代理到同一服务端，或通过微信云托管/云开发网关转发到现有 API；切换 API 主机只需改 `utils/constants.js` 的 `API_BASE_URL`，业务接口和租户校验不变。

遇到“`https://ruda.fashion` 不在 request 合法域名列表中”时按顺序检查：

1. 开发者工具左上角 AppID 是否为 `wx18abf078e13f9f0a`，当前登录微信号是否是该 AppID 的管理员或开发者。
2. 微信公众平台 → 开发管理 → 开发设置 → 服务器域名，确认 request 合法域名已保存 `https://ruda.fashion` 和对象存储签名上传主机，download 合法域名已保存 `https://images.ruda.fashion`。
3. 开发者工具“详情 → 域名信息”点击刷新，然后重新编译。
4. 在控制台执行 `wx.request({ url: 'https://ruda.fashion/api/health', success: r => console.log(r.statusCode) })`，返回 `200` 说明白名单对当前 AppID 已生效。

本地联调可临时在“详情 → 本地设置”勾选“不校验合法域名、web-view（业务域名）、TLS 版本以及 HTTPS 证书”。该开关只影响开发者工具，真机、体验版和正式版仍受白名单约束，不能作为上线方案。

如果公众平台里已经能看到上述域名，开发者工具仍报同样的错误，按以下顺序排查：

1. **AppID 不一致**：商家工程使用 `wx18abf078e13f9f0a`，买家工程使用 `wx6b3419072f3934d2`，服务器域名只对配置它的那个 AppID 生效。在控制台执行 `wx.getAccountInfoSync().miniProgram`，确认 `appId` 与后台当前编辑的小程序一致；`utils/api.js` 的失败日志也会打印 `appId`、`url` 和 `envVersion`。
2. **域名信息未刷新**：新增或修改域名后，需在“详情 → 域名信息”点击刷新并重新编译；必要时关闭项目、重新扫码登录开发者工具。
3. **生效延迟**：后台保存后通常需要数分钟同步，期间仍可能被拦截。
4. **本地校验开关**：`project.config.json` 与 `project.private.config.json` 中 `urlCheck` 为 `true` 时开发者工具严格校验，联调时可临时关闭。

## 微信消息推送服务器

服务端接收地址为 `https://ruda.fashion/api/wechat/miniprogram/message-push`，支持微信 GET URL 校验，以及 XML/JSON 格式的 POST 推送。接口会校验签名；安全模式下还会解密消息并核对小程序 AppID，然后返回 `success`。当前接口只负责验证、接收并确认消息，不执行具体事件的业务处理。

在服务端密钥配置中设置 `WECHAT_MINIPROGRAM_MESSAGE_TOKEN`（3–32 位英文字母或数字），并与微信后台 Token 完全一致。推荐后台选择“安全模式”，将后台生成的 43 位 EncodingAESKey 设置为 `WECHAT_MINIPROGRAM_MESSAGE_AES_KEY`，并设置 `WECHAT_MINIPROGRAM_MESSAGE_ENCRYPTION_MODE=secure`。服务端使用现有 `WECHAT_MINIPROGRAM_APP_ID` 校验解密消息；其值必须与本工程及微信后台配置的 AppID 一致。兼容模式可设置 mode 为 `compatibility`，明文模式为 `plaintext`。不要将 Token 或 AESKey 提交到 Git 或发送到聊天中。

保存服务端密钥后需重新构建并重启服务，再到微信后台提交 URL 和 Token，完成 GET 校验后保存配置。上线前用微信消息推送调试工具发送测试事件；接口返回 `success` 仅表示签名/解密校验通过并已确认接收，不代表已实现该事件的业务动作。

商家和员工继续使用 RUDA 账号密码登录。登录页会在提交账号信息前要求用户分别同意《RUDA 商家小程序用户服务协议》和《RUDA 商家小程序隐私政策》。商家注册按钮统一打开公开前端行业商家注册页 `https://modaui.com/register-wholesale?registration=merchant`，注册时选择七种行业之一并直接创建对应后台；小程序不新增第二套正式注册后端。微信 web-view 无法打开时，页面提供复制注册链接的回退。访问令牌保存在独立的 `ruda_merchant_mini_auth` 键中；不会与买家小程序或买家微信绑定登录共享会话。服务端密钥不放入小程序代码。

已在 `app.json` 启用微信小程序按需注入（`lazyCodeLoading: "requiredComponents"`）。调试请使用支持该特性的微信开发者工具和基础库；工程目前没有自定义组件，因此暂不需要用时注入占位组件配置。

商品图片上传依赖已配置的商家媒体预签名 API 和对象存储域名。仅有存储桶配置而未配置微信上传域名时，图片上传会由微信平台拦截。

「更多」中的店铺二维码在小程序端本地生成，二维码生成器作为本地模块随小程序源码加载，无需在微信开发者工具中单独构建 npm。

## 当前迁移范围

已接入经营概览、商品资料与上架状态、商品批量上架/暂停/分区/分类、订单履约与多包裹部分发货、退货审核与收货、库存、客户/供应商、采购、财务结算、材料入库、生产工单状态、POS 班次与销售、员工账号、通知、商家偏好、店铺介绍/SEO/配送与退货政策、支持会话创建/查看/回复。AI 相关功能目前受审核开关控制，不会显示在审核版小程序中。具体操作继续受服务端租户和员工权限控制。

订单中心还可处理买家提交的商品预订意向。商家可查看每个颜色、尺码及数量并确认或拒绝；确认仅表示接受意向，不会预留或扣减库存，买家仍须通过正常结算流程创建正式订单。

AI 功能审核通过后，如需恢复，应在 `utils/review-features.js` 启用 `AI_FEATURES_ENABLED`，并在 `app.json` 和底部导航中重新注册 ModaUI 与虚拟试衣页面；之后重新构建并提交新版本。ModaUI 页面注册为 tab 页后，进入时通过 `custom-tab-bar.setHidden(true)` 默认隐藏底部导航，由输入区下方细拖柄展开；顶部右侧“更多操作”打开“对话 / 创作工具 / 其他”9 项分组面板（行高 68rpx，面板最高 70vh），有消息且未激活创作模式时输入区上方显示四个等宽快捷胶囊。与手机 Web、电脑 Web 共用同一业务接口和菜单动作，不另建第二套导航。

这是一版原生商家端实现，仍非完整的一比一替代品：商品 SKU 矩阵/批量价格等高级编辑、复杂分包发货的物流状态与轨迹维护、多商品采购/采购单完整编辑及店铺图片素材管理等高级页面尚未迁移。发布前仍需用商家测试账号逐项对照商家后台 App 验收并补齐。
