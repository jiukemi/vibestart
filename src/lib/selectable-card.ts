import { cn } from "@/lib/utils";

/** Border-based selection — rings extend outside the box and get clipped by overflow scroll areas. */
export function selectableCardClasses(isSelected: boolean, className?: string) {
  return cn(
    "h-full w-full ring-0 transition-colors",
    isSelected
      ? "border-2 border-primary bg-primary/5"
      : "border border-border hover:bg-muted/50",
    className,
  );
}

export function selectableGridButtonClassName(className?: string) {
  return cn(
    "w-full rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
    className,
  );
}
