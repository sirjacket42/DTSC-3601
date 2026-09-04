"use client";

import { useRef } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { flagEmojiFromISO2 } from "@/lib/format";
import { getCircuitInfo } from "@/lib/circuits";
import type { Race } from "@/lib/types";

export function RaceCarousel({
  races,
  selectedRaceId,
  currentRaceId,
  season,
}: {
  races: Race[];
  selectedRaceId: number;
  currentRaceId: number | null;
  season: number;
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const currentRace = races.find((r) => r.id === currentRaceId) ?? null;
  const currentDate = currentRace ? new Date(currentRace.date_start).getTime() : null;

  const scrollBy = (dx: number) =>
    scrollerRef.current?.scrollBy({ left: dx, behavior: "smooth" });

  return (
    <div className="flex items-stretch gap-2">
      <button
        type="button"
        onClick={() => scrollBy(-320)}
        className="hidden sm:flex items-center justify-center size-9 shrink-0 self-center rounded-full border border-border bg-card text-foreground hover:bg-accent"
        aria-label="Scroll left"
      >
        <ChevronLeft className="size-4" />
      </button>

      <div
        ref={scrollerRef}
        className="flex-1 flex gap-3 overflow-x-auto scroll-smooth pb-1 [scrollbar-width:thin]"
      >
        {races.map((race) => {
          const info = getCircuitInfo(race.location);
          const isSelected = race.id === selectedRaceId;
          const isCurrent = race.id === currentRaceId;
          const raceDate = new Date(race.date_start).getTime();
          const status = isCurrent
            ? "CURRENT"
            : currentDate !== null && raceDate < currentDate
              ? "COMPLETED"
              : "UPCOMING";

          return (
            <Link
              key={race.id}
              href={`/schedule?season=${season}&race=${race.id}`}
              className={cn(
                "shrink-0 w-[220px] rounded-xl border p-4 transition-colors",
                isSelected
                  ? "border-primary bg-card ring-1 ring-primary"
                  : "border-border bg-card hover:border-muted-foreground/40"
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-muted-foreground">
                  R{race.round}
                </span>
                <Badge variant={status === "CURRENT" ? "default" : status === "COMPLETED" ? "secondary" : "outline"}>
                  {status}
                </Badge>
              </div>
              <div className="mt-2 flex items-center gap-2 text-lg font-semibold">
                {info && <span>{flagEmojiFromISO2(info.countryCode)}</span>}
                <span>{info?.country ?? race.location}</span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {new Date(race.date_start).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </p>
            </Link>
          );
        })}
      </div>

      <button
        type="button"
        onClick={() => scrollBy(320)}
        className="hidden sm:flex items-center justify-center size-9 shrink-0 self-center rounded-full border border-border bg-card text-foreground hover:bg-accent"
        aria-label="Scroll right"
      >
        <ChevronRight className="size-4" />
      </button>
    </div>
  );
}
