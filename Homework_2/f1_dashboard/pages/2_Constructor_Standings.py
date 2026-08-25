import plotly.express as px
import streamlit as st

from common import compute_constructor_standings, load_results, sidebar_season_filter, team_color

st.set_page_config(page_title="Constructor Standings", page_icon="\U0001F3E1", layout="wide")
st.title("Constructor Standings")

df = load_results()
seasons = sidebar_season_filter(df)
view = df[df["season"].isin(seasons)]

standings = compute_constructor_standings(view)

fig = px.bar(
    standings,
    x="total_points",
    y="team_name",
    orientation="h",
    color="team_name",
    color_discrete_map={t: team_color(t) for t in standings["team_name"].unique()},
    labels={"total_points": "Total points", "team_name": "Team"},
    hover_data={"wins": True, "podiums": True, "dnfs": True},
)
fig.update_layout(showlegend=False, yaxis=dict(categoryorder="total ascending"))
st.plotly_chart(fig, width='stretch')

st.subheader("Wins vs. podiums")
fig2 = px.scatter(
    standings,
    x="wins",
    y="podiums",
    color="team_name",
    size="total_points",
    color_discrete_map={t: team_color(t) for t in standings["team_name"].unique()},
    labels={"wins": "Wins", "podiums": "Podiums", "team_name": "Team", "total_points": "Points"},
    hover_name="team_name",
)
fig2.update_layout(legend_title_text="Team")
st.plotly_chart(fig2, width='stretch')

st.subheader("Full standings table")
st.dataframe(
    standings.rename(
        columns={
            "team_name": "Team",
            "total_points": "Points",
            "wins": "Wins",
            "podiums": "Podiums",
            "dnfs": "DNFs",
        }
    ),
    width='stretch',
    hide_index=True,
)
