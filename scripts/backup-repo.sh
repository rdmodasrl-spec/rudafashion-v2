#!/usr/bin/env bash
# 定期备份整个仓库（含全部历史）到本地 bundle，防止代码丢失。
#
#   bash scripts/backup-repo.sh              # 备份一次，保留最近 14 份
#   bash scripts/backup-repo.sh --install-cron   # 额外安装每天 03:30 的定时备份
set -Eeuo pipefail
cd "$(dirname "$0")/.."

BACKUP_DIR="${RUDA_BACKUP_DIR:-$HOME/ruda-git-backup}"
KEEP="${RUDA_BACKUP_KEEP:-14}"
mkdir -p "$BACKUP_DIR"

stamp="$(date +%Y%m%d-%H%M%S)"
bundle="$BACKUP_DIR/ruda-auto-$stamp.bundle"
git bundle create "$bundle" --all >/dev/null
echo "[backup] $bundle ($(du -h "$bundle" | cut -f1))"

ls -1t "$BACKUP_DIR"/ruda-auto-*.bundle 2>/dev/null | tail -n +$((KEEP + 1)) | while read -r old; do
  rm -f "$old"
  echo "[backup] 清理旧备份 $(basename "$old")"
done

if [[ "${1:-}" == "--install-cron" ]]; then
  repo_dir="$(pwd)"
  line="30 3 * * * cd $repo_dir && RUDA_BACKUP_DIR=$BACKUP_DIR bash scripts/backup-repo.sh >> $BACKUP_DIR/backup.log 2>&1"
  current="$(crontab -l 2>/dev/null || true)"
  if printf '%s\n' "$current" | grep -Fq "scripts/backup-repo.sh"; then
    echo "[backup] 定时任务已存在，未重复安装"
  else
    { printf '%s\n' "$current"; printf '%s\n' "$line"; } | sed '/^$/d' | crontab -
    echo "[backup] 已安装每日 03:30 自动备份"
  fi
  crontab -l | grep backup-repo.sh || true
fi
