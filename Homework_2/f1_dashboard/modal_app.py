"""Deploys the F1 Streamlit dashboard on Modal.

Run with: modal deploy modal_app.py
Requires a Modal secret named "f1-dashboard-secrets" with SUPABASE_URL and
SUPABASE_KEY (see README.md for the `modal secret create` command).
"""

import shlex
import subprocess

import modal

PORT = 8000

image = (
    modal.Image.debian_slim(python_version="3.11")
    .pip_install(
        "streamlit>=1.62.0",
        "pandas>=2.2.0",
        "plotly>=6.9.0",
        "supabase>=2.10.0",
    )
    .add_local_file("app.py", "/root/app.py")
    .add_local_file("common.py", "/root/common.py")
    .add_local_dir("pages", "/root/pages")
)

app = modal.App(name="f1-dashboard", image=image)


@app.function(
    secrets=[modal.Secret.from_name("f1-dashboard-secrets")],
    min_containers=1,
    max_containers=1,
)
@modal.concurrent(max_inputs=100)
@modal.web_server(port=PORT, startup_timeout=60)
def run():
    cmd = (
        f"streamlit run /root/app.py "
        f"--server.port {PORT} "
        f"--server.address 0.0.0.0 "
        f"--server.headless true "
        f"--server.enableCORS false "
        f"--server.enableXsrfProtection false"
    )
    subprocess.Popen(shlex.split(cmd))
