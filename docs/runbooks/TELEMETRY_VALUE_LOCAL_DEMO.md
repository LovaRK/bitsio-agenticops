# Telemetry Value Agent Local Demo

## UI Location
- Primary route: `/telemetry-value`
- Alias route: `/waste`
- Forced-local story route: `/telemetry-value/local` (redirects to `/telemetry-value?source=local`)

## Data Source Behavior
- Live mode: `GET /api/v1/waste/demo`
- Local fallback mode: `apps/web/lib/mocks/telemetry_value_story.json`

## What This Demo Shows
- Estimated annual savings (USD)
- Waste percentage and wasted GB/day
- Top wasteful source types (realistic enterprise-style data)
- Recommended cost-reduction actions
- Calculation assumptions used by the model

## Demo Script (2 minutes)
1. Open `/telemetry-value`.
2. Explain headline KPI: `Estimated Annual Savings`.
3. Show `Top Offenders` and call out low search activity vs high ingest.
4. Show `Recommended Actions` and savings per source type.
5. Open `How This Was Calculated` and explain assumptions.
