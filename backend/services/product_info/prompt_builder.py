"""Build Bedrock prompts for product information extraction."""

from __future__ import annotations

ALLOWED_COUNTRIES = [
    "United States",
    "Germany",
    "United Kingdom",
    "France",
    "Japan",
    "China",
    "Canada",
    "Italy",
    "Spain",
]

SYSTEM_PROMPT = """You are a pharmaceutical product information extractor.
Read the provided document text and extract product information fields.

Return ONLY a valid JSON object with exactly these keys (use empty string if unknown):
{
  "product_name": "",
  "country": "",
  "indication": "",
  "drug_class": "",
  "mechanism_of_action": "",
  "start_year": "",
  "end_year": ""
}

Rules:
- country must be one of: """ + ", ".join(ALLOWED_COUNTRIES) + """ (or empty string if unclear)
- start_year and end_year must be 4-digit years as strings (e.g. "2025"), or empty string
- drug_class and mechanism_of_action are separate fields
- Do not include markdown, explanations, or any text outside the JSON object

Field guidance (read the document, then summarize — do NOT copy-paste label text):
- product_name: brand or investigational code name only
- indication: ONE primary therapeutic disease/condition for a commercial forecast title
  - Understand what the drug treats and state it briefly in your own words (typically a few words)
  - If the label lists many uses, choose the single most primary therapeutic area
  - NEVER return semicolon-separated indication lists, outcome clauses in parentheses, or full PI wording
- drug_class: short pharmacologic class only (e.g. "Statin", "Monoclonal antibody") — NOT a paragraph
- mechanism_of_action: short mechanism phrase only (e.g. "HMG-CoA reductase inhibitor") — NOT a paragraph
  - drug_class and mechanism_of_action must each be brief enough to display in a small UI chip
"""


def build_user_message(cleaned_text: str) -> str:
    return f"""Extract product information from the following document text:

--- DOCUMENT TEXT ---
{cleaned_text}
--- END DOCUMENT TEXT ---

Return only the JSON object."""
