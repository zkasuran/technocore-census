/*
 * The risk-band summary. A scoring lane may attach radar.risk with clear/watch/flag
 * counts, a flagged share and a one-line method. When it is present this renders a
 * stacked bar and three tiles; when it is absent the snapshot simply has no scoring yet,
 * so we say that plainly rather than inventing bands.
 */
import { Card } from "@/components/primitives";
import { compact, percent } from "@/lib/ui";
import type { RadarRisk } from "./model";

const BANDS = [
  { key: "clear" as const, label: "Clear", color: "var(--color-signal)" },
  { key: "watch" as const, label: "Watch", color: "var(--color-warn)" },
  { key: "flag" as const, label: "Flag", color: "var(--color-flag)" },
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

  return (
    <div className="flex flex-col gap-5">
      <div className="flex h-4 w-full overflow-hidden rounded-full border border-[color:var(--color-line)]">
        {counts.map((c) => (
          <div
            key={c.key}
            style={{ width: `${(c.value / total) * 100}%`, background: c.color }}
            title={`${c.label}: ${compact(c.value)}`}
          />
        ))}
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {counts.map((c) => (
          <Card key={c.key} className="flex flex-col gap-1">
            <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-[color:var(--color-ink-faint)]">
              <span className="inline-block w-2 h-2 rounded-full" style={{ background: c.color }} />
              {c.label}
            </div>
            <div className="mono text-2xl font-semibold" style={{ color: c.color }}>
              {compact(c.value)}
            </div>
            <div className="text-xs text-[color:var(--color-ink-dim)]">{percent(c.value / total)} of scored keys</div>
          </Card>
        ))}
      </div>
      <div className="flex flex-wrap items-baseline gap-x-3 text-sm text-[color:var(--color-ink-dim)]">
        {risk.flagged_share !== undefined && (
          <span>
            Flagged share{" "}
            <span className="mono text-[color:var(--color-flag)]">{percent(risk.flagged_share)}</span>
          </span>
        )}
        {risk.method && <span className="text-[color:var(--color-ink-faint)]">{risk.method}</span>}
      </div>
    </div>
  );
}
