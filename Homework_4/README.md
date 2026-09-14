# Race Chaos Index API

DTSC 3601 Homework 4: a fitted scikit-learn `Pipeline` served with FastAPI,
deployed to Modal, and called from the Homework 3 F1 dashboard on Vercel.

## Submission links

| What | URL |
|---|---|
| Modal API base URL | `https://sirjacket42--race-chaos-index-fastapi-app.modal.run` |
| API docs (`/docs`) | `https://sirjacket42--race-chaos-index-fastapi-app.modal.run/docs` |
| Vercel app | https://f1-dashboard-green.vercel.app (Race Chaos tab: https://f1-dashboard-green.vercel.app/chaos) |
| Postman screenshots | `postman/screenshots/` (health, info, valid 200, invalid 422) |

## What it does

The API scores one Formula 1 race's results plus its safety-car/red-flag
counts for how *chaotic* (directionally eventful: retirements, shuffled
finishing order, neutralizations, a close podium, a winner from far back)
and how *weird* (non-directionally unusual versus history, from an
`IsolationForest`) it was. A custom transformer, `RaceChaosFeaturizer`
(`pipeline_def.py`), turns the raw per-driver rows into six oriented
features (`retirement_rate`, `retirement_lap_spread`, `position_shuffle`,
`winner_grid`, `podium_closeness`, `neutralizations`), which feed a
`QuantileTransformer` and an `IsolationForest` inside one fitted
`Pipeline` (scikit-learn 1.8.0). It was trained on 186 races spanning
seasons 2018-2026 (main races only, no sprints). The response also
returns a 0-100 percentile per feature (for a radar chart), a chaos label
(Calm/Eventful/Chaotic/Legendary), and the 3 most similar historical
races by nearest-neighbor distance in feature space.

## Why this is "learned state," not a rebuild-at-boot pipeline

`serve.py` loads `pipeline.joblib` once at import time and never touches
scikit-learn's `fit()` again. The bundle carries state that can only come
from having been fit against the 186-race training set: the
`QuantileTransformer`'s per-feature empirical CDFs, the `IsolationForest`'s
trees (`random_state=42`), and a `NearestNeighbors` index over the
quantile-transformed features. Also bundled: sorted `chaos_reference` /
`weirdness_reference` arrays (turn a raw score into a percentile via
`np.searchsorted`), `chaos_weights`, `label_thresholds`, and `race_index`
(the `{season, round, race_name}` rows aligned to the neighbors matrix).
None of this is reconstructible from the request body alone -- it is the
product of `build_pipeline.py`'s one-time fit.

## Project layout

```
homework_4/
  IDEA_BRIEF.md            # planning brief for this assignment
  fetch_data.py            # pulls + caches Jolpica, FastF1, and OpenF1 data; writes data/
  build_pipeline.py        # loads data/training_races.json, fits the Pipeline, dumps pipeline.joblib
  pipeline_def.py          # RaceChaosFeaturizer (custom transformer) + status normalization + feature docs
  serve.py                 # FastAPI app: loads pipeline.joblib once, exposes /health /info /chaos-score
  modal_serve.py           # Modal image (pins sklearn/numpy/joblib to metadata versions) + asgi_app
  pipeline.joblib          # committed fitted bundle (pipeline + references + metadata)
  requirements.txt         # pinned deps: scikit-learn, numpy, scipy, joblib, fastapi, pydantic, uvicorn, fastf1, requests, pandas, pytest
  data/
    training_races.json    # engineered per-race training rows fed to build_pipeline.py
    races.csv              # per-race feature/score table (human-readable audit trail)
    status_counts.csv      # distinct raw Jolpica status strings observed 2018-2026
    neutralization_mismatches.csv  # per-race FastF1 vs. OpenF1 neutralization-count comparison
    COUNTING_RULES.md       # status->category mapping + neutralization counting rules (frontend must match)
    raw/                    # gitignored cache of raw API responses (~320MB); rebuild with fetch_data.py
  postman/
    race-chaos.postman_collection.json  # Postman v2.1 collection (health, info, valid, invalid)
    screenshots/            # screenshots of the 4 requests run against the deployed API
  tests/
    test_pipeline_def.py    # unit tests for RaceChaosFeaturizer + normalize_status
    test_serve.py           # FastAPI TestClient tests for serve.py's endpoints
```

## Reproduce locally

Using [uv](https://docs.astral.sh/uv/):

```bash
uv venv --python 3.13
uv pip install -r requirements.txt

python fetch_data.py        # rebuilds data/ from Jolpica + FastF1 + OpenF1 (rate-limited, slow; cached under data/raw/)
python build_pipeline.py    # fits the Pipeline and writes pipeline.joblib

pytest                       # unit tests for pipeline_def.py and serve.py

uvicorn serve:app --reload  # -> http://localhost:8000/docs

modal serve modal_serve.py  # live-reload dev server on Modal
modal deploy modal_serve.py # deploy; copy the printed URL into baseUrl / the links table above
```

## API reference

| Endpoint | Method | Success | Failure |
|---|---|---|---|
| `/health` | GET | `200 {"status": "ok", "model_loaded": true}` | `503` if the artifact failed to load |
| `/info` | GET | `200` -- `metadata`, `feature_descriptions`, `label_thresholds`, `example_request` | `503` if the artifact failed to load |
| `/chaos-score` | POST | `200` -- `ChaosScoreResponse` (below) | `422` on any Pydantic bounds/consistency violation; `503` if the artifact failed to load |

`POST /chaos-score` request bounds (every field validated; violations are `422`, not `500`):

| Field | Bounds |
|---|---|
| `results` | list, 10-26 entries |
| `results[].grid` | int 0-30 (0 = pit-lane start) |
| `results[].position` | int 1-30, unique across the list, exactly one `1` |
| `results[].laps` | int 0-100 |
| `results[].status` | one of `finished`, `lapped`, `retired`, `dns`, `dsq` |
| `results[].time_millis` | int 3,000,000-15,000,000, or null; at least one `finished` row must have a non-null value |
| `track_status.safety_cars`, `track_status.virtual_safety_cars` | int 0-10 |
| `track_status.red_flags` | int 0-5 |

`ChaosScoreResponse`:

```
chaos_score, chaos_label, chaos_percentile             # 0-100, one of Calm/Eventful/Chaotic/Legendary, 0-100
weirdness_score, weirdness_percentile                  # 0-100, 0-100
features: {retirement_rate, retirement_lap_spread,     # each 0-100
           position_shuffle, winner_grid,
           podium_closeness, neutralizations}
most_similar_races: [{season, round, race_name, distance}]  # exactly 3
```

## Data notes

- **Sources:** Jolpica (Ergast mirror) for per-driver grid/position/laps/status/time (1950-2026,
  no key); FastF1's `track_status_data()` for safety-car/VSC/red-flag counts during training
  (2018-2026, public static files); OpenF1 `race_control` for the same counts at inference time
  (2023-2026, no key for historical data -- this is what the frontend calls).
- **Training set:** 186 races, seasons 2018-2026, main races only (no sprints).
- **2021 Belgian Grand Prix excluded.** That race was declared official after ~3 laps behind
  the safety car in heavy rain, so the classified "race time" is a few minutes rather than a
  normal ~50min-4h10m race -- it fails `build_pipeline.py`'s winner `time_millis` sanity bound
  and is dropped as a shortened/anomalous race (see `validate_and_fix_race` in `fetch_data.py`).
- **OpenF1/FastF1 counting agreement: 78/84** 2023-2026 races checked during training (see
  `data/neutralization_mismatches.csv`). The 6 disagreements are documented, not bugs -- see
  "Known residual mismatch" #1 and #2 in `data/COUNTING_RULES.md`: (1) a safety car leading the
  field back out after a red flag sometimes has no explicit `SAFETY CAR DEPLOYED` message, so
  FastF1's count can run 1 higher than OpenF1's; (2) a re-issued deployment message on a
  different lap can make OpenF1's count run 1 higher than FastF1's. Both directions occur, so
  they don't net out in aggregate.
- **Status mapping:** raw Jolpica `status` strings collapse to `finished | lapped | retired |
  dns | dsq` via `normalize_status()` in `pipeline_def.py` (case-insensitive, whitespace-trimmed
  `"+N Lap(s)"`/`"Lapped"` -> `lapped`; `"Did not start"`/`"Did not qualify"`/`"Did not
  prequalify"`/`"Withdrew"` -> `dns`; `"Disqualified"`/`"Excluded"` -> `dsq`; everything else,
  including all era-specific mechanical-failure strings and `"Not classified"`, -> `retired`).
  54 distinct raw strings were observed 2018-2026 (`data/status_counts.csv`).

## Postman

1. Open Postman -> Import -> select `postman/race-chaos.postman_collection.json`.
2. Edit the collection variable `baseUrl` to the deployed Modal URL (never localhost).
3. Run the 4 requests in order: Health -> Pipeline info -> Score race (valid) -> Score race
   (invalid). Each has `pm.test` assertions in its Tests tab; a first request after Modal has
   scaled to zero may be slow (cold start) -- rerun if it times out.
4. Save screenshots of all 4 responses (with the Test Results panel visible) to
   `postman/screenshots/`.

## Before grading

- [ ] Rebuild the pipeline (`python fetch_data.py && python build_pipeline.py`) to pick up the
      latest completed 2026 rounds, then `modal deploy modal_serve.py` again.
- [ ] Consider setting `min_containers=1` on the Modal function (or a longer
      `scaledown_window`) so the grader's first request isn't a cold start.
- [ ] Set `NEXT_PUBLIC_CHAOS_API_URL` in the Vercel project's environment variables to the
      (re-)deployed Modal URL, and redeploy the frontend if it changed.
- [ ] Confirm the `sync-races` GitHub workflow has run recently so the Supabase project (used
      for race selection) hasn't paused from a week of inactivity.
- [ ] Re-check that the Modal API URL, `/docs` URL, and Vercel URL in the table above are live.
