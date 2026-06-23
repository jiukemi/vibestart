# LLM API Key 无效

## 现象

配置大模型 Key 时提示 `401 Unauthorized`、`Invalid API Key` 或「验证失败」。

## 原因（白话）

填写的 Key 不对、已过期、或选错了服务商。每个平台的 Key 格式和后台地址不同，不能混用。

## 解决步骤

1. 确认在 VibeStart 中选择了**正确的服务商**（DeepSeek / 通义 / 智谱 / Kimi / OpenAI）
2. 登录对应平台控制台，重新复制 API Key（注意不要多空格）
3. 检查账户余额或免费额度是否用完
4. 通义千问 Key 在 [阿里云 DashScope](https://dashscope.console.aliyun.com/) 创建
5. 智谱 Key 在 [智谱开放平台](https://open.bigmodel.cn/) 创建
6. 粘贴 Key 后点击**测试连接**，成功后再进入下一步

## 仍不行？

确认 Key 对应的服务已开通；若使用自定义代理或 base URL，检查地址是否正确。
