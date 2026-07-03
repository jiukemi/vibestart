import { Globe, KeyRound, Plus, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useOpenInAppBrowser } from "@/hooks/useOpenInAppBrowser";

export const GITEE_LINKS = [
  {
    id: "signup",
    label: "注册 Gitee",
    url: "https://gitee.com/signup",
    icon: Globe,
  },
  {
    id: "verify",
    label: "实名认证",
    url: "https://gitee.com/profile/account_information",
    icon: ShieldCheck,
  },
  {
    id: "new-repo",
    label: "创建仓库",
    url: "https://gitee.com/projects/new",
    icon: Plus,
  },
  {
    id: "ssh",
    label: "SSH 公钥",
    url: "https://gitee.com/profile/sshkeys",
    icon: KeyRound,
  },
] as const;

export type GiteeGuideStage = "register" | "repo" | "ssh" | "test";

const STAGE_LINK_IDS: Record<GiteeGuideStage, readonly string[]> = {
  register: ["signup", "verify"],
  repo: ["new-repo"],
  ssh: ["ssh"],
  test: ["ssh"],
};

const STAGE_HINT: Record<GiteeGuideStage, string> = {
  register: "完成注册与实名认证（Pages 必需）。",
  repo: "创建空仓库，建议命名 my-vibe-project。",
  ssh: "复制下方公钥，在此页添加 SSH 公钥。",
  test: "若测试失败，可再次打开 SSH 公钥页核对是否已保存。",
};

interface GiteeBrowserPanelProps {
  /** 当前子步骤，只展示对应引导链接 */
  stage: GiteeGuideStage;
}

export function GiteeBrowserPanel({ stage }: GiteeBrowserPanelProps) {
  const { open, loading } = useOpenInAppBrowser();
  const linkIds = STAGE_LINK_IDS[stage];
  const links = GITEE_LINKS.filter((l) =>
    (linkIds as readonly string[]).includes(l.id),
  );

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle className="text-base">Gitee 操作</CardTitle>
        <CardDescription>
          {STAGE_HINT[stage]} 应用内打开，登录态会保留。
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        {links.map(({ label, url, icon: Icon }) => (
          <Button
            key={url}
            type="button"
            variant="outline"
            size="sm"
            disabled={loading}
            onClick={() => void open("open_gitee_in_app", { url, title: label })}
          >
            <Icon className="size-4" />
            {label}
          </Button>
        ))}
      </CardContent>
    </Card>
  );
}
