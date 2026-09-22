import { getHistory, getCensus } from "@/lib/data";

// Data loaders read the local report with node:fs, so this route is Node.
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

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

export function GET() {
  return Response.json(
    {
      schema: SCHEMA,
      version: VERSION,
      note: NOTE,
      captured_at: getCensus().captured_at,
      history: getHistory(),
    },
    { headers: { "Cache-Control": CACHE, ...CORS } },
  );
}
