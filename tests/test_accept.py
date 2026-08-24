"""The acceptance gate decides whether automation may overwrite a good snapshot.

Every test here is a case that would otherwise publish a worse snapshot than the one
already live, which is the failure mode that makes unattended collection dangerous.
"""

from __future__ import annotations

from technocore_census import accept


def _snapshot(*, listed: int, read: int, messages: int) -> dict:
    """A snapshot shaped only where the gate looks: coverage, not content."""
    per_room = messages // read if read else 0
    rooms = {f"r{n}": {"messages": [{"seq": 1}] * per_room} for n in range(read)}
    rooms["events"] = {"messages": [{"seq": 1}] * 500}  # never counted
    return {
        "rooms": [{"room": f"r{n}"} for n in range(listed)],
        "messages": rooms,
        "collection": {"rooms_listed": listed, "rooms_read": read},
    }


GOOD = _snapshot(listed=200, read=190, messages=3500)


def test_a_comparable_capture_is_accepted():
    fresh = _snapshot(listed=200, read=188, messages=3400)

    verdict = accept.judge(fresh, GOOD)

    assert verdict.accept
    assert "comparable" in str(verdict)


def test_a_capture_that_read_almost_nothing_is_refused():
    """The specific danger: a scheduled run lands during an outage."""
    fresh = _snapshot(listed=200, read=12, messages=90)

    verdict = accept.judge(fresh, GOOD)

    assert not verdict.accept
    assert any("floor" in reason for reason in verdict.reasons)


def test_a_capture_missing_most_of_what_it_listed_is_refused():
    fresh = _snapshot(listed=200, read=60, messages=2900)

    verdict = accept.judge(fresh, GOOD)

    assert not verdict.accept
    assert any("never answered" in reason for reason in verdict.reasons)


def test_a_thin_message_count_is_refused_even_when_rooms_look_fine():
    """Rooms can answer while their pages come back nearly empty."""
    fresh = _snapshot(listed=200, read=185, messages=800)

    verdict = accept.judge(fresh, GOOD)

    assert not verdict.accept
    assert any("messages" in reason for reason in verdict.reasons)


def test_a_genuinely_smaller_network_is_still_accepted():
    """A real decline is a finding, not a fault. The gate must not suppress one."""
    fresh = _snapshot(listed=150, read=145, messages=2600)

    verdict = accept.judge(fresh, GOOD)

    assert verdict.accept


def test_the_first_capture_is_accepted_when_it_stands_up_on_its_own():
    verdict = accept.judge(GOOD, None)

    assert verdict.accept
    assert "no published snapshot" in str(verdict)


def test_the_first_capture_is_still_refused_if_it_is_hollow():
    verdict = accept.judge(_snapshot(listed=200, read=5, messages=20), None)

    assert not verdict.accept


def test_the_verdict_carries_the_numbers_it_decided_on():
    """A refusal nobody can audit is a refusal nobody trusts."""
    verdict = accept.judge(_snapshot(listed=200, read=20, messages=200), GOOD)

    text = str(verdict)
    assert "fresh_rooms_read: 20" in text
    assert "published_rooms_read: 190" in text
    assert "rooms_read_ratio" in text


def test_the_events_room_is_never_counted_as_coverage():
    """It is server-written, so counting it would mask a collection that read no rooms."""
    hollow = {
        "rooms": [{"room": f"r{n}"} for n in range(200)],
        "messages": {"events": {"messages": [{"seq": n} for n in range(5000)]}},
        "collection": {"rooms_listed": 200, "rooms_read": 0},
    }

    verdict = accept.judge(hollow, GOOD)

    assert not verdict.accept
    assert verdict.facts["fresh_messages"] == 0
