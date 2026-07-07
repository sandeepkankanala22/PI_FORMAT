"""Select the most relevant text chunks for LLM extraction."""

from __future__ import annotations

import logging
import os
import re

logger = logging.getLogger("ProductInfoExtract")

_RELEVANCE_KEYWORDS = re.compile(
    r"\b(?:indication|mechanism|action|drug\s+class|active\s+ingredient|"
    r"dosage|brand|product|launch|country|therapeutic|moa|pharmacology|"
    r"prescribing|contraindication|formulation)\b",
    re.I,
)


def _char_limit() -> int:
    return int(os.getenv("PI_EXTRACT_TEXT_CHAR_LIMIT", "12000"))


def _chunk_size() -> int:
    return int(os.getenv("PI_EXTRACT_CHUNK_SIZE", "4000"))


def chunk_text_if_needed(text: str, char_limit: int | None = None) -> str:
    """Return text trimmed to char_limit, preferring high-relevance sections."""
    limit = char_limit if char_limit is not None else _char_limit()
    if len(text) <= limit:
        return text

    window = _chunk_size()
    words = text.split()
    if not words:
        return text[:limit]

    best_chunks: list[tuple[int, str]] = []
    step = max(window // 4, 200)
    for i in range(0, min(len(words), 50000), step):
        chunk_words = words[i : i + window]
        chunk = " ".join(chunk_words)
        score = len(_RELEVANCE_KEYWORDS.findall(chunk)) * 3
        score += chunk.lower().count("indication") * 2
        best_chunks.append((score, chunk))

    best_chunks.sort(key=lambda x: x[0], reverse=True)

    selected: list[str] = []
    total = 0
    seen_starts: set[str] = set()
    for _score, chunk in best_chunks:
        key = chunk[:80]
        if key in seen_starts:
            continue
        seen_starts.add(key)
        if total + len(chunk) > limit:
            remaining = limit - total
            if remaining > 500:
                selected.append(chunk[:remaining])
            break
        selected.append(chunk)
        total += len(chunk) + 2

    result = "\n\n".join(selected).strip() or text[:limit]
    logger.info("Chunking applied: reduced %d chars to %d chars", len(text), len(result))
    return result
