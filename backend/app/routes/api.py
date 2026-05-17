from datetime import datetime, timezone
from pathlib import Path

from flask import Blueprint, g, jsonify, request

from app.config import settings
from app.models.db import AnalysisRun, Project
from app.services.pipeline import start_analysis
from app.services.session_service import with_db
from app.services.upload_service import UploadError, store_upload

api_bp = Blueprint("api", __name__, url_prefix="/api")


def _ok(data=None, status=200):
    return jsonify({"success": True, "data": data, "error": None}), status


def _err(message: str, status=400):
    return jsonify({"success": False, "data": None, "error": message}), status


@api_bp.post("/upload-project")
@with_db
def upload_project():
    if "file" not in request.files:
        return _err("Missing file field 'file'")
    file = request.files["file"]
    if not file.filename:
        return _err("Empty filename")

    try:
        root, name = store_upload(g.session.token, file.filename, file)
    except UploadError as exc:
        return _err(str(exc))

    project = Project(
        session_id=g.session.id,
        name=name,
        source_type="upload",
        framework="unknown",
        root_path=str(root),
    )
    g.db.add(project)
    g.db.commit()
    g.db.refresh(project)

    return _ok(
        {
            "project": {
                "id": project.id,
                "name": project.name,
                "framework": project.framework,
                "source_type": project.source_type,
                "created_at": project.created_at.isoformat(),
            }
        },
        201,
    )


@api_bp.get("/projects")
@with_db
def list_projects():
    projects = (
        g.db.query(Project)
        .filter_by(session_id=g.session.id)
        .order_by(Project.updated_at.desc())
        .all()
    )
    return _ok(
        {
            "projects": [
                {
                    "id": p.id,
                    "name": p.name,
                    "framework": p.framework,
                    "source_type": p.source_type,
                    "demo_id": p.demo_id,
                    "dependency_count": p.dependency_count,
                    "created_at": p.created_at.isoformat(),
                    "latest_run": _latest_run_summary(g.db, p.id),
                }
                for p in projects
            ],
            "demos": [_demo_response(meta) for meta in settings.DEMO_CATALOG.values()],
        }
    )


@api_bp.get("/projects/<int:project_id>")
@with_db
def get_project(project_id: int):
    project = (
        g.db.query(Project)
        .filter_by(id=project_id, session_id=g.session.id)
        .first()
    )
    if not project:
        return _err("Project not found", 404)
    return _ok({"project": _project_dict(project, g.db)})


@api_bp.get("/analysis-history")
@with_db
def analysis_history():
    runs = (
        g.db.query(AnalysisRun)
        .join(Project)
        .filter(Project.session_id == g.session.id)
        .order_by(AnalysisRun.created_at.desc())
        .limit(50)
        .all()
    )
    return _ok(
        {
            "history": [
                {
                    "job_id": r.job_id,
                    "project_id": r.project_id,
                    "project_name": r.project.name,
                    "framework": r.project.framework,
                    "status": r.status,
                    "risk_score": r.risk_score,
                    "severity": r.severity,
                    "failure_count": r.failure_count,
                    "created_at": r.created_at.isoformat(),
                    "completed_at": r.completed_at.isoformat() if r.completed_at else None,
                }
                for r in runs
            ]
        }
    )


@api_bp.post("/analyze")
@with_db
def analyze():
    body = request.get_json(silent=True) or {}
    project_id = body.get("project_id")
    demo_id = body.get("demo_id")

    if demo_id:
        meta = settings.DEMO_CATALOG.get(demo_id)
        if not meta:
            return _err("Unknown demo id")
        demo_path: Path = meta["path"]
        if not demo_path.exists():
            return _err(
                f"Demo '{demo_id}' not on disk — upload its ZIP via /upload-project first",
                404,
            )
        project = Project(
            session_id=g.session.id,
            name=meta["name"],
            source_type="demo",
            demo_id=demo_id,
            framework=meta["framework"],
            root_path=str(demo_path.resolve()),
            dependency_count=meta["dependency_count"],
        )
        g.db.add(project)
        g.db.commit()
        g.db.refresh(project)
        project_id = project.id

    if not project_id:
        return _err("project_id or demo_id required")

    project = (
        g.db.query(Project)
        .filter_by(id=project_id, session_id=g.session.id)
        .first()
    )
    if not project:
        return _err("Project not found", 404)

    job_id = start_analysis(project.id)
    return _ok({"job_id": job_id, "project_id": project.id}, 202)


@api_bp.post("/simulate")
@with_db
def simulate():
    return analyze()


@api_bp.post("/reanalyze/<int:project_id>")
@with_db
def reanalyze(project_id: int):
    project = (
        g.db.query(Project)
        .filter_by(id=project_id, session_id=g.session.id)
        .first()
    )
    if not project:
        return _err("Project not found", 404)
    job_id = start_analysis(project.id, reanalyze=True)
    return _ok({"job_id": job_id, "project_id": project.id}, 202)


@api_bp.get("/status/<job_id>")
@with_db
def status(job_id: str):
    run = (
        g.db.query(AnalysisRun)
        .join(Project)
        .filter(AnalysisRun.job_id == job_id, Project.session_id == g.session.id)
        .first()
    )
    if not run:
        return _err("Job not found", 404)
    logs = [
        {
            "level": log.level,
            "message": log.message,
            "source": log.source,
            "created_at": log.created_at.isoformat(),
            "payload": log.payload,
        }
        for log in run.logs[-30:]
    ]
    return _ok(
        {
            "job_id": run.job_id,
            "status": run.status,
            "stage": run.current_stage,
            "progress": run.progress,
            "project_id": run.project_id,
            "logs": logs,
        }
    )


@api_bp.get("/results/<job_id>")
@with_db
def results(job_id: str):
    run = _get_run(job_id)
    if not run:
        return _err("Job not found", 404)
    if run.status != "completed":
        return _err("Analysis not complete", 409)

    risk = run.risk_report.payload if run.risk_report else {}
    telemetry = (
        {
            "metrics": run.telemetry.metrics,
            "traces": run.telemetry.traces,
            "timeline": run.telemetry.timeline,
            "dependency_graph": run.telemetry.dependency_graph,
            "blast_radius": run.telemetry.blast_radius,
        }
        if run.telemetry
        else {}
    )
    scenarios = [
        {
            "name": s.name,
            "category": s.category,
            "severity": s.severity,
            "target": s.target,
            "description": s.description,
            "injected": s.injected,
            "outcome": s.outcome,
        }
        for s in run.scenarios
    ]
    ai = run.ai_report.payload if run.ai_report else {}

    return _ok(
        {
            "job_id": run.job_id,
            "project": {
                "id": run.project.id,
                "name": run.project.name,
                "framework": run.project.framework,
            },
            "risk_score": run.risk_score,
            "severity": run.severity,
            "failure_count": run.failure_count,
            "summary": run.summary,
            "risk": risk,
            "scenarios": scenarios,
            "telemetry": telemetry,
            "ai": ai,
            "completed_at": run.completed_at.isoformat() if run.completed_at else None,
        }
    )


@api_bp.get("/logs/<job_id>")
@with_db
def logs(job_id: str):
    run = _get_run(job_id)
    if not run:
        return _err("Job not found", 404)
    return _ok(
        {
            "logs": [
                {
                    "level": log.level,
                    "message": log.message,
                    "source": log.source,
                    "created_at": log.created_at.isoformat(),
                    "payload": log.payload,
                }
                for log in run.logs
            ]
        }
    )


@api_bp.get("/metrics/<job_id>")
@with_db
def metrics(job_id: str):
    run = _get_run(job_id)
    if not run:
        return _err("Job not found", 404)
    if not run.telemetry:
        return _ok({"metrics": {}})
    return _ok({"metrics": run.telemetry.metrics})


def _get_run(job_id: str) -> AnalysisRun | None:
    return (
        g.db.query(AnalysisRun)
        .join(Project)
        .filter(AnalysisRun.job_id == job_id, Project.session_id == g.session.id)
        .first()
    )


def _demo_response(meta: dict) -> dict:
    path: Path = meta["path"]
    return {
        "id": meta["id"],
        "name": meta["name"],
        "framework": meta["framework"],
        "architecture": meta["architecture"],
        "risk_level": meta["risk_level"],
        "dependency_count": meta["dependency_count"],
        "description": meta["description"],
        "available": path.exists(),
    }


def _latest_run_summary(db, project_id: int) -> dict | None:
    run = (
        db.query(AnalysisRun)
        .filter_by(project_id=project_id)
        .order_by(AnalysisRun.created_at.desc())
        .first()
    )
    if not run:
        return None
    return {
        "job_id": run.job_id,
        "status": run.status,
        "risk_score": run.risk_score,
        "severity": run.severity,
        "failure_count": run.failure_count,
    }


def _project_dict(project: Project, db) -> dict:
    return {
        "id": project.id,
        "name": project.name,
        "framework": project.framework,
        "source_type": project.source_type,
        "demo_id": project.demo_id,
        "dependency_count": project.dependency_count,
        "root_path": project.root_path,
        "created_at": project.created_at.isoformat(),
        "latest_run": _latest_run_summary(db, project.id),
    }
