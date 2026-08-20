"""Shared data-fetching and aggregation helpers for every page of the dashboard.

All fetch functions are @st.cache_data'd, so calling them from multiple pages
costs no extra API calls -- Streamlit shares one cache across the whole app.
"""

import datetime

import pandas as pd
import requests
import streamlit as st
from requests.adapters import HTTPAdapter
from urllib3.util import Retry

API_BASE = "https://api.openf1.org/v1"
OPENF1_FIRST_YEAR = 2023  # OpenF1 has no data before this season

# Standard F1 tire-compound colors, used on the Tire Strategy page.
COMPOUND_COLORS = {
    "SOFT": "#DA291C",
    "MEDIUM": "#FFD12E",
    "HARD": "#F0F0F0",
    "INTERMEDIATE": "#43B02A",
    "WET": "#0067AD",
    "UNKNOWN": "#888888",
}


def _make_session() -> requests.Session:
    session = requests.Session()
    retry = Retry(
        total=8,
        backoff_factor=1.5,
        status_forcelist=[429, 500, 502, 503, 504],
        respect_retry_after_header=True,
        allowed_methods=["GET"],
    )
    session.mount("https://", HTTPAdapter(max_retries=retry))
    return session


_SESSION = _make_session()


@st.cache_data(ttl=3600, show_spinner=False)
def api_get(endpoint: str, **params) -> list[dict]:
    resp = _SESSION.get(f"{API_BASE}/{endpoint}", params=params, timeout=30)
    if resp.status_code == 404:
        # OpenF1 returns 404 with {"detail": "No results found."} for a query
        # with no matching rows (e.g. a season it has no data for) rather
        # than an empty 200 list -- treat that as "no data", not an error.
        return []
    resp.raise_for_status()
    return resp.json()


@st.cache_data(ttl=3600, show_spinner=False)
def api_get_range(endpoint: str, key_field: str, min_val: int, max_val: int) -> list[dict]:
    """Fetch every row with key_field in [min_val, max_val] in a single request.

    OpenF1 supports inline comparison operators appended to a field name
    (e.g. `session_key>=100`), which lets us pull an entire season's worth
    of rows in one call instead of one call per session -- the latter
    reliably triggers 429s and is much slower.
    """
    url = f"{API_BASE}/{endpoint}?{key_field}>={min_val}&{key_field}<={max_val}"
    resp = _SESSION.get(url, timeout=60)
    if resp.status_code == 404:
        return []
    resp.raise_for_status()
    return resp.json()


@st.cache_data(ttl=3600, show_spinner="Fetching race sessions...")
def get_race_sessions(year: int) -> pd.DataFrame:
    sessions = api_get("sessions", year=year, session_type="Race")
    df = pd.DataFrame(sessions)
    if df.empty:
        return df
    df = df[df["session_name"].isin(["Race", "Sprint"])].copy()
    df["date_start"] = pd.to_datetime(df["date_start"])
    return df.sort_values("date_start").reset_index(drop=True)


@st.cache_data(ttl=3600, show_spinner="Fetching results and driver info...")
def get_season_data(year: int, session_keys: tuple[int, ...]) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Return (results_df, drivers_df) across every race/sprint session in the season.

    Fetches the full min-to-max session_key span in one request per endpoint
    (see api_get_range) rather than one request per session, then filters
    down to just the sessions we asked for client-side.
    """
    key_set = set(session_keys)
    min_key, max_key = min(session_keys), max(session_keys)

    all_results = [r for r in api_get_range("session_result", "session_key", min_key, max_key) if r["session_key"] in key_set]
    all_drivers = [d for d in api_get_range("drivers", "session_key", min_key, max_key) if d["session_key"] in key_set]

    results_df = pd.DataFrame(all_results)
    drivers_df = pd.DataFrame(all_drivers)
    return results_df, drivers_df


@st.cache_data(ttl=3600, show_spinner="Fetching tire stint data...")
def get_stints(session_keys: tuple[int, ...]) -> pd.DataFrame:
    key_set = set(session_keys)
    min_key, max_key = min(session_keys), max(session_keys)
    rows = [r for r in api_get_range("stints", "session_key", min_key, max_key) if r["session_key"] in key_set]
    return pd.DataFrame(rows)


@st.cache_data(ttl=3600, show_spinner="Fetching weather data...")
def get_weather(session_keys: tuple[int, ...]) -> pd.DataFrame:
    key_set = set(session_keys)
    min_key, max_key = min(session_keys), max(session_keys)
    rows = [r for r in api_get_range("weather", "session_key", min_key, max_key) if r["session_key"] in key_set]
    return pd.DataFrame(rows)


@st.cache_data(ttl=3600, show_spinner="Fetching race control messages...")
def get_race_control(session_keys: tuple[int, ...]) -> pd.DataFrame:
    key_set = set(session_keys)
    min_key, max_key = min(session_keys), max(session_keys)
    rows = [r for r in api_get_range("race_control", "session_key", min_key, max_key) if r["session_key"] in key_set]
    return pd.DataFrame(rows)


@st.cache_data(ttl=3600, show_spinner="Fetching lap times...")
def get_laps_for_session(session_key: int) -> pd.DataFrame:
    """Laps for a single session -- a full season of laps is ~30MB/20s, too slow
    to fetch in one range query, so this page-level data is fetched per race."""
    rows = api_get("laps", session_key=session_key)
    return pd.DataFrame(rows)


def latest_driver_info(drivers_df: pd.DataFrame) -> pd.DataFrame:
    """Collapse repeated per-session driver rows into one row per driver (most recent team)."""
    if drivers_df.empty:
        return drivers_df
    cols = ["driver_number", "full_name", "name_acronym", "team_name", "team_colour", "headshot_url"]
    cols = [c for c in cols if c in drivers_df.columns]
    return drivers_df[cols].drop_duplicates(subset="driver_number", keep="last").reset_index(drop=True)


def driver_color_map(drivers_df: pd.DataFrame) -> dict:
    d = latest_driver_info(drivers_df)
    return {
        row["full_name"]: f"#{row['team_colour']}" if pd.notna(row["team_colour"]) else "#888888"
        for _, row in d.iterrows()
    }


def team_color_map(drivers_df: pd.DataFrame) -> dict:
    d = latest_driver_info(drivers_df)
    return {
        row["team_name"]: f"#{row['team_colour']}" if pd.notna(row["team_colour"]) else "#888888"
        for _, row in d.drop_duplicates(subset="team_name").iterrows()
    }


def compute_driver_standings(results_df: pd.DataFrame) -> pd.DataFrame:
    return (
        results_df.groupby(["full_name", "team_name"], as_index=False)
        .agg(
            total_points=("points", "sum"),
            wins=("position", lambda s: (s == 1).sum()),
            podiums=("position", lambda s: (s <= 3).sum()),
            races=("position", "count"),
            avg_finish=("position", "mean"),
            dnfs=("dnf", "sum"),
        )
        .sort_values("total_points", ascending=False)
        .reset_index(drop=True)
    )


def compute_constructor_standings(results_df: pd.DataFrame) -> pd.DataFrame:
    return (
        results_df.groupby("team_name", as_index=False)
        .agg(
            total_points=("points", "sum"),
            wins=("position", lambda s: (s == 1).sum()),
            podiums=("position", lambda s: (s <= 3).sum()),
            dnfs=("dnf", "sum"),
        )
        .sort_values("total_points", ascending=False)
        .reset_index(drop=True)
    )


def sidebar_controls() -> tuple[int, str]:
    """Render the season/session-kind widgets. Uses fixed keys so the
    selection stays in sync across every page (Streamlit keeps
    st.session_state across page navigation within one browser session)."""
    current_year = datetime.date.today().year
    default_year = current_year - 1  # last *completed* season

    with st.sidebar:
        st.header("Settings")
        year = st.number_input(
            "Season",
            min_value=OPENF1_FIRST_YEAR,
            max_value=current_year,
            value=default_year,
            step=1,
            key="season_year",
        )
        session_kind = st.radio(
            "Sessions to include", ["Race only", "Race + Sprint"], index=0, key="session_kind"
        )
        st.caption(f"OpenF1 only has data from {OPENF1_FIRST_YEAR} onward.")
        st.caption("Data is cached for an hour to keep the app snappy and API-friendly.")

    return int(year), session_kind


def load_core_data() -> dict:
    """Fetch (or reuse cached) sessions/results/drivers for the selected season
    and return everything each page needs. Calls st.stop() if there's nothing
    to show, so pages can call this first and use the result unconditionally.
    """
    year, session_kind = sidebar_controls()

    sessions_df = get_race_sessions(year)
    if sessions_df.empty:
        st.warning(f"No race sessions found for {year}. Try a different season.")
        st.stop()

    if session_kind == "Race only":
        sessions_df = sessions_df[sessions_df["session_name"] == "Race"]

    session_keys = tuple(sessions_df["session_key"].tolist())
    results_df, drivers_df = get_season_data(year, session_keys)

    if results_df.empty:
        st.warning(f"No results available yet for {year}.")
        st.stop()

    drivers_lookup = latest_driver_info(drivers_df).set_index("driver_number")

    results_df = results_df.merge(
        sessions_df[["session_key", "session_name", "date_start", "location"]],
        on="session_key",
        how="left",
    )
    results_df["full_name"] = results_df["driver_number"].map(drivers_lookup["full_name"])
    results_df["team_name"] = results_df["driver_number"].map(drivers_lookup["team_name"])
    results_df["points"] = results_df["points"].fillna(0)
    results_df = results_df.dropna(subset=["full_name"])

    race_order = sessions_df.sort_values("date_start")["session_key"].tolist()
    race_index = {k: i + 1 for i, k in enumerate(race_order)}
    results_df["round"] = results_df["session_key"].map(race_index)

    return {
        "year": year,
        "session_kind": session_kind,
        "sessions_df": sessions_df,
        "results_df": results_df,
        "drivers_df": drivers_df,
        "drivers_lookup": drivers_lookup,
        "driver_colors": driver_color_map(drivers_df),
        "team_colors": team_color_map(drivers_df),
        "standings": compute_driver_standings(results_df),
    }
