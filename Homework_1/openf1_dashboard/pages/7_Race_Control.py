"""Flags, safety cars, and other race control events across the season."""

import plotly.express as px
import streamlit as st

from common import get_race_control, load_core_data

st.set_page_config(page_title="Race Control - OpenF1", page_icon="🚩", layout="wide")
st.title("🚩 Race Control")

data = load_core_data()
sessions_df = data["sessions_df"]

st.markdown(f"### {data['year']} Season")

session_keys = tuple(sessions_df["session_key"].tolist())
rc_df = get_race_control(session_keys)

if rc_df.empty:
    st.info("No race control data available for this season.")
    st.stop()

rc_df = rc_df.merge(sessions_df[["session_key", "location", "session_name", "date_start"]], on="session_key")
rc_df["race"] = rc_df["location"] + " (" + rc_df["session_name"] + ")"

col1, col2 = st.columns(2)

with col1:
    st.subheader("Events by category")
    cat_counts = rc_df["category"].value_counts().reset_index()
    cat_counts.columns = ["category", "count"]
    fig_cat = px.bar(cat_counts, x="category", y="count", labels={"category": "Category", "count": "Events"})
    fig_cat.update_layout(xaxis_title=None)
    st.plotly_chart(fig_cat, use_container_width=True)

with col2:
    st.subheader("Safety car / VSC events by round")
    sc_df = rc_df[rc_df["category"] == "SafetyCar"]
    if sc_df.empty:
        st.info("No safety car or VSC deployments recorded for this season.")
    else:
        sc_counts = sc_df.groupby("race", as_index=False).size()
        fig_sc = px.bar(sc_counts, x="race", y="size", labels={"race": "Round", "size": "Safety car events"})
        fig_sc.update_xaxes(tickangle=45)
        st.plotly_chart(fig_sc, use_container_width=True)

st.subheader("Message log for a race")
race_options = sessions_df.sort_values("date_start", ascending=False)
race_labels = {row.session_key: f"{row.location} ({row.session_name})" for row in race_options.itertuples()}
selected_key = st.selectbox(
    "Race", options=race_options["session_key"], format_func=lambda k: race_labels[k]
)

race_log = rc_df[rc_df["session_key"] == selected_key].sort_values("date")
display_cols = {"date": "Time", "category": "Category", "flag": "Flag", "lap_number": "Lap", "message": "Message"}
st.dataframe(
    race_log.rename(columns=display_cols)[list(display_cols.values())],
    use_container_width=True,
    hide_index=True,
)
