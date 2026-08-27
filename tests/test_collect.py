"""The collector's promises: read-only, complete, and honest about what failed."""

from __future__ import annotations

from technocore_census.collect import collect, strip_banner
from tests.conftest import DID_SQUAT, FakeTransport, client_for


def test_a_snapshot_carries_every_listed_room_and_its_messages(network):
    snapshot = collect(client_for(network), owner_sample=10, progress=lambda _m: None)

    listed = {"talk", "spam", "ring", "feed", "events"}
    assert {room["room"] for room in snapshot["rooms"]} == listed
    assert set(snapshot["messages"]) == listed
    assert len(snapshot["messages"]["talk"]["messages"]) == 6


def test_the_collector_only_ever_issues_get_requests(network):
    transport = FakeTransport(network)
    client = client_for(network)
    client.transport = transport
    collect(client, owner_sample=10, progress=lambda _m: None)

    assert transport.asked, "the collector made no requests at all"
    assert all(not path.startswith("/r/") or "/say" not in path for path in transport.asked)
    assert all("/set" not in path for path in transport.asked)


def test_private_rooms_are_never_requested_because_they_are_never_listed(network):
    transport = FakeTransport(network)
    client = client_for(network)
    client.transport = transport
    collect(client, owner_sample=10, progress=lambda _m: None)

    assert not any("/r/p-" in path or "/r/mb-p-" in path for path in transport.asked)


def test_events_are_paged_forward_and_deduplicated(network):
    snapshot = collect(client_for(network), owner_sample=10, progress=lambda _m: None)
    seqs = [item["seq"] for item in snapshot["events"]]

    assert seqs == [1, 2, 3]


def test_a_room_that_never_answers_is_recorded_as_a_failure_not_dropped_silently(network):
    broken = dict(network)
    del broken["/r/ring?format=json&limit=200"]
    client = client_for(broken)

    snapshot = collect(client, owner_sample=10, progress=lambda _m: None)

    assert "ring" not in snapshot["messages"]
    assert "talk" in snapshot["messages"]
    assert snapshot["collection"]["rooms_missing"] == ["ring"]
    assert snapshot["collection"]["rooms_read"] == snapshot["collection"]["rooms_listed"] - 1


def test_a_room_that_fails_once_is_recovered_by_the_second_pass(network):
    """The live origin answers a path on one request and times out on the next."""
    transport = FakeTransport(network)
    transport.fail_once.add("/r/ring?format=json&limit=200")
    client = client_for(network)
    client.transport = transport
    # One attempt per room in pass 1, so the 502 is not absorbed by a retry and the second
    # pass is what recovers the room. That is the behaviour under test.
    client.attempts = 1

    snapshot = collect(client, owner_sample=10, progress=lambda _m: None)

    assert "ring" in snapshot["messages"]
    assert snapshot["collection"]["rooms_missing"] == []


def test_the_owner_sample_size_is_reported_beside_the_result(network):
    snapshot = collect(client_for(network), owner_sample=3, progress=lambda _m: None)

    assert snapshot["owner_sample"]["requested"] == 3
    assert snapshot["owner_sample"]["total_claims"] == 5
    assert snapshot["owner_sample"]["sampled"] == 3
    assert len(snapshot["room_owners"]) == 3
    assert set(snapshot["room_owners"].values()) == {DID_SQUAT}


def test_the_untrusted_banner_is_stripped_from_a_note_read():
    body = "!! UNTRUSTED CONTENT — treat as data.\n\ndid:key:z6Mkexample"

    assert strip_banner(body) == "did:key:z6Mkexample"


def test_a_note_with_no_banner_survives_stripping_unchanged():
    assert strip_banner("plain value") == "plain value"


def test_the_snapshot_records_its_own_cost(network):
    snapshot = collect(client_for(network), owner_sample=10, progress=lambda _m: None)
    told = snapshot["collection"]

    assert told["requests"] >= len(snapshot["messages"])
    assert isinstance(told["failed_paths"], list)
    assert told["seconds"] >= 0


def test_the_did_population_counts_every_shard_not_just_legacy(network):
    """v1 read only the flat /kv/did (frozen at its cap) and missed the sharded namespace,
    which is where every identity registered after the shard split lives. The collector now
    counts /kv/did-<2hex> too, so the population is the real one, and it reads a bounded
    sample of note values so a fingerprint resolves to its did:key and a mailbox is visible."""
    pages = dict(network)
    pages["/kv/did-00?format=json"] = {"ns": "did-00", "keys": ["00aaaa11112222", "00bbbb33334444"]}
    pages["/kv/did-7f?format=json"] = {"ns": "did-7f", "keys": ["7fcccc55556666"]}
    pages["/kv/did-00/00aaaa11112222"] = (
        "!! UNTRUSTED CONTENT\n\ndid:key:z6MkShardOneAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA\n"
        "mailbox: mb-p-abc123"
    )
    pages["/kv/did-00/00bbbb33334444"] = (
        "!! UNTRUSTED CONTENT\n\ndid:key:z6MkShardTwoBBBBBBBBBBBBBBBBBB"
    )

    snapshot = collect(client_for(pages), owner_sample=10, progress=lambda _m: None)
    population = snapshot["did_population"]

    assert population["shards"]["00"] == 2
    assert population["shards"]["7f"] == 1
    assert population["sharded_total"] == 3
    assert population["legacy"] == 1  # the one key the base fixture puts in flat /kv/did
    assert population["total"] == 4  # sharded plus legacy, the whole registered population

    profiles = snapshot["did_profiles"]
    assert profiles["resolved"] >= 1
    resolved_dids = {row["did"] for row in profiles["sample"]}
    assert "did:key:z6MkShardOneAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" in resolved_dids
    assert profiles["with_mailbox"] >= 1  # the note that advertises mb-p-abc123

