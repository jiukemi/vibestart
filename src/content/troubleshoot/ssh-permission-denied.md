# SSH 公钥未配置或未添加到 GitHub

## 现象

连接 GitHub 时出现 `Permission denied (publickey)` 或 `git@github.com: Permission denied`。

## 原因（白话）

GitHub 需要通过 SSH 密钥确认「你是你」。要么还没生成密钥，要么公钥没粘贴到 GitHub 账号设置里。

## 解决步骤

1. 在 VibeStart「GitHub 配置」步骤点击**生成 SSH 密钥**
2. 复制显示的公钥（以 `ssh-ed25519` 开头）
3. 打开 [GitHub SSH Keys 设置](https://github.com/settings/keys)，点击 **New SSH key**
4. 标题随意填写，Key 粘贴公钥，保存
5. 回到 VibeStart 点击**测试连接**
6. 若仍失败，确认公钥完整复制、没有多余空格或换行

## 仍不行？

检查 `~/.ssh/id_ed25519` 权限应为 `600`；可运行 `ssh -T git@github.com` 在终端查看详细错误。
