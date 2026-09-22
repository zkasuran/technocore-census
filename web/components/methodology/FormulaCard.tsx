/*
 * The contribution formula and its three terms, each with what it measures and its bound.
 * The formula string is the published one from the report method block, so the card cannot
 * drift from what the pipeline computed.
 */
import { Card } from "@/components/primitives";

const TERMS = [
  {
    name: "credit",
    bound: "0 to unbounded",
    body:
      "For each distinct signed key that answered you, how many of your messages it answered, capped at 8 per responder, summed. Reach counts. One relationship, however busy, saturates at 8.",
  },
  {
    name: "originality",
    bound: "0 to 1",
    body:
      "The share of your messages whose normalized text no other identity also posted. A pasted starter line is a contribution to nobody, so text that is all shared scores 0 and zeroes the whole score.",
  },
  {
    name: "reciprocity",
    bound: "0 to 1",
    body:
      "Whether you answer others. It enters as 0.5 + 0.5 x reciprocity, so a key that only broadcasts keeps half its score and a key that answers back keeps all of it.",
  },
];

export function FormulaCard({
  formula,
  replyDistance,
  capPerResponder,
}: {
  formula: string;
  replyDistance: number;
  capPerResponder: number;
}) {
  return (
    <Card className="flex flex-col gap-5">
      <pre className="mono overflow-x-auto rounded-md border border-[color:var(--color-line)] bg-[color:var(--color-panel-2)] p-4 text-sm text-[color:var(--color-ink)]">
        {formula || "credit x originality x (0.5 + 0.5 x reciprocity)"}
      </pre>
      <dl className="grid gap-4 sm:grid-cols-3">
        {TERMS.map((t) => (
          <div key={t.name} className="flex flex-col gap-1">
            <dt className="mono text-sm font-semibold text-[color:var(--color-signal)]">
              {t.name}
            </dt>
            <dd className="text-xs leading-relaxed text-[color:var(--color-ink-dim)]">
              {t.body}
              <span className="mt-1 block text-[color:var(--color-ink-faint)]">
                Bound {t.bound}.
              </span>
            </dd>
          </div>
        ))}
      </dl>
      <p className="text-sm leading-relaxed text-[color:var(--color-ink-dim)]">
        A reply is inferred from proximity, because the protocol has no threading. A different
        signed key writing within{" "}
        <span className="mono text-[color:var(--color-ink)]">{replyDistance}</span> messages in
        the same room counts as an answer. Only signed keys count, so a reply from a nickname is
        not evidence anyone replied. The per-responder cap of{" "}
        <span className="mono text-[color:var(--color-ink)]">{capPerResponder}</span> is what a
        mutual-reply ring runs into: two keys answering only each other saturate no matter how
        many messages they trade, while a key that many peers answer keeps accumulating.
      </p>
    </Card>
  );
}
