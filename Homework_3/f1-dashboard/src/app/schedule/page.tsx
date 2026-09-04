import { findCurrentRace, getSeasonRaces, getSeasons } from "@/lib/queries";
import { getCircuitInfo } from "@/lib/circuits";
import { ScheduleSeasonTabs } from "@/components/schedule-season-tabs";
import { RaceCarousel } from "@/components/race-carousel";
import { RaceMap } from "@/components/race-map-loader";
import { LiveSessionBanner } from "@/components/live-session-banner";
import { Card } from "@/components/ui/card";

export default async function SchedulePage(props: PageProps<"/schedule">) {
  const searchParams = await props.searchParams;
  const seasonParam = searchParams.season;
  const raceParam = searchParams.race;

  const seasons = await getSeasons();
  const selectedSeason = seasonParam ? Number(seasonParam) : seasons[0];

  const races = await getSeasonRaces(selectedSeason);

  const currentRace = findCurrentRace(races);

  const selectedRaceId = raceParam ? Number(raceParam) : currentRace?.id;
  const selectedRace =
    races.find((r) => r.id === selectedRaceId) ?? currentRace;

  const info = selectedRace ? getCircuitInfo(selectedRace.location) : null;

  return (
    <div className="flex-1 hud-glow">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
              Schedule
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Where the {selectedSeason} season is racing
            </p>
          </div>
          <ScheduleSeasonTabs seasons={seasons} selectedSeason={selectedSeason} />
        </div>

        <LiveSessionBanner season={selectedSeason} races={races} />

        <Card className="overflow-hidden p-0">
          <div className="h-[420px] w-full">
            {selectedRace && info ? (
              <RaceMap
                lat={info.lat}
                lng={info.lng}
                label={`Round ${selectedRace.round} · ${info.country}`}
                sublabel={info.circuit}
              />
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                No race data for this season yet.
              </div>
            )}
          </div>
        </Card>

        {selectedRace && info && (
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h2 className="text-2xl font-semibold">
              Round {selectedRace.round} &middot; {info.country}
            </h2>
            <span className="text-sm text-muted-foreground">{info.circuit}</span>
            <span className="text-sm text-muted-foreground">
              &middot;{" "}
              {new Date(selectedRace.date_start).toLocaleDateString(undefined, {
                month: "long",
                day: "numeric",
                year: "numeric",
              })}
            </span>
          </div>
        )}

        {races.length > 0 ? (
          <RaceCarousel
            races={races}
            selectedRaceId={selectedRace?.id ?? races[0].id}
            currentRaceId={currentRace?.id ?? null}
            season={selectedSeason}
          />
        ) : (
          <p className="text-sm text-muted-foreground">
            No races found for {selectedSeason}.
          </p>
        )}
      </div>
    </div>
  );
}
