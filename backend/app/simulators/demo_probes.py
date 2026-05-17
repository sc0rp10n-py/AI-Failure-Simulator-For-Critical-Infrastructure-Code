"""Discover and probe live demo / project HTTP endpoints."""

from __future__ import annotations

from pathlib import Path

import httpx

from app.config import settings

# Known demo health endpoints when services are running locally
DEMO_PROBE_MAP: dict[str, list[tuple[str, str]]] = {
    "demo1": [
        ("http://127.0.0.1:3000/healthz", "api-gateway"),
        ("http://127.0.0.1:3001/healthz", "payment-service"),
        ("http://127.0.0.1:3002/healthz", "inventory-service"),
    ],
    "demo2": [
        ("http://127.0.0.1:8000/health", "dispatch"),
    ],
    "demo3": [
        ("http://127.0.0.1:4003/control/status", "control-center"),
    ],
    "demo4": [
        ("http://127.0.0.1:5004/health", "fraud-api"),
    ],
}


def resolve_probe_targets(root: Path, demo_id: str | None, framework: str) -> list[tuple[str, str]]:
    if demo_id and demo_id in DEMO_PROBE_MAP:
        return DEMO_PROBE_MAP[demo_id]

    inferred: list[tuple[str, str]] = []
    text_blob = ""
    for path in list(root.rglob("*.py"))[:40] + list(root.rglob("*.js"))[:40]:
        try:
            text_blob += path.read_text(encoding="utf-8", errors="ignore")[:2000]
        except OSError:
            continue

    if "/healthz" in text_blob or "healthz" in text_blob:
        inferred.append(("http://127.0.0.1:3000/healthz", "api"))
    if '"/health"' in text_blob or "/health" in text_blob:
        port = 8000 if framework == "fastapi" else 5004 if framework == "flask" else 4003
        inferred.append((f"http://127.0.0.1:{port}/health", "api"))
    return inferred[:4]


def is_endpoint_live(url: str, timeout: float = 1.5) -> bool:
    try:
        response = httpx.get(url, timeout=timeout)
        return response.status_code < 500
    except Exception:
        return False
