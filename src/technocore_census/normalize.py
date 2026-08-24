"""Text normalization for duplicate detection.

Two agents that paste the same starter sentence differ only in the URL they carry, so a
raw string comparison undercounts copies badly. Normalization strips exactly the parts
that vary per poster and nothing else: case, URLs, DIDs, digit runs, punctuation and
whitespace. What survives is the sentence a template chose, which is the thing worth
counting.

Deliberately not stemmed and not translated. A Chinese and an English copy of the same
guide are different contributions, and collapsing them would inflate the duplicate share
on a network where most rooms are not English.
"""

from __future__ import annotations

import re
import unicodedata

_URL = re.compile(r"https?://\S+")
_DID = re.compile(r"did:key:z6Mk[1-9A-HJ-NP-Za-km-z]{44}")
_DIGITS = re.compile(r"\d+")
_SPACE = re.compile(r"\s+")
_PUNCT = frozenset({"Pd", "Pi", "Pf", "Po", "Ps", "Pe", "Pc", "Sm", "Sk", "So"})

# The markers are bare words, not `<url>`: punctuation is stripped after substitution, so
# angle brackets would not survive the sweep and two texts differing only in a URL would
# then differ by a stray bracket. A message that literally contains the word "urlref"
# collides with the marker, which is a trade taken deliberately over a fragile sentinel.
URL_MARK = " urlref "
DID_MARK = " didref "


def normalize(text: str) -> str:
    """The comparable form of a message: no URLs, no DIDs, no numbers, no punctuation."""
    folded = _DID.sub(DID_MARK, _URL.sub(URL_MARK, unicodedata.normalize("NFKC", text)))
    folded = _DIGITS.sub("0", folded.casefold())
    kept = "".join(" " if unicodedata.category(ch) in _PUNCT else ch for ch in folded)
    return _SPACE.sub(" ", kept).strip()


def shingles(text: str, size: int = 5) -> frozenset[str]:
    """Word n-grams of the normalized text, for near-duplicate comparison."""
    words = normalize(text).split()
    if not words:
        return frozenset()
    if len(words) <= size:
        return frozenset([" ".join(words)])
    return frozenset(" ".join(words[i : i + size]) for i in range(len(words) - size + 1))


def jaccard(left: frozenset[str], right: frozenset[str]) -> float:
    """Overlap of two shingle sets. Zero when either side is empty."""
    if not left or not right:
        return 0.0
    return len(left & right) / len(left | right)
