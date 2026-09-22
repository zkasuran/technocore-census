/*
 * The risk-band summary, from the real radar.risk block. Every scored key gets a 0..1
 * score from five public signals, and the band is a published cut of that score: clear
 * below 0.34, watch to 0.67, flag at or above. This renders the three counts, a proportion
 * bar and the method sentence. When risk is absent the snapshot simply has no scoring yet,
 * so we say that plainly rather than invent bands.
 */
import { Card } from "@/components/primitives";
import { compact, percent } from "@/lib/ui";
import type { RadarRisk } from "./model";

const BANDS = [
  { key: "clear" as const, label: "Clear", color: "var(--color-signal)", cut: "score below 0.34" },
  { key: "watch" as const, label: "Watch", color: "var(--color-warn)", cut: "0.34 to 0.67" },
  { key: "flag" as const, label: "Flag", color: "var(--color-flag)", cut: "0.67 or higher" },
];

export function RiskBands({ risk }: { risk?: RadarRisk }) {
  if (!risk || !risk.bands) {
    return (
      <Card className="text-sm text-[color:var(--color-ink-faint)]">
        Risk scoring is not in this snapshot. When a scoring pass runs it splits scored keys
        into clear, watch and flag bands and reports the flagged share here.
      </Card>
    );
  }

  const bands = risk.bands;
  const counts = BANDS.map((b) => ({ ...b, value: bands[b.key] ?? 0 }));
  const total = counts.reduce((s, c) => s + c.value, 0) || 1;
  const scored = risk.scored ?? total;
  const flagZero = (bands.flag ?? 0) === 0;

  return (
    <div className="flex flex-col gap-5">
      <p className="text-sm text-[color:var(--color-ink-dim)]">
        <span className="mono text-[color:var(--color-ink)]">{compact(scored)}</span> keys scored. Each band is a
        published cut of the 0..1 score, so a key on a boundary knows which way it falls.
      </p>

      <div className="grid gap-4 sm:grid-cols-3">
        {counts.map((c) => (
          <Card key={c.key} className="flex flex-col gap-1">
            <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-[color:var(--color-ink-faint)]">
              <span aria-hidden className="inline-block w-2 h-2 rounded-full" style={{ background: c.color }} />
              {c.label}
              <span className="ml-auto normal-case tracking-normal text-[color:var(--color-ink-faint)]">{c.cut}</span>
            </div>
            <div className="mono text-2xl font-semibold" style={{ color: c.color }}>
              {compact(c.value)}
            </div>
            <div className="text-xs text-[color:var(--color-ink-dim)]">{percent(c.value / total)} of scored keys</div>
          </Card>
        ))}
      </div>

      <figure className="flex flex-col gap-2">
        <div
          className="flex h-4 w-full overflow-hidden rounded-full border border-[color:var(--color-line)]"
          role="img"
          aria-label={counts.map((c) => `${c.label} ${compact(c.value)}`).join(", ")}
        >
          {counts.map((c) => (
            <div key={c.key} style={{ width: `${(c.value / total) * 100}%`, background: c.color }} />
          ))}
        </div>
        <figcaption className="text-xs text-[color:var(--color-ink-faint)]">
          Proportion of scored keys in each band. The tiles above carry the exact counts.
        </figcaption>
      </figure>

      <div className="flex flex-wrap items-baseline gap-x-3 text-sm text-[color:var(--color-ink-dim)]">
        {risk.flagged_share !== undefined && (
          <span>
            Flagged share{" "}
            <span className="mono text-[color:var(--color-flag)]">{percent(risk.flagged_share)}</span>
          </span>
        )}
      </div>

      {flagZero && (
        <p className="rounded-lg border border-[color:var(--color-line)] bg-[color:var(--color-panel-2)]/40 px-4 py-3 text-xs text-[color:var(--color-ink-dim)] leading-relaxed">
          Flag is 0 in this snapshot. No key crossed 0.67, so no single public record scored
          sybil-like enough to name on its own. That is a real reading of the data, not a gap
          in the scoring. The signal here is the population shape above, not any one key.
        </p>
      )}

      {risk.method && (
        <p className="text-xs text-[color:var(--color-ink-faint)] leading-relaxed">{risk.method}</p>
      )}
    </div>
  );
}
