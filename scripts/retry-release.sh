#!/usr/bin/env bash
# 不 bump 版本，重新触发 GitHub Actions 打包 + 同步 Gitee
#
# 用法:
#   ./scripts/retry-release.sh           # 默认 v0.1.0
#   ./scripts/retry-release.sh v0.1.0
#
# 需要: brew install gh && gh auth login
set -euo pipefail

TAG="${1:-v0.1.0}"
REPO="${GITHUB_REPO:-jiukemi/vibestart}"

if ! command -v gh >/dev/null 2>&1; then
  echo "错误: 需要 GitHub CLI (gh)" >&2
  echo "安装: brew install gh && gh auth login" >&2
  exit 1
fi

echo "==> 触发 GitHub Actions release: ${TAG}"
gh workflow run release \
  --repo "$REPO" \
  -f "version_tag=${TAG}"

echo ""
echo "已触发。查看进度:"
echo "  https://github.com/${REPO}/actions"
echo ""
echo "完成后:"
echo "  GitHub: https://github.com/${REPO}/releases/tag/${TAG}"
echo "  Gitee:  https://gitee.com/webhwh/vibestart/releases/tag/${TAG}"
