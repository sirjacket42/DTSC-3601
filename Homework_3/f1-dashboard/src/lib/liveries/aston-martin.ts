import { BODY_EDGE, REGION, box, inset, mirror, panel, ribbon } from "./geometry";
import type { Livery } from "./types";

const GREEN = "#00594e";
const BLACK = "#1f2427";
const LIME = "#cedc00";

/**
 * AMR26 (2026), Adrian Newey's first car for the team. British Racing Green
 * kept in a matte finish, with large black panels across the sidepods
 * carrying the Aramco branding, and the team's lime green used only as
 * keylines and wing accents.
 */
export const astonMartin: Livery = {
  team: "Aston Martin",
  car: "AMR26 (2026)",
  primary: "#00665e",
  secondary: "#1f2427",
  accent: "#cedc00",
  number: { color: "#cedc00", stroke: "#04211c" },
  source:
    "AMR26 livery reveal, Dhahran, 10 Feb 2026 (astonmartinf1.com / Motorsport.com) -- matte BRG with large black sidepod panels.",
  zones: [
    { fill: GREEN, clip: REGION.whole, label: "British Racing Green base coat" },
    {
      fill: BLACK,
      clip: panel(inset(BODY_EDGE, 4), inset(BODY_EDGE, 14)),
      label: "black Aramco sidepod panel",
    },
    {
      fill: BLACK,
      clip: panel(mirror(inset(BODY_EDGE, 4)), mirror(inset(BODY_EDGE, 14))),
      label: "black Aramco sidepod panel",
    },
    { fill: BLACK, clip: REGION.spine, label: "black engine cover" },
    { fill: BLACK, clip: box(0, 30, 8, 70), label: "black front-wing mainplane" },
    {
      fill: LIME,
      clip: ribbon(inset(BODY_EDGE, 15.2), 1.8),
      label: "lime keyline framing the sidepod panel",
    },
    {
      fill: LIME,
      clip: ribbon(mirror(inset(BODY_EDGE, 15.2)), 1.8),
      label: "lime keyline framing the sidepod panel",
    },
    { fill: LIME, clip: box(0, 3, 13, 11), label: "lime front-wing endplate" },
    { fill: LIME, clip: box(0, 89, 13, 97), label: "lime front-wing endplate" },
    { fill: LIME, clip: box(96, 16, 100, 84), label: "lime rear-wing edge" },
  ],
};
