"""Failure injection via latency wrappers, fault simulation, and HTTP interceptors."""

from __future__ import annotations

import random
import time
from dataclasses import dataclass, field
from typing import Any, Callable

import httpx


@dataclass
class InjectionResult:
    success: bool
    latency_ms: float
    error: str | None = None
    response_status: int | None = None
    injection_type: str = ""
    metadata: dict[str, Any] = field(default_factory=dict)


class FailureInjector:
    """Applies scenario-specific faults to callable targets and HTTP probes."""

    def __init__(self, scenario: dict, seed: int | None = None):
        self.scenario = scenario
        self._rng = random.Random(seed or hash(scenario.get("name", "")) % 2**32)

    @property
    def injection_type(self) -> str:
        category = self.scenario.get("category", "")
        name = (self.scenario.get("name") or "").lower()
        if "timeout" in name or category == "database":
            return "latency"
        if "500" in name or "connection" in name:
            return "exception"
        if "retry" in name or "concurrency" in category:
            return "intermittent"
        if category == "external-api":
            return "api_delay"
        return "degraded"

    def wrap_call(self, fn: Callable[[], Any]) -> InjectionResult:
        """Monkey-patch style wrapper: run fn under injected latency/fault."""
        inj = self.injection_type
        started = time.perf_counter()
        try:
            if inj == "latency":
                time.sleep(self._rng.uniform(0.8, 2.5))
            elif inj == "api_delay":
                time.sleep(self._rng.uniform(1.2, 4.0))
            elif inj == "exception" and self._rng.random() < 0.55:
                raise RuntimeError(f"Injected fault: {self.scenario.get('name')}")
            elif inj == "intermittent" and self._rng.random() < 0.4:
                time.sleep(self._rng.uniform(0.3, 1.0))

            fn()
            latency = (time.perf_counter() - started) * 1000
            return InjectionResult(
                success=True,
                latency_ms=round(latency, 1),
                injection_type=inj,
                metadata={"mode": "wrapper"},
            )
        except Exception as exc:
            latency = (time.perf_counter() - started) * 1000
            return InjectionResult(
                success=False,
                latency_ms=round(latency, 1),
                error=str(exc),
                injection_type=inj,
                metadata={"mode": "wrapper"},
            )

    def intercept_http(self, url: str, timeout: float = 3.0) -> InjectionResult:
        """Proxy-style HTTP probe with injected latency, errors, or timeouts."""
        inj = self.injection_type
        started = time.perf_counter()
        status: int | None = None
        try:
            if inj in ("latency", "api_delay"):
                time.sleep(min(self._rng.uniform(0.5, 2.0), timeout * 0.8))

            if inj == "exception" and self._rng.random() < 0.45:
                latency = (time.perf_counter() - started) * 1000
                return InjectionResult(
                    success=False,
                    latency_ms=round(latency, 1),
                    error="injected_http_500",
                    response_status=500,
                    injection_type=inj,
                    metadata={"url": url, "mode": "proxy"},
                )

            effective_timeout = timeout
            if inj == "latency":
                effective_timeout = max(0.3, timeout * 0.35)

            with httpx.Client(timeout=effective_timeout) as client:
                response = client.get(url)
                status = response.status_code
                success = response.status_code < 500

            latency = (time.perf_counter() - started) * 1000
            return InjectionResult(
                success=success,
                latency_ms=round(latency, 1),
                response_status=status,
                injection_type=inj,
                metadata={"url": url, "mode": "proxy"},
            )
        except httpx.TimeoutException:
            latency = (time.perf_counter() - started) * 1000
            return InjectionResult(
                success=False,
                latency_ms=round(latency, 1),
                error="timeout",
                injection_type=inj,
                metadata={"url": url, "mode": "proxy"},
            )
        except Exception as exc:
            latency = (time.perf_counter() - started) * 1000
            return InjectionResult(
                success=False,
                latency_ms=round(latency, 1),
                error=str(exc),
                response_status=status,
                injection_type=inj,
                metadata={"url": url, "mode": "proxy"},
            )

    def simulate_db_failure(self) -> InjectionResult:
        """Simulate DB connection loss / lock when no live DB is reachable."""
        started = time.perf_counter()
        if self.injection_type == "exception":
            time.sleep(self._rng.uniform(0.2, 0.6))
            latency = (time.perf_counter() - started) * 1000
            return InjectionResult(
                success=False,
                latency_ms=round(latency, 1),
                error="db_connection_refused",
                injection_type="db_failure",
                metadata={"mode": "synthetic_db"},
            )
        time.sleep(self._rng.uniform(1.0, 3.0))
        latency = (time.perf_counter() - started) * 1000
        return InjectionResult(
            success=self._rng.random() > 0.35,
            latency_ms=round(latency, 1),
            injection_type="db_failure",
            metadata={"mode": "synthetic_db"},
        )
