import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { TrackPoint } from "@/lib/types";

function buildTrace(points: TrackPoint[], width: number, height: number, padding: number) {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const spanX = maxX - minX || 1;
  const spanY = maxY - minY || 1;
  const scale = Math.min((width - padding * 2) / spanX, (height - padding * 2) / spanY);

  const scaled = points.map((p) => ({
    x: padding + (p.x - minX) * scale,
    y: padding + (maxY - p.y) * scale,
  }));

  const path = scaled
    .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join(" ");

  return { path, start: scaled[0] };
}

export function CircuitTrace({
  points,
  location,
  teamColor,
}: {
  points: TrackPoint[];
  location: string;
  teamColor: string;
}) {
  const width = 400;
  const height = 240;
  const trace = points.length > 2 ? buildTrace(points, width, height, 24) : null;

  return (
    <Card
      className="hud-card"
      style={{ "--team-color": teamColor } as React.CSSProperties}
    >
      <CardHeader>
        <CardTitle className="text-sm uppercase tracking-wide text-muted-foreground">
          {location} &mdash; fastest lap trace
        </CardTitle>
      </CardHeader>
      <CardContent>
        {trace ? (
          <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto">
            <path
              d={trace.path}
              fill="none"
              stroke={teamColor}
              strokeWidth={3}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <circle cx={trace.start.x} cy={trace.start.y} r={5} fill="#FFD12E" />
          </svg>
        ) : (
          <p className="text-sm text-muted-foreground">
            No location telemetry available for this session.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
