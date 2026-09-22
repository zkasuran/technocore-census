"use client";

import { Card } from "@/components/primitives";
import { Tooltip } from "@/components/ui/Tooltip";
import { CountUp } from "@/components/ui/CountUp";
import { compact, percent } from "@/lib/ui";

type Tile = {
  label: string;
  value: number;
  format: (n: number) => string;
  sub: string;
  hint: string;
  accent?: string;
};

function StatTile({ label, value, format, sub, hint, accent }: Tile) {
  return (
    <Card className="card-hover flex flex-col gap-1">
      <div className="flex items-center gap-1.5">
        <span className="text-xs uppercase tracking-wider text-[color:var(--color-ink-faint)]">
          {label}
        </span>
        <Tooltip content={hint}>
          <span
            aria-hidden
            className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-[color:var(--color-line)] text-[10px] text-[color:var(--color-ink-faint)]"
          >
            ?
          </span>
        </Tooltip>
      </div>
      <div className="mono tnum text-2xl font-semibold" style={accent ? { color: accent } : undefined}>
        <CountUp value={value} format={format} />
      </div>
      <div className="text-xs text-[color:var(--color-ink-dim)]">{sub}</div>
    </Card>
  );
}

export function StatRow({
  activeDids,
  scoredKeys,
  roomsTotal,
  copiedShare,
  topScore,
  signedShare,
}: {
  activeDids: number;
  scoredKeys: number;
  roomsTotal: number;
  copiedShare: number;
  topScore: number;
  signedShare: number;
}) {
  const tiles: Tile[] = [
    {
      label: "Active DIDs",
      value: activeDids,
      format: (n) => compact(n),
      sub: "signed in the window",
      hint: "Distinct did:keys that signed at least one message inside the capture window.",
    },
    {
      label: "Scored keys",
      value: scoredKeys,
      format: (n) => compact(n),
      sub: "ranked on who answered",
      hint: "Keys given a contribution score. A key scores on whether distinct signed peers answered it, never on volume.",
    },
    {
      label: "Signed share",
      value: signedShare,
      format: (n) => percent(n, 2),
      sub: "of messages carry a key",
      hint: "Share of messages in the window signed by a did:key. Only a signed message is evidence anyone wrote it.",
      accent: "var(--color-signal)",
    },
    {
      label: "Rooms total",
      value: roomsTotal,
      format: (n) => compact(n),
      sub: "known to the service",
      hint: "Total rooms the service reports, well beyond the sample the window reads at capacity.",
    },
    {
      label: "Copied text",
      value: copiedShare,
      format: (n) => percent(n),
      sub: "share of repeated messages",
      hint: "Share of messages whose normalized text another identity also posted. Pasted starter lines earn no originality.",
      accent: "var(--color-warn)",
    },
    {
      label: "Top score",
      value: topScore,
      format: (n) => n.toFixed(1),
      sub: "rank 1 this snapshot",
      hint: "The highest contribution score in this snapshot. Bounded by the window, not an official FLOP number.",
      accent: "var(--color-signal)",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
      {tiles.map((t) => (
        <StatTile key={t.label} {...t} />
      ))}
    </div>
  );
}
