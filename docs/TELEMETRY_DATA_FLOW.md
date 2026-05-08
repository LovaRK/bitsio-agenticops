# Telemetry Dashboard: Data Flow & Calculations

## 1. DATA SOURCE ARCHITECTURE

### Mode 1: Live Splunk (SPLUNK_LIVE_MODE=true)

```
User Query (Browser)
    ↓
GET /api/v1/telemetry/executive-summary?cost_per_gb=10&util_weight=0.35...
    ↓
FastAPI Backend (port 8001)
    ↓
[IF SPLUNK_LIVE_MODE=true]
    ↓
_run_live_scoring() executes 5 SPL Queries:
    ├─ Query 1: Volume by sourcetype (stats sum(eval(...)gb) by sourcetype)
    ├─ Query 2: Alert references (stats count by source | search ... )
    ├─ Query 3: Scheduled search usage (search | lookup ...)
    ├─ Query 4: Dashboard references (search | lookup ...)
    └─ Query 5: Parsing/timestamp errors (stats sum(...) by sourcetype)
    ↓
Results → SourcetypeRawData objects
    ├─ gb_per_day: float (from Query 1)
    ├─ alert_refs: int (from Query 2)
    ├─ search_refs: int (from Query 3)
    ├─ dashboard_refs: int (from Query 4)
    ├─ parsing_error_pct: float (from Query 5)
    └─ ... (other calculated fields)
    ↓
CompositeScorer.score(raw_data) → SourcetypeScore
    ├─ utilization_score (35% weight)
    ├─ detection_score (40% weight)
    └─ quality_score (25% weight)
    ↓
CostEngine calculates:
    ├─ annual_cost_usd = gb_per_day × 365 × cost_per_gb
    ├─ ROI Score (average composite)
    ├─ GainScope (% utilized volume)
    ├─ Tier classification
    └─ Savings staircase (5 stages)
    ↓
Response JSON → Browser
    └─ trust.data_source = "live"
```

### Mode 2: Seed Data (SPLUNK_LIVE_MODE=false)

```
User Query (Browser)
    ↓
GET /api/v1/telemetry/executive-summary?cost_per_gb=10&util_weight=0.35...
    ↓
FastAPI Backend (port 8001)
    ↓
[IF SPLUNK_LIVE_MODE=false]
    ↓
_build_seed_scores() loads hardcoded Python list (53 sourcetypes)
    ↓
Hardcoded values → SourcetypeRawData objects
    ↓
CompositeScorer.score(raw_data) → SourcetypeScore
    ├─ utilization_score (35% weight)
    ├─ detection_score (40% weight)
    └─ quality_score (25% weight)
    ↓
CostEngine calculates (same as live):
    ├─ annual_cost_usd = gb_per_day × 365 × cost_per_gb
    └─ ... (all other metrics)
    ↓
Response JSON → Browser
    └─ trust.data_source = "seed"
```

---

## 2. HOW CALCULATIONS WORK

### Step A: Utilization Score (35% weight)

**Formula:**
```python
total_points = (alert_refs×3) + (search_refs×3) + (dashboard_refs×2) + (adhoc×1) + (users×2)
utilization_score = min(100, (total_points / 200) × 100)
```

### Step B: Detection Score (40% weight)

**Formula:**
```python
detection_score = (0.5 × mitre_coverage) + (0.3 × lantern_coverage) + (0.2 × alert_ratio)
```

### Step C: Quality Score (25% weight)

**Formula:**
```python
quality_score = 100 - parsing_error_pct - timestamp_error_pct
```

### Step D: Composite Score

**Formula:**
```python
composite_score = (0.35×util) + (0.40×detection) + (0.25×quality)
```

### Step E: Cost Calculation

**Formula:**
```python
annual_cost_usd = gb_per_day × 365 × cost_per_gb_year
```

---

## 3. CONFIGURATION

### Currently Running (Local Mode):
```bash
SPLUNK_LIVE_MODE=false
# → Uses 53 hardcoded sourcetypes
# → Instant response (~16ms)
```

### To Use Live Splunk:
```bash
# 1. Start SSH tunnel
ssh -fN -L 8089:localhost:8089 root@144.202.48.85

# 2. Enable live mode in .env
sed -i 's/SPLUNK_LIVE_MODE=false/SPLUNK_LIVE_MODE=true/' .env

# 3. Restart API
pkill -f "python.*run_live_api"
uv run python scripts/run_live_api.py

# 4. Test
curl http://127.0.0.1:8001/api/v1/settings/runtime/check | jq '.splunk'
# Should show: {"connected": true, "detail": "30 indexes visible"}
```

---

## 4. DATA FILES

- **Backend Calculation:** `apps/api/app/services/scoring_engine.py` + `cost_engine.py`
- **Seed Data:** `_SEED_ROWS` list in `apps/api/app/routers/telemetry_executive.py` (53 sourcetypes)
- **Live Data:** Splunk MCP at `45.76.167.6:8089` (5 SPL queries)
- **Frontend:** `apps/web/app/telemetry-value/page.tsx` → calls `/api/v1/telemetry/executive-summary`

**NOT from:** PDF, local files, or mockups — only code + Splunk
