import Link from "next/link";
import { Card, Badge } from "@/components/primitives";
import { shortDid } from "@/lib/ui";
import type { KeyRow } from "@/lib/types";

/** A small rank-movement hint when the history pipeline has filled it in. */
function Movement({ row }: { row: KeyRow }) {
  const d = row.movement?.rank_delta;
  if (row.movement?.first_report) {
    return <span className="text-[color:var(--color-cool)]">new</span>;
  }
  if (d == null || d === 0) return <span className="text-[color:var(--color-ink-faint)]">–</span>;
  // Negative delta means the key climbed toward rank 1.
  const climbed = d < 0;
  return (
    <span style={{ color: climbed ? "var(--color-signal)" : "var(--color-warn)" }}>
      {climbed ? "▲" : "▼"}
      {Math.abs(d)}
    </span>
  );
}

export function TopKeys({ rows }: { rows: KeyRow[] }) {
  const top = rows.slice(0, 5);
  return (
    <Card className="card-hover flex h-full flex-col p-0">
      <div className="flex items-baseline justify-between border-b border-[color:var(--color-line)] px-5 py-4">
        <div className="text-xs uppercase tracking-wider text-[color:var(--color-ink-faint)]">
          Top 5 right now
        </div>
        <Link
          href="/leaderboard"
          className="focus-ring rounded text-xs text-[color:var(--color-ink-dim)] transition-colors hover:text-[color:var(--color-signal)]"
        >
          full board →
        </Link>
      </div>
      {top.length === 0 ? (
        <div className="px-5 py-6 text-sm text-[color:var(--color-ink-dim)]">
          No scored keys in this snapshot.
        </div>
      ) : (
        <ul className="divide-y divide-[color:var(--color-line)]">
          {top.map((r) => (
            <li key={r.identity}>
              <Link
                href={`/key/${encodeURIComponent(r.identity)}`}
                className="focus-ring flex items-center gap-3 px-5 py-3 transition-colors hover:bg-[color:var(--color-panel-2)]"
              >
                <span className="mono tnum w-6 shrink-0 text-sm text-[color:var(--color-ink-faint)]">
                  {r.rank}
                </span>
                <span
                  className="mono flex-1 truncate text-sm"
                  style={{ color: r.signed ? "var(--color-signal)" : "var(--color-ink-dim)" }}
                >
                  {shortDid(r.identity)}
                </span>
                <span className="mono tnum hidden w-10 shrink-0 text-right text-xs sm:inline">
                  <Movement row={r} />
                </span>
                {r.signed ? <Badge tone="signal">signed</Badge> : <Badge tone="dim">nickname</Badge>}
                <span className="mono tnum w-16 shrink-0 text-right text-sm font-semibold">
                  {r.score.toFixed(1)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-auto border-t border-[color:var(--color-line)] px-5 py-3 text-xs text-[color:var(--color-ink-faint)]">
        Signed keys read green. A nickname proves nothing and is never ranked.
      </div>
    </Card>
  );
}
