import { getCensus, getLeaderboard } from "@/lib/data";

// getCensus / getLeaderboard read the local report with node:fs, so this route is Node.
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

// The census aggregates: derived figures, service state and the snapshot window,
// plus the leaderboard totals so a caller gets the headline counts in one read.
export function GET() {
  const census = getCensus();

  return Response.json(
    {
      schema: SCHEMA,
      version: VERSION,
      note: NOTE,
      captured_at: census.captured_at,
      base_url: census.base_url,
      totals: getLeaderboard().totals,
      derived: census.derived,
      service: census.service,
      window: census.window,
    },
    { headers: { "Cache-Control": CACHE, ...CORS } },
  );
}
