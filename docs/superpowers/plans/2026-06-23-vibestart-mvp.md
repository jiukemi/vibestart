# VibeStart MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a cross-platform Tauri desktop wizard that guides zero-experience users through env setup, GitHub, LLM API keys, 0→1 vibe coding with prompt chains, and one-click deploy via Vercel (default) or GitHub Pages.

**Architecture:** Tauri 2 Rust core handles OS detection, shell commands (git/node/ssh/vercel), and file I/O. React + TypeScript frontend renders an 8-step wizard with shadcn/ui, Zustand for progress persistence, and bundled Project Packs (preview + prompts + empty scaffold). Content is offline-first JSON/Markdown in `src/content/`.

**Tech Stack:** Tauri 2, Rust, React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui, Zustand

**Spec:** `docs/superpowers/specs/2026-06-23-vibecoding-onboarding-design.md` (v0.2)

---

## File Map

```
fask-vebecoding/
├── src-tauri/
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   └── src/
│       ├── lib.rs                 # Tauri commands registration
│       ├── main.rs
│       ├── os.rs                  # Platform detection
│       ├── env_scan.rs            # git/node/ide detection
│       ├── installer.rs           # brew/winget install helpers
│       ├── ssh.rs                 # keygen + connectivity test
│       ├── deploy/
│       │   ├── mod.rs
│       │   ├── github_pages.rs    # git push + pages enable
│       │   └── vercel.rs          # vercel CLI deploy
│       └── project.rs             # copy scaffold, validate index.html
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── index.css
│   ├── components/
│   │   ├── layout/WizardLayout.tsx
│   │   ├── wizard/StepNav.tsx
│   │   ├── wizard/steps/          # Welcome, HealthCheck, Install, ...
│   │   ├── deploy/DeployCards.tsx
│   │   ├── packs/PackSelector.tsx
│   │   ├── packs/PromptStepper.tsx
│   │   ├── packs/PreviewPane.tsx
│   │   └── ui/                    # shadcn components
│   ├── stores/wizardStore.ts
│   ├── hooks/useTauriCommand.ts
│   ├── lib/steps.ts               # step definitions
│   └── content/
│       ├── packs/
│       │   ├── personal-profile/
│       │   ├── landing-page/
│       │   └── web-effect/
│       ├── guides/                # markdown guides
│       └── troubleshoot/
├── package.json
├── vite.config.ts
├── tailwind.config.ts
└── components.json
```

---

## Phase 1: Project Scaffold

### Task 1: Initialize Tauri + React project

**Files:**
- Create: entire project scaffold via CLI

- [ ] **Step 1: Create Tauri 2 + React TS project**

Run:
```bash
cd /Users/hwh/All_AI/fask-vebecoding
npm create tauri-app@latest . -- --template react-ts --manager npm --yes
```

If directory not empty (has docs/), init in temp and merge, or:
```bash
npm create tauri-app@latest vibestart -- --template react-ts --manager npm
# then move files to root
```

- [ ] **Step 2: Install frontend dependencies**

```bash
npm install zustand clsx tailwind-merge class-variance-authority lucide-react
npm install -D tailwindcss @tailwindcss/vite
npx shadcn@latest init -d
npx shadcn@latest add button card badge progress tabs dialog tooltip scroll-area
```

- [ ] **Step 3: Configure Tailwind dark mode**

Modify `src/index.css`:
```css
@import "tailwindcss";

@custom-variant dark (&:where(.dark, .dark *));

@theme {
  --color-background: oklch(1 0 0);
  --color-foreground: oklch(0.145 0 0);
  /* ... shadcn semantic tokens ... */
}

.dark {
  --color-background: oklch(0.145 0 0);
  --color-foreground: oklch(0.985 0 0);
}
```

- [ ] **Step 4: Verify dev build**

Run: `npm run tauri dev`
Expected: Empty window opens on macOS

- [ ] **Step 5: Commit**

```bash
git init
git add .
git commit -m "chore: scaffold Tauri 2 + React + Tailwind + shadcn"
```

---

### Task 2: Tauri permissions & shell plugin

**Files:**
- Modify: `src-tauri/Cargo.toml`
- Modify: `src-tauri/tauri.conf.json`
- Modify: `src-tauri/capabilities/default.json`

- [ ] **Step 1: Add shell plugin**

In `src-tauri/Cargo.toml`:
```toml
[dependencies]
tauri-plugin-shell = "2"
```

In `src-tauri/src/lib.rs`:
```rust
tauri::Builder::default()
    .plugin(tauri_plugin_shell::init())
    // ...
```

- [ ] **Step 2: Configure shell scope**

Allow: `git`, `node`, `npm`, `ssh`, `ssh-keygen`, `vercel`, `brew`, `winget`

In capabilities, enable shell execute for these commands.

- [ ] **Step 3: Commit**

```bash
git commit -am "chore: configure Tauri shell permissions"
```

---

## Phase 2: Rust Core Modules

### Task 3: OS detection

**Files:**
- Create: `src-tauri/src/os.rs`
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: Implement os module**

```rust
// src-tauri/src/os.rs
use serde::Serialize;

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "lowercase")]
pub enum Platform { Macos, Windows, Unknown }

#[derive(Debug, Serialize)]
pub struct OsInfo {
    pub platform: Platform,
    pub arch: String,
    pub version: String,
}

pub fn detect() -> OsInfo {
    let arch = std::env::consts::ARCH.to_string();
    let platform = if cfg!(target_os = "macos") {
        Platform::Macos
    } else if cfg!(target_os = "windows") {
        Platform::Windows
    } else {
        Platform::Unknown
    };
    let version = match platform {
        Platform::Macos => run_sw_vers().unwrap_or_default(),
        Platform::Windows => run_win_ver().unwrap_or_default(),
        Platform::Unknown => String::new(),
    };
    OsInfo { platform, arch, version }
}

fn run_sw_vers() -> Option<String> {
    std::process::Command::new("sw_vers")
        .arg("-productVersion")
        .output()
        .ok()
        .and_then(|o| String::from_utf8(o.stdout).ok())
        .map(|s| s.trim().to_string())
}

fn run_win_ver() -> Option<String> {
    std::process::Command::new("cmd")
        .args(["/C", "ver"])
        .output()
        .ok()
        .and_then(|o| String::from_utf8(o.stdout).ok())
        .map(|s| s.trim().to_string())
}
```

- [ ] **Step 2: Register Tauri command**

```rust
#[tauri::command]
fn get_os_info() -> os::OsInfo {
    os::detect()
}
```

- [ ] **Step 3: Commit**

```bash
git add src-tauri/src/os.rs src-tauri/src/lib.rs
git commit -m "feat: add OS detection command"
```

---

### Task 4: Environment scanner

**Files:**
- Create: `src-tauri/src/env_scan.rs`
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: Implement scanner**

```rust
use serde::Serialize;
use std::process::Command;

#[derive(Debug, Serialize, Clone)]
pub struct ToolStatus {
    pub name: String,
    pub installed: bool,
    pub version: Option<String>,
    pub path: Option<String>,
    pub meets_minimum: bool,
}

pub fn scan_all() -> Vec<ToolStatus> {
    vec![
        scan_command("git", &["--version"], parse_prefix_version),
        scan_command("node", &["--version"], |s| s.trim().trim_start_matches('v').to_string()),
        scan_command("npm", &["--version"], |s| s.trim().to_string()),
        scan_cursor(),
    ]
}

fn scan_command(name: &str, args: &[&str], parse: fn(&str) -> String) -> ToolStatus {
    match Command::new(name).args(args).output() {
        Ok(out) if out.status.success() => {
            let raw = String::from_utf8_lossy(&out.stdout).to_string();
            let version = parse(&raw);
            let meets = check_minimum(name, &version);
            ToolStatus {
                name: name.to_string(),
                installed: true,
                version: Some(version),
                path: which_path(name),
                meets_minimum: meets,
            }
        }
        _ => ToolStatus {
            name: name.to_string(),
            installed: false,
            version: None,
            path: None,
            meets_minimum: false,
        },
    }
}

fn check_minimum(name: &str, version: &str) -> bool {
    let parts: Vec<u32> = version.split('.').filter_map(|p| p.parse().ok()).collect();
    match name {
        "git" => parts.first().copied().unwrap_or(0) >= 2,
        "node" => parts.first().copied().unwrap_or(0) >= 18,
        _ => true,
    }
}

fn scan_cursor() -> ToolStatus {
    let paths = if cfg!(target_os = "macos") {
        vec!["/Applications/Cursor.app"]
    } else {
        vec![r"C:\Users\*\AppData\Local\Programs\cursor\Cursor.exe"]
    };
    // check existence, return ToolStatus { name: "cursor", ... }
    // simplified: use `which cursor` or known paths
    scan_command("cursor", &["--version"], |s| s.trim().to_string())
        .map_name("cursor")
}

fn which_path(cmd: &str) -> Option<String> {
    Command::new(if cfg!(windows) { "where" } else { "which" })
        .arg(cmd)
        .output()
        .ok()
        .and_then(|o| String::from_utf8(o.stdout).ok())
        .map(|s| s.lines().next()?.trim().to_string())
}
```

- [ ] **Step 2: Register command `scan_environment`**

- [ ] **Step 3: Commit**

```bash
git commit -am "feat: add environment scanner"
```

---

### Task 5: SSH helper

**Files:**
- Create: `src-tauri/src/ssh.rs`

- [ ] **Step 1: Implement keygen + test**

```rust
#[derive(Serialize)]
pub struct SshKeyInfo {
    pub exists: bool,
    pub public_key: Option<String>,
    pub key_path: String,
}

pub fn ensure_key() -> Result<SshKeyInfo, String> {
    let home = dirs::home_dir().ok_or("No home dir")?;
    let key_path = home.join(".ssh/id_ed25519");
    if !key_path.exists() {
        std::fs::create_dir_all(home.join(".ssh")).map_err(|e| e.to_string())?;
        Command::new("ssh-keygen")
            .args(["-t", "ed25519", "-f"])
            .arg(&key_path)
            .args(["-N", ""])
            .output()
            .map_err(|e| e.to_string())?;
    }
    let pub_key = std::fs::read_to_string(key_path.with_extension("pub"))
        .ok();
    Ok(SshKeyInfo {
        exists: true,
        public_key: pub_key,
        key_path: key_path.to_string_lossy().to_string(),
    })
}

pub fn test_github() -> Result<String, String> {
    let out = Command::new("ssh")
        .args(["-T", "git@github.com"])
        .output()
        .map_err(|e| e.to_string())?;
    let combined = format!("{}{}", 
        String::from_utf8_lossy(&out.stdout),
        String::from_utf8_lossy(&out.stderr));
    Ok(combined)
}
```

- [ ] **Step 2: Register `ensure_ssh_key`, `test_github_ssh` commands**

- [ ] **Step 3: Commit**

---

### Task 6: Deploy modules (Vercel + GitHub Pages)

**Files:**
- Create: `src-tauri/src/deploy/mod.rs`
- Create: `src-tauri/src/deploy/vercel.rs`
- Create: `src-tauri/src/deploy/github_pages.rs`

- [ ] **Step 1: Vercel deploy**

```rust
// deploy/vercel.rs
use std::process::Command;

#[derive(Serialize)]
pub struct DeployResult {
    pub success: bool,
    pub url: Option<String>,
    pub log: String,
}

pub fn deploy_vercel(project_dir: &str) -> DeployResult {
    // Ensure vercel CLI
    let _ = Command::new("npm").args(["i", "-g", "vercel"]).output();

    let out = Command::new("vercel")
        .args(["--yes", "--prod"])
        .current_dir(project_dir)
        .output();

    match out {
        Ok(o) => {
            let log = format!("{}{}", 
                String::from_utf8_lossy(&o.stdout),
                String::from_utf8_lossy(&o.stderr));
            let url = extract_vercel_url(&log);
            DeployResult {
                success: o.status.success() && url.is_some(),
                url,
                log,
            }
        }
        Err(e) => DeployResult {
            success: false,
            url: None,
            log: e.to_string(),
        },
    }
}

fn extract_vercel_url(log: &str) -> Option<String> {
    log.lines()
        .find(|l| l.contains("https://") && l.contains(".vercel.app"))
        .and_then(|l| {
            l.split_whitespace()
                .find(|s| s.starts_with("https://") && s.contains(".vercel.app"))
                .map(|s| s.to_string())
        })
}
```

- [ ] **Step 2: GitHub Pages deploy**

```rust
// deploy/github_pages.rs
pub fn deploy_github_pages(project_dir: &str, username: &str, repo: &str) -> DeployResult {
    let remote = format!("git@github.com:{}/{}.git", username, repo);
    let steps = [
        vec!["init"],
        vec!["add", "."],
        vec!["commit", "-m", "My first vibe coding page"],
        vec!["branch", "-M", "main"],
        vec!["remote", "add", "origin", &remote],
        vec!["push", "-u", "origin", "main"],
    ];
    let mut log = String::new();
    for step in steps {
        let mut args = vec!["-C", project_dir];
        args.extend(step.iter().copied());
        // first init: git init not git -C init — adjust to separate init call
    }
    // Enable pages via gh CLI if available:
    // gh api repos/{owner}/{repo}/pages -f source[branch]=main -f source[path]=/
    let url = Some(format!("https://{}.github.io/{}/", username, repo));
    DeployResult { success: true, url, log }
}
```

- [ ] **Step 3: Pre-deploy validation**

```rust
pub fn validate_project(project_dir: &str) -> Result<(), String> {
    let index = std::path::Path::new(project_dir).join("index.html");
    if !index.exists() {
        return Err("index.html 不存在，请先在 Cursor 中完成网页制作".into());
    }
    let content = std::fs::read_to_string(&index).map_err(|e| e.to_string())?;
    if content.trim().len() < 50 {
        return Err("index.html 内容太少，请继续用 AI 完善页面".into());
    }
    let env = std::path::Path::new(project_dir).join(".env");
    if env.exists() {
        return Err("检测到 .env 文件，请勿部署含 API Key 的项目".into());
    }
    Ok(())
}
```

- [ ] **Step 4: Register `deploy_vercel`, `deploy_github_pages`, `validate_project`**

- [ ] **Step 5: Commit**

```bash
git commit -am "feat: add Vercel and GitHub Pages deploy commands"
```

---

### Task 7: Project pack copy

**Files:**
- Create: `src-tauri/src/project.rs`
- Create: bundled packs under `src/content/packs/`

- [ ] **Step 1: Copy scaffold command**

```rust
#[tauri::command]
fn init_project(pack_id: String, target_dir: String) -> Result<(), String> {
    // Resolve pack scaffold from resource dir (bundled in app)
    let scaffold = resolve_pack_scaffold(&pack_id)?;
    copy_dir_recursive(&scaffold, &target_dir)?;
    Ok(())
}
```

- [ ] **Step 2: Commit**

---

## Phase 3: Frontend Wizard Shell

### Task 8: Wizard layout & step navigation

**Files:**
- Create: `src/lib/steps.ts`
- Create: `src/stores/wizardStore.ts`
- Create: `src/components/layout/WizardLayout.tsx`
- Create: `src/components/wizard/StepNav.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Define steps**

```typescript
// src/lib/steps.ts
export const WIZARD_STEPS = [
  { id: 'welcome', title: '欢迎' },
  { id: 'health-check', title: '环境体检' },
  { id: 'install-tools', title: '安装工具' },
  { id: 'pick-ide', title: '选择编辑器' },
  { id: 'github-setup', title: 'GitHub' },
  { id: 'llm-api-key', title: '大模型 Key' },
  { id: 'first-project', title: '做网页' },
  { id: 'deploy', title: '部署上线' },
  { id: 'complete', title: '完成' },
] as const;
```

- [ ] **Step 2: Zustand store with persist**

```typescript
// src/stores/wizardStore.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface WizardState {
  currentStep: string;
  completedSteps: string[];
  selections: {
    primaryIde: string;
    llmProvider: string;
    packId: string;
    deployTarget: 'vercel' | 'github-pages';
    projectDir: string;
    githubUsername: string;
  };
  setStep: (id: string) => void;
  completeStep: (id: string) => void;
  setSelection: <K extends keyof WizardState['selections']>(
    key: K, value: WizardState['selections'][K]
  ) => void;
}

export const useWizardStore = create<WizardState>()(
  persist(
    (set, get) => ({
      currentStep: 'welcome',
      completedSteps: [],
      selections: {
        primaryIde: 'cursor',
        llmProvider: 'deepseek',
        packId: 'personal-profile',
        deployTarget: 'vercel',
        projectDir: '',
        githubUsername: '',
      },
      setStep: (id) => set({ currentStep: id }),
      completeStep: (id) => set({
        completedSteps: [...new Set([...get().completedSteps, id])],
      }),
      setSelection: (key, value) => set({
        selections: { ...get().selections, [key]: value },
      }),
    }),
    { name: 'vibestart-wizard' }
  )
);
```

- [ ] **Step 3: WizardLayout with left nav, center content, right troubleshoot panel**

- [ ] **Step 4: Theme toggle (system + manual), class `dark` on `<html>`**

- [ ] **Step 5: Commit**

---

### Task 9: Step components (Welcome → LLM Key)

**Files:**
- Create: `src/components/wizard/steps/WelcomeStep.tsx`
- Create: `src/components/wizard/steps/HealthCheckStep.tsx`
- Create: `src/components/wizard/steps/InstallToolsStep.tsx`
- Create: `src/components/wizard/steps/PickIdeStep.tsx`
- Create: `src/components/wizard/steps/GithubSetupStep.tsx`
- Create: `src/components/wizard/steps/LlmApiKeyStep.tsx`

Each step follows pattern:
- Call Tauri commands on mount
- Show ✅/⚠️/❌ status
-「卡住了？」link to troubleshoot entry
- Bottom: 上一步 | 下一步

- [ ] **Step 1: WelcomeStep — invoke `get_os_info`, display platform**

- [ ] **Step 2: HealthCheckStep — invoke `scan_environment`, render ToolStatus cards**

- [ ] **Step 3: InstallToolsStep — platform-specific install buttons (open brew/winget or browser)**

- [ ] **Step 4: PickIdeStep — IDE cards with detection status**

- [ ] **Step 5: GithubSetupStep — sub-stepper: register / create repo / SSH key / test**

- [ ] **Step 6: LlmApiKeyStep — provider cards, key input (masked), test API call via Rust reqwest**

- [ ] **Step 7: Commit**

```bash
git commit -am "feat: implement wizard steps 0-5"
```

---

## Phase 4: Project Packs & 0→1 Flow

### Task 10: Create 3 Project Packs

**Files:**
- Create: `src/content/packs/personal-profile/meta.json`
- Create: `src/content/packs/personal-profile/preview.html`
- Create: `src/content/packs/personal-profile/scaffold/index.html`
- Create: `src/content/packs/personal-profile/prompts/01-structure.md` … `04-polish.md`
- (Repeat for `landing-page`, `web-effect`)

- [ ] **Step 1: personal-profile pack**

`meta.json`:
```json
{
  "id": "personal-profile",
  "title": "在线个人简介",
  "description": "做一个能分享给朋友的名片式主页",
  "difficulty": 1,
  "estimatedMinutes": 15,
  "tags": ["静态页", "入门"]
}
```

`scaffold/index.html`:
```html
<!DOCTYPE html>
<html lang="zh-CN">
<head><meta charset="UTF-8"><title>我的简介</title></head>
<body><!-- 这里将用 AI 生成内容 --></body>
</html>
```

`prompts/01-structure.md`:
```markdown
请帮我在 index.html 中创建一个个人简介页面，包含：顶部头像区域、名字、一句话介绍、三个社交链接按钮。使用纯 HTML，不要任何框架。请直接修改 index.html 文件。
```

(Full prompts for 02-content, 03-style, 04-polish with typing effect)

- [ ] **Step 2: landing-page pack** — product landing with hero + features + CTA

- [ ] **Step 3: web-effect pack** — particle/gradient background effect

- [ ] **Step 4: preview.html for each** — self-contained, visually polished, read-only reference

- [ ] **Step 5: Commit**

---

### Task 11: Pack selector + prompt stepper UI

**Files:**
- Create: `src/components/packs/PackSelector.tsx`
- Create: `src/components/packs/PreviewPane.tsx`
- Create: `src/components/packs/PromptStepper.tsx`
- Create: `src/components/wizard/steps/FirstProjectStep.tsx`

- [ ] **Step 1: PackSelector — 3 cards with thumbnail, difficulty, tags**

- [ ] **Step 2: PreviewPane — iframe loading bundled preview.html**

- [ ] **Step 3: PromptStepper**
  - Load prompts from pack folder in order
  - Copy button per prompt
  -「在 Cursor 中粘贴并发送」instruction
  -「做完了，下一步」button
  - Local preview button: open project index.html in WebView window

- [ ] **Step 4: init_project on pack select → default `~/Projects/my-first-vibe-project`**

- [ ] **Step 5: Open in Cursor button** — `open -a Cursor {dir}` / `cursor {dir}`

- [ ] **Step 6: Commit**

---

## Phase 5: Deploy Step

### Task 12: Deploy UI with dual channels

**Files:**
- Create: `src/components/deploy/DeployCards.tsx`
- Create: `src/components/wizard/steps/DeployStep.tsx`
- Create: `src/components/wizard/steps/CompleteStep.tsx`

- [ ] **Step 1: DeployCards — two cards, Vercel pre-selected**

Vercel card:
- Badge: 「推荐 · 约 30 秒」
- Sub-steps if not logged in: 注册引导 → `vercel login` button
- Deploy button → invoke `validate_project` then `deploy_vercel`

GitHub Pages card:
- Badge: 「学习 Git 发布」
- Requires github username + repo name
- Deploy button → `deploy_github_pages`

- [ ] **Step 2: Deploy progress — streaming log panel, spinner, success URL + copy + QR**

Use `qrcode.react` for QR:
```bash
npm install qrcode.react
```

- [ ] **Step 3: CompleteStep — celebration, URL recap, 「再做一次」reset pack selection**

- [ ] **Step 4: Commit**

```bash
git commit -am "feat: dual deploy UI (Vercel + GitHub Pages)"
```

---

## Phase 6: Guides, Troubleshoot, Polish

### Task 13: Troubleshoot content

**Files:**
- Create: `src/content/troubleshoot/git-not-found.md`
- Create: `src/content/troubleshoot/ssh-permission-denied.md`
- Create: `src/content/troubleshoot/vercel-login-failed.md`
- Create: `src/content/troubleshoot/api-key-invalid.md`
- Create: `src/content/troubleshoot/github-timeout.md`
- Create: `src/components/layout/TroubleshootPanel.tsx`

- [ ] **Step 1: Write 5 troubleshoot markdown files** (现象 → 原因 → 步骤)

- [ ] **Step 2: TroubleshootPanel — searchable list in right sidebar**

- [ ] **Step 3: Commit**

---

### Task 14: LLM API test (Rust)

**Files:**
- Modify: `src-tauri/Cargo.toml` — add `reqwest`
- Create: `src-tauri/src/llm.rs`

- [ ] **Step 1: test_llm_api command**

```rust
pub async fn test_api(provider: &str, api_key: &str, base_url: Option<&str>) -> Result<String, String> {
    let url = base_url.unwrap_or(match provider {
        "deepseek" => "https://api.deepseek.com/v1/chat/completions",
        _ => return Err("Unknown provider".into()),
    });
    let client = reqwest::Client::new();
    let body = serde_json::json!({
        "model": "deepseek-chat",
        "messages": [{"role": "user", "content": "hi"}],
        "max_tokens": 5
    });
    let res = client.post(url)
        .header("Authorization", format!("Bearer {}", api_key))
        .json(&body)
        .send()
        .await
        .map_err(|e| e.to_string())?;
    if res.status().is_success() {
        Ok("API Key 验证成功".into())
    } else {
        Err(format!("验证失败: {}", res.status()))
    }
}
```

- [ ] **Step 2: Store key locally in `~/.vibestart/config.json` with 0600 permissions**

- [ ] **Step 3: Commit**

---

### Task 15: E2E manual test checklist

- [ ] **Step 1: macOS full wizard run**

- [ ] **Step 2: Verify dark mode toggle on all steps**

- [ ] **Step 3: Verify progress persists after app restart**

- [ ] **Step 4: Document test results in `docs/TESTING.md`**

---

## Spec Coverage Checklist

| Spec requirement | Task |
|---|---|
| OS detection | Task 3 |
| Env scan git/node/cursor | Task 4 |
| Install brew/winget | Task 9 InstallToolsStep |
| IDE selection | Task 9 PickIdeStep |
| GitHub SSH setup | Task 5, Task 9 GithubSetupStep |
| LLM API key + test | Task 14, Task 9 LlmApiKeyStep |
| 3 Project Packs | Task 10 |
| Preview + prompt chain | Task 11 |
| Vercel deploy | Task 6, Task 12 |
| GitHub Pages deploy | Task 6, Task 12 |
| Dark/light theme | Task 8 |
| Progress persist | Task 8 wizardStore |
| Troubleshoot 5 entries | Task 13 |
| Pre-deploy validation | Task 6 |
| QR code share | Task 12 |

---

## Execution Order Summary

1. Tasks 1–2: Scaffold
2. Tasks 3–7: Rust core
3. Tasks 8–9: Wizard shell + steps 0–5
4. Tasks 10–11: Project packs + 0→1 flow
5. Task 12: Deploy
6. Tasks 13–15: Polish + test

Estimated: ~15–20 focused dev sessions.
