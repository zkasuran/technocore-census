"""Signing, and the only place in this package that can write to Technocore.

Two things live here: the `did:key` an operator publishes results under, and the signed
write lane the service verifies offline. Keeping both behind one module with an explicit
key argument means no analysis path can post by accident.

The signature covers `<room>|<nonce>|<text>` where the text is what the server will store,
after its single-line sweep. Signing the raw text instead fails verification, which is the
one mistake worth guarding in code rather than in a comment, so `canonical()` does the
sweep and the caller cannot skip it.

Nonces must increase per key per room. A millisecond clock is what the manual suggests and
it is what this uses, because a counter needs state on disk and a stalled process with a
stale counter is a silent refusal.
"""

from __future__ import annotations

import base64
import hashlib
import json
import time
import unicodedata
import urllib.error
import urllib.request
from dataclasses import dataclass
from pathlib import Path

from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey

MULTICODEC_ED25519 = b"\xed\x01"
_B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"
INVISIBLE = frozenset({"Cc", "Cf", "Cs", "Co", "Zl", "Zp"})
MAX_MESSAGE_CHARS = 4096
MAX_NOTE_CHARS = 8192


class SigningError(RuntimeError):
    """The identity cannot be loaded, or a payload will not be accepted."""


def canonical(text: str) -> str:
    """The exact text the server stores: invisibles swept to spaces, then stripped."""
    swept = "".join(" " if unicodedata.category(ch) in INVISIBLE else ch for ch in text)
    return " ".join(swept.split())


def _b58(data: bytes) -> str:
    number = int.from_bytes(data, "big")
    out = ""
    while number:
        number, rest = divmod(number, 58)
        out = _B58[rest] + out
    return "1" * (len(data) - len(data.lstrip(b"\x00"))) + out


@dataclass
class Identity:
    """One Ed25519 key and the DID that is its public half."""

    key: Ed25519PrivateKey

    @classmethod
    def load(cls, path: Path, passphrase: bytes | None) -> Identity:
        try:
            loaded = serialization.load_pem_private_key(path.read_bytes(), password=passphrase)
        except (OSError, ValueError, TypeError) as error:
            raise SigningError(f"cannot load identity {path}: {error}") from error
        if not isinstance(loaded, Ed25519PrivateKey):
            raise SigningError("identity must hold an Ed25519 private key")
        return cls(loaded)

    @property
    def did(self) -> str:
        raw = self.key.public_key().public_bytes(
            serialization.Encoding.Raw, serialization.PublicFormat.Raw
        )
        return "did:key:z" + _b58(MULTICODEC_ED25519 + raw)

    @property
    def fingerprint(self) -> str:
        """The DID note key: first 16 hex characters of SHA-256 of the DID string.

        The convention is from the service's own `/patterns.md`, because a note key cannot
        hold the colons and uppercase of a DID.
        """
        return hashlib.sha256(self.did.encode("utf-8")).hexdigest()[:16]

    def sign(self, payload: str) -> str:
        return base64.urlsafe_b64encode(self.key.sign(payload.encode("utf-8"))).decode().rstrip("=")


def nonce() -> str:
    """A millisecond clock, which increases per key per room without keeping state."""
    return str(time.time_ns() // 1_000_000)


def did_note_value(did: str, url: str) -> str:
    """The DID note: our key, then where to check what it publishes.

    The convention is the service's own (`/patterns.md` pattern 3): one line under
    `/kv/did/<fingerprint>`, the full `did:key` first, because a peer trusts the note only
    insofar as our signed messages verify against the key inside it. The note itself proves
    nothing on its own, so it stays short and points at the work rather than describing it.
    """
    value = canonical(f"{did} census:{url}")
    if len(value) > MAX_NOTE_CHARS:
        raise SigningError(f"note is {len(value)} chars; the cap is {MAX_NOTE_CHARS}")
    return value


@dataclass
class Publisher:
    """Signed writes to one instance. POST, so a long message needs no URL budget."""

    identity: Identity
    base_url: str = "https://technocore.chat"
    timeout: float = 30.0

    def say(self, room: str, text: str) -> dict:
        """Post one signed message. Returns the service's JSON reply."""
        body = canonical(text)
        if not body:
            raise SigningError("message has no visible text after the sweep")
        if len(body) > MAX_MESSAGE_CHARS:
            raise SigningError(f"message is {len(body)} chars; the cap is {MAX_MESSAGE_CHARS}")
        stamp = nonce()
        payload = {
            "did": self.identity.did,
            "sig": self.identity.sign(f"{room}|{stamp}|{body}"),
            "nonce": stamp,
            "text": body,
        }
        return self._post(f"/r/{room}?format=json", payload)

    def set_note(self, namespace: str, key: str, value: str) -> str:
        """Write a world-writable note. Unsigned: the service only verifies signed note
        writes for `room-owners` and `room-allow`, so signing anything else is refused."""
        body = canonical(value)
        if len(body) > MAX_NOTE_CHARS:
            raise SigningError(f"note is {len(body)} chars; the cap is {MAX_NOTE_CHARS}")
        reply = self._post(f"/kv/{namespace}/{key}", {"value": body}, expect_json=False)
        return reply if isinstance(reply, str) else json.dumps(reply)

    def _post(self, path: str, payload: dict, *, expect_json: bool = True):
        request = urllib.request.Request(
            f"{self.base_url}{path}",
            data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
            method="POST",
            headers={
                "Content-Type": "application/json; charset=utf-8",
                "Accept": "application/json, text/plain",
                "User-Agent": "technocore-census/0.1",
            },
        )
        try:
            with urllib.request.urlopen(request, timeout=self.timeout) as reply:
                raw = reply.read(1 << 20).decode("utf-8", "replace")
        except urllib.error.HTTPError as error:
            detail = error.read(8 << 10).decode("utf-8", "replace")
            raise SigningError(f"{path}: HTTP {error.code}: {detail[:300]}") from None
        except (urllib.error.URLError, TimeoutError, OSError) as error:
            raise SigningError(f"{path}: {error}") from error
        if not expect_json:
            return raw
        try:
            return json.loads(raw)
        except json.JSONDecodeError as error:
            raise SigningError(f"{path}: expected JSON, got {raw[:200]!r}") from error
