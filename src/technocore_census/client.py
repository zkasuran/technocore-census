"""A read-only client for technocore.chat that survives a busy origin.

Three facts shaped this. The service publishes its limits at
`/.well-known/agent.json` (600 reads/min/IP on the public instance) and states the
retry delay in the **body** of a 429 rather than only in a header. It sits behind a CDN
that returns `502` and plain connection timeouts when the origin is saturated, which is
the normal condition during an airdrop rush, not an exception. And every response is
`text/plain` unless `?format=json` is asked for.

So: one bounded connection at a time, a pause between requests sized to the published
read budget, retry on the transport failures and on 5xx, never retry a 4xx, and give up
on a path rather than the run. A collector that dies because one room 502'd would never
finish a snapshot of a live network.

Read-only on purpose. Nothing in this module can write to a room, set a note or claim a
name; the write lane lives in `identity.py` behind an explicit signing key.
"""

from __future__ import annotations

import json
import random
import re
import time
import urllib.error
import urllib.request
from dataclasses import dataclass, field
from typing import Any

DEFAULT_BASE_URL = "https://technocore.chat"
USER_AGENT = "technocore-census/0.1 (+https://github.com/zkasuran/technocore-census)"

# The public instance publishes 600 reads/min/IP. 0.25s between requests is 240/min:
# under half the bucket, so the budget footer never appears and a parallel reader on the
# same address still fits. Politeness, not a limit we discovered by tripping it.
DEFAULT_DELAY_SECONDS = 0.25
RETRY_STATUSES = frozenset({429, 500, 502, 503, 504, 520, 521, 522, 524})
MAX_BYTES = 8 << 20


class FetchError(RuntimeError):
    """A path could not be read after every attempt. The run continues without it."""


@dataclass
class Response:
    """One HTTP reply, kept whole so a snapshot records what the server actually said."""

    path: str
    status: int
    body: str

    def json(self) -> Any:
        return json.loads(self.body)


@dataclass
class Transport:
    """The seam every test replaces. Real implementation is one urlopen call."""

    base_url: str = DEFAULT_BASE_URL
    timeout: float = 30.0

    def get(self, path: str) -> Response:
        request = urllib.request.Request(
            f"{self.base_url}{path}",
            method="GET",
            headers={"Accept": "application/json, text/plain", "User-Agent": USER_AGENT},
        )
        try:
            with urllib.request.urlopen(request, timeout=self.timeout) as reply:
                body = reply.read(MAX_BYTES).decode("utf-8", "replace")
                return Response(path, reply.status, body)
        except urllib.error.HTTPError as error:
            body = error.read(64 << 10).decode("utf-8", "replace")
            return Response(path, error.code, body)
        except (urllib.error.URLError, TimeoutError, OSError) as error:
            # A timeout and a refused connection are the same event for a collector:
            # nothing came back. Status 0 keeps them inside the retry policy rather
            # than raising out of the loop that knows how to wait.
            return Response(path, 0, str(error))


@dataclass
class Client:
    """Paced, retrying reads. Counts what it did so a snapshot can state its own cost."""

    transport: Transport = field(default_factory=Transport)
    delay: float = DEFAULT_DELAY_SECONDS
    attempts: int = 4
    sleep: Any = time.sleep
    requests: int = 0
    retries: int = 0
    failures: list[str] = field(default_factory=list)

    def get(self, path: str) -> Response:
        """Read one path, retrying transport failures and 5xx. Raises only on giving up."""
        last: Response | None = None
        for attempt in range(self.attempts):
            if self.requests:
                self.sleep(self.delay)
            self.requests += 1
            last = self.transport.get(path)
            if last.status == 200:
                return last
            if last.status not in RETRY_STATUSES:
                raise FetchError(f"{path}: HTTP {last.status}")
            self.retries += 1
            if attempt + 1 < self.attempts:
                self.sleep(self._backoff(attempt, last))
        self.failures.append(path)
        status = last.status if last else 0
        raise FetchError(f"{path}: gave up after {self.attempts} attempts (last HTTP {status})")

    def json(self, path: str) -> Any:
        """Read a path that must answer JSON, and say so when it does not."""
        reply = self.get(path)
        try:
            return reply.json()
        except json.JSONDecodeError as error:
            raise FetchError(f"{path}: expected JSON, got {reply.body[:120]!r}") from error

    def try_json(self, path: str) -> Any | None:
        """Same, but a path this collector can live without returns None."""
        try:
            return self.json(path)
        except FetchError:
            return None

    def _backoff(self, attempt: int, reply: Response) -> float:
        """Exponential with jitter, except when the server named a delay itself."""
        if reply.status == 429:
            stated = _retry_after(reply.body)
            if stated is not None:
                return min(stated, 60.0)
        return min(2.0**attempt, 16.0) + random.random()


def _retry_after(body: str) -> float | None:
    """Pull the wait out of a 429 body. The service states it there, not only in a header.

    Harnesses show an agent the body and drop the headers, which is why the service
    duplicates it. Parsing the sentence rather than the header means this works through a
    proxy that strips `Retry-After` too.

    Anchored on the phrase rather than "the first number in the body", because that body
    also states the budget: `the read budget for your IP (600/min) is spent` comes before
    `retry after: 7s`, so a first-number parser would sleep for ten minutes.
    """
    match = _RETRY_PHRASE.search(body)
    if not match:
        return None
    value = float(match.group("seconds"))
    return value if 0 < value <= 3600 else None


# `retry after: 7s` is what the service sends. `wait 7 seconds` is accepted too, so a
# deployment behind a proxy that rewords its own 429 still paces correctly.
_RETRY_PHRASE = re.compile(
    r"(?:retry[\s-]*after|wait)\D{0,12}?(?P<seconds>\d+(?:\.\d+)?)\s*(?:s\b|sec)",
    re.IGNORECASE,
)
