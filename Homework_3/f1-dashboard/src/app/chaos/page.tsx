import {
  filterStartedRaces,
  findCurrentRace,
  getSeasonRaces,
  getSeasons,
} from "@/lib/queries";
import { getRaceControlMessages } from "@/lib/openf1";
import { getRaceResults } from "@/lib/jolpica";
import { buildChaosPayload, type ChaosBuildResult } from "@/lib/chaos";
import { ScheduleSeasonTabs } from "@/components/schedule-season-tabs";
import { ChaosRaceSelector } from "@/components/chaos-race-selector";
import { RaceChaosPanel } from "@/components/race-chaos-panel";

export default async function ChaosPage(props: PageProps<"/chaos">) {
  const searchParams = await props.searchParams;
  const seasonParam = searchParams.season;
  const raceParam = searchParams.race;

  const seasons = await getSeasons();
  const selectedSeason = seasonParam ? Number(seasonParam) : seasons[0];

  // Only races that have started can have results to score.
  const races = filterStartedRaces(await getSeasonRaces(selectedSeason));

  const currentRace = findCurrentRace(races);
  const selectedRaceId = raceParam ? Number(raceParam) : currentRace?.id;
  const selectedRace = races.find((r) => r.id === selectedRaceId) ?? currentRace;

  // Built server-side from the whole field's Jolpica results plus OpenF1 race
  // control for the same session, mapped onto the Homework 4 chaos-score API's
  // input contract so the client component only has to POST it.
  const chaosBuild: ChaosBuildResult = selectedRace
    ? buildChaosPayload(
        ...(await Promise.all([
          getRaceResults(selectedRace.season, selectedRace.round),
          selectedRace.session_key
            ? getRaceControlMessages(selectedRace.session_key)
            : Promise.resolve(null),
        ]))
      )
    : { ok: false, reason: "No completed races this season yet." };

  return (
    <div className="flex-1 hud-glow">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
              Race Chaos
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              How eventful, and how unusual, each race was compared with 2018 onward
            </p>
          </div>
          <ScheduleSeasonTabs
            seasons={seasons}
            selectedSeason={selectedSeason}
            basePath="/chaos"
          />
        </div>

        {selectedRace ? (
          <div className="space-y-3">
            <ChaosRaceSelector
              races={races}
              selectedRaceId={selectedRace.id}
              season={selectedSeason}
            />
            <RaceChaosPanel raceName={selectedRace.location} build={chaosBuild} />
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            No completed races for {selectedSeason} yet.
          </p>
        )}

        <p className="text-center text-xs text-muted-foreground pt-4 pb-8">
          Results from Jolpica · race control from OpenF1 · scored live by the Race Chaos
          Index API on Modal.
        </p>
      </div>
    </div>
  );
}
