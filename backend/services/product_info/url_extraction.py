"""Fetch and extract readable text from a URL."""

from __future__ import annotations

import logging
import os
import re

import requests

from .errors import EmptyDocument, UrlFetchError

logger = logging.getLogger("ProductInfoExtract")

_USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/120.0.0.0 Safari/537.36"
)


def _char_limit() -> int:
    return int(os.getenv("PI_EXTRACT_TEXT_CHAR_LIMIT", "12000"))


def extract_text_from_url(url: str, char_limit: int | None = None) -> str:
    """Fetch URL and return clean readable text."""
    limit = char_limit if char_limit is not None else _char_limit()
    url = (url or "").strip()
    if not url:
        raise UrlFetchError("URL is required.")

    logger.info("URL extraction started: %s", url)

    try:
        resp = requests.get(
            url,
            headers={
                "User-Agent": _USER_AGENT,
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                "Accept-Language": "en-US,en;q=0.5",
            },
            timeout=15,
            allow_redirects=True,
        )
        resp.raise_for_status()
    except Exception as exc:
        logger.error("URL fetch failed: %s", exc, exc_info=True)
        raise UrlFetchError(f"Could not fetch URL: {exc}") from exc

    ct = resp.headers.get("content-type", "").lower()
    if "pdf" in ct or url.lower().endswith(".pdf"):
        raise UrlFetchError(
            "PDF detected at URL. Download the file and upload it directly instead."
        )

    body = resp.text
    if "<html" not in body[:3000].lower():
        text = body.strip()
    else:
        text = _extract_html(body)

    text = re.sub(r"\s+", " ", text).strip()
    if len(text) < 50:
        raise EmptyDocument(
            "No readable text found at URL. The page may require JavaScript to render."
        )

    logger.info("URL extraction completed: %d chars", min(len(text), limit))
    return text[:limit]


def _extract_html(raw_html: str) -> str:
    try:
        import trafilatura

        extracted = trafilatura.extract(
            raw_html,
            favor_recall=True,
            include_tables=False,
            no_fallback=False,
        )
        if extracted and len(extracted.strip()) > 40:
            return re.sub(r"\s+", " ", extracted).strip()
    except Exception as exc:
        logger.warning("trafilatura extraction failed, falling back to regex: %s", exc)

    text = re.sub(r"(?s)<(script|style|nav|footer|header)[^>]*>.*?</\1>", " ", raw_html, flags=re.I)
    text = re.sub(r"<[^>]+>", " ", text)
    text = re.sub(r"&[a-z#0-9]+;", " ", text)
    return re.sub(r"\s+", " ", text).strip()
