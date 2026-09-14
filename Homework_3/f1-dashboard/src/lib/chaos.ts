import "server-only";
import type { RaceResultEntry } from "@/lib/jolpica";
import type { RaceControlMessage } from "@/lib/openf1";

// ---------------------------------------------------------------------------
// Types mirroring the Homework 4 chaos-score API contract
// (Homework_4/IDEA_BRIEF.md — "Input contract" / "API contract").
// ---------------------------------------------------------------------------

export type ChaosStatus = "finished" | "lapped" | "retired" | "dns" | "dsq";

export type ChaosResultRow = {
  grid: number;
  position: number;
  laps: number;
  status: ChaosStatus;
  time_millis: number | null;
};

export type ChaosTrackStatus = {
  safety_cars: number;
  virtual_safety_cars: number;
  red_flags: number;
};

export type ChaosRequestPayload = {
  results: ChaosResultRow[];
  track_status: ChaosTrackStatus;
};

export type ChaosLabel = "Calm" | "Eventful" | "Chaotic" | "Legendary";

export type ChaosFeatures = {
  retirement_rate: number;
  retirement_lap_spread: number;
  position_shuffle: number;
  winner_grid: number;
  podium_closeness: number;
  neutralizations: number;
};

export type SimilarRace = {
  season: number;
  round: number;
  race_name: string;
  distance: number;
};

export type ChaosResponse = {
  chaos_score: number;
  chaos_label: ChaosLabel;
  chaos_percentile: number;
  weirdness_score: number;
  weirdness_percentile: number;
  features: ChaosFeatures;
  most_similar_races: SimilarRace[];
};

export type ChaosBuildResult =
  | { ok: true; payload: ChaosRequestPayload }
  | { ok: false; reason: string };

const MIN_ROWS = 10;
const MAX_ROWS = 26;
const TIME_MILLIS_MIN = 3_000_000;
const TIME_MILLIS_MAX = 15_000_000;

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

/**
 * Collapses a raw Jolpica `status` string into the API's 5-way category.
 * Status text changed across eras (2018 uses specific causes like "Engine",
 * 2023+ uses generic "Retired"), so anything not explicitly handled below —
 * including those free-text causes and "Not classified" — falls through to
 * `retired`. Case-insensitive, trimmed.
 */
export function normalizeStatus(raw: string): ChaosStatus {
  const trimmed = raw.trim();
  const lower = trimmed.toLowerCase();

  if (lower === "finished") return "finished";
  if (lower === "lapped" || /^\+\s*\d+\s*laps?$/i.test(trimmed)) return "lapped";
  if (
    lower === "did not start" ||
    lower === "did not qualify" ||
    lower === "did not prequalify" ||
    lower === "withdrew"
  ) {
    return "dns";
  }
  if (lower === "disqualified" || lower === "excluded") return "dsq";
  return "retired";
}

export type NeutralizationCounts = ChaosTrackStatus;

/**
 * Counts safety car / VSC deployments and red flags from OpenF1 race_control
 * messages for one race.
 *
 * Keep in sync with Homework_4/data/COUNTING_RULES.md — the model is trained
 * on neutralization counts read from FastF1 track status, while this counts
 * the same events from OpenF1 race control at inference time using the exact
 * rule documented there (this is a direct port; do not simplify it back to
 * the 2023-era-only wording). The build script cross-checks the two sources
 * for every 2023+ race; if they disagree, the rule below (not the training
 * side) is what should change.
 *
 * OpenF1's message wording is NOT stable across seasons: 2023-2025 use
 * "SAFETY CAR DEPLOYED" / "VIRTUAL SAFETY CAR DEPLOYED" and represent red
 * flags as `category: "Flag", flag: "RED", message: "RED FLAG"`. Starting in
 * 2026, VSC messages shorten to "VSC DEPLOYED" / "VSC ENDING", and red flags
 * instead appear as `category: "Other", flag: null,
 * message: "RED FLAG - RACE SUSPENDED"`.
 *
 * Rules:
 * - Gate SC/VSC on `category === "SafetyCar"` so unrelated messages that
 *   merely mention "safety car" (e.g. penalty/investigation notes, which use
 *   category "Other") can never be miscounted as a deployment.
 * - Within that category, a message containing "DEPLOYED" is a VSC
 *   deployment if it also contains "VIRTUAL" or "VSC", otherwise a physical
 *   safety car deployment. "...ENDING" messages are ignored entirely — only
 *   "...DEPLOYED" starts a new counted period.
 * - A red flag is `flag === "RED"` (2023-2025) OR a message that *starts
 *   with* "RED FLAG" (2026's category "Other" representation) — startsWith,
 *   not includes, so it doesn't also match unrelated notes like
 *   "... RED FLAG INFRINGEMENT".
 * - Dedupe each of the three counters independently by `lap_number`: a new
 *   event only counts if its lap differs from the last counted lap of the
 *   *same* type. This collapses duplicate/re-broadcast messages for the same
 *   deployment without a time-window heuristic.
 */
export function countNeutralizations(
  messages: RaceControlMessage[] | null
): NeutralizationCounts {
  if (!messages || messages.length === 0) {
    return { safety_cars: 0, virtual_safety_cars: 0, red_flags: 0 };
  }

  const ordered = [...messages].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  let safety_cars = 0;
  let virtual_safety_cars = 0;
  let red_flags = 0;
  let lastScLap: number | null | undefined;
  let lastVscLap: number | null | undefined;
  let lastRedLap: number | null | undefined;

  for (const m of ordered) {
    const category = m.category ?? "";
    const msg = (m.message ?? "").toUpperCase();
    const flag = (m.flag ?? "").toUpperCase();
    const lap = m.lap_number;

    if (category === "SafetyCar" && msg.includes("DEPLOYED")) {
      if (msg.includes("VIRTUAL") || msg.includes("VSC")) {
        if (lastVscLap !== lap) {
          virtual_safety_cars++;
          lastVscLap = lap;
        }
      } else {
        if (lastScLap !== lap) {
          safety_cars++;
          lastScLap = lap;
        }
      }
    }

    if (flag === "RED" || msg.startsWith("RED FLAG")) {
      if (lastRedLap !== lap) {
        red_flags++;
        lastRedLap = lap;
      }
    }
  }

  return { safety_cars, virtual_safety_cars, red_flags };
}

/**
 * Maps Jolpica race results + OpenF1 race control messages onto the chaos-score
 * API's input contract. Returns `{ ok: false, reason }` instead of a payload
 * when the race can't be scored yet (too few classified results, no P1, the
 * race hasn't been run/published) — the panel shows `reason` as-is.
 */
export function buildChaosPayload(
  results: RaceResultEntry[],
  raceControl: RaceControlMessage[] | null
): ChaosBuildResult {
  if (results.length === 0) {
    return {
      ok: false,
      reason: "No classified results yet — this race hasn't been run or published.",
    };
  }

  const rows: ChaosResultRow[] = [];
  for (const r of results) {
    // Every row needs a real classification position; entries without one
    // (shouldn't normally appear in a results.json, but guard anyway) can't
    // be mapped onto the contract and are dropped rather than guessed at.
    if (r.position === null) continue;

    const timeMillis =
      r.timeMillis !== null && r.timeMillis >= TIME_MILLIS_MIN && r.timeMillis <= TIME_MILLIS_MAX
        ? r.timeMillis
        : null;

    rows.push({
      grid: clamp(r.grid, 0, 30),
      position: clamp(r.position, 1, 30),
      laps: clamp(r.laps, 0, 100),
      status: normalizeStatus(r.status),
      time_millis: timeMillis,
    });
  }

  // Jolpica already returns results in classification order, so slicing to
  // the API's 26-row cap keeps P1 (and the rest of the podium) intact even
  // when an oversized/chaotic field has to be trimmed.
  const trimmed = rows.slice(0, MAX_ROWS);

  if (trimmed.length < MIN_ROWS) {
    return {
      ok: false,
      reason: `Only ${trimmed.length} classified result${trimmed.length === 1 ? "" : "s"} — need at least ${MIN_ROWS}.`,
    };
  }

  const winners = trimmed.filter((r) => r.position === 1);
  if (winners.length === 0) {
    return { ok: false, reason: "No P1 in the results yet — this race may not be finished." };
  }
  if (winners.length > 1) {
    return { ok: false, reason: "Malformed results: more than one row at P1." };
  }

  const positions = new Set(trimmed.map((r) => r.position));
  if (positions.size !== trimmed.length) {
    return { ok: false, reason: "Malformed results: duplicate finishing positions." };
  }

  const hasFinisherWithTime = trimmed.some(
    (r) => r.status === "finished" && r.time_millis !== null
  );
  if (!hasFinisherWithTime) {
    return {
      ok: false,
      reason: "No finisher with a recorded race time — can't compute chaos features.",
    };
  }

  const counts = countNeutralizations(raceControl);
  const track_status: ChaosTrackStatus = {
    safety_cars: clamp(counts.safety_cars, 0, 10),
    virtual_safety_cars: clamp(counts.virtual_safety_cars, 0, 10),
    red_flags: clamp(counts.red_flags, 0, 5),
  };

  return { ok: true, payload: { results: trimmed, track_status } };
}
