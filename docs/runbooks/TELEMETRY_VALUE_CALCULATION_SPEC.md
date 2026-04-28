# Telemetry Value Metrics - Calculation Spec (QA)

## Scope
This document defines how `/telemetry-value` values are calculated so QA can validate backend and UI values deterministically.

Primary API:
- `GET /api/v1/waste/telemetry/metrics`

Code source of truth:
- `/Users/ramakrishna/Desktop/OfficeWork/bitsio-agenticops/apps/api/app/routers/waste.py`
- `/Users/ramakrishna/Desktop/OfficeWork/bitsio-agenticops/apps/web/app/waste/page.tsx`
- `/Users/ramakrishna/Desktop/OfficeWork/bitsio-agenticops/apps/web/components/SourceValueMatrix.tsx`

## Runtime behavior
- Default runtime mode: `LOCAL_INTEGRATION` (local model + live Splunk).
- If live data query succeeds, response is computed from live Splunk-derived source profiles.
- In strict live modes (`LOCAL_INTEGRATION`, `CLOUD_LIVE`), no mock/static business payload is rendered.
- If live mode is off, or live query fails/returns empty, API and UI use explicit live states (`live-error`, `live-empty`) instead of fallback business data.

## Query execution model
Backend builds a query plan with 3 deterministic searches:
1. `index_volume_profile` - ingest volume by index/source type.
2. `search_usage_by_sourcetype` - usage signal by source type.
3. `search_usage_by_index` - usage signal by index.

The response includes:
- `query_plan` (planned steps),
- `executed_steps` (executed/fallback),
- `query_context` (`adapter_mode`, `resolved_adapter_mode`, `backend`, `used_live_data`, `fallback_reason`).
- `trust` (`data_source`, `fallback_used`, `backend`, `adapter_mode`, `confidence`, `coverage_pct`).

## Constants and thresholds
From backend constants:
- License rate: `$150 per GB/year`
- `_WASTE_INGEST_MIN_THRESHOLD_GB = 0.001`
- `_WASTE_SEARCH_MAX_THRESHOLD = 5`
- `_WASTE_DASHBOARD_MAX_THRESHOLD = 0`
- `_WASTE_ALERT_MAX_THRESHOLD = 0`

## Source-level formulas
For each source profile in live mode:

1. `search_signal`
- `search_count_90d + (dashboard_references * 12) + (alert_references * 18)`

2. `utilization_score`
- `clamp(int(search_signal), 0, 100)`

3. `value_rating`
- `High` if `utilization_score >= 70`
- `Medium` if `utilization_score >= 40`
- `Low` otherwise

4. `annual_spend_usd`
- `daily_ingest_gb * 365 * 150`
- rounded to 2 decimals

5. `potential_savings_usd`
- `min(annual_spend_usd, recommendation_savings_for_source)`
- rounded to 2 decimals

6. `recommendation`
- `Keep` if `utilization_score >= 70`
- else `Remove` if `utilization_score < 25` and `potential_savings_usd > 0`
- else `Optimize`

## Summary card formulas
Top cards on `/telemetry-value`:

1. Total Annual Spend
- `summary.total_annual_spend_usd = sum(source.annual_spend_usd)`

2. Potential Savings
- `summary.total_potential_savings_usd = sum(source.potential_savings_usd)`

3. Avg Utilization Score
- `summary.avg_utilization_score = round(avg(source.utilization_score))`

4. Security Gaps Found
- `summary.security_gap_count = len(security_findings)`

5. Recommendation Complexity (backend meta)
- `High` if `(total_potential_savings / total_annual_spend) > 0.35`
- `Medium` if `> 0.15`
- else `Low`

## Security findings derivation
Findings are generated primarily from low-value sources:
- candidate set: first 4 sources with `value_rating == "Low"`.

Reason codes:
- `NO_SEARCH_ACTIVITY` if `search_count_90d <= 5`
- `NO_DOWNSTREAM_CONSUMERS` if dashboard refs and alert refs are both `0`
- `LOW_VALUE_HIGH_COST` if `daily_ingest_gb >= 0.001` and value is `Low`
- fallback reason code: `LOW_UTILIZATION_REVIEW`

Severity:
- `High` if `utilization_score < 20`, else `Medium`

Savings impact percent:
- proportional to source share of total potential savings
- bounded in range `3..25`

## Savings projection formulas
Projection points:
- Months: `[0, 1, 3, 6, 9, 12]`
- Realization steps: `[0.0, 0.22, 0.48, 0.68, 0.82, 0.9]`

For each point:
- `current_trajectory_usd = total_annual_spend`
- `optimized_trajectory_usd = total_annual_spend - (total_potential_savings * step)`

Realized savings block:
- `estimated_annual_savings_usd = total_potential_savings`
- `realized_to_date_usd = total_potential_savings * 0.22`
- `realization_pct = 22`
- `next_milestone_target_usd = total_potential_savings * 0.48`

## UI mapping
Page:
- `/Users/ramakrishna/Desktop/OfficeWork/bitsio-agenticops/apps/web/app/waste/page.tsx`

Mappings:
- Overview cards read from `metrics.summary.*`
- Source list/charts read from `metrics.sources[]`
- Findings section reads `metrics.security_findings[]`
- Projection chart reads `metrics.savings_projection[]`

Source Value Matrix chart:
- `/Users/ramakrishna/Desktop/OfficeWork/bitsio-agenticops/apps/web/components/SourceValueMatrix.tsx`
- X-axis: daily volume (`daily_ingest_gb`)
- Y-axis: utilization score (`utilization_score`)
- bubble size: annual cost (`annual_spend_usd`)
- bubble color: recommendation (`Keep`/`Optimize`/`Remove`)

## Missing-data and live-state behavior
When live mode is enabled:
- If live query succeeds and returns profiles: live computed payload is returned.
- If live query fails: API returns explicit live error semantics (no mock payload for strict live modes).
- If live query succeeds with no usable profiles: API returns explicit live-empty semantics.

When live mode is disabled:
- API can return non-live empty payload semantics, not live business fallback.

## QA checklist
1. Call API and store response:
- `GET /api/v1/waste/telemetry/metrics`

2. Validate card math:
- Recompute all 4 summary cards from `sources[]` and `security_findings[]`.

3. Validate recommendation classification:
- Recompute each source recommendation from utilization + savings rules.

4. Validate findings thresholds:
- For each finding, verify reason codes match thresholds and source actuals.

5. Validate projection:
- Recompute each optimized trajectory point from spend/savings + step table.

6. Validate UI parity:
- Compare API payload values to rendered values on `/telemetry-value`.

## Notes for testers
- Validate live provenance first:
  - `trust.data_source == "live"`
  - `trust.fallback_used == false`
  - `query_context.used_live_data == true`
- If results appear unexpectedly low/high, inspect `query_context` and `trust` fields before evaluating formulas.
- Live mode quality depends on actual Splunk source profile richness and search activity in window.
