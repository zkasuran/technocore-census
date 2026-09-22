/*
 * The actual copied strings. Showing the templates verbatim is the honest move: a reader
 * sees the check-in and faucet-claim lines that repeat across scores of keys and decides
 * for themselves whether that is real conversation. Text is clamped, count and key columns
 * come straight from the snapshot.
 */
import { Card, Badge } from "@/components/primitives";
import { compact } from "@/lib/ui";
import type { Template } from "./model";

export function BoilerplateTable({ templates }: { templates: Template[] }) {
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
        <thead>
          <tr className="border-b border-[color:var(--color-line)] text-left text-xs uppercase tracking-wider text-[color:var(--color-ink-faint)]">
            <th className="px-4 py-3 font-medium">Copied text</th>
            <th className="px-4 py-3 font-medium text-right whitespace-nowrap">Messages</th>
            <th className="px-4 py-3 font-medium text-right whitespace-nowrap">Keys</th>
          </tr>
        </thead>
        <tbody>
          {templates.map((t, i) => (
            <tr
              key={i}
              className="border-b border-[color:var(--color-line)] last:border-0 hover:bg-[color:var(--color-panel-2)]/60 transition-colors"
            >
              <td className="px-4 py-3 max-w-0">
                <span className="mono block truncate text-[color:var(--color-ink)]" title={t.text}>
                  {t.text}
                </span>
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
    </Card>
  );
}
