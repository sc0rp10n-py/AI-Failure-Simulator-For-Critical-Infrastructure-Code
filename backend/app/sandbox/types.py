from __future__ import annotations

from dataclasses import dataclass, field
from typing import Callable


@dataclass
class SandboxHandle:
    mode: str  # docker | subprocess
    base_url: str
    probe_targets: list[tuple[str, str]]
    host_port: int
    metadata: dict = field(default_factory=dict)
    _cleanup: Callable[[], None] | None = None

    def stop(self) -> None:
        if self._cleanup:
            self._cleanup()
            self._cleanup = None
