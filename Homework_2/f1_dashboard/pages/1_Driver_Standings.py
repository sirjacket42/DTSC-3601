import plotly.express as px
import streamlit as st

from common import compute_driver_standings, load_results, sidebar_season_filter, team_color

st.set_page_config(page_title="Driver Standings", page_icon="\U0001F3C6", layout="wide")
st.title("Driver Standings")

df = load_results()
seasons = sidebar_season_filter(df)
view = df[df["season"].isin(seasons)]

standings = compute_driver_standings(view)

top_n = st.slider("Show top N drivers", min_value=5, max_value=min(30, len(standings)), value=15)
top = standings.head(top_n)

fig = px.bar(
    top,
    x="total_points",
    y="full_name",
    orientation="h",
    color="team_name",
    color_discrete_map={t: team_color(t) for t in top["team_name"].unique()},
    labels={"total_points": "Total points", "full_name": "Driver", "team_name": "Team"},
    hover_data={"wins": True, "podiums": True, "races": True, "avg_finish": ":.1f"},
)
fig.update_layout(yaxis=dict(categoryorder="total ascending"), legend_title_text="Team")
st.plotly_chart(fig, width='stretch')

st.subheader("Full standings table")
st.dataframe(
    standings.rename(
        columns={
            "full_name": "Driver",
            "team_name": "Team",
            "total_points": "Points",
            "wins": "Wins",
            "podiums": "Podiums",
            "races": "Races",
            "avg_finish": "Avg finish",
            "dnfs": "DNFs",
        }
    ).style.format({"Avg finish": "{:.1f}"}),
    width='stretch',
    hide_index=True,
)
