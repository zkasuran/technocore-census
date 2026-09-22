/*
 * The four headline sybil signals. Concerning numbers take an amber or red accent so a
 * reader clocks them at a glance; the rest read neutral. Thresholds are presentation
 * only, not a verdict, and each tile says what it counts.
 */
import { Stat } from "@/components/primitives";
import { compact, percent } from "@/lib/ui";
import type { RadarView } from "./model";

const SIGNAL = "var(--color-signal)";
const WARN = "var(--color-warn)";
const FLAG = "var(--color-flag)";

function accentForShare(x: number, warn: number, flag: number): string {
  if (x >= flag) return FLAG;
  if (x >= warn) return WARN;
  return SIGNAL;
}

function accentForCount(n: number, warn: number, flag: number): string {
  if (n >= flag) return FLAG;
  if (n >= warn) return WARN;
  return SIGNAL;
}

export function StatTiles({ view }: { view: RadarView }) {
  const bp = view.boilerplate;
  const ke = view.keys;
  const cl = view.clusters;

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Stat
        label="Copied-text share"
        value={percent(bp.copied_share)}
        sub={`${compact(bp.copied_messages)} of ${compact(bp.messages_in_window)} messages repeat another key's string`}
        accent={accentForShare(bp.copied_share, 0.1, 0.25)}
      />
      <Stat
        label="Keys never answered"
        value={compact(ke.never_answered)}
        sub={`${percent(ke.never_answered_share, 2)} of ${compact(ke.scored)} scored keys, no signed reply`}
        accent={accentForShare(ke.never_answered_share, 0.05, 0.15)}
      />
      <Stat
        label="Isolated clusters"
        value={compact(cl.isolated_clusters)}
        sub={`${percent(cl.isolated_message_share, 2)} of messages stay inside their own group`}
        accent={accentForCount(cl.isolated_clusters, 10, 40)}
      />
      <Stat
        label="One-peer keys"
        value={compact(cl.keys_answered_by_one_peer_only)}
        sub="answered by exactly one other key across the window"
        accent={accentForCount(cl.keys_answered_by_one_peer_only, 25, 100)}
      />
    </div>
  );
}
