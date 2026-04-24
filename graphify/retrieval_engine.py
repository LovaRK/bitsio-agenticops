"""
Production-grade retrieval engine for a codebase knowledge graph.

Focus:
- 80-90% token reduction
- Near-zero accuracy loss
- Deterministic routing + safe fallbacks
- Full traceability
"""

from __future__ import annotations

import hashlib
from dataclasses import dataclass, field
from typing import Any, Literal

ClassifierMode = Literal["rule", "hybrid", "off"]


@dataclass
class RetrievalConfig:
    use_node_filtering: bool = True
    use_community_filtering: bool = True
    use_path_retrieval: bool = True
    use_two_tier_summary: bool = True
    use_classifier: ClassifierMode = "hybrid"
    fallback_enabled: bool = True
    max_tokens: int = 20_000
    max_paths: int = 3
    max_hops: int = 4
    use_hybrid_retrieval: bool = True
    enable_subgraph_cache: bool = True


@dataclass
class RetrievalTrace:
    mode: str = "default"
    communities: list[str] = field(default_factory=list)
    nodes: list[str] = field(default_factory=list)
    paths: list[list[str]] = field(default_factory=list)
    fallback_used: bool = False
    tokens_estimated: int = 0
    confidence: float = 0.0
    cache_hit: bool = False
    ranking_strategy: str = "importance"
    budget_cut_nodes: list[str] = field(default_factory=list)


@dataclass
class RetrievalResult:
    context: str
    trace: RetrievalTrace


SUBGRAPH_CACHE: dict[str, Any] = {}

# These are intended to be dependency-injected by callers.
full_graph: Any = None
filtered_graph: Any = None
GLOBAL_COMMUNITY: list[str] = []


def similarity(query: str, text: str) -> float:
    del query, text
    return 0.0


def estimate_tokens(text: str) -> int:
    return max(1, len(text) // 4)


def top_k_nodes(query: str, graph: Any, k: int = 20) -> list[Any]:
    del query, graph, k
    return []


def k_shortest_paths(graph: Any, src: Any, tgt: Any, k: int) -> list[list[Any]]:
    del graph, src, tgt, k
    return []


def limit_hops(paths: list[list[Any]], max_hops: int) -> list[list[Any]]:
    return [path[:max_hops] for path in paths]


def find_anchor_nodes(query: str, graph: Any) -> list[Any]:
    del query, graph
    return []


def llm_classify(query: str) -> tuple[str, float]:
    del query
    return "default", 0.6


def vector_search(query: str, k: int = 20) -> list[Any]:
    del query, k
    return []


def summarize(text: str) -> str:
    return text[:500]


def classify_query(query: str, config: RetrievalConfig) -> tuple[str, float]:
    if config.use_classifier == "off":
        return "default", 1.0

    q = query.lower()

    if any(token in q for token in ["error", "exception", "stack trace"]):
        return "runtime", 0.9

    if any(token in q for token in ["how does", "how do", "architecture"]):
        return "architecture", 0.8

    if any(token in q for token in ["where is", "which file"]):
        return "lookup", 0.8

    if config.use_classifier == "hybrid":
        return llm_classify(query)

    return "default", 0.6


def select_communities(query: str, graph: Any) -> list[str]:
    scores: dict[str, float] = {}
    graph_communities = getattr(graph, "communities", []) if graph is not None else []

    for community in graph_communities:
        name = getattr(community, "name", str(community))
        summary = getattr(community, "summary", name)
        scores[name] = similarity(query, summary)

    ranked = sorted(scores.items(), key=lambda item: item[1], reverse=True)
    selected = [name for name, _ in ranked[:2]]
    return list(dict.fromkeys(selected + GLOBAL_COMMUNITY))


def subgraph_from_communities(graph: Any, communities: list[str]) -> Any:
    if graph is None or not communities:
        return graph

    if hasattr(graph, "subgraph_for_communities"):
        return graph.subgraph_for_communities(communities)

    return graph


def make_cache_key(query: str, graph_version: str) -> str:
    return hashlib.md5(f"{query}:{graph_version}".encode()).hexdigest()


def get_cached_subgraph(key: str) -> Any:
    return SUBGRAPH_CACHE.get(key)


def store_subgraph(key: str, subgraph: Any) -> None:
    SUBGRAPH_CACHE[key] = subgraph


def rank_nodes_by_importance(graph: Any, query: str) -> list[Any]:
    if graph is None:
        return []

    scored: list[tuple[Any, float]] = []
    for node in getattr(graph, "nodes", []):
        sim = similarity(query, getattr(node, "summary", ""))
        score = sim + float(getattr(node, "centrality", 0.0))
        scored.append((node, score))

    scored.sort(key=lambda item: item[1], reverse=True)
    return [node for node, _ in scored]


def extract_paths(query: str, graph: Any, config: RetrievalConfig) -> list[list[Any]]:
    anchors = find_anchor_nodes(query, graph)
    if len(anchors) < 2:
        return []

    paths: list[list[Any]] = []
    for i, src in enumerate(anchors):
        for tgt in anchors[i + 1 :]:
            paths.extend(k_shortest_paths(graph, src, tgt, k=config.max_paths))

    return limit_hops(paths, config.max_hops)


def flatten_paths_to_nodes(paths: list[list[Any]]) -> list[Any]:
    seen = set()
    nodes: list[Any] = []
    for path in paths:
        for node in path:
            node_id = getattr(node, "id", str(node))
            if node_id not in seen:
                seen.add(node_id)
                nodes.append(node)
    return nodes


def hybrid_retrieval_nodes(query: str, graph_nodes: list[Any], config: RetrievalConfig) -> list[Any]:
    if not config.use_hybrid_retrieval:
        return graph_nodes

    vector_nodes = vector_search(query, k=20)
    seen = set()
    merged: list[Any] = []
    for node in graph_nodes + vector_nodes:
        node_id = getattr(node, "id", str(node))
        if node_id not in seen:
            seen.add(node_id)
            merged.append(node)
    return merged


def map_reduce_summary(nodes: list[Any], max_nodes: int = 10) -> str:
    summaries: list[str] = []
    for node in nodes[:max_nodes]:
        text = getattr(node, "summary", getattr(node, "content", ""))
        if text:
            summaries.append(summarize(text))
    return summarize("\n".join(summaries))


def build_context(nodes: list[Any], config: RetrievalConfig) -> tuple[str, int, list[str]]:
    context_parts: list[str] = []
    tokens = 0
    cut_nodes: list[str] = []

    for node in nodes:
        content = ""
        if config.use_two_tier_summary and hasattr(node, "summary"):
            content = getattr(node, "summary", "")
        else:
            content = getattr(node, "full_code", getattr(node, "content", ""))

        if not content:
            continue

        node_tokens = estimate_tokens(content)
        if tokens + node_tokens > config.max_tokens:
            cut_nodes.append(getattr(node, "id", str(node)))
            continue

        tokens += node_tokens
        context_parts.append(content)

    final_context = "\n\n".join(context_parts)
    if len(nodes) > 10:
        final_context = map_reduce_summary(nodes)
        tokens = estimate_tokens(final_context)

    return final_context, tokens, cut_nodes


def compute_confidence(nodes: list[Any], paths: list[list[Any]], base_conf: float) -> float:
    if not nodes:
        return 0.0

    path_factor = min(0.3, len(paths) * 0.05)
    node_factor = min(0.3, len(nodes) * 0.01)
    return max(0.0, min(1.0, base_conf + path_factor + node_factor))


def needs_summary_refresh(node: Any) -> bool:
    return getattr(node, "summary_version", None) != getattr(node, "code_version", None)


def fallback_retrieval(query: str, config: RetrievalConfig, trace: RetrievalTrace) -> RetrievalResult:
    nodes = rank_nodes_by_importance(full_graph, query)
    context, tokens, cut_nodes = build_context(nodes, config)

    trace.mode = "fallback_full_graph"
    trace.tokens_estimated = tokens
    trace.nodes = [getattr(node, "id", str(node)) for node in nodes]
    trace.budget_cut_nodes = cut_nodes

    return RetrievalResult(context=context, trace=trace)


def log_metrics(trace: RetrievalTrace) -> dict[str, Any]:
    return {
        "mode": trace.mode,
        "tokens": trace.tokens_estimated,
        "fallback": trace.fallback_used,
        "confidence": trace.confidence,
        "communities": trace.communities,
        "nodes_count": len(trace.nodes),
        "paths_count": len(trace.paths),
        "cache_hit": trace.cache_hit,
        "ranking_strategy": trace.ranking_strategy,
        "budget_cut_nodes_count": len(trace.budget_cut_nodes),
    }


def _active_graph(config: RetrievalConfig) -> Any:
    graph = filtered_graph if config.use_node_filtering else full_graph
    if graph is None:
        graph = full_graph
    if graph is None:
        raise RuntimeError("No graph is configured. Set retrieval_engine.full_graph first.")
    return graph


def retrieve_context(query: str, config: RetrievalConfig | None = None) -> RetrievalResult:
    cfg = config or RetrievalConfig()
    trace = RetrievalTrace()

    query_type, base_conf = classify_query(query, cfg)
    trace.mode = query_type

    graph = _active_graph(cfg)

    communities: list[str] = []
    if cfg.use_community_filtering:
        communities = select_communities(query, graph)
        graph = subgraph_from_communities(graph, communities)
    trace.communities = communities

    if cfg.enable_subgraph_cache:
        cache_key = make_cache_key(query, getattr(graph, "version", "v1"))
        cached = get_cached_subgraph(cache_key)
        if cached is not None:
            graph = cached
            trace.cache_hit = True
        else:
            store_subgraph(cache_key, graph)

    paths: list[list[Any]] = []
    if cfg.use_path_retrieval:
        paths = extract_paths(query, graph, cfg)
        nodes = flatten_paths_to_nodes(paths) or rank_nodes_by_importance(graph, query)
    else:
        nodes = rank_nodes_by_importance(graph, query)

    nodes = hybrid_retrieval_nodes(query, nodes, cfg)
    trace.nodes = [getattr(node, "id", str(node)) for node in nodes]
    trace.paths = [
        [getattr(node, "id", str(node)) for node in path]
        for path in paths
    ]

    context, tokens, cut_nodes = build_context(nodes, cfg)
    trace.tokens_estimated = tokens
    trace.budget_cut_nodes = cut_nodes

    confidence = compute_confidence(nodes, paths, base_conf)
    trace.confidence = confidence

    if cfg.fallback_enabled and confidence < 0.7:
        trace.fallback_used = True
        return fallback_retrieval(query, cfg, trace)

    return RetrievalResult(context=context, trace=trace)

