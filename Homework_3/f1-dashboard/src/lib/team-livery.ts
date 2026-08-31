// Liveries live one-file-per-team under ./liveries; this re-export keeps the
// original import path working.
export { getLivery, LIVERIES_2026, TYRE_REGIONS } from "./liveries";
export type { BlendMode, Livery, LiveryZone } from "./liveries";
