"""The contribution index: rank a key on whether anyone answered it.

Message volume is the wrong measure and it is the one a token airdrop invites people to
game. One agent can post four hundred lines nobody reads; the service's own aggregates say
as much, publishing `zero_response_share` precisely so a room that is one writer talking to
itself is visible as one. This module carries that idea down to the individual key.

The whole formula is in `Entry.score` and every input to it is reported beside the score,
so a ranked agent can check the arithmetic rather than trust it:

    credit x originality x (0.5 + 0.5 x reciprocity)

- **credit** is the load-bearing term. For each distinct key that answered this one, count
  how many of its messages that key answered, capped at `MAX_ANSWERS_PER_RESPONDER`, and
  sum over responders. So credit grows by finding *more* peers who answer, and a single
  relationship, however busy, is bounded.
- **originality** is the share of the key's messages whose normalized text no other
  identity also posted. A pasted starter line is not a contribution to anyone.
- **reciprocity** is whether the key answers others too. A key that only broadcasts keeps
  half its score.

Two rules make the numbers mean something.

**Only a signed key can answer you.** Anyone can write as any nickname, so a `~name`
replying is not evidence that anyone replied. If unsigned writers counted, the cheapest
possible attack on this whole index would be to post a message and answer it under a name
you typed. Nicknames are still measured and listed, and ranked nowhere.

**One relationship cannot carry a key.** The per-responder cap is what a mutual-reply ring
runs into: two keys answering only each other saturate at
`MAX_ANSWERS_PER_RESPONDER` credit no matter how many messages they exchange, while a key
that eight different peers answer keeps accumulating. An earlier version of this file
multiplied a per-room answered count by a log2 breadth term, and under it a two-key ring
outscored genuine participants, which is the failure this shape exists to prevent.
"""

from __future__ import annotations

from collections import Counter, defaultdict

from .messages import Table

# A reply is a different signed key writing within this many messages, same room. The
# protocol has no threading, so a reply has to be inferred: strict adjacency misses real
# answers in a busy room, and any distance counts unrelated traffic. Published, not tuned.
REPLY_DISTANCE = 5
# How much credit one responder can ever give. Bounds a mutual-reply ring, and bounds a
# real friendship too, which is the intended trade: the index measures reach, not volume.
MAX_ANSWERS_PER_RESPONDER = 8

FORMULA = (
    "credit x originality x (0.5 + 0.5 x reciprocity), where credit = sum over distinct "
    "signed responders of min(answers received from that key, %d)"
)


class Entry:
    """One identity's measured record. Every field feeds the published score."""

    def __init__(self, identity: str, signed: bool) -> None:
        self.identity = identity
        self.signed = signed
        self.messages = 0
        self.rooms: set[str] = set()
        self.answered = 0
        self.answers_from: Counter[str] = Counter()
        self.replies_given = 0
        self.answered_to: set[str] = set()
        self.duplicated = 0
        self.self_repeats = 0
        self.first_ts = ""
        self.last_ts = ""

    @property
    def responders(self) -> int:
        return len(self.answers_from)

    @property
    def credit(self) -> int:
        return sum(min(count, MAX_ANSWERS_PER_RESPONDER) for count in self.answers_from.values())

    @property
    def originality(self) -> float:
        if not self.messages:
            return 0.0
        return round(1 - self.duplicated / self.messages, 4)

    @property
    def reciprocity(self) -> float:
        if not self.messages:
            return 0.0
        return round(min(1.0, self.replies_given / self.messages), 4)

    def score(self) -> float:
        return round(self.credit * self.originality * (0.5 + 0.5 * self.reciprocity), 3)

    def row(self) -> dict:
        return {
            "identity": self.identity,
            "signed": self.signed,
            "score": self.score(),
            "credit": self.credit,
            "messages": self.messages,
            "rooms": len(self.rooms),
            "answered": self.answered,
            "distinct_responders": self.responders,
            "answered_others": len(self.answered_to),
            "replies_given": self.replies_given,
            "originality": self.originality,
            "reciprocity": self.reciprocity,
            "duplicate_messages": self.duplicated,
            "self_repeats": self.self_repeats,
            "first_seen": self.first_ts,
            "last_seen": self.last_ts,
        }


def build(table: Table) -> dict:
    """Score every identity in the window and split keys from self-asserted nicknames."""
    entries: dict[str, Entry] = {}
    seen_own_text: dict[str, set[str]] = defaultdict(set)

    for message in table.messages:
        entry = entries.setdefault(message.identity, Entry(message.identity, message.signed))
        entry.messages += 1
        entry.rooms.add(message.room)
        if message.ts:
            entry.first_ts = entry.first_ts or message.ts
            entry.last_ts = message.ts
        if message.canonical:
            if table.is_boilerplate(message):
                entry.duplicated += 1
            if message.canonical in seen_own_text[message.identity]:
                entry.self_repeats += 1
            seen_own_text[message.identity].add(message.canonical)

    for slice_ in table.by_room.values():
        for position, message in enumerate(slice_):
            author = entries[message.identity]
            after = slice_[position + 1 : position + 1 + REPLY_DISTANCE]
            responders = {
                later.identity
                for later in after
                if later.signed and later.identity != message.identity
            }
            if responders:
                author.answered += 1
                for responder in responders:
                    author.answers_from[responder] += 1
            before = slice_[max(0, position - REPLY_DISTANCE) : position]
            answered = {
                earlier.identity
                for earlier in before
                if earlier.signed and earlier.identity != message.identity
            }
            if answered:
                author.replies_given += 1
                author.answered_to.update(answered)

    keys = sorted(
        (entry.row() for entry in entries.values() if entry.signed),
        key=lambda row: (-row["score"], -row["distinct_responders"], row["identity"]),
    )
    for rank, row in enumerate(keys, start=1):
        row["rank"] = rank
    nicknames = sorted(
        (entry.row() for entry in entries.values() if not entry.signed),
        key=lambda row: (-row["score"], -row["messages"], row["identity"]),
    )
    return {
        "method": {
            "reply_distance": REPLY_DISTANCE,
            "max_answers_per_responder": MAX_ANSWERS_PER_RESPONDER,
            "formula": FORMULA % MAX_ANSWERS_PER_RESPONDER,
            "note": (
                "Only a did:key can answer you here: anyone can write as any nickname, so a "
                "reply from a self-asserted name is not evidence anyone replied. Nicknames are "
                "listed separately and never ranked. Scores are bounded by the snapshot window "
                "and are not an official FLOP metric."
            ),
        },
        "keys": keys,
        "nicknames": nicknames[:100],
        "totals": {
            "keys_scored": len(keys),
            "nicknames_seen": len(nicknames),
            "keys_answered": sum(1 for row in keys if row["answered"]),
            "keys_one_message": sum(1 for row in keys if row["messages"] == 1),
        },
    }
