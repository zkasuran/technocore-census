"""Take one snapshot of the live service and keep every byte it answered with.

Every published number has to be re-derivable by a stranger, so analysis never touches
the network: the collector writes a snapshot and everything downstream reads that file.
Re-running the analysis on a committed snapshot has to reproduce the site exactly, which
is only true if the collector is the single place that talks to the origin.

What it reads, all documented public paths: `/rooms` for the census and the service's own
engagement aggregates, `/r/<room>` for the newest messages in each listed room,
`/r/events` for room creation order, `/kv/did` and `/kv/room-owners` for the key lists,
and a bounded sample of owner notes. Private `p-` rooms are never listed and are never
fetched. Nothing is written to the service here.
"""

from __future__ import annotations

import time
from datetime import UTC, datetime
from typing import Any

from .client import Client, FetchError

SCHEMA = "technocore-census-snapshot-v1"
ROOM_LIMIT = 200  # /rooms?limit= ceiling, and the per-room message ceiling
BANNER_MARK = "!!"


def strip_banner(body: str) -> str:
    """Note reads are `text/plain` prefixed with the untrusted-content banner.

    `?format=json` does not apply to a note: the handler answers text either way, so the
    banner is part of every note read and has to come off before the value is used.
    """
    lines = [line for line in body.splitlines() if not line.startswith(BANNER_MARK)]
    return "\n".join(lines).strip()


def collect(client: Client, *, owner_sample: int = 250, room_limit: int = ROOM_LIMIT) -> dict:
    """One snapshot. Missing paths are recorded as failures, never raised."""
    started = time.monotonic()
    captured_at = datetime.now(UTC).isoformat()

    listing = client.json(f"/rooms?format=json&limit={room_limit}")
    rooms = listing.get("rooms", [])

    messages: dict[str, Any] = {}
    for entry in rooms:
        room = entry.get("room")
        if not isinstance(room, str):
            continue
        page = client.try_json(f"/r/{room}?format=json&limit={room_limit}")
        if page is not None:
            messages[room] = page

    snapshot = {
        "schema": SCHEMA,
        "captured_at": captured_at,
        "base_url": client.transport.base_url,
        "room_limit": room_limit,
        "listing": {key: value for key, value in listing.items() if key != "rooms"},
        "rooms": rooms,
        "messages": messages,
        "events": _events(client),
        "limits": (client.try_json("/.well-known/agent.json") or {}).get("limits", {}),
        "did_note_keys": _keys(client, "did"),
        "room_owner_keys": _keys(client, "room-owners"),
        "room_owners": {},
        "owner_sample": {"requested": owner_sample},
    }
    snapshot["room_owners"], sampled = _owners(client, snapshot["room_owner_keys"], owner_sample)
    snapshot["owner_sample"] = {
        "requested": owner_sample,
        "sampled": sampled,
        "total_claims": len(snapshot["room_owner_keys"]),
    }
    snapshot["collection"] = {
        "requests": client.requests,
        "retries": client.retries,
        "failed_paths": list(client.failures),
        "seconds": round(time.monotonic() - started, 1),
    }
    return snapshot


def _events(client: Client) -> list[dict]:
    """Walk `/r/events` forward from the start of the ring, oldest first.

    One page is 200 lines and the log is longer than that, so paging matters: room
    creation order is the only place the network's growth curve is visible, and `/rooms`
    is sorted by activity so it cannot be recovered from there.
    """
    collected: list[dict] = []
    seen: set[int] = set()
    cursor = 0
    for _ in range(60):  # 12000 lines, far past the current log; a cap, not an estimate
        page = client.try_json(f"/r/events?format=json&since={cursor}&limit={ROOM_LIMIT}")
        if not page:
            break
        batch = [item for item in page.get("messages", []) if item.get("seq") not in seen]
        if not batch:
            break
        for item in batch:
            seen.add(item.get("seq"))
        collected.extend(batch)
        last = page.get("last_seq")
        if not isinstance(last, int) or last <= cursor:
            break
        cursor = last
    collected.sort(key=lambda item: item.get("seq") or 0)
    return collected


def _keys(client: Client, namespace: str) -> list[str]:
    """The key list of one namespace. Absent is empty, not fatal."""
    listing = client.try_json(f"/kv/{namespace}?format=json")
    if not isinstance(listing, dict):
        return []
    keys = listing.get("keys")
    return [key for key in keys if isinstance(key, str)] if isinstance(keys, list) else []


def _owners(client: Client, claims: list[str], sample: int) -> tuple[dict[str, str], int]:
    """Resolve who owns a bounded sample of claimed rooms.

    The claim list can run into thousands and a note read costs a request each, so this
    samples rather than sweeping. Ordering is the list's own, so a rerun with the same
    sample size reads the same rooms; the count is reported beside the result because a
    sampled attribution that is presented as complete is a false number.
    """
    owners: dict[str, str] = {}
    for room in claims[: max(sample, 0)]:
        try:
            reply = client.get(f"/kv/room-owners/{room}")
        except FetchError:
            continue
        value = strip_banner(reply.body)
        if value.startswith("did:key:"):
            owners[room] = value.split()[0]
    return owners, len(owners)
