import plotly.express as px
import streamlit as st

from common import load_results, team_color

st.set_page_config(page_title="Season Comparison", page_icon="\U0001F5D3", layout="wide")
st.title("Season-over-Season Comparison")
st.caption("Compare how the same team performed across the 2023-2026 seasons.")

df = load_results()
teams = sorted(df["team_name"].unique())

with st.sidebar:
    st.header("Filters")
    selected_teams = st.multiselect("Teams", teams, default=teams[:5], key="comparison_teams")

if not selected_teams:
    st.info("Pick at least one team in the sidebar.")
    st.stop()

view = df[df["team_name"].isin(selected_teams)]
by_season = view.groupby(["season", "team_name"], as_index=False)["points"].sum()

fig = px.bar(
    by_season,
    x="season",
    y="points",
    color="team_name",
    barmode="group",
    color_discrete_map={t: team_color(t) for t in by_season["team_name"].unique()},
    labels={"season": "Season", "points": "Total points", "team_name": "Team"},
)
fig.update_layout(legend_title_text="Team", xaxis=dict(dtick=1))
st.plotly_chart(fig, width='stretch')

st.subheader("Wins and podiums by season")
detail = (
    view.groupby(["season", "team_name"], as_index=False)
    .agg(
        points=("points", "sum"),
        wins=("position", lambda s: (s == 1).sum()),
        podiums=("position", lambda s: (s <= 3).sum()),
    )
    .sort_values(["team_name", "season"])
)
st.dataframe(
    detail.rename(
        columns={"season": "Season", "team_name": "Team", "points": "Points", "wins": "Wins", "podiums": "Podiums"}
    ),
    width='stretch',
    hide_index=True,
)
