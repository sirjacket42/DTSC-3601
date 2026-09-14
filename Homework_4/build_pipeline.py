"""Fit the Race Chaos Index pipeline and dump the serving bundle.

Reads ``data/training_races.json`` (produced by ``fetch_data.py``), fits the
scikit-learn Pipeline described in IDEA_BRIEF.md, and writes:

- ``pipeline.joblib``: the bundle dict consumed by ``serve.py``.
- ``data/races.csv``: the per-race engineered feature table (raw features,
  quantile-transformed features, chaos/weirdness scores and label) for
  offline inspection / reproducibility.

Usage::

    .venv/Scripts/python build_pipeline.py             # fit from cached data/training_races.json
    .venv/Scripts/python build_pipeline.py --fetch      # re-run fetch_data.main() first

The custom transformer is always imported from ``pipeline_def`` -- never
redefined here -- so joblib records it as ``pipeline_def.RaceChaosFeaturizer``
and it stays loadable from ``serve.py`` and inside the Modal image.
"""

from __future__ import annotations

import argparse
import csv
import json
import platform
import sys
from datetime import datetime, timezone
from pathlib import Path

import joblib
import numpy as np
import sklearn
from sklearn.ensemble import IsolationForest
from sklearn.neighbors import NearestNeighbors
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import QuantileTransformer

from pipeline_def import FEATURE_DESCRIPTIONS, FEATURE_NAMES, RaceChaosFeaturizer

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
TRAINING_RACES_PATH = DATA_DIR / "training_races.json"
ARTIFACT_PATH = BASE_DIR / "pipeline.joblib"
RACES_CSV_PATH = DATA_DIR / "races.csv"

LABEL_THRESHOLDS = {"Eventful": 50, "Chaotic": 80, "Legendary": 95}


def percentile_of(reference: np.ndarray, value: float) -> float:
    """0-100 percentile of ``value`` against a sorted ``reference`` array."""
    rank = np.searchsorted(reference, value, side="right")
    return float(rank) / len(reference) * 100.0


def label_for_percentile(percentile: float) -> str:
    if percentile >= LABEL_THRESHOLDS["Legendary"]:
        return "Legendary"
    if percentile >= LABEL_THRESHOLDS["Chaotic"]:
        return "Chaotic"
    if percentile >= LABEL_THRESHOLDS["Eventful"]:
        return "Eventful"
    return "Calm"


def load_training_entries(path: Path) -> list[dict]:
    with open(path, "r", encoding="utf-8") as f:
        entries = json.load(f)
    return entries


def build(fetch: bool = False) -> None:
    if fetch:
        print("[build_pipeline] --fetch given: running fetch_data.main() first...")
        import fetch_data

        old_argv = sys.argv
        try:
            # fetch_data.main() does its own argparse over sys.argv; don't
            # leak build_pipeline's own CLI flags into it.
            sys.argv = [old_argv[0]]
            fetch_data.main()
        finally:
            sys.argv = old_argv

    print(f"[build_pipeline] loading {TRAINING_RACES_PATH} ...")
    entries = load_training_entries(TRAINING_RACES_PATH)
    n_races = len(entries)
    print(f"[build_pipeline] {n_races} training races loaded")

    races = [e["race"] for e in entries]
    race_index = [
        {"season": e["season"], "round": e["round"], "race_name": e["race_name"]}
        for e in entries
    ]
    seasons = sorted({e["season"] for e in entries})

    pipeline = Pipeline(
        [
            ("chaos_features", RaceChaosFeaturizer()),
            (
                "quantiles",
                QuantileTransformer(n_quantiles=n_races, output_distribution="uniform"),
            ),
            ("weirdness", IsolationForest(random_state=42, n_estimators=300)),
        ]
    )

    print("[build_pipeline] fitting pipeline...")
    pipeline.fit(races)

    feats = pipeline[:-1].transform(races)  # (n_races, 6), each column in [0, 1]
    raw_feats = pipeline.named_steps["chaos_features"].transform(races)

    chaos_weights = np.ones(len(FEATURE_NAMES))
    chaos_raw = (feats @ chaos_weights) / chaos_weights.sum()
    weird_raw = -pipeline.score_samples(races)  # higher = weirder

    chaos_reference = np.sort(chaos_raw)
    weirdness_reference = np.sort(weird_raw)

    chaos_percentiles = np.array([percentile_of(chaos_reference, v) for v in chaos_raw])
    chaos_scores = np.round(chaos_percentiles, 1)
    chaos_labels = [label_for_percentile(p) for p in chaos_percentiles]

    weirdness_percentiles = np.array(
        [percentile_of(weirdness_reference, v) for v in weird_raw]
    )
    weirdness_scores = np.round(weirdness_percentiles, 1)

    neighbors = NearestNeighbors(n_neighbors=3)
    neighbors.fit(feats)

    example_entry = next(
        (
            e
            for e in entries
            if e["season"] == 2024 and e["race_name"] == "Canadian Grand Prix"
        ),
        None,
    )
    if example_entry is None:
        raise RuntimeError("2024 Canadian Grand Prix not found in training data")
    example_request = example_entry["race"]

    metadata = {
        "steps": [
            {"name": name, "class": f"{type(step).__module__}.{type(step).__qualname__}"}
            for name, step in pipeline.steps
        ],
        "built_at": datetime.now(timezone.utc).isoformat(),
        "sklearn_version": sklearn.__version__,
        "numpy_version": np.__version__,
        "joblib_version": joblib.__version__,
        "python_version": platform.python_version(),
        "n_training_races": n_races,
        "seasons": seasons,
        "feature_names": list(FEATURE_NAMES),
    }

    bundle = {
        "pipeline": pipeline,
        "chaos_weights": chaos_weights,
        "chaos_reference": chaos_reference,
        "weirdness_reference": weirdness_reference,
        "label_thresholds": LABEL_THRESHOLDS,
        "neighbors": neighbors,
        "race_index": race_index,
        "example_request": example_request,
        "metadata": metadata,
    }

    joblib.dump(bundle, ARTIFACT_PATH)
    print(f"[build_pipeline] wrote {ARTIFACT_PATH}")

    # -- data/races.csv ------------------------------------------------
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    with open(RACES_CSV_PATH, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        header = (
            ["season", "round", "race_name"]
            + [f"raw_{name}" for name in FEATURE_NAMES]
            + [f"q_{name}" for name in FEATURE_NAMES]
            + ["chaos_score", "chaos_label", "weirdness_score"]
        )
        writer.writerow(header)
        for i, ridx in enumerate(race_index):
            row = (
                [ridx["season"], ridx["round"], ridx["race_name"]]
                + [f"{v:.6f}" for v in raw_feats[i]]
                + [f"{v:.6f}" for v in feats[i]]
                + [f"{chaos_scores[i]:.1f}", chaos_labels[i], f"{weirdness_scores[i]:.1f}"]
            )
            writer.writerow(row)
    print(f"[build_pipeline] wrote {RACES_CSV_PATH}")

    # -- console report --------------------------------------------------
    order = np.argsort(chaos_raw)  # ascending
    def fmt(i):
        r = race_index[i]
        return (
            f"  {r['season']} R{r['round']:<2} {r['race_name']:<28} "
            f"chaos={chaos_scores[i]:5.1f} ({chaos_labels[i]:<9}) "
            f"weirdness={weirdness_scores[i]:5.1f}"
        )

    print("\n[report] Top 10 races by chaos:")
    for i in order[::-1][:10]:
        print(fmt(i))

    print("\n[report] Bottom 10 races by chaos:")
    for i in order[:10]:
        print(fmt(i))

    weird_order = np.argsort(weird_raw)
    print("\n[report] Top 5 races by weirdness:")
    for i in weird_order[::-1][:5]:
        print(fmt(i))

    print("\n[report] Label counts:")
    from collections import Counter

    counts = Counter(chaos_labels)
    for label in ["Calm", "Eventful", "Chaotic", "Legendary"]:
        print(f"  {label:<10}: {counts.get(label, 0)}")

    canada_i = next(
        i
        for i, r in enumerate(race_index)
        if r["season"] == 2024 and r["race_name"] == "Canadian Grand Prix"
    )
    print("\n[report] 2024 Canadian Grand Prix:")
    print(fmt(canada_i))
    print(f"  raw features: {dict(zip(FEATURE_NAMES, raw_feats[canada_i].tolist()))}")
    print(f"  quantile features (0-1): {dict(zip(FEATURE_NAMES, feats[canada_i].tolist()))}")

    print(f"\n[report] metadata: {json.dumps(metadata, indent=2)}")
    print("\n[build_pipeline] done.")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--fetch",
        action="store_true",
        help="Run fetch_data.main() first to refresh data/training_races.json.",
    )
    args = parser.parse_args()
    build(fetch=args.fetch)


if __name__ == "__main__":
    main()
