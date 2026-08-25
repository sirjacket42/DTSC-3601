# F1 Dashboard (2023-2026)

A Streamlit dashboard over four seasons of Formula 1 race results, stored in Supabase and
deployed on Modal.

**Pipeline:** [OpenF1 API](https://openf1.org) &rarr; `scripts/export_dataset.py` (CSV snapshot,
checked into `data/`) &rarr; `scripts/upload_to_supabase.py` (one-time load into Postgres) &rarr;
Supabase `f1_results` table (read over the REST API, RLS-gated to public `select` only) &rarr;
this Streamlit app &rarr; deployed as a container on Modal (`modal_app.py`).

## Local development

```bash
uv sync
cp .streamlit/secrets.toml.example .streamlit/secrets.toml   # fill in your Supabase project
uv run streamlit run app.py
```

## Rebuilding the dataset

```bash
uv run python scripts/export_dataset.py 2023 2026
SUPABASE_URL=... SUPABASE_KEY=... uv run python scripts/upload_to_supabase.py
```

`SUPABASE_KEY` needs `insert` rights on `f1_results` for the upload step -- either use the
service role key, or temporarily add an `insert` policy for `anon` and drop it again afterward
(see the migration history in the Supabase dashboard for the exact policy used originally).

## Deploying to Modal

```bash
uv run modal setup                 # one-time browser login
uv run modal secret create f1-dashboard-secrets \
    SUPABASE_URL=https://<project-ref>.supabase.co \
    SUPABASE_KEY=<anon-public-key>
uv run modal deploy modal_app.py
```

`modal deploy` prints the app's public URL (`https://<workspace>--f1-dashboard-run.modal.run`).
