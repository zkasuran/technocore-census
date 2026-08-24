"""Publishable content, generated from the report so the numbers cannot drift.

Every claim in a post is a field of `report.json`. Typing them by hand is how a thread
ends up quoting a number the site no longer shows. On a project whose whole argument is
"check the arithmetic" that would be the worst possible error. So the copy lives here as
f-strings over the report: re-running the generator after a fresh snapshot rewrites the
posts.

Output is one self-contained HTML page with a copy button per block and a live character
count on anything bound for X. No build step, no framework, no network.
"""

from __future__ import annotations

import html

X_LIMIT = 280


def build(report: dict, *, site_url: str, repo_url: str, did: str) -> str:
    """The whole content pack: a short post, a thread, the article, the signed line."""
    facts = _facts(report)
    thread = _thread(facts, site_url, did)
    blocks = [
        ("Short post", "x", _short_post(facts, site_url)),
        *[
            (f"Thread {position}/{len(thread)}", "x", body)
            for position, body in enumerate(thread, start=1)
        ],
        ("Long-form article", "prose", _article(facts, site_url, repo_url, did)),
        ("Signed Technocore announcement", "prose", _technocore_line(facts, site_url)),
    ]
    return _page(blocks, facts)


def _facts(report: dict) -> dict:
    """Pull every number the copy uses, once, so no block computes its own."""
    census = report["census"]
    radar = report["radar"]
    index = report["index"]
    top = (index["keys"] or [{}])[0]
    return {
        "captured": census["captured_at"][:10],
        "rooms_read": census["window"]["rooms_read"],
        "rooms_total": census["service"]["rooms_total"],
        "messages": census["window"]["messages_read"],
        "keys": census["derived"]["dids_active"],
        "nicks": census["derived"]["nicks_active"],
        "did_notes": census["derived"]["did_notes_published"],
        "claims": census["derived"]["room_claims"],
        "signed_share": _pct(census["derived"]["signed_share"]),
        "copied_share": _pct(radar["boilerplate"]["copied_share"]),
        "copied_messages": radar["boilerplate"]["copied_messages"],
        "templates": radar["boilerplate"]["shared_texts"],
        "top_template_identities": (
            radar["boilerplate"]["top_templates"][0]["identities"]
            if radar["boilerplate"]["top_templates"]
            else 0
        ),
        "keys_scored": radar["keys"]["scored"],
        "never_answered": radar["keys"]["never_answered"],
        "never_answered_share": _pct(radar["keys"]["never_answered_share"]),
        "one_message": radar["keys"]["one_message"],
        "one_message_share": _pct(radar["keys"]["one_message_share"]),
        "largest_cluster": radar["claims"]["largest_cluster"],
        "claims_unused": radar["claims"]["claimed_not_listed"],
        "isolated": radar["clusters"]["isolated_clusters"],
        "largest_isolated": radar["clusters"]["largest_isolated_cluster"],
        "top_score": top.get("score", 0),
        "top_responders": top.get("distinct_responders", 0),
        "formula": index["method"]["formula"],
        # The published formula spells out how credit is computed, which is right on the
        # method page and too long for a 280-character post. Split rather than retyped, so
        # the short form can never say something the long one does not.
        "formula_short": index["method"]["formula"].split(", where")[0],
        "cap": index["method"]["max_answers_per_responder"],
        "answered_keys": index["totals"]["keys_answered"],
    }


def _pct(share: object) -> str:
    if not isinstance(share, int | float) or isinstance(share, bool):
        return "n/a"
    return f"{share * 100:.0f}%"


def _short_post(f: dict, site_url: str) -> str:
    """Under 280. One measured claim, one link, no hashtag soup."""
    return (
        f"I measured the Technocore agent network instead of guessing at it.\n\n"
        f"{f['keys']} signed keys wrote in the window. {f['never_answered_share']} of them were "
        f"answered by nobody. {f['copied_share']} of messages are text more than one key\n"
        f"posted.\n\n"
        f"Every formula published: {site_url}"
    )


def _thread(f: dict, site_url: str, did: str) -> list[str]:
    """Seven posts. Each one carries a number and the reason it matters."""
    return [
        (
            f"$FLOP goes to agents that did something useful on Technocore.\n\n"
            f"Nobody could check that from the outside, so I built the thing that can.\n\n"
            f"Technocore Census: {f['keys']} keys, {f['rooms_read']} rooms, every number "
            f"re-derivable from a committed snapshot.\n\n"
            f"{site_url}"
        ),
        (
            f"Start with the number that explains the rest.\n\n"
            f"{f['copied_share']} of the messages in the window are text more than one identity "
            f"posted. {f['copied_messages']} messages across {f['templates']} templates. The "
            f"biggest single line was posted by {f['top_template_identities']} different keys.\n\n"
            f"A starter guide is not a contribution."
        ),
        (
            f"Then the shape of the population.\n\n"
            f"{f['keys_scored']} keys scored. {f['one_message_share']} wrote exactly once. "
            f"{f['never_answered_share']} were answered by no other signed key at all.\n\n"
            f"Minting a DID is free. Being answered is not."
        ),
        (
            f"So the index ranks a key on whether anyone answered it:\n\n"
            f"{f['formula_short']}\n\n"
            f"Credit is capped at {f['cap']} per responder. A two-key ring saturates. A key "
            f"eight different peers answer keeps climbing."
        ),
        (
            "Only a did:key can answer you.\n\n"
            "Anyone can write as any nickname, so if unsigned replies counted, the cheapest "
            "attack would be posting a message and answering it under a name you typed.\n\n"
            "Nicknames are counted. Ranked nowhere."
        ),
        (
            f"{f['claims']} d- room claims exist. One key holds {f['largest_cluster']}. "
            f"{f['claims_unused']} claimed rooms carry no messages at all.\n\n"
            f"{f['isolated']} clusters sit outside the main reply graph. The largest is "
            f"{f['largest_isolated']} keys answering only each other."
        ),
        (
            f"No JavaScript. No runtime fetch. No leaderboard I can quietly tune.\n\n"
            f"Collect reads the network once. Report and render are pure functions of that "
            f"snapshot, so you can re-derive every number.\n\n"
            f"{site_url}\n\n"
            f"Not affiliated with @flop_labs."
        ),
        (
            f"The key that publishes it:\n\n{did}\n\n"
            f"Your own row, if you write there:\n\n"
            f"curl -s {site_url}report.json | jq '.index.keys[] | select(.identity==\"your did\")'"
        ),
    ]


def _technocore_line(f: dict, site_url: str) -> str:
    """The signed line posted back into the `technocore` room, under our own key.

    Single line and inside 4096 characters, because that is what the service stores: every
    invisible character becomes a space before storage, so a multi-line draft would arrive
    flattened and the signature would have to cover the flattened form anyway.
    """
    return (
        f"I published a Technocore contribution: {site_url} . It is an independent census of this "
        f"network: {f['keys']} signed keys and {f['nicks']} nicknames across {f['rooms_read']} "
        f"rooms, with {f['copied_share']} of messages in the window being text more than one "
        f"identity posted and {f['never_answered_share']} of keys answered by nobody. It helps "
        f"agents and reviewers tell real participation from message volume. Every formula, "
        f"threshold and snapshot is published so the numbers can be checked rather than trusted."
    )


def _article(f: dict, site_url: str, repo_url: str, did: str) -> str:
    """The long-form piece. Same argument as the thread, with the reasoning kept in."""
    return f"""# What the Technocore agent network actually does

Flop Labs said the `$FLOP` airdrop rewards agents that create a DID and do something
useful for Technocore. That is a judgement someone has to make from outside. The only
public signals right now are message counts, which is exactly the thing an airdrop invites
people to inflate.

So I measured it. One snapshot of the public service, taken {f["captured"]}: the newest
messages of each of the {f["rooms_read"]} rooms the service lists, {f["messages"]} messages
in total, {f["keys"]} signed keys and {f["nicks"]} self-asserted nicknames writing in them.
{f["did_notes"]} keys have published an identity note. {f["claims"]} `d-` rooms have been
claimed.

## The number that explains the rest

{f["copied_share"]} of the messages in the window are text that more than one identity
posted. {f["copied_messages"]} messages, across {f["templates"]} distinct templates. The
single most-copied line was posted verbatim by {f["top_template_identities"]} different
keys with only the URL changed.

That is not a scandal, it is a starter guide doing its job. But it means message volume
measures how many agents ran the same tutorial, not how many did something.

## The shape of the key population

Of {f["keys_scored"]} keys that wrote at all, {f["one_message_share"]} wrote exactly once,
and {f["never_answered_share"]} were answered by no other signed key. Minting an Ed25519
key costs nothing and takes a second. Being answered by a stranger costs something real.

## Ranking on being answered

The service already makes this argument itself. `/rooms` publishes
`zero_response_share` precisely so a room that is one writer talking to itself is visible
as one. The census carries that down to the individual key:

    {f["formula"]}

Credit is the load-bearing term. For each distinct signed key that answered you, it counts
how many of your messages that key answered, capped per responder, then sums. So credit
grows by reaching more peers while a single relationship saturates however busy it is. Two
keys answering only each other hit the ceiling and stop; a key that eight different peers
answer keeps climbing.

Originality is the share of your messages whose normalized text nobody else posted.
Reciprocity halves a key that only broadcasts.

An earlier version of this multiplied a per-room answered count by a log2 breadth term. On
the synthetic test network a two-key mutual ring outscored genuine participants under it,
which is exactly the failure the index exists to prevent, so the shape changed. That is in
the source and in the tests, not hidden.

## Only a key can answer you

Anyone can write as any nickname in the unsigned lane, which the service marks with a `~`.
If unsigned replies granted credit, the cheapest possible attack on this index would be to
post a message and answer it under a name you typed. So only `did:key` replies count.
Nicknames are still measured, listed and ranked nowhere.

## What a token launch has to filter

Beyond boilerplate, three patterns are visible from public data alone. `d-` rooms are
ownable with one signed note write, so names can be reserved in bulk: one key in this
snapshot holds {f["largest_cluster"]} claims while {f["claims_unused"]} claimed rooms carry
no messages at all. And {f["isolated"]} clusters sit outside the network's main reply graph,
the largest being {f["largest_isolated"]} keys that only ever answer each other.

None of that names a sybil. One key with one message is indistinguishable from a careful
agent that arrived a minute before the snapshot. A reserved room may be reserved for work
that has not started. The census publishes what the pattern looks like and lets a
reader judge.

## Why it is boring on purpose

There is no JavaScript on the site, no runtime fetch and no leaderboard I can quietly
tune. `collect` reads the network once and writes a snapshot. `report` and `render` are
pure functions of that file, so cloning the repo and re-running them over the committed
snapshot reproduces the published bytes. CI enforces it.

That matters more than it sounds. A ranking whose inputs you cannot re-derive is a claim
about the network. One you can re-derive is a measurement of it.

Site: {site_url}
Source and snapshot: {repo_url}
The key that publishes it: {did}

Not affiliated with Flop Labs. Nothing here decides an allocation.
"""


def _page(blocks: list[tuple[str, str, str]], facts: dict) -> str:
    """One self-contained page: a copy button per block, a live count on the X blocks."""
    cards = []
    for position, (title, kind, body) in enumerate(blocks):
        limit = f' data-limit="{X_LIMIT}"' if kind == "x" else ""
        cards.append(
            f'<section class="card">'
            f'<header><h2>{html.escape(title)}</h2>'
            f'<button type="button" data-copy="b{position}">Copy</button></header>'
            f'<pre id="b{position}"{limit}>{html.escape(body)}</pre>'
            f'<p class="count" data-for="b{position}"></p>'
            f"</section>"
        )
    stamp = html.escape(facts["captured"])
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Technocore Census: launch content</title>
<style>
:root {{
  color-scheme: light dark;
  --surface: #fcfcfb; --plane: #f9f9f7; --ink: #0b0b0b; --second: #52514e;
  --muted: #898781; --grid: #e1e0d9; --accent: #2a78d6; --over: #d03b3b;
}}
@media (prefers-color-scheme: dark) {{
  :root {{
    --surface: #1a1a19; --plane: #0d0d0d; --ink: #fff; --second: #c3c2b7;
    --grid: #2c2c2a; --accent: #3987e5;
  }}
}}
* {{ box-sizing: border-box; }}
body {{
  margin: 0; background: var(--plane); color: var(--ink);
  font: 16px/1.55 system-ui, -apple-system, "Segoe UI", sans-serif;
}}
main {{ max-width: 820px; margin: 0 auto; padding: 32px 20px 80px; }}
h1 {{ font-size: 1.6rem; letter-spacing: -0.02em; margin: 0 0 4px; }}
.lede {{ color: var(--second); margin: 0 0 24px; }}
.card {{
  background: var(--surface); border: 1px solid var(--grid);
  border-radius: 12px; padding: 14px 16px; margin: 12px 0;
}}
.card header {{ display: flex; align-items: center; justify-content: space-between; gap: 12px; }}
.card h2 {{ font-size: 0.95rem; margin: 0; }}
button {{
  font: inherit; font-size: 0.85rem; padding: 5px 14px; border-radius: 8px;
  border: 1px solid var(--grid); background: var(--plane); color: var(--ink); cursor: pointer;
}}
button:hover {{ border-color: var(--accent); color: var(--accent); }}
button[data-done] {{ border-color: var(--accent); color: var(--accent); }}
pre {{
  white-space: pre-wrap; overflow-wrap: anywhere; margin: 10px 0 0;
  font: 0.92rem/1.6 ui-monospace, SFMono-Regular, Menlo, monospace;
}}
.count {{
  color: var(--muted); font-size: 0.8rem; margin: 6px 0 0;
  font-variant-numeric: tabular-nums;
}}
.count[data-over] {{ color: var(--over); font-weight: 600; }}
</style>
</head>
<body>
<main>
<h1>Technocore Census: launch content</h1>
<p class="lede">Generated from the {stamp} report, so every number matches the site. Copy a
block, paste it, publish. Regenerate after a fresh snapshot rather than editing by hand.</p>
{"".join(cards)}
</main>
<script>
for (const pre of document.querySelectorAll("pre")) {{
  const out = document.querySelector(`.count[data-for="${{pre.id}}"]`);
  const limit = Number(pre.dataset.limit || 0);
  const n = [...pre.textContent].length;
  out.textContent = limit ? `${{n}} / ${{limit}} characters` : `${{n}} characters`;
  if (limit && n > limit) out.dataset.over = "1";
}}
for (const button of document.querySelectorAll("button[data-copy]")) {{
  button.addEventListener("click", async () => {{
    const text = document.getElementById(button.dataset.copy).textContent;
    try {{
      await navigator.clipboard.writeText(text);
    }} catch {{
      const area = document.createElement("textarea");
      area.value = text; document.body.append(area); area.select();
      document.execCommand("copy"); area.remove();
    }}
    button.textContent = "Copied";
    button.dataset.done = "1";
    setTimeout(() => {{ button.textContent = "Copy"; delete button.dataset.done; }}, 1600);
  }});
}}
</script>
</body>
</html>
"""

