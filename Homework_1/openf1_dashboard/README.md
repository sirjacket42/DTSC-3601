# OpenF1 Season Dashboard

A Streamlit app that displays driver and constructor stats for a Formula 1 season.
Most pages pull live from the [OpenF1 API](https://github.com/br-g/openf1)
(`api.openf1.org`); the Dataset & EDA page reads a static CSV snapshot.

Multipage layout, one topic per page:

- **Overview** (`app.py`) — championship standings and the full standings table
- **Dataset & EDA** — initial exploratory data analysis on `data/f1_2025_results.csv`
  (shape, dtypes, missing values, summary statistics, and a few graphics)
- **Driver Stats** — wins, podiums, average finishing position, DNFs
- **Constructors** — points, wins, and podiums by team
- **Points Progression** — cumulative points across the season, round by round
- **Tire Strategy** — compound and stint length per driver, for a selected race
- **Weather** — track/air temperature and wet-vs-dry conditions by round
- **Fastest Laps** — fastest lap and speed-trap leaderboards, for a selected race
- **Race Control** — flags/safety car event counts, plus the message log for a selected race

## Run

```bash
uv run streamlit run app.py
```

Then open the URL Streamlit prints (defaults to http://localhost:8501).

Use the sidebar to pick a season and whether to include Sprint sessions in the totals;
the choice is shared across every page (except Dataset & EDA, which is tied to whatever
CSV snapshot exists in `data/`). Live data is fetched from `api.openf1.org` and cached
for an hour.

## The dataset

`data/f1_2025_results.csv` is a one-time snapshot (one row per driver per race: round,
location, driver, team, finishing position, points, laps, gap to leader, DNF/DNS/DSQ)
used for the Dataset & EDA page. Regenerate or refresh it with:

```bash
uv run python scripts/export_dataset.py [year]
```

## Code layout

- `common.py` — all live API calls and shared aggregation logic (`@st.cache_data`, so
  the same fetch is never repeated across pages)
- `scripts/export_dataset.py` — builds the CSV snapshot in `data/`
- `app.py` — the Overview page (Streamlit's multipage entry point)
- `pages/` — one file per additional page, auto-discovered by Streamlit

## Screenshots

Screenshots below are from the 2025 season, "Race only" mode, race = Yas Island
(where a race selector is shown). All live data shown was current as of when these
were taken.

### Dataset & EDA
Loads `data/f1_2025_results.csv` (a static CSV snapshot, not the live API) and shows
the raw data, shape/dtypes, missing-value counts, summary statistics, and three
graphics (points distribution, finishing position by team, points vs. gap to leader).

[<img src="screenshots/0_dataset_eda.png">](https://raw.githubusercontent.com/sirjacket42/DTSC-3601/master/Homework_1/openf1_dashboard/screenshots/0_dataset_eda.png)
[<img src="screenshots/0_dataset_eda_b.png">](https://raw.githubusercontent.com/sirjacket42/DTSC-3601/master/Homework_1/openf1_dashboard/screenshots/0_dataset_eda_b.png)

### Overview
Championship standings bar chart, full standings table, and the "Explore more" page
links at the bottom.

[<img src="screenshots/1_overview.png">](https://raw.githubusercontent.com/sirjacket42/DTSC-3601/master/Homework_1/openf1_dashboard/screenshots/1_overview.png)
[<img src="screenshots/1_overview_b.png">](https://raw.githubusercontent.com/sirjacket42/DTSC-3601/master/Homework_1/openf1_dashboard/screenshots/1_overview_b.png)

### Driver Stats
Race wins, podium finishes, average finishing position, and DNFs, all by driver.

[<img src="screenshots/2_driver_stats.png">](https://raw.githubusercontent.com/sirjacket42/DTSC-3601/master/Homework_1/openf1_dashboard/screenshots/2_driver_stats.png)
[<img src="screenshots/2_driver_stats_b.png">](https://raw.githubusercontent.com/sirjacket42/DTSC-3601/master/Homework_1/openf1_dashboard/screenshots/2_driver_stats_b.png)

### Constructors
Points/wins/podiums by team, plus the constructors' table.

[<img src="screenshots/3_constructors.png">](https://raw.githubusercontent.com/sirjacket42/DTSC-3601/master/Homework_1/openf1_dashboard/screenshots/3_constructors.png)
[<img src="screenshots/3_constructors_b.png">](https://raw.githubusercontent.com/sirjacket42/DTSC-3601/master/Homework_1/openf1_dashboard/screenshots/3_constructors_b.png)

### Points Progression
Cumulative points per driver across the season, with a "top N drivers" slider.

[<img src="screenshots/4_points_progression.png">](https://raw.githubusercontent.com/sirjacket42/DTSC-3601/master/Homework_1/openf1_dashboard/screenshots/4_points_progression.png)

### Tire Strategy
Per-driver stint length and tire compound for a selected race, ordered by finishing
position.

[<img src="screenshots/5_tire_strategy.png">](https://raw.githubusercontent.com/sirjacket42/DTSC-3601/master/Homework_1/openf1_dashboard/screenshots/5_tire_strategy.png)

### Weather
Track/air temperature by round, wet-vs-dry rounds, and a weather summary table.

[<img src="screenshots/6_weather.png">](https://raw.githubusercontent.com/sirjacket42/DTSC-3601/master/Homework_1/openf1_dashboard/screenshots/6_weather.png)
[<img src="screenshots/6_weather_b.png">](https://raw.githubusercontent.com/sirjacket42/DTSC-3601/master/Homework_1/openf1_dashboard/screenshots/6_weather_b.png)

### Fastest Laps
Gap-to-fastest-lap and speed-trap leaderboards for a selected race.

[<img src="screenshots/7_fastest_laps.png">](https://raw.githubusercontent.com/sirjacket42/DTSC-3601/master/Homework_1/openf1_dashboard/screenshots/7_fastest_laps.png)

### Race Control
Event counts by category, safety car/VSC events by round, and the race control
message log for a selected race.

[<img src="screenshots/8_race_control.png">](https://raw.githubusercontent.com/sirjacket42/DTSC-3601/master/Homework_1/openf1_dashboard/screenshots/8_race_control.png)
[<img src="screenshots/8_race_control_b.png">](https://raw.githubusercontent.com/sirjacket42/DTSC-3601/master/Homework_1/openf1_dashboard/screenshots/8_race_control_b.png)
