# OpenF1 Season Dashboard

A Streamlit app that displays basic driver stats for a Formula 1 season, pulled live
from the [OpenF1 API](https://github.com/br-g/openf1) (`api.openf1.org`).

Shows, per driver, for the selected season:

- Championship standings (points)
- Race wins and podium finishes
- Points progression across the season (cumulative)
- Average finishing position
- DNFs
- A full standings table

## Run

```bash
uv run streamlit run app.py
```

Then open the URL Streamlit prints (defaults to http://localhost:8501).

Use the sidebar to pick a season and whether to include Sprint sessions in the totals.
Data is fetched live from `api.openf1.org` and cached for an hour.
