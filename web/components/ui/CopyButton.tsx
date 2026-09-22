"use client";

import { useCallback, useRef, useState } from "react";
import { cn } from "@/lib/ui";

/**
 * Copies a string to the clipboard and confirms it for a moment. Uses the async
 * Clipboard API where it exists and falls back to a hidden textarea plus
 * execCommand so it still works on http origins and older engines. Fully
 * keyboard operable with an accessible label that reflects state.
 */
export function CopyButton({
  value,
  label = "Copy",
  className,
}: {
  value: string;
  label?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const copy = useCallback(async () => {
    let ok = false;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
        ok = true;
      }
    } catch {
      ok = false;
    }
    if (!ok) {
      const ta = document.createElement("textarea");
      ta.value = value;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      try {
        ok = document.execCommand("copy");
      } catch {
        ok = false;
      }
      document.body.removeChild(ta);
    }
    if (ok) {
      setCopied(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 1400);
    }
  }, [value]);

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={copied ? "Copied" : label}
      className={cn(
        "focus-ring inline-flex items-center gap-1.5 rounded-md border border-[color:var(--color-line)] bg-[color:var(--color-panel-2)] px-2.5 py-1 text-xs font-medium text-[color:var(--color-ink-dim)] transition-colors hover:text-[color:var(--color-ink)] hover:border-[color:var(--color-signal)]",
        className,
      )}
    >
      <span aria-hidden className="text-[color:var(--color-signal)]">
        {copied ? "✓" : "⧉"}
      </span>
      {copied ? "Copied" : label}
    </button>
  );
}
