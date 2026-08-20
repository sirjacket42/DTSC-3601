OpenF1 Season Dashboard - Screenshots
======================================

This is a secondary, plain-text readme with screenshots of the app running
(2025 season, "Race only" mode). See README.md for setup/usage instructions.

Run it yourself with:
    uv run streamlit run app.py

Screenshots (in screenshots/, top of the page to bottom):

1. screenshots/1_standings.png
   Page header and the championship standings bar chart (points per driver,
   colored by team).

2. screenshots/2_wins_podiums.png
   Race wins and podium finishes bar charts side by side.

3. screenshots/3_progression.png
   Wins/podiums charts plus the cumulative points progression line chart
   across the season, with the "top N drivers" slider.

4. screenshots/4_avgfinish_dnfs.png
   Average finishing position and DNF bar charts, plus the top of the full
   standings table (driver, team, points, wins, podiums, races, avg finish,
   DNFs).

All data shown is live from api.openf1.org at the time these screenshots
were taken.
