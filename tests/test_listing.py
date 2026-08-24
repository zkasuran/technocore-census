"""The listing is the one path a run cannot proceed without, so its fallback is pinned."""

from __future__ import annotations

import pytest

from technocore_census.client import FetchError
from technocore_census.collect import collect
from tests.conftest import FakeTransport, client_for


def _quiet(_message: str) -> None:
    pass


def test_the_full_page_is_asked_for_first(network):
    transport = FakeTransport(network)
    client = client_for(network)
    client.transport = transport

    collect(client, owner_sample=5, progress=_quiet)

    assert transport.asked[0] == "/rooms?format=json&limit=200"
    assert "/rooms?format=json&limit=100" not in transport.asked


def test_a_smaller_page_is_tried_when_the_big_one_never_answers(network):
    """Under load the 200-room listing is the request that times out, not /healthz."""
    reduced = dict(network)
    del reduced["/rooms?format=json&limit=200"]
    reduced["/rooms?format=json&limit=100"] = network["/rooms?format=json&limit=200"]
    transport = FakeTransport(reduced)
    client = client_for(reduced)
    client.transport = transport

    snapshot = collect(client, owner_sample=5, progress=_quiet)

    assert "/rooms?format=json&limit=100" in transport.asked
    assert len(snapshot["rooms"]) == 5
    assert snapshot["messages"]


def test_a_listing_that_never_answers_at_any_size_fails_the_run(network):
    empty = {key: value for key, value in network.items() if not key.startswith("/rooms")}

    with pytest.raises(FetchError, match="never answered"):
        collect(client_for(empty), owner_sample=5, progress=_quiet)


def test_the_reduced_page_size_is_visible_in_the_progress_output(network):
    reduced = dict(network)
    del reduced["/rooms?format=json&limit=200"]
    reduced["/rooms?format=json&limit=50"] = network["/rooms?format=json&limit=200"]
    said: list[str] = []

    collect(client_for(reduced), owner_sample=5, progress=said.append)

    assert any("only serve 50 rooms" in line for line in said)
