import { cn } from "@/lib/ui";

/**
 * A pure-SVG sparkline. No charting library and no client boundary, so it
 * renders on the server, ships almost no bytes and never shifts layout. Pass a
 * flat list of numbers. One point or fewer degrades to a flat baseline that the
 * caller can label, because a two-point trend drawn from one reading is a lie.
 */
export function Sparkline({
  values,
  width = 240,
  height = 48,
  stroke = "var(--color-signal)",
  fill = true,
  className,
  ariaLabel,
}: {
  values: number[];
  width?: number;
  height?: number;
  stroke?: string;
  fill?: boolean;
  className?: string;
  ariaLabel?: string;
}) {
  const pad = 2;
  const w = width - pad * 2;
  const h = height - pad * 2;

  const min = values.length ? Math.min(...values) : 0;
  const max = values.length ? Math.max(...values) : 0;
  const span = max - min || 1;

  const points =
    values.length <= 1
      ? [
          [pad, height / 2],
          [width - pad, height / 2],
        ]
      : values.map((v, i) => {
          const x = pad + (i / (values.length - 1)) * w;
          const y = pad + (1 - (v - min) / span) * h;
          return [x, y] as [number, number];
        });

  const line = points.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(" ");
  const area = `${pad},${height - pad} ${line} ${width - pad},${height - pad}`;
  const gid = `spark-${Math.round(width)}-${Math.round(height)}`;
  const last = points[points.length - 1];

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      height={height}
      preserveAspectRatio="none"
      role="img"
      aria-label={ariaLabel ?? "sparkline"}
      className={cn("overflow-visible", className)}
    >
      {fill && values.length > 1 && (
        <>
          <defs>
            <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={stroke} stopOpacity={0.35} />
              <stop offset="100%" stopColor={stroke} stopOpacity={0} />
            </linearGradient>
          </defs>
          <polygon points={area} fill={`url(#${gid})`} />
        </>
      )}
      <polyline
        points={line}
        fill="none"
        stroke={stroke}
        strokeWidth={1.75}
        strokeLinejoin="round"
        strokeLinecap="round"
        strokeDasharray={values.length <= 1 ? "3 3" : undefined}
        opacity={values.length <= 1 ? 0.5 : 1}
      />
      {values.length > 1 && <circle cx={last[0]} cy={last[1]} r={2.5} fill={stroke} />}
    </svg>
  );
}
