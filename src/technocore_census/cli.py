"""Command line: collect, report, render, publish, badge.

Five verbs and a hard split between them. `collect` is the only one that reads the
network, `report` and `render` are pure functions over files on disk, `publish` is the
only one that writes to Technocore, and `badge` writes an SVG. So a rerun of the analysis
can never quietly depend on live state, and rendering the site can never post anything.
"""

from __future__ import annotations

import argparse
import getpass
import json
import sys
from pathlib import Path

from . import VERSION, badge, content, report, site
from .client import Client, Transport
from .collect import collect
from .identity import Identity, Publisher, SigningError


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="census", description=__doc__.splitlines()[0])
    parser.add_argument("--version", action="version", version=VERSION)
    sub = parser.add_subparsers(dest="command", required=True)

    take = sub.add_parser("collect", help="read the live service into a snapshot file")
    take.add_argument("--out", type=Path, default=Path("data/snapshot.json"))
    take.add_argument("--base-url", default="https://technocore.chat")
    take.add_argument("--delay", type=float, default=0.25)
    take.add_argument("--owner-sample", type=int, default=250)
    take.add_argument("--room-limit", type=int, default=200)

    analyse = sub.add_parser("report", help="build the report from a snapshot (no network)")
    analyse.add_argument("--snapshot", type=Path, default=Path("data/snapshot.json"))
    analyse.add_argument("--out", type=Path, default=Path("data/report.json"))

    draw = sub.add_parser("render", help="write the static site from a report (no network)")
    draw.add_argument("--report", type=Path, default=Path("data/report.json"))
    draw.add_argument("--out", type=Path, default=Path("site"))

    mark = sub.add_parser("badge", help="write one SVG badge for a ranked did:key")
    mark.add_argument("did")
    mark.add_argument("--report", type=Path, default=Path("data/report.json"))
    mark.add_argument("--out", type=Path)

    words = sub.add_parser("content", help="write the click-to-copy launch content page")
    words.add_argument("--report", type=Path, default=Path("data/report.json"))
    words.add_argument("--out", type=Path, default=Path("content/LAUNCH.html"))
    words.add_argument("--site-url", default="https://zkasuran.github.io/technocore-census/")
    words.add_argument("--repo-url", default="https://github.com/zkasuran/technocore-census")
    words.add_argument("--did", required=True)

    push = sub.add_parser("publish", help="post the report summary back into Technocore")
    push.add_argument("--report", type=Path, default=Path("data/report.json"))
    push.add_argument("--key", type=Path, default=Path("identity.pem"))
    push.add_argument("--room", default="technocore")
    push.add_argument("--url", required=True, help="the public URL the summary points at")
    push.add_argument("--base-url", default="https://technocore.chat")
    push.add_argument("--dry-run", action="store_true")

    args = parser.parse_args(argv)
    try:
        return _run(args)
    except (OSError, SigningError, ValueError) as error:
        print(f"error: {error}", file=sys.stderr)
        return 1


def _run(args: argparse.Namespace) -> int:
    if args.command == "collect":
        client = Client(transport=Transport(base_url=args.base_url), delay=args.delay)
        snapshot = collect(client, owner_sample=args.owner_sample, room_limit=args.room_limit)
        _write(args.out, snapshot)
        told = snapshot["collection"]
        print(
            f"{args.out}: {len(snapshot['rooms'])} rooms, "
            f"{_message_count(snapshot)} messages, "
            f"{told['requests']} requests, {told['retries']} retries, "
            f"{len(told['failed_paths'])} failed paths, {told['seconds']}s"
        )
        return 0

    if args.command == "report":
        built = report.build(_read(args.snapshot))
        _write(args.out, built)
        census = built["census"]
        print(
            f"{args.out}: {census['derived']['dids_active']} keys active, "
            f"{built['index']['totals']['keys_scored']} scored, "
            f"copied share {built['radar']['boilerplate']['copied_share']}, "
            f"{len(built['feed']['threads'])} threads"
        )
        return 0

    if args.command == "render":
        written = site.render(_read(args.report), args.out)
        print(f"{args.out}: {len(written)} files")
        return 0

    if args.command == "badge":
        built = _read(args.report)
        svg = badge.render(built, args.did)
        if args.out:
            args.out.parent.mkdir(parents=True, exist_ok=True)
            args.out.write_text(svg, encoding="utf-8")
            print(args.out)
        else:
            print(svg)
        return 0
    if args.command == "content":
        page = content.build(
            _read(args.report),
            site_url=args.site_url.rstrip("/") + "/",
            repo_url=args.repo_url,
            did=args.did,
        )
        args.out.parent.mkdir(parents=True, exist_ok=True)
        args.out.write_text(page, encoding="utf-8")
        print(args.out)
        return 0

    if args.command == "publish":
        built = _read(args.report)
        line = _summary_line(built, args.url)
        print(line)
        print(f"({len(line)} chars)")
        if args.dry_run:
            return 0
        passphrase = getpass.getpass(f"Passphrase for {args.key}: ").encode("utf-8")
        identity = Identity.load(args.key, passphrase)
        publisher = Publisher(identity, base_url=args.base_url)
        reply = publisher.say(args.room, line)
        posted = reply.get("posted", {})
        print(
            json.dumps(
                {
                    "room": reply.get("room"),
                    "seq": posted.get("seq"),
                    "from": posted.get("from"),
                    "nonce": posted.get("nonce"),
                },
                indent=2,
            )
        )
        return 0

    raise ValueError(f"unsupported command: {args.command}")


def _summary_line(built: dict, url: str) -> str:
    """One line for the `technocore` room: what was measured, and where to check it."""
    census = built["census"]
    radar = built["radar"]
    return (
        f"Technocore Census {census['captured_at'][:10]}: "
        f"{census['derived']['dids_active']} did:key writers and "
        f"{census['derived']['nicks_active']} nicknames across "
        f"{census['window']['rooms_read']} rooms; "
        f"{radar['boilerplate']['copied_share']} of messages in the window are text more than one "
        f"identity posted; {radar['keys']['never_answered_share']} of keys were answered "
        "by nobody. "
        f"Method, snapshot and code: {url}"
    )


def _message_count(snapshot: dict) -> int:
    return sum(len(page.get("messages", [])) for page in snapshot["messages"].values())


def _read(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def _write(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    body = json.dumps(payload, ensure_ascii=False, indent=1, sort_keys=True)
    path.write_text(body + "\n", encoding="utf-8")


if __name__ == "__main__":
    raise SystemExit(main())
