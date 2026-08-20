"""One-off script that snapshots a season of OpenF1 race results to a CSV.

Run with: uv run python scripts/export_dataset.py [year]

The rest of the app fetches live from api.openf1.org, but the Dataset & EDA
page (pages/0_Dataset_EDA.py) reads this static CSV -- a reproducible,
version-controlled dataset independent of the live API's current state.
"""

import sys

import pandas as pd
import requests

API = "https://api.openf1.org/v1"


def export(year: int, out_path: str) -> None:
    sessions = requests.get(f"{API}/sessions", params={"year": year, "session_type": "Race"}, timeout=30).json()
    sessions = [s for s in sessions if s["session_name"] == "Race"]
    if not sessions:
        raise SystemExit(f"No race sessions found for {year}")

    sessions_df = pd.DataFrame(sessions)
    sessions_df["date_start"] = pd.to_datetime(sessions_df["date_start"])
    sessions_df = sessions_df.sort_values("date_start").reset_index(drop=True)
    sessions_df["round"] = range(1, len(sessions_df) + 1)

    keys = sessions_df["session_key"].tolist()
    key_set = set(keys)
    min_key, max_key = min(keys), max(keys)

    results = requests.get(f"{API}/session_result?session_key>={min_key}&session_key<={max_key}", timeout=60).json()
    results_df = pd.DataFrame([r for r in results if r["session_key"] in key_set])

    drivers = requests.get(f"{API}/drivers?session_key>={min_key}&session_key<={max_key}", timeout=60).json()
    drivers_df = pd.DataFrame([d for d in drivers if d["session_key"] in key_set])
    drivers_latest = (
        drivers_df[["driver_number", "full_name", "name_acronym", "team_name"]]
        .drop_duplicates(subset="driver_number", keep="last")
    )

    merged = results_df.merge(
        sessions_df[["session_key", "round", "location", "date_start"]], on="session_key", how="left"
    )
    merged = merged.merge(drivers_latest, on="driver_number", how="left")
    merged = merged.dropna(subset=["full_name"])
    merged["points"] = merged["points"].fillna(0)

    cols = [
        "round", "location", "date_start", "driver_number", "full_name", "team_name",
        "position", "points", "number_of_laps", "gap_to_leader", "duration", "dnf", "dns", "dsq",
    ]
    merged = merged[cols].sort_values(["round", "position"]).reset_index(drop=True)
    merged.to_csv(out_path, index=False)
    print(f"Wrote {len(merged)} rows to {out_path}")


if __name__ == "__main__":
    year = int(sys.argv[1]) if len(sys.argv) > 1 else 2025
    export(year, f"data/f1_{year}_results.csv")
