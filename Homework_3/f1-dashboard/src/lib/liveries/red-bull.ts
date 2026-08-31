import { BODY_EDGE, FLANK_LINE, REGION, between, box, inset, mirror, ribbon } from "./geometry";
import type { Livery } from "./types";

const NAVY = "#0e2148";
const BLACK = "#1c1f26";
const FORD_BLUE = "#1e6fd9";
const RED = "#d51b4a";
const YELLOW = "#ffc500";

/**
 * RB22 (2026). Red Bull dropped the matte finish for the gloss it ran on its
 * 2005 debut: a deep blue body with black detailing, and bright Ford blue
 * worked through the flanks to mark the Red Bull Powertrains-Ford engine
 * (the car reads "Ford blue from the side, classic Red Bull from the front").
 * The bull-and-suns marking on the sidepod keeps the familiar red and yellow.
 */
export const redBull: Livery = {
  team: "Red Bull Racing",
  car: "RB22 (2026)",
  primary: "#3671c6",
  secondary: "#1c1f26",
  accent: "#ffc500",
  number: { color: "#ffffff", stroke: "#0b1733" },
  source:
    "Detroit launch, 15 Jan 2026 (Formula1.com / Sky Sports / Motorsport.com) -- gloss deep blue + black with Ford blue accents.",
  zones: [
    { fill: NAVY, clip: REGION.whole, label: "deep blue base coat" },
    { fill: BLACK, clip: REGION.frontWing, label: "black front wing" },
    { fill: BLACK, clip: REGION.spine, label: "black engine cover / shark fin" },
    { fill: BLACK, clip: REGION.rearWing, label: "black rear wing" },
    {
      fill: FORD_BLUE,
      clip: ribbon(inset(FLANK_LINE, 6), [5, 3]),
      label: "Ford blue flank flash",
    },
    {
      fill: FORD_BLUE,
      clip: ribbon(mirror(inset(FLANK_LINE, 6)), [5, 3]),
      label: "Ford blue flank flash",
    },
    {
      fill: YELLOW,
      clip: ribbon(between(inset(BODY_EDGE, 9), 40, 64), 5),
      label: "sun disc behind the bull",
    },
    {
      fill: YELLOW,
      clip: ribbon(mirror(between(inset(BODY_EDGE, 9), 40, 64)), 5),
      label: "sun disc behind the bull",
    },
    {
      fill: RED,
      clip: ribbon(between(inset(BODY_EDGE, 13.5), 42, 62), 3),
      label: "charging bull marking",
    },
    {
      fill: RED,
      clip: ribbon(mirror(between(inset(BODY_EDGE, 13.5), 42, 62)), 3),
      label: "charging bull marking",
    },
    {
      fill: FORD_BLUE,
      clip: box(96, 20, 100, 80),
      label: "Ford blue rear-wing trailing edge",
    },
  ],
};
