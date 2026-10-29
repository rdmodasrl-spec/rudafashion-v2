# 宝塔迁移部署

## 生成迁移包

在当前服务器的项目目录执行：

```bash
bash scripts/package-for-baota.sh
```

生成文件位于 `release/`，包含项目代码、静态资源和经过 `pg_restore` 校验的 PostgreSQL 数据库备份。包内不含 `.env`、Git 历史、日志、旧归档、`node_modules` 或可重建的 Flutter/前端构建缓存。数据库备份包含真实业务数据；若本机存在 RUDA STUDIO 背景音乐，包中也会包含 `var/fashion-studio/audio/` 下的私有音频文件。请通过受控的 SFTP/SSH 传输并限制访问，不要放到公开下载地址。

## 在目标服务器部署

1. 在宝塔安装 Node.js 22、PM2 和 PostgreSQL 16 或兼容版本，并创建一个空数据库和专用数据库用户。
2. 将 `.tar.gz` 上传到网站目录并解压。包内的 `BAOTA-DEPLOY.md`、`deployment/database.dump` 和校验文件会一并解出。
3. 校验并恢复数据库（按目标服务器实际主机、端口、用户名和数据库名替换参数；命令会提示输入密码）：

   ```bash
   cd /www/wwwroot/ruda.fashion
   sha256sum -c deployment/database.dump.sha256
   pg_restore --no-owner --no-acl \
     -h 127.0.0.1 -p 5432 -U <数据库用户> -d <新数据库> \
     deployment/database.dump
   ```

   请恢复到空数据库。备份不包含 PostgreSQL 服务器角色/用户；需要在目标 PostgreSQL 中单独创建应用数据库用户并授权。

4. 根据 `.env.example` 创建 `.env`，填写目标站点域名、`DATABASE_URL`、`APP_URL` 和集成配置。为新站点生成独立的 JWT、分享链接及 TOTP 加密密钥；不要复用或公开旧密钥。确保新密钥长度符合应用要求。
5. 在项目目录安装依赖、生成 Prisma 客户端、构建并启动：

   ```bash
   npm ci
   npm run db:generate
   npm run build
   npm run start:production
   ```

   生产启动会应用迁移并通过 PM2 启动服务，不会运行演示数据 seed。`ecosystem.config.cjs` 使用项目自身目录，因此解压路径可以按需调整。

6. 在 DNS 中将 `modaui.com`、`www.modaui.com`、`ruda.fashion` 和 `*.ruda.fashion` 指向此站点入口；在宝塔将这些域名反向代理到 `127.0.0.1:3000`，并分别配置有效 HTTPS 证书。`modaui.com` 提供买家公开前台，`ruda.fashion` 提供商家后台和 API；商家店铺子域名仍使用 `店铺名.ruda.fashion`。旧 `b2b.ruda.fashion` 会重定向到商家根域名。验证公开首页、商家登录/API 和至少一个商家店铺子域名后，再切换正式流量。

对象存储中的媒体文件不会从 S3 复制到迁移包；目标站需配置原有对象存储，或另行迁移其对象。`public/uploads/` 不包含在迁移包中。RUDA STUDIO 的私有音乐保存在 `var/fashion-studio/audio/`，随项目包迁移；目标站必须将此目录保留在应用目录中，不要映射到公开静态目录。应用会在上传时创建目录并设为仅服务进程可访问（`0700`）；若单独迁移该目录，请恢复服务进程所有权和私有权限。

RUDA STUDIO 视频导出需要服务器安装带 `drawtext` filter 的 FFmpeg。字幕/文字轨优先使用 `FASHION_STUDIO_FONT_FILE` 指定的字体，其次尝试 Noto CJK 和 DejaVu 系统字体；为保证中文字符完整显示，目标服务器应安装 Noto CJK 字体，并确保服务进程可读取字体文件。字体应保存在系统字体目录或私有应用目录，不要放入公开静态目录。

时间线图片叠加轨只引用素材库中受管理员权限保护、版权状态未受限且后端可安全读取的图片；导出时使用 FFmpeg `overlay` filter 合成，图片需为 JPEG、PNG 或 WebP，单张不超过 12 MB。私有对象存储素材仍需保留对应的对象存储凭据与 bucket 配置；不支持的历史外链图片会在保存项目或导出前明确报错，不会由服务器任意抓取外部 URL。

视频时间线可输出原素材比例、竖屏 9:16（1080×1920）、方形 1:1（1080×1080）或横屏 16:9（1920×1080）。非原始画幅会等比缩放并以黑色补边，不裁切原画面；已保存项目保留所选画幅，旧版本默认使用原素材比例。
