"use client";

/*
 * Client charts for the radar. Two honest 100% stacked bars: the copied-vs-original
 * message split and the answered-vs-never-answered key split. Small slices stay small,
 * exact counts sit in the legend, and there is no 3D and no entrance animation.
 */
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  type TooltipProps,
} from "recharts";
import { compact, percent } from "@/lib/ui";

type Segment = { key: string; label: string; value: number; color: string };

function ShareTooltip({ active, payload }: TooltipProps<number, string>) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="card px-3 py-2 text-xs">
      {payload.map((p) => (
        <div key={p.dataKey as string} className="flex items-center gap-2">
          <span
            className="inline-block w-2 h-2 rounded-full"
            style={{ background: (p.color as string) }}
          />
          <span className="text-[color:var(--color-ink-dim)]">{p.name}</span>
          <span className="mono text-[color:var(--color-ink)]">
            {compact(Number(p.value))}
          </span>
        </div>
      ))}
    </div>
  );
}

function ShareBar({ title, note, segments }: { title: string; note: string; segments: Segment[] }) {
  const total = segments.reduce((s, seg) => s + seg.value, 0) || 1;
  const datum: Record<string, number | string> = { name: title };
  for (const seg of segments) datum[seg.key] = seg.value;

  return (
    <div className="flex flex-col gap-3">
      <div className="text-sm font-medium text-[color:var(--color-ink)]">{title}</div>
      <div className="h-14 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart layout="vertical" data={[datum]} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
            <XAxis type="number" domain={[0, total]} hide />
            <YAxis type="category" dataKey="name" hide />
            <Tooltip cursor={{ fill: "transparent" }} content={<ShareTooltip />} />
            {segments.map((seg, i) => (
              <Bar
                key={seg.key}
                dataKey={seg.key}
                name={seg.label}
                stackId="a"
                fill={seg.color}
                isAnimationActive={false}
                radius={i === 0 ? [4, 0, 0, 4] : i === segments.length - 1 ? [0, 4, 4, 0] : 0}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs">
        {segments.map((seg) => (
          <div key={seg.key} className="flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full" style={{ background: seg.color }} />
            <span className="text-[color:var(--color-ink-dim)]">{seg.label}</span>
            <span className="mono text-[color:var(--color-ink)]">{compact(seg.value)}</span>
            <span className="mono text-[color:var(--color-ink-faint)]">{percent(seg.value / total)}</span>
          </div>
        ))}
      </div>
      <p className="text-xs text-[color:var(--color-ink-faint)] leading-relaxed">{note}</p>
    </div>
  );
}

export function RadarCharts({
  copiedMessages,
  originalMessages,
  neverAnswered,
  answeredAtLeastOnce,
}: {
  copiedMessages: number;
  originalMessages: number;
  neverAnswered: number;
  answeredAtLeastOnce: number;
}) {
  return (
    <div className="grid gap-8 md:grid-cols-2">
      <ShareBar
        title="Messages in window"
        note="Copied messages repeat a string another key already sent. A high copied share inflates volume without adding conversation."
        segments={[
          { key: "original", label: "Distinct", value: originalMessages, color: "var(--color-signal)" },
          { key: "copied", label: "Copied", value: copiedMessages, color: "var(--color-warn)" },
        ]}
      />
      <ShareBar
        title="Scored keys, by reply"
        note="Never-answered keys are those no other signed key replied to in the window. A reply from a self-asserted nickname does not count, because anyone can type any nickname."
        segments={[
          { key: "answered", label: "Answered by a signed key", value: answeredAtLeastOnce, color: "var(--color-signal)" },
          { key: "never", label: "Never answered", value: neverAnswered, color: "var(--color-flag)" },
        ]}
      />
    </div>
  );
}
