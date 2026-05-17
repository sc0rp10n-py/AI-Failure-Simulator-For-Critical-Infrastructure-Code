import ast
import re
from dataclasses import dataclass, field
from pathlib import Path

from app.utils.framework_detect import detect_framework

SKIP_DIRS = {".git", "node_modules", "__pycache__", ".venv", "venv", "dist", "build"}


@dataclass
class RiskFinding:
    id: str
    title: str
    severity: str
    category: str
    file: str
    line: int | None
    description: str
    evidence: str
    weight: float


@dataclass
class AnalysisResult:
    framework: str
    file_count: int
    dependencies: list[dict]
    risks: list[RiskFinding] = field(default_factory=list)
    services: list[str] = field(default_factory=list)

    def risk_score(self) -> float:
        if not self.risks:
            return 12.0
        return min(100.0, sum(r.weight for r in self.risks))

    def severity_label(self) -> str:
        score = self.risk_score()
        if score >= 75:
            return "Critical"
        if score >= 55:
            return "High"
        if score >= 35:
            return "Medium"
        return "Low"

    def to_dict(self) -> dict:
        return {
            "framework": self.framework,
            "file_count": self.file_count,
            "dependencies": self.dependencies,
            "risk_score": round(self.risk_score(), 1),
            "severity": self.severity_label(),
            "risks": [
                {
                    "id": r.id,
                    "title": r.title,
                    "severity": r.severity,
                    "category": r.category,
                    "file": r.file,
                    "line": r.line,
                    "description": r.description,
                    "evidence": r.evidence,
                }
                for r in self.risks
            ],
            "services": self.services,
        }


def _iter_source_files(root: Path) -> list[Path]:
    files: list[Path] = []
    for path in root.rglob("*"):
        if not path.is_file():
            continue
        if any(part in SKIP_DIRS for part in path.parts):
            continue
        if path.suffix in {".py", ".js", ".ts", ".mjs", ".cjs"}:
            files.append(path)
    return files


def _rel(root: Path, path: Path) -> str:
    return str(path.relative_to(root))


def analyze_project(root: Path) -> AnalysisResult:
    root = root.resolve()
    files = _iter_source_files(root)
    framework = detect_framework(root)
    dependencies = _build_dependency_graph(root, files, framework)
    services = _infer_services(root, files, framework)
    risks: list[RiskFinding] = []

    for path in files:
        text = path.read_text(encoding="utf-8", errors="ignore")
        rel = _rel(root, path)
        if path.suffix == ".py":
            risks.extend(_analyze_python(rel, text))
        else:
            risks.extend(_analyze_javascript(rel, text))

    risks.extend(_architecture_risks(dependencies, framework))
    return AnalysisResult(
        framework=framework,
        file_count=len(files),
        dependencies=dependencies,
        risks=risks,
        services=services,
    )


def _build_dependency_graph(root: Path, files: list[Path], framework: str) -> list[dict]:
    nodes: dict[str, dict] = {}
    edges: list[dict] = []

    def node(name: str, kind: str) -> None:
        if name not in nodes:
            nodes[name] = {"id": name, "label": name, "kind": kind}

    node("api", "service")
    for svc in _infer_services(root, files, framework):
        node(svc, "service")

    if (root / "package.json").exists():
        pkg = (root / "package.json").read_text(encoding="utf-8", errors="ignore")
        if "pg" in pkg or "postgres" in pkg.lower():
            node("postgresql", "database")
            edges.append({"from": "api", "to": "postgresql", "critical": True})
        if "express" in pkg:
            edges.append({"from": "api", "to": "payment-api", "critical": True})
            node("payment-api", "external")

    if framework == "fastapi":
        node("mapping-api", "external")
        edges.append({"from": "dispatch", "to": "mapping-api", "critical": True})
    if framework == "flask":
        node("verification-api", "external")
        edges.append({"from": "fraud-engine", "to": "verification-api", "critical": True})

    for svc in _infer_services(root, files, framework):
        if svc != "api":
            edges.append({"from": "api", "to": svc, "critical": False})

    return [{"nodes": list(nodes.values()), "edges": edges}]


def _infer_services(root: Path, files: list[Path], framework: str) -> list[str]:
    names: set[str] = {"api"}
    for path in files:
        stem = path.stem.lower()
        for token in ("gateway", "payment", "inventory", "dispatch", "sensor", "fraud", "alert"):
            if token in stem:
                names.add(stem.replace("_", "-"))
    if framework == "express":
        names.update({"gateway", "payment", "inventory"})
    if framework == "fastapi":
        names.update({"intake", "dispatch", "hospitals"})
    if framework == "flask":
        names.update({"ingestion", "fraud-engine", "notifications"})
    return sorted(names)


def _architecture_risks(dependencies: list[dict], framework: str) -> list[RiskFinding]:
    risks: list[RiskFinding] = []
    graph = dependencies[0] if dependencies else {"edges": []}
    critical_edges = [e for e in graph.get("edges", []) if e.get("critical")]
    if len(critical_edges) >= 2:
        risks.append(
            RiskFinding(
                id="dep-chain",
                title="Deep critical dependency chain",
                severity="High",
                category="architecture",
                file=".",
                line=None,
                description="Multiple critical external dependencies amplify blast radius on partial outages.",
                evidence=f"{len(critical_edges)} critical edges detected",
                weight=14.0,
            )
        )
    if framework == "express":
        risks.append(
            RiskFinding(
                id="express-sync",
                title="Synchronous Express request path",
                severity="Medium",
                category="performance",
                file=".",
                line=None,
                description="Express handlers often block on downstream HTTP/DB without circuit breaking.",
                evidence="express framework",
                weight=10.0,
            )
        )
    return risks


def _analyze_python(rel: str, text: str) -> list[RiskFinding]:
    findings: list[RiskFinding] = []
    if "time.sleep" in text:
        findings.append(
            RiskFinding(
                id=f"sleep-{rel}",
                title="Blocking sleep in request path",
                severity="High",
                category="performance",
                file=rel,
                line=_line_of(text, "time.sleep"),
                description="Synchronous sleep blocks worker threads under load.",
                evidence="time.sleep",
                weight=18.0,
            )
        )
    if "requests.get" in text or "requests.post" in text:
        findings.append(
            RiskFinding(
                id=f"ext-api-{rel}",
                title="Synchronous external HTTP dependency",
                severity="High",
                category="external-api",
                file=rel,
                line=_line_of(text, "requests."),
                description="Blocking HTTP calls to external APIs without timeout/retry guards.",
                evidence="requests.*",
                weight=16.0,
            )
        )
    if "threading.Lock" in text or "Lock()" in text:
        findings.append(
            RiskFinding(
                id=f"lock-{rel}",
                title="Coarse locking / contention risk",
                severity="High",
                category="concurrency",
                file=rel,
                line=_line_of(text, "Lock"),
                description="Global or coarse locks can serialize dispatch-critical paths.",
                evidence="Lock",
                weight=17.0,
            )
        )
    try:
        tree = ast.parse(text)
    except SyntaxError:
        return findings

    for node in ast.walk(tree):
        if isinstance(node, ast.Try):
            has_except = any(isinstance(h, ast.ExceptHandler) for h in node.handlers)
            if not has_except:
                findings.append(
                    RiskFinding(
                        id=f"empty-try-{rel}-{node.lineno}",
                        title="Try block without exception handling",
                        severity="Medium",
                        category="reliability",
                        file=rel,
                        line=node.lineno,
                        description="Bare try blocks provide no failure containment.",
                        evidence="try without except",
                        weight=8.0,
                    )
                )
    return findings


def _analyze_javascript(rel: str, text: str) -> list[RiskFinding]:
    findings: list[RiskFinding] = []
    if re.search(r"fetchJson|fetch\(", text) and "retry" not in text.lower():
        findings.append(
            RiskFinding(
                id=f"no-retry-{rel}",
                title="HTTP call without retry policy",
                severity="High",
                category="reliability",
                file=rel,
                line=_line_of(text, "fetch"),
                description="Downstream HTTP failures propagate without retry/backoff.",
                evidence="fetch without retry",
                weight=16.0,
            )
        )
    timeout_match = re.search(r"timeoutMs.*?(\d+)", text)
    if "timeoutMs" in text and timeout_match and int(timeout_match.group(1)) < 1000:
        findings.append(
            RiskFinding(
                id=f"aggressive-timeout-{rel}",
                title="Aggressive downstream timeout",
                severity="Medium",
                category="reliability",
                file=rel,
                line=_line_of(text, "timeoutMs"),
                description="Short timeouts amplify transient latency into hard failures.",
                evidence="low timeoutMs",
                weight=12.0,
            )
        )
    if "BEGIN" in text and "FOR UPDATE" in text.upper():
        findings.append(
            RiskFinding(
                id=f"row-lock-{rel}",
                title="Row-level lock contention",
                severity="Critical",
                category="database",
                file=rel,
                line=_line_of(text, "FOR UPDATE"),
                description="SELECT FOR UPDATE on hot rows creates queueing under concurrency.",
                evidence="FOR UPDATE",
                weight=22.0,
            )
        )
    if "idempot" not in text.lower() and "checkout" in text.lower():
        findings.append(
            RiskFinding(
                id=f"no-idempotency-{rel}",
                title="Missing idempotency on checkout path",
                severity="Critical",
                category="data-integrity",
                file=rel,
                line=_line_of(text, "checkout"),
                description="Duplicate submissions can create duplicate charges or inventory mutations.",
                evidence="checkout without idempotency",
                weight=24.0,
            )
        )
    return findings


def _line_of(text: str, needle: str) -> int | None:
    for idx, line in enumerate(text.splitlines(), start=1):
        if needle in line:
            return idx
    return None
