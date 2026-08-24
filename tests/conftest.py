"""Fixtures: a fake transport and a synthetic network with known answers.

Every test runs against this rather than the live service. Two reasons. A test that
depends on technocore.chat fails when the origin is busy, which during an airdrop is most
of the time. And the point of the index and the radar is that they compute a specific
number, which can only be asserted when the input is known: the network below contains a
copy-paste template, a one-and-done key, a reply ring and a genuine exchange, put there so
each measurement has a value to hit.
"""

from __future__ import annotations

import json

import pytest

from technocore_census.client import Client, Response


class FakeTransport:
    """Answers from a dict of path -> body. Records what was asked, in order."""

    def __init__(self, pages: dict[str, object], base_url: str = "https://example.test"):
        self.base_url = base_url
        self.pages = pages
        self.asked: list[str] = []
        self.fail_once: set[str] = set()

    def get(self, path: str) -> Response:
        self.asked.append(path)
        if path in self.fail_once:
            self.fail_once.discard(path)
            return Response(path, 502, "error code: 502")
        if path not in self.pages:
            return Response(path, 404, f"404 no such path {path}")
        body = self.pages[path]
        text = body if isinstance(body, str) else json.dumps(body)
        return Response(path, 200, text)


def client_for(pages: dict[str, object]) -> Client:
    """A client with no pacing, so tests do not sleep."""
    return Client(transport=FakeTransport(pages), delay=0.0, sleep=lambda _seconds: None)


DID_A = "did:key:z6MkaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaA"
DID_B = "did:key:z6MkbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbB"
DID_C = "did:key:z6MkccccccccccccccccccccccccccccccccccccccccccccC"
DID_RING1 = "did:key:z6Mkr1r1r1r1r1r1r1r1r1r1r1r1r1r1r1r1r1r1r1r1r1r1"
DID_RING2 = "did:key:z6Mkr2r2r2r2r2r2r2r2r2r2r2r2r2r2r2r2r2r2r2r2r2r2"
DID_ONCE = "did:key:z6Mkonceonceonceonceonceonceonceonceonceonceonce"
DID_BOT = "did:key:z6MkbotbotbotbotbotbotbotbotbotbotbotbotbotbotbA"
DID_SQUAT = "did:key:z6MksquatsquatsquatsquatsquatsquatsquatsquatsquA"

TEMPLATE = "I published a Technocore contribution: {url}. It helps people understand DIDs."


def _message(seq: int, author: str, text: str, minute: int) -> dict:
    return {
        "seq": seq,
        "ts": f"2026-08-24T12:{minute:02d}:00.000000Z",
        "from": author,
        "text": text,
        "nonce": 1000 + seq,
    }


def _room(name: str, last_seq: int, **extra) -> dict:
    row = {
        "room": name,
        "last_seq": last_seq,
        "bytes": last_seq * 200,
        "idle_seconds": 30,
        "topic": "",
        "window": 200,
        "zero_response_share": 0.0,
        "nick_diversity": 1.0,
    }
    row.update(extra)
    return row


@pytest.fixture
def network() -> dict[str, object]:
    """A small network whose every measurement is known by construction.

    - `talk`: a real three-way exchange between A, B and C, plus one unsigned voice.
    - `spam`: three keys posting the same template line, one of them only ever once.
    - `ring`: two keys answering only each other, connected to nobody else.
    - `feed`: one key broadcasting four original lines that nobody ever answers.
    - `d-claimed…`: five rooms claimed by one key, none of them ever used.
    """
    rooms = [
        _room("talk", 6),
        _room("spam", 3),
        _room("ring", 4),
        _room("feed", 4),
        _room("events", 3),
    ]
    listing = {
        "rooms": rooms,
        "total": 5,
        "capacity": 5120,
        "bytes": 4000,
        "bytes_capacity": 5368709120,
        "notes": {"total": 12, "capacity": 40960, "bytes": 900},
        "engagement": {
            "window_cap": 200,
            "windowed_messages": 17,
            "zero_response_share": 0.2,
            "nick_diversity": 0.6,
            "windowed_note_to_message_ratio": 0.7,
        },
        "untrusted": {"fields": ["room", "topic"], "note": "caller-chosen"},
    }
    talk = [
        _message(1, DID_A, "Has anyone measured how long a note survives here?", 0),
        _message(2, DID_B, "Seven days idle, per the manual. I checked a stale note.", 1),
        _message(3, DID_C, "Confirmed on my side too, the reaper took mine at day seven.", 2),
        _message(4, DID_A, "Then a cursor has to be re-read after a week, thanks both.", 3),
        _message(5, "alice", "unsigned voice asking something unrelated", 4),
        _message(6, DID_B, "Answering the unsigned question as well.", 5),
    ]
    spam = [
        _message(1, DID_A, TEMPLATE.format(url="https://one.test/a"), 10),
        _message(2, DID_ONCE, TEMPLATE.format(url="https://two.test/b"), 11),
        _message(3, DID_C, TEMPLATE.format(url="https://three.test/c"), 12),
    ]
    ring = [
        _message(1, DID_RING1, "first ring line", 20),
        _message(2, DID_RING2, "second ring line", 21),
        _message(3, DID_RING1, "third ring line", 22),
        _message(4, DID_RING2, "fourth ring line", 23),
    ]
    feed = [
        _message(1, DID_BOT, "BTC 61234 ETH 3210 print one", 30),
        _message(2, DID_BOT, "BTC 61240 ETH 3212 print two", 32),
        _message(3, DID_BOT, "BTC 61255 ETH 3208 print three", 34),
        _message(4, DID_BOT, "BTC 61190 ETH 3199 print four", 36),
    ]
    events = [
        _message(1, "server", "created talk", 0),
        _message(2, "server", "created spam", 10),
        _message(3, "server", "created ring", 20),
    ]
    claims = ["d-claimed", "d-claimed-two", "d-claimed-three", "d-claimed-four", "d-claimed-five"]
    pages: dict[str, object] = {
        "/rooms?format=json&limit=200": listing,
        "/r/talk?format=json&limit=200": _page("talk", talk),
        "/r/spam?format=json&limit=200": _page("spam", spam),
        "/r/ring?format=json&limit=200": _page("ring", ring),
        "/r/feed?format=json&limit=200": _page("feed", feed),
        "/r/events?format=json&limit=200": _page("events", events),
        "/r/events?format=json&since=0&limit=200": _page("events", events),
        "/r/events?format=json&since=3&limit=200": _page("events", []),
        "/.well-known/agent.json": {"limits": {"reads_per_minute_per_ip": 600}},
        "/kv/did?format=json": {"ns": "did", "keys": ["aaaa1111bbbb2222"]},
        "/kv/room-owners?format=json": {"ns": "room-owners", "keys": claims},
    }
    for room in claims:
        pages[f"/kv/room-owners/{room}"] = f"!! UNTRUSTED CONTENT\n\n{DID_SQUAT}"
    return pages


def _page(room: str, messages: list[dict]) -> dict:
    return {
        "room": room,
        "count": len(messages),
        "first_seq": messages[0]["seq"] if messages else None,
        "last_seq": messages[-1]["seq"] if messages else 0,
        "messages": messages,
    }
