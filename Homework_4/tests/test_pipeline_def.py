"""Tests for pipeline_def.RaceChaosFeaturizer and normalize_status."""

import os
import sys

# Make sure `import pipeline_def` works regardless of how pytest is invoked
# (e.g. `python -m pytest` from a different rootdir than Homework_4/tests).
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import joblib
import numpy as np
import pytest
from sklearn.base import clone
from sklearn.ensemble import IsolationForest
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import QuantileTransformer

from pipeline_def import (
    FEATURE_DESCRIPTIONS,
    FEATURE_NAMES,
    STATUS_CATEGORIES,
    RaceChaosFeaturizer,
    normalize_status,
)


# ---------------------------------------------------------------------------
# Hand-built race fixtures
# ---------------------------------------------------------------------------

# Race A: the example race straight out of IDEA_BRIEF.md's input contract.
RACE_A = {
    "results": [
        {"grid": 2, "position": 1, "laps": 70, "status": "finished", "time_millis": 6347927},
        {"grid": 1, "position": 3, "laps": 70, "status": "finished", "time_millis": 6352838},
        {"grid": 12, "position": 15, "laps": 69, "status": "lapped", "time_millis": None},
        {"grid": 8, "position": 18, "laps": 44, "status": "retired", "time_millis": None},
    ],
    "track_status": {"safety_cars": 2, "virtual_safety_cars": 0, "red_flags": 0},
}

# Race B: winner started from the pit lane (grid=0) -> effective_grid = n_starters.
RACE_B = {
    "results": [
        {"grid": 0, "position": 1, "laps": 50, "status": "finished", "time_millis": 5_000_000},
        {"grid": 5, "position": 2, "laps": 50, "status": "finished", "time_millis": 5_010_000},
        {"grid": 3, "position": 3, "laps": 50, "status": "finished", "time_millis": 5_020_000},
    ],
    "track_status": {"safety_cars": 0, "virtual_safety_cars": 0, "red_flags": 0},
}

# Race C: exactly two retirees -> non-zero retirement_lap_spread.
RACE_C = {
    "results": [
        {"grid": 1, "position": 1, "laps": 60, "status": "finished", "time_millis": 4_000_000},
        {"grid": 2, "position": 2, "laps": 60, "status": "finished", "time_millis": 4_005_000},
        {"grid": 3, "position": 3, "laps": 60, "status": "finished", "time_millis": 4_010_000},
        {"grid": 4, "position": 4, "laps": 20, "status": "retired", "time_millis": None},
        {"grid": 5, "position": 5, "laps": 40, "status": "retired", "time_millis": None},
    ],
    "track_status": {"safety_cars": 0, "virtual_safety_cars": 0, "red_flags": 0},
}

# Race D: P3 missing entirely -> podium_closeness pinned at -cap.
RACE_D = {
    "results": [
        {"grid": 1, "position": 1, "laps": 10, "status": "finished", "time_millis": 1_000_000},
        {"grid": 2, "position": 2, "laps": 10, "status": "finished", "time_millis": 1_005_000},
    ],
    "track_status": {"safety_cars": 0, "virtual_safety_cars": 0, "red_flags": 0},
}

# Race E: P3 exists but is "lapped" (not "finished") -> podium_closeness = -cap.
RACE_E = {
    "results": [
        {"grid": 1, "position": 1, "laps": 10, "status": "finished", "time_millis": 1_000_000},
        {"grid": 2, "position": 2, "laps": 10, "status": "finished", "time_millis": 1_005_000},
        {"grid": 3, "position": 3, "laps": 9, "status": "lapped", "time_millis": None},
    ],
    "track_status": {"safety_cars": 0, "virtual_safety_cars": 0, "red_flags": 0},
}

# Race F: P1 time_millis is null -> podium_closeness = -cap.
RACE_F = {
    "results": [
        {"grid": 1, "position": 1, "laps": 10, "status": "finished", "time_millis": None},
        {"grid": 2, "position": 2, "laps": 10, "status": "finished", "time_millis": 1_005_000},
        {"grid": 3, "position": 3, "laps": 10, "status": "finished", "time_millis": 1_010_000},
    ],
    "track_status": {"safety_cars": 0, "virtual_safety_cars": 0, "red_flags": 0},
}

# Race G: a dns entry must be excluded from starters entirely.
RACE_G = {
    "results": [
        {"grid": 1, "position": 1, "laps": 50, "status": "finished", "time_millis": 3_000_000},
        {"grid": 5, "position": 20, "laps": 0, "status": "dns", "time_millis": None},
    ],
    "track_status": {"safety_cars": 0, "virtual_safety_cars": 0, "red_flags": 0},
}

# Race H: heavy neutralizations, for weight-sensitivity checks and pipeline variety.
RACE_H = {
    "results": [
        {"grid": 1, "position": 1, "laps": 55, "status": "finished", "time_millis": 6_000_000},
        {"grid": 2, "position": 2, "laps": 55, "status": "finished", "time_millis": 6_000_500},
        {"grid": 3, "position": 3, "laps": 55, "status": "finished", "time_millis": 6_030_000},
        {"grid": 4, "position": 4, "laps": 10, "status": "retired", "time_millis": None},
        {"grid": 5, "position": 5, "laps": 30, "status": "retired", "time_millis": None},
        {"grid": 6, "position": 6, "laps": 40, "status": "retired", "time_millis": None},
    ],
    "track_status": {"safety_cars": 1, "virtual_safety_cars": 2, "red_flags": 1},
}

ALL_RACES = [RACE_A, RACE_B, RACE_C, RACE_D, RACE_E, RACE_F, RACE_G, RACE_H]


# ---------------------------------------------------------------------------
# normalize_status
# ---------------------------------------------------------------------------

@pytest.mark.parametrize(
    "raw, expected",
    [
        # 2023+ era generic strings.
        ("Finished", "finished"),
        ("  finished  ", "finished"),
        ("FINISHED", "finished"),
        ("Lapped", "lapped"),
        ("LAPPED", "lapped"),
        ("Retired", "retired"),
        # 2018-era "+N Lap(s)" phrasing.
        ("+1 Lap", "lapped"),
        ("+2 Laps", "lapped"),
        ("+12 Laps", "lapped"),
        ("+1 lap", "lapped"),
        # DNS family.
        ("Did not start", "dns"),
        ("did NOT Start", "dns"),
        ("Did not qualify", "dns"),
        ("Did not prequalify", "dns"),
        ("Withdrew", "dns"),
        # DSQ family.
        ("Disqualified", "dsq"),
        ("Excluded", "dsq"),
        ("  DISQUALIFIED  ", "dsq"),
        # Falls back to retired.
        ("Not classified", "retired"),
        ("Engine", "retired"),
        ("Brakes", "retired"),
        ("Wheel", "retired"),
        ("Accident", "retired"),
        ("", "retired"),
    ],
)
def test_normalize_status(raw, expected):
    assert normalize_status(raw) == expected


def test_status_categories_constant():
    assert STATUS_CATEGORIES == ("finished", "lapped", "retired", "dns", "dsq")
    for raw, expected in [
        ("Finished", "finished"),
        ("+3 Laps", "lapped"),
        ("Withdrew", "dns"),
        ("Excluded", "dsq"),
        ("gibberish", "retired"),
    ]:
        assert normalize_status(raw) in STATUS_CATEGORIES


# ---------------------------------------------------------------------------
# Feature names / descriptions
# ---------------------------------------------------------------------------

def test_feature_names_order():
    assert FEATURE_NAMES == (
        "retirement_rate",
        "retirement_lap_spread",
        "position_shuffle",
        "winner_grid",
        "podium_closeness",
        "neutralizations",
    )


def test_feature_descriptions_cover_all_features():
    assert set(FEATURE_DESCRIPTIONS.keys()) == set(FEATURE_NAMES)
    for name, desc in FEATURE_DESCRIPTIONS.items():
        assert isinstance(desc, str) and len(desc) > 0


def test_get_feature_names_out():
    featurizer = RaceChaosFeaturizer()
    out = featurizer.get_feature_names_out()
    assert isinstance(out, np.ndarray)
    assert out.dtype == object
    assert tuple(out) == FEATURE_NAMES


# ---------------------------------------------------------------------------
# Exact feature-value checks
# ---------------------------------------------------------------------------

def _feature_dict(row):
    return dict(zip(FEATURE_NAMES, row))


def test_race_a_exact_values():
    featurizer = RaceChaosFeaturizer()  # defaults: cap=60, vsc=0.5, red=2.0
    out = featurizer.transform([RACE_A])
    feats = _feature_dict(out[0])

    assert feats["retirement_rate"] == pytest.approx(0.25)  # 1 retired / 4 starters
    assert feats["retirement_lap_spread"] == pytest.approx(0.0)  # only 1 retiree
    assert feats["position_shuffle"] == pytest.approx(2.0)  # (1+2+3)/3
    assert feats["winner_grid"] == pytest.approx(np.log1p(2))
    assert feats["podium_closeness"] == pytest.approx(-4.911)
    assert feats["neutralizations"] == pytest.approx(2.0)  # 2 SC + 0 + 0


def test_race_b_pit_lane_start_grid_zero():
    featurizer = RaceChaosFeaturizer()
    out = featurizer.transform([RACE_B])
    feats = _feature_dict(out[0])

    # n_starters = 3, winner grid 0 -> effective grid 3.
    assert feats["winner_grid"] == pytest.approx(np.log1p(3))
    # shuffle: |3-1| + |5-2| + |3-3| = 2 + 3 + 0 -> mean 5/3
    assert feats["position_shuffle"] == pytest.approx(5.0 / 3.0)
    assert feats["retirement_rate"] == pytest.approx(0.0)
    assert feats["retirement_lap_spread"] == pytest.approx(0.0)
    assert feats["podium_closeness"] == pytest.approx(-20.0)
    assert feats["neutralizations"] == pytest.approx(0.0)


def test_race_c_two_retirees_nonzero_spread():
    featurizer = RaceChaosFeaturizer()
    out = featurizer.transform([RACE_C])
    feats = _feature_dict(out[0])

    assert feats["retirement_rate"] == pytest.approx(2.0 / 5.0)
    # population std of [20, 40] is 10; winner laps = 60 -> 10/60
    assert feats["retirement_lap_spread"] == pytest.approx(10.0 / 60.0)
    assert feats["position_shuffle"] == pytest.approx(0.0)  # grid == position for classified rows
    assert feats["winner_grid"] == pytest.approx(np.log1p(1))
    assert feats["podium_closeness"] == pytest.approx(-10.0)


def test_race_d_p3_missing_uses_cap():
    featurizer = RaceChaosFeaturizer(podium_cap_seconds=60.0)
    out = featurizer.transform([RACE_D])
    feats = _feature_dict(out[0])
    assert feats["podium_closeness"] == pytest.approx(-60.0)


def test_race_e_p3_lapped_uses_cap():
    featurizer = RaceChaosFeaturizer(podium_cap_seconds=60.0)
    out = featurizer.transform([RACE_E])
    feats = _feature_dict(out[0])
    assert feats["podium_closeness"] == pytest.approx(-60.0)
    # p3 is "lapped" so it IS part of the classified set for position_shuffle.
    assert feats["position_shuffle"] == pytest.approx(0.0)


def test_race_f_null_time_uses_cap():
    featurizer = RaceChaosFeaturizer(podium_cap_seconds=60.0)
    out = featurizer.transform([RACE_F])
    feats = _feature_dict(out[0])
    assert feats["podium_closeness"] == pytest.approx(-60.0)


def test_custom_podium_cap_is_respected():
    featurizer = RaceChaosFeaturizer(podium_cap_seconds=5.0)
    out = featurizer.transform([RACE_A])  # true gap is 4.911s, below the 5s cap
    feats = _feature_dict(out[0])
    assert feats["podium_closeness"] == pytest.approx(-4.911)

    out2 = featurizer.transform([RACE_C])  # true gap is 10s, above the 5s cap
    feats2 = _feature_dict(out2[0])
    assert feats2["podium_closeness"] == pytest.approx(-5.0)


def test_race_g_dns_excluded_from_starters():
    featurizer = RaceChaosFeaturizer()
    out = featurizer.transform([RACE_G])
    feats = _feature_dict(out[0])
    # Only the finisher counts as a starter; the dns row must not appear.
    assert feats["retirement_rate"] == pytest.approx(0.0)
    assert feats["winner_grid"] == pytest.approx(np.log1p(1))
    assert feats["podium_closeness"] == pytest.approx(-60.0)  # no P3


def test_neutralization_weights_default():
    featurizer = RaceChaosFeaturizer()  # vsc_weight=0.5, red_flag_weight=2.0
    out = featurizer.transform([RACE_H])
    feats = _feature_dict(out[0])
    # 1 SC + 0.5*2 VSC + 2.0*1 red = 1 + 1 + 2 = 4.0
    assert feats["neutralizations"] == pytest.approx(4.0)


def test_neutralization_weights_custom():
    featurizer = RaceChaosFeaturizer(vsc_weight=1.0, red_flag_weight=3.0)
    out = featurizer.transform([RACE_H])
    feats = _feature_dict(out[0])
    # 1 SC + 1.0*2 VSC + 3.0*1 red = 1 + 2 + 3 = 6.0
    assert feats["neutralizations"] == pytest.approx(6.0)


# ---------------------------------------------------------------------------
# Shape / dtype / input-type flexibility
# ---------------------------------------------------------------------------

def test_transform_output_shape_and_dtype():
    featurizer = RaceChaosFeaturizer()
    out = featurizer.transform(ALL_RACES)
    assert out.shape == (len(ALL_RACES), len(FEATURE_NAMES))
    assert out.dtype == np.float64
    assert np.all(np.isfinite(out))


def test_transform_accepts_pandas_series():
    pd = pytest.importorskip("pandas")
    featurizer = RaceChaosFeaturizer()
    series = pd.Series(ALL_RACES, dtype=object)
    out = featurizer.transform(series)
    assert out.shape == (len(ALL_RACES), len(FEATURE_NAMES))
    # Must match plain-list transform exactly.
    out_list = featurizer.transform(ALL_RACES)
    np.testing.assert_array_equal(out, out_list)


def test_transform_accepts_numpy_object_array():
    featurizer = RaceChaosFeaturizer()
    arr = np.empty(len(ALL_RACES), dtype=object)
    for i, race in enumerate(ALL_RACES):
        arr[i] = race
    out = featurizer.transform(arr)
    assert out.shape == (len(ALL_RACES), len(FEATURE_NAMES))
    out_list = featurizer.transform(ALL_RACES)
    np.testing.assert_array_equal(out, out_list)


def test_fit_returns_self_and_is_stateless():
    featurizer = RaceChaosFeaturizer()
    result = featurizer.fit(ALL_RACES)
    assert result is featurizer


# ---------------------------------------------------------------------------
# scikit-learn estimator contract: clone / get_params round-trip
# ---------------------------------------------------------------------------

def test_clone_round_trip():
    featurizer = RaceChaosFeaturizer(podium_cap_seconds=30.0, vsc_weight=0.7, red_flag_weight=1.5)
    cloned = clone(featurizer)

    assert cloned is not featurizer
    assert cloned.get_params() == featurizer.get_params()
    assert cloned.get_params() == {
        "podium_cap_seconds": 30.0,
        "vsc_weight": 0.7,
        "red_flag_weight": 1.5,
    }

    # Cloned transformer must behave identically.
    np.testing.assert_array_equal(
        cloned.transform(ALL_RACES), featurizer.transform(ALL_RACES)
    )


# ---------------------------------------------------------------------------
# Full Pipeline: fit + joblib dump/load round trip
# ---------------------------------------------------------------------------

def test_pipeline_fits_and_survives_joblib_round_trip(tmp_path):
    pipeline = Pipeline(
        [
            ("chaos_features", RaceChaosFeaturizer()),
            ("quantiles", QuantileTransformer(n_quantiles=5, random_state=0)),
            ("weirdness", IsolationForest(random_state=42)),
        ]
    )

    pipeline.fit(ALL_RACES)

    # The fitted pipeline should score all 8 training races without error.
    scores_before = pipeline.score_samples(ALL_RACES)
    assert scores_before.shape == (len(ALL_RACES),)
    assert np.all(np.isfinite(scores_before))

    # Feature sub-pipeline output must have the expected shape too.
    feats_before = pipeline[:-1].transform(ALL_RACES)
    assert feats_before.shape == (len(ALL_RACES), len(FEATURE_NAMES))

    dump_path = tmp_path / "pipeline.joblib"
    joblib.dump(pipeline, dump_path)
    loaded = joblib.load(dump_path)

    # Loaded pipeline's custom step must still be our real class (not
    # __main__.RaceChaosFeaturizer -- the classic pickling gotcha).
    assert type(loaded.named_steps["chaos_features"]) is RaceChaosFeaturizer
    assert isinstance(loaded.named_steps["quantiles"], QuantileTransformer)
    assert isinstance(loaded.named_steps["weirdness"], IsolationForest)

    scores_after = loaded.score_samples(ALL_RACES)
    np.testing.assert_allclose(scores_after, scores_before)
