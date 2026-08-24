"""The site is what a stranger reads, so escaping and honesty are asserted, not assumed."""

from __future__ import annotations

from technocore_census import report, site
from technocore_census.collect import collect
from tests.conftest import client_for


def _report(network) -> dict:
    return report.build(collect(client_for(network), owner_sample=10, progress=lambda _m: None))


def _pages(network, tmp_path):
    built = _report(network)
    written = site.render(built, tmp_path)
    return built, {
        path.name: path.read_text(encoding="utf-8") for path in written if path.parent == tmp_path
    }


def test_every_page_and_the_snapshot_are_written(network, tmp_path):
    _built, pages = _pages(network, tmp_path)

    assert set(pages) == {
        "index.html",
        "feed.html",
        "radar.html",
        "method.html",
        "style.css",
        "report.json",
    }


def test_a_badge_is_written_for_every_ranked_key(network, tmp_path):
    built, _pages_map = _pages(network, tmp_path)
    badges = sorted(path.name for path in (tmp_path / "badges").iterdir())

    assert len(badges) == len(built["index"]["keys"])
    for row in built["index"]["keys"]:
        expected = row["identity"].removeprefix("did:key:")[:16] + ".svg"
        assert expected in badges


def test_a_badge_file_name_comes_from_the_key_not_the_rank(network, tmp_path):
    """A rank moves with every snapshot; a badge URL an agent published must not."""
    built, _pages_map = _pages(network, tmp_path)
    top = built["index"]["keys"][0]["identity"]
    name = top.removeprefix("did:key:")[:16] + ".svg"
    svg = (tmp_path / "badges" / name).read_text(encoding="utf-8")

    assert "TECHNOCORE CENSUS" in svg
    assert "#1" in svg
    assert built["census"]["captured_at"][:10] in svg
    assert "<script" not in svg


def test_hostile_message_text_is_escaped_and_never_becomes_a_link(network, tmp_path):
    hostile = dict(network)
    page = hostile["/r/talk?format=json&limit=200"]
    page = {**page, "messages": [*page["messages"]]}
    page["messages"][0] = {
        **page["messages"][0],
        "text": '<img src=x onerror=alert(1)> <a href="https://evil.test">click</a>',
    }
    hostile["/r/talk?format=json&limit=200"] = page

    _built, pages = _pages(hostile, tmp_path)
    feed = pages["feed.html"]

    assert "&lt;img src=x onerror=alert(1)&gt;" in feed
    assert "<img src=x" not in feed
    assert 'href="https://evil.test"' not in feed


def test_a_hostile_room_name_cannot_open_a_tag(network, tmp_path):
    # A room name cannot contain '<' per the service's own allowlist, but the generator
    # must not depend on that: it is the one place a stranger's string reaches markup.
    hostile = dict(network)
    listing = dict(hostile["/rooms?format=json&limit=200"])
    hostile_room = {**listing["rooms"][0], "topic": '"><script>alert(1)</script>'}
    listing["rooms"] = [hostile_room, *listing["rooms"][1:]]
    hostile["/rooms?format=json&limit=200"] = listing

    _built, pages = _pages(hostile, tmp_path)

    assert "<script>alert(1)</script>" not in pages["index.html"]


def test_the_pages_carry_no_script_and_no_runtime_fetch(network, tmp_path):
    _built, pages = _pages(network, tmp_path)

    for name, body in pages.items():
        if not name.endswith(".html"):
            continue
        assert "<script" not in body
        assert "fetch(" not in body


def test_every_page_states_the_capture_time_and_the_source(network, tmp_path):
    built, pages = _pages(network, tmp_path)
    captured = built["census"]["captured_at"]

    for name, body in pages.items():
        if not name.endswith(".html"):
            continue
        assert captured in body, name
        assert "example.test" in body, name


def test_every_page_disclaims_affiliation_and_official_status(network, tmp_path):
    _built, pages = _pages(network, tmp_path)

    for name, body in pages.items():
        if not name.endswith(".html"):
            continue
        assert "ot affiliated with FLOP Labs" in body, name


def test_the_method_page_publishes_the_formula_and_the_window(network, tmp_path):
    built, pages = _pages(network, tmp_path)
    method = pages["method.html"]

    assert built["index"]["method"]["formula"] in method
    assert "newest" in method
    assert str(built["census"]["window"]["messages_per_room_cap"]) in method


def test_the_feed_marks_signed_writers_apart_from_typed_names(network, tmp_path):
    _built, pages = _pages(network, tmp_path)
    feed = pages["feed.html"]

    assert "mark signed" in feed
    assert "mark unsigned" in feed
    assert "~alice" in feed


def test_every_chart_ships_a_table_twin(network, tmp_path):
    _built, pages = _pages(network, tmp_path)

    assert pages["index.html"].count("Table view") >= 3
    assert "Table view" in pages["radar.html"]


def test_the_stylesheet_declares_dark_mode_under_both_scopes(network, tmp_path):
    _built, pages = _pages(network, tmp_path)
    css = pages["style.css"]

    assert "prefers-color-scheme: dark" in css
    assert ':root[data-theme="dark"]' in css
