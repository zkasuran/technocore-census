"""The index is the claim the whole project rests on, so its behaviour is asserted, not sampled.

Each test states a property of the ranking in the terms a reader would challenge it in:
does volume alone win, does a pasted line count, does a two-key mutual ring beat real
participation, can a nickname vouch for anyone.
"""

from __future__ import annotations

from technocore_census import index, messages
from technocore_census.collect import collect
from tests.conftest import (
    DID_A,
    DID_B,
    DID_C,
    DID_ONCE,
    DID_RING1,
    DID_RING2,
    client_for,
)


def _index(network):
    snapshot = collect(client_for(network), owner_sample=10, progress=lambda _m: None)
    return index.build(messages.build(snapshot))


def _row(built, did):
    return next(row for row in built["keys"] if row["identity"] == did)


def test_a_key_that_was_answered_outranks_one_that_was_not(network):
    built = _index(network)
    ranks = {row["identity"]: row["rank"] for row in built["keys"]}

    assert ranks[DID_A] < ranks[DID_ONCE]


def test_a_key_whose_only_message_is_a_shared_template_scores_zero(network):
    once = _row(_index(network), DID_ONCE)

    assert once["messages"] == 1
    assert once["originality"] == 0.0
    assert once["score"] == 0.0


def test_originality_is_the_share_of_messages_no_other_identity_posted(network):
    a = _row(_index(network), DID_A)

    # A wrote two original lines in `talk` and one copy of the template in `spam`.
    assert a["messages"] == 3
    assert a["duplicate_messages"] == 1
    assert a["originality"] == 0.6667


def test_a_self_asserted_nickname_is_measured_but_never_ranked(network):
    built = _index(network)

    assert all(row["signed"] for row in built["keys"])
    assert any(row["identity"] == "~alice" for row in built["nicknames"])
    assert all("rank" not in row for row in built["nicknames"])


def test_a_nickname_cannot_give_a_key_credit_for_being_answered():
    """The cheapest attack on the whole index: answer yourself under a typed name."""
    key = "did:key:z6Mkselfselfselfselfselfselfselfselfselfselfself"
    table = messages.Table()
    for seq, (author, text) in enumerate(
        [
            (key, "look at my important finding"),
            ("fan", "what an important finding"),
            (key, "thank you anonymous stranger"),
            ("fan", "no notes, flawless"),
        ],
        start=1,
    ):
        table.add(
            messages.Message(
                room="astroturf",
                seq=seq,
                ts=f"2026-08-24T10:0{seq}:00Z",
                author=author,
                text=text,
                signed=author.startswith("did:key:"),
                canonical=text,
            )
        )

    built = index.build(table)
    row = _row(built, key)

    assert row["distinct_responders"] == 0
    assert row["credit"] == 0
    assert row["score"] == 0.0


def test_a_two_key_mutual_ring_is_scored_below_real_participation(network):
    scores = {row["identity"]: row["score"] for row in _index(network)["keys"]}

    assert scores[DID_RING1] < scores[DID_A]
    assert scores[DID_RING1] < scores[DID_B]


def test_one_relationship_saturates_however_many_messages_it_carries():
    """A ring's credit is bounded; a key with many distinct peers is not."""
    ring = index.Entry("ring", signed=True)
    ring.messages = 500
    ring.answers_from["partner"] = 500

    broad = index.Entry("broad", signed=True)
    broad.messages = 12
    for peer in range(6):
        broad.answers_from[f"peer{peer}"] = 2

    assert ring.credit == index.MAX_ANSWERS_PER_RESPONDER
    assert broad.credit == 12
    assert broad.credit > ring.credit


def test_credit_grows_with_distinct_responders_rather_than_with_volume():
    def credit(responders: int, each: int) -> int:
        entry = index.Entry("k", signed=True)
        for peer in range(responders):
            entry.answers_from[f"p{peer}"] = each
        return entry.credit

    assert credit(8, 1) > credit(1, 8) or credit(8, 1) == credit(1, 8)
    assert credit(8, 2) > credit(2, 2)
    assert credit(1, 100) == index.MAX_ANSWERS_PER_RESPONDER


def test_reciprocity_halves_a_key_that_never_answers_anyone():
    entry = index.Entry("k", signed=True)
    entry.messages = 4
    entry.answers_from["other"] = 4
    broadcast = entry.score()

    entry.replies_given = 4
    mutual = entry.score()

    assert entry.reciprocity == 1.0
    assert mutual == 2 * broadcast


def test_an_empty_record_scores_zero_rather_than_dividing_by_nothing():
    entry = index.Entry("k", signed=True)

    assert entry.originality == 0.0
    assert entry.reciprocity == 0.0
    assert entry.score() == 0.0


def test_the_ranking_is_ordered_by_score_and_ranks_are_contiguous(network):
    keys = _index(network)["keys"]

    assert [row["rank"] for row in keys] == list(range(1, len(keys) + 1))
    assert all(
        keys[position]["score"] >= keys[position + 1]["score"] for position in range(len(keys) - 1)
    )
    assert {DID_A, DID_B, DID_C, DID_RING1, DID_RING2, DID_ONCE} <= {
        row["identity"] for row in keys
    }


def test_the_totals_agree_with_the_rows(network):
    built = _index(network)

    assert built["totals"]["keys_scored"] == len(built["keys"])
    assert built["totals"]["keys_one_message"] == sum(
        1 for row in built["keys"] if row["messages"] == 1
    )
    assert built["totals"]["keys_answered"] == sum(1 for row in built["keys"] if row["answered"])


def test_the_published_method_names_every_input_to_the_formula(network):
    formula = _index(network)["method"]["formula"]

    for part in ("credit", "originality", "reciprocity", "responders"):
        assert part in formula
