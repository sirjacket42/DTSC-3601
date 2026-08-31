// Per-constructor livery definitions for the top-down car render.
//
// Each team gets its own file so that its colour-blocking can be described
// zone by zone against the real car, rather than every team being forced
// through one shared nose/body/wing split. The 2026 entries are taken from
// each team's launch livery; see the `source` field on each.
//
// These are colour-blocking approximations: the right colours in roughly the
// right places, without sponsor decals or exact panel artwork.

import { REGION } from "./geometry";
import type { Livery } from "./types";

import { alpine } from "./alpine";
import { astonMartin } from "./aston-martin";
import { audi } from "./audi";
import { cadillac } from "./cadillac";
import { ferrari } from "./ferrari";
import { haas } from "./haas";
import { mclaren } from "./mclaren";
import { mercedes } from "./mercedes";
import { racingBulls } from "./racing-bulls";
import { redBull } from "./red-bull";
import { williams } from "./williams";
import { alfaRomeo, alphaTauri, kickSauber, rb } from "./historical";

export type { BlendMode, Livery, LiveryZone } from "./types";
export { TYRE_REGIONS } from "./geometry";

/** The 2026 grid. */
export const LIVERIES_2026 = [
  redBull,
  ferrari,
  mercedes,
  mclaren,
  astonMartin,
  alpine,
  williams,
  racingBulls,
  audi,
  haas,
  cadillac,
];

const ALL: Livery[] = [...LIVERIES_2026, alfaRomeo, alphaTauri, rb, kickSauber];

const BY_TEAM = new Map(ALL.map((livery) => [normalize(livery.team), livery]));

/**
 * Constructor names the dataset uses that don't match a livery's `team`
 * verbatim -- sponsor prefixes, the Sauber/Audi and AlphaTauri/RB renames.
 */
const ALIASES: Record<string, Livery> = {
  "red bull": redBull,
  "oracle red bull racing": redBull,
  "scuderia ferrari": ferrari,
  "mercedes amg": mercedes,
  "mercedes-amg petronas": mercedes,
  "aston martin aramco": astonMartin,
  "bwt alpine": alpine,
  "alpine f1 team": alpine,
  "atlassian williams": williams,
  "williams racing": williams,
  haas: haas,
  "visa cash app rb": rb,
  "visa cash app racing bulls": racingBulls,
  sauber: kickSauber,
  "stake f1 team": kickSauber,
  "stake f1 team kick sauber": kickSauber,
  "audi f1 team": audi,
  "cadillac f1 team": cadillac,
};

/** Neutral scheme for a constructor with no definition of its own. */
const DEFAULT_LIVERY: Livery = {
  team: "Unknown",
  car: "generic",
  primary: "#8c8c94",
  secondary: "#2f3136",
  accent: "#d5d5d5",
  number: { color: "#ffffff", stroke: "#000000" },
  source: "Fallback -- no livery on file for this constructor.",
  zones: [
    { fill: "#8c8c94", clip: REGION.whole, label: "neutral base coat" },
    { fill: "#2f3136", clip: REGION.spine, label: "dark engine cover" },
    { fill: "#2f3136", clip: REGION.rearWing, label: "dark rear wing" },
  ],
};

export function getLivery(teamName: string | null | undefined): Livery {
  if (!teamName) return DEFAULT_LIVERY;
  const key = normalize(teamName);
  return BY_TEAM.get(key) ?? ALIASES[key] ?? DEFAULT_LIVERY;
}

function normalize(name: string) {
  return name.trim().toLowerCase();
}
