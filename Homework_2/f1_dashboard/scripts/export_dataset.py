"""One-off script that snapshots multiple F1 seasons of OpenF1 race results to a CSV.

Run with: uv run python scripts/export_dataset.py [start_year] [end_year]

Combines every season in [start_year, end_year] into a single CSV that the
upload script (scripts/upload_to_supabase.py) loads into the Supabase table.
"""

import sys

import pandas as pd
import requests

API = "https://api.openf1.org/v1"


def export_year(year: int) -> pd.DataFrame:
    sessions = requests.get(f"{API}/sessions", params={"year": year, "session_type": "Race"}, timeout=30).json()
    sessions = [s for s in sessions if s["session_name"] == "Race"]
    if not sessions:
        print(f"No race sessions found for {year}, skipping")
        return pd.DataFrame()

    sessions_df = pd.DataFrame(sessions)
    sessions_df["date_start"] = pd.to_datetime(sessions_df["date_start"])
    sessions_df = sessions_df.sort_values("date_start").reset_index(drop=True)
    sessions_df["round"] = range(1, len(sessions_df) + 1)

    keys = sessions_df["session_key"].tolist()
    key_set = set(keys)
    min_key, max_key = min(keys), max(keys)

    results = requests.get(f"{API}/session_result?session_key>={min_key}&session_key<={max_key}", timeout=60).json()
    results_df = pd.DataFrame([r for r in results if r["session_key"] in key_set])
    if results_df.empty:
        print(f"No results found for {year}, skipping")
        return pd.DataFrame()

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
    merged["season"] = year

    cols = [
        "season", "round", "location", "date_start", "driver_number", "full_name", "team_name",
        "position", "points", "number_of_laps", "gap_to_leader", "duration", "dnf", "dns", "dsq",
    ]
    merged = merged[cols].sort_values(["season", "round", "position"]).reset_index(drop=True)
    print(f"{year}: {len(merged)} rows")
    return merged


def export(start_year: int, end_year: int, out_path: str) -> None:
    frames = [export_year(y) for y in range(start_year, end_year + 1)]
    combined = pd.concat([f for f in frames if not f.empty], ignore_index=True)
    combined.to_csv(out_path, index=False)
    print(f"Wrote {len(combined)} total rows to {out_path}")


if __name__ == "__main__":
    start_year = int(sys.argv[1]) if len(sys.argv) > 1 else 2023
    end_year = int(sys.argv[2]) if len(sys.argv) > 2 else 2026
    export(start_year, end_year, f"data/f1_{start_year}_{end_year}_results.csv")
