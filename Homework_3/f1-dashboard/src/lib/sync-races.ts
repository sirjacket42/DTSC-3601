import "server-only";
import { getRaceSessionKey, getSeasonMeetings } from "@/lib/openf1";
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
 * Pulls every meeting (race weekend) OpenF1 has for `season`, computes each
 * one's round number from its position in the season's date order, and
 * upserts it into the `races` table — matched on (season, location) so
 * re-running is idempotent. New rounds (like a weekend that just got
 * announced or just started) get inserted; existing rows get their round/
 * date/session_key refreshed in case OpenF1 revises anything.
 */
export async function syncSeasonRaces(season: number): Promise<SyncResult> {
  const admin = getSupabaseAdmin();

  const [meetings, { data: existingRaces, error }] = await Promise.all([
    getSeasonMeetings(season),
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

  for (let i = 0; i < meetings.length; i++) {
    const meeting = meetings[i];
    const round = i + 1;
    const sessionKey = await getRaceSessionKey(meeting.meeting_key);
    const existing = existingByLocation.get(meeting.location);

    if (!existing) {
      const { error: insertError } = await admin.from("races").insert({
        season,
        round,
        location: meeting.location,
        date_start: meeting.date_start,
        session_key: sessionKey,
      });
      if (insertError) throw insertError;
      inserted++;
      continue;
    }

    const needsUpdate =
      existing.round !== round ||
      existing.date_start !== meeting.date_start ||
      (sessionKey !== null && existing.session_key !== sessionKey);

    if (needsUpdate) {
      const { error: updateError } = await admin
        .from("races")
        .update({
          round,
          date_start: meeting.date_start,
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
