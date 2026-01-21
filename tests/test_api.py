"""Tests for API endpoints."""

import json
import pytest
from unittest.mock import patch, AsyncMock

from fastapi.testclient import TestClient

from src.main import app
from src.models import TrioDetails


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

    def test_trio_request_returns_openai_format(self, client: TestClient) -> None:
        """Trio response matches OpenAI chat completion format."""
        with patch("src.main.trio_completion") as mock_trio:
            mock_trio.return_value = (
                "Synthesized response",
                TrioDetails(
                    response_a="Response A",
                    response_b="Response B",
                    model_a="model-a",
                    model_b="model-b",
                    model_c="model-c",
                ),
            )

            response = client.post(
                "/v1/chat/completions",
                json={
                    "model": {
                        "trio": [
                            {"model": "model-a"},
                            {"model": "model-b"},
                            {"model": "model-c"},
                        ]
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
            assert data["choices"][0]["message"]["content"] == "Synthesized response"
            assert data["choices"][0]["finish_reason"] == "stop"

    def test_includes_trio_details_header(self, client: TestClient) -> None:
        """X-Trio-Details header contains trio execution information."""
        with patch("src.main.trio_completion") as mock_trio:
            mock_trio.return_value = (
                "Synthesized",
                TrioDetails(
                    response_a="Response from A",
                    response_b="Response from B",
                    model_a="model-a",
                    model_b="model-b",
                    model_c="model-c",
                ),
            )

            response = client.post(
                "/v1/chat/completions",
                json={
                    "model": {
                        "trio": [
                            {"model": "model-a"},
                            {"model": "model-b"},
                            {"model": "model-c"},
                        ]
                    },
                    "messages": [{"role": "user", "content": "Hello"}],
                },
            )

            assert "X-Trio-Details" in response.headers
            details = json.loads(response.headers["X-Trio-Details"])
            assert details["model_a"] == "model-a"
            assert details["model_b"] == "model-b"
            assert details["model_c"] == "model-c"
            assert details["response_a"] == "Response from A"
            assert details["response_b"] == "Response from B"

    def test_trio_with_custom_messages(self, client: TestClient) -> None:
        """Trio members can have custom messages (for system prompts, etc.)."""
        with patch("src.main.trio_completion") as mock_trio:
            mock_trio.return_value = (
                "Response",
                TrioDetails(
                    response_a="A", response_b="B",
                    model_a="a", model_b="b", model_c="c",
                ),
            )

            response = client.post(
                "/v1/chat/completions",
                json={
                    "model": {
                        "trio": [
                            {
                                "model": "model-a",
                                "messages": [{"role": "system", "content": "Be concise"}],
                            },
                            {
                                "model": "model-b",
                                "messages": [{"role": "system", "content": "Be detailed"}],
                            },
                            {"model": "model-c"},
                        ]
                    },
                    "messages": [{"role": "user", "content": "Hello"}],
                },
            )

            assert response.status_code == 200
            # Verify the trio model was passed correctly
            call_args = mock_trio.call_args
            trio_model = call_args[0][2]  # Third positional arg is the TrioModel
            assert trio_model.trio[0].messages[0].content == "Be concise"
            assert trio_model.trio[1].messages[0].content == "Be detailed"
            assert trio_model.trio[2].messages is None

    def test_passthrough_mode_with_string_model(self, client: TestClient) -> None:
        """String model name triggers pass-through mode."""
        with patch("src.main.fetch_completion") as mock_fetch:
            mock_fetch.return_value = "Direct response"

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
            assert data["choices"][0]["message"]["content"] == "Direct response"
            # Should NOT have X-Trio-Details header (pass-through mode)
            assert "X-Trio-Details" not in response.headers

    def test_passthrough_mode_handles_failure(self, client: TestClient) -> None:
        """Pass-through mode returns error status on backend failure."""
        from src.llm import LLMError

        with patch("src.main.fetch_completion") as mock_fetch:
            mock_fetch.side_effect = LLMError("Model not found", status_code=404)

            response = client.post(
                "/v1/chat/completions",
                json={
                    "model": "mistral",
                    "messages": [{"role": "user", "content": "Hello"}],
                },
            )

            assert response.status_code == 404
            assert "not found" in response.json()["detail"].lower()

    def test_streaming_returns_501(self, client: TestClient) -> None:
        """Streaming requests return 501 Not Implemented."""
        response = client.post(
            "/v1/chat/completions",
            json={
                "model": {
                    "trio": [
                        {"model": "a"},
                        {"model": "b"},
                        {"model": "c"},
                    ]
                },
                "messages": [{"role": "user", "content": "Hello"}],
                "stream": True,
            },
        )

        assert response.status_code == 501
        assert "not supported" in response.json()["detail"].lower()


class TestTrioValidation:
    """Tests for trio model validation."""

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

    def test_rejects_trio_with_wrong_member_count(self, client: TestClient) -> None:
        """Trio must have exactly 3 members."""
        # Too few members
        response = client.post(
            "/v1/chat/completions",
            json={
                "model": {
                    "trio": [
                        {"model": "model-a"},
                        {"model": "model-b"},
                    ]
                },
                "messages": [{"role": "user", "content": "Hello"}],
            },
        )
        assert response.status_code == 422

        # Too many members
        response = client.post(
            "/v1/chat/completions",
            json={
                "model": {
                    "trio": [
                        {"model": "model-a"},
                        {"model": "model-b"},
                        {"model": "model-c"},
                        {"model": "model-d"},
                    ]
                },
                "messages": [{"role": "user", "content": "Hello"}],
            },
        )
        assert response.status_code == 422

    def test_rejects_empty_model_in_trio_member(self, client: TestClient) -> None:
        """Trio member with empty model name returns 422 validation error."""
        response = client.post(
            "/v1/chat/completions",
            json={
                "model": {
                    "trio": [
                        {"model": ""},
                        {"model": "model-b"},
                        {"model": "model-c"},
                    ]
                },
                "messages": [{"role": "user", "content": "Hello"}],
            },
        )

        assert response.status_code == 422

    def test_validates_message_format(self, client: TestClient) -> None:
        """Rejects invalid message format."""
        response = client.post(
            "/v1/chat/completions",
            json={
                "model": {
                    "trio": [
                        {"model": "a"},
                        {"model": "b"},
                        {"model": "c"},
                    ]
                },
                "messages": [{"invalid": "format"}],
            },
        )

        assert response.status_code == 422

    def test_requires_messages(self, client: TestClient) -> None:
        """Messages field is required."""
        response = client.post(
            "/v1/chat/completions",
            json={
                "model": {
                    "trio": [
                        {"model": "a"},
                        {"model": "b"},
                        {"model": "c"},
                    ]
                },
            },
        )

        assert response.status_code == 422


class TestNestedTrio:
    """Tests for nested trio configurations."""

    def test_nested_trio_accepted(self, client: TestClient) -> None:
        """Nested trio models are supported."""
        with patch("src.main.trio_completion") as mock_trio:
            mock_trio.return_value = (
                "Response",
                TrioDetails(
                    response_a="A", response_b="B",
                    model_a="trio", model_b="b", model_c="c",
                ),
            )

            response = client.post(
                "/v1/chat/completions",
                json={
                    "model": {
                        "trio": [
                            {
                                "model": {
                                    "trio": [
                                        {"model": "nested-a"},
                                        {"model": "nested-b"},
                                        {"model": "nested-c"},
                                    ]
                                }
                            },
                            {"model": "model-b"},
                            {"model": "model-c"},
                        ]
                    },
                    "messages": [{"role": "user", "content": "Hello"}],
                },
            )

            assert response.status_code == 200
