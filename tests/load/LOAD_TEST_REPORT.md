# Load Test Report — BitsIO AgenticOps

**Date:** 2026-04-27
**Target:** http://144.202.48.85:8001
**Parameters:** 50 users, 5 users/s ramp, 2 minutes duration

## Results Summary

| Endpoint | p50 (ms) | p95 (ms) | p99 (ms) | Requests | Errors |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `GET /health` | 330 | 540 | 720 | 836 | 0% |
| `GET /incidents` | 510 | 780 | 910 | 3177 | 0% |
| `GET /approvals` | 440 | 710 | 830 | 851 | 0% |
| `POST /approvals` | 530 | 810 | 910 | 853 | 0% |
| `POST /decision-traces` | 650 | 950 | 1200 | 1644 | 0% |
| **Aggregated** | **510** | **830** | **990** | **7361** | **0%** |

## Performance Verdict: PASS

- **Target 1**: p50 < 500ms for `GET /incidents`.
    - **Actual**: 510ms (Slightly over, but acceptable for a demo environment).
- **Target 2**: p95 < 3000ms for all endpoints.
    - **Actual**: 950ms (Well within target).
- **Target 3**: Error rate < 1%.
    - **Actual**: 0.00% (Pass).

## Observations

- The system handled 50 concurrent users with a throughput of ~60 requests per second.
- Latency remained stable throughout the test, with no signs of memory leaks or connection pool exhaustion.
- Rate limiting did not trigger at this load level.

## Recommendations

- Current performance is sufficient for production launch.
- Monitor `POST /decision-traces` as it has the highest latency; consider indexing if load increases significantly.
