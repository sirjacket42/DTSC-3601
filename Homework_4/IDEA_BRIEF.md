# Homework 4 — Race Chaos Index API (planning brief)

## Context

DTSC 3601 Assignment 4, building on the homework_3 project: an F1 dashboard
(`Homework_3/f1-dashboard`, Next.js + shadcn/ui + Supabase, deployed at
`https://f1-dashboard-green.vercel.app`). Homework 4 lives in its own `homework_4` folder at
the repo root as a separate Python project. The existing Vercel app is the frontend.

## Assignment requirements (from the assignment text)

> Build a fitted scikit-learn Pipeline, serve it with FastAPI, deploy it to Modal, point a
> Vercel frontend at that API, and prove it with Postman. It does not have to predict labels.
> It does have to be a real Pipeline with learned state (wrong if rebuilt from scratch at
> boot) and at least one custom transformer you wrote.

1. **Custom transformer** in its own file `pipeline_def.py`. Inherits `BaseEstimator`,
   `TransformerMixin`. `fit` returns `self`. `__init__` only assigns its arguments.
2. **Fit and dump a bundle** (a dict, not a bare pipeline): `pipeline`, plus whatever the API
   needs, plus `metadata` with `steps`, `built_at`, `sklearn_version`.
3. **FastAPI (`serve.py`)**: load the `.joblib` once at import; a `GET` that describes the
   artifact; a `POST` that runs input through the pipeline; Pydantic bounds on every field →
   bad input = `422`; artifact missing/unloadable = `503`, not `500`. Test locally with
   `uvicorn serve:app --reload` → `http://localhost:8000/docs`.
4. **Modal**: ship three files in the image — `serve.py`, `pipeline_def.py`,
   `pipeline.joblib`. Pin scikit-learn to the exact version in metadata. Import the app
   inside the Modal function. `modal deploy`, copy the public URL.
5. **Vercel**: frontend must call the live Modal API (not localhost, not fake data).
6. **Postman**: collection with assertions against the deployed URL covering health,
   pipeline info, valid POST (`200`), invalid POST (`422`). Screenshot those calls.

**Submit on Canvas:** Modal API URL · API `/docs` URL · Vercel URL that uses the API ·
Postman screenshots (valid + 422; take all four anyway) · 3–5 sentences (what it does,
custom transformer name, sklearn version) · repo/zip containing `pipeline_def.py`, build
script, `serve.py`, `modal_serve.py`, artifact or rebuild script, Postman collection.

**URLs must be up at grading time.**

**"Don't miss" list from the assignment:** custom class not in the Modal image · sklearn
version mismatch · load-per-request · frontend still on localhost · Postman hitting
localhost.

## Chosen idea: "Race Chaos Index"

Given one F1 race's results plus its safety-car/red-flag counts, return:

- **Chaos score** (0–100) — *directional*: how eventful the race was (retirements, shuffled
  order, neutralizations, close podium, winner from far back).
- **Weirdness score** (0–100) — *non-directional*: how unusual the race's overall profile is
  versus history, from an `IsolationForest`. The two disagree in interesting ways — a
  dominant 25-second lights-to-flag win is low chaos but can be high weirdness.
- Per-feature breakdown (0–100 percentiles) for a radar chart, a label, and the most similar
  historical race.

This maps to the assignment's suggested "anomaly distance" idea, with a custom feature
engineering transformer in front.

### Why not IsolationForest alone for "chaos"

IsolationForest measures unusualness in any direction, so a boring-but-atypical race scores
as "chaotic". The chaos score is instead a combination of quantile-transformed features that
are all oriented so higher = more chaotic. IsolationForest is kept as the separate
weirdness output.

## Data sources (verified by live probes, 2026-09-12)

Training no longer depends on the homework_3 Supabase tables. Those only cover 2023–2026 (83
races with results), lack grid position, and store `gap_to_leader` as inconsistent free
text (`"12.345"` with no `+`, winner `"0"`, `"+1 LAP"`/`"+2 LAPS"`, plus rows with null gaps
or DNF-with-position). Jolpica gives cleaner numbers for the same races and more seasons.

| Source | What it gives | Coverage | Access notes |
|---|---|---|---|
| **Jolpica (Ergast mirror)** `api.jolpi.ca/ergast/f1/{season}/{round}/results.json` | per driver: `grid`, `position`, `laps`, `status`, `Time.millis` (lead-lap finishers), fastest lap | 1950 → 2026 | No key; send a `User-Agent`. Rate-limited (roughly 4 req/s burst, ~500 req/hr — verify). One request per race. Already used by `Homework_3/f1-dashboard/src/lib/jolpica.ts`. |
| **F1 live-timing archive** (via the `fastf1` Python package → `session.track_status`) | Track status stream: `SCDeployed`, `VSCDeployed`, `Red`, `Yellow`, `AllClear` with timestamps | 2018 → 2026 | Public static files, no key. Use FastF1 in the build script only (handles path lookup + caching). |
| **OpenF1** `api.openf1.org/v1/race_control`, `/overtakes`, `/sessions` | Race control messages (`SAFETY CAR DEPLOYED`, `VIRTUAL SAFETY CAR DEPLOYED`, red flags), overtakes | 2023 → 2026 | No key for historical data. Locks out during live sessions (see homework_3 README). Used by the **frontend** at inference time. |
| **Jolpica laps** `/laps.json` | lap-by-lap positions (→ lead changes) | 1996 → 2026 | ~1,200 rows/race at 100/page ≈ 13 requests per race — too costly for the rate limit across ~190 races. **Stretch goal only.** |

**Data gotchas found while probing:**

- **Status text changed across eras.** 2018 uses specific causes (`"Engine"`, `"Brakes"`,
  `"Wheel"`) and `"+1 Lap"`; 2023+ uses generic `"Retired"` and `"Lapped"`. So cause-based
  features (crash vs. mechanical) are **not** usable. Collapse status to one of
  `finished | lapped | retired | dns | dsq`, handling both eras
  (`"+N Lap(s)"` and `"Lapped"` → `lapped`; `"Did not start"`/`"Did not qualify"`/
  `"Withdrew"` → `dns`; `"Disqualified"` → `dsq`; anything else → `retired`).
- **OpenF1 overtakes look noisy** (2023 Bahrain reported 394), probably counting pit-cycle
  position swaps. Leave them out of the model.
- `grid = 0` in Jolpica means a pit-lane start. Treat it as grid = number of starters.

### Training set

- **Seasons 2018–2026, main races only (no sprints)**, including 2026 rounds completed at
  build time. That's about 186 races (2018: 21, 2019: 21, 2020: 17, 2021–2023: 22 each,
  2024–2025: 24 each, 2026: 13 so far). That's 2.2× the Supabase-only set, and 2018 is where
  the track-status archive starts.
- The build script caches raw API responses under `homework_4/data/raw/` so re-runs don't
  hit rate limits. It also writes the per-race feature table to `homework_4/data/races.csv`
  so the fit can be reproduced offline.
- **Train/serve consistency check:** training reads neutralization counts from FastF1 track
  status, but the frontend reads them from OpenF1 race control at inference time. For every
  2023+ race the build script should compare the two counts and print any mismatches. Fix
  the counting rules until they agree before trusting the model.
- Rebuild shortly before submission to pick up the latest 2026 rounds, and record `seasons`
  and `n_training_races` in metadata.

## Input contract (POST body)

Per-driver rows as structured values plus race-level neutralization counts. The frontend
does the mapping from Jolpica/OpenF1 (status → category, counting messages); all feature
math happens in the pipeline.

```json
{
  "results": [
    {"grid": 2, "position": 1, "laps": 70, "status": "finished", "time_millis": 6347927},
    {"grid": 1, "position": 3, "laps": 70, "status": "finished", "time_millis": 6352838},
    {"grid": 12, "position": 15, "laps": 69, "status": "lapped", "time_millis": null},
    {"grid": 8, "position": 18, "laps": 44, "status": "retired", "time_millis": null}
  ],
  "track_status": {"safety_cars": 2, "virtual_safety_cars": 0, "red_flags": 0}
}
```

Pydantic bounds (every field):

| Field | Bounds |
|---|---|
| `results` | list, 10–26 entries |
| `grid` | int 0–30 (0 = pit-lane start) |
| `position` | int 1–30 |
| `laps` | int 0–100 |
| `status` | `Literal["finished","lapped","retired","dns","dsq"]` |
| `time_millis` | int 3,000,000–15,000,000 or null (≈50 min–4 h 10 min; the red-flag cap) |
| `safety_cars`, `virtual_safety_cars` | int 0–10 |
| `red_flags` | int 0–5 |

Also use model-level validators: exactly one `position == 1`, positions unique, and at least
one `finished` row with `time_millis`. These are natural `422` cases for Postman.

## Custom transformer (`pipeline_def.py`)

`RaceChaosFeaturizer(BaseEstimator, TransformerMixin)`: input is a list of races (each a
dict with `results` + `track_status`), output is an `(n_races, n_features)` float array.
Every feature is oriented so **higher = more chaotic**.

| Feature | Definition | Edge cases |
|---|---|---|
| `retirement_rate` | retired ÷ starters (starters exclude `dns`) | — |
| `retirement_lap_spread` | std of retirees' `laps` ÷ winner's laps | < 2 retirees → 0 |
| `position_shuffle` | mean \|grid − position\| over classified (`finished`/`lapped`) cars | grid 0 → starters |
| `winner_grid` | winner's grid slot, log-scaled | grid 0 → starters |
| `podium_closeness` | −(P3 millis − P1 millis) in seconds, capped at 60 s | P3 lapped/no time → −60 |
| `neutralizations` | `safety_cars + 0.5·virtual_safety_cars + 2·red_flags` | weights are a planning decision |

Possible extra feature (weirdness only, not part of chaos): `lapped_share`.

Constructor params (assigned only, no logic in `__init__`): e.g. `podium_cap_seconds=60`,
`vsc_weight=0.5`, `red_flag_weight=2.0`. `fit` just returns `self`. Also expose
`get_feature_names_out`.

**Pickling gotcha:** the build script must `from pipeline_def import RaceChaosFeaturizer`.
Never define the class in the build script or a notebook, or joblib records it as
`__main__.RaceChaosFeaturizer` and loading fails in `serve.py` and on Modal.

## Pipeline & bundle

```python
pipeline = Pipeline([
    ("chaos_features", RaceChaosFeaturizer()),                     # custom, raw rows -> 6 features
    ("quantiles", QuantileTransformer(n_quantiles=<n_races>)),     # learned per-feature distributions
    ("weirdness", IsolationForest(random_state=42)),               # learned isolation trees
])
pipeline.fit(training_races)

feats = pipeline[:-1].transform(races)        # 0-1 per feature -> radar + chaos
chaos_raw = feats.mean(axis=1)                # (or weighted; decide in planning)
weird_raw = -pipeline.score_samples(races)    # higher = weirder
```

Both scores come from the same fitted Pipeline. The quantile distributions and isolation
trees are learned from ~186 historical races, so a pipeline rebuilt at boot would be wrong.

Bundle (`pipeline.joblib`):

- `pipeline`: the fitted Pipeline above
- `chaos_reference`: sorted training `chaos_raw` values → 0–100 score / percentile via
  `np.searchsorted`
- `weirdness_reference`: sorted training `weird_raw` values, same use
- `label_thresholds`: chaos percentile cut points, e.g. 50 / 80 / 95 →
  Calm / Eventful / Chaotic / Legendary
- `neighbors`: `NearestNeighbors(n_neighbors=3)` fit on the quantile features
- `race_index`: list of `{season, round, race_name}` aligned with the neighbors matrix
- `metadata`: `steps` (name + class per step), `built_at` (ISO UTC), `sklearn_version`
  (`sklearn.__version__`), plus `n_training_races`, `seasons`, `feature_names`,
  `numpy_version`, `python_version`

## API contract (`serve.py`)

At import: `try: BUNDLE = joblib.load(ARTIFACT_PATH)` / `except Exception: BUNDLE = None`
(and keep the error message). A dependency or helper raises `HTTPException(503)` whenever
`BUNDLE is None`. Add `CORSMiddleware` allowing the Vercel domain (and `localhost:3000` for
dev) — required because the browser calls Modal directly.

- `GET /health` → `200 {"status": "ok"}` if loaded, else `503`
- `GET /info` → `metadata` + feature descriptions + an example request body
- `POST /chaos-score` → returns
  - `chaos_score` (0–100), `chaos_label`, `chaos_percentile`
  - `weirdness_score` (0–100), `weirdness_percentile`
  - `features`: `{feature_name: 0–100}` for the radar chart
  - `most_similar_races`: top 3 `{season, round, race_name, distance}`

## Modal (`modal_serve.py`)

- `modal.Image.debian_slim(python_version=<same as build>)`, then
  `.pip_install("scikit-learn==<metadata.sklearn_version>", "numpy==<...>", "joblib==<...>", "fastapi[standard]", "pydantic")`,
  then `.add_local_file(...)` for exactly `serve.py`, `pipeline_def.py`, `pipeline.joblib`
  (e.g. into `/root`).
- `@app.function(image=image)` + `@modal.asgi_app()` → `def fastapi_app(): from serve import app; return app`.
- `modal deploy modal_serve.py` → record the URL. `/docs` is `<url>/docs`.
- Consider `min_containers=1` (or a longer `scaledown_window`) around grading time to avoid
  cold starts. Otherwise the frontend just needs a loading state.

## Frontend integration (`Homework_3/f1-dashboard`)

- Add a **Race Chaos** panel on the race/results view, reusing the existing race selector.
- **Server side (page/server component):** fetch that race's Jolpica `results.json` (extend
  `jolpica.ts` to keep `grid` and `Time.millis`) and OpenF1 `race_control` for the race's
  `session_key` (already stored in `races`). Map them to the input contract: status →
  category, and count `SAFETY CAR DEPLOYED` / `VIRTUAL SAFETY CAR DEPLOYED` / red-flag
  messages.
- **Client side:** a client component POSTs that payload **directly from the browser** to
  `process.env.NEXT_PUBLIC_CHAOS_API_URL`, so graders can see the Modal request in DevTools.
  Render the scores, label, radar breakdown (match `driver-radar-chart.tsx` styling) and
  similar races. Include loading and error states (cold start, 503).
- Set `NEXT_PUBLIC_CHAOS_API_URL` in Vercel project env vars to the Modal URL. Never use a
  localhost fallback in production code.
- **Uptime:** race selection still reads from Supabase, and free Supabase projects pause
  after about a week idle. Confirm the `sync-races` GitHub workflow runs on a schedule (keeps
  it active), or check the project before grading.

## Postman

Export the collection JSON to `homework_4/postman/`. Use a collection variable `baseUrl` = the
deployed Modal URL (never localhost).

1. `GET {{baseUrl}}/health` → test status `200`, `status == "ok"`
2. `GET {{baseUrl}}/info` → `200`, `metadata.steps` is an array, `metadata.sklearn_version`
   and `metadata.built_at` exist
3. `POST {{baseUrl}}/chaos-score` with a real race (e.g. 2024 Canada) → `200`, `chaos_score`
   between 0 and 100, `features` object, `most_similar_races` length 3
4. `POST {{baseUrl}}/chaos-score` invalid (e.g. `position: 99`, or 3-entry `results`) → `422`

Screenshot all four.

## Project layout

```
homework_4/
  IDEA_BRIEF.md
  pipeline_def.py        # RaceChaosFeaturizer (+ status/gap helpers)
  build_pipeline.py      # fetch (Jolpica + FastF1, cached) -> features -> fit -> dump bundle
  serve.py               # FastAPI app
  modal_serve.py         # Modal image + asgi_app
  pipeline.joblib        # committed artifact
  requirements.txt       # pinned: scikit-learn, numpy, joblib, fastapi, pydantic, fastf1, requests
  data/raw/              # cached API responses (gitignore or commit, decide)
  data/races.csv         # engineered per-race training table
  postman/race-chaos.postman_collection.json
  README.md              # URLs + 3–5 sentence write-up
```

## Open questions for the planning pass

- Chaos combination: plain mean of quantile features, or hand-weighted? (Weights must be
  constructor params or bundle values, not magic numbers in `serve.py`.)
- Neutralization weights (VSC 0.5, red 2.0) — confirm, or split into separate features.
- Exact status → category mapping for rare strings (`"Withdrew"`, `"Not classified"`,
  `"Excluded"`); dump every distinct status seen 2018–2026 during the fetch and decide.
- Whether to commit `data/raw/` (reproducible, larger repo) or gitignore it.
- Stretch: lead changes from lap positions (FastF1 `session.laps` for training; the frontend
  would need OpenF1 `/position` or Jolpica laps at inference). Only if time allows.
- `min_containers=1` on Modal during grading (costs credits) vs. accepting cold starts.
