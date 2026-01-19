# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Trio is an AI ensemble system that sends prompts to multiple LLMs in parallel, then selects the best response through voting. It exposes an OpenAI-compatible API, so clients interact with the ensemble as if it were a single model.

## Development Commands

```bash
# Install dependencies
pip install -e ".[dev]"

# Run locally (requires LiteLLM or other OpenAI-compatible backend)
TRIO_BACKEND_URL=http://localhost:4000 uvicorn src.main:app --reload

# Run tests
pytest

# Run a single test
pytest tests/test_voting.py::test_name

# Type checking
mypy src/
```

## Running with Docker Compose

```bash
docker compose up -d                                    # Start Trio + LiteLLM + Ollama
docker compose exec ollama ollama pull llama3.2:1b      # Pull a model
curl http://localhost:8000/health                       # Verify it's running
```

## Architecture

The codebase follows a straightforward request flow:

1. **main.py** - FastAPI app with `/v1/chat/completions` endpoint. Determines if request is ensemble mode (`model` is an `EnsembleModel` object) or pass-through mode (`model` is a string)

2. **voting.py** - Orchestrates the ensemble pipeline:
   - `_generate_single_response()` - Handles both simple models and nested ensembles recursively
   - `generate_responses()` - Fans out to N models in parallel via asyncio.gather
   - `voting_completion()` - Main entry point that handles single-model passthrough, parallel generation, and aggregation dispatch

3. **aggregation.py** - Four methods for selecting the winner:
   - `acceptance_voting`: Each model votes ACCEPTED/PREFERRED on all responses
   - `random`: Random selection
   - `judge`: Separate judge model picks best response
   - `synthesize`: Separate model synthesizes all responses into one

4. **llm.py** - HTTP client for backend LLM calls (LiteLLM/Ollama/OpenAI)

5. **models.py** - Pydantic models for OpenAI-compatible request/response format
   - `EnsembleModel`: Defines an ensemble with members and aggregation method
   - `EnsembleMember`: A model (string or nested `EnsembleModel`) with optional system prompt
   - `ChatCompletionRequest.model`: Accepts `str | EnsembleModel`

6. **config.py** - Environment-based settings via pydantic-settings (`TRIO_BACKEND_URL`, `TRIO_PORT`, `TRIO_TIMEOUT`)

## Key Design Patterns

- **Pass-through mode**: String model names bypass voting and forward directly to backend
- **Ensemble as model**: The `model` param accepts an object defining the full ensemble configuration
- **Recursive composition**: `EnsembleMember.model` can be a nested `EnsembleModel` for hierarchical ensembles
- **Explicit configuration**: No defaults for ensemble or aggregation method - requests must be explicit
- **Voting details**: Returned in `X-Trio-Details` response header for debugging/transparency

## Release Process

- **CHANGELOG.md**: Document all notable changes for each release, including breaking changes, new features, and improvements
