from __future__ import annotations

from typing import Any, Protocol

from sqlalchemy import text
from sqlalchemy.orm import Session


class MetadataService(Protocol):
    def get_asset(self, asset_id: str) -> dict[str, Any] | None: ...

    def get_service(self, service_name: str) -> dict[str, Any] | None: ...

    def get_customer(self, customer_id: str) -> dict[str, Any] | None: ...


class StubMetadataService:
    def __init__(
        self,
        *,
        assets: dict[str, dict[str, Any]] | None = None,
        services: dict[str, dict[str, Any]] | None = None,
        customers: dict[str, dict[str, Any]] | None = None,
    ) -> None:
        self.assets = assets or {
            "asset-payments-api-1": {"asset_id": "asset-payments-api-1", "tier": "gold"},
        }
        self.services = services or {
            "payments-api": {"service_name": "payments-api", "owner": "platform"},
        }
        self.customers = customers or {
            "cust_001": {"customer_id": "cust_001", "plan": "enterprise"},
        }

    def get_asset(self, asset_id: str) -> dict[str, Any] | None:
        return self.assets.get(asset_id)

    def get_service(self, service_name: str) -> dict[str, Any] | None:
        return self.services.get(service_name)

    def get_customer(self, customer_id: str) -> dict[str, Any] | None:
        return self.customers.get(customer_id)


class PostgresMetadataService:
    """Scaffold for production metadata lookups."""

    def __init__(self, session: Session) -> None:
        self.session = session

    def _fetch_one(self, query: str, value: str) -> dict[str, Any] | None:
        row = self.session.execute(text(query), {"value": value}).mappings().first()
        return dict(row) if row else None

    def get_asset(self, asset_id: str) -> dict[str, Any] | None:
        return self._fetch_one("SELECT * FROM assets WHERE asset_id = :value LIMIT 1", asset_id)

    def get_service(self, service_name: str) -> dict[str, Any] | None:
        return self._fetch_one(
            "SELECT * FROM services WHERE service_name = :value LIMIT 1", service_name
        )

    def get_customer(self, customer_id: str) -> dict[str, Any] | None:
        return self._fetch_one(
            "SELECT * FROM customers WHERE customer_id = :value LIMIT 1", customer_id
        )
