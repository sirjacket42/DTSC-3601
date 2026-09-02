export type Driver = {
  id: number;
  full_name: string;
  name_acronym: string | null;
  headshot_url: string | null;
  country_code: string | null;
};

export type DriverListItem = Driver & {
  team_name: string;
  team_color: string;
  driver_number: number | null;
  career_points: number;
};

export type Race = {
  id: number;
  season: number;
  round: number;
  location: string;
  date_start: string;
  session_key: number | null;
};

export type ResultRow = {
  id: number;
  position: number | null;
  points: number;
  number_of_laps: number | null;
  gap_to_leader: string | null;
  duration: number | null;
  dnf: boolean;
  dns: boolean;
  dsq: boolean;
  driver_number: number | null;
  race: Race;
  constructor_name: string;
  constructor_color: string;
};

export type SeasonStats = {
  points: number;
  wins: number;
  podiums: number;
  races: number;
  avgFinish: number | null;
  dnfs: number;
  bestFinish: number | null;
};

export type StandingsRank = {
  rank: number;
  total: number;
};

export type PointsProgressionPoint = {
  round: number;
  location: string;
  racePoints: number;
  cumulativePoints: number;
};

export type Weather = {
  airTemp: number;
  trackTemp: number;
  humidity: number;
  windSpeed: number;
  rainfall: boolean;
};

export type Stint = {
  stintNumber: number;
  compound: string;
  lapStart: number;
  lapEnd: number;
  tyreAgeAtStart: number;
};

export type LapPoint = {
  lapNumber: number;
  lapDuration: number | null;
  isPitOutLap: boolean;
};

export type TrackPoint = {
  x: number;
  y: number;
  /** Seconds elapsed since the start of the lap. */
  t: number;
};

export type RaceTelemetry = {
  weather: Weather | null;
  stints: Stint[];
  laps: LapPoint[];
  fastestLap: LapPoint | null;
  trackShape: TrackPoint[];
};
