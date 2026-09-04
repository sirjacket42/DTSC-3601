import { findCurrentRace, getSeasonRaces, getSeasons } from "@/lib/queries";
import { getCircuitInfo } from "@/lib/circuits";
import { getCircuitTrack } from "@/lib/circuit-tracks";
import { ScheduleSeasonTabs } from "@/components/schedule-season-tabs";
import { RaceCarousel } from "@/components/race-carousel";
import { RaceMap } from "@/components/race-map-loader";
import { LiveSessionBanner } from "@/components/live-session-banner";

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
  const track = selectedRace ? getCircuitTrack(selectedRace.location) : null;

  return (
    <div className="flex-1 flex flex-col h-dvh hud-glow">
      <div className="shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 sm:px-6 py-4 border-b border-border">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
            Schedule
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Where the {selectedSeason} season is racing
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <LiveSessionBanner season={selectedSeason} races={races} />
          <ScheduleSeasonTabs seasons={seasons} selectedSeason={selectedSeason} />
        </div>
      </div>

      <div className="relative flex-1 min-h-0 w-full">
        {selectedRace && info ? (
          <RaceMap lat={info.lat} lng={info.lng} track={track} />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            No race data for this season yet.
          </div>
        )}

        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-56 bg-gradient-to-t from-black/70 to-transparent" />

        {races.length > 0 && selectedRace ? (
          <div className="absolute inset-x-0 bottom-0 px-4 sm:px-6 pb-4 sm:pb-6">
            <RaceCarousel
              races={races}
              selectedRaceId={selectedRace.id}
              currentRaceId={currentRace?.id ?? null}
              season={selectedSeason}
            />
          </div>
        ) : (
          races.length === 0 && (
            <div className="absolute inset-x-0 bottom-0 px-4 sm:px-6 pb-4 sm:pb-6">
              <p className="text-sm text-white/70">
                No races found for {selectedSeason}.
              </p>
            </div>
          )
        )}
      </div>
    </div>
  );
}
