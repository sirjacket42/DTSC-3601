import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Stint } from "@/lib/types";

const COMPOUND_COLORS: Record<string, string> = {
  SOFT: "#DA291C",
  MEDIUM: "#FFD12E",
  HARD: "#F0F0F0",
  INTERMEDIATE: "#43B02A",
  WET: "#0067AD",
};

function compoundColor(compound: string) {
  return COMPOUND_COLORS[compound] ?? "#888888";
}

export function TireStrategy({
  stints,
  teamColor,
}: {
  stints: Stint[];
  teamColor: string;
}) {
  const totalLaps = stints.length
    ? Math.max(...stints.map((s) => s.lapEnd))
    : 0;

  return (
    <Card
      className="hud-card"
      style={{ "--team-color": teamColor } as React.CSSProperties}
    >
      <CardHeader>
        <CardTitle className="text-sm uppercase tracking-wide text-muted-foreground">
          Tire strategy
        </CardTitle>
      </CardHeader>
      <CardContent>
        {stints.length ? (
          <div className="space-y-3">
            <div className="flex h-4 w-full overflow-hidden rounded-full border border-border">
              {stints.map((s) => (
                <div
                  key={s.stintNumber}
                  className="h-full"
                  style={{
                    width: `${((s.lapEnd - s.lapStart) / totalLaps) * 100}%`,
                    background: compoundColor(s.compound),
                  }}
                  title={`${s.compound} · laps ${s.lapStart}-${s.lapEnd}`}
                />
              ))}
            </div>
            <div className="flex flex-wrap gap-3 text-xs">
              {stints.map((s) => (
                <div key={s.stintNumber} className="flex items-center gap-1.5">
                  <span
                    className="size-2.5 rounded-full inline-block"
                    style={{ background: compoundColor(s.compound) }}
                  />
                  <span className="font-medium">{s.compound}</span>
                  <span className="text-muted-foreground">
                    L{s.lapStart}&ndash;{s.lapEnd}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            No tire stint telemetry available for this session.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
