"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import NumberFlow from "@number-flow/react";
import { flagEmojiFromISO2 } from "@/lib/format";

type Remaining = { days: number; hours: number; minutes: number; seconds: number };

function getRemaining(target: number): Remaining {
  const totalSeconds = Math.max(0, Math.floor((target - Date.now()) / 1000));
  return {
    days: Math.floor(totalSeconds / 86400),
    hours: Math.floor((totalSeconds % 86400) / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
  };
}

export function NextRaceHero({
  targetIso,
  sessionLabel,
  round,
  country,
  countryCode,
  isLive,
  href,
}: {
  targetIso: string;
  sessionLabel: string;
  round: number | null;
  country: string;
  countryCode: string | null;
  isLive: boolean;
  href: string | null;
}) {
  const target = new Date(targetIso).getTime();
  const [remaining, setRemaining] = useState<Remaining | null>(null);

  useEffect(() => {
    const tick = () => setRemaining(getRemaining(target));
    // Deferred (not called synchronously in the effect body) so the first
    // paint still shows real numbers almost immediately, then the interval
    // keeps them ticking in sync with the wall clock.
    const kickoff = setTimeout(tick, 0);
    const id = setInterval(tick, 1000);
    return () => {
      clearTimeout(kickoff);
      clearInterval(id);
    };
  }, [target]);

  const units: { label: string; value: number }[] = [
    { label: "Days", value: remaining?.days ?? 0 },
    { label: "Hrs", value: remaining?.hours ?? 0 },
    { label: "Mins", value: remaining?.minutes ?? 0 },
    { label: "Sec", value: remaining?.seconds ?? 0 },
  ];

  const body = (
    <div
      className="relative overflow-hidden rounded-2xl p-6 h-full flex flex-col justify-between text-white"
      style={{
        background:
          "linear-gradient(135deg, color-mix(in oklch, var(--primary) 90%, white 10%), color-mix(in oklch, var(--primary) 45%, black 55%))",
      }}
    >
      <div className="flex items-center gap-2 flex-wrap">
        {round !== null && (
          <span className="rounded-full bg-white/15 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide">
            R{round}
          </span>
        )}
        <span className="text-sm font-medium">
          {countryCode ? `${flagEmojiFromISO2(countryCode)} ` : ""}
          {country}: {sessionLabel}
        </span>
        {isLive && (
          <span className="flex items-center gap-1.5 rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
            <span className="relative flex size-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
              <span className="relative inline-flex size-1.5 rounded-full bg-white" />
            </span>
            Live
          </span>
        )}
      </div>

      <div className="mt-6 grid grid-cols-4 gap-3 max-w-xs">
        {units.map((unit) => (
          <div key={unit.label} className="text-center">
            <div className="text-3xl sm:text-4xl font-black font-mono tabular-nums">
              <NumberFlow value={unit.value} format={{ minimumIntegerDigits: 2 }} />
            </div>
            <div className="text-[10px] uppercase tracking-wide text-white/70 mt-1">
              {unit.label}
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  if (!href) return body;

  return (
    <Link href={href} className="block h-full transition-transform hover:scale-[1.01]">
      {body}
    </Link>
  );
}
