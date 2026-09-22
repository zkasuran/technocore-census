"use client";

/*
 * The actual copied strings. Showing the templates verbatim is the honest move: a reader
 * sees the check-in and faucet-claim lines that repeat across scores of keys and decides
 * for themselves whether that is real conversation. Long samples clamp to one line with a
 * show-more toggle. Message and key counts come straight from the snapshot.
 */
import { useState } from "react";
import { Card, Badge } from "@/components/primitives";
import { compact } from "@/lib/ui";
import type { Template } from "./model";

const CLAMP_AT = 88; // characters past which a sample gets a show-more toggle

function SampleCell({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const long = text.length > CLAMP_AT;

  if (!long) {
    return <span className="mono block text-[color:var(--color-ink)]">{text}</span>;
  }

  return (
    <div className="flex flex-col gap-1">
      <span className={`mono block text-[color:var(--color-ink)] ${open ? "whitespace-pre-wrap break-words" : "truncate"}`}>
        {text}
      </span>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="self-start text-xs text-[color:var(--color-cool)] hover:underline focus:outline-none focus-visible:ring-1 focus-visible:ring-[color:var(--color-cool)] rounded"
      >
        {open ? "Show less" : "Show full string"}
      </button>
    </div>
  );
}

export function BoilerplateTable({
  templates,
  sharedTexts,
}: {
  templates: Template[];
  sharedTexts?: number;
}) {
  if (templates.length === 0) {
    return (
      <Card className="text-sm text-[color:var(--color-ink-faint)]">
        No repeated templates in this snapshot.
      </Card>
    );
  }

  return (
    <Card className="p-0 overflow-hidden">
      <table className="w-full text-sm">
        <caption className="sr-only">
          Top boilerplate strings by number of distinct keys that posted them, with message
          and key counts.
        </caption>
        <thead>
          <tr className="border-b border-[color:var(--color-line)] text-left text-xs uppercase tracking-wider text-[color:var(--color-ink-faint)]">
            <th scope="col" className="px-4 py-3 font-medium">Copied text</th>
            <th scope="col" className="px-4 py-3 font-medium text-right whitespace-nowrap">Messages</th>
            <th scope="col" className="px-4 py-3 font-medium text-right whitespace-nowrap">Keys</th>
          </tr>
        </thead>
        <tbody>
          {templates.map((t, i) => (
            <tr
              key={i}
              className="border-b border-[color:var(--color-line)] last:border-0 hover:bg-[color:var(--color-panel-2)]/60 transition-colors align-top"
            >
              <td className="px-4 py-3 max-w-0">
                <SampleCell text={t.text} />
              </td>
              <td className="px-4 py-3 text-right mono text-[color:var(--color-ink-dim)] whitespace-nowrap">
                {compact(t.count)}
              </td>
              <td className="px-4 py-3 text-right whitespace-nowrap">
                {t.keys > 0 ? (
                  <Badge tone={t.keys >= 50 ? "flag" : t.keys >= 20 ? "warn" : "dim"}>{compact(t.keys)}</Badge>
                ) : (
                  <span className="text-[color:var(--color-ink-faint)]">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {sharedTexts !== undefined && (
        <div className="border-t border-[color:var(--color-line)] px-4 py-3 text-xs text-[color:var(--color-ink-faint)]">
          Top {templates.length} of {compact(sharedTexts)} strings that more than one key posted.
          The Keys column is how many distinct keys sent that exact line.
        </div>
      )}
    </Card>
  );
}
