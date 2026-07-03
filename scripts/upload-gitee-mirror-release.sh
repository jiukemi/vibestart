#!/usr/bin/env bash
# 上传 mirror-out 中的 codex-bridge 包到 Gitee Release
# 用法: GITEE_TOKEN=xxx ./scripts/upload-gitee-mirror-release.sh [mirror-out目录]
set -euo pipefail

OUT_DIR="${1:-./mirror-out}"
OUT_DIR="$(cd "$OUT_DIR" && pwd)"

GITEE_OWNER="${GITEE_OWNER:-webhwh}"
GITEE_REPO="${GITEE_REPO:-vibestart-mirrors}"
TAG="${CODEX_BRIDGE_VERSION_TAG:-codex-bridge-v1.0.0}"
TITLE="${GITEE_RELEASE_TITLE:-Codex Bridge 1.0.0}"
DEFAULT_BRANCH="${GITEE_DEFAULT_BRANCH:-master}"

if [[ -z "${GITEE_TOKEN:-}" ]]; then
  echo "错误: 需要 Gitee 私人令牌 (GITEE_TOKEN)" >&2
  echo "获取: https://gitee.com/profile/personal_access_tokens" >&2
  echo "权限: projects (读写)" >&2
  exit 1
fi

api() {
  local method="$1"
  local path="$2"
  shift 2
  curl -sS -X "$method" \
    "https://gitee.com/api/v5${path}?access_token=${GITEE_TOKEN}" \
    "$@"
}

api_ok() {
  local body="$1"
  if [[ -z "$body" || "$body" == "null" ]]; then
    return 1
  fi
  if echo "$body" | python3 -c "import sys,json; d=json.load(sys.stdin); sys.exit(0 if isinstance(d, dict) and 'message' not in d and 'messages' not in d else 1)" 2>/dev/null; then
    return 0
  fi
  return 1
}

parse_json_field() {
  local body="$1"
  local field="$2"
  echo "$body" | python3 -c "
import sys, json
data = json.load(sys.stdin)
if data is None:
    raise SystemExit('API 返回 null')
if isinstance(data, dict) and ('message' in data or 'messages' in data):
    raise SystemExit(str(data))
print(data['$field'])
"
}

echo "==> 检查 Gitee 账号"
USER_JSON="$(api GET "/user")"
if ! api_ok "$USER_JSON"; then
  echo "错误: 令牌无效 — $USER_JSON" >&2
  exit 1
fi
echo "  已登录: $(parse_json_field "$USER_JSON" login)"

echo "==> 确保镜像仓库有初始提交"
BRANCHES="$(api GET "/repos/${GITEE_OWNER}/${GITEE_REPO}/branches")"
if [[ "$BRANCHES" == "[]" ]]; then
  README_B64="$(printf '%s' "# VibeStart Mirrors

国内镜像 Release 附件仓库，无需拉取代码。" | base64 | tr -d '\n')"
  INIT_JSON="$(api POST "/repos/${GITEE_OWNER}/${GITEE_REPO}/contents/README.md" \
    -H "Content-Type: application/json" \
    -d "{\"message\":\"init mirrors repo\",\"content\":\"${README_B64}\"}")"
  if ! api_ok "$INIT_JSON"; then
    echo "错误: 无法初始化仓库 — $INIT_JSON" >&2
    exit 1
  fi
  echo "  已创建 README 初始提交 (${DEFAULT_BRANCH})"
else
  echo "  仓库已有分支"
fi

echo "==> 确保标签存在: ${TAG}"
TAG_JSON="$(api GET "/repos/${GITEE_OWNER}/${GITEE_REPO}/tags/${TAG}" 2>/dev/null || true)"
if [[ -z "$TAG_JSON" || "$TAG_JSON" == "null" ]]; then
  TAG_JSON="$(api POST "/repos/${GITEE_OWNER}/${GITEE_REPO}/tags" \
    -H "Content-Type: application/json" \
    -d "{\"tag_name\":\"${TAG}\",\"refs\":\"${DEFAULT_BRANCH}\",\"message\":\"${TITLE}\"}")"
  if ! api_ok "$TAG_JSON"; then
    echo "错误: 无法创建标签 — $TAG_JSON" >&2
    exit 1
  fi
  echo "  已创建标签"
else
  echo "  标签已存在"
fi

echo "==> 查找或创建 Release: ${TAG}"
RELEASE_JSON="$(api GET "/repos/${GITEE_OWNER}/${GITEE_REPO}/releases/tags/${TAG}")"
if [[ -z "$RELEASE_JSON" || "$RELEASE_JSON" == "null" ]]; then
  RELEASE_JSON="$(api POST "/repos/${GITEE_OWNER}/${GITEE_REPO}/releases" \
    -H "Content-Type: application/json" \
    -d "{\"tag_name\":\"${TAG}\",\"target_commitish\":\"${DEFAULT_BRANCH}\",\"name\":\"${TITLE}\",\"body\":\"VibeStart 国内镜像：codex-bridge 预构建包\"}")"
fi
if ! api_ok "$RELEASE_JSON"; then
  echo "错误: 无法创建 Release — $RELEASE_JSON" >&2
  exit 1
fi

RELEASE_ID="$(parse_json_field "$RELEASE_JSON" id)"
echo "  Release ID: ${RELEASE_ID}"

upload_file() {
  local file="$1"
  if [[ ! -f "$file" ]]; then
    echo "跳过（不存在）: $(basename "$file")"
    return 0
  fi
  echo "==> 上传 $(basename "$file")"
  local resp
  resp="$(curl -sS --max-time 600 --retry 2 --retry-delay 3 \
    -X POST "https://gitee.com/api/v5/repos/${GITEE_OWNER}/${GITEE_REPO}/releases/${RELEASE_ID}/attach_files" \
    -F "access_token=${GITEE_TOKEN}" \
    -F "file=@${file}")"
  if ! api_ok "$resp"; then
    echo "错误: 上传失败 — $resp" >&2
    exit 1
  fi
  echo "  ✓ $(parse_json_field "$resp" name)"
}

for pattern in \
  "codex-bridge-prebuilt-macos-aarch64.zip" \
  "codex-bridge-prebuilt-macos-x64.zip" \
  "codex-bridge-prebuilt-windows-x64.zip" \
  "codex-bridge-source.zip"; do
  upload_file "${OUT_DIR}/${pattern}"
done

echo ""
echo "完成: https://gitee.com/${GITEE_OWNER}/${GITEE_REPO}/releases/tag/${TAG}"
