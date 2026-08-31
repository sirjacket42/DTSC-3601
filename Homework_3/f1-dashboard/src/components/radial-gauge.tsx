"use client";

import { RadialBar, RadialBarChart, PolarAngleAxis } from "recharts";
import { ChartContainer, type ChartConfig } from "@/components/ui/chart";
import { cn } from "@/lib/utils";

export function RadialGauge({
  label,
  value,
  displayValue,
  suffix,
  color,
  className,
}: {
  label: string;
  value: number; // 0-100
  displayValue: string | number;
  suffix?: string;
  color: string;
  className?: string;
}) {
  const config = { value: { label, color } } satisfies ChartConfig;
  const data = [{ name: label, value: Math.min(100, Math.max(0, value)), fill: color }];

  return (
    <div
      className={cn("hud-card rounded-2xl p-3 flex flex-col items-center", className)}
      style={{ "--team-color": color } as React.CSSProperties}
    >
      <div className="relative">
        <ChartContainer config={config} className="aspect-square h-[128px] w-[128px]">
          <RadialBarChart
            data={data}
            innerRadius="72%"
            outerRadius="100%"
            startAngle={90}
            endAngle={-270}
          >
            <PolarAngleAxis
              type="number"
              domain={[0, 100]}
              angleAxisId={0}
              tick={false}
            />
            <RadialBar
              dataKey="value"
              background={{ fill: "color-mix(in oklch, var(--team-color) 15%, var(--muted))" }}
              cornerRadius={8}
            />
          </RadialBarChart>
        </ChartContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-2xl font-black tabular-nums font-mono" style={{ color }}>
            {displayValue}
          </span>
          {suffix && (
            <span className="text-[10px] text-muted-foreground -mt-0.5">{suffix}</span>
          )}
        </div>
      </div>
      <span className="text-[11px] uppercase tracking-wide text-muted-foreground mt-1">
        {label}
      </span>
    </div>
  );
}
