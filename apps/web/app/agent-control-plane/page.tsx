"use client";

import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import dynamic from 'next/dynamic';
import { AgentCommandHeader } from '@/components/agent/AgentCommandHeader';
import { AgentGuardrailPolicy } from '@/components/agent/AgentGuardrailPolicy';
import { ExecutiveAgentBrief } from '@/components/agent/ExecutiveAgentBrief';
import { AgentReliabilityPanel } from '@/components/agent/AgentReliabilityPanel';
import { LiveTelemetryFeed } from '@/components/agent/LiveTelemetryFeed';
import { AgentActivityTimeline } from '@/components/agent/AgentActivityTimeline';
import { AgentDecisionCenter } from '@/components/agent/AgentDecisionCenter';
import { HumanApprovalQueue } from '@/components/agent/HumanApprovalQueue';
import { MultiAgentStatusGrid } from '@/components/agent/MultiAgentStatusGrid';
const AgentExecutionGraph = dynamic(() => import('@/components/agent/AgentExecutionGraph').then((m) => m.AgentExecutionGraph));
const BusinessServiceImpactMap = dynamic(() => import('@/components/agent/BusinessServiceImpactMap').then((m) => m.BusinessServiceImpactMap));
const BusinessKpiCorrelationPanel = dynamic(() => import('@/components/agent/BusinessKpiCorrelationPanel').then((m) => m.BusinessKpiCorrelationPanel));
const SplunkTelemetryIntelligenceMap = dynamic(() => import('@/components/agent/SplunkTelemetryIntelligenceMap').then((m) => m.SplunkTelemetryIntelligenceMap));
import { SupportingBusinessMetrics } from '@/components/agent/SupportingBusinessMetrics';
import { SimulationPanel } from '@/components/agent/SimulationPanel';
import { OptimizationOpportunitiesTable } from '@/components/agent/OptimizationOpportunitiesTable';
import { RiskAndDetectionPanel } from '@/components/agent/RiskAndDetectionPanel';
import { FormulaCatalog } from '@/components/agent/FormulaCatalog';
import { AuditEvidenceLedger } from '@/components/agent/AuditEvidenceLedger';
import { AgentReplayTimeline } from '@/components/agent/AgentReplayTimeline';
import { AgentMemoryLedger } from '@/components/agent/AgentMemoryLedger';
import { DriftDetectionPanel } from '@/components/agent/DriftDetectionPanel';
import { ExplainabilityDrawer } from '@/components/agent/ExplainabilityDrawer';
import { ReasonDialog } from '@/components/agent/ReasonDialog';
import { ToastMessage } from '@/components/agent/ToastMessage';
import { useTelemetryMetrics } from '@/hooks/useTelemetryMetrics';
import { buildFallbackAgentState, useAgentState } from '@/hooks/useAgentState';
import { deriveAgentActivity, deriveAgentDecision, deriveExecutiveBrief, deriveMultiAgentStatus } from '@/lib/telemetry/narrative';
import { deriveOptimizationActions } from '@/lib/telemetry/recommendations';
import { deriveReliability } from '@/lib/agent/reliability';
import { deriveDriftSignals } from '@/lib/agent/drift';
import type { AgentGuardrailRule, ApprovalItem, AuditEntry, WorkspaceContext } from '@/types/agent';
import { nextStatus } from '@/lib/agent/state';
import { evaluateGuardrail, getBlockedActionReason } from '@/lib/agent/guardrails';

const WORKSPACES: WorkspaceContext[] = [
  { id: 'demo', name: 'Demo Customer', customerName: 'Demo Customer', environment: 'demo', splunkInstanceLabel: 'splunk-demo-main', complianceTags: ['SOC2'] },
  { id: 'customer-a', name: 'Customer A', customerName: 'Customer A', environment: 'prod', splunkInstanceLabel: 'splunk-prod-a', complianceTags: ['SOC2', 'SOX'] },
  { id: 'customer-b', name: 'Customer B', customerName: 'Customer B', environment: 'prod', splunkInstanceLabel: 'splunk-prod-b', complianceTags: ['SOC2'] },
  { id: 'eu-region', name: 'EU Region', customerName: 'EU Region', environment: 'eu', splunkInstanceLabel: 'splunk-eu', complianceTags: ['ISO27001'] },
  { id: 'pci-env', name: 'PCI Environment', customerName: 'PCI Environment', environment: 'pci', splunkInstanceLabel: 'splunk-pci', complianceTags: ['PCI'] },
];

const GUARDRAILS: AgentGuardrailRule[] = [
  { id: 'r1', actionType: 'read_only_spl_analysis', decision: 'allowed', reason: 'Read-only analysis allowed.', requiresHumanReason: false },
  { id: 'r2', actionType: 'cost_simulation', decision: 'allowed', reason: 'Simulation only.', requiresHumanReason: false },
  { id: 'r3', actionType: 's3_archival', decision: 'approval_required', reason: 'Potential data access impact.', requiresHumanReason: true },
  { id: 'r4', actionType: 'retention_reduction', decision: 'approval_required', reason: 'Retention policy change.', requiresHumanReason: true },
  { id: 'r5', actionType: 'delete_index', decision: 'blocked', reason: 'Destructive action blocked.', requiresHumanReason: true },
];
const telemetryFieldMap = {
  roiScore: { source: 'summary.roi_score', formula: 'weighted average telemetry value score', fallback: 'derived from sources[].composite_score' },
  annualSpend: { source: 'summary.total_annual_spend_usd', formula: 'sum(sources[].annual_cost_usd)', fallback: '0' },
  savingsPotential: { source: 'summary.total_potential_savings_usd', formula: 'sum(sources[].potential_savings_usd)', fallback: '0' },
} as const;

export default function AgentControlPlanePage() {
  type ReasonDialogMode = 'reject' | 'override' | 'modify';
  const [workspaceId, setWorkspaceId] = useState('demo');
  const [selectedSource, setSelectedSource] = useState<string | null>(null);
  const [selectedAction, setSelectedAction] = useState<string | null>(null);
  const [selectedMetric, setSelectedMetric] = useState<string | null>(null);
  const [selectedTimelineEvent, setSelectedTimelineEvent] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerTitle, setDrawerTitle] = useState('Explainability');
  const [drawerBody, setDrawerBody] = useState('Select a metric, event, or recommendation to inspect evidence and formulas.');
  const [autonomy, setAutonomy] = useState<'advisory' | 'assisted' | 'approval_gated' | 'autonomous'>('approval_gated');
  const queryClient = useQueryClient();

  const telemetry = useTelemetryMetrics(workspaceId);
  const agentStateQ = useAgentState(workspaceId);
  const agentState = agentStateQ.data ?? buildFallbackAgentState(workspaceId);

  const metrics = telemetry.data;
  const decision = metrics ? deriveAgentDecision(metrics) : null;
  const brief = metrics ? deriveExecutiveBrief(metrics) : null;
  const activity = metrics ? deriveAgentActivity(metrics) : [];
  const agents = metrics ? deriveMultiAgentStatus(metrics) : [];
  const reliability = deriveReliability(activity);
  const opportunities = useMemo(
    () => (metrics ? deriveOptimizationActions(metrics.sources).map((x) => ({ id: x.id, action: x.action, sourcetype: x.sourcetype, tier: x.tier, annualCost: x.annualCost, expectedSavings: x.expectedSavings, risk: x.risk, confidence: x.confidence, why: x.why })) : []),
    [metrics]
  );
  const opportunitiesById = useMemo(() => {
    const map = new Map<string, (typeof opportunities)[number]>();
    for (const row of opportunities) map.set(row.id, row);
    return map;
  }, [opportunities]);
  const drift = deriveDriftSignals(metrics?.query_context.confidence ?? 0.9);
  const topFindings = [
    `Cost Finding: ${metrics ? `$${Math.round(metrics.summary.total_potential_savings_usd ?? 0).toLocaleString()} projected savings` : 'No high-value cost reduction found'} · confidence ${Math.round((metrics?.query_context.confidence ?? 0.85) * 100)}%`,
    `Detection Finding: ${metrics?.security_findings.length ?? 0} findings · primary action improve detection coverage`,
    `Governance Finding: Guardrail enforces approval for archival/retention actions`,
  ];

  const [approvalQueue, setApprovalQueue] = useState<ApprovalItem[]>([]);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [memory, setMemory] = useState([{ id: 'm1', timestamp: new Date().toISOString(), category: 'decision', note: 'Initial workspace baseline loaded.' }]);
  const [reasonDialogOpen, setReasonDialogOpen] = useState(false);
  const [reasonDialogMode, setReasonDialogMode] = useState<ReasonDialogMode>('reject');
  const [reasonDialogTargetId, setReasonDialogTargetId] = useState<string | null>(null);
  const [reasonText, setReasonText] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [simulationInput, setSimulationInput] = useState<{ selectedSources: string[] }>({ selectedSources: [] });

  const liveEvents = useMemo(() => [
    { id: 'e1', timestamp: new Date().toISOString(), severity: 'info' as const, eventType: 'cost_anomaly', title: 'Volume increased for app:payments', description: 'Detected 8% ingest growth.' },
    { id: 'e2', timestamp: new Date(Date.now() - 120000).toISOString(), severity: 'warning' as const, eventType: 'detection_gap', title: 'MITRE mapping gap found', description: 'Network source lacks coverage.' },
  ], []);

  if ((telemetry.isLoading && !metrics) || (agentStateQ.isLoading && !agentStateQ.data)) {
    return <main className="min-h-screen bg-[#020617] p-6 text-white">Agent is connecting to Splunk...</main>;
  }

  if (!metrics) {
    return (
      <main className="min-h-screen bg-[#020617] p-6 text-white">
        <div className="mx-auto max-w-[1400px] rounded-xl border border-red-400/30 bg-red-500/10 p-8 text-center">
          <p className="text-lg font-semibold">Agent could not complete analysis.</p>
          <p className="mt-2 text-sm text-white/70">Live telemetry data is unavailable.</p>
          <button
            onClick={() => telemetry.refetch()}
            className="mt-4 rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-500"
          >
            Retry
          </button>
        </div>
      </main>
    );
  }

  if (!decision || !brief) {
    return (
      <main className="min-h-screen bg-[#020617] p-6 text-white">
        <div className="mx-auto max-w-[1400px] rounded-xl border border-red-400/30 bg-red-500/10 p-8 text-center">
          <p className="text-lg font-semibold">Decision engine did not return expected output.</p>
          <button
            onClick={() => telemetry.refetch()}
            className="mt-4 rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-500"
          >
            Retry
          </button>
        </div>
      </main>
    );
  }

  const openDrawer = (title: string, body: string) => {
    setDrawerTitle(title);
    setDrawerBody(body);
    setDrawerOpen(true);
  };

  const openReasonDialog = (mode: ReasonDialogMode, targetId: string | null = null) => {
    setReasonDialogMode(mode);
    setReasonDialogTargetId(targetId);
    setReasonText('');
    setReasonDialogOpen(true);
  };
  const showToast = (m: string) => {
    setToastMessage(m);
    setTimeout(() => setToastMessage(null), 2500);
  };
  const handleRunAnalysis = async () => {
    openDrawer('Run Analysis', 'Connecting to Splunk...\nAnalyzing sourcetypes...\nEvaluating guardrails...');
    await telemetry.refetch();
    setAudit((a) => [{ id: `a-${Date.now()}`, timestamp: new Date().toISOString(), agentName: agentState.name, decision: 'Run Analysis', inputSummary: 'Telemetry metrics refreshed from Splunk.', confidence: metrics?.query_context.confidence ?? 0.9, humanApproval: 'not_required', workspaceId, evidenceIds: ['run-analysis'] }, ...a]);
    showToast('Telemetry analysis refreshed.');
  };
  const handleExportReport = () => {
    const payload = { workspaceId, summary: metrics?.summary, decision, approvalQueue, auditLedger: audit, generatedAt: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `telemetry-agent-report-${workspaceId}.json`;
    link.click();
    URL.revokeObjectURL(link.href);
    showToast('Report exported.');
  };

  return (
    <main className="min-h-screen bg-[#020617] px-3 pb-28 pt-20 text-white md:px-6 md:pb-8 md:pt-24">
      <div className="mx-auto max-w-[1400px] space-y-6">
        <AgentCommandHeader
          state={agentState}
          workspaces={WORKSPACES}
          workspaceId={workspaceId}
          onWorkspaceChange={(id) => {
            setWorkspaceId(id);
            setSelectedSource(null);
            setSelectedAction(null);
            setSelectedMetric(null);
            setSelectedTimelineEvent(null);
            setDrawerOpen(false);
            setApprovalQueue([]);
            setAudit([]);
            setMemory([{ id: `m-${Date.now()}`, timestamp: new Date().toISOString(), category: 'workspace', note: `Switched to workspace ${id}.` }]);
          }}
          autonomy={autonomy}
          onAutonomyChange={setAutonomy}
          onTogglePause={() => agentStateQ.refetch().then(() => {
            queryClient.setQueryData(['agent-state', workspaceId], { ...agentState, status: nextStatus(agentState.status) });
            setAudit((a) => [{ id: `a-${Date.now()}`, timestamp: new Date().toISOString(), agentName: agentState.name, decision: 'Agent Status Changed', inputSummary: `Agent is now ${nextStatus(agentState.status)}.`, confidence: 1, humanApproval: 'not_required', workspaceId, evidenceIds: ['pause-toggle'] }, ...a]);
          })}
          onRunAnalysis={handleRunAnalysis}
          onOpenAudit={() => openDrawer('Audit Trail', 'Audit evidence and approval history for the current workspace.')}
        />
        <AgentGuardrailPolicy rules={GUARDRAILS} />
        <ExecutiveAgentBrief primaryDecision={brief.primaryDecision} businessImpact={brief.businessImpact} riskLevel={brief.riskLevel} nextAction={brief.nextAction} />
        <section className="grid gap-3 md:grid-cols-3">
          {topFindings.map((f, idx) => (
            <button key={f} onClick={() => openDrawer(`Top ${idx + 1} Agent Finding`, `${f}\nMap: ${JSON.stringify(telemetryFieldMap)}`)} className="rounded-xl border border-white/10 bg-white/[0.05] p-4 text-left text-sm text-white/90">
              {f}
            </button>
          ))}
        </section>
        <AgentReliabilityPanel m={reliability} />
        <LiveTelemetryFeed events={liveEvents} onOpen={(id) => {
          setSelectedTimelineEvent(id);
          openDrawer('Live Telemetry Event', `Event ID: ${id}`);
        }} />
        <AgentActivityTimeline items={activity} onOpen={(id) => {
          setSelectedTimelineEvent(id);
          openDrawer('Activity Evidence', `Timeline event: ${id}`);
        }} />
        <AgentDecisionCenter decision={decision} onExplain={() => openDrawer('Decision Explainability', `${decision.headline}\nEvidence: ${decision.reasonBullets.join(' | ')}`)} onSimulate={() => { setSimulationInput({ selectedSources: [] }); document.getElementById('simulation-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); openDrawer('Simulation', 'Simulation panel prefetched with decision context.'); }} onApprove={() => setApprovalQueue((q) => [{ id: `q-${Date.now()}`, actionType: 'retention_reduction', title: decision.nextAction, risk: decision.risk, confidence: decision.confidence, rollbackPlan: 'Restore previous retention policy.', guardrailDecision: 'approval_required', status: 'pending', createdAt: new Date().toISOString() }, ...q])} onOverride={() => openReasonDialog('override')} onTeach={() => { setMemory((m) => [{ id: `m-${Date.now()}`, timestamp: new Date().toISOString(), category: 'feedback', note: 'Teach Agent feedback submitted.' }, ...m]); setAudit((a) => [{ id: `a-${Date.now()}`, timestamp: new Date().toISOString(), agentName: agentState.name, decision: 'Teach Agent', inputSummary: 'Feedback saved to memory ledger.', confidence: 1, humanApproval: 'not_required', workspaceId, evidenceIds: ['teach-agent'] }, ...a]); showToast('Feedback saved.'); }} />
        <HumanApprovalQueue items={approvalQueue} onApprove={(id) => {
          const item = approvalQueue.find((x) => x.id === id);
          if (!item) return;
          setApprovalQueue((q) => q.filter((x) => x.id !== id));
          setAudit((a) => [{ id: `a-${Date.now()}`, timestamp: new Date().toISOString(), agentName: agentState.name, decision: item.title, inputSummary: item.actionType, confidence: item.confidence, humanApproval: 'approved', workspaceId, evidenceIds: [id] }, ...a]);
        }} onReject={(id) => openReasonDialog('reject', id)} onModify={(id) => openReasonDialog('modify', id)} />
        <MultiAgentStatusGrid agents={agents} />
        <AgentExecutionGraph onOpen={(id) => openDrawer('Execution Node', `Node: ${id}\nWhat: execution stage\nWhy: coordinates agent workflow`) } />
        <BusinessServiceImpactMap />
        <BusinessKpiCorrelationPanel />
        <SplunkTelemetryIntelligenceMap sources={metrics.sources} onSelect={(id) => {
          setSelectedSource(id);
          openDrawer('Sourcetype Explainability', id);
        }} />
        <SupportingBusinessMetrics summary={metrics.summary} onOpen={(key) => {
          setSelectedMetric(key);
          openDrawer('Metric Formula', `Metric: ${key}`);
        }} />
        <div id="simulation-panel"><SimulationPanel /></div>
        <OptimizationOpportunitiesTable rows={opportunities} onExplain={(id) => {
          setSelectedAction(id);
          const row = opportunitiesById.get(id);
          if (!row) {
            openDrawer('Opportunity Explainability', `Action ID: ${id}`);
            return;
          }
          openDrawer(
            `Opportunity Explainability · ${row.sourcetype}`,
            [
              `Action: ${row.action}`,
              `Tier: ${row.tier}`,
              `Risk: ${row.risk}`,
              `Confidence: ${Math.round(row.confidence * 100)}%`,
              `Annual Cost: $${Math.round(row.annualCost).toLocaleString()}`,
              `Expected Savings: $${Math.round(row.expectedSavings).toLocaleString()}`,
              `Why: ${row.why}`,
              'Formula: Savings = Current Cost - Optimized Cost',
            ].join('\n')
          );
        }} onApprove={(id) => {
          setSelectedAction(id);
          const row = opportunitiesById.get(id);
          if (!row) return;
          const gd = evaluateGuardrail('retention_reduction', row.risk);
          if (gd === 'blocked') {
            openDrawer('Blocked Action', getBlockedActionReason('retention_reduction') || 'Blocked by guardrail.');
            showToast('Blocked by guardrail policy.');
            return;
          }
          setApprovalQueue((q) => [{ id: `q-${Date.now()}`, actionType: 'retention_reduction', title: `${row.action} for ${row.sourcetype}`, risk: row.risk as 'low'|'medium'|'high'|'critical', confidence: row.confidence, rollbackPlan: 'Restore prior routing and retention policy.', guardrailDecision: 'approval_required', status: 'pending', createdAt: new Date().toISOString() }, ...q]);
          showToast('Action moved to approval queue.');
        }} onSimulate={(id) => {
          const row = opportunitiesById.get(id);
          if (!row) return;
          setSimulationInput({ selectedSources: [row.sourcetype] });
          document.getElementById('simulation-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          openDrawer('Opportunity Simulation', `Prefilled for ${row.sourcetype}`);
        }} onExport={(id) => {
          const row = opportunitiesById.get(id);
          if (!row) return;
          const blob = new Blob([JSON.stringify(row, null, 2)], { type: 'application/json' });
          const link = document.createElement('a');
          link.href = URL.createObjectURL(blob);
          link.download = `${row.sourcetype}-optimization-plan.json`;
          link.click();
          URL.revokeObjectURL(link.href);
          showToast('Opportunity exported.');
        }} />
        <RiskAndDetectionPanel findings={metrics.security_findings} />
        <FormulaCatalog />
        <AuditEvidenceLedger entries={audit} onOpen={(id) => openDrawer('Audit Evidence', `Audit entry ${id}`)} />
        <AgentReplayTimeline snapshots={[]} />
        <AgentMemoryLedger items={memory} />
        <DriftDetectionPanel signals={drift} />
      </div>
      <ExplainabilityDrawer open={drawerOpen} title={drawerTitle} body={drawerBody} onClose={() => {
        setDrawerOpen(false);
        setSelectedAction(null);
        setSelectedMetric(null);
        setSelectedSource(null);
        setSelectedTimelineEvent(null);
      }} />
      <ReasonDialog
        open={reasonDialogOpen}
        title={reasonDialogMode === 'override' ? 'Override Reason Required' : reasonDialogMode === 'reject' ? 'Reject Reason Required' : 'Modification Note Required'}
        description={reasonDialogMode === 'override'
          ? 'Provide a reason for overriding the current decision.'
          : reasonDialogMode === 'reject'
            ? 'Provide a reason before rejecting this action.'
            : 'Provide the modification details for this action.'}
        value={reasonText}
        onChange={setReasonText}
        onCancel={() => {
          setReasonDialogOpen(false);
          setReasonText('');
          setReasonDialogTargetId(null);
        }}
        onSubmit={() => {
          const reason = reasonText.trim();
          if (!reason) return;
          if (reasonDialogMode === 'override') {
            setAudit((a) => [{ id: `a-${Date.now()}`, timestamp: new Date().toISOString(), agentName: agentState.name, decision: 'Decision overridden by user', inputSummary: decision.headline, confidence: decision.confidence, humanApproval: 'approved', workspaceId, evidenceIds: ['override'], reason }, ...a]);
            openDrawer('Override Recorded', `Reason captured: ${reason}`);
          } else if (reasonDialogMode === 'reject' && reasonDialogTargetId) {
            const item = approvalQueue.find((x) => x.id === reasonDialogTargetId);
            if (item) {
              setApprovalQueue((q) => q.filter((x) => x.id !== reasonDialogTargetId));
              setAudit((a) => [{ id: `a-${Date.now()}`, timestamp: new Date().toISOString(), agentName: agentState.name, decision: item.title, inputSummary: item.actionType, confidence: item.confidence, humanApproval: 'rejected', workspaceId, evidenceIds: [reasonDialogTargetId], reason }, ...a]);
            }
          } else if (reasonDialogMode === 'modify' && reasonDialogTargetId) {
            setApprovalQueue((q) => q.map((item) => (item.id === reasonDialogTargetId ? { ...item, status: 'modified' } : item)));
            setMemory((m) => [{ id: `m-${Date.now()}`, timestamp: new Date().toISOString(), category: 'modify', note: `Modified action ${reasonDialogTargetId}: ${reason}` }, ...m]);
          }
          setReasonDialogOpen(false);
          setReasonText('');
          setReasonDialogTargetId(null);
        }}
      />
      <ToastMessage message={toastMessage} />
    </main>
  );
}
