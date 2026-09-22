"use client";

import { useEffect, useRef, useState } from "react";
import { usePrefersReducedMotion } from "@/components/ui/motion";

/**
 * Counts a number up from zero to its value the first time it enters view.
 * `format` turns the running value into the string shown, so the caller keeps
 * control of compact notation, percentages or fixed decimals. A reduced-motion
 * reader sees the final value immediately with no tween.
 */
export function CountUp({
  value,
  format = (n) => `${Math.round(n)}`,
  durationMs = 900,
  className,
}: {
  value: number;
  format?: (n: number) => string;
  durationMs?: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [display, setDisplay] = useState(() => format(0));
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    if (reduced) {
      setDisplay(format(value));
      return;
    }
    const el = ref.current;
    if (!el) return;

    let raf = 0;
    let start = 0;
    const run = (t: number) => {
      if (!start) start = t;
      const p = Math.min(1, (t - start) / durationMs);
      // easeOutCubic, matching the design-system --ease-out feel.
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(format(value * eased));
      if (p < 1) raf = requestAnimationFrame(run);
      else setDisplay(format(value));
    };

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            raf = requestAnimationFrame(run);
            io.disconnect();
          }
        }
      },
      { threshold: 0.2 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    };
    // format is intentionally not a dep: callers pass an inline closure.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, durationMs, reduced]);

  return (
    <span ref={ref} className={className}>
      {display}
    </span>
  );
}
