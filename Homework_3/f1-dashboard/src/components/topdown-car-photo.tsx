import { TYRE_REGIONS, type Livery } from "@/lib/team-livery";

const CAR_SRC = "/cars/f1-topdown.png";

// The render is a pure-greyscale shell: luminance runs 107-244 with a mean of
// 195 (0.77). The paint layer multiplies over it, so at that mean every team
// hex would come out ~23% too dark. This lifts the shell to a mean of ~0.87
// while keeping most of its shading range, which puts the painted colour close
// to the team's actual hex and leaves the render's own highlights and shadows
// reading as a 3D object.
const SHELL_FILTER = "contrast(0.8) brightness(1.22)";

const TYRE_RUBBER = "#26262a";

const MASK: React.CSSProperties = {
  WebkitMaskImage: `url(${CAR_SRC})`,
  maskImage: `url(${CAR_SRC})`,
  WebkitMaskSize: "contain",
  maskSize: "contain",
  WebkitMaskRepeat: "no-repeat",
  maskRepeat: "no-repeat",
  WebkitMaskPosition: "center",
  maskPosition: "center",
};

/**
 * Recolours a neutral top-down car render into a team's livery.
 *
 * The render supplies the shading; the livery supplies the paint. Every zone
 * is drawn into one masked paint layer, where the zones blend `normal` against
 * each other -- so a later coat *replaces* what is under it and a white stripe
 * stays white on a black base coat. Only the finished paint layer is blended
 * (multiply) onto the shell, once, which is what keeps highlights, shadows and
 * panel lines visible through the colour.
 *
 * Zone geometry is per team (see src/lib/liveries): each livery blocks out the
 * regions its real car does -- Cadillac's left/right flank split, Audi's
 * silver-to-carbon fade over the rear half, Williams' black sweep with its
 * red-and-white keyline -- rather than every car sharing one nose/body/wing
 * split. Tyres are painted last on every car so rubber stays black.
 */
export function TopDownCarPhoto({
  livery,
  number,
  className,
}: {
  livery: Livery;
  number: number | null;
  className?: string;
}) {
  return (
    <div
      className={className}
      style={
        {
          position: "relative",
          isolation: "isolate",
          containerType: "inline-size",
        } as React.CSSProperties
      }
    >
      <img
        src={CAR_SRC}
        alt={`Top-down view of the ${livery.team} car in its ${livery.car} livery`}
        style={{
          display: "block",
          width: "100%",
          height: "auto",
          filter: SHELL_FILTER,
        }}
      />

      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          mixBlendMode: "multiply",
          ...MASK,
        }}
      >
        {livery.zones.map((zone, i) => (
          <div
            key={`zone-${i}`}
            style={{
              position: "absolute",
              inset: 0,
              background: zone.fill,
              clipPath: zone.clip,
              mixBlendMode: zone.blend ?? "normal",
              opacity: zone.opacity,
            }}
          />
        ))}
        {TYRE_REGIONS.map((clip, i) => (
          <div
            key={`tyre-${i}`}
            style={{
              position: "absolute",
              inset: 0,
              background: TYRE_RUBBER,
              clipPath: clip,
            }}
          />
        ))}
      </div>

      {number !== null && (
        <div
          aria-hidden
          style={
            {
              position: "absolute",
              left: "46%",
              top: "51%",
              transform: "translate(-50%, -50%)",
              fontFamily: "var(--font-geist-mono, monospace)",
              fontWeight: 900,
              fontSize: "5.5cqw",
              color: livery.number.color,
              WebkitTextStroke: `1.5px ${livery.number.stroke}`,
              paintOrder: "stroke fill",
            } as React.CSSProperties & {
              WebkitTextStroke: string;
              paintOrder: string;
            }
          }
        >
          {number}
        </div>
      )}
    </div>
  );
}
