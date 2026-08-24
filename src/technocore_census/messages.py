"""Flatten a snapshot into the message table every other analysis reads.

One pass, one shape. The rest of the package (the feed, the index, the radar) all need
the same thing: every message with its room, its writer, whether that writer proved a
key, and what its text normalizes to. Computing that three times would let three
definitions of "the same message" drift apart.
"""

from __future__ import annotations

from dataclasses import dataclass, field

from .normalize import normalize

DID_PREFIX = "did:key:"


@dataclass(frozen=True)
class Message:
    """One line in one room, as the server recorded it plus what we derived."""

    room: str
    seq: int
    ts: str
    author: str
    text: str
    signed: bool
    canonical: str

    @property
    def identity(self) -> str:
        """The identity key used for grouping: the DID, or `~nick` for a self-asserted one."""
        return self.author if self.signed else f"~{self.author}"


@dataclass
class Table:
    """Every message in the snapshot, the per-room slices, and what counts as boilerplate."""

    messages: list[Message] = field(default_factory=list)
    by_room: dict[str, list[Message]] = field(default_factory=dict)
    shared_texts: frozenset[str] = frozenset()

    def add(self, message: Message) -> None:
        self.messages.append(message)
        self.by_room.setdefault(message.room, []).append(message)

    def is_boilerplate(self, message: Message) -> bool:
        """True when this text was also posted by a different identity.

        Defined once, here, because three separate analyses need it and three definitions
        of "the same message" would drift. Two identities is the threshold: the starter
        template spread by copy, and a sentence two strangers produced word for word after
        normalization is a template either way.
        """
        return bool(message.canonical) and message.canonical in self.shared_texts


def build(snapshot: dict) -> Table:
    """Flatten every room page into one ordered table.

    `/r/events` is excluded. It is server-written, one line per public room creation, so
    counting it as agent traffic would credit the service with the network's busiest
    author and would score every room creation as a message nobody answered.
    """
    table = Table()
    for room, page in sorted((snapshot.get("messages") or {}).items()):
        if room == "events" or not isinstance(page, dict):
            continue
        for item in page.get("messages", []):
            if not isinstance(item, dict):
                continue
            author = item.get("from")
            text = item.get("text")
            seq = item.get("seq")
            if not isinstance(author, str) or not isinstance(text, str) or not isinstance(seq, int):
                continue
            table.add(
                Message(
                    room=room,
                    seq=seq,
                    ts=item.get("ts") if isinstance(item.get("ts"), str) else "",
                    author=author,
                    text=text,
                    signed=author.startswith(DID_PREFIX),
                    canonical=normalize(text),
                )
            )
    for slice_ in table.by_room.values():
        slice_.sort(key=lambda message: message.seq)
    table.messages.sort(key=lambda message: (message.room, message.seq))
    table.shared_texts = _shared_texts(table)
    return table


def _shared_texts(table: Table) -> frozenset[str]:
    """Normalized texts that more than one identity posted."""
    writers: dict[str, set[str]] = {}
    for message in table.messages:
        if message.canonical:
            writers.setdefault(message.canonical, set()).add(message.identity)
    return frozenset(text for text, owners in writers.items() if len(owners) > 1)
