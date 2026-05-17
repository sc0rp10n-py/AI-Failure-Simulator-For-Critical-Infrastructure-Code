import threading
import uuid
from datetime import datetime, timezone
from pathlib import Path

from flask import g, has_request_context

from app.ai.orchestrator import build_ai_report
from app.analyzers.code_analyzer import analyze_project
from app.config import settings
from app.logging.structured import get_logger, new_correlation_id
from app.models.db import (
    AIReport,
    AnalysisRun,
    FailureScenario,
    LogEntry,
    Project,
    RiskReport,
    SessionLocal,
    TelemetryBundle,
)
from app.sandbox import start_sandbox
from app.simulators.demo_probes import resolve_probe_targets
from app.simulators.execution_engine import run_simulation
from app.simulators.strategy_engine import generate_scenarios

logger = get_logger("pipeline")

STAGE_PROGRESS = {
    "queued": 0,
    "upload_complete": 8,
    "extraction_complete": 18,
    "dependency_scan_complete": 35,
    "risk_analysis_complete": 52,
    "failure_generation_complete": 68,
    "sandbox_ready": 75,
    "simulation_complete": 82,
    "telemetry_complete": 90,
    "ai_analysis_complete": 100,
}


def _correlation_id() -> str:
    if has_request_context() and hasattr(g, "correlation_id"):
        return g.correlation_id
    return new_correlation_id()


def start_analysis(
    project_id: int,
    reanalyze: bool = False,
    *,
    correlation_id: str | None = None,
) -> str:
    job_id = str(uuid.uuid4())
    corr = correlation_id or _correlation_id()
    db = SessionLocal()
    try:
        project = db.get(Project, project_id)
        if not project:
            raise ValueError("Project not found")

        run = AnalysisRun(
            job_id=job_id,
            correlation_id=corr,
            project_id=project.id,
            status="running",
            current_stage="upload_complete",
            progress=STAGE_PROGRESS["upload_complete"],
        )
        db.add(run)
        db.commit()
    finally:
        db.close()

    thread = threading.Thread(
        target=_run_pipeline,
        args=(job_id, reanalyze),
        daemon=True,
    )
    thread.start()
    logger.info(
        "Pipeline started",
        extra={"job_id": job_id, "correlation_id": corr, "event": "pipeline_start"},
    )
    return job_id


def _run_pipeline(job_id: str, reanalyze: bool) -> None:
    db = SessionLocal()
    try:
        run = db.query(AnalysisRun).filter_by(job_id=job_id).first()
        if not run:
            return
        project = run.project
        root = Path(project.root_path)
        output_dir = settings.OUTPUT_ROOT / job_id
        corr = run.correlation_id or job_id

        _advance(db, run, "extraction_complete", "Extracted project tree ready for scan", corr)
        _advance(db, run, "dependency_scan_complete", "Mapping service and dependency graph", corr)

        analysis = analyze_project(root)
        project.framework = analysis.framework
        project.dependency_count = (
            len(analysis.dependencies[0].get("nodes", [])) if analysis.dependencies else 0
        )
        db.add(RiskReport(run_id=run.id, payload=analysis.to_dict()))
        _advance(
            db,
            run,
            "risk_analysis_complete",
            f"Risk score {analysis.risk_score():.0f} ({analysis.severity_label()})",
            corr,
        )

        scenarios = generate_scenarios(analysis)
        for scenario in scenarios:
            db.add(
                FailureScenario(
                    run_id=run.id,
                    name=scenario["name"],
                    category=scenario["category"],
                    severity=scenario["severity"],
                    target=scenario["target"],
                    description=scenario["description"],
                )
            )
        _advance(
            db,
            run,
            "failure_generation_complete",
            f"Generated {len(scenarios)} failure scenarios",
            corr,
        )

        sandbox = None
        probe_targets: list[tuple[str, str]] = []
        try:
            sandbox = start_sandbox(root, analysis.framework)
            if sandbox and sandbox.probe_targets:
                probe_targets = sandbox.probe_targets
                _advance(
                    db,
                    run,
                    "sandbox_ready",
                    f"Sandbox ({sandbox.mode}) live at {sandbox.base_url} — {len(probe_targets)} endpoints",
                    corr,
                )
            elif sandbox:
                _advance(
                    db,
                    run,
                    "sandbox_ready",
                    f"Sandbox ({sandbox.mode}) started; warming endpoints",
                    corr,
                )
                probe_targets = resolve_probe_targets(root, project.demo_id, analysis.framework)
            else:
                _advance(
                    db,
                    run,
                    "sandbox_ready",
                    "Sandbox unavailable — using static analysis + synthetic probes",
                    corr,
                )
                probe_targets = resolve_probe_targets(root, project.demo_id, analysis.framework)
        except Exception as sbx_exc:
            _advance(
                db,
                run,
                "sandbox_ready",
                f"Sandbox error: {sbx_exc}",
                corr,
            )
            probe_targets = resolve_probe_targets(root, project.demo_id, analysis.framework)

        try:
            telemetry = run_simulation(
                root,
                analysis,
                scenarios,
                output_dir,
                job_id=job_id,
                demo_id=project.demo_id,
                probe_targets=probe_targets,
                sandbox_mode=sandbox.mode if sandbox else "none",
            )
        finally:
            if sandbox:
                sandbox.stop()
        for scenario in scenarios:
            existing = (
                db.query(FailureScenario)
                .filter_by(run_id=run.id, name=scenario["name"])
                .first()
            )
            if existing:
                existing.injected = scenario.get("injected", False)
                existing.outcome = scenario.get("outcome")

        _advance(db, run, "simulation_complete", "Executed autonomous failure injections", corr)

        metrics_payload = {
            **telemetry["metrics"],
            "heatmap": telemetry.get("heatmap", []),
        }
        bundle = TelemetryBundle(
            run_id=run.id,
            metrics=metrics_payload,
            traces=telemetry["traces"],
            timeline=telemetry["timeline"],
            dependency_graph=telemetry["dependency_graph"],
            blast_radius=telemetry["blast_radius"],
        )
        db.add(bundle)

        _log_simulation_entries(db, run.id, output_dir)
        _advance(db, run, "telemetry_complete", "Telemetry captured", corr)

        ai_payload = build_ai_report(analysis, scenarios, telemetry)
        db.add(AIReport(run_id=run.id, payload=ai_payload))

        run.risk_score = analysis.risk_score()
        run.severity = analysis.severity_label()
        run.failure_count = len(scenarios)
        run.summary = ai_payload.get("summary") or ai_payload.get("root_cause", "")
        run.status = "completed"
        run.completed_at = datetime.now(timezone.utc)
        _advance(db, run, "ai_analysis_complete", "AI resilience report generated", corr)
        db.commit()
        logger.info(
            "Pipeline complete",
            extra={"job_id": job_id, "correlation_id": corr, "event": "pipeline_complete"},
        )
    except Exception as exc:
        logger.info(
            "Pipeline failed",
            extra={"job_id": job_id, "event": "pipeline_failed", "error": str(exc)},
        )
        run = db.query(AnalysisRun).filter_by(job_id=job_id).first()
        if run:
            run.status = "failed"
            run.summary = str(exc)
            db.add(
                LogEntry(
                    run_id=run.id,
                    level="ERROR",
                    message=f"Pipeline failed: {exc}",
                    source="pipeline",
                    payload={"correlation_id": run.correlation_id},
                )
            )
            db.commit()
    finally:
        db.close()


def _advance(db, run: AnalysisRun, stage: str, message: str, correlation_id: str) -> None:
    run.current_stage = stage
    run.progress = STAGE_PROGRESS.get(stage, run.progress)
    db.add(
        LogEntry(
            run_id=run.id,
            level="INFO",
            message=message,
            source="pipeline",
            payload={"stage": stage, "correlation_id": correlation_id},
        )
    )
    db.commit()


def _log_simulation_entries(db, run_id: int, output_dir: Path) -> None:
    log_file = output_dir / "simulation.log.jsonl"
    if not log_file.exists():
        return
    import json

    for line in log_file.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        entry = json.loads(line)
        db.add(
            LogEntry(
                run_id=run_id,
                level=entry.get("level", "INFO"),
                message=entry.get("message", ""),
                source=entry.get("source", "injector"),
                payload=entry.get("payload"),
            )
        )
    db.commit()
