import plotly.express as px
import streamlit as st

from common import load_results, team_color

st.set_page_config(page_title="Points Progression", page_icon="\U0001F4C8", layout="wide")
st.title("Points Progression")

df = load_results()

with st.sidebar:
    st.header("Filters")
    season = st.selectbox("Season", sorted(df["season"].unique(), reverse=True), key="progression_season")

season_df = df[df["season"] == season].sort_values(["round"])

st.caption(
    "Cumulative championship points by round for the selected season. "
    "One line per team; hover a line for the exact round and running total."
)

team_progress = (
    season_df.groupby(["round", "team_name"], as_index=False)["points"]
    .sum()
    .sort_values(["team_name", "round"])
)
team_progress["cumulative_points"] = team_progress.groupby("team_name")["points"].cumsum()

fig = px.line(
    team_progress,
    x="round",
    y="cumulative_points",
    color="team_name",
    color_discrete_map={t: team_color(t) for t in team_progress["team_name"].unique()},
    labels={"round": "Round", "cumulative_points": "Cumulative points", "team_name": "Team"},
    markers=True,
)
fig.update_layout(legend_title_text="Team", xaxis=dict(dtick=1))
st.plotly_chart(fig, width='stretch')

st.subheader("Rounds included")
st.dataframe(
    season_df[["round", "location", "date_start"]].drop_duplicates().sort_values("round"),
    width='stretch',
    hide_index=True,
)
