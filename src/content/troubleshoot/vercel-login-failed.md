# Vercel 登录失败

## 现象

部署步骤中 Vercel 登录超时、浏览器未弹出，或提示 `Not logged in` / `Authentication failed`。

## 原因（白话）

Vercel CLI 需要你在浏览器里完成授权。网络不通、CLI 未安装，或浏览器被拦截都会导致登录失败。

## 解决步骤

1. 确认已安装 Node.js 和 npm（环境检测步骤应通过）
2. 在终端运行 `npm i -g vercel` 安装 Vercel CLI
3. 在 VibeStart 部署步骤点击**登录 Vercel**，等待浏览器打开
4. 在浏览器中完成 GitHub / Email 授权
5. 若浏览器未弹出，手动运行 `vercel login` 并按提示操作
6. 使用代理的用户需确保终端和浏览器使用同一网络环境

## 仍不行？

退出 Vercel CLI 后重试：`vercel logout`，再重新登录；或改用 GitHub Pages 部署方式。
