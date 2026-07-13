import { QRCodeSVG } from "qrcode.react";

import { cn } from "@/lib/utils";

interface DeployUrlQrProps {
  url: string;
  size?: number;
  className?: string;
}

export function DeployUrlQr({ url, size = 96, className }: DeployUrlQrProps) {
  return (
    <div
      className={cn(
        "inline-flex flex-col items-center rounded-xl border border-border bg-background p-3",
        className,
      )}
    >
      <QRCodeSVG value={url} size={size} />
      <p className="mt-2 text-center text-xs text-muted-foreground">扫码分享</p>
    </div>
  );
}
