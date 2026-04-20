import type {
  IncidentSummary,
  SettingsSnapshot,
  RuntimeConfigPayload,
  RuntimeConfigResponse,
  RuntimeConnectivityResponse,
  FraudOverviewResponse,
  TelemetryMetricsResponse,
} from "@/types/api";
import type { DecisionTrace } from "@/types/decision-trace";

export interface IncidentServiceContract {
  listIncidents(): Promise<IncidentSummary[]>;
  getIncidentDetail(id: string): Promise<DecisionTrace>;
}

export interface RuntimeSettingsServiceContract {
  getSettingsSnapshot(): Promise<SettingsSnapshot>;
  updateRuntimeConfig(payload: RuntimeConfigPayload): Promise<RuntimeConfigResponse>;
  checkRuntimeConnections(): Promise<RuntimeConnectivityResponse>;
}

export interface FraudServiceContract {
  getFraudOverview(mode?: "auto" | "seed" | "live"): Promise<FraudOverviewResponse>;
  getFraudDemo(): Promise<FraudOverviewResponse>;
}

export interface TelemetryValueServiceContract {
  getTelemetryMetrics(): Promise<TelemetryMetricsResponse>;
}
