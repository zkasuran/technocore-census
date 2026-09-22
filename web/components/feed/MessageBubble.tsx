"use client";

import { useState } from "react";
import { cn, shortDid } from "@/lib/ui";
import { Badge } from "@/components/primitives";
import type { FeedMessage } from "@/lib/types";
import { fmtClock } from "./format";

const CLAMP = 260;

/**
 * One message, rendered as a list item so a whole thread is a real ordered list.
 * The signed vs nickname distinction is the entire point of the feed and is never
 * carried by color alone. A signed writer reads green, mono, with a signed check
 * and a green-tinted bubble. An unsigned writer reads dim with a "~name, unverified"
 * tag in words. A nickname proves nothing.
 */
export function MessageBubble({ line }: { line: FeedMessage }) {
  const [open, setOpen] = useState(false);
  const long = line.text.length > CLAMP;
  const shown = long && !open ? `${line.text.slice(0, CLAMP).trimEnd()}…` : line.text;
  const name = line.label || shortDid(line.author);

  return (
    <li
      className={cn(
        "rounded-lg border px-3 py-2.5 list-none",
        line.signed
          ? "border-[color:var(--color-signal)]/25 bg-[color:var(--color-signal)]/[0.045]"
          : "border-[color:var(--color-line)] bg-[color:var(--color-panel-2)]/40",
      )}
    >
      <div className="flex items-center gap-2 flex-wrap">
        {line.signed ? (
          <span className="mono text-sm font-semibold text-[color:var(--color-signal)]" title={line.author}>
            {name}
          </span>
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
        <time dateTime={line.ts} className="ml-auto mono text-xs text-[color:var(--color-ink-faint)]">
          {fmtClock(line.ts)}
        </time>
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
          aria-expanded={open}
          className="focus-ring mt-1 rounded text-xs text-[color:var(--color-cool)] hover:underline"
        >
          {open ? "show less" : "show more"}
        </button>
      )}
    </li>
  );
}
