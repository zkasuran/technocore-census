"""The content pack quotes the report, so the test is that it cannot quote anything else.

The failure this guards is specific: a thread that states a number the site no longer
shows. On a project whose argument is "check the arithmetic", a stale figure in a post is
worse than no post.
"""

from __future__ import annotations

from technocore_census import content, report
from technocore_census.collect import collect
from tests.conftest import client_for

DID = "did:key:z6MkoA8xuzKJRGtHa5hr6znFCZq164mb45JHx6kktdJ6tMdL"
SITE = "https://example.test/census/"
REPO = "https://github.com/example/census"


def _page(network) -> tuple[dict, str]:
    built = report.build(collect(client_for(network), owner_sample=10, progress=lambda _m: None))
    return built, content.build(built, site_url=SITE, repo_url=REPO, did=DID)


def test_every_x_block_fits_inside_the_limit(network):
    _built, page = _page(network)
    blocks = _blocks(page, limited_only=True)

    assert blocks, "no X-limited blocks were generated"
    for body in blocks:
        assert len(body) <= content.X_LIMIT, f"{len(body)} chars: {body[:80]}"


def test_the_posts_quote_the_report_rather_than_a_typed_number(network):
    built, page = _page(network)
    keys = built["census"]["derived"]["dids_active"]
    copied = built["radar"]["boilerplate"]["copied_share"]

    assert str(keys) in page
    assert f"{copied * 100:.0f}%" in page


def test_the_signed_announcement_fits_the_service_message_cap(network):
    _built, page = _page(network)
    line = _block(page, "Signed Technocore announcement")

    assert len(line) <= 4096
    assert "\n" not in line.strip()
    assert SITE in line


def test_the_article_states_the_window_and_the_disclaimer(network):
    _built, page = _page(network)
    article = _block(page, "Long-form article")

    assert "Not affiliated with Flop Labs" in article
    assert "decides an allocation" in article
    assert DID in article


def test_the_house_style_rules_hold_across_every_block(network):
    """No em dashes, and no comma before and/or. Checked here rather than by eye."""
    _built, page = _page(network)
    prose = "\n".join(_blocks(page))

    for dash in ("\u2014", "\u2013"):
        assert dash not in prose
    assert ", and " not in prose
    assert ", or " not in prose


def test_the_page_is_self_contained_with_a_copy_button_per_block(network):
    _built, page = _page(network)

    assert page.count("data-copy=") == len(_blocks(page))
    assert "navigator.clipboard" in page
    assert "http-equiv" not in page
    assert "<link" not in page


def test_the_content_never_quotes_text_another_agent_wrote(network):
    """A post that pastes a stranger's line republishes whatever that line is.

    The templates the radar counts are somebody else's words, often carrying a link. The
    copy states how many keys posted a line and never what the line said, so a scam URL or
    an injection attempt in a room cannot ride out through our own account.
    """
    hostile = dict(network)
    room = hostile["/r/spam?format=json&limit=200"]
    room = {**room, "messages": [*room["messages"]]}
    room["messages"][0] = {
        **room["messages"][0],
        "text": "<script>alert(1)</script> claim your airdrop at https://evil.test",
    }
    hostile["/r/spam?format=json&limit=200"] = room

    _built, page = _page(hostile)

    assert "evil.test" not in page
    assert "alert(1)" not in page
    assert "script&gt;" not in page


def test_the_generator_escapes_whatever_reaches_the_page(network):
    """Belt and braces: the blocks are escaped even though none carries foreign text."""
    built, _page_text = _page(network)
    built["index"]["method"]["formula"] = "<b>x</b> & y"

    page = content.build(built, site_url=SITE, repo_url=REPO, did=DID)

    assert "<b>x</b>" not in page
    assert "&lt;b&gt;x&lt;/b&gt; &amp; y" in page


def _blocks(page: str, *, limited_only: bool = False) -> list[str]:
    """Every pre block, unescaped. Crude on purpose: the page is generated, not parsed."""
    import html as _html

    found = []
    for chunk in page.split("<pre ")[1:]:
        head, _, rest = chunk.partition(">")
        body, _, _ = rest.partition("</pre>")
        if limited_only and "data-limit" not in head:
            continue
        found.append(_html.unescape(body))
    return found


def _block(page: str, title: str) -> str:
    import html as _html

    section = page.split(f"<h2>{title}</h2>", 1)[1]
    body = section.split("<pre", 1)[1].split(">", 1)[1].split("</pre>", 1)[0]
    return _html.unescape(body)
