#!/usr/bin/env bash
# RUDA 生产发布脚本（带安全闸门）。
#
# 用法（在生产目录执行）：
#   bash scripts/deploy-release.sh --dry-run     # 只做预检与打印将要执行的步骤
#   bash scripts/deploy-release.sh --confirm      # 真正发布
#
# 顺序：预检 → 数据库预发布备份 → 迁移 → 构建 → 重启 → 冒烟。
# 任何一步失败立即停止；迁移只做新增（列/表/索引），旧代码可继续运行，回滚见脚本末尾。
set -Eeuo pipefail

cd "$(dirname "$0")/.."

mode="${1:-}"
if [[ "$mode" != "--dry-run" && "$mode" != "--confirm" ]]; then
  echo "Usage: bash scripts/deploy-release.sh [--dry-run|--confirm]" >&2
  exit 2
fi

log() { printf '[deploy] %s\n' "$*"; }
die() { printf '[deploy][error] %s\n' "$*" >&2; exit 1; }

[[ -f .env ]] || die "缺少 .env"
for key in DATABASE_URL APP_URL JWT_BUYER_SECRET JWT_MERCHANT_SECRET JWT_ADMIN_SECRET; do
  grep -Eq "^${key}=.+" .env || die "缺少必需环境变量: ${key}"
done

PM2_BIN="$(command -v pm2 || true)"
if [[ -z "$PM2_BIN" && -x node_modules/.bin/pm2 ]]; then PM2_BIN="node_modules/.bin/pm2"; fi
[[ -n "$PM2_BIN" ]] || die "未找到 pm2（npm i -D pm2 或全局安装）"

log "1/6 预检：工作区状态"
git status --porcelain | head -20 || true
pending="$(npx prisma migrate status --schema prisma/schema.prisma 2>/dev/null | sed -n 's/^\(20[0-9]\{12\}_[A-Za-z0-9_]*\)$/\1/p')"
if [[ -n "$pending" ]]; then
  log "待应用迁移："; printf '  - %s\n' $pending
else
  log "数据库无待应用迁移"
fi

if [[ "$mode" == "--dry-run" ]]; then
  cat <<'PLAN'
[deploy][dry-run] 将依次执行：
  2/6 npm run db:backup:predeploy      （预发布数据库备份）
  3/6 npx prisma migrate deploy        （仅新增结构，向后兼容）
  4/6 npm run build                    （vite + esbuild server.cjs）
  5/6 pm2 startOrRestart ecosystem.config.cjs --update-env && pm2 save
  6/6 npm run smoke:post-deploy        （SMOKE_BASE_URL 可覆盖，默认 https://modaui.com）
如需真正发布：bash scripts/deploy-release.sh --confirm
PLAN
  exit 0
fi

log "2/6 数据库预发布备份"
npm run db:backup:predeploy

log "3/6 应用数据库迁移（含本次两条：consumer_account_closure、notification_business_status）"
npx prisma migrate deploy --schema prisma/schema.prisma

log "4/6 构建"
npm run build

log "5/6 重启服务"
"$PM2_BIN" startOrRestart ecosystem.config.cjs --update-env
"$PM2_BIN" save
sleep 5
"$PM2_BIN" status | head -20 || true

log "6/6 冒烟"
SMOKE_BASE_URL="${SMOKE_BASE_URL:-https://modaui.com}" npm run smoke:post-deploy

cat <<'ROLLBACK'

[deploy] 发布完成。回滚方式：
  1) 代码：git checkout <上一个已发布提交> && npm run build && pm2 restart ruda-fashion
  2) 数据库（仅当必须时）：
     ALTER TABLE "Order" DROP COLUMN IF EXISTS "consumerId";
     DROP TABLE IF EXISTS "ConsumerWishlistItem";
     DROP INDEX IF EXISTS "NotificationEvent_recipient_businessStatus_idx";
     ALTER TABLE "NotificationEvent" DROP COLUMN IF EXISTS "businessStatus";
     注：两条迁移均为新增结构，保留不动也不影响旧代码运行。
ROLLBACK
