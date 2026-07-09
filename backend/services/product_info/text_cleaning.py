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

_URL_PATTERN = re.compile(r"https?://\S+", re.I)
_DOT_LEADER = re.compile(r"\.{4,}\s*\d+\s*$")

_NOISE_LINE_PATTERNS = [
    re.compile(r"^\s*©"),
    re.compile(r"all rights reserved", re.I),
    re.compile(r"^\s*confidential\b", re.I),
    re.compile(r"^\s*table of contents\s*$", re.I),
]

_BOILERPLATE_SECTION = re.compile(
    r"^\s*(?:references|bibliography|adverse reactions|warnings and precautions|"
    r"medication guide|patient counseling information|nonclinical toxicology|"
    r"clinical studies|how supplied|storage and handling|spl medguide|"
    r"revised:\s*\d|version\s*\d)\b",
    re.I,
)

_RELEVANCE_KEYWORDS = re.compile(
    r"\b(?:indication|mechanism|action|drug\s+class|active\s+ingredient|"
    r"brand|product|country|therapeutic|moa|pharmacology|prescribing|"
    r"dosage|formulation|description|use in|patients with)\b",
    re.I,
)


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


def prepare_pi_text_for_llm(text: str) -> str:
    """Aggressive PI cleanup to reduce tokens sent to Bedrock while keeping extractable facts."""
    cleaned = clean_text(text)
    if not cleaned:
        return ""

    lines = cleaned.splitlines()
    kept: list[str] = []
    skipping_boilerplate = False

    for line in lines:
        stripped = line.strip()
        if not stripped:
            if kept and kept[-1] != "":
                kept.append("")
            continue

        if _DOT_LEADER.search(stripped):
            continue
        if any(p.search(stripped) for p in _NOISE_LINE_PATTERNS):
            continue
        if _URL_PATTERN.search(stripped) and len(_URL_PATTERN.sub("", stripped).strip()) < 20:
            continue

        if _BOILERPLATE_SECTION.match(stripped):
            skipping_boilerplate = True
            continue

        if skipping_boilerplate:
            if _RELEVANCE_KEYWORDS.search(stripped) and len(stripped) < 120:
                skipping_boilerplate = False
            else:
                continue

        if _alpha_ratio(stripped) < 0.35 and len(stripped) > 40:
            continue

        stripped = _URL_PATTERN.sub(" ", stripped)
        stripped = re.sub(r"\s+", " ", stripped).strip()
        if stripped:
            kept.append(stripped)

    compact = "\n".join(kept)
    compact = re.sub(r"\n{3,}", "\n\n", compact).strip()
    if not compact:
        compact = cleaned

    logger.info(
        "PI text prepared for LLM: %d chars after prepare (from %d cleaned, %d raw)",
        len(compact),
        len(cleaned),
        len(text),
    )
    return compact


def _alpha_ratio(line: str) -> float:
    if not line:
        return 0.0
    alpha = sum(1 for c in line if c.isalnum())
    return alpha / max(len(line), 1)


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
