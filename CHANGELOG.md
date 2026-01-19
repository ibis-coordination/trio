# Changelog

## v0.2.0

### Breaking Changes

- **Ensemble as model API**: The `model` parameter now accepts either a string (pass-through) or an `EnsembleModel` object defining the full ensemble configuration. This replaces the previous `trio_*` request parameters.
- **Removed request parameters**: `trio_models`, `trio_aggregation_method`, `trio_judge_model`, `trio_synthesize_model` are no longer supported
- **Removed environment variables**: `TRIO_MODELS` and `TRIO_AGGREGATION_METHOD` environment variables have been removed
- **Aggregation method required**: `aggregation_method` must now be explicitly specified in the `EnsembleModel` (no default)

### New Features

- **Recursive ensemble composition**: `EnsembleMember.model` can now be a nested `EnsembleModel`, enabling hierarchical ensembles
- **`synthesize` aggregation method**: Combines multiple LLM responses into a single synthesized answer using a configurable model
- **`concat` aggregation method**: Joins all responses together with model attribution
- **Optimized `random` aggregation**: Now selects a model first and makes only 1 call instead of N

### Improvements

- Docker Compose setup with LiteLLM and Ollama for easy local development
- Pydantic validation for aggregation method using Literal type
- Return 501 for streaming requests instead of silently ignoring
- Removed unused OpenAI parameters (top_p, n, stop, etc.)
- Improved test coverage for aggregation, voting, and API endpoints
- Added CLAUDE.md with development commands and architecture overview

### Other

- Added MIT License

## v0.1.0

Initial release: AI ensemble system with OpenAI-compatible API.

- Parallel prompt distribution to multiple LLMs
- `acceptance` voting aggregation method
- `judge` aggregation method
- `random` aggregation method
- Pass-through mode for single model requests
- Voting details in `X-Trio-Details` response header
