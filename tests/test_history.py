"""History turns a pile of dated snapshots into a trend, so its behaviour is asserted, not sampled.

Each test states a property a reader would challenge the numbers on: is the series in date
order, does a key that climbed read as a negative rank delta, does a key that fell read as a
positive one, is a first sighting marked as new rather than as a fall from nowhere, and does
a repo with no history yet read as empty rather than as an error.
"""

from __future__ import annotations

import json

from technocore_census import history

CLIMB = "did:key:z6Mkclimbclimbclimbclimbclimbclimbclimbclimbclim"
FALL = "did:key:z6MkfallfallfallfallfallfallfallfallfallfallfalA"
OLD = "did:key:z6MkoldoldoldoldoldoldoldoldoldoldoldoldoldoldolA"
NEW = "did:key:z6MknewnewnewnewnewnewnewnewnewnewnewnewnewnewnewA"


def _report(keys: list[tuple[str, int, float]], captured_at: str) -> dict:
    """A minimal report with only the fields history reads, for a given day and key set."""
    return {
        "snapshot": {"captured_at": captured_at},
        "census": {
            "derived": {"dids_active": 100},
            "service": {"rooms_total": 40},
        },
        "radar": {
            "keys": {"scored": len(keys), "never_answered_share": 0.01},
            "boilerplate": {"copied_share": 0.2},
        },
        "index": {
            "keys": [
                {"identity": identity, "rank": rank, "score": score}
                for identity, rank, score in keys
            ]
        },
    }


def _write(history_dir, date: str, report: dict) -> None:
    history_dir.mkdir(parents=True, exist_ok=True)
    (history_dir / f"{date}.json").write_text(json.dumps(report))


def test_series_is_one_point_per_day_in_date_order(tmp_path):
    hist = tmp_path / "history"
    # Written out of order on purpose: the series must sort, not echo the directory.
    _write(hist, "2026-09-03", _report([(CLIMB, 1, 9.0)], "2026-09-03T00:00:00Z"))
    _write(hist, "2026-09-01", _report([(CLIMB, 1, 5.0)], "2026-09-01T00:00:00Z"))
    _write(hist, "2026-09-02", _report([(CLIMB, 1, 7.0)], "2026-09-02T00:00:00Z"))

    points = history.series(hist)

    assert [point["date"] for point in points] == ["2026-09-01", "2026-09-02", "2026-09-03"]
    assert [point["top_score"] for point in points] == [5.0, 7.0, 9.0]
    first = points[0]
    assert first["dids_active"] == 100
    assert first["rooms_total"] == 40
    assert first["scored"] == 1
    assert first["copied_share"] == 0.2
    assert first["never_answered_share"] == 0.01


def test_a_key_that_climbed_reads_as_a_negative_rank_delta(tmp_path):
    previous = _report([(CLIMB, 5, 1.0)], "2026-09-01T00:00:00Z")
    current = _report([(CLIMB, 2, 4.0)], "2026-09-02T00:00:00Z")

    move = history.movement(current, previous)[CLIMB]

    assert move["rank_delta"] == -3
    assert move["score_delta"] == 3.0
    assert move["streak_days"] == 2
    assert move["first_report"] is False


def test_a_key_that_fell_reads_as_a_positive_rank_delta(tmp_path):
    """The other direction, so a negative delta is proven to mean climbed and nothing else."""
    previous = _report([(FALL, 2, 4.0)], "2026-09-01T00:00:00Z")
    current = _report([(FALL, 5, 1.0)], "2026-09-02T00:00:00Z")

    move = history.movement(current, previous)[FALL]

    assert move["rank_delta"] == 3
    assert move["score_delta"] == -3.0


def test_a_brand_new_key_reads_as_a_first_sighting_not_a_drop(tmp_path):
    previous = _report([(OLD, 1, 5.0)], "2026-09-01T00:00:00Z")
    current = _report([(OLD, 1, 5.0), (NEW, 2, 3.0)], "2026-09-02T00:00:00Z")

    move = history.movement(current, previous)

    assert move[NEW]["rank_delta"] is None
    assert move[NEW]["score_delta"] is None
    assert move[NEW]["streak_days"] == 1
    assert move[NEW]["first_report"] is True
    # The key that was present in both is still a plain mover, not a first sighting.
    assert move[OLD]["first_report"] is False


def test_with_no_previous_report_every_delta_is_none_and_streak_is_one(tmp_path):
    current = _report([(OLD, 1, 5.0), (NEW, 2, 3.0)], "2026-09-01T00:00:00Z")

    move = history.movement(current, None)

    assert set(move) == {OLD, NEW}
    for row in move.values():
        assert row["rank_delta"] is None
        assert row["score_delta"] is None
        assert row["streak_days"] == 1
        assert row["first_report"] is True


def test_a_missing_history_dir_yields_an_empty_series(tmp_path):
    assert history.series(tmp_path / "does-not-exist") == []


def test_a_malformed_history_file_is_skipped_not_fatal(tmp_path):
    hist = tmp_path / "history"
    hist.mkdir()
    (hist / "2026-09-01.json").write_text("{not valid json")
    _write(hist, "2026-09-02", _report([(CLIMB, 1, 5.0)], "2026-09-02T00:00:00Z"))

    points = history.series(hist)

    assert [point["date"] for point in points] == ["2026-09-02"]


def test_attach_movement_fills_each_key_from_the_prior_report(tmp_path):
    hist = tmp_path / "history"
    _write(hist, "2026-09-01", _report([(CLIMB, 5, 1.0)], "2026-09-01T00:00:00Z"))
    report = _report([(CLIMB, 2, 4.0)], "2026-09-02T00:00:00Z")

    out = history.attach_movement(report, hist)

    assert out["index"]["keys"][0]["movement"]["rank_delta"] == -3
    assert [point["date"] for point in out["history"]["points"]] == ["2026-09-01"]

    # Idempotent: re-running over its own output changes neither the movement nor the series.
    again = history.attach_movement(out, hist)
    assert again["index"]["keys"][0]["movement"]["rank_delta"] == -3
    assert [point["date"] for point in again["history"]["points"]] == ["2026-09-01"]


def test_attach_movement_measures_against_yesterday_not_todays_own_report(tmp_path):
    """A re-run after the refresh committed today must compare with the prior day, not itself."""
    hist = tmp_path / "history"
    _write(hist, "2026-09-01", _report([(CLIMB, 5, 1.0)], "2026-09-01T00:00:00Z"))
    _write(hist, "2026-09-02", _report([(CLIMB, 2, 4.0)], "2026-09-02T00:00:00Z"))
    report = _report([(CLIMB, 2, 4.0)], "2026-09-02T00:00:00Z")

    out = history.attach_movement(report, hist)

    assert out["index"]["keys"][0]["movement"]["rank_delta"] == -3


def test_attach_movement_over_no_history_marks_every_key_as_new(tmp_path):
    report = _report([(CLIMB, 1, 5.0)], "2026-09-01T00:00:00Z")

    out = history.attach_movement(report, tmp_path / "does-not-exist")

    assert out["history"]["points"] == []
    movement = out["index"]["keys"][0]["movement"]
    assert movement["first_report"] is True
    assert movement["rank_delta"] is None
