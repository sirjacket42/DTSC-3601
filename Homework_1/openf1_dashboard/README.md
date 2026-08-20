# OpenF1 Season Dashboard

A Streamlit app that displays driver and constructor stats for a Formula 1 season,
pulled live from the [OpenF1 API](https://github.com/br-g/openf1) (`api.openf1.org`).

Multipage layout, one topic per page:

- **Overview** (`app.py`) — championship standings and the full standings table
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
the choice is shared across every page. Data is fetched live from `api.openf1.org` and
cached for an hour.

## Code layout

- `common.py` — all API calls and shared aggregation logic (`@st.cache_data`, so the
  same fetch is never repeated across pages)
- `app.py` — the Overview page (Streamlit's multipage entry point)
- `pages/` — one file per additional page, auto-discovered by Streamlit
