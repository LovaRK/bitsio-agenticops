"""
Confidence scoring strategy and constants.

These weights are tuned for the telemetry incident triage domain.
Adjust these to calibrate confidence sensitivity across different deployment environments.
"""

# Evidence factor: normalize to count of evidence items; cap normalized value at 1.0
EVIDENCE_DIVISOR = 5.0

# Missing evidence penalty: each missing item reduces confidence by this fraction
MISSING_PENALTY_MULTIPLIER = 0.15
# Cap the cumulative missing penalty to avoid over-penalizing sparse evidence
MISSING_PENALTY_MAX = 0.6

# Correlation factor: each correlated finding adds this much to confidence
CORRELATION_MULTIPLIER = 0.12
# Cap the cumulative correlation bonus
CORRELATION_MAX = 0.35

# Overall score bounds
MIN_CONFIDENCE = 0.0
MAX_CONFIDENCE = 1.0
PRECISION_DECIMALS = 2
