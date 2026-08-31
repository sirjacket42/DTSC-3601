import { BODY_EDGE, REGION, inset, mirror, ribbon } from "./geometry";
import type { Livery } from "./types";

const BLUE = "#0057c8";
const PINK = "#ff87bc";
const NAVY = "#0b1a3f";
const WHITE = "#ededed";

/**
 * A526 (2026). An evolution rather than a reset: Alpine blue with BWT's pink
 * carried on the front end and the rear wing, dark navy through the spine,
 * and white keylines separating the two brand colours.
 */
export const alpine: Livery = {
  team: "Alpine",
  car: "A526 (2026)",
  primary: "#0090ff",
  secondary: "#ff87bc",
  accent: "#0b1a3f",
  number: { color: "#ffffff", stroke: "#0b1a3f" },
  source:
    "A526 livery reveal aboard MSC World Europa, 23 Jan 2026 (media.alpinecars.com / Motorsport.com) -- Alpine blue with BWT pink.",
  zones: [
    { fill: BLUE, clip: REGION.whole, label: "Alpine blue base coat" },
    { fill: PINK, clip: REGION.frontWing, label: "BWT pink front wing" },
    { fill: PINK, clip: REGION.nose, label: "BWT pink nose" },
    { fill: PINK, clip: REGION.rearWing, label: "BWT pink rear wing" },
    { fill: NAVY, clip: REGION.spine, label: "navy engine cover" },
    {
      fill: PINK,
      clip: ribbon(inset(BODY_EDGE, 4), 3),
      label: "pink flash along the sidepod",
    },
    {
      fill: PINK,
      clip: ribbon(mirror(inset(BODY_EDGE, 4)), 3),
      label: "pink flash along the sidepod",
    },
    {
      fill: WHITE,
      clip: ribbon(inset(BODY_EDGE, 6.4), 1.8),
      label: "white keyline under the pink",
    },
    {
      fill: WHITE,
      clip: ribbon(mirror(inset(BODY_EDGE, 6.4)), 1.8),
      label: "white keyline under the pink",
    },
  ],
};
