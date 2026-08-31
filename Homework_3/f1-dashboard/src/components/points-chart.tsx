"use client";

import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
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
import type { PointsProgressionPoint } from "@/lib/types";

export function PointsChart({
  data,
  teamColor,
}: {
  data: PointsProgressionPoint[];
  teamColor: string;
}) {
  const config = {
    cumulativePoints: { label: "Cumulative points", color: teamColor },
  } satisfies ChartConfig;

  return (
    <Card
      className="hud-card"
      style={{ "--team-color": teamColor } as React.CSSProperties}
    >
      <CardHeader>
        <CardTitle className="text-sm uppercase tracking-wide text-muted-foreground">
          Points progression
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={config} className="aspect-auto h-[220px] w-full">
          <AreaChart data={data} margin={{ left: 0, right: 12, top: 8 }}>
            <defs>
              <linearGradient id="pointsFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={teamColor} stopOpacity={0.6} />
                <stop offset="95%" stopColor={teamColor} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} strokeOpacity={0.15} />
            <XAxis
              dataKey="round"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tickFormatter={(v) => `R${v}`}
            />
            <YAxis tickLine={false} axisLine={false} tickMargin={8} width={32} />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  labelFormatter={(_, payload) =>
                    payload?.[0]?.payload?.location ?? ""
                  }
                />
              }
            />
            <Area
              dataKey="cumulativePoints"
              type="monotone"
              stroke={teamColor}
              fill="url(#pointsFill)"
              strokeWidth={2}
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
