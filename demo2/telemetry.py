from __future__ import annotations

import json
from dataclasses import dataclass, asdict
from datetime import datetime, timezone, timedelta
from random import Random
from typing import Iterable


def _ts(minutes_ago: int) -> str:
    return (datetime.now(timezone.utc) - timedelta(minutes=minutes_ago)).isoformat()


@dataclass
class TelemetryPoint:
    timestamp: str
    signal: str
    value: float
    tags: dict[str, str]


def generate_telemetry(seed: int = 22) -> list[TelemetryPoint]:
    rng = Random(seed)
    points: list[TelemetryPoint] = []
    for minute in range(60):
        points.append(
            TelemetryPoint(
                timestamp=_ts(59 - minute),
                signal="dispatch.latency_ms",
                value=round(rng.uniform(800, 7400), 2),
                tags={"service": "demo2-emergency-dispatch", "endpoint": "/dispatch"},
            )
        )
        points.append(
            TelemetryPoint(
                timestamp=_ts(59 - minute),
                signal="queue.depth",
                value=float(rng.randint(0, 24)),
                tags={"service": "demo2-emergency-dispatch"},
            )
        )
        if minute % 11 == 0:
            points.append(
                TelemetryPoint(
                    timestamp=_ts(59 - minute),
                    signal="map_api.outage.count",
                    value=float(rng.randint(1, 4)),
                    tags={
                        "service": "demo2-emergency-dispatch",
                        "provider": "mapping-api",
                    },
                )
            )
    return points


def telemetry_as_jsonl(points: Iterable[TelemetryPoint]) -> str:
    return "\n".join(
        json.dumps(asdict(point), separators=(",", ":")) for point in points
    )


def generate_log_lines(seed: int = 22) -> list[str]:
    rng = Random(seed)
    lines = []
    scenarios = [
        ("INFO", "intake.accepted", "new emergency intake queued"),
        ("INFO", "dispatch.started", "dispatch workflow started"),
        ("WARN", "mapping.lookup.failed", "mapping API timeout; using fallback route"),
        ("WARN", "dispatch.queue.backlog", "queue depth exceeded safe threshold"),
        ("ERROR", "dispatch.delay", "ambulance assignment delayed by lock contention"),
        (
            "ERROR",
            "hospital.availability.stale",
            "hospital availability response is stale",
        ),
    ]
    for minute in range(60):
        level, event, message = scenarios[minute % len(scenarios)]
        line = {
            "ts": _ts(59 - minute),
            "level": level,
            "event": event,
            "message": message,
            "trace_id": f"trace-{rng.randint(100000, 999999)}",
            "case_id": f"CASE-{rng.randint(100000, 999999)}",
            "service": "demo2-emergency-dispatch",
        }
        if event == "mapping.lookup.failed":
            line["error"] = (
                "ReadTimeout: external mapping API did not respond before deadline"
            )
        if event == "dispatch.queue.backlog":
            line["backlog"] = rng.randint(13, 28)
        if event == "dispatch.delay":
            line["blocked_ms"] = rng.randint(1200, 5600)
        if event == "hospital.availability.stale":
            line["hospital_id"] = f"HOSP-{rng.randint(100, 999)}"
        lines.append(json.dumps(line, separators=(",", ":")))
    return lines
