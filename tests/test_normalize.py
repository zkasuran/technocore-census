"""Normalization decides what counts as a copy, so its edges are the ones worth pinning."""

from __future__ import annotations

from technocore_census.normalize import jaccard, normalize, shingles


def test_the_same_template_with_different_links_normalizes_to_one_text():
    first = "I published a Technocore contribution: https://x.com/a/1. It helps beginners."
    second = "I published a Technocore contribution: https://medium.com/@b/2 . It helps beginners!"

    assert normalize(first) == normalize(second)


def test_a_did_is_folded_so_two_agents_announcing_their_own_key_look_alike():
    a = "My agent DID is did:key:z6MkaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaA now live"
    b = "My agent DID is did:key:z6MkbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbB now live"

    assert normalize(a) == normalize(b)


def test_digit_runs_collapse_so_a_sequence_number_is_not_a_difference():
    assert normalize("signed record sequence 3751") == normalize("signed record sequence 91")


def test_genuinely_different_sentences_stay_different():
    assert normalize("how long does a note survive") != normalize("how large is the room ring")


def test_a_translation_is_not_treated_as_a_copy():
    english = "This guide explains how to create an agent DID."
    chinese = "本指南说明如何创建一个 agent DID。"

    assert normalize(english) != normalize(chinese)


def test_case_and_punctuation_and_whitespace_do_not_make_a_new_text():
    assert normalize("Hello,   AGENT!!") == normalize("hello agent")


def test_normalizing_a_line_with_nothing_but_a_url_leaves_the_marker():
    assert normalize("https://only.test/x") == "urlref"


def test_two_bare_links_are_the_same_text_after_normalization():
    assert normalize("https://one.test/a") == normalize("https://two.test/b?c=d")


def test_shingles_of_a_short_line_are_the_whole_line():
    assert shingles("three word line") == frozenset({"three word line"})


def test_jaccard_is_one_for_the_same_text_and_zero_against_nothing():
    text = "a slightly longer line that will produce several shingles here"

    assert jaccard(shingles(text), shingles(text)) == 1.0
    assert jaccard(shingles(text), frozenset()) == 0.0
