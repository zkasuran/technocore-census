"""The census: what the network is, in numbers taken from its own public surfaces.

Two kinds of number live here and they are labelled differently on purpose. The service
computes its own engagement aggregates over the newest 200 messages per room and
publishes them in `/rooms`; those are passed through under `service`, unmodified, because
re-deriving a number the operator already publishes invites two answers to one question.
Everything under `derived` is ours, computed from the snapshot, and every one of them is
bounded by the same window: the newest 200 messages of each listed room at capture time.

That window is the honest limit of this whole package. A room with 900 messages
contributes its newest 200, so nothing here is a service-lifetime total and no field is
named as though it were.
"""

from __future__ import annotations

from collections import Counter

from .messages import Table

# Fallback only. The live per-namespace note cap is read from the snapshot's own `limits`
# (`notes_per_namespace`) or `/config` (`max_notes_per_ns`), because it is a per-deployment
# number that has already moved once: it was 5120 when this project started and is 50960 on
# the public instance as of 2026-08-27. Hardcoding it is how a published figure goes stale, so
# it is only the value used when a snapshot carries neither source.
NOTES_PER_NAMESPACE_FALLBACK = 50960


def summarize(snapshot: dict, table: Table) -> dict:
    """The headline census block: scale, identity mix, and what the window covers."""
    listing = snapshot.get("listing") or {}
    rooms = snapshot.get("rooms") or []

    identities = Counter(message.identity for message in table.messages)
    dids = {name for name in identities if not name.startswith("~")}
    nicks = {name for name in identities if name.startswith("~")}
    signed_messages = sum(1 for message in table.messages if message.signed)

    idle = [room.get("idle_seconds") for room in rooms if isinstance(room.get("idle_seconds"), int)]
    single = sum(1 for room in rooms if room.get("last_seq") == 1)

    limits = snapshot.get("limits") or {}
    config_settings = (snapshot.get("config") or {}).get("settings") or {}
    per_ns_cap = (
        limits.get("notes_per_namespace")
        or config_settings.get("max_notes_per_ns")
        or NOTES_PER_NAMESPACE_FALLBACK
    )
    population = snapshot.get("did_population") or {}
    profiles = snapshot.get("did_profiles") or {}
    legacy_notes = population.get("legacy", len(snapshot.get("did_note_keys") or []))
    registered = population.get("total", legacy_notes)
    profiles_read = profiles.get("read") or 0

    return {
        "captured_at": snapshot.get("captured_at"),
        "base_url": snapshot.get("base_url"),
        "window": {
            "rooms_listed": len(rooms),
            "rooms_read": len(table.by_room),
            "messages_read": len(table.messages),
            "messages_per_room_cap": snapshot.get("room_limit"),
            "note": (
                "The newest messages of each listed room at capture time, capped per room. "
                "Not a service-lifetime total. Private p- rooms are never listed."
            ),
        },
        "service": {
            "rooms_total": listing.get("total"),
            "rooms_capacity": listing.get("capacity"),
            "room_bytes": listing.get("bytes"),
            "room_bytes_capacity": listing.get("bytes_capacity"),
            "notes": listing.get("notes"),
            "engagement": listing.get("engagement"),
            "limits": snapshot.get("limits"),
            "note": "Published by the service in /rooms and /.well-known/agent.json, unmodified.",
        },
        "derived": {
            "identities": len(identities),
            "dids_active": len(dids),
            "nicks_active": len(nicks),
            "signed_messages": signed_messages,
            "signed_share": _share(signed_messages, len(table.messages)),
            # The whole registered identity population, counted across every did-<shard>
            # namespace plus the frozen legacy one, not just legacy /kv/did as v1 did.
            "registered_identities": registered,
            "registered_sharded": population.get("sharded_total", 0),
            "registered_legacy": legacy_notes,
            "per_namespace_cap": per_ns_cap,
            "legacy_at_capacity": (legacy_notes >= per_ns_cap) if per_ns_cap else None,
            # Registered is service-lifetime; dids_active is only writers seen in this window,
            # so this is a lower bound on "how many of the registered ever say anything here".
            "active_share_of_registered": _share(len(dids), registered),
            "identity_profile_sample": {
                "sampled": profiles.get("sampled", 0),
                "read": profiles_read,
                "resolved": profiles.get("resolved", 0),
                "mailbox_share": _share(profiles.get("with_mailbox", 0), profiles_read),
                "x25519_share": _share(profiles.get("with_x25519", 0), profiles_read),
                "note": "Shares are over the sampled notes that answered, not the whole namespace.",
            },
            # Kept so existing renderers show the true total rather than only the legacy count.
            "did_notes_published": registered,
            "room_claims": len(snapshot.get("room_owner_keys") or []),
            "rooms_created_logged": len(snapshot.get("events") or []),
            "rooms_on_first_message": single,
            "median_idle_seconds": _median(idle),
            "busiest_rooms": _busiest(table, 12),
        },
    }


def _busiest(table: Table, count: int) -> list[dict]:
    """Rooms with the most distinct writers in the window, not the most messages.

    Message count ranks a room one agent talks to itself in above a room where twelve
    agents answered each other, and the second is the thing worth pointing a newcomer at.
    """
    ranked = []
    for room, slice_ in table.by_room.items():
        writers = {message.identity for message in slice_}
        ranked.append(
            {
                "room": room,
                "messages": len(slice_),
                "writers": len(writers),
                "signed_writers": len({m.identity for m in slice_ if m.signed}),
            }
        )
    ranked.sort(key=lambda row: (-row["writers"], -row["messages"], row["room"]))
    return ranked[:count]


def _share(part: int, whole: int) -> float | None:
    return round(part / whole, 4) if whole else None


def _median(values: list[int]) -> int | None:
    if not values:
        return None
    ordered = sorted(values)
    middle = len(ordered) // 2
    if len(ordered) % 2:
        return ordered[middle]
    return (ordered[middle - 1] + ordered[middle]) // 2
