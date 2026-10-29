#!/usr/bin/env bash
# 一键回滚线上代码到指定提交（默认上一个成功发布的提交）。
#
#   bash scripts/rollback-release.sh            # 回滚到上一次成功发布
#   bash scripts/rollback-release.sh <commit>   # 回滚到指定提交
#   bash scripts/rollback-release.sh --list     # 查看发布历史
#
# 只改代码与构建产物，不动数据库；迁移均为只增结构，旧代码可直接运行。
set -Eeuo pipefail
cd "$(dirname "$0")/.."

log() { printf '[rollback] %s\n' "$*"; }
die() { printf '[rollback][error] %s\n' "$*" >&2; exit 1; }

HISTORY_DIR="release/deploy-history"

if [[ "${1:-}" == "--list" ]]; then
  [[ -d "$HISTORY_DIR" ]] && cat "$HISTORY_DIR"/*.jsonl 2>/dev/null | tail -20 || echo "暂无发布历史"
  exit 0
fi

target="${1:-}"
if [[ -z "$target" ]]; then
  target="$(cat "$HISTORY_DIR"/*.jsonl 2>/dev/null | grep '"result":"success"' | tail -1 | sed -n 's/.*"to":"\([^"]*\)".*/\1/p')"
  [[ -n "$target" ]] || die "找不到上一次成功发布的提交，请显式传入 --list 查看或指定 commit"
fi
git rev-parse --verify --quiet "$target^{commit}" >/dev/null || die "无效提交：$target"

PM2_BIN="$(command -v pm2 || true)"
[[ -z "$PM2_BIN" && -x node_modules/.bin/pm2 ]] && PM2_BIN="node_modules/.bin/pm2"
[[ -n "$PM2_BIN" ]] || die "未找到 pm2"

current="$(git rev-parse --short HEAD)"
log "从 $current 回滚到 $target"
git reset --hard "$target" >/dev/null
npx prisma generate >/dev/null 2>&1 || log "prisma generate 跳过（可能无需变更）"
npm run build
"$PM2_BIN" startOrRestart ecosystem.config.cjs --only ruda-fashion --update-env
"$PM2_BIN" save
sleep 5
SMOKE_BASE_URL="${SMOKE_BASE_URL:-https://modaui.com}" npm run smoke:post-deploy
printf '{"at":"%s","from":"%s","to":"%s","result":"manual-rollback"}\n' \
  "$(date -Iseconds)" "$current" "$target" >>"$HISTORY_DIR/$(date +%Y%m).jsonl"
log "回滚完成：$target"
