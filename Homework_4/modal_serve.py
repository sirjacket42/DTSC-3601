"""Modal deployment for the Race Chaos Index API.

Ships exactly three local files into the container image -- ``serve.py``,
``pipeline_def.py`` (needed for unpickling the custom
``RaceChaosFeaturizer`` transformer), and ``pipeline.joblib`` (the fitted
bundle) -- and exposes ``serve.py``'s FastAPI app via ``modal.asgi_app()``.

Dev (temporary *.modal.run URL, hot-reloads on save, Ctrl+C tears it down)::

    modal serve modal_serve.py

Deploy (stable URL, stays up until redeployed/stopped)::

    modal deploy modal_serve.py
"""

from __future__ import annotations

from pathlib import Path

import modal

# ---------------------------------------------------------------------------
# Version pins
#
# These MUST match the `metadata` dict embedded in pipeline.joblib
# (metadata["sklearn_version"], ["numpy_version"], ["joblib_version"]) --
# a sklearn/numpy mismatch between build time and serve time is exactly the
# "Don't miss" failure mode from the assignment brief (silently-wrong
# unpickled estimators, or an outright load failure). scipy is pinned too
# since scikit-learn depends on it and an unpinned resolve could drift.
# fastapi/pydantic are pinned to the same versions used in serve.py's tests.
# ---------------------------------------------------------------------------
SKLEARN_VERSION = "1.8.0"
NUMPY_VERSION = "2.5.3"
JOBLIB_VERSION = "1.6.0"
SCIPY_VERSION = "1.18.1"
FASTAPI_VERSION = "0.141.1"
PYDANTIC_VERSION = "2.13.5"

_THIS_DIR = Path(__file__).parent

image = (
    modal.Image.debian_slim(python_version="3.13")
    .pip_install(
        f"scikit-learn=={SKLEARN_VERSION}",
        f"numpy=={NUMPY_VERSION}",
        f"joblib=={JOBLIB_VERSION}",
        f"scipy=={SCIPY_VERSION}",
        f"fastapi=={FASTAPI_VERSION}",
        f"pydantic=={PYDANTIC_VERSION}",
    )
    .env({"CHAOS_ARTIFACT_PATH": "/root/pipeline.joblib"})
    .add_local_file(str(_THIS_DIR / "serve.py"), "/root/serve.py")
    .add_local_file(str(_THIS_DIR / "pipeline_def.py"), "/root/pipeline_def.py")
    .add_local_file(str(_THIS_DIR / "pipeline.joblib"), "/root/pipeline.joblib")
)

app = modal.App("race-chaos-index")


def _assert_local_pins_match_bundle() -> None:
    """Local-only guard (runs on the machine invoking `modal deploy`/`modal
    serve`, not in the container): fail loudly *before* deploying if the
    version pins above have drifted from what pipeline.joblib was actually
    built with, instead of discovering it as a 503 or a silent behavior
    mismatch after deploy.
    """
    import joblib as _joblib
    import sklearn as _sklearn

    bundle = _joblib.load(_THIS_DIR / "pipeline.joblib")
    meta = bundle["metadata"]

    mismatches = []
    if meta["sklearn_version"] != SKLEARN_VERSION:
        mismatches.append(
            f"sklearn: pin={SKLEARN_VERSION!r} vs bundle metadata={meta['sklearn_version']!r}"
        )
    if _sklearn.__version__ != SKLEARN_VERSION:
        mismatches.append(
            f"sklearn: pin={SKLEARN_VERSION!r} vs locally-installed sklearn={_sklearn.__version__!r}"
        )
    if meta["numpy_version"] != NUMPY_VERSION:
        mismatches.append(
            f"numpy: pin={NUMPY_VERSION!r} vs bundle metadata={meta['numpy_version']!r}"
        )
    if meta.get("joblib_version") not in (None, JOBLIB_VERSION):
        mismatches.append(
            f"joblib: pin={JOBLIB_VERSION!r} vs bundle metadata={meta['joblib_version']!r}"
        )

    if mismatches:
        raise RuntimeError(
            "modal_serve.py version pins do not match pipeline.joblib's "
            "metadata -- fix the pins before deploying, or a sklearn/numpy "
            "mismatch will silently break unpickling on Modal:\n  "
            + "\n  ".join(mismatches)
        )


if modal.is_local():
    # Only runs locally (e.g. under `modal deploy`/`modal serve` on this
    # machine) -- never inside the container, so importing sklearn here is
    # fine even though it isn't part of the container image build step.
    _assert_local_pins_match_bundle()


@app.function(
    image=image,
    scaledown_window=300,
    # min_containers=1,  # enable around grading to avoid cold starts (costs credits while set)
)
@modal.concurrent(max_inputs=20)
@modal.asgi_app()
def fastapi_app():
    import sys

    sys.path.insert(0, "/root")
    from serve import app as web_app

    return web_app
