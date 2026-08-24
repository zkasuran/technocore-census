"""Signing and the DID note are what make our own key verifiable, so both are pinned.

No test here touches the network. The publisher's transport is replaced, because what
matters is the exact bytes that get signed: the service verifies `room|nonce|text` over the
swept text, so a signature built from the raw text is refused and that mistake is silent
until a live write fails.
"""

from __future__ import annotations

import base64
import json

import pytest
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey, Ed25519PublicKey

from technocore_census.identity import (
    Identity,
    Publisher,
    SigningError,
    canonical,
    did_note_value,
    nonce,
)

# A fixed seed, so the DID and every signature in these tests are the same on every run.
SEED = bytes(range(32))


@pytest.fixture
def identity() -> Identity:
    return Identity(Ed25519PrivateKey.from_private_bytes(SEED))


def test_the_did_is_the_canonical_ed25519_multibase_form(identity):
    did = identity.did

    assert did.startswith("did:key:z6Mk")
    assert len(did.removeprefix("did:key:")) == 48


def test_the_did_round_trips_through_the_multibase_encoding(identity):
    # Decoding our own DID back to key bytes is what every verifier does, so a bug in the
    # base58 encoder has to fail here rather than at a stranger's verification.
    multibase = identity.did.removeprefix("did:key:")
    alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"
    number = 0
    for character in multibase[1:]:
        number = number * 58 + alphabet.index(character)
    decoded = number.to_bytes(34, "big")

    assert decoded[:2] == b"\xed\x01"
    assert decoded[2:] == Ed25519PrivateKey.from_private_bytes(SEED).public_key().public_bytes(
        serialization.Encoding.Raw, serialization.PublicFormat.Raw
    )


def test_a_signature_verifies_against_the_did_it_names(identity):
    payload = "census|1787588000000|hello from the census"
    signature = identity.sign(payload)

    raw = base64.urlsafe_b64decode(signature + "==")
    public = Ed25519PublicKey.from_public_bytes(
        Ed25519PrivateKey.from_private_bytes(SEED)
        .public_key()
        .public_bytes(serialization.Encoding.Raw, serialization.PublicFormat.Raw)
    )
    public.verify(raw, payload.encode("utf-8"))  # raises if it does not verify

    assert len(signature) == 86
    assert "=" not in signature


def test_the_sweep_matches_what_the_server_stores():
    # The service replaces every invisible character with a space before storage and
    # before verifying, so the signature must cover the swept text.
    assert canonical("two​words") == "two words"
    assert canonical("line\nbreak") == "line break"
    assert canonical("  padded   out  ") == "padded out"


def test_a_message_is_signed_over_the_swept_text_not_the_raw_text(identity):
    sent = {}

    class Recorder:
        def __call__(self, path, payload, expect_json=True):
            sent.update(payload=payload, path=path)
            return {"room": "census", "posted": {"seq": 1, "from": identity.did}}

    publisher = Publisher(identity)
    publisher._post = Recorder()
    publisher.say("census", "zero​width inside")

    payload = sent["payload"]
    assert payload["text"] == "zero width inside"
    expected = identity.sign(f"census|{payload['nonce']}|zero width inside")
    assert payload["sig"] == expected


def test_a_message_with_no_visible_text_is_refused_before_it_is_sent(identity):
    publisher = Publisher(identity)

    with pytest.raises(SigningError, match="no visible text"):
        publisher.say("census", "​ \n\t")


def test_a_message_past_the_character_cap_is_refused_locally(identity):
    publisher = Publisher(identity)

    with pytest.raises(SigningError, match="4096"):
        publisher.say("census", "x" * 4097)


def test_the_fingerprint_is_the_convention_the_service_publishes(identity):
    import hashlib

    expected = hashlib.sha256(identity.did.encode("utf-8")).hexdigest()[:16]

    assert identity.fingerprint == expected
    assert len(identity.fingerprint) == 16
    assert identity.fingerprint.islower()


def test_the_did_note_names_the_key_first_so_a_reader_can_verify_signatures(identity):
    value = did_note_value(identity.did, "https://example.test/census")

    assert value.startswith(identity.did)
    assert "https://example.test/census" in value
    assert len(value) <= 8192
    assert "\n" not in value


def test_a_note_past_the_cap_is_refused_rather_than_truncated(identity):
    publisher = Publisher(identity)

    with pytest.raises(SigningError, match="8192"):
        publisher.set_note("did", identity.fingerprint, "x" * 8193)


def test_nonces_increase_so_a_second_write_is_never_a_replay():
    first = int(nonce())
    second = int(nonce())

    assert second >= first
    assert len(nonce()) <= 19


def test_an_http_error_carries_the_service_reason_into_the_exception(identity):
    class Refuses:
        def __call__(self, path, payload, expect_json=True):
            raise SigningError(f"{path}: HTTP 403: room is owned by another key")

    publisher = Publisher(identity)
    publisher._post = Refuses()

    with pytest.raises(SigningError, match="room is owned"):
        publisher.say("d-someone-elses", "hello")


def test_the_post_body_is_the_four_fields_the_service_documents(identity):
    captured = {}

    class Recorder:
        def __call__(self, path, payload, expect_json=True):
            captured.update(payload)
            return {"room": "census", "posted": {"seq": 2}}

    publisher = Publisher(identity)
    publisher._post = Recorder()
    publisher.say("census", "plain line")

    assert set(captured) == {"did", "sig", "nonce", "text"}
    assert json.dumps(captured)  # serializable, which is what the transport needs
