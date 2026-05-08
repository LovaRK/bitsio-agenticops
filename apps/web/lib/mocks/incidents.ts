/**
 * Mock incident data for development and fallback.
 */

import mockCompletedIncident from "@/lib/mocks/incident_detail_completed.json";
import mockPendingIncident from "@/lib/mocks/incident_detail_pending.json";
import type { IncidentSummary } from "@/types/api";
import type { DecisionTrace } from "@/types/decision-trace";

export function pickMockIncident(id: string): DecisionTrace {
  if (id === mockCompletedIncident.incident_id || id === mockCompletedIncident.workflow_id) {
    return mockCompletedIncident as DecisionTrace;
  }
  return mockPendingIncident as DecisionTrace;
}

export function mockIncidents(): IncidentSummary[] {
  return [
    {
      id: mockPendingIncident.incident_id,
      title: mockPendingIncident.title,
      severity: mockPendingIncident.severity,
      status: mockPendingIncident.status,
      timestamp: mockPendingIncident.timestamp,
    },
    {
      id: mockCompletedIncident.incident_id,
      title: mockCompletedIncident.title,
      severity: mockCompletedIncident.severity,
      status: mockCompletedIncident.status,
      timestamp: mockCompletedIncident.timestamp,
    },
  ];
}
