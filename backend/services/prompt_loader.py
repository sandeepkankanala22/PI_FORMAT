"""Load backend prompt files from backend/prompts/ (fresh read every call)."""

from __future__ import annotations

from pathlib import Path

_BACKEND_PROMPTS_DIR = Path(__file__).resolve().parent.parent / "prompts"


def load_backend_prompt(name: str) -> str:
    """Read backend/prompts/{name}.txt. Raises FileNotFoundError if missing."""
    path = _BACKEND_PROMPTS_DIR / f"{name}.txt"
    if not path.is_file():
        raise FileNotFoundError(f"Prompt file not found: {path}")
    return path.read_text(encoding="utf-8")
