import type { AgentMode, AgentStatus, AutonomyLevel } from '@/types/agent';

export const nextStatus = (status: AgentStatus): AgentStatus => (status === 'paused' ? 'active' : 'paused');
export const modeToAutonomy = (mode: AgentMode): AutonomyLevel => {
  if (mode === 'advisory') return 'advisory';
  if (mode === 'approval_required') return 'approval_gated';
  return 'autonomous';
};
