"use client";

import { useRouter } from "next/navigation";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function SeasonTabs({
  seasons,
  selectedSeason,
  driverId,
}: {
  seasons: number[];
  selectedSeason: number;
  driverId: number;
}) {
  const router = useRouter();

  return (
    <Tabs
      value={String(selectedSeason)}
      onValueChange={(value) =>
        router.push(`/drivers?driver=${driverId}&season=${value}`)
      }
    >
      <TabsList>
        {seasons.map((s) => (
          <TabsTrigger key={s} value={String(s)}>
            {s}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
