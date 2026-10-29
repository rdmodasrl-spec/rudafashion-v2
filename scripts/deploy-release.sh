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

PREV_COMMIT="$(git rev-parse HEAD 2>/dev/null || true)"
HISTORY_DIR="release/deploy-history"
mkdir -p "$HISTORY_DIR"

log "0/6 同步权威仓库 rdmodasrl-spec/rudafashion-v2（main）"
# index.html 与 public/sw.js 由构建过程改写（Service Worker 版本号），属于构建产物：
# 若把它们算作“未提交改动”，每次发布后都会阻塞下一次发布。
if [[ -d .git ]] && git remote get-url v2 >/dev/null 2>&1; then
  dirty_output="$(git status --porcelain -- . ":!index.html" ":!public/sw.js")"
  if [[ -n "$dirty_output" ]]; then
    printf '%s\n' "$dirty_output" >&2
    die "生产目录存在未提交改动，请先处理后再发布（避免覆盖线上手工修改）"
  fi
  git fetch v2 --quiet
  git reset --hard v2/main >/dev/null
  log "已切换到 $(git --no-pager log --oneline -1)"
else
  log "未配置 v2 远程，跳过同步（沿用当前工作区代码）"
fi
CURRENT_COMMIT="$(git rev-parse HEAD 2>/dev/null || echo unknown)"

log "1/6 预检：工作区状态"
status_file="$(mktemp)"
git status --porcelain >"$status_file" 2>/dev/null || true
head -20 "$status_file" || true
rm -f "$status_file"
migrate_status="$(npx prisma migrate status --schema prisma/schema.prisma 2>&1 || true)"
pending="$(printf '%s\n' "$migrate_status" | grep -E '^[0-9]{14}_[A-Za-z0-9_]+$' || true)"
if [[ -n "$pending" ]]; then
  log "待应用迁移："
  printf '  - %s\n' $pending
else
  log "数据库无待应用迁移"
fi

if [[ "$mode" == "--dry-run" ]]; then
  cat <<'PLAN'
[deploy][dry-run] 将依次执行：
  1/6 预检（含待应用迁移）
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

log "3/6 生成 Prisma Client 并应用数据库迁移"
npx prisma generate
npx prisma migrate deploy --schema prisma/schema.prisma

log "4/6 构建"
npm run build

log "5/6 重启服务（只重启 ruda-fashion，避免被同文件里已停用的其它应用拖垮）"
"$PM2_BIN" startOrRestart ecosystem.config.cjs --only ruda-fashion --update-env || true
"$PM2_BIN" save || true
sleep 5
"$PM2_BIN" status || true
if ! "$PM2_BIN" jlist 2>/dev/null | grep -q '"name":"ruda-fashion","namespace":"default","pm2_env":{"status":"online"'; then
  if ! "$PM2_BIN" describe ruda-fashion 2>/dev/null | grep -q 'status.*online'; then
    die "ruda-fashion 未处于 online 状态，已停止发布，请检查 logs/pm2-error.log"
  fi
fi

log "6/6 冒烟"
record_history() {
  printf '{"at":"%s","from":"%s","to":"%s","result":"%s"}\n' \
    "$(date -Iseconds)" "${PREV_COMMIT:-none}" "${CURRENT_COMMIT:-unknown}" "$1" \
    >>"$HISTORY_DIR/$(date +%Y%m).jsonl"
}
if ! SMOKE_BASE_URL="${SMOKE_BASE_URL:-https://modaui.com}" npm run smoke:post-deploy; then
  record_history "smoke-failed"
  if [[ -n "$PREV_COMMIT" && "$PREV_COMMIT" != "$CURRENT_COMMIT" ]]; then
    echo "[deploy][rollback] 冒烟失败，自动回滚到 $PREV_COMMIT" >&2
    git reset --hard "$PREV_COMMIT" >/dev/null
    npx prisma generate >/dev/null 2>&1 || true
    npm run build >/dev/null 2>&1 || echo "[deploy][rollback] 回滚构建失败，需人工介入" >&2
    "$PM2_BIN" startOrRestart ecosystem.config.cjs --only ruda-fashion --update-env >/dev/null 2>&1 || true
    "$PM2_BIN" save >/dev/null 2>&1 || true
    sleep 5
    if SMOKE_BASE_URL="${SMOKE_BASE_URL:-https://modaui.com}" npm run smoke:post-deploy; then
      echo "[deploy][rollback] 已回滚并恢复服务（$PREV_COMMIT）" >&2
    else
      echo "[deploy][rollback][critical] 回滚后冒烟仍失败，请立即人工检查" >&2
    fi
    record_history "rolled-back"
    exit 1
  fi
  die "冒烟失败且无可回滚的历史版本"
fi
record_history "success"

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
