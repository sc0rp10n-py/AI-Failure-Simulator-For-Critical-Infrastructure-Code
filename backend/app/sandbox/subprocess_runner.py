"""Run uploaded projects on the host in an isolated subprocess (automatic, no manual demo start)."""

from __future__ import annotations

import os
import signal
import subprocess
import time
from pathlib import Path

import httpx

from app.config import settings
from app.sandbox.port import pick_free_port
from app.sandbox.profiles import discover_health_paths, profile_for
from app.sandbox.types import SandboxHandle


def _wait_for_health(base_url: str, paths: list[str], timeout: float) -> list[tuple[str, str]]:
    deadline = time.time() + timeout
    live: list[tuple[str, str]] = []
    while time.time() < deadline:
        for path in paths:
            url = f"{base_url.rstrip('/')}{path}"
            try:
                response = httpx.get(url, timeout=2.0)
                if 200 <= response.status_code < 400:
                    name = path.strip("/").replace("/", "-") or "api"
                    live.append((url, name))
            except Exception:
                continue
        if live:
            return live
        time.sleep(1.5)
    return live


def _maybe_start_compose(root: Path) -> subprocess.Popen | None:
    compose = root / "docker-compose.yml"
    if not compose.exists():
        return None
    proc = subprocess.Popen(
        ["docker", "compose", "-f", str(compose), "up", "-d"],
        cwd=str(root),
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    proc.wait(timeout=120)
    return proc


def _stop_compose(root: Path) -> None:
    compose = root / "docker-compose.yml"
    if not compose.exists():
        return
    subprocess.run(
        ["docker", "compose", "-f", str(compose), "down"],
        cwd=str(root),
        capture_output=True,
        timeout=60,
    )


def start(root: Path, framework: str) -> SandboxHandle:
    root = root.resolve()
    port = pick_free_port()
    profile = profile_for(framework, root, port)
    paths = discover_health_paths(root, framework) or profile.health_paths
    base_url = f"http://127.0.0.1:{port}"

    env = {**os.environ, **profile.env_keys}
    if (root / "package.json").exists() and framework in ("express", "nodejs"):
        env.setdefault(
            "DATABASE_URL",
            "postgresql://postgres:postgres@127.0.0.1:5433/sentinel_demo1",
        )
        if (root / "docker-compose.yml").exists():
            env.setdefault("PAYMENT_PORT", "3001")
            env.setdefault("INVENTORY_PORT", "3002")
            env.setdefault("PAYMENT_PROVIDER_PORT", "3003")

    compose_started = False
    if settings.SANDBOX_USE_COMPOSE:
        try:
            _maybe_start_compose(root)
            compose_started = True
        except Exception:
            compose_started = False

    if profile.install_cmd and (
        (root / "package.json").exists() or (root / "requirements.txt").exists()
    ):
        subprocess.run(
            profile.install_cmd,
            cwd=str(root),
            env=env,
            capture_output=True,
            timeout=settings.SANDBOX_INSTALL_TIMEOUT,
        )

    proc = subprocess.Popen(
        profile.start_cmd,
        cwd=str(root),
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        preexec_fn=os.setsid if hasattr(os, "setsid") else None,
    )

    live = _wait_for_health(base_url, paths, settings.SANDBOX_READY_TIMEOUT)
    if not live and paths:
        live = [(f"{base_url}{paths[0]}", "api")]

    def cleanup() -> None:
        try:
            if proc.poll() is None:
                if hasattr(os, "killpg"):
                    os.killpg(os.getpgid(proc.pid), signal.SIGTERM)
                else:
                    proc.terminate()
                proc.wait(timeout=10)
        except Exception:
            proc.kill()
        if compose_started:
            try:
                _stop_compose(root)
            except Exception:
                pass

    return SandboxHandle(
        mode="subprocess",
        base_url=base_url,
        probe_targets=live,
        host_port=port,
        metadata={"pid": proc.pid, "paths": paths, "compose": compose_started},
        _cleanup=cleanup,
    )
