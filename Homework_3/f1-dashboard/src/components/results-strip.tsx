import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { ordinal } from "@/lib/format";
import type { ResultRow } from "@/lib/types";

function positionColor(position: number | null, dnf: boolean, dns: boolean, dsq: boolean) {
  if (dns || dsq) return "text-muted-foreground";
  if (dnf) return "text-destructive";
  if (position === 1) return "text-yellow-400";
  if (position !== null && position <= 3) return "text-zinc-200";
  return "text-foreground";
}

export function ResultsStrip({
  results,
  teamColor,
}: {
  results: ResultRow[];
  teamColor: string;
}) {
  const ordered = [...results].reverse();

  return (
    <Card
      className="hud-card"
      style={{ "--team-color": teamColor } as React.CSSProperties}
    >
      <CardHeader>
        <CardTitle className="text-sm uppercase tracking-wide text-muted-foreground">
          Race results
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="w-full whitespace-nowrap">
          <div className="flex gap-3 pb-3">
            {ordered.map((r) => (
              <div
                key={r.id}
                className="flex flex-col items-center justify-center rounded-lg border px-4 py-3 min-w-[92px]"
                style={{ borderColor: `color-mix(in oklch, ${teamColor} 30%, var(--border))` }}
              >
                <span
                  className={`text-xl font-black font-mono tabular-nums ${positionColor(
                    r.position,
                    r.dnf,
                    r.dns,
                    r.dsq
                  )}`}
                >
                  {r.dns ? "DNS" : r.dsq ? "DSQ" : r.dnf ? "DNF" : ordinal(r.position)}
                </span>
                <span className="text-[11px] text-muted-foreground mt-1 truncate max-w-[80px]">
                  {r.race.location}
                </span>
                <span className="text-xs font-medium tabular-nums mt-0.5">
                  {Number(r.points)} pts
                </span>
              </div>
            ))}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
