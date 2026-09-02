"use client";

import { useEffect, useMemo, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { TrackPoint } from "@/lib/types";

const WIDTH = 400;
const HEIGHT = 240;
const PADDING = 24;

// Seconds behind the lead dot, oldest first, so later entries render on top.
const TRAIL_OFFSETS = [0.32, 0.24, 0.17, 0.11, 0.06];
const TRAIL_RADII = [2.5, 3, 3.5, 4, 4.5];
const TRAIL_OPACITIES = [0.15, 0.25, 0.35, 0.5, 0.65];

type ScaledPoint = { x: number; y: number; t: number };

function buildTrace(points: TrackPoint[]) {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const spanX = maxX - minX || 1;
  const spanY = maxY - minY || 1;
  const scale = Math.min((WIDTH - PADDING * 2) / spanX, (HEIGHT - PADDING * 2) / spanY);

  const scaled: ScaledPoint[] = points.map((p) => ({
    x: PADDING + (p.x - minX) * scale,
    y: PADDING + (maxY - p.y) * scale,
    t: p.t,
  }));

  const path = scaled
    .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join(" ");

  const duration = scaled[scaled.length - 1].t || 1;

  return { path, points: scaled, duration, start: scaled[0] };
}

function positionAt(points: ScaledPoint[], time: number) {
  let i = 1;
  while (i < points.length - 1 && points[i].t < time) i++;
  const a = points[i - 1];
  const b = points[i];
  const span = b.t - a.t || 1;
  const frac = Math.min(1, Math.max(0, (time - a.t) / span));
  return { x: a.x + (b.x - a.x) * frac, y: a.y + (b.y - a.y) * frac };
}

export function CircuitTrace({
  points,
  location,
  teamColor,
  lapDurationSeconds,
}: {
  points: TrackPoint[];
  location: string;
  teamColor: string;
  lapDurationSeconds?: number | null;
}) {
  const trace = useMemo(
    () => (points.length > 2 ? buildTrace(points) : null),
    [points]
  );
  const headRef = useRef<SVGCircleElement>(null);
  const trailRefs = useRef<(SVGCircleElement | null)[]>([]);

  useEffect(() => {
    if (!trace) return;
    const duration =
      lapDurationSeconds && lapDurationSeconds > 0
        ? lapDurationSeconds
        : trace.duration;

    const reduceMotion =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    const place = (el: SVGCircleElement | null, pos: { x: number; y: number }) => {
      el?.setAttribute("cx", pos.x.toFixed(1));
      el?.setAttribute("cy", pos.y.toFixed(1));
    };

    if (reduceMotion) {
      place(headRef.current, trace.start);
      trailRefs.current.forEach((el) => place(el, trace.start));
      return;
    }

    let raf = 0;
    const startTime = performance.now();

    const tick = () => {
      const elapsed = ((performance.now() - startTime) / 1000) % duration;
      place(headRef.current, positionAt(trace.points, elapsed));

      TRAIL_OFFSETS.forEach((offset, idx) => {
        const t = (elapsed - offset + duration) % duration;
        place(trailRefs.current[idx], positionAt(trace.points, t));
      });

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [trace, lapDurationSeconds]);

  return (
    <Card
      className="hud-card"
      style={{ "--team-color": teamColor } as React.CSSProperties}
    >
      <CardHeader>
        <CardTitle className="text-sm uppercase tracking-wide text-muted-foreground">
          {location} &mdash; fastest lap replay
        </CardTitle>
      </CardHeader>
      <CardContent>
        {trace ? (
          <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full h-auto">
            <path
              d={trace.path}
              fill="none"
              stroke={teamColor}
              strokeOpacity={0.3}
              strokeWidth={3}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <circle cx={trace.start.x} cy={trace.start.y} r={4} fill="#FFD12E" fillOpacity={0.6} />
            {TRAIL_OFFSETS.map((_, idx) => (
              <circle
                key={idx}
                ref={(el) => {
                  trailRefs.current[idx] = el;
                }}
                r={TRAIL_RADII[idx]}
                fill={teamColor}
                opacity={TRAIL_OPACITIES[idx]}
              />
            ))}
            <circle ref={headRef} r={6} fill={teamColor} stroke="#fff" strokeWidth={1.5} />
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
