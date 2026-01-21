"""LLM backend client for making completion requests."""

import logging

import httpx

from .models import ChatMessage

logger = logging.getLogger(__name__)


class LLMError(Exception):
    """Error from the LLM backend."""

    def __init__(self, message: str, status_code: int | None = None):
        super().__init__(message)
        self.message = message
        self.status_code = status_code


async def fetch_completion(
    client: httpx.AsyncClient,
    backend_url: str,
    model: str,
    messages: list[ChatMessage],
    max_tokens: int = 500,
    temperature: float = 0.7,
) -> str:
    """Fetch a completion from the backend LLM.

    This is the general-purpose function that supports multi-turn conversations.
    For simple single-turn requests, use fetch_completion_simple() instead.

    Args:
        client: HTTP client to use for the request
        backend_url: Base URL of the LLM backend (e.g., http://litellm:4000)
        model: Model name to use
        messages: List of chat messages (supports full conversation history)
        max_tokens: Maximum tokens to generate
        temperature: Sampling temperature

    Returns:
        The completion text.

    Raises:
        LLMError: If the request fails or the response cannot be parsed.
    """
    try:
        response = await client.post(
            f"{backend_url}/v1/chat/completions",
            json={
                "model": model,
                "messages": [{"role": m.role, "content": m.content} for m in messages],
                "max_tokens": max_tokens,
                "temperature": temperature,
            },
        )
        response.raise_for_status()

        data: dict[str, object] = response.json()
        choices = data.get("choices", [{}])
        if not isinstance(choices, list) or not choices:
            raise LLMError(f"Invalid response format from model {model}")
        first_choice = choices[0]
        if not isinstance(first_choice, dict):
            raise LLMError(f"Invalid response format from model {model}")
        message = first_choice.get("message", {})
        if not isinstance(message, dict):
            raise LLMError(f"Invalid response format from model {model}")
        content_raw = message.get("content")
        if not content_raw or not isinstance(content_raw, str):
            raise LLMError(f"Empty response from model {model}")
        content: str = content_raw
        return content.strip()

    except httpx.HTTPStatusError as e:
        # Try to extract error message from response
        try:
            error_data = e.response.json()
            error_msg = error_data.get("error", {}).get("message") or error_data.get("detail") or str(e)
        except Exception:
            error_msg = f"HTTP {e.response.status_code}"
        logger.warning(f"HTTP error from model {model}: {e.response.status_code} - {error_msg}")
        raise LLMError(error_msg, status_code=e.response.status_code) from e
    except httpx.RequestError as e:
        logger.warning(f"Request error for model {model}: {e}")
        raise LLMError(f"Connection error: {e}") from e
    except (KeyError, IndexError, TypeError) as e:
        logger.warning(f"Parse error for model {model}: {e}")
        raise LLMError(f"Invalid response format from model {model}") from e


async def fetch_completion_simple(
    client: httpx.AsyncClient,
    backend_url: str,
    model: str,
    system_prompt: str,
    user_message: str,
    max_tokens: int = 500,
    temperature: float = 0.7,
) -> str:
    """Convenience wrapper for simple system + user message completions.

    Raises:
        LLMError: If the request fails or the response cannot be parsed.
    """
    messages = [
        ChatMessage(role="system", content=system_prompt),
        ChatMessage(role="user", content=user_message),
    ]
    return await fetch_completion(
        client, backend_url, model, messages, max_tokens, temperature
    )
