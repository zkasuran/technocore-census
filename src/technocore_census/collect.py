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

import sys
import time
from collections.abc import Callable
from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime
from typing import Any

from .client import DEFAULT_WORKERS, Client, FetchError

SCHEMA = "technocore-census-snapshot-v1"
ROOM_LIMIT = 200  # /rooms?limit= ceiling, and the per-room message ceiling
BANNER_MARK = "!!"


def note(message: str) -> None:
    """Progress to stderr.

    A collection of 200 rooms against a saturated origin takes minutes, and most of that
    time is spent in timeouts. A run with no output is indistinguishable from a hang, so
    it prints what it is doing. stderr, so stdout stays the machine-readable summary.
    """
    print(message, file=sys.stderr, flush=True)


def strip_banner(body: str) -> str:
    """Note reads are `text/plain` prefixed with the untrusted-content banner.

    `?format=json` does not apply to a note: the handler answers text either way, so the
    banner is part of every note read and has to come off before the value is used.
    """
    lines = [line for line in body.splitlines() if not line.startswith(BANNER_MARK)]
    return "\n".join(lines).strip()


def collect(
    client: Client,
    *,
    owner_sample: int = 250,
    room_limit: int = ROOM_LIMIT,
    progress: Callable[[str], None] = note,
) -> dict:
    """One snapshot. Missing paths are recorded as failures, never raised.

    Two sweeps over the room list, not one. During an airdrop rush this origin answers a
    given path perfectly on one request and times out four times in a row on the next, so
    a single pass that blocks on each dead room spends minutes per failure and still ends
    up with holes. A fast pass followed by a re-sweep of only the gaps covers more of the
    network in less wall clock, and the second pass reports what it recovered.
    """
    started = time.monotonic()
    captured_at = datetime.now(UTC).isoformat()

    listing = _listing(client, room_limit, progress)
    rooms = listing.get("rooms", [])
    names = [entry["room"] for entry in rooms if isinstance(entry.get("room"), str)]
    progress(f"listing: {len(names)} rooms")

    messages: dict[str, Any] = {}
    # Pass 1 gives each room two attempts. Against a healthy origin that is all any room
    # needs, and against a sick one it stops the sweep spending two minutes on the first
    # dead room while a hundred live ones wait behind it.
    _sweep(client, names, messages, room_limit, started, progress, label="pass 1", attempts=2)
    missing = [room for room in names if room not in messages]
    if missing:
        progress(f"pass 2: re-reading {len(missing)} rooms that did not answer")
        _sweep(client, missing, messages, room_limit, started, progress, label="pass 2")
        recovered = len([room for room in missing if room in messages])
        progress(f"pass 2 recovered {recovered} of {len(missing)}")

    progress("events log")
    events = _events(client)
    progress(f"events: {len(events)} room creations")

    snapshot = {
        "schema": SCHEMA,
        "captured_at": captured_at,
        "base_url": client.transport.base_url,
        "room_limit": room_limit,
        "listing": {key: value for key, value in listing.items() if key != "rooms"},
        "rooms": rooms,
        "messages": messages,
        "events": events,
        "limits": (client.try_json("/.well-known/agent.json") or {}).get("limits", {}),
        "did_note_keys": _keys(client, "did"),
        "room_owner_keys": _keys(client, "room-owners"),
        "room_owners": {},
        "owner_sample": {"requested": owner_sample},
    }
    progress(
        f"notes: {len(snapshot['did_note_keys'])} did notes, "
        f"{len(snapshot['room_owner_keys'])} room claims"
    )
    snapshot["room_owners"], sampled = _owners(
        client, snapshot["room_owner_keys"], owner_sample, progress
    )
    snapshot["owner_sample"] = {
        "requested": owner_sample,
        "sampled": sampled,
        "total_claims": len(snapshot["room_owner_keys"]),
    }
    snapshot["collection"] = {
        "requests": client.requests,
        "retries": client.retries,
        "rooms_listed": len(names),
        "rooms_read": len(messages),
        "rooms_missing": sorted(set(names) - set(messages)),
        "failed_paths": list(client.failures),
        "seconds": round(time.monotonic() - started, 1),
    }
    return snapshot


def _listing(client: Client, room_limit: int, progress: Callable[[str], None]) -> dict:
    """Read `/rooms`, and keep asking for a smaller page until the origin can serve one.

    The listing is the one path a run cannot proceed without, and it is also the most
    expensive: 200 rooms with their engagement aggregates is ~46 KB the origin computes by
    walking every room directory. Under load that is exactly the request that times out
    while `/healthz` stays green. A smaller page is a smaller walk, so a run that cannot
    have the whole network takes the busiest part of it, which is what `/rooms` returns
    first, and records the reduced page size in the snapshot rather than failing outright.
    """
    sizes = [size for size in (room_limit, 100, 50, 25) if size <= room_limit] or [room_limit]
    for position, size in enumerate(sizes):
        listing = client.try_json(f"/rooms?format=json&limit={size}")
        if listing is not None:
            if size != room_limit:
                progress(f"listing: origin would only serve {size} rooms, not {room_limit}")
            return listing
        if position + 1 < len(sizes):
            progress(f"listing: {size} rooms did not answer, trying {sizes[position + 1]}")
    raise FetchError("/rooms never answered, at any page size")


def _sweep(
    client: Client,
    names: list[str],
    into: dict[str, Any],
    room_limit: int,
    started: float,
    progress: Callable[[str], None],
    *,
    label: str,
    attempts: int | None = None,
    workers: int = DEFAULT_WORKERS,
) -> None:
    """Read the named rooms into `into`, skipping what is already there.

    Batched rather than one at a time so a slow room does not hold up the rest, and so
    progress still lands regularly: a batch reports when it completes.
    """
    normal = client.attempts
    if attempts is not None:
        client.attempts = attempts
    try:
        pending = [room for room in names if room not in into]
        for start in range(0, len(pending), workers * 2):
            batch = pending[start : start + workers * 2]
            paths = {f"/r/{room}?format=json&limit={room_limit}": room for room in batch}
            for path, page in client.map(list(paths), workers=workers).items():
                into[paths[path]] = page
            progress(
                f"{label} {min(start + len(batch), len(pending))}/{len(pending)} · "
                f"{len(into)} read · {client.requests} requests · {client.retries} retries · "
                f"{time.monotonic() - started:.0f}s"
            )
    finally:
        client.attempts = normal


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


def _owners(
    client: Client,
    claims: list[str],
    sample: int,
    progress: Callable[[str], None] = note,
    workers: int = DEFAULT_WORKERS,
) -> tuple[dict[str, str], int]:
    """Resolve who owns a bounded sample of claimed rooms.

    The claim list can run into thousands and a note read costs a request each, so this
    samples rather than sweeping. Ordering is the list's own, so a rerun with the same
    sample size reads the same rooms; the count is reported beside the result because a
    sampled attribution that is presented as complete is a false number.
    """
    owners: dict[str, str] = {}
    wanted = claims[: max(sample, 0)]
    for start in range(0, len(wanted), workers * 2):
        batch = wanted[start : start + workers * 2]
        for room, value in _read_owner_batch(client, batch, workers):
            owners[room] = value
        done = min(start + len(batch), len(wanted))
        progress(f"claims {done}/{len(wanted)} · {len(owners)} resolved")
    return owners, len(owners)


def _read_owner_batch(
    client: Client, rooms: list[str], workers: int
) -> list[tuple[str, str]]:
    """Read one batch of owner notes. A note is text, not JSON, so `map` does not fit."""

    def read(room: str) -> tuple[str, str] | None:
        try:
            reply = client.get(f"/kv/room-owners/{room}")
        except FetchError:
            return None
        value = strip_banner(reply.body)
        return (room, value.split()[0]) if value.startswith("did:key:") else None

    with ThreadPoolExecutor(max_workers=max(1, workers)) as pool:
        return [found for found in pool.map(read, rooms) if found is not None]
