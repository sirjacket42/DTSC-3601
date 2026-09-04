import Image from "next/image";
import { cn } from "@/lib/utils";

// Official 2026 team logo slugs on F1's media CDN. Historical teams
// (Alfa Romeo, AlphaTauri, RB, Kick Sauber) have no current-season asset and
// fall back to a lettered badge below.
const TEAM_LOGO_SLUGS: Record<string, string> = {
  Mercedes: "mercedes",
  Ferrari: "ferrari",
  McLaren: "mclaren",
  "Red Bull Racing": "redbullracing",
  "Racing Bulls": "racingbulls",
  Alpine: "alpine",
  "Haas F1 Team": "haasf1team",
  Audi: "audi",
  Williams: "williams",
  "Aston Martin": "astonmartin",
  Cadillac: "cadillac",
};

function logoUrl(slug: string): string {
  return `https://media.formula1.com/image/upload/c_lfill,w_64/q_auto/v1740000001/common/f1/2026/${slug}/2026${slug}logowhite.webp`;
}

function teamInitials(teamName: string): string {
  const words = teamName.split(/\s+/).filter(Boolean);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return teamName.slice(0, 3).toUpperCase();
}

export function TeamBadge({
  teamName,
  color,
  className,
}: {
  teamName: string;
  color: string;
  className?: string;
}) {
  const slug = TEAM_LOGO_SLUGS[teamName];

  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-md shrink-0 size-7 p-1",
        className
      )}
      style={{
        background: `color-mix(in oklch, ${color} 22%, transparent)`,
        border: `1px solid color-mix(in oklch, ${color} 45%, transparent)`,
      }}
      title={teamName}
    >
      {slug ? (
        <Image
          src={logoUrl(slug)}
          alt={teamName}
          width={64}
          height={64}
          unoptimized
          className="w-full h-full object-contain"
        />
      ) : (
        <span className="text-[10px] font-bold leading-none" style={{ color }}>
          {teamInitials(teamName)}
        </span>
      )}
    </span>
  );
}
