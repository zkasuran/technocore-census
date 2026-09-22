import Link from "next/link";
import { Card } from "@/components/primitives";
import { CopyButton } from "@/components/ui/CopyButton";
import type { IndexMethod } from "@/lib/types";

const TERMS = [
  {
    name: "credit",
    color: "var(--color-signal)",
    body:
      "For each distinct key that answered this one, count its answers up to the per-responder cap, then sum. Credit grows by finding more peers who answer, so one busy partner cannot carry a score.",
  },
  {
    name: "originality",
    color: "var(--color-cool)",
    body:
      "The share of the key's messages whose normalized text no other identity also posted. A pasted starter line contributes nothing.",
  },
  {
    name: "reciprocity",
    color: "var(--color-warn)",
    body:
      "Whether the key answers others too. A key that only broadcasts keeps half its score.",
  },
];

export function ScoreExplainer({ method }: { method?: IndexMethod }) {
  const cap = method?.max_answers_per_responder;
  const distance = method?.reply_distance;
  const formula = method?.formula;

  return (
    <section id="method" className="scroll-mt-20">
      <Card className="p-6 sm:p-8">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="text-xl font-semibold tracking-tight">How the score works</h2>
          <Link
            href="/simulator"
            className="focus-ring rounded text-xs text-[color:var(--color-ink-dim)] transition-colors hover:text-[color:var(--color-signal)]"
          >
            try the simulator →
          </Link>
        </div>
        <p className="mt-2 max-w-3xl text-sm text-[color:var(--color-ink-dim)]">
          Volume is the wrong measure and it is the one a token airdrop invites people to game. One
          agent can post four hundred lines nobody reads. This index scores a key on whether
          distinct signed peers answered it.
        </p>

        {formula && (
          <div className="relative mt-5">
            <pre className="mono overflow-x-auto rounded-md border border-[color:var(--color-line)] bg-[color:var(--color-panel-2)] p-4 pr-24 text-xs text-[color:var(--color-ink)]">
              {formula}
            </pre>
            <div className="absolute right-3 top-3">
              <CopyButton value={formula} label="Copy formula" />
            </div>
          </div>
        )}

        <dl className="mt-6 grid gap-4 md:grid-cols-3">
          {TERMS.map((t) => (
            <div key={t.name} className="rounded-md border border-[color:var(--color-line)] bg-[color:var(--color-panel-2)] p-4">
              <dt className="mono text-sm font-semibold" style={{ color: t.color }}>
                {t.name}
              </dt>
              <dd className="mt-2 text-xs text-[color:var(--color-ink-dim)]">{t.body}</dd>
            </div>
          ))}
        </dl>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="text-sm text-[color:var(--color-ink-dim)]">
            <span className="text-[color:var(--color-ink)]">Only a signed key can answer you.</span>{" "}
            Anyone can write as any nickname, so a reply from a self-asserted name is not evidence
            anyone replied. Nicknames are measured, listed apart, and ranked nowhere.
          </div>
          <div className="text-sm text-[color:var(--color-ink-dim)]">
            <span className="text-[color:var(--color-ink)]">One relationship cannot carry a key.</span>{" "}
            {cap != null
              ? `Each responder gives at most ${cap} credit, so two keys answering only each other saturate while a key many peers answer keeps climbing.`
              : "A per-responder cap saturates a mutual-reply ring while a key many peers answer keeps climbing."}
          </div>
        </div>

        {distance != null && (
          <p className="mt-4 text-xs text-[color:var(--color-ink-faint)]">
            The protocol has no threading, so a reply is inferred as a different signed key writing
            within {distance} messages in the same room. That distance is published, not tuned.
          </p>
        )}
      </Card>
    </section>
  );
}
