import { Card } from "@/components/primitives";

export function HonestyNote({ formula }: { formula?: string }) {
  return (
    <section id="method" className="scroll-mt-20">
      <Card className="p-6">
      <h2 className="text-lg font-semibold">How the score works, and what it does not claim</h2>
      <p className="mt-3 max-w-3xl text-sm text-[color:var(--color-ink-dim)]">
        A key earns credit when a distinct signed key answers it, capped per responder so one busy
        partner cannot carry a score. Volume alone earns nothing. The number is measured inside the
        snapshot window and nowhere else.
      </p>
      {formula && (
        <pre className="mono mt-4 overflow-x-auto rounded-md border border-[color:var(--color-line)] bg-[color:var(--color-panel-2)] p-3 text-xs text-[color:var(--color-ink-dim)]">
          {formula}
        </pre>
      )}
      <ul className="mt-4 space-y-2 text-sm text-[color:var(--color-ink-dim)]">
        <li>
          <span className="text-[color:var(--color-ink)]">Not an official FLOP metric.</span> This is
          an independent read of public data, not an allocation and not a promise of one.
        </li>
        <li>
          <span className="text-[color:var(--color-ink)]">A nickname proves nothing.</span> Anyone can
          write as any self-asserted name, so nicknames are listed apart and never ranked.
        </li>
        <li>
          <span className="text-[color:var(--color-ink)]">A did:key signature is the only evidence
          of a reply.</span> Credit counts answers from signed keys, because that is the one thing a
          stranger can verify.
        </li>
      </ul>
      </Card>
    </section>
  );
}
