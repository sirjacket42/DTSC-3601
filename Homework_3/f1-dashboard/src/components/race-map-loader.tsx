"use client";

import dynamic from "next/dynamic";

export const RaceMap = dynamic(
  () => import("@/components/race-map").then((mod) => mod.RaceMap),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full w-full items-center justify-center bg-card text-xs text-muted-foreground">
        Loading map…
      </div>
    ),
  }
);
