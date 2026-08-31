import type { LapPoint, RaceTelemetry, Stint, TrackPoint, Weather } from "@/lib/types";

const BASE = "https://api.openf1.org/v1";
const REVALIDATE_SECONDS = 60 * 60 * 12;

async function fetchJson<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${BASE}${path}`, {
      next: { revalidate: REVALIDATE_SECONDS },
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

type WeatherSample = {
  air_temperature: number;
  track_temperature: number;
  humidity: number;
  wind_speed: number;
  rainfall: number;
};

type StintApi = {
  stint_number: number;
  compound: string;
  lap_start: number;
  lap_end: number;
  tyre_age_at_start: number;
};

type LapApi = {
  lap_number: number;
  lap_duration: number | null;
  is_pit_out_lap: boolean;
  date_start: string | null;
};

type LocationApi = { x: number; y: number };

async function getWeather(sessionKey: number): Promise<Weather | null> {
  const samples = await fetchJson<WeatherSample[]>(
    `/weather?session_key=${sessionKey}`
  );
  if (!samples || samples.length === 0) return null;

  const avg = (key: keyof WeatherSample) =>
    samples.reduce((sum, s) => sum + Number(s[key] ?? 0), 0) / samples.length;

  return {
    airTemp: Math.round(avg("air_temperature") * 10) / 10,
    trackTemp: Math.round(avg("track_temperature") * 10) / 10,
    humidity: Math.round(avg("humidity")),
    windSpeed: Math.round(avg("wind_speed") * 10) / 10,
    rainfall: samples.some((s) => Number(s.rainfall) > 0),
  };
}

async function getStints(
  sessionKey: number,
  driverNumber: number
): Promise<Stint[]> {
  const data = await fetchJson<StintApi[]>(
    `/stints?session_key=${sessionKey}&driver_number=${driverNumber}`
  );
  if (!data) return [];
  return data
    .sort((a, b) => a.stint_number - b.stint_number)
    .map((s) => ({
      stintNumber: s.stint_number,
      compound: s.compound,
      lapStart: s.lap_start,
      lapEnd: s.lap_end,
      tyreAgeAtStart: s.tyre_age_at_start,
    }));
}

async function getLaps(
  sessionKey: number,
  driverNumber: number
): Promise<{ laps: LapPoint[]; raw: LapApi[] }> {
  const data = await fetchJson<LapApi[]>(
    `/laps?session_key=${sessionKey}&driver_number=${driverNumber}`
  );
  if (!data) return { laps: [], raw: [] };
  const sorted = data.sort((a, b) => a.lap_number - b.lap_number);
  return {
    laps: sorted.map((l) => ({
      lapNumber: l.lap_number,
      lapDuration: l.lap_duration,
      isPitOutLap: l.is_pit_out_lap,
    })),
    raw: sorted,
  };
}

async function getTrackShape(
  sessionKey: number,
  driverNumber: number,
  fastestLap: LapApi | undefined,
  nextLap: LapApi | undefined
): Promise<TrackPoint[]> {
  if (!fastestLap?.date_start) return [];
  const start = fastestLap.date_start;
  const end = nextLap?.date_start ?? null;

  let path = `/location?session_key=${sessionKey}&driver_number=${driverNumber}&date>=${encodeURIComponent(
    start
  )}`;
  if (end) path += `&date<${encodeURIComponent(end)}`;

  const points = await fetchJson<LocationApi[]>(path);
  if (!points || points.length === 0) return [];

  // Downsample to keep the SVG path light.
  const step = Math.max(1, Math.floor(points.length / 200));
  return points.filter((_, i) => i % step === 0).map((p) => ({ x: p.x, y: p.y }));
}

export async function getRaceTelemetry(
  sessionKey: number,
  driverNumber: number
): Promise<RaceTelemetry> {
  const [weather, stints, lapsResult] = await Promise.all([
    getWeather(sessionKey),
    getStints(sessionKey, driverNumber),
    getLaps(sessionKey, driverNumber),
  ]);

  const timedLaps = lapsResult.raw.filter(
    (l) => l.lap_duration !== null && !l.is_pit_out_lap
  );
  const fastest = timedLaps.length
    ? timedLaps.reduce((a, b) => (a.lap_duration! < b.lap_duration! ? a : b))
    : undefined;
  const fastestIndex = fastest
    ? lapsResult.raw.findIndex((l) => l.lap_number === fastest.lap_number)
    : -1;
  const nextLap =
    fastestIndex >= 0 ? lapsResult.raw[fastestIndex + 1] : undefined;

  const trackShape = fastest
    ? await getTrackShape(sessionKey, driverNumber, fastest, nextLap)
    : [];

  return {
    weather,
    stints,
    laps: lapsResult.laps,
    fastestLap: fastest
      ? {
          lapNumber: fastest.lap_number,
          lapDuration: fastest.lap_duration,
          isPitOutLap: fastest.is_pit_out_lap,
        }
      : null,
    trackShape,
  };
}
