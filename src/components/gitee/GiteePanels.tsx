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

/** Gitee 帐号信息页：实名认证与第三方绑定在同一页 */
export const GITEE_ACCOUNT_INFO_URL =
  "https://gitee.com/profile/account_information";

/** Gitee 新用户创建公开仓库前的平台提示（原文案） */
export const GITEE_REPO_SECURITY_MESSAGE =
  "您的帐号安全评级较低，发布公开内容前请在「个人设置」完成 2FA 或绑定可靠第三方帐号（微信、QQ、GitHub 等）。";

export const GITEE_LINKS = [
  {
    id: "signup",
    label: "注册 Gitee",
    url: "https://gitee.com/signup",
    icon: Globe,
  },
  {
    id: "verify",
    label: "实名认证 · 绑定微信",
    url: GITEE_ACCOUNT_INFO_URL,
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
  repo: ["verify", "new-repo"],
  ssh: ["ssh"],
  test: ["ssh"],
};

const STAGE_HINT: Record<GiteeGuideStage, string> = {
  register:
    "注册后打开「实名认证 · 绑定微信」页：完成实名并在同一页绑定微信，即可创建公开仓库。",
  repo: "若仍提示安全评级较低，请回到帐号信息页确认微信已绑定，再创建空仓库。",
  ssh: "复制下方公钥，在此页添加 SSH 公钥。",
  test: "若测试失败，可再次打开 SSH 公钥页核对是否已保存。",
};

interface GiteeVerifyReminderProps {
  compact?: boolean;
}

/** 实名认证步骤提醒：推荐在同一页绑定微信 */
export function GiteeVerifyReminder({ compact = false }: GiteeVerifyReminderProps) {
  const { open, loading } = useOpenInAppBrowser();
  const verifyLink = GITEE_LINKS.find((l) => l.id === "verify");

  return (
    <div
      className={
        compact
          ? "rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-sm text-muted-foreground"
          : "rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4 text-sm text-muted-foreground"
      }
    >
      <p className="font-medium text-foreground">
        第 2 步 · 实名认证（推荐同时绑定微信）
      </p>
      <p className="mt-1">
        打开 Gitee「帐号信息」页后，先完成<strong className="font-medium text-foreground">实名认证</strong>
        ，再在同一页找到<strong className="font-medium text-foreground">第三方账号绑定 → 微信</strong>
        并绑定。
      </p>
      <p className="mt-2">
        绑定微信后，Gitee 安全评级即满足要求，可以直接创建<strong className="font-medium text-foreground">公开仓库</strong>
        ，无需再单独开启 2FA。
      </p>
      <p className="mt-2 text-xs opacity-90">
        若新建仓库仍提示「帐号安全评级较低」，说明微信尚未绑定成功，请回到该页确认。
      </p>
      {verifyLink && (
        <div className="mt-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={loading}
            onClick={() =>
              void open("open_gitee_in_app", {
                url: verifyLink.url,
                title: verifyLink.label,
              })
            }
          >
            <ShieldCheck className="size-4" />
            {verifyLink.label}
          </Button>
        </div>
      )}
    </div>
  );
}

/** @deprecated 使用 GiteeVerifyReminder */
export function GiteeSecurityNotice(props: GiteeVerifyReminderProps) {
  return <GiteeVerifyReminder {...props} />;
}

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
          {STAGE_HINT[stage]} 点击按钮会在系统浏览器打开。
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {stage === "register" && <GiteeVerifyReminder compact />}
        <div className="flex flex-wrap gap-2">
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
        </div>
      </CardContent>
    </Card>
  );
}
