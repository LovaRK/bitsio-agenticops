from __future__ import annotations

from decision_tracing.hashing import canonical_json, sha256_hex


def test_canonical_json_is_deterministic() -> None:
    payload_a = {"b": 2, "a": 1}
    payload_b = {"a": 1, "b": 2}

    assert canonical_json(payload_a) == canonical_json(payload_b)


def test_sha256_hex_is_deterministic() -> None:
    payload = {"foo": "bar", "count": 3}
    first = sha256_hex(payload)
    second = sha256_hex(payload)
    assert first == second
    assert len(first) == 64
