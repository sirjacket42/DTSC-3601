import Link from "next/link";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { TeamBadge } from "@/components/team-badge";

export type StandingsRow = {
  key: string | number;
  pos: number;
  name: string;
  sub?: string | null;
  teamName: string;
  color: string;
  points: number;
  href?: string;
};

export function StandingsTable({
  title,
  action,
  rows,
}: {
  title: string;
  action?: React.ReactNode;
  rows: StandingsRow[];
}) {
  return (
    <Card className="hud-card">
      <CardHeader>
        <CardTitle className="text-sm uppercase tracking-wide text-muted-foreground">
          {title}
        </CardTitle>
        {action && <CardAction>{action}</CardAction>}
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No standings yet.</p>
        ) : (
          <div className="text-sm">
            <div className="grid grid-cols-[2rem_2rem_1fr_auto] gap-3 px-1 pb-2 text-[11px] uppercase tracking-wide text-muted-foreground">
              <span>Pos</span>
              <span />
              <span>{title.toLowerCase().includes("constructor") ? "Constructor" : "Driver"}</span>
              <span className="text-right">Points</span>
            </div>
            <div className="space-y-0.5">
              {rows.map((row) => {
                const content = (
                  <>
                    <span className="font-mono tabular-nums text-muted-foreground">
                      {row.pos}
                    </span>
                    <TeamBadge teamName={row.teamName} color={row.color} />
                    <span className="flex items-center gap-2 min-w-0">
                      <span className="truncate font-medium">{row.name}</span>
                      {row.sub && (
                        <span className="truncate text-xs text-muted-foreground hidden sm:inline">
                          {row.sub}
                        </span>
                      )}
                    </span>
                    <span className="text-right font-mono tabular-nums">
                      {row.points}
                    </span>
                  </>
                );

                const rowClass = cn(
                  "grid grid-cols-[2rem_2rem_1fr_auto] items-center gap-3 rounded-md px-1 py-1.5 transition-colors"
                );

                return row.href ? (
                  <Link
                    key={row.key}
                    href={row.href}
                    className={cn(rowClass, "hover:bg-accent/60")}
                  >
                    {content}
                  </Link>
                ) : (
                  <div key={row.key} className={rowClass}>
                    {content}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
