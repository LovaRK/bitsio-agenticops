CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS decision_traces (
  id BIGSERIAL PRIMARY KEY,
  workflow_id TEXT NOT NULL UNIQUE,
  incident_id TEXT NOT NULL,
  graph_name TEXT NOT NULL,
  graph_version TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  payload JSONB NOT NULL,
  embedding VECTOR(1536),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS node_runs (
  id BIGSERIAL PRIMARY KEY,
  decision_trace_id BIGINT NOT NULL REFERENCES decision_traces(id) ON DELETE CASCADE,
  node_name TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL,
  input_hash TEXT NOT NULL,
  output_hash TEXT NOT NULL,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS approval_events (
  id BIGSERIAL PRIMARY KEY,
  workflow_id TEXT NOT NULL,
  approver TEXT NOT NULL,
  decision TEXT NOT NULL,
  reason TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_decision_traces_incident_id ON decision_traces (incident_id);
CREATE INDEX IF NOT EXISTS idx_decision_traces_graph_name ON decision_traces (graph_name);
CREATE INDEX IF NOT EXISTS idx_decision_traces_started_at ON decision_traces (started_at);
CREATE INDEX IF NOT EXISTS idx_node_runs_trace_id ON node_runs (decision_trace_id);
