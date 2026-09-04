import Link from "next/link";
import { getCurrentSessionStatus } from "@/lib/jolpica";
import { getCircuitInfo } from "@/lib/circuits";
import { flagEmojiFromISO2 } from "@/lib/format";
import type { Race } from "@/lib/types";

export async function LiveSessionBanner({
  season,
  races,
}: {
  season: number;
  races: Race[];
}) {
  const status = await getCurrentSessionStatus(season);
  if (status.status === "none") return null;

  const { session } = status;
  const info = getCircuitInfo(session.location);
  const matchingRace = races.find((r) => r.location === session.location);
  const isLive = status.status === "live";

  const content = (
    <>
      <span className="relative flex size-2.5 shrink-0">
        {isLive && (
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
        )}
        <span
          className={`relative inline-flex size-2.5 rounded-full ${isLive ? "bg-primary" : "bg-muted-foreground"}`}
        />
      </span>
      <span className="text-xs font-semibold uppercase tracking-wide">
        {isLive ? "Live" : "Next session"}
      </span>
      <span className="text-sm">
        {info && flagEmojiFromISO2(info.countryCode)} {info?.country ?? session.location}
      </span>
      <span className="text-sm text-muted-foreground">&middot; {session.session_name}</span>
      <span className="text-xs text-muted-foreground">
        {new Date(session.date_start).toLocaleString(undefined, {
          weekday: isLive ? undefined : "short",
          hour: "numeric",
          minute: "2-digit",
          ...(isLive ? {} : { month: "short", day: "numeric" }),
        })}
      </span>
    </>
  );

  const className =
    "flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5 w-fit";

  if (matchingRace) {
    return (
      <Link
        href={`/schedule?season=${season}&race=${matchingRace.id}`}
        className={`${className} hover:border-primary/50 transition-colors`}
      >
        {content}
      </Link>
    );
  }

  return <div className={className}>{content}</div>;
}
