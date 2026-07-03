import { Globe, KeyRound, Plus, Settings } from "lucide-react";

export const GITHUB_LINKS = [
  {
    id: "signup",
    label: "注册 GitHub",
    url: "https://github.com/signup",
    icon: Globe,
  },
  {
    id: "new-repo",
    label: "创建新仓库",
    url: "https://github.com/new",
    icon: Plus,
  },
  {
    id: "ssh",
    label: "SSH 密钥设置",
    url: "https://github.com/settings/keys",
    icon: KeyRound,
  },
  {
    id: "home",
    label: "GitHub 首页",
    url: "https://github.com",
    icon: Settings,
  },
] as const;

export type GithubGuideStage = "register" | "repo" | "ssh" | "test";

export const GITHUB_STAGE_LINK_IDS: Record<
  GithubGuideStage,
  readonly string[]
> = {
  register: ["signup"],
  repo: ["new-repo"],
  ssh: ["ssh"],
  test: ["ssh"],
};

export const GITHUB_STAGE_HINT: Record<GithubGuideStage, string> = {
  register: "注册并验证邮箱。",
  repo: "创建空仓库，不要勾选 README 初始化。",
  ssh: "粘贴本机公钥到 SSH keys 页面。",
  test: "若失败，可再次打开 SSH 设置页核对。",
};
