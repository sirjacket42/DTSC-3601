"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
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
  const selectedRef = useRef<HTMLAnchorElement>(null);
  const currentRace = races.find((r) => r.id === currentRaceId) ?? null;
  const currentDate = currentRace ? new Date(currentRace.date_start).getTime() : null;

  const scrollBy = (dx: number) =>
    scrollerRef.current?.scrollBy({ left: dx, behavior: "smooth" });

  useEffect(() => {
    selectedRef.current?.scrollIntoView({
      behavior: "smooth",
      inline: "center",
      block: "nearest",
    });
  }, [selectedRaceId]);

  return (
    <div className="flex items-stretch gap-2">
      <button
        type="button"
        onClick={() => scrollBy(-320)}
        className="hidden sm:flex items-center justify-center size-9 shrink-0 self-center rounded-full bg-black/70 text-white ring-1 ring-white/15 backdrop-blur-sm hover:bg-black/85"
        aria-label="Scroll left"
      >
        <ChevronLeft className="size-4" />
      </button>

      <div
        ref={scrollerRef}
        className="flex-1 flex gap-3 overflow-x-auto scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
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
              ref={isSelected ? selectedRef : undefined}
              href={`/schedule?season=${season}&race=${race.id}`}
              className={cn(
                "shrink-0 w-[220px] rounded-xl p-4 backdrop-blur-sm transition-colors",
                isSelected
                  ? "bg-black/80 ring-2 ring-white/80"
                  : "bg-black/60 ring-1 ring-white/10 hover:bg-black/75"
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-white/70">R{race.round}</span>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                    status === "CURRENT"
                      ? "bg-[#e00700] text-white"
                      : "bg-white/15 text-white/70"
                  )}
                >
                  {status}
                </span>
              </div>
              <div className="mt-2 flex items-center gap-2 text-lg font-semibold text-white">
                {info && <span>{flagEmojiFromISO2(info.countryCode)}</span>}
                <span>{info?.country ?? race.location}</span>
              </div>
              <p className="mt-1 text-xs text-white/50">
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
        className="hidden sm:flex items-center justify-center size-9 shrink-0 self-center rounded-full bg-black/70 text-white ring-1 ring-white/15 backdrop-blur-sm hover:bg-black/85"
        aria-label="Scroll right"
      >
        <ChevronRight className="size-4" />
      </button>
    </div>
  );
}
