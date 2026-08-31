import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  suffix,
  accent,
  className,
}: {
  label: string;
  value: string | number;
  suffix?: string;
  accent?: string;
  className?: string;
}) {
  return (
    <Card
      className={cn("hud-card gap-1 py-4", className)}
      style={accent ? ({ "--team-color": accent } as React.CSSProperties) : undefined}
    >
      <CardContent className="px-4">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">
          {label}
        </div>
        <div className="text-2xl font-bold font-mono tabular-nums mt-1">
          {value}
          {suffix && (
            <span className="text-sm font-normal text-muted-foreground ml-1">
              {suffix}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
