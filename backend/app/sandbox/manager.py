"""Automatic sandbox orchestration for uploaded / demo projects."""

from __future__ import annotations

from pathlib import Path

from app.config import settings
from app.logging.structured import get_logger
from app.sandbox import docker_runner, subprocess_runner
from app.sandbox.types import SandboxHandle

logger = get_logger("sandbox.manager")


def start_sandbox(root: Path, framework: str) -> SandboxHandle | None:
    if not settings.SANDBOX_ENABLED:
        return None

    root = root.resolve()
    errors: list[str] = []

    if settings.SANDBOX_PREFER_DOCKER and docker_runner.docker_available():
        try:
            handle = docker_runner.start(root, framework)
            logger.info(
                "Docker sandbox started",
                extra={
                    "event": "sandbox_start",
                    "mode": "docker",
                    "port": handle.host_port,
                    "probes": len(handle.probe_targets),
                },
            )
            return handle
        except Exception as exc:
            errors.append(f"docker: {exc}")
            logger.info("Docker sandbox failed, falling back", extra={"error": str(exc)})

    try:
        handle = subprocess_runner.start(root, framework)
        logger.info(
            "Subprocess sandbox started",
            extra={
                "event": "sandbox_start",
                "mode": "subprocess",
                "port": handle.host_port,
                "probes": len(handle.probe_targets),
            },
        )
        return handle
    except Exception as exc:
        errors.append(f"subprocess: {exc}")
        logger.info("Subprocess sandbox failed", extra={"error": str(exc), "errors": errors})
        return None
