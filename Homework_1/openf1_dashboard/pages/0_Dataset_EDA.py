"""Initial EDA on a static CSV snapshot of the season's results.

Unlike every other page (which fetches live from api.openf1.org), this page
reads data/f1_2025_results.csv -- a fixed, version-controlled dataset -- so
the EDA below is reproducible independent of what the live API returns.
Regenerate the snapshot with: uv run python scripts/export_dataset.py [year]
"""

from pathlib import Path

import pandas as pd
import plotly.express as px
import streamlit as st

st.set_page_config(page_title="Dataset & EDA - OpenF1", page_icon="🔍", layout="wide")
st.title("🔍 Dataset & EDA")
st.caption(
    "Initial exploratory data analysis on a static CSV snapshot of the season's race "
    "results (one row per driver per race)."
)

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
csv_files = sorted(DATA_DIR.glob("f1_*_results.csv"))

if not csv_files:
    st.error(
        "No dataset found in data/. Generate one with:\n\n"
        "`uv run python scripts/export_dataset.py [year]`"
    )
    st.stop()

selected_file = st.selectbox("Dataset", csv_files, format_func=lambda p: p.name)
df = pd.read_csv(selected_file, parse_dates=["date_start"])

st.subheader("Raw data")
st.dataframe(df.head(20), use_container_width=True, hide_index=True)
st.caption(f"Showing the first 20 of {len(df):,} rows.")

col1, col2 = st.columns(2)

with col1:
    st.subheader("Shape & columns")
    st.write(f"**Rows:** {df.shape[0]:,}  **Columns:** {df.shape[1]}")
    dtypes_df = df.dtypes.astype(str).reset_index()
    dtypes_df.columns = ["Column", "Dtype"]
    st.dataframe(dtypes_df, use_container_width=True, hide_index=True)

with col2:
    st.subheader("Missing values")
    missing = df.isna().sum().reset_index()
    missing.columns = ["Column", "Missing"]
    missing = missing[missing["Missing"] > 0].sort_values("Missing", ascending=False)
    if missing.empty:
        st.success("No missing values in any column.")
    else:
        st.dataframe(missing, use_container_width=True, hide_index=True)

st.subheader("Summary statistics")
st.dataframe(df.select_dtypes(include="number").describe().round(2), use_container_width=True)

st.divider()
st.subheader("Graphics")

gcol1, gcol2 = st.columns(2)

with gcol1:
    st.markdown("**Distribution of points scored**")
    fig_hist = px.histogram(
        df[df["points"] > 0],
        x="points",
        nbins=15,
        labels={"points": "Points scored in a race"},
    )
    st.plotly_chart(fig_hist, use_container_width=True)

with gcol2:
    st.markdown("**Finishing position spread by team**")
    team_order = df.groupby("team_name")["position"].median().sort_values().index.tolist()
    fig_box = px.box(
        df,
        x="team_name",
        y="position",
        category_orders={"team_name": team_order},
        labels={"team_name": "Team", "position": "Finishing position"},
    )
    fig_box.update_layout(xaxis_title=None, yaxis=dict(autorange="reversed"))
    fig_box.update_xaxes(tickangle=45)
    st.plotly_chart(fig_box, use_container_width=True)

st.markdown("**Points vs. gap to race leader**")
finished = df[(df["dnf"] == False) & (df["position"] > 1)]  # noqa: E712
fig_scatter = px.scatter(
    finished,
    x="gap_to_leader",
    y="points",
    color="team_name",
    hover_data=["full_name", "round", "location"],
    labels={"gap_to_leader": "Gap to leader (s)", "points": "Points scored", "team_name": "Team"},
)
st.plotly_chart(fig_scatter, use_container_width=True)
