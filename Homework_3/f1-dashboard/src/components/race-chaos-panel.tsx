"use client";

import { useEffect, useState } from "react";
import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  Tooltip,
} from "recharts";
import { RotateCw, TriangleAlert } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ChartContainer, type ChartConfig } from "@/components/ui/chart";
import type { ChaosBuildResult, ChaosFeatures, ChaosResponse } from "@/lib/chaos";

const FEATURE_LABELS: Record<keyof ChaosFeatures, string> = {
  retirement_rate: "Retirements",
  retirement_lap_spread: "Retirement spread",
  position_shuffle: "Position shuffle",
  winner_grid: "Winner from grid",
  podium_closeness: "Podium closeness",
  neutralizations: "Neutralizations",
};

const FEATURE_ORDER = Object.keys(FEATURE_LABELS) as (keyof ChaosFeatures)[];

type RadarPoint = { metric: string; value: number };

function buildRadarData(features: ChaosFeatures): RadarPoint[] {
  return FEATURE_ORDER.map((key) => ({
    metric: FEATURE_LABELS[key],
    value: Math.round(features[key]),
  }));
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
    <div className="rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-xl">
      <div className="font-medium">{point.metric}</div>
      <div className="text-muted-foreground">{point.value}th percentile</div>
    </div>
  );
}

type ErrorKind = "validation" | "unavailable" | "network";

type FetchState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; data: ChaosResponse }
  | { status: "error"; kind: ErrorKind; message: string };

class ChaosApiError extends Error {
  kind: ErrorKind;
  constructor(kind: ErrorKind, message: string) {
    super(message);
    this.kind = kind;
  }
}

/** FastAPI's 422 body is `{"detail": [{"loc": [...], "msg": "...", "type": "..."}, ...]}`. */
function summarizeValidationError(body: unknown): string {
  if (body && typeof body === "object" && Array.isArray((body as { detail?: unknown }).detail)) {
    const items = (body as { detail: { loc?: unknown[]; msg?: string }[] }).detail;
    const first = items[0];
    if (first?.msg) {
      const field = Array.isArray(first.loc) ? first.loc.at(-1) : undefined;
      return typeof field === "string" ? `${field}: ${first.msg}` : first.msg;
    }
  }
  return "The API rejected this race's data (422 validation error).";
}

function labelBadgeClass(label: ChaosResponse["chaos_label"]): string {
  switch (label) {
    case "Calm":
      return "bg-secondary text-secondary-foreground";
    case "Eventful":
      return "bg-[color-mix(in_oklch,var(--chart-2)_25%,transparent)] text-[var(--chart-2)]";
    case "Chaotic":
      return "bg-[color-mix(in_oklch,var(--primary)_25%,transparent)] text-[var(--primary)]";
    case "Legendary":
      return "bg-primary text-primary-foreground";
  }
}

function chaosApiBase(): string | null {
  const raw = process.env.NEXT_PUBLIC_CHAOS_API_URL;
  if (!raw) return null;
  return raw.replace(/\/+$/, "");
}

export function RaceChaosPanel({
  raceName,
  build,
}: {
  raceName: string;
  build: ChaosBuildResult;
}) {
  const base = chaosApiBase();
  const [state, setState] = useState<FetchState>({ status: "idle" });
  const [slowLoad, setSlowLoad] = useState(false);
  const [retryToken, setRetryToken] = useState(0);

  useEffect(() => {
    if (!base || !build.ok) return;

    const controller = new AbortController();
    let slowTimer: ReturnType<typeof setTimeout> | undefined;

    // Deferred a tick (rather than set synchronously in the effect body) so
    // this reads as "subscribe, then report the loading phase" instead of a
    // setState called directly from the effect.
    Promise.resolve().then(() => {
      if (controller.signal.aborted) return;
      setState({ status: "loading" });
      setSlowLoad(false);
      slowTimer = setTimeout(() => setSlowLoad(true), 3000);
    });

    fetch(`${base}/chaos-score`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(build.payload),
      signal: controller.signal,
    })
      .then(async (res) => {
        if (res.status === 422) {
          const body = await res.json().catch(() => null);
          throw new ChaosApiError("validation", summarizeValidationError(body));
        }
        if (res.status === 503) {
          throw new ChaosApiError(
            "unavailable",
            "The chaos model isn't loaded on the API right now."
          );
        }
        if (!res.ok) {
          throw new ChaosApiError("network", `Request failed (HTTP ${res.status}).`);
        }
        return (await res.json()) as ChaosResponse;
      })
      .then((data) => setState({ status: "success", data }))
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        if (err instanceof ChaosApiError) {
          setState({ status: "error", kind: err.kind, message: err.message });
        } else {
          setState({
            status: "error",
            kind: "network",
            message:
              err instanceof Error ? err.message : "Network error reaching the chaos API.",
          });
        }
      })
      .finally(() => clearTimeout(slowTimer));

    return () => {
      controller.abort();
      clearTimeout(slowTimer);
    };
    // `build` is a fresh object every render, which is exactly what we want:
    // a new race (or a re-fetched payload for the same race) should re-POST.
  }, [base, build, retryToken]);

  const config = {
    value: { label: "Percentile", color: "var(--primary)" },
  } satisfies ChartConfig;

  return (
    <Card className="hud-card h-full">
      <CardHeader>
        <CardTitle className="text-sm uppercase tracking-wide text-muted-foreground">
          Race Chaos
        </CardTitle>
        <CardDescription className="text-xs">
          Machine-learning read on {raceName}, scored by a scikit-learn pipeline trained on
          historical races
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!base ? (
          <p className="text-sm text-muted-foreground">
            Chaos API not configured — set{" "}
            <code className="text-xs bg-muted px-1 py-0.5 rounded">
              NEXT_PUBLIC_CHAOS_API_URL
            </code>{" "}
            to enable this panel.
          </p>
        ) : !build.ok ? (
          <p className="text-sm text-muted-foreground">
            Chaos score not available for this race — {build.reason}
          </p>
        ) : state.status === "loading" || state.status === "idle" ? (
          <div className="space-y-3">
            <div className="flex gap-6">
              <Skeleton className="h-16 w-24" />
              <Skeleton className="h-16 w-24" />
            </div>
            <Skeleton className="h-[220px] w-full" />
            <p className="text-xs text-muted-foreground">
              {slowLoad
                ? "Waking up the model… Modal cold starts can take 10–30s."
                : "Scoring this race…"}
            </p>
          </div>
        ) : state.status === "error" ? (
          <div className="space-y-3">
            <div className="flex items-start gap-2 text-sm text-destructive">
              <TriangleAlert className="size-4 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium">
                  {state.kind === "validation"
                    ? "Invalid request (422)"
                    : state.kind === "unavailable"
                      ? "Model unavailable (503)"
                      : "Couldn't reach the chaos API"}
                </p>
                <p className="text-muted-foreground">{state.message}</p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setRetryToken((n) => n + 1)}
            >
              <RotateCw className="size-3.5" />
              Retry
            </Button>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-end gap-6">
              <div>
                <div className="text-3xl font-black font-mono tabular-nums text-primary">
                  {Math.round(state.data.chaos_score)}
                </div>
                <Badge className={`mt-1 ${labelBadgeClass(state.data.chaos_label)}`}>
                  {state.data.chaos_label}
                </Badge>
                <p className="text-[11px] text-muted-foreground mt-1">
                  Chaos &middot; {Math.round(state.data.chaos_percentile)}th percentile
                </p>
              </div>
              <div>
                <div
                  className="text-3xl font-black font-mono tabular-nums"
                  style={{ color: "var(--chart-2)" }}
                >
                  {Math.round(state.data.weirdness_score)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Weirdness score</p>
                <p className="text-[11px] text-muted-foreground">
                  {Math.round(state.data.weirdness_percentile)}th percentile
                </p>
              </div>
            </div>

            <ChartContainer
              config={config}
              className="aspect-square h-[240px] w-full mx-auto max-w-[300px]"
            >
              <RadarChart data={buildRadarData(state.data.features)} outerRadius="75%">
                <PolarGrid stroke="var(--muted-foreground)" strokeOpacity={0.45} />
                <PolarAngleAxis
                  dataKey="metric"
                  stroke="var(--muted-foreground)"
                  strokeOpacity={0.45}
                  tick={{ fill: "var(--foreground)", fontSize: 10, fontWeight: 500 }}
                />
                <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
                <Radar
                  dataKey="value"
                  stroke="var(--primary)"
                  fill="var(--primary)"
                  fillOpacity={0.5}
                  strokeWidth={2.5}
                  dot={{ r: 3.5, fill: "var(--primary)", stroke: "var(--card)", strokeWidth: 1 }}
                />
                <Tooltip content={<RadarTooltip />} />
              </RadarChart>
            </ChartContainer>

            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1.5">
                Most similar races
              </p>
              <ul className="space-y-1">
                {state.data.most_similar_races.map((r) => (
                  <li
                    key={`${r.season}-${r.round}`}
                    className="flex items-center justify-between text-sm"
                  >
                    <span>
                      {r.season} {r.race_name}
                    </span>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      distance {r.distance.toFixed(2)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <p className="text-[11px] text-muted-foreground border-t border-border pt-3">
              <span className="font-medium text-foreground">Chaos</span> is directional — how
              eventful this race was (retirements, shuffled order, neutralizations, a close or
              come-from-behind result).{" "}
              <span className="font-medium text-foreground">Weirdness</span> is non-directional —
              how unusual the race&apos;s whole profile is versus history, so a dominant lights-to-flag
              win can score low chaos but high weirdness.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
