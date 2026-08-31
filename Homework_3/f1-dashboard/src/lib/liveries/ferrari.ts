import { BODY_EDGE, REGION, box, inset, mirror, panel, ribbon } from "./geometry";
import type { Livery } from "./types";

const ROSSO = "#ef1a2d";
const WHITE = "#f3f3f3";
const HP_BLUE = "#4aa8e0";
const BLACK = "#202024";

/**
 * SF-26 (2026). Ferrari went back to gloss paint after seven matte seasons
 * and lifted the red-and-white blocking from the 1975 312T: a brighter Rosso
 * Scuderia with white carried across the front section and along the side
 * panels, plus the lighter HP blue introduced with the 2026 car.
 */
export const ferrari: Livery = {
  team: "Ferrari",
  car: "SF-26 (2026)",
  primary: "#e8002d",
  secondary: "#f3f3f3",
  accent: "#4aa8e0",
  number: { color: "#ffffff", stroke: "#7a0012" },
  source:
    "SF-26 reveal, 23 Jan 2026 (Ferrari.com / PlanetF1 / RaceFans) -- gloss Rosso Scuderia, white front section and side panels, 312T homage.",
  zones: [
    { fill: ROSSO, clip: REGION.whole, label: "Rosso Scuderia base coat" },
    { fill: WHITE, clip: REGION.frontWing, label: "white front wing" },
    { fill: WHITE, clip: REGION.nose, label: "white nose" },
    {
      fill: WHITE,
      clip: panel(BODY_EDGE, inset(BODY_EDGE, 9)),
      label: "white side panel",
    },
    {
      fill: WHITE,
      clip: panel(mirror(BODY_EDGE), mirror(inset(BODY_EDGE, 9))),
      label: "white side panel",
    },
    {
      fill: HP_BLUE,
      clip: ribbon(inset(BODY_EDGE, 10.4), 2.4),
      label: "HP blue keyline under the side panel",
    },
    {
      fill: HP_BLUE,
      clip: ribbon(mirror(inset(BODY_EDGE, 10.4)), 2.4),
      label: "HP blue keyline under the side panel",
    },
    { fill: BLACK, clip: box(88, 0, 100, 18), label: "rear-wing endplate" },
    { fill: BLACK, clip: box(88, 82, 100, 100), label: "rear-wing endplate" },
  ],
};
