import Image from "next/image";
import { flagEmoji } from "@/lib/format";
import type { DriverListItem, StandingsRank } from "@/lib/types";

export function HeroCard({
  driver,
  driverNumber,
  teamName,
  teamColor,
  season,
  standing,
}: {
  driver: DriverListItem;
  driverNumber: number | null;
  teamName: string;
  teamColor: string;
  season: number;
  standing: StandingsRank | null;
}) {
  return (
    <div
      className="hud-card hud-glow relative overflow-hidden rounded-2xl p-6 sm:p-8"
      style={{ "--team-color": teamColor } as React.CSSProperties}
    >
      <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-end gap-6">
        <div className="relative shrink-0">
          <div
            className="absolute inset-0 rounded-full blur-2xl opacity-40"
            style={{ background: teamColor }}
          />
          {driver.headshot_url ? (
            <Image
              src={driver.headshot_url}
              alt={driver.full_name}
              width={140}
              height={140}
              priority
              className="relative rounded-full object-cover size-[120px] sm:size-[140px] border-2"
              style={{ borderColor: teamColor }}
              unoptimized
            />
          ) : (
            <div
              className="relative rounded-full size-[120px] sm:size-[140px] border-2 flex items-center justify-center text-3xl font-bold"
              style={{ borderColor: teamColor, background: "var(--card)" }}
            >
              {driver.name_acronym ?? driver.full_name.slice(0, 3)}
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <span
              className="text-5xl sm:text-6xl font-black font-mono tabular-nums leading-none"
              style={{ color: teamColor }}
            >
              {driverNumber ?? "—"}
            </span>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold leading-tight flex items-center gap-2">
                {driver.full_name}
                <span className="text-xl">{flagEmoji(driver.country_code)}</span>
              </h1>
              <p className="text-muted-foreground text-sm font-medium tracking-wide uppercase">
                {teamName} &middot; {season} season
              </p>
            </div>
          </div>
        </div>

        {standing && (
          <div
            className="rounded-xl px-4 py-3 text-center border shrink-0"
            style={{ borderColor: teamColor }}
          >
            <div className="text-xs uppercase text-muted-foreground tracking-wide">
              Championship
            </div>
            <div
              className="text-3xl font-black font-mono tabular-nums"
              style={{ color: teamColor }}
            >
              P{standing.rank}
            </div>
            <div className="text-xs text-muted-foreground">
              of {standing.total} drivers
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
