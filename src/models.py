"""Pydantic models for OpenAI-compatible API."""

import time
import uuid
from typing import Literal

from pydantic import BaseModel, Field

# Valid aggregation methods for ensemble response selection
AggregationMethod = Literal["acceptance_voting", "random", "judge", "synthesize", "concat"]


class ChatMessage(BaseModel):
    """A single message in the chat conversation."""

    role: Literal["system", "user", "assistant"]
    content: str


class EnsembleModel(BaseModel):
    """Ensemble definition - the ensemble IS the model.

    Defines a set of models to query in parallel with an aggregation method
    to select or synthesize the final response.
    """

    ensemble: list["EnsembleMember"]
    aggregation_method: AggregationMethod
    judge_model: str | None = None
    synthesize_model: str | None = None


class EnsembleMember(BaseModel):
    """A model in the ensemble with optional custom system prompt.

    The model can be either a string (backend model name) or a nested
    EnsembleModel for recursive composition.
    """

    model: str | EnsembleModel
    system_prompt: str | None = None


# Rebuild models to resolve forward references
EnsembleModel.model_rebuild()


class ChatCompletionRequest(BaseModel):
    """Request body for /v1/chat/completions endpoint.

    Note: Some OpenAI parameters (top_p, n, stop, presence_penalty, frequency_penalty,
    user) are not supported as they don't apply to ensemble voting.
    """

    model: str | EnsembleModel
    messages: list[ChatMessage]
    max_tokens: int = 500
    temperature: float = 0.7
    stream: bool = False  # Not supported, returns 501


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


class Candidate(BaseModel):
    """A candidate response from a model with voting results."""

    model: str
    response: str
    accepted: int = 0
    preferred: int = 0


class VotingDetails(BaseModel):
    """Detailed voting information returned in X-Trio-Details header."""

    winner_index: int
    candidates: list[Candidate]
    aggregation_method: AggregationMethod | Literal["none"] = "acceptance_voting"
