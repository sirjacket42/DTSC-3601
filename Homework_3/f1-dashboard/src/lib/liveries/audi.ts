import { FLANK_LINE, REGION, band, between, box, inset, mirror, ribbon } from "./geometry";
import type { Livery } from "./types";

const TITANIUM = "#c6ccd2";
const CARBON = "#24272c";
const AUDI_RED = "#f50537";

/**
 * R26 (2026), Audi's first works car after taking over the Sauber entry.
 * A two-tone scheme: titanium silver (borrowed from the Concept C) over the
 * front and middle of the car, carbon black taking the rear half, and the new
 * Audi Red used as an accent on the rear -- four rings on the airbox flanks
 * and across the rear wing.
 */
export const audi: Livery = {
  team: "Audi",
  car: "R26 (2026)",
  primary: "#c8ced4",
  secondary: "#24272c",
  accent: "#f50537",
  number: { color: "#f50537", stroke: "#24272c" },
  source:
    "R26 world debut, Berlin, 20 Jan 2026 (Formula1.com / Sky Sports / The Race) -- titanium silver with carbon black and Audi Red over the rear half.",
  zones: [
    { fill: TITANIUM, clip: REGION.whole, label: "titanium silver base coat" },
    {
      // Gradient stops resolve against the full-width zone box, not the
      // clipped band, so they are given in whole-car x: the titanium is still
      // fading as the clip opens, which is what makes the change read as a
      // transition rather than a painted edge at x = 46.
      fill: `linear-gradient(90deg, ${TITANIUM} 44%, ${CARBON} 70%, ${CARBON} 100%)`,
      clip: band(46, 100),
      label: "carbon black taking the rear half",
    },
    {
      fill: AUDI_RED,
      clip: ribbon(between(inset(FLANK_LINE, 5), 56, 90), [3, 6]),
      label: "Audi Red along the airbox flank",
    },
    {
      fill: AUDI_RED,
      clip: ribbon(mirror(between(inset(FLANK_LINE, 5), 56, 90)), [3, 6]),
      label: "Audi Red along the airbox flank",
    },
    { fill: AUDI_RED, clip: REGION.rearWing, label: "Audi Red rear wing" },
    {
      fill: CARBON,
      clip: box(0, 30, 8, 70),
      label: "carbon front-wing mainplane",
    },
  ],
};
