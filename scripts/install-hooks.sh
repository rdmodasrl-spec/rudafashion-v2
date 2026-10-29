#!/usr/bin/env bash
# 启用仓库自带的 Git 钩子（pre-push 闸门）。可重复执行。
set -Eeuo pipefail
cd "$(dirname "$0")/.."
git config core.hooksPath .githooks
chmod +x .githooks/* 2>/dev/null || true
echo "[hooks] core.hooksPath=$(git config core.hooksPath)"
echo "[hooks] 已启用：$(ls .githooks | tr '\n' ' ')"
