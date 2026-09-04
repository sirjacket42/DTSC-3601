import { NextRequest, NextResponse } from "next/server";
import { syncSeasonResults } from "@/lib/sync-results";

export const maxDuration = 60;

function isAuthorized(req: NextRequest): boolean {
  // Local dev: no secret configured yet, allow it so you can test freely.
  if (process.env.NODE_ENV !== "production") return true;

  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const season = Number(req.nextUrl.searchParams.get("season")) || new Date().getFullYear();

  try {
    const result = await syncSeasonResults(season);
    return NextResponse.json(result);
  } catch (err) {
    console.error("sync-results failed", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Sync failed" },
      { status: 500 }
    );
  }
}
