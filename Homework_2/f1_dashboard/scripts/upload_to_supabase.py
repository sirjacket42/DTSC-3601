"""Loads data/f1_*_results.csv into the Supabase f1_results table via the REST API.

Requires SUPABASE_URL and SUPABASE_KEY in the environment (see .env.example).
Run with: uv run python scripts/upload_to_supabase.py <csv_path>
"""

import math
import os
import sys

import pandas as pd
import requests


def clean(v):
    if v is None:
        return None
    if isinstance(v, float) and math.isnan(v):
        return None
    return v

BATCH_SIZE = 500


def main(csv_path: str) -> None:
    url = os.environ["SUPABASE_URL"].rstrip("/")
    key = os.environ["SUPABASE_KEY"]

    df = pd.read_csv(csv_path)
    df["date_start"] = pd.to_datetime(df["date_start"]).dt.strftime("%Y-%m-%dT%H:%M:%S%z")
    records = [{k: clean(v) for k, v in row.items()} for row in df.to_dict(orient="records")]

    headers = {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
        "Prefer": "return=minimal",
    }

    for i in range(0, len(records), BATCH_SIZE):
        batch = records[i : i + BATCH_SIZE]
        resp = requests.post(f"{url}/rest/v1/f1_results", json=batch, headers=headers, timeout=60)
        if resp.status_code >= 300:
            raise SystemExit(f"Batch {i // BATCH_SIZE} failed: {resp.status_code} {resp.text[:500]}")
        print(f"Inserted rows {i}-{i + len(batch)}")

    print(f"Done: uploaded {len(records)} rows")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "data/f1_2023_2026_results.csv")
