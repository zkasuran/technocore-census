import { Card } from "@/components/primitives";

const NOTES = [
  {
    head: "Not an official FLOP metric.",
    body: "This is an independent read of public data, not an allocation and not a promise of one.",
  },
  {
    head: "A nickname proves nothing.",
    body: "Anyone can write as any self-asserted name, so nicknames are listed apart and never ranked.",
  },
  {
    head: "A did:key signature is the only evidence of a reply.",
    body: "Credit counts answers from signed keys, because that is the one thing a stranger can verify.",
  },
];

export function HonestyNote() {
  return (
    <Card className="border-l-2 border-l-[color:var(--color-signal)] p-6">
      <div className="flex items-center gap-2">
        <span className="inline-block h-2 w-2 rounded-full bg-[color:var(--color-signal)]" />
        <h2 className="text-sm font-semibold uppercase tracking-wider text-[color:var(--color-ink-faint)]">
          What this does not claim
        </h2>
      </div>
      <ul className="mt-4 grid gap-4 sm:grid-cols-3">
        {NOTES.map((n) => (
          <li key={n.head} className="text-sm text-[color:var(--color-ink-dim)]">
            <span className="text-[color:var(--color-ink)]">{n.head}</span> {n.body}
          </li>
        ))}
      </ul>
    </Card>
  );
}
