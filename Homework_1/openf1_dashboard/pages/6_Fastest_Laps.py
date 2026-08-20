"""Fastest lap and top speed-trap leaderboards for a single race."""

import plotly.express as px
import streamlit as st

from common import get_laps_for_session, load_core_data


def format_lap_time(seconds: float) -> str:
    minutes = int(seconds // 60)
    remainder = seconds - minutes * 60
    return f"{minutes}:{remainder:06.3f}"


st.set_page_config(page_title="Fastest Laps - OpenF1", page_icon="⚡", layout="wide")
st.title("⚡ Fastest Laps & Top Speed")

data = load_core_data()
sessions_df = data["sessions_df"]
drivers_lookup = data["drivers_lookup"]
colors = data["driver_colors"]

st.markdown(f"### {data['year']} Season")

race_options = sessions_df.sort_values("date_start", ascending=False)
race_labels = {row.session_key: f"{row.location} ({row.session_name})" for row in race_options.itertuples()}
selected_key = st.selectbox(
    "Race", options=race_options["session_key"], format_func=lambda k: race_labels[k]
)

laps_df = get_laps_for_session(int(selected_key))
if laps_df.empty:
    st.info("No lap data available for this race.")
    st.stop()

laps_df["full_name"] = laps_df["driver_number"].map(drivers_lookup["full_name"])
laps_df = laps_df.dropna(subset=["full_name"])
valid_laps = laps_df[(laps_df["lap_duration"].notna()) & (~laps_df["is_pit_out_lap"].fillna(False))]

col1, col2 = st.columns(2)

with col1:
    st.subheader("Fastest lap")
    if valid_laps.empty:
        st.info("No valid lap times for this race.")
    else:
        fastest = valid_laps.loc[valid_laps.groupby("full_name")["lap_duration"].idxmin()].sort_values("lap_duration")
        fastest["lap_time"] = fastest["lap_duration"].apply(format_lap_time)
        # Lap times across a field only span ~1-2s, so an absolute, zero-based
        # scale makes every bar look the same height. Plot the gap to the
        # fastest lap instead -- the standard "gap to leader" framing.
        fastest["gap"] = fastest["lap_duration"] - fastest["lap_duration"].min()
        fig_fastest = px.bar(
            fastest,
            x="full_name",
            y="gap",
            color="full_name",
            color_discrete_map=colors,
            text="lap_time",
            labels={"full_name": "Driver", "gap": "Gap to fastest lap (s)"},
        )
        fig_fastest.update_layout(showlegend=False, xaxis_title=None)
        fig_fastest.update_traces(textposition="outside")
        st.plotly_chart(fig_fastest, use_container_width=True)

with col2:
    st.subheader("Top speed (speed trap)")
    speed_laps = laps_df[laps_df["st_speed"].notna()]
    if speed_laps.empty:
        st.info("No speed trap data for this race.")
    else:
        top_speed = speed_laps.loc[speed_laps.groupby("full_name")["st_speed"].idxmax()].sort_values(
            "st_speed", ascending=False
        )
        fig_speed = px.bar(
            top_speed,
            x="full_name",
            y="st_speed",
            color="full_name",
            color_discrete_map=colors,
            text="st_speed",
            labels={"full_name": "Driver", "st_speed": "Top speed (km/h)"},
        )
        fig_speed.update_layout(showlegend=False, xaxis_title=None)
        st.plotly_chart(fig_speed, use_container_width=True)
