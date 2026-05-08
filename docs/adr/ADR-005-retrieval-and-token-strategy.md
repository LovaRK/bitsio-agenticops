# ADR-005: Retrieval and Token Strategy

## Status
Accepted

## Date
2026-05-08

## Context
Token efficiency is critical for cost control and performance. The system must use aggressive caching and tree-sitter based retrieval to minimize unnecessary token usage.

## Decision
1. **Tree-sitter for Code**: Use tree-sitter for AST-aware code retrieval
2. **Semantic Summaries**: Cache file-level semantic summaries
3. **Symbol-level Edits**: Prefer patch diffs over full file rewrites
4. **Lazy Loading**: Load skills only when relevant to current task

## Tools
- Tree-sitter: AST parsing and navigation
- Repomix: Repository summarization
- Graphiti: Graph-based memory (architecture-ready, deferred)

## Consequences

### Positive
- Reduced token consumption
- Faster retrieval
- Better caching behavior

### Negative
- Additional tooling complexity
- Must maintain cache invalidation

## Implementation
- Code search in development tools (OpenCode, Antigravity)
- Not in production runtime (customer doesn't need this)

## References
- CLAUDE.md: Mandatory Token Optimization
- System Prompt: Retrieval Hierarchy section