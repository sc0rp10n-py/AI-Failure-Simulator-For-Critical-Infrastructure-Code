"""Structured telemetry: metrics, traces, timeline, heatmaps."""

from __future__ import annotations

import json
import time
from pathlib import Path
from typing import Any

from app.analyzers.code_analyzer import AnalysisResult
from app.injectors.failure_injector import InjectionResult


class TelemetryCollector:
    def __init__(self, job_id: str, output_dir: Path):
        self.job_id = job_id
        self.output_dir = output_dir
        self.output_dir.mkdir(parents=True, exist_ok=True)
        self.metrics: dict[str, Any] = {
            "requests_total": 0,
            "requests_failed": 0,
            "p50_ms": 0,
            "p95_ms": 0,
            "p99_ms": 0,
            "error_rate": 0.0,
            "live_probes": 0,
            "synthetic_probes": 0,
        }
        self.timeline: list[dict] = []
        self.traces: list[dict] = []
        self.logs: list[dict] = []
        self._latencies: list[float] = []

    def record_injection(
        self,
        scenario: dict,
        result: InjectionResult,
        *,
        source: str = "injector",
    ) -> None:
        self.metrics["requests_total"] += 1
        if not result.success:
            self.metrics["requests_failed"] += 1
        self._latencies.append(result.latency_ms)

        event = {
            "ts": time.time(),
            "stage": "simulation",
            "scenario": scenario.get("name"),
            "target": scenario.get("target"),
            "category": scenario.get("category"),
            "latency_ms": result.latency_ms,
            "failed": not result.success,
            "severity": scenario.get("severity"),
            "injection_type": result.injection_type,
            "probe_source": source,
            "error": result.error,
            "status": result.response_status,
        }
        self.timeline.append(event)
        self.traces.append(
            {
                "trace_id": f"{self.job_id}-{len(self.traces)}",
                "span": scenario.get("name"),
                "duration_ms": result.latency_ms,
                "status": "ERROR" if not result.success else "OK",
            }
        )
        self.logs.append(
            {
                "level": "ERROR" if not result.success else "WARN",
                "message": (
                    f"[{result.injection_type}] {scenario.get('name')} @ {scenario.get('target')}: "
                    f"{'FAIL' if not result.success else 'OK'} ({result.latency_ms}ms)"
                ),
                "source": source,
                "payload": event,
            }
        )

    def finalize(self, analysis: AnalysisResult, scenarios: list[dict]) -> dict:
        if self._latencies:
            sorted_lat = sorted(self._latencies)
            self.metrics["p50_ms"] = round(sorted_lat[len(sorted_lat) // 2], 1)
            self.metrics["p95_ms"] = round(sorted_lat[int(len(sorted_lat) * 0.95) - 1], 1)
            self.metrics["p99_ms"] = round(sorted_lat[-1], 1)
        if self.metrics["requests_total"]:
            self.metrics["error_rate"] = round(
                self.metrics["requests_failed"] / self.metrics["requests_total"],
                3,
            )

        graph = analysis.dependencies[0] if analysis.dependencies else {"nodes": [], "edges": []}
        blast = self._blast_radius(analysis, scenarios)
        heatmap = self._build_heatmap(scenarios)

        payload = {
            "metrics": self.metrics,
            "traces": {"spans": self.traces},
            "timeline": self.timeline,
            "dependency_graph": graph,
            "blast_radius": blast,
            "heatmap": heatmap,
            "scenarios": scenarios,
            "logs": self.logs,
        }
        (self.output_dir / "telemetry.json").write_text(json.dumps(payload, indent=2), encoding="utf-8")
        (self.output_dir / "simulation.log.jsonl").write_text(
            "\n".join(json.dumps(entry) for entry in self.logs),
            encoding="utf-8",
        )
        return payload

    def _build_heatmap(self, scenarios: list[dict]) -> list[dict]:
        grid: dict[tuple[str, str], int] = {}
        for scenario in scenarios:
            cat = scenario.get("category", "unknown")
            sev = scenario.get("severity", "Medium")
            key = (cat, sev)
            grid[key] = grid.get(key, 0) + 1
        for event in self.timeline:
            if event.get("failed"):
                key = (event.get("category", "unknown"), event.get("severity", "Medium"))
                grid[key] = grid.get(key, 0) + 2
        return [
            {"category": k[0], "severity": k[1], "weight": v}
            for k, v in sorted(grid.items(), key=lambda x: -x[1])
        ]

    def _blast_radius(
        self, analysis: AnalysisResult, scenarios: list[dict]
    ) -> dict:
        failed = [e for e in self.timeline if e.get("failed")]
        impacted: set[str] = set()
        graph = analysis.dependencies[0] if analysis.dependencies else {"edges": []}
        for edge in graph.get("edges", []):
            if edge.get("critical"):
                impacted.add(edge["to"])
        impacted.add("api")
        return {
            "origin": failed[0]["target"] if failed else "api",
            "impacted_services": sorted(impacted),
            "severity": analysis.severity_label(),
            "cascade_probability": round(min(0.95, 0.35 + len(failed) * 0.12), 2),
            "customer_impact": (
                "checkout/time-critical paths affected" if failed else "localized degradation"
            ),
        }
