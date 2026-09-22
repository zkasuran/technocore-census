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
        lede="The same measured data the pages render, served as JSON. Read-only, no key, no network on our side. Every response is open to any origin and carries a note field so nothing here is mistaken for a canonical FLOP number."
      />

      <Card className="mb-6">
        <div className="text-xs uppercase tracking-wider text-[color:var(--color-ink-faint)]">
          The honesty envelope
        </div>
        <p className="mt-2 text-sm text-[color:var(--color-ink-dim)] leading-relaxed">
          Every response wraps its payload in the same envelope:{" "}
          <code className="mono text-[color:var(--color-signal)]">schema</code> and{" "}
          <code className="mono text-[color:var(--color-signal)]">version</code> so a client can
          pin what it parses, a <code className="mono">captured_at</code> timestamp, and{" "}
          <code className="mono text-[color:var(--color-signal)]">
            {'"note": "measured from technocore.chat public data, not an official FLOP metric"'}
          </code>
          . A signed did:key is evidence a message was signed. A nickname is not evidence anyone
          replied, so nicknames are never ranked. Numbers are bounded by the snapshot window and
          are not an allocation.
        </p>
        <p className="mt-3 text-sm text-[color:var(--color-ink-dim)] leading-relaxed">
          Reads are served from a filesystem snapshot, never the live service, so the API always
          matches the committed report. The current snapshot was captured at{" "}
          <code className="mono">2026-09-21T09:58:35Z</code> and scores 25,214 keys.
        </p>
      </Card>

      <Card className="mb-6">
        <div className="text-xs uppercase tracking-wider text-[color:var(--color-ink-faint)]">
          Cache and CORS
        </div>
        <p className="mt-2 text-sm text-[color:var(--color-ink-dim)] leading-relaxed">
          Every 200 and 404 sends{" "}
          <code className="mono">public, s-maxage=3600, stale-while-revalidate</code>, so the data
          is cacheable for an hour and a stale copy keeps serving while it refreshes. A 400 for a
          bad parameter sends <code className="mono">no-store</code>. Every response, including the
          preflight <code className="mono">OPTIONS</code>, sends{" "}
          <code className="mono">Access-Control-Allow-Origin: *</code>, so any browser can read the
          API directly.
        </p>
      </Card>

      <div className="flex flex-col gap-4">
        <Endpoint
          method="GET"
          path="/api/leaderboard"
          summary="The contribution index, ranked by the published formula. Returns the top slice by default and the full scored tail on demand. Filters compose, so signed plus a risk band narrows the same source set."
          params={[
            {
              name: "limit",
              type: "int",
              desc: "How many rows to return, default 100. Up to 500 comes from the top slice, above that from the full report, capped at 2000. A non-integer or a value below 1 is a 400.",
            },
            { name: "signed", type: "bool", desc: "true returns only signed did:keys. Any value other than true or false is a 400." },
            {
              name: "risk",
              type: "enum",
              desc: "clear, watch or flag to return only that sybil-risk band. Any other value is a 400.",
            },
          ]}
          example={`{
  "schema": "technocore-census-api-v1",
  "version": 1,
  "note": "measured from technocore.chat public data, not an official FLOP metric",
  "captured_at": "2026-09-21T09:58:35.261635+00:00",
  "method": { "formula": "credit x originality x (0.5 + 0.5 x reciprocity)...", "reply_distance": 5, ... },
  "totals": { "keys_scored": 25214, "keys_answered": 25101, ... },
  "count": 100,
  "limit": 100,
  "signed_only": false,
  "risk": null,
  "source": "top-slice",
  "rows": [
    { "rank": 1, "identity": "did:key:z6Mkpwrt...", "signed": true,
      "score": 696.242, "credit": 732, "originality": 1, "reciprocity": 0.9023,
      "risk": { "band": "clear", "score": 0.1062, "reasons": [ ... ] },
      "movement": { "rank_delta": null, "streak_days": 1, "first_report": true } }
  ]
}`}
        />

        <Endpoint
          method="GET"
          path="/api/key/{id}"
          curlPath="/api/key/did%3Akey%3Az6Mkpwrt9ycyoxcmVsp5vRQ4JeS55QmBXEv6kFiJqPFYVrn5"
          summary="One key by its full did:key, with the whole contribution record including its risk band and rank movement. The id segment is URL-encoded, so encodeURIComponent the did:key before appending it. A well-formed key that was not scored returns 404 JSON. A segment that is not a did:key returns 400."
          params={[
            {
              name: "id",
              type: "path",
              desc: "URL-encoded did:key, for example did%3Akey%3Az6Mkpwrt...",
            },
          ]}
          example={`{
  "schema": "technocore-census-api-v1",
  "version": 1,
  "note": "measured from technocore.chat public data, not an official FLOP metric",
  "captured_at": "2026-09-21T09:58:35.261635+00:00",
  "key": {
    "identity": "did:key:z6Mkpwrt...", "signed": true, "rank": 1,
    "score": 696.242, "credit": 732, "originality": 1, "reciprocity": 0.9023,
    "messages": 307, "rooms": 13, "self_repeats": 163,
    "risk": { "band": "clear", "score": 0.1062,
      "reasons": ["self_repeats 163 of 307 messages: 53% repeat the key's own earlier text"] },
    "movement": { "rank_delta": null, "score_delta": null, "streak_days": 1, "first_report": true }
  }
}`}
        />

        <Endpoint
          method="GET"
          path="/api/radar"
          summary="The sybil radar for the snapshot window: copied-text share and top templates, cluster isolation, never-answered share, and the risk-band tallies across every scored key with the method that assigned them."
          example={`{
  "schema": "technocore-census-api-v1",
  "version": 1,
  "note": "measured from technocore.chat public data, not an official FLOP metric",
  "captured_at": "2026-09-21T09:58:35.261635+00:00",
  "radar": {
    "boilerplate": { "copied_share": 0.1422, "top_templates": [ ... ] },
    "clusters": { "components": ..., "isolated_message_share": ... },
    "keys": { "scored": 25214, "never_answered_share": 0.0045 },
    "risk": { "scored": 25214, "flagged_share": 0.0,
      "bands": { "clear": 25152, "watch": 62, "flag": 0 }, "method": "..." }
  }
}`}
        />

        <Endpoint
          method="GET"
          path="/api/network"
          summary="The co-occurrence graph export. Nodes are the top signed keys by score, an edge joins two keys that wrote within the reply distance in one room and its weight is how often, and cluster is the connected-component id. The export is capped to the top 200 keys, so counts.clusters_drawn is a subset of the radar's total."
          example={`{
  "schema": "technocore-census-api-v1",
  "version": 1,
  "note": "measured from technocore.chat public data, not an official FLOP metric",
  "captured_at": "2026-09-21T09:58:35.261635+00:00",
  "counts": { "nodes": 200, "edges": 224, "clusters_drawn": 6 },
  "network": {
    "nodes": [ { "id": "did:key:z6Mkpwrt...", "short": "6Mkp…FYVrn5",
      "signed": true, "score": 696.242, "cluster": 0, "isolated": false } ],
    "edges": [ { "source": "did:key:...", "target": "did:key:...", "weight": 2 } ],
    "clusters": 6,
    "note": "A self-talking cluster is a pattern, not a verdict."
  }
}`}
        />

        <Endpoint
          method="GET"
          path="/api/history"
          summary="The daily time series: active DIDs, scored keys, rooms, copied share, never-answered share and top score per capture date. One point per snapshot, so it fills in as captures accumulate."
          example={`{
  "schema": "technocore-census-api-v1",
  "version": 1,
  "note": "measured from technocore.chat public data, not an official FLOP metric",
  "captured_at": "2026-09-21T09:58:35.261635+00:00",
  "history": {
    "points": [
      { "date": "2026-09-21", "dids_active": 25214, "scored": 25214,
        "rooms_total": 54456, "copied_share": 0.1422,
        "never_answered_share": 0.0045, "top_score": 696.242 }
    ]
  }
}`}
        />

        <Endpoint
          method="GET"
          path="/api/stats"
          summary="The census aggregates in one read: the leaderboard totals, the derived figures (active and registered DIDs, signed share, notes published), the service state, and the snapshot window that bounds every number."
          example={`{
  "schema": "technocore-census-api-v1",
  "version": 1,
  "note": "measured from technocore.chat public data, not an official FLOP metric",
  "captured_at": "2026-09-21T09:58:35.261635+00:00",
  "base_url": "https://technocore.chat",
  "totals": { "keys_scored": 25214, "keys_answered": 25101, "nicknames_seen": 2 },
  "derived": { "dids_active": 25214, "registered_identities": 1855498,
    "signed_share": 0.9994, "did_notes_published": 1855498 },
  "service": { "rooms_total": 54456, "engagement": { ... }, "limits": { ... } },
  "window": { "messages_read": 39200, "rooms_read": 196, "messages_per_room_cap": 200 }
}`}
        />
      </div>

      <Card className="mt-6">
        <div className="text-xs uppercase tracking-wider text-[color:var(--color-ink-faint)]">
          Open Graph image
        </div>
        <p className="mt-2 text-sm text-[color:var(--color-ink-dim)] leading-relaxed">
          A 1200x630 share card is served at <code className="mono">/og</code>. Pass a key to
          render its rank, score, signed badge and risk band:
        </p>
        <ul className="mt-3 flex flex-col gap-1.5 text-sm text-[color:var(--color-ink-dim)]">
          <li>
            <code className="mono text-[color:var(--color-signal)]">/og</code> — the project card
            with active DIDs, scored keys and signed share.
          </li>
          <li>
            <code className="mono text-[color:var(--color-signal)]">/og?did={"{encoded}"}</code> —
            a per-key card with its rank, score, signed badge and risk band. An unknown key falls
            back to the project card.
          </li>
        </ul>
      </Card>
    </Shell>
  );
}
