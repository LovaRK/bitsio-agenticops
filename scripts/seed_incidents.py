from __future__ import annotations

import os

import psycopg

SEED_SQL = """
CREATE TABLE IF NOT EXISTS incidents (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  severity TEXT NOT NULL,
  source_index TEXT NOT NULL,
  status TEXT NOT NULL,
  event_time TIMESTAMPTZ NOT NULL
);

INSERT INTO incidents (id, title, severity, source_index, status, event_time)
VALUES
  ('inc_20260408_42', 'Payments latency spike', 'high', 'tutorial', 'triaging', NOW()),
  ('inc_20260408_43', 'Checkout retry storm', 'medium', 'tutorial', 'pending_approval', NOW()),
  ('inc_20260408_44', 'Auth token expiration surge', 'low', 'main', 'open', NOW())
ON CONFLICT (id) DO NOTHING;
"""


def main() -> None:
    dsn = os.getenv("DATABASE_URL", "postgresql://bitsio:bitsio@localhost:5432/bitsio_agenticops")
    with psycopg.connect(dsn) as conn:
        with conn.cursor() as cur:
            cur.execute(SEED_SQL)
        conn.commit()


if __name__ == "__main__":
    main()
