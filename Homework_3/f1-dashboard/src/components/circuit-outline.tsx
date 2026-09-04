import { getCircuitTrack } from "@/lib/circuit-tracks";

const WIDTH = 200;
const HEIGHT = 140;
const PADDING = 12;

export function CircuitOutline({
  location,
  className,
}: {
  location: string;
  className?: string;
}) {
  const track = getCircuitTrack(location);
  if (!track || track.length < 2) return null;

  const xs = track.map(([lng]) => lng);
  const ys = track.map(([, lat]) => lat);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const spanX = maxX - minX || 1;
  const spanY = maxY - minY || 1;
  const scale = Math.min(
    (WIDTH - PADDING * 2) / spanX,
    (HEIGHT - PADDING * 2) / spanY
  );

  const path = track
    .map(([lng, lat], i) => {
      const x = PADDING + (lng - minX) * scale;
      const y = PADDING + (maxY - lat) * scale;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className={className} fill="none">
      <path
        d={path}
        stroke="currentColor"
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
