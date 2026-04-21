import customerHealthData from "@/lib/mocks/agent_portfolio/customer_health.json";
import recoveryData from "@/lib/mocks/agent_portfolio/recovery_orchestrator.json";
import migrationData from "@/lib/mocks/agent_portfolio/migration_assurance.json";

export type CustomerHealthAccount = {
  workflow_id: string;
  final_output: {
    account_id: string;
    account_name: string;
    account_tier: string;
    composite_health: number;
    churn_risk_band: "green" | "amber" | "red";
    trend: "improving" | "stable" | "degrading";
    dimension_scores: Record<string, number>;
    top_signals: Array<{
      evidence_id: string;
      source: string;
      description: string;
      severity: "red" | "amber" | "green" | "info";
      result_count: number;
    }>;
    recommended_play: string;
    confidence: number;
    approval_required: boolean;
  };
  node_runs: Array<{
    node_name: string;
    status: "success" | "failed" | "blocked" | "running";
    note?: string;
  }>;
};

export type RecoveryOverview = {
  replica_lag: {
    workflow_id: string;
    incident_id: string;
    final_output: {
      final_assessment: string;
      confidence: number;
      approval_required: boolean;
      approver_user_id?: string;
    };
    guarded_plan: {
      steps: Array<{
        title: string;
        command_or_action: string;
      }>;
      rollback_steps: Array<{
        title: string;
        command_or_action: string;
      }>;
      blast_radius: {
        resources_affected: number;
        users_affected_estimate: number;
        expected_downtime_seconds: number;
      };
    };
    candidate_options: Array<{
      name: string;
      description: string;
      confidence: number;
      pros: string[];
      cons: string[];
      blast_radius: {
        resources_affected: number;
        users_affected_estimate: number;
        expected_downtime_seconds: number;
      };
    }>;
    node_runs: Array<{
      node_name: string;
      status: "success" | "failed" | "blocked" | "running";
      note?: string;
    }>;
  };
};

export type MigrationOverview = {
  workflow_id: string;
  final_output: {
    risk_score: number;
    risk_band: "green" | "amber" | "red";
    cutover_readiness: "go" | "conditional-go" | "no-go";
    coverage_summary: {
      total: number;
      mapped: number;
      partial: number;
      unmapped: number;
      compliance_gaps: number;
    };
    blocking_issues: Array<Record<string, string | number>>;
  };
  field_diffs: Array<{
    cim_field: string;
    source_coverage_pct: number;
    target_coverage_pct: number;
    delta_pct: number;
    blocking: boolean;
  }>;
  perf_deltas: Array<{
    sourcetype: string;
    source_p95_lag_seconds: number;
    target_p95_lag_seconds: number;
    delta_pct: number;
  }>;
  node_runs: Array<{
    node_name: string;
    status: "success" | "failed" | "blocked" | "running";
    note?: string;
  }>;
};

export function getAgentPortfolioData(): {
  customerHealth: Record<string, CustomerHealthAccount>;
  recovery: RecoveryOverview;
  migration: MigrationOverview;
} {
  return {
    customerHealth: customerHealthData as Record<string, CustomerHealthAccount>,
    recovery: recoveryData as RecoveryOverview,
    migration: migrationData as MigrationOverview,
  };
}
