"""Radar v2: turn the radar's signals into one transparent per-key risk number.

The radar reports population-level shapes and refuses to name a key. This module carries
that same measurement down to the individual key and stops one step short of the same
line: it publishes, for one key, how sybil-like its own public record looks, with the
formula and every input beside the number so the key can check the arithmetic rather than
trust it. It is a signal, not an accusation. A high score says "this record has the shape a
filter looks for", never "this is a sybil": a key that arrived a minute before the snapshot,
wrote once and was not yet answered reads the same here as a checkbox key, so the reasons
name the concrete numbers and the honest reading is left to the reader.

Every term is a weighted contribution that fires only when its signal crosses a published
floor, and a term that fires adds both to the score and a plain reason naming the number
that fired it. So the score is exactly the sum of the reasons: no reason means score 0
means the clear band. Nothing is counted silently.

    score = sum of the fired terms, clamped to 0..1
    band  = clear (< 0.34), watch (< 0.67), flag (>= 0.67)

The inputs are the same public per-key fields the index already publishes (originality,
self_repeats, distinct_responders, duplicate_messages, answered, messages), so a stranger
can rebuild the score from report.json alone.
"""

from __future__ import annotations

# Each signal is (weight, floor). The weights sum to 1.0, so a record that trips every
# signal at full strength scores 1.0. never-answered and one-peer are mutually exclusive
# (a key has zero responders or one, never both), so the reachable maximum is lower.
WEIGHT_ORIGINALITY = 0.30
WEIGHT_NEVER_ANSWERED = 0.25
WEIGHT_SELF_REPEAT = 0.20
WEIGHT_ONE_PEER = 0.15
WEIGHT_DUPLICATE = 0.10

# Below this share of original text, "most of it is copied" starts to mean something. Set
# at half: a key more than half of whose messages are text other identities also posted.
ORIGINALITY_FLOOR = 0.5
# Above this share of a key's own messages repeating its own earlier text.
SELF_REPEAT_FLOOR = 0.3
# A key needs at least this many messages before "no signed key answered it" is a signal
# rather than the ordinary state of a key that just arrived. Same caution the radar states.
NEVER_ANSWERED_MIN_MESSAGES = 3
# One peer answering a key twice is an ordinary first conversation; the single-peer shape
# only means something once the key has been answered this many times.
ONE_PEER_MIN_ANSWERED = 3
# Absolute count of copied (cross-identity) messages before boilerplate volume, as opposed
# to boilerplate share, is worth its own small term. Saturates at DUPLICATE_FULL.
DUPLICATE_MIN = 5
DUPLICATE_FULL = 25.0

# Band cuts. Published, so a key on a boundary knows which way it falls.
WATCH_AT = 0.34
FLAG_AT = 0.67

METHOD = (
    "Weighted sum of five public signals, each firing only past a published floor and each "
    "naming the number that fired it: low originality (0.30), never answered by a signed key "
    "(0.25), high self-repeat share (0.20), answered by a single peer only (0.15) and "
    "boilerplate volume (0.10); clamped to 0..1, band clear < 0.34, watch < 0.67, else flag."
)


def band(score: float) -> str:
    """Map a 0..1 score to its band. Published cuts, so a boundary is not a surprise."""
    if score < WATCH_AT:
        return "clear"
    if score < FLAG_AT:
        return "watch"
    return "flag"


def _pct(fraction: float) -> int:
    """A whole-number percent for a reason string."""
    return round(fraction * 100)


def score_key(row: dict, ctx: dict) -> dict:
    """Score one key row: {score, band, reasons}.

    Pure in `row`. `ctx` carries optional overrides for the floors and weights (a caller can
    pass its own snapshot-wide tuning), so the same row scored under the same ctx is the same
    number every time. Every fired term appends a reason naming its concrete number, and the
    score is exactly the sum of those terms, so an empty reason list always reads as clear.
    """
    ctx = ctx or {}
    messages = row.get("messages") or 0
    originality = row.get("originality")
    if originality is None:
        originality = 0.0
    self_repeats = row.get("self_repeats") or 0
    duplicate_messages = row.get("duplicate_messages") or 0
    distinct_responders = row.get("distinct_responders") or 0
    answered = row.get("answered") or 0

    originality_floor = ctx.get("originality_floor", ORIGINALITY_FLOOR)
    self_repeat_floor = ctx.get("self_repeat_floor", SELF_REPEAT_FLOOR)
    never_answered_min = ctx.get("never_answered_min_messages", NEVER_ANSWERED_MIN_MESSAGES)
    one_peer_min = ctx.get("one_peer_min_answered", ONE_PEER_MIN_ANSWERED)
    duplicate_min = ctx.get("duplicate_min", DUPLICATE_MIN)

    score = 0.0
    reasons: list[str] = []

    if messages and originality < originality_floor:
        contribution = WEIGHT_ORIGINALITY * (1 - originality)
        score += contribution
        reasons.append(
            f"originality {originality}: {_pct(1 - originality)}% of messages are text "
            f"other identities also posted"
        )

    if messages >= never_answered_min and distinct_responders == 0:
        score += WEIGHT_NEVER_ANSWERED
        reasons.append(
            f"distinct_responders 0: no signed key answered any of {messages} messages"
        )

    self_share = self_repeats / messages if messages else 0.0
    if self_share >= self_repeat_floor:
        score += WEIGHT_SELF_REPEAT * self_share
        reasons.append(
            f"self_repeats {self_repeats} of {messages} messages: {_pct(self_share)}% "
            f"repeat the key's own earlier text"
        )

    if distinct_responders == 1 and answered >= one_peer_min:
        score += WEIGHT_ONE_PEER
        reasons.append(
            f"distinct_responders 1: every one of {answered} answered messages came from a "
            f"single peer"
        )

    if duplicate_messages >= duplicate_min:
        contribution = WEIGHT_DUPLICATE * min(1.0, duplicate_messages / DUPLICATE_FULL)
        score += contribution
        reasons.append(
            f"duplicate_messages {duplicate_messages}: copied text also posted by other "
            f"identities"
        )

    score = round(min(1.0, max(0.0, score)), 4)
    return {"score": score, "band": band(score), "reasons": reasons}


def attach_risk(report: dict) -> dict:
    """Fill each scored key's `risk` and add `radar.risk`. Deterministic and idempotent.

    Mutates and returns `report`. Running it twice over the same report yields the identical
    bytes: every key's risk is recomputed from its row, and the aggregate is recomputed from
    the fresh scores, so a stale value from a previous run is overwritten rather than added to.
    """
    keys = (report.get("index") or {}).get("keys") or []
    ctx = report.get("risk_ctx") or {}
    counts = {"clear": 0, "watch": 0, "flag": 0}
    for row in keys:
        risk = score_key(row, ctx)
        row["risk"] = risk
        counts[risk["band"]] += 1

    scored = len(keys)
    flagged_share = round(counts["flag"] / scored, 4) if scored else None

    radar = report.setdefault("radar", {})
    radar["risk"] = {
        "scored": scored,
        "bands": counts,
        "flagged_share": flagged_share,
        "method": METHOD,
    }
    return report
