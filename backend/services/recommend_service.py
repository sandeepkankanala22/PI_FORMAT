"""Stage 2 AI flow recommendation orchestration."""

from __future__ import annotations

import json
import logging
import re
from dataclasses import dataclass
from typing import Any, Callable, Dict, Optional

from backend.services.prompt_loader import load_backend_prompt

logger = logging.getLogger("RecommendService")


@dataclass
class Stage1Input:
    indication: str
    product_name: str = ""
    class_moa: str = ""
    country: str = ""
    launch_year: str = ""
    peak_year: str = ""


def build_recommend_user_message(
    stage1: Stage1Input,
    stage2_context: Optional[str],
    flow_rules: str,
) -> str:
    stage2_block = (
        stage2_context.strip()
        if stage2_context and stage2_context.strip()
        else "Not available — recommend using Stage 1 information only."
    )
    return (
        "CURRENT STAGE 1 PRODUCT INFORMATION:\n"
        f"Product:     {stage1.product_name or 'unnamed'}\n"
        f"Class/MoA:   {stage1.class_moa or 'unknown'}\n"
        f"Indication:  {stage1.indication or 'unspecified'}\n"
        f"Country:     {stage1.country or 'unspecified'}\n"
        f"Launch Year: {stage1.launch_year or 'unspecified'}\n"
        f"Peak Year:   {stage1.peak_year or 'unspecified'}\n\n"
        "STAGE 2 CONTEXT SUMMARY (from uploaded PI document):\n"
        f"{stage2_block}\n\n"
        "FORECAST PLAYBOOK RULES:\n"
        f"{flow_rules.strip()}\n\n"
        "Recommend the optimal forecast flow for this asset. First determine the flow type "
        "(oncology incidence, chronic prevalence, rare disease, etc.), explain your reasoning "
        "step by step, then return the parameter list."
    )


def parse_recommend_response(raw: str) -> Dict[str, Any]:
    cleaned = re.sub(r"^```(?:json)?\s*", "", raw.strip(), flags=re.IGNORECASE)
    cleaned = re.sub(r"\s*```$", "", cleaned.strip())
    match = re.search(r"\{[\s\S]*\}", cleaned)
    if match:
        cleaned = match.group(0)
    return json.loads(cleaned)


def run_recommendation(
    bedrock_invoke: Callable[..., Dict[str, Any]],
    stage1: Stage1Input,
    stage2_context: Optional[str] = None,
    *,
    temperature: float = 0.3,
    max_tokens: int = 1100,
) -> Dict[str, Any]:
    logger.info(
        "AI Recommendation started: indication=%s session_context=%s",
        bool(stage1.indication.strip()),
        bool(stage2_context and stage2_context.strip()),
    )

    try:
        system_prompt = load_backend_prompt("ai_flow_recommendation_prompt")
        flow_rules = load_backend_prompt("flow_rules")
    except FileNotFoundError as exc:
        logger.error("Prompt file missing: %s", exc, exc_info=True)
        raise

    logger.info(
        "Flow rules loaded: chars=%d",
        len(flow_rules),
    )

    user_message = build_recommend_user_message(stage1, stage2_context, flow_rules)
    logger.info("Prompt assembled: user_message_chars=%d", len(user_message))

    resp = bedrock_invoke(
        messages=[{"role": "user", "content": user_message}],
        system_prompt=system_prompt,
        temperature=temperature,
        max_tokens=max_tokens,
    )

    raw = resp.get("content", "")
    logger.info(
        "Bedrock response received: elapsed=%.2fs usage=%s",
        resp.get("time_elapsed", 0),
        resp.get("usage"),
    )

    try:
        parsed = parse_recommend_response(raw)
        logger.info(
            "JSON parsing result: ok params_count=%d",
            len(parsed.get("params") or []),
        )
        return parsed
    except json.JSONDecodeError:
        logger.error("Failed to parse recommendation JSON", exc_info=True)
        return {"error": "Failed to parse recommendation", "raw": raw}
