#!/usr/bin/env bash
# 一次性：添加 GitHub 远端并推送 main
#
# 用法:
#   ./scripts/setup-github.sh https://github.com/你的用户名/vibestart.git
#
# 前置：在 GitHub 网页新建空仓库（Public 推荐，Actions 免费），不要勾选 README。
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

GITHUB_URL="${1:-${GITHUB_REPO_URL:-}}"

if [[ -z "$GITHUB_URL" ]]; then
  echo "用法: $0 https://github.com/你的用户名/vibestart.git" >&2
  echo "或:   GITHUB_REPO_URL=... $0" >&2
  exit 1
fi

if ! git rev-parse --git-dir >/dev/null 2>&1; then
  echo "错误: 当前目录不是 git 仓库" >&2
  exit 1
fi

BRANCH="$(git branch --show-current)"
if [[ -z "$BRANCH" ]]; then
  echo "错误: 无法检测当前分支" >&2
  exit 1
fi

echo "==> 配置 GitHub 远端: $GITHUB_URL"
if git remote get-url github >/dev/null 2>&1; then
  git remote set-url github "$GITHUB_URL"
  echo "  已更新 remote github"
else
  git remote add github "$GITHUB_URL"
  echo "  已添加 remote github"
fi

echo ""
echo "==> 当前 remotes"
git remote -v
echo ""

echo "==> 推送 ${BRANCH} 到 origin (Gitee) 与 github"
git push origin "$BRANCH"
git push -u github "$BRANCH"

echo ""
echo "完成。请继续在 GitHub 网页确认："
echo "  1. Settings → Actions → General → Workflow permissions → Read and write"
echo "  2. Settings → Actions → General → Allow all actions"
echo ""
echo "发版："
echo "  ./scripts/release.sh          # patch +1，打 tag，双端推送，触发 GitHub Actions 打包"
echo "  ./scripts/release.sh minor    # 次版本 +1"
echo "  ./scripts/release.sh 0.2.0    # 指定版本"
