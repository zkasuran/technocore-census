"""The radar's job is to describe patterns without accusing anyone, so both halves are tested.

Each measurement has a value it must hit on the synthetic network, and the framing fields
(the method note, the sampled-claim count) are asserted too: a sampled number presented as
complete is the specific way this kind of page misleads.
"""

from __future__ import annotations

from technocore_census import index, messages, radar
from technocore_census.collect import collect
from tests.conftest import DID_ONCE, DID_SQUAT, client_for


def _radar(network, owner_sample: int = 10):
    snapshot = collect(client_for(network), owner_sample=owner_sample)
    table = messages.build(snapshot)
    return radar.build(snapshot, table, index.build(table)), snapshot


def test_the_copied_share_counts_every_copy_of_a_shared_text(network):
    built, _ = _radar(network)
    boiler = built["boilerplate"]

    # Three identities posted the template, one message each. 17 messages are read in
    # total: 6 in talk, 3 in spam, 4 in ring, 4 in feed. `events` is excluded.
    assert boiler["shared_texts"] == 1
    assert boiler["copied_messages"] == 3
    assert boiler["messages_in_window"] == 17
    assert boiler["copied_share"] == round(3 / 17, 4)


def test_the_top_template_reports_how_many_identities_posted_it(network):
    built, _ = _radar(network)
    top = built["boilerplate"]["top_templates"][0]

    assert top["identities"] == 3
    assert top["messages"] == 3
    assert "Technocore contribution" in top["sample"]


def test_a_key_that_wrote_once_is_counted_in_the_one_message_share(network):
    built, _ = _radar(network)
    keys = built["keys"]

    assert keys["one_message"] >= 1
    assert 0 < keys["one_message_share"] <= 1
    assert keys["entirely_boilerplate"] >= 1


def test_a_key_no_signed_peer_answered_is_counted_without_being_named(network):
    built, _ = _radar(network)

    assert built["keys"]["never_answered"] >= 1
    assert DID_ONCE not in repr(built["keys"])


def test_never_answered_ignores_replies_from_typed_nicknames():
    """A nickname answering is not evidence anyone answered."""
    key = "did:key:z6Mkselfselfselfselfselfselfselfselfselfselfself"
    table = messages.Table()
    for seq, (author, text) in enumerate(
        [(key, "first line"), ("fan", "second line"), (key, "third line"), ("fan", "fourth")],
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
    table.shared_texts = frozenset()
    built = radar.build({}, table, index.build(table))

    assert built["keys"]["scored"] == 1
    assert built["keys"]["never_answered"] == 1
    assert built["keys"]["never_answered_share"] == 1.0


def test_claim_clusters_group_by_owning_key(network):
    built, _ = _radar(network)
    claims = built["claims"]

    assert claims["claims_total"] == 5
    assert claims["largest_cluster"] == 5
    assert claims["clusters"][0]["owner"] == DID_SQUAT
    assert claims["clusters"][0]["rooms_claimed"] == 5


def test_claimed_rooms_with_no_messages_are_counted_as_unused(network):
    built, _ = _radar(network)

    # None of the five claimed rooms appear in the listing, so all five are unused.
    assert built["claims"]["claimed_not_listed"] == 5


def test_a_sampled_claim_resolution_reports_its_own_sample_size(network):
    built, _ = _radar(network, owner_sample=2)
    claims = built["claims"]

    assert claims["claims_total"] == 5
    assert claims["claims_resolved"] == 2
    assert claims["resolved_note"]["requested"] == 2
    assert claims["resolved_note"]["sampled"] == 2


def test_the_ring_sits_outside_the_main_component_and_the_exchange_does_not(network):
    built, _ = _radar(network)
    clusters = built["clusters"]

    assert clusters["isolated_clusters"] == 1
    assert clusters["largest_isolated_cluster"] == 2
    members = clusters["top_isolated_clusters"][0]["members"]
    assert all(member.startswith("did:key:z6Mkr") for member in members)


def test_the_main_component_holds_most_of_the_signed_traffic(network):
    built, _ = _radar(network)
    clusters = built["clusters"]

    assert clusters["largest_component"] >= 3
    assert clusters["largest_component_share"] > clusters["isolated_message_share"]


def test_a_key_answered_only_by_one_peer_is_counted_once_it_has_enough_answers():
    key = "did:key:z6Mkpairpairpairpairpairpairpairpairpairpairpair"
    peer = "did:key:z6Mkpeerpeerpeerpeerpeerpeerpeerpeerpeerpeerpeer"
    table = messages.Table()
    seq = 0
    for _round in range(6):
        for author in (key, peer):
            seq += 1
            table.add(
                messages.Message(
                    room="pair",
                    seq=seq,
                    ts=f"2026-08-24T10:{seq:02d}:00Z",
                    author=author,
                    text=f"line {seq}",
                    signed=True,
                    canonical=f"line {seq}",
                )
            )
    built = radar.build({}, table, index.build(table))

    assert built["clusters"]["keys_answered_by_one_peer_only"] == 2


def test_the_radar_states_that_a_pattern_is_not_a_verdict(network):
    built, _ = _radar(network)
    note = built["method"]["note"].lower()

    assert "patterns, not verdicts" in note
    assert "may be a new arrival" in note
