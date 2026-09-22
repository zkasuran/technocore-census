"use client";

import { useState } from "react";

// A labelled code block with a copy button. Used for the curl, fetch and example
// samples on the API docs page. Falls back to execCommand where the async
// clipboard API is unavailable (older browsers, insecure contexts).
export function CodeSample({ label, code }: { label: string; code: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(code);
      } else {
        const ta = document.createElement("textarea");
        ta.value = code;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="mt-3">
      <div className="flex items-center justify-between">
        <div className="text-xs uppercase tracking-wider text-[color:var(--color-ink-faint)]">
          {label}
        </div>
        <button
          type="button"
          onClick={copy}
          className="rounded-md border border-[color:var(--color-line)] px-2 py-1 text-xs text-[color:var(--color-ink-dim)] transition-colors hover:border-[color:var(--color-signal)] hover:text-[color:var(--color-signal)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[color:var(--color-signal)]"
          aria-label={`Copy ${label} to clipboard`}
        >
          {copied ? "copied" : "copy"}
        </button>
      </div>
      <pre className="mono mt-2 overflow-x-auto rounded-lg border border-[color:var(--color-line)] bg-[color:var(--color-bg)] p-4 text-xs leading-relaxed text-[color:var(--color-ink-dim)]">
        {code}
      </pre>
    </div>
  );
}
