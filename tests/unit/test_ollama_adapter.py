from __future__ import annotations

from unittest.mock import MagicMock, patch

from agent_core.models.adapter import OllamaModelAdapter, resolve_model_adapter


@patch("agent_core.models.adapter.httpx.post")
def test_ollama_adapter_generate_success(mock_post: MagicMock) -> None:
    mock_response = MagicMock()
    mock_response.json.return_value = {"response": "local model answer"}
    mock_response.raise_for_status.return_value = None
    mock_post.return_value = mock_response

    adapter = OllamaModelAdapter(model_name="qwen2.5:14b", base_url="http://127.0.0.1:11434")
    output = adapter.generate("hello")
    assert output == "local model answer"


@patch("agent_core.models.adapter.httpx.post")
def test_ollama_adapter_generate_fallback_on_error(mock_post: MagicMock) -> None:
    mock_post.side_effect = RuntimeError("ollama unavailable")
    adapter = OllamaModelAdapter(model_name="qwen2.5:14b", base_url="http://127.0.0.1:11434")
    output = adapter.generate("hello")
    assert output.startswith("[fallback] Error:")


def test_resolve_model_adapter_ollama(monkeypatch) -> None:
    monkeypatch.setenv("MODEL_PROVIDER", "ollama")
    adapter = resolve_model_adapter()
    assert isinstance(adapter, OllamaModelAdapter)
