# Parallel Agent Workflow (Codex + Antigravity)

1. Codex updates canonical docs in `docs/plan/` first.
2. Only tasks marked `READY` in `EXECUTION_BOARD.md` can be picked.
3. Antigravity implements bounded slices and reports:
   - files changed
   - tests executed
   - risk notes
   - rollback notes
4. Codex verifies integration, updates `HANDOFF_LOG.md`, then moves task state.
5. No phase promotion without gate checklist completion in `MASTER_ROADMAP.md`.
