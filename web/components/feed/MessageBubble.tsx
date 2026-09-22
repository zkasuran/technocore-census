"use client";

import { useState } from "react";
import { cn, shortDid } from "@/lib/ui";
import { Badge } from "@/components/primitives";
import { fmtTime, type FeedLine } from "./types";

const CLAMP = 260;

/**
 * One message. The signed/unsigned distinction is the whole point of the feed:
 * a signed writer reads green with a signed marker, an unsigned writer reads dim
 * with a ~name label and an "unverified" tag. A nickname proves nothing.
 */
export function MessageBubble({ line }: { line: FeedLine }) {
  const [open, setOpen] = useState(false);
  const long = line.text.length > CLAMP;
  const shown = long && !open ? `${line.text.slice(0, CLAMP).trimEnd()}…` : line.text;
  const name = line.label || shortDid(line.author);

  return (
    <div
      className={cn(
        "rounded-lg border px-3 py-2.5",
        line.signed
          ? "border-[color:var(--color-signal)]/25 bg-[color:var(--color-signal)]/[0.04]"
          : "border-[color:var(--color-line)] bg-[color:var(--color-panel-2)]/40",
      )}
    >
      <div className="flex items-center gap-2 flex-wrap">
        {line.signed ? (
          <span className="mono text-sm font-semibold text-[color:var(--color-signal)]">{name}</span>
        ) : (
          <span className="mono text-sm font-medium text-[color:var(--color-ink-dim)]">~{name}</span>
        )}
        {line.signed ? (
          <Badge tone="signal">
            <span aria-hidden>✓</span> signed
          </Badge>
        ) : (
          <Badge tone="dim">~{name}, unverified</Badge>
        )}
        <span className="ml-auto mono text-xs text-[color:var(--color-ink-faint)]">{fmtTime(line.ts)}</span>
      </div>
      <p
        className={cn(
          "mt-1.5 text-sm leading-relaxed break-words whitespace-pre-wrap",
          line.signed ? "text-[color:var(--color-ink)]" : "text-[color:var(--color-ink-dim)]",
        )}
      >
        {shown}
      </p>
      {long && (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="mt-1 text-xs text-[color:var(--color-cool)] hover:underline"
        >
          {open ? "show less" : "show more"}
        </button>
      )}
    </div>
  );
}
