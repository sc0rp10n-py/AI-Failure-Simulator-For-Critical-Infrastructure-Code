import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

BASE_DIR = Path(__file__).resolve().parents[2]
DATA_DIR = BASE_DIR / "data"
UPLOAD_ROOT = Path(os.getenv("SENTINEL_UPLOAD_ROOT", BASE_DIR / "uploads"))
OUTPUT_ROOT = Path(os.getenv("SENTINEL_OUTPUT_ROOT", BASE_DIR / "outputs"))
LOG_DIR = BASE_DIR / "logs"
TEMP_DIR = BASE_DIR / "temp"
DEMO_ROOT = Path(os.getenv("SENTINEL_DEMO_ROOT", BASE_DIR.parent))
DB_PATH = Path(os.getenv("SENTINEL_DB_PATH", DATA_DIR / "sentinel.db"))
SESSION_SECRET = os.getenv("SENTINEL_SESSION_SECRET", "sentinel-dev-secret")
LLM_PROVIDER = os.getenv("SENTINEL_LLM_PROVIDER", "heuristic")
OLLAMA_BASE_URL = os.getenv("SENTINEL_OLLAMA_BASE_URL", "http://localhost:11434")
OLLAMA_MODEL = os.getenv("SENTINEL_OLLAMA_MODEL", "gemma2:2b")
OLLAMA_API_KEY = os.getenv("SENTINEL_OLLAMA_API_KEY", "")
OPENAI_BASE_URL = os.getenv("SENTINEL_OPENAI_BASE_URL", "")
OPENAI_API_KEY = os.getenv("SENTINEL_OPENAI_API_KEY", "")
OPENAI_MODEL = os.getenv("SENTINEL_OPENAI_MODEL", "gpt-4o-mini")
CORS_ORIGINS = [
    origin.strip()
    for origin in os.getenv("SENTINEL_CORS_ORIGINS", "http://localhost:1000").split(",")
    if origin.strip()
]

for path in (DATA_DIR, UPLOAD_ROOT, OUTPUT_ROOT, LOG_DIR, TEMP_DIR):
    path.mkdir(parents=True, exist_ok=True)

DEMO_CATALOG = {
    "demo1": {
        "id": "demo1",
        "name": "Commerce Checkout Mesh",
        "framework": "express",
        "architecture": "Microservices",
        "risk_level": "Critical",
        "dependency_count": 6,
        "description": "Payment gateway with inventory locks, external PSP dependency, and no idempotency.",
        "path": DEMO_ROOT / "demo1",
    },
    "demo2": {
        "id": "demo2",
        "name": "Emergency Dispatch Core",
        "framework": "fastapi",
        "architecture": "Monolith + external API",
        "risk_level": "High",
        "dependency_count": 5,
        "description": "Healthcare dispatch with global locks, blocking sleeps, and mapping API reliance.",
        "path": DEMO_ROOT / "demo2",
    },
    "demo3": {
        "id": "demo3",
        "name": "Grid Sensor Pipeline",
        "framework": "express",
        "architecture": "Event pipeline",
        "risk_level": "High",
        "dependency_count": 7,
        "description": "Smart grid ingestion with queue overflow risk and missing circuit breakers.",
        "path": DEMO_ROOT / "demo3",
    },
    "demo4": {
        "id": "demo4",
        "name": "Fraud Detection Stream",
        "framework": "flask",
        "architecture": "Streaming + verification API",
        "risk_level": "Critical",
        "dependency_count": 8,
        "description": "Real-time fraud scoring with retry storms and verification bottlenecks.",
        "path": DEMO_ROOT / "demo4",
    },
}

PIPELINE_STAGES = [
    "upload_complete",
    "extraction_complete",
    "dependency_scan_complete",
    "risk_analysis_complete",
    "failure_generation_complete",
    "simulation_complete",
    "telemetry_complete",
    "ai_analysis_complete",
]
