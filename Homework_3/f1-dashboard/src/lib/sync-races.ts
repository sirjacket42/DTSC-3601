import "server-only";
import { getRaceSessionKey } from "@/lib/openf1";
import { getSeasonSchedule } from "@/lib/jolpica";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

type ExistingRace = {
  id: number;
  round: number;
  location: string;
  date_start: string;
  session_key: number | null;
};

export type SyncResult = {
  season: number;
  inserted: number;
  updated: number;
  unchanged: number;
};

/**
 * Pulls the published season schedule (round/location/date, from Jolpica —
 * never blacked out mid-session the way OpenF1's live endpoints are) and
 * upserts it into the `races` table — matched on (season, location) so
 * re-running is idempotent. New rounds get inserted; existing rows get their
 * round/date refreshed in case the calendar changes.
 *
 * session_key (OpenF1's id for the Race session, needed by the telemetry
 * view) is enriched best-effort from OpenF1 by year+location — that lookup
 * can come back null during OpenF1's live-session lockout, in which case the
 * existing value is kept and it's picked up on a later sync.
 */
export async function syncSeasonRaces(season: number): Promise<SyncResult> {
  const admin = getSupabaseAdmin();

  const [schedule, { data: existingRaces, error }] = await Promise.all([
    getSeasonSchedule(season),
    admin
      .from("races")
      .select("id, round, location, date_start, session_key")
      .eq("season", season),
  ]);

  if (error) throw error;

  const existingByLocation = new Map<string, ExistingRace>(
    (existingRaces ?? []).map((r) => [r.location, r])
  );

  let inserted = 0;
  let updated = 0;
  let unchanged = 0;

  for (const race of schedule) {
    const sessionKey = await getRaceSessionKey(season, race.location);
    const existing = existingByLocation.get(race.location);

    if (!existing) {
      const { error: insertError } = await admin.from("races").insert({
        season,
        round: race.round,
        location: race.location,
        date_start: race.weekendStart,
        session_key: sessionKey,
      });
      if (insertError) throw insertError;
      inserted++;
      continue;
    }

    const needsUpdate =
      existing.round !== race.round ||
      existing.date_start !== race.weekendStart ||
      (sessionKey !== null && existing.session_key !== sessionKey);

    if (needsUpdate) {
      const { error: updateError } = await admin
        .from("races")
        .update({
          round: race.round,
          date_start: race.weekendStart,
          session_key: sessionKey ?? existing.session_key,
        })
        .eq("id", existing.id);
      if (updateError) throw updateError;
      updated++;
    } else {
      unchanged++;
    }
  }

  return { season, inserted, updated, unchanged };
}
