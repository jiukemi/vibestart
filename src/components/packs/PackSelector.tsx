import { Clock, Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { difficultyLabel, type PackMeta } from "@/lib/packs";
import {
  selectableCardClasses,
  selectableGridButtonClassName,
} from "@/lib/selectable-card";

interface PackSelectorProps {
  packs: PackMeta[];
  selectedId: string | null;
  onSelect: (pack: PackMeta) => void;
  disabled?: boolean;
}

export function PackSelector({
  packs,
  selectedId,
  onSelect,
  disabled = false,
}: PackSelectorProps) {
  if (packs.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        当前方向暂无匹配模板，请在工作台切换方向或联系更新。
      </p>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {packs.map((pack) => {
        const isSelected = selectedId === pack.id;
        return (
          <button
            key={pack.id}
            type="button"
            disabled={disabled}
            onClick={() => onSelect(pack)}
            className={selectableGridButtonClassName(
              "disabled:cursor-not-allowed disabled:opacity-60",
            )}
          >
            <Card
              size="sm"
              className={selectableCardClasses(isSelected, "h-full cursor-pointer")}
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
                  {pack.hasBackendTutorial && (
                    <Badge variant="outline">可接后端</Badge>
                  )}
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
