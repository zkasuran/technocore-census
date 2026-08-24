"""The radar: the patterns an airdrop has to filter, measured rather than asserted.

Flop Labs said the reward goes to agents that create a DID and do something useful. Four
things make that hard to judge from the outside, and each one is measurable from public
data:

1. **Boilerplate.** A starter guide gave thousands of agents the same sentence. Counting
   how many messages are that sentence, and how many keys posted nothing else, separates
   "followed a tutorial" from "did something".
2. **One-and-done keys.** A key that wrote once and never returned is a checkbox, not an
   agent. Cheap to mint by the thousand.
3. **Name reservation.** `d-` rooms are ownable, so a script can claim hundreds of
   obvious names in a burst. Clustering claims by owning key shows who did, and rooms
   claimed and never used show what it bought.
4. **Insular clusters.** A group of keys answering only each other manufactures
   engagement. Measured as clusters sitting outside the network's largest connected
   component, plus the share of keys whose every answer came from one peer.

Everything is reported as an aggregate with the method stated. No key is called a sybil:
the radar publishes what a pattern looks like, and one key posting one message is
indistinguishable from a careful agent that arrived a minute before the snapshot.
"""

from __future__ import annotations

from collections import Counter, defaultdict

from .messages import Table

# A claimed room with no messages at all bought a name and nothing else. Claims with a
# little traffic are ordinary, so the unused count is reported beside the total rather
# than as an accusation.
SQUAT_CLUSTER_MIN = 5
# Two keys are joined when they wrote this close together in one room. Same value as the
# index's reply distance, and for the same reason: the protocol has no threading, so
# proximity is the only available signal and the number has to be published.
EDGE_DISTANCE = 5
# Below this many answers received, "one peer gave me all of them" says nothing: a key
# answered twice by one friend is an ordinary first conversation.
SINGLE_PEER_MIN_ANSWERS = 6


def build(snapshot: dict, table: Table, index: dict) -> dict:
    """The radar block: boilerplate, key shape, claim clusters, isolated clusters."""
    return {
        "method": {
            "note": (
                "Aggregates over the snapshot window, from public endpoints only. Patterns, "
                "not verdicts: a key with one message may be a new arrival, and a claimed "
                "room may be reserved for work that has not started."
            ),
            "squat_cluster_min": SQUAT_CLUSTER_MIN,
        },
        "boilerplate": _boilerplate(table),
        "keys": _key_shape(index),
        "claims": _claims(snapshot),
        "clusters": _clusters(table),
    }


def _boilerplate(table: Table) -> dict:
    """How much of the window is text more than one identity posted, and which lines."""
    writers: dict[str, set[str]] = defaultdict(set)
    counts: Counter[str] = Counter()
    originals: dict[str, str] = {}
    for message in table.messages:
        if not message.canonical:
            continue
        writers[message.canonical].add(message.identity)
        counts[message.canonical] += 1
        originals.setdefault(message.canonical, message.text)

    shared = table.shared_texts
    copied_messages = sum(counts[text] for text in shared)
    total = len(table.messages)

    top = sorted(shared, key=lambda text: (-len(writers[text]), -counts[text]))[:15]
    return {
        "messages_in_window": total,
        "distinct_texts": len(counts),
        "shared_texts": len(shared),
        "copied_messages": copied_messages,
        "copied_share": round(copied_messages / total, 4) if total else None,
        "top_templates": [
            {
                "identities": len(writers[text]),
                "messages": counts[text],
                "sample": originals[text][:220],
            }
            for text in top
        ],
    }


def _key_shape(index: dict) -> dict:
    """The shape of the key population: how many wrote once, how many were answered."""
    keys = index.get("keys") or []
    if not keys:
        return {"scored": 0}
    one_message = [row for row in keys if row["messages"] == 1]
    never_answered = [row for row in keys if row["credit"] == 0]
    all_boilerplate = [row for row in keys if row["originality"] == 0.0]
    broadcast_only = [row for row in keys if row["messages"] >= 3 and row["replies_given"] == 0]
    return {
        "scored": len(keys),
        "one_message": len(one_message),
        "one_message_share": round(len(one_message) / len(keys), 4),
        "never_answered": len(never_answered),
        "never_answered_share": round(len(never_answered) / len(keys), 4),
        "entirely_boilerplate": len(all_boilerplate),
        "broadcast_only": len(broadcast_only),
        "single_room": len([row for row in keys if row["rooms"] == 1]),
        "note": (
            "never_answered counts keys no other signed key replied to in the window; a "
            "reply from a self-asserted nickname is not counted, because anyone can type "
            "any nickname. one_message counts keys with exactly one message in the window, "
            "so a key that was active before the window reads the same way here."
        ),
    }


def _claims(snapshot: dict) -> dict:
    """Cluster `d-` room claims by owning key, and count what the claims are used for."""
    owners: dict[str, str] = snapshot.get("room_owners") or {}
    claims = snapshot.get("room_owner_keys") or []
    activity = {
        room.get("room"): room.get("last_seq")
        for room in (snapshot.get("rooms") or [])
        if isinstance(room.get("room"), str)
    }

    by_owner: Counter[str] = Counter()
    for owner in owners.values():
        by_owner[owner] += 1

    unused = [room for room in claims if activity.get(room) in (None, 0)]
    single = [room for room in claims if activity.get(room) == 1]
    clusters = [
        {
            "owner": owner,
            "rooms_claimed": count,
            "sample": sorted(room for room, key in owners.items() if key == owner)[:12],
        }
        for owner, count in by_owner.most_common(20)
        if count >= SQUAT_CLUSTER_MIN
    ]
    return {
        "claims_total": len(claims),
        "claims_resolved": len(owners),
        "resolved_note": snapshot.get("owner_sample"),
        "distinct_owners_in_sample": len(by_owner),
        "largest_cluster": max(by_owner.values(), default=0),
        "clusters": clusters,
        "claimed_not_listed": len(unused),
        "claimed_single_message": len(single),
        "listed_note": (
            "A claimed room absent from the listing has no messages, was reaped after 7 "
            "days idle, or fell outside the listing limit."
        ),
    }


def _clusters(table: Table) -> dict:
    """Find groups of keys that reply to each other and to nobody else.

    An undirected edge joins two signed keys that wrote within `EDGE_DISTANCE` messages of
    each other in the same room. The graph splits into connected components, and the
    largest one is the network proper: the pool of keys reachable from each other through
    some chain of exchanges.

    The number worth reporting is what sits *outside* that: a component of two to a handful
    of keys, disconnected from everyone else, that exchanged messages only among
    themselves. That is the shape of a manufactured conversation, and unlike "closed"
    it is a real distinction. (A first version of this asked whether a component had edges
    leaving it, which is true of every component by definition and so flagged the genuine
    exchange too.)

    Insularity is also measured per key as `top_responder_share`: of all the answers a key
    received, the share that came from its single most frequent responder. 1.0 means one
    peer accounts for every answer it ever got.
    """
    edges: dict[str, set[str]] = defaultdict(set)
    answers_from: dict[str, Counter[str]] = defaultdict(Counter)
    messages_by_key: Counter[str] = Counter()

    for slice_ in table.by_room.values():
        for position, message in enumerate(slice_):
            if not message.signed:
                continue
            messages_by_key[message.identity] += 1
            for later in slice_[position + 1 : position + 1 + EDGE_DISTANCE]:
                if not later.signed or later.identity == message.identity:
                    continue
                edges[message.identity].add(later.identity)
                edges[later.identity].add(message.identity)
                answers_from[message.identity][later.identity] += 1

    components = sorted(_components(edges), key=len, reverse=True)
    giant = components[0] if components else set()
    isolated = [sorted(group) for group in components[1:] if len(group) >= 2]
    isolated.sort(key=len, reverse=True)

    total_messages = sum(messages_by_key.values())
    isolated_messages = sum(messages_by_key[key] for group in isolated for key in group)

    single_peer = [
        key
        for key, counts in answers_from.items()
        if sum(counts.values()) >= SINGLE_PEER_MIN_ANSWERS
        and max(counts.values()) == sum(counts.values())
    ]

    return {
        "edge_distance": EDGE_DISTANCE,
        "keys_in_graph": len(edges),
        "components": len(components),
        "largest_component": len(giant),
        "largest_component_share": (
            round(sum(messages_by_key[key] for key in giant) / total_messages, 4)
            if total_messages
            else None
        ),
        "isolated_clusters": len(isolated),
        "largest_isolated_cluster": len(isolated[0]) if isolated else 0,
        "isolated_message_share": (
            round(isolated_messages / total_messages, 4) if total_messages else None
        ),
        "keys_answered_by_one_peer_only": len(single_peer),
        "single_peer_min_answers": SINGLE_PEER_MIN_ANSWERS,
        "top_isolated_clusters": [
            {
                "size": len(group),
                "members": group[:8],
                "messages": sum(messages_by_key[key] for key in group),
            }
            for group in isolated[:10]
        ],
        "note": (
            "A cluster outside the largest component exchanged messages only within itself. "
            "Two keys working together look exactly like this, so the size and the message "
            "share are the signal, not membership."
        ),
    }


def _components(edges: dict[str, set[str]]) -> list[set[str]]:
    """Connected components of the reply graph, iteratively so a wide graph cannot recurse."""
    seen: set[str] = set()
    found: list[set[str]] = []
    for start in edges:
        if start in seen:
            continue
        stack = [start]
        group: set[str] = set()
        while stack:
            node = stack.pop()
            if node in group:
                continue
            group.add(node)
            stack.extend(edges[node] - group)
        seen |= group
        found.append(group)
    return found
