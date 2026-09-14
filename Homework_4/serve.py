"""FastAPI service for the Race Chaos Index pipeline.

Loads the fitted bundle (``pipeline.joblib``, built by ``build_pipeline.py``)
once at import time and exposes it over HTTP. Only three files are needed to
run this service anywhere (including the Modal image): ``serve.py``,
``pipeline_def.py`` (the custom transformer's module, required for
unpickling), and ``pipeline.joblib`` (the fitted bundle).

Run locally::

    .venv/Scripts/python -m uvicorn serve:app --reload
    # then open http://localhost:8000/docs
"""

from __future__ import annotations

import os
from pathlib import Path
from typing import Literal, Optional

import numpy as np
from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, ConfigDict, Field, model_validator

from pipeline_def import FEATURE_DESCRIPTIONS, FEATURE_NAMES

# ---------------------------------------------------------------------------
# Bundle loading (once, at import time -- never per request)
# ---------------------------------------------------------------------------

_env_artifact_path = os.environ.get("CHAOS_ARTIFACT_PATH")
ARTIFACT_PATH = (
    Path(_env_artifact_path) if _env_artifact_path else Path(__file__).parent / "pipeline.joblib"
)

try:
    import joblib

    BUNDLE = joblib.load(ARTIFACT_PATH)
    LOAD_ERROR = None
except Exception as e:  # noqa: BLE001 - deliberately broad: any load failure -> 503, not 500
    BUNDLE = None
    LOAD_ERROR = repr(e)


def get_bundle():
    """FastAPI dependency: 503 (not 500) whenever the artifact isn't loaded."""
    if BUNDLE is None:
        raise HTTPException(
            status_code=503,
            detail=f"Model artifact not loaded: {LOAD_ERROR}",
        )
    return BUNDLE


# ---------------------------------------------------------------------------
# Scoring (pure function -- no FastAPI/HTTP dependency, easy to unit test)
# ---------------------------------------------------------------------------

def percentile_of(reference: np.ndarray, value: float) -> float:
    """0-100 percentile of ``value`` against a sorted ``reference`` array.

    Training races score exactly equal to an entry in ``reference``, and
    float noise across platforms (Windows build vs. Linux on Modal) can land
    the value just below that entry and shift the rank by one. The small
    tolerance makes ties count as "at or below" on every platform.
    """
    rank = np.searchsorted(reference, value + 1e-9, side="right")
    return float(rank) / len(reference) * 100.0


def label_for_percentile(percentile: float, label_thresholds: dict) -> str:
    if percentile >= label_thresholds["Legendary"]:
        return "Legendary"
    if percentile >= label_thresholds["Chaotic"]:
        return "Chaotic"
    if percentile >= label_thresholds["Eventful"]:
        return "Eventful"
    return "Calm"


def score_race(bundle: dict, race_dict: dict) -> dict:
    """Run one race dict (``{"results": [...], "track_status": {...}}``)
    through the fitted pipeline and return the API response payload.

    Note: the frontend only ever sends races that are already in the
    training set, so the nearest neighbor is almost always the query race
    itself at distance 0. To keep ``most_similar_races`` useful, we query 4
    neighbors and drop the first one only if it is an exact match (distance
    <= 1e-9), then return the top 3 of what's left. If there's no exact
    match (a genuinely novel race), we just return the top 3 as-is. Only
    one self-match is ever dropped -- a race that happens to tie another
    training race exactly is not treated specially beyond that.
    """
    pipeline = bundle["pipeline"]
    races = [race_dict]

    feats = pipeline[:-1].transform(races)  # shape (1, 6), each column in [0, 1]
    chaos_weights = bundle["chaos_weights"]
    chaos_raw = float((feats[0] @ chaos_weights) / chaos_weights.sum())
    weird_raw = float(-pipeline.score_samples(races)[0])

    chaos_percentile = percentile_of(bundle["chaos_reference"], chaos_raw)
    weirdness_percentile = percentile_of(bundle["weirdness_reference"], weird_raw)

    chaos_score = round(chaos_percentile, 1)
    weirdness_score = round(weirdness_percentile, 1)
    chaos_label = label_for_percentile(chaos_percentile, bundle["label_thresholds"])

    features = {
        name: round(float(val) * 100, 1) for name, val in zip(FEATURE_NAMES, feats[0])
    }

    neighbors = bundle["neighbors"]
    race_index = bundle["race_index"]
    n_query = min(4, len(race_index))
    distances, indices = neighbors.kneighbors(feats, n_neighbors=n_query)
    dists = list(distances[0])
    idxs = list(indices[0])

    # Drop only the first neighbor if it's an exact (self-)match; a query
    # race that isn't in the training set at all won't have one, and we
    # never drop more than this single leading exact match.
    if dists and dists[0] <= 1e-9:
        dists = dists[1:]
        idxs = idxs[1:]

    dists = dists[:3]
    idxs = idxs[:3]

    most_similar_races = [
        {
            "season": race_index[idx]["season"],
            "round": race_index[idx]["round"],
            "race_name": race_index[idx]["race_name"],
            "distance": round(float(dist), 4),
        }
        for idx, dist in zip(idxs, dists)
    ]

    return {
        "chaos_score": chaos_score,
        "chaos_label": chaos_label,
        "chaos_percentile": round(chaos_percentile, 1),
        "weirdness_score": weirdness_score,
        "weirdness_percentile": round(weirdness_percentile, 1),
        "features": features,
        "most_similar_races": most_similar_races,
    }


# ---------------------------------------------------------------------------
# Request / response models
# ---------------------------------------------------------------------------

_EXAMPLE_RACE = {
    "results": [
        {"grid": 2, "position": 1, "laps": 70, "status": "finished", "time_millis": 6347927},
        {"grid": 3, "position": 2, "laps": 70, "status": "finished", "time_millis": 6351806},
        {"grid": 1, "position": 3, "laps": 70, "status": "finished", "time_millis": 6352244},
        {"grid": 7, "position": 4, "laps": 70, "status": "finished", "time_millis": 6352842},
        {"grid": 4, "position": 5, "laps": 70, "status": "finished", "time_millis": 6358126},
        {"grid": 6, "position": 6, "laps": 70, "status": "finished", "time_millis": 6365437},
        {"grid": 9, "position": 7, "laps": 70, "status": "finished", "time_millis": 6371552},
        {"grid": 5, "position": 8, "laps": 70, "status": "finished", "time_millis": 6376599},
        {"grid": 15, "position": 9, "laps": 70, "status": "finished", "time_millis": 6377948},
        {"grid": 18, "position": 10, "laps": 70, "status": "finished", "time_millis": 6378240},
        {"grid": 17, "position": 11, "laps": 70, "status": "finished", "time_millis": 6378751},
        {"grid": 14, "position": 12, "laps": 70, "status": "finished", "time_millis": 6379180},
        {"grid": 19, "position": 13, "laps": 70, "status": "finished", "time_millis": 6388414},
        {"grid": 8, "position": 14, "laps": 70, "status": "finished", "time_millis": 6400621},
        {"grid": 20, "position": 15, "laps": 69, "status": "lapped", "time_millis": 6401455},
        {"grid": 12, "position": 16, "laps": 52, "status": "retired", "time_millis": None},
        {"grid": 10, "position": 17, "laps": 52, "status": "retired", "time_millis": None},
        {"grid": 16, "position": 18, "laps": 51, "status": "retired", "time_millis": None},
        {"grid": 11, "position": 19, "laps": 40, "status": "retired", "time_millis": None},
        {"grid": 13, "position": 20, "laps": 23, "status": "retired", "time_millis": None},
    ],
    "track_status": {"safety_cars": 2, "virtual_safety_cars": 0, "red_flags": 0},
}


class ResultRow(BaseModel):
    model_config = ConfigDict(extra="forbid")

    grid: int = Field(..., ge=0, le=30, description="Starting grid slot; 0 = pit-lane start.")
    position: int = Field(..., ge=1, le=30, description="Finishing classification position.")
    laps: int = Field(..., ge=0, le=100, description="Completed laps.")
    status: Literal["finished", "lapped", "retired", "dns", "dsq"]
    time_millis: Optional[int] = Field(
        None,
        ge=3_000_000,
        le=15_000_000,
        description="Race time in milliseconds for lead-lap finishers, else null.",
    )


class TrackStatus(BaseModel):
    model_config = ConfigDict(extra="forbid")

    safety_cars: int = Field(..., ge=0, le=10)
    virtual_safety_cars: int = Field(..., ge=0, le=10)
    red_flags: int = Field(..., ge=0, le=5)


class ChaosScoreRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", json_schema_extra={"example": _EXAMPLE_RACE})

    results: list[ResultRow] = Field(..., min_length=10, max_length=26)
    track_status: TrackStatus

    @model_validator(mode="after")
    def _check_results_consistency(self) -> "ChaosScoreRequest":
        positions = [r.position for r in self.results]

        winners = [p for p in positions if p == 1]
        if len(winners) != 1:
            raise ValueError(
                f"exactly one result must have position == 1 (found {len(winners)})"
            )

        if len(set(positions)) != len(positions):
            raise ValueError("positions must be unique across results")

        has_finished_with_time = any(
            r.status == "finished" and r.time_millis is not None for r in self.results
        )
        if not has_finished_with_time:
            raise ValueError(
                "at least one 'finished' result must have a non-null time_millis"
            )

        return self


class SimilarRace(BaseModel):
    season: int
    round: int
    race_name: str
    distance: float


class ChaosScoreResponse(BaseModel):
    chaos_score: float
    chaos_label: str
    chaos_percentile: float
    weirdness_score: float
    weirdness_percentile: float
    features: dict[str, float]
    most_similar_races: list[SimilarRace]


# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------

app = FastAPI(
    title="Race Chaos Index API",
    description=(
        "Scores a single Formula 1 race's results + neutralization counts "
        "for how 'chaotic' (directionally eventful) and 'weird' "
        "(non-directionally unusual, via IsolationForest) it was, versus "
        "~185 historical races (2018-2026). Backed by a fitted scikit-learn "
        "Pipeline with a custom RaceChaosFeaturizer transformer."
    ),
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://f1-dashboard-green.vercel.app",
        "http://localhost:3000",
    ],
    allow_origin_regex=r"https://f1-dashboard-.*\.vercel\.app",
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


@app.get("/")
def root():
    return {
        "name": "Race Chaos Index API",
        "docs": "/docs",
        "health": "/health",
        "info": "/info",
    }


@app.get("/health")
def health(bundle: dict = Depends(get_bundle)):
    return {"status": "ok", "model_loaded": True}


@app.get("/info")
def info(bundle: dict = Depends(get_bundle)):
    return {
        "metadata": bundle["metadata"],
        "feature_descriptions": FEATURE_DESCRIPTIONS,
        "label_thresholds": bundle["label_thresholds"],
        "example_request": bundle["example_request"],
    }


@app.post("/chaos-score", response_model=ChaosScoreResponse)
def chaos_score(body: ChaosScoreRequest, bundle: dict = Depends(get_bundle)):
    race_dict = body.model_dump()
    return score_race(bundle, race_dict)
