"""Cumulative championship points across the season, round by round."""

import plotly.express as px
import streamlit as st

from common import load_core_data

st.set_page_config(page_title="Points Progression - OpenF1", page_icon="📈", layout="wide")
st.title("📈 Points Progression")

data = load_core_data()
results_df = data["results_df"]
standings = data["standings"]
colors = data["driver_colors"]

st.markdown(f"### {data['year']} Season")

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
