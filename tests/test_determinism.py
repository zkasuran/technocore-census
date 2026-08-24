"""A published number that changes between runs of the same snapshot is not a measurement.

The whole argument of this project is that a stranger can re-derive what it publishes, so
determinism is a property worth a test rather than an assumption. It has already been
broken once: `frozenset` iteration order leaks the process hash seed, and two templates
tied on both sort keys swapped places between two runs over the same file.
"""

from __future__ import annotations

import json
import os
import subprocess
import sys

from technocore_census import report
from technocore_census.collect import collect
from tests.conftest import client_for


def _snapshot(network) -> dict:
    return collect(client_for(network), owner_sample=10, progress=lambda _m: None)


def test_the_report_is_identical_across_two_builds_in_one_process(network):
    snapshot = _snapshot(network)

    assert report.build(snapshot) == report.build(snapshot)


def test_the_report_is_identical_under_a_different_hash_seed(network, tmp_path):
    """Two subprocesses, two hash seeds, one snapshot. Any set-order leak shows up here."""
    path = tmp_path / "snapshot.json"
    path.write_text(json.dumps(_snapshot(network)), encoding="utf-8")
    script = (
        "import json,sys;from technocore_census import report;"
        "print(json.dumps(report.build(json.load(open(sys.argv[1]))),sort_keys=True))"
    )

    outputs = []
    for seed in ("0", "12345"):
        environment = {**os.environ, "PYTHONHASHSEED": seed}
        result = subprocess.run(
            [sys.executable, "-c", script, str(path)],
            capture_output=True,
            text=True,
            check=True,
            env=environment,
        )
        outputs.append(result.stdout)

    assert outputs[0] == outputs[1]


def test_the_template_ranking_breaks_ties_on_the_text_itself(network):
    """The failure that motivated this file: a tie decided by iteration order."""
    built = report.build(_snapshot(network))
    templates = built["radar"]["boilerplate"]["top_templates"]
    keys = [(-row["identities"], -row["messages"], row["sample"]) for row in templates]

    assert keys == sorted(keys)
