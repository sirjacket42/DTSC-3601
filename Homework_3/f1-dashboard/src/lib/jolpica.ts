import "server-only";

const BASE = "https://api.jolpi.ca/ergast/f1";
// Jolpica asks callers to identify themselves via User-Agent instead of an API key.
const USER_AGENT = "f1-dashboard (github.com/sirjacket42/DTSC-3601)";
const REVALIDATE_SECONDS = 60 * 30;

type JolpicaTime = { date: string; time?: string };

type JolpicaRace = {
  round: string;
  raceName: string;
  Circuit: {
    circuitId: string;
    circuitName: string;
    Location: { locality: string; country: string };
  };
  date: string;
  time?: string;
  FirstPractice?: JolpicaTime;
  SecondPractice?: JolpicaTime;
  ThirdPractice?: JolpicaTime;
  SprintQualifying?: JolpicaTime;
  Sprint?: JolpicaTime;
  Qualifying?: JolpicaTime;
};

type JolpicaResponse = {
  MRData: { RaceTable: { Races: JolpicaRace[] } };
};

async function fetchSeason(year: number): Promise<JolpicaRace[]> {
  try {
    const res = await fetch(`${BASE}/${year}.json`, {
      headers: { "User-Agent": USER_AGENT },
      next: { revalidate: REVALIDATE_SECONDS },
    });
    if (!res.ok) return [];
    const data = (await res.json()) as JolpicaResponse;
    return data.MRData.RaceTable.Races;
  } catch {
    return [];
  }
}

export type SeasonRace = {
  round: number;
  location: string;
  /** ISO timestamp of the weekend's first scheduled session. */
  weekendStart: string;
};

export type ScheduledSession = {
  location: string;
  session_name: string;
  date_start: string;
};

// Rough expected length of each session (padded a bit past the nominal duration
// for red flags/overruns), used only to decide whether "now" falls inside one —
// the published schedule has no explicit end time like OpenF1 does.
const SESSION_DURATION_MINUTES: Record<string, number> = {
  "Practice 1": 75,
  "Practice 2": 75,
  "Practice 3": 75,
  "Sprint Qualifying": 60,
  Sprint: 50,
  Qualifying: 80,
  Race: 150,
};

function toIso(t: JolpicaTime | undefined): string | null {
  if (!t) return null;
  return `${t.date}T${t.time ?? "00:00:00Z"}`;
}

function raceToSessions(race: JolpicaRace): ScheduledSession[] {
  const location = race.Circuit.Location.locality;
  const entries: [string, JolpicaTime | undefined][] = [
    ["Practice 1", race.FirstPractice],
    ["Practice 2", race.SecondPractice],
    ["Practice 3", race.ThirdPractice],
    ["Sprint Qualifying", race.SprintQualifying],
    ["Sprint", race.Sprint],
    ["Qualifying", race.Qualifying],
    ["Race", { date: race.date, time: race.time }],
  ];
  return entries
    .map(([session_name, t]) => {
      const date_start = toIso(t);
      return date_start ? { location, session_name, date_start } : null;
    })
    .filter((s): s is ScheduledSession => s !== null);
}

/** Every points-scoring race weekend for a season, in round order. */
export async function getSeasonSchedule(year: number): Promise<SeasonRace[]> {
  const races = await fetchSeason(year);
  return races
    .map((r) => {
      const sessions = raceToSessions(r);
      const weekendStart = sessions[0]?.date_start ?? `${r.date}T${r.time ?? "00:00:00Z"}`;
      return {
        round: Number(r.round),
        location: r.Circuit.Location.locality,
        weekendStart,
      };
    })
    .sort((a, b) => a.round - b.round);
}

export type CurrentSessionStatus =
  | { status: "live"; session: ScheduledSession }
  | { status: "upcoming"; session: ScheduledSession }
  | { status: "none" };

/**
 * What's happening right now, computed entirely from the published schedule.
 * Unlike OpenF1's live endpoints, this never goes dark mid-session — Jolpica
 * only serves the calendar, which is public well before any lights go out.
 */
export async function getCurrentSessionStatus(year: number): Promise<CurrentSessionStatus> {
  const races = await fetchSeason(year);
  const sessions = races.flatMap(raceToSessions);
  const now = Date.now();

  const live = sessions.find((s) => {
    const start = new Date(s.date_start).getTime();
    const duration = SESSION_DURATION_MINUTES[s.session_name] ?? 60;
    return now >= start && now <= start + duration * 60_000;
  });
  if (live) return { status: "live", session: live };

  const upcoming = sessions
    .filter((s) => new Date(s.date_start).getTime() > now)
    .sort((a, b) => new Date(a.date_start).getTime() - new Date(b.date_start).getTime())[0];

  return upcoming ? { status: "upcoming", session: upcoming } : { status: "none" };
}
