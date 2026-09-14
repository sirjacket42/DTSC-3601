"""Tests for serve.py (FastAPI app) using TestClient."""

import copy
import json
import os
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import pytest
from fastapi.testclient import TestClient

import serve
from serve import _EXAMPLE_RACE, app

BASE_DIR = Path(__file__).resolve().parent.parent

client = TestClient(app)


def _valid_body():
    return copy.deepcopy(_EXAMPLE_RACE)


# ---------------------------------------------------------------------------
# Happy path
# ---------------------------------------------------------------------------

def test_health_ok():
    resp = client.get("/health")
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "ok"
    assert body["model_loaded"] is True


def test_info_ok():
    resp = client.get("/info")
    assert resp.status_code == 200
    body = resp.json()
    assert "metadata" in body
    metadata = body["metadata"]
    assert isinstance(metadata["steps"], list) and len(metadata["steps"]) == 3
    assert "sklearn_version" in metadata
    assert "built_at" in metadata
    assert "feature_descriptions" in body
    assert "label_thresholds" in body
    assert "example_request" in body


def test_root_ok():
    resp = client.get("/")
    assert resp.status_code == 200
    body = resp.json()
    assert body["docs"] == "/docs"
    assert body["health"] == "/health"
    assert body["info"] == "/info"


def test_chaos_score_valid_2024_canada():
    resp = client.post("/chaos-score", json=_valid_body())
    assert resp.status_code == 200
    body = resp.json()

    assert 0.0 <= body["chaos_score"] <= 100.0
    assert 0.0 <= body["chaos_percentile"] <= 100.0
    assert 0.0 <= body["weirdness_score"] <= 100.0
    assert 0.0 <= body["weirdness_percentile"] <= 100.0
    assert body["chaos_label"] in {"Calm", "Eventful", "Chaotic", "Legendary"}

    assert len(body["features"]) == 6
    for v in body["features"].values():
        assert 0.0 <= v <= 100.0

    assert len(body["most_similar_races"]) == 3
    for race in body["most_similar_races"]:
        assert set(race.keys()) == {"season", "round", "race_name", "distance"}


def test_chaos_score_2024_canada_excludes_self_match():
    # This exact race is in the training set (2024 R9 Canadian GP), so the
    # single exact self-match must be dropped, leaving 3 *other* races.
    resp = client.post("/chaos-score", json=_valid_body())
    assert resp.status_code == 200
    body = resp.json()

    assert len(body["most_similar_races"]) == 3
    for race in body["most_similar_races"]:
        assert not (race["season"] == 2024 and race["round"] == 9)
        assert race["distance"] > 0.0


# ---------------------------------------------------------------------------
# 422 validation cases
# ---------------------------------------------------------------------------

def test_422_position_out_of_bounds():
    body = _valid_body()
    body["results"][0]["position"] = 99
    resp = client.post("/chaos-score", json=body)
    assert resp.status_code == 422


def test_422_too_few_results():
    body = _valid_body()
    body["results"] = body["results"][:3]
    resp = client.post("/chaos-score", json=body)
    assert resp.status_code == 422


def test_422_two_winners():
    body = _valid_body()
    body["results"][1]["position"] = 1
    resp = client.post("/chaos-score", json=body)
    assert resp.status_code == 422


def test_422_duplicate_positions():
    body = _valid_body()
    body["results"][2]["position"] = body["results"][3]["position"]
    resp = client.post("/chaos-score", json=body)
    assert resp.status_code == 422


def test_422_bad_status():
    body = _valid_body()
    body["results"][0]["status"] = "crashed_spectacularly"
    resp = client.post("/chaos-score", json=body)
    assert resp.status_code == 422


def test_422_time_millis_too_small():
    body = _valid_body()
    body["results"][0]["time_millis"] = 100  # far below the 3,000,000 floor
    resp = client.post("/chaos-score", json=body)
    assert resp.status_code == 422


def test_422_safety_cars_out_of_bounds():
    body = _valid_body()
    body["track_status"]["safety_cars"] = 11
    resp = client.post("/chaos-score", json=body)
    assert resp.status_code == 422


def test_422_extra_field_forbidden():
    body = _valid_body()
    body["unexpected_field"] = "surprise"
    resp = client.post("/chaos-score", json=body)
    assert resp.status_code == 422


def test_422_no_finished_row_with_time():
    body = _valid_body()
    for row in body["results"]:
        row["time_millis"] = None
    resp = client.post("/chaos-score", json=body)
    assert resp.status_code == 422


# ---------------------------------------------------------------------------
# 503 when the bundle isn't loaded
# ---------------------------------------------------------------------------

def test_health_503_when_bundle_missing(monkeypatch):
    monkeypatch.setattr(serve, "BUNDLE", None)
    resp = client.get("/health")
    assert resp.status_code == 503


def test_chaos_score_503_when_bundle_missing(monkeypatch):
    monkeypatch.setattr(serve, "BUNDLE", None)
    resp = client.post("/chaos-score", json=_valid_body())
    assert resp.status_code == 503


# ---------------------------------------------------------------------------
# Subprocess pickling check: pipeline.joblib must load without build_pipeline
# or __main__ ever having defined RaceChaosFeaturizer.
# ---------------------------------------------------------------------------

def test_pipeline_loads_in_subprocess_importing_only_pipeline_def():
    script = (
        "import sys; sys.path.insert(0, r'%s');"
        "import joblib;"
        "import pipeline_def;"
        "bundle = joblib.load(r'%s');"
        "pipeline = bundle['pipeline'];"
        "step = pipeline.named_steps['chaos_features'];"
        "assert type(step) is pipeline_def.RaceChaosFeaturizer, type(step);"
        "assert type(step).__module__ == 'pipeline_def', type(step).__module__;"
        "print('OK')"
    ) % (str(BASE_DIR), str(BASE_DIR / "pipeline.joblib"))

    result = subprocess.run(
        [sys.executable, "-c", script],
        capture_output=True,
        text=True,
    )
    assert result.returncode == 0, f"stdout={result.stdout!r} stderr={result.stderr!r}"
    assert "OK" in result.stdout
