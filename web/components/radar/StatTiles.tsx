/*
 * The four headline sybil signals. Each tile carries the number, what it counts, and one
 * plain line on why it matters to an airdrop that pays for real work. A concerning value
 * takes an amber or red accent AND a word ("watch", "elevated"), so the meaning never rides
 * on color alone. Thresholds are presentation only, not a verdict.
 */
import { Card } from "@/components/primitives";
import { compact, percent } from "@/lib/ui";
import type { RadarView } from "./model";

const SIGNAL = "var(--color-signal)";
const WARN = "var(--color-warn)";
const FLAG = "var(--color-flag)";

type Status = { color: string; word: string };

function statusFor(x: number, warn: number, flag: number): Status {
  if (x >= flag) return { color: FLAG, word: "elevated" };
  if (x >= warn) return { color: WARN, word: "watch" };
  return { color: SIGNAL, word: "within range" };
}

function Tile({
  label,
  value,
  status,
  counts,
  why,
}: {
  label: string;
  value: string;
  status: Status;
  counts: string;
  why: string;
}) {
  return (
    <Card className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs uppercase tracking-wider text-[color:var(--color-ink-faint)]">{label}</div>
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider"
          style={{ color: status.color, background: `color-mix(in oklab, ${status.color} 15%, transparent)` }}
        >
          <span aria-hidden className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: status.color }} />
          {status.word}
        </span>
      </div>
      <div className="mono text-3xl font-semibold leading-none" style={{ color: status.color }}>
        {value}
      </div>
      <div className="text-xs text-[color:var(--color-ink-dim)]">{counts}</div>
      <div className="mt-1 border-t border-[color:var(--color-line)] pt-2 text-xs text-[color:var(--color-ink-faint)] leading-relaxed">
        {why}
      </div>
    </Card>
  );
}

export function StatTiles({ view }: { view: RadarView }) {
  const bp = view.boilerplate;
  const ke = view.keys;
  const cl = view.clusters;

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Tile
        label="Copied-text share"
        value={percent(bp.copied_share)}
        status={statusFor(bp.copied_share, 0.1, 0.25)}
        counts={`${compact(bp.copied_messages)} of ${compact(bp.messages_in_window)} messages repeat another key's string`}
        why="An airdrop that counts messages rewards this copied volume unless it is filtered out."
      />
      <Tile
        label="Keys never answered"
        value={compact(ke.never_answered)}
        status={statusFor(ke.never_answered_share, 0.05, 0.15)}
        counts={`${percent(ke.never_answered_share, 2)} of ${compact(ke.scored)} scored keys drew no signed reply`}
        why="A key that only ever talks to itself is cheap to mint by the thousand for the count."
      />
      <Tile
        label="Isolated clusters"
        value={compact(cl.isolated_clusters)}
        status={statusFor(cl.isolated_clusters, 10, 40)}
        counts={`${percent(cl.isolated_message_share, 2)} of messages stay inside their own group`}
        why="A few keys answering only each other manufacture the look of real conversation."
      />
      <Tile
        label="One-peer keys"
        value={compact(cl.keys_answered_by_one_peer_only)}
        status={statusFor(cl.keys_answered_by_one_peer_only, 25, 100)}
        counts="every answer they got came from a single other key"
        why="Two keys covering for each other read as engaged while reaching nobody else."
      />
    </div>
  );
}
