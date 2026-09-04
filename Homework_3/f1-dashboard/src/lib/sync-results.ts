import "server-only";
import { getRaceResults, getSprintResults, type RaceResultEntry } from "@/lib/jolpica";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

type ExistingRace = { id: number; round: number };

type DriverRow = { id: number; full_name: string };
type ConstructorRow = { id: number; name: string; color: string };

export type ResultsSyncResult = {
  season: number;
  roundsSynced: number;
  roundsSkipped: number;
  rowsWritten: number;
};

function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase();
}

/** Our `drivers`/`constructors` tables are keyed by OpenF1-style names ("Kimi ANTONELLI",
 * "Red Bull Racing"), not Jolpica's ("Andrea Kimi" / "Antonelli", "Red Bull") — so identity
 * is matched by normalized surname / team-name overlap rather than exact string equality. */
function findDriverId(drivers: DriverRow[], familyName: string): number | null {
  const target = normalize(familyName);
  const match = drivers.find((d) => normalize(d.full_name).split(" ").includes(target));
  return match?.id ?? null;
}

function findConstructorId(constructors: ConstructorRow[], jolpicaName: string): number | null {
  const strip = (s: string) => normalize(s).replace(/F1 TEAM/g, "").replace(/[^A-Z]/g, "");
  const target = strip(jolpicaName);
  const match = constructors.find((c) => {
    const ours = strip(c.name);
    return ours.includes(target) || target.includes(ours);
  });
  return match?.id ?? null;
}

/** Ergast marks a classified-but-lapped finisher with the literal status "Lapped" (the
 * lap deficit itself isn't in the status text — it has to be derived from the leader's
 * lap count); a small set of fixed strings mark DNS/DSQ; anything else free-text
 * ("Retired", "Engine", "Accident", "Collision", ...) is a retirement. */
function classifyStatus(status: string): { dnf: boolean; dns: boolean; dsq: boolean } {
  if (status === "Did not start" || status === "Did not qualify") {
    return { dnf: false, dns: true, dsq: false };
  }
  if (status === "Disqualified") return { dnf: false, dns: false, dsq: true };
  if (status === "Finished" || status === "Lapped") {
    return { dnf: false, dns: false, dsq: false };
  }
  return { dnf: true, dns: false, dsq: false };
}

function parseDurationSeconds(time: string): number | null {
  const parts = time.split(":").map(Number);
  if (parts.some((p) => Number.isNaN(p))) return null;
  return parts.reduce((acc, p) => acc * 60 + p, 0);
}

type ComputedRaceFields = {
  position: number | null;
  gap_to_leader: string | null;
  duration: number | null;
  dnf: boolean;
  dns: boolean;
  dsq: boolean;
};

/** Mirrors the original OpenF1-sourced convention: only classified, non-retired
 * finishers carry a position/duration; lapped-but-classified cars get "+N LAP(S)". */
function computeRaceFields(
  entry: RaceResultEntry,
  leaderDurationSeconds: number | null,
  leaderLaps: number | null
): ComputedRaceFields {
  const { dnf, dns, dsq } = classifyStatus(entry.status);
  if (dnf || dns || dsq) {
    return { position: null, gap_to_leader: null, duration: null, dnf, dns, dsq };
  }

  if (entry.status === "Lapped") {
    const behind = leaderLaps !== null ? leaderLaps - entry.laps : null;
    return {
      position: entry.position,
      gap_to_leader: behind !== null && behind > 0 ? `+${behind} LAP${behind > 1 ? "S" : ""}` : null,
      duration: null,
      dnf: false,
      dns: false,
      dsq: false,
    };
  }

  if (entry.position === 1 && entry.time) {
    const duration = parseDurationSeconds(entry.time);
    return { position: 1, gap_to_leader: "0", duration, dnf: false, dns: false, dsq: false };
  }

  if (entry.time?.startsWith("+")) {
    const gapSeconds = Number(entry.time.slice(1));
    const duration =
      leaderDurationSeconds !== null && !Number.isNaN(gapSeconds)
        ? Math.round((leaderDurationSeconds + gapSeconds) * 1000) / 1000
        : null;
    return {
      position: entry.position,
      gap_to_leader: Number.isNaN(gapSeconds) ? null : String(gapSeconds),
      duration,
      dnf: false,
      dns: false,
      dsq: false,
    };
  }

  return { position: entry.position, gap_to_leader: null, duration: null, dnf: false, dns: false, dsq: false };
}

/**
 * Pulls a season's actual race + sprint results from Jolpica and upserts them into
 * `results` — the table the driver/constructor standings are summed from. Unlike
 * `syncSeasonRaces` (which only keeps the *schedule* fresh), nothing else in this app
 * ever wrote a new race's results after the initial historical migration, so standings
 * silently stopped updating the moment that migration was done. This closes that gap,
 * and is what should run after every completed race weekend (including sprints, which
 * award their own points that a `results` row must carry separately in `sprint_points`).
 *
 * Idempotent — matched on the `results_race_driver_unique` (race_id, driver_id)
 * constraint, so re-running (e.g. the periodic cron) just re-affirms unchanged rounds.
 * A round with no published results yet (race hasn't happened) is skipped, not errored.
 */
export async function syncSeasonResults(season: number): Promise<ResultsSyncResult> {
  const admin = getSupabaseAdmin();

  const [{ data: races, error: racesError }, { data: drivers, error: driversError }, { data: constructors, error: constructorsError }] =
    await Promise.all([
      admin.from("races").select("id, round").eq("season", season).order("round", { ascending: true }),
      admin.from("drivers").select("id, full_name"),
      admin.from("constructors").select("id, name, color"),
    ]);

  if (racesError) throw racesError;
  if (driversError) throw driversError;
  if (constructorsError) throw constructorsError;

  const driverRows = [...(drivers ?? [])] as DriverRow[];
  const constructorRows = [...(constructors ?? [])] as ConstructorRow[];

  let roundsSynced = 0;
  let roundsSkipped = 0;
  let rowsWritten = 0;

  for (const race of (races ?? []) as ExistingRace[]) {
    const [raceResults, sprintResults] = await Promise.all([
      getRaceResults(season, race.round),
      getSprintResults(season, race.round),
    ]);

    if (raceResults.length === 0) {
      roundsSkipped++;
      continue;
    }

    const sprintByNumber = new Map(sprintResults.map((s) => [s.driverNumber, s.points]));
    const leader = raceResults.find((r) => r.position === 1);
    const leaderDuration = leader?.time ? parseDurationSeconds(leader.time) : null;
    const leaderLaps = leader?.laps ?? null;

    const rows: Record<string, unknown>[] = [];

    for (const entry of raceResults) {
      let driverId = findDriverId(driverRows, entry.driverFamilyName);
      if (driverId === null) {
        const fullName = `${entry.driverGivenName.split(" ").pop()} ${entry.driverFamilyName.toUpperCase()}`;
        const { data: inserted, error } = await admin
          .from("drivers")
          .insert({ full_name: fullName })
          .select("id, full_name")
          .single();
        if (error) throw error;
        driverRows.push(inserted as DriverRow);
        driverId = inserted.id;
      }

      let constructorId = findConstructorId(constructorRows, entry.constructorName);
      if (constructorId === null) {
        const { data: inserted, error } = await admin
          .from("constructors")
          .insert({ name: entry.constructorName, color: "#888888" })
          .select("id, name, color")
          .single();
        if (error) throw error;
        constructorRows.push(inserted as ConstructorRow);
        constructorId = inserted.id;
      }

      const fields = computeRaceFields(entry, leaderDuration, leaderLaps);

      rows.push({
        race_id: race.id,
        driver_id: driverId,
        constructor_id: constructorId,
        driver_number: entry.driverNumber,
        points: entry.points,
        sprint_points: sprintByNumber.get(entry.driverNumber) ?? 0,
        number_of_laps: entry.laps,
        ...fields,
      });
    }

    // A driver who scored sprint points but didn't start the main race (rare) still
    // needs their sprint points recorded somewhere.
    for (const sprintEntry of sprintResults) {
      const alreadyIncluded = raceResults.some((r) => r.driverNumber === sprintEntry.driverNumber);
      if (alreadyIncluded) continue;

      const driverId = findDriverId(driverRows, sprintEntry.driverFamilyName);
      if (driverId === null) continue;
      const constructorId = findConstructorId(constructorRows, sprintEntry.constructorName);
      if (constructorId === null) continue;

      rows.push({
        race_id: race.id,
        driver_id: driverId,
        constructor_id: constructorId,
        driver_number: sprintEntry.driverNumber,
        points: 0,
        sprint_points: sprintEntry.points,
        number_of_laps: null,
        position: null,
        gap_to_leader: null,
        duration: null,
        dnf: false,
        dns: true,
        dsq: false,
      });
    }

    const { error: upsertError } = await admin
      .from("results")
      .upsert(rows, { onConflict: "race_id,driver_id" });
    if (upsertError) throw upsertError;

    roundsSynced++;
    rowsWritten += rows.length;
  }

  return { season, roundsSynced, roundsSkipped, rowsWritten };
}
