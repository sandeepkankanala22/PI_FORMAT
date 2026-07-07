"""Validate and normalize LLM extraction JSON."""

from __future__ import annotations

import logging
import re
from typing import Any, Dict

from pydantic import BaseModel, Field, field_validator

from .errors import InvalidJson
from .prompt_builder import ALLOWED_COUNTRIES

logger = logging.getLogger("ProductInfoExtract")

COUNTRY_ALIASES: Dict[str, str] = {
    "us": "United States",
    "usa": "United States",
    "united states": "United States",
    "u.s.": "United States",
    "u.s.a.": "United States",
    "uk": "United Kingdom",
    "united kingdom": "United Kingdom",
    "gb": "United Kingdom",
    "britain": "United Kingdom",
    "de": "Germany",
    "germany": "Germany",
    "fr": "France",
    "france": "France",
    "jp": "Japan",
    "japan": "Japan",
    "cn": "China",
    "china": "China",
    "ca": "Canada",
    "canada": "Canada",
    "it": "Italy",
    "italy": "Italy",
    "es": "Spain",
    "spain": "Spain",
}


class ProductInfoLLMOutput(BaseModel):
    product_name: str = ""
    country: str = ""
    indication: str = ""
    drug_class: str = ""
    mechanism_of_action: str = ""
    start_year: str = ""
    end_year: str = ""
    stage2_context_summary: str = ""

    @field_validator(
        "product_name",
        "country",
        "indication",
        "drug_class",
        "mechanism_of_action",
        "start_year",
        "end_year",
        "stage2_context_summary",
        mode="before",
    )
    @classmethod
    def coerce_to_str(cls, v: Any) -> str:
        if v is None:
            return ""
        return str(v).strip()

    @field_validator("start_year", "end_year")
    @classmethod
    def validate_year(cls, v: str) -> str:
        if not v:
            return ""
        match = re.search(r"\b(19|20)\d{2}\b", v)
        if match:
            return match.group(0)
        return ""


def normalize_country(raw: str) -> str:
    if not raw:
        return ""
    stripped = raw.strip()
    if stripped in ALLOWED_COUNTRIES:
        return stripped
    key = stripped.lower()
    if key in COUNTRY_ALIASES:
        return COUNTRY_ALIASES[key]
    for country in ALLOWED_COUNTRIES:
        if country.lower() == key or country.lower() in key or key in country.lower():
            return country
    return ""


def validate_product_info_json(data: Dict[str, Any]) -> ProductInfoLLMOutput:
    try:
        model = ProductInfoLLMOutput.model_validate(data)
        model.country = normalize_country(model.country)
        logger.info(
            "JSON validation passed: product=%s country=%s indication=%s",
            bool(model.product_name),
            bool(model.country),
            bool(model.indication),
        )
        return model
    except Exception as exc:
        logger.error("JSON validation failed: %s", exc, exc_info=True)
        raise InvalidJson("Could not validate extracted product information.") from exc


def parse_json_from_response(text: str) -> Dict[str, Any]:
    """Extract first JSON object from LLM response."""
    data = _extract_json_object(text)
    if data is None:
        raise InvalidJson("Could not parse product information — try again or enter manually.")
    return data


def _extract_json_object(text: str) -> Dict[str, Any] | None:
    import json

    depth = 0
    start = None
    for i, ch in enumerate(text):
        if ch == "{":
            if depth == 0:
                start = i
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0 and start is not None:
                candidate = text[start : i + 1]
                try:
                    parsed = json.loads(candidate)
                    if isinstance(parsed, dict):
                        return parsed
                except Exception:
                    start = None
                    depth = 0
    return None
