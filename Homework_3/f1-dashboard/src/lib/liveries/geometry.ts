// Geometry for the top-down car render (`public/cars/f1-topdown.png`, 1200x454).
//
// All coordinates are percentages of the image box:
//   x:  0 = front-wing tip  ...........  100 = rear-wing trailing edge
//   y:  0 = one flank       ...........  100 = the other flank
//
// The landmarks below were traced off the render itself -- first from its alpha
// channel column by column, then against a 5% grid overlaid on the image -- so
// the regions sit on the actual bodywork:
//
//   front wing     x   0.0 - 13.0   swept, spans nearly both flanks
//   front tyres    x  14.5 - 28.5   y  0.5-20.5  and  79.5-99.5
//   nose cone      x   4.0 - 36.0   y 44-56 at the tip, flaring to 37-63
//   chassis        x  34.0 - 43.0   flank edge sweeps out from y 30 to y 15
//   sidepods       x  43.0 - 74.0   widest bodywork, flank edge at y 13-17
//   engine cover   x  43.0 - 82.0   spine tapering to y 47-53 at the rear
//   rear tyres     x  79.5 - 94.5   y  0-23  and  77-100
//   rear wing      x  88.0 - 99.0   y 16-84 (its middle hidden by the tyres)
//
// Because it is a top-down view, a livery's *lengthwise* blocking (nose /
// sidepod / engine cover / wings) maps to x, and its *flank* blocking -- side
// stripes, keylines, split-livery halves -- maps to y. Anything a real livery
// does purely in side profile (a swoop that rises over the airbox, say) can
// only be approximated here as a flank line.

type Point = [number, number];

// --- primitives ------------------------------------------------------------

/** A lengthwise band spanning both flanks, from x0 to x1. */
export const band = (x0: number, x1: number) =>
  `inset(0 ${r(100 - x1)}% 0 ${r(x0)}%)`;

/** An axis-aligned rectangle. */
export const box = (x0: number, y0: number, x1: number, y1: number) =>
  `inset(${r(y0)}% ${r(100 - x1)}% ${r(100 - y1)}% ${r(x0)}%)`;

/** An arbitrary polygon. */
export const poly = (...points: Point[]) =>
  `polygon(${points.map(([x, y]) => `${r(x)}% ${r(y)}%`).join(", ")})`;

/** Flip a flank shape onto the other side of the car. */
export const mirror = (points: Point[]): Point[] =>
  points.map(([x, y]) => [x, 100 - y]);

/** Move a flank polyline `d` towards the centreline (negative = outboard). */
export const inset = (points: Point[], d: number): Point[] =>
  points.map(([x, y]) => [x, y + d]);

/** Trim a polyline to an x range, keeping its shape. */
export const between = (points: Point[], x0: number, x1: number): Point[] => {
  const at = (x: number): Point => {
    for (let i = 1; i < points.length; i++) {
      if (x <= points[i][0] || i === points.length - 1) {
        const [ax, ay] = points[i - 1];
        const [bx, by] = points[i];
        return [x, ay + ((by - ay) * (x - ax)) / (bx - ax)];
      }
    }
    return [x, points[0][1]];
  };
  return [at(x0), ...points.filter((p) => p[0] > x0 && p[0] < x1), at(x1)];
};

/** A panel bounded by two flank polylines (outer edge and inner edge). */
export const panel = (outer: Point[], inner: Point[]) =>
  poly(...outer, ...[...inner].reverse());

/** A ribbon of width `w` centred on a flank polyline -- keylines, stripes. */
export const ribbon = (line: Point[], w: number | [number, number]) => {
  const [w0, w1] = typeof w === "number" ? [w, w] : w;
  const width = (i: number) => w0 + ((w1 - w0) * i) / (line.length - 1);
  return panel(
    line.map(([x, y], i) => [x, y - width(i) / 2] as Point),
    line.map(([x, y], i) => [x, y + width(i) / 2] as Point),
  );
};

function r(n: number) {
  return Math.round(n * 100) / 100;
}

// --- traced edges ----------------------------------------------------------
// Given for the upper flank; `mirror()` them for the lower one.

/**
 * Outer edge of the bodywork, from the chassis shoulder back to the rear
 * floor. Everything a livery paints down the side of the car hangs off this.
 */
export const BODY_EDGE: Point[] = [
  [34, 30],
  [38, 21],
  [43, 15],
  [50, 13],
  [60, 13],
  [68, 14],
  [74, 17],
  [79, 20],
];

/** Edge of the raised engine cover / shark fin, behind the halo to the rear. */
export const SPINE_EDGE: Point[] = [
  [52, 42],
  [60, 43],
  [70, 45],
  [80, 47],
];

/** Upper edge of the nose cone, wing mount to chassis. */
export const NOSE_EDGE: Point[] = [
  [3, 45],
  [14, 44],
  [26, 43],
  [34, 40],
  [37, 36],
];

/**
 * Flank line from the chassis shoulder back to the rear wing -- for stripes
 * that run the length of the car. It deliberately starts at the chassis and
 * not the nose: the nose is only ~12 units tall, so a flank line carried onto
 * it would collapse onto the centreline and meet its own mirror image.
 */
export const FLANK_LINE: Point[] = [
  [30, 34],
  [36, 25],
  [43, 18],
  [52, 16],
  [62, 16],
  [74, 19],
  [86, 22],
  [99, 25],
];

// --- named regions ---------------------------------------------------------

/** Named regions of the car, for use as `LiveryZone.clip`. */
export const REGION = {
  /** The whole silhouette -- what a base coat should use. */
  whole: "inset(0)",

  frontWing: band(0, 13),
  /** Front wing + nose + front axle: the "front end" most liveries block out. */
  frontEnd: band(0, 34),
  frontHalf: band(0, 50),
  /** The nose cone alone, following its taper. */
  nose: panel(NOSE_EDGE, mirror(NOSE_EDGE)),

  /** Engine cover + shark fin. */
  spine: panel(SPINE_EDGE, mirror(SPINE_EDGE)),

  /** Sidepod flank panels -- where side branding sits on a real car. */
  sidepodTop: panel(BODY_EDGE, inset(BODY_EDGE, 13)),
  sidepodBottom: panel(mirror(BODY_EDGE), mirror(inset(BODY_EDGE, 13))),

  /** The long dark strakes along the floor edge of most real cars. */
  floorEdgeTop: panel(BODY_EDGE, inset(BODY_EDGE, 5)),
  floorEdgeBottom: panel(mirror(BODY_EDGE), mirror(inset(BODY_EDGE, 5))),

  rearHalf: band(55, 100),
  rearEnd: band(66, 100),
  /** Rear wing; the tyre coats painted after it hide its middle section. */
  rearWing: box(88, 16, 100, 84),

  /** The two halves of a split livery. */
  flankLeft: box(0, 0, 100, 50),
  flankRight: box(0, 50, 100, 100),
} as const;

/**
 * Tyre footprints. Painted last on every car so rubber stays black instead of
 * taking the team colour -- in a top-down view you see tread, not wheel cover.
 */
export const TYRE_REGIONS = [
  box(14.5, 0.5, 28.5, 20.5),
  box(14.5, 79.5, 28.5, 99.5),
  box(79.5, 0, 94.5, 23),
  box(79.5, 77, 94.5, 100),
];
