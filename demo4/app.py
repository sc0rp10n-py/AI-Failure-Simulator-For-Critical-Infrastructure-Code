from __future__ import annotations

import json
import logging
import os
import random
import threading
import time
import uuid
from collections import deque
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from typing import Any

import requests
from flask import Flask, jsonify, request


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, Any] = {
            "ts": utc_now(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }
        for attr in (
            "event",
            "transaction_id",
            "merchant_id",
            "customer_id",
            "score",
            "risk_band",
            "duration_ms",
            "attempt",
            "status",
            "error",
        ):
            if hasattr(record, attr):
                payload[attr] = getattr(record, attr)
        return json.dumps(payload, separators=(",", ":"))


logger = logging.getLogger("demo4.fraud")
handler = logging.StreamHandler()
handler.setFormatter(JsonFormatter())
logger.addHandler(handler)
logger.setLevel(logging.INFO)
logger.propagate = False


def event_logger(event: str, **fields: Any) -> None:
    logger.info(event, extra={"event": event, **fields})


@dataclass
class Transaction:
    transaction_id: str
    merchant_id: str
    customer_id: str
    amount: float
    currency: str
    channel: str
    ip_address: str
    device_id: str
    state: str = "queued"
    score: int | None = None
    risk_band: str | None = None
    verification_status: str | None = None
    notification_status: str | None = None
    created_at: str = field(default_factory=utc_now)
    updated_at: str = field(default_factory=utc_now)


@dataclass
class Telemetry:
    ingested: int = 0
    scored: int = 0
    verified: int = 0
    notifications_sent: int = 0
    duplicate_notifications: int = 0
    verification_failures: int = 0
    scoring_delays: int = 0
    retry_storms: int = 0
    queue_depth: int = 0
    active_threads: int = 0
    average_latency_ms: float = 0.0


class AppState:
    def __init__(self) -> None:
        self.lock = threading.Lock()
        self.transactions: dict[str, Transaction] = {}
        self.telemetry = Telemetry()
        self.recent_events: deque[dict[str, Any]] = deque(maxlen=300)
        self.notified_transaction_ids: set[str] = set()


state = AppState()
app = Flask(__name__)


def record_event(event: str, **fields: Any) -> None:
    payload = {"ts": utc_now(), "event": event, **fields}
    state.recent_events.append(payload)
    event_logger(event, **fields)


def transaction_from_payload(payload: dict[str, Any]) -> Transaction:
    return Transaction(
        transaction_id=payload.get("transaction_id") or f"txn_{uuid.uuid4().hex[:12]}",
        merchant_id=payload["merchant_id"],
        customer_id=payload["customer_id"],
        amount=float(payload["amount"]),
        currency=payload.get("currency", "USD"),
        channel=payload.get("channel", "card-present"),
        ip_address=payload.get("ip_address", "0.0.0.0"),
        device_id=payload.get("device_id", "unknown"),
    )


def update_latency(duration_ms: int) -> None:
    total = state.telemetry.ingested
    current = state.telemetry.average_latency_ms
    state.telemetry.average_latency_ms = (
        round(((current * (total - 1)) + duration_ms) / total, 2)
        if total
        else float(duration_ms)
    )


def score_transaction(transaction: Transaction) -> tuple[int, str]:
    time.sleep(float(os.getenv("SCORING_BASE_DELAY_SECONDS", "0.08")))
    with state.lock:
        time.sleep(0.18)
        score = 10
        if transaction.amount >= 2500:
            score += 32
        if transaction.amount >= 5000:
            score += 20
        if transaction.channel == "web":
            score += 11
        if transaction.ip_address.startswith("10."):
            score += 4
        if transaction.device_id in {"emulator", "new-device", "shared-kiosk"}:
            score += 18
        if transaction.currency != "USD":
            score += 6

        if transaction.amount > 12000:
            state.telemetry.scoring_delays += 1
            time.sleep(0.45)
            score += 9

        score = min(100, score + random.randint(0, 14))
        if score >= 80:
            band = "high"
        elif score >= 55:
            band = "medium"
        else:
            band = "low"
        transaction.score = score
        transaction.risk_band = band
        transaction.state = "scored"
        transaction.updated_at = utc_now()
        state.telemetry.scored += 1
        record_event(
            "fraud.scoring.completed",
            transaction_id=transaction.transaction_id,
            merchant_id=transaction.merchant_id,
            customer_id=transaction.customer_id,
            score=score,
            risk_band=band,
        )
        return score, band


def verification_client(transaction: Transaction) -> dict[str, Any]:
    url = os.getenv(
        "VERIFICATION_API_URL", "https://verification.example.invalid/check"
    )
    timeout_seconds = float(os.getenv("VERIFICATION_TIMEOUT_SECONDS", "1.2"))
    response = requests.post(
        url,
        json={
            "transaction_id": transaction.transaction_id,
            "merchant_id": transaction.merchant_id,
            "customer_id": transaction.customer_id,
            "amount": transaction.amount,
            "currency": transaction.currency,
            "risk_band": transaction.risk_band,
        },
        timeout=timeout_seconds,
    )
    response.raise_for_status()
    return (
        response.json()
        if response.headers.get("content-type", "").startswith("application/json")
        else {}
    )


def verify_transaction(transaction: Transaction) -> str:
    retries = int(os.getenv("VERIFICATION_RETRIES", "3"))
    for attempt in range(1, retries + 1):
        try:
            start = time.perf_counter()
            payload = verification_client(transaction)
            elapsed_ms = int((time.perf_counter() - start) * 1000)
            status = payload.get("status", "approved")
            if elapsed_ms > 900:
                state.telemetry.retry_storms += 1
            transaction.verification_status = status
            transaction.state = "verified"
            transaction.updated_at = utc_now()
            state.telemetry.verified += 1
            record_event(
                "verification.completed",
                transaction_id=transaction.transaction_id,
                status=status,
                duration_ms=elapsed_ms,
                attempt=attempt,
            )
            return status
        except Exception as exc:
            state.telemetry.verification_failures += 1
            record_event(
                "verification.failed",
                transaction_id=transaction.transaction_id,
                attempt=attempt,
                error=str(exc),
            )
            if attempt < retries:
                backoff = 0.12 * attempt
                time.sleep(backoff)
                continue
            transaction.verification_status = "deferred"
            transaction.state = "verification_deferred"
            transaction.updated_at = utc_now()
            return "deferred"


def send_notification(transaction: Transaction) -> str:
    # Intentional duplicate delivery risk: notifications are not idempotent across retries.
    if transaction.transaction_id in state.notified_transaction_ids:
        state.telemetry.duplicate_notifications += 1
        record_event(
            "notification.duplicate_detected",
            transaction_id=transaction.transaction_id,
            merchant_id=transaction.merchant_id,
        )
    try:
        time.sleep(float(os.getenv("NOTIFICATION_DELAY_SECONDS", "0.05")))
        if transaction.risk_band == "high" and random.random() < 0.25:
            raise TimeoutError("notification fanout timed out")
        transaction.notification_status = "sent"
        transaction.state = "notified"
        transaction.updated_at = utc_now()
        state.telemetry.notifications_sent += 1
        state.notified_transaction_ids.add(transaction.transaction_id)
        record_event(
            "notification.sent",
            transaction_id=transaction.transaction_id,
            status="sent",
        )
        return "sent"
    except Exception as exc:
        transaction.notification_status = "queued_for_retry"
        transaction.state = "notification_retry_pending"
        transaction.updated_at = utc_now()
        record_event(
            "notification.retry_scheduled",
            transaction_id=transaction.transaction_id,
            error=str(exc),
        )
        return "queued_for_retry"


def ingest_pipeline(transaction: Transaction) -> Transaction:
    start = time.perf_counter()
    with state.lock:
        state.transactions[transaction.transaction_id] = transaction
        state.telemetry.ingested += 1
        state.telemetry.queue_depth = len(state.transactions)
        state.telemetry.active_threads = threading.active_count()
        record_event(
            "transaction.ingested",
            transaction_id=transaction.transaction_id,
            merchant_id=transaction.merchant_id,
            customer_id=transaction.customer_id,
            amount=transaction.amount,
            channel=transaction.channel,
        )

    score_transaction(transaction)

    # Intentional blocking dependency chain: verification waits on scoring and serializes under load.
    if transaction.risk_band == "high":
        transaction.state = "verification_in_progress"
        verify_transaction(transaction)
        send_notification(transaction)
    else:
        transaction.verification_status = "skipped"
        send_notification(transaction)

    latency_ms = int((time.perf_counter() - start) * 1000)
    update_latency(latency_ms)
    record_event(
        "transaction.pipeline.completed",
        transaction_id=transaction.transaction_id,
        duration_ms=latency_ms,
        score=transaction.score,
        risk_band=transaction.risk_band,
        status=transaction.state,
    )
    return transaction


@app.post("/transactions/ingest")
def ingest_transaction() -> tuple[Any, int]:
    payload = request.get_json(silent=True) or {}
    missing = [
        field
        for field in ("merchant_id", "customer_id", "amount")
        if field not in payload
    ]
    if missing:
        record_event("transaction.rejected", reason="missing_fields", missing=missing)
        return (
            jsonify({"ok": False, "error": "missing_fields", "missing": missing}),
            400,
        )

    transaction = transaction_from_payload(payload)
    processed = ingest_pipeline(transaction)
    return jsonify({"ok": True, "transaction": asdict(processed)}), 202


@app.post("/transactions/burst")
def burst_transactions() -> tuple[Any, int]:
    payload = request.get_json(silent=True) or {}
    count = int(payload.get("count", 12))
    base_amount = float(payload.get("base_amount", 1700))
    records: list[dict[str, Any]] = []

    def worker(index: int) -> None:
        tx = Transaction(
            transaction_id=f"txn_burst_{uuid.uuid4().hex[:10]}",
            merchant_id=f"merchant_{index % 4}",
            customer_id=f"customer_{index % 11}",
            amount=base_amount + (index * 325),
            currency="USD",
            channel="web" if index % 2 else "card-present",
            ip_address=f"10.0.{index % 5}.{(index * 13) % 255}",
            device_id="shared-kiosk" if index % 3 == 0 else "mobile-app",
        )
        processed = ingest_pipeline(tx)
        records.append(asdict(processed))

    threads = [
        threading.Thread(target=worker, args=(index,), daemon=True)
        for index in range(count)
    ]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join()

    return jsonify({"ok": True, "count": count, "transactions": records}), 202


@app.get("/transactions/<transaction_id>")
def get_transaction(transaction_id: str) -> tuple[Any, int]:
    transaction = state.transactions.get(transaction_id)
    if not transaction:
        return jsonify({"ok": False, "error": "not_found"}), 404
    return jsonify({"ok": True, "transaction": asdict(transaction)}), 200


@app.get("/events")
def recent_events() -> tuple[Any, int]:
    limit = int(request.args.get("limit", 50))
    return jsonify({"ok": True, "events": list(state.recent_events)[-limit:]}), 200


@app.get("/telemetry")
def telemetry() -> tuple[Any, int]:
    return jsonify({"ok": True, "telemetry": asdict(state.telemetry)}), 200


@app.post("/simulate/failure")
def simulate_failure() -> tuple[Any, int]:
    payload = request.get_json(silent=True) or {}
    scenario = payload.get("scenario", "verification_slowdown")
    record_event("simulation.triggered", scenario=scenario)

    if scenario == "verification_slowdown":
        tx = transaction_from_payload(
            {
                "merchant_id": "merchant_slow",
                "customer_id": "customer_41",
                "amount": 14900,
                "channel": "web",
                "device_id": "emulator",
            }
        )
        tx.risk_band = "high"
        tx.state = "verification_in_progress"
        state.transactions[tx.transaction_id] = tx
        try:
            verify_transaction(tx)
        except Exception:
            pass
        return (
            jsonify(
                {"ok": True, "scenario": scenario, "transaction_id": tx.transaction_id}
            ),
            202,
        )

    if scenario == "duplicate_notifications":
        tx = transaction_from_payload(
            {
                "merchant_id": "merchant_dup",
                "customer_id": "customer_88",
                "amount": 2650,
                "channel": "web",
                "device_id": "shared-kiosk",
            }
        )
        tx.risk_band = "high"
        state.transactions[tx.transaction_id] = tx
        send_notification(tx)
        send_notification(tx)
        return (
            jsonify(
                {"ok": True, "scenario": scenario, "transaction_id": tx.transaction_id}
            ),
            202,
        )

    if scenario == "scoring_delays":
        tx = transaction_from_payload(
            {
                "merchant_id": "merchant_delay",
                "customer_id": "customer_72",
                "amount": 19000,
                "channel": "web",
                "device_id": "new-device",
            }
        )
        state.transactions[tx.transaction_id] = tx
        score_transaction(tx)
        return (
            jsonify(
                {"ok": True, "scenario": scenario, "transaction_id": tx.transaction_id}
            ),
            202,
        )

    return jsonify({"ok": False, "error": "unknown_scenario"}), 400


@app.get("/health")
def health() -> tuple[Any, int]:
    return jsonify({"ok": True, "service": "demo4-fraud-backend", "ts": utc_now()}), 200


@app.errorhandler(Exception)
def handle_error(exc: Exception) -> tuple[Any, int]:
    record_event("system.error", error=str(exc))
    return jsonify({"ok": False, "error": "internal_error"}), 500


if __name__ == "__main__":
    port = int(os.getenv("PORT", "5004"))
    debug = os.getenv("FLASK_DEBUG", "1").lower() in ("1", "true", "yes")
    app.run(host="0.0.0.0", port=port, debug=debug, threaded=True)
