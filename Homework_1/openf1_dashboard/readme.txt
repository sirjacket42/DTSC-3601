OpenF1 Season Dashboard - Screenshots
======================================

This is a secondary, plain-text readme with screenshots of the app running
(2025 season, "Race only" mode, race = Yas Island where a race selector is
shown). See README.md for setup/usage/code-layout details.

Run it yourself with:
    uv run streamlit run app.py

The app is a multipage Streamlit app -- one topic per page, listed in the
sidebar nav. Screenshots below (in screenshots/), one or two per page:

0. screenshots/0_dataset_eda.png, 0_dataset_eda_b.png
   Dataset & EDA page: loads data/f1_2025_results.csv (a static CSV
   snapshot, not the live API) and shows the raw data, shape/dtypes,
   missing-value counts, summary statistics, and three graphics (points
   distribution, finishing position by team, points vs. gap to leader).

1. screenshots/1_overview.png, 1_overview_b.png
   Overview page: championship standings bar chart, full standings table,
   and the "Explore more" page links at the bottom.

2. screenshots/2_driver_stats.png, 2_driver_stats_b.png
   Driver Stats page: race wins, podium finishes, average finishing
   position, and DNFs, all by driver.

3. screenshots/3_constructors.png, 3_constructors_b.png
   Constructors page: points/wins/podiums by team, plus the constructors'
   table.

4. screenshots/4_points_progression.png
   Points Progression page: cumulative points per driver across the
   season, with a "top N drivers" slider.

5. screenshots/5_tire_strategy.png
   Tire Strategy page: per-driver stint length and tire compound for a
   selected race, ordered by finishing position.

6. screenshots/6_weather.png, 6_weather_b.png
   Weather page: track/air temperature by round, wet-vs-dry rounds, and a
   weather summary table.

7. screenshots/7_fastest_laps.png
   Fastest Laps & Top Speed page: gap-to-fastest-lap and speed-trap
   leaderboards for a selected race.

8. screenshots/8_race_control.png, 8_race_control_b.png
   Race Control page: event counts by category, safety car/VSC events by
   round, and the race control message log for a selected race.

All data shown is live from api.openf1.org at the time these screenshots
were taken.
