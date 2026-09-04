import Link from "next/link";
import { Users, MapPin } from "lucide-react";
import {
  getSeasons,
  getSeasonRaces,
  findNextRace,
  countCompletedRaces,
  getSeasonStandings,
  getConstructorStandings,
} from "@/lib/queries";
import { getCurrentSessionStatus } from "@/lib/jolpica";
import { getCircuitInfo } from "@/lib/circuits";
import { flagEmojiFromISO2 } from "@/lib/format";
import { NextRaceHero } from "@/components/next-race-hero";
import { CircuitOutline } from "@/components/circuit-outline";
import { StatCard } from "@/components/stat-card";
import { StandingsTable } from "@/components/standings-table";
import { NavBannerCard } from "@/components/nav-banner-card";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function Home() {
  const seasons = await getSeasons();
  const season = seasons[0];

  const [races, standings, constructors, sessionStatus] = await Promise.all([
    getSeasonRaces(season),
    getSeasonStandings(season),
    getConstructorStandings(season),
    getCurrentSessionStatus(season),
  ]);

  const nextRace = findNextRace(races);
  const completedCount = countCompletedRaces(races);
  const seasonProgress = races.length
    ? Math.round((completedCount / races.length) * 100)
    : 0;

  const leader = standings[0];

  const heroInfo =
    sessionStatus.status !== "none"
      ? {
          location: sessionStatus.session.location,
          sessionName: sessionStatus.session.session_name,
          dateStart: sessionStatus.session.date_start,
          isLive: sessionStatus.status === "live",
        }
      : null;

  const heroRace = heroInfo
    ? races.find((r) => r.location === heroInfo.location) ?? null
    : null;
  const heroCircuit = heroInfo ? getCircuitInfo(heroInfo.location) : null;
  const scheduleCircuit = nextRace ? getCircuitInfo(nextRace.location) : null;

  const linkClass = "block h-full transition-transform hover:scale-[1.01]";

  return (
    <div className="flex-1 hud-glow">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
              Home
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Season overview &mdash; backed by Supabase &amp; Jolpica
            </p>
          </div>
          <div className="rounded-full border border-border bg-card px-4 py-1.5 text-sm font-medium">
            Season <span className="font-mono">{season}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {heroInfo ? (
            <NextRaceHero
              targetIso={heroInfo.dateStart}
              sessionLabel={heroInfo.sessionName}
              round={heroRace?.round ?? null}
              country={heroCircuit?.country ?? heroInfo.location}
              countryCode={heroCircuit?.countryCode ?? null}
              isLive={heroInfo.isLive}
              href={heroRace ? `/schedule?season=${season}&race=${heroRace.id}` : null}
            />
          ) : (
            <Card className="hud-card h-full justify-center">
              <CardContent className="text-center py-8">
                <p className="text-sm text-muted-foreground">
                  No upcoming sessions scheduled.
                </p>
              </CardContent>
            </Card>
          )}

          <Link
            href={nextRace ? `/schedule?season=${season}&race=${nextRace.id}` : "/schedule"}
            className={linkClass}
          >
            <Card className="hud-card h-full">
              <CardHeader>
                <CardTitle className="text-sm uppercase tracking-wide text-muted-foreground">
                  {season} Schedule
                </CardTitle>
                <CardDescription className="text-xs">
                  {completedCount} of {races.length} races complete &middot; {seasonProgress}%
                </CardDescription>
              </CardHeader>
              <CardContent className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-lg font-semibold flex items-center gap-2">
                    {scheduleCircuit && <span>{flagEmojiFromISO2(scheduleCircuit.countryCode)}</span>}
                    <span>{scheduleCircuit?.country ?? nextRace?.location ?? "—"}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Next up</p>
                </div>
                {nextRace && (
                  <CircuitOutline
                    location={nextRace.location}
                    className="w-24 h-16 text-muted-foreground/60 shrink-0"
                  />
                )}
              </CardContent>
            </Card>
          </Link>

          <Link
            href={leader ? `/drivers?driver=${leader.driverId}&season=${season}` : "/drivers"}
            className={linkClass}
          >
            <Card
              className="hud-card h-full"
              style={leader ? ({ "--team-color": leader.teamColor } as React.CSSProperties) : undefined}
            >
              <CardHeader>
                <CardTitle className="text-sm uppercase tracking-wide text-muted-foreground">
                  Championship Leader
                </CardTitle>
              </CardHeader>
              <CardContent>
                {leader ? (
                  <>
                    <div className="text-xl font-bold">{leader.driverName}</div>
                    <p className="text-xs text-muted-foreground mt-0.5">{leader.teamName}</p>
                    <div
                      className="mt-3 text-3xl font-black font-mono tabular-nums"
                      style={{ color: leader.teamColor }}
                    >
                      {leader.points}{" "}
                      <span className="text-sm font-normal text-muted-foreground">pts</span>
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">No standings yet.</p>
                )}
              </CardContent>
            </Card>
          </Link>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="Races this season" value={races.length} />
          <StatCard label="Seasons tracked" value={seasons.length} />
          <StatCard label="Drivers scored" value={standings.length} />
          <StatCard label="Constructors scored" value={constructors.length} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <NavBannerCard
            href="/drivers"
            icon={Users}
            eyebrow="Driver Spotlight"
            title="Dig into a driver's season"
            description="Points progression, lap times, tire strategy and live telemetry for every race."
            variant="violet"
          />
          <NavBannerCard
            href="/schedule"
            icon={MapPin}
            eyebrow="Race Calendar"
            title="See where the season is racing"
            description="Full circuit map, live session status and the complete race carousel."
            variant="primary"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <StandingsTable
            title={`${season} Driver Standings`}
            rows={standings.slice(0, 8).map((s, i) => ({
              key: s.driverId,
              pos: i + 1,
              name: s.driverName,
              sub: s.teamName,
              teamName: s.teamName,
              color: s.teamColor,
              points: s.points,
              href: `/drivers?driver=${s.driverId}&season=${season}`,
            }))}
          />
          <StandingsTable
            title={`${season} Constructor Standings`}
            rows={constructors.slice(0, 8).map((c, i) => ({
              key: c.teamName,
              pos: i + 1,
              name: c.teamName,
              teamName: c.teamName,
              color: c.teamColor,
              points: c.points,
            }))}
          />
        </div>

        <p className="text-center text-xs text-muted-foreground pt-4 pb-8">
          Season standings normalized in Supabase from{" "}
          <a
            href="https://openf1.org"
            className="underline underline-offset-2"
            target="_blank"
            rel="noreferrer"
          >
            OpenF1
          </a>{" "}
          &middot; schedule sourced from{" "}
          <a
            href="https://api.jolpi.ca/ergast/"
            className="underline underline-offset-2"
            target="_blank"
            rel="noreferrer"
          >
            Jolpica
          </a>
          .
        </p>
      </div>
    </div>
  );
}
