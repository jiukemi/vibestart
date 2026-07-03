# 国内镜像与 Gitee 托管（可执行步骤）

VibeStart **不拆 Lite/Full 包**。慢或难访问的资源由维护者上传到 **Gitee Release**，应用内默认 **npmmirror** 安装 npm 包。

---

## 一、你要准备的 Gitee 仓库（一次性）

1. 在 Gitee 新建仓库，例如：`https://gitee.com/你的用户名/vibestart-mirrors`
2. 仓库用途：**只放 Release 安装包**，不必放代码
3. 打开「发行版 / Releases」权限（Gitee 企业/个人均支持 Release 附件）

---

## 二、构建并上传 codex-bridge（维护者本机执行）

### 2.1 打 zip 包

在项目根目录：

```bash
chmod +x scripts/prepare-codex-bridge-mirror.sh
./scripts/prepare-codex-bridge-mirror.sh ./mirror-out
```

脚本会：

- 克隆 [xiaoshaoning/codex-bridge](https://github.com/xiaoshaoning/codex-bridge)（维护者机器上执行一次，用户机器**不再** git clone）
- 用 `registry.npmmirror.com` 执行 `npm install` + `npm run build`
- 产出：
  - `mirror-out/codex-bridge-prebuilt-macos-aarch64.zip`（或当前平台名）
  - `mirror-out/codex-bridge-source.zip`（无 node_modules，备用）

> Windows 维护者：在 Git Bash 或 WSL 跑同一脚本；或在 Windows 上手动 zip `dist/`、`package.json`、`package-lock.json`、`node_modules/` 到同名文件。

### 2.2 创建 Gitee Release

1. 进入 `vibestart-mirrors` → **发行版** → **创建发行版**
2. **标签名**：`codex-bridge-v1.0.0`（与 `mirrors.json` 里 `tag` 一致）
3. **上传附件**：
   - `codex-bridge-prebuilt-macos-aarch64.zip`
   - `codex-bridge-prebuilt-macos-x64.zip`（若支持 Intel Mac）
   - `codex-bridge-prebuilt-windows-x64.zip`
   - `codex-bridge-source.zip`（可选备用）
4. 发布后复制下载链接，格式类似：  
   `https://gitee.com/你的用户名/vibestart-mirrors/releases/download/codex-bridge-v1.0.0/codex-bridge-prebuilt-macos-aarch64.zip`

### 2.3 修改 VibeStart 镜像配置

编辑 `src-tauri/resources/mirrors.json`：

```json
{
  "gitee_release_base": "https://gitee.com/你的用户名/vibestart-mirrors/releases/download",
  "artifacts": {
    "codex_bridge_prebuilt": {
      "tag": "codex-bridge-v1.0.0",
      "windows_x86_64": "codex-bridge-prebuilt-windows-x64.zip",
      "macos_aarch64": "codex-bridge-prebuilt-macos-aarch64.zip",
      "macos_x86_64": "codex-bridge-prebuilt-macos-x64.zip"
    }
  }
}
```

重新打包 VibeStart：

```bash
npm run build
npm run tauri build
```

---

## 三、（可选）CC Switch 安装包镜像

winget/brew 失败时的兜底：

1. 从 [CC Switch 官网](https://ccswitch.io) 下载 `.exe` / `.dmg`
2. 上传到 Gitee Release，例如 tag `cc-switch-latest`
3. 在 `mirrors.json` 填写：

```json
"cc_switch": {
  "windows_x86_64": "CC-Switch-Setup.exe",
  "macos_universal": "CC-Switch.dmg"
}
```

并在 `gitee_release_base` 下使用路径：  
`.../releases/download/cc-switch-latest/文件名`

（后续版本可在安装器里接此 URL；当前以 winget/brew + 手动下载为主。）

---

## 四、用户侧：无需额外配置

| 操作 | 网络来源 |
|------|----------|
| 一键装 Codex / vercel 等 npm 包 | 国内 npmmirror（应用自动注入） |
| 一键装 DeepSeek 桥 | **优先 Gitee 预构建 zip** → 失败则 Gitee 源码 zip + npm → 最后才 git clone GitHub |
| 验证 DeepSeek Key | 国内 API |
| Codex 对话 | localhost 桥 + 国内 API |

用户**不需要**科学上网即可完成 Codex + DeepSeek 主路径（Gitee 已配置的前提下）。

---

## 五、本地覆盖镜像（高级 / 内网）

在用户机器创建 `~/.vibestart/mirrors.override.json`，字段与 `mirrors.json` 相同，会覆盖内置配置。适合学校内网自建 HTTP 镜像。

---

## 六、验收清单

- [ ] `mirrors.json` 中已无 `YOUR_GITEE_USER`
- [ ] Gitee Release 附件浏览器直链可下载（未登录也能下，或 Gitee 公开仓库）
- [ ] VibeStart → Codex 桥接 → **一键安装 DeepSeek 桥** 日志出现「从 Gitee 下载预构建包」
- [ ] 安装后 `~/.vibestart/tools/codex-bridge/dist/server.js` 存在
- [ ] **启动 DeepSeek 桥** → 健康检查 `8098/health` 通过
- [ ] 断 GitHub（ hosts 屏蔽）后重装 bridge 仍成功

---

## 七、发新版 bridge 时

1. 重新跑 `scripts/prepare-codex-bridge-mirror.sh`
2. 新建 Gitee Release tag（如 `codex-bridge-v1.0.1`）
3. 更新 `mirrors.json` 的 `tag` 与 `version`
4. 发 VibeStart 新版本（或仅更新 mirrors 后重打安装包）

---

## 相关文件

| 文件 | 作用 |
|------|------|
| `src-tauri/resources/mirrors.json` | 内置镜像地址 |
| `src-tauri/src/mirrors.rs` | 下载、npm registry、URL 解析 |
| `src-tauri/src/codex_bridge.rs` | bridge 安装逻辑 |
| `src-tauri/src/installer.rs` | npm 一键安装注入 registry |
