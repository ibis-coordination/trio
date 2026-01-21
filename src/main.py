"""FastAPI application for Trio three-model synthesis service."""

import json
import logging
from pathlib import Path

import httpx
from fastapi import FastAPI, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from .config import get_settings
from .llm import LLMError, fetch_completion
from .models import (
    ChatCompletionChoice,
    ChatCompletionRequest,
    ChatCompletionResponse,
    ChatMessage,
    ModelInfo,
    ModelListResponse,
    TrioDetails,
    TrioModel,
)
from .trio_engine import TrioError, trio_completion

# Configure logging
logging.basicConfig(
    level=logging.DEBUG,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

# Model identifier with version for API responses
MODEL_ID = "trio-1.0"

app = FastAPI(
    title="Trio",
    description="OpenAI-compatible three-model synthesis service",
    version="0.1.0",
)

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health() -> dict[str, str]:
    """Health check endpoint."""
    return {"status": "ok"}


@app.get("/v1/models")
async def list_models() -> ModelListResponse:
    """List available models (OpenAI-compatible)."""
    return ModelListResponse(
        data=[
            ModelInfo(id=MODEL_ID, owned_by="trio"),
        ]
    )


@app.post("/v1/chat/completions")
async def chat_completions(request: ChatCompletionRequest, response: Response) -> ChatCompletionResponse:
    """Create a chat completion using trio synthesis (OpenAI-compatible).

    This endpoint is compatible with the OpenAI chat completions API.

    If model is a TrioModel object (with a 'trio' array of 3 members), models A and B
    generate responses in parallel, then model C synthesizes them into a final response.

    If model is a string, passes through directly to that model via the backend.

    Trio details are included in the X-Trio-Details response header.
    """
    # Streaming is not supported
    if request.stream:
        raise HTTPException(status_code=501, detail="Streaming is not supported")

    settings = get_settings()

    # Use httpx client with timeout
    async with httpx.AsyncClient(timeout=settings.trio_timeout) as client:
        if isinstance(request.model, TrioModel):
            # Trio mode: A and B generate in parallel, C synthesizes
            logger.info(
                f"Trio request: {len(request.messages)} messages, "
                f"models: {_get_model_names(request.model)}"
            )

            try:
                final_response, trio_details = await trio_completion(
                    client,
                    settings,
                    request.model,
                    request.messages,
                    request.max_tokens,
                    request.temperature,
                )
            except TrioError as e:
                # Propagate trio errors with appropriate status code
                status = e.status_code if e.status_code else 502
                raise HTTPException(status_code=status, detail=e.message) from e
            response_model = MODEL_ID

            # Add trio details to custom header
            response.headers["X-Trio-Details"] = json.dumps(trio_details.model_dump())
        else:
            # Pass-through mode: forward directly to the specified model
            logger.info(f"Pass-through request to {request.model}: {len(request.messages)} messages")

            try:
                final_response = await fetch_completion(
                    client,
                    settings.trio_backend_url,
                    request.model,
                    request.messages,
                    request.max_tokens,
                    request.temperature,
                )
            except LLMError as e:
                # Propagate backend errors with appropriate status code
                status = e.status_code if e.status_code else 502
                raise HTTPException(status_code=status, detail=e.message) from e
            response_model = request.model

    # Build OpenAI-compatible response
    return ChatCompletionResponse(
        model=response_model,
        choices=[
            ChatCompletionChoice(
                index=0,
                message=ChatMessage(role="assistant", content=final_response),
                finish_reason="stop",
            )
        ],
    )


def _get_model_names(trio: TrioModel) -> str:
    """Get a string representation of the trio model names for logging."""
    names = []
    for member in trio.trio:
        if isinstance(member.model, TrioModel):
            names.append("trio")
        else:
            names.append(member.model)
    return f"[{', '.join(names)}]"


# Serve static frontend files at /chat/
static_dir = Path(__file__).parent.parent / "static"
if static_dir.exists():
    app.mount("/chat", StaticFiles(directory=static_dir, html=True), name="chat")


if __name__ == "__main__":
    import uvicorn

    settings = get_settings()
    uvicorn.run(app, host="0.0.0.0", port=settings.trio_port)
