# Trio

<img src="trio-logo.svg" width="200px">

**Trio** is an AI model composition framework that creates new models out of three base models.

## How it works

Let A, B, and C be the three base models.

Models A and B both generate a response to the prompt **independently**, without influencing each other in any way. Then model C synthesizes the two perspectives into a final response.

```
                    ┌─────────────────────────────────────────┐
                    │              Trio Server                │
                    │                                         │
Request ────────────┼──► Parse TrioModel                      │
                    │         │                               │
                    │    ┌────┴────┐                          │
                    │    │ Model A │──────┐                   │
                    │    └─────────┘      │                   │
                    │         ║           ▼                   │
                    │    ┌─────────┐  ┌─────────┐             │
                    │    │ Model B │──│ Model C │─── Synthesize
                    │    └─────────┘  └────┬────┘             │
                    │                      │                  │
                    └──────────────────────┼──────────────────┘
                                           ▼
                                 OpenAI-format response
```

This pattern is inspired by how stereoscopic vision works. Models A and B are like two eyes providing independent perspectives, and model C is like the visual cortex of the brain that infers depth information by comparing the two perspectives.

By detecting **invariance** across multiple perspectives, the third model detects new information that is not accessible by any of the three base models in isolation.

## Variance vectors

In order to control the variance vector of a given pair of models, each model can be given a different system prompt. For example, A can be instructed to be detail-oriented while B is instructed to consider the bigger picture. Different dialectical polarities can be used for different scenarios.

| A | B |
|---|---|
| short-term | long-term |
| optimistic | pessimistic |
| pragmatic | theoretical |
| simple | complex |
| quantitative | qualitative |
| specific | general |
| emotional | intellectual |
| goal-oriented | awareness-oriented |

## Recursion

Any model in the trio can itself be a trio, enabling hierarchical synthesis:

```json
{
  "model": {
    "trio": [
      {
        "model": {
          "trio": [
            {"model": "model-x"},
            {"model": "model-y"},
            {"model": "model-z"}
          ]
        }
      },
      {"model": "model-b"},
      {"model": "model-c"}
    ]
  }
}
```

This allows for multiple variance vectors to be composed in order to construct thinking frameworks such as the Rumsfeld matrix (known-knowns, known-unknowns, unknown-knowns, unknown-unknowns) or the Eisenhower matrix (important and urgent, important and not urgent, not important and urgent, not important and not urgent).

## API

Trio exposes an OpenAI-compatible API at `/v1/chat/completions`.

### Trio Mode

To use trio synthesis, pass a `TrioModel` object as the `model` parameter:

```bash
curl -X POST http://localhost:8000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": {
      "trio": [
        {"model": "llama3.2:1b"},
        {"model": "mistral"},
        {"model": "llama3.2:3b"}
      ]
    },
    "messages": [{"role": "user", "content": "What is the meaning of life?"}]
  }'
```

### With Variance Vectors (System Prompts)

Each member can have custom messages (typically system prompts) to create dialectical tension:

```bash
curl -X POST http://localhost:8000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": {
      "trio": [
        {
          "model": "llama3.2:1b",
          "messages": [{"role": "system", "content": "Focus on short-term, practical implications."}]
        },
        {
          "model": "mistral",
          "messages": [{"role": "system", "content": "Consider long-term, strategic implications."}]
        },
        {"model": "llama3.2:3b"}
      ]
    },
    "messages": [{"role": "user", "content": "Should I change careers?"}]
  }'
```

### Pass-Through Mode

If `model` is a string, Trio bypasses synthesis and forwards directly to the backend:

```bash
curl -X POST http://localhost:8000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model": "mistral", "messages": [{"role": "user", "content": "Hello!"}]}'
```

### Request Schema

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `model` | `string \| TrioModel` | Yes | Model name (pass-through) or trio definition |
| `messages` | `ChatMessage[]` | Yes | Conversation history |
| `max_tokens` | `int` | No | Max tokens to generate (default: 500) |
| `temperature` | `float` | No | Sampling temperature (default: 0.7) |

**TrioModel Schema:**

| Field | Type | Description |
|-------|------|-------------|
| `trio` | `TrioMember[3]` | Exactly 3 members: A, B, and C |

**TrioMember Schema:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `model` | `string \| TrioModel` | Yes | Model name or nested trio |
| `messages` | `ChatMessage[]` | No | Messages prepended to request messages |

### Response

Standard OpenAI chat completion format:

```json
{
  "id": "trio-abc123",
  "object": "chat.completion",
  "created": 1705000000,
  "model": "trio-1.0",
  "choices": [{
    "index": 0,
    "message": {"role": "assistant", "content": "Synthesized response..."},
    "finish_reason": "stop"
  }],
  "usage": {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0}
}
```

**X-Trio-Details Header:**

The response includes a custom header with synthesis details:

```json
{
  "response_a": "Response from model A...",
  "response_b": "Response from model B...",
  "model_a": "llama3.2:1b",
  "model_b": "mistral",
  "model_c": "llama3.2:3b"
}
```

## Quick Start

### Using Docker Compose (recommended)

```bash
# Start all services
docker compose up -d

# Pull required Ollama models
docker compose exec ollama ollama pull llama3.2:1b
docker compose exec ollama ollama pull llama3.2:3b
docker compose exec ollama ollama pull mistral

# Test the health endpoint
curl http://localhost:8000/health

# Make a trio request
curl -X POST http://localhost:8000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": {
      "trio": [
        {"model": "llama3.2:1b"},
        {"model": "mistral"},
        {"model": "llama3.2:3b"}
      ]
    },
    "messages": [{"role": "user", "content": "What is 2+2?"}]
  }'
```

### From Source

```bash
git clone https://github.com/ibis-coordination/trio.git
cd trio
pip install .
TRIO_BACKEND_URL=http://localhost:4000 uvicorn src.main:app --host 0.0.0.0 --port 8000
```

## Configuration

Environment variables:

| Variable | Description | Default |
|----------|-------------|---------|
| `TRIO_BACKEND_URL` | LiteLLM/Ollama URL | `http://litellm:4000` |
| `TRIO_PORT` | Service port | `8000` |
| `TRIO_TIMEOUT` | Request timeout (seconds) | `120` |

## Development

```bash
# Install dependencies
pip install -e ".[dev]"

# Run locally (requires LiteLLM backend)
TRIO_BACKEND_URL=http://localhost:4000 uvicorn src.main:app --reload

# Run tests
pytest

# Run type checker
mypy src/
```

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for release history and breaking changes.
