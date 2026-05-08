"""Integration tests: conversations, feedback, debug mode, batch analysis."""

from __future__ import annotations

import os

import pytest
from fastapi.testclient import TestClient

os.environ.setdefault("SPLUNK_LIVE_MODE", "false")

_H = {"x-api-key": "dev-analyst"}


@pytest.fixture()
def client() -> TestClient:
    from apps.api.app.main import create_app

    return TestClient(create_app())


# ── Conversations ─────────────────────────────────────────────────────────────

class TestConversations:
    def test_create_thread(self, client: TestClient) -> None:
        resp = client.post(
            "/api/v1/conversations",
            json={
                "thread_type": "incident",
                "artifact_type": "incident",
                "artifact_id": "inc_001",
                "title": "Test thread",
            },
            headers=_H,
        )
        assert resp.status_code == 201, resp.text
        data = resp.json()
        assert data["thread_id"]
        assert data["thread_type"] == "incident"
        assert data["message_count"] == 0

    def test_get_thread_not_found(self, client: TestClient) -> None:
        resp = client.get("/api/v1/conversations/nonexistent-id", headers=_H)
        assert resp.status_code == 404

    def test_list_threads_empty(self, client: TestClient) -> None:
        resp = client.get("/api/v1/conversations", headers=_H)
        assert resp.status_code == 200
        data = resp.json()
        assert "threads" in data
        assert "total" in data

    def test_create_and_retrieve_thread(self, client: TestClient) -> None:
        create_resp = client.post(
            "/api/v1/conversations",
            json={"thread_type": "fraud", "artifact_id": "fr_case_001"},
            headers=_H,
        )
        assert create_resp.status_code == 201
        thread_id = create_resp.json()["thread_id"]

        get_resp = client.get(f"/api/v1/conversations/{thread_id}", headers=_H)
        assert get_resp.status_code == 200
        data = get_resp.json()
        assert data["thread_id"] == thread_id
        assert "messages" in data
        assert isinstance(data["messages"], list)

    def test_add_assistant_message_relay(self, client: TestClient) -> None:
        """Relay mode: role=assistant stored without triggering model."""
        create_resp = client.post(
            "/api/v1/conversations",
            json={"thread_type": "general"},
            headers=_H,
        )
        thread_id = create_resp.json()["thread_id"]

        msg_resp = client.post(
            f"/api/v1/conversations/{thread_id}/messages",
            json={"role": "assistant", "content": "Direct assistant content"},
            headers=_H,
        )
        assert msg_resp.status_code == 200
        data = msg_resp.json()
        assert data["role"] == "assistant"
        assert data["content"] == "Direct assistant content"

    def test_add_message_invalid_thread(self, client: TestClient) -> None:
        resp = client.post(
            "/api/v1/conversations/does-not-exist/messages",
            json={"role": "user", "content": "Hello?"},
            headers=_H,
        )
        assert resp.status_code == 404

    def test_list_threads_filter_by_artifact(self, client: TestClient) -> None:
        client.post(
            "/api/v1/conversations",
            json={"thread_type": "incident", "artifact_type": "incident", "artifact_id": "filter_inc"},
            headers=_H,
        )
        client.post(
            "/api/v1/conversations",
            json={"thread_type": "fraud", "artifact_type": "fraud", "artifact_id": "other"},
            headers=_H,
        )
        resp = client.get("/api/v1/conversations?artifact_id=filter_inc", headers=_H)
        assert resp.status_code == 200
        threads = resp.json()["threads"]
        assert all(t["artifact_id"] == "filter_inc" for t in threads)


# ── Feedback ──────────────────────────────────────────────────────────────────

class TestFeedback:
    def test_submit_thumbs_up(self, client: TestClient) -> None:
        resp = client.post(
            "/api/v1/feedback",
            json={
                "target_type": "incident_analysis",
                "target_id": "inc_999",
                "rating": "thumbs_up",
            },
            headers=_H,
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["feedback_id"]
        assert data["rating"] == "thumbs_up"
        assert "message" in data

    def test_submit_thumbs_down_with_category(self, client: TestClient) -> None:
        resp = client.post(
            "/api/v1/feedback",
            json={
                "target_type": "fraud_analysis",
                "target_id": "fr_001",
                "rating": "thumbs_down",
                "category": "wrong_reasoning",
                "comment": "The risk explanation doesn't match the evidence.",
                "model_provider": "ollama",
                "model_name": "qwen2.5:7b",
            },
            headers=_H,
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["rating"] == "thumbs_down"

    def test_list_feedback_empty(self, client: TestClient) -> None:
        resp = client.get("/api/v1/feedback", headers=_H)
        assert resp.status_code == 200
        data = resp.json()
        assert "items" in data
        assert "total" in data

    def test_list_feedback_filter_by_target_type(self, client: TestClient) -> None:
        client.post(
            "/api/v1/feedback",
            json={"target_type": "message", "target_id": "m1", "rating": "thumbs_up"},
            headers=_H,
        )
        client.post(
            "/api/v1/feedback",
            json={"target_type": "fraud_analysis", "target_id": "f1", "rating": "thumbs_up"},
            headers=_H,
        )
        resp = client.get("/api/v1/feedback?target_type=message", headers=_H)
        assert resp.status_code == 200
        items = resp.json()["items"]
        assert all(i["target_type"] == "message" for i in items)

    def test_feedback_invalid_rating(self, client: TestClient) -> None:
        resp = client.post(
            "/api/v1/feedback",
            json={"target_type": "message", "target_id": "x", "rating": "meh"},
            headers=_H,
        )
        assert resp.status_code == 422


# ── Debug mode ────────────────────────────────────────────────────────────────

class TestDebugMode:
    def test_user_message_returns_assistant_response(self, client: TestClient) -> None:
        create_resp = client.post(
            "/api/v1/conversations",
            json={"thread_type": "general"},
            headers=_H,
        )
        thread_id = create_resp.json()["thread_id"]

        resp = client.post(
            f"/api/v1/conversations/{thread_id}/messages",
            json={"role": "user", "content": "What is this system?", "debug": False},
            headers=_H,
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["role"] == "assistant"
        assert data["debug_meta"] is None  # No debug when debug=false

    def test_debug_mode_includes_debug_meta(self, client: TestClient) -> None:
        create_resp = client.post(
            "/api/v1/conversations",
            json={"thread_type": "general"},
            headers=_H,
        )
        thread_id = create_resp.json()["thread_id"]

        resp = client.post(
            f"/api/v1/conversations/{thread_id}/messages",
            json={"role": "user", "content": "Explain your reasoning", "debug": True},
            headers=_H,
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["role"] == "assistant"
        assert data["debug_meta"] is not None
        dm = data["debug_meta"]
        assert "model_provider" in dm
        assert "runtime_mode" in dm
        assert "adapter_mode" in dm
        assert "prompt_template" in dm

    def test_token_meta_included_in_response(self, client: TestClient) -> None:
        create_resp = client.post(
            "/api/v1/conversations",
            json={"thread_type": "general"},
            headers=_H,
        )
        thread_id = create_resp.json()["thread_id"]

        resp = client.post(
            f"/api/v1/conversations/{thread_id}/messages",
            json={"role": "user", "content": "Token test"},
            headers=_H,
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["token_meta"] is not None
        tm = data["token_meta"]
        assert "input_tokens" in tm
        assert "output_tokens" in tm
        assert "total_tokens" in tm
        assert "estimated_cost_usd" in tm


# ── Batch Analysis ────────────────────────────────────────────────────────────

class TestBatchAnalysis:
    def test_batch_analyze_incidents(self, client: TestClient) -> None:
        resp = client.post(
            "/api/v1/incidents/analyze/batch",
            json={"incident_ids": ["inc_001", "inc_002", "inc_003"]},
            headers=_H,
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["total"] == 3
        assert data["batch_id"]
        assert len(data["items"]) == 3
        assert all(i["success"] for i in data["items"])
        assert data["token_summary"] is not None
        assert data["aggregate_summary"] is not None

    def test_batch_analyze_fraud_cases(self, client: TestClient) -> None:
        resp = client.post(
            "/api/v1/fraud/analyze/batch",
            json={"case_ids": ["fr_001", "fr_002"]},
            headers=_H,
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["total"] == 2
        assert data["succeeded"] == 2

    def test_batch_respects_max_size(self, client: TestClient) -> None:
        big_list = [f"inc_{i}" for i in range(60)]
        resp = client.post(
            "/api/v1/incidents/analyze/batch",
            json={"incident_ids": big_list},
            headers=_H,
        )
        assert resp.status_code == 422

    def test_batch_with_debug_returns_debug_summary(self, client: TestClient) -> None:
        resp = client.post(
            "/api/v1/incidents/analyze/batch",
            json={"incident_ids": ["inc_001"], "debug": True},
            headers=_H,
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["debug_summary"] is not None
        assert data["debug_summary"]["model_provider"] is not None

    def test_batch_token_summary_populated(self, client: TestClient) -> None:
        resp = client.post(
            "/api/v1/fraud/analyze/batch",
            json={"case_ids": ["fr_001", "fr_002", "fr_003"]},
            headers=_H,
        )
        assert resp.status_code == 200
        ts = resp.json()["token_summary"]
        assert ts["total_tokens"] > 0

    def test_batch_empty_list_rejected(self, client: TestClient) -> None:
        resp = client.post(
            "/api/v1/incidents/analyze/batch",
            json={"incident_ids": []},
            headers=_H,
        )
        assert resp.status_code == 422  # min_length=1 validator

    def test_batch_analyze_waste(self, client: TestClient) -> None:
        resp = client.post(
            "/api/v1/waste/analyze/batch",
            json={
                "analyses": [
                    {
                        "raw_index_profiles": [
                            {
                                "source_type": "cisco:asa",
                                "index": "netsec",
                                "daily_ingest_gb": 2.0,
                                "retention_days": 30,
                            }
                        ],
                        "raw_search_activity": [
                            {
                                "source_type": "cisco:asa",
                                "search_count_90d": 0,
                                "dashboard_references": 0,
                                "alert_references": 0,
                            }
                        ],
                        "raw_field_stats": [
                            {
                                "source_type": "cisco:asa",
                                "unused_fields": ["foo", "bar"],
                                "used_fields": ["host"],
                            }
                        ],
                        "tenant_id": "tenant_demo",
                        "environment": "dev",
                    }
                ],
                "debug": True,
            },
            headers=_H,
        )
        assert resp.status_code == 200, resp.text
        data = resp.json()
        assert data["total"] == 1
        assert data["succeeded"] == 1
        assert data["items"][0]["success"] is True
