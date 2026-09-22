"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { KeyRow } from "@/lib/types";
import { cn, shortDid, compact, percent, riskColor } from "@/lib/ui";

type SortId =
  | "rank"
  | "identity"
  | "score"
  | "credit"
  | "messages"
  | "rooms"
  | "distinct_responders"
  | "reciprocity"
  | "originality"
  | "risk"
  | "movement";

type Dir = "asc" | "desc";

interface Column {
  id: SortId;
  label: string;
  align: "left" | "right";
  // numeric columns default to descending on first click, text/rank to ascending
  numeric: boolean;
  value: (r: KeyRow) => number | string | null;
}

const COLUMNS: Column[] = [
  { id: "rank", label: "#", align: "left", numeric: false, value: (r) => r.rank },
  { id: "identity", label: "Key", align: "left", numeric: false, value: (r) => r.identity },
  { id: "score", label: "Score", align: "right", numeric: true, value: (r) => r.score },
  { id: "credit", label: "Credit", align: "right", numeric: true, value: (r) => r.credit },
  { id: "messages", label: "Msgs", align: "right", numeric: true, value: (r) => r.messages },
  { id: "rooms", label: "Rooms", align: "right", numeric: true, value: (r) => r.rooms },
  {
    id: "distinct_responders",
    label: "Responders",
    align: "right",
    numeric: true,
    value: (r) => r.distinct_responders,
  },
  { id: "reciprocity", label: "Recip.", align: "right", numeric: true, value: (r) => r.reciprocity },
  { id: "originality", label: "Orig.", align: "right", numeric: true, value: (r) => r.originality },
  {
    id: "risk",
    label: "Risk",
    align: "right",
    numeric: true,
    value: (r) => (r.risk ? r.risk.score : null),
  },
  {
    id: "movement",
    label: "Move",
    align: "right",
    numeric: true,
    value: (r) => (r.movement && r.movement.rank_delta !== null ? r.movement.rank_delta : null),
  },
];

const MEDALS: Record<number, { color: string; label: string }> = {
  1: { color: "var(--color-warn)", label: "1st" },
  2: { color: "var(--color-ink-dim)", label: "2nd" },
  3: { color: "#cd7f32", label: "3rd" },
};

function compareNullable(a: number | string | null, b: number | string | null): number {
  // nulls always sort last regardless of direction
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  if (typeof a === "string" && typeof b === "string") return a.localeCompare(b);
  return (a as number) - (b as number);
}

function RiskCell({ row }: { row: KeyRow }) {
  if (!row.risk) return <span className="text-[color:var(--color-ink-faint)]">—</span>;
  const color = riskColor(row.risk.band);
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium capitalize"
      style={{ backgroundColor: `color-mix(in srgb, ${color} 15%, transparent)`, color }}
      title={row.risk.reasons.join("; ")}
    >
      <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
      {row.risk.band}
    </span>
  );
}

function MovementCell({ row }: { row: KeyRow }) {
  const delta = row.movement?.rank_delta;
  if (!row.movement || delta === null || delta === undefined) {
    return <span className="text-[color:var(--color-ink-faint)]">—</span>;
  }
  if (delta === 0) {
    return <span className="text-[color:var(--color-ink-dim)]">0</span>;
  }
  // negative delta = climbed toward rank 1
  const climbed = delta < 0;
  const color = climbed ? "var(--color-signal)" : "var(--color-flag)";
  return (
    <span className="mono inline-flex items-center gap-0.5" style={{ color }}>
      {climbed ? "▲" : "▼"}
      {Math.abs(delta)}
    </span>
  );
}

function KeyCell({ row }: { row: KeyRow }) {
  if (row.signed) {
    return (
      <span className="mono text-[color:var(--color-signal)]">
        {shortDid(row.identity)}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-2">
      <span className="mono text-[color:var(--color-ink-dim)]">{row.identity}</span>
      <span className="rounded-full bg-[color:var(--color-panel-2)] px-2 py-0.5 text-[10px] uppercase tracking-wider text-[color:var(--color-ink-faint)]">
        nickname
      </span>
    </span>
  );
}

export function LeaderboardTable({ rows }: { rows: KeyRow[] }) {
  const [query, setQuery] = useState("");
  const [sortId, setSortId] = useState<SortId>("score");
  const [dir, setDir] = useState<Dir>("desc");
  const [signedOnly, setSignedOnly] = useState(false);

  const hasNicknames = useMemo(() => rows.some((r) => !r.signed), [rows]);
  const maxScore = useMemo(
    () => rows.reduce((m, r) => (r.score > m ? r.score : m), 0) || 1,
    [rows],
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const col = COLUMNS.find((c) => c.id === sortId) ?? COLUMNS[2];
    const filtered = rows.filter((r) => {
      if (signedOnly && !r.signed) return false;
      if (q && !r.identity.toLowerCase().includes(q)) return false;
      return true;
    });
    const sorted = [...filtered].sort((a, b) => {
      const cmp = compareNullable(col.value(a), col.value(b));
      return dir === "asc" ? cmp : -cmp;
    });
    return sorted;
  }, [rows, query, sortId, dir, signedOnly]);

  function onSort(col: Column) {
    if (col.id === sortId) {
      setDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortId(col.id);
      setDir(col.numeric ? "desc" : "asc");
    }
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[240px]">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter by did:key substring"
            aria-label="Filter by did:key substring"
            className="w-full rounded-lg border border-[color:var(--color-line)] bg-[color:var(--color-panel)] px-3 py-2 text-sm text-[color:var(--color-ink)] placeholder:text-[color:var(--color-ink-faint)] outline-none focus:border-[color:var(--color-signal-dim)]"
          />
        </div>
        {hasNicknames && (
          <button
            type="button"
            onClick={() => setSignedOnly((s) => !s)}
            aria-pressed={signedOnly}
            className={cn(
              "rounded-lg border px-3 py-2 text-sm transition-colors",
              signedOnly
                ? "border-[color:var(--color-signal-dim)] bg-[color:var(--color-signal)]/10 text-[color:var(--color-signal)]"
                : "border-[color:var(--color-line)] text-[color:var(--color-ink-dim)] hover:text-[color:var(--color-ink)]",
            )}
          >
            {signedOnly ? "Signed only" : "Include nicknames"}
          </button>
        )}
        <div className="text-sm text-[color:var(--color-ink-faint)]">
          {visible.length.toLocaleString("en-US")} shown
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="sticky top-14 z-20 bg-[color:var(--color-panel-2)] text-[color:var(--color-ink-faint)]">
                {COLUMNS.map((col) => {
                  const activeSort = col.id === sortId;
                  return (
                    <th
                      key={col.id}
                      scope="col"
                      className={cn(
                        "px-3 py-2.5 text-xs font-medium uppercase tracking-wider whitespace-nowrap select-none",
                        col.align === "right" ? "text-right" : "text-left",
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => onSort(col)}
                        aria-sort={activeSort ? (dir === "asc" ? "ascending" : "descending") : "none"}
                        className={cn(
                          "inline-flex items-center gap-1 transition-colors hover:text-[color:var(--color-ink)]",
                          activeSort && "text-[color:var(--color-ink)]",
                          col.align === "right" && "flex-row-reverse",
                        )}
                      >
                        <span>{col.label}</span>
                        <span className="w-2 text-[10px]">
                          {activeSort ? (dir === "asc" ? "▲" : "▼") : ""}
                        </span>
                      </button>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {visible.map((row) => {
                const medal = row.signed ? MEDALS[row.rank] : undefined;
                const barPct = Math.max(0, Math.min(100, (row.score / maxScore) * 100));
                return (
                  <tr
                    key={row.identity}
                    className="group border-t border-[color:var(--color-line)] hover:bg-[color:var(--color-panel-2)]/60 transition-colors"
                  >
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      {medal ? (
                        <span
                          className="mono inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold"
                          style={{
                            color: medal.color,
                            backgroundColor: `color-mix(in srgb, ${medal.color} 18%, transparent)`,
                          }}
                          title={`Rank ${medal.label}`}
                        >
                          {row.rank}
                        </span>
                      ) : (
                        <span className="mono text-[color:var(--color-ink-dim)]">
                          {row.signed ? row.rank : "—"}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <Link
                        href={`/key/${encodeURIComponent(row.identity)}`}
                        className="hover:underline underline-offset-4"
                      >
                        <KeyCell row={row} />
                      </Link>
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <div className="relative">
                        <div
                          className="absolute inset-y-0 right-0 rounded-sm bg-[color:var(--color-signal)]/10"
                          style={{ width: `${barPct}%` }}
                          aria-hidden
                        />
                        <span className="relative mono font-semibold text-[color:var(--color-ink)]">
                          {row.score.toLocaleString("en-US", { maximumFractionDigits: 2 })}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-right mono text-[color:var(--color-ink-dim)]">
                      {compact(row.credit)}
                    </td>
                    <td className="px-3 py-2.5 text-right mono text-[color:var(--color-ink-dim)]">
                      {compact(row.messages)}
                    </td>
                    <td className="px-3 py-2.5 text-right mono text-[color:var(--color-ink-dim)]">
                      {row.rooms}
                    </td>
                    <td className="px-3 py-2.5 text-right mono text-[color:var(--color-ink-dim)]">
                      {compact(row.distinct_responders)}
                    </td>
                    <td className="px-3 py-2.5 text-right mono text-[color:var(--color-ink-dim)]">
                      {percent(row.reciprocity)}
                    </td>
                    <td className="px-3 py-2.5 text-right mono text-[color:var(--color-ink-dim)]">
                      {percent(row.originality)}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <RiskCell row={row} />
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <MovementCell row={row} />
                    </td>
                  </tr>
                );
              })}
              {visible.length === 0 && (
                <tr>
                  <td
                    colSpan={COLUMNS.length}
                    className="px-3 py-10 text-center text-[color:var(--color-ink-faint)]"
                  >
                    No keys match that filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
