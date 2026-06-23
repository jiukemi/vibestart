import { Clock, Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { difficultyLabel, loadPacks, type PackMeta } from "@/lib/packs";
import { cn } from "@/lib/utils";

interface PackSelectorProps {
  selectedId: string | null;
  onSelect: (pack: PackMeta) => void;
  disabled?: boolean;
}

const PACKS = loadPacks();

export function PackSelector({
  selectedId,
  onSelect,
  disabled = false,
}: PackSelectorProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {PACKS.map((pack) => {
        const isSelected = selectedId === pack.id;
        return (
          <button
            key={pack.id}
            type="button"
            disabled={disabled}
            onClick={() => onSelect(pack)}
            className="text-left disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Card
              size="sm"
              className={cn(
                "h-full cursor-pointer transition-colors hover:bg-muted/50",
                isSelected && "ring-2 ring-primary",
              )}
            >
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="size-4 text-primary" />
                  {pack.title}
                </CardTitle>
                <CardDescription>{pack.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap gap-1.5">
                  <Badge variant="secondary">
                    {difficultyLabel(pack.difficulty)}
                  </Badge>
                  {pack.tags.map((tag) => (
                    <Badge key={tag} variant="outline">
                      {tag}
                    </Badge>
                  ))}
                </div>
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Clock className="size-3.5" />约 {pack.estimatedMinutes} 分钟
                </p>
              </CardContent>
            </Card>
          </button>
        );
      })}
    </div>
  );
}

export { PACKS };
