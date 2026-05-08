.PHONY: lint typecheck test smoke check-fallbacks check-cloud-defaults

lint:
	@echo "Running lint..."
	# Placeholder for ruff / eslint
	# ruff check .
	# npm run lint

typecheck:
	@echo "Running typecheck..."
	# Placeholder for mypy / tsc
	# mypy .
	# npm run typecheck

test:
	@echo "Running tests..."
	# Placeholder for pytest / vitest
	# pytest
	# npm test

smoke:
	@echo "Running smoke tests..."

check-fallbacks:
	@echo "Checking for forbidden fallback patterns..."
	# Implementation of Rule 9 check
	# ./scripts/check_fallbacks.sh

check-cloud-defaults:
	@echo "Checking for unauthorized cloud defaults..."
	# Implementation of Rule 10 check
	# ./scripts/check_cloud_defaults.sh
