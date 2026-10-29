# 时尚版块：小程序与手机 Web 端一致性规格

状态：部分完成（代码整改、五项功能补齐、隔离预览环境真实接口端到端验证已完成；微信开发者工具截图/录屏与公开预览域名部署待授权，见 §7.4）
适用运行面：用户端小程序 `miniprogram/`、前端 Web/手机 Web `src/apps/*`（共用 `FashionTrendsView`）
数据来源：`/api/fashion/*`（Prisma `FashionCommunityPost` / `FashionAccount` / `FashionCommunityReaction` 等）

## 1. 问题与目标

用户反馈「小程序时尚版块不合格，像普通图片卡片列表」。逐项核查后的真实原因与用户描述不完全一致，必须先如实记录：

1. 小程序时尚版块**被整体关闭**：`miniprogram/utils/constants.js` 中 `FASHION_ENABLED: false`，自定义 tabBar 直接过滤掉该 tab（`custom-tab-bar/index.js:9`），页面根节点 `wx:if="{{featureEnabled}}"`（`pages/fashion/index.wxml:1`）没有 else 分支，`onLoad` 关掉时 `wx.switchTab` 回首页（`pages/fashion/index.js:379`）。用户实际看到的是「没有时尚版块」，而不是卡片列表。
2. 页面代码本身**已经是沉浸式竖向全屏流**：`index.wxml:104` 竖向 `swiper`、`index.wxml:107-123` 图片/视频媒体舞台、`index.wxml:148-161` 右侧互动栏、`index.js` 中真实调用 `/api/fashion/posts`、`/api/fashion/social/*`、`/api/fashion/posts/mixed`。所以「重做成沉浸式流」的前提不成立，本次不做重写。
3. 真正的质量问题是**伪数据与假功能**，违反全站铁规：网络失败时注入 `createDemoFashionPosts()` 生成的 7 条假作品（`demo-fashion-N`）、假互动数 `16.5万 / 4258 / 1万 / 3786`、假「LIVE 演示」浮层（`index.wxml:172-196`，「本页面为界面演示，暂未连接真实直播」）、假「收件箱」演示会话（`index.wxml:198+`），以及图片加载失败时用固定 webp 占位图冒充真实作品（`DEMO_IMAGE_URL`）。
4. 生产环境**没有任何真实时尚内容**：2026-10-27 实测 `GET https://ruda.fashion/api/fashion/posts?sort=latest&limit=3` 返回 `{"success":true,"posts":[],"hasMore":false}`，`/api/fashion/editorial` 返回 `{"success":true,"items":[]}`。即使打开开关，两端也都是空流，验收所需的「同一条真实内容」当前在生产不存在。

目标：在**不重写后端、不伪造数据**的前提下，让小程序时尚版块与手机 Web 使用同一套接口与业务规则，打开后具备真实的沉浸式浏览、发布与互动，并删除全部伪数据与假功能。

非目标：
- 不新建第二套时尚 API 或第二套上传通道。
- 不改动商家后台、ModaUI 等其他模块。
- 不在本次引入直播、私信等产品尚未实现的能力（原「LIVE/收件箱」为演示壳，直接移除而不是伪装成已实现）。

## 2. 复用现状（防重复检查）

| 能力 | 权威实现 | 小程序复用方式 | 结论 |
| --- | --- | --- | --- |
| 内容流 | `GET /api/fashion/posts` | `miniprogram/utils/api.js:142` `getFashionPosts` | 复用 |
| 时尚周刊/编辑内容 | `GET /api/fashion/editorial` | `getFashionEditorial` | 复用 |
| 商家卡 | `GET /api/fashion/merchants` | `getFashionMerchants` | 复用 |
| 点赞/收藏/关注/评论 | `/api/fashion/social/*` | `reactFashionPost`、`followFashionCreator`、`getFashionComments`、`addFashionComment` | 复用 |
| 发布（图片/视频混合） | `POST /api/fashion/posts/mixed` + `/assets` 分片上传 | `uploadFashionPostAsset`、`submitFashionMixedPost` | 复用，带真实进度回调 |
| 身份 | `/api/miniprogram/auth/*` + 既有 `FashionAccount` | `utils/auth.js`、`activateFashionAccount` | 复用 |
| Web 呈现 | `src/apps/shared/components/frontend/FashionTrendsView.tsx` | 小程序用原生 `swiper/video`，不复制业务规则 | 界面独立、契约统一 |

搜索过的关键字/目录：`时尚`、`fashion`、`FASHION_ENABLED`、`/api/fashion/`、`pages/fashion`、`utils/api.js`、`prisma/schema.prisma`（`FashionCommunity*`）。

## 3. Web 手机端与小程序功能对照（按代码事实）

| 功能 | 手机 Web（`FashionTrendsView.tsx`） | 小程序（改前） | 结论 |
| --- | --- | --- | --- |
| 竖屏全屏内容流 | `h-[100svh]` + `snap-y snap-mandatory`（1633） | 竖向 `swiper`（wxml:104） | 已一致 |
| 视频自动播放/暂停/静音 | `<video>` + 活跃索引控制 | `showVideo` + `playActiveVideo`/`pauseActiveVideo`、静音切换、缓冲、失败重试 | 已一致 |
| 图集滑动 | 横向 snap 图集 | 内层 `swiper` 图集 + `onGalleryChange` | 已一致 |
| 视频播放进度条 | 有（`onTimeUpdate` + 底部 1px 进度条，1792） | `bindtimeupdate` → `onVideoTimeUpdate` + `.video-progress-track/.video-progress-fill` | 已补齐（等效交互） |
| 点赞（含双击/心形动画） | 有 | 有 `toggleLike`，无动画 | 部分一致（动画差异保留） |
| 收藏 | 有 | 有 `toggleSave` | 已一致 |
| 评论列表/发布 | 有 | 有 `openComments`/`sendComment` | 已一致 |
| 关注创作者/商家 | 有 | 有 `toggleFollow` | 已一致 |
| 分享 | 分享面板（复制链接/下载） | `open-type="share"` 系统分享 + `copyPostLink`（`wx.setClipboardData`）+ `savePostMedia`（`wx.saveImage/VideoToPhotosAlbum`） | 已补齐（平台等效实现） |
| 翻译 | 有（`/api/fashion/ai/translate`） | `translateFashionText` → `translatePost`，译文块 + 原文/译文切换 | 已补齐（同一接口） |
| 图片放大/缩放 | lightbox + zoom（2095+） | `previewPostMedia` → `wx.previewImage`（原生双指缩放，能力由平台提供） | 已补齐（平台等效实现） |
| 「不感兴趣」推荐偏好 | 有（`dismissRecommendedItem`，`localStorage` 按 viewer 保存） | `dismissPost` + `FASHION_DISMISSED_STORAGE_PREFIX`（`wx.setStorageSync` 按 viewerId 保存），隐藏后不可见 | 已补齐（两端均为“仅本设备生效”） |
| 发布：图片/视频选择、预览、删除、替换 | 有 | 有（`draftMedia`、`removeDraftMedia`、封面选择） | 已一致 |
| 发布：真实上传进度/失败重试 | 有 | 有（`uploadProgress`、`uploadCurrentLabel`、`uploadError`、重试） | 已一致 |
| 发布：标题/描述/话题/分类/城市/可见性/关联商品/版权确认 | 有 | 有（`postTitle`、`postHashtags`、`postCategory`、`postCity`、`postVisibility`、`selectedProduct`、`rightsConfirmed`） | 已一致 |
| 草稿保留 | Web 用本地存储 | `ruda_fashion_composer_draft` + 文件持久化 | 已一致 |
| 搜索、城市/分类筛选、关注流、商家流 | 有 | 有（`searchOpen`、`cityPickerOpen`、`mode`） | 已一致 |
| 空/错误/加载状态 | 每种模式独立空状态 | 有统一 `state-box`（wxml:40-42） | 已一致 |
| 伪数据兜底 | 无 | 网络失败注入 7 条假作品 + 假计数 | **错误，本次删除** |
| 假直播 / 假收件箱 | 无 | 「演示」浮层与本地会话 | **错误，本次删除** |

## 4. 本次变更范围

1. `miniprogram/utils/constants.js`：`FASHION_ENABLED` 由 `false` 改为 `true`，恢复「时尚」tab 与页面。（2026-10-28 起该编译期常量已删除，入口改由服务端全局开关 `fashion_enabled` 控制，见 `platform-feature-flags.md` §5.1）
2. `miniprogram/pages/fashion/index.js`：
   - 删除 `DEMO_IMAGE_URL`、`DEMO_POST_IMAGES`、`demoInboxThreads`、`createDemoFashionPosts()`；
   - 删除 `demoFeedMode`、`demoLive*`、`demoInbox*`、`demoConversation*` 状态与全部处理函数（`openLivePreview`、`onDemoLive*`、`openDemoInbox`、`sendDemoConversationMessage`、`showDemoShare` 等）；
   - 加载失败时只显示真实错误与重试，不再注入假作品；
   - 图片加载失败时标记 `imageFailed` 并显示「图片加载失败」占位，不再回落到固定 webp；
   - 点赞/收藏/关注继续以 `post.socialEnabled` 与真实 `creatorAccountId` 为门禁。
3. `miniprogram/pages/fashion/index.wxml`：
   - 移除 LIVE 入口、演示横幅、演示直播/收件箱浮层、演示分享按钮与假计数分支；
   - 为关闭态补 `wx:else` 说明块（避免再次出现白屏）；
   - 媒体失败显示可重试的错误层。
4. `miniprogram/pages/fashion/index.wxss`：删除 `.fashion-demo-*`、`.demo-media-label` 样式，补充错误/关闭态样式。
5. `miniprogram/custom-tab-bar/index.wxml`、`index.js`：移除伪「收件箱」入口与未读数。
6. `miniprogram/README.md`：更新时尚版块开关说明。
7. 新增 `tests/miniprogram-fashion-parity.test.ts`：机械校验真实接口、沉浸式结构、空/错状态、禁止伪数据回归。
8. 五项 Web 能力补齐（第 2 轮）：
   - 视频进度条：`onVideoTimeUpdate` + `.video-progress-track/.video-progress-fill`（媒体切换时进度归零）。
   - 翻译：`translatePost` 复用 `POST /api/fashion/ai/translate`（`language: 'it'`，与 Web 相同参数），失败只提示「翻译暂不可用」，不伪造译文。
   - 图片查看/缩放：`previewPostMedia` 调用 `wx.previewImage`（平台原生缩放/保存）。
   - 保存到相册 / 复制链接：`savePostMedia`（`wx.downloadFile` + `wx.saveImageToPhotosAlbum`/`wx.saveVideoToPhotosAlbum`，含相册权限引导）、`copyPostLink`（`wx.setClipboardData`，链接为 `API_BASE_URL/trends?post=<id>`）。
   - 「不感兴趣」：`dismissPost` 写入 `ruda_fashion_dismissed_<viewerId>`（上限 200 条），并从 `refreshVisibleItems` 过滤；媒体操作面板 `openMediaActions`/`closeMediaActions` 承载上述入口。
9. 发布分类与 Web/服务端对齐：`postCategories` 与会话分类改为与服务端 `fashionCommunityCategories`（6 项）完全一致，删除小程序原先额外提供的 `今日穿搭/街头潮流/设计师/秀场/美妆/配饰/时尚周刊`（服务端会返回 `FASHION_POST_CATEGORY_INVALID`，属真实缺陷）。
10. 服务端缺陷修复：`POST /api/fashion/social/:id/reaction` 在 `FASHION_COMMUNITY_STORAGE=database` 下用错 Prisma 关系名（`FashionCommunityPost` → `fashionCommunityPost`），导致点赞/收藏必然 500；已修复并经隔离预览实例验证（见 §7.3）。

## 5. 观看统计与互动身份（2026-10-28）

- 服务端只接受 `fashion_account` 会话或服务端签发的 `ruda_fashion_viewer` HttpOnly cookie 作为互动身份；
  客户端提交的 `viewerId` 已取消，点赞/收藏/评论/观看不再可冒用他人身份。
- 评论必须登录（401 `FASHION_ACCOUNT_AUTH_REQUIRED`），并按账号限流 6 条/分钟。
- 观看事件通过 `recordFashionPostView` 调用 `POST /api/fashion/posts/:id/view`，服务端按 6 小时桶去重，
  用于推荐排序（播放量 + 完播率 + 新鲜度 + 品类偏好），后台内容列表展示 30 天播放量。
- 分享链接统一为 `?post=<id>`，小程序通过 `postId` 查询参数直达该作品。

## 6. 状态与错误处理

- `featureEnabled=false`：显示「时尚版块暂未开放」说明与返回首页按钮，不再白屏。
- 首屏加载失败：`state-box` 显示错误原因 + 重试，不显示任何假内容。
- 媒体失败：单条媒体显示「图片/视频加载失败 · 点击重试」，其他条目不受影响。
- 空流：区分「全部/分类/关注/商家」四种文案，并提供「发布内容」入口。
- 发布失败：保留草稿与已选素材，提示具体错误，可重试，不伪造成功。
- 互动失败：回滚乐观更新并给出 toast，不吞错。
- 翻译失败：提示「翻译暂不可用，请稍后重试」，原文保持可读，不生成假译文。
- 保存到相册失败：区分权限失败（弹窗引导 `wx.openSetting`）与其他失败（提示重试）。
- 复制链接失败：提示「复制失败」，不提示成功。

## 6. 验收标准

必须同时满足：

1. 小程序「时尚」tab 可见，进入后为竖向全屏流，图片/视频铺满并正确播放、暂停、静音。
2. 同一条真实作品在 Web 手机端与小程序展示同一标题、作者、媒体、互动数。
3. 从相册选择真实图片/视频 → 预览/替换/删除 → 显示真实上传进度 → 服务端落库 → 返回内容流可看到该作品。
4. 点赞/评论/关注在服务端有对应记录，另一端刷新可见。
5. 断网、上传失败、视频失败有明确提示与重试，无假数据。
6. 桌面 Web 与小程序的并排截图与实际运行录屏（§7）。

## 7. 验证结果与阻塞

### 7.1 隔离预览环境（本次实际搭建，可复现）

| 项 | 实际配置 |
| --- | --- |
| 数据库 | 临时 `postgres:16-alpine` 容器 `ruda-fashion-verify-db`，仅监听 `127.0.0.1:32794`，`npx prisma migrate deploy` 应用 141 个迁移成功；与生产库完全隔离 |
| 服务进程 | `/tmp/ruda-fashion-verify` 为工作目录，`node --import tsx /www/wwwroot/ruda.fashion/server.ts`，`PORT=5413`、`NODE_ENV=development`、`FASHION_COMMUNITY_STORAGE=database`；`logs/`、`public/uploads/fashion` 均落在 `/tmp`，生产目录未被写入 |
| 媒体存储 | **显式清空** `R2_*` 与 `OBJECT_STORAGE_*`，使用服务端本地磁盘回退（`/uploads/fashion/<uuid>`），测试媒体不进入生产对象存储 |
| 测试账号 | 消费者 `preview.fashion@ruda.test`（真实 `/api/consumers/register` + `/api/consumers/login` 创建）、审核管理员 `previewmoderator`（仅隔离库，随机密码只写 `/tmp`） |
| 测试素材 | `ffmpeg` 生成真实 JPEG（1080×1440，96,872 B）、真实 MP4（720×1280，3.000 s，1,222,175 B）与视频封面 JPEG |

复现命令（关键步骤）：

```
docker run -d --name ruda-fashion-verify-db -e POSTGRES_PASSWORD=fashionverify -e POSTGRES_DB=ruda -p 127.0.0.1:32794:5432 postgres:16-alpine
DATABASE_URL='postgresql://postgres:fashionverify@127.0.0.1:32794/ruda?schema=public' npx prisma migrate deploy
# 服务进程必须同时导出：PORT=5413 NODE_ENV=development FASHION_COMMUNITY_STORAGE=database
#   以及空值 R2_ACCOUNT_ID/R2_ENDPOINT/R2_ACCESS_KEY_ID/R2_SECRET_ACCESS_KEY/R2_BUCKET_NAME/R2_PRIVATE_BUCKET_NAME/R2_PUBLIC_URL
#   与空值 OBJECT_STORAGE_ENDPOINT/OBJECT_STORAGE_BUCKET/OBJECT_STORAGE_ACCESS_KEY_ID/OBJECT_STORAGE_SECRET_ACCESS_KEY/OBJECT_STORAGE_PUBLIC_BASE_URL
curl -s -c cookies.txt -X POST http://127.0.0.1:5413/api/consumers/register -H 'Content-Type: application/json' \
  -d '{"email":"preview.fashion@ruda.test","password":"<随机>","firstName":"预览","lastName":"创作者","acceptedTerms":true,"acceptedPrivacy":true}'
curl -s -b cookies.txt -X POST http://127.0.0.1:5413/api/fashion/account/activate -H 'Content-Type: application/json' -d '{}'
curl -s -b cookies.txt -X POST http://127.0.0.1:5413/api/fashion/posts/mixed \
  -F 'title=预览视频作品' -F 'text=<说明>' -F 'category=女装趋势' -F 'rightsConfirmed=true' -F 'hashtags=["预览","视频"]' \
  -F 'manifest=[{"type":"video","name":"test-video.mp4"}]' \
  -F 'media-0=@test-video.mp4;type=video/mp4' -F 'poster-0=@test-poster.jpg;type=image/jpeg'
```

### 7.2 真实链路结果（全部来自上述隔离预览实例，原始响应存于 `/tmp/ruda-fashion-verify/evidence/`）

| 用例 | 方式 | 结果 |
| --- | --- | --- |
| 图片上传 | `POST /api/fashion/posts/mixed`（`manifest=[{"type":"image"}]`） | HTTP 201，`mediaItems[0].url=/uploads/fashion/7d7da1bc-….jpg`（无 `storageKey`/`bucket`，未写生产存储） |
| 视频上传 | 同上（video + poster） | HTTP 201，`videoUrl=/uploads/fashion/335429c4-….mp4`，`posterUrl=/uploads/fashion/5780b964-….jpg` |
| 审核流转 | `POST /api/auth/login/admin` + `PUT /api/admin/fashion/community/:id {"publicationStatus":"approved"}` | 两条作品 `pending` → `approved`，200 |
| 内容流读取 | `GET /api/fashion/posts?limit=12` | `count=2`，`types=[video,image]`，id 与上传返回一致 |
| 图片媒体读取 | `GET /uploads/fashion/7d7da1bc-….jpg` | 200，96,872 B |
| 视频媒体读取 | `GET /uploads/fashion/335429c4-….mp4`（Range） | 206，2,048 B |
| 视频封面 | `GET /uploads/fashion/5780b964-….jpg` | 200，52,951 B |
| 点赞 | `POST /api/fashion/social/:id/reaction {"reaction":"like"}` | 200 `liked=true likesCount=1`（修复后；修复前必 500） |
| 评论 | `POST /api/fashion/social/:id/comments` | 201，`commentsCount=1`；`GET .../comments` 返回原文 |
| 互动回读 | `GET /api/fashion/social?ids=…&viewerId=<真实已登录会话>` | `likesCount=1 commentsCount=1 liked=true` |
| 分类筛选 | `GET /api/fashion/posts?category=包袋配饰` | `count=1`，`categories=[包袋配饰]` |
| 空状态 | `GET /api/fashion/posts?category=鞋履趋势` | 200，`count=0`（前端进入「这里还没有内容」分支） |
| 媒体错误 | `GET /api/fashion/community/fashion-post-does-not-exist/media/0/content` | 404（前端进入可重试错误层） |
| 翻译 | `POST /api/fashion/ai/translate {"language":"it"}` | 200，返回真实意大利语译文（非占位） |
| 重启后持久化 | 结束进程并重启，再次 `GET /api/fashion/posts` 与 `/api/fashion/social` | 仍是同样 2 条作品，`likesCount=1 commentsCount=1` |

本轮命令与结果：

```
node --import tsx --test tests/miniprogram-*.test.ts tests/wechat-miniprogram.test.ts  # tests 73 / pass 73 / fail 0
node --import tsx --test tests/miniprogram-fashion-parity.test.ts                      # tests 9  / pass 9  / fail 0
node --check miniprogram/pages/fashion/index.js                                        # exit 0
npx tsc --noEmit                                                                       # exit 0（无输出）
grep -rn 'demo|演示' miniprogram/pages/fashion miniprogram/custom-tab-bar               # 0 命中
```

### 7.3 生产隔离事故与清理（如实记录）

首次启动预览服务时，`server.ts` 通过项目 `.env` 载入了**生产 R2 凭证**，导致前两次上传把 5 个测试对象写入了生产私有桶（`fashion/community/r2-private/`）。

- 发现方式：上传响应中 `storageKey` 带 `r2-private/`、`storageBucket=ruda888`，而预期是本地 `/uploads/fashion/`。
- 处置：立即停止预览进程；按隔离库中记录的实际 key 逐个 `HeadObject` + `DeleteObject`，5/5 删除成功（日志 `/tmp/ruda-fashion-verify/evidence/r2-cleanup.json`）；随后在启动脚本中显式导出空 `R2_*`/`OBJECT_STORAGE_*`，重新上传的媒体全部落在 `/tmp` 本地目录，未再触碰生产存储。
- 结论：**预览实例必须显式清空生产存储凭证**，否则仅改 `DATABASE_URL` 并不能隔离媒体写入；该要求已写入 §7.1。

### 7.4 剩余阻塞（未完成，不得标记「已验收」）

1. **微信开发者工具截图/录屏**：本机 DevTools 未运行且 `auto` 通道需 IDE token 或人工点击「启用自动化」，本轮无法取得小程序真实截图；因此「并排截图 / 上下滑动 / 上传进度 / 失败重试」的端侧视觉验收仍待执行。
2. **公开预览域名**：预览实例仅监听 `127.0.0.1:5413`，小程序 `API_BASE_URL` 仍为生产域名；未获部署授权，也未改动生产配置。
3. **手机 Web 侧截图**：需要对预览实例构建前端产物（`dist` 为旧构建，不含时尚版块），本轮未执行构建与浏览器截图。
4. 小程序时尚入口自 2026-10-28 起由服务端 `fashion_enabled` 控制：关闭后 tab 隐藏、页面提示「该功能暂未开放」并回首页；服务端 `/api/fashion/*` 同步返回 403。真机验证仍待完成（见 `platform-feature-flags.md` §12）。


## 8. 第二阶段变更（2026-10-28）

### 8.1 已补齐的能力

- **关注流**：Web 与小程序均调用 `GET /api/fashion/posts?following=true`，返回关注创作者的真实作品；商家卡片在 Web 端独立为 `stores` 模式，不再冒充关注流。
- **创作者主页**：Web 新增可分享的 `/creators/<id>` 与 `?creator=<id>`；小程序沿用既有创作者资料面板。两端读取同一 `GET /api/fashion/creators/:id`，字段包含真实作品数、粉丝数、关注数、`following`、`isSelf`、可选商家信息与作品 `products[]`。
- **评论回复**：`POST /api/fashion/social/:id/comments` 支持 `parentId`（仅一级），`GET` 返回 `replies[]`/`mine`；作者可删除自己的评论，管理员可通过举报处理删除评论。小程序举报走 `/api/fashion/reports`。
- **收藏**：Web 新增「收藏」入口并使用 `saved=true`；新增 `GET /api/fashion/account/saved` 按收藏时间排序；取消收藏后列表即时移除。
- **作品关联商品**：新增 `GET /api/fashion/products/search`（仅当前账号可管理的公开商品）、`PATCH /api/fashion/posts/:id`、`GET /api/fashion/posts/:id/manage`、商品点击统计。Web 发布页与小程序发布页均提交 `productIds`；小程序原作提交的 `productId` 单字段已废弃。
- **小程序发布链路**：服务端新增 `POST /api/fashion/posts/mixed/assets`（签名 `uploadToken`）与 JSON 清单提交分支，修复小程序发布接口此前不存在的问题。
- **举报与审核**：用户端举报入口 + 后台 `admin/fashion/reports`、`admin/fashion/appeals` 接口与 `AdminFashionReports` 面板。

### 8.2 三端一致性约束

- 身份：一律使用服务端下发身份，客户端 `viewerId` 参数被忽略。
- 商品授权：只允许关联当前账号有权管理、且公开可售的商品；小程序与 Web 使用同一接口，不各自建立商品数据源。
- 计数：评论数、收藏数、点赞数在写入后由服务端返回并回填，不使用本地乐观值作为最终事实。
- 深链：`/trends?post=<id>`、`/creators/<id>`、小程序 `postId` 参数均指向同一作品/创作者；已修复 Web 深链被 URL 同步副作用提前删除的问题。

### 8.3 本轮验证与未完成

- 已执行：`tsc --noEmit`、`npm run build`、`tests/fashion-community-integrity.test.ts`（12/12）、生产 API 探测、Web 桌面/手机 Playwright 14 项检查（截图见 `/tmp/fashion-shots`）。
- 未执行：微信开发者工具/真机运行验收；带登录态的发布、关注、收藏、评论端到端；后台审核界面的真实登录操作。上述均不得标记为「已验收」。

## 9. 第三阶段：消息与话题（2026-10-28）

- 新增小程序消息入口：`fashion-topbar` 内「消息」按钮 + 未读数徽标，打开底部抽屉展示真实
  `/api/fashion/notifications` 数据；点击通知可跳到对应作品（按 `postId` 走现有深链逻辑）或创作者主页。
- 新增热门话题条：`magazine-tag-scroll` 读取 `/api/fashion/tags`，点击后进入现有搜索并提交该话题。
- 新增 `getFashionNotifications` / `markFashionNotificationsRead` / `getFashionTags` 到 `utils/api.js`，
  与 Web 使用同一权威接口，不新建数据源。
- `onShow` 时刷新未读数与话题；通知打开后调用 `read all`，与 Web 行为一致。
- 验证：`node --check` 通过；WXML 标签平衡检查通过；未在微信开发者工具或真机执行，
  因此本轮仍只能标记「代码检查完成，运行时待验收」。
- 仍未接入：服务端草稿、屏蔽作者、作品数据（服务端 API 已具备，小程序界面未做）。
## 10. 季节筛选与发布季节（2026-10-28）

### 10.1 数据与契约

- 迁移 `prisma/migrations/20261028210000_fashion_season`：`FashionCommunityPost.season String?`、`FashionCommunityDraft.season String?`；生产库已确认两列存在（`information_schema.columns` 查到 `FashionCommunityPost|season`、`FashionCommunityDraft|season`）。
- 季节词表只允许四个值：`春季`、`夏季`、`秋季`、`冬季`（服务端 `fashionCommunitySeasons`）。空值表示未标注，历史作品 `season` 为 `null` 时仍然出现在未筛选的流里。
- `GET /api/fashion/posts?season=<季节>`：非词表值返回 `400 {"error":"FASHION_POST_SEASON_INVALID"}`；合法值在 SQL 结果集上按 `post.season === season` 过滤；响应每条作品带 `season`（可能为 `null`）。
- 写入：`POST /api/fashion/posts`（JSON 图片）、`POST /api/fashion/posts/mixed`（小程序/多图多视频）、`POST|PATCH /api/fashion/drafts` 三条路径都做同样的词表校验（非法值 400 `FASHION_POST_SEASON_INVALID`），空字符串视为「未标注」；草稿列表返回 `season` 供恢复。

### 10.2 三端界面

| 端 | 入口 | 行为 |
| --- | --- | --- |
| Web/手机 Web（`FashionTrendsView.tsx`） | 筛选面板「季节」chips + 内容流星期标签 | 面板草稿态 `draftFeedSeason`，确认后 `feedSeason` 生效并作为 `&season=` 传给 `GET /api/fashion/posts`（offset 与 cursor 两条分页路径都带参数）；本地过滤同时按 `item.season` 收敛，避免旧缓存串季 |
| Web 发布 | 发布面板 `select#fashion-post-season` | 空选项=未标注；发布走 `form.set('season', …)`，草稿恢复回填 |
| 小程序（`pages/fashion`） | 分类栏第二行季节 chips（`不限季节` + 四季） | `onSeasonFilterChange` 重置分页与滚动后调用 `loadFeed(true)`，请求带 `season`（`utils/api.js` 的 `getFashionPosts` 通过 `toQuery(parameters)` 原样透传，无需改动客户端封装） |
| 小程序发布 | 发布面板 `picker`（`seasonOptions`） | `onPostSeasonChange` 只改索引，发布时映射为词表值；本地草稿与云端草稿都保存/恢复 `postSeasonIndex` |

### 10.3 本轮验证（真实执行）

```
npx tsc --noEmit                                              # exit 0，无输出
node --check miniprogram/pages/fashion/index.js                # exit 0
node --check miniprogram/utils/api.js                          # exit 0
node --import tsx --test tests/miniprogram-fashion-parity.test.ts   # 10/10 pass（含新增季节一致性用例）
node --import tsx --test tests/fashion-community-integrity.test.ts  # 20/20 pass（含新增季节写入/过滤用例）
curl 'http://127.0.0.1:3012/api/fashion/posts?limit=5'                    # 200，posts=5
curl 'http://127.0.0.1:3012/api/fashion/posts?season=夏季&limit=5'        # 200，按季节过滤（当前库无标季作品，返回 0 条）
curl 'http://127.0.0.1:3012/api/fashion/posts?season=2026'                # 400 FASHION_POST_SEASON_INVALID
```

发布后对生产进程（`dist/server.cjs`，`127.0.0.1:3011`）复测：

```
GET /                                             # 200
GET /api/fashion/posts?limit=2                    # 200
GET /api/fashion/posts?season=夏季&limit=2         # 200
GET /api/fashion/posts?season=2026&limit=2        # 400 {"success":false,"error":"FASHION_POST_SEASON_INVALID"}
```

Web 端浏览器验收（`scripts/fashion-acceptance.mjs` 增加季节步骤后）：

```
FASHION_BASE_URL=http://127.0.0.1:3011 FASHION_SHOT_DIR=docs/engineering/evidence/fashion-stage4 \
  node scripts/fashion-acceptance.mjs      # 14/14 pass
```

新增的三条检查在桌面 1440×900 与手机 390×844 各跑一遍：季节筛选列出四季 + 「全部季节」、点击「夏季」后
`aria-pressed=true`、点「查看内容」后实际发出的请求带 `season=%E5%A4%8F%E5%AD%A3`。截图
`docs/engineering/evidence/fashion-stage4/{desktop,mobile}-08-season-filter.png`，人工查看确认季节行
`全部季节 / 春季 / 夏季 / 秋季 / 冬季` 正常渲染，手机 390px 下单行不换行、选中态为白底黑字。

### 10.4 未完成（不得标记已验收）

- 小程序季节 chips 与发布 picker 只做了代码与模板检查，**未在微信开发者工具/真机运行**。
- 生产库目前没有标注季节的作品，因此「筛选到非空结果」缺少真实数据证据；需要至少一条带 `season` 的作品后才能截图验收。
- 小程序草稿 `postSeasonIndex` 的云端恢复只在单元/静态检查层面覆盖，真机恢复流程待验收。

## 11. 分类词表与通知删除同步（2026-10-28，Stage 5）

### 11.1 分类词表

- 后台新增 `FashionTaxonomyTerm`（见 `20261028220000_fashion_governance`），平台后台「社区治理 → 分类标签」
  可新增、重命名、停用、合并分类/标签；重命名与合并会在事务内改写作品分类或 `hashtags`。
- 公开接口 `GET /api/fashion/taxonomy` 返回启用中的分类/标签。Web（`FashionTrendsView.tsx`）在挂载时拉取，
  合并到筛选与发布选项中，失败时保持静态词表；小程序 `pages/fashion` 的 `loadTaxonomy()` 同样合并到
  `categories` / `postCategories`，发帖与筛选使用同一份服务端词表。
- 服务端发布（图片/视频/多图/多素材）与信息流筛选均改为 `isFashionCategoryAllowed()`，停用的分类无法再发布或筛选。

### 11.2 通知单条删除

- 服务端原有 `DELETE /api/fashion/notifications/:id` 已存在但两端都未使用。本轮补齐：
  Web 通知面板每条右侧删除按钮（`apiDelete`，本地移除并校正未读数）；小程序通知列表 `✕`
  （`utils/api.js#deleteFashionNotification`，`pages/fashion/index.js#removeFashionNotification`）。
- 两端删除后都以后端返回为准（成功才本地移除），失败给出提示，不做乐观伪造。

### 11.3 验证与待验收

```
node --check miniprogram/pages/fashion/index.js   # exit 0
node --check miniprogram/utils/api.js             # exit 0
node --import tsx --test tests/fashion-governance.test.ts   # 10/10 pass（含小程序词表/通知断言）
```

- 小程序 `loadTaxonomy`、通知删除、分类合并后的下拉刷新：**仅代码检查，未在微信开发者工具/真机运行**（`待验证`）。
- Web 端分类新增后的发布与筛选、通知单条删除：随 Stage 5 构建发布后做浏览器验收（见 `fashion-community-upgrade.md` §19）。
