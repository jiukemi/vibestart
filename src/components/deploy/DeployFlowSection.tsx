import { cn } from "@/lib/utils";

interface DeployFlowSectionProps {
  step: number;
  title: string;
  children: React.ReactNode;
  className?: string;
}

export function DeployFlowSection({
  step,
  title,
  children,
  className,
}: DeployFlowSectionProps) {
  return (
    <section className={cn("space-y-3", className)}>
      <div className="flex items-center gap-2">
        <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
          {step}
        </span>
        <h3 className="text-sm font-medium text-foreground">{title}</h3>
      </div>
      <div className="space-y-3 border-l border-border pl-4 sm:pl-5">{children}</div>
    </section>
  );
}
