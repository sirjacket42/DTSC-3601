import { cn } from "@/lib/utils";

export function SeasonProgressBar({
  total,
  completed,
  className,
}: {
  total: number;
  completed: number;
  className?: string;
}) {
  if (total <= 0) return null;

  return (
    <div className={cn("flex items-center gap-1", className)} aria-hidden="true">
      {Array.from({ length: total }).map((_, i) => {
        const isCurrent = i === completed;
        const isDone = i < completed;
        return (
          <div
            key={i}
            className={cn(
              "h-6 flex-1 rounded-sm transition-colors",
              isCurrent
                ? "bg-primary"
                : isDone
                  ? "bg-muted-foreground/40"
                  : "bg-muted-foreground/10"
            )}
          />
        );
      })}
    </div>
  );
}
