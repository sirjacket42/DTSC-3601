"""Shared Supabase data access and aggregation helpers for every page of the dashboard.

The whole season history (2023-2026) is fetched once per hour via @st.cache_data
and shared across pages -- no page talks to Supabase directly.
"""

import os

import pandas as pd
import streamlit as st
from supabase import Client, create_client

# Real-world F1 team colors. Fixed, never cycled -- a team keeps its color
# across every chart and season, even as the team is renamed (AlphaTauri ->
# RB -> Racing Bulls, Alfa Romeo -> Kick Sauber -> Audi).
TEAM_COLORS = {
    "Red Bull Racing": "#3671C6",
    "Ferrari": "#E8002D",
    "Mercedes": "#27F4D2",
    "McLaren": "#FF8000",
    "Aston Martin": "#229971",
    "Alpine": "#FF87BC",
    "Williams": "#64C4FF",
    "Haas F1 Team": "#B6BABD",
    "Alfa Romeo": "#C92D4B",
    "Kick Sauber": "#52E252",
    "Audi": "#9B0000",
    "AlphaTauri": "#5E8FAA",
    "RB": "#6692FF",
    "Racing Bulls": "#6692FF",
    "Cadillac": "#8B8B8B",
}
DEFAULT_TEAM_COLOR = "#888888"


@st.cache_resource(show_spinner=False)
def get_client() -> Client:
    # st.secrets.get() raises if no secrets.toml exists at all (e.g. on Modal,
    # where credentials come from environment variables set by a Modal Secret
    # instead) -- only touch st.secrets when a file is actually present.
    has_secrets_file = st.secrets.load_if_toml_exists()
    url = (st.secrets.get("SUPABASE_URL") if has_secrets_file else None) or os.environ.get("SUPABASE_URL")
    key = (st.secrets.get("SUPABASE_KEY") if has_secrets_file else None) or os.environ.get("SUPABASE_KEY")
    if not url or not key:
        st.error(
            "Missing Supabase credentials. Set SUPABASE_URL and SUPABASE_KEY "
            "as environment variables (locally) or in .streamlit/secrets.toml."
        )
        st.stop()
    return create_client(url, key)


@st.cache_data(ttl=3600, show_spinner="Loading race results from Supabase...")
def load_results() -> pd.DataFrame:
    client = get_client()
    rows: list[dict] = []
    page_size = 1000
    start = 0
    while True:
        resp = (
            client.table("f1_results")
            .select("*")
            .order("season")
            .order("round")
            .order("position")
            .range(start, start + page_size - 1)
            .execute()
        )
        batch = resp.data
        rows.extend(batch)
        if len(batch) < page_size:
            break
        start += page_size

    df = pd.DataFrame(rows)
    if df.empty:
        return df
    df["date_start"] = pd.to_datetime(df["date_start"])
    df["points"] = df["points"].fillna(0)
    return df


def team_color(team_name: str) -> str:
    return TEAM_COLORS.get(team_name, DEFAULT_TEAM_COLOR)


def sidebar_season_filter(df: pd.DataFrame) -> list[int]:
    seasons = sorted(df["season"].unique().tolist())
    with st.sidebar:
        st.header("Filters")
        selected = st.multiselect("Seasons", seasons, default=seasons, key="season_filter")
        st.caption("Data source: Supabase (`f1_results`), loaded via the REST API.")
        st.caption("Cached for an hour per session to keep the app snappy.")
    return selected or seasons


def compute_driver_standings(df: pd.DataFrame) -> pd.DataFrame:
    return (
        df.groupby(["full_name", "team_name"], as_index=False)
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


def compute_constructor_standings(df: pd.DataFrame) -> pd.DataFrame:
    return (
        df.groupby("team_name", as_index=False)
        .agg(
            total_points=("points", "sum"),
            wins=("position", lambda s: (s == 1).sum()),
            podiums=("position", lambda s: (s <= 3).sum()),
            dnfs=("dnf", "sum"),
        )
        .sort_values("total_points", ascending=False)
        .reset_index(drop=True)
    )
