from app.analyzers.code_analyzer import AnalysisResult, RiskFinding


def generate_scenarios(analysis: AnalysisResult) -> list[dict]:
    scenarios: list[dict] = []
    risk_by_category: dict[str, list[RiskFinding]] = {}
    for risk in analysis.risks:
        risk_by_category.setdefault(risk.category, []).append(risk)

    templates = [
        ("db_timeout", "database", "DB query timeout", "Inject slow query / connection stall", "Critical"),
        ("db_connection_loss", "database", "DB connection loss", "Drop pooled connections mid-transaction", "Critical"),
        ("external_api_delay", "external-api", "External API latency", "Add 2–8s latency to upstream HTTP", "High"),
        ("http_500", "reliability", "Upstream 500 storm", "Return intermittent 500 from dependency", "High"),
        ("retry_storm", "reliability", "Retry storm", "Amplify retries when downstream is degraded", "Critical"),
        ("high_concurrency", "concurrency", "Traffic burst", "2× concurrent requests on hot endpoints", "High"),
        ("lock_contention", "concurrency", "Lock contention", "Serialize workers on shared lock", "Critical"),
        ("cascade_failure", "architecture", "Cascading failure", "Fail gateway when payment+inventory degrade", "Critical"),
    ]

    used: set[str] = set()
    for key, category, name, desc, default_severity in templates:
        if category in risk_by_category and key not in used:
            target_risk = risk_by_category[category][0]
            scenarios.append(
                {
                    "name": name,
                    "category": category,
                    "severity": target_risk.severity or default_severity,
                    "target": target_risk.file,
                    "description": f"{desc}. Triggered by: {target_risk.title}",
                    "related_risk_id": target_risk.id,
                }
            )
            used.add(key)

    if len(scenarios) < 4:
        for risk in analysis.risks[:6]:
            scenarios.append(
                {
                    "name": f"Simulate {risk.category} fault",
                    "category": risk.category,
                    "severity": risk.severity,
                    "target": risk.file,
                    "description": f"Autonomous scenario targeting {risk.title}",
                    "related_risk_id": risk.id,
                }
            )
            if len(scenarios) >= 6:
                break

    return scenarios[:8]
