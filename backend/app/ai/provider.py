import json
from pathlib import Path

import httpx

from app.config import settings
from app.logging.structured import get_logger

logger = get_logger("ai.provider")
PROMPTS_DIR = Path(__file__).parent / "prompts"


def load_prompt(name: str) -> str:
    path = PROMPTS_DIR / f"{name}.txt"
    return path.read_text(encoding="utf-8") if path.exists() else ""


def analyze_with_llm(prompt_name: str, context: dict) -> dict | None:
    provider = settings.LLM_PROVIDER.lower()
    prompt = load_prompt(prompt_name)
    user_content = json.dumps(context, indent=2)[:12000]

    if provider == "ollama":
        return _ollama(prompt, user_content)
    if provider in ("openai", "openai-compatible"):
        return _openai_compatible(prompt, user_content)
    return None


def _ollama(system: str, user: str) -> dict | None:
    try:
        response = httpx.post(
            f"{settings.OLLAMA_BASE_URL.rstrip('/')}/api/chat",
            json={
                "model": settings.OLLAMA_MODEL,
                "messages": [
                    {"role": "system", "content": system},
                    {"role": "user", "content": user},
                ],
                "stream": False,
                "format": "json",
            },
            timeout=90.0,
        )
        response.raise_for_status()
        content = response.json()["message"]["content"]
        return json.loads(content)
    except Exception as exc:
        logger.info("Ollama unavailable, using heuristic", extra={"event": "llm_fallback", "error": str(exc)})
        return None


def _openai_compatible(system: str, user: str) -> dict | None:
    if not settings.OPENAI_API_KEY:
        return None
    base = settings.OPENAI_BASE_URL or "https://api.openai.com/v1"
    try:
        response = httpx.post(
            f"{base.rstrip('/')}/chat/completions",
            headers={"Authorization": f"Bearer {settings.OPENAI_API_KEY}"},
            json={
                "model": settings.OPENAI_MODEL,
                "messages": [
                    {"role": "system", "content": system},
                    {"role": "user", "content": user},
                ],
                "response_format": {"type": "json_object"},
            },
            timeout=90.0,
        )
        response.raise_for_status()
        content = response.json()["choices"][0]["message"]["content"]
        return json.loads(content)
    except Exception as exc:
        logger.info("OpenAI provider failed", extra={"event": "llm_fallback", "error": str(exc)})
        return None
