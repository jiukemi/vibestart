import type { AppStack, BuildGoal } from "@/stores/wizardStore";

export type BackendProviderId =
  | "supabase"
  | "wechat-cloud"
  | "tencent-scf"
  | "aliyun-fc"
  | "leancloud"
  | "vercel-functions";

export interface BackendProvider {
  id: BackendProviderId;
  name: string;
  tagline: string;
  /** 适合的产品方向 */
  goals: BuildGoal[];
  /** 国内访问友好 */
  domestic: boolean;
  pricingHint: string;
  signupUrl: string;
  docsUrl: string;
  setupSteps: string[];
  /** 默认 AI 提示词（未匹配 goalPrompts 时使用） */
  aiPrompt: string;
  /** 按方向定制的提示词 */
  goalPrompts?: Partial<Record<BuildGoal, string>>;
}

const WEB_SUPABASE_PROMPT = `我要给这个静态网页项目（纯 HTML/JS，已部署或即将部署 Vercel）接入 Supabase 轻量后端，实现例如「留言板 / 待办 / 简单表单提交存数据库」。
请帮我：
1. 设计一张 messages 或 todos 表（id uuid, text text, created_at timestamptz）
2. 给出 Supabase SQL 建表语句与 RLS 练手配置（允许匿名 insert/select）
3. 在 index.html 用原生 fetch 调 Supabase REST API（apikey + Authorization Bearer anon key）
4. 新建 config.example.js 放 URL/Key，并说明 .gitignore 忽略 config.js
5. 表单提交后刷新列表的简单 UI 逻辑
不要引入 React/Vue，注释中文。`;

const WEB_LEANCLOUD_PROMPT = `我要给静态网页（HTML + JS）接入 LeanCloud 国内 BaaS，做留言或待办存云端。
请帮我：
1. 定义 Message/Todo 类字段与练手阶段 ACL
2. 用 fetch 调 LeanCloud REST API（X-LC-Id / X-LC-Key Header）
3. config.example.js 模板 + .gitignore 说明
4. 页面表单 + 列表展示示例
纯前端，中文注释。`;

const WEB_TENCENT_SCF_PROMPT = `我要给静态网页接「腾讯云 SCF + API 网关」REST API（国内 Serverless）。
请帮我：
1. Node.js 云函数 CRUD 示例（先内存存储）
2. API 网关 HTTPS 地址与 CORS 配置说明（允许浏览器跨域）
3. index.html 里 fetch POST/GET 示例
4. 腾讯云控制台操作步骤清单
中文注释。`;

const WEB_ALIYUN_FC_PROMPT = `我要给静态网页接「阿里云函数计算 FC」HTTP API。
请帮我：
1. Node.js handler + HTTP 触发器
2. 响应头 CORS 配置
3. 前端 fetch 调用示例
4. 控制台配置步骤
中文注释。`;

const WEB_VERCEL_PROMPT = `我要在同一个 Vercel 项目里加 Serverless Functions 做轻量 API（与静态页一起部署）。
请帮我：
1. 创建 api/todos.js（或 api/todos.ts）Vercel Serverless 路由，内存或 Vercel KV 存数据
2. 说明 vercel.json 如需 rewrite 的配置
3. index.html 用 fetch('/api/todos') 调用
4. 本地 vercel dev 调试步骤
保持纯 HTML 前端 + api/ 目录，中文注释。`;

export const BACKEND_PROVIDERS: BackendProvider[] = [
  {
    id: "vercel-functions",
    name: "Vercel Serverless",
    tagline: "与静态站同平台部署 API，零额外服务器",
    goals: ["website", "explore"],
    domestic: false,
    pricingHint: "与 Vercel 部署共用免费额度；Hobby 够用练手",
    signupUrl: "https://vercel.com/docs/functions",
    docsUrl: "https://vercel.com/docs/functions/serverless-functions",
    setupSteps: [
      "项目根目录新建 api/ 文件夹",
      "编写 api/xxx.js 导出 handler（Node.js）",
      "前端 fetch('/api/xxx') 同域调用，无 CORS 烦恼",
      "vercel --prod 与静态页一起部署",
      "敏感配置放 Vercel 环境变量",
    ],
    aiPrompt: WEB_VERCEL_PROMPT,
  },
  {
    id: "supabase",
    name: "Supabase",
    tagline: "开源 BaaS：PostgreSQL + REST API，网页/App/小程序都能用",
    goals: ["website", "explore", "app", "miniprogram"],
    domestic: false,
    pricingHint: "免费层 2 个项目；国内访问控制台可能需代理",
    signupUrl: "https://supabase.com/dashboard",
    docsUrl: "https://supabase.com/docs",
    setupSteps: [
      "注册 Supabase → New Project",
      "在 Table Editor 建表（如 todos: id, text, done）",
      "Settings → API 复制 URL 与 anon key",
      "网页：fetch 调 REST；App：SDK；小程序：wx.request",
      "Row Level Security 练手可先放宽，上线再收紧",
    ],
    aiPrompt: `我要用 Supabase 给当前项目接轻量后端（待办/列表类 CRUD）。
请帮我：
1. 设计一张 todos 表（id uuid, text text, done boolean, created_at timestamptz）
2. 给出 Supabase SQL 建表语句
3. 若是 Flutter 项目：用 supabase_flutter 连接并 CRUD
4. 若是微信小程序：用 wx.request 调 Supabase REST API（Header: apikey + Authorization Bearer anon key）
5. 说明 .env 或 project.config 里如何放 SUPABASE_URL 和 ANON_KEY（不要提交到 Git）
保持代码简单，注释用中文。`,
    goalPrompts: {
      website: WEB_SUPABASE_PROMPT,
      explore: WEB_SUPABASE_PROMPT,
    },
  },
  {
    id: "leancloud",
    name: "LeanCloud",
    tagline: "国内 BaaS，数据存储 + 云函数，文档中文友好",
    goals: ["website", "explore", "miniprogram", "app"],
    domestic: true,
    pricingHint: "开发版免费；按 DAU/请求量升级",
    signupUrl: "https://console.leancloud.cn/apps",
    docsUrl: "https://docs.leancloud.cn/",
    setupSteps: [
      "注册 LeanCloud 国内版 → 创建应用",
      "数据存储 → 创建类与字段",
      "设置 → 应用 Keys 复制 App ID / App Key",
      "网页/App：REST 或 SDK；小程序配置合法域名",
      "练手阶段 ACL 可放宽",
    ],
    aiPrompt: `我要用 LeanCloud 数据存储给当前项目做待办清单后端（国内 BaaS）。
请帮我：
1. 定义 Todo 类字段与 ACL 建议（练手阶段可开放读写）
2. Flutter 或小程序端的 CRUD 示例代码
3. 说明 App ID / App Key 放哪里（不要提交 Git）
4. 列出 LeanCloud 控制台操作步骤
中文注释，零基础可读。`,
    goalPrompts: {
      website: WEB_LEANCLOUD_PROMPT,
      explore: WEB_LEANCLOUD_PROMPT,
    },
  },
  {
    id: "tencent-scf",
    name: "腾讯云云函数 SCF",
    tagline: "国内 Serverless，按调用计费，适合 API + 静态页",
    goals: ["website", "explore", "miniprogram", "app"],
    domestic: true,
    pricingHint: "每月免费额度；新用户有代金券",
    signupUrl: "https://cloud.tencent.com/product/scf",
    docsUrl: "https://cloud.tencent.com/document/product/583",
    setupSteps: [
      "注册腾讯云 → 开通云函数 SCF",
      "创建 Node.js 函数 + API 网关触发器",
      "配置 CORS 允许你的网页域名",
      "静态页 fetch HTTPS API 地址",
      "密钥放环境变量，不要写进 index.html",
    ],
    aiPrompt: `我要用「腾讯云云函数 SCF + API 网关」给项目做一个轻量 REST API（待办 CRUD）。
请帮我：
1. 写一个 Node.js 云函数示例（内存暂存或对接云数据库 TCB 二选一，先内存简单）
2. 说明 API 网关路径设计：GET/POST /todos
3. 给出小程序 wx.request 调用示例（含域名白名单提示）
4. 列出腾讯云控制台里要点哪些按钮
代码和注释用中文，适合零基础。`,
    goalPrompts: {
      website: WEB_TENCENT_SCF_PROMPT,
      explore: WEB_TENCENT_SCF_PROMPT,
    },
  },
  {
    id: "aliyun-fc",
    name: "阿里云函数计算 FC",
    tagline: "国内 Serverless，与 OSS 搭配方便",
    goals: ["website", "explore", "miniprogram", "app"],
    domestic: true,
    pricingHint: "按量付费，有免费试用额度",
    signupUrl: "https://www.aliyun.com/product/fc",
    docsUrl: "https://help.aliyun.com/product/50980.html",
    setupSteps: [
      "注册阿里云 → 开通函数计算 FC",
      "创建 Node.js 函数 + HTTP 触发器",
      "配置跨域 CORS",
      "静态网页 fetch 调用",
      "（可选）表格存储 OTS 持久化",
    ],
    aiPrompt: `我要用「阿里云函数计算 FC」做一个轻量待办 API，给小程序或 App 调用。
请帮我写：
1. Node.js 函数 handler（Express 风格或原生 event 解析）
2. HTTP 触发器配置说明
3. 客户端 fetch / wx.request 调用示例
4. 小程序配置 request 合法域名的步骤
先内存存储即可，注释中文。`,
    goalPrompts: {
      website: WEB_ALIYUN_FC_PROMPT,
      explore: WEB_ALIYUN_FC_PROMPT,
    },
  },
  {
    id: "wechat-cloud",
    name: "微信云开发",
    tagline: "小程序 / 小游戏原生后端：云函数 + 云数据库，免运维",
    goals: ["miniprogram"],
    domestic: true,
    pricingHint: "免费额度够用练手；按量计费，国内延迟低",
    signupUrl:
      "https://developers.weixin.qq.com/miniprogram/dev/wxcloud/basis/getting-started.html",
    docsUrl:
      "https://developers.weixin.qq.com/miniprogram/dev/wxcloud/basis/getting-started.html",
    setupSteps: [
      "微信开发者工具 → 打开你的小程序项目",
      "顶部菜单「云开发」→ 开通环境（选免费版）",
      "在 app.js 中初始化 wx.cloud",
      "新建 cloudfunctions 目录，写第一个云函数（如 getTodos）",
      "小程序端 wx.cloud.callFunction 调用云函数",
    ],
    aiPrompt: `我要给这个微信小程序接入「微信云开发」后端，实现轻量级待办清单的增删改查。
请帮我：
1. 在 app.js 初始化 wx.cloud（环境 ID 我会自己填）
2. 创建一个 cloudfunctions/todos 云函数，提供 list / add / toggle / delete
3. 云数据库 collection 名为 todos，字段：text(string), done(boolean)
4. 修改 pages/index 页面，用 wx.cloud.callFunction 替代本地 data
5. 给出我在微信开发者工具里需要点的步骤说明
不要引入复杂框架，保持新手可读。`,
  },
];

function resolveGoal(goal: BuildGoal | null): BuildGoal | null {
  if (!goal) return null;
  if (goal === "explore") return "website";
  return goal;
}

export function getBackendProvidersForGoal(
  goal: BuildGoal | null,
  _appStack: AppStack | null,
): BackendProvider[] {
  const effective = resolveGoal(goal);
  if (!effective) return [];
  return BACKEND_PROVIDERS.filter((p) => p.goals.includes(effective));
}

export function getBackendProvider(id: string | null): BackendProvider | null {
  if (!id) return null;
  return BACKEND_PROVIDERS.find((p) => p.id === id) ?? null;
}

export function getProviderAiPrompt(
  provider: BackendProvider,
  goal: BuildGoal | null,
): string {
  const effective = resolveGoal(goal);
  if (effective && provider.goalPrompts?.[effective]) {
    return provider.goalPrompts[effective]!;
  }
  if (goal === "explore" && provider.goalPrompts?.website) {
    return provider.goalPrompts.website;
  }
  return provider.aiPrompt;
}

export function supportsBackendAssist(goal: BuildGoal | null): boolean {
  return getBackendProvidersForGoal(goal, null).length > 0;
}

export function isWebsiteBackendGoal(goal: BuildGoal | null): boolean {
  return goal === "website" || goal === "explore";
}
