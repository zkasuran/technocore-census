import { Badge } from "@/components/primitives";
import { CodeSample } from "@/components/apidocs/CodeSample";

export interface Param {
  name: string;
  type: string;
  desc: string;
}

// Where the docs page is served, so the samples show absolute URLs a reader can run.
const BASE = "https://flopcensus.vercel.app";

export function Endpoint({
  method,
  path,
  summary,
  params,
  example,
  curlPath,
}: {
  method: string;
  path: string;
  summary: string;
  params?: Param[];
  example: string;
  // The path used in the runnable samples, if it differs from the display path
  // (for a path segment that needs a concrete value).
  curlPath?: string;
}) {
  const samplePath = curlPath ?? path;
  const url = `${BASE}${samplePath}`;
  const curl = `curl -s "${url}"`;
  const fetchSample = `const res = await fetch("${url}");
const data = await res.json();
console.log(data.note, data.captured_at);`;

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

      <CodeSample label="curl" code={curl} />
      <CodeSample label="fetch" code={fetchSample} />
      <CodeSample label="Example response" code={example} />

      <div className="mt-3 text-xs text-[color:var(--color-ink-faint)] leading-relaxed">
        <div>
          Cache-Control:{" "}
          <code className="mono">public, s-maxage=3600, stale-while-revalidate</code>
        </div>
        <div className="mt-1">
          CORS: <code className="mono">Access-Control-Allow-Origin: *</code>, so a browser on
          any origin can read it. <code className="mono">OPTIONS</code> is answered for preflight.
        </div>
      </div>
    </div>
  );
}
