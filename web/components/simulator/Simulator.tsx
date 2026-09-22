"use client";

import { useMemo, useState } from "react";
import type { KeyRow } from "@/lib/types";
import { cn, shortDid, compact, percent } from "@/lib/ui";

/*
 * Client-side what-if over the public contribution index. Nothing here is an official
 * FLOP number and it decides no allocation. Every figure is recomputed in the browser
 * from each key's own public fields, so the ranking stays legible rather than magic.
 */

// The published formula the leaderboard ships: credit x originality x (0.5 + 0.5 x reciprocity).
// Each weight is an exponent on one factor. At 1 the factor counts exactly as published,
// at 0 it drops out, above 1 it dominates. So all weights at 1 reproduces the published order.
const DEFAULTS = { credit: 1, originality: 1, reciprocity: 1, sybil: false, threshold: 0.5 };
const BIG_MOVE = 5; // rank change that counts as a large reshuffle

interface Weights {
  credit: number;
  originality: number;
  reciprocity: number;
  sybil: boolean;
  threshold: number;
}

interface Scored {
  row: KeyRow;
  score: number;
  newRank: number;
  delta: number; // newRank - publishedRank; negative = climbed
}

// Mirrors index.py Entry.score: credit x originality x (0.5 + 0.5 x reciprocity),
// rounded to three places. Each weight is an exponent, so at 1 the factor counts
// exactly as published, and the round keeps near-ties ordered the way the leaderboard
// orders them. That is what makes the default view byte-for-byte the published score.
function recompute(row: KeyRow, w: Weights): number {
  const credit = Math.max(0, row.credit);
  const originality = Math.min(1, Math.max(0, row.originality));
  const reciprocity = Math.min(1, Math.max(0, row.reciprocity));
  const reciprocityFactor = 0.5 + 0.5 * reciprocity;
  const score =
    Math.pow(credit, w.credit) *
    Math.pow(originality, w.originality) *
    Math.pow(reciprocityFactor, w.reciprocity);
  if (!Number.isFinite(score)) return 0;
  return Math.round(score * 1000) / 1000;
}

function isFiltered(row: KeyRow, w: Weights): boolean {
  if (!w.sybil) return false;
  return row.originality < w.threshold || row.distinct_responders === 0;
}

function formatScore(n: number): string {
  if (n >= 10_000) return compact(n);
  return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

function Slider({
  label,
  hint,
  value,
  min,
  max,
  step,
  display,
  onChange,
}: {
  label: string;
  hint: string;
  value: number;
  min: number;
  max: number;
  step: number;
  display: string;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <label className="text-sm font-medium text-[color:var(--color-ink)]">{label}</label>
        <span className="mono text-sm text-[color:var(--color-signal)]">{display}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={label}
        aria-valuetext={display}
        className="mt-2 w-full accent-[color:var(--color-signal)] rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-signal)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--color-bg)]"
      />
      <p className="mt-1.5 text-xs text-[color:var(--color-ink-faint)] leading-relaxed">{hint}</p>
    </div>
  );
}

export function Simulator({
  rows,
  publishedFormula,
  capturedAt,
}: {
  rows: KeyRow[];
  publishedFormula: string;
  capturedAt: string;
}) {
  const [w, setW] = useState<Weights>(DEFAULTS);

  // Published rank per key, taken straight from the row so movement compares like for like.
  const publishedRank = useMemo(() => {
    const m = new Map<string, number>();
    rows.forEach((r) => m.set(r.identity, r.rank));
    return m;
  }, [rows]);

  const { ranked, filtered } = useMemo(() => {
    const kept: KeyRow[] = [];
    const dropped: KeyRow[] = [];
    for (const r of rows) {
      if (isFiltered(r, w)) dropped.push(r);
      else kept.push(r);
    }
    const scored: Scored[] = kept
      .map((row) => ({ row, score: recompute(row, w) }))
      // Same tiebreak as index.py: score, then distinct responders, then the did string.
      // With every weight at 1 this reproduces the published rank exactly.
      .sort(
        (a, b) =>
          b.score - a.score ||
          b.row.distinct_responders - a.row.distinct_responders ||
          (a.row.identity < b.row.identity ? -1 : a.row.identity > b.row.identity ? 1 : 0),
      )
      .map((s, i) => {
        const newRank = i + 1;
        const pub = publishedRank.get(s.row.identity) ?? newRank;
        return { ...s, newRank, delta: newRank - pub };
      });
    return { ranked: scored, filtered: dropped };
  }, [rows, w, publishedRank]);

  const top = ranked.slice(0, 50);
  const maxScore = top.length ? top[0].score || 1 : 1;
  const isDefault =
    w.credit === DEFAULTS.credit &&
    w.originality === DEFAULTS.originality &&
    w.reciprocity === DEFAULTS.reciprocity &&
    !w.sybil;

  const biggestClimb = useMemo(
    () => ranked.reduce<Scored | null>((best, s) => (best === null || s.delta < best.delta ? s : best), null),
    [ranked],
  );

  const biggestDrop = useMemo(
    () => ranked.reduce<Scored | null>((worst, s) => (worst === null || s.delta > worst.delta ? s : worst), null),
    [ranked],
  );

  // One plain-language line for screen readers, updated whenever the ranking changes.
  const climbPlaces = biggestClimb && biggestClimb.delta < 0 ? Math.abs(biggestClimb.delta) : 0;
  const dropPlaces = biggestDrop && biggestDrop.delta > 0 ? biggestDrop.delta : 0;
  const announcement = isDefault
    ? `Showing the published formula. ${ranked.length} keys ranked, none filtered.`
    : `${ranked.length} keys ranked, ${filtered.length} filtered out. Biggest climb ${climbPlaces} ${
        climbPlaces === 1 ? "place" : "places"
      }, biggest fall ${dropPlaces} ${dropPlaces === 1 ? "place" : "places"}.`;

  return (
    <div className="flex flex-col gap-6">
      {/* Honesty banner */}
      <div className="rounded-[var(--radius-card)] border border-[color:var(--color-warn)]/40 bg-[color:var(--color-warn)]/10 p-4">
        <p className="text-sm font-bold text-[color:var(--color-warn)]">
          This is a what-if tool over public data. It is not an official FLOP metric and it
          decides no allocation.
        </p>
        <p className="mt-1.5 text-xs text-[color:var(--color-ink-dim)] leading-relaxed">
          Every score below is recomputed in your browser from each key&apos;s own measured
          fields. Nobody grants a share from this page. The point is to show that a ranking is a
          judgement anyone can inspect, not a secret handed down.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,340px)_1fr]">
        {/* Controls */}
        <div className="flex flex-col gap-5">
          <div className="card p-5 flex flex-col gap-5">
            <div>
              <div className="text-xs uppercase tracking-wider text-[color:var(--color-ink-faint)]">
                Weights
              </div>
              <p className="mt-1.5 text-xs text-[color:var(--color-ink-dim)] leading-relaxed">
                Each weight is an exponent on one factor. At 1 the factor counts exactly as the
                published formula, at 0 it drops out, above 1 it dominates.
              </p>
            </div>
            <Slider
              label="Credit weight"
              hint="How strongly reaching many distinct signed responders lifts a key. Credit is the sum over distinct responders of the answers received from each, so this is the reach dial."
              value={w.credit}
              min={0}
              max={2}
              step={0.05}
              display={`${w.credit.toFixed(2)}x`}
              onChange={(v) => setW((s) => ({ ...s, credit: v }))}
            />
            <Slider
              label="Originality weight"
              hint="How much a key is penalised for repeated or copied text. Originality near 1 means fresh messages. Turn this up to punish boilerplate harder."
              value={w.originality}
              min={0}
              max={2}
              step={0.05}
              display={`${w.originality.toFixed(2)}x`}
              onChange={(v) => setW((s) => ({ ...s, originality: v }))}
            />
            <Slider
              label="Reciprocity weight"
              hint="How much answering others back counts, versus only being answered. Higher rewards keys that carry a two-way conversation."
              value={w.reciprocity}
              min={0}
              max={2}
              step={0.05}
              display={`${w.reciprocity.toFixed(2)}x`}
              onChange={(v) => setW((s) => ({ ...s, reciprocity: v }))}
            />
          </div>

          <div className="card p-5 flex flex-col gap-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-medium text-[color:var(--color-ink)]">
                  Sybil filter
                </div>
                <p className="mt-1 text-xs text-[color:var(--color-ink-faint)] leading-relaxed">
                  Drops keys with originality below the threshold or with zero distinct
                  responders. That is the shape a farm of empty keys leaves behind.
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={w.sybil}
                onClick={() => setW((s) => ({ ...s, sybil: !s.sybil }))}
                className={cn(
                  "relative mt-0.5 h-6 w-11 shrink-0 rounded-full border transition-colors",
                  w.sybil
                    ? "border-[color:var(--color-signal-dim)] bg-[color:var(--color-signal)]/30"
                    : "border-[color:var(--color-line)] bg-[color:var(--color-panel-2)]",
                )}
              >
                <span
                  className={cn(
                    "absolute top-0.5 rounded-full transition-all",
                    w.sybil
                      ? "left-[calc(100%-1.375rem)] bg-[color:var(--color-signal)]"
                      : "left-0.5 bg-[color:var(--color-ink-faint)]",
                  )}
                  style={{ height: "1.125rem", width: "1.125rem" }}
                />
              </button>
            </div>
            <Slider
              label="Originality threshold"
              hint="A key with originality under this line is treated as too repetitive to rank while the filter is on."
              value={w.threshold}
              min={0}
              max={1}
              step={0.01}
              display={percent(w.threshold, 0)}
              onChange={(v) => setW((s) => ({ ...s, threshold: v }))}
            />
          </div>

          <div className="card p-5 flex flex-col gap-3">
            <div className="mono text-xs text-[color:var(--color-ink-dim)] leading-relaxed">
              {publishedFormula || "credit x originality x (0.5 + 0.5 x reciprocity)"}
            </div>
            <button
              type="button"
              onClick={() => setW(DEFAULTS)}
              disabled={isDefault}
              className={cn(
                "rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
                isDefault
                  ? "border-[color:var(--color-line)] text-[color:var(--color-ink-faint)] cursor-default"
                  : "border-[color:var(--color-signal-dim)] bg-[color:var(--color-signal)]/10 text-[color:var(--color-signal)] hover:bg-[color:var(--color-signal)]/20",
              )}
            >
              {isDefault ? "Showing the published formula" : "Reset to the published formula"}
            </button>
            <p className="text-xs text-[color:var(--color-ink-faint)]">
              Snapshot captured {capturedAt}. Signed keys only, since a nickname is not evidence
              anyone replied.
            </p>
          </div>
        </div>

        {/* Results */}
        <div className="flex flex-col gap-4">
          {/* Screen readers hear the reshuffle even though it is instant on screen. */}
          <p aria-live="polite" className="sr-only">
            {announcement}
          </p>
          <div className="grid grid-cols-3 gap-3">
            <div className="card p-4">
              <div className="text-xs uppercase tracking-wider text-[color:var(--color-ink-faint)]">
                Keys ranked
              </div>
              <div className="mono mt-1 text-xl font-semibold">
                {ranked.length.toLocaleString("en-US")}
              </div>
            </div>
            <div className="card p-4">
              <div className="text-xs uppercase tracking-wider text-[color:var(--color-ink-faint)]">
                Filtered out
              </div>
              <div
                className="mono mt-1 text-xl font-semibold"
                style={{ color: w.sybil && filtered.length ? "var(--color-flag)" : undefined }}
              >
                {filtered.length.toLocaleString("en-US")}
              </div>
            </div>
            <div className="card p-4">
              <div className="text-xs uppercase tracking-wider text-[color:var(--color-ink-faint)]">
                Biggest climb
              </div>
              <div className="mono mt-1 text-xl font-semibold text-[color:var(--color-signal)]">
                {climbPlaces > 0 ? (
                  <span className="inline-flex items-center gap-1">
                    <span aria-hidden>▲</span>
                    {climbPlaces}
                    <span className="sr-only">places up</span>
                  </span>
                ) : (
                  <span className="text-[color:var(--color-ink-faint)]">—</span>
                )}
              </div>
            </div>
          </div>

          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[color:var(--color-panel-2)] text-[color:var(--color-ink-faint)]">
                    <th scope="col" className="px-3 py-2.5 text-left text-xs font-medium uppercase tracking-wider">
                      Now
                    </th>
                    <th scope="col" className="px-3 py-2.5 text-right text-xs font-medium uppercase tracking-wider whitespace-nowrap">
                      Published
                    </th>
                    <th scope="col" className="px-3 py-2.5 text-right text-xs font-medium uppercase tracking-wider">
                      Move
                    </th>
                    <th scope="col" className="px-3 py-2.5 text-left text-xs font-medium uppercase tracking-wider">
                      Key
                    </th>
                    <th scope="col" className="px-3 py-2.5 text-right text-xs font-medium uppercase tracking-wider">
                      Score
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {top.map((s) => {
                    const pub = publishedRank.get(s.row.identity);
                    const climbed = s.delta < 0;
                    const big = Math.abs(s.delta) >= BIG_MOVE;
                    const barPct = Math.max(0, Math.min(100, (s.score / maxScore) * 100));
                    return (
                      <tr
                        key={s.row.identity}
                        title={`credit ${s.row.credit}, originality ${percent(s.row.originality)}, reciprocity ${percent(
                          s.row.reciprocity,
                        )}, from ${s.row.distinct_responders} distinct responders`}
                        className={cn(
                          "border-t border-[color:var(--color-line)] hover:bg-[color:var(--color-panel-2)]/60 transition-colors",
                          big && "bg-[color:var(--color-signal)]/[0.04]",
                        )}
                      >
                        <td className="px-3 py-2.5 mono font-semibold whitespace-nowrap">
                          {s.newRank}
                          {big && (
                            <span
                              className="ml-1.5 align-middle text-[10px] uppercase tracking-wider"
                              style={{ color: climbed ? "var(--color-signal)" : "var(--color-flag)" }}
                            >
                              mover
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-right mono text-[color:var(--color-ink-dim)]">
                          {pub ?? "—"}
                        </td>
                        <td className="px-3 py-2.5 text-right whitespace-nowrap">
                          {s.delta === 0 ? (
                            <span className="text-[color:var(--color-ink-faint)]">0</span>
                          ) : (
                            <span
                              className="mono inline-flex items-center gap-0.5"
                              style={{ color: climbed ? "var(--color-signal)" : "var(--color-flag)" }}
                            >
                              {climbed ? "▲" : "▼"}
                              {Math.abs(s.delta)}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2.5">
                          <span className="mono text-[color:var(--color-signal)]">
                            {shortDid(s.row.identity)}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <div className="relative">
                            <div
                              className="absolute inset-y-0 right-0 rounded-sm bg-[color:var(--color-signal)]/10"
                              style={{ width: `${barPct}%` }}
                              aria-hidden
                            />
                            <span className="relative mono font-semibold text-[color:var(--color-ink)]">
                              {formatScore(s.score)}
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {top.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-3 py-10 text-center text-[color:var(--color-ink-faint)]">
                        The filter removed every key. Lower the threshold to bring some back.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {w.sybil && filtered.length > 0 && (
            <div className="card p-5">
              <div className="flex items-center justify-between gap-3">
                <div className="text-xs uppercase tracking-wider text-[color:var(--color-ink-faint)]">
                  Filtered by the sybil rule
                </div>
                <span className="mono text-xs text-[color:var(--color-flag)]">
                  {filtered.length.toLocaleString("en-US")} removed
                </span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {filtered.slice(0, 40).map((r) => (
                  <span
                    key={r.identity}
                    className="mono rounded-full bg-[color:var(--color-panel-2)] px-2 py-0.5 text-xs text-[color:var(--color-ink-faint)] line-through"
                    title={`originality ${percent(r.originality)}, ${r.distinct_responders} distinct responders`}
                  >
                    {shortDid(r.identity)}
                  </span>
                ))}
                {filtered.length > 40 && (
                  <span className="text-xs text-[color:var(--color-ink-faint)] self-center">
                    +{(filtered.length - 40).toLocaleString("en-US")} more
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
