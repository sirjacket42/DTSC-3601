import {
  computePointsProgression,
  computeSeasonStats,
  getDriverList,
  getDriverResults,
  getSeasons,
  getStandingsRank,
} from "@/lib/queries";
import { getRaceTelemetry } from "@/lib/openf1";
import { DriverSelector } from "@/components/driver-selector";
import { SeasonTabs } from "@/components/season-tabs";
import { RaceSelector } from "@/components/race-selector";
import { HeroCard } from "@/components/hero-card";
import { StatCard } from "@/components/stat-card";
import { PointsChart } from "@/components/points-chart";
import { ResultsStrip } from "@/components/results-strip";
import { WeatherWidget } from "@/components/weather-widget";
import { TireStrategy } from "@/components/tire-strategy";
import { LapTimesChart } from "@/components/lap-times-chart";
import { CircuitTrace } from "@/components/circuit-trace";
import { DriverRadarChart } from "@/components/driver-radar-chart";
import { TopDownCarPhoto } from "@/components/topdown-car-photo";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatDuration, ordinal } from "@/lib/format";
import { getLivery } from "@/lib/team-livery";

export default async function DriversPage(props: PageProps<"/drivers">) {
  const searchParams = await props.searchParams;
  const driverParam = searchParams.driver;
  const seasonParam = searchParams.season;
  const raceParam = searchParams.race;

  const [driverList, seasons] = await Promise.all([
    getDriverList(),
    getSeasons(),
  ]);

  const defaultDriver =
    driverList.find((d) => d.full_name === "Charles LECLERC") ??
    driverList[0];

  const selectedDriverId = driverParam
    ? Number(driverParam)
    : defaultDriver.id;

  const selectedDriver =
    driverList.find((d) => d.id === selectedDriverId) ?? defaultDriver;

  const allResults = await getDriverResults(selectedDriver.id);
  const driverSeasons = Array.from(
    new Set(allResults.map((r) => r.race.season))
  ).sort((a, b) => b - a);

  const selectedSeason = seasonParam
    ? Number(seasonParam)
    : driverSeasons[0] ?? seasons[0];

  const seasonResults = allResults.filter(
    (r) => r.race.season === selectedSeason
  );

  const stats = computeSeasonStats(seasonResults);
  const progression = computePointsProgression(seasonResults);
  const standing = await getStandingsRank(selectedDriver.id, selectedSeason);

  const latestRace = seasonResults[seasonResults.length - 1];
  const teamColor = latestRace?.constructor_color ?? selectedDriver.team_color;
  const teamName = latestRace?.constructor_name ?? selectedDriver.team_name;
  const livery = getLivery(teamName);

  const selectedRaceId = raceParam ? Number(raceParam) : latestRace?.id;
  const selectedRace =
    seasonResults.find((r) => r.id === selectedRaceId) ?? latestRace;

  const telemetry =
    selectedRace?.race.session_key && selectedRace.driver_number
      ? await getRaceTelemetry(selectedRace.race.session_key, selectedRace.driver_number)
      : null;

  return (
    <div
      className="flex-1 hud-glow"
      style={{ "--team-color": teamColor } as React.CSSProperties}
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
              Driver Spotlight
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Live from Supabase (season results) &amp; OpenF1 (session telemetry)
            </p>
          </div>
          <div className="flex items-center gap-3">
            <DriverSelector drivers={driverList} selectedId={selectedDriver.id} />
          </div>
        </div>

        <HeroCard
          driver={selectedDriver}
          driverNumber={latestRace?.driver_number ?? selectedDriver.driver_number}
          teamName={teamName}
          teamColor={teamColor}
          season={selectedSeason}
          standing={standing}
        />

        {driverSeasons.length > 1 && (
          <SeasonTabs
            seasons={driverSeasons}
            selectedSeason={selectedSeason}
            driverId={selectedDriver.id}
          />
        )}

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="Points" value={stats.points} accent={teamColor} />
          <StatCard label="Wins" value={stats.wins} accent={teamColor} />
          <StatCard label="Races" value={stats.races} accent={teamColor} />
          <StatCard
            label="Avg finish"
            value={stats.avgFinish ? stats.avgFinish.toFixed(1) : "—"}
            accent={teamColor}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            <DriverRadarChart stats={stats} standing={standing} teamColor={teamColor} />
          </div>
          <Card
            className="hud-card"
            style={{ "--team-color": teamColor } as React.CSSProperties}
          >
            <CardHeader>
              <CardTitle className="text-sm uppercase tracking-wide text-muted-foreground">
                {teamName} livery
              </CardTitle>
              <CardDescription className="text-xs">
                {livery.car} &middot; colour-blocked approximation, no sponsor decals
              </CardDescription>
            </CardHeader>
            <CardContent>
              <TopDownCarPhoto
                livery={livery}
                number={latestRace?.driver_number ?? selectedDriver.driver_number}
                className="w-full max-w-[180px] mx-auto"
              />
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <PointsChart data={progression} teamColor={teamColor} />
          <ResultsStrip results={seasonResults} teamColor={teamColor} />
        </div>

        {selectedRace && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <h2 className="text-sm uppercase tracking-wide text-muted-foreground">
                  Race telemetry
                </h2>
                <RaceSelector
                  races={seasonResults}
                  selectedRaceId={selectedRace.id}
                  driverId={selectedDriver.id}
                  season={selectedSeason}
                />
              </div>
              {telemetry?.fastestLap?.lapDuration && (
                <span className="text-xs text-muted-foreground">
                  Fastest lap: {formatDuration(telemetry.fastestLap.lapDuration)} (
                  {ordinal(telemetry.fastestLap.lapNumber)} lap)
                </span>
              )}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <CircuitTrace
                points={telemetry?.trackShape ?? []}
                location={selectedRace.race.location}
                teamColor={teamColor}
                lapDurationSeconds={telemetry?.fastestLap?.lapDuration ?? null}
              />
              <WeatherWidget
                weather={telemetry?.weather ?? null}
                location={selectedRace.race.location}
                teamColor={teamColor}
              />
              <TireStrategy stints={telemetry?.stints ?? []} teamColor={teamColor} />
            </div>
            <LapTimesChart laps={telemetry?.laps ?? []} teamColor={teamColor} />
          </div>
        )}

        <p className="text-center text-xs text-muted-foreground pt-4 pb-8">
          Season results normalized in Supabase from{" "}
          <a
            href="https://openf1.org"
            className="underline underline-offset-2"
            target="_blank"
            rel="noreferrer"
          >
            OpenF1
          </a>{" "}
          · session telemetry fetched live from the OpenF1 API.
        </p>
      </div>
    </div>
  );
}
