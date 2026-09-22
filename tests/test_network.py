"""The network export must draw the same graph the radar counts, and no bigger than it can render.

Each test builds a table by hand so the graph is known: a pair that answers each other is
one edge in one cluster, a ring that answers only itself is a cluster the radar calls
isolated, and a population past the cap proves the export stays a fixed, ordered size.
"""

from __future__ import annotations

from technocore_census import index, messages, network

DID_A = "did:key:z6MkaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaA"
DID_B = "did:key:z6MkbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbB"
DID_C = "did:key:z6MkccccccccccccccccccccccccccccccccccccccccccccC"
DID_R1 = "did:key:z6Mkr1r1r1r1r1r1r1r1r1r1r1r1r1r1r1r1r1r1r1r1r1r1"
DID_R2 = "did:key:z6Mkr2r2r2r2r2r2r2r2r2r2r2r2r2r2r2r2r2r2r2r2r2r2"


def _table(lines: list[tuple[str, str, str]]) -> messages.Table:
    """Build a table from (room, author, text) rows, one seq per room, no boilerplate."""
    table = messages.Table()
    seq_by_room: dict[str, int] = {}
    for room, author, text in lines:
        seq_by_room[room] = seq_by_room.get(room, 0) + 1
        seq = seq_by_room[room]
        table.add(
            messages.Message(
                room=room,
                seq=seq,
                ts=f"2026-08-24T10:{seq:02d}:00Z",
                author=author,
                text=text,
                signed=author.startswith("did:key:"),
                canonical=text,
            )
        )
    table.shared_texts = frozenset()
    return table


def _build(table: messages.Table) -> dict:
    return network.build(table, index.build(table))


def _node(built: dict, did: str) -> dict:
    return next(node for node in built["nodes"] if node["id"] == did)


def test_two_keys_that_answer_each_other_are_one_edge_in_one_cluster():
    # A, B, A: B answers A, then A answers B. Two reply adjacencies within the window
    # (A->B and B->A), so the single edge weighs 2.
    built = _build(
        _table(
            [
                ("duo", DID_A, "opening question"),
                ("duo", DID_B, "an answer to it"),
                ("duo", DID_A, "a reply back"),
            ]
        )
    )

    assert len(built["nodes"]) == 2
    assert built["edges"] == [{"source": DID_A, "target": DID_B, "weight": 2}]
    assert built["clusters"] == 1
    a, b = _node(built, DID_A), _node(built, DID_B)
    assert a["cluster"] == b["cluster"]
    assert a["isolated"] is False and b["isolated"] is False


def test_the_edge_weight_is_the_number_of_replies_along_it():
    # Prove the weight tracks the reply count both ways: one more exchange, one more on
    # the edge. A, B is a single adjacency (weight 1); adding A again makes it 2.
    one = _build(_table([("duo", DID_A, "one"), ("duo", DID_B, "two")]))
    two = _build(_table([("duo", DID_A, "one"), ("duo", DID_B, "two"), ("duo", DID_A, "three")]))

    assert one["edges"][0]["weight"] == 1
    assert two["edges"][0]["weight"] == 2


def test_a_ring_that_answers_only_itself_is_flagged_isolated():
    # A three-way exchange is the largest component, so it is not isolated. A two-key ring
    # that touches nobody else is, exactly as the radar defines it.
    built = _build(
        _table(
            [
                ("main", DID_A, "a1"),
                ("main", DID_B, "b1"),
                ("main", DID_C, "c1"),
                ("main", DID_A, "a2"),
                ("main", DID_B, "b2"),
                ("main", DID_C, "c2"),
                ("ring", DID_R1, "r1a"),
                ("ring", DID_R2, "r2a"),
                ("ring", DID_R1, "r1b"),
                ("ring", DID_R2, "r2b"),
            ]
        )
    )

    assert built["clusters"] == 2
    # The ring is one cluster, flagged isolated.
    r1, r2 = _node(built, DID_R1), _node(built, DID_R2)
    assert r1["cluster"] == r2["cluster"]
    assert r1["isolated"] is True and r2["isolated"] is True
    # The main exchange is a different cluster and is not isolated, proving the flag both
    # ways rather than only where it fires.
    a = _node(built, DID_A)
    assert _node(built, DID_B)["cluster"] == a["cluster"] == _node(built, DID_C)["cluster"]
    assert a["cluster"] != r1["cluster"]
    assert a["isolated"] is False


def test_the_export_is_capped_and_ordered_deterministically():
    # More keys than the cap, all chained into one room so every one is a graph node.
    dids = [f"did:key:z6Mk{i:044d}" for i in range(network.MAX_NODES + 40)]
    table = _build_chain(dids)

    first = network.build(table, index.build(table))
    second = network.build(table, index.build(table))

    assert len(first["nodes"]) == network.MAX_NODES
    # Nodes come out sorted by score descending, so the order is stable and not by chance.
    scores = [node["score"] for node in first["nodes"]]
    assert scores == sorted(scores, reverse=True)
    # Same input, same node order down to the id.
    assert [node["id"] for node in first["nodes"]] == [node["id"] for node in second["nodes"]]
    # Every drawn edge points at two drawn nodes, no dangling reference for the layout.
    ids = {node["id"] for node in first["nodes"]}
    assert all(edge["source"] in ids and edge["target"] in ids for edge in first["edges"])


def _build_chain(dids: list[str]) -> messages.Table:
    return _table([("hall", did, f"line from {i}") for i, did in enumerate(dids)])
