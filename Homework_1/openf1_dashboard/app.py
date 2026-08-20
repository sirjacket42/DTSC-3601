"""F1 season driver dashboard, built on the OpenF1 API (https://github.com/br-g/openf1)."""

import datetime

import pandas as pd
import plotly.express as px
import requests
import streamlit as st
from requests.adapters import HTTPAdapter
from urllib3.util import Retry

API_BASE = "https://api.openf1.org/v1"

st.set_page_config(page_title="OpenF1 Season Dashboard", page_icon="🏎️", layout="wide")


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
    of session_result/drivers rows in one call instead of one call per
    session -- the latter reliably triggers 429s and is much slower.
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


def latest_driver_info(drivers_df: pd.DataFrame) -> pd.DataFrame:
    """Collapse repeated per-session driver rows into one row per driver (most recent team)."""
    if drivers_df.empty:
        return drivers_df
    cols = ["driver_number", "full_name", "name_acronym", "team_name", "team_colour", "headshot_url"]
    cols = [c for c in cols if c in drivers_df.columns]
    return drivers_df[cols].drop_duplicates(subset="driver_number", keep="last").reset_index(drop=True)


def team_color_map(drivers_df: pd.DataFrame) -> dict:
    d = latest_driver_info(drivers_df)
    return {
        row["full_name"]: f"#{row['team_colour']}" if pd.notna(row["team_colour"]) else "#888888"
        for _, row in d.iterrows()
    }


st.title("🏎️ OpenF1 Season Dashboard")
st.caption(
    "Basic driver stats for a Formula 1 season, pulled live from the "
    "[OpenF1 API](https://github.com/br-g/openf1)."
)

current_year = datetime.date.today().year
default_year = current_year - 1  # last *completed* season

OPENF1_FIRST_YEAR = 2023  # OpenF1 has no data before this season

with st.sidebar:
    st.header("Settings")
    year = st.number_input(
        "Season", min_value=OPENF1_FIRST_YEAR, max_value=current_year, value=default_year, step=1
    )
    session_kind = st.radio("Sessions to include", ["Race only", "Race + Sprint"], index=0)
    st.caption(f"OpenF1 only has data from {OPENF1_FIRST_YEAR} onward.")
    st.caption("Data is cached for an hour to keep the app snappy and API-friendly.")

sessions_df = get_race_sessions(int(year))

if sessions_df.empty:
    st.warning(f"No race sessions found for {year}. Try a different season.")
    st.stop()

if session_kind == "Race only":
    sessions_df = sessions_df[sessions_df["session_name"] == "Race"]

session_keys = tuple(sessions_df["session_key"].tolist())
results_df, drivers_df = get_season_data(int(year), session_keys)

if results_df.empty:
    st.warning(f"No results available yet for {year}.")
    st.stop()

drivers_lookup = latest_driver_info(drivers_df).set_index("driver_number")
colors = team_color_map(drivers_df)

results_df = results_df.merge(
    sessions_df[["session_key", "session_name", "date_start", "location"]],
    on="session_key",
    how="left",
)
results_df["full_name"] = results_df["driver_number"].map(drivers_lookup["full_name"])
results_df["team_name"] = results_df["driver_number"].map(drivers_lookup["team_name"])
results_df["points"] = results_df["points"].fillna(0)
results_df = results_df.dropna(subset=["full_name"])

st.markdown(f"### {year} Season &mdash; {sessions_df['location'].nunique()} rounds, {results_df['full_name'].nunique()} drivers")

# --- Championship standings ---
standings = (
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

st.subheader("Championship standings")
fig_points = px.bar(
    standings,
    x="full_name",
    y="total_points",
    color="full_name",
    color_discrete_map=colors,
    text="total_points",
    labels={"full_name": "Driver", "total_points": "Points"},
)
fig_points.update_layout(showlegend=False, xaxis_title=None)
st.plotly_chart(fig_points, use_container_width=True)

col1, col2 = st.columns(2)

with col1:
    st.subheader("Race wins")
    wins_df = standings[standings["wins"] > 0]
    fig_wins = px.bar(
        wins_df,
        x="full_name",
        y="wins",
        color="full_name",
        color_discrete_map=colors,
        labels={"full_name": "Driver", "wins": "Wins"},
    )
    fig_wins.update_layout(showlegend=False, xaxis_title=None)
    st.plotly_chart(fig_wins, use_container_width=True)

with col2:
    st.subheader("Podium finishes")
    podiums_df = standings[standings["podiums"] > 0]
    fig_podiums = px.bar(
        podiums_df,
        x="full_name",
        y="podiums",
        color="full_name",
        color_discrete_map=colors,
        labels={"full_name": "Driver", "podiums": "Podiums"},
    )
    fig_podiums.update_layout(showlegend=False, xaxis_title=None)
    st.plotly_chart(fig_podiums, use_container_width=True)

# --- Points progression across the season ---
st.subheader("Points progression across the season")
race_order = sessions_df.sort_values("date_start")["session_key"].tolist()
race_index = {k: i + 1 for i, k in enumerate(race_order)}
results_df["round"] = results_df["session_key"].map(race_index)

progression = results_df.sort_values("round").copy()
progression["cum_points"] = progression.groupby("full_name")["points"].cumsum()

top_n = st.slider("Show top N drivers by final points", 3, min(20, standings.shape[0]), min(10, standings.shape[0]))
top_drivers = standings.head(top_n)["full_name"].tolist()

fig_progress = px.line(
    progression[progression["full_name"].isin(top_drivers)],
    x="round",
    y="cum_points",
    color="full_name",
    color_discrete_map=colors,
    markers=True,
    labels={"round": "Round", "cum_points": "Cumulative points", "full_name": "Driver"},
)
st.plotly_chart(fig_progress, use_container_width=True)

# --- Average finishing position & DNFs ---
col3, col4 = st.columns(2)

with col3:
    st.subheader("Average finishing position")
    afp = standings.sort_values("avg_finish")
    fig_afp = px.bar(
        afp,
        x="full_name",
        y="avg_finish",
        color="full_name",
        color_discrete_map=colors,
        labels={"full_name": "Driver", "avg_finish": "Avg. finishing position"},
    )
    fig_afp.update_layout(showlegend=False, xaxis_title=None, yaxis=dict(autorange="reversed"))
    st.plotly_chart(fig_afp, use_container_width=True)

with col4:
    st.subheader("DNFs")
    dnf_df = standings[standings["dnfs"] > 0].sort_values("dnfs", ascending=False)
    if dnf_df.empty:
        st.info("No DNFs recorded for this season yet.")
    else:
        fig_dnf = px.bar(
            dnf_df,
            x="full_name",
            y="dnfs",
            color="full_name",
            color_discrete_map=colors,
            labels={"full_name": "Driver", "dnfs": "DNFs"},
        )
        fig_dnf.update_layout(showlegend=False, xaxis_title=None)
        st.plotly_chart(fig_dnf, use_container_width=True)

# --- Full standings table ---
st.subheader("Full standings table")
display_cols = {
    "full_name": "Driver",
    "team_name": "Team",
    "total_points": "Points",
    "wins": "Wins",
    "podiums": "Podiums",
    "races": "Races",
    "avg_finish": "Avg. finish",
    "dnfs": "DNFs",
}
st.dataframe(
    standings.rename(columns=display_cols)[list(display_cols.values())].style.format(
        {"Points": "{:.0f}", "Wins": "{:.0f}", "Podiums": "{:.0f}", "DNFs": "{:.0f}", "Avg. finish": "{:.1f}"}
    ),
    use_container_width=True,
    hide_index=True,
)

st.caption("Data source: [OpenF1](https://openf1.org) (api.openf1.org) — an open-source, community-run F1 telemetry API.")
