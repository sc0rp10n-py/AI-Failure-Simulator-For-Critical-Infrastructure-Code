from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path


@dataclass
class SandboxProfile:
    framework: str
    default_port: int
    health_paths: list[str]
    install_cmd: list[str] | None
    start_cmd: list[str]
    env_keys: dict[str, str]


def profile_for(framework: str, root: Path, host_port: int) -> SandboxProfile:
    if framework == "express" or framework == "nodejs":
        return SandboxProfile(
            framework=framework,
            default_port=host_port,
            health_paths=["/healthz", "/health", "/control/status"],
            install_cmd=["npm", "install", "--omit=dev"],
            start_cmd=["npm", "start"],
            env_keys={
                "PORT": str(host_port),
                "GATEWAY_PORT": str(host_port),
                "NODE_ENV": "test",
            },
        )
    if framework == "fastapi":
        return SandboxProfile(
            framework=framework,
            default_port=host_port,
            health_paths=["/health", "/docs"],
            install_cmd=["pip", "install", "-r", "requirements.txt"],
            start_cmd=[
                "uvicorn",
                "app:app",
                "--host",
                "127.0.0.1",
                "--port",
                str(host_port),
            ],
            env_keys={},
        )
    if framework == "flask":
        entry = "app.py" if (root / "app.py").exists() else "main.py"
        return SandboxProfile(
            framework=framework,
            default_port=host_port,
            health_paths=["/health", "/healthz"],
            install_cmd=["pip", "install", "-r", "requirements.txt"],
            start_cmd=["python", entry],
            env_keys={"PORT": str(host_port), "FLASK_DEBUG": "0"},
        )
    return SandboxProfile(
        framework="generic",
        default_port=host_port,
        health_paths=["/health", "/healthz"],
        install_cmd=None,
        start_cmd=["python", "app.py"],
        env_keys={"PORT": str(host_port)},
    )


def discover_health_paths(root: Path, framework: str) -> list[str]:
    import re

    found: list[str] = []
    patterns = [
        r"""\.get\(\s*['"]([^'"]+)['"]""",
        r"""@app\.get\(\s*['"]([^'"]+)['"]""",
        r"""@app\.route\(\s*['"]([^'"]+)['"]""",
    ]
    for path in list(root.rglob("*.js"))[:30] + list(root.rglob("*.py"))[:30]:
        try:
            text = path.read_text(encoding="utf-8", errors="ignore")
        except OSError:
            continue
        for pattern in patterns:
            for match in re.findall(pattern, text):
                if any(token in match for token in ("health", "status", "ready")):
                    found.append(match if match.startswith("/") else f"/{match}")
    if found:
        return list(dict.fromkeys(found))[:6]
    return profile_for(framework, root, 8080).health_paths
