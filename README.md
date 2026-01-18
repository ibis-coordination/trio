# Trio

<img src="trio-logo.svg" width="200px">

**Trio** is an AI ensemble system where **the ensemble is the model**. Instead of calling a single LLM, you define a pipeline of models and an aggregation strategy—and Trio executes it as if it were one model, returning a single response in OpenAI-compatible format.

## The Core Idea

In a typical LLM API call, the `model` parameter is a string like `"gpt-4o"` or `"claude-sonnet"`. In Trio, the `model` parameter can also be an **object** that defines an entire ensemble pipeline:

```json
{
  "model": {
    "ensemble": [
      {"model": "gpt-4o"},
      {"model": "claude-sonnet"},
      {"model": "mistral-large"}
    ],
    "aggregation_method": "acceptance_voting"
  },
  "messages": [{"role": "user", "content": "What is 2+2?"}]
}
```

This object is a declarative specification—a DSL for LLM pipelines. Trio interprets it and executes:

1. **Map**: Fan out the prompt to all ensemble members in parallel
2. **Reduce**: Aggregate responses using the specified method
3. **Return**: Single response in standard OpenAI format

The client doesn't need to know the internal complexity. From its perspective, it's just calling a model.

## Why This Matters

- **Consistent quality**: Multiple models catch each other's mistakes
- **Recursive composition**: Ensemble members can themselves be ensembles (nested pipelines)
- **Pass-through compatibility**: String model names bypass the ensemble and forward directly to the backend
- **Single endpoint**: Use one API for both ensemble calls and direct model access

## Aggregation Methods

The `aggregation_method` determines how Trio reduces N responses into one:

| Method | Calls | Description |
|--------|-------|-------------|
| `acceptance_voting` | 2N | Each model votes on all responses; winner has most acceptances |
| `random` | 1 | Randomly select one model, then call only that model |
| `judge` | N+1 | A separate judge model picks the best |
| `synthesize` | N+1 | A separate model synthesizes all responses into one |
| `concat` | N | Concatenate all responses into one output |

### Acceptance Voting

Each model evaluates all responses and marks them as:
- **ACCEPTED**: Adequate answers to the question
- **PREFERRED**: The single best response among accepted ones

Winner is ranked by acceptance count, then preference count. Most thorough but slowest.

### Random

Randomly selects one model from the ensemble and calls only that model. The selection happens *before* any API calls, making this the cheapest aggregation method (1 call instead of N). Useful for A/B testing ensemble configurations or when you want diversity over consistency.

### Judge

A separate "judge" model evaluates all responses and picks the best. Good when you have a high-quality model available that's different from the ensemble members.

### Synthesize

A separate model reads all responses and synthesizes them into a single combined answer. Unlike the other methods which select a winner, this creates new content that draws from all responses.

### Concat

Concatenates all responses into a single output with model attribution. Unlike `synthesize`, this doesn't use an LLM to combine responses—it's a raw concatenation. Useful when you want to see all perspectives without any selection or editing.

## Pass-Through Mode

If `model` is a string (e.g., `"mistral"`), Trio bypasses the ensemble and forwards directly to the backend. This lets you use a single endpoint for both ensemble and direct model access:

```bash
# Direct model call (no ensemble)
curl -X POST http://localhost:8000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model": "mistral", "messages": [{"role": "user", "content": "Hello!"}]}'
```

## Recursive Composition

Because an ensemble behaves like a model, ensemble members can themselves be ensembles. This enables hierarchical pipelines:

```json
{
  "model": {
    "ensemble": [
      {"model": "gpt-4o"},
      {
        "model": {
          "ensemble": [{"model": "claude-sonnet"}, {"model": "claude-haiku"}],
          "aggregation_method": "random"
        }
      }
    ],
    "aggregation_method": "acceptance_voting"
  },
  "messages": [{"role": "user", "content": "Hello!"}]
}
```

Here the outer ensemble has two members: `gpt-4o` and a nested ensemble. The nested ensemble runs first (randomly selecting between Claude models), then its output competes with GPT-4o's response in the outer acceptance voting round.

This multiplies cost and latency but enables:
- **Hierarchical consensus**: Sub-ensembles reach their own consensus before the top-level aggregation
- **Diversity amplification**: N ensembles × M models = N×M perspectives
- **Specialization**: Different sub-ensembles tuned for different purposes (creativity, accuracy, etc.)

## Quick Start

### Using Docker Compose (recommended)

The repository includes an example `docker-compose.yml` that runs Trio with LiteLLM and Ollama:

```bash
# Start all services
docker compose up -d

# Pull required Ollama models
docker compose exec ollama ollama pull llama3.2:1b
docker compose exec ollama ollama pull llama3.2:3b
docker compose exec ollama ollama pull mistral

# Test the health endpoint
curl http://localhost:8000/health

# Make a completion request
curl -X POST http://localhost:8000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": {
      "ensemble": [{"model": "llama3.2:1b"}, {"model": "llama3.2:3b"}, {"model": "mistral"}],
      "aggregation_method": "acceptance_voting"
    },
    "messages": [{"role": "user", "content": "What is 2+2?"}]
  }'
```

### Using Docker directly

If you already have a LiteLLM or OpenAI-compatible backend running:

```bash
docker run -p 8000:8000 \
  -e TRIO_BACKEND_URL=http://your-backend:4000 \
  ghcr.io/ibis-coordination/trio:latest
```

### From source

```bash
git clone https://github.com/ibis-coordination/trio.git
cd trio
pip install .
TRIO_BACKEND_URL=http://localhost:4000 uvicorn src.main:app --host 0.0.0.0 --port 8000
```

### Using Anthropic or OpenAI

The included `litellm-config.yaml` has Anthropic and OpenAI models pre-configured. To use them, set your API keys before starting:

```bash
# Set API keys
export ANTHROPIC_API_KEY=your-anthropic-key
export OPENAI_API_KEY=your-openai-key

# Start services (keys are passed through to LiteLLM)
docker compose up -d

# Use Claude models in the ensemble
curl -X POST http://localhost:8000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": {
      "ensemble": [
        {"model": "claude-sonnet"},
        {"model": "claude-haiku"},
        {"model": "gpt-4o-mini"}
      ],
      "aggregation_method": "acceptance_voting"
    },
    "messages": [{"role": "user", "content": "What is 2+2?"}]
  }'
```

Available cloud models in the default config:
- **Anthropic**: `claude-sonnet`, `claude-haiku`
- **OpenAI**: `gpt-4o`, `gpt-4o-mini`

You can mix local Ollama models with cloud models in the same ensemble.

## API Reference

### POST /v1/chat/completions

OpenAI-compatible chat completions endpoint.

**Request Schema:**

| Field | Type | Description |
|-------|------|-------------|
| `model` | `string \| EnsembleModel` | Model name (pass-through) or ensemble definition |
| `messages` | `ChatMessage[]` | Conversation history |
| `max_tokens` | `int` | Max tokens to generate (default: 500) |
| `temperature` | `float` | Sampling temperature (default: 0.7) |

**EnsembleModel Schema:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `ensemble` | `EnsembleMember[]` | Yes | List of models to query |
| `aggregation_method` | `string` | Yes | One of: `acceptance_voting`, `random`, `judge`, `synthesize`, `concat` |
| `judge_model` | `string` | If judge | Model to use as judge |
| `synthesize_model` | `string` | If synthesize | Model to synthesize responses |

**EnsembleMember Schema:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `model` | `string \| EnsembleModel` | Yes | Model name or nested ensemble |
| `system_prompt` | `string` | No | Custom system prompt for this member |

**Example with custom system prompts:**
```json
{
  "model": {
    "ensemble": [
      {"model": "llama3.2:1b", "system_prompt": "You are concise and direct."},
      {"model": "mistral", "system_prompt": "You are detailed and thorough."}
    ],
    "aggregation_method": "acceptance_voting"
  },
  "messages": [{"role": "user", "content": "Explain quantum computing"}]
}
```

**Example with judge:**
```json
{
  "model": {
    "ensemble": [{"model": "llama3.2:1b"}, {"model": "mistral"}],
    "aggregation_method": "judge",
    "judge_model": "claude-sonnet"
  },
  "messages": [{"role": "user", "content": "Explain quantum computing"}]
}
```

**Example with synthesize:**
```json
{
  "model": {
    "ensemble": [{"model": "llama3.2:1b"}, {"model": "mistral"}],
    "aggregation_method": "synthesize",
    "synthesize_model": "gpt-4o"
  },
  "messages": [{"role": "user", "content": "Explain quantum computing"}]
}
```

**Response:**
```json
{
  "id": "trio-abc123",
  "object": "chat.completion",
  "created": 1705000000,
  "model": "trio-1.0",
  "choices": [{
    "index": 0,
    "message": {"role": "assistant", "content": "4"},
    "finish_reason": "stop"
  }],
  "usage": {"prompt_tokens": 10, "completion_tokens": 1, "total_tokens": 11}
}
```

**X-Trio-Details Header:**

The response includes a custom header with aggregation details:
```json
{
  "winner_index": 0,
  "aggregation_method": "acceptance_voting",
  "candidates": [
    {"model": "llama3.2:1b", "response": "4", "accepted": 3, "preferred": 2},
    {"model": "llama3.2:3b", "response": "The answer is 4.", "accepted": 3, "preferred": 1},
    {"model": "mistral", "response": "2+2=4", "accepted": 2, "preferred": 0}
  ]
}
```

### GET /v1/models

List available models.

### GET /health

Health check endpoint.

## Configuration

Environment variables:

| Variable | Description | Default |
|----------|-------------|---------|
| `TRIO_BACKEND_URL` | LiteLLM/Ollama URL | `http://litellm:4000` |
| `TRIO_PORT` | Service port | `8000` |
| `TRIO_TIMEOUT` | Request timeout (seconds) | `120` |

## Using with OpenAI Clients

Trio is compatible with any OpenAI client. For pass-through mode (single model), use a string model name. For ensemble mode, the model must be passed as a dict/object directly in the request body.

**Python (pass-through):**
```python
from openai import OpenAI

client = OpenAI(base_url="http://localhost:8000/v1", api_key="unused")
response = client.chat.completions.create(
    model="mistral",
    messages=[{"role": "user", "content": "What is 2+2?"}]
)
print(response.choices[0].message.content)
```

**Python (ensemble via httpx):**
```python
import httpx

response = httpx.post(
    "http://localhost:8000/v1/chat/completions",
    json={
        "model": {
            "ensemble": [{"model": "llama3.2:1b"}, {"model": "mistral"}],
            "aggregation_method": "acceptance_voting"
        },
        "messages": [{"role": "user", "content": "What is 2+2?"}]
    }
)
print(response.json()["choices"][0]["message"]["content"])
```

**curl (ensemble):**
```bash
curl http://localhost:8000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": {
      "ensemble": [{"model": "llama3.2:1b"}, {"model": "mistral"}],
      "aggregation_method": "acceptance_voting"
    },
    "messages": [{"role": "user", "content": "Hello!"}]
  }'
```

## Architecture

```
                           ┌─────────────────────────────────────────┐
                           │              Trio Server                │
                           │                                         │
Request ──► model: {...} ──┼──► Parse EnsembleModel                  │
                           │         │                               │
                           │         ▼                               │
                           │    ┌─────────┐                          │
                           │    │   MAP   │  Fan out to N models     │
                           │    └────┬────┘                          │
                           │         │                               │
                           │    ┌────▼────┐                          │
                           │    │ REDUCE  │  Aggregate responses     │
                           │    └────┬────┘                          │
                           │         │                               │
                           └─────────┼───────────────────────────────┘
                                     ▼
                              OpenAI-format response
```

Trio connects to any OpenAI-compatible backend (LiteLLM, Ollama, etc.) for the actual model calls.

## Development

```bash
# Install dependencies
cd trio
pip install -e ".[dev]"

# Run locally (requires LiteLLM backend)
TRIO_BACKEND_URL=http://localhost:4000 uvicorn src.main:app --reload

# Run tests
pytest

# Run type checker
mypy src/
```
