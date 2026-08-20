"""Constructors' championship: points, wins, and podiums by team."""

import plotly.express as px
import streamlit as st

from common import compute_constructor_standings, load_core_data

st.set_page_config(page_title="Constructors - OpenF1", page_icon="🔧", layout="wide")
st.title("🔧 Constructors")

data = load_core_data()
results_df = data["results_df"]
team_colors = data["team_colors"]

constructors = compute_constructor_standings(results_df)

st.markdown(f"### {data['year']} Season")

st.subheader("Constructors' points")
fig_points = px.bar(
    constructors,
    x="team_name",
    y="total_points",
    color="team_name",
    color_discrete_map=team_colors,
    text="total_points",
    labels={"team_name": "Team", "total_points": "Points"},
)
fig_points.update_layout(showlegend=False, xaxis_title=None)
st.plotly_chart(fig_points, use_container_width=True)

col1, col2 = st.columns(2)

with col1:
    st.subheader("Wins")
    wins_df = constructors[constructors["wins"] > 0]
    fig_wins = px.bar(
        wins_df,
        x="team_name",
        y="wins",
        color="team_name",
        color_discrete_map=team_colors,
        labels={"team_name": "Team", "wins": "Wins"},
    )
    fig_wins.update_layout(showlegend=False, xaxis_title=None)
    st.plotly_chart(fig_wins, use_container_width=True)

with col2:
    st.subheader("Podiums")
    podiums_df = constructors[constructors["podiums"] > 0]
    fig_podiums = px.bar(
        podiums_df,
        x="team_name",
        y="podiums",
        color="team_name",
        color_discrete_map=team_colors,
        labels={"team_name": "Team", "podiums": "Podiums"},
    )
    fig_podiums.update_layout(showlegend=False, xaxis_title=None)
    st.plotly_chart(fig_podiums, use_container_width=True)

st.subheader("Constructors' table")
display_cols = {
    "team_name": "Team",
    "total_points": "Points",
    "wins": "Wins",
    "podiums": "Podiums",
    "dnfs": "DNFs",
}
st.dataframe(
    constructors.rename(columns=display_cols)[list(display_cols.values())].style.format(
        {"Points": "{:.0f}", "Wins": "{:.0f}", "Podiums": "{:.0f}", "DNFs": "{:.0f}"}
    ),
    use_container_width=True,
    hide_index=True,
)
