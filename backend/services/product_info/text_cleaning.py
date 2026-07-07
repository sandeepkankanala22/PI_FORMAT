"""Clean extracted document text before LLM processing."""

from __future__ import annotations

import logging
import re
from collections import Counter

logger = logging.getLogger("ProductInfoExtract")

_PAGE_NUM_PATTERNS = [
    re.compile(r"^\s*page\s+\d+\s*(of\s+\d+)?\s*$", re.I),
    re.compile(r"^\s*\d+\s*/\s*\d+\s*$"),
    re.compile(r"^\s*-\s*\d+\s*-\s*$"),
    re.compile(r"^\s*\d+\s*$"),
]


def clean_text(text: str) -> str:
    """Remove headers, footers, page numbers, duplicates, and extra whitespace."""
    if not text:
        return ""

    lines = [ln.strip() for ln in text.splitlines()]
    lines = [ln for ln in lines if ln and not _is_page_number_line(ln)]

    lines = _remove_repeated_header_footer(lines)
    lines = _deduplicate_consecutive(lines)

    cleaned = "\n".join(lines)
    cleaned = re.sub(r"[ \t]+", " ", cleaned)
    cleaned = re.sub(r"\n{3,}", "\n\n", cleaned).strip()

    logger.info("Text cleaning completed: %d chars after clean (from %d)", len(cleaned), len(text))
    return cleaned


def _is_page_number_line(line: str) -> bool:
    return any(p.match(line) for p in _PAGE_NUM_PATTERNS)


def _remove_repeated_header_footer(lines: list[str]) -> list[str]:
    """Drop lines that repeat on many pages (likely headers/footers)."""
    if len(lines) < 6:
        return lines

    counts = Counter(lines)
    threshold = max(3, len(lines) // 20)
    repeated = {ln for ln, cnt in counts.items() if cnt >= threshold and len(ln) < 120}
    if not repeated:
        return lines
    return [ln for ln in lines if ln not in repeated]


def _deduplicate_consecutive(lines: list[str]) -> list[str]:
    out: list[str] = []
    prev: str | None = None
    for ln in lines:
        if ln != prev:
            out.append(ln)
        prev = ln
    return out
