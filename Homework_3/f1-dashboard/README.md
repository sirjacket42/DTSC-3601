# F1 Driver Spotlight

A driver-spotlight dashboard over the same Formula 1 dataset as Homework 2, rebuilt as a
Next.js + shadcn/ui site on top of a normalized Supabase schema, styled after an F1
telemetry HUD (dark theme, team-color accents, circular gauges, circuit trace).

**Pick a driver** from the selector (top right) to see their season stats, points
progression, and — for their most recent race — live telemetry pulled straight from the
[OpenF1](https://openf1.org) API (weather, tire strategy, lap times, and a circuit trace
drawn from real GPS telemetry).

## Data

- **Supabase** (`dtsc3601-hw2-f1` project) holds the historical season-results dataset,
  normalized into `drivers`, `constructors`, `races`, and `results` tables (foreign-keyed,
  RLS-gated to public `select`), migrated from Homework 2's flat `f1_results` table. Two
  reporting views (`result_details`, `driver_summary`) flatten the joins for the app.
- **OpenF1** is queried live (server-side, cached for 12h) for weather, tire stints, lap
  times, and driver-position GPS telemetry for the selected driver's most recent race —
  this data isn't stored in Supabase, since a single race can carry thousands of telemetry
  rows. The Schedule page also queries OpenF1 live (cached for 60s) for what session is
  happening right now.

  **OpenF1's free tier blocks *all* requests — every endpoint, every season, not just live
  data — while any F1 session is in progress anywhere, returning `503 Live F1 session in
  progress...` until it ends.** Every OpenF1 call in this app already fails soft (returns
  `null`/`[]` instead of throwing), so this just means telemetry, the live-session banner,
  and the race-schedule sync below quietly show nothing/skip during that window — nothing
  crashes, it just catches back up once the session ends.

The Dribbble reference this UI is styled after shows biometric widgets (heart rate,
breathing rate, tire temperature/pressure) that F1 doesn't publish — those are replaced
here with real, honest equivalents: tire **stint/compound** strategy, **lap times**, and
session **weather**, instead of fabricated numbers.

## Liveries

The car on the driver card is one neutral greyscale top-down render
(`public/cars/f1-topdown.png`) repainted per constructor. Each team gets its own
file under `src/lib/liveries/`, holding its palette and an ordered list of paint
zones; the 2026 entries are colour-blocked from that team's launch livery and
each carries a `source` note saying where the colours came from.

Zones are clipped to regions traced off the render itself — the body edge, nose,
engine-cover spine and flank lines in `src/lib/liveries/geometry.ts` were
measured from the PNG's alpha channel and a grid overlay, so a stripe follows
the bodywork instead of cutting a rectangle across it. That lets each car block
out what its real livery does: Cadillac's split white/black flanks, Audi's
titanium-to-carbon fade over the rear half, Williams' black sweep inside its
red-and-white keyline, Ferrari's white nose and side panels.

Rendering (`src/components/topdown-car-photo.tsx`) paints all the zones into one
layer that blends normally with itself, then multiplies that whole layer onto
the render once — so a white stripe stays white over a black base coat, and the
render's own shading still shows through the colour. Tyres are painted last on
every car so rubber stays black.

These are approximations of the colour blocking, not reproductions of the decal
artwork.

## Keeping the schedule fresh

`races` (season/round/location/date/session_key) is normal Supabase data, not something
fetched live, so it goes stale the moment a new round is announced or run. `/api/sync-races`
fixes that: it pulls every meeting OpenF1 has for a season, works out each one's round
number from its date order, and upserts the result into `races` — matched on
`(season, location)`, so it's safe to run repeatedly. New rounds get inserted, existing
ones get their date/session_key refreshed.

It's wired up as a Vercel Cron Job (`vercel.json`) hitting `/api/sync-races` once a day —
the Hobby plan's max frequency. That's fine for the schedule itself (announced weeks in
advance), but too slow to notice a race weekend starting, so a GitHub Actions workflow
(`.github/workflows/sync-races.yml`) also hits the same endpoint every 15 minutes — GitHub
Actions cron isn't capped by Vercel's plan, since it's just an outside caller. Vercel signs
its own cron requests with `Authorization: Bearer $CRON_SECRET` automatically once that env
var is set on the project; the GitHub Action sends the same header using a `CRON_SECRET`
repo secret (Settings → Secrets and variables → Actions) set to the identical value. The
route checks for it in production and skips the check in local dev. If this ever moves to
a Pro plan, the GitHub Action can be dropped and `vercel.json`'s schedule bumped instead.

Writing to `races` needs the Supabase **service role** key (the anon key is
read-only via RLS) — set `SUPABASE_SERVICE_ROLE_KEY` locally and on Vercel, and pick a
`CRON_SECRET` for Vercel to sign requests with (see `.env.local.example`). To run it by
hand — to backfill immediately instead of waiting for the next cron tick — hit it directly:

```bash
curl "https://<your-deployment>/api/sync-races?season=2026"
```

## Keeping results (and standings) fresh

`results` (points/positions per driver per race — what the standings pages are summed
from) is normal Supabase data too, and just as prone to going stale: nothing fetches it
live. `/api/sync-results` closes that gap the same way `/api/sync-races` does for the
schedule — for every race already in `races`, it pulls that round's classified result
*and* sprint result (if that weekend ran one) from Jolpica and upserts them into
`results`, matched on `(race_id, driver_id)` so it's safe to run repeatedly. A round
Jolpica hasn't published yet (race hasn't happened) is skipped, not errored.

Sprint points are additive on top of the Grand Prix's own points, so they're stored in
their own `sprint_points` column rather than folded into `points` — every standings
query sums `total_points` (`points + sprint_points`, computed in the `result_details`
view), so a sprint weekend's points count once each, correctly.

It runs on the same schedule as `/api/sync-races` — Vercel Cron once a day, the GitHub
Actions workflow every 15 minutes — and needs the same service-role key. Run it by hand
the same way:

```bash
curl "https://<your-deployment>/api/sync-results?season=2026"
```

## Local development

```bash
npm install
cp .env.local.example .env.local   # fill in your Supabase project URL + anon key
npm run dev
```

## Schema

```
constructors(id, name, color)
drivers(id, full_name, name_acronym, headshot_url, country_code)
races(id, season, round, location, date_start, session_key)
results(id, race_id -> races, driver_id -> drivers, constructor_id -> constructors,
        driver_number, position, points, sprint_points, number_of_laps, gap_to_leader,
        duration, dnf, dns, dsq)
```

`drivers` is keyed by `full_name` rather than `driver_number` — car numbers get reused by
reserve/substitute drivers within a season, so `driver_number` is stored per-result
instead. `races.session_key` maps each race to its OpenF1 session for the live telemetry
lookups.

## Deploying to Vercel

Live at <https://f1-dashboard-green.vercel.app>. The `f1-dashboard` Vercel project is
connected to this GitHub repo, so a push to `master` deploys to production on its own —
no CLI step needed.

Because the repo holds every homework and not just this app, the project's **Root
Directory** is set to `Homework_3/f1-dashboard`. A build from the repo root would fail;
there is no `package.json` there. Note also that a push touching only another homework
still triggers a build here, unless an Ignored Build Step is added.

To deploy by hand, or to set the project up from scratch:

```bash
npx vercel link
npx vercel env add NEXT_PUBLIC_SUPABASE_URL production
npx vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
npx vercel env add NEXT_PUBLIC_MAPBOX_TOKEN production
npx vercel env add SUPABASE_SERVICE_ROLE_KEY production
npx vercel env add CRON_SECRET production
npx vercel --prod
```
