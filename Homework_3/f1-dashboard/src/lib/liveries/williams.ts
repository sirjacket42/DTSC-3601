import { BODY_EDGE, REGION, between, box, inset, mirror, panel, ribbon } from "./geometry";
import type { Livery } from "./types";

const BLUE = "#1447c8";
const BLACK = "#1e2127";
const WHITE = "#f0f0f0";
const BARCLAYS_CYAN = "#00b9e6";
const RED = "#d8102b";

/**
 * FW48 (2026). A gloss Williams blue body with a flowing black section that
 * runs from the side of the chassis back through the rear of the car, framed
 * by the red-and-white keyline off the FW14B and FW18. New for 2026: white
 * across the sidepod and both wings, and Barclays cyan on the sidepod.
 */
export const williams: Livery = {
  team: "Williams",
  car: "FW48 (2026)",
  primary: "#1447c8",
  secondary: "#f0f0f0",
  accent: "#00b9e6",
  number: { color: "#ffffff", stroke: "#08163f" },
  source:
    "FW48 livery reveal, 3 Feb 2026 (williamsf1.com / Sky Sports) -- gloss blue with a black sweep, red/white keyline, white wings and sidepod, Barclays cyan.",
  zones: [
    { fill: BLUE, clip: REGION.whole, label: "Williams blue base coat" },
    {
      fill: BLACK,
      clip: panel(inset(BODY_EDGE, 10), inset(BODY_EDGE, 22)),
      label: "black sweep from the chassis side to the rear",
    },
    {
      fill: BLACK,
      clip: panel(mirror(inset(BODY_EDGE, 10)), mirror(inset(BODY_EDGE, 22))),
      label: "black sweep from the chassis side to the rear",
    },
    {
      fill: WHITE,
      clip: ribbon(inset(BODY_EDGE, 8.6), 2.4),
      label: "white keyline framing the black",
    },
    {
      fill: WHITE,
      clip: ribbon(mirror(inset(BODY_EDGE, 8.6)), 2.4),
      label: "white keyline framing the black",
    },
    {
      fill: RED,
      clip: ribbon(inset(BODY_EDGE, 6.6), 1.6),
      label: "red keyline framing the black",
    },
    {
      fill: RED,
      clip: ribbon(mirror(inset(BODY_EDGE, 6.6)), 1.6),
      label: "red keyline framing the black",
    },
    { fill: WHITE, clip: REGION.frontWing, label: "white front wing" },
    { fill: WHITE, clip: REGION.rearWing, label: "white rear wing" },
    {
      fill: WHITE,
      clip: ribbon(between(inset(BODY_EDGE, 3), 40, 62), 5),
      label: "white sidepod panel",
    },
    {
      fill: WHITE,
      clip: ribbon(mirror(between(inset(BODY_EDGE, 3), 40, 62)), 5),
      label: "white sidepod panel",
    },
    {
      fill: BARCLAYS_CYAN,
      clip: ribbon(between(inset(BODY_EDGE, 3), 62, 74), 5),
      label: "Barclays cyan on the sidepod",
    },
    {
      fill: BARCLAYS_CYAN,
      clip: ribbon(mirror(between(inset(BODY_EDGE, 3), 62, 74)), 5),
      label: "Barclays cyan on the sidepod",
    },
    { fill: BLACK, clip: box(88, 0, 100, 14), label: "rear-wing endplate" },
    { fill: BLACK, clip: box(88, 86, 100, 100), label: "rear-wing endplate" },
  ],
};
