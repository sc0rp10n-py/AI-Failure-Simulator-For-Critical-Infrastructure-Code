from pathlib import Path


def detect_framework(root: Path) -> str:
    if (root / "package.json").exists():
        package = (root / "package.json").read_text(encoding="utf-8", errors="ignore").lower()
        if "express" in package:
            return "express"
        return "nodejs"
    if (root / "requirements.txt").exists():
        req = (root / "requirements.txt").read_text(encoding="utf-8", errors="ignore").lower()
        if "fastapi" in req:
            return "fastapi"
        if "flask" in req:
            return "flask"
    for py_file in root.rglob("*.py"):
        if py_file.name == "app.py":
            text = py_file.read_text(encoding="utf-8", errors="ignore")
            if "FastAPI" in text:
                return "fastapi"
            if "Flask" in text:
                return "flask"
    return "generic"
