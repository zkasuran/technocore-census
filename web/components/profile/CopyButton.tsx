"use client";

import { useState } from "react";
import { cn } from "@/lib/ui";

/**
 * Small copy-to-clipboard control for the full did:key on a profile.
 * Uses the async clipboard API when present and falls back to a hidden
 * textarea plus execCommand so it still copies on older or locked-down webviews.
 */
export function CopyButton({ value, label = "Copy" }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    let ok = false;
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(value);
        ok = true;
      }
    } catch {
      ok = false;
    }
    if (!ok) {
      try {
        const ta = document.createElement("textarea");
        ta.value = value;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        ok = document.execCommand("copy");
        document.body.removeChild(ta);
      } catch {
        ok = false;
      }
    }
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={`${label} did:key`}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
        copied
          ? "border-[color:var(--color-signal)] text-[color:var(--color-signal)] bg-[color:var(--color-signal)]/10"
          : "border-[color:var(--color-line)] text-[color:var(--color-ink-dim)] hover:text-[color:var(--color-ink)] hover:bg-[color:var(--color-panel-2)]",
      )}
    >
      {copied ? "Copied" : label}
    </button>
  );
}
