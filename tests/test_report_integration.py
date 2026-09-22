"""The whole report has to hang together, not just each block on its own.

The unit tests prove `network.build` draws the graph the radar counts and `risk.score_key`
scores one row. This file proves the assembled `report.build(snapshot)` wires those two
next-level features into one document whose pieces agree: the network reports the same
component count the radar does, every scored key carries a well-formed risk band, the
aggregate band counts account for exactly the scored keys, and the whole thing is still a
pure function of the snapshot down to the byte.

It runs against the committed `data/snapshot.json`, the same input a stranger cloning the
repo would build from, so the numbers asserted are the published ones rather than a
synthetic stand-in. If that file is absent from a checkout the test skips with a message
naming what to fetch, which is a real gap rather than a false pass.
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from technocore_census import report

SNAPSHOT = Path(__file__).resolve().parents[1] / "data" / "snapshot.json"
BANDS = {"clear", "watch", "flag"}


@pytest.fixture(scope="module")
def snapshot() -> dict:
    if not SNAPSHOT.exists():
        pytest.skip(
            f"committed snapshot missing at {SNAPSHOT}; run the collector to write it "
            "before this integration test can build the real report"
        )
    return json.loads(SNAPSHOT.read_text(encoding="utf-8"))


@pytest.fixture(scope="module")
def built(snapshot: dict) -> dict:
    return report.build(snapshot)


def test_the_report_carries_both_next_level_blocks(built: dict):
    # network and radar.risk are the two features this wave added; a report without either
    # is a regression the older block-level tests would not catch.
    assert "network" in built
    network = built["network"]
    assert isinstance(network.get("nodes"), list) and network["nodes"]
    assert isinstance(network.get("edges"), list)
    assert isinstance(network.get("clusters"), int)

    risk = built["radar"]["risk"]
    assert set(risk) >= {"scored", "bands", "flagged_share", "method"}
    assert set(risk["bands"]) == BANDS


def test_the_network_reports_the_same_component_count_as_the_radar(built: dict):
    # Both walk the identical reply graph, so the network's cluster count is the radar's
    # component count by construction. If they ever diverge the two blocks are counting
    # different graphs and the site would draw a number the radar contradicts.
    assert built["network"]["clusters"] == built["radar"]["clusters"]["components"]


def test_every_scored_key_has_a_well_formed_risk_band(built: dict):
    keys = built["index"]["keys"]
    assert keys, "the index scored no keys, so risk has nothing to attach to"
    for row in keys:
        risk = row.get("risk")
        assert isinstance(risk, dict), f"{row['identity']} has no risk dict"
        assert set(risk) == {"score", "band", "reasons"}
        assert risk["band"] in BANDS
        assert 0.0 <= risk["score"] <= 1.0
        assert isinstance(risk["reasons"], list)
        # The module's own contract: an empty reason list is exactly the clear band, since
        # the score is the sum of the reasons.
        if not risk["reasons"]:
            assert risk["band"] == "clear"
            assert risk["score"] == 0.0


def test_the_aggregate_band_counts_account_for_every_scored_key(built: dict):
    keys = built["index"]["keys"]
    risk = built["radar"]["risk"]

    assert risk["scored"] == len(keys)
    assert sum(risk["bands"].values()) == risk["scored"]

    # The aggregate is not just internally consistent, it matches a recount of the per-key
    # bands, so the number the site shows is the number the rows carry.
    recount = {"clear": 0, "watch": 0, "flag": 0}
    for row in keys:
        recount[row["risk"]["band"]] += 1
    assert risk["bands"] == recount

    flagged = risk["bands"]["flag"]
    expected_share = round(flagged / risk["scored"], 4) if risk["scored"] else None
    assert risk["flagged_share"] == expected_share


def test_every_network_node_is_a_signed_key_with_a_drawable_cluster(built: dict):
    network = built["network"]
    node_ids = {node["id"] for node in network["nodes"]}

    for node in network["nodes"]:
        assert node["signed"] is True
        assert node["id"].startswith("did:key:")
        assert isinstance(node["cluster"], int)
        assert isinstance(node["isolated"], bool)
        assert node["score"] >= 0.0

    # Every drawn edge points at two drawn nodes, so a force layout has no dangling
    # reference, and its weight is a positive count.
    for edge in network["edges"]:
        assert edge["source"] in node_ids
        assert edge["target"] in node_ids
        assert edge["weight"] >= 1


def test_the_report_is_byte_for_byte_identical_across_two_builds(snapshot: dict):
    # The project's whole claim is that a stranger re-derives what it publishes. Prove it
    # for the full assembled report, serialized the way the pipeline writes it.
    first = json.dumps(report.build(snapshot), sort_keys=True, ensure_ascii=False)
    second = json.dumps(report.build(snapshot), sort_keys=True, ensure_ascii=False)
    assert first == second


def test_the_new_fields_specifically_are_stable_across_builds(snapshot: dict):
    # Narrow the determinism claim onto the two features this wave added, so a set-order
    # leak in either one fails here with a pointed message rather than in the whole-report
    # diff. Network node order and per-key risk are the two that could wobble.
    one = report.build(snapshot)
    two = report.build(snapshot)

    assert [node["id"] for node in one["network"]["nodes"]] == [
        node["id"] for node in two["network"]["nodes"]
    ]
    assert one["network"]["edges"] == two["network"]["edges"]
    assert one["radar"]["risk"] == two["radar"]["risk"]

    one_risk = {row["identity"]: row["risk"] for row in one["index"]["keys"]}
    two_risk = {row["identity"]: row["risk"] for row in two["index"]["keys"]}
    assert one_risk == two_risk
