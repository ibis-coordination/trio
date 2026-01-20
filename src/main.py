"""FastAPI application for Trio voting ensemble service."""

import json
import logging
from pathlib import Path

import httpx
from fastapi import FastAPI, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from .config import get_settings, get_trio_models
from .models import (
    ChatCompletionChoice,
    ChatCompletionRequest,
    ChatCompletionResponse,
    ChatMessage,
    EnsembleMember,
    EnsembleModel,
    ModelInfo,
    ModelListResponse,
)
from .voting import voting_completion

# Configure logging
logging.basicConfig(
    level=logging.DEBUG,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

# Model identifier with version for API responses
MODEL_ID = "trio-1.0"

# Maximum number of models allowed in a single ensemble request
# Based on research suggesting 3-7 is optimal; 9 allows for 3x3 hierarchical setups
MAX_ENSEMBLE_SIZE = 9

app = FastAPI(
    title="Trio",
    description="OpenAI-compatible voting ensemble service",
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
    """Create a chat completion using voting ensemble (OpenAI-compatible).

    This endpoint is compatible with the OpenAI chat completions API.

    If model is an EnsembleModel object, generates responses from multiple models,
    runs the specified aggregation method, and returns the winning response.

    If model is a string, passes through directly to that model via the backend
    without ensemble voting.

    Voting details are included in the X-Trio-Details response header.
    """
    # Streaming is not supported
    if request.stream:
        raise HTTPException(status_code=501, detail="Streaming is not supported")

    settings = get_settings()

    # Resolve trio model references (e.g., "trio:perspectives")
    if isinstance(request.model, str) and request.model.startswith("trio:"):
        model_name = request.model[5:]
        trio_models = get_trio_models()
        if model_name not in trio_models:
            raise HTTPException(status_code=404, detail=f"Trio model '{model_name}' not found")
        request.model = EnsembleModel(**trio_models[model_name])

    # Determine if this is an ensemble request or pass-through
    if isinstance(request.model, EnsembleModel):
        # Ensemble mode: extract config from model object
        ensemble = request.model.ensemble
        aggregation_method = request.model.aggregation_method
        judge_model = request.model.judge_model
        synthesize_model = request.model.synthesize_model
        response_model = MODEL_ID
    else:
        # Pass-through mode: forward directly to the specified model
        ensemble = [EnsembleMember(model=request.model)]
        aggregation_method = "random"  # Single model, aggregation is irrelevant
        judge_model = None
        synthesize_model = None
        response_model = request.model

    # Validate ensemble size
    if len(ensemble) > MAX_ENSEMBLE_SIZE:
        raise HTTPException(
            status_code=400,
            detail=f"Ensemble size {len(ensemble)} exceeds maximum of {MAX_ENSEMBLE_SIZE} models",
        )

    # Validate judge method has a judge_model
    if aggregation_method == "judge" and not judge_model:
        raise HTTPException(
            status_code=400,
            detail="judge_model is required when using 'judge' aggregation method",
        )

    # Validate synthesize method has a synthesize_model
    if aggregation_method == "synthesize" and not synthesize_model:
        raise HTTPException(
            status_code=400,
            detail="synthesize_model is required when using 'synthesize' aggregation method",
        )

    logger.info(
        f"Chat completion request: {len(request.messages)} messages, "
        f"ensemble size: {len(ensemble)}, aggregation: {aggregation_method}"
    )

    # Use httpx client with timeout
    async with httpx.AsyncClient(timeout=settings.trio_timeout) as client:
        winner_response, voting_details = await voting_completion(
            client,
            settings,
            request.messages,
            ensemble,
            request.max_tokens,
            request.temperature,
            aggregation_method,
            judge_model,
            synthesize_model,
        )

    # Build OpenAI-compatible response
    completion_response = ChatCompletionResponse(
        model=response_model,
        choices=[
            ChatCompletionChoice(
                index=0,
                message=ChatMessage(role="assistant", content=winner_response),
                finish_reason="stop",
            )
        ],
    )

    # Add voting details to custom header
    response.headers["X-Trio-Details"] = json.dumps(voting_details.model_dump())

    return completion_response


# Serve static frontend files at /chat/
static_dir = Path(__file__).parent.parent / "static"
if static_dir.exists():
    app.mount("/chat", StaticFiles(directory=static_dir, html=True), name="chat")


if __name__ == "__main__":
    import uvicorn

    settings = get_settings()
    uvicorn.run(app, host="0.0.0.0", port=settings.trio_port)
