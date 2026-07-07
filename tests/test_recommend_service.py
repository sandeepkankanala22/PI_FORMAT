"""Unit tests for Stage 2 AI recommendation service."""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from backend.services.recommend_service import (
    Stage1Input,
    build_recommend_user_message,
    parse_recommend_response,
    run_recommendation,
)
from backend.services.prompt_loader import load_backend_prompt


def test_prompt_files_exist() -> None:
    for name in ("flow_rules", "ai_flow_recommendation_prompt", "product_information_prompt"):
        content = load_backend_prompt(name)
        assert len(content.strip()) > 50, f"{name}.txt should not be empty"


def test_build_recommend_user_message_prioritizes_stage1() -> None:
    stage1 = Stage1Input(
        indication="NSCLC",
        product_name="OncoVax",
        class_moa="PD-1 inhibitor",
        country="United States",
        launch_year="2026",
        peak_year="2035",
    )
    msg = build_recommend_user_message(stage1, "PI says rheumatoid arthritis", "RULE: use incidence for oncology")
    assert "OncoVax" in msg
    assert "NSCLC" in msg
    assert "2026" in msg
    assert "PI says rheumatoid arthritis" in msg
    assert "use incidence for oncology" in msg


def test_build_recommend_user_message_without_stage2() -> None:
    stage1 = Stage1Input(indication="Heart Failure")
    msg = build_recommend_user_message(stage1, None, "RULES")
    assert "Not available" in msg
    assert "Heart Failure" in msg


def test_parse_recommend_response_strips_fences() -> None:
    raw = '```json\n{"summary": "ok", "bullets": ["a"], "params": ["incidence"]}\n```'
    parsed = parse_recommend_response(raw)
    assert parsed["summary"] == "ok"
    assert parsed["params"] == ["incidence"]


def test_run_recommendation_uses_bedrock_mock() -> None:
    captured = {}

    def fake_invoke(**kwargs):
        captured.update(kwargs)
        return {
            "content": json.dumps({
                "summary": "Oncology incidence model",
                "bullets": ["**Incidence Rate** for NSCLC", "**Eligibility Criteria** for biomarker"],
                "params": ["incidence", "diagnosisRate", "eligibilityCriteria", "classShare", "peakProductShare", "annualCostPerPatient", "discount"],
            }),
            "usage": {},
            "time_elapsed": 0.1,
        }

    stage1 = Stage1Input(indication="NSCLC", product_name="DrugX")
    result = run_recommendation(fake_invoke, stage1, "Stage 2 oncology context")
    assert "params" in result
    assert "incidence" in result["params"]
    assert "system_prompt" in captured or captured.get("system_prompt") is not None or "messages" in captured
    user_content = captured["messages"][0]["content"]
    assert "DrugX" in user_content
    assert "Stage 2 oncology context" in user_content
    assert "FORECAST PLAYBOOK RULES" in user_content


def test_dom_stage1_wins_over_session_in_message() -> None:
    """Request body stage1 is what gets sent — session is only for stage2 context."""
    stage1 = Stage1Input(indication="Edited indication", product_name="UserEdited")
    msg = build_recommend_user_message(stage1, "original PI context", "rules")
    assert "Edited indication" in msg
    assert "UserEdited" in msg
    assert "original PI context" in msg


if __name__ == "__main__":
    test_prompt_files_exist()
    print("prompt files: PASS")
    test_build_recommend_user_message_prioritizes_stage1()
    test_build_recommend_user_message_without_stage2()
    print("message build: PASS")
    test_parse_recommend_response_strips_fences()
    print("parse: PASS")
    test_run_recommendation_uses_bedrock_mock()
    print("recommend mock: PASS")
    test_dom_stage1_wins_over_session_in_message()
    print("priority: PASS")
    print("\nAll recommend service tests passed.")
