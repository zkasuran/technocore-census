"""The interaction network: the reply relation as nodes and edges to draw.

The radar already reduces who-answers-whom to a verdict-free set of numbers: how many
connected components the reply graph splits into, how big the largest one is, and which
small self-talking clusters sit outside it. This module exports the same graph as an
explicit node and edge list so a force-directed view can render it, with the isolated
clusters colored apart.

The rule for an edge and the rule for a cluster are the radar's, not a second definition.
Two signed keys are joined when one wrote within `radar.EDGE_DISTANCE` messages of the
other in the same room, the connected components come from `radar._components`, and a
cluster is "isolated" exactly when the radar calls it so: any component that is not the
largest and holds at least two keys. The radar does not return the per-edge count or the
adjacency itself, so both are rebuilt here by walking the snapshot table the same way
`radar._clusters` does. Anything the radar reports as a number, this graph reproduces.

The full graph is tens of thousands of keys, which no browser can lay out and which hides
the very clusters the view exists to show. So the export is capped to the top keys by
contribution score plus the reply edges among them. Score is positive only for a key some
other key answered, so a self-talking ring keeps a small positive score and outranks the
long tail of keys nobody ever answered, which is why capping by score still surfaces the
isolated clusters rather than burying them.
"""

from __future__ import annotations

from collections import Counter, defaultdict

from . import radar
from .messages import Table

# The most nodes to export. A force-directed layout is unreadable past a few hundred, and
# the point is to see the isolated clusters, not to redraw the whole population.
MAX_NODES = 200


def build(table: Table, index_result: dict) -> dict:
    """Turn the reply graph into nodes and edges, capped to the top keys by score.

    `table` is the flattened snapshot, `index_result` is `index.build(table)`, read only
    for each key's published score. Same inputs, same bytes.
    """
    edges, weights = _reply_graph(table)

    components = sorted(radar._components(edges), key=len, reverse=True)
    cluster_of: dict[str, int] = {}
    isolated_of: dict[str, bool] = {}
    for cluster_id, group in enumerate(components):
        insular = cluster_id >= 1 and len(group) >= 2
        for key in group:
            cluster_of[key] = cluster_id
            isolated_of[key] = insular

    scores = {row["identity"]: row["score"] for row in index_result.get("keys") or []}

    # Top keys by score, then by id so the order never depends on the hash seed. Every
    # graph node is a signed key, so no nickname reaches this list.
    ranked = sorted(edges, key=lambda key: (-scores.get(key, 0.0), key))
    kept = set(ranked[:MAX_NODES])

    nodes = [
        {
            "id": key,
            "short": _short(key),
            "signed": key.startswith("did:key:"),
            "score": scores.get(key, 0.0),
            "cluster": cluster_of[key],
            "isolated": isolated_of[key],
        }
        for key in sorted(kept, key=lambda key: (-scores.get(key, 0.0), key))
    ]

    out_edges = [
        {"source": a, "target": b, "weight": weight}
        for (a, b), weight in sorted(weights.items())
        if a in kept and b in kept
    ]

    drawn_clusters = len({node["cluster"] for node in nodes})
    return {
        "nodes": nodes,
        "edges": out_edges,
        "clusters": len(components),
        "note": (
            "Nodes are signed keys, an edge joins two keys that wrote within "
            f"{radar.EDGE_DISTANCE} messages of each other in one room, and its weight is "
            "how many times that happened. Cluster is the connected-component id from that "
            "graph and isolated marks a small cluster outside the largest component, both "
            "the same definitions the radar reports. The export is capped to the top "
            f"{MAX_NODES} keys by contribution score plus the edges among them, so "
            f"{drawn_clusters} of {len(components)} clusters are drawn here while the radar "
            "counts them all. A self-talking cluster is a pattern, not a verdict."
        ),
    }


def _reply_graph(table: Table) -> tuple[dict[str, set[str]], dict[tuple[str, str], int]]:
    """Rebuild the radar's reply adjacency, plus the per-edge reply count it does not return.

    This is the identical walk as `radar._clusters`: per room, each signed message joins
    the next `radar.EDGE_DISTANCE` signed messages by a different key. The edge set is what
    the radar feeds `_components`, so the components and isolated clusters here match its
    numbers exactly. The only thing added is `weights`, the number of such adjacencies on
    each undirected edge, which is the edge weight the graph draws.
    """
    edges: dict[str, set[str]] = defaultdict(set)
    weights: Counter[tuple[str, str]] = Counter()
    for slice_ in table.by_room.values():
        for position, message in enumerate(slice_):
            if not message.signed:
                continue
            for later in slice_[position + 1 : position + 1 + radar.EDGE_DISTANCE]:
                if not later.signed or later.identity == message.identity:
                    continue
                edges[message.identity].add(later.identity)
                edges[later.identity].add(message.identity)
                pair = tuple(sorted((message.identity, later.identity)))
                weights[pair] += 1
    return edges, dict(weights)


def _short(did: str) -> str:
    """A readable label for a DID, matching the frontend's `shortDid`."""
    tail = did[len("did:key:z") :] if did.startswith("did:key:z") else did
    return f"{tail[:4]}…{tail[-6:]}" if len(tail) > 12 else tail
