"""The client's job is to survive a busy origin without lying about what it read."""

from __future__ import annotations

import pytest

from technocore_census.client import Client, FetchError, Response, _retry_after
from tests.conftest import FakeTransport, client_for


def test_a_transient_502_is_retried_and_the_retry_is_counted():
    transport = FakeTransport({"/rooms": {"ok": True}})
    transport.fail_once.add("/rooms")
    client = Client(transport=transport, delay=0.0, sleep=lambda _s: None)

    assert client.json("/rooms") == {"ok": True}
    assert client.retries == 1
    assert client.requests == 2
    assert client.failures == []


def test_a_transport_failure_is_retried_rather_than_ending_the_run():
    """Status 0 means nothing came back. It is the common case against a busy origin."""

    class TimeoutOnce:
        base_url = "https://example.test"

        def __init__(self) -> None:
            self.calls = 0

        def get(self, path: str) -> Response:
            self.calls += 1
            if self.calls == 1:
                return Response(path, 0, "The read operation timed out")
            return Response(path, 200, '{"ok": true}')

    client = Client(transport=TimeoutOnce(), delay=0.0, sleep=lambda _s: None)

    assert client.json("/rooms") == {"ok": True}
    assert client.retries == 1


def test_a_404_is_never_retried_because_the_path_will_not_appear():
    client = client_for({})

    with pytest.raises(FetchError, match="HTTP 404"):
        client.get("/kv/did/nope")
    assert client.requests == 1
    assert client.retries == 0


def test_giving_up_records_the_path_so_the_snapshot_can_report_it():
    class Always502:
        base_url = "https://example.test"

        def get(self, path: str) -> Response:
            return Response(path, 502, "error code: 502")

    client = Client(transport=Always502(), delay=0.0, attempts=3, sleep=lambda _s: None)

    with pytest.raises(FetchError, match="gave up after 3"):
        client.get("/rooms")
    assert client.failures == ["/rooms"]
    assert client.requests == 3


def test_try_json_swallows_a_missing_path_but_not_a_working_one():
    client = client_for({"/rooms": {"rooms": []}})

    assert client.try_json("/rooms") == {"rooms": []}
    assert client.try_json("/gone") is None


def test_a_non_json_body_on_a_json_path_is_an_error_not_a_silent_none():
    client = client_for({"/rooms": "plain text, not json"})

    with pytest.raises(FetchError, match="expected JSON"):
        client.json("/rooms")


def test_the_429_body_sets_the_wait_because_harnesses_drop_headers():
    body = "429 rate limited: bucket write, refill 30/min, wait 7 seconds before retrying."

    assert _retry_after(body) == 7.0


def test_a_429_body_with_no_number_falls_back_to_backoff():
    assert _retry_after("429 slow down") is None


def test_a_stated_wait_is_capped_so_a_hostile_body_cannot_stall_a_run():
    client = client_for({})
    reply = Response("/r/x", 429, "wait 9999 seconds")

    assert client._backoff(0, reply) <= 60.0


def test_pacing_waits_between_requests_but_not_before_the_first():
    slept: list[float] = []
    transport = FakeTransport({"/a": {}, "/b": {}})
    client = Client(transport=transport, delay=0.25, sleep=slept.append)

    client.json("/a")
    client.json("/b")

    assert len(slept) == 1
    assert slept[0] == pytest.approx(0.25, abs=0.01)


def test_pacing_is_shared_so_concurrent_readers_do_not_multiply_the_rate():
    """Eight workers each pacing themselves would be eight times the intended rate."""
    slept: list[float] = []
    transport = FakeTransport({f"/r/{n}": {"room": n} for n in range(8)})
    client = Client(transport=transport, delay=0.1, sleep=slept.append)

    found = client.map([f"/r/{n}" for n in range(8)], workers=4)

    assert len(found) == 8
    assert client.requests == 8
    # Seven waits for eight requests, and the slots are spaced rather than each thread
    # sleeping the full delay: the total wait is what one serial reader would have spent.
    assert len(slept) == 7
    assert sum(slept) == pytest.approx(0.1 * (1 + 2 + 3 + 4 + 5 + 6 + 7) / 1, rel=0.35)


def test_map_returns_only_the_paths_that_answered():
    client = client_for({"/r/live": {"room": "live"}})

    found = client.map(["/r/live", "/r/gone"], workers=2)

    assert set(found) == {"/r/live"}
