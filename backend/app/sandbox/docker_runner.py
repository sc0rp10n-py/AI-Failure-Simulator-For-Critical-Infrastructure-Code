"""Docker-isolated sandbox for uploaded projects."""

from __future__ import annotations

import shutil
import subprocess
import time
from pathlib import Path

import httpx

from app.config import settings
from app.sandbox.port import pick_free_port
from app.sandbox.profiles import discover_health_paths, profile_for
from app.sandbox.types import SandboxHandle


def docker_available() -> bool:
    return shutil.which("docker") is not None


def _wait_health(base_url: str, paths: list[str], timeout: float) -> list[tuple[str, str]]:
    deadline = time.time() + timeout
    while time.time() < deadline:
        live = []
        for path in paths:
            url = f"{base_url}{path}"
            try:
                if httpx.get(url, timeout=2.0).status_code < 500:
                    live.append((url, path.strip("/") or "api"))
            except Exception:
                continue
        if live:
            return live
        time.sleep(2)
    return []


def start(root: Path, framework: str) -> SandboxHandle:
    root = root.resolve()
    host_port = pick_free_port()
    profile = profile_for(framework, root, 3000)
    paths = discover_health_paths(root, framework) or profile.health_paths
    container_port = 3000 if framework in ("express", "nodejs") else 8000
    if framework == "flask":
        container_port = 5000
    if framework == "fastapi":
        container_port = 8000

    if framework in ("express", "nodejs"):
        image = "node:20-alpine"
        shell_cmd = "npm install --omit=dev && npm start"
        env_args = ["-e", f"PORT={container_port}", "-e", f"GATEWAY_PORT={container_port}"]
    elif framework == "fastapi":
        image = "python:3.12-slim"
        shell_cmd = "pip install -r requirements.txt && uvicorn app:app --host 0.0.0.0 --port 8000"
        env_args = []
        container_port = 8000
    else:
        image = "python:3.12-slim"
        shell_cmd = "pip install -r requirements.txt && python app.py"
        env_args = ["-e", f"PORT={container_port}"]

    name = f"sentinel-sbx-{host_port}"
    cmd = [
        "docker",
        "run",
        "-d",
        "--name",
        name,
        "-p",
        f"127.0.0.1:{host_port}:{container_port}",
        "-v",
        f"{root}:/app:ro",
        "-w",
        "/app",
        *env_args,
        image,
        "sh",
        "-c",
        shell_cmd,
    ]
    # Writable layer needed for npm install — remount without :ro for node/python install
    cmd = [
        "docker",
        "run",
        "-d",
        "--name",
        name,
        "-p",
        f"127.0.0.1:{host_port}:{container_port}",
        "-v",
        f"{root}:/app",
        "-w",
        "/app",
        *env_args,
        image,
        "sh",
        "-c",
        shell_cmd,
    ]

    result = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
    if result.returncode != 0:
        raise RuntimeError(result.stderr or "docker run failed")

    base_url = f"http://127.0.0.1:{host_port}"
    live = _wait_health(base_url, paths, settings.SANDBOX_READY_TIMEOUT)

    def cleanup() -> None:
        subprocess.run(["docker", "rm", "-f", name], capture_output=True, timeout=30)

    return SandboxHandle(
        mode="docker",
        base_url=base_url,
        probe_targets=live,
        host_port=host_port,
        metadata={"container": name, "image": image},
        _cleanup=cleanup,
    )
