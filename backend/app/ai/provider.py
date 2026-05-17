import json
import re
from pathlib import Path

from ollama import Client

from app.config import settings
from app.logging.structured import get_logger

logger = get_logger("ai.provider")
PROMPTS_DIR = Path(__file__).parent / "prompts"
_JSON_FENCE_RE = re.compile(r"^```(?:json)?\s*\n?|\n?```\s*$", re.IGNORECASE | re.MULTILINE)


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


def _ollama_client() -> Client:
    headers: dict[str, str] = {}
    if settings.OLLAMA_API_KEY:
        headers["Authorization"] = f"Bearer {settings.OLLAMA_API_KEY}"
    return Client(host=settings.OLLAMA_BASE_URL.rstrip("/"), headers=headers)


def _parse_json_content(raw: str) -> dict:
    text = _JSON_FENCE_RE.sub("", raw.strip()).strip()
    try:
        parsed = json.loads(text)
    except json.JSONDecodeError:
        start = text.find("{")
        end = text.rfind("}")
        if start < 0 or end <= start:
            raise ValueError("Model response did not contain a JSON object") from None
        parsed = json.loads(text[start : end + 1])
    if not isinstance(parsed, dict):
        raise ValueError("Model JSON must be an object")
    return parsed


def _ollama(system: str, user: str) -> dict | None:
    messages: list[dict[str, str]] = []
    if system.strip():
        messages.append({"role": "system", "content": system})
    messages.append({"role": "user", "content": user})

    try:
        client = _ollama_client()
        response = client.chat(
            model=settings.OLLAMA_MODEL,
            messages=messages,
            stream=False,
            format="json",
        )
        content = response.message.content
        if not content or not content.strip():
            raise ValueError("Empty response from Ollama")
        parsed = _parse_json_content(content)
        logger.info(
            "Ollama analysis complete",
            extra={"event": "llm_success", "model": settings.OLLAMA_MODEL},
        )
        return parsed
    except Exception as exc:
        logger.info(
            "Ollama unavailable, using heuristic",
            extra={"event": "llm_fallback", "error": str(exc)},
        )
        return None


def _openai_compatible(system: str, user: str) -> dict | None:
    import httpx

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
        return _parse_json_content(content)
    except Exception as exc:
        logger.info("OpenAI provider failed", extra={"event": "llm_fallback", "error": str(exc)})
        return None
