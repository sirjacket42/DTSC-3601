"""Custom feature-engineering transformer for the Race Chaos Index pipeline.

This module ships standalone (numpy + scikit-learn only, no project imports)
because joblib pickles ``RaceChaosFeaturizer`` by module path
(``pipeline_def.RaceChaosFeaturizer``). It must be importable under that
exact path both locally (serve.py) and inside the Modal image, so never
define this class anywhere else (a build script, a notebook, ``__main__``).

Also contains ``normalize_status``, the raw-Jolpica-status -> category
mapping used by the build script (training) and the frontend (inference)
before rows are ever handed to the transformer -- ``RaceChaosFeaturizer``
itself expects ``status`` already collapsed to one of ``STATUS_CATEGORIES``.
"""

import re

import numpy as np
from sklearn.base import BaseEstimator, TransformerMixin

# ---------------------------------------------------------------------------
# Status normalization
# ---------------------------------------------------------------------------

STATUS_CATEGORIES = ("finished", "lapped", "retired", "dns", "dsq")

# Exact (case-insensitive, whitespace-stripped) raw Jolpica status strings.
_FINISHED_EXACT = {"finished"}
_LAPPED_EXACT = {"lapped"}
_DNS_EXACT = {
    "did not start",
    "did not qualify",
    "did not prequalify",
    "withdrew",
}
_DSQ_EXACT = {"disqualified", "excluded"}

# Matches "+1 Lap", "+2 Laps", "+12 lap", etc.
_LAPPED_RE = re.compile(r"^\+\d+\s*laps?$", re.IGNORECASE)


def normalize_status(raw: str) -> str:
    """Collapse a raw Jolpica ``status`` string (either era) into one of
    ``STATUS_CATEGORIES``: ``finished | lapped | retired | dns | dsq``.

    Case-insensitive and whitespace-stripped. "Not classified" and any
    other unrecognized string (including era-specific mechanical causes
    like "Engine"/"Brakes"/"Wheel") fall back to "retired".
    """
    text = (raw or "").strip().lower()

    if text in _FINISHED_EXACT:
        return "finished"
    if text in _LAPPED_EXACT or _LAPPED_RE.match(text):
        return "lapped"
    if text in _DNS_EXACT:
        return "dns"
    if text in _DSQ_EXACT:
        return "dsq"
    return "retired"


# ---------------------------------------------------------------------------
# Feature names / descriptions
# ---------------------------------------------------------------------------

FEATURE_NAMES = (
    "retirement_rate",
    "retirement_lap_spread",
    "position_shuffle",
    "winner_grid",
    "podium_closeness",
    "neutralizations",
)

FEATURE_DESCRIPTIONS = {
    "retirement_rate": (
        "Share of starters (non-DNS entries) whose race ended in a "
        "retirement."
    ),
    "retirement_lap_spread": (
        "Population standard deviation of retirees' completed laps, "
        "normalized by the winner's lap count (0 when fewer than two "
        "retirees, or the winner completed zero laps)."
    ),
    "position_shuffle": (
        "Mean absolute difference between starting grid slot and "
        "finishing position across classified (finished/lapped) cars; a "
        "pit-lane start (grid 0) counts as starting from the back of the "
        "field."
    ),
    "winner_grid": (
        "Log-scaled (log1p) starting grid slot of the race winner -- "
        "higher means the winner recovered from farther back."
    ),
    "podium_closeness": (
        "Negative gap, in seconds and capped, between the 3rd- and "
        "1st-place finishers' race time -- closer podiums score higher "
        "(less negative)."
    ),
    "neutralizations": (
        "Weighted count of race neutralizations: full safety cars plus "
        "weighted virtual safety cars and red flags."
    ),
}


# ---------------------------------------------------------------------------
# Custom transformer
# ---------------------------------------------------------------------------

class RaceChaosFeaturizer(BaseEstimator, TransformerMixin):
    """Turns one race's per-driver results + track status into a 6-value
    "chaos" feature vector. Every feature is oriented so higher = more
    chaotic (see FEATURE_DESCRIPTIONS for exact definitions).

    ``transform`` accepts any sequence of race dicts -- a plain list, a
    pandas Series, or a numpy object array all work, since we just iterate
    over the input. Each race dict looks like::

        {
            "results": [
                {"grid": 2, "position": 1, "laps": 70,
                 "status": "finished", "time_millis": 6347927},
                ...
            ],
            "track_status": {"safety_cars": 2, "virtual_safety_cars": 0,
                              "red_flags": 0},
        }

    ``status`` values are expected already collapsed to one of
    STATUS_CATEGORIES (see ``normalize_status``); that mapping happens
    upstream, not inside this transformer. Missing/None fields are
    tolerated defensively so the transformer never raises on
    contract-shaped input.
    """

    def __init__(self, podium_cap_seconds=60.0, vsc_weight=0.5, red_flag_weight=2.0):
        # scikit-learn contract: __init__ only assigns constructor args.
        self.podium_cap_seconds = podium_cap_seconds
        self.vsc_weight = vsc_weight
        self.red_flag_weight = red_flag_weight

    def fit(self, X, y=None):
        # Purely a feature calculator -- nothing is learned from data.
        return self

    def transform(self, X):
        rows = [self._featurize_one(race) for race in X]
        # Round away last-bit libm differences (np.log1p differs between the
        # Windows build machine and Linux on Modal). Many training races tie
        # exactly on a feature value, and QuantileTransformer maps a value
        # sitting on a tie very differently from one a hair off it.
        return np.round(np.asarray(rows, dtype=np.float64), 9)

    def get_feature_names_out(self, input_features=None):
        return np.array(FEATURE_NAMES, dtype=object)

    # -- internals -----------------------------------------------------

    def _featurize_one(self, race):
        race = race or {}
        results = list(race.get("results") or [])
        track_status = race.get("track_status") or {}

        starters = [r for r in results if r.get("status") != "dns"]
        n_starters = len(starters)

        retirees = [r for r in starters if r.get("status") == "retired"]
        retirement_rate = (len(retirees) / n_starters) if n_starters else 0.0

        winner = next((r for r in results if r.get("position") == 1), None)
        winner_laps = (winner.get("laps") or 0) if winner is not None else 0

        if len(retirees) < 2 or not winner_laps:
            retirement_lap_spread = 0.0
        else:
            retiree_laps = np.array(
                [r.get("laps") or 0 for r in retirees], dtype=np.float64
            )
            retirement_lap_spread = float(np.std(retiree_laps) / winner_laps)

        classified = [r for r in results if r.get("status") in ("finished", "lapped")]
        if classified:
            diffs = []
            for r in classified:
                grid = r.get("grid") or 0
                effective_grid = grid if grid != 0 else n_starters
                diffs.append(abs(effective_grid - (r.get("position") or 0)))
            position_shuffle = float(np.mean(diffs))
        else:
            position_shuffle = 0.0

        if winner is not None:
            grid = winner.get("grid") or 0
            effective_grid = grid if grid != 0 else n_starters
            winner_grid = float(np.log1p(effective_grid))
        else:
            winner_grid = 0.0

        p1 = winner
        p3 = next((r for r in results if r.get("position") == 3), None)
        cap = self.podium_cap_seconds
        if (
            p1 is None
            or p3 is None
            or p3.get("status") != "finished"
            or p1.get("time_millis") is None
            or p3.get("time_millis") is None
        ):
            podium_closeness = -cap
        else:
            gap_seconds = (p3["time_millis"] - p1["time_millis"]) / 1000.0
            gap_seconds = max(gap_seconds, 0.0)  # clip gap at >= 0
            podium_closeness = -min(gap_seconds, cap)

        neutralizations = (
            (track_status.get("safety_cars") or 0)
            + self.vsc_weight * (track_status.get("virtual_safety_cars") or 0)
            + self.red_flag_weight * (track_status.get("red_flags") or 0)
        )

        return [
            retirement_rate,
            retirement_lap_spread,
            position_shuffle,
            winner_grid,
            podium_closeness,
            float(neutralizations),
        ]
