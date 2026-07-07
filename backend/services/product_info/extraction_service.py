"""Orchestrate product information extraction from file or URL."""

from __future__ import annotations

import logging
import os
from dataclasses import dataclass
from typing import Dict, Optional

from .bedrock_service import get_bedrock_service
from .document_text_extraction import extract_text_from_bytes
from .errors import FileTooLarge, ProductInfoExtractError
from .field_mapping import map_to_form_fields
from .field_summarization import needs_display_field_summarization, summarize_display_fields
from .json_validation import parse_json_from_response, validate_product_info_json
from .prompt_builder import SYSTEM_PROMPT, build_user_message
from .text_chunking import chunk_text_if_needed
from .text_cleaning import clean_text
from .url_extraction import extract_text_from_url

logger = logging.getLogger("ProductInfoExtract")


@dataclass
class ExtractionResult:
    fields: Dict[str, str]
    reference_content: str
    source_name: str


def _max_file_size_bytes() -> int:
    mb = int(os.getenv("PI_EXTRACT_MAX_FILE_SIZE_MB", "15"))
    return mb * 1024 * 1024


class ExtractionService:
    """Coordinates document upload → text → Bedrock → validated form fields."""

    def extract_from_file(self, raw_bytes: bytes, filename: str = "") -> ExtractionResult:
        logger.info("Upload started: filename=%s size=%d", filename, len(raw_bytes))
        if len(raw_bytes) > _max_file_size_bytes():
            mb = int(os.getenv("PI_EXTRACT_MAX_FILE_SIZE_MB", "15"))
            raise FileTooLarge(f"File exceeds {mb} MB limit.")

        raw_text = extract_text_from_bytes(raw_bytes, filename)
        logger.info("Text extraction completed: %d chars", len(raw_text))
        return self._process_text(raw_text, source_name=filename or "upload")

    def extract_from_url(self, url: str) -> ExtractionResult:
        logger.info("URL upload started: %s", url)
        raw_text = extract_text_from_url(url)
        logger.info("Text extraction completed: %d chars", len(raw_text))
        return self._process_text(raw_text, source_name=url.strip())

    def _process_text(self, raw_text: str, source_name: str) -> ExtractionResult:
        cleaned = clean_text(raw_text)
        if not cleaned:
            from .errors import EmptyDocument

            raise EmptyDocument("No readable text found.")

        chunked = chunk_text_if_needed(cleaned)
        user_message = build_user_message(chunked)

        bedrock = get_bedrock_service()
        response = bedrock.invoke(
            messages=[{"role": "user", "content": user_message}],
            system_prompt=SYSTEM_PROMPT,
            temperature=0.0,
        )

        raw_llm = response.get("content", "")
        parsed = parse_json_from_response(raw_llm)
        validated = validate_product_info_json(parsed)

        if needs_display_field_summarization(validated):
            summarized = summarize_display_fields(bedrock, validated, chunked)
            if summarized:
                validated = summarized

        fields = map_to_form_fields(validated)

        logger.info("Form population data ready: fields=%s", list(fields.keys()))
        return ExtractionResult(
            fields=fields,
            reference_content=chunked[:10000],
            source_name=source_name,
        )


_default_service: Optional[ExtractionService] = None


def get_extraction_service() -> ExtractionService:
    global _default_service
    if _default_service is None:
        _default_service = ExtractionService()
    return _default_service
