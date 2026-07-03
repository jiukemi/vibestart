#!/usr/bin/env bash
# 在 maintainer 机器上执行：构建 codex-bridge 并打出 Gitee Release 用的 zip
# 用法: ./scripts/prepare-codex-bridge-mirror.sh [输出目录]
set -euo pipefail

OUT_DIR="${1:-./mirror-out}"
WORK="/tmp/vibestart-codex-bridge-build"
REPO="${CODEX_BRIDGE_REPO:-https://github.com/xiaoshaoning/codex-bridge.git}"
VERSION="${CODEX_BRIDGE_VERSION:-1.0.0}"
NPM_REGISTRY="${NPM_REGISTRY:-https://registry.npmmirror.com}"

rm -rf "$WORK"
mkdir -p "$WORK" "$OUT_DIR"

echo "==> 克隆 codex-bridge"
git clone --depth 1 "$REPO" "$WORK/src"
cd "$WORK/src"

echo "==> npm install (registry=$NPM_REGISTRY)"
npm install --registry="$NPM_REGISTRY"

echo "==> npm run build"
npm run build

if [[ ! -f dist/server.js ]]; then
  echo "错误: dist/server.js 不存在" >&2
  exit 1
fi

ARCH="$(uname -m)"
OS="$(uname -s | tr '[:upper:]' '[:lower:]')"
if [[ "$OS" == "darwin" ]]; then
  if [[ "$ARCH" == "arm64" ]]; then
    ZIP_NAME="codex-bridge-prebuilt-macos-aarch64.zip"
  else
    ZIP_NAME="codex-bridge-prebuilt-macos-x64.zip"
  fi
else
  ZIP_NAME="codex-bridge-prebuilt-${OS}-${ARCH}.zip"
fi
SOURCE_ZIP="codex-bridge-source.zip"

echo "==> 预构建包: $OUT_DIR/$ZIP_NAME"
(cd "$WORK/src" && zip -r "$OUT_DIR/$ZIP_NAME" . -x "node_modules/.cache/*")

echo "==> 源码包（备用，需 npm install）: $OUT_DIR/$SOURCE_ZIP"
(cd "$WORK/src" && zip -r "$OUT_DIR/$SOURCE_ZIP" . -x "node_modules/*" -x "dist/*")

echo ""
echo "完成。请将以下文件上传到 Gitee Release tag: codex-bridge-v${VERSION}"
echo "  $OUT_DIR/$ZIP_NAME"
echo "  $OUT_DIR/$SOURCE_ZIP"
if [[ "$OS" == "darwin" && "$ARCH" == "arm64" ]]; then
  echo ""
  echo "提示：当前为 Apple Silicon 包。Intel Mac 用户需要 codex-bridge-prebuilt-macos-x64.zip，"
  echo "      请在 Intel Mac 上再跑本脚本，或仅上传 source.zip 由 Intel 用户本机 npm install。"
fi
echo "然后更新 src-tauri/resources/mirrors.json 中的 gitee_release_base。"
