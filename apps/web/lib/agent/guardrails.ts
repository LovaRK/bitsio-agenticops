import type { GuardrailDecision } from '@/types/agent';

const BLOCKED = new Set(['delete_index', 'modify_splunk_roles', 'disable_alert', 'edit_correlation_search', 'change_ingestion_pipeline']);
const APPROVAL = new Set(['s3_archival', 'retention_reduction', 'field_pruning', 'delete_drop_data']);

export const isDestructiveAction = (actionType: string): boolean => APPROVAL.has(actionType) || BLOCKED.has(actionType);
export const getBlockedActionReason = (actionType: string): string => BLOCKED.has(actionType) ? 'Action is blocked by platform guardrails.' : '';
export const requiresApproval = (actionType: string, risk: string, complianceTags: string[] = []): boolean => APPROVAL.has(actionType) || BLOCKED.has(actionType) || risk === 'high' || risk === 'critical' || complianceTags.length > 0;
export const evaluateGuardrail = (actionType: string, risk = 'low', complianceTags: string[] = []): GuardrailDecision => {
  if (BLOCKED.has(actionType)) return 'blocked';
  if (requiresApproval(actionType, risk, complianceTags)) return 'approval_required';
  return 'allowed';
};
