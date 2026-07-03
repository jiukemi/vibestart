# VibeStart 推广视频制作指南

面向：**介绍站上线 + 双平台安装包 + 推广短片**。  
工具组合：**Remotion（主片）+ HyperFrames（竖版变体）+ 可选剪映/FFmpeg 润色**。

---

## 1. 整体流水线

```text
准备素材（实拍 / 录屏）
        ↓
Remotion 合成 16:9 主片（60s）
        ↓
HyperFrames 衍生 9:16 竖版（3 条 × 15–20s）
        ↓
可选：剪映加 BGM / 降噪 / 片尾
        ↓
发布：B站 / 小红书 / 抖音 + 介绍站 + Gitee Releases 下载
```

| 阶段 | 工具 | 产出 |
|------|------|------|
| 介绍网站 | VibeStart → `landing-page` 模板 → Vercel / Gitee Pages | `https://xxx` |
| 安装包 | macOS `.dmg` + Windows `.exe`（见 [BUILD.md](./BUILD.md)） | Releases 附件 |
| 主片 | Remotion | `out/vibestart-main-16x9.mp4` |
| 竖版 | HyperFrames | `out/vertical-*.mp4` |
| 润色 | 剪映 / DaVinci（可选） | 最终发布版 |

---

## 2. 素材清单（拍摄前对照）

### 2.1 必拍 / 必录

| 素材 | 规格 | 内容 |
|------|------|------|
| **口播（可选）** | 1080p，横屏，30s 内 | 痛点 1 句 + 产品 1 句 + CTA 1 句 |
| **录屏 A** | 1920×1080，60fps 或 30fps | 极速轨完整流程：欢迎 → 环境 → Key → 项目 → 部署 |
| **录屏 B** | 同上，15s 片段 | 部署成功页 + 浏览器打开线上链接 |
| **截图** | PNG，2x | 欢迎页、模板选择、部署成功、工作台 |
| **品牌** | SVG/PNG | Logo、二维码（介绍站 URL）、下载页 URL |

### 2.2 口播参考稿（30s）

```text
[0–8s]  想做一个网站，但不知道从哪配环境、怎么部署？
[8–18s] VibeStart 是桌面向导：选方向、配工具、用 AI 提示词从 0 搭项目，还能一键部署上线。
[18–28s] macOS 和 Windows 都能用。介绍站扫码下载，跟着极速轨，半小时就能发出第一个链接。
[28–30s] 链接在简介，现在就开始。
```

没有真人出镜时：用 Remotion 纯动效 + 录屏 + AI 配音（剪映 / ElevenLabs）即可。

### 2.3 录屏设置

- **macOS**：QuickTime 或 OBS，隐藏桌面杂物，系统浅色/深色与成片风格统一
- **Windows**：OBS，任务栏干净，分辨率 1920×1080
- 录前清除 `localStorage` 键 `vibestart-wizard`，模拟新用户（见 [TESTING.md](./TESTING.md)）

---

## 3. 主片分镜（60s · 16:9 · Remotion）

帧率 **30fps**，总时长 **1800 frames**。

| 时间 | 帧 | 画面 | 音频/字幕 | 素材来源 |
|------|-----|------|-----------|----------|
| 0–5s | 0–150 | 动效标题：「零基础上手 Vibe Coding」 | 轻 BGM 起 | Remotion 代码 |
| 5–12s | 150–360 | 痛点三卡片依次飞入 | 字幕：不会配环境 / 不知用什么 AI / 做完不会部署 | Remotion |
| 12–20s | 360–600 | 口播全屏 或 产品 Logo 定版 | 口播稿前 8s | `talking-head.mp4` 或纯动效 |
| 20–45s | 600–1350 | 录屏：极速轨 6 步快剪（每步 3–4s） | 步骤字幕：①选方向 ②配环境 ③填 Key … | `screen-express.mp4` |
| 45–52s | 1350–1560 | 录屏：部署成功 → 浏览器打开线上页 | 字幕：「5 分钟把链接发给朋友」 | `screen-deploy.mp4` |
| 52–58s | 1560–1740 | 功能三列：macOS+Windows / 模板+提示词 / 一键部署 | BGM 略抬 | Remotion |
| 58–60s | 1740–1800 | CTA：介绍站 URL + 二维码 + 「免费下载」 | 口播收尾或纯字幕 | Remotion + 二维码 PNG |

### 3.1 Remotion 项目结构（建议独立仓库或 `promo/remotion/`）

```text
promo/remotion/
├── public/
│   ├── talking-head.mp4      # 可选
│   ├── screen-express.mp4
│   ├── screen-deploy.mp4
│   ├── logo.png
│   └── qrcode.png
├── src/
│   ├── Root.tsx              # 注册 Composition
│   ├── VibeStartMain.tsx     # 60s 主片
│   ├── components/
│   │   ├── TitleIntro.tsx
│   │   ├── PainCards.tsx
│   │   ├── StepCaptions.tsx
│   │   ├── FeatureGrid.tsx
│   │   └── CtaEndcard.tsx
│   └── theme.ts              # 颜色、字体（对齐 VibeStart UI）
├── package.json
└── remotion.config.ts
```

### 3.2 初始化与渲染

```bash
mkdir -p promo/remotion && cd promo/remotion
npx create-video@latest . --template blank
# 把 public/ 素材放入，按分镜实现 VibeStartMain.tsx

npm run build
npx remotion render src/index.ts VibeStartMain out/vibestart-main-16x9.mp4
```

### 3.3 核心代码片段（嵌录屏 + 步骤字幕）

```tsx
// src/VibeStartMain.tsx（示意）
import {
  AbsoluteFill,
  Sequence,
  OffthreadVideo,
  useCurrentFrame,
  interpolate,
} from "remotion";

const FPS = 30;
const STEPS = [
  { from: 20, label: "① 选方向 · 极速轨" },
  { from: 24, label: "② 一键配环境" },
  { from: 28, label: "③ 连接大模型" },
  { from: 32, label: "④ AI 搭首个项目" },
  { from: 38, label: "⑤ 一键部署上线" },
  { from: 44, label: "⑥ 分享链接给朋友" },
];

export const VibeStartMain = () => {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill style={{ backgroundColor: "#0a0a0a" }}>
      {/* 开场动效 0–5s */}
      <Sequence from={0} durationInFrames={150}>
        <TitleIntro />
      </Sequence>

      {/* 录屏主体 20–45s */}
      <Sequence from={600} durationInFrames={750}>
        <OffthreadVideo
          src="/screen-express.mp4"
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
        <StepCaptions steps={STEPS} fps={FPS} />
      </Sequence>

      {/* 可选：口播画中画 */}
      <Sequence from={360} durationInFrames={240}>
        <PictureInPicture src="/talking-head.mp4" />
      </Sequence>

      {/* 结尾 CTA 58–60s */}
      <Sequence from={1740} durationInFrames={60}>
        <CtaEndcard
          url="https://你的介绍站.vercel.app"
          downloadUrl="https://gitee.com/你/仓库/releases"
        />
      </Sequence>
    </AbsoluteFill>
  );
};
```

**注意**：动画一律用 `useCurrentFrame()` + `interpolate()`，不要用纯 wall-clock 的 GSAP  autoplay，否则渲染时前几秒播完后面会黑屏。

### 3.4 品牌色参考（与 App 一致）

```ts
// src/theme.ts
export const theme = {
  bg: "#0a0a0a",
  fg: "#fafafa",
  muted: "#a1a1aa",
  accent: "#3b82f6", // 主按钮蓝，可按实际 Tailwind 变量调整
  font: "Geist, system-ui, sans-serif",
};
```

明暗两套可在 Remotion 用 `prefers-color-scheme` 或定死 dark（推广片常用 dark）。

---

## 4. 竖版切片（HyperFrames · 9:16）

从主片**逻辑**拆 3 条，不要简单裁切 16:9（竖屏字太小）。

| 编号 | 标题 | 时长 | 内容 |
|------|------|------|------|
| V1 | 「6 步上线第一个网站」 | 18s | 录屏快剪 + 逐步字幕 |
| V2 | 「macOS / Windows 都能用」 | 15s | 双平台 UI 截图 + 下载 CTA |
| V3 | 「AI 提示词，不是复制模板」 | 15s | 模板预览 vs 空白脚手架对比 |

### 4.1 HyperFrames 目录建议

```text
promo/hyperframes/
├── v1-six-steps/
│   └── index.html
├── v2-dual-platform/
│   └── index.html
├── v3-prompts-not-copy/
│   └── index.html
└── assets/
    ├── clip-express.mp4   # 从录屏裁短
    └── logo.png
```

### 4.2 HTML 模板要点（V1 示例结构）

```html
<!-- 1080×1920 竖版 -->
<div class="slide" data-duration="540">
  <video src="../assets/clip-express.mp4" muted playsinline></video>
  <h1 data-animate="fade-up">6 步上线第一个网站</h1>
  <p class="step" data-frame="90">① 选极速轨</p>
  <p class="step" data-frame="180">② 配好环境</p>
  <!-- … -->
  <footer>vibestart.app · 免费下载</footer>
</div>
```

动画用 HyperFrames 的 **frame seek**（`data-*` + GSAP timeline 受控），保证逐帧渲染与成片一致。

### 4.3 渲染

```bash
cd promo/hyperframes
# 按 HyperFrames 文档安装 CLI 后：
hyperframes render v1-six-steps/index.html -o ../../out/vertical-v1.mp4
```

三条竖版共用同一套 `assets/`，只改 HTML 文案即可批量出片。

---

## 5. 真人出镜 / 素材 / 手剪：怎么配合

**不必全程手剪。** 推荐比例：

| 工作 | 方式 | 手动？ |
|------|------|--------|
| 拍口播、录屏 | 手机 / OBS | 实拍一次 |
| 时间轴、字幕、转场 | Remotion 代码 | 可 AI 辅助写 |
| 竖版变体 | HyperFrames 改 HTML 重渲 | 半自动 |
| BGM、降噪、音量 | 剪映 / DaVinci | 可选 10 分钟 |
| 多段硬拼接 | FFmpeg concat | 脚本化 |

### 5.1 FFmpeg 拼接（无 NLE）

`list.txt`：

```text
file 'intro-remotion.mp4'
file 'talking-raw-trimmed.mp4'
file 'outro-remotion.mp4'
```

```bash
ffmpeg -f concat -safe 0 -i list.txt -c copy out/merged.mp4
```

### 5.2 不想真人出镜

- **AI 数字人**：HeyGen 等，导出 MP4 再嵌进 Remotion
- **纯配音**：剪映 AI 配音 / ElevenLabs → Remotion `<Audio src="vo.mp3" />`
- **纯录屏 + 动效**：对本产品同样有效，V1 竖版即可验证

---

## 6. 介绍站下载页（`site/`）

仓库内已包含可独立部署的下载页：[site/index.html](../site/index.html)

- 自动识别 macOS / Windows 并勾选对应平台（含 Apple Silicon / Intel）
- 探测 GitHub 可达性：外网走 GitHub Releases，否则 Gitee 国内镜像
- 支持手动切换平台与下载线路；移动端提示「请在电脑下载」
- 明暗主题；粒子网格背景交互

**本地预览：**

```bash
cd site && python3 -m http.server 8787
# 打开 http://localhost:8787
```

**部署 Gitee Pages：** 仓库设置 → Pages → 部署目录选 `site`（或单独建 pages 分支只含 site 内容）。

**部署 Vercel：** Root Directory 填 `site`，Framework Preset 选 Other。

发版时 `./scripts/release.sh` 会同步 `site/js/config.js` 中的版本号与安装包文件名。

成片结尾 QR 码指向介绍站 `#download` 锚点。

<details>
<summary>旧版 HTML 片段（已弃用，仅供参考）</summary>

```html
<section id="download" class="download">
  <h2>免费下载 VibeStart</h2>
  <p class="muted">预览版 v0.1.0 · macOS 与 Windows</p>
  <div class="buttons">
    <a class="btn primary" href="https://gitee.com/你的用户名/vibestart/releases/download/v0.1.0/VibeStart_0.1.0_aarch64.dmg">
      macOS 下载 (.dmg)
    </a>
    <a class="btn primary" href="https://gitee.com/你的用户名/vibestart/releases/download/v0.1.0/VibeStart_0.1.0_x64-setup.exe">
      Windows 下载 (.exe)
    </a>
  </div>
  <p class="hint">首次安装若提示安全警告，请按系统指引允许打开（未签名预览版）。</p>
</section>
```

```css
@media (prefers-color-scheme: dark) {
  .download { background: #18181b; color: #fafafa; }
  .muted { color: #a1a1aa; }
}
@media (prefers-color-scheme: light) {
  .download { background: #f4f4f5; color: #18181b; }
  .muted { color: #71717a; }
}
.btn.primary { background: #3b82f6; color: #fff; padding: 12px 24px; border-radius: 8px; }
```

</details>

---

## 7. 发布检查清单

### 7.1 上线前

- [ ] macOS `.dmg` 已在另一台 Mac 或 CI 验证可安装
- [ ] Windows `.exe` 已在 Windows 本机验证（见 [BUILD.md](./BUILD.md)）
- [ ] 介绍站可访问，下载链有效
- [ ] 主片 16:9 + 至少 1 条竖版已导出
- [ ] 视频简介含：介绍站 URL、版本号、未签名说明

### 7.2 平台建议

| 平台 | 格式 | 建议内容 |
|------|------|----------|
| B站 | 16:9 主片 | 完整 60s + 口播/录屏 |
| 小红书 / 抖音 | 9:16 竖版 | V1「6 步上线」优先 |
| Gitee / GitHub | Release 附件 | dmg + exe + 简短 Release 说明 |

### 7.3 简介模板

```text
VibeStart — 零基础 Vibe Coding 桌面向导
macOS / Windows · 配环境 · AI 提示词搭项目 · 一键部署

介绍站：https://xxx
下载：https://gitee.com/xxx/releases/tag/v0.1.0

预览版 v0.1.0，欢迎反馈 Issue。
```

---

## 8. 工具安装速查

### Remotion

```bash
npx create-video@latest promo/remotion
# Node 18+，渲染需 Chrome Headless
```

### HyperFrames

```bash
git clone https://github.com/heygen-com/hyperframes
# 见官方 docs：brew 依赖、render 命令、MCP（可选，给 Cursor 用）
```

### 可选润色

- **剪映专业版**：降噪、BGM、导出 H.264
- **FFmpeg**：`brew install ffmpeg`

---

## 9. 最小可行路径（今天就能开始）

若时间紧，按此顺序即可开拍：

1. **录一条 45s 极速轨录屏**（OBS）
2. **VibeStart 部署 landing-page** → 得到介绍站 URL
3. **Remotion 只做 30s**：5s 标题 + 20s 录屏 + 5s CTA（跳过口播）
4. **HyperFrames 只做 V1 竖版**一条
5. **Gitee Release** 挂 dmg（Windows exe 稍后补）

主片完善和竖版批量可第二轮迭代，不必等「全完美再发」。

---

## 相关文档

- [BUILD.md](./BUILD.md) — 双平台安装包
- [TESTING.md](./TESTING.md) — 录屏前 E2E 验收
- [PLATFORMS.md](./PLATFORMS.md) — 平台差异（口播/字幕可提及）
