"""AI summarization for short UI-friendly indication and Class/MoA labels."""

from __future__ import annotations

import logging
import re
from typing import Optional

from .bedrock_service import BedrockService
from .json_validation import ProductInfoLLMOutput, parse_json_from_response

logger = logging.getLogger("ProductInfoExtract")

SUMMARIZE_SYSTEM_PROMPT = """You prepare short labels for a pharmaceutical forecast form UI.

The form shows compact chips — NOT full prescribing information text.

Return ONLY valid JSON:
{
  "indication": "<one primary therapeutic disease/condition, few words>",
  "drug_class": "<short pharmacologic class>",
  "mechanism_of_action": "<short mechanism phrase>"
}

Rules:
- READ the document and understand the product, then write brief labels in your own words
- indication: ONE primary therapeutic area for forecasting (e.g. "Hyperlipidemia", "NSCLC")
- drug_class: short class name (e.g. "Statin", "Monoclonal antibody", "ADC")
- mechanism_of_action: short MoA phrase (e.g. "HMG-CoA reductase inhibitor", "PD-1 inhibitor")
- NEVER copy semicolon-separated indication lists, parenthetical outcome clauses, or PI paragraphs
- BAD indication example:
  "Prevention of cardiovascular disease (reduce risk of MI, stroke, revascularization procedures, angina); treatment of hyperlipidemia, mixed dyslipidemia..."
- GOOD indication examples: "Hyperlipidemia", "Cardiovascular disease prevention", "NSCLC"
- If a draft value is already short and clear, keep its meaning but you may tighten wording
"""


def _is_verbose(text: str) -> bool:
    if not text:
        return False
    t = text.strip()
    if len(t) > 50:
        return True
    if ";" in t:
        return True
    if t.count(",") >= 2:
        return True
    if re.search(r"\([^)]{15,}\)", t):
        return True
    if re.search(
        r"\b(?:reduce risk|revascularization|procedures|patients with|adult patients|treatment of)\b",
        t,
        re.I,
    ):
        return True
    return False


def needs_display_field_summarization(model: ProductInfoLLMOutput) -> bool:
    """True when indication or Class/MoA drafts look like label dumps."""
    if _is_verbose(model.indication):
        return True
    if _is_verbose(model.drug_class):
        return True
    if _is_verbose(model.mechanism_of_action):
        return True
    merged = _preview_class_moa(model.drug_class, model.mechanism_of_action)
    return _is_verbose(merged)


def _preview_class_moa(drug_class: str, mechanism: str) -> str:
    drug_class = (drug_class or "").strip()
    mechanism = (mechanism or "").strip()
    if drug_class and mechanism:
        if mechanism.lower() in drug_class.lower():
            return drug_class
        return f"{drug_class} ({mechanism})"
    return drug_class or mechanism


def summarize_display_fields(
    bedrock: BedrockService,
    model: ProductInfoLLMOutput,
    document_excerpt: str,
) -> Optional[ProductInfoLLMOutput]:
    """Use Bedrock to shorten indication and Class/MoA for the form UI."""
    user_message = f"""Document excerpt:
---
{document_excerpt[:6000]}
---

Current draft values (summarize to short UI labels):
- indication: {model.indication or "(empty)"}
- drug_class: {model.drug_class or "(empty)"}
- mechanism_of_action: {model.mechanism_of_action or "(empty)"}

Return only the JSON object."""

    logger.info(
        "Display field summarization requested (indication=%d drug_class=%d moa=%d chars)",
        len(model.indication),
        len(model.drug_class),
        len(model.mechanism_of_action),
    )

    response = bedrock.invoke(
        messages=[{"role": "user", "content": user_message}],
        system_prompt=SUMMARIZE_SYSTEM_PROMPT,
        temperature=0.0,
        max_tokens=256,
    )

    raw = response.get("content", "")
    parsed = parse_json_from_response(raw)

    updated = model.model_copy()
    if parsed.get("indication"):
        updated.indication = str(parsed["indication"]).strip()
    if parsed.get("drug_class"):
        updated.drug_class = str(parsed["drug_class"]).strip()
    if parsed.get("mechanism_of_action"):
        updated.mechanism_of_action = str(parsed["mechanism_of_action"]).strip()

    logger.info(
        "Display fields summarized: indication=%r class=%r moa=%r",
        updated.indication[:60] if updated.indication else "",
        updated.drug_class[:60] if updated.drug_class else "",
        updated.mechanism_of_action[:60] if updated.mechanism_of_action else "",
    )
    return updated


# Backward-compatible helpers used in tests
def needs_indication_refinement(indication: str) -> bool:
    return _is_verbose(indication)


def refine_indication(
    bedrock: BedrockService,
    indication_draft: str,
    document_excerpt: str,
) -> Optional[str]:
    draft = ProductInfoLLMOutput(indication=indication_draft)
    result = summarize_display_fields(bedrock, draft, document_excerpt)
    return result.indication if result and result.indication else None
