from __future__ import annotations

import random
import time
from collections.abc import Callable
from typing import TypeVar

T = TypeVar("T")
RETRYABLE_STATUS_CODES = {429, 503, 504}


def with_retry(call: Callable[[], T], *, max_retries: int = 3, initial_wait: float = 1.0) -> T:
    attempt = 0
    wait = initial_wait

    while True:
        try:
            return call()
        except Exception as exc:  # noqa: BLE001
            status_code = getattr(exc, "response", None)
            status_value = getattr(status_code, "status_code", None)

            if status_value not in RETRYABLE_STATUS_CODES or attempt >= max_retries:
                raise

            jitter = random.uniform(0, 0.5)
            time.sleep(wait + jitter)
            wait *= 2
            attempt += 1
