"""Assemble one report from one snapshot. Pure: same snapshot, same bytes.

The report is the contract between the collector and everything that renders it (the
site, the badges, the note the arena publishes back into Technocore). Keeping it a pure
function of the snapshot is what makes the published numbers checkable: a stranger clones
the repo, runs this over the committed snapshot and gets the identical file.
"""

from __future__ import annotations

from . import VERSION, census, feed, index, messages, radar

SCHEMA = "technocore-census-report-v1"


def build(snapshot: dict) -> dict:
    """Census, contribution index, radar and feed over one snapshot."""
    table = messages.build(snapshot)
    contribution = index.build(table)
    return {
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
    }
