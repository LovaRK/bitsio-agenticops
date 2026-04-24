from dataclasses import dataclass

import graphify.retrieval_engine as engine


@dataclass
class DummyNode:
    id: str
    summary: str = ""
    content: str = ""
    full_code: str = ""
    centrality: float = 0.0
    summary_version: str = "v1"
    code_version: str = "v1"


class DummyCommunity:
    def __init__(self, name: str, summary: str):
        self.name = name
        self.summary = summary


class DummyGraph:
    def __init__(self, nodes, communities=None, version="v1"):
        self.nodes = nodes
        self.communities = communities or []
        self.version = version

    def subgraph_for_communities(self, communities):
        del communities
        return self


def setup_function(_):
    engine.SUBGRAPH_CACHE.clear()
    engine.GLOBAL_COMMUNITY[:] = []
    engine.full_graph = None
    engine.filtered_graph = None


def test_classify_query_runtime_rule():
    mode, conf = engine.classify_query(
        "show exception stack trace",
        engine.RetrievalConfig(use_classifier="rule"),
    )
    assert mode == "runtime"
    assert conf == 0.9


def test_retrieve_context_raises_without_graph():
    try:
        engine.retrieve_context("how does telemetry work?")
    except RuntimeError as exc:
        assert "No graph is configured" in str(exc)
    else:
        raise AssertionError("Expected RuntimeError when no graph is configured.")


def test_retrieve_context_success_uses_ranked_nodes(monkeypatch):
    graph = DummyGraph(
        [
            DummyNode(id="n1", summary="architecture overview", centrality=0.2),
            DummyNode(id="n2", summary="runtime exceptions", centrality=0.1),
        ],
        communities=[DummyCommunity("core", "core architecture")],
    )
    engine.full_graph = graph
    engine.filtered_graph = graph

    monkeypatch.setattr(engine, "similarity", lambda q, t: 1.0 if "arch" in t else 0.1)
    monkeypatch.setattr(engine, "find_anchor_nodes", lambda q, g: [])
    monkeypatch.setattr(engine, "vector_search", lambda q, k=20: [])

    config = engine.RetrievalConfig(
        use_classifier="off",
        use_path_retrieval=True,
        use_hybrid_retrieval=True,
        fallback_enabled=False,
    )
    result = engine.retrieve_context("architecture", config)

    assert "architecture overview" in result.context
    assert result.trace.nodes[0] == "n1"
    assert result.trace.fallback_used is False
    assert result.trace.cache_hit is False


def test_retrieve_context_fallback_when_low_confidence(monkeypatch):
    graph = DummyGraph([DummyNode(id="n1", summary="x")])
    engine.full_graph = graph
    engine.filtered_graph = graph

    monkeypatch.setattr(engine, "find_anchor_nodes", lambda q, g: [])
    monkeypatch.setattr(engine, "vector_search", lambda q, k=20: [])
    monkeypatch.setattr(engine, "classify_query", lambda q, c: ("default", 0.0))

    config = engine.RetrievalConfig(
        use_classifier="off",
        fallback_enabled=True,
        use_hybrid_retrieval=False,
    )
    result = engine.retrieve_context("anything", config)

    assert result.trace.fallback_used is True
    assert result.trace.mode == "fallback_full_graph"


def test_cache_hit_on_second_identical_query(monkeypatch):
    graph = DummyGraph([DummyNode(id="n1", summary="s")], version="v2")
    engine.full_graph = graph
    engine.filtered_graph = graph

    monkeypatch.setattr(engine, "find_anchor_nodes", lambda q, g: [])
    monkeypatch.setattr(engine, "vector_search", lambda q, k=20: [])

    config = engine.RetrievalConfig(
        enable_subgraph_cache=True,
        fallback_enabled=False,
        use_hybrid_retrieval=False,
    )
    first = engine.retrieve_context("q", config)
    second = engine.retrieve_context("q", config)

    assert first.trace.cache_hit is False
    assert second.trace.cache_hit is True


def test_needs_summary_refresh():
    stale = DummyNode(id="n1", summary_version="a", code_version="b")
    fresh = DummyNode(id="n2", summary_version="a", code_version="a")
    assert engine.needs_summary_refresh(stale) is True
    assert engine.needs_summary_refresh(fresh) is False

