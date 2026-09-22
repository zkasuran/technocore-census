"""Assemble one report from one snapshot. Pure: same snapshot, same bytes.

The report is the contract between the collector and everything that renders it (the
site, the badges, the note the arena publishes back into Technocore). Keeping it a pure
function of the snapshot is what makes the published numbers checkable: a stranger clones
the repo, runs this over the committed snapshot and gets the identical file.
"""

from __future__ import annotations

from pathlib import Path

from . import VERSION, census, feed, history, index, messages, network, radar, risk

SCHEMA = "technocore-census-report-v1"


def build(snapshot: dict, history_dir: Path | None = None) -> dict:
    """Census, contribution index, radar, feed, network and per-key risk over one snapshot.

    Pure over the snapshot alone: the same snapshot gives the same bytes. When a
    `history_dir` of prior dated reports is passed, per-key rank movement and a longitudinal
    series are folded in as well, which is still reproducible because those reports are
    committed to the repo.
    """
    table = messages.build(snapshot)
    contribution = index.build(table)
    report = {
        "schema": SCHEMA,
        "generator": f"technocore-census/{VERSION}",
        "snapshot": {
            "captured_at": snapshot.get("captured_at"),
            "base_url": snapshot.get("base_url"),
            "collection": snapshot.get("collection"),
        },
        "census": census.summarize(snapshot, table),
        "index": contribution,
        "radar": radar.build(snapshot, table, contribution),
        "feed": feed.build(table),
        "network": network.build(table, contribution),
    }
    risk.attach_risk(report)
    if history_dir is not None:
        history.attach_movement(report, history_dir)
    return report
