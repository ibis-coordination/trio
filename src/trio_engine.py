"""Trio engine for three-model synthesis."""

import asyncio
import logging

import httpx

from .config import Settings
from .llm import LLMError, fetch_completion
from .models import ChatMessage, ToolCall, ToolCallFunction, TrioDetails, TrioMember, TrioModel


class TrioError(Exception):
    """Error during trio completion."""

    def __init__(self, message: str, status_code: int | None = None):
        super().__init__(message)
        self.message = message
        self.status_code = status_code

logger = logging.getLogger(__name__)


def _extract_host_system_prompt(messages: list[ChatMessage]) -> tuple[str, list[ChatMessage]]:
    """Extract system prompt from messages, return (system_prompt, remaining_messages)."""
    host_system_prompt = ""
    remaining: list[ChatMessage] = []
    for msg in messages:
        if msg.role == "system":
            host_system_prompt = msg.content or ""
        else:
            remaining.append(msg)
    return host_system_prompt, remaining


TRIO_SYSTEM_PROMPT_AB = """You are an assistant within an AI system called Trio that serves host applications. You have access to a get_host_system_prompt tool that provides guidance from the host application. Use it to understand how to respond, then respond to the user."""

TRIO_SYSTEM_PROMPT_C = """You are an assistant within an AI system called Trio that serves host applications. You have access to:
- get_host_system_prompt: Provides guidance from the host application
- get_drafts: Provides draft responses from other assistants in the system

Use these tools, then respond to the user. Incorporate the best elements from the drafts into your response. Do not mention the drafts or the tools."""


async def _generate_member_response(
    client: httpx.AsyncClient,
    settings: Settings,
    member: TrioMember,
    request_messages: list[ChatMessage],
    max_tokens: int,
    temperature: float,
) -> tuple[str, str | None, str | None]:
    """Generate a response from a single trio member.

    Handles both simple models (strings) and nested trios (TrioModel).
    Uses host-aware tool pattern to separate Trio, host, and user layers.

    Returns:
        Tuple of (model_name, response_text, error_message).
        response_text is None on failure, error_message is None on success.
    """
    # Extract host system prompt from request messages
    host_system_prompt, chat_history = _extract_host_system_prompt(request_messages)

    # Build message list with host-aware tool pattern
    messages: list[ChatMessage] = []

    # 1. Trio system prompt
    messages.append(ChatMessage(role="system", content=TRIO_SYSTEM_PROMPT_AB))

    # 2. Add member's custom messages (if any)
    messages.extend(member.messages or [])

    # 3. Assistant "calls" get_host_system_prompt tool
    messages.append(ChatMessage(
        role="assistant",
        content=None,
        tool_calls=[ToolCall(id="hsp", function=ToolCallFunction(name="get_host_system_prompt"))],
    ))

    # 4. Tool response with host system prompt
    messages.append(ChatMessage(
        role="tool",
        tool_call_id="hsp",
        content=host_system_prompt or "(No host system prompt provided)",
    ))

    # 5. Chat history (user/assistant messages)
    messages.extend(chat_history)

    if isinstance(member.model, TrioModel):
        # Nested trio: recursively call trio_completion
        try:
            nested_response, _ = await trio_completion(
                client,
                settings,
                member.model,
                messages,
                max_tokens,
                temperature,
            )
            return "trio", nested_response, None
        except TrioError as e:
            return "trio", None, e.message
    else:
        # Simple model: call backend directly
        model_name = member.model
        try:
            response = await fetch_completion(
                client,
                settings.trio_backend_url,
                model_name,
                messages,
                max_tokens,
                temperature,
            )
            return model_name, response, None
        except LLMError as e:
            logger.warning(f"Model {model_name} failed: {e.message}")
            return model_name, None, e.message


async def _synthesize(
    client: httpx.AsyncClient,
    settings: Settings,
    model_c: TrioMember,
    request_messages: list[ChatMessage],
    response_a: str,
    response_b: str,
    max_tokens: int,
    temperature: float,
) -> str | None:
    """Synthesize two responses using model C.

    Uses host-aware tool pattern with get_host_system_prompt and get_drafts tools.

    Returns:
        The synthesized response, or None on failure.
    """
    # Extract host system prompt from request messages
    host_system_prompt, chat_history = _extract_host_system_prompt(request_messages)

    # Build message list with host-aware tool pattern
    messages: list[ChatMessage] = []

    # 1. Trio system prompt for model C
    messages.append(ChatMessage(role="system", content=TRIO_SYSTEM_PROMPT_C))

    # 2. Add model_c's custom messages (if any)
    messages.extend(model_c.messages or [])

    # 3. Assistant "calls" get_host_system_prompt tool
    messages.append(ChatMessage(
        role="assistant",
        content=None,
        tool_calls=[ToolCall(id="hsp", function=ToolCallFunction(name="get_host_system_prompt"))],
    ))

    # 4. Tool response with host system prompt
    messages.append(ChatMessage(
        role="tool",
        tool_call_id="hsp",
        content=host_system_prompt or "(No host system prompt provided)",
    ))

    # 5. Chat history EXCEPT final user message
    if chat_history:
        messages.extend(chat_history[:-1])

    # 6. Final user message
    if chat_history:
        messages.append(chat_history[-1])

    # 7. Assistant "calls" get_drafts tool
    messages.append(ChatMessage(
        role="assistant",
        content=None,
        tool_calls=[ToolCall(id="drafts", function=ToolCallFunction(name="get_drafts"))],
    ))

    # 8. Tool response with A and B's responses
    messages.append(ChatMessage(
        role="tool",
        tool_call_id="drafts",
        content=f"Draft 1:\n{response_a}\n\nDraft 2:\n{response_b}",
    ))

    try:
        if isinstance(model_c.model, TrioModel):
            response, _ = await trio_completion(
                client,
                settings,
                model_c.model,
                messages,
                max_tokens,
                temperature,
            )
            return response
        else:
            return await fetch_completion(
                client,
                settings.trio_backend_url,
                model_c.model,
                messages,
                max_tokens,
                temperature,
            )
    except (LLMError, TrioError) as e:
        logger.warning(f"Synthesis failed: {e}")
        return None


async def trio_completion(
    client: httpx.AsyncClient,
    settings: Settings,
    trio: TrioModel,
    messages: list[ChatMessage],
    max_tokens: int = 500,
    temperature: float = 0.7,
) -> tuple[str, TrioDetails]:
    """Run the trio completion pipeline.

    1. Models A and B generate responses independently in parallel
    2. Model C synthesizes A and B's responses into a final answer

    Args:
        client: HTTP client to use
        settings: Application settings
        trio: The trio model definition (exactly 3 members)
        messages: Chat messages to complete
        max_tokens: Maximum tokens per response
        temperature: Sampling temperature

    Returns:
        Tuple of (synthesized_response, trio_details)
    """
    model_a = trio.trio[0]
    model_b = trio.trio[1]
    model_c = trio.trio[2]

    # Phase 1: Generate responses from A and B in parallel
    logger.debug("Generating responses from models A and B in parallel...")

    task_a = _generate_member_response(
        client, settings, model_a, messages, max_tokens, temperature
    )
    task_b = _generate_member_response(
        client, settings, model_b, messages, max_tokens, temperature
    )

    results = await asyncio.gather(task_a, task_b)
    (name_a, response_a, error_a), (name_b, response_b, error_b) = results

    logger.debug(f"Model A ({name_a}): {(response_a or '')[:80]}...")
    logger.debug(f"Model B ({name_b}): {(response_b or '')[:80]}...")

    # Handle failures - raise error if both A and B failed
    if not response_a and not response_b:
        error_msg = f"All models failed. A: {error_a}. B: {error_b}"
        logger.error(error_msg)
        raise TrioError(error_msg, status_code=502)

    # If only one response succeeded, return it directly (skip synthesis)
    # At this point, we know at least one response is not None (checked above)
    if not response_a:
        logger.debug("Model A failed, returning model B's response directly")
        assert response_b is not None  # We checked both-None case above
        return response_b, TrioDetails(
            response_a="",
            response_b=response_b,
            model_a=name_a,
            model_b=name_b,
            model_c=_get_model_name(model_c),
        )

    if not response_b:
        logger.debug("Model B failed, returning model A's response directly")
        return response_a, TrioDetails(
            response_a=response_a,
            response_b="",
            model_a=name_a,
            model_b=name_b,
            model_c=_get_model_name(model_c),
        )

    # Phase 2: Model C synthesizes the two responses
    logger.debug(f"Model C ({_get_model_name(model_c)}) synthesizing responses...")

    synthesized = await _synthesize(
        client,
        settings,
        model_c,
        messages,
        response_a,
        response_b,
        max_tokens,
        temperature,
    )

    if not synthesized:
        # Fallback: return model A's response if synthesis fails
        logger.warning("Synthesis failed, falling back to model A's response")
        synthesized = response_a

    logger.debug(f"Synthesized response: {synthesized[:80]}...")

    return synthesized, TrioDetails(
        response_a=response_a,
        response_b=response_b,
        model_a=name_a,
        model_b=name_b,
        model_c=_get_model_name(model_c),
    )


def _get_model_name(member: TrioMember) -> str:
    """Get the model name from a trio member."""
    if isinstance(member.model, TrioModel):
        return "trio"
    return member.model
