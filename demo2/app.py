from __future__ import annotations

import json
import logging
import os
import threading
import time
import uuid
from collections import deque
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from typing import Any

import requests
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload = {
            "ts": utc_now(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }
        if hasattr(record, "event"):
            payload["event"] = record.event
        if hasattr(record, "case_id"):
            payload["case_id"] = record.case_id
        if hasattr(record, "hospital_id"):
            payload["hospital_id"] = record.hospital_id
        if hasattr(record, "ambulance_id"):
            payload["ambulance_id"] = record.ambulance_id
        if hasattr(record, "duration_ms"):
            payload["duration_ms"] = record.duration_ms
        if hasattr(record, "error"):
            payload["error"] = record.error
        return json.dumps(payload, separators=(",", ":"))


logger = logging.getLogger("demo2.dispatch")
handler = logging.StreamHandler()
handler.setFormatter(JsonFormatter())
logger.addHandler(handler)
logger.setLevel(logging.INFO)
logger.propagate = False


class IntakeRequest(BaseModel):
    patient_name: str = Field(min_length=2)
    age: int = Field(ge=0, le=130)
    condition: str = Field(min_length=3)
    latitude: float
    longitude: float
    callback_number: str = Field(min_length=7)
    symptoms: list[str] = Field(default_factory=list)
    priority: str = Field(default="critical")


class DispatchRequest(BaseModel):
    case_id: str


class HospitalStatus(BaseModel):
    hospital_id: str
    name: str
    beds_available: int
    icu_available: int
    er_wait_minutes: int
    status: str


@dataclass
class AmbulanceUnit:
    ambulance_id: str
    status: str = "available"
    current_case_id: str | None = None
    last_updated: str = field(default_factory=utc_now)


@dataclass
class EmergencyCase:
    case_id: str
    patient_name: str
    age: int
    condition: str
    latitude: float
    longitude: float
    callback_number: str
    symptoms: list[str]
    priority: str
    status: str = "queued"
    ambulance_id: str | None = None
    hospital_id: str | None = None
    route_minutes: int | None = None
    created_at: str = field(default_factory=utc_now)
    updated_at: str = field(default_factory=utc_now)


@dataclass
class DispatchMetrics:
    intake_count: int = 0
    dispatch_count: int = 0
    dispatch_delay_count: int = 0
    map_api_failures: int = 0
    hospital_timeouts: int = 0
    overload_events: int = 0
    average_dispatch_ms: float = 0.0
    active_cases: int = 0
    queue_depth: int = 0


class AppState:
    def __init__(self) -> None:
        self.lock = threading.Lock()
        self.ambulances = [
            AmbulanceUnit("AMB-17"),
            AmbulanceUnit("AMB-22"),
            AmbulanceUnit("AMB-31"),
            AmbulanceUnit("AMB-44"),
        ]
        self.hospitals = [
            HospitalStatus("HOSP-101", "North Emergency Center", 3, 1, 12, "open"),
            HospitalStatus("HOSP-204", "Riverside Trauma", 0, 0, 31, "limited"),
            HospitalStatus("HOSP-319", "Metro General", 6, 2, 18, "open"),
        ]
        self.cases: dict[str, EmergencyCase] = {}
        self.metrics = DispatchMetrics()
        self.recent_events: deque[dict[str, Any]] = deque(maxlen=200)


state = AppState()
app = FastAPI(title="Demo2 Emergency Dispatch Backend", version="0.1.0")


def record_event(event: str, **fields: Any) -> None:
    payload = {"ts": utc_now(), "event": event, **fields}
    state.recent_events.append(payload)
    logger.info(event, extra={"event": event, **fields})


def simulate_mapping_lookup(case: EmergencyCase) -> int:
    map_api_url = os.getenv("MAP_API_URL", "https://maps.example.invalid/route")
    timeout_seconds = float(os.getenv("MAP_API_TIMEOUT_SECONDS", "2.5"))

    try:
        start = time.perf_counter()
        response = requests.get(
            map_api_url,
            params={
                "lat": case.latitude,
                "lon": case.longitude,
                "priority": case.priority,
            },
            timeout=timeout_seconds,
        )
        response.raise_for_status()
        payload = (
            response.json()
            if response.headers.get("content-type", "").startswith("application/json")
            else {}
        )
        route_minutes = int(payload.get("route_minutes", 14))
        elapsed_ms = int((time.perf_counter() - start) * 1000)
        record_event(
            "mapping.lookup.succeeded",
            case_id=case.case_id,
            duration_ms=elapsed_ms,
        )
        return route_minutes
    except Exception as exc:  # intentional blocking external dependency failure path
        state.metrics.map_api_failures += 1
        record_event(
            "mapping.lookup.failed",
            case_id=case.case_id,
            error=str(exc),
        )
        time.sleep(1.2)
        return 24


def find_hospital(case: EmergencyCase) -> HospitalStatus:
    with state.lock:  # coarse lock is intentional; it becomes a single bottleneck under load
        time.sleep(0.4)
        open_hospitals = [
            hospital for hospital in state.hospitals if hospital.status != "closed"
        ]
        if not open_hospitals:
            state.metrics.hospital_timeouts += 1
            raise HTTPException(status_code=503, detail="No hospitals available")

        selected = sorted(
            open_hospitals,
            key=lambda hospital: (
                hospital.er_wait_minutes,
                hospital.beds_available,
                hospital.icu_available,
            ),
        )[0]
        if selected.beds_available <= 0:
            selected.er_wait_minutes += 8
            state.metrics.hospital_timeouts += 1
        return selected


def assign_ambulance(case: EmergencyCase) -> AmbulanceUnit:
    with state.lock:
        time.sleep(0.5)
        for ambulance in state.ambulances:
            if ambulance.status == "available":
                ambulance.status = "busy"
                ambulance.current_case_id = case.case_id
                ambulance.last_updated = utc_now()
                return ambulance

        state.metrics.overload_events += 1
        raise HTTPException(
            status_code=429, detail="All ambulances are currently assigned"
        )


def update_dispatch_metrics(duration_ms: int) -> None:
    total = state.metrics.dispatch_count
    current = state.metrics.average_dispatch_ms
    state.metrics.average_dispatch_ms = (
        round(((current * (total - 1)) + duration_ms) / total, 2)
        if total
        else float(duration_ms)
    )
    state.metrics.active_cases = sum(
        1
        for case in state.cases.values()
        if case.status not in {"completed", "cancelled"}
    )
    state.metrics.queue_depth = sum(
        1 for case in state.cases.values() if case.status == "queued"
    )


@app.post("/intake")
def intake_case(payload: IntakeRequest) -> dict[str, Any]:
    state.metrics.intake_count += 1
    case = EmergencyCase(
        case_id=f"CASE-{uuid.uuid4().hex[:10].upper()}", **payload.model_dump()
    )
    state.cases[case.case_id] = case
    state.metrics.queue_depth += 1
    record_event("intake.accepted", case_id=case.case_id)
    return {
        "case_id": case.case_id,
        "status": case.status,
        "created_at": case.created_at,
    }


@app.post("/dispatch")
def dispatch_case(payload: DispatchRequest) -> dict[str, Any]:
    case = state.cases.get(payload.case_id)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    if state.metrics.queue_depth > 12:
        state.metrics.dispatch_delay_count += 1
        record_event(
            "dispatch.queue.backlog",
            case_id=case.case_id,
            backlog=state.metrics.queue_depth,
        )

    start = time.perf_counter()
    record_event("dispatch.started", case_id=case.case_id)

    route_minutes = simulate_mapping_lookup(case)
    hospital = find_hospital(case)
    ambulance = assign_ambulance(case)

    case.status = "dispatched"
    case.route_minutes = route_minutes
    case.hospital_id = hospital.hospital_id
    case.ambulance_id = ambulance.ambulance_id
    case.updated_at = utc_now()
    state.metrics.dispatch_count += 1
    state.metrics.queue_depth = max(0, state.metrics.queue_depth - 1)

    dispatch_ms = int((time.perf_counter() - start) * 1000)
    update_dispatch_metrics(dispatch_ms)

    record_event(
        "dispatch.completed",
        case_id=case.case_id,
        hospital_id=hospital.hospital_id,
        ambulance_id=ambulance.ambulance_id,
        duration_ms=dispatch_ms,
    )
    return {
        "case_id": case.case_id,
        "status": case.status,
        "ambulance_id": ambulance.ambulance_id,
        "hospital_id": hospital.hospital_id,
        "route_minutes": route_minutes,
        "dispatch_ms": dispatch_ms,
    }


@app.get("/hospitals/availability")
def hospital_availability() -> list[HospitalStatus]:
    with state.lock:
        time.sleep(0.35)
        return state.hospitals


@app.get("/telemetry")
def telemetry_snapshot() -> dict[str, Any]:
    return {
        "timestamp": utc_now(),
        "metrics": asdict(state.metrics),
        "active_cases": [
            asdict(case) for case in state.cases.values() if case.status != "completed"
        ],
        "recent_events": list(state.recent_events)[-25:],
    }


@app.get("/logs/recent")
def recent_logs() -> dict[str, Any]:
    return {"entries": list(state.recent_events)[-50:]}


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "demo2-emergency-dispatch"}


@app.post("/simulate/load")
def simulate_load(count: int = 8) -> dict[str, Any]:
    generated = []
    for index in range(count):
        intake = intake_case(
            IntakeRequest(
                patient_name=f"Patient {index + 1}",
                age=34 + index,
                condition="chest pain with shortness of breath",
                latitude=40.71 + (index * 0.01),
                longitude=-74.00 - (index * 0.01),
                callback_number=f"555-010{index}",
                symptoms=["chest pain", "dizziness"],
                priority="critical",
            )
        )
        generated.append(dispatch_case(DispatchRequest(case_id=intake["case_id"])))

    return {"generated": generated, "metrics": asdict(state.metrics)}


@app.on_event("startup")
def startup_banner() -> None:
    record_event("service.startup", service="demo2-emergency-dispatch")
