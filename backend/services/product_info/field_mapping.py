"""Map LLM snake_case output to frontend camelCase form fields."""

from __future__ import annotations

import logging
from typing import Dict

from .json_validation import ProductInfoLLMOutput

logger = logging.getLogger("ProductInfoExtract")


def map_to_form_fields(model: ProductInfoLLMOutput) -> Dict[str, str]:
    """Convert validated LLM output to camelCase DOM field IDs."""
    class_moa = _merge_class_moa(model.drug_class, model.mechanism_of_action)

    fields: Dict[str, str] = {}
    if model.product_name:
        fields["productName"] = model.product_name
    if model.country:
        fields["country"] = model.country
    if model.indication:
        fields["indication"] = model.indication
    if class_moa:
        fields["classMoa"] = class_moa
    if model.start_year:
        fields["launchYear"] = model.start_year
    if model.end_year:
        fields["peakYear"] = model.end_year

    logger.info("Field mapping result: %s", list(fields.keys()))
    return fields


def _merge_class_moa(drug_class: str, mechanism: str) -> str:
    drug_class = (drug_class or "").strip()
    mechanism = (mechanism or "").strip()
    if drug_class and mechanism:
        if mechanism.lower() in drug_class.lower():
            return drug_class
        return f"{drug_class} ({mechanism})"
    return drug_class or mechanism
