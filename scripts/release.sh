#!/usr/bin/env bash
# 发版：自动 bump 版本号 → commit → tag → push Gitee + GitHub
#
# GitHub 收到 v* tag 后会跑 .github/workflows/release.yml，自动打 macOS/Windows 安装包。
#
# 用法:
#   ./scripts/release.sh              # patch +1 (0.1.0 → 0.1.1)
#   ./scripts/release.sh minor        # 0.1.0 → 0.2.0
#   ./scripts/release.sh major        # 0.1.0 → 1.0.0
#   ./scripts/release.sh 0.2.0        # 指定版本
#   ./scripts/release.sh patch --dry-run
#   ./scripts/release.sh --current    # 首次发 v0.1.0：不 bump，只打 tag
#   ./scripts/release.sh -y patch     # 跳过确认
#   Windows PowerShell: .\scripts\release.ps1 patch
#
# 环境变量:
#   ORIGIN_REMOTE=origin   默认 origin (Gitee)
#   GITHUB_REMOTE=github   默认 github
set -euo pipefail

resolve_python() {
  local cmd
  for cmd in python3 python; do
    if command -v "$cmd" >/dev/null 2>&1 && "$cmd" -c "pass" >/dev/null 2>&1; then
      echo "$cmd"
      return 0
    fi
  done
  echo "错误: 需要 Python（python3 或 python）" >&2
  exit 1
}

PYTHON="$(resolve_python)"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

ORIGIN_REMOTE="${ORIGIN_REMOTE:-origin}"
GITHUB_REMOTE="${GITHUB_REMOTE:-github}"
DRY_RUN=0
ASSUME_YES=0
BUMP_ARG=""
USE_CURRENT=0

usage() {
  sed -n '2,19p' "$0" | sed 's/^# \?//'
  exit "${1:-0}"
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    -h|--help) usage 0 ;;
    -n|--dry-run) DRY_RUN=1; shift ;;
    -y|--yes) ASSUME_YES=1; shift ;;
    -c|--current) USE_CURRENT=1; shift ;;
    patch|minor|major|[0-9]*.[0-9]*.[0-9]*)
      BUMP_ARG="$1"
      shift
      ;;
    *)
      echo "未知参数: $1" >&2
      usage 1
      ;;
  esac
done

if [[ "$USE_CURRENT" -eq 1 ]]; then
  BUMP_ARG=""
elif [[ -z "$BUMP_ARG" ]]; then
  BUMP_ARG="patch"
fi

PKG_JSON="$ROOT/package.json"
TAURI_CONF="$ROOT/src-tauri/tauri.conf.json"
CARGO_TOML="$ROOT/src-tauri/Cargo.toml"

for f in "$PKG_JSON" "$TAURI_CONF" "$CARGO_TOML" "$ROOT/site/js/config.js"; do
  if [[ ! -f "$f" ]]; then
    echo "错误: 找不到 $f" >&2
    exit 1
  fi
done

read_current_version() {
  "$PYTHON" - <<'PY'
import json, re
from pathlib import Path

root = Path(".")
pkg = json.loads(root.joinpath("package.json").read_text(encoding="utf-8"))
print(pkg["version"])
PY
}

compute_next_version() {
  local current="$1"
  local bump="$2"
  "$PYTHON" - <<PY
import re, sys

current = "$current"
bump = "$bump"

if re.fullmatch(r"\d+\.\d+\.\d+", bump):
    print(bump)
    sys.exit(0)

m = re.fullmatch(r"(\d+)\.(\d+)\.(\d+)", current)
if not m:
    raise SystemExit(f"当前版本号格式无效: {current}")

major, minor, patch = map(int, m.groups())
if bump == "patch":
    patch += 1
elif bump == "minor":
    minor += 1
    patch = 0
elif bump == "major":
    major += 1
    minor = 0
    patch = 0
else:
    raise SystemExit(f"无效的 bump 类型: {bump}")

print(f"{major}.{minor}.{patch}")
PY
}

write_versions() {
  local version="$1"
  "$PYTHON" - <<PY
import json, re
from pathlib import Path

version = "$version"
root = Path(".")

pkg_path = root / "package.json"
pkg = json.loads(pkg_path.read_text(encoding="utf-8"))
pkg["version"] = version
pkg_path.write_text(json.dumps(pkg, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

lock_path = root / "package-lock.json"
if lock_path.exists():
    lock = json.loads(lock_path.read_text(encoding="utf-8"))
    lock["version"] = version
    if "" in lock.get("packages", {}):
        lock["packages"][""]["version"] = version
    lock_path.write_text(json.dumps(lock, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

tauri_path = root / "src-tauri" / "tauri.conf.json"
tauri = json.loads(tauri_path.read_text(encoding="utf-8"))
tauri["version"] = version
tauri_path.write_text(json.dumps(tauri, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

cargo_path = root / "src-tauri" / "Cargo.toml"
cargo_text = cargo_path.read_text(encoding="utf-8")
cargo_text, n = re.subn(
    r'^(version\s*=\s*")[^"]+(")\s*$',
    rf'\g<1>{version}\g<2>',
    cargo_text,
    count=1,
    flags=re.MULTILINE,
)
if n != 1:
    raise SystemExit("无法在 Cargo.toml 中更新 version 字段")
cargo_path.write_text(cargo_text, encoding="utf-8")

site_config = root / "site" / "js" / "config.js"
if site_config.exists():
    tag = f"v{version}"
    site_config.write_text(
        f'''/** 发版时由 scripts/release.sh 自动同步 version / tag / assets */
window.VIBESTART_RELEASE = {{
  version: "{version}",
  tag: "{tag}",
  product: "VibeStart",
  github: {{ owner: "jiukemi", repo: "vibestart" }},
  gitee: {{ owner: "webhwh", repo: "vibestart" }},
  assets: {{
    macArm: "VibeStart_{version}_aarch64.dmg",
    macIntel: "VibeStart_{version}_x64.dmg",
    win: "VibeStart_{version}_x64-setup.exe",
  }},
}};
''',
        encoding="utf-8",
    )

print(version)
PY
}

CURRENT="$(read_current_version)"
if [[ "$USE_CURRENT" -eq 1 ]]; then
  NEXT="$CURRENT"
else
  NEXT="$(compute_next_version "$CURRENT" "$BUMP_ARG")"
fi
TAG="v${NEXT}"
BRANCH="$(git branch --show-current)"

if [[ "$BRANCH" != "main" && "$BRANCH" != "master" ]]; then
  echo "警告: 当前分支是 ${BRANCH}，通常应在 main 上发版" >&2
fi

if ! git remote get-url "$ORIGIN_REMOTE" >/dev/null 2>&1; then
  echo "错误: 缺少 remote ${ORIGIN_REMOTE}" >&2
  exit 1
fi

if ! git remote get-url "$GITHUB_REMOTE" >/dev/null 2>&1; then
  echo "错误: 缺少 remote ${GITHUB_REMOTE}" >&2
  echo "请先运行: ./scripts/setup-github.sh https://github.com/你的用户名/vibestart.git" >&2
  exit 1
fi

if [[ -n "$(git status --porcelain)" ]]; then
  echo "错误: 工作区有未提交改动，请先 commit 或 stash" >&2
  git status --short
  exit 1
fi

if git rev-parse "$TAG" >/dev/null 2>&1; then
  echo "错误: 标签 ${TAG} 已存在" >&2
  exit 1
fi

echo "==> 发版计划"
echo "  当前版本: ${CURRENT}"
echo "  新版本:   ${NEXT}"
echo "  标签:     ${TAG}"
echo "  分支:     ${BRANCH}"
echo "  推送:     ${ORIGIN_REMOTE} + ${GITHUB_REMOTE}"
echo ""

if [[ "$DRY_RUN" -eq 1 ]]; then
  if [[ "$NEXT" != "$CURRENT" ]]; then
    echo "[dry-run] 将更新 package.json / tauri.conf.json / Cargo.toml"
    echo "[dry-run] git commit -m \"chore: release ${TAG}\""
  else
    echo "[dry-run] 版本不变 (${CURRENT})，仅打 tag 推送"
  fi
  echo "[dry-run] git tag ${TAG}"
  echo "[dry-run] git push ${ORIGIN_REMOTE} ${BRANCH} && git push ${GITHUB_REMOTE} ${BRANCH}"
  echo "[dry-run] git push ${ORIGIN_REMOTE} ${TAG} && git push ${GITHUB_REMOTE} ${TAG}"
  exit 0
fi

if [[ "$ASSUME_YES" -ne 1 ]]; then
  read -r -p "确认发版 ${TAG}? [y/N] " ans
  if [[ "${ans,,}" != "y" && "${ans,,}" != "yes" ]]; then
    echo "已取消"
    exit 0
  fi
fi

echo "==> 写入版本号 ${NEXT}"
if [[ "$NEXT" != "$CURRENT" ]]; then
  write_versions "$NEXT" >/dev/null
  echo "==> 提交"
  git add package.json package-lock.json src-tauri/tauri.conf.json src-tauri/Cargo.toml site/js/config.js
  git commit -m "$(cat <<EOF
chore: release ${TAG}

Bump version ${CURRENT} → ${NEXT}
EOF
)"
else
  echo "  版本已是 ${CURRENT}，跳过 bump"
fi

echo "==> 打标签 ${TAG}"
git tag -a "$TAG" -m "Release ${TAG}"

echo "==> 推送分支 ${BRANCH}"
git push "$ORIGIN_REMOTE" "$BRANCH"
git push "$GITHUB_REMOTE" "$BRANCH"

echo "==> 推送标签 ${TAG}（GitHub 将触发 Actions 打包）"
git push "$ORIGIN_REMOTE" "$TAG"
git push "$GITHUB_REMOTE" "$TAG"

echo ""
echo "完成: ${TAG}"
echo ""
echo "下一步:"
echo "  1. GitHub → Actions → release workflow 跑完后"
echo "  2. GitHub → Releases → 检查 Draft，确认附件齐全后 Publish"
echo "  3. Gitee Release：若已配置 GitHub Secret GITEE_TOKEN，Actions 会自动同步安装包"
echo "     否则手动: GITEE_TOKEN=xxx ./scripts/sync-gitee-release.sh ${TAG}"
echo "  4. Windows 上安装验收 → 介绍站 site/ 已指向 ${TAG} 下载链"
echo ""
echo "  GitHub Actions: $(git remote get-url "$GITHUB_REMOTE" | sed 's/\.git$//')/actions"
echo "  GitHub Releases: $(git remote get-url "$GITHUB_REMOTE" | sed 's/\.git$//')/releases"
echo "  Gitee Releases: https://gitee.com/webhwh/vibestart/releases/tag/${TAG}"
