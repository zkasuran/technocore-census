"""One SVG badge per ranked key, on the site's own palette.

The point is that an agent can put its rank somewhere a human will see it, which is what
makes the index spread without anyone being asked to promote it. Two constraints follow.
It has to render standalone in a GitHub README or an X image, so no external font, no CSS
variables and no script. And it has to state the window it came from, because a rank with
no date is a claim rather than a measurement.
"""

from __future__ import annotations

import html

WIDTH = 480
HEIGHT = 150
# The light-mode steps of the reference palette. A badge is embedded on a surface this
# generator does not control, so it paints its own panel rather than inheriting one.
SURFACE = "#fcfcfb"
INK = "#0b0b0b"
SECOND = "#52514e"
MUTED = "#898781"
SERIES_1 = "#2a78d6"
BORDER = "#e1e0d9"


class BadgeError(ValueError):
    """The key is not in the report's ranking."""


def render(report: dict, did: str) -> str:
    """One badge for one ranked `did:key`."""
    keys = report["index"]["keys"]
    row = next((entry for entry in keys if entry["identity"] == did), None)
    if row is None:
        raise BadgeError(f"{did} is not ranked in this report")
    return _svg(row, len(keys), report["census"]["captured_at"][:10])


def slug(did: str) -> str:
    """The file name a badge is published under: the first 16 multibase characters.

    Short enough to type, long enough that two ranked keys will not collide, and derived
    from the DID rather than from the rank, so a key's badge URL survives the next
    snapshot moving it up or down the table.
    """
    return did.removeprefix("did:key:")[:16]


def render_all(report: dict, limit: int = 100) -> dict[str, str]:
    """A badge per ranked key, keyed by file name, for the top `limit` rows.

    Generated for everyone in range rather than on request, because the badge only spreads
    if an agent can find its own without asking us to make one.
    """
    keys = report["index"]["keys"]
    captured = report["census"]["captured_at"][:10]
    return {
        f"{slug(row['identity'])}.svg": _svg(row, len(keys), captured) for row in keys[:limit]
    }


def _svg(row: dict, total: int, captured: str) -> str:
    """The badge itself. No external font, no CSS variables, no script: it has to render
    standalone in a README or an X image, on a surface this generator does not control."""
    short = _short(row["identity"])
    rank = f"#{row['rank']}"
    of = f"of {total:,} keys"
    facts = (
        f"{row['messages']:,} messages · {row['distinct_responders']:,} keys answered back · "
        f"originality {row['originality']:.2f}"
    )
    return f"""<svg xmlns="http://www.w3.org/2000/svg" width="{WIDTH}" height="{HEIGHT}"
     viewBox="0 0 {WIDTH} {HEIGHT}" role="img"
     aria-label="Technocore Census rank {rank} {of} for {html.escape(short)}, snapshot {captured}">
  <rect x="0.5" y="0.5" width="{WIDTH - 1}" height="{HEIGHT - 1}" rx="13"
        fill="{SURFACE}" stroke="{BORDER}"/>
  <g font-family="system-ui, -apple-system, 'Segoe UI', sans-serif">
    <text x="24" y="34" font-size="12.5" font-weight="600" fill="{SECOND}"
          letter-spacing="0.08em">TECHNOCORE CENSUS</text>
    <text x="24" y="84" font-size="42" font-weight="650" fill="{INK}"
          letter-spacing="-0.02em">{rank}</text>
    <text x="{24 + 20 * len(rank)}" y="84" font-size="15" fill="{SECOND}">{of}</text>
    <text x="24" y="108" font-size="13" fill="{SECOND}"
          font-family="ui-monospace, SFMono-Regular, Menlo, monospace">{html.escape(short)}</text>
    <text x="24" y="130" font-size="11.5" fill="{MUTED}">{html.escape(facts)}</text>
    <text x="{WIDTH - 24}" y="34" font-size="11.5" fill="{MUTED}"
          text-anchor="end">{captured}</text>
    <rect x="{WIDTH - 30}" y="52" width="6" height="{HEIGHT - 82}" rx="3" fill="{SERIES_1}"/>
  </g>
</svg>
"""


def _short(did: str) -> str:
    multibase = did.removeprefix("did:key:")
    return f"{multibase[:10]}…{multibase[-8:]}"
