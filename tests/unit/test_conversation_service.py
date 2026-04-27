"""Unit tests for InMemoryConversationStore."""

from __future__ import annotations

import pytest

from apps.api.app.services.conversation_service import InMemoryConversationStore
from decision_tracing.conversation_models import DebugMeta, TokenMeta


@pytest.fixture()
def store() -> InMemoryConversationStore:
    return InMemoryConversationStore()


class TestCreateThread:
    async def test_creates_thread_with_id(self, store: InMemoryConversationStore) -> None:
        thread = await store.create_thread(
            thread_type="incident",
            artifact_type="incident",
            artifact_id="inc_001",
            title="Test Thread",
            created_by="analyst1",
        )
        assert thread.thread_id
        assert thread.thread_type == "incident"
        assert thread.artifact_id == "inc_001"
        assert thread.message_count == 0

    async def test_creates_thread_without_artifact(self, store: InMemoryConversationStore) -> None:
        thread = await store.create_thread(
            thread_type="general",
            artifact_type=None,
            artifact_id=None,
            title=None,
            created_by="system",
        )
        assert thread.artifact_id is None

    async def test_multiple_threads_distinct_ids(self, store: InMemoryConversationStore) -> None:
        t1 = await store.create_thread(
            thread_type="fraud", artifact_type=None, artifact_id=None, title=None, created_by="u"
        )
        t2 = await store.create_thread(
            thread_type="fraud", artifact_type=None, artifact_id=None, title=None, created_by="u"
        )
        assert t1.thread_id != t2.thread_id


class TestGetThread:
    async def test_get_existing_thread(self, store: InMemoryConversationStore) -> None:
        thread = await store.create_thread(
            thread_type="telemetry", artifact_type=None, artifact_id=None, title=None, created_by="u"
        )
        fetched = await store.get_thread(thread.thread_id)
        assert fetched is not None
        assert fetched.thread_id == thread.thread_id

    async def test_get_missing_thread_returns_none(self, store: InMemoryConversationStore) -> None:
        result = await store.get_thread("nonexistent-id")
        assert result is None


class TestListThreads:
    async def test_lists_all_threads(self, store: InMemoryConversationStore) -> None:
        for _ in range(3):
            await store.create_thread(
                thread_type="general", artifact_type=None, artifact_id=None, title=None, created_by="u"
            )
        threads = await store.list_threads()
        assert len(threads) == 3

    async def test_filters_by_artifact_id(self, store: InMemoryConversationStore) -> None:
        await store.create_thread(
            thread_type="incident", artifact_type="incident", artifact_id="inc_A",
            title=None, created_by="u"
        )
        await store.create_thread(
            thread_type="incident", artifact_type="incident", artifact_id="inc_B",
            title=None, created_by="u"
        )
        threads = await store.list_threads(artifact_id="inc_A")
        assert len(threads) == 1
        assert threads[0].artifact_id == "inc_A"

    async def test_respects_limit(self, store: InMemoryConversationStore) -> None:
        for _ in range(10):
            await store.create_thread(
                thread_type="general", artifact_type=None, artifact_id=None, title=None, created_by="u"
            )
        threads = await store.list_threads(limit=3)
        assert len(threads) == 3


class TestAddMessage:
    async def test_add_user_message(self, store: InMemoryConversationStore) -> None:
        thread = await store.create_thread(
            thread_type="fraud", artifact_type=None, artifact_id=None, title=None, created_by="u"
        )
        msg = await store.add_message(
            thread_id=thread.thread_id,
            role="user",
            content="Why is this case high risk?",
        )
        assert msg.role == "user"
        assert msg.content == "Why is this case high risk?"
        assert msg.thread_id == thread.thread_id

    async def test_add_message_updates_thread_count(self, store: InMemoryConversationStore) -> None:
        thread = await store.create_thread(
            thread_type="fraud", artifact_type=None, artifact_id=None, title=None, created_by="u"
        )
        await store.add_message(thread_id=thread.thread_id, role="user", content="Q1")
        await store.add_message(thread_id=thread.thread_id, role="assistant", content="A1")
        updated = await store.get_thread(thread.thread_id)
        assert updated is not None
        assert updated.message_count == 2

    async def test_add_message_with_token_meta(self, store: InMemoryConversationStore) -> None:
        thread = await store.create_thread(
            thread_type="general", artifact_type=None, artifact_id=None, title=None, created_by="u"
        )
        tm = TokenMeta(
            input_tokens=100,
            output_tokens=50,
            total_tokens=150,
            estimated_cost_usd=0.0,
            cost_source="derived",
        )
        msg = await store.add_message(
            thread_id=thread.thread_id,
            role="assistant",
            content="Response",
            token_meta=tm,
        )
        assert msg.token_meta is not None
        assert msg.token_meta.total_tokens == 150

    async def test_add_message_with_debug_meta(self, store: InMemoryConversationStore) -> None:
        thread = await store.create_thread(
            thread_type="general", artifact_type=None, artifact_id=None, title=None, created_by="u"
        )
        dm = DebugMeta(model_provider="ollama", fallback_used=False)
        msg = await store.add_message(
            thread_id=thread.thread_id,
            role="assistant",
            content="Debug response",
            debug_meta=dm,
        )
        assert msg.debug_meta is not None
        assert msg.debug_meta.model_provider == "ollama"

    async def test_add_message_raises_for_missing_thread(
        self, store: InMemoryConversationStore
    ) -> None:
        with pytest.raises(ValueError, match="not found"):
            await store.add_message(
                thread_id="missing", role="user", content="Hello"
            )


class TestGetThreadWithMessages:
    async def test_returns_messages_and_totals(self, store: InMemoryConversationStore) -> None:
        thread = await store.create_thread(
            thread_type="telemetry", artifact_type=None, artifact_id=None, title=None, created_by="u"
        )
        tm1 = TokenMeta(input_tokens=100, output_tokens=50, total_tokens=150,
                        estimated_cost_usd=0.0, cost_source="derived")
        tm2 = TokenMeta(input_tokens=200, output_tokens=80, total_tokens=280,
                        estimated_cost_usd=0.0, cost_source="derived")
        await store.add_message(thread_id=thread.thread_id, role="user", content="Q")
        await store.add_message(thread_id=thread.thread_id, role="assistant", content="A1",
                                token_meta=tm1)
        await store.add_message(thread_id=thread.thread_id, role="assistant", content="A2",
                                token_meta=tm2)

        full = await store.get_thread_with_messages(thread.thread_id)
        assert full is not None
        assert len(full.messages) == 3
        assert full.token_totals is not None
        assert full.token_totals.input_tokens == 300
        assert full.token_totals.output_tokens == 130

    async def test_returns_none_for_missing_thread(self, store: InMemoryConversationStore) -> None:
        result = await store.get_thread_with_messages("does-not-exist")
        assert result is None
