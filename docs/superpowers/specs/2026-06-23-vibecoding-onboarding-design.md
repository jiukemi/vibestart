# VibeCoding 入门向导 — 设计规格

> 版本：v0.2 · 日期：2026-06-23  
> 形态：**Tauri 桌面安装向导** · 平台：macOS + Windows  
> 核心理念：**0→1 Vibe Coding**（预览 Demo + 分步提示词，非完整模板代码）+ **一键部署静态页**

---

## 1. 产品定位

**产品名（工作名）**：`VibeStart`（可后续更名）

**一句话**：让零编程经验的人，在 30 分钟内完成「环境 → GitHub → 大模型 → AI 编辑器 → **用提示词从 0 做出网页** → **一键部署给朋友看**」的全链路。

**核心理念（v0.2 修订）**：
- Vibe Coding 的价值是 **0→1**：用户通过 AI 对话**自己生成代码**，而不是修改预置模板
- 安装包内置的不是「完整项目代码」，而是 **项目包（Project Pack）**：
  - 可交互 **预览 Demo**（最终效果长什么样）
  - **分步精准提示词**（复制到 Cursor 逐条执行）
  - **极简脚手架**（空文件夹 + 可选 `index.html` 空壳，无业务代码）
- MVP 终点：**一键部署静态网页**，用户获得可分享的 URL

**成功标准**：
- 用户无需阅读外部文档即可完成 MVP 全部步骤
- 用户能说出「这些代码是 AI 帮我写的，我通过提示词完成的」
- 部署后能在 5 分钟内把链接发给朋友打开
- 每一步有可自动检测的进度状态（✅ / ⚠️ / ❌）
- 任一步失败时有明确的「卡住了？」自助入口
- Mac 与 Windows 体验一致，仅安装命令/路径随 OS 变化

---

## 2. 技术架构

### 2.1 技术栈

| 层 | 选型 | 理由 |
|---|---|---|
| 桌面壳 | **Tauri 2.x** | 体积小、可调用系统命令、跨平台 |
| 前端 | **React 18 + TypeScript + Vite** | 生态成熟、组件化向导 UI |
| 样式 | **Tailwind CSS + shadcn/ui** | 快速构建、内置明暗主题支持 |
| 状态 | **Zustand** | 轻量，持久化 wizard 进度 |
| 内容 | **本地 JSON + Markdown** | MVP 离线可用；V2 可接远程内容包 |
| 系统交互 | **Tauri Shell + Rust 侧检测模块** | 执行 `git`、`node`、`ssh` 等检测与安装 |

### 2.2 架构图

```
┌─────────────────────────────────────────────────────────┐
│                    VibeStart (Tauri)                     │
├─────────────────────────────────────────────────────────┤
│  React UI Layer                                          │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐   │
│  │ Wizard   │ │ Guide    │ │ Health   │ │ Troubles │   │
│  │ Steps    │ │ Viewer   │ │ Check    │ │ hoot     │   │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘   │
│       └────────────┴────────────┴────────────┘          │
│                         │ Tauri IPC                      │
├─────────────────────────┼───────────────────────────────┤
│  Rust Core                                               │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐    │
│  │ OS Detector  │ │ Env Scanner  │ │ Installer    │    │
│  │ (mac/win)    │ │ git/node/ssh │ │ winget/brew  │    │
│  └──────────────┘ └──────────────┘ └──────────────┘    │
│  ┌──────────────┐ ┌──────────────┐                      │
│  │ SSH Helper   │ │ Proxy Config │                      │
│  │ keygen/test  │ │ (optional)   │                      │
│  └──────────────┘ └──────────────┘                      │
└─────────────────────────────────────────────────────────┘
         │                    │                    │
    系统 Shell           本地存储              外部服务
  git/node/ssh         progress.json      GitHub / LLM API
```

### 2.3 目录结构（规划）

```
fask-vebecoding/
├── src-tauri/              # Rust 后端
│   ├── src/
│   │   ├── main.rs
│   │   ├── os/mod.rs       # OS 检测
│   │   ├── env_scan.rs     # 环境扫描
│   │   ├── installer.rs    # 安装逻辑
│   │   └── ssh.rs          # SSH 密钥生成与测试
│   └── tauri.conf.json
├── src/                    # React 前端
│   ├── components/
│   │   ├── wizard/         # 向导步骤组件
│   │   ├── guide/          # 图文引导 viewer
│   │   └── ui/             # shadcn 组件
│   ├── stores/
│   │   └── wizard.ts       # 进度状态
│   ├── content/            # 引导内容（JSON + MD + 图片）
│   │   ├── steps/
│   │   ├── guides/
│   │   └── troubleshoot/
│   └── App.tsx
├── assets/guides/          # 截图占位 / 后续替换真实截图
├── docs/
└── package.json
```

---

## 3. 向导流程（7 步 MVP）

| # | 步骤 ID | 名称 | 自动检测 | 可跳过 |
|---|---|---|---|---|
| 0 | `welcome` | 欢迎 & OS 识别 | OS 版本 | — |
| 1 | `health-check` | 环境体检 | git/node/编辑器 | 否 |
| 2 | `install-tools` | 安装基础工具 | 安装后 re-scan | 已安装可跳过 |
| 3 | `pick-ide` | 选择 AI 编辑器 | 检测是否已安装 | 否 |
| 4 | `github-setup` | GitHub 账号 & 首仓库 | SSH/HTTPS 连通 | 已有账号可部分跳过 |
| 5 | `llm-api-key` | 大模型 API Key | API 调用测试 | 否 |
| 6 | `first-project` | 0→1 做网页（预览+提示词） | 检测 index.html 存在 | 否 |
| 7 | `deploy` | 一键部署静态页 | 检测 URL 可访问 | 否 |
| 8 | `complete` | 完成 & 再做一次 | — | — |

### 3.1 步骤详情

#### Step 0 — 欢迎
- 自动识别 macOS / Windows（及版本、架构 arm64/x64）
- 展示「预计耗时 ~30 分钟」
- 语言：默认中文

#### Step 1 — 环境体检
扫描项：

| 工具 | 检测命令 | 最低版本 |
|---|---|---|
| Git | `git --version` | ≥ 2.30 |
| Node.js | `node --version` | ≥ 18 LTS |
| npm/pnpm | `npm --version` | 有即可 |
| AI 编辑器 | 应用路径 / CLI | 可选 |

展示 Dashboard：每项 ✅ 已就绪 / ⚠️ 版本过低 / ❌ 未安装

#### Step 2 — 安装基础工具
- **推荐组合（默认勾选）**：Git + Node.js LTS
- **安装策略**：
  - macOS：`brew` 存在则 `brew install`，否则引导下载官方 pkg
  - Windows：`winget` 存在则 `winget install`，否则引导官方 exe 下载页
- 安装完成后自动 re-scan，更新状态
- 每步显示「正在安装…」+ 失败时的手动安装图文链接

#### Step 3 — 选择 AI 编辑器
卡片式选择（可多选，但标记「主编辑器」）：

| 工具 | 检测方式 | 安装引导 |
|---|---|---|
| Cursor | `/Applications/Cursor.app` 或 `%LOCALAPPDATA%\Programs\cursor` | 官网下载 |
| Claude Code | CLI `claude --version` | npm global / 官网 |
| Codex (OpenAI) | CLI 检测 | 官网 |
| Trae / 通义灵码 | 路径检测 | 国产 IDE 引导页 |
| 其他 | 自定义 | 仅记录选择 |

每个卡片显示：免费额度说明、是否需要 VPN、中文支持、新手友好度（1–5 星）

#### Step 4 — GitHub 设置
子步骤（Stepper 内嵌）：

1. **注册 GitHub 账号**（图文，外链 + 内置可选代理）
2. **创建第一个仓库**（图文：New repository → 命名建议 `my-first-vibe-project`）
3. **SSH Key 配置**：
   - 一键 `ssh-keygen -t ed25519`（Rust 侧执行，路径展示）
   - 复制公钥按钮
   - 图文：GitHub → Settings → SSH Keys → Add
   - 连通测试：`ssh -T git@github.com`
4. **GitHub 网络（可选）**：
   - 检测系统代理
   - 可选配置 `git config --global http.proxy`
   - 可选 GitHub 镜像（第三方，明确免责声明，默认关闭）

#### Step 5 — 大模型 API Key
卡片选择 Provider：

| Provider | 获取引导 | 验证方式 |
|---|---|---|
| DeepSeek（默认推荐） | 图文：platform.deepseek.com 注册 → API Keys | `POST /v1/chat/completions` 测试 |
| 通义千问 | 阿里云 DashScope 引导 | 同上 |
| 智谱 GLM | open.bigmodel.cn 引导 | 同上 |
| Moonshot/Kimi | platform.moonshot.cn 引导 | 同上 |
| OpenAI | platform.openai.com 引导 | 同上 |
| 自定义 OpenAI 兼容 | 填 base URL + key | 同上 |

**安全**：
- Key 仅存本地（`~/.vibestart/config.json`，权限 600）
- 引导创建项目 `.env` 模板
- 自动写入 `.gitignore` 规则说明
- 「Key 泄露了怎么办」链接

#### Step 6 — 0→1 做网页（预览 + 分步提示词）

**不是给完整代码，而是给「项目包 Project Pack」**：

```
bundled/packs/personal-profile/
├── preview.html          # 只读预览（用户看最终效果，不能抄代码）
├── preview-thumb.png     # 卡片缩略图
├── meta.json             # 名称、难度、预计时间、标签
├── scaffold/             # 复制到用户目录的极简起点
│   └── index.html        # 仅 <!DOCTYPE html><html><body></body></html>
└── prompts/
    ├── 01-structure.md   # 第 1 条提示词
    ├── 02-content.md     # 第 2 条
    ├── 03-style.md       # 第 3 条
    └── 04-polish.md      # 第 4 条（可选特效/动画）
```

**MVP 可选项目包**：

| Pack ID | 名称 | 预览效果 | 提示词步数 |
|---|---|---|---|
| `personal-profile` | 在线个人简介 | 名片式主页，头像+简介+社交链接 | 4 步 |
| `landing-page` | 产品落地页 | 单页宣传，标题+特性+CTA | 4 步 |
| `web-effect` | 网页小特效 | 粒子/渐变/打字机等纯前端效果 | 3 步 |

**交互流程**：
1. 用户选一张卡片 → 左侧看 **实时预览 Demo**，右侧看「你将用 AI 从零做出这个」
2. 点击「开始创建」→ 复制 `scaffold/` 到 `~/Projects/my-first-vibe-project`
3. 用 Cursor 打开项目文件夹
4. 向导内 **逐步展示提示词**（每步：复制按钮 + 「在 Cursor 粘贴并发送」+ 「做完了点下一步」）
5. 每步可选 **本地预览**：Tauri 内嵌 WebView 打开 `index.html` 验证效果
6. 全部提示词完成后 → 进入部署步骤

**「再做一次」机制（Step 8 完成页）**：
- 同一 Pack 提供 **自由模式**：只给预览 Demo + 一条开放式提示词，不给分步引导
- 或换另一个 Pack 再来一遍

#### Step 7 — 一键部署静态页（双通道）

**目标**：用户点一次，获得可分享 URL，可发给朋友。

**UI**：两张部署卡片，用户二选一（可切换重试）：

| | GitHub Pages | Vercel（推荐新手） |
|---|---|---|
| 速度 | 1–3 分钟 | ~30 秒 |
| 前置 | Step 4 已配 GitHub + SSH | 需 Vercel 账号（向导图文注册） |
| URL 形式 | `https://{user}.github.io/{repo}/` | `https://{project}.vercel.app` |
| 适合 | 想学 Git 工作流 | 想最快看到上线效果 |

---

**通道 A — GitHub Pages**（与 Step 4 衔接）：

1. 检测项目目录有 `index.html`
2. 一键执行（Rust 侧，用户确认后）：
   ```bash
   cd ~/Projects/my-first-vibe-project
   git init && git add . && git commit -m "My first vibe coding page"
   git branch -M main
   git remote add origin git@github.com:{username}/my-first-vibe-project.git
   git push -u origin main
   ```
3. 通过 GitHub API / `gh` CLI 开启 Pages（source=main, path=/）
4. 轮询直到 URL 可访问

**通道 B — Vercel**（MVP 纳入）：

1. 检测 / 安装 Vercel CLI：`npm i -g vercel`（Node 已在 Step 2 安装）
2. 未登录时：图文引导注册 vercel.com → 执行 `vercel login`（浏览器 OAuth）
3. 一键部署（Rust 侧）：
   ```bash
   cd ~/Projects/my-first-vibe-project
   vercel --yes --prod
   ```
4. 解析 CLI stdout 中的 Production URL，或 `vercel inspect` 获取
5. 展示链接 + 复制按钮 + QR 码

**Vercel 账号引导**（内嵌子步骤）：
- 图文：vercel.com → Sign Up → 可用 GitHub 账号一键登录（与 Step 4 呼应）
- 「用 GitHub 登录 Vercel」降低注册成本

**部署前检查**（两通道共用）：
- 无 API Key / 密码等敏感文件（扫描 `.env` 并警告）
- `index.html` 存在且非空
- 部署失败时：展示日志 + 故障自助链接

**默认推荐**：首次部署默认选中 **Vercel**（更快获得正反馈）；GitHub Pages 标注「同时学会 Git 发布流程」

#### Step 8 — 完成
- 庆祝页：展示部署 URL + 「发给朋友看看」
- 进度回顾 + 导出配置摘要（不含 Key）
- **再做一次**入口：换 Pack 或自由模式
- 进阶（V2）：第二个项目、MCP、Vercel 备选部署

---

## 4. UI/UX 设计原则

### 4.1 布局
- **左侧**：步骤导航（7 步，显示完成状态）
- **中间**：当前步骤内容（图文 + 操作按钮）
- **右侧**（可折叠）：「卡住了？」故障快捷入口

### 4.2 主题
- 跟随系统明暗模式，支持手动切换
- 所有颜色使用 Tailwind semantic tokens（`bg-background`, `text-foreground` 等）
- 截图在暗色模式下使用边框/阴影区分，避免白图刺眼

### 4.3 交互
- 每步底部：**上一步 | 跳过（若允许）| 下一步**
- 自动检测项：进入步骤时自动跑 scan，显示 loading skeleton
- 长操作（安装、clone）：进度条 + 可展开日志

### 4.4 文案风格
- 避免术语；首次出现术语加「？」tooltip 白话解释
- 按钮动词明确：「复制公钥」「测试连接」「打开 Cursor」

---

## 5. Rust 后端模块

### 5.1 `os` — 系统检测
```rust
enum Platform { MacOS, Windows }
struct OsInfo { platform, arch, version }
```

### 5.2 `env_scan` — 环境扫描
```rust
struct ToolStatus {
  name: String,
  installed: bool,
  version: Option<String>,
  path: Option<String>,
  meets_minimum: bool,
}
```

### 5.3 `installer` — 安装器
- 优先包管理器（brew/winget），fallback 打开浏览器下载页
- 不静默强制安装；每次安装前用户确认
- 安装命令 stdout/stderr 流式回传前端

### 5.4 `ssh` — SSH 助手
- 检测 `~/.ssh/id_ed25519` 是否存在
- 不存在则生成（无 passphrase，新手友好；进阶提示可设 passphrase）
- 返回公钥内容供复制
- 执行连通测试并解析结果

### 5.5 `proxy` — 可选网络配置
- 读取系统代理设置
- 提供 git proxy 写入/清除命令（用户确认后执行）
- **不内置固定代理地址**；提供配置 UI 让用户自行填入

---

## 6. 数据模型

### 6.1 本地进度 — `~/.vibestart/progress.json`
```json
{
  "version": 1,
  "completedSteps": ["welcome", "health-check"],
  "skippedSteps": [],
  "selections": {
    "ides": ["cursor"],
    "primaryIde": "cursor",
    "llmProvider": "deepseek",
    "projectTemplate": "static-html"
  },
  "lastVisitedStep": "install-tools",
  "updatedAt": "2026-06-23T10:00:00Z"
}
```

### 6.2 敏感配置 — `~/.vibestart/config.json`（chmod 600）
```json
{
  "llm": {
    "provider": "deepseek",
    "apiKey": "sk-...",
    "baseUrl": "https://api.deepseek.com/v1"
  },
  "github": {
    "username": "optional",
    "preferredProtocol": "ssh"
  },
  "proxy": {
    "enabled": false,
    "httpProxy": ""
  }
}
```

### 6.3 引导内容 — `src/content/steps/*.json`
内容与代码分离，便于后续热更新（V2 远程拉取）：

```json
{
  "id": "github-setup",
  "title": "设置 GitHub",
  "substeps": [
    {
      "id": "register",
      "title": "注册 GitHub 账号",
      "guideRef": "guides/github/register.md",
      "images": ["assets/guides/github/register-1.png"]
    }
  ]
}
```

---

## 7. 故障自助中心

预置条目（`src/content/troubleshoot/*.md`）：

| 错误关键词 | 标题 |
|---|---|
| `git: command not found` | Git 未安装或未加入 PATH |
| `Permission denied (publickey)` | SSH Key 未配置或未添加到 GitHub |
| `npm ERR!` | Node/npm 常见问题 |
| `SSL certificate problem` | 网络/代理问题 |
| `401 Unauthorized` | API Key 无效 |
| `rate limit exceeded` | API 调用频率超限 |
| GitHub 连接超时 | 网络与代理配置 |

每条结构：**现象 → 原因（白话）→ 解决步骤 → 仍不行？**

---

## 8. 安全与合规

1. **API Key**：仅本地存储，不上传服务器；UI 中 masked 显示
2. **GitHub 代理/镜像**：可选、第三方免责声明、用户自行配置
3. **安装权限**：敏感操作需用户点击确认；Tauri 权限最小化（仅 shell、fs 必要路径）
4. **开源**：引导内容可开源；不包含任何硬编码密钥或私有代理

---

## 9. MVP 范围与 V2 路线图

### MVP（v0.1，本次实现）
- [ ] Tauri + React 脚手架
- [ ] OS 检测 + 环境体检
- [ ] Git / Node 安装引导（brew/winget + fallback）
- [ ] AI 编辑器选择与检测（Cursor 为主）
- [ ] GitHub 注册/建仓库/SSH 图文引导 + 自动 keygen
- [ ] DeepSeek + 1 个国产模型 API Key 引导与验证
- [ ] **3 个项目包**（预览 Demo + 分步提示词 + 空 scaffold）
- [ ] **分步提示词向导 UI**（复制 → Cursor → 本地预览 → 下一步）
- [ ] **双通道一键部署**（Vercel 默认 + GitHub Pages）+ URL 展示 + QR 码
- [ ] 明暗主题 + 进度持久化
- [ ] 5 条故障自助条目

### V2
- 远程 Project Pack 更新（无需发新版）
- 更多 LLM Provider
- 部署历史 / 重新部署
- 「自由模式」开放式提示词
- MCP 概念介绍
- 多语言（英文）

---

## 10. 构建与分发

| 平台 | 产物 | 说明 |
|---|---|---|
| macOS | `.dmg` / `.app` | Universal (arm64 + x64) 或分架构 |
| Windows | `.msi` / `.exe` | x64 |

- CI：GitHub Actions 双平台构建
- 代码签名：V2 考虑 Apple Developer + Windows 证书

---

## 11. 测试策略

| 类型 | 覆盖 |
|---|---|
| Rust 单元测试 | env_scan 解析、版本比较 |
| 前端组件测试 | Wizard 导航、步骤状态 |
| 手动 E2E | Mac + Windows 各跑一遍完整向导 |

---

## 12. 项目包 vs 完整模板（设计决策记录）

| | 完整模板代码 | 预览 Demo + 提示词（已采纳） |
|---|---|---|
| 符合 Vibe Coding | ❌ 用户只是改现成的 | ✅ 用户通过 AI 从 0 生成 |
| 零基础友好 | ✅ 容易跑起来 | ✅ 分步提示词降低难度 |
| 安装包体积 | 稍大 | 小（preview.html + prompts + 空 scaffold） |
| 成就感 | 低（「代码不是我写的」） | 高（「这是我跟 AI 一起做的」） |
| 部署 | 需额外一步 | 自然成为 MVP 终点 |

**安装包内置内容清单**（每个 Pack ~50–200KB）：
- `preview.html`：自包含 CSS/JS 的只读预览（可离线）
- `prompts/*.md`：4 条左右精准提示词（中文，含预期结果说明）
- `scaffold/index.html`：空壳或一行注释
- **不含** node_modules；纯静态页 **零依赖**，无需 npm install

---

## 13. 开放问题（实现前确认）

1. **产品正式名称**：VibeStart 或其他？
2. **MVP 项目包**：3 个（个人简介 / 落地页 / 网页特效）是否 OK？
3. ~~**部署方式**~~：✅ 已确认 — **Vercel + GitHub Pages 双通道**（Vercel 默认推荐）
4. **代码签名**：MVP 是否接受未签名安装包？

---

*本规格确认后，进入 Implementation Plan 阶段。*
