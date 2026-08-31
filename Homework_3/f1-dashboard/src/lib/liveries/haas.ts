import { BODY_EDGE, REGION, SPINE_EDGE, box, inset, mirror, panel, ribbon } from "./geometry";
import type { Livery } from "./types";

const WHITE = "#f2f2f2";
const RED = "#e6002b";
const BLACK = "#24252a";

/**
 * VF-26 (2026), the first car of the Toyota Gazoo Racing title partnership.
 * The black carbon areas of the 2025 car gave way to much more white, with red
 * accents picking out the bodywork lines and the angular GR mark carried on
 * the front wing and the shark fin.
 */
export const haas: Livery = {
  team: "Haas F1 Team",
  car: "VF-26 (2026)",
  primary: "#f2f2f2",
  secondary: "#e6002b",
  accent: "#24252a",
  number: { color: "#e6002b", stroke: "#ffffff" },
  source:
    "VF-26 reveal, 19 Jan 2026 (haasf1team.com / Sky Sports / The Race) -- white-dominant with red accents and TGR branding on the engine cover and front wing.",
  zones: [
    { fill: WHITE, clip: REGION.whole, label: "white base coat" },
    { fill: BLACK, clip: REGION.spine, label: "black engine cover / shark fin" },
    {
      fill: RED,
      clip: panel(inset(SPINE_EDGE, 4), mirror(inset(SPINE_EDGE, 4))),
      label: "red GR flash down the shark fin",
    },
    {
      fill: RED,
      clip: ribbon(inset(BODY_EDGE, 5), [5, 4]),
      label: "red accent along the sidepod line",
    },
    {
      fill: RED,
      clip: ribbon(mirror(inset(BODY_EDGE, 5)), [5, 4]),
      label: "red accent along the sidepod line",
    },
    { fill: RED, clip: box(0, 30, 13, 70), label: "red front-wing centre" },
    { fill: BLACK, clip: box(0, 1, 13, 11), label: "front-wing endplate" },
    { fill: BLACK, clip: box(0, 89, 13, 99), label: "front-wing endplate" },
    { fill: BLACK, clip: REGION.rearWing, label: "black rear wing" },
    { fill: RED, clip: box(88, 42, 100, 58), label: "red rear-wing centre" },
  ],
};
