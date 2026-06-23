# GitHub 连接超时

## 现象

测试 GitHub SSH 或推送代码时长时间无响应，出现 `Connection timed out`、`Could not resolve host` 或 `Operation timed out`。

## 原因（白话）

网络到 GitHub 不通。常见原因：公司防火墙、DNS 问题、未配置代理，或临时网络波动。

## 解决步骤

1. 在浏览器打开 [github.com](https://github.com) 确认能否访问
2. 终端运行 `ping github.com` 检查网络连通性
3. 若需代理，在终端设置环境变量（示例）：
   - `export https_proxy=http://127.0.0.1:7890`
   - `export http_proxy=http://127.0.0.1:7890`
4. 配置 Git 使用代理：`git config --global http.proxy http://127.0.0.1:7890`
5. SSH 代理可在 `~/.ssh/config` 中添加 `Host github.com` 与 `ProxyCommand`
6. 稍后重试，GitHub 偶尔会短暂不可用

## 仍不行？

尝试切换网络（如手机热点）；或联系网络管理员确认 22 端口（SSH）是否被封锁。
