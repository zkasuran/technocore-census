import type { HistoryPoint } from "@/lib/types";
import { compact } from "@/lib/ui";
import { Sparkline as Spark } from "@/components/ui/Sparkline";

type NumericField = {
  [K in keyof HistoryPoint]: HistoryPoint[K] extends number ? K : never;
}[keyof HistoryPoint];

/**
 * A history sparkline for one numeric field. With a single capture on record a
 * line would draw a slope out of one reading, so it degrades to the value plus
 * a plain note. Two or more points draw a real trend through the shared SVG
 * spark, which ships no charting library.
 */
export function Sparkline({
  points,
  field = "scored",
  label,
}: {
  points: HistoryPoint[];
  field?: NumericField;
  label: string;
}) {
  const series = points.map((p) => ({ date: p.date, value: p[field] as number }));
  const latest = series.length ? series[series.length - 1] : null;

  if (series.length <= 1) {
    return (
      <div className="flex h-full flex-col justify-between gap-4">
        <div className="text-xs uppercase tracking-wider text-[color:var(--color-ink-faint)]">
          {label}
        </div>
        <div>
          <div className="mono tnum text-4xl font-semibold text-[color:var(--color-signal)]">
            {latest ? compact(latest.value) : "0"}
          </div>
          <div className="mt-1 text-xs text-[color:var(--color-ink-dim)]">
            {latest
              ? `one snapshot so far, ${latest.date}. a trend needs a second capture`
              : "no snapshot yet"}
          </div>
        </div>
      </div>
    );
  }

  const first = series[0];
  const delta = latest && first ? latest.value - first.value : 0;

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex items-baseline justify-between">
        <div className="text-xs uppercase tracking-wider text-[color:var(--color-ink-faint)]">
          {label}
        </div>
        {latest && (
          <div className="mono tnum text-sm text-[color:var(--color-signal)]">
            {compact(latest.value)}
          </div>
        )}
      </div>
      <Spark
        values={series.map((s) => s.value)}
        height={72}
        ariaLabel={`${label}, ${series.length} captures`}
      />
      <div className="text-xs text-[color:var(--color-ink-dim)]">
        {series.length} captures, {first.date} to {latest?.date}
        {delta !== 0 && (
          <span className="mono tnum" style={{ color: delta > 0 ? "var(--color-signal)" : "var(--color-warn)" }}>
            {" "}
            {delta > 0 ? "+" : ""}
            {compact(delta)}
          </span>
        )}
      </div>
    </div>
  );
}
