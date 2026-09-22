"use client";

import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { HistoryPoint } from "@/lib/types";
import { compact } from "@/lib/ui";

type NumericField = {
  [K in keyof HistoryPoint]: HistoryPoint[K] extends number ? K : never;
}[keyof HistoryPoint];

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

  // One snapshot so far: a two-point line is a lie, so show the value plainly.
  if (series.length <= 1) {
    return (
      <div className="flex h-full flex-col justify-between gap-4">
        <div className="text-xs uppercase tracking-wider text-[color:var(--color-ink-faint)]">{label}</div>
        <div>
          <div className="mono text-4xl font-semibold text-[color:var(--color-signal)]">
            {latest ? compact(latest.value) : "0"}
          </div>
          <div className="mt-1 text-xs text-[color:var(--color-ink-dim)]">
            {latest ? `one snapshot so far, ${latest.date}. a trend needs a second capture` : "no snapshot yet"}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-2">
      <div className="flex items-baseline justify-between">
        <div className="text-xs uppercase tracking-wider text-[color:var(--color-ink-faint)]">{label}</div>
        {latest && <div className="mono text-sm text-[color:var(--color-signal)]">{compact(latest.value)}</div>}
      </div>
      <div className="h-24 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={series} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--color-signal)" stopOpacity={0.45} />
                <stop offset="100%" stopColor="var(--color-signal)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="date" hide />
            <YAxis hide domain={["dataMin", "dataMax"]} />
            <Tooltip
              cursor={{ stroke: "var(--color-line)" }}
              contentStyle={{
                background: "var(--color-panel-2)",
                border: "1px solid var(--color-line)",
                borderRadius: 8,
                fontSize: 12,
              }}
              labelStyle={{ color: "var(--color-ink-dim)" }}
              itemStyle={{ color: "var(--color-signal)" }}
              formatter={(v: number) => [compact(v), label]}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke="var(--color-signal)"
              strokeWidth={2}
              fill="url(#sparkFill)"
              dot={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
