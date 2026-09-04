"use client";

import { useRouter } from "next/navigation";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function ScheduleSeasonTabs({
  seasons,
  selectedSeason,
}: {
  seasons: number[];
  selectedSeason: number;
}) {
  const router = useRouter();

  return (
    <Tabs
      value={String(selectedSeason)}
      onValueChange={(value) => router.push(`/schedule?season=${value}`)}
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
