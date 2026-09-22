"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/ui";

/** True once the user has asked the OS for reduced motion. SSR-safe: starts false. */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const on = () => setReduced(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return reduced;
}

/**
 * Reveals its children with a short fade and rise the first time they scroll
 * into view. Renders the final state on the server so there is no layout shift
 * and no flash of empty space before hydration. A reduced-motion reader gets
 * the content with no animation at all.
 */
export function Reveal({
  children,
  delay = 0,
  className,
  as: Tag = "div",
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
  as?: React.ElementType;
}) {
  const ref = useRef<HTMLElement>(null);
  const [shown, setShown] = useState(false);
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    if (reduced) {
      setShown(true);
      return;
    }
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setShown(true);
            io.disconnect();
          }
        }
      },
      { rootMargin: "0px 0px -10% 0px", threshold: 0.05 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [reduced]);

  return (
    <Tag
      ref={ref}
      className={cn(className, shown && !reduced && "reveal")}
      style={shown && !reduced ? { animationDelay: `${delay}ms` } : undefined}
    >
      {children}
    </Tag>
  );
}
