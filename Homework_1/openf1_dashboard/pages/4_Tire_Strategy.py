"""Tire strategy for a single race: which compound each driver ran, and for how long."""

import plotly.express as px
import streamlit as st

from common import COMPOUND_COLORS, get_stints, load_core_data

st.set_page_config(page_title="Tire Strategy - OpenF1", page_icon="🛞", layout="wide")
st.title("🛞 Tire Strategy")

data = load_core_data()
sessions_df = data["sessions_df"]
results_df = data["results_df"]
drivers_lookup = data["drivers_lookup"]

st.markdown(f"### {data['year']} Season")

race_options = sessions_df.sort_values("date_start", ascending=False)
race_labels = {row.session_key: f"{row.location} ({row.session_name})" for row in race_options.itertuples()}
selected_key = st.selectbox(
    "Race", options=race_options["session_key"], format_func=lambda k: race_labels[k]
)

session_keys = tuple(sessions_df["session_key"].tolist())
stints_df = get_stints(session_keys)

if stints_df.empty:
    st.info("No stint data available for this season.")
    st.stop()

race_stints = stints_df[stints_df["session_key"] == selected_key].copy()
if race_stints.empty:
    st.info("No stint data available for this race.")
    st.stop()

race_stints["full_name"] = race_stints["driver_number"].map(drivers_lookup["full_name"])
race_stints = race_stints.dropna(subset=["full_name"])
race_stints["stint_length"] = race_stints["lap_end"] - race_stints["lap_start"] + 1
race_stints["compound"] = race_stints["compound"].fillna("UNKNOWN")

# Order drivers by their finishing position in this race, best first.
race_results = results_df[results_df["session_key"] == selected_key].sort_values("position")
driver_order = race_results["full_name"].dropna().tolist()
driver_order = [d for d in driver_order if d in race_stints["full_name"].unique()]

fig = px.bar(
    race_stints,
    y="full_name",
    x="stint_length",
    base="lap_start",
    color="compound",
    color_discrete_map=COMPOUND_COLORS,
    orientation="h",
    category_orders={"full_name": driver_order},
    labels={"full_name": "Driver", "stint_length": "Lap", "compound": "Compound"},
)
fig.update_layout(xaxis_title="Lap", legend_title_text="Compound")
st.plotly_chart(fig, use_container_width=True)

st.caption("Bar length is stint length (in laps); position on the x-axis is the lap range the stint covered.")
