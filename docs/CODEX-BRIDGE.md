# Codex 国产模型桥接方案（产品 Spec）

> 状态：**Spec 已定 · 待实现**  
> 适用：用户选择 **Codex** 为主编辑器，且 LLM Provider 为国产 OpenAI 兼容 API（DeepSeek / Kimi / 通义 / 智谱等）  
> 平台：macOS + Windows

---

## 1. 背景：为什么不能直连国产 API

OpenAI Codex CLI（2026）**只使用 Responses API**（`/v1/responses`）。  
国产大模型官方接口多为 **Chat Completions**（`/chat/completions`）。

| 做法 | 结果 |
|------|------|
| `base_url = https://api.deepseek.com/v1` 直连 | ❌ 新版 Codex 通常失败 |
| 本地 **Responses ↔ Chat 桥接** | ✅ 社区主流做法 |
| OpenAI 官方 API + 可达网络 | ✅ 无需桥接（非国产路径） |

**VibeStart 现有 `ide_sync` 直连国产 `base_url` 的逻辑应废弃**，改为「桥接模式」写 `127.0.0.1` 本地地址。

参考：[OpenAI Codex Discussion #7782](https://github.com/openai/codex/discussions/7782)

---

## 2. 双轨并存（用户自主选择）

向导 / 工作台在 **Codex + 国产 Provider** 时展示桥接方式选择：

| ID | 名称 | 推荐标签 | 适合谁 |
|----|------|----------|--------|
| `cc-switch` | **CC Switch 路由**（默认） | 推荐 · 多模型 | 要用 DeepSeek / Kimi / 通义 / 智谱等多家的用户 |
| `deepseek-bridge` | **DeepSeek 轻量桥** | 极简 · 仅 DeepSeek | 只打算用 DeepSeek、希望步骤最少 |

```text
用户选 Codex
    ↓
LLM 步选 DeepSeek / Kimi / … + 验证 Key
    ↓
「Codex 如何连接国产模型？」
    ├─ CC Switch（默认）  → 一键 winget/brew + 5 步图文
    └─ DeepSeek 轻量桥    → npm/standalone setup + 3 步图文
    ↓
VibeStart 写入 ~/.codex（见 §5）+ 一键中文（见 §6）
    ↓
健康检查通过 → 工作台「启动 Codex」
```

**OpenAI 官方 Provider**：不展示桥接选择；`model_provider = openai`，无需本地桥（仍需网络可达）。

---

## 3. 方案 A：CC Switch（默认推荐）

### 3.1 能力

- 本地代理默认 `http://127.0.0.1:15721/v1`
- 将 Codex 的 Responses 请求转为上游 Chat Completions
- 内置 **DeepSeek、Kimi、通义、智谱** 等 Chat Completions 预设
- 中文界面与文档：[ccswitch.co](https://ccswitch.co)

### 3.2 一键安装（与「装环境」同模式）

| 平台 | 命令 | VibeStart 安装器 tool id（规划） |
|------|------|----------------------------------|
| Windows | `winget install -e --id farion1231.CC-Switch` | `cc-switch` |
| macOS | `brew install --cask cc-switch` | `cc-switch` |

安装后由用户 **手动打开 CC Switch 一次**（或后续版本 `open` 启动），完成供应商与路由配置。

### 3.3 健康检查（规划）

| 检查项 | 通过条件 |
|--------|----------|
| 进程 / 端口 | `127.0.0.1:15721` 可连接（HTTP GET 或 TCP） |
| Codex 路由 | 读取 `~/.codex/config.toml` 含 `127.0.0.1:15721`（可选） |
| LLM Key | 向导内 Chat API 验证已通过（≠ Codex 已通） |

失败提示：**「Key 有效，但 Codex 桥接未就绪 → 请按图文打开 CC Switch 路由」**。

### 3.4 图文引导（5 步 · 向导内嵌）

1. **安装 CC Switch** — 点「一键安装」或从 [ccswitch.io](https://ccswitch.io) 下载；打开应用。  
2. **添加供应商** — Codex 标签 → 「+」→ 选 DeepSeek / Kimi / 通义等 → 填入 API Key → 保存。  
3. **开启本地路由** — 设置 → 路由 → 打开总开关 → 在「路由启用」中打开 **Codex**。  
4. **启用供应商** — 在列表中点击「启用」当前供应商。  
5. **重启 Codex** — 完全退出 Codex CLI / 终端窗口 → 工作台「启动编辑器」或手动 `codex`。

**注意：** 使用 Chat Completions 类预设时，「需要本地路由映射」应保持开启（CC Switch 会自动处理）。

### 3.5 VibeStart 写入的 Codex 配置（CC Switch 模式）

`~/.codex/config.toml`（用户级，**不要**写进项目 `.codex/`）：

```toml
model = "deepseek-v4-pro"
model_provider = "vibestart-bridge"

[model_providers.vibestart-bridge]
name = "VibeStart via CC Switch"
base_url = "http://127.0.0.1:15721/v1"
wire_api = "responses"
requires_openai_auth = false
env_key = "OPENAI_API_KEY"
```

`~/.codex/.env`（Key 由 VibeStart 从向导同步，**实际请求经 CC Switch 转发**）：

```env
OPENAI_API_KEY=sk-...
DEEPSEEK_API_KEY=sk-...
```

> 具体 `env_key` 以 CC Switch 当前供应商文档为准；VibeStart 同步时写入用户所选 Provider 对应变量。

**模型名**：随 CC Switch 预设更新（如 `deepseek-v4-pro` / `deepseek-v4-flash`）；避免已弃用的 `deepseek-chat` 别名（2026 年后可能失效）。

---

## 4. 方案 B：DeepSeek 轻量桥

### 4.1 能力

- 仅 **DeepSeek**，步骤更少
- 本地端口示例：`http://127.0.0.1:8098/v1`（codex-bridge）或项目文档指定端口
- 适合「极速轨 + 只 DeepSeek」叙事

### 4.2 安装方式（二选一，向导中说明）

**方式 1 — npm（需 Node，与 Codex 一致）**

```bash
git clone https://github.com/xiaoshaoning/codex-bridge.git
cd codex-bridge && npm install && npm run build
# 或后续支持: npm install -g codex-bridge（以 package 发布名为准）
export DEEPSEEK_API_KEY=sk-...
npm start
```

**方式 2 — 独立 setup（推荐图文主推）**

```bash
# 以 codex-deepseek-bridge 类工具为例，跟随其 README 的 setup 子命令
codex-deepseek-bridge setup
```

VibeStart 规划 tool id：`codex-deepseek-bridge`（安装方式待选定上游包后写入 `installer.rs`）。

### 4.3 健康检查

| 检查项 | 通过条件 |
|--------|----------|
| 端口 | `http://127.0.0.1:8098/health` 返回 OK（端口以实现为准） |
| 环境变量 | `DEEPSEEK_API_KEY` 已设置或由 bridge 托管 |

### 4.4 图文引导（3 步）

1. **安装并启动桥** — 一键安装 → 终端执行 `npm start` 或 `setup`（保持窗口/后台运行）。  
2. **确认健康检查** — VibeStart 显示「桥接就绪」。  
3. **启动 Codex** — 工作台进入项目目录运行 `codex`。

### 4.5 VibeStart 写入的 Codex 配置（DeepSeek 桥模式）

```toml
model = "deepseek-v4-pro"
model_provider = "deepseek"

[model_providers.deepseek]
name = "DeepSeek via VibeStart Bridge"
base_url = "http://127.0.0.1:8098/v1"
wire_api = "responses"
requires_openai_auth = false
supports_websockets = false
env_key = "OPENAI_API_KEY"
```

`.env`：

```env
OPENAI_API_KEY=sk-...
DEEPSEEK_API_KEY=sk-...
```

---

## 5. 配置持久化（规划 · Rust / 前端）

### 5.1 本地配置 `~/.vibestart/config.json`

```json
{
  "codex_bridge": {
    "mode": "cc-switch",
    "local_port": 15721,
    "last_provider": "deepseek"
  }
}
```

| 字段 | 说明 |
|------|------|
| `mode` | `cc-switch` \| `deepseek-bridge` \| `none`（OpenAI 官方） |
| `local_port` | 健康检查端口，默认 15721 或 8098 |
| `last_provider` | 同步 config 时使用的 LLM provider id |

### 5.2 `ide_sync.rs` 改造要点

1. 若 `primaryIde == codex` 且 provider 非 `openai` → **必须** `mode != none` 且走桥接 URL。  
2. **禁止** 再写 `base_url = https://api.deepseek.com/v1` 等到 Codex `model_providers`。  
3. 始终写 `wire_api = "responses"`。  
4. 同步成功后调用 `write_codex_chinese_prefs()`（§6）。

### 5.3 LLM Key 验证文案分离

| 状态 | 展示 |
|------|------|
| Key 验证成功 | ✅ API Key 有效 |
| 桥未就绪 | ⚠️ Codex 桥接未启动，请完成下方图文步骤 |
| 桥就绪 + Key 有效 | ✅ 可以启动 Codex |

---

## 6. 一键中文（两种桥接共用）

Codex **无完整界面汉化**；VibeStart 在同步时写入：

### 6.1 `~/.codex/AGENTS.md`

```markdown
# VibeStart · 中文协作偏好

- 始终使用**简体中文**回复与解释。
- 代码注释、提交说明建议用中文（专有名词可保留英文）。
- 执行终端命令前，用中文说明即将做什么。
- 遇到报错时，先中文概括原因，再给出修复步骤。
```

### 6.2 `~/.codex/config.toml` 追加

```toml
developer_instructions = "请用简体中文与用户交流。除非用户要求英文，否则解释、计划、总结均使用中文。"
```

### 6.3 终端启动脚本（Windows cmd / macOS Terminal）

与 Claude Code 相同：在启动 `codex` 前输出 2～3 行中文说明（项目目录、如何退出、桥接模式名称）。

---

## 7. UI 入口（规划）

| 位置 | 内容 |
|------|------|
| **选择 IDE**（PickIdeStep） | 选 Codex 时展示桥接方式卡片 |
| **LLM API Key** | Provider 非 OpenAI 时显示桥接状态条 |
| **准备环境** | 扫描：`cc-switch` 是否安装、`codex` 是否安装、桥端口是否通 |
| **工作台** | Codex 卡片显示桥接模式 + 「打开图文引导」+ 健康状态 |

### 7.1 桥接方式卡片文案

**CC Switch（默认）**

- 标题：CC Switch 路由  
- 描述：支持 DeepSeek、Kimi、通义、智谱等多家；稳定，社区验证最多。  
- 按钮：一键安装 · 图文配置  

**DeepSeek 轻量桥**

- 标题：DeepSeek 专用桥  
- 描述：步骤更少，仅适合 DeepSeek；其他模型请选 CC Switch。  
- 按钮：一键安装 · 启动桥接  

---

## 8. 实现任务清单（开发排期参考）

- [ ] `config.rs`：`CodexBridgeConfig` + 读写  
- [ ] `installer.rs`：`cc-switch` winget/brew；`codex-deepseek-bridge`（待定包名）  
- [ ] `network.rs` 或新模块：`check_local_bridge(port) -> BridgeHealth`  
- [ ] `ide_sync.rs`：按 `mode` 写 config.toml / .env；废弃直连国产 URL  
- [ ] `src/lib/codex-bridge.ts`：前端常量与类型  
- [ ] `CodexBridgePanel.tsx`：双轨选择 + 图文 + 健康状态  
- [ ] `PickIdeStep` / `LlmApiKeyStep` / `SetupEnvStep` 接入  
- [ ] `TESTING.md` § Codex 桥接验收  
- [ ] Windows + macOS 各测一轮 CC Switch 轨、DeepSeek 桥轨  

预估：**3～4 人天**（文档与 Spec 已完成，不含自研协议桥）。

---

## 9. 测试验收

### 9.1 CC Switch 轨（macOS / Windows）

- [ ] winget/brew 安装 CC Switch 成功  
- [ ] 图文 5 步完成后，`:15721` 可访问  
- [ ] `~/.codex/config.toml` 指向 `127.0.0.1:15721`，含 `wire_api = "responses"`  
- [ ] `~/.codex/AGENTS.md` 已写入中文偏好  
- [ ] 工作台启动 Codex，在项目目录能对话且无 404/400 协议错误  
- [ ] DeepSeek 与 Kimi 各测一次（若用户有 Key）  

### 9.2 DeepSeek 轻量桥轨

- [ ] 桥进程启动，`/health` 通过  
- [ ] config 指向 `127.0.0.1:8098`（或实际端口）  
- [ ] Codex 能完成一次简单代码问答  

### 9.3 回归

- [ ] OpenAI 官方 Provider + Codex：**不**要求桥接，不写 localhost  
- [ ] 选 Cursor 等非 CLI IDE：不展示 Codex 桥接面板  
- [ ] 切换桥接模式后，旧 config 被覆盖且无直连 deepseek.com  

---

## 10. 对外话术（推广 / README）

**可以说：**

> VibeStart 帮你在 Windows / macOS 上一键装好 Codex，并配置国产 API Key。  
> 可选 **CC Switch**（多模型）或 **DeepSeek 专用桥**（更简），跟着图文打开本地路由即可。  
> 自动写入中文协作偏好，不用自己啃 config.toml。

**不要说：**

> 填 DeepSeek Key 就能直连 Codex。  
> VibeStart 内置翻墙 / 提供代理节点。

---

## 11. 相关文档

- [PLATFORMS.md](./PLATFORMS.md) — 双平台差异  
- [TESTING.md](./TESTING.md) — E2E 清单  
- [BUILD.md](./BUILD.md) — 安装包构建  

---

## 12. 模板文件

实现阶段可从本文复制；也可引用仓库内：

- `docs/templates/codex/AGENTS.zh.md` — 中文偏好  
- `docs/templates/codex/config.cc-switch.toml` — CC Switch 模式  
- `docs/templates/codex/config.deepseek-bridge.toml` — DeepSeek 桥模式  
