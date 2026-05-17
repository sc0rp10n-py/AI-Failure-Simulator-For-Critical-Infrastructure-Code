from datetime import datetime, timezone

from sqlalchemy import (
    JSON,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    create_engine,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship, sessionmaker

from app.config import settings


class Base(DeclarativeBase):
    pass


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class UserSession(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    token: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Project(Base):
    __tablename__ = "projects"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    session_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    name: Mapped[str] = mapped_column(String(255))
    source_type: Mapped[str] = mapped_column(String(32))  # demo | upload
    demo_id: Mapped[str | None] = mapped_column(String(32), nullable=True)
    framework: Mapped[str] = mapped_column(String(64), default="unknown")
    root_path: Mapped[str] = mapped_column(Text)
    dependency_count: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow
    )

    runs: Mapped[list["AnalysisRun"]] = relationship(back_populates="project")


class AnalysisRun(Base):
    __tablename__ = "analysis_runs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    job_id: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    correlation_id: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id"))
    status: Mapped[str] = mapped_column(String(32), default="queued")
    current_stage: Mapped[str] = mapped_column(String(64), default="queued")
    progress: Mapped[float] = mapped_column(Float, default=0.0)
    risk_score: Mapped[float] = mapped_column(Float, default=0.0)
    severity: Mapped[str] = mapped_column(String(16), default="Low")
    failure_count: Mapped[int] = mapped_column(Integer, default=0)
    summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    project: Mapped[Project] = relationship(back_populates="runs")
    risk_report: Mapped["RiskReport | None"] = relationship(back_populates="run", uselist=False)
    scenarios: Mapped[list["FailureScenario"]] = relationship(back_populates="run")
    telemetry: Mapped["TelemetryBundle | None"] = relationship(back_populates="run", uselist=False)
    logs: Mapped[list["LogEntry"]] = relationship(back_populates="run")
    ai_report: Mapped["AIReport | None"] = relationship(back_populates="run", uselist=False)


class RiskReport(Base):
    __tablename__ = "risk_reports"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    run_id: Mapped[int] = mapped_column(ForeignKey("analysis_runs.id"), unique=True)
    payload: Mapped[dict] = mapped_column(JSON)

    run: Mapped[AnalysisRun] = relationship(back_populates="risk_report")


class FailureScenario(Base):
    __tablename__ = "failure_scenarios"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    run_id: Mapped[int] = mapped_column(ForeignKey("analysis_runs.id"))
    name: Mapped[str] = mapped_column(String(255))
    category: Mapped[str] = mapped_column(String(64))
    severity: Mapped[str] = mapped_column(String(16))
    target: Mapped[str] = mapped_column(String(255))
    description: Mapped[str] = mapped_column(Text)
    injected: Mapped[bool] = mapped_column(default=False)
    outcome: Mapped[str | None] = mapped_column(Text, nullable=True)

    run: Mapped[AnalysisRun] = relationship(back_populates="scenarios")


class TelemetryBundle(Base):
    __tablename__ = "telemetry"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    run_id: Mapped[int] = mapped_column(ForeignKey("analysis_runs.id"), unique=True)
    metrics: Mapped[dict] = mapped_column(JSON)
    traces: Mapped[dict] = mapped_column(JSON)
    timeline: Mapped[list] = mapped_column(JSON)
    dependency_graph: Mapped[dict] = mapped_column(JSON)
    blast_radius: Mapped[dict] = mapped_column(JSON)

    run: Mapped[AnalysisRun] = relationship(back_populates="telemetry")


class LogEntry(Base):
    __tablename__ = "logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    run_id: Mapped[int] = mapped_column(ForeignKey("analysis_runs.id"))
    level: Mapped[str] = mapped_column(String(16))
    message: Mapped[str] = mapped_column(Text)
    source: Mapped[str] = mapped_column(String(64), default="pipeline")
    payload: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    run: Mapped[AnalysisRun] = relationship(back_populates="logs")


class AIReport(Base):
    __tablename__ = "ai_reports"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    run_id: Mapped[int] = mapped_column(ForeignKey("analysis_runs.id"), unique=True)
    payload: Mapped[dict] = mapped_column(JSON)

    run: Mapped[AnalysisRun] = relationship(back_populates="ai_report")


engine = create_engine(f"sqlite:///{settings.DB_PATH}", echo=False, future=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


def init_db() -> None:
    Base.metadata.create_all(engine)
    _migrate_sqlite()


def _migrate_sqlite() -> None:
    from sqlalchemy import inspect, text

    inspector = inspect(engine)
    if "analysis_runs" not in inspector.get_table_names():
        return
    columns = {c["name"] for c in inspector.get_columns("analysis_runs")}
    if "correlation_id" not in columns:
        with engine.begin() as conn:
            conn.execute(
                text("ALTER TABLE analysis_runs ADD COLUMN correlation_id VARCHAR(64)")
            )


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
