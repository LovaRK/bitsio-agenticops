"""
Unit tests for AnthropicModelAdapter live API integration.
"""

from __future__ import annotations

from unittest.mock import MagicMock, patch

from agent_core.models.adapter import AnthropicModelAdapter, StubModelAdapter


def test_generate_returns_stub_when_no_api_key() -> None:
    """When ANTHROPIC_API_KEY is empty, adapter returns mock mode message."""
    adapter = AnthropicModelAdapter()
    adapter.api_key = ""  # Simulate missing key

    result = adapter.generate("test prompt")

    assert "mock mode" in result.lower()
    assert "no API key" in result


def test_generate_calls_anthropic_api() -> None:
    """When API key is set, adapter calls Claude API via httpx."""
    adapter = AnthropicModelAdapter(model_name="claude-haiku-4-5-20251001")
    adapter.api_key = "test-key"

    mock_response = MagicMock()
    mock_response.json.return_value = {
        "content": [{"text": "This is Claude's response"}],
    }

    with patch("agent_core.models.adapter.httpx.post", return_value=mock_response) as mock_post:
        result = adapter.generate("test prompt", temperature=0.5)

        assert result == "This is Claude's response"
        mock_post.assert_called_once()
        call_args = mock_post.call_args
        assert call_args[1]["headers"]["x-api-key"] == "test-key"
        assert call_args[1]["json"]["model"] == "claude-haiku-4-5-20251001"
        assert call_args[1]["json"]["temperature"] == 0.5


def test_generate_falls_back_on_api_error() -> None:
    """When API call fails, adapter returns fallback message."""
    adapter = AnthropicModelAdapter()
    adapter.api_key = "test-key"

    with patch("agent_core.models.adapter.httpx.post", side_effect=Exception("Network error")):
        result = adapter.generate("test prompt")

        assert "[fallback]" in result
        assert "Error" in result


def test_generate_handles_empty_content() -> None:
    """When API response has no content, adapter returns empty-response message."""
    adapter = AnthropicModelAdapter()
    adapter.api_key = "test-key"

    mock_response = MagicMock()
    mock_response.json.return_value = {"content": []}

    with patch("agent_core.models.adapter.httpx.post", return_value=mock_response):
        result = adapter.generate("test prompt")

        assert "[no-content]" in result


def test_stub_adapter_always_returns_stub() -> None:
    """StubModelAdapter always returns deterministic stub response."""
    adapter = StubModelAdapter()

    result1 = adapter.generate("first prompt")
    result2 = adapter.generate("second prompt")

    assert "stub:" in result1
    assert "stub:" in result2
    assert "first prompt" in result1
    assert "second prompt" in result2
