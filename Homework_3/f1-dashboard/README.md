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
  rows.

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
        driver_number, position, points, number_of_laps, gap_to_leader, duration,
        dnf, dns, dsq)
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
npx vercel --prod
```
