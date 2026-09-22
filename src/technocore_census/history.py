"""Fold dated daily reports into a time series and per-key movement.

The census is a snapshot: it answers "what does the service look like right now". This
module answers the question a snapshot cannot, "what changed since yesterday", by reading
the dated reports the daily refresh commits under `data/history/<YYYY-MM-DD>.json` and
folding them into one longitudinal view.

Everything here is pure. It reads files and does arithmetic, never the network, so the
same history directory yields the same series and the same movement every time. That is
the same property `report.build` has, and for the same reason: a stranger clones the repo,
runs this over the committed history and gets the identical numbers.

Movement is deliberately measured against the single most recent prior report, not against
a window average, because a rank delta a reader can check against two named files is
evidence, and an average is a claim. A key that appears for the first time reads as a first
sighting rather than as a fall from nowhere, so a new key never masquerades as a mover.
"""

from __future__ import annotations

import json
from pathlib import Path


def _load_reports(history_dir: Path) -> list[tuple[str, dict]]:
    """Every `<date>.json` in the directory as (date, report), oldest first.

    A missing directory reads as no history. A file that is not valid JSON, or is valid
    JSON that is not an object, is skipped rather than fatal: one bad commit must not take
    out the whole series. The date is the filename stem, which is the name the daily
    refresh writes and the one thing that is guaranteed present even in a truncated file.
    """
    directory = Path(history_dir)
    if not directory.is_dir():
        return []
    reports: list[tuple[str, dict]] = []
    for path in sorted(directory.glob("*.json")):
        try:
            data = json.loads(path.read_text())
        except (OSError, ValueError):
            continue
        if isinstance(data, dict):
            reports.append((path.stem, data))
    reports.sort(key=lambda pair: pair[0])
    return reports


def _point(date: str, report: dict) -> dict:
    """One day reduced to the handful of headline numbers a trend line needs."""
    census = report.get("census", {})
    derived = census.get("derived", {})
    service = census.get("service", {})
    radar = report.get("radar", {})
    radar_keys = radar.get("keys", {})
    boilerplate = radar.get("boilerplate", {})
    scored_keys = report.get("index", {}).get("keys", [])
    return {
        "date": date,
        "dids_active": derived.get("dids_active"),
        "scored": radar_keys.get("scored"),
        "rooms_total": service.get("rooms_total"),
        "copied_share": boilerplate.get("copied_share"),
        "never_answered_share": radar_keys.get("never_answered_share"),
        "top_score": scored_keys[0]["score"] if scored_keys else None,
    }


def _report_date(report: dict) -> str | None:
    """The calendar date a report was captured, from its snapshot timestamp."""
    captured = report.get("snapshot", {}).get("captured_at")
    if isinstance(captured, str) and len(captured) >= 10:
        return captured[:10]
    return None


def series(history_dir: Path) -> list[dict]:
    """One headline point per committed day, oldest first.

    Tolerates a missing directory (returns `[]`) and a malformed file (skips it), so this
    is safe to call on a repo that has not accumulated any history yet.
    """
    return [_point(date, report) for date, report in _load_reports(history_dir)]


def movement(current: dict, previous: dict | None) -> dict[str, dict]:
    """Per-identity change between two reports, keyed by `did:key`.

    Each value is `{rank_delta, score_delta, streak_days, first_report}`. `rank_delta` is
    negative when a key climbed, because rank 1 is the top: rank 5 to rank 2 is `-3`.
    `score_delta` is signed. `streak_days` is 2 for a key present in both reports and 1 for
    a first sighting. `first_report` is True when there is nothing prior to compare against,
    either because `previous` is None or because the key is new this day, and in that case
    both deltas are None rather than a fabricated jump from zero.
    """
    current_keys = {row["identity"]: row for row in current.get("index", {}).get("keys", [])}
    if previous is None:
        return {
            identity: {
                "rank_delta": None,
                "score_delta": None,
                "streak_days": 1,
                "first_report": True,
            }
            for identity in current_keys
        }
    previous_keys = {row["identity"]: row for row in previous.get("index", {}).get("keys", [])}
    result: dict[str, dict] = {}
    for identity, row in current_keys.items():
        prior = previous_keys.get(identity)
        if prior is None:
            result[identity] = {
                "rank_delta": None,
                "score_delta": None,
                "streak_days": 1,
                "first_report": True,
            }
        else:
            result[identity] = {
                "rank_delta": row["rank"] - prior["rank"],
                "score_delta": round(row["score"] - prior["score"], 3),
                "streak_days": 2,
                "first_report": False,
            }
    return result


def attach_movement(report: dict, history_dir: Path) -> dict:
    """Fill each scored key's `movement` and add `report["history"]`, in place.

    Movement is measured against the most recent history report from a *prior* day, so
    re-running on a day whose own report is already committed compares against yesterday
    rather than against today's own copy. With no prior report every key reads as a first
    sighting. Deterministic and idempotent: the result depends only on `report` and the
    files on disk, and running it over its own output changes nothing.
    """
    reports = _load_reports(history_dir)
    current_date = _report_date(report)
    previous: dict | None = None
    for date, prior in reports:
        if current_date is None or date < current_date:
            previous = prior
    moves = movement(report, previous)
    for row in report.get("index", {}).get("keys", []):
        row["movement"] = moves.get(row["identity"])
    report["history"] = {"points": series(history_dir)}
    return report
