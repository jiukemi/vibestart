# VibeStart 手动 E2E 测试清单

适用于 macOS 上的完整向导流程验证。测试前请从干净状态开始（可选：清除 `localStorage` 中的 `vibestart-wizard` 键）。

## 环境准备

- [ ] macOS 12+，已安装 Xcode Command Line Tools
- [ ] 可访问 GitHub、所选 LLM API 服务商
- [ ] 终端可运行 `npm run tauri dev` 启动应用

## 1. 完整向导流程（macOS）

### 欢迎 & 环境检测

- [ ] 启动应用，显示「欢迎」步骤
- [ ] 进入「环境检测」，Rust `scan_environment` 返回 Git / Node / Cursor 等状态
- [ ] 缺失工具时「安装工具」步骤显示 macOS（Homebrew）指引

### IDE & GitHub

- [ ] 「选择 IDE」可切换 Cursor / VS Code / Windsurf 等卡片
- [ ] 「GitHub 配置」子步骤可生成 SSH 密钥、复制公钥、测试连接
- [ ] 测试连接结果写入界面（成功或权限错误提示）

### LLM API Key

- [ ] 可切换 DeepSeek / 通义 / 智谱 / Kimi / OpenAI
- [ ] 输入 API Key 后点击「测试连接」调用 `test_llm_api`
- [ ] 验证成功后 Key 写入 `~/.vibestart/config.json`（权限 `600`）
- [ ] 无效 Key 显示错误信息，不写入配置

### 首个项目 & 部署

- [ ] 「首个项目」可选择模板包、预览 scaffold
- [ ] 初始化项目到默认或自定义目录
- [ ] 「部署上线」可选 Vercel 或 GitHub Pages
- [ ] 部署成功显示 URL；失败显示日志

### 完成

- [ ] 「完成」步骤显示祝贺与后续指引
- [ ] 左侧导航所有已完成步骤有完成标记

## 2. 暗黑 / 明亮模式

- [ ] 右上角主题切换按钮在所有步骤可用
- [ ] 切换后背景、文字、边框、卡片对比度正常
- [ ] 故障排查面板、表单输入、按钮在两种模式下均可读
- [ ] 刷新或重启应用后主题偏好保持（若已实现持久化）

## 3. 进度持久化

- [ ] 向导进行到中间步骤（如「GitHub 配置」）后完全退出应用
- [ ] 重新启动后恢复到上次步骤
- [ ] `completedSteps` 与 IDE / LLM / 模板等选择保持不变
- [ ] 数据存储于 `localStorage` 键 `vibestart-wizard`

## 4. 故障排查面板

- [ ] 右侧栏可展开「故障排查」面板
- [ ] 搜索框可过滤 5 条预置条目（Git、SSH、Vercel、API Key、GitHub 超时）
- [ ] 点击条目显示现象 / 原因 / 解决步骤内容
- [ ] 明亮与暗黑模式下样式正常

## 5. 构建验证

```bash
npm run build
```

- [ ] TypeScript 编译无错误
- [ ] Vite 生产构建成功

## 测试结果记录

| 日期 | 测试人 | macOS 版本 | 向导全流程 | 暗黑模式 | 进度持久 | 备注 |
|------|--------|------------|------------|----------|----------|------|
|      |        |            | ☐ 通过 ☐ 失败 | ☐ 通过 ☐ 失败 | ☐ 通过 ☐ 失败 |      |
