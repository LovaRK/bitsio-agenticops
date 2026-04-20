# Load Testing Guide — Phase 8 Hardening

**Version**: 1.0  
**Status**: Ready to Execute  
**Tool**: Locust (Python-based, distributed load testing)

---

## Quick Start

```bash
# 1. Ensure live mode is set up
cd /Users/ramakrishna/Desktop/OfficeWork/bitsio-agenticops
make tunnel-start          # Terminal A: SSH tunnel

# 2. Start Docker stack (Terminal B)
make dev

# 3. Run load tests (Terminal C)
make load-test

# 4. View report
open reports/load_test_report.html
```

---

## What We're Testing

### Objectives

1. **Performance Under Load**: API maintains acceptable latency (p95 <500ms)
2. **Rate Limiter Accuracy**: Correctly rejects excess requests (429 responses)
3. **Memory Stability**: No memory leaks during sustained load
4. **Service Resilience**: All 7 Docker services remain healthy
5. **Splunk Adapter**: Live MCP queries handle concurrent load

### Load Scenarios

#### Scenario 1: Baseline (10 concurrent users, 5 min)
- **Purpose**: Establish baseline performance
- **Traffic Mix**: 70% incident list, 20% decision trace, 10% approvals
- **Expected**: p95 latency <300ms, zero 5xx errors

#### Scenario 2: Ramp (100 concurrent users, 10 min ramp)
- **Purpose**: Test scaling behavior
- **Ramp**: 10 users/min → 100 users
- **Expected**: Sustained <500ms p95, <1% error rate

#### Scenario 3: Peak (200 concurrent users, 5 min sustained)
- **Purpose**: Test breaking point
- **Expected**: p95 latency <800ms, rate limiter active
- **Acceptable Loss**: Up to 5% 429 (rate limit) responses

#### Scenario 4: Soak (50 concurrent users, 1 hour)
- **Purpose**: Detect memory leaks & connection leaks
- **Expected**: Zero memory growth >50MB/hour

---

## Test Harness Architecture

### Locustfile Structure

```
tests/load/
├── locustfile.py                 # Main Locust config
├── scenarios/
│   ├── baseline.py              # Scenario 1: 10 users, 5 min
│   ├── ramp.py                  # Scenario 2: ramp to 100
│   ├── peak.py                  # Scenario 3: 200 users spike
│   └── soak.py                  # Scenario 4: 1-hour soak
├── tasks/
│   ├── incident_list.py         # GET /api/v1/incidents
│   ├── decision_trace.py        # GET + POST decision traces
│   └── approval_flow.py         # POST approvals
└── utils/
    ├── metrics.py               # Custom metric collection
    └── auth.py                  # Dev API key handling
```

### Key Metrics Collected

```python
# Built-in Locust metrics
- requests_per_second (RPS)
- response_time_avg, p50, p95, p99
- requests_by_status (200, 401, 429, 502, etc.)
- failure_rate

# Custom metrics
- splunk_query_time_ms
- rate_limit_hit_count
- memory_usage_mb
- connection_pool_size
```

---

## Running Individual Scenarios

### Scenario 1: Baseline

```bash
# Run baseline scenario (10 concurrent users, 5 minutes)
cd tests/load

locust -f scenarios/baseline.py \
  --host http://localhost:8001 \
  --users 10 \
  --spawn-rate 1 \
  --run-time 5m \
  --headless \
  --csv=reports/baseline

# Expected output:
# Type     | Name                      | # reqs | # fails | Avg | Min | Max | Median | req/s
# GET      | /api/v1/incidents         | 500    | 0       | 120 | 80  | 250 | 110    | 1.67
# GET      | /api/v1/decision-traces/* | 150    | 0       | 220 | 150 | 380 | 200    | 0.50
# POST     | /api/v1/decision-traces/* | 50     | 0       | 310 | 280 | 450 | 300    | 0.17
```

### Scenario 2: Ramp (10 → 100 users)

```bash
locust -f scenarios/ramp.py \
  --host http://localhost:8001 \
  --users 100 \
  --spawn-rate 10 \
  --run-time 10m \
  --headless \
  --csv=reports/ramp

# Monitor API logs in parallel (Terminal D)
docker compose logs -f api | grep duration_ms
# Watch for p95 duration growth as users increase
```

### Scenario 3: Peak Spike (200 users)

```bash
locust -f scenarios/peak.py \
  --host http://localhost:8001 \
  --users 200 \
  --spawn-rate 20 \
  --run-time 5m \
  --headless \
  --csv=reports/peak

# Expected rate limiter activity (429 responses)
# This tests graceful degradation under peak load
```

### Scenario 4: Soak Test (1 hour)

```bash
# RUN IN BACKGROUND (overnight or lunch break)
nohup locust -f scenarios/soak.py \
  --host http://localhost:8001 \
  --users 50 \
  --spawn-rate 5 \
  --run-time 1h \
  --headless \
  --csv=reports/soak > reports/soak.log 2>&1 &

# Monitor memory usage
# In separate terminal:
watch -n 5 'docker stats --no-stream api web'

# Expected: Memory growth <50MB/hour
# Kill after 1 hour:
pkill -f "locust.*soak"
```

---

## Pass/Fail Criteria

### Performance Gates

| Metric | Target | Fail Threshold |
|--------|--------|---|
| p50 latency (read) | <200ms | >300ms |
| p95 latency (read) | <400ms | >600ms |
| p99 latency (read) | <600ms | >1000ms |
| p95 latency (write) | <500ms | >800ms |
| Failure rate | <0.5% | >2% |
| 5xx error rate | 0% | >0.1% |
| 429 error rate (peak scenario) | <10% | >20% |

### Resource Gates

| Resource | Baseline | Under Load | Fail If |
|----------|----------|---|---|
| Memory (api) | 500MB | <600MB | >700MB |
| Memory growth | - | <50MB/hour | >200MB/hour |
| CPU (api) | 5% | <50% | >90% |
| Postgres connections | 5 | <10 | >15 |
| Redis connections | 1 | <5 | >10 |

### Splunk Adapter Gates

| Check | Expected | Fail If |
|-------|----------|---------|
| Splunk query success rate | >99% | <95% |
| Splunk p95 latency | <300ms | >800ms |
| MCP token validity | Valid | Invalid/expired |
| SSH tunnel stability | Up 100% | Down >10s |

---

## Analysis & Reporting

### Generate HTML Report

```bash
# After all scenarios, create consolidated report
locust -f locustfile.py \
  --csv=reports/consolidated \
  --only-summary

# Script to convert CSV to HTML
python tests/load/utils/report_generator.py \
  --baseline reports/baseline_stats.csv \
  --ramp reports/ramp_stats.csv \
  --peak reports/peak_stats.csv \
  --soak reports/soak_stats.csv \
  --output reports/load_test_phase8_<date>.html
```

### Example HTML Report Sections

1. **Executive Summary**
   - Pass/Fail verdict for each scenario
   - Performance trend graph
   - Bottleneck identification

2. **Detailed Results**
   - Request rate over time
   - Response time distribution (histograms)
   - Error rates by endpoint
   - Rate limiter effectiveness

3. **Resource Utilization**
   - Memory usage over time
   - CPU utilization
   - Database connection count
   - Redis operations/sec

4. **Recommendations**
   - Tuning opportunities
   - Caching improvements
   - Splunk query optimization
   - Infrastructure scaling needs

---

## Troubleshooting

### Issue: "Connection refused" on localhost:8001

**Cause**: API not running or Docker stack failed  
**Fix**:
```bash
# Check Docker status
docker compose ps

# Check API logs
docker compose logs api

# Restart API
docker compose restart api

# Verify health
curl http://localhost:8001/health
```

### Issue: "Invalid x-api-key"

**Cause**: Locust not sending dev auth header  
**Fix**:
```python
# In tasks/incident_list.py, verify:
headers = {
    "x-api-key": "dev-analyst",
    "Content-Type": "application/json"
}

response = self.client.get(
    "/api/v1/incidents",
    headers=headers
)
```

### Issue: Splunk MCP "502 Bad Gateway"

**Cause**: SSH tunnel down or Splunk token expired  
**Fix**:
```bash
# Check tunnel
make tunnel-status

# If down:
make tunnel-start

# Check token expiry
echo $SPLUNK_MCP_TOKEN | cut -d. -f2 | base64 -d | jq '.exp'

# If expired, regenerate in Splunk UI and update .env
```

### Issue: Memory keeps growing (leak suspected)

**Cause**: Connection pool not closing or cache unbounded  
**Fix**:
```bash
# 1. Check Postgres connections
docker compose exec postgres psql -U postgres -c "SELECT count(*) FROM pg_stat_activity;"
# Should be <15

# 2. Check Redis keys
docker compose exec redis redis-cli DBSIZE
# Should be stable

# 3. Check Python memory profiler
docker compose exec api python -m memory_profiler ...
```

### Issue: High variance in p95 latency (inconsistent)

**Cause**: Splunk query variance, GC pauses, or Locust distribution  
**Fix**:
```bash
# Run scenario longer to smooth out variance
locust ... --run-time 20m  # instead of 5m

# Reduce spawn rate for steadier ramp
locust ... --spawn-rate 5  # instead of 10

# Check for Splunk query slowness
docker compose logs api | grep "search.*duration_ms"
```

---

## Load Test Checklist

Before running load tests:

- [ ] SSH tunnel running (`make tunnel-start`)
- [ ] Docker stack healthy (`docker compose ps` shows 7 "Up")
- [ ] API responding to health check (`curl http://localhost:8001/health`)
- [ ] Live mode enabled in .env (`SPLUNK_LIVE_MODE=true`)
- [ ] Splunk token valid (check `exp` claim)
- [ ] Redis running (`docker compose ps redis`)
- [ ] Postgres running (`docker compose ps postgres`)
- [ ] Locust installed (`pip install locust>=2.15`)
- [ ] Test reports directory exists (`mkdir -p reports/`)
- [ ] No existing test processes (`pgrep locust` returns empty)

After running load tests:

- [ ] HTML report generated
- [ ] All scenarios passed performance gates
- [ ] No unexpected error logs in `docker compose logs api`
- [ ] Memory usage stable (no growth >50MB/hour)
- [ ] Rate limiter correctly throttled excess load
- [ ] Splunk adapter handled concurrent queries
- [ ] All 7 Docker services remained healthy
- [ ] Results uploaded to shared drive / wiki
- [ ] Team notified of findings
- [ ] Bottlenecks documented for next sprint

---

## Performance Optimization Tips

If scenarios fail:

1. **Splunk Query Optimization**
   - Reduce date range: `-24h` → `-1h`
   - Add index filtering: `search index=tutorial incident_id=...`
   - Contact Splunk admin for index stats

2. **Rate Limiting Tuning**
   - Increase per-minute limit: `RATE_LIMIT_PER_MINUTE=200`
   - Or implement per-user burst allowance
   - Verify Redis is responsive

3. **Caching Strategy**
   - Add Redis caching for incident list
   - Cache Splunk adapter calls (with TTL)
   - Cache decision traces (immutable)

4. **Connection Pooling**
   - Verify httpx pool size is sufficient
   - Check Postgres connection count
   - Monitor Redis connection leaks

5. **Async Processing**
   - Consider offloading Splunk queries to worker queue
   - Implement response streaming for large incident lists
   - Add background job for approval audit logging

---

## Expected Results

### Baseline Scenario (10 users, 5 min)
```
Type     | Name                           | # reqs | # fails | Avg | Min | Max | Median | req/s
GET      | /api/v1/incidents              | 500    | 0       | 120 | 80  | 250 | 110    | 1.67
GET      | /api/v1/decision-traces/{id}   | 150    | 0       | 220 | 150 | 380 | 200    | 0.50
POST     | /api/v1/decision-traces/{id}/approvals | 50 | 0 | 310 | 280 | 450 | 300 | 0.17
------
Total    |                                | 700    | 0       | 167 | 80  | 450 | 140    | 2.33
```

### Ramp Scenario (100 users, 10 min)
```
Expected p95 latency to remain <500ms even at peak
Some 429 (rate limit) responses expected but <5%
Zero 5xx errors
```

### Peak Scenario (200 users, 5 min)
```
Expected p95 latency <800ms (degraded but functional)
Rate limiter actively rejecting excess load (20-30% 429s)
Zero service crashes
```

### Soak Scenario (50 users, 1 hour)
```
Expected memory growth <50MB total
Zero connection leaks
Splunk adapter handles sustained load
All 7 services remain stable
```

---

## Next Steps

1. **Setup** (1 hour)
   - Ensure tunnel running
   - Start Docker stack
   - Verify API health

2. **Execute Baseline** (1 hour)
   - Run Scenario 1
   - Review results
   - Identify any immediate issues

3. **Ramp Testing** (1.5 hours)
   - Run Scenario 2
   - Monitor API logs
   - Check for bottlenecks

4. **Peak Testing** (1 hour)
   - Run Scenario 3
   - Verify rate limiter
   - Assess graceful degradation

5. **Soak Testing** (1+ hour)
   - Run Scenario 4 (1 hour)
   - Monitor memory
   - Generate final report

6. **Analysis & Reporting** (2 hours)
   - Consolidate results
   - Generate HTML report
   - Document findings
   - Identify optimizations

**Total Time**: ~8 hours (can be split across 2-3 days)

---

**Ready to Start?** Run `make load-test` and monitor the report in real-time! 🚀

