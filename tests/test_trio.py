"""Tests for trio engine."""

import pytest
from unittest.mock import AsyncMock, patch

from src.llm import LLMError
from src.models import ChatMessage, TrioMember, TrioModel, TrioDetails
from src.trio_engine import trio_completion, _generate_member_response, _synthesize, TrioError
from src.config import Settings


class TestTrioCompletion:
    """Tests for the main trio_completion function."""

    @pytest.fixture
    def mock_client(self) -> AsyncMock:
        return AsyncMock()

    @pytest.fixture
    def settings(self) -> Settings:
        return Settings(trio_backend_url="http://test-backend:4000")

    async def test_generates_and_synthesizes(
        self, mock_client: AsyncMock, settings: Settings
    ) -> None:
        """Generates responses from A and B, then synthesizes with C."""
        with patch("src.trio_engine.fetch_completion") as mock_fetch:
            # A, B generate, then C synthesizes
            mock_fetch.side_effect = [
                "Response from model A",
                "Response from model B",
                "Synthesized response from C",
            ]

            trio = TrioModel(trio=[
                TrioMember(model="model-a"),
                TrioMember(model="model-b"),
                TrioMember(model="model-c"),
            ])
            messages = [ChatMessage(role="user", content="Hello")]

            result, details = await trio_completion(
                mock_client, settings, trio, messages
            )

            assert result == "Synthesized response from C"
            assert details.response_a == "Response from model A"
            assert details.response_b == "Response from model B"
            assert details.model_a == "model-a"
            assert details.model_b == "model-b"
            assert details.model_c == "model-c"

    async def test_handles_model_a_failure(
        self, mock_client: AsyncMock, settings: Settings
    ) -> None:
        """Returns B's response if A fails."""
        with patch("src.trio_engine.fetch_completion") as mock_fetch:
            mock_fetch.side_effect = [
                LLMError("Model A error"),
                "Response from B",
            ]

            trio = TrioModel(trio=[
                TrioMember(model="model-a"),
                TrioMember(model="model-b"),
                TrioMember(model="model-c"),
            ])
            messages = [ChatMessage(role="user", content="Hello")]

            result, details = await trio_completion(
                mock_client, settings, trio, messages
            )

            assert result == "Response from B"
            assert details.response_a == ""
            assert details.response_b == "Response from B"

    async def test_handles_model_b_failure(
        self, mock_client: AsyncMock, settings: Settings
    ) -> None:
        """Returns A's response if B fails."""
        with patch("src.trio_engine.fetch_completion") as mock_fetch:
            mock_fetch.side_effect = [
                "Response from A",
                LLMError("Model B error"),
            ]

            trio = TrioModel(trio=[
                TrioMember(model="model-a"),
                TrioMember(model="model-b"),
                TrioMember(model="model-c"),
            ])
            messages = [ChatMessage(role="user", content="Hello")]

            result, details = await trio_completion(
                mock_client, settings, trio, messages
            )

            assert result == "Response from A"
            assert details.response_a == "Response from A"
            assert details.response_b == ""

    async def test_handles_both_failures(
        self, mock_client: AsyncMock, settings: Settings
    ) -> None:
        """Raises TrioError if both A and B fail."""
        with patch("src.trio_engine.fetch_completion") as mock_fetch:
            mock_fetch.side_effect = LLMError("Backend unavailable", status_code=502)

            trio = TrioModel(trio=[
                TrioMember(model="model-a"),
                TrioMember(model="model-b"),
                TrioMember(model="model-c"),
            ])
            messages = [ChatMessage(role="user", content="Hello")]

            with pytest.raises(TrioError) as exc_info:
                await trio_completion(mock_client, settings, trio, messages)

            assert "all models failed" in exc_info.value.message.lower()
            assert exc_info.value.status_code == 502

    async def test_handles_synthesis_failure(
        self, mock_client: AsyncMock, settings: Settings
    ) -> None:
        """Falls back to A's response if synthesis fails."""
        with patch("src.trio_engine.fetch_completion") as mock_fetch:
            mock_fetch.side_effect = [
                "Response from A",
                "Response from B",
                LLMError("Synthesis model error"),  # Synthesis fails
            ]

            trio = TrioModel(trio=[
                TrioMember(model="model-a"),
                TrioMember(model="model-b"),
                TrioMember(model="model-c"),
            ])
            messages = [ChatMessage(role="user", content="Hello")]

            result, details = await trio_completion(
                mock_client, settings, trio, messages
            )

            # Falls back to A's response
            assert result == "Response from A"
            assert details.response_a == "Response from A"
            assert details.response_b == "Response from B"


class TestMessageMerging:
    """Tests for message merging behavior."""

    @pytest.fixture
    def mock_client(self) -> AsyncMock:
        return AsyncMock()

    @pytest.fixture
    def settings(self) -> Settings:
        return Settings(trio_backend_url="http://test-backend:4000")

    async def test_member_messages_prepended(
        self, mock_client: AsyncMock, settings: Settings
    ) -> None:
        """Member messages are prepended to request messages."""
        with patch("src.trio_engine.fetch_completion") as mock_fetch:
            mock_fetch.return_value = "Response"

            trio = TrioModel(trio=[
                TrioMember(
                    model="model-a",
                    messages=[ChatMessage(role="system", content="Be concise")],
                ),
                TrioMember(
                    model="model-b",
                    messages=[ChatMessage(role="system", content="Be detailed")],
                ),
                TrioMember(model="model-c"),
            ])
            messages = [ChatMessage(role="user", content="Hello")]

            await trio_completion(mock_client, settings, trio, messages)

            # Check the messages passed to model A
            call_args_a = mock_fetch.call_args_list[0]
            messages_a = call_args_a[0][3]  # 4th positional arg is messages
            assert messages_a[0].role == "system"
            assert messages_a[0].content == "Be concise"
            assert messages_a[1].role == "user"
            assert messages_a[1].content == "Hello"

            # Check the messages passed to model B
            call_args_b = mock_fetch.call_args_list[1]
            messages_b = call_args_b[0][3]
            assert messages_b[0].role == "system"
            assert messages_b[0].content == "Be detailed"
            assert messages_b[1].role == "user"
            assert messages_b[1].content == "Hello"

    async def test_no_member_messages(
        self, mock_client: AsyncMock, settings: Settings
    ) -> None:
        """Members without messages just get request messages."""
        with patch("src.trio_engine.fetch_completion") as mock_fetch:
            mock_fetch.return_value = "Response"

            trio = TrioModel(trio=[
                TrioMember(model="model-a"),
                TrioMember(model="model-b"),
                TrioMember(model="model-c"),
            ])
            messages = [ChatMessage(role="user", content="Hello")]

            await trio_completion(mock_client, settings, trio, messages)

            # Check the messages passed to model A
            call_args_a = mock_fetch.call_args_list[0]
            messages_a = call_args_a[0][3]
            assert len(messages_a) == 1
            assert messages_a[0].role == "user"
            assert messages_a[0].content == "Hello"


class TestNestedTrio:
    """Tests for nested trio handling."""

    @pytest.fixture
    def mock_client(self) -> AsyncMock:
        return AsyncMock()

    @pytest.fixture
    def settings(self) -> Settings:
        return Settings(trio_backend_url="http://test-backend:4000")

    async def test_nested_trio_in_position_a(
        self, mock_client: AsyncMock, settings: Settings
    ) -> None:
        """Nested trio in position A is recursively evaluated."""
        with patch("src.trio_engine.fetch_completion") as mock_fetch:
            # Nested trio: a1, a2, a3 (3 calls)
            # Outer: nested result, b, c (2 calls + synthesis)
            mock_fetch.side_effect = [
                "Response from nested A1",
                "Response from nested A2",
                "Synthesized from nested trio",  # nested synthesis
                "Response from B",
                "Final synthesized response",  # outer synthesis
            ]

            nested_trio = TrioModel(trio=[
                TrioMember(model="nested-a1"),
                TrioMember(model="nested-a2"),
                TrioMember(model="nested-a3"),
            ])

            trio = TrioModel(trio=[
                TrioMember(model=nested_trio),
                TrioMember(model="model-b"),
                TrioMember(model="model-c"),
            ])
            messages = [ChatMessage(role="user", content="Hello")]

            result, details = await trio_completion(
                mock_client, settings, trio, messages
            )

            assert result == "Final synthesized response"
            assert details.model_a == "trio"  # Nested trio
            assert details.model_b == "model-b"
            assert details.model_c == "model-c"


class TestGenerateMemberResponse:
    """Tests for _generate_member_response function."""

    @pytest.fixture
    def mock_client(self) -> AsyncMock:
        return AsyncMock()

    @pytest.fixture
    def settings(self) -> Settings:
        return Settings(trio_backend_url="http://test-backend:4000")

    async def test_simple_model(
        self, mock_client: AsyncMock, settings: Settings
    ) -> None:
        """Simple string model calls fetch_completion."""
        with patch("src.trio_engine.fetch_completion") as mock_fetch:
            mock_fetch.return_value = "Response"

            member = TrioMember(model="test-model")
            messages = [ChatMessage(role="user", content="Hello")]

            name, response, error = await _generate_member_response(
                mock_client, settings, member, messages, 500, 0.7
            )

            assert name == "test-model"
            assert response == "Response"
            assert error is None
            mock_fetch.assert_called_once()

    async def test_handles_failure(
        self, mock_client: AsyncMock, settings: Settings
    ) -> None:
        """Returns None response with error message on fetch failure."""
        with patch("src.trio_engine.fetch_completion") as mock_fetch:
            mock_fetch.side_effect = LLMError("Connection refused")

            member = TrioMember(model="test-model")
            messages = [ChatMessage(role="user", content="Hello")]

            name, response, error = await _generate_member_response(
                mock_client, settings, member, messages, 500, 0.7
            )

            assert name == "test-model"
            assert response is None
            assert error == "Connection refused"
