import { FLANK_LINE, REGION, band, box, inset, mirror, ribbon } from "./geometry";
import type { Livery } from "./types";

const BLACK = "#23262b";
const SILVER = "#b7bdc4";
const PETRONAS = "#00d7b9";

/**
 * W17 (2026). Predominantly black with the team's silver carried on the front
 * end, the two joined by a Petronas turquoise flow line that sweeps low along
 * the car -- rendered here as a flank line, since a top-down view can't show a
 * swoop that lives in side profile. The 2026 car also added a striped detail
 * across the top of the sidepods.
 */
export const mercedes: Livery = {
  team: "Mercedes",
  car: "W17 (2026)",
  primary: "#27f4d2",
  secondary: "#b7bdc4",
  accent: "#23262b",
  number: { color: "#ffffff", stroke: "#000000" },
  source:
    "W17 reveal, 22 Jan 2026 (mercedesamgf1.com / Motorsport.com) -- black base, silver front, Petronas flow line, sidepod stripes.",
  zones: [
    { fill: BLACK, clip: REGION.whole, label: "deep black base coat" },
    {
      // Gradient stops resolve against the full-width zone box, not the
      // clipped band, so they are given in whole-car x -- silver holds to the
      // cockpit and has faded into the base black by the time the clip ends.
      fill: `linear-gradient(90deg, ${SILVER} 0%, ${SILVER} 34%, ${BLACK} 60%)`,
      clip: band(0, 62),
      label: "silver front end fading into the black",
    },
    {
      fill: PETRONAS,
      clip: ribbon(inset(FLANK_LINE, 4), [2.5, 6]),
      label: "Petronas flow line sweeping to the rear",
    },
    {
      fill: PETRONAS,
      clip: ribbon(mirror(inset(FLANK_LINE, 4)), [2.5, 6]),
      label: "Petronas flow line (mirrored flank)",
    },
    { fill: PETRONAS, clip: box(46, 15, 48.5, 33), label: "sidepod stripe" },
    { fill: PETRONAS, clip: box(51, 15, 53.5, 33), label: "sidepod stripe" },
    { fill: PETRONAS, clip: box(56, 15, 58.5, 33), label: "sidepod stripe" },
    { fill: PETRONAS, clip: box(46, 67, 48.5, 85), label: "sidepod stripe" },
    { fill: PETRONAS, clip: box(51, 67, 53.5, 85), label: "sidepod stripe" },
    { fill: PETRONAS, clip: box(56, 67, 58.5, 85), label: "sidepod stripe" },
    { fill: SILVER, clip: REGION.rearWing, label: "silver rear wing" },
  ],
};
