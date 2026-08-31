"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Cell } from "recharts";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import type { LapPoint } from "@/lib/types";

export function LapTimesChart({
  laps,
  teamColor,
}: {
  laps: LapPoint[];
  teamColor: string;
}) {
  const timed = laps.filter((l) => l.lapDuration !== null && !l.isPitOutLap);
  const fastest = timed.length
    ? Math.min(...timed.map((l) => l.lapDuration as number))
    : null;

  const config = {
    lapDuration: { label: "Lap time (s)", color: teamColor },
  } satisfies ChartConfig;

  return (
    <Card
      className="hud-card"
      style={{ "--team-color": teamColor } as React.CSSProperties}
    >
      <CardHeader>
        <CardTitle className="text-sm uppercase tracking-wide text-muted-foreground">
          Lap times
        </CardTitle>
      </CardHeader>
      <CardContent>
        {timed.length ? (
          <ChartContainer config={config} className="aspect-auto h-[200px] w-full">
            <BarChart data={timed} margin={{ left: 0, right: 8, top: 8 }}>
              <CartesianGrid vertical={false} strokeOpacity={0.15} />
              <XAxis
                dataKey="lapNumber"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                tickFormatter={(v) => `L${v}`}
              />
              <YAxis
                domain={["dataMin - 2", "dataMax + 2"]}
                tickLine={false}
                axisLine={false}
                width={48}
                tickFormatter={(v) => Math.round(v).toString()}
              />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="lapDuration" radius={2}>
                {timed.map((l) => (
                  <Cell
                    key={l.lapNumber}
                    fill={l.lapDuration === fastest ? "#FFD12E" : teamColor}
                  />
                ))}
              </Bar>
            </BarChart>
          </ChartContainer>
        ) : (
          <p className="text-sm text-muted-foreground">
            No lap telemetry available for this session.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
