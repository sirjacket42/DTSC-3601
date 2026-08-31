export type BlendMode = "normal" | "multiply" | "screen" | "overlay";

/**
 * One coat of paint: a CSS background clipped to a region of the car.
 *
 * Zones are painted back-to-front into a single paint layer that blends
 * `normal` internally, so a later zone *replaces* the paint under it rather
 * than tinting it. Only that finished paint layer is multiplied onto the
 * shaded render, which is what keeps a white stripe white even when it sits
 * on top of a black base coat.
 */
export type LiveryZone = {
  /**
   * Any CSS background value -- a flat hex, or a gradient for fades.
   *
   * Blacks are given as dark charcoals (~#20-2a) rather than true black: the
   * paint is multiplied onto the render, so a true black flattens the shading
   * to nothing and, on the dark theme's card, leaves the car indistinguishable
   * from the surface behind it.
   */
  fill: string;
  /** `clip-path` for the region this coat covers. See ./geometry. */
  clip: string;
  /** Blend against the zones already painted. Defaults to opaque paint. */
  blend?: BlendMode;
  /** 0-1, for soft/translucent accents. */
  opacity?: number;
  /** What this coat represents on the real car -- for readers of the file. */
  label?: string;
};

export type Livery = {
  /** Constructor name exactly as it appears in the `constructors` table. */
  team: string;
  /** Chassis + season the scheme is taken from, e.g. "RB22 (2026)". */
  car: string;
  /**
   * Headline palette. Not used by the car render (which reads `zones`); kept
   * as the team's summary colours for any other UI accent that wants them.
   */
  primary: string;
  secondary: string;
  accent: string;
  /** Paint scheme, base coat first. */
  zones: LiveryZone[];
  /** Racing-number colours, so the number stays legible on light liveries. */
  number: { color: string; stroke: string };
  /** Where the colours and the colour-blocking came from. */
  source: string;
};
