import pandas as pd
import streamlit as st

from common import load_results, sidebar_season_filter

st.set_page_config(page_title="Dataset & EDA", page_icon="\U0001F4CA", layout="wide")
st.title("Dataset & Architecture")

st.markdown(
    """
**Pipeline:** the [OpenF1 API](https://openf1.org) is snapshotted season-by-season with
`scripts/export_dataset.py`, uploaded once into a Supabase Postgres table (`f1_results`) with
`scripts/upload_to_supabase.py`, and this Streamlit app reads it back live over Supabase's REST
API on every page load (cached for an hour). The app itself runs as a container on
[Modal](https://modal.com), defined in `modal_app.py`.
"""
)

df = load_results()
seasons = sidebar_season_filter(df)
view = df[df["season"].isin(seasons)]

st.subheader("Row counts by season")
st.dataframe(
    view.groupby("season", as_index=False).size().rename(columns={"size": "rows"}),
    width='stretch',
    hide_index=True,
)

st.subheader("Sample rows")
st.dataframe(view.sample(min(20, len(view))).sort_values(["season", "round"]), width='stretch', hide_index=True)

st.subheader("Column summary")
numeric_cols = view.select_dtypes(include="number").columns
categorical_cols = [c for c in view.columns if c not in numeric_cols and c not in ("dnf", "dns", "dsq")]

st.markdown("**Numeric columns**")
st.dataframe(view[numeric_cols].describe().transpose(), width='stretch')

st.markdown("**Categorical columns**")
cat_summary = pd.DataFrame(
    {
        "unique_values": [view[c].nunique() for c in categorical_cols],
        "most_common": [str(view[c].mode().iloc[0]) if not view[c].mode().empty else None for c in categorical_cols],
    },
    index=categorical_cols,
)
st.dataframe(cat_summary, width='stretch')

st.subheader("Missing values")
missing = view.isna().sum()
missing = missing[missing > 0].rename("missing_count").reset_index().rename(columns={"index": "column"})
if missing.empty:
    st.caption("No missing values in the selected seasons.")
else:
    st.dataframe(missing, width='stretch', hide_index=True)
    st.caption(
        "`position`, `gap_to_leader`, and `duration` are null for drivers who did not "
        "finish (DNF/DNS/DSQ) -- that's expected, not a data quality issue."
    )
