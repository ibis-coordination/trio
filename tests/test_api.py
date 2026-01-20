"""Tests for API endpoints."""

import json
import pytest
from unittest.mock import patch, AsyncMock

from fastapi.testclient import TestClient

from src.main import app
from src.models import VotingDetails, Candidate


@pytest.fixture
def client() -> TestClient:
    """Create a test client for the FastAPI app."""
    return TestClient(app)


class TestHealthEndpoint:
    """Tests for /health endpoint."""

    def test_health_returns_ok(self, client: TestClient) -> None:
        """Health endpoint returns status ok."""
        response = client.get("/health")
        assert response.status_code == 200
        assert response.json() == {"status": "ok"}


class TestModelsEndpoint:
    """Tests for /v1/models endpoint."""

    def test_lists_trio_model(self, client: TestClient) -> None:
        """Models endpoint lists trio as available model with version."""
        response = client.get("/v1/models")
        assert response.status_code == 200
        data = response.json()
        assert data["object"] == "list"
        assert len(data["data"]) == 1
        assert data["data"][0]["id"] == "trio-1.0"


class TestChatCompletionsEndpoint:
    """Tests for /v1/chat/completions endpoint."""

    def test_returns_openai_format(self, client: TestClient) -> None:
        """Response matches OpenAI chat completion format."""
        with patch("src.main.voting_completion") as mock_voting:
            mock_voting.return_value = (
                "Test response",
                VotingDetails(
                    winner_index=0,
                    candidates=[Candidate(model="test", response="Test response", accepted=1, preferred=1)],
                ),
            )

            response = client.post(
                "/v1/chat/completions",
                json={
                    "model": {
                        "ensemble": [{"model": "model1"}, {"model": "model2"}],
                        "aggregation_method": "acceptance_voting",
                    },
                    "messages": [{"role": "user", "content": "Hello"}],
                },
            )

            assert response.status_code == 200
            data = response.json()
            assert data["object"] == "chat.completion"
            assert data["model"] == "trio-1.0"
            assert len(data["choices"]) == 1
            assert data["choices"][0]["message"]["role"] == "assistant"
            assert data["choices"][0]["message"]["content"] == "Test response"
            assert data["choices"][0]["finish_reason"] == "stop"

    def test_includes_voting_details_header(self, client: TestClient) -> None:
        """X-Trio-Details header contains voting information."""
        with patch("src.main.voting_completion") as mock_voting:
            mock_voting.return_value = (
                "Winner",
                VotingDetails(
                    winner_index=0,
                    candidates=[
                        Candidate(model="model1", response="Winner", accepted=2, preferred=1),
                        Candidate(model="model2", response="Loser", accepted=1, preferred=0),
                    ],
                ),
            )

            response = client.post(
                "/v1/chat/completions",
                json={
                    "model": {
                        "ensemble": [{"model": "model1"}, {"model": "model2"}],
                        "aggregation_method": "acceptance_voting",
                    },
                    "messages": [{"role": "user", "content": "Hello"}],
                },
            )

            assert "X-Trio-Details" in response.headers
            details = json.loads(response.headers["X-Trio-Details"])
            assert details["winner_index"] == 0
            assert len(details["candidates"]) == 2
            assert details["candidates"][0]["model"] == "model1"
            assert details["candidates"][0]["accepted"] == 2

    def test_accepts_ensemble_with_custom_prompts(self, client: TestClient) -> None:
        """Can specify models with custom prompts via ensemble."""
        with patch("src.main.voting_completion") as mock_voting:
            mock_voting.return_value = (
                "Response",
                VotingDetails(winner_index=0, candidates=[]),
            )

            response = client.post(
                "/v1/chat/completions",
                json={
                    "model": {
                        "ensemble": [
                            {"model": "model1", "system_prompt": "Be brief"},
                            {"model": "model2", "system_prompt": "Be detailed"},
                        ],
                        "aggregation_method": "acceptance_voting",
                    },
                    "messages": [{"role": "user", "content": "Hello"}],
                },
            )

            assert response.status_code == 200
            call_args = mock_voting.call_args
            ensemble = call_args[0][3]
            assert len(ensemble) == 2
            assert ensemble[0].model == "model1"
            assert ensemble[0].system_prompt == "Be brief"
            assert ensemble[1].model == "model2"
            assert ensemble[1].system_prompt == "Be detailed"

    def test_validates_message_format(self, client: TestClient) -> None:
        """Rejects invalid message format."""
        response = client.post(
            "/v1/chat/completions",
            json={
                "model": {
                    "ensemble": [{"model": "model1"}],
                    "aggregation_method": "random",
                },
                "messages": [{"invalid": "format"}],
            },
        )

        assert response.status_code == 422  # Validation error

    def test_requires_messages(self, client: TestClient) -> None:
        """Messages field is required."""
        response = client.post(
            "/v1/chat/completions",
            json={
                "model": {
                    "ensemble": [{"model": "model1"}],
                    "aggregation_method": "random",
                },
            },
        )

        assert response.status_code == 422

    def test_rejects_ensemble_exceeding_max_size(self, client: TestClient) -> None:
        """Rejects ensemble with more than MAX_ENSEMBLE_SIZE models."""
        response = client.post(
            "/v1/chat/completions",
            json={
                "model": {
                    "ensemble": [{"model": f"model{i}"} for i in range(10)],  # 10 > MAX_ENSEMBLE_SIZE (9)
                    "aggregation_method": "random",
                },
                "messages": [{"role": "user", "content": "Hello"}],
            },
        )

        assert response.status_code == 400
        assert "exceeds maximum" in response.json()["detail"]
        assert "9" in response.json()["detail"]

    def test_accepts_ensemble_at_max_size(self, client: TestClient) -> None:
        """Accepts ensemble with exactly MAX_ENSEMBLE_SIZE models."""
        with patch("src.main.voting_completion") as mock_voting:
            mock_voting.return_value = (
                "Response",
                VotingDetails(winner_index=0, candidates=[]),
            )

            response = client.post(
                "/v1/chat/completions",
                json={
                    "model": {
                        "ensemble": [{"model": f"model{i}"} for i in range(9)],  # Exactly 9
                        "aggregation_method": "random",
                    },
                    "messages": [{"role": "user", "content": "Hello"}],
                },
            )

            assert response.status_code == 200

    def test_passthrough_mode_with_string_model(self, client: TestClient) -> None:
        """String model name triggers pass-through mode."""
        with patch("src.main.voting_completion") as mock_voting:
            mock_voting.return_value = (
                "Direct response",
                VotingDetails(
                    winner_index=0,
                    candidates=[Candidate(model="mistral", response="Direct response", accepted=0, preferred=0)],
                ),
            )

            response = client.post(
                "/v1/chat/completions",
                json={
                    "model": "mistral",
                    "messages": [{"role": "user", "content": "Hello"}],
                },
            )

            assert response.status_code == 200
            data = response.json()
            # Response model should match the requested model
            assert data["model"] == "mistral"
            # Should have created single-model ensemble
            call_args = mock_voting.call_args
            ensemble = call_args[0][3]
            assert len(ensemble) == 1
            assert ensemble[0].model == "mistral"

    def test_aggregation_method_passed_through(self, client: TestClient) -> None:
        """aggregation_method from model is passed to voting_completion."""
        with patch("src.main.voting_completion") as mock_voting:
            mock_voting.return_value = (
                "Response",
                VotingDetails(winner_index=0, candidates=[], aggregation_method="random"),
            )

            response = client.post(
                "/v1/chat/completions",
                json={
                    "model": {
                        "ensemble": [{"model": "model1"}, {"model": "model2"}],
                        "aggregation_method": "random",
                    },
                    "messages": [{"role": "user", "content": "Hello"}],
                },
            )

            assert response.status_code == 200
            call_args = mock_voting.call_args
            # aggregation_method is the 7th positional argument (index 6)
            assert call_args[0][6] == "random"

    def test_judge_method_requires_judge_model(self, client: TestClient) -> None:
        """Using 'judge' aggregation without judge_model returns 400."""
        response = client.post(
            "/v1/chat/completions",
            json={
                "model": {
                    "ensemble": [{"model": "model1"}, {"model": "model2"}],
                    "aggregation_method": "judge",
                },
                "messages": [{"role": "user", "content": "Hello"}],
            },
        )

        assert response.status_code == 400
        assert "judge_model" in response.json()["detail"]

    def test_judge_method_with_judge_model(self, client: TestClient) -> None:
        """Using 'judge' aggregation with judge_model succeeds."""
        with patch("src.main.voting_completion") as mock_voting:
            mock_voting.return_value = (
                "Response",
                VotingDetails(winner_index=0, candidates=[], aggregation_method="judge"),
            )

            response = client.post(
                "/v1/chat/completions",
                json={
                    "model": {
                        "ensemble": [{"model": "model1"}, {"model": "model2"}],
                        "aggregation_method": "judge",
                        "judge_model": "gpt-4o",
                    },
                    "messages": [{"role": "user", "content": "Hello"}],
                },
            )

            assert response.status_code == 200
            call_args = mock_voting.call_args
            # judge_model is the 8th positional argument (index 7)
            assert call_args[0][7] == "gpt-4o"

    def test_streaming_returns_501(self, client: TestClient) -> None:
        """Streaming requests return 501 Not Implemented."""
        response = client.post(
            "/v1/chat/completions",
            json={
                "model": {
                    "ensemble": [{"model": "model1"}],
                    "aggregation_method": "random",
                },
                "messages": [{"role": "user", "content": "Hello"}],
                "stream": True,
            },
        )

        assert response.status_code == 501
        assert "not supported" in response.json()["detail"].lower()

    def test_invalid_aggregation_method_returns_422(self, client: TestClient) -> None:
        """Invalid aggregation method returns 422 validation error."""
        response = client.post(
            "/v1/chat/completions",
            json={
                "model": {
                    "ensemble": [{"model": "model1"}],
                    "aggregation_method": "invalid_method",
                },
                "messages": [{"role": "user", "content": "Hello"}],
            },
        )

        assert response.status_code == 422

    def test_rejects_empty_model_name(self, client: TestClient) -> None:
        """Empty model name returns 422 validation error."""
        response = client.post(
            "/v1/chat/completions",
            json={
                "model": "",
                "messages": [{"role": "user", "content": "Hello"}],
            },
        )

        assert response.status_code == 422

    def test_rejects_whitespace_model_name(self, client: TestClient) -> None:
        """Whitespace-only model name returns 422 validation error."""
        response = client.post(
            "/v1/chat/completions",
            json={
                "model": "   ",
                "messages": [{"role": "user", "content": "Hello"}],
            },
        )

        assert response.status_code == 422

    def test_rejects_empty_ensemble(self, client: TestClient) -> None:
        """Empty ensemble array returns 422 validation error."""
        response = client.post(
            "/v1/chat/completions",
            json={
                "model": {
                    "ensemble": [],
                    "aggregation_method": "random",
                },
                "messages": [{"role": "user", "content": "Hello"}],
            },
        )

        assert response.status_code == 422

    def test_rejects_empty_model_in_ensemble_member(self, client: TestClient) -> None:
        """Ensemble member with empty model name returns 422 validation error."""
        response = client.post(
            "/v1/chat/completions",
            json={
                "model": {
                    "ensemble": [{"model": ""}],
                    "aggregation_method": "random",
                },
                "messages": [{"role": "user", "content": "Hello"}],
            },
        )

        assert response.status_code == 422

    def test_requires_aggregation_method(self, client: TestClient) -> None:
        """Ensemble model requires aggregation_method."""
        response = client.post(
            "/v1/chat/completions",
            json={
                "model": {
                    "ensemble": [{"model": "model1"}],
                },
                "messages": [{"role": "user", "content": "Hello"}],
            },
        )

        assert response.status_code == 422

    def test_nested_ensemble(self, client: TestClient) -> None:
        """Nested ensemble models are supported."""
        with patch("src.main.voting_completion") as mock_voting:
            mock_voting.return_value = (
                "Response",
                VotingDetails(winner_index=0, candidates=[]),
            )

            response = client.post(
                "/v1/chat/completions",
                json={
                    "model": {
                        "ensemble": [
                            {"model": "gpt-4o"},
                            {
                                "model": {
                                    "ensemble": [
                                        {"model": "claude-3-opus"},
                                        {"model": "claude-3-sonnet"},
                                    ],
                                    "aggregation_method": "random",
                                }
                            },
                        ],
                        "aggregation_method": "acceptance_voting",
                    },
                    "messages": [{"role": "user", "content": "Hello"}],
                },
            )

            assert response.status_code == 200


class TestTrioModelResolution:
    """Tests for trio: model reference resolution."""

    def test_resolves_trio_model_reference(self, client: TestClient) -> None:
        """trio: prefix resolves to ensemble config from YAML."""
        with patch("src.main.voting_completion") as mock_voting:
            mock_voting.return_value = (
                "Synthesized response",
                VotingDetails(winner_index=0, candidates=[]),
            )

            response = client.post(
                "/v1/chat/completions",
                json={
                    "model": "trio:zoom-in-zoom-out",
                    "messages": [{"role": "user", "content": "Hello"}],
                },
            )

            assert response.status_code == 200
            # Verify ensemble was resolved from YAML
            call_args = mock_voting.call_args
            ensemble = call_args[0][3]
            assert len(ensemble) == 2
            assert ensemble[0].model == "llama3.2:1b"
            assert "Zoom in" in ensemble[0].system_prompt
            assert ensemble[1].model == "llama3.2:1b"
            assert "Zoom out" in ensemble[1].system_prompt
            # Verify aggregation method
            assert call_args[0][6] == "synthesize"
            assert call_args[0][8] == "llama3.2:1b"  # synthesize_model

    def test_trio_model_not_found(self, client: TestClient) -> None:
        """Unknown trio: model returns 404."""
        response = client.post(
            "/v1/chat/completions",
            json={
                "model": "trio:nonexistent",
                "messages": [{"role": "user", "content": "Hello"}],
            },
        )

        assert response.status_code == 404
        assert "not found" in response.json()["detail"].lower()

    def test_resolves_nested_trio_model(self, client: TestClient) -> None:
        """trio: model with nested ensembles resolves correctly."""
        with patch("src.main.voting_completion") as mock_voting:
            mock_voting.return_value = (
                "Rumsfeld response",
                VotingDetails(winner_index=0, candidates=[]),
            )

            response = client.post(
                "/v1/chat/completions",
                json={
                    "model": "trio:rumsfeld",
                    "messages": [{"role": "user", "content": "Analyze this"}],
                },
            )

            assert response.status_code == 200
            # Verify nested ensemble structure
            call_args = mock_voting.call_args
            ensemble = call_args[0][3]
            assert len(ensemble) == 2
            # Each member should be a nested ensemble
            assert hasattr(ensemble[0], "model")
            assert hasattr(ensemble[1], "model")
