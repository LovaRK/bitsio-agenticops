from __future__ import annotations

import hashlib
import json
from datetime import UTC, datetime
from typing import Any

EPHEMERAL_FIELDS = {"created_at", "updated_at", "latency_ms"}


def _normalize(obj: Any) -> Any:
    if isinstance(obj, dict):
        normalized: dict[str, Any] = {}
        for key in sorted(obj.keys()):
            if key in EPHEMERAL_FIELDS:
                continue
            normalized[key] = _normalize(obj[key])
        return normalized

    if isinstance(obj, list):
        return [_normalize(item) for item in obj]

    if isinstance(obj, datetime):
        return obj.astimezone(UTC).replace(microsecond=0).isoformat().replace("+00:00", "Z")

    return obj


def canonical_json(obj: Any) -> str:
    normalized = _normalize(obj)
    return json.dumps(normalized, sort_keys=True, separators=(",", ":"), ensure_ascii=True)


def sha256_hex(obj: Any) -> str:
    return hashlib.sha256(canonical_json(obj).encode("utf-8")).hexdigest()


hash_content = sha256_hex
