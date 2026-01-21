"""Pydantic models for OpenAI-compatible API."""

from __future__ import annotations

import time
import uuid
from typing import TYPE_CHECKING, Literal, Union

from pydantic import BaseModel, Field, field_validator

if TYPE_CHECKING:
    pass


class ToolCallFunction(BaseModel):
    """Function details for a tool call."""

    name: str
    arguments: str = ""


class ToolCall(BaseModel):
    """A tool call requested by the assistant."""

    id: str
    type: Literal["function"] = "function"
    function: ToolCallFunction


class ChatMessage(BaseModel):
    """A single message in the chat conversation."""

    role: Literal["system", "user", "assistant", "tool"]
    content: str | None = None
    tool_calls: list[ToolCall] | None = None  # For assistant messages requesting tools
    tool_call_id: str | None = None  # For tool messages responding to a call


class TrioMember(BaseModel):
    """A model in the trio with optional custom messages.

    The model can be either a string (backend model name) or a nested
    TrioModel for recursive composition.
    """

    model: Union[str, TrioModel]
    messages: list[ChatMessage] | None = None

    @field_validator("model")
    @classmethod
    def model_not_empty(cls, v: Union[str, TrioModel]) -> Union[str, TrioModel]:
        """Validate that model name is not empty."""
        if isinstance(v, str) and not v.strip():
            raise ValueError("Model name cannot be empty")
        return v


class TrioModel(BaseModel):
    """Trio definition - three models that synthesize perspectives.

    Models A and B generate responses independently in parallel,
    then model C synthesizes them into a final response.
    """

    trio: list[TrioMember]

    @field_validator("trio")
    @classmethod
    def trio_must_have_three_members(cls, v: list[TrioMember]) -> list[TrioMember]:
        """Validate that trio has exactly three members."""
        if len(v) != 3:
            raise ValueError("Trio must contain exactly three members")
        return v


# Rebuild models to resolve forward references
TrioMember.model_rebuild()
TrioModel.model_rebuild()


class ChatCompletionRequest(BaseModel):
    """Request body for /v1/chat/completions endpoint."""

    model: Union[str, TrioModel]
    messages: list[ChatMessage]
    max_tokens: int = 500
    temperature: float = 0.7
    stream: bool = False  # Not supported, returns 501

    @field_validator("model")
    @classmethod
    def model_not_empty(cls, v: Union[str, TrioModel]) -> Union[str, TrioModel]:
        """Validate that model name is not empty."""
        if isinstance(v, str) and not v.strip():
            raise ValueError("Model name cannot be empty")
        return v


class ChatCompletionChoice(BaseModel):
    """A single completion choice in the response."""

    index: int
    message: ChatMessage
    finish_reason: Literal["stop", "length", "content_filter"] = "stop"


class UsageInfo(BaseModel):
    """Token usage information."""

    prompt_tokens: int = 0
    completion_tokens: int = 0
    total_tokens: int = 0


class ChatCompletionResponse(BaseModel):
    """Response body for /v1/chat/completions endpoint."""

    id: str = Field(default_factory=lambda: f"trio-{uuid.uuid4().hex[:12]}")
    object: Literal["chat.completion"] = "chat.completion"
    created: int = Field(default_factory=lambda: int(time.time()))
    model: str  # Set by caller (e.g., "trio-1.0")
    choices: list[ChatCompletionChoice]
    usage: UsageInfo = Field(default_factory=UsageInfo)


class ModelInfo(BaseModel):
    """Information about a model."""

    id: str
    object: Literal["model"] = "model"
    created: int = Field(default_factory=lambda: int(time.time()))
    owned_by: str = "trio"


class ModelListResponse(BaseModel):
    """Response body for /v1/models endpoint."""

    object: Literal["list"] = "list"
    data: list[ModelInfo]


class TrioDetails(BaseModel):
    """Detailed trio execution information returned in X-Trio-Details header."""

    response_a: str
    response_b: str
    model_a: str
    model_b: str
    model_c: str
