"""OpenF1 season dashboard -- Overview page. See common.py for shared data logic."""

import plotly.express as px
import streamlit as st

from common import load_core_data

st.set_page_config(page_title="OpenF1 Season Dashboard", page_icon="🏎️", layout="wide")

st.title("🏎️ OpenF1 Season Dashboard")
st.caption(
    "Basic driver stats for a Formula 1 season, pulled live from the "
    "[OpenF1 API](https://github.com/br-g/openf1)."
)

data = load_core_data()
year = data["year"]
sessions_df = data["sessions_df"]
results_df = data["results_df"]
standings = data["standings"]
colors = data["driver_colors"]

st.markdown(
    f"### {year} Season &mdash; {sessions_df['location'].nunique()} rounds, "
    f"{results_df['full_name'].nunique()} drivers"
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

st.divider()
st.subheader("Explore more")
nav_col1, nav_col2, nav_col3, nav_col4 = st.columns(4)
with nav_col1:
    st.page_link("pages/1_Driver_Stats.py", label="Driver Stats", icon="🏎️")
    st.page_link("pages/2_Constructors.py", label="Constructors", icon="🔧")
with nav_col2:
    st.page_link("pages/3_Points_Progression.py", label="Points Progression", icon="📈")
    st.page_link("pages/4_Tire_Strategy.py", label="Tire Strategy", icon="🛞")
with nav_col3:
    st.page_link("pages/5_Weather.py", label="Weather", icon="🌦️")
    st.page_link("pages/6_Fastest_Laps.py", label="Fastest Laps", icon="⚡")
with nav_col4:
    st.page_link("pages/7_Race_Control.py", label="Race Control", icon="🚩")

st.caption("Data source: [OpenF1](https://openf1.org) (api.openf1.org) — an open-source, community-run F1 telemetry API.")
