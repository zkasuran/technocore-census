"""Decide whether a fresh snapshot is fit to replace the published one.

This exists because automation without it is worse than no automation. The origin answers
badly under load, and a scheduled collection that happens to run during an outage comes
back with twenty rooms instead of two hundred. Committing that would replace a good
snapshot with a bad one, and the site would go on looking authoritative while its numbers
quietly became garbage. A stale snapshot that says when it was taken is strictly better
than a fresh one that undercounts.

So the rule is that a replacement has to be comparably complete, not merely newer. The
thresholds below are deliberate and published rather than tuned: a capture that reads at
least most of what the last one read is accepted, and anything materially thinner is
refused with the numbers that made the decision.

Nothing here judges the *content* of a snapshot. A real drop in activity is a finding, not
a fault, and this must not suppress one: the checks only compare coverage (how much of the
network was reachable), never the measurements themselves.
"""

from __future__ import annotations

# Fraction of the previous capture's rooms and messages a fresh one must reach. 0.7 is
# loose on purpose. Rooms are reaped after 7 days idle and a real network can shrink, so a
# tight bound would reject honest captures; the job here is only to catch a collection that
# mostly failed.
MIN_COVERAGE = 0.7
# Below this many rooms, nothing is worth publishing whatever the previous capture held.
# The public instance lists hundreds; a handful means the listing itself barely answered.
MIN_ROOMS = 25
# A capture that missed more than this share of the rooms it listed saw a sick origin, even
# if it still cleared the coverage bar against a previous capture that was also poor.
MAX_MISSING_SHARE = 0.5


class Verdict:
    """Why a snapshot was accepted or refused, with the numbers behind it."""

    def __init__(self, accept: bool, reasons: list[str], facts: dict) -> None:
        self.accept = accept
        self.reasons = reasons
        self.facts = facts

    def __str__(self) -> str:
        head = "accept" if self.accept else "refuse"
        lines = [f"{head}: " + "; ".join(self.reasons)]
        lines += [f"  {key}: {value}" for key, value in sorted(self.facts.items())]
        return "\n".join(lines)


def _shape(snapshot: dict) -> dict:
    """The coverage figures a decision is made on."""
    collection = snapshot.get("collection") or {}
    listed = collection.get("rooms_listed")
    read = collection.get("rooms_read")
    if not isinstance(listed, int):
        listed = len(snapshot.get("rooms") or [])
    if not isinstance(read, int):
        read = len(snapshot.get("messages") or {})
    messages = sum(
        len(page.get("messages", []))
        for room, page in (snapshot.get("messages") or {}).items()
        if room != "events" and isinstance(page, dict)
    )
    return {"rooms_listed": listed, "rooms_read": read, "messages": messages}


def judge(fresh: dict, published: dict | None) -> Verdict:
    """Accept `fresh` as a replacement for `published`, or refuse and say why."""
    new = _shape(fresh)
    facts = {f"fresh_{key}": value for key, value in new.items()}
    reasons: list[str] = []

    if new["rooms_read"] < MIN_ROOMS:
        reasons.append(f"read {new['rooms_read']} rooms, under the {MIN_ROOMS} floor")

    if new["rooms_listed"]:
        missing = 1 - new["rooms_read"] / new["rooms_listed"]
        facts["fresh_missing_share"] = round(missing, 4)
        if missing > MAX_MISSING_SHARE:
            reasons.append(
                f"{missing:.0%} of listed rooms never answered, over the "
                f"{MAX_MISSING_SHARE:.0%} ceiling"
            )

    if published is None:
        # The standalone checks above are the whole decision here, so the verdict is
        # settled before the explanatory note is added. Appending first and then testing
        # whether `reasons` is empty would refuse every first capture.
        standalone = not reasons
        reasons.append("no published snapshot to compare against")
        return Verdict(standalone, reasons, facts)

    old = _shape(published)
    facts.update({f"published_{key}": value for key, value in old.items()})
    for field in ("rooms_read", "messages"):
        if not old[field]:
            continue
        ratio = new[field] / old[field]
        facts[f"{field}_ratio"] = round(ratio, 4)
        if ratio < MIN_COVERAGE:
            reasons.append(
                f"{field} {new[field]} is {ratio:.0%} of the published {old[field]}, "
                f"under the {MIN_COVERAGE:.0%} bar"
            )

    if reasons:
        return Verdict(False, reasons, facts)
    return Verdict(True, ["coverage is comparable to the published snapshot"], facts)
