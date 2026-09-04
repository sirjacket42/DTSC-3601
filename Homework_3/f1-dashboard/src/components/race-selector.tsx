"use client";

import { useRouter } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ResultRow } from "@/lib/types";

export function RaceSelector({
  races,
  selectedRaceId,
  driverId,
  season,
}: {
  races: ResultRow[];
  selectedRaceId: number;
  driverId: number;
  season: number;
}) {
  const router = useRouter();
  const byId = new Map(races.map((r) => [String(r.id), r]));

  return (
    <Select
      value={String(selectedRaceId)}
      onValueChange={(value) =>
        router.push(`/drivers?driver=${driverId}&season=${season}&race=${value}`)
      }
    >
      <SelectTrigger className="w-[220px] h-8 text-xs hud-card">
        <SelectValue placeholder="Select a race">
          {(value: string | null) =>
            value && byId.has(value)
              ? `R${byId.get(value)!.race.round} · ${byId.get(value)!.race.location}`
              : "Select a race"
          }
        </SelectValue>
      </SelectTrigger>
      <SelectContent className="max-h-80">
        {races.map((r) => (
          <SelectItem key={r.id} value={String(r.id)}>
            Round {r.race.round} &middot; {r.race.location}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
