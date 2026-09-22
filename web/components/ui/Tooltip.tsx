"use client";

import { useId, useState } from "react";
import { cn } from "@/lib/ui";

/**
 * A small accessible tooltip. Shows on hover and on keyboard focus, dismisses
 * on Escape, and links the trigger to the bubble with aria-describedby so a
 * screen reader announces it. The trigger stays a real focusable element, so
 * wrap an interactive child or pass one that can hold a tabIndex.
 */
export function Tooltip({
  content,
  children,
  side = "top",
  className,
}: {
  content: React.ReactNode;
  children: React.ReactNode;
  side?: "top" | "bottom";
  className?: string;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);

  return (
    <span
      className={cn("relative inline-flex", className)}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
      onKeyDown={(e) => {
        if (e.key === "Escape") setOpen(false);
      }}
    >
      <span aria-describedby={open ? id : undefined} tabIndex={0} className="focus-ring rounded">
        {children}
      </span>
      <span
        role="tooltip"
        id={id}
        hidden={!open}
        className={cn(
          "pointer-events-none absolute left-1/2 z-50 w-max max-w-xs -translate-x-1/2 rounded-md border border-[color:var(--color-line)] bg-[color:var(--color-panel-2)] px-2.5 py-1.5 text-xs text-[color:var(--color-ink)] shadow-[var(--shadow-2)]",
          side === "top" ? "bottom-full mb-2" : "top-full mt-2",
        )}
      >
        {content}
      </span>
    </span>
  );
}
