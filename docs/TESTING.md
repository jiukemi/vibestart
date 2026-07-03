# VibeStart 手动 E2E 测试清单

适用于 **macOS** 与 **Windows** 的完整向导 + 工作台流程。平台差异见 [PLATFORMS.md](./PLATFORMS.md)。

测试前可选：清除 `localStorage` 键 `vibestart-wizard` 以模拟新用户。

## 环境准备

### macOS

- [ ] macOS 12+，已安装 Xcode Command Line Tools
- [ ] 可访问所选 LLM API 服务商
- [ ] 终端可运行 `npm run tauri dev` 启动应用

### Windows

- [ ] Windows 10/11，已启用 winget（Microsoft Store 应用安装程序）
- [ ] 可访问所选 LLM API 服务商
- [ ] 终端可运行 `npm run tauri dev` 启动应用

## 1. 极速轨（推荐新手 · 约 6 步）

### 欢迎 & 方向

- [ ] 欢迎页默认选中「极速轨」；可切换「完整轨」
- [ ] 侧边栏显示「极速轨」徽章与可见步骤数
- [ ] 「还不确定，先试试」或「做网站」走极速轨
- [ ] 选小程序/App 自动切换完整轨并提示；小程序方向可见「待办清单」与「点击得分」小游戏模板
- [ ] 选网页后点「重新选择方向」→ 改选小程序：须再次「确认切换」才能下一步；模板/环境/侧栏步骤已切换

### 准备环境（合并原环境检测 + 安装）

- [ ] 单页展示扫描结果 + 一键安装
- [ ] 显示当前系统（macos / windows）与安装后端（Homebrew / winget）
- [ ] 极速轨跳过「选择 IDE」「Git 托管」（侧栏不显示）

### Key → 项目 → 部署

- [ ] LLM 默认 DeepSeek；极速轨默认 Cursor（未选手动 IDE 步骤）
- [ ] 首个项目：模板预览 + 折叠的「画原型 / 后端」可选块
- [ ] Penpot / Excalidraw 链接可打开
- [ ] 部署步仅 Vercel；可跳过部署
- [ ] 完成后进入工作台

## 2. 完整轨

- [ ] 欢迎页选「完整轨」后侧栏显示 9 步（含 IDE、Git）
- [ ] 小程序/App 完整轨跳过网页部署步（或显示预览说明）
- [ ] Git 不可达时仅提示、不自动改用户选择

## 3. 工作台进阶

- [ ] 极速轨用户在工作台可「补开」IDE / Git / 环境步骤
- [ ] 切换开发方向 → 打开「准备环境」
- [ ] 后端辅助、Penpot 默认折叠
- [ ] 「打开项目文件夹」文案为 Finder（macOS）或资源管理器（Windows）

## 4. 平台专项（Windows）

- [ ] 环境扫描能识别 `%LOCALAPPDATA%\Programs\cursor\Cursor.exe`
- [ ] Claude Code 启动弹出 cmd 窗口并显示中文说明
- [ ] Git 托管步可检测 Windows 系统代理（设置 → 网络 → 代理）
- [ ] IDE Key 同步说明使用 Ctrl+, / Alt+F4 等 Windows 文案

## 5. 平台专项（macOS）

- [ ] Claude Code 启动 Terminal `.command` 脚本 + 中文说明
- [ ] 系统代理通过 scutil 检测
- [ ] Xcode 扫描仅在 `/Applications/Xcode.app` 存在时为已安装

## 6. 持久化迁移（v6）

- [ ] 从旧版 10 步升级：health-check + install-tools → setup-env
- [ ] `wizardTrack` 补全为 express 或 full

## 7. 构建

```bash
npm run build
cd src-tauri && cargo check
```

## 8. Codex + 国产模型桥接（选 Codex 时）

详见 [CODEX-BRIDGE.md](./CODEX-BRIDGE.md)。两套方案**并存**，用户自选：

| 轨 | 方案 | macOS / Win |
|----|------|-------------|
| A（默认） | CC Switch + 5 步图文 | ☐ 安装 ☐ 路由 ☐ Codex 对话 |
| B | DeepSeek 轻量桥 + 3 步图文 | ☐ 桥 health ☐ Codex 对话 |

- [ ] `~/.codex/config.toml` 为 `127.0.0.1` 本地地址，含 `wire_api = "responses"`
- [ ] `~/.codex/AGENTS.md` 中文偏好已写入
- [ ] LLM Key 验证与「桥接就绪」状态区分正确

## 测试结果记录

| 日期 | 测试人 | 平台 | 极速轨 | 完整轨 | 工作台 | 备注 |
|------|--------|------|--------|--------|--------|------|
|      |        | macOS / Win | ☐ 通过 ☐ 失败 | ☐ 通过 ☐ 失败 | ☐ 通过 ☐ 失败 |      |
