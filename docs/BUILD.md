# VibeStart 打包说明（macOS + Windows）

## 重要：代码适配 ≠ 安装包通用

| 概念 | 说明 |
|------|------|
| **Windows 代码适配** | 已完成：winget 安装、路径扫描、代理检测、cmd 终端等（见 [PLATFORMS.md](./PLATFORMS.md)） |
| **Windows 安装包** | 必须在 **Windows 系统**上执行 `npm run tauri build` 才会生成 `.exe` / `.msi` |
| **macOS 安装包** | 必须在 **macOS** 上打包，产出 `.dmg` / `.app` |

默认在 Mac 上跑 `npm run tauri build` **只会**打出 macOS 包。Windows 的 `.msi` **只能**在 Windows 上打；`.exe`（NSIS）**可以**在本 Mac 上交叉编译，但需额外依赖，且 Tauri 官方标为实验性。

---

## 在本 Mac 上打 Windows `.exe`（交叉编译）

**能产出**：`VibeStart_*_x64-setup.exe`（NSIS）  
**不能产出**：`.msi`（WiX 仅 Windows）

一次性安装依赖：

```bash
brew install nsis llvm
export PATH="/opt/homebrew/opt/llvm/bin:$PATH"
rustup target add x86_64-pc-windows-msvc
cargo install --locked cargo-xwin
```

打包命令：

```bash
export PATH="/opt/homebrew/opt/llvm/bin:$PATH"
npm run build:win
```

产物路径：`src-tauri/target/x86_64-pc-windows-msvc/release/bundle/nsis/`

注意：首次编译会下载 Windows SDK，耗时长；偶发链接/NSIS 报错时，改用 GitHub Actions 或 Windows 本机更稳。

---

## 本机打包

### macOS（当前机器）

```bash
npm install
npm run tauri build
```

产物：

- `src-tauri/target/release/bundle/dmg/VibeStart_0.1.0_aarch64.dmg`（Apple Silicon）
- 若在 Intel Mac 上构建，文件名为 `*_x64.dmg`

### Windows（另一台 Windows 电脑）

**前置**：Node.js LTS、Rust stable、[WebView2](https://developer.microsoft.com/microsoft-edge/webview2/)（Win10/11 通常已有）、Visual Studio C++ 构建工具（`winget install Microsoft.VisualStudio.2022.BuildTools` 并勾选「使用 C++ 的桌面开发」）。

```powershell
git clone <你的仓库地址>
cd fask-vebecoding
npm install
npm run tauri build
```

产物（路径示例）：

- `src-tauri\target\release\bundle\nsis\VibeStart_0.1.0_x64-setup.exe`
- 或 `src-tauri\target\release\bundle\msi\*.msi`

---

## CI 双平台打包（推荐）

仓库已配置 [`.github/workflows/release.yml`](../.github/workflows/release.yml)：

1. 代码 push 到 GitHub
2. 打 tag 并推送：`git tag v0.1.0 && git push origin v0.1.0`  
   或在 GitHub **Actions → release → Run workflow**
3. 并行构建：macOS aarch64、macOS x64、Windows x64
4. 产物上传到 **Draft Release**，检查无误后发布

GitHub 仓库需开启：**Settings → Actions → General → Workflow permissions → Read and write permissions**。

---

## 拷贝到另一台电脑试用

| 目标电脑 | 需要的安装包 |
|----------|--------------|
| Mac（M 系列） | `VibeStart_*_aarch64.dmg` |
| Mac（Intel） | `VibeStart_*_x64.dmg` |
| Windows 10/11 x64 | `VibeStart_*_x64-setup.exe` 或 `.msi` |

未签名包首次打开可能提示安全警告，按平台允许即可（macOS：右键 → 打开；Windows：仍要运行）。

---

## 与推广 / 上线配合

1. macOS 本机或 CI 出 `.dmg`
2. Windows 本机或 CI 出 `.exe`
3. 上传到 Gitee / GitHub Releases
4. 介绍站（Vercel / Gitee Pages）下载按钮分别链到两个平台的包
