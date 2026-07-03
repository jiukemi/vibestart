# 原生 App 入门指引

本文件夹是**说明与 AI 提示词**，不是完整 Xcode/Android 工程。请按你的平台新建官方模板后，把工程路径设为当前项目目录（或子文件夹）。

## iOS（SwiftUI）

1. 安装 Xcode（仅 macOS）
2. Xcode → File → New → Project → App
3. 保存到本目录下的 `ios/MyFirstApp`（或你自选子文件夹）
4. 用 AI 编辑器打开该工程
5. 跟着分步提示词，让 AI 修改 `ContentView.swift`

## Android（Kotlin + Compose）

1. 安装 Android Studio
2. New Project → Empty Activity（Compose）
3. 保存到 `android/MyFirstApp`
4. 用 AI 编辑器打开，修改 `MainActivity.kt`

## 后端（可选）

需要账号、留言等云端数据时，可选 Supabase / 腾讯云 SCF / LeanCloud，用 REST 从原生 App 调 API。

## 怎么用提示词

复制向导里的开场提示词到 Cursor / Claude Code，并 `@` 引用你的 Swift 或 Kotlin 文件。
