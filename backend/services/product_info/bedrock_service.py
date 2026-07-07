"""Reusable AWS Bedrock client for product information extraction."""

from __future__ import annotations

import json
import logging
import os
import time
import uuid
from typing import Dict, List, Optional

import boto3
from botocore.config import Config
from botocore.exceptions import ClientError, ReadTimeoutError

from .errors import BedrockTimeout

logger = logging.getLogger("ProductInfoExtract")

_DEFAULT_MODEL = "us.anthropic.claude-sonnet-4-5-20250929-v1:0"


class BedrockService:
    """Wrapper for AWS Bedrock Runtime using default AWS credential chain."""

    def __init__(
        self,
        region: Optional[str] = None,
        model_id: Optional[str] = None,
        read_timeout: Optional[int] = None,
        max_tokens: Optional[int] = None,
    ):
        self.region = region or os.getenv("AWS_REGION", "us-east-1")
        self.model_id = (
            model_id
            or os.getenv("MODEL_ID_PI_EXTRACT")
            or os.getenv("MODEL_ID", _DEFAULT_MODEL)
        )
        self.read_timeout = read_timeout or int(os.getenv("PI_EXTRACT_BEDROCK_TIMEOUT", "30"))
        self.max_tokens = max_tokens or int(os.getenv("PI_EXTRACT_MAX_TOKENS", "512"))

        config = Config(
            read_timeout=self.read_timeout,
            connect_timeout=10,
            retries={"max_attempts": 2, "mode": "adaptive"},
        )
        self.client = boto3.client(
            service_name="bedrock-runtime",
            region_name=self.region,
            config=config,
        )
        logger.info(
            "Bedrock service initialized: region=%s model=%s timeout=%ss",
            self.region,
            self.model_id,
            self.read_timeout,
        )

    def invoke(
        self,
        messages: List[Dict],
        system_prompt: Optional[str] = None,
        temperature: float = 0.0,
        max_tokens: Optional[int] = None,
    ) -> Dict:
        call_id = str(uuid.uuid4())[:8]
        start = time.time()
        tokens_cap = max_tokens or self.max_tokens

        prompt_length = sum(len(str(m.get("content", ""))) for m in messages)
        logger.info(
            "Bedrock request: call_id=%s model=%s prompt_length=%d max_tokens=%d",
            call_id,
            self.model_id,
            prompt_length,
            tokens_cap,
        )

        body: Dict = {
            "anthropic_version": "bedrock-2023-05-31",
            "messages": messages,
            "max_tokens": tokens_cap,
            "temperature": temperature,
        }
        if system_prompt:
            body["system"] = system_prompt

        try:
            response = self.client.invoke_model(modelId=self.model_id, body=json.dumps(body))
            elapsed = time.time() - start
            response_body = json.loads(response["body"].read())

            content = ""
            for block in response_body.get("content", []):
                if block.get("type") == "text":
                    content += block.get("text", "")

            usage = response_body.get("usage", {})
            logger.info(
                "Bedrock response: call_id=%s elapsed=%.2fs tokens=%s",
                call_id,
                elapsed,
                usage,
            )
            return {
                "content": content,
                "usage": usage,
                "time_elapsed": elapsed,
                "call_id": call_id,
            }
        except ReadTimeoutError as exc:
            logger.error("Bedrock timeout: call_id=%s", call_id, exc_info=True)
            raise BedrockTimeout(
                "Extraction timed out — try a smaller document or try again."
            ) from exc
        except ClientError as exc:
            code = exc.response.get("Error", {}).get("Code", "Unknown")
            logger.error("Bedrock client error: call_id=%s code=%s", call_id, code, exc_info=True)
            if code in ("ThrottlingException", "ServiceUnavailableException"):
                raise BedrockTimeout("Bedrock service is busy — please try again.") from exc
            raise
        except Exception as exc:
            logger.error("Bedrock unexpected error: call_id=%s", call_id, exc_info=True)
            raise


_bedrock_service: Optional[BedrockService] = None


def get_bedrock_service() -> BedrockService:
    global _bedrock_service
    if _bedrock_service is None:
        _bedrock_service = BedrockService()
    return _bedrock_service
