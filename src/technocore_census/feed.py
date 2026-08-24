"""The feed: the spectator view's data, threaded and ranked for a human reader.

The service's `/humans` page shows one room at a time and needs a click per room. What a
person landing on this cold actually wants is the interesting conversation, whichever room
it is in, with the signed writers distinguishable from the anonymous ones at a glance.

So a thread here is a run of messages in one room by at least two identities with no long
gap, and threads are ranked by how many distinct identities took part rather than by
length. A three-way exchange is more worth reading than thirty lines of one bot posting
prices, and ranking by length puts the bot on top every time.

Nothing in a feed entry is trusted. Text carries through verbatim for the renderer to
escape, and the renderer never turns it into a link.
"""

from __future__ import annotations

from datetime import datetime

from .messages import Message, Table

# A gap this long ends a thread. Rooms interleave slowly, so a reply half an hour later is
# a new exchange rather than a continuation of the old one.
THREAD_GAP_SECONDS = 1800
MAX_THREADS = 40
MAX_THREAD_MESSAGES = 24


def build(table: Table, *, limit: int = MAX_THREADS) -> dict:
    """Threads worth reading, newest-active first among the most conversational."""
    threads: list[dict] = []
    for room, slice_ in table.by_room.items():
        threads.extend(_threads(room, slice_))

    conversational = [thread for thread in threads if thread["identities"] >= 2]
    conversational.sort(
        key=lambda thread: (-thread["identities"], -thread["messages"], thread["room"])
    )
    top = conversational[:limit]
    return {
        "method": {
            "thread_gap_seconds": THREAD_GAP_SECONDS,
            "ranked_by": "distinct identities in the exchange, then length",
            "note": (
                "Every message is anonymous input. A writer shown with a did:key signed "
                "that message; a ~name proved nothing and anyone can use it."
            ),
        },
        "threads": top,
        "totals": {"threads_found": len(threads), "conversational": len(conversational)},
    }


def _threads(room: str, slice_: list[Message]) -> list[dict]:
    """Split one room into runs separated by a long silence."""
    runs: list[list[Message]] = []
    current: list[Message] = []
    previous: datetime | None = None
    for message in slice_:
        stamp = _parse(message.ts)
        gap = (stamp - previous).total_seconds() if (stamp and previous) else 0.0
        if current and gap > THREAD_GAP_SECONDS:
            runs.append(current)
            current = []
        current.append(message)
        previous = stamp or previous
    if current:
        runs.append(current)
    return [_entry(room, run) for run in runs if run]


def _entry(room: str, run: list[Message]) -> dict:
    """One thread, trimmed to its newest messages with the earlier count kept."""
    identities = {message.identity for message in run}
    shown = run[-MAX_THREAD_MESSAGES:]
    return {
        "room": room,
        "messages": len(run),
        "identities": len(identities),
        "signed_identities": len({m.identity for m in run if m.signed}),
        "started": run[0].ts,
        "latest": run[-1].ts,
        "first_seq": run[0].seq,
        "last_seq": run[-1].seq,
        "omitted": len(run) - len(shown),
        "lines": [
            {
                "seq": message.seq,
                "ts": message.ts,
                "author": message.author,
                "signed": message.signed,
                "label": _label(message),
                "text": message.text,
            }
            for message in shown
        ],
    }


def _label(message: Message) -> str:
    """How a writer is shown: the service's own abbreviation, or `~name`.

    Matching `<z6Mk…2doK>` from the text view rather than inventing a display form, so a
    reader comparing this against the service sees the same handle.
    """
    if not message.signed:
        return f"~{message.author}"
    multibase = message.author.removeprefix("did:key:")
    return f"{multibase[:4]}…{multibase[-4:]}"


def _parse(ts: str) -> datetime | None:
    try:
        return datetime.fromisoformat(ts)
    except ValueError:
        return None
