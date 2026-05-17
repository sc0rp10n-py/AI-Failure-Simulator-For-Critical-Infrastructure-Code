import json
import random
import time
from pathlib import Path

from app.analyzers.code_analyzer import AnalysisResult


def run_simulation(
    root: Path,
    analysis: AnalysisResult,
    scenarios: list[dict],
    output_dir: Path,
) -> dict:
    """Execute lightweight failure simulation against project artifacts."""
    output_dir.mkdir(parents=True, exist_ok=True)
    random.seed(hash(str(root)) % 2**32)

    timeline: list[dict] = []
    logs: list[dict] = []
    metrics = {
        "requests_total": 0,
        "requests_failed": 0,
        "p50_ms": 0,
        "p95_ms": 0,
        "p99_ms": 0,
        "error_rate": 0.0,
    }
    latencies: list[float] = []

    base_ts = time.time()
    for idx, scenario in enumerate(scenarios):
        started = base_ts + idx * 0.4
        latency = random.uniform(120, 2400)
        if scenario["category"] in ("database", "external-api"):
            latency *= random.uniform(1.5, 3.2)
        failed = random.random() < (0.35 if scenario["severity"] in ("Critical", "High") else 0.18)
        metrics["requests_total"] += random.randint(8, 40)
        if failed:
            metrics["requests_failed"] += random.randint(2, 12)
        latencies.append(latency)

        event = {
            "ts": started,
            "stage": "simulation",
            "scenario": scenario["name"],
            "target": scenario["target"],
            "latency_ms": round(latency, 1),
            "failed": failed,
            "severity": scenario["severity"],
        }
        timeline.append(event)
        logs.append(
            {
                "level": "ERROR" if failed else "WARN",
                "message": (
                    f"Injection '{scenario['name']}' on {scenario['target']}: "
                    f"{'FAIL' if failed else 'DEGRADED'} ({round(latency)}ms)"
                ),
                "source": "injector",
                "payload": event,
            }
        )
        scenario["injected"] = True
        scenario["outcome"] = "failed" if failed else "degraded"

    if latencies:
        sorted_lat = sorted(latencies)
        metrics["p50_ms"] = round(sorted_lat[len(sorted_lat) // 2], 1)
        metrics["p95_ms"] = round(sorted_lat[int(len(sorted_lat) * 0.95) - 1], 1)
        metrics["p99_ms"] = round(sorted_lat[-1], 1)
    if metrics["requests_total"]:
        metrics["error_rate"] = round(metrics["requests_failed"] / metrics["requests_total"], 3)

    blast = _blast_radius(analysis, scenarios, timeline)
    traces = {"spans": timeline}
    payload = {
        "metrics": metrics,
        "traces": traces,
        "timeline": timeline,
        "dependency_graph": analysis.dependencies[0] if analysis.dependencies else {"nodes": [], "edges": []},
        "blast_radius": blast,
        "scenarios": scenarios,
    }

    (output_dir / "telemetry.json").write_text(json.dumps(payload, indent=2), encoding="utf-8")
    (output_dir / "simulation.log.jsonl").write_text(
        "\n".join(json.dumps(entry) for entry in logs),
        encoding="utf-8",
    )
    return payload


def _blast_radius(analysis: AnalysisResult, scenarios: list[dict], timeline: list[dict]) -> dict:
    failed = [e for e in timeline if e.get("failed")]
    impacted = set()
    graph = analysis.dependencies[0] if analysis.dependencies else {"nodes": [], "edges": []}
    for edge in graph.get("edges", []):
        if edge.get("critical"):
            impacted.add(edge["to"])
    impacted.add("api")
    return {
        "origin": failed[0]["target"] if failed else "api",
        "impacted_services": sorted(impacted),
        "severity": analysis.severity_label(),
        "cascade_probability": round(min(0.95, 0.35 + len(failed) * 0.12), 2),
        "customer_impact": "checkout/time-critical paths affected" if failed else "localized degradation",
    }
