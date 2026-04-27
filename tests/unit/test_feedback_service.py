"""Unit tests for InMemoryFeedbackStore."""

from __future__ import annotations

import pytest

from apps.api.app.services.feedback_service import InMemoryFeedbackStore


@pytest.fixture()
def store() -> InMemoryFeedbackStore:
    return InMemoryFeedbackStore()


class TestSaveFeedback:
    async def test_saves_thumbs_up(self, store: InMemoryFeedbackStore) -> None:
        fb = await store.save_feedback(
            target_type="message",
            target_id="msg_001",
            rating="thumbs_up",
        )
        assert fb.feedback_id
        assert fb.rating == "thumbs_up"
        assert fb.target_type == "message"
        assert fb.target_id == "msg_001"
        assert fb.created_at is not None

    async def test_saves_thumbs_down_with_category(self, store: InMemoryFeedbackStore) -> None:
        fb = await store.save_feedback(
            target_type="fraud_analysis",
            target_id="fr_case_001",
            rating="thumbs_down",
            category="wrong_reasoning",
            comment="The risk score seems too high.",
        )
        assert fb.rating == "thumbs_down"
        assert fb.category == "wrong_reasoning"
        assert fb.comment == "The risk score seems too high."

    async def test_saves_with_model_metadata(self, store: InMemoryFeedbackStore) -> None:
        fb = await store.save_feedback(
            target_type="incident_analysis",
            target_id="inc_007",
            rating="thumbs_up",
            model_provider="ollama",
            model_name="qwen2.5:7b",
            artifact_type="incident",
            artifact_id="inc_007",
        )
        assert fb.model_provider == "ollama"
        assert fb.model_name == "qwen2.5:7b"
        assert fb.artifact_id == "inc_007"

    async def test_defaults_anonymous_user(self, store: InMemoryFeedbackStore) -> None:
        fb = await store.save_feedback(
            target_type="message", target_id="x", rating="thumbs_up"
        )
        assert fb.user_id == "anonymous"

    async def test_generates_unique_ids(self, store: InMemoryFeedbackStore) -> None:
        fb1 = await store.save_feedback(target_type="message", target_id="x", rating="thumbs_up")
        fb2 = await store.save_feedback(target_type="message", target_id="y", rating="thumbs_down")
        assert fb1.feedback_id != fb2.feedback_id


class TestListFeedback:
    async def test_lists_all(self, store: InMemoryFeedbackStore) -> None:
        for i in range(3):
            await store.save_feedback(
                target_type="message", target_id=f"msg_{i}", rating="thumbs_up"
            )
        items = await store.list_feedback()
        assert len(items) == 3

    async def test_filters_by_target_type(self, store: InMemoryFeedbackStore) -> None:
        await store.save_feedback(target_type="message", target_id="m1", rating="thumbs_up")
        await store.save_feedback(target_type="fraud_analysis", target_id="f1", rating="thumbs_down")
        items = await store.list_feedback(target_type="message")
        assert len(items) == 1
        assert items[0].target_type == "message"

    async def test_filters_by_target_id(self, store: InMemoryFeedbackStore) -> None:
        await store.save_feedback(target_type="message", target_id="specific", rating="thumbs_up")
        await store.save_feedback(target_type="message", target_id="other", rating="thumbs_down")
        items = await store.list_feedback(target_id="specific")
        assert len(items) == 1
        assert items[0].target_id == "specific"

    async def test_most_recent_first(self, store: InMemoryFeedbackStore) -> None:
        for i in range(3):
            await store.save_feedback(
                target_type="message", target_id=f"msg_{i}", rating="thumbs_up"
            )
        items = await store.list_feedback()
        # Last inserted should be first (most recent)
        assert items[0].target_id == "msg_2"

    async def test_respects_limit(self, store: InMemoryFeedbackStore) -> None:
        for i in range(10):
            await store.save_feedback(target_type="message", target_id=f"m{i}", rating="thumbs_up")
        items = await store.list_feedback(limit=5)
        assert len(items) == 5
