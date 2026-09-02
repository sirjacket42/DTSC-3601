"use client";

import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  Tooltip,
} from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ChartContainer, type ChartConfig } from "@/components/ui/chart";
import type { SeasonStats, StandingsRank } from "@/lib/types";

type RadarPoint = {
  metric: string;
  value: number;
  detail: string;
};

function buildRadarData(
  stats: SeasonStats,
  standing: StandingsRank | null
): RadarPoint[] {
  const races = stats.races;
  const plural = (n: number) => (n === 1 ? "" : "s");

  const championshipValue = standing
    ? ((standing.total - standing.rank + 1) / standing.total) * 100
    : 0;
  const championshipDetail = standing
    ? `P${standing.rank} of ${standing.total} drivers`
    : "Not yet ranked";

  const winValue = races ? (stats.wins / races) * 100 : 0;
  const winDetail = `${stats.wins} win${plural(stats.wins)} in ${races} race${plural(races)}`;

  const podiumValue = races ? (stats.podiums / races) * 100 : 0;
  const podiumDetail = `${stats.podiums} top-3 finish${stats.podiums === 1 ? "" : "es"}`;

  const finishes = races - stats.dnfs;
  const finishValue = races ? (finishes / races) * 100 : 0;
  const finishDetail = `${finishes} of ${races} race${plural(races)} finished`;

  const scoringValue = races
    ? Math.min(100, (stats.points / (races * 25)) * 100)
    : 0;
  const avgPoints = races ? (stats.points / races).toFixed(1) : "0.0";
  const scoringDetail = `${stats.points} pts this season · ${avgPoints} pts/race avg`;

  return [
    {
      metric: "Championship",
      value: Math.round(championshipValue),
      detail: championshipDetail,
    },
    { metric: "Wins", value: Math.round(winValue), detail: winDetail },
    {
      metric: "Podiums",
      value: Math.round(podiumValue),
      detail: podiumDetail,
    },
    {
      metric: "Finishes",
      value: Math.round(finishValue),
      detail: finishDetail,
    },
    {
      metric: "Scoring",
      value: Math.round(scoringValue),
      detail: scoringDetail,
    },
  ];
}

function RadarTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: RadarPoint }[];
}) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  return (
    <div className="rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-xl max-w-[180px]">
      <div className="font-medium">{point.metric}</div>
      <div className="text-muted-foreground">{point.detail}</div>
    </div>
  );
}

export function DriverRadarChart({
  stats,
  standing,
  teamColor,
}: {
  stats: SeasonStats;
  standing: StandingsRank | null;
  teamColor: string;
}) {
  const data = buildRadarData(stats, standing);
  const config = {
    value: { label: "Performance", color: teamColor },
  } satisfies ChartConfig;

  return (
    <Card
      className="hud-card h-full"
      style={{ "--team-color": teamColor } as React.CSSProperties}
    >
      <CardHeader>
        <CardTitle className="text-sm uppercase tracking-wide text-muted-foreground">
          Performance overview
        </CardTitle>
        <CardDescription className="text-xs">
          Five season stats scaled 0–100, so a bigger, rounder shape means a
          stronger season
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer
          config={config}
          className="aspect-square h-[260px] w-full mx-auto max-w-[320px]"
        >
          <RadarChart data={data} outerRadius="75%">
            <PolarGrid strokeOpacity={0.25} />
            <PolarAngleAxis
              dataKey="metric"
              tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
            />
            <PolarRadiusAxis
              domain={[0, 100]}
              tick={false}
              axisLine={false}
            />
            <Radar
              dataKey="value"
              stroke={teamColor}
              fill={teamColor}
              fillOpacity={0.35}
              strokeWidth={2}
              dot={{ r: 3, fill: teamColor }}
            />
            <Tooltip content={<RadarTooltip />} />
          </RadarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
