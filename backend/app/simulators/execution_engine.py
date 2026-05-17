"""Execute failure injections with live probes when targets are reachable."""

from __future__ import annotations

from pathlib import Path

from app.analyzers.code_analyzer import AnalysisResult
from app.injectors.failure_injector import FailureInjector
from app.simulators.demo_probes import is_endpoint_live, resolve_probe_targets
from app.telemetry.collector import TelemetryCollector


def run_simulation(
    root: Path,
    analysis: AnalysisResult,
    scenarios: list[dict],
    output_dir: Path,
    *,
    job_id: str,
    demo_id: str | None = None,
    probe_targets: list[tuple[str, str]] | None = None,
    sandbox_mode: str = "none",
) -> dict:
    collector = TelemetryCollector(job_id, output_dir)
    collector.metrics["sandbox_mode"] = sandbox_mode
    probes = probe_targets or resolve_probe_targets(root, demo_id, analysis.framework)
    live_probes = [(url, name) for url, name in probes if is_endpoint_live(url)]
    if probe_targets and not live_probes:
        live_probes = probe_targets

    for idx, scenario in enumerate(scenarios):
        injector = FailureInjector(scenario, seed=hash(job_id) + idx)
        result = None
        source = "injector"

        if scenario.get("category") == "database":
            result = injector.simulate_db_failure()
            source = "injector:db"
        elif live_probes:
            url, service = live_probes[idx % len(live_probes)]
            scenario = {**scenario, "target": f"{scenario.get('target')} → {service}"}
            result = injector.intercept_http(url)
            source = "injector:live"
            collector.metrics["live_probes"] += 1
        else:
            result = injector.wrap_call(lambda: None)
            source = "injector:synthetic"
            collector.metrics["synthetic_probes"] += 1

        collector.record_injection(scenario, result, source=source)
        scenario["injected"] = True
        scenario["outcome"] = "failed" if not result.success else "degraded"

    return collector.finalize(analysis, scenarios)
