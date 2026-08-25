import plotly.express as px
import streamlit as st

from common import compute_constructor_standings, load_results, sidebar_season_filter, team_color

st.set_page_config(page_title="F1 2023-2026 Dashboard", page_icon="\U0001F3CE", layout="wide")

st.title("F1 Results Dashboard (2023-2026)")
st.caption(
    "Race results for every Formula 1 season from 2023 through the current 2026 season, "
    "sourced from the OpenF1 API, stored in Supabase, and served by this app on Modal."
)

df = load_results()
if df.empty:
    st.warning("No data found in Supabase yet.")
    st.stop()

seasons = sidebar_season_filter(df)
view = df[df["season"].isin(seasons)]

col1, col2, col3, col4 = st.columns(4)
col1.metric("Seasons", f"{view['season'].nunique()}")
col2.metric("Races", f"{view.groupby(['season', 'round']).ngroups}")
col3.metric("Drivers", f"{view['full_name'].nunique()}")
col4.metric("Teams", f"{view['team_name'].nunique()}")

st.divider()

st.subheader("Constructor points by season")
season_team_points = (
    view.groupby(["season", "team_name"], as_index=False)["points"].sum().sort_values("season")
)
fig = px.bar(
    season_team_points,
    x="season",
    y="points",
    color="team_name",
    barmode="stack",
    color_discrete_map={t: team_color(t) for t in season_team_points["team_name"].unique()},
    labels={"points": "Total points", "season": "Season", "team_name": "Team"},
)
fig.update_layout(legend_title_text="Team", xaxis=dict(dtick=1))
st.plotly_chart(fig, width='stretch')

st.subheader("Top constructors across the selected seasons")
standings = compute_constructor_standings(view).head(10)
fig2 = px.bar(
    standings,
    x="total_points",
    y="team_name",
    orientation="h",
    color="team_name",
    color_discrete_map={t: team_color(t) for t in standings["team_name"].unique()},
    labels={"total_points": "Total points", "team_name": "Team"},
)
fig2.update_layout(showlegend=False, yaxis=dict(categoryorder="total ascending"))
st.plotly_chart(fig2, width='stretch')

st.info(
    "Use the pages in the sidebar for driver standings, constructor standings, "
    "points progression by round, and a dataset / architecture overview."
)
