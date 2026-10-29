#!/usr/bin/env bash
# 一键同步代码到远程仓库（可选随后直接发布）。
#
#   bash scripts/sync-release.sh "提交说明"              # 校验 → 提交 → 推送到 origin/main
#   bash scripts/sync-release.sh "提交说明" --deploy     # 校验 → 提交 → 推送 → 部署上线
#   bash scripts/sync-release.sh "提交说明" --skip-tests # 跳过测试（仅限文档/注释类改动）
#
# 安全约束：
#   - 只允许在 main 分支、且远端为 rdmodasrl-spec/rudafashion-v2 时运行
#   - 工作区有未跟踪的大文件/敏感文件时不会自动提交（.env、backups 已被 gitignore）
#   - 推送后发现远端有新提交会先 rebase，绝不强推
set -Eeuo pipefail

cd "$(dirname "$0")/.."

message="${1:-}"
shift || true
deploy=false
skip_tests=false
for arg in "$@"; do
  case "$arg" in
    --deploy) deploy=true ;;
    --skip-tests) skip_tests=true ;;
    *) echo "未知参数: $arg" >&2; exit 2 ;;
  esac
done

log()  { printf '[sync] %s\n' "$*"; }
die()  { printf '[sync][error] %s\n' "$*" >&2; exit 1; }

[[ -n "$message" ]] || die "缺少提交说明：bash scripts/sync-release.sh \"改了什么\""
[[ -d .git ]] || die "当前目录不是 Git 仓库"

branch="$(git rev-parse --abbrev-ref HEAD)"
[[ "$branch" == "main" ]] || die "只允许在 main 分支同步（当前：$branch）"

remote_url="$(git remote get-url origin 2>/dev/null || true)"
[[ "$remote_url" == *"rdmodasrl-spec/rudafashion-v2"* ]] || die "origin 不是 rudafashion-v2（当前：${remote_url:-未配置}）"

log "1/6 拉取远端最新（不覆盖本地改动）"
git fetch origin --quiet
if git rev-parse --verify --quiet origin/main >/dev/null; then
  if ! git merge-base --is-ancestor origin/main HEAD; then
    log "远端有新提交，先 rebase"
    git pull --rebase --autostash origin main
  fi
fi

if [[ "$skip_tests" == false ]]; then
  log "2/6 类型检查 npx tsc --noEmit"
  npx tsc --noEmit
  log "3/6 单元测试 npm run test:unit"
  npm run test:unit 2>&1 | tail -8
else
  log "2-3/6 已跳过类型检查与测试（--skip-tests）"
fi

log "4/6 构建 npm run build"
npm run build >/tmp/ruda-sync-build.log 2>&1 || { tail -30 /tmp/ruda-sync-build.log >&2; die "构建失败"; }
tail -3 /tmp/ruda-sync-build.log

if [[ -z "$(git status --porcelain)" ]]; then
  log "没有需要提交的改动"
else
  log "5/6 提交改动"
  git add -A
  staged="$(git diff --cached --name-only)"
  if [[ -z "$staged" ]]; then
    log "暂存区为空，跳过提交"
  else
    printf '%s\n' "$staged" | head -20
    total="$(printf '%s\n' "$staged" | wc -l)"
    log "共 $total 个文件"
    if printf '%s\n' "$staged" | grep -Eq '(^|/)\.env$|\.pem$|\.key$|\.p12$'; then
      die "暂存区包含疑似密钥文件，已中止。请先调整 .gitignore 或移除这些文件"
    fi
    git -c user.name="$(git config user.name || echo ddddd)" \
        -c user.email="$(git config user.email || echo climenevandyck@gmail.com)" \
        commit -q -m "$message" -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
    git --no-pager log --oneline -1
  fi
fi

log "6/6 推送到 origin/main"
git push origin HEAD:main
git --no-pager log --oneline -1

if [[ "$deploy" == true ]]; then
  deploy_root="${RUDA_DEPLOY_DIR:-/www/wwwroot/ruda.fashion}"
  [[ -f "$deploy_root/scripts/deploy-release.sh" ]] || die "发布目录不存在或缺少 deploy-release.sh：$deploy_root"
  log "开始发布上线（目录：$deploy_root）"
  ( cd "$deploy_root" && bash scripts/deploy-release.sh --confirm )
else
  log "完成。需要上线请追加 --deploy，或手动执行 bash scripts/deploy-release.sh --confirm"
fi
