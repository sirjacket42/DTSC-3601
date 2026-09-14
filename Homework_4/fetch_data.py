"""
fetch_data.py -- Homework 4 "Race Chaos Index" data pipeline.

Builds homework_4/data/training_races.json from three sources:

  1. Jolpica (Ergast mirror)  -- per-driver race results (grid, position, laps,
     status, Time.millis) for every main-race round, 2018-current season.
  2. FastF1 (`session.track_status`) -- authoritative safety-car / VSC / red
     flag deployment counts used as the *training* labels.
  3. OpenF1 (`race_control`) -- an independent count of the same events using
     only text a TypeScript frontend can reproduce at inference time; used
     purely as a train/serve consistency check (never used as a training
     label). Mismatches are written to data/neutralization_mismatches.csv.

Every raw HTTP response is cached to disk under data/raw/ so re-running the
script only fills in what's missing (no re-fetching, no re-hitting rate
limits). Long-running phases (FastF1 track-status extraction in particular)
persist a small per-race summary the moment it's computed, so an interrupted
run resumes almost instantly.

Usage:
    .venv/Scripts/python fetch_data.py
    .venv/Scripts/python fetch_data.py --seasons 2018-2026
    .venv/Scripts/python fetch_data.py --seasons 2023,2024,2025
"""

from __future__ import annotations

import argparse
import csv
import json
import re
import sys
import time
import warnings
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

import requests

# --------------------------------------------------------------------------
# Paths / constants
# --------------------------------------------------------------------------

ROOT = Path(__file__).resolve().parent
DATA_DIR = ROOT / "data"
RAW_DIR = DATA_DIR / "raw"
JOLPICA_DIR = RAW_DIR / "jolpica"
FASTF1_CACHE_DIR = RAW_DIR / "fastf1"
FASTF1_SUMMARY_DIR = RAW_DIR / "fastf1_summary"
OPENF1_DIR = RAW_DIR / "openf1"

for d in (JOLPICA_DIR, FASTF1_CACHE_DIR, FASTF1_SUMMARY_DIR, OPENF1_DIR):
    d.mkdir(parents=True, exist_ok=True)

JOLPICA_BASE = "https://api.jolpi.ca/ergast/f1"
OPENF1_BASE = "https://api.openf1.org/v1"

# Descriptive User-Agent (no personal contact info -- generic project identifier).
USER_AGENT = (
    "dtsc3601-homework4-race-chaos-index/1.0 "
    "(+https://github.com/sirjacket42; educational project, UNC Charlotte DTSC 3601)"
)

JOLPICA_MIN_INTERVAL = 1.5  # seconds between Jolpica requests
OPENF1_MIN_INTERVAL = 0.4   # seconds between OpenF1 requests

# Contract bounds (must match IDEA_BRIEF.md "Input contract").
RESULTS_MIN, RESULTS_MAX = 10, 26
GRID_MIN, GRID_MAX = 0, 30
POSITION_MIN, POSITION_MAX = 1, 30
LAPS_MIN, LAPS_MAX = 0, 100
TIME_MIN, TIME_MAX = 3_000_000, 15_000_000
SC_MIN, SC_MAX = 0, 10
VSC_MIN, VSC_MAX = 0, 10
RED_MIN, RED_MAX = 0, 5

STATUS_CATEGORIES = ("finished", "lapped", "retired", "dns", "dsq")

OPENF1_FIRST_SEASON = 2023

DEFAULT_SEASON_RANGE = "2018-2026"


# --------------------------------------------------------------------------
# Status normalization -- prefer pipeline_def.normalize_status if importable,
# fall back to a local copy of the same mapping otherwise. The build script
# must never hard-fail just because pipeline_def.py isn't written yet.
# --------------------------------------------------------------------------

_EXTERNAL_NORMALIZER = None
try:
    from pipeline_def import normalize_status as _EXTERNAL_NORMALIZER  # type: ignore
    print("[status] using pipeline_def.normalize_status", file=sys.stderr)
except Exception as exc:  # pragma: no cover - depends on parallel agent's file
    print(f"[status] pipeline_def.normalize_status unavailable ({exc!r}); "
          f"using local fallback mapping", file=sys.stderr)


_LAP_STATUS_RE = re.compile(r"^\+\s*\d+\s*lap(s)?$", re.IGNORECASE)


def _local_normalize_status(raw_status: str) -> str:
    """Local fallback copy of the status -> category mapping described in
    IDEA_BRIEF.md. Kept in sync with pipeline_def.normalize_status by design
    (same rules); used only when that module can't be imported."""
    s = (raw_status or "").strip()
    sl = s.lower()

    if sl == "finished":
        return "finished"
    if sl == "lapped" or _LAP_STATUS_RE.match(sl):
        return "lapped"
    if sl in ("did not start", "did not qualify", "did not prequalify", "withdrew"):
        return "dns"
    if sl in ("disqualified", "excluded"):
        return "dsq"
    # Everything else, including "Not classified" and all specific
    # mechanical/accident causes ("Engine", "Brakes", "Collision", ...),
    # collapses to "retired".
    return "retired"


def normalize_status(raw_status: str) -> str:
    if _EXTERNAL_NORMALIZER is not None:
        try:
            result = _EXTERNAL_NORMALIZER(raw_status)
            if result in STATUS_CATEGORIES:
                return result
            print(f"[status] pipeline_def.normalize_status returned "
                  f"unexpected value {result!r} for {raw_status!r}; "
                  f"falling back locally", file=sys.stderr)
        except Exception as exc:
            print(f"[status] pipeline_def.normalize_status raised {exc!r} "
                  f"for {raw_status!r}; falling back locally", file=sys.stderr)
    return _local_normalize_status(raw_status)


# --------------------------------------------------------------------------
# HTTP helpers: cached, throttled, retrying GET-JSON
# --------------------------------------------------------------------------

class Throttle:
    def __init__(self, min_interval: float):
        self.min_interval = min_interval
        self._last = 0.0

    def wait(self):
        now = time.monotonic()
        elapsed = now - self._last
        remaining = self.min_interval - elapsed
        if remaining > 0:
            time.sleep(remaining)
        self._last = time.monotonic()


_jolpica_session = requests.Session()
_jolpica_session.headers.update({"User-Agent": USER_AGENT, "Accept": "application/json"})
_jolpica_throttle = Throttle(JOLPICA_MIN_INTERVAL)

_openf1_session = requests.Session()
_openf1_session.headers.update({"User-Agent": USER_AGENT, "Accept": "application/json"})
_openf1_throttle = Throttle(OPENF1_MIN_INTERVAL)


def fetch_json_cached(url: str, cache_path: Path, session: requests.Session,
                       throttle: Throttle, max_retries: int = 6,
                       base_backoff: float = 2.0) -> dict:
    """GET url as JSON, using cache_path as an on-disk cache. Retries with
    exponential backoff on 429/5xx, honoring Retry-After when present."""
    if cache_path.exists():
        with open(cache_path, "r", encoding="utf-8") as f:
            return json.load(f)

    backoff = base_backoff
    last_exc = None
    for attempt in range(1, max_retries + 1):
        throttle.wait()
        try:
            resp = session.get(url, timeout=30)
        except requests.RequestException as exc:
            last_exc = exc
            print(f"[http] network error on {url} (attempt {attempt}/{max_retries}): {exc}",
                  file=sys.stderr)
            time.sleep(backoff)
            backoff = min(backoff * 2, 60)
            continue

        if resp.status_code == 200:
            data = resp.json()
            cache_path.parent.mkdir(parents=True, exist_ok=True)
            tmp_path = cache_path.with_suffix(cache_path.suffix + ".tmp")
            with open(tmp_path, "w", encoding="utf-8") as f:
                json.dump(data, f)
            tmp_path.replace(cache_path)
            return data

        if resp.status_code == 429 or 500 <= resp.status_code < 600:
            retry_after = resp.headers.get("Retry-After")
            sleep_s = float(retry_after) if retry_after else backoff
            print(f"[http] {resp.status_code} on {url} (attempt {attempt}/{max_retries}); "
                  f"sleeping {sleep_s:.1f}s", file=sys.stderr)
            time.sleep(sleep_s)
            backoff = min(backoff * 2, 60)
            continue

        # Non-retryable HTTP error.
        resp.raise_for_status()

    raise RuntimeError(f"Failed to fetch {url} after {max_retries} retries "
                        f"(last_exc={last_exc!r})")


def safe_filename(*parts) -> str:
    return "_".join(str(p) for p in parts)


# --------------------------------------------------------------------------
# Phase 1: Jolpica schedule + results -> parsed race rows
# --------------------------------------------------------------------------

def fetch_schedule(season: int) -> list[dict]:
    url = f"{JOLPICA_BASE}/{season}.json"
    cache_path = JOLPICA_DIR / f"{season}_schedule.json"
    data = fetch_json_cached(url, cache_path, _jolpica_session, _jolpica_throttle)
    return data["MRData"]["RaceTable"]["Races"]


def fetch_results(season: int, round_: int) -> list[dict]:
    """Returns the list under MRData.RaceTable.Races (empty if not yet run)."""
    url = f"{JOLPICA_BASE}/{season}/{round_}/results.json?limit=100"
    cache_path = JOLPICA_DIR / f"{season}_{round_}_results.json"
    data = fetch_json_cached(url, cache_path, _jolpica_session, _jolpica_throttle)
    if not data["MRData"]["RaceTable"]["Races"]:
        # An empty response means "not published yet" -- never trust it from
        # the cache, or rounds run after the first fetch are skipped forever.
        cache_path.unlink(missing_ok=True)
        data = fetch_json_cached(url, cache_path, _jolpica_session, _jolpica_throttle)
    return data["MRData"]["RaceTable"]["Races"]


def parse_result_row(r: dict, status_counter: Counter) -> dict:
    raw_status = r.get("status", "")
    category = normalize_status(raw_status)
    status_counter[(raw_status, category)] += 1

    time_millis = None
    time_obj = r.get("Time")
    if time_obj and "millis" in time_obj:
        try:
            time_millis = int(time_obj["millis"])
        except (TypeError, ValueError):
            time_millis = None

    return {
        "grid": int(r["grid"]),
        "position": int(r["position"]),
        "laps": int(r["laps"]),
        "status": category,
        "raw_status": raw_status,
        "time_millis": time_millis,
    }


def collect_jolpica_races(seasons: list[int], status_counter: Counter) -> list[dict]:
    """Fetch schedules + results for every season, skipping rounds whose
    results aren't published yet (empty Races list from Jolpica)."""
    races = []
    for season in seasons:
        print(f"[jolpica] season {season}: fetching schedule...")
        schedule = fetch_schedule(season)
        n_published = 0
        for entry in schedule:
            round_ = int(entry["round"])
            race_name = entry["raceName"]
            date = entry.get("date")
            circuit = entry.get("Circuit", {})
            result_races = fetch_results(season, round_)
            if not result_races:
                print(f"[jolpica]   {season} R{round_} {race_name}: no results yet, skipping")
                continue
            result_race = result_races[0]
            rows = [parse_result_row(r, status_counter) for r in result_race.get("Results", [])]
            if not rows:
                print(f"[jolpica]   {season} R{round_} {race_name}: empty results, skipping")
                continue
            races.append({
                "season": season,
                "round": round_,
                "race_name": race_name,
                "date": date,
                "circuit_id": circuit.get("circuitId"),
                "circuit_name": circuit.get("circuitName"),
                "locality": circuit.get("Location", {}).get("locality"),
                "country": circuit.get("Location", {}).get("country"),
                "rows": rows,
            })
            n_published += 1
            print(f"[jolpica]   {season} R{round_} {race_name}: {len(rows)} classified rows")
        print(f"[jolpica] season {season}: {n_published} published races")
    return races


# --------------------------------------------------------------------------
# Phase 2: FastF1 track-status neutralization counts (training labels)
# --------------------------------------------------------------------------

def dedupe_consecutive(seq: list) -> list:
    out = []
    for item in seq:
        if not out or out[-1] != item:
            out.append(item)
    return out


def count_transitions_from_status_series(statuses: list[str]) -> tuple[int, int, int]:
    """Count SC deployments (transitions into '4'), VSC deployments
    (transitions into '6', not '7' VSC-ending), and red flags (transitions
    into '5'), given the raw (non-deduped) Status column as strings."""
    deduped = dedupe_consecutive([str(s) for s in statuses])
    sc = deduped.count("4")
    vsc = deduped.count("6")
    red = deduped.count("5")
    return sc, vsc, red


def fastf1_rc_dict_to_rows(rc_data: dict) -> list[dict]:
    """Convert FastF1's race_control_messages() dict-of-parallel-lists into
    the same row shape OpenF1 uses (lowercase keys), so
    count_openf1_neutralizations() can be reused verbatim as the fallback
    counting rule (see data/COUNTING_RULES.md: both rules are one rule)."""
    n = len(rc_data.get("Time", []))
    rows = []
    for i in range(n):
        rows.append({
            "date": rc_data["Time"][i].isoformat() if hasattr(rc_data["Time"][i], "isoformat")
                    else str(rc_data["Time"][i]),
            "category": rc_data.get("Category", [None] * n)[i],
            "message": rc_data.get("Message", [None] * n)[i],
            "flag": rc_data.get("Flag", [None] * n)[i],
            "lap_number": rc_data.get("Lap", [None] * n)[i],
        })
    return rows


def clip_counts(sc: int, vsc: int, red: int, context: str) -> tuple[int, int, int]:
    clipped_sc = max(SC_MIN, min(sc, SC_MAX))
    clipped_vsc = max(VSC_MIN, min(vsc, VSC_MAX))
    clipped_red = max(RED_MIN, min(red, RED_MAX))
    if (clipped_sc, clipped_vsc, clipped_red) != (sc, vsc, red):
        print(f"[fastf1] {context}: clipped counts sc={sc}->{clipped_sc} "
              f"vsc={vsc}->{clipped_vsc} red={red}->{clipped_red}", file=sys.stderr)
    return clipped_sc, clipped_vsc, clipped_red


# FastF1's own rate limiter is a hard, process-global counter (500 calls/h to
# any single API host, shared across every fastf1.api.* call for the life of
# the process -- see .venv/Lib/site-packages/fastf1/req.py). The old
# implementation called session.load(laps=True, ...), which fires off ~8
# HTTP requests per race (session_info, driver_info, session_status_data,
# lap_count, track_status_data, timing_data, timing_app_data,
# race_control_messages) and blew through that budget after ~110 races.
#
# We only actually need one data channel (track_status), so we call
# fastf1.api.track_status_data() directly -- ONE request per race -- via
# session.api_path, which fastf1.core.Session computes purely from schedule
# metadata at construction time (no network at all). The season's event
# schedule is fetched once per season and reused for every round in that
# season (see get_fastf1_event_schedule() for why that's the plain default
# backend rather than backend='f1timing'). Total call volume for the whole
# 2018-2026 run is therefore ~(9 schedule calls + ~190 track_status calls)
# -- comfortably under 500/h
# even with zero pacing.
FASTF1_MIN_INTERVAL = 0.5
_fastf1_throttle = Throttle(FASTF1_MIN_INTERVAL)
_fastf1_schedule_cache: dict[int, object] = {}


def call_with_rate_limit_retry(func, *args, max_wait_seconds: float = 7200,
                                max_transient_retries: int = 4,
                                transient_sleep: float = 8.0, **kwargs):
    """Call func(*args, **kwargs) with two independent retry policies:

    - fastf1's own RateLimitExceededError (hard, process-global 500-calls/h
      counter -- see fastf1/req.py) is always retryable: sleep 65s and try
      again, willing to wait up to `max_wait_seconds` (default 2h; the
      limiter is a rolling 1h window so waiting it out always eventually
      works). Never treated as a terminal failure.
    - SessionNotAvailableError sometimes fires transiently (observed on a
      real 2018-2026 run: 3 races failed this way on first attempt and
      succeeded immediately on manual retry secondslater -- a server-side
      hiccup, not a real data gap). Retried a bounded number of times with a
      short sleep before being allowed to propagate as a real failure.
    """
    from fastf1.exceptions import RateLimitExceededError
    from fastf1.api import SessionNotAvailableError
    waited = 0.0
    sleep_s = 65.0
    transient_attempts = 0
    while True:
        try:
            return func(*args, **kwargs)
        except RateLimitExceededError as exc:
            if waited >= max_wait_seconds:
                raise
            print(f"[fastf1] rate limit hit ({exc}); sleeping {sleep_s:.0f}s "
                  f"before retry (waited {waited:.0f}s so far)...", file=sys.stderr)
            time.sleep(sleep_s)
            waited += sleep_s
        except SessionNotAvailableError:
            transient_attempts += 1
            if transient_attempts > max_transient_retries:
                raise
            print(f"[fastf1] transient SessionNotAvailableError on "
                  f"{getattr(func, '__name__', func)} (attempt "
                  f"{transient_attempts}/{max_transient_retries}); "
                  f"sleeping {transient_sleep:.0f}s before retry...", file=sys.stderr)
            time.sleep(transient_sleep)


def get_fastf1_event_schedule(season: int):
    """Fetch (once per season, in-memory-cached for the life of this
    process) the full event schedule and reuse it across every round in the
    season, so constructing Session objects for individual rounds costs zero
    additional network calls.

    NOTE: backend='f1timing' was tried first (per the "avoid Ergast per
    race" fix) but turned out to silently DROP early rounds for at least one
    season (2024: only rounds 10-24 were listed, 1-9 missing entirely --
    apparently that backend's index only reflects timing-data availability
    at some past snapshot). The default backend ('fastf1', covers 2018+ per
    fastf1's own docs) was verified to return the complete round list for
    2018, 2023, 2024, 2025, and 2026, so it's used here instead. This is
    still only ONE call per season (~9 calls total for 2018-2026) regardless
    of backend, so it was never the source of the rate-limit problem -- the
    problem was always the ~8-calls-per-race session.load(), which this
    module no longer uses at all.
    """
    if season not in _fastf1_schedule_cache:
        import fastf1
        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            _fastf1_throttle.wait()
            schedule = call_with_rate_limit_retry(fastf1.get_event_schedule, season)
        _fastf1_schedule_cache[season] = schedule
    return _fastf1_schedule_cache[season]


def get_fastf1_summary(season: int, round_: int, race_name: str) -> dict:
    """Returns and persists {"ok": bool, "safety_cars", "virtual_safety_cars",
    "red_flags", "method", "error"} for one race. Cached on disk so a
    resumed run never re-fetches a race that already succeeded.

    Only a cached result with ok == True is ever trusted -- a previously
    failed/partial attempt (e.g. one that hit the rate limit before this fix)
    is always retried, never treated as a permanent negative cache entry."""
    summary_path = FASTF1_SUMMARY_DIR / f"{season}_{round_}.json"
    if summary_path.exists():
        with open(summary_path, "r", encoding="utf-8") as f:
            cached = json.load(f)
        if cached.get("ok"):
            return cached
        # else: fall through and recompute -- never trust a cached failure.

    import fastf1.api
    from fastf1.api import SessionNotAvailableError

    result = {"season": season, "round": round_, "race_name": race_name,
              "ok": False, "safety_cars": None, "virtual_safety_cars": None,
              "red_flags": None, "method": None, "error": None}

    t0 = time.time()
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            schedule = get_fastf1_event_schedule(season)
            event = schedule.get_event_by_round(round_)
            session = event.get_session("R")

        try:
            _fastf1_throttle.wait()
            ts_data = call_with_rate_limit_retry(
                fastf1.api.track_status_data, session.api_path)
            statuses = ts_data.get("Status") or []
            if not statuses:
                raise RuntimeError("empty track_status data")
            sc, vsc, red = count_transitions_from_status_series(statuses)
            result["method"] = "track_status_data"
        except (SessionNotAvailableError, RuntimeError, KeyError) as exc_ts:
            print(f"[fastf1] {season} R{round_} {race_name}: track_status_data "
                  f"unavailable ({exc_ts!r}); falling back to "
                  f"race_control_messages", file=sys.stderr)
            _fastf1_throttle.wait()
            rc_data = call_with_rate_limit_retry(
                fastf1.api.race_control_messages, session.api_path)
            rows = fastf1_rc_dict_to_rows(rc_data)
            sc, vsc, red = count_openf1_neutralizations(rows)
            result["method"] = "race_control_fallback"

        sc, vsc, red = clip_counts(sc, vsc, red, f"{season} R{round_} {race_name}")
        result.update(ok=True, safety_cars=sc, virtual_safety_cars=vsc, red_flags=red)
        dt = time.time() - t0
        print(f"[fastf1] {season} R{round_} {race_name}: SC={sc} VSC={vsc} RED={red} "
              f"method={result['method']} ({dt:.1f}s)")
    except Exception as exc:
        result["error"] = repr(exc)
        dt = time.time() - t0
        print(f"[fastf1] {season} R{round_} {race_name}: FAILED ({exc!r}) ({dt:.1f}s)",
              file=sys.stderr)

    # ok is always accurate here (True only on a genuine successful count);
    # a failure is persisted too, but only as ok:false so the next run's
    # cache check above will retry it rather than trust it.
    summary_path.parent.mkdir(parents=True, exist_ok=True)
    with open(summary_path, "w", encoding="utf-8") as f:
        json.dump(result, f)
    return result


def run_fastf1_phase(races: list[dict]) -> dict[tuple[int, int], dict]:
    import fastf1
    fastf1.Cache.enable_cache(str(FASTF1_CACHE_DIR))
    try:
        fastf1.logger.set_log_level("WARNING")
    except Exception:
        pass

    summaries = {}
    total = len(races)
    for i, race in enumerate(races, 1):
        key = (race["season"], race["round"])
        summaries[key] = get_fastf1_summary(race["season"], race["round"], race["race_name"])
        if i % 10 == 0 or i == total:
            print(f"[fastf1] progress: {i}/{total} races processed")
    return summaries


# --------------------------------------------------------------------------
# Phase 3: OpenF1 race_control cross-check (2023+ only)
# --------------------------------------------------------------------------

def fetch_openf1_sessions(year: int) -> list[dict]:
    url = f"{OPENF1_BASE}/sessions?year={year}&session_name=Race"
    cache_path = OPENF1_DIR / f"{year}_sessions.json"
    return fetch_json_cached(url, cache_path, _openf1_session, _openf1_throttle)


def fetch_openf1_race_control(session_key: int) -> list[dict]:
    url = f"{OPENF1_BASE}/race_control?session_key={session_key}"
    cache_path = OPENF1_DIR / f"rc_{session_key}.json"
    return fetch_json_cached(url, cache_path, _openf1_session, _openf1_throttle)


def match_openf1_session(race: dict, sessions_by_year: dict[int, list[dict]]) -> dict | None:
    season = race["season"]
    sessions = sessions_by_year.get(season, [])
    race_date = (race.get("date") or "")[:10]
    exact = [s for s in sessions if (s.get("date_start") or "")[:10] == race_date]
    if len(exact) == 1:
        return exact[0]
    if len(exact) > 1:
        # Should not normally happen (one GP per calendar date); disambiguate
        # by circuit token overlap as a tie-breaker.
        for s in exact:
            hay = f"{s.get('location','')} {s.get('country_name','')}".lower()
            if (race.get("locality") or "").lower() in hay or \
               (race.get("country") or "").lower() in hay:
                return s
        return exact[0]

    # No exact date match -- try +/-1 day with circuit/country token overlap.
    from datetime import date as _date, timedelta as _timedelta
    try:
        d = _date.fromisoformat(race_date)
    except ValueError:
        return None
    candidates = []
    for delta in (-1, 1):
        target = (d + _timedelta(days=delta)).isoformat()
        candidates.extend(s for s in sessions if (s.get("date_start") or "")[:10] == target)
    for s in candidates:
        hay = f"{s.get('location','')} {s.get('country_name','')}".lower()
        if (race.get("locality") or "").lower() in hay or \
           (race.get("country") or "").lower() in hay:
            print(f"[openf1] fuzzy-matched {race['season']} R{race['round']} "
                  f"{race['race_name']} to session {s['session_key']} via +/-1 day + circuit")
            return s
    return None


def count_openf1_neutralizations(messages: list[dict]) -> tuple[int, int, int]:
    """See data/COUNTING_RULES.md for the canonical description of this rule.

    Discovered while probing real data: OpenF1's race_control wording is NOT
    stable across seasons. 2023-2025 uses full text ("SAFETY CAR DEPLOYED",
    "VIRTUAL SAFETY CAR DEPLOYED", flag == "RED" + message "RED FLAG").
    2026 uses shorthand for VSC ("VSC DEPLOYED" / "VSC ENDING") and reports
    red flags as category "Other" with message "RED FLAG - RACE SUSPENDED"
    and flag == None. The rule below is written to match both eras: gate on
    category == "SafetyCar" (this never fires for unrelated messages that
    merely mention "safety car", e.g. penalty/investigation text) and accept
    either "VIRTUAL" or "VSC" as the virtual-safety-car marker; gate red
    flags on flag == "RED" OR the message *starting with* "RED FLAG" (this
    excludes unrelated messages like "... RED FLAG INFRINGEMENT" investigation
    notes, which never start with "RED FLAG").
    """
    sc_laps, vsc_laps, red_laps = [], [], []
    for r in sorted(messages, key=lambda x: x.get("date") or ""):
        category = r.get("category") or ""
        msg = (r.get("message") or "").upper()
        flag = (r.get("flag") or "").upper()
        lap = r.get("lap_number")
        if category == "SafetyCar" and "DEPLOYED" in msg:
            if "VIRTUAL" in msg or "VSC" in msg:
                if not vsc_laps or vsc_laps[-1] != lap:
                    vsc_laps.append(lap)
            else:
                if not sc_laps or sc_laps[-1] != lap:
                    sc_laps.append(lap)
        if flag == "RED" or msg.startswith("RED FLAG"):
            if not red_laps or red_laps[-1] != lap:
                red_laps.append(lap)
    return len(sc_laps), len(vsc_laps), len(red_laps)


def run_openf1_phase(races: list[dict]) -> list[dict]:
    """Returns a list of mismatch rows (only for races reaching this phase);
    also requires fastf1 summaries to already be attached to `races` as
    race["fastf1"]."""
    eligible = [r for r in races if r["season"] >= OPENF1_FIRST_SEASON]
    years = sorted(set(r["season"] for r in eligible))
    sessions_by_year = {}
    for year in years:
        print(f"[openf1] fetching session list for {year}...")
        sessions_by_year[year] = fetch_openf1_sessions(year)

    mismatch_rows = []
    unmatched = []
    for race in eligible:
        session = match_openf1_session(race, sessions_by_year)
        if session is None:
            unmatched.append(race)
            print(f"[openf1] no session match for {race['season']} R{race['round']} "
                  f"{race['race_name']}", file=sys.stderr)
            continue
        session_key = session["session_key"]
        messages = fetch_openf1_race_control(session_key)
        of1_sc, of1_vsc, of1_red = count_openf1_neutralizations(messages)

        ff1 = race.get("fastf1") or {}
        ff1_sc = ff1.get("safety_cars")
        ff1_vsc = ff1.get("virtual_safety_cars")
        ff1_red = ff1.get("red_flags")

        matches = (ff1_sc == of1_sc and ff1_vsc == of1_vsc and ff1_red == of1_red)
        row = {
            "season": race["season"], "round": race["round"], "race_name": race["race_name"],
            "openf1_session_key": session_key,
            "fastf1_sc": ff1_sc, "fastf1_vsc": ff1_vsc, "fastf1_red": ff1_red,
            "openf1_sc": of1_sc, "openf1_vsc": of1_vsc, "openf1_red": of1_red,
            "match": matches,
        }
        mismatch_rows.append(row)
        if not matches:
            print(f"[openf1] MISMATCH {race['season']} R{race['round']} {race['race_name']}: "
                  f"fastf1(sc={ff1_sc},vsc={ff1_vsc},red={ff1_red}) vs "
                  f"openf1(sc={of1_sc},vsc={of1_vsc},red={of1_red})")

    if unmatched:
        print(f"[openf1] {len(unmatched)} race(s) had no matching OpenF1 session "
              f"(likely a scheduling anomaly); see stderr log above")
    return mismatch_rows


# --------------------------------------------------------------------------
# Phase 4: validate + assemble training_races.json
# --------------------------------------------------------------------------

def validate_and_fix_race(race: dict) -> tuple[dict | None, list[str]]:
    """Returns (fixed_race_or_None, notes). If the race must be excluded,
    the first element is None and notes explains why."""
    notes = []
    rows = race["rows"]
    n = len(rows)

    if not (RESULTS_MIN <= n <= RESULTS_MAX):
        return None, [f"excluded: {n} results outside [{RESULTS_MIN},{RESULTS_MAX}]"]

    positions = [r["position"] for r in rows]
    if len(set(positions)) != len(positions):
        return None, ["excluded: duplicate finishing positions"]
    if positions.count(1) != 1:
        return None, ["excluded: not exactly one P1"]
    if any(not (POSITION_MIN <= p <= POSITION_MAX) for p in positions):
        return None, [f"excluded: position outside [{POSITION_MIN},{POSITION_MAX}]"]

    for r in rows:
        if not (GRID_MIN <= r["grid"] <= GRID_MAX):
            return None, [f"excluded: grid {r['grid']} outside [{GRID_MIN},{GRID_MAX}]"]
        if not (LAPS_MIN <= r["laps"] <= LAPS_MAX):
            return None, [f"excluded: laps {r['laps']} outside [{LAPS_MIN},{LAPS_MAX}]"]

    winner = next(r for r in rows if r["position"] == 1)
    if winner["time_millis"] is not None and not (TIME_MIN <= winner["time_millis"] <= TIME_MAX):
        return None, [f"excluded: winner time_millis={winner['time_millis']} outside "
                       f"[{TIME_MIN},{TIME_MAX}] (shortened/anomalous race)"]

    any_finished_with_time = False
    for r in rows:
        if r["time_millis"] is not None and not (TIME_MIN <= r["time_millis"] <= TIME_MAX):
            notes.append(f"fixed: nulled out-of-range time_millis={r['time_millis']} "
                         f"for pos={r['position']} status={r['status']}")
            r["time_millis"] = None
        if r["status"] == "finished" and r["time_millis"] is not None:
            any_finished_with_time = True

    if not any_finished_with_time:
        return None, ["excluded: no finished row retained a valid time_millis"]

    track_status = race.get("fastf1") or {}
    sc = track_status.get("safety_cars")
    vsc = track_status.get("virtual_safety_cars")
    red = track_status.get("red_flags")
    if sc is None or vsc is None or red is None:
        return None, ["excluded: no usable FastF1/fallback neutralization counts"]

    clean_rows = [
        {
            "grid": r["grid"],
            "position": r["position"],
            "laps": r["laps"],
            "status": r["status"],
            "time_millis": r["time_millis"],
        }
        for r in rows
    ]
    fixed_race = {
        "season": race["season"],
        "round": race["round"],
        "race_name": race["race_name"],
        "race": {
            "results": clean_rows,
            "track_status": {
                "safety_cars": sc,
                "virtual_safety_cars": vsc,
                "red_flags": red,
            },
        },
    }
    return fixed_race, notes


# --------------------------------------------------------------------------
# Output writers
# --------------------------------------------------------------------------

def write_status_counts_csv(status_counter: Counter, path: Path):
    with open(path, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["raw_status", "mapped_category", "count"])
        for (raw_status, category), count in sorted(status_counter.items(),
                                                      key=lambda kv: -kv[1]):
            writer.writerow([raw_status, category, count])


def write_mismatches_csv(mismatch_rows: list[dict], path: Path):
    fieldnames = ["season", "round", "race_name", "openf1_session_key",
                  "fastf1_sc", "fastf1_vsc", "fastf1_red",
                  "openf1_sc", "openf1_vsc", "openf1_red", "match"]
    with open(path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for row in mismatch_rows:
            writer.writerow(row)


def write_counting_rules_md(path: Path, status_counter: Counter):
    distinct_statuses = sorted(set(raw for raw, _ in status_counter.keys()))
    lines = []
    lines.append("# Neutralization counting rules & status mapping\n")
    lines.append("Generated by `fetch_data.py`. This is the exact logic a TypeScript ")
    lines.append("frontend must port to compute `track_status` from OpenF1 at inference ")
    lines.append("time so it matches what the model was trained on (FastF1 track_status, ")
    lines.append("cross-checked against this same OpenF1 rule during training).\n")

    lines.append("## Status -> category mapping\n")
    lines.append("Applied to the Jolpica `status` string for each driver result row. ")
    lines.append("Case-insensitive; trim whitespace first.\n")
    lines.append("```")
    lines.append('if status.lower() == "finished": category = "finished"')
    lines.append('elif status.lower() == "lapped" or /^\\+\\s*\\d+\\s*lap(s)?$/i.test(status):')
    lines.append('    category = "lapped"')
    lines.append('elif status.lower() in ["did not start", "did not qualify",')
    lines.append('                        "did not prequalify", "withdrew"]:')
    lines.append('    category = "dns"')
    lines.append('elif status.lower() in ["disqualified", "excluded"]:')
    lines.append('    category = "dsq"')
    lines.append('else:')
    lines.append('    category = "retired"   # includes "Not classified" and all')
    lines.append('                            # cause-specific strings (Engine, Brakes, ...)')
    lines.append("```\n")
    lines.append(f"Distinct raw status strings observed 2018-2026 ({len(distinct_statuses)}):\n")
    lines.append("```")
    for s in distinct_statuses:
        lines.append(s)
    lines.append("```\n")

    lines.append("## OpenF1 `race_control` neutralization counting rule\n")
    lines.append("**Important discovery from probing real 2023-2026 data: OpenF1's message ")
    lines.append("wording is NOT stable across seasons.** 2023-2025 races use the full text ")
    lines.append("`SAFETY CAR DEPLOYED` / `VIRTUAL SAFETY CAR DEPLOYED` and represent red ")
    lines.append("flags as `category: \"Flag\", flag: \"RED\", message: \"RED FLAG\"`. Starting ")
    lines.append("in the 2026 season, VSC messages shorten to `VSC DEPLOYED` / `VSC ENDING`, ")
    lines.append("and red flags instead appear as `category: \"Other\", flag: null, ")
    lines.append("message: \"RED FLAG - RACE SUSPENDED\"`. The rule below is written to match ")
    lines.append("both eras. Do not simplify it back to the 2023-era-only wording.\n")
    lines.append("Input: all rows from `GET /v1/race_control?session_key=<race session key>`, ")
    lines.append("sorted ascending by `date`. Maintain three running \"last counted lap\" ")
    lines.append("trackers (`lastScLap`, `lastVscLap`, `lastRedLap`), all initially unset.\n")
    lines.append("```ts")
    lines.append("for (const r of sortedByDate(messages)) {")
    lines.append("  const category = r.category ?? '';")
    lines.append("  const msg = (r.message ?? '').toUpperCase();")
    lines.append("  const flag = (r.flag ?? '').toUpperCase();")
    lines.append("  const lap = r.lap_number;")
    lines.append("")
    lines.append("  // Gate on category === 'SafetyCar' so unrelated messages that merely")
    lines.append("  // mention 'safety car' (e.g. penalty/investigation notes, which use")
    lines.append("  // category 'Other') can never be miscounted as a deployment.")
    lines.append("  if (category === 'SafetyCar' && msg.includes('DEPLOYED')) {")
    lines.append("    if (msg.includes('VIRTUAL') || msg.includes('VSC')) {")
    lines.append("      if (lastVscLap !== lap) { vscCount++; lastVscLap = lap; }")
    lines.append("    } else {")
    lines.append("      if (lastScLap !== lap) { scCount++; lastScLap = lap; }")
    lines.append("    }")
    lines.append("  }")
    lines.append("")
    lines.append("  // flag === 'RED' catches 2023-2025; startsWith('RED FLAG') also catches")
    lines.append("  // 2026's category:'Other' representation. startsWith (not includes)")
    lines.append("  // deliberately excludes unrelated messages like '... RED FLAG")
    lines.append("  // INFRINGEMENT' investigation notes, which never *start* with it.")
    lines.append("  if (flag === 'RED' || msg.startsWith('RED FLAG')) {")
    lines.append("    if (lastRedLap !== lap) { redCount++; lastRedLap = lap; }")
    lines.append("  }")
    lines.append("}")
    lines.append("```\n")
    lines.append("Notes:\n")
    lines.append("- `...ENDING` messages (`VSC ENDING` / `VIRTUAL SAFETY CAR ENDING`) are ")
    lines.append("  ignored entirely -- only `...DEPLOYED` messages count as a new period.")
    lines.append("- `SAFETY CAR IN THIS LAP` (category `SafetyCar`, no `DEPLOYED`) is ")
    lines.append("  correctly ignored -- it's an informational message, not a new deployment.")
    lines.append("- Dedupe is by `lap_number` equal to the previous counted event of the ")
    lines.append("  same type -- this collapses duplicate/re-broadcast messages for the ")
    lines.append("  same deployment without needing a time-window heuristic.")
    lines.append("- `flag` values seen in practice: GREEN, YELLOW, DOUBLE YELLOW, RED, ")
    lines.append("  CLEAR, BLUE, CHEQUERED, BLACK AND WHITE; only `RED` is counted here.")
    lines.append("- **Known residual mismatch (documented, not fixed):** when the safety ")
    lines.append("  car leads the field back out after a red flag ends, race control does ")
    lines.append("  not always re-issue an explicit `SAFETY CAR DEPLOYED` message (it's ")
    lines.append("  implied by the restart procedure). FastF1's `track_status` stream still ")
    lines.append("  shows a fresh transition into status `4` at that point, so on red-flag ")
    lines.append("  races the FastF1 safety-car count can be exactly 1 higher than the ")
    lines.append("  OpenF1 text-derived count. See data/neutralization_mismatches.csv for ")
    lines.append("  which races this affects -- it is a genuine race-control reporting gap, ")
    lines.append("  not a bug in either counting rule.")
    lines.append("- **Known residual mismatch #2 (documented, not fixed):** occasionally ")
    lines.append("  race control re-issues a second `SAFETY CAR DEPLOYED` message for the ")
    lines.append("  *same* physical deployment shortly before it comes back in (full SC has ")
    lines.append("  no explicit '...ENDING' message the way VSC does -- only an advisory ")
    lines.append("  'SAFETY CAR IN THIS LAP' -- so there is no clean signal to reset dedupe ")
    lines.append("  state). If that second message lands on a different lap than the first, ")
    lines.append("  the lap-based dedupe here counts it as a second deployment while ")
    lines.append("  FastF1's `track_status` (which only flips out of `SCDeployed` once, via ")
    lines.append("  `AllClear`) counts one continuous period. Net effect: OpenF1's SC count ")
    lines.append("  can be exactly 1 *higher* than FastF1's on the affected race -- the ")
    lines.append("  opposite direction from residual mismatch #1, so the two do not net out ")
    lines.append("  in aggregate; both are genuine, independent race-control artifacts.\n")

    lines.append("## FastF1 track-status counting rule (training labels)\n")
    lines.append("Input: `fastf1.api.track_status_data(session.api_path)` -- called ")
    lines.append("directly (one HTTP request) rather than via `session.load()`, which ")
    lines.append("issues ~8 requests per race and will trip FastF1's own rate limiter ")
    lines.append("(500 calls/h to any single API host, a hard process-global counter -- ")
    lines.append("see `fastf1/req.py`) well before a full 2018-2026 run completes. ")
    lines.append("`session.api_path` is available immediately after constructing the ")
    lines.append("`Session` (it's computed from already-fetched schedule metadata, no ")
    lines.append("network call). The season's event schedule is fetched once via ")
    lines.append("`fastf1.get_event_schedule(season)` (default backend -- ")
    lines.append("`backend='f1timing'` was tried first but silently drops early rounds for ")
    lines.append("at least one season, so the default is used instead) and reused for ")
    lines.append("every round in that season.\n")
    lines.append("`track_status_data()` returns a `Status` code string per timestamp:\n")
    lines.append("| Code | Meaning |")
    lines.append("|---|---|")
    lines.append("| 1 | AllClear |")
    lines.append("| 2 | Yellow |")
    lines.append("| 4 | SCDeployed |")
    lines.append("| 5 | Red |")
    lines.append("| 6 | VSCDeployed |")
    lines.append("| 7 | VSCEnding |\n")
    lines.append("Collapse consecutive duplicate status codes, then count occurrences of ")
    lines.append("`4` (safety_cars), `6` (virtual_safety_cars, `7` is the ending marker and ")
    lines.append("is never counted), and `5` (red_flags) in the collapsed sequence.\n")
    lines.append("If `track_status_data` is unavailable for a race (raises or returns no ")
    lines.append("rows), fall back to `fastf1.api.race_control_messages(session.api_path)` ")
    lines.append("(also one request) and apply the *exact same* rule as the OpenF1 rule ")
    lines.append("above (both are the same underlying race-control message family; the ")
    lines.append("field names just differ in capitalization, which the build script ")
    lines.append("normalizes before counting).\n")
    lines.append("**Rate limiting:** if FastF1's `RateLimitExceededError` fires anyway ")
    lines.append("(e.g. a concurrent process sharing the same limiter budget), the build ")
    lines.append("script treats it as retryable -- it sleeps ~65s and retries, up to 2 ")
    lines.append("hours total, and never caches a rate-limited attempt as a successful ")
    lines.append("(`ok: true`) result. Separately, `SessionNotAvailableError` (observed to ")
    lines.append("be transient for a handful of races on a real run -- it succeeded on ")
    lines.append("manual retry seconds later) gets a short bounded retry (a few attempts, ")
    lines.append("~8s apart) before being treated as a real failure. Both are build-time-")
    lines.append("only concerns; neither affects the trained model, the API, or the ")
    lines.append("frontend.\n")

    path.write_text("\n".join(lines), encoding="utf-8")


# --------------------------------------------------------------------------
# CLI / orchestration
# --------------------------------------------------------------------------

def parse_seasons(spec: str) -> list[int]:
    seasons = set()
    for part in spec.split(","):
        part = part.strip()
        if not part:
            continue
        if "-" in part:
            lo, hi = part.split("-", 1)
            seasons.update(range(int(lo), int(hi) + 1))
        else:
            seasons.add(int(part))
    return sorted(seasons)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--seasons", default=DEFAULT_SEASON_RANGE,
                         help=f"Season range/list, e.g. '2018-2026' or '2023,2024' "
                              f"(default: {DEFAULT_SEASON_RANGE})")
    args = parser.parse_args()
    seasons = parse_seasons(args.seasons)
    print(f"[main] seasons: {seasons}")

    status_counter: Counter = Counter()

    # Phase 1: Jolpica schedules + results.
    races = collect_jolpica_races(seasons, status_counter)
    print(f"[main] {len(races)} published races collected from Jolpica")

    write_status_counts_csv(status_counter, DATA_DIR / "status_counts.csv")
    print(f"[main] wrote {DATA_DIR / 'status_counts.csv'} "
          f"({len(status_counter)} distinct raw-status/category pairs)")

    # Phase 2: FastF1 track-status neutralization counts.
    print("[main] starting FastF1 phase (this is the slow part)...")
    fastf1_summaries = run_fastf1_phase(races)
    for race in races:
        race["fastf1"] = fastf1_summaries.get((race["season"], race["round"]))

    failed = [r for r in races if not (r["fastf1"] or {}).get("ok")]
    print(f"[main] FastF1 phase done: {len(races) - len(failed)}/{len(races)} succeeded, "
          f"{len(failed)} failed")
    for r in failed:
        print(f"[main]   FAILED: {r['season']} R{r['round']} {r['race_name']}: "
              f"{(r['fastf1'] or {}).get('error')}")

    # Phase 3: OpenF1 cross-check (2023+).
    print("[main] starting OpenF1 cross-check phase...")
    mismatch_rows = run_openf1_phase(races)
    write_mismatches_csv(mismatch_rows, DATA_DIR / "neutralization_mismatches.csv")
    n_mismatch = sum(1 for r in mismatch_rows if not r["match"])
    print(f"[main] wrote {DATA_DIR / 'neutralization_mismatches.csv'} "
          f"({n_mismatch}/{len(mismatch_rows)} mismatches)")

    # Phase 4: validate + assemble training set.
    training_races = []
    excluded = []
    fixed_notes = []
    for race in races:
        fixed, notes = validate_and_fix_race(race)
        if fixed is None:
            excluded.append((race["season"], race["round"], race["race_name"], notes[0]))
            continue
        training_races.append(fixed)
        for note in notes:
            fixed_notes.append((race["season"], race["round"], race["race_name"], note))

    with open(DATA_DIR / "training_races.json", "w", encoding="utf-8") as f:
        json.dump(training_races, f, indent=2)
    print(f"[main] wrote {DATA_DIR / 'training_races.json'} with {len(training_races)} races "
          f"({len(excluded)} excluded)")

    write_counting_rules_md(DATA_DIR / "COUNTING_RULES.md", status_counter)
    print(f"[main] wrote {DATA_DIR / 'COUNTING_RULES.md'}")

    # Per-season counts table.
    per_season = Counter(r["season"] for r in training_races)
    print("\n[report] races per season (final training set):")
    print(f"{'season':>8} | {'count':>5}")
    for season in seasons:
        print(f"{season:>8} | {per_season.get(season, 0):>5}")
    print(f"{'TOTAL':>8} | {sum(per_season.values()):>5}")

    print("\n[report] exclusions:")
    for season, round_, name, reason in excluded:
        print(f"  {season} R{round_} {name}: {reason}")

    print("\n[report] in-place fixes:")
    for season, round_, name, note in fixed_notes:
        print(f"  {season} R{round_} {name}: {note}")

    print("\n[report] FastF1 failures:")
    for r in failed:
        print(f"  {r['season']} R{r['round']} {r['race_name']}: "
              f"{(r['fastf1'] or {}).get('error')}")

    print("\n[main] done.")


if __name__ == "__main__":
    main()
