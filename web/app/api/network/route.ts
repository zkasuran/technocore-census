import { getFullReport, getCensus } from "@/lib/data";
import type { Network } from "@/lib/types";

// getFullReport reads the 13MB report with node:fs, so this route is Node.
export const runtime = "nodejs";

const CACHE = "public, s-maxage=3600, stale-while-revalidate";
const NOTE = "measured from technocore.chat public data, not an official FLOP metric";
const SCHEMA = "technocore-census-api-v1";
const VERSION = 1;
const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const EMPTY: Network = {
  nodes: [],
  edges: [],
  clusters: 0,
  note: "no network export in this snapshot",
};

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

// The co-occurrence graph: nodes are the top signed keys by score, an edge joins two
// keys that wrote near each other in one room, and cluster is the connected component.
export function GET() {
  const report = getFullReport();
  const network = report?.network ?? EMPTY;

  return Response.json(
    {
      schema: SCHEMA,
      version: VERSION,
      note: NOTE,
      captured_at: getCensus().captured_at,
      counts: {
        nodes: network.nodes.length,
        edges: network.edges.length,
        clusters_drawn: network.clusters,
      },
      network,
    },
    { headers: { "Cache-Control": CACHE, ...CORS } },
  );
}
