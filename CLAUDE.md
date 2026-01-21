# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Trio is an AI model composition framework that creates new models out of three base models. Models A and B generate responses independently in parallel, then model C synthesizes them into a final response. It exposes an OpenAI-compatible API, so clients interact with the trio as if it were a single model.

## Development Commands

### Backend (Python)

```bash
# Install dependencies (use local .venv)
.venv/bin/pip install -e ".[dev]"

# Run locally (requires Ollama or other OpenAI-compatible backend)
TRIO_BACKEND_URL=http://localhost:11434 .venv/bin/uvicorn src.main:app --reload

# Run tests
.venv/bin/pytest

# Run a single test
.venv/bin/pytest tests/test_trio.py::TestClassName::test_name

# Type checking
.venv/bin/mypy src/
```

### Frontend (React + Effect + Vite)

```bash
cd frontend

# Install dependencies
npm install

# Run dev server (proxies API to backend on port 8000)
npm run dev

# Type checking
npm run typecheck

# Lint
npm run lint

# Build for production (outputs to ../static/)
npm run build
```

**Note:** The frontend has no test script. Use `npm run typecheck` and `npm run lint` to verify changes.

## Running with Docker Compose

```bash
docker compose up -d                                    # Start Trio + LiteLLM + Ollama
docker compose exec ollama ollama pull llama3.2:1b      # Pull a model
curl http://localhost:8000/health                       # Verify it's running
```

## Running Locally with Ollama

```bash
# Terminal 1: Start Ollama (if not already running)
ollama serve

# Terminal 2: Start backend
TRIO_BACKEND_URL=http://localhost:11434 .venv/bin/uvicorn src.main:app --port 8000 --reload

# Terminal 3: Start frontend dev server (optional, for hot reload)
cd frontend && npm run dev
```

The backend serves static files from `static/` at the root URL, so you can access the UI at http://localhost:8000 after running `npm run build` in the frontend.

## Architecture

The codebase follows a straightforward request flow:

1. **main.py** - FastAPI app with `/v1/chat/completions` endpoint. Determines if request is trio mode (`model` is a `TrioModel` object) or pass-through mode (`model` is a string)

2. **trio_engine.py** - Orchestrates the trio pipeline:
   - `_extract_host_system_prompt()` - Separates host system prompt from chat history
   - `_generate_member_response()` - Handles both simple models and nested trios using host-aware tool pattern
   - `_synthesize()` - Calls model C to synthesize A and B's responses using tool messages
   - `trio_completion()` - Main entry point that generates A and B in parallel, then synthesizes with C

3. **llm.py** - HTTP client for backend LLM calls (LiteLLM/Ollama/OpenAI)

4. **models.py** - Pydantic models for OpenAI-compatible request/response format
   - `TrioModel`: Defines a trio with exactly 3 members
   - `TrioMember`: A model (string or nested `TrioModel`) with optional messages
   - `ChatCompletionRequest.model`: Accepts `str | TrioModel`
   - `ToolCall`, `ToolCallFunction`: Support for tool call messages

5. **config.py** - Environment-based settings via pydantic-settings (`TRIO_BACKEND_URL`, `TRIO_PORT`, `TRIO_TIMEOUT`)

## Key Design Patterns

- **Pass-through mode**: String model names forward directly to backend
- **Trio as model**: The `model` param accepts an object defining the trio configuration
- **Recursive composition**: `TrioMember.model` can be a nested `TrioModel` for hierarchical trios
- **Host-aware tool pattern**: Models receive context through simulated tool calls (see below)
- **Trio details**: Returned in `X-Trio-Details` response header for debugging/transparency

## Host-Aware Tool Pattern

All trio models understand they're part of a larger system ("Trio") serving a "host application". Context is provided through tool messages to clearly separate layers:

- **Trio layer**: System prompt explaining the model's role in Trio
- **Host layer**: The host application's system prompt (via `get_host_system_prompt` tool)
- **User layer**: Normal chat messages

### Message Flow for Models A and B

```
1. system: "You are an assistant within an AI system called Trio..."
2. [member's custom messages, if any]
3. assistant: {tool_calls: [{name: "get_host_system_prompt"}]}
4. tool: "[host system prompt from request]"
5. [chat history: user/assistant messages]
```

### Message Flow for Model C (Synthesizer)

```
1. system: "You are an assistant within an AI system called Trio..."
2. [member's custom messages, if any]
3. assistant: {tool_calls: [{name: "get_host_system_prompt"}]}
4. tool: "[host system prompt from request]"
5. [chat history up to final user message]
6. user: [final user message]
7. assistant: {tool_calls: [{name: "get_drafts"}]}
8. tool: "Draft 1:\n{response_a}\n\nDraft 2:\n{response_b}"
```

This pattern allows models to understand their role in the system while keeping the host's instructions and draft responses clearly scoped.

## API Example

```json
{
  "model": {
    "trio": [
      {"model": "model-a", "messages": [{"role": "system", "content": "Be concise"}]},
      {"model": "model-b", "messages": [{"role": "system", "content": "Be detailed"}]},
      {"model": "model-c"}
    ]
  },
  "messages": [{"role": "user", "content": "Hello"}]
}
```

## Frontend Architecture

The frontend is a React app in `frontend/` using Effect for functional error handling.

### Key Files

- **types/index.ts** - Shared TypeScript types (`TrioModel`, `TrioMember`, `TrioDetails`, etc.)
- **services/api.ts** - Effect-based API client with validation
- **App.tsx** - Main app state and message handling
- **components/** - UI components

### Component Structure

| Component | Purpose |
|-----------|---------|
| `ModelConfigPanel` | Container for mode toggle and config |
| `ModeToggle` | Switch between "Simple" and "Trio" modes |
| `TrioConfig` | Trio member configuration container |
| `TrioMemberList` | Fixed 3-member list (A, B, C) |
| `TrioMemberRow` | Single member with model input and optional system prompt |
| `TrioDetailsPanel` | Expandable panel showing A/B responses after synthesis |
| `ChatPanel` | Message list and input |
| `MessageBubble` | Individual message with metadata |

### Type Conventions

- All interface properties use `readonly` modifier
- Trio members use tuple type: `readonly [TrioMember, TrioMember, TrioMember]`
- Use `as const` for literal tuple assertions

## Release Process

- **CHANGELOG.md**: Document all notable changes for each release, including breaking changes, new features, and improvements
