"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
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
  full: string; // accessible full name for the header button
  align: "left" | "right";
  numeric: boolean; // numeric columns sort descending on first click
  value: (r: KeyRow) => number | string | null;
}

const COLUMNS: Column[] = [
  { id: "rank", label: "#", full: "Rank", align: "left", numeric: false, value: (r) => r.rank },
  { id: "identity", label: "Key", full: "did:key", align: "left", numeric: false, value: (r) => r.identity },
  { id: "score", label: "Score", full: "Score", align: "right", numeric: true, value: (r) => r.score },
  { id: "credit", label: "Credit", full: "Credit", align: "right", numeric: true, value: (r) => r.credit },
  { id: "messages", label: "Msgs", full: "Messages", align: "right", numeric: true, value: (r) => r.messages },
  { id: "rooms", label: "Rooms", full: "Rooms", align: "right", numeric: true, value: (r) => r.rooms },
  {
    id: "distinct_responders",
    label: "Responders",
    full: "Distinct signed responders",
    align: "right",
    numeric: true,
    value: (r) => r.distinct_responders,
  },
  { id: "reciprocity", label: "Recip.", full: "Reciprocity", align: "right", numeric: true, value: (r) => r.reciprocity },
  { id: "originality", label: "Orig.", full: "Originality", align: "right", numeric: true, value: (r) => r.originality },
  {
    id: "risk",
    label: "Risk",
    full: "Sybil risk band",
    align: "right",
    numeric: true,
    value: (r) => (r.risk ? r.risk.score : null),
  },
  {
    id: "movement",
    label: "Move",
    full: "Rank movement since last snapshot",
    align: "right",
    numeric: true,
    value: (r) => (r.movement && r.movement.rank_delta !== null ? r.movement.rank_delta : null),
  },
];

const COLUMN_IDS = new Set<string>(COLUMNS.map((c) => c.id));

const MEDALS: Record<number, { color: string; label: string }> = {
  1: { color: "var(--color-warn)", label: "1st" },
  2: { color: "var(--color-ink-dim)", label: "2nd" },
  3: { color: "#cd7f32", label: "3rd" },
};

const PAGE = 50; // rows rendered per step; the slice is 500 so we cap and grow

const FOCUS_RING =
  "outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-signal-dim)] focus-visible:ring-offset-1 focus-visible:ring-offset-[color:var(--color-panel)]";

function compareNullable(a: number | string | null, b: number | string | null): number {
  // nulls always sort last, whichever direction is active
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  if (typeof a === "string" && typeof b === "string") return a.localeCompare(b);
  return (a as number) - (b as number);
}

function RiskChip({
  row,
  expanded,
  onToggle,
  reasonsId,
}: {
  row: KeyRow;
  expanded: boolean;
  onToggle: () => void;
  reasonsId: string;
}) {
  if (!row.risk) {
    return <span className="text-[color:var(--color-ink-faint)]">—</span>;
  }
  const color = riskColor(row.risk.band);
  const reasons = row.risk.reasons ?? [];
  const hasReasons = reasons.length > 0;
  const title = hasReasons ? reasons.join("; ") : "No risk signals recorded for this key.";
  return (
    <button
      type="button"
      onClick={hasReasons ? onToggle : undefined}
      aria-expanded={hasReasons ? expanded : undefined}
      aria-controls={hasReasons ? reasonsId : undefined}
      title={title}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium capitalize transition-colors",
        hasReasons ? "cursor-pointer" : "cursor-default",
        FOCUS_RING,
      )}
      style={{ backgroundColor: `color-mix(in srgb, ${color} 15%, transparent)`, color }}
    >
      <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} aria-hidden />
      {row.risk.band}
      {hasReasons && (
        <span className="text-[10px] not-italic" aria-hidden>
          {expanded ? "▾" : "›"}
        </span>
      )}
    </button>
  );
}

function MovementCell({ row }: { row: KeyRow }) {
  const delta = row.movement?.rank_delta;
  if (!row.movement || delta === null || delta === undefined) {
    const first = row.movement?.first_report;
    return (
      <span
        className="text-[color:var(--color-ink-faint)]"
        title={first ? "First appearance in the tracked history" : "No prior snapshot to compare"}
      >
        —
      </span>
    );
  }
  if (delta === 0) {
    return (
      <span className="mono text-[color:var(--color-ink-dim)]" title="No change since the last snapshot">
        0
      </span>
    );
  }
  // negative delta = climbed toward rank 1
  const climbed = delta < 0;
  const color = climbed ? "var(--color-signal)" : "var(--color-flag)";
  return (
    <span
      className="mono inline-flex items-center gap-0.5"
      style={{ color }}
      title={`${climbed ? "Climbed" : "Fell"} ${Math.abs(delta)} ${Math.abs(delta) === 1 ? "place" : "places"} since the last snapshot`}
    >
      <span aria-hidden>{climbed ? "▲" : "▼"}</span>
      {Math.abs(delta)}
      <span className="sr-only">{climbed ? " up" : " down"}</span>
    </span>
  );
}

function KeyCell({ row }: { row: KeyRow }) {
  if (row.signed) {
    return <span className="mono text-[color:var(--color-signal)]">{shortDid(row.identity)}</span>;
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
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  // URL is the source of truth on first paint, so a shared link and a reload restore the view.
  const initialSort = (params.get("sort") ?? "") as SortId;
  const [queryInput, setQueryInput] = useState(() => params.get("q") ?? "");
  const [query, setQuery] = useState(() => params.get("q") ?? "");
  const [sortId, setSortId] = useState<SortId>(() =>
    COLUMN_IDS.has(initialSort) ? initialSort : "score",
  );
  const [dir, setDir] = useState<Dir>(() => (params.get("dir") === "asc" ? "asc" : "desc"));
  const [signedOnly, setSignedOnly] = useState(() => params.get("signed") === "1");
  const [cap, setCap] = useState(PAGE);
  const [expanded, setExpanded] = useState<string | null>(null);

  // Debounce the applied query so typing does not filter or rewrite the URL on every keystroke.
  useEffect(() => {
    const t = setTimeout(() => setQuery(queryInput), 220);
    return () => clearTimeout(t);
  }, [queryInput]);

  // Reflect state into the query string without adding history entries.
  useEffect(() => {
    const next = new URLSearchParams();
    if (query.trim()) next.set("q", query.trim());
    if (sortId !== "score") next.set("sort", sortId);
    if (dir !== "desc") next.set("dir", dir);
    if (signedOnly) next.set("signed", "1");
    const qs = next.toString();
    const current = params.toString();
    if (qs !== current) {
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    }
    // params is intentionally omitted: it is read once for the diff, not a trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, sortId, dir, signedOnly, pathname, router]);

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

  // Growing the window as the filter changes must not leave a stale cap behind.
  useEffect(() => {
    setCap(PAGE);
    setExpanded(null);
  }, [query, sortId, dir, signedOnly]);

  const windowed = useMemo(() => visible.slice(0, cap), [visible, cap]);
  const remaining = visible.length - windowed.length;

  // Auto-grow the window as the sentinel nears the viewport, so long scrolls stay smooth.
  const totalRef = useRef(0);
  totalRef.current = visible.length;
  const sentinelRef = useRef<HTMLTableRowElement | null>(null);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setCap((c) => (c < totalRef.current ? c + PAGE : c));
        }
      },
      { rootMargin: "600px 0px" },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const onSort = useCallback(
    (col: Column) => {
      setSortId((prevId) => {
        if (col.id === prevId) {
          setDir((d) => (d === "asc" ? "desc" : "asc"));
          return prevId;
        }
        setDir(col.numeric ? "desc" : "asc");
        return col.id;
      });
    },
    [],
  );

  const toggleExpanded = useCallback((id: string) => {
    setExpanded((cur) => (cur === id ? null : id));
  }, []);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[240px] flex-1">
          <input
            type="search"
            value={queryInput}
            onChange={(e) => setQueryInput(e.target.value)}
            placeholder="Filter by did:key substring"
            aria-label="Filter by did:key substring"
            className={cn(
              "w-full rounded-lg border border-[color:var(--color-line)] bg-[color:var(--color-panel)] px-3 py-2 text-sm text-[color:var(--color-ink)] placeholder:text-[color:var(--color-ink-faint)] transition-colors focus:border-[color:var(--color-signal-dim)]",
              FOCUS_RING,
            )}
          />
        </div>
        {hasNicknames && (
          <button
            type="button"
            onClick={() => setSignedOnly((s) => !s)}
            aria-pressed={signedOnly}
            className={cn(
              "rounded-lg border px-3 py-2 text-sm transition-colors",
              FOCUS_RING,
              signedOnly
                ? "border-[color:var(--color-signal-dim)] bg-[color:var(--color-signal)]/10 text-[color:var(--color-signal)]"
                : "border-[color:var(--color-line)] text-[color:var(--color-ink-dim)] hover:text-[color:var(--color-ink)]",
            )}
          >
            {signedOnly ? "Signed only" : "Include nicknames"}
          </button>
        )}
        <div className="text-sm text-[color:var(--color-ink-faint)]" aria-live="polite">
          {visible.length.toLocaleString("en-US")} shown
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <caption className="sr-only">
              Contribution index for technocore.chat, sortable by any column. A did:key
              signature is the only evidence of a reply and nicknames are listed but never
              ranked.
            </caption>
            <thead>
              <tr className="sticky top-14 z-20 bg-[color:var(--color-panel-2)] text-[color:var(--color-ink-faint)]">
                {COLUMNS.map((col) => {
                  const active = col.id === sortId;
                  return (
                    <th
                      key={col.id}
                      scope="col"
                      aria-sort={active ? (dir === "asc" ? "ascending" : "descending") : "none"}
                      className={cn(
                        "select-none whitespace-nowrap px-3 py-2.5 text-xs font-medium uppercase tracking-wider",
                        col.align === "right" ? "text-right" : "text-left",
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => onSort(col)}
                        title={`Sort by ${col.full}`}
                        aria-label={`Sort by ${col.full}${active ? (dir === "asc" ? ", ascending" : ", descending") : ""}`}
                        className={cn(
                          "inline-flex items-center gap-1 rounded transition-colors hover:text-[color:var(--color-ink)]",
                          FOCUS_RING,
                          active && "text-[color:var(--color-ink)]",
                          col.align === "right" && "flex-row-reverse",
                        )}
                      >
                        <span>{col.label}</span>
                        <span className="w-2 text-[10px]" aria-hidden>
                          {active ? (dir === "asc" ? "▲" : "▼") : ""}
                        </span>
                      </button>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {windowed.map((row) => {
                const medal = row.signed ? MEDALS[row.rank] : undefined;
                const barPct = Math.max(0, Math.min(100, (row.score / maxScore) * 100));
                const reasonsId = `risk-${encodeURIComponent(row.identity)}`;
                const isOpen = expanded === row.identity && !!row.risk?.reasons?.length;
                return (
                  <Fragment key={row.identity}>
                    <tr
                      className="group border-t border-[color:var(--color-line)] transition-colors hover:bg-[color:var(--color-panel-2)]/60 focus-within:bg-[color:var(--color-panel-2)]/60"
                    >
                      <td className="whitespace-nowrap px-3 py-2.5">
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
                          className={cn("rounded hover:underline underline-offset-4", FOCUS_RING)}
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
                          <span className="mono relative font-semibold text-[color:var(--color-ink)]">
                            {row.score.toLocaleString("en-US", { maximumFractionDigits: 2 })}
                          </span>
                        </div>
                      </td>
                      <td className="mono px-3 py-2.5 text-right text-[color:var(--color-ink-dim)]">
                        {compact(row.credit)}
                      </td>
                      <td className="mono px-3 py-2.5 text-right text-[color:var(--color-ink-dim)]">
                        {compact(row.messages)}
                      </td>
                      <td className="mono px-3 py-2.5 text-right text-[color:var(--color-ink-dim)]">
                        {row.rooms}
                      </td>
                      <td className="mono px-3 py-2.5 text-right text-[color:var(--color-ink-dim)]">
                        {compact(row.distinct_responders)}
                      </td>
                      <td className="mono px-3 py-2.5 text-right text-[color:var(--color-ink-dim)]">
                        {percent(row.reciprocity)}
                      </td>
                      <td className="mono px-3 py-2.5 text-right text-[color:var(--color-ink-dim)]">
                        {percent(row.originality)}
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <RiskChip
                          row={row}
                          expanded={isOpen}
                          onToggle={() => toggleExpanded(row.identity)}
                          reasonsId={reasonsId}
                        />
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <MovementCell row={row} />
                      </td>
                    </tr>
                    {isOpen && (
                      <tr className="bg-[color:var(--color-panel-2)]/40">
                        <td colSpan={COLUMNS.length} className="px-3 pb-3 pt-0">
                          <div
                            id={reasonsId}
                            className="rounded-lg border border-[color:var(--color-line)] bg-[color:var(--color-panel)] px-3 py-2"
                          >
                            <div className="mb-1 text-[11px] uppercase tracking-wider text-[color:var(--color-ink-faint)]">
                              Why this band ({row.risk?.band}, score{" "}
                              {row.risk ? row.risk.score.toFixed(3) : "—"})
                            </div>
                            <ul className="list-disc space-y-0.5 pl-4 text-xs text-[color:var(--color-ink-dim)]">
                              {(row.risk?.reasons ?? []).map((reason, i) => (
                                <li key={i}>{reason}</li>
                              ))}
                            </ul>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
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
              {remaining > 0 && (
                <tr ref={sentinelRef} aria-hidden>
                  <td colSpan={COLUMNS.length} className="px-3 py-3 text-center">
                    <button
                      type="button"
                      onClick={() => setCap((c) => c + PAGE)}
                      className={cn(
                        "rounded-lg border border-[color:var(--color-line)] px-4 py-2 text-sm text-[color:var(--color-ink-dim)] transition-colors hover:text-[color:var(--color-ink)]",
                        FOCUS_RING,
                      )}
                    >
                      Load {Math.min(PAGE, remaining)} more
                      <span className="ml-1 text-[color:var(--color-ink-faint)]">
                        ({remaining.toLocaleString("en-US")} left)
                      </span>
                    </button>
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
