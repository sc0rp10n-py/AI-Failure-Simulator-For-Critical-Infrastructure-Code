"""Analysis cache: return latest completed run for a project."""

from __future__ import annotations

from app.models.db import AnalysisRun, SessionLocal


def get_latest_completed_run(project_id: int) -> AnalysisRun | None:
    db = SessionLocal()
    try:
        return (
            db.query(AnalysisRun)
            .filter_by(project_id=project_id, status="completed")
            .order_by(AnalysisRun.completed_at.desc())
            .first()
        )
    finally:
        db.close()


def cache_summary(run: AnalysisRun) -> dict:
    return {
        "job_id": run.job_id,
        "project_id": run.project_id,
        "risk_score": run.risk_score,
        "severity": run.severity,
        "failure_count": run.failure_count,
        "summary": run.summary,
        "completed_at": run.completed_at.isoformat() if run.completed_at else None,
    }
