"""Track/air temperature and rainfall per round across the season."""

import plotly.express as px
import streamlit as st

from common import get_weather, load_core_data

st.set_page_config(page_title="Weather - OpenF1", page_icon="🌦️", layout="wide")
st.title("🌦️ Weather")

data = load_core_data()
sessions_df = data["sessions_df"]

st.markdown(f"### {data['year']} Season")

session_keys = tuple(sessions_df["session_key"].tolist())
weather_df = get_weather(session_keys)

if weather_df.empty:
    st.info("No weather data available for this season.")
    st.stop()

summary = (
    weather_df.groupby("session_key", as_index=False)
    .agg(
        air_temperature=("air_temperature", "mean"),
        track_temperature=("track_temperature", "mean"),
        humidity=("humidity", "mean"),
        wind_speed=("wind_speed", "mean"),
        rainfall=("rainfall", "max"),
    )
    .merge(sessions_df[["session_key", "location", "session_name", "date_start"]], on="session_key")
    .sort_values("date_start")
)
summary["race"] = summary["location"] + " (" + summary["session_name"] + ")"
summary["conditions"] = summary["rainfall"].apply(lambda r: "Wet" if r else "Dry")

st.subheader("Track & air temperature by round")
fig_temp = px.line(
    summary,
    x="race",
    y=["track_temperature", "air_temperature"],
    markers=True,
    labels={"race": "Round", "value": "Temperature (°C)", "variable": "Measurement"},
)
fig_temp.update_xaxes(tickangle=45)
st.plotly_chart(fig_temp, use_container_width=True)

st.subheader("Wet vs. dry rounds")
fig_rain = px.bar(
    summary,
    x="race",
    y="rainfall",
    color="conditions",
    color_discrete_map={"Wet": "#0067AD", "Dry": "#F0F0F0"},
    labels={"race": "Round", "rainfall": "Rainfall detected"},
)
fig_rain.update_xaxes(tickangle=45)
fig_rain.update_layout(yaxis=dict(tickvals=[0, 1], ticktext=["No", "Yes"]))
st.plotly_chart(fig_rain, use_container_width=True)

st.subheader("Weather summary table")
display_cols = {
    "race": "Round",
    "conditions": "Conditions",
    "air_temperature": "Air temp (°C)",
    "track_temperature": "Track temp (°C)",
    "humidity": "Humidity (%)",
    "wind_speed": "Wind (m/s)",
}
st.dataframe(
    summary.rename(columns=display_cols)[list(display_cols.values())].style.format(
        {"Air temp (°C)": "{:.1f}", "Track temp (°C)": "{:.1f}", "Humidity (%)": "{:.0f}", "Wind (m/s)": "{:.1f}"}
    ),
    use_container_width=True,
    hide_index=True,
)
