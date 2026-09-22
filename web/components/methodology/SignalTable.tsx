/*
 * The five sybil-risk signals as a real table: weight, the floor each one fires past, and
 * what it catches. Values mirror risk.py exactly. This is a signal, not a verdict, so the
 * caption and the band row say so.
 */
import { Card } from "@/components/primitives";

const SIGNALS = [
  {
    name: "Low originality",
    weight: "0.30",
    floor: "originality < 0.5",
    catches: "Most of the key's text was also posted by other identities.",
  },
  {
    name: "Never answered",
    weight: "0.25",
    floor: "3+ messages, 0 responders",
    catches:
      "No signed key answered any message. The 3-message floor spares a key that just arrived.",
  },
  {
    name: "High self-repeat",
    weight: "0.20",
    floor: "self-repeat share >= 0.3",
    catches: "The key keeps re-posting its own earlier text.",
  },
  {
    name: "One peer only",
    weight: "0.15",
    floor: "1 responder, 3+ answered",
    catches:
      "Every answer came from a single peer. The 3-answer floor spares an ordinary first conversation.",
  },
  {
    name: "Boilerplate volume",
    weight: "0.10",
    floor: "5+ copied messages",
    catches: "A high absolute count of copied text, saturating at 25 messages.",
  },
];

export function SignalTable() {
  return (
    <Card className="overflow-hidden p-0">
      <table className="w-full border-collapse text-sm">
        <caption className="px-5 pt-4 text-left text-xs text-[color:var(--color-ink-faint)]">
          Each signal fires only past a published floor and adds a reason naming the number that
          fired it, so the score is exactly the sum of the reasons. A signal, not a verdict.
        </caption>
        <thead>
          <tr className="border-b border-[color:var(--color-line)] text-left text-xs uppercase tracking-wider text-[color:var(--color-ink-faint)]">
            <th scope="col" className="px-5 py-3 font-medium">
              Signal
            </th>
            <th scope="col" className="px-3 py-3 text-right font-medium">
              Weight
            </th>
            <th scope="col" className="px-3 py-3 font-medium">
              Fires past
            </th>
            <th scope="col" className="px-5 py-3 font-medium">
              What it catches
            </th>
          </tr>
        </thead>
        <tbody>
          {SIGNALS.map((s) => (
            <tr
              key={s.name}
              className="border-b border-[color:var(--color-line)] last:border-0 align-top"
            >
              <th scope="row" className="px-5 py-3 text-left font-medium text-[color:var(--color-ink)]">
                {s.name}
              </th>
              <td className="mono px-3 py-3 text-right text-[color:var(--color-signal)]">
                {s.weight}
              </td>
              <td className="mono px-3 py-3 text-xs text-[color:var(--color-ink-dim)]">
                {s.floor}
              </td>
              <td className="px-5 py-3 text-xs leading-relaxed text-[color:var(--color-ink-dim)]">
                {s.catches}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
