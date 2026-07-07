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

def get_system_prompt() -> str:
    """Load product information extraction prompt from backend/prompts/."""
    from backend.services.prompt_loader import load_backend_prompt

    return load_backend_prompt("product_information_prompt")


def build_user_message(cleaned_text: str) -> str:
    return f"""Extract product information from the following document text:

--- DOCUMENT TEXT ---
{cleaned_text}
--- END DOCUMENT TEXT ---

Return only the JSON object."""
