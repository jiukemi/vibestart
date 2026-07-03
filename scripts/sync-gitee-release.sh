#!/usr/bin/env bash
# 将 GitHub Release 附件同步到 Gitee Release（CI 或本地均可）
#
# CI: 由 .github/workflows/release.yml 在打包完成后自动调用
# 本地: GH_TOKEN=xxx GITEE_TOKEN=xxx ./scripts/sync-gitee-release.sh v0.1.0
#
# GitHub Secrets 需配置: GITEE_TOKEN（Gitee 私人令牌，projects 读写权限）
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

TAG="${1:-${GITHUB_REF_NAME:-}}"
if [[ -z "$TAG" ]]; then
  echo "用法: GITEE_TOKEN=xxx GH_TOKEN=xxx $0 v0.1.0" >&2
  exit 1
fi

TAG="${TAG#refs/tags/}"

GITEE_OWNER="${GITEE_OWNER:-webhwh}"
GITEE_REPO="${GITEE_REPO:-vibestart}"
GITHUB_OWNER="${GITHUB_OWNER:-jiukemi}"
GITHUB_REPO="${GITHUB_REPO:-vibestart}"
GITEE_DEFAULT_BRANCH="${GITEE_DEFAULT_BRANCH:-main}"

GH_TOKEN="${GH_TOKEN:-${GITHUB_TOKEN:-}}"
if [[ -z "$GH_TOKEN" ]]; then
  echo "错误: 需要 GH_TOKEN 或 GITHUB_TOKEN" >&2
  exit 1
fi

if [[ -z "${GITEE_TOKEN:-}" ]]; then
  echo "错误: 需要 GITEE_TOKEN" >&2
  echo "GitHub 仓库 → Settings → Secrets → Actions → 新建 GITEE_TOKEN" >&2
  echo "令牌: https://gitee.com/profile/personal_access_tokens （projects 读写）" >&2
  exit 1
fi

WORKDIR="$(mktemp -d)"
trap 'rm -rf "$WORKDIR"' EXIT

gitee_api() {
  local method="$1"
  local path="$2"
  shift 2
  curl -sS -X "$method" \
    "https://gitee.com/api/v5${path}?access_token=${GITEE_TOKEN}" \
    "$@"
}

gitee_ok() {
  local body="$1"
  [[ -n "$body" && "$body" != "null" ]] || return 1
  echo "$body" | python3 -c "
import sys, json
d = json.load(sys.stdin)
if isinstance(d, dict) and ('message' in d or 'messages' in d):
    raise SystemExit(str(d))
" 2>/dev/null
}

parse_field() {
  local body="$1"
  local field="$2"
  echo "$body" | python3 -c "
import sys, json
d = json.load(sys.stdin)
print(d['$field'])
"
}

VERSION="${TAG#v}"
TITLE="VibeStart ${TAG}"

echo "==> 读取 GitHub Release: ${GITHUB_OWNER}/${GITHUB_REPO} ${TAG}"
GH_RELEASE="$(curl -sS \
  -H "Authorization: Bearer ${GH_TOKEN}" \
  -H "Accept: application/vnd.github+json" \
  "https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/tags/${TAG}")"

ASSET_COUNT="$(echo "$GH_RELEASE" | python3 -c "
import sys, json
d = json.load(sys.stdin)
if 'message' in d:
    raise SystemExit(d['message'])
assets = d.get('assets') or []
if not assets:
    raise SystemExit('GitHub Release 尚无附件，请确认 Actions 打包已完成')
print(len(assets))
for a in assets:
    print(a['name'] + '\t' + str(a['id']))
" 2>/dev/null | head -1)" || {
  echo "错误: 无法读取 GitHub Release — $(echo "$GH_RELEASE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('message', d))" 2>/dev/null || echo "$GH_RELEASE")" >&2
  exit 1
}

if [[ "$ASSET_COUNT" -eq 0 ]]; then
  echo "错误: GitHub Release 没有可同步的附件" >&2
  exit 1
fi

echo "  找到 ${ASSET_COUNT} 个附件"

echo "==> 下载 GitHub 附件"
echo "$GH_RELEASE" > "${WORKDIR}/release.json"
python3 - "${WORKDIR}" "${GH_TOKEN}" "${GITHUB_OWNER}" "${GITHUB_REPO}" <<'PY'
import json, sys, urllib.request
from pathlib import Path

workdir, token, owner, repo = sys.argv[1:5]
release = json.loads(Path(workdir, "release.json").read_text(encoding="utf-8"))
for asset in release.get("assets", []):
    name = asset["name"]
    asset_id = asset["id"]
    url = f"https://api.github.com/repos/{owner}/{repo}/releases/assets/{asset_id}"
    req = urllib.request.Request(
        url,
        headers={
            "Authorization": f"Bearer {token}",
            "Accept": "application/octet-stream",
            "User-Agent": "vibestart-sync",
        },
    )
    out = Path(workdir) / name
    with urllib.request.urlopen(req, timeout=600) as resp, out.open("wb") as f:
        f.write(resp.read())
    print(f"  ✓ {name}")
PY

echo "==> 确保 Gitee 标签 ${TAG}"
TAG_JSON="$(gitee_api GET "/repos/${GITEE_OWNER}/${GITEE_REPO}/tags/${TAG}" 2>/dev/null || true)"
if [[ -z "$TAG_JSON" || "$TAG_JSON" == "null" ]]; then
  TAG_JSON="$(gitee_api POST "/repos/${GITEE_OWNER}/${GITEE_REPO}/tags" \
    -H "Content-Type: application/json" \
    -d "{\"tag_name\":\"${TAG}\",\"refs\":\"${GITEE_DEFAULT_BRANCH}\",\"message\":\"${TITLE}\"}")"
  if ! gitee_ok "$TAG_JSON"; then
    echo "错误: 无法创建 Gitee 标签 — $TAG_JSON" >&2
    exit 1
  fi
  echo "  已创建标签"
else
  echo "  标签已存在"
fi

echo "==> 查找或创建 Gitee Release"
RELEASE_JSON="$(gitee_api GET "/repos/${GITEE_OWNER}/${GITEE_REPO}/releases/tags/${TAG}" 2>/dev/null || true)"
if [[ -z "$RELEASE_JSON" || "$RELEASE_JSON" == "null" ]]; then
  RELEASE_JSON="$(gitee_api POST "/repos/${GITEE_OWNER}/${GITEE_REPO}/releases" \
    -H "Content-Type: application/json" \
    -d "$(python3 - <<EOF
import json
print(json.dumps({
    "tag_name": "${TAG}",
    "target_commitish": "${GITEE_DEFAULT_BRANCH}",
    "name": "${TITLE}",
    "body": "与 GitHub Actions 同步的 VibeStart 安装包。\\n\\n- macOS Apple Silicon: *_aarch64.dmg\\n- macOS Intel: *_x64.dmg\\n- Windows: *_x64-setup.exe",
}, ensure_ascii=False))
EOF
)")"
fi
if ! gitee_ok "$RELEASE_JSON"; then
  echo "错误: 无法创建 Gitee Release — $RELEASE_JSON" >&2
  exit 1
fi

RELEASE_ID="$(parse_field "$RELEASE_JSON" id)"
echo "  Release ID: ${RELEASE_ID}"

upload_gitee_file() {
  local file="$1"
  local base
  base="$(basename "$file")"
  echo "==> 上传 Gitee: ${base}"
  local resp
  resp="$(curl -sS --max-time 900 --retry 2 --retry-delay 5 \
    -X POST "https://gitee.com/api/v5/repos/${GITEE_OWNER}/${GITEE_REPO}/releases/${RELEASE_ID}/attach_files" \
    -F "access_token=${GITEE_TOKEN}" \
    -F "file=@${file}")"
  if ! gitee_ok "$resp"; then
    echo "错误: Gitee 上传失败 — $resp" >&2
    exit 1
  fi
  echo "  ✓ ${base}"
}

shopt -s nullglob
for pattern in \
  "${WORKDIR}/"*.dmg \
  "${WORKDIR}/"*.exe \
  "${WORKDIR}/"*.msi \
  "${WORKDIR}/"*.zip; do
  upload_gitee_file "$pattern"
done

echo ""
echo "完成: https://gitee.com/${GITEE_OWNER}/${GITEE_REPO}/releases/tag/${TAG}"
