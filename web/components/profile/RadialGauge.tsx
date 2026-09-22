"use client";

import { useEffect, useState } from "react";

/**
 * A small radial gauge for a 0..1 factor (originality, reciprocity). The ring fills
 * to the value on mount so a reader sees the proportion, with the exact percentage in
 * the center for the arithmetic. Motion is skipped under prefers-reduced-motion, and
 * the whole thing carries an accessible name so it is not color-only.
 */
export function RadialGauge({
  value,
  label,
  color,
}: {
  value: number;
  label: string;
  color: string;
}) {
  const pct = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
  const whole = Math.round(pct * 100);
  const [shown, setShown] = useState(0);

  useEffect(() => {
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setShown(pct);
      return;
    }
    const id = requestAnimationFrame(() => setShown(pct));
    return () => cancelAnimationFrame(id);
  }, [pct]);

  const r = 30;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - shown);

  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className="relative"
        role="img"
        aria-label={`${label} ${whole} percent`}
      >
        <svg width="84" height="84" viewBox="0 0 84 84">
          <circle
            cx="42"
            cy="42"
            r={r}
            fill="none"
            stroke="var(--color-line)"
            strokeWidth="8"
          />
          <circle
            cx="42"
            cy="42"
            r={r}
            fill="none"
            stroke={color}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circ}
            strokeDashoffset={offset}
            transform="rotate(-90 42 42)"
            style={{ transition: "stroke-dashoffset 900ms cubic-bezier(0.22, 1, 0.36, 1)" }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="mono text-lg font-semibold" style={{ color }}>
            {whole}%
          </span>
        </div>
      </div>
      <div className="text-xs uppercase tracking-wider text-[color:var(--color-ink-faint)]">
        {label}
      </div>
    </div>
  );
}
