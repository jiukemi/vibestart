# VibeStart 平台支持说明

VibeStart 目标平台：**macOS** 与 **Windows**（不支持 Linux 桌面版）。

## 功能对照

| 能力 | macOS | Windows | 说明 |
|------|-------|---------|------|
| 环境扫描（git/node/cursor 等） | ✅ | ✅ | Windows 通过 `where` + 常见安装路径 |
| 一键安装（brew / winget / npm） | ✅ Homebrew | ✅ winget / npm | winget 需 Windows 10+ 且已启用 |
| **安装目录** | ✅ 推荐 / 自定义 | ✅ 推荐 / 自定义 | Git/Node 始终系统路径；npm CLI + GUI 可自定义 |
| GUI IDE 启动（Cursor/Trae 等） | ✅ `open -a` | ✅ CLI 或 `%LOCALAPPDATA%\Programs` | 未加入 PATH 时 Windows 会尝试 exe 路径 |
| Claude Code 终端启动 | ✅ Terminal `.command` + 中文说明 | ⚠️ cmd 窗口 + 中文说明 | Windows 无 Terminal 脚本同等体验 |
| 系统代理自动检测 | ✅ `scutil --proxy` | ✅ 注册表 Internet Settings | 部分 VPN 仅写环境变量，两平台均可能漏检 |
| GitHub SSH SOCKS 代理 | ✅ `nc -X 5` | ⚠️ 弱 | Windows 默认无 `nc`，SSH 代理块可能无效；HTTPS 代理正常 |
| 微信开发者工具检测 | ✅ | ⚠️ | 自定义安装路径可能漏检，可手动确认 |
| Xcode | ✅ 仅 macOS | — | iOS 原生开发必需 macOS |
| Android Studio | ✅ | ✅ | 常见 Program Files 路径 |
| 通义灵码 | ✅ 下载页 | ✅ 下载页 | 无 winget，需手动安装；卸载需手动 |
| IDE Key 同步验证 | ✅ | ✅ | 快捷键文案已按平台区分 |
| **Codex + 国产 API** | ⚠️ 需桥接 | ⚠️ 需桥接 | 见 [CODEX-BRIDGE.md](./CODEX-BRIDGE.md)；CC Switch 或 DeepSeek 轻量桥，**不可直连**国产 base_url |

## 体验可能偏弱的场景（提前知晓）

1. **Claude Code / Codex 终端**：macOS 用 Terminal 脚本；Windows 为普通 cmd 窗口，字体/主题/中文说明排版略逊。
2. **「聚焦已有终端」**：macOS 可激活 iTerm/Terminal；Windows 仅能新开 cmd，需用户手动 Alt+Tab。
3. **GitHub SSH + SOCKS**：若你用 SSH 克隆且依赖 SOCKS，Windows 建议在 Git 托管步改 HTTPS，或手动配置 `~/.ssh/config`。
4. **微信开发者工具**：若安装到非默认目录，扫描可能显示未安装，不影响手动打开工具开发。
5. **Trae / Windsurf / 通义灵码**：部分版本 CLI 未加入 PATH，依赖 GUI 路径扫描；极端安装位置可能漏检。
6. **Xcode / iOS 打包**：仅 macOS；Windows 用户请选 Android / Flutter / 小程序等方向。
7. **Codex + 国产模型**：须本地桥接（CC Switch 或 DeepSeek 专用桥）；配置与验收见 [CODEX-BRIDGE.md](./CODEX-BRIDGE.md)。

## 开发自测

- macOS：见 [TESTING.md](./TESTING.md)「macOS」章节
- Windows：见 [TESTING.md](./TESTING.md)「Windows」章节

```bash
npm run build
cd src-tauri && cargo check
```
