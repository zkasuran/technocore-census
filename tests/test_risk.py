"""Radar v2 stops one step short of an accusation, so both halves of that line are tested.

The score has to be zero for a clean record and high for the record with the sybil shape,
the reasons have to name the exact numbers that fired them (a bare score is the thing this
module refuses to publish), the bands have to partition at the published cuts, and the
aggregate has to account for every scored key. Each property is proved both ways: the clean
key stays clear when the bad signals are added one at a time, and the flag drops back to
clear when they are removed.
"""

from __future__ import annotations

from technocore_census import risk


def _row(**over) -> dict:
    """A full key row that reads as a clean, well-answered participant, overridable per test."""
    row = {
        "identity": "did:key:z6Mkcleancleancleancleancleancleancleancleanclean",
        "signed": True,
        "score": 42.0,
        "credit": 300,
        "messages": 100,
        "rooms": 8,
        "answered": 80,
        "distinct_responders": 40,
        "answered_others": 50,
        "replies_given": 90,
        "originality": 1.0,
        "reciprocity": 0.9,
        "duplicate_messages": 0,
        "self_repeats": 0,
        "first_seen": "2026-09-21T08:00:00Z",
        "last_seen": "2026-09-21T09:00:00Z",
    }
    row.update(over)
    return row


def test_a_clean_well_answered_key_scores_zero_with_no_reasons():
    out = risk.score_key(_row(), {})

    assert out["score"] == 0.0
    assert out["band"] == "clear"
    assert out["reasons"] == []


def test_the_sybil_shaped_record_flags_with_reasons_that_name_its_numbers():
    row = _row(
        originality=0.1,
        messages=20,
        self_repeats=16,
        duplicate_messages=18,
        distinct_responders=0,
        answered=0,
    )
    out = risk.score_key(row, {})

    assert out["band"] == "flag"
    assert out["score"] >= risk.FLAG_AT
    joined = " ".join(out["reasons"])
    # Every reason carries the concrete number, not just a verdict.
    assert "originality 0.1" in joined
    assert "self_repeats 16 of 20" in joined
    assert "distinct_responders 0" in joined
    assert "duplicate_messages 18" in joined


def test_each_bad_signal_only_moves_the_score_when_it_is_present():
    """Prove both ways: the clean key is clear, and adding one signal is what raises it."""
    assert risk.score_key(_row(), {})["reasons"] == []

    # Low originality alone fires only the originality reason.
    low_orig = risk.score_key(_row(originality=0.1), {})
    assert low_orig["score"] > 0.0
    assert len(low_orig["reasons"]) == 1
    assert "originality" in low_orig["reasons"][0]

    # Remove the bad originality and the reason and the score go with it.
    assert risk.score_key(_row(originality=1.0), {})["score"] == 0.0

    # Never-answered alone fires only when the key wrote enough to make silence meaningful.
    assert risk.score_key(_row(distinct_responders=0, messages=1), {})["reasons"] == []
    answered_none = risk.score_key(_row(distinct_responders=0, messages=10), {})
    assert len(answered_none["reasons"]) == 1
    assert "distinct_responders 0" in answered_none["reasons"][0]

    # A single peer answering enough times fires the one-peer term, not before.
    assert risk.score_key(_row(distinct_responders=1, answered=1), {})["reasons"] == []
    one_peer = risk.score_key(_row(distinct_responders=1, answered=12), {})
    assert len(one_peer["reasons"]) == 1
    assert "single peer" in one_peer["reasons"][0]


def test_the_bands_partition_at_the_published_cuts():
    # Just under and on each cut, both directions of the boundary.
    assert risk.band(0.0) == "clear"
    assert risk.band(risk.WATCH_AT - 0.0001) == "clear"
    assert risk.band(risk.WATCH_AT) == "watch"
    assert risk.band(risk.FLAG_AT - 0.0001) == "watch"
    assert risk.band(risk.FLAG_AT) == "flag"
    assert risk.band(1.0) == "flag"

    # A middling record with reasons lands in watch, not clear or flag.
    watch = risk.score_key(
        _row(originality=0.45, self_repeats=90, messages=100, distinct_responders=1, answered=5),
        {},
    )
    assert watch["band"] == "watch"
    assert watch["reasons"]


def test_attach_risk_scores_every_key_and_the_bands_account_for_all_of_them():
    keys = [
        _row(identity="did:key:z6Mkclear", originality=1.0),
        _row(
            identity="did:key:z6Mkwatch",
            originality=0.45,
            self_repeats=90,
            messages=100,
            distinct_responders=1,
            answered=5,
        ),
        _row(
            identity="did:key:z6Mkflag",
            originality=0.1,
            messages=20,
            self_repeats=16,
            duplicate_messages=18,
            distinct_responders=0,
            answered=0,
        ),
    ]
    report = {"index": {"keys": keys}, "radar": {"boilerplate": {}}}

    out = risk.attach_risk(report)
    scored_keys = out["index"]["keys"]
    agg = out["radar"]["risk"]

    # Every key carries a well-formed risk block.
    assert all("risk" in row for row in scored_keys)
    assert all(set(row["risk"]) == {"score", "band", "reasons"} for row in scored_keys)

    # The band counts partition the scored keys exactly.
    assert agg["scored"] == len(scored_keys)
    assert sum(agg["bands"].values()) == len(scored_keys)
    assert agg["bands"] == {"clear": 1, "watch": 1, "flag": 1}
    assert agg["flagged_share"] == round(1 / 3, 4)
    assert "0.30" in agg["method"] or "originality" in agg["method"]

    # Idempotent: a second pass over the same report yields identical bytes.
    import copy

    once = copy.deepcopy(out)
    twice = risk.attach_risk(out)
    assert twice["index"]["keys"] == once["index"]["keys"]
    assert twice["radar"]["risk"] == once["radar"]["risk"]


def test_attach_risk_handles_an_empty_key_set():
    out = risk.attach_risk({"index": {"keys": []}, "radar": {}})

    assert out["radar"]["risk"]["scored"] == 0
    assert out["radar"]["risk"]["bands"] == {"clear": 0, "watch": 0, "flag": 0}
    assert out["radar"]["risk"]["flagged_share"] is None
