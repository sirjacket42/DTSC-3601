import { supabase } from "@/lib/supabase";
import type {
  DriverListItem,
  PointsProgressionPoint,
  Race,
  ResultRow,
  SeasonStats,
  StandingsRank,
} from "@/lib/types";

type ResultDetailsRow = {
  id: number;
  position: number | null;
  points: number;
  sprint_points: number;
  total_points: number;
  number_of_laps: number | null;
  gap_to_leader: string | null;
  duration: number | null;
  dnf: boolean;
  dns: boolean;
  dsq: boolean;
  driver_number: number | null;
  driver_id: number;
  driver_name: string;
  constructor_id: number;
  constructor_name: string;
  constructor_color: string;
  race_id: number;
  season: number;
  round: number;
  location: string;
  date_start: string;
  session_key: number | null;
};

function toResultRow(r: ResultDetailsRow): ResultRow {
  return {
    id: r.id,
    position: r.position,
    points: r.total_points,
    number_of_laps: r.number_of_laps,
    gap_to_leader: r.gap_to_leader,
    duration: r.duration,
    dnf: r.dnf,
    dns: r.dns,
    dsq: r.dsq,
    driver_number: r.driver_number,
    constructor_name: r.constructor_name,
    constructor_color: r.constructor_color,
    race: {
      id: r.race_id,
      season: r.season,
      round: r.round,
      location: r.location,
      date_start: r.date_start,
      session_key: r.session_key,
    },
  };
}

export async function getDriverList(): Promise<DriverListItem[]> {
  const { data, error } = await supabase
    .from("driver_summary")
    .select("*")
    .order("career_points", { ascending: false });

  if (error) throw error;

  return (data ?? []).map((d) => ({
    id: d.driver_id,
    full_name: d.full_name,
    name_acronym: d.name_acronym,
    headshot_url: d.headshot_url,
    country_code: d.country_code,
    team_name: d.latest_team ?? "Unknown",
    team_color: d.latest_team_color ?? "#888888",
    driver_number: d.latest_driver_number,
    career_points: Number(d.career_points ?? 0),
  }));
}

export async function getSeasons(): Promise<number[]> {
  const { data, error } = await supabase
    .from("races")
    .select("season")
    .order("season", { ascending: false });
  if (error) throw error;
  return Array.from(new Set((data ?? []).map((r) => r.season)));
}

export async function getSeasonRaces(season: number): Promise<Race[]> {
  const { data, error } = await supabase
    .from("races")
    .select("id, season, round, location, date_start, session_key")
    .eq("season", season)
    .order("round", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

/** The most recently contested race in the list (falls back to the earliest if none have happened yet). */
export function findCurrentRace(races: Race[]): Race | null {
  const byDate = [...races].sort(
    (a, b) => new Date(a.date_start).getTime() - new Date(b.date_start).getTime()
  );
  const now = Date.now();
  const pastRaces = byDate.filter((r) => new Date(r.date_start).getTime() <= now);
  return pastRaces[pastRaces.length - 1] ?? byDate[0] ?? null;
}

/** The next race still to come (falls back to the season's last race once it's over). */
export function findNextRace(races: Race[]): Race | null {
  const byDate = [...races].sort(
    (a, b) => new Date(a.date_start).getTime() - new Date(b.date_start).getTime()
  );
  const now = Date.now();
  return byDate.find((r) => new Date(r.date_start).getTime() > now) ?? byDate[byDate.length - 1] ?? null;
}

/** How many races in the list have already happened. */
export function countCompletedRaces(races: Race[]): number {
  const now = Date.now();
  return races.filter((r) => new Date(r.date_start).getTime() <= now).length;
}

export async function getDriverResults(
  driverId: number,
  season?: number
): Promise<ResultRow[]> {
  let query = supabase
    .from("result_details")
    .select("*")
    .eq("driver_id", driverId)
    .order("season", { ascending: true })
    .order("round", { ascending: true });

  if (season) query = query.eq("season", season);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map(toResultRow);
}

export function computeSeasonStats(results: ResultRow[]): SeasonStats {
  const finished = results.filter((r) => !r.dns && !r.dsq);
  const positions = finished
    .map((r) => r.position)
    .filter((p): p is number => p !== null);

  return {
    points: results.reduce((sum, r) => sum + Number(r.points), 0),
    wins: results.filter((r) => r.position === 1).length,
    podiums: results.filter((r) => r.position !== null && r.position <= 3)
      .length,
    races: results.length,
    avgFinish: positions.length
      ? positions.reduce((a, b) => a + b, 0) / positions.length
      : null,
    dnfs: results.filter((r) => r.dnf).length,
    bestFinish: positions.length ? Math.min(...positions) : null,
  };
}

export function computePointsProgression(
  results: ResultRow[]
): PointsProgressionPoint[] {
  let cumulative = 0;
  return results.map((r) => {
    cumulative += Number(r.points);
    return {
      round: r.race.round,
      location: r.race.location,
      racePoints: Number(r.points),
      cumulativePoints: cumulative,
    };
  });
}

export type SeasonStandingRow = {
  driverId: number;
  driverName: string;
  driverNumber: number | null;
  teamName: string;
  teamColor: string;
  points: number;
};

/** Season driver standings, aggregated from race results (latest team wins on a mid-season swap). */
export async function getSeasonStandings(season: number): Promise<SeasonStandingRow[]> {
  const { data, error } = await supabase
    .from("result_details")
    .select("driver_id, driver_name, driver_number, constructor_name, constructor_color, total_points")
    .eq("season", season)
    .order("round", { ascending: true });
  if (error) throw error;

  const byDriver = new Map<number, SeasonStandingRow>();
  for (const row of data ?? []) {
    const prevPoints = byDriver.get(row.driver_id)?.points ?? 0;
    byDriver.set(row.driver_id, {
      driverId: row.driver_id,
      driverName: row.driver_name,
      driverNumber: row.driver_number,
      teamName: row.constructor_name,
      teamColor: row.constructor_color,
      points: prevPoints + Number(row.total_points),
    });
  }
  return Array.from(byDriver.values()).sort((a, b) => b.points - a.points);
}

export type ConstructorStandingRow = {
  teamName: string;
  teamColor: string;
  points: number;
};

/** Season constructor standings, aggregated from race results. */
export async function getConstructorStandings(season: number): Promise<ConstructorStandingRow[]> {
  const { data, error } = await supabase
    .from("result_details")
    .select("constructor_name, constructor_color, total_points")
    .eq("season", season);
  if (error) throw error;

  const byTeam = new Map<string, ConstructorStandingRow>();
  for (const row of data ?? []) {
    const existing = byTeam.get(row.constructor_name);
    if (existing) {
      existing.points += Number(row.total_points);
    } else {
      byTeam.set(row.constructor_name, {
        teamName: row.constructor_name,
        teamColor: row.constructor_color,
        points: Number(row.total_points),
      });
    }
  }
  return Array.from(byTeam.values()).sort((a, b) => b.points - a.points);
}

export async function getStandingsRank(
  driverId: number,
  season: number
): Promise<StandingsRank | null> {
  const { data, error } = await supabase
    .from("result_details")
    .select("driver_id, total_points")
    .eq("season", season);
  if (error) throw error;

  const totals = new Map<number, number>();
  for (const row of data ?? []) {
    totals.set(row.driver_id, (totals.get(row.driver_id) ?? 0) + Number(row.total_points));
  }
  const ranked = Array.from(totals.entries()).sort((a, b) => b[1] - a[1]);
  const idx = ranked.findIndex(([id]) => id === driverId);
  if (idx === -1) return null;
  return { rank: idx + 1, total: ranked.length };
}
