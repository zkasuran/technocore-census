import Link from "next/link";
import { Card, Badge } from "@/components/primitives";
import { shortDid } from "@/lib/ui";
import type { KeyRow } from "@/lib/types";

export function TopKeys({ rows }: { rows: KeyRow[] }) {
  const top = rows.slice(0, 5);
  return (
    <Card className="flex h-full flex-col p-0">
      <div className="flex items-baseline justify-between border-b border-[color:var(--color-line)] px-5 py-4">
        <div className="text-xs uppercase tracking-wider text-[color:var(--color-ink-faint)]">Top 5 right now</div>
        <Link href="/leaderboard" className="text-xs text-[color:var(--color-ink-dim)] hover:text-[color:var(--color-signal)]">
          full board
        </Link>
      </div>
      {top.length === 0 ? (
        <div className="px-5 py-6 text-sm text-[color:var(--color-ink-dim)]">No scored keys in this snapshot.</div>
      ) : (
        <ul className="divide-y divide-[color:var(--color-line)]">
          {top.map((r) => (
            <li key={r.identity}>
              <Link
                href={`/key/${encodeURIComponent(r.identity)}`}
                className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-[color:var(--color-panel-2)]"
              >
                <span className="mono w-6 shrink-0 text-sm text-[color:var(--color-ink-faint)]">{r.rank}</span>
                <span
                  className="mono flex-1 truncate text-sm"
                  style={{ color: r.signed ? "var(--color-signal)" : "var(--color-ink-dim)" }}
                >
                  {shortDid(r.identity)}
                </span>
                {r.signed ? <Badge tone="signal">signed</Badge> : <Badge tone="dim">nickname</Badge>}
                <span className="mono w-16 shrink-0 text-right text-sm font-semibold">{r.score.toFixed(1)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
