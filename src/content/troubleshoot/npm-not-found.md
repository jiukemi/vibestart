# npm 未找到 / Vercel CLI 安装失败

## 现象 B：`不是有效的 Win32 应用程序`（os error 193）

日志类似：

```text
无法执行 npm: %1 不是有效的 Win32 应用程序。 (os error 193)
```

## 原因

Node 安装目录里有两个「npm」：

| 文件 | 用途 |
|------|------|
| `npm.cmd` | Windows 真正可执行的入口 ✅ |
| `npm`（无扩展名） | 给 Git Bash 用的 Unix 脚本 ❌ |

若误把无扩展名的 `npm` 当程序运行，就会报 **193**。这与系统显示 **x86_64** 并不矛盾——不是装了 Win32 包，而是**选错了文件**。

向导内一键安装 Node（winget `OpenJS.NodeJS.LTS`）在 64 位 Windows 上装的是 **64 位 Node**，不会故意装 Win32 版。

## 解决

1. **重启 VibeStart** 后再点「重新检测」→ 安装 Vercel CLI（新版本会优先用 `npm.cmd`）
2. 或 PowerShell 手动安装：

```powershell
& "$env:ProgramFiles\nodejs\npm.cmd" install --prefix "$env:USERPROFILE\.vibestart\tools\npm" -g vercel
```

## 现象 A：`program not found`

在「**部署**」步选择 Vercel 并点击 **一键安装 Vercel CLI**（或 Claude Code 等 npm 工具）时，日志出现：

```text
无法执行 npm: program not found
```

或安装位置说明后紧跟上述报错。Node.js 可能已显示 ✅，但 npm 相关安装仍失败。

## 原因（白话）

1. **Node.js 与 npm 是两套路径**：VibeStart 把 Vercel CLI 装到 `%USERPROFILE%\.vibestart\tools\npm`，但执行安装时要用**系统自带的 npm**（随 Node 安装，通常在 `C:\Program Files\nodejs\npm.cmd`）。
2. **Windows PATH 未刷新**：用 winget 刚装好 Node 后，**未重启 VibeStart**，当前进程的环境变量里还没有 `npm`。
3. **Node 未真正装好**：只有旧版 Node、或安装不完整，没有 npm.cmd。

> **说明**：Node.js **不要求很高版本**，只要已安装且能运行 npm 即视为就绪（用于装 Vercel CLI 等）。

## 解决步骤

### 1. 确认 Node / npm 在系统里可用

打开 **PowerShell**（新开窗口，不要用旧终端），运行：

```powershell
node --version
npm --version
```

两条都能输出版本号再继续。若 `npm` 报错，先安装 Node LTS：

```powershell
winget install OpenJS.NodeJS.LTS
```

安装完成后**关闭 PowerShell 再开**，重复上面两条命令。

### 2. 重启 VibeStart

完全退出应用（托盘也退出），再运行 `npm run tauri dev` 或重新打开安装包。  
winget 安装 Node 后，**必须重启 VibeStart** 才能继承新的 PATH。

### 3. 在向导里重试

1. 回到「准备环境」
2. 点击 **重新检测** — Node.js 应显示 ✅
3. 再次点击 **Vercel CLI** 旁的「安装」

### 4. 手动安装 Vercel CLI（备用）

若一键安装仍失败，在 PowerShell 中执行（与向导相同，装到 VibeStart 目录）：

```powershell
npm install --prefix "$env:USERPROFILE\.vibestart\tools\npm" -g vercel
```

然后回到向导点 **重新检测**。

### 5. macOS 用户

若 `npm` 找不到，常见是 Homebrew 的 Node 未进 PATH：

```bash
brew install node
# 或
brew link node
```

重启 VibeStart 后再试。

## 仍不行？

- 检查是否安装了 **nvm** 等多版本管理器：请在**当前默认 Node** 下确认 `npm --version` 可用。
- 公司电脑若禁止修改 PATH，联系管理员将 Node 安装目录加入用户 PATH。
- 部署阶段可暂时改用 **Gitee Pages / GitHub Pages**，跳过 Vercel CLI。
