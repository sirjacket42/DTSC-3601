import { REGION, box } from "./geometry";
import type { Livery } from "./types";

const OFF_WHITE = "#dbdde0";
const BLACK = "#26282e";
const GOLD = "#c9a227";

/**
 * Cadillac's debut livery (2026), revealed in a Super Bowl LX spot and at
 * Times Square. Where most cars mirror down the centreline, this one is split:
 * greyish white on the left flank, black on the right, in the manner of the
 * 1999 BAR car. That split is the one piece of livery blocking a top-down
 * view shows better than any other angle, so it is rendered literally here.
 */
export const cadillac: Livery = {
  team: "Cadillac",
  car: "2026 debut livery",
  primary: "#dbdde0",
  secondary: "#26282e",
  accent: "#c9a227",
  number: { color: "#c9a227", stroke: "#26282e" },
  source:
    "Super Bowl LX reveal, 8 Feb 2026 (cadillacf1team.com / Formula1.com / ESPN) -- split black-and-white flanks with gold accents.",
  zones: [
    { fill: OFF_WHITE, clip: REGION.flankLeft, label: "off-white left flank" },
    { fill: BLACK, clip: REGION.flankRight, label: "black right flank" },
    {
      fill: GOLD,
      clip: box(0, 48.6, 100, 51.4),
      label: "gold keyline down the split",
    },
    { fill: GOLD, clip: box(0, 4, 13.5, 10), label: "gold front-wing endplate" },
    { fill: GOLD, clip: box(0, 90, 13.5, 96), label: "gold front-wing endplate" },
    { fill: GOLD, clip: box(97.5, 30, 100, 70), label: "gold rear-wing edge" },
  ],
};
