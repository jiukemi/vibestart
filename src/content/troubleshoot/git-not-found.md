# Git 未安装或未加入 PATH

## 现象

终端提示 `git: command not found`，或在 VibeStart 环境检测中 Git 显示未安装。

## 原因（白话）

电脑里还没有安装 Git，或者安装了但系统找不到它的位置（PATH 没配置好）。

## 解决步骤

1. **macOS**：打开终端，运行 `brew install git`（需先安装 Homebrew）
2. **Windows**：打开 PowerShell，运行 `winget install Git.Git`
3. 安装完成后**关闭并重新打开**终端或 VibeStart
4. 运行 `git --version` 确认能显示版本号
5. 若仍报错，检查 PATH 是否包含 Git 安装目录（macOS 常见路径 `/usr/local/bin` 或 `/opt/homebrew/bin`）

## 仍不行？

重启电脑后再试；或在 VibeStart 的「安装工具」步骤按平台指引重新安装。
