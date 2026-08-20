"""Wins, podiums, average finish, and DNFs per driver."""

import plotly.express as px
import streamlit as st

from common import load_core_data

st.set_page_config(page_title="Driver Stats - OpenF1", page_icon="🏎️", layout="wide")
st.title("🏎️ Driver Stats")

data = load_core_data()
standings = data["standings"]
colors = data["driver_colors"]

st.markdown(f"### {data['year']} Season")

col1, col2 = st.columns(2)

with col1:
    st.subheader("Race wins")
    wins_df = standings[standings["wins"] > 0]
    fig_wins = px.bar(
        wins_df,
        x="full_name",
        y="wins",
        color="full_name",
        color_discrete_map=colors,
        labels={"full_name": "Driver", "wins": "Wins"},
    )
    fig_wins.update_layout(showlegend=False, xaxis_title=None)
    st.plotly_chart(fig_wins, use_container_width=True)

with col2:
    st.subheader("Podium finishes")
    podiums_df = standings[standings["podiums"] > 0]
    fig_podiums = px.bar(
        podiums_df,
        x="full_name",
        y="podiums",
        color="full_name",
        color_discrete_map=colors,
        labels={"full_name": "Driver", "podiums": "Podiums"},
    )
    fig_podiums.update_layout(showlegend=False, xaxis_title=None)
    st.plotly_chart(fig_podiums, use_container_width=True)

col3, col4 = st.columns(2)

with col3:
    st.subheader("Average finishing position")
    afp = standings.sort_values("avg_finish")
    fig_afp = px.bar(
        afp,
        x="full_name",
        y="avg_finish",
        color="full_name",
        color_discrete_map=colors,
        labels={"full_name": "Driver", "avg_finish": "Avg. finishing position"},
    )
    fig_afp.update_layout(showlegend=False, xaxis_title=None, yaxis=dict(autorange="reversed"))
    st.plotly_chart(fig_afp, use_container_width=True)

with col4:
    st.subheader("DNFs")
    dnf_df = standings[standings["dnfs"] > 0].sort_values("dnfs", ascending=False)
    if dnf_df.empty:
        st.info("No DNFs recorded for this season yet.")
    else:
        fig_dnf = px.bar(
            dnf_df,
            x="full_name",
            y="dnfs",
            color="full_name",
            color_discrete_map=colors,
            labels={"full_name": "Driver", "dnfs": "DNFs"},
        )
        fig_dnf.update_layout(showlegend=False, xaxis_title=None)
        st.plotly_chart(fig_dnf, use_container_width=True)
