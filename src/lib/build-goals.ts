import type { AppStack, BuildGoal } from "@/stores/wizardStore";

export interface GoalToolDef {
  id: string;
  label: string;
  description: string;
  /** 未就绪时是否阻塞进入下一步 */
  required: boolean;
  /** 仅展示指引，无 install_tool 或需手动安装 */
  manualOnly?: boolean;
}

export interface GoalOption {
  id: BuildGoal;
  title: string;
  subtitle: string;
  emoji: string;
  forBeginner?: boolean;
}

export interface AppStackOption {
  id: AppStack;
  title: string;
  description: string;
}

export const GOAL_OPTIONS: GoalOption[] = [
  {
    id: "website",
    title: "做网站 / 网页",
    subtitle: "个人页、落地页、小作品，最快上线",
    emoji: "🌐",
    forBeginner: true,
  },
  {
    id: "miniprogram",
    title: "做微信小程序 / 小游戏",
    subtitle: "小程序页面或 Canvas 小游戏",
    emoji: "💬",
  },
  {
    id: "app",
    title: "做手机 App",
    subtitle: "iOS / Android 应用",
    emoji: "📱",
  },
  {
    id: "explore",
    title: "还不确定，先试试",
    subtitle: "推荐从网页开始，30 秒部署上线",
    emoji: "✨",
    forBeginner: true,
  },
];

export const APP_STACK_OPTIONS: AppStackOption[] = [
  {
    id: "hybrid",
    title: "混合开发（推荐新手）",
    description: "一套代码多端运行，如 Flutter。AI 辅助效率高，上手比原生快。",
  },
  {
    id: "native",
    title: "原生开发",
    description: "Xcode（iOS）/ Android Studio（Android）。性能最好，环境配置更重。",
  },
];

const BASE_TOOLS: GoalToolDef[] = [
  {
    id: "git",
    label: "Git",
    description: "版本管理与代码托管",
    required: true,
  },
  {
    id: "node",
    label: "Node.js",
    description: "运行 npm 与各类 CLI 工具",
    required: true,
  },
];

export function getGoalTools(goal: BuildGoal | null, appStack: AppStack | null): GoalToolDef[] {
  const effective = goal === "explore" || !goal ? "website" : goal;

  switch (effective) {
    case "website":
      return [
        ...BASE_TOOLS,
        {
          id: "vercel",
          label: "Vercel CLI",
          description: "一键部署静态网站（推荐）",
          required: false,
        },
      ];
    case "miniprogram":
      return [
        ...BASE_TOOLS,
        {
          id: "wechat-devtools",
          label: "微信开发者工具",
          description: "预览、调试与上传小程序",
          required: false,
          manualOnly: true,
        },
      ];
    case "app":
      if (appStack === "native") {
        return [
          ...BASE_TOOLS,
          {
            id: "xcode",
            label: "Xcode（仅 macOS）",
            description: "开发 iOS 原生 App",
            required: false,
            manualOnly: true,
          },
          {
            id: "android-studio",
            label: "Android Studio",
            description: "开发 Android 原生 App",
            required: false,
            manualOnly: true,
          },
        ];
      }
      return [
        ...BASE_TOOLS,
        {
          id: "flutter",
          label: "Flutter SDK",
          description: "混合开发主流方案，一套代码 iOS + Android",
          required: false,
        },
      ];
    default:
      return BASE_TOOLS;
  }
}

export function getGoalLabel(goal: BuildGoal | null, appStack: AppStack | null): string {
  if (!goal || goal === "explore") {
    return "先试试 · 网页（推荐）";
  }
  if (goal === "website") return "做网站 / 网页";
  if (goal === "miniprogram") return "微信小程序";
  if (goal === "app") {
    return appStack === "native" ? "手机 App · 原生开发" : "手机 App · 混合开发";
  }
  return "未选择";
}

export function getGoalHint(goal: BuildGoal | null, appStack: AppStack | null): string {
  if (!goal || goal === "explore") {
    return "零基础推荐：先用网页模板练手并部署 Vercel；需要存留言/表单数据时可启用「进阶后端辅助」。";
  }
  if (goal === "website") {
    return "HTML 网页快速上线。前端完成后可选 Vercel Serverless、Supabase 或 LeanCloud 等接轻量 API。";
  }
  if (goal === "miniprogram") {
    return "模板含微信小程序（WXML）与微信小游戏（Canvas）骨架。用微信开发者工具导入；小游戏需 compileType 为 game。可勾选「进阶后端辅助」接入微信云开发。";
  }
  if (goal === "app" && appStack === "hybrid") {
    return "模板为 Flutter 工程骨架。环境就绪后跟着提示词做界面；需要云端数据可启用 Supabase / LeanCloud 等后端辅助。";
  }
  if (goal === "app" && appStack === "native") {
    return "原生模板为 IDE 指引 + 提示词。在 Xcode / Android Studio 建工程后，用 AI 写 SwiftUI 或 Compose；后端可选 Supabase / 云函数。";
  }
  return "";
}

/** 选定目标后写入 store 的默认偏好 */
export function getGoalDefaults(goal: BuildGoal, _appStack: AppStack | null) {
  const effective = goal === "explore" ? "website" : goal;
  if (effective === "website" || goal === "explore") {
    return {
      deployTarget: "vercel" as const,
      gitProvider: "skip" as const,
    };
  }
  if (effective === "miniprogram") {
    return {
      deployTarget: "vercel" as const,
      gitProvider: "skip" as const,
    };
  }
  return {
    deployTarget: "vercel" as const,
    gitProvider: "skip" as const,
  };
}

export function isGoalSelectionComplete(
  goal: BuildGoal | null,
  appStack: AppStack | null,
): boolean {
  if (!goal) return false;
  if (goal === "app" && !appStack) return false;
  return true;
}
