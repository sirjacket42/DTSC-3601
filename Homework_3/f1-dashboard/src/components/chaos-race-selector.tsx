"use client";

import { useRouter } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Race } from "@/lib/types";

export function ChaosRaceSelector({
  races,
  selectedRaceId,
  season,
}: {
  races: Race[];
  selectedRaceId: number;
  season: number;
}) {
  const router = useRouter();
  const byId = new Map(races.map((r) => [String(r.id), r]));

  return (
    <Select
      value={String(selectedRaceId)}
      onValueChange={(value) => router.push(`/chaos?season=${season}&race=${value}`)}
    >
      <SelectTrigger className="w-[220px] h-8 text-xs hud-card">
        <SelectValue placeholder="Select a race">
          {(value: string | null) =>
            value && byId.has(value)
              ? `R${byId.get(value)!.round} · ${byId.get(value)!.location}`
              : "Select a race"
          }
        </SelectValue>
      </SelectTrigger>
      <SelectContent className="max-h-80">
        {races.map((r) => (
          <SelectItem key={r.id} value={String(r.id)}>
            Round {r.round} &middot; {r.location}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
