"""Chart pieces, each a string of HTML. No JavaScript, no runtime data fetch.

Every form here follows the skill's own procedure: the job picks the form before any
colour is chosen. A single headline is a hero figure, a handful of headline numbers is a
KPI row rather than a grouped bar chart, one ratio against a limit is a meter, and the
ranking is a horizontal bar because the labels are long `did:key` strings.

Two colour rules are load-bearing:

- The rank chart is **one** series in slot 1, not a ramp. Colouring each bar darker where
  it is bigger would double-encode the bar length as hue and burn the only free channel
  on information the bar already shows.
- Where two categories genuinely carry identity (signed keys against self-asserted
  nicknames) slots 1 and 2 are used with a legend *and* direct labels, so identity is
  never colour alone.

Every chart ships a table twin in a `<details>`, which is also the relief for aqua's
sub-3:1 contrast on the light surface.
"""

from __future__ import annotations

import html

# Above this share the meter fill goes to warning, and above the second to critical. The
# thresholds are a stated editorial judgement, not a measurement: a network where most
# messages are text more than one identity posted is a network of templates.
METER_WARN = 0.25
METER_CRITICAL = 0.5


def escape(value: object) -> str:
    return html.escape(str(value), quote=True)


def compact(value: object) -> str:
    """1284 -> 1,284 and 12900 -> 12.9K, for tiles and hero figures."""
    if not isinstance(value, int | float) or isinstance(value, bool):
        return escape(value if value is not None else "n/a")
    number = float(value)
    if number >= 1_000_000:
        return f"{number / 1_000_000:.1f}M".replace(".0M", "M")
    if number >= 10_000:
        return f"{number / 1_000:.1f}K".replace(".0K", "K")
    if number.is_integer():
        return f"{int(number):,}"
    return f"{number:,.4g}"


def percent(share: object, digits: int = 1) -> str:
    if not isinstance(share, int | float) or isinstance(share, bool):
        return "n/a"
    return f"{share * 100:.{digits}f}%"


def hero(value: object, label: str, note: str = "") -> str:
    """The one number the page leads with. Exactly one per view, same sans, proportional."""
    tail = f'<p class="note">{escape(note)}</p>' if note else ""
    return (
        '<section class="hero">'
        f'<p class="figure">{compact(value)}</p>'
        f'<p class="label">{escape(label)}</p>{tail}'
        "</section>"
    )


def tiles(rows: list[dict]) -> str:
    """A KPI row. Each row: label, value, optional sub and delta."""
    cells = []
    for row in rows:
        sub = f'<p class="sub">{escape(row["sub"])}</p>' if row.get("sub") else ""
        cells.append(
            '<div class="tile">'
            f'<p class="label">{escape(row["label"])}</p>'
            f'<p class="value">{row.get("display") or compact(row.get("value"))}</p>'
            f"{sub}</div>"
        )
    return f'<div class="tiles">{"".join(cells)}</div>'


def bar_rows(
    rows: list[dict],
    *,
    caption: str,
    columns: list[tuple[str, str]],
    value_key: str = "value",
    slot: str = "",
) -> str:
    """A horizontal ranking: one hue for every bar, value outside the bar end.

    `rows` carry `title`, `meta`, `value` and `display`. Widths are a percentage of the
    largest value, so the longest bar fills the track and the rest are read against it.
    `columns` drives the table twin, as (heading, key) pairs.
    """
    if not rows:
        return '<p class="note">No rows in this window.</p>'
    largest = max((row.get(value_key) or 0) for row in rows) or 1
    body = []
    for row in rows:
        value = row.get(value_key) or 0
        width = max(1.0, round(100 * value / largest, 2))
        body.append(
            '<div class="rank-row">'
            f'<div class="who"><div class="id">{escape(row["title"])}</div>'
            f'<div class="meta">{escape(row.get("meta", ""))}</div></div>'
            f'<div class="bar-track"><div class="bar{slot}" style="width:{width}%"></div></div>'
            f'<div class="val">{escape(row.get("display") or compact(value))}</div>'
            "</div>"
        )
    return (
        f'<div class="rank">{"".join(body)}</div>'
        + table(rows, caption=caption, columns=columns)
    )


def meter(share: object, *, label: str, of: str, detail: str = "") -> str:
    """One ratio against a limit. Fill carries severity; the track is a lighter same-hue step."""
    if not isinstance(share, int | float) or isinstance(share, bool):
        return '<p class="note">Not measurable in this window.</p>'
    fraction = max(0.0, min(1.0, float(share)))
    severity = "crit" if fraction >= METER_CRITICAL else "warn" if fraction >= METER_WARN else ""
    tail = f'<p class="note">{escape(detail)}</p>' if detail else ""
    return (
        '<div class="meter">'
        f'<p class="readout">{percent(fraction)} <span class="of">{escape(of)}</span></p>'
        f'<div class="track" role="img" aria-label="{escape(label)}: {percent(fraction)} of {of}">'
        f'<div class="fill {severity}" style="width:{fraction * 100:.2f}%"></div></div>'
        '<div class="scale"><span>0%</span><span>50%</span><span>100%</span></div>'
        f"{tail}</div>"
    )


def split_bar(parts: list[dict], *, caption: str) -> str:
    """Two or three categories that carry identity: legend, direct labels, 2px surface gaps.

    Rendered as separate labelled bars rather than one stacked bar, because the labels are
    the point and an interior stacked segment has no free end to put one on.
    """
    total = sum(part["value"] for part in parts) or 1
    legend = "".join(
        f'<li><span class="key s{index + 1}"></span>{escape(part["label"])}</li>'
        for index, part in enumerate(parts)
    )
    rows = []
    for index, part in enumerate(parts):
        share = part["value"] / total
        rows.append(
            '<div class="rank-row">'
            f'<div class="who"><div class="id">{escape(part["label"])}</div>'
            f'<div class="meta">{percent(share)} of {compact(total)}</div></div>'
            f'<div class="bar-track"><div class="bar s{index + 1}" '
            f'style="width:{max(1.0, share * 100):.2f}%"></div></div>'
            f'<div class="val">{compact(part["value"])}</div>'
            "</div>"
        )
    twin = table(
        [{"label": part["label"], "value": part["value"]} for part in parts],
        caption=caption,
        columns=[("Group", "label"), ("Count", "value")],
    )
    return f'<ul class="legend">{legend}</ul><div class="rank">{"".join(rows)}</div>{twin}'


def table(rows: list[dict], *, caption: str, columns: list[tuple[str, str]]) -> str:
    """The table twin every chart carries, so no value is reachable only by colour."""
    head = "".join(
        f'<th scope="col" class="{_numeric(key)}">{escape(heading)}</th>'
        for heading, key in columns
    )
    body = []
    for row in rows:
        cells = "".join(
            f'<td class="{_numeric(key)}">{_cell(row.get(key))}</td>' for _heading, key in columns
        )
        body.append(f"<tr>{cells}</tr>")
    return (
        '<details class="table"><summary>Table view</summary>'
        f"<table><caption>{escape(caption)}</caption>"
        f"<thead><tr>{head}</tr></thead><tbody>{''.join(body)}</tbody></table></details>"
    )


def _numeric(key: str) -> str:
    return "num" if key in _NUMERIC_KEYS else ""


_NUMERIC_KEYS = frozenset(
    {
        "value",
        "score",
        "rank",
        "messages",
        "rooms",
        "writers",
        "answered",
        "answered_scored",
        "distinct_responders",
        "answered_others",
        "replies_given",
        "originality",
        "reciprocity",
        "duplicate_messages",
        "self_repeats",
        "identities",
        "signed_writers",
        "rooms_claimed",
        "size",
        "count",
    }
)


def _cell(value: object) -> str:
    if isinstance(value, bool):
        return "yes" if value else "no"
    if isinstance(value, float):
        return f"{value:,.4g}"
    if isinstance(value, int):
        return f"{value:,}"
    if isinstance(value, list):
        return escape(", ".join(str(item) for item in value))
    return escape("" if value is None else value)
