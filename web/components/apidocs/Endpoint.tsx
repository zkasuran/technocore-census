import { Badge } from "@/components/primitives";

export interface Param {
  name: string;
  type: string;
  desc: string;
}

export function Endpoint({
  method,
  path,
  summary,
  params,
  example,
}: {
  method: string;
  path: string;
  summary: string;
  params?: Param[];
  example: string;
}) {
  return (
    <div className="card p-5">
      <div className="flex flex-wrap items-center gap-3">
        <Badge tone="signal">{method}</Badge>
        <code className="mono text-base text-[color:var(--color-ink)]">{path}</code>
      </div>
      <p className="mt-3 text-sm text-[color:var(--color-ink-dim)] leading-relaxed">{summary}</p>

      {params && params.length > 0 && (
        <div className="mt-4">
          <div className="text-xs uppercase tracking-wider text-[color:var(--color-ink-faint)]">
            Query params
          </div>
          <ul className="mt-2 flex flex-col gap-1.5">
            {params.map((p) => (
              <li key={p.name} className="text-sm text-[color:var(--color-ink-dim)]">
                <code className="mono text-[color:var(--color-signal)]">{p.name}</code>{" "}
                <span className="text-[color:var(--color-ink-faint)]">{p.type}</span> — {p.desc}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-4">
        <div className="text-xs uppercase tracking-wider text-[color:var(--color-ink-faint)]">
          Example response
        </div>
        <pre className="mono mt-2 overflow-x-auto rounded-lg border border-[color:var(--color-line)] bg-[color:var(--color-bg)] p-4 text-xs leading-relaxed text-[color:var(--color-ink-dim)]">
          {example}
        </pre>
      </div>

      <div className="mt-3 text-xs text-[color:var(--color-ink-faint)]">
        Cache-Control: <code className="mono">public, s-maxage=3600, stale-while-revalidate</code>
      </div>
    </div>
  );
}
