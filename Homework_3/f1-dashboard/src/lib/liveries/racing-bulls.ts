import { BODY_EDGE, FLANK_LINE, REGION, SPINE_EDGE, box, inset, mirror, ribbon } from "./geometry";
import type { Livery } from "./types";

const WHITE = "#f1f2f4";
const FORD_BLUE = "#1e41c8";
const LIGHT_BLUE = "#6692ff";
const BLACK = "#24262b";
const RED = "#d51b4a";

/**
 * VCARB 03 (2026). The matte white car carries over, now with blue accents
 * tracing the contours of the chassis and blue streaks added to the engine
 * cover and sidepods as a nod to the team's new Ford power unit.
 */
export const racingBulls: Livery = {
  team: "Racing Bulls",
  car: "VCARB 03 (2026)",
  primary: "#f1f2f4",
  secondary: "#1e41c8",
  accent: "#d51b4a",
  number: { color: "#1e41c8", stroke: "#ffffff" },
  source:
    "Detroit launch, 15 Jan 2026 (visacashapprb.com / Motorsport.com) -- matte white with blue chassis-contour accents and Ford blue streaks.",
  zones: [
    { fill: WHITE, clip: REGION.whole, label: "matte white base coat" },
    {
      fill: FORD_BLUE,
      clip: ribbon(inset(SPINE_EDGE, -1), [3, 7]),
      label: "blue streak along the engine cover",
    },
    {
      fill: FORD_BLUE,
      clip: ribbon(mirror(inset(SPINE_EDGE, -1)), [3, 7]),
      label: "blue streak along the engine cover",
    },
    {
      fill: FORD_BLUE,
      clip: ribbon(inset(FLANK_LINE, 3), [2, 5]),
      label: "blue accent tracing the chassis contour",
    },
    {
      fill: FORD_BLUE,
      clip: ribbon(mirror(inset(FLANK_LINE, 3)), [2, 5]),
      label: "blue accent tracing the chassis contour",
    },
    {
      fill: LIGHT_BLUE,
      clip: ribbon(inset(BODY_EDGE, 9), 4),
      label: "light blue sidepod streak",
    },
    {
      fill: LIGHT_BLUE,
      clip: ribbon(mirror(inset(BODY_EDGE, 9)), 4),
      label: "light blue sidepod streak",
    },
    { fill: BLACK, clip: REGION.floorEdgeTop, label: "carbon floor edge" },
    { fill: BLACK, clip: REGION.floorEdgeBottom, label: "carbon floor edge" },
    { fill: BLACK, clip: box(0, 30, 7, 70), label: "carbon front-wing mainplane" },
    { fill: FORD_BLUE, clip: REGION.rearWing, label: "blue rear wing" },
    { fill: RED, clip: box(97, 30, 100, 70), label: "red rear-wing tip" },
  ],
};
