// Constructors that appear in earlier seasons of the dataset but are not on
// the 2026 grid -- either renamed (Alfa Romeo -> Kick Sauber -> Audi,
// AlphaTauri -> RB -> Racing Bulls) or gone. Colour-blocked from each team's
// final livery under that name, to the same level of detail as the 2026 cars.

import {
  BODY_EDGE,
  FLANK_LINE,
  NOSE_EDGE,
  REGION,
  box,
  inset,
  mirror,
  panel,
  ribbon,
} from "./geometry";
import type { Livery } from "./types";

/** C43 (2023), the last car to race as Alfa Romeo. */
export const alfaRomeo: Livery = {
  team: "Alfa Romeo",
  car: "C43 (2023)",
  primary: "#c42a45",
  secondary: "#f0f0f0",
  accent: "#24252a",
  number: { color: "#ffffff", stroke: "#6d0d20" },
  source: "C43 livery, 2023 season -- red and white over a black spine.",
  zones: [
    { fill: "#c42a45", clip: REGION.whole, label: "Alfa red base coat" },
    { fill: "#f0f0f0", clip: REGION.frontWing, label: "white front wing" },
    { fill: "#f0f0f0", clip: REGION.nose, label: "white nose" },
    { fill: "#24252a", clip: REGION.spine, label: "black engine cover" },
    { fill: "#24252a", clip: REGION.rearWing, label: "black rear wing" },
    {
      fill: "#f0f0f0",
      clip: ribbon(inset(BODY_EDGE, 5), 5),
      label: "white sidepod flash",
    },
    {
      fill: "#f0f0f0",
      clip: ribbon(mirror(inset(BODY_EDGE, 5)), 5),
      label: "white sidepod flash",
    },
  ],
};

/** AT04 (2023), the last car to race as AlphaTauri. */
export const alphaTauri: Livery = {
  team: "AlphaTauri",
  car: "AT04 (2023)",
  primary: "#233b5e",
  secondary: "#f0f0f0",
  accent: "#e8002d",
  number: { color: "#ffffff", stroke: "#101d33" },
  source: "AT04 livery, 2023 season -- navy body with a white front end.",
  zones: [
    { fill: "#233b5e", clip: REGION.whole, label: "navy base coat" },
    { fill: "#f0f0f0", clip: REGION.frontEnd, label: "white front end" },
    {
      fill: "#f0f0f0",
      clip: panel(BODY_EDGE, inset(BODY_EDGE, 12)),
      label: "white sidepod",
    },
    {
      fill: "#f0f0f0",
      clip: panel(mirror(BODY_EDGE), mirror(inset(BODY_EDGE, 12))),
      label: "white sidepod",
    },
    { fill: "#e8002d", clip: box(96, 30, 100, 70), label: "red rear-wing flash" },
  ],
};

/** VCARB 01 (2024), the single season run under the name "RB". */
export const rb: Livery = {
  team: "RB",
  car: "VCARB 01 (2024)",
  primary: "#f1f2f4",
  secondary: "#2e4ea0",
  accent: "#e8002d",
  number: { color: "#2e4ea0", stroke: "#ffffff" },
  source: "VCARB 01 livery, 2024 season -- white base with navy and red.",
  zones: [
    { fill: "#f1f2f4", clip: REGION.whole, label: "white base coat" },
    { fill: "#2e4ea0", clip: REGION.spine, label: "navy engine cover" },
    {
      fill: "#2e4ea0",
      clip: ribbon(inset(FLANK_LINE, 6), [5, 9]),
      label: "navy flank sweep",
    },
    {
      fill: "#2e4ea0",
      clip: ribbon(mirror(inset(FLANK_LINE, 6)), [5, 9]),
      label: "navy flank sweep",
    },
    { fill: "#24252a", clip: REGION.floorEdgeTop, label: "carbon floor edge" },
    { fill: "#24252a", clip: REGION.floorEdgeBottom, label: "carbon floor edge" },
    { fill: "#e8002d", clip: box(96, 30, 100, 70), label: "red rear-wing flash" },
  ],
};

/** C44/C45 (2024-25), the Kick Sauber years before the Audi takeover. */
export const kickSauber: Livery = {
  team: "Kick Sauber",
  car: "C45 (2025)",
  primary: "#52e252",
  secondary: "#202024",
  accent: "#f0f0f0",
  number: { color: "#52e252", stroke: "#202024" },
  source:
    "Kick Sauber livery, 2024-25 -- fluorescent green over a black front end.",
  zones: [
    { fill: "#3fd83f", clip: REGION.whole, label: "fluorescent green base coat" },
    { fill: "#202024", clip: REGION.frontEnd, label: "black front end" },
    { fill: "#202024", clip: REGION.spine, label: "black engine cover" },
    { fill: "#202024", clip: REGION.rearWing, label: "black rear wing" },
    {
      fill: "#3fd83f",
      clip: ribbon(inset(NOSE_EDGE, 3), 3),
      label: "green stripe down the nose",
    },
    {
      fill: "#3fd83f",
      clip: ribbon(mirror(inset(NOSE_EDGE, 3)), 3),
      label: "green stripe down the nose",
    },
  ],
};
