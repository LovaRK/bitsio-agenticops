import type { AgentReplaySnapshot } from '@/types/agent';

export const filterReplay = (snapshots: AgentReplaySnapshot[], workspaceId: string): AgentReplaySnapshot[] =>
  snapshots.filter((s) => s.workspaceId === workspaceId);
