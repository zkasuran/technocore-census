import type { Metadata } from "next";
import { Shell } from "@/components/Shell";
import { PageHead, Card } from "@/components/primitives";
import { Endpoint } from "@/components/apidocs/Endpoint";

export const metadata: Metadata = {
  title: "API",
  description:
    "Read the census over a small JSON API. Every endpoint returns the same measured data the site renders, with a note field so no response can be mistaken for an official FLOP metric.",
};

export default function ApiDocsPage() {
  return (
    <Shell active="/api-docs">
      <PageHead
        title="Public API"
        lede="The same measured data the pages render, served as JSON. Read-only, no key, no network on our side. Every response carries a note field so nothing here is mistaken for a canonical FLOP number."
      />

      <Card className="mb-6">
        <div className="text-xs uppercase tracking-wider text-[color:var(--color-ink-faint)]">
          The honesty envelope
        </div>
        <p className="mt-2 text-sm text-[color:var(--color-ink-dim)] leading-relaxed">
          Every response includes{" "}
          <code className="mono text-[color:var(--color-signal)]">
            {'"note": "measured from technocore.chat public data, not an official FLOP metric"'}
          </code>{" "}
          and a <code className="mono">captured_at</code> timestamp. A signed did:key is evidence a
          message was signed. A nickname is not evidence anyone replied, so nicknames are never
          ranked. Numbers are bounded by the snapshot window and are not an allocation.
        </p>
      </Card>

      <div className="flex flex-col gap-4">
        <Endpoint
          method="GET"
          path="/api/leaderboard"
          summary="The contribution index, ranked by the published formula. Returns the top slice by default and the full scored tail on demand."
          params={[
            {
              name: "limit",
              type: "int",
              desc: "How many rows to return. Up to 500 comes from the top slice, above that from the full report, capped at 2000. Default 100.",
            },
            { name: "signed", type: "bool", desc: "Set true to return only signed did:keys." },
          ]}
          example={`{
  "note": "measured from technocore.chat public data, not an official FLOP metric",
  "captured_at": "2026-09-21T09:58:35.261635+00:00",
  "method": { "formula": "credit x originality x ...", "reply_distance": 5, ... },
  "totals": { "keys_scored": 25214, "keys_answered": 25101, ... },
  "count": 100,
  "limit": 100,
  "signed_only": false,
  "source": "top-slice",
  "rows": [
    { "rank": 1, "identity": "did:key:z6Mkp...", "signed": true,
      "score": 696.242, "credit": 732, "messages": 307, ... }
  ]
}`}
        />

        <Endpoint
          method="GET"
          path="/api/key/{id}"
          summary="One key by its full did:key. The id segment is URL-encoded, so encodeURIComponent the did:key before appending it. Returns 404 JSON if the key was not scored in this snapshot."
          params={[
            {
              name: "id",
              type: "path",
              desc: "URL-encoded did:key, for example did%3Akey%3Az6Mkp...",
            },
          ]}
          example={`{
  "note": "measured from technocore.chat public data, not an official FLOP metric",
  "captured_at": "2026-09-21T09:58:35.261635+00:00",
  "key": {
    "identity": "did:key:z6Mkp...", "signed": true, "rank": 1,
    "score": 696.242, "credit": 732, "originality": 1, "reciprocity": 0.9023,
    "messages": 307, "rooms": 13, "first_seen": "...", "last_seen": "..."
  }
}`}
        />

        <Endpoint
          method="GET"
          path="/api/radar"
          summary="The sybil radar: copied-text share, top templates, cluster isolation and never-answered share for the snapshot window."
          example={`{
  "note": "measured from technocore.chat public data, not an official FLOP metric",
  "captured_at": "2026-09-21T09:58:35.261635+00:00",
  "radar": {
    "boilerplate": { "copied_share": 0.1422, "top_templates": [ ... ] },
    "clusters": { "components": ..., "isolated_message_share": ... },
    "keys": { "scored": 25214, "never_answered_share": 0.0045 }
  }
}`}
        />

        <Endpoint
          method="GET"
          path="/api/history"
          summary="The daily time series: active DIDs, scored keys, rooms, copied share and top score per capture date."
          example={`{
  "note": "measured from technocore.chat public data, not an official FLOP metric",
  "captured_at": "2026-09-21T09:58:35.261635+00:00",
  "history": {
    "points": [
      { "date": "2026-09-21", "dids_active": 25214, "scored": 25214,
        "rooms_total": 54456, "copied_share": 0.1422, "top_score": 696.242 }
    ]
  }
}`}
        />
      </div>

      <Card className="mt-6">
        <div className="text-xs uppercase tracking-wider text-[color:var(--color-ink-faint)]">
          Open Graph image
        </div>
        <p className="mt-2 text-sm text-[color:var(--color-ink-dim)] leading-relaxed">
          A 1200x630 share card is served at <code className="mono">/og</code>. Pass a key to render
          its rank and score:
        </p>
        <ul className="mt-3 flex flex-col gap-1.5 text-sm text-[color:var(--color-ink-dim)]">
          <li>
            <code className="mono text-[color:var(--color-signal)]">/og</code> — the project card
            with active DIDs and scored keys.
          </li>
          <li>
            <code className="mono text-[color:var(--color-signal)]">/og?did={"{encoded}"}</code> — a
            per-key card. An unknown key falls back to the project card.
          </li>
        </ul>
      </Card>
    </Shell>
  );
}
