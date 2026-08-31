import { BODY_EDGE, REGION, box, inset, mirror, ribbon } from "./geometry";
import type { Livery } from "./types";

const PAPAYA = "#ff7a00";
const ANTHRACITE = "#2a2c31";
const TEAL = "#12b8a6";

/**
 * MCL40 (2026). The reigning champions kept the papaya-and-anthracite
 * colourway and leaned further into the deeper orange of McLaren's earliest
 * F1 cars, with small hints of teal. The anthracite sits on the spine and the
 * back of the car rather than replacing any large body area.
 */
export const mclaren: Livery = {
  team: "McLaren",
  car: "MCL40 (2026)",
  primary: "#ff8000",
  secondary: "#2a2c31",
  accent: "#12b8a6",
  number: { color: "#ffffff", stroke: "#7a2c00" },
  source:
    "MCL40 launch, Bahrain, 9 Feb 2026 (mclaren.com / Motorsport.com) -- papaya with anthracite and hints of teal.",
  zones: [
    { fill: PAPAYA, clip: REGION.whole, label: "papaya base coat" },
    {
      fill: ANTHRACITE,
      clip: REGION.spine,
      label: "anthracite engine cover / shark fin",
    },
    { fill: ANTHRACITE, clip: REGION.rearWing, label: "anthracite rear wing" },
    {
      fill: ANTHRACITE,
      clip: box(0, 30, 8, 70),
      label: "anthracite front-wing mainplane",
    },
    {
      fill: ANTHRACITE,
      clip: REGION.floorEdgeTop,
      label: "anthracite floor edge",
    },
    {
      fill: ANTHRACITE,
      clip: REGION.floorEdgeBottom,
      label: "anthracite floor edge",
    },
    {
      fill: TEAL,
      clip: ribbon(inset(BODY_EDGE, 6.2), 1.6),
      label: "teal keyline inboard of the floor edge",
    },
    {
      fill: TEAL,
      clip: ribbon(mirror(inset(BODY_EDGE, 6.2)), 1.6),
      label: "teal keyline inboard of the floor edge",
    },
  ],
};
