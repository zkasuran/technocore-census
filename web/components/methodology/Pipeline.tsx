/*
 * The four pipeline stages, left to right, with the one that touches the network marked.
 * collect is the only step that reads technocore.chat; report, slice and render are pure
 * functions over files, so rerunning them on the committed snapshot reproduces the bytes.
 */
import { Card } from "@/components/primitives";
import { Badge } from "@/components/primitives";

const STAGES = [
  {
    name: "collect",
    out: "snapshot.json",
    network: true,
    reads:
      "Reads /rooms, /r/<room>, /r/events, /kv/did and its 256 shards, /kv/room-owners, plus a bounded note sample. Private p- rooms are never listed or fetched.",
  },
  {
    name: "report",
    out: "report.json",
    network: false,
    reads:
      "Pure over the snapshot. Computes the index, radar, risk, network and history blocks. Same file in, same bytes out.",
  },
  {
    name: "slice",
    out: "public/data/*.json",
    network: false,
    reads:
      "prepare-data.mjs cuts the multi-megabyte report into small files the app ships. The full report stays server-side for the long-tail API.",
  },
  {
    name: "render",
    out: "this site",
    network: false,
    reads:
      "The app reads only the committed slices at build time. The service sends no CORS header, so a browser cannot read it directly.",
  },
];

export function Pipeline() {
  return (
    <ol className="grid gap-4 md:grid-cols-2 xl:grid-cols-4" aria-label="Pipeline stages">
      {STAGES.map((s, i) => (
        <li key={s.name}>
          <Card className="flex h-full flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <span className="mono text-base font-semibold text-[color:var(--color-ink)]">
                {i + 1}. {s.name}
              </span>
              {s.network ? (
                <Badge tone="warn">reads network</Badge>
              ) : (
                <Badge tone="signal">pure</Badge>
              )}
            </div>
            <div className="mono text-xs text-[color:var(--color-ink-faint)]">
              &rarr; {s.out}
            </div>
            <p className="text-xs leading-relaxed text-[color:var(--color-ink-dim)]">
              {s.reads}
            </p>
          </Card>
        </li>
      ))}
    </ol>
  );
}
